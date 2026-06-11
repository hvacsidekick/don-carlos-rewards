# Phase 9 — Admin Portal — Build Complete

**Branch:** `phase/9-admin`
**Status:** code-complete, locally gate-green (tsc 0 / lint 0 / build 0)
**DB project:** dev `uxgcyvexeehvhtuhmztc` (migration applied + verified live)

This is the Builder hand-off. An independent hostile auditor reviews next.

---

## 1. What was built (file-by-file)

### Database (1 new migration, applied live)
- **`supabase/migrations/20260610030000_analytics_extended.sql`** — new admin-only
  RPC `admin_analytics_extended(days integer default 30)` returning JSON with the
  redemption-rate inputs (`points_issued`, `points_redeemed`), a gap-filled daily
  `series` (issued/redeemed per day, store timezone), and `top_customers` (top 5 by
  lifetime points earned, staff excluded). Follows the existing security pattern
  EXACTLY (see §4). Applied to the live dev project via Supabase MCP `apply_migration`,
  then the `day` formatting was corrected to `::date::text` (YYYY-MM-DD) and re-applied.

### Types
- **`src/lib/database.types.ts`** — regenerated; added one line:
  `admin_analytics_extended: { Args: { days?: number }; Returns: Json }`.

### Schemas (Zod — shared client + server)
- **`src/schemas/admin.ts`** (new) — `adjustPointsSchema` (mandatory reason `.min(3)`,
  non-zero delta, ±100k bound), `redeemOnBehalfSchema`, `customerListQuerySchema`
  (bounded search + cursor), `analyticsWindowSchema`.

### Server data access (server-only)
- **`src/lib/admin-guard.ts`** (new) — extracted shared `requireAdmin()` (session
  `getUser()` + `is_admin` re-read). `src/actions/scan.ts` now imports it (DRY; one
  boundary definition). Behaviour identical to the Phase-5 inline version.
- **`src/lib/customers.ts`** (new) — client-safe types/constants (`CustomerListItem`,
  `CustomerPage`, `CUSTOMERS_PAGE_SIZE=20`).
- **`src/lib/customers.server.ts`** (new) — `getCustomersPage` (keyset pagination +
  name/email search + batched last-activity), `getCustomerDetail`,
  `getCustomerTransactionsPage`. All `requireAdmin`-gated.
- **`src/lib/analytics.ts`** (new) — client-safe types + `computeRedemptionRate`
  (divide-by-zero guarded).
- **`src/lib/analytics.server.ts`** (new) — `getAdminAnalytics` calls both admin RPCs,
  Zod-validates the JSON, derives the redemption rate.

### Server Actions
- **`src/actions/admin.ts`** (new) — `adjustPointsAction`, `redeemOnBehalfAction`,
  `loadCustomersAction`, `loadCustomerTransactionsAction`. Every action starts with
  `requireAdmin()` and re-validates with Zod.
- **`src/actions/scan.ts`** (modified) — uses the shared `requireAdmin`.

### UI
- **`src/components/nav/AdminNav.tsx`** (new) — Scan / Customers / Analytics segmented
  nav; active state by fill + weight + `aria-current` (not color alone); ≥44pt;
  responsive; dark mode.
- **`src/app/(admin)/layout.tsx`** (modified) — renders `AdminNav` above every admin
  page inside a `max-w-3xl` container; keeps the server `is_admin` guard.
- **`src/app/(admin)/scan/page.tsx`** (modified) — fits the new shell (removed redundant
  outer min-height/padding).
- **`src/components/admin/CustomerList.tsx`** (new) — searchable + keyset-paginated list
  island (debounced search, out-of-order-response guard, skeleton, empty state).
- **`src/app/(admin)/customers/page.tsx`** (new) — Server Component, fetches first page.
- **`src/components/admin/AdminCustomerActions.tsx`** (new) — Manual Adjust dialog
  (add/subtract toggle + mandatory reason) and Redeem-on-behalf confirm dialog;
  optimistic balance + `router.refresh()`.
- **`src/components/admin/CustomerHistory.tsx`** (new) — admin view of a customer's
  ledger, reusing Phase-6 `TransactionRow` + day grouping, keyset "load more".
- **`src/app/(admin)/customers/[id]/page.tsx`** (new) — detail page composing profile +
  balance + actions + history; `notFound()` on unknown id.
