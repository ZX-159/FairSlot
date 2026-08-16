import { asPages } from './_lib/asPages.js';

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        const routePath = path.replace(/^\/api/, '') || '/';
        const modulePath = `../api${routePath}.js`;
        try {
          const mod = await import(modulePath);
          const handler = mod.default;
          const pagesHandler = asPages(handler);
          return await pagesHandler({ request, env });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'API route not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Fall back to static assets if available
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }

      // Otherwise proxy the request normally
      return fetch(request);
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Worker error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
