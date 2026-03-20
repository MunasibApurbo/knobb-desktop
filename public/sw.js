const CACHE_NAME = "knobb-shell-v8";
const APP_SHELL_ASSETS = [
  "/",
  "/index.html",
  "/site.webmanifest",
  "/placeholder.svg",
  "/brand/logo-k-black-square-512.png",
  "/brand/logo-k-black-square-256.png",
];

function isShellNavigationPath(pathname) {
  return !pathname.startsWith("/track/") && !pathname.startsWith("/embed/track/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Handle navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok && isShellNavigationPath(url.pathname)) {
            void caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match("/index.html")) || caches.match("/");
        }),
    );
    return;
  }

  // Assets to cache: scripts, styles, images, fonts
  const shouldCacheAsset = ["script", "style", "image", "font"].includes(request.destination);
  if (!shouldCacheAsset) return;

  // Stale-while-revalidate for assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      });
      return cached || fetchPromise;
    }),
  );
});
