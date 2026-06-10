"use server";

import { createClient } from "@/lib/supabase/server";
import { addPointsInputSchema, qrTokenSchema } from "@/schemas/scan";
import { pointsForAmount } from "@/lib/points";
import type { ActionResult } from "@/lib/action-result";

/**
 * Admin scan / add-points Server Actions (PLAN.md §Phase 5, BLUEPRINT.md §4.4).
 *
 * THE trust boundary for this whole feature is "is the caller an admin". The
 * middleware + `(admin)` layout already gate the ROUTE, but the actions are the
 * real boundary: an attacker can POST to a Server Action directly, so EVERY
 * action here re-verifies `is_admin` SERVER-SIDE before doing anything (defense
 * in depth — never UI-only). Inputs are Zod-validated; the underlying
 * `add_points` SECURITY DEFINER RPC ALSO re-checks `is_admin` and raises 42501,
 * giving three independent layers.
 *
 * Identity is the session user (RLS-bound server client). The service-role key is
 * never imported here — the scan runs on the admin's own RLS-bound session.
 */

/** Customer fields surfaced to the admin after a successful token resolve. */
export type ResolvedCustomer = {
  id: string;
  displayName: string | null;
  email: string;
  pointsBalance: number;
};

/** Points awarded + the customer's balance after an add. */
export type AddPointsResult = {
  pointsAdded: number;
  newBalance: number;
  transactionId: string;
};

/**
 * Re-derive admin status from the session, server-side. Returns the verified
 * user id when the caller is a signed-in admin, or an `ActionResult` error to
 * return as-is otherwise. Centralised so every action enforces it identically.
 */
async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile?.is_admin) {
    // Same opaque copy whether they're a non-admin or the lookup failed — never
    // confirm to a non-admin that the boundary exists.
    return { ok: false, error: "You're not authorized to do that." };
  }

  return { ok: true, userId: user.id };
}

/**
 * Map a raw `add_points` RPC error to safe, human copy. The RPC raises:
 *   - `42501` "not authorized"  → non-admin caller (should be unreachable here,
 *     but mapped as the trust-boundary backstop)
 *   - "invalid points amount"   → out-of-range pts
 *   - "unknown user"            → target id resolves to no profile
 * Anything else falls through to a generic message (no raw codes leak).
 */
function friendlyAddPointsError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "You're not authorized to do that.";
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("unknown user")) return "We couldn't find that customer. Try scanning again.";
  if (m.includes("invalid points")) return "That points amount isn't allowed.";
  return "We couldn't add the points. Please try again.";
}

/**
 * Resolve a scanned/typed `qr_token` to its customer (admin only).
 *
 * Validates the token is a UUID (rejects garbage QRs BEFORE touching the DB),
 * re-checks admin server-side, then reads the customer under the admin's
 * read-all RLS policy. A token that matches no profile is a friendly
 * "not found", never a crash (Phase 5 acceptance: invalid/garbage QR → friendly
 * error, no crash).
 */
export async function resolveQrTokenAction(
  token: string,
): Promise<ActionResult<ResolvedCustomer>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = qrTokenSchema.safeParse(token);
  if (!parsed.success) {
    return { ok: false, error: "That code isn't a valid rewards code." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, points_balance")
    .eq("qr_token", parsed.data)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "Couldn't look up that code. Please try again." };
  }
  if (!data) {
    return { ok: false, error: "No customer matches that code. They may have rotated it." };
  }

  return {
    ok: true,
    data: {
      id: data.id,
      displayName: data.display_name,
      email: data.email,
      pointsBalance: data.points_balance,
    },
  };
}

/**
 * Add points to a customer (admin only) — the earn pipeline.
 *
 * Accepts EITHER a dollar amount (converted to points via the canonical
 * `rewards_config.points_per_dollar`, in ONE place — `pointsForAmount`) OR an
 * explicit points value. Re-checks admin, Zod-validates, computes points, then
 * calls the atomic `add_points` RPC (balance + ledger + total in one DB
 * transaction). On success the customer's RewardsCard updates live via the
 * Phase-4 realtime subscription on their `profiles` row — no extra work here.
 */
export async function addPointsAction(input: {
  target: string;
  amountCents?: number;
  points?: number;
  note?: string;
}): Promise<ActionResult<AddPointsResult>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = addPointsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the amount and try again.",
    };
  }
  const { target, amountCents, points, note } = parsed.data;

  // Resolve the number of points to award.
  let pts: number;
  let amountForLedger: number | undefined;
  if (amountCents !== undefined) {
    // Business rate from rewards_config ONLY — never hard-coded.
    const { data: config, error: configError } = await supabase
      .from("rewards_config")
      .select("points_per_dollar")
      .eq("id", 1)
      .single();
    if (configError || !config) {
      return { ok: false, error: "Rewards are temporarily unavailable. Please try again." };
    }
    pts = pointsForAmount(amountCents, config.points_per_dollar);
    amountForLedger = amountCents;
    if (pts <= 0) {
      return { ok: false, error: "That amount is too small to earn a point." };
    }
  } else {
    // `addPointsInputSchema` guarantees exactly one of amountCents/points is set.
    pts = points as number;
  }

  const { data, error } = await supabase.rpc("add_points", {
    target,
    pts,
    amount_cents: amountForLedger,
    note,
  });

  if (error) {
    return { ok: false, error: friendlyAddPointsError(error) };
  }
  if (!data) {
    return { ok: false, error: "We couldn't add the points. Please try again." };
  }

  return {
    ok: true,
    data: {
      pointsAdded: data.points_delta,
      newBalance: data.points_balance_after,
      transactionId: data.id,
    },
  };
}
