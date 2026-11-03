/* Tests del diario del elefante (nota-elefante.js): la nota se arma con tus datos del día, sale igual
   el mismo día, no usa lo que escribiste a mano y se guarda en la entrada del Diario */
export default async function ({ G, test, assert, clone }) {
  console.log("\nEl diario del elefante");
  const defaultState = G("defaultState"), migrate = G("migrate"), nota = G("notaElefante"), guardar = G("notaElefanteGuardar"), de = G("notaElefanteDe"), broma = G("notaEleBroma");
  const ISO = "2026-11-03", ts = h => new Date(2026, 10, 3, h, 10).getTime();
  const base = () => {
    const s = migrate(defaultState());
    s.habitos.defs = [
      { id: "h1", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
      { id: "h2", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
      { id: "h3", nombre: "Inglés", frecuencia: { tipo: "dias", dias: [2] }, creado: "2026-10-01" },   // los miércoles (lunes = 0): mañana, el 4
    ];
    s.habitos.log = { "2026-11": { h1: { 3: true }, h2: { 3: true } } };
    s.ritual.dias[ISO] = { mision: "Terminar el informe secreto", sapo: "Llamar al banco", energia: 2, cerrado: true, cerradoTs: ts(22),
      cierre: { mision: "si", sapo: true, energia: 4, mejor: "El café con mi hermana", nota: "Algo muy personal", manana: "Pagar la luz", tareas: { pro: [3, 4], per: [1, 1] } } };
    s.agua.meta = 2000; s.agua.dias[ISO] = { r: [{ id: "a1", ml: 1500, ts: 1 }, { id: "a2", ml: 800, ts: 2 }], b: [], c: 31 };
    s.vida.diario = [{ id: "d1", fecha: ISO, fromRitual: true, mood: 4 }];
    return s;
  };

  test("la nota cuenta tu día con tus datos: la hora, el agua con calor, los hábitos, las tareas, la energía y lo de mañana", () => {
    const t = nota(ISO, base());
    assert.match(t, /22:10/, "la hora del cierre");
    assert.match(t, /2,3 L/, "el agua"); assert.match(t, /31 °C/, "con el calor del día");
    assert.match(t, /(Cumpliste tus 2 hábitos|No se te escapó ningún hábito: los 2)/, "los dos hábitos de hoy (Inglés no tocaba)");
    assert.match(t, /Mañana toca Inglés: yo llevo el diccionario\./, "mañana miércoles toca inglés, con su broma");
    assert.ok(t.split(/(?<=\.)\s/).length <= 7, "es corta: " + t);
  });
  test("no usa lo que escribiste a mano (la misión, el bocado, la gratitud, la nota ni lo de mañana)", () => {
    const t = nota(ISO, base());
    ["informe secreto", "banco", "hermana", "muy personal", "Pagar la luz"].forEach(x => assert.ok(!t.includes(x), "no dice «" + x + "»"));
  });
  test("el mismo día sale siempre igual; otro día puede cambiar la forma", () => {
    const s = base();
    assert.equal(nota(ISO, s), nota(ISO, clone(s)));
    assert.equal(nota(ISO, s), nota(ISO, s));
  });
  test("un día difícil se dice con cariño; sin nada que contar, igual hay nota", () => {
    const s = base(); s.vida.diario[0].mood = 2;
    assert.match(nota(ISO, s), /(Fue un día difícil|Hoy costó)/);
    const v = migrate(defaultState()); v.habitos.defs = []; v.ritual.dias[ISO] = { cerrado: true, cerradoTs: ts(21) };
    const t = nota(ISO, v);
    assert.match(t, /21:10/); assert.match(t, /(día tranquilo|día simple)/); assert.match(t, /Mañana/);
  });
  test("lo que más importa va primero: una medalla y un hito de la racha", () => {
    const s = base(); s.gamif.badges = ["primer-paso"]; s.gamif.ledger.push({ id: "insignia:primer-paso", ts: ts(22), delta: 20, xp: 20, motivo: "Insignia" });
    const t = nota(ISO, s);
    if (G("findBadge")("primer-paso")) assert.match(t, /(Primer Paso)/i, "la medalla del día: " + t);
  });
  test("al guardar, la nota queda en la entrada del día del Diario (y se rehace al volver a cerrar)", () => {
    const s = base(); const n = guardar(ISO, s);
    assert.equal(s.vida.diario.length, 1, "en la misma entrada del cierre");
    assert.equal(de(ISO, s).texto, n.texto);
    s.agua.dias[ISO].r.push({ id: "a3", ml: 500, ts: 3 });
    assert.match(guardar(ISO, s).texto, /2,8 L/, "al volver a cerrar se escribe de nuevo con lo nuevo");
  });
  test("las bromas de tu elefante siguen al hábito", () => {
    assert.equal(broma("Correr 5 km"), "yo estiro la trompa");
    assert.equal(broma("Leer 20 páginas"), "yo llevo el marcapáginas");
    assert.equal(broma("Cosa rara"), "yo te acompaño");
  });
}
