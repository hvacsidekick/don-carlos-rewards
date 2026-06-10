-- Phase 2 · Migration 05 — transactions (append-only points ledger)
-- BLUEPRINT.md §4.4

create type public.tx_type as enum ('earn', 'redeem', 'adjustment');

create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  points_delta         integer not null,             -- +earn, -redeem, +/- adjustment
  points_balance_after integer not null check (points_balance_after >= 0),
  transaction_type     public.tx_type not null,
  amount_cents         integer,                       -- purchase amount for 'earn' (audit)
  staff_id             uuid references public.profiles(id),  -- admin who processed
  notes                text,
  created_at           timestamptz not null default now()
);

-- History queries are always "this user's rows, newest first" → covering index.
create index transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

alter table public.transactions enable row level security;

-- Users read their own ledger; admins read all.
create policy "tx_select_own_or_admin" on public.transactions
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- NO client INSERT/UPDATE/DELETE policy. The ledger is append-only and written
-- ONLY by the SECURITY DEFINER points functions (migration 06), which run as the
-- table owner and bypass RLS.

grant select on public.transactions to authenticated;
