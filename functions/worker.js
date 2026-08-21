/**
 * FairSlot — Cloudflare Worker entry (Workers Static Assets).
 *
 * Request flow:
 *   /api/health     → env wiring check (no secrets)
 *   /api/<route>    → api/*.js via asPages
 *   everything else → ASSETS (SPA)
 *
 * wrangler.toml MUST have:
 *   main = "functions/worker.js"
 *   compatibility_flags = ["nodejs_compat"]
 *   [assets] run_worker_first = true
 */
import { asPages } from './_lib/asPages.js';
import claimsHandler from '../api/claims.js';
import eventsHandler from '../api/events.js';
import exportHandler from '../api/export.js';
import publicHandler from '../api/public.js';
import slotsHandler from '../api/slots.js';

const routeHandlers = {
  claims: asPages(claimsHandler),
  events: asPages(eventsHandler),
  export: asPages(exportHandler),
  public: asPages(publicHandler),
  slots: asPages(slotsHandler),
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    },
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const key of Object.keys(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, SECURITY_HEADERS[key]);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function readFlag(env, name) {
  if (!env) return '';
  const v = env[name];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function envReport(env) {
  const url =
    readFlag(env, 'SUPABASE_URL') ||
    readFlag(env, 'NEXT_PUBLIC_SUPABASE_URL') ||
    readFlag(env, 'VITE_SUPABASE_URL');
  const serviceKey = readFlag(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const anonKey =
    readFlag(env, 'SUPABASE_ANON_KEY') ||
    readFlag(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    readFlag(env, 'VITE_SUPABASE_ANON_KEY');

  return {
    ok: true,
    service: 'fairslot',
    version: '1.2.0',
    time: new Date().toISOString(),
    supabase_url_configured: Boolean(url),
    service_role_configured: Boolean(serviceKey),
    anon_configured: Boolean(anonKey),
    service_role_distinct_from_anon: Boolean(serviceKey && anonKey && serviceKey !== anonKey),
  };
}

function exposeEnv(env) {
  if (!env) return;
  try {
    globalThis.env = env;
  } catch {
    /* ignore */
  }
  let proc;
  try {
    proc = typeof process !== 'undefined' ? process.env : null;
  } catch {
    proc = null;
  }
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
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (env[k] != null && env[k] !== '') proc[k] = String(env[k]);
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

export default {
  async fetch(request, env, ctx) {
    exposeEnv(env || {});

    try {
      const url = new URL(request.url);
      // normalize trailing slash except root
      let path = url.pathname;
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

      if (request.method === 'OPTIONS' && path.startsWith('/api')) {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            ...SECURITY_HEADERS,
          },
        });
      }

      if (path === '/api/health') {
        return jsonResponse(envReport(env || {}), 200);
      }

      if (path === '/api' || path.startsWith('/api/')) {
        const parts = path.split('/').filter(Boolean); // ["api", "events"]
        const seg = parts[1] || '';
        const handle = routeHandlers[seg];
        if (!handle) {
          return jsonResponse(
            {
              error: 'API route not found',
              path,
              available: Object.keys(routeHandlers).map((r) => '/api/' + r),
            },
            404
          );
        }
        const response = await handle({ request, env, ctx });
        return withSecurityHeaders(response);
      }

      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return withSecurityHeaders(await env.ASSETS.fetch(request));
      }

      return jsonResponse({ error: 'Not found', path }, 404);
    } catch (err) {
      const message = err && err.message ? err.message : 'Worker error';
      return jsonResponse({ error: message }, 500);
    }
  },
};
