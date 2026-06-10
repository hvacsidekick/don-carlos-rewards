import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/actions/auth";

/**
 * Sign out via a server-action form (no client JS needed). `signOutAction`
 * clears the session and redirects to `/`.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        <LogOut className="size-5" aria-hidden="true" />
        Sign out
      </Button>
    </form>
  );
}
