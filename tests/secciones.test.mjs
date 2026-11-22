/* Tests de Tus secciones y «Descubrir» (secciones.js, v154) */
export default async function ({ G, test, assert }) {
  console.log("\nTus secciones");
  const defaultState = G("defaultState"), migrate = G("migrate");
  const conDatos = G("seccionConDatos"), tuya = G("seccionTuya"), tuyas = G("seccionesTuyas"), desc = G("seccionesDescubrir");
  const agregar = G("seccionAgregar"), quitar = G("seccionQuitar"), mover = G("seccionMover");
  const viejo = () => { const S = migrate(defaultState()); S.settings.onboarded = true; return S; };

  test("una cuenta sin datos: Objetivos, Ritual, Diario y Amigos; lo demás espera en Descubrir", () => {
    const S = viejo();
    assert.equal(JSON.stringify(tuyas(S)), JSON.stringify(["metas", "ritual", "diario", "amigos"]));
    assert.equal(desc(S).length, 9, "Calendario ya no está en Más: vive dentro del Diario");
    assert.ok(desc(S).includes("finanzas") && desc(S).includes("tendencias") && !desc(S).includes("calendario"));
  });

  test("una sección aparece sola con su primer dato (en el año base o en otro año)", () => {
    const S = viejo();
    S.lecturas.push({ id: "l1", titulo: "Un libro" });
    S.vida.relaciones.push({ id: "r1", nombre: "Ana" });
    S.finanzas.meses[3].gasto = 1200;
    S.anios = { 2027: { rueda: { meses: [[0, 0, 0, 0, 0, 0, 0, 0], [0, 6, 0, 0, 0, 0, 0, 0]] } } };
    ["lecturas", "relaciones", "finanzas", "rueda"].forEach(id => assert.equal(conDatos(id, S), true, id));
    assert.equal(conDatos("salud", S), false);
    assert.ok(tuyas(S).includes("lecturas") && tuyas(S).includes("finanzas") && !tuyas(S).includes("salud"));
  });

  test("lo que no cuenta como dato: listas vacías, la lista de deseos migrada y la rutina de fábrica de Salud", () => {
    const S = viejo();
    S.vida.listas.push({ id: "a", nombre: "Compras", items: [] }, { id: "b", tipo: "deseos", items: [{ id: "x", txt: "Bici" }] });
    assert.equal(conDatos("listas", S), false);
    assert.equal(conDatos("salud", S), false, "entrenamiento.dias de fábrica no cuenta; registro sí");
    S.entrenamiento.registro.push({ id: "e1", fecha: "2026-11-02" });
    assert.equal(conDatos("salud", S), true);
  });

  test("Tendencias, con una semana de días cerrados; Calendario, con un evento o Google conectado", () => {
    const S = viejo();
    for (let d = 1; d <= 6; d++) S.ritual.dias["2026-11-0" + d] = { hecho: true, cerrado: true, ts: 1 };
    assert.equal(conDatos("tendencias", S), false);
    S.ritual.dias["2026-11-07"] = { hecho: true, cerrado: true, ts: 1 };
    assert.equal(conDatos("tendencias", S), true);
    assert.equal(conDatos("calendario", S), false);
    S.settings.gcal.conectado = true;
    assert.equal(conDatos("calendario", S), true);
  });

  test("«+» la agrega aunque no tenga datos; «Quitar» la manda a Descubrir aunque tenga, sin borrar nada", () => {
    const S = viejo();
    assert.equal(agregar("notas", S), true);
    assert.ok(tuya("notas", S) && S.settings.menu.fijadas.includes("notas"));
    S.lecturas.push({ id: "l1", titulo: "Un libro" });
    assert.equal(quitar("lecturas", S), true);
    assert.equal(tuya("lecturas", S), false);
    assert.equal(S.lecturas.length, 1, "los datos siguen ahí");
    assert.equal(agregar("lecturas", S), true, "y vuelve con «+»");
    assert.equal(quitar("amigos", S), true, "Amigos ahora se puede ocultar");
    assert.ok(desc(S).includes("amigos"));
    assert.equal(quitar("ritual", S), false, "Objetivos, Ritual y Diario siempre están");
  });

  test("ordenar: el orden se guarda y lo nuevo va al final", () => {
    const S = viejo();
    assert.equal(mover("diario", -1, S), true);
    assert.equal(JSON.stringify(tuyas(S)), JSON.stringify(["metas", "diario", "ritual", "amigos"]));
    assert.equal(mover("metas", -1, S), false, "la primera no sube");
    S.lecturas.push({ id: "l1", titulo: "Un libro" });
    assert.equal(tuyas(S).slice(-1)[0], "lecturas");
  });

  test("lo de la cuenta de antes: un módulo oculto con Personalizar sigue oculto aunque tenga datos", () => {
    const S = viejo();
    S.settings.menu = { ocultos: ["lecturas"] };
    S.lecturas.push({ id: "l1", titulo: "Un libro" });
    assert.equal(tuya("lecturas", S), false);
  });
}
