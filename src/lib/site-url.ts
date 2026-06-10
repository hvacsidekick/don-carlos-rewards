import { clientEnv } from "@/lib/env";

/**
 * Absolute app URL builder for auth redirects (email confirmation links, OAuth
 * `redirectTo`, password recovery). Server Actions have no request origin, so we
 * derive it from `NEXT_PUBLIC_APP_URL` (BLUEPRINT.md §10.1). Trailing slash is
 * normalized away so `siteUrl("/auth/callback")` is always well-formed.
 */
export function siteUrl(path = ""): string {
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Sanitize a `next` redirect target to a safe in-app path. Rejects absolute
 * URLs, protocol-relative (`//evil.com`), backslash bypasses (`/\evil.com`),
 * and control characters to prevent open redirects (CWE-601).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  // Reject control chars (0x00-0x1F) and backslashes that bypass URL parsing
  if (/[\x00-\x1f\\]/.test(next)) return fallback;
  // Require single leading slash (no protocol-relative //)
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
