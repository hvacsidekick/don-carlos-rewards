# Phase 5 — QR System — AUDIT REPORT (Hostile / Independent)

Auditor: independent Phase 5 auditor. Branch audited: `phase/5-qr` @ `63850bd`.
Method: read all source independently FIRST, attacked the trust boundary, ran
real build gates on a clean `.next`, performed an independent payload-decode
proof, and read the Builder's `PHASE_5_BUILD_COMPLETE.md` LAST. Builder claims
were treated as hypotheses; every load-bearing one below was independently
re-verified.

## VERDICT

**Grade: A−** · **APPROVED** (exceeds the B+ bar).

- Admin trust boundary: **HELD.** No non-admin path reaches an add or a resolve.
- No-PII payload: **PROVEN.** Encoded payload is the bare opaque UUID only.
- Build gates: tsc **0**, lint **0**, build **0**. Scanner lib **code-split** off
  customer routes (independently confirmed via the app build manifest).
- Defects: 0 CRITICAL, 0 MAJOR, 2 MINOR, 4 NIT. None blocking.

---

## A. ADMIN TRUST-BOUNDARY ATTACK — RESULT: BOUNDARY HELD

I traced every path into `addPointsAction` and `resolveQrTokenAction` and tried to
reach them as a signed-in NON-admin. There are **four** independent server-side
gates; an attacker must defeat all four, which is not possible:

1. **Middleware** (`src/lib/supabase/middleware.ts:82-92`) — `/scan ∈ ADMIN_PREFIXES`
   (`src/lib/auth-routes.ts:14`); identity via `getUser()` (revalidates the JWT, not
   `getSession()`), then `profiles.is_admin` re-read; non-admin → `/dashboard`.
2. **`(admin)` layout** (`src/app/(admin)/layout.tsx:19-35`) — re-reads `is_admin`
   server-side via `getUser()`; non-admin/signed-out → `redirect()`, never a 500.
3. **Server actions** (`src/actions/scan.ts:43-66, 98-99, 148-149`) — `requireAdmin()`
   runs at the TOP of BOTH actions. It derives identity from `getUser()` (line 48 —
   NOT `getSession()`) and re-checks `profiles.is_admin`. A non-admin POSTing the
   Server Action directly (no UI) gets `{ ok:false, error:"You're not authorized to
   do that." }` and **no DB mutation**.
4. **`add_points` SECURITY DEFINER RPC** (`...011444_points_functions.sql:21-23`) —
   `if not public.is_admin(auth.uid()) then raise … errcode '42501'`. The function is
   granted only to `authenticated` (`...011632_harden_function_grants.sql:41`), so even
   a hand-crafted PostgREST RPC call from a logged-in non-admin (bypassing ALL of
   Next.js) is rejected at the database. `friendlyAddPointsError` maps `42501` →
   "not authorized" (`scan.ts:77`) as the backstop.

Identity source: **`getUser()` everywhere** (middleware, layout, action) — verified;
no `getSession()` in the trust path. `is_admin()` itself is non-recursive, `STABLE`,
`SECURITY DEFINER` with pinned `search_path` (`...011359_profiles.sql:28-36`).

