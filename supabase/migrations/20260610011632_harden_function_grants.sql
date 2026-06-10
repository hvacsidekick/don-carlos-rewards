-- Phase 2 · Migration 11 — function hardening (advisor remediation)
-- Resolves `get_advisors(security)` warnings:
--   * 0011 function_search_path_mutable  → pin search_path on touch_updated_at
--   * 0028/0029 *_security_definer_function_executable → revoke EXECUTE from the
--     API roles for internal/trigger functions, and from `anon` for the RPCs.
--
-- Supabase's default privileges GRANT EXECUTE on new functions to anon,
-- authenticated, and service_role, so `revoke ... from public` alone does not
-- remove them — the roles must be named explicitly.

-- 1) Pin search_path on the updated_at trigger function (the one DEFINER-less fn).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2) Internal/trigger functions: never meant to be called as RPCs. They run via
--    triggers (as owner) regardless of EXECUTE grants, so revoking is safe.
revoke all on function public.guard_profile_update()            from anon, authenticated, public;
revoke all on function public.touch_updated_at()                from anon, authenticated, public;
revoke all on function public.handle_new_user()                 from anon, authenticated, public;
revoke all on function public.write_audit(text, uuid, integer, text) from anon, authenticated, public;

-- 3) RPCs + the policy helper: signed-in users need them; anonymous users do not.
--    (Each already enforces auth/admin internally; this is defense in depth so an
--     unauthenticated caller cannot even probe the RPC endpoint.)
revoke all on function public.is_admin(uuid)                                   from anon, public;
revoke all on function public.add_points(uuid, integer, integer, text)         from anon, public;
revoke all on function public.redeem_points(integer)                          from anon, public;
revoke all on function public.adjust_points(uuid, integer, text)              from anon, public;
revoke all on function public.rotate_qr_token(uuid)                           from anon, public;
revoke all on function public.admin_analytics()                              from anon, public;

grant execute on function public.is_admin(uuid)                           to authenticated;
grant execute on function public.add_points(uuid, integer, integer, text) to authenticated;
grant execute on function public.redeem_points(integer)                   to authenticated;
grant execute on function public.adjust_points(uuid, integer, text)       to authenticated;
grant execute on function public.rotate_qr_token(uuid)                    to authenticated;
grant execute on function public.admin_analytics()                       to authenticated;

-- NOTE: the remaining 0029 warnings for add_points/redeem_points/adjust_points/
-- rotate_qr_token/admin_analytics/is_admin executable by `authenticated` are
-- EXPECTED and JUSTIFIED: these are the app's intended RPC surface and each
-- re-checks auth/admin internally (SECURITY DEFINER is required so they can
-- bypass RLS / the column guard to write the ledger atomically). See
-- PHASE_2_BUILD_COMPLETE.md §Advisors.
