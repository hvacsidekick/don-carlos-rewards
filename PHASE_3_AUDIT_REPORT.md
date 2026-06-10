# Phase 3 — Authentication — HOSTILE AUDIT REPORT

**Project:** Don Carlos Rewards App
**Phase:** 3 of 12 — Authentication
**Role:** Auditor (independent, adversarial)
**Date:** 2026-06-09
**Auditor target:** `PHASE_3_BUILD_COMPLETE.md`, `PHASE_3_TASK.md`, `PHASE_LOG.md` §Phase 3, full `src/` auth surface, live dev DB `uxgcyvexeehvhtuhmztc`, running dev server (Playwright).

---

## 1. Executive verdict

### Grade: **B+** — strong, mostly-correct build with **one real exploitable security defect** and one unhelpful failure path on the primary signup flow. **Not approved for immediate sign-off.**

The data layer is genuinely solid and was **re-verified live, not taken on faith**: the profile trigger fires atomically on `auth.users` INSERT, seeds `display_name` from `full_name` metadata, defaults a **valid UUID v4 `qr_token`** that is **unique + indexed**, sets `points_balance=0 / is_admin=false`, and cascade-deletes cleanly (0 residue). RLS, the column-guard trigger, and the self/admin-guarded `rotate_qr_token` RPC are all present and correctly wired. Protected-route redirect and accessible Zod form validation both pass live. Sessions are cookie-based via `@supabase/ssr` (no `localStorage`), with `getUser()` JWT revalidation in **both** middleware and the `(user)` layout (defense in depth). Code style, a11y, and visual design are Apple-grade.

**What blocks an A:** the builder explicitly claimed (`PHASE_3_BUILD_COMPLETE.md` §5.4) that `safeNextPath` "blocks open redirects." **It does not** — a backslash bypass survives the filter and is reachable from the post-login redirect sink. That false "verified" security claim plus the live-proven bypass is a Major finding. Separately, real signups currently fail with an unactionable generic error because email-send failures aren't mapped.

**Blocking issues for phase sign-off: 1 (M-1).** Both M-1 and M-2 are small, surgical fixes.

| Area | Result |
|---|---|
| Profile trigger atomicity / qr_token uniqueness | ✅ Verified live |
| Auth flows (protected route, session, logout, reset) | ✅ Code correct; ⚠️ E2E signup blocked on SMTP (deployer) |
| Server-action security (cookies, no service-role leak, CSRF) | ✅ Pass |
| Middleware guards / redirect-loop prevention | ✅ Pass |
| Open-redirect protection | ❌ **Bypass (M-1)** |
| Form validation (Zod + accessible errors) | ✅ Verified live |
| UI/UX quality (design system, a11y, focus/loading states) | ✅ Pass |

---

## 2. Verified-good (evidence)

| Property | Evidence |
|---|---|
| Trigger `on_auth_user_created` → `handle_new_user()` present + enabled | `pg_trigger` query: `tgenabled='O'` |
| **Atomic** profile creation on signup | Live: inserted `auth.users` row → `public.profiles` auto-created with `display_name='Audit Tester'`, `qr_token` v4, `points_balance=0`, `is_admin=false` |
| `qr_token` is **UUID v4, unique, indexed** | Live: token `d8ee4f8a-…-451d-…` matched v4 regex; `profiles_qr_token_key` (unique) + `profiles_qr_token_idx` |
| Cascade delete | Live: `delete from auth.users` → `profile_residue=0, user_residue=0` |
| Column guard + RLS | `trg_guard_profile_update`/`guard_profile_update` present; policies `profiles_select_own`, `profiles_update_own` (with_check `auth.uid()=id`) |
| `rotate_qr_token({})` correctness | Fn signature `target uuid DEFAULT NULL`; body `coalesce(target, auth.uid())` + `auth.uid()`/`is_admin` authz → calling with `{}` resolves to caller. Correct, not a bug. |
| Protected route guard | Live: `GET /dashboard` (logged out) → `302 /login?next=%2Fdashboard` |
| Accessible form validation | Live empty signup: every field `aria-invalid="true"` + `aria-describedby`, per-field `role="alert"` ("Enter your name" / "Email is required" / "Use at least 8 characters") |
| Service-role isolation | `service.ts` + `get-server-auth.ts` use `import "server-only"`; key read lazily via `getServerEnv()` |
| Session model | `@supabase/ssr` cookie store; `getUser()` (not `getSession()`) in middleware + layout |
| CSRF | Next 15 Server Actions enforce Origin/host checks (POST-only, opaque action ids); OAuth = PKCE; `/auth/confirm` = single-use OTP. Acceptable. |
| Type/UI gates | `tsc --noEmit` clean; login renders to spec (screenshot) |

