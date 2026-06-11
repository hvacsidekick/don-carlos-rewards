# Phase 9 — Admin Portal — Independent Hostile Audit

**Branch:** `phase/9-admin` @ `14f445e` · **DB:** dev `uxgcyvexeehvhtuhmztc`
**Auditor:** independent (read source first, Builder report last). Diff = 21 files / 2221 insertions, no stray/unrelated changes.

---

## VERDICT: A− — APPROVED

The trust boundary holds at three independent layers and is **proven live** (non-admin
→ `42501` on every mutation and every aggregate). Money writes are atomic, the audit actor
is the admin, the M-1 floor fix is correct, and keyset pagination is dup/skip-free across a
same-sort-key tie. All three build gates are green. No blocking defect.

The only material issue is **D-1** (in-person redemptions typed `adjustment`, invisible to the
`redemptions`/`points_redeemed` KPIs and to `total_redemptions`) — a real but **non-blocking**
data-integrity/analytics-fidelity defect that the Builder proactively disclosed with an accurate
trade-off analysis. It does not breach the boundary, cannot over-debit, and is self-consistent in
the append-only ledger. It caps the grade just under A but is well above the B+ bar.

---

## Acceptance criteria (PLAN.md §Phase 9) — verbatim, scored

| # | Criterion (verbatim) | Result | Evidence |
|---|---|---|---|
| 1 | "Admin access verified server-side, not just hidden UI" | **PASS** | `requireAdmin()` (admin-guard.ts:19) re-derives `getUser()`+`is_admin` at the top of every action (admin.ts:68,135,208,237) and every server data fn (customers.server.ts:76,175,215; analytics.server.ts:64). RPCs re-check inside Postgres. Live: non-admin → 42501 on `adjust_points`, `admin_analytics`, `admin_analytics_extended` (proofs below). |
| 2 | "Manual adjustment requires a reason" | **PASS** | Mandatory in Zod (`reason.min(3)`, admin.ts schema line 43-47) AND in the RPC (`reason required`, 22023, points_functions.sql:103 / fix mig:30). Server re-parses (admin.ts:71). |
| 3 | "Redeem on behalf of an in-person customer" | **PASS (with D-1)** | `redeemOnBehalfAction` (admin.ts:130) reads canonical `redeem_threshold` server-side, re-checks `balance >= threshold`, debits via `adjust_points(-threshold)`. Works; no over-debit. Ledger row typed `adjustment` not `redeem` — see D-1. |
| 4 | "Search + pagination correct (no dup/skip); balances match ledger" | **PASS** | Keyset on `(created_at desc, id desc)` (customers.server.ts:86-88,102-104). Proven live across a 3-way `created_at` tie: page1=[a3,a2], page2=[a1], exactly once. Balance shown = `profiles.points_balance` (line 143). Search escapes ILIKE wildcards (line 60-62) — see MINOR-1 for the PostgREST-reserved-char nuance. |
| 5 | "All-rows aggregates run as admin RPCs, not client-replayable queries" | **PASS** | Every KPI comes from `admin_analytics()` + `admin_analytics_extended()` (analytics.server.ts:70-72), both SECURITY DEFINER + admin-gated; `revoke from anon,public` confirmed live (anon/public cannot execute). |
| 6 | "Design / dark mode / a11y gate" | **PASS** | No hardcoded `#fff/#000/rgb()` in admin components (grep empty); tokens resolve in globals.css. ≥44pt targets (`min-h-11`), focus rings, state never color-alone (`aria-pressed`, `aria-current`, legend+SR table), errors `role="alert"`, chart `role="img"` + visually-hidden data table. (UI not browser-exercised — see O-1.) |

---

## Trust boundary: **HELD** — live proof

Three test users created (admin / plain-user / target, balance 30), impersonated via
`request.jwt.claims.sub` under `role authenticated`. All test data cleaned up afterward
(DB verified back to baseline: 1 profile, 6 tx, 0 adjustments, 0 audit rows, 0 `audit9` residue).

- **Non-admin → `adjust_points('…target…', 50, …)`** → `ERROR: 42501: not authorized` at
  `adjust_points line 5` (the `is_admin` check, before any write). Target balance untouched.
