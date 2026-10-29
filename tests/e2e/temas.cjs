/* Pruebas en navegador · Temas: Grafito y Medianoche se retiran (con devolución); los temas son familias (v95):
   la Tienda vende las que no tienes y Apariencia elige el modo (Auto, Día, Noche); Bosque es una sola compra;
   la hora del iPhone se lee en todos los temas y la barra de estado ya no es translúcida. */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
// Contraste WCAG entre dos colores rgb()/rgba() de getComputedStyle
const contraste = (a, b) => {
  const lum = c => { const [r, g, bl] = c.match(/[\d.]+/g).slice(0, 3).map(x => +x / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05);
};
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-29T10:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "temas@test.cl");

  // 1) La Tienda vende familias de temas (las que no tienes), sin Grafito ni Medianoche
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(300);
  await p.click('[data-action="tienda-sec"][data-v="estilo"]'); await p.waitForTimeout(250);
  const fichas = await p.evaluate(() => [...document.querySelectorAll('#view .ficha[data-theme]')].map(x => x.dataset.theme).sort());
  ok(JSON.stringify(fichas) === '["atardecer","bosque","cuaderno","oceano","sakura","terminal"]', "la Tienda vende 6 familias de temas (Norte, Ruta y Alto contraste son gratis y ya son tuyas): " + fichas.join(", "));
  ok((await p.locator('#view .ficha[data-theme="bosque"]').innerText()).replace(/\s+/g, " ").includes("Día · Noche · Auto"), "Bosque es una sola ficha, con día, noche y automático");
  await p.goto(URL + "#apariencia"); await p.waitForTimeout(300);
  ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll(".fam-card")].map(x => x.dataset.familia))) === '["norte","ruta","alto-contraste"]', "Apariencia trae tus temas: Norte, Ruta y Alto contraste");

  // 2) En el celular, la hora (blanca) se lee sobre la barra de arriba de todos los temas, y el título también
  const barras = await p.evaluate(() => THEMES.filter(t => !t.auto).map(t => {
    applyTheme(t.id);
    const top = document.querySelector(".topbar"), h1 = document.querySelector(".topbar__title h1");
    return { id: t.id, fondo: getComputedStyle(top).backgroundColor, titulo: getComputedStyle(h1).color, meta: document.querySelector('meta[name="theme-color"]').content };
  }));
  await p.evaluate(() => applyTheme(STATE.settings.theme));
  const malas = barras.filter(x => contraste("rgb(255,255,255)", x.fondo) < 4.5 || contraste(x.titulo, x.fondo) < 4.5).map(x => `${x.id}: ${x.fondo}`);
  ok(barras.length === 12 && !malas.length, "en el celular, la hora y el título se leen sobre la barra de arriba de los 12 temas " + malas.join(", "));
  const tinta = Object.fromEntries(barras.filter(x => ["bosque-claro", "cuaderno", "sakura"].includes(x.id)).map(x => [x.id, x.fondo + " " + x.meta]));
  ok(tinta["bosque-claro"] === "rgb(22, 48, 31) #16301F" && tinta.cuaderno === "rgb(36, 57, 95) #24395F" && tinta.sakura === "rgb(58, 34, 48) #3A2230",
    "Bosque Claro, Cuaderno y Sakura llevan su tinta oscura arriba (y el color del navegador la sigue): " + JSON.stringify(tinta));

  // 3) Los temas de a dos siguen al teléfono: Ruta en Auto (gratis); Bosque se compra una vez, con los dos modos
  const usar = id => p.evaluate(id => { const x = document.createElement("button"); x.dataset.action = "set-theme"; x.dataset.theme = id; document.getElementById("view").appendChild(x); x.click(); }, id);
  await p.click('.fam-card[data-familia="ruta"] [data-theme="ruta-auto"]'); await p.waitForTimeout(200);
  const rutaDia = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  const rutaNoche = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "light" }); await p.waitForTimeout(150);
  ok(rutaDia === "ruta" && rutaNoche === "ruta-noche" && await p.evaluate(() => STATE.settings.theme === "ruta-auto"), `en Apariencia, Ruta en Auto: de día Ruta y, con el teléfono oscuro, Ruta noche (${rutaDia} → ${rutaNoche})`);
  const icoRuta = await p.evaluate(() => { const i = document.querySelector('.fam-card[data-familia="ruta"] .fam-card__mini'); return i && i.style.background; });
  ok(/255, 255, 255\) 50%.*11, 11, 12\) 50%/.test(icoRuta), "su miniatura es mitad Ruta y mitad Ruta noche: " + icoRuta);
  await p.click('.fam-card[data-familia="ruta"] [data-theme="ruta-noche"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.settings.theme === "ruta-noche" && document.documentElement.dataset.theme === "ruta-noche"), "y en Noche queda siempre oscuro");
  ok(!(await p.evaluate(() => themeOwned("bosque-auto") || themeOwned("bosque-claro"))), "Bosque todavía no es tuyo");
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-bosque", 1200, 0, "t"); saveState(); openThemePreview("bosque"); });
  await p.waitForTimeout(300);
  ok(await p.locator('#modal [data-action="tema-buy"][data-theme="bosque"]').count() === 1 && /900/.test(await p.locator('#modal [data-action="tema-buy"]').innerText()) && /De día/.test(await p.locator("#modalBody").innerText()),
    "su vista previa muestra el día y la noche, y se desbloquea una vez por 900 ⭐");
  p.on("dialog", d => d.accept());
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('#modal [data-action="tema-buy"][data-theme="bosque"]'); await p.waitForTimeout(300);
  const bDia = await p.evaluate(() => [STATE.settings.theme, document.documentElement.dataset.theme, themeOwned("bosque-claro"), themeOwned("bosque-oscuro")].join(" "));
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  const bNoche = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "light" });
  ok(bDia === "bosque-auto bosque-claro true true" && bNoche === "bosque-oscuro" && await p.evaluate(a => STATE.gamif.puntos === a - 900, antes),
    `una compra trae los dos Bosque y queda en automático: de día Bosque Claro y de noche Bosque Oscuro (${bDia} · ${bNoche})`);
  // Quien tenía uno de los dos (de antes) ya tiene la familia
  ok(await p.evaluate(() => { const o = STATE.gamif.owned; STATE.gamif.owned = ["tema-bosque-oscuro"]; const r = themeOwned("bosque-claro") && themeOwned("bosque-auto"); STATE.gamif.owned = o; return r; }), "quien tenía solo Bosque Oscuro tiene también Bosque Claro y el automático");

  // 4) Sin barra de estado translúcida (iOS 26.1+ difumina el borde de arriba con ella); la de estado toma theme-color
  const html = await p.evaluate(async () => (await fetch("./")).text());
  ok(!/apple-mobile-web-app-status-bar-style"\s+content/.test(html) && /name="theme-color"/.test(html), "el HTML ya no pide la barra de estado translúcida y conserva theme-color");
  const alto = await p.evaluate(() => [getComputedStyle(document.documentElement).getPropertyValue("--alto-app").trim(), innerHeight + "px", getComputedStyle(document.querySelector(".app")).minHeight]);
  ok(alto[0] === alto[1] && alto[2] === alto[1], "la app mide el alto real de la pantalla, no 100vh: " + alto.join(" · "));
  await usar("bosque-auto"); await p.waitForTimeout(100);
  ok(await p.evaluate(() => localStorage.getItem("rumbo-tema-inicio")) === '{"t":["bosque-claro","bosque-oscuro"],"c":["#16301F","#0A140E"]}', "el tema y su color de barra (de día y de noche) quedan guardados para la próxima apertura");
  await usar("alto-contraste"); await p.waitForTimeout(100);
  {
    // Abrir de nuevo sin que corra el código de la app: el tema y el color de la barra ya vienen desde el inicio
    const q = await ctx.newPage();
    await q.route("**/js/app.js*", r => r.abort());
    await q.goto(URL); await q.waitForTimeout(300);
    const pre = await q.evaluate(() => [document.documentElement.dataset.theme, document.querySelector('meta[name="theme-color"]').content]);
    ok(pre.join(" ") === "alto-contraste #000000", "al abrir, el tema y el color de la barra de estado se ponen antes de cargar el código: " + pre.join(" · "));
    await q.close();
  }
  // Aviso para quien instaló la app antes del cambio (iOS guarda la forma de la barra al instalar)
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator("#view .aviso-reinstalar").count() === 0, "fuera de la app instalada de antes no hay aviso de reinstalar");
  await p.evaluate(() => { window.instalacionAntigua = () => true; rerender(); });
  await p.waitForTimeout(150);
  ok(/borra el ícono de Rumbo/.test(await p.locator("#view .aviso-reinstalar").innerText()), "en la app instalada de antes, Inicio explica cómo quitar el difuminado");
  await p.click('#view [data-action="aviso-reinstalar-ok"]'); await p.waitForTimeout(150);
  ok(await p.locator("#view .aviso-reinstalar").count() === 0 && await p.evaluate(() => localStorage.getItem("rumbo-aviso-reinstalar")) === "1", "con «Entendido» el aviso se va y no vuelve");

  // 5) Quien usaba Grafito y lo compró: al cargar pasa a Ruta noche y recupera sus estrellas
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-temas", 400, 0, "t"); ledgerComprar(STATE, "tema-grafito", 400); STATE.settings.theme = "grafito"; STATE.settings.temaElegido = "grafito"; saveState(); });
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(500);
  const tras = await p.evaluate(() => ({ tema: STATE.settings.theme, dom: document.documentElement.dataset.theme, puntos: STATE.gamif.puntos, tuyo: themeOwned("grafito") }));
  ok(tras.tema === "ruta-noche" && tras.dom === "ruta-noche" && tras.puntos === antes + 400 && !tras.tuyo, `Grafito pasa a Ruta noche y devuelve sus 400 ⭐ (${antes} → ${tras.puntos})`);
  await ctx.close();

  // 6) En el computador, los claros de la Tienda mantienen su barra clara
  const c2 = await nuevoContexto(b, { w: 1360, h: 860, fecha: "2026-10-29T10:00:00" });
  const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await registrar(p2, "temas-esc@test.cl");
  const claras = await p2.evaluate(() => ["bosque-claro", "cuaderno", "sakura"].map(id => { applyTheme(id); return getComputedStyle(document.querySelector(".topbar")).backgroundColor; }));
  ok(JSON.stringify(claras) === '["rgb(247, 245, 240)","rgb(244, 239, 227)","rgb(255, 246, 247)"]', "en el computador, Bosque Claro, Cuaderno y Sakura mantienen su barra clara: " + claras.join(" · "));
  await c2.close();
};
