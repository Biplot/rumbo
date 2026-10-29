/* Tests de la casa del elefante (casa.js): lo que el cuarto gana con el rango, la repisa de medallas
   y lo que hace tu elefante en su cuarto (según lo que hay y la hora) */
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

  // Lo que se compra en la Tienda para el cuarto
  const ledgerComprar = G("ledgerComprar"), cuartoPuestas = G("cuartoPuestas"), cuartoPared = G("cuartoPared"), cuartoEq = G("cuartoEq"), guardarCuarto = G("guardarCuarto");
  const CUARTO = G("CUARTO_TIENDA");
  test("Tienda › Cuarto: ocho cosas y tres paredes, cada una con su precio y su lugar", () => {
    assert.equal(CUARTO.filter(it => it.cosa).length, 8);
    assert.equal(CUARTO.filter(it => it.pared).length, 3);
    assert.ok(CUARTO.every(it => it.costo > 0 && it.desc && (it.cosa ? !it.pared : it.pared.length === 2)));
    assert.equal(new Set(CUARTO.map(it => it.id)).size, CUARTO.length);
    assert.ok(G("findCosmetic")("cua-gato") === CUARTO.find(it => it.id === "cua-gato"));   // se compra como cualquier cosmético
  });

  test("lo comprado llega puesto; guardar lo saca del cuarto; la pared se pinta de a una", () => {
    const s = conXp(0); ledgerRegistrar(s, "pts", 3000, 0, "test");
    assert.equal(cuartoPuestas(s).length, 0); assert.equal(cuartoPared(s), null);
    assert.ok(ledgerComprar(s, "cua-pecera", 550).ok && ledgerComprar(s, "cua-gato", 900).ok);
    assert.equal(cuartoPuestas(s).join(","), "pecera,gato");
    guardarCuarto(s, { off: ["cua-gato"], pared: null });
    assert.equal(cuartoPuestas(s).join(","), "pecera");
    // Una pared que no compraste no se pinta (aunque esté elegida)
    guardarCuarto(s, { off: [], pared: "par-noche" });
    assert.equal(cuartoPared(s), null);
    assert.ok(ledgerComprar(s, "par-noche", 250).ok);
    assert.equal(cuartoPared(s).join(","), "#3A4766,#33405D");
    assert.equal(s.gamif.puntos, 3000 - 550 - 900 - 250);
    assert.ok(!ledgerComprar(s, "cua-gato", 900).ok);                                  // no se cobra dos veces
  });

  test("fusión: gana lo del cuarto cambiado más recientemente; un equipo sin cambios no lo borra", () => {
    const base = conXp(0);
    const A = clone(base), B = clone(base);
    A.gamif.equipped.cuarto = { off: ["cua-gato"], pared: "par-salvia", ts: 2000 };
    B.gamif.equipped.cuarto = { off: [], pared: null, ts: 1000 };
    assert.equal(cargar(A, B).gamif.equipped.cuarto.pared, "par-salvia");
    assert.equal(cargar(B, A).gamif.equipped.cuarto.off.join(","), "cua-gato");
    assert.equal(cargar(A, clone(base)).gamif.equipped.cuarto.pared, "par-salvia");
    assert.equal(cuartoEq(clone(base)).off.length, 0);                                // sin nada guardado: todo puesto
  });

  test("lo que hace tu elefante: depende de lo que hay en su cuarto y de la hora; lo de ahora dura 20 minutos", () => {
    const eleActividades = G("eleActividades"), eleActividadAhora = G("eleActividadAhora"), ledgerComprar = G("ledgerComprar");
    const tarde = new Date(2026, 9, 28, 15, 0), noche = new Date(2026, 9, 28, 22, 30);
    const ids = (s, d) => eleActividades(s, d).map(a => a.id);
    const s0 = conXp(0);
    assert.equal(ids(s0, tarde).join(","), "siesta,ventana,pasea,sentado,cola");            // Aprendiz, sin medallas ni compras
    const s = conXp(2500); ledgerRegistrar(s, "pts", 3000, 0, "test");                                  // con planta, reloj y biblioteca
    assert.ok(ids(s, tarde).includes("planta") && ids(s, tarde).includes("libros"));
    assert.ok(!ids(s, noche).includes("planta") && !ids(s, noche).includes("cola"), "de noche no riega ni persigue su cola");
    assert.equal(eleActividades(s, noche).find(a => a.id === "siesta").w, 8, "de noche duerme más");
    assert.ok(!ids(s, tarde).includes("gato"));
    assert.ok(ledgerComprar(s, "cua-gato", 900).ok); assert.ok(ids(s, tarde).includes("gato"), "con el gato, le hace cariño");
    s.gamif.equipped.cuarto = { off: ["cua-gato"], pared: null, ts: 1 }; assert.ok(!ids(s, tarde).includes("gato"), "si lo guardas, ya no");
    s.gamif.badges.push("primer-paso"); ledgerRegistrar(s, "insignia:primer-paso", 1, 1, "x");
    assert.ok(ids(s, tarde).includes("repisa"), "con medallas en la repisa, las admira");
    // lo de ahora: lo mismo durante 20 minutos, y a lo largo del día va cambiando
    assert.equal(eleActividadAhora(s, tarde).id, eleActividadAhora(s, new Date(2026, 9, 28, 15, 19, 59)).id);
    const dia = new Set(); for (let k = 0; k < 36; k++) dia.add(eleActividadAhora(s, new Date(2026, 9, 28, 8, k * 20)).id);
    assert.ok(dia.size >= 5, "en un día hace al menos 5 cosas distintas: " + [...dia].join(", "));
  });
}
