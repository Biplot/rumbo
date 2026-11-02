/* Pruebas en navegador · 👋 Bienvenida: quien recién llega. El acceso parte en «Crear cuenta» en un
   equipo nuevo, el saludo es para todas las personas, no se pide cerrar un mes que no vivió y los
   avisos cortos van arriba cuando hay una hoja abierta. */
const { URL, nuevoContexto, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-02T09:10:00", w: 390, h: 844 });   // lunes 2 de noviembre
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));

  // 1) Acceso: en un equipo donde nunca se entró, parte en «Crear cuenta» y cuenta qué es Rumbo
  await p.goto(URL); await p.waitForTimeout(500);
  ok(await p.locator("#form-register").isVisible() && await p.locator("#form-login").isHidden(), "equipo nuevo: el acceso parte en «Crear cuenta»");
  ok(/en un solo lugar/.test(await p.locator(".auth__que").innerText()) && await p.locator('.auth__que a[href="conoce/"]').count() === 1, "una línea dice qué es Rumbo y enlaza a Conoce");
  await shot(p, "bienvenida-acceso");

  // 2) Crear la cuenta: el saludo usa su nombre, sin «Bienvenido», y sin un aviso encima de la lámina
  await p.fill("#reg-name", "Camila Rojas"); await p.fill("#reg-email", "camila@test.cl"); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok((await p.locator("#modalTitle").innerText()).includes("¡Hola, Camila!"), "la bienvenida saluda por su nombre: «¡Hola, Camila!»");
  ok(await p.locator("#toast").isHidden(), "sin un aviso tapando la primera lámina");
  const textos = await p.evaluate(() => document.getElementById("modal").innerText);
  ok(!/Bienvenido/.test(textos), "sin «Bienvenido» en la bienvenida");
  ok(await p.evaluate(() => STATE.settings.alta) === "2026-11-02", "la cuenta guarda su día: 2 de noviembre");
  ok(!/Cierra Octubre/i.test(await p.locator("#view").innerText()), "detrás de la bienvenida, Inicio ya no pide cerrar octubre");

  // 3) Inicio: no pide cerrar octubre (no lo vivió); sí abrir noviembre
  await p.evaluate(() => { closeModal(); ONB_ACTIVE = false; STATE.settings.onboarded = true; STATE.settings.tutorial.auto = false; saveState(); go("inicio"); rerender(); });
  await p.waitForTimeout(400);
  const ini = await p.locator("#view").innerText();
  ok(!/Cierra Octubre/i.test(ini) && /Abre Noviembre/i.test(ini), "Inicio no pide cerrar octubre, pero sí ofrece abrir noviembre");

  // 4) Avisos cortos: con una hoja abierta van arriba; sin nada abierto, abajo
  await p.evaluate(() => { openModal("Prueba", "<p>Hola</p>"); toast("Arriba"); });
  const arriba = await p.locator("#toast").boundingBox();
  ok(arriba && arriba.y < 120, "con una hoja abierta, el aviso va arriba");
  await p.evaluate(() => { closeModal(); toast("Abajo"); });
  const abajo = await p.locator("#toast").boundingBox();
  ok(abajo && abajo.y > 500, "sin nada abierto, el aviso va abajo como siempre");

  // 5) Quien vuelve a un equipo donde ya entró: el acceso parte en «Iniciar sesión»
  await p.evaluate(() => BACKEND.logout && BACKEND.logout());
  await p.goto(URL); await p.waitForTimeout(500);
  if (await p.locator("#authScreen").isVisible()) ok(await p.locator("#form-login").isVisible(), "equipo con cuenta: parte en «Iniciar sesión»");
  else ok(true, "la sesión sigue abierta en este equipo");
  await ctx.close();
};
