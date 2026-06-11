/**
 * Recovery-AMR predicate (PLAN.md §Phase 10 P10-CF-1; closes Phase 3 audit m-1).
 *
 * Background — the bug that shipped before: the original gate read
 * `session.amr`, but `amr` is NOT a field on the Supabase `Session` object. It
 * lives only on the **decoded access-token JWT payload** (`JwtPayload.amr`,
 * reachable via `supabase.auth.getClaims()`). Reading `session.amr` always
 * returned `undefined`, so the gate rejected EVERY password reset. A `(session
 * as {amr?})` cast even kept `tsc` green while the field was always missing.
 *
 * `amr` (Authentication Methods References, RFC 8176) records HOW the current
 * token was obtained. A token minted from a password-recovery link carries an
 * entry with `method: "recovery"`. Supabase exposes this in TWO shapes
 * (`JwtPayload.amr: AMREntry[] | string[]`):
 *   - `string[]`        — RFC-8176 compliant: e.g. `["recovery"]`
 *   - `AMREntry[]`      — detailed: e.g. `[{ method: "recovery", timestamp: … }]`
 *
 * This module is a PURE predicate over the decoded claim so it is unit-testable
 * WITHOUT a live recovery session (which needs SMTP / a real service-role key to
 * mint — deploy-gated). The action layer decodes via `getClaims()` and passes
 * the `amr` claim here.
 */

/** The detailed AMR entry shape (subset we rely on). */
export type AmrEntryLike = { method?: unknown };

/** The `amr` claim as it can appear on a decoded Supabase JWT payload. */
export type AmrClaim = ReadonlyArray<string | AmrEntryLike> | null | undefined;

/** Auth method references that indicate a fresh, privileged re-auth. */
const RECOVERY_METHOD = "recovery";

/**
 * Extract the normalized method string from one AMR entry, regardless of shape.
 * Returns null for anything unrecognized.
 */
function methodOf(entry: string | AmrEntryLike): string | null {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object" && typeof entry.method === "string") {
    return entry.method;
  }
  return null;
}

/**
 * True iff the decoded `amr` claim proves the session was established via a
 * password-recovery link. Handles both `string[]` and `AMREntry[]` forms and
 * tolerates a missing/malformed claim (→ false, fail-closed).
 */
export function hasRecoveryAmr(amr: AmrClaim): boolean {
  if (!Array.isArray(amr)) return false;
  for (const entry of amr) {
    if (methodOf(entry) === RECOVERY_METHOD) return true;
  }
  return false;
}
