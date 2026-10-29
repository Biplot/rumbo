/* Tests de las funciones de la Tienda (funciones.js): compra única, plantillas, pronóstico, enfoque y notificador */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTienda · funciones");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const ledgerRegistrar = G("ledgerRegistrar"), ledgerComprar = G("ledgerComprar"), funcion = G("funcion");
  const aplicarPlantilla = G("aplicarPlantilla"), pronosticoDia = G("pronosticoDia"), minutosFoco = G("minutosFoco"), nuevaTarea = G("nuevaTarea");
  const { avisoMediodia } = await import("../notifier/reglas.mjs");

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

  test("notificador: el aviso de mediodía es gratis: con su hora o encendido, y solo con el día sin cerrar", () => {
    const data = { settings: { notif: { mediodia: "13:00" } }, gamif: { ledger: [] }, ritual: { dias: { "2026-09-28": { hecho: true, sapo: "Propuesta" } } } };
    assert.ok(avisoMediodia(data, "2026-09-28").body.includes("Propuesta"));                         // sin compra
    assert.equal(avisoMediodia({ ...data, settings: { notif: { mediodia: "13:00", avisos: { mediodia: false } } } }, "2026-09-28"), null);
    assert.equal(avisoMediodia({ ...data, settings: { notif: {} } }, "2026-09-28"), null);          // ni hora ni encendido
    assert.ok(avisoMediodia({ ...data, settings: { notif: { avisos: { mediodia: true } } } }, "2026-09-28"));   // encendido: hora sugerida
    const cerrado = clone(data); cerrado.ritual.dias["2026-09-28"].cerrado = true;
    assert.equal(avisoMediodia(cerrado, "2026-09-28"), null);
  });

  test("Tienda: el aviso de mediodía ya no se vende y quien lo compró recupera sus ⭐ (una sola vez)", () => {
    assert.equal(G("FUNCIONES").some(f => f.id === "mediodia"), false);
    const s = migrate(defaultState()); ledgerRegistrar(s, "saldo-test", 1000, 0, "t");
    assert.equal(ledgerComprar(s, "fun-mediodia", 300).ok, true);
    assert.equal(s.gamif.puntos, 700);
    migrate(s);
    assert.equal(s.gamif.puntos, 1000);
    assert.ok(s.gamif.ledger.find(m => m.id === "compra:fun-mediodia").motivo.includes("devuelta"));
    migrate(s);
    assert.equal(s.gamif.puntos, 1000);
    const otro = clone(s); assert.equal(mergeStates(otro, s).gamif.puntos, 1000);   // la fusión no la vuelve a cobrar
  });

  test("Tienda: Grafito y Medianoche se retiran: vuelven las ⭐, dejan de ser tuyos y quien los usaba pasa a su gemelo gratis", () => {
    const s = migrate(defaultState()); ledgerRegistrar(s, "saldo-test", 1000, 0, "t");
    assert.equal(ledgerComprar(s, "tema-grafito", 400).ok, true);
    assert.equal(ledgerComprar(s, "tema-medianoche", 500).ok, true);
    assert.equal(ledgerComprar(s, "tema-oceano", 100).ok, true);   // uno que sigue a la venta no se toca
    assert.equal(s.gamif.puntos, 0);
    s.settings.theme = "medianoche"; s.settings.temaElegido = "medianoche";
    migrate(s);
    assert.equal(s.gamif.puntos, 900);
    assert.equal(s.gamif.owned.includes("tema-grafito") || s.gamif.owned.includes("tema-medianoche"), false);
    assert.ok(s.gamif.owned.includes("tema-oceano"));
    assert.equal(s.settings.theme, "norte-noche");
    assert.ok(s.gamif.ledger.find(m => m.id === "compra:tema-grafito").motivo.includes("devuelta"));
    const g = clone(s); g.settings.theme = "grafito"; assert.equal(migrate(g).settings.theme, "ruta-noche");
    migrate(s);
    assert.equal(s.gamif.puntos, 900);   // una sola vez
    const otro = clone(s); assert.equal(mergeStates(otro, s).gamif.puntos, 900);
  });
}
