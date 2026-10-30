/* Tests de las visitas (visitas.js, amigos.js, casa.js y store.js): lo que publicas de tu casa y tu vitrina,
   lo que llega de un amigo (solo lo que existe en la app) y quién puede visitar */
export default async function ({ G, test, assert, clone }) {
  console.log("\nVisitas");
  const defaultState = G("defaultState"), migrate = G("migrate"), ledgerRegistrar = G("ledgerRegistrar");
  const casaPublica = G("casaPublica"), vitrinaPublica = G("vitrinaPublica"), casaLimpia = G("visitaCasaLimpia"), vitrinaLimpia = G("visitaVitrinaLimpia");
  const estadoPublico = G("amigosEstadoPublico"), estadoLimpio = G("amigosEstadoLimpio");
  const LB = G("LocalBackend"), ls = G("localStorage");

  const s = migrate(defaultState());
  ledgerRegistrar(s, "insignia:primer-paso", 20, 20, "Insignia", new Date(2026, 9, 3, 21, 0).getTime());   // (recalcula lo comprado: va primero)
  s.gamif.xp = 4000; s.gamif.owned.push("cua-gato", "par-salvia", "cua-pecera");
  s.gamif.equipped.cuarto = { off: ["cua-pecera"], pared: "par-salvia", ts: 1 };
  ["primer-paso", "biblioteca-b"].forEach(id => s.gamif.badges.push(id));

  test("lo que publicas de tu casa: tu elefante, lo que hay puesto, la pared y la repisa", () => {
    const c = clone(casaPublica(s));
    assert.equal(c.ele.tipo, "clasico"); assert.ok(c.ele.etapa >= 0); assert.ok(["sueno", "feliz", "normal"].includes(c.ele.animo));
    assert.ok(c.cosas.includes("gato") && !c.cosas.includes("pecera"), "lo guardado no se muestra");
    assert.equal(c.pared, "par-salvia"); assert.deepEqual(c.repisa.slice().sort(), ["biblioteca-b", "primer-paso"]);
    assert.ok(JSON.stringify(c).length < 1000, "cabe de sobra en la base");
  });
  test("lo que publicas de tu vitrina: tus medallas y el día en que ganaste cada una", () => {
    const v = clone(vitrinaPublica(s));
    assert.deepEqual(v.medallas.slice().sort(), ["biblioteca-b", "primer-paso"]);
    assert.deepEqual(v.fechas, { "primer-paso": "2026-10-03" });
  });
  test("lo que llega de un amigo se limpia: solo tipos, prendas, cosas, paredes y medallas de la app", () => {
    const c = clone(casaLimpia({ ele: { tipo: "constructor", etapa: 99, ropa: { cabeza: "gorro", ojos: "gorro", pies: "<img>" }, animo: "<b>" },
      cosas: ["gato", "<script>", "planta", "gato"], pared: "cua-gato", repisa: ["primer-paso", "inventada", 5, "primer-paso"], libros: "999", rango: -3 }));
    assert.deepEqual(c.ele, { tipo: "clasico", etapa: 3, ropa: { cabeza: "gorro" }, animo: "normal" });
    assert.deepEqual(c.cosas, ["gato", "planta"]); assert.equal(c.pared, null); assert.equal(c.colores, null);
    assert.deepEqual(c.repisa, ["primer-paso"]); assert.equal(c.libros, 48); assert.equal(c.rango, 0);
    assert.deepEqual(clone(casaLimpia({ pared: "par-salvia" })).colores, ["#C6DAB9", "#B6CDA7"]);
    assert.equal(casaLimpia("nada"), null);
    const v = clone(vitrinaLimpia({ medallas: ["primer-paso", "falsa", "primer-paso"], fechas: { "primer-paso": "2026-10-03<x>", falsa: "2026-01-01", __proto__: "x" } }));
    assert.deepEqual(v, { medallas: ["primer-paso"], fechas: { "primer-paso": "2026-10-03" } });
  });
  test("tus amigos saben si pueden visitarte (y cuántas medallas tienes), solo si lo eliges", () => {
    const d = { fecha: "2026-11-04", casa: true, medallas: 9 };
    assert.deepEqual(clone(estadoPublico(d, { dia: false, racha: false, rango: false })), { fecha: "2026-11-04", casa: true, vitrina: true, medallas: 9 });
    assert.deepEqual(clone(estadoPublico(d, { dia: false, racha: false, rango: false, casa: false, vitrina: false })), { fecha: "2026-11-04" });
    assert.deepEqual(clone(estadoLimpio({ fecha: "2026-11-04", casa: "sí", vitrina: 1, medallas: "<b>99999" })), { fecha: "2026-11-04", casa: true, vitrina: true, medallas: 0 });
  });
  test("lo que hace su elefante sale de lo que hay en su cuarto (lo mismo que en tu casa)", () => {
    const ahora = new Date(2026, 10, 4, 12, 0);
    const tuyo = G("eleActividades")(s, ahora).map(a => [a.id, a.w]);
    const c = casaPublica(s), suyo = G("eleActividadesCon")({ cosas: c.cosas, medallas: c.repisa.length > 0, sueno: c.ele.animo === "sueno" }, ahora).map(a => [a.id, a.w]);
    assert.deepEqual(clone(suyo), clone(tuyo));
  });

  // Solo un amigo puede visitar (LocalBackend, como las reglas de perfiles en Supabase)
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana", casa: { cosas: ["gato"] }, vitrina: { medallas: ["primer-paso"] } });
  como("u_b"); await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  como("u_b"); const antes = await LB.amigosVisita("u_a"); await LB.amigosPedir(pa.codigo);
  como("u_a"); await LB.amigosResponder("u_b", true);
  como("u_b"); const amigo = await LB.amigosVisita("u_a");
  como("u_c"); const ajena = await LB.amigosVisita("u_a");
  test("solo tus amigos pueden visitarte", () => {
    assert.equal(antes.error, "no-amigos"); assert.equal(ajena.error, "no-amigos");
    assert.equal(amigo.nombre, "Ana"); assert.deepEqual(clone(amigo.casa), { cosas: ["gato"] }); assert.deepEqual(clone(amigo.vitrina), { medallas: ["primer-paso"] });
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");
}
