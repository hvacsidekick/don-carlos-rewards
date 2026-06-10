"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { siteUrl, safeNextPath } from "@/lib/site-url";
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

/** Map a raw Supabase auth error to safe, human copy (no codes/stack leak). */
function friendlyAuthError(message: string): string {
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

// ─────────────────────────────────────────────────────────────────────────────
// Sign up (email + password, with email confirmation)
// ─────────────────────────────────────────────────────────────────────────────
export async function signUpAction(input: SignupInput): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const { email, password, displayName } = parsed.data;

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
      emailRedirectTo: siteUrl("/auth/callback?next=/dashboard"),
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

  // NOTE (Phase 10 carry-forward — re-auth hardening, was audit finding m-1):
  // We intentionally do NOT gate this on a "recovery" AMR here. `amr` is a claim
  // inside the decoded access-token JWT (read via getAuthenticatorAssuranceLevel
  // / payload.amr), NOT a field on the Session object — reading `session.amr`
  // returns undefined and would reject EVERY reset, breaking the recovery flow.
  // Implement the recovery-session gate in Phase 10 once it can be end-to-end
  // tested (needs SMTP or a real service-role key to mint a recovery session):
  // decode `session.access_token`, check `amr` for method "recovery" (handle
  // both string[] and AMREntry[] formats), OR stamp a short-lived recovery
  // marker cookie from /auth/callback. Tracked in PHASE_LOG.md Phase 3 → P10-CF.
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
