"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { OrDivider } from "@/components/auth/OrDivider";
import { signInAction } from "@/actions/auth";
import { loginSchema, type LoginInput } from "@/schemas/auth";

export function LoginForm({ next }: { next?: string }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const res = await signInAction(values, next);
    // Success redirects server-side; only failures return here.
    if (res && !res.ok) setServerError(res.error);
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="flex flex-col gap-6">
      <OAuthButtons next={next} />
      <OrDivider />

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="rounded text-footnote font-medium text-dc-red-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Forgot?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
