/* Pruebas en navegador · Rediseño de módulos: Calendario, Diario, Salud (recetas y entrenar), Notas y Tienda */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-23T10:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "modulos@test.cl");

  // ---------- Calendario ----------
  await p.goto(URL + "#calendario"); await p.waitForTimeout(350);
  const anchos = await p.evaluate(() => [...document.querySelectorAll(".calg:not(.calg--dow) > .calg__c")].slice(0, 7).map(c => Math.round(c.getBoundingClientRect().width)));
  ok(anchos.length === 7 && Math.max(...anchos) - Math.min(...anchos) <= 1, "Calendario: las 7 columnas miden lo mismo: " + anchos.join(","));
  ok(await p.evaluate(() => { const g = document.querySelector(".calg-card"); return g.scrollWidth <= g.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth; }), "Calendario: la grilla cabe en el celular sin correrse");
  ok(await p.locator('.calg__c.is-sel[data-date="2026-09-23"]').count() === 1, "parte con hoy elegido");
  await p.click('[data-action="cal-dia"][data-date="2026-09-25"]'); await p.waitForTimeout(200);
  await p.click('.cal-ag--add'); await p.waitForTimeout(200);
  await p.fill("#ev-txt", "Dentista"); await p.click('[data-action="evento-save"]'); await p.waitForTimeout(250);
  ok((await p.locator(".cal-ag").first().innerText()).includes("Dentista") && await p.locator('.calg__c[data-date="2026-09-25"] .calg__dots i').count() === 1, "agregar un evento lo muestra en la agenda del día y como punto en la grilla");
  await shot(p, "modulos-calendario");
};
