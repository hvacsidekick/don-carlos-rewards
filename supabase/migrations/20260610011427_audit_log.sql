-- Phase 2 · Migration 06 — audit_log + write_audit()
-- BLUEPRINT.md §4.8
-- Created BEFORE the points functions (mig 07) because adjust_points() calls
-- write_audit().

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id),
  action     text not null,
  target_id  uuid,
  delta      integer,
  reason     text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Append an audit entry attributed to the current caller. SECURITY DEFINER so it
-- can write regardless of the (absent) client INSERT policy.
create or replace function public.write_audit(
  action text, target uuid, delta integer, reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, target_id, delta, reason)
  values (auth.uid(), action, target, delta, reason);
end;
$$;

-- Not part of the public API surface — only invoked from within other definer
-- functions (which run as owner). Lock direct EXECUTE down.
revoke all on function public.write_audit(text, uuid, integer, text) from public;

alter table public.audit_log enable row level security;
create policy "audit_admin_read" on public.audit_log
  for select using (public.is_admin(auth.uid()));
