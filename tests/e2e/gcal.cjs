/* Pruebas en navegador · Google Calendar (solo lectura), con Google simulado */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

/* Simula el inicio de sesión de Google (GIS) y la API de Calendar */
async function simularGoogle(ctx, llamadas) {
  await ctx.route("https://accounts.google.com/gsi/client", r => r.fulfill({ contentType: "text/javascript", body: `
    window.google = { accounts: { oauth2: {
      initTokenClient(cfg) { return { requestAccessToken(o) { window.__gisPrompt = o && o.prompt; setTimeout(() => cfg.callback({ access_token: "tok-" + Date.now(), expires_in: 3600 }), 20); } }; },
      revoke(t, cb) { window.__revocado = t; cb && cb(); } } } };` }));
  await ctx.route("https://www.googleapis.com/calendar/v3/**", r => {
    const u = new globalThis.URL(r.request().url()), auth = r.request().headers()["authorization"] || "";
    llamadas.push(u.pathname);
    if (!auth.startsWith("Bearer tok-")) return r.fulfill({ status: 401, body: "{}" });
    if (u.pathname.endsWith("/calendarList")) return r.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [
      { id: "yo@gmail.com", summary: "yo@gmail.com", summaryOverride: "Personal", backgroundColor: "#4285F4", selected: true, primary: true },
      { id: "feriados", summary: "Feriados en Chile", backgroundColor: "#0B8043", selected: false }] }) });
    const cal = decodeURIComponent(u.pathname.split("/calendars/")[1].split("/")[0]);
    const items = cal === "yo@gmail.com" ? [
      { id: "a", summary: "Reunión con cliente", start: { dateTime: "2026-09-28T09:00:00" }, end: { dateTime: "2026-09-28T10:00:00" } },
      { id: "b", summary: "Almuerzo con Ana", location: "Providencia", start: { dateTime: "2026-09-29T13:00:00" }, end: { dateTime: "2026-09-29T14:00:00" } },
      { id: "c", summary: "Borrado", status: "cancelled", start: { date: "2026-09-28" } }]
      : [{ id: "f", summary: "Día de la Raza", start: { date: "2026-10-12" }, end: { date: "2026-10-13" } }];
    return r.fulfill({ contentType: "application/json", body: JSON.stringify({ items }) });
  });
}

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T08:00:00", w: 390, h: 844, dpr: 2 });
  const llamadas = [];
  await simularGoogle(ctx, llamadas);
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "gcal@test.cl");

  // Sin ID de cliente configurado, no aparece nada
  await p.evaluate(() => { GCAL.clientId = ""; });
  await p.goto(URL + "#calendario"); await p.waitForTimeout(250);
  ok(!(await p.locator("#view").innerText()).includes("Google Calendar"), "sin ID de cliente, Google Calendar queda oculto");

  await p.evaluate(() => { GCAL.clientId = "prueba.apps.googleusercontent.com"; rerender(); });
  ok(await p.locator('[data-action="gcal-conectar"]').count() === 1, "Calendario ofrece Conectar Google Calendar");
  await p.click('[data-action="gcal-conectar"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => window.__gisPrompt) === "consent", "la primera vez pide el permiso a Google");
  const modal = await p.locator("#modalBody").innerText();
  ok(modal.includes("Personal") && modal.includes("Feriados en Chile") && modal.includes("solo lee"), "muestra tus calendarios y aclara que es solo lectura");
  ok(await p.locator('.gcal-cal[value="yo@gmail.com"]').isChecked() && !(await p.locator('.gcal-cal[value="feriados"]').isChecked()), "parten marcados los que ya ves en Google");
  await shot(p, "gcal-config");
  await p.click('[data-action="gcal-guardar"]'); await p.waitForTimeout(500);

  // Inicio, Semana, Calendario y apertura del día
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  const hoy = await p.locator('[data-tour="gcal"]').innerText().catch(() => "");
  ok(hoy.includes("Reunión con cliente") && hoy.includes("09:00") && !hoy.includes("Borrado") && !hoy.includes("Almuerzo"), "Inicio: los eventos de hoy (sin los cancelados)");
  await shot(p, "gcal-inicio");
  await p.goto(URL + "#semana"); await p.waitForTimeout(300);
  const martes = await p.locator(".week-col").nth(1).innerText();
  ok(martes.includes("Almuerzo con Ana") && martes.includes("13:00"), "Semana: cada evento en su día");
  await p.goto(URL + "#calendario"); await p.waitForTimeout(300);
  ok((await p.locator("#view").innerText()).includes("13:00 Almuerzo con Ana"), "Calendario: los eventos en el mes y en la agenda");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(200);
  await p.click('#view [data-action="day-open"]'); await p.waitForTimeout(300);
  ok((await p.locator("#modalBody").innerText()).includes("Reunión con cliente"), "al abrir el día ves tus eventos de hoy");
  await p.evaluate(() => closeModal());

  // Elegir otro calendario trae sus eventos
  await p.evaluate(() => openGcalConfig());
  await p.locator('.gcal-cal[value="feriados"]').check();
  await p.click('[data-action="gcal-guardar"]'); await p.waitForTimeout(600);
  ok(llamadas.some(x => x.includes("/calendars/feriados/events")), "al marcar Feriados, se traen sus eventos");
  const s = await p.evaluate(() => ({ g: STATE.settings.gcal, local: localStorage.getItem(gcalClave()) }));
  ok(s.g.conectado && s.g.calendarios.join() === "yo@gmail.com,feriados" && !JSON.stringify(s.g).includes("tok-") && !JSON.stringify(s.g).includes("Reunión"),
    "en la cuenta solo queda qué calendarios ver (ni permiso ni eventos)");
  ok(s.local.includes("Reunión con cliente") && s.local.includes("tok-"), "los eventos y el permiso quedan solo en este equipo");

  // Permiso vencido: los eventos siguen a la vista y aparece el botón para actualizar
  await p.evaluate(() => { const l = gcalLocal(); l.exp = Date.now() - 1000; gcalGuardarLocal(l); rerender(); });
  const vencido = await p.locator('[data-tour="gcal"]').innerText();
  ok(vencido.includes("Reunión con cliente") && vencido.includes("Actualizar eventos de Google"), "permiso vencido: se ven los últimos eventos y el botón 🔄");
  await p.click('[data-tour="gcal"] [data-action="gcal-actualizar"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__gisPrompt) === "" && await p.locator('[data-tour="gcal"] [data-action="gcal-actualizar"]').count() === 0, "🔄 renueva el permiso sin volver a pedir el consentimiento");

  // Desconectar
  await p.evaluate(() => openGcalConfig());
  await p.click('[data-action="gcal-desconectar"]'); await p.waitForTimeout(300);
  const d = await p.evaluate(() => ({ con: STATE.settings.gcal.conectado, local: localStorage.getItem(gcalClave()), rev: window.__revocado }));
  ok(!d.con && d.local === null && String(d.rev).startsWith("tok-") && await p.locator('[data-tour="gcal"]').count() === 0,
    "desconectar revoca el permiso, borra los eventos del equipo y los saca de Inicio");
  await ctx.close();
};
