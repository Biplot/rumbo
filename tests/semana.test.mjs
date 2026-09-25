/* Tests del ritual semanal: ajustes, fusión, ventanas, números e insignias */
export default async function ({ G, test, assert, clone }) {
  console.log("\nRitual semanal");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const nuevaTarea = G("nuevaTarea"), marcarTarea = G("marcarTarea"), moverTarea = G("moverTarea");
  const pendientes = G("ritualSemanaPendientes"), cerrable = G("semanaCerrable"), planificable = G("semanaPlanificable");
  const resumen = G("resumenSemanaRitual"), redondas = G("g_semanasRedondas"), seguidas = G("g_semanasSeguidas");
  const cfgTriage = G("cfgTriageSemana"), rango = G("rangoSemanaTxt"), rangoCorto = G("rangoSemanaCorto");
  const at = (iso, h = 10) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00`);

  test("ajuste del día del ritual: por defecto domingo, migración idempotente", () => {
    assert.equal(defaultState().settings.ritualSemanal.dia, 0);
    const viejo = defaultState(); delete viejo.settings.ritualSemanal;
    const m = migrate(viejo);
    assert.equal(m.settings.ritualSemanal.dia, 0);
    m.settings.ritualSemanal = { dia: 1, ts: 9 };
    assert.equal(migrate(clone(m)).settings.ritualSemanal.dia, 1);
  });

  test("fusión: plan, apertura y cierre de la semana por separado; el día del ritual por ts", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.ritual.semanas["2026-09-21"] = { apertura: { foco: "A", prioridades: [], ts: 10 }, plan: { premio: "Cine", ts: 5 } };
    b.ritual.semanas["2026-09-21"] = { apertura: { foco: "B", prioridades: [], ts: 3 }, cierre: { nota: 8, ts: 20 }, plan: { premio: "Asado", ts: 7 } };
    a.settings.ritualSemanal = { dia: 0, ts: 1 }; b.settings.ritualSemanal = { dia: 1, ts: 50 };
    const r = migrate(mergeStates(clone(a), clone(b)));
    const w = r.ritual.semanas["2026-09-21"];
    assert.equal(w.apertura.foco, "A"); assert.equal(w.cierre.nota, 8); assert.equal(w.plan.premio, "Asado");
    assert.equal(r.settings.ritualSemanal.dia, 1);
    // sin ts en el servidor, se queda el local
    b.settings.ritualSemanal = { dia: 1 };
    assert.equal(migrate(mergeStates(clone(a), clone(b))).settings.ritualSemanal.dia, 0);
  });

  test("ventanas con ritual el domingo: domingo = cierre + apertura; lunes hasta mediodía", () => {
    const s = migrate(defaultState());
    nuevaTarea(s, "2026-09-23", { txt: "Algo" });            // la semana del 21 tuvo actividad
    assert.equal(JSON.stringify(pendientes(at("2026-09-26"), s)), "{}");                  // sábado: aún no
    assert.equal(JSON.stringify(pendientes(at("2026-09-27", 20), s)), JSON.stringify({ cierre: "2026-09-21", apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-28", 9), s)), JSON.stringify({ cierre: "2026-09-21", apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-28", 15), s)), JSON.stringify({ apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-29", 9), s)), JSON.stringify({ apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-30", 9), s)), "{}");
    s.ritual.semanas["2026-09-21"] = { cierre: { ts: 1 } }; s.ritual.semanas["2026-09-28"] = { apertura: { ts: 1 } };
    assert.equal(JSON.stringify(pendientes(at("2026-09-27", 20), s)), "{}");
  });

  test("ventanas con ritual el lunes; sin actividad no se pide cerrar", () => {
    const s = migrate(defaultState());
    s.settings.ritualSemanal = { dia: 1 };
    assert.equal(JSON.stringify(pendientes(at("2026-09-27", 20), s)), "{}");               // domingo: nada
    assert.equal(JSON.stringify(pendientes(at("2026-09-28", 15), s)), JSON.stringify({ apertura: "2026-09-28" }));  // semana vacía: solo planificar
    nuevaTarea(s, "2026-09-22", { txt: "Algo" });
    assert.equal(JSON.stringify(pendientes(at("2026-09-28", 15), s)), JSON.stringify({ cierre: "2026-09-21", apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-29", 11), s)), JSON.stringify({ cierre: "2026-09-21", apertura: "2026-09-28" }));
    assert.equal(JSON.stringify(pendientes(at("2026-09-29", 13), s)), JSON.stringify({ apertura: "2026-09-28" }));
  });

  test("se puede cerrar desde el viernes 14:00 y planificar la próxima desde entonces", () => {
    assert.equal(cerrable("2026-09-21", at("2026-09-25", 13)), false);
    assert.equal(cerrable("2026-09-21", at("2026-09-25", 14)), true);
    assert.equal(cerrable("2026-09-14", at("2026-09-23")), true);    // la anterior, siempre
    assert.equal(cerrable("2026-09-07", at("2026-09-23")), false);
    assert.equal(planificable("2026-09-21", at("2026-09-22")), true);
    assert.equal(planificable("2026-09-28", at("2026-09-25", 13)), false);
    assert.equal(planificable("2026-09-28", at("2026-09-26")), true);
  });

  test("números de la semana y migración semanal", () => {
    const s = migrate(defaultState());
    s.ritual.semanas["2026-09-21"] = { apertura: { prioridades: [{ id: "p1", texto: "Lanzar" }, { id: "p2", texto: "Leer" }], ts: 1 } };
    const a = nuevaTarea(s, "2026-09-21", { txt: "A" }); marcarTarea(a, "hecha");
    const b = nuevaTarea(s, "2026-09-22", { txt: "B" }); moverTarea(s, b, "2026-09-22", "2026-09-23", "migrada", { hoy: "2026-09-22" });
    s.ritual.dias["2026-09-21"] = { hecho: true, cerrado: true, cierre: { sapo: true } };
    const r = resumen("2026-09-21", s, { p1: "cumplida", p2: "no" });
    assert.equal(JSON.stringify(r.prioridades), "[1,2]");
    assert.equal(JSON.stringify(r.tareas), "[1,2]"); assert.equal(r.postergacion, 50);
    assert.equal(r.abiertos, 1); assert.equal(r.cerrados, 1); assert.equal(r.bocados, 1);
    assert.equal(resumen("2026-09-21", s).prioridades, null);        // sin evaluación todavía
    assert.equal(rango("2026-09-21"), "21 al 27 de septiembre");
    assert.equal(rango("2026-09-28"), "28 de septiembre al 4 de octubre");
    assert.equal(rangoCorto("2026-09-21"), "21–27\u00a0sep");
    assert.equal(rangoCorto("2026-09-28"), "28\u00a0sep – 4\u00a0oct");
  });

  test("insignias: semana redonda y 4 semanas seguidas", () => {
    const s = migrate(defaultState());
    const redonda = () => ({ apertura: { ts: 1 }, cierre: { ts: 1 } });
    s.ritual.semanas = { "2026-08-31": redonda(), "2026-09-07": redonda(), "2026-09-14": { apertura: { ts: 1 } }, "2026-09-21": redonda() };
    assert.equal(redondas(s).length, 3); assert.equal(seguidas(s, 4), false);
    s.ritual.semanas["2026-09-14"].cierre = { ts: 2 };
    assert.equal(seguidas(s, 4), true);
  });

  test("migración semanal: a la próxima semana, o a hoy si la semana ya pasó", () => {
    const hoy = G("todayISO")(), agLunes = G("agLunes"), agSumar = G("agSumar");
    const L = agLunes(hoy);
    assert.equal(cfgTriage(L).mover, "semana");
    assert.equal(cfgTriage(agSumar(L, -7)).mover, "hoy");
  });
}
