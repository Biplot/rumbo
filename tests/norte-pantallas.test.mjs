/* Tests de 🧭 Norte, tu brújula: lo que «hoy» trae para las pantallas del robot (notifier/norte.mjs):
   cómo fue cada día de la semana, los últimos siete días de tus hábitos de hoy y tu agua como la ves en Rumbo
   (vaso, botella, estilo y sabor puestos si los compraste, temperatura y último vaso). sumar_agua con tu botella se
   prueba en tests/norte.test.mjs, con su cliente falso de Supabase. */
export default async function ({ test, assert }) {
  console.log("\nNorte, tu brújula: las pantallas del robot");
  const { resumenDia } = await import("../notifier/norte.mjs");
  const HOY = "2026-11-19", LUNES = "2026-11-16";   // jueves; la semana va del lunes 16 al domingo 22
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" } },
    habitos: {
      defs: [
        { id: "h1", nombre: "Meditar 🧘", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h2", nombre: "Correr", frecuencia: { tipo: "dias", dias: [0, 2, 4] }, creado: "2026-01-01" },   // lunes, miércoles y viernes
        { id: "h3", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-11-17" },
        { id: "h4", nombre: "Pausado", frecuencia: { tipo: "diario" }, creado: "2026-01-01", pausado: true },
      ],
      log: { "2026-11": { h1: { 13: true, 14: true, 16: true, 17: true, 18: true, 19: true }, h2: { 14: true }, h3: { 18: true } } },
    },
    ritual: { dias: {
      "2026-11-16": { hecho: true, cerrado: true }, "2026-11-17": { hecho: true, cerrado: true }, "2026-11-18": { hecho: true }, [HOY]: { hecho: true },
    } },
    agenda: { dias: {} },
    agua: { meta: 2000, vaso: 250, botella: 750, clima: { on: true, ciudad: "Santiago" }, dias: { [HOY]: { c: 29, r: [{ id: "a1", ml: 250, ts: 1000 }, { id: "a2", ml: 250, ts: 3000 }, { id: "a3", ml: 250, ts: 9000 }], b: ["a3"] } } },
    gamif: { equipped: { agua: "esclusa", sabor: "frutilla" }, owned: ["agua-esclusa"] },
  });
  const sinBandeja = { norte: [], agua: [] };

  test("semana.dias: cómo fue cada día de lunes a domingo (cerrado, abierto, sin abrir o todavía no llega)", () => {
    const s = resumenDia(estado(), sinBandeja, HOY).semana;
    assert.equal(s.desde, LUNES);
    assert.deepEqual(s.dias, ["cerrado", "cerrado", "abierto", "abierto", null, null, null]);
    const sinAbrir = estado(); delete sinAbrir.ritual.dias[HOY];
    assert.deepEqual(resumenDia(sinAbrir, sinBandeja, HOY).semana.dias.slice(0, 4), ["cerrado", "cerrado", "abierto", "nada"]);
  });

  test("habitos_semana: los últimos siete días de tus hábitos de hoy (h hecho, x faltó, - no tocaba, p hoy)", () => {
    const hs = resumenDia(estado(), sinBandeja, HOY).habitos_semana;
    // del jueves 13 al jueves 19: Meditar los hizo todos menos el sábado 15
    assert.deepEqual(hs.map(h => h.nombre), ["Meditar", "Leer"], "solo los de hoy (Correr no toca el jueves; el pausado no va), sin emojis");
    assert.equal(hs[0].dias, "hhxhhhh");
    assert.equal(hs[1].dias, "----xhp", "antes de crearlo no cuenta; el martes faltó, el miércoles lo hizo y hoy falta");
  });

  test("habitos_semana: el hábito marcado por voz (en la bandeja) ya sale hecho hoy", () => {
    const bandeja = { norte: [{ id: "n1", tipo: "habito", datos: { hid: "h3", fecha: HOY }, creado: "2026-11-19T15:00:00Z" }], agua: [] };
    const hs = resumenDia(estado(), bandeja, HOY).habitos_semana;
    assert.equal(hs.find(h => h.nombre === "Leer").dias.slice(-1), "h");
  });

  test("agua: tu vaso, tu botella, el estilo y el sabor puestos (si los compraste), la temperatura y el último vaso", () => {
    const a = resumenDia(estado(), sinBandeja, HOY).agua;
    assert.deepEqual(a, { ml: 500, meta_ml: 2500, vaso: 250, botella: 750, estilo: "esclusa", sabor: "natural", temp: 29, ultimo: 3000 },
      "la frutilla no está comprada: natural; el vaso borrado no cuenta; con 29 °C la meta sube medio litro");
    const conBandeja = resumenDia(estado(), { norte: [], agua: [{ id: "v1", fecha: HOY, ml: 300, ts: 5000 }] }, HOY).agua;
    assert.deepEqual([conBandeja.ml, conBandeja.ultimo], [800, 5000], "el vaso que espera en la bandeja cuenta");
    const vacio = resumenDia({}, sinBandeja, HOY).agua;
    assert.deepEqual([vacio.vaso, vacio.botella, vacio.estilo, vacio.sabor, vacio.temp, vacio.ultimo], [250, 500, "botella", "natural", null, null], "cuenta nueva");
    const raro = estado(); raro.gamif.equipped.agua = "inventado"; raro.agua.clima.on = false;
    const r = resumenDia(raro, sinBandeja, HOY).agua;
    assert.deepEqual([r.estilo, r.temp], ["botella", null], "un estilo que no existe vuelve a la botella; sin clima no hay temperatura");
  });
}
