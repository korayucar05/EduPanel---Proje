const CACHE_NAME = "enstitu-shell-v500";
const SHELL = [
  "/enstitu.webmanifest?v=500",
  "/enstitu-pwa-transparent-v500-192.png",
  "/enstitu-pwa-transparent-v500-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, {cache:"no-store"}).catch(() => caches.match(request).then(c => c || caches.match("/"))));
    return;
  }
  if (url.pathname.includes("enstitu-pwa") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(fetch(request, {cache:"reload"}).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => caches.match(request)));
  }
});
