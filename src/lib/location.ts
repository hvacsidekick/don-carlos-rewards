/**
 * Don Carlos location data + opening-hours logic (PLAN.md Phase 8).
 *
 * Single source of truth for the shop address, geo, contact, and hours, plus a
 * pure, timezone-correct "open now / closed" computation. The hours window is
 * evaluated against **America/Denver** wall-clock time, NOT the visitor's
 * device timezone — a customer in another zone (or a server rendering the page)
 * still sees the shop's real local status.
 */

/** Postal address, formatted for display (selectable text + a11y alternative). */
export const SHOP_ADDRESS = {
  line1: "7475 W 52nd Ave",
  city: "Arvada",
  state: "CO",
  zip: "80002",
} as const;

/** Single-line address string, e.g. for `geo`/directions and the SR alternative. */
export const SHOP_ADDRESS_ONE_LINE = `${SHOP_ADDRESS.line1}, ${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.state} ${SHOP_ADDRESS.zip}`;

export const SHOP_NAME = "Don Carlos Mexican Restaurant";

/** Tel link target (E.164-ish, digits only for `tel:`) + a display form. */
export const SHOP_PHONE_DISPLAY = "(303) 421-6663";
export const SHOP_PHONE_TEL = "+13034216663";

/** IANA zone the shop physically operates in. */
export const SHOP_TIMEZONE = "America/Denver";

/**
 * Opening hours: Mon–Sat 7am–8pm, Sun closed (PLAN.md Phase 8).
 * Indexed by JS `Date.getDay()` convention (0 = Sunday … 6 = Saturday).
 * `null` = closed that day. Hours are inclusive-open `[open, close)` in 24h.
 */
export interface DayHours {
  /** Opening hour, 0–23 (local Denver wall clock). */
  open: number;
  /** Closing hour, 0–24 (local Denver wall clock); exclusive. */
  close: number;
}

export const WEEKLY_HOURS: ReadonlyArray<DayHours | null> = [
  null, // Sun — closed
  { open: 7, close: 20 }, // Mon
  { open: 7, close: 20 }, // Tue
  { open: 7, close: 20 }, // Wed
  { open: 7, close: 20 }, // Thu
  { open: 7, close: 20 }, // Fri
  { open: 7, close: 20 }, // Sat
];

/** Human label for the hours block (used in the UI + SR text). */
export const HOURS_SUMMARY = [
  { label: "Monday – Saturday", value: "7:00 AM – 8:00 PM" },
  { label: "Sunday", value: "Closed" },
] as const;

/** Denver-local fields extracted from any instant, independent of device TZ. */
export interface DenverNow {
  /** 0 (Sun) – 6 (Sat), matching `Date.getDay()`. */
  weekday: number;
  /** Hour 0–23 in Denver wall-clock time. */
  hour: number;
  /** Minute 0–59 in Denver wall-clock time. */
  minute: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Project an absolute instant onto Denver wall-clock fields.
 *
 * We format the instant with `Intl.DateTimeFormat({ timeZone: 'America/Denver' })`
 * and read back the parts. This is correct across DST (MST/MDT) because the
 * Intl engine applies the zone's offset rules for that specific date — we never
 * touch the device's local offset. `weekday: 'short'` yields a stable English
 * token ("Mon"…) regardless of the runtime locale, which we map to 0–6.
 */
export function getDenverNow(now: Date = new Date()): DenverNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  let weekdayToken = "Sun";
  let hour = 0;
  let minute = 0;

  for (const part of parts) {
    if (part.type === "weekday") weekdayToken = part.value;
    else if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }

  // `hour12: false` can emit "24" for midnight in some engines; normalize to 0.
  if (hour === 24) hour = 0;

  return { weekday: WEEKDAY_INDEX[weekdayToken] ?? 0, hour, minute };
}

export type OpenStatus =
  | { open: true }
  | { open: false; reason: "before-open" | "after-close" | "closed-today" };

/**
 * Compute whether the shop is currently open, from Denver wall-clock fields.
 *
 * The window is `[open, close)` on minutes precision: a visit exactly at close
 * (8:00 PM) reads as closed. Sunday (no `DayHours`) is always closed.
 */
export function getOpenStatusFromDenver({ weekday, hour, minute }: DenverNow): OpenStatus {
  const today = WEEKLY_HOURS[weekday];
  if (!today) return { open: false, reason: "closed-today" };

  const minutesNow = hour * 60 + minute;
  const opensAt = today.open * 60;
  const closesAt = today.close * 60;

  if (minutesNow < opensAt) return { open: false, reason: "before-open" };
  if (minutesNow >= closesAt) return { open: false, reason: "after-close" };
  return { open: true };
}

/** Convenience: compute current open status for an instant (default: now). */
export function getOpenStatus(now: Date = new Date()): OpenStatus {
  return getOpenStatusFromDenver(getDenverNow(now));
}

/**
 * Keyless Google Maps Embed iframe `src`. The `?q=` form renders a pinned map
 * WITHOUT a JS API key, so no key is exposed to the client (PLAN.md Phase 8 /
 * BLUEPRINT O-5). If `NEXT_PUBLIC_MAPS_EMBED` is provided (a referrer-restricted
 * Embed URL), it takes precedence; otherwise we fall back to the keyless form.
 */
export function getMapEmbedSrc(override?: string): string {
  if (override && override.trim().length > 0) return override;
  const query = encodeURIComponent(SHOP_ADDRESS_ONE_LINE);
  return `https://www.google.com/maps?q=${query}&output=embed`;
}

/**
 * "Get Directions" deep link. The universal `maps?daddr=` URL hands off to the
 * native maps app on iOS/Android and Google Maps on desktop, routing to the
 * shop address as the destination.
 */
export function getDirectionsUrl(): string {
  const query = encodeURIComponent(SHOP_ADDRESS_ONE_LINE);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}
