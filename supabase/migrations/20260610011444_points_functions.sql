-- Phase 2 · Migration 07 — atomic points mutations (THE ONLY WRITE PATH)
-- BLUEPRINT.md §4.5
--
-- Every function: validates authorization, opens the guard window
-- (app.points_ctx='on', transaction-local), mutates profiles + writes the ledger
-- row atomically (single statement / single transaction), then closes the window.
-- Clients never UPDATE points_balance directly — the guard trigger (mig 03)
-- enforces that.

-- ── ADD POINTS (admin only) ────────────────────────────────────────────────
create or replace function public.add_points(
  target uuid, pts integer, amount_cents integer default null, note text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare new_bal integer; tx public.transactions;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if pts is null or pts <= 0 or pts > 100000 then
    raise exception 'invalid points amount' using errcode = '22023';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  update public.profiles
    set points_balance      = points_balance + pts,
        total_points_earned = total_points_earned + pts
    where id = target
    returning points_balance into new_bal;
  perform set_config('app.points_ctx', 'off', true);

  if new_bal is null then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;

  insert into public.transactions
    (user_id, points_delta, points_balance_after, transaction_type, amount_cents, staff_id, notes)
  values (target, pts, new_bal, 'earn', amount_cents, auth.uid(), note)
  returning * into tx;
  return tx;
end;
$$;

-- ── REDEEM (the authenticated user redeems their OWN points) ────────────────
create or replace function public.redeem_points(pts integer)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid(); new_bal integer; tx public.transactions;
begin
  if uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if pts is null or pts <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  -- The WHERE guard (points_balance >= pts) makes the debit atomic and prevents
  -- a negative balance even under concurrent calls (row lock on UPDATE).
  update public.profiles
    set points_balance    = points_balance - pts,
        total_redemptions = total_redemptions + 1
    where id = uid and points_balance >= pts
    returning points_balance into new_bal;
  perform set_config('app.points_ctx', 'off', true);

  if new_bal is null then
    raise exception 'insufficient balance' using errcode = 'P0001';
  end if;

  insert into public.transactions
    (user_id, points_delta, points_balance_after, transaction_type, notes)
  values (uid, -pts, new_bal, 'redeem', 'Redeemed reward')
  returning * into tx;
  return tx;
end;
$$;

-- ── MANUAL ADJUSTMENT (admin only; signed; reason required) ─────────────────
create or replace function public.adjust_points(
  target uuid, delta integer, reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare new_bal integer; tx public.transactions;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if delta = 0 then
    raise exception 'delta must be non-zero' using errcode = '22023';
  end if;
  if reason is null or length(trim(reason)) = 0 then
    raise exception 'reason required' using errcode = '22023';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  update public.profiles
    set points_balance = greatest(points_balance + delta, 0)
    where id = target
    returning points_balance into new_bal;
  perform set_config('app.points_ctx', 'off', true);

  if new_bal is null then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;

  insert into public.transactions
    (user_id, points_delta, points_balance_after, transaction_type, staff_id, notes)
  values (target, delta, new_bal, 'adjustment', auth.uid(), reason)
  returning * into tx;

  perform public.write_audit('adjust_points', target, delta, reason);
  return tx;
end;
$$;

-- ── ROTATE QR TOKEN (self or admin) ─────────────────────────────────────────
create or replace function public.rotate_qr_token(target uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := coalesce(target, auth.uid()); newtok uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if uid <> auth.uid() and not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  update public.profiles set qr_token = gen_random_uuid()
    where id = uid
    returning qr_token into newtok;
  perform set_config('app.points_ctx', 'off', true);

  if newtok is null then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;
  return newtok;
end;
$$;
