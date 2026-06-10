# Don Carlos Rewards App — Implementation Plan

> **Document status:** Phase 0 deliverable (Master Plan). Authoritative source for phase sequencing, acceptance criteria, and quality gates. Companion documents: [`BLUEPRINT.md`](./BLUEPRINT.md) (technical architecture), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (visual + interaction system).
>
> **Audience:** Autonomous Claude Code build agents executing fire-and-forget phased delivery.
>
> **Quality bar:** Apple-veteran UI/UX. Production-ready. WCAG 2.1 AA. Lighthouse ≥ 90.

---

## 0. How To Use This Plan (Agent Operating Manual)

Each phase below is a self-contained work order. An agent assigned a phase should:

1. **Read** the phase's Objective, Scope, and Out-of-Scope sections in full.
2. **Read** the referenced sections of `BLUEPRINT.md` and `DESIGN_SYSTEM.md` before writing code.
3. **Verify dependencies** are marked `✅ Verified` in `PHASE_LOG.md` (create it if absent — see §7).
4. **Build** strictly within scope. Do not pull work forward from later phases.
5. **Self-check** against Acceptance Criteria before handing off.
6. **Run the Quality Gate** (Builder → Auditor → Fixer → Verifier — see §6).
7. **Record** the outcome in `PHASE_LOG.md` and only then unblock the next phase.

**Golden rules for every phase:**

- Zod validation on every external input (forms, API routes, server actions, webhooks, URL params). No exceptions.
- RLS enabled and policy-tested on every table touched.
- `SUPABASE_SERVICE_ROLE_KEY` never imported into a Client Component or any `"use client"` module. Server-only.
- Every interactive element ≥ 44×44pt and keyboard-reachable.
- No `any` in TypeScript. Strict mode on.
- Every new component renders correctly in light AND dark mode before it is considered done.
- Commit per logical unit; one branch per phase (`phase/<n>-<slug>`).

---

## 1. Phase Structure Overview

| Phase | Name | Effort | Depends On | Gate |
|-------|------|--------|-----------|------|
| 0 | Master Planning *(this document)* | — | — | ✅ done |
| 1 | Project Scaffold + Design System Foundation | M | 0 | required |
| 2 | Database Schema + Supabase Setup + RLS | M | 1 | required |
| 3 | Authentication (email/password + OAuth + Apple) | L | 2 | required |
| 4 | Rewards Card UI (Stamp Grid + Progress Ring) | L | 1, 3 | required |
| 5 | QR System (generate + scan + points pipeline) | L | 2, 3, 4 | required |
| 6 | Transaction History | M | 2, 3, 5 | required |
| 7 | Menu Browser | M | 1 | required |
| 8 | Location & About | S | 1 | required |
| 9 | Admin Portal (scan, customers, adjust, analytics) | L | 5, 6 | required |
| 10 | Security Hardening + Compliance (RLS audit, rate limit, CSP, GDPR, privacy/TOS) | L | all above | required |
| 11 | PWA + Performance + Accessibility Polish | M | all above | required |
| 12 | Production Deployment + Launch Audit | M | 10, 11 | required |

**Critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 9 → 10 → 12.
**Parallelizable once Phase 1 lands:** Phase 7 (Menu) and Phase 8 (About) have no dependency on auth/db and can be built by separate agents concurrently with the 3→4→5 chain.

**T-shirt sizing key:** S ≈ ½–1 focused session, M ≈ 1–2 sessions, L ≈ 2–4 sessions (one "session" = one bounded build+gate cycle).

---

## 2. Per-Phase Details

---

### Phase 1 — Project Scaffold + Design System Foundation

**Objective:** A running Next.js 15 App Router project with the full design-token system wired into Tailwind, shadcn/ui installed, fonts/dark-mode configured, and a component sandbox proving the tokens render.

