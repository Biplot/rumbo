/* ============================================================
   Rumbo · Utilidades de las pruebas en navegador (Playwright)
   Backend local (sin Supabase), reloj fijo y sin fuentes externas.
   ============================================================ */
let pw;
try { pw = require("playwright"); } catch (e) { pw = require("/opt/node22/lib/node_modules/playwright"); }
const path = require("path");
const URL = "http://localhost:5178/";
const SHOTS = process.env.E2E_SHOTS || "";   // carpeta para capturas (opcional)

async function nuevoContexto(browser, { w = 1360, h = 900, fecha = "2026-09-23T10:00:00", dpr = 1 } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: "", contentType: "text/css" }));
  await ctx.route("**/js/store.js*", async r => {
    const res = await r.fetch();
    r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: (await res.text()).replace("const BACKEND = SupabaseBackend;", "const BACKEND = LocalBackend;") });
  });
  await ctx.clock.setFixedTime(new Date(fecha));
  return ctx;
}
async function registrar(page, email) {
  await page.goto(URL);
  await page.click('[data-tab="register"]');
  await page.fill("#reg-name", "Prueba"); await page.fill("#reg-email", email); await page.fill("#reg-pass", "secreto123");
  await page.click('[data-action="auth-register"]');
  await page.waitForSelector("#app:not([hidden])"); await page.waitForTimeout(500);
  await page.evaluate(() => { STATE.settings.onboarded = true; STATE.settings.introVersion = 9; ONB_ACTIVE = false; closeModal(); saveState(); });
  await page.addStyleTag({ content: ".toast{display:none!important}" });
}
async function shot(page, nombre, op = {}) {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOTS, nombre + ".png"), ...op });
}
module.exports = { chromium: pw.chromium, URL, nuevoContexto, registrar, shot };
