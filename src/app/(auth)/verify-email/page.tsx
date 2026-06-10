import Link from "next/link";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResendEmailButton } from "@/components/auth/ResendEmailButton";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthShell
      title="Check your inbox"
      mascot="empty"
      subtitle={
        email
          ? `We sent a confirmation link to ${email}. Tap it to activate your account.`
          : "We sent you a confirmation link. Tap it to activate your account."
      }
      footer={
        <Link
          href="/login"
          className="rounded font-medium text-dc-red-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <ResendEmailButton email={email} />
        <p className="text-center text-footnote text-fg-secondary">
          Didn&apos;t get it? Check your spam folder, then resend.
        </p>
      </div>
    </AuthShell>
  );
}
