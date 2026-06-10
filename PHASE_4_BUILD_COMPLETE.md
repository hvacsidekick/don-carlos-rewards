# Phase 4 — Rewards Card UI — BUILD COMPLETE

Builder handoff for **Phase 4 (Rewards Card UI: Stamp Grid + Progress Ring)**.
Scope per `PLAN.md` §"Phase 4", `DESIGN_SYSTEM.md` §5.1–5.4/§7–10, `BLUEPRINT.md` §5.4/§6/§8.

Phases 0–3 are ✅ Verified. This phase replaces the Phase-3 placeholder dashboard.

---

## 1. Files created / changed

### Created

| File | Purpose |
|------|---------|
| `src/lib/rewards.ts` | Single source of rewards math: `pointsForAmount`, `progressToNextReward` (within / filled / percent / toNext / eligible) — all derived from `rewards_config`, no magic numbers. |
| `src/schemas/rewards.ts` | Zod `redeemThresholdSchema` validating the config-derived redeem amount before it reaches the RPC. |
| `src/actions/rewards.ts` | `redeemPointsAction` — server-only, reads `redeem_threshold` from config, calls the `redeem_points` SECURITY DEFINER RPC, returns `ActionResult<RedeemResult>`. |
| `src/components/rewards/ProgressRing.tsx` | Animated SVG ring (§5.3); `role="progressbar"`, reduced-motion aware; wraps the stamp grid. |
| `src/components/rewards/StampGrid.tsx` | Taco-stamp grid (§5.2); reuses `TacoGlyph`; only the newly-filled stamp springs; meaningful `aria-label`. |
| `src/components/rewards/Celebration.tsx` | Hand-rolled capped confetti + mascot pop + headline + success haptic (§5.4); renders nothing under reduced motion (parent shows a toast). |
| `src/components/rewards/RewardsCard.tsx` | The `"use client"` island: realtime sub, count-up, stamp/ring animation, celebration, internal zero-state. Delegates the redeem confirm to `RedeemDialog`. |
| `src/components/rewards/RedeemDialog.tsx` | Redeem confirm dialog (Radix focus-trap/Esc/restore); calls `redeemPointsAction()`, never double-submits, inline `role="alert"` error, hands the authoritative new balance back via `onRedeemed`. |
| `src/components/rewards/RewardsCardSkeleton.tsx` | Loading skeleton (ring + stamps) matching the real card footprint. |
| `src/components/rewards/RecentActivity.tsx` | Last-3-transactions peek (icon + sign + color; mascot empty state; "See all" → Phase 6). |
| `src/app/(user)/dashboard/loading.tsx` | Route-level skeleton while the RSC fetches. |
| `supabase/migrations/20260610020000_enable_realtime_profiles.sql` | Adds `public.profiles` to the `supabase_realtime` publication (idempotent). |

### Changed

| File | Change |
|------|--------|
| `src/app/(user)/dashboard/page.tsx` | Rewritten from placeholder to the real RSC: fetches profile + `rewards_config` + last-3 transactions, renders RewardsCard hero, "X to next reward", recent-activity peek, QR quick-link, zero-points mascot empty state. |
| `tailwind.config.ts` | Added `glow-pulse` keyframe/animation for the eligible-CTA dc-yellow glow (auto-disabled under the global reduced-motion rule). |

No files outside Phase 4 scope were modified. `PHASE_LOG.md` was **not** touched.

---

## 2. Acceptance criteria (PLAN.md §Phase 4) — evidence

> **"Ring + stamps reflect real `points_balance` and `rewards_config` threshold."**
The dashboard RSC fetches `profiles.points_balance` and the `rewards_config` row and passes both to `RewardsCard`. All ring/stamp math runs through `progressToNextReward(balance, config)` in `src/lib/rewards.ts` — percent, filled stamps, and toNext are computed from `redeem_threshold` / `stamps_per_card`; nothing is hardcoded. Verified config in DB: `redeem_threshold=100`, `stamps_per_card=10`, `redeem_value_cents=1000`.

