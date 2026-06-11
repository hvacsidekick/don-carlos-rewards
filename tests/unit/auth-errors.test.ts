import { describe, it, expect } from "vitest";

import { friendlyAuthError } from "@/lib/auth-errors";

/**
 * friendlyAuthError mapping (P10-CF-2). Asserts each branch returns safe,
 * non-leaky copy and the fallthrough never echoes the raw message.
 */
describe("friendlyAuthError", () => {
  it("maps invalid credentials", () => {
    expect(friendlyAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
  });

  it("maps unconfirmed email", () => {
    expect(friendlyAuthError("Email not confirmed")).toContain("confirm your email");
  });

  it("maps already-registered", () => {
    expect(friendlyAuthError("User already registered")).toContain("already exists");
    expect(friendlyAuthError("Email address has already been registered")).toContain(
      "already exists",
    );
  });

  it("maps rate-limit", () => {
    expect(friendlyAuthError("Email rate limit exceeded")).toContain("Too many attempts");
    expect(friendlyAuthError("Too many requests")).toContain("Too many attempts");
  });

  it("maps email-send failures (SMTP) — the Phase 3 M-2 fix", () => {
    expect(friendlyAuthError("Error sending confirmation email")).toContain("couldn't send");
    expect(friendlyAuthError("Failed to send confirmation email")).toContain("couldn't send");
  });

  it("falls through to a generic, non-leaky message", () => {
    const raw = "pq: connection refused at 10.0.0.1:5432 stacktrace";
    const out = friendlyAuthError(raw);
    expect(out).toBe("Something went wrong. Please try again.");
    expect(out).not.toContain("10.0.0.1");
    expect(out).not.toContain("stacktrace");
  });
});
