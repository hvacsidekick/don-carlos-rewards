import Link from "next/link";

import { Mascot } from "@/components/common/Mascot";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import type { TransactionListItem } from "@/lib/transactions";

/**
 * RecentActivity (PHASE_4_TASK §4.8, D4-5) — the inline last-3 transactions peek
 * on the dashboard. A lightweight, read-only list; the grouped/paginated history
 * lives at `/transactions` (Phase 6), reached via "See all". Each row is the
 * shared {@link TransactionRow}, so the peek and the full history stay identical
 * (icon + sign + color state, never color alone — DESIGN_SYSTEM §9).
 */
export function RecentActivity({ items }: { items: TransactionListItem[] }) {
  if (items.length === 0) {
    return (
      <section aria-labelledby="recent-activity-title" className="flex flex-col gap-3">
        <h2 id="recent-activity-title" className="text-headline text-foreground">
          Recent activity
        </h2>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-8 text-center shadow-card dark:shadow-card-dark">
          <Mascot expression="empty" size={56} />
          <p className="text-footnote text-fg-secondary">No activity yet — go grab a taco!</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="recent-activity-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="recent-activity-title" className="text-headline text-foreground">
          Recent activity
        </h2>
        <Link
          href="/transactions"
          className="rounded-md text-footnote text-dc-red-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          See all
        </Link>
      </div>

      <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
        {items.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} />
        ))}
      </ul>
    </section>
  );
}
