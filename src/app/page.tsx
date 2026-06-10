import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/common/Mascot";

/**
 * Phase 1 landing placeholder. The real authenticated dashboard arrives in
 * Phase 4; auth routing in Phase 3. Kept calm and on-brand (90/10 rule).
 */
export default function Home() {
  return (
    <main className="min-h-screen-safe mx-auto flex max-w-[480px] flex-col items-center justify-center gap-8 px-4 text-center">
      <Mascot expression="welcome" size={120} />

      <div className="flex flex-col gap-3">
        <h1 className="text-large-title text-foreground">Don Carlos Rewards</h1>
        <p className="text-body text-fg-secondary">
          Earn a stamp with every visit. Fill your card, unlock a reward. 🌮
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/dashboard">Get started</Link>
        </Button>
        {process.env.NODE_ENV !== "production" && (
          <Button asChild variant="tertiary" size="lg" className="w-full">
            <Link href="/_sandbox">Design sandbox (dev)</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
