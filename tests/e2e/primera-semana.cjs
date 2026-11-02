/* Pruebas en navegador · 🚀 La primera semana de una cuenta nueva: la misión de 7 días (un paso por
   día, estrellas, «la misión espera»), las secciones de Más que despiertan de a una (con «Nuevo» y
   «Ver todo»), las pantallas vacías que enseñan (Tendencias, Finanzas, Objetivos y Rueda), las
   Palabras de Rumbo y el cierre con la insignia Explorador. Quien ya usaba la app no ve nada distinto. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });   // lunes 2 de noviembre
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(() => { try { localStorage.setItem("rumbo-sin-escenas", "1"); } catch (e) {} });
  await p.fill("#reg-name", "Camila"); await p.fill("#reg-email", "semana@test.cl"); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  // «Arma tu Rumbo»: su plata y un hábito; su elefante
  await p.click('.arma-chip[data-id="plata"]');
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(200);
  await p.click('.arma-chip[data-id="leer"]');
  await p.click('#modal [data-action="arma-sig"]'); await p.waitForTimeout(200);
  await p.fill("#arma-nombre", "Tito");
  while (await p.locator("#modalOverlay:not([hidden]) #modal .arma").count()) { await p.click('#modal [data-action="arma-sig"], #modal [data-action="arma-fin"]'); await p.waitForTimeout(250); }
  await p.waitForTimeout(600);
  await p.evaluate(() => { if (TOUR) tourTerminar(); STATE.settings.tutorial.auto = false; saveState(); go("inicio"); rerender(); }); await p.waitForTimeout(400);

  // 1) La misión: día 1 de 7, un paso a la vez
  const card = p.locator("[data-tour=mision]");
  ok(/Tu primera semana/.test(await card.innerText()) && /día 1 de 7/.test(await card.innerText()), "Inicio: «Tu primera semana · día 1 de 7»");
  ok(await card.locator(".psem-paso.is-ahora").count() === 1 && /Abre tu día/.test(await card.locator(".psem-paso.is-ahora").innerText()) && /\+50/.test(await card.locator(".psem-paso.is-ahora").innerText()), "lo que toca ahora: abrir tu día (+50 ⭐)");
  ok(/mañana/.test(await card.locator('.psem-paso', { hasText: "Marca un hábito" }).innerText()), "lo que viene dice cuándo: el hábito, mañana");
  await shot(p, "semana-mision");

  // 2) Más: lo que siempre se ve, lo que eligió y «Ver todo»
  await p.click("#bbMas"); await p.waitForTimeout(300);
  const mas = await p.evaluate(() => [...document.querySelectorAll(".mas-mod[data-route]")].map(b => b.dataset.route));
  ok(mas.includes("finanzas") && mas.includes("metas") && !mas.includes("listas") && !mas.includes("calendario") && !mas.includes("tendencias") && await p.locator('.mas-mod[data-action="bv-ver-todo"]').count() === 1,
    "Más muestra lo suyo (Finanzas, porque eligió su plata), lo de siempre y «Ver todo»: " + mas.join(", "));
  await p.evaluate(() => cerrarMas());

  // 3) Abrir el día desde la misión; el día 3, la semana despierta Calendario, con «Nuevo»
  await card.locator('.psem-paso.is-ahora').click(); await p.waitForTimeout(400);
  await p.fill("#r-sapo", "Enviar la propuesta"); await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(700);
  ok(/Esta noche, ciérralo/.test(await p.locator("[data-tour=mision] .psem-paso.is-ahora").innerText()), "abierto: ahora toca cerrarlo esta noche");
  await p.evaluate(() => { const S = STATE; S.settings.alta = "2026-10-31"; S.ritual.dias["2026-11-02"].cerrado = true; S.habitos.log["2026-11"] = { [S.habitos.defs[0].id]: { 2: true } }; saveState(); go("inicio"); rerender(); });
  await p.waitForTimeout(300);
  ok(/Planifica tu semana/.test(await p.locator("[data-tour=mision] .psem-paso.is-ahora").innerText()), "el día 3 toca planificar la semana");
  await p.click("#bbMas"); await p.waitForTimeout(300);
  ok(await p.locator('.mas-mod.is-nuevo[data-route="calendario"]').count() === 1, "despertó Calendario, con «Nuevo»");
  await p.click('.mas-mod[data-route="calendario"]'); await p.waitForTimeout(400);
  await p.click("#bbMas"); await p.waitForTimeout(300);
  ok(await p.locator('.mas-mod.is-nuevo[data-route="calendario"]').count() === 0 && await p.locator('.mas-mod[data-route="calendario"]').count() === 1, "visitarlo le quita el «Nuevo»");
  await p.evaluate(() => { cerrarMas(); STATE.settings.alta = "2026-11-02"; STATE.ritual.dias["2026-11-02"].cerrado = false; saveState(); });   // de vuelta al día 1, con el día abierto

  // 4) Palabras de Rumbo: «primer bocado» se explica a un toque
  await p.evaluate(() => { go("inicio"); }); await p.waitForTimeout(300);
  ok(await p.locator(".guia .glosa.is-marca").count() === 1, "la primera semana, «primer bocado» va con subrayado punteado");
  await p.click(".guia .glosa"); await p.waitForTimeout(250);
  ok((await p.locator("#modalTitle").innerText()) === "Primer bocado" && /Un bocado a la vez/.test(await p.locator("#modal").innerText()) && /Tito/.test(await p.locator("#modal").innerText()), "lo explica Tito: «Primer bocado»");
  await p.click('#modal [data-action="bv-glosa"][data-k="racha"]'); await p.waitForTimeout(200);
  ok((await p.locator("#modalTitle").innerText()) === "Racha", "y salta a otras palabras: Racha");
  await p.evaluate(() => closeModal());

  // 5) Pantallas vacías que enseñan
  await p.evaluate(() => go("tendencias")); await p.waitForTimeout(500);
  const tend = await p.locator("#view").innerText();
  ok(/Tus gráficos aparecen con 7 días cerrados/.test(tend) && /Llevas 0 de 7/.test(tend) && !/Comparar meses/.test(tend), "Tendencias: cuándo se llena (0 de 7) y sin ofrecer comparar meses todavía");
  await shot(p, "semana-tendencias");
  await p.evaluate(() => go("finanzas")); await p.waitForTimeout(500);
  ok(/Tu plata, en 2 minutos al mes/.test(await p.locator("#view").innerText()), "Finanzas: «Tu plata, en 2 minutos al mes»");
  const filas = await p.evaluate(() => [...document.querySelectorAll(".habit-grid tbody tr td.name")].map(t => t.textContent.trim()));
  ok(filas.join() === "Nov,Dic" && /Desde noviembre/.test(await p.locator("#view").innerText()), "el seguimiento parte en noviembre, el mes en que llegó: " + filas.join(" "));
  await p.fill('[data-ensena="finanzas"] input >> nth=0', "900000"); await p.press('[data-ensena="finanzas"] input >> nth=0', "Tab"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => datosAnio(STATE, 2026).finanzas.meses[10].ingreso) === 900000, "lo que anota en la tarjeta queda en noviembre");
  await p.evaluate(() => go("metas")); await p.waitForTimeout(400);
  ok(/Un paso concreto este mes/.test(await p.locator("#view").innerText()), "Objetivos: «Un paso concreto este mes»");
  await p.click('[data-ensena="metas"] [data-action="bv-foco"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "mt-mes-10"), "su botón lleva a escribir el objetivo de noviembre");
  await p.evaluate(() => go("rueda")); await p.waitForTimeout(400);
  ok(/Tu vida, área por área/.test(await p.locator("#view").innerText()), "Rueda: «Tu vida, área por área»");
  await p.evaluate(() => go("tutoriales")); await p.waitForTimeout(400);
  const ay = await p.locator("#view").innerText();
  ok(/Palabras de Rumbo/i.test(ay) && /Tu primera semana/i.test(ay), "en Ayuda: Tu primera semana y las Palabras de Rumbo");

  // 6) La semana entera: se salta días y la misión espera; al terminar, Explorador
  await p.evaluate(() => {
    const S = STATE; S.settings.alta = "2026-10-27";   // como si hubiera llegado hace 7 días
    S.ritual.dias["2026-11-02"].cerrado = true;
    S.habitos.log["2026-11"] = { [S.habitos.defs[0].id]: { 2: true } };
    S.ritual.semanas = Object.assign(S.ritual.semanas || {}, { "2026-11-02": { apertura: { foco: "Partir", prioridades: [], ts: 1 } } });
    S.metas.mensuales[10].push({ id: "o1", texto: "Leer 2 libros", ts: 1 });
    saveState(); go("inicio"); rerender();
  });
  await p.waitForTimeout(400);
  ok(/Elige qué más quieres ver/.test(await p.locator("[data-tour=mision] .psem-paso.is-ahora").innerText()), "con lo hecho, toca elegir qué más ver (la plata ya la anotó)");
  await p.locator("[data-tour=mision] .psem-paso.is-ahora").click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.getElementById("masOverlay").hidden) && await p.locator('.mas-mod[data-route="listas"]').count() === 1 && await p.locator('[data-action="bv-ver-todo"]').count() === 0, "«Elige qué más ver» abre Más con todas las secciones");
  await p.evaluate(() => { cerrarMas(); go("inicio"); }); await p.waitForTimeout(300);
  await p.locator("[data-tour=mision] .psem-paso.is-ahora").click(); await p.waitForTimeout(300);
  ok((await p.locator("#modalTitle").innerText()) === "Tu primera semana" && /días abiertos/.test(await p.locator("#modal").innerText()), "el día 7: tu primera semana, en números");
  await shot(p, "semana-resumen");
  await p.click('[data-action="bv-resumen-ok"]'); await p.waitForTimeout(500);
  const fin = await p.evaluate(() => ({ badge: STATE.gamif.badges.includes("explorador"), mov: STATE.gamif.ledger.some(m => m.id === "insignia:explorador" && m.delta === 100) }));
  ok(fin.badge && fin.mov && /Completaste tu primera semana/.test(await p.locator("[data-tour=mision]").innerText()), "semana completa: insignia Explorador y +100 ⭐");
  await p.click('[data-action="bv-cerrar"]'); await p.waitForTimeout(200);
  ok(await p.locator("[data-tour=mision]").count() === 0, "«Genial» la cierra");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin scroll horizontal en el celular");
  await ctx.close();

  // 7) Quien ya usaba la app: nada duerme y no hay «Ver todo»
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await registrar(p, "antes@test.cl");
    await p.click("#bbMas"); await p.waitForTimeout(300);
    ok(await p.locator('.mas-mod[data-route="listas"]').count() === 1 && await p.locator('[data-action="bv-ver-todo"]').count() === 0, "cuenta de antes: todas las secciones, sin «Ver todo»");
    await p.evaluate(() => { cerrarMas(); go("tendencias"); }); await p.waitForTimeout(400);
    ok(await p.locator('[data-ensena="tendencias"]').count() === 1, "Tendencias también le explica cuándo se llena, si aún no tiene 7 días cerrados");
    await ctx.close();
  }
};
