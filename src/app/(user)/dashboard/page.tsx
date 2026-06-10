import Link from "next/link";
import type { Metadata } from "next";

import { getServerAuth } from "@/lib/auth/get-server-auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase 3 placeholder dashboard. It exists so post-login redirects and
 * protected-route guards are testable now. The signature RewardsCard (stamp
 * grid + progress ring + live realtime) is built in Phase 4 and replaces this.
 */
export default async function DashboardPage() {
  const { profile } = await getServerAuth();
  const name = profile?.display_name?.split(" ")[0] ?? "there";

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-body text-fg-secondary">Welcome back,</p>
        <h1 className="text-title2 text-foreground">{name} 🌮</h1>
      </header>

      <section className="rounded-3xl border border-separator bg-surface-tertiary p-6 shadow-card dark:shadow-card-dark">
        <p className="text-footnote text-fg-secondary">Points balance</p>
        <p className="text-title2 tabular-nums text-foreground">{profile?.points_balance ?? 0}</p>
        <p className="mt-2 text-footnote text-fg-secondary">
          Your rewards card arrives in the next update — keep earning!
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/profile">View profile &amp; QR code</Link>
        </Button>
      </div>
    </main>
  );
}
