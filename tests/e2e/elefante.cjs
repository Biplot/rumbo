/* Pruebas en navegador · 🐘 Tu elefante vectorial: elegir, vestir, probar, desbloquear y compartir */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T20:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "elefante@test.cl");

  // 1) Usuario de la v61 con accesorios: al abrir, elige su elefante; la bufanda sigue puesta
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 2000, 1000, "test");
    ledgerComprar(STATE, "acc-bufanda", 200);
    delete STATE.gamif.equipped.ele; STATE.gamif.equipped.acc = ["acc-bufanda"];
    STATE = migrate(STATE); saveState();
  });
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(1200);
  ok((await p.locator("#modalBody").innerText().catch(() => "")).includes("Clásico") && await p.locator('[data-action="ele-tipo"]').count() === 2, "al abrir, pide elegir entre Clásico y Asiático");
  ok((await p.locator("#modalBody").innerText()).includes("Joven"), "parte en la etapa que ya ganó (Joven)");
  await shot(p, "elefante-elegir");
  await p.click('[data-action="ele-tipo"][data-id="asiatico"]'); await p.waitForTimeout(300);
  const e = await p.evaluate(() => ({ tipo: STATE.gamif.equipped.ele.tipo, cuello: STATE.gamif.equipped.ele.ropa.cuello }));
  ok(e.tipo === "asiatico" && e.cuello === "bufanda", "queda el Asiático y conserva la bufanda: " + JSON.stringify(e));
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
  ok(await p.locator('[data-action="ele-tipo"]').count() === 0, "no vuelve a preguntar");

  // 2) Inicio muestra el elefante vectorial junto al saludo
  ok(await p.locator(".ele-hero .ele-svg").count() === 1, "Inicio muestra el elefante dibujado junto al saludo");

  // 3) Probador: probarse una prenda sin comprarla y después comprarla (desde Recompensas)
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(400);
  await p.click('.ele-card [data-action="elefante-open"][data-v="ropa"]'); await p.waitForTimeout(250);
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('[data-action="ele-probar"][data-id="jockey"]'); await p.waitForTimeout(250);
  ok(await p.locator(".vest-barra.is-compra").isVisible() && await p.locator(".vest-ficha.is-prueba").count() === 1 && await p.evaluate(() => STATE.gamif.equipped.ele.ropa.cabeza) == null, "probarse el jockey no lo compra ni lo guarda");
  await shot(p, "elefante-probador");
  await p.click('[data-action="ele-comprar"][data-id="jockey"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ cabeza: STATE.gamif.equipped.ele.ropa.cabeza, pts: STATE.gamif.puntos }));
  ok(c.cabeza === "jockey" && c.pts === antes - 200, "al comprarlo queda puesto y cobra 200 ⭐");
  await p.click('[data-action="ele-espacio"][data-slot="cuello"]'); await p.waitForTimeout(200);
  ok(await p.locator(".vest-ficha").count() === 3, "el espacio Cuello muestra sus 3 prendas");
  await p.click('[data-action="ele-probar"][data-id="bufanda"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.ropa.cuello) == null, "una prenda que ya tienes se saca con un toque");

  // 4) Tipos: bloqueados con su avance; al cumplir la meta se desbloquea y se puede elegir
  await p.click('.modal [data-action="elefante-open"][data-v="tipo"]'); await p.waitForTimeout(250);
  ok(await p.locator(".ele-tipo.is-lock").count() === 4, "Mamut, Peluche, Geométrico y Tinta aparecen bloqueados con su meta");
  await p.evaluate(() => { closeModal(); for (let i = 1; i <= 30; i++) STATE.ritual.dias[`2026-08-${String(i).padStart(2, "0")}`] = { hecho: true, cerrado: true }; saveState(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(500);
  ok(await p.evaluate(() => tipoDesbloqueado("peluche")), "una racha de 30 días desbloquea el Peluche");
  await p.click('.ele-card [data-action="elefante-open"][data-v="tipo"]'); await p.waitForTimeout(250);
  await p.click('[data-action="ele-tipo"][data-id="peluche"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.tipo === "peluche" && STATE.gamif.equipped.ele.ropa.cabeza === "jockey"), "cambiar de tipo es gratis y conserva la ropa");
  await shot(p, "elefante-recompensas");

  // 5) Animaciones: tocarlo, cerrar el día, crecer y desbloquear
  await p.evaluate(() => { localStorage.removeItem("rumbo-sin-escenas"); closeModal(); });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  const reac = [];
  for (let k = 0; k < 3; k++) { await p.click(".ele-hero"); await p.waitForTimeout(120); reac.push(await p.evaluate(() => document.querySelector(".ele-hero .ele-svg").getAttribute("class"))); await p.waitForTimeout(1100); }
  ok(reac[0].includes("re-salta") && reac[1].includes("re-saluda") && reac[2].includes("re-corazones"), "al tocarlo salta, saluda y le salen corazones: " + reac.join(" | "));
  await p.evaluate(() => { STATE.ritual.dias["2026-09-28"] = { hecho: true, mision: "x" }; saveState(); openCierreModal("2026-09-28"); });
  await p.waitForTimeout(300); await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(400);
  ok(await p.locator("#eleEscena.is-cierre").isVisible(), "al cerrar el día aparece tu elefante feliz");
  await shot(p, "elefante-cierre");
  await p.waitForTimeout(3300);
  ok(await p.locator("#eleEscena").count() === 0, "la escena del cierre se va sola");
  await p.evaluate(() => { ledgerRegistrar(STATE, "xp-test", 0, 4000, "test"); saveState(); rerender(); });
  await p.waitForTimeout(800);
  ok((await p.locator("#eleEscena.is-crece").innerText().catch(() => "")).includes("Adulto"), "al subir de etapa: ¡Tu elefante creció! Ahora es Adulto");
  await shot(p, "elefante-crece");
  await p.click('#eleEscena [data-cerrar]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.etapaVista) === 2 && await p.locator("#eleEscena").count() === 0, "la etapa queda vista y no se repite");
  await p.evaluate(() => { for (let i = 1; i <= 30; i++) STATE.vida.diario.push({ id: "gr" + i, fecha: `2026-07-${String(i).padStart(2, "0")}`, gratitud: "Gracias" }); saveState(); rerender(); });
  await p.waitForTimeout(800);
  ok(await p.locator('#eleEscena.is-nuevo [data-action="ele-tipo"][data-id="tinta"]').isVisible(), "al desbloquear Tinta aparece su presentación con Elegirlo");
  await shot(p, "elefante-nuevo");
  await p.click('#eleEscena [data-action="ele-tipo"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.tipo) === "tinta", "Elegirlo lo deja como tu elefante");

  // 5) Cuenta dueña: todo desbloqueado para revisar (tipos, ropa ganada, funciones y cosméticos)
  await p.evaluate(() => { closeModal(); OWNER_HASHES.push(_hash(CURRENT_USER.email.trim().toLowerCase())); grantOwnerPerks(); saveState(); rerender(); });
  const d = await p.evaluate(() => ({ mamut: tipoDesbloqueado("mamut"), geometrico: !tipoDesbloqueado("geometrico"), corona: !tienePrenda(prendaElefante("corona")),
    medalla: !tienePrenda(prendaElefante("medalla")), ropa: PRENDAS_ELEFANTE.filter(x => !x.gana).every(x => tienePrenda(x)), enfoque: funcion("enfoque"),
    marco: isOwned("mar-aurora"), diamante: !isOwned("mar-diamante"), titulo: isOwned("tit-lector") }));
  ok(Object.values(d).every(Boolean), "la cuenta dueña tiene todo lo que se compra y el Mamut, pero no lo que se gana: " + JSON.stringify(d));

  // 5) La imagen para compartir lleva tu elefante
  await p.evaluate(() => openInformeMes("2026-09")); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!INFORME_ELE), "la imagen del mes incluye tu elefante");
  await ctx.close();
};
