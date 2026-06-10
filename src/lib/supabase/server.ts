import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Server Supabase client (BLUEPRINT.md §1, §7). Cookie-bound via `@supabase/ssr`
 * for use in Server Components, Server Actions, and Route Handlers. Anon key +
 * the user's session cookie → RLS-enforced as that user.
 *
 * `setAll` is wrapped in try/catch: cookies can only be written in a Server
 * Action or Route Handler, not while rendering a Server Component. When called
 * during render the write is a no-op and the session is refreshed by middleware
 * instead (the documented `@supabase/ssr` pattern).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — safe to ignore; the
            // session cookie is refreshed in middleware.
          }
        },
      },
    },
  );
}
