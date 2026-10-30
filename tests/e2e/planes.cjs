/* Pruebas en navegador · Planes con amigos: Ana propone ver una película el viernes, Bruno responde que va
   y le aparece en su Semana, su Calendario y (ese día) en Inicio; un asado en que votan la fecha; cambiar,
   decir que no y cancelar. Las cuentas locales comparten la "base" de amigos (LocalBackend), con las reglas
   de supabase/planes.sql. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T11:00:00", w: 1280, h: 900 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir();
    await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    await p.evaluate(() => closeModal());
  };
  const ir = async r => { await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const vista = () => p.locator("#view").innerText();
  const modal = () => p.locator("#modal").innerText();
  const tarjeta = () => p.locator(".pl-card").innerText();
  const elegir = async (nombre, v) => { await p.click(`label.pl-chip:has(input[name="${nombre}"][value="${v}"])`); await p.waitForTimeout(100); };
  const abrir = async titulo => { await p.click(`.pl-card .pl-fila:has-text("${titulo}")`); await p.waitForTimeout(300); };

  // 0) Ana, Bruno y Cami son amigos
  await registrar(p, "ana@pl.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim();
  const ids = {};
  for (const [email, nombre] of [["bruno@pl.cl", "Bruno"], ["cami@pl.cl", "Cami"]]) {
    await salir(); await registrar(p, email); await p.evaluate(n => { STATE.profile.name = n; saveState(); }, nombre);
    await ir("amigos"); ids[nombre] = await p.evaluate(() => localStorage.getItem("rumbo_session"));
    await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  }
  await entrar("ana@pl.cl");
  for (const id of Object.values(ids)) await p.evaluate(x => BACKEND.amigosResponder(x, true), id);
  await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(400);

  // 1) Ana propone ver una película el viernes en su casa, con Bruno y Cami
  await ir("amigos");
  ok((await tarjeta()).includes("Planes") && (await tarjeta()).includes("propón un plan"), "en Amigos hay una tarjeta Planes, con qué se puede hacer");
  await p.click('.pl-card [data-action="pl-nuevo"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Película") && (await modal()).includes("Que voten") && (await modal()).includes("A distancia"), "el formulario: qué, cuándo (o que voten), dónde (o a distancia) y con quién");
  await shot(p, "planes-nuevo");
  await p.fill("#pl-titulo", "Ver Dune: Parte Dos"); await p.fill("#pl-fecha", "2026-11-06"); await p.fill("#pl-hora", "21:00"); await p.fill("#pl-lugar", "Casa de Ana");
  await p.click('#pl-amigos label:has-text("Bruno")'); await p.click('#pl-amigos label:has-text("Cami")');
  await p.click('[data-action="pl-guardar"]'); await p.waitForTimeout(900);
  const t1 = await tarjeta();
  ok(/próximos/i.test(t1) && t1.includes("Ver Dune: Parte Dos") && t1.includes("vie 6 nov · 21:00 · Casa de Ana"), "queda en Próximos: «Ver Dune: Parte Dos», vie 6 nov · 21:00 · Casa de Ana");
  await ir("semana");
  ok((await p.locator(".pl-ev").allInnerTexts()).some(t => t.includes("21:00") && t.includes("Ver Dune")), "y en la Semana de Ana, el viernes");

  // 2) Bruno: la invitación, y responde que va
  await entrar("bruno@pl.cl");
  ok(await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 1, "a Bruno le aparece el punto en Amigos");
  await ir("amigos");
  ok(/te invitan/i.test(await tarjeta()) && (await tarjeta()).includes("¿Vas?"), "y la invitación al plan, con «¿Vas?»");
  await shot(p, "planes-invitacion");
  await p.click('.pl-inv [data-action="pl-resp"][data-v="voy"]'); await p.waitForTimeout(900);
  ok(!/te invitan/i.test(await tarjeta()) && /próximos/i.test(await tarjeta()) && await p.locator('#nav [data-route="amigos"].tiene-nuevo').count() === 0, "al decir «Voy», pasa a Próximos y se va el punto");
  await abrir("Ver Dune");
  const det = await modal();
  ok(/van 2 de 3/i.test(det) && det.includes("Ana") && det.includes("lo propuso") && det.includes("Sin responder") && det.includes("Casa de Ana"), "el detalle: van 2 de 3, Ana lo propuso, Cami sin responder");
  await shot(p, "planes-detalle");
  await p.evaluate(() => closeModal());
  await ir("semana");
  ok((await p.locator(".pl-ev").allInnerTexts()).some(t => t.includes("Ver Dune")), "el plan está en la Semana de Bruno");
  await ir("calendario"); await p.click('[data-action="cal-dia"][data-date="2026-11-06"]'); await p.waitForTimeout(400);
  ok((await vista()).includes("Ver Dune: Parte Dos") && (await vista()).includes("Plan con amigos"), "y en su Calendario, el viernes 6");
  await p.click('.cal-ag[data-action="pl-ver"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Ver Dune"), "tocándolo en el Calendario se abre el plan");
  await p.evaluate(() => closeModal());

  // 3) Cami no puede: no va a su agenda
  await entrar("cami@pl.cl"); await ir("amigos");
  await p.click('.pl-inv [data-action="pl-resp"][data-v="no"]'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("No vas"), "Cami dice que no puede: queda marcado «No vas»");
  await ir("semana");
  ok(await p.locator(".pl-ev").count() === 0, "y no aparece en su Semana");

  // 4) Ana propone un asado y que voten la fecha
  await entrar("ana@pl.cl"); await ir("amigos");
  await p.click('.pl-card [data-action="pl-nuevo"]'); await p.waitForTimeout(300);
  await elegir("pl-tipo", "comer"); await p.fill("#pl-titulo", "Asado de fin de año"); await elegir("pl-cuando", "votar");
  const ops = p.locator("#pl-ops .pl-op");
  await ops.nth(0).locator("[data-k=fecha]").fill("2026-11-07"); await ops.nth(0).locator("[data-k=hora]").fill("20:00");
  await ops.nth(1).locator("[data-k=fecha]").fill("2026-11-08"); await ops.nth(1).locator("[data-k=hora]").fill("13:30");
  await p.click('[data-action="pl-op-mas"]'); ok(await ops.count() === 3, "se puede proponer otra fecha");
  await p.click('#pl-amigos label:has-text("Bruno")'); await p.click('#pl-amigos label:has-text("Cami")');
  await p.click('[data-action="pl-guardar"]'); await p.waitForTimeout(900);
  ok(/por definir/i.test(await tarjeta()) && (await tarjeta()).includes("Asado de fin de año") && (await tarjeta()).includes("Por definir: votan la fecha"), "queda en Por definir: votan la fecha");

  // 5) Bruno vota; Ana elige la fecha
  await entrar("bruno@pl.cl"); await ir("amigos");
  await abrir("Asado");
  ok(/qué fechas te sirven/i.test(await modal()) && (await modal()).includes("sáb 7 nov · 20:00") && (await modal()).includes("dom 8 nov · 13:30"), "Bruno ve las dos fechas para votar");
  await p.check('#pl-votos input[type=checkbox] >> nth=0'); await p.click('[data-action="pl-votar"]'); await p.waitForTimeout(800);
  await entrar("ana@pl.cl"); await ir("amigos"); await abrir("Asado");
  ok((await modal()).includes("1 puede") && await p.locator('[data-action="pl-fijar"]').count() === 2, "Ana ve que a 1 le sirve el sábado, y puede elegir");
  await shot(p, "planes-votar");
  await p.click('[data-action="pl-fijar"] >> nth=0'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("sáb 7 nov · 20:00") && !/por definir/i.test(await tarjeta()), "el asado queda el sábado 7 a las 20:00");

  // 6) Ana cambia la hora de la película; cancela el asado
  await abrir("Ver Dune"); await p.click('[data-action="pl-editar"]'); await p.waitForTimeout(300);
  await p.fill("#pl-hora", "20:30"); await p.click('[data-action="pl-guardar"]'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("vie 6 nov · 20:30"), "Ana cambia la película a las 20:30");
  await abrir("Asado"); await p.click('[data-action="pl-editar"]'); await p.waitForTimeout(300);
  await p.click('[data-action="pl-cancelar"]'); await p.waitForTimeout(900);
  ok((await tarjeta()).includes("Cancelado"), "y cancela el asado");

  // 7) Bruno ve los cambios; en el perfil de Ana, lo que hacen juntos
  await entrar("bruno@pl.cl"); await ir("amigos");
  const t2 = await tarjeta();
  ok(t2.includes("vie 6 nov · 20:30") && t2.includes("Cancelado"), "Bruno ve la nueva hora y el asado cancelado");
  await ir("calendario"); await p.click('[data-action="cal-dia"][data-date="2026-11-07"]'); await p.waitForTimeout(400);
  ok(!(await vista()).includes("Asado"), "el asado cancelado sale de su Calendario");
  await ir("amigos"); await p.click('.am-fila [data-action="am-ver"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Ver Dune: Parte Dos") && (await modal()).includes("Proponer un plan"), "en el perfil de Ana: el plan que tienen y «Proponer un plan»");
  await p.click('#modal [data-action="pl-nuevo"]'); await p.waitForTimeout(300);
  ok(await p.locator('#pl-amigos input:checked').count() === 1 && (await p.locator('#pl-amigos label:has(input:checked)').innerText()).includes("Ana"), "que abre un plan nuevo con Ana ya elegida");
  await p.evaluate(() => closeModal());

  // 8) El viernes, en Inicio y al abrir el día
  await ctx.clock.setFixedTime(new Date("2026-11-06T10:00:00")); await ir("inicio"); await p.waitForTimeout(500);
  const hoy = await p.locator(".pl-hoy").innerText().catch(() => "");
  ok(/hoy a las 20:30/i.test(hoy) && hoy.includes("Ver Dune: Parte Dos con Ana"), "el viernes, Inicio dice «Hoy a las 20:30 · Ver Dune: Parte Dos con Ana»");
  await shot(p, "planes-inicio");

  // 9) Sin la base de planes, Amigos queda como antes
  await p.evaluate(() => { BACKEND.planLista = async () => ({ error: "sin-servidor" }); PLAN.lista = null; PLAN.t = 0; });
  await ir("amigos"); await p.waitForTimeout(500);
  ok(await p.locator(".pl-card").count() === 0 && (await vista()).includes("Lo que muestras"), "sin la base de planes, Amigos no muestra la tarjeta (y lo demás sigue igual)");
  await ctx.close();
};
