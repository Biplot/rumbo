/* Tests de logros (logros.js): insignias con niveles, secretas, títulos con requisito y el elefante */
export default async function ({ G, test, assert }) {
  console.log("\nLogros · insignias y elefante");
  const defaultState = G("defaultState"), migrate = G("migrate"), nuevaTarea = G("nuevaTarea"), marcarTarea = G("marcarTarea");
  const BADGES = G("BADGES"), etapaElefante = G("etapaElefante");
  const lg_alba = G("lg_alba"), lg_buho = G("lg_buho"), lg_remontada = G("lg_remontada"), lg_delegadas = G("lg_delegadas"), lg_anioConRumbo = G("lg_anioConRumbo");
  const T = (iso, h, m) => new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime();

  test("registro: series con 3 niveles, secretas y Elefante Domado conserva su id de bronce", () => {
    const ids = BADGES.map(b => b.id);
    assert.equal(new Set(ids).size, ids.length);                                 // sin ids repetidos
    ["alba-b", "alba-p", "alba-o", "elefante-domado", "elefante-domado-p", "elefante-domado-o", "centenario", "buho", "remontada"].forEach(id => assert.ok(ids.includes(id), id));
    assert.equal(ids.includes("elefante-domado-b"), false);
    assert.equal(BADGES.filter(b => b.secreta).length, 4);
    assert.ok(BADGES.length >= 20 + 16 + 21 - 1);                                 // 20 de antes + 16 logros + 7 series × 3 − el bronce que ya existía
  });

  test("horarios: Alba cuenta aperturas antes de las 7:00 del mismo día; Búho, cierres 23:55–23:59", () => {
    const s = migrate(defaultState());
    s.ritual.dias["2026-09-01"] = { hecho: true, abiertoTs: T("2026-09-01", 6, 40) };
    s.ritual.dias["2026-09-02"] = { hecho: true, abiertoTs: T("2026-09-02", 7, 5) };
    s.ritual.dias["2026-09-03"] = { hecho: true, abiertoTs: T("2026-09-04", 6, 0) };   // abierto otro día: no cuenta
    assert.equal(lg_alba(s), 1);
    assert.equal(lg_buho(s), false);
    s.ritual.dias["2026-09-05"] = { hecho: true, cerrado: true, cerradoTs: T("2026-09-05", 23, 57) };
    assert.equal(lg_buho(s), true);
  });

  test("tareas: delegadas se cuentan; Remontada pide volver a 7 días tras perder una racha", () => {
    const s = migrate(defaultState());
    for (let i = 0; i < 3; i++) marcarTarea(nuevaTarea(s, "2026-09-10", { txt: "d" + i, ambito: "pro" }), "delegada", { delegadaA: "Ana" });
    assert.equal(lg_delegadas(s), 3);
    const cerrar = (d0, n) => { for (let i = 0; i < n; i++) { const d = new Date(2026, 7, d0 + i); s.ritual.dias[`2026-08-${String(d.getDate()).padStart(2, "0")}`] = { hecho: true, cerrado: true }; } };
    cerrar(1, 4); cerrar(8, 6);
    assert.equal(lg_remontada(s), false);
    s.ritual.dias["2026-08-14"] = { hecho: true, cerrado: true };
    assert.equal(lg_remontada(s), true);
  });

  test("Año con Rumbo: los 4 trimestres de un año cerrados", () => {
    const s = migrate(defaultState());
    [1, 2, 3].forEach(q => { s.ritual.trimestres[`2026-Q${q}`] = { cierre: { nota: 8 } }; });
    assert.equal(lg_anioConRumbo(s), false);
    s.ritual.trimestres["2026-Q4"] = { cierre: { nota: 9 } };
    assert.equal(lg_anioConRumbo(s), true);
  });

  test("elefante: etapas por XP (nunca retrocede porque la XP no baja)", () => {
    assert.equal(etapaElefante(0).etapa.nombre, "Cría");
    assert.equal(etapaElefante(900).etapa.nombre, "Joven");
    assert.equal(etapaElefante(4500).sig.nombre, "Sabio");
    assert.equal(etapaElefante(12000).etapa.corona, true);
  });
}
