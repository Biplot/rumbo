/* Pruebas en navegador · ✏️ Reabrir un día, a la mano (consumibles.js): la tira de los 7 días anteriores en
   Ritual → Día (cerrado, ya reabierto, sin cerrar a tiempo, sin cierre), un toque + una confirmación con la fecha
   y el precio, se cobra una sola vez por día, «Corregir el …» y «Guardar cambios», el botón en el Diario,
   «Elegir el día» en la Tienda y, sin ⭐ suficientes, no se abre ni se cobra. */
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
  ok(await p.locator(tira + " .reabrir-tira__d").count() === 7, "Ritual → Día muestra «Reabrir un día» con los 7 días anteriores a hoy");
  const estados = await p.locator(tira + " .reabrir-tira__d").evaluateAll(xs => xs.map(x => (x.dataset.iso || x.dataset.date || "-") + ":" + x.className.replace(/.*is-/, "")));
  ok(JSON.stringify(estados) === JSON.stringify(["2026-11-02:reabrir", "-:nada", "-:nada", "2026-11-05:reabrir", "-:nada", "2026-11-07:editar", "2026-11-08:cerrar"]),
    "cada día dice lo que se puede hacer: reabrir, editar (ya pagado), cerrar a tiempo o nada: " + estados);
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
  ok(await p.locator("#modal .reabrir-tira .reabrir-tira__d").count() === 7 && await p.locator("#modal .reabrir-leyenda li").count() === 3, "y abre la tira de la semana con lo que significa cada día");
  await shot(p, "reabrir-tienda");
  await ctx.close();

  // 7) Sin días cerrados en la semana no hay tarjeta; sin ⭐ suficientes, tocar un día no abre ni cobra
  const c2 = await nuevoContexto(b, { fecha: "2026-11-09T15:00:00", w: 390, h: 844 });
  const q = await c2.newPage(); q.on("pageerror", e => errs.push(e.message));
  let preguntas = 0; q.on("dialog", d => { preguntas++; d.accept(); });
  await registrar(q, "reabrir-sin@test.cl");
  await q.goto(URL + "#ritual"); await q.waitForTimeout(350);
  ok(await q.locator("#view .reabrir-card").count() === 0, "sin días cerrados en la última semana, no aparece la tarjeta");
  await q.evaluate(() => { STATE.ritual.dias["2026-11-06"] = { hecho: true, cerrado: true, cierre: {} }; saveState(); rerender(); });
  await q.waitForTimeout(250);
  const sin = await q.evaluate(() => { recalcGamif(STATE); return STATE.gamif.puntos; });
  await q.click('#view .reabrir-tira [data-iso="2026-11-06"]'); await q.waitForTimeout(300);
  ok(sin < 120 && preguntas === 0 && await q.evaluate(() => document.getElementById("modalOverlay").hidden && !usoVigente(STATE, "reabrir:2026-11-06")),
    "sin ⭐ suficientes: avisa cuánto falta, no pregunta, no abre ni cobra");
  await c2.close();
};
