/* Pruebas en navegador · Tienda: útiles (consumibles) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  // Hoy lunes 28 a las 15:00: el 27 quedó abierto sin cerrar, el 24..26 cerrados
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T15:00:00", w: 1280, h: 860 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "tienda@test.cl");
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 1000, 0, "test");
    ["2026-09-24", "2026-09-25", "2026-09-26"].forEach(iso => { STATE.ritual.dias[iso] = { hecho: true, cerrado: true, mision: "x" }; });
    STATE.ritual.dias["2026-09-27"] = { hecho: true, mision: "Domingo" };
    STATE.habitos.defs = [{ id: "hx", nombre: "Leer", icon: "📚", frecuencia: { tipo: "diario" }, creado: "2026-09-01" }];
    saveState();
  });

  // 1) Tienda: sección Útiles, compra y máximo del protector
  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  ok(await p.locator('[data-util]').count() === 5, "la Tienda muestra los 5 útiles");
  await p.click('[data-util="protector"] [data-action="util-buy"]'); await p.waitForTimeout(200);
  await p.click('[data-util="protector"] [data-action="util-buy"]'); await p.waitForTimeout(200);
  ok(await p.locator('[data-util="protector"] [data-action="util-buy"]').isDisabled(), "con 2 protectores el botón queda en máximo");
  ok(await p.evaluate(() => STATE.gamif.ledger.filter(m => m.id.startsWith("consumo:protector:")).reduce((a, m) => a + m.delta, 0)) === -300, "descuenta 300 ⭐");
  await shot(p, "tienda-utiles");

  // 2) Rescate de ayer después del mediodía (mitad de monedas)
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  const s1 = await p.evaluate(() => STATE.gamif.puntos);
  ok(await p.locator('[data-action="rescate-usar"]').isVisible(), "Inicio ofrece rescatar el domingo");
  await p.click('[data-action="rescate-usar"]'); await p.waitForTimeout(400);
  ok((await p.locator('[data-action="cierre-save"]').innerText()).includes("+20"), "el cierre de rescate paga la mitad (+20)");
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({ cerrado: STATE.ritual.dias["2026-09-27"].cerrado, pts: STATE.gamif.puntos, racha: computeClosedStreak() }));
  ok(r.cerrado && r.pts === s1 - 100 + 20 && r.racha === 4, "rescate cobra 100, paga 20 y la racha sigue (4): " + JSON.stringify(r));

  // 3) Pase de hábito
  await p.goto(URL + "#habitos"); await p.waitForTimeout(400);
  await p.click('[data-action="pase-usar"][data-id="hx"]'); await p.waitForTimeout(300);
  ok((await p.locator(".hb-today").first().innerText()).includes("Pase usado"), "el hábito queda cubierto con el pase");
  ok(await p.locator('[data-action="pase-usar"]').count() === 0, "no ofrece otro pase la misma semana");

  // 4) Día libre: reservar hoy → Inicio en pausa, sin FAB; cancelar uno futuro lo devuelve
  await p.evaluate(() => openDiaLibre()); await p.waitForTimeout(200);
  await p.fill("#libre-fecha", "2026-09-28");
  await p.click('[data-action="libre-reservar"]'); await p.waitForTimeout(300);
  await p.fill("#libre-fecha", "2026-10-12");
  await p.click('[data-action="libre-reservar"]'); await p.waitForTimeout(300);
  await p.click('[data-action="libre-cancelar"][data-fecha="2026-10-12"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => inventario(STATE, "libre")) === 1, "cancelar un día libre futuro lo devuelve al inventario");
  await p.evaluate(() => closeModal());
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok((await p.locator("[data-tour=dia]").innerText()).includes("día libre"), "Inicio muestra el día libre");
  await p.goto(URL + "#habitos"); await p.waitForTimeout(300);
  ok(await p.locator("#dayFab").isHidden(), "sin botón flotante de abrir día");

  // 5) Protector automático: el 28 queda sin cerrar; el 29 a las 13 se cubre solo
  await p.evaluate(() => { usosDe(STATE).forEach(u => { if (u.tipo === "libre") u.anulado = true; }); saveState(); });
  await ctx.close();

  const ctx2 = await nuevoContexto(b, { fecha: "2026-09-30T13:00:00", w: 1280, h: 860 });
  const q = await ctx2.newPage(); q.on("pageerror", e => errs.push(e.message));
  q.on("dialog", d => d.accept());
  await registrar(q, "protector@test.cl");
  await q.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 300, 0, "test");
    ["2026-09-26", "2026-09-27", "2026-09-28"].forEach(iso => { STATE.ritual.dias[iso] = { hecho: true, cerrado: true }; });
    comprarConsumible(STATE, "protector"); saveState();
  });
  await q.reload(); await q.waitForTimeout(900);
  const pr = await q.evaluate(() => ({ prot: diaProtegido(STATE, "2026-09-29"), inv: inventario(STATE, "protector"), racha: computeClosedStreak() }));
  ok(pr.prot && pr.inv === 0 && pr.racha === 3, "el protector cubre el día olvidado y la racha sigue: " + JSON.stringify(pr));

  // 6) Reabrir un día cerrado de la última semana (sin volver a pagar)
  await q.goto(URL + "#ritual"); await q.waitForTimeout(300);
  await q.evaluate(() => { STATE.ritual.dias["2026-09-28"].cierre = { nota: "vieja" }; saveState(); });
  const antes = await q.evaluate(() => STATE.gamif.puntos);
  await q.evaluate(() => usarReabrir("2026-09-28")); await q.waitForTimeout(300);
  ok((await q.locator('[data-action="cierre-save"]').innerText()).includes("Guardar cambios"), "reabrir abre el cierre para editar");
  await q.fill("#c-nota", "corregida");
  await q.click('[data-action="cierre-save"]'); await q.waitForTimeout(300);
  const re = await q.evaluate(() => ({ nota: STATE.ritual.dias["2026-09-28"].cierre.nota, pts: STATE.gamif.puntos }));
  ok(re.nota === "corregida" && re.pts === antes - 120, "guarda la corrección y solo cobra el reabrir: " + JSON.stringify(re));
  await ctx2.close();
};
