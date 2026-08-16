import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

let supabaseInstance = null;

export function getSupabaseClient(env = {}) {
  if (supabaseInstance) return supabaseInstance;

  // Gather credentials from Cloudflare runtime env, globalThis, or process.env
  const globalEnv = (typeof globalThis !== 'undefined' && globalThis.env) || {};
  const runtimeEnv = env || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};

  const url = 
    runtimeEnv.SUPABASE_URL || 
    globalEnv.SUPABASE_URL || 
    procEnv.SUPABASE_URL || 
    runtimeEnv.VITE_SUPABASE_URL || 
    procEnv.VITE_SUPABASE_URL;

  const key = 
    runtimeEnv.SUPABASE_ANON_KEY || 
    globalEnv.SUPABASE_ANON_KEY || 
    procEnv.SUPABASE_ANON_KEY || 
    runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || 
    procEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(`Missing Supabase credentials. URL: ${!!url}, Key: ${!!key}`);
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