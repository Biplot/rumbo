/* Pruebas en navegador · 💎 Tus deseos, en el celular: las listas de deseos de antes se mudan a Finanzas (y Listas lleva hasta
   ahí), anotar un deseo (espera 7 días), saltar la espera, «Ahorrar para esto» (su alcancía), llenarla y «Lo compré» (lo pagado,
   lo que te ahorraste y el gasto del mes), soltar (lo que no gastaste) y volver a quererlo, «Mis caprichos» en orden y el
   recordatorio del cierre de mes. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-01T12:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const sec = () => p.locator("#deseos").innerText();
  const fila = n => p.locator(".des").filter({ hasText: n });
  const idDe = n => p.evaluate(n => (deseosVivos().find(d => d.nombre === n) || {}).id, n);
  const finanzas = async () => { await p.evaluate(() => { closeModal(); go("finanzas"); rerender(); }); await p.waitForTimeout(400); await p.locator("#deseos").scrollIntoViewIfNeeded(); await p.waitForTimeout(200); };
  await registrar(p, "deseos@test.cl");

  // 1) La lista de deseos de antes se muda sola; Listas lleva a Finanzas
  await p.evaluate(() => {
    STATE.finanzas.metaMensual = 120000;
    STATE.vida.listas.push({ id: "lx", nombre: "Mis deseos", tipo: "deseos", icon: "💎", items: [{ id: "i1", txt: "Lámpara", costo: 35000, done: false }, { id: "i2", txt: "Cámara instantánea", costo: 79990, done: true }] });
    saveState();
  });
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(600);
  await p.evaluate(() => { closeModal(); go("listas"); }); await p.waitForTimeout(400);
  ok(await p.locator(".lista-deseos-link").count() === 1 && !(await p.locator("#view").innerText()).includes("Total deseado"), "Listas: la lista de deseos ya no está; un enlace dice que Tus deseos están en Finanzas");
  await p.locator(".lista-deseos-link").click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => CURRENT) === "finanzas" && /Lámpara/.test(await sec()) && /Lo tienes \(1\)/.test(await sec()), "el enlace abre Finanzas: la lámpara pasó como deseo y la cámara (conseguida) a «Lo tienes»");

  // 2) Anotar un deseo: espera 7 días
  await p.locator('#deseos [data-action="des-nuevo"]').click(); await p.waitForTimeout(300);
  await p.fill("#des-nombre", "Zapatillas de trekking"); await p.fill("#des-precio", "120.000"); await p.fill("#des-link", "tienda.cl/zapatillas");
  await p.locator("#des-nuevo button[type=submit]").click(); await p.waitForTimeout(500);
  ok(/Esperando · quedan 7 días/.test(await fila("Zapatillas").innerText()) && /a tu ritmo, en 1 mes: en diciembre/.test(await fila("Zapatillas").innerText())
    && await fila("Zapatillas").locator('a.des__link[href="https://tienda.cl/zapatillas"]').count() === 1, "anotar: «Esperando · quedan 7 días», cuándo te alcanza a tu ritmo y el enlace de la tienda");

  // 3) Saltar la espera y «Ahorrar para esto»: su alcancía, unida al deseo
  await fila("Zapatillas").locator('[data-action="des-saltar"]').click(); await p.waitForTimeout(400);
  ok(/¿todavía lo quieres\?/.test(await fila("Zapatillas").innerText()) && /por decidir/.test(await sec()), "saltar la espera: «¿todavía lo quieres?» y el aviso «por decidir»");
  await fila("Zapatillas").locator('[data-action="des-ahorrar"]').click(); await p.waitForTimeout(700);
  const zap = await idDe("Zapatillas de trekking"), alcZap = await p.evaluate(id => deseoPorId(id).alc, zap);
  const tarjeta = p.locator(`[data-alc-card="${alcZap}"]`);
  ok(await tarjeta.count() === 1 && await tarjeta.locator(".alc__chip").count() === 1 && /\$0\s*de \$120\.000/.test(await tarjeta.innerText()) && /Ahorrando · 0%/.test(await fila("Zapatillas").innerText()),
    "«Ahorrar para esto»: su alcancía de $120.000, marcada como deseo, y el deseo «Ahorrando · 0 %»");

  // 4) Llenarla y «Lo compré»: lo pagado, lo que te ahorraste y el gasto del mes
  for (let i = 0; i < 4; i++) { await tarjeta.locator('[data-action="alc-sumar"]').first().click(); await p.waitForTimeout(250); }
  await p.waitForTimeout(900);
  ok(await tarjeta.locator('[data-action="des-comprar"]').isVisible(), "llena: la alcancía ofrece «Lo compré»");
  await tarjeta.locator('[data-action="des-comprar"]').click(); await p.waitForTimeout(300);
  await p.fill("#des-pagado", "110000"); await p.evaluate(() => deseoSobraTxt()); await p.locator("#des-gasto").check();
  ok(/Te ahorraste \$10\.000/.test(await p.locator("#modal").innerText()), "la hoja: «Te ahorraste $10.000» sobre el precio anotado");
  await p.locator('#modal [data-action="des-comprar-ok"]').click(); await p.waitForTimeout(3200);
  ok(await p.evaluate(id => !!deseoPorId(id).tengo && deseoPorId(id).tengo.pagado === 110000, zap) && await p.evaluate(a => !!alcPorId(a).cerrada, alcZap)
    && await p.evaluate(() => datosAnio(STATE, 2026).finanzas.meses[10].gasto) === 110000 && /Lo tienes \(2\)/.test(await sec()),
    "lo compré: el chanchito se rompe, la alcancía se cierra, $110.000 al gasto de noviembre y las zapatillas pasan a «Lo tienes»");

  // 5) Soltar: lo que no gastaste; y volver a quererlo
  await fila("Lámpara").locator('[data-action="des-soltar"]').click(); await p.waitForTimeout(400);
  ok(/Lo que no gastaste este año\s*\$35\.000/.test(await sec()) && /Soltados \(1\)/.test(await sec()), "soltar la lámpara: «Lo que no gastaste este año: $35.000»");
  await p.locator("#deseos details:has(summary:text('Soltados')) summary").click(); await p.locator('#deseos [data-action="des-volver"]').click(); await p.waitForTimeout(400);
  ok(await fila("Lámpara").count() === 1 && !/Lo que no gastaste/.test(await sec()), "«Lo quiero de nuevo» la devuelve, lista para decidir");

  // 6) Mis caprichos: una alcancía para varios deseos chicos, en orden
  await p.evaluate(() => { deseoNuevo({ nombre: "Libro", precio: 15000, creado: "2026-10-01" }); saveState(); rerender(); }); await p.waitForTimeout(300);
  await fila("Lámpara").locator('[data-action="des-capricho"]').click(); await p.waitForTimeout(500);
  await fila("Libro").locator('[data-action="des-capricho"]').click(); await p.waitForTimeout(500);
  const cap = p.locator(".alc").filter({ hasText: "Mis caprichos" });
  ok(await cap.count() === 1 && await cap.locator(".des-escalera li").count() === 2 && /\$0\s*de \$50\.000/.test(await cap.innerText()), "«A mis caprichos»: una sola alcancía de $50.000 con la lámpara y el libro en orden");
  await p.evaluate(id => { alcSumar(id, 40000); }, await p.evaluate(() => deseosCaprichosAlc().id)); await p.waitForTimeout(900);
  ok(await cap.locator(".des-escalera li.is-ok").count() === 1 && /¡Ya te alcanza!/.test(await fila("Lámpara").innerText()) && /Te faltan \$10\.000/.test(await fila("Libro").innerText()),
    "con $40.000: la lámpara ya te alcanza (✓) y al libro le faltan $10.000");
  await fila("Lámpara").locator('[data-action="des-comprar"]').click(); await p.waitForTimeout(300); await p.locator('#modal [data-action="des-comprar-ok"]').click(); await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const c = deseosCaprichosAlc(); return [alcGuardado(c), c.meta].join(); }) === "5000,15000", "comprar la lámpara: sale de la alcancía ($5.000 quedan) y su meta baja a $15.000");

  // 7) El cierre de mes recuerda los deseos por decidir
  await p.evaluate(() => { deseoNuevo({ nombre: "Reloj", precio: 60000, creado: "2026-10-01" }); saveState(); openMesCierre("2026-10"); }); await p.waitForTimeout(300);
  await p.locator('#modal [data-action="mes-next"]').click(); await p.waitForTimeout(400);
  ok(/Un deseo espera tu respuesta/.test(await p.locator("#modal").innerText()) && /Reloj/.test(await p.locator("#modal").innerText()), "el cierre de mes recuerda el deseo que espera respuesta");
  await p.evaluate(() => { MES_WIZ = null; closeModal(); });
  await finanzas();
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "nada se sale de la pantalla en el celular");
  await shot(p, "deseos", { fullPage: true });
  await ctx.close();
};
