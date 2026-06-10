"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Resend the signup confirmation email (DESIGN_SYSTEM.md §13 — kind, actionable).
 * Uses the browser client `auth.resend`. A short cooldown discourages spamming;
 * real rate limiting is enforced by Supabase and hardened in Phase 10.
 */
export function ResendEmailButton({ email }: { email?: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email) {
      toast.error("We don't have your email — try signing up again.");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setPending(false);
    if (error) {
      toast.error("Couldn't resend right now. Please try again shortly.");
      return;
    }
    toast.success("Confirmation email sent.");
    setCooldown(30);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="w-full"
      onClick={resend}
      disabled={pending || cooldown > 0}
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {cooldown > 0 ? `Resend in ${cooldown}s` : pending ? "Sending…" : "Resend email"}
    </Button>
  );
}
