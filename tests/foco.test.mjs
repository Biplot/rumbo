/* Tests del Foco (foco.js): los tramos (una sesión, ciclos y libre), avanzar con la app cerrada, pausar y saltar el
   descanso, el registro que queda, a qué le das tiempo (tareas con su prioridad y objetivo, hábitos con duración,
   objetivos, libros), lo que se suma (objetivo, área de la rueda, mejor hora), las ⭐ con tope, «qué sigue», la
   fusión entre equipos, el regalo a quien compró el modo enfoque y los avisos del servidor (notifier/foco.mjs). */
export default async function ({ G, test, assert, clone }) {
  console.log("\nEl Foco");
  const defaultState = G("defaultState"), tramos = G("focoTramos"), ritmoTxt = G("focoRitmoTxt"), nueva = G("focoNueva"), avanzar = G("focoAvanzar");
  const pausar = G("focoPausar"), saltar = G("focoSaltar"), hechos = G("focoMinHechos"), registro = G("focoRegistro"), destinos = G("focoDestinos");
  const minObj = G("focoMinObjetivo"), minArea = G("focoMinArea"), mejorHora = G("focoMejorHora"), porObjetivo = G("focoPorObjetivo"), estrellas = G("focoDarEstrellas");
  const merge = G("focoMerge"), mergeStates = G("mergeStates"), regalo = G("focoRegalo"), ledgerRegistrar = G("ledgerRegistrar"), ledgerVigente = G("ledgerVigente");
  const minutosFoco = G("minutosFoco"), sigue = G("focoSigue"), guardarSigue = G("focoGuardarSigue"), pref = G("focoPref"), estiloUsable = G("focoEstiloUsable");
  const datosAnio = G("datosAnio"), nuevaTarea = G("nuevaTarea"), semanas = G("focoSemanasObjetivo");
  const T0 = new Date("2026-11-19T10:00:00").getTime(), MIN = 60000;
  const nuevo = () => { const S = defaultState(); S.settings.year = 2026; return S; };
  const ses = (S, x) => S.enfoque.sesiones.push(Object.assign({ id: "s" + S.enfoque.sesiones.length, fecha: "2026-11-19", ts: 1, real: 25, completa: true, tipo: "libre", ref: "", titulo: "x" }, x));

  test("los tramos: una sesión, ciclos (4 × foco, descansos y uno largo) y libre", () => {
    assert.deepEqual(clone(tramos("una", 45)), [[45, "f"]]);
    assert.deepEqual(clone(tramos("ciclos", 25)), [[25, "f"], [5, "d"], [25, "f"], [5, "d"], [25, "f"], [5, "d"], [25, "f"], [15, "l"]]);
    assert.equal(tramos("ciclos", 50)[1][0], 10, "con bloques de 45 o más, descansos de 10");
    assert.deepEqual(clone(tramos("libre", 25)), [[0, "x"]]);
    assert.equal(ritmoTxt("ciclos", 25), "4 × 25 min · descansos de 5 · uno largo de 15 · 2 h 10 en total");
  });
  test("una sesión de 25: avanza sola, también si pasó con la app cerrada, y queda su registro", () => {
    const a = nueva({ tipo: "tarea", ref: "t1", titulo: "Informe", objId: "o1", area: 2 }, { ritmo: "una", min: 25, fecha: "2026-11-19" }, T0);
    assert.equal(a.fin, T0 + 25 * MIN);
    assert.equal(hechos(a, T0 + 10 * MIN), 10);
    assert.deepEqual(clone(avanzar(a, T0 + 40 * MIN)), { cambio: true, terminada: true }, "al volver después del fin, terminó");
    const r = registro(a, true, T0 + 40 * MIN);
    assert.deepEqual([r.real, r.min, r.completa, r.tipo, r.ref, r.tareaId, r.objId, r.area, r.hora, r.fecha], [25, 25, true, "tarea", "t1", "t1", "o1", 2, 10, "2026-11-19"]);
    const b = nueva({ tipo: "libre", titulo: "x" }, { ritmo: "una", min: 25, fecha: "2026-11-19" }, T0);
    assert.equal(registro(b, false, T0 + 30000), null, "menos de un minuto no cuenta");
  });
  test("ciclos: el descanso no suma minutos de foco; saltarlo pasa al bloque siguiente", () => {
    const a = nueva({ tipo: "libre", titulo: "x" }, { ritmo: "ciclos", min: 25 }, T0);
    let r = avanzar(a, T0 + 26 * MIN);
    assert.ok(r.cambio && !r.terminada && a.tramo === 1, "a los 26 min está en el descanso");
    assert.equal(hechos(a, T0 + 28 * MIN), 25, "en el descanso siguen siendo 25");
    saltar(a, T0 + 28 * MIN);
    assert.equal(a.tramo, 2); assert.equal(a.fin, T0 + 28 * MIN + 25 * MIN);
    assert.equal(hechos(a, T0 + 38 * MIN), 35);
    r = avanzar(a, T0 + 10 * 3600000);
    assert.ok(r.terminada, "pasado todo, terminó"); assert.equal(hechos(a), 100, "4 bloques de 25");
  });
  test("pausar y seguir: el tiempo en pausa no cuenta (también en libre)", () => {
    const a = nueva({ tipo: "libre", titulo: "x" }, { ritmo: "una", min: 25 }, T0);
    pausar(a, T0 + 10 * MIN); assert.ok(a.pausa); assert.equal(a.restante, 15 * MIN);
    avanzar(a, T0 + 90 * MIN); assert.equal(a.tramo, 0, "en pausa no avanza");
    pausar(a, T0 + 60 * MIN); assert.equal(a.fin, T0 + 75 * MIN, "sigue: le quedan 15");
    const l = nueva({ tipo: "libre", titulo: "x" }, { ritmo: "libre", min: 25 }, T0);
    pausar(l, T0 + 30 * MIN); pausar(l, T0 + 50 * MIN);
    assert.equal(hechos(l, T0 + 60 * MIN), 40, "libre: 30 + 10, sin los 20 de pausa");
    assert.equal(registro(l, true, T0 + 60 * MIN).min, 40, "en libre, lo planeado es lo hecho");
  });
  test("¿en qué pones tu tiempo?: el bocado primero, la tarea trae su objetivo; hábitos con duración, objetivos y libros", () => {
    const S = nuevo(), hoy = "2026-11-19";
    S.ritual.semanas = { "2026-11-16": { apertura: { prioridades: [{ id: "p1", texto: "Avanzar la tesis", objId: "o1" }, { id: "p2", texto: "Ordenar la casa", objId: "" }] } } };
    datosAnio(S, 2026, true).metas.mensuales[10] = [{ id: "o1", texto: "Terminar la tesis", done: false, area: 2 }, { id: "o2", texto: "Listo", done: true }];
    nuevaTarea(S, hoy, { txt: "Correo", ambito: "pro" });
    const t = nuevaTarea(S, hoy, { txt: "Capítulo 2", ambito: "pro", prioridad: "p1" });
    const b = nuevaTarea(S, hoy, { txt: "Introducción", ambito: "pro" }); b.esSapo = true;
    S.habitos.defs.push({ id: "h1", nombre: "Leer", icon: "📖", minutos: 20, frecuencia: { tipo: "diario" }, area: 6 }, { id: "h2", nombre: "Agua", icon: "💧" });
    S.lecturas.push({ id: "l1", titulo: "Drácula", estado: "leyendo", pagina: 212, paginas: 418 }, { id: "l2", titulo: "Viejo", estado: "terminado" });
    const g = destinos(S, hoy), k = x => x.map(i => i.tipo + ":" + i.ref);
    assert.deepEqual(clone(g.map(x => x.k)), ["hoy", "habitos", "semana", "objetivos", "libros"]);
    assert.deepEqual(clone(k(g[0].items)), ["tarea:" + b.id, "tarea:" + t.id, "tarea:" + g[0].items[2].ref], "el bocado, después la de la prioridad");
    assert.deepEqual([g[0].items[1].objId, g[0].items[1].area, g[0].items[1].sub], ["o1", 2, "Prioridad de la semana · 🎯 Terminar la tesis"], "la tarea de la prioridad trae su objetivo y su área");
    assert.deepEqual(clone(k(g[2].items)), ["prioridad:p2"], "la prioridad que ya es tarea hoy no se repite");
    assert.deepEqual(clone(k(g[1].items)), ["habito:h1"], "solo los hábitos con duración");
    assert.equal(g[1].items[0].min, 20);
    ses(S, { real: 15, habId: "h1", tipo: "habito", ref: "h1" });
    assert.equal(destinos(S, hoy)[1].items[0].min, 5, "lleva 15 de 20: te ofrece los 5 que faltan");
    assert.deepEqual(clone(k(g[3].items)), ["objetivo:o1"], "los objetivos del mes que faltan");
    assert.equal(g[4].items[0].sub, "Ibas en la página 212 de 418");
  });
  test("lo que se suma: por objetivo, por área de la rueda, sus semanas y tu mejor hora", () => {
    const S = nuevo(); datosAnio(S, 2026, true).metas.mensuales[10] = [{ id: "o1", texto: "Tesis" }, { id: "o2", texto: "Correr" }];
    ses(S, { real: 50, objId: "o1", area: 2, hora: 10 }); ses(S, { real: 25, objId: "o1", area: 2, hora: 11, fecha: "2026-11-10" });
    ses(S, { real: 30, objId: "o2", hora: 19 }); ses(S, { real: 40, objId: "o1", fecha: "2026-10-30", hora: 10 });
    assert.equal(minObj(S, "o1", 2026, 10), 75, "en noviembre (la de octubre no)");
    assert.equal(minArea(S, 2026, 10, 2), 75);
    assert.deepEqual(clone(porObjetivo(S, 2026, 10).map(x => [x.id, x.min])), [["o1", 75], ["o2", 30]]);
    assert.deepEqual(clone(semanas(S, "o1", "2026-11-19").map(x => x.min)), [40, 0, 25, 50], "las 4 semanas (la del 26 de octubre, la del 2, la del 9 y esta)");
    assert.deepEqual(clone(mejorHora(S, "2026-10-01", "2026-11-30")), [10, 12], "entre las 10 y las 12");
    assert.equal(mejorHora(nuevo(), "2026-10-01", "2026-11-30"), null, "sin datos, nada");
  });
  test("las ⭐: +5 por sesión completa de 10 min o más, hasta 4 al día", () => {
    const S = nuevo(); const r = i => ({ id: "r" + i, fecha: "2026-11-19", real: 25, completa: true });
    assert.equal(estrellas(S, { id: "c", fecha: "2026-11-19", real: 25, completa: false }), false, "terminar antes no da ⭐ (pero guarda lo hecho)");
    assert.equal(estrellas(S, { id: "m", fecha: "2026-11-19", real: 5, completa: true }), false, "una de 5 minutos, no");
    assert.deepEqual([1, 2, 3, 4, 5].map(i => estrellas(S, r(i))), [true, true, true, true, false]);
    assert.ok(ledgerVigente(S, "foco:r1")); assert.equal(S.gamif.puntos, 20);
    assert.equal(estrellas(S, { id: "r9", fecha: "2026-11-20", real: 25, completa: true }), true, "otro día, otra vez");
  });
  test("«¿qué sigue?» por destino y las preferencias (lo que no es tuyo vuelve al de fábrica)", () => {
    const S = nuevo(); guardarSigue(S, "tarea:t1", "  revisar las citas  ");
    assert.equal(sigue(S, "tarea:t1"), "revisar las citas"); assert.equal(sigue(S, "tarea:t2"), "");
    assert.deepEqual(clone(Object.assign(pref(S), { ts: 0 })), { min: 25, ritmo: "una", estilo: "anillo", sonido: "", modo: "completa", ts: 0 });
    assert.equal(estiloUsable("luna", S), "anillo", "la luna sin comprar");
    ledgerRegistrar(S, "compra:foco-luna", -300, 0, "Compra"); assert.equal(estiloUsable("luna", S), "luna");
  });
  test("fusión: sesiones por id, «qué sigue» por clave y las preferencias, las más nuevas", () => {
    const a = { sesiones: [{ id: "x", ts: 1, real: 10, fecha: "2026-11-19" }], sigue: { "tarea:t": { txt: "a", ts: 5 }, "libro:l": { txt: "solo a", ts: 1 } }, pref: { min: 50, ts: 9 } };
    const b = { sesiones: [{ id: "x", ts: 3, real: 12, fecha: "2026-11-19" }, { id: "y", ts: 1, real: 5, fecha: "2026-11-18" }], sigue: { "tarea:t": { txt: "b", ts: 8 } }, pref: { min: 25, ts: 2 } };
    const m = merge(a, b);
    assert.deepEqual(clone(m.sesiones.map(s => s.id + s.real).sort()), ["x12", "y5"]);
    assert.deepEqual(clone([m.sigue["tarea:t"].txt, m.sigue["libro:l"].txt, m.pref.min]), ["b", "solo a", 50]);
    const L = nuevo(), Sv = nuevo(); L.enfoque = clone(a); Sv.enfoque = clone(b);
    assert.equal(mergeStates(clone(Sv), clone(L)).enfoque.sesiones.length, 2, "mergeStates usa la del Foco");
    assert.equal(minutosFoco({ enfoque: m }, "0000", "9999"), 17);
  });
  test("quien compró el modo enfoque recibe el reloj de arena y la lluvia (una vez)", () => {
    const S = nuevo(); ledgerRegistrar(S, "ingreso", 1000, 0, "x"); ledgerRegistrar(S, "compra:fun-enfoque", -600, 0, "Compra");
    regalo(S); regalo(S);
    assert.ok(ledgerVigente(S, "compra:foco-arena") && ledgerVigente(S, "compra:foco-lluvia"));
    assert.equal(S.gamif.ledger.filter(m => m.id === "compra:foco-arena").length, 1, "una sola vez");
    assert.ok(S.gamif.owned.includes("foco-arena") && S.gamif.owned.includes("foco-lluvia")); assert.equal(S.gamif.puntos, 400, "no cuesta nada");
    const N = nuevo(); regalo(N); assert.ok(!ledgerVigente(N, "compra:foco-arena"), "quien no lo compró, no");
  });

  /* Los avisos del servidor (notifier/foco.mjs) */
  const { mensajeFoco, avisosFoco, mensajeSala, avisoSala } = await import("../notifier/foco.mjs");
  function sbFalso(filas, sala) {
    const marcados = [], filtros = [];
    return {
      marcados, filtros,
      from: t => {
        const api = {
          update(c) { marcados.push([t, c]); return api; }, select() { return api; }, eq(k, v) { filtros.push([t, k, v]); return api; }, lte(k, v) { filtros.push([t, k, "lte", v]); return api; },
          maybeSingle: async () => t === "foco_salas" ? { data: sala, error: null } : t === "perfiles" ? { data: { nombre: "Ana López" }, error: null } : { data: { notif: {} }, error: null },
          then(res) { return Promise.resolve(t === "foco_avisos" ? { data: filas, error: null } : { data: [{ id: 1, endpoint: "e" }], error: null }).then(res); },
        };
        return api;
      },
    };
  }
  const env = [], sb = sbFalso([{ user_id: "u1", titulo: "Tesis", tipo: "fin" }, { user_id: "u2", titulo: "", tipo: "descanso" }]);
  const r = await avisosFoco({ sb, enviar: async (ds, m) => { env.push(m); return { enviadas: 1 }; }, ahora: new Date("2026-11-19T15:00:00Z") });
  const envS = [], sbS = sbFalso([], { anfitrion: "ana", invitado: "bruno", min: 25, titulo_a: "Tesis", titulo_b: "" });
  const rs = await avisoSala({ sb: sbS, yo: "ana", body: { tipo: "foco-invita", sala: "7" }, enviar: async (ds, m) => { envS.push(m); return { enviadas: 1 }; }, ahora: new Date("2026-11-19T15:00:00Z") });
  const rs2 = await avisoSala({ sb: sbFalso([], null), yo: "ana", body: { tipo: "foco-invita", sala: 7 }, enviar: async () => ({ enviadas: 1 }) });
  test("«¡Tiempo!» desde el servidor: las que ya pasaron, una vez (se marcan antes de mandar)", () => {
    assert.deepEqual(clone(r), { avisos: 2, enviadas: 2 });
    assert.deepEqual(clone(sb.marcados[0]), ["foco_avisos", { avisado: true }]);
    assert.ok(sb.filtros.some(f => f[1] === "avisado" && f[2] === false) && sb.filtros.some(f => f[1] === "fin" && f[2] === "lte"));
    assert.deepEqual(clone(env.map(m => m.title)), ["⏱️ ¡Tiempo!", "⏱️ Toca un descanso"]);
    assert.equal(mensajeFoco({ titulo: "Tesis" }).body, "Terminaste tu sesión de «Tesis». Abre Rumbo para cerrarla.");
    assert.equal(mensajeFoco({}).tag, "rumbo-enfoque");
  });
  test("el foco con un amigo: la invitación le llega a quien invitan (una vez y solo si corresponde)", () => {
    assert.equal(rs.enviadas, 1); assert.equal(envS[0].title, "Ana te invita a enfocarse juntos");
    assert.ok(/25 min, cada uno en lo suyo \(Ana: «Tesis»\)/.test(envS[0].body));
    assert.ok(sbS.filtros.some(f => f[1] === "anfitrion" && f[2] === "ana") && sbS.filtros.some(f => f[1] === "estado" && f[2] === "invitada"), "solo quien invitó, mientras está invitada");
    assert.deepEqual(clone(sbS.marcados[0]), ["foco_salas", { avisado_invita: true }]);
    assert.equal(rs2.motivo, "ya-avisado");
    assert.equal(mensajeSala({ tipo: "foco-acepta", nombre: "Bruno Díaz", titulo: "Informe" }).title, "Bruno se sumó: parten ahora");
  });
}
