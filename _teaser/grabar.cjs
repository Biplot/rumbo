/* ============================================================
   Rumbo · Teaser · Grabar la app
   Arma la cuenta de ejemplo («Camila», miércoles 18 de noviembre de 2026, en Norte noche),
   y graba cada toma de la app cuadro a cuadro con el reloj de la página en pausa (Playwright
   clock) y las animaciones CSS avanzadas a mano: cada cuadro sale nítido (390 × 844 al
   triple: 1170 × 2532) y las animaciones de la app quedan fluidas.
   Uso: node _teaser/grabar.cjs [toma ...]   (sin tomas: todas)
   Deja los cuadros en _teaser/tomas/<toma>/0000.jpg … (no se suben al repo).
   ============================================================ */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const RAIZ = path.join(__dirname, "..");
const E2E = path.join(RAIZ, "tests", "e2e");
const { chromium, URL, registrar } = require(path.join(E2E, "lib.cjs"));

const FPS = 60;
const HOY = "2026-11-18";
const SALIDA = path.join(__dirname, "tomas");

/* La misma cuenta de ejemplo que las capturas de la landing (tests/e2e/capturas-conoce.cjs) */
const fuente = fs.readFileSync(path.join(E2E, "capturas-conoce.cjs"), "utf8");
const sembrar = new Function("return " + fuente.slice(fuente.indexOf("function sembrar"), fuente.indexOf("\nasync function guardarJpg")))();

/* Lo que la landing no necesitaba y el teaser sí: libros en la repisa, la rueda y el botón de agua */
function sembrarMas() {
  const S = STATE;
  const libro = (id, titulo, autor, color, paginas, fin, valoracion) => ({ id, titulo, autor, color, paginas, estado: "terminado", fin, valoracion, formato: "normal", ts: 1 });
  S.lecturas = [
    libro("b1", "Hábitos atómicos", "James Clear", "#17C3B2", 320, "2026-02-10", 5),
    libro("b2", "El principito", "Antoine de Saint-Exupéry", "#F4A63B", 120, "2026-03-02", 5),
    libro("b3", "Cien años de soledad", "Gabriel García Márquez", "#E5527A", 470, "2026-05-20", 4),
    libro("b4", "Pedro Páramo", "Juan Rulfo", "#6C63FF", 130, "2026-06-11", 4),
    libro("b5", "La sombra del viento", "Carlos Ruiz Zafón", "#2E9E7B", 560, "2026-08-03", 5),
    libro("b6", "Sapiens", "Yuval Noah Harari", "#3E8BD6", 500, "2026-10-01", 4),
    { id: "b7", titulo: "El hombre en busca de sentido", autor: "Viktor Frankl", color: "#FF6B4A", paginas: 160, estado: "leyendo", pagina: 96, ts: 1 },
  ];
  S.settings.metaLibros = 10;
  S.rueda.meses[9] = [6, 7, 5, 6, 4, 6, 5, 5];
  S.rueda.meses[10] = [7, 8, 6, 7, 5, 7, 6, 6];
  S.agua.fab = true;
  saveState(); rerender();
}

