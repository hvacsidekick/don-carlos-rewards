# Phase 7 — Menu Browser · Build Complete

**Branch:** `phase/7-menu` (in isolated worktree)
**Builder:** Phase 7 Builder
**Date:** 2026-06-10
**Status:** Built, self-verified, gates green.

---

## Summary

A beautiful, photography-forward, **browse-only** menu at the public route **`/menu`**.
A Server Component fetches the seeded `menu_categories` + `menu_items` (public-read
RLS, no auth), groups them, and renders category sections of `MenuItem` cards with a
sticky `CategoryNav` chip row (scroll-spy + smooth-scroll). All seed `image_url`s are
`NULL`, so the **branded taco placeholder is the expected render everywhere** (real
photography = open question **O-3**).

---

## Files created / changed

### Created
- `src/lib/menu.ts` — typed menu data access. `getMenu(supabase)` runs the
  categories + items queries in parallel, orders both by `sort_order`, and groups
  items under their category (empty categories preserved for the EmptyState path).
- `src/components/menu/MenuItem.tsx` — the §5.7 card. 16:9 `next/image` (blur-up) OR
  branded placeholder, name (`body-emph`), right-aligned `tabular-nums` price via
  `format.ts`, 2-line clamped description, `dc-green` dietary pills (reuses the
  existing `Badge` `fresh` variant).
- `src/components/menu/CategoryNav.tsx` — sticky §5.8 chip row (client). Real anchor
  links (keyboard-operable, ≥44pt), `IntersectionObserver` scroll-spy, smooth
  section scroll that respects `prefers-reduced-motion`, active chip auto-centered in
  the rail (horizontal-only — never scrolls the page vertically).
- `src/app/menu/page.tsx` — public Server Component page. One `h1` "Menu", a `h2` per
  category, items as `h3` (inside `MenuItem`). Responsive grid (1/2/3 col). Per-category
  and whole-page EmptyState (mascot).
- `src/app/menu/loading.tsx` — skeleton matching the real layout (header, chip rail,
  two sections of 16:9 cards) using the same fixed aspect box → zero CLS during load.
- `PHASE_7_BUILD_COMPLETE.md` — this file.

### Changed
- `next.config.ts` — added `images.remotePatterns` for `*.supabase.co`
  `/storage/v1/object/public/**` so `next/image` can optimize menu photos when they
  exist. (No real photos in the seed yet — O-3.)
- `.eslintrc.json` — added `"root": true`. **Why:** the worktree is nested *inside*
  the main checkout, so ESLint's config cascade walked up and merged the parent's
  identical `.eslintrc.json`, double-registering the `@next/next` plugin and crashing
  `next lint` (exit 1). `root: true` stops the upward walk. Harmless when this dir is
  the real project root (as it is after merge). This is an **environmental** fix, not
  a code defect — the parent checkout lints clean (verified).

**Wiring:** `BottomTabBar.tsx` already linked the "Menu" tab to `/menu`; no change
needed. The root layout renders the tab bar globally, so signed-in users see it on
`/menu`; public visitors get the page without the bar. No new dependencies added —
`next/image` covers all image needs.

---

## Acceptance criteria — evidence (quoted from PLAN.md §Phase 7)

> **"All seeded categories + items render with correct prices/descriptions."**

✅ Runtime DOM check on `/menu`: **7** `h2` category headings and **28** `h3` item
cards — exactly the seed (7 categories, 28 items). Prices render via
`formatCurrency(price_cents)` (e.g. Carne Asada Taco → `$3.50`, never a hardcoded
`$`). Descriptions render with a 2-line `line-clamp`; the one item with an empty
description (Bottled Water) correctly renders no description block.

> **"Category navigation jumps/scrolls correctly; sticky header behaves."**

✅ Clicking the "Tortas" chip smooth-scrolls the page (`scrollY` 0 → 2234) and lands
the section top at 80px (below the sticky nav, via `scroll-mt-20`); the active chip
updates to "Tortas". The nav is `sticky top-0 z-30` with a translucent
`backdrop-blur` bar. Scroll-spy keeps the active chip in sync with the section in view.

