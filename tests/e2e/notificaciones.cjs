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
  await shot(q, "notificaciones-iphone");
  await ios.close();
};
