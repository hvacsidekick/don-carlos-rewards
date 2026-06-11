# Phase 4 — Rewards Card UI — HOSTILE AUDIT REPORT (independent)

**Auditor:** Independent Phase-4 Auditor (does not trust the Builder's claims) · **Date:** 2026-06-10
**Branch:** `phase/4-rewards-card` (baseline `a4e5d2e`) · **DB:** Supabase ref `uxgcyvexeehvhtuhmztc`
**Method:** independent re-run of all gates · line-by-line code read · **live DB verification via elevated SQL** · **full browser leg** (real session minted, login → dashboard, live realtime earn observed, redeem dialog driven, light+dark screenshots). Dev server stopped after testing.

> Note: a prior audit report existed at this path written against an **earlier** revision of `RewardsCard.tsx`. Its MAJOR finding (count-up `aria-live` spam) has since been **fixed in the current code** (digits now `aria-hidden`; a visually-hidden `role="status" aria-live="polite"` announces only the settled balance — confirmed live). This report supersedes it against the current tree and adds the browser-leg verification.

---

## VERDICT

| | |
|---|---|
| **Letter grade** | **A−** |
| **Pass?** | **PASS** — clears the B+ bar; **0 critical / 0 blocking** |
| **Defect counts** | CRITICAL 0 · MAJOR 0 · MINOR 5 · nit 4 |
| **Browser realtime — did the card update live?** | **YES, verified.** A server-side balance change pushed to the open, logged-in card and re-rendered ring + stamps + CTA in < 1s with no reload. |

---

## GATES (re-run by the Auditor, not trusted from the report)

| Gate | Result |
|---|---|
| `npm run typecheck` (tsc --noEmit) | **exit 0**, clean, no `any` |
| `npm run lint` (next lint) | **exit 0** — "No ESLint warnings or errors" (Next-16 deprecation notice is informational) |
| `npm run build` | **exit 0** — clean (after `rm -rf .next`, `NEXT_TELEMETRY_DISABLED=1`); 16/16 routes; `/dashboard` 44.7 kB / 256 kB First Load, dynamic `ƒ`. **No** ENOENT in the production build this run. |

The Windows `.next` ENOENT race did **not** hit the production build, but it **did** repeatedly disrupt **dev** mode during interactive testing (see Environment note). Not app code.

---

## VERIFIED GOOD (independently re-proven)

### Functionality & security
1. **Math is fully `rewards_config`-driven** (`src/lib/rewards.ts`). Live config: `redeem_threshold=100, stamps_per_card=10, redeem_value_cents=1000`. Live card at balance 70 rendered "70 of 100", "7 of 10 stamps", "30 points to your $10.00 reward" (`perStamp=10`, `filled=floor(70/10)=7`). No hard-coded 100/10. Edge cases traced: 0→empty; 99→9 stamps/not eligible; 100→full/eligible; 200→clamped full (never wraps / never shows >`stamps`). ✅
2. **Redeem decrements + writes a `redeem` ledger row — proven live.** Real `redeem_points(100)` RPC (impersonating the user) returned a `redeem` row (`points_delta=-100, points_balance_after=10`); profile **110→10**, `total_redemptions` **1→2**, persisted. ✅
3. **Insufficient-balance rejection — proven live.** `redeem_points(100)` at balance 10 raised `P0001 insufficient balance`; mapped to friendly copy by `isInsufficientBalance`. ✅
4. **`redeemPointsAction` takes NO client amount.** Reads `redeem_threshold` server-side, Zod-validates (`redeemThresholdSchema`), passes as `pts`. Identity via `getUser()` (revalidates JWT). RLS-bound server client — never service-role. ✅
5. **Points NOT client-writable — guard trigger proven live.** A client-context UPDATE of `points_balance=99999, is_admin=true` was **silently reverted** (stayed 10 / false). `guard_profile_update` honors writes only when `app.points_ctx='on'`, set exclusively inside SECURITY DEFINER fns. ✅
6. **`redeem_points` RPC body verified** (live `pg_get_functiondef`): SECURITY DEFINER, `auth.uid()` identity, `where points_balance >= pts`, atomic decrement + `+1 total_redemptions` + `redeem` row, typed errors. ✅
7. **Realtime publication present** (live): `public.profiles` ∈ `supabase_realtime`. Migration `20260610020000_enable_realtime_profiles.sql` is idempotent + correct. ✅
8. **No subscription leak / no resubscribe churn.** Effect returns `removeChannel`; channel name `profile:${id}` is stable; `applyBalance` deps `[config, reduce, rewardValue]` are stable post-mount, so the effect does not re-fire → **refutes the duplicate-channel risk.** Console during live update was clean (no channel errors). ✅
9. **Celebrate-once survives every path.** `celebratedRef` fires only on true upward crossing, seeded `true` when mounting already-eligible (no replay on refresh/remount), re-armed only below threshold. Redeem's double-signal (dialog `onRedeemed` + realtime echo) de-duped by the `next===prev` early-return. ✅
10. **Count-up SR-safe (prior MAJOR now fixed).** `RewardsCard.tsx:216-221`: animating digits `aria-hidden`; settled balance announced once via `sr-only role="status" aria-live="polite"`. Live snapshot confirmed the separate `status` node ("70 points"). ✅
11. **Error paths degrade gracefully.** Missing config → `FALLBACK_CONFIG` + friendly action error; RPC failure → mapped copy, dialog stays open, no balance change; realtime payload guarded by `typeof points_balance === "number"`. No unhandled rejections in console. ✅

### Apple design (verified against live light + dark screenshots)
12. **Ring:** 8px stroke, rounded caps, 12-o'clock clockwise (`-rotate-90` + dashoffset), track `--separator`, progress `rgb(var(--dc-red))`, 600ms easeInOut, snaps under reduced-motion. ✅
13. **Stamp grid:** 5×2 for 10, filled = solid dc-red taco + yellow rim, empty = outline `--text-tertiary`; only newly-filled stamp springs. ✅ (size/gap deviations below)
14. **Card:** `rounded-3xl`, `shadow-card-hero`(+dark), `bg-surface-tertiary`; hero balance `text-title2 font-bold tabular-nums`. ✅
15. **Dark mode CORRECT** (live, emulated `prefers-color-scheme: dark`): `--background:0 0 0`, `--foreground:255 255 255`, card `rgb(44,44,46)`; brand red/yellow constant. ✅
16. **A11y:** ring `role="progressbar"` + valuenow/min/max + descriptive label (live: "Reward progress: 70 of 100 points"); stamp grid `role="img"` "7 of 10 stamps earned"; redeem labeled; Radix dialog focus-trap (live: focus landed on Cancel) + Esc + restore; 44pt targets (`min-h-11`/`min-h-12`, dialog close `size-11`); focus-visible rings. ✅
17. **Reduced-motion:** `useReducedMotion()` in every animated component + global `@media (prefers-reduced-motion: reduce)` zeroing animations (incl. `glow-pulse`); Celebration → nothing + toast. ✅ (by construction; not driven live)

---

## DEFECTS

### MINOR

**M-1 — Recent-activity query not scoped to the user (admin sees a global feed)**
`src/app/(user)/dashboard/page.tsx:46-50` selects last-3 `transactions` ordered by `created_at` with **no `.eq("user_id", user.id)`**. RLS (`tx_select_own_or_admin`) keeps this secure for normal users, but an **admin** viewing their own dashboard would see *everyone's* transactions in the "recent activity" peek — wrong UX + a privacy smell.
*Fix:* add `.eq("user_id", user.id)` — correctness/defense-in-depth regardless of caller role.

**M-2 — Stamp grid gap is 8px, spec requires 12px**
`StampGrid.tsx:57` (`gap: 8`) and `RewardsCardSkeleton.tsx:20` (`gap-2`). DESIGN_SYSTEM §5.1 line 176 / TASK §4.2 specify **12px**. Builder logged the stamp-size deviation but **not** this gap deviation. Cosmetic (stamps aren't tap targets).
*Fix:* set 12px (verify the 5×2 grid still fits the 260px ring; adjust stamp size per M-3 if tight) or log the deviation.

**M-3 — Stamp size 36px, spec says 40×40**
`StampGrid.tsx:36` default `stampSize=36`. DESIGN_SYSTEM §5.1/TASK §4.2 specify 40×40. Builder disclosed this (fit inside ring). Acceptable but off-spec.
*Fix:* bump ring inner room to 40px, or have the Orchestrator bless the deviation.

**M-4 — Page-level "to next reward" header does not update live**
`dashboard/page.tsx:74-86` renders `progress.toNext` **server-side**, outside the `RewardsCard` island. In the live earn test the card went eligible but this header above it stayed stale until reload. The card itself is correct; this is a redundant secondary status line that lags realtime.
*Fix:* drop the redundant page-level line (the card already shows status) or make it client-fed.

**M-5 — Dead `/transactions` link ("See all")**
`RecentActivity.tsx:54` links to `/transactions`, which doesn't exist (Phase 6) → live 404 (confirmed in console).
*Fix:* until Phase 6, point at `/dashboard` or drop the link (keep the heading). One line.

### nit

- **N-1** `isInsufficientBalance()` matches the bare substring `"balance"` (`actions/rewards.ts:39`). The RPC only emits the intended message today, but this would mis-map any future "balance"-containing error to "not enough points." Tighten to `insufficient balance` / errcode `P0001`.
- **N-2** `glow-pulse` keyframe animates `box-shadow` (`tailwind.config.ts:145-148`), which §7.4 says to avoid (not GPU-composited). Idle/infinite on one small element, killed under reduced-motion — negligible impact but a literal rule violation. Optionally render the glow as an opacity-animated sibling.
- **N-3** `RewardsCard` prop `total_redemptions` is in the prop type but never read (`RewardsCard.tsx:82`). Dead prop (matches TASK §4.4 signature; likely intentional placeholder). `RedeemResult.transactionId` is likewise returned but unused.
- **N-4** `formatTime()` shows time-of-day only — a multi-day activity list could show three ambiguous "4:00 PM" rows. Fine for a 3-item peek; revisit Phase 6. Also `relreplident='d'` on `profiles` is fine for current PK-filtered `postgres_changes` (live update worked); set `REPLICA IDENTITY FULL` only if a future phase filters realtime on a non-PK column or needs `payload.old`.

### Informational (pre-existing, NOT Phase-4 regressions)
- Security advisors flag `redeem_points` + other SECURITY DEFINER fns as authenticated-executable. `redeem_points` self-scopes via `auth.uid()` → by design; admin fns gate internally. No new holes from the realtime migration.
- Auth "leaked password protection disabled" (project-level) and the `@supabase/ssr` Edge `process.version` build warning (Phase 3) are pre-existing.

---

## BROWSER LEG (the gap the Builder couldn't close — NOW CLOSED)

**Session minted without SMTP:** set `crypt('Test123!pass', gen_salt('bf'))` on the seeded confirmed user `phase4-test@doncarlos.test` via elevated SQL.

**Blocker found & fixed (test fixture, NOT app code):** first GoTrue login returned `500 Database error querying schema`. Auth logs: `Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported`. The Builder's seeded `auth.users` row left GoTrue's token columns **NULL**; the Go driver can't scan NULL into non-nullable strings. **This is precisely why the Builder couldn't drive the browser leg.** Fixed by `coalesce(...,'')` on the 8 token columns; login then succeeded.

**Observed live (real browser, real session):**
1. **Login → /dashboard** at balance 70: ring 70%, 7/10 stamps, "30 points to your $10.00 reward", redeem **disabled**. → `audit-dashboard-light-70.png`
2. **LIVE REALTIME EARN — renders live, YES.** Browser open, NO reload: bumped DB balance 90→110 via the documented `app.points_ctx` points path (the exact UPDATE Phase-5 `add_points` will broadcast). Polling the live DOM: progressbar → `100 of 100`, stamps → `10 of 10`, redeem CTA → **enabled**, all within ~1s. → `audit-dashboard-light-eligible-110.png` (full ring, all stamps, "Reward ready! 🎉", glowing red CTA, hero "110 points").
3. **Dark mode** captured via emulated `prefers-color-scheme: dark`: correct token flip, black bg, dark card, constant brand colors. → `audit-dashboard-dark.png`
4. **Redeem dialog** opened live (correct title/body/Confirm/Cancel/Close; focus trapped on Cancel). The confirm **click** could not complete end-to-end in the browser — the redeem server-action POST + `revalidatePath("/dashboard")` re-render repeatedly tripped the **Windows `.next` dev-server race** (500 / `routes-manifest.json` ENOENT / webpack pack-rename). Environment, not app code. The redeem path is otherwise **fully proven live via the RPC** (VERIFIED GOOD #2/#3).
5. **Console during the realtime update: clean** — no subscription errors, no unhandled rejections, no leaked-channel warnings. Only console errors: the `/transactions` 404 (M-5) and the dev-server 500s from the `.next` race.

**Screenshots captured (repo root):**
- `audit-dashboard-light-70.png` — light, balance 70, mid-progress, CTA disabled.
- `audit-dashboard-light-eligible-110.png` — light, AFTER live realtime earn to 110: full ring, 10/10, "Reward ready!", enabled glowing CTA. **Proof realtime rendered live.**
- `audit-dashboard-dark.png` — dark mode, eligible, correct tokens.

**Could NOT verify live (with reason):**
- Redeem confirm **click** end-to-end through the UI (env `.next` race on the POST/revalidate). Mitigated: RPC + action logic proven via SQL.
- Confetti *render* — it auto-dismisses ~1.6s; the DOM poll began after the ~1s realtime latency, so it had already played/unmounted (the crossing definitely triggered — eligible state rendered). Reduced-motion suppression verified by code, not driven live.
- 60fps device profile, real-device haptics, full axe/VoiceOver sweep — all Phase 11.

---

## TOP 3 PRIORITIES FOR THE FIXER

1. **M-1 — Scope the recent-activity query to the user.** Add `.eq("user_id", user.id)` in `dashboard/page.tsx:46-50` so an admin's own dashboard doesn't surface a global transaction feed (correctness + privacy). *(Highest value — only finding with a real behavioral consequence.)*
2. **M-5 — Fix the dead `/transactions` link** (`RecentActivity.tsx:54`): repoint to `/dashboard` or remove until Phase 6. Eliminates a live 404. One line.
3. **M-2/M-3 — Stamp gap 8→12px and size 36→40px** to meet DESIGN_SYSTEM §5.1 (verify ring fit), or log the deviation in PHASE_LOG. *(While in `actions/rewards.ts`, also do the cheap N-1 tighten of `isInsufficientBalance`.)*

---

## ENVIRONMENT NOTE (for the Orchestrator)

The Windows `.next` filesystem race is **real and disruptive in dev mode** on this machine: repeated route recompiles (especially after a server-action `revalidatePath`) intermittently 500 with `routes-manifest.json` ENOENT and webpack pack-rename failures, sometimes needing `rm -rf .next` + dev restart. The **production `build` is unaffected** (clean exit 0). This does not reflect on Phase-4 code quality but will keep biting interactive dev/verify sessions until the Defender exclusion (`scripts/windows-defender-exclude.ps1`, Phase-1 M-1) is applied to the `.next` path. The seeded test user (`phase4-test@doncarlos.test` / `Test123!pass`, token columns now non-NULL) is left ready for re-use; balance reset to 70.
