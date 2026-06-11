import type { NextConfig } from "next";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static security headers (HSTS, nosniff, frame, referrer, permissions) on
  // EVERY response (Phase 10 criterion 4). The per-request CSP nonce is set in
  // middleware (`src/middleware.ts`) since it must vary per request — see
  // `src/lib/security-headers.ts` for the full directive rationale.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
    ];
  },
  images: {
    // Phase 7 (Menu): allow `next/image` optimization of menu photos served from
    // Supabase Storage. `image_url` is nullable in the seed (no real photography
    // yet — open question O-3); when present it points at the public bucket.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
