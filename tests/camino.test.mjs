/* Tests del camino del año (camino.js): las medallas del año en orden, con su lugar en el sendero */
export default async function ({ G, test, assert }) {
  console.log("\nEl camino del año");
  const defaultState = G("defaultState"), migrate = G("migrate"), ledgerRegistrar = G("ledgerRegistrar");
  const medallasDelAnio = G("medallasDelAnio"), medallasDelTrimestre = G("medallasDelTrimestre");

  test("las medallas del año salen del ledger, en orden, con su lugar de enero a diciembre", () => {
    const s = migrate(defaultState());
    const gana = (id, f) => { s.gamif.badges.push(id); ledgerRegistrar(s, "insignia:" + id, 1, 1, "x", f.getTime()); };
    gana("semana-fuego", new Date(2026, 6, 2, 12));
    gana("primer-paso", new Date(2026, 0, 1, 12));
    gana("buho", new Date(2026, 11, 31, 23, 57));
    gana("madrugador", new Date(2025, 11, 20));                                   // del año anterior: no va en este camino
    ledgerRegistrar(s, "insignia:centurion", 1, 1, "x", new Date(2026, 3, 1).getTime());   // no está ganada de verdad
    const l = medallasDelAnio(s, 2026);
    assert.equal(l.map(m => m.id).join(","), "primer-paso,semana-fuego,buho");
    assert.ok(l[0].u > 0 && l[0].u < 0.01);                                       // el 1 de enero, al principio
    assert.ok(Math.abs(l[1].u - 0.5) < 0.01);                                     // a mitad de año, a mitad del sendero
    assert.ok(l[2].u > 0.99 && l[2].u < 1);                                       // el 31 de diciembre, en la cumbre
    assert.equal(medallasDelAnio(s, 2025).map(m => m.id).join(","), "madrugador");
    assert.equal(medallasDelTrimestre(s, 2026, 2).map(m => m.id).join(","), "semana-fuego");
    assert.equal(medallasDelTrimestre(s, 2026, 1).length, 0);
  });
}
