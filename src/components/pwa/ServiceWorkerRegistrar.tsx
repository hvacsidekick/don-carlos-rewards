"use client";

import * as React from "react";

/**
 * Registers the service worker (PLAN.md §Phase 11 criterion 1,2).
 *
 * Runs from a CLIENT component in an effect — there is NO inline script, so this
 * never interacts with the Phase-10 per-request CSP nonce. `worker-src 'self'
 * blob:` already permits `/sw.js`.
 *
 * Guarded:
 *   • only in the browser, only when `serviceWorker` is supported;
 *   • only in production (a dev SW would fight Next.js HMR and cache dev chunks).
 *
 * Update handling: when a new SW is found and finishes installing while an old
 * one controls the page, we tell it to `SKIP_WAITING` so the next navigation
 * picks up fresh assets (navigations are network-only, so this never serves a
 * stale nonce'd document — the update just refreshes the cached static assets).
 *
 * Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // A new worker is installed and an old one already controls the page
            // → ask it to activate so future loads get fresh static assets.
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              installing.postMessage("SKIP_WAITING");
            }
          });
        });
      } catch {
        // Registration failure is non-fatal: the app works without the SW
        // (no offline shell / asset precache). Swallow so it never breaks boot.
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn("[pwa] service worker registration failed");
        }
      }
    };

    // Defer to load so SW registration never competes with first paint.
    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