**Scope:**
- `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/` dir, import alias `@/*`).
- Tailwind config with Don Carlos color tokens, Apple type ramp, 4px spacing scale, `darkMode: 'media'` (see `DESIGN_SYSTEM.md` §Color, §Typography, §Spacing).
- CSS custom properties for all tokens in `globals.css` (light + dark blocks).
- shadcn/ui init + install base components: `button`, `card`, `input`, `label`, `dialog`, `sheet`, `dropdown-menu`, `toast`/`sonner`, `skeleton`, `avatar`, `badge`, `tabs`, `form`.
- Framer Motion installed; spring presets exported from `lib/motion.ts`.
- Zod + `react-hook-form` + `@hookform/resolvers` installed.
- Supabase client libs installed (`@supabase/supabase-js`, `@supabase/ssr`).
- `lib/utils.ts` (`cn` helper), `lib/env.ts` (Zod-validated env loader — fails fast on missing vars).
- App shell: root layout with font stack, `<html lang="en">`, viewport meta, theme-color metadata, bottom tab navigation skeleton (Dashboard / Menu / Rewards QR / Profile).
- `/_sandbox` route (dev-only) rendering every color swatch, type-ramp sample, spacing scale, and base components in both modes for visual QA.
- `README.md` with setup steps; `.env.example` with all required keys (no values).
- ESLint/Prettier config; `tsconfig` strict.

**Out-of-scope:** Any DB calls, auth, real pages beyond the shell + sandbox.

**Acceptance Criteria:**
- [ ] `npm run dev` boots with zero errors/warnings; `npm run build` succeeds.
- [ ] `/_sandbox` displays all tokens correctly in light and dark (toggle OS theme to verify).
- [ ] Color contrast on sample text passes 4.5:1 (verify with a contrast checker).
- [ ] `lib/env.ts` throws a clear error when a required env var is missing.
- [ ] Bottom tab bar renders, is keyboard-navigable, tab targets ≥ 44pt.
- [ ] `tsc --noEmit` clean; ESLint clean.

**Effort:** M  **Risk:** Low. *Watch:* shadcn/Tailwind v4 vs v3 config differences — pin and document the Tailwind version used.

---

### Phase 2 — Database Schema + Supabase Setup + RLS

**Objective:** A fully migrated Supabase Postgres schema with RLS policies, triggers, and seed data; typed client helpers generated; all policies proven by test.

**Scope:**
- Create Supabase project (or connect existing). Record project ref in `BLUEPRINT.md` deployment section.
- Migration files (versioned, in `supabase/migrations/`) implementing the schema in `BLUEPRINT.md` §Database Schema: `profiles`, `transactions`, `rewards_config`, `menu_categories`, `menu_items`, `audit_log`.
- `is_admin` flag on `profiles` (default false); `qr_token` UUID per profile (unique, indexed).
- Trigger: on `auth.users` insert → create `profiles` row (handle email, default points 0).
- Trigger: `updated_at` auto-touch on `profiles`.
- **Points mutations happen ONLY via a `SECURITY DEFINER` Postgres function** (`add_points`, `redeem_points`) that (a) validates the caller is admin for `add_points`, (b) computes new balance atomically, (c) writes the `transactions` row, (d) updates `profiles.points_balance` — all in one transaction. Clients never UPDATE `points_balance` directly; an RLS policy forbids it.
- RLS policies per `BLUEPRINT.md` (users read/update own profile but NOT points columns; users read own transactions; admins read all; menu tables public-read).
- Indexes: `transactions(user_id, created_at desc)`, `profiles(qr_token)`, `profiles(is_admin)`.
- `npx supabase gen types typescript` → `lib/database.types.ts`.
- Seed script: menu categories + ~20 realistic Don Carlos items (use menu from PLANNING_TASK), `rewards_config` row (earn rate, redeem threshold, redeem value).
- Document how to promote a user to admin (SQL snippet) in README.

**Out-of-scope:** UI, auth flows (just the trigger plumbing).

**Acceptance Criteria:**
- [ ] All migrations apply cleanly from scratch on a fresh DB.
- [ ] RLS is `enabled` on every table in `public` (verify via `get_advisors` / `pg_policies`).
- [ ] A non-admin user **cannot** read another user's transactions or profile (proven by test query under that user's JWT).
- [ ] A non-admin user **cannot** UPDATE `points_balance` directly (denied by policy/trigger).
- [ ] `add_points` rejects a non-admin caller; succeeds for admin and writes both the transaction and the new balance atomically.
- [ ] `redeem_points` rejects when balance < threshold; on success decrements balance and logs a `redeem` transaction.
- [ ] New `auth.users` insert auto-creates a `profiles` row with a `qr_token`.
- [ ] `supabase get_advisors` reports zero security advisories (or each is explicitly justified in PHASE_LOG).
- [ ] Generated types compile.

**Effort:** M  **Risk:** Medium. *Watch:* RLS recursion (admin-check policy that queries `profiles` can self-recurse — use a `SECURITY DEFINER` helper `is_admin()` function or a JWT claim to avoid it). Atomicity of points mutations is the single most important correctness property in the app — get the SECURITY DEFINER functions right.

