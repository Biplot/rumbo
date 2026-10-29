/* Pruebas en navegador · Tienda › Cuarto: las cosas y las paredes para el cuarto del elefante.
   La ficha muestra cómo queda (foto del 3D), comprar la pone en el cuarto, guardar la saca,
   la pared se pinta, 🛍️ Decorar lleva a la Tienda y sin WebGL todo se compra igual */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(() => {
    localStorage.removeItem("rumbo-sin-escenas");   // aquí sí se ven las escenas
    ledgerRegistrar(STATE, "pts-test", 3000, 2500, "test"); recalcGamif(STATE); saveState();
  });
}
const enCuarto = p => p.evaluate(() => CIELO_ESTADO.motor && CIELO_ESTADO.motor.cuarto());
module.exports = async ({ b, ok, errs }) => {
  // 1) Con 3D, de noche
  {
    const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T21:30:00", w: 1280, h: 900 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
    await preparar(p, "cuarto@test.cl");
    await p.goto(URL + "#tienda"); await p.waitForTimeout(500);
    ok(await p.locator('.tienda-cat[data-id="cuarto"]').count() === 1 && await p.locator("#tienda-cuarto .ficha").count() === 11, "la Tienda tiene la sección Cuarto con 8 cosas y 3 paredes");
    ok(await p.locator('#tienda-cuarto .ficha[data-cua="par-noche"] .ficha__ico--pared').count() === 1, "las paredes se muestran con su color a rayas");
    // La ficha: una foto de cómo quedaría en el cuarto (aunque aún no sea tuya)
    await p.click('.ficha[data-cua="cua-lampara"]');
    await p.waitForSelector("#cuaVista.is-foto", { timeout: 20000 }).catch(() => {});
    ok(await p.locator("#cuaVista.is-foto .cua-vista__img").count() === 1 && (await p.locator(".cua-vista__pie").innerText()).includes("Así quedaría"), "la ficha muestra la foto de cómo quedaría en el cuarto");
    ok((await enCuarto(p)).cosas.includes("lampara") === false, "después de la foto, el cuarto vuelve a como está (sin la lámpara)");
    await shot(p, "cuarto-ficha");
    // Comprar: llega puesta
    await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(400);
    await p.waitForSelector("#cuaVista.is-foto", { timeout: 20000 }).catch(() => {});
    ok(await p.evaluate(() => isOwned("cua-lampara") && STATE.gamif.puntos === 2700) && (await p.locator("#modal .cua-card").innerText()).includes("En el cuarto — guardar"), "comprarla descuenta 300 ⭐ y queda puesta en el cuarto");
    ok((await p.locator('.ficha[data-cua="cua-lampara"] .ficha__p').innerText()) === "En el cuarto", "su ficha dice «En el cuarto»");
    // Ver el cuarto: de noche la lámpara alumbra
    await p.click('#modal [data-action="cuarto-ver"]');
    await p.waitForFunction(() => CURRENT === "recompensas" && document.querySelector("#casaLienzo .cielo__canvas"), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    const c1 = await enCuarto(p);
    ok(c1 && c1.cosas.includes("lampara") && c1.lampara > 1, "🏠 Ver el cuarto lleva a Progreso: la lámpara está y de noche alumbra");
    ok((await p.locator("#casaLienzo").getAttribute("aria-label")).includes("De la Tienda: lámpara de pie."), "el cuarto lo cuenta (para lectores de pantalla)");
    await shot(p, "cuarto-lampara-noche");
    // 🛍️ Decorar vuelve a la sección del cuarto en la Tienda
    await p.click('.casa-card [data-action="cuarto-decorar"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => CURRENT === "tienda") && await p.locator("#tienda-cuarto").isVisible(), "🛍️ Decorar lleva a la Tienda, a la sección Cuarto");
    // Guardarla y volver a ponerla
    await p.click('.ficha[data-cua="cua-lampara"]'); await p.waitForTimeout(300);
    await p.click('#modal [data-action="cos-equip"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !cuartoPuestas(STATE).includes("lampara") && STATE.gamif.equipped.cuarto.ts > 0) && (await p.locator('.ficha[data-cua="cua-lampara"] .ficha__p').innerText()) === "Guardada", "guardarla la saca del cuarto (sigue siendo tuya)");
    ok((await p.locator("#modal .cua-card").innerText()).includes("Poner en el cuarto"), "y la ficha ofrece ponerla de nuevo");
    await p.click('#modal [data-action="cos-equip"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => cuartoPuestas(STATE).includes("lampara")), "ponerla la devuelve a su rincón");
    await p.evaluate(() => closeModal());
    // La pared: la foto es del cuarto entero, con tu elefante; comprarla pinta el cuarto
    await p.click('.ficha[data-cua="par-noche"]');
    await p.waitForSelector("#cuaVista.is-foto", { timeout: 20000 }).catch(() => {});
    ok(await p.locator("#cuaVista .cua-vista__ele .ele-svg").count() === 1, "la foto de una pared es el cuarto entero, con tu elefante en la alfombra");
    await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => STATE.gamif.equipped.cuarto.pared === "par-noche" && cuartoPared(STATE)[0] === "#3A4766"), "comprar la pared la pinta de una vez");
    await p.evaluate(() => closeModal());
    await p.goto(URL + "#recompensas"); await p.waitForTimeout(900);
    ok((await enCuarto(p)).pared === "#3A4766,#33405D", "el cuarto queda azul noche");
    await shot(p, "cuarto-azul-noche");
    await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
    await p.click('.ficha[data-cua="par-noche"]'); await p.waitForTimeout(300);
    await p.click('#modal [data-action="cos-equip"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => cuartoPared(STATE) === null && isOwned("par-noche")), "«volver al gris» despinta (la pared sigue siendo tuya)");
    await ctx.close(); await b3.close();
  }

  // 2) Sin WebGL, en el celular: la ficha muestra el ícono y se compra igual
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
    await preparar(p, "cuarto-plano@test.cl");
    await p.goto(URL + "#tienda"); await p.waitForTimeout(500);
    await p.click('.tienda-cat[data-id="cuarto"]'); await p.waitForTimeout(300);
    await p.click('.ficha[data-cua="cua-gato"]'); await p.waitForTimeout(2500);
    ok(await p.locator("#cuaVista .cua-vista__ico").isVisible() && await p.locator("#cuaVista .cua-vista__img").count() === 0, "sin WebGL la ficha muestra el ícono grande (sin foto)");
    await shot(p, "cuarto-ficha-plana");
    await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => isOwned("cua-gato") && cuartoPuestas(STATE).join() === "gato"), "y se compra igual (el gato queda en el cuarto)");
    ok((await p.locator("#modal .cua-card").innerText()).includes("Es tuyo · está en el cuarto"), "la ficha habla del gato en masculino («Es tuyo»)");
    await ctx.close();
  }
};
