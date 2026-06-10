import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set new password" };

/**
 * Reached from a recovery email link: `/auth/callback` (or `/auth/confirm`)
 * establishes a recovery session, then redirects here. `updatePasswordAction`
 * re-checks that session server-side, so an expired/garbage link fails safely
 * rather than allowing a password change.
 */
export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
