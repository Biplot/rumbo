/* Tests de Notas estilo post-it (notas.js + state.js): migración, etiquetas y fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nNotas estilo post-it");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates"), etiquetasDe = G("etiquetasDe");

  test("migración: las categorías pasan como etiqueta y la captura rápida como notas; idempotente y sin borrar lo de antes", () => {
    const v = defaultState(); delete v.postits;
    v.notas = [{ id: "c1", nombre: "Ideas de negocio", items: [{ id: "n1", titulo: "App de recetas", texto: "Con fotos" }] }];
    v.vida.ideas = [{ id: "i1", texto: "Llamar al contador", hecha: false }, { id: "i2", texto: "Comprar pilas", hecha: true }];
    const m = migrate(clone(v));
    assert.equal(m.postits.length, 3);
    const n = m.postits.find(x => x.id === "nota-n1");
    assert.equal(n.titulo, "App de recetas"); assert.equal(n.etiquetas.join(), "ideas-de-negocio");
    assert.equal(m.postits.find(x => x.id === "idea-i2").archivada, true);
    assert.equal(migrate(clone(m)).postits.length, 3);
    assert.equal(m.notas[0].items.length, 1); assert.equal(m.vida.ideas.length, 2);   // lo de antes sigue ahí
  });

  test("etiquetas: se leen del texto (#palabra), en minúscula y sin repetir", () => {
    assert.equal(etiquetasDe("Llamar #Trabajo y #casa, luego #trabajo").join(), "trabajo,casa");
    assert.equal(etiquetasDe("sin etiquetas").length, 0);
  });

  test("fusión: notas de dos equipos se unen por id; una nota borrada en uno no revive", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.postits = [{ id: "p1", texto: "hola", ts: 100, borrada: true }, { id: "p2", texto: "a", ts: 5 }];
    b.postits = [{ id: "p1", texto: "hola", ts: 50 }, { id: "p3", texto: "b", ts: 5 }];
    const m = mergeStates(clone(b), clone(a));
    assert.equal(m.postits.length, 3); assert.equal(m.postits.find(x => x.id === "p1").borrada, true);
  });
}
