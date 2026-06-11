import type { Metadata } from "next";
import Link from "next/link";

import { Mascot } from "@/components/common/Mascot";

/**
 * Offline fallback (PLAN.md §Phase 11 — "sensible offline messaging for data").
 *
 * The service worker serves THIS page for a navigation request that fails while
 * offline (network-first for navigations; this static shell is the fallback).
 * It must be fully self-contained — no data fetch, no auth — so it renders from
 * the SW cache with no network. It is statically rendered (no dynamic APIs), so
 * the SW can precache it by URL.
 *
 * It carries no nonce'd inline script and no Supabase call, so serving it from
 * cache never collides with the per-request CSP nonce (the cached document has
 * no inline script whose nonce could go stale).
 */
export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen-safe max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <Mascot expression="error" size={96} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title2 font-bold text-foreground">You&apos;re offline</h1>
        <p className="text-body text-fg-secondary">
          Your rewards card needs a connection to show your latest points. Reconnect
          and we&apos;ll pick up right where you left off.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 text-body-emph font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Try again
      </Link>
    </main>
  );
}
