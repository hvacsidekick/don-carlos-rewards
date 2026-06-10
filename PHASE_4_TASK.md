# Phase 4 — Rewards Card UI — TASK (Builder Work Order)

**Project:** Don Carlos Rewards App · **Phase:** 4 of 12 · **Effort:** L · **Depends on:** Phase 1 ✅, Phase 3 ✅ (both Verified)
**Authored by:** Orchestrator, 2026-06-10 · **Source:** `PLAN.md` §Phase 4, `DESIGN_SYSTEM.md` §5.1/§7/§8/§9, `BLUEPRINT.md` §4/§6/§9

> Read this file, then the referenced `DESIGN_SYSTEM.md` and `BLUEPRINT.md` sections, **before** writing code. Build strictly in scope. Self-check against §Acceptance before handing to the Auditor. Follow every Golden Rule in `PLAN.md` §0 (Zod on external input, no `any`, strict TS, ≥44pt targets, light+dark, Server Components by default + client islands only for interaction/animation, errors never crash, business numbers from `rewards_config` — never hard-coded).

---

## 1. Objective

The signature "wow" screen. A hybrid **stamp-card + Apple-Watch progress ring** that reads the user's **real** `points_balance` and `rewards_config`, animates at ~60fps, updates **live** when staff add points (Supabase Realtime), and offers a polished **redeem** flow with a celebration. Fully styled in light + dark, keyboard + screen-reader accessible, and `prefers-reduced-motion` compliant.

---

## 2. Resolved decisions (do not re-litigate — these close the brief's ambiguities)

- **D4-1 Confetti = dependency-free.** Build `components/rewards/Celebration.tsx` as a small Framer-Motion particle burst (absolutely-positioned divs/SVG, colors `--dc-red` / `--dc-yellow` / `--dc-green`, ~1.2s, `pointer-events-none`, unmounts after). **Do NOT add `react-confetti`/`canvas-confetti`** — no new dependency (keeps Phase-10 CSP simple, bundle lean). Must be fully suppressed under reduced-motion.
- **D4-2 Mascot = existing placeholder.** Use `Mascot` as-is (emoji placeholder; final brand SVG is open question O-2). Do not block on assets.
- **D4-3 Celebration sound = skipped in v1.** Leave a guarded, no-op hook (`// TODO O-? success sound`) — do not ship an audio file.
- **D4-4 Stamp math (canonical).** Driven by `rewards_config`. Let `threshold = redeem_threshold`, `stamps = stamps_per_card`, `perStamp = threshold / stamps`.
  - `cyclePoints = balance % threshold` when `balance < threshold`; treat `balance >= threshold` as **reward-ready** (ring full, all stamps filled).
  - `filledStamps = balance >= threshold ? stamps : Math.floor(balance / perStamp)`
  - `ringProgress (0..1) = balance >= threshold ? 1 : balance / threshold`
  - `toNext = Math.max(0, threshold - balance)`
  - **One reward per full card.** After a successful redeem (`−threshold` points), the card resets to the new balance. Banking multiple simultaneous rewards is **out of scope** (admin/Phase 9 concern). If `balance > threshold` (possible via large admin add), still show reward-ready/full — do not render >`stamps` filled.
- **D4-5 Recent-activity peek = minimal inline variant.** Build a small `RecentActivity` (last 3 `transactions`) in the dashboard; do not build the full Phase-6 list. Keep the row markup extractable so Phase 6 can promote it.
- **D4-6 Redeem dialog = shadcn `dialog`.** Confirm copy + states defined in §4.5.

---

## 3. Data contract (from `BLUEPRINT.md` §4/§6 + `database.types.ts` — use the generated types, never redeclare)

