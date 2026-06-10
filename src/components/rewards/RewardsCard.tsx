"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { ProgressRing } from "@/components/rewards/ProgressRing";
import { StampGrid } from "@/components/rewards/StampGrid";
import { Celebration } from "@/components/rewards/Celebration";
import { RedeemDialog } from "@/components/rewards/RedeemDialog";
import { Mascot } from "@/components/common/Mascot";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { progressToNextReward, type RewardsConfig } from "@/lib/rewards";
import { formatCurrency, formatPoints } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { Tables } from "@/lib/database.types";
import { cn } from "@/lib/utils";

/**
 * RewardsCard — the signature dashboard hero (DESIGN_SYSTEM.md §5.1,
 * PHASE_4_TASK §4.4). `"use client"` island seeded by the server-fetched
 * profile + config.
 *
 * Owns: the live `profiles` realtime subscription, the balance count-up, the
 * stamp-fill + ring-advance animations and their haptics, and the celebration
 * on an upward threshold crossing (fired EXACTLY ONCE per crossing). The redeem
 * flow is delegated to `RedeemDialog`; on success this card reconciles to the
 * authoritative new balance returned by the RPC.
 *
 * Points are never written here — redeem goes through `redeemPointsAction` →
 * the `redeem_points` RPC. The card only reflects state. All motion is gated by
 * `useReducedMotion()` (final state shown instantly; confetti → toast).
 */

const RING_SIZE = 260;

/** Animate an integer from its previous value to `target` (count-up, §7.2). */
function useCountUp(target: number, durationMs = 500): number {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reduce]);

  return display;
}

