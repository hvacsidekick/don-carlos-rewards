-- Phase 2 · Fixer M-2 — lock down the inherited Supabase default grants.
--
-- Defect (audit M-2): migrations 02/05/06 GRANT a subset (select/update) but never
-- REVOKE Supabase's default GRANT ALL, so anon and authenticated held full
-- DML + TRUNCATE on profiles/transactions/audit_log at the grant level. RLS was
-- the only backstop. This both contradicts the documented "minimal privileges"
-- design and is a blast-radius amplifier for any future permissive write policy.
--
-- Also resolves audit m-2: with anon's table-level SELECT revoked, an anon
-- /rest/v1/profiles request fails as a clean table-permission denial BEFORE the
-- profiles_select_own policy evaluates is_admin() (anon had EXECUTE revoked in
-- migration 11), instead of raising 42501 "permission denied for function".

revoke all on public.profiles     from anon, authenticated;
revoke all on public.transactions from anon, authenticated;
revoke all on public.audit_log    from anon, authenticated;

-- Re-grant only what the API roles actually need; RLS + the column guard remain
-- the row-level gate.
--   profiles:     authenticated reads own/all-as-admin (RLS) and updates own
--                 non-sensitive columns (guard freezes the rest).
--   transactions: authenticated reads own/all-as-admin ledger (RLS). Writes go
--                 only through the SECURITY DEFINER points functions (owner).
--   audit_log:    authenticated reads under the admin-only RLS policy. Writes go
--                 only through write_audit() (owner).
--   anon:         no privileges on any of these three tables.
grant select, update on public.profiles     to authenticated;
grant select         on public.transactions to authenticated;
grant select         on public.audit_log    to authenticated;
