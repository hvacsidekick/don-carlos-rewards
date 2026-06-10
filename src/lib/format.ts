/**
 * Consistent number/money/date formatting (DESIGN_SYSTEM.md §13).
 * Currency `$3.50`, points with thousands separators, tabular alignment.
 */

/** Format integer cents as USD, e.g. 350 → "$3.50". */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Format a points value with thousands separators, e.g. 1234 → "1,234". */
export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-US").format(points);
}

/** Signed delta with explicit sign, e.g. 25 → "+25", -10 → "−10" (true minus). */
export function formatDelta(delta: number): string {
  if (delta > 0) return `+${formatPoints(delta)}`;
  if (delta < 0) return `−${formatPoints(Math.abs(delta))}`;
  return "0";
}

/** Short time label, e.g. "2:14 PM". */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
