# Phase 2 — FIXER REPORT 🔧

**Project:** Don Carlos Rewards App
**Phase:** 2 of 12 — Database Schema + Supabase Setup + RLS
**Role:** Fixer
**Date:** 2026-06-09
**Target DB:** live dev project `uxgcyvexeehvhtuhmztc` (PostgreSQL 17.6)
**Input:** `PHASE_2_AUDIT_REPORT.md` (Grade **B+**, not approved — 2 MAJOR + 1 actionable MINOR)

---

## Summary

All three prioritized issues are fixed and verified against the **live** DB. Every
test ran inside an explicit transaction that was **rolled back**, so the database is
returned to its clean seed-only state (verified `profiles=0, transactions=0,
audit_log=0, auth.users=0` after the run).

| Audit ID | Severity | Status | Fix |
|---|---|---|---|
| **M-1** | 🟠 Major | ✅ Fixed + regression-tested | `adjust_points` now records the **actual applied delta** (`new_bal − old_bal`); ledger reconciles after flooring. |
| **M-2** | 🟠 Major | ✅ Fixed + verified | Revoked inherited `GRANT ALL` on `profiles`/`transactions`/`audit_log` from `anon`+`authenticated`; re-granted minimal `SELECT` (+`UPDATE` on `profiles`). |
| **m-2** | 🟡 Minor | ✅ Fixed for free | Anon `profiles` SELECT now a clean `42501 permission denied for table profiles` (was `permission denied for function is_admin`). Resolved by the M-2 revoke. |
| **m-1** | 🟡 Minor | ✅ Fixed | Added `supabase/config.toml` (`project_id`, `major_version = 17`); reconciled all 14 on-disk migration filenames with the applied history. |
| **m-3** | 🟡 Minor | ➖ Accepted (no action) | `is_admin` RPC boolean-oracle is unavoidable (RLS policies call it). Audit explicitly said "no action required to pass." |

No redesign was needed — the core security model the auditor verified (V-1…V-17)
is untouched. Security advisors remain at the justified baseline (**6 WARN / 0 ERROR**,
all `0029` for the intended RPC surface).

---

## Files modified

### New migrations (forward-only; applied to live DB)
| File | Purpose |
|---|---|
| `supabase/migrations/20260610013637_fix_adjust_points_ledger_delta.sql` | M-1 — corrected `adjust_points`. |
| `supabase/migrations/20260610013736_harden_table_grants.sql` | M-2 — revoke default grants, re-grant minimum. |

> Forward migrations, not history edits: the original (buggy) `adjust_points` stays
> in `…011444_points_functions.sql` and the original broad grants stay in migrations
> 02/05/06. A fresh `supabase db reset` replays buggy→fixed and broad→hardened to the
> **same** final state the live DB is now in. This is the correct, reproducible
> migration model.

### New config
| File | Purpose |
|---|---|
| `supabase/config.toml` | m-1 — CLI project config (`project_id = "uxgcyvexeehvhtuhmztc"`, `db.major_version = 17`, seed wired to `./seed.sql`). |

### Renamed migrations (m-1 — reconcile filenames with applied history)
On-disk versions were `20260609220001…220012` but the recorded history is
`20260610011350…012247` (migrations were applied via the MCP `apply_migration`
tool, which re-stamps versions). Renamed so `supabase db push` sees them as already
applied instead of failing on `already exists`:

| Old filename | New filename (matches `list_migrations`) |
|---|---|
| `20260609220001_extensions_helpers.sql` | `20260610011350_extensions_helpers.sql` |
| `20260609220002_profiles.sql` | `20260610011359_profiles.sql` |
| `20260609220003_guard_and_touch.sql` | `20260610011406_guard_and_touch.sql` |
| `20260609220004_new_user.sql` | `20260610011412_new_user.sql` |
| `20260609220005_transactions.sql` | `20260610011419_transactions.sql` |
| `20260609220006_audit_log.sql` | `20260610011427_audit_log.sql` |
| `20260609220007_points_functions.sql` | `20260610011444_points_functions.sql` |
| `20260609220008_rewards_config.sql` | `20260610011451_rewards_config.sql` |
| `20260609220009_menu.sql` | `20260610011459_menu.sql` |
| `20260609220010_analytics_admin.sql` | `20260610011508_analytics_admin.sql` |
| `20260609220011_harden_function_grants.sql` | `20260610011632_harden_function_grants.sql` |
| `20260609220012_perf_rls_initplan_and_fk_indexes.sql` | `20260610012247_perf_rls_initplan_and_fk_indexes.sql` |

After reconciliation the **14 on-disk files === 14 rows in `list_migrations`**, in
order. `database.types.ts` was **not** regenerated — `adjust_points`' signature and
return type are unchanged, and grants do not affect generated types.

---

## M-1 — `adjust_points` ledger inconsistency

### Root cause
`update … set points_balance = greatest(points_balance + delta, 0)` clamped the
balance, but the ledger insert recorded the **unclamped** `delta`. After an
over-floor adjustment, `Σ points_delta ≠ points_balance` and the row itself was
inconsistent (`old_bal + points_delta ≠ points_balance_after`).

### Fix (`…013637_fix_adjust_points_ledger_delta.sql`)
- `SELECT points_balance … FOR UPDATE` captures the pre-adjustment balance and
  locks the row (PG17 has no `OLD` in `UPDATE … RETURNING`; the lock also
  serialises concurrent admin adjustments on the same user).
- `new_bal := greatest(old_bal + delta, 0)`; `applied_delta := new_bal − old_bal`.
- Both the **ledger row** (`transactions.points_delta`) and the **audit entry**
  (`write_audit` delta) record `applied_delta` — never the unclamped value.

