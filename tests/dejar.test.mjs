/* Tests de los hábitos para dejar y reducir (habitos-motor.js y dejar.js): los días sin (el de hoy, al confirmarlo),
   una caída corta la racha pero no borra lo demás, «¿desde cuándo?», reducir con límite por día o por semana,
   los antojos (+1 ⭐, hasta 5 al día), lo que te ahorras, el jardín (cactus que cierra su flor), las medallas
   (Hábito de Hierro y Libre), sin descansos, sin avisos de pendientes y la fusión entre equipos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nDejar y reducir hábitos");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const racha = G("rachaPeriodos"), mejor = G("hmMejorRacha"), done = G("hmDone"), toca = G("tocaHoy"), prog = G("progresoPeriodoActual");
  const cumpl = G("cumplimiento"), dias = G("hmDiasCumplidos"), pendiente = G("hmPendienteHoy"), global = G("rachaGlobalHabitos");
  const caer = G("djCaidaPoner"), contar = G("djCuentaPoner"), ahorro = G("djAhorro"), patron = G("djPatron"), escena = G("jardinEscena");
  const conHoy = (iso, fn) => { G(`HM_HOY = ${JSON.stringify(iso)}`); try { return fn(); } finally { G("HM_HOY = null"); } };
  const usar = s => G("(s => { STATE = s; })")(s);
  const S0 = () => { const S = defaultState(); S.habitos.defs = []; S.habitos.log = {}; return S; };
  const dejar = (S, extra) => { const h = Object.assign({ id: "f", nombre: "Dejar de fumar", icon: "🚭", meta: "dejar", frecuencia: { tipo: "diario" }, creado: "2026-10-20" }, extra || {}); S.habitos.defs.push(h); return h; };
  const reducir = (S, per, n, extra) => { const h = Object.assign({ id: "c", nombre: "Café", icon: "☕", meta: "reducir", limite: { n, per }, frecuencia: per === "semana" ? { tipo: "semanal", veces: 1 } : { tipo: "diario" }, creado: "2026-10-26" }, extra || {}); S.habitos.defs.push(h); return h; };
  const confirmar = (S, hid, iso) => { const [y, m, d] = iso.split("-").map(Number), k = y + "-" + m; S.habitos.log[k] = S.habitos.log[k] || {}; (S.habitos.log[k][hid] = S.habitos.log[k][hid] || {})[d] = true; };

  test("un estado nuevo o viejo trae las listas de caídas, cuentas y antojos vacías", () => {
    const s = defaultState(); ["caidas", "cuentas", "antojos"].forEach(k => delete s.habitos[k]); migrate(s);
    assert.deepEqual(clone([s.habitos.caidas, s.habitos.cuentas, s.habitos.antojos]), [[], [], []]);
  });
  test("dejar: cada día sin caer cuenta solo; el de hoy, cuando lo confirmas; antes de «desde cuándo», nada", () => {
    const S = S0(), h = dejar(S);
    conHoy("2026-11-05", () => {
      assert.deepEqual([done(h, "2026-11-04", S), done(h, "2026-11-05", S), done(h, "2026-10-19", S)], [true, false, false]);
      assert.equal(racha(h, S).n, 16, "del 20 de octubre al 4 de noviembre");
      assert.equal(toca(h, S), true, "hoy está por confirmar");
      assert.equal(prog(h, S).texto, "por confirmar hoy");
      confirmar(S, "f", "2026-11-05");
      assert.equal(racha(h, S).n, 17); assert.equal(prog(h, S).texto, "confirmado hoy");
      assert.equal(pendiente(h, S), false, "los de dejar no entran en el aviso de hábitos pendientes");
    });
  });
  test("una caída corta la racha (la de hoy, al tiro) pero no borra el mes ni la mejor racha", () => {
    const S = S0(), h = dejar(S);
    caer(h, "2026-10-30", true, S);
    conHoy("2026-11-05", () => {
      assert.deepEqual([racha(h, S).n, mejor(h, S)], [5, 10], "del 31 al 4; la mejor, del 20 al 29");
      assert.equal(cumpl(h, "2026-10-20", "2026-11-04", S).hecho, 15, "16 días, uno con caída");
      caer(h, "2026-11-05", true, S);
      assert.deepEqual([racha(h, S).n, toca(h, S), prog(h, S).caida, prog(h, S).texto], [0, true, true, "caíste hoy"], "caer hoy: racha 0; sigue a la vista, con «caíste hoy»");
      assert.equal(mejor(h, S), 10, "la mejor racha sigue");
      caer(h, "2026-11-05", false, S);
      assert.equal(racha(h, S).n, 5, "deshacer la caída de hoy: vuelve a 5 (hoy, por confirmar)");
    });
  });
  test("reducir por día: verde mientras no pases el límite; el de hoy cuenta mañana, salvo que ya te pasaste", () => {
    const S = S0(), h = reducir(S, "dia", 2);
    [["2026-10-26", 2], ["2026-10-27", 3], ["2026-10-28", 1], ["2026-11-04", 2]].forEach(([d, n]) => contar(h, d, n, S));
    conHoy("2026-11-05", () => {
      assert.deepEqual([done(h, "2026-10-27", S), done(h, "2026-10-28", S), done(h, "2026-10-29", S)], [false, true, true], "el 27 se pasó; sin anotar, dentro del límite");
      assert.equal(racha(h, S).n, 8, "del 28 al 4");
      assert.equal(toca(h, S), false, "los de límite van aparte en Hoy");
      contar(h, "2026-11-05", 2, S); assert.equal(prog(h, S).texto, "2 de 2 hoy");
      contar(h, "2026-11-05", 3, S); assert.deepEqual([racha(h, S).n, prog(h, S).sePaso], [0, true], "pasarse hoy corta al tiro");
    });
  });
  test("reducir por semana: la semana que terminó dentro del límite cumple; la en curso, cuando termina", () => {
    const S = S0(), h = reducir(S, "semana", 1, { nombre: "Delivery" });
    contar(h, "2026-10-28", 1, S); contar(h, "2026-11-01", 1, S);   // la semana del 26 de octubre: 2 (se pasó)
    contar(h, "2026-11-03", 1, S);
    conHoy("2026-11-05", () => {
      assert.equal(racha(h, S).n, 0, "la semana pasada se pasó (2 de 1); la en curso aún no cuenta");
      assert.equal(prog(h, S).texto, "1 de 1 esta semana");
    });
    conHoy("2026-11-10", () => assert.equal(racha(h, S).n, 1, "la del 2 de noviembre terminó con 1: cumple"));
    assert.equal(dias(h, S).dias, 0, "sin semanas terminadas dentro del límite todavía (con HM_HOY nulo, hoy real)");
  });
  test("los días cumplidos (jardín, Hábito de Hierro): dejar cuenta los días sin; reducir, los que terminaron dentro", () => {
    const S = S0(), h = dejar(S, { creado: "2026-08-01" }), c = reducir(S, "dia", 2);
    caer(h, "2026-09-01", true, S); contar(c, "2026-10-30", 5, S);
    conHoy("2026-11-05", () => {
      assert.deepEqual([dias(h, S).dias, dias(h, S).ultimo], [95, "2026-11-04"], "del 1 de agosto al 4 de noviembre (96 días), menos una caída");
      assert.equal(dias(c, S).dias, 9, "del 26 de octubre al 4 de noviembre, menos el 30");
      usar(S);
      assert.equal(G("lg_habitoHierro")(S), true, "95 días sin: Hábito de Hierro");
      assert.equal(G("lg_libre")(S), false, "Libre pide 100 días seguidos (la racha va en 64)");
    });
  });
  test("el jardín: lo que dejas es un cactus en maceta, que cierra su flor el día que caíste", () => {
    const S = S0(), h = dejar(S); reducir(S, "dia", 2);
    conHoy("2026-11-05", () => {
      let e = escena(S, "2026-11-05");
      assert.deepEqual(clone(e.macetas.map(m => [m.id, m.dias, m.cactus, m.cerrada])), [["f", 16, true, false], ["c", 10, true, false]]);
      caer(h, "2026-11-05", true, S);
      e = escena(S, "2026-11-05");
      assert.equal(e.macetas[0].cerrada, true);
    });
  });
  test("sin descansos ni vacaciones: lo que dejas no se toma vacaciones", () => {
    const S = S0(), h = dejar(S);
    S.habitos.vacaciones = [{ id: "v", desde: "2026-11-01", hasta: "2026-11-10", habitos: null, ts: 1 }];
    S.habitos.descansos = [{ id: "d:f:2026-11-02", hid: "f", fecha: "2026-11-02", ts: 1 }];
    conHoy("2026-11-05", () => {
      assert.equal(G("hmDescanso")(h, "2026-11-02", S), false);
      assert.equal(racha(h, S).n, 16, "los días de vacaciones cuentan como días sin");
      usar(S); assert.match(G("dscPuede")(h, "2026-11-08", S).motivo, /no se toma vacaciones/);
    });
  });
  test("la racha de todos tus hábitos: un día sin caer cuenta como cumplido", () => {
    const S = S0(); dejar(S, { creado: "2026-11-01" });
    conHoy("2026-11-05", () => assert.equal(global(S), 4));
  });
  test("lo que te ahorras: días sin × lo que costaba; lo pasado a alcancías se descuenta", () => {
    const S = S0(), h = dejar(S, { costo: 3500 });
    conHoy("2026-11-05", () => {
      assert.deepEqual(clone(ahorro(h, S)), { total: 56000, pasado: 0, disponible: 56000 });
      h.ahorroPasado = 50000; assert.equal(ahorro(h, S).disponible, 6000);
      h.costo = 0; assert.equal(ahorro(h, S), null, "sin costo, no hay ahorro");
    });
  });
  test("tus antojos: el patrón de los últimos 30 días (con 3 o más)", () => {
    const S = S0(), h = dejar(S);
    S.habitos.antojos = [["2026-11-01", "14:10", "Después de comer"], ["2026-11-02", "14:40", "Después de comer"], ["2026-11-03", "22:00", "Estrés"]]
      .map(([fecha, hora, gatillo], i) => ({ id: "a" + i, hid: "f", fecha, hora, gatillo, ts: i }));
    conHoy("2026-11-05", () => assert.deepEqual(clone(patron(h, S)), { gatillo: "Después de comer", franja: "a mediodía" }));
  });
  test("dos equipos: caídas, cuentas y antojos se juntan por id (gana el más nuevo)", () => {
    const a = defaultState(), b = defaultState();
    a.habitos.caidas = [{ id: "c:f:2026-11-03", hid: "f", fecha: "2026-11-03", ts: 200, quitado: true }];
    b.habitos.caidas = [{ id: "c:f:2026-11-03", hid: "f", fecha: "2026-11-03", ts: 100 }];
    a.habitos.cuentas = [{ id: "n:c:2026-11-04", hid: "c", fecha: "2026-11-04", n: 1, ts: 1 }];
    b.habitos.cuentas = [{ id: "n:c:2026-11-04", hid: "c", fecha: "2026-11-04", n: 3, ts: 9 }];
    b.habitos.antojos = [{ id: "a1", hid: "f", fecha: "2026-11-04", ts: 1 }];
    const m = mergeStates(clone(b), clone(a));
    assert.deepEqual([m.habitos.caidas[0].quitado, m.habitos.cuentas[0].n, m.habitos.antojos.length], [true, 3, 1]);
  });
}
