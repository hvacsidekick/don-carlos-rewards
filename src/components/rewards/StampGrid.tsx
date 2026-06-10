"use client";

import { motion, useReducedMotion } from "framer-motion";

import { TacoGlyph } from "@/components/common/TacoGlyph";
import { springBouncy } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * StampGrid (DESIGN_SYSTEM.md §5.2, §7.2).
 *
 * Taco-stamp grid. Filled stamps are solid `--dc-red`; empty stamps are the
 * outline glyph at `--text-tertiary`. The grid auto-arranges to the configured
 * `stamps_per_card` (10 → 5×2). Only a *newly filled* stamp animates (scale
 * 0→1.2→1.0 `springBouncy`); the light haptic for that fill is fired by the
 * parent (RewardsCard) so it stays a single source of feedback per change.
 *
 * a11y: the grid carries a meaningful label ("7 of 10 stamps earned"); the
 * individual glyphs are decorative (`aria-hidden` inside TacoGlyph).
 */

/** Choose a column count that lays the stamps out in a tidy rectangle. */
function columnsFor(total: number): number {
  if (total <= 0) return 1;
  if (total % 5 === 0) return 5; // 10 → 5×2, 15 → 5×3
  if (total % 4 === 0) return 4;
  if (total % 3 === 0) return 3;
  // Fall back to the nearest square-ish row width.
  return Math.ceil(Math.sqrt(total));
}

export function StampGrid({
  total,
  filled,
  animateIndex,
  stampSize = 36,
  className,
}: {
  total: number;
  filled: number;
  /** Index of the stamp that just filled — only this one plays the fill spring. */
  animateIndex?: number;
  stampSize?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const safeFilled = Math.max(0, Math.min(total, filled));
  const cols = columnsFor(total);

  return (
    <div
      role="img"
      aria-label={`${safeFilled} of ${total} stamps earned`}
      className={cn("grid", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 8,
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isFilled = i < safeFilled;
        const isNewlyFilled = !reduce && animateIndex === i && isFilled;

        return (
          <motion.div
            key={i}
            className="grid place-items-center"
            initial={isNewlyFilled ? { scale: 0 } : false}
            animate={isNewlyFilled ? { scale: [0, 1.2, 1] } : { scale: 1 }}
            transition={isNewlyFilled ? springBouncy : { duration: 0 }}
          >
            <TacoGlyph filled={isFilled} size={stampSize} />
          </motion.div>
        );
      })}
    </div>
  );
}
