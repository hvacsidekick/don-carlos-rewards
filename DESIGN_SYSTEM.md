# Don Carlos Rewards App — Design System

> **Document status:** Phase 0 deliverable. The single source of truth for everything visual and interactive. If code and this document disagree, this document wins (or the deviation is logged in `PHASE_LOG.md`). Pairs with [`PLAN.md`](./PLAN.md) and [`BLUEPRINT.md`](./BLUEPRINT.md).
>
> **Design philosophy:** *"Timeless Apple structure, energetic taco-shop soul."* Every screen should feel like it could ship in iOS — calm, spacious, type-led — but the moments of delight (earning a stamp, unlocking a reward, the mascot) carry Don Carlos warmth.

---

## 1. Brand Fusion Strategy

| Dimension | Apple contributes | Don Carlos contributes | Result |
|-----------|-------------------|------------------------|--------|
| Layout | Generous whitespace, clear hierarchy, grid discipline | — | Uncluttered, breathable screens |
| Typography | SF Pro / system stack, type ramp, weight discipline | Warm, friendly copy voice | Legible + approachable |
| Color | Neutral system grays, semantic colors, restraint | Red / yellow / green vibrancy | Calm canvas, vivid accents |
| Motion | Spring physics, 60fps, purposeful | Celebratory confetti moments | Polished with joyful peaks |
| Personality | Quiet, content-first | Chef mascot, food photography | Professional, never sterile |

**The 90/10 rule:** ~90% of any screen is the Apple-calm neutral system; ~10% is Don Carlos vibrancy (the active CTA, filled stamps, the ring, a celebration, a mascot). Color earns attention precisely because it's rationed. Never paint a whole screen red.

**Where the mascot appears (sparingly):** app icon · profile avatar default · empty states · celebration moments · error states. **Never** as decoration on functional screens.

---

## 2. Color System

### 2.1 Brand palette (constant in light & dark)
```css
--dc-red:    #E63946;  /* primary CTA, filled stamps, progress ring, brand */
--dc-yellow: #F9C74F;  /* highlights, celebration confetti, milestone glow */
--dc-green:  #90BE6D;  /* fresh/menu accents, positive deltas */
```
> ⚠️ These are the *working* values pending exact extraction from official branding (open question O-2). Defined as CSS variables so a global swap is one edit. Verify contrast after any change.

### 2.2 Neutrals (Apple-inspired, mode-aware)
```css
:root {                                   /* LIGHT */
  --bg-primary:    #FFFFFF;
  --bg-secondary:  #F2F2F7;   /* grouped backgrounds, cards-on-page */
  --bg-tertiary:   #FFFFFF;   /* cards on secondary bg */
  --separator:     rgba(60,60,67,0.18);
  --text-primary:  #000000;
  --text-secondary:rgba(60,60,67,0.60);
  --text-tertiary: rgba(60,60,67,0.30);
  --fill-quaternary: rgba(116,116,128,0.08);
}
@media (prefers-color-scheme: dark) {     /* DARK */
  :root {
    --bg-primary:    #000000;
    --bg-secondary:  #1C1C1E;
    --bg-tertiary:   #2C2C2E;
    --separator:     rgba(84,84,88,0.40);
    --text-primary:  #FFFFFF;
    --text-secondary:rgba(235,235,245,0.60);
    --text-tertiary: rgba(235,235,245,0.30);
    --fill-quaternary: rgba(118,118,128,0.16);
  }
}
```

