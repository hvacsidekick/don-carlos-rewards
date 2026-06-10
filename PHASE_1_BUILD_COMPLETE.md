# Phase 1 Build Complete — Project Scaffold + Design System Foundation

**Project:** Don Carlos Rewards App
**Phase:** 1 of 12 — Project Scaffold + Design System Foundation
**Role:** Builder
**Date:** 2026-06-09
**Status:** ✅ Builder self-check passed — **ready for independent Auditor** (Quality Gate per `PLAN.md` §6)

> This document is the Builder→Auditor handoff. It states exactly what was built,
> the files created, the evidence each acceptance criterion was met, and the open
> items the Auditor/Fixer should focus on. Nothing here may be marked
> `✅ Verified` until an **independent Verifier** confirms it (`PLAN.md` §6).

---

## 1. Summary

A running **Next.js 15 (App Router, RSC)** project with the full Don Carlos
design-token system wired into **Tailwind CSS v3**, **shadcn/ui** base components
installed, system fonts + `media`-based dark mode configured, Zod-validated env
loading, a `BottomTabBar` app-shell skeleton, and a dev-only **`/_sandbox`** route
that renders every token and component in light **and** a forced-dark preview.
`build`, `tsc`, ESLint, and Prettier are all clean.

**Out-of-scope (correctly not built):** any DB calls, auth, or real pages beyond
the shell + sandbox.

---

## 2. Stack & pinned versions (the "Watch" item from PLAN Phase 1)

| Concern | Decision | Why |
|---------|----------|-----|
| **Tailwind** | **v3.4.x (pinned)** | The entire token contract (`tailwind.config.ts` + CSS vars) is authored for the v3 config shape (`BLUEPRINT` §3, `DESIGN_SYSTEM` §2–4). Most stable target for shadcn/ui. |
| **Next.js** | **15.5.19 (pinned, App Router)** | Approved stack is Next 15. `create-next-app@latest` now scaffolds a **Next 16 preview** whose swc binary 404s — unusable. 15.5.19 also patches **CVE-2025-66478** (initial 15.5.4 flagged it). |
| **React** | 19.1.0 | Ships with Next 15; shadcn/Radix compatible. |
| **Dark mode** | `media` | Follows OS `prefers-color-scheme`; no toggle in v1 (`DESIGN_SYSTEM` §10). |
| **Lint/format** | ESLint (`next/core-web-vitals` + `next/typescript` + prettier) · Prettier (+ tailwind plugin) | Strict, no `any`. |

> Scaffold note: `create-next-app` was discarded; the project was hand-built with
> explicit pinned versions for full control over the Next 15 + Tailwind 3 contract.

---

## 3. Files created

