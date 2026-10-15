/* Pruebas en navegador · Notificaciones al celular (como Fundos 360: la clave la entrega api/push/) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
module.exports = async ({ b, ok, errs }) => {
  // 1) Computador con permiso: se puede activar y la clave se pide al servidor de la app
  const ctx = await nuevoContexto(b, { fecha: "2026-10-15T10:00:00", w: 1280, h: 860 });
  // Chromium sin pantalla responde siempre "denied": se simula un dispositivo que aún no decide
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "default" }); } catch (e) {} });
  let pedidas = 0;
  await ctx.route("**/api/push/", r => { pedidas++; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ clave: "BEmWz9J7qwK6VfhvfGCPMLQbWXDR_aU_soFpJCwkAlnN7OoYSw3qJcT7Wm1RDmu1e80F2rmJ-dEB1NK44MQznUM" }) }); });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "notificaciones@test.cl");
  await p.goto(URL + "#notif"); await p.waitForTimeout(500);
  ok((await p.locator(".notif-banner").innerText()).includes("Actívalas"), "sin activar en este dispositivo: invita a activarlas");
  ok(await p.locator('[data-action="notif-enable"]').isEnabled(), "el botón Activar está disponible");
  ok(pedidas === 1, "la clave pública se pide al servidor de la app (api/push/)");
  ok(await p.locator('[data-action="notif-test"]').count() === 0, "la prueba solo aparece con el dispositivo activado");

  // 1b) Qué avisos recibir: niveles de un toque e interruptores, guardados en la cuenta
  ok(await p.locator('[data-action="notif-nivel"][data-n="recomendado"].is-active').count() === 1, "por defecto, el nivel Recomendado (como siempre)");
  await p.click('[data-action="notif-nivel"][data-n="esencial"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => { const a = avisosActivos(STATE.settings.notif); return a.manana && a.noche && !a.semana && !a.mes && !a.trimestre; }), "Lo esencial deja solo abrir y cerrar el día");
  await p.click('[data-action="notif-aviso"][data-k="habitos"]'); await p.waitForTimeout(200);
  ok(await p.locator("#notif-habitos").inputValue() === "20:00" && (await p.locator(".card", { hasText: "Qué avisos" }).innerText()).includes("Elegiste tus propios avisos"),
    "encender hábitos muestra su hora sugerida y el nivel pasa a personalizado");
  await p.fill("#notif-habitos", "19:30"); await p.click('[data-action="notif-times"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.settings.notif.habitosHora) === "19:30", "guarda la hora de los hábitos");
  await p.click('[data-action="notif-nivel"][data-n="todo"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => Object.values(avisosActivos(STATE.settings.notif)).every(Boolean) && !!STATE.settings.notif.mediodia), "Todo enciende cada aviso (mediodía con su hora sugerida)");
  await shot(p, "notificaciones-avisos");

  // 2) Quien las tenía con el sistema anterior ve que debe volver a activarlas
  await p.evaluate(() => { STATE.settings.notif.enabled = true; delete STATE.settings.notif.version; saveState(); rerender(); });
  await p.waitForTimeout(200);
  ok((await p.locator(".notif-banner").innerText()).includes("Renovamos"), "con el sistema anterior: pide activarlas otra vez");
  await shot(p, "notificaciones");

  // 3) Cerrar sesión sin dispositivo activado no se traba
  await p.evaluate(() => doLogout()); await p.waitForTimeout(400);
  ok(await p.locator("#authScreen").isVisible(), "cerrar sesión funciona igual");
  await ctx.close();

  // 4) iPhone desde Safari (sin instalar): explica cómo instalarla y no deja activar
  const ios = await nuevoContexto(b, { fecha: "2026-10-15T10:00:00", w: 390, h: 844, ua: IPHONE });
  const q = await ios.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "iphone@test.cl");
  await q.goto(URL + "#notif"); await q.waitForTimeout(500);
  ok((await q.locator(".notif-banner").innerText()).includes("pantalla de inicio"), "iPhone sin instalar: explica Compartir → Agregar a inicio");
  ok(await q.locator('[data-action="notif-enable"]').isDisabled(), "iPhone sin instalar: Activar queda deshabilitado");
  ok(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "en el celular la lista de avisos no se sale de la pantalla");
  await shot(q, "notificaciones-iphone");
  await ios.close();
};
