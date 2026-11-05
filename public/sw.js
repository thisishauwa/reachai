// Minimal app-shell service worker. Domain data is never cached here --
// clinical data lives in IndexedDB via the outbox (see src/lib/offline),
// which is the source of truth for offline drafts and sync.
//
// Bump CACHE_NAME on any change here so `activate` below clears stale
// client caches. Navigations and Next.js build assets (/_next/*) are
// deliberately NOT intercepted: caching HTML/JS by URL would otherwise
// serve a page that references a previous deploy's hashed chunk files,
// which 404 once that deploy is replaced (seen as "This page couldn't
// load" for users with an already-registered service worker).
const CACHE_NAME = "echo-reach-shell-v2";
const SHELL_URLS = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept navigations, Next.js build/data requests, or Supabase
  // API/auth calls -- only the static app-shell assets below are cached.
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (!SHELL_URLS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
    }),
  );
});
