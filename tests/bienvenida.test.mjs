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
}
