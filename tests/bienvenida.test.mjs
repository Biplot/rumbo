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

  test("«Tu primera semana»: un paso por día, en orden; si se salta un día, la misión espera", () => {
    const S = nuevo(), aplicar = G("armaAplicar"), pasos = G("psPasos");
    aplicar(S, { areas: ["dia", "habitos"], habitos: ["leer"], tipo: "clasico", nombre: "" }, "2026-11-02"); S.settings.alta = "2026-11-02"; S.settings.onboarded = true;
    const est = hoy => clone(pasos(S, hoy).map(p => p.id + ":" + p.estado));
    assert.deepEqual(est("2026-11-02").slice(0, 3), ["abrir:ahora", "cerrar:luego", "habito:luego"], "el día 1: abrir tu día");
    S.ritual.dias["2026-11-02"] = { hecho: true, ts: 1 };
    assert.deepEqual(est("2026-11-02").slice(0, 3), ["abrir:ok", "cerrar:ahora", "habito:luego"], "abierto: toca cerrarlo");
    S.ritual.dias["2026-11-02"].cerrado = true;
    assert.deepEqual(est("2026-11-02").slice(2, 3), ["habito:luego"], "el hábito es del día 2: hoy todavía no");
    assert.deepEqual(est("2026-11-06").slice(2, 4), ["habito:ahora", "semana:luego"], "se saltó días: la misión espera en el hábito");
    const h = S.habitos.defs[0]; S.habitos.log["2026-11"] = { [h.id]: { 6: true } };
    assert.deepEqual(est("2026-11-06").slice(3, 4), ["semana:ahora"], "marcado: sigue la semana (ya es su día)");
  });

  test("las secciones despiertan: lo que eligió y lo de cada paso que llega; «Ver todo» o terminar las despiertan todas", () => {
    const S = nuevo(), aplicar = G("armaAplicar"), dormida = G("seccionDormida");
    aplicar(S, { areas: ["dia", "habitos", "plata"], habitos: [], tipo: "clasico", nombre: "" }, "2026-11-02"); S.settings.alta = "2026-11-02"; S.settings.onboarded = true;
    usar(S);
    const v = ids => ids.map(id => dormida(id, S));
    assert.deepEqual(v(["finanzas", "calendario", "tendencias", "listas"]), [false, true, true, true], "despierta Finanzas (eligió su plata); el resto de Más duerme");
    const hoy = G("todayISO")(), sumar = G("agSumar"), [y, m, d] = hoy.split("-").map(Number);
    S.ritual.dias[hoy] = { hecho: true, cerrado: true, ts: 1 }; S.settings.alta = hoy;
    S.habitos.log[y + "-" + m] = { x: { [d]: true } };
    assert.equal(dormida("calendario", S), true, "el día 1, calendario espera el paso de la semana (día 3)");
    S.settings.alta = sumar(hoy, -2);
    assert.equal(dormida("calendario", S), false, "el día 3 llega la semana y despierta calendario");
    S.settings.bienvenida.verTodo = true;
    assert.deepEqual(v(["calendario", "tendencias", "listas"]), [false, false, false], "«Ver todo»: todas");
    delete S.settings.bienvenida.verTodo; S.settings.bienvenida.fin = "oculta";
    assert.equal(dormida("listas", S), false, "ocultar la misión las despierta todas");
    const viejo = migrate(defaultState()); viejo.settings.onboarded = true;
    assert.equal(dormida("listas", viejo), false, "a quien ya usaba la app no se le duerme nada");
  });

  test("completar la semana da la insignia Explorador (en vez de «Primeros pasos»)", () => {
    const S = nuevo(), aplicar = G("armaAplicar"), completa = G("primeraSemanaCompleta");
    aplicar(S, { areas: [], habitos: ["leer"], tipo: "clasico", nombre: "" }, "2026-11-02"); S.settings.alta = "2026-11-02"; S.settings.onboarded = true;
    S.ritual.dias["2026-11-02"] = { hecho: true, cerrado: true, ts: 1 };
    S.habitos.log["2026-11"] = { [S.habitos.defs[0].id]: { 3: true } };
    S.ritual.semanas = { "2026-11-02": { apertura: { foco: "Partir", ts: 1 } } };
    S.metas.mensuales[10].push({ id: "o1", texto: "Leer 2 libros", ts: 1 });
    S.finanzas.gastos.push({ id: "g", nombre: "Arriendo", monto: 1, ts: 1 });
    S.settings.bienvenida.verTodo = true;
    assert.equal(completa(S), false, "falta su resumen del día 7");
    S.settings.bienvenida.resumen = 1;
    assert.equal(completa(S), true);
    const exp = G("BADGES").find(b => b.id === "explorador");
    assert.equal(exp.check(S), true, "Explorador se gana con la primera semana");
  });

  test("Finanzas: el seguimiento parte el mes de la cuenta; Tendencias enseña hasta los 7 días cerrados", () => {
    const S = nuevo(); S.settings.alta = "2026-11-02";
    assert.equal(G("finDesdeMes")(2026, S), 10, "desde noviembre");
    assert.equal(G("finDesdeMes")(2027, S), 0, "el año siguiente, todo el año");
    assert.equal(G("tendAprendiendo")(S), true);
    for (let d = 1; d <= 7; d++) S.ritual.dias[`2026-11-0${d}`] = { hecho: true, cerrado: true, ts: d };
    assert.equal(G("tendAprendiendo")(S), false, "con 7 días cerrados, los gráficos");
  });
}
