# Phase 5 — QR System — Build Complete

Branch: `phase/5-qr` (cut from `master` @ Phases 0–4). Scope: customer QR display
+ admin scan-to-add points pipeline. Full admin portal remains Phase 9.

## Files created / changed

### Created
- `src/lib/qr-svg.ts` — pure, synchronous QR → SVG path renderer (EC High, baked
  4-module quiet zone). No canvas, no async, no client round-trip.
- `src/lib/points.ts` — THE `$1 = points_per_dollar` conversion (`pointsForAmount`),
  in one place (PLAN §8 no-magic-numbers).
- `src/schemas/scan.ts` — Zod: `qrTokenSchema` (UUID), `amountCentsSchema`,
  `pointsSchema`, `noteSchema`, `addPointsInputSchema` (exactly-one of amount/points).
- `src/actions/scan.ts` — `resolveQrTokenAction` + `addPointsAction` (admin-checked
  server actions) + `requireAdmin` helper + error mappers.
- `src/components/qr/QRDisplay.tsx` — the white-tile QR (client island).
- `src/components/qr/QRScanner.tsx` — admin camera scanner (lazy `@zxing/browser`).
- `src/components/qr/ScanFlow.tsx` — scan/manual → resolve → confirm-sheet → add.
- `src/app/(user)/qr/page.tsx` — the `/qr` tab destination (Show QR).
- `src/app/(admin)/layout.tsx` — first `(admin)` route group; server `is_admin` guard.
- `src/app/(admin)/scan/page.tsx` — reads config rate, renders `ScanFlow`.

### Changed
- `src/components/auth/QrTokenCard.tsx` — now renders the live `QRDisplay`
  (previously a "QR arrives soon" placeholder); rotation updates the QR in place.
- `src/app/(user)/dashboard/page.tsx` — "Show your QR code" now links `/qr`.
- `package.json` / `package-lock.json` — deps (below).

## Dependencies added (pinned + justified)
| Package | Version | Why |
|---------|---------|-----|
| `qrcode` | `1.5.4` | Mature, zero-runtime-dep QR **generator**. We use its synchronous `create()` matrix and render our own SVG → crisp at any size, no canvas, white-tile control, works in an RSC-friendly island. |
| `@zxing/browser` | `0.1.5` | Browser camera **scanner** wrapper (`decodeFromConstraints`) — `decodeFromConstraints` gives us the live `MediaStream` for the torch capability check. **Dynamically imported** so it loads only on the admin scan route. |
| `@zxing/library` | `0.21.3` | Peer/decoder core for `@zxing/browser` (also used in the offline decode proof below). |
| `@types/qrcode` | `1.5.5` (dev) | Types for `qrcode`. |

`@zxing/browser` was chosen over `html5-qrcode` because it exposes the underlying
track/stream (needed for the torch capability probe and a clean freeze-on-detect)
and tree-shakes/code-splits cleanly under Next's dynamic import.

`npm audit`: the only flagged advisories are a **pre-existing** transitive `postcss`
issue via Next.js (`next` → `postcss <8.5.10`), unrelated to the QR deps; the
added packages introduced no new advisories.

## Acceptance criteria (quoted from PLAN.md §Phase 5) + evidence

> - [ ] Customer QR renders, scannable at arm's length, white bg in dark mode.

`QRDisplay` renders a `rounded-2xl bg-white` tile with hard-coded `#ffffff`/`#000000`
SVG (never reads design tokens), so it stays white in dark mode (§10). Size default
232px (≥200), EC High (~30%), 4-module white quiet zone in the SVG `viewBox`,
`shapeRendering="crispEdges"`. Arm's-length scannability is a real-device check
(Phase 11/12) — see "Device-gated" below.

> - [ ] QR payload contains only the opaque token (verify by decoding — no email/uid/PII).

`QRDisplay` encodes `qrPayloadForToken(token)`, which returns the bare `qr_token`
UUID. **Decode round-trip proof** (`qrcode` encode → `@zxing/library` decode):

```
DECODED TEXT : "9f1c2e3a-4b5d-4e6f-8a90-1b2c3d4e5f60"
EQUALS TOKEN : true
NO PII       : true   (no @, gmail, user, uid in payload)
```

The decoded string equals the token exactly — no email, no user id, no scheme.

> - [ ] Admin can scan a customer QR, see the right customer, add points; balance + transaction update atomically.

`ScanFlow`: detect/type → `resolveQrTokenAction` (shows `display_name`, `email`,
`points_balance`) → enter $ → `addPointsAction` → `add_points` RPC, which
atomically updates balance + `total_points_earned` + inserts the `earn` ledger row
in one DB transaction (BLUEPRINT §4.4).

> - [ ] Non-admin calling `addPointsAction` is rejected server-side (defense in depth beyond UI hiding).

THREE independent server-side layers — see "Admin trust-boundary proof" below.

> - [ ] Customer's rewards card updates live after a scan (Phase 4 realtime).

Verified linkage (not rebuilt): `RewardsCard` subscribes to
`postgres_changes` UPDATE on `profiles` filtered to the customer's id
(`RewardsCard.tsx` lines ~152–176). `add_points` UPDATEs that row → the card's
`applyBalance` fires (count-up + stamp + celebration). No extra Phase-5 code needed.

> - [ ] Invalid/expired/garbage QR shows a friendly error, no crash.

`resolveQrTokenAction` Zod-validates the token is a UUID **before** any DB call
(garbage → "That code isn't a valid rewards code."); a valid-shaped token matching
no profile (e.g. rotated) → `maybeSingle()` returns null → "No customer matches
that code. They may have rotated it." Both are toasts; the scanner re-arms.

> - [ ] Amount input validated; negative/zero rejected with clear message.

