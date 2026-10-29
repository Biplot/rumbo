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

  // Tu casa y Tu vitrina: tu elefante, y las series con niveles y las secretas ocultas
  await p.goto(URL + "#cuarto"); await p.waitForTimeout(2500);
  ok((await p.locator(".hoja__t").first().innerText()).includes("Joven"), "en Tu casa, el elefante está en etapa Joven con 900 XP");
  await p.goto(URL + "#cielo"); await p.waitForTimeout(2500);
  const txt = await p.locator(".lugar-plano, #lugarHoja").first().innerText();
  ok(txt.includes("Búho") && txt.includes("Secreta"), "en Tu vitrina, la secreta ganada se ve y las demás aparecen como Secreta");
  ok(await p.evaluate(() => SERIES.length === 7 && SERIES.every(se => [0, 1, 2].every(k => document.querySelector(`.med-chip[data-id="${idNivel(se, k)}"]`)))), "las 7 series muestran bronce, plata y oro");
  await shot(p, "vitrina-logros", { fullPage: true });

  // Título que pide insignia (en la Tienda › Para tu estilo › Tu perfil)
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(400);
  await p.click('[data-action="tienda-sec"][data-v="estilo"]'); await p.waitForTimeout(200);
  while (await p.locator('[data-action="tienda-mas"]').count()) { await p.locator('[data-action="tienda-mas"]').first().click(); await p.waitForTimeout(150); }
  ok(await p.locator('.ficha.is-bloqueado[data-est="tit-estratega"]').count() === 1, "sin la insignia Estratega no se puede comprar su título");
  await p.evaluate(() => { STATE.gamif.badges.push("estratega"); saveState(); rerender(); }); await p.waitForTimeout(200);
  await p.click('.ficha[data-est="tit-estratega"]'); await p.waitForTimeout(200);
  await p.click('#modal [data-action="cos-buy"][data-id="tit-estratega"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => isOwned("tit-estratega")), "con la insignia, el título se compra");

  await ctx.close();
};
