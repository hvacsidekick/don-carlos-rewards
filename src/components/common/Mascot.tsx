import { cn } from "@/lib/utils";

/**
 * Mascot — PLACEHOLDER (open question O-2: final chef-with-sombrero SVG + the
 * welcome/celebrate/empty/error expressions are pending brand asset delivery).
 *
 * This is a simple, swappable stand-in so empty/error/celebration states can be
 * built now (DESIGN_SYSTEM.md §1, §6). Replace the inner SVG when assets land;
 * the public API (`expression`, `size`, decorative `aria-hidden`) stays stable.
 */
export type MascotExpression = "welcome" | "celebrate" | "empty" | "error";

const EXPRESSION_EMOJI: Record<MascotExpression, string> = {
  welcome: "👋",
  celebrate: "🎉",
  empty: "🌮",
  error: "❓",
};

export function Mascot({
  expression = "welcome",
  size = 96,
  className,
  decorative = true,
  label,
}: {
  expression?: MascotExpression;
  size?: number;
  className?: string;
  /** When true, hidden from assistive tech (it's accompanying decoration). */
  decorative?: boolean;
  /** Accessible label when not decorative. */
  label?: string;
}) {
  return (
    <div
      className={cn("grid place-items-center rounded-full bg-dc-yellow/20 text-dc-red", className)}
      style={{ width: size, height: size }}
      aria-hidden={decorative || undefined}
      role={!decorative ? "img" : undefined}
      aria-label={!decorative ? (label ?? `Mascot: ${expression}`) : undefined}
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{EXPRESSION_EMOJI[expression]}</span>
    </div>
  );
}
