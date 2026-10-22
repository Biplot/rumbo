/* Pruebas en navegador · El consultorio de La Línea: el consejo de la semana en Inicio, con tu elefante */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const EDICION = { edicion: { numero: 1, fecha: "2026-10-26", url: "/diario/2026-10-26/", consultorio: { titulo: "Un bocado a la vez", texto: "Antes de abrir el correo este lunes, escribe las tres cosas que harían que la semana valga la pena." } } };
module.exports = async ({ b, ok, errs }) => {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const ctx = await nuevoContexto(b, { w, h });
    let respuesta = JSON.stringify(EDICION);
    await ctx.route("https://biplot.cl/diario/ultima.json", r => r.fulfill({ status: 200, contentType: "application/json", body: respuesta }));
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await registrar(p, `consultorio${w}@test.cl`);
    await p.goto(URL + "#inicio"); await p.waitForTimeout(600);
    const c = p.locator(".consultorio");
    const txt = await c.innerText().catch(() => "");
    ok(await c.count() === 1 && txt.includes("N.º 1") && txt.includes("Un bocado a la vez") && txt.includes("las tres cosas"), `${w} px: Inicio muestra el consejo de El consultorio de La Línea N.º 1`);
    ok(await c.locator(".ele-svg").count() === 1, `${w} px: con el elefante del usuario`);
    ok(await c.locator('a[href="https://biplot.cl/diario/2026-10-26/#consultorio"][target="_blank"]').count() === 1, `${w} px: «Leer La Línea» abre la edición en su consultorio`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w} px: sin desplazamiento horizontal`);
    await shot(p, `consultorio-${w}`);
    await p.click('[data-action="consultorio-cerrar"]'); await p.waitForTimeout(300);
    ok(await p.locator(".consultorio").count() === 0, `${w} px: «Listo, lo leí» lo cierra`);
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    ok(await p.locator(".consultorio").count() === 0, `${w} px: cerrado, no vuelve con el mismo número`);
    // Con el número siguiente vuelve; con algo que no es una edición, no sale nada
    respuesta = JSON.stringify({ edicion: { ...EDICION.edicion, numero: 2 } });
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    ok((await p.locator(".consultorio").innerText().catch(() => "")).includes("N.º 2"), `${w} px: vuelve con el número siguiente`);
    respuesta = JSON.stringify({ edicion: { numero: 3, url: "javascript:alert(1)", consultorio: { texto: "<img src=x onerror=alert(1)>" } } });
    await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800);
    ok(await p.locator(".consultorio").count() === 0, `${w} px: lo que no es una edición válida no se muestra`);
    await ctx.close();
  }
};
