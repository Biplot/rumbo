/* Tests del aviso en el teléfono (sw.js): la cara de tu elefante como imagen del aviso, según el tipo que
   la app guardó en la caché «rumbo-ajustes»; sin tipo (o con uno raro), el ícono de Rumbo */
import fs from "node:fs";
import vm from "node:vm";
export default async function ({ test, assert }) {
  console.log("\nEl aviso en el teléfono (sw.js)");
  const codigo = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  async function avisar(tipo, datos) {
    const handlers = {}, mostradas = [], guardado = new Map(tipo == null ? [] : [["/__ele-tipo", tipo]]);
    const caches = { open: async () => ({ match: async k => guardado.has(k) ? { text: async () => guardado.get(k) } : undefined, put: async () => {} }), keys: async () => [], delete: async () => true };
    const self = { addEventListener: (n, f) => { handlers[n] = f; }, registration: { showNotification: async (t, o) => { mostradas.push({ t, o }); } }, location: { origin: "https://rumbo.biplot.cl" }, skipWaiting() {}, clients: { claim() {} } };
    vm.runInContext(codigo, vm.createContext({ self, caches, URL, fetch: async () => ({}), console }));
    let espera; handlers.push({ data: { json: () => datos, text: () => "" }, waitUntil: p => { espera = p; } });
    await espera;
    return mostradas[0];
  }
  const msg = { title: "Hola, soy tu elefante", body: "Así te voy a escribir…", tag: "rumbo-prueba", url: "./#notif" };
  const r = {
    clasico: await avisar("clasico", msg), mamut: await avisar("mamut", msg), sin: await avisar(null, msg),
    raro: await avisar("../../otra-cosa", msg), propio: await avisar("mamut", { ...msg, icon: "assets/otro.png" }),
  };
  test("el aviso lleva la cara de tu elefante (tu tipo), con el título y el texto del servidor", () => {
    assert.equal(r.clasico.t, "Hola, soy tu elefante");
    assert.equal(r.clasico.o.icon, "assets/ele-aviso/clasico.png");
    assert.equal(r.mamut.o.icon, "assets/ele-aviso/mamut.png");
    assert.equal(r.clasico.o.badge, "assets/badge-96.png");
    assert.equal(r.clasico.o.tag, "rumbo-prueba");
  });
  test("sin tipo guardado, o con uno que no es de Rumbo, va el ícono de la app; si el servidor manda una imagen, esa", () => {
    assert.equal(r.sin.o.icon, "assets/icon-192.png");
    assert.equal(r.raro.o.icon, "assets/icon-192.png");
    assert.equal(r.propio.o.icon, "assets/otro.png");
  });
  /* «+ Un vaso» sin abrir la app */
  async function tocarVaso(accion, conVentana) {
    const handlers = {}, mostradas = [], guardado = new Map(), pedidos = [], mensajes = [];
    const caches = { open: async () => ({ match: async k => guardado.has(k) ? { text: async () => guardado.get(k) } : undefined, put: async (k, r) => { guardado.set(k, await r.text()); } }), keys: async () => [], delete: async () => true };
    const ventanas = conVentana ? [{ postMessage: m => mensajes.push(m), focus() {}, navigate() {} }] : [];
    const self = { Notification: { maxActions: 2 }, addEventListener: (n, f) => { handlers[n] = f; }, registration: { showNotification: async (t, o) => { mostradas.push({ t, o }); } }, location: { origin: "https://rumbo.biplot.cl" }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => ventanas, openWindow: async () => {} } };
    class Response { constructor(b) { this.b = b; } async text() { return this.b; } }
    vm.runInContext(codigo, vm.createContext({ self, caches, URL, Response, fetch: async (u, o) => { pedidos.push({ u, b: JSON.parse(o.body) }); return {}; }, console }));
    const agua = { u: "uid-1", d: "2026-11-04", f: "firma", vaso: 300, botella: 750, ml: 500, meta: 2000 };
    let espera; handlers.push({ data: { json: () => ({ title: "💧 ¿Un vaso?", body: "Llevas 0,5 L", tag: "rumbo-elefante-agua", url: "./?atajo=agua#inicio", actions: [{ action: "vaso", title: "+ Un vaso (300 ml)" }, { action: "botella", title: "+ Tu botella (750 ml)" }], agua }), text: () => "" }, waitUntil: p => { espera = p; } });
    await espera;
    const aviso = mostradas[0];
    let cerrado = false, espera2;
    handlers.notificationclick({ action: accion, notification: { data: aviso.o.data, tag: aviso.o.tag, icon: aviso.o.icon, actions: aviso.o.actions, close() { cerrado = true; } }, waitUntil: p => { espera2 = p; } });
    await espera2;
    return { aviso, confirma: mostradas[1], cerrado, pend: JSON.parse(guardado.get("/__agua-pend") || "[]"), pedidos, mensajes };
  }
  const tv = await tocarVaso("vaso", true), tb = await tocarVaso("botella", false);
  test("el aviso del agua trae «+ Un vaso» y «+ Tu botella» (y lo que necesitan para anotarlo)", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(tv.aviso.o.actions.map(a => a.action))), ["vaso", "botella"]);
    assert.equal(tv.aviso.o.data.agua.vaso, 300); assert.equal(tv.aviso.o.data.url, "./?atajo=agua#inicio");
  });
  test("«+ Un vaso» lo anota en el teléfono y en el servidor (con la firma), sin abrir la app", () => {
    assert.ok(tv.cerrado);
    assert.equal(tv.pend.length, 1); assert.equal(tv.pend[0].ml, 300); assert.match(tv.pend[0].id, /^n[a-z0-9]{4,}$/); assert.match(tv.pend[0].fecha, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(tv.pedidos.length, 1); assert.equal(tv.pedidos[0].u, "api/push/");
    assert.deepEqual([tv.pedidos[0].b.accion, tv.pedidos[0].b.u, tv.pedidos[0].b.d, tv.pedidos[0].b.f, tv.pedidos[0].b.id, tv.pedidos[0].b.ml], ["vaso", "uid-1", "2026-11-04", "firma", tv.pend[0].id, 300]);
    assert.deepEqual(JSON.parse(JSON.stringify(tv.mensajes)), [{ tipo: "rumbo-agua-pend" }], "si la app está abierta, lo suma al tiro");
  });
  // en iPhone (sin botones): el aviso va igual, sin ellos
  const iphone = await (async () => {
    const handlers = {}, mostradas = [];
    const self = { addEventListener: (n, f) => { handlers[n] = f; }, registration: { showNotification: async (t, o) => { mostradas.push({ t, o }); } }, location: { origin: "https://rumbo.biplot.cl" }, skipWaiting() {}, clients: { claim() {} } };
    vm.runInContext(codigo, vm.createContext({ self, caches: { open: async () => ({ match: async () => undefined }) }, URL, fetch: async () => ({}), console }));
    let espera; handlers.push({ data: { json: () => ({ title: "💧 ¿Un vaso?", body: "x", actions: [{ action: "vaso", title: "+ Un vaso" }], agua: { vaso: 250 } }), text: () => "" }, waitUntil: p => { espera = p; } });
    await espera; return mostradas[0];
  })();
  test("donde el aviso no muestra botones (iPhone), va sin ellos", () => { assert.equal(iphone.o.actions, undefined); assert.equal(iphone.t, "💧 ¿Un vaso?"); });
  test("el aviso queda al día, en silencio y con los botones para otro vaso", () => {
    assert.equal(tv.confirma.t, "💧 Anotado: +300 ml"); assert.equal(tv.confirma.o.body, "Vas en 0,8 de 2 L. Yo me tomé otro contigo.");
    assert.equal(tv.confirma.o.silent, true); assert.equal(tv.confirma.o.tag, "rumbo-elefante-agua"); assert.equal(tv.confirma.o.actions.length, 2);
    assert.equal(tb.confirma.t, "💧 Anotado: +750 ml"); assert.equal(tb.pend[0].ml, 750, "«+ Tu botella» anota tu botella");
  });
  test("hay una cara para cada tipo de elefante", () => {
    for (const t of ["clasico", "asiatico", "mamut", "peluche", "geometrico", "tinta"]) assert.ok(fs.existsSync(new URL(`../assets/ele-aviso/${t}.png`, import.meta.url)), t);
  });
}
