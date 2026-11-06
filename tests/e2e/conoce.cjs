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
  // Modo día y noche: sigue al teléfono, el botón lo cambia y lo recuerda, y las capturas cambian con él
  const tema = () => p.evaluate(() => [document.documentElement.dataset.tema, document.querySelector(".hero img").getAttribute("src")]);
  await p.emulateMedia({ colorScheme: "light" }); await p.reload(); await p.waitForTimeout(300);
  let [t, img] = await tema();
  ok(t === "dia" && img === "img/dia/inicio.jpg", "con el teléfono en modo claro abre de día, con las capturas de Norte");
  await p.click("#temaBtn"); await p.waitForTimeout(200);
  [t, img] = await tema();
  ok(t === "noche" && img === "img/inicio.jpg" && await p.getAttribute("#temaBtn", "aria-label") === "Cambiar a modo día", "el botón de la barra cambia a noche, con sus capturas");
  await p.reload(); await p.waitForTimeout(300);
  ok((await tema())[0] === "noche", "lo elegido se recuerda al volver");
  let faltan = 0; for (const f of ["inicio", "habitos", "semana", "notas", "calendario", "recompensas", "diario"]) for (const c of ["img/", "img/dia/"]) if (!(await ctx.request.get(URL + "conoce/" + c + f + ".jpg")).ok()) faltan++;
  ok(faltan === 0, "las capturas de día y de noche están todas");
  // El agua: la portilla se abre, el vaso suma 250 ml y la botella medio litro; se puede deshacer
  await p.click(".agua__btn"); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.getElementById("agua").classList.contains("abierta")), "el botón de agua abre la portilla");
  await p.click(".agua__tomar"); await p.click(".agua__tomar"); await p.click(".agua__bot"); await p.waitForTimeout(150);
  ok((await p.locator("[data-agua-cifra]").innerText()).startsWith("1 L") && (await p.locator("[data-agua-texto]").innerText()).includes("4 de 8 vasos"), "dos vasos y una botella son 1 L, 4 de 8 vasos");
  await p.click('[data-agua="deshacer"]'); await p.waitForTimeout(100);
  ok((await p.locator("[data-agua-cifra]").innerText()).startsWith("500 ml"), "Deshacer quita lo último");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => !document.getElementById("agua").classList.contains("abierta")), "Escape cierra la portilla");
  await p.reload(); await p.waitForTimeout(300);
  ok((await p.locator("[data-agua-cifra]").innerText()).startsWith("500 ml"), "lo que tomaste hoy se recuerda al volver");
  // La hoja de bullet journal se toca: el primer bocado pasa a hecho y vuelve a su signo
  const signo = () => p.evaluate(() => document.querySelectorAll("#hoja li")[1].querySelector(".s").textContent);
  await p.click("#hoja li >> nth=1");
  ok(await signo() === "✓" && await p.evaluate(() => document.querySelectorAll("#hoja li")[1].classList.contains("h-hecha")), "tocar el primer bocado lo marca hecho (✓)");
  await p.click("#hoja li >> nth=1");
  ok(await signo() === ">" && (await p.locator("#hoja li >> nth=1").innerText()).includes("→ mañana"), "otro toque lo pasa a mañana (>)");
  // Las etapas del elefante se tocan
  await p.click(".etapa >> nth=2");
  ok((await p.locator("#etapaPista").innerText()).startsWith("Sabio") && await p.getAttribute(".etapa >> nth=2", "aria-pressed") === "true", "tocar Sabio cuenta cómo es y cuándo llega");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "con todo lo nuevo, sigue sin desplazamiento horizontal");
  await p.click("[data-cta] >> nth=1"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.getElementById("form-register").hidden && document.getElementById("form-login").hidden), "'Empieza gratis' abre la app en Crear cuenta");
  await p.goto(URL); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.getElementById("form-register").hidden), "en un equipo donde nunca se entró, la app abre en Crear cuenta aunque no traiga ?crear=1");
  await p.evaluate(() => localStorage.setItem("rumbo_state_alguien", "{}"));   // alguien ya entró en este equipo
  await p.goto(URL); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.getElementById("form-register").hidden), "en un equipo donde ya se entró, sin ?crear=1 abre en Ingresar, como siempre");
  await ctx.close();
};
