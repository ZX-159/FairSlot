import { createClient } from '@supabase/supabase-js';
import { triggerRestore } from './db-wake.js';

/** @type {Map<string, import('@supabase/supabase-js').SupabaseClient>} */
const clientCache = new Map();

/**
 * Resolve Supabase URL + service_role key from (in order):
 *   1. explicit `env` argument (Cloudflare Worker bindings / asPages)
 *   2. globalThis.env          (set by worker.js on every request)
 *   3. process.env             (Node / vite dev / nodejs_compat)
 */
export function readEnvBag(env) {
  const globalEnv = (typeof globalThis !== 'undefined' && globalThis.env) || {};
  const runtimeEnv = env && typeof env === 'object' ? env : {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};

  const pick = (...keys) => {
    for (const key of keys) {
      const v = runtimeEnv[key] ?? globalEnv[key] ?? procEnv[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };

  const url = pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = pick('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = pick(
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY'
  );

  return { url, serviceKey, anonKey };
}

/**
 * Apply Cloudflare / Pages bindings onto process.env so any code path that
 * still reads process.env keeps working under `nodejs_compat`.
 */
export function applyEnvBindings(env) {
  if (!env || typeof env !== 'object') return;
  try {
    globalThis.env = env;
  } catch {
    /* ignore */
  }
  const proc = typeof process !== 'undefined' ? process.env : null;
  if (!proc) return;

  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];
  for (const key of keys) {
    if (env[key] != null && env[key] !== '') proc[key] = String(env[key]);
  }
  if (!proc.SUPABASE_URL) {
    proc.SUPABASE_URL = proc.NEXT_PUBLIC_SUPABASE_URL || proc.VITE_SUPABASE_URL || '';
  }
  if (!proc.NEXT_PUBLIC_SUPABASE_URL) {
    proc.NEXT_PUBLIC_SUPABASE_URL = proc.SUPABASE_URL || proc.VITE_SUPABASE_URL || '';
  }
  if (!proc.SUPABASE_ANON_KEY) {
    proc.SUPABASE_ANON_KEY =
      proc.NEXT_PUBLIC_SUPABASE_ANON_KEY || proc.VITE_SUPABASE_ANON_KEY || '';
  }
}

/**
 * Server-side Supabase client.
 *
 * MUST use the service_role key. RLS only grants limited SELECTs to
 * anon/authenticated; every insert/update/delete in /api depends on the
 * service role bypassing RLS.
 *
 * Pass the Cloudflare `env` on every request when available.
 */
export function getSupabaseClient(env = {}) {
  applyEnvBindings(env);
  const { url, serviceKey, anonKey } = readEnvBag(env);

  if (!url) {
    throw new Error(
      'Missing Supabase URL. Set SUPABASE_URL (and VITE_SUPABASE_URL for the browser) ' +
        'in Cloudflare Worker/Pages environment variables.'
    );
  }

  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. FairSlot /api requires the service role key ' +
        'because RLS blocks all writes from the anon key. ' +
        'Set it as a Cloudflare secret (wrangler secret put SUPABASE_SERVICE_ROLE_KEY) ' +
        'or in .env.local for local dev. Never put it in VITE_* vars.'
    );
  }

  if (anonKey && serviceKey === anonKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is identical to the anon key. ' +
        'Copy the service_role secret from Supabase → Project Settings → API.'
    );
  }

  const cacheKey = `${url}::${serviceKey.slice(0, 12)}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (u, options) => {
        const res = await fetch(u, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      },
    },
  });

  clientCache.set(cacheKey, client);
  return client;
}

/** Test helper */
export function resetSupabaseClient() {
  clientCache.clear();
}
