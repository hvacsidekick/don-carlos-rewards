-- Phase 2 · Migration 08 — rewards_config (single source of business rules)
-- BLUEPRINT.md §4.6

create table public.rewards_config (
  id                 integer primary key default 1 check (id = 1),  -- singleton row
  points_per_dollar  integer not null default 1,
  redeem_threshold   integer not null default 100,    -- points needed for a reward
  redeem_value_cents integer not null default 1000,   -- $10 off
  stamps_per_card    integer not null default 10,     -- visual stamp count
  updated_at         timestamptz not null default now()
);
insert into public.rewards_config (id) values (1) on conflict do nothing;

alter table public.rewards_config enable row level security;

-- Public read (needed by client to render the rewards card math).
create policy "rewards_config_public_read" on public.rewards_config
  for select using (true);
-- Writes are admin-only via server action (service role) — no client policy.

grant select on public.rewards_config to anon, authenticated;
