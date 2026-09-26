/* Pruebas en navegador · Informe mensual para compartir (📤 Compartir mi mes) */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T20:00:00", w: 390, h: 844, dpr: 2 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "informe@test.cl");
  await p.evaluate(() => {
    STATE.settings.year = 2026; STATE.profile.name = "Camila";
    STATE.ritual.meses["2026-09"] = { apertura: { foco: "Constancia", ts: 1 } };
    STATE.metas.mensuales[8] = [{ id: "a", texto: "x", done: true, ts: 1 }, { id: "b", texto: "y", done: false, ts: 1 }];
    STATE.finanzas.meses[8] = { ingreso: 1850000, gasto: 1620000, ahorro: 0, metaAhorro: 250000 };
    for (let d = 1; d <= 20; d++) STATE.ritual.dias[`2026-09-${String(d).padStart(2, "0")}`] = { hecho: true, cerrado: true, cierre: { sapo: true }, ts: 1 };
    saveState(); rerender();
  });
  await p.goto(URL + "#ritual"); await p.waitForTimeout(150);
  await p.click('[data-action="ritual-view"][data-v="mes"]'); await p.waitForTimeout(200);
  ok(await p.locator('[data-action="informe-open"]', { hasText: "Compartir mi mes" }).count() === 1, "Ritual → Mes ofrece 📤 Compartir mi mes");
  await p.click('[data-action="informe-open"]'); await p.waitForTimeout(600);
  const dim = await p.evaluate(() => { const i = document.querySelector(".informe-prev"); return i && { w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 22) }; });
  ok(dim && dim.w === 1080 && dim.h === 1920 && dim.src === "data:image/png;base64,", "la vista previa es una imagen 1080×1920");
  const op = await p.evaluate(() => INFORME_OP);
  ok(op.foco && op.nota && !op.ahorro && !op.mejor, "por defecto: foco y nota sí; ahorro oculto; lo mejor solo si el mes está cerrado");
  const d = await p.evaluate(() => datosInforme("2026-09"));
  ok(d.mes === "Septiembre" && d.foco === "Constancia" && d.cerrados === 20 && d.dias === 28 && d.bocados === 20 && d.objetivos.join("/") === "1/2" && d.ahorro === 230000,
    "los números del informe salen del mes (20/28 días, 1/2 objetivos, ahorro)");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "móvil: el modal cabe en pantalla");
  await shot(p, "informe-modal");
  // Activar el ahorro cambia la imagen
  const antes = await p.evaluate(() => document.querySelector(".informe-prev").src.length);
  await p.locator("#modalBody label", { hasText: "Ahorro" }).locator("input").check(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => INFORME_OP.ahorro) === true && await p.evaluate(() => document.querySelector(".informe-prev").src.length) !== antes, "al marcar Ahorro, la imagen se vuelve a dibujar");
  // Descargar (y Compartir sin menú del sistema cae en descarga)
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }), p.click('[data-action="informe-descargar"]')]);
  ok(dl.suggestedFilename() === "rumbo-septiembre-2026.png", "descarga rumbo-septiembre-2026.png");
  const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.click('[data-action="informe-compartir"]')]);
  ok(!!dl2, "sin menú de compartir del sistema, Compartir descarga la imagen");
  // Un mes cerrado del historial también se puede compartir, con su nota y lo mejor
  await p.evaluate(() => { closeModal(); STATE.ritual.meses["2026-08"] = { cierre: { nota: 9, mejor: "Terminé el curso", ts: 1 } }; saveState(); rerender(); });
  await p.waitForTimeout(150);
  const hist = p.locator('[data-action="informe-open"][data-key="2026-08"]');
  if (await hist.count() === 0) await p.locator("summary", { hasText: /historial|meses anteriores/i }).first().click().catch(() => {});
  ok(await hist.count() === 1, "el historial muestra 📤 en los meses cerrados");
  await hist.click(); await p.waitForTimeout(500);
  const op2 = await p.evaluate(() => INFORME_OP);
  ok(op2.key === "2026-08" && op2.mejor === true && (await p.locator("#modalTitle").innerText()).includes("Agosto"), "agosto cerrado: incluye lo mejor del mes");
  await ctx.close();
};
