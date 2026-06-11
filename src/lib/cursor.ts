/**
 * Opaque keyset-pagination cursor codec (PLAN.md §Phase 6/9). Encodes a row's
 * `(created_at, id)` sort key into a URL-safe base64 string and back. Pure +
 * unit-testable (P10-CF-2) — extracted from the server data-access modules so it
 * has a single tested implementation.
 *
 * `decodeCursor` returns null for ANY malformed input (bad base64, non-JSON,
 * wrong shape) so a hostile/garbage cursor degrades to "from the top" instead of
 * crashing the query builder.
 */

export type CursorKey = { c: string; i: string };

/** Encode a sort key `(created_at, id)` into an opaque, URL-safe cursor. */
export function encodeCursor(row: { created_at: string; id: string }): string {
  const payload: CursorKey = { c: row.created_at, i: row.id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decode a cursor; null for anything malformed (treated as "from the top"). */
export function decodeCursor(raw: string): CursorKey | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as CursorKey).c === "string" &&
      typeof (parsed as CursorKey).i === "string"
    ) {
      return { c: (parsed as CursorKey).c, i: (parsed as CursorKey).i };
    }
    return null;
  } catch {
    return null;
  }
}
