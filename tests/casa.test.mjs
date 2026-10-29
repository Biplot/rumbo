/* Tests de la casa del elefante (casa.js): lo que el cuarto gana con el rango y la repisa de medallas */
export default async function ({ G, test, assert, clone, cargar }) {
  console.log("\nLa casa del elefante");
  const defaultState = G("defaultState"), migrate = G("migrate"), ledgerRegistrar = G("ledgerRegistrar");
  const casaCosas = G("casaCosas"), casaProxima = G("casaProxima"), repisaAuto = G("repisaAuto"), repisaIds = G("repisaIds"), guardarRepisa = G("guardarRepisa");
  const conXp = xp => { const s = migrate(defaultState()); ledgerRegistrar(s, "xp", 0, xp, "test"); return s; };

  test("el cuarto se llena con el rango: nada extra de Aprendiz, todo en Alto Valor", () => {
    assert.equal(casaCosas(conXp(0)).length, 0);
    assert.equal(casaProxima(conXp(0)).id, "planta");
    assert.equal(casaCosas(conXp(2500)).join(","), "planta,reloj,biblioteca");      // Imparable
    assert.equal(casaProxima(conXp(2500)).id, "alcancia");
    assert.equal(casaCosas(conXp(12000)).length, 6);
    assert.equal(casaProxima(conXp(12000)), null);
  });

  test("repisa automática: oro primero y las más nuevas, una por serie, la destacada adelante y hasta 5", () => {
    const s = migrate(defaultState());
    const gana = (id, dias) => { s.gamif.badges.push(id); ledgerRegistrar(s, "insignia:" + id, 1, 1, "x", new Date(2026, 9, 1 + dias).getTime()); };
    gana("primer-paso", 0); gana("semana-fuego", 1); gana("inquebrantable", 2); gana("explorador", 3);
    gana("elefante-domado", 4); gana("elefante-domado-p", 5); gana("anio-rumbo", 6); gana("buho", 7);
    const a = repisaAuto(s);
    assert.equal(a.length, 5);
    assert.equal(a[0], "anio-rumbo"); assert.equal(a[1], "buho");                     // oro, luego obsidiana
    assert.ok(a.includes("elefante-domado-p") && !a.includes("elefante-domado"));      // de la serie, solo su mejor nivel
    s.gamif.equipped.insignia = "primer-paso";
    assert.equal(repisaAuto(s)[0], "primer-paso");
    // Elegida a mano: respeta el orden y quita las que ya no tienes
    guardarRepisa(s, ["semana-fuego", "centenario", "buho"]);
    assert.equal(repisaIds(s).join(","), "semana-fuego,buho");
    guardarRepisa(s, null);
    assert.equal(repisaIds(s)[0], "primer-paso");                                     // «que elija sola» vuelve a la automática
  });

  test("fusión: gana la repisa elegida más recientemente; un equipo sin repisa no la borra", () => {
    const base = migrate(defaultState()); base.gamif.badges.push("primer-paso", "buho");
    const A = clone(base), B = clone(base);
    A.gamif.equipped.repisa = { ids: ["buho"], auto: false, ts: 2000 };
    B.gamif.equipped.repisa = { ids: ["primer-paso"], auto: false, ts: 1000 };
    assert.equal(cargar(A, B).gamif.equipped.repisa.ids.join(","), "buho");           // la nube es más nueva
    assert.equal(cargar(B, A).gamif.equipped.repisa.ids.join(","), "buho");           // la local es más nueva
    assert.equal(cargar(A, clone(base)).gamif.equipped.repisa.ids.join(","), "buho");
  });
}
