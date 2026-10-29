/* Pruebas en navegador · Temas (v92): Grafito y Medianoche se retiran (con devolución) y la hora del iPhone
   se lee en todos los temas: en el celular, la barra de arriba es oscura (la hora va en blanco). */
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

  // 1) La Tienda ya no trae Grafito ni Medianoche
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  const fichas = await p.evaluate(() => [...document.querySelectorAll('.ficha[data-theme]')].map(x => x.dataset.theme));
  ok(fichas.length === 15 && !fichas.includes("grafito") && !fichas.includes("medianoche"), "la Tienda trae 15 temas, sin Grafito ni Medianoche: " + fichas.join(", "));

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

  // 3) Los temas de a dos también siguen al teléfono: Ruta automático (gratis) y Bosque automático (con los dos)
  const usar = id => p.evaluate(id => { const x = document.createElement("button"); x.dataset.action = "set-theme"; x.dataset.theme = id; document.getElementById("view").appendChild(x); x.click(); }, id);
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => themeOwned("ruta-auto")), "Ruta automático es gratis");
  await usar("ruta-auto"); await p.waitForTimeout(150);
  const rutaDia = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  const rutaNoche = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "light" }); await p.waitForTimeout(150);
  ok(rutaDia === "ruta" && rutaNoche === "ruta-noche", `Ruta automático: de día Ruta y, con el teléfono oscuro, Ruta noche (${rutaDia} → ${rutaNoche})`);
  const icoRuta = await p.evaluate(() => { rerender(); const i = document.querySelector('.ficha[data-theme="ruta-auto"] .ficha__ico'); return i && i.style.background; });
  ok(/255, 255, 255\) 50%.*11, 11, 12\) 50%/.test(icoRuta), "su ficha es mitad Ruta y mitad Ruta noche: " + icoRuta);
  const bosque = await p.evaluate(() => { rerender(); const f = document.querySelector('.ficha[data-theme="bosque-auto"]'); return f && [f.className, f.innerText.replace(/\s+/g, " ")]; });
  ok(!(await p.evaluate(() => themeOwned("bosque-auto"))) && /is-bloqueado/.test(bosque[0]) && /Con los dos/.test(bosque[1]), "Bosque automático queda bloqueado hasta tener los dos Bosque: " + bosque[1]);
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-bosque", 1200, 0, "t"); saveState(); openThemePreview("bosque-auto"); });
  await p.waitForTimeout(300);
  ok(await p.locator('#modal [data-action="tema-buy"][data-luego="bosque-auto"]').count() === 2 && /Desbloquea Bosque Claro y Bosque Oscuro/.test(await p.locator("#modalBody").innerText()),
    "su vista previa ofrece desbloquear Bosque Claro y Bosque Oscuro");
  p.on("dialog", d => d.accept());
  await p.click('#modal [data-action="tema-buy"][data-theme="bosque-claro"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.settings.theme === "bosque-claro" && !themeOwned("bosque-auto")), "con uno solo, se aplica ese Bosque");
  await p.evaluate(() => openThemePreview("bosque-auto")); await p.waitForTimeout(300);
  await p.click('#modal [data-action="tema-buy"][data-theme="bosque-oscuro"]'); await p.waitForTimeout(300);
  const bDia = await p.evaluate(() => [STATE.settings.theme, document.documentElement.dataset.theme, themeOwned("bosque-auto")].join(" "));
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  const bNoche = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.emulateMedia({ colorScheme: "light" });
  ok(bDia === "bosque-auto bosque-claro true" && bNoche === "bosque-oscuro", `al completar el par se aplica Bosque automático: de día Bosque Claro y de noche Bosque Oscuro (${bDia} · ${bNoche})`);

  // 4) Quien usaba Grafito y lo compró: al cargar pasa a Ruta noche y recupera sus estrellas
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-temas", 400, 0, "t"); ledgerComprar(STATE, "tema-grafito", 400); STATE.settings.theme = "grafito"; STATE.settings.temaElegido = "grafito"; saveState(); });
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(500);
  const tras = await p.evaluate(() => ({ tema: STATE.settings.theme, dom: document.documentElement.dataset.theme, puntos: STATE.gamif.puntos, tuyo: themeOwned("grafito") }));
  ok(tras.tema === "ruta-noche" && tras.dom === "ruta-noche" && tras.puntos === antes + 400 && !tras.tuyo, `Grafito pasa a Ruta noche y devuelve sus 400 ⭐ (${antes} → ${tras.puntos})`);
  await ctx.close();

  // 5) En el computador, los claros de la Tienda mantienen su barra clara
  const c2 = await nuevoContexto(b, { w: 1360, h: 860, fecha: "2026-10-29T10:00:00" });
  const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await registrar(p2, "temas-esc@test.cl");
  const claras = await p2.evaluate(() => ["bosque-claro", "cuaderno", "sakura"].map(id => { applyTheme(id); return getComputedStyle(document.querySelector(".topbar")).backgroundColor; }));
  ok(JSON.stringify(claras) === '["rgb(247, 245, 240)","rgb(244, 239, 227)","rgb(255, 246, 247)"]', "en el computador, Bosque Claro, Cuaderno y Sakura mantienen su barra clara: " + claras.join(" · "));
  await c2.close();
};
