/* Tests de Tu año en Rumbo (tu-anio.js): cuándo se puede ver, los datos del año (días cerrados y tu mejor racha, tu
   hábito del año, medallas, agua, libros, objetivos, foco, ánimo, rueda y ⭐), qué láminas salen y sus textos. */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTu año en Rumbo");
  const defaultState = G("defaultState"), disponible = G("tuAnioDisponible"), temporada = G("tuAnioDeTemporada"), datos = G("tuAnioDatos");
  const laminas = G("tuAnioLaminas"), texto = G("tuAnioTexto"), alt = G("tuAnioAlt"), ledgerRegistrar = G("ledgerRegistrar"), datosAnio = G("datosAnio");
  const nuevo = () => { const S = defaultState(); S.settings.year = 2026; S.profile.name = "Camila Pérez"; return S; };

  test("se ve desde el 1 de diciembre; en enero, la del año que terminó; los anteriores, siempre", () => {
    assert.equal(disponible(2026, "2026-11-30"), false); assert.equal(disponible(2026, "2026-12-01"), true);
    assert.equal(disponible(2026, "2027-01-15"), true); assert.equal(disponible(2025, "2026-06-01"), true);
    assert.deepEqual([temporada("2026-12-06"), temporada("2027-01-20"), temporada("2027-02-01"), temporada("2026-11-30")], [2026, 2026, null, null]);
  });
  test("un año vacío: solo la portada y el cierre", () => {
    const d = datos(nuevo(), 2026, "2026-12-06");
    assert.deepEqual(clone(laminas(d)), ["portada", "final"]);
    assert.equal(d.nombre, "Camila");
    const S2 = nuevo(); S2.profile.name = "camila@correo.cl"; assert.equal(datos(S2, 2026, "2026-12-06").nombre, "", "nunca el correo");
  });
  test("días cerrados y tu mejor racha (un día protegido o hoy no la cortan)", () => {
    const S = nuevo();
    ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-05", "2026-03-06", "2026-12-04", "2026-12-05"].forEach(f => S.ritual.dias[f] = { hecho: true, cerrado: true });
    const d = datos(S, 2026, "2026-12-06");
    assert.equal(d.cerrados, 7); assert.deepEqual(clone(d.mejor), { n: 3, desde: "2026-03-01", hasta: "2026-03-03" });
    assert.equal(d.mapa.length, 365); assert.equal(d.mapa[59], 1, "el 1 de marzo"); assert.equal(d.mapa[364], -1, "lo que no ha pasado");
    const t = texto("cerrados", d);
    assert.deepEqual([t.pre, t.big, t.sub, t.lineas[0], t.lineas[1]], ["Cerraste", "7", "días con tu ritual", "Tu mejor racha: 3 días seguidos", "del 1 de marzo al 3 de marzo"]);
  });
  test("tu hábito del año, las medallas, el agua y los libros", () => {
    const S = nuevo();
    S.habitos.defs = [{ id: "h1", nombre: "Leer", icon: "📖", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }, { id: "h2", nombre: "Correr", icon: "🏃", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }];
    S.habitos.log = { "2026-3": { h1: { 1: true, 2: true, 3: true }, h2: { 1: true } }, "2026-4": { h1: { 9: true } }, "2025-12": { h2: { 1: true, 2: true, 3: true, 4: true, 5: true } } };
    S.gamif.badges = ["primer-paso"]; ledgerRegistrar(S, "insignia:primer-paso", 20, 20, "x", new Date(2026, 1, 3).getTime());
    S.agua = { meta: 2000, vaso: 250, dias: { "2026-05-01": { r: [{ id: "a", ml: 2000 }], b: [] }, "2026-05-02": { r: [{ id: "b", ml: 1500 }], b: [] }, "2025-05-02": { r: [{ id: "c", ml: 9000 }], b: [] } } };
    S.lecturas = [{ id: "l1", titulo: "Drácula", estado: "terminado", fin: "2026-04-01", paginas: 418 }, { id: "l2", titulo: "Viejo", estado: "terminado", fin: "2026-05-01", antes: true }, { id: "l3", titulo: "Otro año", estado: "terminado", fin: "2025-05-01" }];
    const d = datos(S, 2026, "2026-12-06");
    assert.deepEqual(clone(d.habitos.top), { nombre: "Leer", icon: "📖", dias: 4 }); assert.equal(d.habitos.marcas, 5, "solo 2026");
    assert.deepEqual(clone(d.medallas), [{ nombre: "Primer Paso", icon: "🔥" }]);
    assert.deepEqual(clone(d.agua), { litros: 3.5, dias: 1 });
    assert.deepEqual([d.libros.n, d.libros.paginas, d.libros.lista[0].titulo], [1, 418, "Drácula"], "sin los de antes ni los de otro año");
    assert.deepEqual(clone(laminas(d)), ["portada", "cerrados", "habitos", "medallas", "agua", "libros", "final"].filter(x => x !== "cerrados"));
    assert.equal(texto("agua", d).lineas[0], "Unos 14 vasos");
    assert.equal(texto("habitos", d).pre, "Leer");
  });
  test("objetivos, foco, ánimo, rueda, ⭐ y que nunca pasen de 8 láminas", () => {
    const S = nuevo();
    for (let i = 0; i < 30; i++) S.ritual.dias[`2026-02-${String(i % 28 + 1).padStart(2, "0")}`] = { hecho: true, cerrado: true };
    S.habitos.defs = [{ id: "h1", nombre: "Leer", icon: "📖" }]; S.habitos.log = { "2026-2": { h1: { 1: true, 2: true, 3: true } } };
    S.gamif.badges = ["primer-paso"]; ledgerRegistrar(S, "insignia:primer-paso", 20, 20, "x", new Date(2026, 1, 3).getTime());
    S.agua = { meta: 2000, vaso: 250, dias: { "2026-05-01": { r: [{ id: "a", ml: 2000 }], b: [] } } };
    S.lecturas = [{ id: "l1", titulo: "Drácula", estado: "terminado", fin: "2026-04-01", paginas: 418 }];
    const D = datosAnio(S, 2026, true); D.metas.mensuales[3] = [{ id: "o1", texto: "A", done: true }, { id: "o2", texto: "B" }];
    D.rueda.meses[3] = [7, 9, 6, 6, 5, 7, 7, 6]; D.rueda.meses[4] = [7, 7, 6, 6, 5, 7, 7, 6];
    S.enfoque.sesiones = [{ id: "f", fecha: "2026-04-02", real: 90, ts: 1 }];
    S.vida.diario = [1, 2, 3, 4, 5, 6].map(i => ({ id: "d" + i, fecha: "2026-06-0" + i, mood: i % 2 ? 4 : 5, gratitud: i < 3 ? "x" : "" }));
    ledgerRegistrar(S, "x", 1000, 0, "x", new Date(2026, 6, 1).getTime()); ledgerRegistrar(S, "y", 500, 0, "x", new Date(2025, 6, 1).getTime());
    const d = datos(S, 2026, "2026-12-06");
    assert.deepEqual(clone(d.objetivos), [1, 2]); assert.equal(d.foco, 90);
    assert.deepEqual(clone(d.animo), { prom: 4.5, n: 6, gratitud: 2 });
    assert.deepEqual(clone(d.rueda), { k: 1, nombre: "Familia y amor", prom: 8, meses: 2 });
    assert.equal(d.estrellas, 1020, "las de 2026 (la medalla y el regalo), no las de 2025");
    const L = laminas(d);
    assert.equal(L.length, 8); assert.deepEqual(clone(L), ["portada", "cerrados", "habitos", "medallas", "agua", "libros", "objetivos", "final"], "hasta 8: el ánimo y la rueda quedan fuera");
    assert.deepEqual(clone(texto("objetivos", d).lineas), ["y 1 h 30 de foco"]);
    assert.equal(texto("final", d).big, "1.020");
    assert.ok(/Tu elefante ya es/.test(alt("final", d)) && /1\.020 estrellas ganadas este año Nos vemos en 2027\./.test(alt("final", d)), "el texto alternativo dice lo mismo que la lámina");
  });
}
