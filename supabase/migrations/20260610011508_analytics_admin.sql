-- Phase 2 · Migration 10 — admin analytics RPC + admin-promotion bootstrap
-- BLUEPRINT.md §4.9

-- Admin-only aggregate. Authorization is checked INSIDE the function so there is
-- no path for a normal user to run it (PLAN.md §Phase 9 "Watch").
create or replace function public.admin_analytics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare result json;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select json_build_object(
    'total_customers',     (select count(*) from public.profiles where not is_admin),
    'active_30d',          (select count(distinct user_id) from public.transactions
                              where created_at > now() - interval '30 days'),
    'points_outstanding',  (select coalesce(sum(points_balance), 0) from public.profiles),
    'points_issued',       (select coalesce(sum(points_delta), 0) from public.transactions
                              where transaction_type = 'earn'),
    'redemptions',         (select count(*) from public.transactions
                              where transaction_type = 'redeem')
  ) into result;
  return result;
end;
$$;

-- Promote a user to admin by email. SECURITY DEFINER so it can open the guard
-- window and flip is_admin. Authorization:
--   * if any admin already exists → caller must be an admin;
--   * if NO admin exists yet → allowed (first-admin bootstrap).
-- EXECUTE is revoked from the API roles, so in practice this runs only from the
-- Supabase SQL editor (postgres) or via the service-role key. See README.
create or replace function public.promote_to_admin(target_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare admin_count integer; result public.profiles;
begin
  select count(*) into admin_count from public.profiles where is_admin;
  if admin_count > 0 and not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  update public.profiles set is_admin = true
    where email = target_email
    returning * into result;
  perform set_config('app.points_ctx', 'off', true);

  if result.id is null then
    raise exception 'no user with email %', target_email using errcode = 'P0002';
  end if;
  perform public.write_audit('promote_to_admin', result.id, null, target_email);
  return result;
end;
$$;

revoke all on function public.promote_to_admin(text) from public;
revoke all on function public.promote_to_admin(text) from anon, authenticated;
grant execute on function public.promote_to_admin(text) to service_role;
