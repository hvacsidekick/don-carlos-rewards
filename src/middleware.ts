import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware (BLUEPRINT.md §7). Delegates to `updateSession`, which
 * refreshes the Supabase auth cookie and enforces `(user)`/`(admin)` route
 * guards on every matched request.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Run on all routes EXCEPT static assets and image files. The auth-callback
   * and confirm routes must pass through (they set the session cookie), so they
   * are intentionally NOT excluded here.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
