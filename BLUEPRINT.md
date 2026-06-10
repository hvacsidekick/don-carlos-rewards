# Don Carlos Rewards App — Technical Blueprint

> **Document status:** Phase 0 deliverable. Authoritative technical contract for architecture, schema, APIs, and deployment. Pairs with [`PLAN.md`](./PLAN.md) (phases/gates) and [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (visual system).
>
> **Stack (approved):** Next.js 15 (App Router, RSC) · Supabase (Postgres + Auth + Realtime) · Vercel · shadcn/ui · Tailwind CSS · Zod · Framer Motion · TypeScript (strict).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (PWA, mobile-first)                │
│  Next.js App Router · RSC + Client Islands · Tailwind/shadcn  │
│  Framer Motion · Supabase browser client (anon key only)      │
└───────────────┬───────────────────────────┬──────────────────┘
                │ Server Actions / API        │ Realtime (websocket)
                ▼                              ▼
┌─────────────────────────────┐   ┌──────────────────────────────┐
│  Next.js Server (Vercel)    │   │  Supabase Realtime            │
│  RSC data fetch · actions   │   │  profiles row → live card     │
│  middleware (session+guard) │   └──────────────────────────────┘
│  service-role for admin ops │
└───────────────┬─────────────┘
                │ Postgres protocol / PostgREST (RLS-enforced)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase Postgres                                            │
│  Tables (RLS) · SECURITY DEFINER fns (points mutations)       │
│  Triggers (profile bootstrap, updated_at) · Auth · Storage    │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

1. **Two Supabase clients.** A *browser* client (anon key, RLS-bound) for reads/realtime in client islands; a *server* client (`@supabase/ssr`, cookie-bound) for RSC + server actions. A *service-role* client exists **only** inside trusted server code for admin operations that must bypass RLS — never imported anywhere reachable by `"use client"`.
2. **Points are never written by clients.** All balance changes flow through Postgres `SECURITY DEFINER` functions invoked via RPC from the server. The `transactions` table is the append-only ledger; `profiles.points_balance` is a denormalized cache the functions keep in sync atomically.
3. **Trust boundary = server.** Admin authorization is checked in Postgres (function-level) AND in the server action AND reflected in UI. UI hiding alone is never the control.
4. **RSC-first.** Pages fetch on the server; only animation/interactivity (rewards card, scanner, forms) become client islands. Minimizes JS shipped, helps the performance budget.
5. **Opaque QR tokens.** QR encodes a rotatable `qr_token` UUID, not the user id or PII. Server resolves token → user under admin authority.

---

## 2. Repository Structure

```
don-carlos-rewards/
├── src/
│   ├── app/
│   │   ├── (auth)/{login,signup,forgot-password,reset-password}/page.tsx
│   │   ├── (auth)/verify-email/page.tsx
│   │   ├── auth/callback/route.ts          # OAuth code exchange
│   │   ├── (user)/dashboard/page.tsx
│   │   ├── (user)/transactions/page.tsx
│   │   ├── (user)/menu/page.tsx
│   │   ├── (user)/profile/page.tsx
│   │   ├── (admin)/scan/page.tsx
│   │   ├── (admin)/customers/page.tsx
│   │   ├── (admin)/customers/[id]/page.tsx
│   │   ├── (admin)/analytics/page.tsx
│   │   ├── about/page.tsx
│   │   ├── menu/page.tsx                    # public mirror of menu (optional)
│   │   ├── legal/{privacy,terms}/page.tsx
│   │   ├── api/                             # route handlers (webhooks, rate-limited bits)
│   │   ├── layout.tsx · globals.css · manifest.ts · sitemap.ts
│   ├── components/
│   │   ├── ui/                              # shadcn (generated)
│   │   ├── rewards/{RewardsCard,StampGrid,ProgressRing,RedeemDialog,Celebration}.tsx
│   │   ├── qr/{QRDisplay,QRScanner}.tsx
│   │   ├── menu/{MenuItem,CategoryNav}.tsx
│   │   ├── nav/{BottomTabBar,AdminNav}.tsx
│   │   ├── common/{Mascot,EmptyState,PageTransition}.tsx
│   ├── lib/
│   │   ├── supabase/{server,client,service,middleware}.ts
│   │   ├── env.ts                           # Zod-validated process.env
│   │   ├── database.types.ts                # generated
│   │   ├── motion.ts                        # spring presets
│   │   ├── haptics.ts · utils.ts · format.ts
│   │   ├── rate-limit.ts
│   │   └── rewards.ts                       # earn/redeem math from rewards_config
│   ├── actions/{auth,rewards,admin,account}.ts
│   ├── schemas/{auth,rewards,admin}.ts      # Zod, shared client+server
│   └── middleware.ts                        # session refresh + route guards
├── supabase/
│   ├── migrations/                          # versioned SQL
│   └── seed.sql
├── public/{icons,mascot,manifest assets}
├── tests/{e2e (Playwright), unit (Jest/RTL)}
├── .env.example · .env.local (gitignored)
├── next.config.ts (security headers) · tailwind.config.ts · tsconfig.json
├── PLAN.md · BLUEPRINT.md · DESIGN_SYSTEM.md · PHASE_LOG.md · README.md
```

---

## 3. Design System (token summary)

> Full specs, layouts, and animation details live in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). This is the implementation-facing token contract for Tailwind.

