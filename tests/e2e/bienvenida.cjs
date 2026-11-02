/* Pruebas en navegador · 👋 Bienvenida: quien recién llega. El acceso parte en «Crear cuenta» en un
   equipo nuevo; «Arma tu Rumbo» pregunta (qué ordenar, sus hábitos con una rutina de regalo, su elefante
   con nombre y los avisos); el recorrido lo cuenta el elefante; el primer día no pide cerrar meses y abre
   el día en versión corta; sin hábitos, el primero a un toque; los avisos cortos van arriba con una hoja. */
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

  // 2) Crear la cuenta: «Arma tu Rumbo» saluda por su nombre y pregunta en vez de explicar
  await p.fill("#reg-name", "Camila Rojas"); await p.fill("#reg-email", "camila@test.cl"); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok((await p.locator("#modalTitle").innerText()).includes("¡Hola, Camila!") && /¿Qué quieres ordenar primero\?/.test(await p.locator("#modal").innerText()), "«¡Hola, Camila!» y la primera pregunta: ¿qué quieres ordenar primero?");
  ok(await p.locator("#toast").isHidden() && !/Bienvenido/.test(await p.locator("#modal").innerText()), "sin «Bienvenido» y sin un aviso encima");
  ok(await p.evaluate(() => STATE.settings.alta) === "2026-11-02", "la cuenta guarda su día: 2 de noviembre");
  ok(await p.locator('.arma-chip.is-on').count() === 2, "parten marcados «Mi día» y «Mis hábitos»");
  await p.click('.arma-chip[data-id="plata"]'); await p.waitForTimeout(100);
  await shot(p, "bienvenida-ordenar");
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(250);

  // Sus hábitos: hasta 3, y una rutina armada de regalo
  ok((await p.locator("#modalTitle").innerText()) === "Tus primeros hábitos", "paso 2: tus primeros hábitos");
  for (const id of ["leer", "caminar", "fumar", "meditar"]) { await p.click(`.arma-chip[data-id="${id}"]`); await p.waitForTimeout(120); }
  ok(await p.locator(".arma-chip--hab.is-on").count() === 3, "con 3 basta: el cuarto no entra");
  await p.click('.arma-rutina[data-id="finanzas"]'); await p.waitForTimeout(150);
  ok(/Plantar 5 hábitos/.test(await p.locator('#modal [data-action="arma-sig"]').innerText()), "la rutina suma sus 2 hábitos: «Plantar 5 hábitos»");
  await shot(p, "bienvenida-habitos");
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(250);

  // Su elefante, con nombre
  ok((await p.locator("#modalTitle").innerText()) === "Te presento a tu compañero" && await p.locator(".arma-ele svg").count() === 1, "paso 3: tu elefante, dibujado");
  await p.click('#modal [data-action="arma-tipo"][data-id="asiatico"]'); await p.waitForTimeout(150);
  await p.fill("#arma-nombre", "Tito");
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(300);

  // Los avisos, con su hora y la voz de Tito
  ok((await p.locator("#modalTitle").innerText()) === "¿Cuándo te aviso?" && /Tito/.test(await p.locator(".arma-burbuja").innerText()), "paso 4: ¿cuándo te aviso?, lo dice Tito");
  await shot(p, "bienvenida-avisos");
  await p.click('#modal [data-action="arma-fin"]'); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ habs: STATE.habitos.defs.map(h => h.nombre), ele: STATE.gamif.equipped.ele, areas: STATE.settings.bienvenida.areas, on: STATE.settings.onboarded, puntos: STATE.gamif.puntos, regalo: funcion("plantilla-finanzas") }));
  ok(st.on && st.habs.length === 5 && st.habs.includes("Dejar de fumar") && st.habs.includes("Anotar mis gastos") && !st.habs.includes("Deporte"), "sus 5 hábitos, sin los 8 de fábrica: " + st.habs.join(", "));
  ok(st.regalo && st.puntos === 0, "la rutina armada, de regalo (sin gastar ⭐)");
  ok(st.ele.tipo === "asiatico" && st.ele.nombre === "Tito" && st.areas.includes("plata"), "su elefante asiático se llama Tito y quiere ordenar su plata");

  // El recorrido lo cuenta Tito
  ok(await p.locator("#tour").count() === 1 && /Tito/.test(await p.locator(".tour-pop").innerText()) && /Soy Tito, tu elefante/.test(await p.locator(".tour-pop__b").innerText()), "parte el recorrido y lo cuenta Tito");
  await p.evaluate(() => tourTerminar()); await p.waitForTimeout(300);

  // 3) Inicio del primer día: una sola cosa por hacer, sin meses que cerrar ni la portilla flotando
  await p.evaluate(() => { STATE.settings.tutorial.auto = false; saveState(); go("inicio"); rerender(); }); await p.waitForTimeout(1200);
  const ini = await p.locator("#view").innerText();
  ok(/Hoy solo una cosa, Camila/.test(ini) && /Tito/.test(await p.locator(".guia").innerText()), "Tito dice qué hacer: «Hoy solo una cosa, Camila: abre tu día»");
  ok(!/Cierra Octubre/i.test(ini) && await p.locator('#view [data-action="mes-open"], #view [data-action="mes-close"], #view [data-action="sem-ritual"], #view [data-action="tri-ritual"]').count() === 0, "sin rituales grandes el primer día (ni cerrar octubre, que no vivió)");
  ok(await p.evaluate(() => { const m = document.querySelector("[data-tour=mision]"), a = document.querySelector(".atajos"); return !!m && (!a || (m.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)); }), "la misión va arriba, junto a su día");
  ok(await p.evaluate(() => { const f = document.getElementById("aguaFab"); return !f || f.hidden; }), "la portilla de agua espera el primer vaso");
  await shot(p, "bienvenida-inicio", { fullPage: true });

  // Abrir el primer día, en versión corta
  await p.click("#bbDia"); await p.waitForTimeout(400);
  ok(await p.locator("#r-mas").count() === 1 && !(await p.locator("#r-mas").evaluate(d => d.open)) && await p.inputValue("#r-pilar") === "", "abrir el día: pilar, energía y a quién sirves, plegados en «Más para tu día» (y sin pilar elegido)");
  ok(/Un bocado a la vez/.test(await p.locator("#modal").innerText()), "el primer bocado se explica en una línea");
  await p.fill("#r-sapo", "Enviar la propuesta");
  await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(900);
  const dia = await p.evaluate(() => ({ r: STATE.ritual.dias[todayISO()], pil: Object.values(STATE.ritual.pilares).reduce((a, b) => a + b, 0) }));
  ok(dia.r.hecho && dia.r.pilar === "" && dia.pil === 0, "el día queda abierto sin inventar un pilar");
  ok(/Abriste tu primer día/.test(await p.locator("#eleEscena").innerText().catch(() => "")), "Tito celebra el primer día y cuenta qué hacer con las ⭐");
  await p.click('#eleEscena [data-cerrar]').catch(() => {}); await p.waitForTimeout(200);
  ok(/a tu primer bocado/.test(await p.locator(".guia").innerText()), "después, Tito apunta al primer bocado");
  await p.evaluate(() => openRitualModal()); await p.waitForTimeout(400);   // editar la apertura de hoy
  await p.click("#r-mas > summary"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => STATE.settings.aperturaMas === true), "abrir «Más para tu día» se recuerda para la próxima");
  await p.evaluate(() => closeModal());

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

  // 6) «Saltar y ver todo»: sin hábitos de fábrica, todo a la vista y el recorrido igual
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(400);
    await p.fill("#reg-name", "Leo"); await p.fill("#reg-email", "leo@test.cl"); await p.fill("#reg-pass", "secreto123");
    await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    await p.click('#modal [data-action="arma-saltar"]'); await p.waitForTimeout(900);
    const st = await p.evaluate(() => ({ on: STATE.settings.onboarded, n: STATE.habitos.defs.length, todo: STATE.settings.bienvenida.verTodo, tour: !!TOUR }));
    ok(st.on && st.n === 0 && st.todo && st.tour, "saltar: queda lista, sin los 8 hábitos de fábrica, con todo a la vista y su recorrido");
    await ctx.close();
  }
};