- `profiles.Row`: `{ id, email, display_name, avatar_url, qr_token, points_balance, total_points_earned, total_redemptions, is_admin, created_at, updated_at }`. `points_balance` is **client-unwritable** (RLS + guard trigger); only SECURITY DEFINER fns mutate it.
- `rewards_config.Row` (singleton, id=1): `{ points_per_dollar, redeem_threshold, redeem_value_cents, stamps_per_card, updated_at }`.
- `transactions.Row`: `{ id, user_id, points_delta, points_balance_after, transaction_type: 'earn'|'redeem'|'adjustment', amount_cents, staff_id, notes, created_at }`.
- **`redeem_points(pts: number)` RPC** → returns the inserted `transactions` row. Errors (map to friendly copy, never leak raw): `'auth required'`, `'invalid amount'`, `'insufficient balance'`. It atomically checks `balance >= pts`, decrements balance, increments `total_redemptions`, writes a `redeem` ledger row. **Redeem exactly `redeem_threshold` points** for one reward (pass `config.redeem_threshold` as `pts`).
- **Realtime:** subscribe (browser client) to `postgres_changes` on `public.profiles` filtered to `id=eq.${userId}`, event `*`. RLS guarantees the user only receives their own row. On `payload.new`, update local balance → run stamp-fill/ring-advance animation + haptic. **Unsubscribe on unmount** (no leak — Auditor will check).

---

## 4. Deliverables (file by file)

### 4.1 `src/components/rewards/ProgressRing.tsx` (client)
- Animated SVG ring, `stroke-dashoffset` fill, **clockwise from 12 o'clock**, `strokeLinecap="round"`, stroke width **8px**.
- Props: `{ progress: number /*0..1*/, size?: number, strokeWidth?: number, children?: ReactNode }`. Track = `stroke-separator`; progress stroke = `stroke-dc-red`. Center slot renders `children` (the stamp grid + balance).
- Animate offset over **600ms easeInOut** (Framer Motion). Under `useReducedMotion()` → set final offset instantly.
- A11y: `role="progressbar"`, `aria-valuenow={Math.round(progress*100)}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label` describing reward progress.

### 4.2 `src/components/rewards/StampGrid.tsx` (client)
- Grid of `stamps` taco glyphs (default 5×2). Gap 12px; each stamp 40×40. Uses `TacoGlyph filled={i < filledStamps}`.
- Props: `{ totalStamps: number, filledStamps: number, animateNewIndex?: number | null }`.
- **Only the newly-filled stamp animates**: scale `0→1.2→1` via `springBouncy`, outline→`--dc-red`, fire `haptic.light()` once. Siblings static. Reduced-motion → no scale, just final color.
- A11y: container `role="img"` `aria-label={"{filledStamps} of {totalStamps} stamps earned"}`.

### 4.3 `src/components/rewards/Celebration.tsx` (client) — see D4-1
- Dependency-free confetti burst + ring-sweep flourish + scale pulse `1→1.06→1`. Props `{ run: boolean, onDone?: () => void }`. `pointer-events-none`, fixed/absolute overlay. Suppressed entirely under reduced-motion (render nothing). Fire `haptic.success()` when `run` flips true (guarded).

### 4.4 `src/components/rewards/RewardsCard.tsx` (client island)
- Composes: header "Don Carlos Rewards", `ProgressRing` wrapping a centered **balance hero** (`tabular-nums`, count-up tween ~500ms easeOut on change) + `StampGrid`, status line, redeem CTA, and `Celebration`.
- Props: `{ initialProfile: Pick<profiles.Row,'id'|'points_balance'|'total_redemptions'>, config: rewards_config.Row }`. (RSC fetches and passes; island owns live state.)
- Mounts the **realtime subscription** (browser client) to its own profile row; on balance increase → animate the new stamp(s) + count-up + medium/`light` haptic; on crossing `threshold` upward → trigger `Celebration` **exactly once** per crossing.
- Card surface: `bg-surface-tertiary rounded-3xl shadow-card p-6 max-w-[480px]`, dark via tokens.
- Status line: `toNext>0` → "{toNext} points to your {formatCurrency(redeem_value_cents)} reward"; else "Reward ready! 🎉".
- Zero-points state: ring empty, all stamps outlined, `Mascot expression="welcome"`, welcoming copy, CTA disabled.
- Redeem CTA: `Button`, white on `bg-dc-red-fill`, **disabled when `balance < threshold`**; enabled at/above. Opens `RedeemDialog`.

### 4.5 `src/components/rewards/RedeemDialog.tsx` (client) — see D4-6
- shadcn `dialog`. Title "Redeem your reward". Body: "Redeem {threshold} points for {formatCurrency(redeem_value_cents)} off your next order?" Confirm + Cancel. Confirm = disabled-while-submitting; calls `redeemPointsAction()`; on `ok` close + let card celebrate + toast success (`sonner`); on `!ok` show friendly inline error, keep dialog open, no balance change. ≥44pt targets, focus-trap (Radix gives this), Esc to close.