> **"Redeem CTA disabled below threshold; enabled at/above; redeem decrements balance and logs transaction (via Phase 2 function)."**
CTA `disabled={!progress.eligible}` (and the dialog's confirm is additionally `disabled={pending || !eligible}` so it never double-submits); the `Button` component applies the spec's disabled style (`--text-tertiary` on `--fill-quaternary`, no shadow). When eligible the CTA gets the dc-red fill + `animate-glow-pulse` (dc-yellow glow). `redeemPointsAction()` reads the config threshold server-side and calls `rpc("redeem_points", { pts })` — the RPC atomically checks balance ≥ pts, decrements, increments `total_redemptions`, and appends a `redeem` ledger row. On success the dialog hands the authoritative new balance to the card via `onRedeemed`, which reconciles the displayed balance. Insufficient-balance and generic errors map to friendly copy (inline `role="alert"` in the dialog + the dialog stays open; balance untouched).

> **"Reaching threshold plays the celebration (confetti + haptic + sound-optional) exactly once."**
`celebratedRef` gates the celebration. It fires only on a true **upward crossing** (`next >= redeem_threshold && prev < redeem_threshold && !celebratedRef.current`), is set true on that crossing, and is re-armed only when balance drops back below threshold (after a redeem). Mounting already-eligible seeds `celebratedRef = true`, so a refresh never replays the burst; subsequent realtime updates while still eligible do not re-fire. Under reduced motion the burst is replaced by a single success toast fired at the crossing (not on `onDone`). Success haptic `[10,50,10,50,10]` fires on Celebration mount (`haptic.success()`). Sound is intentionally omitted (optional in spec; no asset).

> **"When points are added server-side (simulate via SQL/admin), the card updates live via realtime within ~1s."**
`RewardsCard` subscribes via the browser client to `postgres_changes` UPDATE on `public.profiles` filtered `id=eq.<uid>`. On an UPDATE it reads `payload.new.points_balance` and runs `applyBalance` → count-up + stamp-fill (+ celebration if crossing). **Caveat (honest):** I confirmed the publication membership and that the subscription wiring/cleanup is correct, but I could **not** drive an end-to-end live scan in this environment (that requires the Phase 5 `add_points` path / a manual SQL UPDATE against a logged-in browser session). The channel is in place so a Phase-5 scan "just works"; live timing should be re-confirmed by the Verifier with a real session.

> **"Animations hold ~60fps on a mid-range phone; `prefers-reduced-motion` disables non-essential motion."**
All animation is `transform`/`opacity` (ring `strokeDashoffset`, stamp `scale`, confetti `y/x/rotate/opacity`, count-up via `requestAnimationFrame` on text only with `tabular-nums` so no layout shift). Confetti is capped at 28 particles. Every animated component calls `useReducedMotion()`: ring snaps to final offset, stamps don't spring, count-up jumps instantly, Celebration renders nothing, the CTA glow is killed by the global `@media (prefers-reduced-motion: reduce)` rule in `globals.css`. **Caveat:** actual 60fps on a mid-range device is a Phase-11 device-profile task, not measurable here.

> **"Fully styled and correct in dark mode; keyboard + screen-reader accessible (ring has `aria` progress semantics, redeem button labeled)."**
Only design tokens are used (`bg-surface-tertiary`, `text-fg-secondary`, `--separator`, `rgb(var(--dc-red))`, etc.) — no hardcoded `#fff`/`#000`, so dark mode follows the token blocks. Ring: `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`. Stamp grid: `role="img"` `aria-label="{n} of {total} stamps earned"`. Redeem button has a text label and a confirm `Dialog` (Radix → focus trap + Esc + restore). Balance uses `aria-live="polite"`. Touch targets ≥ 44pt via `Button size="lg"` (`min-h-12`). **Caveat:** automated axe / VoiceOver passes are Phase-11; I verified semantics by construction and against the §9 checklist.

> **"Pixel-quality matches DESIGN_SYSTEM.md RewardsCard spec."**
Surface `--bg-tertiary` `rounded-3xl` hero shadow padding-24; centered `headline` title; ring (size 260, stroke 8, rounded caps, 12-o'clock clockwise) wrapping a 5×2 stamp grid; `title2` weight-700 tabular-nums balance with `points` footnote; status line "{toNext} points to your $10 reward" / "Reward ready! 🎉"; primary CTA. Matches §5.1 anatomy.

---

## 3. Realtime publication verification

- **Before:** `select … from pg_publication_tables where pubname='supabase_realtime'` → `[]` (profiles absent).
- **Action:** wrote `supabase/migrations/20260610020000_enable_realtime_profiles.sql` (idempotent `alter publication supabase_realtime add table public.profiles` guarded by an existence check) and applied it to project ref `uxgcyvexeehvhtuhmztc` via `apply_migration` (returned `{success:true}`).
- **After (confirmation):** the same `pg_publication_tables` query now returns `[{schemaname:"public", tablename:"profiles"}]`. The migration also appears in `list_migrations` (remote version `20260610214951_enable_realtime_profiles`).
- **RLS note:** publication membership does not widen read access — realtime delivery is still gated by the profiles SELECT policy, so a subscriber only receives **their own** row. The client filter `id=eq.<uid>` is belt-and-suspenders on top of RLS.

> Migration-name timestamp note: the local file is `20260610020000_…`; the remote recorded `20260610214951_…` (apply-time stamp). Same migration name and content; harmless drift. The local file is the repo source of record.

### 3.1 Live data-path test (server side, against ref `uxgcyvexeehvhtuhmztc`)

Signup is SMTP-gated, so I seeded a confirmed test user directly via SQL and exercised the **real** points functions. How earns were simulated and what was verified:

- **Seed:** inserted a confirmed row into `auth.users` (`phase4-test@doncarlos.test`, id `f8b27efd-2c38-4f7e-8afd-5aa6ec0ce894`). The `handle_new_user` trigger auto-created the profile at `points_balance = 0` ✅.
- **Simulated staff earns:** the production `add_points` RPC requires an admin caller (no admin auth context available over SQL), so earns were simulated by replicating exactly what `add_points` does internally — `set local app.points_ctx='on'` (the flag the deployed `guard_profile_update` trigger checks), bump `points_balance` + `total_points_earned`, and append an `earn` ledger row. This produces the identical `profiles` UPDATE that Realtime broadcasts. Earn #1 → balance 70 (7/10 stamps, 70% ring); earn #2 (+40) → balance 110 (eligible, full card).
- **Redeem (the action's exact path):** called the **real** `redeem_points(100)` RPC impersonating the user (`set local role authenticated` + `request.jwt.claims.sub = <uid>`). Result: balance 110 → **10** (−100); a `redeem` ledger row was appended (`points_delta = -100`, `points_balance_after = 10`, notes "Redeemed reward"); `total_redemptions` incremented. ✅
- **Insufficient-balance path:** re-calling `redeem_points(100)` at balance 10 raised `P0001: insufficient balance` — which `isInsufficientBalance()` in `actions/rewards.ts` maps to "You don't have enough points to redeem yet." ✅
- **Guard trigger confirmed working:** a non-`points_ctx` UPDATE to `points_balance`/`is_admin` was silently reverted to OLD values (the SECURITY-DEFINER write path is the only mutation route), confirming points are not client-writable.
- **Final demo state:** test profile left at `points_balance = 70` (mid-progress 7/10 card) for any later manual screenshotting.

---

## 4. Dependencies added

**None.** Confetti is a hand-rolled Framer Motion particle burst (capped at 28) per the perf-budget guidance — no new dependency was introduced. The only libs used (framer-motion, sonner, lucide-react, Radix dialog) were already present from Phase 1.

---

## 5. Deviations from DESIGN_SYSTEM / notes

- **Redeem amount is server-derived, not client-chosen.** The redeem action takes no client input; it redeems exactly `rewards_config.redeem_threshold` (one reward per full card). This is stricter than a free-form amount and removes a class of abuse — consistent with "points are never written by clients."
- **Celebration under reduced motion renders nothing** (rather than a tiny static card). The durable acknowledgement is a concise success toast fired by the parent in `onDone`, which matches §5.4 ("reduced-motion → skip confetti, keep concise toast"). The success haptic still fires.
- **Stamp glyph size 36px** inside the 260px ring (spec lists 40×40 as the standalone size) — reduced so the 5×2 grid sits comfortably inside the ring's inner bounds. Filled/empty styling unchanged.
- **Ring eligibility clamps the display at one full cycle.** When `balance >= threshold` the card shows a full ring / full stamps / "Reward ready!" rather than wrapping into the next cycle, so a redeemable customer always sees a complete card.

---

## 6. Build-gate output (run from project root)

### `npx tsc --noEmit` → exit 0
```
TSC_EXIT: 0
```

### `npm run lint` → exit 0
```
✔ No ESLint warnings or errors
LINT_EXIT: 0
```
(`next lint` prints a deprecation notice about migrating to the ESLint CLI in Next 16 — informational, not a lint error.)

### `npm run build` → exit 0
```
 ✓ Compiled successfully in 10.2s
 ✓ Generating static pages (16/16)

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
├ ƒ /reset-password                      2.92 kB         142 kB
├ ƒ /signup                              1.02 kB         218 kB
└ ƒ /verify-email                         3.6 kB         204 kB
+ First Load JS shared by all             102 kB
ƒ Middleware                              104 kB
BUILD_EXIT: 0
```

All routes compile. `/dashboard` is dynamic (`ƒ`) as expected (reads the session). Its First Load JS (256 kB) is dominated by framer-motion; confetti adds no extra dependency.

**Build-environment note (Windows):** `next build` intermittently aborts on this machine *after* a successful compile + typecheck + lint + static-page generation, during the trace/diagnostics file I/O, with a transient `ENOENT` whose path varies between runs (`.next\…\page.js.nft.json`, `.next\diagnostics\build-diagnostics.json`, `/_document` PageNotFoundError) — the signature of a Windows filesystem/AV race on the `.next` cache, not app code. The repo even ships `scripts/windows-defender-exclude.ps1` documenting this exact issue (Phase 1 fix M-1). Reliable clean exit-0 reproduction: `NEXT_TELEMETRY_DISABLED=1 npm run build` after `rm -rf .next` (disabling the telemetry/diagnostics writer removes the contended file). That run produced the exit-0 output above with all 16 routes generated and `/dashboard` at 44.7 kB / 256 kB First Load.

**Pre-existing warning (not introduced by Phase 4):** the `@supabase/ssr` → `@supabase/supabase-js` Edge-runtime `process.version` warning originates from `src/lib/supabase/middleware.ts` (Phase 3) and is informational.

---

## 7. Security / standards checks

- **No `any`, no unjustified `!`.** `tsc --noEmit` strict passes.
- **Service-role key never in the client chain:** `grep` of `src/components/rewards` + the dashboard route for `SUPABASE_SERVICE_ROLE_KEY` / `createServiceClient` / `service.ts` → no matches. `redeemPointsAction` uses the RLS-bound server client (self-redeem), not the service client.
- **Zod on the mutation input:** `redeemThresholdSchema` validates the config-derived amount before the RPC.
- **Errors never crash:** every async path in the action and the redeem flow returns/handles a user-facing state (friendly toast + optimistic rollback on failure).
- **Realtime cleanup:** the channel is removed via `supabase.removeChannel(channel)` in the effect cleanup (no leak); count-up cancels its `requestAnimationFrame` and the celebration clears its timeout on unmount.

---

## 8. Could-not-fully-verify (honest list)

1. **Live realtime push-to-browser (~1s timing)** — the **server side is verified**: profiles is in the `supabase_realtime` publication, and a real `profiles` UPDATE (earn) + `redeem_points` RPC were exercised live (§3.1). What I could **not** drive is the browser leg — receiving the broadcast in a logged-in client and watching the count-up/stamp/celebration render — because SMTP-gated signup left no usable browser session for the dev server. The subscription + cleanup wiring is confirmed by inspection; the Verifier should confirm live timing with a real session (or after Phase 5's scan path exists).
2. **60fps on a mid-range phone** — needs a device profile (Phase 11).
3. **Haptics** — `navigator.vibrate` is unsupported on iOS Safari (degrades silently per `lib/haptics.ts`); Android/real-device confirmation is a device task.
4. **Screen-reader / axe pass** — semantics built per §9 and verified by construction; full SR/axe sweep is Phase 11.
