import { asPages } from './_lib/asPages.js';
import claimsHandler from '../api/claims.js';
import eventsHandler from '../api/events.js';
import exportHandler from '../api/export.js';
import publicHandler from '../api/public.js';
import slotsHandler from '../api/slots.js';

const routes = {
  claims: asPages(claimsHandler),
  events: asPages(eventsHandler),
  export: asPages(exportHandler),
  public: asPages(publicHandler),
  slots: asPages(slotsHandler),
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (path.startsWith('/api/')) {
        const seg = path.split('/')[2] || '';
        const handler = routes[seg];
        if (handler) return await handler({ request, env });
        return new Response(JSON.stringify({ error: 'API route not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
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
