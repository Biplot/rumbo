/* Pruebas en navegador · 🐷 Tus alcancías, en el celular: Finanzas sin alcancías (el chanchito de muestra), crear una,
   guardar con los montos rápidos y con «Otro», llenarla (+50 ⭐ y la medalla «Primera alcancía»), deshacer (se devuelven),
   ocultar montos, romper el chanchito (queda en «Cumplidas» y «Otra igual»), los estilos y las monedas de la Tienda,
   las paradas del viaje, la racha de ahorro, el reparto del cierre de mes y la torre del año. */
const { nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-01T12:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const sec = () => p.locator("#alcancias").innerText();
  const card = n => p.locator(`.alc[data-alc-card]`).filter({ hasText: n });
  const mov = id => p.evaluate(id => { const l = (STATE.gamif.ledger || []).find(x => x.id === id); return l ? (l.anulado ? "anulado" : "dado") : "no"; }, id);
  const idDe = n => p.evaluate(n => (STATE.alcancias.lista.find(a => a.nombre === n) || {}).id, n);
  const dibujado = sel => p.evaluate(s => { const c = document.querySelector(s); if (!c) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 500; }, sel);
  const finanzas = async () => { await p.evaluate(() => { closeModal(); go("finanzas"); rerender(); }); await p.waitForTimeout(500); await p.locator("#alcancias").scrollIntoViewIfNeeded(); await p.waitForTimeout(300); };
  await registrar(p, "alcancias@test.cl");
  await p.evaluate(() => { STATE.finanzas.metaMensual = 200000; saveState(); });
  await finanzas();

  // 1) Sin alcancías: el chanchito de greda de muestra y el botón para crear la primera
  ok(await p.locator("#alcancias .alc-vacio canvas[data-alc='greda'][data-listo]").count() === 1 && /Crear mi primera alcancía/.test(await sec()) && await dibujado("#alcancias .alc-vacio canvas"),
    "Finanzas sin alcancías: el chanchito de greda dibujado y «+ Crear mi primera alcancía»");

  // 2) Crear una: nombre, meta y estilo (solo el chanchito de greda viene con Rumbo)
  await p.locator('#alcancias .alc-vacio [data-action="alc-nueva"]').click(); await p.waitForTimeout(300);
  ok(await p.locator("#modal .alc-estilo").count() === 1 && await p.locator('#modal [data-action="alc-tienda"]').count() === 1, "la hoja nueva: el chanchito de greda y «6 estilos más en la Tienda»");
  await p.locator('#modal [data-action="alc-guardar"]').click(); await p.waitForTimeout(200);
  ok(await p.locator("#modal #alc-hoja").count() === 1 && await p.evaluate(() => STATE.alcancias.lista.length) === 0, "sin nombre ni meta no se crea");
  await p.fill("#alc-nombre", "Vacaciones"); await p.fill("#alc-meta", "100.000");
  await p.locator('#modal [data-action="alc-guardar"]').click(); await p.waitForTimeout(600);
  const vac = await idDe("Vacaciones");
  ok(!!vac && await card("Vacaciones").count() === 1 && /\$0\s*de \$100\.000/.test(await card("Vacaciones").innerText()) && await p.locator(`.alc canvas[data-alc='greda'][data-id='${vac}'][data-listo]`).count() === 1,
    "la alcancía «Vacaciones»: $0 de $100.000, con su chanchito de greda");
  ok(/\+ \$50\.000/.test(await card("Vacaciones").innerText()) && /\+ \$100\.000/.test(await card("Vacaciones").innerText()), "los montos rápidos salen de la meta mensual ($200.000): un cuarto y la mitad");

  // 3) Guardar: los textos cambian ahí mismo y las monedas caen; «Otro» para un monto a mano
  await card("Vacaciones").locator('[data-action="alc-sumar"][data-monto="50000"]').click(); await p.waitForTimeout(900);
  ok(/\$50\.000\s*de \$100\.000/.test(await card("Vacaciones").innerText()) && /50%/.test(await card("Vacaciones").innerText()) && await card("Vacaciones").locator("[data-alc-deshacer]").isVisible(),
    "+ $50.000: 50 % y «Deshacer el último» a la vista (sin volver a dibujar Finanzas)");
  await card("Vacaciones").locator('[data-action="alc-otro"]').click(); await p.waitForTimeout(300);
  await p.fill("#alc-otro-monto", "30.000"); await p.locator('#modal button[data-action="alc-otro-ok"]').last().click(); await p.waitForTimeout(900);
  ok(/\$80\.000\s*de \$100\.000/.test(await card("Vacaciones").innerText()) && /Faltan \$20\.000/.test(await card("Vacaciones").innerText()), "«Otro»: $30.000 escritos a mano; faltan $20.000");

  // 4) Llenarla: +50 ⭐ una vez y la medalla «Primera alcancía»; deshacer bajo la meta las devuelve
  await card("Vacaciones").locator('[data-action="alc-sumar"][data-monto="50000"]').click(); await p.waitForTimeout(2200);
  ok(await mov("alc:" + vac) === "dado" && await p.evaluate(() => STATE.gamif.badges.includes("primera-alcancia")) && await card("Vacaciones").locator("[data-alc-cerrar]").isVisible()
    && /Romper el chanchito/.test(await card("Vacaciones").innerText()) && /Meta cumplida/.test(await card("Vacaciones").innerText()),
    "llena: +50 ⭐ (alc:id), la medalla «Primera alcancía» y «Romper el chanchito»");
  await card("Vacaciones").locator("[data-alc-deshacer]").click(); await p.waitForTimeout(500);
  ok(await mov("alc:" + vac) === "anulado" && !(await card("Vacaciones").locator("[data-alc-cerrar]").isVisible()), "deshacer bajo la meta: se devuelven las ⭐ y se esconde «Romper»");
  await card("Vacaciones").locator('[data-action="alc-sumar"][data-monto="50000"]').click(); await p.waitForTimeout(1200);
  ok(await mov("alc:" + vac) === "dado" && await p.evaluate(id => STATE.gamif.ledger.filter(x => x.id === "alc:" + id).length, vac) === 1, "al volver a llenarla, las ⭐ vuelven (un solo movimiento)");

  // 5) Ocultar montos: solo porcentajes
  await p.locator('#alcancias [data-action="alc-ocultar"]').click(); await p.waitForTimeout(500);
  ok(!/\$130\.000|\$100\.000/.test(await card("Vacaciones").locator("[data-alc-monto]").innerText()) && /100%/.test(await card("Vacaciones").locator("[data-alc-monto]").innerText()), "«Ocultar montos»: se ve el porcentaje y no la plata");
  await p.locator('#alcancias [data-action="alc-ocultar"]').click(); await p.waitForTimeout(400);
  await shot(p, "alcancias-llena");

  // 6) Romper el chanchito: el mazo, los pedazos y queda en «Cumplidas»; «Otra igual» la vuelve a armar
  await card("Vacaciones").locator("[data-alc-cerrar]").click(); await p.waitForTimeout(3300);
  ok(await p.evaluate(id => !!STATE.alcancias.lista.find(a => a.id === id).cerrada, vac) && await card("Vacaciones").count() === 0 && /Cumplidas \(1\)/.test(await sec()), "romper el chanchito: la alcancía se cierra y pasa a «Cumplidas»");
  await p.locator("#alcancias .alc-cumplidas summary").click(); await p.locator('#alcancias [data-action="alc-otra"]').click(); await p.waitForTimeout(300);
  ok(await p.inputValue("#alc-nombre") === "Vacaciones" && await p.inputValue("#alc-meta") === "100000", "«Otra igual»: una nueva con el mismo nombre y meta");
  await p.evaluate(() => closeModal());

  // 7) La Tienda › Tus alcancías: fichas dibujadas; al comprar un estilo, se elige en la hoja
  await p.evaluate(() => { ledgerRegistrar(STATE, "regalo-prueba", 4000, 0, "prueba"); saveState(); TIENDA_SEC = "estilo"; go("recompensas"); }); await p.waitForTimeout(600);
  await p.evaluate(() => TIENDA_ABIERTOS.add("alcancia")); await p.evaluate(() => rerender()); await p.waitForTimeout(500);
  ok(await p.locator(".ficha canvas.alc-ficha[data-listo]").count() >= 6, "Tienda › Tus alcancías: los estilos y las monedas, dibujados en sus fichas");
  await p.locator('.ficha[data-cos="alc-ele-suerte"]').click(); await p.waitForTimeout(400);
  ok(await p.locator("#modal .alc-muestra canvas[data-alc='ele-suerte'][data-listo]").count() === 1 && await dibujado("#modal .alc-muestra canvas"), "el detalle muestra el elefante de la suerte en grande");
  await p.locator('#modal [data-action="cos-buy"]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => isOwned("alc-ele-suerte")), "comprado el elefante de la suerte (500 ⭐)");
  await p.evaluate(() => { closeModal(); buyItem("mon-plata"); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => alcMoneda()) === "plata", "las monedas de plata quedan puestas al comprarlas");
  await finanzas();
  await p.locator('#alcancias .card__head [data-action="alc-nueva"]').click(); await p.waitForTimeout(300);
  ok(await p.locator("#modal .alc-estilo").count() === 2, "en la hoja ya aparece el elefante de la suerte");
  await p.fill("#alc-nombre", "Fondo de emergencia"); await p.fill("#alc-meta", "900000");
  await p.locator('#modal [data-action="alc-estilo"][data-v="ele-suerte"]').click(); await p.waitForTimeout(300);
  ok(await p.inputValue("#alc-nombre") === "Fondo de emergencia" && await p.locator('#modal .alc-estilo.is-on[data-v="ele-suerte"]').count() === 1, "elegir el estilo no borra lo escrito");
  await p.locator('#modal [data-action="alc-guardar"]').click(); await p.waitForTimeout(700);
  const fondo = await idDe("Fondo de emergencia");
  ok(await p.locator(`.alc canvas[data-alc='ele-suerte'][data-id='${fondo}'][data-listo]`).count() === 1 && await dibujado(`.alc canvas[data-id='${fondo}']`), "«Fondo de emergencia» con el elefante de la suerte");

  // 8) El viaje: cada parada da +10 ⭐
  await p.evaluate(() => { ledgerComprar(STATE, "alc-viaje", 400); alcCrear({ nombre: "Viaje al sur", meta: 100000, estilo: "viaje", destino: "Puerto Varas" }); saveState(); rerender(); }); await p.waitForTimeout(500);
  const viaje = await idDe("Viaje al sur");
  await card("Viaje al sur").scrollIntoViewIfNeeded(); await card("Viaje al sur").locator('[data-action="alc-sumar"][data-monto="50000"]').click(); await p.waitForTimeout(1200);
  ok(await mov(`alc-parada:${viaje}:25`) === "dado" && await mov(`alc-parada:${viaje}:50`) === "dado" && await mov(`alc-parada:${viaje}:75`) === "no", "el viaje al 50 %: las paradas del 25 y del 50 dan +10 ⭐ cada una");

  // 9) La racha de ahorro: 4 semanas seguidas guardando algo, +20 ⭐
  await p.evaluate(id => { ["2026-10-07", "2026-10-14", "2026-10-21"].forEach(f => alcAportar(id, 5000, null, STATE, f)); saveState(); rerender(); }, fondo); await p.waitForTimeout(400);
  await card("Fondo de emergencia").scrollIntoViewIfNeeded(); await card("Fondo de emergencia").locator('[data-action="alc-sumar"][data-monto="50000"]').click(); await p.waitForTimeout(1200);
  ok(await mov("alc-racha:2026-10-26") === "dado", "4 semanas seguidas con algo guardado: +20 ⭐ (alc-racha:lunes)");

  // 10) El cierre de mes: lo que ahorraste en octubre se reparte entre tus alcancías
  await p.evaluate(() => { const D = datosAnio(STATE, 2026, true); D.finanzas.meses[9].ingreso = 1500000; D.finanzas.meses[9].gasto = 1380000; saveState(); openMesCierre("2026-10"); }); await p.waitForTimeout(300);
  await p.locator('#modal [data-action="mes-next"]').click(); await p.waitForTimeout(400);
  ok(/En octubre ahorraste \$120\.000/.test(await p.locator("#modal").innerText()) && await p.locator("#modal [data-alc-reparto]").count() === 2, "cierre de octubre: «ahorraste $120.000» y una casilla por cada alcancía abierta");
  await p.locator("#modal [data-alc-reparto]").nth(0).fill("70000"); await p.locator("#modal [data-alc-reparto]").nth(1).fill("90000");
  await p.locator('#modal [data-action="alc-repartir"]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => alcRepartido(STATE, "2026-10")) === 0, "no se puede repartir más de lo ahorrado");
  await p.locator("#modal [data-alc-reparto]").nth(1).fill("50000"); await p.locator('#modal [data-action="alc-repartir"]').click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => alcRepartido(STATE, "2026-10")) === 120000 && /Repartiste \$120\.000/.test(await p.locator("#modal").innerText()), "repartido: $120.000 en dos alcancías, con fecha de fin de octubre");
  await p.evaluate(() => { MES_WIZ = null; closeModal(); });

  // 11) La torre del año: arriba en Finanzas; tocar un mes dice cuánto guardaste
  await finanzas(); await p.locator(".alc-torre").scrollIntoViewIfNeeded(); await p.waitForTimeout(2200);
  ok(await p.locator("canvas[data-alc='torre'][data-listo]").count() === 1 && await dibujado("canvas[data-alc='torre']") && /octubre: guardaste \$120\.000 \(60% de tu meta del mes\)/.test(await p.locator(".alc-torre").innerText()),
    "la torre del año: octubre en monedas y «guardaste $120.000 (60 % de tu meta del mes)»");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "nada se sale de la pantalla en el celular");
  await p.evaluate(() => { STATE.settings.theme = "norte-noche"; applyTheme("norte-noche"); }); await p.waitForTimeout(500);
  ok(await dibujado(`.alc canvas[data-id='${fondo}']`), "en Norte noche, las alcancías se vuelven a dibujar");
  await shot(p, "alcancias-noche", { fullPage: true });
  await ctx.close();
};
