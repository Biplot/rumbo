/* Pruebas en navegador · Cerrar el día de ayer: durante todo el día siguiente, y aunque no lo hayas abierto */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const caso = async (hora, email, prep) => {
    const c = await nuevoContexto(b, { fecha: "2026-10-06T" + hora, w: 390, h: 844 });
    const p = await c.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
    await registrar(p, email);
    await p.evaluate(prep); await p.waitForTimeout(200);
    return { c, p };
  };
  const tarjeta = '#view [data-action="day-close"][data-date="2026-10-05"]';

  // 1) Ayer abierto y sin cerrar: a las 15:00 todavía se puede cerrar
  let { c, p } = await caso("15:00:00", "ayer-tarde@test.cl", () => { STATE.ritual.dias["2026-10-05"] = { hecho: true, mision: "x", ts: 1 }; saveState(); rerender(); });
  ok(await p.locator(tarjeta).count() === 1, "en la tarde de hoy aparece 'Te quedó un día por cerrar'");
  await p.click(tarjeta); await p.waitForTimeout(250);
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.ritual.dias["2026-10-05"].cerrado === true), "ayer queda cerrado");
  ok(await p.locator(tarjeta).count() === 0, "la tarjeta desaparece al cerrarlo");
  await p.goto(URL + "#ritual"); await p.waitForTimeout(300);
  ok(await p.locator(tarjeta).count() === 0, "tampoco aparece en Ritual");
  await c.close();

  // 2) Ayer sin abrir pero con una tarea: se puede cerrar igual (express)
  ({ c, p } = await caso("09:00:00", "ayer-sin-abrir@test.cl", () => { nuevaTarea(STATE, "2026-10-05", { txt: "Llamar al banco", ambito: "per" }); saveState(); rerender(); }));
  ok(await p.locator(tarjeta).count() === 1 && (await p.locator("#view").innerText()).includes("No lo abriste"), "ayer sin abrir pero usado: también se ofrece cerrarlo");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('#view [data-action="day-close-express"][data-date="2026-10-05"]'); await p.waitForTimeout(250);
  await p.click('#modal [data-action="express-cierre-save"]'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => STATE.ritual.dias["2026-10-05"]);
  ok(r && r.cerrado && r.hecho && r.sinApertura, "queda cerrado y marcado como día sin apertura");
  ok(await p.evaluate(a => STATE.gamif.puntos > a, antes), "el cierre da sus ⭐");
  ok(await p.evaluate(() => tareasDelDia("2026-10-06").some(t => t.txt === "Llamar al banco")), "la tarea pendiente de ayer pasa a hoy");
  await c.close();

  // 3) Holgura de 3 días: anteayer y el 3 se ofrecen (el más antiguo primero); el 2, ya no
  ({ c, p } = await caso("20:00:00", "holgura@test.cl", () => {
    ["2026-10-02", "2026-10-03", "2026-10-04"].forEach(d => { STATE.ritual.dias[d] = { hecho: true, ts: 1 }; });
    nuevaTarea(STATE, "2026-10-03", { txt: "Pendiente del viernes", ambito: "per" });
    saveState(); rerender(); }));
  const fechas = await p.locator('#view [data-action="day-close"][data-date]').evaluateAll(xs => xs.map(x => x.dataset.date));
  ok(JSON.stringify(fechas) === JSON.stringify(["2026-10-03", "2026-10-04"]), "se ofrecen los días de la holgura, del más antiguo al más reciente: " + fechas);
  ok((await p.locator("#view").innerText()).includes("Te quedaron 2 días por cerrar"), "la tarjeta dice cuántos quedan");
  await p.click('#view [data-action="day-close"][data-date="2026-10-03"]'); await p.waitForTimeout(250);
  ok(await p.locator('#modal .triage-row button.is-active[data-v="hoy"]').count() === 1, "las pendientes de un día pasado van a hoy (no a otro día pasado)");
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.ritual.dias["2026-10-03"].cerrado && tareasDelDia("2026-10-06").some(t => t.txt === "Pendiente del viernes")), "se cierra el 3 y su pendiente queda para hoy");
  ok(await p.evaluate(() => { openCierreModal("2026-10-02"); return document.getElementById("modalBody").innerText.length > 0; }), "un día abierto de antes se sigue pudiendo cerrar desde la Bitácora");
  await c.close();

  // 4) Sin nada ayer: no se ofrece
  ({ c, p } = await caso("09:00:00", "ayer-nada@test.cl", () => { STATE.ritual.dias["2026-10-01"] = { hecho: true, ts: 1 }; saveState(); rerender(); }));
  ok(await p.locator('#view [data-action="day-close"][data-date]').count() === 0, "sin actividad en los últimos 3 días (o un día abierto más antiguo) no aparece");
  await c.close();
};
