/* Tests de los objetivos en conjunto (objetivos.js, store.js y notifier/objetivos.mjs): lo que llega de otros
   (se limpia), la barra de cada uno, el plazo, las reglas de la base local, la medalla y los avisos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nObjetivos en conjunto");
  if (G("typeof iconoDeEmoji") === "undefined") G(`var iconoDeEmoji = e => null`);
  if (G("typeof icoUI") === "undefined") G(`var icoUI = n => "<svg data-i='" + n + "'></svg>"`);
  const limpio = G("ojLimpio"), personas = G("ojPersonas"), total = G("ojTotal"), pct = G("ojPct"), fmt = G("ojFmt"), plazo = G("ojPlazo");
  const LB = G("LocalBackend"), ls = G("localStorage"), findBadge = G("findBadge"), defaultState = G("defaultState"), migrate = G("migrate"), ledgerRegistrar = G("ledgerRegistrar");
  const hoy = G("todayISO()"), mas = n => G(`hmAdd(${JSON.stringify(hoy)}, ${n})`);

  const base = () => limpio({
    id: "o1", nombre: " Viaje a Chiloé ", unidad: "$", meta: "600000", fecha_limite: mas(12), creado: hoy, cumplido: null, estado: "activo", invita: "",
    miembros: [{ id: "b", nombre: "Bruno", estado: "activo", desde: hoy }, { id: "a", yo: true, nombre: "Ana", estado: "activo", desde: hoy }, { id: "c", nombre: "Cami", estado: "invitado" }],
    totales: [{ id: "a", nombre: "Ana", total: 215000 }, { id: "b", nombre: "Bruno", total: "165000" }, { id: "z", nombre: "Zoe", total: 20000 }],
    aportes: [{ id: "7", user_id: "a", cantidad: 15000, nota: "x".repeat(200), fecha: hoy }],
  });

  test("lo que llega del servidor se limpia: textos cortos, números y fechas", () => {
    const o = clone(limpio({ id: "x", nombre: "<b>" + "N".repeat(90), unidad: "kilómetros largos", meta: "abc", fecha_limite: "2026-13-99<x>", cumplido: "mal", estado: "raro",
      miembros: [{ id: "u", estado: "activo", desde: "2026-11-01", nombre: "<img src=x>" }], totales: [{ id: "u", total: -5 }], aportes: [{ id: "1<x>", cantidad: "NaN" }] }));
    assert.equal(o.nombre.length, 60); assert.equal(o.unidad, "kilómetros l"); assert.equal(o.meta, 1);
    assert.equal(o.cumplido, ""); assert.equal(o.estado, "invitado"); assert.equal(o.totales[0].total, 0); assert.equal(o.aportes[0].id, 1); assert.equal(o.aportes[0].cantidad, 0);
    assert.equal(base().aportes[0].nota.length, 80);
  });

  test("la barra: tú primero, luego quienes están y al final quienes salieron (en gris); el total y el %", () => {
    const o = base(), ps = personas(o);
    assert.deepEqual(clone(ps.map(p => [p.nombre, p.total])), [["Tú", 215000], ["Bruno", 165000], ["Zoe (salió)", 20000]]);
    assert.equal(ps[2].color, G("OJ_GRIS")); assert.notEqual(ps[0].color, ps[1].color);
    assert.equal(total(o), 400000); assert.equal(pct(o), 66);
    assert.equal(fmt(380000, "$"), "$380.000"); assert.equal(fmt(12.5, "horas"), "12,5 horas"); assert.equal(fmt(3, ""), "3");
  });

  test("el plazo: cuántos días quedan, vence hoy, terminó o lo lograron", () => {
    const o = base();
    assert.ok(plazo(o).endsWith("quedan 12 días"));
    assert.equal(plazo(Object.assign(base(), { fechaLimite: hoy })), "vence hoy");
    assert.ok(plazo(Object.assign(base(), { fechaLimite: mas(-3) })).startsWith("terminó el "));
    assert.equal(plazo(Object.assign(base(), { fechaLimite: "" })), "sin fecha límite");
    assert.ok(plazo(Object.assign(base(), { cumplido: hoy })).startsWith("Lo lograron el "));
  });

  test("la medalla En Equipo: en La Medalla del cielo, se gana al lograr el primer objetivo juntos", () => {
    const b = findBadge("en-equipo");
    assert.ok(b && b.reward === 150);
    const s = migrate(defaultState());
    assert.equal(b.check(s), false);
    ledgerRegistrar(s, "objetivo-juntos:o1", 20, 20, "Objetivo en conjunto");
    assert.equal(b.check(s), true);
    assert.equal(G("cieloFamilia")("en-equipo").id, "vida");
  });

  // La base local (pruebas y modo sin servidor), con las reglas de supabase/objetivos.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  como("u_b"); await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  como("u_b"); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder("u_b", true);
  const r = {};
  como("u_a");
  r.sinAmigos = await LB.objetivoCrear("Viaje", "$", 600000, null, [], hoy);
  r.noAmiga = await LB.objetivoCrear("Viaje", "$", 600000, null, ["u_c"], hoy);
  r.sinMeta = await LB.objetivoCrear("Viaje", "$", 0, null, ["u_b"], hoy);
  r.crea = await LB.objetivoCrear(" Viaje a Chiloé ", "$", 600000, "2026-12-15", ["u_b", "u_a"], hoy);
  const V = r.crea.id;
  como("u_b"); r.antes = await LB.objetivoAportar(V, 100, "", hoy); r.une = await LB.objetivoResponder(V, true, hoy);
  r.negativo = await LB.objetivoAportar(V, -5, "", hoy);
  r.b1 = await LB.objetivoAportar(V, 165000, "  vendí la bici  ", hoy);
  como("u_a"); r.a1 = await LB.objetivoAportar(V, 215000, "", hoy); r.ajeno = await LB.objetivoBorrarAporte(r.b1.id);
  r.a2 = await LB.objetivoAportar(V, 220000, "", hoy); r.lista = await LB.objetivoLista();
  r.sube = await LB.objetivoEditar(V, "Viaje a Chiloé y Castro", "$", 900000, null);
  r.borra = await LB.objetivoBorrarAporte(r.a2.id);
  como("u_b"); r.sale = await LB.objetivoSalir(V);
  como("u_a"); r.trasSalir = await LB.objetivoLista();
  r.k = await LB.objetivoCrear("100 km", "km", 100, null, ["u_b"], hoy);
  como("u_b"); await LB.objetivoResponder(r.k.id, true, hoy); await LB.amigosBloquear("u_a"); r.bloq = await LB.objetivoLista();
  como("u_a"); await LB.objetivoSalir(V); await LB.objetivoSalir(r.k.id); r.db = clone(LB._amDb());

  test("base local: se crea con amigos tuyos y una meta mayor que cero", () => {
    assert.equal(r.sinAmigos.error, "amigos"); assert.equal(r.noAmiga.error, "no-amigos"); assert.equal(r.sinMeta.error, "meta"); assert.ok(V);
  });
  test("base local: aportar solo si estás, solo positivo; cada uno lleva lo suyo y se cumple al llegar", () => {
    assert.equal(r.antes.error, "no-miembro"); assert.equal(r.une.r, "unido"); assert.equal(r.negativo.error, "cantidad");
    assert.equal(r.b1.total, 165000); assert.equal(r.a1.total, 380000); assert.equal(r.ajeno, null);
    assert.equal(r.a2.cumplido, true); assert.equal(r.a2.recien, true);
    const o = r.lista[0];
    assert.equal(o.nombre, "Viaje a Chiloé"); assert.equal(o.cumplido, hoy);
    assert.deepEqual(clone(o.totales.map(t => [t.nombre, t.total]).sort()), [["Ana", 435000], ["Bruno", 165000]]);
    assert.equal(o.aportes[0].cantidad, 220000); assert.equal(o.aportes.find(a => a.user_id === "u_b").nota, "vendí la bici");
  });
  test("base local: si suben la meta o se borra un aporte y ya no llega, vuelve a estar en curso", () => {
    assert.equal(r.sube.cumplido, false); assert.equal(r.borra.total, 380000);
  });
  test("base local: al salir, tus aportes siguen; bloquear te saca; sin nadie, se borra", () => {
    assert.equal(r.sale.r, "salio");
    assert.equal(r.trasSalir[0].miembros.length, 1); assert.ok(r.trasSalir[0].totales.some(t => t.nombre === "Bruno" && t.total === 165000));
    assert.equal(r.bloq.length, 0);
    assert.equal(r.db.objetivos.length, 0); assert.equal(r.db.oaportes.length, 0);
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  /* -------- Avisos al celular (notifier/objetivos.mjs) -------- */
  const { avisoObjetivo, destinatariosAporte, mensajeObjetivo, fmtObjetivo } = await import("../notifier/objetivos.mjs");
  test("los textos: invitación, se sumó, aportó (con cuánto van) y lo lograron", () => {
    const o = { nombre: "Viaje a Chiloé", unidad: "$", meta: 600000 };
    assert.equal(fmtObjetivo(380000, "$"), fmt(380000, "$")); assert.equal(fmtObjetivo(64.5, "km"), fmt(64.5, "km"));
    assert.deepEqual(mensajeObjetivo("objetivo-invita", { nombre: "Ana", o }), { title: "Ana te invita a un objetivo", body: "«Viaje a Chiloé»: lograr $600.000 juntos en Rumbo.", url: "./#amigos", tag: "rumbo-objetivo-invita" });
    assert.equal(mensajeObjetivo("objetivo-acepta", { nombre: "Bruno", o }).title, "Bruno se sumó a «Viaje a Chiloé»");
    const ap = mensajeObjetivo("aporte", { nombre: "Ana", o, total: 380000, cantidad: 20000 });
    assert.equal(ap.title, "Ana sumó $20.000 a «Viaje a Chiloé»"); assert.equal(ap.body, "Van $380.000 de $600.000 (63 %).");
    assert.equal(mensajeObjetivo("cumplido", { o, total: 600000 }).title, "¡Lo lograron! «Viaje a Chiloé»");
    assert.equal(mensajeObjetivo("otro", {}), null);
  });
  test("al aportar: a los demás, un aviso al día; al lograrlo, un aviso a cada uno", () => {
    const ms = [{ user_id: "a", estado: "activo" }, { user_id: "b", estado: "activo", avisos: { aporte: "2026-11-04" } }, { user_id: "c", estado: "activo" }, { user_id: "d", estado: "invitado" }];
    assert.deepEqual(destinatariosAporte({ miembros: ms, yo: "a", cumplido: false, fecha: "2026-11-04" }), { tipo: "aporte", para: ["c"], cambio: { aporte: "2026-11-04" } });
    assert.deepEqual(destinatariosAporte({ miembros: ms, yo: "a", cumplido: true, fecha: "2026-11-04" }).para, ["b", "c"]);
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
          eq(k, v) { filtros.push(x => x[k] === v); return q; },
          async maybeSingle() { return { data: correr()[0] || null, error: null }; },
          then(ok, ko) { return Promise.resolve({ data: correr(), error: null }).then(ok, ko); },
        };
        return q;
      },
    };
  }
  const O = "11111111-2222-3333-4444-555555555555", A = "aaaaaaaa-0000-0000-0000-000000000000", B = "bbbbbbbb-0000-0000-0000-000000000000", C = "cccccccc-0000-0000-0000-000000000000";
  const MEDIODIA = new Date("2026-11-04T15:00:00Z");
  const t = {
    objetivos_conjunto: [{ id: O, nombre: "Viaje a Chiloé", unidad: "$", meta: "600000.00", cumplido: null }],
    objetivos_conjunto_miembros: [
      { objetivo: O, user_id: A, estado: "activo", invita: null, avisos: {} },
      { objetivo: O, user_id: B, estado: "activo", invita: A, avisos: {} },
      { objetivo: O, user_id: C, estado: "invitado", invita: A, avisos: {} },
    ],
    objetivos_conjunto_aportes: [
      { id: 1, objetivo: O, user_id: A, cantidad: "215000.00", fecha: "2026-11-04", creado: "2026-11-04T14:58:00Z" },
      { id: 2, objetivo: O, user_id: B, cantidad: "165000.00", fecha: "2026-11-03", creado: "2026-11-03T14:00:00Z" },
    ],
    perfiles: [{ user_id: A, nombre: "Ana" }, { user_id: B, nombre: "Bruno" }, { user_id: C, nombre: "Cami" }],
    estado_usuario: [A, B, C].map(u => ({ user_id: u, data: { settings: { notif: {} } } })),
    suscripciones_push: [A, B, C].map((u, i) => ({ id: i, user_id: u, endpoint: "https://push/" + u })),
  };
  const sb = sbFalso(t), enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds.map(d => d.user_id), msg.title, msg.body]); return { enviadas: ds.length }; };
  r.av = {};
  r.av.invita = await avisoObjetivo({ sb, yo: A, body: { tipo: "objetivo-invita", objetivo: O }, enviar, ahora: MEDIODIA });
  r.av.invita2 = await avisoObjetivo({ sb, yo: A, body: { tipo: "objetivo-invita", objetivo: O }, enviar, ahora: MEDIODIA });
  r.av.acepta = await avisoObjetivo({ sb, yo: B, body: { tipo: "objetivo-acepta", objetivo: O }, enviar, ahora: MEDIODIA });
  r.av.viejo = await avisoObjetivo({ sb, yo: B, body: { tipo: "objetivo-aporte", objetivo: O, aporte: 2 }, enviar, ahora: MEDIODIA });
  r.av.ajeno = await avisoObjetivo({ sb, yo: B, body: { tipo: "objetivo-aporte", objetivo: O, aporte: 1 }, enviar, ahora: MEDIODIA });
  r.av.aporte = await avisoObjetivo({ sb, yo: A, body: { tipo: "objetivo-aporte", objetivo: O, aporte: 1 }, enviar, ahora: MEDIODIA });
  r.av.aporte2 = await avisoObjetivo({ sb, yo: A, body: { tipo: "objetivo-aporte", objetivo: O, aporte: 1 }, enviar, ahora: MEDIODIA });
  t.objetivos_conjunto_aportes.push({ id: 3, objetivo: O, user_id: B, cantidad: "220000", fecha: "2026-11-04", creado: "2026-11-04T14:59:00Z" });
  t.objetivos_conjunto[0].cumplido = "2026-11-04";
  r.av.logro = await avisoObjetivo({ sb, yo: B, body: { tipo: "objetivo-aporte", objetivo: O, aporte: 3 }, enviar, ahora: MEDIODIA });
  r.av.invitado = await avisoObjetivo({ sb, yo: C, body: { tipo: "objetivo-invita", objetivo: O }, enviar, ahora: MEDIODIA });

  test("aviso de invitación y de sumarse: de quien corresponde, una vez", () => {
    assert.equal(r.av.invita.enviadas, 1); assert.equal(r.av.invita2.motivo, "nadie");
    assert.deepEqual(enviados[0], [[C], "Ana te invita a un objetivo", "«Viaje a Chiloé»: lograr $600.000 juntos en Rumbo."]);
    assert.equal(r.av.acepta.enviadas, 1); assert.deepEqual(enviados[1][0], [A]);
    assert.equal(r.av.invitado.motivo, "no-corresponde");
  });
  test("aviso de aporte: solo de un aporte tuyo y reciente; uno al día; al lograrlo, «¡lo lograron!»", () => {
    assert.equal(r.av.viejo.motivo, "no-corresponde"); assert.equal(r.av.ajeno.motivo, "no-corresponde");
    assert.equal(r.av.aporte.enviadas, 1); assert.deepEqual(enviados[2], [[B], "Ana sumó $215.000 a «Viaje a Chiloé»", "Van $380.000 de $600.000 (63 %)."]);
    assert.equal(r.av.aporte2.motivo, "nadie");
    assert.equal(r.av.logro.enviadas, 1);
    assert.deepEqual(enviados[3], [[A], "¡Lo lograron! «Viaje a Chiloé»", "Juntaron $600.000 entre todos. +20 ⭐ para cada uno y una medalla en tu vitrina."]);
    assert.equal(enviados.length, 4);
  });
}
