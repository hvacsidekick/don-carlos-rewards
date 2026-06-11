"use client";

import * as React from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Add to Home Screen" UX (PLAN.md §Phase 11 — install prompt).
 *
 * Two paths, one tasteful, dismissible, a11y-friendly card:
 *   • Android/Chrome: capture the `beforeinstallprompt` event, suppress the
 *     browser's default mini-infobar, and show our own "Install" button that
 *     calls `prompt()` on demand.
 *   • iOS Safari: no `beforeinstallprompt` exists, so when we detect iOS Safari
 *     that is NOT already running standalone, we show a short "Share → Add to
 *     Home Screen" hint instead.
 *
 * Non-nagging: once dismissed (or installed), we persist a flag in localStorage
 * and never show it again. Hidden entirely when already running standalone.
 *
 * a11y: the card is a labelled `role="dialog"` region (non-modal — it does not
 * trap focus or block the page); the dismiss button has an accessible name; the
 * card is reachable in normal tab order. No motion that violates reduced-motion
 * (a simple opacity/transform reveal handled by Tailwind, GPU-only).
 */

const DISMISS_KEY = "dc-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes navigator.standalone (non-standard).
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  // Exclude in-app browsers (FB/IG/Chrome-iOS) where Add-to-Home-Screen differs.
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

type Variant = "android" | "ios";

export function InstallPrompt() {
  const [variant, setVariant] = React.useState<Variant | null>(null);
  const deferredRef = React.useRef<BeforeInstallPromptEvent | null>(null);

  const dismiss = React.useCallback(() => {
    setVariant(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode / storage disabled — harmless; just won't persist.
    }
  }, []);

  React.useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    // Android / Chromium: capture the install prompt.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // suppress the browser mini-infobar
      deferredRef.current = e as BeforeInstallPromptEvent;
      setVariant("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // If the app gets installed, stop offering and remember it.
    const onInstalled = () => dismiss();
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari has no event — show the hint directly.
    if (isIosSafari()) setVariant("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [dismiss]);

  const install = React.useCallback(async () => {
    const evt = deferredRef.current;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    deferredRef.current = null;
    // Either way, don't keep nagging this session.
    dismiss();
  }, [dismiss]);

  if (!variant) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-prompt-title"
      className={cn(
        "pb-safe fixed inset-x-0 bottom-20 z-30 mx-auto max-w-[480px] px-4",
      )}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-separator bg-surface-tertiary p-4 shadow-card-hero dark:shadow-card-hero-dark">
        <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-dc-yellow/20 text-dc-red">
          <Download className="size-5" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id="install-prompt-title" className="text-body-emph font-semibold text-foreground">
            Install Don Carlos Rewards
          </p>
          {variant === "ios" ? (
            <p className="text-footnote text-fg-secondary">
              Tap{" "}
              <Share className="inline size-4 -translate-y-0.5 text-fg-secondary" aria-label="the Share button" />{" "}
              then <span className="font-medium text-foreground">Add to Home Screen</span> to keep
              your card one tap away.
            </p>
          ) : (
            <p className="text-footnote text-fg-secondary">
              Add it to your home screen for one-tap access to your rewards.
            </p>
          )}

          {variant === "android" ? (
            <div className="mt-2">
              <Button type="button" size="sm" onClick={install}>
                Install
              </Button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="grid size-9 shrink-0 place-items-center rounded-full text-fg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
