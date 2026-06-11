# Phase 8 — Location & About — BUILD COMPLETE

Branch: `phase/8-about` (isolated worktree). Depends only on Phase 1 (✅ Verified). No auth/db touched.

## Files created
| File | Purpose |
|------|---------|
| `src/lib/location.ts` | Single source of truth for address, geo, contact, hours; **timezone-correct (America/Denver) open/closed logic**; keyless map-embed + directions URL builders. Pure, fully testable. |
| `src/components/about/OpenStatusBadge.tsx` | Client island rendering the live "Open now / Closed" pill; recomputes each minute; hydration-safe; state never by color alone (dot + text label). |
| `src/app/about/page.tsx` | The `/about` page (Server Component). Map iframe + text-alternative address + hours `<dl>` + tap-to-call + Get Directions + mascot blurb. |

No existing files were modified. (The `BottomTabBar` already routes the global app shell; `/about` is a public route reached from the menu link / footer-style links — no nav wiring required, matching BLUEPRINT placement of `about/page.tsx` in the public group.)

## Per-acceptance-criterion evidence (quoted from PLAN.md Phase 8)

> **[ ] Map shows the correct pin; directions link opens native maps with the destination.**
- Map iframe `src = https://www.google.com/maps?q=7475%20W%2052nd%20Ave%2C%20Arvada%2C%20CO%2080002&output=embed`. Verified in-browser (Playwright): Google Maps rendered with the pin at `39.7911956,-105.0795765` (the Arvada address) — confirmed via the embed's own "Report a map error" coordinate link.
- Directions link: `https://www.google.com/maps/dir/?api=1&destination=7475%20W%2052nd%20Ave%2C%20Arvada%2C%20CO%2080002` (`api=1` universal URL → hands off to native maps on iOS/Android, Google Maps on desktop). Opens in a new tab (`target="_blank" rel="noopener noreferrer"`).

> **[ ] Hours display correctly; "Open now/Closed" reflects current Denver time and Sunday-closed.**
- Hours block: "Monday – Saturday · 7:00 AM – 8:00 PM" and "Sunday · Closed" rendered as a `<dl>`.
- Live pill computed from Denver wall-clock (see logic + tests below). Verified "Open now" in-browser at a weekday afternoon.

> **[ ] Phone is tap-to-call on mobile.**
- `<a href="tel:+13034216663">` — a real link, keyboard-operable, ≥44pt (`min-h-11`), with visible "Tap to call" affordance. Verified `href` in-browser.

> **[ ] Dark mode + a11y; map has an accessible text alternative (address).**
- Dark + light both verified via Playwright screenshots (emulated `prefers-color-scheme`). Map iframe framed on `bg-card` (`--bg-tertiary`), **not** color-inverted in dark.
- iframe has `title="Map showing Don Carlos Mexican Restaurant at 7475 W 52nd Ave, Arvada, CO 80002"`.
- Text alternative: a semantic `<address>` with the full selectable address renders independently of the map, so the location is available without the iframe.
- Heading hierarchy: H1 "Visit us" → H2 Map (sr-only) / Hours / Contact / "A little about us". Sections use `aria-labelledby` / `region`. The status pill is a `role="status"` live region.

## Open-now / Closed Denver-time logic (the tricky correctness point)

**Approach — never trust the device timezone.** I project the current instant onto Denver wall-clock fields using `Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })` and read the parts back. This applies the zone's actual offset rules **for that specific date**, so it is correct across DST (MST = UTC−7 in winter, MDT = UTC−6 in summer) and independent of the visitor's device zone or the server's `TZ`. `weekday: 'short'` yields a locale-stable English token ("Mon"…) which I map to `0–6`.

```ts
export function getDenverNow(now = new Date()): DenverNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  // …read weekday/hour/minute; normalize hour 24 → 0…
}

export function getOpenStatusFromDenver({ weekday, hour, minute }) {
  const today = WEEKLY_HOURS[weekday];        // Sun = null (closed)
  if (!today) return { open: false, reason: "closed-today" };
  const n = hour*60 + minute, o = today.open*60, c = today.close*60;  // 7*60 .. 20*60
  if (n < o) return { open: false, reason: "before-open" };
  if (n >= c) return { open: false, reason: "after-close" };          // [open, close): 8:00pm = closed
  return { open: true };
}
```

