"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { loadCustomersAction } from "@/actions/admin";
import { CUSTOMERS_PAGE_SIZE, type CustomerListItem } from "@/lib/customers";
import { formatPoints, formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/common/Mascot";

/**
 * CustomerList (PLAN.md §Phase 9) — the searchable, paginated admin customer
 * directory. A Server Component fetches the first page and hands it here; this
 * island owns the search box, the accumulated rows, and the keyset cursor for
 * "Load more". The server stays the trust boundary (admin re-checked, cursor +
 * page size owned server-side); we only relay the opaque cursor + search term.
 *
 * Search is debounced so each keystroke doesn't fire an action. An empty result
 * shows a friendly state; a loading skeleton covers the in-flight first page.
 */
const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  initialItems: CustomerListItem[];
  initialCursor: string | null;
};

export function CustomerList({ initialItems, initialCursor }: Props) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CustomerListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Track the latest search request so a slow earlier response can't overwrite a
  // newer one (out-of-order responses).
  const requestIdRef = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the effect on mount — the server already provided the first page.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const term = search.trim();
    setLoadingSearch(true);
    const requestId = ++requestIdRef.current;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await loadCustomersAction({ search: term || undefined, cursor: null });
        // Ignore a stale response (a newer search has since fired).
        if (requestId !== requestIdRef.current) return;
        setLoadingSearch(false);
        if (res.ok) {
          setItems(res.data.items);
          setCursor(res.data.nextCursor);
        } else {
          toast.error(res.error);
        }
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function loadMore() {
    if (!cursor || isPending) return;
    startTransition(async () => {
      const res = await loadCustomersAction({ search: search.trim() || undefined, cursor });
      if (res.ok) {
        setItems((prev) => [...prev, ...res.data.items]);
        setCursor(res.data.nextCursor);
      } else {
        toast.error(res.error);
      }
    });
  }

  const showEmpty = items.length === 0 && !loadingSearch;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="customer-search">Search customers</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-fg-tertiary"
            aria-hidden="true"
          />
          <Input
            id="customer-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
            autoComplete="off"
            spellCheck={false}
            className="pl-10"
          />
        </div>
      </div>

      {/* Assistive status for in-flight searches. */}
      <p aria-live="polite" className="sr-only">
        {loadingSearch ? "Searching customers" : ""}
      </p>

      {loadingSearch ? (
        <CustomerListSkeleton />
      ) : showEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-tertiary px-4 py-12 text-center shadow-card dark:shadow-card-dark">
          <Mascot expression="empty" size={56} />
          <p className="text-footnote text-fg-secondary">
            {search.trim() ? "No customers match that search." : "No customers yet."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className={cn(
                  "flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-fill-quaternary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-emph text-foreground">
                    {c.displayName ?? "Unnamed customer"}
                  </p>
                  <p className="truncate text-footnote text-fg-secondary">{c.email}</p>
                  <p className="text-caption text-fg-tertiary">
                    Lifetime {formatPoints(c.totalPointsEarned)} ·{" "}
                    {c.lastActivityAt
                      ? `Active ${formatRelativeDay(c.lastActivityAt)}`
                      : "No activity yet"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-body-emph tabular-nums text-foreground">
                    {formatPoints(c.pointsBalance)}
                  </p>
                  <p className="text-caption text-fg-secondary">points</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-fg-tertiary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor && !loadingSearch && (
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={loadMore}
          disabled={isPending}
        >
          {isPending ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

/** Skeleton matching the customer-row layout (PLAN §Phase 9: loading state). */
export function CustomerListSkeleton() {
  return (
    <ul
      className="divide-y divide-separator overflow-hidden rounded-2xl bg-surface-tertiary shadow-card dark:shadow-card-dark"
      aria-hidden="true"
    >
      {Array.from({ length: Math.min(6, CUSTOMERS_PAGE_SIZE) }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/5 rounded bg-fill-quaternary" />
            <div className="h-3 w-3/5 rounded bg-fill-quaternary" />
          </div>
          <div className="h-4 w-10 rounded bg-fill-quaternary" />
        </li>
      ))}
    </ul>
  );
}
