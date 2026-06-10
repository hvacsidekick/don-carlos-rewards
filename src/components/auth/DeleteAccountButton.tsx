"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { deleteAccountAction } from "@/actions/account";

/**
 * Delete-account flow (PLAN.md §Phase 3 — stub; full GDPR purge in Phase 10).
 * Destructive confirm dialog with a type-to-confirm guard so it can't be
 * triggered accidentally. On success the action signs out and redirects to `/`.
 */
export function DeleteAccountButton() {
  const [pending, setPending] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  async function onDelete() {
    if (!canDelete) return;
    setPending(true);
    const res = await deleteAccountAction();
    // Success redirects; only failures return here.
    if (res && !res.ok) {
      setPending(false);
      toast.error(res.error);
    }
  }

  return (
    <Dialog onOpenChange={() => setConfirmText("")}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="lg" className="w-full">
          <Trash2 className="size-5" aria-hidden="true" />
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently removes your profile, points, and history. This can&apos;t be
            undone. Type <span className="font-semibold text-foreground">DELETE</span> to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-delete">Confirm</Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            aria-label="Type DELETE to confirm account deletion"
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={onDelete} disabled={!canDelete || pending}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
