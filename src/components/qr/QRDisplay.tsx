"use client";

import * as React from "react";

import { buildQrSvg } from "@/lib/qr-svg";
import { qrPayloadForToken } from "@/lib/qr";
import { cn } from "@/lib/utils";

/**
 * QRDisplay (DESIGN_SYSTEM.md §5.5) — renders a customer's rewards code as a QR.
 *
 * The QR encodes the OPAQUE `qr_token` only (via `qrPayloadForToken`) — no email,
 * no user id, no PII (Phase 5 acceptance: "QR payload contains only the opaque
 * token — verify by decoding"). Error correction is High (~30%).
 *
 * The tile is ALWAYS white background / black foreground, even in dark mode, for
 * scannability (§10) — it never reads design tokens. ≥200×200px with a 4-module
 * white quiet zone baked into the SVG viewBox. `shape-rendering="crispEdges"`
 * keeps module edges sharp at any size. Re-renders when `token` changes (e.g.
 * after a rotation) because the SVG geometry is memoised on the token.
 */
export function QRDisplay({
  token,
  size = 232,
  className,
}: {
  token: string;
  size?: number;
  className?: string;
}) {
  const { viewBox, path } = React.useMemo(() => {
    const svg = buildQrSvg(qrPayloadForToken(token));
    return { viewBox: `0 0 ${svg.size} ${svg.size}`, path: svg.path };
  }, [token]);

  return (
    <div
      className={cn(
        // Always white plate, even in dark mode — scannability over theming.
        "rounded-2xl bg-white p-4 shadow-card dark:shadow-card-dark",
        className,
      )}
    >
      <svg
        viewBox={viewBox}
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Your rewards QR code. Show this to staff at checkout."
        className="h-auto w-full"
        style={{ maxWidth: size }}
      >
        {/* White quiet-zone background fills the full viewBox (incl. padding). */}
        <rect width="100%" height="100%" fill="#ffffff" />
        <path d={path} fill="#000000" />
      </svg>
    </div>
  );
}
