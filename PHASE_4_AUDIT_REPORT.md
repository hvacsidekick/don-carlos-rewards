# Phase 4 — Rewards Card UI — AUDIT REPORT (hostile, independent)

**Auditor:** Phase 4 Auditor (independent of Builder)
**Date:** 2026-06-10
**Verdict:** **A− · APPROVED** (above the B+ bar). All blocking concerns clear; defects below are deferrable polish except one MAJOR a11y item that should be fixed before Verified-final but does not break functionality or security.

The build is genuinely high quality: rewards math is correct across the edge cases I probed, the redeem trust boundary is sound (no client-writable points, no client amount, `getUser()` identity, server-derived threshold), realtime is correctly filtered + RLS-gated + cleaned up, and the celebrate-once lifecycle survives the redeem→re-earn / refresh-while-eligible cases. The defects are concentrated in design-spec fidelity nits and one screen-reader spam issue.

---

## 1. Build gates (re-run by the Auditor, not trusted from the report)

All three gates pass on a clean `.next`. Notably the Builder's claimed "Windows ENOENT build flakiness" did **not** reproduce — `npm run build` exited 0 cleanly on first run.

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `rm -rf .next && npx tsc --noEmit` | **exit 0** (`TSC_EXIT: 0`) |
| Lint | `npm run lint` | **exit 0** — `✔ No ESLint warnings or errors` (only the informational Next 16 `next lint` deprecation notice) |
| Build | `npm run build` | **exit 0** — 16/16 static pages generated; `/dashboard` dynamic (ƒ), First Load JS 256 kB (framer-motion dominated) |

Build route table (verbatim relevant rows):
```
├ ƒ /dashboard                           44.7 kB         256 kB
ƒ Middleware                              104 kB
BUILD_EXIT: 0
```
Pre-existing `@supabase/ssr` Edge `process.version` warning originates in `lib/supabase/middleware.ts` (Phase 3), not Phase 4.

---

