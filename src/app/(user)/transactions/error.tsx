"use client";

import { useEffect } from "react";

import { Mascot } from "@/components/common/Mascot";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the transaction-history route (PLAN.md §Phase 6 — "error
 * states present and styled"). Reached when the first-page server fetch throws
 * (e.g. a DB query failure surfaced by `getTransactionsPage`). Offers a retry;
 * the friendly copy never leaks the raw error. Tokenized → correct in both modes.
 */
export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for observability without exposing details to the user.
    console.error("Transactions route error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <Mascot expression="error" size={64} />
      <div className="flex flex-col gap-1">
        <h1 className="text-headline text-foreground">We couldn&rsquo;t load your activity</h1>
        <p className="text-footnote text-fg-secondary">
          Something went wrong fetching your transactions. Please try again.
        </p>
      </div>
      <Button variant="secondary" size="lg" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
