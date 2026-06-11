import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";
import { decodeCursor } from "@/lib/cursor";
import { ilikeContainsValue } from "@/lib/postgrest-escape";
import {
  CUSTOMERS_PAGE_SIZE,
  type CustomerListItem,
  type CustomerPage,
} from "@/lib/customers";

/**
 * Server-only admin customer-list data access (PLAN.md §Phase 9).
 *
 * Reads are **keyset-paginated** on `(created_at desc, id desc)`, not OFFSET:
 * an offset window would duplicate/skip rows as the list shifts, the exact
 * failure the acceptance criteria forbid. The cursor encodes the last row's
 * `(created_at, id)`; the next page asks for everything strictly "below" it in
 * that ordering.
 *
 * Every call goes through `requireAdmin` first — admin RLS lets the session read
 * all profiles, but that read-all must only ever be reached by a verified admin
 * (the list itself is an all-customers aggregate). `balance` shown is
 * `profiles.points_balance` (the ledger-synced cache) and `lifetime earned` is
 * `total_points_earned`, both straight from the row, so they match the ledger.
 *
 * `lastActivityAt` is the customer's most recent transaction time. Rather than a
 * correlated subquery per row, we batch one grouped query over the page's ids
 * after the profile page is fetched (N+0 round-trips, page-bounded).
 */

/** Encode a customer-list cursor (the list's sort key is `(created_at, id)`). */
function encodeCursor(row: { createdAt: string; id: string }): string {
  return Buffer.from(
    JSON.stringify({ c: row.createdAt, i: row.id }),
    "utf8",
  ).toString("base64url");
}

/**
 * Fetch one page of customers (admin only). Returns an empty page on a
 * non-admin/unauthenticated caller rather than throwing, so the page degrades
 * to "no customers" instead of a 500 — but the route + action guards mean this
 * is only reached by an admin in practice.
 */
export async function getCustomersPage(input: {
  search?: string;
  cursor: string | null;
}): Promise<CustomerPage> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) {
    return { items: [], nextCursor: null };
  }

  // Fetch PAGE_SIZE + 1 to learn whether a further page exists without a count.
  let query = supabase
    .from("profiles")
    .select("id, display_name, email, points_balance, total_points_earned, created_at")
    .eq("is_admin", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CUSTOMERS_PAGE_SIZE + 1);

  const search = input.search?.trim();
  if (search) {
    // Value is LIKE-escaped and double-quoted so reserved chars (`,()`) in the
    // search term don't break the `.or()` tokenizer (see ilikeContainsValue).
    const value = ilikeContainsValue(search);
    // Match on display name OR email (contains, case-insensitive).
    query = query.or(`display_name.ilike.${value},email.ilike.${value}`);
  }

  if (input.cursor) {
    const cur = decodeCursor(input.cursor);
    if (cur) {
      // Keyset predicate matching (created_at desc, id desc):
      //   created_at < c  OR  (created_at = c AND id < i)
      query = query.or(
        `created_at.lt.${cur.c},and(created_at.eq.${cur.c},id.lt.${cur.i})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`customers query failed: ${error.message}`);
  }
  if (!data) {
    return { items: [], nextCursor: null };
  }

  const hasMore = data.length > CUSTOMERS_PAGE_SIZE;
  const pageRows = hasMore ? data.slice(0, CUSTOMERS_PAGE_SIZE) : data;

  // Batch the last-activity lookup for just this page's customers.
  const ids = pageRows.map((r) => r.id);
  const lastActivity = new Map<string, string>();
  if (ids.length > 0) {
    const { data: txRows, error: txError } = await supabase
      .from("transactions")
      .select("user_id, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false });
    if (txError) {
      throw new Error(`customer activity query failed: ${txError.message}`);
    }
    // Rows are newest-first; the first time we see a user_id is its latest tx.
    for (const row of txRows ?? []) {
      if (!lastActivity.has(row.user_id)) {
        lastActivity.set(row.user_id, row.created_at);
      }
    }
  }

  const items: CustomerListItem[] = pageRows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    pointsBalance: r.points_balance,
    totalPointsEarned: r.total_points_earned,
    lastActivityAt: lastActivity.get(r.id) ?? null,
    createdAt: r.created_at,
  }));

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null;

  return { items, nextCursor };
}

/** A single customer's full profile for the detail page. */
export type CustomerDetail = {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  pointsBalance: number;
  totalPointsEarned: number;
  totalRedemptions: number;
  createdAt: string;
};

/**
 * Fetch one customer by id (admin only). Returns null when the caller isn't an
 * admin or the id matches no profile — the detail page renders `notFound()`.
 */
export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, email, avatar_url, points_balance, total_points_earned, total_redemptions, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    avatarUrl: data.avatar_url,
    pointsBalance: data.points_balance,
    totalPointsEarned: data.total_points_earned,
    totalRedemptions: data.total_redemptions,
    createdAt: data.created_at,
  };
}

/**
 * Fetch a customer's transaction history page (admin only), keyset-paginated on
 * `(created_at desc, id desc)` — the same correct strategy as the user-facing
 * history, but scoped to the TARGET customer (admin read-all RLS allows it).
 */
export async function getCustomerTransactionsPage(input: {
  userId: string;
  cursor: string | null;
}): Promise<{ items: import("@/lib/transactions").TransactionListItem[]; nextCursor: string | null }> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) {
    return { items: [], nextCursor: null };
  }

  let query = supabase
    .from("transactions")
    .select("id, transaction_type, points_delta, points_balance_after, created_at, notes")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CUSTOMERS_PAGE_SIZE + 1);

  if (input.cursor) {
    const cur = decodeCursor(input.cursor);
    if (cur) {
      query = query.or(
        `created_at.lt.${cur.c},and(created_at.eq.${cur.c},id.lt.${cur.i})`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`customer transactions query failed: ${error.message}`);
  }
  if (!data) {
    return { items: [], nextCursor: null };
  }

  const hasMore = data.length > CUSTOMERS_PAGE_SIZE;
  const items = (hasMore ? data.slice(0, CUSTOMERS_PAGE_SIZE) : data) as import("@/lib/transactions").TransactionListItem[];
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? Buffer.from(JSON.stringify({ c: last.created_at, i: last.id }), "utf8").toString("base64url")
      : null;

  return { items, nextCursor };
}
