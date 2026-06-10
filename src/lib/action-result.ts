/**
 * Discriminated result returned by every Server Action (BLUEPRINT.md §5.2).
 * Actions never throw raw errors to the client; they return a safe message.
 * Success paths that navigate use `redirect()` (which throws NEXT_REDIRECT and
 * is handled by Next.js) instead of returning.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
