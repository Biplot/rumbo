/* Tests del agua con otros (tercera entrega): los vasos del aviso («+ Un vaso») que se suman sin repetirse,
   la firma del aviso en el servidor (notifier/vaso.mjs), los botones del aviso del agua, el bidón (la meta
   sugerida, lo tuyo de la semana y las ⭐ al terminar) y sus avisos (notifier/bidon.mjs) */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAgua con otros: «+ Un vaso», la fuente y el bidón");
  const defaultState = G("defaultState"), aplicar = G("aguaAplicarPendientes"), total = G("aguaTotal"), todayISO = G("todayISO"), agSumar = G("agSumar");
  const sugerida = G("bdSugerida"), premio = G("bdPremio"), misDias = G("bdMisDias"), limpio = G("bdLimpio"), lunesDe = G("bdLunes"), fuenteMio = G("aguaFuenteMio");
  const hoy = todayISO();

  /* ---------- Los vasos del aviso ---------- */
  const S = defaultState(); S.agua.dias[hoy] = { r: [{ id: "a1xyz", ml: 250, ts: 1 }], b: [] };
  const lista = [
    { id: "n1abc", fecha: hoy, ml: 250, ts: 10 }, { id: "n2abc", fecha: hoy, ml: 500, ts: 20 },
    { id: "n1abc", fecha: hoy, ml: 250, ts: 10 },              // el mismo, desde el servidor
    { id: "a1xyz", fecha: hoy, ml: 250, ts: 1 },                // ya estaba (lo anotó la app)
    { id: "MALO!", fecha: hoy, ml: 250, ts: 1 }, { id: "n3abc", fecha: hoy, ml: 99999, ts: 1 }, { id: "n4abc", fecha: "2020-01-01", ml: 250, ts: 1 },
  ];
  const r1 = aplicar(clone(lista), S);
  test("los vasos del aviso se suman una sola vez (por id), y lo raro no entra", () => {
    assert.equal(r1.n, 2); assert.equal(r1.ml, 750);
    assert.equal(total(S.agua.dias[hoy]), 1000, "250 de la app + 250 y 500 del aviso");
    assert.deepEqual(clone(S.agua.dias[hoy].r.map(x => x.id)), ["a1xyz", "n1abc", "n2abc"], "en orden de hora");
    assert.ok(r1.hechos.includes("n1abc") && r1.hechos.includes("a1xyz") && r1.hechos.includes("n4abc") && r1.hechos.includes("n3abc"), "lo resuelto (sumado, repetido o descartado) se quita del teléfono");
    assert.deepEqual(clone(r1.fechas), [hoy]);
  });
  test("volver a traerlos (otro equipo, otra vez) no suma nada; lo que borraste no vuelve", () => {
    const r2 = aplicar(clone(lista), S); assert.equal(r2.n, 0); assert.equal(total(S.agua.dias[hoy]), 1000);
    S.agua.dias[hoy].b.push("n2abc");
    assert.equal(aplicar([{ id: "n2abc", fecha: hoy, ml: 500, ts: 20 }], S).n, 0, "borrado en la app: el aviso no lo revive");
  });
  test("un vaso tocado ayer (antes de medianoche) va a su día", () => {
    const ayer = agSumar(hoy, -1), r = aplicar([{ id: "n9ayer", fecha: ayer, ml: 600, ts: 5 }], S);
    assert.equal(r.n, 1); assert.equal(total(S.agua.dias[ayer]), 600);
  });

  /* ---------- La fuente: lo tuyo cuenta hasta tu meta y hasta 4 L ---------- */
  test("en la fuente cuenta lo que llevas, hasta tu meta (y hasta 4 L)", () => {
    const F = defaultState(); F.agua.meta = 2000; F.agua.dias[hoy] = { r: [{ id: "x", ml: 1500, ts: 1 }], b: [] };
    assert.equal(fuenteMio(F), 1500);
    F.agua.dias[hoy].r.push({ id: "y", ml: 3000, ts: 2 }); assert.equal(fuenteMio(F), 2000, "pasarse de la meta no infla la fuente");
    F.agua.meta = 6000; assert.equal(fuenteMio(F), 4000, "y nunca más de 4 L");
  });

  /* ---------- El bidón ---------- */
  test("la meta sugerida: 1,5 L al día por persona en la semana, de a 5 L (entre 10 y 200 L)", () => {
    assert.equal(sugerida(2), 20000); assert.equal(sugerida(3), 30000); assert.equal(sugerida(4), 40000);
    assert.equal(sugerida(1), 10000); assert.equal(sugerida(30), 200000);
  });
  test("las ⭐ al terminar la semana: 1 por litro que aportaste (hasta 30) y 20 si lo llenaron", () => {
    assert.equal(premio({ lleno: null }, 9500), 9);
    assert.equal(premio({ lleno: "2026-11-06" }, 9500), 29);
    assert.equal(premio({ lleno: "2026-11-06" }, 80000), 50, "tope: 30 + 20");
    assert.equal(premio({ lleno: null }, 400), 0);
  });
  test("lo tuyo de la semana del bidón: cada día desde el lunes hasta hoy, hasta 5 L al día", () => {
    const B = defaultState(), lunes = lunesDe(hoy);
    assert.equal(new Date(lunes + "T12:00:00").getDay(), 1, "el lunes de esta semana");
    B.agua.dias[lunes] = { r: [{ id: "l", ml: 1800, ts: 1 }], b: [] };
    B.agua.dias[hoy] = Object.assign(B.agua.dias[hoy] || { r: [], b: [] }, {}); B.agua.dias[hoy].r.push({ id: "h", ml: 7000, ts: 2 });
    B.agua.dias[agSumar(lunes, -1)] = { ml: 3000 };   // el domingo anterior no cuenta
    const d = misDias({ lunes }, hoy, B);
    assert.ok(Object.keys(d).every(f => f >= lunes && f <= hoy), "solo de esta semana y hasta hoy");
    assert.equal(d[hoy], 5000, "hoy: 7 L, cuentan 5");
    if (lunes !== hoy) assert.equal(d[lunes], 1800);
  });
  test("lo que llega del servidor se limpia (nombres, colores, litros)", () => {
    const b = limpio({ id: "x", nombre: "  <b>Bidón</b> " + "x".repeat(80), meta_ml: "40000", lunes: "2026-11-02", lleno: "nada", estado: "raro",
      miembros: [{ id: "u", yo: 1, nombre: "Ana", color: 99 }, { id: "v", color: -3 }], totales: [{ id: "u", ml: "1500.7" }, { id: "v", ml: -5 }] });
    assert.equal(b.nombre.length, 40); assert.equal(b.meta, 40000); assert.equal(b.lleno, ""); assert.equal(b.estado, "invitado");
    assert.deepEqual(clone(b.miembros.map(m => m.color)), [7, 0]); assert.deepEqual(clone(b.totales.map(t => t.ml)), [1501, 0]);
  });

  /* ---------- El servidor: la firma de «+ Un vaso» ---------- */
  const { firmaVaso, vasoDesdeAviso, VASOS_AL_DIA } = await import("../notifier/vaso.mjs");
  const U = "00000000-0000-0000-0000-00000000000a", SECRETO = "s3creto", ahora = new Date("2026-11-04T19:10:00Z"), D = "2026-11-04";
  function sbFalso(cuantos = 0, error = null) {
    const filas = [];
    return {
      filas,
      from: () => ({
        select: () => ({ eq: () => ({ gte: async () => ({ count: cuantos, error }) }) }),
        upsert: async (f, op) => { filas.push({ f, op }); return { error: null }; },
      }),
    };
  }
  const cuerpo = (cambio = {}) => Object.assign({ accion: "vaso", u: U, d: D, f: firmaVaso(SECRETO, U, D), id: "nabc123", ml: 250, ts: ahora.getTime(), fecha: D }, cambio);
  const sb1 = sbFalso(), v1 = await vasoDesdeAviso({ sb: sb1, body: cuerpo(), secreto: SECRETO, ahora });
  const vMala = await vasoDesdeAviso({ sb: sbFalso(), body: cuerpo({ f: firmaVaso("otro", U, D) }), secreto: SECRETO, ahora });
  const vOtro = await vasoDesdeAviso({ sb: sbFalso(), body: cuerpo({ u: "00000000-0000-0000-0000-00000000000b" }), secreto: SECRETO, ahora });
  const vVieja = await vasoDesdeAviso({ sb: sbFalso(), body: cuerpo({ d: "2026-10-30", f: firmaVaso(SECRETO, U, "2026-10-30"), fecha: "2026-10-30" }), secreto: SECRETO, ahora });
  const vManana = await vasoDesdeAviso({ sb: sbFalso(), body: cuerpo({ fecha: "2026-11-05" }), secreto: SECRETO, ahora });
  const vMucho = await vasoDesdeAviso({ sb: sbFalso(), body: cuerpo({ ml: 9000 }), secreto: SECRETO, ahora });
  const vTope = await vasoDesdeAviso({ sb: sbFalso(VASOS_AL_DIA), body: cuerpo(), secreto: SECRETO, ahora });
  const vSin = await vasoDesdeAviso({ sb: sbFalso(0, { message: 'relation "agua_pendientes" does not exist' }), body: cuerpo(), secreto: SECRETO, ahora });
  test("«+ Un vaso» con la firma del aviso: se anota en agua_pendientes (sin sesión, sin repetir)", () => {
    assert.deepEqual(v1, { ok: true });
    assert.deepEqual(sb1.filas[0].f, { user_id: U, id: "nabc123", fecha: D, ml: 250, ts: ahora.getTime() });
    assert.equal(sb1.filas[0].op.ignoreDuplicates, true, "el mismo vaso dos veces no se duplica");
  });
  test("sin la firma de ese aviso, de otra persona, vencida o con un vaso raro: no se anota", () => {
    assert.equal(vMala.motivo, "firma"); assert.equal(vOtro.motivo, "firma");
    assert.equal(vVieja.motivo, "vencido");
    assert.deepEqual(vManana, { ok: true }, "tocado pasada la medianoche: va al día siguiente");
    assert.equal(vMucho.motivo, "no-valido");
    assert.equal(vTope.motivo, "limite", `hasta ${VASOS_AL_DIA} al día desde los avisos`);
    assert.equal(vSin.motivo, "sin-tablas", "sin supabase/agua.sql todavía, no falla");
  });

  /* ---------- El aviso del agua trae los botones ---------- */
  const { enviarRecordatorios } = await import("../notifier/recordatorios.mjs");
  const datosAgua = { settings: { notif: { tz: "America/Santiago", avisos: { elefante: true }, horas: {} } },
    agua: { meta: 2000, vaso: 300, botella: 750, dias: { [D]: { r: [{ id: "a", ml: 250, ts: 1 }], b: [] } } } };
  function sbRec(data) {
    const sent = new Set();
    return {
      from: t => ({
        select: () => (t === "suscripciones_push" ? Promise.resolve({ data: [{ id: 1, user_id: U, endpoint: "e" }], error: null })
          : { in: async () => ({ data: [{ user_id: U, notif: data.settings.notif, data }], error: null }) }),
        async insert(f) { const k = f.user_id + f.tipo + f.fecha; if (sent.has(k)) return { error: { message: "dup" } }; sent.add(k); return { error: null }; },
      }),
    };
  }
  const msgs = [], msgsSin = [];
  await enviarRecordatorios({ sb: sbRec(datosAgua), enviar: async (ds, m) => { msgs.push(m); return { enviadas: 1, fallidas: 0, borradas: 0 }; }, ahora, firmar: (u, d) => firmaVaso(SECRETO, u, d) });
  await enviarRecordatorios({ sb: sbRec(datosAgua), enviar: async (ds, m) => { msgsSin.push(m); return { enviadas: 1, fallidas: 0, borradas: 0 }; }, ahora });
  test("el aviso del agua trae «+ Un vaso» y «+ Tu botella» (con tus medidas) y la firma del día", () => {
    const m = msgs.find(x => /elefante-agua/.test(x.tag));
    assert.ok(m, "a las 16:00, con 250 ml de 2 L, sale el aviso del agua");
    assert.deepEqual(m.actions.map(a => a.action), ["vaso", "botella"]);
    assert.equal(m.actions[0].title, "+ Un vaso (300 ml)"); assert.equal(m.actions[1].title, "+ Tu botella (750 ml)");
    assert.deepEqual([m.agua.u, m.agua.d, m.agua.vaso, m.agua.botella, m.agua.ml, m.agua.meta], [U, D, 300, 750, 250, 2000]);
    assert.equal(m.agua.f, firmaVaso(SECRETO, U, D));
    assert.equal(m.url, "./?atajo=agua#inicio", "en iPhone (sin botones), tocarlo abre la portilla");
  });
  test("sin firma (el servidor no la pasó) el aviso va igual, sin botones", () => {
    const m = msgsSin.find(x => /elefante-agua/.test(x.tag));
    assert.ok(m && !m.actions && !m.agua);
  });

  /* ---------- Los avisos del bidón ---------- */
  const { mensajeBidon, avisoBidon } = await import("../notifier/bidon.mjs");
  const BID = "11111111-1111-1111-1111-111111111111", A = U, Bu = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-00000000000c";
  function sbBidon({ lleno = null, miembros }) {
    const updates = [];
    const q = (t) => {
      const filtros = {};
      const api = {
        select() { return api; }, eq(k, v) { filtros[k] = v; return api; },
        maybeSingle: async () => {
          if (t === "bidones") return { data: { nombre: "El bidón de la oficina", meta_ml: 40000, lleno }, error: null };
          if (t === "perfiles") return { data: { nombre: filtros.user_id === A ? "Ana" : "Bruno" }, error: null };
          if (t === "estado_usuario") return { data: { notif: {} }, error: null };
          return { data: null, error: null };
        },
        then(res) {
          if (t === "bidon_miembros") return Promise.resolve({ data: miembros, error: null }).then(res);
          if (t === "suscripciones_push") return Promise.resolve({ data: [{ id: 1, endpoint: "e" }], error: null }).then(res);
          if (t === "bidon_aportes") return Promise.resolve({ data: [{ ml: 25000 }, { ml: 16000 }], error: null }).then(res);
          return Promise.resolve({ data: [], error: null }).then(res);
        },
        update(c) { updates.push(c); return { eq: () => ({ eq: async () => ({ error: null }) }) }; },
      };
      return api;
    };
    return { from: q, updates };
  }
  const env = [], enviar = async (ds, m) => { env.push(m); return { enviadas: 1 }; };
  const mInv = [{ user_id: A, estado: "activo", invita: null, avisos: {} }, { user_id: Bu, estado: "invitado", invita: A, avisos: {} }, { user_id: C, estado: "invitado", invita: A, avisos: { invita: true } }];
  const rInv = await avisoBidon({ sb: sbBidon({ miembros: mInv }), yo: A, body: { tipo: "bidon-invita", bidon: BID }, enviar, ahora: new Date("2026-11-04T15:00:00Z") });
  const rNo = await avisoBidon({ sb: sbBidon({ miembros: mInv }), yo: Bu, body: { tipo: "bidon-invita", bidon: BID }, enviar });
  const rLlenoNo = await avisoBidon({ sb: sbBidon({ miembros: mInv }), yo: A, body: { tipo: "bidon-lleno", bidon: BID }, enviar });
  const mAct = [{ user_id: A, estado: "activo", invita: null, avisos: {} }, { user_id: Bu, estado: "activo", invita: A, avisos: {} }, { user_id: C, estado: "activo", invita: A, avisos: { lleno: true } }];
  const n0 = env.length;
  const rLleno = await avisoBidon({ sb: sbBidon({ lleno: "2026-11-04", miembros: mAct }), yo: A, body: { tipo: "bidon-lleno", bidon: BID }, enviar, ahora: new Date("2026-11-04T15:00:00Z") });
  test("el aviso de la invitación va a quien invitaste (una vez); quien no está activo no avisa", () => {
    assert.equal(rInv.enviadas, 1, "a Bruno sí; a Cami ya se le avisó");
    assert.equal(env[0].title, "Ana te invita a llenar un bidón");
    assert.match(env[0].body, /«El bidón de la oficina»: 40 L entre todos esta semana/);
    assert.equal(rNo.motivo, "no-corresponde");
  });
  test("«¡Llenaron el bidón!» solo si de verdad se llenó, a los demás y una vez", () => {
    assert.equal(rLlenoNo.motivo, "no-corresponde");
    assert.equal(rLleno.enviadas, 1, "a Bruno (Cami ya lo supo; Ana es quien lo llenó)");
    assert.match(env[n0].title, /¡Llenaron «El bidón de la oficina»!/); assert.match(env[n0].body, /41 L entre todos/);
  });
  test("los textos de los avisos del bidón", () => {
    assert.equal(mensajeBidon("bidon-acepta", { nombre: "Bruno", b: { nombre: "Agua" } }).title, "Bruno se sumó a «Agua»");
    assert.equal(mensajeBidon("otro", {}), null);
  });
}
