/* Pruebas en navegador · 🧭 Norte, fase 2 (2026-11-20): tus alarmas en Cuenta › «Norte, tu brújula», la pregunta
   «¿A qué hora te despierto?» al cerrar el día (solo con un Norte conectado), «Recordar a las…» en Editar hábito y la
   bandeja nueva aplicada en la app (un recordatorio, el diario y una alcancía). Norte lo ve solo la cuenta dueña:
   aquí se hace como si lo fuera (esCuentaDuena) y el aparato conectado vive en el backend local (rumbo_norte_db). */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-11-20T21:30:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "norte-fase2@test.cl");
  await p.evaluate(() => { window.esCuentaDuena = () => true; });

  // 1) Cuenta lleva a la pantalla propia «Norte, tu brújula» (#norte); sin un Norte conectado no hay pregunta al cerrar el día
  await p.goto(URL + "#cuenta"); await p.waitForTimeout(500);
  ok(await p.locator('#view [data-route="norte"]').count() === 1 && await p.locator("#acc-norte").count() === 0, "Cuenta trae un acceso a «Norte, tu brújula» (ya no el bloque entero)");
  await p.click('#view [data-route="norte"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => CURRENT) === "norte" && await p.locator("#acc-norte [data-action=norte-conectar]").count() === 1, "su pantalla tiene los aparatos (conectar con código)");
  ok(await p.locator("#norte-alarmas").count() === 1 && await p.locator("#norte-avisos").count() === 1, "y también tus alarmas y los avisos de Norte");
  ok(await p.evaluate(() => { toggleMenuCuenta(); const v = !document.getElementById("cuentaMenuNorte").hidden; toggleMenuCuenta(); return v; }), "el menú de tu cuenta también lleva ahí");
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = { hecho: true, sapo: "Probar", ts: Date.now() }; saveState(); openExpressCierre(); });
  await p.waitForTimeout(300);
  ok(await p.locator("#c-despertar").count() === 0, "sin un Norte conectado, ni la pregunta del despertador al cerrar el día");
  await p.evaluate(() => closeModal());

  // 2) Con un Norte conectado: tus alarmas
  await p.evaluate(() => {
    const yo = localStorage.getItem("rumbo_session");
    localStorage.setItem("rumbo_norte_db", JSON.stringify({ aparatos: [{ id: "ap1", user_id: yo, nombre: "Norte", aparato: "AA:BB", creado: new Date().toISOString() }] }));
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(200);
  await p.goto(URL + "#norte"); await p.waitForTimeout(600);
  ok(/Todavía no tienes alarmas/.test(await p.locator("#norte-alarmas").innerText()) && /Conectado el/.test(await p.locator("#acc-norte").innerText()), "con un Norte conectado: el aparato en la lista y «Tus alarmas», vacía");
  await p.click('[data-action="norte-alarma-nueva"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => [...document.querySelectorAll("#na-dias input:checked")].map(x => +x.value).join()) === "1,2,3,4,5", "una alarma nueva parte de lunes a viernes");
  await p.fill("#na-hora", "06:45"); await p.fill("#na-nombre", "Despertar temprano");
  await p.click('[data-action="norte-alarma-guardar"]'); await p.waitForTimeout(300);
  const A1 = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.alarmas)));
  ok(A1.lista.length === 1 && A1.lista[0].hora === "06:45" && A1.lista[0].nombre === "Despertar temprano" && A1.lista[0].dias.join() === "1,2,3,4,5" && A1.lista[0].activa && A1.ts > 0,
    "la alarma queda en settings.norte.alarmas con su ts: " + JSON.stringify(A1.lista[0]));
  ok(/06:45 · Despertar temprano/.test(await p.locator("#norte-alarmas").innerText()) && /De lunes a viernes/.test(await p.locator("#norte-alarmas").innerText()), "y se ve en la lista con sus días");
  await shot(p, "norte-alarmas");
  // Escuchar los tonos antes de elegir: los 5 botones ▶ y sus MP3 se sirven
  ok(await p.locator('#norte-alarmas [data-action="norte-escuchar"]').count() === 5, "«Escúchalos»: un botón ▶ por cada uno de los 5 tonos");
  const tonos = await p.evaluate(async () => Promise.all(NORTE_SONIDOS.map(async ([v]) => { const r = await fetch(`assets/norte-sonidos/alarma_${v}.mp3`); return r.ok && (await r.arrayBuffer()).byteLength > 4000; })));
  ok(tonos.every(Boolean), "los 5 tonos están en assets/norte-sonidos (MP3): " + tonos.join());
  ok(await p.evaluate(() => { let src = ""; const A = window.Audio; window.Audio = function (u) { src = u; return { play: () => Promise.resolve(), pause() {} }; };
    document.querySelector('#norte-alarmas [data-action="norte-escuchar"][data-v="marimba"]').click(); window.Audio = A; return src; }) === "assets/norte-sonidos/alarma_marimba.mp3", "tocar ▶ Marimba la hace sonar");
  // apagarla con el interruptor
  await p.click('#norte-alarmas [data-action="norte-alarma-activa"]'); await p.waitForTimeout(300);
  const A2 = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.alarmas)));
  ok(A2.lista[0].activa === false && A2.ts > A1.ts, "el interruptor la apaga (y el cambio lleva una hora nueva)");
  // cambiarla: sin días suena una vez (con fecha)
  await p.click('#norte-alarmas [data-action="norte-alarma-editar"]'); await p.waitForTimeout(300);
  for (const v of [1, 2, 3, 4, 5]) await p.click(`#na-dias input[value="${v}"]`, { force: true });
  await p.click('[data-action="norte-alarma-guardar"]'); await p.waitForTimeout(300);
  const A3 = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.alarmas.lista[0])));
  ok(A3.dias.length === 0 && A3.fecha === "2026-11-21" && A3.activa, "sin días suena una vez: mañana (ya pasaron las 6:45) y vuelve a quedar encendida");
  // hora de dormir, amanecer y sonido
  await p.fill("#norte-dormir", "23:15"); await p.dispatchEvent("#norte-dormir", "change"); await p.waitForTimeout(300);
  await p.click('[data-el="contador"][data-el-id="norte-amanecer"] button[data-d="1"]'); await p.waitForTimeout(300);
  const A4 = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.alarmas)));
  ok(A4.dormir === "23:15" && A4.amanecer === 15, "la hora de dormir y el amanecer (de 10 a 15 minutos) se guardan: " + A4.dormir + " " + A4.amanecer);
  // borrar
  p.once("dialog", d => d.accept());
  await p.click('#norte-alarmas [data-action="norte-alarma-editar"]'); await p.waitForTimeout(300);
  await p.click('[data-action="norte-alarma-borrar"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.settings.norte.alarmas.lista.length) === 0, "y se puede borrar");

  // 2b) Avisos de Norte, modo noche, Norte aburrido y la pregunta del cierre (settings.norte.ajustes, con su ts)
  ok(await p.evaluate(() => [...document.querySelectorAll('#norte-avisos [data-action="norte-ajuste"]')].every(x => x.checked)), "los avisos parten todos encendidos, con la noche automática");
  await p.click('#norte-avisos [data-action="norte-ajuste"][data-k="agua"]'); await p.waitForTimeout(250);
  await p.click('#norte-avisos [data-action="norte-ajuste"][data-k="noche-auto"]'); await p.waitForTimeout(250);
  ok(await p.locator("#norte-noche-desde").count() === 1, "sin la noche automática, aparecen desde y hasta");
  await p.fill("#norte-noche-desde", "22:30"); await p.dispatchEvent("#norte-noche-desde", "change"); await p.waitForTimeout(250);
  await p.click('#norte-avisos [data-action="norte-ajuste"][data-k="aburrido"]'); await p.waitForTimeout(250);
  const AJ = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.ajustes)));
  ok(AJ.agua === false && AJ.agenda === true && AJ.noche.auto === false && AJ.noche.desde === "22:30" && AJ.noche.hasta === "07:00" && AJ.aburrido === false && AJ.pregunta_cierre === true && AJ.ts > 0,
    "quedan en settings.norte.ajustes con su ts: " + JSON.stringify(AJ));
  await shot(p, "norte-pantalla", { fullPage: true });

  // 3) Al cerrar el día: «¿A qué hora te despierto?» (opcional, con la hora de la última vez)
  await p.evaluate(() => openExpressCierre()); await p.waitForTimeout(300);
  ok(await p.locator("#c-despertar").count() === 1 && await p.inputValue("#c-despertar") === "07:00" && !(await p.isChecked("#c-despertar-on")),
    "en el cierre express aparece la pregunta, apagada y con 07:00 (todavía no hay una hora de antes)");
  await p.fill("#c-despertar", "06:30"); await p.dispatchEvent("#c-despertar", "input"); await p.waitForTimeout(100);
  ok(await p.isChecked("#c-despertar-on"), "al elegir una hora, queda encendida");
  await p.click('[data-action="express-cierre-save"]'); await p.waitForTimeout(500);
  const D = await p.evaluate(() => JSON.parse(JSON.stringify(STATE.settings.norte.alarmas.lista.find(a => a.id === "despertar") || null)));
  ok(D && D.hora === "06:30" && D.fecha === "2026-11-21" && D.dias.length === 0 && D.activa && D.nombre === "Despertar", "queda la alarma «despertar» de una vez para mañana: " + JSON.stringify(D));
  ok(await p.evaluate(() => !!(STATE.ritual.dias[todayISO()] || {}).cerrado), "y el día se cerró como siempre");
  // el cierre completo también pregunta, con la hora de ayer
  await p.evaluate(() => { STATE.ritual.dias[todayISO()].cerrado = false; saveState(); openCierreModal(todayISO()); }); await p.waitForTimeout(300);
  ok(await p.inputValue("#c-despertar") === "06:30" && await p.isChecked("#c-despertar-on"), "el cierre completo también pregunta, con la hora de la última vez puesta");
  await p.evaluate(() => { closeModal(); norteAjuste("pregunta_cierre", false); openCierreModal(todayISO()); }); await p.waitForTimeout(300);
  ok(await p.locator("#c-despertar").count() === 0, "con la pregunta apagada en «Norte, tu brújula», el cierre ya no pregunta");
  await p.evaluate(() => closeModal());

  // 4) Editar hábito › «Recordar a las…»
  await p.evaluate(() => { STATE.habitos.defs.push({ id: "hx", nombre: "Meditar", icon: "🧘", frecuencia: { tipo: "diario" }, creado: todayISO(), ts: 1 }); saveState(); openHabitModal("hx"); });
  await p.waitForTimeout(300);
  ok(await p.locator("#h-hora").count() === 1 && await p.inputValue("#h-hora") === "", "Editar hábito trae «Recordar a las…», vacío");
  await p.fill("#h-hora", "08:00");
  await p.click('[data-action="habit-save"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.habitos.defs.find(h => h.id === "hx").hora) === "08:00", "la hora queda en h.hora");
  await p.evaluate(() => openHabitModal("hx")); await p.waitForTimeout(300);
  await p.click("#h-hora-box .btn-link"); await p.click('[data-action="habit-save"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !("hora" in STATE.habitos.defs.find(h => h.id === "hx"))), "«Sin hora» la quita");

  // 5) La bandeja nueva, aplicada en la app: un recordatorio, el diario y una alcancía
  await p.evaluate(() => {
    const yo = localStorage.getItem("rumbo_session"), hoy = todayISO(), t = Date.now();
    STATE.alcancias = { lista: [{ id: "alz", nombre: "Viaje", meta: 100000, estilo: "greda", aportes: [], b: [], cerrada: 0, creada: t, ts: t }], borradas: [], ocultar: false, ts: t };
    saveState();
    localStorage.setItem("rumbo_norte_pend_" + yo, JSON.stringify([
      { id: "nf2rec00001", tipo: "recordatorio", datos: { op: "crear", id: "nrnf2rec00001", que: "Sacar la basura", cuando: t + 3600e3 }, creado: new Date(t - 3000).toISOString() },
      { id: "nf2dia00002", tipo: "diario", datos: { texto: "Lo dicté a Norte.", fecha: hoy }, creado: new Date(t - 2000).toISOString() },
      { id: "nf2alc00003", tipo: "alcancia", datos: { aid: "alz", monto: 5000, fecha: hoy, nombre: "Viaje" }, creado: new Date(t - 1000).toISOString() },
    ]));
  });
  await p.evaluate(() => nortePendientes()); await p.waitForTimeout(800);
  const B = await p.evaluate(() => ({
    rec: (STATE.settings.norte.recordatorios || []).map(r => r.id + "|" + r.que),
    dia: (STATE.vida.diario || []).filter(e => e.id === "ndnf2dia00002").map(e => e.texto),
    alc: STATE.alcancias.lista[0].aportes.map(x => x.id + "|" + x.monto),
    queda: localStorage.getItem("rumbo_norte_pend_" + localStorage.getItem("rumbo_session")),
  }));
  ok(B.rec.join() === "nrnf2rec00001|Sacar la basura" && B.dia.join() === "Lo dicté a Norte." && B.alc.join() === "nknf2alc00003|5000" && !B.queda,
    "la app aplica el recordatorio, el diario y la alcancía (con sus ids fijos) y vacía la bandeja: " + JSON.stringify(B));
  await ctx.close();
};
