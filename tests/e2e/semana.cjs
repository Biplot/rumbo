/* Pruebas en navegador · Ritual semanal */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
/* Fase 4 · Ritual semanal: domingo 27 de septiembre, cierre + apertura seguidos */
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-27T20:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f4@test.cl");

  // Semana del 21: plan con 3 prioridades, tareas y pendientes de días anteriores
  await p.evaluate(() => {
    const S = STATE;
    S.metas.mensuales[8] = [{ id: "obj-sep", texto: "Lanzar la web", done: false, ambito: "pro", origen: "ritual-mes", ts: 1 }];
    S.metas.mensuales[9] = [{ id: "obj-oct", texto: "Primeros 10 clientes", done: false, ambito: "pro", origen: "ritual-mes", ts: 1 }];
    S.ritual.semanas["2026-09-21"] = {
      plan: { premio: "Cena rica", ts: 1 },
      apertura: { foco: "Lanzamiento", habitosFoco: [], ts: 1, prioridades: [
        { id: "p1", texto: "Publicar la web", ambito: "pro", objId: "obj-sep", dia: "2026-09-23" },
        { id: "p2", texto: "Ordenar finanzas", ambito: "per", objId: "", dia: "" },
        { id: "p3", texto: "Llamar a 5 clientes", ambito: "pro", objId: "obj-sep", dia: "" }] } };
    const t1 = nuevaTarea(S, "2026-09-23", { txt: "Publicar la web", ambito: "pro", prioridad: "p1" }); marcarTarea(t1, "hecha");
    nuevaTarea(S, "2026-09-24", { txt: "Revisar contrato", ambito: "pro" });
    nuevaTarea(S, "2026-09-25", { txt: "Pagar patente", ambito: "per" });
    nuevaTarea(S, "2026-09-26", { txt: "Ordenar bodega", ambito: "per" });
    const h = nuevaTarea(S, "2026-09-25", { txt: "Informe", ambito: "pro" }); marcarTarea(h, "hecha");
    ["2026-09-21", "2026-09-22", "2026-09-23"].forEach(d => { S.ritual.dias[d] = { hecho: true, cerrado: true, cierre: { sapo: true }, ts: 1 }; });
    saveState(); rerender();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok(await p.locator(".hero-focus", { hasText: "Tu ritual semanal" }).count() === 1, "domingo: Inicio muestra 'Tu ritual semanal'");
  await p.click('[data-action="sem-ritual"]'); await p.waitForTimeout(200);

  // Paso 1: prioridades (la de la tarea hecha viene sugerida como cumplida)
  const ev1 = await p.inputValue("#sc-e-p1");
  ok(ev1 === "cumplida", "la prioridad cuya tarea se hizo viene como cumplida: " + ev1);
  await p.locator('.seg button[data-v="parcial"]').nth(1).click();
  await shot(p, "f4-cierre-prioridades");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso 2: números
  const nums = await p.locator("#sem-wiz").innerText();
  ok(/1\/3[\s\S]*prioridades cumplidas/.test(nums) && nums.includes("postergación"), "números con prioridades cumplidas y postergación");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso 3: migración semanal
  const filas = p.locator("#sem-wiz .triage-row");
  ok(await filas.count() === 3, "migración semanal con las 3 pendientes: " + await filas.count());
  const fila = t => p.locator("#sem-wiz .triage-row", { hasText: t });
  ok(await fila("Revisar contrato").locator("button.is-active").innerText() === "> Próx. semana", "por defecto: próxima semana");
  await fila("Ordenar bodega").locator('button[data-v="soltar"]').click();
  await fila("Pagar patente").locator('button[data-v="otro"]').click();
  await fila("Pagar patente").locator(".tr-fecha").fill("2026-10-02");
  await shot(p, "f4-cierre-migracion");
  // ir y volver conserva las decisiones
  await p.click('[data-action="semw-prev"]'); await p.waitForTimeout(100);
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(100);
  ok(await fila("Ordenar bodega").locator("button.is-active").getAttribute("data-v") === "soltar"
    && await fila("Pagar patente").locator(".tr-fecha").inputValue() === "2026-10-02", "al volver al paso se conservan las decisiones");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso 4: reflexión y premio
  await p.fill("#sc-mejor", "Publicamos la web");
  await p.fill("#sc-apr", "Bloques de 90 minutos funcionan");
  await p.fill("#sc-ajustar", "Menos reuniones");
  await p.locator('.seg button[data-v="1"]').click();
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso 5: nota
  await p.locator("#sc-nota").fill("8");
  const boton = await p.locator('[data-action="semw-finish"]').innerText();
  ok(boton.includes("Cerrar y planificar la próxima"), "el botón final encadena la planificación: " + boton);
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(300);

  let s = await p.evaluate(() => STATE);
  const c = s.ritual.semanas["2026-09-21"].cierre;
  ok(c && c.nota === 8 && c.evaluacion.p1 === "cumplida" && c.evaluacion.p2 === "parcial" && c.premioGanado === true && c.ajustar === "Menos reuniones", "cierre guardado con evaluación, premio y nota");
  const d = iso => s.agenda.dias[iso] || [];
  ok(d("2026-09-28").some(t => t.txt === "Revisar contrato" && t.migraciones === 1), "'Próx. semana' la mueve al lunes 28 (postergada 1 vez)");
  ok(d("2026-10-02").some(t => t.txt === "Pagar patente") && d("2026-09-25").find(t => t.txt === "Pagar patente").estado === "programada", "'Otro día' la programa para el 2 de octubre");
  ok(d("2026-09-26").find(t => t.txt === "Ordenar bodega").estado === "soltada", "'Soltar' queda marcada");
  ok(s.vida.diario.some(e => e.fromRitualSemana && e.semana === "2026-09-21" && e.nota === 8 && e.gratitud === "Publicamos la web"), "entrada en el Diario");
  ok(s.gamif.ledger.some(m => m.id === "ritual-semana-cierre:2026-09-21" && m.delta === 75), "cierre da +75 ⭐");

  // Apertura encadenada (empieza en Foco y prioridades)
  const titulo = await p.locator("#modalTitle").innerText();
  const paso = await p.locator(".modal__body .text-xs.muted").first().innerText();
  ok(titulo.includes("Planificar la semana") && /Paso 2 de 4/i.test(paso), "tras cerrar, se abre la planificación de la próxima: " + titulo + " · " + paso);
  ok((await p.locator("#sem-wiz").innerText()).includes("Menos reuniones"), "muestra lo que anotaste para ajustar");
  const opciones = await p.locator("#sp-o-0 option").allInnerTexts();
  ok(opciones.some(o => o.includes("Primeros 10 clientes")), "las prioridades se vinculan a los objetivos de octubre (mes de su jueves)");
  await p.fill("#sw-foco", "Clientes");
  await p.fill("#sp-t-0", "Cerrar 3 reuniones"); await p.selectOption("#sp-o-0", "obj-oct");
  await p.fill("#sp-t-1", "Correr 3 veces");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso: tus días
  await p.selectOption("#sp-d-0", "2026-09-29"); await p.waitForTimeout(150);
  ok(await p.locator(".semw-dia", { hasText: "Martes 29" }).locator(".chip", { hasText: "Cerrar 3 reuniones" }).count() === 1, "la prioridad aparece en el martes");
  ok(await p.locator(".semw-dia", { hasText: "Lunes 28" }).locator(".chip", { hasText: "Revisar contrato" }).count() === 1, "el lunes muestra lo que viene migrado");
  await p.fill("#sw-in-2", "Preparar propuesta"); await p.press("#sw-in-2", "Enter"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id) === "sw-in-2", "tras agregar, el foco vuelve al campo del día");
  await p.fill("#sw-in-2", "Borrar esta"); await p.click('[data-action="semw-add"][data-i="2"]'); await p.waitForTimeout(150);
  await p.locator('.semw-dia', { hasText: "Miércoles 30" }).locator('.chip', { hasText: "Borrar esta" }).locator(".chip-x").click(); await p.waitForTimeout(150);
  const mie = await p.locator(".semw-dia", { hasText: "Miércoles 30" }).innerText();
  ok(mie.includes("Preparar propuesta") && !mie.includes("Borrar esta"), "agregar con Enter y quitar una tarea del día");
  await shot(p, "f4-apertura-dias");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  // Paso: premio y hábitos (máx 3)
  await p.fill("#sw-premio", "Película con palomitas");
  const cbs = p.locator(".sw-hab");
  for (let i = 0; i < 4; i++) await cbs.nth(i).check().catch(() => {});
  ok(await p.locator(".sw-hab:checked").count() === 3, "hábitos en foco: máximo 3");
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(300);

  s = await p.evaluate(() => STATE);
  const ap = s.ritual.semanas["2026-09-28"].apertura;
  ok(ap && ap.foco === "Clientes" && ap.prioridades.length === 2 && ap.prioridades[0].objId === "obj-oct" && ap.habitosFoco.length === 3, "apertura guardada con foco, prioridades y hábitos");
  ok(d("2026-09-29").some(t => t.txt === "Cerrar 3 reuniones" && t.prioridad === ap.prioridades[0].id), "la prioridad con día queda como tarea 🎯 del martes");
  ok(d("2026-09-30").some(t => t.txt === "Preparar propuesta") && !d("2026-09-30").some(t => t.txt === "Borrar esta"), "las tareas del plan quedan en su día");
  ok(s.ritual.semanas["2026-09-28"].plan.premio === "Película con palomitas", "premio de la semana guardado");
  ok(s.gamif.ledger.some(m => m.id === "ritual-semana-apertura:2026-09-28"), "apertura da +75 ⭐");
  ok(s.gamif.badges.includes("semana-redonda"), "insignia 'Semana Redonda'");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator(".hero-focus", { hasText: "ritual semanal" }).count() === 0, "tras el ritual, el aviso desaparece");

  // Re-editar la apertura no duplica ni vuelve a pagar
  await p.evaluate(() => openSemApertura("2026-09-28"));
  for (let i = 0; i < 3; i++) { await p.click('[data-action="semw-next"]'); await p.waitForTimeout(100); }
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => STATE);
  ok(d("2026-09-29").filter(t => t.txt === "Cerrar 3 reuniones").length === 1 && s.gamif.ledger.filter(m => m.id === "ritual-semana-apertura:2026-09-28").length === 1, "editar el plan no duplica tareas ni monedas");

  // Vistas
  await p.goto(URL + "#ritual"); await p.waitForTimeout(200);
  await p.click('[data-action="ritual-view"][data-v="semana"]'); await p.waitForTimeout(300);
  const vista = await p.locator("#view").innerText();
  ok(vista.includes("Lanzamiento") && vista.includes("Publicar la web") && vista.includes("Editar plan de la próxima"), "Ritual → Semana muestra foco, prioridades y acciones");
  await shot(p, "f4-vista-semana", { fullPage: true });
  await p.locator("details.hb-more summary", { hasText: "día de ritual" }).click();
  await p.click('[data-action="sem-dia"][data-v="1"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.settings.ritualSemanal.dia) === 1, "se puede cambiar el día del ritual a lunes");
  await p.locator("details.hb-more summary", { hasText: "día de ritual" }).click().catch(() => {});
  await p.click('[data-action="sem-dia"][data-v="0"]'); await p.waitForTimeout(200);

  await p.goto(URL + "#diario"); await p.waitForTimeout(300);
  ok((await p.locator("#view").innerText()).includes("Cierre de semana"), "el Diario muestra el cierre de semana");
  await p.goto(URL + "#metas"); await p.waitForTimeout(300);
  const metasTxt = await p.locator("#view").innerText();
  ok(/2 prioridades semanales/.test(metasTxt), "Objetivos: el de septiembre muestra 2 prioridades semanales");
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  ok(/plan de la semana[\s\S]*Lanzamiento/i.test(await p.locator("#view").innerText()), "el Planificador muestra el plan de la semana");
  await p.click('[data-action="sem-nav"][data-dir="1"]'); await p.waitForTimeout(200);
  const plan28 = await p.locator("#view").innerText();
  ok(plan28.includes("Clientes") && plan28.includes("Cerrar 3 reuniones"), "…y el de la próxima semana");
  await shot(p, "f4-planificador");

  // Apertura del día: prioridades de la semana (lunes 28)
  const ctx2 = await nuevoContexto(b, { fecha: "2026-09-28T08:00:00", w: 390, h: 844, dpr: 2 });
  const q = await ctx2.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "f4m@test.cl");
  const datos = await p.evaluate(() => JSON.stringify(STATE));
  await q.evaluate(j => { STATE = migrate(JSON.parse(j)); saveState(); rerender(); }, datos);
  await q.evaluate(() => openRitualModal()); await q.waitForTimeout(150);
  ok((await q.locator(".sem-mini").innerText()).includes("Cerrar 3 reuniones"), "la apertura del día muestra las prioridades de la semana");
  await q.evaluate(() => closeModal());
  await q.goto(URL + "#ritual"); await q.waitForTimeout(200);
  await q.click('[data-action="ritual-view"][data-v="semana"]'); await q.waitForTimeout(300);
  ok(await q.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: Ritual → Semana sin scroll horizontal");
  await shot(q, "f4-movil-semana", { fullPage: true });
  await q.evaluate(() => openSemApertura("2026-09-28")); await q.waitForTimeout(100);
  await q.click('[data-action="semw-next"]'); await q.click('[data-action="semw-next"]'); await q.waitForTimeout(150);
  ok(await q.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: el paso 'Tus días' cabe en pantalla");
  await shot(q, "f4-movil-dias");
};
