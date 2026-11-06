/* Pruebas en navegador · 🚦 Hábitos por color (v144): en Inicio y en Hábitos, el borde de cada hábito dice cómo va
   (verde cumplido en su período, amarillo vas bien, rojo en riesgo), todos a la vista (sin «Ya cumplidos este período»)
   y en orden: rojo, amarillo y al final lo cumplido. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-06T18:00:00", w: 390, h: 844 });   // viernes
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  await registrar(p, "colores@test.cl");
  await p.evaluate(() => {
    const def = (id, nombre, icon, frecuencia, extra) => Object.assign({ id, nombre, icon, frecuencia, creado: "2026-10-01" }, extra || {});
    STATE.habitos.defs = [
      def("deporte", "Deporte", "🏋️", { tipo: "diario" }),
      def("biplot", "Biplot", "💻", { tipo: "diario" }),
      def("lectura", "Lectura", "📖", { tipo: "semanal", veces: 3 }),
      def("lucidez", "Lucidez", "🌿", { tipo: "diario" }, { meta: "reducir", limite: { n: 3, per: "dia" } }),
      def("musica", "Aprender bajo", "🎵", { tipo: "semanal", veces: 2 }),
      def("elongar", "Elongar", "🧘", { tipo: "diario" }),
    ];
    const marcar = (id, ...dias) => dias.forEach(d => { const k = "2026-11"; STATE.habitos.log[k] = STATE.habitos.log[k] || {}; (STATE.habitos.log[k][id] = STATE.habitos.log[k][id] || {})[d] = true; });
    marcar("biplot", 5);          // ayer sí: vas bien
    marcar("lectura", 3);         // 1 de 3 y quedan 3 días: vas bien
    marcar("musica", 2, 4);       // 2 de 2: cumplido
    marcar("elongar", 5, 6);      // hoy sí: cumplido
    djCuentaPoner(STATE.habitos.defs[3], "2026-11-06", 4, STATE);   // 4 de 3: te pasaste
    saveState();                  // deporte: ayer no → en riesgo
  });
  await p.evaluate(() => go("inicio")); await p.waitForTimeout(600);
  const chips = () => p.evaluate(() => [...document.querySelectorAll(".inicio-main .hab-chips .hab-chip, #view .hab-chips .hab-chip")].map(c => c.dataset.id + ":" + (c.className.match(/st-(\w+)/) || [])[1]));
  const c = await chips();
  ok(JSON.stringify(c) === JSON.stringify(["deporte:cr", "lucidez:cr", "biplot:ve", "lectura:ve", "elongar:ok", "musica:ok"]), "Inicio: rojo, amarillo y al final lo cumplido, todos en una grilla · " + c.join(" "));
  ok(!/Ya cumplidos este período/.test(await p.locator("#view").innerText()), "sin «Ya cumplidos este período»");
  ok(await p.locator('.hab-chip[data-id="musica"] .hab-chip__ok').count() === 1 && await p.locator('.hab-chip[data-id="deporte"] .hab-chip__ok').count() === 0, "lo cumplido lleva ✓");
  const bordes = await p.evaluate(() => ["deporte", "biplot", "musica"].map(id => getComputedStyle(document.querySelector(`.hab-chip[data-id="${id}"]`)).borderTopColor));
  ok(bordes[0] !== bordes[1] && bordes[1] !== bordes[2] && bordes[0] !== bordes[2], "cada color se ve distinto en el borde · " + bordes.join(" "));
  ok(/en riesgo/.test(await p.locator('.hab-chip[data-id="deporte"]').getAttribute("aria-label")), "el estado también se dice en palabras (lectores de pantalla)");
  await p.locator(".hab-chips").first().scrollIntoViewIfNeeded();
  await shot(p, "habitos-color-inicio");

  // Marcar Deporte hoy: pasa a verde y se va al final
  await p.click('.hab-chip[data-id="deporte"]'); await p.waitForTimeout(400);
  const c2 = await chips();
  ok(c2[c2.length - 1] === "deporte:ok" || c2.includes("deporte:ok"), "al marcar Deporte hoy queda verde · " + c2.join(" "));

  // Hábitos › Hoy: las tarjetas grandes, igual
  await p.evaluate(() => go("habitos")); await p.waitForTimeout(600);
  const cards = await p.evaluate(() => [...document.querySelectorAll("#view .hb-grid .hb-today")].map(c => c.dataset.id + ":" + (c.className.match(/st-(\w+)/) || [])[1]));
  ok(cards.includes("musica:ok") && cards.includes("lectura:ve") && cards.indexOf("musica:ok") > cards.indexOf("lectura:ve"), "Hábitos: lo cumplido vuelve a la grilla, al final · " + cards.join(" "));
  ok(!/Ya cumplidos este período/.test(await p.locator("#view").innerText()), "Hábitos: sin «Ya cumplidos este período»");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "cabe en el celular");
  await shot(p, "habitos-color-habitos");
  await ctx.close();
};
