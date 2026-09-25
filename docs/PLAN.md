# Blocodex — Build Plan

_Draft v3 · 2026-09-20 · M1 built 2026-09-24_

## 1. What we're building

A mobile-first PWA for a climbing gym (single gym now, multi-gym-ready):

- **Admin:** manage reset cycles ("sets"), upload wall photos, tag each route as a
  **pin** on a photo with color / grade / points, configure the grade→points scale, manage users.
- **Setters:** a lighter admin role. Plan a new set as a draft checklist (wall +
  rough grade + assigned setter, no pin yet), tag routes with free-form style tags
  (power, slab, technical, dynamic, ...), and see "what I've set" across history.
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
| Wall type | **Bouldering only** — no lead/top-rope walls, single grade scale |
| Grading | **Colors-as-grades**, each labeled with its V-scale range (e.g. "Yellow (V0–V1)") |
| Leaderboard history | **Stays public** — any past set's leaderboard is browsable, not just personal history |
| Points curve | **100 → 1100 across 6 grades** (seed's original spread) — kept as-is |
| Branding | **Placeholder** (dark theme, purple accent) until a real gym identity exists |
| Setter role | **New `is_setter` role** on `profiles` — can plan/tag/pin routes and sets, not users/gyms/grade scale |
| Route type tags | **Free-form, many-to-many** (`tags` + `route_tags`) — self-normalizing via autocomplete against existing gym tags, not an admin-curated fixed list |
| Set planning | **Routes gain a `planned` status.** A draft route (wall + rough grade, no pin yet) is the same row that later gets pinned — no separate "planned routes" table, no conversion step |

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
| PWA | manifest now; service worker + offline in M5 | |

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
walls         id, gym_id, name, sort_order                 -- optional grouping ("Cave", "Slab")
grade_scale   id, gym_id, label, color_hint, default_points, sort_order
sets          id, gym_id, name, set_date,
              published_at, archived_at, created_by         -- a reset cycle / "season"
photos        id, set_id, wall_id, storage_path, thumb_path,
              width, height, caption, sort_order
routes        id, set_id, wall_id, photo_id,                -- photo_id/pin_x/pin_y/color null while planned
              pin_x, pin_y,                                 -- normalized 0..1 relative to photo
              color, grade_id, points_override,
              name, setter_id, notes,                       -- setter_id → profiles
              status(planned|active|archived)
tags          id, gym_id, label                             -- free-form; UNIQUE (gym_id, lower(label))
route_tags    route_id, tag_id                               -- many-to-many, PK (route_id, tag_id)
profiles      id, auth_id (nullable, unique), display_name,
              avatar_url, is_admin, is_setter
sends         id, profile_id, route_id, sent_at,
              attempts, style(flash|redpoint|repeat), notes
              UNIQUE (profile_id, route_id)
```

- **Route points** = `points_override ?? grade_scale.default_points ?? 0` (`lib/points.ts`).
  Derived, never snapshotted — editing the scale recomputes leaderboards live.
- **Leaderboard (current set)** = `SUM(points)` over a user's sends where `route.set_id = :setId`.
- **Leaderboard (all-time)** = same, no set filter. Start as a plain query; promote to a
  materialized view only if it gets slow.
- **Dex %** for a user in a set = `count(distinct sent route) / count(active routes in set)`
  — `planned` routes don't count toward the denominator.
- **Setter attribution** = `routes.setterId` (was free-text `setter`); "what I've set"
  is `routes` filtered by `setterId`, across all sets, no join through anything else.
  In M1 this just defaults to the creating admin; a real per-setter workflow is M4.
- **Planning a set** *(M4)*: a route is created with `status = "planned"`, a `wallId`,
  and a rough `gradeId` — no `photoId`/pin/`color` yet. Pin-tagging that same row
  later fills those in and flips `status` to `"active"`. M1 skips this and creates
  routes directly as `active`.

## 5. Milestones

### M0 — Foundation ✅ done (2026-09-18 → 2026-09-20)
- Next.js 16 + TS + Tailwind v4, ESLint
- Drizzle schema + config + idempotent seed (`db/seed.ts`)
- Supabase server/browser/proxy clients; `proxy.ts` refreshes the session
- `lib/auth.ts`: `getCurrentUser` / `requireUser` / `requireAdmin`, lazy profile creation
- Magic-link + Google login, `/auth/callback`, `/auth/signout`
- `/admin` route group gated on `is_admin`, dashboard with counts
- `/api/health`, PWA manifest + icon
- GitHub Actions CI: lint + typecheck + build + migration-drift check
- Live on Supabase + Vercel (`blocodex.vercel.app`); magic-link login confirmed on a phone

### M1 — Admin: sets & route tagging ✅ built (2026-09-24)
- CRUD sets (draft → published → archived). Archiving flips the set's routes to
  `archived` (unarchive flips them back); only drafts can be deleted
- Photo upload → sharp resize → Supabase Storage; reorder. Browser uploads the
  original straight to Storage via a signed URL (phone photos exceed the 1MB
  Server Action / ~4.5MB Vercel body limits), then a Server Action EXIF-rotates,
  caps at 1600px WebP + 400px thumb, and drops the original. The public `photos`
  bucket is created on first upload
- **Pin tagging UI:** tap photo to add a pin, drag to reposition, side panel for
  color / grade / points / name / notes; pan-zoom viewer. Routes are created
  directly as `active` — the `planned`-status checklist workflow is M4, not here
- Grade-scale editor (+ walls editor)
- `routes.setter` (text) → `routes.setterId` (FK → profiles), defaulted to the
  creating admin
- Guard rails: deleting a grade in use, or a photo/route/set with logged sends,
  is refused rather than silently zeroing points or erasing history
- **Exit:** admin can publish a full set with tagged, pinned routes — enough real
  data for the gamification loop (M2/M3) to build and demo against. Verified
  end-to-end in a headless browser against the live Supabase project; still
  needs a real set shot and tagged on a phone

### M2 — Client: browse & log
- Current-set view: photo gallery with pins; tap pin → route detail sheet
- Filters: color, grade, wall, "hide done"
- Log / unlog a send (+ optional attempts / style / note)
- Past sets browsable read-only
- **Exit:** a climber can find a route and tick it

### M3 — Leaderboards, profiles & dex
- Leaderboard: current set + all-time (+ optional 30-day)
- Profile: total points, send timeline, per-set dex %, grade pyramid
- **Exit:** the competitive + completionist loop works end to end — **this is the
  main objective; gamification ships before any setter tooling below**

### M4 — Setter tools
- **Setter role:** `is_setter` flag on profiles; simple admin screen to
  promote/demote setters
- **Draft checklist:** a set can start as a punch list of `planned` routes (wall +
  rough grade, assigned setter, no pin yet) — a to-do view before anyone touches a
  photo; pin-tagging a planned route promotes it to `active`
- **Free-form route tags:** power / slab / technical / dynamic / ... in the pin
  tagging side panel, many-to-many, autocomplete against existing gym tags
- **Setter attribution:** `routes.setterId` becomes a real per-route assignment
  (M1 just defaults it to whichever admin created the route)
- **"My routes"**: a setter's own routes across all history, filterable by set
- **Exit:** setters get their own lighter-weight planning/tracking workflow, on top
  of the already-shipped climber-facing app

### M5 — PWA polish
- Manifest icons, install prompt
- Service worker: offline read of the current set (photos + route data)
- Offline send-logging queued and synced on reconnect (nice-to-have)
- Image loading: blur-up thumbnails, correct `sizes`
- **Exit:** installs cleanly, usable in gym wifi dead spots

### M6 — Backlog
- New-set notification (push/email)
- Route comments / beta / star ratings
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
| Scope creep | Everything non-core is M6; schema already leaves room |
| `drizzle-kit` pulls an old `esbuild` (moderate dev-only advisory) | Dev tooling only, not shipped; revisit when drizzle-kit updates the dep |
| Free-form route tags drift ("power" vs "Power" vs "powerful") | Case-insensitive unique constraint per gym + autocomplete against existing tags in the UI |

## 7. Open questions — resolved 2026-09-20

1. ~~Grade system~~ → **Colors-as-grades**, each labeled with its V-scale range
   (e.g. "Yellow (V0–V1)"). See §2.
2. ~~Bouldering vs. lead/top-rope~~ → **Bouldering only**. `walls` stays as an
   optional grouping (e.g. "Cave", "Slab") with no lead-specific handling needed.
3. ~~Past-set leaderboard visibility~~ → **Stays public**.
4. ~~Existing brand~~ → **None** — placeholder branding (dark theme, purple accent)
   stays until a real gym identity shows up.
5. ~~Points curve~~ → **Kept as-is** (100 → 1100 across 6 grades); revisit once real
   climbers are using it.

No open questions remain blocking M1.
