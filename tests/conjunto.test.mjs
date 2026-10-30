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

  /* -------- Avisos al celular (notifier/conjunto.mjs) -------- */
  const { avisoConjunto, destinatariosMarca, mensajeConjunto } = await import("../notifier/conjunto.mjs");
  const { rachaConjunto } = await import("../notifier/habitos.mjs");

  test("el servidor cuenta la racha igual que la app (el mismo motor)", () => {
    const def = { frecuencia: { tipo: "diario" }, creado: "2026-10-20" };
    const ms = [{ desde: "2026-10-20", marcas: dias("2026-10-25", 11) }, { desde: "2026-10-22", marcas: dias("2026-10-27", 9) }];
    assert.deepEqual(rachaConjunto(def, ms, "2026-11-04"), clone(conHoy("2026-11-04", () => racha(def, ms))));
    assert.equal(rachaConjunto(def, ms, "2026-11-04").n, 9);
    assert.equal(rachaConjunto({ frecuencia: { tipo: "dias", dias: "roto" }, creado: "2026-10-20" }, ms, "2026-11-04").n, 9, "una frecuencia rota se lee como diaria");
  });

  test("al marcar: «ya lo hizo» a los que faltan; «lo hicieron todos» a los demás; una vez por día", () => {
    const M = (user_id, avisos = {}) => ({ user_id, estado: "activo", desde: "2026-11-01", avisos });
    const ms = [M("a"), M("b"), M("c", { marca: "2026-11-04" }), { user_id: "d", estado: "invitado" }, { user_id: "e", estado: "activo", desde: "2026-11-05" }];
    assert.deepEqual(destinatariosMarca({ miembros: ms, marcas: [{ user_id: "a", fecha: "2026-11-04" }], yo: "a", fecha: "2026-11-04" }), { tipo: "marca", para: ["b"] });
    const todas = ["a", "b", "c"].map(u => ({ user_id: u, fecha: "2026-11-04" }));
    assert.deepEqual(destinatariosMarca({ miembros: ms, marcas: todas, yo: "c", fecha: "2026-11-04" }), { tipo: "todos", para: ["a", "b"] });
    assert.deepEqual(destinatariosMarca({ miembros: [M("a"), M("b", { todos: "2026-11-04" })], marcas: todas, yo: "a", fecha: "2026-11-04" }), { tipo: "todos", para: [] });
    assert.equal(destinatariosMarca({ miembros: [M("a")], marcas: todas, yo: "a", fecha: "2026-11-04" }).tipo, "marca", "solo, no hay «todos»");
  });

  test("los textos: invitación, se sumó, ya cumplió y lo hicieron todos (con la racha)", () => {
    assert.deepEqual(mensajeConjunto("conjunto-invita", { nombre: "Ana", habito: "Leer" }), { title: "Ana te invita a un hábito", body: "«Leer», para hacerlo juntos en Rumbo.", url: "./#amigos", tag: "rumbo-conjunto-invita" });
    assert.equal(mensajeConjunto("conjunto-acepta", { nombre: "Bruno", habito: "Leer" }).title, "Bruno se sumó a «Leer»");
    assert.equal(mensajeConjunto("marca", { nombre: "Ana", habito: "Leer" }).body, "Te toca: si lo haces hoy, lo cumplen los dos.");
    assert.equal(mensajeConjunto("marca", { nombre: " ", habito: "Correr", grupo: true }).title, "Un amigo ya cumplió «Correr» hoy");
    assert.equal(mensajeConjunto("todos", { habito: "Leer", racha: { n: 7, unidad: "días" } }).body, "Racha de a dos: 7 días. +5 ⭐ para cada uno.");
    assert.equal(mensajeConjunto("todos", { habito: "Correr", racha: { n: 3, unidad: "sem" }, grupo: true }).body, "Racha del grupo: 3 semanas. +5 ⭐ para cada uno.");
    assert.equal(mensajeConjunto("todos", { habito: "Leer", racha: { n: 1, unidad: "días" } }).body, "+5 ⭐ para cada uno.");
    assert.equal(mensajeConjunto("otro", {}), null);
  });

  /* Supabase de mentira: tablas en memoria con select/eq/gte/lte/update/maybeSingle */
  function sbFalso(tablas) {
    const cambios = [];
    return {
      cambios,
      from(t) {
        const filtros = []; let upd = null, cols = "";
        const correr = () => {
          const rs = (tablas[t] || []).filter(r => filtros.every(f => f(r)));
          if (upd) { rs.forEach(r => Object.assign(r, clone(upd))); cambios.push([t, rs.map(r => r.user_id), clone(upd)]); return rs; }
          if (cols.includes("notif:data->settings->notif")) return rs.map(r => ({ notif: ((r.data || {}).settings || {}).notif ?? null }));
          return rs;
        };
        const q = {
          select(c) { cols = c; return q; }, update(o) { upd = o; return q; },
          eq(k, v) { filtros.push(r => r[k] === v); return q; }, gte(k, v) { filtros.push(r => r[k] >= v); return q; }, lte(k, v) { filtros.push(r => r[k] <= v); return q; },
          async maybeSingle() { return { data: correr()[0] || null, error: null }; },
          then(ok, ko) { return Promise.resolve({ data: correr(), error: null }).then(ok, ko); },
        };
        return q;
      },
    };
  }
  const H = "11111111-2222-3333-4444-555555555555", A = "aaaaaaaa-0000-0000-0000-000000000000", B = "bbbbbbbb-0000-0000-0000-000000000000", C = "cccccccc-0000-0000-0000-000000000000";
  const base = () => ({
    habitos_conjunto: [{ id: H, nombre: "Leer 20 minutos", frecuencia: { tipo: "diario" }, creado: "2026-11-01" }],
    habitos_conjunto_miembros: [
      { habito: H, user_id: A, estado: "activo", invita: null, desde: "2026-11-01", avisos: {} },
      { habito: H, user_id: B, estado: "activo", invita: A, desde: "2026-11-01", avisos: {} },
      { habito: H, user_id: C, estado: "invitado", invita: A, desde: null, avisos: {} },
    ],
    habitos_conjunto_marcas: [],
    perfiles: [{ user_id: A, nombre: "Ana" }, { user_id: B, nombre: "Bruno" }, { user_id: C, nombre: "Cami" }],
    estado_usuario: [{ user_id: A, data: { settings: { notif: {} } } }, { user_id: B, data: { settings: { notif: {} } } }, { user_id: C, data: { settings: { notif: { avisos: { amigos: false } } } } }],
    suscripciones_push: [A, B, C].map((u, i) => ({ id: i, user_id: u, endpoint: "https://push/" + u, p256dh: "k", auth: "a" })),
  });
  const MEDIODIA = new Date("2026-11-04T15:00:00Z"), NOCHE = new Date("2026-11-05T02:00:00Z");   // 12:00 y 23:00 en Santiago
  const enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds.map(d => d.user_id), msg.title, msg.body]); return { enviadas: ds.length }; };
  const t1 = base(), sb1 = sbFalso(t1);
  r.av = {};
  r.av.ajeno = await avisoConjunto({ sb: sb1, yo: C, body: { tipo: "conjunto-invita", habito: H }, enviar, ahora: MEDIODIA });
  r.av.invita = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-invita", habito: H }, enviar, ahora: MEDIODIA });
  t1.estado_usuario[2].data.settings.notif = {};
  r.av.invita2 = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-invita", habito: H }, enviar, ahora: MEDIODIA });
  r.av.invita3 = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-invita", habito: H }, enviar, ahora: MEDIODIA });
  r.av.acepta = await avisoConjunto({ sb: sb1, yo: B, body: { tipo: "conjunto-acepta", habito: H }, enviar, ahora: MEDIODIA });
  r.av.acepta2 = await avisoConjunto({ sb: sb1, yo: B, body: { tipo: "conjunto-acepta", habito: H }, enviar, ahora: MEDIODIA });
  r.av.sinMarca = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-marca", habito: H, fecha: "2026-11-04" }, enviar, ahora: MEDIODIA });
  ["2026-11-02", "2026-11-03", "2026-11-04"].forEach(fecha => t1.habitos_conjunto_marcas.push({ habito: H, user_id: A, fecha }));
  ["2026-11-02", "2026-11-03"].forEach(fecha => t1.habitos_conjunto_marcas.push({ habito: H, user_id: B, fecha }));
  r.av.deNoche = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-marca", habito: H, fecha: "2026-11-04" }, enviar, ahora: NOCHE });
  r.av.marca = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-marca", habito: H, fecha: "2026-11-04" }, enviar, ahora: MEDIODIA });
  r.av.marca2 = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-marca", habito: H, fecha: "2026-11-04" }, enviar, ahora: MEDIODIA });
  t1.habitos_conjunto_marcas.push({ habito: H, user_id: B, fecha: "2026-11-04" });
  r.av.todos = await avisoConjunto({ sb: sb1, yo: B, body: { tipo: "conjunto-marca", habito: H, fecha: "2026-11-04" }, enviar, ahora: MEDIODIA });
  r.av.malo = await avisoConjunto({ sb: sb1, yo: A, body: { tipo: "conjunto-marca", habito: "'; drop", fecha: "x" }, enviar, ahora: MEDIODIA });

  test("aviso de invitación: solo de quien invitó, a quien tiene encendido «Amigos», y una vez", () => {
    assert.equal(r.av.ajeno.motivo, "no-corresponde", "un invitado no manda avisos");
    assert.equal(r.av.invita.enviadas, 0, "Cami tiene apagado «Amigos»: no se le avisa (ni queda anotado)");
    assert.equal(r.av.invita2.enviadas, 1); assert.equal(r.av.invita3.motivo, "nadie");
    assert.deepEqual(enviados[0], [[C], "Ana te invita a un hábito", "«Leer 20 minutos», para hacerlo juntos en Rumbo."]);
  });
  test("aviso al sumarse: a quien lo invitó, una vez", () => {
    assert.equal(r.av.acepta.enviadas, 1); assert.equal(r.av.acepta2.motivo, "ya-avisado");
    assert.deepEqual(enviados[1], [[A], "Bruno se sumó a «Leer 20 minutos»", "Ya lo hacen juntos: cada uno lo marca en su Rumbo."]);
  });
  test("aviso al marcar: solo si marcó de verdad, nunca de noche, «ya cumplió» una vez y «lo hicieron todos» con la racha", () => {
    assert.equal(r.av.sinMarca.motivo, "no-corresponde");
    assert.equal(r.av.deNoche.enviadas, 0);
    assert.equal(r.av.marca.enviadas, 1); assert.equal(r.av.marca2.motivo, "nadie");
    assert.deepEqual(enviados[2], [[B], "Ana ya cumplió «Leer 20 minutos» hoy", "Te toca: si lo haces hoy, lo cumplen los dos."]);
    assert.equal(r.av.todos.enviadas, 1);
    assert.deepEqual(enviados[3], [[A], "¡Lo hicieron todos! «Leer 20 minutos»", "Racha de a dos: 3 días. +5 ⭐ para cada uno."]);
    assert.equal(r.av.malo.motivo, "no-valido");
    assert.equal(enviados.length, 4);
  });
}
