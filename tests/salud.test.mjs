/* Tests de Salud (salud.js + state.js): recetario, registro de entrenamientos, migración y fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nSalud: recetas y entrenar");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");

  test("migración: recetas y registro vacíos por defecto; la receta del mes pasa al recetario una vez", () => {
    const s = migrate(defaultState());
    assert.equal(Array.isArray(s.recetas) && Array.isArray(s.entrenamiento.registro), true);
    const v = defaultState(); delete v.recetas; delete v.entrenamiento.registro;
    v.salud.meses[3].recetaNombre = "Lentejas"; v.salud.meses[3].recetaHecha = true;
    const m = migrate(clone(v));
    assert.equal(m.recetas.length, 1); assert.equal(m.recetas[0].nombre, "Lentejas"); assert.equal(m.recetas[0].favorita, true);
    assert.equal(migrate(clone(m)).recetas.length, 1);                      // idempotente
    assert.equal(m.salud.meses[3].diasCocina, v.salud.meses[3].diasCocina);   // la comida se conserva
  });

  test("fusión: recetas y entrenamientos de dos equipos se unen por id; gana lo más reciente", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    const base = { id: "r1", nombre: "Pasta", ts: 100 };
    a.recetas = [{ ...base, nombre: "Pasta al pesto", ts: 200 }, { id: "r2", nombre: "Tortilla", ts: 50 }];
    b.recetas = [base, { id: "r3", nombre: "Cazuela", ts: 70 }];
    a.entrenamiento.registro = [{ id: "2026-09-21:d1", fecha: "2026-09-21", diaId: "d1", ts: 1 }];
    b.entrenamiento.registro = [{ id: "2026-09-22:d2", fecha: "2026-09-22", diaId: "d2", ts: 2 }];
    const m = mergeStates(clone(b), clone(a));
    assert.equal(m.recetas.map(r => r.nombre).sort().join(), "Cazuela,Pasta al pesto,Tortilla");
    assert.equal(m.entrenamiento.registro.length, 2);
  });
}
