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

async function ownedEvent(userId, eventId) {
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
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const eventId = Number(req.query?.event_id);
      if (!eventId) return res.status(400).json({ error: 'event_id is required' });
      const event = await ownedEvent(user.id, eventId);
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
      const { event_id, name, description, category, capacity, sort_order } = req.body || {};
      if (!event_id || !name) return res.status(400).json({ error: 'event_id and name are required' });
      const event = await ownedEvent(user.id, event_id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'Event is locked' });
      const cap = Math.max(1, Number(capacity) || 1);
      const { data, error } = await supabase
        .from('slots')
        .insert({
          event_id,
          name: String(name).trim(),
          description: description || '',
          category: category || 'General',
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
      const event = await ownedEvent(user.id, slot.event_id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (event.locked) return res.status(423).json({ error: 'Event is locked' });
      const patch = {};
      if (name !== undefined) patch.name = String(name).trim();
      if (description !== undefined) patch.description = description;
      if (category !== undefined) patch.category = category;
      if (capacity !== undefined) {
        const cap = Math.max(slot.claimed_count || 1, Number(capacity) || 1);
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
      const event = await ownedEvent(user.id, slot.event_id);
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
