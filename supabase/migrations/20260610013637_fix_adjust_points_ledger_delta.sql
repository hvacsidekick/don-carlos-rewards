-- Phase 2 · Fixer M-1 — adjust_points must record the ACTUAL applied delta.
--
-- Defect (audit M-1): adjust_points clamped the balance with greatest(bal+delta,0)
-- but wrote the UNCLAMPED `delta` into the ledger row. After any over-floor
-- adjustment the append-only ledger no longer reconciled with points_balance
-- (Σ points_delta ≠ points_balance) and the row was internally inconsistent
-- (old_bal + points_delta ≠ points_balance_after).
--
-- Fix: read+lock the pre-adjustment balance, compute the new (floored) balance,
-- and record the applied delta = new_bal - old_bal in BOTH the ledger row and the
-- audit entry. PG17 has no OLD in UPDATE...RETURNING, hence the SELECT ... FOR
-- UPDATE (which also serialises concurrent admin adjustments on the same row).

create or replace function public.adjust_points(
  target uuid, delta integer, reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare old_bal integer; new_bal integer; applied_delta integer; tx public.transactions;
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

  -- Lock the row and capture the pre-adjustment balance.
  select points_balance into old_bal from public.profiles where id = target for update;
  if not found then
    raise exception 'unknown user' using errcode = 'P0002';
  end if;

  -- Floor at zero (points_balance has a >= 0 check). The applied delta is the
  -- real change to the balance, which differs from `delta` only when flooring.
  new_bal       := greatest(old_bal + delta, 0);
  applied_delta := new_bal - old_bal;

  perform set_config('app.points_ctx', 'on', true);
  update public.profiles
    set points_balance = new_bal
    where id = target;
  perform set_config('app.points_ctx', 'off', true);

  -- Record the APPLIED delta so the ledger always reconciles:
  --   Σ points_delta == points_balance, and within this row
  --   old_bal + points_delta == points_balance_after.
  insert into public.transactions
    (user_id, points_delta, points_balance_after, transaction_type, staff_id, notes)
  values (target, applied_delta, new_bal, 'adjustment', auth.uid(), reason)
  returning * into tx;

  perform public.write_audit('adjust_points', target, applied_delta, reason);
  return tx;
end;
$$;
