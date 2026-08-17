import { cors, bearerToken, db } from './_auth.js';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default async function handler(req, res) {
  cors(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const supabase = db(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Prefer Authorization header; allow ?token= only as a fallback for download links.
    const token = bearerToken(req) || (req.query?.token ? String(req.query.token) : '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data: auth, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !auth?.user) return res.status(401).json({ error: 'Invalid token' });

    const eventId = Number(req.query?.event_id);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .eq('creator_id', auth.user.id)
      .single();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { data: slots } = await supabase.from('slots').select('*').eq('event_id', eventId);
    const slotMap = Object.fromEntries((slots || []).map((s) => [s.id, s]));
    const { data: claims } = await supabase
      .from('claims')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    const headers = [
      'Event',
      'Join Code',
      'Slot',
      'Slot Category',
      'Participant Name',
      'Email',
      'Phone',
      'Notes',
      'Claimed At',
    ];
    const rows = (claims || []).map((c) => {
      const slot = slotMap[c.slot_id] || {};
      return [
        event.title,
        event.join_code,
        slot.name || '',
        slot.category || '',
        c.participant_name,
        c.participant_email,
        c.participant_phone || '',
        c.notes || '',
        c.created_at,
      ]
        .map(csvEscape)
        .join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `fairslot-${event.join_code}-claims.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('export API error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}
