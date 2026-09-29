/* Pruebas en navegador · 🧭 Navegación: barra inferior con el botón del día, hoja Más,
   menú de cuenta, módulos plegables y pestañas de Recompensas */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  // ---------- Celular ----------
  const ctx = await nuevoContexto(b, { fecha: "2026-09-23T10:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "nav-movil@test.cl");

  // 1) Barra inferior: Inicio, Semana, botón del día, Hábitos y Más; sin botón flotante
  ok(await p.locator("#bottombar .bottombar__item").count() === 4 && await p.locator("#bbDia").count() === 1, "barra inferior con 4 accesos y el botón del día al centro");
  ok(await p.locator("#dayFab").count() === 0, "ya no hay botón flotante que tape el contenido");
  ok(await p.locator("#bbDia.is-abrir[data-action=day-open]").count() === 1, "antes de abrir el día, el botón central abre el día");
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = { hecho: true }; saveState(); rerender(); });
  ok(await p.locator("#bbDia.is-cerrar[data-action=day-close]").count() === 1, "con el día abierto, el botón central lo cierra");
  await p.evaluate(() => { STATE.ritual.dias[todayISO()].cerrado = true; saveState(); rerender(); });
  ok(await p.locator('#bbDia.is-cerrado[data-route="ritual"]').count() === 1, "con el día cerrado, lleva al Ritual");
  const r = await p.locator("#bbDia").boundingBox();
  ok(r && r.width >= 44 && r.height >= 44, "el botón del día mide al menos 44 px");

  // 2) Hoja Más: módulos, Personalizar y la parte personal
  await p.click("#bbMas"); await p.waitForTimeout(300);
  ok(await p.locator("#masOverlay:not([hidden]) .mas-mod[data-route=metas]").count() === 1, "Más muestra Objetivos");
  ok(await p.locator(".mas-fila[data-route=recompensas]").count() === 1 && await p.locator(".mas-fila[data-route=cuenta]").count() === 1 && await p.locator(".mas-fila[data-route=tutoriales]").count() === 1, "Más muestra Recompensas, Cuenta y Ayuda");
  await shot(p, "nav-mas");
  await p.click(".mas-mod[data-route=finanzas]"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => location.hash === "#finanzas" && document.getElementById("masOverlay").hidden), "elegir un módulo navega y cierra la hoja");
  ok(await p.locator("#bbMas.is-active").count() === 1, "en un módulo, Más queda marcado");
  await p.click("#bbMas"); await p.waitForTimeout(200);
  await p.click("[data-action=mas-cerrar]"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("masOverlay").hidden), "la ✕ cierra la hoja");

  // 3) Ocultar un módulo lo saca de la hoja (sin borrar datos)
  await p.evaluate(() => { STATE.settings.menu = { ocultos: ["listas"], ts: Date.now() }; saveState(); buildNav(); });
  await p.click("#bbMas"); await p.waitForTimeout(200);
  ok(await p.locator(".mas-mod[data-route=listas]").count() === 0, "un módulo oculto no aparece en Más");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.getElementById("masOverlay").hidden), "Esc cierra la hoja");

  // 4) Rachas y monedas explicadas
  await p.click("#streakPill"); await p.waitForTimeout(200);
  const info = await p.locator("#modal").innerText();
  ok(info.includes("cerrad") && info.includes("hábitos") && info.includes("monedas"), "tocar 🔥 explica cada racha y las monedas");
  await p.evaluate(() => closeModal());

  // 5) Botones: compras que dicen cuánto falta y zonas de toque de 44 px
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  ok(await p.locator(".btn--falta[data-action]").count() === 0 && (await p.locator(".btn--falta").first().innerText()).includes("Te faltan"), "sin ⭐ suficientes, el botón dice cuánto falta y no se puede tocar");
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-nav", 1000, 0, "test"); saveState(); rerender(); });
  ok(await p.locator('.btn--linea[data-action="util-buy"]').count() === 1, "con saldo, el botón de compra se activa");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  const chicos = await p.evaluate(() => [...document.querySelectorAll("#view a.card__hint, #view .btn, .topbar button:not([hidden])")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height < 40; }).length);
  ok(chicos === 0, "en Inicio y arriba no quedan botones de menos de 40 px de alto");

  // 5b) Pantallas en el celular
  await p.goto(URL + "#semana"); await p.waitForTimeout(350);
  const yHoy = (await p.locator(".week-col.is-hoy").boundingBox()).y, yJue = (await p.locator(".week-col.is-futuro").first().boundingBox()).y, yLun = (await p.locator(".week-col.is-pasado").first().boundingBox()).y;
  ok(yHoy < yJue && yJue < yLun, "Semana: hoy primero, después lo que viene y al final los días pasados");
  ok(!(await p.locator(".week-col.is-futuro .week-col__add").first().isVisible()), "los otros días no muestran el campo hasta tocar ＋");
  await p.click(".week-col.is-futuro .week-col__mas >> nth=0"); await p.waitForTimeout(150);
  ok(await p.locator(".week-col.is-futuro .week-col__add").first().isVisible(), "tocar ＋ abre el campo para agregar una tarea ese día");
  ok(await p.locator("details.sem-numeros:not([open])").count() === 1, "los números de la semana quedan plegados en el celular");
  await p.goto(URL + "#habitos"); await p.waitForTimeout(300);
  ok(await p.locator(".hab-head .seg button").count() === 4 && await p.locator('[data-action="habit-layout"]').count() === 0, "Hábitos tiene un solo selector: Hoy, Semana, Mes y Año");
  await p.click('[data-action="habit-vista"][data-v="mes"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => HABIT_VIEW === "mensual") && await p.locator('.hab-head .seg button.is-active[data-v="mes"]').count() === 1, "Mes abre la vista mensual");
  await p.click('[data-action="habit-vista"][data-v="hoy"]'); await p.waitForTimeout(200);
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  ok(await p.locator(".tienda-cat").count() === 6, "la Tienda tiene categorías arriba");
  await p.click('.tienda-cat[data-id="temas"]'); await p.waitForTimeout(700);
  const yTemas = (await p.locator("#tienda-temas").boundingBox()).y;
  ok(yTemas > 0 && yTemas < 200, "tocar Temas salta a los temas");
  await p.goto(URL + "#insignias"); await p.waitForTimeout(300);
  await p.click('[data-action="ins-filtro"][data-v="ganadas"]'); await p.waitForTimeout(200);
  ok(await p.locator(".badge-card.is-locked:visible").count() === 0, "el filtro Ganadas oculta las que faltan");

  // 6) Cerrar sesión se encuentra en Cuenta
  await p.goto(URL + "#cuenta"); await p.waitForTimeout(300);
  ok(await p.locator('#view [data-action="logout"]').count() === 1, "Cuenta tiene Cerrar sesión");
  await ctx.close();

  // ---------- Computador ----------
  const c2 = await nuevoContexto(b, { fecha: "2026-09-23T10:00:00", w: 1360, h: 900 });
  const d = await c2.newPage(); d.on("pageerror", e => errs.push(e.message));
  await registrar(d, "nav-pc@test.cl");
  ok(await d.locator("#navDia.is-abrir").isVisible(), "en computador, 'Abre tu día' está arriba del menú");
  ok(await d.locator('#nav [data-route="tienda"]').count() === 0 && await d.locator('.nav-pie[data-route="recompensas"]').count() === 1, "Recompensas va en el pie del menú (la Tienda está dentro)");
  await d.click("#navMods > summary"); await d.waitForTimeout(150);
  ok(await d.evaluate(() => !document.getElementById("navMods").open && localStorage.getItem("rumbo-nav-modulos") === "0"), "los módulos se pliegan y se recuerda");
  await d.click("#cuentaBtn"); await d.waitForTimeout(150);
  ok(await d.locator("#cuentaMenu:not([hidden]) [data-route=notif]").count() === 1 && await d.locator('#cuentaMenu [data-action="logout"]').count() === 1, "el menú de cuenta tiene Notificaciones y Cerrar sesión");
  await shot(d, "nav-cuenta");
  await d.click("#cuentaMenu [data-route=cuenta]"); await d.waitForTimeout(250);
  ok(await d.evaluate(() => location.hash === "#cuenta" && document.getElementById("cuentaMenu").hidden), "elegir una opción navega y cierra el menú");

  // 7) Recompensas: pestañas Progreso · Tienda · Insignias
  await d.goto(URL + "#recompensas"); await d.waitForTimeout(300);
  ok(await d.locator(".tabs .tabs__b").count() === 3 && await d.locator('.tabs__b.is-active[data-route="recompensas"]').count() === 1, "Recompensas tiene 3 pestañas");
  await d.click('.tabs [data-route="tienda"]'); await d.waitForTimeout(300);
  ok(await d.evaluate(() => location.hash === "#tienda") && await d.locator('.tabs__b.is-active[data-route="tienda"]').count() === 1 && await d.locator(".nav-pie.is-active").count() === 1, "la pestaña Tienda abre la tienda y el pie sigue marcado");

  // 8) Inicio enfocado: elefante junto al saludo, hábitos de un toque y números solo si hay datos
  await d.goto(URL + "#inicio"); await d.waitForTimeout(300);
  ok(await d.locator("[data-tour=dia] .ele-hero").count() === 1, "el elefante está junto al saludo");
  ok(await d.locator("#view .stat").count() === 0, "sin datos de finanzas, lectura ni peso, no aparecen tarjetas vacías");
  const nHab = await d.locator("#view .hab-chip").count();
  await d.click("#view .hab-chip >> nth=0"); await d.waitForTimeout(250);
  ok(nHab === 8 && await d.locator("#view .hab-chip.is-on").count() === 1, "los hábitos de hoy se marcan con un toque");
  await d.evaluate(() => { STATE.lecturas.push({ id: "l1", titulo: "Hábitos atómicos", estado: "leyendo" }); saveState(); rerender(); });
  ok(await d.locator("#view .stat").count() === 1 && (await d.locator("#view .stat").innerText()).includes("Hábitos atómicos"), "con un libro en curso aparece 'Leyendo ahora'");
  ok((await d.locator("#view").innerText()).match(/Buenos días, Prueba/g).length === 1, "el saludo no se repite");
  await c2.close();
};
