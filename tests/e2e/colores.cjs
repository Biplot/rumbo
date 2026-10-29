/* Pruebas en navegador · Un solo botón principal (la aguja ámbar de Norte) por pantalla, y las barras de cada tema */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const coral = p => p.evaluate(() => [...document.querySelectorAll("#view .btn--primary")].map(x => x.dataset.action));
  const borde = p => p.evaluate(() => [...document.querySelectorAll("#view .btn--borde")].map(x => x.dataset.action));

  // 1) Inicio con el día por abrir y el trimestre por abrir: manda «Abre tu día», el trimestre queda con borde
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-15T09:20:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "colores@test.cl");
  await p.evaluate(() => { STATE.settings.theme = "norte"; saveState(); applyTheme("norte"); });
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

  // 4) Barras: en Norte, la de arriba en tinta índigo (la hora del iPhone va en blanco) y la de abajo blanca; en Norte noche, índigo noche
  const fondos = () => p.evaluate(() => [".topbar", ".bottombar"].map(s => getComputedStyle(document.querySelector(s)).backgroundColor));
  const [top, bottom] = await fondos();
  ok(top === "rgb(22, 26, 46)" && bottom === "rgb(255, 255, 255)", `Norte: barra de arriba en tinta índigo y la de abajo blanca (${top} · ${bottom})`);
  await p.evaluate(() => { STATE.settings.theme = "norte-noche"; saveState(); applyTheme("norte-noche"); rerender(); });
  const [topN, bottomN] = await fondos();
  ok(topN === "rgb(12, 15, 30)" && bottomN === "rgb(20, 25, 50)", `Norte noche: barras en índigo noche (${topN} · ${bottomN})`);

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

  // 6) El fondo de base de la página (html) es del color de la barra de arriba: en la app instalada,
  //    iOS tiñe con él el difuminado bajo la hora. El fondo del contenido va en .app.
  const lienzo = await p.evaluate(() => THEMES.map(t => {
    applyTheme(t.id);
    const bg = el => getComputedStyle(el).backgroundColor;
    const html = bg(document.documentElement), barra = bg(document.querySelector(".topbar")), body = bg(document.body);
    return html === barra && body === "rgba(0, 0, 0, 0)" ? null : `${t.id}: html ${html} · barra ${barra} · body ${body}`;
  }).filter(Boolean));
  ok(!lienzo.length, "el fondo de base de la página es del color de la barra en todos los temas " + lienzo.join(", "));
  const claro = await p.evaluate(() => {
    applyTheme("norte");
    const r = [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.querySelector(".app")).backgroundColor];
    document.getElementById("authScreen").hidden = false;
    r.push(getComputedStyle(document.documentElement).backgroundColor);
    document.getElementById("authScreen").hidden = true;
    applyTheme(STATE.settings.theme);
    return r;
  });
  ok(claro[0] === "rgb(22, 26, 46)" && claro[1] === "rgb(245, 246, 250)", `Norte: base en tinta índigo y contenido claro (${claro[0]} · ${claro[1]})`);
  ok(claro[2] === "rgb(245, 246, 250)", `Norte: con la pantalla de ingreso, la base toma su fondo (${claro[2]})`);
  await ctx.close();
};
