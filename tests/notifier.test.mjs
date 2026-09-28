/* Tests de las reglas del notificador (notifier/reglas.mjs): semana y trimestre */
export default async function ({ test, assert }) {
  console.log("\nAvisos del servidor");
  const { avisoSemana, avisoTrimestre } = await import("../notifier/reglas.mjs");

  test("trimestre: cierre el penúltimo día en la noche, solo si falta cerrarlo", () => {
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", {}).clave, "2026-Q4");
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", {}).hora, "noche");
    assert.equal(avisoTrimestre("tri-cierre", "2026-06-29", {}).clave, "2026-Q2");   // junio tiene 30
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-31", {}), null);             // el último día va el de mes
    assert.equal(avisoTrimestre("tri-cierre", "2026-11-29", {}), null);             // no es fin de trimestre
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", { "2026-Q4": { cierre: { ts: 1 } } }), null);
  });

  test("trimestre: apertura el día 2 en la mañana; invita a cerrar el anterior si falta", () => {
    const a = avisoTrimestre("tri-apertura", "2027-01-02", {});
    assert.equal(a.clave, "2027-Q1"); assert.equal(a.hora, "manana"); assert.equal(a.pendienteAnterior, true);
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-02", { "2026-Q4": { cierre: { ts: 1 } } }).pendienteAnterior, false);
    assert.equal(avisoTrimestre("tri-apertura", "2026-10-02", { "2026-Q3": { cierre: { ts: 1 } } }).clave, "2026-Q4");
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-01", {}), null);            // el día 1 va el de mes
    assert.equal(avisoTrimestre("tri-apertura", "2027-02-02", {}), null);            // no es el primer mes
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-02", { "2027-Q1": { apertura: { ts: 1 } } }), null);
  });

  test("semana: el día del ritual y el siguiente, solo si falta", () => {
    assert.equal(avisoSemana("semana-cierre", "2026-09-27", 0, {}), "noche");        // domingo
    assert.equal(avisoSemana("semana-apertura", "2026-09-28", 0, {}), "manana");     // lunes
    assert.equal(avisoSemana("semana-apertura", "2026-09-28", 0, { "2026-09-28": { apertura: {} } }), null);
    assert.equal(avisoSemana("semana-cierre", "2026-09-28", 1, {}), "manana");       // ritual el lunes
  });
}
