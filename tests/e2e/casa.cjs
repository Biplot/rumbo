/* Pruebas en navegador · La casa del elefante: el cuarto en Tu casa (ya no está en Recompensas), tu elefante en
   3D sobre la alfombra, la repisa (tocar una medalla la abre de cerca; elegir cuáles) y la versión sin WebGL */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const GANADAS = ["primer-paso", "semana-fuego", "inquebrantable", "explorador", "estratega", "anio-rumbo", "elefante-domado", "elefante-domado-p", "buho"];
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(ids => {
    ledgerRegistrar(STATE, "xp-test", 0, 2500, "test");   // Imparable: planta, reloj y biblioteca
    ids.forEach((id, i) => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 1, 1, "Insignia", new Date(2026, 8, 1 + i, 21).getTime()); });
    STATE.lecturas.push({ id: "l1", titulo: "Uno", estado: "terminado" }, { id: "l2", titulo: "Dos", estado: "terminado" });
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
    await preparar(p, "casa@test.cl");
    await p.goto(URL + "#recompensas"); await p.waitForTimeout(400);
    ok(await p.locator("#view .casa, #view .ele-card, #casaLienzo").count() === 0, "Recompensas ya no tiene el cuarto: vive en Tu casa");
    await p.goto(URL + "#cuarto");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    ok(await p.locator("#lugarLienzo .cielo__canvas").count() === 1, "Tu casa muestra el cuarto del elefante en 3D");
    ok(await p.evaluate(() => { const e = CIELO_ESTADO.motor.cuarto().elefante; return e && e.tipo === "clasico" && e.etapa === 1; }), "tu elefante vive en 3D sobre la alfombra (el Clásico, en su etapa Joven)");
    const pie = await p.locator("#lugarHoja").innerText();
    ok(pie.includes("4 de 7") && pie.includes("Próximo: 🐷") && pie.includes("Maestro"), "dice cuánto tiene el cuarto y qué llega con el próximo rango");
    ok((await p.locator("#lugarHoja .hoja__t").innerText()).includes("Joven"), "la ficha de tu elefante sigue igual (etapa Joven)");
    await shot(p, "casa-3d");

    // La repisa: tocar la primera medalla la abre de cerca
    const pt = await p.evaluate(() => { const q = CIELO_ESTADO.motor.dondeRepisa(0), r = document.getElementById("lugarLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
    if (pt) await p.mouse.click(pt.x, pt.y);
    await p.waitForTimeout(600);
    ok(await titulo(p) === "Año con Rumbo", "tocar la medalla de oro de la repisa la abre de cerca");
    await p.keyboard.press("Escape"); await p.waitForTimeout(500);
    ok(await p.locator("#insCerca").isHidden() && await p.locator("#lugarLienzo .cielo__canvas").count() === 1, "al cerrar, el lienzo vuelve al cuarto");

    // Elegir las medallas de la repisa
    await p.click('#lugarHoja [data-action="repisa-elegir"]'); await p.waitForTimeout(300);
    ok((await p.locator("#modalTitle").innerText()) === "Tu repisa" && await p.locator(".repisa-sel__b.is-on").count() === 5, "🏅 Repisa abre el selector con las 5 de ahora marcadas");
    for (const id of ["anio-rumbo", "buho", "elefante-domado-p", "estratega", "explorador"]) await p.click(`.repisa-sel__b[data-id="${id}"]`).catch(() => {});
    await p.click('.repisa-sel__b[data-id="primer-paso"]'); await p.click('.repisa-sel__b[data-id="inquebrantable"]');
    await p.click('#modal [data-action="repisa-guardar"]'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => repisaIds(STATE).join(",") === "primer-paso,inquebrantable" && STATE.gamif.equipped.repisa.ts > 0), "la repisa queda con las elegidas, en ese orden");
    const libre = await p.evaluate(() => { const q = CIELO_ESTADO.motor.dondeRepisa(3), r = document.getElementById("lugarLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
    if (libre) await p.mouse.click(libre.x, libre.y);
    await p.waitForTimeout(400);
    ok((await p.locator("#modalTitle").innerText().catch(() => "")) === "Tu repisa", "tocar un lugar libre de la repisa abre el selector");
    await p.click('#modal [data-action="repisa-auto"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => repisaIds(STATE)[0] === "anio-rumbo" && STATE.gamif.equipped.repisa.auto), "«Que elija sola» vuelve a las mejores");

    // Tocar al elefante reacciona (no abre la pantalla completa); subir de rango trae la alcancía
    const ele = await p.evaluate(() => { const q = CIELO_ESTADO.motor.dondeElefante(), r = document.getElementById("lugarLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
    if (ele) await p.mouse.click(ele.x, ele.y);
    await p.waitForTimeout(150);
    ok(await p.evaluate(() => CIELO_ESTADO.motor.cuarto().reaccion && CURRENT === "cuarto"), "tocar al elefante lo hace reaccionar");
    await p.waitForTimeout(1500);
    await p.evaluate(() => { ledgerRegistrar(STATE, "xp-test-2", 0, 1600, "test"); saveState(); rerender(); }); await p.waitForTimeout(500);
    ok((await p.locator("#lugarHoja").innerText()).includes("5 de 7") && await p.evaluate(() => casaCosas(STATE).includes("alcancia")), "al llegar a Maestro el cuarto gana la mesita con alcancía");
    await ctx.close(); await b3.close();
  }

  // 2) Sin WebGL, en el celular: Tu casa como página, con tu elefante dibujado y la repisa como fila de medallas
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T21:30:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "casa-plana@test.cl");
    await p.goto(URL + "#cuarto"); await p.waitForTimeout(2500);
    ok(await p.locator(".lugar-plano .ele-svg").isVisible() && await p.locator("#lugarLienzo").count() === 0, "sin WebGL, Tu casa muestra a tu elefante dibujado, sin el cuarto 3D");
    const chips = p.locator(".lugar-plano .recibo__meds-l .med-chip");
    ok(await chips.count() === 5, "la repisa se ve como una fila de 5 medallas");
    await chips.first().click(); await p.waitForTimeout(400);
    ok(await titulo(p) === "Año con Rumbo" && await p.locator("#insCercaPlano .ins-plano--oro").isVisible(), "tocar una la abre de cerca (medalla plana)");
    await shot(p, "casa-plana-celular");
    await ctx.close();
  }
};
