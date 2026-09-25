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
