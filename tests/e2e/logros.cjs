/* Pruebas en navegador · Logros: insignias con niveles, secretas, títulos con insignia y tu elefante */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T23:57:00", w: 1280, h: 860 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "logros@test.cl");
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-test", 3000, 900, "test"); STATE.ritual.dias["2026-09-28"] = { hecho: true, mision: "x" }; saveState(); });

  // Búho (secreta): cerrar a las 23:57
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  await p.evaluate(() => openCierreModal("2026-09-28")); await p.waitForTimeout(300);
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.gamif.badges.includes("buho") && STATE.ritual.dias["2026-09-28"].cerradoTs > 0), "cerrar a las 23:57 gana la insignia secreta Búho");

  // Recompensas: series con niveles y secretas ocultas
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(400);
  const txt = await p.locator("body").innerText();
  ok(txt.includes("Búho") && txt.includes("???"), "la secreta ganada se ve y las demás aparecen como ???");
  ok(await p.locator(".badge-niveles").count() === 7, "las 7 series muestran bronce, plata y oro");
  ok((await p.locator(".ele-card").first().innerText()).includes("Joven"), "el elefante está en etapa Joven con 900 XP");
  await shot(p, "recompensas-logros", { fullPage: true });

  // Título que pide insignia
  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  ok(await p.locator('[data-action="cos-buy"][data-id="tit-estratega"]').count() === 0, "sin la insignia Estratega no se puede comprar su título");
  await p.evaluate(() => { STATE.gamif.badges.push("estratega"); saveState(); rerender(); }); await p.waitForTimeout(200);
  await p.click('[data-action="cos-buy"][data-id="tit-estratega"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => isOwned("tit-estratega")), "con la insignia, el título se compra");

  await ctx.close();
};
