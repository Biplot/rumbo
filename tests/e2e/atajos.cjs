/* Pruebas en navegador · Arreglos rápidos (v80): pantalla de carga, tema automático, manifest y atajos del ícono */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844, fecha: "2026-10-27T08:30:00" });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));

  // 1) Pantalla de carga: viene en el HTML (se ve antes que el código) y se va al aparecer el acceso
  await p.emulateMedia({ colorScheme: "dark" });
  await p.goto(URL); await p.waitForSelector("#authScreen:not([hidden])"); await p.waitForTimeout(400);
  const html = await p.evaluate(async () => (await fetch("./")).text());
  ok(/id="splash"/.test(html) && /Trayendo tus datos/.test(html), "la pantalla de carga viene en el HTML");
  ok(await p.locator("#splash").count() === 0, "se va cuando aparece la pantalla de acceso");
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === "norte-noche", "con el teléfono en modo oscuro, el acceso se ve en Norte noche");
  await p.emulateMedia({ colorScheme: "light" });

  // 2) Tema automático: sigue al teléfono, también en vivo
  await registrar(p, "atajos@test.cl");
  ok(await p.evaluate(() => STATE.settings.theme === "auto" && document.documentElement.dataset.theme === "norte"), "cuenta nueva en automático: de día, Norte");
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  const noche = await p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.querySelector(".app")).backgroundColor, document.querySelector('meta[name="theme-color"]').content]);
  ok(noche[0] === "norte-noche" && noche[1] === "rgb(12, 15, 30)" && noche[2] === "#0C0F1E", "el teléfono pasa a modo oscuro y Rumbo cambia a Norte noche al tiro: " + noche.join(" · "));
  await p.emulateMedia({ colorScheme: "light" }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === "norte", "y vuelve a Norte en modo claro");
  await p.goto(URL + "#tienda"); await p.waitForTimeout(300);
  const ficha = await p.locator('.ficha[data-theme="auto"]').innerText();
  ok(/Automático/.test(ficha) && /En uso/.test(ficha), "en la Tienda, Automático aparece en uso: " + ficha.replace(/\s+/g, " "));
  await p.click('.ficha[data-theme="auto"]'); await p.waitForTimeout(250);
  const prev = await p.locator("#modalBody").innerText();
  ok(/De día/.test(prev) && /De noche/.test(prev) && /Norte de día y Norte noche de noche/.test(prev), "su vista previa muestra Norte de día y Norte noche de noche");
  await p.evaluate(() => closeModal());
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "set-theme"; x.dataset.theme = "ruta"; document.getElementById("view").appendChild(x); x.click(); });
  await p.emulateMedia({ colorScheme: "dark" }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => STATE.settings.theme === "ruta" && STATE.settings.temaElegido === "ruta" && document.documentElement.dataset.theme === "ruta"), "quien elige Ruta lo tiene siempre claro, aunque el teléfono esté oscuro");
  await p.evaluate(() => { STATE.settings.theme = "auto"; delete STATE.settings.temaElegido; applyTheme("auto"); saveState(); });
  await p.emulateMedia({ colorScheme: "light" });

  // 3) Manifest: carga en tinta índigo, como la barra de arriba de Norte, y tres atajos con su ícono
  const man = await p.evaluate(async () => {
    const m = await (await fetch("./manifest.json")).json();
    const iconos = await Promise.all((m.shortcuts || []).map(async s => { const r = await fetch(s.icons[0].src); return r.ok && /image\/png/.test(r.headers.get("content-type") || ""); }));
    return { bg: m.background_color, tc: m.theme_color, urls: (m.shortcuts || []).map(s => s.url), iconos };
  });
  ok(man.bg === "#161A2E" && man.tc === "#161A2E", "al abrir desde el ícono, la carga es en tinta índigo como la app: " + man.bg + " · " + man.tc);
  ok(JSON.stringify(man.urls) === '["./?atajo=abrir","./?atajo=tarea","./?atajo=cerrar"]' && man.iconos.every(Boolean), "atajos del ícono: abrir, nueva tarea y cerrar, cada uno con su ícono");

  // 4) Atajos: abrir mi día
  await p.goto(URL + "?atajo=abrir#inicio"); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok(await p.locator("#modalTitle").innerText() === "Ritual de apertura" && await p.evaluate(() => document.activeElement.id === "r-mision"), "«Abrir mi día» abre el ritual con el cursor en la misión");
  ok(await p.evaluate(() => location.search === "" && location.hash === "#inicio"), "y limpia la dirección (recargar no lo repite)");
  ok(await p.locator("#splash").count() === 0, "la pantalla de carga se fue al aparecer la app");
  await p.evaluate(() => closeModal());

  // Nueva tarea
  await p.goto(URL + "?atajo=tarea#inicio"); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok(await p.locator("#modalTitle").innerText() === "Nueva tarea para hoy" && await p.evaluate(() => document.activeElement.id === "nt-txt"), "«Nueva tarea» abre una ventana lista para escribir");
  await p.fill("#nt-txt", "Comprar pan"); await p.press("#nt-txt", "Enter"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("modalOverlay").hidden && tareasDelDia(todayISO()).some(t => t.txt === "Comprar pan")), "con Enter queda agregada a hoy y la ventana se cierra");

  // Cerrar mi día: sin abrirlo, avisa; abierto, abre el cierre
  await p.goto(URL + "?atajo=cerrar#inicio"); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok(await p.locator("#modalOverlay").isHidden() && (await p.locator("#toast").textContent()).includes("Primero abre tu día"), "«Cerrar mi día» sin abrirlo avisa que primero hay que abrirlo");
  await p.evaluate(() => { STATE.ritual.dias[todayISO()] = { hecho: true, mision: "Probar", abiertoTs: Date.now(), ts: Date.now() }; saveState(); });
  await p.goto(URL + "?atajo=cerrar#inicio"); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
  ok(await p.locator("#modalTitle").innerText() === "Cierra tu martes", "con el día abierto, «Cerrar mi día» abre el cierre");
  await p.evaluate(() => closeModal());

  // Las novedades van primero
  await p.evaluate(() => { STATE.settings.introVersion = 18; saveState(); });
  await p.goto(URL + "?atajo=abrir#inicio"); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(1000);
  ok((await p.locator("#modalTitle").innerText()).includes("Novedades") && (await p.locator("#modalBody").innerText()).includes("Tema automático"), "si hay novedades, se muestran antes que el atajo (y cuentan el tema automático)");
  await ctx.close();
};
