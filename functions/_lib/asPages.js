/**
 * Adapt a Vercel-style (req, res) handler for Cloudflare Workers.
 *
 * Kept dependency-free (no imports) so the Worker bundle cannot fail at
 * module-init with circular import / TDZ errors.
 */

function copyEnvToProcess(env) {
  if (!env || typeof env !== 'object') return;
  try {
    globalThis.env = env;
  } catch {
    /* ignore */
  }

  // nodejs_compat provides process.env on Workers
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
    const key = keys[i];
    if (env[key] != null && env[key] !== '') {
      proc[key] = String(env[key]);
    }
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
 * @param {(req: any, res: any) => any} userHandler
 * @returns {(context: { request: Request, env: any, ctx?: any }) => Promise<Response>}
 */
export function asPages(userHandler) {
  if (typeof userHandler !== 'function') {
    throw new Error('asPages() requires a function handler');
  }

  return async function pagesAdapter(context) {
    const request = context.request;
    const env = context.env || {};

    copyEnvToProcess(env);

    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[String(key).toLowerCase()] = value;
    });

    let body = {};
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      try {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = {};
          }
        }
      } catch {
        body = {};
      }
    }

    const req = {
      method: request.method,
      query,
      body,
      headers,
      env,
      url: request.url,
    };

    let statusCode = 200;
    const resHeaders = new Headers();
    let finished = false;
    /** @type {(value: Response) => void} */
    let settle;
    const done = new Promise((resolve) => {
      settle = resolve;
    });

    function finish(payload) {
      if (finished) return;
      finished = true;
      settle(new Response(payload, { status: statusCode, headers: resHeaders }));
    }

    const res = {
      setHeader(key, value) {
        resHeaders.set(key, value);
      },
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        if (!resHeaders.has('Content-Type')) {
          resHeaders.set('Content-Type', 'application/json; charset=utf-8');
        }
        finish(JSON.stringify(data === undefined ? null : data));
      },
      send(data) {
        if (data == null) finish(null);
        else if (typeof data === 'string') finish(data);
        else finish(String(data));
      },
      end() {
        finish(null);
      },
    };

    try {
      await userHandler(req, res);
      if (!finished) finish(null);
    } catch (err) {
      if (!finished) {
        statusCode = 500;
        resHeaders.set('Content-Type', 'application/json; charset=utf-8');
        const message = err && err.message ? err.message : 'Server error';
        finish(JSON.stringify({ error: message }));
      }
    }

    return done;
  };
}
