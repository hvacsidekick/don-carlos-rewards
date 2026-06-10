# Phase 2 — RE-AUDIT REPORT 🔁 (hostile verification)

**Project:** Don Carlos Rewards App
**Phase:** 2 of 12 — Database Schema + Supabase Setup + RLS
**Role:** Re-Auditor (independent, hostile — "assume the fix is fake until proven")
**Date:** 2026-06-09
**Target DB:** live dev project `uxgcyvexeehvhtuhmztc` (PostgreSQL 17)
**Inputs:** `PHASE_2_FIXER_REPORT.md`, `PHASE_2_AUDIT_REPORT.md`
**Method:** Every Fixer claim re-tested against the **live** DB via direct SQL. All
fixtures created inside explicit transactions and **rolled back**; DB confirmed
residue-free afterward (`profiles=0, transactions=0, audit_log=0, auth.users=0`).

---

## Executive Verdict

### Grade: **A** — ✅ APPROVED. 0 blocking issues. Forward to Verifier.

Both MAJOR findings (M-1 ledger integrity, M-2 grant hardening) and both actionable
MINORs (m-2 anon 500, m-1 config/reproducibility) are **independently confirmed
fixed on the live DB** — not taken on the Fixer's word. The deployed `adjust_points`
source matches the migration, the regression test proves the ledger invariant holds
after flooring, the grant table is exactly the minimal spec, and the previously
verified core model (V-1…V-17) remains intact (re-spot-checked: authz, RLS isolation,
column guard, redeem floor + happy path all still pass).

| Severity | Count | Items |
|---|---|---|
| 🔴 Critical / Blocking | 0 | — |
| 🟠 Major | 0 | M-1 ✅ fixed · M-2 ✅ fixed |
| 🟡 Minor (remaining, non-blocking) | 2 | m-1 (CLI round-trip not *executed* — env limitation, configured correctly) · m-3 (`is_admin` boolean oracle — accepted by original audit) |

---

## Fix-by-fix verification evidence

### ✅ M-1 — `adjust_points` records the applied (floored) delta — CONFIRMED

**Source-of-truth check (live deployed function == migration):** Dumped
`pg_get_functiondef('public.adjust_points(uuid,integer,text)')` from the live DB.
It matches `20260610013637_fix_adjust_points_ledger_delta.sql` byte-for-byte:
reads+locks the old balance (`select points_balance ... for update`), computes
`new_bal := greatest(old_bal + delta, 0)` and `applied_delta := new_bal - old_bal`,
and writes **`applied_delta`** into both `transactions.points_delta` and the
`write_audit` delta — never the raw `delta`. Confirmed it is **`LEAST(new_bal,?)`-style
floored applied delta**, i.e. `new_bal - old_bal` after a `greatest(...,0)` floor.

**Regression test (live, rolled back) — the exact audit scenario:**
seed admin + target, `add_points(target,+50)`, then `adjust_points(target,−100,…)`
(must floor balance to 0), then assert the invariant.

```
add_points(target, +50)          -> earn        delta=+50  balance_after=50
adjust_points(target, -100, ...) -> adjustment  delta=-50  balance_after=0   (floored)
```

**Assertion output (actual live result):**

| metric | value | meaning |
|---|---|---|
| `actual_balance` | **0** | profile balance after flooring |
| `sum_ledger_delta` (Σ points_delta) | **0** | +50 + (−50) |
| `invariant_balance_eq_sum` | **true** ✅ | **Σ points_delta == points_balance** |
| `adjustment_delta` | **−50** | applied delta recorded (NOT the raw −100) |
| `adjustment_balance_after` | **0** | |
| `row_internally_consistent` (50 + delta == after) | **true** ✅ | row reconciles |
| `audit_delta` | **−50** | audit records the applied delta too |
| `ledger_rows` | **2** | earn + adjustment |

The original audit reproduced `Σ = −50 ≠ balance 0` with a `{delta:−100, after:0}`
row for this same sequence. **The invariant now holds; the #1 correctness property
is restored.** Verdict: **M-1 genuinely fixed.**

---

### ✅ M-2 — over-broad default grants revoked; minimal re-grant — CONFIRMED

**Live grant audit** (`information_schema.role_table_grants`, schema=public,
roles anon+authenticated, tables profiles/transactions/audit_log):

| grantee | profiles | transactions | audit_log |
|---|---|---|---|
| `anon` | *(none)* | *(none)* | *(none)* |
| `authenticated` | `SELECT, UPDATE` | `SELECT` | `SELECT` |

- `anon` holds **zero** privileges on all three user tables (cross-checked:
  `anon_grants_on_user_tables = 0`).
- The latent `INSERT / DELETE / TRUNCATE / REFERENCES / TRIGGER` grants the original
  audit found on both roles are **gone**.
