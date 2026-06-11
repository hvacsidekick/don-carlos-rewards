import type { Metadata } from "next";
import Link from "next/link";
import { Users, Activity, Coins, Gift, Wallet, Percent } from "lucide-react";

import { getAdminAnalytics } from "@/lib/analytics.server";
import { formatPoints } from "@/lib/format";
import { AnalyticsChart } from "@/components/admin/AnalyticsChart";
import { Mascot } from "@/components/common/Mascot";

export const metadata: Metadata = { title: "Analytics" };

const WINDOW_DAYS = 30;

/**
 * `(admin)/analytics` (PLAN.md §Phase 9) — the KPI dashboard. Server Component:
 * every figure comes from the ADMIN-GATED `admin_analytics()` +
 * `admin_analytics_extended()` RPCs (the `(admin)` layout guards the route; the
 * data helper re-checks `is_admin`; the RPCs re-check it in Postgres). No
 * all-rows aggregate is ever exposed as a client-replayable query.
 *
 * Redemption rate = points redeemed / points issued (share of issued liability
 * burned), divide-by-zero guarded in `computeRedemptionRate`. Displayed as a
 * percentage; the value can exceed 100% if historical adjustments inflated
 * balances that were then redeemed (we show the true number).
 */
export default async function AnalyticsPage() {
  const analytics = await getAdminAnalytics(WINDOW_DAYS);

  if (!analytics) {
    return (
      <main className="flex w-full flex-col gap-5 py-4">
        <h1 className="text-title3 text-foreground">Analytics</h1>
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-12 text-center shadow-card dark:shadow-card-dark">
          <Mascot expression="error" size={56} />
          <p className="text-footnote text-fg-secondary">
            Analytics are temporarily unavailable. Please try again.
          </p>
        </div>
      </main>
    );
  }

  const redemptionPct = analytics.redemptionRate * 100;
  const redemptionPctLabel =
    redemptionPct >= 100 || Number.isInteger(redemptionPct)
      ? `${Math.round(redemptionPct)}%`
      : `${redemptionPct.toFixed(1)}%`;

  const kpis = [
    { label: "Total customers", value: formatPoints(analytics.totalCustomers), Icon: Users },
    { label: "Active (30d)", value: formatPoints(analytics.active30d), Icon: Activity },
    { label: "Points issued", value: formatPoints(analytics.pointsIssued), Icon: Coins },
    { label: "Redemptions", value: formatPoints(analytics.redemptions), Icon: Gift },
    {
      label: "Points outstanding",
      value: formatPoints(analytics.pointsOutstanding),
      Icon: Wallet,
      hint: "Liability on the books",
    },
    {
      label: "Redemption rate",
      value: redemptionPctLabel,
      Icon: Percent,
      hint: "Redeemed ÷ issued",
    },
  ];

  return (
    <main className="flex w-full flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title3 text-foreground">Analytics</h1>
        <p className="text-footnote text-fg-secondary">
          Loyalty program at a glance · last {WINDOW_DAYS} days.
        </p>
      </header>

      {/* KPI cards — responsive grid (2-col phone, 3-col tablet). */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col gap-2 rounded-2xl bg-surface-tertiary p-4 shadow-card dark:shadow-card-dark"
          >
            <span className="grid size-9 place-items-center rounded-full bg-fill-quaternary text-fg-secondary">
              <kpi.Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-title3 font-semibold tabular-nums text-foreground">
                {kpi.value}
              </span>
              <span className="text-footnote text-fg-secondary">{kpi.label}</span>
              {kpi.hint ? <span className="text-caption text-fg-tertiary">{kpi.hint}</span> : null}
            </div>
          </div>
        ))}
      </section>

      {/* Time-series */}
      <section
        aria-label="Points issued and redeemed over time"
        className="flex flex-col gap-3 rounded-2xl bg-surface-tertiary p-5 shadow-card dark:shadow-card-dark"
      >
        <h2 className="text-headline text-foreground">Points over time</h2>
        <AnalyticsChart series={analytics.series} />
      </section>

      {/* Top customers */}
      <section className="flex flex-col gap-3">
        <h2 className="text-headline text-foreground">Top customers</h2>
        {analytics.topCustomers.length === 0 ? (
          <div className="rounded-2xl bg-surface-tertiary px-4 py-8 text-center shadow-card dark:shadow-card-dark">
            <p className="text-footnote text-fg-secondary">No customer activity yet.</p>
          </div>
        ) : (
          <ol className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
            {analytics.topCustomers.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-fill-quaternary text-footnote font-semibold tabular-nums text-fg-secondary"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-emph text-foreground">
                      {c.displayName ?? "Unnamed customer"}
                    </p>
                    <p className="truncate text-footnote text-fg-secondary">{c.email}</p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-body-emph tabular-nums text-foreground">
                      {formatPoints(c.totalPointsEarned)}
                    </span>
                    <span className="block text-caption text-fg-secondary">lifetime</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
