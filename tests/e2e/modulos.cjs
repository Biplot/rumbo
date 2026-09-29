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

  // ---------- Diario: mapa del ánimo + lista ----------
  await p.evaluate(() => {
    for (let i = 1; i <= 5; i++) {
      const iso = agSumar(todayISO(), -i);
      STATE.ritual.dias[iso] = { hecho: true, cerrado: true, mision: i === 2 ? "Enviar el informe" : "Misión " + i, energia: 3, cierre: { mejor: i === 3 ? "Paseo en bicicleta" : "", nota: "Nota " + i } };
      STATE.vida.diario.push({ id: "t" + i, fecha: iso, mood: i, fromRitual: true });
    }
    STATE.vida.diario.push({ id: "ago", fecha: "2026-08-10", mood: 5, texto: "Vacaciones en el sur", titulo: "Viaje" });
    saveState();
  });
  await p.goto(URL + "#diario"); await p.waitForTimeout(350);
  ok(await p.locator("button.dmap__c[style*='background']").count() === 5, "Diario: el mapa pinta cada día con el color de tu ánimo");
  ok(await p.locator(".dfila").count() === 5 && (await p.locator(".dnums").innerText()).includes("5"), "Diario: la lista muestra los días del mes, una línea por día");
  await p.click('.dmap__c[data-iso="2026-09-21"]'); await p.waitForTimeout(200);
  const det = await p.locator(".ddet").innerText();
  ok(det.includes("Enviar el informe") && det.includes("Nota 2") && await p.locator('.dmap__c.is-sel[data-iso="2026-09-21"]').count() === 1, "tocar un día en el mapa lo abre en la lista y lo marca");
  await p.click('.dfila[data-iso="2026-09-21"]'); await p.waitForTimeout(200);
  ok(await p.locator(".ddet").count() === 0, "tocarlo otra vez lo cierra");
  await p.fill("#diario-busca", "bicicleta"); await p.waitForTimeout(200);
  ok(await p.locator(".dfila").count() === 1 && (await p.locator(".dfila").innerText()).includes("Misión 3"), "el buscador encuentra días por lo que escribiste");
  await p.fill("#diario-busca", "vacaciones"); await p.waitForTimeout(200);
  ok(await p.locator(".dfila").count() === 1 && (await p.locator(".dfila").innerText()).includes("Viaje"), "la búsqueda recorre todos los meses");
  await p.fill("#diario-busca", ""); await p.waitForTimeout(150);
  await p.click('[data-action="diario-mes"][data-dir="-1"]'); await p.waitForTimeout(250);
  ok((await p.locator(".dmap__nav").innerText()).includes("Agosto") && await p.locator(".dfila").count() === 1, "las flechas cambian de mes");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Diario: sin scroll horizontal en el celular");
  await shot(p, "modulos-diario");
};
