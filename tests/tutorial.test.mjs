/* Tests del tutorial interactivo (tutorial.js): migración, fusión y misión Primeros pasos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTutorial");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const misionPasos = G("misionPasos"), misionCompleta = G("misionCompleta");

  test("migración: nuevos con misión activa; quienes ya usaban la app, oculta (idempotente)", () => {
    const nuevo = migrate(defaultState());
    assert.equal(nuevo.settings.tutorial.mision, "activa");
    assert.equal(nuevo.settings.tutorial.auto, true);
    const viejo = defaultState(); viejo.settings.onboarded = true; delete viejo.settings.tutorial;
    const m = migrate(clone(viejo));
    assert.equal(m.settings.tutorial.mision, "oculta");
    assert.equal(JSON.stringify(m.settings.tutorial.vistos), "{}");
    m.settings.tutorial.vistos.semana = 5;
    assert.equal(migrate(clone(m)).settings.tutorial.vistos.semana, 5);
  });

  test("fusión: recorridos vistos se suman; misión y ayuda automática por el cambio más reciente", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.settings.tutorial.vistos = { general: 10, semana: 20 };
    b.settings.tutorial.vistos = { habitos: 30, semana: 25 };
    a.settings.tutorial.mision = "oculta"; a.settings.tutorial.ts = 100;
    b.settings.tutorial.auto = false; b.settings.tutorial.ts = 200;
    const r = mergeStates(clone(b), clone(a));   // nube = B, local = A
    assert.equal(JSON.stringify(r.settings.tutorial.vistos), JSON.stringify({ general: 10, semana: 25, habitos: 30 }));
    assert.equal(r.settings.tutorial.auto, false);          // B cambió después
    assert.equal(r.settings.tutorial.mision, "activa");      // viene con el objeto de B
    // "volver a mostrar la ayuda" borra lo visto antes en todos los dispositivos
    a.settings.tutorial = { vistos: {}, mision: "activa", auto: true, ts: 300, reset: 300 };
    const r2 = mergeStates(clone(b), clone(a));
    assert.equal(JSON.stringify(r2.settings.tutorial.vistos), "{}");
    // un dispositivo con versión antigua (sin tutorial) no borra lo de la nube
    const viejo = migrate(defaultState()); delete viejo.settings.tutorial;
    const r3 = mergeStates(clone(r), clone(viejo));
    assert.equal(r3.settings.tutorial.vistos.habitos, 30);
    assert.equal(r3.settings.tutorial.auto, false);
  });

  test("misión: cada paso se marca con lo que la persona hace de verdad", () => {
    const s = migrate(defaultState());
    assert.equal(misionPasos(s).filter(m => m.ok).length, 0);
    s.ritual.dias["2026-09-26"] = { hecho: true, cerrado: true, ts: 1 };
    s.agenda.dias["2026-09-26"] = [{ id: "t", txt: "Lo importante", esSapo: true, estado: "hecha", ts: 1 }];
    const h = s.habitos.defs[0].id; s.habitos.log["2026-9"] = { [h]: { 26: true } };
    s.metas.mensuales[8].push({ id: "o", texto: "Lanzar la web" });
    assert.equal(misionCompleta(s), false);
    s.ritual.semanas = { "2026-09-21": { apertura: { foco: "Constancia", ts: 1 } } };
    assert.equal(misionPasos(s).map(m => m.ok).join(), "true,true,true,true,true,true");
    assert.equal(misionCompleta(s), true);
  });
}