### Config (root)
- `package.json` (pinned deps + scripts: dev/build/start/lint/typecheck/format)
- `tsconfig.json` (strict + `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `@/*` alias)
- `next.config.ts` · `next-env.d.ts`
- `tailwind.config.ts` — **design-token contract** (colors, type ramp, spacing, radii, shadows, animations)
- `postcss.config.mjs` (tailwind + autoprefixer)
- `components.json` (shadcn config) · `.eslintrc.json` · `.prettierrc.json` · `.prettierignore`
- `.gitignore` · `.env.example` · `.env.local` (gitignored placeholders) · `README.md`

### App
- `src/app/globals.css` — all CSS custom properties (light + dark), base layer, safe-area utils, reduced-motion safeguard
- `src/app/layout.tsx` — fonts, viewport (no `maximum-scale`), per-mode `theme-color`, `BottomTabBar`, `Toaster`
- `src/app/page.tsx` — calm on-brand landing placeholder
- `src/app/icon.svg` — app/favicon mark
- `src/app/%5Fsandbox/page.tsx` — token + component showcase + forced-dark preview (`/_sandbox`, dev-only)
- `src/app/%5Fsandbox/InteractiveDemos.tsx` — dialog/sheet/dropdown/toast/tabs/form demos (client)

### Components
- `src/components/ui/` — `button`, `card`, `input`, `label`, `dialog`, `sheet`, `dropdown-menu`, `sonner`, `skeleton`, `avatar`, `badge`, `tabs`, `form` (13 shadcn base components, token-styled)
- `src/components/nav/BottomTabBar.tsx` — fixed bottom nav skeleton (Dashboard/Menu/QR/Profile)
- `src/components/common/Mascot.tsx` — **placeholder** (open question O-2), stable API
- `src/components/common/TacoGlyph.tsx` — filled/outline taco stamp glyph

### Lib
- `src/lib/env.ts` — Zod-validated env (fails fast; client schema + lazy server-only schema)
- `src/lib/utils.ts` (`cn`) · `src/lib/motion.ts` (spring presets) · `src/lib/haptics.ts` (guarded) · `src/lib/format.ts`

---

## 4. Design tokens wired (DESIGN_SYSTEM §2–4)

- **Color:** brand `dc-red/yellow/green`, `dc-red-text`, Apple semantic `success/warning/error`,
  surfaces, and the full shadcn semantic set — backed by CSS vars with light/dark blocks.
  Solid colors are RGB channels (`rgb(var(--x) / <alpha-value>)`) so opacity modifiers work;
  mode-aware translucent tokens (separator, secondary/tertiary text, fills) carry alpha inline.
- **Type ramp:** `caption/footnote/body/body-emph/headline/title3/title2/large-title` with the
  HIG sizes, line-heights, weights, and display letter-spacing.
- **Spacing:** Tailwind's 4px base (matches DESIGN_SYSTEM exactly) + `space-18 = 72px`.
- **Radii/elevation:** shadcn `--radius` scale; `card`/`card-hero` shadows with `*-dark` variants.

---

## 5. Acceptance criteria — Builder evidence

| # | Criterion (PLAN Phase 1) | Result | Evidence |
|---|--------------------------|--------|----------|
| 1 | `npm run dev` boots with zero errors/warnings; `npm run build` succeeds | ✅ | dev "Ready in ~1.3s"; build green, 4 static routes |
| 2 | `/_sandbox` displays all tokens correctly in light **and** dark | ✅ | OS-light render + forced-dark preview both correct (screenshotted); **0 console errors/warnings** |
| 3 | Sample text contrast passes 4.5:1 | ✅ | computed-color checker: body #000/#fff = 21:1; secondary text 5.63:1; `dc-red-text` 5.67:1; dark secondary 5.95:1 (see **F-1** for the one borderline pair) |
| 4 | `lib/env.ts` throws a clear error when a required env var is missing | ✅ | ran import with vars unset → threw aggregated message listing each missing key |
| 5 | Bottom tab bar renders, keyboard-navigable, targets ≥ 44pt | ✅ | 4 tabs measured 120×59px (≥59px = 44pt), all `tabIndex ≥ 0` / focusable |
| 6 | `tsc --noEmit` clean; ESLint clean | ✅ | both pass with zero output; Prettier check also clean |

**How to reproduce:** `npm install && npm run build && npm run typecheck && npm run lint`,
then `npm run dev` and open `/_sandbox`.

---

## 6. Items flagged for the Auditor / design owner

- **F-1 (design-gate, NOT fixed):** white text on the primary CTA fill `--dc-red`
  (#E63946) = **4.17:1** — passes AA for large/bold text but is just under 4.5:1
  for the 17px/600 button label. Left as the explicit DESIGN_SYSTEM §5.10 spec
  because the brand hex is provisional (**O-2**). **Ready mitigation:** use the
  existing `--dc-red-text` (#C32A37 → 5.67:1) for solid CTA fills, or finalize a
  slightly darker brand red at O-2. **This is the #1 review item.**
- **D-3 (deviation, applied):** light `--text-secondary` bumped `0.6 → 0.78` alpha
  to clear AA (3.44 → 5.63:1). In the Apple secondary-grey family; logged.
- **Mascot is a placeholder** (O-2) — emoji stand-in with a stable API; swap when
  the real chef SVG + expressions land.
- **TacoGlyph** is a simple interim glyph; Phase 4 builds the animated `StampGrid`.

(Full deviation list D-1…D-3 + F-1 in `PHASE_LOG.md`.)

---

## 7. Readiness for the next role

**Auditor (hostile, independent) — suggested focus:**
1. **Design fidelity:** spacing/hierarchy/type against DESIGN_SYSTEM §14 rubric; the
   90/10 color rule; light + dark parity at `/_sandbox`.
2. **A11y:** resolve/accept **F-1**; re-run a contrast pass on every text/bg pair;
   keyboard pass on the tab bar + interactive demos; focus-visible everywhere.
3. **Correctness:** re-run build/tsc/lint; confirm `env.ts` fail-fast; confirm
   `/_sandbox` is unreachable in a production build; confirm no service-role key
   path exists in client code.
4. **Token system:** verify alpha modifiers (`bg-dc-red/90`) and that the
   forced-dark preview matches true OS dark.

**Downstream:** once **Verified**, Phase 1 unblocks **Phase 2 (DB + RLS)** on the
critical path, and **Phases 7 (Menu)** and **8 (About)** may start in parallel.

---

## 8. Quality gate status

```
Builder   ✅ complete (this document)
Auditor   ⏳ pending (independent invocation)
Fixer     ⏳ pending
Verifier  ⏳ pending  ← only this role may set Phase 1 to ✅ Verified in PHASE_LOG.md
```

*Built strictly within Phase 1 scope. No work pulled forward from later phases.*
