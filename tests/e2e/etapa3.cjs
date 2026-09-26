/* Pruebas en navegador · Menú personalizable, Semana, recurrentes, registro futuro y gestos */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T09:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "etapa3@test.cl");

  // Menú: ocultar y volver a mostrar un módulo (sus datos quedan)
  await p.evaluate(() => { STATE.vida.listas.push({ id: "l1", nombre: "Compras", items: [] }); saveState(); buildNav(); });
  ok(await p.locator('#nav [data-route="listas"]').count() === 1, "Listas está en el menú");
  await p.evaluate(() => openPersonalizarMenu());
  await p.locator('.menu-mod[value="listas"]').uncheck();
  await p.click('[data-action="menu-guardar"]'); await p.waitForTimeout(200);
  ok(await p.locator('#nav [data-route="listas"]').count() === 0 && await p.evaluate(() => STATE.vida.listas.length) === 1, "ocultar Listas la saca del menú sin borrar sus datos");
  await p.evaluate(() => openPersonalizarMenu());
  await p.locator('.menu-mod[value="listas"]').check();
  await p.click('[data-action="menu-guardar"]'); await p.waitForTimeout(200);
  ok(await p.locator('#nav [data-route="listas"]').count() === 1, "se puede volver a mostrar");

  // Recurrentes
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  await p.click('[data-action="rec-open"]'); await p.waitForTimeout(150);
  await p.fill("#rec-txt", "Reunión de equipo");
  await p.locator('.rec-dia[value="2"]').check();                  // lunes (ya marcado) y miércoles
  await p.click('[data-action="rec-save"]'); await p.waitForTimeout(250);
  let s = await p.evaluate(() => STATE);
  const recs = ["2026-09-28", "2026-09-30", "2026-10-05", "2026-10-07"].map(d => (s.agenda.dias[d] || []).filter(t => t.recurrente && !t.borrada).length);
  ok(recs.join() === "1,1,1,1", "la regla lunes y miércoles crea sus tareas de las próximas 2 semanas: " + recs.join());
  await p.evaluate(() => closeModal());
  ok(await p.locator('.week-col .tarea-row', { hasText: "Reunión de equipo" }).count() === 2, "la pantalla Semana las muestra con 🔁");
  await p.click('[data-action="rec-open"]'); await p.click('[data-action="rec-del"]'); await p.waitForTimeout(250);
  s = await p.evaluate(() => STATE);
  ok(!(s.agenda.dias["2026-10-07"] || []).some(t => t.recurrente && !t.borrada) && s.agenda.recurrentes[0].borrada, "borrar la regla quita sus tareas futuras");
  await p.evaluate(() => closeModal());

  // Registro futuro
  await p.evaluate(() => { nuevaTarea(STATE, "2026-11-12", { txt: "Renovar el pasaporte", ambito: "per" }); saveState(); rerender(); });
  await p.locator("details.hb-more summary", { hasText: "Más adelante" }).click();
  const fut = await p.locator("details.hb-more", { hasText: "Más adelante" }).innerText();
  ok(/noviembre/i.test(fut) && fut.includes("Renovar el pasaporte"), "'Más adelante' muestra lo programado agrupado por mes");
  await p.locator('[data-action="sem-ir"]').first().click(); await p.waitForTimeout(200);
  ok((await p.locator(".sem-nav__t").innerText()).includes("9 al 15 de noviembre"), "'Ver semana' lleva a esa semana");
  await shot(p, "etapa3-semana", { fullPage: true });
  await ctx.close();
};
