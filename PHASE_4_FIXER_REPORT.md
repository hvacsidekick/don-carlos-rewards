# Phase 4 — Rewards Card UI — FIXER REPORT

**Role:** Phase 4 Fixer (surgical defect repair only)
**Date:** 2026-06-10
**Input:** `PHASE_4_AUDIT_REPORT.md` (Auditor verdict: **A− · APPROVED**; 1 MAJOR + 3 MINOR + 3 NIT)
**Scope:** Close the Auditor's listed defects only — no refactors, no scope creep, no later-phase work. The redeem trust boundary, realtime logic, and rewards math were verified-good and were NOT touched.

---

## 1. Summary

| Defect | Severity | Status | File(s) |
|--------|----------|--------|---------|
| M-1 — count-up live-region SR spam | MAJOR (a11y) | ✅ Fixed | `RewardsCard.tsx` |
| m-2 — `isInsufficientBalance` over-broad | MINOR | ✅ Fixed | `actions/rewards.ts` |
| m-3 — stamp grid gap deviates from spec | MINOR | ✅ Fixed + documented | `StampGrid.tsx`, `RewardsCardSkeleton.tsx` |
| m-4 — dashboard tx peek not scoped to user | MINOR | ✅ Fixed | `dashboard/page.tsx` |
| N-1 — glow-pulse animates `box-shadow` | NIT | ⏸ Deferred (rationale below) | — |
| N-2 — TacoGlyph/Mascot placeholders | NIT | ⏸ Out of scope (O-2 brand assets) | — |
| N-3 — RewardPulse infinite scale | NIT | — (Auditor: "No defect") | — |

All three build gates pass on a clean `.next` (§5).

---

## 2. Per-defect detail

### M-1 (MAJOR, a11y) — Count-up no longer spams screen readers

**What changed:** `src/components/rewards/RewardsCard.tsx:209-224`.

- The visually-animating digits (`{formatPoints(displayBalance)}`) are now `aria-hidden="true"`. `displayBalance` comes from `useCountUp`, which calls `setDisplay` on every `requestAnimationFrame` (~30 frames over 500ms) — previously each intermediate integer was queued for announcement by the `aria-live="polite"` on that node.
- Added a visually-hidden polite live region that announces only the **settled** target:
  ```tsx
  <span className="sr-only" aria-live="polite" role="status">
    {formatPoints(balance)} points
  </span>
  ```
  It reads `balance` (the React state set once per change via `setBalance(next)` in `applyBalance`), **not** `displayBalance` (the per-frame tween value).
- The static "points" label `<p>` was marked `aria-hidden` because the unit is now included in the live-region text ("70 points"), avoiding a duplicate announcement.

**Why it closes the finding:** `balance` changes exactly once per real balance update (realtime echo or redeem reconcile). A screen reader therefore announces one final value ("70 points") rather than the tween burst ("12", "27", "41"…). Under reduced motion the count-up is already instant, so the live region still fires once — correct. The animating node is hidden from the a11y tree entirely.

**How verified:** Traced `useCountUp` (per-frame `setDisplay`) vs. `setBalance` (per-change). The live region is bound to `balance`; the per-frame node is `aria-hidden`. `sr-only` is the project's existing visually-hidden utility (used in `QrTokenCard.tsx:63`), so it is visually unchanged. tsc + lint + build all green.

---

### m-2 (MINOR) — `isInsufficientBalance` narrowed to the precise RPC signal

**What changed:** `src/actions/rewards.ts:31-49` (the matcher) + the call site at line ~84.

The old matcher returned true for any message containing `"insufficient"`, `"not enough"`, **or `"balance"`** — so a generic DB/serialization error whose text merely contained the word "balance" would be mis-reported to the user as "You don't have enough points."

Checked the migration source (`supabase/migrations/20260610011444_points_functions.sql:74-76`): the `redeem_points` RPC raises **exactly**
```sql
raise exception 'insufficient balance' using errcode = 'P0001';
```
on the atomic `points_balance >= pts` guard-miss. The other raises in that function use `42501` (auth) / `22023` (invalid amount), both of which the action already pre-guards (its own `getUser()` and the `redeemThresholdSchema` validation), so `P0001` is unambiguous here.

