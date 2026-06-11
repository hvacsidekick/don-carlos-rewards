"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2, ScanLine, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addPointsAction,
  resolveQrTokenAction,
  type ResolvedCustomer,
} from "@/actions/scan";
import { addPointsInputSchema, qrTokenSchema } from "@/schemas/scan";
import { pointsForAmount } from "@/lib/points";
import { formatPoints } from "@/lib/format";
import { haptic } from "@/lib/haptics";

/**
 * ScanFlow (PLAN.md §Phase 5 scan-to-add) — the admin interaction that ties the
 * camera scanner, the server token-resolve, and the add-points pipeline together.
 *
 * Flow: scan (or type) a code → `resolveQrTokenAction` → confirm sheet showing
 * the customer + balance → enter a $ amount (or points) → `addPointsAction` →
 * success toast (the customer's card updates live via Phase-4 realtime).
 *
 * The scanner is `dynamic(ssr:false)` so its `@zxing/browser` chunk only loads
 * on this admin route, in the browser (perf §11). Every server call is the real
 * trust boundary (admin re-checked server-side) — this island is UX only.
 *
 * Double-add guard: submit is disabled while pending AND a short post-success
 * dedupe window ignores a repeat confirm for the same customer (an accidental
 * double-tap can't double-award).
 */

const QRScanner = dynamic(
  () => import("@/components/qr/QRScanner").then((m) => m.QRScanner),
  { ssr: false },
);

const DEDUPE_WINDOW_MS = 4000;

type Mode = "scan" | "manual";