**How I tested it.** A standalone Node script mirrored the pure logic and asserted 10 `(instant → Denver fields → status)` cases, including both DST regimes and both boundaries. All 10 passed; re-ran with `TZ=Asia/Tokyo` and `TZ=UTC` — still 10/10, proving host-TZ independence. Cases asserted:

| Instant (UTC) | Denver | Expected |
|---|---|---|
| Mon 2026-01-12 14:30 | Mon 07:30 MST | open |
| Mon 2026-01-12 13:59 | Mon 06:59 MST | before-open |
| Mon 2026-01-12 14:00 | Mon 07:00 MST | open (open boundary inclusive) |
| Sat 2026-01-17 03:00 | Fri 20:00 MST | after-close (close boundary exclusive) |
| Sat 2026-01-17 02:59 | Fri 19:59 MST | open |
| Sun 2026-01-18 19:00 | Sun 12:00 MST | closed-today |
| Wed 2026-07-15 13:30 | Wed 07:30 **MDT** | open (DST offset applied) |
| Wed 2026-07-15 12:59 | Wed 06:59 **MDT** | before-open (DST offset applied) |
| Thu 2026-07-16 02:00 | Wed 20:00 MDT | after-close |
| Sat 2026-01-17 01:00 | Fri 18:00 MST | open (device-independent) |

The test script was a throwaway and is not committed (no test runner exists in the project; adding one is out of scope). The committed `lib/location.ts` is the exact same logic.

## Map-embed approach + key exposure

- **Keyless Google Maps Embed iframe**: `https://www.google.com/maps?q=<address>&output=embed`. This renders a pinned, interactive map **without any API key** — confirmed in-browser the iframe `src` contains **no `key=` parameter** (`/key=/.test(src) === false`). No unrestricted JS API key is shipped to the client (PLAN.md §8 "prefer the keyless Embed iframe"; BLUEPRINT O-5).
- An optional `NEXT_PUBLIC_MAPS_EMBED` env (already in the Phase 1 Zod schema, optional) lets a deployer supply a referrer-restricted Embed URL later; `getMapEmbedSrc(override)` prefers it when set, else falls back to keyless. It is unset in `.env.local`, so the keyless form is used.

## Deviations
- None from scope. The mascot uses the existing `welcome` placeholder expression (open question O-2, brand asset pending) via the stable `Mascot` API.
- The page is `ƒ (Dynamic)` in the route table because it reads validated `clientEnv` at module scope (same pattern as the rest of the app). No functional impact.

## Gate output (run in worktree, `.next` cleaned)

**`npx tsc --noEmit`** → exit **0** (clean, after adding all three files).

**`npm run build`** → exit **0**, twice (2/2 clean runs). Route table includes `/about` (1.4 kB, 114 kB First Load JS):
```
├ ƒ /about                                1.4 kB         114 kB
✓ Compiled successfully in ~12s
✓ Generating static pages (17/17)
```
Note: the build prints `⨯ ESLint: Plugin "@next/next" was conflicted…` — this is the **documented nested-worktree environmental collision** (the worktree lives under the parent repo, so ESLint's config cascade finds the parent's identical `.eslintrc.json` + a second `@next/next` plugin install). It is a **warning that does not fail the build** (exit 0, all 17 pages generated).

**`npm run lint`** → exit 1 **solely** due to that same `@next/next` plugin-conflict cascade (parent repo `.eslintrc.json` + parent `node_modules` picked up because the worktree is nested inside the parent tree). It is **not** a defect in this code. Proven clean by running ESLint against the new files with the ancestor cascade excluded:
```
npx eslint --no-eslintrc -c .eslintrc.json \
  src/app/about/page.tsx src/lib/location.ts src/components/about/OpenStatusBadge.tsx
→ exit 0 (zero warnings/errors)
```
When the orchestrator merges this branch into the main checkout (outside the nested-worktree collision), `npm run lint` runs clean.

## Unverifiable / notes for orchestrator
- `npm run lint` exit 1 is environmental (nested-worktree ESLint cascade), not a source defect — see proof above. Will pass post-merge.
- Tap-to-call and native-maps handoff are verified by link correctness; true on-device behavior (dialer / Apple Maps) is a real-phone check deferred to the Phase 11/12 device QA.
