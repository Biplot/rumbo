/* ============================================================
   RUMBO · Teaser — sesión de captura
   Levanta el servidor de render, abre un navegador con la app
   real, crea la cuenta de demo y le siembra sus datos.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const { start } = require("./server.js");
const { applyShims } = require("./setup.js");

const SEED_SRC = fs.readFileSync(path.join(__dirname, "..", "seed.js"), "utf8");
const DEMO = { name: "Chris", email: "chris@rumbo.demo", password: "rumbo2026" };

async function openSession({ viewport, clock }) {
  const { server, base } = await start();
  const browser = await chromium.launch({ args: ["--hide-scrollbars", "--font-render-hinting=none", "--disable-lcd-text"] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "es-CL", timezoneId: "America/Santiago" });
  await applyShims(context);
  /* Sólo el frame de la app vive en la hora del guion. La página del
     estudio conserva el reloj real: lo necesita para sus propias esperas. */
  await context.addInitScript(c => {
    if (!location.pathname.startsWith("/teaser/")) window.__vnow = c;
  }, clock);

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => { errors.push(e.message); console.error("  [app]", e.message); });

  /* Cuenta y datos de demo: se entra a la app sin recargar, para que
     el estado quede escrito antes de que el estudio la cargue. */
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof BACKEND !== "undefined");
  await page.evaluate(async d => {
    let u = await BACKEND.getSession();
    if (!u) { u = await BACKEND.register(d); if (u.error) throw new Error(u.error); }
    await enterApp(u);
  }, DEMO);
  await page.waitForFunction(() => typeof STATE !== "undefined" && STATE !== null);

  const resumen = await page.evaluate(async src => {
    eval(src);
    const r = window.__rumboSeed();
    await BACKEND.saveState(CURRENT_USER.id, STATE);   // deja el estado listo para el estudio
    return r;
  }, SEED_SRC);

  /* La cuenta nace vacía, así que la app lanza su tutorial y el toast de
     insignias. Ya sembrada, no corresponden: se cierran antes de grabar. */
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (typeof closeModal === "function") closeModal();
    const t = document.getElementById("toast"); if (t) { t.hidden = true; t.textContent = ""; }
    rerender();
  });

  return { browser, context, page, base, server, errors, resumen, close: async () => { await browser.close(); server.close(); } };
}

module.exports = { openSession, DEMO };
