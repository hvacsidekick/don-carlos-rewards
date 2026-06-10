import type { Transition } from "framer-motion";

/**
 * Spring presets (DESIGN_SYSTEM.md §7.1, BLUEPRINT.md §9).
 * All motion must be gated by `useReducedMotion()` in component code.
 */
export const springGentle: Transition = { type: "spring", damping: 20, stiffness: 300 }; // most UI
export const springStiffer: Transition = { type: "spring", damping: 15, stiffness: 400 }; // snappy
export const springBouncy: Transition = { type: "spring", damping: 10, stiffness: 300 }; // stamps, fun

/** Page-enter transition: opacity 0→1, y 20→0, ~300ms easeOut (DESIGN_SYSTEM §7.2). */
export const pageEnter = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: "easeOut" } as Transition,
};

/** Button press feedback: scale 0.97 (DESIGN_SYSTEM §7.2). */
export const buttonPress = { scale: 0.97 };

/** Reduced-motion-safe variant: instant, opacity-only. */
export const reducedMotionTransition: Transition = { duration: 0 };
