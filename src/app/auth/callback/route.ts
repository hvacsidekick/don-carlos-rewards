import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/site-url";

/**
 * OAuth + email-link callback (BLUEPRINT.md §7). Exchanges the PKCE `code` for a
 * session cookie, then redirects to the sanitized `next` path. Used by Google /
 * Apple sign-in and by the default email-confirmation / password-recovery links
 * (`{{ .ConfirmationURL }}`).
 *
 * Honors the `x-forwarded-host` set by Vercel so redirects use the public origin
 * behind the proxy rather than the internal one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
