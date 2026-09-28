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

  // 2) Inicio muestra el elefante vectorial
  ok(await p.locator(".ele-card .ele-svg").count() >= 1, "Inicio muestra el elefante dibujado");

  // 3) Probador: probarse una prenda sin comprarla y después comprarla
  await p.click('.ele-card [data-action="elefante-open"][data-v="ropa"]'); await p.waitForTimeout(250);
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('[data-action="ele-probar"][data-id="jockey"]'); await p.waitForTimeout(250);
  ok(await p.locator(".ele-prueba").isVisible() && await p.evaluate(() => STATE.gamif.equipped.ele.ropa.cabeza) == null, "probarse el jockey no lo compra ni lo guarda");
  await shot(p, "elefante-probador");
  await p.click('[data-action="ele-comprar"][data-id="jockey"]'); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ cabeza: STATE.gamif.equipped.ele.ropa.cabeza, pts: STATE.gamif.puntos }));
  ok(c.cabeza === "jockey" && c.pts === antes - 200, "al comprarlo queda puesto y cobra 200 ⭐");
  await p.click('[data-action="ele-probar"][data-id="bufanda"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.ropa.cuello) == null, "una prenda que ya tienes se saca con un toque");

  // 4) Tipos: bloqueados con su avance; al cumplir la meta se desbloquea y se puede elegir
  await p.click('.modal [data-action="elefante-open"][data-v="tipo"]'); await p.waitForTimeout(250);
  ok(await p.locator(".ele-tipo.is-lock").count() === 4, "Mamut, Peluche, Geométrico y Tinta aparecen bloqueados con su meta");
  await p.evaluate(() => { closeModal(); for (let i = 1; i <= 30; i++) STATE.ritual.dias[`2026-08-${String(i).padStart(2, "0")}`] = { hecho: true, cerrado: true }; saveState(); });
  await p.goto(URL + "#recompensas"); await p.waitForTimeout(500);
  ok(await p.evaluate(() => tipoDesbloqueado("peluche")), "una racha de 30 días desbloquea el Peluche");
  await p.click('.ele-card [data-action="elefante-open"][data-v="tipo"]'); await p.waitForTimeout(250);
  await p.click('[data-action="ele-tipo"][data-id="peluche"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.ele.tipo === "peluche" && STATE.gamif.equipped.ele.ropa.cabeza === "jockey"), "cambiar de tipo es gratis y conserva la ropa");
  await shot(p, "elefante-recompensas");

  // 5) La imagen para compartir lleva tu elefante
  await p.evaluate(() => openInformeMes("2026-09")); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!INFORME_ELE), "la imagen del mes incluye tu elefante");
  await ctx.close();
};
