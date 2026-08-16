import { getSupabaseClient } from './db-client.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getUser(req, env) {
  try {
    const supabase = getSupabaseClient(env);
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    console.error('getUser error:', err);
    return null;
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const env = req.env || globalThis.env || process.env;

  try {
    const supabase = getSupabaseClient(env);

    if (req.method === 'GET') {
      const user = await getUser(req, env);
      if (!user) return res.status(401).json({ error: 'Unauthorized', data: [] });

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        return res.status(200).json([]); // Always return array so frontend .reduce() doesn't break
      }
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const user = await getUser(req, env);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { title, description, status, join_code, locked } = req.body || {};
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const { data, error } = await supabase
        .from('events')
        .insert({
          creator_id: user.id,
          title: String(title).trim(),
          description: description ? String(description).trim() : '',
          status: status || 'live',
          join_code: join_code || '',
          locked: !!locked,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(400).json({ error: error.message || 'Failed to create event' });
      }
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('events API critical error:', err);
    return res.status(500).json({ error: err.message || 'Server error', data: [] });
  }
}