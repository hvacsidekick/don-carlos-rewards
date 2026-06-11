import { z } from "zod";

/**
 * Admin-portal Zod schemas (PLAN.md §8 golden rule — Zod on every external
 * input; BLUEPRINT.md §5.1). Single source of truth shared by the admin client
 * forms and the Server Actions. The server ALWAYS re-parses every field before
 * it reaches an RPC — the client schema is a UX convenience, never the boundary.
 */

/** A profile id is a UUID (the customer being acted on). */
export const customerIdSchema = z.string().uuid("Invalid customer.");

/**
 * Customer-list search + keyset pagination input.
 *
 * `search` is an optional name/email fragment (trimmed, bounded). `cursor` is
 * the opaque keyset token produced by the previous page (or null for page one).
 * Both are bounded so a hostile caller can't send an unbounded string.
 */
export const customerListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  cursor: z.string().max(512).nullable().optional(),
});
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

/**
 * Manual point adjustment (admin only). A REASON IS MANDATORY (PLAN.md §Phase 9
 * acceptance: "Manual adjustment requires a reason") — enforced here AND by the
 * `adjust_points` RPC (`reason required`, 22023). `delta` is a non-zero signed
 * integer (add or subtract); the RPC floors the resulting balance at 0 and
 * records the APPLIED delta in the ledger (mig 20260610013637).
 *
 * Bounds mirror the points functions' own ceiling (±100,000) so the UI can't
 * submit a value the DB would reject.
 */
export const adjustPointsSchema = z.object({
  userId: customerIdSchema,
  delta: z
    .number()
    .int("Enter a whole number of points.")
    .refine((n) => n !== 0, "Enter a non-zero amount.")
    .refine((n) => Math.abs(n) <= 100_000, "That's more than a single adjustment can change."),
  reason: z
    .string()
    .trim()
    .min(3, "Give a brief reason (at least 3 characters).")
    .max(280, "Reason is too long."),
});
export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>;

/**
 * Redeem-on-behalf (admin redeems one reward for an in-person customer).
 * Takes only the customer id — the points amount is the canonical
 * `rewards_config.redeem_threshold`, read server-side (never client-chosen), the
 * same rule the customer's own redeem flow uses.
 */
export const redeemOnBehalfSchema = z.object({
  userId: customerIdSchema,
});
export type RedeemOnBehalfInput = z.infer<typeof redeemOnBehalfSchema>;

/**
 * Analytics window (days). Clamped to a sane range that matches the RPC's own
 * `least(greatest(days,1),365)` clamp; the chart only ever requests 30.
 */
export const analyticsWindowSchema = z
  .number()
  .int()
  .min(1)
  .max(365)
  .default(30);
