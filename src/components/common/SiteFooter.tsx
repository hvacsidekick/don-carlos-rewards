import Link from "next/link";

/**
 * Site footer with the legal links (PLAN.md §Phase 10 criterion 7 — Privacy
 * Policy + Terms of Service "linked from signup + footer"). Lightweight, calm,
 * type-led per DESIGN_SYSTEM.md. Rendered on public/marketing surfaces (it is
 * NOT placed inside the fixed bottom-tab app chrome).
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto w-full max-w-[480px] px-4 py-8 text-center text-caption text-fg-secondary">
      <nav aria-label="Legal" className="flex items-center justify-center gap-4">
        <Link
          href="/privacy"
          className="rounded hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/terms"
          className="rounded hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Terms of Service
        </Link>
      </nav>
      <p className="mt-3">© {year} Don Carlos Taco Shop · Arvada, CO</p>
    </footer>
  );
}
