/* Pruebas en navegador · Hábitos en conjunto: crear uno con un amigo, unirse, marcarlo los dos,
   la racha de a dos y el +5 ⭐, editarlo para todos, salir y borrar. Las cuentas locales comparten
   la "base" de amigos (LocalBackend), con las reglas de supabase/conjunto.sql. */
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
  const yo = () => p.evaluate(() => localStorage.getItem("rumbo_session"));
  const hoy = "2026-11-04";

  // 0) Ana y Bruno ya son amigos
  await registrar(p, "ana@cj.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim(), idA = await yo();
  await salir(); await registrar(p, "bruno@cj.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await yo();
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@cj.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB);

  // 1) Ana crea «Leer 20 minutos» con Bruno, desde Hábitos
  await ir("habitos"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);
  await p.click('[data-action="habit-add"]'); await p.waitForTimeout(300);
  ok((await p.locator("#modal").innerText()).includes("Con amigos") && await p.locator("#cj-amigos input").count() === 1, "el formulario de un hábito nuevo ofrece hacerlo con tus amigos");
  await p.fill("#h-nombre", "Leer 20 minutos");
  await p.click('#h-iconos [data-ic="📖"]');
  await p.check("#cj-amigos input"); await p.click('[data-action="habit-save"]'); await p.waitForTimeout(900);
  const hA = await p.evaluate(() => STATE.habitos.defs.find(h => h.conjunto));
  ok(hA && hA.nombre === "Leer 20 minutos" && hA.id === "cj-" + hA.conjunto && hA.icon === "📖", "queda como hábito tuyo, unido al hábito en conjunto");
  await ir("inicio");
  const filaA = await p.locator(".cj-inicio").innerText();
  ok(/con amigos/i.test(filaA) && filaA.includes("Leer 20 minutos") && filaA.includes("Esperando a Bruno"), "en Inicio aparece aparte, esperando a Bruno");
  ok(!(await p.locator(".hab-chips").innerText().catch(() => "")).includes("Leer 20 minutos"), "y no se repite entre tus hábitos de siempre");

  // 2) Bruno ve la invitación y se une
  await entrar("bruno@cj.cl");
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 1, "a Bruno le aparece el punto en Amigos");
  await ir("amigos");
  const inv = await p.locator(".at-fila", { hasText: "Leer 20 minutos" }).innerText();
  ok(inv.includes("Ana te invita a un hábito"), "y la invitación de Ana, en «Para responder»");
  await shot(p, "conjunto-invitacion");
  await p.click('[data-action="cj-unirme"]'); await p.waitForTimeout(900);
  const hB = await p.evaluate(() => STATE.habitos.defs.find(h => h.conjunto));
  ok(hB && hB.nombre === "Leer 20 minutos" && hB.icon === "📖" && hB.creado === "2026-11-04", "al unirse, el hábito queda en sus hábitos desde hoy");
  ok(await p.locator(".at-fila", { hasText: "Leer 20 minutos" }).count() === 0 && (await hojaAmigos(p, "habitos")).includes("Leer 20 minutos"), "la invitación se va y el hábito aparece en la baldosa Hábitos");

  // 3) Bruno lo marca en Inicio; Ana ve que ya lo hizo
  await ir("inicio");
  await p.click('.cj-inicio [data-action="quick-habit"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => { const db = JSON.parse(localStorage.getItem("rumbo_amigos")); return db.cmarcas.length === 1; }), "la marca de Bruno llega a lo compartido");
  await entrar("ana@cj.cl"); await ir("inicio");
  const filaA2 = await p.locator(".cj-inicio").innerText();
  ok(filaA2.includes("con Bruno") && filaA2.includes("Bruno ya lo hizo hoy · te toca"), "Ana ve que Bruno ya lo hizo: le toca");
  await shot(p, "conjunto-inicio-te-toca");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('.cj-inicio [data-action="quick-habit"]'); await p.waitForTimeout(900);
  const filaA3 = await p.locator(".cj-inicio").innerText();
  ok(filaA3.includes("Hoy lo hicieron todos") && filaA3.includes("1 día de racha de a dos"), "al marcar Ana: lo hicieron los dos y empieza la racha de a dos");
  ok(await p.evaluate(() => STATE.gamif.ledger.some(m => m.id.startsWith("conjunto:") && m.delta === 5 && !m.anulado)) && await p.evaluate(() => STATE.gamif.puntos) - antes === 10, "Ana gana +5 ⭐ por cumplir juntos (además de los 5 del hábito)");
  await entrar("bruno@cj.cl");
  ok(await p.evaluate(() => STATE.gamif.ledger.some(m => m.id.startsWith("conjunto:") && m.delta === 5 && !m.anulado)), "y Bruno también, al entrar");

  // 4) Ana desmarca: el +5 se anula; vuelve a marcar
  await entrar("ana@cj.cl"); await ir("inicio");
  await p.click('.cj-inicio [data-action="quick-habit"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => !STATE.gamif.ledger.some(m => m.id.startsWith("conjunto:") && !m.anulado)), "si Ana desmarca, el +5 se anula");
  await p.click('.cj-inicio [data-action="quick-habit"]'); await p.waitForTimeout(700);

  // 5) La racha de a dos con días anteriores (como si lo hubieran creado hace 3 días)
  await p.evaluate(({ idB }) => {
    const db = JSON.parse(localStorage.getItem("rumbo_amigos"));
    db.conjuntos[0].creado = "2026-11-01"; db.cmiembros.forEach(m => { m.desde = "2026-11-01"; });
    ["2026-11-01", "2026-11-02", "2026-11-03"].forEach(fecha => db.cmarcas.push({ habito: db.conjuntos[0].id, user_id: idB, fecha }));
    localStorage.setItem("rumbo_amigos", JSON.stringify(db));
  }, { idB });
  await p.evaluate(async () => { const h = STATE.habitos.defs.find(x => x.conjunto); for (const d of [1, 2, 3]) toggleHabitDate(h.id, 2026, 10, d); await conjuntoCargar(true); });
  await p.waitForTimeout(800);
  ok((await p.locator(".cj-inicio").innerText()).includes("4 días de racha de a dos"), "cuatro días seguidos de los dos: 4 días de racha de a dos");
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo_amigos")).cmarcas.length) === 8, "las marcas de Ana de esos días también se suben");
  await shot(p, "conjunto-inicio");
  await ir("habitos");
  ok((await p.locator(".hb-today .hb-today__cj").innerText()).includes("con Bruno · 4 días de racha de a dos"), "en Hábitos › Hoy, la tarjeta dice con quién y la racha");

  // 6) El perfil de Bruno: lo que hacen juntos
  await ir("amigos"); await hojaAmigos(p, "amigos");
  await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  const perfil = await p.locator("#modal").innerText();
  ok(/lo que hacen juntos/i.test(perfil) && perfil.includes("Leer 20 minutos") && perfil.includes("Proponer un hábito"), "en el perfil de Bruno: lo que hacen juntos y proponer otro");
  await p.click('#modal [data-action="cj-nuevo"]'); await p.waitForTimeout(300);
  ok(await p.locator("#cj-amigos input:checked").count() === 1, "proponer un hábito abre el formulario con Bruno ya elegido");
  await p.evaluate(() => closeModal());

  // 7) Bruno lo edita: cambia para los dos
  await entrar("bruno@cj.cl"); await ir("habitos");
  await p.click('.hb-today:has(.hb-today__cj) [data-action="habit-edit"]'); await p.waitForTimeout(300);
  const mod = await p.locator("#modal").innerText();
  ok(mod.includes("Salir del hábito en conjunto") && !(await p.locator("#h-pausado").count()), "editar un hábito en conjunto: se puede salir, pero no pausarlo");
  await p.fill("#h-nombre", "Leer 30 minutos"); await p.click('[data-action="habit-save"]'); await p.waitForTimeout(800);
  await entrar("ana@cj.cl");
  ok(await p.evaluate(() => STATE.habitos.defs.find(h => h.conjunto).nombre) === "Leer 30 minutos", "Ana ve el nombre nuevo en su hábito");

  // 8) Bruno sale: el hábito se queda con él, con su historial
  await entrar("bruno@cj.cl"); await ir("habitos");
  await p.click('.hb-today:has(.hb-today__cj) [data-action="habit-edit"]'); await p.waitForTimeout(300);
  await p.click('[data-action="cj-salir"]'); await p.waitForTimeout(900);
  const hB2 = await p.evaluate(() => STATE.habitos.defs.find(h => h.nombre === "Leer 30 minutos"));
  ok(hB2 && !hB2.conjunto && await p.evaluate(id => hmDone(STATE.habitos.defs.find(h => h.id === id), "2026-11-04"), hB2.id), "al salir, Bruno conserva el hábito y lo que marcó");
  await entrar("ana@cj.cl"); await ir("inicio");
  ok(!(await p.locator(".cj-inicio").innerText()).includes("Bruno"), "Ana sigue con el hábito, ya sin Bruno");

  // 9) Ana lo elimina: sale y se borra (sin nadie, se borra también lo compartido)
  await ir("habitos");
  await p.click('.hb-today:has(.hb-today__cj) [data-action="habit-edit"]'); await p.waitForTimeout(300);
  await p.click('[data-action="habit-del"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !STATE.habitos.defs.some(h => h.nombre.startsWith("Leer")) && JSON.parse(localStorage.getItem("rumbo_amigos")).conjuntos.length === 0), "eliminarlo te saca y, si no queda nadie, se borra");

  // 10) Mientras no se corra supabase/conjunto.sql
  await p.evaluate(() => { BACKEND.conjuntoLista = async () => ({ error: "sin-servidor" }); Object.assign(CONJ, { lista: null, error: null, t: 0 }); });
  await p.evaluate(() => conjuntoCargar(true)); await ir("amigos");
  ok(await p.locator('.at-tile[data-v="habitos"]').count() === 0 && await p.locator('.at-tile[data-v="planes"]').count() === 1, "sin la base de hábitos en conjunto, Amigos no muestra su baldosa");
  await p.evaluate(() => openHabitModal()); await p.waitForTimeout(200);
  ok(!(await p.locator("#modal").innerText()).includes("Con amigos"), "y el formulario de hábito no ofrece hacerlo con amigos");
  await ctx.close();
};
