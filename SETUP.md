# FairSlot — from zero to production

This guide takes you from an empty folder on your machine to a live app:

- **GitHub** holds the source
- **Supabase** is your database and email/password auth
- **Cloudflare Workers** (Static Assets) hosts the frontend and the `/api` routes

The preview environment you may have seen is wired to a temporary database. Your own keys go in `.env.prod` and in the Cloudflare / local env files described below. Nothing in this guide should reuse those preview keys.

---

## 1. What you are deploying

```
Browser
  │
  ├─ React SPA  ─────────────────────────────►  Cloudflare Worker ASSETS (./dist)
  │     │                                         VITE_SUPABASE_URL
  │     │                                         VITE_SUPABASE_ANON_KEY
  │     │
  │     ├─ fetch('/api/...')  ───────────────►  Cloudflare Worker (functions/worker.js)
  │     │                                         run_worker_first = true
  │     │                                         SUPABASE_SERVICE_ROLE_KEY (secret)
  │     │                                         SUPABASE_URL / aliases
  │     │
  │     └─ supabase-js (auth + realtime) ───►  Your Supabase project
  │
  └─ Email / password sign-in  ─────────────►  Supabase Auth
```

| Piece | Role | Where it lives |
| --- | --- | --- |
| `src/` | React UI (Vite + TypeScript + Tailwind) | Built to `dist/`, served via Worker ASSETS |
| `api/` | Server handlers for events, slots, claims, CSV | Imported by `functions/worker.js` |
| `functions/worker.js` | Cloudflare Worker entry — routes `/api/*`, serves SPA | Workers Static Assets |
| Supabase Postgres | `events`, `slots`, `claims`, `event_settings` | Your project |
| Supabase Auth | Organiser email + password only (confirm email OFF) | Your project |

Participants never create an account. They open a share link (`/e/ABCDEF`) or type a join code. Organisers sign in at `/login`.

---

## 2. Accounts and tools

Create these if you do not already have them:

