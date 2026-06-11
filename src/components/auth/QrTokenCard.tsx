"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
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
import { QRDisplay } from "@/components/qr/QRDisplay";
import { maskQrToken } from "@/lib/qr";
import { rotateQrTokenAction } from "@/actions/auth";

/**
 * Rewards-code card (DESIGN_SYSTEM.md §5.5). Renders the customer's scannable QR
 * (white tile, always — §10) over the opaque, rotatable `qr_token`, plus the
 * masked token text and a tertiary "Rotate code" control. The QR encodes only
 * the token — no PII (BLUEPRINT.md §1).
 *
 * When the user rotates, the new token flows straight into `QRDisplay`, so the
 * rendered QR updates in place (the old code stops working immediately).
 */
export function QrTokenCard({ initialToken }: { initialToken: string }) {
  const [token, setToken] = React.useState(initialToken);
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function rotate() {
    setPending(true);
    const res = await rotateQrTokenAction();
    setPending(false);
    if (res.ok) {
      setToken(res.data);
      setOpen(false);
      toast.success("Your rewards code was rotated.");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-separator bg-surface-tertiary p-6 shadow-card dark:shadow-card-dark">
      <QRDisplay token={token} />

      <p className="text-center text-footnote text-fg-secondary">
        Show this to staff at checkout to earn points.
      </p>

      <p className="rounded-xl bg-surface-secondary px-4 py-2 font-mono text-caption tabular-nums text-fg-secondary">
        <span className="sr-only">Rewards code, partially hidden for privacy: </span>
        {maskQrToken(token)}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="tertiary">
            <RefreshCw className="size-5" aria-hidden="true" />
            Rotate code
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate your rewards code?</DialogTitle>
            <DialogDescription>
              Your current code stops working immediately. Use this if someone may have copied
              it. You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={rotate} disabled={pending}>
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
              {pending ? "Rotating…" : "Rotate code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
