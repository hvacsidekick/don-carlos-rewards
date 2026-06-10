import { cn } from "@/lib/utils";

/**
 * Skeleton (DESIGN_SYSTEM.md §5.1 loading states). Animated pulse on a muted
 * surface; pulse is suppressed by the global reduced-motion rule.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} {...props} />;
}

export { Skeleton };
