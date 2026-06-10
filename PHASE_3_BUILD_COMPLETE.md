# Phase 3 — Authentication — BUILD COMPLETE ✅ (Builder handoff to Auditor)

**Project:** Don Carlos Rewards App
**Phase:** 3 of 12 — Authentication (email/password + OAuth + Apple)
**Role:** Builder
**Date:** 2026-06-09
**Status:** **Build complete — ready for hostile Audit**
**Depends on:** Phase 1 ✅ Verified · Phase 2 ✅ Verified (DB schema, RLS, triggers, points fns)
**Branch (intended):** `phase/3-auth`

---

## 1. Summary

Implemented complete authentication: email/password signup+login with email confirmation,
Google + Apple OAuth (provider-agnostic code), cookie-based SSR sessions refreshed by
middleware, `(user)`/`(admin)` route guards, an auth context provider with `useUser`/
`useProfile`, QR-token utilities, profile management, and an account-deletion stub.

`npm run build`, `tsc --noEmit`, and ESLint are all **clean**. Core flows were live-verified
against the dev DB and a running dev server (see §6).

**One dependency change (documented, §7 D-1):** upgraded `@supabase/ssr` `0.6.1 → 0.12.0` to
fix a type-compat bug (typed writes/subset-selects resolved to `never` against `@supabase/
supabase-js@2.108`). Build + types clean after upgrade.

---

## 2. Files created / changed

### Supabase clients (`src/lib/supabase/`)
- `client.ts` — browser client (anon).
- `server.ts` — cookie-bound server client (RSC + actions).
- `service.ts` — **server-only** service-role client (`import "server-only"` guard).
- `middleware.ts` — `updateSession()` + route guards.

### Middleware / config
- `src/middleware.ts` — root middleware (matcher excludes static assets; passes auth routes).
- `src/lib/auth-routes.ts` — user/admin/auth path-prefix rules (single source).

### Schemas / helpers
- `src/schemas/auth.ts` — `signup/login/resetRequest/reset/updateProfile` Zod schemas.
- `src/lib/action-result.ts` — discriminated `ActionResult<T>`.
- `src/lib/site-url.ts` — `siteUrl()` + `safeNextPath()` (open-redirect guard).
- `src/lib/qr.ts` — `isQrToken` / `qrPayloadForToken` / `maskQrToken`.
- `src/lib/auth/get-server-auth.ts` — server `{ user, profile }` snapshot (server-only).

### Server actions
- `src/actions/auth.ts` — `signUpAction`, `signInAction`, `signOutAction`, `resetPasswordAction`,
  `updatePasswordAction`, `updateProfileAction`, `rotateQrTokenAction`.
- `src/actions/account.ts` — `deleteAccountAction` (service-role; stub per PLAN).

### Auth route handlers
- `src/app/auth/callback/route.ts` — OAuth + email-link PKCE code exchange.
- `src/app/auth/confirm/route.ts` — email `verifyOtp` (token_hash) for signup/recovery.
- `src/app/auth/auth-code-error/page.tsx` — friendly failure page.

### Pages — `(auth)` group
- `login`, `signup`, `forgot-password`, `reset-password`, `verify-email`.

### Pages — `(user)` group
- `layout.tsx` (server session re-check), `dashboard/page.tsx` (Phase-4 placeholder),
  `profile/page.tsx`.

### Auth components (`src/components/auth/`)
- `AuthProvider.tsx` (`useUser`/`useProfile`/`useAuth`), `AuthShell`, `AuthFormError`,
  `OrDivider`, `OAuthButtons`, `LoginForm`, `SignupForm`, `ForgotPasswordForm`,
  `ResetPasswordForm`, `ResendEmailButton`, `ProfileForm`, `QrTokenCard`, `SignOutButton`,
  `DeleteAccountButton`.

### Updated existing
- `src/app/layout.tsx` — seeds `AuthProvider` from server auth.
- `src/components/nav/BottomTabBar.tsx` — hidden when signed out; Admin tab for `is_admin`.
- `package.json` / lockfile — `@supabase/ssr@^0.12.0`.

---

## 3. Acceptance criteria self-check (PLAN.md §Phase 3)