## 2. Per-acceptance-criterion PASS/FAIL (PLAN.md §Phase 4)

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Ring + stamps reflect real `points_balance` and `rewards_config` threshold | **PASS** | `dashboard/page.tsx` fetches `profiles` + `rewards_config(id=1)`; all geometry via `progressToNextReward(balance,cfg)` in `lib/rewards.ts`. DB config confirmed: threshold=100, stamps=10, value=$10. No magic numbers. |
| 2 | CTA disabled below threshold; enabled at/above; redeem decrements + logs via Phase-2 fn | **PASS** | `RewardsCard.tsx:244` `disabled={!progress.eligible}`; `RedeemDialog` confirm `disabled={pending \|\| !eligible}`. `redeemPointsAction` → `rpc("redeem_points",{pts})`; RPC verified `proretset=false` returns single `transactions` row; `data.points_balance_after`/`data.id` valid. |
| 3 | Reaching threshold plays celebration exactly once | **PASS** | `celebratedRef` (RewardsCard.tsx:97-143). Fires only on upward crossing `next>=th && prev<th && !celebratedRef`; seeded `true` when mounting eligible (no replay on refresh); re-armed only when balance drops `< threshold`. Traced redeem→re-earn and refresh-while-eligible: correct. Reduced-motion → toast instead of confetti. |
| 4 | Points added server-side update card live within ~1s | **PASS (wiring) / UNVERIFIED (timing)** | `profiles` confirmed in `supabase_realtime` publication (live DB query). Subscription filter `id=eq.<uid>`, cleaned up via `removeChannel` on unmount. RLS `profiles_select_own` (`auth.uid()=id`) gates delivery — verified via `pg_policy`. End-to-end ~1s timing needs a live browser session (Phase 5 / Verifier) — same honest caveat the Builder flagged; not blocking. |
| 5 | ~60fps; reduced-motion disables non-essential motion | **PASS (by construction)** | Only transform/opacity/`strokeDashoffset` animated; confetti capped 28; `useReducedMotion()` in every animated component + global CSS `@media (prefers-reduced-motion)` zeroing animations. Glow-pulse (box-shadow) is the one exception — see N-1. Device 60fps profile is Phase 11. |
| 6 | Dark mode correct; keyboard + SR accessible (ring aria progress, redeem labeled) | **PARTIAL PASS** | Tokens only, no hardcoded #fff/#000 — dark mode follows token blocks. Ring `role="progressbar"`+aria-valuenow/min/max. Redeem labeled; Radix dialog gives focus-trap/Esc/restore. **But** balance `aria-live="polite"` spams SR frame-by-frame during count-up — **M-1**. |
| 7 | Pixel-quality matches DESIGN_SYSTEM RewardsCard spec | **PARTIAL PASS** | Matches anatomy (260px ring, stroke 8, rounded caps, 12-o'clock clockwise, 5×2 grid, title2/700/tabular-nums balance, status line, CTA). Deviations: stamp 36px not 40px (justified), grid gap 8px not the spec'd 12px (N-2), TacoGlyph is a crude placeholder, Mascot is an emoji placeholder (O-2). |

---

## 3. Severity-tagged defect list

### MAJOR (fix before final Verified; non-blocking for functionality/security)

**M-1 — Balance count-up spams screen readers frame-by-frame**
`src/components/rewards/RewardsCard.tsx:210` — `<p ... aria-live="polite">{formatPoints(displayBalance)}</p>`. `displayBalance` comes from `useCountUp`, which calls `setDisplay` on every `requestAnimationFrame` (~30 updates over 500ms). With `aria-live="polite"` on that node, every intermediate integer ("12", "27", "41"…) is queued for announcement, producing a burst of number-spam on each balance change — exactly the failure the design gate warns about. *Why it matters:* §9 a11y is acceptance, not polish; this actively degrades the SR experience on the signature screen. *Proof:* trace `useCountUp` (lines 40-76) — `setDisplay(Math.round(...))` inside the RAF `tick`, bound to a node with a live region. *Fix direction:* announce only the settled value — drive `aria-live` off `balance` (the target), not `displayBalance`; e.g. render the animated digits with `aria-hidden` and add a visually-hidden `aria-live="polite"` node containing the final `formatPoints(balance)` updated once per change. Under reduced-motion this is moot (count-up is instant) but the live region still fires once, which is correct.

### MINOR (deferrable)

**m-2 — `isInsufficientBalance` over-broad string match**
`src/actions/rewards.ts:32-41` — matches any error message containing `"balance"`. A generic DB/serialization error whose text happens to include "balance" would be misreported to the user as "You don't have enough points." Low real-world likelihood (the RPC's only `balance`-bearing error is the intended `insufficient balance`), and the user impact is a slightly-wrong-but-still-safe message, so MINOR. *Fix:* match on the specific RPC signal (`message.includes("insufficient balance")`) or, better, the SQLSTATE/`code` from the PostgREST error rather than substring-matching free text.

**m-3 — Stamp grid gap is 8px, spec says 12px**
`src/components/rewards/StampGrid.tsx:57` (`gap: 8`) and `RewardsCardSkeleton.tsx:20` (`gap-2`). DESIGN_SYSTEM §5.2 specifies a 12px gap. Combined with the 36px (not 40px) stamps (§5.1), the grid is denser than spec. Defensible to fit inside the 260px ring, but it's an undocumented deviation from the two numbers the spec pins. *Fix:* either bump to 12px or log the deviation in PHASE_LOG with the ring-fit rationale (the Builder only logged the stamp-size change, not the gap).

**m-4 — Dashboard `transactions` peek relies on implicit RLS, no explicit `user_id` filter**
`src/app/(user)/dashboard/page.tsx:46-50` selects last-3 transactions ordered by `created_at` with no `.eq("user_id", user.id)`. RLS (`tx_select_own_or_admin`) correctly scopes this to the user, so it is *secure*. But for an **admin** viewing their own dashboard, RLS lets them read *all* users' transactions, so the "recent activity" peek could surface other customers' rows. *Why it matters:* an admin's personal dashboard would show a global feed, which is wrong UX (and a mild privacy smell in a screenshot). *Fix:* add `.eq("user_id", user.id)` for defense-in-depth + correctness regardless of caller role.

### NIT (cosmetic / future-proofing)

**N-1 — Glow-pulse animates `box-shadow` (violates §7.4 "animate only transform/opacity")**
`tailwind.config.ts:145-148` — the eligible-CTA `glow-pulse` keyframe animates `box-shadow`, which §7.4 explicitly says to avoid (not GPU-composited). It's an idle, infinite animation on a single small element (not on the input-latency path) and is correctly killed under reduced-motion by the global CSS rule, so impact is negligible — but it is a literal violation of the stated motion rule. *Fix (optional):* render the glow as an absolutely-positioned sibling and animate its `opacity`/`transform` instead.

**N-2 — TacoGlyph + Mascot are placeholders**
`TacoGlyph.tsx` is a crude two-path SVG; `Mascot.tsx` renders an emoji. Both are explicitly placeholder-pending O-2 (brand assets) and the public APIs are stable/swappable, so this is acceptable for Phase 4 — flagged only so the Verifier doesn't mistake the rough glyph for "pixel-quality."

**N-3 — `RewardPulse` runs an infinite `scale` animation wrapping the live count-up text**
`RewardsCard.tsx:275-292` — the eligible ring pulse (scale 1→1.06→1) wraps the ring only (not the balance number), animates transform (GPU), reduced-motion safe. No defect; noting it's correctly scoped so it doesn't reflow the tabular-nums balance.

---

## 4. Design-gate verdict — DESIGN_SYSTEM §14 ten-point rubric

| # | Rubric point | Verdict | Note |
|---|--------------|---------|------|
| 1 | Hierarchy (one focal point) | **PASS** | Ring+balance is the clear hero; single h1 (dashboard greeting), card h2, activity h2. |
| 2 | Alignment (4px grid) | **PASS** | Consistent `gap-8`/`mt-6`/`p-6`; gap-8 stamp deviation is the only off-grid-vs-spec item (m-3 is wrong-value, still on grid). |
| 3 | Type discipline (ramp, ≤3 sizes) | **PASS** | title2 balance, headline title, body/footnote support — uses the ramp. |
| 4 | Color restraint (90/10) | **PASS** | Neutral surfaces; red rationed to ring/stamps/CTA; yellow to glow/confetti. |
| 5 | Motion (springy, 60fps, RM-safe) | **PASS** | Springs from `lib/motion.ts`; RM honored everywhere; one box-shadow nit (N-1). |
| 6 | States (loading/empty/error/success) | **PASS** | Route `loading.tsx` + `RewardsCardSkeleton` match footprint; zero-points mascot state; redeem inline error `role="alert"`; success toast/celebration. No dead ends. |
| 7 | Both modes | **PASS** | Token-only; verified mode-aware tokens incl. `--dc-red-text`/`--error-text` brightening in dark block. |
| 8 | Accessibility (§9) | **PARTIAL** | Strong semantics, but **M-1** (count-up live-region spam) keeps this from a clean pass. |
| 9 | Touch (≥44pt) | **PASS** | `Button size="lg"` = `min-h-12` (48px); default `min-h-11` (44px). |
| 10 | Delight (earn/unlock satisfying) | **PASS (by construction)** | Stamp spring + confetti + haptic + ring flourish; rough placeholder glyph/mascot is the only thing between this and genuine wow (O-2). |

**Design gate: 9/10 clean, 1 partial (a11y, driven solely by M-1).**

---

## 5. Security & correctness deep-dive (the hostile probes)

- **Rewards math (`lib/rewards.ts`) — probed by hand, all consistent:**
  - balance 0 → within 0, filled 0, percent 0, toNext 100, eligible false. ✓
  - threshold−1 (99) → within 99, filled `floor(99/100*10)=9`, percent 99, toNext 1, eligible false. ✓ (9 stamps, not yet eligible — correct.)
  - exactly threshold (100) → eligible branch: within 100, filled 10, percent 100, toNext 0. ✓ (clamped display, doesn't wrap — documented deviation, sensible.)
  - multiple (200) → eligible true, full card. ✓ (never shows "0 of 10" for a redeemable user.)
  - non-divisible threshold/stamps (e.g. th=100/stamps=3): filled `min(3, floor(within/100*3))`, ring percent independent of stamps — `filled` and `percent` derive from the same `within`, stay consistent; `filled` clamped to `stamps`. ✓
  - th=7, balance 5 → within 5, filled `floor(5/7*10? )` — with stamps=10, `floor(5/7*10)=7`; percent ~71.4; toNext 2. Internally consistent. ✓
  - negative/absurd config: not defended in `lib/rewards.ts` itself (e.g. threshold=0 → `% 0` = NaN), but the **action** guards via `redeemThresholdSchema` (positive int ≤ 1e6) and the page supplies `FALLBACK_CONFIG`, and the DB has CHECK constraints. The display function trusts config; acceptable since config is admin-only + schema-bounded. No card-lies-about-balance path found.
- **Redeem trust boundary (`actions/rewards.ts`):** takes **no client amount**; redeems exactly the server-read `redeem_threshold`. Identity via `getUser()` (revalidates JWT), not `getSession()`. RLS-bound server client, not service-role. Insufficient-balance handled (string + null-row). Zod validates the config value before the RPC — defense-in-depth, not pure theatre (it guards against a corrupted config reaching the RPC). No way to redeem a non-threshold quantity or redeem for another user. **Sound.**
- **Optimistic redeem vs realtime echo — no double-apply:** after redeem, `onRedeemed(newBalance)`→`applyBalance(10)` sets `prevBalanceRef=10`; the subsequent realtime UPDATE echo `applyBalance(10)` hits `next===prev` → early return (RewardsCard.tsx:110). No fight, no double stamp/celebration. ✓
- **Realtime leak:** `removeChannel(channel)` in effect cleanup; effect deps `[supabase, id, applyBalance]` with a stable memoized client. ✓
- **Celebration-once across cycles:** cannot make it fire twice (guarded by `celebratedRef`, re-armed only below threshold) nor miss a legitimate upward crossing. Refresh-while-eligible seeds `true` → no replay. ✓
- **Secret hygiene:** rewards components/action import only `lib/supabase/server` (RLS client) + `lib/supabase/client` (anon browser). No `service.ts` / `SUPABASE_SERVICE_ROLE_KEY` in the Phase-4 client chain. Build succeeded; `/dashboard` bundle is framer-motion-dominated, no server-only import leak. ✓
- **Realtime migration:** idempotent (`if not exists` guard around `alter publication … add table`). Live DB query confirms `public.profiles` IS in `supabase_realtime`. Migration recorded remotely (apply-time timestamp drift noted by Builder; harmless). ✓
- **DB-verified:** `redeem_points` returns single composite (`proretset=false`) → action's object access is correct; `profiles` SELECT policy `auth.uid()=id` correctly scopes realtime delivery.

---

## 6. Letter grade & verdict

**Grade: A−**
**Verdict: APPROVED** (clears the B+ minimum comfortably).

Rationale: every functional/security acceptance criterion passes with verified evidence; the math is correct on every edge case probed; the trust boundary is genuinely sound; realtime is correctly wired, filtered, RLS-gated, and leak-free. It falls short of a straight A only on (a) the count-up screen-reader spam (M-1) and (b) a cluster of spec-fidelity deviations (gap/stamp size, placeholder assets) and the admin-feed correctness nit (m-4). None are blocking for functionality or security; M-1 should be fixed before the phase is stamped Verified because §9 a11y is acceptance-level.

**Blocking issues:** none.
**Should-fix-before-Verified-final:** M-1 (a11y).

---

## 7. Top-3 priorities for the Fixer

1. **M-1 — Stop the count-up screen-reader spam.** Move `aria-live="polite"` off the per-frame `displayBalance` node; announce only the settled `balance` via a visually-hidden live region (and `aria-hidden` the animating digits). This is the one a11y-acceptance gap.
2. **m-4 — Scope the recent-activity query to the user.** Add `.eq("user_id", user.id)` in `dashboard/page.tsx` so an admin's own dashboard doesn't surface a global transaction feed (correctness + privacy-in-screenshot).
3. **m-2 / m-3 — Tighten + document.** Narrow `isInsufficientBalance` to the specific RPC signal (or use the error `code`), and either restore the 12px stamp gap or log the gap+size ring-fit deviation in PHASE_LOG (only the stamp-size deviation is currently logged).
