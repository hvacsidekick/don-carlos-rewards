# Phase 12 — Production Deployment — MANUAL CONFIGURATION GUIDE

> For Robin/User: Steps to complete production deployment after automated setup.
> **Repository created:** https://github.com/hvacsidekick/don-carlos-rewards
> **Code pushed:** ✅ All phases 0-11 verified and committed

---

## Automated Steps Completed ✅

1. ✅ **GitHub repository created:** `hvacsidekick/don-carlos-rewards`
2. ✅ **Code pushed to GitHub:** master branch with all verified phases (0-11)
3. ✅ **Build verified locally:** tsc 0, tests 34/34, lint clean, build success

---

## Manual Steps Required (Dashboard Access)

### Step 1: Supabase Production Configuration

**Navigate to:** https://supabase.com/dashboard/project/uxgcyvexeehvhtuhmztc/settings/api

#### 1.1 Generate Real Service Role Key

1. Go to Settings → API
2. Under "Project API keys" section, find **`service_role` key** (marked as "secret")
3. Click "Reveal" and copy the full key (starts with `eyJ...`)
4. **Save this for Vercel env vars** (next step)

**⚠️ CRITICAL:** This key bypasses RLS. Never commit it or expose it to client code.

#### 1.2 Configure CORS for Production

1. Go to Settings → API
2. Scroll to "CORS Configuration"
3. Add allowed origin: `https://*.vercel.app` (or specific Vercel domain once known)
4. Save changes

#### 1.3 Configure Custom SMTP (Optional but Recommended)

1. Go to Authentication → Email Templates
2. Scroll to "SMTP Settings"
3. Enter your SMTP provider details:
   - **Host:** (e.g., smtp.sendgrid.net, smtp.postmarkapp.com)
   - **Port:** 587 (TLS) or 465 (SSL)
   - **Username:** (API key or email)
   - **Password:** (API key or password)
   - **Sender email:** noreply@doncarlos-rewards.com (or your domain)
   - **Sender name:** Don Carlos Rewards
4. Test the connection
5. Save settings

**If skipped:** Supabase will use built-in email (may have deliverability issues).

#### 1.4 Enable Leaked-Password Protection (Recommended)

1. Go to Authentication → Policies
2. Find "Leaked Password Protection" toggle
3. Enable (uses HaveIBeenPwned API)

**⚠️ Per brief:** If this blocks deployment, skip it and enable post-launch.

---

### Step 2: Vercel Deployment

**Navigate to:** https://vercel.com/new

#### 2.1 Import GitHub Repository

1. Click "Import Project"
2. Select "Import Git Repository"
3. Choose: `hvacsidekick/don-carlos-rewards`
4. Click "Import"

#### 2.2 Configure Environment Variables

**Required variables** (add in Vercel project settings → Environment Variables):

```bash
# Supabase (from Step 1)
NEXT_PUBLIC_SUPABASE_URL=https://uxgcyvexeehvhtuhmztc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(from Supabase dashboard → Settings → API → anon public)
SUPABASE_SERVICE_ROLE_KEY=(from Step 1.1 — service_role key you just copied)

# App URL (will be updated after first deploy)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Maps (keyless embed)
NEXT_PUBLIC_MAPS_EMBED=https://www.google.com/maps/embed?pb=...

# Rate Limiting (optional — in-memory fallback works)
UPSTASH_REDIS_REST_URL=(leave empty if not using Upstash)
UPSTASH_REDIS_REST_TOKEN=(leave empty if not using Upstash)

# Monitoring (optional)
SENTRY_DSN=(leave empty for now)
```

**Where to find Supabase keys:**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase dashboard → Settings → API → "Project API keys" → `anon` key (public, starts with `eyJ...`)
- `SUPABASE_SERVICE_ROLE_KEY`: from Step 1.1 (service_role key, secret)

#### 2.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (~2-3 minutes)
3. **Copy the production URL** (e.g., `https://don-carlos-rewards.vercel.app`)

#### 2.4 Update NEXT_PUBLIC_APP_URL

1. Go to Vercel project settings → Environment Variables
2. Edit `NEXT_PUBLIC_APP_URL` → set to your production URL
3. Click "Save"
4. Trigger a redeploy (Settings → Deployments → "..." → Redeploy)

---

### Step 3: Supabase OAuth Redirect URLs (If Using OAuth)

**If you're using Google/Apple Sign-In:**

1. Go to Supabase dashboard → Authentication → URL Configuration
2. Add redirect URL: `https://your-production-url.vercel.app/auth/callback`
3. Save

