/* Tests de datos por año (anios.js): año base intacto, años nuevos y fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nDatos por año");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const datosAnio = G("datosAnio"), rutaAnio = G("rutaAnio"), tocarAnio = G("tocarAnio"), aniosConDatos = G("aniosConDatos");
  const base2026 = () => { const s = migrate(defaultState()); s.settings.year = 2026; return s; };

  test("el año base sigue en su lugar; los otros años parten vacíos y no se guardan al mirarlos", () => {
    const s = base2026();
    s.metas.mensuales[8].push({ id: "m1", texto: "Web" });
    s.finanzas.metaAnual = 3000000;
    const d26 = datosAnio(s, 2026);
    assert.equal(d26.base, true); assert.equal(d26.metas.mensuales[8][0].texto, "Web");
    assert.equal(rutaAnio(2026, s), ""); assert.equal(rutaAnio(2027, s), "anios.2027.");
    const d27 = datosAnio(s, 2027);
    assert.equal(d27.metas.mensuales[0].length, 0);
    assert.equal(d27.finanzas.metaAnual, 3000000);                 // meta anual: parte con la del año anterior
    assert.equal(d27.salud.meses[1].diasEntrenTotal, 28);           // febrero 2027
    assert.equal(s.anios[2027], undefined);                          // mirar no guarda
    datosAnio(s, 2027, true).metas.mensuales[0].push({ id: "e1", texto: "Enero" });
    assert.equal(s.anios[2027].metas.mensuales[0][0].texto, "Enero");
    assert.equal(s.metas.mensuales[0].length, 0);                    // 2026 intacto
    assert.equal(aniosConDatos(s).includes(2027), true);
  });

  test("migración: agrega anios sin tocar nada más (idempotente)", () => {
    const viejo = base2026(); delete viejo.anios;
    viejo.metas.trimestres[3].push({ id: "t", texto: "Q4" });
    const m = migrate(clone(viejo));
    assert.equal(JSON.stringify(m.anios), "{}");
    assert.equal(m.metas.trimestres[3][0].texto, "Q4");
    assert.equal(JSON.stringify(migrate(clone(m)).anios), "{}");
  });

  test("fusión: metas por id; finanzas, salud y rueda por la edición más reciente; nada solo-nube se pierde", () => {
    const a = base2026(), b = base2026();
    datosAnio(a, 2027, true).metas.mensuales[0].push({ id: "x", texto: "De A", ts: 1 });
    datosAnio(b, 2027, true).metas.mensuales[0].push({ id: "y", texto: "De B", ts: 1 });
    datosAnio(a, 2027).finanzas.meses[0].ingreso = 100; tocarAnio(a, 2027, "finanzas");
    datosAnio(b, 2027).finanzas.meses[0].ingreso = 999; b.anios[2027].finanzas.ts = a.anios[2027].finanzas.ts + 50;
    datosAnio(b, 2028, true).rueda.meses[0] = [5, 5, 5, 5, 5, 5, 5, 5];
    const r = migrate(mergeStates(clone(b), clone(a)));              // nube = B, local = A
    assert.equal(r.anios[2027].metas.mensuales[0].map(o => o.texto).sort().join(), "De A,De B");
    assert.equal(r.anios[2027].finanzas.meses[0].ingreso, 999);        // B editó después
    assert.equal(r.anios[2028].rueda.meses[0][0], 5);                  // año solo en la nube
    // un dispositivo con versión antigua (sin anios) no borra los años de la nube
    const viejo = base2026(); delete viejo.anios;
    const r2 = mergeStates(clone(r), clone(viejo));
    assert.equal(r2.anios[2027].finanzas.meses[0].ingreso, 999);
  });
}