**Service-role key in the scan chain: ABSENT.** `grep` of `src/` shows
`SUPABASE_SERVICE_ROLE_KEY` only in `account.ts` (Phase-3 account deletion) and
`lib/supabase/service.ts`. `scan.ts`, `ScanFlow`, `points.ts`, `qr.ts`, `qr-svg.ts`,
and both QR components do NOT import `service.ts`. `scan.ts` uses
`@/lib/supabase/server` → the **RLS-bound anon** server client (`server.ts:22` uses
`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The scan runs entirely under the admin's own
RLS-bound session. Confirmed.

Enumeration: not exploitable. The token is a 122-bit random UUID and both actions
are admin-gated; the distinct "garbage" vs "no match" copy is only ever seen by an
authenticated admin and gives no useful oracle.

## B. NO-PII PAYLOAD — RESULT: PROVEN

`QRDisplay` encodes `qrPayloadForToken(token)` (`QRDisplay.tsx:32`), and
`qrPayloadForToken` returns the token verbatim with no wrapping
(`qr.ts:27-29`). Independent round-trip (ran `qrcode@1.5.4` `create()` on a sample
token and inspected the exact encoded string):

```
Encoded payload string: "a1b2c3d4-5e6f-4a8b-9c0d-1234567890ab"
Payload === token (no wrapping): true
Contains @ (email)?  false
Contains { (JSON)?   false
Contains : (scheme)? false
Is bare UUID v4 shape? true
ECC level: 2 (H)     Module count: 33
```

The payload is the bare opaque rotatable UUID — **no email, no user id, no JSON, no
scheme/URL, no PII**. QR encoding is lossless, so a scanner decodes exactly this
string back. Error correction is **H (~30%)** as required.

---

## ACCEPTANCE CRITERIA — PASS/FAIL

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Customer QR renders, scannable at arm's length, white bg in dark mode | **PASS** | `QRDisplay.tsx:38-57` hard-codes `bg-white` plate + `#ffffff`/`#000000` SVG (never reads tokens) → white in dark mode (§10). Default `size=232` (≥200), EC **H**, 4-module white quiet zone baked into the `viewBox` (`qr-svg.ts:24,35`), `shapeRendering="crispEdges"`. Arm's-length read is device-gated (Phase 11/12, honest). |
| 2 | QR payload = opaque token only (decode; no PII) | **PASS** | Section B independent decode proof. |
| 3 | Admin scans → right customer → add points; balance + tx atomic | **PASS** | `ScanFlow` resolve→confirm→add; `add_points` RPC updates `points_balance` + `total_points_earned` + inserts the `earn` ledger row in ONE transaction with the GUC guard window (`...011444:28-44`). RPC `Returns` a single row (`database.types.ts:274 isOneToOne:true`), so `data.points_delta`/`points_balance_after`/`id` access (`scan.ts:200-202`) is correct. |
| 4 | Non-admin `addPointsAction` rejected server-side (beyond UI) | **PASS** | Section A — four independent server gates. |
| 5 | Customer card updates live after a scan (Phase 4 realtime) | **PASS** | Verified the linkage, not assumed: `RewardsCard.tsx:153-166` subscribes `postgres_changes` UPDATE on `profiles` `filter: id=eq.<uid>` → `applyBalance`. `add_points` UPDATEs that row; `profiles` is in the `supabase_realtime` publication (`...020000_enable_realtime_profiles.sql`). Reuse claim is accurate. |
| 6 | Invalid/expired/garbage QR → friendly error, no crash | **PASS** | `resolveQrTokenAction:101-104` Zod-validates UUID BEFORE any DB call (garbage → friendly copy); valid-shape-no-match → `maybeSingle()` null → "No customer matches that code…" (`:115-117`). Client also pre-validates (`ScanFlow.tsx:97-101`). No throw path. |
| 7 | Amount validated; negative/zero rejected with clear message | **PASS** | Independently fuzzed the cents+schema path: `-5`, `0`, `0.004`, `99999999`, `3.5e10`, `abc`, blank, `Infinity`, `NaN` all rejected; only positive int cents ≤ $5,000 pass (`schemas/scan.ts:31-35`). Re-enforced server-side (`scan.ts:151-157`). Sub-1-point amount → "too small to earn a point" (`scan.ts:175-177`). |
| 8 | Camera-permission-denied has usable manual fallback | **PASS** | `QRScanner.tsx:110-114` maps `NotAllowedError`/`SecurityError`→`denied`, else→`unsupported`; both render a keyboard-operable "Enter code manually" `Button` (`:164-167`). `ScanFlow` also has a persistent "Enter code" tab — never a dead end. |

All 8 acceptance criteria **PASS**.

---

## DEFECT LIST

No CRITICAL or MAJOR defects. All findings are deferrable.

### MINOR

**M-1 — Re-arm re-opens the confirm sheet for the same just-scanned QR (UX, not a double-add).** *(deferrable)*
`src/components/qr/ScanFlow.tsx:105-111,140-145`
After a successful add, `closeSheet()` → `reArmScanner()` restarts the camera with
`handledRef=false`. If the admin is still pointed at the same physical QR, it
re-`onDetected`s → `resolveToken` → the confirm sheet **re-opens** for the same
customer. Points are NOT double-added (the 4 s `lastAddRef` dedupe + `submitting`
guard hold — verified), but the staff sees a spurious re-prompt they must dismiss.
*Why it matters:* mild in-shop friction / confusion. *Fix direction:* after a
successful add, keep the scanner disarmed briefly, or seed `handledRef`/a cooldown
so the just-resolved token isn't immediately re-resolved. Not blocking.

**M-2 — Dedupe window protects only the SAME customer, and only client-side.** *(deferrable)*
`src/components/qr/ScanFlow.tsx:51,142-145`
The `DEDUPE_WINDOW_MS` guard keys on `customer.id`. It correctly stops an accidental
double-tap on one customer, and `submitting` disables the button during the in-flight
request (so the realistic double-tap race is covered). But the guard is purely UI
state — there is **no server-side idempotency key** on `add_points`. Two independent
rapid submissions that both pass the button-disable race (e.g. action retried after a
flaky network, or two tabs) would each insert an `earn` row. The DB has no dedupe.
*Why it matters:* the earn pipeline is not idempotent at the source of truth; under
pathological retries a purchase could be credited twice. PLAN lists server-side
idempotency as *optional* ("optional short-window dedupe"), so this meets the bar,
but it is the one place the guarantee is softer than ideal. *Fix direction (future):*
an idempotency token / unique constraint on (staff, target, amount, short-bucket), or
accept as documented residual risk. Not blocking for Phase 5.

### NIT

**N-1 — `QRDisplay` does not clamp `size` to the ≥200px minimum.** `QRDisplay.tsx:24,52`
`size` is a free prop (default 232 is fine). A future caller passing `size={120}`
would silently violate the §5.5 ≥200px rule. Currently only called with the default,
so no live violation. Consider `Math.max(size, 200)` or a documented invariant.

**N-2 — Dollar→cents rounds up at the half-cent.** `ScanFlow.tsx:114-120`
`"3.999"` → `Math.round(3.999*100)=400` cents ($4.00), a ≤0.5¢ over-credit. Bounded
and customer-favorable; standard rounding. Cosmetic only.

**N-3 — `note` is wired through schema + action + RPC but never collected by the UI.**
`scan.ts:140-188`, `schemas/scan.ts:48-52`
Dead-but-harmless plumbing reserved for Phase 9. Always passes `undefined` today.

**N-4 — `points`-entry path exists in schema/action but the staff sheet only exposes `$`.**
`schemas/scan.ts:41-45,60-70`, `ScanFlow.tsx:129`
Intentional (in-shop mental model is "$X"), but it's untested surface area shipped
ahead of use. Acceptable; flag for awareness.

---

## DESIGN GATE (§14) — PASS

- **QRDisplay:** white tile in BOTH modes (hard-coded, never inverts — scannability
  preserved), 4-module quiet zone, ≥200px default, sits on a `surface-tertiary`
  dark-mode-safe card (`QrTokenCard.tsx:50`). "Rotate code" is a **tertiary** button
  (`QrTokenCard.tsx:64`) — correct hierarchy. Rotation flows into the QR in place.
- **QRScanner:** reticle + dimmed surround (`QRScanner.tsx:180-188`), torch toggle
  shown only when the track reports the capability (`:99-107,202-211`) with
  `aria-pressed`, manual fallback always present. Starting/error states designed.
- **ScanFlow confirm sheet:** Radix `Sheet` (focus-trap, **Esc**, focus restore for
  free), `SheetTitle`/`SheetDescription` show customer **name + email + balance**
  (`ScanFlow.tsx:301-307`), live points preview (`:331-337`), CTA pending/disabled
  states (`:349-352`).
- **A11y:** scanner viewport `aria-label`, overlay `aria-hidden`; amount error is
  `role="alert"` + `aria-invalid`/`aria-describedby`; mode switch is a proper
  `tablist`/`tab` with `aria-selected`; state never by color alone (icon + text on
  every control); ≥44pt targets via shared `Button`/`Input`. Permission-denied is
  keyboard-operable, never a dead end.

No design defects rise above NIT.

---

## BUILD GATES (real output, clean `.next`)

```
rm -rf .next
npx tsc --noEmit          → TSC_EXIT=0   (no type errors)
npm run lint              → ✔ No ESLint warnings or errors   LINT_EXIT=0
npm run build             → ✓ Compiled successfully; ✓ 18/18 static pages   BUILD_EXIT=0
```

Route table (relevant rows):
```
├ ƒ /dashboard                 44.7 kB   256 kB
├ ƒ /qr                        4.55 kB   144 kB
├ ƒ /scan                       7.7 kB   151 kB
ƒ Middleware                            104 kB
```
The only build warning is the **pre-existing** `@supabase/supabase-js`
`process.version` Edge-Runtime notice from the middleware client (present since
Phase 3) — unrelated to Phase 5.

**Code-split proof (independently verified):** `@zxing`/`BrowserQRCodeReader` appears
ONLY in dedicated chunks `733.*` and `896.*`. Cross-referencing
`.next/app-build-manifest.json`: neither `/dashboard`, `/qr`, NOR even `/scan`'s
static page entry lists those chunks (zxing is loaded purely at runtime via the
nested `import('@zxing/browser')` on camera start). A customer's `/dashboard` and
`/qr` do **not** ship the scanner library. Perf budget §11 satisfied.

---

## TOP-3 FOR THE FIXER (all deferrable — none block approval)

1. **M-1** — Stop the confirm sheet re-opening on the same just-scanned QR after a
   successful add (cooldown / keep disarmed briefly).
2. **M-2** — Decide on server-side `add_points` idempotency (unique key / bucket) or
   formally accept the documented residual double-credit risk under retries.
3. **N-1** — Clamp `QRDisplay` `size` to ≥200px (or assert the invariant) so a future
   caller can't silently break §5.5.

## FINAL

**A− · APPROVED.** The security model — the whole point of this high-risk phase —
is sound and defense-in-depth (four independent server gates, RLS-bound client, no
service-role key, RPC-level admin re-check). Payload is provably PII-free. All 8
acceptance criteria pass, all gates are green, and the scanner is genuinely
code-split off customer routes. Remaining items are minor/cosmetic and safe to defer
to the Fixer or Phase 9.
