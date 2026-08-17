import { cors, db } from './_auth.js';

/** Settings safe to ship to the browser — never includes join_pin. */
function publicSettings(row) {
  if (!row) {
    return {
      pin_required: false,
      require_phone: false,
      one_per_email: false,
      confirm_email: false,
      hide_remaining: false,
      unlisted: false,
      require_notice_ack: false,
      allow_notes: true,
      show_location_link: true,
      claim_opens_at: null,
      claim_closes_at: null,
      notice_title: '',
      notice_body: '',
      success_title: '',
      success_message: '',
      ticket_note: '',
    };
  }
  return {
    pin_required: !!(row.join_pin && String(row.join_pin).trim()),
    require_phone: !!row.require_phone,
    one_per_email: !!row.one_per_email,
    confirm_email: !!row.confirm_email,
    hide_remaining: !!row.hide_remaining,
    unlisted: !!row.unlisted,
    require_notice_ack: !!row.require_notice_ack,
    allow_notes: row.allow_notes !== false,
    show_location_link: row.show_location_link !== false,
    claim_opens_at: row.claim_opens_at || null,
    claim_closes_at: row.claim_closes_at || null,
    notice_title: row.notice_title || '',
    notice_body: row.notice_body || '',
    success_title: row.success_title || '',
    success_message: row.success_message || '',
    ticket_note: row.ticket_note || '',
  };
}

function mapSlots(slots, hideRemaining) {
  return (slots || []).map((s) => {
    const remaining = Math.max(0, (s.capacity || 0) - (s.claimed_count || 0));
    const open = remaining > 0 && !s.locked;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      capacity: hideRemaining ? null : s.capacity,
      claimed_count: hideRemaining ? null : s.claimed_count,
      remaining: hideRemaining ? null : remaining,
      open,
      locked: s.locked,
      sort_order: s.sort_order,
    };
  });
}

/** Public event card — never expose creator_id. */
function publicEventFields(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    event_date: event.event_date,
    cover_url: event.cover_url,
    category: event.category,
    status: event.status,
    join_code: event.join_code,
    locked: event.locked,
  };
}

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const supabase = db(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const code = (req.query?.code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const token = (req.query?.token || '').toString().trim();
    const pin = (req.query?.pin || '').toString();

    // Receipt lookup by secret claim token
    if (token) {
      if (token.length < 8 || token.length > 64) {
        return res.status(404).json({ error: 'Claim not found' });
      }
      const { data: claim } = await supabase
        .from('claims')
        .select('*')
        .eq('claim_token', token)
        .maybeSingle();
      if (!claim) return res.status(404).json({ error: 'Claim not found' });
      const { data: event } = await supabase.from('events').select('*').eq('id', claim.event_id).single();
      const { data: slot } = await supabase.from('slots').select('*').eq('id', claim.slot_id).single();
      const { data: settingsRow } = await supabase
        .from('event_settings')
        .select('*')
        .eq('event_id', claim.event_id)
        .maybeSingle();
      return res.status(200).json({
        claim: {
          id: claim.id,
          slot_id: claim.slot_id,
          event_id: claim.event_id,
          participant_name: claim.participant_name,
          participant_email: claim.participant_email,
          participant_phone: claim.participant_phone,
          notes: claim.notes,
          claim_token: claim.claim_token,
          created_at: claim.created_at,
        },
        event: event
          ? { ...publicEventFields(event), settings: publicSettings(settingsRow) }
          : null,
        slot: slot
          ? {
              id: slot.id,
              name: slot.name,
              description: slot.description,
              category: slot.category,
              capacity: slot.capacity,
              claimed_count: slot.claimed_count,
              locked: slot.locked,
            }
          : null,
      });
    }

    // Event by join code
    if (code) {
      if (!/^[A-Z0-9]{6,16}$/.test(code)) {
        return res.status(404).json({ error: 'No event found for that code' });
      }
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('join_code', code)
        .maybeSingle();
      if (!event) return res.status(404).json({ error: 'No event found for that code' });

      const { data: settingsRow } = await supabase
        .from('event_settings')
        .select('*')
        .eq('event_id', event.id)
        .maybeSingle();
      const settings = publicSettings(settingsRow);
      const expectedPin = (settingsRow?.join_pin || '').toString().trim();

      if (expectedPin && pin.trim() !== expectedPin) {
        // PIN gate — only non-sensitive teaser fields
        return res.status(200).json({
          needs_pin: true,
          pin_required: true,
          id: event.id,
          title: event.title,
          cover_url: event.cover_url,
          category: event.category,
          location: event.location,
          event_date: event.event_date,
          join_code: event.join_code,
          status: event.status,
          locked: event.locked,
        });
      }

      const { data: slots } = await supabase
        .from('slots')
        .select('*')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true });

      return res.status(200).json({
        ...publicEventFields(event),
        settings,
        pin_required: settings.pin_required,
        slots: mapSlots(slots, settings.hide_remaining),
      });
    }

    // Public directory of live, listed events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'live')
      .order('event_date', { ascending: true });
    if (error) throw error;
    const list = events || [];
    const ids = list.map((e) => e.id);
    let slots = [];
    let settingsRows = [];
    if (ids.length) {
      const { data: s } = await supabase.from('slots').select('*').in('event_id', ids);
      slots = s || [];
      const { data: st } = await supabase.from('event_settings').select('*').in('event_id', ids);
      settingsRows = st || [];
    }
    const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.event_id, r]));
    const decorated = list
      .filter((e) => !settingsMap[e.id]?.unlisted)
      .map((e) => {
        const es = slots.filter((s) => s.event_id === e.id);
        const capacity = es.reduce((a, s) => a + (s.capacity || 0), 0);
        const claimed = es.reduce((a, s) => a + (s.claimed_count || 0), 0);
        const hide = !!settingsMap[e.id]?.hide_remaining;
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          location: e.location,
          event_date: e.event_date,
          cover_url: e.cover_url,
          category: e.category,
          join_code: e.join_code,
          locked: e.locked,
          pin_required: !!(settingsMap[e.id]?.join_pin && String(settingsMap[e.id].join_pin).trim()),
          slot_count: es.length,
          capacity: hide ? null : capacity,
          claimed: hide ? null : claimed,
          fill: hide || !capacity ? 0 : claimed / capacity,
        };
      });
    return res.status(200).json(decorated);
  } catch (err) {
    console.error('public API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
