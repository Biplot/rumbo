/* Pruebas en navegador · 💧 Agua con otros (agua-juntos.js): el bidón con amigos (comprarlo en la Tienda, armarlo,
   unirse desde Amigos, los litros de cada uno, ¡Salud! y las ⭐ al terminar la semana), la fuente de Rumbo (solo
   totales, se apaga) y los vasos del aviso («+ Un vaso») que se suman al abrir la app sin repetirse.
   Las cuentas locales comparten la "base" de amigos (LocalBackend), con las reglas de supabase/agua.sql. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T16:20:00", w: 390, h: 844 });   // miércoles
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
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const modal = () => p.locator("#modal").innerText();
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  const abrirAgua = async () => { await p.evaluate(() => openAgua()); await p.waitForTimeout(900); };
  const pintado = sel => p.evaluate(s => {   // ¿el lienzo tiene algo dibujado?
    const cv = document.querySelector(s); if (!cv || !cv.width) return false;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 0) n++;
    return n > 20;
  }, sel);

  // 0) Ana y Bruno son amigos; Ana tiene ⭐ para comprar el bidón
  await registrar(p, "ana@agua.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim(); const idA = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await salir(); await registrar(p, "bruno@agua.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@agua.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);
  await p.evaluate(() => { registrarMovimiento("prueba-agua", 1000, 0, "Prueba", true); STATE.agua.meta = 2000; saveState(); });

  // 1) En «Tu agua»: el bidón y la fuente
  await abrirAgua();
  let t = await modal();
  ok(/Con amigos · El bidón de la semana/i.test(t) && /Armar un bidón · 300/.test(t), "«Tu agua» ofrece armar un bidón con amigos (300 ⭐ en la Tienda)");
  ok(/La fuente de Rumbo/i.test(t) && /nadie ve cuánto tomaste/.test(t) && await p.locator('canvas[data-agua="fuente"]').count() === 1, "y la fuente de Rumbo, con su dibujo (solo totales)");
  ok(await ancho() <= 390, "«Tu agua» con el bidón y la fuente cabe en el celular");

  // 2) Sin el bidón, «Armar» lleva a la Tienda; al comprarlo, se abre para armarlo
  await p.click('[data-action="agua-bd-nuevo"]'); await p.waitForTimeout(500);
  t = await modal();
  ok(/El bidón con amigos/.test(t) && /Sumarse al de un amigo es gratis/.test(t) && await p.locator('#modal [data-action="cos-buy"]').count() === 1, "sin el bidón, «Armar» abre su ficha en la Tienda (sumarse es gratis)");
  ok(await p.locator('#modal canvas[data-agua="bidon"][data-modo="muestra"]').count() === 1, "con la muestra del bidón");
  await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => isOwned("agua-bidon")), "Ana compra el bidón (300 ⭐)");
  t = await modal();
  ok(/Un bidón con amigos/.test(t) && /Con quién/.test(t), "al comprarlo se abre «Un bidón con amigos» para armarlo");
  await p.check("#bd-amigos input"); await p.waitForTimeout(200);
  ok(/^20/.test((await p.locator('#modal [data-el-id="bd-meta"] output').innerText()).trim()) && /Para 2 personas, 20 L/.test(await modal()), "la meta se ajusta a cuántos son: 20 L para 2 (1,5 L al día cada uno)");
  await p.click('[data-action="agua-bd-crear"]'); await p.waitForTimeout(1200);
  const bidon = await p.evaluate(() => (BIDON.lista || [])[0]);
  ok(bidon && bidon.nombre === "El bidón de la semana" && bidon.meta === 20000 && bidon.lunes === "2026-11-02", "queda armado: «El bidón de la semana», 20 L, de esta semana (lunes 2)");

  // 3) El agua de Ana sube al bidón
  await p.evaluate(() => { aguaSumar(500); aguaSumar(500); }); await p.waitForTimeout(3600);
  await abrirAgua();
  t = await p.locator("#agua-bidon").innerText();
  ok(/1 de 20 L/.test(t.replace(/\s+/g, " ")) && /Tú\s*1 L/.test(t), "en «Tu agua»: 1 de 20 L, y Ana (Tú) con su litro");
  ok(await pintado('#agua-bidon canvas[data-agua="bidon"]'), "el bidón se dibuja");
  ok(await p.evaluate(id => JSON.parse(localStorage.getItem("rumbo_amigos")).baportes.filter(a => a.user_id === id).reduce((s, a) => s + a.ml, 0), idA) === 1000, "lo de Ana quedó en la base (solo los litros del día)");
  await shot(p, "agua-bidon-ana");

  // 4) Bruno lo ve en Amigos (Para responder) y se une; su agua suma
  await entrar("bruno@agua.cl");
  await ir("amigos"); await p.evaluate(() => bidonesCargar(true)); await p.waitForTimeout(500); await ir("amigos");
  ok(/El bidón de la semana/.test(await p.locator(".at-bandeja").innerText()) && /te invita al bidón de la semana · 20 L/.test(await p.locator(".at-bandeja").innerText()), "Bruno: la invitación al bidón está en «Para responder»");
  await p.click('.at-bandeja [data-action="agua-bd-unirme"]'); await p.waitForTimeout(1000);
  ok(await p.evaluate(() => BIDON.lista[0].estado) === "activo", "Bruno se une desde ahí mismo");
  await p.evaluate(() => { STATE.agua.meta = 2500; aguaSumar(1500); }); await p.waitForTimeout(3600);
  await ir("amigos");
  ok(/Agua/.test(await p.locator(".at-tiles").innerText()) && /12 %/.test(await p.locator(".at-tiles").innerText()), "en Amigos › Juntos, la baldosa del agua dice cuánto llevan (2,5 de 20 L: 12 %)");
  await p.click('[data-action="am-hoja"][data-v="bidon"]'); await p.waitForTimeout(500);
  t = (await modal()).replace(/\s+/g, " ");
  ok(/2,5 de 20 L/.test(t) && /Tú 1,5 L/.test(t) && /Ana 1 L/.test(t), "la hoja del bidón: 2,5 de 20 L, cada uno con sus litros");
  ok(/Faltan 17,5 L · quedan 4 días/.test(t), "faltan 17,5 L y quedan 4 días (hasta el domingo)");

  // 5) ¡Salud!: un brindis al grupo
  await p.click('#modal [data-action="agua-bd-salud"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(id => JSON.parse(localStorage.getItem("rumbo_amigos")).animos.some(a => a.para === id && /¡Salud! Vamos en 2,5 de 20 L/.test(a.mensaje)), idA), "«¡Salud!» le manda un brindis a Ana (un ánimo: «Vamos en 2,5 de 20 L»)");

  // 6) La fuente: los vasos de todos, solo el total
  await abrirAgua();
  t = (await p.locator("#agua-fuente").innerText()).replace(/\s+/g, " ");
  ok(/10 vasos hoy en Rumbo/.test(t) && /2 personas/.test(t) && /la meta: 16 vasos/.test(t) && /Tu parte: 6 vasos/.test(t), "la fuente: 10 vasos hoy entre 2 personas (meta 16) y tu parte");
  ok(await pintado('#agua-fuente canvas[data-agua="fuente"]'), "la fuente se dibuja");
  await shot(p, "agua-fuente");
  await p.click('#agua-fuente [data-action="agua-fu-on"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => STATE.agua.fuente) === false && /4 vasos hoy en Rumbo/.test(await p.locator("#agua-fuente-info").innerText()), "apagar «Sumar mis vasos» saca lo tuyo de la fuente");

  // 7) Los vasos del aviso: del teléfono y del servidor, una sola vez
  const antes = await p.evaluate(() => aguaHoy());
  await p.evaluate(async ([id]) => {
    localStorage.setItem("rumbo_agua_pend_" + id, JSON.stringify([{ id: "nservidor1", fecha: todayISO(), ml: 300, ts: Date.now() }, { id: "ntelefono1", fecha: todayISO(), ml: 250, ts: Date.now() }]));
    const c = await caches.open("rumbo-ajustes"); await c.put("/__agua-pend", new Response(JSON.stringify([{ id: "ntelefono1", fecha: todayISO(), ml: 250, ts: Date.now() }]), { headers: { "Content-Type": "application/json" } }));
    await aguaPendientes();
  }, [idB]);
  ok(await p.evaluate(() => aguaHoy()) - antes === 550, "al abrir la app se suman los vasos del aviso (300 + 250 ml), sin repetir el que estaba en los dos lados");
  ok(await p.evaluate(async () => !(await (await caches.open("rumbo-ajustes")).match("/__agua-pend"))), "y se quitan del teléfono");
  await p.evaluate(() => aguaPendientes());
  ok(await p.evaluate(() => aguaHoy()) - antes === 550, "volver a abrir no los suma de nuevo");

  // 8) El aviso en iPhone (sin botones): tocarlo lleva a «Agua de hoy» en Inicio (o abre la portilla en otra pantalla)
  await p.goto(URL + "?atajo=agua#inicio"); await p.waitForTimeout(900);
  ok(await p.locator("[data-agua-card].is-llamada").count() === 1 && !(await p.evaluate(() => location.search)), "desde el aviso del agua (?atajo=agua) Rumbo abre en «Agua de hoy», marcada");
  await p.evaluate(() => { STATE.agua.fab = true; saveState(); });
  await p.goto(URL + "?atajo=agua#habitos"); await p.waitForTimeout(1600);
  ok(await p.evaluate(() => AGUA_FAB.abierta), "en otra pantalla, abre la portilla");
  await p.evaluate(() => { aguaFabCerrar(); STATE.agua.fab = false; saveState(); });

  // 9) Al terminar la semana: ⭐ según lo que aportaste (+20 si lo llenaron)
  await p.evaluate(([idA, idB]) => {
    const db = JSON.parse(localStorage.getItem("rumbo_amigos")), x = db.bidones[0];
    x.lunes = "2026-10-26"; x.lleno = "2026-10-31";
    db.baportes = [{ bidon: x.id, user_id: idB, fecha: "2026-10-28", ml: 9500 }, { bidon: x.id, user_id: idA, fecha: "2026-10-29", ml: 12000 }];
    localStorage.setItem("rumbo_amigos", JSON.stringify(db));
  }, [idA, idB]);
  await p.evaluate(() => bidonesCargar(true)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const m = STATE.gamif.ledger.find(x => x.id.startsWith("bidon:")); return m && m.delta === 29; }), "terminó la semana: Bruno aportó 9,5 L y lo llenaron → +29 ⭐ (9 + 20)");
  await p.evaluate(() => bidonesCargar(true)); await p.waitForTimeout(400);
  ok(await p.evaluate(() => STATE.gamif.ledger.filter(x => x.id.startsWith("bidon:")).length) === 1, "una sola vez");
  await abrirAgua();
  t = (await p.locator("#agua-bidon").innerText()).replace(/\s+/g, " ");
  ok(/¡Lo llenaron! 21,5 L entre todos/.test(t) && /aportaste 9,5 L · \+29/.test(t) && /Armar un bidón · 300/.test(t) && /Llenen un bidón entre amigos/.test(t), "en «Tu agua» queda el de la semana pasada (con tus ⭐) y la invitación a armar otro");
  ok(await ancho() <= 390, "todo cabe en el celular");
  await ctx.close();
};
