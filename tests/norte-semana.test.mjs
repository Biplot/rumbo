/* Tests de 🧭 Norte, tu brújula para Norte-Desk: tu semana en «hoy» (notifier/norte.mjs): el foco, las prioridades,
   el premio y los hábitos en foco del ritual semanal de la app (STATE.ritual.semanas, js/ritual-semana.js) */
export default async function ({ test, assert }) {
  console.log("\nNorte, tu brújula: tu semana en «hoy» (Norte-Desk)");
  const { resumenDia } = await import("../notifier/norte.mjs");
  const HOY = "2026-11-11", LUNES = "2026-11-09";   // miércoles; la semana va del lunes 9 al domingo 15
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" } },
    habitos: { defs: [{ id: "h1", nombre: "Meditar 🧘", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }, { id: "h2", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }], log: {} },
    ritual: { dias: {}, semanas: {
      [LUNES]: {
        plan: { premio: "Ir al cine", ts: 1 },
        apertura: { foco: "Lanzar Norte-Desk", habitosFoco: ["h1", "borrado"], ts: 1, prioridades: [
          { id: "p1", texto: "Publicar la 0.12", ambito: "pro", dia: "2026-11-10" },
          { id: "p2", texto: "Probar en el PC", ambito: "pro", dia: HOY },
          { id: "p3", texto: "Llamar a la abuela", ambito: "per", dia: "2026-11-13" },
        ] },
      },
      "2026-11-02": { plan: { premio: "De la semana pasada" }, apertura: { foco: "Otra", prioridades: [{ id: "px", texto: "Vieja" }] } },
    } },
    agenda: { dias: {
      "2026-11-10": [{ id: "tp1", txt: "Publicar la 0.12", ambito: "pro", estado: "hecha", done: true, prioridad: "p1" }],
      [HOY]: [{ id: "tp2", txt: "Probar en el PC", ambito: "pro", estado: "pendiente", prioridad: "p2" }],
      "2026-11-13": [{ id: "tp3", txt: "Llamar a la abuela", ambito: "per", estado: "pendiente", prioridad: "p3" }],
    } },
    agua: { meta: 2000, dias: {} },
  });
  const sinBandeja = { norte: [], agua: [] };

  test("hoy trae tu semana: el foco, las prioridades (cuáles ya hiciste), el premio y los hábitos en foco", () => {
    const s = resumenDia(estado(), sinBandeja, HOY).semana;
    assert.deepEqual([s.desde, s.hasta, s.planificada, s.foco, s.premio], [LUNES, "2026-11-15", true, "Lanzar Norte-Desk", "Ir al cine"]);
    assert.deepEqual(s.prioridades.map(p => [p.id, p.texto, p.ambito, p.dia, p.hecha]), [
      ["p1", "Publicar la 0.12", "pro", "2026-11-10", true],
      ["p2", "Probar en el PC", "pro", HOY, false],
      ["p3", "Llamar a la abuela", "per", "2026-11-13", false],
    ]);
    assert.deepEqual(s.habitos_foco, ["Meditar"], "por su nombre, sin emojis; el que ya no existe no aparece");
  });
  test("una prioridad completada por Norte (en la bandeja) ya cuenta como hecha", () => {
    const b = { norte: [{ id: "q00000001", tipo: "tarea_hecha", datos: { tid: "tp2", fecha: HOY }, creado: HOY + "T15:00:00Z" }], agua: [] };
    assert.equal(resumenDia(estado(), b, HOY).semana.prioridades[1].hecha, true);
  });
  test("el domingo sigue siendo la misma semana; el lunes empieza otra (sin plan todavía)", () => {
    assert.equal(resumenDia(estado(), sinBandeja, "2026-11-15").semana.foco, "Lanzar Norte-Desk");
    const s = resumenDia(estado(), sinBandeja, "2026-11-16").semana;
    assert.deepEqual([s.desde, s.planificada, s.foco, s.premio, s.prioridades, s.habitos_foco], ["2026-11-16", false, null, null, [], []]);
  });
  test("sin ritual semanal (o con datos raros) no falla", () => {
    const s = resumenDia({}, sinBandeja, HOY).semana;
    assert.deepEqual([s.planificada, s.prioridades], [false, []]);
    const raro = estado(); raro.ritual.semanas[LUNES].apertura = { prioridades: "no", habitosFoco: null };
    assert.deepEqual(resumenDia(raro, sinBandeja, HOY).semana.prioridades, []);
  });
}