---

## 3. Findings

### CRITICAL — none.

---

### MAJOR

#### M-1 — Open-redirect bypass in `safeNextPath` (reachable post-login) · **BLOCKING**
`src/lib/site-url.ts` rejects `//evil.com` and absolute URLs but **not backslashes**. A browser's URL parser treats `\` as `/` during authority parsing, so a value that passes the filter resolves off-site.

**Proven (file-based repro against the real function):**
```
safeNextPath("/\evil.example.com")  -> "/\evil.example.com"  (passes filter)
new URL("/\evil.example.com", "https://goodsite.com")  -> https://evil.example.com/   <-- OFF-SITE
safeNextPath("/\/evil.example.com") -> passes -> https://evil.example.com/             <-- OFF-SITE
```

**Reachable sink:** `signInAction(input, next)` ends with `redirect(safeNextPath(next))`. `next` is the attacker-controlled `/login?next=` query param. A phishing link `…/login?next=/\evil.example.com` redirects the victim **off-site immediately after a successful login** (CWE-601). The login page already round-trips this value (verified: the "Create an account" link rendered `/signup?next=%2F%5Cevil.example.com`).

**Not vulnerable:** `/auth/callback` and `/auth/confirm` prepend a fixed `origin` (`` `${origin}${next}` ``), so the host stays pinned — backslashes land mid-path. Only the bare `redirect(safeNextPath(next))` in `signInAction` is exploitable.

**Contradicts** `PHASE_3_BUILD_COMPLETE.md` §5.4 ("`safeNextPath` blocks open redirects") and §4 acceptance row ("`safeNextPath` returns post-login").

**Fix (surgical):** reject control chars/backslashes before the prefix check, e.g.
```ts
export function safeNextPath(next, fallback = "/dashboard") {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\x00-\x1f\\]/.test(next)) return fallback;   // no backslashes / control chars
  return next;
}
```
(Or parse with `new URL(next, "http://x.invalid")` and confirm `.origin === "http://x.invalid"`.)

---

#### M-2 — Email-send failures map to an unactionable error; primary signup path currently fails
Live: submitting a valid new signup (`audit-confirm-probe@example.com`) returned **"Something went wrong. Please try again."** and **created no `auth.users` row** (verified empty) — the signature of GoTrue's *"Error sending confirmation email"* (email confirmation is enabled, but the project has no custom SMTP, and Supabase's built-in mailer only delivers to team addresses and is rate-limited).

Two problems:
1. **Code:** `friendlyAuthError()` (`src/actions/auth.ts`) has no branch for email-delivery failures, so this — the single most common real signup failure — falls through to the generic catch-all. The user is told nothing actionable on the app's entry flow.
2. **Deployer/infra:** real email signup **cannot complete** until custom SMTP is configured. The build report documents branded templates and redirect URLs but does **not** call out that the default Supabase mailer makes non-team signups fail. Acceptance criterion #1 (signup → email → confirm → dashboard) remains **unverifiable** end-to-end.

**Fix:** add a mapping, e.g. `if (m.includes("sending") && m.includes("email")) return "We couldn't send your confirmation email right now. Please try again shortly.";` **and** add a deployer note that custom SMTP is required for signups to non-team addresses.

---

### MINOR

- **m-1 — Password change requires no re-authentication.** `/reset-password` is reachable by *any* authenticated session (correctly excluded from the authed-bounce list), and `updatePasswordAction` calls `updateUser({ password })` for **any** valid session — not only a recovery session, and without asking for the current password. A hijacked session can silently change the password and lock the owner out. Common-but-real; consider gating on a recovery/AAL marker or requiring the current password for non-recovery sessions.

