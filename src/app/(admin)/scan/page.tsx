import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { ScanFlow } from "@/components/qr/ScanFlow";

export const metadata: Metadata = { title: "Scan & Add Points" };

/** Fallback rate if the singleton config row is somehow unavailable ($1 = 1pt). */
const FALLBACK_POINTS_PER_DOLLAR = 1;

/**
 * `(admin)/scan` (PLAN.md §Phase 5) — staff scan-to-add. Server Component: the
 * `(admin)` layout has already enforced `is_admin`; here we read the canonical
 * `points_per_dollar` rate from `rewards_config` (never hard-coded — PLAN §8) and
 * hand it to the `ScanFlow` client island. Points are NEVER computed or written
 * on the client as the source of truth — `addPointsAction` re-derives and
 * re-checks admin server-side.
 */
export default async function ScanPage() {
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("rewards_config")
    .select("points_per_dollar")
    .eq("id", 1)
    .single();

  const pointsPerDollar = config?.points_per_dollar ?? FALLBACK_POINTS_PER_DOLLAR;

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title3 text-foreground">Scan &amp; add points</h1>
        <p className="text-footnote text-fg-secondary">
          Scan a customer&apos;s code, then enter their purchase amount.
        </p>
      </header>

      <ScanFlow pointsPerDollar={pointsPerDollar} />
    </main>
  );
}