---

### Phase 3 — Authentication

**Objective:** Complete auth: email/password signup+login with verification, Google OAuth, Apple Sign-In, session middleware, protected routes, and account deletion stub wired (full GDPR purge finalized in Phase 10).

**Scope:**
- `@supabase/ssr` server + browser client factories; Next.js middleware refreshing the session cookie on every request.
- Route groups + guards: `(auth)` public; `(user)` requires session; `(admin)` requires session AND `is_admin`.
- Pages: `login`, `signup`, `forgot-password`, `reset-password`, `auth/callback` (OAuth code exchange), `verify-email` notice.
- Server actions (`actions/auth.ts`): signup, login, logout, request-reset, update-password — all Zod-validated.
- Email/password with Supabase email confirmation enabled.
- Google OAuth provider configured + button.
- Apple Sign-In provider configured + button (required for iOS PWA). Document the Apple Developer setup (Service ID, key, return URLs) in BLUEPRINT deployment notes.
- Form UX per design system: inline field errors, loading states, disabled-while-submitting, friendly error copy (mascot empty/error states where appropriate).
- Redirect logic: unauthenticated → `/login?next=…`; authenticated hitting `(auth)` → dashboard; admin link only shown to admins.
- "Delete account" button in profile that calls a deletion server action (Phase 10 finalizes the purge; here it deletes the auth user + cascades).

**Out-of-scope:** Rate limiting (Phase 10), the actual dashboard content (Phase 4).

**Acceptance Criteria:**
- [ ] New user can sign up, receives verification email, confirms, and lands on dashboard.
- [ ] Login/logout works; session persists across reload and is refreshed by middleware.
- [ ] Forgot/reset password flow works end-to-end.
- [ ] Google + Apple sign-in complete the callback and create a `profiles` row.
- [ ] Visiting a `(user)` route while logged out redirects to `/login?next=`; after login, returns to `next`.
- [ ] Non-admin visiting any `(admin)` route is blocked (redirected, not 500).
- [ ] All auth forms validate with Zod; invalid input shows accessible inline errors (announced to screen readers).
- [ ] No secrets leak to the client bundle (grep build output for service-role key — must be absent).

**Effort:** L  **Risk:** Medium-High. *Watch:* Apple Sign-In setup is fiddly (requires Apple Developer account, Service ID, private key). If the Apple account isn't available at build time, ship email + Google and flag Apple as a blocked sub-task in PHASE_LOG (open question O-1). OAuth redirect URLs must include both localhost and the Vercel preview/prod domains.

---

### Phase 4 — Rewards Card UI (Stamp Grid + Progress Ring)

**Objective:** The signature screen. A hybrid stamp-card + Apple-Watch-style progress ring that reads the user's real points and animates beautifully at 60fps, with the redeem flow.

**Scope:**
- `components/rewards/ProgressRing.tsx` — animated SVG ring (stroke-dashoffset), props `{ progress, size, strokeWidth }`, respects `prefers-reduced-motion`.
- `components/rewards/StampGrid.tsx` — taco-icon stamp grid, filled vs outlined, spring fill-in animation, props `{ totalStamps, filledStamps }`.
- `components/rewards/RewardsCard.tsx` — composes ring + grid + status text + redeem CTA. Reads live profile (Server Component fetch → passes to client island for animation).
- Dashboard page (`(user)/dashboard`): rewards card hero, points balance, "X to next reward," recent-activity peek (last 3 transactions), quick link to QR.
- Redeem flow: CTA enabled only when `balance >= threshold`; confirm dialog; calls `redeemPointsAction`; optimistic UI + success celebration (confetti + haptic per design spec); error rollback.
- Celebration animation on reaching a reward tier (confetti, scale pulse, success haptic pattern).
- Realtime: subscribe to the user's `profiles` row so a staff scan updates the card live (stamp fills, ring advances) without refresh.
- Loading skeletons; empty/zero-points state (mascot).
- Haptics via `navigator.vibrate` guarded for support.

**Out-of-scope:** The QR generation/scan that triggers earns (Phase 5) — but build against the realtime channel so Phase 5 just works.