### Color tokens
```css
/* Brand (Don Carlos) — constant across light/dark */
--dc-red:    #E63946;   /* primary CTA, stamps, progress ring */
--dc-yellow: #F9C74F;   /* highlights, celebration */
--dc-green:  #90BE6D;   /* menu/fresh accents */

/* Neutrals (Apple-style) */
--bg-primary:#FFFFFF;  --bg-secondary:#F2F2F7;  --text-primary:#000;   --text-secondary:rgba(60,60,67,.6);
/* dark */
--bg-primary:#000000;  --bg-secondary:#1C1C1E;  --text-primary:#FFF;   --text-secondary:rgba(235,235,245,.6);

/* Semantic (Apple system) */
--success:#34C759; --warning:#FF9500; --error:#FF3B30;
```

### Type ramp (Apple HIG)
caption 11 · footnote 13 · body **17** · headline 22 · title3 28 · title2 34 · large-title 48. Weights 400/500/600/700.
Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display", "SF Pro Text", system-ui, sans-serif`.

### Spacing — 4px base
`1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64`. Touch targets ≥ 44pt.

### Radii / elevation
cards `rounded-3xl` (24px) for hero, `rounded-2xl` (16px) for list/menu; shadows soft, reduced opacity in dark.

### Custom components (built in their phases)
`RewardsCard`, `StampGrid`, `ProgressRing` (Phase 4) · `QRDisplay`, `QRScanner` (Phase 5) · `MenuItem`, `CategoryNav` (Phase 7) · `Mascot`, `EmptyState`, `Celebration` (cross-cutting).

### Tailwind config sketch
```ts
// tailwind.config.ts
export default {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      'dc-red':'#E63946','dc-yellow':'#F9C74F','dc-green':'#90BE6D',
      success:'#34C759', warning:'#FF9500', error:'#FF3B30',
    },
    borderRadius: { '3xl':'24px' },
    fontSize: { caption:'11px', footnote:'13px', body:'17px', headline:'22px',
                title3:'28px', title2:'34px', 'large-title':'48px' },
    spacing: { 18:'72px' }, // 4px scale otherwise covered by defaults
  }},
}
```

---

## 4. Database Schema (Supabase Postgres)

> All tables in `public`, RLS **enabled**. Migrations live in `supabase/migrations/`. Points mutations go through SECURITY DEFINER functions only (§4.4).

### 4.1 Helper: admin check (avoids RLS recursion)
```sql
-- Non-recursive admin check usable inside policies.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;
```

### 4.2 profiles (extends auth.users)
```sql
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  display_name        text,
  avatar_url          text,
  qr_token            uuid not null default gen_random_uuid() unique,
  points_balance      integer not null default 0 check (points_balance >= 0),
  total_points_earned integer not null default 0 check (total_points_earned >= 0),
  total_redemptions   integer not null default 0 check (total_redemptions >= 0),
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_qr_token_idx on public.profiles(qr_token);
create index profiles_is_admin_idx on public.profiles(is_admin) where is_admin;

alter table public.profiles enable row level security;

-- Users read their own profile; admins read all.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

-- Users may update ONLY non-sensitive fields of their own profile.
-- Points/admin columns are protected by the WITH CHECK + a guard trigger (4.3).
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- NOTE: no INSERT/DELETE policy for clients; rows are created by trigger (4.5),
-- deletion cascades from auth.users.
```

