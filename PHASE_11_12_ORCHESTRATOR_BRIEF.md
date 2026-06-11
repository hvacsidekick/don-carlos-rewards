# Phase 11-12 Orchestrator Brief

## Mission
Drive Don Carlos Rewards App to 100% completion and production deployment.

**Current state:** Phases 0-10 ✅ Verified (83% complete)  
**Your goal:** Complete Phase 11 + Phase 12 → **SHIP** 🚀

## Authority
- **Full permission granted by Robin** — no confirmation gates
- **Tools available:**
  - `claude --chrome --permission-mode bypassPermissions` for Supabase dashboard, Vercel, browser UI testing
  - Terminal, file system, all deployment tools
  - Browser navigation for authenticated dashboards
- **Autonomous decisions:** Provision infrastructure, deploy, configure production settings

## Phase 11 — PWA + Performance + Accessibility Polish

**Objective:** Production-ready PWA with offline support, performance tuning, and accessibility verification.

**Read first:**
- `~/don-carlos-rewards/PLAN.md` Phase 11 section (lines 362-395)
- `~/don-carlos-rewards/BLUEPRINT.md` §10 (deployment)
- `~/don-carlos-rewards/PHASE_LOG.md` (current state)

**Scope:**
1. **PWA Manifest + Service Worker**
   - `manifest.json` with app name, icons, theme colors, display mode
   - Service worker for offline fallback (or Next.js built-in PWA)
   - Install prompt handling
   - Splash screen configuration

2. **Performance Optimization**
   - Run Lighthouse audit (target ≥90 all metrics)
   - Image optimization verification (already using `next/image`)
   - Bundle size analysis (`npm run build` output)
   - Lazy loading verification

3. **Accessibility Verification**
   - **Use `claude --chrome`** to navigate the deployed dev app
   - Test keyboard navigation through all flows
   - Verify screen reader announcements (check `aria-live`, `role=alert`, heading hierarchy)
   - Color contrast re-verification (already done in Phase 1/4, spot-check)
   - Focus management (dialogs, modals, route changes)

4. **Cross-browser Testing**
   - Chrome (via `--chrome`)
   - Safari mobile simulation (if possible)
   - Dark mode + light mode both verified

**Quality Gate:** Builder → Auditor → Verifier (Fixer if needed)

**Deliverables:**
- `PHASE_11_BUILD_COMPLETE.md`
- `PHASE_11_AUDIT_REPORT.md`
- `PHASE_11_VERIFIED.md`
- Updated `PHASE_LOG.md` with ✅ status

## Phase 12 — Production Deployment + Launch Audit

**Objective:** Deploy to production and verify it works end-to-end.

**Deployment-Gated Items (from Phase 10):**

### You Must Provision (via `claude --chrome`):

1. **Supabase Production Settings:**
   - ✅ Generate real `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Settings → API)
   - ✅ Configure custom SMTP (Supabase dashboard → Authentication → Email Templates → SMTP settings)
   - ⚠️ **SKIP leaked-password protection** if it blocks — Robin will handle this toggle manually
   - ✅ Production rate-limit store: Set up Upstash Redis or Vercel KV (get connection string)

2. **Vercel Deployment:**
   - ✅ Connect GitHub repo `hvacsidekick/don-carlos-rewards` to Vercel
   - ✅ Add all required env vars:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (freshly generated)
     - Rate limit store connection string (if using Upstash/KV)
   - ✅ Set production CORS in Supabase dashboard (allow `*.vercel.app`)
   - ✅ Deploy to production

3. **Launch Audit (via `claude --chrome`):**
   - Navigate to production URL
   - Test critical user journeys:
     - Sign up → email confirmation → login
     - View rewards card → scan QR (if possible)
     - Browse menu, view transaction history
     - Admin login → scan QR → add points → verify user sees update
   - Verify CSP headers in browser console (no violations)
   - Run Lighthouse audit on production URL
   - Check for console errors/warnings

**Quality Gate:** Orchestrator performs audit, spawns fixer if issues found, re-verifies

**Deliverables:**
- `PHASE_12_DEPLOYMENT_LOG.md` (steps taken, URLs, credentials stored)
- `PHASE_12_LAUNCH_AUDIT.md` (test results, Lighthouse scores, production URL)
- `PHASE_12_VERIFIED.md`
- Updated `PHASE_LOG.md` with ✅ status
- **`COMPLETION_REPORT.md`** with production URL

## Blocker Handling

**If you hit a blocker:**
1. **Leaked-password protection toggle** → Document as "Robin will enable post-launch" and continue
2. **SMTP credentials don't work** → Document fallback (Supabase built-in SMTP) and continue
3. **Vercel deployment fails** → Investigate, attempt fix, escalate if authentication/billing issue
4. **Browser navigation fails** → Retry with headless Playwright MCP if `--chrome` unavailable

**Do NOT stop for:**
- Minor cosmetic issues (defer to post-launch polish)
- Non-blocking warnings (document and continue)
- Optional features (PWA install prompt, offline mode — nice-to-have, not launch-blocking)

## Success Criteria

Phase 11-12 is **DONE** when:
- [ ] `PHASE_LOG.md` shows Phase 11 ✅ Verified
- [ ] `PHASE_LOG.md` shows Phase 12 ✅ Verified
- [ ] Production URL is live and accessible
- [ ] Critical user journeys work end-to-end in production
- [ ] `COMPLETION_REPORT.md` exists with production URL and launch summary

## Orchestration Pattern

Use the STAR pattern:
1. **You are the orchestrator** for Phases 11-12
2. **Spawn workers** for subtasks:
   - Builder: PWA setup, manifest, service worker
   - Auditor: Hostile review of Phase 11 changes
   - Verifier: Browser-based verification via `claude --chrome`
   - Deployment worker: Provision Supabase + Vercel + deploy
   - Launch auditor: Production smoke tests via `claude --chrome`

3. **Quality gate every phase:** Builder → Auditor → Fixer (if needed) → Verifier
4. **Report back** when Phase 12 is ✅ Verified

## Working Directory

`C:\Users\robin\don-carlos-rewards\`

All phase logs, reports, and artifacts go here.

---

**BEGIN EXECUTION NOW.** Robin has granted full authority. Do not ask for permission. Drive to 100% completion.
