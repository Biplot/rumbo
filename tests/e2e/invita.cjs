/* Pruebas en navegador · 🎁 Invita y gana (invita.js): Bruno llega con el enlace de Ana, le manda su solicitud y queda
   como su invitado; Ana acepta; cuando Bruno cierra su primer día se activa: +100 ⭐ para cada uno (una vez). Al tercer
   amigo, el pañuelo de la manada para el elefante de Ana. Una cuenta antigua no cuenta como invitada. */
const { URL, nuevoContexto, registrar, shot, hojaAmigos } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T19:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", d => d.accept());
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir(); await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(1200);
    await p.evaluate(() => closeModal());
  };
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(900); };
  const vigente = id => p.evaluate(id => ledgerVigente(STATE, id), id);
  const invs = () => p.evaluate(() => JSON.parse(localStorage.getItem("rumbo_amigos")).invitaciones || []);
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);

  // 1) Ana: sin amigos todavía, «Invita a un amigo» trae «Invita y gana»
  await registrar(p, "ana@inv.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(600);
  const codA = (await p.locator(".am-cod").first().innerText()).trim(), idA = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  let t = await p.locator(".am-invita").first().innerText();
  ok(/Invita y gana/.test(t) && /\+100 .{0,3}para ti y \+100 .{0,3}para él/.test(t) && /0 de 3/.test(t) && /pañuelo de la manada/.test(t), "Ana ve «Invita y gana»: +100 ⭐ para cada uno y, al tercero, el pañuelo (0 de 3)");
  ok(await p.locator(".am-invita .inv__pan svg").count() === 1, "con el dibujo del pañuelo");
  await shot(p, "invita-ana");

  // 2) Bruno llega con el enlace de Ana (cuenta nueva) y le manda su solicitud
  await salir(); await p.goto(URL + "?amigo=" + codA); await p.waitForTimeout(400);
  await registrar(p, "bruno@inv.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(() => amigosAlEntrar()); await p.waitForTimeout(1300);
  ok(/Mandar solicitud/.test(await p.locator("#modal").innerText()), "al entrar con el enlace, Rumbo le ofrece agregar a Ana");
  await p.click('[data-action="am-pedir"]'); await p.waitForTimeout(1200);
  let i = await invs();
  ok(i.length === 1 && i[0].invitado === idB && i[0].invita === idA && !i[0].activa, "Bruno queda como invitado de Ana (todavía sin activar)");
  await ir("amigos"); await p.waitForTimeout(300);
  ok(/Llegaste con Ana/.test(await p.locator(".am-invita").first().innerText()), "Bruno ve que llegó con Ana y qué le falta");

  // 3) Ana ve a Bruno y acepta desde «Invita y gana»
  await entrar("ana@inv.cl"); await ir("amigos"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(800);
  t = await p.locator(".am-invita").first().innerText();
  ok(/Bruno/.test(t) && /acéptala/.test(t), "Ana ve a Bruno: «Te mandó su solicitud: acéptala para que cuente»");
  await p.click('.inv [data-action="am-aceptar"]'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => (AMIGOS.lista.amigos || []).length) === 1, "ya son amigos");
  ok(await p.locator('.at-tile[data-v="invita"]').count() === 1 && /0\/3/.test(await p.locator('.at-tile[data-v="invita"]').innerText()), "con amigos, la baldosa «Invita» en Juntos: 0/3");
  ok(!(await vigente("invita:" + idB)), "Bruno todavía no cerró su primer día: sin ⭐");

  // 4) Bruno cierra su primer día: se activa y gana +100 ⭐
  await entrar("bruno@inv.cl"); await p.waitForTimeout(600);
  const ptsB = await p.evaluate(() => STATE.gamif.puntos);
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = Object.assign({}, STATE.ritual.dias[todayISO()], { hecho: true, cerrado: true, ts: Date.now() }); saveState(); });
  await p.waitForTimeout(2500);
  i = await invs();
  ok(i[0].activa > 0, "al cerrar su primer día, la invitación se activa");
  ok(await vigente("invitado:" + idA) && await p.evaluate(() => STATE.gamif.puntos) === ptsB + 100, "Bruno gana +100 ⭐ por llegar con Ana");
  await p.evaluate(() => invitaCargar(true)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.gamif.puntos) === ptsB + 100, "una sola vez");

  // 5) Ana recibe sus +100 ⭐ al entrar
  await entrar("ana@inv.cl"); const ptsA0 = await p.evaluate(() => STATE.gamif.puntos);
  await ir("amigos"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(1200);
  ok(await vigente("invita:" + idB), "Ana gana +100 ⭐ porque Bruno cerró su primer día");
  ok(/1\/3/.test(await p.locator('.at-tile[data-v="invita"]').innerText()), "la baldosa: 1/3");
  t = await hojaAmigos(p, "invita");
  ok(/Cerró su primer día/.test(t) && /1 de 3/.test(t), "su hoja: Bruno cerró su primer día, 1 de 3");
  await shot(p, "invita-hoja");
  ok(await ancho() <= 390, "todo cabe en el celular");

  // 6) Dos amigos más: el pañuelo de la manada
  const ptsA1 = await p.evaluate(() => STATE.gamif.puntos);
  await p.evaluate(({ idA }) => {
    const db = JSON.parse(localStorage.getItem("rumbo_amigos"));
    [["u_cami01", "Cami"], ["u_dani01", "Dani"]].forEach(([id, nombre], k) => {
      db.perfiles[id] = { user_id: id, nombre, codigo: "ZZZZZ" + k };
      db.amistades.push({ a: id, b: idA, estado: "aceptada", pide: id, creada: new Date().toISOString() });
      db.invitaciones.push({ invitado: id, invita: idA, creada: Date.now(), activa: Date.now() + k + 1, avisado: false });
    });
    localStorage.setItem("rumbo_amigos", JSON.stringify(db));
  }, { idA });
  await p.evaluate(() => { closeModal(); invitaCargar(true); }); await p.waitForTimeout(1200);
  ok(await vigente("hito:invita:panuelo") && /El pañuelo de la manada/.test(await p.locator("#modalTitle").innerText()), "al tercero: «El pañuelo de la manada»");
  ok(await p.evaluate(() => STATE.gamif.puntos) === ptsA1 + 200 && ptsA1 >= ptsA0, "y +100 ⭐ por cada uno");
  await shot(p, "invita-panuelo");
  await p.click('#modal [data-action="inv-poner"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => ropaPuesta().cuello) === "panuelo" && await p.evaluate(() => elefanteSVG({ anim: false }).includes("M163 135")), "«Ponérselo»: tu elefante lo lleva al cuello");
  await p.evaluate(() => openElefante("ropa")); await p.waitForTimeout(300);
  await p.evaluate(() => espacioElefante("cuello")); await p.waitForTimeout(300);
  ok(/Pañuelo de la manada/.test(await p.locator("#modal").innerText()), "en el vestidor, en el cuello");
  await p.evaluate(() => closeModal());
  ok(/✓|3/.test(await p.locator('.at-tile[data-v="invita"]').innerText()) && /por cada amigo/.test(await p.locator('.at-tile[data-v="invita"]').innerText()), "la baldosa ya no cuenta hacia el pañuelo: sigue sumando ⭐ por amigo");

  // 7) Una cuenta antigua no cuenta como invitada
  await salir(); await registrar(p, "eli@inv.cl");
  const idE = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(id => { const u = JSON.parse(localStorage.getItem("rumbo_users")); u[id].creada = Date.now() - 30 * 864e5; localStorage.setItem("rumbo_users", JSON.stringify(u)); }, idE);
  await p.evaluate(c => amigosAgregar(c), codA); await p.waitForTimeout(800);
  await p.click('[data-action="am-pedir"]'); await p.waitForTimeout(1200);
  ok(!(await invs()).some(x => x.invitado === idE), "Eli tiene su cuenta hace 30 días: no queda como invitada");
  await ctx.close();
};
