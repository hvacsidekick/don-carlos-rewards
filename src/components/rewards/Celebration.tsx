"use client";

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Mascot } from "@/components/common/Mascot";
import { haptic } from "@/lib/haptics";
import { springGentle } from "@/lib/motion";

/**
 * Celebration (DESIGN_SYSTEM.md §5.4, §7.2).
 *
 * Fired exactly once per threshold crossing (the parent owns the "fire once"
 * guard). Renders a capped, hand-rolled confetti burst (no dependency — keeps
 * the perf budget), a mascot "celebrate" pop, and a headline. The success haptic
 * `[10,50,10,50,10]` plays on mount.
 *
 * Reduced-motion (PHASE_4_TASK §4.3, D4-1): the overlay renders NOTHING — no
 * confetti, no pop. The parent surfaces a concise success toast instead. We
 * still fire the success haptic and call `onDone` on the next tick so the
 * parent's "celebrate once" lifecycle completes cleanly. Animates only
 * transform/opacity (GPU).
 */

const CONFETTI_COUNT = 28; // capped per the perf budget (DESIGN_SYSTEM §7.4)
const CONFETTI_COLORS = ["rgb(var(--dc-red))", "rgb(var(--dc-yellow))", "rgb(var(--dc-green))"];

type Particle = {
  x: number; // horizontal start offset in %
  rotate: number;
  drift: number; // horizontal drift in px
  delay: number;
  duration: number;
  color: string;
  size: number;
};

export function Celebration({
  headline,
  onDone,
}: {
  /** e.g. "$10 reward unlocked!". */
  headline: string;
  /** Called when the celebration finishes so the parent can unmount it. */
  onDone: () => void;
}) {
  const reduce = useReducedMotion();

  // Deterministic-per-mount particle field (computed once).
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      x: Math.random() * 100,
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 160,
      delay: Math.random() * 0.15,
      duration: 1 + Math.random() * 0.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? CONFETTI_COLORS[0]!,
      size: 8 + Math.random() * 6,
    }));
  }, []);

  useEffect(() => {
    haptic.success();
    // Auto-dismiss: ~1.6s with confetti. Under reduced motion nothing renders,
    // so finish almost immediately (the parent shows a toast instead).
    const timer = window.setTimeout(onDone, reduce ? 50 : 1600);
    return () => window.clearTimeout(timer);
  }, [onDone, reduce]);

  // Reduced motion → render nothing; the success haptic above still fired and
  // onDone runs on the next tick.
  if (reduce) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[60] grid place-items-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Confetti burst (capped per the perf budget). */}
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
          }}
          initial={{ y: "-10vh", opacity: 0, rotate: p.rotate }}
          animate={{
            y: "110vh",
            x: p.drift,
            opacity: [0, 1, 1, 0],
            rotate: p.rotate + 360,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}

      {/* Mascot + headline card. */}
      <motion.div
        className="flex flex-col items-center gap-3 rounded-3xl bg-surface-tertiary px-8 py-7 text-center shadow-card-hero dark:shadow-card-hero-dark"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springGentle}
      >
        <Mascot expression="celebrate" size={88} />
        <p className="text-headline text-foreground">{headline}</p>
      </motion.div>
    </motion.div>
  );
}
