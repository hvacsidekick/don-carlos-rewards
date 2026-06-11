import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { getTransactionsPage } from "@/lib/transactions.server";
import { TransactionList } from "@/components/transactions/TransactionList";

export const metadata: Metadata = { title: "Activity" };

/**
 * Transaction history (PLAN.md §Phase 6) — the full, paginated ledger reached
 * from the dashboard's "See all". Server Component: fetches the first "All" page
 * (RLS- + user-scoped, keyset-paginated) and hands it to the `TransactionList`
 * island, which owns the filter and "Load more". The `(user)` layout already
 * guarantees a session, so an empty result here means a genuinely empty ledger.
 */
export default async function TransactionsPage() {
  const { items, nextCursor } = await getTransactionsPage({ filter: "all", cursor: null });

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1 rounded-md text-footnote text-dc-red-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Dashboard
        </Link>
        <h1 className="text-title2 text-foreground">Activity</h1>
      </header>

      <TransactionList initialItems={items} initialCursor={nextCursor} />
    </main>
  );
}
