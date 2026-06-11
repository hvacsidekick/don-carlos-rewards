import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/nav/AdminNav";

/**
 * `(admin)` route-group guard + portal chrome — defense in depth (BLUEPRINT.md
 * §1 "trust boundary = server", §7; PLAN.md §Phase 9).
 *
 * Middleware already redirects non-admins away from `/scan` etc., but we re-check
 * `is_admin` HERE on the server so an admin page can never render without a
 * verified admin session even if middleware is bypassed. A non-admin (or signed
 * out) is redirected, never shown a 500 — and the Server Actions enforce the
 * boundary independently again.
 *
 * The shared `AdminNav` (Scan / Customers / Analytics) renders above every admin
 * page so the portal has consistent, tablet-responsive navigation.
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6">
      <AdminNav />
      {children}
    </div>
  );
}
