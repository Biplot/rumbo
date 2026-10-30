/* Pruebas en navegador · Listas compartidas: Ana arma «Películas por ver» con Bruno; los dos agregan, Bruno le da +1
   y marca una como vista con estrellas, y de la lista sale un plan. Las cuentas locales comparten la "base" de amigos
   (LocalBackend), con las reglas de supabase/listas.sql. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
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
  const ir = async r => { await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const vista = () => p.locator("#view").innerText();
  const modal = () => p.locator("#modal").innerText();
  const tarjeta = () => p.locator(".lc").first().innerText();
  const filas = () => p.locator(".lc .lc-item:not(.is-visto) .lc-item__t b").allInnerTexts();
  const agregar = async txt => { const i = p.locator(".lc .lc-add input"); await i.fill(txt); await i.press("Enter"); await p.waitForTimeout(700); };
  const fila = txt => p.locator(`.lc .lc-item:has(.lc-item__t b:text-is("${txt}"))`);

  // 0) Ana y Bruno son amigos; Ana tiene una lista personal
  await registrar(p, "ana@lc.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; STATE.vida.listas.push({ id: "x1", nombre: "Compras", tipo: "normal", icon: "🛒", items: [] }); saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  await salir(); await registrar(p, "bruno@lc.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@lc.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);

  // 1) Ana crea «Películas por ver» con Bruno, en Listas
  await ir("listas");
  ok((await vista()).includes("Con amigos") && (await vista()).includes("Tus listas") && (await vista()).includes("Compras"), "Listas tiene una sección Con amigos, arriba de tus listas de siempre");
  await p.click('[data-action="lc-nueva"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Películas") && (await modal()).includes("Comida") && (await modal()).includes("Viaje"), "el formulario: de qué es (películas, comida, viaje…), el nombre y con quién");
  await p.fill("#lc-nombre", "Películas por ver"); await p.click('#lc-amigos label:has-text("Bruno")');
  await p.click('[data-action="lc-guardar"]'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("Películas por ver") && (await tarjeta()).includes("0 por ver"), "aparece la tarjeta de la lista");
  await agregar("Perfect Days"); await agregar("Dune: Parte Dos");
  ok(JSON.stringify(await filas()) === JSON.stringify(["Perfect Days", "Dune: Parte Dos"]) && (await tarjeta()).includes("agregaste tú") && (await tarjeta()).includes("2 por ver"), "Ana agrega dos (con Enter): «agregaste tú»");
  ok(await p.locator(".lc .lc-mas1").count() === 0, "a lo suyo no le da +1");

  // 2) Bruno se une, da +1 y agrega
  await entrar("bruno@lc.cl");
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 1, "a Bruno le aparece el punto en Amigos");
  await ir("amigos");
  ok((await vista()).includes("Te invitan a una lista") && (await vista()).includes("Películas por ver"), "y la invitación a la lista");
  await p.click('[data-action="lc-unirme"]'); await p.waitForTimeout(900);
  ok((await vista()).includes("Listas con amigos") && (await vista()).includes("2 por ver"), "al unirse, la ve en Amigos › Listas con amigos");
  await ir("listas");
  ok((await tarjeta()).includes("agregó Ana"), "en Listas ve lo que agregó Ana");
  await fila("Dune: Parte Dos").locator('[data-action="lc-mas1"]').click(); await p.waitForTimeout(700);
  ok((await filas())[0] === "Dune: Parte Dos" && (await fila("Dune: Parte Dos").innerText()).includes("tú +1"), "Bruno le da +1 a Dune: sube arriba (la quieren dos)");
  await agregar("Past Lives");
  ok((await filas()).includes("Past Lives"), "y agrega Past Lives");
  await shot(p, "listas-tarjeta");

  // 3) Bruno marca Perfect Days como vista y le pone 5 estrellas
  await fila("Perfect Days").locator('[data-action="lc-visto"]').click(); await p.waitForTimeout(700);
  ok(!(await filas()).includes("Perfect Days") && /vistas · 1/i.test(await tarjeta()), "Perfect Days pasa a «Vistas · 1»");
  await p.click(".lc-vistas summary"); await p.click('.lc-vistas [data-action="lc-item"]'); await p.waitForTimeout(300);
  ok(/ya la vimos · hoy \(lo marcaste tú\)/i.test(await modal()) && /tus estrellas/i.test(await modal()), "el detalle: ya la vimos hoy (lo marcaste tú), y tus estrellas");
  await p.click('#modal [data-action="lc-estrellas"][data-n="5"]'); await p.waitForTimeout(800);
  ok(await p.locator("#modal .lc-det__est button.on").count() === 5, "Bruno le pone 5 estrellas");
  await shot(p, "listas-estrellas");
  await p.evaluate(() => closeModal());

  // 4) Ana: ve todo, pone la nota y elige Dune para un plan
  await entrar("ana@lc.cl"); await ir("listas");
  const t = await tarjeta();
  ok(t.includes("Bruno +1") && t.includes("agregó Bruno") && /vistas · 1/i.test(t), "Ana ve el +1 de Bruno, lo que agregó y la vista");
  await fila("Past Lives").locator('[data-action="lc-item"]').click(); await p.waitForTimeout(300);
  await p.fill("#lc-nota", "en Max"); await p.click('[data-action="lc-nota-ok"]'); await p.waitForTimeout(700);
  await p.evaluate(() => closeModal());
  ok((await fila("Past Lives").innerText()).includes("en Max"), "le pone una nota a Past Lives: «en Max»");
  await fila("Dune: Parte Dos").locator('[data-action="lc-plan"]').click(); await p.waitForTimeout(400);
  ok(await p.locator("#pl-titulo").inputValue() === "Ver Dune: Parte Dos" && (await modal()).includes("Elegido de «Películas por ver»")
    && await p.locator('input[name="pl-tipo"][value="pelicula"]').isChecked() && (await p.locator('#pl-amigos label:has(input:checked)').innerText()).includes("Bruno"),
    "«Elegir para un plan»: el plan nuevo viene con «Ver Dune: Parte Dos», película y Bruno");
  await shot(p, "listas-plan");
  await p.fill("#pl-fecha", "2026-11-07"); await p.fill("#pl-hora", "21:00"); await p.click('[data-action="pl-guardar"]'); await p.waitForTimeout(900);
  await ir("amigos");
  ok((await p.locator(".pl-card").innerText()).includes("Ver Dune: Parte Dos"), "y queda el plan en Amigos › Planes");

  // 5) Borrar: solo lo tuyo
  await ir("listas"); await fila("Past Lives").locator('[data-action="lc-item"]').click(); await p.waitForTimeout(300);
  ok(await p.locator('#modal [data-action="lc-borrar"]').count() === 0, "Ana no puede borrar lo que agregó Bruno");
  await p.evaluate(() => closeModal());
  await fila("Dune: Parte Dos").locator('[data-action="lc-item"]').click(); await p.waitForTimeout(300);
  await p.click('#modal [data-action="lc-borrar"]'); await p.waitForTimeout(800);
  ok(!(await filas()).includes("Dune: Parte Dos"), "lo suyo sí");

  // 6) En el perfil de Bruno, la lista que comparten
  await ir("amigos"); await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Películas por ver"), "en el perfil de Bruno, «Lo que hacen juntos» incluye la lista");
  await p.evaluate(() => closeModal());

  // 7) Sin la base de listas, Listas queda como antes
  await p.evaluate(() => { BACKEND.listaLista = async () => ({ error: "sin-servidor" }); LCOM.lista = null; LCOM.t = 0; });
  await ir("listas"); await p.waitForTimeout(500);
  ok(!(await vista()).includes("Con amigos") && (await vista()).includes("Compras"), "sin la base de listas, Listas muestra solo tus listas");
  await ctx.close();
};
