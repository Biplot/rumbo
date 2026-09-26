/* Tests de la revisión trimestral */
export default async function ({ G, test, assert, clone }) {
  console.log("\nRevisión trimestral");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const pend = G("ritualTriPendientes"), resumen = G("resumenTrimestre"), nombre = G("triNombre"), datosAnio = G("datosAnio");
  const at = (iso, h = 10) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00`);
  const conActividad = s => { s.ritual.dias["2026-11-10"] = { hecho: true, ts: 1 }; return s; };

  test("ventanas: últimos 7 días cierran y abren el siguiente; los primeros 10 días del nuevo también", () => {
    const s = conActividad(migrate(defaultState())); s.settings.year = 2026;
    assert.equal(JSON.stringify(pend(at("2026-12-20"), s)), "{}");
    assert.equal(JSON.stringify(pend(at("2026-12-26"), s)), JSON.stringify({ cierre: { y: 2026, q: 3 }, apertura: { y: 2027, q: 0 } }));
    assert.equal(JSON.stringify(pend(at("2027-01-05"), s)), JSON.stringify({ cierre: { y: 2026, q: 3 }, apertura: { y: 2027, q: 0 } }));
    assert.equal(JSON.stringify(pend(at("2027-01-12"), s)), JSON.stringify({ apertura: { y: 2027, q: 0 } }));   // cierre hasta el 10
    assert.equal(JSON.stringify(pend(at("2027-01-20"), s)), "{}");
    s.ritual.trimestres["2026-Q4"] = { cierre: { ts: 1 } }; s.ritual.trimestres["2027-Q1"] = { apertura: { ts: 1 } };
    assert.equal(JSON.stringify(pend(at("2027-01-05"), s)), "{}");
    const vacio = migrate(defaultState());                                                  // sin actividad: solo abrir
    assert.equal(JSON.stringify(pend(at("2027-01-05"), vacio)), JSON.stringify({ apertura: { y: 2027, q: 0 } }));
    assert.equal(nombre(2026, 3), "4.º trimestre 2026"); assert.equal(nombre(2027, 0), "1.er trimestre 2027");
  });

  test("números del trimestre y fusión por separado de apertura y cierre", () => {
    const s = migrate(defaultState()); s.settings.year = 2026;
    const D = datosAnio(s, 2026);
    D.metas.trimestres[3] = [{ id: "a", texto: "10 clientes", done: true }, { id: "b", texto: "Correr 10K", done: false }];
    D.metas.mensuales[10] = [{ id: "m", texto: "x", done: true }];
    D.finanzas.meses[10].ingreso = 500; D.finanzas.meses[11].gasto = 200;
    s.ritual.meses = { "2026-10": { cierre: { nota: 8, ts: 1 } }, "2026-11": { cierre: { nota: 6, ts: 1 } } };
    s.ritual.dias["2026-11-02"] = { hecho: true, cerrado: true, ts: 1 };
    const r = resumen(2026, 3, s);
    assert.equal(r.trimestrales.join(), "1,2"); assert.equal(r.objetivos.join(), "1,1");
    assert.equal(r.ahorro, 300); assert.equal(r.nota, 7); assert.equal(r.cerrados, 1);
    const a = clone(s), b = clone(s);
    a.ritual.trimestres["2026-Q4"] = { apertura: { foco: "A", ts: 5 } };
    b.ritual.trimestres["2026-Q4"] = { apertura: { foco: "B", ts: 2 }, cierre: { nota: 9, ts: 3 } };
    const m = migrate(mergeStates(clone(b), clone(a)));
    assert.equal(m.ritual.trimestres["2026-Q4"].apertura.foco, "A"); assert.equal(m.ritual.trimestres["2026-Q4"].cierre.nota, 9);
  });
}
