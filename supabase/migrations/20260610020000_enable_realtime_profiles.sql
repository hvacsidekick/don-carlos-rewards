-- Phase 4 · Migration 15 — enable realtime on profiles
-- PLAN.md §Phase 4 (realtime), BLUEPRINT.md §6.
--
-- The dashboard's RewardsCard client island subscribes to postgres_changes on
-- public.profiles filtered to id=eq.<uid> so a staff scan (Phase 5 add_points)
-- updates the card live without a refresh. For that to deliver row events the
-- table must be a member of the supabase_realtime publication.
--
-- RLS still gates delivery: a subscriber only receives rows their SELECT policy
-- permits, i.e. their own profile row. Adding the table to the publication does
-- NOT widen read access — it only routes change events through realtime.
--
-- Idempotent: skip if profiles is already in the publication (re-runs / fresh DB).

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
