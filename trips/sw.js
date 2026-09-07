const CACHE = "trips-v1";
const PRECACHE = ["/trips/", "/trips/mexico-city/", "/trips/yucatan/", "/trips/manifest.webmanifest", "/trips/icon-192.png", "/trips/icon-512.png"];
const TILE_HOST = "tile.openstreetmap.org";
const MAX_TILES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Map tiles: cache-first, capped. They are immutable and offline maps matter.
  if (url.hostname === TILE_HOST) {
    event.respondWith(
      caches.open(CACHE + "-tiles").then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const resp = await fetch(event.request);
        if (resp.ok) {
          cache.put(event.request, resp.clone());
          cache.keys().then((keys) => {
            if (keys.length > MAX_TILES) cache.delete(keys[0]);
          });
        }
        return resp;
      })
    );
    return;
  }

  // Trip pages + PWA assets: network-first with cache fallback for offline.
  if (url.origin === location.origin && url.pathname.startsWith("/trips/")) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(async () => {
          const hit = await caches.match(event.request, { ignoreSearch: true });
          if (hit) return hit;
          if (event.request.mode === "navigate") return caches.match("/trips/");
          return Response.error();
        })
    );
  }
});
