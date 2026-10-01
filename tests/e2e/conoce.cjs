/* Pruebas en navegador · Página de presentación (/conoce/) y entrada directa a "Crear cuenta" */
const { URL, nuevoContexto } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL + "conoce/index.html?utm_source=ig&utm_campaign=lanzamiento"); await p.waitForTimeout(300);
  ok((await p.locator("h1").innerText()).includes("Abre tu día"), "la página de presentación carga");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "en el celular no hay desplazamiento horizontal");
  const href = await p.locator("[data-cta]").first().getAttribute("href");
  ok(href.includes("crear=1") && href.includes("utm_source=ig") && href.includes("utm_campaign=lanzamiento"), "los botones conservan el origen del anuncio");
  const srcs = [...new Set(await p.evaluate(() => [...document.images].map(i => i.src)))];
  let rotas = 0; for (const s of srcs) if (!(await ctx.request.get(s)).ok()) rotas++;
  ok(rotas === 0, "todas las imágenes cargan");
  await p.click("[data-cta] >> nth=1"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById("form-register").hidden && document.getElementById("form-login").hidden), "'Empieza gratis' abre la app en Crear cuenta");
  await p.goto(URL); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById("form-register").hidden), "sin ?crear=1 la app abre en Ingresar, como siempre");
  await ctx.close();
};
