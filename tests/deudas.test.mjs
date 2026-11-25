/* Tests de Tus deudas (deudas.js + store.js, v156): saldo, orden por método, la fecha para quedar libre, abonos, ajustes, deshacer y la fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTus deudas");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const crear = G("deudaCrear"), abonar = G("deudaAbonar"), ajustar = G("deudaAjustar"), deshacer = G("deudaDeshacer"), saldo = G("deudaSaldo");
  const orden = G("deudasOrden"), atacar = G("deudaAtacar"), debes = G("deudasDebes"), libre = G("deudasLibreEn"), abonoMes = G("deudasAbonoMes");
  const vivas = G("deudasVivas"), saldadas = G("deudasSaldadas"), abonadoMes = G("deudasAbonadoMes"), debiaAl = G("deudasDebiaAl"), merge = G("deudasMerge");
  const nuevo = () => migrate(defaultState());
  const tres = S => [crear({ nombre: "Crédito", monto: 2100000, cuota: 92000, interes: "medio" }, S), crear({ nombre: "Tarjeta", monto: 480000, cuota: 45000, interes: "alto" }, S),
    crear({ nombre: "Hermana", monto: 150000, cuota: 75000, interes: "no" }, S)];

  test("migración: deudas vacías por defecto, sin tocar nada más", () => {
    const S = nuevo();
    assert.equal(Array.isArray(S.deudas.lista) && S.deudas.lista.length === 0 && Array.isArray(S.deudas.borradas), true);
    const viejo = nuevo(); delete viejo.deudas;
    assert.equal(Array.isArray(migrate(viejo).deudas.lista), true);
  });

  test("bola de nieve: la más chica primero; avalancha: la de interés más alto primero", () => {
    const S = nuevo(); tres(S);
    assert.equal(orden(S).map(d => d.nombre).join(), "Hermana,Tarjeta,Crédito");
    assert.equal(atacar(S).nombre, "Hermana");
    S.deudas.metodo = "avalancha";
    assert.equal(orden(S).map(d => d.nombre).join(), "Tarjeta,Crédito,Hermana");
    assert.equal(atacar(S).nombre, "Tarjeta");
    const uno = nuevo(); crear({ nombre: "Solo una", monto: 1000 }, uno);
    assert.equal(atacar(uno), null, "con una sola, no hace falta marcarla");
  });

  test("abonar baja el saldo; llegar a cero la salda; deshacer la reabre", () => {
    const S = nuevo(); const [, t] = tres(S);
    assert.equal(debes(S), 2730000);
    abonar(t.id, 80000, S, "2026-11-10");
    assert.equal(saldo(t), 400000);
    assert.equal(abonadoMes(S, "2026-11"), 80000);
    const x = abonar(t.id, 999999, S, "2026-11-20");
    assert.equal(x.monto, 400000, "un abono mayor a lo que queda se ajusta a lo que queda");
    assert.equal(saldo(t), 0); assert.ok(t.saldada > 0);
    assert.equal(vivas(S).length, 2); assert.equal(saldadas(S), 1);
    assert.equal(abonar(t.id, 1000, S), null, "a una saldada no se abona");
    deshacer(t.id, x.id, S);
    assert.equal(t.saldada, 0); assert.equal(saldo(t), 400000);
  });

  test("ajustar: si subió por intereses o bajó por un acuerdo, queda como un ajuste", () => {
    const S = nuevo(); const d = crear({ nombre: "Tarjeta", monto: 480000, interes: "alto" }, S);
    ajustar(d.id, 500000, S);
    assert.equal(saldo(d), 500000);
    ajustar(d.id, 450000, S);
    assert.equal(saldo(d), 450000);
    assert.equal(ajustar(d.id, 450000, S), null, "sin cambio, nada");
  });

  test("la fecha para quedar libre: con lo que puedes abonar al mes, y null si los intereses se lo comen", () => {
    const S = nuevo(); tres(S);
    assert.equal(abonoMes(S), 212000, "sin decir cuánto, la suma de las cuotas");
    const r = libre(S, 250000, "2026-11-25");
    assert.ok(r && r.meses >= 11 && r.meses <= 16, "unos 12 meses con 250 mil: " + (r && r.meses));
    const mas = libre(S, 400000, "2026-11-25");
    assert.ok(mas.meses < r.meses, "abonar más acerca la fecha");
    assert.equal(libre(S, 10000, "2026-11-25"), null, "con 10 mil no alcanza ni para los intereses");
    assert.equal(libre(S, 0, "2026-11-25"), null);
    S.deudas.abonoMes = 300000;
    assert.equal(abonoMes(S), 300000);
  });

  test("lo que debías al terminar cada mes (Tendencias)", () => {
    const S = nuevo(); const d = crear({ nombre: "Tarjeta", monto: 480000 }, S);
    d.creada = new Date(2026, 9, 3, 12).getTime();
    abonar(d.id, 100000, S, "2026-10-20"); abonar(d.id, 50000, S, "2026-11-05");
    assert.equal(debiaAl(S, "2026-09-30"), 0, "antes de anotarla, nada");
    assert.equal(debiaAl(S, "2026-10-31"), 380000);
    assert.equal(debiaAl(S, "2026-11-30"), 330000);
  });

  test("dos equipos: los abonos se juntan, lo deshecho no vuelve y las borradas no reviven", () => {
    const a = nuevo(); const d = crear({ nombre: "Tarjeta", monto: 300000 }, a);
    const b = clone(a);
    const x1 = abonar(d.id, 100000, a, "2026-11-10");
    const db = b.deudas.lista[0]; abonar(db.id, 50000, b, "2026-11-11");
    const m = merge(clone(a.deudas), clone(b.deudas));
    assert.equal(m.lista.length, 1);
    assert.equal(saldo(m.lista[0]), 150000, "los dos abonos cuentan");
    deshacer(d.id, x1.id, a);
    const m2 = merge(clone(a.deudas), clone(m));
    assert.equal(saldo(m2.lista[0]), 250000, "el deshecho no vuelve");
    const c = clone(a); c.deudas.borradas.push(d.id); c.deudas.lista = [];
    assert.equal(merge(clone(c.deudas), clone(b.deudas)).lista.length, 0);
    const todo = mergeStates(clone(a), clone(b));
    assert.equal(todo.deudas.lista.length, 1, "mergeStates también las junta");
  });

  test("saldada en un equipo y abono deshecho en el otro: al juntarse, saldada sale de lo que queda", () => {
    const a = nuevo(); const d = crear({ nombre: "Préstamo", monto: 100000 }, a);
    const x = abonar(d.id, 100000, a, "2026-11-10");
    const b = clone(a); deshacer(b.deudas.lista[0].id, x.id, b);
    const m = merge(clone(a.deudas), clone(b.deudas));
    assert.equal(m.lista[0].saldada, 0);
  });
}
