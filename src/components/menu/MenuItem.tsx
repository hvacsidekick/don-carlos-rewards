import Image from "next/image";

import type { MenuItemRow } from "@/lib/menu";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * MenuItem card (DESIGN_SYSTEM §5.7). Browse-only — no cart/ordering (Phase 7
 * out-of-scope). 16:9 photo, name + right-aligned tabular price, 2-line
 * description, optional dietary-tag pills.
 *
 * CLS: the image lives in a fixed `aspect-[16/9]` box so its height is reserved
 * before load — no layout shift when the photo (or the placeholder) paints.
 *
 * Missing image: `image_url` is null for every seeded item (no real photography
 * yet — open question O-3), so the branded placeholder is the expected render.
 * It is decorative (`aria-hidden`); the item name carries the meaning. When a
 * real photo IS present, `next/image` optimizes it with a blur-up placeholder
 * and the alt text is the item name (DESIGN_SYSTEM §9 a11y).
 */

/** Human-friendly labels for the seed's dietary tags. Unknown tags pass through. */
const DIETARY_LABELS: Record<string, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gf: "Gluten-free",
  "gluten-free": "Gluten-free",
  spicy: "Spicy",
};

function dietaryLabel(tag: string): string {
  return DIETARY_LABELS[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

/** Tiny neutral blur data URL — a soft warm tint while a real photo decodes. */
const BLUR_DATA_URL =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#e9e3d8"/></svg>',
  ).toString("base64");

function BrandedPlaceholder() {
  // Decorative branded fallback (DESIGN_SYSTEM §5.7) — a warm pattern with the
  // taco glyph, never a broken-image icon. Hidden from assistive tech.
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center bg-dc-yellow/15 text-dc-red/40"
    >
      {/* Subtle diagonal pattern keeps empty cards from looking broken. */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 12px)",
        }}
      />
      <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth={1.5}>
        {/* Simple taco silhouette (matches TacoGlyph aesthetic). */}
        <path
          d="M2 17a10 10 0 0 1 20 0 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z"
          fill="currentColor"
          fillOpacity={0.18}
        />
        <path d="M2 17a10 10 0 0 1 20 0" strokeLinecap="round" />
        <path d="M7 14.5c.8-.6 2-.6 2.8 0M11 13.8c.9-.5 2.1-.5 3 0M15 14.6c.8-.6 2-.6 2.8 0" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function MenuItem({ item }: { item: MenuItemRow }) {
  const hasImage = Boolean(item.image_url);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark",
        "transition-transform duration-150 motion-safe:[@media(hover:hover)]:group-hover:scale-[1.02] motion-safe:[@media(hover:hover)]:hover:shadow-card-hero",
        "active:opacity-90 [@media(hover:hover)]:active:opacity-100",
      )}
    >
      {/* Fixed 16:9 box reserves height → no CLS on image load. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-secondary">
        {hasImage ? (
          <Image
            src={item.image_url as string}
            alt={item.name}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        ) : (
          <BrandedPlaceholder />
        )}
      </div>

      <div className="flex flex-col gap-1 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-body-emph text-foreground">{item.name}</h3>
          <span className="shrink-0 text-body-emph tabular-nums text-foreground">
            {formatCurrency(item.price_cents)}
          </span>
        </div>

        {item.description ? (
          <p className="line-clamp-2 text-footnote text-fg-secondary">{item.description}</p>
        ) : null}

        {item.dietary_tags.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {item.dietary_tags.map((tag) => (
              <li key={tag}>
                <Badge variant="fresh">{dietaryLabel(tag)}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
