/* Pruebas en navegador · Google Calendar permanente: la función del servidor renueva el permiso sola */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
const { simularGoogle } = require("./gcal.cjs");

/* Simula la función "gcal" de Supabase (guarda si hay permiso de renovación) */
async function simularServidor(ctx, srv) {
  await ctx.route("**/functions/v1/gcal", async r => {
    const b = JSON.parse(r.request().postData() || "{}"); srv.llamadas.push(b.accion);
    const res = (st, x) => r.fulfill({ status: st, contentType: "application/json", body: JSON.stringify(x) });
    if (b.accion === "estado") return res(200, { listo: srv.listo, conectado: srv.rt });
    if (b.accion === "conectar") {
      srv.redirect = b.redirect_uri;
      if (b.code !== "cod-123") return res(400, { error: "google" });
      srv.rt = true; return res(200, { access_token: "tok-srv-" + (++srv.n), expires_in: 3600 });
    }
    if (b.accion === "token") return srv.rt ? res(200, { access_token: "tok-srv-" + (++srv.n), expires_in: 3600 }) : res(409, { error: "reconectar" });
    if (b.accion === "desconectar") { srv.rt = false; return res(200, { ok: true }); }
    return res(400, { error: "accion" });
  });
}

module.exports = async ({ b, ok, errs }) => {
  // ---------- Computador ----------
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T08:00:00", w: 1280, h: 900 });
  const srv = { listo: true, rt: false, n: 0, llamadas: [] };
  await simularGoogle(ctx, []); await simularServidor(ctx, srv);
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "gcal-perm@test.cl");
  await p.evaluate(() => { GCAL.clientId = "prueba.apps.googleusercontent.com"; });
  await p.goto(URL + "#calendario"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => GCAL_SERVIDOR) === true, "Rumbo detecta que el servidor puede mantener la conexión");

  // 1) Conectar: flujo con código; el servidor lo canjea y guarda la renovación
  await p.click('[data-action="gcal-conectar"]'); await p.waitForTimeout(700);
  const c = await p.evaluate(() => ({ codigo: window.__codigo, prompt: window.__gisPrompt, g: STATE.settings.gcal, tok: gcalTokenVigente() }));
  ok(c.codigo && c.prompt === undefined && c.g.conectado && c.g.servidor && String(c.tok).startsWith("tok-srv-") && srv.redirect === "postmessage",
    "conectar usa el código de Google y el servidor entrega el permiso");
  await p.click('[data-action="gcal-guardar"]'); await p.waitForTimeout(500);

  // 2) El permiso vence: se renueva solo, sin ventanas ni botones
  await p.evaluate(() => { const l = gcalLocal(); l.exp = Date.now() - 1000; l.ts = 1; gcalGuardarLocal(l); gcalAlIniciar(); });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ tok: gcalTokenVigente(), prompt: window.__gisPrompt, ts: gcalLocal().ts }));
  ok(String(r.tok).startsWith("tok-srv-") && r.tok !== c.tok && r.prompt === undefined && r.ts > 1, "al vencer, el permiso se renueva solo y trae los eventos");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator('[data-tour="gcal"] [data-action="gcal-actualizar"]').count() === 0 && (await p.locator('[data-tour="gcal"]').innerText()).includes("Reunión con cliente"),
    "Inicio muestra los eventos sin pedir 🔄 Actualizar");

  // 3) Quien conectó a la antigua ve la invitación a conectar para siempre
  await p.evaluate(() => { STATE.settings.gcal.servidor = false; saveState(); rerender(); });
  ok(await p.locator('[data-tour="gcal"] .gcal-permanente [data-action="gcal-conectar"]').count() === 1, "a quien conectó antes se le ofrece conectar para siempre");
  await p.evaluate(() => { STATE.settings.gcal.servidor = true; saveState(); rerender(); });

  // 4) Si quitó el permiso en Google, el servidor pide reconectar y la app vuelve al modo simple
  srv.rt = false;
  await p.evaluate(() => { const l = gcalLocal(); l.exp = Date.now() - 1000; l.ts = 1; gcalGuardarLocal(l); gcalAlIniciar(); });
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.settings.gcal.servidor === false && STATE.settings.gcal.conectado === true), "si Google quitó el permiso, queda conectado en modo simple (sin perder nada)");

  // 5) Desconectar también borra el permiso del servidor
  srv.rt = true;
  await p.evaluate(() => { STATE.settings.gcal.servidor = true; saveState(); gcalDesconectar(); });
  await p.waitForTimeout(300);
  ok(srv.llamadas.includes("desconectar") && !srv.rt && await p.evaluate(() => !STATE.settings.gcal.conectado), "desconectar borra el permiso guardado en el servidor");
  await ctx.close();

  // ---------- iPhone: ir y volver con código ----------
  const ios = await nuevoContexto(b, { fecha: "2026-09-28T08:00:00", w: 390, h: 844 });
  const s2 = { listo: true, rt: false, n: 0, llamadas: [] }, pedidos = [];
  await simularGoogle(ios, []); await simularServidor(ios, s2);
  await ios.route("https://accounts.google.com/o/oauth2/v2/auth**", r => {
    const u = new globalThis.URL(r.request().url()); pedidos.push(u.searchParams);
    r.fulfill({ status: 302, headers: { location: u.searchParams.get("redirect_uri") + "?code=cod-123&state=" + u.searchParams.get("state") } });
  });
  const q = await ios.newPage(); q.on("pageerror", e => errs.push(e.message));
  await registrar(q, "gcal-perm-ios@test.cl");
  await q.addInitScript(() => { Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" }); });
  await q.reload(); await q.waitForSelector("#app:not([hidden])"); await q.waitForTimeout(400);
  await q.evaluate(() => { GCAL.clientId = "prueba.apps.googleusercontent.com"; });
  await q.goto(URL + "#calendario"); await q.waitForTimeout(500);
  await q.click('[data-action="gcal-conectar"]'); await q.waitForURL(/#calendario/); await q.waitForSelector("#app:not([hidden])");
  await q.evaluate(() => { GCAL.clientId = "prueba.apps.googleusercontent.com"; }); await q.waitForTimeout(1200);
  const pr = pedidos[pedidos.length - 1];
  ok(pr && pr.get("response_type") === "code" && pr.get("access_type") === "offline" && pr.get("prompt") === "consent", "iPhone pide a Google un código con acceso permanente");
  const vi = await q.evaluate(() => ({ g: STATE.settings.gcal, tok: gcalTokenVigente() }));
  ok(vi.g.conectado && vi.g.servidor && String(vi.tok).startsWith("tok-srv-") && /gcal-callback\.html$/.test(s2.redirect), "iPhone: vuelve conectado para siempre");
  await ios.close();
};