| Criterion | Status | Evidence |
|---|---|---|
| Sign up → verification email → confirm → dashboard | ⚠️ partial | Code complete + trigger live-verified; full email round-trip needs dashboard email-confirm ON + a real inbox (§4). |
| Login/logout works; session persists, refreshed by middleware | ✅ | Middleware `updateSession` + `getUser` revalidation; logout via server action. |
| Forgot/reset password end-to-end | ✅ (UI+action) | Live-tested success state; recovery link → `/auth/callback` → `/reset-password` → `updatePasswordAction`. |
| Google + Apple complete callback, create `profiles` row | ⚠️ code-complete | Provider-agnostic OAuth + callback built; **enabling creds is a dashboard step** (§4, O-1). Trigger creates profile (live-verified). |
| `(user)` route while logged out → `/login?next=`; returns to `next` | ✅ | **Live:** `/dashboard` → `/login?next=%2Fdashboard`. `safeNextPath` returns post-login. |
| Non-admin on `(admin)` route redirected (not 500) | ✅ | Middleware queries `is_admin`; non-admin → `/dashboard` (logged-out → `/login`, live-verified). |
| All auth forms Zod-validate; accessible inline errors (SR-announced) | ✅ | **Live:** empty signup → `aria-invalid` + `role="alert"` per field. |
| No service-role key in client bundle | ✅ | **Grep:** secret value absent from `.next/static`; only the env-var *name* in `lib/env.ts` strings + an `undefined` `process.env` ref. `service.ts` is `import "server-only"`. |
| `tsc`, `build`, ESLint clean; light + dark verified | ✅ | All green; login verified light + dark (screenshots). |

---

## 4. Supabase dashboard configuration (REQUIRED before launch / by deployer)

The application code is complete and provider-agnostic. The following are **dashboard / management-API
steps** the build agent cannot perform programmatically (no dashboard access token). Project ref:
`uxgcyvexeehvhtuhmztc`.

### 4.1 Email confirmation + URLs (Auth → Providers → Email; Auth → URL Configuration)
- **Enable "Confirm email"** (Email provider) so signups must verify.
- **Site URL:** `http://localhost:3000` (dev) / Vercel prod domain (Phase 12).
- **Redirect URLs (allow-list):**
  - `http://localhost:3000/**`
  - `https://*-<your-team>.vercel.app/**` (preview pattern)
  - `https://<prod-domain>/**`
- Enable **leaked-password protection (HIBP)** + a sane password policy (finalized Phase 10).

### 4.2 Email templates — Don Carlos branding (Auth → Email Templates)
The default `{{ .ConfirmationURL }}` works with `/auth/callback` (code flow) — paste the branded
HTML below into **Confirm signup** and **Reset password** (adjust copy). It degrades gracefully and
uses brand red `#C32A37` (the AA fill) on a neutral card.

```html
<!-- Confirm signup -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1c1e;">
  <h1 style="font-size:22px;font-weight:700;color:#C32A37;margin:0 0 8px;">Don Carlos 🌮</h1>
  <h2 style="font-size:20px;font-weight:600;margin:16px 0 8px;">Confirm your email</h2>
  <p style="font-size:15px;line-height:1.5;color:#3c3c43;">
    Welcome! Tap the button below to activate your rewards account and start earning on every visit.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;margin:20px 0;padding:12px 24px;background:#C32A37;color:#fff;
            text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;">
    Confirm my email
  </a>
  <p style="font-size:13px;color:#8e8e93;line-height:1.5;">
    If you didn't create a Don Carlos Rewards account, you can ignore this email.
  </p>
</div>
```

```html
<!-- Reset password -->
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1c1e;">
  <h1 style="font-size:22px;font-weight:700;color:#C32A37;margin:0 0 8px;">Don Carlos 🌮</h1>
  <h2 style="font-size:20px;font-weight:600;margin:16px 0 8px;">Reset your password</h2>
  <p style="font-size:15px;line-height:1.5;color:#3c3c43;">
    Tap below to set a new password. This link expires shortly for your security.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;margin:20px 0;padding:12px 24px;background:#C32A37;color:#fff;
            text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;">
    Set a new password
  </a>
  <p style="font-size:13px;color:#8e8e93;line-height:1.5;">
    Didn't request this? Ignore this email and your password stays the same.
  </p>
</div>
```

> **Alternative (token_hash) templates** are also supported by the app via `/auth/confirm`:
> `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`
> (and `type=recovery&next=/reset-password`). Either format works — pick one per template.

### 4.3 Google OAuth (Auth → Providers → Google)
- Create OAuth client in Google Cloud; Authorized redirect URI:
  `https://uxgcyvexeehvhtuhmztc.supabase.co/auth/v1/callback`.
- Paste Client ID + Secret into Supabase. No app code change needed.

