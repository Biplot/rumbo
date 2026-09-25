/* Pruebas en navegador · Registro diario */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b); const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f1@test.cl");
  await p.click('#view [data-action="day-open"]');
  await p.fill("#r-sapo", "Enviar propuesta");
  await p.fill("#r-tareas-pro", "Revisar contrato\nPreparar reunión");
  await p.fill("#r-tareas-per", "Comprar pan");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(300);
  let s = await p.evaluate(() => STATE);
  const d = s.agenda.dias["2026-09-23"];
  ok(d.length === 4 && d.find(t => t.esSapo).txt === "Enviar propuesta", "apertura escribe en el registro diario (" + d.length + ")");
  await p.click('#view .check[data-action="tarea-toggle"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.agenda.dias["2026-09-23"].some(t => t.estado === "hecha") && s.gamif.ledger.some(m => m.id.startsWith("tarea:")), "marcar tarea: estado hecha + moneda");
  // reabrir apertura y quitar una línea → se borra (marcada)
  await p.click('#view [data-action="day-close"]').catch(() => {});
  await p.evaluate(() => closeModal());
  await p.evaluate(() => openRitualModal());
  await p.fill("#r-tareas-pro", "Revisar contrato");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.agenda.dias["2026-09-23"].find(t => t.txt === "Preparar reunión").borrada === true, "quitar línea en la apertura marca la tarea como borrada");
  // Planificador: navegar y agregar en la semana siguiente
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  await p.click('#view [data-action="sem-nav"][data-dir="1"]'); await p.waitForTimeout(200);
  const titulo = await p.locator(".sem-nav__t").textContent();
  await p.fill("#sem-0", "Planificada para el lunes");
  await p.click('#view [data-action="tarea-add"][data-fecha="2026-09-28"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(titulo.includes("28") && s.agenda.dias["2026-09-28"].length === 1, "planificador navega y agrega a otra semana: " + titulo.trim());
  await p.fill("#sem-premio", "Asado"); await p.press("#sem-premio", "Tab"); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.ritual.semanas["2026-09-28"].plan.premio === "Asado", "premio por semana");
  await shot(p, "f1-planner");
  // Cierre
  await p.goto(URL + "#inicio"); await p.waitForTimeout(200);
  await p.evaluate(() => openCierreModal());
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => STATE);
  const ct = s.ritual.dias["2026-09-23"].cierre.tareas;
  ok(ct && ct.planificadas === 3 && ct.hechas === 1 && ct.pro[1] === 2, "cierre guarda resumen extendido " + JSON.stringify(ct));
  await shot(p, "f1-inicio", { fullPage: true });
};