### 4.3 Guard trigger — clients cannot mutate sensitive columns
```sql
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Allow SECURITY DEFINER points functions (they SET LOCAL role context) and admins.
  if public.is_admin(auth.uid()) then
    return new;
  end if;
  -- For normal users, freeze sensitive columns to their OLD values.
  new.points_balance      := old.points_balance;
  new.total_points_earned := old.total_points_earned;
  new.total_redemptions   := old.total_redemptions;
  new.is_admin            := old.is_admin;
  new.qr_token            := old.qr_token;       -- rotation goes through rotate_qr_token()
  return new;
end $$;

create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();
```
> The points functions in §4.4 run as `security definer` (table owner) and bypass this guard because they don't go through `auth.uid()` as a normal user. They update balances directly under owner rights.

### 4.4 transactions (append-only ledger)
```sql
create type public.tx_type as enum ('earn','redeem','adjustment');

create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  points_delta          integer not null,          -- +earn, -redeem, ± adjustment
  points_balance_after  integer not null check (points_balance_after >= 0),
  transaction_type      public.tx_type not null,
  amount_cents          integer,                    -- purchase amount for 'earn' (audit)
  staff_id              uuid references public.profiles(id), -- admin who processed
  notes                 text,
  created_at            timestamptz not null default now()
);
create index transactions_user_created_idx on public.transactions(user_id, created_at desc);

alter table public.transactions enable row level security;
create policy "tx_select_own_or_admin" on public.transactions
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
-- No client INSERT/UPDATE/DELETE: writes happen only via SECURITY DEFINER fns.
```

### 4.5 Atomic points functions (the only write path)
```sql
-- Bootstrap a profile when a new auth user appears.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at touch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ADD POINTS (admin only). $1 = 1 point handled by caller via amount→points.
create or replace function public.add_points(
  target uuid, pts integer, amount_cents integer default null, note text default null)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare new_bal integer; tx public.transactions;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if pts is null or pts <= 0 or pts > 100000 then
    raise exception 'invalid points amount';
  end if;
  update public.profiles
    set points_balance = points_balance + pts,
        total_points_earned = total_points_earned + pts
    where id = target
    returning points_balance into new_bal;
  if new_bal is null then raise exception 'unknown user'; end if;
  insert into public.transactions(user_id, points_delta, points_balance_after,
      transaction_type, amount_cents, staff_id, notes)
    values (target, pts, new_bal, 'earn', amount_cents, auth.uid(), note)
    returning * into tx;
  return tx;
end $$;

-- REDEEM (the authenticated user redeems their own points).
create or replace function public.redeem_points(pts integer)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); new_bal integer; tx public.transactions;
begin
  if uid is null then raise exception 'auth required' using errcode='42501'; end if;
  if pts is null or pts <= 0 then raise exception 'invalid amount'; end if;
  update public.profiles
    set points_balance = points_balance - pts,
        total_redemptions = total_redemptions + 1
    where id = uid and points_balance >= pts
    returning points_balance into new_bal;
  if new_bal is null then raise exception 'insufficient balance'; end if;
  insert into public.transactions(user_id, points_delta, points_balance_after,
      transaction_type, notes)
    values (uid, -pts, new_bal, 'redeem', 'Redeemed reward')
    returning * into tx;
  return tx;
end $$;

-- MANUAL ADJUSTMENT (admin, signed, reason required).
create or replace function public.adjust_points(
  target uuid, delta integer, reason text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare new_bal integer; tx public.transactions;
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized' using errcode='42501'; end if;
  if delta = 0 then raise exception 'delta must be non-zero'; end if;
  if reason is null or length(trim(reason)) = 0 then raise exception 'reason required'; end if;
  update public.profiles
    set points_balance = greatest(points_balance + delta, 0)
    where id = target returning points_balance into new_bal;
  if new_bal is null then raise exception 'unknown user'; end if;
  insert into public.transactions(user_id, points_delta, points_balance_after,
      transaction_type, staff_id, notes)
    values (target, delta, new_bal, 'adjustment', auth.uid(), reason)
    returning * into tx;
  perform public.write_audit('adjust_points', target, delta, reason);
  return tx;
end $$;

-- Rotate a user's QR token (self or admin).
create or replace function public.rotate_qr_token(target uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := coalesce(target, auth.uid()); newtok uuid;
begin
  if uid <> auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode='42501'; end if;
  update public.profiles set qr_token = gen_random_uuid()
    where id = uid returning qr_token into newtok;
  return newtok;
end $$;
```

