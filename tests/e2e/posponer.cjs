/* Pruebas en navegador · Posponer y bandeja */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  // Día 1 (mié 23): abrir con tareas y cerrar decidiendo cada pendiente
  let ctx = await nuevoContexto(b, { fecha: "2026-09-23T20:00:00" });
  let p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f2@test.cl");
  await p.evaluate(() => openRitualModal());
  await p.fill("#r-sapo", "Enviar propuesta");
  await p.fill("#r-tareas-pro", "Revisar contrato\nLlamar a proveedor\nInforme mensual");
  await p.fill("#r-tareas-per", "Pagar luz\nComprar pan");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(200);
  await p.evaluate(() => openCierreModal());
  const filas = await p.locator("#c-triage .triage-row").count();
  ok(filas === 6, "el cierre lista las 6 pendientes (bocado primero): " + filas);
  const fila = txt => p.locator("#c-triage .triage-row", { hasText: txt });
  await fila("Revisar contrato").locator('button[data-v="hecha"]').click();
  await fila("Llamar a proveedor").locator('button[data-v="delegar"]').click();
  await fila("Llamar a proveedor").locator(".tr-quien").fill("Ana");
  await fila("Comprar pan").locator('button[data-v="soltar"]').click();
  await fila("Informe mensual").locator('button[data-v="otro"]').click();
  await fila("Informe mensual").locator(".tr-fecha").fill("2026-09-30");
  await shot(p, "f2-cierre", { fullPage: true });
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(300);
  let s = await p.evaluate(() => STATE);
  const d23 = s.agenda.dias["2026-09-23"], est = txt => d23.find(t => t.txt === txt).estado;
  ok(est("Revisar contrato") === "hecha" && est("Llamar a proveedor") === "delegada" && est("Comprar pan") === "soltada"
    && est("Informe mensual") === "programada" && est("Enviar propuesta") === "migrada" && est("Pagar luz") === "migrada", "cada decisión queda marcada en su día");
  ok(s.agenda.dias["2026-09-24"].length === 2 && s.agenda.dias["2026-09-30"].length === 1, "copias en mañana (2) y en el 30 (1)");
  ok(s.agenda.dias["2026-09-24"].find(t => t.txt === "Enviar propuesta").bocadoSugerido === true, "el bocado no dado queda sugerido para mañana");
  const ct = s.ritual.dias["2026-09-23"].cierre;
  ok(ct.sapo === false && ct.tareas.migradas === 2 && ct.tareas.programadas === 1 && ct.tareas.hechas === 1, "cierre guarda el resumen: " + JSON.stringify(ct.tareas));
  ok(s.gamif.ledger.some(m => m.id === "tarea:" + d23.find(t => t.txt === "Revisar contrato").id), "'La hice' da la moneda de la tarea");
  const guardado = await p.evaluate(() => JSON.stringify(STATE));
  await ctx.close();

  // Día 2 (jue 24): apertura con sugerencia de bocado y "vienen de días anteriores"
  ctx = await nuevoContexto(b, { fecha: "2026-09-24T08:00:00" });
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f2b@test.cl");
  await p.evaluate(j => { STATE = migrate(JSON.parse(j)); saveState(); rerender(); }, guardado);
  await p.evaluate(() => openRitualModal());
  const sapoVal = await p.inputValue("#r-sapo");
  const vienenTxt = await p.locator(".vienen").textContent().catch(() => "");
  ok(sapoVal === "Enviar propuesta", "apertura sugiere el bocado de ayer: " + sapoVal);
  ok(vienenTxt.includes("Pagar luz"), "muestra 'Vienen de días anteriores'");
  await shot(p, "f2-apertura");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  const d24 = s.agenda.dias["2026-09-24"];
  ok(d24.length === 2 && d24.find(t => t.txt === "Enviar propuesta").esSapo === true && !d24.find(t => t.txt === "Enviar propuesta").bocadoSugerido, "al guardar, la sugerencia se vuelve el bocado (sin duplicar)");
  // ↪ posponer puntual dos veces más para llegar al aviso de 3 migraciones
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await p.click('#view .tarea-row:has-text("Pagar luz") [data-action="tarea-posponer"]');
  await p.click('[data-action="posponer-save"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.agenda.dias["2026-09-25"].find(t => t.txt === "Pagar luz").migraciones === 2, "↪ posponer desde Inicio suma la 2.ª postergación");
  // deshacer
  await p.click('#view .tarea-row:has-text("Pagar luz") [data-action="tarea-deshacer"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.agenda.dias["2026-09-24"].find(t => t.txt === "Pagar luz").estado === "pendiente" && !(s.agenda.dias["2026-09-25"] || []).some(t => !t.borrada), "↶ deshacer devuelve la tarea");
  var guardado2 = await p.evaluate(() => JSON.stringify(STATE));
  await ctx.close();

  // Día 4 (sáb 26), sin cerrar el 24 ni el 25: bandeja y aviso de tarea crónica
  ctx = await nuevoContexto(b, { fecha: "2026-09-26T15:00:00" });
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f2c@test.cl");
  await p.evaluate(j => { STATE = migrate(JSON.parse(j)); const t = STATE.agenda.dias["2026-09-24"].find(t => t.txt === "Pagar luz"); t.migraciones = 2; saveState(); rerender(); }, guardado2);
  const band = await p.locator(".bandeja").textContent();
  ok(band.includes("2 pendientes"), "bandeja en Inicio: " + band.trim().split("\n")[0]);
  await p.click('#view [data-action="bandeja-open"]'); await p.waitForTimeout(200);
  const alerta = await p.locator(".triage-alerta").count();
  ok(alerta === 1, "aviso de 3.ª postergación en 'Pagar luz'");
  await shot(p, "f2-bandeja");
  await p.locator('.triage-row:has-text("Pagar luz") .tr-paso').fill("Buscar la boleta de la luz");
  await p.click('[data-action="bandeja-save"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  const hoyL = s.agenda.dias["2026-09-26"];
  ok(hoyL.some(t => t.txt === "Buscar la boleta de la luz" && t.migraciones === 3), "partir en un paso más chico conserva la cadena (↪ 3)");
  ok(!(await p.locator(".bandeja").count()), "la bandeja desaparece al resolver");
  await shot(p, "f2-inicio", { fullPage: true });
};
