"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportMyDataAction } from "@/actions/account";

/**
 * Data export ("Download my data") — PLAN.md §Phase 10 criterion 6 (GDPR).
 *
 * Calls the server action (identity re-derived server-side), then triggers a
 * client-side download of the returned JSON. No PII is embedded in the page;
 * the data is fetched on demand for the signed-in user only.
 */
export function ExportDataButton() {
  const [pending, setPending] = React.useState(false);

  async function onExport() {
    setPending(true);
    const res = await exportMyDataAction();
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `don-carlos-rewards-data-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch {
      toast.error("We couldn't start the download. Please try again.");
    }
  }

  return (
    <Button variant="secondary" size="lg" className="w-full" onClick={onExport} disabled={pending}>
      {pending ? (
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-5" aria-hidden="true" />
      )}
      {pending ? "Preparing…" : "Download my data"}
    </Button>
  );
}
