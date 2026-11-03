/* Pruebas en navegador · 🔒 Borrar con seguro (Cuenta › Zona sensible, zona.js): reiniciar pide escribir REINICIAR
   y tu contraseña (o un código a tu correo), dice lo que se borra, guarda una copia por 30 días que se recupera
   desde Cuenta, y lo borrado no vuelve desde otro equipo; 5 intentos fallidos hacen esperar; importar un respaldo
   se puede deshacer; cambiar la contraseña pide la actual; y eliminar la cuenta pide ELIMINAR y tu contraseña. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-03T16:10:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  let dialogos = 0; p.on("dialog", d => { dialogos++; d.dismiss(); });
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  const cuenta = async () => { await p.evaluate(() => { closeModal(); go("cuenta"); }); await p.waitForTimeout(600); };
  const lleno = () => p.evaluate(() => { STATE.vida.diario.push({ id: "d1", fecha: "2026-11-02", texto: "Un buen día" }, { id: "d2", fecha: "2026-11-03", texto: "Otro" });
    registrarMovimiento("prueba:zona", 500, 0, "Para probar"); saveState(); });
  await registrar(p, "zona@test.cl");
  await lleno();

  // 1) «Editar perfil» ya no tiene el botón de reiniciar: queda solo en Cuenta › Zona sensible
  await p.evaluate(() => openProfileModal()); await p.waitForTimeout(250);
  ok(await p.locator('#modal [data-action="reset-data"]').count() === 0, "«Editar perfil» ya no tiene «Reiniciar mis datos»");
  await cuenta();
  ok(await p.locator('.view [data-action="reset-data"]').count() === 1 && await p.locator('.view [data-action="acc-delete"]').count() === 1, "en Cuenta › Zona sensible siguen Reiniciar y Eliminar");

  // 2) La hoja: dice lo que se borra; el botón rojo se enciende con la palabra y la contraseña
  await p.click('.view [data-action="reset-data"]'); await p.waitForTimeout(400);
  const hoja = await p.locator("#modal").innerText();
  ok(/todos tus equipos/.test(hoja) && /2\s*entradas del diario/.test(hoja) && /500\s*⭐ para la Tienda|500\s*para la Tienda/.test(hoja) && /copia por 30 días/.test(hoja) && /Descargar mi respaldo/.test(hoja),
    "la hoja dice lo que se borra (2 entradas del diario, 500 ⭐), la copia de 30 días y el respaldo a un toque");
  ok(await p.isDisabled("#zona-ok"), "el botón rojo parte apagado");
  await p.fill("#zona-palabra", "reinicia"); await p.fill("#zona-clave", "secreto123");
  ok(await p.isDisabled("#zona-ok"), "con la palabra mal escrita sigue apagado");
  await p.fill("#zona-palabra", "reiniciar");
  ok(!(await p.isDisabled("#zona-ok")), "con REINICIAR (da igual mayúsculas) y la contraseña, se enciende");
  await shot(p, "zona-hoja");
  ok(await ancho() <= 390, "la hoja cabe en el celular");

  // 3) Contraseña equivocada: no se borra nada y cuenta los intentos
  await p.fill("#zona-clave", "otra-cosa"); await p.click("#zona-ok"); await p.waitForTimeout(400);
  ok(/No es tu contraseña\. No se borró nada\. Te quedan 4 intentos/.test(await p.locator("#zona-error").innerText()) && await p.evaluate(() => STATE.vida.diario.length) === 2,
    "con otra contraseña: «No es tu contraseña. No se borró nada» y quedan 4 intentos");

  // 4) Con tu contraseña se reinicia: todo vuelve a cero y queda marcado el reinicio
  await p.fill("#zona-clave", "secreto123"); await p.click("#zona-ok"); await p.waitForTimeout(900);
  const tras = await p.evaluate(() => ({ diario: STATE.vida.diario.length, puntos: STATE.gamif.puntos, motivo: STATE.reemplazo && STATE.reemplazo.motivo, nombre: STATE.profile.name, abierta: !document.getElementById("modalOverlay").hidden }));
  ok(tras.diario === 0 && tras.puntos === 0 && tras.motivo === "reinicio" && tras.nombre === "Prueba" && !tras.abierta, "con tu contraseña se reinicia: diario y ⭐ en cero, tu nombre se queda");
  ok(dialogos === 0, "sin ventanitas del navegador (confirm)");

  // 5) Lo borrado no vuelve desde otro equipo que tenía lo de antes
  const vuelve = await p.evaluate(() => { const viejo = JSON.parse(JSON.stringify(STATE)); delete viejo.reemplazo; viejo.vida.diario = [{ id: "d1", fecha: "2026-11-02", texto: "Un buen día" }];
    return [mergeStates(STATE, viejo).vida.diario.length, mergeStates(viejo, STATE).vida.diario.length]; });
  ok(vuelve[0] === 0 && vuelve[1] === 0, "al sincronizar con otro equipo que tenía lo de antes, lo borrado no vuelve");

  // 6) Cuenta: «Recuperar mis datos» por 30 días; al recuperar vuelve todo
  await cuenta();
  const resp = await p.locator("#acc-respaldos").innerText();
  ok(/Reiniciaste tus datos el 3 de noviembre a las 16:10 · quedan 30 días/.test(resp) && /Recuperar mis datos/.test(resp), "Cuenta: «Reiniciaste tus datos el 3 de noviembre · quedan 30 días» con «Recuperar mis datos»");
  await p.click('[data-action="zona-recuperar"]'); await p.waitForTimeout(400);
  ok(/Lo que hiciste desde entonces se reemplaza/.test(await p.locator("#modal").innerText()) && /2\s*entradas del diario/.test(await p.locator("#modal").innerText()), "antes de recuperar, la hoja dice qué vuelve");
  await p.click('[data-action="zona-recuperar-ok"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.vida.diario.length === 2 && STATE.gamif.puntos === 500 && STATE.reemplazo.motivo === "recuperacion"), "al recuperar vuelven el diario y tus 500 ⭐");
  await cuenta();
  ok((await p.locator("#acc-respaldos").innerText()).trim() === "", "y la copia ya usada se va de Cuenta");

  // 7) El código a tu correo (para quien entra con Google)
  await p.click('.view [data-action="reset-data"]'); await p.waitForTimeout(400);
  await p.click('#modal [data-action="zona-metodo"][data-v="codigo"]'); await p.waitForTimeout(200);
  ok(/zona@test\.cl/.test(await p.locator("#zona-verif").innerText()) && !(await p.isVisible("#zona-codigo")), "«Prefiero un código a mi correo» dice a qué correo llega");
  await p.click('#modal [data-action="zona-enviar"]'); await p.waitForTimeout(300);
  const codigo = await p.evaluate(() => localStorage.getItem("rumbo_codigo"));
  await p.fill("#zona-palabra", "REINICIAR"); await p.fill("#zona-codigo", "000000");
  if (codigo === "000000") await p.fill("#zona-codigo", "111111");
  await p.click("#zona-ok"); await p.waitForTimeout(400);
  ok(/Ese código no es o ya venció\. No se borró nada/.test(await p.locator("#zona-error").innerText()) && await p.evaluate(() => STATE.vida.diario.length) === 2, "un código equivocado no borra nada");
  await p.fill("#zona-codigo", codigo); await p.click("#zona-ok"); await p.waitForTimeout(900);
  ok(await p.evaluate(() => STATE.vida.diario.length === 0 && STATE.reemplazo.motivo === "reinicio"), "con el código que llegó, se reinicia");
  await p.evaluate(async () => { const c = await zonaCopias(); await zonaRecuperarAbrir({ id: c[0].id, donde: c[0].donde, motivo: c[0].motivo }); await zonaRecuperar(); });
  await p.waitForTimeout(300);

  // 8) 5 intentos equivocados: hay que esperar
  await cuenta(); await p.click('.view [data-action="reset-data"]'); await p.waitForTimeout(400);
  await p.fill("#zona-palabra", "REINICIAR");
  for (let i = 0; i < 5; i++) { await p.fill("#zona-clave", "mala" + i); await p.click("#zona-ok"); await p.waitForTimeout(250); }
  ok(/Te equivocaste 5 veces: espera 5 min/.test(await p.locator("#zona-error").innerText()), "al 5.º intento equivocado: hay que esperar 5 minutos");
  await p.fill("#zona-clave", "secreto123"); await p.click("#zona-ok"); await p.waitForTimeout(400);
  ok(/Espera 5 min/.test(await p.locator("#zona-error").innerText()) && await p.evaluate(() => STATE.vida.diario.length) === 2, "mientras tanto, ni con la contraseña buena se borra");
  await p.evaluate(() => localStorage.removeItem("rumbo_zona_" + CURRENT_USER.id));

  // 9) Importar un respaldo: se ve lo que trae y se puede deshacer
  await cuenta();
  const archivo = await p.evaluate(() => { const s = JSON.parse(JSON.stringify(STATE)); s.vida.diario = [{ id: "x1", fecha: "2026-01-01", texto: "Del respaldo" }]; return JSON.stringify(s); });
  await p.setInputFiles("#acc-file", { name: "rumbo-respaldo.json", mimeType: "application/json", buffer: Buffer.from(archivo) });
  await p.waitForTimeout(500);
  const imp = await p.locator("#modal").innerText();
  ok(/se reemplazan por los del archivo/.test(imp) && /1\s*entrada del diario/.test(imp) && /deshacer la importación/.test(imp), "importar: la hoja dice lo que trae el respaldo (1 entrada del diario) y que se puede deshacer");
  await p.click('[data-action="zona-importar-ok"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => STATE.vida.diario.length === 1 && STATE.vida.diario[0].texto === "Del respaldo"), "al reemplazar quedan los datos del respaldo");
  await cuenta();
  ok(/Importaste un respaldo/.test(await p.locator("#acc-respaldos").innerText()), "Cuenta ofrece «Deshacer la importación»");
  await p.click('[data-action="zona-recuperar"][data-motivo="importacion"]'); await p.waitForTimeout(400);
  await p.click('[data-action="zona-recuperar-ok"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.vida.diario.length) === 2, "deshacer la importación devuelve lo que tenías");

  // 10) Cambiar la contraseña pide la actual
  await cuenta();
  await p.waitForSelector("#cv-clave");
  await p.fill("#cv-clave", "no-es"); await p.fill("#acc-pass", "nueva456"); await p.click('[data-action="zona-cambiar-clave"]'); await p.waitForTimeout(400);
  ok(/No es tu contraseña\. No se cambió nada/.test(await p.locator("#cv-error").innerText()) && (await p.evaluate(() => BACKEND.verificarClave("secreto123"))).ok, "sin la contraseña actual correcta no se cambia");
  await p.fill("#cv-clave", "secreto123"); await p.click('[data-action="zona-cambiar-clave"]'); await p.waitForTimeout(400);
  ok((await p.evaluate(() => BACKEND.verificarClave("nueva456"))).ok, "con la actual, la contraseña cambia");

  // 11) Eliminar la cuenta: ELIMINAR y tu contraseña
  await p.click('.view [data-action="acc-delete"]'); await p.waitForTimeout(400);
  ok(/para siempre/.test(await p.locator("#modal").innerText()) && !/copia por 30 días/.test(await p.locator("#modal").innerText()), "eliminar: la hoja dice que es para siempre (sin copia)");
  await p.fill("#zona-palabra", "REINICIAR"); await p.fill("#zona-clave", "nueva456");
  ok(await p.isDisabled("#zona-ok"), "con REINICIAR no se enciende: hay que escribir ELIMINAR");
  await p.fill("#zona-palabra", "eliminar"); await p.click("#zona-ok"); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !document.getElementById("authScreen") || !document.getElementById("authScreen").hidden) && await p.evaluate(() => !localStorage.getItem("rumbo_state_" + Object.keys(JSON.parse(localStorage.getItem("rumbo_users") || "{}"))[0]) && !Object.values(JSON.parse(localStorage.getItem("rumbo_users") || "{}")).some(u => u.email === "zona@test.cl")),
    "con ELIMINAR y tu contraseña, la cuenta se elimina y vuelve la pantalla de entrar");
  await ctx.close();
};
