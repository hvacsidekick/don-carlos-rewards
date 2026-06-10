# Phase 0 Complete — Master Planning Summary

**Project:** Don Carlos Rewards App — Apple-quality mobile-first PWA for Don Carlos Taco Shop (Arvada, CO)
**Date:** 2026-06-09
**Phase 0 owner:** Master Planning Agent
**Status:** ✅ Planning complete — ready to begin Phase 1

---

## 1. What was produced

| Document | Purpose | Use it for |
|----------|---------|-----------|
| [`PLAN.md`](./PLAN.md) | 13-phase roadmap (0–12) with objectives, acceptance criteria, dependencies, effort, risk register, quality-gate process, rollback strategy | Sequencing work, knowing when a phase is "done," tracking |
| [`BLUEPRINT.md`](./BLUEPRINT.md) | Technical contract: architecture, full SQL schema + RLS + atomic points functions, API/server-action contracts, Zod schemas, realtime, deployment, env matrix, security checklist | Implementing any backend/data/API work |
| [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) | Visual + interaction system: color/type/spacing tokens, component specs (RewardsCard, QR, Menu…), animation catalog, haptics, accessibility, dark mode, the "Apple-quality" rubric | Implementing any UI work |
| `PHASE_0_COMPLETE.md` *(this file)* | Decision summary, first-phase recommendation, open questions | Kickoff + stakeholder sign-off |

> Next agent must create **`PHASE_LOG.md`** at the start of Phase 1 to track Builder→Auditor→Fixer→Verifier status per phase (template in `PLAN.md` §7).

---

## 2. Key planning decisions (and why)

1. **Points are never written by the client.** Every balance change flows through Postgres `SECURITY DEFINER` functions (`add_points`, `redeem_points`, `adjust_points`) that update the ledger and the balance in one transaction. A guard trigger + RLS forbid clients from touching points columns directly. → Eliminates the app's single most dangerous failure mode (balance corruption / fraud).

2. **`transactions` is an append-only ledger; `points_balance` is a derived cache.** Corrections are compensating `adjustment` rows, never edits/deletes. → Auditability + GDPR-friendly + trustworthy money-adjacent data.

3. **Trust boundary is the server, enforced in the database.** Admin authorization checked in Postgres functions AND server actions AND UI — UI hiding is never the control. → Defense in depth.

4. **Opaque, rotatable QR tokens.** QR encodes a `qr_token` UUID, not the user id or any PII; server resolves it. Users can rotate it. → No PII leakage via a screenshot/scan; revocable if compromised.

5. **RSC-first, client islands only for interactivity.** Minimizes shipped JS to hit the performance budget; animation/scanner/forms are the few client components. → Lighthouse ≥90 is realistic.

6. **One source of business rules: `rewards_config`.** Earn rate, redeem threshold ($/points), stamp count all live in one singleton row. → No magic numbers; tunable without redeploy.

7. **Two-layer rewards visualization reconciled.** The 10-stamp card and the 100-point threshold are unified: 1 stamp = 10 points (configurable). → The PLANNING_TASK's "100pts=$10" and "10 stamps" coexist coherently (pending confirmation — O-4).

8. **Design = 90/10 Apple-calm / Don-Carlos-vibrant.** Neutral system canvas with rationed brand color and mascot used only at icon/empty/celebration/error moments. → Achieves "Apple veteran" bar while keeping taco-shop warmth.

9. **Accessibility & dark mode are acceptance criteria, not polish.** A phase isn't done if its UI fails contrast/keyboard/SR/both-modes. → WCAG 2.1 AA is built in, not retrofitted.

10. **Apple Sign-In isolated as a flag.** Email + Google can ship without it; Apple is required for iOS PWA legitimacy but gated behind credentials availability (O-1) so it can't block the critical path.

11. **Phases 7 (Menu) & 8 (About) parallelized** off Phase 1 — no auth/DB dependency — so a second agent can build them concurrently with the auth→rewards→QR chain.

12. **Tokens as CSS variables** so exact brand hex / future rebrands are a one-file change (O-2).

---

## 3. Recommended first implementation phase

### ▶ Phase 1 — Project Scaffold + Design System Foundation (effort: M)

**Why first:** It unblocks everything (every later phase depends on it), it's low-risk, and it bakes the Apple-quality design tokens into the codebase from line one so no later phase reinvents spacing/color/type. It also produces the `/_sandbox` route that makes light/dark + token QA trivial for every subsequent phase.

**Concrete first deliverables (in order):**
1. `create-next-app` (TS, App Router, Tailwind, ESLint, `src/`, alias `@/*`); pin & record Tailwind version.
2. Wire design tokens → `tailwind.config.ts` + `globals.css` light/dark blocks (from `DESIGN_SYSTEM.md` §2–4).
3. `lib/env.ts` (Zod-validated env, fails fast) + `.env.example`.
4. `npx shadcn init` + install base components (button, card, input, form, dialog, sheet, toast/sonner, skeleton, tabs, avatar, badge).
5. Install Framer Motion (+ `lib/motion.ts` presets), Zod + react-hook-form, Supabase libs.
6. Root layout (font stack, viewport — **no** `maximum-scale=1`, theme-color, safe-area), `BottomTabBar` skeleton.
7. `/_sandbox` dev route rendering all tokens + base components in both modes.
8. README + `tsc`/lint clean + `npm run build` green.

