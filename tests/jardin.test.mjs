/* Tests del jardín de tus hábitos (jardin.js y jardinMerge en store.js): las macetas (hasta 3; si hay más, eliges),
   echar raíces a los 66 días (árbol, maceta libre, sin hojas si lo dejas), el cielo de la semana (constancia, no cantidad:
   la prueba de Ana y Bruno), el trasplante que se celebra una vez, el estilo de la Tienda y la fusión entre equipos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTu jardín");
  const defaultState = G("defaultState"), migrate = G("migrate"), merge = G("jardinMerge"), mergeStates = G("mergeStates");
  const escena = G("jardinEscena"), cielo = G("jardinCielo"), conteo = G("jardinConteo"), estilo = G("jardinEstilo"), guardar = G("jardinGuardarMacetas");
  const usar = s => G("(s => { STATE = s; })")(s);   // jardinAlMarcar y jardinEstilo leen STATE
  /* Un estado con hábitos diarios y n días marcados hacia atrás desde «hasta» */
  const marcar = (S, id, n, hasta) => { const d = new Date(hasta + "T12:00:00"); for (let i = 0; i < n; i++) { const k = d.getFullYear() + "-" + (d.getMonth() + 1); S.habitos.log[k] = S.habitos.log[k] || {}; S.habitos.log[k][id] = S.habitos.log[k][id] || {}; S.habitos.log[k][id][d.getDate()] = true; d.setDate(d.getDate() - 1); } };
  const hab = (S, id, nombre, extra) => { S.habitos.defs.push(Object.assign({ id, nombre, icon: "📚", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }, extra || {})); };
  const S0 = () => { const S = defaultState(); S.habitos.defs = []; S.habitos.log = {}; return S; };

  test("un estado nuevo o viejo trae el jardín vacío y visible en Inicio", () => {
    const s = defaultState(); delete s.jardin; migrate(s);
    assert.deepEqual(clone(s.jardin), { macetas: [], inicio: true, raices: {}, ts: 0 });
  });
  test("los días cumplidos cuentan todo el registro (como la medalla Hábito de Hierro) y la última marca", () => {
    const S = S0(); hab(S, "h1", "Leer"); marcar(S, "h1", 40, "2026-10-31");
    const c = conteo(S).h1; assert.deepEqual([c.dias, c.ultimo], [40, "2026-10-31"]);
  });
  test("con 3 o menos hábitos sin raíces, todos van en maceta; las plantas crecen con sus días", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "b", "Caminar"); marcar(S, "a", 33, "2026-11-03"); marcar(S, "b", 2, "2026-11-03");
    const e = escena(S, "2026-11-04");
    assert.deepEqual(clone(e.macetas.map(m => m.id)), ["a", "b"]);
    assert.ok(e.macetas[0].t > e.macetas[1].t, "la de 33 días está más crecida");
    assert.deepEqual([e.arboles.length, e.sinMaceta, e.elegir], [0, 0, false]);
  });
  test("a los 66 días echa raíces: pasa a árbol y libera su maceta", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "b", "Caminar"); marcar(S, "a", 66, "2026-11-03"); marcar(S, "b", 10, "2026-11-03");
    const e = escena(S, "2026-11-04");
    assert.deepEqual(clone(e.arboles.map(a => [a.id, a.hojas])), [["a", true]]);
    assert.deepEqual(clone(e.macetas.map(m => m.id)), ["b"]);
  });
  test("más de 3 sin raíces: se pide elegir (mientras, van las más avanzadas) y se respeta lo que elegiste", () => {
    const S = S0(); ["a", "b", "c", "d", "e"].forEach((id, i) => { hab(S, id, "H" + id); marcar(S, id, 5 + i * 10, "2026-11-03"); });
    let e = escena(S, "2026-11-04");
    assert.deepEqual([e.elegir, e.sinMaceta, e.macetas.map(m => m.id).join("")], [true, 2, "edc"], "sin elegir: las 3 más avanzadas y el aviso");
    guardar(["a", "b", "zzz", "c", "d"], S);
    e = escena(S, "2026-11-04");
    assert.deepEqual([e.elegir, e.macetas.map(m => m.id).join(""), clone(S.jardin.macetas)], [false, "abc", ["a", "b", "c"]], "solo hábitos válidos y a lo más 3");
  });
  test("si una de tus macetas echa raíces, su lugar se completa y se vuelve a preguntar", () => {
    const S = S0(); ["a", "b", "c", "d", "e"].forEach(id => { hab(S, id, "H" + id); marcar(S, id, 10, "2026-11-03"); });
    guardar(["a", "b", "c"], S); marcar(S, "a", 66, "2026-11-03");
    const e = escena(S, "2026-11-04");
    assert.equal(e.arboles.length, 1); assert.equal(e.macetas.length, 3); assert.equal(e.elegir, true);
    assert.ok(!e.macetas.some(m => m.id === "a"));
  });
  test("los hábitos en pausa no van en maceta; un árbol en pausa o sin marcar hace tiempo queda sin hojas (nunca se pierde)", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "b", "Correr", { pausado: true }); hab(S, "c", "Yoga"); hab(S, "d", "Agua", { pausado: true });
    marcar(S, "a", 70, "2026-09-01"); marcar(S, "c", 70, "2026-11-03"); marcar(S, "d", 3, "2026-11-01");
    const e = escena(S, "2026-11-04");
    assert.deepEqual(clone(e.arboles.map(a => [a.id, a.hojas])), [["a", false], ["c", true]], "Leer: 2 meses sin marcar → sin hojas");
    assert.deepEqual(clone(e.macetas.map(m => m.id)), [], "Correr y Agua están en pausa");
    S.habitos.defs[2].pausado = true;
    assert.equal(escena(S, "2026-11-04").arboles.find(a => a.id === "c").hojas, false, "en pausa: sin hojas");
  });
  test("el cielo es constancia, no cantidad: Ana (2 hábitos, 95 %) tiene más sol que Bruno (8 hábitos, 45 %)", () => {
    const hoy = "2026-11-06";   // viernes
    const ana = S0(); ["a", "b"].forEach(id => hab(ana, id, id));
    const bruno = S0(); ["a", "b", "c", "d", "e", "f", "g", "h"].forEach(id => hab(bruno, id, id));
    // Ana: cumple casi todo desde el lunes de la semana pasada; Bruno: menos de la mitad
    for (let d = new Date("2026-10-26T12:00:00"); d <= new Date(hoy + "T12:00:00"); d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10), k = d.getFullYear() + "-" + (d.getMonth() + 1), dia = d.getDate();
      ["a", "b"].forEach((id, i) => { if (!(iso === "2026-11-04" && i === 1)) { ana.habitos.log[k] = ana.habitos.log[k] || {}; (ana.habitos.log[k][id] = ana.habitos.log[k][id] || {})[dia] = true; } });
      ["a", "b", "c", "d", "e", "f", "g", "h"].forEach((id, i) => { if ((dia + i) % 9 < 4) { bruno.habitos.log[k] = bruno.habitos.log[k] || {}; (bruno.habitos.log[k][id] = bruno.habitos.log[k][id] || {})[dia] = true; } });
    }
    const ca = cielo(ana, hoy), cb = cielo(bruno, hoy);
    assert.ok(ca.c >= 0.8, "Ana: sol (" + ca.c.toFixed(2) + ")"); assert.ok(cb.c < 0.6, "Bruno: nublado (" + cb.c.toFixed(2) + ")");
    assert.ok(escena(ana, hoy).macetas.length <= 3 && escena(bruno, hoy).macetas.length === 3, "Bruno tampoco tiene más de 3 macetas");
  });
  test("el cielo: hoy sin marcar no castiga, los de X por semana cuentan lo que ya debían, y el lunes pesa la semana anterior", () => {
    const S = S0(); hab(S, "a", "Leer"); hab(S, "s", "Gimnasio", { frecuencia: { tipo: "semanal", veces: 3 } }); hab(S, "m", "Revisar", { frecuencia: { tipo: "mensual", veces: 1 } });
    marcar(S, "a", 3, "2026-11-04");   // lunes a miércoles
    const r = cielo(S, "2026-11-05");   // jueves, aún sin marcar hoy
    assert.deepEqual([r.hecho, r.esp], [3, 4], "3 de 3 en Leer (hoy no cuenta) y Gimnasio debía llevar 1 de 3 a esta altura");
    const lunes = S0(); hab(lunes, "a", "Leer"); marcar(lunes, "a", 7, "2026-11-01");   // toda la semana pasada
    assert.ok(cielo(lunes, "2026-11-02").c > 0.95, "el lunes temprano, la semana anterior perfecta mantiene el sol");
  });
  test("al marcar el día 66 se celebra el trasplante una sola vez; al marcar una maceta, el elefante riega", () => {
    const S = S0(); hab(S, "a", "Leer"); marcar(S, "a", 66, "2026-11-03");
    usar(S);
    const llamadas = [];
    G("globalThis").JARDIN_MOTOR = { regar: id => llamadas.push("regar:" + id), trasplantar: id => llamadas.push("trasplantar:" + id) };
    G("globalThis").setTimeout = () => 0;
    G("jardinAlMarcar")("a", true);
    assert.deepEqual(llamadas, ["trasplantar:a"]); assert.ok(S.jardin.raices.a, "queda anotado el día del trasplante");
    G("jardinAlMarcar")("a", true);
    assert.deepEqual(llamadas, ["trasplantar:a"], "no se celebra dos veces");
    hab(S, "b", "Caminar"); marcar(S, "b", 4, "2026-11-03");
    G("jardinAlMarcar")("b", true); G("jardinAlMarcar")("b", false);
    assert.deepEqual(llamadas, ["trasplantar:a", "regar:b"], "riega al marcar (no al desmarcar)");
  });
  test("el estilo: la entrada viene con Rumbo; los demás solo si los compraste", () => {
    const S = S0(); usar(S);
    assert.equal(estilo(S), "entrada");
    S.gamif.equipped = Object.assign(S.gamif.equipped || {}, { jardin: "sur" });
    assert.equal(estilo(S), "entrada", "equipado sin comprarlo: no");
    S.gamif.owned = (S.gamif.owned || []).concat("jar-sur");
    assert.equal(estilo(S), "sur");
  });
  test("los temas especiales (Marte y la base lunar) son anchos, especiales y solo se usan si los compraste", () => {
    const S = S0(); usar(S);
    S.gamif.equipped = Object.assign(S.gamif.equipped || {}, { jardin: "luna" });
    assert.equal(estilo(S), "entrada", "sin comprarla, la entrada");
    S.gamif.owned = (S.gamif.owned || []).concat("jar-luna");
    assert.equal(estilo(S), "luna");
    assert.deepEqual(clone(["marte", "luna"].map(id => { const e = G("jardinEstiloDe")(id); return [e.w, e.h, !!e.especial]; })), [[480, 260, true], [480, 260, true]]);
  });
  test("dos equipos: las macetas y el «en Inicio» del ajuste más nuevo; los trasplantes celebrados se juntan", () => {
    const l = { macetas: ["a", "b"], inicio: false, raices: { x: "2026-10-02" }, ts: 200 };
    const s = { macetas: ["c"], inicio: true, raices: { x: "2026-10-01", y: "2026-10-05" }, ts: 100 };
    assert.deepEqual(clone(merge(l, s)), { macetas: ["a", "b"], inicio: false, raices: { x: "2026-10-01", y: "2026-10-05" }, ts: 200 });
    const a = defaultState(), b = defaultState(); a.jardin = clone(l); b.jardin = clone(s);
    assert.deepEqual(clone(mergeStates(b, a).jardin.macetas), ["a", "b"], "mergeStates usa jardinMerge");
  });
}
