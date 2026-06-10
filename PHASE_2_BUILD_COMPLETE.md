# Phase 2 — BUILD COMPLETE 🛠️

**Project:** Don Carlos Rewards App
**Phase:** 2 of 12 — Database Schema + Supabase Setup + RLS
**Role:** Builder
**Date:** 2026-06-09
**Status:** Builder complete — ready for hostile Audit.
**Scope source:** `PHASE_2_TASK.md` · `PLAN.md` §Phase 2 (96–127) · `BLUEPRINT.md` §4–5

---

## 0. TL;DR

A fully migrated Supabase Postgres schema is live on the dev project
`don-carlos-rewards` (ref `uxgcyvexeehvhtuhmztc`): 6 tables with RLS on every one,
an append-only ledger, atomic `SECURITY DEFINER` points functions as the **only**
write path to balances, a hardened column guard, profile-bootstrap + updated_at
triggers, indexes, an idempotent menu/`rewards_config` seed, generated TypeScript
types (tsc clean), and a documented admin-promotion path. **The #1 correctness
property — points can only change through the audited functions — is implemented
and proven by test.**

---

## 1. Supabase project

| | |
|---|---|
| Name | `don-carlos-rewards` |
| Ref | `uxgcyvexeehvhtuhmztc` |
| URL | `https://uxgcyvexeehvhtuhmztc.supabase.co` |
| Org / region | HVAC SIdekick (`kvqiifcghpaaaqfdghft`) · `us-west-1` |
| Cost / engine | Free ($0/mo) · Postgres 17 |

`.env.local` holds the real URL + anon key; `SUPABASE_SERVICE_ROLE_KEY` is a
documented placeholder (secret — fetch from dashboard, see README). Ref recorded
in `BLUEPRINT.md` §10.5.

---

## 2. What was built

### Migrations (`supabase/migrations/`, applied in order)

| # | File | Contents |
|---|------|----------|
| 01 | `…01_extensions_helpers` | `pgcrypto` |
| 02 | `…02_profiles` | `profiles` + qr_token/partial-admin indexes + `is_admin()` helper + RLS (select own-or-admin, update own) |
| 03 | `…03_guard_and_touch` | hardened `guard_profile_update()` + `touch_updated_at()` triggers |
| 04 | `…04_new_user` | `handle_new_user()` → profile bootstrap on `auth.users` insert |
| 05 | `…05_transactions` | `tx_type` enum, `transactions` ledger + `(user_id, created_at desc)` index + RLS (select own-or-admin) |
| 06 | `…06_audit_log` | `audit_log` + `write_audit()` + admin-read RLS |
| 07 | `…07_points_functions` | `add_points`, `redeem_points`, `adjust_points`, `rotate_qr_token` |
| 08 | `…08_rewards_config` | singleton `rewards_config` + public-read RLS |
| 09 | `…09_menu` | `menu_categories`, `menu_items` + index + public-read (active) RLS |
| 10 | `…10_analytics_admin` | `admin_analytics()` RPC + `promote_to_admin()` bootstrap (service-role only) |
| 11 | `…11_harden_function_grants` | security-advisor remediation: pin `touch_updated_at` search_path; revoke EXECUTE for `anon`/internal fns |
| 12 | `…12_perf_rls_initplan_and_fk_indexes` | perf-advisor remediation: `(select auth.uid())` in all 4 policies; covering indexes on `staff_id`/`actor_id` FKs |

Indexes required by PLAN §Phase 2 all present: `transactions(user_id, created_at desc)`,
`profiles(qr_token)`, `profiles(is_admin) where is_admin`.

### Seed (`supabase/seed.sql`, idempotent)
`rewards_config` (1 pt/$, 100-pt threshold = $10 off, 10 stamps) + **7 categories /
28 items** of realistic Don Carlos menu ($2–$11.50).

### Generated types
`src/lib/database.types.ts` — `tsc --noEmit` exits 0.

---

## 3. Points integrity — design & the documented deviation

**Invariant:** `profiles.points_balance` is never written by a client.
`transactions` is the append-only ledger; the balance is a cache the functions
keep in sync **atomically** (single statement, single transaction, row-locked).

- `add_points(target, pts, amount_cents?, note?)` — **admin only** (`42501` else);
  `0 < pts ≤ 100000`; increments balance + lifetime-earned; writes `earn` tx.
- `redeem_points(pts)` — **self**; `WHERE points_balance >= pts` makes the debit
  atomic and prevents negatives under concurrency; writes `redeem` tx.
- `adjust_points(target, delta, reason)` — **admin only**, signed, reason required;
  floors at 0; writes `adjustment` tx **and** an `audit_log` row.
- `rotate_qr_token(target?)` — self or admin.

### Deviation from `BLUEPRINT.md` §4.3 (intentional, stronger)

The BLUEPRINT's guard allowed the update when `is_admin(auth.uid())`. That **breaks
`redeem_points` / `rotate_qr_token`**, whose caller is a *non-admin* updating their
*own* row — the guard would freeze their legitimate change. Neither `current_user`
(rewritten to the owner under SECURITY DEFINER) nor `session_user` (still
`authenticated` either way) can distinguish a trusted in-function update from a
hostile direct one inside the trigger.

**Implemented instead:** the guard gates on a **transaction-local GUC flag**,
`app.points_ctx`, that only the trusted functions set (`set_config(..., true)`)
around their writes. Everything else — direct PostgREST `UPDATE` as `authenticated`,
*or even a raw service-role `UPDATE`* — is frozen to OLD values for
`points_balance, total_points_earned, total_redemptions, is_admin, qr_token`.
Admin promotion is therefore routed through `promote_to_admin()` (sets the flag;
revoked from `authenticated`). Recorded in `BLUEPRINT.md` §10.5 and `PHASE_2_TASK.md` §3.

