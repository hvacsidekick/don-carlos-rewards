"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Gift } from "lucide-react";
import { toast } from "sonner";

import { adjustPointsAction, redeemOnBehalfAction } from "@/actions/admin";
import { adjustPointsSchema } from "@/schemas/admin";
import { formatPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * AdminCustomerActions (PLAN.md §Phase 9) — the staff mutations on the customer
 * detail page: Manual Adjust (add/subtract with a MANDATORY reason) and Redeem
 * on behalf. Both call NEW admin Server Actions that begin with `requireAdmin()`
 * and re-validate input with Zod server-side; the underlying SECURITY DEFINER
 * RPCs write the ledger + `audit_log` atomically.
 *
 * After a success we show the new balance optimistically AND `router.refresh()`
 * so the server-rendered balance + transaction history re-fetch (the actions
 * `revalidatePath` the detail route). The reason is required and the submit is
 * disabled while pending (no double-submit).
 */
type Direction = "add" | "subtract";

type Props = {
  userId: string;
  customerName: string;
  balance: number;
  /** Points needed for one reward (from rewards_config) — gates redeem-on-behalf. */
  redeemThreshold: number;
};

export function AdminCustomerActions({
  userId,
  customerName,
  balance,
  redeemThreshold,
}: Props) {
  const router = useRouter();
  const [liveBalance, setLiveBalance] = useState(balance);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const canRedeem = liveBalance >= redeemThreshold;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-2xl bg-surface-tertiary px-5 py-4 shadow-card dark:shadow-card-dark">
        <p className="text-footnote text-fg-secondary">Current balance</p>
        <p className="text-title2 font-semibold tabular-nums text-foreground">
          {formatPoints(liveBalance)}{" "}
          <span className="text-headline font-medium text-fg-secondary">
            {liveBalance === 1 ? "point" : "points"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setAdjustOpen(true)}>
          Adjust points
        </Button>
        <Button onClick={() => setRedeemOpen(true)} disabled={!canRedeem}>
          <Gift className="size-5" aria-hidden="true" />
          Redeem reward
        </Button>
      </div>
      {!canRedeem && (
        <p className="text-caption text-fg-secondary">
          Needs {formatPoints(redeemThreshold)} points to redeem a reward (has{" "}
          {formatPoints(liveBalance)}).
        </p>
      )}

      <AdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        userId={userId}
        customerName={customerName}
        onApplied={(newBalance) => {
          setLiveBalance(newBalance);
          router.refresh();
        }}
      />

      <RedeemOnBehalfDialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        userId={userId}
        customerName={customerName}
        redeemThreshold={redeemThreshold}
        onApplied={(newBalance) => {
          setLiveBalance(newBalance);
          router.refresh();
        }}
      />
    </div>
  );
}

function AdjustDialog({
  open,
  onOpenChange,
  userId,
  customerName,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  customerName: string;
  onApplied: (newBalance: number) => void;
}) {
  const [direction, setDirection] = useState<Direction>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorId = "adjust-error";

  function reset() {
    setDirection("add");
    setAmount("");
    setReason("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const magnitude = Number(amount.trim());
    if (!Number.isInteger(magnitude) || magnitude <= 0) {
      setError("Enter a whole number of points greater than zero.");
      return;
    }
    const delta = direction === "add" ? magnitude : -magnitude;

    // Validate against the SHARED schema (same rules the server enforces).
    const parsed = adjustPointsSchema.safeParse({ userId, delta, reason: reason.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the adjustment.");
      return;
    }

    setSubmitting(true);
    const res = await adjustPointsAction(parsed.data);
    setSubmitting(false);

    if (res.ok) {
      toast.success(
        `Adjusted ${customerName}'s balance by ${res.data.appliedDelta > 0 ? "+" : ""}${formatPoints(res.data.appliedDelta)} (now ${formatPoints(res.data.newBalance)}).`,
      );
      onApplied(res.data.newBalance);
      onOpenChange(false);
      reset();
    } else {
      setError(res.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust points</DialogTitle>
          <DialogDescription>
            Add or remove points for {customerName}. A reason is required and recorded.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Direction toggle — state conveyed by fill + label + aria-pressed, not color alone. */}
          <div role="group" aria-label="Adjustment direction" className="grid grid-cols-2 gap-1 rounded-xl bg-fill-quaternary p-1">
            <DirectionButton
              active={direction === "add"}
              onClick={() => setDirection("add")}
              icon={<Plus className="size-4" aria-hidden="true" />}
              label="Add"
            />
            <DirectionButton
              active={direction === "subtract"}
              onClick={() => setDirection("subtract")}
              icon={<Minus className="size-4" aria-hidden="true" />}
              label="Subtract"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjust-amount">Points</Label>
            <Input
              id="adjust-amount"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError(null);
              }}
              placeholder="0"
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adjust-reason">
              Reason <span className="text-error-text">*</span>
            </Label>
            <Input
              id="adjust-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Goodwill credit for a missed scan"
              autoComplete="off"
              maxLength={280}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <p className="text-caption text-fg-secondary">
              Recorded in the audit log with your name.
            </p>
          </div>

          {error ? (
            <p id={errorId} role="alert" className="text-footnote text-error-text">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
              {submitting ? "Applying…" : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DirectionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-footnote font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background text-foreground shadow-sm" : "text-fg-secondary hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RedeemOnBehalfDialog({
  open,
  onOpenChange,
  userId,
  customerName,
  redeemThreshold,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  customerName: string;
  redeemThreshold: number;
  onApplied: (newBalance: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const res = await redeemOnBehalfAction({ userId });
    setSubmitting(false);

    if (res.ok) {
      toast.success(
        `Redeemed a reward for ${customerName}. New balance ${formatPoints(res.data.newBalance)}.`,
      );
      onApplied(res.data.newBalance);
      onOpenChange(false);
    } else {
      setError(res.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem a reward</DialogTitle>
          <DialogDescription>
            Spend {formatPoints(redeemThreshold)} points from {customerName}&apos;s balance for one
            in-person reward. This is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-footnote text-error-text">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Redeeming…" : `Redeem ${formatPoints(redeemThreshold)} pts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