### 4.6 rewards_config (single source of business rules)
```sql
create table public.rewards_config (
  id                 integer primary key default 1 check (id = 1),  -- singleton
  points_per_dollar  integer not null default 1,
  redeem_threshold   integer not null default 100,   -- points needed
  redeem_value_cents integer not null default 1000,  -- $10 off
  stamps_per_card    integer not null default 10,     -- visual stamp count
  updated_at         timestamptz not null default now()
);
insert into public.rewards_config (id) values (1) on conflict do nothing;

alter table public.rewards_config enable row level security;
create policy "rewards_config_public_read" on public.rewards_config for select using (true);
-- updates via admin only (server action with service role or admin-guarded fn).
```

### 4.7 menu_categories / menu_items
```sql
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique,
  sort_order integer not null default 0, active boolean not null default true
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null, description text, price_cents integer not null check (price_cents >= 0),
  image_url text, dietary_tags text[] default '{}', sort_order integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now()
);
create index menu_items_category_idx on public.menu_items(category_id, sort_order);

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
create policy "menu_cat_public_read" on public.menu_categories for select using (active);
create policy "menu_item_public_read" on public.menu_items for select using (active);
-- writes via admin (service role / admin-guarded action).
```

### 4.8 audit_log
```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null, target_id uuid, delta integer, reason text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);

create or replace function public.write_audit(action text, target uuid, delta integer, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(actor_id, action, target_id, delta, reason)
  values (auth.uid(), action, target, delta, reason);
end $$;

alter table public.audit_log enable row level security;
create policy "audit_admin_read" on public.audit_log for select using (public.is_admin(auth.uid()));
```

### 4.9 Analytics (admin RPCs / views)
```sql
-- Example admin-only aggregate. Guard inside the function.
create or replace function public.admin_analytics()
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin(auth.uid()) then raise exception 'not authorized' using errcode='42501'; end if;
  select json_build_object(
    'total_customers', (select count(*) from public.profiles where not is_admin),
    'active_30d', (select count(distinct user_id) from public.transactions
                    where created_at > now() - interval '30 days'),
    'points_outstanding', (select coalesce(sum(points_balance),0) from public.profiles),
    'points_issued', (select coalesce(sum(points_delta),0) from public.transactions where transaction_type='earn'),
    'redemptions', (select count(*) from public.transactions where transaction_type='redeem')
  ) into result;
  return result;
end $$;
```

---

## 5. API Contracts

> Prefer **Server Actions** for mutations from the app's own UI (typed, no manual fetch, CSRF-safe). Use **Route Handlers** (`app/api/*`) for things needing HTTP semantics: rate-limited auth, webhooks, health checks. Every input is Zod-validated; every error returns a safe message + proper status.

### 5.1 Zod schemas (shared client + server — `src/schemas/`)
```ts
// schemas/auth.ts
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60).optional(),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const resetRequestSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ password: z.string().min(8).max(72) });

// schemas/rewards.ts
export const redeemSchema = z.object({ points: z.number().int().positive() });

// schemas/admin.ts
export const addPointsSchema = z.object({
  qrToken: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  amountCents: z.number().int().positive().max(100000).optional(), // purchase $
  points: z.number().int().positive().max(100000).optional(),
  notes: z.string().max(280).optional(),
}).refine(d => d.qrToken || d.userId, 'must identify a user')
  .refine(d => d.amountCents || d.points, 'must provide amount or points');
export const adjustSchema = z.object({
  userId: z.string().uuid(), delta: z.number().int().refine(n => n !== 0),
  reason: z.string().min(3).max(280),
});
export const resolveTokenSchema = z.object({ qrToken: z.string().uuid() });
```

