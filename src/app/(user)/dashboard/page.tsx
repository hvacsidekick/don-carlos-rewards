import Link from "next/link";
import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import { getServerAuth } from "@/lib/auth/get-server-auth";
import { createClient } from "@/lib/supabase/server";
import { RewardsCard } from "@/components/rewards/RewardsCard";
import { RecentActivity } from "@/components/rewards/RecentActivity";
import { Mascot } from "@/components/common/Mascot";
import { Button } from "@/components/ui/button";
import { progressToNextReward, type RewardsConfig } from "@/lib/rewards";
import { formatCurrency, formatPoints } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

/** Sensible defaults if the singleton config row is somehow unavailable. */
const FALLBACK_CONFIG: RewardsConfig = {
  id: 1,
  points_per_dollar: 1,
  redeem_threshold: 100,
  redeem_value_cents: 1000,
  stamps_per_card: 10,
  updated_at: new Date(0).toISOString(),
};

/**
 * Dashboard — the rewards home (PLAN.md §Phase 4). Server Component: fetches the
 * user's profile (balance), the `rewards_config` business rules, and a last-3
 * transactions peek, then hands the live numbers to the `RewardsCard` client
 * island (which owns animation + the realtime subscription).
 */
export default async function DashboardPage() {
  const { user, profile } = await getServerAuth();

  // The `(user)` layout already guarantees a session; this satisfies the type
  // narrowing without a non-null assertion.
  if (!user) {
    return null;
  }

  const supabase = await createClient();

  const [{ data: configRow }, { data: recent }] = await Promise.all([
    supabase.from("rewards_config").select("*").eq("id", 1).single(),
    supabase
      .from("transactions")
      .select("id, transaction_type, points_delta, points_balance_after, created_at, notes")
      // Always scope to the signed-in user. RLS already restricts non-admins,
      // but an admin's "read all" policy would otherwise surface the GLOBAL
      // transaction feed on their own dashboard (m-4). Defense-in-depth.
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const config: RewardsConfig = configRow ?? FALLBACK_CONFIG;
  const balance = profile?.points_balance ?? 0;
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";
  const progress = progressToNextReward(balance, config);
  const isZero = balance === 0;

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-body text-fg-secondary">Welcome back,</p>
        <h1 className="text-title2 text-foreground">{firstName} 🌮</h1>
      </header>

      {isZero ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot expression="welcome" size={88} />
          <p className="text-headline text-foreground">Earn your first taco!</p>
          <p className="max-w-[320px] text-footnote text-fg-secondary">
            Show your QR code at checkout to start collecting points toward a{" "}
            {formatCurrency(config.redeem_value_cents)} reward.
          </p>
        </div>
      ) : (
        <p className="text-center text-body text-fg-secondary">
          {progress.eligible ? (
            <>You have a {formatCurrency(config.redeem_value_cents)} reward ready 🎉</>
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {formatPoints(progress.toNext)}
              </span>{" "}
              to your next reward
            </>
          )}
        </p>
      )}

      <RewardsCard
        initialProfile={{
          id: user.id,
          points_balance: balance,
          total_redemptions: profile?.total_redemptions ?? 0,
        }}
        config={config}
      />

      <RecentActivity items={recent ?? []} />

      <Button asChild variant="secondary" size="lg" className="w-full">
        <Link href="/qr">
          <QrCode className="size-5" aria-hidden="true" />
          Show your QR code
        </Link>
      </Button>
    </main>
  );
}
