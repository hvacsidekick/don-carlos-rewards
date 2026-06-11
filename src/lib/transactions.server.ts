import "server-only";

import { createClient } from "@/lib/supabase/server";
import { encodeCursor, decodeCursor } from "@/lib/cursor";
import {
  TRANSACTIONS_PAGE_SIZE,
  type TransactionFilter,
  type TransactionListItem,
  type TransactionPage,
} from "@/lib/transactions";

/**
 * Server-only transaction history data access (PLAN.md §Phase 6).
 *
 * Reads are **keyset-paginated** on `(created_at desc, id desc)`, not OFFSET:
 * this is an append-only ledger where new rows land at the top, so an offset
 * window would duplicate/skip rows as the user pages — the exact failure the
 * acceptance criteria forbid. The cursor encodes the last row's
 * `(created_at, id)`; the next page asks for everything strictly "below" it in
 * that ordering. The `(user_id, created_at desc)` index covers the scan.
 *
 * Every query is scoped to the signed-in user with `.eq("user_id", …)`. RLS
 * already restricts non-admins, but an admin's "read all" policy would
 * otherwise surface the GLOBAL feed here — so we scope explicitly (defense in
 * depth, same rationale as the dashboard's recent-activity peek).
 */

/**
 * Fetch one page of the signed-in user's transaction history.
 *
 * Returns an empty page (no throw) when there is no session or the query fails,
 * so the page/action callers degrade to an empty list rather than a 500.
 */
export async function getTransactionsPage(input: {
  filter: TransactionFilter;
  cursor: string | null;
}): Promise<TransactionPage> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { items: [], nextCursor: null };
  }

  // Fetch PAGE_SIZE + 1 to learn whether a further page exists without a count.
  let query = supabase
    .from("transactions")
    .select("id, transaction_type, points_delta, points_balance_after, created_at, notes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TRANSACTIONS_PAGE_SIZE + 1);

  if (input.filter === "earn" || input.filter === "redeem") {
    query = query.eq("transaction_type", input.filter);
  }

  if (input.cursor) {
    const cur = decodeCursor(input.cursor);
    if (cur) {
      // Keyset predicate matching the (created_at desc, id desc) order:
      //   created_at < c  OR  (created_at = c AND id < i)
      query = query.or(
        `created_at.lt.${cur.c},and(created_at.eq.${cur.c},id.lt.${cur.i})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    // Surface a genuine query failure instead of masquerading it as an empty /
    // end-of-list page. The first-page caller (Server Component) lets it hit the
    // route `error.tsx`; the "load more" action's try/catch maps it to a friendly
    // toast. Either way the user sees a real error state, never a silent stop.
    throw new Error(`transactions query failed: ${error.message}`);
  }
  if (!data) {
    return { items: [], nextCursor: null };
  }

  const hasMore = data.length > TRANSACTIONS_PAGE_SIZE;
  const items = (hasMore ? data.slice(0, TRANSACTIONS_PAGE_SIZE) : data) as TransactionListItem[];
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last) : null;

  return { items, nextCursor };
}