### Regression test (live, rolled back)
Reproduces the exact audit scenario: seed admin + target, `add_points(+50)`,
then `adjust_points(−100)` (floors to 0), then assert the invariant.

```
add_points(target, +50)         -> earn  delta=+50  balance_after=50  (balance=50)
adjust_points(target, -100,...) -> adjustment delta=-50 balance_after=0 (floored to 0)
```

Assertion result:

| metric | value | meaning |
|---|---|---|
| `actual_balance` | **0** | profile balance after flooring |
| `sum_ledger_delta` (Σ points_delta) | **0** | +50 + (−50) |
| `invariant_balance_eq_sum` | **true** ✅ | **Σ points_delta == points_balance** |
| `adjustment_delta` | **−50** | applied delta recorded (not −100) |
| `adjustment_balance_after` | **0** | |
| `row_internally_consistent` (50 + delta == after) | **true** ✅ | row reconciles |
| `audit_delta` | **−50** | audit records applied delta too |
| `ledger_rows` | **2** | earn + adjustment |

Before the fix (per audit) this same sequence produced `Σ = −50 ≠ balance 0` with a
`{delta:−100, after:0}` row. **Invariant now holds.**

---

## M-2 — over-broad default grants

### Root cause
Migrations 02/05/06 granted a subset to `authenticated` but never revoked
Supabase's default `GRANT ALL`, so both `anon` and `authenticated` held
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on `profiles`,
`transactions`, and `audit_log`. RLS was the only backstop.

### Fix (`…013736_harden_table_grants.sql`)
```sql
revoke all on public.profiles     from anon, authenticated;
revoke all on public.transactions from anon, authenticated;
revoke all on public.audit_log    from anon, authenticated;
grant select, update on public.profiles     to authenticated;
grant select         on public.transactions to authenticated;
grant select         on public.audit_log    to authenticated;
```
`menu_*` / `rewards_config` left public-readable as-is.

### Verification (live)

**Grant audit after fix** (`information_schema.role_table_grants`):

| grantee | profiles | transactions | audit_log |
|---|---|---|---|
| `anon` | *(none)* | *(none)* | *(none)* |
| `authenticated` | `SELECT, UPDATE` | `SELECT` | `SELECT` |

TRUNCATE / DELETE / INSERT latent grants are **gone**.

**No regression to legitimate paths** (rolled-back tx, acting as a non-admin
`authenticated` user "Alice" with 30 seeded points):

| check | result |
|---|---|
| Alice sees only her own profile (RLS isolation) | `visible_profiles = 1`, `sees_bob = 0` ✅ |
| Alice direct `UPDATE points_balance = 99999` (column guard) | frozen; balance unchanged ✅ |
| Alice `redeem_points(10)` (self-service DEFINER fn still works) | balance 30 → **20** ✅ |
| Alice ledger reconciles | `Σ points_delta = 20` ✅ |

### m-2 (fixed for free)
Anon `SELECT` on `profiles` now fails as a clean **table**-permission denial,
before policy/`is_admin` evaluation:

```
SQLSTATE = 42501
MESSAGE  = permission denied for table profiles
```
(Previously: `42501 permission denied for function is_admin` — the sharp 500-class
edge the audit flagged.)

---

## m-1 — CLI reproducibility

1. **`supabase/config.toml` added** with `project_id = "uxgcyvexeehvhtuhmztc"`,
   `db.major_version = 17` (matches live PG17), and seed wired to `./seed.sql`, so a
   fresh checkout can `supabase link` / `db reset` / `db push`.
2. **Filenames reconciled** with applied history (table above) → `supabase db push`
   no longer treats the 12 existing migrations as unapplied.
3. Windows caveat (CLI binary `spawnSync UNKNOWN` under Defender) is already
   documented in `WINDOWS_BUILD_NOTES.md`; `config.toml` references it.

> Note: the Supabase CLI binary still cannot spawn on this Windows machine
> (pre-existing Defender issue, Phase 1), so the literal `db reset`/`db push`
> commands were not executed here. The reproducibility blockers the audit
> identified — missing `config.toml` and filename/version drift — are both
> resolved, so the round-trip is now correctly *configured*; running it requires
> the documented Defender exclusion on the dev/CI host.

---

## Post-fix DB state

| Property | Value |
|---|---|
| `list_migrations` | 14 entries (12 original + 2 fixer), all matching on-disk filenames |
| Security advisors | 6 WARN / 0 ERROR — all `0029` for the intended RPC surface (unchanged, justified) |
| Seed data | intact (`rewards_config` + menu) |
| Test residue | none — `profiles=0, transactions=0, audit_log=0, auth.users=0` |

---

## Verification commands (for the re-auditor)

All reproducible against `uxgcyvexeehvhtuhmztc`:

- **M-1 invariant:** run the rolled-back regression block (admin + target,
  `add_points(+50)`, `adjust_points(−100)`, assert `Σ points_delta = points_balance`,
  `adjustment_delta = −50`).
- **M-2 grants:** `select grantee, table_name, privilege_type from
  information_schema.role_table_grants where table_schema='public' and table_name in
  ('profiles','transactions','audit_log') and grantee in ('anon','authenticated')`.
- **m-2:** `set local role anon; select * from public.profiles limit 1;` → expect
  `42501 permission denied for table profiles`.
- **m-1:** `diff` the migration filenames against `list_migrations`; confirm
  `supabase/config.toml` exists with the project ref.

---

## Recommendation

All MAJOR and actionable MINOR findings are resolved and independently verified
against the live DB; the verified core model (V-1…V-17) is preserved. **Ready for
re-audit — target Grade A.** Re-audit scope is the four touched areas only:
`adjust_points` ledger, table grants, anon `profiles` denial, and
`config.toml`/filename reconciliation.

*Fixer hand-off. Next: re-audit.*
