import { describe, it, expect } from "vitest";

import { hasRecoveryAmr } from "@/lib/recovery-amr";

/**
 * Recovery-AMR predicate (P10-CF-1; closes Phase 3 m-1). Proves the gate that
 * `updatePasswordAction` uses: a recovery-AMR session is allowed, a plain
 * (password/oauth) session is rejected. Both the `string[]` and `AMREntry[]`
 * claim shapes are exercised, plus malformed/missing claims (fail-closed).
 */
describe("hasRecoveryAmr", () => {
  it("allows a recovery session — string[] shape", () => {
    expect(hasRecoveryAmr(["recovery"])).toBe(true);
    expect(hasRecoveryAmr(["otp", "recovery"])).toBe(true);
  });

  it("allows a recovery session — AMREntry[] shape", () => {
    expect(hasRecoveryAmr([{ method: "recovery", timestamp: 1718000000 } as never])).toBe(true);
    expect(
      hasRecoveryAmr([
        { method: "password", timestamp: 1 } as never,
        { method: "recovery", timestamp: 2 } as never,
      ]),
    ).toBe(true);
  });

  it("rejects a plain password session (the security boundary)", () => {
    expect(hasRecoveryAmr(["password"])).toBe(false);
    expect(hasRecoveryAmr([{ method: "password", timestamp: 1 } as never])).toBe(false);
    expect(hasRecoveryAmr(["oauth"])).toBe(false);
  });

  it("fails closed on missing / malformed claims", () => {
    expect(hasRecoveryAmr(undefined)).toBe(false);
    expect(hasRecoveryAmr(null)).toBe(false);
    expect(hasRecoveryAmr([])).toBe(false);
    expect(hasRecoveryAmr([{ notmethod: "recovery" } as never])).toBe(false);
    expect(hasRecoveryAmr([123 as never, true as never])).toBe(false);
    // A non-array claim (defensive) → false.
    expect(hasRecoveryAmr("recovery" as never)).toBe(false);
  });
});
