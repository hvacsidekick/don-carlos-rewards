"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { redeemThresholdSchema } from "@/schemas/rewards";
import type { ActionResult } from "@/lib/action-result";

/**
 * Rewards Server Actions (BLUEPRINT.md §5.2, PHASE_4_TASK.md §4.6).
 *
 * Points are NEVER written by clients. `redeemPointsAction` reads the canonical
 * `redeem_threshold` from `rewards_config` server-side and redeems EXACTLY that
 * many points for one reward (one reward per full card — D4-4). The client never
 * chooses the amount, so it can't redeem a non-threshold quantity.
 *
 * The Phase-2 `redeem_points` SECURITY DEFINER RPC atomically (a) checks the
 * caller's balance ≥ pts, (b) decrements the balance, (c) increments
 * `total_redemptions`, and (d) appends a `redeem` ledger row — all in one DB
 * transaction. Identity is the session user (RLS-bound server client); the
 * client cannot redeem for anyone else. Errors are mapped to friendly copy,
 * never thrown raw to the client (DESIGN_SYSTEM.md §13).
 */
export type RedeemResult = {
  /** Balance after the redemption (denormalized cache kept in sync by the RPC). */
  newBalance: number;
  /** The id of the appended `redeem` transaction row. */
  transactionId: string;
};

/**
 * Detect the RPC's insufficient-balance signal precisely.
 *
 * The `redeem_points` function raises exactly:
 *   `raise exception 'insufficient balance' using errcode = 'P0001';`
 * when the atomic `points_balance >= pts` guard rejects the debit
 * (migration 20260610011444_points_functions.sql). PostgREST surfaces the
 * SQLSTATE in `error.code` and the message text in `error.message`, so we
 * match on either the `P0001` code or the exact `"insufficient balance"`
 * phrase. Matching the specific signal (not any message containing "balance")
 * stops an unrelated DB error from being mis-reported as "not enough points";
 * such errors fall through to the generic friendly message instead (m-2).
 */
function isInsufficientBalance(error: { code?: string; message?: string }): boolean {
  if (error.code === "P0001") return true;
  return (error.message ?? "").toLowerCase().includes("insufficient balance");
}

/**
 * Redeem one reward: spends exactly `rewards_config.redeem_threshold` points.
 * Takes no client input — the amount is derived server-side from config. (The
 * Zod pattern is retained to validate the config value before it reaches the
 * RPC; future args would be validated the same way.)
 */
export async function redeemPointsAction(): Promise<ActionResult<RedeemResult>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  // Business numbers come from rewards_config ONLY — never hard-coded.
  const { data: config, error: configError } = await supabase
    .from("rewards_config")
    .select("redeem_threshold")
    .eq("id", 1)
    .single();

  if (configError || !config) {
    return { ok: false, error: "Rewards are temporarily unavailable. Please try again." };
  }

  const parsedThreshold = redeemThresholdSchema.safeParse(config.redeem_threshold);
  if (!parsedThreshold.success) {
    return { ok: false, error: "Rewards are temporarily unavailable. Please try again." };
  }

  const { data, error } = await supabase.rpc("redeem_points", { pts: parsedThreshold.data });

  if (error) {
    if (isInsufficientBalance(error)) {
      return { ok: false, error: "You don't have enough points to redeem yet." };
    }
    return { ok: false, error: "We couldn't redeem your reward. Please try again." };
  }

  // The RPC returns the new `transactions` row. A null/absent row means the
  // atomic guard rejected the redemption (balance fell short) — treat as such.
  if (!data) {
    return { ok: false, error: "You don't have enough points to redeem yet." };
  }

  revalidatePath("/dashboard");

  return {
    ok: true,
    data: {
      newBalance: data.points_balance_after,
      transactionId: data.id,
    },
  };
}
