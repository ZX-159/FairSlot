import { defineConfig, loadEnv, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type ApiHandler = (
  req: { method: string; query: Record<string, string>; body: unknown; headers: Record<string, string> },
  res: {
    setHeader: (k: string, v: string) => void
    status: (code: number) => any
    json: (data: unknown) => void
    send: (data: unknown) => void
    end: () => void
  }
) => void | Promise<void>

const API_ROUTES: Record<string, string> = {
  events: './api/events.js',
  slots: './api/slots.js',
  claims: './api/claims.js',
  public: './api/public.js',
  export: './api/export.js',
}

/**
 * Serve /api/* during `vite dev` by loading the same handlers Cloudflare uses.
 */
function localApiPlugin(env: Record<string, string>): Plugin {
  // Mirror Cloudflare/Pages env into process.env for db-client.
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ]
  for (const k of keys) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  }

  const root = process.cwd()

  async function loadHandler(seg: string): Promise<ApiHandler | null> {
    const rel = API_ROUTES[seg]
    if (!rel) return null
    const abs = path.resolve(root, rel)
    const mod = await import(pathToFileURL(abs).href + `?t=${Date.now()}`)
    return (mod.default || mod) as ApiHandler
  }

  function readBody(req: Connect.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  return {
    name: 'fairslot-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url || !req.method) return next()
          const url = new URL(req.url, 'http://localhost')
          if (!url.pathname.startsWith('/api/')) return next()

          const seg = url.pathname.split('/')[2] || ''
          const handler = await loadHandler(seg)
          if (!handler) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'API route not found' }))
            return
          }

          const query = Object.fromEntries(url.searchParams.entries())
          const headers: Record<string, string> = {}
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k.toLowerCase()] = v
            else if (Array.isArray(v) && v[0]) headers[k.toLowerCase()] = v[0]
          }

          let body: unknown = {}
          if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            const raw = await readBody(req)
            if (raw) {
              try {
                body = JSON.parse(raw)
              } catch {
                body = {}
              }
            }
          }

          const apiReq = {
            method: req.method,
            query,
            body,
            headers,
            env: {
              SUPABASE_URL: process.env.SUPABASE_URL,
              SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
              NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
              NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
              VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
              VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
            },
          }
          let statusCode = 200
          const resHeaders: Record<string, string> = {}
          let settled = false

          const finish = (payload: unknown) => {
            if (settled) return
            settled = true
            res.statusCode = statusCode
            for (const [k, v] of Object.entries(resHeaders)) res.setHeader(k, v)
            if (payload == null) {
              res.end()
            } else if (typeof payload === 'string' || Buffer.isBuffer(payload)) {
              res.end(payload)
            } else {
              res.end(String(payload))
            }
          }

          const apiRes = {
            setHeader(key: string, value: string) {
              resHeaders[key] = value
            },
            status(code: number) {
              statusCode = code
              return this
            },
            json(data: unknown) {
              if (!resHeaders['Content-Type']) {
                resHeaders['Content-Type'] = 'application/json; charset=utf-8'
              }
              finish(JSON.stringify(data))
            },
            send(data: unknown) {
              finish(data)
            },
            end() {
              finish(null)
            },
          }

          await Promise.resolve(handler(apiReq, apiRes))
          if (!settled) finish(null)
        } catch (err: unknown) {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: (err as Error)?.message || 'Server error' }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react(), tailwindcss()]
  try {
    // @ts-expect-error optional local plugin
    const m = await import('./.vite-source-tags.js')
    plugins.push(m.sourceTags())
  } catch {
    /* optional */
  }

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_', 'SUPABASE_'])
  const allPlugins = [...plugins, localApiPlugin(env)]

  const processEnvDefines: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value)
  }

  return {
    plugins: allPlugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
  }
})
