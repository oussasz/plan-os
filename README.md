# Plan OS

Mobile-first cognitive planning system built with the [T3 Stack](https://create.t3.gg/).

## Features

- **Today** — hour-by-hour focus timeline with locked meetings and deep-work blocks
- **Week** — 7-day strip, per-project allocations, tap-to-preview daily timeline
- **Month** — project hour budgets and weekly milestone notes
- **Projects** — dialog-based project creation; engine computes priority (no manual sliders)
- **Close-out** — end-of-day actuals → anti-drift learning → replan from tomorrow

## Stack

- Next.js 15 App Router
- tRPC + Prisma + PostgreSQL (Supabase)
- NextAuth credentials (single-user)
- Tailwind CSS v4 + shadcn-style primitives
- PWA manifest (`/manifest.json`)

## Local development

```bash
npm install
cp .env.example .env   # set DATABASE_URL and AUTH_SECRET
npx prisma generate
npx prisma db push     # or migrate deploy
npm run dev
```

Sign in with credentials from `.env` (`AUTH_EMAIL` / `AUTH_PASSWORD`, defaults in `.env.example`).

## Production

- **App:** https://plan-os-nine.vercel.app
- **Repo:** https://github.com/oussasz/plan-os

Required env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_EMAIL`, `AUTH_PASSWORD`.

**Supabase pooling (required on Vercel):** use the **transaction pooler** on port **6543** with `?pgbouncer=true&connection_limit=1`. Port 5432 is *session mode* (~15 connection cap) and will throw `max clients reached` under load. The app auto-upgrades `:5432` pooler URLs at runtime, but set Vercel `DATABASE_URL` to `:6543` explicitly.
