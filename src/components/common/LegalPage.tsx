import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared shell for the legal pages (/privacy, /terms). Readable measure, clear
 * heading hierarchy (h1 → h2), a "back" affordance, and a legal-review banner so
 * the placeholder copy is never mistaken for finalized legal text.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 rounded text-footnote text-fg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back home
      </Link>

      <h1 className="text-title2 text-foreground">{title}</h1>
      <p className="mt-1 text-footnote text-fg-secondary">Last updated: {lastUpdated}</p>

      <div
        role="note"
        className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-footnote text-foreground"
      >
        This is placeholder copy provided for development. It has not been reviewed
        by legal counsel and must be replaced with reviewed text before public launch.
      </div>

      <div className="mt-8 flex flex-col gap-6 text-body leading-relaxed text-foreground [&_h2]:text-headline [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-fg-secondary [&_li]:text-fg-secondary [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </main>
  );
}
