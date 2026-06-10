# Phase 2 — HOSTILE AUDIT REPORT 🔍

**Project:** Don Carlos Rewards App
**Phase:** 2 of 12 — Database Schema + Supabase Setup + RLS
**Role:** Auditor (independent, hostile)
**Date:** 2026-06-09
**Auditor stance:** Assumed broken until proven. Every claim re-tested against the **live** dev DB (`uxgcyvexeehvhtuhmztc`) via direct SQL under simulated `anon`/`authenticated`/`service_role` JWT contexts. Fixtures created and removed; DB returned to clean seed-only state (verified `profiles=0, transactions=0, audit_log=0, auth.users=0`).

---

## Executive Verdict

### Grade: **B+** — NOT approved. Return to Fixer for 2 MAJOR issues. No critical/blocking defects; no exploitable data breach.

The **core security model is genuinely strong and proven by test**: RLS is enabled on all 6 tables, cross-user read isolation holds, the column guard freezes every sensitive column against a direct `authenticated` **and** raw `service_role` UPDATE, all SECURITY DEFINER functions are correctly DEFINER + `search_path`-pinned, authz rejects non-admins with `42501`, and the atomic redeem WHERE-guard is correct. tsc is clean; advisors are clean/justified.

However, hostile testing surfaced **one real points-integrity defect** (the app's #1 correctness property) and **one defense-in-depth / documentation-accuracy gap**, plus a **reproducibility gap** in the migration tooling. None are live-exploitable, but the first directly contradicts the headline claim that "the ledger reconciles with the balance," so the phase should not be marked Verified until fixed.

| Severity | Count | Items |
|---|---|---|
| 🔴 Critical / Blocking | 0 | — |
| 🟠 Major | 2 | M-1 `adjust_points` ledger inconsistency · M-2 over-broad default grants not revoked |
| 🟡 Minor | 3 | m-1 migration reproducibility (no `config.toml` + version drift) · m-2 anon `profiles` SELECT → 500 · m-3 `is_admin` RPC probe |

---

## What was independently VERIFIED (PASS) ✅

All of these I re-ran myself against the live DB — not taken on the builder's word.

| # | Property | Evidence (live test) |
|---|----------|----------------------|
| V-1 | **RLS enabled on all 6 tables** | `pg_tables` → `rowsecurity=true` for profiles, transactions, audit_log, rewards_config, menu_categories, menu_items. |
| V-2 | **All 12 migrations recorded & schema fully materialized** | `list_migrations` → 12 entries (extensions…perf_rls). All tables/functions/indexes present. |
| V-3 | **Function security posture** | All 7 RPCs `SECURITY DEFINER` + `search_path=public`. `touch_updated_at` is INVOKER but `search_path`-pinned. EXEC roles correct: RPCs→`{authenticated,service_role}` (anon revoked); `guard_profile_update`/`handle_new_user`/`write_audit`/`promote_to_admin`→`{service_role}` only. |
| V-4 | **Profile bootstrap** | Inserting 2 `auth.users` auto-created 2 profiles with non-null `qr_token` + `display_name` from `raw_user_meta_data`. |
| V-5 | **RLS read isolation** | As Alice: sees **1** profile (own), **0** of Bob's profile, **0** of Bob's transactions, **0** audit rows. `auth.uid()` resolved correctly. |
| V-6 | **Column guard vs `authenticated`** | Alice `UPDATE points_balance=99999, total_points_earned=88888, total_redemptions=777, is_admin=true, qr_token=…` → **all frozen** (0/0/0/false/unchanged); `display_name` change passed. |
| V-7 | **Column guard vs `service_role`** (the stronger claim) | service_role `UPDATE points_balance=50000, is_admin=true` → **frozen** (0/false). Confirmed: no role can write points outside the audited functions. |
| V-8 | **Authz `add_points`** | non-admin → `ERROR 42501: not authorized`. |
| V-9 | **Authz `adjust_points`** | non-admin → `ERROR 42501: not authorized`. |
| V-10 | **`redeem_points` floor** | redeem 100 on 0 balance → `ERROR P0001: insufficient balance`. |
| V-11 | **Admin happy path + admin-read-all** | admin `add_points(50)` → earn tx, balance 50; admin RLS let Alice read Bob's profile **and** ledger (proves admin-read-all). |
| V-12 | **Redeem atomicity** | By inspection: single-statement `UPDATE … WHERE id=uid AND points_balance>=pts RETURNING` takes an implicit row lock → concurrent debits cannot drive a negative balance. Correct pattern. |
| V-13 | **RLS contains the over-broad grants** | Forged `INSERT` into transactions as authenticated → `42501 RLS violation`; `DELETE` audit_log → 0 rows; anon `INSERT` profiles → `42501 RLS violation`. RLS holds for every PostgREST-reachable write. |
| V-14 | **Anon public reads** | anon reads `menu_items` (28) and `rewards_config` (1); cannot read user tables. |
| V-15 | **Security advisors** | Exactly **6 WARN**, all `0029` for the intended RPC surface, **0 ERROR** — matches build claim and justified (each re-checks authz internally; DEFINER required to write ledger). |
| V-16 | **Performance advisors** | **0 WARN/ERROR**; 2 INFO `unused_index` (fresh-DB false positives). |
| V-17 | **Types compile** | `npx tsc --noEmit` → **exit 0** (verified real exit code, not piped). `database.types.ts` covers all 6 tables + all 7 functions. |

The guard's GUC-flag deviation from BLUEPRINT §4.3 is **sound and strictly stronger** — confirmed by V-6/V-7. I endorse it.

---

## Issues

### 🟠 M-1 (MAJOR) — `adjust_points` corrupts the ledger when flooring below zero

**This breaks the #1 stated correctness property: "Σ points_delta = points_balance."**

`adjust_points` clamps the balance with `greatest(points_balance + delta, 0)` but writes the **unclamped** `delta` into the ledger row.

**Live proof** (admin path, single transaction, rolled back):
```
add_points(Bob, +50)      -> earn  delta=+50  balance_after=50   (balance=50)
adjust_points(Bob, -100)  -> adjustment delta=-100 balance_after=0  (balance floored to 0)

RESULT:
  actual_balance        = 0
  Σ ledger points_delta = -50      <-- does NOT equal balance (0)
  adjustment row        = {delta:-100, balance_after:0}   <-- 50 + (-100) ≠ 0
```
The append-only ledger is supposed to be the source of truth, but after any over-floor adjustment it no longer reconciles with `points_balance`, and the row's own `points_delta` / `points_balance_after` are mutually inconsistent. This silently corrupts audit/accounting and will mislead Phase 6 (transaction history) and Phase 9 (admin analytics / `points_issued`).

- **Trigger:** admin adjusts a user by a negative delta larger than their current balance. Admin-only and an edge case, but a trusted admin doing a routine correction hits it.
- **Why the builder missed it:** test #9 only summed an in-range sequence (`150 − 100 − 10 = 40`); it never adjusted past zero.

**Fix (Fixer):** make the recorded delta equal the **actual applied change**. Capture old balance and record `new_bal − old_bal`:
```sql
update public.profiles
  set points_balance = greatest(points_balance + delta, 0)
  where id = target
  returning points_balance, points_balance - greatest(points_balance,0) /* old */ into new_bal, ...;
-- simplest: read old_bal first, then record points_delta := new_bal - old_bal
```
…or reject the operation (`raise exception` 'would drive balance below zero') instead of silently flooring. Either keeps the invariant. Re-add a regression test that adjusts below zero and asserts `Σ delta = balance`.

---

### 🟠 M-2 (MAJOR) — Supabase default grants never revoked; "minimal base privileges" claim is false

Migration 02/05/06 grant a *subset* (`select`/`update`) to `authenticated` with the comment *"Minimal base privileges for the API roles (RLS remains the gate)"* — but they never **revoke** Supabase's default `GRANT ALL`. Live grant audit:

```
anon          → SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
authenticated → SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
   on  public.profiles, public.transactions, public.audit_log
```

So `anon` and every signed-in user hold **full DML + TRUNCATE** on the profile, ledger, and audit tables at the grant level. The **only** thing preventing a breach is RLS.

- **Currently contained:** V-13 proves RLS blocks every PostgREST-reachable write (forged ledger insert, audit delete, anon profile insert all denied). TRUNCATE is RLS-exempt but **not** reachable via PostgREST (no raw-SQL path as anon/authenticated), so not directly exploitable today.
- **Why it's still MAJOR:**
  1. The implementation contradicts the documented design — there is **zero grant-level backstop**; the entire security model rests on RLS being flawless in every present and future migration.
  2. **Blast-radius amplifier:** the moment any later phase adds a permissive write policy (e.g. Phase 9 admin UPDATE), these latent grants widen the exposure beyond intent.
  3. It produces a real error path (see m-2).

**Fix (Fixer):** explicitly lock down, then re-grant the minimum:
```sql
revoke all on public.profiles, public.transactions, public.audit_log from anon, authenticated;
grant select, update on public.profiles to authenticated;   -- update gated by guard+policy
grant select on public.transactions to authenticated;
-- audit_log: authenticated needs SELECT only (admin-read policy); anon: nothing
grant select on public.audit_log to authenticated;
```
Leave `menu_*` / `rewards_config` public-readable as-is.

---

### 🟡 m-1 (MINOR) — Migrations not reproducible via the prescribed CLI path

The acceptance criterion is *"Migrations apply cleanly from scratch (`supabase db reset` + `supabase db push`)."* This **cannot be executed as written**:

1. **No `supabase/config.toml`** — the repo is not a CLI-initialized Supabase project. `supabase db reset/push/pull` require `init`/`link` first; a new dev or CI cannot round-trip.
2. **Version drift:** on-disk filenames are `20260609220001…220012`, but the recorded history is `20260610011350…012247` (migrations were applied via the MCP `apply_migration` tool, which re-stamped versions). `supabase db push` from these files against the current remote would treat all 12 as unapplied and fail on `already exists`.
3. The Supabase **CLI binary fails to spawn on this machine** (`spawnSync … UNKNOWN`, consistent with the Phase 1 Windows-Defender notes), so the literal command pair is unverifiable here.

**Mitigating fact:** the DDL itself is well-ordered and demonstrably valid — the live schema *is* the successful application of these exact statements, and ordering (extensions→profiles→guard→new_user→transactions→audit→points_fns→rewards→menu→analytics→harden→perf) is correct. So this is a **tooling/reproducibility** gap, not a broken-SQL gap.

**Fix (Fixer):** add `supabase/config.toml` (with `project_id`), `supabase init`/`link`, and reconcile the local filenames with the applied history (e.g. `supabase migration repair` or renaming files to the applied versions) so `db reset` on a fresh shadow DB and `db push` round-trip. Add a CI note that the CLI binary must be Defender-excluded on Windows.

---

### 🟡 m-2 (MINOR) — Anon SELECT on `profiles` raises `42501` (500) instead of returning empty

Because `anon` retains the table-level SELECT grant (M-2) but had `EXECUTE` on `is_admin` revoked (migration 11), evaluating the `profiles_select_own` policy as anon throws:
```
ERROR: 42501: permission denied for function is_admin
```
No data leaks (the policy would return 0 rows anyway), but an unauthenticated `/rest/v1/profiles` request returns a 500-class error rather than a clean empty/403. A sharp edge for any anon-facing code that ever touches `profiles`. **Resolved for free by the M-2 fix** (revoking anon's table grant makes it a clean table-permission denial before policy evaluation).

---

### 🟡 m-3 (MINOR) — `is_admin(uuid)` exposed as an RPC lets any signed-in user probe arbitrary admin status

`is_admin` is `EXECUTE`-able by `authenticated` and reachable at `/rest/v1/rpc/is_admin`, so a user can call `is_admin('<any-uuid>')` and learn whether that account is an admin. Low impact (boolean oracle, no PII). It **must** stay executable by `authenticated` because the RLS policies call it, so this is largely unavoidable given the design — note it and accept, or rename/wrap so the policy helper isn't a clean public RPC. No action required to pass the phase.

---

## Top 3 Priorities for the Fixer

1. **M-1 — Fix the `adjust_points` ledger inconsistency.** Record the *actual* applied delta (`new_bal − old_bal`), or reject over-floor adjustments. Add a regression test that adjusts below zero and asserts `Σ points_delta = points_balance`. This protects the app's #1 invariant.
2. **M-2 — Revoke the default `anon`/`authenticated` grants** on `profiles`/`transactions`/`audit_log`, then re-grant only `select`(+`update` on profiles to authenticated). Makes the implementation match the documented "minimal privileges" model and removes the TRUNCATE/DELETE latent grants. (Also fixes m-2.)
3. **m-1 — Restore CLI reproducibility:** add `supabase/config.toml`, link the project, and reconcile migration filenames with the applied history so `supabase db reset` + `db push` round-trip for the next developer and CI.

---

## Approval

**Not approved.** Two MAJOR issues (M-1 points-integrity defect, M-2 grant hardening) must be fixed before this phase is marked Verified. No critical/blocking defects and no exploitable data breach — the Fixer pass should be quick and the core model needs no redesign. Re-audit only the four touched areas (adjust_points ledger, grants, config.toml/version reconciliation) after fixes.

*Auditor hand-off. Next: Fixer addresses M-1/M-2/m-1, then re-audit.*
