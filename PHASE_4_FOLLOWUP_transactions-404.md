# Phase 4 follow-up — residual defect (caught by a second, independent audit)

**Status:** OPEN · **Severity:** MINOR (live user-facing 404) · **Found:** 2026-06-10 by an independent Auditor lineage *after* Phase 4 was marked ✅ Verified + merged to `master`.

## Context (why this note exists)
Two orchestrator lineages audited Phase 4 concurrently. The lineage recorded in `PHASE_LOG.md` (Auditor findings M-1 aria-live / m-2 matcher / m-3 stamp / m-4 `.eq`) **did not catch this one**. A second, independent hostile audit (which additionally minted a live session and drove the dashboard with Playwright) did. Their fix-sets overlapped on m-3 and m-4 (both already fixed in `master`), but this defect slipped through to the Verified merge.

## The defect
`src/components/rewards/RecentActivity.tsx:53-58` renders a **"See all" link to `/transactions`**, but **no `/transactions` route exists** (Phase 6 — Transaction History — is `not-started`). Tapping it → live Next.js 404. The `(user)` route group has no `transactions/` segment on `master`.

Confirmed: `git ls-files 'src/app/**/transactions/**'` → empty.

## Recommended fix (one component, ~5 lines, no behavior risk)
Remove the premature link until Phase 6 reintroduces it (Phase 6 should re-add `See all → /transactions` when it builds that route). Concretely:
1. Delete `import Link from "next/link";` (line 1 — it becomes the only `Link` use; `noUnusedLocals` will otherwise error).
2. Replace the `<div className="flex items-center justify-between"> … <Link href="/transactions">See all</Link> </div>` header wrapper (lines 49-59) with the bare `<h2 id="recent-activity-title" …>Recent activity</h2>`.

Gate after: `npm run typecheck` + `npm run lint` (removing a link cannot affect the build output; no `next build` needed to validate).

## Why this wasn't auto-applied
At the time of discovery a **second orchestrator session was actively driving this same working directory** (on `phase/5-qr`). Switching branches / committing would have mutated shared git HEAD+index and disrupted that session's in-flight work. Applying this fix requires a single owning session. Whichever orchestrator continues should apply it (it's safe and isolated) and reference this note in the Phase 6 build.