export function RewardsCard({
  initialProfile,
  config,
}: {
  initialProfile: Pick<Tables<"profiles">, "id" | "points_balance" | "total_redemptions">;
  config: RewardsConfig;
}) {
  const reduce = useReducedMotion();

  const [balance, setBalance] = React.useState(initialProfile.points_balance);
  const [animateIndex, setAnimateIndex] = React.useState<number | undefined>(undefined);
  const [showCelebration, setShowCelebration] = React.useState(false);

  // Track previous balance to drive deltas without re-firing.
  const prevBalanceRef = React.useRef(initialProfile.points_balance);
  // True once we've celebrated the current eligible state; reset when balance
  // drops back below threshold (after redeeming) so the next upward crossing
  // celebrates again. Seeded `true` when we mount already eligible so a refresh
  // never replays the burst.
  const celebratedRef = React.useRef(
    initialProfile.points_balance >= config.redeem_threshold,
  );

  const supabase = React.useState(() => createClient())[0];

  const progress = progressToNextReward(balance, config);
  const displayBalance = useCountUp(balance);
  const rewardValue = formatCurrency(config.redeem_value_cents);

  /** Apply a new balance, firing stamp/celebration feedback for an increase. */
  const applyBalance = React.useCallback(
    (next: number) => {
      const prev = prevBalanceRef.current;
      if (next === prev) return;

      const prevProgress = progressToNextReward(prev, config);
      const nextProgress = progressToNextReward(next, config);

      if (next > prev) {
        // A stamp newly filled → animate that stamp + light haptic.
        if (nextProgress.filled > prevProgress.filled) {
          setAnimateIndex(nextProgress.filled - 1);
          haptic.light();
        }
        // Upward crossing of the redeem threshold → celebrate exactly once.
        if (
          next >= config.redeem_threshold &&
          prev < config.redeem_threshold &&
          !celebratedRef.current
        ) {
          celebratedRef.current = true;
          if (reduce) {
            // Reduced motion: no confetti — a concise toast is the acknowledgement.
            toast.success(`${rewardValue} reward ready to redeem! 🎉`);
          } else {
            setShowCelebration(true);
          }
        }
      } else {
        // Balance dropped (redeem). Clear any stamp-fill highlight; re-arm the
        // celebration guard once we're below threshold again.
        setAnimateIndex(undefined);
        if (next < config.redeem_threshold) {
          celebratedRef.current = false;
        }
      }

      prevBalanceRef.current = next;
      setBalance(next);
    },
    [config, reduce, rewardValue],
  );

  // ── Realtime: subscribe to this user's profiles row (BLUEPRINT.md §6). ──
  React.useEffect(() => {
    const channel = supabase
      .channel(`profile:${initialProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${initialProfile.id}`,
        },
        (payload) => {
          const next = payload.new as { points_balance?: number } | null;
          if (next && typeof next.points_balance === "number") {
            applyBalance(next.points_balance);
          }
        },
      )
      .subscribe();

    return () => {
      // Clean up the channel on unmount — no leak (acceptance criterion).
      void supabase.removeChannel(channel);
    };
  }, [supabase, initialProfile.id, applyBalance]);

  const statusLine = progress.eligible
    ? "Reward ready! 🎉"
    : `${formatPoints(progress.toNext)} ${progress.toNext === 1 ? "point" : "points"} to your ${rewardValue} reward`;

  const isZero = balance === 0;

  return (
    <section
      aria-labelledby="rewards-card-title"
      className="rounded-3xl bg-surface-tertiary p-6 shadow-card-hero dark:shadow-card-hero-dark"
    >
      <h2 id="rewards-card-title" className="text-center text-headline text-fg-secondary">
        Don Carlos Rewards
      </h2>

      <div className="mt-6 grid place-items-center">
        <RewardPulse eligible={progress.eligible}>
          <ProgressRing
            progress={progress.percent}
            size={RING_SIZE}
            ariaLabel={`Reward progress: ${formatPoints(progress.within)} of ${formatPoints(config.redeem_threshold)} points`}
          >
            <StampGrid
              total={config.stamps_per_card}
              filled={progress.filled}
              animateIndex={animateIndex}
            />
          </ProgressRing>
        </RewardPulse>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        {/*
          The animating digits update every animation frame, so they are
          `aria-hidden` to keep a screen reader from announcing each
          intermediate count-up value. The settled balance is announced once
          per change via the visually-hidden polite live region below (M-1).
        */}
        <p className="text-title2 font-bold tabular-nums text-foreground" aria-hidden="true">
          {formatPoints(displayBalance)}
        </p>
        <span className="sr-only" aria-live="polite" role="status">
          {formatPoints(balance)} points
        </span>
        <p className="text-footnote text-fg-secondary" aria-hidden="true">
          points
        </p>

        {isZero ? (
          <div className="mt-3 flex flex-col items-center gap-2">
            <Mascot expression="welcome" size={64} />
            <p className="text-body text-fg-secondary">
              Earn your first taco — points appear here the moment staff scan your code.
            </p>
          </div>
        ) : (
          <p
            className={cn(
              "mt-2 text-body",
              progress.eligible ? "font-semibold text-dc-red-text" : "text-fg-secondary",
            )}
          >
            {statusLine}
          </p>
        )}
      </div>

      <div className="mt-6">
        <RedeemDialog
          eligible={progress.eligible}
          rewardValue={rewardValue}
          threshold={config.redeem_threshold}
          onRedeemed={applyBalance}
          trigger={
            <Button
              type="button"
              size="lg"
              disabled={!progress.eligible}
              className={cn(
                "w-full",
                // Eligible: subtle dc-yellow glow pulse (suppressed under reduced
                // motion by the global CSS rule in globals.css).
                progress.eligible && "animate-glow-pulse",
              )}
            >
              <Gift className="size-5" aria-hidden="true" />
              Redeem {rewardValue} Off
            </Button>
          }
        />
      </div>

      <AnimatePresence>
        {showCelebration && (
          <Celebration
            headline={`${rewardValue} reward unlocked!`}
            onDone={() => setShowCelebration(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Wraps the ring in a gentle scale pulse 1.0→1.06→1.0 while the reward is
 * eligible (the "ring flourish" cue). Skipped under reduced motion.
 */
function RewardPulse({
  eligible,
  children,
}: {
  eligible: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce || !eligible) return <>{children}</>;
  return (
    <motion.div
      animate={{ scale: [1, 1.06, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
