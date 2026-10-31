/* Pruebas en navegador · 💧 Agua para todos, en el celular: la tarjeta en Inicio, llegar a la meta (+10 ⭐ y el hábito
   «Agua» marcado), deshacer (se devuelven), la hoja «Tu agua» (lo de hoy, la meta, el peso de Salud), los estilos
   y sabores de la Tienda, y tomar a sorbos con la bombilla. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-10-31T15:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const tarjeta = () => p.locator(".agua-card").innerText();
  const sumar = async ml => { await p.locator(`.agua-card [data-action="agua-sumar"][data-ml="${ml}"]`).click(); await p.waitForTimeout(150); };
  const mov = () => p.evaluate(() => { const l = (STATE.gamif.ledger || []).find(x => x.id === "agua:" + todayISO()); return l ? (l.anulado ? "anulado" : "dado") : "no"; });
  const habito = () => p.evaluate(() => { const h = aguaHabito(), n = new Date(); return !!h && habitDone(h.id, n.getMonth(), n.getDate()); });
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  await registrar(p, "agua@test.cl");
  await p.evaluate(() => go("inicio")); await p.waitForTimeout(500);

  // 1) La tarjeta en Inicio, con la botella (viene con Rumbo)
  ok(await p.locator(".agua-card canvas[data-agua='botella'][data-listo]").count() === 1 && /0 de 2 L/.test(await tarjeta()) && /Te faltan 8 vasos/.test(await tarjeta()),
    "Inicio: «Agua de hoy» con la botella, 0 de 2 L y 8 vasos por delante");
  ok(await p.evaluate(() => { const c = document.querySelector(".agua-card canvas"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n > 500; }), "la botella está dibujada");
  await p.locator(".agua-card").scrollIntoViewIfNeeded();
  for (const ml of [500, 500, 500, 250]) await sumar(ml);
  ok(/1,75 de 2 L/.test(await tarjeta()) && /Te falta 1 vaso/.test(await tarjeta()) && await p.locator(".agua-card .agua-vasos i.is-on").count() === 7, "cada toque suma: 1,75 L, «te falta 1 vaso» y 7 vasitos llenos");

  // 2) La meta: +10 ⭐ una vez y el hábito «Agua» marcado; deshacer los devuelve
  await sumar(250); await p.waitForTimeout(1500);
  ok(await mov() === "dado" && await habito() && /Meta del día cumplida/.test(await tarjeta()), "al llegar a 2 L: +10 ⭐ (agua:fecha) y el hábito «Agua» se marca solo");
  await p.locator(".agua-card").scrollIntoViewIfNeeded(); await p.locator('.agua-card [data-action="agua-deshacer"]').click(); await p.waitForTimeout(600);
  ok(await mov() === "anulado" && !(await habito()) && /1,75 de 2 L/.test(await tarjeta()), "«Deshacer el último» bajo la meta: se devuelven las ⭐ y se desmarca el hábito");
  await sumar(250); await p.waitForTimeout(1500);
  ok(await mov() === "dado" && await p.evaluate(() => STATE.gamif.ledger.filter(x => x.id === "agua:" + todayISO()).length) === 1, "al volver a llegar, las ⭐ vuelven (un solo movimiento por día)");

  // 3) La hoja «Tu agua»: lo de hoy, la semana y la meta (también la automática, con el peso de Salud)
  await p.locator('.agua-card [data-action="agua-abrir"]').click(); await p.waitForTimeout(500);
  ok(await p.locator("#modal .agua-reg").count() === 5 && await p.locator("#modal .agua-semana__d").count() === 7 && await p.locator("#modal canvas[data-modo='hoja'][data-listo]").count() === 1,
    "«Tu agua»: los 5 vasos de hoy (el que deshiciste no está), los últimos 7 días y la botella grande");
  await p.locator('#modal [data-action="agua-quitar"]').first().click(); await p.waitForTimeout(400);
  ok(await p.locator("#modal .agua-reg").count() === 4 && await mov() === "anulado", "quitar un vaso de la lista lo resta (y bajo la meta, se devuelven las ⭐)");
  await p.locator('#modal [data-action="agua-meta"][data-v="1500"]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => aguaMeta()) === 1500 && await mov() === "dado" && /de 1,5 L/.test(await p.locator("#modal").innerText()), "elegir 1,5 L: ya la cumpliste, y las ⭐ se dan al tiro");
  await p.evaluate(() => { const n = new Date(); datosAnio(STATE, n.getFullYear(), true).salud.meses[n.getMonth()].peso = 80; saveState(); });
  await p.locator('#modal [data-action="agua-meta"][data-v="0"]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => aguaMeta()) === 2800 && /Automática · 2,8 L/.test(await p.locator("#modal").innerText()) && /80 kg/.test(await p.locator("#modal").innerText()), "la automática sale de tu peso: 80 kg × 35 ml = 2,8 L");
  ok(await ancho() <= 390, "la hoja cabe en el celular");
  await shot(p, "agua-hoja");

  // 4) La Tienda › Tu agua: 4 estilos y 4 sabores; al comprar uno, se usa al tiro
  await p.evaluate(() => { closeModal(); registrarMovimiento("prueba:agua", 2000, 0, "Para probar"); go("recompensas"); }); await p.waitForTimeout(500);
  await p.click('[data-action="tienda-sec"][data-v="estilo"]'); await p.waitForTimeout(500);
  await p.locator('[data-action="tienda-mas"][data-v="agua"]').click(); await p.waitForTimeout(400);
  ok(await p.locator('#tienda-agua [data-cos^="agua-"]').count() === 4 && await p.locator('#tienda-agua [data-cos^="sabor-"]').count() === 4 && await ancho() <= 390,
    "Tienda › Tu agua: la burbuja, la cantimplora, la bombilla, el reloj de agua y 4 sabores (sin moverse de lado)");
  await p.evaluate(() => buyItem("agua-burbuja")); await p.waitForTimeout(400);
  ok(await p.evaluate(() => aguaEstilo()) === "burbuja", "comprar «la burbuja» la deja en uso");
  await p.evaluate(() => buyItem("sabor-frutilla")); await p.waitForTimeout(300);
  await p.evaluate(() => go("inicio")); await p.waitForTimeout(600);
  ok(await p.locator(".agua-card canvas[data-agua='burbuja'][data-listo]").count() === 1 && await p.evaluate(() => aguaSabor()) === "frutilla", "Inicio: ahora la burbuja, con agua de frutilla");
  await p.locator(".agua-card").scrollIntoViewIfNeeded(); await shot(p, "agua-burbuja");
  await p.locator('.agua-card [data-action="agua-abrir"]').click(); await p.waitForTimeout(400);
  ok(await p.locator('#modal [data-action="agua-estilo"]').count() === 2 && /3 estilos más en la Tienda/.test(await p.locator("#modal").innerText()) && await p.locator('#modal [data-action="agua-sabor"]').count() === 2,
    "en la hoja se elige entre tus estilos (la botella y la burbuja) y tus sabores, con la invitación a los demás");
  await p.locator('#modal [data-action="agua-estilo"][data-v="botella"]').click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => aguaEstilo()) === "botella", "y se vuelve a la botella cuando quieras");

  // 5) La bombilla: mantener apretado el vaso es tomar a sorbos (~100 ml por segundo)
  await p.evaluate(() => { closeModal(); buyItem("agua-bombilla"); go("inicio"); }); await p.waitForTimeout(600);
  const antes = await p.evaluate(() => aguaHoy());
  const cv = p.locator(".agua-card canvas[data-agua='bombilla']"); await cv.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  const box = await cv.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(1200); await p.mouse.up(); await p.waitForTimeout(400);
  const sorbo = (await p.evaluate(() => aguaHoy())) - antes;
  ok(sorbo >= 60 && sorbo <= 250 && sorbo % 10 === 0, `con la bombilla, mantener apretado ~1 s registra un sorbo (${sorbo} ml)`);
  ok(await ancho() <= 390, "Inicio sin moverse de lado");
  await ctx.close();
};
