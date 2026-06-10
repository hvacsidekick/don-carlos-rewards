import Link from "next/link";
import { ArrowUpRight, Gift, Pencil } from "lucide-react";

import { Mascot } from "@/components/common/Mascot";
import type { Tables } from "@/lib/database.types";
import { formatDelta, formatPoints, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * RecentActivity (PHASE_4_TASK §4.8, D4-5) — the minimal inline last-3
 * transactions peek. A lightweight, read-only list; the grouped/paginated
 * history page lands in Phase 6 (the row markup here is kept extractable so
 * Phase 6 can promote it).
 *
 * State is conveyed by icon + sign + color (never color alone — DESIGN_SYSTEM
 * §9): earn = green up-arrow, redeem = brand-red gift, adjustment = pencil.
 */
type Tx = Pick<
  Tables<"transactions">,
  "id" | "transaction_type" | "points_delta" | "points_balance_after" | "created_at" | "notes"
>;

const TYPE_META: Record<
  Tables<"transactions">["transaction_type"],
  { label: string; Icon: typeof ArrowUpRight; tint: string }
> = {
  earn: { label: "Earned points", Icon: ArrowUpRight, tint: "text-dc-green-text" },
  redeem: { label: "Redeemed reward", Icon: Gift, tint: "text-dc-red-text" },
  adjustment: { label: "Adjustment", Icon: Pencil, tint: "text-fg-secondary" },
};

export function RecentActivity({ items }: { items: Tx[] }) {
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

      <ul className="overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
        {items.map((tx, i) => {
          const meta = TYPE_META[tx.transaction_type];
          const positive = tx.points_delta > 0;
          return (
            <li
              key={tx.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-separator",
              )}
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full bg-fill-quaternary",
                  meta.tint,
                )}
              >
                <meta.Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-emph text-foreground">{meta.label}</p>
                <p className="text-footnote text-fg-secondary">
                  {formatTime(tx.created_at)}
                  {tx.notes ? ` · ${tx.notes}` : ` · Balance ${formatPoints(tx.points_balance_after)}`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-body-emph tabular-nums",
                  positive ? "text-dc-green-text" : "text-error-text",
                )}
              >
                {formatDelta(tx.points_delta)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
