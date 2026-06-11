/**
 * Shared, client-safe analytics types + the redemption-rate formula (PLAN.md
 * §Phase 9). Types live here so the chart client island can import them without
 * `server-only`; the Supabase RPC calls live in `analytics.server.ts`.
 */

/** One day of the points issued/redeemed time-series. */
export type AnalyticsSeriesPoint = {
  /** Calendar day, YYYY-MM-DD, in the store's timezone. */
  day: string;
  /** Points issued (earned) that day. */
  issued: number;
  /** Points redeemed (absolute) that day. */
  redeemed: number;
};

/** A top customer by lifetime points earned. */
export type TopCustomer = {
  id: string;
  displayName: string | null;
  email: string;
  pointsBalance: number;
  totalPointsEarned: number;
};

/** The full analytics payload the dashboard renders. */
export type AdminAnalytics = {
  totalCustomers: number;
  active30d: number;
  pointsIssued: number;
  redemptions: number;
  /** Points outstanding = total liability still on the books. */
  pointsOutstanding: number;
  /** Total points redeemed (absolute), the numerator of the redemption rate. */
  pointsRedeemed: number;
  /**
   * Redemption rate as a fraction in [0, 1+]. Defined as
   *   pointsRedeemed / pointsIssued
   * — the share of issued points that customers have redeemed. Guarded against
   * divide-by-zero (0 issued → 0). Can exceed 1 if historical adjustments added
   * balance that was then redeemed; the UI caps the displayed bar at 100% but
   * shows the true percentage.
   */
  redemptionRate: number;
  series: AnalyticsSeriesPoint[];
  topCustomers: TopCustomer[];
};

/**
 * Compute the redemption rate with an explicit divide-by-zero guard. Kept as a
 * pure function so it's unit-testable and the formula has one definition.
 */
export function computeRedemptionRate(pointsRedeemed: number, pointsIssued: number): number {
  if (pointsIssued <= 0) return 0;
  return pointsRedeemed / pointsIssued;
}
