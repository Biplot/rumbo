/* Tests de «después del plan» (planes-despues.js, store.js y notifier/planes.mjs): la cuenta (saldos, quién le
   debe a quién, tu parte y Finanzas), cómo estuvo (al diario), las reglas de la base local y los avisos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nDespués del plan");
  if (G("typeof icoUI") === "undefined") G(`var icoUI = n => "<svg data-i='" + n + "'></svg>"`);
  const limpio = G("plLimpio"), saldos = G("plSaldos"), deudas = G("plDeudas"), miParte = G("plMiParte"), debo = G("plDebo"), falta = G("plFaltaComo");
  const sumar = G("plSumarFinanzas"), alDiario = G("plComoAlDiario");
  const LB = G("LocalBackend"), ls = G("localStorage"), defaultState = G("defaultState"), migrate = G("migrate");
  const hoy = G("todayISO()"), mas = n => G(`agSumar(${JSON.stringify(hoy)}, ${n})`);

  const base = (o = {}) => limpio(Object.assign({
    id: "p1", titulo: "Asado", tipo: "comer", fecha: mas(-1), hora: "20:00", creador: "a", respuesta: "voy",
    miembros: [{ id: "a", nombre: "Ana", respuesta: "voy" }, { id: "b", yo: true, nombre: "Bruno", respuesta: "voy" }, { id: "c", nombre: "Cami", respuesta: "quizas" }],
    gastos: [
      { id: 1, user_id: "a", monto: "18000", detalle: "Carne", para: ["a", "b", "c"] },
      { id: 2, user_id: "c", monto: 3000, detalle: "Pan", para: ["a", "b", "c"] },
    ],
    recuerdos: [],
  }, o));

  test("lo que llega de la cuenta y de cómo estuvo se limpia", () => {
    const p = clone(limpio({ id: "x", gastos: [{ id: "3", user_id: "a", monto: "-5", para: ["a"] }, { id: 4, user_id: "a", monto: "1500.555", detalle: "D".repeat(90), para: ["a", "b"], pago: 1 }, { id: 5, user_id: "", monto: 10, para: ["a"] }],
      recuerdos: [{ id: "a", estrellas: 9, frase: "F".repeat(200), compartir: "sí" }, { estrellas: 3 }] }));
    assert.equal(p.gastos.length, 1); assert.equal(p.gastos[0].monto, 1500.56); assert.equal(p.gastos[0].detalle.length, 60); assert.equal(p.gastos[0].pago, true);
    assert.deepEqual(p.recuerdos, [{ id: "a", estrellas: 5, frase: "F".repeat(140), compartir: true }]);
  });
  test("la cuenta: cada gasto en partes iguales; quién le debe a quién para quedar a mano", () => {
    const p = base();
    assert.deepEqual(clone(saldos(p)), { a: 11000, b: -7000, c: -4000 });
    assert.deepEqual(clone(deudas(p)), [{ de: "b", a: "a", monto: 7000 }, { de: "c", a: "a", monto: 4000 }]);
    assert.equal(miParte(p), 7000); assert.equal(debo(p), 7000);
  });
  test("un pago salda la deuda; con decimales, se redondea y no quedan deudas de centavos", () => {
    const p = base({ gastos: [{ id: 1, user_id: "a", monto: 18000, para: ["a", "b", "c"] }, { id: 2, user_id: "b", monto: 6000, para: ["a"], pago: true }] });
    assert.deepEqual(clone(deudas(p)), [{ de: "c", a: "a", monto: 6000 }]);
    assert.equal(debo(p), 0); assert.equal(miParte(p), 6000, "el pago no cuenta como tu parte");
    const q = base({ gastos: [{ id: 1, user_id: "a", monto: 10000, para: ["a", "b", "c"] }] });
    assert.deepEqual(clone(deudas(q).map(d => d.monto)), [3333, 3333]);
  });
  test("¿cómo estuvo?: se pregunta si fuiste, ya pasó (hasta una semana) y no lo has contado", () => {
    assert.equal(falta(base()), true);
    assert.equal(falta(base({ recuerdos: [{ id: "b", estrellas: 4 }] })), false);
    assert.equal(falta(base({ fecha: hoy })), false); assert.equal(falta(base({ fecha: mas(-9) })), false);
    assert.equal(falta(base({ respuesta: "no" })), false); assert.equal(falta(base({ cancelado: true })), false);
  });
  test("tu parte, al gasto del mes en Finanzas: una vez, y si cambia, se ajusta", () => {
    const s = migrate(defaultState()), p = base(), m = +p.fecha.slice(5, 7) - 1, y = +p.fecha.slice(0, 4);
    const gasto = () => G("datosAnio")(s, y).finanzas.meses[m].gasto;
    const antes = gasto();
    sumar(s, p, 7000); assert.equal(gasto() - antes, 7000);
    sumar(s, p, 7000); assert.equal(gasto() - antes, 7000, "sumarla de nuevo no la duplica");
    sumar(s, p, 9000); assert.equal(gasto() - antes, 9000, "si cambió, se ajusta");
    assert.deepEqual(clone(s.finanzas.planes.p1), { monto: 9000, mes: p.fecha.slice(0, 7) });
  });
  test("cómo estuvo queda en tu diario: una entrada por plan, en el día del plan", () => {
    const s = migrate(defaultState());
    G("var __estado = STATE, __guardar = saveState"); G("STATE = " + JSON.stringify(s)); G("saveState = () => {}");
    alDiario(base(), 4, "Buenísimo"); alDiario(base(), 5, "Mejor aún");
    const es = clone(G("STATE.vida.diario")).filter(e => e.fromPlan === "p1");
    assert.equal(es.length, 1); assert.equal(es[0].fecha, mas(-1)); assert.equal(es[0].estrellas, 5); assert.equal(es[0].texto, "Mejor aún"); assert.equal(es[0].con, "Ana", "con los que fueron");
    G("STATE = __estado; saveState = __guardar");
  });

  // La base local, con las reglas de supabase/planes.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  for (const [u, n] of [["u_b", "Bruno"], ["u_c", "Cami"]]) { como(u); await LB.amigosPerfil({ nombre: n }); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder(u, true); }
  como("u_a");
  const P = (await LB.planCrear({ titulo: "Asado", tipo: "comer", fecha: hoy, hora: "13:00", lugar: "", enlace: "" }, ["u_b", "u_c"], hoy)).id;
  const F = (await LB.planCrear({ titulo: "Cine", tipo: "pelicula", fecha: mas(3), hora: "", lugar: "", enlace: "" }, ["u_b"], hoy)).id;
  const r = {};
  como("u_b"); await LB.planResponder(P, "voy");
  como("u_c"); r.cNoVa = await LB.planGasto(P, 1000, "", ["u_c"], false); r.cRecuerda = await LB.planRecordar(P, 4, "", false, hoy);
  como("u_a");
  r.futuro = await LB.planRecordar(F, 5, "", false, hoy);
  r.malas = await LB.planRecordar(P, 0, "", false, hoy);
  r.nuevo = await LB.planRecordar(P, 4, "  Rico  ", false, hoy); r.cambia = await LB.planRecordar(P, 5, "Rico", true, hoy);
  r.cero = await LB.planGasto(P, 0, "", ["u_a"], false);
  r.ajeno = await LB.planGasto(P, 1000, "", ["u_a", "u_c"], false);
  r.g1 = await LB.planGasto(P, 18000, " Carne ", ["u_a", "u_b", "u_b"], false);
  r.pagoMio = await LB.planGasto(P, 9000, "Pago", ["u_a"], true);
  como("u_b"); r.recB = await LB.planRecordar(P, 3, "Bien", false, hoy); r.pago = await LB.planGasto(P, 9000, "Pago", ["u_a"], true); r.borraAjeno = await LB.planGastoBorrar(r.g1.id);
  r.listaB = (await LB.planLista(hoy)).find(p => p.id === P);
  como("u_a"); r.listaA = (await LB.planLista(hoy)).find(p => p.id === P);
  test("base local: cómo estuvo, solo si fuiste y ya es el día; la primera vez «nuevo»; lo ven si lo compartes", () => {
    assert.equal(r.cNoVa.error, "no-miembro"); assert.equal(r.cRecuerda.error, "no-miembro");
    assert.equal(r.futuro.error, "fecha"); assert.equal(r.malas.error, "estrellas");
    assert.equal(r.nuevo.r, "nuevo"); assert.equal(r.cambia.r, "cambiado");
    assert.deepEqual(clone(r.listaB.recuerdos.map(x => x.id + ":" + x.estrellas)), ["u_a:5", "u_b:3"]);
    assert.deepEqual(clone(r.listaA.recuerdos.map(x => x.id)), ["u_a"], "Ana no ve lo de Bruno (no lo compartió)");
  });
  test("base local: la cuenta, entre quienes van; un pago es a otro; solo quien lo anotó lo borra", () => {
    assert.equal(r.cero.error, "monto"); assert.equal(r.ajeno.error, "para"); assert.equal(r.pagoMio.error, "para");
    assert.deepEqual(clone(r.listaA.gastos.map(g => [g.user_id, g.monto, g.detalle, g.para.length, g.pago])), [["u_a", 18000, "Carne", 2, false], ["u_b", 9000, "Pago", 1, true]]);
    assert.equal(r.borraAjeno.r, "nada");
    assert.deepEqual(clone(deudas(limpio(r.listaA))), [], "con el pago de Bruno, quedan a mano");
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  /* -------- Avisos (notifier/planes.mjs) -------- */
  const { mensajePlan, tocaComo, avisoPlan, recordatoriosPlanes, fmtPesos } = await import("../notifier/planes.mjs");
  test("los textos: anotó un gasto, te pagó y ¿cómo estuvo?", () => {
    const p = { titulo: "Asado" };
    assert.equal(fmtPesos(18000), "$18.000");
    assert.deepEqual(mensajePlan("plan-gasto", { nombre: "Ana", p, monto: 18000, parte: 6000 }), { title: "Ana anotó $18.000 en la cuenta de «Asado»", body: "Te toca $6.000. La cuenta está en el plan.", url: "./#amigos", tag: "rumbo-plan-gasto" });
    assert.equal(mensajePlan("plan-pago", { nombre: "Bruno", p, monto: 6000 }).title, "Bruno te pagó $6.000");
    assert.deepEqual(mensajePlan("plan-como", { p }), { title: "¿Cómo estuvo «Asado»?", body: "Cuéntalo en tu diario: +10 de estrellas.", url: "./#inicio", tag: "rumbo-plan-como" });
  });
  test("¿cómo estuvo? se pregunta al día siguiente, de 10:00 a 20:00", () => {
    const p = { fecha: "2026-11-06", hora: "21:00", tz: "America/Santiago" };
    assert.equal(tocaComo(p, new Date("2026-11-07T12:30:00Z")), false, "a las 9:30, todavía no");
    assert.equal(tocaComo(p, new Date("2026-11-07T14:00:00Z")), true, "a las 11:00, sí");
    assert.equal(tocaComo(p, new Date("2026-11-07T23:30:00Z")), false, "a las 20:30, ya no");
    assert.equal(tocaComo(Object.assign({}, p, { cancelado: true }), new Date("2026-11-07T14:00:00Z")), false);
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
  const DIA = new Date("2026-11-07T15:00:00Z");   // 12:00 del día siguiente en Santiago
  const t = {
    planes: [{ id: ID, titulo: "Asado", fecha: "2026-11-06", hora: "20:00", lugar: "", enlace: "", creador: A, cancelado: false, tz: "America/Santiago" }],
    planes_invitados: [
      { plan: ID, user_id: A, respuesta: "voy", avisos: {} }, { plan: ID, user_id: B, respuesta: "voy", invita: A, avisos: {} }, { plan: ID, user_id: C, respuesta: "quizas", invita: A, avisos: {} },
    ],
    planes_gastos: [
      { id: 1, plan: ID, user_id: A, monto: "18000.00", para: [A, B, C], pago: false, creado: "2026-11-07T14:58:00Z" },
      { id: 2, plan: ID, user_id: B, monto: "6000.00", para: [A], pago: true, creado: "2026-11-07T14:59:00Z" },
      { id: 3, plan: ID, user_id: A, monto: "5000.00", para: [A, B], pago: false, creado: "2026-11-06T14:00:00Z" },
    ],
    planes_recuerdos: [{ plan: ID, user_id: C, estrellas: 4 }],
    perfiles: [{ user_id: A, nombre: "Ana" }, { user_id: B, nombre: "Bruno" }, { user_id: C, nombre: "Cami" }],
    estado_usuario: [A, B, C].map(u => ({ user_id: u, data: { settings: { notif: { tz: "America/Santiago" } } } })),
    suscripciones_push: [A, B, C].map(u => ({ id: u, user_id: u, endpoint: "https://push/" + u })),
  };
  const sb = sbFalso(t), enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds[0].user_id, msg.title, msg.body]); return { enviadas: ds.length }; };
  const av = {};
  av.gasto = await avisoPlan({ sb, yo: A, body: { tipo: "plan-gasto", plan: ID, gasto: 1 }, enviar, ahora: DIA });
  av.gasto2 = await avisoPlan({ sb, yo: A, body: { tipo: "plan-gasto", plan: ID, gasto: 1 }, enviar, ahora: DIA });
  av.ajeno = await avisoPlan({ sb, yo: B, body: { tipo: "plan-gasto", plan: ID, gasto: 1 }, enviar, ahora: DIA });
  av.viejo = await avisoPlan({ sb, yo: A, body: { tipo: "plan-gasto", plan: ID, gasto: 3 }, enviar, ahora: DIA });
  av.pago = await avisoPlan({ sb, yo: B, body: { tipo: "plan-gasto", plan: ID, gasto: 2 }, enviar, ahora: DIA });
  av.pago2 = await avisoPlan({ sb, yo: B, body: { tipo: "plan-gasto", plan: ID, gasto: 2 }, enviar, ahora: DIA });
  test("los avisos de la cuenta: a los que comparten el gasto (uno al día) y el pago a quien lo recibe", () => {
    assert.equal(av.gasto.enviadas, 2); assert.equal(av.gasto2.motivo, "nadie"); assert.equal(av.ajeno.motivo, "no-corresponde"); assert.equal(av.viejo.motivo, "no-corresponde");
    assert.equal(av.pago.enviadas, 1); assert.equal(av.pago2.motivo, "nadie");
    assert.deepEqual(enviados.splice(0), [[B, "Ana anotó $18.000 en la cuenta de «Asado»", "Te toca $6.000. La cuenta está en el plan."], [C, "Ana anotó $18.000 en la cuenta de «Asado»", "Te toca $6.000. La cuenta está en el plan."],
      [A, "Bruno te pagó $6.000", "Por la cuenta de «Asado». Ya está anotado."]]);
  });
  const rec1 = await recordatoriosPlanes({ sb, enviar, ahora: DIA });
  const rec2 = await recordatoriosPlanes({ sb, enviar, ahora: new Date("2026-11-07T16:00:00Z") });
  test("al día siguiente, «¿Cómo estuvo?» a quienes fueron y no lo han contado, una vez", () => {
    assert.equal(rec1.enviadas, 2); assert.equal(rec2.enviadas, 0);
    assert.deepEqual(enviados.splice(0).map(x => x[0] + ":" + x[1]), [A + ":¿Cómo estuvo «Asado»?", B + ":¿Cómo estuvo «Asado»?"]);
    assert.equal(t.planes_invitados[0].avisos.como, "2026-11-06");
  });
}
