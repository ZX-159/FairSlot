import { cors, getUser, db } from './_auth.js';

const JOIN_LEN = 10;
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeJoinCode(len = JOIN_LEN) {
  let s = '';
  // Prefer Web Crypto when available (Workers / modern Node)
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(len);
      crypto.getRandomValues(buf);
      for (let i = 0; i < len; i++) s += JOIN_ALPHABET[buf[i] % JOIN_ALPHABET.length];
      return s;
    }
  } catch {
    /* fall through */
  }
  for (let i = 0; i < len; i++) {
    s += JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)];
  }
  return s;
}

async function uniqueJoinCode(supabase) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = makeJoinCode(JOIN_LEN);
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('join_code', code)
      .maybeSingle();
    if (!existing) return code;
  }
  // Extremely unlikely — widen to 12
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeJoinCode(12);
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('join_code', code)
      .maybeSingle();
    if (!existing) return code;
  }
  throw new Error('Could not allocate a unique join code');
}

function emptyToNull(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function emptyToBlank(v, max) {
  if (v === undefined) return undefined;
  if (v === null) return '';
  return String(v).slice(0, max);
}

function defaultSettings() {
  return {
    join_pin: '',
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

function normalizeSettings(raw = {}) {
  const base = defaultSettings();
  const toIso = (v) => {
    if (v == null || v === '') return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  return {
    join_pin: raw.join_pin != null ? String(raw.join_pin).trim().slice(0, 32) : base.join_pin,
    require_phone: Boolean(raw.require_phone),
    one_per_email: Boolean(raw.one_per_email),
    confirm_email: Boolean(raw.confirm_email),
    hide_remaining: Boolean(raw.hide_remaining),
    unlisted: Boolean(raw.unlisted),
    require_notice_ack: Boolean(raw.require_notice_ack),
    allow_notes: raw.allow_notes === undefined ? base.allow_notes : Boolean(raw.allow_notes),
    show_location_link:
      raw.show_location_link === undefined ? base.show_location_link : Boolean(raw.show_location_link),
    claim_opens_at: toIso(raw.claim_opens_at),
    claim_closes_at: toIso(raw.claim_closes_at),
    notice_title: raw.notice_title != null ? String(raw.notice_title).slice(0, 200) : '',
    notice_body: raw.notice_body != null ? String(raw.notice_body).slice(0, 5000) : '',
    success_title: raw.success_title != null ? String(raw.success_title).slice(0, 200) : '',
    success_message: raw.success_message != null ? String(raw.success_message).slice(0, 2000) : '',
    ticket_note: raw.ticket_note != null ? String(raw.ticket_note).slice(0, 300) : '',
  };
}

async function readSettings(supabase, eventId) {
  const { data } = await supabase.from('event_settings').select('*').eq('event_id', eventId).maybeSingle();
  return { ...defaultSettings(), ...(data || {}), event_id: eventId };
}

async function writeSettings(supabase, eventId, raw) {
  const settings = { event_id: eventId, ...normalizeSettings(raw) };
  const { data, error } = await supabase
    .from('event_settings')
    .upsert(settings, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function parseId(req) {
  const fromQuery = req.query?.id != null ? Number(req.query.id) : NaN;
  if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;
  const fromBody = req.body?.id != null ? Number(req.body.id) : NaN;
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  return null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const supabase = db(req);
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: missing or invalid Authorization header' });
    }

    if (req.method === 'GET') {
      const id = req.query?.id ? Number(req.query.id) : null;
      if (id) {
        const { data: event, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .eq('creator_id', user.id)
          .single();
        if (error || !event) return res.status(404).json({ error: 'Event not found' });
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('event_id', id)
          .order('sort_order', { ascending: true });
        const { data: claims } = await supabase
          .from('claims')
          .select('*')
          .eq('event_id', id)
          .order('created_at', { ascending: false });
        const settings = await readSettings(supabase, id);
        return res.status(200).json({
          ...event,
          slots: slots || [],
          claims: claims || [],
          settings,
          share_path: `/e/${event.join_code}`,
        });
      }

      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = events || [];
      const ids = list.map((e) => e.id);
      let slots = [];
      let recentClaims = [];
      if (ids.length) {
        const { data: s } = await supabase.from('slots').select('*').in('event_id', ids);
        slots = s || [];
        const { data: c } = await supabase
          .from('claims')
          .select('id,event_id,slot_id,participant_name,created_at')
          .in('event_id', ids)
          .order('created_at', { ascending: false })
          .limit(12);
        recentClaims = c || [];
      }
      const decorated = list.map((e) => {
        const es = slots.filter((s) => s.event_id === e.id);
        const capacity = es.reduce((a, s) => a + (s.capacity || 0), 0);
        const claimed = es.reduce((a, s) => a + (s.claimed_count || 0), 0);
        return {
          ...e,
          slot_count: es.length,
          capacity,
          claimed,
          fill: capacity ? claimed / capacity : 0,
          share_path: `/e/${e.join_code}`,
        };
      });
      return res.status(200).json({ events: decorated, recentClaims });
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      // Regenerate magic link code for an existing event
      if (body.action === 'regenerate_code') {
        const id = Number(body.id);
        if (!id) return res.status(400).json({ error: 'id is required' });
        const { data: existing } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .eq('creator_id', user.id)
          .single();
        if (!existing) return res.status(404).json({ error: 'Event not found' });
        if (existing.locked) return res.status(423).json({ error: 'Locked events cannot change join codes' });
        const join_code = await uniqueJoinCode(supabase);
        const { data, error } = await supabase
          .from('events')
          .update({ join_code })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ ...data, share_path: `/e/${data.join_code}` });
      }

      // Duplicate event (settings + slots, no claims)
      if (body.action === 'duplicate') {
        const id = Number(body.id);
        if (!id) return res.status(400).json({ error: 'id is required' });
        const { data: existing } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .eq('creator_id', user.id)
          .single();
        if (!existing) return res.status(404).json({ error: 'Event not found' });
        const settings = await readSettings(supabase, id);
        const { data: slots } = await supabase
          .from('slots')
          .select('*')
          .eq('event_id', id)
          .order('sort_order', { ascending: true });
        const join_code = await uniqueJoinCode(supabase);
        const { data: created, error } = await supabase
          .from('events')
          .insert({
            creator_id: user.id,
            title: `${existing.title} (copy)`.slice(0, 200),
            description: existing.description || '',
            location: existing.location || '',
            event_date: existing.event_date || null,
            cover_url: existing.cover_url || '',
            category: existing.category || 'General',
            status: 'draft',
            join_code,
            locked: false,
          })
          .select()
          .single();
        if (error) throw error;
        await writeSettings(supabase, created.id, settings);
        if (slots?.length) {
          const rows = slots.map((s, i) => ({
            event_id: created.id,
            name: s.name,
            description: s.description || '',
            category: s.category || 'General',
            capacity: s.capacity || 1,
            claimed_count: 0,
            sort_order: s.sort_order ?? i,
            locked: false,
          }));
          await supabase.from('slots').insert(rows);
        }
        return res.status(201).json({ ...created, share_path: `/e/${created.join_code}` });
      }

      const { title, description, location, event_date, cover_url, category, status, settings } = body;
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });

      const join_code = await uniqueJoinCode(supabase);

      const { data, error } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          title: String(title).trim().slice(0, 200),
          description: description != null ? String(description).slice(0, 5000) : '',
          location: location != null ? String(location).slice(0, 300) : '',
          event_date: emptyToNull(event_date) === undefined ? null : emptyToNull(event_date),
          cover_url: cover_url != null ? String(cover_url).slice(0, 500) : '',
          category: category ? String(category).slice(0, 80) : 'General',
          status: status === 'live' ? 'live' : 'draft',
          join_code,
          locked: false,
        })
        .select()
        .single();
      if (error) throw error;
      const savedSettings = await writeSettings(supabase, data.id, settings || {});
      return res.status(201).json({ ...data, settings: savedSettings, share_path: `/e/${data.join_code}` });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const id = Number(body.id);
      const {
        title,
        description,
        location,
        event_date,
        cover_url,
        category,
        status,
        locked,
        settings,
      } = body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: existing, error: findErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single();
      if (findErr || !existing) return res.status(404).json({ error: 'Event not found' });

      if (existing.locked && locked !== true) {
        return res.status(423).json({ error: 'Event is immutably locked and cannot be edited' });
      }

      const patch = {};
      if (typeof locked === 'boolean' && locked === true) patch.locked = true;
      if (!existing.locked) {
        if (title !== undefined) {
          const t = String(title || '').trim().slice(0, 200);
          if (!t) return res.status(400).json({ error: 'Title cannot be empty' });
          patch.title = t;
        }
        // Allow nulling / clearing optional fields with empty string or null
        if (description !== undefined) patch.description = emptyToBlank(description, 5000) ?? '';
        if (location !== undefined) patch.location = emptyToBlank(location, 300) ?? '';
        if (event_date !== undefined) patch.event_date = emptyToNull(event_date);
        if (cover_url !== undefined) patch.cover_url = emptyToBlank(cover_url, 500) ?? '';
        if (category !== undefined) {
          const c = String(category || '').trim().slice(0, 80);
          patch.category = c || 'General';
        }
        if (status !== undefined) {
          patch.status = ['draft', 'live', 'closed'].includes(status) ? status : existing.status;
        }
      }

      let data = existing;
      if (Object.keys(patch).length) {
        const updated = await supabase.from('events').update(patch).eq('id', id).select().single();
        if (updated.error) throw updated.error;
        data = updated.data;
      }

      let nextSettings = await readSettings(supabase, id);
      if (settings && !existing.locked) {
        nextSettings = await writeSettings(supabase, id, settings);
      }
      return res.status(200).json({ ...data, settings: nextSettings, share_path: `/e/${data.join_code}` });
    }

    if (req.method === 'DELETE') {
      const id = parseId(req);
      if (!id) return res.status(400).json({ error: 'id is required' });
      const force = req.body?.force === true || req.query?.force === '1';

      const { data: existing } = await supabase
        .from('events')
        .select('id,locked,creator_id')
        .eq('id', id)
        .eq('creator_id', user.id)
        .maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Event not found' });
      if (existing.locked && !force) {
        return res.status(423).json({
          error: 'Locked events cannot be deleted. Pass force:true only if you are sure.',
        });
      }

      // Children first (works even without ON DELETE CASCADE)
      await supabase.from('claims').delete().eq('event_id', id);
      await supabase.from('slots').delete().eq('event_id', id);
      await supabase.from('event_settings').delete().eq('event_id', id);
      const { error } = await supabase.from('events').delete().eq('id', id).eq('creator_id', user.id);
      if (error) throw error;
      return res.status(200).json({ ok: true, deleted: id });
    }

    res.status(405).json({ error: `Method not allowed: ${req.method}` });
  } catch (err) {
    console.error('events API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
