/* Pruebas en navegador · Tutorial interactivo (recorrido guiado, ayuda por pantalla, misión y centro de tutoriales) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  // 1) Usuario nuevo: 3 láminas → formulario → recorrido guiado sobre la app real
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-09-26T10:00:00", w: 390, h: 844, dpr: 2 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(URL);
    await p.click('[data-tab="register"]');
    await p.fill("#reg-name", "Nueva"); await p.fill("#reg-email", "tour@test.cl"); await p.fill("#reg-pass", "secreto123");
    await p.click('[data-action="auth-register"]'); await p.waitForTimeout(900);
    for (let i = 0; i < 3; i++) { await p.click('[data-action="onb-next"]'); await p.waitForTimeout(120); }
    await p.fill("#ob-name", "Camila");
    await p.click('[data-action="onboarding-save"]'); await p.waitForTimeout(900);
    ok(await p.locator("#tour .tour-pop").isVisible(), "al terminar la introducción parte el recorrido guiado");
    const titulos = [];
    for (let i = 0; i < 15 && await p.locator("#tour").count(); i++) {
      titulos.push(await p.locator(".tour-pop__t").innerText());
      const pop = await p.locator(".tour-pop").boundingBox();
      if (pop.x < 0 || pop.y < 0 || pop.x + pop.width > 390 || pop.y + pop.height > 844) ok(false, "la burbuja se sale de la pantalla en: " + titulos[titulos.length - 1]);
      if (i === 2) await shot(p, "tour-tareas");
      await p.keyboard.press(i % 2 ? "ArrowRight" : "Enter"); await p.waitForTimeout(450);
    }
    ok(titulos.length === 11 && titulos.includes("Tu semana") && titulos.includes("Tu misión: primeros pasos"), "recorre los 11 pasos (Enter y →): " + titulos.join(" · "));
    const s = await p.evaluate(() => STATE.settings.tutorial);
    ok(s.vistos.general > 0 && s.mision === "activa", "queda como visto y la misión Primeros pasos activa");
    await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
    ok((await p.locator("[data-tour=mision]").innerText()).includes("0/6"), "Inicio muestra la misión 0/6");
    await ctx.close();
  }

  // 2) Misión, ayuda por pantalla, botón ?, pasos que no están y centro de tutoriales
  const ctx = await nuevoContexto(b, { fecha: "2026-09-26T10:00:00", w: 1280, h: 800 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "mision@test.cl");
  await p.evaluate(() => { STATE.settings.tutorial = { vistos: { general: 1 }, mision: "activa", auto: true, ts: 1 }; saveState(); });
  await p.goto(URL + "#semana"); await p.waitForTimeout(1100);
  ok((await p.locator(".tour-pop__t").innerText().catch(() => "")) === "Muévete entre semanas", "la primera vez en Semana aparece su ayuda");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  ok(await p.locator("#tour").count() === 0 && await p.evaluate(() => STATE.settings.tutorial.vistos.semana > 0), "Esc la cierra y queda vista");
  await p.goto(URL + "#habitos"); await p.waitForTimeout(100); await p.goto(URL + "#semana"); await p.waitForTimeout(1100);
  ok(await p.locator("#tour").count() === 0, "no se repite sola");
  await p.click("#helpBtn"); await p.waitForTimeout(300);
  ok((await p.locator(".tour-pop__t").innerText()) === "Muévete entre semanas", "el botón ? la repite");
  await p.click('[data-action="tour-salir"]'); await p.waitForTimeout(150);
  // Un paso cuyo elemento no existe se salta (no se queda pegado)
  const saltos = await p.evaluate(async () => {
    TOURS.prueba = { icon: "🧪", titulo: "Prueba", desc: "", pasos: [
      { titulo: "Uno" }, { ruta: "semana", el: "#no-existe", titulo: "Fantasma", texto: "" }, { ruta: "semana", el: ".sem-nav", titulo: "Tres", texto: "" }] };
    tourIniciar("prueba"); await new Promise(r => setTimeout(r, 100));
    tourMover(1); await new Promise(r => setTimeout(r, 700));
    const t = document.querySelector(".tour-pop__t").textContent;
    tourMover(-1); await new Promise(r => setTimeout(r, 700));
    const atras = document.querySelector(".tour-pop__t").textContent;
    tourTerminar(); delete TOURS.prueba; return [t, atras];
  });
  ok(saltos[0] === "Tres" && saltos[1] === "Uno", "un paso sin elemento se salta, hacia adelante y hacia atrás");
  // Módulo oculto: su ayuda no aparece en el centro de tutoriales
  await p.evaluate(() => { STATE.settings.menu = { ocultos: ["finanzas"], ts: 1 }; STATE.settings.tutorial.auto = false; saveState(); buildNav(); });
  await p.goto(URL + "#tutoriales"); await p.waitForTimeout(300);
  const centro = await p.locator("#view").innerText();
  ok(centro.includes("Recorrido por Rumbo") && centro.includes("Hábitos") && !centro.includes("Finanzas"), "centro de tutoriales: recorrido, ayuda por pantalla y sin módulos ocultos");
  await shot(p, "tutoriales");
  // Misión: se marca sola; completa → insignia Explorador y +100 ⭐
  await p.evaluate(() => {
    const S = STATE;
    S.ritual.dias["2026-09-26"] = { hecho: true, cerrado: true, ts: 1 };
    const t = nuevaTarea(S, "2026-09-26", { txt: "Lo importante" }); t.esSapo = true; marcarTarea(t, "hecha");
    S.habitos.log["2026-9"] = { [S.habitos.defs[0].id]: { 26: true } };
    saveState();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok((await p.locator("[data-tour=mision]").innerText()).includes("4/6"), "la misión cuenta lo hecho (4/6)");
  await p.click('[data-tour=mision] [data-action="mision-ir"][data-ruta="metas"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => CURRENT) === "metas", "cada paso pendiente lleva a su pantalla");
  await p.evaluate(() => {
    STATE.metas.mensuales[8].push({ id: "o1", texto: "Lanzar la web", ts: 1 });
    STATE.ritual.semanas = STATE.ritual.semanas || {};
    STATE.ritual.semanas["2026-09-21"] = Object.assign(STATE.ritual.semanas["2026-09-21"] || {}, { apertura: { foco: "Constancia", prioridades: [], ts: 1 } });
    saveState();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  const st = await p.evaluate(() => ({ badge: STATE.gamif.badges.includes("explorador"), mov: STATE.gamif.ledger.some(m => m.id === "insignia:explorador" && m.delta === 100) }));
  ok(st.badge && st.mov && (await p.locator("[data-tour=mision]").innerText()).includes("Completaste"), "misión completa: insignia Explorador y +100 ⭐");
  await p.click('[data-action="mision-cerrar"]'); await p.waitForTimeout(200);
  ok(await p.locator("[data-tour=mision]").count() === 0 && await p.evaluate(() => STATE.settings.tutorial.mision) === "completada", "Genial la cierra");
  await ctx.close();

  // 3) Quien ya usaba la app: Novedades ofrece el recorrido una vez
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-09-26T10:00:00" });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await registrar(p, "antiguo@test.cl");
    await p.evaluate(() => { STATE.settings.introVersion = 8; delete STATE.settings.tutorial; STATE = migrate(STATE); saveState(); });
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    ok((await p.locator("#modalBody").innerText()).includes("Tutorial interactivo") && await p.evaluate(() => STATE.settings.tutorial.mision) === "oculta",
      "Novedades anuncia el tutorial; la misión queda oculta para quien ya usaba la app");
    await p.click('[data-action="tour-start"][data-id="general"]'); await p.waitForTimeout(400);
    ok(await p.locator("#tour").count() === 1 && await p.evaluate(() => STATE.settings.introVersion) === 9, "Hacer el recorrido lo inicia y no vuelve a mostrar Novedades");
    await ctx.close();
  }
};