`amountCentsSchema` = positive integer cents ≤ $5,000. Enforced in the client
(shared schema, inline `role="alert"` error) AND re-enforced in `addPointsAction`.
A sub-1-point amount → "That amount is too small to earn a point."

> - [ ] Camera-permission-denied path has a usable manual fallback.

`QRScanner` maps `NotAllowedError`/`SecurityError` → a `denied` state with clear
copy + a keyboard-operable "Enter code manually" button; no-camera → `unsupported`
with the same fallback. `ScanFlow` also has a persistent "Enter code" mode tab, so
manual entry is always reachable.

## Admin trust-boundary proof (the entire security model)

The boundary is "is the caller an admin", enforced **server-side at three layers**:

1. **Middleware** (`src/lib/supabase/middleware.ts`) — `/scan` is in `ADMIN_PREFIXES`;
   a non-admin is redirected to `/dashboard` before the route renders.
2. **`(admin)` layout** (`src/app/(admin)/layout.tsx`) — re-reads `profiles.is_admin`
   server-side; non-admin/signed-out → `redirect()` (never a 500).
3. **Server actions** (`src/actions/scan.ts`) — `requireAdmin()` re-derives identity
   from the session and re-checks `is_admin` at the TOP of BOTH `resolveQrTokenAction`
   and `addPointsAction`. A non-admin posting directly to the action (bypassing all
   UI) gets `{ ok:false, error:"You're not authorized to do that." }` and no DB
   mutation. The error copy is identical whether the caller is a non-admin or the
   lookup failed, so the boundary's existence isn't confirmed to an attacker.
4. **Backstop:** the `add_points` SECURITY DEFINER RPC itself `raise`s `42501` for a
   non-admin `auth.uid()`; `friendlyAddPointsError` maps `42501` → the authorized
   message. So even if a layer were bypassed, the database refuses.

The service-role key is **never** imported into `actions/scan.ts` or any client
module — the whole flow runs on the admin's own RLS-bound cookie session.

## QR no-PII proof
Encoded payload = `qrPayloadForToken(token)` = the bare `qr_token` UUID. Decode
round-trip (above) confirms the rendered QR carries only that UUID — no email, no
`auth.users` id, no scheme/PII.

## Idempotency / double-add guard
- Submit button `disabled` while a request is pending (`submitting`).
- Short-window dedupe (`lastAddRef`, 4s): a repeat confirm for the **same** customer
  within the window is ignored — an accidental double-tap can't double-award.
- The scanner fires `onDetected` exactly once per arm (`handledRef`) and freezes the
  frame, so a held QR can't spam resolves.

## Accessibility
- Scanner viewport has an `aria-label`; reticle/dim overlay is `aria-hidden`.
- Manual entry is a real keyboard-operable `<form>` (`Label` + `Input`).
- Confirm sheet uses the Radix `Sheet` (focus-trap, Esc, focus restore); amount
  error is `role="alert"` + `aria-describedby`/`aria-invalid`.
- Mode switch is a `tablist`/`tab` with `aria-selected`. State is never color-alone
  (icons + text on every control). Targets ≥44pt via the shared `Button`/`Input`.

## Build gates (real output)

`rm -rf .next; npx tsc --noEmit` → **EXIT 0** (no type errors; `no any`).

`npm run lint` → **`✔ No ESLint warnings or errors`** → **EXIT 0**.

`npm run build` → **EXIT 0**, run twice cleanly (2/2). Route table:
```
├ ƒ /qr                                  4.55 kB         144 kB
├ ƒ /scan                                7.69 kB         151 kB
... (18 routes total; /dashboard /profile /login etc. unchanged)
ƒ Middleware                              104 kB
```
The pre-existing `@supabase/supabase-js` Edge-Runtime `process.version` warning is
unrelated to Phase 5 (it's the middleware Supabase client, present since Phase 3).

**Perf — scanner is code-split:** `grep` of `.next/static/chunks` finds
`@zxing`/`BrowserQRCodeReader` only in two dedicated chunks (`733.*`, `896.*`),
**not** in the shared/initial bundles — confirming the lazy import keeps zxing off
non-admin routes and out of first load (perf budget §11). `/scan` first-load JS is
151 kB *without* the scanner chunk.

## Deviations / notes (with rationale)
- **`/qr` route added** (in addition to surfacing the QR on `/profile`). It was
  already declared in `USER_PREFIXES` and the BottomTabBar's "QR" tab but had no
  page; adding it satisfies the "prominent Show QR action" scope item and removes a
  dead tab. The dashboard "Show your QR code" button now points at `/qr` (was
  `/profile`). `/profile` still shows the QR card too.
- **Own SVG renderer** instead of `qrcode.toString('svg')`: the matrix approach is
  synchronous (no async flash), lets us bake the exact white quiet zone, and keeps
  full control of the always-white tile colors.
- **Confirm UI uses `$` amount only** (points-entry schema/path exists in
  `addPointsInputSchema`/`addPointsAction` for completeness, but the staff sheet
  exposes the dollar field — the in-shop mental model is "ring up $X"). Switching to
  explicit-points entry is a one-field UI addition if desired later.
- The DB `add_points` arg uses `note?`; the scan UI doesn't collect a note in this
  phase (kept minimal — note plumbing is wired in the schema/action for Phase 9).

## Device-gated (honest scope — verified later)
Real-phone **camera scanning** (focus/torch/arm's-length read under glare) is Phase
11/12 on-device QA. `getUserMedia` requires HTTPS (localhost + Vercel OK), and
desktop webcams aren't representative. What IS verified now, host-side: the full
server pipeline (resolve → add → atomic ledger), Zod validation, the admin trust
boundary (all three layers), the no-PII decode proof, the manual-entry fallback,
the permission-denied/no-camera states, and clean tsc/lint/build.
```
