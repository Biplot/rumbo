/* Rumbo · Service Worker
   Cachea el "app shell" (mismo origen) con estrategia stale-while-revalidate.
   No toca peticiones a Supabase ni a otros dominios (siempre van a la red). */
const CACHE = "rumbo-cache-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // no cachear POST (escrituras a la nube)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // solo mismo origen (no Supabase/CDNs)

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