### 4.4 Apple Sign-In (Auth → Providers → Apple) — **O-1, may be deferred (R-3)**
- Needs an **Apple Developer account**: Service ID, Team ID, Key ID, `.p8` private key.
- Service ID return URL: `https://uxgcyvexeehvhtuhmztc.supabase.co/auth/v1/callback`.
- If the Apple account is unavailable at build time, **ship email + Google**; the "Continue with
  Apple" button stays but will error until configured — consider hiding it via a feature flag in
  Phase 10/12 if Apple remains blocked. **No code change** required to enable later.

### 4.5 Service-role key (server-only)
`.env.local` currently holds the placeholder `REPLACE_WITH_SERVICE_ROLE_KEY_FROM_DASHBOARD`.
Account deletion (`deleteAccountAction`) needs the real key (Settings → API). All other auth flows
work without it. The key must remain **server-only** (never `NEXT_PUBLIC_*`).

---

## 5. Critical correctness properties — verified

1. **Atomic profile + qr_token on signup** — ✅ live SQL probe: inserting `auth.users` auto-created
   `public.profiles` with `display_name` (from `full_name` meta) + a valid UUID `qr_token`,
   `points_balance=0`, `is_admin=false`. Probe rolled back/cleaned (0 residue).
2. **qr_token unique + indexed** — ✅ Phase 2 live (`profiles_qr_token_key` unique,
   `profiles_qr_token_idx`).
3. **Service-role key never client-reachable** — ✅ `import "server-only"` on `service.ts` +
   `get-server-auth.ts`; bundle grep shows no secret value.
4. **Trust boundary = server** — ✅ guards in middleware **and** `(user)` layout; admin check via
   `is_admin` server-side; `safeNextPath` blocks open redirects; anti-enumeration on signup + reset.

---

## 6. Live verification performed (this build)

- **DB (MCP SQL, dev project):** signup trigger creates profile + qr_token atomically; cascade
  delete removes profile (validates account-deletion path); cleaned to 0 residue.
- **Dev server + Playwright:**
  - `/dashboard` logged-out → `307 /login?next=%2Fdashboard` ✅
  - Login page renders (Google/Apple marks, divider, fields, red CTA) — light + dark ✅
  - Empty signup submit → per-field `aria-invalid` + `role="alert"` messages ✅
  - Bad-credentials sign-in → live Supabase round-trip → friendly "Incorrect email or password."
    banner (icon + `role="alert"`) ✅
  - Forgot-password submit → anti-enumeration "Check your email" `role="status"` ✅
- Screenshots: `phase3-login.png`, `phase3-login-dark.png`, `phase3-login-error.png`.

**Not fully E2E-tested (requires dashboard email-confirm + real inbox / OAuth creds):** the actual
email-confirmation click-through and Google/Apple provider round-trips. Code paths
(`/auth/callback`, `/auth/confirm`, `signUpAction` metadata) are built and unit-consistent with the
verified trigger.

---

## 7. Deviations & open questions

- **D-1 (dependency):** `@supabase/ssr` `0.6.1 → 0.12.0`. *Why:* 0.6.1's `createServerClient`
  generic computed typed writes/subset-selects as `never` against `supabase-js@2.108`, breaking
  `tsc`. Direct `createClient<Database>` was unaffected; upgrade aligns the SSR client. Cookie
  `getAll/setAll` API unchanged. Build/types/lint clean post-upgrade.
- **D-2 (route naming):** used BLUEPRINT canonical slugs (`/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `/verify-email`) rather than the task prompt's "sign-in/sign-up". Rationale in
  `PHASE_3_TASK.md` §3.6 (BLUEPRINT authority + PLAN acceptance tests `/login?next=`).
- **D-3 (scope-needed placeholders):** added a minimal `(user)/dashboard` placeholder so login
  redirects + guard tests work now; Phase 4 replaces it with the RewardsCard.
- **O-1 (Apple Sign-In):** blocked on Apple Developer account (R-3). Email + Google ship first;
  Apple enables with zero code change.
- **Pre-existing (Phase 1) note:** `lib/env.ts`'s `serverSchema`/`getServerEnv` tree-shake into the
  client bundle as dead code (var name + `undefined` `process.env` ref) — **no secret leaks**.
  Optional Phase 10 tidy: lazy-load the server schema. Not a Phase 3 defect.

## 8. Out of scope (correctly deferred)
Rate limiting (P10) · RewardsCard/realtime (P4) · QR image + scanner (P5) · full GDPR purge +
export + Privacy/TOS (P10) · admin screens (P9) · CSP/headers (P10).

---

**Builder sign-off:** build complete, gates green, critical properties live-verified.
**Next:** hostile Auditor pass (functionality/security + Apple-design axes) per PLAN.md §6.
