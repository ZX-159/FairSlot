# FairSlot

**Frictionless, real-time event allocation** for schools and communities.

Organisers sign in with email + password. Participants open a share link or type a six-character code — **no account**. Live inventory greys out full slots the moment someone claims. Locks are immutable. Exports are tidy CSVs. Receipts are PNG tickets.

| | |
| --- | --- |
| **Frontend** | React 19 · Vite · TypeScript · Tailwind 4 |
| **API** | Cloudflare Worker (`functions/worker.js`) |
| **Data / Auth / Realtime** | Supabase (Postgres + Auth + Realtime) |
| **Hosting** | Cloudflare Workers Static Assets |

---

## Why this exists

School coordination still runs on WhatsApp polls, Google Forms, and shared Sheets:

- **No capacity caps** → overbooking
- **No live inventory** → people book seats that are already gone
- **Editable cells / silent vote changes** → disputes, no audit trail
- **Heavy cleanup** for admins after every event

FairSlot is a purpose-built ledger: atomic claims, live boards, organiser studio, CSV export, PNG receipts.

---

## How it fits together

```
Browser (React SPA)
  │
  ├─ supabase-js  ──auth + realtime──►  Supabase
  │                                      • Auth (organiser email/password)
  │                                      • Realtime (slots / events)
  │                                      • Postgres + RLS
  │
  └─ fetch('/api/…')  ───────────────►  Cloudflare Worker
                                         functions/worker.js
                                              │
                                              ├─ /api/events   organiser CRUD
                                              ├─ /api/slots    inventory CRUD
                                              ├─ /api/claims   public claim + cancel
                                              ├─ /api/public   directory, join code, receipt
                                              ├─ /api/export   CSV download
                                              └─ /api/health   env wiring check
                                                      │
                                                      └─ service_role ──► Supabase
```

**Security model (important):**

| Client | Key | Allowed |
| --- | --- | --- |
| Browser | **anon** | Auth, Realtime, public SELECT on `events` / `slots` |
| Worker `/api` | **service_role** | All reads of secrets + **all writes** (bypasses RLS) |

RLS is on. There is **no** world-readable access to `claims` (PII) or `event_settings` (`join_pin`). Those only move through `/api`.

---

## Features (v1)

### Participants (zero login)
- Open `/e/JOINCODE` or type a code at `/join`
- Optional PIN gate, pre-notice + acknowledgement, claim windows
- Live slot board (Supabase Realtime) — full seats grey out instantly
- Claim with name + email (+ phone/notes when required)
- Atomic capacity enforcement (no double-booking the last seat)
- PNG ticket download on `/receipt/:token`

### Organisers (authenticated studio)
- Email + password sign-in (`/login`) — **email confirmation disabled** on this project
- Dashboard of events, fill rates, recent claims
- Create event → cover, category, draft/live, security & notices
- Studio: add slots with capacity, lock individual slots, go live / close, **lock forever**
- CSV export of all claims
- Share link + join code (works without a login)

### Not in this build (PRD stretch)
Device fingerprinting, drag-and-drop slot reorder UI, and multi-language i18n are specified in the PRD roadmap but **not implemented** in v1. Capacity, PIN, one-per-email, claim windows, and immutable locks cover the core anti-abuse and integrity needs.

---

## Quick start (local)

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run **`supabase/schema.sql`** (new project)  
   or **`supabase/migrate_existing.sql`** (if you already applied an older schema).
3. **Authentication → Providers → Email** → enable Email.  
   Leave **Confirm email** **OFF** (this deploy assumes immediate sessions on sign-up).
4. **Settings → API** → copy Project URL, `anon` key, `service_role` key.

### 2. Env files

```bash
cp .env.example .env.local
```

Fill every line with the **same** project URL / keys.  
`SUPABASE_SERVICE_ROLE_KEY` is required for local `/api` (Vite middleware).

### 3. Run

```bash
npm install
npm run dev
```

Open http://localhost:5173  

- `/login` — create organiser account, land in studio  
- `/events/new` — compose an event, add slots, go live  
- `/e/YOURCODE` — claim as a participant (private window)  
- `/api/health` — should report `service_role_configured: true`

```bash
npm run build      # production bundle → dist/
npm run check:api  # syntax-check worker + handlers
```

---

## Deploy on Cloudflare (Workers + Assets)

This repo is set up for **Workers Static Assets** (not the older “Pages Functions only” layout).  
That is intentional: the commit history is full of `405 Method Not Allowed` on `POST /api/*` from the asset server swallowing API routes. The fix is:

```toml
# wrangler.toml
main = "functions/worker.js"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true   # ← worker sees /api BEFORE static assets
```

### One-time: create the Worker and set secrets

```bash
npm install
npm run build

# Login once
npx wrangler login

# Runtime secrets / vars (use YOUR values)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# paste service_role key

npx wrangler secret put SUPABASE_URL
# or set as a plain var in the dashboard:
#   SUPABASE_URL, SUPABASE_ANON_KEY
```

In **Cloudflare Dashboard → Workers → fairslot → Settings → Variables**:

