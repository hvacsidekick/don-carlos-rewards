import type { Metadata } from "next";

import { getServerAuth } from "@/lib/auth/get-server-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { QrTokenCard } from "@/components/auth/QrTokenCard";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DeleteAccountButton } from "@/components/auth/DeleteAccountButton";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user, profile } = await getServerAuth();

  const displayName = profile?.display_name ?? "";
  const email = profile?.email ?? user?.email ?? "";
  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-8 px-4 py-10">
      <header className="flex items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="bg-dc-red/10 text-headline font-semibold text-dc-red-text">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-title3 text-foreground">{displayName || "Your profile"}</h1>
          <p className="truncate text-footnote text-fg-secondary">{email}</p>
        </div>
      </header>

      <section aria-labelledby="details-heading" className="flex flex-col gap-4">
        <h2 id="details-heading" className="text-headline text-foreground">
          Account details
        </h2>
        <ProfileForm initialDisplayName={displayName} />
      </section>

      {profile?.qr_token ? (
        <section aria-labelledby="code-heading" className="flex flex-col gap-4">
          <h2 id="code-heading" className="text-headline text-foreground">
            Rewards code
          </h2>
          <QrTokenCard initialToken={profile.qr_token} />
        </section>
      ) : null}

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-headline text-foreground">
          Account
        </h2>
        <SignOutButton />
        <div className="mt-2 border-t border-separator pt-4">
          <p className="mb-3 text-footnote text-fg-secondary">
            Deleting your account permanently removes your data.
          </p>
          <DeleteAccountButton />
        </div>
      </section>
    </main>
  );
}
