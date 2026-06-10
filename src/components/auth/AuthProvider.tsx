"use client";

import * as React from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

type AuthState = {
  user: User | null;
  profile: Profile | null;
  /** True while a profile re-fetch is in flight after an auth state change. */
  loading: boolean;
};

const AuthContext = React.createContext<AuthState | null>(null);

/**
 * Auth context provider (BLUEPRINT.md §8 "realtime via a small client hook";
 * §7). Seeded from the server-fetched `{ user, profile }` so there is no
 * post-hydration flash, then kept in sync with `onAuthStateChange` (sign-in,
 * sign-out, token refresh, user update). Profile reads are RLS-scoped to the
 * signed-in user.
 *
 * Note: realtime profile UPDATES (live points on the rewards card) are wired in
 * Phase 4; here the profile re-syncs on auth events, which is all Phase 3 needs.
 */
export function AuthProvider({
  initialUser,
  initialProfile,
  children,
}: {
  initialUser: User | null;
  initialProfile: Profile | null;
  children: React.ReactNode;
}) {
  const [supabase] = React.useState(() => createClient());
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [profile, setProfile] = React.useState<Profile | null>(initialProfile);
  const [loading, setLoading] = React.useState(false);

  // Track which user id the current `profile` belongs to so the INITIAL_SESSION
  // event (which fires on mount) doesn't trigger a redundant re-fetch.
  const loadedForId = React.useRef<string | null>(initialProfile?.id ?? null);

  React.useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        loadedForId.current = null;
        setProfile(null);
        return;
      }

      // Already have this user's profile (e.g. seeded from the server) — skip.
      if (loadedForId.current === nextUser.id) return;

      setLoading(true);
      void supabase
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .single()
        .then(({ data }) => {
          if (!active) return;
          loadedForId.current = nextUser.id;
          setProfile(data ?? null);
          setLoading(false);
        });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = React.useMemo<AuthState>(
    () => ({ user, profile, loading }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth/useUser/useProfile must be used within <AuthProvider>");
  }
  return ctx;
}

/** Full auth snapshot: `{ user, profile, loading }`. */
export function useAuth(): AuthState {
  return useAuthContext();
}

/** The current authenticated user (or null). */
export function useUser(): User | null {
  return useAuthContext().user;
}

/** The current user's profile row (or null). */
export function useProfile(): Profile | null {
  return useAuthContext().profile;
}
