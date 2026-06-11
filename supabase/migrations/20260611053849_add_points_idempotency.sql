-- Phase 10 · P10-CF-3 — server-side add_points idempotency.
--
-- Problem (Phase 5 carry-forward M-2): `add_points` had NO server-side
-- idempotency. The double-add guard was client-side UI state only (button
-- disable + lastAddRef). Under pathological retries — a flaky-network Server
-- Action retry, two staff tabs, an accidental double-submit that beats the
-- disable — two `earn` rows could both insert and DOUBLE-CREDIT the customer.
-- PLAN listed server idempotency as optional for Phase 5; Phase 10 closes it.
--
-- Design:
--   * Add a nullable `idempotency_key uuid` to transactions.
--   * Partial UNIQUE index on (staff_id, user_id, idempotency_key) WHERE the key
--     is not null. This is the atomic backstop: two concurrent identical adds
--     race on the index; the loser gets a unique_violation, which the function
--     resolves to the already-inserted row (a no-op) instead of a second credit.
--   * New `add_points_idempotent(target, pts, amount_cents, note, idem_key)` RPC
--     that mirrors `add_points` EXACTLY (admin check, range check, GUC guard
--     window, atomic balance+ledger write) but, when given a key:
--       - first returns any existing row for (staff, target, key) — fast path;
--       - on a concurrent insert race, catches unique_violation and returns the
--         winning row. Either way the customer is credited exactly once.
--   * When `idem_key` is null it behaves like the original add_points (no guard).
--
-- The original `add_points` is LEFT IN PLACE (other callers / back-compat); the
-- scan action repoints to the idempotent variant.

alter table public.transactions
  add column if not exists idempotency_key uuid;

comment on column public.transactions.idempotency_key is
  'Client-supplied dedupe key for idempotent earns (P10-CF-3). Unique per (staff_id, user_id) when set.';

-- Partial unique index: only enforced for rows that carry a key. Existing rows
-- (key null) are unaffected; the dedupe scope is "this staff adding to this
-- customer with this key".
create unique index if not exists transactions_idempotency_key_uidx
  on public.transactions (staff_id, user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.add_points_idempotent(
  target uuid,
  pts integer,
  amount_cents integer default null,
  note text default null,
  idem_key uuid default null
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare new_bal integer; tx public.transactions; actor uuid := auth.uid();
begin
  if not public.is_admin(actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if pts is null or pts <= 0 or pts > 100000 then
    raise exception 'invalid points amount' using errcode = '22023';
  end if;

  -- Idempotency fast path: a prior identical add (same staff, target, key)
  -- already credited — return it untouched (no second credit, no new row).
  if idem_key is not null then
    select * into tx
      from public.transactions
      where staff_id = actor and user_id = target and idempotency_key = idem_key
      limit 1;
    if found then
      return tx;
    end if;
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

  begin
    insert into public.transactions
      (user_id, points_delta, points_balance_after, transaction_type, amount_cents, staff_id, notes, idempotency_key)
    values (target, pts, new_bal, 'earn', amount_cents, actor, note, idem_key)
    returning * into tx;
  exception when unique_violation then
    -- A concurrent identical add won the race. Undo the balance bump we just
    -- applied (the winner already credited) and return the winning row, so the
    -- customer is credited exactly once.
    perform set_config('app.points_ctx', 'on', true);
    update public.profiles
      set points_balance      = points_balance - pts,
          total_points_earned = total_points_earned - pts
      where id = target;
    perform set_config('app.points_ctx', 'off', true);

    select * into tx
      from public.transactions
      where staff_id = actor and user_id = target and idempotency_key = idem_key
      limit 1;
    return tx;
  end;

  return tx;
end;
$$;

-- Mirror the RPC grant hardening (mig 20260610011632): signed-in users may call
-- it (it re-checks admin inside); anon cannot even probe it.
revoke all on function public.add_points_idempotent(uuid, integer, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.add_points_idempotent(uuid, integer, integer, text, uuid) to authenticated;
