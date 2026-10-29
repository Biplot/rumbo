/* Pruebas en navegador · Diseño Norte (v91): el tema propio de Rumbo y el predeterminado (Automático).
   Una aguja ámbar para lo que sigue sobre tinta índigo; Navy y Claro (los colores de BiPlot) se retiran. */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
const rgb = (p, sel, prop = "backgroundColor") => p.evaluate(([s, k]) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[k] : ""; }, [sel, prop]);
module.exports = async ({ b, ok, errs }) => {
  // 1) Cuenta nueva en el celular, de día: Automático se ve en Norte
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-29T09:10:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "norte@test.cl");
  await p.evaluate(() => { STATE.settings.introVersion = INTRO_VERSION; saveState(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.settings.theme === "auto" && document.documentElement.dataset.theme === "norte"), "una cuenta nueva parte en automático: de día, Norte");
  ok(await rgb(p, ".app") === "rgb(245, 246, 250)" && await rgb(p, ".topbar") === "rgb(22, 26, 46)" && await rgb(p, ".bottombar") === "rgb(255, 255, 255)",
    "Norte día: fondo de mañana, barra de arriba en tinta índigo (la hora del iPhone se lee) y barra de abajo blanca");
  ok(await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content === "#161A2E"), "el color del navegador sigue a la barra de arriba");
  ok(await rgb(p, "#view .ruta-dia .btn--primary") === "rgb(244, 174, 61)" && await rgb(p, "#view .ruta-dia .btn--primary", "color") === "rgb(22, 26, 46)",
    "«Abre tu día» es la aguja: ámbar con texto en tinta");
  ok(await rgb(p, "#view .ruta__p.is-actual .ruta__m") === "rgb(244, 174, 61)", "la parada que sigue se marca en ámbar");
  ok(await rgb(p, "#bbDia .bb-dia__c") === "rgb(244, 174, 61)", "el botón del día de la barra de abajo también es ámbar");
  ok(await p.evaluate(() => [...document.querySelectorAll("#view .btn--primary")].length) === 1, "un solo botón ámbar en la pantalla");
  ok((await rgb(p, "body", "fontFamily")).startsWith("Figtree") && (await rgb(p, ".ruta-dia__t", "fontFamily")).startsWith('"Bricolage Grotesque"'),
    "letras de Norte: Figtree para el texto y Bricolage Grotesque para los títulos");
  ok(await p.evaluate(() => ["auto", "norte", "norte-noche", "ruta", "ruta-noche"].every(themeOwned) && !THEMES.some(t => ["navy", "claro"].includes(t.id))),
    "Automático, Norte, Norte noche, Ruta y Ruta noche son gratis; Navy y Claro ya no están");

  // 2) Lo hecho va en índigo: con el día abierto, la primera parada se marca en índigo
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = { hecho: true, mision: "Probar Norte", abiertoTs: Date.now(), ts: Date.now() }; saveState(); rerender(); });
  await p.waitForTimeout(200);
  ok(await rgb(p, "#view .ruta__p.is-hecho .ruta__m") === "rgb(57, 73, 201)", "lo hecho se marca en índigo");

  // 3) Navy y Claro se retiran: cada uno pasa a Norte en su mismo modo
  const mig = await p.evaluate(() => {
    const base = () => JSON.parse(JSON.stringify(STATE));
    const casos = [["navy", undefined], ["navy", "navy"], ["claro", undefined], ["claro", "claro"], ["ruta", undefined], ["ruta", "ruta"], ["sakura", undefined], ["tema-que-no-existe", undefined]];
    return casos.map(([t, e]) => { const x = base(); x.settings.theme = t; if (e) x.settings.temaElegido = e; else delete x.settings.temaElegido;
      const m = migrate(x).settings; return m.theme + (m.temaElegido ? "/" + m.temaElegido : ""); });
  });
  ok(JSON.stringify(mig) === '["auto","norte-noche/norte-noche","norte/norte","norte/norte","auto","ruta/ruta","sakura","auto"]',
    "Navy por defecto pasa a automático, un Navy elegido a Norte noche y Claro a Norte; Ruta y Sakura elegidos se quedan: " + mig);
  ok(await p.evaluate(() => { applyTheme("navy"); const t = document.documentElement.dataset.theme; applyTheme(STATE.settings.theme); return t; }) === "norte",
    "si algo pide Navy, se ve Norte");

  // 4) Elegir Norte noche en la Tienda: queda guardado y se ve oscuro aunque el teléfono esté en claro
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "set-theme"; x.dataset.theme = "norte-noche"; document.getElementById("view").appendChild(x); x.click(); });
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => STATE.settings.theme === "norte-noche" && STATE.settings.temaElegido === "norte-noche" && document.documentElement.dataset.theme === "norte-noche"),
    "quien elige Norte noche lo conserva al recargar, aunque el teléfono esté en claro");
  await ctx.close();

  // 5) De noche (teléfono en modo oscuro): Norte noche, el cielo índigo de la vitrina
  const c2 = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-29T21:40:00" });
  const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await p2.emulateMedia({ colorScheme: "dark" });
  await registrar(p2, "norte-noche@test.cl");
  await p2.evaluate(() => { STATE.settings.introVersion = INTRO_VERSION; STATE.ritual.dias[todayISO()] = { hecho: true, ts: Date.now() }; saveState(); });
  await p2.goto(URL + "#inicio"); await p2.waitForTimeout(300);
  ok(await p2.evaluate(() => document.documentElement.dataset.theme) === "norte-noche" && await rgb(p2, ".app") === "rgb(12, 15, 30)" && await rgb(p2, ".topbar") === "rgb(12, 15, 30)",
    "con el teléfono oscuro, Automático se ve en Norte noche: fondo y barra en índigo noche");
  ok(await rgb(p2, "#view .ruta__p.is-actual .btn--primary[data-action=day-close]") === "rgb(255, 190, 85)", "de noche, «Cierra tu día» es la aguja ámbar");
  ok(await p2.evaluate(() => document.querySelector('meta[name="theme-color"]').content === "#0C0F1E"), "el color del navegador va en índigo noche");
  await c2.close();

  // 6) En el computador, de día: la barra de arriba toma el color del fondo y el logo es el bocado ámbar
  const c3 = await nuevoContexto(b, { w: 1360, h: 860, fecha: "2026-10-29T09:10:00" });
  const p3 = await c3.newPage(); p3.on("pageerror", e => errs.push(e.message));
  await registrar(p3, "norte-esc@test.cl");
  ok(await rgb(p3, ".topbar") === "rgb(245, 246, 250)" && await rgb(p3, ".sidebar") === "rgb(255, 255, 255)", "en el computador, la barra de arriba va del color del fondo");
  ok(await rgb(p3, ".brand-mark svg > circle[mask]", "fill") === "rgb(244, 174, 61)", "el logo es el bocado ámbar sobre tinta índigo");
  await c3.close();
};
