/**
 * Consistent number/money/date formatting (DESIGN_SYSTEM.md §13).
 * Currency `$3.50`, points with thousands separators, tabular alignment.
 */

/**
 * The restaurant's local timezone. Don Carlos is a single Colorado location, so
 * every customer should see transaction times on the *store's* clock regardless
 * of their own device — and formatting server- and client-side in one fixed zone
 * keeps SSR and hydration identical (no timezone hydration mismatch). Mountain
 * Time, DST-aware. Centralized here so later phases (admin, about) reuse it.
 */
export const BUSINESS_TIME_ZONE = "America/Denver";

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

/** Short time label in the store's timezone, e.g. "2:14 PM". */
export function formatTime(date: Date | string, timeZone: string = BUSINESS_TIME_ZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

/**
 * Calendar-day key (YYYY-MM-DD) for a moment, evaluated in the store's timezone.
 * `en-CA` yields ISO-ordered `2026-06-10`, which sorts and compares as a string.
 * Used to bucket transactions into day groups consistently on server and client.
 */
export function businessDayKey(
  date: Date | string,
  timeZone: string = BUSINESS_TIME_ZONE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole-day difference between two YYYY-MM-DD keys (`b - a`), timezone-free. */
function daysBetween(aKey: string, bKey: string): number {
  const a = Date.parse(`${aKey}T00:00:00Z`);
  const b = Date.parse(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Friendly day heading relative to the store's "today": "Today", "Yesterday",
 * otherwise a spelled-out date ("Monday, June 9", with the year only when it
 * differs from the current one). All evaluated in {@link BUSINESS_TIME_ZONE} so
 * the label and its grouping key never disagree across a tz boundary.
 */
export function formatRelativeDay(
  date: Date | string,
  timeZone: string = BUSINESS_TIME_ZONE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dayKey = businessDayKey(d, timeZone);
  const todayKey = businessDayKey(new Date(), timeZone);
  const diff = daysBetween(dayKey, todayKey);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  const sameYear = dayKey.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}
