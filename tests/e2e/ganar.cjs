/* Pruebas en navegador · El momento de ganar: al cerrar el día la medalla llega y sube a su constelación,
   el recibo muestra las medallas de hoy (o la más cercana) y fuera del cierre un aviso que se toca */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(() => {
    localStorage.removeItem("rumbo-sin-escenas");   // aquí sí se ven las escenas
    STATE.ritual.dias[todayISO()] = { hecho: true, mision: "Probar el cielo", abiertoTs: Date.now(), ts: Date.now() };
    saveState();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
}
async function cerrarDia(p) {
  await p.evaluate(() => openCierreModal(todayISO())); await p.waitForTimeout(300);
  await p.click('#modal [data-action="cierre-save"]');
}
const titulo = p => p.locator("#insCercaT").innerText().catch(() => "");
module.exports = async ({ b, ok, errs }) => {
  // 1) Con 3D: cerrar el primer día trae Primer Paso
  {
    const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T21:00:00", w: 1280, h: 860 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "ganar@test.cl");
    await cerrarDia(p);
    await p.waitForSelector("#insCerca.is-ganar:not([hidden])", { timeout: 6000 }).catch(() => {});
    ok(await titulo(p) === "Primer Paso" && (await p.locator(".ins-cerca__fam").textContent()).includes("¡Medalla nueva!"), "al cerrar el día aparece el momento de ganar con Primer Paso");
    ok(await p.locator("#eleEscena").count() === 0, "con medalla nueva, el momento reemplaza la escena del elefante");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#insCercaLienzo .cielo__canvas"), null, { timeout: 15000 }).catch(() => {});
    ok(await p.locator("#insCercaLienzo .cielo__canvas").count() === 1, "la medalla llega en 3D");
    ok((await p.locator("#insCercaFicha").innerText()).includes("La Copa · 1 de 4"), "la ficha dice que se encendió su estrella en La Copa");
    await p.waitForTimeout(6000);   // llega, se luce y sube a su constelación
    await shot(p, "ganar-3d");
    await p.click('#insCerca [data-c="listo"]'); await p.waitForTimeout(400);
    ok(await p.locator("#insCerca").isHidden() && await p.evaluate(() => (JSON.parse(localStorage.getItem("rumbo-cielo-visto")) || []).includes("primer-paso")), "Listo cierra y la medalla queda vista en tu cielo");
    const recibo = await p.locator(".recibo__meds").innerText().catch(() => "");
    ok(recibo.includes("Medalla de hoy") && recibo.includes("Primer Paso"), "el recibo del día muestra la medalla de hoy");
    await p.click('.recibo__meds [data-id="primer-paso"]'); await p.waitForTimeout(500);
    ok(await titulo(p) === "Primer Paso" && !(await p.locator("#insCerca").getAttribute("class")).includes("is-ganar"), "tocarla en el recibo la abre de cerca");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);

    // 2) Fuera del cierre: terminar tres libros de una trae dos medallas, con un aviso que se toca
    await p.evaluate(() => { STATE.lecturas.push(...[1, 2, 3].map(i => ({ id: "lib" + i, titulo: "Libro " + i, estado: "terminado" }))); saveState(); rerender(); });
    await p.waitForTimeout(500);
    ok(await p.locator("#insAviso").isVisible() && (await p.locator("#insAviso").innerText()).includes("2 medallas nuevas"), "al ganar fuera del cierre sale un aviso de medalla nueva");
    await p.click("#insAviso"); await p.waitForTimeout(600);
    ok(await titulo(p) === "Página Uno" && (await p.locator(".ins-cerca__fam").textContent()).includes("1 de 2"), "tocarlo abre el momento de la primera (1 de 2)");
    await p.click('#insCerca [data-c="siguiente"]'); await p.waitForTimeout(600);
    ok(await titulo(p) === "Devorador de Libros" && await p.locator('#insCerca [data-c="listo"]').count() === 1, "Siguiente medalla pasa a la otra y termina en Listo");
    await p.click('#insCerca [data-c="alcielo"]'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => location.hash) === "#cielo" && await p.locator("#insCerca").isHidden(), "Ver en tu cielo abre tu cielo a pantalla completa");
    await p.waitForTimeout(3500);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo-cielo-visto")).includes("devorador")), "allá llegan como estrella fugaz y quedan vistas");
    await ctx.close(); await b3.close();
  }

  // 3) Sin WebGL, en el celular: la medalla plana llega igual y el recibo muestra la más cercana al día siguiente
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T21:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "ganar-plano@test.cl");
    await cerrarDia(p);
    await p.waitForSelector("#insCerca.is-ganar:not([hidden])", { timeout: 6000 }).catch(() => {});
    ok(await titulo(p) === "Primer Paso" && await p.locator("#insCercaPlano .ins-plano.is-gana").isVisible(), "sin 3D, la medalla plana llega con su animación");
    await shot(p, "ganar-plano-celular");
    await p.click('#insCerca [data-c="listo"]'); await p.waitForTimeout(300);
    // Si hoy no ganaste ninguna, el recibo muestra la que tienes más cerca
    await p.evaluate(() => { const m = STATE.gamif.ledger.find(x => x.id === "insignia:primer-paso"); m.ts -= 86400000; saveState(); rerender(); });
    await p.waitForTimeout(300);
    const cerca = await p.locator(".recibo__cerca").innerText().catch(() => "");
    ok(cerca.includes("Lo más cerca") && cerca.includes("Semana de Fuego") && cerca.includes("1 de 7"), "sin medallas hoy, el recibo muestra la más cercana (Semana de Fuego, 1 de 7)");
    await p.click(".recibo__cerca"); await p.waitForTimeout(400);
    ok(await titulo(p) === "Semana de Fuego", "tocarla la abre de cerca");
    await ctx.close();
  }
};
