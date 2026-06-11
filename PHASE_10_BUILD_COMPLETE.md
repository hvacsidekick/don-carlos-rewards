# Phase 10 — Security Hardening + Compliance — BUILD COMPLETE

Branch: `phase/10-security` · Builder pass. Independent hostile audit to follow.

Gate (clean `.next`): `npx tsc --noEmit` **0** · `npm test` **28/28 pass** ·
`npm run lint` **clean** · `npm run build` **exit 0** (25 routes, Middleware 104 kB).

This report is HONEST about code-complete vs deploy-gated. See the
**DEPLOY-GATED / NOT DONE HERE** section at the end.

---

## A. Security headers + CSP (criterion 4) — DONE (code) + curl-proven

**Where:** static headers in `next.config.ts` `headers()`; per-request CSP in
`src/middleware.ts`; both from the single source `src/lib/security-headers.ts`.

**Nonce approach:** the root middleware generates a per-request nonce
(`crypto.getRandomValues` → base64) and forwards it on the REQUEST headers
(`x-nonce` + `Content-Security-Policy`). Next.js reads that request CSP header and
auto-applies the nonce to its own inline bootstrap `<script>`s — so we ship
`script-src 'self' 'nonce-…' 'strict-dynamic'` with **NO `unsafe-inline` for
scripts**. The nonce flows into `updateSession` so redirects also carry the CSP.

**Exact policy (one line per directive + rationale):**
| Directive | Value | Why |
|---|---|---|
| default-src | `'self'` | deny-by-default fallback |
| base-uri | `'self'` | block `<base>` injection |
| object-src | `'none'` | no legacy plugin XSS vectors |
| form-action | `'self'` | forms only POST same-origin |
| frame-ancestors | `'none'` | clickjacking (modern X-Frame-Options: DENY) |
| script-src | `'self' 'nonce-<req>' 'strict-dynamic' https:` | nonce'd inline + same-origin; `strict-dynamic` lets nonce'd scripts load Next chunks; `https:` is **ignored by CSP3** when strict-dynamic present; **no unsafe-inline** |
| style-src | `'self' 'unsafe-inline'` | **accepted exception** — Tailwind/shadcn/Framer set inline styles + style ATTRIBUTES (nonces don't cover style attrs); style injection ≪ script injection |
| img-src | `'self' data: blob: https://*.supabase.co` | app imgs, next/image blur (data:), blob: downloads, Storage menu photos |
| font-src | `'self' data:` | system font stack + inlined fonts |
| connect-src | `'self' https://*.supabase.co wss://*.supabase.co` | Supabase REST/Auth + Realtime websocket |
| frame-src | `https://www.google.com` | keyless Maps Embed on /about only |
| worker-src | `'self' blob:` | zxing / future service worker |
| manifest-src | `'self'` | PWA manifest (Phase 11) |
| upgrade-insecure-requests | — | force stray http subresources to https |

Plus: HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), …, interest-cohort=()`.

**Verified by `curl` against `next start`:**
- `/login` returns all 6 header families; CSP carries a nonce.
- **CSP-header nonce === inline `<script>` nonce** (hydration won't break) and the
  nonce is **different per request** (per-request, not static).
- `/about` CSP includes `frame-src https://www.google.com` (Maps iframe).
- The unauth `/dashboard` → `/login?next=` **307 redirect carries the CSP +
  Permissions-Policy**.

**Honest deferral:** full in-browser console-violation sweep on every page needs a
real browser (Verifier/Phase-11). The policy is correct by construction + curl-proven.

---

## B. Rate limiting (criterion 3) — DONE (in-memory), prod store deploy-gated

**Where:** `src/lib/rate-limit-core.ts` (pure, no `server-only`, unit-tested) +
`src/lib/rate-limit.ts` (`server-only` wrapper, singleton, IP helper).

- **Auth** 5/60s per IP on `signInAction` / `signUpAction` / `resetPasswordAction`
  (`authRateLimit(bucket)` in `actions/auth.ts`). **The 6th attempt in the window
  is blocked** — unit-tested (`rate-limit.test.ts`).
- **Admin add-points** 30/60s per admin id in `addPointsAction`.

**Design:** fixed-window over a pluggable `RateLimitStore`. Ships
`MemoryRateLimitStore` (per-process — correct dev/single-instance). **Prod swap
(O-6, deploy-gated):** implement `RateLimitStore` over Upstash Redis
(`INCR`+`PEXPIRE` / `@upstash/ratelimit`) or Vercel KV and pass to
`createRateLimiter(store)`; env vars `UPSTASH_REDIS_REST_URL/_TOKEN` already
validated in `lib/env.ts`. Documented in BLUEPRINT §10.4a.

