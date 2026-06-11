"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { loadCustomerTransactionsAction } from "@/actions/admin";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import type { TransactionListItem } from "@/lib/transactions";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/common/Mascot";
import { TransactionRow } from "@/components/transactions/TransactionRow";

/**
 * CustomerHistory (PLAN.md §Phase 9) — the admin view of one customer's ledger.
 * Reuses the Phase-6 `TransactionRow` + day-grouping so admin history is
 * pixel-identical to the customer's own, with keyset "Load more" that relays the
 * opaque cursor back to the admin-gated action (which re-checks admin).
 */
type Props = {
  userId: string;
  initialItems: TransactionListItem[];
  initialCursor: string | null;
};

export function CustomerHistory({ userId, initialItems, initialCursor }: Props) {
  const [items, setItems] = useState<TransactionListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupTransactionsByDay(items), [items]);

  function loadMore() {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const res = await loadCustomerTransactionsAction({ userId, cursor });
      if (res.ok) {
        setItems((prev) => [...prev, ...res.data.items]);
        setCursor(res.data.nextCursor);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-12 text-center shadow-card dark:shadow-card-dark">
        <Mascot expression="empty" size={48} />
        <p className="text-footnote text-fg-secondary">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`cust-day-${group.key}`} className="flex flex-col gap-2">
          <h3
            id={`cust-day-${group.key}`}
            className="px-1 text-footnote font-medium text-fg-secondary"
          >
            {group.label}
          </h3>
          <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
            {group.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
        </section>
      ))}

      <p aria-live="polite" className="sr-only">
        {isPending ? "Loading history" : ""}
      </p>

      {cursor && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={loadMore}
          disabled={isPending}
        >
          {isPending ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
