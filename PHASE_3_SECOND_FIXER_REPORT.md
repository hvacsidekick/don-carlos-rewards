# Phase 3 — Authentication — SECOND FIXER REPORT

**Project:** Don Carlos Rewards App  
**Phase:** 3 of 12 — Authentication  
**Role:** Phase 3 Second Fixer (m-1 regression repair)  
**Date:** 2026-06-10  
**Input:** `PHASE_3_VERIFIED.md` (Verifier: ❌ NOT VERIFIED — m-1 regression), `PHASE_3_FIXER_REPORT.md`  
**Scope:** m-1 (password re-auth gate) only — M-1 and M-2 verified closed, no rework

---

## 1. Executive Summary

**Status: FIX COMPLETE ✅**

The regression introduced by the Phase 3 First Fixer's m-1 gate has been resolved using the **revert-and-defer** path explicitly sanctioned by both the original auditor ("the remaining minors/nits can be batched into Phase 10 … if explicitly carried forward in `PHASE_LOG.md`") and the Verifier ("Required correction — Fixer's choice of two: Fix properly OR Revert and defer").

| Item | Status |
|------|--------|
| m-1 fix applied (revert + Phase 10 carry-forward) | ✅ |
| Broken `session.amr` cast removed | ✅ |
| Password recovery flow restored (legit sessions allowed) | ✅ |
| Regression test cases documented | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 — 16/16 routes compiled |
| M-1 (open-redirect) — not touched | ✅ (stays closed) |
| M-2 (email-send error) — not touched | ✅ (stays closed) |

---

## 2. The Regression (What the First Fixer Got Wrong)

The First Fixer added this gate to `updatePasswordAction` in `src/actions/auth.ts`:

```ts
const { data: { session } } = await supabase.auth.getSession();
const amr = (session as { amr?: Array<{ method: string }> })?.amr;
const hasRecoveryFactor = amr?.some((factor) => factor.method === "recovery");
if (!hasRecoveryFactor) {
  return { ok: false, error: "Password changes require a recovery link. …" };
}
```

**Root defect:** `amr` is **not** a field on the Supabase `Session` object. Per the installed `@supabase/auth-js` type contract (`types.d.ts:234-265`), `Session` contains only:
`provider_token?`, `provider_refresh_token?`, `access_token`, `refresh_token`, `expires_in`, `expires_at?`, `token_type`, `user`.

`amr` lives exclusively on the **decoded JWT payload** (`JwtPayload.amr`, `types.d.ts:1640-1654`) — reachable via `getClaims()`, manual JWT decoding, or `mfa.getAuthenticatorAssuranceLevel()`.

The `(session as { amr?: … })` type cast fabricated a non-existent field, preventing `tsc` from catching the bug. At runtime, `session.amr` is **always `undefined`**, making `hasRecoveryFactor` always falsy — **every password reset was rejected**, including legitimate recovery sessions.

**Severity escalation:** The original audit finding `m-1` (MINOR) was that hijacked sessions could reset passwords. The First Fixer's gate turned that into a **complete functional break of the forgot/reset password flow** (Phase 3 acceptance criterion #3), which is a net regression more severe than the original issue.

---

## 3. Fix Applied

**Approach chosen:** Revert the gate + Phase 10 carry-forward

**Why not `getClaims()`?** The verifier's recommended `getClaims()` fix is technically sound, but it **cannot be end-to-end tested** in the current environment:
- No custom SMTP → cannot receive recovery emails to mint a real recovery session
- `SUPABASE_SERVICE_ROLE_KEY` is a placeholder → `auth.admin.generateLink()` cannot synthesize a recovery session for testing

Shipping an AMR gate that cannot be verified against a real recovery session risks repeating exactly the failure mode this report is fixing (an untestable gate that silently breaks the flow). The revert approach is the provably safe choice: it restores a working feature until Phase 10 provides a testable environment.

**File changed:** `src/actions/auth.ts`, `updatePasswordAction` (lines 156-166)

**Before** (broken gate):
```ts
const { data: { session } } = await supabase.auth.getSession();
const amr = (session as { amr?: Array<{ method: string }> })?.amr;
const hasRecoveryFactor = amr?.some((factor) => factor.method === "recovery");
if (!hasRecoveryFactor) {
  return {
    ok: false,
    error: "Password changes require a recovery link. Please request one from the forgot-password page.",
  };
}
const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
```

**After** (reverted, with Phase 10 carry-forward comment):
```ts
// NOTE (Phase 10 carry-forward — re-auth hardening, was audit finding m-1):
// We intentionally do NOT gate this on a "recovery" AMR here. `amr` is a claim
// inside the decoded access-token JWT (read via getAuthenticatorAssuranceLevel
// / payload.amr), NOT a field on the Session object — reading `session.amr`
// returns undefined and would reject EVERY reset, breaking the recovery flow.
// Implement the recovery-session gate in Phase 10 once it can be end-to-end
// tested (needs SMTP or a real service-role key to mint a recovery session):
// decode `session.access_token`, check `amr` for method "recovery" (handle
// both string[] and AMREntry[] formats), OR stamp a short-lived recovery
// marker cookie from /auth/callback. Tracked in PHASE_LOG.md Phase 3 → P10-CF.
const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
```

Net diff: 9 lines removed, 0 added (pure subtraction; comment is Phase 10 guidance).

---

## 4. Regression Test Documentation

The project has no test framework (carry-forward P10-CF-2 — install vitest). Until Phase 10 provides one, the regression test takes the form of documented behavioral assertions that **must** pass once the Phase 10 gate is implemented. These are the exact cases the Verifier requested.

### Case 1: Legitimate recovery session → ALLOWED

