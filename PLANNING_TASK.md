# Phase 0: Master Planning — Don Carlos Rewards App

You are a **Master Planning Agent** creating a comprehensive blueprint for an Apple-level rewards app.

---

## 🎯 Mission

Design and plan the **Don Carlos Rewards App** — a production-ready mobile-first web app for a taco shop in Arvada, CO.

**Quality Bar:** UI/UX designed by a 30-year Apple veteran. Intuitive, beautiful, stunning.

**Execution Model:** This plan will be implemented by autonomous Claude Code agents via fire-and-forget phased execution with quality gates (audit → fix → verify per phase).

---

## 📋 Requirements

### Business Context
- **Client:** Don Carlos Taco Shop (food truck, Arvada CO)
- **Location:** 7475 W 52nd Ave, Arvada, CO 80002
- **Hours:** Mon-Sat 7am-8pm, Sun closed
- **Menu:** Tacos, burritos, quesadillas, tortas, breakfast burritos ($2-12 range)
- **Vibe:** Authentic Mexican, family-friendly, vibrant, approachable

### Branding (from photos)
- **Colors:** Vibrant red, golden yellow, fresh green
- **Mascot:** Chef character with sombrero (playful, welcoming)
- **Typography:** Bold script on truck, friendly/casual
- **Food Photography:** Colorful, appetizing, authentic

### Core Features (MVP)
1. **User Sign-Up/Login**
   - Email + password (primary)
   - Google OAuth (launch polish)
   - Apple Sign-In (required for iOS PWA submission)

2. **Rewards System**
   - **Model:** Points-based ($1 spent = 1 point)
   - **Redemption:** 100 points = $10 off next purchase
   - **UI:** Hybrid stamp card aesthetic + progress ring animation
   - **Mechanics:** Customer shows QR → staff scans → points added instantly

3. **QR Code System**
   - Customer profile has unique QR code
   - Staff admin portal can scan QR to add points
   - Manual point adjustment (staff override for errors)

4. **Transaction History**
   - Elegant list (Apple Pay aesthetic)
   - Date, points earned, location, balance after

5. **Menu Browser**
   - Beautiful food photography
   - Categories (tacos, burritos, breakfast, etc.)
   - Pricing, descriptions
   - NOT ordering (just browse/inspire)

6. **Location & Contact**
   - Embedded map (Google Maps integration)
   - Hours, phone, address
   - Directions link

7. **Admin Portal (Staff)**
   - QR scanner (add points to customer)
   - Manual point adjustment
   - View customer list + balances
   - Transaction log
   - Analytics dashboard (total customers, points issued, redemptions)

### Design Requirements
**Apple Human Interface Guidelines Compliance:**
- Generous white space, clear hierarchy
- SF Pro typography (or system font stack)
- 60fps animations, haptic feedback patterns
- Dark mode support
- Accessibility (WCAG 2.1 AA minimum)
- Touch targets ≥44x44pt

**Don Carlos Brand Integration:**
- Modern minimalist structure (Apple)
- Vibrant color accents (Don Carlos red/yellow/green)
- Mascot used sparingly (app icon, profile avatar, empty states, celebration moments)
- Balance: Timeless Apple elegance + energetic taco shop personality

**Hybrid Rewards Visualization:**
- **Stamp Card Layer:** Digital version of traditional punch card
  - Grid layout (e.g., 10 stamps to next reward)
  - Taco icon stamps (filled = earned, outlined = locked)
  - Nostalgic but beautifully rendered
- **Progress Ring Layer:** Apple Watch Activity Rings inspired
  - Animated ring wrapping stamp card
  - Fills as points accumulate toward next tier
  - Satisfying completion animation when reward unlocked
  - Haptic pulse on milestone

**Example Flow:**
1. Customer opens app → sees stamp card (7/10 tacos filled)
2. Progress ring shows 70% completion
3. Makes purchase → staff scans QR
4. Animation: new stamp fills in, ring advances to 80%, subtle haptic
5. At 10/10 → ring completes with celebration animation, confetti, "$10 reward unlocked!"

### Technical Stack (Robin's Approved)
- **Framework:** Next.js 15+ (App Router, Server Components)
- **Database:** Supabase (PostgreSQL + Auth + Realtime)
- **Deployment:** Vercel (production + preview environments)
- **UI Components:** shadcn/ui (official components only)
- **Validation:** Zod (mandatory for all inputs)
- **Styling:** Tailwind CSS
- **QR Generation:** qrcode.react or similar
- **QR Scanning:** html5-qrcode or @zxing/browser (browser-based, no native camera needed)

### Security & Compliance
- **RLS:** Mandatory on all Supabase tables
- **Validation:** Zod on all user inputs, API routes, webhooks
- **Key Handling:** No service-role key in browser, anon key only
- **Rate Limiting:** Auth endpoints (5/min per IP)
- **Privacy Policy & TOS:** Required for public launch
- **GDPR Compliance:** Account deletion flow with purge mechanism