- **`src/components/admin/AnalyticsChart.tsx`** (new) — dependency-free inline-SVG grouped
  bar chart; `role="img"` + visually-hidden data table for SR users.
- **`src/app/(admin)/analytics/page.tsx`** (new) — 6 KPI cards, time-series, top
  customers; friendly unavailable state.

---

## 2. Analytics formulas (exact)

All figures come from admin-gated RPCs (`admin_analytics()` + `admin_analytics_extended()`);
no all-rows aggregate is exposed as a client-replayable query.

- **total_customers** = `count(profiles where not is_admin)`
- **active_30d** = `count(distinct user_id from transactions where created_at > now()-30d)`
- **points_issued** = `Σ points_delta where transaction_type='earn'` (liability created)
- **points_redeemed** = `Σ |points_delta| where transaction_type='redeem'` (liability burned)
- **redemptions** = `count(transactions where transaction_type='redeem')`
- **points_outstanding** (liability) = `Σ points_balance over all profiles`
- **redemption_rate** = `points_redeemed / points_issued`
  — share of issued points that customers have redeemed. **Divide-by-zero guarded**:
  `computeRedemptionRate` returns 0 when `points_issued = 0`. The value can exceed 100%
  if historical *adjustments* added balance later redeemed (the live seed has issued=150,
  redeemed=200 → 133%); the UI shows the true percentage rather than clamping the number.
- **series[day]** = per-day `(issued = Σ earn delta, redeemed = Σ |redeem delta|)`,
  gap-filled across `days` via `generate_series`, bucketed in `America/Denver`.
- **top_customers** = top 5 profiles by `total_points_earned` (staff excluded), ties
  broken by balance then id.

---

## 3. New migration + security rationale

`admin_analytics_extended(integer)` mirrors the existing RPC pattern verbatim:
- `security definer`, `set search_path = public`;
- **first statement** is `if not public.is_admin(auth.uid()) then raise … errcode '42501'`
  — no data is touched before the admin check;
- `revoke all … from anon, public` + `grant execute … to authenticated` only.

**Verified live** (impersonating via `request.jwt.claims`):
- Non-admin caller → rejected with SQLSTATE `42501` (no data returned).
- Admin caller → correct payload; `series` gap-filled; `day` = `YYYY-MM-DD` (len 10).
- `pg_proc`: `security_definer=true`, `config={search_path=public}`,
  grants = `{authenticated=EXECUTE, service_role=EXECUTE, postgres=EXECUTE}` (NOT anon/public).
- The temporary admin promotion used for testing was **reverted**; the test fixture
  profile is back to `is_admin=false`.

### `get_advisors` result (after applying)
- **Security:** the only lint touching my function is `0029
  authenticated_security_definer_function_executable` for `admin_analytics_extended` —
  the SAME expected/justified warning the existing 6 admin RPCs already carry
  (documented in PHASE_2_BUILD_COMPLETE §Advisors). It is intentional: this is the
  app's admin RPC surface, it re-checks `is_admin` internally, and SECURITY DEFINER is
  required to aggregate across all rows under RLS. The pre-existing
  `auth_leaked_password_protection` WARN is Phase-10 scope, untouched by me.
- **Performance:** only the two pre-existing INFO `unused_index` notices
  (`audit_log_created_idx`, `profiles_qr_token_idx`); nothing introduced by me.

---

## 4. How each acceptance criterion is met

1. **Trust boundary server-side (not hidden UI).** Route guarded by `(admin)/layout.tsx`
   (`is_admin` re-read). EVERY admin Server Action begins with `requireAdmin()`
   (`getUser()` + `is_admin` re-read), returning a friendly rejection and performing NO
   mutation for a non-admin. Each mutating RPC (`adjust_points`) ALSO re-checks admin and
   raises 42501 (third layer). Analytics/top-customer aggregates run ONLY through
   `admin_analytics()` / `admin_analytics_extended()` — verified to reject a non-admin
   with 42501. A logged-in non-admin POSTing `adjustPointsAction` / `redeemOnBehalfAction`
   / `loadCustomersAction` hits `requireAdmin` first → `{ok:false}` and no DB write.

2. **Manual adjustment requires a reason.** `adjustPointsSchema.reason.min(3)` (client +
   server) AND the `adjust_points` RPC raises `reason required` (22023). The RPC writes
   the `adjustment` ledger row (with the *applied*, floor-corrected delta — mig
   20260610013637) + the `audit_log` entry with the admin's uid as actor, atomically.
   No double audit-write in the action (the RPC owns it).