---

## C. P10-CF-1 — recovery re-auth gate — DONE (correctly), live-test deploy-gated

**The prior bug:** read `session.amr` — a field that does NOT exist on the Session
object (only on the decoded JWT payload). It always returned `undefined`, so the
old gate rejected EVERY reset.

**This time:** `src/lib/recovery-amr.ts` is a PURE predicate `hasRecoveryAmr(amr)`
handling BOTH `string[]` and `AMREntry[]` shapes, fail-closed on missing/malformed.
`updatePasswordAction` now reads `amr` via **`supabase.auth.getClaims()`** (the
decoded JWT) and only allows the password change when `hasRecoveryAmr` is true.

**Regression test (`recovery-amr.test.ts`):** recovery session (both shapes) →
allowed; plain password/oauth session → rejected; malformed/missing → rejected.

**Deploy-gated:** the live end-to-end recovery flow needs custom SMTP + a real
service-role key to mint a recovery session. The pure predicate + its wiring are
proven here; the live click-through is a deployer task.

---

## D. P10-CF-2 — test harness — DONE

**Vitest** (`vitest.config.ts`, `tests/setup-env.ts`, `npm test` → `vitest run`).
28 tests, all green, covering the pure security functions:
- `safe-next-path.test.ts` — incl. the **real-backslash** + control-char open-redirect cases.
- `auth-errors.test.ts` — every `friendlyAuthError` branch + non-leaky fallthrough.
- `rate-limit.test.ts` — **6th-attempt-blocked**, per-key isolation, window reset.
- `recovery-amr.test.ts` — recovery allowed / plain rejected (both AMR shapes).
- `cursor.test.ts` — keyset cursor round-trip + malformed → null.
- `postgrest-escape.test.ts` — LIKE-escape + `.or()` reserved-char quoting.

To make these importable without dragging `server-only`/`"use server"` into the
test runner, pure logic was extracted into dedicated modules: `auth-errors.ts`,
`rate-limit-core.ts`, `cursor.ts`, `postgrest-escape.ts`, `recovery-amr.ts`. The
server data-access modules now import the shared codec/escape (single tested
implementation).

**Dep note:** added `vitest@2.1.9` (devDependency). `npm audit` flags a
**dev-only** esbuild advisory (transitive via vite, dev-server only — not in the
production bundle, vitest runs tests not a public server) and a pre-existing
postcss advisory in next's tree. Neither ships to prod.

---

## E. P10-CF-3 — `add_points` idempotency — DONE + DB-proven

**Migration** `supabase/migrations/20260611053849_add_points_idempotency.sql`
(applied to dev `uxgcyvexeehvhtuhmztc` as version `20260611053849`):
- `transactions.idempotency_key uuid` (nullable) + **partial UNIQUE index**
  `(staff_id, user_id, idempotency_key) WHERE idempotency_key IS NOT NULL` — the
  atomic backstop.
- New SECURITY DEFINER `add_points_idempotent(target, pts, amount_cents, note,
  idem_key)` mirroring `add_points` (admin check, range check, GUC guard window,
  atomic balance+ledger), with: a fast-path that returns the existing row for a
  repeat key (no second credit), and a `unique_violation` catch that undoes the
  balance bump and returns the winning row on a concurrent race. Null key →
  behaves like classic add. Follows the existing grant-hardening (revoke
  anon/public; grant authenticated).

**Proven (live SQL, then cleaned):** same key twice → balance stayed 50, **1 earn
row, same tx id** (no-op); different key → credits (→100); two null-key adds →
both credit (→120). DB residue-free; `get_advisors` adds only the expected `0029`
on the new RPC (joins the justified DEFINER set).

**Wired:** `addPointsAction` (`actions/scan.ts`) now calls `add_points_idempotent`
with a key — reuses a client-supplied UUID (one per opened confirm sheet in
`ScanFlow.tsx`) across retries, mints one server-side if absent. Schema gains
`idempotencyKey?: uuid` (`schemas/scan.ts`). Types regenerated
(`database.types.ts`).

---

## F. Account deletion + data export (criterion 6) — export DONE; delete code-done, live deploy-gated

