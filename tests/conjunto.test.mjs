/* Tests de los hábitos en conjunto (conjunto.js, habitos-motor.js y store.js): la racha de a dos,
   lo que llega de otros (se limpia) y las reglas de la base local (las de supabase/conjunto.sql) */
export default async function ({ G, test, assert, clone }) {
  console.log("\nHábitos en conjunto");
  // iconos.js vive con el DOM: aquí basta con saber qué emojis tienen dibujo
  if (G("typeof iconoDeEmoji") === "undefined") G(`var iconoDeEmoji = e => ({ "📖": ["book-open", "Libro"], "🏃": ["footprints", "Correr"] })[String(e || "").replace(/\\uFE0F/g, "")] || null`);
  const limpio = G("cjLimpio"), racha = G("hmRachaConjunto"), todos = G("hmTodosConjunto"), hmFreq = G("hmFreq");
  const LB = G("LocalBackend"), ls = G("localStorage");
  const conHoy = (iso, fn) => { G(`HM_HOY = ${JSON.stringify(iso)}`); try { return fn(); } finally { G("HM_HOY = null"); } };
  const dias = (desde, n) => Array.from({ length: n }, (_, i) => G(`hmAdd(${JSON.stringify(desde)}, ${i})`));

  test("lo que llega del servidor se limpia: ícono del catálogo, nombre corto, frecuencia válida y fechas", () => {
    const c = clone(limpio({ id: "x1", nombre: "  " + "L".repeat(80), icono: '"><img src=x onerror=alert(1)>', frecuencia: { tipo: "dias", dias: "<b>" }, creado: "2026-11-01<x>", estado: "raro", invita: "u_a",
      miembros: [{ id: "u_a", nombre: "Ana", estado: "activo", desde: "2026-11-01", marcas: ["2026-11-01", "mal", 5] }, { id: "u_b", yo: true, estado: "activo" }] }));
    assert.equal(c.icon, "✅"); assert.equal(c.nombre.length, 60); assert.deepEqual(c.frecuencia, { tipo: "diario" });
    assert.equal(c.creado, "2026-11-01"); assert.equal(c.estado, "invitado");
    assert.deepEqual(c.miembros[0].marcas, ["2026-11-01"]); assert.equal(c.miembros[1].yo, true); assert.equal(c.miembros[1].desde, "");
    assert.equal(limpio({ icono: "📖", frecuencia: { tipo: "semanal", veces: 99 } }).icon, "📖");
    assert.deepEqual(clone(limpio({ frecuencia: { tipo: "semanal", veces: 99 } }).frecuencia), { tipo: "semanal", veces: 6 });
    assert.deepEqual(clone(hmFreq({ frecuencia: { tipo: "dias", dias: [1, 1, "2", 9, 1.5] } })), { tipo: "dias", dias: [1, 2] });
  });

  test("racha de a dos (diario): días seguidos en que cumplieron los dos; hoy, si falta alguien, no corta", () => {
    const def = { frecuencia: { tipo: "diario" }, creado: "2026-10-20" };
    const ana = { desde: "2026-10-20", marcas: dias("2026-10-28", 8) }, bruno = { desde: "2026-10-20", marcas: dias("2026-10-28", 7) };   // Bruno aún no marca hoy (4-nov)
    assert.deepEqual(clone(conHoy("2026-11-04", () => racha(def, [ana, bruno]))), { n: 7, unidad: "días" });
    bruno.marcas.push("2026-11-04");
    assert.equal(conHoy("2026-11-04", () => racha(def, [ana, bruno])).n, 8);
    bruno.marcas = bruno.marcas.filter(d => d !== "2026-11-01");   // un día que Bruno no cumplió corta la racha
    assert.equal(conHoy("2026-11-04", () => racha(def, [ana, bruno])).n, 3);
    assert.equal(conHoy("2026-11-04", () => racha(def, [ana])).n, 0, "sola no hay racha de a dos");
  });

  test("racha: quien llega después cuenta desde que se unió; semanal por semanas cumplidas", () => {
    const def = { frecuencia: { tipo: "diario" }, creado: "2026-10-01" };
    const ana = { desde: "2026-10-01", marcas: dias("2026-10-01", 35) }, cami = { desde: "2026-11-02", marcas: dias("2026-11-02", 3) };
    assert.equal(conHoy("2026-11-04", () => racha(def, [ana, cami])).n, 3);
    const sem = { frecuencia: { tipo: "semanal", veces: 2 }, creado: "2026-10-12" };   // lunes 12 de octubre
    const a = { desde: "2026-10-12", marcas: ["2026-10-13", "2026-10-15", "2026-10-20", "2026-10-22", "2026-10-27", "2026-10-29", "2026-11-03"] };
    const b = { desde: "2026-10-12", marcas: ["2026-10-14", "2026-10-16", "2026-10-21", "2026-10-23", "2026-10-28", "2026-10-30"] };
    assert.deepEqual(clone(conHoy("2026-11-04", () => racha(sem, [a, b]))), { n: 3, unidad: "sem" }, "la semana en curso todavía no suma ni corta");
    b.marcas.push("2026-11-04"); a.marcas.push("2026-11-05");
    assert.equal(conHoy("2026-11-05", () => racha(sem, [a, b])).n, 3, "con uno solo en la semana, aún no");
    b.marcas.push("2026-11-05");
    assert.equal(conHoy("2026-11-05", () => racha(sem, [a, b])).n, 4);
  });

  test("¿lo hicieron todos ese día? (los que ya estaban, y al menos dos)", () => {
    const ms = [{ desde: "2026-11-01", marcas: ["2026-11-04"] }, { desde: "2026-11-01", marcas: ["2026-11-04"] }, { desde: "2026-11-05", marcas: [] }];
    assert.equal(todos(ms, "2026-11-04"), true);
    assert.equal(todos(ms, "2026-11-03"), false);
    assert.equal(todos(ms.slice(0, 1), "2026-11-04"), false);
    assert.equal(todos(ms, "2026-11-05"), false, "desde el 5 también está Cami, que no marcó");
  });

  // La base local (pruebas y modo sin servidor), con las reglas de supabase/conjunto.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  const hoy = G("todayISO()"), ayer = G(`hmAdd(${JSON.stringify(hoy)}, -1)`), hace9 = G(`hmAdd(${JSON.stringify(hoy)}, -9)`);
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  como("u_b"); const pb = await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  como("u_b"); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder("u_b", true);
  const r = {}, D = { tipo: "diario" };
  como("u_a");
  r.sinAmigos = await LB.conjuntoCrear("Leer", "📖", D, [], hoy);
  r.noAmiga = await LB.conjuntoCrear("Leer", "📖", D, ["u_c"], hoy);
  r.sinNombre = await LB.conjuntoCrear("  ", "📖", D, ["u_b"], hoy);
  r.crea = await LB.conjuntoCrear(" Leer 20 minutos ", "📖", D, ["u_b", "u_b", "u_a"], "1999-01-01");
  const L = r.crea.id;
  r.listaA = await LB.conjuntoLista();
  como("u_b"); r.listaB = await LB.conjuntoLista(); r.marcaAntes = await LB.conjuntoMarcar(L, hoy, true);
  r.une = await LB.conjuntoResponder(L, true, hoy); r.une2 = await LB.conjuntoResponder(L, true, hoy);
  r.lejos = await LB.conjuntoMarcar(L, hace9, true); r.antes = await LB.conjuntoMarcar(L, ayer, true);
  como("u_a"); r.a1 = await LB.conjuntoMarcar(L, hoy, true);
  como("u_b"); r.b1 = await LB.conjuntoMarcar(L, hoy, true);
  como("u_a"); r.a0 = await LB.conjuntoMarcar(L, hoy, false); await LB.conjuntoMarcar(L, hoy, true);
  como("u_c"); r.editaC = await LB.conjuntoEditar(L, "hack", "", D); r.listaC = await LB.conjuntoLista();
  como("u_b"); r.edita = await LB.conjuntoEditar(L, "Leer 30 minutos", "📖", { tipo: "semanal", veces: 4 });
  como("u_a"); r.listaA2 = await LB.conjuntoLista();
  como("u_b"); await LB.amigosBloquear("u_a"); r.trasBloqueo = await LB.conjuntoLista();
  como("u_a"); r.listaA3 = await LB.conjuntoLista(); r.sale = await LB.conjuntoSalir(L); r.listaA4 = await LB.conjuntoLista();
  r.db = clone(LB._amDb());

  test("base local: crear necesita amigos tuyos y un nombre; el día lo pone el teléfono si es cercano", () => {
    assert.equal(r.sinAmigos.error, "amigos"); assert.equal(r.noAmiga.error, "no-amigos"); assert.equal(r.sinNombre.error, "nombre");
    assert.ok(L);
    const h = r.listaA[0];
    assert.equal(h.nombre, "Leer 20 minutos"); assert.equal(h.creado, hoy); assert.equal(h.estado, "activo");
    assert.deepEqual(h.miembros.map(m => [m.nombre, m.estado, m.yo]), [["Ana", "activo", true], ["Bruno", "invitado", false]]);
    assert.equal(r.listaB[0].estado, "invitado"); assert.equal(r.listaB[0].invita, "u_a");
  });
  test("base local: unirse, marcar solo la última semana desde que te uniste, y si lo hicieron todos", () => {
    assert.equal(r.marcaAntes.error, "no-miembro");
    assert.equal(r.une.habito.nombre, "Leer 20 minutos"); assert.equal(r.une.habito.desde, hoy); assert.equal(r.une2.habito, null);
    assert.equal(r.lejos.error, "fecha"); assert.equal(r.antes.error, "fecha");
    assert.equal(r.a1.todos, false); assert.equal(r.b1.todos, true); assert.equal(r.a0.todos, false);
  });
  test("base local: solo quien está lo edita, y el cambio es para todos", () => {
    assert.equal(r.editaC.error, "no-miembro"); assert.equal(r.listaC.length, 0);
    assert.equal(r.edita.r, "editado");
    assert.equal(r.listaA2[0].nombre, "Leer 30 minutos"); assert.equal(r.listaA2[0].frecuencia.veces, 4);
    assert.deepEqual(r.listaA2[0].miembros.map(m => m.marcas), [[hoy], [hoy]]);
  });
  test("base local: bloquear te saca de lo que compartían; si no queda nadie, el hábito se borra", () => {
    assert.equal(r.trasBloqueo.length, 0);
    assert.equal(r.listaA3[0].miembros.length, 1);
    assert.equal(r.sale.r, "salio"); assert.equal(r.listaA4.length, 0);
    assert.equal(r.db.conjuntos.length, 0); assert.equal(r.db.cmiembros.length, 0); assert.equal(r.db.cmarcas.length, 0);
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");
}