| Name | Type | Value |
| --- | --- | --- |
| `SUPABASE_URL` | var | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | var | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | service_role key |
| `VITE_SUPABASE_URL` | var (also **build**) | same URL |
| `VITE_SUPABASE_ANON_KEY` | var (also **build**) | same anon |
| `NEXT_PUBLIC_SUPABASE_URL` | var | same URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | var | same anon |

> `VITE_*` must be present at **build** time so the SPA bundle embeds the anon key.  
> `SUPABASE_SERVICE_ROLE_KEY` must **never** be prefixed with `VITE_`.

### Deploy

```bash
npm run deploy
# → npm run build && wrangler deploy
```

Or connect the GitHub repo in the Cloudflare dashboard:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root | repo root |
| Compatibility flags | `nodejs_compat` |

After deploy, open `https://<your-worker>.workers.dev/api/health`:

```json
{
  "ok": true,
  "service": "fairslot",
  "supabase_url_configured": true,
  "service_role_configured": true,
  "service_role_distinct_from_anon": true
}
```

If `service_role_configured` is `false`, claims and event creation will fail — set the secret and redeploy/retry.

### Supabase Auth URLs

**Authentication → URL configuration**

- Site URL: your Worker / custom domain  
- Redirect URLs: `http://localhost:5173/**`, `https://your-domain/**`

---

## API surface

All routes are same-origin `/api/*`, handled by the Worker.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Liveness + env flags (no secrets) |
| GET | `/api/public` | — | Live event directory |
| GET | `/api/public?code=` | — | Event + slots by join code (PIN aware) |
| GET | `/api/public?token=` | — | Claim receipt |
| POST | `/api/claims` | — | Claim a slot (atomic) |
| DELETE | `/api/claims` | token or organiser | Cancel a claim |
| GET/POST/PUT/DELETE | `/api/events` | Bearer | Organiser events + settings |
| GET/POST/PUT/DELETE | `/api/slots` | Bearer | Slot inventory |
| GET | `/api/export?event_id=` | Bearer | CSV of claims |

Organiser routes expect:

```http
Authorization: Bearer <supabase_access_token>
```

---

## Database

```
auth.users
   │  id (uuid text)
   ▼
events.creator_id
   ├─► slots.event_id  ──► claims.slot_id
   ├─► claims.event_id
   └─► event_settings.event_id   (1:1, join_pin lives here)
```

**RLS (after `schema.sql` / `migrate_existing.sql`):**

| Table | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `events` | SELECT | SELECT | ALL |
| `slots` | SELECT | SELECT | ALL |
| `claims` | — | SELECT own events only | ALL |
| `event_settings` | — | — | ALL |

`public.claim_slot(...)` provides a row-locked atomic claim used by `/api/claims` when present.

---

## Project layout

```
api/                  # Shared request handlers (Node-shaped req/res)
  _auth.js            # Bearer parse, getUser, db(req), CORS
  db-client.js        # service_role Supabase client + env bridging
  events.js slots.js claims.js public.js export.js
functions/
  worker.js           # Cloudflare Worker entry (routes + ASSETS)
  _lib/asPages.js     # req/res adapter + env injection
  api/*.js            # thin re-exports for Pages-style deploys
src/                  # React SPA
supabase/
  schema.sql          # fresh project
  migrate_existing.sql
wrangler.toml         # Workers + assets config
vite.config.ts        # dev server + local /api middleware
SETUP.md              # long-form setup & troubleshooting
```

---

## Cloudflare lessons (from this repo’s history)

These already bit production deploys — fixed in the current tree:

| Symptom | Cause | Fix in repo |
| --- | --- | --- |
| `POST /api/*` → **405** | Asset server handled the path first | `run_worker_first = true` |
| API route not found / dynamic import fail | `import()` of handlers in Worker | Static imports in `worker.js` |
| Missing Supabase credentials | Bindings only on `env`, not `process.env` | `applyEnvBindings` + `req.env` → `db(req)` |
| Writes fail under RLS | Anon key used for `/api` | **service_role required**; no silent fallback |
| SPA deep link 404 | No SPA fallback | `not_found_handling = "single-page-application"` |
| `Unexpected end of JSON` | Empty / non-JSON bodies | Safe parse in `asPages` + `parseJsonSafe` |

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/health` → `service_role_configured: false` | `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` |
| Sign-up works but studio API 401 | Frontend and Worker pointed at different Supabase projects |
| Claim 500 mentioning RLS / permissions | Service role missing or anon pasted into service slot |
| Realtime counts don’t move | Re-run realtime publication block in `migrate_existing.sql` |
| Browser can read all claims via REST | Old open policies — run `migrate_existing.sql` |
| Build missing anon key in UI | Set `VITE_SUPABASE_*` as **build** vars, rebuild |
| Local `/api` fails | `.env.local` must include `SUPABASE_SERVICE_ROLE_KEY` |

More detail: **[SETUP.md](./SETUP.md)**.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite + local `/api` middleware |
| `npm run build` | `tsc` + Vite production build → `dist/` |
| `npm run deploy` | build + `wrangler deploy` |
| `npm run check:api` | Syntax-check Worker and handlers |
| `npm run preview` | Preview the production build locally |

---

## License

Private / unlicensed unless you add one. Do not commit `.env.local`, `.env.prod`, or any file containing the **service_role** key.