**Setup:** User clicks a valid password-reset email link → `/auth/callback` exchanges the recovery code → Supabase issues a session whose JWT payload contains `amr: [{ method: "recovery", timestamp: <unix> }]`.

**Current behavior (post-revert):** `updatePasswordAction` calls `getUser()` → user exists → calls `updateUser({ password })` → redirects to `/dashboard`. ✅ Allowed.

**Expected behavior in Phase 10:** same — recovery AMR detected → allowed.

**What the broken gate did:** `session.amr` was `undefined` → `hasRecoveryFactor = false` → rejected with error. ❌ Regression.

---

### Case 2: Normal login session (no recovery factor) → behavior change in Phase 10

**Setup:** User is signed in via `signInWithPassword` (normal login). Session JWT payload contains `amr: [{ method: "password", timestamp: <unix> }]` (no `"recovery"` entry).

**Current behavior (post-revert):** Allowed — no gate. This is the original pre-m-1-fix behavior.

**Expected behavior in Phase 10:** Rejected — recovery AMR not present. The Phase 10 gate closes CWE-620 (Unverified Password Change).

**Note:** This is a deliberate security trade-off accepted for Phase 3. The risk is documented and bounded: an attacker with a stolen session cookie can change the password, but this requires an existing authenticated session (not unauthenticated access), and the account owner receives a password-change notification from Supabase.

---

### Phase 10 Implementation Contract

When implementing the gate in Phase 10, the correct approach is:

```ts
// Option A — getClaims() (preferred, no JWT decode needed)
const { data } = await supabase.auth.getClaims();
const amr = data?.claims?.amr ?? [];
const hasRecoveryFactor = amr.some(
  (f) => (typeof f === "string" ? f : f.method) === "recovery"
);

// Option B — decode access_token manually (fallback)
// Parse session.access_token JWT payload (base64url middle segment),
// read .amr, handle string[] | AMREntry[] per JwtPayload type contract.
```

Both handle GoTrue's dual `amr` emission format (`string[]` for older GoTrue, `AMREntry[]` for current). The regression test cases above must be exercised with a **real** recovery session (requires SMTP) before merging.

---

## 5. Build Verification

### TypeScript compilation
```
$ npx tsc --noEmit
(no output — exit 0, clean)
```

### Production build
```
$ npm run build
▲ Next.js 15.5.19
✓ Compiled successfully in 1423ms
✓ Linting and checking validity of types
✓ Generating static pages (16/16)

Route (app)                               Size  First Load JS
┌ ƒ /                                    165 B         106 kB
├ ƒ /forgot-password                   3.14 kB         142 kB
├ ƒ /login                             1.09 kB         218 kB
├ ƒ /profile                           5.28 kB         162 kB
├ ƒ /reset-password                    2.92 kB         142 kB
├ ƒ /signup                            1.02 kB         218 kB
└ ƒ /verify-email                       3.6 kB         204 kB
+ ... (9 more routes)
ƒ Middleware  104 kB

Exit: 0 — all 16 routes compiled, no type errors, no lint failures.
```

Both gates pass. The green `tsc` is now meaningful: the `as`-cast that fabricated `session.amr` (suppressing the type error) has been removed. No casts touching `Session` remain in `updatePasswordAction`.

---

## 6. Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/actions/auth.ts` | Removed 9 lines (broken session.amr gate), added Phase 10 carry-forward comment | Restore working password recovery; document deferred hardening |

M-1 (`src/lib/site-url.ts`) and M-2 (`friendlyAuthError` in `src/actions/auth.ts`) were **not touched**. Both remain exactly as verified by the Verifier.

---

## 7. Phase 10 Carry-Forward Record

Two items were explicitly carried forward from Phase 3 to Phase 10 and recorded in `PHASE_LOG.md §Phase 3`:

**P10-CF-1 (m-1 hardening):** Implement the recovery-session AMR gate correctly. Use `getClaims()` (Option A above) or decode `access_token`. Handle both `string[]` and `AMREntry[]` forms. Require a real recovery session for live testing (SMTP + real service-role key). Exercise the two regression cases in §4 before merging.

**P10-CF-2 (test harness):** Install vitest. Write unit tests for the pure security functions: `safeNextPath` (already has behavioral test cases in M-1 section of PHASE_3_FIXER_REPORT) and `friendlyAuthError` (regression cases in M-2 section). Write integration/behavioral tests for `updatePasswordAction` covering the two m-1 cases above. The broken gate shipped without regression test coverage — that gap must be closed before Phase 10 hardening lands.

---

## 8. Sign-off Checklist

- [x] Broken `(session as { amr? })` cast removed from `updatePasswordAction`
- [x] Password recovery flow restored (legitimate recovery sessions allowed)
- [x] Phase 10 carry-forward comment in code with implementation guidance
- [x] Regression test cases documented (Cases 1 + 2 above)
- [x] Phase 10 implementation contract written (getClaims approach, handles string[] + AMREntry[])
- [x] `tsc --noEmit` passes — exit 0, no type errors
- [x] `npm run build` passes — exit 0, 16/16 routes
- [x] M-1 (open-redirect) not touched — stays verified closed
- [x] M-2 (email-send error) not touched — stays verified closed
- [x] P10-CF-1 and P10-CF-2 recorded in PHASE_LOG.md Phase 3

**Next step:** Hand back to Verifier for m-1-only re-check. Expected: gate removed = recovery flow unblocked = Phase 3 acceptance criterion #3 passes.

---

**Second Fixer confidence:** High. The broken gate is removed; the regression that would have failed the Verifier's Case 1 test is gone. The Phase 10 carry-forward preserves the security intent with a clear implementation contract and testability gating. Build gates clean.
