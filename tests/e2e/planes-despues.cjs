/* Pruebas en navegador · Después del plan: la cuenta de un asado (quién pagó, quién debe, «Ya le pagué» y tu parte
   en Finanzas) y, al día siguiente, «¿Cómo estuvo?» desde Inicio: al diario, +10 ⭐ y lo ven los que fueron.
   Las cuentas locales comparten la "base" de amigos (LocalBackend), con las reglas de supabase/planes.sql. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-06T10:00:00", w: 1280, h: 900 });
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
  const ir = async r => { await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const modal = () => p.locator("#modal").innerText();
  const abrirPlan = async () => { await ir("amigos"); await p.click('.pl-card .pl-fila:has-text("Asado")'); await p.waitForTimeout(300); };

  // 0) Ana, Bruno y Cami son amigos; Ana propone un asado hoy a las 13:00 y los dos van
  await registrar(p, "ana@pd.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  const ids = {};
  for (const [email, nombre] of [["bruno@pd.cl", "Bruno"], ["cami@pd.cl", "Cami"]]) {
    await salir(); await registrar(p, email); await p.evaluate(n => { STATE.profile.name = n; saveState(); }, nombre);
    await ir("amigos"); ids[nombre] = await p.evaluate(() => localStorage.getItem("rumbo_session"));
    await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  }
  await entrar("ana@pd.cl");
  for (const id of Object.values(ids)) await p.evaluate(x => BACKEND.amigosResponder(x, true), id);
  const plan = await p.evaluate(async ([b1, c1]) => (await BACKEND.planCrear({ titulo: "Asado", tipo: "comer", fecha: "2026-11-06", hora: "13:00", lugar: "Casa de Ana", enlace: "" }, [b1, c1], "2026-11-06")).id, [ids.Bruno, ids.Cami]);
  for (const id of Object.values(ids)) await p.evaluate(([x, pl]) => { const yo = localStorage.getItem("rumbo_session"); localStorage.setItem("rumbo_session", x); return BACKEND.planResponder(pl, "voy").then(() => localStorage.setItem("rumbo_session", yo)); }, [id, plan]);
  await p.evaluate(() => { PLAN.t = 0; amigosCargar(true); }); await p.waitForTimeout(500);

  // 1) Ana anota la carne: $18.000 entre los tres
  await abrirPlan();
  ok(/la cuenta/i.test(await modal()) && (await modal()).includes("Anotar un gasto") && !/cómo estuvo/i.test(await modal()), "el plan tiene «La cuenta» (y, antes de la hora, todavía no «Cómo estuvo»)");
  await p.click('#modal [data-action="pl-gasto"]'); await p.waitForTimeout(300);
  ok(await p.locator("#pl-g-para input:checked").count() === 3, "un gasto se divide, por defecto, entre los tres que van");
  await p.fill("#pl-g-monto", "18.000"); await p.fill("#pl-g-detalle", "la carne"); await p.click('[data-action="pl-gasto-ok"]'); await p.waitForTimeout(900);
  const c1 = await modal();
  ok(c1.includes("Pagaste la carne") && c1.includes("$18.000") && c1.includes("$6.000 c/u") && c1.includes("Bruno te debe $6.000") && c1.includes("Cami te debe $6.000"),
    "la cuenta: pagaste la carne ($18.000, $6.000 c/u); Bruno y Cami te deben $6.000");
  ok(c1.includes("Tu parte: $6.000 de $18.000"), "tu parte: $6.000 de $18.000");
  await p.click('#modal [data-action="pl-finanzas"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => STATE.finanzas.meses[10].gasto) === 6000 && (await modal()).includes("En Finanzas"), "«Sumar a Finanzas»: $6.000 al gasto de noviembre");
  await p.click('#modal [data-action="pl-finanzas"]').catch(() => {});
  ok(await p.evaluate(() => STATE.finanzas.meses[10].gasto) === 6000, "y no se suma dos veces");
  await shot(p, "despues-cuenta");
  await p.evaluate(() => closeModal());

  // 2) Bruno le paga a Ana
  await entrar("bruno@pd.cl"); await abrirPlan();
  ok((await modal()).includes("Le debes $6.000 a Ana") && (await modal()).includes("Ana pagó la carne"), "Bruno ve que le debe $6.000 a Ana");
  await p.click('#modal [data-action="pl-pague"]'); await p.waitForTimeout(900);
  ok((await modal()).includes("Le pagaste a Ana") && !(await modal()).includes("Le debes"), "«Ya le pagué»: queda anotado y ya no debe");
  await p.evaluate(() => closeModal());

  // 3) Al día siguiente, en Inicio: ¿cómo estuvo?
  await ctx.clock.setFixedTime(new Date("2026-11-07T11:00:00")); await ir("inicio"); await p.waitForTimeout(600);
  ok((await p.locator(".pl-despues").innerText().catch(() => "")).includes("¿Cómo estuvo «Asado»?"), "al día siguiente, Inicio pregunta «¿Cómo estuvo «Asado»?»");
  await shot(p, "despues-inicio");
  await p.click('.pl-despues [data-action="pl-como"][data-n="4"]'); await p.waitForTimeout(300);
  ok(await p.locator("#pl-como-est button.on").count() === 4 && (await modal()).includes("+10"), "tocando la cuarta estrella, se abre con 4 estrellas (y +10 ⭐)");
  await p.fill("#pl-como-frase", "Buenísimo, repetimos en diciembre"); await p.check("#pl-como-comp");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('[data-action="pl-como-ok"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => STATE.gamif.puntos) - antes === 10 && await p.evaluate(() => STATE.gamif.ledger.some(m => m.id.startsWith("plan-recuerdo:"))), "+10 ⭐");
  ok(await p.evaluate(() => STATE.vida.diario.some(e => e.fromPlan && e.fecha === "2026-11-06" && e.estrellas === 4 && e.texto.startsWith("Buenísimo"))), "y queda en su diario, el día del asado");
  ok(await p.locator(".pl-despues").count() === 0, "Inicio ya no pregunta");
  await ir("diario"); await p.click('[data-action="diario-dia"][data-iso="2026-11-06"] >> nth=-1'); await p.waitForTimeout(400);
  ok((await p.locator("#diario-lista").innerText()).includes("Asado") && (await p.locator("#diario-lista").innerText()).includes("Buenísimo"), "en el Diario, el 6 de noviembre: el asado y su frase");

  // 4) Ana ve lo que contó Bruno; Cami ve lo que debe
  await entrar("ana@pd.cl"); await abrirPlan();
  const c2 = await modal();
  ok(c2.includes("Bruno te pagó") && c2.includes("Cami te debe $6.000") && c2.includes("«Buenísimo, repetimos en diciembre»"), "Ana ve el pago de Bruno, lo que debe Cami y lo que contó Bruno");
  ok(c2.includes("¿Cómo estuvo? · +10"), "y puede contar lo suyo");
  await p.evaluate(() => closeModal());
  ok((await p.locator(".pl-card").innerText()).match(/ya pasaron/i) && (await p.locator(".pl-card").innerText()).includes("¿Cómo estuvo?"), "en Amigos › Planes, «Ya pasaron» con «¿Cómo estuvo?»");
  await entrar("cami@pd.cl"); await ir("inicio"); await p.waitForTimeout(500);
  const ci = await p.locator(".pl-despues").innerText().catch(() => "");
  ok(ci.includes("¿Cómo estuvo «Asado»?") && ci.includes("debes $6.000"), "a Cami, Inicio le pregunta cómo estuvo y le recuerda que debe $6.000");
  await ctx.close();
};
