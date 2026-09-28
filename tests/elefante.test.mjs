/* Tests del elefante vectorial (elefante.js): migración, fusión, desbloqueos, ropa y dibujo */
export default async function ({ G, test, assert, clone }) {
  console.log("\nTu elefante");
  const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates"), ledgerRegistrar = G("ledgerRegistrar"), ledgerComprar = G("ledgerComprar");
  const TIPOS = G("TIPOS_ELEFANTE"), PRENDAS = G("PRENDAS_ELEFANTE"), elefanteSVG = G("elefanteSVG");
  const revisar = G("revisarElefantes"), desbloqueado = G("tipoDesbloqueado"), ropaPuesta = G("ropaPuesta"), mejorRacha = G("eleMejorRacha"), etapaElefante = G("etapaElefante");

  test("migración: los accesorios de antes pasan a su espacio, sin cobrar de nuevo; idempotente", () => {
    const s = defaultState(); delete s.gamif.equipped.ele;
    s.gamif.equipped.acc = ["acc-gorro", "acc-lentes"];
    ledgerRegistrar(s, "saldo", 1000, 0, "t"); ledgerComprar(s, "acc-gorro", 150); ledgerComprar(s, "acc-lentes", 250);
    const m = migrate(clone(s));
    assert.equal(m.gamif.equipped.ele.ropa.cabeza, "gorro");
    assert.equal(m.gamif.equipped.ele.ropa.ojos, "sol");
    assert.equal(m.gamif.equipped.ele.tipo, null);
    assert.equal(ropaPuesta(m).cabeza, "gorro");
    assert.equal(m.gamif.puntos, 600);
    assert.equal(JSON.stringify(migrate(clone(m)).gamif.equipped.ele), JSON.stringify(m.gamif.equipped.ele));
  });

  test("fusión: gana el elefante cambiado más recientemente; una versión antigua no lo borra", () => {
    const a = migrate(defaultState()), b = migrate(defaultState());
    a.gamif.equipped.ele = { tipo: "clasico", ropa: { cabeza: "gorro" }, ts: 100 };
    b.gamif.equipped.ele = { tipo: "asiatico", ropa: {}, ts: 200 };
    assert.equal(mergeStates(clone(b), clone(a)).gamif.equipped.ele.tipo, "asiatico");
    assert.equal(mergeStates(clone(a), clone(b)).gamif.equipped.ele.tipo, "asiatico");
    const viejo = clone(a); delete viejo.gamif.equipped.ele;
    assert.equal(mergeStates(clone(a), clone(viejo)).gamif.equipped.ele.tipo, "clasico");
  });

  test("desbloqueos: Clásico y Asiático al empezar; el Mamut con 100 días cerrados y queda aunque bajen", () => {
    const s = migrate(defaultState());
    assert.equal(desbloqueado("clasico", s) && desbloqueado("asiatico", s), true);
    assert.equal(desbloqueado("mamut", s), false);
    for (let i = 0; i < 100; i++) { const d = new Date(2026, 0, 1 + i * 2); s.ritual.dias[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`] = { hecho: true, cerrado: true }; }
    assert.deepEqual(clone(revisar(s)), ["mamut"]);
    assert.equal(desbloqueado("mamut", s), true);
    assert.equal(revisar(s).length, 0);   // no se repite
    s.ritual.dias = {};
    assert.equal(desbloqueado("mamut", s), true);
  });

  test("Peluche: mejor racha histórica; Tinta: días con gratitud", () => {
    const s = migrate(defaultState());
    for (let d = 1; d <= 30; d++) s.ritual.dias[`2026-04-${String(d).padStart(2, "0")}`] = { hecho: true, cerrado: true };
    assert.equal(mejorRacha(s), 30);
    for (let d = 1; d <= 30; d++) s.vida.diario.push({ id: "g" + d, fecha: `2026-05-${String(d).padStart(2, "0")}`, gratitud: d % 2 ? "Mi familia" : "  " });
    assert.equal(TIPOS.tinta.metrica(s), 15);
    assert.deepEqual(clone(revisar(s)).sort(), ["peluche"]);
  });

  test("ropa: una prenda ganada solo se ve si se cumple su condición", () => {
    const s = migrate(defaultState());
    s.gamif.equipped.ele.ropa = { cabeza: "corona", cuello: "bufanda" };
    assert.equal(ropaPuesta(s).cabeza, undefined);
    assert.equal(ropaPuesta(s).cuello, undefined);   // la bufanda no está comprada
    ledgerRegistrar(s, "xp", 0, 12000, "t");
    assert.equal(ropaPuesta(s).cabeza, "corona");
  });

  test("dibujo: los 6 tipos en las 4 etapas y 3 ánimos, con toda la ropa", () => {
    const todo = {}; PRENDAS.forEach(p => { if (!todo[p.slot] && p.id !== "capa") todo[p.slot] = p.id; });
    Object.keys(TIPOS).forEach(t => [0, 1, 2, 3].forEach(e => ["normal", "feliz", "sueno"].forEach(animo => {
      const svg = elefanteSVG({ tipo: t, etapa: e, animo, ropa: todo });
      assert.ok(svg.startsWith("<svg") && svg.includes("</svg>") && !svg.includes("undefined"), `${t} ${e} ${animo}`);
    })));
    assert.equal(etapaElefante(4000).etapa.n, "Adulto");
  });
}
