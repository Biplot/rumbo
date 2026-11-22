/* Pruebas en navegador · 👋 Bienvenida: quien recién llega. El acceso parte en «Crear cuenta» en un
   equipo nuevo; «Arma tu Rumbo» pregunta (sus hábitos o una rutina de regalo, su elefante con nombre y los
   avisos) y al terminar abre su primer día (sin recorrido); los avisos se ofrecen al abrir y al cerrar el
   primer día; «Tu primera semana» muestra solo el paso de hoy; de noche, «Deja listo mañana»; sin hábitos, el
   primero a un toque; los avisos cortos van arriba con una hoja. */
const { URL, nuevoContexto, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });   // lunes 2 de noviembre
  // Un Android que aún no responde el permiso de avisos (así aparece el paso «¿Cuándo te aviso?»)
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "default" }); } catch (e) {} });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));

  // 1) Acceso: en un equipo donde nunca se entró, parte en «Crear cuenta» y cuenta qué es Rumbo
  await p.goto(URL); await p.waitForTimeout(500);
  ok(await p.locator("#form-register").isVisible() && await p.locator("#form-login").isHidden(), "equipo nuevo: el acceso parte en «Crear cuenta»");
  ok(/en un solo lugar/.test(await p.locator(".auth__que").innerText()) && await p.locator('.auth__que a[href="conoce/"]').count() === 1, "una línea dice qué es Rumbo y enlaza a Conoce");
  await shot(p, "bienvenida-acceso");

  // 2) Crear la cuenta: «Arma tu Rumbo» saluda por su nombre y parte por sus hábitos (sin preguntar qué ordenar)
  await p.fill("#reg-name", "Camila Rojas"); await p.fill("#reg-email", "camila@test.cl"); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok((await p.locator("#modalTitle").innerText()).includes("¡Hola, Camila!") && /Tus primeros hábitos/.test(await p.locator("#modal").innerText()) && !/¿Qué quieres ordenar primero\?/.test(await p.locator("#modal").innerText()),
    "«¡Hola, Camila!» y la primera pregunta: sus hábitos (ya no «¿qué quieres ordenar primero?»)");
  ok(await p.locator("#toast").isHidden() && !/Bienvenido/.test(await p.locator("#modal").innerText()), "sin «Bienvenido» y sin un aviso encima");
  ok(await p.evaluate(() => STATE.settings.alta) === "2026-11-02", "la cuenta guarda su día: 2 de noviembre");
  ok(!/Cierra Octubre/i.test(await p.locator("#view").innerText()), "detrás de la bienvenida, Inicio ya no pide cerrar octubre");

  // Sus hábitos: hasta 3, o una rutina armada de regalo (no las dos cosas)
  for (const id of ["leer", "caminar", "fumar", "meditar"]) { await p.click(`.arma-chip[data-id="${id}"]`); await p.waitForTimeout(120); }
  ok(await p.locator(".arma-chip--hab.is-on").count() === 3, "con 3 basta: el cuarto no entra");
  await p.click('.arma-rutina[data-id="finanzas"]'); await p.waitForTimeout(150);
  ok(await p.locator(".arma-chip--hab.is-on").count() === 0 && /Plantar 2 hábitos/.test(await p.locator('#modal [data-action="arma-sig"]').innerText()), "elegir una rutina deja solo la rutina: «Plantar 2 hábitos» (antes sumaba 5)");
  for (const id of ["leer", "caminar", "fumar"]) { await p.click(`.arma-chip[data-id="${id}"]`); await p.waitForTimeout(120); }
  ok(await p.locator(".arma-rutina.is-on").count() === 0 && /Plantar 3 hábitos/.test(await p.locator('#modal [data-action="arma-sig"]').innerText()), "y elegir hábitos sueltos quita la rutina");
  const nav = await p.locator('#modal [data-action="arma-sig"]').boundingBox();
  ok(nav && nav.y + nav.height <= 844, "el botón para seguir queda a la vista, fijo abajo");
  await shot(p, "bienvenida-habitos");
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(250);

  // Su elefante, con nombre
  ok((await p.locator("#modalTitle").innerText()) === "Te presento a tu compañero" && await p.locator(".arma-ele svg").count() === 1, "paso 2: tu elefante, dibujado");
  await p.click('#modal [data-action="arma-tipo"][data-id="asiatico"]'); await p.waitForTimeout(150);
  await p.fill("#arma-nombre", "Tito");
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(300);

  // Los avisos, con su hora y la voz de Tito
  ok((await p.locator("#modalTitle").innerText()) === "¿Cuándo te aviso?" && /Tito/.test(await p.locator(".arma-burbuja").innerText()), "paso 3: ¿cuándo te aviso?, lo dice Tito");
  await shot(p, "bienvenida-avisos");
  await p.click('#modal [data-action="arma-fin"]'); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ habs: STATE.habitos.defs.map(h => h.nombre), ele: STATE.gamif.equipped.ele, on: STATE.settings.onboarded }));
  ok(st.on && st.habs.length === 3 && st.habs.includes("Dejar de fumar") && !st.habs.includes("Deporte"), "sus 3 hábitos, sin los 8 de fábrica: " + st.habs.join(", "));
  ok(st.ele.tipo === "asiatico" && st.ele.nombre === "Tito", "su elefante asiático se llama Tito");

  // Al terminar, directo a abrir su primer día (sin recorrido de globos)
  ok(await p.locator("#tour").count() === 0 && (await p.locator("#modalTitle").innerText()) === "Ritual de apertura", "al terminar se abre su primer día, sin recorrido encima");
  ok(await p.locator("#r-mas").count() === 1 && !(await p.locator("#r-mas").evaluate(d => d.open)) && await p.inputValue("#r-pilar") === "", "abrir el día: pilar, energía y a quién sirves, plegados en «Más para tu día» (y sin pilar elegido)");
  ok(/Un bocado a la vez/.test(await p.locator("#modal").innerText()), "el primer bocado se explica en una línea");
  await p.fill("#r-sapo", "Enviar la propuesta");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(900);
  const dia = await p.evaluate(() => ({ r: STATE.ritual.dias[todayISO()], pil: Object.values(STATE.ritual.pilares).reduce((a, b) => a + b, 0) }));
  ok(dia.r.hecho && dia.r.pilar === "" && dia.pil === 0, "el día queda abierto sin inventar un pilar");
  ok(/Abriste tu primer día/.test(await p.locator("#modalTitle").innerText()) && await p.locator('#modal [data-action="avisos-oferta-si"]').count() === 1 && /esta noche/i.test(await p.locator("#modal").innerText()),
    "al abrir el primer día: «¿Te aviso esta noche para cerrarlo?» (es cuando ya vio para qué sirve)");
  await shot(p, "bienvenida-oferta-avisos");
  await p.click('#modal [data-action="avisos-oferta-no"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!(STATE.settings.avisosOferta || {}).abrir), "se recuerda que ya se ofreció");

  // 3) Inicio del primer día: un solo paso a la vista, sin rituales grandes
  await p.evaluate(() => { go("inicio"); rerender(); }); await p.waitForTimeout(900);
  const ini = await p.locator("#view").innerText();
  ok(/a tu primer bocado/.test(await p.locator(".guia").innerText()), "después, Tito apunta al primer bocado");
  ok(await p.locator(".psem-hoy").count() === 1 && /Esta noche, ciérralo/.test(await p.locator(".psem-hoy").innerText()) && /día 1 de 7/.test(ini), "«Tu primera semana» muestra solo el paso de hoy: ciérralo esta noche");
  ok(!/Cierra Octubre/i.test(ini) && await p.locator('#view [data-action="mes-open"], #view [data-action="mes-close"], #view [data-action="sem-ritual"], #view [data-action="tri-ritual"]').count() === 0, "sin rituales grandes el primer día (ni cerrar octubre, que no vivió)");
  ok(await p.evaluate(() => { const f = document.getElementById("aguaFab"); return !f || f.hidden; }), "la portilla de agua espera el primer vaso");
  await shot(p, "bienvenida-inicio", { fullPage: true });
  await p.evaluate(() => openRitualModal()); await p.waitForTimeout(400);   // editar la apertura de hoy
  await p.click("#r-mas > summary"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => STATE.settings.aperturaMas === true), "abrir «Más para tu día» se recuerda para la próxima");
  await p.evaluate(() => closeModal());

  // Al cerrar el primer día: «¿Te aviso mañana para abrir tu día?»
  await p.evaluate(() => openCierreModal(todayISO())); await p.waitForTimeout(300);
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(1500);
  if (await p.evaluate(() => typeof CERCA !== "undefined" && !!CERCA.id)) { await p.evaluate(() => cerrarInsignia()); await p.waitForTimeout(900); }   // la medalla «Primer Paso» va primero
  ok((await p.locator("#modalTitle").innerText()).includes("¿Te aviso?") && /mañana/.test(await p.locator("#modal").innerText()), "al cerrar el primer día: «¿Te aviso mañana para abrir tu día?»");
  await p.click('#modal [data-action="avisos-oferta-no"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { go("inicio"); rerender(); }); await p.waitForTimeout(400);
  ok(/Listo por hoy/.test(await p.locator(".psem-hoy").innerText()) && /Vuelve: abre y cierra tu 2.º día/.test(await p.locator(".psem").innerText()), "cerrado el día 1: «Listo por hoy» y lo que viene mañana es volver");

  // Hábitos sin hábitos: el primero a un toque
  await p.evaluate(() => { STATE.habitos.defs = []; saveState(); go("habitos"); rerender(); }); await p.waitForTimeout(300);
  ok(await p.locator(".hab-primero").isVisible(), "sin hábitos: «Tu primer hábito» con sugerencias");
  await p.click('.hab-primero [data-action="bv-hab"][data-id="dormir"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => STATE.habitos.defs.map(h => h.nombre).join()) === "Dormir antes de las 12", "tocar una sugerencia la agrega");

  // El nombre del elefante se cambia
  await p.evaluate(() => openNombreElefante()); await p.waitForTimeout(150);
  await p.fill("#ele-nombre", "Pancho"); await p.click('[data-action="ele-nombre-ok"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => nombreDelElefante()) === "Pancho", "el nombre del elefante se cambia");

  // 4) Avisos cortos: con una hoja abierta van arriba; sin nada abierto, abajo
  await p.evaluate(() => { go("inicio"); openModal("Prueba", "<p>Hola</p>"); toast("Arriba"); });
  const arriba = await p.locator("#toast").boundingBox();
  ok(arriba && arriba.y < 120, "con una hoja abierta, el aviso va arriba");
  await p.evaluate(() => { closeModal(); toast("Abajo"); });
  const abajo = await p.locator("#toast").boundingBox();
  ok(abajo && abajo.y > 500, "sin nada abierto, el aviso va abajo como siempre");

  // 5) Quien vuelve a un equipo donde ya entró: el acceso parte en «Iniciar sesión»
  await p.evaluate(() => BACKEND.logout && BACKEND.logout());
  await p.goto(URL); await p.waitForTimeout(500);
  if (await p.locator("#authScreen").isVisible()) ok(await p.locator("#form-login").isVisible(), "equipo con cuenta: parte en «Iniciar sesión»");
  else ok(true, "la sesión sigue abierta en este equipo");
  await ctx.close();

  // 6) «Saltar»: sin hábitos de fábrica, todo a la vista y directo a su primer día
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    await p.fill("#reg-name", "Leo"); await p.fill("#reg-email", "leo@test.cl"); await p.fill("#reg-pass", "secreto123");
    await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    await p.click('#modal [data-action="arma-saltar"]'); await p.waitForTimeout(900);
    const st = await p.evaluate(() => ({ on: STATE.settings.onboarded, n: STATE.habitos.defs.length, todo: STATE.settings.bienvenida.verTodo, tour: !!TOUR, titulo: document.getElementById("modalTitle").innerText }));
    ok(st.on && st.n === 0 && st.todo && !st.tour && st.titulo === "Ritual de apertura", "saltar: queda lista, sin hábitos de fábrica, con todo a la vista y directo a abrir su día: " + JSON.stringify(st));
    await ctx.close();
  }

  // 7) De noche: «Deja listo mañana» (y la primera semana parte mañana)
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-11-02T21:30:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    await p.fill("#reg-name", "Noa"); await p.fill("#reg-email", "noa@test.cl"); await p.fill("#reg-pass", "secreto123");
    await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    await p.click('#modal [data-action="arma-saltar"]'); await p.waitForTimeout(900);
    ok((await p.locator("#modalTitle").innerText()) === "Deja listo mañana", "a las 21:30 no pide abrir un día que ya termina: «Deja listo mañana»");
    await p.fill("#dl-mision", "Enviar la propuesta");
    await p.click('#modal [data-action="dl-guardar"]'); await p.waitForTimeout(400);
    const m = await p.evaluate(() => ({ mp: STATE.settings.mananaPrimera, alta: STATE.settings.alta }));
    ok(m.mp && m.mp.fecha === "2026-11-03" && m.mp.mision === "Enviar la propuesta" && m.alta === "2026-11-03", "queda anotado para mañana y su primera semana parte mañana: " + JSON.stringify(m));
    ok(/Enviar la propuesta/.test(await p.locator("#view .deja-listo").innerText().catch(() => "")), "Inicio le recuerda lo que dejó listo");
    await shot(p, "bienvenida-noche");
    await ctx.close();
  }
};