- **Non-admin → `admin_analytics_extended(30)`** → `ERROR: 42501` at line 8.
- **Non-admin → `admin_analytics()`** → `ERROR: 42501` at line 5.
- **anon/public** lack EXECUTE on all four RPCs (`pg_proc` grants = `{authenticated, service_role}`).
- **No service-role key** anywhere in the admin chain: `admin.ts`, `*.server.ts`, and admin
  components contain zero `service`/`SUPABASE_SERVICE_ROLE_KEY` imports (grep). All reads go
  through the RLS-bound server client; all writes through SECURITY DEFINER RPCs.
- **Admin happy path** → `adjust_points` succeeds, writes `audit_log` with `actor_id = admin uid`
  (verified: 9/9 audit rows had actor=admin in the floor test), one audit row per ledger row
  (no double-write).

### M-1 floor fix — verified live
Target balance 30, admin `adjust_points(-50)` → balance floored to 0, ledger row recorded
`points_delta = -30` (the APPLIED delta), `points_balance_after = 0`. Invariant
`old_bal + points_delta == points_balance_after` holds (30 + (−30) = 0). The Phase-2 M-1 bug
(recording unclamped delta) is correctly fixed by mig 20260610013637 and the action relies on it.

---

## Analytics math — re-derived against live data

Independent SQL vs RPC output, all matched exactly:

| KPI | Ground truth | RPC | Match |
|---|---|---|---|
| total_customers | 3 | 3 | ✓ |
| active_30d | 2 | 2 | ✓ |
| points_outstanding | 70 | 70 | ✓ |
| points_issued | 150 | 150 | ✓ |
| redemptions (count) | 2 | 2 | ✓ |
| points_redeemed | 200 | 200 | ✓ |

- **Redemption rate** = 200/150 = **133%**. Divide-by-zero guarded (`computeRedemptionRate`
  returns 0 when issued=0, analytics.ts:53). Exceeds 100% honestly — the page shows the true
  number and only caps the bar width (analytics/page.tsx:43-47). Correct and disclosed.
- **Series** correctly gap-fills 30 days in `America/Denver`; activity bucketed on 2026-06-10.
- **Top customers** ordered `total_points_earned desc, points_balance desc, id`; excludes admins
  (verified — admin user not in result). Deterministic tie-break.

---

## Defect list

### MAJOR-1 — D-1: in-person redemptions are mis-typed and invisible to redemption analytics
`src/actions/admin.ts:172-176` (`redeemOnBehalfAction` → `adjust_points(-threshold)`).
Live-proven: the redeem-on-behalf write lands as `transaction_type = 'adjustment'`, `points_delta = -100`.
Consequences, each verified against the live formulas:
- `admin_analytics().redemptions` (`count where type='redeem'`) **does not count** it.
- `points_redeemed` (redemption-rate numerator, `Σ|delta| where type='redeem'`) **excludes** it
  — so the headline redemption rate understates real redemptions and the rate denominator/numerator
  drift further from reality the more staff redeem in person.
- `profiles.total_redemptions` is **not incremented** (only `redeem_points` does that), so the
  customer's own redemption count on the detail page is wrong for in-person redemptions.
**Why it matters:** redemption KPIs are the core business signal of a loyalty program; a whole
class of redemptions (every in-person one) is silently absent. **Not blocking** because: boundary
holds, it's atomic + audited with the admin as actor, it cannot over-debit/go negative
(server-side `balance >= threshold` re-check + RPC floor at 0), and it's documented.
**Fix direction:** add an admin-checked `redeem_points_for(target uuid, pts integer)` RPC that
mirrors `add_points`'s admin-checked target pattern but writes `transaction_type='redeem'`,
decrements via the guard window, and increments `total_redemptions` — then point
`redeemOnBehalfAction` at it. (The Builder proposed exactly this.) Until then, the analytics
should at minimum acknowledge staff redemptions, or count `adjustment` rows tagged with the
staff-redeem reason.

