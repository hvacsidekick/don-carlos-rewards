-- Phase 9 · Migration — extended admin analytics (time-series, top customers,
-- redemption-rate inputs). BLUEPRINT.md §4.9, PLAN.md §Phase 9.
--
-- The base `admin_analytics()` (mig 20260610011508) already returns the 5 KPI
-- scalars. The Phase-9 analytics screen additionally needs:
--   * a points issued/redeemed TIME-SERIES (daily, last N days),
--   * the TOP CUSTOMERS by lifetime points earned,
--   * the exact inputs to derive a redemption RATE.
-- Rather than expose any of these as client-replayable table queries (a normal
-- user must never be able to run an all-rows aggregate — PLAN §Phase 9 "Watch"),
-- they are computed inside ONE admin-gated SECURITY DEFINER RPC that mirrors the
-- existing security pattern EXACTLY:
--   * security definer, set search_path = public;
--   * the is_admin(auth.uid()) check is the FIRST statement and raises 42501
--     before any data is touched;
--   * EXECUTE is revoked from anon/public and granted only to `authenticated`
--     (each call re-checks admin internally — defense in depth).
--
-- Redemption-rate definition (documented, divide-by-zero guarded in the app):
--   redemption_rate = points_redeemed / points_issued
--   where points_issued  = Σ points_delta over 'earn' rows (liability created)
--         points_redeemed = Σ |points_delta| over 'redeem' rows (liability burned)
-- i.e. the share of issued points that customers have redeemed. When
-- points_issued = 0 the rate is reported as 0 by the caller (no division).

create or replace function public.admin_analytics_extended(days integer default 30)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  win_days integer := least(greatest(coalesce(days, 30), 1), 365); -- clamp 1..365
  start_day date := (now() at time zone 'America/Denver')::date - (win_days - 1);
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select json_build_object(
    -- Redemption-rate inputs (the rate itself is derived + zero-guarded in the app).
    'points_issued',   (select coalesce(sum(points_delta), 0)
                          from public.transactions where transaction_type = 'earn'),
    'points_redeemed', (select coalesce(abs(sum(points_delta)), 0)
                          from public.transactions where transaction_type = 'redeem'),

    -- Daily time-series for the last `win_days`, gap-filled (days with no activity
    -- appear as zeros) so the chart x-axis is continuous. Bucketed in the store's
    -- timezone to match how customers see transaction dates (format.ts).
    'series', (
      select coalesce(json_agg(row_to_json(s) order by s.day), '[]'::json)
      from (
        select
          d.day::date::text as day,
          coalesce(sum(case when t.transaction_type = 'earn'   then t.points_delta end), 0)      as issued,
          coalesce(abs(sum(case when t.transaction_type = 'redeem' then t.points_delta end)), 0) as redeemed
        from generate_series(start_day, start_day + (win_days - 1), interval '1 day') as d(day)
        left join public.transactions t
          on ((t.created_at at time zone 'America/Denver')::date) = d.day::date
        group by d.day
      ) s
    ),

    -- Top customers by lifetime points earned (excludes staff/admins). Ties broken
    -- by current balance then id for a stable order. Limited to 5.
    'top_customers', (
      select coalesce(json_agg(row_to_json(c) order by c.total_points_earned desc, c.points_balance desc, c.id), '[]'::json)
      from (
        select id, display_name, email, points_balance, total_points_earned
        from public.profiles
        where not is_admin
        order by total_points_earned desc, points_balance desc, id
        limit 5
      ) c
    )
  ) into result;

  return result;
end;
$$;

-- Mirror the existing RPC grant hardening (mig 20260610011632): signed-in users
-- may call it (it re-checks admin inside); anonymous users cannot even probe it.
revoke all on function public.admin_analytics_extended(integer) from anon, public;
grant execute on function public.admin_analytics_extended(integer) to authenticated;
