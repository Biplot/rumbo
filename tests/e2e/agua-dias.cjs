/* Pruebas en navegador · 💧 Corregir otros días del agua (agua.js, «Tus días» en la hoja «Tu agua»): la semana con ‹ ›
   hasta 4 semanas atrás, tocar un día, sumar un vaso o la botella, «Cumplí la meta» (+10 ⭐ y el hábito «Agua» de ese
   día), quitar (se devuelven), mañana no se toca y hoy suma como siempre. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-06T15:00:00", w: 390, h: 844 });   // viernes
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
  const hoja = () => p.locator("#agua-semana").innerText();
  const total = f => p.evaluate(f => aguaTotal(aguaDia(f)), f);
  const mov = f => p.evaluate(f => { const l = (STATE.gamif.ledger || []).find(x => x.id === "agua:" + f); return l ? (l.anulado ? "anulado" : "dado") : "no"; }, f);
  const habito = f => p.evaluate(f => { const h = aguaHabito(), [y, m, d] = f.split("-").map(Number); return !!h && habitDone(h.id, m - 1, d, y); }, f);
  const tocar = async sel => { await p.click(sel); await p.waitForTimeout(250); };

  await registrar(p, "aguadias@test.cl");
  await p.evaluate(() => {
    if (!aguaHabito()) STATE.habitos.defs.push({ id: "hagua", nombre: "Agua", icon: "💧", frecuencia: { tipo: "diario" }, creado: "2026-09-01" });
    saveState();
  });
  await p.evaluate(() => openAgua()); await p.waitForTimeout(500);

  // 1) Tus días: esta semana, de lunes a domingo; mañana y pasado no se tocan
  let t = await hoja();
  ok(/Tus días/i.test(await p.locator("#modal").innerText()) && /Esta semana/.test(t) && /2 – 8 nov/.test(t) && await p.locator("#agua-semana .agua-semana__d").count() === 7, "«Tus días»: esta semana (2 – 8 nov), un día por barra");
  ok(await p.locator('#agua-semana [data-f="2026-11-07"]').isDisabled() && await p.locator('#agua-semana [data-f="2026-11-08"]').isDisabled() && !(await p.locator('#agua-semana [data-f="2026-11-06"]').isDisabled()), "el sábado y el domingo (todavía no llegan) no se tocan; hoy sí");
  ok(await p.locator('#agua-semana [data-action="agua-sem"][data-d="-1"]').isDisabled() && !(await p.locator('#agua-semana [data-action="agua-sem"][data-d="1"]').isDisabled()), "› apagado (no hay semanas futuras), ‹ para ir atrás");
  ok(/Tócalo para corregirlo/.test(t), "una pista: ¿olvidaste anotar un día? tócalo");

  // 2) El miércoles olvidado: un vaso y «Cumplí la meta»
  await tocar('#agua-semana [data-f="2026-11-04"]');
  t = await hoja();
  ok(/Miércoles 4 de noviembre/.test(t) && /Sin agua anotada/.test(t) && /Te faltaron 2 L/.test(t), "tocar el miércoles: su panel, sin agua y con lo que faltó");
  await tocar('#agua-semana [data-action="agua-dia-sumar"][data-ml="250"]');
  t = await hoja();
  ok(await total("2026-11-04") === 250 && /0,25 de 2 L/.test(t) && /anotado después/.test(t) && await mov("2026-11-04") === "no", "+ Vaso: 250 ml en el miércoles, «anotado después» (sin una hora falsa) y todavía sin ⭐");
  await tocar('#agua-semana [data-action="agua-dia-llenar"]'); await p.waitForTimeout(400);
  t = await hoja();
  ok(await total("2026-11-04") === 2000 && /Meta cumplida/.test(t) && await p.locator('#agua-semana [data-action="agua-dia-llenar"]').count() === 0, "«Cumplí la meta»: suma lo que faltaba (1,75 L) y el día queda cumplido");
  ok(await mov("2026-11-04") === "dado" && await habito("2026-11-04") && !(await habito("2026-11-06")), "+10 ⭐ por la meta de ese día y su hábito «Agua» marcado (el de hoy no)");
  ok(/is-ok/.test(await p.locator('#agua-semana [data-f="2026-11-04"] .agua-semana__b').getAttribute("class")), "la barra del miércoles se llena de azul");
  ok(await p.evaluate(() => aguaHoy()) === 0, "lo de hoy no cambia");

  // 3) Quitar: bajo la meta se devuelven
  await tocar('#agua-semana [data-action="agua-dia-quitar"]');
  await p.waitForTimeout(300);
  ok(await total("2026-11-04") === 250 && await mov("2026-11-04") === "anulado" && !(await habito("2026-11-04")), "quitar los 1,75 L: vuelve a 250 ml, se devuelven las ⭐ y se desmarca el hábito");

  // 4) Hasta 4 semanas atrás
  for (let i = 0; i < 4; i++) await tocar('#agua-semana [data-action="agua-sem"][data-d="1"]');
  t = await hoja();
  ok(/Hace 4 semanas/.test(t) && /5 – 11 oct/.test(t) && await p.locator('#agua-semana [data-action="agua-sem"][data-d="1"]').isDisabled(), "‹ cuatro veces: hace 4 semanas (5 – 11 oct) y ahí termina");
  await tocar('#agua-semana [data-f="2026-10-05"]');
  await tocar('#agua-semana [data-action="agua-dia-sumar"][data-ml="500"]');
  ok(await total("2026-10-05") === 500 && /Lunes 5 de octubre/.test(await hoja()), "el lunes 5 de octubre también se corrige: + Botella (500 ml)");
  ok(await p.evaluate(() => aguaSumarDia("2026-10-04", 250)) == null && await total("2026-10-04") === 0, "antes de eso ya no (el día queda como estaba)");
  ok(await p.evaluate(() => aguaSumarDia("2026-11-07", 250)) == null && await total("2026-11-07") === 0, "y mañana tampoco");
  await tocar('#agua-semana [data-action="agua-sem"][data-d="-1"]');
  ok(/Hace 3 semanas/.test(await hoja()) && !/Lunes 5 de octubre/.test(await hoja()), "› vuelve una semana (y se cierra el día elegido)");

  // 5) Hoy desde «Tus días»: suma como siempre (también en «Hoy», arriba)
  for (let i = 0; i < 3; i++) await tocar('#agua-semana [data-action="agua-sem"][data-d="-1"]');
  await tocar('#agua-semana [data-f="2026-11-06"]');
  ok(/Hoy/.test(await p.locator("#agua-dia").innerText()), "tocar hoy: su panel se llama «Hoy»");
  await tocar('#agua-semana [data-action="agua-dia-sumar"][data-ml="250"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => aguaHoy()) === 250 && await p.locator("#agua-hoy-lista .agua-reg").count() === 1, "+ Vaso de hoy: lo suma a hoy (y aparece en la lista de arriba)");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "cabe en el celular");
  await p.locator("#agua-semana").scrollIntoViewIfNeeded();
  await shot(p, "agua-dias");

  // 6) Al volver a abrir: esta semana, sin día elegido
  await p.evaluate(() => { closeModal(); openAgua(); }); await p.waitForTimeout(400);
  ok(/Esta semana/.test(await hoja()) && await p.locator("#agua-dia").count() === 0, "al abrir de nuevo «Tu agua»: esta semana y ningún día abierto");
  await ctx.close();
};
