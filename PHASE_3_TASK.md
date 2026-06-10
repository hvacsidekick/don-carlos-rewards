# Phase 3 — Authentication — BUILD TASK / SCOPE

**Project:** Don Carlos Rewards App
**Phase:** 3 of 12 — Authentication (email/password + OAuth + Apple)
**Role:** Builder
**Date:** 2026-06-09
**Depends on:** Phase 1 (✅ Verified), Phase 2 (✅ Verified — DB schema, RLS, triggers, points fns)
**References read:** `PLAN.md` §Phase 3 · `BLUEPRINT.md` §7 (Auth & Session), §1–2, §4 (schema), §5 (API contracts), §10.4 (headers) · `DESIGN_SYSTEM.md` §5.11 (forms), §5.10 (buttons), §9 (a11y), §13 (copy)

---

## 1. Objective

Complete authentication for the rewards app: email/password signup+login with email
confirmation, Google OAuth + Apple Sign-In (provider-agnostic code + dashboard docs),
cookie-based SSR sessions refreshed by middleware, route guards for `(user)`/`(admin)`
groups, an auth context provider with `useUser`/`useProfile` hooks, QR-token utilities,
and an account-deletion stub. Profile rows are created **atomically** with `auth.users`
by the Phase-2 trigger (verified live); `qr_token` is unique + indexed (verified live).

---

## 2. Pre-flight verification (done before building)

Confirmed against the **live** dev DB `uxgcyvexeehvhtuhmztc`:

| Dependency | Status | Evidence |
|---|---|---|
| `on_auth_user_created` trigger → `public.handle_new_user()` on `auth.users` | ✅ present | `pg_trigger` query |
| `public.profiles` row auto-created with `qr_token` default `gen_random_uuid()` | ✅ schema | `database.types.ts` + migration `..._profiles.sql` |
| `qr_token` **unique** | ✅ `profiles_qr_token_key` | `pg_index` query |
| `qr_token` **indexed** | ✅ `profiles_qr_token_idx` | `pg_index` query |
| Column guard freezes `points_balance`/`is_admin`/`qr_token` from client writes | ✅ `trg_guard_profile_update` | Phase 2 verified |
| RLS: user reads/updates own profile (non-sensitive cols only) | ✅ | Phase 2 verified |

> **Conclusion:** the CRITICAL requirements ("profile row created atomically with auth.users",
> "qr_token unique+indexed") are **already satisfied by Phase 2**. Phase 3 does **not** recreate
> them — it consumes them, re-verifies post-build with a live signup, and documents them.

---

## 3. Scope (what Phase 3 builds)

### 3.1 Supabase client factories (`src/lib/supabase/`)
- `client.ts` — browser client (`createBrowserClient`, anon key) for client islands / OAuth.
- `server.ts` — server client (`createServerClient`, cookie-bound) for RSC + server actions.
- `service.ts` — service-role client, **server-only** (guarded against client import) for admin
  ops + account deletion (bypasses RLS).
- `middleware.ts` — `updateSession()` helper that refreshes the auth cookie on every request.

### 3.2 Middleware + route guards
- `src/middleware.ts` — refresh session, then:
  - `(user)` prefixes require a session → else `307 → /login?next=<path>`.
  - `(admin)` prefixes require session **and** `is_admin` → else `→ /dashboard`.
  - authenticated user hitting `login`/`signup`/`forgot-password` → `→ /dashboard`.
  - `reset-password` + `verify-email` always reachable (recovery/notice flows need them).
- `src/lib/auth-routes.ts` — single source of the public/user/admin path lists (shared by
  middleware; route groups are URL-transparent so guards key off path prefixes).

### 3.3 Zod schemas (`src/schemas/auth.ts`)
`signupSchema`, `loginSchema`, `resetRequestSchema`, `resetSchema` (new password + confirm,
refined-equal), `updateProfileSchema`. Shared by client form + server action (single source).

### 3.4 Server actions (`src/actions/`)
`auth.ts` (all Zod-validated, return `{ ok:true, data } | { ok:false, error }`, never throw raw):
- `signUpAction` → `supabase.auth.signUp` (email confirm) → redirect `/verify-email`.
- `signInAction` → `signInWithPassword` → redirect `next | /dashboard`.
- `signOutAction` → `signOut` → redirect `/`.
- `resetPasswordAction` → `resetPasswordForEmail` (request link) → success notice.
- `updatePasswordAction` → `updateUser({ password })` (from recovery session).
- `updateProfileAction` → update `profiles.display_name` (RLS + guard-trigger safe).

`account.ts`:
- `deleteAccountAction` → service-role `auth.admin.deleteUser` (cascades profile/tx). Stub
  per PLAN; full GDPR purge finalized in Phase 10.

### 3.5 Auth route handlers (`src/app/auth/`)
- `callback/route.ts` — OAuth PKCE `exchangeCodeForSession` → redirect `next`.
- `confirm/route.ts` — email `verifyOtp({ token_hash, type })` for signup confirmation +
  password recovery → redirect `next`.
- `auth-code-error/page.tsx` — friendly failure page (no dead end).