### 5.2 Server Actions
```ts
// actions/auth.ts
signupAction(input)        // validate → supabase.auth.signUp → redirect verify-email
loginAction(input)         // validate → signInWithPassword → redirect next|dashboard
logoutAction()             // signOut → redirect /
requestResetAction(input)  // resetPasswordForEmail
updatePasswordAction(input)// updateUser({password})

// actions/rewards.ts
redeemPointsAction(input: RedeemInput)   // rpc('redeem_points', {pts}) → {newBalance, txId}

// actions/admin.ts   (each re-checks admin server-side)
resolveQrTokenAction(input)              // service/admin → {userId, displayName, balance}
addPointsAction(input: AddPointsInput)   // compute pts from amount via rewards_config → rpc('add_points')
adjustPointsAction(input: AdjustInput)   // rpc('adjust_points')
getAnalyticsAction()                     // rpc('admin_analytics')
listCustomersAction({search,cursor})     // admin read
rotateQrAction({target?})                // rpc('rotate_qr_token')

// actions/account.ts
deleteAccountAction()      // purge: service-role delete auth user (cascade) — Phase 10 finalizes
exportMyDataAction()       // assemble profile + transactions → downloadable JSON
```

**Server action contract:** return a discriminated result `{ ok: true, data } | { ok: false, error }` (never throw raw to the client); validate with Zod at the top; re-derive identity from the session, never trust a client-passed user id for the *current* user.

### 5.3 Route Handlers (`app/api/`)
```
POST /api/auth/login          # rate-limited wrapper (5/min/IP) → delegates to action logic
POST /api/auth/signup         # rate-limited (5/min/IP)
POST /api/auth/reset          # rate-limited
GET  /api/health              # {status:'ok'} for uptime checks
GET  /auth/callback           # OAuth code exchange (route.ts), sets session cookie
```
Each returns JSON `{ ok, data?, error? }` with status 200/400/401/403/429/500 appropriately.

### 5.4 Earn computation (one place — `lib/rewards.ts`)
```ts
// amountCents → points using rewards_config.points_per_dollar
export function pointsForAmount(amountCents: number, cfg: RewardsConfig) {
  return Math.floor((amountCents / 100) * cfg.points_per_dollar);
}
export function progressToNextReward(balance: number, cfg: RewardsConfig) {
  const within = balance % cfg.redeem_threshold;
  return { filled: Math.round((within / cfg.redeem_threshold) * cfg.stamps_per_card),
           percent: (within / cfg.redeem_threshold) * 100,
           toNext: cfg.redeem_threshold - within };
}
```

---

## 6. Realtime

- Client island on the dashboard subscribes to `postgres_changes` on `public.profiles` filtered to `id=eq.<uid>` (anon key, RLS guarantees the user only sees their own row).
- On UPDATE → update local card state → trigger stamp-fill / ring-advance animation + haptic.
- Subscription cleaned up on unmount; reconnect handled by supabase-js.
- Admin scan flow relies on this: after `add_points`, the customer's card updates without refresh.

---

## 7. Auth & Session

- `@supabase/ssr` cookie-based sessions. `middleware.ts` calls the session-refresh helper on every matched route and enforces:
  - `(user)/*` and `(admin)/*` require a session → else redirect `/login?next=<path>`.
  - `(admin)/*` additionally requires `is_admin` (read via a lightweight RSC/server check) → else redirect `/dashboard`.
  - Authenticated user on `(auth)/*` → redirect `/dashboard`.
- Providers: email/password (confirmation on), Google OAuth, Apple Sign-In. Redirect URLs registered for `localhost:3000`, the Vercel preview pattern, and prod domain.
- OAuth callback at `/auth/callback` exchanges code → session; the `handle_new_user` trigger ensures a profile exists.

---

## 8. Component Architecture (key contracts)

```ts
// rewards
<ProgressRing progress={0..100} size={number} strokeWidth={number} />      // a11y: role=progressbar
<StampGrid total={cfg.stamps_per_card} filled={n} animateIndex={number?} />
<RewardsCard balance={n} config={RewardsConfig} recent={Tx[]} />            // RSC fetch → client island
<RedeemDialog eligible={boolean} value="$10 off" onConfirm={() => redeemPointsAction()} />

// qr
<QRDisplay token={string} />                  // white bg always, EC=H, ≥200px
<QRScanner onResolved={(c:Customer)=>void} /> // admin only; camera + manual fallback

// menu
<MenuItem item={MenuItem} />                  // next/image 16:9, blur placeholder
<CategoryNav categories={Category[]} />       // sticky segmented control

// common
<Mascot expression="welcome|celebrate|empty|error" />
<EmptyState mascot copy cta? />
<BottomTabBar />                              // Dashboard · Menu · QR · Profile (+ Admin if is_admin)
```

