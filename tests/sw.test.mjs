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
  test("hay una cara para cada tipo de elefante", () => {
    for (const t of ["clasico", "asiatico", "mamut", "peluche", "geometrico", "tinta"]) assert.ok(fs.existsSync(new URL(`../assets/ele-aviso/${t}.png`, import.meta.url)), t);
  });
}
