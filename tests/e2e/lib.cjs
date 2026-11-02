/* ============================================================
   Rumbo · Utilidades de las pruebas en navegador (Playwright)
   Backend local (sin Supabase), reloj fijo y sin fuentes externas.
   ============================================================ */
let pw;
try { pw = require("playwright"); } catch (e) { pw = require("/opt/node22/lib/node_modules/playwright"); }
const path = require("path");
const URL = process.env.E2E_URL || "http://localhost:5178/";   // E2E_URL: otro servidor (p. ej. otra copia del repo)
const SHOTS = process.env.E2E_SHOTS || "";   // carpeta para capturas (opcional)

async function nuevoContexto(browser, { w = 1360, h = 900, fecha = "2026-09-23T10:00:00", dpr = 1, ua } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...(ua ? { userAgent: ua } : {}) });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "", contentType: "text/css" }));
  // El consultorio de La Línea (biplot.cl): sin edición, salvo en la prueba que lo revisa (consultorio.cjs)
  await ctx.route("https://biplot.cl/diario/ultima.json", r => r.fulfill({ status: 200, contentType: "application/json", body: '{"edicion":null}' }));
  await ctx.route("**/js/store.js*", async r => {
    const res = await r.fetch();
    r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: (await res.text()).replace("const BACKEND = SupabaseBackend;", "const BACKEND = LocalBackend;") });
  });
  await ctx.clock.setFixedTime(new Date(fecha));
  return ctx;
}
/* Una cuenta como las de antes: sin pasar por la bienvenida, sin día de alta ni primera semana */
async function registrar(page, email) {
  await page.goto(URL);
  await page.click('[data-tab="register"]');
  await page.fill("#reg-name", "Prueba"); await page.fill("#reg-email", email); await page.fill("#reg-pass", "secreto123");
  await page.click('[data-action="auth-register"]');
  await page.waitForSelector("#app:not([hidden])"); await page.waitForTimeout(500);
  await page.evaluate(() => { try { localStorage.setItem("rumbo-sin-escenas", "1"); } catch (e) {} STATE.settings.onboarded = true; delete STATE.settings.alta; delete STATE.settings.bienvenida; STATE.settings.introVersion = INTRO_VERSION; STATE.agua.fab = false; STATE.gamif.equipped.ele = { tipo: "clasico", ropa: {}, ts: 1 }; STATE.settings.tutorial = { vistos: {}, mision: "oculta", auto: false, ts: 0 }; ONB_ACTIVE = false; closeModal(); saveState(); });
  await page.addStyleTag({ content: ".toast{display:none!important}" });
}
async function shot(page, nombre, op = {}) {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOTS, nombre + ".png"), ...op });
}
/* Amigos es un tablero (amigos-tablero.js): cada cosa se abre en su hoja. Abre la hoja k (planes, habitos,
   objetivos, listas, lecturas, amigos, ajustes, nuevo), si no está abierta, y en planes la pestaña; devuelve su texto */
async function hojaAmigos(page, k, tab) {
  if (!(await page.locator(`#modalOverlay:not([hidden]) #at-hoja[data-hoja="${k}"]`).count())) {
    await page.evaluate(() => closeModal());
    if (await page.evaluate(() => CURRENT) !== "amigos") { await page.goto(URL + "#amigos"); await page.waitForTimeout(700); }
    await page.click(`[data-action="am-hoja"][data-v="${k}"]`); await page.waitForTimeout(300);
  }
  if (tab) { await page.click(`[data-action="am-pestana"][data-v="${tab}"]`); await page.waitForTimeout(200); }
  return page.locator("#modal").innerText();
}
/* Elegir en una Lista (elegir.js): si es larga, abre su hoja; si no, toca la opción en la vista */
async function elegirEn(page, id, v) {
  const fila = page.locator(`[data-el="lista-fila"][data-el-id="${id}"]`);
  if (await fila.count()) {
    await fila.first().click(); await page.waitForTimeout(150);
    await page.click(`#elHoja [data-el="lista"] button[data-v="${v}"]`); await page.waitForTimeout(250);
  } else { await page.click(`[data-el="lista"][data-el-id="${id}"] > button[data-v="${v}"]`); await page.waitForTimeout(150); }
}
/* Los textos de las opciones de una Lista */
async function opcionesDe(page, id) {
  return page.evaluate(id => {
    const L = typeof EL_LISTAS !== "undefined" && EL_LISTAS[id];
    if (L && document.querySelector(`[data-el="lista-fila"][data-el-id="${id}"]`)) return L.ops.map(o => o.t);
    return [...document.querySelectorAll(`[data-el="lista"][data-el-id="${id}"] > button b`)].map(b => b.textContent);
  }, id);
}
/* El nombre de lo elegido en lo pendiente (> < @ ✕ ✓): va abajo de los signos */
async function triageElegido(fila) { return (await fila.locator(".tr-nombre").innerText()).trim(); }
module.exports = { chromium: pw.chromium, URL, nuevoContexto, registrar, shot, hojaAmigos, elegirEn, opcionesDe, triageElegido };
