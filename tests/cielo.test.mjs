/* Tests del cielo de insignias (cielo.js): cada insignia en una constelación, su metal, su fecha y su avance */
export default async function ({ G, test, assert }) {
  console.log("\nCielo de insignias");
  const defaultState = G("defaultState"), migrate = G("migrate"), ledgerRegistrar = G("ledgerRegistrar");
  const BADGES = G("BADGES"), FAMS = G("CIELO_FAMILIAS"), cieloOrden = G("cieloOrden"), cieloInfo = G("cieloInfo"), findBadge = G("findBadge");

  test("las 56 insignias tienen su lugar: una sola familia cada una y figuras del tamaño justo", () => {
    const ids = FAMS.flatMap(f => f.ids);
    assert.equal(new Set(ids).size, ids.length);                            // ninguna en dos constelaciones
    ids.forEach(id => assert.ok(findBadge(id), "existe " + id));
    BADGES.forEach(b => assert.ok(ids.includes(b.id), "tiene familia " + b.id));
    assert.equal(cieloOrden().length, BADGES.length);
    // La cantidad de puntos de cada figura del cielo (cielo-3d.js): copa, brújula, elefante, sol, columna, medalla
    assert.equal(FAMS.map(f => f.ids.length).join(","), "4,6,13,10,5,14,4");
    assert.ok(FAMS.find(f => f.id === "secretas").ids.every(id => findBadge(id).secreta));
  });

  test("metal: las series por nivel, las secretas de obsidiana y el resto por lo que pagan", () => {
    const s = migrate(defaultState());
    const m = id => cieloInfo(id, s).metal;
    assert.equal(m("primer-paso"), "bronce"); assert.equal(m("inquebrantable"), "plata"); assert.equal(m("centenario"), "oro");
    assert.equal(m("elefante-domado"), "bronce"); assert.equal(m("alba-p"), "plata"); assert.equal(m("biblioteca-o"), "oro");
    assert.equal(m("ahorrador-b"), "bronce");                                 // paga 100 pero es el bronce de su serie
    assert.equal(m("anio-rumbo"), "oro"); assert.equal(m("buho"), "obsidiana");
    const ic = id => cieloInfo(id, s).ic;
    assert.equal(ic("enfocado-p"), "reloj"); assert.equal(ic("noche-serena-o"), "luna"); assert.equal(ic("embajador"), "flecha"); assert.equal(ic("cazador-sapos"), "elefante");
  });

  test("ficha: fecha del ledger al ganarla, avance de la serie y secretas ocultas", () => {
    const s = migrate(defaultState());
    const ts = new Date(2026, 1, 12, 21, 30).getTime();
    s.gamif.badges.push("primer-paso"); ledgerRegistrar(s, "insignia:primer-paso", 20, 20, "Insignia Primer Paso", ts);
    const a = cieloInfo("primer-paso", s);
    assert.equal(a.gano, true); assert.equal(a.fecha, "12 feb 2026"); assert.equal(a.avance, null);
    for (let d = 1; d <= 3; d++) { const iso = `2026-09-0${d}`; s.ritual.dias[iso] = { hecho: true, abiertoTs: new Date(2026, 8, d, 6, 30).getTime() }; }
    const alba = cieloInfo("alba-b", s);
    assert.equal(alba.gano, false); assert.equal(alba.nivel, 0); assert.equal(alba.nombreCorto, "Alba");
    assert.equal(alba.avance.txt, "3 de 10 veces"); assert.equal(alba.avance.pct, 30);
    assert.equal(cieloInfo("alba-o", s).avance.txt, "3 de 100 veces");
    assert.equal(cieloInfo("buho", s).oculta, true);
    assert.equal(cieloInfo("medio-camino", s).avance, null);                  // sin meta anual no hay porcentaje que mostrar
    s.gamif.badges.push("buho"); assert.equal(cieloInfo("buho", s).oculta, false); assert.equal(cieloInfo("buho", s).fecha, "");
  });
}
