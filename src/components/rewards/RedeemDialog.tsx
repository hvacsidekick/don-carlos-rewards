"use client";

import * as React from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { redeemPointsAction } from "@/actions/rewards";
import { formatPoints } from "@/lib/format";
import { haptic } from "@/lib/haptics";

/**
 * RedeemDialog (DESIGN_SYSTEM.md §5.10/§9, PHASE_4_TASK §4.5, D4-6).
 *
 * shadcn `dialog` (Radix gives focus-trap + Esc + focus restore). Confirm calls
 * `redeemPointsAction()` (no args — the server reads the canonical threshold and
 * redeems exactly that many points). While submitting the confirm button is
 * disabled (never double-submit). On success: close, toast, and hand the new
 * balance up so the card can reconcile + celebrate. On failure: keep the dialog
 * open and show a friendly INLINE error (announced via `role="alert"`); the
 * balance is untouched.
 *
 * The trigger button (with its eligible/disabled state + glow) is supplied by
 * the parent so this component stays presentation-agnostic about CTA styling.
 */
export function RedeemDialog({
  eligible,
  rewardValue,
  threshold,
  onRedeemed,
  trigger,
}: {
  /** True when balance ≥ threshold; gates submission as defense in depth. */
  eligible: boolean;
  /** Pre-formatted reward value, e.g. "$10.00". */
  rewardValue: string;
  /** Points spent per redemption (from rewards_config). */
  threshold: number;
  /** Called with the authoritative new balance after a successful redeem. */
  onRedeemed: (newBalance: number) => void;
  /** The CTA element that opens the dialog. */
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset transient state whenever the dialog opens.
  function handleOpenChange(next: boolean) {
    if (pending) return; // don't allow closing mid-submit
    setOpen(next);
    if (next) setError(null);
  }

  async function onConfirm() {
    if (pending || !eligible) return; // never double-submit
    setPending(true);
    setError(null);

    const res = await redeemPointsAction();

    if (!res.ok) {
      // Keep the dialog open; surface a friendly inline error. No balance change.
      setPending(false);
      setError(res.error);
      return;
    }

    haptic.light();
    setPending(false);
    setOpen(false);
    onRedeemed(res.data.newBalance);
    toast.success(`${rewardValue} reward redeemed — enjoy! 🌮`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem your reward</DialogTitle>
          <DialogDescription>
            Redeem {formatPoints(threshold)} points for {rewardValue} off your next order?
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-error/10 px-4 py-3 text-footnote text-error-text"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm} disabled={pending || !eligible}>
            {pending ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Gift className="size-5" aria-hidden="true" />
            )}
            {pending ? "Redeeming…" : `Redeem ${rewardValue} Off`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
