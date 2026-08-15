import supabase from './db-client.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function makeToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      const eventId = Number(req.query?.event_id);
      if (!eventId) return res.status(400).json({ error: 'event_id is required' });
      const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('creator_id', user.id)
        .single();
      if (!event) return res.status(404).json({ error: 'Event not found' });
      const { data, error } = await supabase
        .from('claims')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const {
        slot_id,
        participant_name,
        participant_email,
        email_confirm,
        participant_phone,
        notes,
        pin,
        notice_ack,
      } = req.body || {};
      if (!slot_id || !participant_name || !participant_email) {
        return res.status(400).json({ error: 'Name, email and a slot are required' });
      }
      const name = String(participant_name).trim();
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({ error: 'Please enter a name between 2 and 80 characters' });
      }
      const email = String(participant_email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email' });
      }

      const { data: slot } = await supabase.from('slots').select('*').eq('id', slot_id).single();
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      if (slot.locked) return res.status(423).json({ error: 'This slot is locked' });
      if ((slot.claimed_count || 0) >= slot.capacity) {
        return res.status(409).json({ error: 'This slot just filled up' });
      }

      const { data: event } = await supabase.from('events').select('*').eq('id', slot.event_id).single();
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'This event is locked' });
      if (event.status !== 'live') return res.status(423).json({ error: 'This event is not open for claims' });

      const { data: settings } = await supabase
        .from('event_settings')
        .select('*')
        .eq('event_id', event.id)
        .maybeSingle();

      const expectedPin = (settings?.join_pin || '').toString().trim();
      if (expectedPin && String(pin || '').trim() !== expectedPin) {
        return res.status(403).json({ error: 'A valid access PIN is required' });
      }
      if (settings?.require_notice_ack && !notice_ack) {
        return res.status(400).json({ error: 'Please acknowledge the event instructions' });
      }
      if (settings?.require_phone && !String(participant_phone || '').trim()) {
        return res.status(400).json({ error: 'A phone number is required for this event' });
      }
      if (settings?.confirm_email) {
        const confirm = String(email_confirm || '').trim().toLowerCase();
        if (confirm !== email) return res.status(400).json({ error: 'Email addresses do not match' });
      }
      const now = Date.now();
      if (settings?.claim_opens_at && now < new Date(settings.claim_opens_at).getTime()) {
        return res.status(423).json({ error: 'Claims have not opened yet' });
      }
      if (settings?.claim_closes_at && now > new Date(settings.claim_closes_at).getTime()) {
        return res.status(423).json({ error: 'The claim window has closed' });
      }
      if (settings?.one_per_email) {
        const { data: existingClaim } = await supabase
          .from('claims')
          .select('id')
          .eq('event_id', event.id)
          .eq('participant_email', email)
          .maybeSingle();
        if (existingClaim) {
          return res.status(409).json({ error: 'This email already holds a slot on this event' });
        }
      }

      const { data: updated } = await supabase
        .from('slots')
        .update({ claimed_count: slot.claimed_count + 1 })
        .eq('id', slot.id)
        .eq('claimed_count', slot.claimed_count)
        .select()
        .single();
      if (!updated) return res.status(409).json({ error: 'This slot just filled up' });

      const claim_token = makeToken();
      const { data: claim, error } = await supabase
        .from('claims')
        .insert({
          slot_id: slot.id,
          event_id: event.id,
          participant_name: name,
          participant_email: email,
          participant_phone: participant_phone ? String(participant_phone).trim().slice(0, 40) : '',
          notes: notes ? String(notes).trim().slice(0, 500) : '',
          claim_token,
        })
        .select()
        .single();

      if (error || !claim) {
        await supabase.from('slots').update({ claimed_count: slot.claimed_count }).eq('id', slot.id);
        throw error || new Error('Could not save claim');
      }

      return res.status(201).json({
        ...claim,
        slot_name: slot.name,
        event_title: event.title,
        join_code: event.join_code,
      });
    }

    if (req.method === 'DELETE') {
      const { token, id } = req.body || {};
      const user = await getUser(req);

      let claim = null;
      if (token) {
        const { data } = await supabase.from('claims').select('*').eq('claim_token', token).single();
        claim = data;
      } else if (id && user) {
        const { data } = await supabase.from('claims').select('*').eq('id', id).single();
        if (data) {
          const { data: ev } = await supabase
            .from('events')
            .select('creator_id')
            .eq('id', data.event_id)
            .single();
          if (ev?.creator_id === user.id) claim = data;
        }
      }
      if (!claim) return res.status(404).json({ error: 'Claim not found' });

      const { data: event } = await supabase.from('events').select('*').eq('id', claim.event_id).single();
      if (event?.locked) return res.status(423).json({ error: 'Event is locked — claims are immutable' });

      await supabase.from('claims').delete().eq('id', claim.id);
      const { data: slot } = await supabase.from('slots').select('*').eq('id', claim.slot_id).single();
      if (slot && slot.claimed_count > 0) {
        await supabase.from('slots').update({ claimed_count: slot.claimed_count - 1 }).eq('id', slot.id);
      }
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('claims API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
