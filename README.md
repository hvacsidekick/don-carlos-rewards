# Don Carlos Rewards

Apple-quality, mobile-first PWA rewards app for **Don Carlos Taco Shop** (Arvada, CO).
Next.js 15 (App Router, RSC) · Supabase · Tailwind CSS · shadcn/ui · Framer Motion · TypeScript (strict).

> Build is phased and gated. See [`PLAN.md`](./PLAN.md) (roadmap), [`BLUEPRINT.md`](./BLUEPRINT.md)
> (technical contract), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (visual system), and
> [`PHASE_LOG.md`](./PHASE_LOG.md) (per-phase Builder→Auditor→Fixer→Verifier status).

---

## Prerequisites

- **Node.js ≥ 20** (developed on Node 24)
- **npm ≥ 10**

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values (see Environment below)
npm run dev                  # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000). In development, the design
sandbox lives at **`/_sandbox`** (it 404s in production).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check |
| `npm run win:defender-exclude` | (Windows) add Defender exclusions for build output — see below |

## Windows: `next build` flakiness

On Windows, `next build` can intermittently fail during the **"Collecting build
traces / Finalizing"** stage with a filesystem race, e.g.:

```
ENOENT  rename '.next\export\500.html' -> '.next\server\pages\500.html'
ENOENT  open   '.next\static\<id>\_ssgManifest.js'
```

The cause is Windows Defender real-time protection briefly locking a file
Next.js just wrote inside `.next`, so the following rename/open loses the race.
The build is deterministic on CI/Linux; locally:

1. **Exclude the repo from Defender real-time scanning** (durable fix — run once,
   self-elevates to admin):
   ```powershell
   npm run win:defender-exclude
   ```
2. Build with the **dev server and editors closed** to minimize file contention
   on `.next`.

If a build still hits the race, re-running it succeeds — it is a transient lock,
not a code defect. See `PHASE_1_FIXER_REPORT.md` (M-1) for the characterization.

## Environment

All variables are listed in [`.env.example`](./.env.example) and validated by
[`src/lib/env.ts`](./src/lib/env.ts) with Zod — the app **fails fast** with a
clear message if a required value is missing or malformed.

- `NEXT_PUBLIC_*` are the only client-exposed vars.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** — never import it into a
  `"use client"` module.

### Service-role key

The service-role key is a secret that bypasses RLS. It is **not** retrievable via
tooling — fetch it from the dashboard and paste it into `.env.local`:

> Dashboard → Project `don-carlos-rewards` → **Settings → API → `service_role`**
> (`https://supabase.com/dashboard/project/uxgcyvexeehvhtuhmztc/settings/api`)

It is only needed for server-side admin operations (Phase 3+). Migrations are
applied via the Supabase management API and do not require it. The committed
`.env.local` ships a `REPLACE_WITH_…` placeholder so `lib/env.ts` validation (a
non-empty string) passes for `dev`/`build` until you add the real value.

---

## Database (Supabase)

The Phase 2 schema, RLS policies, triggers, points functions, and seed are live
on the dev project **`don-carlos-rewards`** (ref `uxgcyvexeehvhtuhmztc`).

- **Migrations:** versioned SQL in [`supabase/migrations/`](./supabase/migrations/)
  (apply in filename order). **Seed:** [`supabase/seed.sql`](./supabase/seed.sql)
  (idempotent — menu + `rewards_config`).
- **Points integrity (the #1 invariant):** `points_balance` is **never** written
  by clients. Every change flows through the `SECURITY DEFINER` functions
  `add_points` (admin), `redeem_points` (self), `adjust_points` (admin). A guard
  trigger on `profiles` freezes `points_balance`, `total_points_earned`,
  `total_redemptions`, `is_admin`, and `qr_token` for any write that is not
  inside one of those trusted functions — even a raw service-role `UPDATE`. See
  `BLUEPRINT.md` §4 and `PHASE_2_TASK.md` §3.

### Regenerating database types

After any schema migration, regenerate the typed client helpers:

```bash
npx supabase gen types typescript --project-id uxgcyvexeehvhtuhmztc > src/lib/database.types.ts
```

`src/lib/database.types.ts` is a generated file — do not hand-edit it.

### Promoting a user to admin

There is no UI for granting admin. A user must first **sign up** (so a `profiles`
row exists), then be promoted. The dedicated function bypasses the column guard
safely and is restricted to the SQL editor / service role (it is revoked from the
`authenticated` role, so users cannot self-promote):

```sql
-- Run in the Supabase SQL editor (dashboard → SQL).
-- Allowed for the FIRST admin even with no admin yet (bootstrap); afterwards the
-- caller must already be an admin.
select public.promote_to_admin('owner@doncarlos.example');
```

Verify:

```sql
select email, is_admin from public.profiles where is_admin;
```

> **Bootstrap note:** promote your owner account immediately after its first
> sign-up. Until at least one admin exists, `promote_to_admin` accepts the first
> caller (this is why it is locked to the SQL editor / service role, not exposed
> to the app).

To demote, run this in the SQL editor. The guard freezes `is_admin`, so the write
must happen inside the same transaction that opens the bypass window:

```sql
begin;
  select set_config('app.points_ctx', 'on', true);  -- transaction-local
  update public.profiles set is_admin = false where email = 'someone@example.com';
commit;
```

## Versioning & key decisions

- **Tailwind CSS is pinned to v3.4.x** (not v4). The entire design-token
  contract (`tailwind.config.ts` + the CSS custom properties in `globals.css`)
  is authored for the Tailwind v3 config shape described in `BLUEPRINT.md` §3 and
  `DESIGN_SYSTEM.md` §2–4. This is a deliberate, documented choice for stability
  and shadcn/ui compatibility.
- **Next.js pinned to 15.5.x** (App Router). `create-next-app@latest` currently
  scaffolds a Next 16 preview; we target stable Next 15 per the approved stack.
- **Dark mode: `media`** — follows the OS `prefers-color-scheme`; no manual
  toggle in v1 (`DESIGN_SYSTEM.md` §10).

## Design tokens

Colors, the Apple type ramp, the 4px spacing scale, radii, and shadows are
wired into `tailwind.config.ts` and backed by CSS custom properties (light +
dark blocks) in `src/app/globals.css`. Solid colors use RGB channels consumed as
`rgb(var(--x) / <alpha-value>)` so Tailwind opacity modifiers work; mode-aware
translucent tokens (separators, secondary/tertiary text, fills) carry their
alpha inline. Verify everything in both modes at `/_sandbox`.

## Project structure

See [`BLUEPRINT.md`](./BLUEPRINT.md) §2 for the full target layout. As of Phase 1:

```
src/
  app/            layout.tsx · page.tsx · globals.css · _sandbox/
  components/
    ui/           shadcn base components
    nav/          BottomTabBar
    common/       Mascot (placeholder), TacoGlyph
  lib/            utils · env · motion · haptics · format
```
