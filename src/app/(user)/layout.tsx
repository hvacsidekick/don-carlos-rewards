import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * `(user)` route-group guard — defense in depth (BLUEPRINT.md §1 "trust
 * boundary = server", §7). Middleware already redirects unauthenticated
 * requests, but we re-check on the server here so a protected page can never
 * render without a verified session even if middleware is bypassed.
 */
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
