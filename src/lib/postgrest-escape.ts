/**
 * PostgREST `.or()` ilike-value escaping (PLAN.md §Phase 9 MINOR-1 fix). Pure +
 * unit-testable (P10-CF-2) — extracted from `customers.server.ts`.
 *
 * Build the value side of an `ilike.<value>` operand for a PostgREST `.or()`
 * filter string, for a contains-match on a user-supplied term. Two distinct
 * escaping layers are at play:
 *
 *  1. LIKE pattern: a literal `%`, `_` or `\` in the term must be
 *     backslash-escaped so it matches literally instead of acting as a wildcard.
 *     We wrap the escaped term in `%…%` for the contains-match.
 *
 *  2. PostgREST `.or()` tokenizer: the reserved chars `,`, `(`, `)` (and `.`)
 *     delimit the filter list/operator syntax. Backslash-escaping them does NOT
 *     work — PostgREST treats the backslash as a literal char. The correct fix is
 *     to WRAP the whole value in double quotes; PostgREST then takes the quoted
 *     span verbatim. Inside the quotes a literal `"` or `\` must itself be
 *     backslash-escaped for the tokenizer.
 *
 * Order matters: LIKE-escape first (operates on the raw term), then wrap+quote.
 * This is NOT a SQL-injection control (PostgREST parameterizes); it is a
 * correctness control so reserved chars in a search term don't corrupt the
 * filter or match the wrong rows.
 */
export function ilikeContainsValue(term: string): string {
  // 1) LIKE-escape: backslash before \, %, _ so they match literally.
  const likeEscaped = term.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${likeEscaped}%`;
  // 2) PostgREST quote-escape: \ and " inside the double-quoted value.
  const quoteEscaped = pattern.replace(/[\\"]/g, "\\$&");
  return `"${quoteEscaped}"`;
}