/* El contraste: la misma cuenta el día 1 y el día 120 */
function estadoAntes() {
  const S = STATE, hoy = todayISO();
  // casi sin experiencia: cría, rango bajo y una sola medalla
  (S.gamif.ledger || []).forEach(m => { if (m.id === "demo-capturas" || (typeof m.id === "string" && m.id.startsWith("insignia:") && m.id !== "insignia:primer-paso")) m.anulado = true; });
  S.gamif.equipped.ele = { tipo: "clasico", ropa: {}, ts: 1 };
  S.gamif.equipped.cuarto = { off: [], pared: null, ts: 1 };
  // hábitos recién creados: solo hoy
  S.habitos.defs.forEach(h => { h.creado = hoy; });
  S.habitos.log = {}; const k = monthKey(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1), d = +hoy.slice(8);
  S.habitos.log[k] = { agua: { [d]: true }, meditar: { [d]: true } };
  S.jardin = Object.assign(S.jardin || {}, { raices: {}, ts: 1 });
  S.lecturas = S.lecturas.filter(l => l.estado !== "terminado");
  S.agua.dias = {};
  recalcGamif(S);
  S.gamif.badges = ["primer-paso"]; if (typeof cieloGuardarVisto === "function") cieloGuardarVisto(S.gamif.badges.slice());
  saveState(); rerender();
}
function estadoDespues() {
  const S = STATE, hoy = todayISO(), dia = 864e5, ahora = Date.parse(hoy + "T10:30:00");
  recalcGamif(S);
  // Sabio con corona (12.000 de experiencia) y su pieza decorada con lo de la Tienda
  ledgerRegistrar(S, "demo-dia-120", 2400, Math.max(0, 12600 - (S.gamif.xp || 0)), "Cuenta de ejemplo, día 120");
  CUARTO_TIENDA.forEach(it => ledgerRegistrar(S, "compra:" + it.id, 0, 0, "Compra de ejemplo"));
  S.gamif.equipped.cuarto = { off: [], pared: "par-salvia", ts: 1 };
  S.gamif.equipped.ele = { tipo: "clasico", ropa: { cabeza: "corona" }, ts: 1 };
  // todas las medallas, repartidas en el año
  BADGES.forEach((b, i) => ledgerRegistrar(S, "insignia:" + b.id, 0, 0, "Insignia " + b.nombre, ahora - (i + 1) * 3 * dia));
  // hábitos de 120 días: echan raíces y pasan al patio como árboles
  const desde = new Date(ahora - 120 * dia);
  S.habitos.defs.forEach(h => { h.creado = isoLocal(desde); });
  S.habitos.log = {};
  for (let x = new Date(desde); x <= new Date(ahora); x = new Date(x.getTime() + dia)) {
    const k = monthKey(x.getFullYear(), x.getMonth()), d = x.getDate(); S.habitos.log[k] = S.habitos.log[k] || {};
    ["agua", "meditar", "leer", "ingles"].forEach((hid, j) => { if ((d + j) % 9 !== 0) { S.habitos.log[k][hid] = S.habitos.log[k][hid] || {}; S.habitos.log[k][hid][d] = true; } });
    if (x.getDay() % 2) { S.habitos.log[k].gim = S.habitos.log[k].gim || {}; S.habitos.log[k].gim[d] = true; }
  }
  // la repisa llena: 10 de 10
  const mas = [["b8", "Rayuela", "Julio Cortázar", "#E9A21F", 600, "2026-10-20", 5], ["b9", "Ficciones", "Jorge Luis Borges", "#8B5CF6", 200, "2026-11-02", 4], ["b10", "La casa de los espíritus", "Isabel Allende", "#C2410C", 450, "2026-11-12", 5], ["b11", "Momo", "Michael Ende", "#0E8AA8", 280, "2026-11-16", 5]];
  mas.forEach(([id, titulo, autor, color, paginas, fin, valoracion]) => S.lecturas.push({ id, titulo, autor, color, paginas, estado: "terminado", fin, valoracion, formato: "normal", ts: 1 }));
  // el agua de hoy, a un vaso de la meta
  S.agua.dias = {}; const ad = aguaDia(hoy, true, S); ad.r.push({ id: "a1", ml: 1750, ts: ahora - 3600e3 });
  // las raíces ya celebradas (si no, el aviso «Echó raíces» sale encima de la toma)
  const hace = isoLocal(new Date(ahora - 50 * dia));
  S.jardin = Object.assign(S.jardin || {}, { raices: { agua: hace, meditar: hace, leer: hace, ingles: hace }, ts: 1 });
  recalcGamif(S);
  // la vitrina enciende lo que está en gamif.badges: todas, y ya vistas (sin la animación de medalla nueva)
  S.gamif.badges = (typeof cieloOrden === "function" ? cieloOrden() : BADGES.map(b => b.id)).slice();
  if (typeof cieloGuardarVisto === "function") cieloGuardarVisto(S.gamif.badges.slice());
  saveState(); rerender();
}

/* Con amigos (día 120): las cuentas locales comparten la «base» de amigos (LocalBackend, como en tests/e2e/tablero.cjs).
   Jose, Martín y Cami son amigos; Vale pide amistad. Una racha de a dos corriendo con Jose, el asado del sábado de
   Martín, juntar entre todos para el viaje al sur y un ánimo de Cami. */
