/**
 * Map a raw Supabase auth error message to safe, human copy (no codes/stack
 * leak). Pure + unit-testable (P10-CF-2). Extracted from `actions/auth.ts` so it
 * can be covered by tests without importing a `"use server"` module.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email first — check your inbox for the link.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  // Email delivery failures (SMTP not configured, rate-limited, etc.)
  if ((m.includes("sending") || m.includes("send")) && m.includes("email"))
    return "We couldn't send your confirmation email right now. Please try again shortly.";
  if (m.includes("password")) return "That password doesn't meet the requirements.";
  return "Something went wrong. Please try again.";
}
