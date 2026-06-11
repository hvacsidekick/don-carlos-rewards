import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/security-headers";

/**
 * Root middleware (BLUEPRINT.md §7, Phase 10 criterion 4).
 *
 * Two responsibilities:
 *   1. Generate a PER-REQUEST CSP nonce and apply the Content-Security-Policy
 *      to the response. The nonce is also forwarded on the REQUEST header
 *      (`x-nonce`) so Next.js applies it to its own inline bootstrap scripts and
 *      RSC can read it — this is what lets us drop `unsafe-inline` from
 *      `script-src`. (The static HSTS/nosniff/frame/referrer/permissions headers
 *      are set in `next.config.ts`.)
 *   2. Delegate to `updateSession`, which refreshes the Supabase auth cookie and
 *      enforces the `(user)`/`(admin)` route guards.
 *
 * The nonce flows INTO `updateSession` so the response it returns (including
 * redirect responses) carries the matching CSP.
 */
export async function middleware(request: NextRequest) {
  // 16 random bytes → base64 nonce (Edge runtime provides Web Crypto).
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const csp = buildCsp(nonce);

  return updateSession(request, { nonce, csp });
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
