import { RewardsCardSkeleton } from "@/components/rewards/RewardsCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard loading state (PLAN.md §Phase 4 — "Loading skeletons: ring +
 * stamps"). Rendered by Next.js while the Server Component fetches profile +
 * config + recent transactions.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-40" />
      </header>

      <Skeleton className="mx-auto h-5 w-48" />

      <RewardsCardSkeleton />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-[140px] w-full rounded-2xl" />
      </div>

      <Skeleton className="h-12 w-full rounded-xl" />
    </main>
  );
}
