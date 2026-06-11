import type { Tables } from "@/lib/database.types";

/**
 * Shared, client-safe transaction types (PLAN.md §Phase 6). The server-only
 * data access (Supabase query + opaque cursor codec) lives in
 * `transactions.server.ts`; this module carries only types and constants so it
 * can be imported from client islands without dragging in `server-only`.
 */

/** How many rows one page of history holds. */
export const TRANSACTIONS_PAGE_SIZE = 20;

/** The exact columns the history list needs (kept in sync with {@link TransactionListItem}). */
export const TRANSACTION_COLUMNS =
  "id, transaction_type, points_delta, points_balance_after, created_at, notes" as const;

/** The subset of a ledger row the UI renders. */
export type TransactionListItem = Pick<
  Tables<"transactions">,
  "id" | "transaction_type" | "points_delta" | "points_balance_after" | "created_at" | "notes"
>;

/**
 * The history filter. `all` includes adjustments; `earn`/`redeem` map directly
 * to `transaction_type`. (Adjustments are surfaced only under "All" — they're
 * rare staff corrections, not a customer-facing category.)
 */
export type TransactionFilter = "all" | "earn" | "redeem";

/** One page of history plus the opaque cursor to fetch the next, or `null` at the end. */
export type TransactionPage = {
  items: TransactionListItem[];
  nextCursor: string | null;
};
