-- Phase 2 · Migration 03 — column guard + updated_at touch on profiles
-- BLUEPRINT.md §4.3 (HARDENED — see PHASE_2_TASK.md §3 for the deviation rationale)
--
-- POINTS INTEGRITY is the #1 correctness property of this app. The guard freezes
-- every sensitive column on UPDATE *unless* a trusted SECURITY DEFINER points
-- function has set the transaction-local flag `app.points_ctx = 'on'`.
--
-- Why a GUC flag and not the caller's admin status (as the BLUEPRINT sketched)?
--   * redeem_points() and rotate_qr_token() are called by NON-admin users
--     updating their OWN row. An admin-status gate would freeze their legitimate
--     balance/token change → silent corruption / no-op.
--   * Inside the trigger, neither current_user (rewritten to the owner by
--     SECURITY DEFINER) nor session_user (still 'authenticated' for both a direct
--     client UPDATE and an in-function UPDATE) can distinguish a trusted mutation
--     from a hostile one. Only an explicit flag the trusted function sets can.
--   * Result is STRICTLY STRONGER: not even a raw service-role UPDATE can write
--     points outside the audited functions, because it cannot set the flag.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted points functions opened a write window for this transaction.
  if current_setting('app.points_ctx', true) = 'on' then
    return new;
  end if;

  -- Everyone else: freeze sensitive/ledger-controlled columns to their OLD value.
  -- Non-sensitive fields (display_name, avatar_url, email) pass through.
  new.points_balance      := old.points_balance;
  new.total_points_earned := old.total_points_earned;
  new.total_redemptions   := old.total_redemptions;
  new.is_admin            := old.is_admin;
  new.qr_token            := old.qr_token;  -- rotation goes through rotate_qr_token()
  return new;
end;
$$;

comment on function public.guard_profile_update() is
  'Freezes points/admin/qr_token columns on UPDATE unless app.points_ctx=on (set only by trusted SECURITY DEFINER points functions).';

create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- updated_at auto-touch. Trigger name sorts AFTER the guard ('p' > 'g'), so the
-- guard runs first; updated_at is not a guarded column, so no conflict.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();
