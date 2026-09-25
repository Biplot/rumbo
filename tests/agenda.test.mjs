/* Tests del registro diario (agenda por fecha): migración, fusión y movimientos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nRegistro diario");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const nuevaTarea = G("nuevaTarea"), moverTarea = G("moverTarea"), deshacerMovimiento = G("deshacerMovimiento");
  const tareasDelDia = G("tareasDelDia"), resumenDia = G("resumenDia"), pendientesAnteriores = G("pendientesAnteriores");
  const borrarTarea = G("borrarTarea"), marcarTarea = G("marcarTarea");

  /* Estado "v45": sin agenda, con tareas en el planificador semanal */
  const conSemana = () => {
    const s = defaultState(); delete s.agenda;
    s.semana = { weekOf: "2026-09-21", premio: "Cine", borradas: ["x"], dias: [[], [], [
      { id: "a", txt: "Informe", done: true, ambito: "pro", ts: 5 },
      { id: "b", txt: "Banco", done: false, esSapo: true },
      { id: "x", txt: "Borrada", done: false },
    ], [], [], [], []] };
    return s;
  };

  test("migra el planificador al registro diario (idempotente, sin borradas)", () => {
    const m = migrate(conSemana());
    const dia = m.agenda.dias["2026-09-23"];
    assert.equal(dia.map(t => t.id).join(), "a,b");
    assert.equal(dia[0].estado, "hecha"); assert.equal(dia[1].estado, "pendiente");
    assert.equal(dia[1].esSapo, true); assert.equal(dia[0].origen, "a"); assert.equal(dia[0].creada, "2026-09-23");
    assert.equal(m.ritual.semanas["2026-09-21"].plan.premio, "Cine");
    const m2 = migrate(clone(m));
    assert.equal(m2.agenda.dias["2026-09-23"].length, 2);
  });

  test("tareas que agrega un cliente antiguo al planificador se importan por id", () => {
    const m = migrate(conSemana());
    m.semana.dias[3].push({ id: "c", txt: "Nueva desde el cliente viejo", done: false });
    const m2 = migrate(clone(m));
    assert.equal(tareasDelDia("2026-09-24", m2).map(t => t.id).join(), "c");
    assert.equal(tareasDelDia("2026-09-23", m2).length, 2);
  });

  test("fusión por fecha y por tarea: gana el cambio más reciente, las borradas no reviven", () => {
    const base = migrate(defaultState());
    base.agenda.dias["2026-09-23"] = [{ id: "t1", txt: "A", estado: "pendiente", done: false, ts: 10 }, { id: "t2", txt: "B", estado: "pendiente", done: false, ts: 10 }];
    const nube = clone(base), movil = clone(base);
    nube.agenda.dias["2026-09-23"][0] = { ...nube.agenda.dias["2026-09-23"][0], estado: "hecha", done: true, ts: 30 };
    movil.agenda.dias["2026-09-23"][1] = { ...movil.agenda.dias["2026-09-23"][1], borrada: true, ts: 20 };
    movil.agenda.dias["2026-09-24"] = [{ id: "t3", txt: "C", estado: "pendiente", done: false, ts: 20 }];
    const r = mergeStates(clone(nube), clone(movil));
    const d23 = r.agenda.dias["2026-09-23"];
    assert.equal(d23.find(t => t.id === "t1").estado, "hecha");
    assert.equal(d23.find(t => t.id === "t2").borrada, true);
    assert.equal(tareasDelDia("2026-09-23", r).map(t => t.id).join(), "t1");
    assert.equal(r.agenda.dias["2026-09-24"].length, 1);
  });

  test("mover: la original queda marcada y la copia lleva la cuenta de postergaciones", () => {
    const s = migrate(defaultState());
    const t = nuevaTarea(s, "2026-09-23", { txt: "Llamar al banco", ambito: "per" });
    const c1 = moverTarea(s, t, "2026-09-23", "2026-09-24", "migrada", { hoy: "2026-09-23" });
    assert.equal(t.estado, "migrada"); assert.equal(t.destino, "2026-09-24"); assert.equal(t.postergada, true);
    assert.equal(c1.migraciones, 1); assert.equal(c1.origen, t.id); assert.equal(c1.creada, "2026-09-23");
    const c2 = moverTarea(s, c1, "2026-09-24", "2026-10-02", "programada", { hoy: "2026-09-24" });
    assert.equal(c1.estado, "programada"); assert.equal(c2.migraciones, 2); assert.equal(c2.origen, t.id);
    // replanificar antes de su día no cuenta como postergación
    const c3 = moverTarea(s, c2, "2026-10-02", "2026-10-05", "programada", { hoy: "2026-09-25" });
    assert.equal(c2.postergada, false); assert.equal(c3.migraciones, 2);
  });

  test("mover el primer bocado lo deja como sugerencia; deshacer revierte si la copia sigue intacta", () => {
    const s = migrate(defaultState());
    const b = nuevaTarea(s, "2026-09-23", { txt: "Propuesta", ambito: "pro", esSapo: true });
    const copia = moverTarea(s, b, "2026-09-23", "2026-09-24", "migrada", { hoy: "2026-09-23" });
    assert.equal(copia.bocadoSugerido, true);
    assert.equal(deshacerMovimiento(s, b), true);
    assert.equal(b.estado, "pendiente"); assert.equal(b.destino, undefined);
    assert.equal(tareasDelDia("2026-09-24", s).length, 0);
    // si la copia ya se hizo, no se puede deshacer
    const c2 = moverTarea(s, b, "2026-09-23", "2026-09-24", "migrada", { hoy: "2026-09-23" });
    marcarTarea(c2, "hecha");
    assert.equal(deshacerMovimiento(s, b), false);
  });

  test("métricas: índice de postergación, arrastre, bocado postergado y crónicas", () => {
    const tmResumen = G("tmResumen");
    const s = migrate(defaultState());
    const A = nuevaTarea(s, "2026-09-21", { txt: "A", ambito: "pro" }); marcarTarea(A, "hecha");
    const B = nuevaTarea(s, "2026-09-21", { txt: "B", ambito: "per" });
    const B1 = moverTarea(s, B, "2026-09-21", "2026-09-22", "migrada", { hoy: "2026-09-21" });
    const C = nuevaTarea(s, "2026-09-21", { txt: "C", ambito: "per" }); marcarTarea(C, "soltada");
    const D = nuevaTarea(s, "2026-09-22", { txt: "D", ambito: "pro" }); marcarTarea(D, "hecha");
    const E = nuevaTarea(s, "2026-09-22", { txt: "E", ambito: "pro", esSapo: true });
    const E1 = moverTarea(s, E, "2026-09-22", "2026-09-23", "migrada", { hoy: "2026-09-22" }); E1.esSapo = true; marcarTarea(E1, "hecha");
    const B2 = moverTarea(s, B1, "2026-09-22", "2026-09-23", "migrada", { hoy: "2026-09-22" }); marcarTarea(B2, "hecha");
    const r = tmResumen(s, "2026-09-21", "2026-09-27");
    assert.equal(r.tareas, 5); assert.equal(r.postergadas, 2); assert.equal(r.indice, 40);
    assert.equal(r.hechas, 4); assert.equal(r.cumplimiento, 80); assert.equal(r.soltadas, 1);
    assert.equal(r.arrastre, 0.8);                       // (0 + 2 + 0 + 1) / 4
    assert.equal(r.bocado.dias, 2); assert.equal(r.bocado.postergados, 1); assert.equal(r.bocado.pct, 50);
    assert.equal(r.porAmbito.pro.tareas, 3); assert.equal(r.porAmbito.pro.postergadas, 1);
    assert.equal(r.cronicas.length, 0);
    // una tarea postergada 3 veces pasa a ser crónica
    let F = nuevaTarea(s, "2026-09-24", { txt: "Crónica" });
    ["2026-09-25", "2026-09-26", "2026-09-27"].forEach((d, i) => { F = moverTarea(s, F, i ? ["2026-09-25", "2026-09-26"][i - 1] : "2026-09-24", d, "migrada", { hoy: "2026-09-27" }); });
    const r2 = tmResumen(s, "2026-09-21", "2026-09-27");
    assert.equal(r2.cronicas.length, 1); assert.equal(r2.cronicas[0].n, 3); assert.equal(r2.cronicas[0].txt, "Crónica");
    assert.equal(r2.pendientes, 1);
  });

  test("capacidad real y serie semanal", () => {
    const tmCapacidad = G("tmCapacidad"), tmSerieSemanas = G("tmSerieSemanas");
    const s = migrate(defaultState());
    for (let d = 14; d <= 20; d++) {
      const iso = `2026-09-${d}`;
      for (let k = 0; k < 4; k++) { const t = nuevaTarea(s, iso, { txt: iso + k }); if (k < 3) marcarTarea(t, "hecha"); }
    }
    const cap = tmCapacidad(s, "2026-09-21");
    assert.equal(cap.dias, 7); assert.equal(cap.hechasProm, 3); assert.equal(cap.planProm, 4);
    assert.equal(tmCapacidad(migrate(defaultState()), "2026-09-21"), null);
    const serie = tmSerieSemanas(s, "2026-09-21", 3);
    assert.equal(serie.length, 3); assert.equal(serie[1].lunes, "2026-09-14"); assert.equal(serie[1].cumplimiento, 75);
    assert.equal(serie[2].indice, null);
  });

  test("replanificar antes de su día no cuenta como postergación ni en el plan del día", () => {
    const tmResumen = G("tmResumen"), tmDia = G("tmDia");
    const s = migrate(defaultState());
    const t = nuevaTarea(s, "2026-09-24", { txt: "Futura" });                       // jueves
    const t1 = moverTarea(s, t, "2026-09-24", "2026-09-25", "migrada", { hoy: "2026-09-22" });
    marcarTarea(t1, "hecha");
    const h = nuevaTarea(s, "2026-09-24", { txt: "Otra" }); marcarTarea(h, "hecha");
    assert.equal(t1.migraciones, 0);
    const d = tmDia(s, "2026-09-24");
    assert.equal(d.planificadas, 1); assert.equal(d.movidas, 0); assert.equal(d.pct, 100);
    const r = tmResumen(s, "2026-09-21", "2026-09-27");
    assert.equal(r.tareas, 2); assert.equal(r.postergadas, 0); assert.equal(r.indice, 0);
    assert.equal(r.porDia[3].planificadas, 1); assert.equal(r.porDia[3].postergadas, 0);
  });

  test("resumen del día y bandeja de pendientes anteriores", () => {
    const s = migrate(defaultState());
    const a = nuevaTarea(s, "2026-09-22", { txt: "Vieja" });
    const h = nuevaTarea(s, "2026-09-23", { txt: "Hecha" }); marcarTarea(h, "hecha");
    const m = nuevaTarea(s, "2026-09-23", { txt: "Movida" }); moverTarea(s, m, "2026-09-23", "2026-09-24", "migrada", { hoy: "2026-09-23" });
    const so = nuevaTarea(s, "2026-09-23", { txt: "Soltada" }); marcarTarea(so, "soltada");
    const bo = nuevaTarea(s, "2026-09-23", { txt: "Borrada" }); borrarTarea(bo);
    const r = resumenDia(s, "2026-09-23");
    assert.equal(r.planificadas, 3); assert.equal(r.hechas, 1); assert.equal(r.migradas, 1); assert.equal(r.soltadas, 1);
    const band = pendientesAnteriores(s, "2026-09-24");
    assert.equal(band.map(x => x.t.txt).join(), "Vieja");
  });
}
