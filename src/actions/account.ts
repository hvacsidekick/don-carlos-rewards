"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionResult } from "@/lib/action-result";

/**
 * Account deletion (PLAN.md §Phase 3 "Delete account" — stub wired; full GDPR
 * purge + data export finalized in Phase 10).
 *
 * Deletes the `auth.users` row via the service-role admin API; the Phase-2
 * `on delete cascade` from `profiles`/`transactions` → `auth.users` removes the
 * user's data. Identity is re-derived from the session — the client never passes
 * a user id.
 *
 * Requires a real `SUPABASE_SERVICE_ROLE_KEY` (server-only). If the key is the
 * dev placeholder, the admin call fails and we return a safe error rather than
 * crashing.
 */
export async function deleteAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  try {
    const service = createServiceClient();
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
