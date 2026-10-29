/* Pruebas en navegador · Tu cielo y tu camino a pantalla completa: se entra desde sus tarjetas
   (⤢ o tocando el 3D), la hoja trae las medallas por familia o el año por trimestre, una constelación
   se mira desde la hoja, el año cambia en la barra, la medalla se abre encima y se vuelve con ‹ o Escape */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(() => {
    const ids = ["primer-paso", "semana-fuego", "explorador", "estratega", "mes-perfecto", "cazador-sapos", "buho", "devorador"];
    ids.forEach((id, i) => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 1, 1, "Insignia", new Date(2026, i, 5 + i, 21).getTime()); });
    cieloGuardarVisto(STATE.gamif.badges.slice()); saveState();
  });
}
const vista = p => p.evaluate(() => CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista());
module.exports = async ({ b, ok, errs }) => {
  const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  // 1) En el celular
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares@test.cl");
    // Tu cielo
    await p.goto(URL + "#insignias");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#cieloLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(500);
    ok(await p.locator('.cielo [data-action="lugar-entrar"][data-ruta="cielo"]').isVisible() && (await vista(p)).libre === false, "en Insignias el cielo es una tarjeta, con su botón para abrirlo");
    await p.click('.cielo [data-action="lugar-entrar"]');
    await p.waitForFunction(() => CURRENT === "cielo" && CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista().libre, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const v0 = await vista(p);
    ok(await p.evaluate(() => CURRENT === "cielo" && document.body.classList.contains("en-lugar")) && v0.modo === "cielo" && v0.libre && v0.enc.arriba > 40 && v0.enc.abajo > 100, "⤢ abre tu cielo de borde a borde, encuadrado sobre la hoja");
    ok((await p.locator("#lugarHoja .lugar__t, .lugar__t").first().innerText()).includes("8 de 56"), "la barra cuenta tus medallas encendidas");
    ok(await p.locator('#lugarHoja [data-action="cielo-mirar"]').count() === 6 && await p.locator('#lugarHoja .med-chip[data-action="ins-ver"]').count() === 56, "la hoja trae las 6 constelaciones y las 56 medallas por familia");
    await shot(p, "lugar-cielo-celular");
    await p.click('#lugarHoja [data-action="cielo-mirar"][data-id="foco"]'); await p.waitForTimeout(900);
    ok((await vista(p)).u.yaw < -0.3, "tocar El Elefante gira el cielo hacia esa constelación");
    // Una medalla de la hoja se abre de cerca, encima; al cerrarla seguimos en el cielo
    await p.click('[data-action="hoja-alternar"]'); await p.waitForTimeout(700);
    await p.click('#lugarHoja .med-chip[data-id="buho"]'); await p.waitForTimeout(600);
    ok(await p.locator("#insCerca").isVisible() && (await p.locator("#insCercaT").innerText()) === "Búho", "una medalla de la hoja se abre de cerca, encima del cielo");
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
    ok(await p.locator("#insCerca").isHidden() && await p.evaluate(() => CURRENT === "cielo") && (await vista(p)).libre, "al cerrarla sigues en tu cielo a pantalla completa");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => CURRENT === "insignias", null, { timeout: 5000 }).catch(() => {});
    ok(await p.evaluate(() => CURRENT === "insignias" && !document.body.classList.contains("en-lugar")), "Escape vuelve a Insignias");
    // Tu camino: se entra tocando la isla
    await p.goto(URL + "#tendencias");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#caminoLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(500);
    await p.locator(".camino-card").scrollIntoViewIfNeeded();
    const r = await p.locator("#caminoLienzo").boundingBox();
    await p.mouse.click(r.x + 14, r.y + 14);
    await p.waitForFunction(() => CURRENT === "camino" && CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista().libre, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const k0 = await vista(p);
    ok(await p.evaluate(() => CURRENT === "camino") && k0.modo === "camino" && k0.libre && k0.enc.abajo > 100, "tocar la isla abre tu camino a pantalla completa");
    ok((await p.locator(".lugar__anio").innerText()).replace(/\s+/g, " ").includes("2026") && (await p.locator("#lugarHoja .camino__tris").innerText()).replace(/\s+/g, " ").includes("T1 3 T2 3 T3 2 T4 0"), "el año va en la barra y los trimestres en la hoja");
    await shot(p, "lugar-camino-celular");
    // Un hito abre su medalla
    const q = await p.evaluate(() => CIELO_ESTADO.motor.dondeHito("mes-perfecto"));
    if (q) await p.mouse.click(q[0], q[1]);
    await p.waitForTimeout(600);
    ok((await p.locator("#insCercaT").innerText().catch(() => "")) === "Mes Perfecto", "tocar un hito abre su medalla de cerca");
    await p.keyboard.press("Escape"); await p.waitForTimeout(600);
    // La rueda acerca la isla
    await p.mouse.move(195, 300); await p.mouse.wheel(0, -400); await p.waitForTimeout(900);
    ok((await vista(p)).zoom < 0.9, "la rueda (o pellizcar) acerca la isla");
    // Otro año desde la barra, sin salir
    await p.click('.lugar__anio [data-dir="1"]'); await p.waitForTimeout(900);
    ok(await p.evaluate(() => CURRENT === "camino" && anioVista() === 2027) && (await p.locator(".lugar__t b").innerText()) === "Tu camino de 2027" && (await p.locator("#lugarHoja .hoja__t").innerText()).includes("aún no empieza"), "› en la barra muestra el camino de 2027 (aún por hacerse), sin salir de la pantalla completa");
    await p.click('#lugarHoja [data-action="anio-nav"][data-dir="0"]'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => anioVista() === 2026), "«Ir a 2026» vuelve al año actual");
    await p.click('[data-action="lugar-volver"]');
    await p.waitForFunction(() => CURRENT === "tendencias", null, { timeout: 5000 }).catch(() => {});
    ok(await p.evaluate(() => CURRENT === "tendencias"), "‹ vuelve a Tendencias");
    await ctx.close();
  }
  // 2) En el computador: el panel al costado
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 1280, h: 800 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares-esc@test.cl");
    for (const ruta of ["cielo", "camino"]) {
      await p.goto(URL + "#" + ruta);
      await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(800);
      const panel = await p.locator("#lugarHoja").boundingBox(), v = await vista(p);
      ok(panel && panel.width === 380 && v.modo === ruta && v.enc.der > 380 && v.enc.abajo === 0, `en el computador, tu ${ruta} usa la ventana y su hoja es un panel a la derecha`);
      await shot(p, "lugar-" + ruta + "-escritorio");
    }
    await ctx.close();
  }
  await b3.close();
  // 3) Sin WebGL: cada lugar vuelve a su tarjeta
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares-plano@test.cl");
    await p.goto(URL + "#cielo"); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => CURRENT === "insignias"), "sin WebGL, #cielo vuelve a Insignias");
    await p.goto(URL + "#camino"); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => CURRENT === "tendencias") && await p.locator(".camino-card.is-sin3d").count() === 1, "y #camino vuelve a Tendencias, con su lista");
    await ctx.close();
  }
};