---

## 📦 Deliverables

You will produce **THREE comprehensive planning documents**:

### 1. PLAN.md
**Structure:**
```markdown
# Don Carlos Rewards App — Implementation Plan

## Phase Structure
- Phase 0: Project setup + design system
- Phase 1: Database schema + Supabase setup
- Phase 2: Auth (email + OAuth)
- Phase 3: Rewards card UI (stamp + progress ring)
- Phase 4: QR system (generate + scan)
- Phase 5: Transaction history
- Phase 6: Menu browser
- Phase 7: Admin portal
- Phase 8: Security hardening
- Phase 9: Production deployment + audit
- Phase 10+: (if needed for polish)

## Per-Phase Details
For each phase:
- **Objective:** What this phase delivers
- **Acceptance Criteria:** How to verify completion
- **Dependencies:** What must be done first
- **Effort Estimate:** T-shirt size (S/M/L)
- **Risk Assessment:** Blockers, unknowns

## Quality Gate Strategy
- Each phase: Builder → Auditor → Fixer → Verifier
- Builder: Implements feature
- Auditor: Hostile test (Apple design standards + functionality)
- Fixer: Surgical fixes only
- Verifier: Independent confirmation
- Only proceed when Verifier confirms clean

## Rollback Strategy
- Git branch per phase
- Database migrations tracked in schema_migrations table
- Feature flags for risky changes
```

### 2. BLUEPRINT.md
**Structure:**
```markdown
# Don Carlos Rewards App — Technical Blueprint

## Design System
### Color Palette
- Primary: Don Carlos red (extract hex from branding)
- Secondary: Golden yellow, fresh green
- Neutrals: Apple-style grays (light/dark mode)
- Semantic: Success green, warning amber, error red

### Typography
- Headings: SF Pro Display (or system-ui fallback)
- Body: SF Pro Text
- Scale: Apple's type ramp (11pt, 13pt, 17pt, 22pt, 28pt, 34pt)

### Spacing System
- Base unit: 4px (Apple's grid)
- Scale: 4, 8, 12, 16, 24, 32, 48, 64

### Component Library
- shadcn/ui base components
- Custom: RewardsCard, StampGrid, ProgressRing, QRDisplay, QRScanner
- Animation library: Framer Motion (Apple-quality springs)

### Iconography
- SF Symbols aesthetic (outline style)
- Taco mascot (SVG, multiple expressions)

## Database Schema (Supabase PostgreSQL)

### users (extends auth.users)
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  points_balance INTEGER DEFAULT 0,
  total_points_earned INTEGER DEFAULT 0,
  total_redemptions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can read/update only their own record
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
```

### transactions
```sql
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  points_added INTEGER NOT NULL,
  points_balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjustment')),
  staff_id UUID REFERENCES public.users(id), -- admin who processed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users see only their transactions, admins see all
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
```

### rewards_tiers (optional for future)
```sql
CREATE TABLE public.rewards_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., "Free Taco", "$10 Off"
  points_required INTEGER NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Contracts

### REST Endpoints (Next.js API Routes)
```typescript
// GET /api/user/profile
// Returns: { id, email, displayName, pointsBalance, totalEarned, totalRedemptions }

// GET /api/user/transactions
// Returns: Transaction[] (paginated)

// POST /api/user/redeem
// Body: { pointsToRedeem: number }
// Returns: { success, newBalance, transactionId }

// POST /api/admin/add-points
// Body: { userId: string, points: number, notes?: string }
// Returns: { success, newBalance, transactionId }
// Auth: Admin only
```

### Server Actions (Next.js)
```typescript
// actions/auth.ts
export async function signupAction(data: { email, password })
export async function loginAction(data: { email, password })

// actions/rewards.ts
export async function addPointsAction(data: { userId, points, staffId, notes })
export async function redeemPointsAction(data: { points })
```

## Component Architecture

### Page Structure
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (user)/
│   ├── dashboard/page.tsx          # Rewards card + quick actions
│   ├── transactions/page.tsx       # History list
│   ├── menu/page.tsx               # Browse menu
│   └── profile/page.tsx            # Settings, QR code
├── (admin)/
│   ├── scan/page.tsx               # QR scanner to add points
│   ├── customers/page.tsx          # Customer list
│   └── analytics/page.tsx          # Dashboard
└── about/page.tsx                  # Location, hours, contact
```