1. **GitHub** — [github.com](https://github.com)
2. **Supabase** — [supabase.com](https://supabase.com) (Free tier is enough)
3. **Cloudflare** — [dash.cloudflare.com](https://dash.cloudflare.com) (Workers free tier is enough)

On your computer:

- **Node.js 20 or newer** — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)
- A code editor (VS Code is fine)

Check they work:

```bash
node -v
npm -v
git -v
```

---

## 3. Put the codebase on GitHub

### 3.1 Create an empty repository

1. Sign in to GitHub.
2. Click **New repository**.
3. Name it `fairslot` (or anything you like).
4. Leave it **empty**: do **not** add a README, `.gitignore`, or licence. Those already exist in this project.
5. Choose **Private** if the repo might ever contain notes about keys. The env files themselves must stay out of Git (see below).
6. Create the repository. Copy the HTTPS or SSH URL, e.g. `https://github.com/YOUR_USER/fairslot.git`.

### 3.2 Initialise Git locally (if this folder is not a repo yet)

In the project root:

```bash
git init
git add .
git status
```

Read `git status` carefully. You must **not** see:

- `.env`
- `.env.local`
- `.env.prod`
- `.env.production`
- `.env.production.local`
- `node_modules/`
- `dist/`

Those are listed in `.gitignore`. If any of them appear as staged, run `git restore --staged <file>` and confirm `.gitignore` is present.

```bash
git commit -m "Initial FairSlot commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/fairslot.git
git push -u origin main
```

Use SSH instead of HTTPS if that is how you normally talk to GitHub:

```bash
git remote add origin git@github.com:YOUR_USER/fairslot.git
```

### 3.3 Everyday Git after the first push

```bash
git checkout -b my-change
# edit files
git add -A
git status
git commit -m "Describe the change"
git push -u origin my-change
```

Open a Pull Request on GitHub, merge to `main`. Cloudflare Pages can build every push to `main` (production) and every PR (preview).

### 3.4 What never goes on GitHub

| File | Why |
| --- | --- |
| `.env` / `.env.local` | Local secrets |
| `.env.prod` | Your production secrets |
| `.env.production` / `.env.production.local` | Production build secrets |
| `node_modules/` | Reinstalled with `npm install` |
| `dist/` | Rebuilt on every deploy |

Safe to commit: `.env.example`, `.env.production.example`, `SETUP.md`, `supabase/schema.sql`.

---

## 4. Create your Supabase project

1. Open [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project**.
3. Organisation: your personal org is fine.
4. **Name**: `fairslot` (or similar).
5. **Database password**: generate a long random password and store it in a password manager. You need it if you ever connect with `psql`. You do **not** put this password in the app env files.
6. **Region**: pick the one closest to you and to Cloudflare.
7. Wait until the project is healthy (usually under two minutes).

### 4.1 Copy the API keys

Go to **Project Settings → API**.

You need three values:

| Dashboard label | Env var(s) | Who sees it |
| --- | --- | --- |
| Project URL | `VITE_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `anon` `public` key | `VITE_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` | **Server only** |

The service role key bypasses Row Level Security. Anyone who has it can read and write every row. Treat it like a root password.

The `VITE_` copies and the `NEXT_PUBLIC_` copies must be the **same URL** and the **same anon key**. The app uses `VITE_*` in the browser and `NEXT_PUBLIC_*` inside `/api`.

### 4.2 Fill `.env.prod`

Open `.env.prod` in this repo and paste your three values. Both URL lines get the Project URL. Both anon lines get the anon key. The service role line gets the secret key.

```bash
# after you have filled .env.prod, make a local production copy Vite can load
cp .env.prod .env.production.local
```

For day-to-day `npm run dev`, also create a local file:

```bash
cp .env.example .env.local
```

Paste the **same** keys into `.env.local`. Vite loads `.env.local` in every mode.

### 4.3 Create the tables

1. In Supabase: **SQL Editor → New query**.
2. **New project:** open `supabase/schema.sql`, copy the entire file, paste, **Run**.
3. **Existing project** that already had the old schema: run `supabase/migrate_existing.sql` instead (safe, non-destructive).
4. Confirm under **Table Editor** that you see:
   - `events`
   - `slots`
   - `claims`
   - `event_settings`

The schema script also:

- adds indexes and unique constraints on `join_code` and `claim_token`
- enables Row Level Security with a tight policy set (see below)
- adds `events`, `slots`, and `claims` to the `supabase_realtime` publication
- installs `public.claim_slot(...)` for atomic capacity updates

#### RLS model (important)

| Table | anon / browser | authenticated organiser | service_role (`/api`) |
| --- | --- | --- | --- |
| `events` | SELECT (public directory + realtime) | SELECT | ALL |
| `slots` | SELECT (live inventory + realtime) | SELECT | ALL |
| `claims` | **none** (PII) | SELECT only rows for events they own | ALL |
| `event_settings` | **none** (`join_pin` must not leak) | **none** | ALL |

Writes never go through the anon key. `/api` **must** use `SUPABASE_SERVICE_ROLE_KEY`. If that secret is missing, every create/claim/export call fails on purpose rather than silently using the anon key under RLS.

#### Auth provider checklist

1. **Authentication → Providers → Email** — enable Email.
2. **Confirm email: OFF** — FairSlot expects an immediate session on sign-up (no inbox step).
3. **Authentication → URL configuration** — add your Worker/Pages URL and `http://localhost:5173` to Redirect URLs / Site URL.

### 4.4 Auth — email and password only

1. **Authentication → Providers**.
2. **Email** must be enabled.
3. Disable **Google**, **Apple**, and every other provider. This app has no Google button.
4. **Authentication → Providers → Email**:
   - Turn **Confirm email** **OFF**. FairSlot expects an immediate session on sign-up.
5. **Authentication → URL Configuration**:
   - **Site URL**: your Worker URL (e.g. `https://fairslot.<account>.workers.dev`) or custom domain. For local dev use `http://localhost:5173`.
   - **Redirect URLs** — add all of these:
     - `http://localhost:5173/**`
     - `http://127.0.0.1:5173/**`
     - `https://YOUR_PROJECT.pages.dev/**`
     - `https://*.YOUR_PROJECT.pages.dev/**` (preview deploys)
     - your custom domain, if you add one, e.g. `https://app.example.com/**`

No extra `users` table is required. Organiser identity is `auth.users`. Each event stores `creator_id` as that user's UUID.

### 4.5 Realtime

1. **Database → Publications** (or **Realtime**).
2. Confirm `events`, `slots`, and `claims` are in `supabase_realtime`. The SQL file already adds them.
3. If a table is missing, add it there, or re-run the `alter publication` block at the bottom of `supabase/schema.sql`.

### 4.6 Optional hardening later

- **Authentication → Rate Limits** — keep the defaults on Free tier.
- **Authentication → Attack Protection** — enable CAPTCHA (hCaptcha or Turnstile) before you open sign-up to the public internet.
- **Project Settings → API → JWT expiry** — default is fine.
- Rotate the service role key immediately if it ever appears in a screenshot, chat, or commit.

---

## 5. Environment files (what each one is for)

| File | Committed? | Loaded by | Use |
| --- | --- | --- | --- |
| `.env.example` | yes | nobody | Empty template |
| `.env.production.example` | yes | nobody | Empty production template |
| `.env.local` | **no** | Vite (every command) | Your keys for `npm run dev` |
| `.env.prod` | **no** | nobody automatically | Your filled production vault — copy from here |
| `.env.production.local` | **no** | Vite `npm run build` | Same values as `.env.prod` |

Vite only auto-loads files named `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. That is why `.env.prod` is a vault you copy, not a file Vite reads.

**Never** prefix the service role with `VITE_`. Anything starting with `VITE_` is compiled into the JavaScript bundle and is visible to anyone who opens DevTools.

---

## 6. Run the app on your machine

```bash
npm install
```

### Frontend only (UI work)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The UI will load. `/api` calls will fail unless the Functions layer is also running.

### Frontend + `/api` together (recommended)

Cloudflare’s local Worker emulator serves `dist` and `functions/worker.js`:

```bash
npm run build
npx wrangler pages dev dist --compatibility-flags=nodejs_compat --port 8788
```

Wrangler will prompt you to log in to Cloudflare the first time. Point the browser at the URL it prints (usually `http://localhost:8788`).

Pass local secrets into Functions:

```bash
npx wrangler pages dev dist --compatibility-flags=nodejs_compat --port 8788 \
  --binding NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co \
  --binding SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or create a `.dev.vars` file in the project root (gitignored by convention if you add it — do not commit it):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then:

```bash
npx wrangler pages dev dist --compatibility-flags=nodejs_compat --port 8788
```

### First smoke test

1. Go to `/login`.
2. **Create one** organiser account (email + password, 6+ characters).
4. Create an event, add a slot, copy the share link.
5. Open that link in a private window (no login) and claim the slot.
6. Download the ticket on the success screen.
7. Back in the studio, confirm the claim appeared and **Export CSV** works.

---

## 7. Host the frontend (and `/api`) on Cloudflare Workers

The Vite app is a static SPA. `functions/worker.js` is the Worker entry: it serves `/api/*` and falls through to the `ASSETS` binding (`./dist`) for the SPA. You do **not** need a second host for the backend.

`wrangler.toml` sets `run_worker_first = true` so `POST /api/*` is never answered with 405 by the static asset server.

### 7.1 Deploy from the CLI (recommended)

```bash
npm install
npm run build
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

### 7.1b Or create from GitHub

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create**.
2. Authorise Cloudflare to read the GitHub account or organisation that owns `fairslot`.
3. Select the repository.
4. Configure the build:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | Vite (or None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` (leave default) |
   | Node version | `20` (Settings → Environment variables → `NODE_VERSION=20` if needed) |

5. **Do not deploy yet.** Add environment variables first.

### 7.2 Environment variables on the Worker

**Settings → Environment variables.** Add each key twice if you want Preview deploys to work as well: once for **Production**, once for **Preview**.

**Build-time** (Vite inlines these into the JS bundle):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | same URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same anon key |
| `NODE_VERSION` | `20` |

**Runtime** (Worker secrets — encrypt):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your **service_role** key |

`SUPABASE_SERVICE_ROLE_KEY` must **not** be marked as a Vite public variable. Mark it as a secret.

If you already clicked Deploy before adding vars, add them now and **Retry deployment**. A rebuild is required for `VITE_*` changes.

### 7.3 Compatibility flags

This repo includes `wrangler.toml` with:

```toml
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist"
```

`wrangler.toml` already sets `compatibility_flags = ["nodejs_compat"]`. If a deploy logs an error about `process` or `Buffer`, confirm that flag is present in the dashboard too.

### 7.4 SPA routing

`public/_redirects` is copied into `dist/` on build:

```
/api/*  /api/:splat  200
/*      /index.html  200
```

`not_found_handling = "single-page-application"` keeps React Router paths (`/login`, `/e/ABCDEF`, `/studio/12`) from returning Cloudflare’s 404. `/api/*` is handled by the Worker first (`run_worker_first = true`).

After deploy, open `/api/health` — you want `service_role_configured: true` and `service_role_distinct_from_anon: true`.

### 7.5 Custom domain (optional)

**Workers & Pages → your project → Custom domains → Set up a domain.**

Then go back to Supabase **Authentication → URL Configuration** and set:

- Site URL = `https://your-domain.com`
- Extra redirect = `https://your-domain.com/**`

### 7.6 Confirm the production deploy

After the first green build:

1. Open `https://YOUR_PROJECT.pages.dev`.
2. Create an organiser.
3. Create a **live** event, add a slot, copy **Share link**.
4. Open the link in a private window and claim.
5. Download the ticket.
6. In the studio, lock is optional; CSV export should download.

If `/api/public` returns 500, the Functions cannot see `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL`. Recheck runtime secrets and retry the deploy.

---

## 8. How join codes and share links work

Every event gets a six-character `join_code` (for example `K7Q2NM`).

| Path | Who uses it |
| --- | --- |
| `/e/K7Q2NM` | Share link. Anyone with the URL. |
| `/join` | Participant types the same code. |
| Studio → **Share link** | Copies `https://YOUR_DOMAIN/e/K7Q2NM`. |

If you set an **Access PIN** in studio settings, both the link and the typed code stop at a PIN screen. The PIN is stored on `event_settings.join_pin` and is checked in `/api/public` and `/api/claims`. It is never sent to the public event directory.

Unlisted events stay off `/events` but the share link and join code still work.

---

## 9. Security model (so you configure it on purpose)

| Control | Where you set it | What it does |
| --- | --- | --- |
| Access PIN | Studio → Security | Required after opening the link or code |
| Require phone | Studio → Security | Claim rejected without a phone number |
| One claim per email | Studio → Security | Same email cannot take a second slot |
| Confirm email | Studio → Security | Participant must type email twice |
| Hide remaining counts | Studio → Security | Public UI shows Open / Full only |
| Unlisted | Studio → Security | Hidden from the public directory |
| Claim open / close | Studio → Security | Time window enforced on the server |
| Pre-notice + acknowledgement | Studio → Pre-notice | Instructions before slots; optional checkbox |
| Success title / message / ticket note | Studio → Success | Copy on the receipt and on the PNG ticket |
| Immutable lock | Studio → Book controls | Freezes slots, claims, and settings forever |
| Optimistic slot increment | `/api/claims` | Prevents two people taking the last place |

Auth for organisers is **email + password only**. There is no Google sign-in in this codebase.

---

## 10. Database map

```
auth.users
    │  id (uuid)
    ▼
events.creator_id
    │
    ├─► slots.event_id
    │       │
    │       └─► claims.slot_id
    │
    ├─► claims.event_id
    └─► event_settings.event_id   (1:1)
```

Re-run `supabase/schema.sql` only on an empty project. On an existing project, run individual `alter table` statements instead of the full script.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Blank page on a deep link (`/login`) | SPA fallback missing | Confirm `public/_redirects` is in the repo and `dist` after build |
| `Invalid API key` in the browser | Wrong or preview anon key | Replace `VITE_SUPABASE_*` with **your** project keys and rebuild |
| `/api/*` returns 401 as an organiser | Session token not sent, or Functions using a different Supabase project than the frontend | Same URL + keys in build vars and runtime secrets |
| `/api/*` returns 500 | Missing `SUPABASE_SERVICE_ROLE_KEY` on Functions | Add the secret, retry deploy |
| `/api/*` says service role missing / identical to anon | Wrong key pasted into the service-role slot | Supabase → Settings → API → copy **service_role** secret |
| Browser can read all claims / PINs via Supabase REST | Old world-readable RLS policies still active | Run `supabase/migrate_existing.sql` |
| Claim works but realtime inventory does not move | Table not in `supabase_realtime`, or RLS blocks | Re-run publication + policy block in migrate script |
| “Could not authenticate” on sign-up | Email provider off, or Confirm email still on | Auth → Providers → Email; Confirm email OFF |
| Realtime counts do not move | Table not in `supabase_realtime` | Re-run the publication block in `schema.sql` |
| PIN always rejected | Functions and UI pointed at different projects, or PIN not saved | Save settings in studio, hard-refresh the claim page |
| CSV is empty or 401 | Not signed in, or `Authorization` header stripped | Export only from the studio while logged in |
| Accidental commit of `.env.prod` | File was forced or not ignored | Rotate **every** Supabase key immediately (Settings → API → Reset), remove the file from Git history |

---

## 12. Updating the live app

```bash
git checkout main
git pull
# make changes
git add -A
git commit -m "Your message"
git push origin main
```

If the Worker is connected to GitHub it rebuilds on push to `main`. Otherwise run `npm run deploy`. After it is live, hard-refresh the site and hit `/api/health`.

If you only changed a secret, you do not need a code push: edit the Pages env var and **Retry deployment** so `VITE_*` is baked in again.

---

## 13. Local file checklist

After you finish this guide you should have, on your machine only:

```
.env.local                 # filled, gitignored — used by npm run dev
.env.prod                  # filled, gitignored — your production vault
.env.production.local      # copy of .env.prod — used by npm run build
```

And in the GitHub repo (no secrets):

```
.env.example
.env.production.example
SETUP.md
supabase/schema.sql
functions/
wrangler.toml
public/_redirects
```

You are done when a private window can open your Pages URL, join with a code, claim a slot, and download a ticket — against **your** Supabase project, not the preview database.
