import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Security headers (CSP/HSTS/etc.) are configured in Phase 10 — Security Hardening.
  // Image optimization domains (Supabase storage) are added in Phase 7 (Menu).
};

export default nextConfig;
