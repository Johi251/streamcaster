/**
 * StreamCaster receiver service worker — offline app shell.
 *
 * The receiver is served under /r/ (Vite base), so every shell path is
 * relative to that base.
 *
 * Strategy:
 *  - Navigations: network-first, fall back to the cached shell. Keeps the PWA
 *    usable offline and always loads fresh HTML when online (so a redeploy
 *    propagates immediately).
 *  - Same-origin GET assets (JS/CSS/icons): stale-while-revalidate — instant
 *    loads from cache, refreshed in the background.
 *  - Cross-origin requests (signaling WebSocket upgrade, proxy Worker, media):
 *    never cached, passed straight through. WebSockets are not intercepted by
 *    the fetch handler at all.
 */
const VERSION = "streamcaster-receiver-shell-v1";
const BASE = "/r/";
const SHELL = [
  BASE,
  BASE + "index.html",
  BASE + "style.css",
  BASE + "manifest.webmanifest",
  BASE + "icon-192.png",
  BASE + "icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        // addAll() rejects as a whole if a single URL 404s — that would kill
        // the install. Cache what exists, ignore the rest.
        Promise.allSettled(SHELL.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never touch cross-origin traffic (signaling + proxy Worker + media CDNs).
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(BASE + "index.html", copy));
          return res;
        })
        .catch(() =>
          caches.match(BASE + "index.html").then((r) => r || caches.match(BASE))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
