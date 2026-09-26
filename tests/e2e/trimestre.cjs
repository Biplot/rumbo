/* Pruebas en navegador · Revisión trimestral (cierre Q4 2026 → apertura Q1 2027) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-12-28T20:00:00", w: 390, h: 844, dpr: 2 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "tri@test.cl");
  await p.evaluate(() => {
    STATE.settings.year = 2026;
    STATE.metas.trimestres[3] = [{ id: "t1", texto: "Conseguir 10 clientes", done: false, ts: 1 }, { id: "t2", texto: "Correr 10K", done: false, ts: 1 }];
    STATE.ritual.meses = { "2026-10": { cierre: { nota: 8, ts: 1 } } };
    STATE.ritual.dias["2026-12-20"] = { hecho: true, cerrado: true, ts: 1 };
    saveState(); rerender();
  });
  await p.goto(URL + "#inicio"); await p.waitForTimeout(300);
  ok(await p.locator(".hero-focus", { hasText: "Tu revisión trimestral" }).count() === 1, "fin de diciembre: Inicio ofrece la revisión trimestral");
  await p.click('.hero-focus [data-action="tri-ritual"]'); await p.waitForTimeout(200);
  await p.locator('.seg', { has: p.locator('#tc-e-t1') }).locator('button[data-v="cumplido"]').click().catch(async () => {
    await p.locator('.mes-obj', { hasText: "Conseguir 10 clientes" }).locator('button[data-v="cumplido"]').click(); });
  await p.click('[data-action="triw-next"]'); await p.waitForTimeout(120);
  ok((await p.locator("#modalBody").innerText()).includes("metas del trimestre"), "muestra los números del trimestre");
  await p.click('[data-action="triw-next"]'); await p.waitForTimeout(120);
  await p.fill("#tc-logro", "Llegamos a 10 clientes"); await p.fill("#tc-cambiar", "Entrenar temprano");
  await p.click('[data-action="triw-next"]'); await p.waitForTimeout(120);
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: el asistente cabe en pantalla");
  await shot(p, "tri-cierre");
  await p.click('[data-action="triw-finish"]'); await p.waitForTimeout(300);
  let s = await p.evaluate(() => STATE);
  ok(s.ritual.trimestres["2026-Q4"].cierre.logro === "Llegamos a 10 clientes" && s.metas.trimestres[3][0].done === true, "cierre guardado y la meta cumplida queda marcada");
  ok(s.gamif.ledger.some(m => m.id === "ritual-tri-cierre:2026-Q4" && m.delta === 200) && s.gamif.badges.includes("estratega"), "+200 ⭐ e insignia Estratega");
  ok(s.vida.diario.some(e => e.fromRitualTri && e.trimestre === "2026-Q4"), "el cierre queda en el Diario");
  // Se encadena la apertura del 1.er trimestre de 2027 (en Foco)
  ok((await p.locator("#modalTitle").innerText()).includes("1.er trimestre 2027"), "sigue con la apertura del 1.er trimestre 2027");
  ok((await p.locator("#modalBody").innerText()).includes("Entrenar temprano"), "muestra lo que anotaste para cambiar");
  await p.fill("#ta-foco", "Crecer");
  await p.click('[data-action="triw-next"]'); await p.waitForTimeout(120);
  await p.fill("#ta-m-0", "20 clientes"); await p.fill("#ta-m-1", "Lanzar la app");
  await p.locator('.ta-arr[value="t2"]').check();
  await p.click('[data-action="triw-finish"]'); await p.waitForTimeout(300);
  s = await p.evaluate(() => STATE);
  const q1 = s.anios[2027].metas.trimestres[0];
  ok(q1.some(o => o.texto === "20 clientes") && q1.some(o => o.arrastrado === "t2") && s.ritual.trimestres["2027-Q1"].apertura.foco === "Crecer", "metas del 1.er trimestre 2027 (con la arrastrada) y foco guardados");
  await p.goto(URL + "#ritual"); await p.waitForTimeout(200);
  await p.click('[data-action="ritual-view"][data-v="trimestre"]'); await p.waitForTimeout(250);
  const vista = await p.locator("#view").innerText();
  ok(/4\.º trimestre 2026/i.test(vista) && vista.includes("20 clientes") === false && vista.includes("Conseguir 10 clientes"), "Ritual → Trimestre muestra el trimestre actual y sus metas");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: Ritual → Trimestre cabe en pantalla");
  await shot(p, "tri-vista", { fullPage: true });
  await ctx.close();
};
