import type { Tables } from "@/lib/database.types";

/**
 * Rewards math — the ONE place business rules are computed (BLUEPRINT.md §5.4,
 * PLAN.md §8 "No magic numbers for business rules"). Every number comes from the
 * `rewards_config` row; nothing here hardcodes a threshold, rate, or stamp count.
 */
export type RewardsConfig = Tables<"rewards_config">;

export type RewardProgress = {
  /** Points within the current reward cycle (0 .. redeem_threshold). */
  within: number;
  /** Stamps to render filled (0 .. stamps_per_card). */
  filled: number;
  /** Ring fill percentage (0 .. 100). */
  percent: number;
  /** Points remaining until the next reward (0 when eligible). */
  toNext: number;
  /** True when the balance has reached the redeem threshold. */
  eligible: boolean;
};

/** Convert a dollar amount (in cents) to points using the configured earn rate. */
export function pointsForAmount(amountCents: number, cfg: RewardsConfig): number {
  return Math.floor((amountCents / 100) * cfg.points_per_dollar);
}

/**
 * Derive ring/stamp/status state from a balance + config.
 *
 * Eligibility is `balance >= redeem_threshold`. When eligible, the card shows a
 * full ring / full stamps / "reward ready" (we clamp the *display* at one full
 * cycle rather than wrapping, so a redeemable customer always sees a complete
 * card). Below threshold, progress is the simple ratio within the cycle.
 */
export function progressToNextReward(balance: number, cfg: RewardsConfig): RewardProgress {
  const threshold = cfg.redeem_threshold;
  const stamps = cfg.stamps_per_card;
  const eligible = balance >= threshold;

  if (eligible) {
    return { within: threshold, filled: stamps, percent: 100, toNext: 0, eligible: true };
  }

  const within = balance % threshold;
  const percent = Math.min(100, (within / threshold) * 100);
  const filled = Math.min(stamps, Math.floor((within / threshold) * stamps));
  const toNext = threshold - within;
  return { within, filled, percent, toNext, eligible: false };
}
