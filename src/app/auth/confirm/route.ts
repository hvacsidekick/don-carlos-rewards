import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site-url";

/**
 * Validate the email-OTP `type` rather than blind-casting it (closes Phase 3
 * audit m-3). Only the email-link OTP types Supabase issues are accepted; any
 * other value short-circuits to the error page.
 */
const emailOtpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

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
  const typeParsed = emailOtpTypeSchema.safeParse(searchParams.get("type"));
  const next = safeNextPath(searchParams.get("next"));

  if (tokenHash && typeParsed.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: typeParsed.data,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
