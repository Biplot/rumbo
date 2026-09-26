/* Pruebas en navegador · Datos por año y selector ‹ año › */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-20T10:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "anios@test.cl");
  await p.evaluate(() => { STATE.settings.year = 2026; STATE.finanzas.metaAnual = 2400000; STATE.finanzas.meses[10].ingreso = 900000; STATE.ritual.dias["2026-11-19"] = { hecho: true, cerrado: true, ts: 1 }; saveState(); });

  // Finanzas: mirar 2027 no guarda nada; escribir sí, y 2026 queda intacto
  await p.goto(URL + "#finanzas"); await p.waitForTimeout(300);
  ok(await p.locator(".anio-nav b").innerText() === "2026", "Finanzas parte en el año actual (2026)");
  await p.click('.anio-nav [data-dir="1"]'); await p.waitForTimeout(200);
  let s = await p.evaluate(() => STATE);
  ok(await p.locator(".anio-nav b").innerText() === "2027" && !s.anios[2027], "se puede ver 2027 sin crearlo");
  ok(await p.inputValue('[data-bind="anios.2027.finanzas.metaAnual"]') === "2400000", "la meta de ahorro 2027 parte con la de 2026");
  await p.fill('[data-bind="anios.2027.finanzas.meses.0.ingreso"]', "500000"); await p.press('[data-bind="anios.2027.finanzas.meses.0.ingreso"]', "Tab"); await p.waitForTimeout(250);
  s = await p.evaluate(() => STATE);
  ok(s.anios[2027].finanzas.meses[0].ingreso === 500000 && s.anios[2027].finanzas.ts > 0, "escribir en 2027 crea el año y marca su hora");
  ok(s.finanzas.meses[0].ingreso === 0 && s.finanzas.meses[10].ingreso === 900000, "2026 queda intacto");

  // Objetivos del año siguiente
  await p.goto(URL + "#metas"); await p.waitForTimeout(300);
  ok(await p.locator(".anio-nav b").innerText() === "2027", "el año elegido se mantiene entre pantallas");
  await p.fill("#mt-tri-0", "Lanzar la segunda línea"); await p.click('[data-action="meta-add"][data-bucket="tri"][data-idx="0"]'); await p.waitForTimeout(200);
  s = await p.evaluate(() => STATE);
  ok(s.anios[2027].metas.trimestres[0][0].texto === "Lanzar la segunda línea" && s.metas.trimestres[0].length === 0, "las metas de 2027 van a 2027");
  await p.click('#view [data-action="meta-toggle"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.anios[2027].metas.trimestres[0][0].done) === true, "marcar una meta de 2027 funciona");
  await p.click('.anio-nav [data-dir="0"]'); await p.waitForTimeout(200);
  ok(await p.locator(".anio-nav b").innerText() === "2026", "“Ir a 2026” vuelve al año actual");

  // Salud, Rueda, Hábitos anual, Calendario y Tendencias con selector
  for (const r of ["salud", "rueda", "calendario", "tendencias"]) {
    await p.goto(URL + "#" + r); await p.waitForTimeout(200);
    ok(await p.locator(".anio-nav").count() === 1, `${r} tiene selector de año`);
  }
  await p.goto(URL + "#rueda"); await p.waitForTimeout(200);
  await p.click('.anio-nav [data-dir="1"]'); await p.waitForTimeout(200);
  await p.locator('[data-bind="anios.2027.rueda.meses.10.0"]').fill("8"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => STATE.anios[2027].rueda.meses[10][0]) === 8, "la rueda de 2027 se guarda en 2027");
  await p.goto(URL + "#tendencias"); await p.waitForTimeout(300);
  ok(/Comparado con 2026/.test(await p.locator("#view").innerText()), "Tendencias de 2027 se compara con 2026");
  await shot(p, "anios-tendencias", { fullPage: true });
  await ctx.close();
};