**Acceptance Criteria:**
- [ ] Ring + stamps reflect real `points_balance` and `rewards_config` threshold.
- [ ] Redeem CTA disabled below threshold; enabled at/above; redeem decrements balance and logs transaction (via Phase 2 function).
- [ ] Reaching threshold plays the celebration (confetti + haptic + sound-optional) exactly once.
- [ ] When points are added server-side (simulate via SQL/admin), the card updates live via realtime within ~1s.
- [ ] Animations hold ~60fps on a mid-range phone; `prefers-reduced-motion` disables non-essential motion.
- [ ] Fully styled and correct in dark mode; keyboard + screen-reader accessible (ring has `aria` progress semantics, redeem button labeled).
- [ ] Pixel-quality matches `DESIGN_SYSTEM.md` RewardsCard spec.

**Effort:** L  **Risk:** Medium. *Watch:* This is the "wow" screen — auditor should be hostile about animation polish, easing, and reduced-motion. Don't let realtime subscription leak (clean up on unmount).

---

### Phase 5 — QR System (generate + scan + points pipeline)

**Objective:** Customer shows a unique QR; staff scans it to add points; the full earn pipeline is atomic, validated, and reflected live on the customer's card.

**Scope:**
- `components/qr/QRDisplay.tsx` — renders the user's `qr_token` as a QR (high error correction, white bg always, 200×200 min, padding). Lives on profile + a prominent "Show QR" action from dashboard.
- The QR encodes the opaque `qr_token` (NOT the raw user id, NOT PII). Server resolves token → user.
- `components/qr/QRScanner.tsx` — admin-only camera scanner (`html5-qrcode` or `@zxing/browser`), permission handling, torch toggle if available, graceful fallback to manual user-id entry.
- Scan flow (admin): scan → resolve token to customer (server action) → show customer name + current balance → enter $ amount or points → confirm → `addPointsAction` (calls Phase 2 `add_points` SECURITY DEFINER fn, admin-checked) → success toast → customer card updates live.
- `$1 = 1 point` conversion in one place (from `rewards_config`).
- Idempotency / double-scan guard: prevent accidental double submission (disable on submit; optional short-window dedupe).
- Zod validation on token, amount, notes; reject negative/zero/oversized amounts.
- Rotate-token option (user can regenerate `qr_token` if compromised).

**Out-of-scope:** Full admin dashboard/analytics (Phase 9) — here, just the scan-to-add interaction (can live at `(admin)/scan`).

**Acceptance Criteria:**
- [ ] Customer QR renders, scannable at arm's length, white bg in dark mode.
- [ ] QR payload contains only the opaque token (verify by decoding — no email/uid/PII).
- [ ] Admin can scan a customer QR, see the right customer, add points; balance + transaction update atomically.
- [ ] Non-admin calling `addPointsAction` is rejected server-side (defense in depth beyond UI hiding).
- [ ] Customer's rewards card updates live after a scan (Phase 4 realtime).
- [ ] Invalid/expired/garbage QR shows a friendly error, no crash.
- [ ] Amount input validated; negative/zero rejected with clear message.
- [ ] Camera-permission-denied path has a usable manual fallback.

**Effort:** L  **Risk:** Medium-High. *Watch:* Camera/getUserMedia requires HTTPS (works on localhost + Vercel). Test scanning on a real phone — desktop webcam is not representative. Security: the entire trust boundary is "is the caller an admin" — verify server-side, never trust the client.

---

### Phase 6 — Transaction History

**Objective:** An elegant, Apple-Pay-style transaction list with running balances, grouping, and pagination.

**Scope:**
- `(user)/transactions` page: chronological list grouped by date (Today / Yesterday / month), each row shows type (earn/redeem/adjustment) icon, points delta (+/−, color-coded), balance-after, timestamp, optional note/location.
- Server-side pagination or infinite scroll (cursor on `created_at`).
- Filters: All / Earned / Redeemed (optional but nice).
- Empty state (mascot "No transactions yet — go grab a taco!").
- Loading skeletons matching row layout.
- Pull-to-refresh / refresh affordance (optional).
- Reuse the design-system list primitives; ensure dark mode + a11y (list semantics, each row reachable).

**Out-of-scope:** Admin's all-users transaction log (Phase 9).

**Acceptance Criteria:**
- [ ] Shows only the signed-in user's transactions (RLS-enforced, verified).
- [ ] Correct sign/color per type; balance-after matches ledger.
- [ ] Pagination/infinite scroll works; no duplicate or skipped rows at page boundaries.
- [ ] Empty + loading + error states all present and styled in both modes.
- [ ] Accessible: screen reader announces each transaction meaningfully.

**Effort:** M  **Risk:** Low.

