import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PLAN.md §Phase 11 criterion 1; served at /manifest.webmanifest).
 *
 * Next.js App Router emits this file with the correct
 * `Content-Type: application/manifest+json`. The Phase-10 middleware matcher
 * already excludes `manifest.webmanifest`, and the CSP allows `manifest-src 'self'`.
 *
 * - `display: "standalone"` → installs without browser chrome (launches like a
 *   native app).
 * - `start_url: "/dashboard"` → the signed-in home. (Launching while signed out
 *   redirects to /login via middleware — correct behavior.)
 * - `id` pins the app identity so updates don't fork the installed instance.
 * - Icons: 192 + 512 "any", plus dedicated maskable variants (full-bleed, safe
 *   zone respected) so Android adaptive-icon masks don't clip the mark.
 * - `theme_color` is the brand red (#E63946) — it tints the Android status bar /
 *   task-switcher card. (The per-request `<meta name="theme-color">` in the
 *   document stays white/black per color scheme for the browser UI; the manifest
 *   value is the installed-app identity color.)
 * - `background_color` (#FFFFFF) is the splash background on cold launch.
 *
 * Icon art is the placeholder brand mark (open question O-2); swapping in real
 * art = regenerate via scripts/generate-pwa-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Don Carlos Rewards",
    short_name: "Don Carlos",
    description:
      "Earn points and unlock rewards at Don Carlos Taco Shop, Arvada CO.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#E63946",
    background_color: "#FFFFFF",
    categories: ["food", "lifestyle", "shopping"],
    lang: "en-US",
    dir: "ltr",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
