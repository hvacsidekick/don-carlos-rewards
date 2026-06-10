/**
 * Single source of truth for route-group access rules (BLUEPRINT.md §7).
 *
 * Next.js route groups — `(auth)`, `(user)`, `(admin)` — are URL-transparent
 * (the parentheses never appear in the path), so middleware cannot infer the
 * group from the URL. Instead we key guards off explicit path prefixes here.
 * Keep this in sync with `src/app/(user)/*` and `src/app/(admin)/*` routes.
 */

/** Requires an authenticated session. */
export const USER_PREFIXES = ["/dashboard", "/profile", "/transactions", "/qr"] as const;

/** Requires an authenticated session AND `profiles.is_admin = true`. */
export const ADMIN_PREFIXES = ["/scan", "/customers", "/analytics"] as const;

/**
 * Auth pages an already-authenticated user should be bounced away from
 * (→ dashboard). `reset-password` and `verify-email` are intentionally EXCLUDED:
 * password recovery establishes a session before the user sets a new password,
 * and the verify-email notice may be shown mid-flow.
 */
export const AUTH_REDIRECT_WHEN_AUTHED = ["/login", "/signup", "/forgot-password"] as const;

/** Where to send an authenticated user with no explicit destination. */
export const DEFAULT_AUTHED_REDIRECT = "/dashboard";

/** Where to send an unauthenticated user hitting a protected route. */
export const LOGIN_PATH = "/login";

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isUserRoute(pathname: string): boolean {
  return matchesPrefix(pathname, USER_PREFIXES);
}

export function isAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, ADMIN_PREFIXES);
}

/** True when the path requires any session (user OR admin). */
export function isProtectedRoute(pathname: string): boolean {
  return isUserRoute(pathname) || isAdminRoute(pathname);
}

export function isAuthRedirectRoute(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_REDIRECT_WHEN_AUTHED);
}
