/* Tests de 🧭 Norte, tu brújula para Norte-Desk: abrir y cerrar el día con el ritual completo («completo: true»), en el
   servidor (notifier/norte.mjs, con un Supabase falso) y al aplicarlo en la app (norteAplicar de js/norte.js): lo mismo
   que el ritual de apertura y de cierre de la app (saveRitual y saveCierre), con sus ⭐ y sin duplicar nada */
export default async function ({ G, test, assert, clone, cargar }) {
  console.log("\nNorte, tu brújula: el ritual completo (Norte-Desk)");
  const { atenderNorte, resumenDia, hashToken } = await import("../notifier/norte.mjs");

  /* ---------- Un Supabase falso (como en norte.test.mjs) ---------- */
  function sbFalso(tablas, ahora) {
    const T = n => (tablas[n] = tablas[n] || []);
    function consulta(nombre) {
      const filtros = []; let modo = "select", op = {}, filas = null, cambios = null, unico = false;
      const q = {
        select(c, o) { if (modo === "select") op = o || {}; return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        upsert(f) { modo = "upsert"; filas = [].concat(f); return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        const t = T(nombre);
        if (modo === "insert" || modo === "upsert") { filas.forEach(f => t.push(Object.assign({ creado: ahora.toISOString() }, f))); return { data: null, error: null }; }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); return { data: null, error: null }; }
        if (op.head) return { data: null, count: sel.length, error: null };
        return { data: unico ? sel[0] || null : sel, error: null };
      }
      return q;
    }
    return { tablas, from: consulta, rpc: async () => ({ data: null, error: null }) };
  }
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32), AHORA = new Date("2026-11-11T15:00:00Z"), HOY = "2026-11-11";
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" } },
    habitos: { defs: [], log: {} },
    ritual: { dias: {
      "2026-11-10": { hecho: true, cerrado: true, proyectos: ["Rumbo", "Norte"], cierre: { manana: "Terminar el informe" } },
      "2026-11-08": { hecho: true, cerrado: true, proyectos: ["Casa", "Rumbo"] },
    } },
    agenda: { dias: { [HOY]: [
      { id: "t1", txt: "Pagar la luz", ambito: "per", estado: "pendiente" },
      { id: "t2", txt: "Correo", estado: "hecha", done: true },
      { id: "t3", txt: "Llamar a Ana", ambito: "pro", estado: "pendiente", migraciones: 2 },
    ] } },
    agua: { meta: 2000, dias: {} },
  });
  const nuevoSb = (cambia) => {
    const data = estado(); if (cambia) cambia(data);
    return sbFalso({
      estado_usuario: [{ user_id: U, data }],
      norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }],
      norte_pendientes: [], agua_pendientes: [],
    }, AHORA);
  };
  const pedir = (sb, body) => atenderNorte({ sb, body, autorizacion: "Bearer " + TOKEN, ahora: AHORA });
  const APERTURA = {
    accion: "abrir_dia", completo: true, mision: "Que el informe quede listo", primer_bocado: "Escribir el informe", ambito: "pro", energia: 4,
    pilar: "Productividad", servir: "Mi equipo", proyectos: ["Rumbo", " Informe ", "Rumbo"],
    tareas_nuevas: [{ texto: "Revisar números", ambito: "pro" }, { texto: "Pagar la luz", ambito: "per" }, { texto: "Comprar pan", ambito: "per" }],
    tareas_quitar: ["t1"],
  };

  /* ---------- «hoy»: lo que necesitan los formularios ---------- */
  const h0 = (await pedir(nuevoSb(), { accion: "hoy" })).cuerpo.datos;
  test("hoy: la misión sugerida (lo que dejaste anoche para hoy), tus proyectos recientes y qué tareas vienen de otros días", () => {
    assert.equal(h0.mision_sugerida, "Terminar el informe");
    assert.deepEqual(h0.proyectos_recientes, ["Rumbo", "Norte", "Casa"]);
    assert.deepEqual([h0.pilar, h0.servir, h0.proyectos], [null, null, []]);
    const t3 = h0.tareas.find(t => t.id === "t3"), t1 = h0.tareas.find(t => t.id === "t1");
    assert.deepEqual([t3.antigua, t3.postergada, t1.antigua, t1.postergada], [true, 2, false, 0]);
    const conMision = resumenDia(Object.assign(estado(), { ritual: { dias: { [HOY]: { hecho: true, mision: "Otra" }, "2026-11-10": { cierre: { manana: "X" } } } } }), { norte: [], agua: [] }, HOY);
    assert.deepEqual([conMision.mision, conMision.mision_sugerida], ["Otra", null], "con misión ya puesta, no sugiere");
    const enBandeja = resumenDia(Object.assign(estado(), { ritual: { dias: {} } }),
      { norte: [{ id: "c00000001", tipo: "cerrar", datos: { fecha: "2026-11-10", manana: "Lo de anoche", completo: true }, creado: "2026-11-11T01:00:00Z" }], agua: [] }, HOY);
    assert.equal(enBandeja.mision_sugerida, "Lo de anoche", "también si el cierre de anoche todavía espera en la bandeja");
  });

  /* ---------- abrir_dia completo ---------- */
  const sbA = nuevoSb(), a1 = await pedir(sbA, APERTURA), hA = (await pedir(sbA, { accion: "hoy" })).cuerpo.datos, pA = sbA.tablas.norte_pendientes[0];
  test("abrir_dia completo: todo va a la bandeja y «hoy» ya lo muestra (tareas nuevas con id fijo «na…», las quitadas no)", () => {
    assert.equal(a1.status, 200);
    assert.equal(a1.cuerpo.texto, "Listo, abrí tu día. Tu primer bocado: Escribir el informe. Empieza por ahí. Anoté 3 tareas más.");
    const d = pA.datos;
    assert.deepEqual([pA.tipo, d.completo, d.mision, d.pilar, d.servir, d.energia], ["abrir", true, "Que el informe quede listo", "Productividad", "Mi equipo", 4]);
    assert.deepEqual(d.proyectos, ["Rumbo", "Informe"], "sin espacios de más ni repetidos");
    assert.equal(d.tareas_nuevas.length, 3); assert.deepEqual(d.tareas_quitar, ["t1"]);
    assert.deepEqual([hA.abierto, hA.mision, hA.pilar, hA.servir, hA.energia, hA.mision_sugerida], [true, "Que el informe quede listo", "Productividad", "Mi equipo", 4, null]);
    assert.deepEqual(hA.proyectos, ["Rumbo", "Informe"]);
    const ids = hA.tareas.map(t => t.id);
    assert.ok(ids.includes("na" + pA.id + "0") && ids.includes("na" + pA.id + "2"), "las nuevas, con el id que les pondrá la app");
    assert.ok(!ids.includes("na" + pA.id + "1"), "«Pagar la luz» ya existía: la app no crea otra…");
    assert.ok(!ids.includes("t1"), "…y como la quitaste, no se muestra");
    assert.ok(hA.tareas.find(t => t.bocado).id === "nb" + pA.id + "0");
    assert.equal(hA.tareas_pendientes, 4, "Llamar a Ana, el bocado, Revisar números y Comprar pan");
  });
  const malos = await Promise.all([
    { pilar: "Suerte" }, { mision: "x".repeat(201) }, { tareas_nuevas: [{ texto: "Sin ámbito" }] }, { tareas_nuevas: Array(16).fill({ texto: "a", ambito: "pro" }) },
    { tareas_quitar: ["mal id!"] }, { proyectos: Array(9).fill(0).map((_, i) => "P" + i) },
    { tareas_nuevas: Array(15).fill(0).map((_, i) => ({ texto: "ñ".repeat(190) + i, ambito: "per" })) },   // no cabe en la bandeja
  ].map(x => pedir(nuevoSb(), Object.assign({}, APERTURA, x))));
  const sinCompleto = nuevoSb(); await pedir(sinCompleto, { accion: "abrir_dia", primer_bocado: "Algo", mision: "No va", pilar: "Suerte" });
  test("abrir_dia completo: lo que viene mal o no cabe no entra; sin «completo» es la apertura corta de siempre (el robot)", () => {
    malos.forEach((r, i) => assert.deepEqual([r.status, r.cuerpo.error], [400, "dato-invalido"], "caso " + i));
    assert.match(malos[malos.length - 1].cuerpo.texto, /^Es mucho para guardar de una vez/);
    const d = sinCompleto.tablas.norte_pendientes[0].datos;
    assert.deepEqual(Object.keys(d).sort(), ["ambito", "energia", "fecha", "primer_bocado"]);
  });

  /* ---------- cerrar_dia completo ---------- */
  const abierto = data => { data.ritual.dias[HOY] = { hecho: true, sapo: "Pagar la luz", mision: "Que el informe quede listo" }; data.agenda.dias[HOY][0].esSapo = true; };
  const CIERRE = {
    accion: "cerrar_dia", completo: true, animo: 4, gratitud: "Mi familia", mision: "parcial", energia: 2, manana: "Llamar al banco", nota: "Un día largo.\nPero bueno.",
    pendientes: [{ id: "t3", v: "soltar" }, { id: "t1", v: "hecha" }],
  };
  const sbC = nuevoSb(abierto), c1 = await pedir(sbC, CIERRE), pC = sbC.tablas.norte_pendientes[0];
  const sbC2 = nuevoSb(abierto), c2 = await pedir(sbC2, Object.assign({}, CIERRE, { pendientes: [{ id: "t3", v: "otro", fecha: "2026-11-20", bocado: true }] }));
  test("cerrar_dia completo: a la bandeja con cada decisión, y Norte cuenta qué pasó con tus pendientes", () => {
    assert.equal(c1.status, 200);
    assert.equal(c1.cuerpo.texto, "Listo, cerré tu día. De tus pendientes, soltaste una y una ya la hiciste. Gracias por lo que compartiste. Que descanses.");
    const d = pC.datos;
    assert.deepEqual([pC.tipo, d.completo, d.mision, d.energia, d.manana, d.nota, d.animo, d.gratitud], ["cerrar", true, "parcial", 2, "Llamar al banco", "Un día largo. Pero bueno.", 4, "Mi familia"]);
    assert.deepEqual(d.pendientes, [{ id: "t3", v: "soltar" }, { id: "t1", v: "hecha" }]);
    assert.equal(c1.cuerpo.datos.pasan_a_manana, 0);
    assert.equal(c2.cuerpo.texto, "Listo, cerré tu día. De tus pendientes, una pasa a mañana y una va a otro día. Gracias por lo que compartiste. Que descanses.");
    assert.deepEqual(sbC2.tablas.norte_pendientes[0].datos.pendientes, [{ id: "t3", v: "otro", fecha: "2026-11-20", bocado: true }]);
  });
  const malosC = await Promise.all([
    { mision: "mas o menos" }, { bocado: "si" }, { energia: 9 }, { nota: "x".repeat(601) }, { pendientes: [{ id: "t1", v: "olvidar" }] },
    { pendientes: [{ id: "t1", v: "otro" }] }, { pendientes: [{ id: "t1", v: "delegar", quien: "x".repeat(81) }] },
  ].map(x => pedir(nuevoSb(abierto), Object.assign({}, CIERRE, x))));
  test("cerrar_dia completo: lo que viene mal no entra", () => {
    malosC.forEach((r, i) => assert.deepEqual([r.status, r.cuerpo.error], [400, "dato-invalido"], "caso " + i));
  });

  /* ================= La app: aplicar el ritual completo (js/norte.js) ================= */
  const defaultState = G("defaultState"), migrate = G("migrate"), aplicar = G("norteAplicar"), resumen = G("norteResumen");
  const todayISO = G("todayISO"), agSumar = G("agSumar"), buscarTarea = G("buscarTarea"), nuevaTarea = G("nuevaTarea"), tareasDelDia = G("tareasDelDia"), ledgerVigente = G("ledgerVigente");
  G("(s => { STATE = s; })")(defaultState());
  const hoy = todayISO(), t0 = Date.parse(hoy + "T08:00:00");
  const ped = (n, tipo, datos) => ({ id: "r000000000" + n, tipo, datos: Object.assign({ fecha: hoy }, datos), creado: new Date(t0 + n * 60e3).toISOString() });
  const nuevoEstado = () => {
    const s = migrate(defaultState());
    const mk = (id, txt, ambito, extra) => { const t = nuevaTarea(s, hoy, { txt, ambito }); t.id = id; Object.assign(t, extra || {}); };
    mk("tluz", "Pagar la luz", "per"); mk("tana", "Llamar a Ana", "pro", { migraciones: 2 }); mk("tvieja", "Ordenar el escritorio", "per");
    return s;
  };
  const abrirDatos = (n) => ({ completo: true, mision: "Que el informe quede listo", primer_bocado: "Escribir el informe", ambito: "pro", energia: 4,
    pilar: "Productividad", servir: "Mi equipo", proyectos: ["Rumbo", "Informe"],
    tareas_nuevas: [{ texto: "Revisar números", ambito: "pro" }, { texto: "Pagar la luz", ambito: "pro" }], tareas_quitar: ["tvieja", "tana"] });
  const S0 = nuevoEstado(), base = S0.gamif.puntos, pil0 = (S0.ritual.pilares || {}).Productividad || 0;
  const S = clone(S0), rA = aplicar([ped(1, "abrir", abrirDatos())], S);
  test("la app: abre el día con el ritual completo, como saveRitual (+50 ⭐ y el pilar suma)", () => {
    const r = S.ritual.dias[hoy];
    assert.deepEqual([r.hecho, r.mision, r.sapo, r.sapoAmbito, r.energia, r.pilar, r.servir], [true, "Que el informe quede listo", "Escribir el informe", "pro", 4, "Productividad", "Mi equipo"]);
    assert.deepEqual(clone(r.proyectos), ["Rumbo", "Informe"]);
    assert.ok(!r.express, "no es la apertura corta"); assert.equal(r.abiertoTs, t0 + 60e3);
    assert.equal(S.ritual.pilares.Productividad, pil0 + 1);
    assert.ok(ledgerVigente(S, "ritual-apertura:" + hoy)); assert.equal(rA.estrellas, 50); assert.equal(S.gamif.puntos, base + 50);
    const b = buscarTarea(S, hoy, "nbr00000000010");
    assert.ok(b && b.esSapo && b.txt === "Escribir el informe", "el bocado, con el id que «hoy» ya mostraba");
    const n0 = buscarTarea(S, hoy, "nar00000000010");
    assert.ok(n0 && n0.txt === "Revisar números" && n0.ambito === "pro", "la tarea nueva, con id fijo");
    assert.ok(!buscarTarea(S, hoy, "nar00000000011"), "«Pagar la luz» ya estaba: no se duplica…");
    assert.equal(buscarTarea(S, hoy, "tluz").ambito, "pro", "…solo cambia a profesional");
    assert.ok(buscarTarea(S, hoy, "tvieja").borrada, "la que quitaste se borra");
    assert.ok(!buscarTarea(S, hoy, "tana").borrada, "la que viene de otro día se queda, como en la app");
    assert.equal(resumen(rA), "🧭 Norte abrió tu día · +50 ⭐");
  });
  const puntosA = S.gamif.puntos, agendaA = JSON.stringify(S.agenda), rA2 = aplicar([ped(1, "abrir", abrirDatos())], S);
  test("la app: el mismo ritual otra vez no hace nada; dos equipos que lo aplican quedan con una tarea de cada una", () => {
    assert.deepEqual([rA2.nuevos, rA2.aplicados.length, S.gamif.puntos, JSON.stringify(S.agenda)], [0, 0, puntosA, agendaA]);
    const A = clone(S0), B = clone(S0);
    aplicar([ped(1, "abrir", abrirDatos())], A, { now: 1000 }); aplicar([ped(1, "abrir", abrirDatos())], B, { now: 2000 });
    const m = cargar(A, B);
    assert.equal(tareasDelDia(hoy, m).filter(t => t.txt === "Revisar números").length, 1);
    assert.equal(tareasDelDia(hoy, m).filter(t => t.esSapo).length, 1);
    assert.equal(m.gamif.puntos, base + 50);
  });

  // El cierre completo sobre el día recién abierto: el bocado no se hizo
  const cerrarDatos = { completo: true, animo: 4, gratitud: "Mi familia", mision: "parcial", energia: 2, manana: "Llamar al banco", nota: "Un día largo.",
    pendientes: [{ id: "tluz", v: "hecha" }, { id: "nar00000000010", v: "soltar" }, { id: "tana", v: "otro", fecha: agSumar(hoy, 5), bocado: true }] };
  const SC = clone(S), pC0 = SC.gamif.puntos, rC = aplicar([ped(2, "cerrar", cerrarDatos)], SC);
  test("la app: cierra el día con el ritual completo, como saveCierre: cada pendiente con su decisión (+40 ⭐)", () => {
    const r = SC.ritual.dias[hoy];
    assert.ok(r.cerrado && !r.express, "no es el cierre corto"); assert.equal(r.cerradoTs, t0 + 2 * 60e3);
    assert.deepEqual([r.cierre.mision, r.cierre.sapo, r.cierre.energia, r.cierre.mejor, r.cierre.manana, r.cierre.nota], ["parcial", false, 2, "Mi familia", "Llamar al banco", "Un día largo."]);
    assert.ok(r.cierre.tareas && r.cierre.tareas.planificadas >= 4, "el resumen de tareas del día, para las métricas");
    assert.equal(buscarTarea(SC, hoy, "tluz").estado, "hecha"); assert.ok(ledgerVigente(SC, "tarea:tluz"), "«la hice»: +15 ⭐ como a mano");
    assert.equal(buscarTarea(SC, hoy, "nar00000000010").estado, "soltada");
    assert.equal(buscarTarea(SC, hoy, "tana").estado, "programada");
    const otroDia = tareasDelDia(agSumar(hoy, 5), SC);
    assert.equal(otroDia.length, 1); assert.ok(otroDia[0].bocadoSugerido, "queda sugerida como primer bocado de ese día (como en la app)");
    assert.ok(otroDia[0].id.startsWith("ncr0000000002"), "con id fijo");
    const manana = tareasDelDia(agSumar(hoy, 1), SC);
    assert.equal(manana.length, 1, "lo que no decidiste (el bocado) pasa a mañana"); assert.equal(manana[0].txt, "Escribir el informe");
    const e = SC.vida.diario.filter(x => x.fecha === hoy && x.fromRitual);
    assert.equal(e.length, 1); assert.deepEqual([e[0].mood, e[0].texto, e[0].gratitud], [4, "Un día largo.", "Mi familia"], "al diario: ánimo, nota y gratitud");
    assert.ok(ledgerVigente(SC, "ritual-cierre:" + hoy)); assert.equal(rC.estrellas, 40 + 15); assert.equal(SC.gamif.puntos, pC0 + 55);
    assert.equal(resumen(rC), "🧭 Norte cerró tu día · +55 ⭐");
  });
  test("la app: el cierre completo otra vez no hace nada; un día ya pasado manda las pendientes a hoy", () => {
    const p = SC.gamif.puntos;
    assert.equal(aplicar([ped(2, "cerrar", cerrarDatos)], SC).aplicados.length, 0); assert.equal(SC.gamif.puntos, p);
    const s = migrate(defaultState()), ayer = agSumar(hoy, -1);
    s.ritual.dias[ayer] = { hecho: true, ts: 1 };
    const t = nuevaTarea(s, ayer, { txt: "Quedó de ayer", ambito: "per" }); t.id = "tayer";
    aplicar([ped(3, "cerrar", { completo: true, animo: 3, fecha: ayer })], s);
    assert.ok(s.ritual.dias[ayer].cerrado);
    assert.ok(tareasDelDia(hoy, s).some(x => x.txt === "Quedó de ayer"), "a tu lista de hoy");
    assert.ok(!s.ritual.dias[ayer].cierre.mision, "sin respuesta, la misión queda sin marcar");
  });
}
