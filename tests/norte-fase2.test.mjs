/* Tests de 🧭 Norte, fase 2 (2026-11-20): lo nuevo de «hoy» (jardín, hábitos con hora, alcancías y lo que lees), las
   alarmas, los recordatorios, mover una tarea, la alcancía, el diario, la lectura, lo de tus amigos (ánimos, hábitos en
   conjunto, planes y cumpleaños) y tu año, en el servidor (notifier/norte.mjs, con un Supabase falso y sin red), y cómo
   la app aplica cada tipo nuevo de la bandeja (norteAplicar de js/norte.js): una vez, con ids fijos y las ⭐ de siempre */
export default async function ({ G, test, assert, clone }) {
  console.log("\nNorte, tu brújula: fase 2 (alarmas, recordatorios, tareas, alcancías, diario, lectura, amigos y tu año)");
  const { atenderNorte, hashToken, buscarPorNombre, alarmaLimpia, alarmasDe, laminasAnio, PEDIDOS_HORA, ALARMAS_MAX } = await import("../notifier/norte.mjs");

  /* ---------- Un Supabase falso: tablas en memoria con eq/gte/lte/in, conteo, insert y errores por tabla ---------- */
  function sbFalso(tablas, ahora, op = {}) {
    const log = { inserts: [] };
    const T = n => (tablas[n] = tablas[n] || []);
    function consulta(nombre) {
      const filtros = []; let modo = "select", opc = {}, filas = null, cambios = null, unico = false, cols = "";
      const q = {
        select(c, o) { if (modo === "select") { opc = o || {}; cols = String(c || ""); } return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        lte(k, v) { filtros.push(r => String(r[k]) <= String(v)); return q; },
        in(k, vs) { filtros.push(r => vs.includes(r[k])); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        if ((op.sinTablas || []).includes(nombre)) return { data: null, count: null, error: { message: `relation "public.${nombre}" does not exist` } };
        if (op.sinCreado && nombre === "habitos_conjunto_marcas" && cols.includes("creado")) return { data: null, error: { message: "column habitos_conjunto_marcas.creado does not exist" } };
        const t = T(nombre);
        if (modo === "insert") { filas.forEach(f => { t.push(Object.assign({ creado: ahora.toISOString() }, f)); log.inserts.push({ tabla: nombre, f }); }); return { data: null, error: null }; }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); return { data: null, error: null }; }
        if (opc.head) return { data: null, count: sel.length, error: null };
        // solo las columnas pedidas (como PostgREST), si es una lista simple
        const pocas = cols && /^[a-z_, ]+$/.test(cols) ? cols.split(",").map(c => c.trim()) : null;
        const ver = r => (pocas ? Object.fromEntries(pocas.filter(c => c in r).map(c => [c, r[c]])) : Object.assign({}, r));
        return { data: unico ? (sel[0] ? ver(sel[0]) : null) : sel.map(ver), error: null };
      }
      return q;
    }
    return { tablas, log, from: consulta, rpc: async () => ({ data: null, error: null }) };
  }
  const sinEmoji = t => typeof t === "string" && t.length > 0 && !/\p{Extended_Pictographic}/u.test(t);
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32);
  const AHORA = new Date("2026-11-20T15:00:00Z"), HOY = "2026-11-20", H = 3600e3;   // 12:00 en Santiago (horario de verano), viernes
  const marcasNov = Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, true]));
  const estado = () => ({
    settings: {
      notif: { tz: "America/Santiago" },
      norte: {
        alarmas: { ts: 1000, lista: [{ id: "a1", hora: "07:30", dias: [5, 1, 2, 3, 4], nombre: "Despertar", activa: true }, { id: "malo", hora: "25:00" }], dormir: "23:00", amanecer: 15, sonido: "marimba" },
        recordatorios: [
          { id: "r1", que: "Llamar al banco", cuando: AHORA.getTime() + 2 * H, avisado: false, ts: 1 },
          { id: "r2", que: "Uno viejo", cuando: AHORA.getTime() - 3 * 24 * H, avisado: true, ts: 1 },
          { id: "r3", que: "Borrado", cuando: AHORA.getTime() + H, borrado: true, ts: 1 },
          { id: "r4", que: "Avisado hace poco", cuando: AHORA.getTime() - 2 * H, avisado: true, ts: 1 },
        ],
      },
    },
    habitos: {
      defs: [
        { id: "h1", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01", hora: "08:00" },
        { id: "h2", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-01-01", hora: "21:00" },
        { id: "h3", nombre: "Fumar", meta: "dejar", creado: "2026-01-01", hora: "10:00" },
        { id: "h4", nombre: "Correr", frecuencia: { tipo: "diario" }, creado: "2026-01-01", pausado: true, hora: "07:00" },
      ],
      log: { "2026-11": { h1: marcasNov } },
    },
    ritual: { dias: {} },
    agenda: { dias: { [HOY]: [
      { id: "t1", txt: "Pagar la luz", ambito: "per", estado: "pendiente" },
      { id: "t2", txt: "Pagar el agua", ambito: "per", estado: "pendiente" },
      { id: "t3", txt: "Correo", estado: "hecha", done: true },
      { id: "t4", txt: "Escribir el informe", ambito: "pro", estado: "pendiente" },
    ] } },
    alcancias: { lista: [
      { id: "al1", nombre: "Viaje 🌴", meta: 1000000, aportes: [{ id: "ap1", monto: 600000 }, { id: "ap2", monto: 50000 }], b: ["ap2"] },
      { id: "al2", nombre: "Bicicleta", meta: 300000, aportes: [], b: [] },
      { id: "al3", nombre: "La cerrada", meta: 10, cerrada: 123, aportes: [] },
      { id: "al4", nombre: "Borrada", meta: 10, aportes: [] },
    ], borradas: ["al4"] },
    lecturas: [
      { id: "l1", titulo: "Cien años de soledad", autor: "Gabriel García Márquez", estado: "leyendo", pagina: 120, paginas: 471 },
      { id: "l2", titulo: "El principito", estado: "terminado", fin: "2026-05-01", paginas: 96 },
      { id: "l3", titulo: "Rayuela", estado: "leyendo", pagina: 0, paginas: 0 },
    ],
    agua: { meta: 2000, vaso: 250, dias: {} },
  });
  const nuevoSb = (cambia = {}, op = {}, ahora = AHORA) => {
    const data = estado(); if (cambia.data) cambia.data(data);
    return sbFalso(Object.assign({
      estado_usuario: [{ user_id: U, data }],
      norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }],
      norte_pendientes: [], agua_pendientes: [],
    }, cambia.tablas || {}), ahora, op);
  };
  const pedir = (sb, body, ahora = AHORA) => atenderNorte({ sb, body, autorizacion: "Bearer " + TOKEN, ip: "1.2.3.4", ahora, red: async () => ({ ok: false }) });
  const enBandeja = (sb, tipo) => sb.log.inserts.filter(x => x.tabla === "norte_pendientes" && (!tipo || x.f.tipo === tipo)).map(x => x.f);
  const pend = (id, tipo, datos, min = 10) => ({ id, user_id: U, tipo, datos, creado: new Date(AHORA.getTime() - min * 60e3).toISOString() });

  /* ---------- Palabras ---------- */
  test("buscarPorNombre: igual, por la primera palabra, por parte del nombre y por palabras", () => {
    const xs = [{ nombre: "Ana Pérez" }, { nombre: "Mariana" }, { nombre: "Pagar la luz" }, { nombre: "Pagar el agua" }];
    assert.deepEqual(buscarPorNombre(xs, "ana").map(x => x.nombre), ["Ana Pérez"], "«Ana» es Ana Pérez, no Mariana");
    assert.deepEqual(buscarPorNombre(xs, "mariana").map(x => x.nombre), ["Mariana"]);
    assert.deepEqual(buscarPorNombre(xs, "pagar").map(x => x.nombre), ["Pagar la luz", "Pagar el agua"], "dos que calzan: ambiguo");
    assert.deepEqual(buscarPorNombre(xs, "pagar luz").map(x => x.nombre), ["Pagar la luz"], "por palabras");
    assert.deepEqual(buscarPorNombre(xs, ""), []);
  });

  /* ---------- hoy: jardín, hábitos con hora, alcancías y lo que lees ---------- */
  const h0 = (await pedir(nuevoSb(), { accion: "hoy" })).cuerpo.datos;
  const hB = (await pedir(nuevoSb({ tablas: { norte_pendientes: [
    pend("n00000001", "habito", { hid: "h1", fecha: HOY }),
    pend("n00000002", "alcancia", { aid: "al1", monto: 40000, fecha: HOY }),
    pend("n00000003", "lectura", { lid: "l1", pagina: 150, min: 30, fecha: HOY }),
    pend("n00000004", "tarea_mover", { tid: "t1", destino: "manana", fecha: HOY }),
  ] } }), { accion: "hoy" })).cuerpo.datos;
  test("hoy: las macetas del jardín (como jardinEscena: días cumplidos hacia 66 y si está hecho hoy)", () => {
    assert.ok(Array.isArray(h0.jardin) && h0.jardin.length >= 2 && h0.jardin.length <= 3, "hasta tres macetas");
    assert.deepEqual(h0.jardin[0], { nombre: "Meditar", dias: 19, hecho_hoy: false });
    assert.deepEqual(h0.jardin[1], { nombre: "Leer", dias: 0, hecho_hoy: false });
    assert.ok(!h0.jardin.some(m => m.nombre === "Correr"), "los en pausa no van en maceta");
    assert.deepEqual(hB.jardin[0], { nombre: "Meditar", dias: 20, hecho_hoy: true }, "marcado por voz (en la bandeja): crece y sale hecho");
  });
  test("hoy: los hábitos de hoy con hora para recordar (h.hora), en orden, sin los de dejar ni los en pausa", () => {
    assert.deepEqual(h0.habitos_hora, [{ nombre: "Meditar", hora: "08:00", hecho: false }, { nombre: "Leer", hora: "21:00", hecho: false }]);
    assert.equal(hB.habitos_hora[0].hecho, true, "lo marcado en la bandeja ya cuenta");
  });
  test("hoy: tus alcancías abiertas (sin las cerradas ni borradas; lo deshecho no cuenta) y lo que espera en la bandeja", () => {
    assert.deepEqual(h0.alcancias, [{ id: "al1", nombre: "Viaje", meta: 1000000, total: 600000 }, { id: "al2", nombre: "Bicicleta", meta: 300000, total: 0 }]);
    assert.equal(hB.alcancias[0].total, 640000, "con el aporte que espera");
  });
  test("hoy: los libros de «Leyendo ahora» con su página (la de la bandeja si la dijiste a Norte)", () => {
    assert.deepEqual(h0.leyendo, [
      { id: "l1", titulo: "Cien años de soledad", autor: "Gabriel García Márquez", pagina: 120, paginas: 471 },
      { id: "l3", titulo: "Rayuela", autor: null, pagina: 0, paginas: 0 },
    ]);
    assert.equal(hB.leyendo[0].pagina, 150);
    assert.equal(hB.semana.numeros.foco_min, 30, "los minutos de lectura cuentan como foco de la semana");
    assert.ok(!hB.tareas.some(t => t.id === "t1") && hB.tareas_pendientes === h0.tareas_pendientes - 1, "la tarea que pasó a mañana ya no está pendiente hoy");
  });

  /* ---------- Alarmas ---------- */
  const al0 = await pedir(nuevoSb(), { accion: "alarmas" });
  const alV = await pedir(nuevoSb({ data: d => { delete d.settings.norte; } }), { accion: "alarmas" });
  const robot = { ts: 5000, lista: [{ id: "x1", hora: "06:45", dias: [], fecha: "2026-11-21", nombre: "Vuelo", sonido: "ola", activa: true }], dormir: null, amanecer: 0, sonido: "pajaros" };
  const alB = await pedir(nuevoSb({ tablas: { norte_pendientes: [pend("n00000010", "alarmas", robot)] } }), { accion: "alarmas" });
  test("alarmas: las de Rumbo (settings.norte.alarmas, con su ts), con lo que falte puesto y sin las que vienen mal", () => {
    assert.equal(al0.status, 200); assert.ok(sinEmoji(al0.cuerpo.texto));
    const { ajustes: _a, ...soloAlarmas } = al0.cuerpo.datos;
    assert.deepEqual(soloAlarmas, { ts: 1000, lista: [{ id: "a1", hora: "07:30", dias: [1, 2, 3, 4, 5], fecha: null, nombre: "Despertar", sonido: null, activa: true }], dormir: "23:00", amanecer: 15, sonido: "marimba" });
    assert.match(al0.cuerpo.texto, /Tienes una alarma a las 7:30, de lunes a viernes\./);
    assert.deepEqual(Object.assign({}, alV.cuerpo.datos, { ajustes: undefined }), { ts: 0, lista: [], dormir: null, amanecer: 10, sonido: "campanas", ajustes: undefined }, "sin alarmas: lo de siempre del robot");
    assert.equal(alV.cuerpo.texto, "No tienes alarmas.");
  });
  test("alarmas: si el robot dejó unas más nuevas en la bandeja (la app todavía no las aplica), esas", () => {
    assert.equal(alB.cuerpo.datos.ts, 5000); assert.equal(alB.cuerpo.datos.lista[0].nombre, "Vuelo"); assert.equal(alB.cuerpo.datos.amanecer, 0);
  });
  test("alarmaLimpia y alarmasDe: lo que entienden la app y el robot", () => {
    assert.equal(alarmaLimpia({ id: "a", hora: "7:30" }), null, "la hora va con dos dígitos");
    assert.equal(alarmaLimpia({ id: "a", hora: "07:30", dias: [7] }), null);
    assert.equal(alarmaLimpia({ id: "a", hora: "07:30", sonido: "gong" }), null);
    assert.deepEqual(alarmaLimpia({ id: "a", hora: "07:30", dias: [], fecha: "2026-11-21" }), { id: "a", hora: "07:30", dias: [], fecha: "2026-11-21", nombre: "", sonido: null, activa: true });
    assert.equal(alarmaLimpia({ id: "a", hora: "07:30", dias: [1], fecha: "2026-11-21" }).fecha, null, "las que se repiten no llevan fecha");
    assert.equal(alarmasDe({ amanecer: 0 }).amanecer, 0, "cero es sin amanecer (no el de siempre)");
  });
  const sbG = nuevoSb(), gA = await pedir(sbG, { accion: "guardar_alarmas", ts: 2000, lista: robot.lista, dormir: "22:30", amanecer: 20, sonido: "brujula" });
  const gViejo = await pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 900, lista: [] });
  const sbF = nuevoSb(), gFut = await pedir(sbF, { accion: "guardar_alarmas", ts: AHORA.getTime() + 864e5, lista: [] });
  const gMal = await Promise.all([
    pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 2000, lista: [{ id: "x", hora: "99:00" }] }),
    pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 2000, lista: Array.from({ length: ALARMAS_MAX + 1 }, (_, i) => ({ id: "x" + i, hora: "07:00" })) }),
    pedir(nuevoSb(), { accion: "guardar_alarmas", lista: [] }),
    pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 2000, lista: [{ id: "x", hora: "07:00" }, { id: "x", hora: "08:00" }] }),
    pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 2000, lista: [], amanecer: 45 }),
    pedir(nuevoSb(), { accion: "guardar_alarmas", ts: 2000, lista: [], sonido: "gong" }),
  ]);
  test("guardar_alarmas: van a la bandeja como «alarmas» con su ts; si las de Rumbo son más nuevas, el robot recibe esas", () => {
    assert.equal(gA.status, 200); assert.ok(sinEmoji(gA.cuerpo.texto));
    const p = enBandeja(sbG, "alarmas");
    assert.equal(p.length, 1); assert.deepEqual(p[0].datos, { ts: 2000, lista: [robot.lista[0]], dormir: "22:30", amanecer: 20, sonido: "brujula" });
    assert.equal(gViejo.status, 200); assert.equal(gViejo.cuerpo.datos.ya, true); assert.equal(gViejo.cuerpo.datos.ts, 1000);
    assert.equal(gViejo.cuerpo.datos.lista[0].id, "a1", "las de Rumbo, para que el robot las ponga");
    assert.equal(enBandeja(sbF, "alarmas")[0].datos.ts, AHORA.getTime(), "un reloj adelantado no deja las alarmas trabadas en el futuro");
    for (const r of gMal) { assert.equal(r.status, 400); assert.equal(r.cuerpo.error, "dato-invalido"); assert.ok(sinEmoji(r.cuerpo.texto)); }
  });

  /* ---------- Ajustes de Norte (la pantalla «Norte, tu brújula») ---------- */
  const aj0 = await pedir(nuevoSb(), { accion: "ajustes" });
  const ajC = await pedir(nuevoSb({ data: d => { d.settings.norte.ajustes = { ts: 77, agua: false, planes: false, noche: { auto: false, desde: "22:30", hasta: "6:00" }, aburrido: false, pregunta_cierre: false }; } }), { accion: "ajustes" });
  test("ajustes: todos encendidos y la noche automática si nunca se tocaron; sin pregunta_cierre (es solo de la app)", () => {
    assert.equal(aj0.status, 200); assert.ok(sinEmoji(aj0.cuerpo.texto));
    assert.deepEqual(aj0.cuerpo.datos, { ts: 0, agua: true, agenda: true, habitos: true, amigos: true, planes: true, avisos_dia: true, noche: { auto: true, desde: "23:00", hasta: "07:00" }, aburrido: true });
    assert.deepEqual(ajC.cuerpo.datos, { ts: 77, agua: false, agenda: true, habitos: true, amigos: true, planes: false, avisos_dia: true, noche: { auto: false, desde: "22:30", hasta: "07:00" }, aburrido: false });
    assert.equal(ajC.cuerpo.texto, "Tienes 2 avisos apagados.");
    assert.deepEqual(al0.cuerpo.datos.ajustes, aj0.cuerpo.datos, "«alarmas» los trae también, para un solo pedido");
  });

  /* ---------- Recordatorios ---------- */
  const rec0 = await pedir(nuevoSb(), { accion: "recordatorios" });
  const sbR = nuevoSb(), rN = await pedir(sbR, { accion: "recordar", que: "Sacar la basura", cuando: AHORA.getTime() + 6 * H });
  const pidR = enBandeja(sbR, "recordatorio")[0];
  const recB = await pedir(sbR, { accion: "recordatorios" });
  const rListo = await pedir(sbR, { accion: "recordatorio_listo", id: rN.cuerpo.datos.id });
  const rListo2 = await pedir(sbR, { accion: "recordatorio_listo", id: rN.cuerpo.datos.id });
  const rBorrar = await pedir(sbR, { accion: "borrar_recordatorio", id: "r1" });
  const recFin = await pedir(sbR, { accion: "recordatorios" });
  const rMal = await Promise.all([
    pedir(nuevoSb(), { accion: "recordar", que: "", cuando: AHORA.getTime() + H }),
    pedir(nuevoSb(), { accion: "recordar", que: "Algo", cuando: AHORA.getTime() - H }),
    pedir(nuevoSb(), { accion: "recordar", que: "Algo", cuando: "mañana" }),
    pedir(nuevoSb(), { accion: "recordar", que: "x".repeat(201), cuando: AHORA.getTime() + H }),
    pedir(nuevoSb(), { accion: "recordatorio_listo", id: "no existe" }),
  ]);
  const rNo = await pedir(nuevoSb(), { accion: "recordatorio_listo", id: "nr123" });
  const rManana = await pedir(nuevoSb(), { accion: "recordar", que: "Remedio", cuando: Date.parse("2026-11-21T11:00:00Z") });
  test("recordatorios: los por avisar y los avisados de las últimas 24 horas (sin los borrados), en orden", () => {
    assert.deepEqual(rec0.cuerpo.datos.lista.map(r => r.id), ["r4", "r1"]);
    assert.deepEqual(rec0.cuerpo.datos.lista[1], { id: "r1", que: "Llamar al banco", cuando: AHORA.getTime() + 2 * H, avisado: false });
    assert.equal(rec0.cuerpo.texto, "Tienes un recordatorio. El próximo: Llamar al banco, a las 14:00.");
  });
  test("recordar: va a la bandeja con id fijo «nr<pedido>» y ya cuenta en «recordatorios»", () => {
    assert.equal(rN.status, 200); assert.ok(sinEmoji(rN.cuerpo.texto));
    assert.equal(rN.cuerpo.texto, "Listo, te recuerdo a las 18:00: Sacar la basura.");
    assert.deepEqual(pidR.datos, { op: "crear", id: "nr" + pidR.id, que: "Sacar la basura", cuando: AHORA.getTime() + 6 * H });
    assert.equal(rN.cuerpo.datos.id, "nr" + pidR.id);
    assert.ok(recB.cuerpo.datos.lista.some(r => r.id === rN.cuerpo.datos.id && !r.avisado));
    assert.match(rManana.cuerpo.texto, /mañana a las 8:00/);
  });
  test("recordatorio_listo y borrar_recordatorio: a la bandeja; «recordatorios» ya lo ve avisado o sin el borrado", () => {
    assert.equal(rListo.status, 200); assert.equal(rListo2.cuerpo.datos.ya, true, "dos veces no pide dos veces");
    assert.deepEqual(enBandeja(sbR, "recordatorio").slice(1).map(p => p.datos), [{ op: "avisado", id: rN.cuerpo.datos.id }, { op: "borrar", id: "r1" }]);
    assert.match(rBorrar.cuerpo.texto, /Llamar al banco/);
    const l = recFin.cuerpo.datos.lista;
    assert.ok(!l.some(r => r.id === "r1"), "el borrado ya no está"); assert.equal(l.find(r => r.id === rN.cuerpo.datos.id).avisado, true);
    for (const r of rMal) { assert.equal(r.status, 400); assert.ok(sinEmoji(r.cuerpo.texto)); }
    assert.deepEqual([rNo.status, rNo.cuerpo.error], [404, "recordatorio-no-encontrado"]);
  });

  /* ---------- Mover una tarea ---------- */
  const sbM = nuevoSb(), m1 = await pedir(sbM, { accion: "mover_tarea", tarea: "pagar la luz", destino: "manana" });
  const m2 = await pedir(nuevoSb(), { accion: "mover_tarea", tarea: "pagar", destino: "soltar" });
  const sbD = nuevoSb(), m3 = await pedir(sbD, { accion: "mover_tarea", tid: "t4", destino: "delegar", a: "Camila" });
  const m4 = await pedir(nuevoSb(), { accion: "mover_tarea", tarea: "correo", destino: "manana" });
  const m5 = await pedir(nuevoSb(), { accion: "mover_tarea", tarea: "informe", destino: "volar" });
  const m6 = await pedir(sbM, { accion: "hoy" });
  test("mover_tarea: por nombre o id, a la bandeja como «tarea_mover»; ambigua, no encontrada (las hechas no) o destino raro", () => {
    assert.equal(m1.status, 200); assert.equal(m1.cuerpo.texto, "Listo, Pagar la luz pasa a mañana.");
    assert.deepEqual(enBandeja(sbM, "tarea_mover")[0].datos, { tid: "t1", fecha: HOY, destino: "manana", texto: "Pagar la luz" });
    assert.deepEqual([m2.status, m2.cuerpo.error], [400, "tarea-ambigua"]); assert.match(m2.cuerpo.texto, /Pagar la luz o Pagar el agua/);
    assert.equal(m3.cuerpo.texto, "Listo, le delegaste Escribir el informe a Camila.");
    assert.equal(enBandeja(sbD, "tarea_mover")[0].datos.a, "Camila");
    assert.deepEqual([m4.status, m4.cuerpo.error], [404, "tarea-no-encontrada"]);
    assert.deepEqual([m5.status, m5.cuerpo.error], [400, "dato-invalido"]);
    assert.ok(!m6.cuerpo.datos.tareas.some(t => t.id === "t1"), "en «hoy» ya no está pendiente");
  });

  /* ---------- Alcancía ---------- */
  const sbK = nuevoSb(), k1 = await pedir(sbK, { accion: "alcancia", alcancia: "viaje", monto: 40000 });
  const k2 = await pedir(nuevoSb(), { accion: "alcancia", monto: 1000 });
  const k3 = await pedir(nuevoSb({ data: d => { d.alcancias.lista = d.alcancias.lista.filter(a => a.id === "al2"); } }), { accion: "alcancia", monto: "300.000" });
  const k4 = await pedir(nuevoSb(), { accion: "alcancia", alcancia: "cerrada", monto: 1000 });
  const k5 = await pedir(nuevoSb(), { accion: "alcancia", alcancia: "viaje", monto: 0 });
  const k6 = await pedir(sbK, { accion: "hoy" });
  test("alcancia: guarda el monto (a la bandeja como «alcancia») y dice lo que falta; con una sola, es esa", () => {
    assert.equal(k1.status, 200); assert.equal(k1.cuerpo.texto, "Guardé 40.000 pesos en Viaje. Te faltan 360.000 pesos.");
    assert.deepEqual(enBandeja(sbK, "alcancia")[0].datos, { aid: "al1", monto: 40000, fecha: HOY, nombre: "Viaje" });
    assert.deepEqual([k1.cuerpo.datos.total, k1.cuerpo.datos.falta, k1.cuerpo.datos.llena], [640000, 360000, false]);
    assert.deepEqual([k2.status, k2.cuerpo.error], [400, "alcancia-ambigua"], "con dos abiertas, pregunta cuál");
    assert.equal(k3.cuerpo.texto, "Guardé 300.000 pesos en Bicicleta. Llenaste Bicicleta, bien hecho.");
    assert.deepEqual([k4.status, k4.cuerpo.error], [404, "alcancia-no-encontrada"], "las cerradas no reciben");
    assert.deepEqual([k5.status, k5.cuerpo.error], [400, "dato-invalido"]);
    assert.equal(k6.cuerpo.datos.alcancias[0].total, 640000);
  });

  /* ---------- Diario ---------- */
  const sbDi = nuevoSb(), di1 = await pedir(sbDi, { accion: "diario", texto: "Hoy fue un buen día.\nAprendí algo nuevo." });
  const di2 = await pedir(nuevoSb(), { accion: "diario", texto: "x".repeat(1001) }), di3 = await pedir(nuevoSb(), { accion: "diario", texto: "  " });
  test("diario: tal cual lo dices (con sus líneas, hasta 1000), a la bandeja como «diario»", () => {
    assert.equal(di1.status, 200); assert.equal(di1.cuerpo.texto, "Lo guardé en tu diario.");
    assert.deepEqual(enBandeja(sbDi, "diario")[0].datos, { texto: "Hoy fue un buen día.\nAprendí algo nuevo.", fecha: HOY });
    assert.deepEqual([di2.status, di3.status], [400, 400]);
  });

  /* ---------- Lectura ---------- */
  const sbL = nuevoSb(), l1 = await pedir(sbL, { accion: "lectura", libro: "cien años", pagina: 140, minutos: 25 });
  const l2 = await pedir(nuevoSb(), { accion: "lectura", pagina: 10 });
  const l3 = await pedir(nuevoSb(), { accion: "lectura", id: "l1", pagina: 500 });
  const l4 = await pedir(nuevoSb(), { accion: "lectura", libro: "principito", pagina: 10 });
  const l5 = await pedir(nuevoSb(), { accion: "lectura", id: "l1" });
  const sbL6 = nuevoSb(), l6 = await pedir(sbL6, { accion: "lectura", libro: "rayuela", minutos: 15 });
  test("lectura: la página del libro de «Leyendo ahora» y, con minutos, un foco de lectura (a la bandeja como «lectura»)", () => {
    assert.equal(l1.status, 200); assert.equal(l1.cuerpo.texto, "Guardé 25 minutos de lectura y anoté la página 140 de Cien años de soledad: 20 páginas más.");
    const d = enBandeja(sbL, "lectura")[0].datos;
    assert.deepEqual([d.lid, d.pagina, d.min, d.completa, d.fecha], ["l1", 140, 25, true, HOY]); assert.equal(d.ini, AHORA.getTime() - 25 * 60e3);
    assert.deepEqual([l2.status, l2.cuerpo.error], [400, "libro-ambiguo"], "con dos libros, pregunta cuál");
    assert.equal(l3.cuerpo.datos.pagina, 471, "no pasa del total"); assert.equal(l3.cuerpo.datos.termino, true); assert.match(l3.cuerpo.texto, /Lo terminaste/);
    assert.deepEqual([l4.status, l4.cuerpo.error], [404, "libro-no-encontrado"], "los terminados no están en «Leyendo ahora»");
    assert.deepEqual([l5.status, l5.cuerpo.error], [400, "dato-invalido"], "sin página ni minutos");
    assert.equal(l6.cuerpo.texto, "Guardé 15 minutos de lectura."); assert.equal(enBandeja(sbL6, "lectura")[0].datos.pagina, undefined);
  });

  /* ---------- Amigos: social, ánimo y el buenos días ---------- */
  const F1 = "00000000-0000-0000-0000-0000000000f1", F2 = "00000000-0000-0000-0000-0000000000f2", F3 = "00000000-0000-0000-0000-0000000000f3";
  const iso = ms => new Date(ms).toISOString();
  const amigosTablas = () => ({
    amistades: [{ a: U, b: F1, estado: "aceptada" }, { a: F2, b: U, estado: "aceptada" }, { a: U, b: F3, estado: "pendiente" }],
    perfiles: [{ user_id: F1, nombre: "Ana Pérez", estado: { cumple: "11-20" } }, { user_id: F2, nombre: "Pedro", estado: {} }, { user_id: F3, nombre: "Mariana", estado: { cumple: "11-20" } }],
    animos: [{ id: 1, de: F1, para: U, creado: iso(AHORA - H) }, { id: 2, de: F2, para: U, creado: iso(AHORA - 3 * 24 * H) }],
    habitos_conjunto: [{ id: "hc1", nombre: "Caminar 🚶", frecuencia: { tipo: "diario" }, creado: "2026-11-01" }],
    habitos_conjunto_miembros: [{ habito: "hc1", user_id: U, estado: "activo", desde: "2026-11-01" }, { habito: "hc1", user_id: F1, estado: "activo", desde: "2026-11-01" }],
    habitos_conjunto_marcas: ["2026-11-18", "2026-11-19", "2026-11-20"].flatMap((f, i) => [
      { habito: "hc1", user_id: U, fecha: f, creado: iso(AHORA - (3 - i) * 24 * H) },
      { habito: "hc1", user_id: F1, fecha: f, creado: f === HOY ? iso(AHORA - 30 * 60e3) : iso(AHORA - (3 - i) * 24 * H) },
    ]),
    habitos_conjunto_descansos: [],
    planes_invitados: [{ plan: "p1", user_id: U, respuesta: "voy" }, { plan: "p2", user_id: U, respuesta: "no" }, { plan: "p3", user_id: U, respuesta: "quizas" }, { plan: "p4", user_id: U, respuesta: "voy" }],
    planes: [
      { id: "p1", titulo: "Cine", fecha: HOY, hora: "21:00", lugar: "Costanera", tz: "America/Santiago", cancelado: false },
      { id: "p2", titulo: "No voy", fecha: HOY, hora: "18:00", lugar: "", tz: "America/Santiago", cancelado: false },
      { id: "p3", titulo: "Asado", fecha: "2026-11-21", hora: null, lugar: "", tz: "America/Santiago", cancelado: false },
      { id: "p4", titulo: "Cancelado", fecha: HOY, hora: "10:00", lugar: "", tz: "America/Santiago", cancelado: true },
    ],
  });
  const so = await pedir(nuevoSb({ tablas: amigosTablas() }), { accion: "social", desde: AHORA.getTime() - 2 * H });
  const soSinCreado = await pedir(nuevoSb({ tablas: amigosTablas() }, { sinCreado: true }), { accion: "social", desde: AHORA.getTime() - 2 * H });
  const soVacio = await pedir(nuevoSb({}, { sinTablas: ["amistades", "animos", "habitos_conjunto_miembros", "planes_invitados"] }), { accion: "social" });
  test("social: los ánimos que te llegaron y las marcas de tus amigos en conjunto desde «desde», con la racha del grupo", () => {
    const d = so.cuerpo.datos;
    assert.equal(so.status, 200); assert.ok(sinEmoji(so.cuerpo.texto));
    assert.deepEqual(d.animos, [{ de: "Ana Pérez", ts: AHORA - H }], "solo los nuevos");
    assert.equal(d.conjunto.length, 1, "solo la marca nueva de Ana (las tuyas no)");
    assert.deepEqual(d.conjunto[0], { habito: "Caminar", quien: "Ana Pérez", inicial: "A", racha: 3, unidad: "días", fecha: HOY, ts: AHORA - 30 * 60e3 });
    assert.match(so.cuerpo.texto, /Ana Pérez te mandó ánimo\. Ana Pérez cumplió Caminar: llevan 3 días juntos\./);
    assert.deepEqual(soSinCreado.cuerpo.datos.conjunto.map(c => [c.quien, c.fecha, c.ts]), [["Ana Pérez", HOY, Date.parse("2026-11-20T03:00:00Z")]],
      "sin la columna creado (falta norte-fase2.sql): las marcas de hoy, con ts al comienzo del día (el robot las reconoce por hábito, quién y fecha)");
  });
  test("social: los planes de hoy en que participas (vas o tal vez) y los cumpleaños de tus amigos", () => {
    const d = so.cuerpo.datos;
    assert.deepEqual(d.planes_hoy, [{ titulo: "Cine", hora: "21:00", lugar: "Costanera", ts_inicio: Date.parse("2026-11-21T00:00:00Z") }]);
    assert.deepEqual(d.cumples_hoy, ["Ana Pérez"], "Mariana no es amiga todavía (pendiente)");
    assert.match(so.cuerpo.texto, /Hoy está de cumpleaños Ana Pérez\. Hoy tienes Cine a las 21:00\./);
    assert.equal(soVacio.status, 200, "sin supabase/amigos.sql: listas vacías");
    assert.deepEqual(soVacio.cuerpo.datos, { animos: [], conjunto: [], planes_hoy: [], cumples_hoy: [] });
    assert.equal(soVacio.cuerpo.texto, "Nada nuevo de tus amigos.");
  });
  const sbAn = nuevoSb({ tablas: amigosTablas() }), an1 = await pedir(sbAn, { accion: "animo", a: "ana" });
  const an2 = await pedir(nuevoSb({ tablas: amigosTablas() }), { accion: "animo", a: "mariana" });
  const tLim = amigosTablas(); tLim.animos.push(...[1, 2, 3].map(i => ({ id: 10 + i, de: U, para: F1, creado: iso(AHORA - i * H) })));
  const an3 = await pedir(nuevoSb({ tablas: tLim }), { accion: "animo", a: "Ana Pérez" });
  const tAmb = amigosTablas(); tAmb.perfiles[1].nombre = "Ana López";
  const an4 = await pedir(nuevoSb({ tablas: tAmb }), { accion: "animo", a: "ana" });
  const an5 = await pedir(nuevoSb(), { accion: "animo", a: "ana" });
  test("animo: directo a la tabla animos (de ti a tu amigo), con las reglas de la app: amistad aceptada y 3 al día", () => {
    assert.equal(an1.status, 200); assert.equal(an1.cuerpo.texto, "Listo, le mandé ánimo a Ana Pérez.");
    const ins = sbAn.log.inserts.filter(x => x.tabla === "animos");
    assert.equal(ins.length, 1); assert.deepEqual(ins[0].f, { de: U, para: F1, mensaje: "" });
    assert.equal(enBandeja(sbAn).length, 0, "no pasa por la bandeja");
    assert.deepEqual([an2.status, an2.cuerpo.error], [404, "amigo-no-encontrado"], "una solicitud pendiente no es amistad");
    assert.deepEqual([an3.status, an3.cuerpo.error], [429, "limite-animos"]);
    assert.deepEqual([an4.status, an4.cuerpo.error], [400, "amigo-ambiguo"]); assert.match(an4.cuerpo.texto, /Ana Pérez o Ana López/);
    assert.deepEqual([an5.status, an5.cuerpo.error], [404, "amigo-no-encontrado"]); assert.match(an5.cuerpo.texto, /no tienes amigos/);
    for (const r of [an1, an2, an3, an4, an5]) assert.ok(sinEmoji(r.cuerpo.texto));
  });
  const bd = await pedir(nuevoSb({ tablas: amigosTablas() }), { accion: "buenos_dias" });
  const bdSin = await pedir(nuevoSb({}, { sinTablas: ["amistades", "planes_invitados"] }), { accion: "buenos_dias" });
  test("buenos_dias: suma los planes de hoy y los cumpleaños de tus amigos (y sin amigos, sale igual)", () => {
    assert.equal(bd.status, 200); assert.ok(sinEmoji(bd.cuerpo.texto));
    assert.match(bd.cuerpo.texto, /Hoy tienes Cine a las 21:00\. Y está de cumpleaños Ana Pérez: mándale un saludo\./);
    assert.equal(bd.cuerpo.datos.planes_hoy.length, 1); assert.deepEqual(bd.cuerpo.datos.cumples_hoy, ["Ana Pérez"]);
    assert.equal(bdSin.status, 200); assert.ok(!/cumpleaños/.test(bdSin.cuerpo.texto));
  });

  /* ---------- Tu año ---------- */
  const DIC = new Date("2026-12-05T15:00:00Z");
  const conAnio = d => {
    Object.assign(d.ritual.dias, { "2026-12-01": { hecho: true, cerrado: true }, "2026-12-02": { hecho: true, cerrado: true }, "2026-12-03": { hecho: true }, "2025-12-31": { hecho: true, cerrado: true } });
    d.agua.dias = { "2026-12-01": { r: [{ id: "v1", ml: 1000 }, { id: "v2", ml: 500 }], b: ["v2"] } };
  };
  const ta1 = await pedir(nuevoSb({ data: conAnio }), { accion: "tu_anio" });
  const ta2 = await pedir(nuevoSb({ data: conAnio }, {}, DIC), { accion: "tu_anio" }, DIC);
  const ta3 = await pedir(nuevoSb({ data: conAnio }), { accion: "tu_anio", anio: 2025 });
  const ta4 = await pedir(nuevoSb(), { accion: "tu_anio", anio: 2031 });
  test("tu_anio: desde el 1 de diciembre (como tuAnioDisponible); antes, sin láminas", () => {
    assert.deepEqual(ta1.cuerpo.datos, { anio: 2026, disponible: false, laminas: [] }); assert.match(ta1.cuerpo.texto, /1 de diciembre/);
    assert.equal(ta3.cuerpo.datos.disponible, true, "los años anteriores, siempre");
    assert.deepEqual(ta3.cuerpo.datos.laminas.map(l => l.titulo), ["Días abiertos", "Días cerrados"]);
    assert.deepEqual([ta4.status, ta4.cuerpo.error], [400, "dato-invalido"]);
  });
  test("tu_anio: las láminas con datos (días, racha, hábitos, agua, libros…), con su número y un texto para decir", () => {
    const d = ta2.cuerpo.datos;
    assert.equal(d.disponible, true); assert.ok(sinEmoji(ta2.cuerpo.texto));
    const de = t => d.laminas.find(l => l.titulo === t);
    assert.deepEqual(de("Días abiertos"), { titulo: "Días abiertos", numero: 3, unidad: "días", texto: "Abriste tu día 3 veces." });
    assert.equal(de("Días cerrados").numero, 2); assert.equal(de("Tu mejor racha").numero, 2);
    assert.equal(de("Hábitos").numero, 19); assert.equal(de("Tu agua").numero, 4, "1 litro en vasos de 250 (lo borrado no cuenta)");
    assert.equal(de("Tus libros").numero, 1); assert.equal(de("Tu foco"), undefined, "sin datos, sin lámina");
    assert.equal(laminasAnio({}, 2026, "2026-12-05").length, 0);
  });

  /* ---------- Los límites ---------- */
  const lleno = Array.from({ length: PEDIDOS_HORA }, (_, i) => pend("n9" + String(i).padStart(8, "0"), "nota", { texto: "x" }, 5));
  const lims = await Promise.all([
    { accion: "recordar", que: "Algo", cuando: AHORA.getTime() + H }, { accion: "mover_tarea", tid: "t1", destino: "soltar" },
    { accion: "alcancia", id: "al1", monto: 10 }, { accion: "diario", texto: "Hola" }, { accion: "lectura", id: "l1", pagina: 130 },
    { accion: "guardar_alarmas", ts: 9000, lista: [] }, { accion: "borrar_recordatorio", id: "r1" },
  ].map(b => pedir(nuevoSb({ tablas: { norte_pendientes: lleno.map(x => Object.assign({}, x)) } }), b)));
  test("las acciones nuevas de la bandeja tienen el mismo límite por hora que las demás (429 demasiados-pedidos)", () => {
    for (const r of lims) assert.deepEqual([r.status, r.cuerpo.error], [429, "demasiados-pedidos"]);
  });
  const sinTok = await atenderNorte({ sb: nuevoSb(), body: { accion: "alarmas" }, autorizacion: undefined, ahora: AHORA });
  test("sin token, las acciones nuevas responden 401 como las demás", () => { assert.deepEqual([sinTok.status, sinTok.cuerpo.error], [401, "no-autorizado"]); });

  /* ================= La app: aplicar los tipos nuevos (js/norte.js) ================= */
  const defaultState = G("defaultState"), migrate = G("migrate"), aplicar = G("norteAplicar"), resumen = G("norteResumen");
  const todayISO = G("todayISO"), agSumar = G("agSumar"), buscarTarea = G("buscarTarea"), ledgerVigente = G("ledgerVigente");
  const merge = G("norteAjustesMerge"), mergeStates = G("mergeStates"), cambiar = G("norteAlarmasCambiar"), alarmasApp = G("norteAlarmas");
  G("(s => { STATE = s; })")(defaultState());
  const hoy = todayISO(), manana = agSumar(hoy, 1), t0 = Date.parse(hoy + "T08:00:00");
  const ped = (n, tipo, datos) => ({ id: "n000000000" + n, tipo, datos: Object.assign({ fecha: hoy }, datos), creado: new Date(t0 + parseInt(n, 36) * 60e3).toISOString() });
  const nuevoEstado = () => {
    const s = migrate(defaultState());
    s.agenda.dias[hoy] = [
      { id: "ta", txt: "Pagar la luz", ambito: "per", estado: "pendiente", done: false, creada: hoy, migraciones: 0, origen: "ta", ts: 1 },
      { id: "tb", txt: "Llamar a Pedro", ambito: "per", estado: "pendiente", done: false, creada: hoy, migraciones: 0, origen: "tb", ts: 1 },
      { id: "tc", txt: "Revisar correo", ambito: "pro", estado: "pendiente", done: false, creada: hoy, migraciones: 0, origen: "tc", ts: 1 },
    ];
    s.alcancias = { lista: [{ id: "alx", nombre: "Viaje", meta: 100000, estilo: "greda", aportes: [{ id: "ap0", monto: 50000, ts: 1, fecha: hoy }], b: [], cerrada: 0, ts: 1 },
      { id: "aly", nombre: "Vieja", meta: 10, aportes: [], b: [], cerrada: 5, ts: 1 }], borradas: [], ocultar: false, ts: 1 };
    s.lecturas = [{ id: "lx", titulo: "Rayuela", estado: "leyendo", pagina: 10, paginas: 600, juntos: true }];
    s.settings.norte = { alarmas: { ts: 3000, lista: [{ id: "a1", hora: "07:00", dias: [1, 2, 3, 4, 5], nombre: "Despertar", activa: true }], dormir: null, amanecer: 10, sonido: "campanas" }, recordatorios: [] };
    return s;
  };
  const lista = [
    ped(1, "alarmas", { ts: 2000, lista: [], dormir: null, amanecer: 0, sonido: "ola" }),   // más viejas que las de Rumbo: no
    ped(2, "alarmas", { ts: 4000, lista: [{ id: "b1", hora: "06:30", dias: [], fecha: manana, nombre: "Vuelo", sonido: "ola", activa: true }], dormir: "23:00", amanecer: 20, sonido: "pajaros" }),
    ped(3, "recordatorio", { op: "crear", id: "nrn0000000003", que: "Sacar la basura", cuando: t0 + 10 * 3600e3 }),
    ped(4, "recordatorio", { op: "avisado", id: "nrn0000000003" }),
    ped(5, "recordatorio", { op: "crear", id: "nrn0000000005", que: "Remedio", cuando: t0 + 12 * 3600e3 }),
    ped(6, "recordatorio", { op: "borrar", id: "nrn0000000005" }),
    ped(7, "tarea_mover", { tid: "ta", destino: "manana", texto: "Pagar la luz" }),
    ped(8, "tarea_mover", { tid: "tb", destino: "delegar", a: "Camila" }),
    ped(9, "tarea_mover", { tid: "tc", destino: "soltar" }),
    ped("a", "alcancia", { aid: "alx", monto: 20000, nombre: "Viaje" }),
    ped("b", "diario", { texto: "Hoy dicté esto.\nCon dos líneas." }),
    ped("c", "lectura", { lid: "lx", pagina: 42, min: 25, completa: true, ini: t0 }),
    ped("d", "alcancia", { aid: "aly", monto: 5 }),                 // cerrada: se descarta
    ped("e", "recordatorio", { op: "avisado", id: "de-norte-desk" }),   // uno que solo vivía en Norte-Desk: nada
  ];
  const A0 = nuevoEstado(), A = clone(A0), base = A.gamif.puntos;
  const ra = aplicar(clone(lista), A);
  test("app: alarmas del robot solo si son más nuevas que las de Rumbo (por ts), y quedan limpias", () => {
    const N = A.settings.norte.alarmas;
    assert.equal(N.ts, 4000); assert.deepEqual(clone(N.lista), [{ id: "b1", hora: "06:30", dias: [], fecha: manana, nombre: "Vuelo", sonido: "ola", activa: true }]);
    assert.deepEqual([N.dormir, N.amanecer, N.sonido], ["23:00", 20, "pajaros"]);
    assert.equal(ra.aplicados.filter(x => x.tipo === "alarmas").length, 1, "las viejas no cambian nada");
  });
  test("app: recordatorios con su id fijo; «avisado» y «borrar» quedan marcados (no se pierden al juntar equipos)", () => {
    const R = A.settings.norte.recordatorios;
    assert.deepEqual(clone(R.map(r => [r.id, r.que, r.avisado, !!r.borrado])), [["nrn0000000003", "Sacar la basura", true, false], ["nrn0000000005", "Remedio", false, true]]);
  });
  test("app: mover tareas como en la agenda: a mañana (con id fijo «nm<pedido>0»), delegar y soltar", () => {
    const ta = buscarTarea(A, hoy, "ta"), copia = buscarTarea(A, manana, "nmn00000000070");
    assert.equal(ta.estado, "migrada"); assert.equal(ta.destino, manana);
    assert.ok(copia && copia.txt === "Pagar la luz" && copia.estado === "pendiente" && copia.origen === "ta" && copia.migraciones === 1, "la copia en mañana, como moverTarea");
    assert.deepEqual([buscarTarea(A, hoy, "tb").estado, buscarTarea(A, hoy, "tb").delegadaA], ["delegada", "Camila"]);
    assert.equal(buscarTarea(A, hoy, "tc").estado, "soltada");
  });
  test("app: la alcancía recibe el aporte con id fijo «nk<pedido>» (las cerradas no)", () => {
    const a = A.alcancias.lista.find(x => x.id === "alx");
    assert.deepEqual(clone(a.aportes.map(x => [x.id, x.monto])), [["ap0", 50000], ["nkn000000000a", 20000]]);
    assert.equal(A.alcancias.lista.find(x => x.id === "aly").aportes.length, 0);
  });
  test("app: el diario recibe la entrada tal cual (id fijo «nd<pedido>», +10 ⭐ como al escribirla a mano)", () => {
    const e = A.vida.diario.find(x => x.id === "ndn000000000b");
    assert.ok(e && e.fecha === hoy && e.texto === "Hoy dicté esto.\nCon dos líneas." && !e.fromRitual);
    assert.ok(ledgerVigente(A, "diario:ndn000000000b"));
  });
  test("app: la lectura deja la página y un foco de lectura con el libro (id fijo «nl<pedido>», +5 ⭐ si es completo)", () => {
    const l = A.lecturas[0], s = A.enfoque.sesiones.find(x => x.id === "nln000000000c");
    assert.equal(l.pagina, 42);
    assert.ok(s && s.tipo === "libro" && s.libroId === "lx" && s.real === 25 && s.completa && s.fecha === hoy && s.ini === t0);
    assert.ok(ledgerVigente(A, "foco:nln000000000c"));
    const ef = ra.aplicados.find(x => x.tipo === "lectura");
    assert.deepEqual([ef.pagina, ef.min, ef.juntos], [42, 25, true], "con amigos: la app avisa su página (ljAvance)");
  });
  test("app: las ⭐ y el aviso de lo que hizo Norte", () => {
    assert.equal(ra.estrellas, 10 + 5); assert.equal(A.gamif.puntos, base + 15);
    const t = resumen(ra);
    assert.match(t, /actualizó tus alarmas/); assert.match(t, /anotó 2 recordatorios/); assert.match(t, /movió 3 tareas/);
    assert.match(t, /guardó \$20\.000 en Viaje/); assert.match(t, /escribió en tu diario/); assert.match(t, /anotó la página 42 de Rayuela/); assert.match(t, /\+15 ⭐/);
  });
  const ra2 = aplicar(clone(lista), A), B = clone(A0), rb = aplicar(clone(lista), B), juntos = mergeStates(clone(A), clone(B));
  test("app: nada se aplica dos veces, ni en dos equipos (al juntarse queda uno de cada uno)", () => {
    assert.equal(ra2.nuevos, 0); assert.equal(ra2.estrellas, 0);
    assert.equal(rb.estrellas, 15);
    assert.equal(juntos.alcancias.lista.find(x => x.id === "alx").aportes.filter(x => x.id === "nkn000000000a").length, 1);
    assert.equal(juntos.vida.diario.filter(x => x.id === "ndn000000000b").length, 1);
    assert.equal(juntos.enfoque.sesiones.filter(x => x.id === "nln000000000c").length, 1);
    assert.equal((juntos.agenda.dias[manana] || []).filter(x => x.txt === "Pagar la luz" && !x.borrada).length, 1);
    assert.equal(juntos.settings.norte.recordatorios.length, 2);
  });
  test("app: lo que todavía no llega a este equipo (la tarea, la alcancía, el libro) se queda en la bandeja", () => {
    const S = nuevoEstado(), r = aplicar([ped(1, "tarea_mover", { tid: "zz", destino: "soltar" }), ped(2, "alcancia", { aid: "zz", monto: 5 }), ped(3, "lectura", { lid: "zz", pagina: 3 })], S, { now: t0 + 3600e3 });
    assert.equal(r.esperan.length, 3); assert.equal(r.hechos.length, 0);
  });
  test("norteAjustesMerge: las alarmas del cambio más nuevo; los recordatorios por id, sin deshacer «avisado» ni «borrado»", () => {
    const l = { alarmas: { ts: 5, lista: [] }, recordatorios: [{ id: "r1", que: "A", cuando: 1, avisado: true, ts: 1 }, { id: "r2", que: "B", cuando: 2, ts: 9 }] };
    const s = { alarmas: { ts: 7, lista: [{ id: "x" }] }, recordatorios: [{ id: "r1", que: "A2", cuando: 1, avisado: false, ts: 5 }, { id: "r2", que: "B", cuando: 2, borrado: true, ts: 3 }, { id: "r3", que: "C", cuando: 3, ts: 1 }] };
    const m = merge(l, s);
    assert.equal(m.alarmas.ts, 7);
    const r = Object.fromEntries(m.recordatorios.map(x => [x.id, x]));
    assert.deepEqual([r.r1.que, r.r1.avisado], ["A2", true]); assert.equal(r.r2.borrado, true); assert.ok(r.r3);
    const est = migrate(defaultState()), otro = clone(est);
    est.settings.norte = l; otro.settings.norte = s;
    assert.equal(mergeStates(clone(est), clone(otro)).settings.norte.alarmas.ts, 7, "mergeStates junta los ajustes de Norte");
  });
  test("norteAjustesVer y norteAjustesCambiar: por defecto todo encendido; cada cambio con su ts; al juntar equipos gana el más nuevo", () => {
    const S = nuevoEstado(), ver = G("norteAjustesVer"), cam = G("norteAjustesCambiar");
    assert.deepEqual(clone(ver(S)), { ts: 0, agua: true, agenda: true, habitos: true, amigos: true, planes: true, avisos_dia: true, aburrido: true, pregunta_cierre: true, noche: { auto: true, desde: "23:00", hasta: "07:00" } });
    const a = cam(x => { x.agua = false; x.noche.auto = false; }, S, 500);
    assert.deepEqual([a.ts, S.settings.norte.ajustes.agua, S.settings.norte.ajustes.noche.auto], [500, false, false]);
    assert.equal(cam(() => false, S), null);
    assert.equal(merge({ ajustes: { ts: 5, agua: false } }, { ajustes: { ts: 9, agua: true } }).ajustes.ts, 9);
  });
  test("norteAlarmasCambiar: cada cambio lleva una hora nueva (ts), así el robot sabe que las de Rumbo son más nuevas", () => {
    const S = nuevoEstado();
    const a1 = cambiar(A => { A.lista.push({ id: "n1", hora: "09:00", dias: [], fecha: hoy, nombre: "x", activa: true }); }, S, 100);
    assert.equal(a1.ts, 3001, "nunca menos que la anterior + 1"); assert.equal(alarmasApp(S).lista.length, 2);
    assert.equal(cambiar(() => false, S), null, "sin cambios no se guarda");
    assert.equal(cambiar(A => { A.dormir = "22:00"; }, S, 9e12).ts, 9e12);
  });
}
