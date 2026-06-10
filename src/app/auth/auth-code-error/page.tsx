import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link problem" };

/**
 * Fallback for a failed OAuth code exchange or expired/invalid email link
 * (DESIGN_SYSTEM.md §14 — no dead ends; friendly, actionable copy).
 */
export default function AuthCodeErrorPage() {
  return (
    <AuthShell
      title="That link didn't work"
      mascot="error"
      subtitle="It may have expired or already been used. Let's try again."
    >
      <div className="flex flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
