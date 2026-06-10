# Phase 2 — Database Schema + Supabase Setup + RLS (BUILDER TASK)

**Project:** Don Carlos Rewards App
**Phase:** 2 of 12 — Database Schema + Supabase Setup + RLS
**Role:** Builder
**Date:** 2026-06-09
**Depends on:** Phase 1 ✅ Verified (`PHASE_1_VERIFIED.md`)
**Authoritative inputs:** `PLAN.md` §Phase 2 (lines 96–127), `BLUEPRINT.md` §4 (Database Schema) + §5 (API contracts) + §10 (Deployment).

---

## 0. Objective

A fully migrated Supabase Postgres schema with RLS policies, triggers, and seed
data; typed client helpers generated; **points integrity** proven by test. The
single most important correctness property: **all `points_balance` changes flow
through `SECURITY DEFINER` functions — clients NEVER write points directly.**

---

## 1. Supabase project

- **Action:** Create project `don-carlos-rewards` (free tier, $0/mo) in org
  `HVAC SIdekick` (`kvqiifcghpaaaqfdghft`), region `us-west-1`.
- **Project ref:** `uxgcyvexeehvhtuhmztc`
- **API URL:** `https://uxgcyvexeehvhtuhmztc.supabase.co`
- Record ref/URL/anon key in `.env.local`; record ref in `BLUEPRINT.md` §10.5
  (Deployment → Provisioned environments).
- The **service-role key** is secret and not retrievable via MCP; documented as a
  dashboard fetch step in `README.md` and left as an instructive placeholder in
  `.env.local` (not needed to apply migrations — those go through the Supabase
  management API).

---

## 2. Schema (in `supabase/migrations/`, versioned)

Implement `BLUEPRINT.md` §4 exactly, split into ordered migrations:

| Migration | Contents |
|---|---|
| `..._01_extensions_helpers` | `pgcrypto`; `is_admin(uuid)` non-recursive SECURITY DEFINER helper |
| `..._02_profiles` | `profiles` table + indexes (`qr_token`, partial `is_admin`) + RLS + select/update policies |
| `..._03_guard_and_touch` | `guard_profile_update()` + `touch_updated_at()` triggers |
| `..._04_new_user` | `handle_new_user()` trigger on `auth.users` insert |
| `..._05_transactions` | `tx_type` enum, `transactions` ledger + index + RLS + select policy |
| `..._06_points_functions` | `add_points`, `redeem_points`, `adjust_points`, `rotate_qr_token` |
| `..._07_rewards_config` | `rewards_config` singleton + public-read RLS |
| `..._08_menu` | `menu_categories`, `menu_items` + index + public-read RLS |
| `..._09_audit_log` | `audit_log` + `write_audit()` + admin-read RLS |
| `..._10_analytics_admin` | `admin_analytics()` RPC; `promote_to_admin()` bootstrap fn + grants |

Tables: `profiles`, `transactions`, `rewards_config`, `menu_categories`,
`menu_items`, `audit_log`. All in `public`, **RLS enabled on every table**.

Indexes (per PLAN §Phase 2): `transactions(user_id, created_at desc)`,
`profiles(qr_token)`, `profiles(is_admin) where is_admin`.

---

## 3. Points integrity — the #1 property

**The only write path to `points_balance` is the SECURITY DEFINER functions:**

- `add_points(target, pts, amount_cents, note)` — **admin only** (rejects
  non-admin with `42501`); validates `0 < pts <= 100000`; atomically increments
  balance + `total_points_earned`, writes an `earn` transaction with
  `points_balance_after`, returns the row. All in one transaction.
- `redeem_points(pts)` — the **authenticated user** redeems **their own** points;
  rejects when `balance < pts` (`insufficient balance`); atomically decrements
  balance, increments `total_redemptions`, logs a `redeem` transaction.
- `adjust_points(target, delta, reason)` — admin only, signed delta, reason
  required; floors at 0; logs `adjustment` transaction + `audit_log` entry.
- `rotate_qr_token(target?)` — self or admin; issues a new `qr_token`.

### CRITICAL DEVIATION FROM BLUEPRINT (documented, intentional)

`BLUEPRINT.md` §4.3's `guard_profile_update()` allows the update when
`is_admin(auth.uid())` is true and otherwise freezes sensitive columns. **That
design is broken for `redeem_points` and `rotate_qr_token`:** their caller is a
*non-admin* user updating their *own* row, so the guard would freeze
`points_balance`/`qr_token` and silently no-op the legitimate mutation — a
correctness bug.

