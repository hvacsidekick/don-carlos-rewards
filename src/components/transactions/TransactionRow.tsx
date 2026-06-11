import { ArrowUpRight, Gift, Pencil } from "lucide-react";

import type { TransactionListItem } from "@/lib/transactions";
import { formatDelta, formatPoints, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * TransactionRow (DESIGN_SYSTEM.md §5.12) — one ledger entry as a list item.
 * Shared by the dashboard's `RecentActivity` peek and the full history list, so
 * both stay pixel-identical. No client hooks → safe in a Server Component.
 *
 * State is conveyed by icon + sign + color, never color alone (DESIGN_SYSTEM
 * §9): earn = green up-arrow, redeem = brand-red gift, adjustment = pencil. The
 * signed amount also carries an explicit aria-label so screen readers announce
 * "earned/spent N points" rather than guessing at the "−" glyph.
 */
const TYPE_META: Record<
  TransactionListItem["transaction_type"],
  { label: string; Icon: typeof ArrowUpRight; tint: string }
> = {
  earn: { label: "Earned points", Icon: ArrowUpRight, tint: "text-dc-green-text" },
  redeem: { label: "Redeemed reward", Icon: Gift, tint: "text-dc-red-text" },
  adjustment: { label: "Adjustment", Icon: Pencil, tint: "text-fg-secondary" },
};

function amountLabel(delta: number): string {
  if (delta > 0) return `Earned ${formatPoints(delta)} points`;
  if (delta < 0) return `Spent ${formatPoints(Math.abs(delta))} points`;
  return "No point change";
}

export function TransactionRow({ tx }: { tx: TransactionListItem }) {
  const meta = TYPE_META[tx.transaction_type];
  const positive = tx.points_delta > 0;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
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
          {formatTime(tx.created_at)} · Balance {formatPoints(tx.points_balance_after)}
          {tx.notes ? ` · ${tx.notes}` : ""}
        </p>
      </div>

      <span
        aria-label={amountLabel(tx.points_delta)}
        className={cn(
          "shrink-0 text-body-emph tabular-nums",
          positive ? "text-dc-green-text" : "text-error-text",
        )}
      >
        {formatDelta(tx.points_delta)}
      </span>
    </li>
  );
}
