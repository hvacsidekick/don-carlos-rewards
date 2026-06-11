import { describe, it, expect } from "vitest";

import {
  createRateLimiter,
  MemoryRateLimitStore,
  AUTH_RATE_LIMIT,
} from "@/lib/rate-limit-core";

/**
 * Rate-limiter tests (P10-CF-2; PLAN.md §Phase 10 criterion 3). The headline
 * assertion: with the auth window (5/min), the 6th attempt in the window is
 * blocked.
 */
describe("rate limiter — fixed window", () => {
  it("blocks the 6th auth attempt within the window (5/min)", async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore());
    const key = "auth:login:203.0.113.7";

    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(await limiter.check(key, AUTH_RATE_LIMIT));
    }

    // Attempts 1–5 allowed, attempt 6 blocked.
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]?.ok).toBe(false);
    expect(results[5]?.remaining).toBe(0);
  });

  it("reports decreasing remaining and reaches 0 at the limit", async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore());
    const key = "k";
    const r1 = await limiter.check(key, { limit: 3, windowMs: 60_000 });
    const r2 = await limiter.check(key, { limit: 3, windowMs: 60_000 });
    const r3 = await limiter.check(key, { limit: 3, windowMs: 60_000 });
    const r4 = await limiter.check(key, { limit: 3, windowMs: 60_000 });
    expect([r1.remaining, r2.remaining, r3.remaining]).toEqual([2, 1, 0]);
    expect(r1.ok && r2.ok && r3.ok).toBe(true);
    expect(r4.ok).toBe(false);
  });

  it("isolates counters per key (different IPs don't share a limit)", async () => {
    const limiter = createRateLimiter(new MemoryRateLimitStore());
    for (let i = 0; i < 5; i++) await limiter.check("ip:a", AUTH_RATE_LIMIT);
    const blockedA = await limiter.check("ip:a", AUTH_RATE_LIMIT);
    const freshB = await limiter.check("ip:b", AUTH_RATE_LIMIT);
    expect(blockedA.ok).toBe(false);
    expect(freshB.ok).toBe(true);
  });

  it("resets after the window expires (store-level)", async () => {
    const store = new MemoryRateLimitStore();
    const base = 1_000_000;
    // Fill the window at t=base.
    for (let i = 0; i < 5; i++) await store.hit("k", 60_000, base);
    const sixth = await store.hit("k", 60_000, base + 100);
    expect(sixth.count).toBe(6); // would be blocked (>5)
    // After the window (t = base + 60_001) the counter starts fresh.
    const afterReset = await store.hit("k", 60_000, base + 60_001);
    expect(afterReset.count).toBe(1);
  });
});
