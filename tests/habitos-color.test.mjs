/* Tests de los hábitos por color (habitos-motor.js, v144): el borde de cada hábito hoy. Verde, cumplido en su período;
   amarillo, vas bien; rojo, en riesgo; sin color, descansa o hoy no toca. Y el orden: rojo, amarillo, verde. */
export default async function ({ G, test, assert }) {
  console.log("\nHábitos por color");
  const defaultState = G("defaultState"), estado = G("hmEstadoHoy"), ordenar = G("hmOrdenarPorEstado");
  const conHoy = (iso, fn) => { G(`HM_HOY = ${JSON.stringify(iso)}`); try { return fn(); } finally { G("HM_HOY = null"); } };
  const marcar = (S, id, ...isos) => isos.forEach(iso => { const d = new Date(iso + "T12:00:00"), k = d.getFullYear() + "-" + (d.getMonth() + 1);
    S.habitos.log[k] = S.habitos.log[k] || {}; (S.habitos.log[k][id] = S.habitos.log[k][id] || {})[d.getDate()] = true; });
  const hab = (S, id, extra) => { const h = Object.assign({ id, nombre: id, icon: "📚", frecuencia: { tipo: "diario" }, creado: "2026-10-01" }, extra || {}); S.habitos.defs.push(h); return h; };
  const S0 = () => { const S = defaultState(); S.habitos.defs = []; S.habitos.log = {}; return S; };

  test("diario: verde si lo hiciste hoy, amarillo si ayer sí, rojo si ayer no", () => {
    const S = S0(), h = hab(S, "leer");
    marcar(S, "leer", "2026-11-05");
    conHoy("2026-11-06", () => assert.equal(estado(h, S), "ve", "ayer sí: vas bien"));
    conHoy("2026-11-07", () => assert.equal(estado(h, S), "cr", "ayer (el 6) no: en riesgo"));
    marcar(S, "leer", "2026-11-07");
    conHoy("2026-11-07", () => assert.equal(estado(h, S), "ok", "hecho hoy: cumplido"));
  });
  test("días fijos: la última vez que tocaba, no ayer; hoy no toca, sin color", () => {
    const S = S0(), h = hab(S, "gym", { frecuencia: { tipo: "dias", dias: [0, 2, 4] } });   // lunes, miércoles y viernes
    marcar(S, "gym", "2026-11-04");   // miércoles
    conHoy("2026-11-06", () => assert.equal(estado(h, S), "ve", "viernes: el miércoles sí (el jueves no tocaba)"));
    conHoy("2026-11-05", () => assert.equal(estado(h, S), "de", "jueves: hoy no toca"));
    conHoy("2026-11-09", () => assert.equal(estado(h, S), "cr", "lunes: el viernes no"));
  });
  test("un día de descanso o un pase no dejan el hábito en rojo", () => {
    const S = S0(), h = hab(S, "e");
    marcar(S, "e", "2026-11-04");
    S.habitos.descansos = [{ id: "d:e:2026-11-05", hid: "e", fecha: "2026-11-05", ts: 1 }];
    conHoy("2026-11-06", () => assert.equal(estado(h, S), "ve", "ayer descansó: cuenta la vez anterior (el 4, hecho)"));
  });
  test("de cuota: verde al llegar, rojo si ya no hay margen y amarillo si queda", () => {
    const S = S0(), h = hab(S, "corr", { frecuencia: { tipo: "semanal", veces: 3 } });
    marcar(S, "corr", "2026-11-02");   // lunes
    conHoy("2026-11-06", () => assert.equal(estado(h, S), "ve", "viernes, 1 de 3: faltan 2 y quedan 3 días"));
    conHoy("2026-11-07", () => assert.equal(estado(h, S), "cr", "sábado, 1 de 3: faltan 2 y quedan 2 días (hoy o no llegas)"));
    marcar(S, "corr", "2026-11-07");
    conHoy("2026-11-07", () => assert.equal(estado(h, S), "ve", "hoy ya sumaste: no se pone rojo por mañana"));
    marcar(S, "corr", "2026-11-08");
    conHoy("2026-11-08", () => assert.equal(estado(h, S), "ok", "3 de 3: cumplido"));
  });
  test("dejar y reducir: caer es rojo, confirmar es verde; el límite: dentro verde, justo amarillo, pasado rojo", () => {
    const caer = G("djCaidaPoner"), contar = G("djCuentaPoner");
    const S = S0(), d = hab(S, "fumar", { meta: "dejar", creado: "2026-10-20" }), r = hab(S, "cafe", { meta: "reducir", limite: { n: 3, per: "dia" }, creado: "2026-10-20" });
    conHoy("2026-11-06", () => {
      assert.equal(estado(d, S), "ve", "dejar, sin confirmar hoy: vas bien");
      marcar(S, "fumar", "2026-11-06");
      assert.equal(estado(d, S), "ok", "confirmado hoy: verde");
      caer(d, "2026-11-06", true, S);
      assert.equal(estado(d, S), "cr", "caíste hoy: rojo");
      assert.equal(estado(r, S), "ok", "reducir, 0 de 3: dentro del límite");
      contar(r, "2026-11-06", 3, S); assert.equal(estado(r, S), "ve", "3 de 3: justo en el límite");
      contar(r, "2026-11-06", 4, S); assert.equal(estado(r, S), "cr", "4 de 3: te pasaste (como Lucidez)");
    });
  });
  test("el orden: rojo primero, después amarillo, verde y sin color, y entre iguales el de siempre", () => {
    const S = S0();
    const a = hab(S, "a"), b = hab(S, "b"), c = hab(S, "c"), d = hab(S, "d");
    marcar(S, "a", "2026-11-06"); marcar(S, "b", "2026-11-05"); marcar(S, "d", "2026-11-05");   // a hecho hoy · b y d ayer sí · c ayer no
    conHoy("2026-11-06", () => assert.deepEqual(ordenar([a, b, c, d], S).map(h => h.id), ["c", "b", "d", "a"]));
  });
}
