import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site-url";

/**
 * Email OTP confirmation (BLUEPRINT.md §7). Handles the `token_hash` email-link
 * format (the Supabase-recommended SSR template):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
 *
 * Verifies the OTP to establish a session, then redirects to the sanitized
 * `next` path. Covers signup confirmation (`type=signup`/`email`) and password
 * recovery (`type=recovery`). The `/auth/callback` code flow is the default;
 * this route supports the token_hash template documented in PHASE_3_BUILD_COMPLETE.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
