/* Pruebas en navegador · 🎭 Avatares: la manada, elegir, armar (con fondo), comprar y ganar */
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
  const txt = await p.locator(".modal").innerText();
  ok(await p.locator(".av-ficha").count() === 11 && (await p.locator('[data-action="av-tab"].is-active').innerText()).includes("La manada"), "se abre en La manada, con sus 11 avatares");
  ok(["Zorra", "Castor", "Hormiga", "Abeja", "Camaleón", "Tortuga", "Tamandúa", "Llama", "Ardilla", "Cóndor", "Pudú"].every(n => txt.includes(n)) && !/Lupe|Plotty|Architect|Aby/.test(txt), "los nombres de la manada, sin los del elenco de antes");
  ok(await p.locator(".av-placa").count() === 0, "sin placas");
  ok(await p.locator('.av-ficha.is-no[data-id="lupe"]').count() === 1 && await p.locator('.av-ficha:not(.is-no)[data-id="plotty"]').count() === 1 && await p.locator('.av-ficha:not(.is-no)[data-id="atlas"]').count() === 1, "la Zorra se gana; el Pudú y el Cóndor vienen de regalo");
  await shot(p, "avatares-manada");

  // 2) Elegir el Pudú: aparece en el menú
  await p.click('.av-ficha[data-id="plotty"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => STATE.gamif.equipped.avatar.id) === "plotty" && await p.locator("#accountBox .av-dibujo svg").count() === 1, "elegir el Pudú lo pone en el menú");

  // 3) Un avatar que se gana: probarlo muestra su meta
  await p.click('.av-ficha[data-id="faro"]'); await p.waitForTimeout(250);
  ok((await p.locator(".vest-barra").innerText()).includes("30 días cerrados seguidos"), "tocar uno bloqueado muestra cómo se gana");

  // 4) Comprar un símbolo de Rumbo; «Tu elefante» muestra su cara completa
  await p.click('[data-action="av-tab"][data-v="rumbo"]'); await p.waitForTimeout(250);
  const ele = await p.evaluate(() => { const s = document.querySelector('.av-ficha[data-id="elefante"] svg svg'); return s && { w: s.getAttribute("width"), vb: s.getAttribute("viewBox") }; });
  ok(ele && ele.w === "96" && ele.vb !== "0 0 260 240", "«Tu elefante» muestra la cara de tu elefante, centrada: " + JSON.stringify(ele));
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
  ok(pr.propio.fondo === "indigo" && await p.locator('[data-action="av-propio"][data-k="fondo"]').count() === 7 && await p.locator('[data-k="fondo"][data-v="indigo"].is-on').count() === 1, "el fondo parte en índigo suave, con 7 para elegir");
  await p.click('[data-action="av-propio"][data-k="fondo"][data-v="ambar"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => STATE.gamif.equipped.avatar.propio.fondo) === "ambar" && (await p.locator("#accountBox .av-dibujo").innerHTML()).includes("#FCE6BF"), "elegir el fondo ámbar se ve en el menú");
  await shot(p, "avatares-propio");

  // 5b) Lo que se armó con los colores de antes se ve con su par nuevo y queda marcado en el creador
  await p.evaluate(() => { STATE.gamif.equipped.avatar = { id: "propio", propio: { piel: "#9C6444", pelo: "moño", colPelo: "#B33A2E", lentes: "no", barba: "no", ropa: "#FF6B4A", animo: "feliz" }, ts: Date.now() }; saveState(); renderAccountBox(); openAvatar("propio"); });
  await p.waitForTimeout(250);
  const html = await p.locator("#accountBox .av-dibujo").innerHTML();
  ok(html.includes("#B07650") && html.includes("#A8432F") && html.includes("#F4AE3D") && !html.includes("#9C6444"), "el avatar de antes se dibuja con los colores nuevos");
  ok(await p.locator('[data-k="piel"][data-v="#B07650"].is-on').count() === 1 && await p.locator('[data-k="ropa"][data-v="#F4AE3D"].is-on').count() === 1, "el creador marca el color nuevo que le toca");
  await p.click('[data-action="av-propio"][data-k="lentes"][data-v="sol"]'); await p.waitForTimeout(200);
  const pv = await p.evaluate(() => STATE.gamif.equipped.avatar.propio);
  ok(pv.piel === "#B07650" && pv.ropa === "#F4AE3D" && pv.lentes === "sol" && pv.fondo === "indigo", "al cambiar algo, lo de antes se guarda ya con la paleta nueva: " + JSON.stringify(pv));
  await p.evaluate(() => { closeModal(); openAvatar("elenco"); }); await p.waitForTimeout(200);
  ok((await p.locator('[data-action="av-tab"].is-active').innerText()).includes("La manada"), "la pestaña de antes (elenco) abre La manada");

  // 5c) Marcos con la paleta de Norte: Índigo (antes Cian) y Aurora
  await p.evaluate(() => { closeModal(); ["mar-cian", "mar-aurora"].forEach(id => STATE.gamif.owned.push(id)); STATE.gamif.equipped.marco = "cian"; saveState(); renderAccountBox(); });
  const fondoMarco = () => p.evaluate(() => getComputedStyle(document.querySelector("#accountBox .account__avatar"), "::before").backgroundImage);
  ok((await fondoMarco()).includes("rgb(57, 73, 201)") && await p.evaluate(() => COSMETICOS.find(c => c.id === "mar-cian").nombre) === "Marco Índigo", "el marco Cian pasa a Índigo");
  await p.evaluate(() => { STATE.gamif.equipped.marco = "aurora"; renderAccountBox(); });
  const au = await fondoMarco();
  ok(au.includes("rgb(57, 73, 201)") && au.includes("rgb(244, 174, 61)") && !au.includes("rgb(23, 195, 178)"), "Aurora toma los colores de Norte");

  // 6) Ganar uno de la manada: cambiar de tema desbloquea al Camaleón
  await p.evaluate(() => { closeModal(); STATE.settings.theme = "sakura"; saveState(); rerender(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => avatarTiene("grilla")), "cambiar de tema desbloquea al Camaleón");
  await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
  ok(await p.locator(".avatar-lg .av-dibujo svg").count() === 1, "Inicio muestra el avatar");
  await ctx.close();
};
