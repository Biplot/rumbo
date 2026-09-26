/* Pruebas en navegador · Métricas de postergación */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
/* Fase 3 · Métricas de postergación: datos de 6 semanas y revisión de cada pantalla */
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-25T10:00:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "f3@test.cl");

  // Datos: días buenos (energía alta, abre temprano, medita) y malos; los lunes y lo pro se postergan más
  await p.evaluate(() => {
    const S = STATE;
    const h = { id: "hab-med", nombre: "Meditar", icon: "🧘", creado: "2026-08-01", freq: { tipo: "diario" } };
    S.habitos.defs.push(h);
    for (let iso = "2026-08-17"; iso < "2026-09-25"; iso = agSumar(iso, 1)) {
      const dow = (agDate(iso).getDay() + 6) % 7;
      const bueno = dow !== 0 && (agDate(iso).getDate() % 3 !== 0);
      const tareas = [["pro", "Informe " + iso], ["pro", "Llamada " + iso], ["per", "Casa " + iso], ["per", "Trámite " + iso]]
        .map(([a, txt], k) => nuevaTarea(S, iso, { txt, ambito: a, esSapo: k === 0 }));
      tareas.forEach((t, k) => {
        if (tareaMovida(t) || estadoTarea(t) !== "pendiente") return;
        const mover = bueno ? k === 1 : (dow === 0 ? true : k < 2);
        if (mover) moverTarea(S, t, iso, agSumar(iso, 1), "migrada", { hoy: iso });
        else if (!bueno && k === 3) marcarTarea(t, "soltada");
        else marcarTarea(t, "hecha");
      });
      // las copias que llegan a este día desde ayer se hacen (salvo que ya se movieron)
      tareasDelDia(iso, S).filter(t => t.migraciones > 0 && tareaAbierta(t)).forEach(t => marcarTarea(t, "hecha"));
      const hora = bueno ? 7 : 11;
      S.ritual.dias[iso] = { hecho: true, energia: bueno ? 5 : 2, abiertoTs: new Date(iso + `T0${hora > 9 ? "" : ""}${hora}:30:00`.replace("T011", "T11")).getTime(),
        cerrado: true, cierre: { sapo: bueno, energia: 3 }, ts: 1 };
      S.vida.diario.push({ id: uid(), fecha: iso, mood: bueno ? 5 : 2, texto: "x" });
      if (bueno) { const d = agDate(iso); const k = `${d.getFullYear()}-${d.getMonth() + 1}`; (S.habitos.log[k] = S.habitos.log[k] || {}); (S.habitos.log[k][h.id] = S.habitos.log[k][h.id] || {})[d.getDate()] = true; }
    }
    // Una tarea crónica: postergada 3 veces y aún pendiente (hoy)
    let c = nuevaTarea(S, "2026-09-22", { txt: "Ordenar la bodega", ambito: "per" });
    ["2026-09-23", "2026-09-24", "2026-09-25"].forEach((d, i) => { c = moverTarea(S, c, agSumar(d, -1), d, "migrada", { hoy: agSumar(d, -1) }); });
    saveState();
  });

  // Tendencias
  await p.goto(URL + "#tendencias"); await p.waitForTimeout(500);
  const foco = await p.locator("text=Foco y postergación").count();
  ok(foco === 1, "Tendencias muestra la sección 'Foco y postergación'");
  const txt = await p.locator("#view").innerText();
  const idx = await p.evaluate(() => tmResumen(STATE, agSumar(todayISO(), -29), todayISO()));
  ok(txt.includes("Índice de postergación") && txt.includes(idx.indice + "%"), "índice de postergación: " + idx.indice + "% (" + idx.postergadas + "/" + idx.tareas + ")");
  ok(txt.includes("Días de arrastre") && idx.arrastre > 0, "días de arrastre: " + idx.arrastre);
  ok(txt.includes("Primer bocado postergado") && idx.bocado.pct != null, "bocado postergado: " + idx.bocado.pct + "%");
  ok(/Capacidad real[\s\S]*\/ día/.test(txt), "capacidad real visible");
  ok(txt.includes("Ordenar la bodega"), "la tarea crónica aparece en 'Más postergadas'");
  ok(idx.porDia[0].pct > idx.porDia[2].pct, `los lunes se postergan más (${idx.porDia[0].pct}% vs mié ${idx.porDia[2].pct}%)`);
  ok(idx.porAmbito.pro.indice > idx.porAmbito.per.indice, `pro ${idx.porAmbito.pro.indice}% vs per ${idx.porAmbito.per.indice}%`);
  const ins = await p.evaluate(() => computeInsights().map(i => i.text.replace(/<[^>]+>/g, "")));
  const tiene = re => ins.some(t => re.test(t));
  ok(tiene(/energía alta/), "descubrimiento: energía de la mañana");
  ok(tiene(/antes de las 9/), "descubrimiento: hora de apertura");
  ok(tiene(/Meditar.*puntos más/), "descubrimiento: hábito que ayuda a cumplir");
  ok(tiene(/lunes postergas/), "descubrimiento: día que más postergas");
  ok(tiene(/Postergas más lo profesional/), "descubrimiento: pro vs personal");
  ok(tiene(/postergas más de la mitad/), "descubrimiento: ánimo y postergación");
  console.log("    " + ins.slice(0, 12).join("\n    "));
  await p.locator("text=Foco y postergación").scrollIntoViewIfNeeded();
  await shot(p, "f3-tendencias", { fullPage: true });

  // Inicio: pie con la postergación de 7 días
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  const pie = await p.locator("text=Postergación 7 días").count();
  ok(pie === 1, "Inicio muestra 'Postergación 7 días'");
  ok(await p.locator("text=postergada 3+ veces").count() === 1, "Inicio avisa de la tarea postergada 3+ veces");

  // Planificador: chip de la semana
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  ok(await p.locator(".mes-num", { hasText: "postergación" }).count() === 1, "la pantalla Semana muestra la postergación de la semana");

  // Apertura: aviso de capacidad
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await p.evaluate(() => openRitualModal());
  const cap0 = await p.locator("#r-cap").innerText();
  ok(/en promedio completas/.test(cap0), "apertura muestra la capacidad real: " + cap0);
  await p.fill("#r-tareas-pro", "a\nb\nc\nd\ne\nf\ng");
  const cap1 = await p.locator("#r-cap").innerText();
  ok(cap1.includes("⚠"), "con muchas tareas avisa: " + cap1);
  await shot(p, "f3-apertura");
  await p.evaluate(() => closeModal());

  // Resumen del mes
  const mesHtml = await p.evaluate(() => resumenMesHtml(resumenMes(2026, 8)));
  ok(mesHtml.includes("postergación") && mesHtml.includes("días de arrastre"), "el resumen del mes incluye postergación y arrastre");

  // Insignia Elefante Domado al completar la crónica
  const antes = await p.evaluate(() => STATE.gamif.badges.includes("elefante-domado"));
  await p.click('#view .tarea-row:has-text("Ordenar la bodega") [data-action="tarea-toggle"]'); await p.waitForTimeout(400);
  const desp = await p.evaluate(() => ({ b: STATE.gamif.badges.includes("elefante-domado"), m: STATE.gamif.ledger.some(x => x.id === "insignia:elefante-domado") }));
  ok(!antes && desp.b && desp.m, "insignia 'Elefante Domado' al completar una tarea postergada 3 veces");

  // Cierre del día: chips de lo que pasó con lo pendiente
  await p.evaluate(() => openRitualModal()); await p.click('[data-action="ritual-save"]'); await p.waitForTimeout(200);
  await p.evaluate(() => openCierreModal()); await p.waitForTimeout(200);
  const filas = p.locator("#c-triage .triage-row");
  const n = await filas.count();
  if (n) { await filas.nth(0).locator('button[data-v="soltar"]').click(); }
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(400);
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await shot(p, "f3-inicio", { fullPage: true });
  const cierreTxt = await p.locator(".card", { hasText: "Día cerrado" }).first().innerText().catch(() => "");
  console.log("    " + cierreTxt.replace(/\n+/g, " | ").slice(0, 300));
  ok(/↪ \d+ a otro día/.test(cierreTxt) && /✕ 1 soltada/.test(cierreTxt), "el resumen del día cerrado muestra ↪ y ✕");

  // Móvil
  const m = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-09-25T10:00:00", dpr: 2 });
  const pm = await m.newPage(); pm.on("pageerror", e => errs.push(e.message));
  await registrar(pm, "f3m@test.cl");
  const datos = await p.evaluate(() => JSON.stringify(STATE));
  await pm.evaluate(j => { STATE = migrate(JSON.parse(j)); saveState(); }, datos);
  await pm.goto(URL + "#tendencias"); await pm.waitForTimeout(500);
  const ancho = await pm.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, "móvil sin scroll horizontal en Tendencias: " + ancho);
  await pm.locator("text=Foco y postergación").scrollIntoViewIfNeeded();
  await shot(pm, "f3-movil");
};
