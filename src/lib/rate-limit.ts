import "server-only";

import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit-core";

/**
 * Server-facing rate limiter (PLAN.md §Phase 10 criterion 3; BLUEPRINT.md §5.3,
 * §12). The pure algorithm + types + window constants live in
 * `rate-limit-core.ts` (unit-testable, no `server-only`); this module adds the
 * `server-only` guard, the process singleton, and the request-IP helper.
 *
 * **Store choice (documented):** prod should use Upstash Redis or Vercel KV — a
 * shared, atomic, multi-instance store — because an in-memory counter is
 * per-process and resets on cold start, so it cannot enforce a global limit
 * across Vercel's serverless/edge fan-out. Upstash/Vercel-KV are NOT provisioned
 * in this build (open question O-6), so we ship a correct in-memory fallback that
 * works locally + in a single instance, and document the swap. To wire the prod
 * store: implement `RateLimitStore` (from `rate-limit-core`) over Upstash's
 * `INCR`+`PEXPIRE` (or `@upstash/ratelimit`) and pass it to
 * `createRateLimiter(store)` below — the `UPSTASH_REDIS_REST_URL`/`_TOKEN` env
 * vars are already validated in `lib/env.ts`.
 */

export {
  AUTH_RATE_LIMIT,
  ADD_POINTS_RATE_LIMIT,
  MemoryRateLimitStore,
  createRateLimiter,
} from "@/lib/rate-limit-core";
export type {
  RateLimitOptions,
  RateLimitResult,
  RateLimitStore,
  RateLimiter,
} from "@/lib/rate-limit-core";

/**
 * Process-wide singleton limiter backed by the in-memory store. Server Actions /
 * route handlers share one instance so counters accumulate within a process.
 * (Swap the store here for the prod Upstash/KV-backed limiter.)
 */
export const rateLimiter: RateLimiter = createRateLimiter();

/**
 * Best-effort client IP from standard proxy headers (Vercel sets
 * `x-forwarded-for`). Falls back to a constant bucket so a missing header
 * degrades to a shared (stricter) limit rather than disabling the limiter.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
