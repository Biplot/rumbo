/* Tests del modo express del ritual diario */
export default async function ({ G, test, assert }) {
  console.log("\nModo express");
  const defaultState = G("defaultState"), migrate = G("migrate");
  const nuevaTarea = G("nuevaTarea"), moverTarea = G("moverTarea"), marcarTarea = G("marcarTarea"), tareasDelDia = G("tareasDelDia");
  const apertura = G("aplicarAperturaExpress"), cierre = G("aplicarCierreExpress"), cands = G("candidatasBocado");
  const pend = G("pendientesCierreExpress");
  const usar = s => G("(s => { STATE = s; })")(s);   // aplicarTriage usa todayISO/registrarMovimiento globales

  test("apertura express: abre el día, marca el bocado en la tarea existente y no borra nada", () => {
    const s = migrate(defaultState()); usar(s);
    const hoy = G("todayISO")();
    const a = nuevaTarea(s, hoy, { txt: "Informe", ambito: "pro" });
    nuevaTarea(s, hoy, { txt: "Banco", ambito: "per" });
    assert.equal(apertura(s, hoy, { sapo: "Informe", ambito: "pro", energia: 4 }), true);
    const r = s.ritual.dias[hoy];
    assert.equal(r.hecho, true); assert.equal(r.express.apertura, true); assert.equal(r.energia, 4);
    assert.equal(a.esSapo, true); assert.equal(tareasDelDia(hoy, s).length, 2);
    assert.equal(apertura(s, hoy, { sapo: "Otra cosa", ambito: "per", energia: 2 }), false);   // ya abierto
    assert.equal(a.esSapo, undefined); assert.equal(tareasDelDia(hoy, s).length, 3);
  });

  test("candidatas a bocado: la sugerida de ayer primero, sin repetir", () => {
    const s = migrate(defaultState()); usar(s);
    const hoy = G("todayISO")(), ayer = G("agSumar")(hoy, -1);
    const b = nuevaTarea(s, ayer, { txt: "Propuesta", ambito: "pro", esSapo: true });
    moverTarea(s, b, ayer, hoy, "migrada", { hoy: ayer });
    nuevaTarea(s, hoy, { txt: "Propuesta", ambito: "pro" });
    nuevaTarea(s, hoy, { txt: "Banco", ambito: "per" });
    const c = cands(s, hoy);
    assert.equal(c[0].txt, "Propuesta"); assert.equal(c.length, 2);
  });

  test("cierre express: pendientes a mañana, crónicas según elección, diario y racha", () => {
    const s = migrate(defaultState()); usar(s);
    const hoy = G("todayISO")(), sumar = G("agSumar");
    apertura(s, hoy, { sapo: "Informe", ambito: "pro", energia: 3 });
    const inf = tareasDelDia(hoy, s)[0]; marcarTarea(inf, "hecha");
    nuevaTarea(s, hoy, { txt: "Banco", ambito: "per" });
    const c = nuevaTarea(s, hoy, { txt: "Bodega", ambito: "per", migraciones: 2 });   // sería la 3.ª
    const p = pend(s, hoy);
    assert.equal(p.cronicas.length, 1); assert.equal(p.resto.length, 1);
    const { nuevo, n } = cierre(s, hoy, { mood: 4, gratitud: "Buen día", elecciones: { [c.id]: "soltar" } });
    assert.equal(nuevo, true); assert.equal(n.movidas, 1); assert.equal(n.soltadas, 1);
    const r = s.ritual.dias[hoy];
    assert.equal(r.cerrado, true); assert.equal(r.express.cierre, true); assert.equal(r.cierre.sapo, true);
    assert.equal(tareasDelDia(sumar(hoy, 1), s).map(t => t.txt).join(), "Banco");
    const e = s.vida.diario.find(x => x.fecha === hoy && x.fromRitual);
    assert.equal(e.mood, 4); assert.equal(e.gratitud, "Buen día");
    assert.equal(cierre(s, hoy, { mood: 3 }).nuevo, false);                           // ya cerrado: no paga de nuevo
  });
}
