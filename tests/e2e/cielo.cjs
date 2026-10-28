/* Pruebas en navegador · El cielo de insignias: medallas en constelaciones, tocarlas para verlas de cerca,
   la ficha (fecha, niveles, secretas, destacar) y la versión sin WebGL (lista + medalla plana) */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const GANADAS = ["primer-paso", "semana-fuego", "inquebrantable", "alba-b", "buho"];
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(ids => {
    const t0 = new Date(2026, 8, 1, 21, 0).getTime();
    ids.forEach((id, i) => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 10, 10, "Insignia", t0 + i * 86400000); });
    localStorage.setItem("rumbo-cielo-visto", JSON.stringify(ids.filter(x => x !== "inquebrantable")));   // una llega como medalla nueva
    saveState();
  }, GANADAS);
}
const titulo = p => p.locator("#insCercaT").innerText();
module.exports = async ({ b, ok, errs }) => {
  // 1) Con 3D (WebGL por software, como en un computador sin GPU)
  {
    const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T21:00:00", w: 1280, h: 860 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "cielo@test.cl");
    await p.goto(URL + "#insignias");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#cieloLienzo .cielo__canvas"), null, { timeout: 15000 });
    ok(await p.locator("#cielo:not(.is-sin3d)").isVisible(), "Insignias muestra el cielo en 3D arriba de la lista");
    ok((await p.locator(".cielo__s").innerText()).startsWith("5 de 56 medallas"), "el cielo cuenta las medallas encendidas (5 de 56)");
    ok(await p.locator(".badge-card").count() >= 40 && (await p.locator("body").innerText()).includes("Búho"), "la lista de insignias sigue debajo");
    await p.waitForTimeout(4200);   // la medalla nueva llega como estrella fugaz
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo-cielo-visto")).includes("inquebrantable")), "la medalla nueva queda vista después de llegar");
    await shot(p, "cielo-escritorio");

    // Tocar una medalla en el cielo la abre de cerca
    const pt = await p.evaluate(() => { const q = CIELO_ESTADO.motor.donde("primer-paso"), r = document.getElementById("cieloLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
    ok(!!pt, "Primer Paso tiene su lugar en La Copa");
    if (pt) await p.mouse.click(pt.x, pt.y);
    await p.waitForSelector("#insCerca:not([hidden])", { timeout: 4000 }).catch(() => {});
    ok(await titulo(p).catch(() => "") === "Primer Paso", "tocar la medalla abre su vista de cerca");
    const ficha = await p.locator("#insCercaFicha").innerText();
    ok(ficha.includes("Ganada el 1 sep 2026") && ficha.includes("La Copa") && ficha.includes("3 de 4"), "la ficha dice cuándo se ganó y cuánto lleva su constelación");
    ok(await p.locator("#insCercaLienzo .cielo__canvas").count() === 1, "la medalla se ve en 3D (el lienzo pasa a la vista de cerca)");
    await p.click('#insCerca [data-c="voltear"]'); await p.waitForTimeout(900);
    await shot(p, "cielo-cerca");
    await p.click('#insCerca [data-c="sig"]'); await p.waitForTimeout(500);
    ok(await titulo(p) === "Semana de Fuego", "la flecha › pasa a la siguiente de su constelación");
    await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(400);
    ok(await titulo(p) === "Primer Paso", "← vuelve a la anterior");
    // Destacar desde la ficha
    await p.click('#insCerca [data-action="badge-destacar"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => STATE.gamif.equipped.insignia === "primer-paso") && (await p.locator("#insCercaFicha").innerText()).includes("★ Destacada"), "Destacar funciona desde la ficha y ella se actualiza");
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    ok(await p.locator("#insCerca").isHidden() && await p.locator("#cieloLienzo .cielo__canvas").count() === 1, "Esc cierra y el cielo vuelve a su lugar");

    // Desde la lista: una serie con sus niveles
    await p.click('.badge-card[data-id="alba-b"]'); await p.waitForTimeout(500);
    ok(await titulo(p) === "Alba" && await p.locator(".ins-cerca__niveles button").count() === 3, "la tarjeta de una serie abre su medalla con bronce, plata y oro");
    await p.click('.ins-cerca__niveles [data-id="alba-p"]'); await p.waitForTimeout(400);
    ok(await titulo(p) === "Alba · Plata" && (await p.locator("#insCercaFicha").innerText()).includes("0 de 30 veces"), "elegir Plata muestra ese nivel y cuánto falta (0 de 30)");
    await p.click('#insCerca [data-c="cerrar"]'); await p.waitForTimeout(300);
    // Una secreta sin ganar no se revela
    await p.click('.badge-card[data-id="aniversario"]'); await p.waitForTimeout(400);
    const sec = await p.locator("#insCercaFicha").innerText();
    ok(await titulo(p) === "Insignia secreta" && !sec.includes("Aniversario") && !sec.includes("un año"), "una secreta sin ganar se abre sin contar cuál es");
    await p.click('#insCerca [data-c="cerrar"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => location.hash) === "#insignias", "cerrar la ficha no cambia de pantalla");

    // Al salir de Insignias el cielo se pausa y al volver se cuelga de nuevo
    await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
    await p.goto(URL + "#insignias"); await p.waitForTimeout(800);
    ok(await p.locator("#cieloLienzo .cielo__canvas").count() === 1, "al volver a Insignias el cielo está ahí (sin crear otro)");
    await ctx.close(); await b3.close();
  }

  // 2) Sin WebGL, en el celular: queda la lista y la ficha con una medalla plana
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T21:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "cielo-plano@test.cl");
    await p.goto(URL + "#insignias"); await p.waitForTimeout(2500);
    ok(await p.locator("#cielo").isHidden() && await p.locator(".badge-card").first().isVisible(), "sin WebGL el cielo se esconde y queda la lista");
    await p.click('.badge-card[data-id="semana-fuego"]'); await p.waitForTimeout(400);
    ok(await titulo(p) === "Semana de Fuego" && await p.locator("#insCercaPlano .ins-plano--bronce").isVisible(), "la ficha se abre con una medalla plana de bronce");
    ok(await p.locator('#insCerca [data-c="voltear"]').count() === 0, "sin 3D no ofrece dar vuelta la medalla");
    await shot(p, "cielo-plano-celular");
    await p.goBack(); await p.waitForTimeout(400);
    ok(await p.locator("#insCerca").isHidden() && await p.evaluate(() => location.hash) === "#insignias", "el botón atrás del celular cierra la ficha y se queda en Insignias");
    await ctx.close();
  }
};
