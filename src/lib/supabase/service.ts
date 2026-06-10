import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { clientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client — **SERVER ONLY** (BLUEPRINT.md §1, §12;
 * PLAN.md golden rules). Bypasses RLS; used solely for trusted admin operations
 * and account deletion (`auth.admin.*`).
 *
 * The `import "server-only"` directive makes the build FAIL if this module is
 * ever imported into a Client Component or any `"use client"` graph — the
 * primary defense for R-5 (service-role key leak). The bundle is also grepped
 * in the Phase 10 security gate.
 *
 * No session persistence: this client never reads/writes auth cookies.
 */
export function createServiceClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
