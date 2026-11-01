/* Tests de tus alcancías (alcancias.js y alcMerge en store.js): la fusión entre equipos, lo guardado y lo deshecho,
   los montos rápidos, cuánto al mes para llegar a la fecha, la racha de ahorro, el reparto del cierre de mes y la torre del año */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTus alcancías");
  const merge = G("alcMerge"), mergeStates = G("mergeStates"), defaultState = G("defaultState"), migrate = G("migrate");
  const guardado = G("alcGuardado"), aportes = G("alcAportes"), rapidos = G("alcRapidos"), porMes = G("alcPorMes"), racha = G("alcRacha"), semanas = G("alcSemanas");
  const crear = G("alcCrear"), aportar = G("alcAportar"), deshacer = G("alcDeshacerAporte"), cumplidas = G("alcCumplidas"), torre = G("alcTorreDatos"), repartir = G("alcRepartir"), repartido = G("alcRepartido");
  const al = (id, ts, aps, extra = {}) => Object.assign({ id, nombre: id, meta: 100000, fecha: "", estilo: "greda", destino: "", creada: 1, cerrada: 0, ts, aportes: aps.map(([i, monto, t, fecha]) => ({ id: i, monto, ts: t, fecha: fecha || "2026-10-20" })), b: [] }, extra);

  test("un estado nuevo o viejo trae las alcancías vacías", () => {
    const s = defaultState(); delete s.alcancias; migrate(s);
    assert.deepEqual(clone(s.alcancias), { lista: [], borradas: [], ocultar: false, ts: 0 });
    const v = defaultState(); v.alcancias = { lista: [al("x", 1, [])] }; migrate(v);
    assert.deepEqual(clone([v.alcancias.lista.length, v.alcancias.borradas]), [1, []], "lo que ya tenía se conserva");
  });
  test("dos equipos: se juntan los aportes, lo deshecho no vuelve, lo editado es del más nuevo y lo borrado no revive", () => {
    const tel = { lista: [Object.assign(al("a", 20, [["p1", 10000, 1], ["p2", 20000, 2]]), { nombre: "Viaje al sur", b: ["p3"] }), al("b", 5, [])], borradas: ["c"], ocultar: true, ts: 9 };
    const pc = { lista: [Object.assign(al("a", 10, [["p3", 5000, 3], ["p4", 7000, 4]]), { nombre: "Viaje", cerrada: 77 }), al("c", 5, [["q", 1000, 1]])], borradas: [], ocultar: false, ts: 4 };
    const r = clone(merge(tel, pc)), a = r.lista.find(x => x.id === "a");
    assert.deepEqual(a.aportes.map(x => x.id), ["p1", "p2", "p3", "p4"]);
    assert.deepEqual(a.b, ["p3"]);
    assert.equal(guardado(a), 37000, "10.000 + 20.000 + 7.000 (el p3 se deshizo en el teléfono)");
    assert.deepEqual([a.nombre, a.cerrada, a.ts], ["Viaje al sur", 77, 20], "el nombre del más nuevo; cerrada en cualquiera queda cerrada");
    assert.deepEqual(r.lista.map(x => x.id).sort(), ["a", "b"], "la borrada en el teléfono no revive");
    assert.deepEqual([r.ocultar, r.ts, r.borradas], [true, 9, ["c"]]);
    const s = mergeStates({ alcancias: pc, gamif: {} }, { alcancias: tel, gamif: {} });
    assert.equal(guardado(s.alcancias.lista.find(x => x.id === "a")), 37000, "mergeStates usa la misma fusión");
  });
  test("guardar y deshacer: se suma lo que sigue; deshacer quita el último (o el que eliges)", () => {
    const S = defaultState(), a = crear({ nombre: "Bici", meta: 450000, estilo: "frasco" }, S);
    assert.equal(a.estilo, "greda", "un estilo que no tienes queda en el chanchito de greda");
    aportar(a.id, 50000, null, S, "2026-10-01"); aportar(a.id, 20000, null, S, "2026-10-02"); aportar(a.id, -5, null, S); aportar(a.id, 0, null, S);
    assert.equal(guardado(a), 70000, "los montos en cero o negativos no se guardan");
    deshacer(a.id, null, S); assert.equal(guardado(a), 50000, "deshacer quita el último");
    assert.equal(aportes(a).length, 1);
    assert.equal(cumplidas(S), 0);
    aportar(a.id, 400000, null, S); assert.equal(cumplidas(S), 1, "al llegar a la meta cuenta para «Primera alcancía»");
    a.cerrada = 5; assert.equal(aportar(a.id, 1000, null, S), null, "una alcancía cerrada ya no recibe aportes");
  });
  test("los montos rápidos salen de tu meta mensual; sin meta, 5, 10 y 20 mil", () => {
    const S = defaultState();
    S.finanzas.metaMensual = 0; assert.deepEqual(clone(rapidos(S)), [5000, 10000, 20000]);
    S.finanzas.metaMensual = 200000; assert.deepEqual(clone(rapidos(S)), [50000, 100000, 200000]);
    S.finanzas.metaMensual = 150000; assert.deepEqual(clone(rapidos(S)), [38000, 75000, 150000], "redondeados a miles");
  });
  test("con fecha: cuánto al mes para llegar, contando este mes", () => {
    const a = al("f", 1, [["x", 100000, 1]], { meta: 700000, fecha: "2027-02-15" });
    assert.equal(porMes(a, "2026-11-01"), 150000, "faltan 600.000 en 4 meses (nov, dic, ene y feb)");
    assert.equal(porMes(Object.assign({}, a, { fecha: "" }), "2026-11-01"), null, "sin fecha, nada");
    assert.equal(porMes(Object.assign({}, a, { fecha: "2026-09-01" }), "2026-11-01"), null, "una fecha que ya pasó, nada");
  });
  test("la racha de ahorro: semanas seguidas con algo guardado a mano (el reparto del cierre no cuenta)", () => {
    const S = defaultState(), a = crear({ nombre: "R", meta: 1000000 }, S);
    ["2026-10-06", "2026-10-14", "2026-10-21"].forEach(f => aportar(a.id, 1000, null, S, f));
    aportar(a.id, 1000, "cierre:2026-09", S, "2026-09-30");
    assert.deepEqual([...semanas(S)].sort(), ["2026-10-05", "2026-10-12", "2026-10-19"]);
    assert.equal(racha(S, "2026-10-29"), 3, "esta semana aún no guardas: cuenta hasta la pasada");
    aportar(a.id, 1000, null, S, "2026-10-29");
    assert.equal(racha(S, "2026-10-29"), 4);
    assert.equal(racha(S, "2026-11-12"), 0, "una semana sin guardar corta la racha");
  });
  test("el cierre de mes: lo repartido queda con la fecha del fin del mes y se reconoce", () => {
    const S = defaultState(), a = crear({ nombre: "A", meta: 500000 }, S), b = crear({ nombre: "B", meta: 500000 }, S);
    assert.equal(repartir(S, "2026-10", { [a.id]: 70000, [b.id]: 50000 }), 2);
    assert.deepEqual(clone(aportes(a).map(x => [x.monto, x.fecha, x.o])), [[70000, "2026-10-31", "cierre:2026-10"]]);
    assert.equal(repartido(S, "2026-10"), 120000);
    assert.equal(repartido(S, "2026-09"), 0);
  });
  test("la torre del año: ingreso menos gasto por mes, los meses sin datos vacíos y el mes elegido", () => {
    const S = defaultState(), y = 2026;
    S.finanzas.metaMensual = 200000;
    const D = G("datosAnio")(S, y, true);
    D.finanzas.meses[0] = { ingreso: 1500000, gasto: 1300000 }; D.finanzas.meses[2] = { ingreso: 1000000, gasto: 1060000, metaAhorro: 100000 };
    const T = torre(S, y, "2026-11-01");
    assert.deepEqual(clone(T.meses.slice(0, 4).map(x => x.v)), [200000, null, -60000, null]);
    assert.deepEqual(clone([T.meses[2].meta, T.meses[0].meta]), [100000, 200000], "la meta del mes, o la mensual");
    assert.deepEqual(clone([T.total, T.sel]), [140000, 2], "el último mes con datos hasta hoy");
  });
}
