# Phase 3 — Authentication — VERIFIER REPORT

**Project:** Don Carlos Rewards App
**Phase:** 3 of 12 — Authentication
**Role:** Verifier (independent sign-off authority)
**Date:** 2026-06-10
**Input:** `PHASE_3_FIXER_REPORT.md`, `PHASE_3_AUDIT_REPORT.md`, live source under `src/`, installed `@supabase/auth-js` type contract, build gates.

---

## 1. Sign-off decision

### ❌ **NOT VERIFIED — Return to Fixer**

Two of the three fixes (M-1, M-2) are **correct and independently verified**. The build gates are **green**. However, the third fix (**m-1, recovery-session gate**) is **functionally broken**: it reads a field (`session.amr`) that does not exist on the Supabase `Session` object, so the predicate is **always false**. The practical effect is that `updatePasswordAction` now **rejects *every* password reset — including legitimate recovery sessions** — which **breaks Phase 3 acceptance criterion #3 (forgot/reset password e2e)**.

This is a **new regression introduced by the fix**, more severe than the original minor (`m-1`) it was meant to close: the prior code at least let legitimate users reset their password; the new code lets *no one* do so. The TypeScript `as` cast hid the defect from `tsc`, which is why the build still passes.

**Phase 3 cannot be signed off until m-1 is corrected (or reverted and deferred).** M-1 and M-2 do not need rework.

| Fix | Result |
|---|---|
| **M-1** — Open-redirect bypass in `safeNextPath` | ✅ **PASS** (verified behaviorally + adversarially) |
| **M-2** — Email-send error mapping | ✅ **PASS** (verified behaviorally + regression-checked) |
| **m-1** — Password-change recovery gate | ❌ **FAIL** (reads non-existent `session.amr`; breaks legit reset) |
| `tsc --noEmit` | ✅ **PASS** (exit 0) |
| `next build` | ✅ **PASS** (exit 0; 16/16 static pages) |

---

## 2. Test results (per fix)

### ✅ M-1 — Open-redirect bypass in `safeNextPath` — **PASS**

**Source verified** (`src/lib/site-url.ts:20-27`): the regex `/[\x00-\x1f\\]/` is present and placed **before** the prefix check, exactly as the audit recommended.

**Behavioral test** — executed the function's exact logic against a **real backslash byte** (not the source-escape form `"/\evil.com"`, which collapses to `/evil.com` — a trap that would falsely pass):

```
PASS | backslash bypass  /\evil.example.com  -> "/dashboard"
PASS | double            /\/evil.example.com -> "/dashboard"
PASS | protocol-relative //evil.com          -> "/dashboard"
PASS | absolute          http://evil.com     -> "/dashboard"
PASS | control char tab  /foo\tbar           -> "/dashboard"
PASS | null byte         /foo\0              -> "/dashboard"
PASS | null input                            -> "/dashboard"
PASS | valid /dashboard                       -> "/dashboard"
PASS | valid /profile?x=1                      -> "/profile?x=1"
PASS | valid /reset-password                   -> "/reset-password"
```

**Adversarial proof (the actual attack):** joined every returned value to an origin via the URL parser — the same parsing the audit used to demonstrate the original bypass. **None resolve off-site:**

```
on-site | /\evil.example.com   -> resolves to https://goodsite.com
on-site | //evil.com           -> resolves to https://goodsite.com
... (all cases) -> https://goodsite.com   (never escapes origin)
```

The reachable sink `signInAction` → `redirect(safeNextPath(next))` (`src/actions/auth.ts:101`) is now safe. `/auth/callback` was already host-pinned (`${origin}${next}`, `route.ts:28-33`) and uses the hardened `safeNextPath` as defense-in-depth. **Verdict: closed.**

> Live login-flow E2E (`?next=/\evil.com` through a real browser) was **not** run: as the auditor noted, SQL-seeded users cannot authenticate via GoTrue, and the redirect is server-side post-auth. The function-level + adversarial-URL proof is conclusive for the exploit, since the sink is literally `redirect(safeNextPath(next))`.

---

### ✅ M-2 — Email-send error mapping — **PASS**

**Source verified** (`src/actions/auth.ts:39-41`): the branch
`if ((m.includes("sending") || m.includes("send")) && m.includes("email"))` returns the actionable message, placed before the generic catch-all.

