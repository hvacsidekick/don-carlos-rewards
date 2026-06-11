import { Skeleton } from "@/components/ui/skeleton";

/**
 * Transaction history loading state (PLAN.md §Phase 6 — "loading skeletons
 * matching row layout"). Rendered by Next.js while the Server Component fetches
 * the first page: a back link + title, the filter pills, and two day groups of
 * rows sized to the real `TransactionRow` (icon + two text lines + amount).
 */
function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      <Skeleton className="h-4 w-12 shrink-0" />
    </li>
  );
}

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="ml-1 h-3 w-20" />
      <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
        {Array.from({ length: rows }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

export default function TransactionsLoading() {
  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-32" />
      </header>

      <Skeleton className="h-9 w-56 rounded-full" />

      <div className="flex flex-col gap-6">
        <GroupSkeleton rows={3} />
        <GroupSkeleton rows={2} />
      </div>
    </main>
  );
}
