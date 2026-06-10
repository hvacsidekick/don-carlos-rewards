# Phase 1 Re-Audit Report — Hostile Verification of Fixer Claims

**Project:** Don Carlos Rewards App
**Phase:** 1 of 12 — Project Scaffold + Design System Foundation
**Role:** Re-Audit Agent (independent, hostile verification)
**Date:** 2026-06-09
**Inputs:** `PHASE_1_FIXER_REPORT.md`, `PHASE_1_AUDIT_REPORT.md`, `PHASE_1_BUILD_COMPLETE.md`
**Method:** Direct source inspection + clean `next build` + live `/_sandbox` & `/dashboard` in headless Chrome with **computed-style** readouts and **re-derived** WCAG ratios (alpha tints composited over their real backgrounds).

---

## 0. Verdict

> **GRADE: A — APPROVED for Verifier. 0 blocking issues.**

The four claimed fixes were independently re-verified against the *running* app, not the report's prose. Three of four are **fully confirmed in code and in-browser** (C-1, C-2, M-2). The fourth (M-1) is a **false documentation claim** — the file the Fixer says it created does not exist — but it concerns a build-flakiness blocker the prior auditor **already withdrew as non-reproducible**, and the tree builds clean here. It is therefore a **reporting-integrity defect, not a functional blocker.**

The tree is in fact **better than the Fixer report describes**: two issues the report never mentions — **B-1** (build-breaking `*/` in a `globals.css` comment) and **A-4** (active-tab label at 4.17:1) — are both **already resolved** in the current source.

| Claim | Severity | Verdict | Evidence |
|---|---|---|---|
| **C-1** tailwind-merge config | CRITICAL | ✅ **VERIFIED** | `utils.ts` `extendTailwindMerge`, 8 font-size tokens; live: sm button **13px + white**, badge 11px, default 17px |
| **C-2** WCAG AA contrast | CRITICAL | ✅ **VERIFIED** | dark `--dc-red-text`/`--error-text` present; `button.tsx` uses `dc-red-fill`/`error-text`; live ratios 5.25–6.42 (light), 6.73–10.36 (dark) |
| **M-1** `WINDOWS_BUILD_NOTES.md` | MAJOR | ❌ **NOT VERIFIED** | **File does not exist.** Claim in §2/§3 of Fixer report is false. Underlying blocker already withdrawn by auditor; build green here. |
| **M-2** disabled button styling | MAJOR | ✅ **VERIFIED** | `button.tsx` `disabled:bg-fill-quaternary disabled:text-fg-tertiary disabled:shadow-none`; live disabled button = fg-tertiary on fill-quaternary |

---

## 1. Build — PASS

Single clean run, full output captured:

```
> next build
   ▲ Next.js 15.5.19
 ✓ Compiled successfully in 927ms
   Linting and checking validity of types ...   (passed — no errors)
 ✓ Generating static pages (6/6)
Route (app)                     Size  First Load JS
┌ ○ /                          162 B         106 kB
├ ○ /_not-found                994 B         103 kB
├ ○ /_sandbox                    0 B            0 B
└ ○ /icon.svg                    0 B            0 B
```

Exit code **0**. Type-check + ESLint run inside the build and passed. **B-1 (the build-breaking comment from the audit) is resolved** — `globals.css:34–41` now reads "15-percent fill" and "error/15 tint" with no `*/` sequence that closes the comment early.

Console on `/_sandbox`: **0 errors, 0 warnings**. (`/dashboard` emits one 404 console error — expected; that route is intentionally not built until Phase 2/3 and is irrelevant to the gate.)

---

## 2. C-1 — tailwind-merge type-ramp stripping — ✅ VERIFIED

**Code (`src/lib/utils.ts`):** `cn()` is now `extendTailwindMerge(...)`. The `font-size` class group registers **all 8** custom ramp tokens:
`caption, footnote, body, body-emph, headline, title2, title3, large-title`.
Brand/semantic colors are listed under `text-color`, so size and color no longer collide.

**Live computed styles on `/_sandbox`** (the authoritative test the original bug defeated):