**Behavioral test** of `friendlyAuthError` against real GoTrue message variants **plus regression checks** on the other branches:

```
PASS | "Error sending confirmation email"  -> "We couldn't send your confirmation email right now. Please try again shortly."
PASS | "Error sending email"               -> (same actionable message)
PASS | "Failed to send confirmation email" -> (same actionable message)
PASS | "Invalid login credentials"         -> "Incorrect email or password."          (regression OK)
PASS | "Email not confirmed"               -> "Please confirm your email first …"      (regression OK)
PASS | "User already registered"           -> "An account with this email already exists. Try signing in." (regression OK)
PASS | "email rate limit exceeded"         -> "Too many attempts. Please wait …"       (regression OK)
PASS | "totally unknown error xyz"         -> "Something went wrong. Please try again." (fallthrough OK)
```

The signup entry-flow now surfaces an actionable message instead of the generic error. **Verdict: closed.** (Deployer task — configure custom SMTP — remains correctly documented in the Fixer report §6; that is infra, not code, and is out of scope for code verification.)

---

### ❌ m-1 — Password-change recovery gate — **FAIL (regression)**

**Source** (`src/actions/auth.ts:157-171`):

```ts
const { data: { session } } = await supabase.auth.getSession();
const amr = (session as { amr?: Array<{ method: string }> })?.amr;
const hasRecoveryFactor = amr?.some((factor) => factor.method === "recovery");
if (!hasRecoveryFactor) {
  return { ok: false, error: "Password changes require a recovery link. …" };
}
```

**Defect: `amr` is not a field on the Supabase `Session` object.** Verified against the installed SDK type contract:

- `@supabase/auth-js/.../types.d.ts:234-265` — the `Session` interface contains **only** `provider_token?`, `provider_refresh_token?`, `access_token`, `refresh_token`, `expires_in`, `expires_at?`, `token_type`, `user`. **No `amr`.**
- `amr` exists **only** on `JwtPayload` (`types.d.ts:1640-1654`) — i.e. **inside the decoded JWT access token**, reached via `supabase.auth.getClaims()` (`GoTrueClient.d.ts:2473`), by decoding `session.access_token`, or via `mfa.getAuthenticatorAssuranceLevel()` (`currentAuthenticationMethods`).

The `(session as { amr?: ... })` cast **fabricates a non-existent field**, which is precisely why `tsc` does not flag it. At runtime `session.amr` is **always `undefined`**, so `hasRecoveryFactor` is always falsy and the function **always returns the rejection**.

**Reproduced empirically.** Reconstructed the exact `Session` shape `getSession()` returns for a genuine recovery session (a JWT whose payload carries `amr: [{method:"recovery"}]`, with no top-level `amr`), then ran the Fixer's exact predicate:

```
LEGITIMATE recovery session (arrived via a valid reset email link):
  session.amr           = undefined
  hasRecoveryFactor     = undefined
  -> updatePasswordAction REJECTS the legit reset?  true   ← REGRESSION

CORRECT source (decoded access_token payload / getClaims()):
  claims.amr            = [{"method":"recovery","timestamp":1700000000}]
  hasRecoveryFactor     = true
  -> would correctly ALLOW the legit reset?         true

NORMAL login session (hijack scenario):
  correct check would reject (no recovery factor)?  true   (correct)
```

**Impact:**
- **Breaks Phase 3 acceptance criterion #3 (forgot/reset password e2e).** A user who clicks a valid recovery link, lands on `/reset-password`, and submits a new password is told *"Password changes require a recovery link. Please request one from the forgot-password page."* — an inescapable loop. The recovery flow is **completely non-functional**.
- The security goal (block hijacked sessions from changing the password) is met **only degenerately** — by blocking *everyone*, not just hijacked sessions. That is not a fix; it disables the feature.
- **Severity escalation:** the original `m-1` was a MINOR (hijacked-session lockout, "strongly recommended"). The attempted fix converts it into a **functional break of a core flow** — a net regression.

