import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";
import {
  DEFAULT_AUTHED_REDIRECT,
  LOGIN_PATH,
  isAdminRoute,
  isAuthRedirectRoute,
  isProtectedRoute,
} from "@/lib/auth-routes";

/**
 * Session refresh + route guard (BLUEPRINT.md §7).
 *
 * Runs on every matched request. It (1) refreshes the Supabase auth cookie via
 * `getUser()` (which revalidates the JWT against the auth server — never trust
 * `getSession()` alone in middleware), and (2) enforces access rules:
 *   - protected `(user)`/`(admin)` routes require a session → else `/login?next=`
 *   - `(admin)` routes additionally require `is_admin` → else `/dashboard`
 *   - authenticated user on login/signup/forgot → `/dashboard`
 *
 * IMPORTANT: the returned `supabaseResponse` carries the refreshed Set-Cookie
 * headers. When redirecting we copy those cookies onto the redirect response so
 * the refreshed session is not dropped.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session + revalidates the JWT. Do not run code between
  // createServerClient and getUser — it can cause hard-to-debug session drops.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const redirectWithCookies = (path: string): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const res = NextResponse.redirect(url);
    // Preserve refreshed auth cookies on the redirect.
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // 1. Unauthenticated user hitting a protected route → login (preserve `next`).
  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  }

  // 2. Authenticated user.
  if (user) {
    // 2a. Admin route → require is_admin (server-checked, never UI-only).
    if (isAdminRoute(pathname)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        return redirectWithCookies(DEFAULT_AUTHED_REDIRECT);
      }
    }

    // 2b. Already authed on an auth page → bounce to dashboard.
    if (isAuthRedirectRoute(pathname)) {
      return redirectWithCookies(DEFAULT_AUTHED_REDIRECT);
    }
  }

  return supabaseResponse;
}
