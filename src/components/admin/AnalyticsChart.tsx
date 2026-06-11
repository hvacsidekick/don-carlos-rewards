import type { AnalyticsSeriesPoint } from "@/lib/analytics";
import { formatPoints } from "@/lib/format";

/**
 * AnalyticsChart (PLAN.md §Phase 9) — a lightweight, dependency-free grouped bar
 * chart of points issued vs redeemed per day. Pure inline SVG (no charting lib —
 * BUILDER decision per §5 latitude; keeps the bundle small, no client JS needed
 * so it renders in a Server Component).
 *
 * Accessibility (DESIGN_SYSTEM §9): the chart is `role="img"` with a descriptive
 * label summarising the totals, AND the same data is exposed as a visually
 * hidden table so screen-reader users get the exact per-day numbers (state never
 * by color alone — issued vs redeemed are also distinguished in the legend +
 * table headers, and the bars use the AA brand fills). Empty days render no bar.
 */
type Props = {
  /** Daily issued/redeemed points (YYYY-MM-DD in store time), oldest first. */
  series: AnalyticsSeriesPoint[];
};

const CHART_HEIGHT = 120;

export function AnalyticsChart({ series }: Props) {
  const max = Math.max(1, ...series.map((d) => Math.max(d.issued, d.redeemed)));
  const totalIssued = series.reduce((sum, d) => sum + d.issued, 0);
  const totalRedeemed = series.reduce((sum, d) => sum + d.redeemed, 0);

  const label = `Points issued and redeemed over the last ${series.length} days. ${formatPoints(totalIssued)} issued, ${formatPoints(totalRedeemed)} redeemed.`;

  return (
    <div className="flex flex-col gap-3">
      {/* Legend — distinguishes the two series by label + swatch, not color alone. */}
      <div className="flex items-center gap-4 text-caption text-fg-secondary">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-dc-green" aria-hidden="true" />
          Issued
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-dc-red-fill" aria-hidden="true" />
          Redeemed
        </span>
      </div>

      <div role="img" aria-label={label} className="w-full">
        <svg
          viewBox={`0 0 ${series.length * 14} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-32 w-full"
          aria-hidden="true"
        >
          {series.map((d, i) => {
            const x = i * 14;
            const issuedH = (d.issued / max) * (CHART_HEIGHT - 4);
            const redeemedH = (d.redeemed / max) * (CHART_HEIGHT - 4);
            return (
              <g key={d.day}>
                <rect
                  x={x + 2}
                  y={CHART_HEIGHT - issuedH}
                  width={4.5}
                  height={issuedH}
                  rx={1}
                  className="fill-dc-green"
                />
                <rect
                  x={x + 7.5}
                  y={CHART_HEIGHT - redeemedH}
                  width={4.5}
                  height={redeemedH}
                  rx={1}
                  className="fill-dc-red-fill"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Screen-reader-only data table — exact numbers, not color-encoded. */}
      <table className="sr-only">
        <caption>Points issued and redeemed per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Issued</th>
            <th scope="col">Redeemed</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.issued}</td>
              <td>{d.redeemed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
