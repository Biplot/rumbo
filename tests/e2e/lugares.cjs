/* Pruebas en navegador · Tu vitrina a pantalla completa: se entra por la estrella de la barra de arriba,
   la hoja trae las medallas por familia (es la única lista), una constelación se mira desde la hoja,
   la rueda acerca el cielo, la medalla se abre encima y se vuelve con ‹ o Escape a donde estabas.
   El camino del año ya no existe: ni en Tendencias ni como pantalla */
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
/* Medallas y rótulos que se tapan entre sí (de lo que se ve en el lienzo; una medalla con su propio rótulo no cuenta) */
const choques = (p, w, h) => p.evaluate(([w, h]) => {
  const c = CIELO_ESTADO.motor.cajasCielo().filter(k => (k.x0 + k.x1) / 2 > 0 && (k.x0 + k.x1) / 2 < w && (k.y0 + k.y1) / 2 > 0 && (k.y0 + k.y1) / 2 < h), l = [];
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const a = c[i], b = c[j]; if (a.f === b.f && (a.tipo === "rotulo") !== (b.tipo === "rotulo")) continue;
    if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1) l.push(`${a.f}/${a.tipo} × ${b.f}/${b.tipo}`);
  }
  return l;
}, [w, h]);
module.exports = async ({ b, ok, errs }) => {
  const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  // 1) En el celular
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares@test.cl");
    // Tu vitrina, por la estrella de la barra de arriba (con cuántas medallas tienes)
    await p.goto(URL + "#semana"); await p.waitForTimeout(400);
    ok((await p.locator("#puertaVitrina").innerText()).trim() === "8", "la estrella de la barra de arriba cuenta tus 8 medallas");
    await p.click("#puertaVitrina");
    await p.waitForFunction(() => CURRENT === "cielo" && CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista().libre, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const v0 = await vista(p);
    ok(await p.evaluate(() => CURRENT === "cielo" && document.body.classList.contains("en-lugar")) && v0.modo === "cielo" && v0.libre && v0.enc.arriba > 40 && v0.enc.abajo > 100, "la estrella abre tu vitrina de borde a borde, encuadrada sobre la hoja");
    ok((await p.locator(".lugar__t b").innerText()) === "Tu vitrina" && (await p.locator(".lugar__t").innerText()).includes("8 de 58"), "la barra dice Tu vitrina y cuenta tus medallas encendidas");
    ok(await p.locator('#lugarHoja [data-action="cielo-mirar"]').count() === 6 && await p.locator('#lugarHoja .med-chip[data-action="ins-ver"]').count() === 58, "la hoja trae las 6 constelaciones y las 58 medallas por familia");
    await shot(p, "lugar-cielo-celular");
    await p.click('#lugarHoja [data-action="cielo-mirar"][data-id="foco"]'); await p.waitForTimeout(900);
    ok((await vista(p)).u.yaw < -0.3, "tocar El Elefante gira el cielo hacia esa constelación");
    // Ninguna medalla tapa a otra (ni a un rótulo), mire hacia donde mire
    const tapan = [];
    for (const f of ["rachas", "hitos", "foco", "rituales", "habitos", "vida"]) { await p.evaluate(f => CIELO_ESTADO.motor.mirarFamilia(f), f); await p.waitForTimeout(700); tapan.push(...await choques(p, 390, 844)); }
    ok(tapan.length === 0, "en el celular, ninguna medalla ni rótulo se tapa con otro: " + (tapan.join(", ") || "ninguno"));
    await p.mouse.move(195, 300); await p.mouse.wheel(0, -400); await p.waitForTimeout(900);
    ok((await vista(p)).zoom < 0.9, "la rueda (o pellizcar) acerca el cielo");
    // Una medalla de la hoja se abre de cerca, encima; al cerrarla seguimos en el cielo
    await p.click('[data-action="hoja-alternar"]'); await p.waitForTimeout(700);
    await p.evaluate(() => { guardarRepisa(STATE, []); saveState(); });   // repisa elegida y vacía: la medalla todavía no está
    await p.click('#lugarHoja .med-chip[data-id="buho"]'); await p.waitForTimeout(600);
    ok(await p.locator("#insCerca").isVisible() && (await p.locator("#insCercaT").innerText()) === "Búho", "una medalla de la hoja se abre de cerca, encima del cielo");
    ok(await p.locator('#insCerca [data-action="badge-destacar"]').count() === 0 && (await p.locator('#insCerca [data-action="repisa-medalla"]').innerText()).includes("Poner en tu repisa"), "en vez de «Destacar», la medalla se pone en tu repisa");
    await p.click('#insCerca [data-action="repisa-medalla"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => repisaIds(STATE)[0] === "buho" && insigniaDestacada().id === "buho") && (await p.locator('#insCerca [data-action="repisa-medalla"]').innerText()).includes("En tu repisa"),
      "queda primera en tu repisa (y es la que luces en tu perfil)");
    await p.keyboard.press("Escape"); await p.waitForTimeout(700);
    ok(await p.locator("#insCerca").isHidden() && await p.evaluate(() => CURRENT === "cielo") && (await vista(p)).libre, "al cerrarla sigues en tu vitrina a pantalla completa");
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => CURRENT === "semana", null, { timeout: 5000 }).catch(() => {});
    ok(await p.evaluate(() => CURRENT === "semana" && !document.body.classList.contains("en-lugar")), "Escape vuelve a donde estabas");
    // Los enlaces viejos a Insignias llegan a Tu vitrina
    await p.goto(URL + "#insignias"); await p.waitForTimeout(800);
    ok(await p.evaluate(() => CURRENT === "cielo" && location.hash === "#cielo"), "#insignias (el enlace de antes) abre Tu vitrina");
    await p.evaluate(() => lugarVolver()); await p.waitForTimeout(600);
    // El camino del año ya no está: ni en Tendencias ni como pantalla
    await p.goto(URL + "#tendencias"); await p.waitForTimeout(600);
    ok(await p.locator(".camino-card, #camino").count() === 0, "Tendencias ya no tiene el camino del año");
    await p.goto(URL + "#camino"); await p.waitForTimeout(600);
    ok(await p.evaluate(() => CURRENT !== "camino" && !document.body.classList.contains("en-lugar")), "y #camino ya no es una pantalla");
    await ctx.close();
  }
  // 2) En el computador: el panel al costado
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 1280, h: 800 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares-esc@test.cl");
    await p.goto(URL + "#cielo");
    await p.waitForFunction(() => CIELO_ESTADO.motor && document.querySelector("#lugarLienzo .cielo__canvas"), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(800);
    const panel = await p.locator("#lugarHoja").boundingBox(), v = await vista(p);
    ok(panel && panel.width === 380 && v.modo === "cielo" && v.enc.der > 380 && v.enc.abajo === 0, "en el computador, tu vitrina usa la ventana y su hoja es un panel a la derecha");
    const tapan = await choques(p, 1280, 800);
    ok(tapan.length === 0, "y ahí tampoco se tapan las medallas: " + (tapan.join(", ") || "ninguna"));
    await shot(p, "lugar-cielo-escritorio");
    await ctx.close();
  }
  await b3.close();
  // 3) Sin WebGL: vuelve a su tarjeta
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "lugares-plano@test.cl");
    await p.goto(URL + "#cielo"); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => CURRENT === "cielo" && !document.body.classList.contains("en-lugar")) && await p.locator('.lugar-plano .med-chip[data-action="ins-ver"]').count() === 58,
      "sin WebGL, #cielo es una página con la lista de las 58 medallas por constelación");
    await p.click('.lugar-plano .med-chip[data-id="buho"]'); await p.waitForTimeout(500);
    ok(await p.locator("#insCerca").isVisible() && (await p.locator("#insCercaT").innerText()) === "Búho", "y cada una se abre de cerca");
    await ctx.close();
  }
};