async function amigosConGente() {
  const B = localStorage.getItem("rumbo_session"), hoy = todayISO(), F = n => agSumar(hoy, n), como = id => localStorage.setItem("rumbo_session", id), D = { tipo: "diario" };
  const cod = AMIGOS.codigo;
  for (const [id, nombre] of [["u_jose", "Jose"], ["u_martin", "Martín"], ["u_cami", "Cami"], ["u_vale", "Vale"]]) {
    como(id); await BACKEND.amigosPerfil({ nombre, estado: { fecha: hoy, abrio: true } }); await BACKEND.amigosPedir(cod);
  }
  como(B); for (const id of ["u_jose", "u_martin", "u_cami"]) await BACKEND.amigosResponder(id, true);
  // la racha de a dos: 8 días corriendo juntos
  como("u_jose"); const h = await BACKEND.conjuntoCrear("Correr 20 minutos", "🏃", D, [B], F(-8));
  como(B); await BACKEND.conjuntoResponder(h.id, true, F(-8));
  for (let k = -8; k <= 0; k++) { como("u_jose"); await BACKEND.conjuntoMarcar(h.id, F(k), true); if (k < 0) { como(B); await BACKEND.conjuntoMarcar(h.id, F(k), true); } }
  // el asado del sábado
  como("u_martin"); const asado = await BACKEND.planCrear({ titulo: "Asado del sábado", tipo: "comer", fecha: F(3), hora: "13:30", lugar: "Casa de Martín" }, [B], hoy);
  como(B); await BACKEND.planResponder(asado.id, "voy");
  // juntar entre todos para el viaje
  como(B); const o = await BACKEND.objetivoCrear("Viaje al sur", "$", 600000, F(60), ["u_jose", "u_cami"], hoy);
  for (const id of ["u_jose", "u_cami"]) { como(id); await BACKEND.objetivoResponder(o.id, true, hoy); }
  como(B); await BACKEND.objetivoAportar(o.id, 150000, "", hoy);
  como("u_jose"); await BACKEND.objetivoAportar(o.id, 120000, "", hoy);
  como("u_cami"); await BACKEND.objetivoAportar(o.id, 90000, "", hoy);
  await BACKEND.amigosAnimo(B, "¡Vamos, Camila!");
  como(B); await amigosCargar(true);
}

/* Las tomas: dónde parte, cuánto dura y qué pasa en cada momento (segundos desde el inicio de la toma).
   «cada» corre en todos los cuadros entre desde y hasta, con p de 0 a 1 (para desplazar la pantalla). */
