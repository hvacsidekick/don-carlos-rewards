"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Users, BarChart3, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * AdminNav (BLUEPRINT.md §2, §8; PLAN.md §Phase 9) — the admin portal's section
 * navigation (Scan / Customers / Analytics), rendered by the `(admin)` layout so
 * it appears on every admin route.
 *
 * Responsive: a horizontal segmented bar that fits a tablet or phone. Active
 * state is conveyed by a filled pill + bold weight + `aria-current`, NOT by
 * color alone (DESIGN_SYSTEM §9) — so it reads for color-blind users and in
 * forced-colors mode. Each target is ≥44pt and keyboard-reachable with a visible
 * focus ring. The route is also guarded server-side; this nav is UI only.
 */
type AdminTab = { href: string; label: string; icon: LucideIcon };

const TABS: AdminTab[] = [
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="w-full">
      <ul className="mx-auto flex max-w-3xl items-stretch gap-1 rounded-2xl bg-surface-secondary p-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-footnote transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "bg-background font-semibold text-foreground shadow-card dark:shadow-card-dark"
                    : "font-medium text-fg-secondary hover:text-foreground",
                )}
              >
                <Icon
                  className="size-5"
                  aria-hidden="true"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
