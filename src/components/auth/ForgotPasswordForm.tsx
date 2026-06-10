"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { resetPasswordAction } from "@/actions/auth";
import { resetRequestSchema, type ResetRequestInput } from "@/schemas/auth";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const form = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetRequestInput) {
    setServerError(null);
    const res = await resetPasswordAction(values);
    if (res.ok) {
      setSent(true);
    } else {
      setServerError(res.error);
    }
  }

  const submitting = form.formState.isSubmitting;

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-5 py-6 text-center"
      >
        <CheckCircle2 className="size-7 text-success-text" aria-hidden="true" />
        <p className="text-body-emph text-foreground">Check your email</p>
        <p className="text-footnote text-fg-secondary">
          If an account exists for that address, we&apos;ve sent a link to reset your password.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <AuthFormError message={serverError} />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </Form>
  );
}
