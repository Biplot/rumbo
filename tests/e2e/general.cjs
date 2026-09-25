/* Pruebas en navegador · Novedades, usuario v45 y todas las pantallas */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
/* Fase 5 · QA general: novedades por versión, introducción, usuario v45 y todas las pantallas */
module.exports = async ({ b, ok, errs }) => {
  // 1) Novedades: quien quedó en la 1 ve las de la 3 y "también llegó antes"; quien quedó en la 2, solo las de la 3
  for (const [iv, esperaAntes] of [[1, true], [2, false]]) {
    const ctx = await nuevoContexto(b, { fecha: "2026-09-25T10:00:00" });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await registrar(p, `nov${iv}@test.cl`);
    await p.evaluate(v => { STATE.settings.introVersion = v; saveState(); }, iv);
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    const t = await p.locator("#modalBody").innerText().catch(() => "");
    ok(t.includes("Ritual de semana") && t.includes("Posponer al cerrar el día") && (/también llegó antes/i.test(t) === esperaAntes) && (t.includes("Temas nuevos") === esperaAntes),
      `novedades para quien quedó en la versión ${iv}` + (esperaAntes ? " (incluye las de la 2)" : " (solo las de la 3)"));
    if (iv === 1) await shot(p, "f5-novedades");
    await p.click('[data-action="onb-done"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => STATE.settings.introVersion) === 3, "al cerrar, queda en la versión 3");
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    ok(await p.locator("#modalOverlay").isHidden(), "no se vuelve a mostrar");
    await ctx.close();
  }

  // 2) Introducción para usuarios nuevos
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-09-25T10:00:00" });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(URL);
    await p.click('[data-tab="register"]');
    await p.fill("#reg-name", "Nueva"); await p.fill("#reg-email", "nueva@test.cl"); await p.fill("#reg-pass", "secreto123");
    await p.click('[data-action="auth-register"]'); await p.waitForTimeout(900);
    const titulos = [];
    for (let i = 0; i < 12; i++) {
      const t = await p.locator(".onb-title").innerText().catch(() => null);
      if (!t) break;
      titulos.push(t);
      await p.click('[data-action="onb-next"]'); await p.waitForTimeout(120);
    }
    ok(titulos.includes("Tu registro diario") && titulos.includes("Ritual de semana") && titulos.length === 9, "la introducción tiene 9 láminas: " + titulos.join(" · "));
    ok(await p.locator("#ob-name").count() === 1, "termina en el formulario");
    await ctx.close();
  }

  // 3) Usuario de la v45: tareas en el planificador viejo, sin agenda ni día de ritual semanal
  const ctx = await nuevoContexto(b, { fecha: "2026-09-25T10:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "v45@test.cl");
  await p.evaluate(() => {
    const s = JSON.parse(JSON.stringify(STATE));
    delete s.agenda; delete s.settings.ritualSemanal; delete s.ritual.semanas;
    s.semana = { weekOf: "2026-09-21", premio: "Helado", borradas: [], dias: [
      [{ id: "v1", txt: "Tarea del lunes", done: true, ambito: "pro", ts: 5 }], [],
      [{ id: "v2", txt: "Tarea del miércoles", done: false, ambito: "per", esSapo: true, ts: 6 }], [],
      [{ id: "v3", txt: "Tarea de hoy", done: false, ambito: "pro", ts: 7 }], [], []] };
    STATE = migrate(s); saveState(); rerender();
  });
  let s = await p.evaluate(() => STATE);
  ok(s.agenda.dias["2026-09-21"][0].txt === "Tarea del lunes" && s.agenda.dias["2026-09-23"][0].esSapo && s.agenda.dias["2026-09-25"][0].txt === "Tarea de hoy", "las tareas de la v45 pasan a su fecha");
  ok(s.settings.ritualSemanal.dia === 0 && s.ritual.semanas["2026-09-21"].plan.premio === "Helado", "día del ritual por defecto y premio conservado");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  const ini = await p.locator("#view").innerText();
  ok(ini.includes("Tarea de hoy") && /1 pendiente de días anteriores/.test(ini), "Inicio: la tarea de hoy y la bandeja con la del miércoles");
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  const sem = await p.locator("#view").innerText();
  ok(sem.includes("Tarea del lunes") && sem.includes("Tarea del miércoles") && sem.includes("Tarea de hoy"), "el planificador muestra las tareas migradas");

  // Librería de Supabase guardada en el repositorio e insignia "A Medio Camino" con meta 0
  ok(await p.evaluate(() => typeof supabase !== "undefined" && typeof supabase.createClient === "function"), "supabase-js 2.117.2 carga desde el repositorio");
  const medio = await p.evaluate(() => { STATE.finanzas.metaAnual = 0; checkBadges(); return STATE.gamif.badges.includes("medio-camino"); });
  ok(!medio, "con meta anual 0 no se entrega 'A Medio Camino'");

  // 4) Todas las pantallas, escritorio y móvil, sin errores
  const rutas = await p.evaluate(() => ROUTES.map(r => r.id));
  for (const r of rutas) { await p.goto(URL + "#" + r); await p.waitForTimeout(150); }
  for (const v of ["dia", "semana", "mes"]) { await p.goto(URL + "#ritual"); await p.waitForTimeout(100); await p.click(`[data-action="ritual-view"][data-v="${v}"]`); await p.waitForTimeout(150); }
  ok(true, `escritorio: ${rutas.length} pantallas + Ritual día/semana/mes`);
  const datos = await p.evaluate(() => JSON.stringify(STATE));
  const m = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-09-25T10:00:00", dpr: 1 });
  const q = await m.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "movil5@test.cl");
  await q.evaluate(j => { STATE = migrate(JSON.parse(j)); saveState(); }, datos);
  const anchas = [];
  for (const r of rutas) {
    await q.goto(URL + "#" + r); await q.waitForTimeout(150);
    const w = await q.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) anchas.push(`${r}:${w}`);
  }
  ok(!anchas.length, "móvil 390 px: ninguna pantalla con scroll horizontal " + (anchas.length ? anchas.join(", ") : ""));
  // Modales principales en móvil
  const anchasModal = [];
  for (const fn of ["openRitualModal()", "openCierreModal()", "openBandeja()", "openSemApertura(agLunes(todayISO()))", "openSemCierre(agSumar(agLunes(todayISO()), -7))"]) {
    await q.evaluate(f => { closeModal(); eval(f); }, fn); await q.waitForTimeout(150);
    const w = await q.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) anchasModal.push(fn + ":" + w);
  }
  ok(!anchasModal.length, "móvil: apertura, cierre, bandeja y asistentes de semana caben en pantalla");
};