State strategy: server data via RSC props; ephemeral UI state local; realtime via a small client hook (`useProfileRealtime`); forms via `react-hook-form` + Zod resolver; toasts via sonner.

---

## 9. Animation Specifications

| Animation | Duration | Easing | Notes |
|-----------|----------|--------|-------|
| Stamp fill | 400ms | `spring(damping 15, stiffness 300)` | scale 1.2→1.0, outline→`--dc-red`, light haptic |
| Progress ring advance | 600ms | easeInOut | animate `strokeDashoffset` |
| Milestone (every reward) | — | — | medium haptic `[10,50,10]` |
| Reward unlock celebration | ~1.2s | spring | confetti + scale pulse + success haptic `[10,50,10,50,10]` + optional sound |
| Page enter | 300ms | easeOut | opacity 0→1, y 20→0 |

All gated by `prefers-reduced-motion: reduce` → instant/none. Presets in `lib/motion.ts`:
```ts
export const springGentle = { type:'spring', damping:20, stiffness:300 };
export const springStiffer = { type:'spring', damping:15, stiffness:400 };
export const springBouncy  = { type:'spring', damping:10, stiffness:300 };
```

---

## 10. Deployment Strategy

### 10.1 Environments & env vars
```
# .env.example  (commit this with empty values)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # SERVER ONLY — never NEXT_PUBLIC
NEXT_PUBLIC_APP_URL=                # http://localhost:3000 | https://<prod>
NEXT_PUBLIC_MAPS_EMBED=             # Google Maps Embed (keyless iframe src) or restricted key
UPSTASH_REDIS_REST_URL=            # or Vercel KV — rate limiting
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=                         # optional, error monitoring
# OAuth/Apple configured in Supabase dashboard, not app env
```
`lib/env.ts` validates these with Zod at boot and fails fast. `NEXT_PUBLIC_*` are the only client-exposed vars.

| Var | Dev | Preview | Prod |
|-----|-----|---------|------|
| SUPABASE_URL/ANON | dev project | dev/staging | prod project |
| SERVICE_ROLE | dev | staging | prod (Vercel encrypted) |
| APP_URL | localhost:3000 | vercel preview URL | prod domain |
| OAuth redirect URLs | localhost | preview pattern | prod domain |

### 10.2 CI/CD (Vercel)
1. Push branch → Vercel preview deploy; `main` → production.
2. Pipeline checks (block merge on failure): `tsc --noEmit`, ESLint, `next build`, unit tests, Lighthouse CI (≥90), Playwright critical-flow E2E.
3. DB migrations applied via Supabase CLI (`supabase db push`) or dashboard, tracked in migration history; never hand-edit prod schema.
4. Secrets in Vercel encrypted env (per-environment). Service-role key only in Server/Edge, never exposed.

### 10.3 Supabase setup
- One project per environment (or branch DBs for preview). Apply migrations + seed. Promote first admin via SQL (`update profiles set is_admin=true where email=...`). Enable email confirmation + leaked-password protection. Configure Google + Apple providers with correct redirect URLs.

### 10.4 Security headers (`next.config.ts`)
```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-<...>';
  connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co;
  img-src 'self' data: blob: https://<supabase-storage> https://*.googleapis.com;
  frame-src https://www.google.com;            # maps embed
  style-src 'self' 'unsafe-inline';            # tailwind/shadcn
  font-src 'self' data:;
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self)             # scanner only
X-Frame-Options: DENY  (or frame-ancestors 'none')
```
Tune iteratively in Phase 10 — Supabase realtime (wss), Maps (frame-src), and the QR libs each need allowances.

### 10.5 Provisioned environments (filled in as phases land)