### 2.3 Semantic colors (Apple system)
```css
--success: #34C759;   /* Apple green — confirmations */
--warning: #FF9500;   /* Apple orange */
--error:   #FF3B30;   /* Apple red — destructive/validation */
```
> Note: `--error` (#FF3B30, system red) is distinct from `--dc-red` (#E63946, brand red). Use `--error` for failure/destructive states, `--dc-red` for brand/rewards. Keep them visually separable.

### 2.4 Contrast rules (WCAG 2.1 AA — enforced)
- Body text ≥ **4.5:1**; large text (≥22px or 18px bold) ≥ **3:1**; UI components/focus ≥ **3:1**.
- `--dc-red` on white ≈ 4.0:1 → **acceptable for large text / icons / fills, NOT for small body text on white.** For red text on white, darken to a `--dc-red-text` token (e.g. `#C32A37`) meeting 4.5:1, or place white text on red fill.
- Never communicate state by color alone — pair with icon/label (color-blind safe).
- Auditors must run a contrast checker on every new text/background pair.

### 2.5 Usage map
| Token | Use |
|-------|-----|
| `--dc-red` | Primary button fill, filled taco stamp, progress ring stroke, active tab indicator |
| `--dc-yellow` | Celebration confetti, milestone glow, "reward ready" badge |
| `--dc-green` | Positive point delta (+), fresh/menu tags |
| `--bg-secondary` | Page background behind cards |
| `--bg-tertiary` | Card surface |
| `--text-secondary` | Captions, helper text, timestamps |
| `--error` | Validation errors, destructive confirm |

---

## 3. Typography

### 3.1 Font stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display",
             "SF Pro Text", system-ui, sans-serif;
```
System font = native feel on every OS, zero web-font payload (helps performance budget), automatic Dynamic Type friendliness.

### 3.2 Type ramp (Apple HIG)
| Token | Size | Weight | Line-height | Use |
|-------|------|--------|-------------|-----|
| `large-title` | 48px | 700 | 1.05 | Onboarding hero, celebration headline |
| `title2` | 34px | 700 | 1.1 | Big numbers (points balance), hero |
| `title3` | 28px | 600 | 1.15 | Page titles |
| `headline` | 22px | 600 | 1.2 | Section headers, card titles |
| `body` | 17px | 400 | 1.4 | **Default body** (Apple's default) |
| `body-emph` | 17px | 600 | 1.4 | Emphasized body, list primary text |
| `footnote` | 13px | 400 | 1.35 | Secondary info, metadata |
| `caption` | 11px | 400 | 1.3 | Legal, fine print, timestamps |

### 3.3 Rules
- One H1 (`title3`/`title2`) per screen; logical heading order (no skips) for screen readers.
- The points balance number is the typographic hero on the dashboard — `title2`/`large-title`, weight 700, tabular numerals (`font-variant-numeric: tabular-nums`) so it doesn't shift while animating.
- Body copy never below `footnote` (13px) except legal `caption`.
- Letter-spacing: default; tighten large display (`-0.02em`) only on `title2`/`large-title`.
- Respect Dynamic Type / user font scaling — use rem-relative sizing where feasible; never disable zoom (`maximum-scale=1` is forbidden — accessibility).

---

## 4. Spacing & Layout

### 4.1 4px base grid
```
space-1=4  space-2=8  space-3=12  space-4=16  space-5=20
space-6=24  space-8=32  space-10=40  space-12=48  space-16=64
```
- Card internal padding: **24px** (`space-6`).
- Screen edge gutters: **16px** (`space-4`) on phones, **24px** tablet+.
- Vertical rhythm between sections: **32px** (`space-8`).
- Gap between list rows: **0** (use separators) or **8–12px** for card lists.

### 4.2 Touch targets
- Minimum **44×44pt** for every tappable element (Apple HIG). Visual element may be smaller, hit area is not.
- Minimum **8px** between adjacent tap targets.
- Bottom tab bar items ≥ 44pt tall, evenly distributed, with safe-area inset (`env(safe-area-inset-bottom)`).

### 4.3 Radii & elevation
| Element | Radius | Shadow (light) | Shadow (dark) |
|---------|--------|----------------|---------------|
| Hero card (RewardsCard) | 24px (`rounded-3xl`) | `0 8px 24px rgba(0,0,0,.10)` | `0 8px 24px rgba(0,0,0,.5)` |
| Standard card (Menu/list) | 16px (`rounded-2xl`) | `0 2px 8px rgba(0,0,0,.08)` | `0 2px 8px rgba(0,0,0,.4)` |
| Buttons / inputs | 12px (`rounded-xl`) | subtle / none | none |
| QR container | 16px | soft | soft (but QR itself always white) |
- Dark mode: reduce shadow spread, rely more on `--bg-tertiary` elevation contrast than shadow.

### 4.4 Safe areas & responsive
- Honor iOS safe-area insets top & bottom (notch, home indicator).
- Mobile-first; content max-width on desktop ~ 480px for the user app (it's a phone experience), admin dashboard up to `xl` (1280px).
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280`.

---

## 5. Component Specifications

### 5.1 RewardsCard — the signature component (Phase 4)

**Anatomy** (hybrid stamp card + Apple-Watch-style progress ring):
```
┌───────────────────────────────────────────┐
│              Don Carlos Rewards            │  headline, --text-secondary, centered
│        ╭───────────────────────────╮       │
│        │      ◜‾‾‾‾‾‾‾‾‾‾‾‾◝       │       │  ← progress ring (SVG), --dc-red stroke
│        │    🌮  🌮  🌮  🌮  🌮      │       │  ← filled stamps (--dc-red taco)
│        │    🌮  🌮  ⚪  ⚪  ⚪       │       │  ← empty stamps (outline, --text-tertiary)
│        │      ◟__________◞         │       │
│        ╰───────────────────────────╯       │
│                                            │
│                70                          │  title2/large-title, 700, tabular-nums
│             points                         │  footnote, --text-secondary
│        30 points to your $10 reward         │  body, --text-secondary
│                                            │
│        [   Redeem $10 Off   ]              │  primary CTA (enabled at threshold)
└───────────────────────────────────────────┘
```
**Specs**
- Surface: `--bg-tertiary`, `rounded-3xl` (24px), hero shadow, padding 24px.
- **Progress ring:** SVG circle, stroke-width 8px, track `--separator`, progress `--dc-red`, rounded line-caps, starts at 12 o'clock, fills clockwise. Wraps the stamp grid (ring diameter > grid bounding box). `role="progressbar"` `aria-valuenow/min/max`.
- **Stamp grid:** taco-icon stamps, 40×40px, gap 12px, arranged to match `rewards_config.stamps_per_card` (default 10 → 5×2). Filled = `--dc-red` solid taco; empty = outline at `--text-tertiary`. 1 stamp = `threshold / stamps_per_card` points (default 10 pts; see BLUEPRINT O-4).
- **Balance:** big tabular number, `title2`+, weight 700. Updates with a count-up animation on change.
- **Status line:** "{toNext} points to your $10 reward" or, when eligible, "Reward ready! 🎉".
- **CTA:** disabled (greyed, `--text-tertiary`) below threshold; at/above → enabled `--dc-red` fill, white label.
- **States:** zero-points (empty ring, all outline stamps, mascot welcome + "Earn your first taco!"); loading (skeleton ring + skeleton stamps); eligible (subtle `--dc-yellow` glow pulse on CTA).
- **Dark mode:** card `--bg-tertiary` (#2C2C2E), ring/stamps keep brand red, track lightens to dark separator.

### 5.2 StampGrid (Phase 4)
- Props `{ total, filled, animateIndex? }`.
- New stamp fill: scale `0→1.2→1.0` spring (`springBouncy`), color outline→`--dc-red`, light haptic. Only the newly added stamp animates; others static.
- Outline stamp uses the same taco glyph at 1.5px stroke, `--text-tertiary`.

### 5.3 ProgressRing (Phase 4)
- Props `{ progress: 0..100, size, strokeWidth=8 }`.
- Animate `stroke-dashoffset` over 600ms easeInOut. Track + progress arcs share geometry.
- Reduced-motion: set final offset instantly.
- a11y: wrap in `role="progressbar"`, `aria-valuenow={progress}`.

### 5.4 Celebration (Phase 4)
- Triggered when crossing a reward threshold. Confetti in `--dc-red/--dc-yellow/--dc-green`, ring completion flourish (full sweep + scale pulse 1.0→1.06→1.0), mascot "celebrate" pops in, headline "$10 reward unlocked!", success haptic `[10,50,10,50,10]`, optional short success sound (respect mute / reduced-motion → skip confetti, keep concise toast).

### 5.5 QRDisplay (Phase 5)
```
┌───────────────────────────────────────────┐
│           Your Rewards Code               │  headline
│        ┌─────────────────────────┐        │
│        │   ███ ▄▄ █  ██  ▄ ███   │        │  QR ≥200×200, EC=High
│        │   █ █  ███ ▄█ ███ █ █   │        │
│        └─────────────────────────┘        │
│      Show this to staff at checkout       │  footnote, --text-secondary
│              [ Rotate code ]               │  text button (security)
└───────────────────────────────────────────┘
```
- QR ≥ 200×200px, error correction **High (~30%)**, 16px white quiet-zone padding.
- **Background always white**, foreground always black — *even in dark mode* (scannability). The surrounding card may be dark; the QR tile is a white rounded plate.
- Encodes the opaque `qr_token` only (no PII).
- Brightness hint: optionally bump screen brightness when shown (nice-to-have).

### 5.6 QRScanner (admin, Phase 5)
- Full-width camera viewport, rounded, with a reticle overlay (rounded square guide) and dimmed surround.
- Controls: torch toggle (if supported), "Enter ID manually" fallback, cancel.
- On detect → freeze frame + success haptic → resolve token → confirmation sheet (customer name, current balance, amount entry).
- Permission-denied state: clear copy + the manual-entry fallback (never a dead end).

### 5.7 MenuItem (Phase 7)
```
┌───────────────────────────────────────────┐
│ [        food photo, 16:9, cover        ]  │  rounded-t-2xl, next/image, blur placeholder
│ 🌮 Carne Asada Taco                 $3.50  │  body-emph + price (tabular-nums, right)
│ Grilled steak, cilantro, onion, salsa      │  footnote, --text-secondary, max 2 lines
│ [spicy] [gf]                               │  optional dietary tags (--dc-green pills)
└───────────────────────────────────────────┘
```
- Card `--bg-tertiary`, `rounded-2xl`, standard shadow, padding 16px (image flush to top edges).
- Image 16:9 `object-cover`, blur-up placeholder, fixed aspect box to prevent CLS. Missing image → branded placeholder (mascot/pattern), never broken-image.
- Hover (desktop pointer only): scale 1.02 + shadow-lg, 150ms. Mobile: no transform; active state = subtle opacity.

### 5.8 CategoryNav (Phase 7)
- Sticky segmented control / chip row under the header; active chip `--dc-red` text + underline or filled pill; tapping scrolls to the category section (smooth, respects reduced-motion).

### 5.9 BottomTabBar (cross-cutting)
- Fixed bottom, `--bg-primary` with top hairline `--separator`, blur/translucent backdrop (Apple style) where supported.
- Tabs: **Dashboard · Menu · QR · Profile** (+ **Admin** only if `is_admin`). Icon + 11px label. Active = `--dc-red` icon+label; inactive = `--text-secondary`.
- ≥44pt targets, safe-area bottom inset.

### 5.10 Buttons
| Variant | Fill | Text | Use |
|---------|------|------|-----|
| Primary | `--dc-red` | white | main action (redeem, sign in, add points) |
| Secondary | `--fill-quaternary` | `--text-primary` | secondary actions |
| Tertiary/text | transparent | `--dc-red` | low-emphasis (rotate code, links) |
| Destructive | transparent→`--error` on confirm | `--error` | delete account |
- Height ≥ 44px, `rounded-xl`, weight 600, full-width on mobile for primary. Pressed: scale 0.97 + slight opacity. Disabled: `--text-tertiary` on `--fill-quaternary`, no shadow.

### 5.11 Forms & inputs (auth, admin)
- Inputs: `--bg-secondary` fill (light) / `--bg-tertiary` (dark), `rounded-xl`, 44px+ height, 16px text (prevents iOS zoom-on-focus), clear `--separator` border, focus ring `--dc-red` 2px.
- Labels above field (`footnote`, `--text-secondary`). Inline errors below in `--error` with an icon, `aria-describedby` linking field→error, `aria-invalid` on the field; errors announced (`role="alert"`/live region).
- Submit disabled + spinner while pending; never double-submit.

### 5.12 Transaction row (Phase 6)
```
[icon]  Earned points              +25     ← delta --dc-green (earn) / --error (redeem)
        Today 2:14 PM · Balance 95         footnote --text-secondary
```
- Type icon (earn=arrow-up/taco, redeem=gift, adjustment=pencil) in a tinted circle. Delta tabular-nums, sign + color (and icon, not color alone). Grouped by date headers (Today/Yesterday/Month).

### 5.13 EmptyState
- Centered mascot (matching expression) + headline (`headline`) + supportive line (`footnote`, `--text-secondary`) + optional CTA. Used for: no transactions, no menu, no customers, errors.

---

## 6. Iconography

- **System icons:** Heroicons (outline) or Lucide — outline style, ~1.5px stroke, matching SF Symbols aesthetic. Consistent weight across the app.
- **Taco stamp glyph:** custom SVG taco, two states (filled solid `--dc-red`, outline `--text-tertiary`).
- **Mascot SVG** (chef with sombrero) — expressions: `welcome` (waving), `celebrate` (confetti/arms up), `empty` (holding sign), `error` (puzzled, question mark). Multiple weights/sizes; optimized SVG; provide accessible `alt`/`aria-label` or `aria-hidden` when decorative. *(Asset delivery = open question O-2.)*
- Icon sizing: 24px default in nav/buttons, 20px inline, hit area still ≥44pt.

---

## 7. Animation System

**Tool:** Framer Motion. **Principle:** motion clarifies state change and rewards effort — never decorative, never blocking input.

### 7.1 Spring presets (`lib/motion.ts`)
```ts
export const springGentle  = { type:'spring', damping:20, stiffness:300 }; // most UI
export const springStiffer = { type:'spring', damping:15, stiffness:400 }; // snappy
export const springBouncy  = { type:'spring', damping:10, stiffness:300 }; // stamps, fun
```

### 7.2 Catalog
| Animation | Spec |
|-----------|------|
| Stamp fill | scale 0→1.2→1.0 `springBouncy`, ~400ms, outline→`--dc-red`, light haptic |
| Progress ring | `strokeDashoffset` 600ms easeInOut |
| Balance count-up | number tween to new value, ~500ms easeOut, tabular-nums (no layout shift) |
| Milestone | medium haptic `[10,50,10]` at each stamp/threshold tick |
| Reward unlock | confetti ~1.2s + ring sweep + scale pulse 1.0→1.06→1.0 + success haptic + mascot pop |
| Page enter | opacity 0→1, y 20→0, 300ms easeOut |
| Modal/sheet | slide up + backdrop fade, `springGentle` |
| Button press | scale 0.97, 100ms |
| List item enter | staggered fade+rise (stagger 30ms), capped count |
| Toast | slide+fade from top/bottom, auto-dismiss |

### 7.3 Reduced motion (mandatory)
```ts
const reduce = useReducedMotion(); // framer-motion
// reduce → durations ~0, no confetti/parallax/large translation; keep opacity cross-fades minimal.
```
Honor `@media (prefers-reduced-motion: reduce)` globally too. Essential state changes still happen (instantly); only the *motion* is removed.

### 7.4 Performance
- Animate only `transform` and `opacity` (GPU-composited). Avoid animating layout/box-shadow/width.
- 60fps target; profile the rewards card on a mid-range device (Phase 11). Confetti capped in particle count.

---

## 8. Haptics

```ts
// lib/haptics.ts — guarded; navigator.vibrate is unsupported on iOS Safari (degrade silently).
export const haptic = {
  light:    () => navigator.vibrate?.(10),
  medium:   () => navigator.vibrate?.([10, 50, 10]),
  success:  () => navigator.vibrate?.([10, 50, 10, 50, 10]),
};
```
- Light: stamp fill, button confirm. Medium: milestone. Success: reward unlock.
- Always feature-detect; never assume support. On unsupported platforms, the visual/audio feedback carries the moment. Respect a user "reduce motion/feedback" preference by softening to a single short pulse or none.

---

## 9. Accessibility (WCAG 2.1 AA — acceptance criteria, not polish)

**Checklist applied to every screen:**
- [ ] Color contrast: text ≥4.5:1, large ≥3:1, UI/focus ≥3:1.
- [ ] Visible focus indicator on every interactive element (`:focus-visible`, 2px `--dc-red` ring, never `outline:none` without replacement).
- [ ] Full keyboard operability — every action reachable and triggerable without a pointer; logical tab order; no keyboard traps; Esc closes modals.
- [ ] ARIA on custom widgets: progress ring (`progressbar`), stamp grid (meaningful label e.g. "7 of 10 stamps earned"), scanner, tabs (`tablist`/`tab`/`tabpanel`), dialogs (`dialog`, focus trap + restore).
- [ ] Alt text on every meaningful image (food photos use item name); decorative mascot `aria-hidden`.
- [ ] Form errors programmatically associated + announced (`aria-invalid`, `aria-describedby`, `role="alert"`).
- [ ] Heading hierarchy correct; landmarks (`main`, `nav`, `header`).
- [ ] State never by color alone (icons/labels accompany).
- [ ] Touch targets ≥44×44pt, spacing ≥8px.
- [ ] Respect reduced-motion and Dynamic Type; do not block zoom.
- [ ] Screen-reader pass on core flows (VoiceOver iOS, TalkBack Android) in Phase 11.
- [ ] `lang` set; meaningful page `<title>`s.

---

## 10. Dark Mode Strategy

- **Mechanism:** `darkMode: 'media'` — follows OS `prefers-color-scheme`. No manual toggle in v1 (open to v2).
- **Rules:**
  - Brand colors (`--dc-red/yellow/green`) stay vibrant and constant — they're the identity.
  - Neutrals invert via the token blocks in §2.2; never hard-code `#fff`/`#000` in components — use tokens.
  - Shadows soften; elevation leans on `--bg-tertiary` contrast.
  - **QR code tile stays white** regardless of mode (scanning requirement).
  - Images: avoid pure-white photo frames in dark; food photos sit on `--bg-tertiary`.
- Every component is verified in both modes before its phase is "done" (`/_sandbox` route from Phase 1 aids this).

---

## 11. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |
| Total Blocking Time | < 200ms |
| Lighthouse (mobile) | ≥ 90 across Perf / A11y / Best Practices / SEO |

**Tactics:** system fonts (no web-font load), RSC to minimize client JS, lazy-load the QR scanner only on the admin route, `next/image` with fixed aspect boxes (zero CLS), tabular-nums on animating numbers (no reflow), confetti only on demand, code-split heavy libs, cache static assets via the service worker (Phase 11).

---

## 12. Responsive Breakpoints

```css
sm: 640px   /* large phones */
md: 768px   /* tablets */
lg: 1024px  /* desktop */
xl: 1280px  /* admin dashboard wide */
```
- **Priority: mobile-first** — ~80% of customers are on phones. The user-facing app is designed as a phone experience (content column capped ~480px on larger screens, centered).
- Admin dashboard is the exception: it uses `lg`/`xl` to lay out tables, KPI cards, and charts comfortably (staff may use a tablet/desktop).

---

## 13. Voice & Copy

- **Tone:** warm, concise, human — like friendly counter staff, not a bank. "Reward ready! 🎉" not "You have met the redemption threshold."
- Errors are kind and actionable: "That code didn't scan — try again or enter the ID." Never expose raw error codes/stack traces to users.
- Numbers and money formatted consistently (`format.ts`): currency `$3.50`, points with thousands separators, tabular alignment.
- Emoji used lightly for warmth (🌮 🎉) — never as the only signal of meaning.

---

## 14. Definition of "Apple-Quality" (auditor rubric for design gates)

A screen passes the design gate only if **all** hold:
1. **Hierarchy** — one clear focal point; eye lands where it should; whitespace does the work.
2. **Alignment** — everything snaps to the 4px grid; optical alignment respected; no stray margins.
3. **Type discipline** — uses the ramp; ≤3 sizes per screen; weights purposeful.
4. **Color restraint** — 90/10 rule honored; brand color rationed to what matters.
5. **Motion** — springy, 60fps, purposeful, reduced-motion safe; nothing janky or gratuitous.
6. **States** — loading, empty, error, success all designed (no raw spinners-only or dead ends).
7. **Both modes** — flawless in light and dark.
8. **Accessibility** — §9 checklist passes.
9. **Touch** — targets ≥44pt, comfortable spacing, thumb-reachable primary actions.
10. **Delight** — at least the intended moments (earn, unlock) feel genuinely satisfying.

If a screen would look out of place next to Apple's own apps, it isn't done.

---

*End of DESIGN_SYSTEM.md — this and [`BLUEPRINT.md`](./BLUEPRINT.md) are required reading before building any UI phase in [`PLAN.md`](./PLAN.md).*
