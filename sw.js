/* Rumbo · Service Worker
   Cachea el "app shell" (mismo origen) con estrategia stale-while-revalidate.
   No toca peticiones a Supabase ni a otros dominios (siempre van a la red). */
const CACHE = "rumbo-cache-v100";

self.addEventListener("install", () => self.skipWaiting());
/* Al activar una versión nueva se borran las cachés anteriores */
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("rumbo-cache")).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

/* La cara de tu elefante en el aviso (Android y computador; en iPhone, Apple muestra solo el ícono de la app).
   La app guarda tu tipo de elefante en la caché «rumbo-ajustes» (js/notifs.js), que no se borra al actualizar. */
const ELE_TIPOS = ["clasico", "asiatico", "mamut", "peluche", "geometrico", "tinta"];
async function iconoElefante() {
  try {
    const r = await (await caches.open("rumbo-ajustes")).match("/__ele-tipo");
    const t = r ? (await r.text()).trim() : "";
    return ELE_TIPOS.includes(t) ? `assets/ele-aviso/${t}.png` : null;
  } catch (_) { return null; }
}
/* Web Push: mostrar el aviso que manda el servidor (Parte B) */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Rumbo", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Rumbo";
  const opciones = {
    body: d.body || "",
    badge: "assets/badge-96.png",
    tag: d.tag || "rumbo",
    data: { url: d.url || "./" },
  };
  // el aviso del agua: «+ Un vaso» y «+ Tu botella» (Android y computador; iPhone no muestra botones)
  if (Array.isArray(d.actions) && d.agua && typeof d.agua === "object") {
    opciones.data.agua = d.agua;
    const max = (self.Notification && self.Notification.maxActions) || 0;   // solo donde el aviso muestra botones (Android y Chrome); en iPhone, sin ellos
    if (max > 0) opciones.actions = d.actions.slice(0, Math.min(2, max));
  }
  e.waitUntil(iconoElefante().then((ele) => self.registration.showNotification(title, Object.assign(opciones, { icon: d.icon || ele || "assets/icon-192.png" }))));
});

/* «+ Un vaso» sin abrir la app: se anota en este teléfono (la app lo suma al abrirse, o al tiro si está abierta)
   y en el servidor con la firma del aviso (por si la abres en otro equipo). Cada vaso lleva su id: nunca dos veces. */
const PEND = "/__agua-pend";
const dia = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const litros = (ml) => (Math.round(ml / 50) * 50 / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 });
async function vasoDelAviso(n, accion) {
  const a = (n.data && n.data.agua) || {}, ml = Math.round(accion === "botella" ? a.botella : a.vaso);
  if (!(ml >= 50 && ml <= 3000)) return;
  const ts = Date.now(), vaso = { id: "n" + ts.toString(36) + Math.random().toString(36).slice(2, 6), ml, ts, fecha: dia(ts) };
  let lista = [];
  try {
    const c = await caches.open("rumbo-ajustes"), r = await c.match(PEND);
    lista = r ? JSON.parse(await r.text()) || [] : [];
    lista.push(vaso);
    await c.put(PEND, new Response(JSON.stringify(lista.slice(-30)), { headers: { "Content-Type": "application/json" } }));
  } catch (_) {}
  const servidor = fetch("api/push/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ accion: "vaso", u: a.u, d: a.d, f: a.f }, vaso)) }).catch(() => {});
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  ventanas.forEach((w) => { try { w.postMessage({ tipo: "rumbo-agua-pend" }); } catch (_) {} });
  // el aviso se queda, al día y en silencio, por si quieres anotar otro
  const llevas = (+a.ml || 0) + lista.filter((x) => x.fecha === vaso.fecha).reduce((s, x) => s + x.ml, 0);
  await self.registration.showNotification(`💧 Anotado: +${ml >= 1000 ? litros(ml) + " L" : ml + " ml"}`, {
    body: a.meta ? `Vas en ${litros(llevas)} de ${litros(a.meta)} L. Yo me tomé otro contigo.` : "Yo me tomé otro contigo.",
    icon: n.icon || "assets/icon-192.png", badge: "assets/badge-96.png", tag: n.tag || "rumbo-elefante-agua", silent: true, renotify: false,
    actions: n.actions && n.actions.length ? Array.from(n.actions) : undefined, data: n.data,
  });
  await servidor;
}

/* Al tocar la notificación: enfocar la app (o abrirla) en la ruta indicada */
self.addEventListener("notificationclick", (e) => {
  if (e.action === "vaso" || e.action === "botella") { e.notification.close(); e.waitUntil(vasoDelAviso(e.notification, e.action)); return; }
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
  if (url.pathname.startsWith("/api/")) return;     // funciones del servidor (api/push.js): siempre a la red

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      // Abrir la app con ?atajo=… (atajos del ícono) o ?crear=1 sirve la misma página guardada
      cache.match(req, { ignoreSearch: req.mode === "navigate" }).then((cached) => {
        const network = fetch(req)
          .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
