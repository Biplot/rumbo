/* Pruebas en navegador · ✏️ Reabrir un día y 🌅 Abrir un día olvidado (consumibles.js): la tira de los 7 días
   anteriores en Ritual → Día (cerrado, ya pagado, sin abrir, sin cerrar a tiempo, antes de la cuenta), un toque +
   una confirmación con la fecha y el precio, se cobra una sola vez por día, «Corregir el …» y «Guardar cambios»,
   abrir un día olvidado y cerrarlo enseguida (sin las ⭐ de la apertura), el botón en el Diario, «Elegir el día» en
   la Tienda y, sin ⭐ suficientes, no se abre ni se cobra. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-09T15:00:00", w: 390, h: 844 });   // lunes
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  const dialogos = []; p.on("dialog", d => { dialogos.push(d.message()); d.accept(); });
  await registrar(p, "reabrir-facil@test.cl");
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 500, 0, "test");
    const cerrado = nota => ({ hecho: true, cerrado: true, mision: "Misión", cierre: { mision: "si", nota } });
    STATE.ritual.dias["2026-11-01"] = cerrado("muy vieja");   // 8 días atrás: fuera de la tira
    STATE.ritual.dias["2026-11-02"] = cerrado("del lunes");
    STATE.ritual.dias["2026-11-05"] = cerrado("vieja");
    STATE.ritual.dias["2026-11-07"] = cerrado("ya reabierto");
    STATE.ritual.dias["2026-11-08"] = { hecho: true, mision: "Sin cerrar", ts: 1 };   // abierto: todavía se puede cerrar gratis
    comprarConsumible(STATE, "reabrir"); usarConsumible(STATE, "reabrir", "reabrir:2026-11-07", { fecha: "2026-11-07" });
    saveState();
  });
  const puntos = () => p.evaluate(() => { recalcGamif(STATE); return STATE.gamif.puntos; });
  const abierto = () => p.evaluate(() => !document.getElementById("modalOverlay").hidden);

  // 1) Ritual → Día: la tarjeta con la tira de la semana
  await p.goto(URL + "#ritual"); await p.waitForTimeout(400);
  const tira = '#view .reabrir-card .reabrir-tira';
  ok(await p.locator(tira + " .reabrir-tira__d").count() === 7, "Ritual → Día muestra la tira con los 7 días anteriores a hoy");
  const estados = await p.locator(tira + " .reabrir-tira__d").evaluateAll(xs => xs.map(x => (x.dataset.iso || x.dataset.date || "-") + ":" + x.className.replace(/.*is-/, "")));
  ok(JSON.stringify(estados) === JSON.stringify(["2026-11-02:reabrir", "2026-11-03:abrir", "2026-11-04:abrir", "2026-11-05:reabrir", "2026-11-06:abrir", "2026-11-07:editar", "2026-11-08:cerrar"]),
    "cada día dice lo que se puede hacer: reabrir, abrir (se te olvidó), editar (ya pagado) o cerrar a tiempo: " + estados);
  ok((await p.locator("#view .reabrir-card").innerText()).includes("Abrir o reabrir un día") && await p.locator("#view .reabrir-card .reabrir-leyenda li").count() === 4, "la tarjeta se llama «Abrir o reabrir un día» y explica cada día");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), "la tira cabe en el celular sin correrse de lado");
  await shot(p, "reabrir-ritual", { fullPage: false });

  // 2) Un toque en un día cerrado: una confirmación con la fecha y el precio, y se abre su cierre para corregir
  const antes = await puntos();
  await p.click(tira + ' [data-iso="2026-11-05"]'); await p.waitForTimeout(350);
  ok(dialogos.length === 1 && dialogos[0].includes("5 de noviembre") && dialogos[0].includes("120 ⭐") && dialogos[0].includes("te quedarán"),
    "una sola confirmación, con la fecha y el precio: " + JSON.stringify(dialogos));
  ok((await p.locator("#modalTitle").innerText()).startsWith("Corregir el") && await p.locator("#modal .reabrir-aviso").count() === 1,
    "se abre «Corregir el …» con el aviso de que las ⭐ del cierre no se repiten");
  ok((await p.locator('#modal [data-action="cierre-save"]').innerText()).includes("Guardar cambios"), "el botón dice «Guardar cambios»");
  await shot(p, "reabrir-cierre");
  await p.fill("#c-nota", "corregida");
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(350);
  const r = await p.evaluate(() => STATE.ritual.dias["2026-11-05"].cierre.nota);
  ok(r === "corregida" && await puntos() === antes - 120, "guarda la corrección y cobra 120 ⭐ (no da las del cierre): " + JSON.stringify([r, antes, await puntos()]));
  ok(await p.locator(tira + ' .is-editar[data-iso="2026-11-05"]').count() === 1, "en la tira, ese día pasa a ✏️ ya reabierto");

  // 3) Volver a tocarlo: sin confirmación y sin cobrar de nuevo
  await p.click(tira + ' [data-iso="2026-11-05"]'); await p.waitForTimeout(300);
  ok(dialogos.length === 1 && await abierto() && await puntos() === antes - 120, "lo ya reabierto se edita gratis, sin preguntar");
  await p.evaluate(() => closeModal());

  // 4) El día sin cerrar (todavía a tiempo) se cierra gratis desde la tira
  await p.click(tira + ' [data-date="2026-11-08"]'); await p.waitForTimeout(300);
  ok((await p.locator("#modalTitle").innerText()).startsWith("Cerrar el") && dialogos.length === 1, "el día sin cerrar abre su cierre normal, sin cobrar");
  await p.evaluate(() => closeModal());

  // 4b) Un día que se te olvidó abrir: confirmación, la apertura de ese día y enseguida su cierre
  const antesAbrir = await puntos();
  await p.click(tira + ' [data-iso="2026-11-03"]'); await p.waitForTimeout(350);
  ok(dialogos.length === 2 && dialogos[1].includes("3 de noviembre") && dialogos[1].includes("se te olvidó") && dialogos[1].includes("120 ⭐"),
    "abrir un día olvidado pregunta una vez, con la fecha y el precio: " + JSON.stringify(dialogos[1]));
  ok((await p.locator("#modalTitle").innerText()).startsWith("Abrir el") && await p.locator("#modal #at-mision").count() === 1, "se abre «Abrir el …» con tu misión, tu bocado y tu energía");
  await shot(p, "abrir-olvidado");
  await p.fill("#at-mision", "Terminar el informe");
  await p.click('#modal [data-action="apertura-tarde-save"]'); await p.waitForTimeout(350);
  ok((await p.locator("#modalTitle").innerText()).startsWith("Cerrar el"), "al guardar, sigue directo al cierre de ese día");
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(350);
  const dA = await p.evaluate(() => { const r = STATE.ritual.dias["2026-11-03"]; return { hecho: r.hecho, tarde: r.tarde, cerrado: r.cerrado, mision: r.mision, apertura: STATE.gamif.ledger.some(m => m.id === "ritual-apertura:2026-11-03") }; });
  ok(dA.hecho && dA.tarde && dA.cerrado && dA.mision === "Terminar el informe" && !dA.apertura, "queda abierto (tarde) y cerrado con su misión, sin las ⭐ de la apertura: " + JSON.stringify(dA));
  ok(await puntos() === antesAbrir - 120 + 40, "cobra 120 ⭐ y el cierre da sus 40 ⭐ como siempre");
  ok(await p.locator(tira + ' .is-editar[data-iso="2026-11-03"]').count() === 1, "ya pagado: corregir su cierre después no se vuelve a cobrar");

  // 4c) Si lo pagas y cierras la ventana sin guardar, volver a tocarlo no cobra de nuevo
  const antesB = await puntos();
  await p.click(tira + ' [data-iso="2026-11-04"]'); await p.waitForTimeout(300);
  await p.evaluate(() => closeModal());
  await p.click(tira + ' [data-iso="2026-11-04"]'); await p.waitForTimeout(300);
  ok(dialogos.length === 3 && (await p.locator("#modalTitle").innerText()).startsWith("Abrir el") && await puntos() === antesB - 120, "pagado y sin guardar: se vuelve a abrir gratis, sin preguntar");
  await p.evaluate(() => closeModal());

  // 5) En el Diario: el botón está en el mismo día
  await p.goto(URL + "#diario"); await p.waitForTimeout(400);
  await p.click('#view [data-action="diario-dia"][data-iso="2026-11-02"].dfila'); await p.waitForTimeout(250);
  const btn = p.locator('#view [data-action="reabrir-dia"][data-iso="2026-11-02"]');
  ok(await btn.count() === 1 && (await btn.innerText()).includes("Reabrir este día") && /· 120\b/.test(await btn.innerText()), "en el Diario, el día cerrado trae «Reabrir este día · 120 ⭐» (la ⭐ va como ícono)");
  await p.click('#view [data-action="diario-dia"][data-iso="2026-11-05"].dfila'); await p.waitForTimeout(250);
  ok((await p.locator('#view [data-action="reabrir-dia"][data-iso="2026-11-05"]').innerText()).includes("Editar el cierre"), "y el ya reabierto, «Editar el cierre»");
  await shot(p, "reabrir-diario");

  // 6) En la Tienda: «Elegir el día» abre la misma tira, con su leyenda
  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  await p.click('.ficha[data-util="reabrir"]'); await p.waitForTimeout(250);
  ok(await p.locator('#modal [data-action="reabrir-hoja"]').count() === 1, "la ficha de la Tienda ofrece «Elegir el día»");
  await p.click('#modal [data-action="reabrir-hoja"]'); await p.waitForTimeout(250);
  ok(await p.locator("#modal .reabrir-tira .reabrir-tira__d").count() === 7 && await p.locator("#modal .reabrir-leyenda li").count() === 4, "y abre la tira de la semana con lo que significa cada día");
  await p.evaluate(() => closeModal());
  await p.click('.ficha[data-util="abrir"]'); await p.waitForTimeout(250);
  ok((await p.locator("#modal").innerText()).includes("Abrir un día olvidado") && await p.locator('#modal [data-action="reabrir-hoja"]').count() === 1, "«Abrir un día olvidado» también está en la Tienda, con «Elegir el día»");
  await shot(p, "reabrir-tienda");
  await ctx.close();

  // 7) Cuenta nueva (de hoy): no hay días anteriores, no hay tarjeta; sin ⭐ suficientes, tocar un día no abre ni cobra
  const c2 = await nuevoContexto(b, { fecha: "2026-11-09T15:00:00", w: 390, h: 844 });
  const q = await c2.newPage(); q.on("pageerror", e => errs.push(e.message));
  let preguntas = 0; q.on("dialog", d => { preguntas++; d.accept(); });
  await registrar(q, "reabrir-sin@test.cl");
  await q.evaluate(() => { STATE.settings.alta = "2026-11-09"; saveState(); });
  await q.goto(URL + "#ritual"); await q.waitForTimeout(350);
  ok(await q.locator("#view .reabrir-card").count() === 0, "con la cuenta de hoy no hay días que abrir ni reabrir: no aparece la tarjeta");
  await q.evaluate(() => { STATE.ritual.dias["2026-11-06"] = { hecho: true, cerrado: true, cierre: {} }; saveState(); rerender(); });
  await q.waitForTimeout(250);
  const sin = await q.evaluate(() => { recalcGamif(STATE); return STATE.gamif.puntos; });
  await q.click('#view .reabrir-tira [data-iso="2026-11-06"]'); await q.waitForTimeout(300);
  ok(sin < 120 && preguntas === 0 && await q.evaluate(() => document.getElementById("modalOverlay").hidden && !usoVigente(STATE, "reabrir:2026-11-06")),
    "sin ⭐ suficientes: avisa cuánto falta, no pregunta, no abre ni cobra");
  await c2.close();
};
