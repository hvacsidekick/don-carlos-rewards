import { cn } from "@/lib/utils";

/**
 * Taco stamp glyph (DESIGN_SYSTEM.md §6). Two states:
 *  - filled: solid --dc-red taco (earned stamp)
 *  - outline: 1.5px stroke at --text-tertiary (empty stamp)
 *
 * The full StampGrid animation is built in Phase 4; this is the shared glyph.
 */
export function TacoGlyph({
  filled = false,
  size = 40,
  className,
}: {
  filled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn(filled ? "text-dc-red" : "text-fg-tertiary", className)}
    >
      {/* Shell */}
      <path
        d="M3 16a9 9 0 0 1 18 0H3Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Fillings rim */}
      <path
        d="M3 16h18"
        stroke={filled ? "rgb(var(--dc-yellow))" : "currentColor"}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
