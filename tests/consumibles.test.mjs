/* Tests de los consumibles de la Tienda (consumibles.js): reabrir un día y retiro de los que protegían rachas y hábitos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTienda · consumibles");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const ledgerRegistrar = G("ledgerRegistrar"), recalcGamif = G("recalcGamif");
  const comprar = G("comprarConsumible"), usar = G("usarConsumible"), inventario = G("inventario"), reabrible = G("reabrible");
  const retirar = G("retirarConsumibles"), cumplimiento = G("cumplimiento");

  const conSaldo = n => { const s = migrate(defaultState()); ledgerRegistrar(s, "saldo-test", n, 0, "t"); return s; };
  const cerrar = (s, iso) => { s.ritual.dias[iso] = { hecho: true, cerrado: true }; };
  /* Compra como la hacía la v60 (consumibles que hoy ya no se venden) */
  const compraVieja = (s, tipo, costo, id) => ledgerRegistrar(s, "consumo:" + tipo + ":" + id, -costo, 0, "Compra");

  test("migración: gamif.usos existe y es idempotente; estado viejo sin usos no se rompe", () => {
    const s = migrate(defaultState());
    assert.ok(Array.isArray(s.gamif.usos));
    const v = defaultState(); delete v.gamif.usos;
    const m = migrate(clone(v)); assert.deepEqual(clone(m.gamif.usos), []);
    assert.deepEqual(clone(migrate(clone(m)).gamif.usos), []);
  });

  test("la Tienda solo vende Reabrir un día", () => {
    const s = conSaldo(500);
    assert.equal(G("CONSUMIBLES").map(c => c.id).join(), "reabrir");
    assert.equal(comprar(s, "protector").ok, false);
    assert.equal(comprar(s, "reabrir").ok, true);
    assert.equal(inventario(s, "reabrir"), 1);
    assert.equal(s.gamif.puntos, 380);
  });

  test("reabrir: días cerrados de la última semana", () => {
    const s = migrate(defaultState());
    cerrar(s, "2026-09-20"); cerrar(s, "2026-09-21");
    assert.equal(reabrible(s, "2026-09-21", "2026-09-28"), true);
    assert.equal(reabrible(s, "2026-09-20", "2026-09-28"), false);   // más de 7 días
    assert.equal(reabrible(s, "2026-09-27", "2026-09-28"), false);   // no está cerrado
  });

  test("retiro: devuelve lo no usado, cancela días libres futuros y respeta lo usado", () => {
    const s = conSaldo(1000);
    compraVieja(s, "protector", 150, "a"); compraVieja(s, "protector", 150, "b");
    compraVieja(s, "libre", 200, "c"); compraVieja(s, "libre", 200, "d");
    compraVieja(s, "pase", 80, "e");
    s.gamif.usos.push({ id: "protector:2026-09-20", tipo: "protector", fecha: "2026-09-20", ts: 5 });   // usado: se respeta
    s.gamif.usos.push({ id: "libre:2026-09-10", tipo: "libre", fecha: "2026-09-10", ts: 5 });           // pasado: se respeta
    s.gamif.usos.push({ id: "libre:2026-10-12", tipo: "libre", fecha: "2026-10-12", ts: 5 });           // futuro: se cancela
    recalcGamif(s);
    assert.equal(s.gamif.puntos, 1000 - 300 - 400 - 80);
    retirar(s, "2026-09-28");
    assert.equal(s.gamif.puntos, 1000 - 150 - 200);   // vuelven 1 protector, 1 día libre y el pase
    assert.equal(s.gamif.usos.find(u => u.id === "libre:2026-10-12").anulado, true);
    assert.equal(s.gamif.usos.find(u => u.id === "protector:2026-09-20").anulado, undefined);
    assert.equal(s.gamif.ledger.find(m => m.id === "consumo:protector:a").anulado, undefined);   // se anulan las últimas por id
    assert.equal(s.gamif.ledger.find(m => m.id === "consumo:protector:b").anulado, true);
    const antes = JSON.stringify(s.gamif);
    retirar(s, "2026-09-28");
    assert.equal(JSON.stringify(s.gamif), antes);   // idempotente
  });

  test("retiro en dos equipos: la fusión no duplica ni pierde monedas", () => {
    const base = conSaldo(1000);
    compraVieja(base, "rescate", 100, "x"); compraVieja(base, "rescate", 100, "y");
    const A = migrate(clone(base)), B = migrate(clone(base));
    const r = migrate(mergeStates(clone(A), clone(B)));
    assert.equal(r.gamif.puntos, 1000);
    assert.equal(r.gamif.ledger.filter(m => m.id.startsWith("consumo:rescate:")).length, 2);
  });

  test("lo usado antes del retiro se sigue respetando: día libre pasado no baja el cumplimiento", () => {
    G("HM_HOY = '2026-09-28'");
    const s = conSaldo(0);
    const h = { id: "h1", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-09-01" };
    s.habitos.defs = [h];
    s.habitos.log["2026-9"] = { h1: { 21: true, 22: true, 23: true, 24: true, 25: true, 26: true } };
    s.gamif.usos.push({ id: "libre:2026-09-27", tipo: "libre", fecha: "2026-09-27", ts: 1 });
    assert.equal(cumplimiento(h, "2026-09-21", "2026-09-27", s).pct, 100);
    G("HM_HOY = null");
  });

  test("fusión de usos: el mismo uso en dos equipos cuenta una vez", () => {
    const base = conSaldo(400); comprar(base, "reabrir");
    const A = clone(base), B = clone(base);
    usar(A, "reabrir", "reabrir:2026-09-27", { fecha: "2026-09-27" }, 1000);
    usar(B, "reabrir", "reabrir:2026-09-27", { fecha: "2026-09-27" }, 1001);
    const r = mergeStates(clone(A), clone(B));
    assert.equal(r.gamif.usos.filter(u => u.id === "reabrir:2026-09-27").length, 1);
    assert.equal(inventario(r, "reabrir"), 0);
    const viejo = clone(A); delete viejo.gamif.usos;   // versión antigua sin usos no borra nada
    assert.equal(mergeStates(clone(viejo), clone(A)).gamif.usos.length, 1);
  });
}