**Fix:** the guard gates on a **transaction-local GUC flag** instead of the
caller's admin status. Each trusted SECURITY DEFINER function sets
`app.points_ctx = 'on'` (transaction-scoped, `set_config(..., true)`) immediately
before touching balances and clears it after. The guard:

```
if current_setting('app.points_ctx', true) = 'on' then return new;  -- trusted fn
else freeze points_balance,total_points_earned,total_redemptions,is_admin,qr_token
```

A direct client `UPDATE` (PostgREST as `authenticated`, or even a raw
service-role `UPDATE`) **cannot** set that flag, so sensitive columns are frozen
to their OLD values — exactly the intended protection, and strictly stronger than
the BLUEPRINT version (admins also can't corrupt balances by hand; they must use
`adjust_points`, which leaves an audit trail). This is why `session_user` /
`current_user` cannot be used: SECURITY DEFINER changes `current_user` but a
direct client `UPDATE` and an in-function `UPDATE` are otherwise
indistinguishable inside the trigger — only an explicit flag the function sets
can tell them apart.

Admin promotion therefore goes through `promote_to_admin(email)` (also sets the
flag); it is **revoked from `authenticated`** and runnable only from the SQL
editor / service role. First-admin bootstrap is documented in `README.md`.

---

## 4. RLS policies (per BLUEPRINT §4)

- `profiles`: select own-or-admin; update own (column protection via guard
  trigger, not a policy — Postgres has no per-column UPDATE policy). No client
  INSERT/DELETE (rows created by trigger; delete cascades from `auth.users`).
- `transactions`: select own-or-admin. **No** client INSERT/UPDATE/DELETE.
- `rewards_config`: public read.
- `menu_categories` / `menu_items`: public read where `active`.
- `audit_log`: admin read only.

---

## 5. Seed (`supabase/seed.sql`)

- `rewards_config` singleton: `points_per_dollar=1`, `redeem_threshold=100`,
  `redeem_value_cents=1000` ($10 off), `stamps_per_card=10`.
- Menu: 7 categories (Tacos, Burritos, Breakfast Burritos, Quesadillas, Tortas,
  Sides, Drinks) and ~22 realistic Don Carlos items, $2–$12 (PLANNING_TASK §menu).
- Idempotent (`on conflict do nothing` / stable slugs) so re-running is safe.

---

## 6. Generated types & docs

- `npx supabase gen types typescript` → `src/lib/database.types.ts` (compiles
  under strict TS, no `any`).
- `README.md`: admin-promotion SQL snippet + service-role-key fetch step.

---

## 7. Acceptance criteria (PLAN.md §Phase 2)

- [ ] All migrations apply cleanly from scratch on a fresh DB.
- [ ] RLS enabled on every `public` table (verify via `get_advisors` / `pg_policies`).
- [ ] Non-admin **cannot** read another user's transactions or profile.
- [ ] Non-admin **cannot** UPDATE `points_balance` directly (guard freezes it).
- [ ] `add_points` rejects non-admin; for admin writes tx + new balance atomically.
- [ ] `redeem_points` rejects when `balance < pts`; on success decrements + logs `redeem`.
- [ ] New `auth.users` insert auto-creates a `profiles` row with a `qr_token`.
- [ ] `get_advisors` (security) reports zero issues or each is justified.
- [ ] Generated types compile (`tsc --noEmit` clean).

## 8. Test plan (run under real JWTs / simulated roles)

1. Seed two non-admin users (A, B) + one admin.
2. As A: select own profile ✓; select B's profile → 0 rows. Select B's tx → 0 rows.
3. As A: `UPDATE profiles SET points_balance = 99999 WHERE id = A` → balance unchanged.
4. As A: `add_points(B, 50)` → raises `not authorized` (42501).
5. As admin: `add_points(A, 150, 15000, 'lunch')` → balance 150, one `earn` tx, atomic.
6. As A: `redeem_points(100)` → balance 50, one `redeem` tx; `redeem_points(9999)` → `insufficient balance`.
7. As admin: `adjust_points(A, -10, 'correction')` → balance 40, `adjustment` tx + audit row.
8. Insert a fresh `auth.users` row → profile auto-created with non-null `qr_token`.

**Out of scope:** UI, auth flows (only the profile-bootstrap trigger plumbing).