- **m-2 — Latent signup enumeration + overstated claim.** `friendlyAuthError` returns *"An account with this email already exists."* If "Confirm email" is ever turned **off**, signup becomes an enumeration oracle. Currently mitigated by Supabase's obfuscation while confirm is on, but `PHASE_3_BUILD_COMPLETE.md` §5.4's "anti-enumeration on signup" is **a Supabase-config property, not a code property** — the code itself would leak. (The reset flow's anti-enumeration *is* genuinely code-enforced — `resetPasswordAction` always returns `ok`.)

- **m-3 — Unvalidated OTP `type` cast.** `src/app/auth/confirm/route.ts` does `searchParams.get("type") as EmailOtpType` with no allow-list. Low risk (`verifyOtp` rejects unknown types) but it's untrusted input cast to a trusted type; an explicit allow-list (`signup|email|recovery`) is cheap.

- **m-4 — Leaked-password protection disabled; weak password policy.** Security advisor: `auth_leaked_password_protection` = WARN (HIBP off). Zod enforces only `min(8)` / `max(72)` — no strength or breach check. Documented for Phase 10, but it means an 8-char known-breached password is accepted today. (Advisor: https://supabase.com/docs/guides/auth/password-security)

- **m-5 — `next` silently dropped on the signup path.** `login`/`signup` thread `?next=` through the UI, but `signUpAction` ignores it (`emailRedirectTo` is hard-coded to `/auth/callback?next=/dashboard`). A user who deep-linked to a protected page and chose "Create an account" always lands on `/dashboard` after confirming — the requested destination is lost. Dead param / minor UX.

### NITS
- `isQrToken` regex accepts any UUID version `[1-9a-f]`, not strictly v4. `gen_random_uuid()` is v4 so it's fine in practice; tighten to `4` if you want it to assert v4.
- Middleware issues a `profiles.is_admin` query on every `(admin)` request — fine (indexed, `profiles_is_admin_idx`), noting for Phase 9 load.
- `SUPABASE_SERVICE_ROLE_KEY` is still the dev placeholder → `deleteAccountAction` fails *gracefully* (verified by code path), but account deletion is non-functional until the real key is set (documented §4.5).

---

## 4. Acceptance criteria vs. live audit

| Criterion | Builder | Auditor |
|---|---|---|
| Signup → email → confirm → dashboard | ⚠️ partial | ⚠️ **Unverifiable** — blocked on SMTP; fails with generic error today (M-2) |
| Login/logout; session persists, middleware refresh | ✅ | ✅ Code correct (cookie/`getUser` verified); full login E2E not run (SQL-seeded users can't auth via GoTrue without identities) |
| Forgot/reset password e2e | ✅ | ✅ code; anti-enumeration success state verified prior; see m-1 |
| Google/Apple callback → profiles row | ⚠️ code-complete | ⚠️ Same — provider creds are a dashboard step; callback host-pinned (safe) |
| `(user)` logged out → `/login?next=` | ✅ | ✅ **Live verified** |
| Non-admin on `(admin)` → redirect (not 500) | ✅ | ✅ Code correct (`.single()`→null→bounce `/dashboard`); logged-out→`/login` |
| Forms Zod-validate; accessible inline errors | ✅ | ✅ **Live verified** (`aria-invalid` + `role="alert"` per field) |
| No service-role key in client bundle | ✅ | ✅ `server-only` guards present (bundle grep trusted from build) |
| Open-redirect protection | (implied ✅ §5.4) | ❌ **Bypassed (M-1)** |
| `tsc`/build/lint clean; light+dark | ✅ | ✅ `tsc` clean; login renders to spec |

---

## 5. Top 3 priorities for the Fixer

1. **M-1 — Close the open-redirect bypass in `safeNextPath`** (reject backslashes / control chars, or validate via `new URL`). This is the single blocking security defect; it defeats a control the build report claims is complete. ~3-line fix + a unit test for `"/\evil.com"`.
2. **M-2 — Map email-send failures to a friendly, actionable message** in `friendlyAuthError`, and document that **custom SMTP is required** before real signups (non-team addresses) can complete. Restores the primary entry flow's UX and unblocks acceptance criterion #1.
3. **m-1 — Require re-auth for password changes** (gate `updatePasswordAction` on a recovery/AAL session or require the current password for normal sessions) — closes the session-hijack → lockout path.

**Verdict: do not approve as-is.** Fix M-1 (blocking) and M-2; m-1 strongly recommended in this phase. The remaining minors/nits can be batched into Phase 10 hardening if explicitly carried forward in `PHASE_LOG.md`.

---

**Live-test residue:** all audit test users removed — `residual_test_users = 0`. No data left behind.
**Auditor sign-off:** independent review complete; DB properties re-proven live, not inherited from the build report.
