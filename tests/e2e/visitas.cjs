/* Pruebas en navegador · Visitas: Bruno visita la casa y la vitrina de Ana (en 3D, de solo mirar), sin que
   se mezcle con lo suyo; Ana decide si se puede. Las cuentas locales comparten la "base" de amigos (LocalBackend). */
const { URL, nuevoContexto, registrar, shot, hojaAmigos } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T11:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir();
    await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    await p.evaluate(() => closeModal());
  };
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };   // sin hojas abiertas
  const perfilAna = async () => { await ir("amigos"); await hojaAmigos(p, "amigos"); await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300); return p.locator("#modal").innerText(); };

  // 0) Ana tiene su casa arreglada (un gato, la pared salvia) y dos medallas; Bruno es su amigo
  await registrar(p, "ana@vis.cl");
  await p.evaluate(() => {
    STATE.profile.name = "Ana";
    ledgerRegistrar(STATE, "insignia:primer-paso", 20, 20, "Insignia", new Date(2026, 9, 3, 21, 0).getTime());
    ledgerRegistrar(STATE, "prueba:regalo", 2000, 0, "Regalo");
    ledgerRegistrar(STATE, "compra:cua-gato", -900, 0, "Compra"); ledgerRegistrar(STATE, "compra:par-salvia", -200, 0, "Compra");
    STATE.gamif.equipped.cuarto = { off: [], pared: "par-salvia", ts: Date.now() };
    STATE.gamif.badges.push("primer-paso", "biblioteca-b"); saveState();
  });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  const pub = await p.evaluate(() => { const db = JSON.parse(localStorage.getItem("rumbo_amigos")); return Object.values(db.perfiles).find(x => x.nombre === "Ana"); });
  ok(pub.casa && pub.casa.cosas.includes("gato") && pub.casa.pared === "par-salvia" && pub.vitrina.medallas.length === 2 && pub.estado.casa && pub.estado.medallas === 2,
    "Ana publica la foto de su casa y sus medallas (para sus amigos)");
  await salir(); await registrar(p, "bruno@vis.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@vis.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB);

  // 1) Bruno ve los botones en el perfil de Ana
  await entrar("bruno@vis.cl");
  const visto0 = await p.evaluate(() => localStorage.getItem("rumbo-cielo-visto"));
  const perfil = await perfilAna();
  ok(perfil.includes("Visitar su casa") && perfil.includes("Ver su vitrina · 2"), "en el perfil de Ana: Visitar su casa y Ver su vitrina (con sus 2 medallas)");

  // 2) La casa de Ana
  await p.click('#modal [data-action="vis-casa"]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => CURRENT) === "visita-casa" && (await p.locator(".lugar__t b").innerText()) === "La casa de Ana", "Bruno entra a «La casa de Ana», a pantalla completa");
  const hoja = await p.locator("#lugarHoja").innerText();
  ok(/su repisa/i.test(hoja) && hoja.includes("Primer Paso") && hoja.includes("Un gato") && hoja.includes("Pared salvia") && !hoja.includes("Decorar"),
    "la hoja muestra su repisa y su cuarto, sin nada para cambiar");
  ok(await p.evaluate(() => CIELO_ESTADO.sin3d || (CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista().modo === "casa")), "el cuarto se ve en 3D (o como página, sin WebGL)");
  await shot(p, "visita-casa");
  await p.click('#lugarHoja [data-action="vis-medalla"] >> nth=0'); await p.waitForTimeout(300);
  const med = await p.locator("#modal").innerText();
  ok(/Ana la ganó/.test(med) && med.includes("Tú todavía no la tienes"), "una medalla de su repisa: cuándo la ganó Ana y si Bruno la tiene");
  await p.evaluate(() => closeModal());

  // 3) Su vitrina, y de vuelta a Amigos
  await p.click('#lugarHoja [data-action="vis-cielo"]'); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => CURRENT) === "visita-cielo" && (await p.locator(".lugar__t").innerText()).includes("2 de 57 medallas"), "«Su vitrina»: el cielo de Ana, con sus 2 de 57 medallas");
  await shot(p, "visita-vitrina");
  await p.click('[data-action="lugar-volver"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => CURRENT) === "amigos", "‹ vuelve a Amigos");

  // 4) Lo de Bruno no se mezcla con lo de Ana
  ok(await p.evaluate(() => STATE.gamif.badges.length === 0 && !STATE.gamif.owned.includes("cua-gato")), "Bruno sigue con sus cosas y sus medallas");
  ok(await p.evaluate(() => localStorage.getItem("rumbo-cielo-visto")) === visto0, "y su cielo no cuenta como vistas las medallas de Ana");
  await ir("cielo"); await p.waitForTimeout(1500);
  ok((await p.locator(".lugar__t, .lugar-plano").first().innerText()).includes("0 de 57"), "en su propia vitrina, Bruno ve las suyas (0 de 57)");

  // 5) Ana apaga «Tu casa»: ya no se puede visitar (la vitrina sí)
  await entrar("ana@vis.cl"); await ir("amigos"); await hojaAmigos(p, "ajustes");
  await p.click('[data-action="am-muestra"][data-k="casa"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => { const db = JSON.parse(localStorage.getItem("rumbo_amigos")); const a = Object.values(db.perfiles).find(x => x.nombre === "Ana"); return a.casa === null && !a.estado.casa && a.vitrina; }),
    "al apagar «Tu casa», la foto de su casa deja de publicarse");
  await entrar("bruno@vis.cl");
  const perfil2 = await perfilAna();
  ok(!perfil2.includes("Visitar su casa") && perfil2.includes("Ver su vitrina"), "y Bruno ya no ve «Visitar su casa»");
  await p.evaluate(() => closeModal());

  // 6) Sin visita abierta, la ruta lleva a Amigos; sin la base, lo dice
  await p.evaluate(() => { VISITA.id = null; }); await ir("visita-casa"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => CURRENT) === "amigos", "#visita-casa sin una visita abierta te lleva a Amigos");
  await p.evaluate(() => { BACKEND.amigosVisita = async () => ({ error: "sin-servidor" }); });
  await perfilAna(); await p.click('#modal [data-action="vis-cielo"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => CURRENT) === "amigos", "sin la base de visitas no se entra (y se avisa)");
  await ctx.close();
};
