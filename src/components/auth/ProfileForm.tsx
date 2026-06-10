"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import { updateProfileAction } from "@/actions/auth";
import { updateProfileSchema, type UpdateProfileInput } from "@/schemas/auth";

export function ProfileForm({ initialDisplayName }: { initialDisplayName: string }) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: initialDisplayName },
  });

  async function onSubmit(values: UpdateProfileInput) {
    setServerError(null);
    const res = await updateProfileAction(values);
    if (res.ok) {
      toast.success("Profile updated.");
      form.reset(values);
    } else {
      setServerError(res.error);
    }
  }

  const submitting = form.formState.isSubmitting;
  const dirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <AuthFormError message={serverError} />

        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input type="text" autoComplete="name" placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={submitting || !dirty} className="self-start">
          {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Form>
  );
}
