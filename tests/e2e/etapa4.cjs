/* Pruebas en navegador · Etapa 4 de los planes con amigos: «¿Quién se suma?» (Ana abre un plan a todos sus amigos y
   Bruno se suma), el cumpleaños de Ana (lo comparte y Bruno la saluda) y leer el mismo libro (cada uno su página).
   Las cuentas locales comparten la "base" de amigos (LocalBackend). */
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
  const modal = () => p.locator("#modal").innerText();

  // 0) Ana y Bruno son amigos; Ana tiene fecha de nacimiento (hoy es su cumpleaños) y un libro que está leyendo
  await registrar(p, "ana@e4.cl");
  await p.evaluate(() => {
    STATE.profile.name = "Ana"; STATE.profile.birthDate = "1990-11-04";
    STATE.lecturas.push({ id: "libro1", titulo: "Cien años de soledad", autor: "García Márquez", estado: "leyendo", valoracion: 0, pagina: 50, paginas: 471, nota: "", color: "#17C3B2", portada: "", inicio: "2026-11-01", fin: "" });
    saveState();
  });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  await salir(); await registrar(p, "bruno@e4.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@e4.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);

  // 1) «¿Quién se suma?»: Ana abre un plan a todos sus amigos
  await ir("amigos"); await hojaAmigos(p, "planes"); await p.click('#modal [data-action="pl-nuevo"]'); await p.waitForTimeout(300);
  await p.click('label.pl-chip:has(input[name="pl-tipo"][value="deporte"])');
  await p.fill("#pl-titulo", "Salir a correr"); await p.check("#pl-abierto"); await p.waitForTimeout(100);
  ok(await p.locator("#pl-con-quien").isHidden() && await p.locator("#pl-cuando-seg").isHidden() && (await p.locator('[data-action="pl-guardar"]').innerText()).includes("Avisar a mis amigos"),
    "«¿Quién se suma?»: sin elegir amigos ni votar, y el botón dice «Avisar a mis amigos»");
  await p.fill("#pl-fecha", "2026-11-06"); await p.fill("#pl-hora", "19:00"); await p.fill("#pl-lugar", "Parque Bicentenario");
  await p.click('[data-action="pl-guardar"]'); await p.waitForTimeout(900);
  const prox = await hojaAmigos(p, "planes", "proximos");
  ok(prox.includes("Salir a correr") && prox.includes("Abierto"), "queda en sus Próximos, marcado «Abierto»");
  await p.evaluate(() => closeModal());

  // 2) Ana comparte su cumpleaños
  await hojaAmigos(p, "ajustes"); await p.click('[data-action="am-muestra"][data-k="cumple"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => { const db = JSON.parse(localStorage.getItem("rumbo_amigos")); return Object.values(db.perfiles).find(x => x.nombre === "Ana").estado.cumple; }) === "11-04",
    "al encender «Tu cumpleaños», se publica solo el día y el mes (11-04)");

  // 3) Ana invita a Bruno a leer «Cien años de soledad»
  await ir("lecturas"); await p.click('.lect-card:has-text("Cien años de soledad")'); await p.waitForTimeout(300);
  await p.click('#modal [data-action="lj-nueva"]'); await p.waitForTimeout(300);
  await p.click('#lj-amigos label:has-text("Bruno")'); await p.click('[data-action="lj-guardar"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!STATE.lecturas.find(l => l.id === "libro1").juntos), "Ana invita a Bruno a leer «Cien años de soledad» contigo (el libro queda unido)");

  // 4) Bruno: se suma al plan abierto
  await entrar("bruno@e4.cl"); await ir("amigos");
  const semana = await p.locator(".at-semana").innerText();
  ok(semana.includes("Salir a correr") && semana.includes("Ana pregunta: ¿te sumas?"), "en «Esta semana», el plan abierto de Ana: «¿te sumas?»");
  ok(await p.locator(".at-fila", { hasText: "Salir a correr" }).count() === 0, "no está en «Para responder»: nadie espera su respuesta");
  const t1 = await hojaAmigos(p, "planes");
  ok(/¿quién se suma\?/i.test(t1) && t1.includes("Salir a correr"), "en Planes, «¿Quién se suma?» con el plan de Ana, sin estar invitado");
  await shot(p, "etapa4-amigos");
  await p.click('#modal [data-action="pl-sumarme"]'); await p.waitForTimeout(900);
  const t2 = await hojaAmigos(p, "planes");
  ok(t2.includes("Salir a correr") && !/¿quién se suma\?/i.test(t2) && (await p.locator(".at-semana").innerText()).includes("con Ana"), "«Me sumo»: pasa a sus Próximos (y en la semana, «con Ana»)");
  await ir("semana");
  ok((await p.locator(".pl-ev").allInnerTexts()).some(t => t.includes("Salir a correr")), "y está en su Semana");

  // 5) Bruno: el cumpleaños de Ana
  await ir("amigos");
  ok((await p.locator(".at-semana").innerText()).includes("Está de cumpleaños: saluda") && (await p.locator('.at-tile[data-v="amigos"]').innerText()).includes("Hoy cumple Ana"),
    "en Amigos: el cumpleaños de Ana en «Esta semana» y en la baldosa Amigos");
  await hojaAmigos(p, "amigos");
  ok((await p.locator(".am-fila").first().innerText()).includes("¡Hoy está de cumpleaños!"), "y en su hoja, «¡Hoy está de cumpleaños!» junto a Ana");
  await ir("inicio");
  ok((await p.locator(".am-cumples").innerText().catch(() => "")).includes("Hoy está de cumpleaños Ana"), "en Inicio: «Hoy está de cumpleaños Ana»");
  await p.click('.am-cumples [data-action="am-animo"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("¡Feliz cumpleaños!") && await p.locator(".am-frase.chip--cian").innerText() === "¡Feliz cumpleaños!", "«Saludar» abre el ánimo con «¡Feliz cumpleaños!» elegido");
  await p.click('[data-action="am-animo-enviar"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo_amigos")).animos.some(a => a.mensaje === "¡Feliz cumpleaños!")), "y le llega a Ana");
  await ir("calendario"); await p.click('[data-action="cal-dia"][data-date="2026-11-04"]'); await p.waitForTimeout(400);
  ok((await vista()).includes("Cumpleaños de Ana"), "en el Calendario: «Cumpleaños de Ana»");

  // 6) Bruno: se suma a leer y lo termina
  await ir("lecturas");
  ok((await vista()).includes("Te invitan a leer") && (await vista()).includes("Cien años de soledad"), "en Lecturas: «Te invitan a leer»");
  await p.click('[data-action="lj-unirme"]'); await p.waitForTimeout(900);
  const leyendo = await p.locator(".lect-now").innerText().catch(() => "");
  ok(leyendo.includes("Cien años de soledad") && leyendo.includes("Ana") && leyendo.includes("pág. 50 · 11 %"), "el libro queda en sus Lecturas, con Ana en la pág. 50 (11 %)");
  await shot(p, "etapa4-lecturas");
  const pag = p.locator(".lect-now .lect-page"); await pag.fill("471"); await pag.dispatchEvent("change"); await p.waitForTimeout(800);
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo_amigos")).ljmiembros.some(m => m.terminado && m.pagina === 471)), "Bruno llega a la página 471: lo terminó");
  await entrar("ana@e4.cl"); await ir("lecturas"); await p.waitForTimeout(500);
  ok((await p.locator(".lect-now").innerText().catch(() => "")).includes("¡Lo terminó!"), "Ana ve que Bruno lo terminó");
  await ctx.close();
};
