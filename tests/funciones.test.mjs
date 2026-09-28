/* Tests de las funciones de la Tienda (funciones.js): compra única, plantillas, pronóstico, enfoque y notificador */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTienda · funciones");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const ledgerRegistrar = G("ledgerRegistrar"), ledgerComprar = G("ledgerComprar"), funcion = G("funcion");
  const aplicarPlantilla = G("aplicarPlantilla"), pronosticoDia = G("pronosticoDia"), minutosFoco = G("minutosFoco"), nuevaTarea = G("nuevaTarea");
  const { tieneFuncion, avisoMediodia } = await import("../notifier/reglas.mjs");

  test("función: se compra una vez y queda (también tras fusionar)", () => {
    const s = migrate(defaultState()); ledgerRegistrar(s, "saldo-test", 1000, 0, "t");
    assert.equal(funcion("enfoque", s), false);
    assert.equal(ledgerComprar(s, "fun-enfoque", 600).ok, true);
    assert.equal(funcion("enfoque", s), true);
    assert.equal(ledgerComprar(s, "fun-enfoque", 600).ok, false);   // no se cobra dos veces
    const r = mergeStates(clone(s), clone(s));
    assert.equal(funcion("enfoque", r), true);
    assert.equal(r.gamif.puntos, 400);
  });

  test("plantilla: agrega hábitos y recurrentes sin duplicar", () => {
    const s = migrate(defaultState());
    s.habitos.defs = [{ id: "x", nombre: "Comer sano", icon: "🥗", frecuencia: { tipo: "diario" } }];
    const a = aplicarPlantilla(s, "salud", "2026-09-28");
    assert.equal(a.habitos, 3);   // "Comer sano" ya estaba
    assert.equal(a.tareas, 1);
    const b = aplicarPlantilla(s, "salud", "2026-09-28");
    assert.equal(b.habitos + b.tareas, 0);
    assert.equal(s.habitos.defs.find(h => h.nombre === "Entrenar").frecuencia.veces, 3);
  });

  test("pronóstico: día sobrecargado según capacidad", () => {
    const s = migrate(defaultState());
    for (let i = 0; i < 8; i++) nuevaTarea(s, "2026-10-01", { txt: "t" + i, ambito: "pro" });
    const p = pronosticoDia("2026-10-01", s, { hechasProm: 4 });
    assert.equal(p.tareas, 8); assert.equal(p.nivel, "sobrecargado");
    const q = pronosticoDia("2026-10-02", s, { hechasProm: 4 });
    assert.equal(q.nivel, "ok");
  });

  test("enfoque: sesiones se suman por semana y se fusionan por id", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.enfoque.sesiones.push({ id: "s1", fecha: "2026-09-28", ts: 1, min: 25, real: 25, completa: true });
    b.enfoque.sesiones.push({ id: "s2", fecha: "2026-09-29", ts: 2, min: 50, real: 30, completa: false });
    const r = mergeStates(clone(a), clone(b));
    assert.equal(r.enfoque.sesiones.length, 2);
    assert.equal(minutosFoco(r, "2026-09-28", "2026-10-04"), 55);
    const viejo = clone(a); delete viejo.enfoque;
    assert.equal(migrate(clone(viejo)).enfoque.sesiones.length, 0);
    assert.equal(mergeStates(clone(viejo), clone(a)).enfoque.sesiones.length, 1);
  });

  test("notificador: aviso de mediodía solo con la función, hora elegida y el día sin cerrar", () => {
    const data = { settings: { notif: { mediodia: "13:00" } }, gamif: { ledger: [{ id: "compra:fun-mediodia", delta: -300 }] }, ritual: { dias: { "2026-09-28": { hecho: true, sapo: "Propuesta" } } } };
    assert.equal(tieneFuncion(data.gamif, "mediodia"), true);
    assert.ok(avisoMediodia(data, "2026-09-28").body.includes("Propuesta"));
    assert.equal(avisoMediodia({ ...data, gamif: { ledger: [] } }, "2026-09-28"), null);
    assert.equal(avisoMediodia({ ...data, settings: { notif: { mediodia: null } } }, "2026-09-28"), null);
    const cerrado = clone(data); cerrado.ritual.dias["2026-09-28"].cerrado = true;
    assert.equal(avisoMediodia(cerrado, "2026-09-28"), null);
    const libre = clone(data); libre.gamif.usos = [{ id: "libre:2026-09-28" }];
    assert.equal(avisoMediodia(libre, "2026-09-28"), null);
  });
}
