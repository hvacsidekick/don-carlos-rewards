import Link from "next/link";

import { Mascot } from "@/components/common/Mascot";
import type { MascotExpression } from "@/components/common/Mascot";

/**
 * Shared layout for the `(auth)` screens (DESIGN_SYSTEM.md §1, §4 — calm,
 * type-led, 90/10 color restraint). Centered single column capped at the phone
 * width, generous whitespace, optional mascot. The page body (form) is passed
 * as children.
 */
export function AuthShell({
  title,
  subtitle,
  mascot,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  mascot?: MascotExpression;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[400px] flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        {mascot ? (
          <Mascot expression={mascot} size={88} />
        ) : (
          <Link
            href="/"
            className="rounded-xl text-headline font-semibold text-dc-red-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Don Carlos 🌮
          </Link>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title3 text-foreground">{title}</h1>
          {subtitle ? <p className="text-body text-fg-secondary">{subtitle}</p> : null}
        </div>
      </header>

      {children}

      {footer ? (
        <footer className="text-center text-footnote text-fg-secondary">{footer}</footer>
      ) : null}
    </main>
  );
}
