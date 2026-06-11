import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * `(admin)` route-group guard — defense in depth (BLUEPRINT.md §1 "trust
 * boundary = server", §7; PLAN.md §Phase 5).
 *
 * Middleware already redirects non-admins away from `/scan` etc., but we re-check
 * `is_admin` HERE on the server so an admin page can never render without a
 * verified admin session even if middleware is bypassed. A non-admin (or signed
 * out) is redirected, never shown a 500 — and the Server Actions enforce the
 * boundary independently again. This is the first `(admin)` route; the full
 * admin portal is Phase 9.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
