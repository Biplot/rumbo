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
  ok(await p.locator(tarjeta).count() === 1 && (await p.locator("#view").innerText()).includes("no abriste tu día"), "ayer sin abrir pero usado: también se ofrece cerrarlo");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('#view [data-action="day-close-express"][data-date="2026-10-05"]'); await p.waitForTimeout(250);
  await p.click('#modal [data-action="express-cierre-save"]'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => STATE.ritual.dias["2026-10-05"]);
  ok(r && r.cerrado && r.hecho && r.sinApertura, "queda cerrado y marcado como día sin apertura");
  ok(await p.evaluate(a => STATE.gamif.puntos > a, antes), "el cierre da sus ⭐");
  ok(await p.evaluate(() => tareasDelDia("2026-10-06").some(t => t.txt === "Llamar al banco")), "la tarea pendiente de ayer pasa a hoy");
  await c.close();

  // 3) Sin nada ayer, o un día de hace más tiempo: no se ofrece
  ({ c, p } = await caso("09:00:00", "ayer-nada@test.cl", () => { STATE.ritual.dias["2026-10-04"] = { hecho: true, ts: 1 }; saveState(); rerender(); }));
  ok(await p.locator('#view [data-action="day-close"][data-date]').count() === 0, "sin actividad ayer (o con un día abierto de antes de ayer) no aparece");
  await c.close();
};
