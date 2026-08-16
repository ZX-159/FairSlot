import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

let supabaseInstance = null;

export function getSupabaseClient(env = {}) {
  if (supabaseInstance) return supabaseInstance;

  // Grab keys from Cloudflare bindings, process.env, or fallback objects
  const url = env.SUPABASE_URL || process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('supabaseUrl and supabaseAnonKey are required.');
  }

  supabaseInstance = createClient(url, key, {
    global: {
      fetch: async (u, options) => {
        const res = await fetch(u, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  });

  return supabaseInstance;
}