3. **Search + pagination correct; balances match the ledger.** Keyset pagination on
   `(created_at desc, id desc)` — no offset, so no dup/skip across page boundaries.
   Search and cursor are two separate `.or()` filters; verified via postgrest-js URL
   output that they emit as two `or=` params (AND-combined) → `(search) AND (cursor)`,
   correct. Balance shown is `profiles.points_balance` (the ledger-synced cache);
   lifetime is `total_points_earned`. Like-wildcards in the search term are escaped.

4. **Analytics math correct.** Spot-checked against live data: issued=150, redeemed=200,
   redemptions=2, outstanding=70, redemption_rate=133.3% (issued<redeemed in the seed),
   series shows all activity on 2026-06-10, gap-filled zeros elsewhere. Redemption-rate
   formula stated above; divide-by-zero guarded.

5. **No service-role key in the admin chain.** Every read uses the RLS-bound
   `@/lib/supabase/server` (admin read-all RLS); every mutation goes through a SECURITY
   DEFINER RPC. No `service`/`SUPABASE_SERVICE_ROLE_KEY` import anywhere in
   `src/actions/admin.ts`, `src/lib/*.server.ts`, or the admin components.

6. **Design gate.** Dark mode via tokens only (no hardcoded #fff/#000 in these surfaces).
   Responsive (max-w-3xl portal, 2→3 col KPI grid, segmented nav fits tablet/phone).
   A11y: labels on every input, ≥44pt targets, visible focus rings, state never by color
   alone (nav active = fill+weight+aria-current; adjust direction = fill+aria-pressed;
   chart legend + SR table; tx rows = icon+sign+color), errors are `role="alert"`,
   `aria-live` status lines, chart `role="img"` + hidden data table.

---

## 5. Real gate output

```
$ rm -rf .next && npx tsc --noEmit
TSC EXIT: 0

$ npm run lint
 ✔ No ESLint warnings or errors
LINT EXIT: 0
(only the known nested-worktree "multiple lockfiles" warning — environmental non-defect.
 Targeted `npx eslint --no-eslintrc -c .eslintrc.json <all changed files>` also EXIT 0.)

$ npm run build
 ✓ Compiled successfully in 14.7s
 ✓ Generating static pages (23/23)
BUILD EXIT: 0
Routes present: /analytics, /customers, /customers/[id], /scan (all ƒ dynamic).
```

---

## 6. Deviations / open questions / not finished

- **D-1 (deviation): Redeem-on-behalf uses `adjust_points`, not `redeem_points`.**
  PLAN §Phase 9 lists "Redeem on behalf (→ `redeem_points`)", but the Phase-2
  `redeem_points(pts)` RPC redeems for `auth.uid()` — the SESSION user — and cannot debit
  another customer. The correct admin-authorized, audited way to debit a TARGET customer
  is `adjust_points` with a negative delta of the canonical `rewards_config.redeem_threshold`,
  reason-tagged `"Reward redeemed in person (staff)"`. This writes an `adjustment` ledger
  row + `audit_log` with the admin as actor. Eligibility (`balance >= threshold`) is
  re-checked server-side before the debit. Trade-off: the ledger row is typed
  `adjustment`, not `redeem`, so a staff in-person redemption is auditable as a staff
  action but doesn't increment `total_redemptions` or count toward the `redemptions` KPI.
  If the program wants in-person redemptions counted as redemptions, a future migration
  should add an admin `redeem_points_for(target, pts)` RPC (mirrors `add_points`'s
  admin-checked target pattern). Flagged for auditor/orchestrator decision.

- **D-2 (decision): chart is dependency-free inline SVG** (per §5 latitude) — no charting
  lib added; renders server-side, zero client JS.

- **D-3 (note): live seed data is internally inconsistent** (issued 150 vs redeemed 200,
  balance 70 ≠ 150−200) — pre-existing test fixture, NOT introduced or "fixed" by Phase 9
  (the ledger is append-only; we never hard-edit it). Analytics faithfully report what the
  RPCs compute; redemption rate correctly shows >100% as a result.

- **O-1 (open): manual UI/realtime verification not run in a browser.** The customer-card
  live update after an admin scan/adjust is a Phase-4 realtime concern; gates (tsc/lint/
  build) and DB-level RPC behaviour are verified, but no Playwright/manual click-through
  was performed in this worktree. Recommend the Verifier exercise the flows in-browser.