> **"Images lazy-load, optimized, with placeholders; missing-image fallback works."**

✅ `next/image` with `fill` + `sizes` (responsive) + `placeholder="blur"` for real
photos. Every seeded item has `image_url = NULL`, so the **branded placeholder**
renders (verified: **0** `<img>` tags on the page, **28** branded placeholders) — a
warm `dc-yellow` tint + diagonal pattern + taco glyph, `aria-hidden`, never a broken
image.

> **"Responsive + dark mode + a11y (headings hierarchy, alt text on every food image)."**

✅ Grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (verified 2-col Tortas / 3-col
Sides at tablet width). Heading hierarchy: single `h1` "Menu" → `h2` per category →
`h3` per item. When a real photo is present, `alt={item.name}` (the food image's alt
is the item name). Dark + light both verified by screenshot. CategoryNav is real
anchor links — keyboard-operable, `aria-current="location"` on the active chip,
≥44pt (`min-h-11`).

> **"No layout shift on image load (CLS < 0.1 on this page)."**

✅ Measured **CLS = 0** (0 layout-shift entries) via `PerformanceObserver` on the live
page. See below.

---

## How CLS is prevented (< 0.1)

Every image (real photo *or* placeholder) lives in a **fixed `aspect-[16/9]` box**
(`relative aspect-[16/9] w-full`), so its height is reserved before anything paints —
the card never grows when the image decodes. The loading skeleton uses the **same**
aspect box, so the swap from skeleton → real content also doesn't shift. Confirmed:
`getComputedStyle(...).aspectRatio === "16 / 9"`, CLS = 0 at runtime.

## Missing-image fallback

`image_url` is `NULL` for all 28 seeded items (no real photography — **O-3**). When
null, `MenuItem` renders `<BrandedPlaceholder>`: a `dc-yellow/15` tint, a faint
diagonal repeating-linear-gradient, and a centered taco-silhouette SVG, all
`aria-hidden` (the `h3` name carries the meaning). No `next/image`, no broken-image
icon. When a real URL lands, the same slot renders an optimized blur-up `next/image`
with `alt={item.name}` — swapping in photos is trivial (just populate `image_url`).

---

## Deviations / open questions

- **Route placement:** built as a single **public** top-level route `src/app/menu/`
  (not under `(user)`). PLAN.md explicitly allows this ("a public `/menu` is
  acceptable since it's non-sensitive") and BLUEPRINT lists a public `menu/page.tsx`.
  This serves the bottom-tab link *and* public visitors from one route, avoiding a
  duplicate `(user)/menu` that would 404 for logged-out users.
- **O-3 (real food photography absent):** unverifiable by design — every seed item has
  `image_url = NULL`, so the branded-placeholder path is what renders. Flagged for
  asset delivery.
- **`.eslintrc.json` `root: true`:** environmental fix for the nested worktree (see
  above), not a Phase-7 code change in spirit. Safe post-merge.

---

## Build gates (real output)

All run in the worktree after `rm -rf .next`.

**`npx tsc --noEmit`** → exit **0** (clean, run twice).

**`npm run lint`** → exit **0**:
```
✔ No ESLint warnings or errors
```
(The benign "multiple lockfiles" workspace-root warning remains — it's the nested
worktree, not a lint error.)

**`npm run build`** → exit **0**, full route table, run **twice** (both clean):
```
 ✓ Compiled successfully in 12.6s
 ✓ Generating static pages (17/17)
Route (app)                                 Size  First Load JS
├ ƒ /dashboard                           44.7 kB         256 kB
├ ƒ /menu                                6.79 kB         116 kB
...
ƒ Middleware                              104 kB
```
`/menu` is `ƒ` (dynamic) — correct, it fetches live menu data per request.

**Runtime smoke (dev server + Playwright):** `/menu` → HTTP 200; 7 categories / 28
items; 0 `<img>` (placeholder path) / 28 branded placeholders; CLS 0; smooth-scroll +
scroll-spy verified; light + dark screenshots correct; 0 console errors.

---

## Dependencies added

**None.** `next/image` (already present) covers all image handling.
