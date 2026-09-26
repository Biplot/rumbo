/* Rumbo · Service Worker
   Cachea el "app shell" (mismo origen) con estrategia stale-while-revalidate.
   No toca peticiones a Supabase ni a otros dominios (siempre van a la red). */
const CACHE = "rumbo-cache-v17";

self.addEventListener("install", () => self.skipWaiting());
/* Al activar una versión nueva se borran las cachés anteriores */
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("rumbo-cache")).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

/* Web Push: mostrar el aviso que manda el servidor (Parte B) */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Rumbo", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Rumbo";
  const opts = {
    body: d.body || "",
    icon: d.icon || "assets/icon-192.png",
    badge: "assets/icon-192.png",
    tag: d.tag || "rumbo",
    data: { url: d.url || "./" },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* Al tocar la notificación: enfocar la app (o abrirla) en la ruta indicada */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { try { c.navigate(url); } catch (_) {} return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

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
