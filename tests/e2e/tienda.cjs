/* Pruebas en navegador · Tienda: útiles (reabrir un día) y retiro de los que protegían rachas y hábitos */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T15:00:00", w: 1280, h: 860 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "tienda@test.cl");

  // 1) Quien compró en la v60: lo no usado vuelve, el día libre futuro se cancela
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 1000, 0, "test");
    ["protector:a", "protector:b"].forEach(id => ledgerRegistrar(STATE, "consumo:" + id, -150, 0, "Compra: Protector de racha"));
    ledgerRegistrar(STATE, "consumo:libre:c", -200, 0, "Compra: Día libre");
    STATE.gamif.usos.push({ id: "libre:2026-10-12", tipo: "libre", fecha: "2026-10-12", ts: 1 });
    ["2026-09-24", "2026-09-25", "2026-09-26"].forEach(iso => { STATE.ritual.dias[iso] = { hecho: true, cerrado: true, mision: "x" }; });
    STATE.ritual.dias["2026-09-27"] = { hecho: true, mision: "Domingo" };
    STATE.habitos.defs = [{ id: "hx", nombre: "Leer", icon: "📚", frecuencia: { tipo: "diario" }, creado: "2026-09-01" }];
    saveState();
  });
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(700);
  const r = await p.evaluate(() => ({
    devueltas: STATE.gamif.ledger.filter(m => m.id.startsWith("consumo:") && m.anulado).length,
    libre: STATE.gamif.usos.find(u => u.id === "libre:2026-10-12").anulado,
  }));
  ok(r.devueltas === 3 && r.libre === true, "al abrir, se devuelven las compras sin usar y se cancela el día libre futuro: " + JSON.stringify(r));

  // 2) Ya no aparecen: rescate en Inicio, pase en Hábitos, útiles de racha en la Tienda
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok(await p.locator('[data-action="rescate-usar"]').count() === 0, "Inicio ya no ofrece rescatar ayer");
  await p.goto(URL + "#habitos"); await p.waitForTimeout(300);
  ok(await p.locator('[data-action="pase-usar"]').count() === 0, "Hábitos ya no ofrece pases");
  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  ok(await p.locator("[data-util]").count() === 1 && await p.locator('[data-util="reabrir"]').count() === 1, "la Tienda solo ofrece Reabrir un día");
  await shot(p, "tienda-utiles");
  await ctx.close();

  // 3) Reabrir un día cerrado de la última semana (sin volver a pagar el cierre)
  const ctx2 = await nuevoContexto(b, { fecha: "2026-09-30T13:00:00", w: 1280, h: 860 });
  const q = await ctx2.newPage(); q.on("pageerror", e => errs.push(e.message));
  q.on("dialog", d => d.accept());
  await registrar(q, "reabrir@test.cl");
  await q.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 300, 0, "test");
    STATE.ritual.dias["2026-09-28"] = { hecho: true, cerrado: true, cierre: { nota: "vieja" } };
    saveState();
  });
  await q.goto(URL + "#ritual"); await q.waitForTimeout(300);
  const antes = await q.evaluate(() => STATE.gamif.puntos);
  await q.evaluate(() => usarReabrir("2026-09-28")); await q.waitForTimeout(300);
  ok((await q.locator('[data-action="cierre-save"]').innerText()).includes("Guardar cambios"), "reabrir abre el cierre para editar");
  await q.fill("#c-nota", "corregida");
  await q.click('[data-action="cierre-save"]'); await q.waitForTimeout(300);
  const re = await q.evaluate(() => ({ nota: STATE.ritual.dias["2026-09-28"].cierre.nota, pts: STATE.gamif.puntos }));
  ok(re.nota === "corregida" && re.pts === antes - 120, "guarda la corrección y solo cobra el reabrir: " + JSON.stringify(re));
  await ctx2.close();
};
