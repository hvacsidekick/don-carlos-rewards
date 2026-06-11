# Phase 11 — PWA + Performance + Accessibility Polish — BUILD COMPLETE

> Builder handoff to the independent Auditor/Verifier. Branch `phase/11-pwa`, off
> `master` (Phases 0–10 verified). Code-complete + locally gate-green. This report
> is rigorous about what was proved *structurally + in a real Chromium browser via
> Playwright* vs. what still needs a real iOS/Android device, Lighthouse, and a
> screen-reader pass (the Verifier's device job).

---

## 0. Summary

| Area | Status |
|------|--------|
| PWA manifest (+ maskable icon) | ✅ built, served, browser-verified |
| Service worker (scoped, nonce/auth-safe) | ✅ built, registered & verified controlling in Chromium |
| iOS install metas | ✅ present in document head (verified) |
| Add-to-Home-Screen UX (Android + iOS) | ✅ built; `beforeinstallprompt` capture verified firing |
| Offline fallback | ✅ precached + served (200) |
| D4-2 glow-pulse → opacity fix | ✅ done; verified in built CSS (no box-shadow anim) |
| CSP live-browser console sweep (Phase-10 carry-forward) | ✅ done — 0 violations across 4 page types |
| Performance audit + route table | ✅ documented; 3 routes flagged over a strict budget |
| Accessibility | ✅ verified strong (built on already-audited Phases 1–10); new surfaces a11y-built |
| Gates: tsc / test / lint / build | ✅ 0 / 34 pass / clean / 0 |

---

## 1. PWA

### 1.1 Manifest — `src/app/manifest.ts` → `/manifest.webmanifest`

App Router typed manifest. Served (verified) at `/manifest.webmanifest` with
`Content-Type: application/manifest+json`, status 200. Highlights:

- `name` "Don Carlos Rewards", `short_name` "Don Carlos", description set.
- `display: "standalone"`, `start_url: "/dashboard"`, `scope: "/"`, `id: "/dashboard"`.
- `theme_color: "#E63946"` (brand `--dc-red`), `background_color: "#FFFFFF"` (cold-launch splash).
- `orientation: portrait`, `categories`, `lang`, `dir`.
- **Icons:** 192 + 512 `purpose:"any"` AND 192 + 512 `purpose:"maskable"` (full-bleed,
  taco mark inside the maskable safe-zone so Android adaptive masks never clip it).

All icon assets are committed PNGs under `public/icons/` (no build-time image step).
They are generated from brand SVG sources by `scripts/generate-pwa-icons.mjs` (uses
`sharp`, which ships transitively with Next.js — **no new dependency**). Icon art is
the **placeholder brand mark** (open question **O-2** — real chef/taco art pending);
swapping in real art = replace the two source SVGs and re-run the script.

### 1.2 Service worker — `public/sw.js` (+ `ServiceWorkerRegistrar.tsx`)

**Hand-written SW, chosen over Serwist/next-pwa deliberately:** the #1 risk is the
Phase-10 per-request CSP nonce + auth freshness. A hand-rolled SW gives full,
auditable control of exactly what is and isn't cached, with zero build-plugin
surface and zero new dependency. Strategy:

| Request kind | Strategy |
|--------------|----------|
| **Navigations** (`mode === "navigate"`, HTML docs) | **network-ONLY**; on network failure → precached `/offline` |
| `/_next/static/*` (content-hashed JS/CSS) | cache-first (immutable) |
| `/icons/*`, `/manifest.webmanifest` | cache-first |
| same-origin images | cache-first, FIFO-trimmed (cap 60) |
| **cross-origin (ALL Supabase REST/Auth/Realtime)** | **ignored — never `respondWith`** (straight to network) |
| everything else same-origin (RSC payloads, data) | passthrough — no `respondWith`, never cached |

**Why this protects the nonce + auth (the hard requirement), proved in-browser:**

1. The SW **never reads or writes any cache for navigations**, so the browser
   always renders a *fresh* document carrying a *fresh* per-request CSP nonce that
   matches its own inline bootstrap scripts. A stale-nonce'd cached page is
   structurally impossible. (Confirmed: two navigations returned two *different*
   CSP nonces, and no HTML doc ever entered any cache.)
2. The only cached navigable document is the static `/offline` shell — which has
   **no nonce'd inline script** and **no auth/data**, so it can never collide with
   the CSP or leak stale state. It is cached as a *whole response* (its body + its
   own CSP header travel together), so it stays internally consistent.
3. Supabase is **cross-origin** (`*.supabase.co`) → the `url.origin !== self.location.origin`
   guard returns early, so REST/Auth/Realtime (wss) bypass the SW entirely. No
   authed response is ever cached.

**Browser verification (Chromium via Playwright, against `next start`):**
- SW registered, `state: "activated"`, `scope: http://localhost:3210/`, **controlling** the page.
- Cache dump after navigating `/dashboard`, `/`, `/login`, `/profile`:
  - `dc-precache-v1` = `["/offline", "/icons/icon-192.png"]`
  - `dc-static-v1` = 19 entries, **all `/_next/static/*`**
  - **cached navigation documents: 0** · **cached `.html`: 0** · **cached Supabase: 0**
- `/offline` precached, status 200, contains the offline copy.

Registration (`src/components/pwa/ServiceWorkerRegistrar.tsx`): client component,
effect-based (**no inline script → CSP-safe**), guarded to `production` + feature
support, deferred to `window load`, with `updatefound`→`SKIP_WAITING` update
handling. Registration failure is swallowed (app works without the SW). Mounted
once in the root layout.

> Note: the SW is **production-only** by design (a dev SW fights Next HMR / caches
> dev chunks). It is therefore exercised under `next build && next start`, which is
> exactly how it was verified above.

### 1.3 iOS metas — `src/app/layout.tsx`

Verified present in the rendered `<head>`:
- `mobile-web-app-capable: yes` (the modern standard Next 15 emits; standalone-capable)
- `apple-mobile-web-app-title: Don Carlos`
- `apple-mobile-web-app-status-bar-style: default`
- `apple-touch-icon` → `/icons/apple-touch-icon.png` (180×180, **opaque** — iOS shows
  black behind alpha, so it's flattened on `#E63946`)
- per-mode `theme-color` (white/black) retained from Phase 1
- `<link rel="manifest">` emitted

### 1.4 Add-to-Home-Screen UX — `src/components/pwa/InstallPrompt.tsx`

One tasteful, dismissible card, two paths:
- **Android/Chromium:** captures `beforeinstallprompt`, `preventDefault()`s the
  browser mini-infobar, shows our own **Install** button that calls `prompt()`.
  *(Verified: console showed "Banner not shown: beforeinstallpromptevent.preventDefault()
  called" — our handler fired, and the custom card rendered in the DOM.)*
- **iOS Safari** (no such event): detects iOS WebKit, not-standalone, not an in-app
  browser → shows a "Share → Add to Home Screen" hint.
- **Non-nagging:** dismissal (and `appinstalled`) persists to `localStorage`; hidden
  entirely when already `display-mode: standalone`.
- **a11y:** non-modal `role="dialog"` with `aria-modal="false"` + `aria-labelledby`,
  labelled dismiss button (44px target), keyboard-reachable, the Share glyph hint
  carries an `aria-label`. No motion that violates reduced-motion.

---

## 2. Performance

### 2.1 Route / first-load-JS table (`next build`, production)

```
Route (app)                                 Size  First Load JS
┌ ƒ /                                      172 B         106 kB
├ ƒ /_not-found                            995 B         104 kB
├ ƒ /about                                1.4 kB         114 kB
├ ƒ /analytics                             172 B         106 kB
├ ƒ /customers                           3.98 kB         128 kB
├ ƒ /customers/[id]                      6.43 kB         154 kB
├ ƒ /dashboard                           43.7 kB         256 kB   ⚠ heaviest customer route
├ ƒ /forgot-password                        5 kB         142 kB
├ ○ /manifest.webmanifest                  147 B         103 kB
├ ƒ /menu                                 6.8 kB         116 kB
├ ƒ /offline                               172 B         106 kB
├ ƒ /profile                             4.44 kB         172 kB
├ ƒ /qr                                    449 B         144 kB
├ ƒ /scan                                6.36 kB         151 kB
├ ƒ /login                                 1.1 kB        218 kB   ⚠ see note
├ ƒ /signup                              1.23 kB         218 kB   ⚠ see note
└ ƒ /verify-email                        2.72 kB         204 kB   ⚠ see note
+ First Load JS shared by all             103 kB
ƒ Middleware                              104 kB
```

### 2.2 Over-budget flags (honest)

- **`/dashboard` — 256 kB.** The signature rewards screen; framer-motion (ring,
  stamp spring, count-up, celebration, eligible glow) dominates the 43.7 kB route
  chunk. This is the intentional "wow" surface (Phase 4) and motion is core to it.
  **Recommendation for the Verifier:** confirm on a throttled mid-range device that
  TBT/TTI still meet budget; if not, the lever is lazy-mounting `Celebration`
  (confetti) behind the threshold-crossing instead of statically importing it.
  Not done here to avoid regressing the Phase-4 "celebrate exactly once" timing
  under audit — flagged rather than silently changed.
- **`/login`, `/signup` — 218 kB; `/verify-email` — 204 kB.** Higher than the static
  content suggests; the auth route group pulls react-hook-form + zod + the OAuth
  button island into the first load. Acceptable for one-time auth screens (not the
  hot path), but flagged for the Verifier's Lighthouse pass.

### 2.3 What was confirmed structurally (already-good from earlier phases)

- **Code-splitting:** the QR scanner (`@zxing/browser`) is `dynamic(ssr:false)` in
  `ScanFlow` → its chunk loads only on the admin `/scan` route, in the browser.
  Verified it is **not** in any customer route's first load.
- **Images:** `next/image` is used for menu photos with `sizes`/blur (Phase 7);
  `remotePatterns` locked to Supabase public storage. SW runtime-caches same-origin
  images with a cap.
- **Fonts:** system stack (`-apple-system`…) — no web-font fetch, no FOUT/CLS.
- **No new heavy dep added** in this phase (icons use the already-present `sharp`).

> **Cannot run a trustworthy Lighthouse here.** FCP<1.5s / LCP<2.5s / TTI<3.5s /
> CLS<0.1 / TBT<200ms must be confirmed on a real throttled device by the Verifier.
> The structural prerequisites (no render-blocking web fonts, hashed-asset SW
> precache, dynamic QR import, image optimization) are in place.

---

## 3. Accessibility

The app was a11y-strong coming in (Phases 1–10 were hostilely audited for WCAG
2.1 AA — `:focus-visible` globally, `progressbar`/`role="img"` widgets, tab
semantics, `role="alert"`/`aria-invalid` forms, 44pt targets, landmarks, global
reduced-motion safeguard). Phase-11 a11y work:

### 3.1 D4-2 fix (the deferred §7.4 violation) — closed

The eligible-CTA `glow-pulse` keyframe animated **`box-shadow`** (violates
DESIGN_SYSTEM §7.4 "animate only transform/opacity"). **Fixed:**
- `tailwind.config.ts`: keyframe now animates **opacity** (`0.35 → 1 → 0.35`).
- `RewardsCard.tsx`: the glow is now a **blurred `dc-yellow` sibling** absolutely
  positioned *behind* the button (`-z-10`, `aria-hidden`), and only its opacity
  pulses (GPU-composited). The button itself no longer animates.
- **Verified in the built CSS:** `@keyframes glow-pulse{0%,to{opacity:.35}50%{opacity:1}}`
  — **no `box-shadow`** anywhere in the glow-pulse rule.
- Reduced-motion still freezes it via the existing global CSS safeguard (leaving a
  constant soft glow); the glow only renders when `progress.eligible` (unchanged).

### 3.2 New surfaces

- **InstallPrompt:** non-modal labelled dialog, labelled dismiss control, keyboard
  reachable, iOS Share glyph carries an `aria-label`, ≥44px targets.
- **Offline page:** proper `<main>` landmark, `<h1>`, AA-token text, focus-visible
  CTA, decorative mascot `aria-hidden`.

### 3.3 What needs the Verifier's device/SR pass (honest)

- Full **VoiceOver (iOS) / TalkBack (Android)** sweep of the core flows.
- **axe/Lighthouse a11y** numeric score on a real browser profile.
- Physical **keyboard-only** walk of every flow on device.
- The repo's vitest harness is **node-only (no jsdom)** by design (Phase-10
  P10-CF-2), so a `jest-axe` component test would require a new env + dependency —
  deliberately **not** added (scope/risk). Instead I added a **pure** manifest-shape
  test (below) that fits the existing harness.

---

## 4. CSP live-browser console sweep (Phase-10 carry-forward) — CLOSED

Booted `next build && next start` and drove real Chromium (Playwright) through the
representative page types, reading the console at `warning`/`error`:

| Page | Notable content | Console result |
|------|-----------------|----------------|
| `/dashboard` | framer-motion + Supabase **realtime (wss)** + balance count-up | 0 errors, 0 warnings |
| `/menu` | `next/image` photos | 0 errors, 0 warnings |
| `/about` | **Google Maps Embed iframe** (`frame-src https://www.google.com`) | 0 errors |
| `/qr` | inline-SVG QR render | 0 errors, 0 warnings |

- Confirmed the CSP header is present per-request with a **fresh nonce each time**
  (different nonce on `/` vs `/offline`), plus `worker-src 'self' blob:` and
  `manifest-src 'self'` — so the SW and manifest are permitted.
- **No `unsafe-inline` was introduced for scripts**; the SW registration and install
  prompt are effect-based client code (no inline script). The manifest link and iOS
  metas are static `<head>` tags (no script).
- The static headers (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy,
  Permissions-Policy) remain on every response.

> The full *visual* cross-device browser sweep (iOS Safari + Android Chrome, light
> + dark, small + large phones) remains the Verifier's device pass. What I proved:
> the CSP does not break any page in a real Chromium engine, and the PWA additions
> are CSP-clean.

---

## 5. Gate results (this worktree, clean `.next`)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | **0 errors** |
| `npm test` | **34 passed** (28 prior + 6 new manifest-contract tests) |
| `npm run lint` | **clean** (only the known multi-lockfile *worktree-cascade* warning — see WINDOWS_BUILD_NOTES) |
| `npm run build` | **success**, 27 pages generated; `/manifest.webmanifest` + `/offline` emitted; `/sw.js` served |

New test: `tests/unit/manifest.test.ts` — asserts the installability-critical
manifest fields (standalone, start_url, theme/bg colors, 192+512 `any`, ≥1
maskable, same-origin PNG icons) so a PWA regression fails the gate, not just
Lighthouse.

---

## 6. Files

**Added**
- `src/app/manifest.ts` — web app manifest
- `src/app/offline/page.tsx` — offline fallback shell
- `public/sw.js` — service worker (scoped, nonce/auth-safe)
- `src/components/pwa/ServiceWorkerRegistrar.tsx` — guarded SW registration
- `src/components/pwa/InstallPrompt.tsx` — A2HS UX (Android + iOS)
- `scripts/generate-pwa-icons.mjs` — icon generator (sharp)
- `scripts/pwa-icon-source.svg`, `scripts/pwa-icon-source-maskable.svg` — brand sources
- `public/icons/{icon-192,icon-512,icon-maskable-192,icon-maskable-512,apple-touch-icon}.png`
- `tests/unit/manifest.test.ts`

**Modified**
- `src/app/layout.tsx` — manifest link, iOS metas/icons, mount InstallPrompt + ServiceWorkerRegistrar
- `src/middleware.ts` — matcher excludes `/sw.js` + `/icons/`
- `tailwind.config.ts` — `glow-pulse` keyframe: box-shadow → opacity (D4-2)
- `src/components/rewards/RewardsCard.tsx` — eligible glow → blurred opacity sibling (D4-2)

---

## 7. Acceptance criteria → status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | App installs to home screen on iOS + Android, launches standalone | **Structurally met + browser-verified** (manifest standalone/maskable, iOS metas, A2HS capture verified firing in Chromium). **Needs device verification:** actual install on a physical iPhone + Android. |
| 2 | Offline: app shell loads; sensible offline messaging | **Met** — `/offline` precached + served 200; SW serves it on navigation failure (verified precache + fallback wiring). Recommend a Verifier airplane-mode device check. |
| 3 | Lighthouse ≥ 90 Perf/A11y/BestPractices/SEO (mobile) | **Needs-device-verification** — cannot run trustworthy Lighthouse here. Structural prerequisites in place; `/dashboard`, `/login`, `/signup`, `/verify-email` flagged for scrutiny (§2.2). |
| 4 | Perf budget on a throttled mid-range device | **Needs-device-verification** — documented; structural work done, no on-device throttled measurement possible here. |
| 5 | Zero critical axe violations; full keyboard operability | **Strongly met structurally** (D4-2 closed, CSP sweep clean, widgets already ARIA'd, new surfaces a11y-built). **Needs-device-verification:** numeric axe score + VoiceOver/TalkBack + on-device keyboard walk. |

---

## 8. Deviations / open items (surfaced, not buried)

- **Placeholder PWA icon art (O-2).** Icons are the brand-mark placeholder; real
  art lands by replacing the two source SVGs + re-running the generator. Documented.
- **SW is production-only** (verified via `next start`). A dev SW would fight HMR.
  If the team wants a dev SW for testing, it'd need separate handling — out of scope.
- **`/dashboard` 256 kB / auth routes ~218 kB** flagged over a strict budget (§2.2);
  not trimmed in this phase to avoid regressing audited Phase-4 motion timing.
  Lever documented for the Verifier.
- **No jest-axe component test** added (harness is node-only by design); a
  pure manifest-contract test was added instead.
- **`PHASE_LOG.md` not touched** (per instructions — only the Verifier writes it).
- Lighthouse, real-device install/offline, and screen-reader passes are explicitly
  left to the Verifier's device job.
