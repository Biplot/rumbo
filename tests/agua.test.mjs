/* Tests del agua para todos (agua.js y aguaMerge en store.js): la fusión entre equipos, la meta,
   los vasos que siguen y los borrados, el resumen de los días viejos y el reloj de agua */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAgua para todos");
  const merge = G("aguaMerge"), mergeStates = G("mergeStates"), defaultState = G("defaultState"), migrate = G("migrate");
  const total = G("aguaTotal"), compactar = G("aguaCompactar"), metaAuto = G("aguaMetaAuto"), ritmo = G("aguaRitmoMin"), queda = G("aguaRelojQueda");
  const dia = (r, b = []) => ({ r: r.map(([id, ml, ts]) => ({ id, ml, ts })), b });

  test("un estado nuevo o viejo trae el agua vacía", () => {
    const s = defaultState(); delete s.agua; migrate(s);
    assert.deepEqual(clone(s.agua), { meta: 0, vaso: 250, inicio: true, fab: true, clima: null, ts: 0, dias: {} });
    const viejo = defaultState(); viejo.agua = { meta: 2000, vaso: 300, inicio: true, ts: 5, dias: {} }; migrate(viejo);
    assert.deepEqual([viejo.agua.fab, viejo.agua.clima, viejo.agua.meta], [true, null, 2000], "el agua de la v111 suma el botón y el clima sin perder lo suyo");
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
  test("dos equipos: la temperatura del día se conserva y el botón y la ciudad son del ajuste más nuevo", () => {
    const tel = { meta: 0, vaso: 250, inicio: true, fab: false, clima: { on: true, ciudad: "Santiago, Chile", lat: -33.45, lon: -70.65 }, ts: 30, dias: { "2026-10-31": Object.assign(dia([["a", 250, 1]]), { c: 31 }) } };
    const pc = { meta: 0, vaso: 250, inicio: true, ts: 10, dias: { "2026-10-31": dia([["b", 250, 2]]) } };
    const r = clone(merge(pc, tel));
    assert.equal(r.dias["2026-10-31"].c, 31, "la temperatura que pidió el teléfono");
    assert.deepEqual([r.fab, r.clima.on, r.clima.ciudad, r.clima.lat], [false, true, "Santiago, Chile", -33.45]);
    const r2 = clone(merge({ ts: 50, fab: true, dias: {} }, tel));
    assert.deepEqual([r2.fab, r2.clima], [true, null], "si el más nuevo no tiene ciudad, queda sin ciudad");
  });
  test("tu botella: 500 ml si no elegiste otra, entre 250 ml y 3 L, y viaja entre equipos con los ajustes", () => {
    const botella = G("aguaBotella"), txt = G("aguaMlTxt"), S = defaultState();
    assert.equal(botella(S), 500, "sin elegir: la de 500 ml de siempre");
    S.agua.botella = 750; assert.equal(botella(S), 750);
    S.agua.botella = 100; assert.equal(botella(S), 500, "una medida fuera de rango vuelve a 500");
    assert.deepEqual([txt(750), txt(1000), txt(1500)], ["750 ml", "1 L", "1,5 L"]);
    const tel = { meta: 0, vaso: 250, botella: 750, inicio: true, ts: 40, dias: {} }, pc = { meta: 0, vaso: 250, inicio: true, ts: 10, dias: {} };
    assert.equal(clone(merge(pc, tel)).botella, 750, "la botella del ajuste más nuevo (el teléfono)");
    assert.equal(clone(merge({ ts: 5, dias: {} }, { ts: 1, dias: {} })).botella, 500, "sin botella en ningún equipo: 500");
  });
  test("los días de calor: sobre 28 °C la meta sube medio litro y sobre 32 °C un litro; solo si está encendido", () => {
    const extra = G("aguaExtraCalor"), meta = G("aguaMeta"), s = defaultState(), f = "2026-10-31";
    assert.deepEqual([extra(20), extra(27.9), extra(28), extra(31), extra(32), extra(38)], [0, 0, 500, 500, 1000, 1000]);
    s.agua.meta = 2000; s.agua.dias[f] = Object.assign(dia([]), { c: 31 });
    assert.equal(meta(s, f), 2000, "sin ciudad, la meta de siempre");
    s.agua.clima = { on: true, ciudad: "Santiago, Chile", lat: -33.45, lon: -70.65 };
    assert.equal(meta(s, f), 2500, "31 °C: medio litro más");
    s.agua.dias[f].c = 33; assert.equal(meta(s, f), 3000, "33 °C: un litro más");
    assert.equal(meta(s, "2026-10-30"), 2000, "un día sin temperatura: la meta de siempre");
    s.agua.dias[f].cp = true; assert.equal(meta(s, f), 2000, "si el calor llegó cuando ya habías cumplido, la meta de ese día no cambia");
    assert.equal(G("aguaTempDe")(f, s), 33, "pero la temperatura se muestra igual");
    delete s.agua.dias[f].cp;
    s.agua.clima.on = false; assert.equal(meta(s, f), 2000, "apagado: la meta de siempre");
  });
  test("el acuario del mes: un pez por cada día cumplido y uno dorado por cada 7 seguidos", () => {
    const s = defaultState(), mes = G("aguaMesAcuario");
    s.agua.meta = 2000;
    for (let d = 1; d <= 9; d++) s.agua.dias[`2026-09-${String(d).padStart(2, "0")}`] = { ml: 2100 };
    s.agua.dias["2026-09-15"] = Object.assign(dia([["x", 1000, 1]]), { p: true });   // cumplió con otra meta ese día
    s.agua.dias["2026-09-20"] = { ml: 1500 };                                          // no llegó
    const A = mes(2026, 8, s);
    assert.equal(A.dias.length, 30);
    assert.deepEqual([A.peces, A.dorados], [10, 1], "9 seguidos + el 15 = 10 peces; 7 seguidos = 1 dorado");
  });
  test("la meta automática: 35 ml por kilo, de 50 en 50, entre 1,5 y 3,5 L; sin peso, 2 L", () => {
    const s = defaultState(), m = new Date().getMonth(), y = new Date().getFullYear();
    assert.equal(metaAuto(s), 2000);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 70; assert.equal(metaAuto(s), 2450);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 30; assert.equal(metaAuto(s), 1500);
    G("datosAnio")(s, y, true).salud.meses[m].peso = 140; assert.equal(metaAuto(s), 3500);
  });
  test("pasadas las 5 semanas que se pueden corregir, un día queda solo con su total", () => {
    const s = defaultState();
    s.agua.dias = { "2026-09-20": dia([["a", 250, 1], ["b", 500, 2]], ["a"]), "2026-10-01": dia([["c", 250, 3]]), "2026-10-20": dia([["d", 250, 4]]) };
    compactar(s, "2026-10-31");
    assert.deepEqual(clone(s.agua.dias["2026-09-20"]), { ml: 500 });
    assert.equal(s.agua.dias["2026-10-01"].r.length, 1, "los últimos 35 días guardan cada vaso (ahí se puede corregir)");
    assert.equal(s.agua.dias["2026-10-20"].r.length, 1);
  });
  test("corregir otros días: la semana de hoy y las 4 anteriores, nunca mañana", () => {
    const lunes = G("aguaLunes"), desde = G("aguaEditaDesde"), editable = G("aguaEditable");
    assert.deepEqual([lunes("2026-11-06"), lunes("2026-11-02"), lunes("2026-11-08")], ["2026-11-02", "2026-11-02", "2026-11-02"], "la semana parte el lunes (el domingo es el último día)");
    assert.equal(desde("2026-11-06"), "2026-10-05", "4 semanas antes del lunes de esta semana");
    assert.deepEqual(["2026-11-06", "2026-11-01", "2026-10-05", "2026-10-04", "2026-11-07", "nada"].map(f => editable(f, "2026-11-06")), [true, true, true, false, false, false]);
    assert.equal(G("AGUA_DETALLE") >= 7 * 4 + 7, true, "los días que se pueden corregir guardan cada vaso");
  });
  test("corregir otros días: la hora de cada vaso y el nombre del día", () => {
    const hora = G("aguaRegHora"), txt = G("aguaDiaTxt");
    assert.equal(hora({ ts: new Date(2026, 10, 4, 9, 5).getTime() }, "2026-11-04"), "09:05");
    assert.equal(hora({ ts: new Date(2026, 10, 6, 20, 0).getTime() }, "2026-11-04"), "anotado después", "lo que anotaste otro día no muestra una hora falsa");
    assert.equal(hora({ ts: 0 }, "2026-11-04"), "—");
    assert.equal(txt("2026-11-04"), "miércoles 4 de noviembre");
  });
  test("corregir otros días en dos equipos: lo que agregaste y lo que quitaste se conservan", () => {
    const viejo = dia([["a", 250, 1], ["b", 250, 2]]);
    const tel = { ts: 5, dias: { "2026-10-10": { r: [...viejo.r, { id: "z", ml: 1500, ts: 99 }], b: ["a"] } } };   // en el teléfono: +1,5 L y quitaste a
    const pc = { ts: 5, dias: { "2026-10-10": clone(viejo) } };
    const d = clone(merge(pc, tel)).dias["2026-10-10"];
    assert.equal(total(d), 1750, "250 + 1500: el a quitado no vuelve");
    const resumido = clone(merge({ ts: 1, dias: { "2026-10-12": { ml: 2000 } } }, { ts: 1, dias: { "2026-10-12": { r: [{ id: "resumen", ml: 2000, ts: 0 }], b: ["resumen"] } } })).dias["2026-10-12"];
    assert.equal(total(resumido), 0, "un día resumido que corregiste: lo quitado tampoco vuelve");
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
