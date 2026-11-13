/* Tests de 🧭 Norte, tu brújula: el servidor (notifier/norte.mjs, con un Supabase falso y sin red) y la bandeja
   en la app (norteAplicar de js/norte.js): cada pedido se aplica una vez, con las ⭐ de siempre, aunque llegue
   dos veces o lo apliquen dos equipos */
export default async function ({ G, test, assert, clone, cargar }) {
  console.log("\nNorte, tu brújula: el robot de voz");
  const {
    atenderNorte, buscarHabito, normalizar, paraVoz, enLista, resumenDia, hashCodigo, hashToken, TEXTO_MAX, PEDIDOS_HORA,
  } = await import("../notifier/norte.mjs");
  const { VASOS_AL_DIA } = await import("../notifier/vaso.mjs");

  /* ---------- Un Supabase falso: tablas en memoria, filtros eq/gte, conteo, insert/upsert/update y rpc ---------- */
  function sbFalso(tablas = {}, rpcs = {}, ahora = new Date()) {
    const log = { inserts: [], updates: [], rpc: [] };
    const T = n => (tablas[n] = tablas[n] || []);
    const errores = tablas.__errores || {};
    function consulta(nombre) {
      const filtros = []; let modo = "select", op = {}, filas = null, cambios = null, unico = false;
      const q = {
        select(cols, o) { if (modo === "select") op = o || {}; return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        upsert(f, o) { modo = "upsert"; filas = [].concat(f); op = o || {}; return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        if (errores[nombre]) return { data: null, count: null, error: errores[nombre] };
        const t = T(nombre);
        if (modo === "insert" || modo === "upsert") {
          filas.forEach(f => { t.push(Object.assign({ creado: ahora.toISOString() }, f)); log.inserts.push({ tabla: nombre, f, op }); });
          return { data: null, error: null };
        }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); log.updates.push({ tabla: nombre, cambios, n: sel.length }); return { data: null, error: null }; }
        if (op.head) return { data: null, count: sel.length, error: null };
        return { data: unico ? sel[0] || null : sel, error: null };
      }
      return q;
    }
    return {
      tablas, log, from: consulta,
      rpc: async (fn, args) => { log.rpc.push({ fn, args }); return rpcs[fn] ? rpcs[fn](args) : { data: null, error: { message: `Could not find the function public.${fn}` } }; },
    };
  }
  const sinEmoji = t => typeof t === "string" && t.length > 0 && !/\p{Extended_Pictographic}/u.test(t);
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32), AHORA = new Date("2026-11-11T15:00:00Z"), HOY = "2026-11-11";
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" } },
    habitos: {
      defs: [
        { id: "h1", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h2", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h3", nombre: "Leer inglés 🇬🇧", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h4", nombre: "Fumar", meta: "dejar", creado: "2026-01-01" },
        { id: "h5", nombre: "Correr", frecuencia: { tipo: "diario" }, creado: "2026-01-01", pausado: true },
      ],
      log: { "2026-11": { h2: { 11: true } } },
    },
    ritual: { dias: {} },
    agenda: { dias: { [HOY]: [{ id: "t1", txt: "Pagar la luz", ambito: "per", estado: "pendiente" }, { id: "t2", txt: "Correo", estado: "hecha", done: true }, { id: "t3", txt: "Vieja", borrada: true }] } },
    agua: { meta: 2000, vaso: 300, dias: { [HOY]: { r: [{ id: "v1", ml: 500, ts: 1 }], b: [] } } },
  });
  const sbBase = (cambia = {}, rpcs = {}) => {
    const data = estado(); if (cambia.data) cambia.data(data);
    return sbFalso(Object.assign({
      estado_usuario: [{ user_id: U, data }],
      norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }],
      norte_pendientes: [], agua_pendientes: [],
    }, cambia.tablas || {}), rpcs, AHORA);
  };
  const pedir = (sb, body, token = TOKEN) => atenderNorte({ sb, body, autorizacion: token ? "Bearer " + token : undefined, ip: "1.2.3.4", ahora: AHORA });
  const insertados = (sb, tabla) => sb.log.inserts.filter(x => x.tabla === tabla).map(x => x.f);

  /* ---------- Palabras ---------- */
  test("los hábitos se buscan sin mayúsculas ni tildes, por parte del nombre y por palabras", () => {
    const defs = estado().habitos.defs;
    assert.equal(normalizar("  Meditár!! "), "meditar");
    assert.deepEqual(buscarHabito(defs, "MEDITÁR").map(h => h.id), ["h1"]);
    assert.deepEqual(buscarHabito(defs, "leer").map(h => h.id), ["h2"], "igual gana a «Leer inglés»");
    assert.deepEqual(buscarHabito(defs, "ingles").map(h => h.id), ["h3"]);
    assert.deepEqual(buscarHabito(defs, "lee").map(h => h.id), ["h2", "h3"], "una parte que está en dos: ambiguo");
    assert.deepEqual(buscarHabito(defs, "meditación").map(h => h.id), ["h1"], "por la raíz de la palabra");
    assert.deepEqual(buscarHabito(defs, "correr"), [], "los que están en pausa no");
    assert.deepEqual(buscarHabito(defs, ""), []);
    assert.equal(paraVoz("Leer inglés 🇬🇧 📖"), "Leer inglés");
    assert.equal(enLista(["a", "b", "c"]), "a, b y c"); assert.equal(enLista(["a", "b"], "o"), "a o b"); assert.equal(enLista(["a", "b", "c", "d", "e"]), "a, b, c y 2 más");
  });

  /* ---------- Conectar ---------- */
  const okConectar = { norte_conectar: () => ({ data: { ok: true, user_id: U, id: "ap2" }, error: null }) };
  const sbC = sbBase({}, okConectar), rC = await pedir(sbC, { accion: "conectar", codigo: "482913", aparato: "AA:BB:CC:DD:EE:FF", nombre: "Norte" }, null);
  test("conectar: canjea el código (con hash) por un token de 64 hex; en la base va solo el hash del token y de la IP", () => {
    assert.equal(rC.status, 200); assert.equal(rC.cuerpo.ok, true); assert.ok(sinEmoji(rC.cuerpo.texto));
    assert.match(rC.cuerpo.token, /^[0-9a-f]{64}$/);
    const a = sbC.log.rpc[0].args;
    assert.equal(sbC.log.rpc[0].fn, "norte_conectar");
    assert.equal(a.p_codigo_hash, hashCodigo("482913")); assert.equal(a.p_token_hash, hashToken(rC.cuerpo.token));
    assert.equal(a.p_aparato, "AA:BB:CC:DD:EE:FF"); assert.equal(a.p_nombre, "Norte");
    assert.ok(!String(a.p_ip).includes("1.2.3.4") && a.p_ip.length === 32, "la IP va con hash");
    assert.equal(hashCodigo("482913"), "4a8eec4925826f4b60526d7ac3c0a9b61ef54ac19233bafce2f4a13eb49395d2", "sha256 en hex, como encode(sha256(…), 'hex') en norte.sql");
  });
  const conCodigo = async (codigo, rpcs) => { const sb = sbBase({}, rpcs || okConectar); return { r: await pedir(sb, { accion: "conectar", codigo }, null), sb }; };
  const c1 = await conCodigo("48291"), c2 = await conCodigo(12345), c3 = await conCodigo("482913", { norte_conectar: () => ({ data: { error: "codigo-vencido" } }) });
  const c4 = await conCodigo("482913", { norte_conectar: () => ({ data: { error: "demasiados-intentos" } }) }), c5 = await conCodigo("482913", { norte_conectar: () => ({ data: { error: "codigo-invalido" } }) });
  const c6 = await conCodigo("482913", {});
  test("conectar: los errores del código (formato, vencido, demasiados intentos, sin servidor)", () => {
    assert.deepEqual([c1.r.status, c1.r.cuerpo.error, c1.sb.log.rpc.length], [400, "codigo-invalido", 0], "sin 6 dígitos ni se consulta");
    assert.equal(c2.r.status, 200); assert.equal(c2.sb.log.rpc[0].args.p_codigo_hash, hashCodigo("012345"), "si llega como número, con sus ceros");
    assert.deepEqual([c3.r.status, c3.r.cuerpo.error], [400, "codigo-vencido"]);
    assert.deepEqual([c4.r.status, c4.r.cuerpo.error], [429, "demasiados-intentos"]);
    assert.deepEqual([c5.r.status, c5.r.cuerpo.error], [400, "codigo-invalido"]);
    assert.deepEqual([c6.r.status, c6.r.cuerpo.error], [500, "sin-servidor"], "sin supabase/norte.sql todavía");
    for (const c of [c1, c3, c4, c5, c6]) { assert.equal(c.r.cuerpo.ok, false); assert.ok(sinEmoji(c.r.cuerpo.texto)); }
  });

  /* ---------- El token ---------- */
  const sbA = sbBase({ tablas: { norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }, { id: "ap9", user_id: U, token_hash: hashToken("cd".repeat(32)), desconectado: "2026-11-10T00:00:00Z" }] } });
  const a1 = await pedir(sbA, { accion: "hoy" }, null), a2 = await pedir(sbA, { accion: "hoy" }, "ef".repeat(32)), a3 = await pedir(sbA, { accion: "hoy" }, "cd".repeat(32));
  const a4 = await pedir(sbA, { accion: "bailar" }), a5 = await pedir(sbA, { accion: "bailar" }, null), a6 = await pedir(sbA, { accion: "hoy" }, "corto");
  test("sin token, con uno que no existe o de un Norte desconectado: 401; una acción que no existe: 400", () => {
    assert.deepEqual([a1.status, a1.cuerpo.error], [401, "no-autorizado"]);
    assert.deepEqual([a2.status, a2.cuerpo.error], [401, "no-autorizado"]);
    assert.deepEqual([a3.status, a3.cuerpo.error], [401, "desconectado"]);
    assert.deepEqual([a6.status, a6.cuerpo.error], [401, "no-autorizado"]);
    assert.deepEqual([a4.status, a4.cuerpo.error], [400, "accion-invalida"]);
    assert.deepEqual([a5.status, a5.cuerpo.error], [401, "no-autorizado"], "sin token no se dice ni qué acciones hay");
    assert.ok(sbA.log.updates.some(u => u.tabla === "norte_aparatos" && u.cambios.ultimo_uso === AHORA.toISOString()), "anota cuándo te habló");
  });

  /* ---------- hoy ---------- */
  const h1 = await pedir(sbBase(), { accion: "hoy" });
  test("hoy: tu día, tus hábitos (los que tocan, con el motor de la app), el agua y las tareas", () => {
    const d = h1.cuerpo.datos;
    assert.equal(h1.status, 200); assert.ok(sinEmoji(h1.cuerpo.texto));
    assert.deepEqual([d.fecha, d.abierto, d.cerrado, d.mision, d.primer_bocado, d.energia], [HOY, false, false, null, null, null]);
    assert.deepEqual(d.habitos_pendientes, ["Meditar", "Leer inglés"], "sin los de dejar, sin los en pausa y sin emojis");
    assert.deepEqual(d.habitos_hechos, ["Leer"]);
    assert.deepEqual(d.agua, { ml: 500, meta_ml: 2000 });
    assert.equal(d.tareas_pendientes, 1, "ni las hechas ni las borradas"); assert.equal(d.en_bandeja, 0);
    assert.match(h1.cuerpo.texto, /Todavía no abres tu día\./); assert.match(h1.cuerpo.texto, /Te faltan 2 hábitos: Meditar y Leer inglés\./);
    assert.match(h1.cuerpo.texto, /Llevas 0,5 de 2 litros de agua\./); assert.match(h1.cuerpo.texto, /Tienes una tarea pendiente\./);
  });
  const bandeja = {
    norte_pendientes: [
      { id: "n00000001", user_id: U, tipo: "habito", datos: { hid: "h1", fecha: HOY }, creado: "2026-11-11T14:00:00Z" },
      { id: "n00000002", user_id: U, tipo: "abrir", datos: { primer_bocado: "Escribir el informe", energia: 4, ambito: "pro", fecha: HOY }, creado: "2026-11-11T14:01:00Z" },
      { id: "n00000003", user_id: U, tipo: "tarea", datos: { texto: "Llamar a Hernán", ambito: "per", fecha: HOY }, creado: "2026-11-11T14:02:00Z" },
      { id: "n00000004", user_id: "otra", tipo: "tarea", datos: { texto: "De otra persona", fecha: HOY }, creado: "2026-11-11T14:02:00Z" },
    ],
    agua_pendientes: [{ id: "aaa111", user_id: U, fecha: HOY, ml: 300 }, { id: "v1", user_id: U, fecha: HOY, ml: 500 }],
  };
  const h2 = await pedir(sbBase({ tablas: clone(bandeja) }), { accion: "hoy" });
  const h3 = await pedir(sbBase({ tablas: clone(bandeja), data: d => { d.norte = { hechos: [{ id: "n00000003", ts: 1 }] }; } }), { accion: "hoy" });
  test("hoy: lo que espera en la bandeja ya cuenta (el hábito marcado por voz, el día abierto, el agua y la tarea)", () => {
    const d = h2.cuerpo.datos;
    assert.deepEqual(d.habitos_pendientes, ["Leer inglés"]); assert.deepEqual(d.habitos_hechos, ["Meditar", "Leer"]);
    assert.equal(d.abierto, true); assert.equal(d.energia, 4);
    assert.deepEqual(d.primer_bocado, { texto: "Escribir el informe", hecho: false });
    assert.equal(d.agua.ml, 800, "el vaso que ya está en el día no se suma dos veces");
    assert.equal(d.tareas_pendientes, 3, "la de la luz, la de la bandeja y el bocado nuevo");
    assert.equal(d.en_bandeja, 4, "3 pedidos y 1 vaso (no lo de otra persona)");
    assert.match(h2.cuerpo.texto, /Tu día está abierto\. Tu primer bocado es Escribir el informe\./);
    assert.equal(h3.cuerpo.datos.en_bandeja, 3, "lo que la app ya aplicó (STATE.norte.hechos) no cuenta dos veces");
  });

  /* ---------- sumar_agua ---------- */
  const sbW = sbBase(), w1 = await pedir(sbW, { accion: "sumar_agua", vasos: 2 });
  const w2 = await pedir(sbBase(), { accion: "sumar_agua", vasos: 7 }), w3 = await pedir(sbBase(), { accion: "sumar_agua", vasos: "dos" });
  const sbW4 = sbBase({ data: d => { d.agua.dias[HOY].r[0].ml = 1800; d.agua.vaso = 5000; } }), w4 = await pedir(sbW4, { accion: "sumar_agua" });
  const lleno = Array.from({ length: VASOS_AL_DIA }, (_, i) => ({ id: "z" + i + "abcd", user_id: U, fecha: HOY, ml: 250, creado: AHORA.toISOString() }));
  const w5 = await pedir(sbBase({ tablas: { agua_pendientes: lleno } }), { accion: "sumar_agua" });
  test("sumar_agua: un vaso por fila en agua_pendientes (como «+ Un vaso»), con tu vaso, y lo que llevas", () => {
    assert.equal(w1.status, 200); assert.ok(sinEmoji(w1.cuerpo.texto));
    const filas = insertados(sbW, "agua_pendientes");
    assert.equal(filas.length, 2); assert.ok(filas.every(f => f.user_id === U && f.fecha === HOY && f.ml === 300 && /^[a-z0-9]{4,40}$/.test(f.id)));
    assert.notEqual(filas[0].id, filas[1].id);
    assert.equal(sbW.log.inserts[0].op.ignoreDuplicates, true);
    assert.deepEqual(w1.cuerpo.datos.agua, { ml: 1100, meta_ml: 2000 });
    assert.equal(w1.cuerpo.texto, "Anotados dos vasos. Llevas 1,1 de 2 litros.");
    assert.deepEqual([w2.status, w2.cuerpo.error], [400, "dato-invalido"]); assert.deepEqual([w3.status, w3.cuerpo.error], [400, "dato-invalido"]);
    assert.equal(insertados(sbW4, "agua_pendientes")[0].ml, 250, "un vaso raro: 250 ml");
    assert.equal(w4.cuerpo.texto, "Anotado, un vaso. Llegaste a tus 2 litros de hoy, bien hecho.");
    assert.deepEqual([w5.status, w5.cuerpo.error], [429, "demasiados-pedidos"]);
  });

  /* ---------- marcar_habito ---------- */
  const sbH = sbBase(), m1 = await pedir(sbH, { accion: "marcar_habito", habito: "meditár" });
  const m2 = await pedir(sbH, { accion: "marcar_habito", habito: "Meditar" });   // ya está en la bandeja
  const sbH3 = sbBase(), m3 = await pedir(sbH3, { accion: "marcar_habito", habito: "LEER" });
  const m4 = await pedir(sbBase(), { accion: "marcar_habito", habito: "lee" }), m5 = await pedir(sbBase(), { accion: "marcar_habito", habito: "nadar" });
  const m6 = await pedir(sbBase(), { accion: "marcar_habito", habito: "fumar" }), m7 = await pedir(sbBase(), { accion: "marcar_habito", habito: "" });
  const muchos = Array.from({ length: PEDIDOS_HORA }, (_, i) => ({ id: "n0000x" + i, user_id: U, tipo: "nota", datos: { texto: "x" }, creado: AHORA.toISOString() }));
  const m8 = await pedir(sbBase({ tablas: { norte_pendientes: muchos } }), { accion: "marcar_habito", habito: "meditar" });
  test("marcar_habito: a la bandeja con su fecha; si ya está hecho (o en la bandeja), no se repite", () => {
    assert.equal(m1.status, 200); assert.equal(m1.cuerpo.texto, "Listo, marqué Meditar. Te queda un hábito: Leer inglés.");
    const f = insertados(sbH, "norte_pendientes");
    assert.equal(f.length, 1); assert.deepEqual([f[0].tipo, f[0].user_id, f[0].datos.hid, f[0].datos.fecha], ["habito", U, "h1", HOY]);
    assert.match(f[0].id, /^[a-z0-9]{8,40}$/, "el id que acepta norte.sql");
    assert.deepEqual([m2.status, m2.cuerpo.datos.ya], [200, true]); assert.equal(insertados(sbH, "norte_pendientes").length, 1, "marcado por voz cuenta como hecho");
    assert.deepEqual([m3.status, m3.cuerpo.datos.ya, m3.cuerpo.texto], [200, true, "Leer ya estaba marcado hoy."]); assert.equal(insertados(sbH3, "norte_pendientes").length, 0);
  });
  test("marcar_habito: ambiguo, no encontrado (con los de hoy), de dejar (se anota en la app) y el límite por hora", () => {
    assert.deepEqual([m4.status, m4.cuerpo.error, m4.cuerpo.datos.opciones], [400, "habito-ambiguo", ["Leer", "Leer inglés"]]);
    assert.equal(m4.cuerpo.texto, "¿Cuál de estos? Leer o Leer inglés.");
    assert.deepEqual([m5.status, m5.cuerpo.error], [404, "habito-no-encontrado"]); assert.deepEqual(m5.cuerpo.datos.habitos, ["Meditar", "Leer inglés", "Leer"]);
    assert.deepEqual([m6.status, m6.cuerpo.error], [400, "habito-en-la-app"]); assert.match(m6.cuerpo.texto, /se anota en la app/);
    assert.deepEqual([m7.status, m7.cuerpo.error], [400, "dato-invalido"]);
    assert.deepEqual([m8.status, m8.cuerpo.error], [429, "demasiados-pedidos"]);
    for (const r of [m4, m5, m6, m7, m8]) assert.ok(sinEmoji(r.cuerpo.texto));
  });

  /* ---------- anotar ---------- */
  const sbN = sbBase(), n1 = await pedir(sbN, { accion: "anotar", texto: "llamar a Hernán", tipo: "tarea" });
  const n2 = await pedir(sbN, { accion: "anotar", texto: "Idea: un #podcast", tipo: "nota", ambito: "pro" });
  const n3 = await pedir(sbBase(), { accion: "anotar", texto: "x".repeat(TEXTO_MAX + 1) }), n4 = await pedir(sbBase(), { accion: "anotar", texto: "algo", tipo: "lista" });
  const n5 = await pedir(sbBase(), { accion: "anotar", texto: "algo", ambito: "casa" }), n6 = await pedir(sbBase(), { accion: "anotar", texto: "   " });
  test("anotar: una tarea (personal si no dices) o una nota, a la bandeja; los largos y lo raro no", () => {
    assert.equal(n1.cuerpo.texto, "Anotado en tus tareas de hoy: llamar a Hernán.");
    const [t, n] = insertados(sbN, "norte_pendientes");
    assert.deepEqual([t.tipo, t.datos.texto, t.datos.ambito, t.datos.fecha], ["tarea", "llamar a Hernán", "per", HOY]);
    assert.deepEqual([n.tipo, n.datos.texto], ["nota", "Idea: un #podcast"]); assert.equal(n2.cuerpo.texto, "Guardé tu nota.");
    for (const r of [n3, n4, n5, n6]) { assert.deepEqual([r.status, r.cuerpo.error], [400, "dato-invalido"]); assert.ok(sinEmoji(r.cuerpo.texto)); }
  });

  /* ---------- abrir_dia y cerrar_dia ---------- */
  const sbD = sbBase(), d0 = await pedir(sbD, { accion: "cerrar_dia", animo: 4 });
  const d1 = await pedir(sbD, { accion: "abrir_dia", primer_bocado: "Escribir el informe", energia: 4 });
  const d2 = await pedir(sbD, { accion: "cerrar_dia", animo: 5, gratitud: "Mi familia" });
  const d3 = await pedir(sbBase(), { accion: "abrir_dia", energia: 6 }), d4 = await pedir(sbBase(), { accion: "cerrar_dia", animo: 0 });
  const cerrado = { data: d => { d.ritual.dias[HOY] = { hecho: true, cerrado: true, ts: 1 }; } };
  const d5 = await pedir(sbBase(cerrado), { accion: "cerrar_dia" }), d6 = await pedir(sbBase(cerrado), { accion: "abrir_dia", primer_bocado: "Algo" });
  const d7 = await pedir(sbBase({ data: d => { d.ritual.dias[HOY] = { hecho: true, ts: 1 }; } }), { accion: "abrir_dia" });
  test("abrir_dia y cerrar_dia: a la bandeja; para cerrar hay que abrir (aunque sea por voz, en la bandeja)", () => {
    assert.deepEqual([d0.status, d0.cuerpo.error], [400, "dia-sin-abrir"]);
    assert.equal(d1.status, 200); assert.equal(d1.cuerpo.texto, "Listo, abrí tu día. Tu primer bocado: Escribir el informe. Empieza por ahí.");
    assert.equal(d2.status, 200); assert.equal(d2.cuerpo.texto, "Listo, cerré tu día. Tus 2 tareas pendientes pasan a mañana. Gracias por lo que compartiste. Que descanses.");
    const [ab, ce] = insertados(sbD, "norte_pendientes");
    assert.deepEqual([ab.tipo, ab.datos.primer_bocado, ab.datos.energia, ab.datos.ambito, ab.datos.fecha], ["abrir", "Escribir el informe", 4, "pro", HOY]);
    assert.deepEqual([ce.tipo, ce.datos.animo, ce.datos.gratitud, ce.datos.fecha], ["cerrar", 5, "Mi familia", HOY]);
    assert.deepEqual([d3.status, d3.cuerpo.error], [400, "dato-invalido"]); assert.deepEqual([d4.status, d4.cuerpo.error], [400, "dato-invalido"]);
    assert.deepEqual([d5.status, d5.cuerpo.datos.ya], [200, true], "ya cerrado: no se repite");
    assert.deepEqual([d6.status, d6.cuerpo.error], [400, "dia-cerrado"]);
    assert.deepEqual([d7.status, d7.cuerpo.datos.ya], [200, true], "abierto y sin bocado nuevo: nada que hacer");
    for (const r of [d0, d1, d2, d3, d4, d5, d6, d7]) assert.ok(sinEmoji(r.cuerpo.texto));
  });
  const sinTabla = await pedir(sbBase({ tablas: { __errores: { norte_pendientes: { message: 'relation "norte_pendientes" does not exist' } } } }), { accion: "anotar", texto: "algo" });
  test("sin supabase/norte.sql todavía: 500 «sin-servidor», con una frase para decir", () => {
    assert.deepEqual([sinTabla.status, sinTabla.cuerpo.error], [500, "sin-servidor"]); assert.ok(sinEmoji(sinTabla.cuerpo.texto));
  });
  test("resumenDia sin datos no falla (cuenta nueva)", () => {
    const d = resumenDia({}, { norte: [], agua: [] }, HOY);
    assert.deepEqual([d.abierto, d.habitos_pendientes.length, d.agua.ml, d.agua.meta_ml, d.tareas_pendientes], [false, 0, 0, 2000, 0]);
  });

  /* ================= La app: aplicar la bandeja (js/norte.js) ================= */
  const defaultState = G("defaultState"), migrate = G("migrate"), aplicar = G("norteAplicar"), resumen = G("norteResumen");
  const todayISO = G("todayISO"), agSumar = G("agSumar"), monthKey = G("monthKey"), buscarTarea = G("buscarTarea"), tareasDelDia = G("tareasDelDia");
  const ledgerRegistrar = G("ledgerRegistrar"), ledgerVigente = G("ledgerVigente"), norteMerge = G("norteMerge"), limpiar = G("norteLimpiarHechos");
  // Las funciones de la bandeja reciben el estado (S). STATE es otro, así la nota del elefante no revisa insignias
  // (en la app sí: S es STATE y las medallas del cierre cuentan, como al cerrar a mano)
  G("(s => { STATE = s; })")(defaultState());
  const hoy = todayISO(), dt = new Date(hoy + "T12:00:00"), mk = monthKey(dt.getFullYear(), dt.getMonth()), dia = dt.getDate();
  const nuevoEstado = () => {
    const s = migrate(defaultState());
    s.habitos.defs.push({ id: "hn1", nombre: "Respirar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
      { id: "hn2", nombre: "Azúcar", meta: "dejar", creado: "2026-01-01" }, { id: "hn3", nombre: "Pausado", frecuencia: { tipo: "diario" }, creado: "2026-01-01", pausado: true });
    return s;
  };
  const t0 = Date.parse(hoy + "T08:00:00");
  const ped = (n, tipo, datos) => ({ id: "n000000000" + n, tipo, datos: Object.assign({ fecha: hoy }, datos), creado: new Date(t0 + n * 60e3).toISOString() });
  const pedidos = [
    ped(5, "cerrar", { animo: 5, gratitud: "Mi familia" }),   // llega primero en la lista, pero va después de abrir (por su hora)
    ped(1, "habito", { hid: "hn1" }),
    ped(2, "tarea", { texto: "Llamar a Hernán", ambito: "pro" }),
    ped(3, "nota", { texto: "Idea para un #podcast" }),
    ped(4, "abrir", { primer_bocado: "Escribir el informe", energia: 4, ambito: "pro" }),
  ];
  const S0 = nuevoEstado(), base = S0.gamif.puntos;
  const S = clone(S0);
  const r1 = aplicar(clone(pedidos), S);
  test("la bandeja se aplica con las funciones de la app: hábito, tarea, nota, apertura y cierre cortos", () => {
    assert.deepEqual(clone(r1.aplicados.map(x => x.tipo)), ["habito", "tarea", "nota", "abrir", "cerrar"], "en el orden en que se pidieron");
    assert.equal(r1.nuevos, 5); assert.equal(r1.hechos.length, 5);
    assert.equal(S.habitos.log[mk].hn1[dia], true, "el hábito, marcado en la fecha del pedido");
    assert.ok(ledgerVigente(S, "habito:hn1:" + hoy), "con el mismo id de ⭐ que al marcarlo a mano");
    const t = buscarTarea(S, hoy, "ntn0000000002");
    assert.ok(t && t.txt === "Llamar a Hernán" && t.ambito === "pro", "la tarea, con id fijo");
    const n = S.postits.find(x => x.id === "nnn0000000003");
    assert.ok(n && n.texto === "Idea para un #podcast"); assert.deepEqual(clone(n.etiquetas), ["podcast"], "la nota, con sus #etiquetas (como notaCrear)");
    const r = S.ritual.dias[hoy];
    assert.ok(r.hecho && r.express.apertura && r.sapo === "Escribir el informe" && r.energia === 4, "apertura corta");
    assert.equal(r.abiertoTs, t0 + 4 * 60e3, "la hora en que se lo dijiste a Norte");
    assert.ok(r.cerrado && r.express.cierre, "cierre corto"); assert.equal(r.cerradoTs, t0 + 5 * 60e3);
    assert.ok(ledgerVigente(S, "ritual-apertura:" + hoy) && ledgerVigente(S, "ritual-cierre:" + hoy));
    assert.equal(r1.estrellas, 5 + 25 + 20); assert.equal(S.gamif.puntos, base + 50);
    const e = S.vida.diario.filter(x => x.fecha === hoy && x.fromRitual);
    assert.equal(e.length, 1); assert.deepEqual([e[0].mood, e[0].gratitud], [5, "Mi familia"], "el ánimo y la gratitud, al diario");
    assert.ok(tareasDelDia(hoy, S).some(x => x.id === "nbn00000000040" && x.esSapo), "la tarea del bocado, con id fijo");
    const manana = tareasDelDia(agSumar(hoy, 1), S);
    assert.equal(manana.length, 2, "las pendientes pasan a mañana (el cierre corto sin elegir nada)");
    assert.ok(manana.every(x => x.id.startsWith("ncn0000000005")), "con id fijo");
    assert.equal(resumen(r1), "🧭 Norte marcó Respirar, anotó una tarea, guardó una nota, abrió tu día y cerró tu día · +50 ⭐");
  });
  const puntos1 = S.gamif.puntos, tareas1 = JSON.stringify(S.agenda), r2 = aplicar(clone(pedidos), S);
  test("si la misma bandeja llega otra vez (la app se cerró antes de confirmar), no se aplica dos veces", () => {
    assert.equal(r2.nuevos, 0); assert.equal(r2.aplicados.length, 0); assert.equal(r2.hechos.length, 5, "pero se confirma, para que salga de la bandeja");
    assert.equal(S.gamif.puntos, puntos1); assert.equal(JSON.stringify(S.agenda), tareas1);
    assert.equal(S.postits.filter(x => x.id === "nnn0000000003").length, 1);
  });
  test("dos equipos que aplican la misma bandeja: al juntarse, todo queda una vez (⭐, tareas, nota y diario)", () => {
    const A = clone(S0), B = clone(S0);
    aplicar(clone(pedidos), A, { now: 1000 });
    aplicar(clone(pedidos), B, { now: 2000 });
    const m = cargar(A, B);
    assert.equal(m.gamif.puntos, base + 50);
    assert.equal(tareasDelDia(hoy, m).filter(x => x.id === "ntn0000000002").length, 1);
    assert.equal(tareasDelDia(agSumar(hoy, 1), m).length, 2, "las que pasaron a mañana, sin duplicarse");
    assert.equal(m.postits.filter(x => x.id === "nnn0000000003").length, 1);
    assert.equal(m.vida.diario.filter(x => x.fecha === hoy && x.fromRitual).length, 1);
    assert.equal(m.norte.hechos.length, 5); assert.ok(m.norte.hechos.every(x => x.ts === 1000), "con la fecha más antigua");
  });
  test("ya marcado a mano, de dejar o en pausa: no paga de nuevo ni cambia nada (pero se confirma)", () => {
    const s = nuevoEstado();
    s.habitos.log[mk] = { hn1: { [dia]: true } }; ledgerRegistrar(s, "habito:hn1:" + hoy, 5, 5);
    const p0 = s.gamif.puntos;
    const r = aplicar([ped(1, "habito", { hid: "hn1" }), ped(2, "habito", { hid: "hn2" }), ped(3, "habito", { hid: "hn3" })], s);
    assert.equal(r.aplicados.length, 0); assert.equal(r.hechos.length, 3); assert.equal(s.gamif.puntos, p0);
    assert.equal(s.gamif.ledger.filter(m => m.id === "habito:hn1:" + hoy).length, 1);
  });
  test("un hábito que este documento todavía no tiene: se queda en la bandeja (2 días); después se descarta", () => {
    const s = nuevoEstado(), viejo = { id: "n0000000099", tipo: "habito", datos: { fecha: hoy, hid: "nada" }, creado: new Date(t0 - 3 * 864e5).toISOString() };
    const r = aplicar([ped(4, "habito", { hid: "nada" }), viejo], s, { now: t0 + 3600e3 });
    assert.deepEqual(clone(r.esperan), ["n0000000004"], "el reciente espera: ni se confirma ni se anota como hecho");
    assert.deepEqual(clone(r.hechos), ["n0000000099"], "el de hace 3 días se descarta (se confirma para que salga)");
    assert.ok(!s.norte.hechos.some(x => x.id === "n0000000004"));
    // llega el hábito (de otro equipo): en la próxima vuelta se aplica
    s.habitos.defs.push({ id: "nada", nombre: "Nadar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" });
    const r2 = aplicar([ped(4, "habito", { hid: "nada" })], s, { now: t0 + 3700e3 });
    assert.deepEqual([clone(r2.hechos), r2.aplicados.length, s.habitos.log[mk].nada[dia]], [["n0000000004"], 1, true]);
  });
  test("una tarea de ayer va a hoy; cerrar un día sin abrir no se puede; un día cerrado no se reabre por voz", () => {
    const s = nuevoEstado();
    const ayer = agSumar(hoy, -1);
    const r = aplicar([ped(1, "tarea", { texto: "Pendiente de ayer", fecha: ayer }), ped(2, "cerrar", { animo: 3 })], s);
    assert.ok(buscarTarea(s, hoy, "ntn0000000001"), "a tu lista de hoy");
    assert.equal(r.aplicados[1].tipo, "cerrar-sin-abrir"); assert.ok(!(s.ritual.dias[hoy] && s.ritual.dias[hoy].cerrado));
    assert.equal(resumen({ aplicados: [r.aplicados[1]], estrellas: 0 }), "🧭 Norte no pudo cerrar tu día: no estaba abierto");
    s.ritual.dias[hoy] = { hecho: true, cerrado: true, sapo: "Antes", ts: 1 };
    const r3 = aplicar([ped(3, "abrir", { primer_bocado: "Otra cosa" })], s);
    assert.equal(r3.aplicados.length, 0); assert.equal(s.ritual.dias[hoy].sapo, "Antes");
    s.ritual.dias[hoy] = { hecho: true, sapo: "Antes", ts: 1 };
    assert.equal(aplicar([ped(4, "abrir", { primer_bocado: "" })], s).aplicados.length, 0, "abierto y sin bocado nuevo: no lo borra");
    assert.equal(s.ritual.dias[hoy].sapo, "Antes");
  });
  test("lo raro no entra: ids que no son de la bandeja, tipos desconocidos y textos vacíos", () => {
    const s = nuevoEstado();
    const r = aplicar([{ id: "MAL!", tipo: "nota", datos: { texto: "x" } }, ped(1, "bailar", {}), ped(2, "nota", { texto: "   " }), null, "x"], s);
    assert.deepEqual(clone(r.hechos), ["n0000000001", "n0000000002"]); assert.equal(r.aplicados.length, 0);
    assert.equal((s.postits || []).length, 0);
  });
  test("los pedidos aplicados se recuerdan 21 días y se juntan entre equipos", () => {
    const s = nuevoEstado(), ahora = Date.now();
    s.norte = { hechos: [{ id: "viejo1234", ts: ahora - 30 * 864e5 }, { id: "nuevo1234", ts: ahora - 864e5 }] };
    limpiar(s, ahora); assert.deepEqual(clone(s.norte.hechos.map(x => x.id)), ["nuevo1234"]);
    const m = norteMerge({ hechos: [{ id: "a1234567", ts: 5 }, { id: "b1234567", ts: 9 }] }, { hechos: [{ id: "b1234567", ts: 3 }, { id: "c1234567", ts: 7 }] });
    assert.deepEqual(clone(m.hechos.map(x => x.id + ":" + x.ts)), ["b1234567:3", "a1234567:5", "c1234567:7"]);
  });
}