---

### Phase 7 — Menu Browser *(parallelizable after Phase 1)*

**Objective:** A beautiful, photography-forward, browse-only menu organized by category. Not ordering.

**Scope:**
- `(user)/menu` (and a public `/menu` is acceptable since it's non-sensitive): category sections (Tacos, Burritos, Breakfast, Quesadillas, Tortas…), each with `MenuItem` cards (16:9 photo, name, price, description).
- Data from `menu_categories` / `menu_items` (Phase 2 seed). Server Component fetch (public-read RLS).
- Sticky category nav / segmented control to jump between sections.
- Image optimization via `next/image`; blur placeholders; graceful fallback when an item has no photo (mascot/placeholder).
- Price formatting; dietary tags optional.
- Skeletons; responsive grid (1-col phone, 2–3 col tablet/desktop).

**Out-of-scope:** Cart, ordering, payments. Admin menu CRUD (could be a Phase 9 stretch).

**Acceptance Criteria:**
- [ ] All seeded categories + items render with correct prices/descriptions.
- [ ] Category navigation jumps/scrolls correctly; sticky header behaves.
- [ ] Images lazy-load, optimized, with placeholders; missing-image fallback works.
- [ ] Responsive + dark mode + a11y (headings hierarchy, alt text on every food image).
- [ ] No layout shift on image load (CLS < 0.1 on this page).

**Effort:** M  **Risk:** Low. *Watch:* Real food photography may not exist yet — seed with placeholders and flag asset delivery as open question O-3.

---

### Phase 8 — Location & About *(parallelizable after Phase 1)*

**Objective:** Find-us screen with map, hours, contact, and directions.

**Scope:**
- `/about` page: embedded Google Map centered on `7475 W 52nd Ave, Arvada, CO 80002`, address, hours (Mon–Sat 7am–8pm, Sun closed) with **today's status** ("Open now" / "Closed" computed client-side from local time), phone (tap-to-call), "Get Directions" deep link (maps URL), social links if any.
- Use Google Maps Embed API (iframe, no JS key exposure) or a static map fallback to avoid leaking an unrestricted key.
- A small "about the shop" blurb + mascot.

**Out-of-scope:** Live order status, reservations.

**Acceptance Criteria:**
- [ ] Map shows the correct pin; directions link opens native maps with the destination.
- [ ] Hours display correctly; "Open now/Closed" reflects current Denver time and Sunday-closed.
- [ ] Phone is tap-to-call on mobile.
- [ ] Dark mode + a11y; map has an accessible text alternative (address).

**Effort:** S  **Risk:** Low. *Watch:* Restrict any Google Maps API key by referrer/domain; prefer the keyless Embed iframe.

---

### Phase 9 — Admin Portal

**Objective:** Staff tooling: scan-to-add (from Phase 5), manual point adjustment with audit trail, customer list + balances + search, full transaction log, and an analytics dashboard.

**Scope:**
- `(admin)` layout with admin-only nav; guarded by middleware + server check.
- `(admin)/scan` — the Phase 5 scan flow, finalized.
- `(admin)/customers` — searchable, paginated customer list (name, email, balance, lifetime earned, last activity). Click → customer detail: profile, balance, transaction history, **manual adjust** (add/subtract points with mandatory reason note → `adjustment` transaction via SECURITY DEFINER fn) and **redeem on behalf** for in-person redemption.
- `(admin)/analytics` — KPI cards: total customers, active (30d), total points issued, total redemptions, points outstanding (liability), redemption rate; simple time-series chart of points issued/redeemed; top customers. All numbers from aggregate queries (RPC or views, admin-RLS protected).
- Audit log: every admin action (add/adjust/redeem-on-behalf, token rotation) writes to `audit_log` with actor, target, delta, reason, timestamp.
- Optional: menu item CRUD for staff (stretch).

**Out-of-scope:** Multi-tenant/multi-location, payroll, POS integration.

**Acceptance Criteria:**
- [ ] Only admins can reach any `(admin)` route or call any admin action (verified server-side, not just hidden UI).
- [ ] Manual adjustment requires a reason; writes an `adjustment` transaction + `audit_log` entry; updates balance atomically.
- [ ] Customer search + pagination correct; balances match ledgers.
- [ ] Analytics numbers are correct against seed/test data (spot-check the math).
- [ ] Every admin mutation appears in the audit log with the correct actor.
- [ ] Dark mode + responsive (admin may use a tablet) + a11y.

**Effort:** L  **Risk:** Medium. *Watch:* Analytics aggregates over all rows must run as admin-authorized RPCs/views — don't expose a path that lets a normal user run them. Keep liability math (points outstanding) consistent with the ledger.

---

### Phase 10 — Security Hardening + Compliance

**Objective:** Close every item on the security & compliance checklist; the app is safe to expose publicly.

**Scope:**
- **RLS audit:** re-review every policy; run `get_advisors`; attempt cross-user reads/writes as tests; confirm points columns are write-protected from clients.
- **Zod coverage audit:** every API route, server action, and webhook validates input; reject + 400 on failure with safe error messages.
- **Secret hygiene:** confirm service-role key is server-only; scan client bundle; ensure no secrets in git history.
- **Rate limiting:** auth endpoints (login, signup, reset) 5/min/IP; admin add-points throttled sensibly. Use Upstash Redis or Vercel KV + middleware (document choice in BLUEPRINT).
- **Security headers / CSP:** strict Content-Security-Policy, HSTS, `X-Frame-Options`/frame-ancestors, `Referrer-Policy`, `X-Content-Type-Options`, Permissions-Policy (camera only where needed). Configure in `next.config` headers + middleware.
- **CORS:** lock to the Vercel domain(s).
- **Supabase Auth hardening:** enable leaked-password protection (HaveIBeenPwned), reasonable password policy, email confirmation required, secure JWT expiry.
- **GDPR / account deletion:** finalize purge — deleting account removes auth user + cascades profile/transactions, and anonymizes or removes any audit references per policy; provide a data-export (download my data) option.
- **Privacy Policy + Terms of Service** pages, linked from signup + footer.
- **Input/abuse:** validate QR amounts, prevent negative points, cap single-add amount, audit admin actions (done Phase 9 — verify).

**Acceptance Criteria:**
- [ ] `get_advisors` (security) returns clean; documented exceptions only.
- [ ] Automated/manual cross-tenant access tests all fail to leak.
- [ ] Rate limiting demonstrably blocks the 6th auth attempt in a minute.
- [ ] CSP + security headers present on all responses (verify via curl/securityheaders.com); no CSP violations in console during normal use.
- [ ] Service-role key absent from client bundle (grep).
- [ ] Account deletion fully purges user data; export produces the user's data.
- [ ] Privacy Policy + TOS published and linked.
- [ ] Leaked-password protection enabled.

**Effort:** L  **Risk:** High (this is the gate that makes or breaks public launch). *Watch:* CSP often breaks Supabase/Maps/QR libs — build the policy incrementally and test every page. Don't ship `unsafe-inline` for scripts without nonces.

---

### Phase 11 — PWA + Performance + Accessibility Polish

**Objective:** Installable PWA, Lighthouse ≥ 90 across the board, WCAG 2.1 AA verified, performance budget met.

**Scope:**
- **PWA:** web app manifest (name, icons incl. maskable, theme/background colors, display standalone, start_url), iOS meta tags (`apple-touch-icon`, status bar), service worker for offline shell + asset caching (next-pwa or Serwist), "Add to Home Screen" prompt UX. Apple Sign-In already in place (Phase 3) for iOS install legitimacy.
- **Performance:** image optimization audit, code-splitting, font loading strategy, remove unused JS, lazy-load heavy libs (QR scanner only on admin scan route), Lighthouse CI. Meet budget: FCP <1.5s, LCP <2.5s, TTI <3.5s, CLS <0.1, TBT <200ms.
- **Accessibility:** full keyboard pass, focus-visible everywhere, ARIA on custom widgets (ring, stamp grid, scanner, tabs), color-contrast audit, screen-reader pass on core flows, reduced-motion honored, all images alt-texted, forms announce errors.
- **Cross-device QA:** iOS Safari, Android Chrome, desktop; light + dark; small + large phones.

**Acceptance Criteria:**
- [ ] App installs to home screen on iOS + Android and launches standalone.
- [ ] Offline: app shell loads; sensible offline messaging for data.
- [ ] Lighthouse ≥ 90 Performance, Accessibility, Best Practices, SEO (mobile profile) on key pages.
- [ ] Performance budget metrics met on a throttled mid-range device.
- [ ] Zero critical axe/a11y violations; full keyboard operability verified.

**Effort:** M  **Risk:** Medium. *Watch:* Service worker caching can serve stale auth/data — scope caching to static assets + shell, never cache authed API responses incorrectly.

---

### Phase 12 — Production Deployment + Launch Audit

**Objective:** Live on Vercel with production Supabase, all env/secrets configured, OAuth redirect URLs set for prod, monitoring on, and a final end-to-end launch audit passed.

**Scope:**
- Vercel project linked; production + preview env vars set (Supabase URL/anon/service-role, app URL, maps/embed, rate-limit store creds).
- Production Supabase: migrations applied, RLS verified on prod, seed (menu) loaded, an initial admin account promoted.
- OAuth (Google/Apple) redirect URLs include prod domain; Apple Service ID return URLs updated.
- Custom domain (if provided) + HTTPS; otherwise `*.vercel.app`.
- Error monitoring (Sentry or Vercel observability) + uptime; basic analytics.
- Lighthouse CI gate in pipeline; preview deploys for branches.
- **Launch audit (full E2E on prod):** signup→verify→login (all providers), earn via real phone scan, see live card update, redeem, view history, browse menu, find location, admin scan + adjust + analytics, account deletion. Run Playwright E2E for the critical flows.
- Rollback plan documented (revert deploy, migration-down strategy, feature flags for risky bits).
- Hand-off doc: how to add admins, edit menu, read analytics, rotate keys.

**Acceptance Criteria:**
- [ ] Production URL live over HTTPS; all envs correct; no secret in client.
- [ ] Every auth provider works on the prod domain.
- [ ] Full earn→redeem loop works on a real phone end-to-end in production.
- [ ] RLS + advisors clean on prod DB.
- [ ] Monitoring receives events; Lighthouse CI passes in pipeline.
- [ ] E2E suite green; rollback + ops hand-off documented.

**Effort:** M  **Risk:** Medium. *Watch:* Prod/preview env var drift and OAuth redirect mismatches are the most common launch-day failures. Verify Apple/Google callback URLs against the exact prod domain.

---

## 3. Dependency Graph

```
0 Planning
  └─> 1 Scaffold + Design Foundation
        ├─> 2 DB + RLS ──> 3 Auth ──┬─> 4 Rewards Card ──> 5 QR System ──> 6 Tx History ─┐
        │                           │                                                     ├─> 9 Admin ─┐
        │                           └────────────────────────────────────────────────────┘            │
        ├─> 7 Menu (parallel)                                                                           ├─> 10 Security ─> 11 PWA/Perf/A11y ─> 12 Deploy + Launch Audit
        └─> 8 About (parallel)                                                                          │
                                                                                                        (9 feeds 10)
```

- Phases **7** and **8** can be built concurrently by separate agents as soon as Phase 1 is verified.
- Everything funnels through **10 → 11 → 12** at the end; none of those may start until all feature phases are `✅ Verified`.

---

## 4. Effort Summary

| Size | Phases | Notes |
|------|--------|-------|
| S | 8 | Quick, low-risk |
| M | 1, 2, 6, 7, 11, 12 | Standard build+gate cycles |
| L | 3, 4, 5, 9, 10 | The hard, high-value, high-risk work |

**Highest-risk phases (allocate the most audit scrutiny):** 2 (points-mutation atomicity & RLS), 3 (Apple Sign-In), 5 (real-device camera + admin trust boundary), 10 (security/compliance for public launch).

---

## 5. Risk Register

| ID | Risk | Phase | Likelihood | Impact | Mitigation |
|----|------|-------|-----------|--------|-----------|
| R-1 | Points balance corruption / race (double-add, partial write) | 2,5 | Med | **Critical** | All mutations via single-transaction `SECURITY DEFINER` fns; clients can't write balance; idempotency guard on scan; ledger = source of truth, balance is derived/checked. |
| R-2 | RLS misconfig leaks user data | 2,9,10 | Med | Critical | Policy tests per phase; `get_advisors` gate; cross-tenant access tests in Phase 10; admin checks server-side, never UI-only. |
| R-3 | Apple Sign-In setup blocked (no dev account) | 3 | Med | High | Ship email+Google first; isolate Apple as a flag; track as O-1. Required before iOS PWA store-style submission but not for web launch. |
| R-4 | Camera scanning fails on real devices | 5 | Med | High | Test on physical iOS+Android early; HTTPS required; manual user-id fallback always available. |
| R-5 | Service-role key leaks to client | 3,10 | Low | Critical | Server-only imports; bundle grep in Phase 10 gate; lint rule if feasible. |
| R-6 | CSP breaks third-party libs (Supabase realtime, Maps, QR) | 10 | High | Med | Build CSP incrementally per page; use nonces; test every route; document allowed origins. |
| R-7 | Animations jank / fail reduced-motion | 4 | Med | Med | Profile on mid-range device; honor `prefers-reduced-motion`; GPU-friendly transforms only. |
| R-8 | Missing brand assets (real photos, mascot SVG, exact hex) | 1,4,7 | High | Med | Proceed with documented placeholders + the hex in DESIGN_SYSTEM; track asset delivery as O-2/O-3; design so swapping assets is trivial. |
| R-9 | Env/OAuth drift between preview & prod | 12 | Med | High | Single env matrix in BLUEPRINT; verify redirect URLs against exact domains in launch audit. |
| R-10 | Rate-limit store dependency (Redis/KV) not provisioned | 10 | Low | Med | Choose Vercel KV/Upstash early; document; fallback to in-memory only for dev. |

---

## 6. Quality Gate Strategy (per phase)

Every required phase passes through four roles. Use separate agent invocations for Auditor and Verifier so they don't inherit the Builder's assumptions.

1. **Builder** — Implements the phase strictly within scope, following BLUEPRINT + DESIGN_SYSTEM. Self-checks acceptance criteria. Commits on `phase/<n>-<slug>`.
2. **Auditor (hostile)** — Tries to break it against **two axes**:
   - *Functionality & security:* acceptance criteria, edge cases, RLS/auth boundaries, Zod gaps, error states, build/typecheck/lint.
   - *Apple design standards:* spacing/hierarchy/typography fidelity to DESIGN_SYSTEM, animation quality, dark mode, 44pt targets, a11y. Produces a written defect list (severity-tagged).
3. **Fixer** — Surgical fixes for Auditor defects only. No scope creep, no refactors beyond the listed issues.
4. **Verifier (independent)** — Re-runs acceptance criteria + Auditor's defect list from scratch on a clean checkout. Confirms `tsc`, build, lint, and (where defined) tests are green. **Only the Verifier may mark the phase `✅ Verified` in `PHASE_LOG.md`.**

**Proceed rule:** A downstream phase may not begin until every phase it depends on is `✅ Verified`. If the Verifier finds defects, loop back to Fixer (or Builder for scope-level issues) — do not advance.

**Per-phase definition of done:** acceptance criteria met • `npm run build` + `tsc --noEmit` + ESLint clean • light & dark verified • a11y basics verified • RLS/Zod intact for any data touched • PHASE_LOG updated by Verifier.

---

## 7. Tracking & Rollback

**`PHASE_LOG.md`** (create at start of Phase 1) — one section per phase:
```
## Phase N — <name>
- Status: not-started | building | auditing | fixing | verifying | ✅ Verified
- Branch: phase/N-slug
- Builder notes:
- Auditor defects (sev):
- Fixer changes:
- Verifier confirmation (date, what was run):
- Deviations from plan / new open questions:
```

**Rollback strategy:**
- **Git:** one branch per phase; merge to `main` only after `✅ Verified`. Revert = revert the merge commit; redeploy previous Vercel deployment (instant).
- **Database:** every change is a versioned migration in `supabase/migrations/`; keep a tested down-migration or a documented manual revert for each. Never edit prod schema by hand outside a migration. Track applied migrations via Supabase's migration history.
- **Feature flags:** gate risky/incomplete features (e.g., Apple Sign-In, service worker, analytics) behind env-driven flags so they can be disabled in prod without a redeploy of code logic.
- **Data safety:** points ledger is append-only (`transactions`); never hard-delete a transaction to "fix" a balance — issue a compensating `adjustment`.

---

## 8. Cross-Cutting Standards (apply in every phase)

- **TypeScript strict**, no `any`, no non-null `!` without justification.
- **Zod** schemas colocated and reused between client form + server action + API route (single source of truth per input).
- **Server Components by default**; client islands only where interactivity/animation needs them.
- **Accessibility is acceptance, not polish** — a phase isn't done if its new UI fails keyboard/contrast/SR basics.
- **Dark mode is acceptance, not polish** — same.
- **Errors never crash** — every async path has a handled error + user-facing state.
- **No magic numbers for business rules** — earn rate, threshold, redeem value come from `rewards_config`.
- **Conventional commits**; small, reviewable units.

---

*End of PLAN.md — proceed to [`BLUEPRINT.md`](./BLUEPRINT.md) and [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) before implementing any phase.*
