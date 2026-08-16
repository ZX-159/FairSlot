import { getSupabaseClient } from './db-client.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getUser(req) {
  const supabase = getSupabaseClient();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function makeJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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
    join_pin: raw.join_pin != null ? String(raw.join_pin).trim() : base.join_pin,
    require_phone: Boolean(raw.require_phone),
    one_per_email: Boolean(raw.one_per_email),
    confirm_email: Boolean(raw.confirm_email),
    hide_remaining: Boolean(raw.hide_remaining),
    unlisted: Boolean(raw.unlisted),
    require_notice_ack: Boolean(raw.require_notice_ack),
    claim_opens_at: toIso(raw.claim_opens_at),
    claim_closes_at: toIso(raw.claim_closes_at),
    notice_title: raw.notice_title != null ? String(raw.notice_title) : '',
    notice_body: raw.notice_body != null ? String(raw.notice_body) : '',
    success_title: raw.success_title != null ? String(raw.success_title) : '',
    success_message: raw.success_message != null ? String(raw.success_message) : '',
    ticket_note: raw.ticket_note != null ? String(raw.ticket_note) : '',
  };
}

async function readSettings(eventId) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('event_settings').select('*').eq('event_id', eventId).maybeSingle();
  return { ...defaultSettings(), ...(data || {}), event_id: eventId };
}

async function writeSettings(eventId, raw) {
  const supabase = getSupabaseClient();
  const settings = { event_id: eventId, ...normalizeSettings(raw) };
  const { data, error } = await supabase
    .from('event_settings')
    .upsert(settings, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Basic request logging for debugging method/auth issues
  try {
    console.info(`[events] received request`, { method: req.method });
  } catch (e) {
    // ignore logging errors
  }

  try {
    const user = await getUser(req);
    if (!user) {
      try {
        console.warn('[events] unauthorized request', { method: req.method, hasAuthHeader: !!req.headers.authorization });
      } catch (e) {
        /* ignore */
      }
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
        const settings = await readSettings(id);
        return res.status(200).json({ ...event, slots: slots || [], claims: claims || [], settings });
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
        return { ...e, slot_count: es.length, capacity, claimed, fill: capacity ? claimed / capacity : 0 };
      });
      return res.status(200).json({ events: decorated, recentClaims });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const { title, description, location, event_date, cover_url, category, status, settings } = body;
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });
      let join_code = makeJoinCode();
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase.from('events').select('id').eq('join_code', join_code).maybeSingle();
        if (!existing) break;
        join_code = makeJoinCode();
      }
      const { data, error } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          title: String(title).trim(),
          description: description || '',
          location: location || '',
          event_date: event_date || null,
          cover_url: cover_url || '',
          category: category || 'General',
          status: status === 'live' ? 'live' : 'draft',
          join_code,
          locked: false,
        })
        .select()
        .single();
      if (error) throw error;
      const savedSettings = await writeSettings(data.id, settings || {});
      return res.status(201).json({ ...data, settings: savedSettings });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id, title, description, location, event_date, cover_url, category, status, locked, settings } = body;
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
        if (title !== undefined) patch.title = String(title).trim();
        if (description !== undefined) patch.description = description;
        if (location !== undefined) patch.location = location;
        if (event_date !== undefined) patch.event_date = event_date || null;
        if (cover_url !== undefined) patch.cover_url = cover_url;
        if (category !== undefined) patch.category = category;
        if (status !== undefined) patch.status = status;
      }

      let data = existing;
      if (Object.keys(patch).length) {
        const updated = await supabase.from('events').update(patch).eq('id', id).select().single();
        if (updated.error) throw updated.error;
        data = updated.data;
      }

      let nextSettings = await readSettings(id);
      if (settings && !existing.locked) {
        nextSettings = await writeSettings(id, settings);
      }
      return res.status(200).json({ ...data, settings: nextSettings });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: existing } = await supabase
        .from('events')
        .select('id,locked,creator_id')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single();
      if (!existing) return res.status(404).json({ error: 'Event not found' });
      if (existing.locked) return res.status(423).json({ error: 'Locked events cannot be deleted' });
      await supabase.from('claims').delete().eq('event_id', id);
      await supabase.from('slots').delete().eq('event_id', id);
      await supabase.from('event_settings').delete().eq('event_id', id);
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    try {
      console.warn('[events] method not allowed', { method: req.method });
    } catch (e) {
      /* ignore */
    }
    res.status(405).json({ error: `Method not allowed: ${req.method}` });
  } catch (err) {
    console.error('events API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
