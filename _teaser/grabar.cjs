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

const FPS = 30;
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
  await ctx.clock.install({ time: new Date(HOY + "T10:30:00") });   // corre normal hasta que se pausa para grabar
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "camila@ejemplo.cl");
  await p.evaluate(sembrar, HOY);
  await p.evaluate(sembrarMas);
  await p.evaluate(() => { STATE.settings.theme = "norte-noche"; saveState(); applyTheme("norte-noche"); });
  await p.addStyleTag({ content: ".toast{display:none!important}" });
  await p.goto(URL + "#" + T.ruta); await p.waitForTimeout(1500);
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
    await p.clock.runFor(Math.round(1000 / FPS));
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
  process.exit(errores ? 1 : 0);
})();
