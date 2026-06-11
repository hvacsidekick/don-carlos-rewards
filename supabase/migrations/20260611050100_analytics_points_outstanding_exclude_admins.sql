-- Phase 9 · Fixer MINOR-2 — points_outstanding (the liability KPI) must exclude
-- admin/staff balances, consistent with total_customers / top_customers which
-- already filter `where not is_admin`. Today admins hold 0 so the number is
-- unchanged (70 = 70), but if a staff account ever accrued points the stated
-- liability "on the books" would be overstated. This is the only change vs
-- mig 20260610011508; the other four KPIs are byte-identical.
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
    'points_outstanding',  (select coalesce(sum(points_balance), 0) from public.profiles
                              where not is_admin),
    'points_issued',       (select coalesce(sum(points_delta), 0) from public.transactions
                              where transaction_type = 'earn'),
    'redemptions',         (select count(*) from public.transactions
                              where transaction_type = 'redeem')
  ) into result;
  return result;
end;
$$;
