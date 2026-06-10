import QRCode from "qrcode";

/**
 * Pure QR → SVG renderer (DESIGN_SYSTEM.md §5.5).
 *
 * `qrcode`'s `create()` gives a synchronous module matrix; we turn it into an
 * SVG path so the QR renders crisply at any size with NO canvas, NO async, and
 * NO client round-trip. Colors are fixed black-on-white because the QR tile must
 * stay scannable in BOTH light and dark mode (§10 "QR tile stays white").
 *
 * Encodes the opaque payload string verbatim — the caller passes the rotatable
 * `qr_token` only (no PII). Error correction is High (~30%) so the code survives
 * glare/partial occlusion at arm's length (Phase 5 acceptance).
 */

export type QrSvg = {
  /** SVG `viewBox`/coordinate space side length (module count incl. quiet zone). */
  size: number;
  /** A single `<path d="…">` string drawing every dark module as a 1×1 square. */
  path: string;
};

/** Quiet zone in modules. The spec recommends ≥4; we use 4 (rendered white). */
const QUIET_ZONE = 4;

/**
 * Build the SVG geometry for a payload. The returned `path` draws dark modules
 * in a coordinate space of `size × size` where `size` already includes the
 * 4-module quiet zone on every edge. Render it on a white rect of the same
 * viewBox to get the mandated white quiet-zone padding.
 */
export function buildQrSvg(payload: string): QrSvg {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "H" });
  const count = qr.modules.size;
  const size = count + QUIET_ZONE * 2;

  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(col, row)) {
        const x = col + QUIET_ZONE;
        const y = row + QUIET_ZONE;
        // `h1v1h-1z` draws a 1×1 square at (x,y); concatenating moves is the
        // standard compact-path technique (one element, tiny DOM).
        path += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  return { size, path };
}
