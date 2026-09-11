# Blocodex

Mobile-first PWA for a climbing gym: browse the routes currently up, tick the ones
you've sent, fill in your dex, and climb the points leaderboard. Admins manage reset
cycles ("sets"), upload wall photos, and tag routes as pins on those photos.

Full plan and milestones: [`docs/PLAN.md`](docs/PLAN.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres +
Auth + Storage via Supabase · deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in from your Supabase project
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the URL and `anon` key into `NEXT_PUBLIC_SUPABASE_*`,
   and the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`.
3. **Database → Connect**: put the transaction-pooler string (port 6543, add
   `?pgbouncer=true`) in `DATABASE_URL`, and the direct/session string (port 5432)
   in `DATABASE_URL_UNPOOLED`.
4. **Authentication → URL Configuration**: add `http://localhost:3000/auth/callback`
   (and your Vercel URL) to the redirect allow-list. Enable the Google provider if you
   want the Google button.

### Database

```bash
npm run db:generate   # SQL migrations from db/schema.ts
npm run db:migrate    # apply them
npm run db:seed       # one gym, a color grade scale, two walls
```

To make yourself an admin: sign in once, copy your user id from **Supabase →
Authentication → Users** into `ADMIN_AUTH_ID`, then re-run `npm run db:seed`.

### Run

```bash
npm run dev           # http://localhost:3000
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run db:generate` | Generate SQL migrations from the schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema straight to the DB (dev only, skips migration files) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Idempotent dev seed |

## Layout

```
app/
  (admin)/        admin route group, gated on profiles.is_admin
  auth/           callback + signout route handlers
  api/health/     env + DB check
  login/          magic-link + Google
  routes/ leaderboard/ me/   client screens (stubs until M2/M3)
db/
  schema.ts       Drizzle schema — see PLAN §4
  index.ts        db client (postgres.js, prepare:false for pgBouncer)
  seed.ts
lib/
  auth.ts         getCurrentUser / requireUser / requireAdmin
  points.ts       derived route point value
  env.ts          runtime env validation (assertEnv)
  supabase/       server / client / proxy clients
proxy.ts          Supabase session refresh (Next 16's renamed "middleware")
```

## Deploy (Vercel)

Import the repo, set the same env vars, add the Vercel URL to Supabase's auth
redirect allow-list. Run `npm run db:migrate` against the prod DB on each schema change
(or wire it into the deploy).
