"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * CategoryNav (DESIGN_SYSTEM §5.8). Sticky chip row under the page header.
 * Tapping a chip smooth-scrolls to that category's section; the active chip
 * (`--dc-red` text) tracks the section currently in view via Intersection
 * Observer (scroll-spy).
 *
 * A11y: a labelled `<nav>` of real anchor links — keyboard-operable for free,
 * each ≥44pt. The active link carries `aria-current="location"`. The active
 * chip is auto-scrolled into view within the horizontal rail so it never hides
 * off-screen on a narrow phone.
 *
 * Motion: smooth scroll only when the user has NOT requested reduced motion
 * (the global CSS guard also forces `scroll-behavior: auto`, so we mirror that
 * in JS to keep the two consistent).
 */
export type NavCategory = { id: string; slug: string; name: string };

function sectionId(slug: string): string {
  return `category-${slug}`;
}

export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [activeSlug, setActiveSlug] = useState<string>(categories[0]?.slug ?? "");
  const railRef = useRef<HTMLUListElement>(null);
  const chipRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Scroll-spy: mark the section nearest the top of the viewport as active.
  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(sectionId(c.slug)))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Choose the top-most intersecting section so the active chip matches
        // what the user is reading as they scroll down.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        const top = visible[0]?.target.id;
        if (top) {
          const match = categories.find((c) => sectionId(c.slug) === top);
          if (match) setActiveSlug(match.slug);
        }
      },
      {
        // Activate when a section reaches the band just below the sticky nav.
        rootMargin: "-96px 0px -55% 0px",
        threshold: 0,
      },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categories]);

  // Keep the active chip in view within the horizontal rail. We adjust ONLY the
  // rail's `scrollLeft` (never `scrollIntoView`, which would also scroll the page
  // vertically and fight the section smooth-scroll).
  useEffect(() => {
    const rail = railRef.current;
    const chip = chipRefs.current.get(activeSlug);
    if (!rail || !chip) return;

    const railRect = rail.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    // Center the chip within the rail's visible width.
    const target =
      rail.scrollLeft + (chipRect.left - railRect.left) - (railRect.width - chipRect.width) / 2;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    rail.scrollTo({ left: target, behavior: prefersReduced ? "auto" : "smooth" });
  }, [activeSlug]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
      const target = document.getElementById(sectionId(slug));
      if (!target) return; // let the default hash jump handle it

      event.preventDefault();
      setActiveSlug(slug);

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      target.scrollIntoView({
        behavior: prefersReduced ? "auto" : "smooth",
        block: "start",
      });
      // Update the URL hash without a second jump (so it's shareable/back-able).
      history.replaceState(null, "", `#${sectionId(slug)}`);
    },
    [],
  );

  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-0 z-30 -mx-4 border-b border-separator bg-background/85 px-4 backdrop-blur-xl"
    >
      <ul
        ref={railRef}
        className="flex gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => {
          const active = category.slug === activeSlug;
          return (
            <li key={category.id} className="shrink-0">
              <a
                ref={(el) => {
                  if (el) chipRefs.current.set(category.slug, el);
                  else chipRefs.current.delete(category.slug);
                }}
                href={`#${sectionId(category.slug)}`}
                aria-current={active ? "location" : undefined}
                onClick={(e) => handleClick(e, category.slug)}
                className={cn(
                  "flex min-h-11 items-center rounded-full px-4 text-footnote font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-dc-red-fill text-white"
                    : "bg-fill-quaternary text-fg-secondary hover:text-foreground",
                )}
              >
                {category.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
