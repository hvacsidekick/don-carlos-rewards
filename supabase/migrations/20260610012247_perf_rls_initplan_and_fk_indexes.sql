-- Phase 2 · Migration 12 — performance advisor remediation
-- Resolves get_advisors(performance):
--   * 0003 auth_rls_initplan → wrap auth.uid() in a scalar subquery so it is
--     evaluated ONCE per statement instead of once per row (big win at scale).
--   * 0001 unindexed_foreign_keys → covering indexes on the two non-cascading FKs
--     (staff_id, actor_id) used by admin/audit lookups.
-- Behavior is identical; only the query plans change.

-- ── RLS policies: (select auth.uid()) form ──────────────────────────────────
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (
    (select auth.uid()) = id or public.is_admin((select auth.uid()))
  );

drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy "tx_select_own_or_admin" on public.transactions;
create policy "tx_select_own_or_admin" on public.transactions
  for select using (
    (select auth.uid()) = user_id or public.is_admin((select auth.uid()))
  );

drop policy "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log
  for select using (public.is_admin((select auth.uid())));

-- ── Covering indexes for the non-cascading FKs ──────────────────────────────
create index transactions_staff_idx on public.transactions (staff_id);
create index audit_log_actor_idx    on public.audit_log (actor_id);

-- NOTE: the remaining performance INFO items are expected and not actioned:
--   * unused_index on profiles_qr_token_idx / audit_log_created_idx — these are
--     "unused" only because the fresh DB has had no qualifying queries yet; both
--     are required by PLAN §Phase 2 (QR scan resolution; audit time-ordering) and
--     will be exercised in Phases 5/9.