**Then update OAuth providers:**
- **Google:** Add redirect URI in Google Cloud Console
- **Apple:** Add return URL in Apple Developer portal

---

## Step 4: Launch Audit (Post-Deployment)

### Once deployed, verify these critical flows:

#### 4.1 Sign Up → Verify → Login

1. Open `https://your-production-url.vercel.app/signup`
2. Sign up with a real email
3. Check email for verification link
4. Click link → should redirect to dashboard
5. **✅ Success:** User sees dashboard with 0 points

#### 4.2 Admin Scan → Add Points → User Sees Update

1. Promote a test user to admin (SQL in Supabase):
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'admin@test.com';
   ```
2. Log in as admin
3. Navigate to `/scan`
4. Scan a customer QR (or enter token manually)
5. Add points (e.g., $10 = 10 points)
6. **✅ Success:** Customer's dashboard updates live (realtime)

#### 4.3 Redeem Points

1. As customer, accumulate 100 points (or threshold from `rewards_config`)
2. Click "Redeem" on dashboard
3. Confirm
4. **✅ Success:** Balance decrements, transaction logged

#### 4.4 Lighthouse Audit

1. Open Chrome DevTools → Lighthouse
2. Run audit on `/dashboard` (mobile profile, throttled)
3. **✅ Success:** All scores ≥ 90 (Performance, Accessibility, Best Practices, SEO)

#### 4.5 PWA Install

**iOS:**
1. Open in Safari
2. Tap Share → "Add to Home Screen"
3. **✅ Success:** App installs, launches standalone

**Android:**
1. Open in Chrome
2. Tap install prompt (or "..." → "Install app")
3. **✅ Success:** App installs, launches standalone

#### 4.6 Offline Test

1. Install PWA (from 4.5)
2. Enable airplane mode
3. Open app
4. **✅ Success:** Offline shell renders ("You're offline")

#### 4.7 Console Sweep

1. Open DevTools console
2. Navigate: `/dashboard`, `/menu`, `/about`, `/qr`
3. **✅ Success:** 0 CSP violations, 0 errors

---

## Step 5: Post-Launch Tasks

### 5.1 Create Initial Admin Account

```sql
-- Run in Supabase SQL Editor
UPDATE profiles 
SET is_admin = true 
WHERE email = 'your-admin-email@domain.com';
```

### 5.2 Seed Menu (if not already done)

Menu should already be seeded from Phase 2, but verify:
```sql
SELECT COUNT(*) FROM menu_items; -- should return ~28
SELECT COUNT(*) FROM menu_categories; -- should return 7
```

### 5.3 Set Up Monitoring (Optional)

1. Create Sentry account (if using)
2. Get DSN
3. Add to Vercel env vars: `SENTRY_DSN=...`
4. Redeploy

### 5.4 Custom Domain (Optional)

1. Buy domain (e.g., `doncarlos-rewards.com`)
2. Add to Vercel: Settings → Domains
3. Configure DNS (Vercel provides instructions)
4. Update OAuth redirect URLs to use custom domain

---

## Automated CLI Deployment (Alternative)

**If you prefer to deploy via CLI:**

```bash
cd /c/Users/robin/don-carlos-rewards

# Deploy to Vercel (will prompt for env vars)
vercel --prod

# Add environment variables via CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_APP_URL production

# Redeploy with new env vars
vercel --prod
```

**Note:** You'll still need to get the Supabase keys from the dashboard (Step 1.1).

---

## Quick Reference

| Resource | URL |
|----------|-----|
| GitHub Repo | https://github.com/hvacsidekick/don-carlos-rewards |
| Supabase Dashboard | https://supabase.com/dashboard/project/uxgcyvexeehvhtuhmztc |
| Vercel Dashboard | https://vercel.com/hvacsidekick |
| Production URL | (will be provided after Vercel deployment) |

---

## Deployment Checklist

- [ ] Step 1.1: Generate real `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Step 1.2: Configure CORS in Supabase
- [ ] Step 1.3: Configure SMTP (optional but recommended)
- [ ] Step 1.4: Enable leaked-password protection (optional)
- [ ] Step 2.1: Import GitHub repo to Vercel
- [ ] Step 2.2: Add all environment variables
- [ ] Step 2.3: Deploy to production
- [ ] Step 2.4: Update `NEXT_PUBLIC_APP_URL` with production URL
- [ ] Step 3: Update OAuth redirect URLs (if applicable)
- [ ] Step 4: Run launch audit (all flows)
- [ ] Step 5.1: Create initial admin account

---

**Once Steps 1-4 are complete, report the production URL for the completion report.**
