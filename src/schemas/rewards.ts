import { z } from "zod";

/**
 * Rewards Zod schemas (PLAN.md §8, golden rule: Zod on every external input).
 *
 * The redeem action takes NO client input — the amount it redeems is the
 * canonical `rewards_config.redeem_threshold`, read server-side. This schema
 * validates that config value (defense in depth) before it reaches the
 * `redeem_points` RPC: it must be a positive whole number within a sane bound.
 */
export const redeemThresholdSchema = z
  .number()
  .int("Redeem threshold must be a whole number.")
  .positive("Redeem threshold must be greater than zero.")
  .max(1_000_000, "Redeem threshold is out of range.");

export type RedeemThreshold = z.infer<typeof redeemThresholdSchema>;
