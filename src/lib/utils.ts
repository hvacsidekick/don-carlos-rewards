import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge configured for the project's custom design tokens.
 *
 * The Apple HIG type ramp (`text-caption`, `text-body-emph`, …) defines custom
 * `fontSize` keys in `tailwind.config.ts`. Stock tailwind-merge does not know
 * these are font sizes, so it mis-classifies them as text *colors*; when a
 * component combines a type token with a color via `cn`/`cva`
 * (e.g. `text-body-emph` + `text-white`), twMerge thinks they conflict and
 * silently drops one. Registering the keys in the `font-size` class group keeps
 * size and color independent. The brand/semantic text colors are listed in
 * `text-color` so they resolve explicitly rather than via the fallback matcher.
 *
 * See PHASE_1_FIXER_REPORT.md (C-1) and DESIGN_SYSTEM.md §3.2.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "caption",
            "footnote",
            "body",
            "body-emph",
            "headline",
            "title2",
            "title3",
            "large-title",
          ],
        },
      ],
      "text-color": [
        {
          text: [
            "dc-red",
            "dc-red-text",
            "dc-yellow",
            "dc-green",
            "dc-green-text",
            "success",
            "success-text",
            "warning",
            "warning-text",
            "error",
            "error-text",
            "fg-secondary",
            "fg-tertiary",
          ],
        },
      ],
    },
  },
});

/**
 * Merge class names with Tailwind-aware conflict resolution.
 * Standard shadcn/ui helper used by every UI component.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
