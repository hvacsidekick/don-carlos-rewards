import { businessDayKey, formatRelativeDay } from "@/lib/format";
import type { TransactionListItem } from "@/lib/transactions";

/**
 * Bucket a newest-first transaction list into contiguous day groups
 * (PLAN.md §Phase 6: "grouped by date — Today / Yesterday / month").
 *
 * Items arrive already sorted descending by time, so same-day rows are adjacent
 * and a single linear pass suffices. Grouping the *whole* accumulated list
 * (initial page + every loaded page) keeps a day that straddles a page boundary
 * as one section. Keys and labels both come from {@link businessDayKey} /
 * {@link formatRelativeDay}, so they're computed in the store's timezone and
 * can never disagree.
 */
export type TransactionGroup = {
  key: string;
  label: string;
  items: TransactionListItem[];
};

export function groupTransactionsByDay(items: TransactionListItem[]): TransactionGroup[] {
  const groups: TransactionGroup[] = [];
  let current: TransactionGroup | null = null;

  for (const item of items) {
    const key = businessDayKey(item.created_at);
    if (!current || current.key !== key) {
      current = { key, label: formatRelativeDay(item.created_at), items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}
