/* Tests de Google Calendar (gcal.js): eventos, migración y fusión */
export default async function ({ G, test, assert, clone }) {
  console.log("\nGoogle Calendar");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
  const gcalNormalizar = G("gcalNormalizar"), gcalAgrupar = G("gcalAgrupar");

  test("eventos: con hora, de día completo (varios días) y cancelados", () => {
    const a = gcalNormalizar({ id: "e1", summary: "Reunión con cliente", start: { dateTime: "2026-09-28T09:00:00" }, end: { dateTime: "2026-09-28T10:30:00" } }, "c1");
    assert.equal(a.length, 1);
    assert.equal(a[0].iso, "2026-09-28"); assert.equal(a[0].hora, "09:00"); assert.equal(a[0].horaFin, "10:30"); assert.equal(a[0].todoDia, false);
    const b = gcalNormalizar({ id: "e2", summary: "Vacaciones", start: { date: "2026-09-28" }, end: { date: "2026-10-01" } }, "c1");
    assert.equal(b.map(x => x.iso).join(), "2026-09-28,2026-09-29,2026-09-30");   // el fin es exclusivo
    assert.equal(b[0].todoDia, true);
    assert.equal(gcalNormalizar({ id: "e3", status: "cancelled", start: { date: "2026-09-28" } }, "c1").length, 0);
    assert.equal(gcalNormalizar({ id: "e4", start: { date: "2026-09-28" } }, "c1")[0].titulo, "(Sin título)");
    const dias = gcalAgrupar([...a, ...b, ...gcalNormalizar({ id: "e5", summary: "Almuerzo", start: { dateTime: "2026-09-28T13:00:00" }, end: { dateTime: "2026-09-28T14:00:00" } }, "c2")]);
    assert.equal(dias["2026-09-28"].map(x => x.titulo).join(), "Vacaciones,Reunión con cliente,Almuerzo");   // día completo primero, luego por hora
  });

  test("migración y fusión: settings.gcal por defecto; gana el cambio más reciente; versión antigua no lo borra", () => {
    const s = migrate(defaultState());
    assert.equal(s.settings.gcal.conectado, false);
    const viejo = migrate(defaultState()); delete viejo.settings.gcal;
    assert.equal(migrate(clone(viejo)).settings.gcal.calendarios, null);
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.settings.gcal = { conectado: true, calendarios: ["c1"], ts: 100 };
    b.settings.gcal = { conectado: true, calendarios: ["c1", "c2"], ts: 200 };
    assert.equal(mergeStates(clone(b), clone(a)).settings.gcal.calendarios.join(), "c1,c2");
    assert.equal(mergeStates(clone(a), clone(viejo)).settings.gcal.conectado, true);
    // nada de eventos ni permisos de Google en la cuenta
    assert.equal(JSON.stringify(mergeStates(clone(b), clone(a)).settings.gcal).includes("token"), false);
  });
}
