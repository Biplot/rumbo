/* Tests del motor de hábitos y del ritual de mes (los carga merge.test.mjs) */
export default async function ({ G, test, assert, clone, cargar, estadoViejo }) {
  console.log("\nMotor de hábitos");
  const set = code => G(code);
  set("HM_HOY = '2026-09-23'");   // miércoles
  const defaultState = G("defaultState"), migrate = G("migrate");
  const cumplimiento = G("cumplimiento"), tocaHoy = G("tocaHoy"), progresoPeriodoActual = G("progresoPeriodoActual");
  const rachaPeriodos = G("rachaPeriodos"), hmMetaPeriodo = G("hmMetaPeriodo"), semanaPerfecta = G("semanaPerfecta");

  const marcar = (s, h, isos) => isos.forEach(iso => {
    const [y, m, d] = iso.split("-").map(Number); const k = `${y}-${m}`;
    s.habitos.log[k] = s.habitos.log[k] || {}; s.habitos.log[k][h.id] = s.habitos.log[k][h.id] || {};
    s.habitos.log[k][h.id][d] = true;
  });
  const nuevo = (frecuencia, creado = "2026-09-01") => {
    const s = migrate(defaultState());
    s.habitos.defs = [{ id: "h1", nombre: "X", icon: "✅", frecuencia, creado }];
    return [s, s.habitos.defs[0]];
  };

  test("diario: días hechos / días transcurridos (hoy no penaliza)", () => {
    const [s, h] = nuevo({ tipo: "diario" }, "2026-09-21");
    marcar(s, h, ["2026-09-21"]);                  // lun hecho, mar no, mié (hoy) pendiente
    const c = cumplimiento(h, "2026-09-01", "2026-09-30", s);
    assert.equal(c.esperado, 2); assert.equal(c.hecho, 1); assert.equal(c.pct, 50);
    assert.equal(tocaHoy(h, s), true);
  });

  test("semanal 3×: la semana en curso no penaliza y muestra progreso", () => {
    const [s, h] = nuevo({ tipo: "semanal", veces: 3 }, "2026-09-14");
    marcar(s, h, ["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-21"]); // semana pasada 3/3, esta 1/3
    const c = cumplimiento(h, "2026-09-01", "2026-09-30", s);
    assert.equal(c.pct, 100);
    assert.equal(progresoPeriodoActual(h, s).texto, "1/3 esta semana");
    assert.equal(tocaHoy(h, s), true);
    marcar(s, h, ["2026-09-22", "2026-09-23"]);
    assert.equal(tocaHoy(h, s), false, "cuota cumplida: ya no toca");
    assert.equal(hmMetaPeriodo(h, "2026-09-23", s).cumplido, true);
  });

  test("días fijos: los días extra no suben de 100%", () => {
    const [s, h] = nuevo({ tipo: "dias", dias: [0, 2, 4] }, "2026-09-14"); // L-M-V
    marcar(s, h, ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-21"]);
    const c = cumplimiento(h, "2026-09-01", "2026-09-30", s);
    assert.equal(c.pct, 100);
    assert.equal(c.esperado, 4);  // 14, 16, 18, 21 (hoy 23 pendiente, no cuenta)
  });

  test("mensual: cuota por mes; racha en meses", () => {
    const [s, h] = nuevo({ tipo: "mensual", veces: 2 }, "2026-07-01");
    marcar(s, h, ["2026-07-03", "2026-07-20", "2026-08-02", "2026-08-09", "2026-09-05", "2026-09-06"]);
    assert.equal(cumplimiento(h, "2026-07-01", "2026-12-31", s).pct, 100);
    const r = rachaPeriodos(h, s);
    assert.equal(r.n, 3); assert.equal(r.unidad, "meses");
  });

  test("pausado: no se mide ni toca hoy", () => {
    const [s, h] = nuevo({ tipo: "diario" });
    h.pausado = true;
    assert.equal(tocaHoy(h, s), false);
    assert.equal(cumplimiento(h, "2026-09-01", "2026-09-30", s).pct, null);
  });

  test("Semana Perfecta: todos cumplen su objetivo semanal (mensuales no cuentan)", () => {
    const s = migrate(defaultState());
    s.habitos.defs = [
      { id: "a", nombre: "A", icon: "", frecuencia: { tipo: "semanal", veces: 2 }, creado: "2026-09-01" },
      { id: "b", nombre: "B", icon: "", frecuencia: { tipo: "dias", dias: [0] }, creado: "2026-09-01" },
      { id: "c", nombre: "C", icon: "", frecuencia: { tipo: "mensual", veces: 20 }, creado: "2026-09-01" },
    ];
    marcar(s, s.habitos.defs[0], ["2026-09-15", "2026-09-17"]);
    assert.equal(semanaPerfecta(s, "2026-09-14"), false);
    marcar(s, s.habitos.defs[1], ["2026-09-14"]);
    assert.equal(semanaPerfecta(s, "2026-09-14"), true);
  });

  test("migración: hábitos viejos quedan diarios, creados en su primera marca", () => {
    const v = estadoViejo(0, 0);
    v.habitos.defs = [{ id: "z", nombre: "Z", icon: "💧" }];
    v.habitos.log = { "2026-3": { z: { 9: true } }, "2026-2": { z: { 27: true } } };
    const m = migrate(clone(v));
    assert.equal(m.habitos.defs[0].frecuencia.tipo, "diario");
    assert.equal(m.habitos.defs[0].creado, "2026-02-27");
    assert.equal(migrate(clone(m)).habitos.defs[0].creado, "2026-02-27");
  });

  const extra2 = G("typeof mesKey === 'function'");
  if (extra2) {
    console.log("\nRitual de mes");
    const mergeStates = G("mergeStates");
    test("ritual de mes: apertura y cierre se fusionan por separado según ts", () => {
      const A = migrate(defaultState()), B = migrate(defaultState());
      A.ritual.meses = { "2026-09": { apertura: { foco: "A", ts: 10 }, cierre: { nota: 7, ts: 50 } } };
      B.ritual.meses = { "2026-09": { apertura: { foco: "B", ts: 20 } }, "2026-10": { apertura: { foco: "Oct", ts: 5 } } };
      const r = mergeStates(clone(A), clone(B));
      assert.equal(r.ritual.meses["2026-09"].apertura.foco, "B");
      assert.equal(r.ritual.meses["2026-09"].cierre.nota, 7);
      assert.equal(r.ritual.meses["2026-10"].apertura.foco, "Oct");
    });
    test("introVersion se fusiona con el máximo", () => {
      const A = migrate(defaultState()), B = migrate(defaultState());
      A.settings.introVersion = 2; B.settings.introVersion = 1;
      assert.equal(mergeStates(clone(A), clone(B)).settings.introVersion, 2);
      assert.equal(mergeStates(clone(B), clone(A)).settings.introVersion, 2);
    });
    console.log("\nTareas entre dispositivos");
    const conTareas = (tareas, borradas) => { const s = migrate(defaultState()); s.semana.weekOf = "2026-09-21";
      s.semana.dias[2] = tareas; if (borradas) s.semana.borradas = borradas; return s; };
    test("tarea: gana el cambio más reciente (ts), no el dispositivo", () => {
      const nube = conTareas([{ id: "t1", txt: "A", done: true, ambito: "pro", ts: 200 }]);
      const movil = conTareas([{ id: "t1", txt: "A", done: false, ambito: "per" }]);
      const t = mergeStates(clone(nube), clone(movil)).semana.dias[2][0];
      assert.equal(t.done, true); assert.equal(t.ambito, "pro");
    });
    test("tarea borrada en un dispositivo no revive al fusionar", () => {
      const nube = conTareas([{ id: "t2", txt: "B" }], ["t1"]);
      const movil = conTareas([{ id: "t1", txt: "A" }, { id: "t2", txt: "B" }]);
      const r = mergeStates(clone(nube), clone(movil));
      assert.equal(r.semana.dias[2].map(t => t.id).join(), "t2");
      assert.equal(JSON.stringify(r.semana.borradas), "[\"t1\"]");
    });
    test("semana más nueva en la nube reemplaza a la vieja local", () => {
      const nube = conTareas([{ id: "n", txt: "Nueva" }]);
      const movil = migrate(defaultState()); movil.semana.weekOf = "2026-09-14"; movil.semana.dias[2] = [{ id: "v", txt: "Vieja" }];
      assert.equal(mergeStates(clone(nube), clone(movil)).semana.dias[2].map(t => t.id).join(), "n");
    });
  }
  set("HM_HOY = null");
}
