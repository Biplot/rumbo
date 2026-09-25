/* Pruebas en navegador · Modo express (apertura y cierre en 3 toques) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-09-23T09:00:00", dpr: 2 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "express@test.cl");
  await p.evaluate(() => {
    const b = nuevaTarea(STATE, "2026-09-22", { txt: "Enviar propuesta", ambito: "pro", esSapo: true });
    moverTarea(STATE, b, "2026-09-22", "2026-09-23", "migrada", { hoy: "2026-09-22" });
    nuevaTarea(STATE, "2026-09-23", { txt: "Pagar la luz", ambito: "per" });
    nuevaTarea(STATE, "2026-09-23", { txt: "Ordenar la bodega", ambito: "per", migraciones: 3 });
    saveState(); rerender();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator('.hero-focus [data-action="day-open-express"]').count() === 1, "Inicio ofrece ⚡ Express para abrir el día");
  await p.click('.hero-focus [data-action="day-open-express"]'); await p.waitForTimeout(200);
  ok(await p.inputValue("#xp-sapo") === "Enviar propuesta", "propone como bocado el que quedó sugerido de ayer");
  await p.locator(".xp-cand", { hasText: "Pagar la luz" }).click();
  ok(await p.inputValue("#xp-sapo") === "Pagar la luz" && await p.inputValue("#xp-amb") === "per", "un toque en una candidata la elige (con su ámbito)");
  await p.locator(".xp-cand", { hasText: "Enviar propuesta" }).click();
  await p.click('#xp-energia button[data-v="4"]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: la apertura express cabe en pantalla");
  await shot(p, "express-apertura");
  await p.click('[data-action="express-apertura-save"]'); await p.waitForTimeout(300);
  let s = await p.evaluate(() => STATE);
  const r = s.ritual.dias["2026-09-23"];
  ok(r.hecho && r.express.apertura && r.energia === 4 && r.sapo === "Enviar propuesta", "el día queda abierto en modo express");
  ok(s.agenda.dias["2026-09-23"].filter(t => !t.borrada).length === 3 && s.agenda.dias["2026-09-23"].find(t => t.txt === "Enviar propuesta").esSapo, "las tareas se mantienen y el bocado queda marcado");
  const mov = s.gamif.ledger.find(m => m.id === "ritual-apertura:2026-09-23");
  ok(mov && mov.delta === 25, "la apertura express da la mitad: +25 ⭐");

  // Cierre express desde la tarjeta del día en curso
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await p.click('#view [data-action="day-close-express"]'); await p.waitForTimeout(200);
  const txt = await p.locator("#modalBody").innerText();
  ok(/Ordenar la bodega/.test(txt) && /Pasan a mañana \(2\)/i.test(txt), "separa la tarea crónica y lista las que pasan a mañana");
  await p.click('#xc-moods .mood-btn[data-v="5"]');
  await p.locator(".seg", { has: p.locator('button[data-v="soltar"]') }).locator('button[data-v="soltar"]').click();
  await p.fill("#xc-gratitud", "Terminé temprano");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: el cierre express cabe en pantalla");
  await shot(p, "express-cierre");
  await p.click('[data-action="express-cierre-save"]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => STATE);
  const d = s.ritual.dias["2026-09-23"], hoy = s.agenda.dias["2026-09-23"];
  ok(d.cerrado && d.express.cierre, "el día queda cerrado en modo express");
  ok(hoy.find(t => t.txt === "Ordenar la bodega").estado === "soltada" && hoy.find(t => t.txt === "Pagar la luz").estado === "migrada"
    && (s.agenda.dias["2026-09-24"] || []).length === 2, "la crónica se suelta y el resto pasa a mañana");
  ok(s.vida.diario.some(e => e.fecha === "2026-09-23" && e.mood === 5 && e.gratitud === "Terminé temprano"), "ánimo y gratitud quedan en el Diario");
  const mc = s.gamif.ledger.find(m => m.id === "ritual-cierre:2026-09-23");
  ok(mc && mc.delta === 20, "el cierre express da la mitad: +20 ⭐");
  ok(await p.evaluate(() => computeClosedStreak()) >= 1, "el día express cuenta para la racha");

  // Día anterior sin cerrar: también se puede cerrar en express
  await p.evaluate(() => { STATE.ritual.dias["2026-09-22"] = { hecho: true, ts: 1 }; saveState(); rerender(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator('[data-action="day-close-express"][data-date="2026-09-22"]').count() === 1, "el aviso de ayer sin cerrar ofrece ⚡ Express");
  await ctx.close();
};
