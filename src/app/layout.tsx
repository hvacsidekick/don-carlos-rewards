import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Toaster } from "@/components/ui/sonner";
import { getServerAuth } from "@/lib/auth/get-server-auth";

export const metadata: Metadata = {
  title: {
    default: "Don Carlos Rewards",
    template: "%s · Don Carlos Rewards",
  },
  description: "Earn points and unlock rewards at Don Carlos Taco Shop, Arvada CO.",
  applicationName: "Don Carlos Rewards",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Don Carlos",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Do NOT set maximum-scale / user-scalable=no — blocking zoom fails WCAG.
  viewportFit: "cover", // honor iOS safe-area insets (notch / home indicator)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Seed the auth context on the server so client islands (BottomTabBar admin
  // tab, profile, etc.) hydrate without a flash (BLUEPRINT.md §7, §8).
  const { user, profile } = await getServerAuth();

  return (
    <html lang="en">
      <body className="min-h-screen-safe bg-background text-foreground antialiased">
        <AuthProvider initialUser={user} initialProfile={profile}>
          {/* pb-20 reserves space for the fixed BottomTabBar (~64pt + safe area).
              The bar hides itself when signed out, but the reserve is harmless on
              the vertically-centered auth screens. */}
          <div className="pb-20">{children}</div>
          <BottomTabBar />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
