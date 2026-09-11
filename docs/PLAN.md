# Blocodex — Build Plan

_Draft v2 · 2026-09-10_

## 1. What we're building

A mobile-first PWA for a climbing gym (single gym now, multi-gym-ready):

- **Admin:** manage reset cycles ("sets"), upload wall photos, tag each route as a
  **pin** on a photo with color / grade / points, configure the grade→points scale, manage users.
- **Client:** climbers browse the current set, open a route, log that they've done it,
  see their points and history, and compete on leaderboards.
- **History:** every set, every send, and every past leaderboard is preserved forever.

**The "dex" framing:** each route is a creature you *catch* by logging a send. Your profile is
your dex — % complete per set. Current-set dex vs. all-time dex ≈ regional vs. national dex.
"Climbed everything currently up" = a living dex. This completionist loop sits alongside the
points leaderboard and is a first-class part of the client UX (M2/M3).

## 2. Decisions locked in

| Area | Decision |
|---|---|
| Route tagging | **Point/pin markers** — admin taps the photo to drop a pin per route |
| Auth | **Managed provider** — Supabase Auth (magic link + Google) |
| Client UX | **Mobile-first PWA** — installable, leaderboard + dex are core screens |
| Hosting priorities | **Zero ops + low, predictable cost** |
| Reset cycles | **Seasons / "sets" with full history** — archived routes, preserved sends & leaderboards |
| Name | **Blocodex** |

## 3. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + TypeScript** | One deploy for API + UI, strong PWA support, familiar |
| Styling | **Tailwind v4** (+ shadcn/ui when the UI work starts) | Fast mobile-first UI |
| DB | **Postgres via Supabase** | Managed, predictable pricing, open-source (self-host escape hatch) |
| ORM | **Drizzle** (`postgres` driver, `casing: snake_case`) | SQL-first, light, great TS types, simple migrations |
| Auth | **Supabase Auth** | Consolidates with DB + storage |
| Image storage | **Supabase Storage** + CDN | Keeps large photos off the app host's bandwidth |
| Image processing | **sharp** on upload (M1) | Downscale to ~1600px WebP + thumbnail |
| Photo viewer | **react-zoom-pan-pinch** (M1) | Pan/zoom so pins stay accurate on crowded walls |
| Hosting | **Vercel** (app) + **Supabase** (data) | Zero ops. ~$20/mo Vercel Pro + ~$25/mo Supabase Pro ≈ predictable ~$45/mo; free tiers cover dev |
| PWA | manifest now; service worker + offline in M4 | |

**Portability:** app logic is in Next.js server code, not Postgres RLS, so the DB is "just
Postgres." `profiles.authId` (nullable) points at the auth provider's user id — swapping
Supabase Auth later touches only `lib/auth.ts` + `lib/supabase/*`. Supabase is self-hostable
via Docker if the gym ever wants to own it.

**Parked alternative:** single Hetzner VPS + Coolify (Next.js + Postgres + MinIO), ~$6–10/mo
flat, more ops.

## 4. Data model

Implemented in `db/schema.ts`. Summary:

```
gyms          id, name, slug
walls         id, gym_id, name, sort_order                 -- optional grouping ("Cave", "Lead Wall")
grade_scale   id, gym_id, label, color_hint, default_points, sort_order
sets          id, gym_id, name, set_date,
              published_at, archived_at, created_by         -- a reset cycle / "season"
photos        id, set_id, wall_id, storage_path, thumb_path,
              width, height, caption, sort_order
routes        id, set_id, photo_id,
              pin_x, pin_y,                                 -- normalized 0..1 relative to photo
              color, grade_id, points_override,
              name, setter, notes, status(active|archived)
profiles      id, auth_id (nullable, unique), display_name,
              avatar_url, is_admin
sends         id, profile_id, route_id, sent_at,
              attempts, style(flash|redpoint|repeat), notes
              UNIQUE (profile_id, route_id)
```

- **Route points** = `points_override ?? grade_scale.default_points ?? 0` (`lib/points.ts`).
  Derived, never snapshotted — editing the scale recomputes leaderboards live.
