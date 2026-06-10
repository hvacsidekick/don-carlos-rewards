# Phase 1 Audit Report — Project Scaffold + Design System Foundation

**Project:** Don Carlos Rewards App
**Phase:** 1 of 12
**Role:** Auditor (independent, hostile)
**Date:** 2026-06-09
**Stack audited:** Next.js 15.5.19 · Tailwind v3.4.17 · React 19.1.0 · tailwind-merge v2.6

> Every acceptance check was **re-run from scratch**; every contrast number was **re-derived in Node from the actual token values** (not copied from the Builder's report); the running app was exercised in an **isolated headless Chrome** (separate profile + debug port — the user's own Chrome was never touched). Library behavior (`tailwind-merge`) was tested **directly**, independent of the dev server, to defeat dev-cache artifacts. Nothing here is taken on trust.
>
> **Note on workspace state:** during this audit a **Fixer began editing source concurrently** (timestamps 16:24–16:27). This report therefore covers **two states**: (A) the Builder's handoff — the artifact under the Phase-1 gate, §§1–4; and (B) the in-flight Fixer changes observed mid-audit — §5. Read both.

---

## 0. Verdict

**Phase 1 does NOT pass. → Fixer. (One critical blocker is live right now.)**

| ID | Sev | Finding | State |
|----|-----|---------|-------|
| **C-1** | HIGH | `tailwind-merge` (default config) silently strips the custom type-ramp class from `Button`/`Badge`/`sm` button → wrong font sizes, and the **`sm` button loses `text-white` → black text on red**. Systemic; poisons every downstream component. | Builder: **FAIL** · Fixer: **FIXED & verified** |
| **C-2** | HIGH | Many semantic/brand color pairs fail WCAG AA in **light mode** (tinted badges 1.9–2.9:1, destructive text/hover 3.55:1, active tab label 4.17:1). | Builder: **FAIL** · Fixer: **mostly fixed** (A-4 remains) |
| **B-1** | **CRITICAL** | **The current `globals.css` breaks the build.** A comment contains `` `bg-*/15` `` — the `*/` closes the CSS comment early → `next build` **fails** (`globals.css:35 Unknown word`), dev serves **500**. Introduced by the in-flight C-2 fix. | **FAIL — live blocker** |
| **A-3** | MED | Tertiary/link button text (`dc-red-text` #C32A37) unreadable on dark = 3.71:1. | Builder: **FAIL** · Fixer: **FIXED** (dark `#FF6B6B` = 7.57:1) |
| **A-4** | MED | Active tab **label** (`text-dc-red` #E63946 on white, 11px) = **4.17:1**. | **NOT fixed** (still present) |
| **M-2** | MINOR | Disabled button used `opacity-50` over the live variant, not §5.10's `fg-tertiary on fill-quaternary`. | Builder: deviation · Fixer: **FIXED** |
| **F-1** | DEFER | White on `--dc-red` #E63946 = 4.17:1 (CTA). | Builder-flagged · Fixer **pre-empted** O-2 (see §5.4) |

The scaffold, tooling, env system, dark-mode plumbing, prod route-guard, and keyboard/focus a11y are **genuinely strong** (§1, §4.2). The failures are concentrated in the design-system foundation — exactly where this phase's value lives.

**Correction to the prior audit report (was graded "C"):** its claim that `next build` is *flaky on Windows (2/4 ENOENT)* **did not reproduce** — I ran **5 consecutive clean builds, 5 green** (the one transient "no production build" I saw was self-inflicted by a temp transpile, not a Next race). I am **withdrawing** the build-flakiness blocker. Its `sm`-button "black text" claim, by contrast, **is correct** (confirmed at the library level — see C-1).

---

## 1. Correctness (Builder handoff — re-run)

| Check | Method | Result |
|-------|--------|--------|
| `tsc --noEmit` | re-ran | **PASS** (exit 0, no output) |
| `next lint` | re-ran | **PASS** ("No ESLint warnings or errors"; deprecation notice only) |
| `prettier --check .` | re-ran | **PASS** |
| `next build` | ran **5×** clean | **PASS 5/5** on the Builder code (see §5/B-1 for the Fixer regression) |
| `/_sandbox` prod-guarded | `next start` + curl | **PASS** — `/_sandbox` → **404**, `/` → 200. `notFound()` fires under `NODE_ENV=production`; route emits 0 B. |
| No service-role key in client bundle | `grep .next/static/**` | **PASS** — `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_*`, `SENTRY_DSN`, and the placeholder service value all **absent** from client chunks |
| Console clean on `/_sandbox` | headless Chrome | **PASS** — 0 errors / 0 warnings (only the React DevTools info line) |
| `env.ts` fail-fast | transpiled + run, 3 scenarios | **PASS** — see §1.1 |

### 1.1 `env.ts` — verified
Transpiled and executed under Node:
- **All required vars cleared** → throws an aggregated, readable error listing each missing key + remediation hint. ✅
- **Malformed URL** → throws with the custom URL message. ✅
- **All valid** → no throw. ✅
- Client/server schema split correct; `getServerEnv()` guards `typeof window !== "undefined"`; service-role key is server-schema only. ✅
- **M-1 (minor):** `env.ts` is imported **nowhere** in `src/`, so its fail-fast does not run at app startup yet. The module throws *when imported* (verified) but is off the import path. Fine for Phase 1 (no DB), but Phase 2/3 must import it at a startup boundary for the guarantee to bite.

---

## 2. C-1 — type ramp silently stripped (HIGH, systemic)

**Direct library proof** (Node, against the exact `button.tsx`/`badge.tsx` class strings — no browser, no dev cache):

| Component (Builder code) | Spec | `cn()` output | Result |
|---|---|---|---|
| `Button` primary, default size | `text-body-emph` 17px | `text-body-emph` **dropped**, `text-white` kept | renders **16px** |
| `Button` primary, **sm** size | 13px + **white** | `text-footnote` kept, **`text-white` dropped** | renders **black text on red** |
| `Badge` (default & success) | `text-caption` 11px | `text-caption` **dropped** | renders **16px** |

**Root cause.** `cn()` was `twMerge(clsx(...))` with the **stock** tailwind-merge config. Stock twMerge only knows Tailwind's *default* font-size scale; the project's custom ramp keys (`caption`/`footnote`/`body`/`body-emph`/`headline`/`title2`/`title3`/`large-title`) are unknown, so it lumps `text-<ramp>` into the same `text-*` conflict group as `text-<color>` and keeps only the **last** — dropping size (and, for `sm`, dropping the color too). This is deterministic and was masked from the Builder because the sandbox **type-ramp** section uses raw template-literal `className` (never routed through `cn`), so the showcase *looked* correct.

> **Why a single in-browser reading can mislead:** my first dev measurement (a `.next` polluted by interleaved prod builds) showed the stripping; a freshly-recompiled server briefly showed correct sizes. The **library-level test is authoritative** and shows stripping. Lesson logged.

**Impact.** `Button` and `Badge` are used by every later phase; the Apple type discipline (§14 #3) and "tokens render correctly" acceptance both fail at the foundation.

---

## 3. C-2 — WCAG AA contrast failures in light mode (HIGH)

Full sweep, recomputed from `globals.css` (translucent tokens composited over their real backgrounds; sRGB WCAG formula). Threshold for all of these = **4.5:1** (none qualify as "large text").

**Builder-state failures (light mode):**
| Element | Pair | Ratio | |
|---|---|---|---|
| Badge `success` | #34C759 on success/15 | **1.97:1** | ❌ |
| Badge `warning` | #FF9500 on warning/15 | **1.95:1** | ❌ |
| Badge `fresh` | #90BE6D on green/15 | **1.93:1** | ❌ |
| Badge `destructive` | #FF3B30 on error/15 | **2.91:1** | ❌ |
| Destructive button (rest) | #FF3B30 on white | **3.55:1** | ❌ |
| Destructive button (hover) | white on #FF3B30 | **3.55:1** | ❌ |
| **Active tab label** | #E63946 on white (11px) | **4.17:1** | ❌ (**A-4**) |
| Primary btn / default Badge | white on #E63946 | **4.17:1** | ❌ (= **F-1**) |

(These all **pass** in dark mode at 5–8:1; it is a light-mode-specific systemic gap.)

**Builder-state PASالسES (sampled & confirmed):** body #000/#fff 21:1; `dc-red-text` on white 5.67:1; `text-secondary` .78 on white 5.62:1 (D-3 deviation — sound); `muted-foreground` 5.07:1; dark `text-secondary` 6.36:1; dark active tab 5.04:1. `text-tertiary` (1.72/2.27:1) is below AA but **WCAG-exempt** (disabled/placeholder) — **M-3**: never bind it to meaningful text.

The Builder's contrast evidence only sampled neutral-background pairs and **never checked the component variants**, so all of the above shipped unflagged — despite §2.4 ("run a contrast checker on **every** pair") and §9 ("contrast is an acceptance criterion, not polish"). PLAN criterion #3 was marked ✅ but is false for these pairs.

---

## 4. A11y, design fidelity, tokens (Builder handoff)

- **Keyboard & focus — PASS.** `:focus-visible` renders a 2px `--dc-red` ring + white offset (box-shadow verified). Bottom tab bar = four real `<Link>`s, correct tab order, `aria-current="page"`, `aria-label="Primary"`, icons `aria-hidden`. Dialog (Radix): focus-trap, `aria-labelledby`, **Esc closes**, **focus restored to trigger** (all verified live). Form demo: `<Label htmlFor>`, `aria-invalid`, `aria-describedby`, `role="alert"`.
- **Light/dark parity — PASS.** Forced-dark preview resolves the chained shadcn tokens correctly (the Builder's `DARK_VARS` resolved-channel workaround is right) and matches true OS-dark one-to-one (computed styles + full-page screenshot `sandbox-light-and-forceddark.jpeg`).
- **Alpha modifiers — PASS.** `bg-dc-red/90`, `bg-success/15`, etc. resolve as expected (RGB-channel token design works).
- **Touch targets — PASS.** Tab items 120×59px (≥44pt); buttons `min-h-11/12`; inputs `min-h-11`.
- **Spacing / radii / shadows / type-ramp config — PASS** (definitions correct; the *application* bug is C-1, not the config).
- **m-3 (nit):** `BottomTabBar` uses `min-h-[44pt]` — CSS `pt` (58.7px), not the 44 **px** Apple's "44pt" maps to. Harmless (targets end up larger) but conceptually off; prefer `min-h-11`.
- **m-4 (nit):** `next lint` prints a Next-16 deprecation notice; plan the ESLint-CLI migration.
- **Mascot/TacoGlyph** are intentional O-2 placeholders with stable APIs — defer.

---

## 5. In-flight Fixer changes (observed mid-audit, 16:24–16:27)

A Fixer edited `utils.ts`, `tailwind.config.ts`, `globals.css`, `button.tsx`, `badge.tsx`. I audited these too.

### 5.1 C-1 fix — **CORRECT, verified**
`utils.ts` now uses `extendTailwindMerge`, registering the ramp keys in `font-size` and brand/semantic colors in `text-color`. Direct library test against the new config: primary keeps `text-body-emph` ✅, `sm` keeps `text-white` ✅, badge keeps `text-caption` ✅.

### 5.2 C-2 fix — **CORRECT, verified**
New mode-aware on-light text tokens, bound in `button.tsx`/`badge.tsx`. Recomputed contrast:
`success-text` #166534 on tint **6.33:1** · `warning-text` #854D0E **6.07:1** · `error-text` #C10007 on tint **5.26:1** / on white **6.42:1** · `dc-green-text` #3F6212 **6.36:1** — all **pass**.

### 5.3 A-3 & M-2 — **FIXED, verified**
Dark `--dc-red-text` → #FF6B6B = **7.57:1** on black / 5.02:1 on `#2C2C2E` (tertiary/link now legible in dark). Disabled button now `disabled:bg-fill-quaternary disabled:text-fg-tertiary disabled:shadow-none` — matches §5.10.

### 5.4 F-1 — Fixer **pre-empted the O-2 decision** (flag for design owner)
`Button`/`Badge` now fill with `--dc-red-fill` = **#C32A37** (white-on-fill **5.67:1** ✅). This silently **changes the brand CTA away from #E63946** — a design-owner call (O-2), not purely an a11y fix. The fix is AA-correct and reversible (comment says "revert `--dc-red-fill` to `--dc-red` to restore #E63946"), but the **design owner must ratify** darkening the CTA vs. finalizing a darker brand hex at O-2.

### 5.5 **B-1 — the Fixer broke the build (CRITICAL, live blocker)**
`globals.css:34–37` comment contains `` `bg-*/15` ``; the **`*/` closes the CSS comment early**, leaving `15`)…` as stray tokens. Objective result — fresh `rm -rf .next && next build`:
```
Failed to compile.
./src/app/globals.css:35:18  Syntax error: Unknown word
```
Dev serves **500** on every request. **This is a hard blocker: the project does not build.** Trivial to fix (rephrase the comment so it contains no `*/`, e.g. ``bg-success/15`` or "the /15 tint"), but it **must** be fixed before any sign-off.

### 5.6 A-4 — still NOT fixed
`BottomTabBar` active state remains `text-dc-red` (#E63946) → **4.17:1** for the 11px label in light mode. Same family as F-1. Either bind the active **label** to `dc-red-text` in light mode (keep `dc-red` for the icon, which only needs 3:1 as UI), or accept under the O-2 ruling and log it. State is not color-alone (icon-weight + `aria-current`), but the label's *legibility* still fails AA.

---

## 6. Blockers for the Fixer (must clear before Verifier)

1. **B-1 (CRITICAL):** fix the `globals.css` comment that breaks the build. Re-run `next build` to green.
2. **A-4 (MED):** make the active tab **label** clear 4.5:1 in light mode (or get an O-2 ruling and log it).
3. **F-1 / O-2 (DEFER → design owner):** ratify the `--dc-red-fill` #C32A37 CTA (or finalize a darker brand red). Document the decision in PHASE_LOG.
4. **M-1 (Phase 2/3):** import `env.ts` at a startup boundary so fail-fast actually guards boot.

**Already fixed & independently verified — re-confirm after B-1 is cleared:** C-1, C-2, A-3, M-2.

**Re-test gate:** `tsc` + `lint` + **green `next build`**, then in `/_sandbox` confirm computed font-sizes (button 17/13px, badge 11px, sm button white) and recompute the C-2/A-4 pairs in light **and** forced-dark.

---

## 7. Gate decision

```
Auditor  ❌ NOT approved.
  • Builder handoff: 2 HIGH (C-1, C-2) + A-3 + M-2 + A-4, plus F-1 (defer).
  • Current tree:    C-1/C-2/A-3/M-2 fixed & verified, BUT B-1 (build-breaking) is LIVE,
                     and A-4 + F-1/O-2 remain.
  → Return to Fixer. Re-audit required. Only the Verifier may set Phase 1 ✅ Verified (PLAN §6).
```

The architecture is right and most defects are already correctly fixed — but a tree that **does not build** cannot pass, and the active-tab label + the brand-CTA (O-2) decision are still open.

---

## 8. Method (reproducible)
- `tsc` / `next lint` / `prettier --check`; `next build` ×5 (clean) + ×1 on current tree; `next start` + `curl /`, `/_sandbox`, `/dashboard`.
- `grep .next/static/**` for server secrets.
- Transpiled & executed `env.ts` under cleared / malformed / valid env.
- Computed **every** WCAG pair in Node from `globals.css` values (Builder + Fixer tokens).
- **Direct `tailwind-merge` tests** (stock vs. the Fixer's `extendTailwindMerge`) against the exact component class strings — settles C-1 independent of any dev-server cache.
- Isolated headless Chrome (own profile + 9222) for computed styles, forced-dark parity, focus-visible, dialog keyboard/Esc/focus-restore, tap sizes, console; user's Chrome untouched. Screenshot: `sandbox-light-and-forceddark.jpeg`.

*Audited independently and hostilely per PLAN.md §6.*
