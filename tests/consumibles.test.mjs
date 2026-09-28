/* Tests de los consumibles de la Tienda (consumibles.js): inventario, protector, día libre, pase, rescate, fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTienda · consumibles");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const ledgerRegistrar = G("ledgerRegistrar");
  const comprar = G("comprarConsumible"), usar = G("usarConsumible"), anular = G("anularUso"), inventario = G("inventario");
  const aplicarProtectores = G("aplicarProtectores"), rescatePosible = G("rescatePosible");
  const paseDisponibleSemana = G("paseDisponibleSemana"), reabrible = G("reabrible");
  const cumplimiento = G("cumplimiento"), hmDone = G("hmDone"), tocaHoy = G("tocaHoy");

  const conSaldo = n => { const s = migrate(defaultState()); ledgerRegistrar(s, "saldo-test", n, 0, "test"); return s; };
  const cerrar = (s, iso) => { s.ritual.dias[iso] = { hecho: true, cerrado: true }; };

  test("migración: gamif.usos existe y es idempotente; estado viejo sin usos no se rompe", () => {
    const s = migrate(defaultState());
    assert.ok(Array.isArray(s.gamif.usos));
    const v = defaultState(); delete v.gamif.usos;
    const m = migrate(clone(v)); assert.deepEqual(clone(m.gamif.usos), []);
    assert.deepEqual(clone(migrate(clone(m)).gamif.usos), []);
  });

  test("comprar: descuenta del saldo, suma al inventario, respeta máximo y saldo", () => {
    const s = conSaldo(400);
    assert.equal(comprar(s, "protector").ok, true);
    assert.equal(comprar(s, "protector").ok, true);
    assert.equal(comprar(s, "protector").max, 2);          // máximo 2 guardados
    assert.equal(inventario(s, "protector"), 2);
    assert.equal(s.gamif.puntos, 100);
    assert.equal(comprar(s, "libre").falta, 100);
    assert.equal(comprar(s, "pase").ok, true);
    assert.equal(s.gamif.puntos, 20);
  });

  test("protector: cubre ayer después del mediodía, no dos días seguidos, no sin racha", () => {
    const s = conSaldo(300); comprar(s, "protector"); comprar(s, "protector");
    cerrar(s, "2026-09-24"); cerrar(s, "2026-09-25");
    // 26 y 27 sin cerrar; hoy 28 a las 9: el 27 aún se puede cerrar gratis → solo cubre el 26
    let d = aplicarProtectores(s, new Date(2026, 8, 28, 9));
    assert.deepEqual(clone(d), ["2026-09-26"]);
    // a las 13: el 27 viene después de un día protegido → no se cubre
    d = aplicarProtectores(s, new Date(2026, 8, 28, 13));
    assert.deepEqual(clone(d), []);
    assert.equal(inventario(s, "protector"), 1);
    // sin racha previa no gasta
    const t = conSaldo(200); comprar(t, "protector");
    assert.deepEqual(clone(aplicarProtectores(t, new Date(2026, 8, 28, 13))), []);
    assert.equal(inventario(t, "protector"), 1);
  });

  test("protector: si el día cubierto al final se cerró (otro equipo), vuelve al inventario", () => {
    const s = conSaldo(200); comprar(s, "protector");
    cerrar(s, "2026-09-26");
    aplicarProtectores(s, new Date(2026, 8, 28, 13));
    assert.equal(inventario(s, "protector"), 0);
    cerrar(s, "2026-09-27");
    assert.equal(inventario(s, "protector"), 1);
  });

  test("día libre: los hábitos diarios no cuentan ni cortan; cancelar lo devuelve", () => {
    G("HM_HOY = '2026-09-28'");
    const s = conSaldo(200); comprar(s, "libre");
    const h = { id: "h1", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-09-01" };
    s.habitos.defs = [h];
    // marcado 21..26, sin marcar el 27 (libre)
    for (let d = 21; d <= 26; d++) { s.habitos.log["2026-9"] = s.habitos.log["2026-9"] || {}; (s.habitos.log["2026-9"].h1 = s.habitos.log["2026-9"].h1 || {})[d] = true; }
    assert.equal(cumplimiento(h, "2026-09-21", "2026-09-27", s).pct, 86);
    assert.equal(usar(s, "libre", "libre:2026-09-27", { fecha: "2026-09-27" }), true);
    assert.equal(cumplimiento(h, "2026-09-21", "2026-09-27", s).pct, 100);
    assert.equal(inventario(s, "libre"), 0);
    usar(s, "libre", "libre:2026-09-28", { fecha: "2026-09-28" });   // sin inventario: no se usa
    assert.equal(tocaHoy(h, s), true);
    anular(s, "libre:2026-09-27");
    assert.equal(inventario(s, "libre"), 1);
    usar(s, "libre", "libre:2026-09-28", { fecha: "2026-09-28" });
    assert.equal(tocaHoy(h, s), false);
    G("HM_HOY = null");
  });

  test("pase: cuenta como hecho sin marca ni monedas; 1 por hábito a la semana", () => {
    const s = conSaldo(200); comprar(s, "pase"); comprar(s, "pase");
    const h = { id: "h1", nombre: "Correr", frecuencia: { tipo: "diario" }, creado: "2026-09-01" };
    s.habitos.defs = [h];
    const saldo = s.gamif.puntos;
    assert.equal(paseDisponibleSemana(s, "h1", "2026-09-23"), true);
    usar(s, "pase", "pase:h1:2026-09-23", { fecha: "2026-09-23", hid: "h1" });
    assert.equal(hmDone(h, "2026-09-23", s), true);
    assert.equal(s.gamif.puntos, saldo);
    assert.equal(paseDisponibleSemana(s, "h1", "2026-09-27"), false);   // misma semana
    assert.equal(paseDisponibleSemana(s, "h1", "2026-09-28"), true);    // semana nueva
    assert.equal(paseDisponibleSemana(s, "h2", "2026-09-24"), true);    // otro hábito
  });

  test("rescate y reabrir: ventanas de tiempo", () => {
    const s = migrate(defaultState());
    s.ritual.dias["2026-09-27"] = { hecho: true };
    assert.equal(rescatePosible(s, new Date(2026, 8, 28, 10)), null);          // mañana: cierre gratis
    assert.equal(rescatePosible(s, new Date(2026, 8, 28, 15)), "2026-09-27");
    cerrar(s, "2026-09-20"); cerrar(s, "2026-09-21");
    assert.equal(reabrible(s, "2026-09-21", "2026-09-28"), true);
    assert.equal(reabrible(s, "2026-09-20", "2026-09-28"), false);              // más de 7 días
    assert.equal(reabrible(s, "2026-09-27", "2026-09-28"), false);              // no está cerrado
  });

  test("fusión: el mismo uso en dos equipos cuenta una vez; la anulación más reciente gana", () => {
    const base = conSaldo(400); comprar(base, "libre"); comprar(base, "pase");
    const A = clone(base), B = clone(base);
    usar(A, "pase", "pase:h1:2026-09-28", { fecha: "2026-09-28", hid: "h1" }, 1000);
    usar(B, "pase", "pase:h1:2026-09-28", { fecha: "2026-09-28", hid: "h1" }, 1001);
    usar(A, "libre", "libre:2026-10-05", { fecha: "2026-10-05" }, 1000);
    const B2 = clone(B); usar(B2, "libre", "libre:2026-10-05", { fecha: "2026-10-05" }, 1000); anular(B2, "libre:2026-10-05", 2000);
    const r = mergeStates(clone(A), clone(B2));
    assert.equal(r.gamif.usos.filter(u => u.id === "pase:h1:2026-09-28").length, 1);
    assert.equal(inventario(r, "pase"), 0);
    assert.equal(inventario(r, "libre"), 1);           // la cancelación (ts 2000) gana
    const viejo = clone(A); delete viejo.gamif.usos;   // versión antigua sin usos no borra nada
    assert.equal(mergeStates(clone(viejo), clone(A)).gamif.usos.length, 2);
  });
}
