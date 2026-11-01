/* Pruebas en navegador · Tu vitrina, el único lugar de tus medallas: el cielo con sus constelaciones, tocarlas
   para verlas de cerca, la ficha (fecha, niveles, secretas, poner en tu repisa), la lista en la hoja del cielo
   y la versión sin WebGL (la misma lista como página + medalla plana) */
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
    await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
    ok(await p.locator("#puertaNuevo").isVisible(), "con una medalla que el cielo no te mostró, la estrella de arriba lleva un punto");
    await p.goto(URL + "#cielo");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 15000 });
    ok((await p.locator(".lugar__t small").innerText()).startsWith("5 de 58 medallas"), "Tu vitrina cuenta las medallas encendidas (5 de 58)");
    ok(await p.locator("#lugarHoja .med-chip").count() === 58 && (await p.locator("#lugarHoja").innerText()).includes("Búho"), "la lista de las 58 está en la hoja del cielo, por constelación");
    await p.waitForTimeout(4200);   // la medalla nueva llega como estrella fugaz
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("rumbo-cielo-visto")).includes("inquebrantable")) && await p.evaluate(() => document.getElementById("puertaNuevo").hidden), "la medalla nueva queda vista después de llegar (y la estrella de arriba apaga su punto)");
    await shot(p, "cielo-escritorio");

    // Tocar una medalla en el cielo la abre de cerca
    const pt = await p.evaluate(() => { const q = CIELO_ESTADO.motor.donde("primer-paso"), r = document.getElementById("lugarLienzo").getBoundingClientRect(); return q && { x: r.left + q[0], y: r.top + q[1] }; });
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
    // Ponerla en tu repisa desde la ficha (reemplaza a «Destacar»). En automático ya está en la repisa: sacarla la deja elegida por ti
    ok((await p.locator('#insCerca [data-action="repisa-medalla"]').innerText()).includes("En tu repisa"), "con la repisa en automático, la ficha dice que ya está en tu repisa");
    await p.click('#insCerca [data-action="repisa-medalla"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !repisaIds(STATE).includes("primer-paso") && repisaElegida(STATE)) && (await p.locator("#insCercaFicha").innerText()).includes("Poner en tu repisa"), "sacarla la quita (y la repisa pasa a ser elegida por ti)");
    await p.click('#insCerca [data-action="repisa-medalla"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => repisaIds(STATE)[0] === "primer-paso" && repisaElegida(STATE)) && (await p.locator("#insCercaFicha").innerText()).includes("En tu repisa"), "«Poner en tu repisa» funciona desde la ficha y ella se actualiza");
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    ok(await p.locator("#insCerca").isHidden() && await p.locator("#lugarLienzo .cielo__canvas").count() === 1 && await p.evaluate(() => CURRENT === "cielo"), "Esc cierra y el cielo vuelve a su lugar");

    // Desde la lista de la hoja: una serie con sus niveles
    await p.click('#lugarHoja .med-chip[data-id="alba-b"]'); await p.waitForTimeout(500);
    ok(await titulo(p) === "Alba" && await p.locator(".ins-cerca__niveles button").count() === 3, "la tarjeta de una serie abre su medalla con bronce, plata y oro");
    await p.click('.ins-cerca__niveles [data-id="alba-p"]'); await p.waitForTimeout(400);
    ok(await titulo(p) === "Alba · Plata" && (await p.locator("#insCercaFicha").innerText()).includes("0 de 30 veces"), "elegir Plata muestra ese nivel y cuánto falta (0 de 30)");
    await p.click('#insCerca [data-c="cerrar"]'); await p.waitForTimeout(300);
    // Una secreta sin ganar no se revela
    await p.click('#lugarHoja .med-chip[data-id="aniversario"]'); await p.waitForTimeout(400);
    const sec = await p.locator("#insCercaFicha").innerText();
    ok(await titulo(p) === "Insignia secreta" && !sec.includes("Aniversario") && !sec.includes("un año"), "una secreta sin ganar se abre sin contar cuál es");
    await p.click('#insCerca [data-c="cerrar"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => location.hash) === "#cielo", "cerrar la ficha no cambia de pantalla");

    // Al salir de Tu vitrina el cielo se pausa y al volver se cuelga de nuevo
    await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
    await p.goto(URL + "#cielo"); await p.waitForTimeout(800);
    ok(await p.locator("#lugarLienzo .cielo__canvas").count() === 1, "al volver a Tu vitrina el cielo está ahí (sin crear otro)");
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
    await p.goto(URL + "#cielo"); await p.waitForTimeout(2500);
    ok(await p.locator("#lugarLienzo").count() === 0 && await p.locator(".lugar-plano .med-chip").first().isVisible(), "sin WebGL no hay cielo: Tu vitrina es la lista");
    await p.click('.lugar-plano .med-chip[data-id="semana-fuego"]'); await p.waitForTimeout(400);
    ok(await titulo(p) === "Semana de Fuego" && await p.locator("#insCercaPlano .ins-plano--bronce").isVisible(), "la ficha se abre con una medalla plana de bronce");
    ok(await p.locator('#insCerca [data-c="voltear"]').count() === 0, "sin 3D no ofrece dar vuelta la medalla");
    await shot(p, "cielo-plano-celular");
    await p.goBack(); await p.waitForTimeout(400);
    ok(await p.locator("#insCerca").isHidden() && await p.evaluate(() => location.hash) === "#cielo", "el botón atrás del celular cierra la ficha y se queda en Tu vitrina");
    await ctx.close();
  }
};