### 3.6 Pages — `(auth)` group (public)
`login`, `signup`, `forgot-password`, `reset-password`, `verify-email` + `(auth)/layout.tsx`.
Apple-level UI per DESIGN_SYSTEM: inline field errors (`aria-invalid`/`aria-describedby`/
`role="alert"`), disabled-while-submitting, loading spinners, friendly copy, mascot on
verify/error, OAuth buttons (Google + Apple), light + dark, ≥44pt targets, keyboard-reachable.

> **Route naming decision (documented deviation from the task prompt's "/auth/sign-in…"):**
> follow `BLUEPRINT.md` §2 canonical routes — `/login`, `/signup`, `/forgot-password`,
> `/reset-password`, `/verify-email`, `/auth/callback`, `/auth/confirm`. Rationale:
> BLUEPRINT is the authoritative technical contract, `PLAN.md` Phase-3 acceptance criteria
> explicitly test `/login?next=`, and downstream phases reference these paths. The task's
> "sign-in/sign-up" is the conceptual description; canonical slugs win for compatibility.

### 3.7 Pages — `(user)` group (protected)
- `(user)/layout.tsx` — defense-in-depth server session check (beyond middleware).
- `(user)/dashboard/page.tsx` — **minimal placeholder** (Phase 4 builds the real RewardsCard);
  exists so login redirect + protected-route tests pass.
- `(user)/profile/page.tsx` — profile summary, `updateProfile` form, QR-token (opaque) display
  via `lib/qr.ts`, rotate-token action, sign-out, delete-account (destructive confirm).

### 3.8 Auth context provider + hooks
- `src/components/auth/AuthProvider.tsx` (client) — holds `{ user, profile, loading }`, seeds
  from server-fetched initial values (no flash), re-syncs on `onAuthStateChange`. Exposes
  `useUser()`, `useProfile()`, `useAuth()`.
- `src/lib/auth/get-server-auth.ts` — server helper returning `{ user, profile }` for layouts.
- `src/components/Providers.tsx` — client wrapper mounting `AuthProvider` in the root layout.

### 3.9 QR-token utilities (`src/lib/qr.ts`)
- `isQrToken(value)` — UUID guard. `maskQrToken(token)` — privacy-safe display (`••••1234`).
- `qrPayloadForToken(token)` — opaque payload string (token only, **no PII** — BLUEPRINT §1).
- `rotateQrTokenAction` wrapper note (RPC `rotate_qr_token`, built here for profile page).
> Full QR **image** rendering (`QRDisplay`) + scanner are Phase 5; Phase 3 ships token utils
> + opaque payload so the profile page can surface the rotatable token.

### 3.10 Supabase Auth configuration (dashboard — documented, partially manual)
- Enable **email confirmations** (Confirm signup) + secure confirmation/recovery redirect URLs.
- Customize email templates (Confirm signup, Magic Link, Recovery) with **Don Carlos branding**
  (provided as ready-to-paste HTML in `PHASE_3_BUILD_COMPLETE.md`).
- Register redirect URLs: `http://localhost:3000/**`, Vercel preview pattern, prod domain.
- **Google OAuth** + **Apple Sign-In** provider config (Client ID/secret, Service ID/key).

> **Provisioning constraint / open questions:** provider OAuth credentials (Google client,
> Apple Service ID + key — **O-1**) and the dashboard auth toggles require the Supabase
> dashboard / management access token, which is not available to this build agent
> programmatically. The **code is provider-agnostic and complete**; enabling Google/Apple and
> flipping email-confirmation are documented dashboard steps. Apple is flagged blocked (O-1)
> per `PLAN.md` R-3 — email + Google ship first; Apple wires in with zero code change.

---

## 4. Out of scope (do NOT pull forward)
- Rate limiting on auth endpoints (Phase 10).
- Real dashboard content / RewardsCard / realtime card updates (Phase 4).
- QR image rendering + camera scanner (Phase 5).
- Full GDPR purge + data export + Privacy/TOS pages (Phase 10).
- Admin portal screens (Phase 9).
- CSP / security headers (Phase 10) — `next.config.ts` left as Phase-1 stub.

---

## 5. Acceptance criteria (from PLAN.md §Phase 3)
- [ ] New user signs up → receives verification email → confirms → lands on dashboard.
- [ ] Login/logout works; session persists across reload, refreshed by middleware.
- [ ] Forgot/reset password works end-to-end.
- [ ] Google + Apple sign-in complete the callback and a `profiles` row exists (trigger).
- [ ] `(user)` route while logged out → `/login?next=`; after login returns to `next`.
- [ ] Non-admin hitting `(admin)` route is redirected (not 500).
- [ ] All auth forms Zod-validate; invalid input → accessible inline errors (SR-announced).
- [ ] No service-role key in client bundle (grep build output — absent).
- [ ] `tsc --noEmit`, `next build`, ESLint all clean; light + dark verified.

## 6. Critical correctness properties (must hold)
1. Profile row created **atomically** with `auth.users` (Phase-2 trigger — re-verified post-build via live signup).
2. `qr_token` **unique + indexed** (Phase-2 — verified live).
3. `SUPABASE_SERVICE_ROLE_KEY` **never** reachable from a `"use client"` module (server-only import guard + bundle grep).
4. Trust boundary = server: every guard re-checked in middleware **and** server layout; UI hiding is never the only control.

## 7. Deliverable
`PHASE_3_BUILD_COMPLETE.md` — build report, self-check vs acceptance criteria, dashboard
config + branded email templates, deviations/open questions, handoff to Auditor.