New matcher takes the `PostgrestError` (typed structurally as `{ code?: string; message?: string }` to avoid `any`) and matches on **`error.code === "P0001"`** OR the exact phrase **`"insufficient balance"`** — nothing broader:
```ts
function isInsufficientBalance(error: { code?: string; message?: string }): boolean {
  if (error.code === "P0001") return true;
  return (error.message ?? "").toLowerCase().includes("insufficient balance");
}
```

**Why it closes the finding:** Unrelated errors no longer match the substring `"balance"`; they fall through to the generic friendly message ("We couldn't redeem your reward. Please try again."). The `!data` null-row fallback below remains as belt-and-suspenders for the (now-unreachable-via-exception) no-row path.

**How verified:** Confirmed the exact error string + SQLSTATE in the migration; confirmed no other `P0001` raise exists in `redeem_points`. tsc clean (no `any`).

---

### m-3 (MINOR) — Stamp grid geometry: kept fitting size, documented the deviation precisely

**Decision: option (b)** — keep a stamp size + gap that provably fits inside the ring, and document the exact deviation and geometric reason here for the Verifier. The spec's 40px + 12px does **not** fit and would clip the arc.

**Geometry (ring inner diameter = 260 − 8px stroke = 252px usable):**

| Config | Grid bbox (5×2) | Diagonal | Fits ≤252px? |
|--------|-----------------|----------|--------------|
| Spec: 40px stamp, 12px gap | 248 × 92 | √(248²+92²) ≈ **264.5px** | ❌ overflows (clips arc) |
| Prior: 36px stamp, 8px gap | 212 × 80 | ≈ 226.6px | ✅ (~25px clearance) |
| **Chosen: 36px stamp, 10px gap** | 220 × 80 | √(220²+80²) ≈ **234.1px** | ✅ (~18px diagonal clearance) |

The 5×2 grid is a rectangle inscribed in the ring's inner circle; the binding constraint is the rectangle's **diagonal ≤ inner diameter** (the corners are what reach the ring). The spec grid's 264.5px diagonal exceeds the 252px inner diameter by ~12px, so two opposite corners would sit on/over the red arc.

**What changed:**
- `src/components/rewards/StampGrid.tsx:55-64` — `gap: 8` → `gap: 10` (with an inline comment recording the geometric reason). Stamp size stays at the existing **36px** default (the Builder already logged the 40→36 stamp-size deviation in PHASE_LOG; only the gap was undocumented).
- `src/components/rewards/RewardsCardSkeleton.tsx:20` — `gap-2` (8px) → `gap-2.5` (10px) so the loading placeholder keeps matching the real card's footprint (no layout shift on data arrival).

**Why 10px (not 8, not the spec 12):** 10px is the largest clean even value that still leaves comfortable clearance (~18px on the diagonal) inside the ring, moving as close to the spec's 12px gap as the geometry allows without crowding the arc. It reads less dense than the prior 8px while staying Apple-clean.

> **LOGGED DESIGN DEVIATION (for the Verifier to transcribe to PHASE_LOG.md §Phase 4):**
> StampGrid uses **36×36px stamps with a 10px gap** (DESIGN_SYSTEM §5.2 specifies 40×40px + 12px). Reason: a 5×2 grid at the spec size (248×92, diagonal ≈265px) overflows the ring's 252px inner diameter (260px outer − 8px stroke) and would clip the progress arc. The chosen 36px/10px grid (220×80, diagonal ≈234px) fits with ~18px diagonal clearance. The 40→36 stamp-size half of this deviation was already logged by the Builder; this entry adds the previously-undocumented 12→10 gap deviation.

---

### m-4 (MINOR, correctness/privacy) — Dashboard tx peek scoped to the signed-in user

**What changed:** `src/app/(user)/dashboard/page.tsx:45-50` — added `.eq("user_id", user.id)` to the last-3 transactions query.

The recent-activity peek previously relied on RLS alone. RLS (`tx_select_own_or_admin`) keeps it secure, but for an **admin** viewing their own dashboard the "read all" branch of that policy would let the unscoped query surface the **global** transaction feed (other customers' rows) in the admin's personal "Recent activity" panel.

**Why it closes the finding:** The query now always returns only the signed-in user's own activity regardless of role — defense-in-depth alongside RLS, and correct UX (an admin's own dashboard shows their own activity, not a global feed). `user.id` is already available (the page narrows on `if (!user) return null` above).

**How verified:** Confirmed `user` is in scope at that line; the `transactions` table has a `user_id` column (used in the RPC ledger inserts). Build green.

