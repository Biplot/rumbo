/* Pruebas en navegador · 🐘 El diario del elefante (nota-elefante.js): al cerrar el día tu elefante deja una nota con
   tus datos (la hora, el agua, los hábitos, lo de mañana) sin lo que escribiste a mano; sale en el recibo y en el
   Diario, se comparte como imagen y también llega con el cierre express */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-03T22:10:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  await registrar(p, "nota@test.cl");
  await p.evaluate(() => {
    STATE.habitos.defs = [{ id: "h1", nombre: "Leer", icon: "📖", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
      { id: "h2", nombre: "Meditar", icon: "🧘", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
      { id: "h3", nombre: "Inglés", icon: "✏️", frecuencia: { tipo: "dias", dias: [2] }, creado: "2026-10-01" }];   // los miércoles: mañana
    STATE.habitos.log = { "2026-11": { h1: { 3: true }, h2: { 3: true } } };
    STATE.ritual.dias[todayISO()] = { hecho: true, mision: "Terminar el informe secreto", energia: 2, abiertoTs: Date.now() - 12 * 3600e3, ts: Date.now() };
    STATE.agua.meta = 2000; aguaSumar(1500); aguaSumar(800);
    saveState(); go("inicio");
  });
  await p.waitForTimeout(400);

  // 1) Al cerrar el día, la nota llega en el recibo
  await p.evaluate(() => openCierreModal(todayISO())); await p.waitForTimeout(300);
  await p.fill("#c-nota", "Algo muy personal"); await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(1200);
  await p.evaluate(() => closeModal()); await p.waitForTimeout(200);
  const nota = p.locator(".recibo .ele-nota");
  ok(await nota.count() === 1, "al cerrar el día, el recibo trae la nota de tu elefante");
  const t = await nota.innerText();
  ok(/Tu elefante te dejó una nota/.test(t) && /22:10/.test(t) && /2,3 L/.test(t) && /(Cumpliste tus 2 hábitos|los 2)/.test(t) && /Mañana toca Inglés: yo llevo el diccionario/.test(t),
    "dice la hora del cierre, el agua, los hábitos y lo que toca mañana, con su broma");
  ok(!/informe secreto|muy personal/.test(t), "sin lo que escribiste a mano (la misión y la nota)");
  ok(await nota.locator("svg").count() >= 1 && /— Tu elefante/.test(t), "con tu elefante y su firma");
  await nota.scrollIntoViewIfNeeded(); await shot(p, "nota-recibo");
  ok(await ancho() <= 390, "el recibo con la nota cabe en el celular");

  // 2) Se guarda en la entrada del día del Diario
  const guardada = await p.evaluate(() => { const e = STATE.vida.diario.find(x => x.fecha === todayISO() && x.fromRitual); return e && e.ele && e.ele.texto; });
  ok(!!guardada && guardada === (await nota.locator(".ele-nota__t").innerText()).trim(), "queda guardada en la entrada del día del Diario");

  // 3) Compartir: sin la hoja de compartir del teléfono, se descarga una imagen de 1080 × 1350
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }), nota.locator('[data-action="elenota-compartir"]').click()]);
  ok(/rumbo-nota-2026-11-03\.png$/.test(dl.suggestedFilename()), "compartir arma la imagen de la nota (rumbo-nota-2026-11-03.png)");
  const tam = await p.evaluate(async () => { const bl = await imagenNotaElefante(todayISO()); const bm = await createImageBitmap(bl); return [bm.width, bm.height]; });
  ok(tam[0] === 1080 && tam[1] === 1350, "la imagen es de 1080 × 1350, como una publicación");

  // 4) En el Diario, el día abierto muestra la nota
  await p.evaluate(() => { go("diario"); }); await p.waitForTimeout(400);
  await p.evaluate(() => diarioElegir(todayISO())); await p.waitForTimeout(400);
  ok(await p.locator(".ddet .ele-nota").count() === 1 && /22:10/.test(await p.locator(".ddet .ele-nota").innerText()), "en el Diario, el día trae la nota de tu elefante");
  await shot(p, "nota-diario");

  // 5) Volver a cerrar (editar el cierre) la escribe de nuevo con lo nuevo
  await p.evaluate(() => { aguaSumar(500); openCierreModal(todayISO()); }); await p.waitForTimeout(300);
  await p.click('#modal [data-action="cierre-save"]'); await p.waitForTimeout(900);
  ok(/2,8 L/.test(await p.evaluate(() => notaElefanteDe(todayISO()).texto)), "al editar el cierre, la nota se rehace con el agua nueva");

  // 6) Un día difícil, con el cierre express
  const exp = await p.evaluate(() => {
    const iso = todayISO(); STATE.ritual.dias[iso] = { hecho: true, energia: 3, abiertoTs: Date.now() - 3600e3, ts: Date.now() };
    STATE.vida.diario = STATE.vida.diario.filter(e => !(e.fecha === iso && e.fromRitual)); saveState();
    aplicarCierreExpress(STATE, iso, { mood: 1, gratitud: "", elecciones: {} }); notaElefanteGuardar(iso);
    return notaElefanteDe(iso).texto;
  });
  ok(/(Fue un día difícil|Hoy costó)/.test(exp), "un día difícil se dice con cariño (también en el cierre express)");
  await ctx.close();
};
