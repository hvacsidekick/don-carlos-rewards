"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-guard";
import {
  adjustPointsSchema,
  customerListQuerySchema,
  redeemOnBehalfSchema,
} from "@/schemas/admin";
import { getCustomersPage } from "@/lib/customers.server";
import { getCustomerTransactionsPage } from "@/lib/customers.server";
import type { CustomerPage } from "@/lib/customers";
import type { TransactionListItem } from "@/lib/transactions";
import type { ActionResult } from "@/lib/action-result";

/**
 * Admin-portal Server Actions (PLAN.md §Phase 9, BLUEPRINT.md §5.2).
 *
 * EVERY action begins with `requireAdmin()` — the real trust boundary. The
 * route/middleware guards are UI-level; an attacker can POST a Server Action
 * directly, so each one independently re-derives identity from the session and
 * re-reads `is_admin` before touching data. The underlying SECURITY DEFINER
 * RPCs (`adjust_points`, `redeem_points`) ALSO re-check admin/identity and write
 * the `audit_log` themselves, so we never double-write the audit trail here.
 *
 * Inputs are Zod-validated against the SHARED `schemas/admin` (same rules the
 * client forms use); the server never trusts a client-passed value. Results are
 * the discriminated `ActionResult` — errors are mapped to safe copy, never
 * thrown raw to the client.
 */

/** Balance after a mutation + the appended ledger row id. */
export type AdminMutationResult = {
  newBalance: number;
  transactionId: string;
  /** The signed delta actually applied (may differ from requested when floored at 0). */
  appliedDelta: number;
};

/** Map an `adjust_points` RPC error to safe copy (mirrors scan.ts discipline). */
function friendlyAdjustError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "You're not authorized to do that.";
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("unknown user")) return "We couldn't find that customer.";
  if (m.includes("reason required")) return "A reason is required for an adjustment.";
  if (m.includes("non-zero")) return "Enter a non-zero amount.";
  return "We couldn't apply the adjustment. Please try again.";
}

/**
 * Manual point adjustment (add or subtract) with a MANDATORY reason.
 *
 * Re-checks admin, Zod-validates (reason `.min(3)`, delta non-zero), then calls
 * the atomic `adjust_points` RPC which: floors the new balance at 0, writes an
 * `adjustment` ledger row with the APPLIED delta, and writes the `audit_log`
 * entry with the admin's uid as actor — all in one transaction. We revalidate
 * the customer detail so the balance + history refresh.
 */
export async function adjustPointsAction(input: {
  userId: string;
  delta: number;
  reason: string;
}): Promise<ActionResult<AdminMutationResult>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = adjustPointsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the adjustment and try again.",
    };
  }
  const { userId, delta, reason } = parsed.data;

  const { data, error } = await supabase.rpc("adjust_points", {
    target: userId,
    delta,
    reason,
  });

  if (error) {
    return { ok: false, error: friendlyAdjustError(error) };
  }
  if (!data) {
    return { ok: false, error: "We couldn't apply the adjustment. Please try again." };
  }

  revalidatePath(`/customers/${userId}`);

  return {
    ok: true,
    data: {
      newBalance: data.points_balance_after,
      transactionId: data.id,
      appliedDelta: data.points_delta,
    },
  };
}

/** Map a `redeem_points` RPC error to safe copy. */
function friendlyRedeemError(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "You're not authorized to do that.";
  if (error.code === "P0001") return "This customer doesn't have enough points to redeem.";
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("insufficient balance")) {
    return "This customer doesn't have enough points to redeem.";
  }
  return "We couldn't redeem the reward. Please try again.";
}

/**
 * Redeem one reward ON BEHALF of an in-person customer.
 *
 * NOTE on identity: `redeem_points(pts)` redeems for `auth.uid()` — the SESSION
 * user. To redeem for ANOTHER user as staff, we use the admin-authorized,
 * audited `redeem_points_for(target, pts)` RPC. It writes a real
 * `transaction_type = 'redeem'` ledger row (so in-person redemptions count in the
 * redemption KPIs) and increments `total_redemptions` — unlike a generic
 * `adjustment`. We read the canonical `rewards_config.redeem_threshold`
 * server-side (never client-chosen) and pass it as the debit amount; the RPC's
 * `points_balance >= pts` guard makes the debit atomic, never over-debits, and
 * raises P0001 on insufficient balance. It writes the audit entry with the admin
 * as actor.
 *
 * Eligibility (balance ≥ threshold) is also re-checked server-side BEFORE the
 * debit so we surface a friendly message rather than relying on the RPC raise;
 * the RPC guard remains the atomic source of truth.
 */
export async function redeemOnBehalfAction(input: {
  userId: string;
}): Promise<ActionResult<AdminMutationResult>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = redeemOnBehalfSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid customer." };
  }
  const { userId } = parsed.data;

  // Canonical reward size from config (single source of business rules — PLAN §8).
  const { data: config, error: configError } = await supabase
    .from("rewards_config")
    .select("redeem_threshold")
    .eq("id", 1)
    .single();
  if (configError || !config) {
    return { ok: false, error: "Rewards are temporarily unavailable. Please try again." };
  }
  const threshold = config.redeem_threshold;

  // Re-check eligibility server-side: must have a full reward's worth of points.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("points_balance")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    return { ok: false, error: "We couldn't look up that customer. Please try again." };
  }
  if (!profile) {
    return { ok: false, error: "We couldn't find that customer." };
  }
  if (profile.points_balance < threshold) {
    return { ok: false, error: "This customer doesn't have enough points to redeem." };
  }

  // Debit via the admin-authorized, audited redeem path. This writes a real
  // `redeem` ledger row and increments total_redemptions (vs a generic adjustment),
  // so in-person redemptions are visible to the redemption KPIs.
  const { data, error } = await supabase.rpc("redeem_points_for", {
    target: userId,
    pts: threshold,
  });

  if (error) {
    return { ok: false, error: friendlyRedeemError(error) };
  }
  if (!data) {
    return { ok: false, error: "We couldn't redeem the reward. Please try again." };
  }

  revalidatePath(`/customers/${userId}`);

  return {
    ok: true,
    data: {
      newBalance: data.points_balance_after,
      transactionId: data.id,
      appliedDelta: data.points_delta,
    },
  };
}

/**
 * Load a page of the customer list (admin only) for the client island's search
 * + "load more". Re-checks admin and re-validates the query; the heavy lifting
 * (keyset pagination, last-activity batch) is in `customers.server.ts`.
 */
export async function loadCustomersAction(input: {
  search?: string;
  cursor: string | null;
}): Promise<ActionResult<CustomerPage>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  const parsed = customerListQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid search." };
  }

  try {
    const page = await getCustomersPage({
      search: parsed.data.search,
      cursor: parsed.data.cursor ?? null,
    });
    return { ok: true, data: page };
  } catch {
    return { ok: false, error: "We couldn't load customers. Please try again." };
  }
}

/**
 * Load a further page of a customer's transaction history (admin only) for the
 * detail page's "load more".
 */
export async function loadCustomerTransactionsAction(input: {
  userId: string;
  cursor: string | null;
}): Promise<ActionResult<{ items: TransactionListItem[]; nextCursor: string | null }>> {
  const supabase = await createClient();

  const admin = await requireAdmin(supabase);
  if (!admin.ok) return admin;

  try {
    const page = await getCustomerTransactionsPage({
      userId: input.userId,
      cursor: input.cursor,
    });
    return { ok: true, data: page };
  } catch {
    return { ok: false, error: "We couldn't load more history. Please try again." };
  }
}