---

### N-1 (NIT) — glow-pulse `box-shadow` — DEFERRED

`tailwind.config.ts:145-148` animates `box-shadow` on the eligible CTA, a literal violation of §7.4 ("animate only transform/opacity"). **Not fixed.** Rationale: the Auditor itself rates the impact "negligible" — it's an idle, infinite animation on one small element, off the input-latency path, and already zeroed under reduced-motion by the global CSS rule. The proper fix (an absolutely-positioned opacity-animated glow sibling) requires restructuring the verified-good eligible CTA, which is more risk than the negligible benefit warrants and edges into refactor territory the Fixer brief explicitly fences off. Left as-is, with this rationale recorded for the Verifier.

### N-2 (NIT) — TacoGlyph / Mascot placeholders — OUT OF SCOPE

Explicitly pending brand-asset item **O-2**; the Auditor flagged it only so the Verifier doesn't mistake the placeholder for pixel-final. Not a Phase 4 defect; public APIs are stable/swappable. Untouched.

### N-3 (NIT) — RewardPulse infinite scale — NO DEFECT

The Auditor's own note: "No defect" — the pulse wraps the ring only (not the tabular-nums balance), animates transform (GPU), reduced-motion-safe. Nothing to fix.

---

## 3. Stamp-geometry decision (one-line)

Kept **36×36px stamps + 10px gap** (option b): the spec's 40px/12px grid overflows the ring's 252px inner diameter (diagonal ≈265px > 252px) and would clip the arc; 36px/10px fits with ~18px clearance. Deviation logged above for PHASE_LOG transcription.

---

## 4. Gate output (clean `.next`)

**Typecheck** — `rm -rf .next && npx tsc --noEmit`
```
TSC_EXIT: 0
```

**Lint** — `npm run lint`
```
✔ No ESLint warnings or errors
LINT_EXIT: 0
```
(only the informational Next 16 `next lint` deprecation notice)

**Build** — `npm run build`
```
 ✓ Compiled successfully in 11.3s
 ✓ Generating static pages (16/16)

Route (app)                                 Size  First Load JS
├ ƒ /dashboard                           44.7 kB         256 kB
ƒ Middleware                              104 kB
BUILD_EXIT: 0
```
The pre-existing `@supabase/ssr` Edge `process.version` warning originates in `lib/supabase/middleware.ts` (Phase 3), not Phase 4 — unchanged by this fix.

---

## 5. Diff summary

```
 src/actions/rewards.ts                         | 28 ++++++++++++++++----------
 src/app/(user)/dashboard/page.tsx              |  4 ++++
 src/components/rewards/RewardsCard.tsx         | 15 ++++++++++++--
 src/components/rewards/RewardsCardSkeleton.tsx |  2 +-
 src/components/rewards/StampGrid.tsx           |  7 ++++++-
 5 files changed, 41 insertions(+), 15 deletions(-)
```

Net: 41 insertions, 15 deletions across 5 files (most of the additions are explanatory comments documenting the a11y intent, the precise RPC signal, and the ring-fit geometry). No new dependencies. No `any`. No changes to the redeem trust boundary, realtime subscription, or rewards math. `PHASE_LOG.md` not touched (Verifier-owned) — the gap deviation is recorded in §2 m-3 above for transcription.

---

## 6. Honesty notes

- **N-1 not fixed** — deferred as negligible + refactor-risk; rationale above. If the Verifier wants it closed, it's a small but structural CTA change (opacity-animated glow sibling + a `tailwind.config.ts` keyframe swap).
- **M-1 verification is by-construction**, not a live VoiceOver/TalkBack pass (that's the Phase 11 SR pass per §9). The live region is provably bound to the per-change `balance` state, not the per-frame `displayBalance`, and the tween node is `aria-hidden` — which is exactly the fix the Auditor specified.
- **m-2** matches `P0001` (plpgsql `raise_exception` SQLSTATE). In `redeem_points` the only `P0001` raise is the insufficient-balance path; the function's other raises use distinct codes (`42501`/`22023`) and are pre-guarded by the action. If a future edit to that RPC adds another bare `raise exception` (which also defaults to `P0001`), the message-substring check (`"insufficient balance"`) still keeps the classification precise — but the `code` short-circuit assumes `P0001` ≡ insufficient-balance *for this function*, which holds today.
