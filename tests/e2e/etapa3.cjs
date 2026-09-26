/* Pruebas en navegador · Menú personalizable, Semana, recurrentes, registro futuro y gestos */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T09:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "etapa3@test.cl");

  // Menú: ocultar y volver a mostrar un módulo (sus datos quedan)
  await p.evaluate(() => { STATE.vida.listas.push({ id: "l1", nombre: "Compras", items: [] }); saveState(); buildNav(); });
  ok(await p.locator('#nav [data-route="listas"]').count() === 1, "Listas está en el menú");
  await p.evaluate(() => openPersonalizarMenu());
  await p.locator('.menu-mod[value="listas"]').uncheck();
  await p.click('[data-action="menu-guardar"]'); await p.waitForTimeout(200);
  ok(await p.locator('#nav [data-route="listas"]').count() === 0 && await p.evaluate(() => STATE.vida.listas.length) === 1, "ocultar Listas la saca del menú sin borrar sus datos");
  await p.evaluate(() => openPersonalizarMenu());
  await p.locator('.menu-mod[value="listas"]').check();
  await p.click('[data-action="menu-guardar"]'); await p.waitForTimeout(200);
  ok(await p.locator('#nav [data-route="listas"]').count() === 1, "se puede volver a mostrar");

  // Recurrentes
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  await p.click('[data-action="rec-open"]'); await p.waitForTimeout(150);
  await p.fill("#rec-txt", "Reunión de equipo");
  await p.locator('.rec-dia[value="2"]').check();                  // lunes (ya marcado) y miércoles
  await p.click('[data-action="rec-save"]'); await p.waitForTimeout(250);
  let s = await p.evaluate(() => STATE);
  const recs = ["2026-09-28", "2026-09-30", "2026-10-05", "2026-10-07"].map(d => (s.agenda.dias[d] || []).filter(t => t.recurrente && !t.borrada).length);
  ok(recs.join() === "1,1,1,1", "la regla lunes y miércoles crea sus tareas de las próximas 2 semanas: " + recs.join());
  await p.evaluate(() => closeModal());
  ok(await p.locator('.week-col .tarea-row', { hasText: "Reunión de equipo" }).count() === 2, "la pantalla Semana las muestra con 🔁");
  await p.click('[data-action="rec-open"]'); await p.click('[data-action="rec-del"]'); await p.waitForTimeout(250);
  s = await p.evaluate(() => STATE);
  ok(!(s.agenda.dias["2026-10-07"] || []).some(t => t.recurrente && !t.borrada) && s.agenda.recurrentes[0].borrada, "borrar la regla quita sus tareas futuras");
  await p.evaluate(() => closeModal());

  // Registro futuro
  await p.evaluate(() => { nuevaTarea(STATE, "2026-11-12", { txt: "Renovar el pasaporte", ambito: "per" }); saveState(); rerender(); });
  await p.locator("details.hb-more summary", { hasText: "Más adelante" }).click();
  const fut = await p.locator("details.hb-more", { hasText: "Más adelante" }).innerText();
  ok(/noviembre/i.test(fut) && fut.includes("Renovar el pasaporte"), "'Más adelante' muestra lo programado agrupado por mes");
  await p.locator('[data-action="sem-ir"]').first().click(); await p.waitForTimeout(200);
  ok((await p.locator(".sem-nav__t").innerText()).includes("9 al 15 de noviembre"), "'Ver semana' lleva a esa semana");
  await shot(p, "etapa3-semana", { fullPage: true });

  // Editar el texto tocándolo y marcar con el teclado
  await p.evaluate(() => { nuevaTarea(STATE, "2026-09-28", { txt: "Llamr al banco", ambito: "per" }); nuevaTarea(STATE, "2026-09-28", { txt: "Pagar la luz", ambito: "per" }); saveState(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await p.locator('#view [data-action="tarea-editar"]', { hasText: "Llamr al banco" }).click(); await p.waitForTimeout(150);
  await p.fill("#te-txt", "Llamar al banco"); await p.press("#te-txt", "Enter"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => tareasDelDia("2026-09-28").some(t => t.txt === "Llamar al banco")), "tocar el texto permite editar la tarea");
  await p.locator('#view .tarea-row', { hasText: "Pagar la luz" }).locator(".check").focus();
  await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => tareasDelDia("2026-09-28").find(t => t.txt === "Pagar la luz").estado) === "hecha", "con el teclado (Enter) se marca como hecha");
  await ctx.close();

  // Celular: deslizar → hecha, ← posponer
  const m = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-09-28T09:00:00" });
  const q = await m.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "swipe@test.cl");
  await q.evaluate(() => { nuevaTarea(STATE, "2026-09-28", { txt: "Deslizar a hecha", ambito: "per" }); nuevaTarea(STATE, "2026-09-28", { txt: "Deslizar a mañana", ambito: "per" }); saveState(); });
  await q.goto(URL + "#inicio"); await q.waitForTimeout(300);
  const deslizar = (txt, dx) => q.evaluate(([txt, dx]) => {
    const row = Array.from(document.querySelectorAll("#view .tarea-row[data-swipe]")).find(r => r.textContent.includes(txt));
    const el = row.querySelector(".item-row__main"), b = el.getBoundingClientRect(), x = b.left + 20, y = b.top + 10;
    const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [t(x)], changedTouches: [t(x)], bubbles: true }));
    for (let i = 1; i <= 5; i++) el.dispatchEvent(new TouchEvent("touchmove", { touches: [t(x + dx * i / 5)], changedTouches: [t(x + dx * i / 5)], bubbles: true }));
    el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t(x + dx)], bubbles: true }));
  }, [txt, dx]);
  await deslizar("Deslizar a hecha", 110); await q.waitForTimeout(250);
  ok(await q.evaluate(() => tareasDelDia("2026-09-28").find(t => t.txt === "Deslizar a hecha").estado) === "hecha", "deslizar a la derecha marca la tarea como hecha");
  await deslizar("Deslizar a mañana", -110); await q.waitForTimeout(250);
  ok(await q.locator("#modalTitle").innerText() === "Posponer tarea", "deslizar a la izquierda abre 'Posponer'");
  ok(await q.evaluate(() => CURRENT) === "inicio", "deslizar una tarea no cambia de sección");
  await m.close();
};
