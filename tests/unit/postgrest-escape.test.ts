import { describe, it, expect } from "vitest";

import { ilikeContainsValue } from "@/lib/postgrest-escape";

/**
 * PostgREST ilike-value escaping (P10-CF-2; closes Phase 9 MINOR-1). Proves LIKE
 * wildcards are neutralized and reserved `.or()` chars are quoted verbatim.
 */
describe("ilikeContainsValue", () => {
  it("wraps a plain term in %…% and double-quotes it", () => {
    expect(ilikeContainsValue("ana")).toBe('"%ana%"');
  });

  it("LIKE-escapes wildcards so they match literally", () => {
    // "50%": LIKE-escape → 50\%, wrap → %50\%%, quote-escape the \ → %50\\%%.
    expect(ilikeContainsValue("50%")).toBe('"%50\\\\%%"');
    // "a_b": LIKE-escape → a\_b, wrap → %a\_b%, quote-escape the \ → %a\\_b%.
    expect(ilikeContainsValue("a_b")).toBe('"%a\\\\_b%"');
  });

  it("quotes reserved .or() tokenizer chars verbatim (comma/parens)", () => {
    // The reserved chars survive INSIDE the double quotes (no backslash on them).
    expect(ilikeContainsValue("a,b")).toBe('"%a,b%"');
    expect(ilikeContainsValue("x(y)")).toBe('"%x(y)%"');
  });

  it("backslash-escapes a literal backslash and double-quote", () => {
    // 'a"b': no LIKE chars; quote-escape the " → %a\"b%.
    expect(ilikeContainsValue('a"b')).toBe('"%a\\"b%"');
    // "a\b" (one backslash): LIKE-escape → a\\b, then quote-escape both → a\\\\b.
    expect(ilikeContainsValue("a\\b")).toBe('"%a\\\\\\\\b%"');
  });
});
