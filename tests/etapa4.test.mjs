/* Tests de la etapa 4 de los planes con amigos: «¿Quién se suma?» (planes abiertos), los cumpleaños de tus amigos
   (si los comparten) y leer el mismo libro (lecturas-amigos.js, store.js y los avisos de notifier/) */
export default async function ({ G, test, assert, clone }) {
  console.log("\nEtapa 4: ¿quién se suma?, cumpleaños y leer juntos");
  const estadoPublico = G("amigosEstadoPublico"), estadoLimpio = G("amigosEstadoLimpio"), cumpleEn = G("amigoCumpleEn"), cumpleTxt = G("amigoCumpleTxt");
  const plLimpio = G("plLimpio"), ljLimpio = G("ljLimpio"), ljPct = G("ljPct");
  const LB = G("LocalBackend"), ls = G("localStorage");
  const hoy = G("todayISO()"), mas = n => G(`agSumar(${JSON.stringify(hoy)}, ${n})`);

  /* -------- Cumpleaños -------- */
  test("tu cumpleaños se comparte solo si lo eliges (viene apagado), y solo el día y el mes", () => {
    const d = { fecha: hoy, cumple: "11-07" };
    assert.deepEqual(clone(estadoPublico(d, { dia: false, racha: false, rango: false, casa: false, vitrina: false })), { fecha: hoy });
    assert.deepEqual(clone(estadoPublico(d, { dia: false, racha: false, rango: false, casa: false, vitrina: false, cumple: true })), { fecha: hoy, cumple: "11-07" });
    assert.deepEqual(clone(estadoPublico({ fecha: hoy, cumple: "" }, { cumple: true, dia: false, racha: false, rango: false })), { fecha: hoy }, "sin fecha de nacimiento, nada");
    assert.equal(estadoLimpio({ fecha: hoy, cumple: "13-40" }).cumple, undefined); assert.equal(estadoLimpio({ fecha: hoy, cumple: "1990-11-07" }).cumple, undefined);
    assert.equal(estadoLimpio({ fecha: hoy, cumple: "11-07" }).cumple, "11-07");
  });
  test("¿en cuántos días es su cumpleaños? hoy, mañana o el próximo año (y el 29 de febrero)", () => {
    const de = c => ({ estado: { fecha: "2026-11-07", cumple: c } });
    assert.equal(cumpleEn(de("11-07"), "2026-11-07"), 0); assert.equal(cumpleEn(de("11-08"), "2026-11-07"), 1);
    assert.equal(cumpleEn(de("11-06"), "2026-11-07"), 364); assert.equal(cumpleEn(de("02-29"), "2027-02-28"), 0, "sin 29 de febrero, el 28");
    assert.equal(cumpleEn({ estado: { fecha: hoy } }, hoy), null);
    assert.equal(cumpleTxt("11-07"), "7 de noviembre");
  });

  /* -------- Planes abiertos y leer juntos: la base local -------- */
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana" });
  como("u_b"); await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); await LB.amigosPerfil({ nombre: "Cami" });
  como("u_b"); await LB.amigosPedir(pa.codigo); como("u_a"); await LB.amigosResponder("u_b", true);
  const r = {};
  como("u_a");
  r.sinFecha = await LB.planAbiertoCrear({ titulo: "Correr", tipo: "deporte", fecha: null, hora: "", lugar: "", enlace: "" }, hoy);
  r.abre = await LB.planAbiertoCrear({ titulo: "Salir a correr", tipo: "deporte", fecha: mas(1), hora: "19:00", lugar: "El parque", enlace: "" }, hoy);
  const AB = r.abre.id;
  como("u_b"); r.veB = (await LB.planLista(hoy)).find(p => p.id === AB);
  como("u_c"); r.veC = (await LB.planLista(hoy)).find(p => p.id === AB); r.sumaC = await LB.planSumarme(AB, hoy);
  como("u_b"); r.sumaB = await LB.planSumarme(AB, hoy); r.veB2 = (await LB.planLista(hoy)).filter(p => p.id === AB);
  como("u_a"); r.sumaA = await LB.planSumarme(AB, hoy);
  test("«¿Quién se suma?»: con fecha; lo ven tus amigos (y nadie más) y se suman solos", () => {
    assert.equal(r.sinFecha.error, "fecha"); assert.ok(AB);
    assert.equal(r.veB.respuesta, "abierto"); assert.equal(r.veB.abierto, true); assert.equal(r.veB.gastos.length, 0);
    assert.equal(r.veC, undefined); assert.equal(r.sumaC.error, "no-amigos");
    assert.equal(r.sumaB.r, "sumado"); assert.equal(r.veB2.length, 1); assert.equal(r.veB2[0].respuesta, "voy");
    assert.equal(r.sumaA.r, "nada");
    const p = plLimpio(r.veB); assert.equal(p.respuesta, "abierto"); assert.equal(p.abierto, true);
  });

  como("u_a");
  r.lSinPag = await LB.lecturaCrear("Cien años de soledad", "García Márquez", 0, ["u_b"]);
  r.lCrea = await LB.lecturaCrear(" Cien años de soledad ", "García Márquez", 471, ["u_b", "u_b"]);
  const L = r.lCrea.id;
  como("u_b"); r.lAntes = await LB.lecturaAvance(L, 10, hoy); await LB.lecturaResponder(L, true);
  r.lB = await LB.lecturaAvance(L, 600, hoy); r.lB2 = await LB.lecturaAvance(L, 471, hoy);
  como("u_a"); r.lA = await LB.lecturaAvance(L, 120, hoy); r.lista = await LB.lecturaLista();
  test("leer juntos: con páginas; cada uno su página; al llegar al final, lo terminó (una vez)", () => {
    assert.equal(r.lSinPag.error, "paginas"); assert.ok(L); assert.equal(r.lAntes.error, "no-miembro");
    assert.deepEqual(clone(r.lB), { pagina: 471, terminado: true, recien: true }); assert.equal(r.lB2.recien, false);
    assert.equal(r.lA.pagina, 120);
    const l = ljLimpio(r.lista[0]);
    assert.equal(l.titulo, "Cien años de soledad"); assert.equal(l.paginas, 471);
    assert.deepEqual(clone(l.miembros.map(m => [m.nombre, m.pagina, !!m.terminado])), [["Ana", 120, false], ["Bruno", 471, true]]);
    assert.equal(ljPct(l, l.miembros[0]), 25); assert.equal(ljPct(l, l.miembros[1]), 100);
  });
  test("lo que llega de una lectura se limpia (id seguro, páginas y página dentro del libro)", () => {
    const l = clone(ljLimpio({ id: "a'b<c>", titulo: "T".repeat(100), paginas: 99999, miembros: [{ id: "u", pagina: 999999, terminado: "x" }] }));
    assert.equal(l.id, "abc"); assert.equal(l.titulo.length, 80); assert.equal(l.paginas, 10000); assert.equal(l.miembros[0].pagina, 10000); assert.equal(l.miembros[0].terminado, "");
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  /* -------- Avisos -------- */
  const { mensajePlan, avisoPlan } = await import("../notifier/planes.mjs");
  const { mensajeCumple, recordatoriosCumples } = await import("../notifier/amigos.mjs");
  const { mensajeLectura, avisoLectura } = await import("../notifier/lecturas.mjs");
  function sbFalso(tablas) {
    return {
      from(t) {
        const filtros = []; let upd = null, cols = "";
        const valor = (x, k) => (k.includes("->>") ? (x[k.split("->>")[0]] || {})[k.split("->>")[1]] : x[k]);
        const correr = () => {
          const rs = (tablas[t] || []).filter(x => filtros.every(f => f(x)));
          if (upd) { rs.forEach(x => Object.assign(x, clone(upd))); return rs; }
          if (cols.includes("notif:data->settings->notif")) return rs.map(x => ({ notif: ((x.data || {}).settings || {}).notif ?? null }));
          return rs;
        };
        const q = {
          select(c) { cols = c; return q; }, update(o) { upd = o; return q; },
          async insert(o) { const ya = (tablas[t] = tablas[t] || []).some(x => x.user_id === o.user_id && x.tipo === o.tipo && x.fecha === o.fecha); if (ya) return { error: { message: "duplicate" } }; tablas[t].push(o); return { error: null }; },
          eq(k, v) { filtros.push(x => valor(x, k) === v); return q; },
          async maybeSingle() { return { data: correr()[0] || null, error: null }; },
          then(ok, ko) { return Promise.resolve({ data: correr(), error: null }).then(ok, ko); },
        };
        return q;
      },
    };
  }
  const ID = "11111111-2222-3333-4444-555555555555", A = "aaaaaaaa-0000-0000-0000-000000000000", B = "bbbbbbbb-0000-0000-0000-000000000000", C = "cccccccc-0000-0000-0000-000000000000";
  const MEDIODIA = new Date("2026-11-07T15:00:00Z");
  const base = () => ({
    planes: [{ id: ID, titulo: "Salir a correr", fecha: "2026-11-07", hora: "19:00", lugar: "el parque", enlace: "", creador: A, cancelado: false, abierto: true, avisos: {} }],
    planes_invitados: [{ plan: ID, user_id: A, respuesta: "voy", avisos: {} }],
    amistades: [{ a: A, b: B, estado: "aceptada" }, { a: C, b: A, estado: "aceptada" }, { a: B, b: C, estado: "aceptada" }],
    perfiles: [{ user_id: A, nombre: "Ana", estado: { cumple: "11-07" } }, { user_id: B, nombre: "Bruno", estado: {} }, { user_id: C, nombre: "Cami", estado: { cumple: "03-01" } }],
    estado_usuario: [A, B, C].map(u => ({ user_id: u, data: { settings: { notif: { tz: "America/Santiago" } } } })),
    suscripciones_push: [A, B, C].map(u => ({ id: u, user_id: u, endpoint: "https://push/" + u })),
    notif_sent: [],
    lecturas_conjunto: [{ id: ID, titulo: "Cien años de soledad" }],
    lecturas_conjunto_miembros: [
      { lectura: ID, user_id: A, estado: "activo", invita: null, terminado: null, avisos: {} }, { lectura: ID, user_id: B, estado: "activo", invita: A, terminado: "2026-11-07", avisos: {} },
      { lectura: ID, user_id: C, estado: "invitado", invita: A, terminado: null, avisos: {} },
    ],
  });
  const enviados = [];
  const enviar = async (ds, msg) => { enviados.push([ds[0].user_id, msg.title]); return { enviadas: ds.length }; };
  const t = base(), sb = sbFalso(t), av = {};
  av.abierto = await avisoPlan({ sb, yo: A, body: { tipo: "plan-abierto", plan: ID }, enviar, ahora: MEDIODIA });
  av.abierto2 = await avisoPlan({ sb, yo: A, body: { tipo: "plan-abierto", plan: ID }, enviar, ahora: MEDIODIA });
  const abiertos = enviados.splice(0);
  av.cumples = await recordatoriosCumples({ sb, enviar, ahora: MEDIODIA });
  av.cumples2 = await recordatoriosCumples({ sb, enviar, ahora: new Date("2026-11-07T16:00:00Z") });
  const cumples = enviados.splice(0);
  av.invita = await avisoLectura({ sb, yo: A, body: { tipo: "lectura-invita", lectura: ID }, enviar, ahora: MEDIODIA });
  av.acepta = await avisoLectura({ sb, yo: B, body: { tipo: "lectura-acepta", lectura: ID }, enviar, ahora: MEDIODIA });
  av.termina = await avisoLectura({ sb, yo: B, body: { tipo: "lectura-termina", lectura: ID }, enviar, ahora: MEDIODIA });
  av.termina2 = await avisoLectura({ sb, yo: B, body: { tipo: "lectura-termina", lectura: ID }, enviar, ahora: MEDIODIA });
  av.terminaA = await avisoLectura({ sb, yo: A, body: { tipo: "lectura-termina", lectura: ID }, enviar, ahora: MEDIODIA });
  const lecturas = enviados.splice(0);
  test("«¿Quién se suma?»: el aviso a todos tus amigos, una sola vez", () => {
    assert.equal(mensajePlan("plan-abierto", { nombre: "Ana", p: t.planes[0] }).title, "Ana pregunta quién se suma");
    assert.equal(av.abierto.enviadas, 2); assert.equal(av.abierto2.motivo, "no-corresponde");
    assert.deepEqual(abiertos.map(x => x[0]).sort(), [B, C].sort());
  });
  test("los cumpleaños: a sus amigos, una vez en el día", () => {
    assert.deepEqual(mensajeCumple("Ana"), { title: "🎂 Hoy está de cumpleaños Ana", body: "Mándale un saludo desde Amigos.", url: "./#amigos", tag: "rumbo-amigo-cumple" });
    assert.equal(av.cumples.cumples, 1); assert.equal(av.cumples.enviadas, 2); assert.equal(av.cumples2.enviadas, 0);
    assert.deepEqual(cumples.map(x => x[0]).sort(), [B, C].sort());
  });
  test("leer juntos: te invitan, se sumó y lo terminó (una vez por persona)", () => {
    assert.equal(mensajeLectura("lectura-termina", { nombre: "Bruno", l: { titulo: "Cien años de soledad" } }).title, "Bruno terminó «Cien años de soledad»");
    assert.equal(av.invita.enviadas, 1); assert.equal(av.acepta.enviadas, 1); assert.equal(av.termina.enviadas, 1);
    assert.equal(av.termina2.motivo, "ya-avisado"); assert.equal(av.terminaA.motivo, "no-corresponde", "Ana no lo ha terminado");
    assert.deepEqual(lecturas, [[C, "Ana te invita a leer «Cien años de soledad»"], [A, "Bruno se sumó a leer «Cien años de soledad»"], [A, "Bruno terminó «Cien años de soledad»"]]);
  });
}
