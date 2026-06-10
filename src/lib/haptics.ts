/**
 * Haptic feedback (DESIGN_SYSTEM.md §8). Guarded — `navigator.vibrate` is
 * unsupported on iOS Safari and degrades silently. Never assume support.
 */
function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw if called outside a user gesture — ignore.
    }
  }
}

export const haptic = {
  /** Stamp fill, button confirm. */
  light: () => vibrate(10),
  /** Milestone tick. */
  medium: () => vibrate([10, 50, 10]),
  /** Reward unlock. */
  success: () => vibrate([10, 50, 10, 50, 10]),
};
