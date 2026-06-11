import type { Metadata } from "next";

import { getServerAuth } from "@/lib/auth/get-server-auth";
import { QrTokenCard } from "@/components/auth/QrTokenCard";
import { Mascot } from "@/components/common/Mascot";

export const metadata: Metadata = { title: "Your QR Code" };

/**
 * `/qr` — the prominent "Show QR" destination from the bottom tab bar
 * (DESIGN_SYSTEM.md §5.5, §5.9). Server Component: fetches the signed-in user's
 * profile and hands the opaque `qr_token` to the QR card client island. The QR
 * tile renders white in both modes for scannability.
 */
export default async function QrPage() {
  const { profile } = await getServerAuth();

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col items-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-title3 text-foreground">Your rewards code</h1>
        <p className="text-footnote text-fg-secondary">
          Scan at checkout to collect points.
        </p>
      </header>

      {profile?.qr_token ? (
        <QrTokenCard initialToken={profile.qr_token} />
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot expression="error" size={88} />
          <p className="text-headline text-foreground">Your code isn&apos;t ready yet</p>
          <p className="max-w-[320px] text-footnote text-fg-secondary">
            Refresh in a moment. If this keeps happening, please contact us.
          </p>
        </div>
      )}
    </main>
  );
}
