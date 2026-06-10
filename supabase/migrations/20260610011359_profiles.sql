-- Phase 2 · Migration 02 — profiles (extends auth.users) + admin helper
-- BLUEPRINT.md §4.1 (is_admin) + §4.2 (profiles)

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  display_name        text,
  avatar_url          text,
  qr_token            uuid not null default gen_random_uuid() unique,
  points_balance      integer not null default 0 check (points_balance >= 0),
  total_points_earned integer not null default 0 check (total_points_earned >= 0),
  total_redemptions   integer not null default 0 check (total_redemptions >= 0),
  is_admin            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes (PLAN.md §Phase 2): qr_token lookup (QR scan resolution) and a partial
-- index over admins (small, hot set used by guards/analytics).
create index profiles_qr_token_idx on public.profiles (qr_token);
create index profiles_is_admin_idx on public.profiles (is_admin) where is_admin;

-- Non-recursive admin check usable INSIDE RLS policies without self-recursion.
-- SECURITY DEFINER → reads public.profiles bypassing RLS, so a policy that calls
-- it does not re-trigger the same policy (the recursion trap in PLAN §Phase 2).
-- Created here (after the table) because a `language sql` body is validated at
-- creation time.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

comment on function public.is_admin(uuid) is
  'Non-recursive admin check for use in RLS policies. SECURITY DEFINER bypasses RLS on profiles.';

alter table public.profiles enable row level security;

-- Users read their own profile; admins read all.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

-- Users may UPDATE their own row, but sensitive/ledger columns are frozen by the
-- guard trigger (migration 03). Postgres has no per-column UPDATE policy, so the
-- trigger — not this policy — is what protects points_balance, is_admin, etc.
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No client INSERT/DELETE policy: rows are created by handle_new_user() (mig 04)
-- and deleted via cascade from auth.users.

-- Minimal base privileges for the API roles (RLS remains the gate).
grant select, update on public.profiles to authenticated;
