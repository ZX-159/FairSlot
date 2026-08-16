import { getSupabaseClient } from './db-client.js';

/** Extract Bearer token from a Vercel-style req.headers map. */
export function bearerToken(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization || '';
  const m = String(raw).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/**
 * Validate the organiser JWT via Supabase Auth.
 * Passes req.env so Cloudflare bindings reach the service-role client.
 */
export async function getUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const supabase = getSupabaseClient(req?.env || {});
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** Convenience: supabase client bound to this request's env. */
export function db(req) {
  return getSupabaseClient(req?.env || {});
}

export function cors(res, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