const suave = p => 1 - Math.pow(1 - p, 3);
const TOMAS = {
  inicio: {
    ruta: "inicio", dur: 5.5,
    momentos: [{ t: 2.7, js: () => document.querySelector('[data-action="bocado-hecho"]').click() }],
  },
  habitos: {
    ruta: "habitos", dur: 3.0,
    prep: () => window.scrollTo(0, 470),
    momentos: [
      { t: 0.7, js: () => [...document.querySelectorAll('[data-action="habit-today"]')].find(e => /Inglés/.test(e.textContent)).click() },
      { desde: 1.3, hasta: 2.5, cada: p => window.scrollTo(0, 470 * (1 - p)) },
    ],
  },
  jardin: {
    ruta: "habitos", dur: 3.0,
    momentos: [{ t: 0.3, js: () => document.querySelector('[data-action="jar-abrir"]').click() }],
  },
  agua: {
    ruta: "inicio", dur: 3.0,
    momentos: [
      { t: 0.25, js: () => document.querySelector('[data-action="agua-fab-abrir"]').click() },
      { t: 0.95, js: () => document.querySelector('[data-action="agua-fab-tomar"]').click() },
      { t: 1.55, js: () => document.querySelector('[data-action="agua-fab-tomar"]').click() },
      { t: 2.15, js: () => document.querySelector('[data-action="agua-fab-tomar"]').click() },
    ],
  },
  biblioteca: {
    ruta: "lecturas", dur: 3.0,
    momentos: [{ desde: 0.2, hasta: 2.8, cada: p => window.scrollTo(0, 90 * p) }],
  },
  casa: { ruta: "cuarto", dur: 3.0, arrastre: { desde: 0.2, hasta: 2.8, x0: 120, x1: 290, y: 330 } },
  cielo: { ruta: "cielo", dur: 3.0, arrastre: { desde: 0.2, hasta: 2.8, x0: 110, x1: 300, y: 300 } },
  // El contraste: la misma pantalla el día 1 y el día 120
  "jardin-antes": { estado: estadoAntes, ruta: "habitos", dur: 2.0, momentos: [{ t: 0.1, js: () => document.querySelector('[data-action="jar-abrir"]').click() }] },
  "jardin-despues": { estado: estadoDespues, ruta: "habitos", dur: 2.6, momentos: [{ t: 0.0, js: () => document.querySelector('[data-action="jar-abrir"]').click() }] },
  "agua-antes": { estado: estadoAntes, ruta: "inicio", dur: 2.0, momentos: [
    { t: 0.1, js: () => document.querySelector('[data-action="agua-fab-abrir"]').click() },
    { t: 0.8, js: () => document.querySelector('[data-action="agua-fab-tomar"]').click() }] },
  "agua-despues": { estado: estadoDespues, ruta: "inicio", dur: 2.6, momentos: [
    { t: 0.0, js: () => document.querySelector('[data-action="agua-fab-abrir"]').click() },
    { t: 0.6, js: () => document.querySelector('[data-action="agua-fab-tomar"]').click() }] },
  "biblioteca-antes": { estado: estadoAntes, ruta: "lecturas", dur: 2.0 },
  "biblioteca-despues": { estado: estadoDespues, ruta: "lecturas", dur: 2.6 },
  "casa-antes": { estado: estadoAntes, ruta: "cuarto", dur: 2.0, arrastre: { desde: 0.1, hasta: 1.9, x0: 150, x1: 230, y: 330 } },
  "casa-despues": { estado: estadoDespues, ruta: "cuarto", dur: 2.6, arrastre: { desde: 0.1, hasta: 2.5, x0: 230, x1: 330, y: 330 } },
  "amigos-antes": { estado: estadoAntes, ruta: "amigos", dur: 2.0 },
  "amigos-despues": { estado: estadoDespues, ruta: "amigos", gente: amigosConGente, dur: 2.6, momentos: [{ desde: 0.5, hasta: 2.4, cada: p => window.scrollTo(0, 230 * p) }] },
  "cielo-antes": { estado: estadoAntes, ruta: "cielo", dur: 2.0, arrastre: { desde: 0.1, hasta: 1.9, x0: 150, x1: 230, y: 300 } },
  "cielo-despues": { estado: estadoDespues, ruta: "cielo", dur: 2.6, arrastre: { desde: 0.1, hasta: 2.5, x0: 230, x1: 330, y: 300 } },
};

const arriba = () => new Promise(res => http.get(URL, r => { r.resume(); res(true); }).on("error", () => res(false)));

