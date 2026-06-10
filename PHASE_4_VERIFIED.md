# Phase 4 — Rewards Card UI — VERIFICATION REPORT

**Role:** Phase 4 Verifier (independent — sole authority to mark `✅ Verified`)
**Date:** 2026-06-10
**Verdict:** **✅ VERIFIED** — no blockers. All four Auditor defects (1 MAJOR + 3 MINOR) re-verified closed against the actual source; N-1 deferral accepted; build/typecheck/lint gates green; no regressions found in the previously-verified-good properties.

I did not trust the Builder/Auditor/Fixer self-reports — every claim below was re-checked against the current source tree and (for m-2) the migration SQL.

---

## 1. Build gates (re-run from scratch on a clean `.next`)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `rm -rf .next && npx tsc --noEmit` | **exit 0** (`TSC_EXIT: 0`) |
| Lint | `npm run lint` | **exit 0** — `✔ No ESLint warnings or errors` (only the informational Next 16 `next lint` deprecation notice) |
| Build | `npm run build` | **exit 0** on a clean run — full route table below |

**Build route table (verbatim, from a clean exit-0 run):**
```
Route (app)                                 Size  First Load JS
┌ ƒ /                                      162 B         106 kB
├ ƒ /_not-found                            994 B         103 kB
├ ƒ /_sandbox                                0 B            0 B
├ ƒ /auth/auth-code-error                  162 B         106 kB
├ ƒ /auth/callback                         133 B         103 kB
├ ƒ /auth/confirm                          133 B         103 kB
├ ƒ /dashboard                           44.7 kB         256 kB
├ ƒ /forgot-password                     3.14 kB         142 kB
├ ○ /icon.svg                                0 B            0 B
├ ƒ /login                               1.09 kB         218 kB
├ ƒ /profile                             6.04 kB         162 kB
├ ƒ /reset-password                      2.93 kB         142 kB
├ ƒ /signup                              1.02 kB         218 kB
└ ƒ /verify-email                         3.6 kB         204 kB
+ First Load JS shared by all             102 kB
ƒ Middleware                              104 kB
```
`/dashboard` (the Phase 4 rewards screen) is `44.7 kB / 256 kB`, framer-motion-dominated — matches the Auditor's and Fixer's reported figures. The pre-existing `@supabase/ssr` Edge `process.version` warning originates in `lib/supabase/middleware.ts` (Phase 3), not Phase 4.

### Build-gate honesty note (Windows Defender ENOENT race — environment, NOT a Phase 4 defect)

On this Windows host, `npm run build` is **intermittent**: it reliably **compiles successfully** (`✓ Compiled successfully`) and generates all 16 static pages (`✓ Generating static pages (16/16)`), but the post-compilation **"Collecting page data / build traces"** phase sometimes aborts with `PageNotFoundError: ENOENT` on Next-internal page modules. Across 6 attempts I observed the failure rotate across *different* pages (`/_document`, `/`, `/signup`, `/auth/callback`, `/_not-found`) — a deterministic source error would always fail on the **same** page; a rotating ENOENT in the trace/finalize phase is a filesystem race. This is exactly the issue documented in `WINDOWS_BUILD_NOTES.md` (§1: Windows Defender briefly holds a handle on a just-written `.next` file; Linux/CI unaffected) and confirmed/withdrawn as non-source across Phases 1–3.

**Resolution:** ran clean rebuilds — **2 of 3** consecutive attempts exited **0** with the full route table above (the 3rd hit the race on `/_not-found`). The documented Defender-exclusion mitigation (`npm run win:defender-exclude`) requires admin self-elevation and could not be applied non-interactively in this environment. A clean exit-0 build is reproducible on this host and is the source of the route table above. **Not a blocker** — carry-forward: bank one literal CI/Linux build (or a Defender-excluded Windows run) as the canonical release-artifact proof.

---

## 2. Per-defect re-verification (read the code, not the report)

### M-1 (MAJOR, a11y) — count-up SR spam — ✅ CLOSED (verified strict)

`src/components/rewards/RewardsCard.tsx:209–224`:
- The animating digits node is `aria-hidden="true"` and renders `formatPoints(displayBalance)` — `displayBalance` is the per-RAF tween from `useCountUp` (line 104, `setDisplay` every frame, lines 56–61). Hidden from the a11y tree, so the per-frame integers ("12","27","41"…) are **never** announced.
- A separate visually-hidden live region announces only the **settled** value:
  ```tsx
  <span className="sr-only" aria-live="polite" role="status">
    {formatPoints(balance)} points
  </span>
  ```
  It is bound to `balance` (React state, set **once per real change** via `setBalance(next)` in `applyBalance`, line 146), **not** `displayBalance`. So one announcement per actual balance change, not per frame.
- **No double-announcement:** the static "points" `<p>` label is `aria-hidden="true"` (line 222) because the unit is already in the live-region text ("70 points"). The animating digits are `aria-hidden`. The live region is the single announcer.
- **Reduced motion:** `useCountUp` short-circuits to `setDisplay(target)` instantly (lines 47–50); the live region still fires once — correct.

