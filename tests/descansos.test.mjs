/* Tests de los días de descanso y las vacaciones (habitos-motor.js y descansos.js): el descanso no corta la racha ni
   suma (si igual lo haces, cuenta), se decide desde el día anterior y tiene tope (2 por mes en cada hábito), las
   vacaciones (hasta 21 días, desde mañana) y la cuota en proporción de los de X por semana, Semana Perfecta, el
   jardín (66 días, cielo, sin hojas, hamaquita y letrero), la racha de a dos (solo si descansan todos) y la
   fusión entre equipos (gana el cambio más nuevo, también al quitar) */
export default async function ({ G, test, assert, clone }) {
  console.log("\nDías de descanso y vacaciones");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const racha = G("rachaPeriodos"), global = G("rachaGlobalHabitos"), toca = G("tocaHoy"), prog = G("progresoPeriodoActual"), cumpl = G("cumplimiento");
  const meta = G("hmMetaPeriodo"), perfecta = G("semanaPerfecta"), conjunto = G("hmRachaConjunto");
  const puede = G("dscPuede"), poner = G("dscPoner"), vacError = G("vacError"), vacCrear = G("vacCrear"), vacTerminar = G("vacTerminar");
  const escena = G("jardinEscena"), cielo = G("jardinCielo");
  const conHoy = (iso, fn) => { G(`HM_HOY = ${JSON.stringify(iso)}`); try { return fn(); } finally { G("HM_HOY = null"); } };
  const usar = s => G("(s => { STATE = s; })")(s);
  const marcar = (S, id, desde, hasta, salvo) => { for (let d = new Date(desde + "T12:00:00"); d <= new Date(hasta + "T12:00:00"); d.setDate(d.getDate() + 1)) {
    const iso = G("isoLocal")(d); if ((salvo || []).includes(iso)) continue;
    const k = d.getFullYear() + "-" + (d.getMonth() + 1); S.habitos.log[k] = S.habitos.log[k] || {}; (S.habitos.log[k][id] = S.habitos.log[k][id] || {})[d.getDate()] = true; } };
  const hab = (S, id, nombre, extra) => { const h = Object.assign({ id, nombre, icon: "📚", frecuencia: { tipo: "diario" }, creado: "2026-09-01" }, extra || {}); S.habitos.defs.push(h); return h; };
  const S0 = () => { const S = defaultState(); S.habitos.defs = []; S.habitos.log = {}; return S; };
  const desc = (S, hid, fecha) => { S.habitos.descansos = (S.habitos.descansos || []).concat([{ id: "d:" + hid + ":" + fecha, hid, fecha, ts: 1 }]); };

  test("un estado nuevo o viejo trae las listas de descansos y vacaciones vacías", () => {
    const s = defaultState(); delete s.habitos.descansos; delete s.habitos.vacaciones; migrate(s);
    assert.deepEqual(clone([s.habitos.descansos, s.habitos.vacaciones]), [[], []]);
  });
  test("un día de descanso no corta la racha ni suma; si igual lo hiciste, cuenta como siempre", () => {
    const S = S0(), h = hab(S, "e", "Entrenar");
    marcar(S, "e", "2026-10-20", "2026-11-04", ["2026-11-01"]);   // 16 días, sin el domingo 1
    conHoy("2026-11-05", () => assert.equal(racha(h, S).n, 3, "sin descanso, el domingo sin hacer corta"));
    desc(S, "e", "2026-11-01");
    conHoy("2026-11-05", () => {
      assert.equal(racha(h, S).n, 15, "con el domingo de descanso: 12 + 3, el domingo no suma");
      assert.equal(global(S), 15, "la racha de todos tus hábitos también lo salta");
      assert.equal(cumpl(h, "2026-11-01", "2026-11-04", S).esperado, 3, "ese día no se espera");
    });
    marcar(S, "e", "2026-11-01", "2026-11-01");
    conHoy("2026-11-05", () => assert.equal(racha(h, S).n, 16, "hecho en su día de descanso: suma"));
  });
  test("hoy de descanso: no toca, dice «descansa hoy» y no se espera; de vacaciones dice «de vacaciones»", () => {
    const S = S0(), h = hab(S, "e", "Entrenar"); desc(S, "e", "2026-11-05");
    conHoy("2026-11-05", () => {
      assert.equal(toca(h, S), false);
      assert.deepEqual([prog(h, S).texto, prog(h, S).descanso], ["descansa hoy", true]);
    });
    S.habitos.vacaciones = [{ id: "v1", desde: "2026-11-05", hasta: "2026-11-08", habitos: null, ts: 1 }];
    const s2 = hab(S, "s", "Gimnasio", { frecuencia: { tipo: "semanal", veces: 3 } });
    conHoy("2026-11-06", () => { assert.equal(prog(h, S).texto, "de vacaciones"); assert.equal(toca(s2, S), false, "los de X por semana tampoco tocan en vacaciones"); });
  });
  test("se decide desde el día anterior, en días que tocan, hasta 2 por mes por hábito, y se puede quitar antes de que llegue", () => {
    const S = S0(), h = hab(S, "e", "Entrenar"), lmv = hab(S, "g", "Gimnasio", { frecuencia: { tipo: "dias", dias: [0, 2, 4] } }), sem = hab(S, "s", "Correr", { frecuencia: { tipo: "semanal", veces: 3 } });
    conHoy("2026-11-05", () => {
      assert.equal(puede(h, "2026-11-05", S).ok, false, "hoy no");
      assert.equal(puede(h, "2026-11-04", S).ok, false, "ayer no");
      assert.equal(puede(h, "2026-11-06", S).ok, true, "mañana sí");
      assert.equal(puede(lmv, "2026-11-07", S).ok, false, "un sábado que no le toca a uno de lunes, miércoles y viernes");
      assert.match(puede(sem, "2026-11-07", S).motivo, /no necesitan descanso de un día/);
      poner(h, "2026-11-06", true, S); poner(h, "2026-11-08", true, S);
      assert.match(puede(h, "2026-11-10", S).motivo, /Ya usaste los 2 descansos de noviembre/);
      assert.equal(puede(h, "2026-12-01", S).ok, true, "en diciembre parte de nuevo");
      assert.deepEqual(clone(puede(h, "2026-11-06", S)), { ok: true, quitar: true }, "uno que viene se puede quitar");
      poner(h, "2026-11-06", false, S);
      assert.equal(puede(h, "2026-11-10", S).ok, true, "al quitar uno, se libera el cupo");
      assert.equal(S.habitos.descansos.find(x => x.id === "d:e:2026-11-06").quitado, true, "quitar deja la marca (para la fusión)");
    });
    conHoy("2026-11-08", () => assert.match(puede(h, "2026-11-08", S).motivo, /ya llegó/, "el día de descanso que llegó ya no se quita"));
  });
  test("vacaciones: desde mañana, hasta 21 días, sin cruzarse; «Volví antes» las corta y cancelar las quita", () => {
    const S = S0(); hab(S, "e", "Entrenar");
    conHoy("2026-11-05", () => {
      assert.match(vacError("2026-11-05", "2026-11-10", null, S), /desde mañana/);
      assert.match(vacError("2026-11-06", "2026-11-27", null, S), /Hasta 21 días/);
      assert.equal(vacError("2026-11-06", "2026-11-26", null, S), null, "21 días justos");
      assert.match(vacError("2026-11-06", "2026-11-08", [], S), /al menos un hábito/);
      const v = vacCrear("2026-11-20", "2026-11-28", null, S);
      assert.match(vacError("2026-11-25", "2026-11-30", null, S), /Ya tienes vacaciones/);
      assert.equal(vacTerminar(v.id, S).quitado, true, "si no parten, se cancelan");
    });
    const v2 = conHoy("2026-11-05", () => vacCrear("2026-11-06", "2026-11-15", null, S));
    conHoy("2026-11-10", () => { const r = vacTerminar(v2.id, S); assert.deepEqual([r.desde, r.hasta, !!r.quitado], ["2026-11-06", "2026-11-09", false], "volver antes: terminan ayer"); });
  });
  test("en vacaciones los de X por semana piden en proporción (fuera 3 de 7: 3 por semana pide 2); toda la semana fuera no se pide", () => {
    const S = S0(), s = hab(S, "s", "Correr", { frecuencia: { tipo: "semanal", veces: 3 } }), m = hab(S, "m", "Revisar", { frecuencia: { tipo: "mensual", veces: 4 } });
    S.habitos.vacaciones = [{ id: "v1", desde: "2026-11-13", hasta: "2026-11-15", habitos: null, ts: 1 }];
    assert.equal(meta(s, "2026-11-09", S).esperado, 2);
    assert.equal(meta(m, "2026-11-09", S).esperado, 4, "el mes con 3 días fuera aún pide 4 (4 × 27/30 = 3,6 → 4)");
    S.habitos.vacaciones = [{ id: "v2", desde: "2026-11-09", hasta: "2026-11-15", habitos: null, ts: 1 }];
    assert.equal(meta(s, "2026-11-09", S).esperado, 0);
    marcar(S, "s", "2026-11-02", "2026-11-04"); marcar(S, "s", "2026-11-16", "2026-11-18");
    conHoy("2026-11-19", () => assert.equal(racha(s, S).n, 2, "la semana de vacaciones no corta la racha de semanas (ni suma)"));
    S.habitos.vacaciones = [{ id: "v3", desde: "2026-11-09", hasta: "2026-11-15", habitos: ["otro"], ts: 1 }];
    assert.equal(meta(s, "2026-11-09", S).esperado, 3, "vacaciones de otros hábitos no cuentan");
  });
  test("Semana Perfecta: un hábito que esa semana no pedía nada (todo vacaciones) no la impide", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "b", "Correr", { frecuencia: { tipo: "semanal", veces: 2 } });
    marcar(S, "a", "2026-11-09", "2026-11-15");
    S.habitos.vacaciones = [{ id: "v1", desde: "2026-11-09", hasta: "2026-11-15", habitos: ["b"], ts: 1 }];
    assert.equal(perfecta(S, "2026-11-09"), true);
    S.habitos.vacaciones = []; assert.equal(perfecta(S, "2026-11-09"), false, "sin vacaciones, Correr faltó");
  });
  test("el jardín: el descanso no suma a los 66, el cielo no lo espera, no deja sin hojas; hamaquita y letrero", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "b", "Caminar");
    marcar(S, "a", "2026-11-02", "2026-11-04"); marcar(S, "b", "2026-11-02", "2026-11-03");
    const sin = cielo(S, "2026-11-05");
    desc(S, "b", "2026-11-04");
    const con = cielo(S, "2026-11-05");
    assert.deepEqual([sin.esp, sin.hecho, con.esp, con.hecho], [6, 5, 5, 5], "el miércoles de descanso no se espera");
    desc(S, "a", "2026-11-05");
    let e = escena(S, "2026-11-05");
    assert.deepEqual(clone(e.macetas.map(m => [m.id, m.dias, m.descansa])), [["a", 3, true], ["b", 2, false]], "hamaquita para Leer, que hoy descansa; los días no suben");
    assert.equal(e.vuelve, null);
    S.habitos.vacaciones = [{ id: "v1", desde: "2026-11-05", hasta: "2026-11-28", habitos: null, ts: 1 }];
    assert.equal(escena(S, "2026-11-10").vuelve, "2026-11-29", "el letrero: vuelvo el 29");
    // Un árbol con raíces: 21 días de vacaciones (más 3 sin marcar) no lo dejan sin hojas
    const T = S0(); hab(T, "r", "Meditar"); marcar(T, "r", "2026-08-01", "2026-10-10");
    T.habitos.vacaciones = [{ id: "v", desde: "2026-10-11", hasta: "2026-10-31", habitos: null, ts: 1 }];
    assert.equal(escena(T, "2026-11-03").arboles[0].hojas, true, "volvió de vacaciones: el árbol sigue con hojas");
    assert.equal(escena(T, "2026-11-01").arboles[0].hojas, true, "22 días sin marcar (21 de vacaciones): sigue con hojas");
    assert.equal(escena(T, "2026-11-23").arboles[0].hojas, false, "pero si no vuelve a marcar (22 días fuera de las vacaciones), como siempre");
  });
  test("la racha de a dos respeta el descanso solo si descansan todos", () => {
    const def = { frecuencia: { tipo: "diario" }, creado: "2026-11-01" };
    const dias = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"];
    const ana = { desde: "2026-11-01", marcas: dias.filter(d => d !== "2026-11-03") }, bruno = { desde: "2026-11-01", marcas: dias.filter(d => d !== "2026-11-03") };
    conHoy("2026-11-05", () => {
      assert.equal(conjunto(def, [ana, bruno]).n, 1, "sin descansos: el martes corta");
      assert.equal(conjunto(def, [Object.assign({}, ana, { descansos: ["2026-11-03"] }), bruno]).n, 1, "si descansa solo uno, corta igual");
      assert.equal(conjunto(def, [Object.assign({}, ana, { descansos: ["2026-11-03"] }), Object.assign({}, bruno, { descansos: ["2026-11-03"] })]).n, 3, "si descansan los dos: no corta ni suma");
    });
  });
  test("dos equipos: descansos y vacaciones se juntan por id y gana el cambio más nuevo (también al quitar)", () => {
    const a = defaultState(), b = defaultState();
    a.habitos.descansos = [{ id: "d:e:2026-11-06", hid: "e", fecha: "2026-11-06", ts: 200, quitado: true }];
    b.habitos.descansos = [{ id: "d:e:2026-11-06", hid: "e", fecha: "2026-11-06", ts: 100 }, { id: "d:e:2026-11-08", hid: "e", fecha: "2026-11-08", ts: 100 }];
    a.habitos.vacaciones = [{ id: "v1", desde: "2026-12-20", hasta: "2026-12-28", habitos: null, ts: 5 }];
    const m = mergeStates(clone(b), clone(a));
    assert.deepEqual(clone(m.habitos.descansos.map(x => [x.id, !!x.quitado]).sort()), [["d:e:2026-11-06", true], ["d:e:2026-11-08", false]]);
    assert.equal(m.habitos.vacaciones.length, 1);
    usar(m);
    assert.equal(G("hmDescansoDia")({ id: "e" }, "2026-11-06", m), false, "el que se quitó en el otro equipo ya no es descanso");
  });
}
