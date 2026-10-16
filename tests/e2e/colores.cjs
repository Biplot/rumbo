/* Pruebas en navegador · Colores de BiPlot: un solo botón coral por pantalla y las barras azules del tema Claro */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const coral = p => p.evaluate(() => [...document.querySelectorAll("#view .btn--primary")].map(x => x.dataset.action));
  const borde = p => p.evaluate(() => [...document.querySelectorAll("#view .btn--borde")].map(x => x.dataset.action));

  // 1) Inicio con el día por abrir y el trimestre por abrir: manda «Abre tu día», el trimestre queda con borde
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-15T09:20:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "colores@test.cl");
  await p.evaluate(() => { STATE.settings.theme = "claro"; saveState(); applyTheme("claro"); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok(JSON.stringify(await coral(p)) === '["day-open"]', "Inicio: el único botón coral es «Abre tu día»");
  ok((await borde(p)).includes("tri-ritual"), "Inicio: «Abrir el trimestre» pasa a botón con borde");

  // 2) Ritual · Día por abrir: la tarjeta coral del día manda, ningún otro botón coral
  await p.goto(URL + "#ritual"); await p.waitForTimeout(300);
  ok((await coral(p)).length === 0 && (await borde(p)).includes("tri-ritual"), "Ritual: con la tarjeta coral del día, los avisos quedan con borde");

  // 3) Día abierto en la mañana: el primer aviso (trimestre) lleva el coral
  await p.evaluate(() => { const hoy = todayISO(); STATE.ritual.dias[hoy] = { ...(STATE.ritual.dias[hoy] || {}), hecho: true }; saveState(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(JSON.stringify(await coral(p)) === '["tri-ritual"]', "día en curso: el aviso del trimestre es el único coral");

  // 4) Barras: azules en Claro, sin cambios en Navy
  const fondos = () => p.evaluate(() => [".topbar", ".bottombar"].map(s => getComputedStyle(document.querySelector(s)).backgroundColor));
  const [top, bottom] = await fondos();
  ok(top.includes("14, 42, 71") && bottom.includes("14, 42, 71"), `Claro: barra de arriba y de abajo en Azul Profundo (${top} · ${bottom})`);
  await p.evaluate(() => { STATE.settings.theme = "navy"; saveState(); applyTheme("navy"); rerender(); });
  const [topN] = await fondos();
  ok(topN.includes("10, 30, 51"), `Navy: la barra de arriba sigue en su azul (${topN})`);

  // 5) La barra de arriba es sólida y sin desenfoque en todos los temas: si no, desde iOS 26 el
  //    iPhone difumina el borde de arriba de la app instalada (la hora queda sobre un degradado gris)
  const vidrio = await p.evaluate(() => THEMES.map(t => {
    applyTheme(t.id);
    const cs = getComputedStyle(document.querySelector(".topbar"));
    const solido = /^rgb\(/.test(cs.backgroundColor);
    const sinBlur = !cs.backdropFilter || cs.backdropFilter === "none";
    return solido && sinBlur ? null : `${t.id}: ${cs.backgroundColor} ${cs.backdropFilter}`;
  }).filter(Boolean));
  await p.evaluate(() => applyTheme(STATE.settings.theme));
  ok(!vidrio.length, "barra de arriba sólida y sin desenfoque en todos los temas " + vidrio.join(", "));
  await ctx.close();
};