> A true live happy-path E2E (complete a recovery email → land in a recovery session → reset) is blocked by the **same documented gaps** the audit already flagged: no custom SMTP, and `SUPABASE_SERVICE_ROLE_KEY` is still a placeholder (so `auth.admin.generateLink` can't synthesize a recovery session either). The static proof against the SDK contract + the runtime predicate reproduction are conclusive without it.

**Required correction (Fixer's choice of two):**
1. **Fix properly** — read the claim from the right place, e.g.
   ```ts
   const { data } = await supabase.auth.getClaims();
   const amr = data?.claims?.amr ?? [];
   const hasRecoveryFactor = amr.some((f) =>
     (typeof f === "string" ? f : f.method) === "recovery");
   ```
   (or decode `session.access_token`, or use `mfa.getAuthenticatorAssuranceLevel()`), and **add a regression test asserting a recovery session is *allowed* and a password session is *rejected*** — the test the current fix lacks. Note GoTrue may emit `amr` as `string[]` *or* `AMREntry[]` (per `JwtPayload`), so handle both.
2. **Revert and defer** — remove the gate, restoring the working (if imperfect) reset flow, and carry `m-1` forward to Phase 10 hardening as the auditor explicitly permitted ("the remaining minors/nits can be batched into Phase 10 … if explicitly carried forward in `PHASE_LOG.md`"). This unblocks the phase immediately.

---

## 3. Build verification

| Gate | Command | Result |
|---|---|---|
| Type safety | `npx tsc --noEmit` | ✅ **exit 0** (no output) |
| Production build | `npx next build` | ✅ **exit 0** — `✓ Compiled successfully`, `✓ Generating static pages (16/16)`, build traces collected |

Route table compiled cleanly (14 route entries / 16 static pages), including all auth routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`, `/auth/confirm`, `/auth/auth-code-error`, `/dashboard`, `/profile`, `/`. Middleware bundle 104 kB. No type errors, no build errors, no lint failures.

> Caveat: the green `tsc` is **not** evidence of m-1 correctness — the `as` cast deliberately suppresses the type that would have caught the bug. Build gates verify compilation, not the runtime contract.

---

## 4. Regressions discovered

1. **REG-1 (blocking) — Password recovery flow disabled by the m-1 fix.** `updatePasswordAction` rejects all sessions (legitimate recovery sessions included) because it reads `session.amr`, which never exists. Detailed above. **Must be fixed or reverted before sign-off.**

No other regressions found. M-1 and M-2 introduce no collateral behavior change (M-2 regression-checked against all sibling branches; M-1 leaves valid paths untouched).

---

## 5. Verification method (for the record)

- **Source inspection** of the three changed sites against the Fixer's claimed diffs — all three diffs are present as reported.
- **Behavioral execution** of the two pure functions (`safeNextPath`, `friendlyAuthError`) against adversarial + regression inputs, using a **real backslash byte** for the M-1 bypass (avoiding the JS source-escape trap).
- **Adversarial URL-parser proof** for M-1 — the same off-site resolution test the auditor used to prove the original bug.
- **SDK type-contract analysis** for m-1 against the installed `@supabase/auth-js` definitions (authoritative for the runtime object shape).
- **Runtime reproduction** of the m-1 predicate against a faithfully reconstructed recovery `Session`.
- **Build gates**: `tsc --noEmit` and `next build` run to completion, exit codes captured.
- Temp test scripts removed; no residue left in the repo.

---

## 6. What the Fixer must do next

- [ ] **Correct m-1** — read `amr` from `getClaims()` / decoded `access_token` / `getAuthenticatorAssuranceLevel()`, **or** revert the gate and carry `m-1` forward to Phase 10 in `PHASE_LOG.md`.
- [ ] **Add a regression test** for `updatePasswordAction`: recovery session → allowed; password-only session → rejected. (The absence of this test is what let the broken gate ship.)
- [ ] Re-run `tsc --noEmit` + `next build` (both already pass; confirm still green after the change).
- [ ] **No rework needed on M-1 or M-2** — both verified closed.
- [ ] Return to Verifier for re-check of m-1 only.

---

**Verifier sign-off:** ❌ **Return to Fixer.** M-1 (blocking open-redirect) and M-2 (signup UX) are independently verified closed and the build is green — but the m-1 recovery-gate fix is a functional regression that disables the legitimate password-reset flow (acceptance criterion #3). Phase 3 is **not** verified. Re-submit after m-1 is corrected or reverted.

**Residue:** none — temporary verification scripts deleted; no test users or data created (no live DB writes were necessary).
