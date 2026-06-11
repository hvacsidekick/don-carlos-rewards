import "server-only";

import type { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin trust boundary (BLUEPRINT.md §1 "trust boundary = server",
 * §3; PLAN.md §Phase 9 acceptance: "verified server-side, not just hidden UI").
 *
 * The `(admin)` layout guards the ROUTE and middleware guards the URL, but a
 * Server Action can be POSTed directly, so EVERY admin action must independently
 * re-derive identity from the session and re-read `profiles.is_admin`. This is
 * that single check, shared by all admin actions so the boundary is enforced
 * identically everywhere (the Phase-5 scan action established the pattern; this
 * extracts it so Phase-9 actions reuse it verbatim rather than re-implementing).
 *
 * The underlying points/analytics RPCs ALSO re-check `is_admin` and raise 42501,
 * giving three independent layers (route guard → action guard → RPC guard).
 */
export async function requireAdmin(
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
