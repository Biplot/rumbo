/* Pruebas en navegador · 🤝 Amigos: invitar con código y con enlace, aceptar, la lista de hoy,
   ánimos y lo que muestras. Las cuentas locales comparten la "base" de amigos (LocalBackend). */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-10-30T11:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir();
    await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(600);
    await p.evaluate(() => closeModal());   // p. ej., elegir el elefante, para quien no lo eligió
  };
  const nombre = n => p.evaluate(n => { STATE.profile.name = n; saveState(); }, n);
  const amigos = async () => { await p.goto(URL + "#amigos"); await p.waitForTimeout(700); };
  const vista = () => p.locator("#view").innerText();

  // 1) Ana abre Amigos: se activa y se crea su código
  await registrar(p, "ana@test.cl"); await nombre("Ana");
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = { hecho: true, cerrado: true }; saveState(); });
  ok(await p.locator('#nav [data-route="amigos"]').count() === 1, "Amigos está en el menú principal");
  await amigos();
  const codA = (await p.locator(".am-cod").innerText()).trim();
  ok(/^[A-HJKMNP-Z2-9]{6}$/.test(codA), "abrir Amigos crea tu código para invitar: " + codA);
  ok(await p.evaluate(() => STATE.settings.amigos.activo === true) && (await vista()).includes("Todavía no tienes amigos"), "sin amigos, te invita a usar tu enlace o tu código");
  ok(await p.locator('[data-action="am-muestra"]').count() === 3 && await p.locator('[data-action="am-muestra"]:checked').count() === 3, "Lo que muestras: tu día, tu racha y tu rango, encendidos");
  await shot(p, "amigos-vacio");

  // 2) Bruno agrega a Ana con su código (en minúsculas también sirve)
  await salir(); await registrar(p, "bruno@test.cl"); await nombre("Bruno");
  await amigos();
  const codB = (await p.locator(".am-cod").innerText()).trim();
  await p.fill("#am-cod", codB); await p.click('[data-action="am-codigo"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modalOverlay").isHidden(), "tu propio código no abre nada");
  await p.fill("#am-cod", "ZZZZZZ"); await p.click('[data-action="am-codigo"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modalOverlay").isHidden(), "un código que no existe tampoco");
  await p.fill("#am-cod", codA.toLowerCase()); await p.click('[data-action="am-codigo"]'); await p.waitForTimeout(400);
  ok((await p.locator("#modal").innerText()).includes("Ana"), "con el código de Ana aparece ella para confirmar");
  await p.click('[data-action="am-pedir"]'); await p.waitForTimeout(700);
  ok((await vista()).includes("Esperando respuesta") && (await vista()).includes("Ana"), "la solicitud queda esperando respuesta");

  // 3) Ana ve la solicitud (con un punto en el menú) y la acepta
  await entrar("ana@test.cl"); await p.waitForTimeout(300);
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 1, "un punto en Amigos avisa que hay algo nuevo");
  await amigos();
  ok((await vista()).includes("Quieren ser tus amigos") && (await vista()).includes("Bruno"), "Ana ve que Bruno quiere ser su amigo");
  await p.click('[data-action="am-aceptar"]'); await p.waitForTimeout(700);
  ok(await p.locator(".am-fila").count() === 1 && (await p.locator(".am-fila").innerText()).includes("Bruno"), "al aceptar, Bruno aparece en Hoy");
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 0, "y el punto se va");

  // 4) Ana le manda ánimo (hasta 3 al día)
  for (let i = 0; i < 3; i++) {
    await p.click('.am-fila [data-action="am-animo"]'); await p.waitForTimeout(300);
    if (i === 0) await p.click('[data-action="am-frase"][data-v="¡Bien hecho!"]');
    if (i === 1) await p.fill("#am-msg", "Mañana corremos");
    await p.click('[data-action="am-animo-enviar"]'); await p.waitForTimeout(400);
  }
  await p.click('.am-fila [data-action="am-animo"]'); await p.waitForTimeout(300);
  await p.click('[data-action="am-animo-enviar"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modalOverlay").isVisible(), "el cuarto ánimo del día no sale (máximo 3)");
  await p.evaluate(() => closeModal());

  // 5) Bruno ve cómo va el día de Ana y sus ánimos
  await entrar("bruno@test.cl"); await amigos();
  const filaAna = await p.locator(".am-fila").innerText();
  ok(filaAna.includes("Ana") && filaAna.includes("Cerró su día"), "Bruno ve que Ana cerró su día: " + filaAna.replace(/\n/g, " "));
  const an = await p.locator(".am-animos").innerText();
  ok(an.includes("¡Bien hecho!") && an.includes("«Mañana corremos»") && an.includes("Ana"), "Bruno ve los ánimos de Ana, con su mensaje");
  await shot(p, "amigos-lista");
  await p.click('[data-action="am-gracias"]'); await p.waitForTimeout(400);
  ok(await p.locator(".am-animos").count() === 0, "con «Gracias» los ánimos quedan vistos");
  await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  const perfil = await p.locator("#modal").innerText();
  ok(perfil.includes("Aprendiz") && perfil.includes("rango 1 de 7") && perfil.includes("Mandar ánimo"), "el perfil de Ana muestra su rango y el botón para mandarle ánimo");
  await p.evaluate(() => closeModal());

  // 6) Lo que muestras: Ana deja de mostrar su día y su rango
  await entrar("ana@test.cl"); await amigos();
  await p.click('[data-action="am-muestra"][data-k="dia"]'); await p.waitForTimeout(200);
  await p.click('[data-action="am-muestra"][data-k="rango"]'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !STATE.settings.amigos.muestra.dia && !STATE.settings.amigos.muestra.rango && STATE.settings.amigos.muestra.racha), "apagar el día y el rango queda guardado");
  await entrar("bruno@test.cl"); await amigos();
  ok(!(await p.locator(".am-fila").innerText()).includes("Cerró su día"), "Bruno ya no ve si Ana cerró su día");
  await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  ok(!(await p.locator("#modal").innerText()).includes("rango"), "ni su rango");
  ok(await p.evaluate(() => { const db = JSON.parse(localStorage.getItem("rumbo_amigos")); const a = Object.values(db.perfiles).find(x => x.nombre === "Ana"); return !("cerro" in a.estado) && !("rango" in a.estado); }), "lo apagado ni siquiera se publica");
  await p.evaluate(() => closeModal());

  // 7) Cami llega con el enlace de Ana: se registra y la invitación la espera
  await salir();
  await p.goto(URL + "?amigo=" + codA); await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => location.search)).includes("amigo"), "el enlace se guarda y sale de la barra de direcciones");
  await p.click('[data-tab="register"]');
  await p.fill("#reg-name", "Cami"); await p.fill("#reg-email", "cami@test.cl"); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok(await p.locator(".onb-title").count() === 1 && !(await p.locator("#modal").innerText()).includes("Mandar solicitud"), "primero la bienvenida");
  await p.evaluate(() => { ONB_STEP = 99; }); await p.evaluate(() => openOnboarding("nuevo")).catch(() => {});
  await p.evaluate(() => { document.getElementById("modalBody").innerHTML += '<input id="ob-name" value="Cami">'; saveOnboarding(); });
  await p.waitForTimeout(1200);
  ok((await p.locator("#modal").innerText()).includes("Ana") && await p.locator('[data-action="am-pedir"]').count() === 1, "al terminarla, la invitación de Ana va primero");
  await p.click('[data-action="am-pedir"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => CURRENT) === "amigos" && (await vista()).includes("Esperando respuesta"), "y queda la solicitud a Ana");

  // 8) Ana la acepta; quitar y bloquear
  await entrar("ana@test.cl"); await amigos();
  await p.click('[data-action="am-aceptar"]'); await p.waitForTimeout(700);
  ok(await p.locator(".am-fila").count() === 2, "Ana ya tiene a Bruno y a Cami");
  p.once("dialog", d => d.accept());
  await p.locator('.am-fila', { hasText: "Cami" }).locator('[data-action="am-ver"]').click(); await p.waitForTimeout(300);
  await p.click('[data-action="am-bloquear"]'); await p.waitForTimeout(700);
  ok(await p.locator(".am-fila").count() === 1 && (await vista()).includes("Bloqueados"), "bloquear a Cami la saca de la lista y queda en Bloqueados");
  await entrar("cami@test.cl"); await amigos();
  await p.fill("#am-cod", codA); await p.click('[data-action="am-codigo"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modalOverlay").isHidden() && await p.locator(".am-fila").count() === 0, "Cami no encuentra a Ana ni la tiene como amiga");

  // 9) Mientras no se corra supabase/amigos.sql: lo dice, y no insiste con el servidor
  await p.evaluate(() => {
    window.__llamadas = 0;
    BACKEND.amigosPerfil = async () => { window.__llamadas++; return { error: "sin-servidor" }; };
    Object.assign(AMIGOS, { lista: null, error: null, t: 0, cargando: false });
    go("inicio");
  });
  await p.waitForTimeout(300); await p.evaluate(() => go("amigos")); await p.waitForTimeout(1500);
  ok((await vista()).includes("todavía no está activo"), "sin la base de Amigos, la pantalla dice que todavía no está activo");
  ok(await p.evaluate(() => window.__llamadas) === 1, "y no vuelve a preguntarle al servidor a cada rato");
  await p.evaluate(() => { saveState(); saveState(); }); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => window.__llamadas) === 1, "ni al guardar");
  await ctx.close();
};