### Key Components
```typescript
// components/rewards/RewardsCard.tsx
// Hybrid stamp card + progress ring
// Props: { pointsBalance, nextRewardThreshold, onRedeem }

// components/rewards/StampGrid.tsx
// Visual grid of taco stamps (filled/outlined)
// Props: { totalStamps, filledStamps }

// components/rewards/ProgressRing.tsx
// Animated SVG circle wrapping stamp card
// Props: { progress: 0-100, size, strokeWidth }

// components/qr/QRDisplay.tsx
// Shows user's unique QR code for staff scanning
// Props: { userId }

// components/qr/QRScanner.tsx
// Admin-only camera scanner
// Props: { onScan: (userId) => void }

// components/menu/MenuItem.tsx
// Food item card with photo, name, price, description
// Props: { item: MenuItem }
```

## Animation Specifications

### Stamp Fill Animation
- Duration: 400ms
- Easing: spring(damping: 15, stiffness: 300)
- Sequence: Scale up 1.2x → settle to 1.0x
- Color: Outline → filled with Don Carlos red
- Haptic: Light impact on fill

### Progress Ring Animation
- Duration: 600ms
- Easing: easeInOut
- Stroke dasharray progression
- Haptic: Medium impact on milestone (every 10 points)
- Completion celebration: Confetti + scale pulse + success sound

### Page Transitions
- Duration: 300ms
- Easing: easeOut
- Fade + slide up 20px

## Deployment Strategy

### Environment Setup
```
.env.local (development)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000

.env.production (Vercel)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://don-carlos-rewards.vercel.app
```

### CI/CD Pipeline
1. Git push to main → Vercel auto-deploy
2. Preview deployments for feature branches
3. Database migrations applied via Supabase CLI or dashboard
4. Secrets managed in Vercel environment variables

### Testing Strategy
- Unit: Jest + React Testing Library
- E2E: Playwright (auth flow, rewards flow, QR scanning)
- Visual regression: Percy or Chromatic (optional)
- Performance: Lighthouse CI (score ≥90)

## Security Checklist

- [ ] RLS enabled on all public tables
- [ ] Zod validation on all API routes
- [ ] No service-role key in browser code
- [ ] Rate limiting on auth endpoints
- [ ] CSP headers configured
- [ ] Privacy policy published
- [ ] TOS published
- [ ] Account deletion purge mechanism
- [ ] Leaked password protection (HaveIBeenPwned)
- [ ] CORS configured (Vercel domain only)
```

### 3. DESIGN_SYSTEM.md
**Structure:**
```markdown
# Don Carlos Rewards App — Design System

## Brand Fusion Strategy

**Goal:** Marry Apple's timeless minimalism with Don Carlos's vibrant energy.

**Approach:**
- **Structure:** Apple (generous white space, clear hierarchy, SF Pro typography)
- **Energy:** Don Carlos (bold color accents, playful mascot moments, warm photography)
- **Result:** Feels native to iOS/Android while celebrating taco shop personality

## Color System

### Primary Palette (from Don Carlos branding)
```css
--dc-red: #E63946;        /* Vibrant red (primary CTAs, stamps) */
--dc-yellow: #F9C74F;     /* Golden yellow (highlights, success states) */
--dc-green: #90BE6D;      /* Fresh green (menu items, healthy accents) */
```

### Neutral Palette (Apple-inspired)
```css
/* Light Mode */
--bg-primary: #FFFFFF;
--bg-secondary: #F2F2F7;  /* Apple's secondary background */
--text-primary: #000000;
--text-secondary: #3C3C43; /* 60% opacity on white */

/* Dark Mode */
--bg-primary-dark: #000000;
--bg-secondary-dark: #1C1C1E;
--text-primary-dark: #FFFFFF;
--text-secondary-dark: #EBEBF5; /* 60% opacity on black */
```

### Semantic Colors
```css
--success: #34C759;  /* Apple green */
--warning: #FF9500;  /* Apple orange */
--error: #FF3B30;    /* Apple red */
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
```

### Type Scale (Apple HIG)
```css
--text-caption: 11px;     /* Fine print, legal */
--text-footnote: 13px;    /* Secondary info */
--text-body: 17px;        /* Body copy (Apple's default) */
--text-headline: 22px;    /* Section headers */
--text-title3: 28px;      /* Page titles */
--text-title2: 34px;      /* Hero text */
--text-large-title: 48px; /* Onboarding, celebrations */
```

### Font Weights
- Regular: 400
- Medium: 500 (emphasis)
- Semibold: 600 (headings)
- Bold: 700 (CTAs, numbers)

## Spacing System

