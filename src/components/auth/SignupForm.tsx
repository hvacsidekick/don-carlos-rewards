"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthFormError } from "@/components/auth/AuthFormError";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { OrDivider } from "@/components/auth/OrDivider";
import { signUpAction } from "@/actions/auth";
import { signupSchema, type SignupInput } from "@/schemas/auth";

export function SignupForm() {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput) {
    setServerError(null);
    const res = await signUpAction(values);
    // Success redirects to /verify-email; only failures return here.
    if (res && !res.ok) setServerError(res.error);
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="flex flex-col gap-6">
      <OAuthButtons />
      <OrDivider />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <AuthFormError message={serverError} />

          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Use at least 8 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
