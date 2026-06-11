import type { Metadata } from "next";

import { getCustomersPage } from "@/lib/customers.server";
import { CustomerList } from "@/components/admin/CustomerList";

export const metadata: Metadata = { title: "Customers" };

/**
 * `(admin)/customers` (PLAN.md §Phase 9) — the searchable, paginated customer
 * directory. Server Component: the `(admin)` layout has already enforced
 * `is_admin`, and `getCustomersPage` re-checks it again before reading the
 * all-customers list (admin read-all RLS). The first page is fetched here and
 * handed to the `CustomerList` island, which owns search + "load more".
 */
export default async function CustomersPage() {
  const firstPage = await getCustomersPage({ cursor: null });

  return (
    <main className="flex w-full flex-col gap-5 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title3 text-foreground">Customers</h1>
        <p className="text-footnote text-fg-secondary">
          Search by name or email. Tap a customer to view history and adjust points.
        </p>
      </header>

      <CustomerList initialItems={firstPage.items} initialCursor={firstPage.nextCursor} />
    </main>
  );
}
