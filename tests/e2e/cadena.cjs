/* Pruebas en navegador · 📅 Tu semana, tu mes y tu trimestre, desde tu día (rituales-cadena.js):
   el lunes, al abrir tu día, primero la semana (obligatoria) y la pasada (opcional), con barra de avance y tu día
   al final con la misión que viene de tu semana; si cierras a mitad, vuelve a aparecer; el recordatorio chico de
   Inicio; el día 1 (cerrar y abrir el mes, opcionales, «Hoy solo mi día», también con ⚡ Express); y el domingo,
   al cerrar tu día, «Después, dejar lista mi semana». */
const { URL, nuevoContexto, registrar, shot, elegirEn } = require("./lib.cjs");

async function preparar(b, fecha, email, prep) {
  const ctx = await nuevoContexto(b, { fecha, w: 390, h: 844 });
  const p = await ctx.newPage();
  await registrar(p, email);
  await p.evaluate(prep || (() => {}));
  await p.evaluate(() => { localStorage.removeItem("rumbo-sin-cadena"); saveState(); });
  return { ctx, p };
}
const titulo = p => p.locator("#modalTitle").innerText();
const abierto = p => p.evaluate(() => !document.getElementById("modalOverlay").hidden);

module.exports = async ({ b, ok, errs }) => {
  // 1) Lunes 16 de noviembre: la semana pasada tuvo días; nada abierto
  let { ctx, p } = await preparar(b, "2026-11-16T09:00:00", "cadena-lunes@test.cl", () => {
    STATE.ritual.dias["2026-11-10"] = { hecho: true, cerrado: true, mision: "Algo", cierre: { nota: "x" }, ts: 1 };
    saveState();
  });
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  const aviso = await p.locator("#view .cad-aviso").innerText().catch(() => "");
  ok(/al abrir tu día, también cierras la semana pasada y abres tu semana/.test(aviso), "Inicio avisa en chico lo que viene al abrir el día: " + aviso);
  ok(await p.locator("#view .hero-focus [data-action='sem-ritual']").count() === 0, "ya no está la tarjeta grande del ritual semanal");

  await p.click('#view [data-action="day-open"]'); await p.waitForTimeout(300);
  ok((await titulo(p)) === "Empieza una semana nueva", "al abrir tu día, primero «Empieza una semana nueva»");
  ok(await p.locator("#cad-lista .cad-fila").count() === 3 && (await p.locator("#cad-lista").innerText()).includes("Abrir tu lunes"), "cerrar la pasada, abrir esta y, al final, tu lunes");
  ok(await p.locator("#cad-1").isDisabled() && await p.locator("#cad-1").isChecked() && await p.locator('[data-action="cadena-saltar"]').count() === 0,
    "abrir la semana es obligatorio: no se puede desmarcar ni saltar");
  await shot(p, "cadena-lunes");
  const antes = await p.locator("#cad-ir").innerText();
  await p.locator("#cad-0").uncheck(); await p.waitForTimeout(100);
  const despues = await p.locator("#cad-ir").innerText();
  ok(antes.includes("12 min") && despues.includes("7 min"), "los minutos siguen a lo marcado: " + antes + " → " + despues);
  await p.click('[data-action="cadena-empezar"]'); await p.waitForTimeout(300);
  ok((await p.locator("#modal .cad-barra small").innerText()).toLowerCase().includes("1 de 2 · abrir la semana") && (await titulo(p)).includes("Planificar la semana"),
    "sigue con la planificación de la semana, con su barra de avance");

  // Cerrar a mitad: el día no se abre y la próxima vez vuelve a aparecer
  await p.click('#modal [data-action="close-modal"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !(STATE.ritual.dias[todayISO()] || {}).hecho), "si cierras a mitad, tu día sigue sin abrir");
  await p.click('#view [data-action="day-open"]'); await p.waitForTimeout(300);
  ok((await titulo(p)) === "Empieza una semana nueva" && await p.locator("#cad-lista .cad-fila").count() === 2, "al volver, la semana sigue esperando (lo desmarcado, para mañana)");
  await p.click('[data-action="cadena-empezar"]'); await p.waitForTimeout(300);
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  await p.fill("#sw-foco", "Clientes");
  await p.fill("#sp-t-0", "Llamar a los 3 clientes nuevos");
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  await elegirEn(p, "sp-d-0", "2026-11-16"); await p.waitForTimeout(150);
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150);
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => !!(STATE.ritual.semanas["2026-11-16"] || {}).apertura), "la semana queda abierta (+75 ⭐)");
  ok((await titulo(p)) === "Ritual de apertura" && (await p.locator("#modal .cad-barra small").innerText()).toLowerCase().includes("2 de 2 · tu día"), "al final, tu día, con la barra en 2 de 2");
  ok(await p.inputValue("#r-mision") === "Llamar a los 3 clientes nuevos" && (await p.locator("#modal").innerText()).includes("Viene de la prioridad"),
    "tu misión sale de la prioridad que dejaste para hoy");
  await shot(p, "cadena-dia");
  await p.click('#modal [data-action="ritual-save"]'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => !!(STATE.ritual.dias[todayISO()] || {}).hecho), "tu día queda abierto");

  // Lo que quedó para después: recordatorio chico con «Hacerlo ahora»
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok((await p.locator("#view .cad-aviso").innerText()).includes("Te quedó pendiente cerrar la semana pasada"), "Inicio recuerda en chico lo que dejaste para después");
  await p.click('#view [data-action="cadena-retomar"]'); await p.waitForTimeout(300);
  ok(!(await p.locator("#cad-lista").innerText()).includes("Abrir tu") && await p.locator('#modal [data-action="close-modal"]', { hasText: "Ahora no" }).count() === 1, "sin tu día (ya abierto) y con «Ahora no»");
  await p.click('[data-action="cadena-empezar"]'); await p.waitForTimeout(300);
  ok((await p.locator("#modal .cad-barra small").innerText()).toLowerCase().includes("1 de 1 · cerrar la semana"), "cierra la semana pasada con su barra");
  for (let i = 0; i < 4; i++) { await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150); }
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => !!(STATE.ritual.semanas["2026-11-09"] || {}).cierre) && !(await abierto(p)), "la semana pasada queda cerrada y la ventana se cierra");
  ok(await p.evaluate(() => !document.querySelector("#view .cad-aviso")), "ya no queda recordatorio");
  await ctx.close();

  // 2) Martes 1 de diciembre con ⚡ Express: el mes se puede dejar para mañana
  ({ ctx, p } = await preparar(b, "2026-12-01T08:30:00", "cadena-mes@test.cl", () => {
    STATE.ritual.semanas["2026-11-30"] = { apertura: { foco: "x", prioridades: [], habitosFoco: [], ts: 1 } };
    saveState();
  }));
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  await p.click('#view [data-action="day-open-express"]'); await p.waitForTimeout(300);
  ok((await titulo(p)) === "Empieza diciembre" && (await p.locator("#cad-lista").innerText()).includes("Cerrar noviembre"), "el día 1: «Empieza diciembre», con cerrar noviembre y abrir diciembre");
  ok(!(await p.locator("#cad-0").isDisabled()) && await p.locator('[data-action="cadena-saltar"]').count() === 1, "el mes no es obligatorio: «Hoy solo mi día»");
  await p.click('[data-action="cadena-saltar"]'); await p.waitForTimeout(300);
  ok((await titulo(p)).includes("express") && await p.locator("#modal .cad-barra").count() === 0, "«Hoy solo mi día» abre tu día express directo");
  await p.click('#modal [data-action="express-apertura-save"]'); await p.waitForTimeout(300);
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok((await p.locator("#view .cad-aviso").innerText()).includes("cerrar noviembre y abrir diciembre"), "y queda el recordatorio chico del mes");
  await ctx.close();

  // 3) Domingo 22 de noviembre, en la noche: al cerrar tu día, «Después, dejar lista mi semana»
  ({ ctx, p } = await preparar(b, "2026-11-22T21:00:00", "cadena-domingo@test.cl", () => {
    STATE.ritual.dias["2026-11-22"] = { hecho: true, mision: "Descansar", ts: 1 };
    STATE.ritual.semanas["2026-11-16"] = { apertura: { foco: "Clientes", prioridades: [{ id: "p1", texto: "Llamar", ambito: "pro", objId: "", dia: "" }], habitosFoco: [], ts: 1 } };
    saveState();
  }));
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  await p.evaluate(() => openCierreModal(todayISO())); await p.waitForTimeout(300);
  const dom = await p.locator("#modal .cad-domingo").innerText().catch(() => "");
  ok(dom.includes("Después, dejar lista mi semana") && dom.includes("23 al 29 de noviembre") && !(await p.locator("#c-semana").isChecked()), "el cierre del domingo ofrece dejar lista la semana, sin marcar: " + dom);
  await shot(p, "cadena-domingo");
  await p.locator("#c-semana").check();
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => STATE.ritual.dias["2026-11-22"].cerrado === true && STATE.settings.domingoSemana === true), "el día queda cerrado y se recuerda la elección para el próximo domingo");
  ok((await p.locator("#modal .cad-barra small").innerText()).toLowerCase().includes("1 de 2 · cerrar la semana"), "sigue con el cierre de la semana");
  for (let i = 0; i < 4; i++) { await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150); }
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(350);
  ok((await p.locator("#modal .cad-barra small").innerText()).toLowerCase().includes("2 de 2 · abrir la semana") && /Paso 2 de 5/i.test(await p.locator("#modal").innerText()),
    "y con la planificación de la próxima (sin repetir la mirada atrás)");
  await p.fill("#sw-foco", "Cerrar el año");
  await p.fill("#sp-t-0", "Enviar el informe");
  for (let i = 0; i < 3; i++) { await p.click('[data-action="semw-next"]'); await p.waitForTimeout(150); }
  await p.click('[data-action="semw-finish"]'); await p.waitForTimeout(350);
  const r = await p.evaluate(() => ({ cerrada: !!(STATE.ritual.semanas["2026-11-16"] || {}).cierre, abierta: !!(STATE.ritual.semanas["2026-11-23"] || {}).apertura, lunes: cadenaItems(new Date("2026-11-23T09:00:00")).length }));
  ok(r.cerrada && r.abierta && !(await abierto(p)), "la semana queda cerrada y la próxima planificada: " + JSON.stringify(r));
  ok(r.lunes === 0, "el lunes ya no hay nada que hacer antes de abrir tu día");
  await ctx.close();
};
