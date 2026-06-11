/**
 * Security headers + Content-Security-Policy (PLAN.md §Phase 10 criterion 4;
 * BLUEPRINT.md §10.4).
 *
 * Split into two layers:
 *   1. STATIC headers (HSTS, nosniff, frame, referrer, permissions) — identical
 *      on every response, applied in `next.config.ts` `headers()`.
 *   2. The CSP — needs a PER-REQUEST nonce so inline `<script>`s (Next.js injects
 *      a few for hydration/bootstrapping) are allowed WITHOUT `unsafe-inline`.
 *      The nonce is generated in middleware and the CSP is built here. Next.js
 *      auto-applies a CSP nonce to its own inline scripts when it sees a
 *      `script-src 'nonce-…'` directive on the request (via the
 *      `Content-Security-Policy` request header it reads).
 *
 * ── CSP directive rationale (one line each) ──────────────────────────────────
 *   default-src 'self'            — deny-by-default; everything falls back to same-origin.
 *   base-uri 'self'               — block <base> tag injection that could rewrite relative URLs.
 *   object-src 'none'             — no <object>/<embed>/<applet> (legacy plugin XSS vectors).
 *   form-action 'self'            — forms may only POST back to our own origin.
 *   frame-ancestors 'none'        — clickjacking protection (modern equivalent of X-Frame-Options: DENY).
 *   script-src 'self' 'nonce-…' 'strict-dynamic' — only same-origin + nonce'd inline scripts;
 *                                   'strict-dynamic' lets a nonce'd script load its chunks (Next.js
 *                                   code-splitting) without listing every chunk URL. NO 'unsafe-inline'
 *                                   for scripts (the spec's hard rule). https:/http: fallbacks are
 *                                   IGNORED by CSP3 browsers when 'strict-dynamic' is present (kept for
 *                                   pre-CSP3 safety; they never widen a CSP3 browser).
 *   style-src 'self' 'unsafe-inline' — Tailwind/shadcn + Framer Motion set inline styles and style
 *                                   attributes; nonces don't cover style ATTRIBUTES, so 'unsafe-inline'
 *                                   for STYLES is the documented, accepted exception (style injection is
 *                                   far lower-risk than script injection). DOCUMENTED in PHASE_10.
 *   img-src 'self' data: blob: https://*.supabase.co — app images, next/image blur (data:),
 *                                   object-URL downloads (blob:), Supabase Storage menu photos.
 *   font-src 'self' data:         — system font stack is local; data: covers any inlined font.
 *   connect-src 'self' https://*.supabase.co wss://*.supabase.co — REST/Auth (https) + Realtime
 *                                   websocket (wss) to Supabase; same-origin for Server Actions.
 *   frame-src https://www.google.com — the keyless Google Maps Embed iframe on /about ONLY.
 *   worker-src 'self' blob:       — future service worker / zxing worker (Phase 11 PWA).
 *   manifest-src 'self'           — PWA manifest (Phase 11).
 *   upgrade-insecure-requests     — force any stray http subresource to https.
 *
 * The QR SCANNER (@zxing/browser) uses getUserMedia (gated by Permissions-Policy
 * camera=(self), see below) and a same-origin worker — no extra CSP origin
 * needed. The QR DISPLAY renders an inline SVG (no external origin).
 */

const SUPABASE_HOST = "https://*.supabase.co";
const SUPABASE_WS = "wss://*.supabase.co";

/**
 * Build the Content-Security-Policy header value for a request, embedding the
 * per-request `nonce`. Kept as a single source so middleware and any route that
 * needs it stay identical.
 */
export function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Ignored by CSP3 browsers when strict-dynamic is present; harmless fallback.
      "https:",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", SUPABASE_HOST],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", SUPABASE_HOST, SUPABASE_WS],
    "frame-src": ["https://www.google.com"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");

  // Valueless directive appended last.
  return `${policy}; upgrade-insecure-requests`;
}

/**
 * Static (non-nonce) security headers applied to EVERY response via
 * `next.config.ts`. These never change per request, so they live in the config
 * for efficiency; only the CSP (nonce-bearing) is set in middleware.
 *
 * Permissions-Policy: deny every powerful feature by default; `camera=(self)`
 * allows the admin QR scanner's getUserMedia on our own origin only. (Per-route
 * camera scoping beyond same-origin isn't expressible in a static header; the
 * scanner lives only on the admin `/scan` route and the feature is same-origin
 * gated — documented.)
 */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "accelerometer=()",
      "gyroscope=()",
      "interest-cohort=()",
    ].join(", "),
  },
];