async function grabar(b, id, T) {
  // El mismo contexto que las pruebas (sin Supabase y sin el consultorio de biplot.cl), pero con un reloj que se maneja a mano
  const ctx = await b.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  await ctx.route("https://biplot.cl/diario/ultima.json", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"edicion":null}' }));
  await ctx.route("**/js/store.js*", async r => {
    const res = await r.fetch();
    r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: (await res.text()).replace("const BACKEND = SupabaseBackend;", "const BACKEND = LocalBackend;") });
  });
  await ctx.clock.install({ time: new Date(HOY + "T10:30:00") });
  // El 3D de Rumbo baja a 15 cuadros por segundo si el navegador dibuja por software (como el de la grabación):
  // aquí se presenta con una tarjeta gráfica, para que la casa, la vitrina y el jardín se graben a ritmo completo.
  await ctx.addInitScript(() => {
    [self.WebGLRenderingContext, self.WebGL2RenderingContext].forEach(C => {
      if (!C) return; const orig = C.prototype.getParameter;
      C.prototype.getParameter = function (p) { return p === 0x9246 || p === 0x1F01 ? "ANGLE (Apple, Apple M2, OpenGL 4.1)" : orig.call(this, p); };
    });
  });   // corre normal hasta que se pausa para grabar
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "camila@ejemplo.cl");
  await p.evaluate(sembrar, HOY);
  await p.evaluate(sembrarMas);
  if (T.estado) await p.evaluate(T.estado);
  await p.evaluate(() => { STATE.settings.theme = "norte-noche"; saveState(); applyTheme("norte-noche"); });
  await p.addStyleTag({ content: ".toast{display:none!important}" });
  await p.goto(URL + "#" + T.ruta); await p.waitForTimeout(1500);
  if (T.gente) { await p.evaluate(T.gente); await p.goto(URL + "#inicio"); await p.waitForTimeout(400); await p.goto(URL + "#" + T.ruta); await p.waitForTimeout(1500); await p.evaluate(() => { try { closeModal(); } catch (e) {} }); }
  await p.evaluate(() => document.fonts.ready);
  if (T.prep) await p.evaluate(T.prep);
  await p.waitForTimeout(400);

  const dir = path.join(SALIDA, id); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // El reloj de la página se pausa: cada cuadro avanza 1/30 s los temporizadores y requestAnimationFrame (clock.runFor)
  // y, a mano, las animaciones y transiciones CSS (document.getAnimations()).
  await p.clock.pauseAt(new Date(HOY + "T10:33:00"));
  const cuadroCss = ms => p.evaluate(ms => document.getAnimations().forEach(a => {
    if (!a.__teaser) { a.__teaser = 1; a.pause(); }
    a.currentTime = (a.currentTime || 0) + ms;
  }), ms);
  const hechos = new Set();
  const N = Math.round(T.dur * FPS);
  let apretado = false;
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    for (const [i, m] of (T.momentos || []).entries()) {
      if (m.js && t >= m.t && !hechos.has(i)) { hechos.add(i); await p.evaluate(m.js); }
      if (m.cada && t >= m.desde && t <= m.hasta + 1 / FPS) await p.evaluate(`(${m.cada})(${Math.min(1, suave((t - m.desde) / (m.hasta - m.desde)))})`);
    }
    const a = T.arrastre;
    if (a && t >= a.desde && t <= a.hasta) {
      const x = a.x0 + (a.x1 - a.x0) * suave((t - a.desde) / (a.hasta - a.desde));
      if (!apretado) { await p.mouse.move(a.x0, a.y); await p.mouse.down(); apretado = true; }
      await p.mouse.move(x, a.y);
    } else if (a && apretado && t > a.hasta) { await p.mouse.up(); apretado = false; }
    await p.clock.runFor(1000 / FPS);
    await cuadroCss(1000 / FPS);
    await p.screenshot({ path: path.join(dir, String(f).padStart(4, "0") + ".jpg"), type: "jpeg", quality: 92, animations: "allow", timeout: 15000 });
  }
  await ctx.close();
  console.log(`✓ ${id}: ${N} cuadros` + (errs.length ? ` · errores: ${errs.slice(0, 2).join(" | ")}` : ""));
  return errs.length;
}

(async () => {
  let server = null;
  if (!(await arriba())) {
    server = spawn(process.execPath, [path.join(RAIZ, "serve.js")], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await arriba()); i++) await new Promise(r => setTimeout(r, 100));
  }
  const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TOMAS);
  const b = await chromium.launch();
  let errores = 0;
  for (const id of pedidas) { if (!TOMAS[id]) { console.log("No conozco la toma " + id); continue; } errores += await grabar(b, id, TOMAS[id]); }
  await b.close(); if (server) server.kill();
  // cuántos cuadros tiene cada toma (lo lee componer.html)
  const man = {}; fs.readdirSync(SALIDA).forEach(d => { const dd = path.join(SALIDA, d); if (fs.statSync(dd).isDirectory()) man[d] = fs.readdirSync(dd).filter(f => f.endsWith(".jpg")).length; });
  fs.writeFileSync(path.join(SALIDA, "manifiesto.json"), JSON.stringify(man, null, 1));
  process.exit(errores ? 1 : 0);
})();
