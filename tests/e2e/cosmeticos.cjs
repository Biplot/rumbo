/* Pruebas en navegador · Tienda: cosméticos (celebraciones, checks, sonidos, marcos, plantillas para compartir) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T10:00:00", w: 1280, h: 860 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await registrar(p, "cosmeticos@test.cl");
  await p.evaluate(() => {
    ledgerRegistrar(STATE, "saldo-test", 6000, 0, "test");
    STATE.ritual.dias["2026-09-28"] = { hecho: true, mision: "x", sapo: "Bocado" };
    nuevaTarea(STATE, "2026-09-28", { txt: "Bocado", ambito: "pro", esSapo: true });
    const t = nuevaTarea(STATE, "2026-09-28", { txt: "Vieja", ambito: "per" }); t.migraciones = 3;
    saveState();
  });

  await p.goto(URL + "#tienda"); await p.waitForTimeout(400);
  ok(await p.evaluate(() => new Set([...document.querySelectorAll("[data-cos]")].map(e => e.dataset.cos)).size) === 15, "la Tienda muestra los 15 cosméticos nuevos");
  // Cada ficha abre su detalle con el botón de compra
  const enFicha = async (id, accion) => { await p.click(`.ficha[data-cos="${id}"]`); await p.waitForTimeout(150);
    const n = await p.locator(`#modal [data-action="${accion}"]`).count(); if (n) { await p.click(`#modal [data-action="${accion}"]`); await p.waitForTimeout(150); }
    await p.evaluate(() => closeModal()); return n; };
  for (const id of ["cel-estrellas", "cel-elefante", "chk-sello", "snd-pack", "mar-llama", "pla-cuaderno"]) await enFicha(id, "cos-buy");
  ok(await p.evaluate(() => ["cel-estrellas", "chk-sello", "mar-llama", "pla-cuaderno"].every(isOwned)), "compra celebraciones, check, marco y plantilla");
  ok(await enFicha("mar-diamante", "cos-buy") === 0 && await p.locator('.ficha.is-bloqueado[data-cos="mar-diamante"]').count() === 1, "el marco Diamante no se compra (rango Élite)");
  await enFicha("chk-sello", "cos-equip"); await enFicha("mar-llama", "cos-equip");
  ok(await p.evaluate(() => document.documentElement.dataset.check) === "sello", "el estilo de check se aplica");
  ok(await p.locator("#accountBox .account__avatar.marco--llama").count() === 1, "el marco se ve en el avatar");
  await shot(p, "tienda-cosmeticos", { fullPage: true });

  // Completar el bocado → lluvia de estrellas; tarea postergada 3 veces → elefante
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  await p.click('.tarea-row.is-bocado [data-action="tarea-toggle"]'); await p.waitForTimeout(150);
  ok(await p.locator(".fx-estrella").count() > 0, "al completar el primer bocado cae una lluvia de estrellas");
  ok(await p.locator(".tarea-row.is-hecha .strike").count() >= 1, "la tarea hecha muestra el sello");
  const vieja = await p.evaluate(() => tareasDelDia("2026-09-28").find(t => t.txt === "Vieja").id);
  await p.click(`.tarea-row [data-action="tarea-toggle"][data-id="${vieja}"]`); await p.waitForTimeout(150);
  ok(await p.locator(".fx-elefante").count() === 1, "al domar una tarea postergada cruza el elefante");
  await shot(p, "inicio-cosmeticos");

  // Apagar una celebración
  await p.evaluate(() => { equipItem("cel-estrellas"); });
  ok(await p.evaluate(() => !cosActivo("cel-estrellas")), "una celebración se puede apagar");

  // Plantilla Cuaderno en "Comparte tu mes"
  await p.evaluate(() => openInformeMes("2026-09")); await p.waitForTimeout(800);
  ok(await p.locator('.modal button.chip:has-text("Cuaderno")').count() === 1, "la plantilla comprada aparece al compartir");
  await p.click('.modal button.chip:has-text("Cuaderno")'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => INFORME_OP.plantilla === "cuaderno" && STATE.gamif.equipped.plantilla === "cuaderno"), "elige la plantilla y la recuerda");
  await shot(p, "informe-cuaderno");
  await ctx.close();
};
