/* Pruebas en navegador · ⏱️ El Foco (foco.js, foco-pantalla.js y foco-amigos.js): elegir en qué (el bocado primero), un
   hábito con duración que queda marcado solo (+5 ⭐), anotar algo para después, «en la barra», «¿qué sigue?» que te espera,
   un objetivo con su tiempo, leer con reloj (la página), ciclos con su descanso (+ un vaso), Tendencias, la Tienda («Tu
   foco»), el regalo a quien compró el modo enfoque y el foco con un amigo (Ana invita, Bruno se suma, parten juntos). */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-19T10:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", d => d.accept());
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const hora = async h => { await ctx.clock.setFixedTime(new Date("2026-11-19T" + h)); await p.waitForTimeout(1500); };
  const modal = () => p.locator("#modal").innerText();
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir(); await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(1200);
    await p.evaluate(() => closeModal());
  };

  await registrar(p, "ana@foco.cl");
  await p.evaluate(() => {
    STATE.profile.name = "Ana";
    STATE.habitos.defs.push({ id: "hi", nombre: "Estudiar inglés", icon: "🎓", frecuencia: { tipo: "diario" }, creado: "2026-11-01", minutos: 20 });
    const t = nuevaTarea(STATE, "2026-11-19", { txt: "Escribir la introducción", ambito: "pro" }); t.esSapo = true;
    nuevaTarea(STATE, "2026-11-19", { txt: "Preparar la reunión", ambito: "pro" });
    datosAnio(STATE, 2026, true).metas.mensuales[10].push({ id: "o1", texto: "Terminar la tesis", done: false, area: 2 });
    STATE.lecturas.push({ id: "l1", titulo: "Drácula", autor: "Stoker", estado: "leyendo", paginas: 418, pagina: 212, inicio: "2026-11-01" });
    saveState();
  });

  // 1) Sin comprar nada: «Enfocarme» en Tareas de hoy y en Hábitos el ▶ del hábito con duración
  await ir("inicio");
  ok(await p.locator('[data-action="foco-abrir"]').count() > 0, "«Enfocarme» está en Inicio para todos (ya no se compra)");
  await ir("habitos");
  ok(/20 min/.test(await p.locator('.hb-today[data-id="hi"] .hb-today__play').innerText()), "la tarjeta del hábito con duración trae su ▶ 20 min");
  await p.click('.hb-today[data-id="hi"] .hb-today__play'); await p.waitForTimeout(300);
  let t = await modal();
  ok(/¿En qué pones tu tiempo\?/.test(t) && /Hábitos con tiempo/i.test(t) && /Objetivos de noviembre/i.test(t) && /Lo que estás leyendo/i.test(t), "elegir en qué: hoy, hábitos con tiempo, objetivos y libros");
  ok(await p.locator('.fo-op.is-on').getAttribute("data-k") === "habito:hi" && (await p.locator("#fo-min .fo-chip.is-on").innerText()) === "20", "viene elegido el hábito, con sus 20 minutos");
  ok(await p.locator(".fo-op").first().getAttribute("data-k") === "tarea:" + await p.evaluate(() => tareasDelDia("2026-11-19").find(x => x.esSapo).id), "y el primer bocado va primero en la lista");
  await shot(p, "foco-elegir");
  await p.click('[data-action="foco-empezar"]'); await p.waitForTimeout(600);
  ok(await p.locator("#foco").isVisible() && /Estudiar inglés/.test(await p.locator(".foco__t").innerText()) && (await p.locator("#fo-num").innerText()) === "20:00", "la pantalla de foco: el hábito y 20:00");
  ok(await p.locator("#foco .foco__ele svg").count() === 1, "con tu elefante acompañándote");
  await shot(p, "foco-pantalla");

  // 2) Anotar algo para después (a tus tareas), y «en la barra»: la app libre con la píldora
  await p.click('[data-action="foco-anotar"]'); await p.fill("#fo-anota-txt", "Llamar al dentista"); await p.click('[data-action="foco-anota-tarea"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => tareasDelDia("2026-11-19").some(x => x.txt === "Llamar al dentista")) && /1 para después/.test(await p.locator("#fo-pend").innerText()), "lo anotado queda en tus tareas de hoy sin cortar la sesión");
  await p.click('[data-action="foco-barra"]'); await p.waitForTimeout(400);
  ok(await p.locator("#foco").isHidden() && await p.locator("#focoPill").isVisible() && /20:00/.test(await p.locator("#focoPill").innerText()), "«Ver la app»: la sesión sigue en la píldora de arriba");
  ok(await ancho() <= 390, "la barra de arriba cabe en el celular con la píldora");
  await shot(p, "foco-barra");
  await hora("10:10:00");
  ok(/10:00/.test(await p.locator("#focoPill").innerText()), "la píldora cuenta (quedan 10:00)");
  await p.click("#focoPill"); await p.waitForTimeout(300);
  ok(await p.locator("#foco").isVisible(), "tocar la píldora la abre en grande");

  // 3) Termina: el hábito queda marcado solo, +5 ⭐ y «¿qué sigue?»
  const pts0 = await p.evaluate(() => STATE.gamif.puntos);
  await hora("10:20:02");
  t = await modal();
  ok(/¡Tiempo! 20 min/.test(t) && /«Estudiar inglés» quedó marcado hoy/.test(t) && /\+5 .{0,3}por la sesión completa/.test(t), "al terminar: el hábito quedó marcado y +5 ⭐");
  ok(await p.evaluate(() => habitDoneDate("hi", new Date())), "el hábito de hoy está hecho");
  await p.click('.fo-cara[data-v="3"]'); await p.fill("#fo-sigue-txt", "Repasar los verbos irregulares"); await p.click('[data-action="foco-cierre-ok"]'); await p.waitForTimeout(300);
  const s1 = await p.evaluate(() => STATE.enfoque.sesiones[0]);
  ok(s1.real === 20 && s1.completa && s1.habId === "hi" && s1.conc === 3, "queda la sesión: 20 min, completa, del hábito y «muy enfocado»");
  ok(await p.evaluate(() => STATE.gamif.puntos) >= pts0 + 5 + 5, "+5 ⭐ del foco y +5 del hábito");
  await ir("habitos");
  ok(await p.locator('.hb-today[data-id="hi"] .hb-today__play').count() === 0, "hecho el hábito, ya no muestra su ▶");
  await p.evaluate(() => openFoco({ tipo: "habito", ref: "hi" })); await p.waitForTimeout(300);
  ok(/La última vez anotaste.*Repasar los verbos irregulares/is.test(await p.locator("#fo-sigue").innerText()), "«¿qué sigue?» te espera la próxima vez");
  await p.evaluate(() => closeModal());

  // 4) Un objetivo: 25 min con «en la barra» de inicio, su tiempo en Objetivos y sus semanas
  await ir("metas");
  await p.click('[data-action="foco-objetivo"][data-id="o1"]'); await p.waitForTimeout(300);
  await p.click('[data-action="foco-min"][data-v="25"]'); await p.click(".fo-mas > summary"); await p.click('[data-action="foco-modo"][data-v="barra"]');
  await p.click('[data-action="foco-empezar"]'); await p.waitForTimeout(500);
  ok(await p.locator("#foco").isHidden() && await p.locator("#focoPill").isVisible(), "«En la barra» desde el principio: la app sigue libre");
  await hora("10:45:05");
  await p.click('[data-action="foco-cierre-ok"]'); await p.waitForTimeout(300);
  await ir("metas");
  ok(/25 min de foco/.test(await p.locator('.fo-meta[data-id="o1"]').innerText()), "Objetivos: «⏱ 25 min de foco» bajo el objetivo");
  await p.click('.fo-meta[data-id="o1"]'); await p.waitForTimeout(300);
  ok(/25 min/.test(await modal()) && await p.locator(".fo-sem__c").count() === 4, "sus horas de las últimas 4 semanas");
  await p.evaluate(() => closeModal());

  // 5) Leer con reloj y ciclos: el descanso trae + un vaso; al terminar, la página
  await ir("lecturas");
  await p.click('[data-action="foco-libro"][data-id="l1"]'); await p.waitForTimeout(300);
  ok(await p.locator('.fo-op.is-on').getAttribute("data-k") === "libro:l1", "«Leer ahora» elige el libro");
  await p.click('[data-action="foco-min"][data-v="25"]'); await p.click('[data-action="foco-ritmo"][data-v="ciclos"]');
  await p.click(".fo-mas > summary"); await p.click('[data-action="foco-modo"][data-v="completa"]');
  ok(/4 × 25 min · descansos de 5 · uno largo de 15/.test(await p.locator("#fo-ritmo-txt").innerText()), "ciclos: 4 × 25 con sus descansos");
  await p.click('[data-action="foco-empezar"]'); await p.waitForTimeout(500);
  await hora("11:11:00");
  ok(/Descanso/i.test(await p.locator("#fo-k").innerText()) && await p.locator('[data-action="foco-vaso"]').isVisible(), "a los 25 min, el descanso con ideas para el cuerpo");
  await shot(p, "foco-descanso");
  const vasos0 = await p.evaluate(() => aguaTotal(aguaDia(todayISO())));
  await p.click('[data-action="foco-vaso"]'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => aguaTotal(aguaDia(todayISO()))) > vasos0, "«+ Un vaso» se anota en tu agua");
  await p.click('[data-action="foco-saltar"]'); await p.waitForTimeout(300);
  ok(/2 de 4/i.test(await p.locator("#fo-k").innerText()), "saltar el descanso: el bloque 2 de 4");
  await hora("11:20:00");
  await p.click('[data-action="foco-terminar"]'); await p.waitForTimeout(400);
  t = await modal();
  ok(/Sesión terminada · 34 min/.test(t) && /¿En qué página quedaste\?/.test(t), "terminar antes guarda lo hecho (25 + 9 min) y pregunta la página");
  await p.evaluate(() => { const c = document.querySelector('[data-el="contador"][data-el-id="fo-pag"]'); c.dataset.v = 248; document.getElementById("fo-pag").value = 248; });
  await p.click('[data-action="foco-cierre-ok"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.lecturas.find(l => l.id === "l1").pagina) === 248, "el libro avanzó a la página 248");

  // 6) Donde ya miras: Tendencias y el recibo del día
  await ir("tendencias");
  t = await p.locator("#view").innerText();
  ok(/Foco esta semana/.test(t) && /1 h 19/.test(t) && /Terminar la tesis/.test(t), "Tendencias: 1 h 19 esta semana y por objetivo");
  ok(await p.evaluate(() => focoReciboTxt("2026-11-19")) === "1 h 19", "el recibo del día: 1 h 19 de foco");

  // 7) La Tienda: «Tu foco» (relojes y sonidos); comprar la luna la deja lista
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-test", 2000, 0, "test"); saveState(); TIENDA_SEC = "estilo"; });
  await ir("tienda");
  ok(await p.locator('.ficha[data-cos="foco-luna"]').count() === 1 && await p.locator('.ficha[data-cos="foco-lluvia"]').count() === 1, "la Tienda trae «Tu foco»: la luna y la lluvia");
  await p.click('.ficha[data-cos="foco-luna"]'); await p.waitForTimeout(300);
  ok(await p.locator("#modal .fo-muestra svg").count() === 3, "con su muestra (cómo se llena)");
  await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => isOwned("foco-luna") && focoPref(STATE).estilo === "luna"), "comprada, la luna queda para la próxima sesión");

  // 8) Quien compró el modo enfoque recibe el reloj de arena y la lluvia
  await p.evaluate(() => { ledgerRegistrar(STATE, "compra:fun-enfoque", -600, 0, "Compra"); saveState(); });
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => isOwned("foco-arena") && isOwned("foco-lluvia")), "quien compró el modo enfoque recibe el reloj de arena y la lluvia");

  // 9) Con un amigo: Ana invita a Bruno, Bruno se suma y parten juntos con el mismo fin
  await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); }); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(500);
  const codA = await p.evaluate(() => AMIGOS.codigo), idA = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await salir(); await registrar(p, "bruno@foco.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@foco.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(500);
  await ir("inicio");
  await p.click('[data-action="foco-abrir"]'); await p.waitForTimeout(300);
  await p.click('.fo-op[data-k="objetivo:o1"]'); await p.click('[data-action="foco-min"][data-v="25"]');
  ok(await p.locator('[data-action="foco-amigo-elegir"]').isVisible(), "con amigos aparece «Con un amigo»");
  await p.click('[data-action="foco-amigo-elegir"]'); await p.waitForTimeout(300);
  await p.click(`[data-action="foco-amigo-invitar"][data-id="${idB}"]`); await p.waitForTimeout(500);
  ok(/Esperando a Bruno/.test(await modal()), "Ana espera a Bruno");
  await p.evaluate(() => { FS.espera = null; focoSalaDejar(); closeModal(); });   // (se cambia de cuenta en el mismo navegador)
  await entrar("bruno@foco.cl"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);
  await p.evaluate(() => focoSalaRevisar(true)); await p.waitForTimeout(600);
  t = await modal();
  ok(/Ana te invita a enfocarse/.test(t) && /25 min juntos/.test(t) && /Ana: «Terminar la tesis»/.test(t), "a Bruno le llega la invitación: 25 min y en qué está Ana");
  await shot(p, "foco-invitacion");
  await p.click('[data-action="foco-elegir"][data-k="libre:"]'); await p.fill("#fo-libre", "Informe de ventas");
  await p.click('[data-action="foco-sala-aceptar"]'); await p.waitForTimeout(800);
  ok(await p.locator("#foco").isVisible() && /Informe de ventas/.test(await p.locator(".foco__t").innerText()) && /Con Ana/.test(await p.locator(".foco__chips").innerText()), "Bruno parte: su sesión, con Ana");
  ok(/Ana/.test(await p.locator("#fo-sala").innerText()) && /también está en foco/.test(await p.locator("#fo-sala").innerText()), "ve que Ana también está en foco");
  const finB = await p.evaluate(() => focoActiva().fin);
  await shot(p, "foco-juntos");
  await p.click('[data-action="foco-terminar"]'); await p.waitForTimeout(300); await p.evaluate(() => closeModal());
  await entrar("ana@foco.cl");
  const s = await p.evaluate(() => BACKEND.focoSalaMia());
  ok(s && s.estado === "activa" && s.su_titulo === "Informe de ventas" && s.salio === "otro" && Math.abs(Date.parse(s.fin) - finB) < 2000, "Ana ve la sala: el mismo fin, lo de Bruno y que Bruno salió antes");
  await ctx.close();
};
