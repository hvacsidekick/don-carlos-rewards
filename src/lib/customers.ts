/**
 * Shared, client-safe customer-list types + constants (PLAN.md §Phase 9). The
 * server-only Supabase query + cursor codec lives in `customers.server.ts`; this
 * module carries only types/constants so client islands can import it without
 * dragging in `server-only`.
 */

/** How many customers one page of the admin list holds. */
export const CUSTOMERS_PAGE_SIZE = 20;

/** One row of the admin customer list. */
export type CustomerListItem = {
  id: string;
  displayName: string | null;
  email: string;
  pointsBalance: number;
  totalPointsEarned: number;
  /** ISO timestamp of the customer's most recent transaction, or null if none. */
  lastActivityAt: string | null;
  createdAt: string;
};

/** One page of customers plus the opaque cursor to fetch the next, or null at the end. */
export type CustomerPage = {
  items: CustomerListItem[];
  nextCursor: string | null;
};
