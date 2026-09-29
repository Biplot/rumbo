/* Pruebas en navegador · Tienda: funciones (enfoque, pronóstico, comparar meses, informe del año, plantillas, íconos, mediodía) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-12-14T10:00:00", w: 1280, h: 860 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "funciones@test.cl");
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 5000, 0, "test");
    STATE.ritual.dias["2026-12-14"] = { hecho: true, mision: "Foco", sapo: "Cerrar la propuesta" };
    nuevaTarea(STATE, "2026-12-14", { txt: "Cerrar la propuesta", ambito: "pro", esSapo: true });
    for (let i = 0; i < 9; i++) nuevaTarea(STATE, "2026-12-16", { txt: "Tarea " + i, ambito: "pro" });
    saveState();
  });

  // 1) Tienda: sección Funciones; comprar Modo enfoque
  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  ok(await p.locator("[data-fun]").count() === 5, "la Tienda muestra las 5 funciones");
  await p.click('.ficha[data-fun="fun:enfoque"]'); await p.waitForTimeout(200);
  await p.click('#modal [data-action="fun-buy"]'); await p.waitForTimeout(300); await p.evaluate(() => closeModal());
  ok(await p.evaluate(() => funcion("enfoque")), "Modo enfoque desbloqueado");

  // 2) Enfoque: elegir el bocado, 25 min, llegar al final y marcarla hecha
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  await p.click('[data-action="enfoque-open"]'); await p.waitForTimeout(300);
  await p.click('[data-action="enfoque-iniciar"]'); await p.waitForTimeout(1300);
  ok(await p.locator("#enfoque").isVisible() && (await p.locator(".enfoque__t").innerText()).includes("Cerrar la propuesta"), "la pantalla de enfoque muestra solo la tarea");
  ok((await p.locator("#enf-reloj").innerText()) === "25:00", "el reloj parte en 25:00");
  await shot(p, "enfoque");
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.locator("#enfoque").isVisible(), "al recargar, la sesión sigue");
  await ctx.clock.setFixedTime(new Date("2026-12-14T10:25:02")); await p.waitForTimeout(1500);
  ok(await p.locator('[data-action="enfoque-hecha"]').isVisible(), "al terminar pregunta si terminaste la tarea");
  await p.click('[data-action="enfoque-hecha"]'); await p.waitForTimeout(300);
  const e = await p.evaluate(() => ({ s: STATE.enfoque.sesiones.length, real: STATE.enfoque.sesiones[0].real, hecha: estadoTarea(tareasDelDia("2026-12-14")[0]) }));
  ok(e.s === 1 && e.real === 25 && e.hecha === "hecha", "registra 25 min de foco y la tarea queda hecha: " + JSON.stringify(e));
  await p.goto(URL + "#tendencias"); await p.waitForTimeout(400);
  ok((await p.locator("body").innerText()).includes("Foco esta semana"), "Tendencias muestra el foco de la semana");

  // 3) Comparar meses: bloqueado → desbloquear → tabla
  ok(await p.locator('[data-action="fun-buy"][data-id="fun:comparar"]').isVisible(), "Comparar meses aparece bloqueado en Tendencias");
  await shot(p, "antes-comparar"); await p.click('[data-action="fun-buy"][data-id="fun:comparar"]', { timeout: 4000 }); await p.waitForTimeout(400);
  ok(await p.locator(".tabla-comparar").isVisible(), "al desbloquear muestra la tabla de dos meses");

  // 4) Informe del año (diciembre)
  await p.click('[data-action="informe-anio"][data-y="2026"]'); await p.waitForTimeout(800);
  ok(await p.locator(".informe-prev").isVisible(), "el informe del año genera la imagen");
  await shot(p, "informe-anio");
  await p.evaluate(() => closeModal());

  // 5) Pronóstico: el miércoles 16 queda sobrecargado
  await p.evaluate(() => { ledgerComprar(STATE, "fun-pronostico", 400); saveState(); });
  await p.goto(URL + "#semana"); await p.waitForTimeout(400);
  ok((await p.locator(".pronostico").innerText()).includes("miércoles"), "el pronóstico avisa que el miércoles quedó sobrecargado");

  // 6) Plantilla y pack de íconos
  await p.goto(URL + "#habitos"); await p.waitForTimeout(300);
  await p.click('[data-action="plantillas-open"]'); await p.waitForTimeout(200);
  await p.click('[data-action="fun-buy"][data-id="plantilla:salud"]'); await p.waitForTimeout(300);
  await p.click('[data-action="plantilla-aplicar"][data-id="salud"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.habitos.defs.some(h => h.nombre === "Entrenar")), "la plantilla agrega sus hábitos");
  await p.evaluate(() => { ledgerComprar(STATE, "fun-iconos-deporte", 150); saveState(); });
  await p.click('[data-action="habit-add"]'); await p.waitForTimeout(200);
  ok(await p.locator('#h-iconos [data-ic="🚴"]').count() === 1, "el pack de íconos aparece al crear un hábito");
  await p.evaluate(() => closeModal());

  // 7) Mediodía en Notificaciones
  await p.goto(URL + "#notif"); await p.waitForTimeout(300);
  ok(await p.locator("#notif-mediodia").count() === 0, "sin la función no aparece la hora de mediodía");
  await p.evaluate(() => { ledgerComprar(STATE, "fun-mediodia", 300); saveState(); rerender(); });
  await p.fill("#notif-mediodia", "13:15"); await p.click('[data-action="notif-times"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.settings.notif.mediodia) === "13:15", "guarda la hora del aviso de mediodía");
  await ctx.close();
};
