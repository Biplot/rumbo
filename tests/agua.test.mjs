/* Tests del agua para todos (agua.js y aguaMerge en store.js): la fusión entre equipos, la meta,
   los vasos que siguen y los borrados, el resumen de los días viejos y el reloj de agua */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAgua para todos");
  const merge = G("aguaMerge"), mergeStates = G("mergeStates"), defaultState = G("defaultState"), migrate = G("migrate");
  const total = G("aguaTotal"), compactar = G("aguaCompactar"), metaAuto = G("aguaMetaAuto"), ritmo = G("aguaRitmoMin"), queda = G("aguaRelojQueda");
  const dia = (r, b = []) => ({ r: r.map(([id, ml, ts]) => ({ id, ml, ts })), b });

  test("un estado nuevo o viejo trae el agua vacía", () => {
    const s = defaultState(); delete s.agua; migrate(s);
    assert.deepEqual(clone(s.agua), { meta: 0, vaso: 250, inicio: true, ts: 0, dias: {} });
  });
  test("dos equipos: se juntan los vasos de cada día, lo borrado no vuelve y los ajustes son del más nuevo", () => {
    const tel = { meta: 2500, vaso: 300, inicio: true, ts: 20, dias: { "2026-10-31": dia([["a", 250, 1], ["b", 500, 2]], ["c"]) } };
    const pc = { meta: 0, vaso: 250, inicio: false, ts: 10, dias: { "2026-10-31": dia([["c", 250, 3], ["d", 250, 4]]), "2026-10-01": { ml: 1800 } } };
    const r = clone(merge(tel, pc)), d = r.dias["2026-10-31"];
    assert.deepEqual(d.r.map(x => x.id), ["a", "b", "c", "d"]);
    assert.deepEqual(d.b, ["c"]);
    assert.equal(total(d), 1000, "250 + 500 + 250 (el c se borró en el teléfono)");
    assert.deepEqual([r.meta, r.vaso, r.inicio, r.ts], [2500, 300, true, 20], "los ajustes del teléfono, que son más nuevos");
    assert.deepEqual(r.dias["2026-10-01"], { ml: 1800 }, "un día que está en un solo equipo se conserva");
    assert.deepEqual(clone(merge({ dias: { x: { ml: 900 } } }, { dias: { x: { ml: 1200 } } })).dias.x, { ml: 1200 }, "dos días resumidos: el total mayor");
    const s = mergeStates({ agua: pc, gamif: {} }, { agua: tel, gamif: {} });
    assert.equal(total(s.agua.dias["2026-10-31"]), 1000, "mergeStates usa la misma fusión");
  });
  test("la meta automática: 35 ml por kilo, de 50 en 50, entre 1,5 y 3,5 L; sin peso, 2 L", () => {
    const s = defaultState(), m = new Date().getMonth(), y = new Date().getFullYear();
    assert.equal(metaAuto(s), 2000);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 70; assert.equal(metaAuto(s), 2450);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 30; assert.equal(metaAuto(s), 1500);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 140; assert.equal(metaAuto(s), 3500);
  });
  test("pasados 14 días, un día queda solo con su total", () => {
    const s = defaultState();
    s.agua.dias = { "2026-10-01": dia([["a", 250, 1], ["b", 500, 2]], ["a"]), "2026-10-20": dia([["c", 250, 3]]) };
    compactar(s, "2026-10-31");
    assert.deepEqual(clone(s.agua.dias["2026-10-01"]), { ml: 500 });
    assert.equal(s.agua.dias["2026-10-20"].r.length, 1, "los últimos 14 días guardan cada vaso");
  });
  test("el reloj de agua: un vaso cada (14 h / vasos de la meta); se vacía desde el último vaso", () => {
    assert.equal(ritmo(2000, 250), 105, "8 vasos en 14 h: uno cada 1 h 45");
    const hoy = new Date(2026, 9, 31, 12, 0).getTime();
    assert.equal(queda({ meta: 2000, vaso: 250, ultimo: hoy }, hoy), 1, "recién tomado: lleno");
    assert.ok(Math.abs(queda({ meta: 2000, vaso: 250, ultimo: hoy - 52.5 * 60000 }, hoy) - 0.5) < 1e-9, "a la mitad del ritmo, a la mitad");
    assert.equal(queda({ meta: 2000, vaso: 250, ultimo: hoy - 200 * 60000 }, hoy), 0, "pasado el ritmo: vacío (toca un vaso)");
    assert.equal(queda({ meta: 2000, vaso: 250, ultimo: 0 }, new Date(2026, 9, 31, 7, 0).getTime()), 1, "antes de las 8 y sin vasos: lleno");
  });
}
