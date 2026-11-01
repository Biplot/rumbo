/* Pruebas en navegador · 😴 Días de descanso y 🌴 vacaciones, en el celular: tocar un día que viene en Hábitos › Semana
   (hasta 2 por mes, nunca hoy), la racha que no se corta, la hoja del hábito, «Descansan hoy» en Hábitos e Inicio
   con la hamaquita en el jardín, las vacaciones (hasta 21 días; el aviso y «Volví antes»), el paso Descansos
   del ritual de la semana y las rayitas en el Calendario. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-05T12:00:00", w: 390, h: 844 });   // jueves
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const ir = async (vista, layout) => { await p.evaluate(([v, l]) => { closeModal(); HABIT_VIEW = v; HABIT_LAYOUT = l; go("habitos"); rerender(); }, [vista, layout]); await p.waitForTimeout(400); };
  const estado = () => p.evaluate(() => ({ d: STATE.habitos.descansos.filter(x => !x.quitado).map(x => x.hid + ":" + x.fecha).sort(), v: STATE.habitos.vacaciones.filter(x => !x.quitado).map(x => x.desde + "→" + x.hasta) }));
  await registrar(p, "descanso@test.cl");
  await p.evaluate(() => {
    STATE.habitos.defs = []; STATE.habitos.log = {}; STATE.habitos.descansos = []; STATE.habitos.vacaciones = [];
    const mk = (id, nombre, icon, frecuencia, desde, hasta, salvo) => { STATE.habitos.defs.push({ id, nombre, icon, frecuencia, creado: "2026-09-01" });
      for (let d = new Date(desde + "T12:00:00"); d <= new Date(hasta + "T12:00:00"); d.setDate(d.getDate() + 1)) { const iso = isoLocal(d); if ((salvo || []).includes(iso)) continue;
        const k = d.getFullYear() + "-" + (d.getMonth() + 1); STATE.habitos.log[k] = STATE.habitos.log[k] || {}; (STATE.habitos.log[k][id] = STATE.habitos.log[k][id] || {})[d.getDate()] = true; } };
    mk("entrenar", "Entrenar", "🏋️", { tipo: "diario" }, "2026-10-20", "2026-11-04", ["2026-10-31"]);
    mk("leer", "Leer", "📖", { tipo: "diario" }, "2026-10-25", "2026-11-04");
    mk("correr", "Correr", "🏃", { tipo: "semanal", veces: 3 }, "2026-11-02", "2026-11-03");
    saveState();
  });

  // 1) Hábitos › Semana: tocar un día que viene lo deja de descanso (con rayitas); hasta 2 por mes; hoy no
  await ir("diario", "semana");
  const dia = (id, f) => p.locator(`.hb-week:has-text("${id}") [data-f="${f}"]`);
  ok(/Toca un día que viene para descansar/.test(await p.locator("#view").innerText()), "Semana: explica que se toca un día que viene para descansar");
  await dia("Entrenar", "2026-11-07").click(); await p.waitForTimeout(300);
  await dia("Entrenar", "2026-11-08").click(); await p.waitForTimeout(300);
  ok((await estado()).d.join() === "entrenar:2026-11-07,entrenar:2026-11-08" && await dia("Entrenar", "2026-11-07").evaluate(e => e.classList.contains("rest")), "sábado y domingo de descanso para Entrenar, con rayitas");
  await dia("Entrenar", "2026-11-06").click(); await p.waitForTimeout(300);
  ok((await estado()).d.length === 2 && /Ya usaste los 2 descansos de noviembre/.test(await p.locator("#toast").innerHTML()), "un tercero en noviembre no: «Ya usaste los 2 descansos de noviembre»");
  await dia("Correr", "2026-11-07").click(); await p.waitForTimeout(300);
  ok((await estado()).d.length === 2 && /no necesitan descanso de un día/.test(await p.locator("#toast").innerHTML()), "los de 3 por semana no usan descanso de un día (y dice por qué)");
  await dia("Entrenar", "2026-11-07").click(); await p.waitForTimeout(300);
  ok((await estado()).d.join() === "entrenar:2026-11-08", "tocarlo de nuevo antes de que llegue lo quita");
  ok(await p.locator('.hb-week:has-text("Entrenar") [data-f="2026-11-05"]').count() === 0, "hoy se marca como siempre (no se ofrece descanso)");
  await shot(p, "descanso-semana");

  // 2) La racha: el sábado 31 de octubre (planificado antes) no la corta
  const rachaDe = () => p.evaluate(() => rachaPeriodos(STATE.habitos.defs.find(h => h.id === "entrenar")).n);
  const sin = await rachaDe();
  await p.evaluate(() => { STATE.habitos.descansos = STATE.habitos.descansos.concat([{ id: "d:entrenar:2026-10-31", hid: "entrenar", fecha: "2026-10-31", ts: 1 }]); saveState(); });
  ok(sin === 4 && await rachaDe() === 15, `racha de Entrenar: ${sin} sin el descanso del sábado, 15 con él (no corta ni suma)`);

  // 3) La hoja del hábito: esta semana y la próxima para tocar
  await ir("diario", "semana");
  await p.locator('.hb-week:has-text("Entrenar") [data-action="habit-edit"]').click(); await p.waitForTimeout(300);
  ok(await p.locator("#dsc-hoja .dsc-dia").count() === 14 && /te queda 1 en noviembre/.test(await p.locator("#dsc-hoja").innerText()), "Editar hábito: 14 días para tocar y cuántos le quedan");
  await p.locator('#dsc-hoja [data-f="2026-11-12"]').click(); await p.waitForTimeout(300);
  ok(await p.locator('#dsc-hoja [data-f="2026-11-12"].is-desc').count() === 1 && (await p.inputValue("#h-nombre")) === "Entrenar", "tocar un día en la hoja lo deja de descanso sin perder lo que escribías");
  await p.locator('#dsc-hoja [data-f="2026-11-12"]').click(); await p.waitForTimeout(300);

  // 4) Hoy descansa Leer (lo decidiste ayer): no está en lo que toca, sí en «Descansan hoy»; Inicio y el jardín
  await p.evaluate(() => { STATE.habitos.descansos = STATE.habitos.descansos.concat([{ id: "d:leer:2026-11-05", hid: "leer", fecha: "2026-11-05", ts: 1 }]); saveState(); });
  await ir("diario", "hoy");
  ok(await p.locator(".hb-grid").first().locator('[data-id="leer"]').count() === 0 && /Descansan hoy \(1\)/.test(await p.locator("#view").innerText())
    && await p.locator('details:has-text("Descansan hoy") .hb-today[data-id="leer"]').count() === 1, "Hábitos › Hoy: Leer va en «Descansan hoy», no en lo que toca");
  ok(await p.evaluate(() => jardinEscena().macetas.find(m => m.id === "leer").descansa) === true, "el jardín: la maceta de Leer descansa en su hamaquita");
  await p.evaluate(() => { closeModal(); go("inicio"); }); await p.waitForTimeout(500);
  ok(/Hoy descansan: Leer/.test(await p.locator(".inicio-main").innerText()) && await p.locator('.hab-chip[data-id="leer"]').count() === 0, "Inicio: «Hoy descansan: Leer», sin su botón");
  await shot(p, "descanso-inicio");

  // 5) Vacaciones: hasta 21 días, desde mañana
  await ir("diario", "hoy");
  await p.locator('.hab-head [data-action="dsc-vacaciones"]').click(); await p.waitForTimeout(300);
  await p.fill("#vac-desde", "2026-11-06"); await p.fill("#vac-hasta", "2026-11-30"); await p.dispatchEvent("#vac-hasta", "input"); await p.waitForTimeout(100);
  ok(/Hasta 21 días seguidos/.test(await p.locator("#vac-resumen").innerText()), "más de 21 días: lo dice");
  await p.fill("#vac-desde", "2026-11-20"); await p.fill("#vac-hasta", "2026-11-28"); await p.dispatchEvent("#vac-hasta", "input"); await p.waitForTimeout(100);
  ok(/9 días de vacaciones · vuelves el domingo 29 de noviembre/.test(await p.locator("#vac-resumen").innerText()), "9 días: «vuelves el domingo 29 de noviembre»");
  await p.locator('[data-action="dsc-vac-todos"][data-v="0"]').click(); await p.locator('.vac-hab[value="correr"]').uncheck();
  await shot(p, "descanso-vacaciones");
  await p.click('[data-action="dsc-vac-ok"]'); await p.waitForTimeout(400);
  const vac = await p.evaluate(() => STATE.habitos.vacaciones[0]);
  ok(vac && vac.desde === "2026-11-20" && vac.hasta === "2026-11-28" && vac.habitos.join() === "entrenar,leer", "guardadas: del 20 al 28, para Entrenar y Leer (Correr sigue)");

  // 6) De vacaciones hoy (partieron ayer): el aviso, el letrero del jardín y «Volví antes»
  await p.evaluate(() => { STATE.habitos.vacaciones = STATE.habitos.vacaciones.concat([{ id: "vhoy", desde: "2026-11-04", hasta: "2026-11-10", habitos: null, ts: 1 }]); saveState(); });
  await ir("diario", "hoy");
  ok(/De vacaciones hasta el martes 10/.test(await p.locator(".dsc-aviso").innerText()) && /Vuelves el miércoles 11/.test(await p.locator(".dsc-aviso").innerText()), "Hábitos: «De vacaciones hasta el martes 10 · Vuelves el miércoles 11»");
  ok(await p.evaluate(() => jardinEscena().vuelve) === "2026-11-11", "el jardín tiene su letrero: vuelvo el 11");
  await shot(p, "descanso-de-vacaciones", { fullPage: true });
  await p.locator('.dsc-aviso [data-action="dsc-vac-fin"]').click(); await p.waitForTimeout(400);
  ok(await p.locator(".dsc-aviso").count() === 0 && await p.evaluate(() => STATE.habitos.vacaciones.find(v => v.id === "vhoy").hasta) === "2026-11-04", "«Volví antes»: terminan ayer y hoy vuelve a tocar");

  // 7) El ritual de la semana: el paso Descansos
  await p.evaluate(() => { closeModal(); openSemApertura("2026-11-09"); }); await p.waitForTimeout(200);
  for (let i = 0; i < 3; i++) { await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150); }
  ok(/Paso 4 de 5 · Descansos/i.test(await p.locator("#modalBody").innerText()) && await p.locator("#dsc-ritual .dsc-fila").count() === 2, "ritual: el paso 4 de 5 pregunta qué días vas a descansar (Entrenar y Leer)");
  await p.locator('#dsc-ritual .dsc-fila:has-text("Leer") [data-f="2026-11-10"]').click(); await p.waitForTimeout(300);
  ok((await estado()).d.includes("leer:2026-11-10") && await p.locator('#dsc-ritual .dsc-fila:has-text("Leer") [data-f="2026-11-10"].is-desc').count() === 1 && /Paso 4 de 5/i.test(await p.locator("#modalBody").innerText()), "tocar el martes de Leer lo deja de descanso y sigues en el paso");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin scroll horizontal en el celular");
  await shot(p, "descanso-ritual");

  // 8) Calendario: rayitas en los días de vacaciones y la leyenda
  await p.evaluate(() => { closeModal(); CAL_MONTH = 10; go("calendario"); rerender(); }); await p.waitForTimeout(400);
  ok(await p.locator('.calg__c--vac[data-date="2026-11-22"]').count() === 1 && /Descansos y vacaciones/.test(await p.locator(".cal-legend").innerText()), "Calendario: los días de vacaciones con rayitas y en la leyenda");
  await ctx.close();
};
