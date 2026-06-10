"use client";

import * as React from "react";
import { Loader2, RefreshCw, QrCode } from "lucide-react";
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
import { maskQrToken } from "@/lib/qr";
import { rotateQrTokenAction } from "@/actions/auth";

/**
 * Profile QR-token panel (DESIGN_SYSTEM.md §5.5 references; full QR image is
 * Phase 5). Shows the opaque, rotatable token (masked) and lets the user rotate
 * it if compromised. The token is never the user id and carries no PII
 * (BLUEPRINT.md §1).
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
    <div className="flex flex-col gap-4 rounded-2xl border border-separator bg-surface-tertiary p-6 shadow-card dark:shadow-card-dark">
      <div className="flex items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-dc-red/10 text-dc-red"
          aria-hidden="true"
        >
          <QrCode className="size-5" />
        </span>
        <div className="flex flex-col">
          <h3 className="text-body-emph text-foreground">Your rewards code</h3>
          <p className="text-footnote text-fg-secondary">
            Staff scan this to add points. A scannable QR arrives soon.
          </p>
        </div>
      </div>

      <p className="rounded-xl bg-surface-secondary px-4 py-3 font-mono text-footnote tabular-nums text-fg-secondary">
        <span className="sr-only">Rewards code, partially hidden for privacy: </span>
        {maskQrToken(token)}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="tertiary" className="self-start">
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
