# Phase 12 — Production Deployment + Launch Audit — DEPLOYMENT LOG

> Orchestrator executing Phase 12. Started 2026-06-11. Full authority per brief.

---

## 0. Pre-Deployment Checklist

### Current State (From Phase Log + BLUEPRINT)
- ✅ **Phases 0-11 verified** (all quality gates passed)
- ✅ **Project location:** `C:\Users\robin\don-carlos-rewards\`
- ✅ **Supabase dev project:** `uxgcyvexeehvhtuhmztc` (org HVAC SIdekick, us-west-1, PG17)
- ✅ **Git initialized** (local repo, no remote yet)
- ✅ **Build gates green** (tsc 0, tests 34/34, lint clean, build success)
- ✅ **GitHub repo target:** `hvacsidekick/don-carlos-rewards` (per brief)

### Deploy-Gated Items (From Phase 10/Brief)
Per PHASE_LOG Phase 10 carry-forwards and orchestrator brief §Phase 12:

1. **Real `SUPABASE_SERVICE_ROLE_KEY`** (current is dev placeholder)
2. **Custom SMTP** (Supabase dashboard → Authentication → Email Templates)
3. **Leaked-password protection** (HIBP toggle — may skip per brief if it blocks)
4. **Production rate-limit store** (Upstash Redis / Vercel KV — in-memory fallback ships)
5. **Production CORS lock** (allow Vercel domain in Supabase dashboard)

---

## 1. Deployment Steps — Planned Execution

### 1.1 GitHub Repository Setup

**Need to:**
1. Connect local repo to GitHub remote `hvacsidekick/don-carlos-rewards`
2. Push current state (all verified phases)
3. Ensure `.env.local` is gitignored (already verified ✅)

**Status:** PENDING (need GitHub auth or repo already exists)

### 1.2 Supabase Production Configuration

**Need to (via Supabase dashboard):**
1. Generate real `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → service_role key)
2. Configure custom SMTP (Authentication → Email Templates → SMTP settings)
3. Enable leaked-password protection (SKIP if blocks — per brief)
4. Set production CORS (Settings → API → CORS allow `*.vercel.app`)

**Status:** PENDING (need Supabase dashboard auth)

### 1.3 Vercel Deployment

**Need to (via Vercel dashboard):**
1. Create new project, connect GitHub repo `hvacsidekick/don-carlos-rewards`
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` (same as dev)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same as dev)
   - `SUPABASE_SERVICE_ROLE_KEY` (newly generated)
   - `NEXT_PUBLIC_APP_URL` (will be `https://*.vercel.app`)
   - `UPSTASH_REDIS_REST_URL` (optional, in-memory fallback ships)
   - `UPSTASH_REDIS_REST_TOKEN` (optional)
3. Deploy to production
4. Get production URL

**Status:** PENDING (need Vercel auth + Supabase production keys)

### 1.4 Production Rate-Limit Store (Optional)

**Options:**
- **Upstash Redis** (free tier available)
- **Vercel KV** (requires Vercel Pro)
- **Skip** (in-memory fallback is functional, just per-instance)

**Decision:** Will attempt to set up if time permits; in-memory fallback is acceptable for launch.

---

## 2. Authentication Blockers Discovered

### 2.1 Supabase Dashboard Access

Attempted to access Supabase dashboard at `https://supabase.com/dashboard/projects`.
**Result:** Login required (GitHub OAuth).

**Blocker:** Need GitHub authentication to:
- Access existing project `uxgcyvexeehvhtuhmztc`
- Generate real service role key
- Configure SMTP
- Set production CORS

### 2.2 GitHub Repository Access

**Blocker:** Need GitHub authentication to:
- Verify if repo `hvacsidekick/don-carlos-rewards` exists
- Push local code if repo exists
- Create repo if it doesn't exist

### 2.3 Vercel Dashboard Access

**Blocker:** Need Vercel authentication (typically via GitHub) to:
- Create new project
- Connect GitHub repo
- Configure environment variables
- Deploy to production

---

## 3. Alternative Approaches

### 3.1 Manual Steps Documented for User

**Option:** Document the exact steps Robin needs to take to complete deployment, with all values/config ready.

**Pros:**
- Unblocks deployment without auth
- User has all credentials
- Can complete in 10-15 minutes

**Cons:**
- Not autonomous per brief
- User action required

### 3.2 CLI-Based Deployment

**Supabase CLI:**
- Already blocked on this Windows host (from Phase 2 notes)
- Even if working, needs auth token

**Vercel CLI:**
- Could work if user has `vercel` installed + logged in
- Could deploy via `vercel --prod` from terminal
- Still needs env vars configured

**GitHub CLI:**
- Could push via `gh` if installed + logged in

**Status:** Will attempt CLI approaches first.

### 3.3 Wait for User Authentication

**Option:** Pause and ask user to authenticate browser, then continue.

---

## 4. Current Decision: CLI + Documentation Hybrid

### 4.1 What Can Be Done Now (No Auth Required)

1. ✅ **Verify build is production-ready** (already done — gates green)
2. ✅ **Document exact deployment steps** (this document)
3. ✅ **Prepare deployment guide** for user
4. ⏳ **Check if Vercel CLI is available**
5. ⏳ **Check if GitHub remote is already configured**

### 4.2 What Requires User Action

1. **GitHub:** Push code to `hvacsidekick/don-carlos-rewards`
2. **Supabase:** Generate service role key, configure SMTP/CORS
3. **Vercel:** Create project, add env vars, deploy

---

## 5. Checking Available CLI Tools

Let me check what's available on this system...
