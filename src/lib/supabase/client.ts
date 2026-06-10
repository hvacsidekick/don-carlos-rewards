import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client (BLUEPRINT.md §1, §7). Anon key only, RLS-bound.
 * Used by client islands for reads/realtime and to initiate OAuth redirects.
 *
 * Each call returns a fresh client; callers in React should memoize via
 * `useState(() => createClient())` to keep one instance per component.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
