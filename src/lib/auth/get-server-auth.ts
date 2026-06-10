import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

export type ServerAuth = {
  user: User | null;
  profile: Profile | null;
};

/**
 * Server-side auth snapshot for layouts / RSC (BLUEPRINT.md §7, §8 "server data
 * via RSC props"). Returns the validated user (via `getUser`, which revalidates
 * the JWT) and their profile row. Used to seed `AuthProvider` without a client
 * flash and to enforce defense-in-depth guards in `(user)`/`(admin)` layouts.
 */
export async function getServerAuth(): Promise<ServerAuth> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile: profile ?? null };
}
