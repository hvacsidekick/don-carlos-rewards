"use client";

import * as React from "react";
import { CameraOff, Keyboard, Zap, ZapOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * QRScanner (DESIGN_SYSTEM.md §5.6) — admin-only camera scanner.
 *
 * The `@zxing/browser` decoder is DYNAMICALLY imported the first time the camera
 * starts (perf budget §11 — the scanner lib must not load on non-admin routes,
 * and only when actually scanning). `SUPABASE_SERVICE_ROLE_KEY` is never touched
 * here — this is a pure camera/decode island; the trust boundary lives in the
 * server action this calls back into.
 *
 * Errors never dead-end (Phase 5 acceptance): a permission-denied / no-camera
 * state shows clear copy AND the keyboard-operable "Enter code manually"
 * fallback. On a successful decode we freeze, fire a success haptic, and hand the
 * raw text up via `onDetected` exactly once (re-arm only after `resetSignal`
 * changes) so a held QR can't fire repeatedly.
 *
 * getUserMedia requires HTTPS (works on localhost + Vercel). Real-phone camera
 * scanning is verified on-device in Phase 11/12 — here we wire the pipeline and
 * the manual fallback.
 */

type CameraState = "idle" | "starting" | "scanning" | "denied" | "unsupported";

export function QRScanner({
  onDetected,
  onManualEntry,
  onCancel,
  /** Change this value to re-arm the scanner after the parent handled a detect. */
  resetSignal = 0,
}: {
  onDetected: (text: string) => void;
  onManualEntry: () => void;
  onCancel: () => void;
  resetSignal?: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<{ stop: () => void } | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  // Guards against firing `onDetected` more than once per arm.
  const handledRef = React.useRef(false);

  const [state, setState] = React.useState<CameraState>("idle");
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchSupported, setTorchSupported] = React.useState(false);

  const stopCamera = React.useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start (or restart) the camera + decoder. Re-runs when `resetSignal` changes.
  React.useEffect(() => {
    let cancelled = false;
    handledRef.current = false;
    setState("starting");
    setTorchOn(false);
    setTorchSupported(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    (async () => {
      try {
        // Lazy-load the (heavy) decoder only now, on the admin scan route.
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled) return;

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current as HTMLVideoElement,
          (result) => {
            if (cancelled || handledRef.current || !result) return;
            handledRef.current = true;
            haptic.success();
            // Freeze the frame: pause video + stop scanning until re-armed.
            videoRef.current?.pause();
            onDetected(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;

        // Detect torch capability on the active track (Chromium/Android only).
        const stream = videoRef.current?.srcObject;
        if (stream instanceof MediaStream) {
          streamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          const caps =
            (track?.getCapabilities?.() as { torch?: boolean } | undefined) ?? undefined;
          if (caps?.torch) setTorchSupported(true);
        }

        setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        // NotAllowedError / SecurityError = permission denied; others = no camera.
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [resetSignal, onDetected, stopCamera]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Torch not actually applicable — hide the control to avoid a dead toggle.
      setTorchSupported(false);
    }
  }

  function handleCancel() {
    stopCamera();
    onCancel();
  }

  const isError = state === "denied" || state === "unsupported";

  return (
    <div className="flex flex-col gap-4">
      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-separator bg-surface-tertiary px-6 py-10 text-center">
          <span
            className="grid size-12 place-items-center rounded-full bg-error/10 text-error-text"
            aria-hidden="true"
          >
            <CameraOff className="size-6" />
          </span>
          <p className="text-headline text-foreground">
            {state === "denied" ? "Camera access blocked" : "Camera unavailable"}
          </p>
          <p className="max-w-[320px] text-footnote text-fg-secondary">
            {state === "denied"
              ? "Allow camera access in your browser settings to scan, or enter the customer's code by hand."
              : "We couldn't reach a camera on this device. You can still enter the customer's code by hand."}
          </p>
          <Button type="button" variant="secondary" onClick={onManualEntry} className="mt-2">
            <Keyboard className="size-5" aria-hidden="true" />
            Enter code manually
          </Button>
        </div>
      ) : (
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="size-full object-cover"
            playsInline
            muted
            aria-label="Camera viewfinder for scanning a customer's rewards QR code"
          />

          {/* Dimmed surround + centred reticle (decorative overlay). */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-black/40" />
            <div
              className={cn(
                "absolute left-1/2 top-1/2 size-2/3 -translate-x-1/2 -translate-y-1/2",
                "rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]",
              )}
            />
          </div>

          {state !== "scanning" ? (
            <div className="absolute inset-0 grid place-items-center">
              <p className="rounded-full bg-black/60 px-4 py-2 text-footnote text-white">
                Starting camera…
              </p>
            </div>
          ) : null}
        </div>
      )}

      {!isError ? (
        <div className="flex items-center justify-center gap-2">
          {torchSupported ? (
            <Button type="button" variant="secondary" onClick={toggleTorch} aria-pressed={torchOn}>
              {torchOn ? (
                <ZapOff className="size-5" aria-hidden="true" />
              ) : (
                <Zap className="size-5" aria-hidden="true" />
              )}
              {torchOn ? "Torch off" : "Torch on"}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onManualEntry}>
            <Keyboard className="size-5" aria-hidden="true" />
            Enter manually
          </Button>
        </div>
      ) : null}

      <Button type="button" variant="tertiary" onClick={handleCancel}>
        <X className="size-5" aria-hidden="true" />
        Cancel
      </Button>
    </div>
  );
}