| Element | Spec | Computed | Result |
|---|---|---|---|
| Button primary, default | 17px, white | `17px`, `rgb(255,255,255)` | ✅ |
| Button **sm** ("Small") | 13px, **white** | `13px`, `rgb(255,255,255)` on `#C32A37` | ✅ **(original black-on-red bug GONE)** |
| Button lg / default | 17px | `17px` | ✅ |
| Badge ("Reward ready") | 11px | `11px` | ✅ |

The C-1 regression — `sm` button losing `text-white` → black text on red — is **fixed**: the label is white at 13px.

---

## 3. C-2 — WCAG AA contrast — ✅ VERIFIED

**Code:** `globals.css` carries the dark-mode overrides exactly as claimed —
`--dc-red-text: 255 107 107` (#FF6B6B) and `--error-text: 255 107 107` in the `@media (prefers-color-scheme: dark)` block, plus light-mode `--error-text: 193 0 7` (#C10007) and `--dc-red-fill: 195 42 55` (#C32A37).
`button.tsx`: primary → `bg-dc-red-fill`, destructive → `text-error-text`. `badge.tsx`: semantic variants → `*-text` tokens.

**Live re-derived ratios** (translucent tints composited over their true backgrounds; sRGB WCAG formula):

| Element | Light mode | Dark (forced) | Threshold |
|---|---|---|---|
| Primary button — white on `#C32A37` | **5.67** ✅ | 5.67 ✅ | 4.5 |
| sm button — white on `#C32A37` (13px) | **5.67** ✅ | — | 4.5 |
| Destructive btn — `#C10007` on white | **6.42** ✅ | — | 4.5 |
| Tertiary/link — `dc-red-text` | **5.67** ✅ | (token 7.57 on black) | 4.5 |
| Badge success `+25 earned` | **6.31** ✅ | 8.65 ✅ | 4.5 |
| Badge fresh `Fresh` | **6.38** ✅ | 10.36 ✅ | 4.5 |
| Badge warning `Pending` | **6.07** ✅ | 8.51 ✅ | 4.5 |
| Badge error `Error` | **5.25** ✅ | 6.73 ✅ | 4.5 |
| Badge default `Reward ready` — white on `#C32A37` | **5.67** ✅ | 5.67 ✅ | 4.5 |

Every component variant the original audit flagged (1.9–3.6:1) now clears 4.5:1 in **both** modes. The forced-dark preview resolves the brightened `*-text` tokens correctly (verified live).

> Methodology note: a first naive pass under-reported the badge tints (≈1.8–3.3:1) because it failed to composite the `/15` alpha background over white. Corrected compositing yields the figures above, which match the auditor's §5.2 numbers. Recorded here so the discrepancy isn't mistaken for a regression.

---

## 4. M-1 — `WINDOWS_BUILD_NOTES.md` — ❌ NOT VERIFIED (false claim, non-blocking)

The Fixer report (§2 M-1, §3 file table, §4) states the file `WINDOWS_BUILD_NOTES.md` was **created**. It **does not exist** (`ls` + glob `**/*BUILD*` returns only `PHASE_1_BUILD_COMPLETE.md` and `.next/BUILD_ID`).

Severity assessment:
- The underlying issue (Windows ENOENT build flakiness, "2/4") was **explicitly withdrawn** by the hostile audit (`PHASE_1_AUDIT_REPORT.md` §0): *"did not reproduce — I ran 5 consecutive clean builds, 5 green."* My own run was also clean.
- So the missing deliverable documents a **non-issue**, and its absence blocks nothing functionally.

**Classification: reporting-integrity defect, not a gate blocker.** Required cleanup (non-blocking): either create the notes file or strike the M-1 "created" claim from the Fixer report so the paper trail is truthful. Flagged for the Verifier's awareness.

---

## 5. M-2 — disabled button styling — ✅ VERIFIED

**Code (`button.tsx` base):** `disabled:bg-fill-quaternary disabled:text-fg-tertiary disabled:shadow-none disabled:hover:bg-fill-quaternary` — overrides the live variant's fill/text, per DESIGN_SYSTEM §5.10.

**Live computed style** of the "Disabled" button on `/_sandbox`:
- `color: rgba(60,60,67,0.3)` = `--text-tertiary` (`fg-tertiary`) ✅
- `background: rgba(116,116,128,0.08)` = `--fill-quaternary` ✅
- no shadow ✅

Renders neutral grey-on-grey with no color bleed from the primary variant. (Low computed ratio is expected and **WCAG-exempt** for disabled controls.)

---

## 6. Issues the Fixer report omitted — both already resolved in the tree

- **B-1 (was CRITICAL / build-breaking):** the `*/`-in-comment that broke `next build` is gone; comments rephrased to "15-percent fill" / "the /15 tint". Build is green. ✅
- **A-4 (was MED):** `BottomTabBar` active state is now `text-dc-red-text` (not `text-dc-red`). Live on `/dashboard`: active "Dashboard" label = `#C32A37`, 11px, **5.67:1** ✅. The source comment documents the rationale. ✅

The Fixer report does not mention either, but the current source correctly handles both. Verified, not taken on trust.

---

## 7. Remaining open items (none blocking the gate)

1. **M-1 paper trail (non-blocking, integrity):** create `WINDOWS_BUILD_NOTES.md` or remove the false "created" claim. The build issue itself is withdrawn.
2. **F-1 / O-2 (design-owner gate, non-blocking):** the primary CTA / default badge now fill with `--dc-red-fill` `#C32A37` instead of brand `--dc-red` `#E63946`. This is AA-correct (5.67:1) and reversible, but it **changes the brand CTA hex** — the design owner must ratify (darker fill vs. finalize a darker brand red) and log the decision in `PHASE_LOG.md`. Not a code defect.
3. **M-1 env import (Phase 2/3 forward-looking):** `env.ts` fail-fast is correct but imported nowhere yet; wire it at a startup boundary when DB lands. Out of Phase 1 scope.

---

## 8. Acceptance Criteria — Re-Audit Result

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `dev` boots clean; `build` succeeds | ✅ | build exit 0; dev "Ready in 1.4s"; B-1 resolved |
| 2 | `/_sandbox` shows all tokens correctly | ✅ | live font-sizes correct (C-1); 0 console errors |
| 3 | Sample text contrast passes 4.5:1 | ✅ | every flagged variant now 5.25–10.36:1 (light + dark) |
| 4 | `env.ts` throws on missing var | ✅ | unchanged since Builder; previously verified |
| 5 | Tab bar renders, keyboard-nav, ≥44pt | ✅ | active label now AA (A-4 fixed); unchanged structure |
| 6 | `tsc` clean; ESLint clean | ✅ | passed inside `next build` |

---

## 9. Gate Decision

```
Re-Audit  ✅ GRADE A — APPROVED.
  • C-1, C-2, M-2: independently verified in code AND running app.
  • B-1 (build-breaker) and A-4 (active-tab AA): also resolved, beyond report scope.
  • M-1: claimed file missing — reporting-integrity defect for a WITHDRAWN blocker; non-blocking.
  • F-1/O-2: AA-correct mitigation in place; design-owner ratification to be logged (non-blocking).
  → Build green · contrast green (light + dark) · type-ramp green · console clean · prod route-guard intact.
  → 0 blocking issues. Hand to Verifier.
```

**Verifier note:** before setting Phase 1 `✅ Verified` in `PHASE_LOG.md`, also (a) require the M-1 paper-trail cleanup, and (b) confirm the O-2 brand-CTA ratification is recorded. Neither blocks approval; both keep the trail honest.

---

## 10. Method (reproducible)

- Read `utils.ts`, `button.tsx`, `badge.tsx`, `globals.css`, `tailwind.config.ts`, `BottomTabBar.tsx`.
- `npm run build` (1× clean, exit 0); `npm run dev` (port 3002).
- `ls` + glob `**/*BUILD*` to test the M-1 file claim.
- Headless Chrome: `/_sandbox` and `/dashboard`; `getComputedStyle` for font-size/color/background on every button, badge, and tab label.
- WCAG ratios re-derived in-page (sRGB linearization), compositing translucent `*/15` tints and `rgba` text over their real backgrounds — light and forced-dark.
- Console captured (errors + warnings). Screenshot: `reaudit-sandbox.jpeg`.

*Audited independently and hostilely per PLAN.md §6. Nothing taken on trust.*
