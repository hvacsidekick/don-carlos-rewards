import { describe, it, expect } from "vitest";

import { encodeCursor, decodeCursor } from "@/lib/cursor";

/**
 * Keyset cursor codec (P10-CF-2; PLAN.md §Phase 6/9). Round-trips a sort key and
 * proves malformed input degrades to null ("from the top") rather than throwing.
 */
describe("cursor codec", () => {
  it("round-trips an encoded sort key", () => {
    const row = { created_at: "2026-06-10T12:34:56.789Z", id: "abc-123" };
    const token = encodeCursor(row);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // url-safe base64
    expect(decodeCursor(token)).toEqual({ c: row.created_at, i: row.id });
  });

  it("returns null for garbage (not base64 / not JSON)", () => {
    expect(decodeCursor("!!!not-base64!!!")).toBeNull();
    expect(decodeCursor(Buffer.from("not json", "utf8").toString("base64url"))).toBeNull();
  });

  it("returns null for the wrong shape", () => {
    const wrong = Buffer.from(JSON.stringify({ x: 1 }), "utf8").toString("base64url");
    expect(decodeCursor(wrong)).toBeNull();
    const partial = Buffer.from(JSON.stringify({ c: "x" }), "utf8").toString("base64url");
    expect(decodeCursor(partial)).toBeNull();
  });

  it("preserves values containing reserved chars", () => {
    const row = { created_at: "2026-01-01T00:00:00+00:00", id: "a,b(c)" };
    expect(decodeCursor(encodeCursor(row))).toEqual({ c: row.created_at, i: row.id });
  });
});
