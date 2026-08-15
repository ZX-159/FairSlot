# FairSlot

Frictionless event allocation: live inventory, immutable locks, tidy CSV exports. Organisers sign in with email and password. Participants join with a code or share link — no account.

## Quick start

Full walkthrough — GitHub, your own Supabase project, local run, and Cloudflare Pages — is in **[SETUP.md](./SETUP.md)**.

```bash
cp .env.example .env.local          # then paste YOUR Supabase keys
cp .env.prod .env.production.local  # after filling .env.prod
npm install
npm run dev
```

Do not use the preview/temp database keys. Put your production keys in `.env.prod` (gitignored).
"# FairSlot" 
