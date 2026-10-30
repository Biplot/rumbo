/* Tests de avatares (avatares.js): la manada, desbloqueos, compras, fusión, colores de antes y dibujo */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAvatares");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates"), ledgerRegistrar = G("ledgerRegistrar"), ledgerComprar = G("ledgerComprar");
  const cat = G("avataresCatalogo"), tiene = G("avatarTiene"), revisar = G("revisarAvatares"), svg = G("avatarSVG");

  test("catálogo: 11 de la manada y 8 de Rumbo; el Pudú, el Cóndor y los gratis desde el inicio", () => {
    const c = cat();
    assert.equal(c.filter(a => a.grupo === "manada").length, 11);
    assert.equal(c.filter(a => a.grupo === "elenco").length, 0);
    const nombres = Object.fromEntries(c.map(a => [a.id, a.n]));
    assert.deepEqual(["lupe", "architect", "celda", "engine", "grilla", "bucle", "tamandua", "faro", "pepa", "atlas", "plotty"].map(id => nombres[id]),
      ["Zorra", "Castor", "Hormiga", "Abeja", "Camaleón", "Tortuga", "Tamandúa", "Llama", "Ardilla", "Cóndor", "Pudú"]);
    assert.equal(c.some(a => a.placa), false);
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
    // Estilo Norte: sin el contorno negro ni los colores de BiPlot
    cat().forEach(a => { const x = svg(a.id, s); assert.ok(!x.includes("#0B1726") && !x.includes("#17C3B2") && !/stroke="#0B1726"/.test(x), a.id); });
  });

  test("creador: fondo índigo suave por defecto y cada fondo de la paleta", () => {
    const s = migrate(defaultState()), A = G("AVATAR_ARTE");
    s.gamif.equipped.avatar = { id: "propio", propio: null, ts: 1 };
    assert.equal(G("avPropio")(s).fondo, "indigo");
    assert.ok(svg(null, s).includes(A.F.indigo));
    assert.equal(A.FONDOS.length, 7);
    A.FONDOS.forEach(f => { s.gamif.equipped.avatar.propio = { fondo: f }; assert.ok(svg(null, s).includes(A.F[f]), f); });
    s.gamif.equipped.avatar.propio = { fondo: "marino" };
    assert.ok(svg(null, s).includes(A.F.indigo), "un fondo desconocido vuelve al índigo suave");
  });

  test("creador: lo que armaste antes pasa a su par en la paleta nueva", () => {
    const s = migrate(defaultState()), A = G("AVATAR_ARTE");
    s.gamif.equipped.avatar = { id: "propio", propio: { piel: "#C68A5E", pelo: "largo", colPelo: "#17C3B2", lentes: "sol", barba: "no", ropa: "#0D6B57", animo: "normal" }, ts: 1 };
    const o = clone(G("avPropio")(s));
    assert.equal(o.piel, A.PIELES[2]); assert.equal(o.colPelo, A.COL_PELO[6]); assert.equal(o.ropa, A.ROPA[2]);
    assert.equal(o.pelo, "largo"); assert.equal(o.lentes, "sol"); assert.equal(o.fondo, "indigo");
    assert.equal(A.alDia({ piel: "#F2C2B0" }).piel, A.PIELES[0], "la piel rosada pasa a la más clara");
    // Todos los colores de antes tienen par
    ["#F6D2B8", "#E0A77D", "#C68A5E", "#9C6444", "#6B412B"].forEach((c, i) => assert.equal(A.alDia({ piel: c }).piel, A.PIELES[i], c));
    ["#2A1E17", "#6B4A36", "#C9924E", "#E3C27A", "#B33A2E", "#DDE3EA", "#17C3B2", "#2E5E9E"].forEach((c, i) => assert.equal(A.alDia({ colPelo: c }).colPelo, A.COL_PELO[i], c));
    ["#17446F", "#2B2F36", "#0D6B57", "#FF6B4A", "#E8DFC8", "#6B4BD6"].forEach((c, i) => assert.equal(A.alDia({ ropa: c }).ropa, A.ROPA[i], c));
    const x = svg(null, s);
    assert.ok(x.includes(A.PIELES[2]) && !x.includes("#C68A5E"), "se dibuja con la piel nueva");
  });
}
