/* Tests de avatares (avatares.js): catálogo sin Aby, desbloqueos, compras, fusión y dibujo */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAvatares");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates"), ledgerRegistrar = G("ledgerRegistrar"), ledgerComprar = G("ledgerComprar");
  const cat = G("avataresCatalogo"), tiene = G("avatarTiene"), revisar = G("revisarAvatares"), svg = G("avatarSVG");

  test("catálogo: 11 del elenco (sin Aby) y 8 de Rumbo; Plotty, Atlas y los gratis desde el inicio", () => {
    const c = cat();
    assert.equal(c.filter(a => a.grupo === "elenco").length, 11);
    assert.equal(c.filter(a => a.grupo === "rumbo").length, 8);
    assert.equal(c.some(a => a.id === "aby" || /aby/i.test(a.n)), false);
    const s = migrate(defaultState());
    ["plotty", "atlas", "brujula", "elefante", "brote", "propio"].forEach(id => assert.equal(tiene(id, s), true, id));
    ["lupe", "faro", "buho", "montana"].forEach(id => assert.equal(tiene(id, s), false, id));
  });

  test("migración: equipped.avatar por defecto; estado viejo sin avatar no se rompe", () => {
    const v = defaultState(); delete v.gamif.equipped.avatar;
    const m = migrate(clone(v));
    assert.equal(m.gamif.equipped.avatar.id, null);
  });

  test("se gana con su logro y queda aunque baje la métrica (Faro: 30 días seguidos)", () => {
    const s = migrate(defaultState());
    for (let d = 1; d <= 30; d++) s.ritual.dias[`2026-06-${String(d).padStart(2, "0")}`] = { hecho: true, cerrado: true };
    assert.ok(clone(revisar(s)).includes("faro"));
    s.ritual.dias = {};
    assert.equal(tiene("faro", s), true);
    assert.equal(revisar(s).includes("faro"), false);
  });

  test("Grilla al cambiar de tema; Engine con 5 recurrentes; Cumbre con 4.000 XP", () => {
    const s = migrate(defaultState());
    s.settings.theme = "sakura";
    for (let i = 0; i < 5; i++) G("crearRecurrente")(s, { txt: "r" + i, ambito: "per", regla: { tipo: "diaria" }, desde: "2026-09-01" });
    ledgerRegistrar(s, "xp", 0, 4000, "t");
    const n = clone(revisar(s));
    ["grilla", "engine", "montana"].forEach(id => assert.ok(n.includes(id), id));
  });

  test("comprar: los de la Tienda con su precio; fusión del avatar por el cambio más reciente", () => {
    const s = migrate(defaultState()); ledgerRegistrar(s, "saldo", 500, 0, "t");
    assert.equal(ledgerComprar(s, "av-cohete", 300).ok, true);
    assert.equal(tiene("cohete", s), true);
    const a = clone(s), b = clone(s);
    a.gamif.equipped.avatar = { id: "cohete", propio: null, ts: 10 };
    b.gamif.equipped.avatar = { id: "propio", propio: { pelo: "rulos" }, ts: 20 };
    assert.equal(mergeStates(clone(a), clone(b)).gamif.equipped.avatar.id, "propio");
    const viejo = clone(a); delete viejo.gamif.equipped.avatar;
    assert.equal(mergeStates(clone(a), clone(viejo)).gamif.equipped.avatar.id, "cohete");
  });

  test("dibujo: todos los avatares y el propio con cada peinado", () => {
    const s = migrate(defaultState());
    cat().filter(a => a.id !== "elefante").forEach(a => { const x = svg(a.id, s); assert.ok(x && x.startsWith("<svg") && !x.includes("undefined"), a.id); });
    ["corto", "largo", "moño", "rulos", "rapado", "calvo"].forEach(p => { s.gamif.equipped.avatar = { id: "propio", propio: { pelo: p, lentes: "redondos", barba: "si" }, ts: 1 }; assert.ok(svg(null, s).includes("</svg>"), p); });
  });
}