- **Leaderboard (current set)** = `SUM(points)` over a user's sends where `route.set_id = :setId`.
- **Leaderboard (all-time)** = same, no set filter. Start as a plain query; promote to a
  materialized view only if it gets slow.
- **Dex %** for a user in a set = `count(distinct sent route) / count(active routes in set)`.

## 5. Milestones

### M0 — Foundation ✅ (scaffolded this session)
- Next.js 16 + TS + Tailwind v4, ESLint
- Drizzle schema + config + idempotent seed (`db/seed.ts`)
- Supabase server/browser/proxy clients; `proxy.ts` refreshes the session
- `lib/auth.ts`: `getCurrentUser` / `requireUser` / `requireAdmin`, lazy profile creation
- Magic-link + Google login, `/auth/callback`, `/auth/signout`
- `/admin` route group gated on `is_admin`, dashboard with counts
- `/api/health`, PWA manifest + icon
- GitHub Actions CI: lint + typecheck + build + migration-drift check

**Remaining to call M0 done:** create the Supabase project, fill `.env.local`, run
`npm run db:generate && npm run db:migrate && npm run db:seed`, deploy to Vercel, confirm
login works on a phone.

### M1 — Admin: sets & route tagging
- CRUD sets (draft → published → archived)
- Photo upload → sharp resize → Supabase Storage; reorder
- **Pin tagging UI:** tap photo to add a pin, drag to reposition, side panel for
  color / grade / points / name / setter / notes; pan-zoom viewer
- Grade-scale editor
- **Exit:** admin can publish a full set with tagged routes

### M2 — Client: browse & log
- Current-set view: photo gallery with pins; tap pin → route detail sheet
- Filters: color, grade, wall, "hide done"
- Log / unlog a send (+ optional attempts / style / note)
- Past sets browsable read-only
- **Exit:** a climber can find a route and tick it

### M3 — Leaderboards, profiles & dex
- Leaderboard: current set + all-time (+ optional 30-day)
- Profile: total points, send timeline, per-set dex %, grade pyramid
- **Exit:** the competitive + completionist loop works end to end

### M4 — PWA polish
- Manifest icons, install prompt
- Service worker: offline read of the current set (photos + route data)
- Offline send-logging queued and synced on reconnect (nice-to-have)
- Image loading: blur-up thumbnails, correct `sizes`
- **Exit:** installs cleanly, usable in gym wifi dead spots

### M5 — Backlog
- New-set notification (push/email)
- Route comments / beta / star ratings
- Setter accounts & attribution
- CSV / JSON export (data ownership)
- Multi-wall dashboards, multi-gym tenant switch, custom domains
- Anti-cheat niceties (rate limits, admin "void send")

## 6. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Pins drift when photos are re-shot mid-set | Pins live on `routes`; replacing a photo flags its routes "needs re-pin" |
| Pin accuracy on dense walls | Normalized coords + pan/zoom viewer; large tap targets; route-list fallback |
| Vercel image/bandwidth cost creep | Photos from Supabase Storage CDN as pre-sized WebP, not the Next image optimizer |
| Auth vendor lock-in | `profiles.authId` seam; auth isolated in `lib/auth.ts` + `lib/supabase/*` |
| Points disputes when scale changes | Points derived + recomputed; documented; snapshot only if it bites |
| Scope creep | Everything non-core is M5; schema already leaves room |
| `drizzle-kit` pulls an old `esbuild` (moderate dev-only advisory) | Dev tooling only, not shipped; revisit when drizzle-kit updates the dep |

## 7. Open questions

1. Grade system: V-scale (bouldering), French / YDS (routes), or the gym's own colors-as-grades?
   (Seed currently uses colors → points.)
2. Does the gym separate **bouldering vs. lead/top-rope**? Affects `walls` + how many grade scales.
3. Should past-set leaderboards stay public, or collapse to personal history after a set archives?
4. Any existing brand / logo / colors from the old site to match?
5. Points curve — is the seed's 100 → 1100 spread roughly right, or flatter/steeper?
