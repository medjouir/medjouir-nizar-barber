# Nizar Barber Booking — V0.1

Mobile-first booking app for Nizar (barber). Clients book from a shared link without an account; Nizar manages appointments from an authenticated dashboard.

Standalone repository, independent from any other project.

## Stack

- Next.js (App Router) + React + TypeScript (strict)
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- Supabase (PostgreSQL, Auth, RLS) via `@supabase/ssr`
- Geist font (self-hosted through the `geist` package)

## Run locally

Requires Node.js 20.9+.

```bash
npm ci
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon/publishable key — protected by RLS |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL used for the booking link and QR code |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Used only in server code for validated public operations. Never prefix with `NEXT_PUBLIC_`. |

## Database setup (Supabase)

Project: `cuunoajwxymacyfmnatm`. Run once, in order, in **Supabase → SQL Editor**:

1. `supabase/migrations/20261001120000_core_schema.sql`
2. `supabase/migrations/20261001120100_security.sql`
3. `supabase/seed.sql` — first set `v_owner_email` to Nizar's login email.

Then in **Authentication**:

- **Sign In / Providers → Email**: turn off *Allow new users to sign up* (only Nizar logs in).
- **Users → Add user**: Nizar's email + password, with *Auto Confirm User* checked.
  The account is linked to the `nizar` barber automatically.
- **URL Configuration**: Site URL = production URL; add `<site>/auth/confirm` to Redirect URLs.

Sample data can be removed with `supabase/seed-reset.sql` and recreated by re-running `seed.sql`.

### Database tests

`npm run test:db` applies a Supabase stub, the migrations and the seed to a throwaway
local PostgreSQL database and checks constraints, double-booking protection and RLS.
Needs PostgreSQL 16 with `btree_gist`/`pgcrypto` and `PGHOST`/`PGPORT`/`PGUSER` set.

See [docs/architecture.md](docs/architecture.md) for the scheduling and security decisions.

## Project structure

```
src/
  app/                  routes (App Router), global tokens, root layout
  components/ui/        Button, Card, Progress, PageShell, Spinner
  app/login/            Nizar's sign-in, password reset
  app/dashboard/        private area (guarded by requireBarber)
  proxy.ts              session refresh + /dashboard redirect
  lib/auth.ts           getCurrentBarber / requireBarber
  lib/database.types.ts typed schema for the Supabase client
  lib/env.ts            typed env access
  lib/supabase/
    client.ts           browser client (anon key, RLS)
    server.ts           server client bound to Nizar's auth cookies (RLS)
    admin.ts            service-role client, server-only
    proxy.ts            session refresh helper
supabase/
  migrations/           schema, constraints, RLS
  seed.sql              dev seed (re-runnable), seed-reset.sql removes sample data
tests/db/               database test suite
```

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#000000` | page background |
| `surface` | `#1D1D1D` | cards, secondary surfaces |
| `gold` | `#DDB361` | primary CTA, selected, active nav, key time |
| `gold-pressed` | `#D8A94C` | pressed / selected variation |
| `gold-deep` | `#C6922B` | deeper accent |
| `fg` / `muted` | `#F5F5F2` / `#9A9A9A` | main / secondary text |

Utilities: `px-page` (20px), `p-card` (16px), `rounded-card` (16px), `h-control` (56px), `h-nav` (76px), text sizes `text-hero`, `text-title`, `text-section`, `text-body`, `text-secondary`, `text-time`, animations `animate-enter-forward` / `animate-enter-back` (220ms, disabled under reduced motion).

## Deploy (Vercel)

Vercel project `nizar-barber` (framework: Next.js, root directory: repository root). Set the environment variables above for Preview and Production.
