"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "apple";

/**
 * Google + Apple sign-in (BLUEPRINT.md §7; PLAN.md §Phase 3). Initiates the
 * OAuth PKCE flow from the browser client; the provider redirects back to
 * `/auth/callback`, which exchanges the code for a session. `redirectTo` uses
 * the live origin so it works on localhost, Vercel previews, and prod without
 * code changes (the matching redirect URLs must be registered in Supabase).
 *
 * Provider credentials (Google client, Apple Service ID + key — O-1) are
 * configured in the Supabase dashboard; this component is provider-agnostic and
 * needs no change when they are enabled. Apple is flagged blocked per R-3 until
 * the Apple Developer account is available.
 */
export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [pending, setPending] = React.useState<Provider | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setPending(null);
      toast.error("Couldn't start sign-in. Please try again.");
    }
    // On success the browser navigates to the provider — no further UI needed.
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => signIn("google")}
        disabled={pending !== null}
        aria-label="Continue with Google"
      >
        {pending === "google" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => signIn("apple")}
        disabled={pending !== null}
        aria-label="Continue with Apple"
      >
        {pending === "apple" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <AppleIcon />
        )}
        Continue with Apple
      </Button>
    </div>
  );
}

/** Multicolor Google "G" mark. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1.03 7.6-2.78l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.21a6.9 6.9 0 0 1 0-4.42V6.81H1.76a11.51 11.51 0 0 0 0 10.38l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.7 1.3 15.1.25 12 .25A11.5 11.5 0 0 0 1.76 6.81l3.84 2.98C6.5 6.76 9.02 4.75 12 4.75Z"
      />
    </svg>
  );
}

/** Apple logo mark — uses currentColor so it inverts in dark mode. */
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.46 2.01-3.64 2.1-3.7-1.14-1.67-2.92-1.9-3.55-1.93-1.51-.15-2.95.89-3.71.89-.77 0-1.95-.87-3.21-.85-1.65.03-3.18.96-4.03 2.44-1.72 2.98-.44 7.39 1.23 9.81.82 1.19 1.79 2.51 3.06 2.46 1.23-.05 1.69-.79 3.18-.79 1.48 0 1.9.79 3.2.77 1.32-.02 2.16-1.2 2.97-2.4.94-1.37 1.32-2.7 1.34-2.77-.03-.01-2.57-.99-2.6-3.92Zm-2.44-7.2c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38Z" />
    </svg>
  );
}
