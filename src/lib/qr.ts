/**
 * QR-token utilities (BLUEPRINT.md §1 "Opaque QR tokens", §4.2).
 *
 * The customer's `qr_token` is a rotatable UUID — it is the ONLY thing encoded
 * in their QR code. It is never the user id and carries no PII. The server
 * resolves token → user under admin authority (Phase 5).
 *
 * Phase 3 ships these token helpers + the opaque payload so the profile page can
 * surface and rotate the token. The QR *image* (`QRDisplay`) and the admin
 * scanner are Phase 5.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` is a well-formed UUID (the shape of a `qr_token`). */
export function isQrToken(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * The exact string encoded into the QR image (Phase 5). Opaque token only — no
 * scheme, no PII — so a decoded QR reveals nothing but a rotatable UUID. Kept as
 * a single function so the payload format has one definition across generate
 * (Phase 5 customer) and resolve (Phase 5 admin) paths.
 */
export function qrPayloadForToken(token: string): string {
  return token;
}

/**
 * Privacy-safe display of a token, e.g. `••••••••-••••-••••-••••-••••abcd1234`.
 * Used in the profile UI so the full secret is not shoulder-surfed in plaintext
 * while still letting a user confirm a rotation changed it.
 */
export function maskQrToken(token: string): string {
  if (!isQrToken(token)) return "••••";
  const tail = token.slice(-4);
  return `${"•".repeat(8)}…${tail}`;
}
