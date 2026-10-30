/* Tests de los planes con amigos (planes.js, store.js y notifier/planes.mjs): lo que llega de otros (se limpia),
   qué planes van a tu agenda, las reglas de la base local, los textos y a quién le llega cada aviso, y el recordatorio */
export default async function ({ G, test, assert, clone }) {
  console.log("\nPlanes con amigos");
  if (G("typeof icoUI") === "undefined") G(`var icoUI = n => "<svg data-i='" + n + "'></svg>"`);
  const limpio = G("plLimpio"), fechaTxt = G("plFechaTxt"), va = G("plVa"), con = G("plCon"), esMio = G("plEsMio");
  const LB = G("LocalBackend"), ls = G("localStorage");
  const hoy = G("todayISO()"), mas = n => G(`agSumar(${JSON.stringify(hoy)}, ${n})`);

  const base = (o = {}) => limpio(Object.assign({
    id: "p1", titulo: " Ver Dune: Parte Dos ", tipo: "pelicula", fecha: mas(3), hora: "21:00", lugar: "Casa de Ana", enlace: "", creador: "a", cancelado: false,
    respuesta: "voy", invita: "",
    miembros: [{ id: "a", nombre: "Ana", respuesta: "voy" }, { id: "b", yo: true, nombre: "Bruno", respuesta: "voy" }, { id: "c", nombre: "Cami", respuesta: "quizas" }, { id: "d", nombre: "Dani", respuesta: "no" }],
    opciones: [],
  }, o));

  test("lo que llega del servidor se limpia: textos cortos, tipo, hora, enlace web y respuestas conocidas", () => {
    const p = clone(limpio({ id: "x", titulo: "<b>" + "T".repeat(90), tipo: "fiesta", fecha: "2026-11<x>", hora: "25:00", lugar: "L".repeat(120), enlace: "javascript:alert(1)",
      respuesta: "claro", miembros: [{ id: "u", respuesta: "<img>", nombre: "N".repeat(80) }], opciones: [{ id: "1<x>", fecha: "2026-11-07", hora: "9:5", votos: ["u", 5] }, { id: 2, fecha: "mal" }] }));
    assert.equal(p.titulo.length, 60); assert.equal(p.tipo, "otro"); assert.equal(p.fecha, ""); assert.equal(p.hora, "");
    assert.equal(p.lugar.length, 80); assert.equal(p.enlace, ""); assert.equal(p.respuesta, "pendiente");
    assert.equal(p.miembros[0].respuesta, "pendiente"); assert.equal(p.miembros[0].nombre.length, 60);
    assert.deepEqual(p.opciones, [{ id: 1, fecha: "2026-11-07", hora: "", votos: ["u", "5"] }]);
    assert.equal(limpio({ enlace: "https://meet.example.com/abc" }).enlace, "https://meet.example.com/abc");
  });
  test("cuándo: hoy, mañana o el día con su fecha; y con quién (los que van)", () => {
    assert.equal(fechaTxt(hoy, "21:00"), "hoy · 21:00"); assert.equal(fechaTxt(mas(1), ""), "mañana");
    assert.ok(/^(lun|mar|mié|jue|vie|sáb|dom) \d+ [a-z]+ · 21:00$/.test(fechaTxt(mas(3), "21:00")));
    assert.equal(con(base()), "Ana"); assert.equal(con(base({ miembros: [{ id: "a", nombre: "Ana", respuesta: "voy" }, { id: "b", yo: true, respuesta: "voy" }] })), "Ana");
    assert.equal(con(base({ miembros: [{ id: "b", yo: true, respuesta: "voy" }, { id: "c", nombre: "Cami", respuesta: "pendiente" }, { id: "e", nombre: "Eli", respuesta: "pendiente" }] })), "Cami y Eli");
    assert.equal(esMio(base()), false); assert.equal(esMio(base({ creador: "b" })), true);
  });
  test("a tu agenda van los planes con fecha, sin cancelar, a los que vas o tal vez vas", () => {
    assert.equal(va(base()), true); assert.equal(va(base({ respuesta: "quizas" })), true);
    assert.equal(va(base({ respuesta: "pendiente" })), false); assert.equal(va(base({ respuesta: "no" })), false);
    assert.equal(va(base({ cancelado: true })), false); assert.equal(va(base({ fecha: null })), false);
    G("PLAN").lista = [base({ id: "x2", hora: "" }), base({ id: "x1" }), base({ id: "x3", respuesta: "pendiente" }), base({ id: "x4", fecha: mas(4) })];
    assert.deepEqual(clone(G("plDelDia")(mas(3)).map(p => p.id)), ["x1", "x2"]);
    G("PLAN").lista = null;
  });

  // La base local (pruebas y modo sin servidor), con las reglas de supabase/planes.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  como("u_b"); await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  como("u_d"); await LB.amigosPerfil({ nombre: "Dani" });
  for (const u of ["u_b", "u_c", "u_d"]) { como(u); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder(u, true); }
  const P = { titulo: " Ver Dune ", tipo: "pelicula", fecha: mas(3), hora: "21:00", lugar: " Casa de Ana ", enlace: "", tz: "America/Santiago" };
  const r = {};
  como("u_a");
  r.sinAmigos = await LB.planCrear(P, [], hoy);
  r.pasado = await LB.planCrear(Object.assign({}, P, { fecha: mas(-1) }), ["u_b"], hoy);
  r.enlaceMalo = await LB.planCrear(Object.assign({}, P, { enlace: "javascript:x" }), ["u_b"], hoy);
  r.unaOpcion = await LB.planCrear(Object.assign({}, P, { fecha: null, opciones: [{ fecha: mas(2) }] }), ["u_b"], hoy);
  r.crea = await LB.planCrear(P, ["u_b", "u_c", "u_b", "u_a"], hoy);
  const D = r.crea.id;
  como("u_b"); r.voy = await LB.planResponder(D, "voy"); r.mala = await LB.planResponder(D, "claro"); r.editaB = await LB.planEditar(D, P, hoy);
  como("u_c"); r.quizas = await LB.planResponder(D, "quizas");
  como("u_a"); r.creadorResponde = await LB.planResponder(D, "no");
  r.soloNombre = await LB.planEditar(D, Object.assign({}, P, { titulo: "Dune 2", fecha: null }), hoy);
  r.otroDia = await LB.planEditar(D, Object.assign({}, P, { fecha: mas(4), hora: "20:30" }), hoy);
  r.invita = await LB.planInvitar(D, ["u_d", "u_b"]);
  const V = (await LB.planCrear(Object.assign({}, P, { titulo: "Asado", tipo: "comer", fecha: null, opciones: [{ fecha: mas(3), hora: "20:00" }, { fecha: mas(4), hora: "" }, { fecha: mas(3), hora: "20:00" }] }), ["u_b", "u_c"], hoy)).id;
  r.listaV = (await LB.planLista(hoy)).find(p => p.id === V);
  const [o1, o2] = r.listaV.opciones.map(o => o.id);
  como("u_b"); r.votaB = await LB.planVotar(V, [o1, o2, 9999]); r.votaB2 = await LB.planVotar(V, [o1]); r.fijaB = await LB.planFijar(V, o1);
  como("u_c"); await LB.planVotar(V, [o1]);
  como("u_a"); r.votos = (await LB.planLista(hoy)).find(p => p.id === V).opciones.map(o => o.votos.length); r.fija = await LB.planFijar(V, o1);
  r.listaA = await LB.planLista(hoy);
  como("u_b"); r.votaTarde = await LB.planVotar(V, [o2]); r.listaB = await LB.planLista(hoy);
  como("u_d"); await LB.amigosBloquear("u_a"); r.listaD = await LB.planLista(hoy);
  como("u_a"); r.cancelaA = await LB.planCancelar(D);
  como("u_b"); r.respondeCancelado = await LB.planResponder(D, "no"); r.listaB2 = await LB.planLista(hoy);

  test("base local: se crea con amigos tuyos, de hoy en adelante, con un enlace web y (para votar) de 2 a 4 fechas", () => {
    assert.equal(r.sinAmigos.error, "amigos"); assert.equal(r.pasado.error, "fecha"); assert.equal(r.enlaceMalo.error, "enlace"); assert.equal(r.unaOpcion.error, "opciones");
    assert.ok(D);
  });
  test("base local: cada invitado responde (quien lo propuso, no); solo quien lo propuso lo cambia e invita", () => {
    assert.equal(r.voy.r, "voy"); assert.equal(r.mala.error, "respuesta"); assert.equal(r.editaB.error, "no-creador");
    assert.equal(r.quizas.r, "quizas"); assert.equal(r.creadorResponde.r, "nada");
    assert.equal(r.soloNombre.cambio, false); assert.equal(r.otroDia.cambio, true); assert.equal(r.invita.n, 1);
  });
  test("base local: se vota entre las fechas (la repetida, una vez) y quien lo propuso elige", () => {
    assert.equal(r.listaV.opciones.length, 2); assert.equal(r.listaV.fecha, null);
    assert.equal(r.votaB.n, 2); assert.equal(r.votaB2.n, 1); assert.equal(r.fijaB.error, "no-creador");
    assert.deepEqual(clone(r.votos), [2, 0]); assert.equal(r.fija.r, "fijado");
    const v = r.listaA.find(p => p.id === V);
    assert.equal(v.fecha, mas(3)); assert.equal(v.hora, "20:00"); assert.equal(v.opciones.length, 0);
    assert.equal(r.votaTarde.error, "votacion");
  });
  test("base local: tu lista trae quién va; bloquear te saca; un plan cancelado ya no se responde", () => {
    const d = r.listaB.find(p => p.id === D);
    assert.equal(d.titulo, "Ver Dune"); assert.equal(d.fecha, mas(4)); assert.equal(d.lugar, "Casa de Ana"); assert.equal(d.respuesta, "voy");
    assert.deepEqual(clone(d.miembros.map(m => m.nombre + ":" + m.respuesta)), ["Ana:voy", "Bruno:voy", "Cami:quizas", "Dani:pendiente"]);
    assert.equal(r.listaD.length, 0);
    assert.equal(r.cancelaA.r, "cancelado"); assert.equal(r.respondeCancelado.error, "cancelado");
    assert.equal(r.listaB2.find(p => p.id === D).cancelado, true);
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  /* -------- Avisos al celular (notifier/planes.mjs) -------- */
  const { mensajePlan, fechaPlan, firmaPlan, instantePlan, tocaRecordar, destinatariosPlan, avisoPlan, recordatoriosPlanes } = await import("../notifier/planes.mjs");
  const plan = { titulo: "Ver Dune", fecha: "2026-11-06", hora: "21:00", lugar: "casa de Ana", enlace: "", creador: "a", cancelado: false, tz: "America/Santiago" };
  test("los textos: te invitan (con fecha o a votar), respondió, ya hay fecha, cambió, se canceló y el de hoy", () => {
    assert.equal(fechaPlan("2026-11-06", "21:00"), "el vie 6 nov a las 21:00"); assert.equal(fechaPlan("2026-11-07", ""), "el sáb 7 nov");
    assert.deepEqual(mensajePlan("plan-invita", { nombre: "Ana", p: plan }), { title: "Ana te invita a un plan", body: "«Ver Dune», el vie 6 nov a las 21:00, en casa de Ana. ¿Vas?", url: "./#amigos", tag: "rumbo-plan-invita" });
    assert.equal(mensajePlan("plan-invita", { nombre: "Ana", p: Object.assign({}, plan, { fecha: null }) }).body, "«Ver Dune»: vota las fechas que te sirven.");
    assert.equal(mensajePlan("plan-responde", { nombre: "Pedro", p: plan, respuesta: "voy", van: 3 }).title, "Pedro va a «Ver Dune»");
    assert.equal(mensajePlan("plan-responde", { nombre: "Pedro", p: plan, respuesta: "voy", van: 3 }).body, "Ya van 3.");
    assert.equal(mensajePlan("plan-responde", { nombre: "Cami", p: plan, respuesta: "no", van: 1 }).title, "Cami no puede ir a «Ver Dune»");
    assert.equal(mensajePlan("plan-fecha", { p: plan }).title, "Ya hay fecha: «Ver Dune»");
    assert.equal(mensajePlan("plan-cambio", { p: Object.assign({}, plan, { lugar: "", enlace: "https://x.cl" }) }).body, "Ahora es el vie 6 nov a las 21:00, a distancia.");
    assert.equal(mensajePlan("plan-cancela", { nombre: "Ana", p: plan }).title, "Ana canceló «Ver Dune»");
    assert.deepEqual(mensajePlan("plan-hoy", { p: plan, con: "Ana y Pedro" }), { title: "Hoy: «Ver Dune» a las 21:00", body: "Con Ana y Pedro, en casa de Ana.", url: "./#amigos", tag: "rumbo-plan-hoy" });
    assert.equal(mensajePlan("plan-hoy", { p: Object.assign({}, plan, { lugar: "" }), con: "" }).body, "¡Que lo pasen bien!");
    assert.equal(mensajePlan("otro", {}), null);
  });
  test("la hora del plan es la de su zona (con horario de verano) y el recordatorio sale unas 3 horas antes", () => {
    assert.equal(instantePlan("2026-11-06", "21:00", "America/Santiago").toISOString(), "2026-11-07T00:00:00.000Z");
    assert.equal(instantePlan("2026-07-06", "21:00", "America/Santiago").toISOString(), "2026-07-07T01:00:00.000Z");
    assert.equal(instantePlan("2026-11-06", "21:00", "Zona/Rara").toISOString(), "2026-11-07T00:00:00.000Z");
    assert.equal(tocaRecordar(plan, new Date("2026-11-06T20:30:00Z")), false, "a las 17:30, todavía no");
    assert.equal(tocaRecordar(plan, new Date("2026-11-06T21:30:00Z")), true, "a las 18:30, sí");
    assert.equal(tocaRecordar(plan, new Date("2026-11-06T23:55:00Z")), false, "a 5 minutos, ya no");
    assert.equal(tocaRecordar(Object.assign({}, plan, { hora: "" }), new Date("2026-11-06T13:00:00Z")), true, "sin hora: en la mañana");
    assert.equal(tocaRecordar(Object.assign({}, plan, { cancelado: true }), new Date("2026-11-06T21:30:00Z")), false);
  });
  test("a quién le llega: la invitación a quienes invitaste; la fecha o el cambio a quienes no dijeron que no; cancelar, igual", () => {
    const inv = [{ user_id: "a", respuesta: "voy" }, { user_id: "b", respuesta: "pendiente", invita: "a" }, { user_id: "c", respuesta: "pendiente", invita: "a", avisos: { invita: true } },
      { user_id: "d", respuesta: "no", invita: "a", avisos: { firma: "|||" } }, { user_id: "e", respuesta: "voy", invita: "a", avisos: { firma: firmaPlan(plan) } }, { user_id: "f", respuesta: "quizas", invita: "a", avisos: { firma: "2026-11-05|20:00||" } }];
    assert.deepEqual(destinatariosPlan("plan-invita", { p: plan, invitados: inv, yo: "a" }).map(x => x.uid), ["b"]);
    assert.equal(destinatariosPlan("plan-invita", { p: plan, invitados: inv, yo: "b" }), null, "solo quien lo propuso invita");
    const c = destinatariosPlan("plan-cambio", { p: plan, invitados: inv, yo: "a" });
    assert.deepEqual(c.map(x => x.uid + ":" + x.tipo), ["b:plan-cambio", "c:plan-cambio", "f:plan-cambio"]);
    assert.deepEqual(destinatariosPlan("plan-fecha", { p: plan, invitados: inv, yo: "a" }).map(x => x.tipo), ["plan-fecha", "plan-fecha", "plan-fecha"]);
    assert.equal(destinatariosPlan("plan-fecha", { p: Object.assign({}, plan, { fecha: null }), invitados: inv, yo: "a" }), null, "sin fecha, no hay qué avisar");
    assert.equal(destinatariosPlan("plan-cancela", { p: plan, invitados: inv, yo: "a" }), null, "sin cancelar, no se avisa que se canceló");
    assert.deepEqual(destinatariosPlan("plan-cancela", { p: Object.assign({}, plan, { cancelado: true }), invitados: inv, yo: "a" }).map(x => x.uid), ["b", "c", "e", "f"]);
  });

  function sbFalso(tablas) {
    return {
      from(t) {
        const filtros = []; let upd = null, cols = "";
        const correr = () => {
          const rs = (tablas[t] || []).filter(x => filtros.every(f => f(x)));
          if (upd) { rs.forEach(x => Object.assign(x, clone(upd))); return rs; }
          if (cols.includes("notif:data->settings->notif")) return rs.map(x => ({ notif: ((x.data || {}).settings || {}).notif ?? null }));
          return rs;
        };
        const q = {
          select(c) { cols = c; return q; }, update(o) { upd = o; return q; },
          eq(k, v) { filtros.push(x => x[k] === v); return q; }, in(k, vs) { filtros.push(x => vs.includes(x[k])); return q; },
          gte(k, v) { filtros.push(x => x[k] >= v); return q; }, lte(k, v) { filtros.push(x => x[k] <= v); return q; },
          async maybeSingle() { return { data: correr()[0] || null, error: null }; },
          then(ok, ko) { return Promise.resolve({ data: correr(), error: null }).then(ok, ko); },
        };
        return q;
      },
    };
  }
  const ID = "11111111-2222-3333-4444-555555555555", A = "aaaaaaaa-0000-0000-0000-000000000000", B = "bbbbbbbb-0000-0000-0000-000000000000", C = "cccccccc-0000-0000-0000-000000000000";
  const TARDE = new Date("2026-11-06T21:30:00Z");   // 18:30 en Santiago
  const tablas = () => ({
    planes: [Object.assign({ id: ID }, plan, { creador: A })],
    planes_invitados: [
      { plan: ID, user_id: A, respuesta: "voy", invita: null, avisos: {} },
      { plan: ID, user_id: B, respuesta: "voy", invita: A, avisos: {} },
      { plan: ID, user_id: C, respuesta: "pendiente", invita: A, avisos: {} },
    ],
    perfiles: [{ user_id: A, nombre: "Ana" }, { user_id: B, nombre: "Bruno" }, { user_id: C, nombre: "Cami" }],
    estado_usuario: [A, B, C].map(u => ({ user_id: u, data: { settings: { notif: { tz: "America/Santiago" } } } })),
    suscripciones_push: [A, B, C].map(u => ({ id: u, user_id: u, endpoint: "https://push/" + u })),
  });
  const enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds[0].user_id, msg.title]); return { enviadas: ds.length }; };
  const t1 = tablas(), sb1 = sbFalso(t1);
  const inv1 = await avisoPlan({ sb: sb1, yo: A, body: { tipo: "plan-invita", plan: ID }, enviar, ahora: TARDE });
  const inv2 = await avisoPlan({ sb: sb1, yo: A, body: { tipo: "plan-invita", plan: ID }, enviar, ahora: TARDE });
  const resp1 = await avisoPlan({ sb: sb1, yo: B, body: { tipo: "plan-responde", plan: ID }, enviar, ahora: TARDE });
  const resp2 = await avisoPlan({ sb: sb1, yo: B, body: { tipo: "plan-responde", plan: ID }, enviar, ahora: TARDE });
  const ajeno = await avisoPlan({ sb: sb1, yo: B, body: { tipo: "plan-cambio", plan: ID }, enviar, ahora: TARDE });
  t1.planes[0].hora = "22:00";
  const cambio = await avisoPlan({ sb: sb1, yo: A, body: { tipo: "plan-cambio", plan: ID }, enviar, ahora: TARDE });
  const noche = await avisoPlan({ sb: sb1, yo: A, body: { tipo: "plan-invita", plan: ID }, enviar, ahora: new Date("2026-11-07T03:00:00Z") });
  test("los avisos que pide la app: una vez cada uno, a quien corresponde", () => {
    assert.equal(inv1.enviadas, 1); assert.equal(inv2.motivo, "nadie");
    assert.equal(resp1.enviadas, 1); assert.equal(resp2.motivo, "ya-avisado"); assert.equal(ajeno.motivo, "no-corresponde");
    assert.equal(cambio.enviadas, 2, "a Bruno (va) y a Cami (invitada, sin responder)");
    assert.equal(noche.motivo, "nadie");
    assert.deepEqual(enviados.splice(0), [[C, "Ana te invita a un plan"], [A, "Bruno va a «Ver Dune»"], [B, "Cambió el plan «Ver Dune»"], [C, "Cambió el plan «Ver Dune»"]]);
  });
  const t2 = tablas(), sb2 = sbFalso(t2);
  t2.planes.push(Object.assign({}, plan, { id: "otro", fecha: "2026-11-20", creador: A }), Object.assign({}, plan, { id: "cancelado", cancelado: true, creador: A }));
  const rec1 = await recordatoriosPlanes({ sb: sb2, enviar, ahora: TARDE });
  const rec2 = await recordatoriosPlanes({ sb: sb2, enviar, ahora: new Date("2026-11-06T22:00:00Z") });
  const temprano = await recordatoriosPlanes({ sb: sb2, enviar, ahora: new Date("2026-11-06T15:00:00Z") });
  test("el recordatorio del día: a quienes van, con quiénes van, una sola vez", () => {
    assert.equal(rec1.planes, 1); assert.equal(rec1.enviadas, 2); assert.equal(rec2.enviadas, 0); assert.equal(temprano.planes, 0);
    assert.deepEqual(enviados.splice(0), [[A, "Hoy: «Ver Dune» a las 21:00"], [B, "Hoy: «Ver Dune» a las 21:00"]]);
    assert.equal(t2.planes_invitados[0].avisos.recuerda, "2026-11-06|21:00");
    const m = mensajePlan("plan-hoy", { p: plan, con: "Bruno" }); assert.equal(m.body, "Con Bruno, en casa de Ana.");
  });
}
