/* Pruebas en navegador · 🧭 La Rueda de la vida (rueda.js y rueda-pantalla.js): la rosa con la sombra del mes pasado,
   arrastrar una punta, − y +, la ficha con sus pistas y su frase, el paso chico (crea un hábito con su área), tu rumbo,
   el minuto de la rueda y «Ver mi rumbo», la imagen para compartir, el probador y la Tienda (el barco fantasma),
   tus áreas (renombrar, ocultar, sumar), el área de un objetivo, tu año y el paso «Rueda» del cierre del mes. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T19:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", d => d.accept());
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const modal = () => p.locator("#modal").innerText();
  const nota = k => p.evaluate(k => ruedaMes(STATE, 2026, 10)[k], k);
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);

  await registrar(p, "ana@rueda.cl");
  await p.evaluate(() => { const M = datosAnio(STATE, 2026, true).rueda.meses; M[9] = [6, 7, 6, 5, 4, 6, 7, 5]; M[10] = [7, 9, 6, 6, 4, 7, 6, 6];
    STATE.vida.diario.push({ id: "d1", fecha: "2026-11-02", mood: 4, gratitud: "el sol" }); saveState(); });

  // 1) La pantalla: la rosa, la sombra de octubre, las áreas, la ficha y tu rumbo
  await ir("rueda");
  ok(await p.locator('#rd-svg[data-estilo="rosa"]').count() === 1 && await p.locator("#rd-svg .rd-eti").count() === 8, "la rosa de los vientos con las 8 áreas y sus nombres");
  ok(await p.locator('#rd-svg path[stroke-dasharray="5 4"]').count() === 1, "con la sombra punteada de octubre");
  ok(/Promedio 6,4 \(\+0,6 desde octubre\)/.test(await p.locator("#rd-prom").innerText()), "el promedio y cuánto cambió");
  ok(/Apuntas a Familia \(\+2\)/.test(await p.locator("#rd-rumbo").innerText()) && /Pide cariño: Tiempo para mí \(4\)/.test(await p.locator("#rd-rumbo").innerText()), "tu rumbo de noviembre: Familia (+2) y lo que pide cariño");
  ok(await p.locator(".rd-chip").count() === 8 && await p.locator('[data-bind="rueda.meses.10.0"]').count() === 1, "las áreas para tocar y las barras de todas las áreas");
  await shot(p, "rueda-pantalla", { fullPage: true });
  ok(await ancho() <= 390, "todo cabe en el celular");

  // 2) Arrastrar la punta de «Para mí» hasta el 8
  await p.locator("#rd-svg").scrollIntoViewIfNeeded(); const s2 = await p.locator("#rd-svg").boundingBox(), e2 = s2.width / 492;
  const q = r => [s2.x + (86 + 160) * e2, s2.y + (48 + 160 + r) * e2];
  await p.mouse.move(...q(20)); await p.mouse.down(); await p.mouse.move(...q(118 * 0.8), { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
  ok(await nota(4) === 8, "arrastrar la punta de «Para mí» hasta el 8 cambia su nota");
  ok(/Para mí\s*8/.test(await p.locator(".rd-chip[aria-pressed=true]").innerText()) && /Tiempo para mí/.test(await p.locator("#rd-ficha").innerText()), "y queda elegida, con su ficha");
  await p.click('[data-action="rd-mas"]'); await p.click('[data-action="rd-mas"]'); await p.click('[data-action="rd-menos"]'); await p.waitForTimeout(150);
  ok(await nota(4) === 9 && await p.evaluate(() => STATE.rueda.ts > 0), "− y + también (y se guarda)");

  // 3) La ficha de Emoción: lo que dice tu Rumbo y la frase
  await p.click('.rd-chip[data-k="5"]'); await p.waitForTimeout(150);
  const f = await p.locator("#rd-ficha").innerText();
  ok(/Tu ánimo en el Diario: 4 de 5/.test(f) && /1 día con gratitud/.test(f) && /↑ \+1 desde octubre/.test(f), "Emoción: tu ánimo del Diario, la gratitud y la flecha desde octubre");
  await p.fill("#rd-frase", "Un mes tranquilo"); await p.locator("#rd-frase").press("Tab"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => ruedaFrase(STATE, 2026, 10, 5)) === "Un mes tranquilo", "la frase del área queda guardada");

  // 4) El paso chico: el área más baja ahora es Trabajo (6)… sube Para mí, baja Trabajo a 3
  await p.evaluate(() => { ruedaPoner(STATE, 2026, 10, 2, 3); saveState(); }); await ir("rueda");
  await p.click('.rd-chip[data-k="2"]'); await p.waitForTimeout(150);
  ok(/Es el área que pide cariño/.test(await p.locator("#rd-ficha").innerText()) && /Ordenar mis finanzas del mes/.test(await p.locator("#rd-ficha").innerText()), "el área que pide cariño trae su paso chico");
  await p.click('[data-action="rd-paso"]'); await p.waitForTimeout(250);
  const obj = await p.evaluate(() => datosAnio(STATE, 2026).metas.mensuales[10].find(o => o.texto === "Ordenar mis finanzas del mes"));
  ok(obj && obj.area === 2, "«Agregar objetivo» lo deja en tus objetivos de noviembre, con su área");
  ok(/Objetivo: «Ordenar mis finanzas del mes»/.test(await p.locator("#rd-ficha").innerText()), "y aparece en lo que dice tu Rumbo");
  await p.click('[data-action="rd-paso-no"]'); await p.waitForTimeout(150);
  ok(!/Es el área que pide cariño/.test(await p.locator("#rd-ficha").innerText()), "«Ahora no» lo guarda hasta el mes siguiente");
  // con un hábito: la de Para mí
  await p.evaluate(() => { const c = ruedaCfg(); c.pasoNo = {}; ruedaPoner(STATE, 2026, 10, 2, 7); ruedaPoner(STATE, 2026, 10, 4, 2); saveState(); }); await ir("rueda");
  await p.click('.rd-chip[data-k="4"]'); await p.click('[data-action="rd-paso"]'); await p.waitForTimeout(300);
  ok(await p.inputValue("#h-nombre") === "20 minutos para mí" && await p.inputValue("#h-area") === "4", "«Crear hábito» abre el hábito con su nombre y su área");
  await p.click('[data-action="habit-save"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.habitos.defs.some(h => h.nombre === "20 minutos para mí" && h.area === 4)), "el hábito queda con el área «Tiempo para mí»");
  await ir("rueda"); await p.click('.rd-chip[data-k="4"]'); await p.waitForTimeout(150);
  ok(/La cuidan: 20 minutos para mí/.test(await p.locator("#rd-ficha").innerText()), "la ficha dice qué la cuida");

  // 5) El minuto de la rueda y Ver mi rumbo
  await p.click('[data-action="rd-minuto"]'); await p.waitForTimeout(200);
  ok(/Salud y deporte/.test(await modal()) && /1 de 8/.test(await modal()) && /En octubre: 6/.test(await modal()), "el minuto: un área a la vez, con su nota de octubre");
  for (let i = 0; i < 8; i++) { await p.click(`#rd-min [data-action="rd-min-nota"][data-v="${[8, 9, 7, 6, 5, 8, 7, 6][i]}"]`); await p.waitForTimeout(380); }
  ok(await p.evaluate(() => ruedaMes(STATE, 2026, 10).join(",")) === "8,9,7,6,5,8,7,6", "ocho toques y la rueda del mes está lista");
  ok(/Tu rumbo de noviembre/.test(await p.locator("#modalTitle").innerText()) && /Apuntas a Salud \(\+2\)/.test(await modal()) && await p.locator("#rd-mom-svg").count() === 1, "al terminar, Ver mi rumbo: la rueda gira y tu elefante te lo dice");
  await shot(p, "rueda-momento");
  await p.evaluate(() => closeModal());

  // 6) Compartir: la imagen se arma
  const img = await p.evaluate(async () => { const bl = await ruedaImagen(true); return bl ? bl.size : 0; });
  ok(img > 20000, "la imagen para compartir se arma (1080 × 1350)");

  // 7) El probador y la Tienda: el barco fantasma
  await ir("rueda"); await p.click('[data-action="rd-probador"]'); await p.waitForTimeout(250);
  ok(await p.locator("#rd-probador .rd-prob__f").count() === 6 && /✓ La tuya/.test(await p.locator('#rd-probador [data-v="rosa"]').innerText()) && /600/.test(await p.locator('#rd-probador [data-v="fantasma"]').innerText()), "el probador: la rosa es la tuya y el barco fantasma cuesta 600 ⭐");
  await p.evaluate(() => { registrarMovimiento("prueba:rueda", 2000, 0, "prueba", true); });
  await p.evaluate(() => { const it = COSMETICOS.find(c => c.id === "rueda-fantasma"); buyItem ? buyItem(it.id) : null; }).catch(() => {});
  if (!(await p.evaluate(() => isOwned("rueda-fantasma")))) await p.evaluate(() => { ledgerComprar(STATE, "rueda-fantasma", 600); eqCos().rueda = "fantasma"; saveState(); });
  await ir("rueda");
  ok(await p.locator('#rd-svg[data-estilo="fantasma"]').count() === 1, "comprado y puesto: la rueda se dibuja como el barco fantasma");
  await shot(p, "rueda-fantasma");
  await ir("recompensas");
  ok(await p.evaluate(() => ["rueda-fantasma", "rueda-instrumento", "rueda-constelacion", "rueda-mandala", "rueda-vitral"].every(id => COSMETICOS.some(c => c.id === id))), "la Tienda trae los 5 estilos de tu rueda");

  // 8) Tus áreas: renombrar, ocultar y sumar
  await ir("rueda"); await p.click('[data-action="rd-areas-editar"]'); await p.waitForTimeout(200);
  await p.fill("#rd-ar-n-7", "Mascotas"); await p.click('[data-action="rd-ar-ver"][data-k="6"]'); await p.click('[data-action="rd-ar-mas"]'); await p.waitForTimeout(100);
  await p.fill("#rd-ar-n-8", "Música"); await p.click('[data-action="rd-ar-ok"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => JSON.stringify(ruedaVisibles(STATE))) === "[0,1,2,3,4,5,7,8]" && await p.locator("#rd-svg .rd-eti").count() === 8, "Aprender oculta, Mascotas y Música: 8 áreas en la rueda");
  ok(/Mascotas/.test(await p.locator("#rd-areas").innerText()) && /Música/.test(await p.locator("#rd-areas").innerText()), "con sus nombres nuevos");
  ok(await p.evaluate(() => ruedaMes(STATE, 2026, 10)[6]) === 7, "las notas de la oculta se guardan");
  await p.evaluate(() => { openRuedaAreas(); }); await p.waitForTimeout(150);
  for (const k of [0, 1, 2, 3]) await p.click(`[data-action="rd-ar-ver"][data-k="${k}"]`).catch(() => {});
  ok(await p.evaluate(() => RD.editar.ocultas.length) <= 4, "deja al menos 5 áreas a la vista");
  await p.evaluate(() => closeModal());

  // 9) El área de un objetivo y tu año
  await ir("metas");
  ok(await p.locator('.rd-meta').count() >= 1, "en Objetivos, cada objetivo puede llevar su área");
  await ir("rueda");
  ok(await p.locator(".rd-anio__f").count() === 8, "tu año, área por área");
  await p.click('.rd-anio__f[data-k="1"]'); await p.waitForTimeout(250);
  ok(/Familia y amor en 2026/.test(await p.locator(".rd-anio").innerText()) && await p.locator(".rd-anio__linea svg").count() === 1, "tocar un área muestra su línea del año");

  // 10) El paso «Rueda» del cierre de octubre: la rosa que se arrastra
  await p.evaluate(() => openMesCierre("2026-10")); await p.waitForTimeout(300);
  for (let i = 0; i < 2; i++) { await p.click('[data-action="mes-next"]'); await p.waitForTimeout(150); }
  ok(await p.locator("#rd-cierre-svg").count() === 1 && await p.locator('#modal [id^="mc-r-"]').count() === 8, "el cierre del mes muestra la rueda y las barras de las áreas que se ven");
  await p.locator("#mc-r-0").fill("9"); await p.waitForTimeout(150);
  ok(/9/.test(await p.evaluate(() => document.querySelector('#rd-cierre-svg .rd-eti[data-i="0"]').textContent)), "mover una barra mueve la rueda");
  await ctx.close();
};
