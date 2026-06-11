import { z } from "zod";

/**
 * Scan / add-points Zod schemas (PLAN.md §8 golden rule: Zod on every external
 * input; Phase 5 acceptance: "Amount input validated; negative/zero rejected").
 *
 * Single source of truth shared by the admin scan form (client) and the server
 * actions (server re-validation). The server NEVER trusts the client — every
 * field is re-parsed in the action before it reaches an RPC.
 */

/**
 * A `qr_token` is a v4-shaped UUID (BLUEPRINT.md §4.1, §1 "opaque QR tokens").
 * `z.string().uuid()` accepts the canonical 8-4-4-4-12 hex form, which is the
 * exact payload a scanned QR carries. Anything else is rejected as garbage
 * before we ever query the database.
 */
export const qrTokenSchema = z
  .string()
  .trim()
  .uuid("That code isn't a valid rewards code.");

/**
 * Dollar amount entered by staff, in whole cents.
 *
 * Bounds (defense in depth — the DB `add_points` RPC also caps points):
 *  - positive integer cents only (no negative/zero — acceptance criterion)
 *  - max $5,000.00 (500_000 cents) — a sane single-transaction ceiling that,
 *    even at a high points-per-dollar rate, stays under the RPC's 100k cap.
 */
export const amountCentsSchema = z
  .number()
  .int("Enter a valid dollar amount.")
  .positive("Amount must be greater than zero.")
  .max(500_000, "That amount is too large.");

/**
 * Explicit points entry (alternative to a dollar amount). Mirrors the RPC's own
 * guard: a positive whole number, capped at 100,000 (the `add_points` ceiling).
 */
export const pointsSchema = z
  .number()
  .int("Enter a whole number of points.")
  .positive("Points must be greater than zero.")
  .max(100_000, "That's more points than a single scan can add.");

/** Optional staff note attached to the earn transaction. */
export const noteSchema = z
  .string()
  .trim()
  .max(280, "Note is too long.")
  .optional();

/**
 * The add-points action accepts EITHER a dollar amount (converted to points via
 * `rewards_config.points_per_dollar`) OR an explicit points value — never both,
 * never neither. The refinement enforces exactly-one so the points computation
 * has a single unambiguous source.
 */
export const addPointsInputSchema = z
  .object({
    target: z.string().uuid("Invalid customer."),
    amountCents: amountCentsSchema.optional(),
    points: pointsSchema.optional(),
    note: noteSchema,
  })
  .refine(
    (v) => (v.amountCents === undefined) !== (v.points === undefined),
    { message: "Enter either a dollar amount or a points value.", path: ["amountCents"] },
  );

export type AddPointsInput = z.infer<typeof addPointsInputSchema>;
