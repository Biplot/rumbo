/* Pruebas en navegador · Detalles de app de viajes (v79): barra de misión, recientes, llegada,
   accesos, precio en el botón, fin del recorrido, recibo, compartir, monedas, deshacer y vibración */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-27T08:30:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "detalles@test.cl");
  await p.evaluate(() => {
    const hoy = todayISO();
    STATE.ritual.dias[agSumar(hoy, -2)] = { hecho: true, mision: "Preparar la reunión", abiertoTs: 1, ts: 1, cerrado: true, cierre: {} };
    STATE.ritual.dias[agSumar(hoy, -1)] = { hecho: true, mision: "Revisar presupuesto", abiertoTs: 1, ts: 1, cerrado: true, cierre: { manana: "Cerrar el informe" } };
    window.__vib = [];
    navigator.vibrate = pat => { window.__vib.push(pat); return true; };
    saveState(); rerender();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);

  // 1) Por abrir: la barra del destino y las misiones recientes
  ok((await p.locator("#view .mision-barra").innerText()).includes("¿Cuál es tu misión?"), "Inicio pregunta por tu misión en una barra, como «¿A dónde vas?»");
  const rec = await p.locator("#view .reciente").allInnerTexts();
  ok(rec.length === 2 && rec[0].includes("Cerrar el informe") && rec[0].includes("anoche") && rec[1].includes("Revisar presupuesto"),
    "las misiones recientes: lo que anotaste anoche y la de ayer: " + rec.map(t => t.replace(/\s+/g, " ")).join(" | "));

  // 2) Elegir una reciente abre el día con esa misión y el cursor en el primer bocado
  await p.click("#view .reciente >> nth=0"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.getElementById("r-mision").value === "Cerrar el informe" && document.activeElement.id === "r-sapo"),
    "una misión reciente queda elegida y el cursor pasa al primer bocado");
  const cta = await p.locator("#modal .modal__cta .btn--precio").innerText();
  ok(/Abrir mi día/.test(cta) && /\+50/.test(cta), "el botón muestra lo que ganas, como el precio de un viaje: " + cta.replace(/\s+/g, " "));
  await p.fill("#r-sapo", "Enviar la propuesta");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('#modal [data-action="ritual-save"]'); await p.waitForTimeout(80);
  ok(await p.locator("#ptsPill .pts-flota").innerText().catch(() => "") === "+50", "al ganar monedas flota un «+50» sobre tu contador");
  await p.waitForTimeout(800);
  ok(await p.evaluate(a => STATE.gamif.puntos === a + 50 && +document.getElementById("ptsVal").textContent === STATE.gamif.puntos, antes), "el contador sube hasta el total");
  ok(await p.evaluate(() => window.__vib.includes(20)), "abrir el día da un toque de vibración");

  // 3) En curso: la misión arriba, la llegada a tu hora de cierre y los accesos
  ok((await p.locator("#view .mision-barra").innerText()).includes("Cerrar el informe"), "con el día abierto, la barra muestra tu misión");
  ok(await p.locator("#view .reciente").count() === 0, "las recientes solo aparecen antes de abrir el día");
  ok((await p.locator("#view .ruta-eta").innerText()).includes("Faltan 12 h 30 min para tu cierre"), "la barra de avance dice cuánto falta para tu cierre (21:00)");
  await p.evaluate(() => { STATE.settings.notif = { noche: "22:00" }; rerender(); });
  ok((await p.locator("#view .ruta-eta").innerText()).includes("Faltan 13 h 30 min") && (await p.locator("#view .ruta__p").nth(2).innerText()).includes("22:00"),
    "si tu recordatorio de la noche es a las 22:00, esa es tu hora de cierre");
  await p.click("#view .mision-barra"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.activeElement.id === "r-mision") && /Guardar cambios/.test(await p.locator("#modal .modal__cta").innerText()),
    "tocar la barra abre tu ritual con el cursor en la misión (y el botón dice «Guardar cambios»)");
  await p.evaluate(() => closeModal());
  const atajos = await p.locator("#view .atajos .atajo").evaluateAll(els => els.map(e => e.dataset.route));
  ok(atajos.length === 4 && await p.locator("#view .atajos").isVisible(), "Todo en un lugar: cuatro accesos en el celular: " + atajos.join(", "));
  await p.evaluate(() => { STATE.settings.menu = { ocultos: ["tendencias"] }; rerender(); });
  const atajos2 = await p.locator("#view .atajos .atajo").evaluateAll(els => els.map(e => e.dataset.route));
  ok(!atajos2.includes("tendencias") && atajos2.length === 4, "un módulo oculto no aparece en los accesos: " + atajos2.join(", "));
  await p.click("#view .atajos__todo"); await p.waitForTimeout(250);
  ok(await p.locator("#masOverlay").isVisible(), "«Ver todo» abre la hoja Más");
  await p.evaluate(() => cerrarMas());
  await p.click(`#view .atajo[data-route="${atajos2[0]}"]`); await p.waitForTimeout(250);
  ok(await p.evaluate(r => location.hash === "#" + r, atajos2[0]), "un acceso lleva a su sección");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);

  // 4) Primer bocado hecho: queda la hora en su parada y vibra distinto
  await p.click('#view [data-action="bocado-hecho"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => { const t = tareasDelDia(todayISO()).find(x => x.esSapo); return estadoTarea(t) === "hecha" && t.hechaTs > 0; }), "el primer bocado guarda a qué hora lo diste");
  ok((await p.locator("#view .ruta__p").nth(1).innerText()).includes("08:30"), "su parada muestra esa hora");
  ok(await p.evaluate(() => window.__vib.some(v => Array.isArray(v))), "el primer bocado vibra con un patrón propio");

  // 5) Borrar una tarea no pregunta: se puede deshacer
  await p.evaluate(() => { nuevaTarea(STATE, todayISO(), { txt: "Tarea de prueba", ambito: "per" }); saveState(); rerender(); });
  const id = await p.evaluate(() => tareasDelDia(todayISO()).find(t => t.txt === "Tarea de prueba").id);
  await p.click(`#view [data-action="tarea-del"][data-id="${id}"]`); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !tareasDelDia(todayISO()).some(t => t.txt === "Tarea de prueba")) && (await p.locator("#toast").textContent()).includes("Deshacer"),
    "borrar una tarea la quita al tiro y ofrece «Deshacer»");
  await p.evaluate(() => document.querySelector("#toast .toast__acc").click()); await p.waitForTimeout(150);
  ok(await p.evaluate(() => tareasDelDia(todayISO()).some(t => t.txt === "Tarea de prueba")) && await p.locator(`#view [data-id="${id}"]`).count() > 0, "«Deshacer» la trae de vuelta");

  // 6) Las ventanas del celular se cierran arrastrándolas hacia abajo
  await p.click('#view .ruta-dia [data-action="day-close"]'); await p.waitForTimeout(300);
  const arrastre = await p.evaluate(async () => {
    const m = document.getElementById("modal"), y = m.getBoundingClientRect().top + 30;
    const tc = cy => [new Touch({ identifier: 1, target: m, clientX: 200, clientY: cy })];
    m.dispatchEvent(new TouchEvent("touchstart", { touches: tc(y), bubbles: true }));
    m.dispatchEvent(new TouchEvent("touchmove", { touches: tc(y + 80), bubbles: true }));
    const medio = m.style.transform;
    m.dispatchEvent(new TouchEvent("touchmove", { touches: tc(y + 180), bubbles: true }));
    m.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: tc(y + 180), bubbles: true }));
    return { medio, cerrada: document.getElementById("modalOverlay").hidden };
  });
  ok(arrastre.medio === "translateY(80px)" && arrastre.cerrada, "la ventana sigue al dedo y se cierra al soltarla abajo: " + JSON.stringify(arrastre));

  // 7) Con movimiento reducido no hay animaciones ni vibración
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.evaluate(() => { window.__vib = []; nuevaTarea(STATE, todayISO(), { txt: "Quieta", ambito: "per" }); saveState(); rerender(); });
  const idq = await p.evaluate(() => tareasDelDia(todayISO()).find(t => t.txt === "Quieta").id);
  await p.click(`#view [data-action="tarea-toggle"][data-id="${idq}"]`); await p.waitForTimeout(80);
  ok(await p.locator("#ptsPill .pts-flota").count() === 0 && await p.evaluate(() => +document.getElementById("ptsVal").textContent === STATE.gamif.puntos && !window.__vib.length),
    "con «reducir movimiento», las monedas cambian sin animación y no vibra");
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await ctx.close();

  // 8) De noche: el botón del día late, el cierre es el fin del recorrido y al llegar hay un recibo
  const c2 = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-27T21:05:00" });
  const q = await c2.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "detalles-noche@test.cl");
  await q.evaluate(() => {
    const hoy = todayISO(), ab = new Date(); ab.setHours(8, 12, 0, 0);
    for (let k = 1; k <= 4; k++) STATE.ritual.dias[agSumar(hoy, -k)] = { hecho: true, abiertoTs: 1, ts: 1, cerrado: true, cierre: {} };
    STATE.ritual.dias[hoy] = { hecho: true, mision: "Cerrar el informe", sapo: "Enviar la propuesta", energia: 4, abiertoTs: ab.getTime(), ts: 1 };
    const t = nuevaTarea(STATE, hoy, { txt: "Enviar la propuesta", ambito: "pro", esSapo: true });
    const bh = new Date(); bh.setHours(10, 40, 0, 0); marcarTarea(t, "hecha", { hechaTs: bh.getTime() });
    nuevaTarea(STATE, hoy, { txt: "Llamar al proveedor", ambito: "pro" });
    saveState(); rerender(); actualizarBotonDia();
  });
  await q.goto(URL + "#inicio"); await q.waitForTimeout(300);
  ok(await q.locator("#bbDia.is-ahora").count() === 1, "de noche, el botón del día late: es hora de cerrar");
  await q.click('#view .ruta-dia [data-action="day-close"]'); await q.waitForTimeout(300);
  ok(await q.locator("#modalTitle").innerText() === "Cierra tu martes", "el cierre se titula con tu día: «Cierra tu martes»");
  const fin = await q.locator("#modal .fin-ruta").innerText();
  ok(/Fin del recorrido/i.test(fin) && fin.includes("08:12") && fin.includes("10:40") && fin.includes("21:05") && fin.includes("Ahora"),
    "arriba, el fin del recorrido con tus horas: " + fin.replace(/\s+/g, " "));
  await q.click('#c-moods .mood-btn[data-v="5"]');
  ok(await q.locator("#c-mood-eti").innerText() === "Muy bien", "el ánimo elegido se dice con palabras");
  ok(/\+40/.test(await q.locator("#modal .modal__cta .btn--precio").innerText()), "el botón de cerrar muestra +40");
  await q.fill("#c-mejor", "Almuerzo con mi hermana");
  await q.click('[data-action="cierre-save"]'); await q.waitForTimeout(700);
  const recibo = await q.locator("#view .recibo").innerText();
  ok(recibo.includes("Día cerrado") && recibo.includes("Llegaste") && recibo.includes("08:12") && recibo.includes("21:05") && recibo.includes("Almuerzo con mi hermana") && /Ganaste hoy/.test(recibo),
    "al llegar, el recibo de tu día: " + recibo.replace(/\s+/g, " ").slice(0, 200));
  ok(await q.evaluate(() => +document.querySelector("#view .recibo__n").textContent === computeClosedStreak() && computeClosedStreak() === 5), "la racha del recibo sube a 5");

  // 9) Compartir: la imagen del día va a la hoja de compartir del teléfono (o se descarga)
  await q.evaluate(() => {
    navigator.canShare = () => true;
    navigator.share = async d => { window.__share = { n: d.files.length, type: d.files[0].type, size: d.files[0].size, text: d.text }; };
  });
  await q.click('#view [data-action="compartir-dia"]'); await q.waitForTimeout(800);
  const sh = await q.evaluate(() => window.__share || null);
  ok(sh && sh.n === 1 && sh.type === "image/png" && sh.size > 20000 && sh.text.includes("5 días cerrados seguidos"), "compartir manda una imagen de tu día: " + JSON.stringify(sh));
  await q.evaluate(() => { navigator.canShare = undefined; });
  const [descarga] = await Promise.all([q.waitForEvent("download", { timeout: 5000 }).catch(() => null), q.click('#view [data-action="compartir-dia"]')]);
  ok(descarga && /^rumbo-2026-10-27\.png$/.test(descarga.suggestedFilename()), "sin hoja de compartir, la imagen se descarga");
  await c2.close();

  // 10) En el computador, los accesos no se repiten (ya están en el menú)
  const c3 = await nuevoContexto(b, { w: 1360, h: 860, fecha: "2026-10-27T10:00:00" });
  const d = await c3.newPage(); d.on("pageerror", e => errs.push(e.message));
  await registrar(d, "detalles-pc@test.cl");
  await d.goto(URL + "#inicio"); await d.waitForTimeout(300);
  ok(await d.locator("#view .mision-barra").isVisible() && await d.locator("#view .atajos").isHidden(), "en el computador está la barra de misión y no los accesos");
  await c3.close();
};
