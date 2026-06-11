/**
 * Pure, environment-agnostic rate-limiter core (PLAN.md §Phase 10 criterion 3).
 *
 * This module has NO `server-only` guard so it is unit-testable directly. The
 * server-facing wrapper (`rate-limit.ts`) adds `server-only`, the process
 * singleton, and the request-header IP helper. See that file's header for the
 * store-choice rationale (in-memory fallback vs prod Upstash/Vercel KV).
 *
 * Algorithm: fixed window. Each key maps to a counter that resets when its
 * window expires. With limit=5/60s, the 6th request inside a window is blocked —
 * exactly the acceptance criterion.
 */

export type RateLimitOptions = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  /** False when the request should be rejected. */
  ok: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window resets (and the caller may retry). */
  resetAt: number;
};

/**
 * Backing store contract. A prod implementation (Upstash/Vercel KV) provides an
 * atomic increment-with-expiry; the in-memory default below is the local
 * fallback.
 */
export interface RateLimitStore {
  /**
   * Atomically increment the counter for `key`, (re)setting its expiry to
   * `now + windowMs` on the FIRST hit of a window. Returns the new count and the
   * window reset time.
   */
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
}

type Entry = { count: number; resetAt: number };

/**
 * In-memory fixed-window store. Process-local (resets on restart / not shared
 * across serverless instances) — correct for dev + single-instance, NOT a
 * substitute for the prod Upstash/KV store. A lazy sweep evicts expired keys on
 * access to bound memory.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, Entry>();
  private lastSweep = 0;

  async hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }> {
    this.maybeSweep(now);
    const existing = this.map.get(key);
    if (!existing || existing.resetAt <= now) {
      const entry: Entry = { count: 1, resetAt: now + windowMs };
      this.map.set(key, entry);
      return { count: entry.count, resetAt: entry.resetAt };
    }
    existing.count += 1;
    return { count: existing.count, resetAt: existing.resetAt };
  }

  /** Drop expired keys at most once per minute to keep the map bounded. */
  private maybeSweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.map) {
      if (entry.resetAt <= now) this.map.delete(key);
    }
  }

  /** Test helper: wipe all counters. */
  reset(): void {
    this.map.clear();
    this.lastSweep = 0;
  }
}

export interface RateLimiter {
  check(key: string, options: RateLimitOptions): Promise<RateLimitResult>;
}

/** Build a limiter over any store (defaults to the in-memory fallback). */
export function createRateLimiter(store: RateLimitStore = new MemoryRateLimitStore()): RateLimiter {
  return {
    async check(key, { limit, windowMs }) {
      const now = Date.now();
      const { count, resetAt } = await store.hit(key, windowMs, now);
      const remaining = Math.max(0, limit - count);
      return { ok: count <= limit, remaining, resetAt };
    },
  };
}

/**
 * Default auth limiter window: 5 requests / 60s (BLUEPRINT.md §12 — "5/min/IP").
 * The 6th attempt in the window is blocked.
 */
export const AUTH_RATE_LIMIT: RateLimitOptions = { limit: 5, windowMs: 60_000 };

/**
 * Admin add-points throttle: more generous than auth (staff legitimately scan in
 * bursts) but still caps a runaway/abusive loop. 30 / 60s per admin.
 */
export const ADD_POINTS_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 60_000 };
