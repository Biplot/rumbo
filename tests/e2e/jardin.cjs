/* Pruebas en navegador · 🌱 Tu jardín, en el celular: la tarjeta en Hábitos (macetas, árboles y cielo), elegir las 3 macetas
   cuando hay más hábitos formándose, tu elefante riega al marcar, el trasplante al día 66 (árbol y maceta libre), la hoja del
   jardín (árbol sin hojas si lo dejaste), el jardín en Inicio (y apagarlo), y un estilo comprado en la Tienda. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T12:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const habitos = async () => { await p.evaluate(() => { closeModal(); HABIT_VIEW = "diario"; HABIT_LAYOUT = "hoy"; go("habitos"); rerender(); }); await p.waitForTimeout(500); };
  const escena = () => p.evaluate(() => { const e = jardinEscena(); return { m: e.macetas.map(x => x.nombre), a: e.arboles.map(x => x.nombre + (x.hojas ? "" : " (sin hojas)")), elegir: e.elegir }; });
  await registrar(p, "jardin@test.cl");

  // Hábitos de ejemplo: Leer lleva 65 días (hasta ayer), Caminar echó raíces pero lo dejó hace meses, tres más formándose y uno en pausa
  await p.evaluate(() => {
    STATE.habitos.defs = []; STATE.habitos.log = {};
    const mk = (id, nombre, icon, n, hasta, extra) => { STATE.habitos.defs.push(Object.assign({ id, nombre, icon, frecuencia: { tipo: "diario" }, creado: "2026-01-01" }, extra || {}));
      const d = new Date(hasta + "T12:00:00"); for (let i = 0; i < n; i++) { const k = d.getFullYear() + "-" + (d.getMonth() + 1); STATE.habitos.log[k] = STATE.habitos.log[k] || {}; (STATE.habitos.log[k][id] = STATE.habitos.log[k][id] || {})[d.getDate()] = true; d.setDate(d.getDate() - 1); } };
    mk("leer", "Leer", "📚", 65, "2026-11-03"); mk("caminar", "Caminar", "🚶", 80, "2026-08-20"); mk("meditar", "Meditar", "🧘", 20, "2026-11-03");
    mk("ingles", "Inglés", "🗣️", 10, "2026-11-03"); mk("estirar", "Estirar", "🤸", 3, "2026-11-03"); mk("yoga", "Yoga", "🧘", 5, "2026-10-01", { pausado: true });
    saveState();
  });
  await habitos();

  // 1) La tarjeta: el jardín dibujado, lo que hay y el aviso para elegir macetas (4 formándose)
  const card = p.locator(".jar-card");
  ok(await card.count() === 1 && await card.locator('canvas[data-jardin="entrada"][data-listo]').count() === 1, "Hábitos: la tarjeta «Tu jardín» con el dibujo de la entrada (montado)");
  ok(/3 en maceta · 1 sin maceta · 1 árbol · cielo:/.test(await card.locator(".jar-lectura").innerText()) && /Tienes 4 hábitos formándose: elige los 3/.test(await card.innerText()),
    "dice 3 en maceta, 1 sin maceta, 1 árbol y el cielo; y pide elegir porque hay 4 formándose (el de pausa no cuenta)");
  await shot(p, "jardin-habitos");

  // 2) Elegir las macetas: hasta 3
  await card.locator('[data-action="jar-macetas"]').click(); await p.waitForTimeout(300);
  ok(await p.locator("#jar-elegir input").count() === 4, "elegir: aparecen los 4 hábitos que se están formando");
  await p.evaluate(() => document.querySelectorAll("#jar-elegir input").forEach(i => { i.checked = false; }));
  for (const id of ["leer", "meditar", "estirar", "ingles"]) await p.click(`#jar-elegir input[value="${id}"]`);
  ok(await p.locator("#jar-elegir input:checked").count() === 3 && !(await p.locator('#jar-elegir input[value="ingles"]').isChecked()), "no deja marcar una cuarta");
  await p.click('[data-action="jar-macetas-ok"]'); await p.waitForTimeout(400);
  let e = await escena();
  ok(e.m.join(",") === "Leer,Meditar,Estirar" && !e.elegir && await p.locator(".jar-aviso").count() === 0, "guardar: Leer, Meditar y Estirar quedan en maceta y el aviso se va");

  // 3) Marcar Meditar: tu elefante riega su maceta
  await p.evaluate(() => { window.__riego = []; const o = JARDIN_MOTOR.regar; JARDIN_MOTOR.regar = id => { window.__riego.push(id); o(id); }; });
  await p.locator('.hb-today[data-id="meditar"]').click(); await p.waitForTimeout(600);
  ok((await p.evaluate(() => window.__riego)).join() === "meditar" && await p.locator('.jar-card canvas[data-jardin][data-listo]').count() === 1, "marcar Meditar: el elefante riega su maceta (y el jardín se vuelve a dibujar)");
  await shot(p, "jardin-riego");

  // 4) Marcar Leer (día 66): echa raíces, se celebra y su maceta queda libre para Inglés
  await p.locator('.hb-today[data-id="leer"]').click(); await p.waitForTimeout(1300);
  ok(/Echó raíces/.test(await p.locator("#modal").innerText()) && /«Leer» cumplió 66 días/.test(await p.locator("#modal").innerText()), "día 66: «Echó raíces» — tu elefante trasplantó Leer al patio");
  await shot(p, "jardin-raices");
  await p.click('[data-action="jar-cerrar"]'); await p.waitForTimeout(300);
  e = await escena();
  ok(e.a.join(",") === "Leer,Caminar (sin hojas)" && e.m.join(",") === "Meditar,Estirar,Inglés", "Leer ahora es árbol; Inglés ocupa la maceta libre; Caminar sigue sin hojas");
  await p.locator('.hb-today[data-id="leer"]').click(); await p.waitForTimeout(300); await p.locator('.hb-today[data-id="leer"]').click(); await p.waitForTimeout(1300);
  ok(await p.locator("#modalOverlay:not([hidden])").count() === 0, "desmarcar y volver a marcar no lo celebra dos veces");

  // 5) La hoja del jardín
  await habitos();
  await p.locator('.jar-card .card__head [data-action="jar-abrir"]').click(); await p.waitForTimeout(400);
  const hoja = await p.locator("#modal").innerText();
  ok(/Meditar\s*21 de 66 días · faltan 45 para echar raíces/.test(hoja) && /Caminar\s*Sin hojas por ahora/.test(hoja) && /Leer\s*Echó raíces/.test(hoja) && /Esta semana:/.test(hoja),
    "la hoja: cada maceta con sus días y lo que falta, los árboles (Caminar sin hojas) y el cielo de la semana");

  // 6) En Inicio, sobre tus hábitos de hoy; se puede apagar
  await p.evaluate(() => { closeModal(); go("inicio"); }); await p.waitForTimeout(500);
  ok(await p.locator('.jar-lienzo--inicio canvas[data-jardin]').count() === 1, "Inicio: el jardín va arriba de «Hábitos de hoy»");
  await p.locator(".jar-lienzo--inicio").click(); await p.waitForTimeout(300);
  await p.locator("#jar-inicio").click(); await p.waitForTimeout(400);
  await p.evaluate(() => { closeModal(); go("inicio"); rerender(); }); await p.waitForTimeout(400);
  ok(await p.locator(".jar-lienzo--inicio").count() === 0 && (await p.evaluate(() => STATE.jardin.inicio)) === false, "desmarcar «Mostrarlo en Inicio» lo saca de Inicio (sigue en Hábitos)");

  // 7) Un estilo de la Tienda: el sur
  await p.evaluate(() => { ledgerRegistrar(STATE, "regalo-prueba", 2000, 0, "prueba"); saveState(); TIENDA_SEC = "estilo"; go("recompensas"); }); await p.waitForTimeout(600);
  const sec = p.locator(".tienda-sec").filter({ hasText: "Tu jardín" });
  ok(await sec.locator(".ficha").count() === 4 && /Jardín: el sur/.test(await sec.innerText()), "Tienda › Tu jardín: la ventana, en píxeles, el terrario y el sur");
  await sec.locator(".ficha").filter({ hasText: "el sur" }).click(); await p.waitForTimeout(500);
  ok(await p.locator('#modal canvas[data-jardin="sur"][data-modo="muestra"]').count() === 1, "el detalle muestra el sur dibujado");
  await p.locator('#modal [data-action="cos-buy"]').click(); await p.waitForTimeout(500);
  await habitos();
  ok(await p.locator('.jar-card canvas[data-jardin="sur"]').count() === 1, "comprarlo lo pone al tiro: el jardín ahora es el sur");
  await shot(p, "jardin-sur");
  await p.locator('.jar-card .card__head [data-action="jar-abrir"]').click(); await p.waitForTimeout(400);
  await p.locator('#modal [data-action="jar-estilo"][data-v="entrada"]').click(); await p.waitForTimeout(400);
  await p.evaluate(() => closeModal()); await p.waitForTimeout(200);
  ok(await p.locator('.jar-card canvas[data-jardin="entrada"]').count() === 1, "en la hoja se vuelve a la entrada (lo comprado queda para elegirlo)");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin scroll horizontal en el celular");
  await ctx.close();
};
