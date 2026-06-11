"use server";

import { getTransactionsPage } from "@/lib/transactions.server";
import { loadTransactionsSchema } from "@/schemas/transactions";
import type { ActionResult } from "@/lib/action-result";
import type { TransactionPage } from "@/lib/transactions";

/**
 * "Load more" history Server Action (PLAN.md §Phase 6 — pagination/infinite
 * scroll). The client passes a filter + the opaque next-cursor it last received;
 * we re-validate both, then hand off to the keyset reader (which re-derives the
 * user identity server-side — the client never names whose history to read).
 * Errors are mapped to friendly copy, never thrown raw to the client.
 */
export async function loadTransactionsAction(
  input: unknown,
): Promise<ActionResult<TransactionPage>> {
  const parsed = loadTransactionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Couldn't load more activity. Please try again." };
  }

  try {
    const page = await getTransactionsPage(parsed.data);
    return { ok: true, data: page };
  } catch {
    return { ok: false, error: "Couldn't load more activity. Please try again." };
  }
}
