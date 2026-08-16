/**
 * Adapt a Vercel-style (req, res) handler for Cloudflare Pages Functions.
 */
export function asPages(handler) {
  return async (context) => {
    const { request, env } = context;

    // Map Cloudflare environment variables to process.env safely
    if (env) {
      if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
      if (env.NEXT_PUBLIC_SUPABASE_URL) process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
      
      // Fallbacks
      if (!process.env.SUPABASE_URL && env.VITE_SUPABASE_URL) process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
      if (!process.env.SUPABASE_ANON_KEY && env.VITE_SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
    }

    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    let body = {};
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const raw = await request.text();
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = {};
        }
      }
    }

    const req = { method: request.method, query, body, headers };

    return await new Promise((resolve) => {
      const resHeaders = new Headers();
      let statusCode = 200;
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(new Response(payload, { status: statusCode, headers: resHeaders }));
      };

      const res = {
        setHeader(key, value) {
          resHeaders.set(key, value);
        },
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          if (!resHeaders.has('Content-Type')) resHeaders.set('Content-Type', 'application/json; charset=utf-8');
          finish(JSON.stringify(data));
        },
        send(data) {
          finish(data);
        },
        end() {
          finish(null);
        },
      };

      Promise.resolve(handler(req, res)).catch((err) => {
        if (settled) return;
        statusCode = 500;
        resHeaders.set('Content-Type', 'application/json; charset=utf-8');
        finish(JSON.stringify({ error: err.message || 'Server error' }));
      });
    });
  };
}