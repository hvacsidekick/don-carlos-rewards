"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * ProgressRing (DESIGN_SYSTEM.md §5.3, §7.2).
 *
 * Apple-Watch-style SVG ring. Track uses `--separator`; the progress arc uses
 * `--dc-red` with rounded line-caps, starts at 12 o'clock, and fills clockwise.
 * The `stroke-dashoffset` animates over 600ms easeInOut; under
 * `prefers-reduced-motion` it snaps to the final offset instantly.
 *
 * a11y: `role="progressbar"` with `aria-valuenow/min/max` and an `aria-label`.
 * The ring is purely a presentation wrapper — children (the stamp grid) render
 * inside it via absolute centering.
 */
export function ProgressRing({
  progress,
  size,
  strokeWidth = 8,
  className,
  ariaLabel,
  children,
}: {
  /** 0..100. Clamped defensively. */
  progress: number;
  /** Outer diameter in px. */
  size: number;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // dashoffset = remaining arc. At 0% the whole circle is offset (empty);
  // at 100% offset is 0 (full).
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Reward progress: ${Math.round(clamped)}%`}
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Rotate -90° so the arc starts at 12 o'clock and fills clockwise.
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--separator)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--dc-red))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeInOut" }}
        />
      </svg>
      {/* Content nested inside the ring (stamp grid). */}
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
