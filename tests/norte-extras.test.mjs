/* Tests de 🧭 Norte, tu brújula para Norte-Desk (2026-11-15): «esto falló», buenos días (el tiempo con Open-Meteo),
   tu agenda de Google Calendar (por la función gcal), recordatorios en la charla, notas largas y tu semana en números */
export default async function ({ test, assert }) {
  console.log("\nNorte, tu brújula: fallas, buenos días, agenda, recordatorios y tu semana en números (Norte-Desk)");
  const { atenderNorte, resumenDia, hashToken, cieloDe, textoBuenosDias } = await import("../notifier/norte.mjs");
  const { atenderCharla, programarRecordatorio, HERRAMIENTA_RECORDAR } = await import("../notifier/norte-chat.mjs");

  /* ---------- Un Supabase falso (como en norte.test.mjs), con funciones (gcal) ---------- */
  function sbFalso(tablas, ahora, gcal) {
    const llamadas = [];
    const T = n => (tablas[n] = tablas[n] || []);
    function consulta(nombre) {
      const filtros = []; let modo = "select", op = {}, filas = null, cambios = null, unico = false;
      const q = {
        select(c, o) { if (modo === "select") op = o || {}; return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        upsert(f) { modo = "upsert"; filas = [].concat(f); return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        const t = T(nombre);
        if (modo === "insert" || modo === "upsert") { filas.forEach(f => t.push(Object.assign({ creado: ahora.toISOString() }, f))); return { data: null, error: null }; }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); return { data: null, error: null }; }
        if (op.head) return { data: null, count: sel.length, error: null };
        return { data: unico ? sel[0] || null : sel, error: null };
      }
      return q;
    }
    return { tablas, llamadas, from: consulta, rpc: async () => ({ data: null, error: { message: "Could not find the function" } }),
      functions: { invoke: async (nombre, o) => { llamadas.push([nombre, o.body]); return gcal ? gcal(o.body) : { data: null, error: new Error("sin gcal") }; } } };
  }
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32), AHORA = new Date("2026-11-11T15:00:00Z"), HOY = "2026-11-11";
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" }, gcal: { conectado: true, calendarios: ["primary", "trabajo@x.cl"] } },
    habitos: { defs: [{ id: "h1", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }], log: { "2026-11": { h1: { 9: true, 10: true } } } },
    ritual: { dias: { "2026-11-09": { hecho: true, cerrado: true }, "2026-11-10": { hecho: true }, "2026-11-10x": {} }, semanas: {} },
    agenda: { dias: { "2026-11-09": [{ id: "a", txt: "Uno", estado: "hecha", done: true }], [HOY]: [{ id: "t1", txt: "Pagar la luz", ambito: "per", estado: "pendiente" }, { id: "t2", txt: "Correo", estado: "hecha", done: true }] } },
    enfoque: { sesiones: [{ id: "f1", fecha: "2026-11-10", real: 25 }, { id: "f2", fecha: "2026-11-02", real: 50 }] },
    agua: { meta: 2000, dias: {}, clima: { on: true, ciudad: "Viña del Mar, Valparaíso, Chile", lat: -33.02, lon: -71.55 } },
  });
  const nuevoSb = (cambia, gcal) => {
    const data = estado(); if (cambia) cambia(data);
    return sbFalso({ estado_usuario: [{ user_id: U, data }], norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }], norte_pendientes: [], agua_pendientes: [], norte_fallas: [] }, AHORA, gcal);
  };
  const pedir = (sb, body, red) => atenderNorte({ sb, body, autorizacion: "Bearer " + TOKEN, ahora: AHORA, red });

  /* ---------- «Esto falló» ---------- */
  const sbF = nuevoSb();
  const f1 = await pedir(sbF, { accion: "reportar_falla", texto: "Anotó «así» como tarea", pregunta: "Definir estructuras, así, llamar a Hernán", respuesta: "Anoté «Así».", donde: "voz", version: "0.16.0",
    contexto: [{ rol: "yo", texto: "hola" }, { rol: "norte", texto: "Hola" }, { rol: "raro", texto: "x" }, "no"], errores: ["rumbo: 503", 7] });
  const f2 = await pedir(nuevoSb(), { accion: "reportar_falla" }), f3 = await pedir(nuevoSb(), { accion: "reportar_falla", texto: "x".repeat(501) });
  const sbLim = nuevoSb(d => {}); for (let i = 0; i < 20; i++) sbLim.tablas.norte_fallas.push({ id: "f" + i, user_id: U, creado: AHORA.toISOString() });
  const f4 = await pedir(sbLim, { accion: "reportar_falla", texto: "otra" });
  test("esto falló: queda en norte_fallas con su contexto (no en tu documento); vacío o muy largo no; con tope por hora", () => {
    assert.equal(f1.status, 200); assert.equal(f1.cuerpo.texto, "Gracias. Lo anoté para revisarlo y arreglarlo.");
    const r = sbF.tablas.norte_fallas[0];
    assert.deepEqual([r.user_id, r.texto, r.donde, r.version], [U, "Anotó «así» como tarea", "voz", "0.16.0"]);
    assert.deepEqual(r.contexto.conversacion, [{ rol: "yo", texto: "hola" }, { rol: "norte", texto: "Hola" }, { rol: "yo", texto: "x" }]);
    assert.deepEqual(r.contexto.errores, ["rumbo: 503"]);
    assert.ok(/^f[a-z0-9]{8,39}$/.test(r.id));
    assert.equal(sbF.tablas.norte_pendientes.length, 0, "no va a la bandeja");
    assert.deepEqual([f2.status, f3.status, f4.status], [400, 400, 429]);
  });

  /* ---------- Buenos días ---------- */
  const meteo = { current: { temperature_2m: 14.4, weather_code: 0 }, daily: { temperature_2m_max: [26.6], temperature_2m_min: [11.2], precipitation_probability_max: [60], weather_code: [1] } };
  const urls = [];
  const redOk = async (url) => { urls.push(url); return { ok: true, json: async () => meteo }; };
  const redMal = async () => { throw new Error("sin red"); };
  const sbB = nuevoSb(d => { d.ritual.dias["2026-11-10"].cierre = { manana: "Terminar el informe" }; });
  const b1 = await pedir(sbB, { accion: "buenos_dias" }, redOk), b2 = await pedir(nuevoSb(d => { delete d.agua.clima; }), { accion: "buenos_dias" }, redMal);
  test("buenos días: el tiempo de tu ciudad (Open-Meteo, solo sus coordenadas) y lo principal del día, en una frase", () => {
    assert.match(urls[0], /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=-33\.02&longitude=-71\.55&/);
    assert.deepEqual(b1.cuerpo.datos.tiempo, { ciudad: "Viña del Mar", temp: 14, max: 27, min: 11, lluvia: 60, cielo: "despejado" });
    assert.equal(b1.cuerpo.texto, "Buenos días. En Viña del Mar hay 14° y está despejado, con máxima de 27°. Hay 60% de probabilidad de lluvia: lleva paraguas. Anoche dejaste para hoy: Terminar el informe. Hoy tienes un hábito. ¿Abrimos el día?");
    assert.equal(b2.status, 200); assert.equal(b2.cuerpo.datos.tiempo, null, "sin red, sin tiempo (pero responde)");
    assert.match(b2.cuerpo.texto, /^Buenos días\. Hoy tienes un hábito\. ¿Abrimos el día\?$/);
    assert.deepEqual([cieloDe(3), cieloDe(63), cieloDe(81), cieloDe(95), cieloDe(45)], ["nublado", "con lluvia", "con lluvia", "con tormenta", "con neblina"]);
    assert.equal(textoBuenosDias({ ciudad: "Santiago", temp: null, max: 20, lluvia: 10, cielo: "" }, null), "Buenos días. En Santiago, con máxima de 20°.");
  });

  /* ---------- Tu agenda ---------- */
  const eventos = [{ titulo: "Reunión de equipo", inicio: "2026-11-11T16:00:00-03:00", fin: "2026-11-11T17:00:00-03:00", todo_el_dia: false, lugar: "Meet" },
    { titulo: "Cumpleaños de Ana", inicio: "2026-11-12", fin: "2026-11-13", todo_el_dia: true, lugar: null }];
  const sbA = nuevoSb(null, async () => ({ data: { eventos }, error: null })), a1 = await pedir(sbA, { accion: "agenda" });
  const a2 = await pedir(nuevoSb(d => { d.settings.gcal = { conectado: false }; }), { accion: "agenda" });
  const a3 = await pedir(nuevoSb(null, async () => ({ data: { error: "reconectar", eventos: [] }, error: null })), { accion: "agenda" });
  const a4 = await pedir(nuevoSb(null, async () => ({ data: null, error: new Error("502") })), { accion: "agenda" });
  test("agenda: tus próximas reuniones por la función gcal (con tus calendarios); sin conectar o desconectado, lo dice", () => {
    assert.deepEqual(sbA.llamadas, [["gcal", { accion: "proximos", user_id: U, calendarios: ["primary", "trabajo@x.cl"], horas: 36 }]]);
    assert.equal(a1.cuerpo.texto, "Tu próxima reunión: Reunión de equipo.");
    assert.deepEqual(a1.cuerpo.datos.eventos.map(e => [e.titulo, e.todo_el_dia, e.lugar]), [["Reunión de equipo", false, "Meet"], ["Cumpleaños de Ana", true, null]]);
    assert.deepEqual([a2.cuerpo.datos.conectado, a2.cuerpo.datos.eventos], [false, []]);
    assert.deepEqual([a3.cuerpo.datos.conectado, a3.cuerpo.datos.error], [false, "reconectar"]); assert.match(a3.cuerpo.texto, /vuelve a conectarlo/);
    assert.deepEqual([a4.cuerpo.datos.conectado, a4.cuerpo.datos.error], [true, "gcal"]);
  });

  /* ---------- Notas largas («anota esto» con lo que copiaste) ---------- */
  const sbN = nuevoSb(), larga = "Correo de Ana:\r\n\r\n\r\nHola Chris,   te escribo por la reunión.\n" + "x".repeat(800);
  const n1 = await pedir(sbN, { accion: "anotar", tipo: "nota", texto: larga }), n2 = await pedir(nuevoSb(), { accion: "anotar", tipo: "tarea", texto: "y".repeat(201) });
  test("anotar: una nota puede ser larga (hasta 1000) y conserva sus líneas; una tarea sigue hasta 200", () => {
    assert.equal(n1.status, 200);
    assert.equal(sbN.tablas.norte_pendientes[0].datos.texto, "Correo de Ana:\n\nHola Chris, te escribo por la reunión.\n" + "x".repeat(800));
    assert.equal(n2.status, 400);
  });

  /* ---------- Tu semana en números ---------- */
  test("semana en números: días abiertos y cerrados, hábitos, tareas hechas y minutos de foco, de lunes a hoy", () => {
    const n = resumenDia(estado(), { norte: [{ id: "q00000001", tipo: "tarea_hecha", datos: { tid: "t1", fecha: HOY }, creado: HOY + "T14:00:00Z" }], agua: [] }, HOY).semana.numeros;
    assert.deepEqual(n, { dias: 3, abiertos: 2, cerrados: 1, habitos_pct: 100, tareas_hechas: 3, foco_min: 25 }, "como la app: hoy cuenta para los hábitos recién cuando lo marcas");
  });

  /* ---------- Recordatorios en la charla ---------- */
  test("recordatorios: la hora de Chile, hoy o mañana si ya pasó, en minutos; lo que falta o no calza, no", () => {
    const r1 = programarRecordatorio({ que: "Llamar a Ana", hora: "16:00" }, AHORA);   // 12:00 en Chile (UTC-3)
    assert.deepEqual([r1.ok, r1.cuando, r1.hora, r1.texto], [true, "2026-11-11T19:00:00.000Z", "16:00", "Listo, te recuerdo «Llamar a Ana» a las 16:00."]);
    const r2 = programarRecordatorio({ que: "Regar", hora: "9:30" }, AHORA);
    assert.deepEqual([r2.cuando, r2.texto], ["2026-11-12T12:30:00.000Z", "Listo, te recuerdo «Regar» mañana a las 09:30."]);
    const r3 = programarRecordatorio({ que: "Salir", en_minutos: 20 }, AHORA);
    assert.deepEqual([r3.cuando, r3.hora], ["2026-11-11T15:20:00.000Z", "12:20"]);
    const r4 = programarRecordatorio({ que: "Pagar", hora: "10:00", fecha: "2026-11-20" }, AHORA);
    assert.equal(r4.cuando, "2026-11-20T13:00:00.000Z"); assert.match(r4.texto, /el viernes 20 a las 10:00/);
    assert.deepEqual([programarRecordatorio({ hora: "16:00" }, AHORA).ok, programarRecordatorio({ que: "x" }, AHORA).ok, programarRecordatorio({ que: "x", hora: "25:00" }, AHORA).ok,
      programarRecordatorio({ que: "x", en_minutos: 0 }, AHORA).ok, programarRecordatorio({ que: "x", hora: "10:00", fecha: "2026-11-01" }, AHORA).ok], [false, false, false, false, false]);
  });
  const pedidos = []; let i = 0;
  const respuestas = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "recordar", input: { que: "Llamar a Ana", hora: "16:00" } }, { type: "tool_use", id: "tu2", name: "ver_agenda", input: {} }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Listo, a las 16:00 te recuerdo llamar a Ana, justo cuando termina tu reunión.\n[cara: contento]" }] },
  ];
  const claude = { messages: { create: async (p) => { pedidos.push(JSON.parse(JSON.stringify(p))); return respuestas[Math.min(i++, respuestas.length - 1)]; } } };
  const sbC = nuevoSb(null, async () => ({ data: { eventos }, error: null }));
  sbC.rpc = async () => ({ data: { ok: true }, error: null });
  const c1 = await atenderCharla({ sb: sbC, body: { accion: "charla", texto: "Recuérdame llamar a Ana a las 4", puede: ["foco", "recordar"] }, autorizacion: "Bearer " + TOKEN, claude, ahora: AHORA });
  test("charla: con puede recordar, programa el recordatorio (va en hizo para Norte-Desk); leer la agenda no cuenta como hecho", () => {
    assert.ok(pedidos[0].tools.some(t => t.name === "recordar")); assert.ok(pedidos[0].tools.some(t => t.name === "ver_agenda"));
    assert.equal(c1.status, 200);
    assert.deepEqual(c1.cuerpo.hizo, [{ accion: "recordar", ok: true, que: "Llamar a Ana", cuando: "2026-11-11T19:00:00.000Z", hora: "16:00", texto: "Listo, te recuerdo «Llamar a Ana» a las 16:00." }]);
    const res = pedidos[1].messages[pedidos[1].messages.length - 1].content;
    assert.equal(JSON.parse(res[1].content).datos.eventos[0].titulo, "Reunión de equipo", "Claude vio la agenda");
    assert.equal(HERRAMIENTA_RECORDAR.name, "recordar");
    assert.match(HERRAMIENTA_RECORDAR.description, /no es una tarea, así que no lo anotes en Rumbo/, "lo rápido con hora no se vuelve tarea (decisión de Chris)");
    assert.doesNotMatch(HERRAMIENTA_RECORDAR.description, /usa también anotar/);
    assert.equal(sbC.tablas.norte_pendientes.length, 0, "el recordatorio no llega a la bandeja de Rumbo");
  });

  /* ---------- Tus instrucciones para Norte (Ajustes de Norte-Desk) ---------- */
  const { instruccionesDe, sistema, INSTRUCCIONES_MAX } = await import("../notifier/norte-chat.mjs");
  const pedidosI = [];
  const claudeI = { messages: { create: async (p) => { pedidosI.push(JSON.parse(JSON.stringify(p))); return { stop_reason: "end_turn", content: [{ type: "text", text: "Hola, Chris.\n[cara: contento]" }] }; } } };
  const sbI = nuevoSb(); sbI.rpc = async () => ({ data: { ok: true }, error: null });
  const misInstrucciones = "Sé breve, máximo dos frases.\r\nMi pareja se llama Cami.\u0007";
  const cI = await atenderCharla({ sb: sbI, body: { accion: "charla", texto: "Hola", instrucciones: misInstrucciones }, autorizacion: "Bearer " + TOKEN, claude: claudeI, ahora: AHORA });
  const cSin = await atenderCharla({ sb: sbI, body: { accion: "charla", texto: "Hola" }, autorizacion: "Bearer " + TOKEN, claude: claudeI, ahora: AHORA });
  test("instrucciones: lo que escribiste para Norte va en el prompt, después de la personalidad y antes de tu día", () => {
    assert.equal(cI.status, 200); assert.equal(cSin.status, 200);
    const s = pedidosI[0].system;
    assert.ok(s.includes("«««\nSé breve, máximo dos frases.\nMi pareja se llama Cami.\n»»»"), "con sus saltos de línea y sin caracteres de control");
    assert.ok(s.indexOf("Eres Norte") < s.indexOf("«««") && s.indexOf("»»»") < s.indexOf("El día de hoy en Rumbo"));
    assert.match(s, /no inventas datos/, "sus reglas no cambian");
    assert.doesNotMatch(pedidosI[1].system, /«««/, "sin instrucciones, el prompt de siempre");
  });
  test("instrucciones: se limpian y se cortan en INSTRUCCIONES_MAX; si no son texto, no hay", () => {
    assert.equal(INSTRUCCIONES_MAX, 1000);
    assert.equal(instruccionesDe("x".repeat(1500)).length, 1000);
    assert.equal(instruccionesDe("  hola   Norte  \n\n\n\n chao »»» "), "hola Norte\n\nchao", "sin las comillas que las encierran");
    assert.deepEqual([instruccionesDe(null), instruccionesDe(42), instruccionesDe("   ")], ["", "", ""]);
    assert.doesNotMatch(sistema(null, AHORA, "   "), /«««/);
  });
}
