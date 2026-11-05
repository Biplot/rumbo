/* Pruebas en navegador · 🎆 Tu año en Rumbo (tu-anio.js): en noviembre todavía no se ve; desde el 1 de diciembre llega la
   tarjeta a Inicio, se abre la historia (barras, avanzar y volver, texto para lectores de pantalla), se comparte una o todas
   (imágenes de 1080 × 1920), queda vista (la tarjeta se va) y sigue a mano en Tendencias y en el cierre de diciembre. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-20T10:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const visor = () => p.evaluate(() => { const el = document.getElementById("tuanio"); return !!el && !el.hidden; });

  await registrar(p, "anio@rumbo.cl");
  await p.evaluate(() => {
    STATE.profile.name = "Camila Pérez";
    STATE.habitos.defs.push({ id: "hl", nombre: "Leer 20 minutos", icon: "📖", frecuencia: { tipo: "diario" }, creado: "2026-01-01" });
    for (let d = new Date(2026, 2, 1); d < new Date(2026, 2, 21); d.setDate(d.getDate() + 1)) {
      STATE.ritual.dias[isoLocal(d)] = { hecho: true, cerrado: true, ts: 1 };
      const k = "2026-3"; STATE.habitos.log[k] = STATE.habitos.log[k] || {}; (STATE.habitos.log[k].hl = STATE.habitos.log[k].hl || {})[d.getDate()] = true;
    }
    STATE.lecturas.push({ id: "l1", titulo: "Drácula", paginas: 418, estado: "terminado", fin: "2026-04-15" });
    saveState();
  });

  // 1) Noviembre: todavía no
  await ir("inicio");
  ok(await p.locator(".tuanio-card").count() === 0, "en noviembre no hay tarjeta de tu año en Inicio");
  await ir("tendencias");
  ok(await p.locator('[data-action="ta-abrir"]').count() === 0, "ni botón en Tendencias");
  await p.evaluate(() => openTuAnio(2026)); await p.waitForTimeout(500);
  ok(!(await visor()) && /llega el 1 de diciembre/.test(await p.locator("#toast, .toast").first().innerText().catch(() => "")), "si se intenta abrir antes: «llega el 1 de diciembre»");

  // 2) Diciembre: la tarjeta en Inicio, arriba
  await ctx.clock.setFixedTime(new Date("2026-12-06T20:00:00"));
  await ir("inicio");
  const card = p.locator(".tuanio-card");
  ok(await card.count() === 1 && /Tu 2026 en Rumbo/.test(await card.innerText()) && /20\s*días cerrados/i.test(await card.innerText()), "el 6 de diciembre: «Tu 2026 en Rumbo» con tus días cerrados");
  ok(await p.evaluate(() => { const c = document.querySelector(".tuanio-card"), h = document.querySelector('[data-tour="dia"]'); return !!(c && h && (c.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)); }), "la tarjeta va antes del día, donde se ve");
  await shot(p, "tu-anio-inicio");

  // 3) La historia
  await p.click('.tuanio-card [data-action="ta-abrir"]');
  await p.waitForFunction(() => { const el = document.getElementById("tuanio"); return el && !el.hidden; }, null, { timeout: 15000 });
  const n = await p.evaluate(() => TA.laminas.length);
  ok(n >= 4 && n <= 8 && await p.locator(".tuanio__barras span").count() === n, `una barra por lámina (${n})`);
  const L = await p.evaluate(() => TA.laminas);
  ok(L[0] === "portada" && L[n - 1] === "final" && ["cerrados", "habitos", "libros"].every(k => L.includes(k)) && !L.includes("agua"), "con lo que hubo: portada, días cerrados, tu hábito, tus libros y el cierre (sin agua si no tomaste) · " + L.join(" "));
  let alt = await p.locator("#ta-img").getAttribute("alt");
  ok(/2026 en Rumbo/.test(alt) && /Camila/.test(alt), "la portada se lee: «2026 en Rumbo», con tu nombre");
  ok(await p.evaluate(() => new Promise(r => { const i = document.getElementById("ta-img"); const f = () => r([i.naturalWidth, i.naturalHeight]); i.complete && i.naturalWidth ? f() : i.onload = f; })).then(x => x[0] === 1080 && x[1] === 1920), "cada lámina es de 1080 × 1920 (historia de Instagram o WhatsApp)");
  await p.click('[data-action="ta-sig"]'); await p.waitForTimeout(200);
  alt = await p.locator("#ta-img").getAttribute("alt");
  ok(await p.evaluate(() => TA.i) === 1 && /Cerraste 20 días/.test(alt) && /20 días seguidos/.test(alt), "tocar a la derecha: la siguiente (20 días cerrados, 20 seguidos)");
  ok(await p.evaluate(() => document.getElementById("ta-b0").style.width) === "100%", "la barra de la que pasó queda llena");
  await p.click('[data-action="ta-ant"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => TA.i) === 0, "tocar a la izquierda: vuelve");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin scroll de lado");
  await shot(p, "tu-anio-visor");

  // 4) Compartir (con menú del teléfono)
  await p.evaluate(() => { window.__comp = []; navigator.canShare = () => true; navigator.share = async o => { window.__comp.push(o.files.map(f => f.name + "|" + f.type)); }; });
  await p.click('[data-action="ta-compartir"]'); await p.waitForTimeout(800);
  await p.click('[data-action="ta-todas"]'); await p.waitForTimeout(1500);
  const comp = await p.evaluate(() => window.__comp);
  ok(comp.length === 2 && comp[0].length === 1 && comp[0][0] === "rumbo-2026-1.jpg|image/jpeg" && comp[1].length === n, `«Compartir esta» manda una imagen y «Compartir las ${n}» todas`);

  // 5) Cerrar: queda vista y la tarjeta se va
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok(!(await visor()), "Esc la cierra");
  ok(await p.evaluate(() => JSON.stringify(STATE.settings.tuAnioVisto)) === "[2026]", "queda anotada como vista");
  await ir("inicio");
  ok(await p.locator(".tuanio-card").count() === 0, "ya vista: la tarjeta deja Inicio");

  // 6) A mano: Tendencias y el cierre de diciembre
  await ir("tendencias");
  const bt = p.locator('[data-action="ta-abrir"]');
  ok(await bt.count() === 1 && /Tu 2026 en Rumbo/.test(await bt.innerText()), "en Tendencias: «Tu 2026 en Rumbo»");
  await bt.click(); await p.waitForFunction(() => { const el = document.getElementById("tuanio"); return el && !el.hidden; }, null, { timeout: 15000 });
  ok(await p.evaluate(() => TA.i) === 0, "se abre de nuevo desde el comienzo");
  await p.click('[data-action="ta-cerrar"]'); await p.waitForTimeout(200);
  ok(!(await visor()), "✕ la cierra");
  await p.evaluate(() => { openMesCierre(mesKey(2026, 11)); MES_WIZ.paso = 6; renderMesWiz(); }); await p.waitForTimeout(300);
  ok(/La historia de tu 2026/.test(await p.locator("#modal").innerText()), "en el cierre de diciembre, junto a «Tu año», el botón de la historia");
  await p.click('#modal [data-action="ta-abrir"]'); await p.waitForFunction(() => { const el = document.getElementById("tuanio"); return el && !el.hidden; }, null, { timeout: 15000 });
  ok(await p.evaluate(() => { const r = document.querySelector("#tuanio .tuanio__x").getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(t && t.closest("#tuanio")); }), "se abre encima del cierre");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok(!(await visor()) && /Cerrar diciembre/i.test(await p.locator("#modal").innerText()) && await p.evaluate(() => MES_WIZ && MES_WIZ.paso === 6), "al salir sigues en el mismo paso del cierre de diciembre");
  await p.evaluate(() => closeModal());

  // 7) En enero se ve la del año que terminó
  await ctx.clock.setFixedTime(new Date("2027-01-04T09:00:00"));
  await p.evaluate(() => { STATE.settings.tuAnioVisto = []; saveState(); });
  await ir("inicio");
  ok(/Tu 2026 en Rumbo/.test(await p.locator(".tuanio-card").innerText().catch(() => "")), "en enero, si no la viste: la de 2026 en Inicio");
  await ctx.close();
};