export function ScanFlow({ pointsPerDollar }: { pointsPerDollar: number }) {
  const [mode, setMode] = React.useState<Mode>("scan");
  const [resetSignal, setResetSignal] = React.useState(0);
  const [resolving, setResolving] = React.useState(false);
  const [manualToken, setManualToken] = React.useState("");

  const [customer, setCustomer] = React.useState<ResolvedCustomer | null>(null);
  const [amount, setAmount] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [amountError, setAmountError] = React.useState<string | null>(null);

  // Remembers the last successful (customerId@timestamp) to swallow a rapid
  // duplicate confirm for the same person (idempotency / double-scan guard).
  const lastAddRef = React.useRef<{ id: string; at: number } | null>(null);

  // Token of the customer currently in the confirm sheet (set on a successful
  // resolve). Copied into `recentlyScannedRef` on a successful add so the same
  // physical QR isn't auto-re-resolved the instant the scanner re-arms (M-1).
  const currentTokenRef = React.useRef<string | null>(null);
  const recentlyScannedRef = React.useRef<{ token: string; at: number } | null>(null);

  // P10-CF-3: one idempotency key per opened confirm sheet. Reused if the user
  // re-taps "Add points" (or a flaky-network action retries), so the customer is
  // credited exactly once even if two requests reach the server.
  const idempotencyKeyRef = React.useRef<string | null>(null);

  const reArmScanner = React.useCallback(() => {
    setResetSignal((n) => n + 1);
  }, []);

  const resolveToken = React.useCallback(async (token: string) => {
    setResolving(true);
    const res = await resolveQrTokenAction(token);
    setResolving(false);
    if (res.ok) {
      currentTokenRef.current = token;
      // Fresh idempotency key for this add (one per resolved customer/sheet).
      idempotencyKeyRef.current = crypto.randomUUID();
      setCustomer(res.data);
      setAmount("");
      setAmountError(null);
    } else {
      toast.error(res.error);
      reArmScanner();
    }
  }, [reArmScanner]);

  const handleDetected = React.useCallback(
    (text: string) => {
      const token = text.trim();
      // Cooldown: ignore an AUTO re-detection of the QR we just added points to
      // (the lens is often still on it when the scanner re-arms). A deliberate
      // re-scan after the window — or any other customer's code — still resolves.
      const recent = recentlyScannedRef.current;
      if (recent && recent.token === token && Date.now() - recent.at < DEDUPE_WINDOW_MS) {
        return;
      }
      void resolveToken(token);
    },
    [resolveToken],
  );

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = qrTokenSchema.safeParse(manualToken);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid code.");
      return;
    }
    void resolveToken(parsed.data);
  }

  function closeSheet() {
    setCustomer(null);
    setAmount("");
    setAmountError(null);
    // Re-arm the camera so the next customer can be scanned immediately.
    if (mode === "scan") reArmScanner();
  }

  // Cents parsed from the dollar input (e.g. "3.50" → 350). Null when blank/invalid.
  const amountCents = React.useMemo(() => {
    const trimmed = amount.trim();
    if (trimmed === "") return null;
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars)) return null;
    return Math.round(dollars * 100);
  }, [amount]);

  const previewPoints =
    amountCents !== null && amountCents > 0 ? pointsForAmount(amountCents, pointsPerDollar) : null;

  async function handleConfirm() {
    if (!customer || submitting) return;

    // Validate against the SHARED schema (same rules the server enforces).
    const candidate = { target: customer.id, amountCents: amountCents ?? undefined };
    const parsed = addPointsInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setAmountError(parsed.error.issues[0]?.message ?? "Enter a valid amount.");
      return;
    }
    if (previewPoints !== null && previewPoints <= 0) {
      setAmountError("That amount is too small to earn a point.");
      return;
    }

    // Short-window dedupe: ignore a repeat confirm for the same customer.
    const now = Date.now();
    const last = lastAddRef.current;
    if (last && last.id === customer.id && now - last.at < DEDUPE_WINDOW_MS) {
      return;
    }

    setSubmitting(true);
    setAmountError(null);
    const res = await addPointsAction({
      target: customer.id,
      amountCents: amountCents ?? undefined,
      idempotencyKey: idempotencyKeyRef.current ?? undefined,
    });
    setSubmitting(false);

    if (res.ok) {
      lastAddRef.current = { id: customer.id, at: Date.now() };
      // Suppress an immediate auto-re-scan of this same QR when the camera
      // re-arms (M-1) — staff would otherwise see a spurious re-prompt.
      if (currentTokenRef.current) {
        recentlyScannedRef.current = { token: currentTokenRef.current, at: Date.now() };
      }
      haptic.success();
      toast.success(
        `Added ${formatPoints(res.data.pointsAdded)} ${res.data.pointsAdded === 1 ? "point" : "points"} for ${customer.displayName ?? "the customer"}.`,
      );
      closeSheet();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Add points by"
        className="grid grid-cols-2 gap-1 rounded-xl bg-fill-quaternary p-1"
      >
        <ModeTab active={mode === "scan"} onClick={() => setMode("scan")}>
          <ScanLine className="size-4" aria-hidden="true" />
          Scan code
        </ModeTab>
        <ModeTab active={mode === "manual"} onClick={() => setMode("manual")}>
          <UserRound className="size-4" aria-hidden="true" />
          Enter code
        </ModeTab>
      </div>

      {mode === "scan" ? (
        <QRScanner
          resetSignal={resetSignal}
          onDetected={handleDetected}
          onManualEntry={() => setMode("manual")}
          onCancel={() => setMode("manual")}
        />
      ) : (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manual-token">Customer rewards code</Label>
            <Input
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            <p className="text-caption text-fg-secondary">
              The code under the customer&apos;s QR (in their profile).
            </p>
          </div>
          <Button type="submit" disabled={resolving}>
            {resolving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {resolving ? "Looking up…" : "Look up customer"}
          </Button>
        </form>
      )}

      {resolving && mode === "scan" ? (
        <p className="text-center text-footnote text-fg-secondary" role="status">
          Looking up customer…
        </p>
      ) : null}

      {/* Confirmation sheet */}
      <Sheet open={customer !== null} onOpenChange={(open) => (!open ? closeSheet() : undefined)}>
        <SheetContent side="bottom" className="mx-auto max-w-[480px]">
          {customer ? (
            <ConfirmForm
              customer={customer}
              amount={amount}
              onAmountChange={(v) => {
                setAmount(v);
                if (amountError) setAmountError(null);
              }}
              amountError={amountError}
              previewPoints={previewPoints}
              submitting={submitting}
              onConfirm={handleConfirm}
              onCancel={closeSheet}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-footnote font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background text-foreground shadow-sm" : "text-fg-secondary hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ConfirmForm({
  customer,
  amount,
  onAmountChange,
  amountError,
  previewPoints,
  submitting,
  onConfirm,
  onCancel,
}: {
  customer: ResolvedCustomer;
  amount: string;
  onAmountChange: (v: string) => void;
  amountError: string | null;
  previewPoints: number | null;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const errorId = "scan-amount-error";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
      className="flex flex-col gap-5"
    >
      <SheetHeader>
        <SheetTitle>{customer.displayName ?? "Customer"}</SheetTitle>
        <SheetDescription>
          {customer.email} · Balance {formatPoints(customer.pointsBalance)}{" "}
          {customer.pointsBalance === 1 ? "point" : "points"}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scan-amount">Purchase amount</Label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-body text-fg-secondary"
            aria-hidden="true"
          >
            $
          </span>
          <Input
            id="scan-amount"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
            className="pl-8 tabular-nums"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? errorId : undefined}
            autoFocus
          />
        </div>
        {previewPoints !== null && !amountError ? (
          <p className="text-footnote text-fg-secondary" role="status">
            Earns{" "}
            <span className="font-semibold text-foreground">{formatPoints(previewPoints)}</span>{" "}
            {previewPoints === 1 ? "point" : "points"}
          </p>
        ) : null}
        {amountError ? (
          <p id={errorId} role="alert" className="text-footnote text-error-text">
            {amountError}
          </p>
        ) : null}
      </div>

      <SheetFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Adding…" : "Add points"}
        </Button>
      </SheetFooter>
    </form>
  );
}
