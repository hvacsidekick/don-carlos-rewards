/*
 * Don Carlos Rewards — service worker (PLAN.md §Phase 11 criteria 1,2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SCOPE IS DELIBERATELY NARROW. The #1 risk (PLAN "Watch" + Phase-10 CSP nonce)
 * is a SW that serves a STALE HTML document or a CACHED AUTHED RESPONSE. Both are
 * structurally impossible here:
 *
 *   1. NAVIGATIONS (mode === "navigate", i.e. HTML documents) are NETWORK-ONLY.
 *      They are never read from or written to any cache. So:
 *        • the page the browser renders always carries a FRESH per-request CSP
 *          nonce that matches its inline bootstrap scripts (no nonce mismatch); and
 *        • auth state is always live (no stale signed-in/out shell).
 *      Only when the network FAILS do we serve the precached static /offline
 *      shell — which contains NO inline nonce'd script and NO auth/data — so it
 *      can never collide with the CSP or leak stale state.
 *
 *   2. SUPABASE and ALL cross-origin requests are IGNORED entirely (we never call
 *      respondWith for them) — REST, Auth, and Realtime (wss) bypass the SW and
 *      hit the network directly. No authed API response is ever cached.
 *
 *   3. We cache ONLY same-origin, hashed/immutable STATIC ASSETS:
 *        • /_next/static/*  (content-hashed JS/CSS chunks — safe to cache forever)
 *        • /icons/*, manifest, fonts, and same-origin images (cache-first w/ cap)
 *      These never carry auth and never change without a new hashed URL.
 *
 * Strategy summary:
 *   navigate          → network-only, /offline fallback on failure
 *   /_next/static/*   → cache-first (immutable)
 *   same-origin image → cache-first, capped LRU-ish trim
 *   manifest/icons    → cache-first
 *   everything else   → network passthrough (no respondWith)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VERSION = "v1";
const PRECACHE = `dc-precache-${VERSION}`;
const STATIC_CACHE = `dc-static-${VERSION}`;
const IMAGE_CACHE = `dc-images-${VERSION}`;

// Precached at install — the offline shell + the icons it shows. Keep tiny.
const PRECACHE_URLS = ["/offline", "/icons/icon-192.png"];

const IMAGE_CACHE_MAX = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Activate the new SW immediately on next load (paired with clients.claim).
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([PRECACHE, STATIC_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page tell a waiting SW to take over now (update handling).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isIcon(url) {
  return url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest";
}

function isImage(request, url) {
  return (
    request.destination === "image" ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname)
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Only cache successful, basic (same-origin) responses.
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone());
    void trimCache(IMAGE_CACHE, IMAGE_CACHE_MAX);
  }
  return response;
}

// Best-effort FIFO trim so the image cache doesn't grow unbounded.
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever touch GET. Mutations (POST server actions, auth) bypass the SW.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (incl. ALL Supabase REST/Auth/Realtime): never intercept.
  if (url.origin !== self.location.origin) return;

  // NAVIGATIONS (HTML documents): network-ONLY so the CSP nonce is always fresh
  // and auth state is always live. Offline → static /offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(PRECACHE);
        const offline = await cache.match("/offline");
        return offline ?? Response.error();
      }),
    );
    return;
  }

  // Immutable hashed build assets → cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // PWA icons + manifest → cache-first.
  if (isIcon(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Same-origin images (e.g. next/image-optimized local assets) → cache-first.
  if (isImage(request, url)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // Everything else (same-origin data routes, RSC payloads, etc.): passthrough.
  // We do NOT respondWith → the browser does its normal network fetch, so no
  // dynamic/authed response is ever served from cache.
});
