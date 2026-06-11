"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { loadTransactionsAction } from "@/actions/transactions";
import { groupTransactionsByDay } from "@/lib/transaction-groups";
import type { TransactionFilter, TransactionListItem } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/common/Mascot";
import { TransactionRow } from "./TransactionRow";

/**
 * TransactionList (PLAN.md §Phase 6) — the interactive history. A Server
 * Component fetches the first "All" page and hands it here; this island owns the
 * filter, the accumulated rows, and the keyset cursor for "Load more".
 *
 * Why a client island (vs. URL-param pagination): the list grows *in place* as
 * the customer pulls more — they keep their scroll position and the day groups
 * that straddle a page boundary merge seamlessly. The server stays the trust
 * boundary: it owns identity, the cursor, and the page size; we only relay the
 * opaque cursor back.
 */
const FILTERS: { value: TransactionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "earn", label: "Earned" },
  { value: "redeem", label: "Redeemed" },
];

const EMPTY_COPY: Record<TransactionFilter, string> = {
  all: "No activity yet — go grab a taco!",
  earn: "No points earned yet — show your QR code at checkout.",
  redeem: "No rewards redeemed yet. Keep earning!",
};

type Props = {
  initialItems: TransactionListItem[];
  initialCursor: string | null;
};

export function TransactionList({ initialItems, initialCursor }: Props) {
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [items, setItems] = useState<TransactionListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupTransactionsByDay(items), [items]);

  function selectFilter(next: TransactionFilter) {
    if (next === filter || isPending) return;
    // Switch immediately for responsive tabs, then fetch that filter's first page.
    setFilter(next);
    setItems([]);
    setCursor(null);
    startTransition(async () => {
      const res = await loadTransactionsAction({ filter: next, cursor: null });
      if (res.ok) {
        setItems(res.data.items);
        setCursor(res.data.nextCursor);
      } else {
        toast.error(res.error);
      }
    });
  }

  function loadMore() {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const res = await loadTransactionsAction({ filter, cursor });
      if (res.ok) {
        setItems((prev) => [...prev, ...res.data.items]);
        setCursor(res.data.nextCursor);
      } else {
        toast.error(res.error);
      }
    });
  }

  const showEmpty = items.length === 0 && !isPending;

  return (
    <div className="flex flex-col gap-5">
      <div
        role="group"
        aria-label="Filter activity"
        className="flex items-center gap-1 self-start rounded-full bg-fill-quaternary p-1"
      >
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => selectFilter(f.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-footnote font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-60",
                active
                  ? "bg-background text-foreground shadow-card dark:shadow-card-dark"
                  : "text-fg-secondary hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {showEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-12 text-center shadow-card dark:shadow-card-dark">
          <Mascot expression="empty" size={56} />
          <p className="text-footnote text-fg-secondary">{EMPTY_COPY[filter]}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`day-${group.key}`} className="flex flex-col gap-2">
              <h2 id={`day-${group.key}`} className="px-1 text-footnote font-medium text-fg-secondary">
                {group.label}
              </h2>
              <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Status line for assistive tech while a page is loading. */}
      <p aria-live="polite" className="sr-only">
        {isPending ? "Loading activity" : ""}
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
