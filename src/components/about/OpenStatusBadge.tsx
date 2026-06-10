"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { getOpenStatus, type OpenStatus } from "@/lib/location";

/**
 * Live "Open now / Closed" pill (PLAN.md Phase 8). Status is computed from the
 * shop's **America/Denver** wall-clock time (see `lib/location.ts`), so it is
 * correct regardless of the visitor's device timezone.
 *
 * Rendered client-side and re-checked once a minute so the pill flips at the
 * exact open/close boundary without a reload. To avoid an SSR/client hydration
 * mismatch (the server's wall-clock minute can differ from the client's by the
 * time React hydrates), the first paint is neutral and the real status is set
 * in `useEffect`. State is never conveyed by color alone — a dot + text label
 * always accompany it (DESIGN_SYSTEM §9).
 */
const CLOSED_REASON_LABEL: Record<
  Extract<OpenStatus, { open: false }>["reason"],
  string
> = {
  "before-open": "Opens at 7:00 AM",
  "after-close": "Closed for the day",
  "closed-today": "Closed Sundays",
};

export function OpenStatusBadge({ className }: { className?: string }) {
  const [status, setStatus] = useState<OpenStatus | null>(null);

  useEffect(() => {
    const update = () => setStatus(getOpenStatus());
    update();
    // Re-evaluate every minute so the pill flips at the boundary.
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Neutral placeholder until the client computes the real status (no flicker
  // of a wrong state, no hydration mismatch).
  if (status === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full bg-fill-quaternary px-3 py-1 text-footnote font-medium text-fg-secondary",
          className,
        )}
      >
        <span className="size-2 rounded-full bg-fg-tertiary" aria-hidden="true" />
        Checking hours…
      </span>
    );
  }

  const isOpen = status.open;
  const label = isOpen ? "Open now" : "Closed";
  const detail = isOpen ? null : CLOSED_REASON_LABEL[status.reason];

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-footnote font-semibold",
        isOpen
          ? "bg-dc-green/15 text-dc-green-text"
          : "bg-fill-quaternary text-fg-secondary",
        className,
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          isOpen ? "bg-dc-green" : "bg-fg-tertiary",
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
      {detail ? <span className="font-normal text-fg-secondary">· {detail}</span> : null}
    </span>
  );
}
