import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

const clientCache = new Map();

export function getSupabaseClient(env = process.env) {
  // Check wrangler.toml [vars] first (SUPABASE_URL), then fallback variants
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('supabaseUrl and supabaseAnonKey are required.');
  }

  const cacheKey = `${url}:${key}`;
  if (clientCache.has(cacheKey)) return clientCache.get(cacheKey);

  const supabase = createClient(url, key, {
    global: {
      fetch: async (u, options) => {
        const res = await fetch(u, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  });

  clientCache.set(cacheKey, supabase);
  return supabase;
}