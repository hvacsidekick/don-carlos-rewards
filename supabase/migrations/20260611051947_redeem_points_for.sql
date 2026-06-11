-- Phase 9 · Fixer MAJOR-1 (D-1) — redeem ON BEHALF must write a real `redeem` row.
--
-- Defect: `redeemOnBehalfAction` debited the target via `adjust_points(-threshold)`,
-- so the in-person redemption landed as `transaction_type = 'adjustment'`. That made
-- every staff/in-person redemption INVISIBLE to:
--   * admin_analytics().redemptions      (count where type = 'redeem'),
--   * points_redeemed                    (Σ|delta| where type = 'redeem'),
--   * profiles.total_redemptions         (only redeem_points incremented it).
--
-- Fix: an admin-checked `redeem_points_for(target, pts)` that mirrors the existing
-- `redeem_points` body EXACTLY (atomic floor guard, total_redemptions++, a `redeem`
-- ledger row) but debits the TARGET instead of auth.uid(), and — like the other admin
-- RPCs (adjust_points) — writes the audit row with the admin as actor. The
-- `WHERE points_balance >= pts` guard (with the row lock on UPDATE) makes the debit
-- atomic and prevents a negative balance / over-debit even under concurrent calls;
-- the recorded `points_delta = -pts` is the exact applied delta (no flooring happens
-- because the guard rejects any debit that would go negative — it raises P0001 instead).

create or replace function public.redeem_points_for(target uuid, pts integer)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare new_bal integer; tx public.transactions;
begin
  -- Admin trust boundary FIRST — before any data is read or written.
  if not public.is_admin(auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if pts is null or pts <= 0 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  perform set_config('app.points_ctx', 'on', true);
  -- The WHERE guard (points_balance >= pts) makes the debit atomic and prevents a
  -- negative balance even under concurrent calls (row lock on UPDATE). On a debit
  -- that would go negative the UPDATE matches no row → new_bal stays null → P0001.
  update public.profiles
    set points_balance    = points_balance - pts,
        total_redemptions = total_redemptions + 1
    where id = target and points_balance >= pts
    returning points_balance into new_bal;
  perform set_config('app.points_ctx', 'off', true);

  if new_bal is null then
    -- Distinguish "no such user" from "insufficient balance": if the row exists the
    -- only reason the guarded UPDATE missed is too few points (P0001, same as
    -- redeem_points); if the row is absent it is an unknown user (P0002).
    if not exists (select 1 from public.profiles where id = target) then
      raise exception 'unknown user' using errcode = 'P0002';
    end if;
    raise exception 'insufficient balance' using errcode = 'P0001';
  end if;

  insert into public.transactions
    (user_id, points_delta, points_balance_after, transaction_type, staff_id, notes)
  values (target, -pts, new_bal, 'redeem', auth.uid(), 'Reward redeemed in person (staff)')
  returning * into tx;

  perform public.write_audit('redeem_points_for', target, -pts, 'Reward redeemed in person (staff)');
  return tx;
end;
$$;

-- Mirror the existing RPC grant hardening (mig 20260610011632): signed-in users may
-- call it (it re-checks admin inside); anonymous users cannot even probe it.
revoke all on function public.redeem_points_for(uuid, integer) from public, anon, authenticated;
grant execute on function public.redeem_points_for(uuid, integer) to authenticated;
