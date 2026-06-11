import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { Toaster } from "@/components/ui/sonner";
import { getServerAuth } from "@/lib/auth/get-server-auth";

export const metadata: Metadata = {
  title: {
    default: "Don Carlos Rewards",
    template: "%s · Don Carlos Rewards",
  },
  description: "Earn points and unlock rewards at Don Carlos Taco Shop, Arvada CO.",
  applicationName: "Don Carlos Rewards",
  // PWA manifest (src/app/manifest.ts → /manifest.webmanifest). Explicit link so
  // the <link rel="manifest"> is emitted even on routes that override metadata.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS standalone install: capable + status-bar style + home-screen title.
    // "default" status bar keeps a legible (non-overlapping) bar; the app already
    // honors safe-area insets (viewportFit:"cover" + min-h-screen-safe).
    capable: true,
    statusBarStyle: "default",
    title: "Don Carlos",
    // iOS ignores the manifest icons — it uses apple-touch-icon. 180×180, opaque.
    startupImage: undefined,
  },
  icons: {
    // Standard favicon stays the app/icon.svg (auto-detected). Add the PNG app
    // icon + the iOS apple-touch-icon (opaque, 180×180).
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
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
          <InstallPrompt />
          <Toaster />
        </AuthProvider>
        {/* Registers /sw.js in production only (guarded, no inline script → CSP-safe). */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
