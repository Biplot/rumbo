/* Pruebas en navegador · 💳 Tus deudas (Finanzas, v156): la tarjeta vacía que enseña, anotar, elegir el método al anotar la
   segunda, «Ataca esta», abonar (+10 ⭐ y deshacer), la fecha para quedar libre, saldar con la celebración y la bola de nieve,
   ocultar montos, el cierre del mes, Tendencias, la medalla y que la sección aparezca sola en Más */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-20T10:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await registrar(p, "deudas@test.cl");
  const modal = () => p.locator("#modal").innerText();
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);

  // 1) Sin deudas: una tarjeta que enseña; Finanzas no aparece en tus secciones todavía
  await p.goto(URL + "#finanzas"); await p.waitForTimeout(400);
  ok(/¿Tienes deudas\?/.test(await p.locator("#deudas").innerText()) && await p.locator('#deudas [data-action="deu-nueva"]').count() === 1, "sin deudas, una tarjeta que explica con «+ Anotar una deuda»");
  ok(await p.evaluate(() => !seccionTuya("finanzas")), "Finanzas todavía espera en «Descubrir»");

  // 2) Anotar la primera
  await p.click('#deudas [data-action="deu-nueva"]'); await p.waitForTimeout(250);
  await p.fill("#deu-nombre", "Tarjeta"); await p.fill("#deu-monto", "480.000"); await p.fill("#deu-cuota", "45000");
  await p.click('[data-action="deu-interes"][data-v="alto"]');
  await p.fill("#deu-dia", "5"); await p.locator("#deu-aviso").check();
  await shot(p, "deudas-nueva");
  await p.click('[data-action="deu-guardar"]'); await p.waitForTimeout(400);
  let d = await p.evaluate(() => STATE.deudas.lista[0]);
  ok(d && d.nombre === "Tarjeta" && d.monto === 480000 && d.cuota === 45000 && d.interes === "alto" && d.dia === 5 && d.aviso === true, "queda anotada con su cuota, interés alto, día de pago y aviso");
  ok(await p.evaluate(() => seccionTuya("finanzas")), "con la primera deuda, Finanzas aparece sola en tus secciones");
  ok(/Debes hoy[\s\S]*\$480\.000/.test(await p.locator("#deudas").innerText()), "arriba: «Debes hoy $480.000»");
  ok(await p.locator("#deudas .deu-ataca").count() === 0, "con una sola, no hace falta «Ataca esta»");

  // 3) La segunda: Rumbo pregunta por cuál partir (una vez)
  await p.click('#deudas [data-action="deu-nueva"]'); await p.waitForTimeout(250);
  await p.fill("#deu-nombre", "Préstamo de mi hermana"); await p.fill("#deu-monto", "150000"); await p.fill("#deu-cuota", "75000");
  await p.click('[data-action="deu-interes"][data-v="no"]');
  await p.click('[data-action="deu-guardar"]'); await p.waitForTimeout(400);
  ok((await p.locator("#modalTitle").innerText()) === "¿Por cuál partimos?" && await p.locator('.deu-metodo.is-on[data-v="nieve"]').count() === 1, "con la segunda, «¿Por cuál partimos?» con bola de nieve marcada");
  await shot(p, "deudas-metodo");
  await p.click('[data-action="deu-metodo-ok"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.deudas.metodo) === "nieve" && /Préstamo de mi hermana[\s\S]*Ataca esta/i.test(await p.locator("#deudas").innerText()), "bola de nieve: «Ataca esta» en la más chica");
  await p.evaluate(() => { const D = deudasDatos(); D.metodo = "avalancha"; rerender(); });
  ok(/Tarjeta\s*Ataca esta/i.test(await p.locator("#deudas .deu-lista").innerText()), "avalancha: «Ataca esta» en la de interés alto");
  await p.evaluate(() => { const D = deudasDatos(); D.metodo = "nieve"; saveState(); rerender(); });

  // 4) La fecha para quedar libre: con la suma de las cuotas y con lo que puedes abonar
  ok(/Con \$120\.000 al mes para tus deudas, quedas libre en unos \d+ meses/.test(await p.locator("#deudas .deu-plan").innerText()), "con la suma de las cuotas, la fecha estimada");
  await p.click('#deudas [data-action="deu-abono-cambiar"]'); await p.waitForTimeout(250);
  await p.fill("#deu-abono-mes", "200000"); await p.click('[data-action="deu-abono-mes-ok"]'); await p.waitForTimeout(300);
  ok(/Con \$200\.000 al mes/.test(await p.locator("#deudas .deu-plan").innerText()) && await p.evaluate(() => STATE.deudas.abonoMes) === 200000, "con lo que puedes abonar al mes, la fecha se acerca");
  ok(await ancho() <= 390, "la tarjeta cabe en el celular");
  await shot(p, "deudas-tarjeta", { fullPage: true });

  // 5) Abonar: +10 ⭐, el toast con «Deshacer»
  const pts0 = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('#deudas [data-action="deu-abonar"]'); await p.waitForTimeout(250);
  ok(/¿A cuál\?/.test(await modal()) && await p.locator('#deu-a-cual .fo-chip.is-on').innerText().then(t => t.includes("Préstamo de mi hermana")), "abonar parte en la que atacas");
  await p.fill("#deu-abono", "50000"); await p.click('[data-action="deu-abonar-ok"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => deudaSaldo(STATE.deudas.lista[1])) === 100000 && await p.evaluate(() => STATE.gamif.puntos) === pts0 + 10, "abonar 50 mil baja lo que queda y da +10 ⭐");
  ok(/abonaste \$50\.000 este mes/.test(await p.locator("#deudas").innerText()), "arriba: «abonaste $50.000 este mes»");
  await p.evaluate(() => document.querySelector("#toast .toast__acc").click()); await p.waitForTimeout(300);   // las pruebas esconden los toasts
  ok(await p.evaluate(() => deudaSaldo(STATE.deudas.lista[1])) === 150000 && await p.evaluate(() => STATE.gamif.puntos) === pts0, "«Deshacer» lo quita y devuelve las ⭐");

  // 6) Saldar (anotada un día antes: +100 ⭐), la celebración y la bola de nieve
  await p.evaluate(() => { STATE.deudas.lista[1].creada = new Date(2026, 10, 1, 9).getTime(); saveState(); });
  await p.click('#deudas [data-action="deu-abonar"]'); await p.waitForTimeout(250);
  await p.locator('[data-action="deu-abono-rapido"]', { hasText: "Todo" }).click(); await p.click('[data-action="deu-abonar-ok"]'); await p.waitForTimeout(500);
  ok((await p.locator("#modalTitle").innerText()) === "¡Saldada!" && /Saldaste «Préstamo de mi hermana»/.test(await modal()) && /\+100/.test(await modal()), "saldarla: «¡Saldada!» con +100 ⭐");
  ok(/Los \$75\.000 que le abonabas cada mes, súmalos a «Tarjeta»/.test(await modal()), "la bola de nieve: su cuota, a la siguiente");
  await shot(p, "deudas-saldada");
  await p.click('[data-action="deu-bola"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.deudas.lista[0].cuota) === 120000, "«Sumarlos a Tarjeta»: su cuota sube a $120.000");
  await p.waitForTimeout(1600);
  ok(await p.evaluate(() => STATE.gamif.badges.includes("deuda-saldada")), "la medalla «Primera deuda saldada»");
  ok(/Saldadas \(1\)/.test(await p.locator("#deudas").innerText()), "queda en «Saldadas»");

  // 7) Ocultar montos
  await p.click('#deudas [data-action="deu-ocultar"]'); await p.waitForTimeout(250);
  ok(!/\$480\.000/.test(await p.locator("#deudas").innerText()) && /\$ •••/.test(await p.locator("#deudas").innerText()), "«Ocultar montos»: no se ven las cifras");
  await p.click('#deudas [data-action="deu-ocultar"]'); await p.waitForTimeout(200);

  // 8) Editar: cambiar lo que debes hoy (subió por intereses) queda como ajuste
  await p.click('#deudas .deu-fila'); await p.waitForTimeout(250);
  await p.fill("#deu-saldo", "500000"); await p.click('[data-action="deu-guardar"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => deudaSaldo(STATE.deudas.lista[0])) === 500000, "si subió por intereses, se ajusta lo que debes");

  // 9) El cierre del mes y Tendencias
  await p.evaluate(() => { deudaAbonar(STATE.deudas.lista[0].id, 60000, STATE, "2026-11-18"); saveState(); });
  const cierre = await p.evaluate(() => deudasCierreHtml(2026, 10));
  ok(/Tus deudas en noviembre/.test(cierre) && /Abonaste/.test(cierre) && /Debes/.test(cierre), "el cierre del mes cuenta lo que abonaste y lo que debes");
  await p.goto(URL + "#tendencias"); await p.waitForTimeout(400);
  ok(/Lo que debes, mes a mes/.test(await p.locator("#view").innerText()), "Tendencias: «Lo que debes, mes a mes»");

  // 10) Saldar la última: «Sin deudas»
  await p.goto(URL + "#finanzas"); await p.waitForTimeout(300);
  await p.evaluate(() => { const t = STATE.deudas.lista[0]; t.creada = new Date(2026, 10, 1, 9).getTime(); deudaAbonar(t.id, deudaSaldo(t), STATE); deudaRevisar(t.id); saveState(); checkBadges(); rerender(); });
  await p.waitForTimeout(300);
  ok(/Quedaste sin deudas/.test(await p.locator("#deudas").innerText()) && await p.evaluate(() => STATE.gamif.badges.includes("sin-deudas")), "sin ninguna viva: «Quedaste sin deudas» y la medalla «Sin deudas»");
  await ctx.close();
};