### MINOR-1 — search escaping uses backslash for PostgREST-reserved chars instead of value-quoting
`src/lib/customers.server.ts:60-62`, used at line 92-94.
`escapeLike` backslash-escapes `% _ , ( )` and the result is interpolated into the `.or()`
filter string. Backslash-escaping `%`/`_`/`\` is correct **for the ILIKE pattern**, but for the
**PostgREST `.or()` parser** the reserved chars (`, . ( ) :`) must be handled by wrapping the
value in double quotes (`ilike."%a,b%"`), not by a backslash — a `\,`/`\(` is passed through to
PostgREST as a literal backslash that then becomes part of the ILIKE pattern. A search containing
a literal comma or parenthesis will therefore return wrong/empty results or could confuse the
filter split. **This is a correctness/robustness edge, not a security hole**: supabase-js sends
the filter as a URL-encoded value that PostgREST parameterizes — there is no SQL string
concatenation, so SQL injection is structurally impossible (and the query is already admin-gated,
fixed column set). Escaped `%`/`_` were live-verified to narrow correctly (a `\_` search matched
only the literal-underscore name, not match-all). **Fix direction:** for the search value, ILIKE-escape
only `% _ \`, then wrap the whole value in double quotes inside the `.or()` (and escape any `"`),
or use the `.ilike()` builder per-column with two `.or` branches.

### MINOR-2 — `points_outstanding` sums balances over ALL profiles (admins included)
`supabase/migrations/20260610011508_analytics_admin.sql:21` (pre-existing, surfaced by Phase 9's
liability KPI). `Σ points_balance from profiles` has no `where not is_admin`. Today admins hold 0,
so it equals customers-only (70=70), but if an admin ever accrued points the stated liability would
be overstated. **Not introduced by this phase** (base RPC predates it) but the analytics page now
leans on it as "liability on the books". **Fix direction:** add `where not is_admin` for consistency
with `total_customers`/`top_customers`, or document that staff balances are intentionally included.

### NIT-1 — duplicated cursor codec
`customers.server.ts:250` re-implements the base64url cursor encode inline instead of reusing
`encodeCursor` (line 33). Harmless; consolidate for one definition.

### NIT-2 — `analyticsWindowSchema` is exported but unused
`src/schemas/admin.ts:66` — the window is hardcoded to 30 in the page/RPC; the schema is dead.
Either wire it to validate a user-supplied window or drop it.

---

## D-1 ruling
**Accept as a documented, non-blocking trade-off for Phase 9; track as a MAJOR follow-up.**
The implementation is safe (atomic, audited, admin-actor, no over-debit) and the Builder disclosed
it accurately. But typing in-person redemptions as `adjustment` makes them invisible to the
redemption KPIs and to `total_redemptions`, which is a genuine data-fidelity gap for a loyalty
program. It must not ship to a real money-handling launch without the `redeem_points_for` RPC. For
THIS phase's gate it does not breach the boundary or corrupt the ledger, so it does not block.

---

## Real gate output (clean `.next`, this worktree)

```
$ rm -rf .next && npx tsc --noEmit
TSC_EXIT=0

$ npm run lint
 ✔ No ESLint warnings or errors
LINT_EXIT=0
(only the benign "multiple lockfiles" workspace-root warning — nested worktree, environmental.)

$ rm -rf .next && npm run build
 ✓ Compiled successfully in 14.8s
 ✓ Generating static pages (23/23)
BUILD_EXIT=0
Routes present: /analytics, /customers, /customers/[id], /scan (all ƒ dynamic).
```
(Edge-runtime `process.version` warning + webpack big-string cache warnings are pre-existing
Supabase-SSR noise, not Phase-9 code. No Defender ENOENT flake this run.)

`get_advisors` (security): the only lint on the new function is `0029
authenticated_security_definer_function_executable` for `admin_analytics_extended` — the SAME
expected/justified WARN the existing 6 admin RPCs carry (re-checks `is_admin` internally; SECURITY
DEFINER required to aggregate under RLS). Pre-existing `auth_leaked_password_protection` WARN is
unrelated. No new security regression.

DB left residue-free: `profiles=1` (pre-existing phase4 fixture), `tx=6`, `adjustments=0`,
`audit_log=0`, `auth.users`/`profiles` audit9 residue = 0.

---

## Top 3 for the Fixer
1. **MAJOR-1 / D-1** — add an admin-checked `redeem_points_for(target, pts)` RPC that writes
   `transaction_type='redeem'` and increments `total_redemptions`; repoint `redeemOnBehalfAction`
   at it so in-person redemptions count in the redemption KPIs and on the customer detail page.
2. **MINOR-1** — fix the customer-search escaping to PostgREST-correctly handle reserved chars
   (double-quote the filter value; ILIKE-escape only `% _ \`) so comma/paren searches don't break.
3. **MINOR-2** — scope `points_outstanding` to `where not is_admin` (or document the inclusion) so
   the liability figure can't be inflated by staff balances.