### 4.6 `src/actions/rewards.ts` (server action) — **new file**
- `redeemPointsAction(): Promise<ActionResult<{ newBalance: number }>>` — `"use server"`. Get user via server client (`getUser()`); if none → `{ok:false,error:"You are not signed in."}`. Read `rewards_config.redeem_threshold`. Call `supabase.rpc("redeem_points", { pts: threshold })`. Map errors: insufficient → "You don't have enough points yet."; invalid/auth → friendly generic; success → `revalidatePath("/dashboard")` and return new balance from the returned row's `points_balance_after`. **Zod-validate** any future args; none today but keep the pattern. No raw error leakage.

### 4.7 `src/app/(user)/dashboard/page.tsx` (RSC) — **rewrite the placeholder**
- Server-fetch profile (via `getServerAuth` / server client) + `rewards_config` (`.single()`) + last 3 `transactions` (RLS-scoped, `order created_at desc limit 3`). Handle missing config gracefully (defensive default + log; do not crash).
- Render: greeting, `<RewardsCard initialProfile config />` hero, `<RecentActivity items />`, quick link to `/profile` (QR). `max-w-[480px]` column, safe-area padding.

### 4.8 `src/components/rewards/RecentActivity.tsx` (server-friendly) — see D4-5
- Last 3 transactions: type icon, `formatDelta(points_delta)` color-coded (earn green / redeem red / adjustment neutral), `formatTime(created_at)`, optional note. Empty → tiny `Mascot expression="empty"` + "No activity yet — go grab a taco!". Extractable for Phase 6.

### 4.9 Loading/skeletons
- `loading.tsx` or in-page skeletons for ring/stamps/balance using existing `skeleton` primitive.

---

## 5. Acceptance Criteria (Builder self-checks before Auditor)

- [ ] Ring + stamps reflect **real** `points_balance` and `rewards_config.redeem_threshold` (no hard-coded 100/10).
- [ ] Redeem CTA disabled below threshold; enabled at/above; redeem decrements balance and writes a `redeem` transaction via `redeem_points` (verify ledger row + new balance).
- [ ] Crossing threshold plays the celebration **exactly once** (no replay on re-render/resubscribe).
- [ ] Server-side `points_balance` change (simulate via SQL/admin RPC) updates the card **live within ~1s** via realtime; stamp fills + ring advances + count-up runs.
- [ ] `prefers-reduced-motion` disables confetti, count-up, stamp scale, ring tween (final state shown instantly).
- [ ] Subscription is cleaned up on unmount (no duplicate channels / leak across navigations).
- [ ] Correct + polished in **dark mode**; ring/stamp brand colors constant; text contrast ≥ 4.5:1.
- [ ] A11y: ring `progressbar` semantics, stamp grid labeled, redeem button labeled + ≥44pt + keyboard reachable; dialog focus-trapped + Esc.
- [ ] `npm run typecheck` (tsc) clean · `npm run build` exit 0 · `npm run lint` clean. **No `any`.**
- [ ] Errors never crash: missing config, RPC failure, realtime disconnect all degrade gracefully.

## 6. Out of scope
QR generation/scan + the earn pipeline (Phase 5 — but build against the realtime channel so Phase 5 "just works"). Full transaction list/pagination (Phase 6). Admin actions (Phase 9). Multi-reward banking. Brand SVG/audio assets (O-2).

## 7. Gates / handoff
Builder commits to `phase/4-rewards-card` (record in PHASE_LOG; git is now initialized — baseline `a4e5d2e`). Produce `PHASE_4_BUILD_COMPLETE.md` with: files added/changed, acceptance self-check evidence (build/tsc/lint output, screenshots light+dark if dev server reachable), realtime test method, and any deviations/open questions. Then hand to the **hostile Auditor** (functional+security AND Apple-design axes per `PLAN.md` §6).

> ⚠️ Live-test caveat (environment): the dev server + live Supabase (`uxgcyvexeehvhtuhmztc`) are available, but signup/email is SMTP-gated. To exercise the card with real data, seed a profile + points directly via SQL/admin RPC (service-role path) rather than the signup UI. Document exactly how you simulated earns.
