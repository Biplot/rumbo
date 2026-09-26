/* Pruebas en navegador · Cruce de año: cierre de diciembre y apertura de enero */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  // 31 de diciembre de 2026: cerrar diciembre muestra "Tu 2026 en números"
  let ctx = await nuevoContexto(b, { fecha: "2026-12-31T20:00:00" });
  let p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "cruce@test.cl");
  await p.evaluate(() => {
    STATE.settings.year = 2026;
    STATE.metas.mensuales[11] = [{ id: "d1", texto: "Cerrar el año con 3 clientes", done: false, ambito: "pro", triId: "q4", origen: "ritual-mes", ts: 1 },
      { id: "d2", texto: "Vacaciones planificadas", done: true, ambito: "per", origen: "ritual-mes", ts: 1 }];
    STATE.metas.trimestres[3] = [{ id: "q4", texto: "10 clientes", done: false }];
    STATE.ritual.meses = { "2026-11": { cierre: { nota: 9, ts: 1 } }, "2026-12": { apertura: { foco: "Cierre", ts: 1 } } };
    STATE.finanzas.metaAnual = 1000000; STATE.finanzas.meses[11].ingreso = 300000;
    ["2026-12-29", "2026-12-30"].forEach(d => { STATE.ritual.dias[d] = { hecho: true, cerrado: true, ts: 1 }; });
    saveState(); rerender();
  });
  await p.evaluate(() => openMesCierre("2026-12"));
  for (let i = 0; i < 5; i++) { await p.click('[data-action="mes-next"]'); await p.waitForTimeout(120); }
  const txt = await p.locator("#modalBody").innerText();
  ok(/Paso 6 de 6/i.test(txt) && txt.includes("Tu 2026 en números") && /noviembre/i.test(txt), "el cierre de diciembre termina con 'Tu 2026 en números' (mejor mes: noviembre)");
  await shot(p, "cruce-tu-anio");
  await p.click('[data-action="mes-finish"]'); await p.waitForTimeout(300);
  let s = await p.evaluate(() => STATE);
  ok(s.ritual.meses["2026-12"].cierre.anio && s.ritual.meses["2026-12"].cierre.anio.cerrados === 2 && s.ritual.meses["2026-12"].cierre.anio.objetivos.join() === "1,2", "el resumen del año queda guardado con el cierre");
  const datos = await p.evaluate(() => JSON.stringify(STATE));
  await ctx.close();

  // 2 de enero de 2027: abrir enero arrastra lo no cumplido de diciembre al año nuevo
  ctx = await nuevoContexto(b, { fecha: "2027-01-02T09:00:00" });
  p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "cruce2@test.cl");
  await p.evaluate(j => { STATE = migrate(JSON.parse(j)); saveState(); rerender(); }, datos);
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok((await p.locator("#view").innerText()).includes("Abre Enero"), "el 2 de enero Inicio ofrece abrir enero");
  await p.evaluate(() => openMesApertura("2027-01"));
  await p.click('[data-action="mes-next"]'); await p.waitForTimeout(100);
  await p.fill("#mw-foco", "Arranque"); await p.click('[data-action="mes-next"]'); await p.waitForTimeout(150);
  const arr = p.locator('.mo-arr[value="d1"]');
  ok(await arr.count() === 1 && await p.locator('.mo-arr[value="d2"]').count() === 0, "ofrece arrastrar de diciembre solo lo no cumplido");
  await arr.check();
  await p.fill("#mo-t-0", "Primer cliente de 2027");
  await p.click('[data-action="mes-next"]'); await p.click('[data-action="mes-next"]'); await p.waitForTimeout(150);
  await p.click('[data-action="mes-finish"]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => STATE);
  const ene = s.anios[2027].metas.mensuales[0];
  ok(ene.some(o => o.texto === "Primer cliente de 2027") && ene.some(o => o.arrastrado === "d1" && o.triId === ""), "enero 2027 guarda sus objetivos y el arrastrado (sin vínculo trimestral viejo)");
  ok(s.metas.mensuales[0].length === 0 && s.metas.mensuales[11].length === 2, "enero y diciembre de 2026 quedan intactos");
  await p.goto(URL + "#metas"); await p.waitForTimeout(300);
  ok(await p.locator(".anio-nav b").innerText() === "2027" && (await p.locator("#view").innerText()).includes("Primer cliente de 2027"), "Objetivos parte en 2027 con los objetivos de enero");
  await p.goto(URL + "#tendencias"); await p.waitForTimeout(200);
  await p.click('.anio-nav [data-dir="-1"]'); await p.waitForTimeout(250);
  ok((await p.locator("#view").innerText()).includes("Tu 2026 en números"), "Tendencias de 2026 muestra 'Tu 2026 en números'");
  await ctx.close();
};