This is the defect that previously failed in Phase 3's analogous strictness test; here it is genuinely fixed by construction. (Live VoiceOver/TalkBack sweep is the Phase 11 SR pass; the binding is provably correct in source.)

### m-2 (MINOR) — `isInsufficientBalance` over-broad → ✅ CLOSED (cross-checked vs migration)

`src/actions/rewards.ts:44–47`:
```ts
function isInsufficientBalance(error: { code?: string; message?: string }): boolean {
  if (error.code === "P0001") return true;
  return (error.message ?? "").toLowerCase().includes("insufficient balance");
}
```
No longer matches any message containing `"balance"`. Cross-checked the RPC source `supabase/migrations/20260610011444_points_functions.sql` (`redeem_points`, lines 49–76): the **only** `P0001` raise in that function is
```sql
raise exception 'insufficient balance' using errcode = 'P0001';   -- line 75
```
The function's other raises use distinct SQLSTATEs — `42501` ('auth required', line 58) and `22023` ('invalid amount', line 61) — both of which the action **pre-guards** (`getUser()` at line 61; `redeemThresholdSchema` at line 76). So `P0001` ≡ insufficient-balance for this function. **Unrelated errors fall through** to the generic message ("We couldn't redeem your reward. Please try again.", line 87). Confirmed no `any` (typed `{ code?; message? }`). The `!data` null-row fallback (lines 92–94) remains as belt-and-suspenders.

### m-3 (MINOR) — stamp grid fit / geometry consistency → ✅ CLOSED + documented

`src/components/rewards/StampGrid.tsx:55–63`: `stampSize` default **36px** (line 36), `gap: 10` (line 62), with an inline comment recording the ring-fit geometry. `src/components/rewards/RewardsCardSkeleton.tsx:20`: `grid-cols-5 gap-2.5` (10px) with `size-9` (36px) stamps — **grid and skeleton match** (36px/10px both), so no layout shift on data arrival. Re-derived the geometry independently: ring inner diameter = 260 − 8px stroke = **252px**; the 5×2 grid is a rectangle inscribed in the inner circle, so the binding constraint is its **diagonal ≤ 252px**. Spec 40px/12px → 248×92 bbox, diagonal ≈ **264.5px** > 252 → **clips the arc**. Chosen 36px/10px → 220×80, diagonal ≈ **234.1px** → fits with ~18px clearance. The deviation is real, internally consistent, and justified. Transcribed to PHASE_LOG below.

### m-4 (MINOR, correctness/privacy) — dashboard tx peek scoped to user → ✅ CLOSED

`src/app/(user)/dashboard/page.tsx:51`: the recent-activity query now has `.eq("user_id", user.id)` (with an inline comment explaining the admin-read-all defense-in-depth). `user.id` is in scope (the page narrows on `if (!user) return null`, lines 37–39). An admin viewing their own dashboard now sees only their own activity, never the global feed. RLS still backstops; this is defense-in-depth + UX correctness.

---

## 3. Regression check — previously-verified-good properties still hold

Re-confirmed from source on the post-Fixer tree:

- **Rewards math (`lib/rewards.ts`):** untouched by the Fixer; eligible branch clamps to one full cycle (`within=threshold, filled=stamps, percent=100, toNext=0`); below-threshold `filled = min(stamps, floor(within/threshold*stamps))` and `percent` derive from the same `within` → internally consistent. No card-lies path.
- **Redeem trust boundary (`actions/rewards.ts`):** takes **no client amount**; redeems exactly the server-read `redeem_threshold`; identity via `getUser()` (revalidates JWT); RLS-bound server client (no service-role); Zod-validates the config value before the RPC. Sound — only the error matcher changed (m-2), trust boundary intact.
- **Realtime subscribe/cleanup + RLS gating:** `RewardsCard.tsx:152–176` — channel filter `id=eq.${initialProfile.id}`, `removeChannel(channel)` in effect cleanup, stable memoized client. RLS `profiles_select_own` (`auth.uid()=id`) gates delivery.
- **Celebrate-exactly-once across redeem→re-earn + reduced-motion:** `celebratedRef` seeded `true` when mounting eligible (no replay on refresh), fires only on upward crossing `next>=th && prev<th && !celebrated`, re-armed only when balance drops below threshold. Optimistic-echo guard: `applyBalance` early-returns on `next===prev` (line 111) → no double stamp/celebration. Reduced motion → toast instead of confetti.
- **Zero/loading/error states:** zero → mascot welcome (`RewardsCard.tsx:226–232`, `dashboard/page.tsx:69–77`); loading → route `loading.tsx` + `RewardsCardSkeleton` (matching 36px/10px footprint); error → inline `role="alert"` in `RedeemDialog.tsx:98–105`, balance untouched on failure.
- **Dark-mode tokens:** token-only across ring (`var(--separator)` / `rgb(var(--dc-red))`), stamps, card (`bg-surface-tertiary`, `dark:shadow-card-hero-dark`). No hardcoded `#fff`/`#000`.
- **No service-role leak:** grepped `src/components/rewards/**` for `SERVICE_ROLE` / `service-role` / `service.ts` → **no matches**. The Phase-4 client chain imports only `lib/supabase/client` (anon browser) and the action imports `lib/supabase/server` (RLS). Build succeeded; `/dashboard` bundle is framer-motion-dominated, no server-only leak.

