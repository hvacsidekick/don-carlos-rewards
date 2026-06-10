import { z } from "zod";

/**
 * Auth Zod schemas (BLUEPRINT.md §5.1) — the single source of truth shared by
 * the client form (react-hook-form resolver) and the server action
 * re-validation. PLAN.md golden rule: Zod on every external input.
 *
 * Password bounds: Supabase caps bcrypt input at 72 bytes; min 8 per BLUEPRINT.
 */

const email = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long");

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password can be at most 72 characters");

export const signupSchema = z.object({
  email,
  password,
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(60, "Name can be at most 60 characters"),
});

export const loginSchema = z.object({
  email,
  // Login does not re-assert strength rules — just that something was entered.
  password: z.string().min(1, "Enter your password"),
});

export const resetRequestSchema = z.object({ email });

export const resetSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(60, "Name can be at most 60 characters"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