`src/actions/account.ts`:
- `deleteAccountAction` — re-derives identity from session; **anonymizes the
  non-cascading refs** (`transactions.staff_id`, `audit_log.actor_id` → NULL via
  service-role, best-effort) per the Phase-2 note; then `auth.admin.deleteUser`
  (cascade removes the user's own profile/transactions). **Deploy-gated:** needs a
  real service-role key (current is a placeholder) — returns a safe error, no crash.
- `exportMyDataAction` — **fully working today** (no service role): assembles
  profile + full transaction ledger as JSON, identity re-validated server-side,
  explicit `.eq(user_id/id)` (defense in depth vs admin read-all). New
  `ExportDataButton.tsx` triggers a client-side JSON download; added to the
  profile page Account section.

---

## G. Privacy Policy + Terms of Service (criterion 7) — DONE

`/privacy` + `/terms` public pages (`app/privacy/page.tsx`, `app/terms/page.tsx`)
on a shared `LegalPage` shell with a **legal-review banner** (placeholder copy,
flagged). Linked from: a new `SiteFooter` (rendered on both legal pages) and a
**consent line under the signup submit** (“By creating an account you agree to our
Terms / Privacy”). Both return 200 (public, outside the guarded prefixes).

---

## H. Zod + RLS + secret audit (criteria 1, 2, 5) — DONE

- **Zod coverage:** audited every Server Action / route. Closed Phase-3 **m-3**
  (OTP `type` now Zod-`enum`-validated in `auth/confirm/route.ts`, not blind-cast)
  and **m-5** (`signUpAction` now propagates a sanitized `next` through the
  email-confirmation round-trip; wired from the signup page → form). All
  scan/admin/auth/transactions inputs already Zod-validated; re-confirmed.
- **RLS cross-tenant test (live, then cleaned):** non-admin user A **cannot read or
  write** user B's profile/transactions (0 rows / 0 row_count), but CAN read its
  own — proven under the `authenticated` role + JWT claim. DB residue-free.
- **`get_advisors(security)`:** 9× `0029 authenticated_security_definer_function_executable`
  (the intended RPC surface incl. the new `add_points_idempotent` — each re-checks
  authz internally, needs DEFINER to write the ledger / bypass RLS, EXECUTE revoked
  from anon → **JUSTIFIED**) + 1× `auth_leaked_password_protection` (deploy-gated
  dashboard toggle). **Zero ERRORs, no new advisory class.**
- **Secret hygiene:** rebuilt `.next`, grepped `.next/static`. The service-role
  **value is ABSENT** from the client bundle. Tidied a minor leak: the server env
  Zod **schema** (field-name strings only, no values) was riding in a shared client
  chunk — made `serverSchema` lazy in `env.ts` so it's now **tree-shaken out**
  (re-grep confirms GONE). `service.ts` retains `import "server-only"`.

---

## DEPLOY-GATED / NOT DONE HERE (provisioning tasks — NOT faked)

1. **Leaked-password protection / password policy / email-confirmation** (criterion
   8) — Supabase Auth **dashboard** toggles. `get_advisors` still reports
   `auth_leaked_password_protection` until enabled. Deployer task.
2. **Custom SMTP** — required before signup/recovery/account-deletion work
   end-to-end (and before the C live recovery test).
3. **Real `SUPABASE_SERVICE_ROLE_KEY`** — current is a placeholder; account
   *deletion* `auth.admin.deleteUser` is gated on it (code complete, returns a safe
   error today). Data *export* works now.
4. **Prod rate-limit store** — Upstash Redis / Vercel KV (O-6). In-memory fallback
   ships; swap documented (BLUEPRINT §10.4a).
5. **Prod CORS lock** to the Vercel domain(s) — set on the prod env (Phase 12).
6. **Live CSP console-violation sweep in a real browser** — Verifier/Phase-11.

## Open questions / honest notes

- The build emits 3 benign, pre-existing warnings (multiple-lockfiles workspace
  root from the worktree; webpack cache big-strings perf note; `@supabase/supabase-js`
  `process.version` Edge note — present since Phase 3, not from this phase).
- `style-src 'unsafe-inline'` is a deliberate, documented exception (style attrs;
  nonces can't cover them). Eliminating it would require removing all inline styles
  from Framer Motion/shadcn — out of scope and low-value (script injection is the
  real risk, and that path has no `unsafe-inline`).
- The idempotency key is scoped to `(staff_id, user_id, key)`. Two *different*
  admins adding with the *same* key would each credit — intended (keys are minted
  per-admin-session, never shared).