| Environment | Supabase project | Ref | API URL | Status |
|-------------|------------------|-----|---------|--------|
| **Dev / shared** | `don-carlos-rewards` | `uxgcyvexeehvhtuhmztc` | `https://uxgcyvexeehvhtuhmztc.supabase.co` | ✅ Phase 2 — schema + RLS + seed applied |
| Preview | _(branch DB — Phase 12)_ | — | — | pending |
| Prod | _(separate project — Phase 12)_ | — | — | pending |

- **Org:** `HVAC SIdekick` (`kvqiifcghpaaaqfdghft`), region `us-west-1`, free tier ($0/mo), Postgres 17.
- **Anon key** lives in `.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The **service-role key** is secret — fetch from the dashboard API settings and store server-side only (`SUPABASE_SERVICE_ROLE_KEY`), never `NEXT_PUBLIC_*`.
- Migrations are versioned in `supabase/migrations/`; seed in `supabase/seed.sql`. Applied to the dev project via the Supabase management API in Phase 2.

> **Phase 2 deviation (documented):** the §4.3 guard trigger was hardened to gate on a transaction-local GUC flag (`app.points_ctx`) set only by the trusted SECURITY DEFINER functions, instead of on the caller's admin status. The BLUEPRINT version would have frozen `points_balance`/`qr_token` during `redeem_points`/`rotate_qr_token` (non-admin caller updating their own row), silently breaking those flows. The flag-based guard is strictly stronger: no client — not even a raw service-role `UPDATE` — can write points outside the audited functions. See `PHASE_2_TASK.md` §3.

---

## 11. Testing Strategy

- **Unit (Jest + RTL):** `lib/rewards.ts` math, Zod schemas, component render/states (empty/loading/error), formatting.
- **Integration (DB):** RLS policy tests (cross-user denial), points functions (atomicity, auth checks, insufficient balance, admin-only), trigger bootstrap.
- **E2E (Playwright):** signup→verify→login (each provider), earn-via-scan (mock camera / inject token), live card update, redeem + celebration, transaction history, menu browse, about, admin scan/adjust/analytics, account deletion. Run against preview in CI; run on prod in the Phase 12 launch audit.
- **Visual/regression (optional):** Chromatic/Percy on rewards card + menu in both modes.
- **Performance:** Lighthouse CI gate ≥90; manual throttled mid-range device check for the budget.
- **Real-device:** camera scanning must be tested on a physical iOS + Android device (Phase 5).

---

## 12. Security Checklist (gate for Phase 10/12)

- [ ] RLS enabled + policy-tested on **every** public table.
- [ ] Points columns unwritable by clients (guard trigger + no INSERT policy on transactions).
- [ ] All points changes via SECURITY DEFINER fns; admin-only fns reject non-admins.
- [ ] Zod validation on every action, route handler, webhook.
- [ ] Service-role key server-only; absent from client bundle (grep verified).
- [ ] Rate limiting on auth (5/min/IP) + admin add-points throttle.
- [ ] CSP + HSTS + nosniff + referrer + permissions-policy + frame protection set.
- [ ] CORS limited to prod/preview domains.
- [ ] Leaked-password protection (HIBP) on; email confirmation required.
- [ ] Account deletion purges data; data-export available.
- [ ] Privacy Policy + TOS published and linked.
- [ ] Audit log records every admin mutation with actor.
- [ ] `supabase get_advisors` (security + performance) clean or justified.

---

## 13. Open Technical Questions (carry into PHASE_0_COMPLETE)

- **O-1 Apple Sign-In credentials** — needs Apple Developer account (Service ID + key). Available?
- **O-2 Exact brand hex + mascot SVG + logo** — using DESIGN_SYSTEM placeholders (`#E63946/#F9C74F/#90BE6D`) until provided.
- **O-3 Real food photography** — seeding with placeholders; need final assets for menu polish.
- **O-4 Rewards model reconciliation** — points (100pts=$10) vs the 10-stamp visual. Treated as: 10 stamps map to the 100-point threshold (1 stamp = 10 pts). Confirm.
- **O-5 Maps key vs keyless embed** — defaulting to keyless Embed iframe; confirm acceptable.
- **O-6 Rate-limit store** — Upstash Redis vs Vercel KV. Pick one before Phase 10.
- **O-7 Multi-staff / multi-location** — out of scope for v1; confirm single location.

---

*End of BLUEPRINT.md — see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) for the full visual + interaction system before building UI.*
