import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";
import {
  computeRedemptionRate,
  type AdminAnalytics,
  type AnalyticsSeriesPoint,
  type TopCustomer,
} from "@/lib/analytics";

/**
 * Server-only analytics data access (PLAN.md §Phase 9). Every figure comes from
 * an ADMIN-GATED SECURITY DEFINER RPC — never a client-replayable table query
 * (PLAN §Phase 9 "Watch": all-rows aggregates must run only as admin RPCs).
 *
 * `admin_analytics()` provides the 5 base KPIs; `admin_analytics_extended()`
 * adds the redemption-rate inputs, the daily series, and top customers. Both
 * re-check `is_admin` inside Postgres; we also `requireAdmin` here so a
 * non-admin gets a clean null (→ the page is already route-guarded too).
 */

/** Shape returned by `admin_analytics()` (JSON). Validated before use. */
const baseSchema = z.object({
  total_customers: z.number(),
  active_30d: z.number(),
  points_outstanding: z.number(),
  points_issued: z.number(),
  redemptions: z.number(),
});

/** Shape returned by `admin_analytics_extended()` (JSON). Validated before use. */
const extendedSchema = z.object({
  points_issued: z.number(),
  points_redeemed: z.number(),
  series: z.array(
    z.object({
      day: z.string(),
      issued: z.number(),
      redeemed: z.number(),
    }),
  ),
  top_customers: z.array(
    z.object({
      id: z.string(),
      display_name: z.string().nullable(),
      email: z.string(),
      points_balance: z.number(),
      total_points_earned: z.number(),
    }),
  ),
});

/**
 * Fetch the full analytics payload. Returns null if the caller isn't an admin or
 * either RPC fails / returns a shape we can't trust — the page renders a
 * friendly "unavailable" state instead of crashing.
 */
export async function getAdminAnalytics(windowDays = 30): Promise<AdminAnalytics | null> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) {
    return null;
  }

  const [baseRes, extendedRes] = await Promise.all([
    supabase.rpc("admin_analytics"),
    supabase.rpc("admin_analytics_extended", { days: windowDays }),
  ]);

  if (baseRes.error || extendedRes.error) {
    return null;
  }

  const base = baseSchema.safeParse(baseRes.data);
  const extended = extendedSchema.safeParse(extendedRes.data);
  if (!base.success || !extended.success) {
    return null;
  }

  const series: AnalyticsSeriesPoint[] = extended.data.series.map((s) => ({
    day: s.day,
    issued: s.issued,
    redeemed: s.redeemed,
  }));

  const topCustomers: TopCustomer[] = extended.data.top_customers.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    email: c.email,
    pointsBalance: c.points_balance,
    totalPointsEarned: c.total_points_earned,
  }));

  return {
    totalCustomers: base.data.total_customers,
    active30d: base.data.active_30d,
    pointsIssued: base.data.points_issued,
    redemptions: base.data.redemptions,
    pointsOutstanding: base.data.points_outstanding,
    pointsRedeemed: extended.data.points_redeemed,
    redemptionRate: computeRedemptionRate(extended.data.points_redeemed, base.data.points_issued),
    series,
    topCustomers,
  };
}
