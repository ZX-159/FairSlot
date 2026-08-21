import { cors, getUser, db } from './_auth.js';

async function ownedEvent(supabase, userId, eventId) {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('creator_id', userId)
    .single();
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const supabase = db(req);
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const eventId = Number(req.query?.event_id);
      if (!eventId) return res.status(400).json({ error: 'event_id is required' });
      const event = await ownedEvent(supabase, user.id, eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const body = req.body || {};

      // Bulk create: { action:'bulk', event_id, slots:[{name,capacity,category,description}] }
      if (body.action === 'bulk') {
        const event_id = Number(body.event_id);
        const list = Array.isArray(body.slots) ? body.slots : [];
        if (!event_id) return res.status(400).json({ error: 'event_id is required' });
        if (!list.length) return res.status(400).json({ error: 'Add at least one slot' });
        if (list.length > 40) return res.status(400).json({ error: 'Max 40 slots per bulk add' });
        const event = await ownedEvent(supabase, user.id, event_id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.locked) return res.status(423).json({ error: 'Event is locked' });
        const { data: existing } = await supabase
          .from('slots')
          .select('sort_order')
          .eq('event_id', event_id)
          .order('sort_order', { ascending: false })
          .limit(1);
        let base = existing?.[0]?.sort_order != null ? Number(existing[0].sort_order) + 1 : 0;
        const rows = [];
        for (const raw of list) {
          const name = String(raw?.name || '').trim().slice(0, 200);
          if (!name) continue;
          rows.push({
            event_id,
            name,
            description: raw?.description ? String(raw.description).slice(0, 2000) : '',
            category: raw?.category ? String(raw.category).slice(0, 80) : 'General',
            capacity: Math.max(1, Number(raw?.capacity) || 1),
            claimed_count: 0,
            sort_order: base++,
            locked: false,
          });
        }
        if (!rows.length) return res.status(400).json({ error: 'No valid slot names' });
        const { data, error } = await supabase.from('slots').insert(rows).select();
        if (error) throw error;
        return res.status(201).json({ ok: true, slots: data || [], count: (data || []).length });
      }

      const { event_id, name, description, category, capacity, sort_order } = body;
      if (!event_id || !name) return res.status(400).json({ error: 'event_id and name are required' });
      const event = await ownedEvent(supabase, user.id, event_id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'Event is locked' });
      const cap = Math.max(1, Number(capacity) || 1);
      const { data, error } = await supabase
        .from('slots')
        .insert({
          event_id,
          name: String(name).trim().slice(0, 200),
          description: description ? String(description).slice(0, 2000) : '',
          category: category ? String(category).slice(0, 80) : 'General',
          capacity: cap,
          claimed_count: 0,
          sort_order: Number(sort_order) || 0,
          locked: false,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, name, description, category, capacity, sort_order, locked } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: slot } = await supabase.from('slots').select('*').eq('id', id).single();
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      const event = await ownedEvent(supabase, user.id, slot.event_id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'Event is locked' });
      const patch = {};
      if (name !== undefined) patch.name = String(name).trim().slice(0, 200);
      if (description !== undefined) patch.description = String(description).slice(0, 2000);
      if (category !== undefined) patch.category = String(category).slice(0, 80);
      if (capacity !== undefined) {
        // Never drop capacity below seats already claimed.
        const claimed = Number(slot.claimed_count) || 0;
        const cap = Math.max(claimed, Math.max(1, Number(capacity) || 1));
        patch.capacity = cap;
      }
      if (sort_order !== undefined) patch.sort_order = Number(sort_order) || 0;
      if (typeof locked === 'boolean') patch.locked = locked;
      const { data, error } = await supabase.from('slots').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { data: slot } = await supabase.from('slots').select('*').eq('id', id).single();
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      const event = await ownedEvent(supabase, user.id, slot.event_id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'Event is locked' });
      await supabase.from('claims').delete().eq('slot_id', id);
      const { error } = await supabase.from('slots').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('slots API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