No regression introduced by any of the four fixes.

---

## 4. N-1 deferral decision — ACCEPTED

`tailwind.config.ts:145–153` — the eligible-CTA `glow-pulse` keyframe animates `box-shadow`, a literal violation of DESIGN_SYSTEM §7.4 ("animate only transform/opacity"). The Fixer deferred it. **Accepted as reasonable:** it is an idle, infinite animation on one small element, off the input-latency path, and is provably killed under reduced motion by the global CSS safeguard in `globals.css:158–167` (`animation-duration: 0.01ms !important` + `animation-iteration-count: 1 !important` on `*`). Impact is negligible and the proper fix (opacity-animated glow sibling) edges into the refactor territory the Fixer brief fences off. Deferred to Phase 11 (perf/a11y polish).

---

## 5. Acceptance-criteria table (PLAN.md §Phase 4)

| # | Criterion | Verdict | Evidence / Note |
|---|-----------|---------|-----------------|
| 1 | Ring + stamps reflect real `points_balance` and `rewards_config` threshold | **PASS** | `dashboard/page.tsx` fetches `profiles` + `rewards_config(id=1)`; all geometry via `progressToNextReward(balance,cfg)`. No magic numbers (`FALLBACK_CONFIG` only as a safety default). |
| 2 | CTA disabled below threshold; enabled at/above; redeem decrements + logs via Phase-2 fn | **PASS** | `disabled={!progress.eligible}` on trigger + `disabled={pending \|\| !eligible}` on confirm; `redeemPointsAction → rpc("redeem_points")` returns the appended `transactions` row. |
| 3 | Reaching threshold plays celebration exactly once | **PASS** | `celebratedRef` upward-crossing guard, re-armed only below threshold, seeded on eligible mount. Reduced-motion → toast. |
| 4 | Points added server-side update card live within ~1s | **PASS (wiring) / environment-gated (live ~1s timing)** | Subscription filter `id=eq.<uid>`, `removeChannel` cleanup, RLS-gated. End-to-end ~1s timing needs a live browser + Phase 5 scan → deferred to Phase 5/11. |
| 5 | ~60fps; reduced-motion disables non-essential motion | **PASS (by construction) / device 60fps gated** | Only transform/opacity/`strokeDashoffset` animated (one box-shadow nit, N-1, killed under RM); `useReducedMotion()` everywhere + global CSS. On-device 60fps profile is Phase 11. |
| 6 | Dark mode correct; keyboard + SR accessible (ring aria progress, redeem labeled) | **PASS** | Token-only dark mode; ring `role="progressbar"`+`aria-valuenow/min/max`; redeem labeled; Radix dialog focus-trap/Esc/restore; **M-1 fixed** → live region announces settled balance once. Full SR sweep is Phase 11. |
| 7 | Pixel-quality matches DESIGN_SYSTEM RewardsCard spec | **PASS (with documented deviations)** | Matches anatomy (260px ring, stroke 8, rounded caps, 12-o'clock clockwise, 5×2 grid, title2/700/tabular-nums balance, status line, CTA). Documented deviations: stamp 36px/gap 10px vs spec 40px/12px (m-3, ring-fit geometry); TacoGlyph/Mascot placeholders (O-2 brand assets). |

**Verifiable-now: 5/7 fully PASS; 2/7 PASS-with-environment-gated-residue** (#4 live ~1s timing → Phase 5/11; #5 on-device 60fps → Phase 11). No criterion FAILS. Haptics + full screen-reader device sweep are environment-gated to Phase 11 per the honest caveats above.

---

## 6. Sign-off

**Phase 4 — Rewards Card UI: ✅ VERIFIED (2026-06-10).**

All four Auditor defects (M-1 MAJOR + m-2/m-3/m-4 MINOR) re-verified closed against the actual source and (for m-2) the migration SQL. N-1 deferral accepted (negligible, reduced-motion-safe). No regressions in rewards math, redeem trust boundary, realtime, celebrate-once, states, dark mode, or secret hygiene. Build/typecheck/lint gates green (build exit-0 reproducible; the intermittent ENOENT is the documented Windows Defender trace-collection race, not Phase 4 source). Acceptance criteria: 5/7 full PASS, 2/7 PASS with environment-gated residue (live realtime timing, on-device 60fps, haptics, full SR sweep → Phases 5/11). No blockers.

**Phase 5 (QR System) is unblocked** (its dependency on Phase 4 is satisfied).

— Phase 4 Verifier
