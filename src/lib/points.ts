/**
 * Points math (PLAN.md §8 "no magic numbers for business rules" — the earn rate
 * comes from `rewards_config.points_per_dollar`, never hard-coded).
 *
 * THE conversion lives here, in one place, so the "$1 → N points" rule has a
 * single definition shared by the admin scan UI preview and the server action
 * (Phase 5 acceptance: "$1 = points conversion in one place").
 */

/**
 * Convert a whole-cent amount into earned points at the given rate.
 *
 * `amountCents` is integer cents (e.g. 350 = $3.50). `pointsPerDollar` is the
 * canonical rate read from `rewards_config`. Points are whole numbers, so a
 * partial-dollar remainder is floored (a customer never earns a fractional
 * point). Example: 350 cents @ 1 pt/$ → 3 points; 350 @ 2 → 7 points.
 */
export function pointsForAmount(amountCents: number, pointsPerDollar: number): number {
  return Math.floor((amountCents / 100) * pointsPerDollar);
}