- `authenticated` retains exactly the spec minimum: `SELECT+UPDATE` on `profiles`
  (UPDATE gated by the column guard + RLS), `SELECT` on `transactions` and
  `audit_log`. Matches `20260610013736_harden_table_grants.sql` (`revoke all … ;
  grant select, update on profiles; grant select on transactions/audit_log`).

**No regression to legitimate paths** (rolled-back tx): non-admin `redeem_points(10)`
on a 30-pt user → balance **20**, `total_redemptions=1`, ledger Σ=−10 ✅; the
SECURITY DEFINER write path still works despite the tightened table grants.

Verdict: **M-2 genuinely fixed** — implementation now matches the documented
"minimal privileges, RLS+guard are the gate" model.

#### ✅ m-2 (anon profiles 500) — CONFIRMED fixed for free
`set local role anon; select … from public.profiles` →
```
ERROR: 42501: permission denied for table profiles
HINT:  Grant the required privileges to the current role with: GRANT SELECT ON public.profiles TO anon;
```
Clean **table-level** denial *before* policy/`is_admin` evaluation — replaces the
prior `42501 permission denied for function is_admin` (the 500-class sharp edge).

---

### ✅ m-1 — `config.toml` present + filenames reconciled — CONFIRMED (config), see caveat

- **`supabase/config.toml` exists** with `project_id = "uxgcyvexeehvhtuhmztc"` and
  `db.major_version = 17` (matches live PG17), seed wired to `./seed.sql`. ✅
- **Filename/version drift resolved:** the 14 on-disk migration filenames map
  **1:1 and in order** to the 14 rows in `list_migrations`
  (`20260610011350_extensions_helpers` … `20260610013736_harden_table_grants`).
  Confirmed by direct comparison. ✅

**Caveat (non-blocking, environment — not a Fixer defect):** the literal
`supabase db reset && supabase db push` round-trip could **not be executed** here —
the Supabase CLI binary is not installed/spawnable in this environment
(`supabase: command not found`), consistent with the documented Phase 1 Windows /
Defender blocker. The two *blockers the audit identified* (missing `config.toml`,
filename/version drift) are both resolved, so the round-trip is now correctly
**configured**; executing it requires the documented Defender-excluded CLI host.

**Compensating evidence that migrations apply clean from scratch:**
1. The live schema **is** the materialized result of applying these exact migrations
   (all tables/functions/policies/indexes present; 0 ERROR advisors).
2. Forward-migration ordering is correct: the buggy `adjust_points`
   (`…011444`) is superseded by the fix (`…013637`); the broad grants
   (`…011359/011419/011427`) are superseded by the revoke+regrant (`…013736`, the
   last migration). A fresh replay therefore converges to the verified final state.

---

## Core model — re-spot-checked (still PASS after the fixes)

To ensure the Fixer's grant/function changes did not regress the model the original
audit verified (V-1…V-17), I re-ran a representative hostile subset against live (all
rolled back):

| Check | Result |
|---|---|
| Non-admin `add_points` | `42501 not authorized` ✅ |
| `redeem_points` floor (0 balance) | `P0001 insufficient balance` ✅ |
| `redeem_points` happy path (30→20) | balance 20, redemptions 1, ledger Σ=−10 ✅ |
| Column guard vs direct `authenticated` UPDATE (`points_balance=99999, is_admin=true, total_points_earned=88888`) | all frozen: balance=20, is_admin=false, earned=30 ✅ |
| RLS read isolation (as Alice) | visible_profiles=1, sees_bob=0 ✅ |
| Security advisors | **6 WARN / 0 ERROR**, all `0029` for the intended RPC surface — unchanged & justified ✅ |
| DB residue after all tests | `profiles=0, transactions=0, audit_log=0, auth.users=0`; seed intact (`rewards_config=1, menu_items=28`) ✅ |

---

## Remaining issues

- 🟡 **m-1 (non-blocking, environment):** CLI round-trip configured but not executed
  in this environment (no Supabase CLI). Recommend CI/dev run `supabase db reset`
  on a Defender-excluded host once, to bank the literal proof. Not a code defect.
- 🟡 **m-3 (non-blocking, accepted):** `is_admin(uuid)` remains an `authenticated`-
  callable RPC (boolean admin-status oracle). Unavoidable — RLS policies call it.
  Original audit explicitly required "no action to pass." Carry forward as a noted
  acceptance.

No new issues introduced by the fixes. No blocking issues.

---

## Approval

**APPROVED — Grade A, 0 blocking issues.** M-1 and M-2 are independently verified
fixed on the live DB, the M-1 regression proves `Σ points_delta == points_balance`
after the negative floor (applied delta −50, not raw −100), grants are locked to the
minimal spec (anon: none; authenticated: SELECT+UPDATE/SELECT/SELECT), and the
core security model is intact. **Forwarded to Verifier.**

*Re-Auditor hand-off. Next: Verifier.*
