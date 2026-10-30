/* Pruebas en navegador · Objetivos en conjunto: crear uno con un amigo, unirse, aportar, la barra de cada uno,
   lograrlo (+20 ⭐ y la medalla En Equipo), editar, borrar un aporte y salir. Las cuentas locales comparten
   la "base" de amigos (LocalBackend), con las reglas de supabase/objetivos.sql. */
const { URL, nuevoContexto, registrar, shot, hojaAmigos } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T11:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir();
    await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    await p.evaluate(() => closeModal());
  };
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };   // sin hojas abiertas
  const vista = () => p.locator("#view").innerText();
  const tarjeta = () => p.locator(".oj").first().innerText();
  const aportar = async (cant, nota) => {
    await p.click('.oj [data-action="oj-aportar"]'); await p.waitForTimeout(300);
    await p.fill("#oj-cant", cant); if (nota) await p.fill("#oj-nota", nota);
    await p.click('[data-action="oj-aporte-ok"]'); await p.waitForTimeout(800);
  };
  const ledger = () => p.evaluate(() => STATE.gamif.ledger.filter(m => m.id.startsWith("objetivo-juntos:")).map(m => !m.anulado));

  // 0) Ana y Bruno ya son amigos
  await registrar(p, "ana@oj.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  await salir(); await registrar(p, "bruno@oj.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@oj.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);

  // 1) Ana crea «Viaje a Chiloé» con Bruno, en Objetivos
  await ir("metas");
  ok(/con amigos/i.test(await vista()) && /tus objetivos/i.test(await vista()), "Objetivos tiene una sección Con amigos, arriba de tus objetivos de siempre");
  await p.click('[data-action="oj-nuevo"]'); await p.waitForTimeout(300);
  await p.fill("#oj-nombre", "Viaje a Chiloé"); await p.fill("#oj-meta", "600.000"); await p.fill("#oj-limite", "2026-12-15");
  await p.check("#oj-amigos input"); await p.click('[data-action="oj-guardar"]'); await p.waitForTimeout(900);
  const t1 = await tarjeta();
  ok(t1.includes("Viaje a Chiloé") && t1.includes("$0") && t1.includes("de $600.000") && t1.includes("quedan 41 días"), "aparece la tarjeta: $0 de $600.000, hasta el 15 de diciembre (quedan 41 días)");

  // 2) Bruno se une desde Amigos
  await entrar("bruno@oj.cl");
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 1, "a Bruno le aparece el punto en Amigos");
  await ir("amigos");
  ok((await p.locator(".at-fila", { hasText: "Viaje a Chiloé" }).innerText()).includes("Ana te invita a un objetivo"), "y la invitación al objetivo, en «Para responder»");
  await p.click('.at-fila [data-action="oj-unirme"]'); await p.waitForTimeout(900);
  ok(await p.locator(".at-fila", { hasText: "Viaje a Chiloé" }).count() === 0 && (await p.locator('.at-tile[data-v="objetivos"]').innerText()).includes("Viaje a Chiloé")
    && (await hojaAmigos(p, "objetivos")).includes("Viaje a Chiloé"), "al unirse, lo ve en la baldosa Objetivos (y en su hoja)");

  // 3) Bruno aporta $165.000
  await ir("metas"); await aportar("165.000", "vendí la bici");
  const t2 = await tarjeta();
  ok(t2.includes("$165.000") && t2.includes("Tú · $165.000") && t2.includes("27 %"), "Bruno suma $165.000: la barra lo muestra con su color (27 %)");

  // 4) Ana ve lo de Bruno y aporta $215.000
  await entrar("ana@oj.cl"); await ir("metas");
  ok((await tarjeta()).includes("Bruno · $165.000"), "Ana ve cuánto puso Bruno");
  await aportar("215000");
  const t3 = await tarjeta();
  ok(t3.includes("$380.000") && t3.includes("63 %") && t3.includes("Tú · $215.000"), "con lo de Ana van $380.000 (63 %)");
  await shot(p, "objetivos-tarjeta");
  await p.click('.oj [data-action="oj-ver"]'); await p.waitForTimeout(300);
  const det = await p.locator("#modal").innerText();
  ok(det.includes("«vendí la bici»") && /últimos aportes/i.test(det) && await p.locator('#modal [data-action="oj-aporte-del"]').count() === 1, "el detalle muestra los aportes (con la nota de Bruno); solo el tuyo se puede borrar");
  await p.evaluate(() => closeModal());

  // 5) Lo logran: +20 ⭐ y la medalla En Equipo
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await aportar("220000");
  await ir("metas");
  ok((await tarjeta()).includes("¡Lo lograron juntos!") && (await tarjeta()).includes("100 %"), "con $220.000 más lo logran: ¡Lo lograron juntos!");
  ok((await ledger()).join() === "true" && await p.evaluate(() => STATE.gamif.badges.includes("en-equipo")), "Ana gana +20 ⭐ y la medalla En Equipo");
  ok(await p.evaluate(() => STATE.gamif.puntos) - antes >= 20 + 150, "(las estrellas de la medalla también)");
  await shot(p, "objetivos-logrado");
  await entrar("bruno@oj.cl");
  ok((await ledger()).join() === "true" && await p.evaluate(() => STATE.gamif.badges.includes("en-equipo")), "Bruno también, al entrar");

  // 6) Ana sube la meta: ya no llega y el +20 se anula (la medalla queda)
  await entrar("ana@oj.cl"); await ir("metas");
  await p.click('.oj [data-action="oj-ver"]'); await p.waitForTimeout(300);
  await p.click('[data-action="oj-editar"]'); await p.waitForTimeout(300);
  await p.fill("#oj-meta", "900000"); await p.click('[data-action="oj-guardar"]'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("de $900.000") && !(await tarjeta()).includes("¡Lo lograron"), "subir la meta a $900.000 lo deja en curso de nuevo");
  ok((await ledger()).join() === "false" && await p.evaluate(() => STATE.gamif.badges.includes("en-equipo")), "el +20 se anula; la medalla se queda");

  // 7) Borrar un aporte propio
  await p.click('.oj [data-action="oj-ver"]'); await p.waitForTimeout(300);
  await p.click('#modal [data-action="oj-aporte-del"] >> nth=0'); await p.waitForTimeout(800);
  ok((await tarjeta()).includes("$380.000"), "Ana borra su aporte de $220.000: vuelven a $380.000");

  // 8) El perfil de Bruno: lo que hacen juntos y proponer otro
  await ir("amigos"); await hojaAmigos(p, "amigos");
  await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  const perfil = await p.locator("#modal").innerText();
  ok(perfil.includes("Viaje a Chiloé") && perfil.includes("Proponer un objetivo") && perfil.includes("Proponer un hábito"), "en el perfil de Bruno: el objetivo que comparten y proponer otro");
  await p.click('#modal [data-action="oj-nuevo"]'); await p.waitForTimeout(300);
  ok(await p.locator("#oj-amigos input:checked").count() === 1, "proponer un objetivo abre el formulario con Bruno elegido");
  await p.evaluate(() => closeModal());

  // 9) Bruno sale: sus aportes siguen sumando
  await entrar("bruno@oj.cl"); await ir("metas");
  await p.click('.oj [data-action="oj-ver"]'); await p.waitForTimeout(300);
  await p.click('[data-action="oj-editar"]'); await p.waitForTimeout(300);
  await p.click('[data-action="oj-salir"]'); await p.waitForTimeout(900);
  ok(!(await vista()).includes("Viaje a Chiloé"), "Bruno sale y deja de verlo");
  await entrar("ana@oj.cl"); await ir("metas");
  ok((await tarjeta()).includes("Bruno (salió) · $165.000") && (await tarjeta()).includes("$380.000"), "Ana sigue con lo que aportó Bruno");

  // 10) Mientras no se corra supabase/objetivos.sql
  await p.evaluate(() => { BACKEND.objetivoLista = async () => ({ error: "sin-servidor" }); Object.assign(OBJ, { lista: null, error: null, t: 0 }); });
  await p.evaluate(() => objetivosCargar(true)); await ir("metas");
  ok(!/con amigos/i.test(await vista()) && /metas trimestrales/i.test(await vista()), "sin la base de objetivos, Objetivos queda como siempre");
  await ctx.close();
};
