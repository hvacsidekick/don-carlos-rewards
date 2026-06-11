import { z } from "zod";

/**
 * Transaction-history Zod schemas (PLAN.md §8 golden rule: validate every
 * external input). The "load more" Server Action re-parses its argument with
 * {@link loadTransactionsSchema} before any DB work — the client's filter and
 * cursor are never trusted as-is.
 */

export const transactionFilterSchema = z.enum(["all", "earn", "redeem"]);

export const loadTransactionsSchema = z.object({
  filter: transactionFilterSchema,
  // Opaque base64url cursor produced by the server; bounded so a hostile client
  // can't push a huge string into the query builder. `null` means "from the top".
  cursor: z.string().trim().min(1).max(512).nullable(),
});

export type LoadTransactionsInput = z.infer<typeof loadTransactionsSchema>;