**Exit gate:** `PLAN.md` Phase 1 acceptance criteria all checked, verified by an independent Verifier, recorded in `PHASE_LOG.md`. Then start Phase 2 (DB) on the critical path and optionally kick off Phases 7/8 in parallel.

**Suggested immediate sequencing after Phase 1:** 2 (DB+RLS) → 3 (Auth) → 4 (Rewards Card) → 5 (QR) → 6 (History) → 9 (Admin) → 10 (Security) → 11 (PWA/Perf/A11y) → 12 (Deploy), with 7 + 8 running alongside.

---

## 4. Open questions requiring clarification

> None of these block **Phase 1**. They're ordered by when they must be resolved. Defaults are chosen so build can proceed; confirm or override.

| ID | Question | Needed by | Current default / assumption |
|----|----------|-----------|------------------------------|
| **O-1** | Is an **Apple Developer account** available (Service ID + key) for Apple Sign-In? | Phase 3 | Ship email + Google first; Apple behind a flag; required before any iOS App Store / PWA-store submission. |
| **O-2** | Exact **brand hex values, logo, and mascot SVG** (chef + expressions)? | Phase 4 (mascot), polish | Using working palette `#E63946 / #F9C74F / #90BE6D` as CSS vars + placeholder mascot. Swappable in one file. |
| **O-3** | Final **food photography** for the menu? | Phase 7 polish | Seeding with branded placeholders; design degrades gracefully on missing images. |
| **O-4** | Confirm the **rewards model mapping**: 100 points = $10, and 10 stamps per card → **1 stamp = 10 points**? Any "free taco" tiers beyond $10-off? | Phase 4 | 1 stamp = 10 pts; single $10-off tier; `rewards_tiers` deferred. |
| **O-5** | **Google Maps**: keyless Embed iframe (no key exposure) acceptable, or provide a referrer-restricted key? | Phase 8 | Keyless Embed iframe. |
| **O-6** | **Rate-limit store**: Upstash Redis or Vercel KV? | Phase 10 | Pick one before Phase 10; either works. |
| **O-7** | **Scope confirmation**: single location, single staff role (admin vs user), no online ordering/payments in v1? | Phase 9 | Single location; binary admin flag; browse-only menu; no payments. |
| **O-8** | **Supabase project**: create fresh per-environment projects, or use an existing one? Who holds the org/billing? | Phase 2 | Create dev project now; prod project at Phase 12. |
| **O-9** | **Production domain** (custom vs `*.vercel.app`) + who manages DNS? | Phase 12 | `*.vercel.app` unless a custom domain is provided. |
| **O-10** | **Initial admin account(s)** — which email(s) get `is_admin`? | Phase 2/12 | Promote via SQL; default to the project owner's email. |
| **O-11** | **Legal copy** for Privacy Policy & TOS — provided by client/counsel, or generate a standard template for review? | Phase 10 | Generate a reviewed template; flag that legal review is the client's responsibility. |

---

## 5. Risk highlights (full register in `PLAN.md` §5)

- **Critical:** points-balance integrity (R-1) and RLS data isolation (R-2) — mitigated by atomic SECURITY DEFINER functions, client-write-protection, and policy tests every phase + a dedicated Phase 10 audit.
- **High:** Apple Sign-In setup (R-3, see O-1), real-device camera scanning (R-4), service-role key leakage (R-5), CSP breaking third-party libs (R-6), env/OAuth drift at launch (R-9).
- **Medium/asset:** missing brand/photo assets (R-8, O-2/O-3) — handled with swappable tokens + placeholders.

---

## 6. Definition of done (whole project)

The build is launch-ready when: all 13 phases are `✅ Verified` in `PHASE_LOG.md`; the full earn→redeem loop works on a real phone in production; `supabase get_advisors` (security) is clean; the Phase 12 security checklist and Playwright E2E suite pass; Lighthouse ≥90 mobile; WCAG 2.1 AA verified; Privacy Policy + TOS published; account deletion purges data; and the app feels like it could sit on Apple's own home screen.

---

## 7. Handoff

**Next action:** Spawn the Phase 1 Builder agent. Instruct it to:
1. Read `PLAN.md` §Phase 1, `BLUEPRINT.md` §2–3 & §10.1, `DESIGN_SYSTEM.md` §2–4.
2. Create `PHASE_LOG.md`.
3. Execute Phase 1 scope, self-check against acceptance criteria.
4. Hand to an independent Auditor → Fixer → Verifier per `PLAN.md` §6.
5. Only on `✅ Verified`, unblock Phase 2 (and optionally Phases 7/8 in parallel).

No open question blocks Phase 1 — proceed.

---

*Phase 0 complete. The three planning documents are the contract; this summary is the kickoff.*
