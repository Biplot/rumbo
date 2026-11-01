/* Tests de tus deseos (deseos.js y deseosMerge en store.js): el camino de un deseo (espera, decidir, ahorro, tengo, soltado),
   la espera larga para lo caro, ahorrar (su alcancía o «Mis caprichos»), comprar (lo que sobró y el gasto del mes),
   soltar (lo que no gastaste), la fusión entre equipos y la mudanza de las listas de deseos de antes */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTus deseos");
  const defaultState = G("defaultState"), migrate = G("migrate"), merge = G("deseosMerge"), mergeStates = G("mergeStates");
  const nuevo = G("deseoNuevo"), estado = G("deseoEstado"), ahorrar = G("deseoAhorrar"), soltar = G("deseoSoltar"), comprar = G("deseoComprar");
  const noGaste = G("deseosNoGastaste"), escalera = G("deseosEscalera"), guardado = G("alcGuardado"), aportar = G("alcAportar"), porId = G("alcPorId"), activas = G("alcActivas"), cuando = G("deseoCuando");
  const S0 = () => { const S = defaultState(); S.finanzas.metaMensual = 120000; return S; };

  test("un estado nuevo o viejo trae los deseos vacíos y con espera", () => {
    const s = defaultState(); delete s.deseos; migrate(s);
    assert.deepEqual(clone(s.deseos), { lista: [], borrados: [], espera: true, ts: 0 });
  });
  test("la espera: 7 días; 30 si cuesta más de $300.000; se puede saltar o apagar", () => {
    const S = S0(), a = nuevo({ nombre: "Audífonos", precio: 89990, creado: "2026-10-28" }, S), b = nuevo({ nombre: "Notebook", precio: 900000, creado: "2026-10-20" }, S);
    assert.equal(estado(a, S, "2026-11-01"), "espera", "4 días: espera");
    assert.equal(estado(a, S, "2026-11-04"), "decidir", "7 días: ¿todavía lo quieres?");
    assert.equal(estado(b, S, "2026-11-04"), "espera", "lo caro espera 30 días");
    b.listo = true; assert.equal(estado(b, S, "2026-11-04"), "decidir", "saltar la espera");
    S.deseos.espera = false; assert.equal(estado(a, S, "2026-10-28"), "decidir", "sin espera, al tiro");
  });
  test("ahorrar para esto: su alcancía, con su nombre y su precio como meta (y la meta sigue al precio)", () => {
    const S = S0(), d = nuevo({ nombre: "Bicicleta", precio: 450000 }, S), al = ahorrar(d.id, false, S);
    assert.deepEqual([al.nombre, al.meta, al.deseo, d.alc], ["Bicicleta", 450000, d.id, al.id]);
    assert.equal(estado(d, S), "ahorro");
    d.precio = 420000; G("deseosSincronizar")(S); assert.equal(porId(al.id, S).meta, 420000, "cambiar el precio cambia la meta");
    assert.equal(ahorrar(d.id, false, S), null, "no se le arma otra");
  });
  test("lo compré: lo que pagaste, lo que sobró a otra alcancía y, si quieres, al gasto del mes", () => {
    const S = S0(), d = nuevo({ nombre: "Bicicleta", precio: 450000 }, S), al = ahorrar(d.id, false, S), otra = G("alcCrear")({ nombre: "Viaje", meta: 600000 }, S);
    aportar(al.id, 470000, null, S, "2026-10-15");
    const r = comprar(d.id, { pagado: 430000, gasto: true, destino: otra.id }, S, "2026-11-01");
    assert.deepEqual([r.ahorro, r.sobra, r.cerrar && r.cerrar.id], [20000, 40000, al.id], "te ahorraste $20.000 y sobraron $40.000");
    assert.equal(guardado(otra), 40000, "lo que sobró va a la otra alcancía");
    assert.equal(G("datosAnio")(S, 2026).finanzas.meses[10].gasto, 430000, "y lo pagado, al gasto de noviembre");
    assert.equal(estado(d, S), "tengo");
  });
  test("ya no lo quiero: suma a lo que no gastaste; su alcancía vacía se borra y con plata sigue suelta", () => {
    const S = S0(), a = nuevo({ nombre: "Lámpara", precio: 35000 }, S), b = nuevo({ nombre: "Reloj", precio: 150000 }, S);
    const aa = ahorrar(a.id, false, S), ab = ahorrar(b.id, false, S); aportar(ab.id, 20000, null, S);
    const ra = soltar(a.id, S, "2026-11-01"), rb = soltar(b.id, S, "2026-11-01");
    assert.equal(ra.queda, null); assert.equal(porId(aa.id, S), null, "la vacía se borra");
    assert.equal(rb.queda.id, ab.id); assert.equal(porId(ab.id, S).deseo, "", "la con plata sigue, sin el deseo");
    assert.equal(noGaste(S, 2026), 185000);
    assert.equal(noGaste(S, 2025), 0, "cuenta el año en que lo soltaste");
  });
  test("mis caprichos: una alcancía, en orden; la meta es la suma y al comprar uno sale de ahí", () => {
    const S = S0(), xs = [["Libro", 15000], ["Polera", 20000], ["Juego", 35000]].map(([n, p]) => nuevo({ nombre: n, precio: p }, S));
    xs.forEach(d => ahorrar(d.id, true, S));
    const cap = activas(S).find(a => a.caprichos);
    assert.equal(activas(S).filter(a => a.caprichos).length, 1, "una sola alcancía de caprichos");
    assert.equal(cap.meta, 70000);
    aportar(cap.id, 40000, null, S);
    assert.deepEqual(clone(escalera(S).map(e => [e.d.nombre, e.alcanza])), [["Libro", true], ["Polera", true], ["Juego", false]]);
    comprar(xs[0].id, { pagado: 15000 }, S, "2026-11-01");
    assert.deepEqual([guardado(cap), cap.meta], [25000, 55000], "salen los $15.000 del libro y su precio de la meta");
  });
  test("a tu ritmo: la meta mensual repartida entre tus alcancías", () => {
    const S = S0();
    assert.equal(cuando(240000, S, true, "2026-11-01"), "a tu ritmo, en 2 meses: en enero");
    G("alcCrear")({ nombre: "Otra", meta: 100000 }, S);
    assert.equal(cuando(240000, S, true, "2026-11-01"), "a tu ritmo, en 4 meses: en marzo", "con otra alcancía, la mitad para cada una");
  });
  test("dos equipos: cada deseo por id, el más nuevo gana y los borrados no reviven", () => {
    const tel = { lista: [{ id: "a", nombre: "Bici", precio: 1, ts: 20 }, { id: "b", nombre: "B", ts: 1 }], borrados: ["c"], espera: false, ts: 9 };
    const pc = { lista: [{ id: "a", nombre: "Bicicleta", precio: 2, ts: 10 }, { id: "c", nombre: "C", ts: 5 }], borrados: [], espera: true, ts: 3 };
    const r = clone(merge(tel, pc));
    assert.deepEqual(r.lista.map(d => d.id).sort(), ["a", "b"]);
    assert.equal(r.lista.find(d => d.id === "a").nombre, "Bici");
    assert.deepEqual([r.espera, r.ts], [false, 9]);
    assert.equal(mergeStates({ deseos: pc, gamif: {} }, { deseos: tel, gamif: {} }).deseos.lista.length, 2);
  });
  test("las listas de deseos de antes se mudan solas (una vez) y los conseguidos quedan en «Lo tienes»", () => {
    const S = defaultState();
    S.vida.listas.push({ id: "l1", nombre: "Mis deseos", tipo: "deseos", icon: "💎", items: [{ id: "i1", txt: "Lámpara", costo: 35000, done: false }, { id: "i2", txt: "Cámara", costo: 79990, done: true }] });
    S.vida.listas.push({ id: "l2", nombre: "Súper", tipo: "normal", items: [{ id: "j", txt: "Pan" }] });
    migrate(S); migrate(S);
    assert.deepEqual(clone(S.deseos.lista.map(d => [d.id, d.nombre, d.precio, !!d.tengo, d.listo])), [["ld-i1", "Lámpara", 35000, false, true], ["ld-i2", "Cámara", 79990, true, true]]);
    assert.equal(S.vida.listas.find(l => l.id === "l1").migrada, 1, "la lista queda marcada, no se borra");
    S.vida.listas[0].items.push({ id: "i3", txt: "Taza", costo: 5000 }); migrate(S);
    assert.equal(S.deseos.lista.length, 3, "lo que un equipo viejo agregue después también pasa");
  });
}
