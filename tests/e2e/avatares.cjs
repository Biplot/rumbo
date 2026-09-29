/* Pruebas en navegador · 🎭 Avatares: elegir, armar, comprar y ganar */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-29T11:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "avatares@test.cl");
  await p.evaluate(() => { ledgerRegistrar(STATE, "saldo-test", 1000, 0, "test"); saveState(); });

  // 1) Sin avatar se ve la inicial; Cuenta ofrece elegir
  await p.goto(URL + "#cuenta"); await p.waitForTimeout(400);
  ok(await p.locator("#accountBox .av-dibujo").count() === 0, "sin avatar elegido se ve la inicial");
  await p.click('[data-action="av-abrir"].btn'); await p.waitForTimeout(300);
  ok(await p.locator(".av-ficha").count() === 11 && !(await p.locator(".modal").innerText()).includes("Aby"), "el elenco muestra 11 avatares y no está Aby");
  ok(await p.locator('.av-ficha.is-no[data-id="lupe"]').count() === 1 && await p.locator('.av-ficha:not(.is-no)[data-id="plotty"]').count() === 1, "Lupe bloqueada; Plotty disponible");
  await shot(p, "avatares-elenco");

  // 2) Elegir Plotty: aparece en el menú
  await p.click('.av-ficha[data-id="plotty"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.avatar.id) === "plotty" && await p.locator("#accountBox .av-dibujo svg").count() === 1, "elegir Plotty lo pone en el menú");

  // 3) Un avatar que se gana: probarlo muestra su meta
  await p.click('.av-ficha[data-id="faro"]'); await p.waitForTimeout(250);
  ok((await p.locator(".vest-barra").innerText()).includes("30 días cerrados seguidos"), "tocar uno bloqueado muestra cómo se gana");

  // 4) Comprar un personaje de Rumbo
  await p.click('[data-action="av-tab"][data-v="rumbo"]'); await p.waitForTimeout(250);
  await p.click('.av-ficha[data-id="cohete"]'); await p.waitForTimeout(250);
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await p.click('[data-action="av-comprar"][data-id="cohete"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.avatar.id) === "cohete" && await p.evaluate(() => STATE.gamif.puntos) === antes - 300, "comprar el Cohete cobra 300 ⭐ y queda como avatar");

  // 5) Armar el tuyo
  await p.click('[data-action="av-tab"][data-v="propio"]'); await p.waitForTimeout(250);
  await p.click('[data-action="av-propio"][data-k="pelo"][data-v="rulos"]'); await p.waitForTimeout(200);
  await p.click('[data-action="av-propio"][data-k="lentes"][data-v="redondos"]'); await p.waitForTimeout(200);
  const pr = await p.evaluate(() => STATE.gamif.equipped.avatar);
  ok(pr.id === "propio" && pr.propio.pelo === "rulos" && pr.propio.lentes === "redondos", "armar el tuyo guarda peinado y lentes: " + JSON.stringify(pr.propio));
  await shot(p, "avatares-propio");

  // 6) Ganar un integrante: cambiar de tema desbloquea a Grilla
  await p.evaluate(() => { closeModal(); STATE.settings.theme = "sakura"; saveState(); rerender(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => avatarTiene("grilla")), "cambiar de tema desbloquea a Grilla");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok(await p.locator(".avatar-lg .av-dibujo svg").count() === 1, "Inicio muestra el avatar");
  await ctx.close();
};
