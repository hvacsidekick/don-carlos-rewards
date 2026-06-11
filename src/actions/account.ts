"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/action-result";

/**
 * Account deletion + data export (PLAN.md §Phase 10 criterion 6 — GDPR).
 *
 * Both actions re-derive identity from the SESSION (`getUser()` revalidates the
 * JWT against the auth server) — the client never passes a user id. Deletion
 * additionally anonymizes the non-cascading audit/staff references before
 * removing the auth user (the Phase-2 note: `audit_log.actor_id` and
 * `transactions.staff_id` are intentionally non-cascading to preserve the audit
 * trail, so they must be NULLed rather than relying on cascade).
 *
 * Deletion requires a real `SUPABASE_SERVICE_ROLE_KEY` (server-only). In this
 * build the key is the dev placeholder, so the `auth.admin.deleteUser` call is
 * DEPLOY-GATED — it returns a safe error rather than crashing. The data export
 * does NOT need the service role and works fully today.
 */

/** The user's exported data (GDPR "download my data"). */
export type ExportedData = {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  transactions: Record<string, unknown>[];
};

export async function deleteAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return {
      ok: false,
      error: "Account deletion is temporarily unavailable. Please try again later.",
    };
  }

  // Anonymize the user's NON-CASCADING references first so the audit trail
  // survives the deletion without dangling/identifying the deleted user
  // (Phase-2 note). `staff_id`/`actor_id` are SET NULL here; the user's OWN
  // profile + transactions cascade-delete with the auth user below. We use the
  // service-role client (bypasses RLS) for these maintenance writes.
  //
  // Best-effort: a failure here must not block the deletion (the cascade still
  // removes the user's own PII); we proceed to the auth-user delete regardless.
  try {
    await service.from("transactions").update({ staff_id: null }).eq("staff_id", user.id);
    await service.from("audit_log").update({ actor_id: null }).eq("actor_id", user.id);
  } catch {
    // Non-fatal — fall through to the authoritative auth-user deletion.
  }

  try {
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) {
      return {
        ok: false,
        error: "Could not delete your account. Please try again or contact support.",
      };
    }
  } catch {
    return {
      ok: false,
      error: "Account deletion is temporarily unavailable. Please try again later.",
    };
  }

  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Data export (GDPR "download my data"). Assembles the signed-in user's profile
 * + full transaction ledger as a JSON-serializable object. RLS already scopes
 * both reads to the user, but we ALSO `.eq("user_id"/"id", user.id)` explicitly
 * (defense in depth — an admin's read-all RLS must not leak the global feed).
 * No service-role key needed — runs entirely under the user's own session.
 */
export async function exportMyDataAction(): Promise<ActionResult<ExportedData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, error: "We couldn't prepare your data export. Please try again." };
  }

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (txError) {
    return { ok: false, error: "We couldn't prepare your data export. Please try again." };
  }

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      profile: profile ?? null,
      transactions: transactions ?? [],
    },
  };
}
