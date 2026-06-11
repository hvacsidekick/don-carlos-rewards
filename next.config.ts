import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Security headers (CSP/HSTS/etc.) are configured in Phase 10 — Security Hardening.
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
