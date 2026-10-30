/* Tests de las listas compartidas (listas-amigos.js, store.js y notifier/listas.mjs): lo que llega de otros (se limpia),
   el orden (lo que más quieren arriba), las reglas de la base local, «Elegir para un plan» y los avisos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nListas compartidas");
  if (G("typeof icoUI") === "undefined") G(`var icoUI = n => "<svg data-i='" + n + "'></svg>"`);
  const limpio = G("lcLimpio"), porVer = G("lcPorVer"), vistas = G("lcVistas"), quienTxt = G("lcQuienTxt"), promedio = G("lcPromedio");
  const LB = G("LocalBackend"), ls = G("localStorage");
  const hoy = G("todayISO()");

  const base = () => limpio({
    id: "l1", nombre: " Películas por ver ", tipo: "peliculas", estado: "activo", invita: "",
    miembros: [{ id: "a", nombre: "Ana", estado: "activo" }, { id: "b", yo: true, nombre: "Bruno", estado: "activo" }, { id: "c", nombre: "Cami", estado: "activo" }],
    items: [
      { id: 1, user_id: "b", nombre: "Bruno", texto: "Perfect Days", nota: "en MUBI", mas_uno: ["c"] },
      { id: 2, user_id: "a", nombre: "Ana", texto: "Past Lives", mas_uno: ["b", "c"] },
      { id: 3, user_id: "c", nombre: "Cami", texto: "Dune 2", visto: "2026-11-01", visto_por: "a", estrellas: [{ id: "a", n: 4 }, { id: "b", n: 5 }] },
      { id: 4, user_id: "", nombre: "", texto: "La sociedad de la nieve", visto: "2026-11-03", estrellas: [] },
    ],
  });

  test("lo que llega del servidor se limpia: textos cortos, tipo conocido, estrellas de 1 a 5", () => {
    const l = clone(limpio({ id: "x", nombre: "<b>" + "N".repeat(90), tipo: "musica", estado: "raro",
      items: [{ id: "7<x>", texto: "T".repeat(120), nota: "N".repeat(120), visto: "mal", mas_uno: ["u", 5], estrellas: [{ id: "u", n: 9 }, { id: "v", n: "x" }] }, { id: 0, texto: "sin id" }] }));
    assert.equal(l.nombre.length, 60); assert.equal(l.tipo, "otra"); assert.equal(l.estado, "invitado");
    assert.equal(l.items.length, 1); assert.equal(l.items[0].id, 7); assert.equal(l.items[0].texto.length, 80); assert.equal(l.items[0].nota.length, 80);
    assert.equal(l.items[0].visto, ""); assert.deepEqual(l.items[0].mas_uno, ["u", "5"]); assert.deepEqual(l.items[0].estrellas.map(e => e.n), [5, 1]);
  });
  test("por ver: lo que más quieren arriba; lo visto, de lo último a lo primero, con su promedio", () => {
    const l = base();
    assert.deepEqual(clone(porVer(l).map(i => i.texto)), ["Past Lives", "Perfect Days"]);
    assert.deepEqual(clone(vistas(l).map(i => i.texto)), ["La sociedad de la nieve", "Dune 2"]);
    assert.equal(promedio(l.items[2]), 4.5); assert.equal(promedio(l.items[3]), 0);
  });
  test("quién la agregó y quién también quiere (y la nota)", () => {
    const l = base();
    assert.equal(quienTxt(l, l.items[0]), "agregaste tú · Cami +1 · en MUBI");
    assert.equal(quienTxt(l, l.items[1]), "agregó Ana · tú y Cami +1");
    assert.equal(quienTxt(l, l.items[3]), "agregó Alguien");
  });

  // La base local (pruebas y modo sin servidor), con las reglas de supabase/listas.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  como("u_b"); await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  for (const u of ["u_b", "u_c"]) { como(u); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder(u, true); }
  const r = {};
  como("u_a");
  r.sinAmigos = await LB.listaCrear("Pelis", "peliculas", []);
  r.tipoMalo = await LB.listaCrear("Pelis", "musica", ["u_b"]);
  r.crea = await LB.listaCrear(" Películas por ver ", "peliculas", ["u_b", "u_b", "u_a"]);
  const L = r.crea.id;
  como("u_b"); r.antes = await LB.listaAgregar(L, "Past Lives", ""); r.une = await LB.listaResponder(L, true);
  r.vacio = await LB.listaAgregar(L, "   ", "");
  r.b1 = await LB.listaAgregar(L, " Past Lives ", "");
  como("u_a"); r.a1 = await LB.listaAgregar(L, "Perfect Days", "");
  r.borraAjeno = await LB.listaItemBorrar(r.b1.id);
  r.mas1 = await LB.listaItemMarcar(r.b1.id, true, 5);   // sin verla, las estrellas no cuentan
  r.nota = await LB.listaItemNota(r.b1.id, "  en Netflix ");
  r.estrellasMalas = await LB.listaItemMarcar(r.b1.id, true, 9);
  como("u_b"); r.visto = await LB.listaItemVisto(r.b1.id, true, hoy); r.est = await LB.listaItemMarcar(r.b1.id, false, 5);
  como("u_a"); await LB.listaItemMarcar(r.b1.id, true, 4); r.lista1 = (await LB.listaLista())[0];
  como("u_b"); r.desmarca = await LB.listaItemVisto(r.b1.id, false, hoy); r.lista2 = (await LB.listaLista())[0];
  r.borra = await LB.listaItemBorrar(r.b1.id);
  como("u_c"); r.fuera = await LB.listaItemVisto(r.a1.id, true, hoy);
  como("u_a"); r.invita = await LB.listaInvitar(L, ["u_c", "u_b"]);
  como("u_c"); r.listaC = await LB.listaLista(); await LB.listaResponder(L, false); r.listaC2 = await LB.listaLista();
  como("u_b"); r.edita = await LB.listaEditar(L, "Pelis por ver", "peliculas"); await LB.amigosBloquear("u_a"); r.listaB = await LB.listaLista();
  como("u_a"); r.listaA = await LB.listaLista(); await LB.listaSalir(L); r.db = clone(LB._amDb());

  test("base local: se crea con amigos tuyos y de un tipo conocido; agregan quienes están", () => {
    assert.equal(r.sinAmigos.error, "amigos"); assert.equal(r.tipoMalo.error, "tipo"); assert.ok(L);
    assert.equal(r.antes.error, "no-miembro"); assert.equal(r.une.r, "unido"); assert.equal(r.vacio.error, "texto");
    assert.ok(r.b1.id && r.a1.id);
  });
  test("base local: +1, nota, visto y estrellas (solo de lo visto); al desmarcar se van las estrellas", () => {
    assert.equal(r.borraAjeno.r, "nada"); assert.equal(r.estrellasMalas.error, "estrellas");
    const it = r.lista1.items.find(i => i.id === r.b1.id);
    assert.equal(it.texto, "Past Lives"); assert.equal(it.nota, "en Netflix"); assert.equal(it.visto, hoy); assert.equal(it.visto_por, "u_b");
    assert.deepEqual(clone(it.mas_uno), ["u_a"]); assert.deepEqual(clone(it.estrellas.map(e => e.n).sort()), [4, 5]);
    const it2 = r.lista2.items.find(i => i.id === r.b1.id);
    assert.equal(it2.visto, null); assert.equal(it2.estrellas.length, 0); assert.deepEqual(clone(it2.mas_uno), ["u_a"]);
    assert.equal(r.borra.r, "borrado"); assert.equal(r.fuera.error, "no-miembro");
  });
  test("base local: invitar, rechazar, editar; bloquear te saca; sin nadie, la lista se borra", () => {
    assert.equal(r.invita.n, 1); assert.equal(r.listaC[0].estado, "invitado"); assert.equal(r.listaC2.length, 0);
    assert.equal(r.edita.r, "ok"); assert.equal(r.listaB.length, 0); assert.equal(r.listaA[0].nombre, "Pelis por ver");
    assert.equal(r.db.listas.length, 0); assert.equal(r.db.litems.length, 0);
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  test("«Elegir para un plan»: con lo elegido, el tipo de plan y la gente de la lista que son tus amigos", () => {
    G("openPlanForm = (id, pre, desde) => { globalThis.__plan = { id, pre, desde }; }; closeModal = () => {};");
    G("AMIGOS").lista = { amigos: [{ id: "a", nombre: "Ana" }] };
    G("LCOM").lista = [base()];
    G("listaCompPlan")(2);
    const x = clone(G("globalThis.__plan"));
    assert.deepEqual(x, { id: null, pre: ["a"], desde: { titulo: "Ver Past Lives", tipo: "pelicula", lista: "Películas por ver" } });
    G("LCOM").lista = null; G("AMIGOS").lista = null;
  });

  /* -------- Avisos al celular (notifier/listas.mjs) -------- */
  const { mensajeLista, destinatariosAgrega, avisoLista } = await import("../notifier/listas.mjs");
  test("los textos: te invitan, se sumó y agregó algo", () => {
    const l = { nombre: "Películas por ver" };
    assert.deepEqual(mensajeLista("lista-invita", { nombre: "Ana", l }), { title: "Ana te invita a una lista", body: "«Películas por ver»: la arman entre todos en Rumbo.", url: "./#amigos", tag: "rumbo-lista-invita" });
    assert.equal(mensajeLista("lista-acepta", { nombre: "Bruno", l }).title, "Bruno se sumó a «Películas por ver»");
    assert.deepEqual(mensajeLista("lista-agrega", { nombre: "Ana", l, texto: "Perfect Days" }), { title: "Ana agregó algo a «Películas por ver»", body: "«Perfect Days». ¿Le das +1?", url: "./#listas", tag: "rumbo-lista-agrega" });
    assert.equal(mensajeLista("otro", {}), null);
  });
  test("al agregar: a los demás de la lista, uno al día", () => {
    const ms = [{ user_id: "a", estado: "activo" }, { user_id: "b", estado: "activo", avisos: { agrega: "2026-11-04" } }, { user_id: "c", estado: "activo" }, { user_id: "d", estado: "invitado" }];
    assert.deepEqual(destinatariosAgrega({ miembros: ms, yo: "a", fecha: "2026-11-04" }), ["c"]);
  });

  function sbFalso(tablas) {
    return {
      from(t) {
        const filtros = []; let upd = null, cols = "";
        const correr = () => {
          const rs = (tablas[t] || []).filter(x => filtros.every(f => f(x)));
          if (upd) { rs.forEach(x => Object.assign(x, clone(upd))); return rs; }
          if (cols.includes("notif:data->settings->notif")) return rs.map(x => ({ notif: ((x.data || {}).settings || {}).notif ?? null }));
          return rs;
        };
        const q = {
          select(c) { cols = c; return q; }, update(o) { upd = o; return q; },
          eq(k, v) { filtros.push(x => x[k] === v); return q; },
          async maybeSingle() { return { data: correr()[0] || null, error: null }; },
          then(ok, ko) { return Promise.resolve({ data: correr(), error: null }).then(ok, ko); },
        };
        return q;
      },
    };
  }
  const ID = "11111111-2222-3333-4444-555555555555", A = "aaaaaaaa-0000-0000-0000-000000000000", B = "bbbbbbbb-0000-0000-0000-000000000000", C = "cccccccc-0000-0000-0000-000000000000";
  const MEDIODIA = new Date("2026-11-04T15:00:00Z");
  const t = {
    listas_compartidas: [{ id: ID, nombre: "Películas por ver", tipo: "peliculas" }],
    listas_compartidas_miembros: [
      { lista: ID, user_id: A, estado: "activo", invita: null, avisos: {} },
      { lista: ID, user_id: B, estado: "activo", invita: A, avisos: {} },
      { lista: ID, user_id: C, estado: "invitado", invita: A, avisos: {} },
    ],
    listas_compartidas_items: [
      { id: 1, lista: ID, user_id: A, texto: "Perfect Days", creado: "2026-11-04T14:58:00Z" },
      { id: 2, lista: ID, user_id: B, texto: "Past Lives", creado: "2026-11-03T14:00:00Z" },
    ],
    perfiles: [{ user_id: A, nombre: "Ana" }, { user_id: B, nombre: "Bruno" }, { user_id: C, nombre: "Cami" }],
    estado_usuario: [A, B, C].map(u => ({ user_id: u, data: { settings: { notif: {} } } })),
    suscripciones_push: [A, B, C].map((u, i) => ({ id: i, user_id: u, endpoint: "https://push/" + u })),
  };
  const sb = sbFalso(t), enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds.map(d => d.user_id), msg.title]); return { enviadas: ds.length }; };
  const av = {};
  av.invita = await avisoLista({ sb, yo: A, body: { tipo: "lista-invita", lista: ID }, enviar, ahora: MEDIODIA });
  av.invita2 = await avisoLista({ sb, yo: A, body: { tipo: "lista-invita", lista: ID }, enviar, ahora: MEDIODIA });
  av.acepta = await avisoLista({ sb, yo: B, body: { tipo: "lista-acepta", lista: ID }, enviar, ahora: MEDIODIA });
  av.acepta2 = await avisoLista({ sb, yo: B, body: { tipo: "lista-acepta", lista: ID }, enviar, ahora: MEDIODIA });
  av.ajeno = await avisoLista({ sb, yo: B, body: { tipo: "lista-agrega", lista: ID, item: 1 }, enviar, ahora: MEDIODIA });
  av.viejo = await avisoLista({ sb, yo: B, body: { tipo: "lista-agrega", lista: ID, item: 2 }, enviar, ahora: MEDIODIA });
  av.agrega = await avisoLista({ sb, yo: A, body: { tipo: "lista-agrega", lista: ID, item: 1 }, enviar, ahora: MEDIODIA });
  av.agrega2 = await avisoLista({ sb, yo: A, body: { tipo: "lista-agrega", lista: ID, item: 1 }, enviar, ahora: MEDIODIA });
  av.invitado = await avisoLista({ sb, yo: C, body: { tipo: "lista-invita", lista: ID }, enviar, ahora: MEDIODIA });
  test("los avisos que pide la app: de quien corresponde, una vez (lo agregado, uno al día)", () => {
    assert.equal(av.invita.enviadas, 1); assert.equal(av.invita2.motivo, "nadie");
    assert.equal(av.acepta.enviadas, 1); assert.equal(av.acepta2.motivo, "ya-avisado");
    assert.equal(av.ajeno.motivo, "no-corresponde"); assert.equal(av.viejo.motivo, "no-corresponde");
    assert.equal(av.agrega.enviadas, 1); assert.equal(av.agrega2.motivo, "nadie"); assert.equal(av.invitado.motivo, "no-corresponde");
    assert.deepEqual(enviados, [[[C], "Ana te invita a una lista"], [[A], "Bruno se sumó a «Películas por ver»"], [[B], "Ana agregó algo a «Películas por ver»"]]);
  });
}
