/* Pruebas en navegador · Diseño Ruta (v78): tema predeterminado, paso desde Navy y el día como recorrido */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-27T08:30:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "ruta@test.cl");
  await p.evaluate(() => { STATE.settings.introVersion = INTRO_VERSION; saveState(); });

  // 1) Cuenta nueva: Ruta es el tema, con la barra de arriba negra (la hora del iPhone se lee en blanco)
  ok(await p.evaluate(() => STATE.settings.theme === "ruta" && document.documentElement.dataset.theme === "ruta"), "una cuenta nueva parte con el diseño Ruta");
  const barra = await p.evaluate(() => [getComputedStyle(document.querySelector(".topbar")).backgroundColor, getComputedStyle(document.querySelector(".app")).backgroundColor]);
  ok(barra[0] === "rgb(11, 11, 12)" && barra[1] === "rgb(255, 255, 255)", `barra de arriba negra y contenido blanco (${barra.join(" · ")})`);
  ok(await p.evaluate(() => document.querySelector('meta[name="theme-color"]').content === "#0B0B0C"), "el color del navegador sigue a la barra");
  ok(await p.evaluate(() => themeOwned("ruta") && themeOwned("ruta-noche")), "Ruta y Ruta noche son gratis");

  // 2) Paso desde Navy: quien seguía en Navy pasa a Ruta una sola vez; los demás temas se respetan
  const mig = await p.evaluate(() => {
    const base = () => JSON.parse(JSON.stringify(STATE));
    const a = base(); a.settings.theme = "navy"; delete a.settings.temaElegido;
    const c = base(); c.settings.theme = "sakura";
    const d = base(); d.settings.theme = "navy"; d.settings.temaElegido = "navy";   // eligió Navy en la Tienda después del cambio
    return [migrate(a).settings.theme, migrate(c).settings.theme, migrate(d).settings.theme];
  });
  ok(JSON.stringify(mig) === '["ruta","sakura","navy"]', "Navy (el predeterminado de antes) pasa a Ruta; Sakura y un Navy elegido después se quedan: " + mig);

  // Elegir Navy en la Tienda lo deja guardado: una recarga no lo vuelve a cambiar
  await p.evaluate(() => { STATE.settings.introVersion = INTRO_VERSION; saveState(); });
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.createElement("button"); b.dataset.action = "set-theme"; b.dataset.theme = "navy"; document.getElementById("view").appendChild(b); b.click(); });
  await p.waitForTimeout(200);
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => STATE.settings.theme === "navy" && STATE.settings.temaElegido === "navy"), "quien elige Navy en la Tienda lo conserva al recargar");
  await p.evaluate(() => { STATE.settings.theme = "ruta"; STATE.settings.temaElegido = "ruta"; applyTheme("ruta"); saveState(); });

  // 3) Inicio con el día por abrir: tres paradas y un solo botón principal
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator("#view .ruta-dia .ruta__p").count() === 3, "el día se ve como un recorrido de tres paradas");
  ok(await p.locator("#view .ruta__p.is-actual .btn--primary[data-action=day-open]").count() === 1, "la primera parada abre el día");
  ok(await p.evaluate(() => [...document.querySelectorAll("#view .ruta-dia .btn--primary")].length) === 1, "un solo botón principal en la tarjeta del día");

  // 4) Día abierto con primer bocado: se marca como hecho desde la parada
  await p.evaluate(() => {
    const hoy = todayISO();
    STATE.ritual.dias[hoy] = { hecho: true, mision: "Cerrar el informe", sapo: "Enviar la propuesta", energia: 4, abiertoTs: Date.now(), ts: Date.now() };
    nuevaTarea(STATE, hoy, { txt: "Enviar la propuesta", ambito: "pro", esSapo: true });
    saveState(); rerender();
  });
  await p.waitForTimeout(200);
  const primera = await p.locator("#view .ruta__p").first().innerText();
  ok(primera.includes("Abriste tu día") && primera.includes("Misión: Cerrar el informe") && /08:30/.test(primera), "la primera parada muestra la misión y la hora en que abriste: " + primera.replace(/\s+/g, " "));
  ok(await p.locator('#view [data-action="bocado-hecho"]').count() === 1, "la parada del bocado tiene su botón Hecho");
  await p.click('#view [data-action="bocado-hecho"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => estadoTarea(tareasDelDia(todayISO()).find(t => t.esSapo)) === "hecha"), "Hecho marca la tarea del primer bocado");
  ok(await p.locator("#view .ruta__p:nth-child(2).is-hecho").count() === 1, "la parada queda como hecha");
  ok(await p.locator("#view .ruta-dia .btn--primary").count() === 0, "con el día en curso no hay botón principal en la tarjeta");

  // 5) En el celular, las ventanas suben desde abajo
  await p.click('#view .ruta-dia [data-action="day-close"]'); await p.waitForTimeout(300);
  const hoja = await p.evaluate(() => { const r = document.getElementById("modal").getBoundingClientRect(); return Math.round(innerHeight - r.bottom); });
  ok(hoja <= 1, `el cierre se abre como una hoja pegada abajo (${hoja}px)`);
  await p.evaluate(() => closeModal());
  await ctx.close();

  // 6) De noche, con Ruta noche: cerrar el día es lo principal
  const c2 = await nuevoContexto(b, { w: 1360, h: 860, fecha: "2026-10-27T21:15:00" });
  const p2 = await c2.newPage(); p2.on("pageerror", e => errs.push(e.message));
  await registrar(p2, "ruta-noche@test.cl");
  await p2.evaluate(() => { STATE.settings.introVersion = INTRO_VERSION; saveState(); });
  await p2.evaluate(() => { STATE.settings.theme = "ruta-noche"; applyTheme("ruta-noche"); STATE.ritual.dias[todayISO()] = { hecho: true, ts: Date.now() }; saveState(); rerender(); });
  await p2.goto(URL + "#inicio"); await p2.waitForTimeout(300);
  ok(await p2.locator("#view .ruta__p.is-actual .btn--primary[data-action=day-close]").count() === 1, "de noche, la última parada cierra el día");
  const noche = await p2.evaluate(() => [getComputedStyle(document.querySelector(".app")).backgroundColor, getComputedStyle(document.querySelector("#view .btn--primary")).backgroundColor]);
  ok(noche[0] === "rgb(11, 11, 12)" && noche[1] === "rgb(255, 255, 255)", `Ruta noche: fondo negro y botón principal blanco (${noche.join(" · ")})`);
  ok(await p2.locator(".nav__item .ico-linea").count() > 5, "el menú del computador usa íconos de línea");
  await c2.close();
};
