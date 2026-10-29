/* Pruebas en navegador · Tu cuarto a pantalla completa: se entra por la puerta de la barra de arriba (la cara de
   tu elefante), llena la pantalla sin barras, la hoja sube y el cuarto se encuadra encima, tu elefante en 3D
   lleva su ropa y reacciona, Decorar abre su catálogo ahí mismo, ‹ o Escape vuelven; en escritorio la hoja es
   un panel; sin WebGL, tu casa es una página con su hoja */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "xp-test", 3000, 4500, "test");   // Adulto
    ["primer-paso", "semana-fuego"].forEach((id, i) => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 1, 1, "Insignia", new Date(2026, 8, 1 + i, 21).getTime()); });
    ledgerComprar(STATE, "acc-gorro", 150); ledgerComprar(STATE, "cua-gato", 900); recalcGamif(STATE);
    eleTocar().ropa = { cabeza: "gorro" }; saveState();
  });
}
const cuarto = p => p.evaluate(() => CIELO_ESTADO.motor && CIELO_ESTADO.motor.cuarto());
module.exports = async ({ b, ok, errs }) => {
  const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  // 1) En el celular
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T19:10:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugar@test.cl");
    await p.goto(URL + "#habitos"); await p.waitForTimeout(400);
    ok(await p.locator("#puertaCasa").isVisible() && await p.locator("#puertaCara .ele-svg").count() === 1, "la cara de tu elefante está en la barra de arriba, también fuera de Inicio");
    await p.click("#puertaCasa");
    await p.waitForFunction(() => CURRENT === "cuarto" && CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const lugar = await p.locator("#lugar").boundingBox();
    ok(await p.evaluate(() => CURRENT === "cuarto" && document.body.classList.contains("en-lugar")) && lugar && lugar.width === 390 && lugar.height === 844, "la puerta abre tu cuarto de borde a borde");
    ok(await p.locator("#bottombar").isHidden() && await p.locator(".topbar").isHidden(), "sin la barra de arriba ni la de abajo");
    const c0 = await cuarto(p);
    ok(c0.libre && c0.vista.arriba > 40 && c0.vista.abajo > 100, "el cuarto se encuadra entre la barra flotante y la hoja");
    ok(c0.elefante && c0.elefante.tipo === "clasico" && c0.elefante.etapa === 2 && c0.elefante.ropa.cabeza === "gorro", "tu elefante en 3D: Clásico adulto, con su gorro");
    ok((await p.locator("#lugarHoja .hoja__t").innerText()).includes("Clásico · Adulto") && await p.locator('#lugarHoja [data-action="elefante-open"][data-v="ropa"]').isVisible(), "la hoja asomada trae la ficha y los botones");
    await shot(p, "lugar-celular");
    // Tocar al elefante: reacciona
    const q = await p.evaluate(() => CIELO_ESTADO.motor.dondeElefante());
    if (q) await p.mouse.click(q[0], q[1]);
    await p.waitForTimeout(120);
    ok((await cuarto(p)).reaccion, "tocar al elefante lo hace reaccionar");
    await p.waitForTimeout(1400);
    // La hoja sube: el cuarto se corre hacia arriba
    await p.click('[data-action="hoja-alternar"]'); await p.waitForTimeout(1200);
    const c1 = await cuarto(p);
    ok(await p.locator("#lugarHoja").getAttribute("data-estado") === "media" && c1.vista.abajo > c0.vista.abajo + 100, "subir la hoja deja ver la repisa y corre el cuarto hacia arriba");
    ok(await p.locator('#lugarHoja .med-chip[data-id="primer-paso"]').isVisible(), "a media altura se ve tu repisa");
    await shot(p, "lugar-celular-media");
    // Arrastrar mira el cuarto desde otro lado
    await p.mouse.move(200, 300); await p.mouse.down(); await p.mouse.move(120, 300, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(800);
    ok(Math.abs((await cuarto(p)).vista.yaw - c1.vista.yaw) > 0.1, "arrastrar gira el cuarto");
    // Vestir desde la hoja: el cambio se ve en el 3D y la hoja se queda donde estaba
    await p.click('#lugarHoja [data-action="elefante-open"][data-v="ropa"]'); await p.waitForTimeout(400);
    ok(await p.locator("#modalOverlay").isVisible() && (await p.locator("#modalTitle").innerText()).includes("Tu elefante"), "👕 Vestir abre el probador encima del cuarto");
    await p.evaluate(() => quitarEspacio("cabeza")); await p.evaluate(() => closeModal()); await p.waitForTimeout(700);
    const c2 = await cuarto(p);
    ok(c2.elefante && !c2.elefante.ropa.cabeza && await p.evaluate(() => CURRENT === "cuarto") && await p.locator("#lugarHoja").getAttribute("data-estado") === "media", "al sacarle el gorro, el elefante 3D cambia y la hoja sigue a media altura");
    // Decorar: el catálogo del cuarto se abre ahí mismo; una ficha muestra cómo queda y vuelve con ‹ Decorar
    await p.click('#lugarHoja [data-action="cuarto-decorar"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => CURRENT === "cuarto") && (await p.locator("#modalTitle").innerText()) === "Decorar tu cuarto" && await p.locator("#modal .ficha[data-cua]").count() === 11,
      "🛍️ Decorar abre el catálogo del cuarto (11 cosas) sin salir de tu casa");
    await p.click('#modal .ficha[data-cua="cua-gato"]'); await p.waitForTimeout(300);
    ok(await p.locator('#modal [data-action="cuarto-decorar"]').isVisible() && await p.locator('#modal .cua-vista').count() === 1, "la ficha del gato muestra cómo queda, con ‹ Decorar para volver");
    await p.evaluate(() => closeModal()); await p.waitForTimeout(300);
    // Escape vuelve a donde estabas (Hábitos), con sus barras
    await p.keyboard.press("Escape"); await p.waitForTimeout(800);
    ok(await p.evaluate(() => CURRENT === "habitos" && !document.body.classList.contains("en-lugar")) && await p.locator("#bottombar").isVisible(), "Escape vuelve a donde estabas, con su barra de abajo");
    await ctx.close();
  }
  // 2) En el computador: la hoja es un panel al costado y el cuarto se encuadra a su izquierda
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T21:30:00", w: 1280, h: 800 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugar-esc@test.cl");
    await p.goto(URL + "#cuarto");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(900);
    const panel = await p.locator("#lugarHoja").boundingBox(), c = await cuarto(p);
    ok(panel && panel.width === 380 && panel.x > 850 && c.vista.der > 380 && c.vista.abajo === 0, "en el computador la ficha es un panel a la derecha y el cuarto usa el resto de la ventana");
    await shot(p, "lugar-escritorio");
    await ctx.close();
  }
  await b3.close();
  // 3) Sin WebGL: tu casa es una página con tu elefante dibujado y lo de su hoja
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugar-plano@test.cl");
    await p.goto(URL + "#cuarto"); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => CURRENT === "cuarto" && !document.body.classList.contains("en-lugar")) && await p.locator(".lugar-plano .ele-svg").isVisible()
      && await p.locator('.lugar-plano [data-action="elefante-open"][data-v="ropa"]').isVisible() && await p.locator("#bottombar").isVisible(),
      "sin WebGL, #cuarto es una página con tu elefante, sus botones y la barra de abajo");
    await ctx.close();
  }
};
