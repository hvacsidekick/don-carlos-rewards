"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { siteUrl, safeNextPath } from "@/lib/site-url";
import { hasRecoveryAmr, type AmrClaim } from "@/lib/recovery-amr";
import { rateLimiter, AUTH_RATE_LIMIT, clientIpFromHeaders } from "@/lib/rate-limit";
import { friendlyAuthError } from "@/lib/auth-errors";
import type { ActionResult } from "@/lib/action-result";
import {
  signupSchema,
  loginSchema,
  resetRequestSchema,
  resetSchema,
  updateProfileSchema,
  type SignupInput,
  type LoginInput,
  type ResetRequestInput,
  type ResetInput,
  type UpdateProfileInput,
} from "@/schemas/auth";

/**
 * Auth Server Actions (BLUEPRINT.md §5.2, §7). Every action re-validates input
 * with Zod (never trusts the client), maps Supabase errors to friendly,
 * non-leaky copy (DESIGN_SYSTEM.md §13), and either returns an `ActionResult`
 * or `redirect()`s on success.
 */

/**
 * Per-IP rate-limit gate for an auth endpoint (PLAN.md §Phase 10 criterion 3;
 * BLUEPRINT.md §12 — 5/min/IP). Returns a friendly `ActionResult` error when the
 * limit is exceeded (the 6th attempt in the window), else null to proceed. The
 * `bucket` namespaces the limit per action so login/signup/reset don't share a
 * counter. Headers come from `next/headers` (Vercel sets `x-forwarded-for`).
 *
 * Backed by the in-memory limiter (single-instance correct); swap to Upstash/KV
 * for prod multi-instance enforcement — see `lib/rate-limit.ts`.
 */
async function authRateLimit(bucket: string): Promise<ActionResult | null> {
  const ip = clientIpFromHeaders(await headers());
  const result = await rateLimiter.check(`auth:${bucket}:${ip}`, AUTH_RATE_LIMIT);
  if (!result.ok) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a minute and try again.",
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign up (email + password, with email confirmation)
// ─────────────────────────────────────────────────────────────────────────────
export async function signUpAction(input: SignupInput, next?: string): Promise<ActionResult> {
  const limited = await authRateLimit("signup");
  if (limited) return limited;

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const { email, password, displayName } = parsed.data;

  // Preserve a sanitized `next` across the email-confirmation round-trip (closes
  // Phase 3 audit m-5 — `next` was previously dropped on the signup path). The
  // callback exchanges the code, then lands on this in-app path.
  const dest = safeNextPath(next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // `full_name` is read by the Phase-2 `handle_new_user` trigger to seed
      // profiles.display_name atomically with the auth.users row.
      data: { full_name: displayName },
      // Default email template (`{{ .ConfirmationURL }}`) redirects here after
      // verify; the callback exchanges the PKCE code for a session.
      emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(dest)}`),
    },
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  // Do not disclose whether the email already existed (anti-enumeration): always
  // route to the verify-email notice.
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign in (email + password)
// ─────────────────────────────────────────────────────────────────────────────
export async function signInAction(
  input: LoginInput,
  next?: string,
): Promise<ActionResult> {
  const limited = await authRateLimit("login");
  if (limited) return limited;

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  redirect(safeNextPath(next));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign out
// ─────────────────────────────────────────────────────────────────────────────
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ─────────────────────────────────────────────────────────────────────────────
// Request a password reset (sends recovery email)
// ─────────────────────────────────────────────────────────────────────────────
export async function resetPasswordAction(
  input: ResetRequestInput,
): Promise<ActionResult> {
  const limited = await authRateLimit("reset");
  if (limited) return limited;

  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }

  const supabase = await createClient();
  // Recovery link → callback exchanges the code → lands on /reset-password where
  // the user (now in a recovery session) sets a new password.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl("/auth/callback?next=/reset-password"),
  });

  // Always succeed — never reveal whether the email is registered.
  return { ok: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────────────────────
// Set a new password (from a recovery session)
// ─────────────────────────────────────────────────────────────────────────────
export async function updatePasswordAction(input: ResetInput): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Request a new one and try again.",
    };
  }

  // P10-CF-1 — recovery re-auth gate (closes Phase 3 audit m-1, done correctly).
  // Only a session minted from a password-recovery link (or a freshly re-authed
  // session) may set a new password — this prevents a hijacked/long-lived
  // session from silently changing the password (CWE-620). The `amr` claim that
  // proves "recovery" lives on the DECODED access-token JWT, NOT on the Session
  // object — so we read it via `getClaims()` (the bug last time was reading the
  // nonexistent `session.amr`). `hasRecoveryAmr` handles both the `string[]` and
  // `AMREntry[]` claim shapes and fails closed on a missing/malformed claim.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData) {
    return {
      ok: false,
      error: "Your reset link has expired. Request a new one and try again.",
    };
  }
  const amr = (claimsData.claims as { amr?: AmrClaim }).amr;
  if (!hasRecoveryAmr(amr)) {
    return {
      ok: false,
      error:
        "For your security, password changes must use a fresh reset link. Request a new one from “Forgot password”.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }

  redirect("/dashboard");
}

// ─────────────────────────────────────────────────────────────────────────────
// Update profile (display name) — RLS + guard-trigger safe (no sensitive cols)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: "Could not save your changes. Please try again." };
  }

  revalidatePath("/profile");
  return { ok: true, data: undefined };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotate the customer's QR token (self-service; RPC is admin-or-self guarded)
// ─────────────────────────────────────────────────────────────────────────────
export async function rotateQrTokenAction(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You are not signed in." };
  }

  const { data, error } = await supabase.rpc("rotate_qr_token", {});
  if (error || !data) {
    return { ok: false, error: "Could not rotate your code. Please try again." };
  }

  revalidatePath("/profile");
  return { ok: true, data };
}
