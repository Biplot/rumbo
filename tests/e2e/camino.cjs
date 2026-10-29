/* Pruebas en navegador · El camino del año: el sendero en Tendencias con las medallas en su día,
   tocar un hito abre la medalla, compartir la imagen, otros años, el cierre del trimestre y sin WebGL */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const GANADAS = [["primer-paso", 2026, 0, 5], ["semana-fuego", 2026, 1, 3], ["explorador", 2026, 2, 9], ["estratega", 2026, 3, 4],
  ["inquebrantable", 2026, 4, 1], ["devorador", 2026, 6, 7], ["mes-perfecto", 2026, 8, 30], ["buho", 2026, 9, 14], ["madrugador", 2025, 11, 20]];
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(L => {
    L.forEach(([id, y, m, d]) => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 1, 1, "Insignia", new Date(y, m, d, 21).getTime()); });
    STATE.ritual.dias["2025-12-20"] = { hecho: true, cerrado: true };   // 2025 tiene datos: se puede ir a ese año
    saveState();
  }, GANADAS);
}
const titulo = p => p.locator("#insCercaT").innerText().catch(() => "");
module.exports = async ({ b, ok, errs }) => {
  // 1) Con 3D
  {
    const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 1280, h: 900 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "camino@test.cl");
    await p.goto(URL + "#tendencias");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#caminoLienzo .cielo__canvas"), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    const card = p.locator(".camino-card");
    ok(await p.locator("#caminoLienzo .cielo__canvas").count() === 1, "Tendencias muestra el camino del año en 3D");
    ok((await card.locator(".card__hint").innerText()) === "8 medallas hasta hoy", "cuenta las medallas de 2026 (las de 2025 no)");
    ok((await card.locator(".camino__tris").innerText()).replace(/\s+/g, " ").includes("T1 3 T2 2 T3 2 T4 1"), "y cuántas hubo en cada trimestre");
    await card.scrollIntoViewIfNeeded(); await shot(p, "camino-3d");
    // Tocar un hito abre su medalla
    const pt = await p.evaluate(() => { const q = CIELO_ESTADO.motor.dondeHito("mes-perfecto"), r = document.getElementById("caminoLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
    ok(!!pt, "Mes Perfecto tiene su hito en el sendero");
    if (pt) await p.mouse.click(pt.x, pt.y);
    await p.waitForTimeout(600);
    ok(await titulo(p) === "Mes Perfecto", "tocar el hito abre la medalla de cerca");
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    ok(await p.locator("#caminoLienzo .cielo__canvas").count() === 1, "al cerrar, el lienzo vuelve al camino");
    // La lista, con fechas
    await card.locator(".camino__det summary").click(); await p.waitForTimeout(200);
    ok((await card.locator('.camino__det [data-id="buho"]').innerText()).replace(/\s+/g, " ").includes("Búho 14 oct"), "la lista tiene cada medalla con su fecha");
    // Compartir: sin hoja de compartir, se descarga la imagen
    const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), card.locator('[data-action="camino-compartir"]').click()]);
    ok(!!descarga && descarga.suggestedFilename() === "rumbo-camino-2026.png", "Compartir mi camino arma la imagen (se descarga en el computador)");
    // Otro año
    await p.evaluate(() => { ANIO_VISTA = 2025; rerender(); }); await p.waitForTimeout(800);
    ok((await p.locator(".camino-card .card__title").innerText()).includes("2025") && (await p.locator(".camino-card .card__hint").innerText()) === "1 medalla", "con ‹ año › se ve el camino de 2025");
    // El cierre del trimestre muestra sus medallas; tocar una la abre encima de la ventana
    await p.evaluate(() => { openTriCierre("2026-Q3"); triWizMover(1); }); await p.waitForTimeout(400);
    const meds = await p.locator("#modal .cierre-meds").innerText().catch(() => "");
    ok(meds.includes("Medallas del trimestre") && meds.includes("Devorador de Libros") && meds.includes("Mes Perfecto"), "los Números del trimestre traen sus medallas");
    await p.click('#modal .cierre-meds [data-id="devorador"]'); await p.waitForTimeout(500);
    ok(await titulo(p) === "Devorador de Libros" && await p.locator("#insCerca").isVisible(), "tocarla la abre de cerca, encima del cierre");
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    ok(await p.locator("#insCerca").isHidden() && await p.locator("#modalOverlay").isVisible(), "al cerrarla, el cierre del trimestre sigue abierto");
    await ctx.close(); await b3.close();
  }

  // 2) Sin WebGL, en el celular: la lista con fechas y compartir igual funciona
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "camino-plano@test.cl");
    await p.goto(URL + "#tendencias"); await p.waitForTimeout(2500);
    ok(await p.locator(".camino-card.is-sin3d").count() === 1 && await p.locator("#camino").isHidden(), "sin WebGL el camino 3D se esconde");
    await p.locator(".camino-card").scrollIntoViewIfNeeded();
    if (!(await p.locator(".camino__det").getAttribute("open"))) await p.locator(".camino__det summary").click();
    ok(await p.locator(".camino__det .med-chip").count() === 8, "queda la lista de las 8 medallas del año");
    await shot(p, "camino-plano-celular");
    const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click('.camino-card [data-action="camino-compartir"]')]);
    ok(!!descarga, "compartir arma la imagen igual (con el sendero dibujado)");
    await ctx.close();
  }
};
