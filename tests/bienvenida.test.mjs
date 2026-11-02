/* Tests de la bienvenida (bienvenida.js): el día de la cuenta y los meses que no se piden cerrar */
export default async function ({ G, test, assert, clone }) {
  console.log("\nBienvenida");
  const defaultState = G("defaultState"), migrate = G("migrate");
  const marcarAlta = G("marcarAlta"), cuentaAlta = G("cuentaAlta"), antes = G("mesAntesDeLaCuenta");
  const pendientes = G("ritualMesPendientes");
  const usar = s => G("(s => { STATE = s; })")(s);
  const nuevo = () => { const S = migrate(defaultState()); S.settings.onboarded = false; return S; };

  test("el día de la cuenta: solo en cuentas nuevas, una vez, y no se inventa en las que ya existían", () => {
    const S = nuevo();
    assert.equal(cuentaAlta(S), null, "defaultState no trae alta (si no, quienes ya usaban la app la heredarían al migrar)");
    assert.equal(marcarAlta(S), true);
    assert.match(cuentaAlta(S), /^\d{4}-\d{2}-\d{2}$/);
    const a = cuentaAlta(S);
    assert.equal(marcarAlta(S), false, "una segunda vez no la cambia"); assert.equal(cuentaAlta(S), a);
    const viejo = migrate(defaultState()); viejo.settings.onboarded = true;
    assert.equal(marcarAlta(viejo), false, "quien ya pasó la bienvenida no recibe alta");
    assert.equal(cuentaAlta(migrate(viejo)), null, "migrar no la crea");
  });

  test("si ya había anotado días antes de terminar la bienvenida, la cuenta parte en el primero", () => {
    const S = nuevo();
    S.ritual.dias["2020-03-04"] = { hecho: true, ts: 1 };
    marcarAlta(S);
    assert.equal(cuentaAlta(S), "2020-03-04");
  });

  test("un mes que terminó antes de la cuenta no se pide cerrar; el de la cuenta, sí", () => {
    const S = nuevo(); S.settings.alta = "2026-11-02"; usar(S);
    assert.equal(antes(2026, 9, S), true, "octubre terminó antes del 2 de noviembre");
    assert.equal(antes(2026, 10, S), false, "noviembre es el mes de la cuenta");
    assert.equal(antes(2025, 11, S), true);
    const tipos = clone(pendientes(new Date(2026, 10, 2, 9)).map(p => p.tipo + ":" + p.key));
    assert.deepEqual(tipos, ["apertura:2026-11"], "el 2 de noviembre: abrir noviembre, sin cerrar octubre");
    const dic = clone(pendientes(new Date(2026, 11, 2, 9)).map(p => p.tipo + ":" + p.key));
    assert.deepEqual(dic, ["cierre:2026-11", "apertura:2026-12"], "en diciembre sí se pide cerrar noviembre");
    delete S.settings.alta;
    assert.deepEqual(clone(pendientes(new Date(2026, 10, 2, 9)).map(p => p.tipo)), ["cierre", "apertura"], "sin alta (quien ya usaba la app), como siempre");
  });

  test("los 8 hábitos de fábrica se van al terminar la bienvenida, salvo los que ya marcó o los que creó"
    , () => {
    const S = nuevo(), quitar = G("quitarHabitosDeFabrica");
    assert.equal(S.habitos.defs.length, 8, "defaultState sigue trayendo los 8 (las pruebas y quien no pasó la bienvenida)");
    const lectura = S.habitos.defs.find(h => h.nombre === "Lectura");
    S.habitos.log["2026-11"] = { [lectura.id]: { 2: true } };
    S.habitos.defs.push({ id: "mio", nombre: "Agua", icon: "💧", frecuencia: { tipo: "diario" }, creado: "2026-11-02", ts: 5 });
    assert.equal(quitar(S), 7, "se van 7: Lectura ya tiene una marca");
    assert.deepEqual(clone(S.habitos.defs.map(h => h.nombre)), ["Lectura", "Agua"], "queda Lectura y el «Agua» que creó (con ts)");
    const viejo = migrate(defaultState()); viejo.settings.onboarded = true;
    assert.equal(quitar(viejo), 0, "a quien ya pasó la bienvenida no se le toca nada");
  });

  test("«Arma tu Rumbo»: hábitos elegidos (hasta 3), rutina de regalo, elefante con nombre y apertura corta", () => {
    const S = nuevo(), aplicar = G("armaAplicar"), funcion = G("funcion");
    aplicar(S, { areas: ["dia", "habitos", "plata"], habitos: ["leer", "caminar", "fumar", "dormir"], plantilla: "finanzas", tipo: "asiatico", nombre: "  Tito ", verTodo: false }, "2026-11-02");
    const nombres = S.habitos.defs.map(h => h.nombre);
    assert.deepEqual(clone(nombres.slice(0, 3)), ["Leer 10 minutos", "Caminar 20 minutos", "Dejar de fumar"], "las 3 primeras sugerencias, sin los de fábrica");
    assert.equal(nombres.includes("Dormir antes de las 12"), false, "la cuarta no entra: con 3 basta para partir");
    const fumar = S.habitos.defs.find(h => h.nombre === "Dejar de fumar");
    assert.deepEqual([fumar.meta, fumar.creado], ["dejar", "2026-11-02"], "«Dejar de fumar» es un hábito para dejar, desde hoy");
    assert.deepEqual(clone(S.habitos.defs.find(h => h.nombre === "Leer 10 minutos").frecuencia), { tipo: "semanal", veces: 3 });
    assert.equal(funcion("plantilla-finanzas", S), true, "la rutina armada queda como suya (de regalo)");
    assert.equal(S.gamif.puntos, 0, "sin gastar ⭐");
    assert.ok(nombres.includes("Anotar mis gastos"), "y sus hábitos se suman");
    assert.deepEqual([S.gamif.equipped.ele.tipo, S.gamif.equipped.ele.nombre], ["asiatico", "Tito"], "el elefante y su nombre (sin espacios)");
    assert.deepEqual(clone(S.settings.bienvenida.areas), ["dia", "habitos", "plata"]);
    assert.equal(S.settings.aperturaSimple, true, "la primera semana abre el día en versión corta");
    assert.equal(S.profile.motto, "", "sin el lema de fábrica");
  });

  test("la primera semana: del día de la cuenta al séptimo; las cuentas de antes no la tienen", () => {
    const S = nuevo(); S.settings.alta = "2026-11-02";
    const dia = G("primeraSemanaDia"), activa = G("primeraSemanaActiva");
    assert.deepEqual([dia(S, "2026-11-02"), dia(S, "2026-11-08"), dia(S, "2026-11-09")], [1, 7, 8]);
    assert.deepEqual([activa(S, "2026-11-02"), activa(S, "2026-11-08"), activa(S, "2026-11-09")], [true, true, false]);
    delete S.settings.alta;
    assert.equal(activa(S, "2026-11-02"), false);
  });
}