---

## 4. Tests run (all PASS)

Executed under simulated `authenticated` JWTs (`set local role authenticated` +
`request.jwt.claims`) against the live DB; fixtures removed afterward (clean
seed-only state verified).

| # | Test | Result |
|---|------|--------|
| Bootstrap | Insert `auth.users` → profile auto-created w/ non-null `qr_token` (×3) | ✅ |
| RLS read | Alice sees own profile (1), **not** Bob's profile/tx (0/0) | ✅ |
| **Column guard** | Alice `UPDATE …points_balance=99999, is_admin=true` → both frozen (0 / false); `display_name` change passes | ✅ |
| Authz | `add_points` & `adjust_points` by non-admin → `42501 not authorized` | ✅ |
| Redeem floor | `redeem_points(100)` with 0 balance → `insufficient balance` | ✅ |
| Admin add | admin `add_points(150,$150)` → balance 150, lifetime 150, one `earn` tx, `balance_after`=150, `staff_id`=admin (atomic) | ✅ |
| Redeem | self `redeem_points(100)` → balance 50, `redemptions` 1, `redeem` tx −100 | ✅ |
| Adjust + audit | admin `adjust_points(−10,reason)` → balance 40, `adjustment` tx, `audit_log` row w/ admin actor | ✅ |
| Ledger consistency | Σ `points_delta` (150 − 100 − 10) = 40 = `points_balance` | ✅ |

---

## 5. Advisors

`get_advisors(security)` after hardening: **6 WARN, all justified**, 0 ERROR.

All six are `0029 authenticated_security_definer_function_executable` for the app's
intended RPC surface — `add_points`, `redeem_points`, `adjust_points`,
`rotate_qr_token`, `admin_analytics`, `is_admin`. These **must** be both
SECURITY DEFINER (to write the ledger / bypass RLS / be callable inside policies)
and callable by signed-in users; each re-checks auth/admin internally. Making them
INVOKER or revoking EXECUTE would break the app. Cleared by migration 11: every
`anon`-executable warning, every trigger-function exposure
(`guard_profile_update`, `handle_new_user`, `touch_updated_at`, `write_audit`),
and the `0011 function_search_path_mutable` warning on `touch_updated_at`.

`get_advisors(performance)` after migration 12: **0 WARN/ERROR**. The four
`0003 auth_rls_initplan` WARNs (per-row `auth.uid()` re-evaluation) and both
`0001 unindexed_foreign_keys` items are resolved. Only `0005 unused_index` INFO
remain (4) — false positives on a zero-traffic fresh DB; each index is required by
PLAN §Phase 2 and exercised in Phases 5/9 (`qr_token` scan resolution, audit
time-ordering, admin staff/actor lookups).

---

## 6. Acceptance criteria (PLAN §Phase 2)

| Criterion | Status |
|---|---|
| Migrations apply cleanly from scratch | ✅ 11/11 applied & recorded |
| RLS enabled on every `public` table | ✅ all 6 |
| Non-admin cannot read others' profile/tx | ✅ (test) |
| Non-admin cannot UPDATE `points_balance` | ✅ guard freezes (test) |
| `add_points` rejects non-admin; admin atomic | ✅ (test) |
| `redeem_points` rejects < threshold; success decrements + logs | ✅ (test) |
| New `auth.users` → profile w/ `qr_token` | ✅ (test) |
| `get_advisors` clean or justified | ✅ 6 WARN justified (§5) |
| Generated types compile | ✅ `tsc --noEmit` exit 0 |

---

## 7. Notes / handoffs

- **Account deletion (Phase 10):** `transactions.staff_id` and `audit_log.actor_id`
  are intentionally **non-cascading** (preserve audit trail). GDPR purge must
  null/anonymize these references rather than rely on cascade — a hard delete of a
  profile that processed transactions will otherwise be blocked by the FK.
- **First admin:** no admin exists yet on the dev DB (test fixtures removed). Promote
  the owner immediately after first sign-up via `promote_to_admin` (README).
- **Out of scope (untouched):** UI, auth flows — only the `handle_new_user` trigger
  plumbing was built, per PLAN.

---

## 8. Files changed / added

```
supabase/migrations/20260609220001_extensions_helpers.sql      (new)
supabase/migrations/20260609220002_profiles.sql                (new)
supabase/migrations/20260609220003_guard_and_touch.sql         (new)
supabase/migrations/20260609220004_new_user.sql                (new)
supabase/migrations/20260609220005_transactions.sql            (new)
supabase/migrations/20260609220006_audit_log.sql               (new)
supabase/migrations/20260609220007_points_functions.sql        (new)
supabase/migrations/20260609220008_rewards_config.sql          (new)
supabase/migrations/20260609220009_menu.sql                    (new)
supabase/migrations/20260609220010_analytics_admin.sql         (new)
supabase/migrations/20260609220011_harden_function_grants.sql  (new)
supabase/migrations/20260609220012_perf_rls_initplan_and_fk_indexes.sql (new)
supabase/seed.sql                                              (new)
src/lib/database.types.ts                                      (new, generated)
.env.local                                                     (real URL + anon key)
BLUEPRINT.md                                                   (§10.5 deployment + deviation note)
README.md                                                      (Database + admin-promotion + service-role-key)
PHASE_2_TASK.md                                                (new, scope)
PHASE_LOG.md                                                   (Phase 2 builder entry)
```

*Builder hand-off. Next: hostile Auditor pass (functionality+security & RLS
boundaries), per `PLAN.md` §6.*
