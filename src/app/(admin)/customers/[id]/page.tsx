import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  getCustomerDetail,
  getCustomerTransactionsPage,
} from "@/lib/customers.server";
import { formatPoints, formatRelativeDay } from "@/lib/format";
import { AdminCustomerActions } from "@/components/admin/AdminCustomerActions";
import { CustomerHistory } from "@/components/admin/CustomerHistory";

export const metadata: Metadata = { title: "Customer" };

/** Fallback reward threshold if the singleton config row is unavailable. */
const FALLBACK_REDEEM_THRESHOLD = 100;

/**
 * `(admin)/customers/[id]` (PLAN.md §Phase 9) — customer detail. Server
 * Component: the `(admin)` layout enforced `is_admin`, and every data helper
 * re-checks it. Composes the profile + balance, the staff mutations (Manual
 * Adjust / Redeem on behalf — client island), and the customer's transaction
 * history (reusing Phase 6). A missing/non-existent id renders `notFound()`.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await getCustomerDetail(id);
  if (!customer) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: config }, history] = await Promise.all([
    supabase.from("rewards_config").select("redeem_threshold").eq("id", 1).single(),
    getCustomerTransactionsPage({ userId: id, cursor: null }),
  ]);

  const redeemThreshold = config?.redeem_threshold ?? FALLBACK_REDEEM_THRESHOLD;
  const customerName = customer.displayName ?? "Unnamed customer";

  return (
    <main className="flex w-full flex-col gap-5 py-4">
      <Link
        href="/customers"
        className="inline-flex min-h-11 w-fit items-center gap-1 -ml-1 pr-2 text-footnote text-dc-red-text transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        All customers
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-title3 text-foreground">{customerName}</h1>
        <p className="text-footnote text-fg-secondary">{customer.email}</p>
        <p className="text-caption text-fg-tertiary">
          Member since {formatRelativeDay(customer.createdAt)} · Lifetime{" "}
          {formatPoints(customer.totalPointsEarned)} earned ·{" "}
          {formatPoints(customer.totalRedemptions)}{" "}
          {customer.totalRedemptions === 1 ? "redemption" : "redemptions"}
        </p>
      </header>

      <AdminCustomerActions
        userId={customer.id}
        customerName={customerName}
        balance={customer.pointsBalance}
        redeemThreshold={redeemThreshold}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-headline text-foreground">Transaction history</h2>
        <CustomerHistory
          userId={customer.id}
          initialItems={history.items}
          initialCursor={history.nextCursor}
        />
      </section>
    </main>
  );
}
