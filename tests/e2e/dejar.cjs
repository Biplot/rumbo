/* Pruebas en navegador · 🌵 Dejar y reducir hábitos, en el celular: crearlos desde el formulario («¿Qué quieres?»),
   los días sin y confirmar el día (+5 ⭐), un antojo superado (+1 ⭐), caer (la racha a 0, sin borrar lo demás)
   y deshacerlo, corregir un día en la Semana, el de límite con + y −, Inicio con su nombre discreto, la hoja
   con lo que te ahorras (a una alcancía), confirmar al cerrar el día y el cactus en el jardín. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-05T12:00:00", w: 390, h: 844 });   // jueves
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const hoyVista = async () => { await p.evaluate(() => { closeModal(); HABIT_VIEW = "diario"; HABIT_LAYOUT = "hoy"; go("habitos"); rerender(); }); await p.waitForTimeout(400); };
  const est = () => p.evaluate(() => STATE.gamif.puntos);
  const def = id => p.evaluate(n => { const h = STATE.habitos.defs.find(x => x.nombre === n); return h ? { id: h.id, meta: h.meta, creado: h.creado, costo: h.costo, plan: h.plan, discreto: h.discreto, limite: h.limite, icon: h.icon, racha: rachaPeriodos(h).n } : null; }, id);
  await registrar(p, "dejar@test.cl");
  await p.evaluate(() => { STATE.habitos.defs = []; STATE.habitos.log = {}; saveState(); });
  await hoyVista();

  // 1) Crear «Dejar de fumar»: ¿desde cuándo?, lo que costaba, tu plan y un nombre discreto
  await p.click('[data-action="habit-add"]'); await p.waitForTimeout(200);
  ok(await p.locator("#h-freq-box").isVisible() && !(await p.locator("#dj-box-dejar").isVisible()), "el formulario parte en «Hacerlo», con su frecuencia");
  await p.click('#h-meta-seg [data-v="dejar"]');
  ok(!(await p.locator("#h-freq-box").isVisible()) && await p.locator("#dj-box-dejar").isVisible() && await p.inputValue("#h-icon") === "🚭", "«Dejarlo»: sin frecuencia, con desde cuándo y lo que costaba; el ícono pasa al cigarro tachado");
  await p.fill("#h-nombre", "Dejar de fumar"); await p.fill("#h-desde", "2026-10-20"); await p.fill("#h-costo", "3500");
  await p.fill("#h-plan", "Salgo a caminar 5 minutos"); await p.fill("#h-discreto", "Mi reto");
  await p.click('[data-action="habit-save"]'); await p.waitForTimeout(300);
  let f = await def("Dejar de fumar");
  ok(f && f.meta === "dejar" && f.creado === "2026-10-20" && f.costo === 3500 && f.discreto === "Mi reto" && f.racha === 16, "guardado: desde el 20 de octubre, $3.500 al día y 16 días sin");
  const card = p.locator(".hb-dejar");
  ok(/16\s*días sin fumar/.test(await card.innerText()) && /Tócalo para confirmar hoy/.test(await card.innerText()), "la tarjeta: 16 días sin fumar, por confirmar hoy");
  await shot(p, "dejar-hoy");

  // 2) Confirmar hoy: +5 ⭐ y la racha sube
  let e0 = await est();
  await card.click(); await p.waitForTimeout(400);
  ok((await est()) - e0 === 5 && (await def("Dejar de fumar")).racha === 17 && /Confirmado hoy/.test(await p.locator(".hb-dejar").innerText()), "confirmar hoy: +5 ⭐ y 17 días");

  // 3) Antojo superado: qué lo gatilló, +1 ⭐ y tu plan
  e0 = await est();
  await p.click('.hb-dejar [data-action="dj-antojo"]'); await p.waitForTimeout(200);
  ok(/Salgo a caminar 5 minutos/.test(await p.locator("#modal").innerText()), "el antojo te recuerda tu plan");
  await p.click('[data-action="dj-antojo-ok"][data-g="Estrés"]'); await p.waitForTimeout(300);
  ok((await est()) - e0 === 1 && (await p.evaluate(() => STATE.habitos.antojos.map(a => a.gatillo).join())) === "Estrés", "antojo superado (estrés): +1 ⭐");

  // 4) Caer: la racha a 0, la confirmación de hoy se deshace; se puede deshacer la caída
  await p.click('.hb-dejar [data-action="dj-caida"]'); await p.waitForTimeout(200);
  ok(/Caer es parte de dejarlo/.test(await p.locator("#modal").innerText()), "antes de caer, un mensaje amable");
  e0 = await est();
  await p.click('[data-action="dj-caida-ok"]'); await p.waitForTimeout(400);
  ok((await def("Dejar de fumar")).racha === 0 && (await est()) - e0 === -5 && /Caíste hoy/.test(await p.locator(".hb-dejar").innerText()), "caí hoy: racha 0 y la confirmación de hoy se devuelve");
  ok(await p.evaluate(() => hmMejorRacha(STATE.habitos.defs[0])) === 16, "la mejor racha sigue (16)");
  await p.click('.hb-dejar [data-action="dj-caida-quitar"]'); await p.waitForTimeout(300);
  ok((await def("Dejar de fumar")).racha === 16, "deshacer la caída: vuelve a 16 (hoy, por confirmar)");

  // 5) En la Semana, un día que pasó se corrige: caída y de vuelta
  await p.evaluate(() => { HABIT_LAYOUT = "semana"; rerender(); }); await p.waitForTimeout(300);
  const lunes = p.locator('.hb-week:has-text("Dejar de fumar") [data-f="2026-11-02"]');
  await lunes.click(); await p.waitForTimeout(300);
  ok(await p.locator('.hb-week:has-text("Dejar de fumar") [data-f="2026-11-02"].cae').count() === 1 && (await def("Dejar de fumar")).racha === 2, "el lunes 2 como caída: racha 2 (martes y miércoles)");
  await p.locator('.hb-week:has-text("Dejar de fumar") [data-f="2026-11-02"]').click(); await p.waitForTimeout(300);
  ok((await def("Dejar de fumar")).racha === 16, "tocarlo de nuevo quita la caída");

  // 6) Reducir: «Café, máximo 2 al día»
  await hoyVista();
  await p.click('[data-action="habit-add"]'); await p.waitForTimeout(200);
  await p.click('#h-meta-seg [data-v="reducir"]');
  await p.fill("#h-nombre", "Café"); await p.fill("#h-lim-n", "2"); await p.fill("#h-unidad", "cafés"); await p.fill("#h-discreto", "Mi taza");
  await p.click('[data-action="habit-save"]'); await p.waitForTimeout(300);
  const lim = p.locator(".hb-lim");
  ok(/Con límite/i.test(await p.locator("#view").innerText()) && await lim.count() === 1 && /de 2 cafés hoy/.test(await lim.innerText()), "Hoy › Con límite: Café, 0 de 2 cafés hoy");
  for (let i = 0; i < 3; i++) { await p.click('.hb-lim [data-action="rd-mas"]'); await p.waitForTimeout(150); }
  ok(await p.locator(".hb-lim.is-pasado").count() === 1 && /te pasaste por 1/.test(await p.locator(".hb-lim").innerText()), "tres cafés: te pasaste por 1");
  await p.click('.hb-lim [data-action="rd-menos"]'); await p.waitForTimeout(200);
  ok(await p.locator(".hb-lim.is-pasado").count() === 0 && await p.evaluate(() => hmCuenta(STATE.habitos.defs[1], todayISO())) === 2, "− deshace: 2 de 2");
  await shot(p, "dejar-limite");

  // 7) Inicio: con su nombre discreto
  await p.evaluate(() => { closeModal(); go("inicio"); }); await p.waitForTimeout(500);
  const ini = await p.locator(".inicio-main").innerText();
  ok(/Mi reto/.test(ini) && /Mi taza/.test(ini) && !/Dejar de fumar/.test(ini), "Inicio usa los nombres discretos (Mi reto, Mi taza)");
  await p.click('.hab-chip--lim[data-action="rd-mas"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => hmCuenta(STATE.habitos.defs[1], todayISO())) === 3, "en Inicio, el botón del café suma uno");

  // 8) La hoja: lo que te ahorras, a una alcancía
  await p.evaluate(() => { alcCrear({ nombre: "Viaje al sur", meta: 500000 }); saveState(); });
  await hoyVista();
  await p.click('.hb-dejar [data-action="dj-ver"]'); await p.waitForTimeout(300);
  const hoja = await p.locator("#modal").innerText();
  ok(/16\s*días sin fumar/.test(hoja) && /\$56\.000/.test(hoja) && /Esta semana superaste 1 antojo/.test(hoja), "la hoja: 16 días sin, $56.000 ahorrados y el antojo de la semana");
  await p.click('[data-action="dj-ahorro-pasar"]'); await p.waitForTimeout(400);
  const alc = await p.evaluate(() => { const a = alcActivas()[0]; return { g: alcGuardado(a), pasado: STATE.habitos.defs[0].ahorroPasado }; });
  ok(alc.g === 56000 && alc.pasado === 56000, "pasar $56.000 a «Viaje al sur»");
  await shot(p, "dejar-hoja");

  // 9) Al cerrar el día: confirmar con un toque
  await p.evaluate(() => { closeModal(); const hoy = todayISO(); STATE.ritual.dias[hoy] = Object.assign(STATE.ritual.dias[hoy] || {}, { hecho: true, ts: Date.now() }); saveState(); openCierreModal(hoy); });
  await p.waitForTimeout(300);
  ok(/Lo que estás dejando/.test(await p.locator("#modal").innerText()), "el cierre del día pregunta por lo que estás dejando");
  await p.click('.dj-cierre [data-v="si"]'); e0 = await est();
  await p.click('[data-action="cierre-save"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => hmMarcado(STATE.habitos.defs[0], todayISO(), STATE)) && (await est()) - e0 >= 5, "«Hoy sin ✓» al cerrar: confirmado (+5 ⭐)");

  // 10) El jardín: cactus
  ok(await p.evaluate(() => jardinEscena().macetas.filter(m => m.cactus).length) === 2, "en el jardín, los dos son cactus");
  await hoyVista();
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin scroll horizontal en el celular");
  await ctx.close();
};
