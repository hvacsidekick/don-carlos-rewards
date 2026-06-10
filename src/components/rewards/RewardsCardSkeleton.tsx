import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the RewardsCard (DESIGN_SYSTEM.md §5.1 "loading:
 * skeleton ring + skeleton stamps"). Matches the real card's footprint so there
 * is no layout shift when data arrives.
 */
export function RewardsCardSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="rounded-3xl bg-surface-tertiary p-6 shadow-card-hero dark:shadow-card-hero-dark"
    >
      <Skeleton className="mx-auto h-5 w-40" />

      <div className="mt-6 grid place-items-center">
        {/* Ring + stamp area. */}
        <div className="relative grid size-[260px] place-items-center rounded-full">
          <Skeleton className="absolute inset-0 rounded-full" />
          <div className="z-10 grid grid-cols-5 gap-2.5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="size-9 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-1 h-5 w-56" />
      </div>

      <Skeleton className="mt-6 h-12 w-full rounded-xl" />
    </section>
  );
}