**Base Unit:** 4px (Apple's grid)

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

**Touch Targets:** Minimum 44x44pt (Apple HIG)

## Component Specifications

### RewardsCard (Hybrid Stamp + Progress Ring)

**Layout:**
```
┌─────────────────────────────────────┐
│  ╭──────────────────────────────╮   │ ← Progress Ring (SVG circle)
│  │   🌮  🌮  🌮  🌮  🌮         │   │ ← Stamp Grid (filled tacos)
│  │   🌮  🌮  🌮  ⚪  ⚪         │   │ ← (empty outlines)
│  ╰──────────────────────────────╯   │
│  70 points · 30 to next reward      │ ← Status text
│  [Redeem $10 Off]                   │ ← CTA (if eligible)
└─────────────────────────────────────┘
```

**Specs:**
- Card: White background (light), dark gray (dark mode), rounded-3xl (24px), shadow-lg
- Progress Ring: Stroke width 8px, Don Carlos red fill, gray base ring
- Stamps: 40x40px taco icons, grid gap 12px
- Animation: Spring-based fill, haptic on milestone
- Padding: 24px all sides

### QRDisplay

**Layout:**
```
┌─────────────────────────────────────┐
│  Your Rewards Code                  │ ← Headline
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │     [QR CODE 200x200]       │   │ ← Generated QR
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Show this to staff at checkout     │ ← Instructions
└─────────────────────────────────────┘
```

**Specs:**
- QR Code: 200x200px minimum (scannable at arm's length)
- Error correction: High (30% resilience)
- Background: White always (even in dark mode for scanning)
- Border: 16px padding around QR for scanning margin

### MenuItem Card

**Layout:**
```
┌─────────────────────────────────────┐
│  [Beautiful food photo, 16:9]       │ ← Hero image
│  🌮 Carne Asada Taco          $3.50 │ ← Name + price
│  Grilled steak, cilantro, onion...  │ ← Description
└─────────────────────────────────────┘
```

**Specs:**
- Image: 16:9 aspect ratio, object-fit cover, rounded-t-2xl
- Card: bg-white (light), bg-secondary (dark), rounded-2xl, shadow-md
- Padding: 16px
- Hover: Scale 1.02, shadow-lg (desktop), no transform (mobile)

## Animation Library

**Tool:** Framer Motion

**Spring Presets:**
```typescript
const springGentle = { damping: 20, stiffness: 300 };
const springStiffer = { damping: 15, stiffness: 400 };
const springBouncy = { damping: 10, stiffness: 300 };
```

**Common Animations:**
```typescript
// Stamp fill
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={springBouncy}
/>

// Page enter
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
/>

// Progress ring
<motion.circle
  strokeDashoffset={circumference - (progress / 100) * circumference}
  transition={{ duration: 0.6, ease: 'easeInOut' }}
/>
```

## Iconography

**Primary:** Heroicons (outline style, Apple aesthetic)
**Custom:** Taco mascot SVG (multiple expressions)

**Mascot Use Cases:**
- App icon (chef face, vibrant)
- Empty state (chef holding sign: "No transactions yet!")
- Celebration (chef with confetti: "Reward unlocked!")
- Error state (chef with question mark: "Something went wrong")

## Accessibility

### WCAG 2.1 AA Compliance
- [ ] Color contrast ≥4.5:1 (text), ≥3:1 (large text)
- [ ] Focus indicators visible
- [ ] Keyboard navigation works everywhere
- [ ] ARIA labels on interactive elements
- [ ] Alt text on images
- [ ] Form errors announced to screen readers

### Touch Targets
- Minimum 44x44pt (Apple HIG)
- Spacing between tappable elements ≥8px

### Haptic Feedback (iOS Safari, Android Chrome)
```typescript
// Light impact (stamp fill)
navigator.vibrate(10);

// Medium impact (milestone)
navigator.vibrate([10, 50, 10]);

// Success (reward unlocked)
navigator.vibrate([10, 50, 10, 50, 10]);
```

## Dark Mode Strategy

**Toggle:** System preference (no manual toggle in v1)

**Implementation:**
```typescript
// tailwind.config.js
module.exports = {
  darkMode: 'media', // Respects prefers-color-scheme
  theme: {
    extend: {
      colors: {
        'dc-red': '#E63946',
        'dc-yellow': '#F9C74F',
        'dc-green': '#90BE6D',
      }
    }
  }
}
```

**Rules:**
- Vibrant colors stay vibrant (Don Carlos red/yellow/green consistent)
- Neutrals invert (white → black backgrounds)
- Shadows reduce opacity in dark mode
- QR code background always white (scanning requirement)

## Performance Budget

- **First Contentful Paint:** <1.5s
- **Largest Contentful Paint:** <2.5s
- **Time to Interactive:** <3.5s
- **Cumulative Layout Shift:** <0.1
- **Total Blocking Time:** <200ms

**Lighthouse Target:** 90+ across Performance, Accessibility, Best Practices, SEO

## Responsive Breakpoints

```css
/* Mobile-first approach */
sm: 640px   /* Large phones */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop (admin dashboard) */
```

**Priority:** Mobile-first (80% of taco shop customers on phones)
```
