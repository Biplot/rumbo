/* ============================================================
   Rumbo · Capturas de la página de presentación (/conoce/)
   No es una prueba (no está en run.cjs): arma una cuenta de ejemplo
   («Camila», miércoles 18 de noviembre de 2026) en Norte noche y guarda
   las pantallas que usa conoce/index.html en conoce/img/, a 780 × 1688
   (390 × 844 al doble), las mismas en Norte día en conoce/img/dia/ (la landing
   las cambia con su modo día) y la imagen para compartir og.jpg (1200 × 630).
   Uso: node tests/e2e/capturas-conoce.cjs   (levanta serve.js si hace falta)
   Necesita las fuentes de Google (Bricolage Grotesque y Figtree) y ImageMagick
   o Python con Pillow para pasar a JPG.
   ============================================================ */
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium, URL, nuevoContexto, registrar } = require("./lib.cjs");

const RAIZ = path.join(__dirname, "..", "..");
const DESTINO = path.join(RAIZ, "conoce", "img");
const HOY = "2026-11-18";
const arriba = () => new Promise(res => http.get(URL, r => { r.resume(); res(true); }).on("error", () => res(false)));

/* La cuenta de ejemplo. Corre dentro de la página (usa las funciones de la app). */
function sembrar(HOY) {
  const S = STATE, [Y, M] = HOY.split("-").map(Number), dHoy = +HOY.slice(8);
  const iso = d => `${Y}-${String(M).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  S.profile.name = "Camila";
  S.settings.theme = "norte-noche"; S.settings.temaElegido = "norte-noche";
  S.gamif.equipped.ele = { tipo: "clasico", ropa: {}, ts: 1 };

  // Los días de noviembre, abiertos y cerrados, con su ánimo en el diario
  const animos = [4, 3, 4, 5, 3, 4, 4, 2, 3, 4, 5, 4, 3, 4, 5, 4, 4];
  const mejores = ["Terminé el informe", "Almuerzo con la Jose", "Corrí 5 km", "Cerré la semana", "Leí en el parque", "Llamé a mamá", "Cociné algo nuevo"];
  S.vida.diario = [];
  for (let d = 1; d < dHoy; d++) {
    const f = iso(d);
    S.ritual.dias[f] = { hecho: true, cerrado: true, mision: d % 2 ? "Avanzar lo importante" : "Un bocado a la vez", pilar: "Productividad",
      cierre: { sapo: d % 4 !== 0, energia: animos[d - 1], mejor: mejores[d % mejores.length] }, ts: 1 };
    S.vida.diario.push({ id: "dia-" + f, fecha: f, fromRitual: true, mood: animos[d - 1], texto: "", gratitud: mejores[d % mejores.length], ts: 1 });
  }
  // Hoy: el día abierto
  S.ritual.dias[HOY] = { hecho: true, mision: "Avanzar con calma y foco", sapo: "Cerrar la propuesta de noviembre", sapoAmbito: "pro",
    pilar: "Productividad", energia: 4, servir: "", proyectos: [], abiertoTs: Date.now(), ts: 1 };

  // Las tareas de hoy y de los próximos días
  const t = (dia, txt, ambito, op) => nuevaTarea(S, dia, Object.assign({ txt, ambito }, op || {}));
  const contador = t(HOY, "Llamar al contador", "pro", { migraciones: 3, creada: iso(11) });
  marcarTarea(contador, "hecha");
  t(HOY, "Cerrar la propuesta de noviembre", "pro", { esSapo: true });
  t(HOY, "Revisar métricas de la campaña", "pro");
  t(HOY, "Comprar regalo para la Jose", "per");
  t(HOY, "Agendar hora al dentista", "per");
  t(iso(dHoy + 1), "Publicar la landing nueva", "pro");
  t(iso(dHoy + 1), "Reunión con el equipo de diseño", "pro");
  t(iso(dHoy + 1), "Pagar la cuenta de la luz", "per");
  t(iso(dHoy + 2), "Enviar el informe del mes", "pro");
  t(iso(dHoy + 2), "Cumpleaños de la Jose: llevar la torta", "per");

  // La semana: foco, prioridades y premio
  const lunes = agLunes(HOY);
  S.ritual.semanas[lunes] = {
    plan: { premio: "Cine el sábado", ts: 1 },
    apertura: { foco: "Lanzar la landing", habitosFoco: [], ts: 1, prioridades: [
      { id: "p1", texto: "Publicar la landing nueva", ambito: "pro", dia: iso(dHoy + 1) },
      { id: "p2", texto: "Cerrar la propuesta de noviembre", ambito: "pro", dia: HOY },
      { id: "p3", texto: "Ir 3 veces al gimnasio", ambito: "per", dia: null },
    ] },
  };

  // Hábitos con su racha
  const h = (id, nombre, icon, frecuencia) => ({ id, nombre, icon, frecuencia, creado: `${Y}-09-01` });
  S.habitos.defs = [h("agua", "Agua", "💧", { tipo: "diario" }), h("meditar", "Meditar", "🧘", { tipo: "diario" }),
    h("gim", "Gimnasio", "🏋️", { tipo: "semanal", veces: 3 }), h("ingles", "Inglés", "📘", { tipo: "diario" }),
    h("leer", "Leer 20 minutos", "📖", { tipo: "diario" }), h("mama", "Llamar a mamá", "📞", { tipo: "semanal", veces: 1 })];
  S.habitos.log = {};
  const marcar = (hid, dias, mes = M) => { const k = monthKey(Y, mes - 1); S.habitos.log[k] = S.habitos.log[k] || {}; S.habitos.log[k][hid] = S.habitos.log[k][hid] || {}; dias.forEach(d => S.habitos.log[k][hid][d] = true); };
  const todos = n => Array.from({ length: n }, (_, i) => i + 1);
  [9, 10].forEach(mes => { const n = new Date(Y, mes, 0).getDate(); marcar("agua", todos(n).filter(d => d % 6), mes); marcar("meditar", todos(n).filter(d => d % 4), mes); marcar("leer", todos(n).filter(d => d % 3), mes); });
  marcar("agua", todos(dHoy)); marcar("meditar", todos(dHoy).filter(d => d > 3));
  marcar("ingles", todos(dHoy - 1).filter(d => d % 3 !== 0)); marcar("leer", todos(dHoy - 1).filter(d => d > 6));
  marcar("gim", [2, 4, 6, 9, 11, 13, 16, 17]); marcar("mama", [1, 8, 15]);
  S.jardin = Object.assign(S.jardin || {}, { macetas: ["meditar", "ingles", "leer"], inicio: true, ts: 1 });

  // Notas
  const n = (id, titulo, texto, etiquetas, fijada) => ({ id, titulo, texto, etiquetas, fijada: !!fijada, color: "", archivada: false, ts: 1 });
  S.postits = [n("n1", "Ideas para el taller", "Partir con una pregunta. Ejemplos reales. Cerrar con tarea.", ["trabajo"], true),
    n("n2", "Lista del viaje", "Pasaporte, cargador, adaptador y el libro de la Jose.", ["casa"], true),
    n("n3", "", "Llamar al contador por el IVA de noviembre", ["trabajo"]),
    n("n4", "", "Regalo para el cumpleaños de la Jose", ["casa"]),
    n("n5", "Frase", "«Un bocado a la vez.»", ["libros"]),
    n("n6", "", "Probar la receta de lentejas con curry", ["casa"])];

  // Calendario
  S.eventos = { [iso(dHoy + 2)]: ["Cumpleaños de la Jose"], [iso(dHoy + 6)]: ["Dentista 10:00"], [iso(25)]: ["Cena con el equipo"] };

  // Objetivos del mes
  S.metas.mensuales[M - 1] = [{ id: "m1", texto: "Lanzar la landing nueva", done: false, ts: 1 }, { id: "m2", texto: "Ahorrar $150.000", done: true, ts: 1 }, { id: "m3", texto: "Leer dos libros", done: false, ts: 1 }];

  // Estrellas y experiencia (rango Imparable)
  ledgerRegistrar(S, "demo-capturas", 1410, 2320, "Cuenta de ejemplo");
  recalcGamif(S);
  saveState(); applyTheme("norte-noche"); updateTopbar(); rerender();
}

async function guardarJpg(png, jpg, ancho, alto) {
  try { execFileSync("convert", [png, "-resize", `${ancho}x${alto}!`, "-strip", "-quality", "82", jpg]); return; } catch (e) {}
  execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB').resize((int(sys.argv[3]),int(sys.argv[4])),Image.LANCZOS).save(sys.argv[2],quality=82,optimize=True)", png, jpg, String(ancho), String(alto)]);
}

(async () => {
  let server = null;
  if (!(await arriba())) {
    server = spawn(process.execPath, [path.join(RAIZ, "serve.js")], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await arriba()); i++) await new Promise(r => setTimeout(r, 100));
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rumbo-capturas-"));
  const b = await chromium.launch();
  const errs = [];
  const ctx = await nuevoContexto(b, { w: 390, h: 844, dpr: 2, fecha: HOY + "T10:30:00", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue());   // las capturas van con la letra de verdad (gana a la ruta vacía de lib.cjs)
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "camila@ejemplo.cl");
  await p.evaluate(sembrar, HOY);
  await p.addStyleTag({ content: ".toast,.ayuda-burbuja,.tut-burbuja,.mas-mod__nuevo,.is-nuevo::after{display:none!important}" });
  await p.evaluate(() => document.fonts.ready);

  const pantallas = [["inicio", "inicio"], ["habitos", "habitos"], ["semana", "semana"], ["notas", "notas"], ["calendario", "calendario"], ["recompensas", "recompensas"], ["diario", "diario"]];
  for (const [tema, carpeta] of [["norte-noche", DESTINO], ["norte", path.join(DESTINO, "dia")]]) {
    fs.mkdirSync(carpeta, { recursive: true });
    await p.evaluate(tema => { STATE.settings.theme = tema; STATE.settings.temaElegido = tema; saveState(); applyTheme(tema); }, tema);
    for (const [ruta, archivo] of pantallas) {
      await p.goto(URL + "#" + ruta); await p.waitForTimeout(900);
      await p.evaluate(() => { try { closeModal(); } catch (e) {} window.scrollTo(0, 0); });
      await p.waitForTimeout(300);
      const png = path.join(tmp, archivo + ".png");
      await p.screenshot({ path: png });
      await guardarJpg(png, path.join(carpeta, archivo + ".jpg"), 780, 1688);
      console.log("✓ " + path.relative(DESTINO, path.join(carpeta, archivo + ".jpg")));
    }
  }

  // La imagen para compartir: la portada de la landing con la captura nueva
  const og = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  og.on("pageerror", e => errs.push("og: " + e.message));
  await og.addInitScript(() => { try { localStorage.setItem("rumbo-conoce-tema", "noche"); localStorage.setItem("rumbo-conoce-agua", "{}"); } catch (e) {} });
  await og.goto(URL + "conoce/index.html", { waitUntil: "networkidle" });
  await og.addStyleTag({ content: ".aviso,.top,.fijo,.paseo,.agua,.promesas,.hero .pre,.ele-flota{display:none!important}.rv{opacity:1!important;transform:none!important}.hero .wrap{padding-top:40px;padding-bottom:40px}" });
  await og.evaluate(() => document.fonts.ready); await og.waitForTimeout(400);
  const ogPng = path.join(tmp, "og.png");
  await og.screenshot({ path: ogPng, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await guardarJpg(ogPng, path.join(DESTINO, "og.jpg"), 1200, 630);
  console.log("✓ og.jpg");

  await b.close(); if (server) server.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errs.length) { console.log("Errores de página:", errs.slice(0, 5)); process.exit(1); }
})();
