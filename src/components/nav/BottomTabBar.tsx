"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  UtensilsCrossed,
  QrCode,
  User,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

/**
 * BottomTabBar (DESIGN_SYSTEM.md §5.9) — fixed bottom, translucent backdrop,
 * top hairline separator, safe-area inset. Active tab = --dc-red-text (the AA
 * red — the 11px label needs ≥4.5:1, which plain --dc-red #E63946 misses). Each
 * item is ≥44pt and keyboard-reachable.
 *
 * Phase 3: the bar is hidden when signed out (auth screens have no tab bar), and
 * the Admin tab is shown only to `is_admin` users (read from the auth context;
 * the route is also guarded server-side — UI hiding is never the only control).
 */
type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/qr", label: "QR", icon: QrCode },
  { href: "/profile", label: "Profile", icon: User },
];

const ADMIN_TAB: Tab = { href: "/scan", label: "Admin", icon: ShieldCheck };

export function BottomTabBar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  // No tab bar on public/auth screens — only for signed-in app users.
  if (!user) return null;

  const tabs = profile?.is_admin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav
      aria-label="Primary"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-background/80 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-around">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-dc-red-text" : "text-fg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-6" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-caption font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
