import { Skeleton } from "@/components/ui/skeleton";

/**
 * Menu loading state (PLAN.md §Phase 7 — "Skeletons"). Mirrors the real layout:
 * header, a sticky chip row, then two category sections of 16:9 cards. The card
 * skeletons reuse the same fixed 16:9 aspect box as `MenuItem` so there is no
 * layout shift when the data resolves (CLS < 0.1).
 */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-12" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

function SectionSkeleton({ cards }: { cards: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function MenuLoading() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16">
      <header className="flex flex-col gap-2 pt-10">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-32" />
      </header>

      <div className="mt-4 flex gap-2 overflow-hidden py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-10">
        <SectionSkeleton cards={4} />
        <SectionSkeleton cards={2} />
      </div>
    </main>
  );
}
