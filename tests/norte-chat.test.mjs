/* Tests de 🧭 Norte, tu brújula: la charla (notifier/norte-chat.mjs), con un Supabase, un Claude y un Azure
   falsos y sin red: el token, los límites del día, las herramientas (que pasan por la misma bandeja que el
   robot), la cara del final, y el oído y la voz de Azure */
export default async function ({ test, assert }) {
  console.log("\nNorte, tu brújula: la charla (Norte-Desk)");
  const { atenderCharla, crearAzure, separarCara, leerWav, MODELO, LIMITES, HERRAMIENTAS } = await import("../notifier/norte-chat.mjs");
  const { hashToken } = await import("../notifier/norte.mjs");

  /* ---------- Un Supabase falso (como en norte.test.mjs) con norte_uso_sumar en memoria ---------- */
  function sbFalso(tablas, ahora, opciones = {}) {
    const log = { inserts: [], updates: [], rpc: [] }, uso = {};
    const T = n => (tablas[n] = tablas[n] || []);
    function consulta(nombre) {
      const filtros = []; let modo = "select", op = {}, filas = null, cambios = null, unico = false;
      const q = {
        select(c, o) { if (modo === "select") op = o || {}; return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        upsert(f, o) { modo = "upsert"; filas = [].concat(f); op = o || {}; return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        const t = T(nombre);
        if (modo === "insert" || modo === "upsert") { filas.forEach(f => { t.push(Object.assign({ creado: ahora.toISOString() }, f)); log.inserts.push({ tabla: nombre, f }); }); return { data: null, error: null }; }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); log.updates.push({ tabla: nombre, cambios }); return { data: null, error: null }; }
        if (op.head) return { data: null, count: sel.length, error: null };
        return { data: unico ? sel[0] || null : sel, error: null };
      }
      return q;
    }
    return {
      tablas, log, uso, from: consulta,
      rpc: async (fn, a) => {
        log.rpc.push({ fn, args: a });
        if (fn !== "norte_uso_sumar" || opciones.sinTabla) return { data: null, error: { message: `Could not find the function public.${fn}` } };
        const u = (uso[a.p_dia] = uso[a.p_dia] || { charlas: 0, caracteres: 0, segundos: 0 });
        for (const [k, max] of [["charlas", a.p_max_charlas], ["caracteres", a.p_max_caracteres], ["segundos", a.p_max_segundos]])
          if (u[k] + a["p_" + k] > max) return { data: { ok: false, limite: k }, error: null };
        u.charlas += a.p_charlas; u.caracteres += a.p_caracteres; u.segundos += a.p_segundos;
        return { data: Object.assign({ ok: true }, u), error: null };
      },
    };
  }
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32), AHORA = new Date("2026-11-11T15:00:00Z"), HOY = "2026-11-11";
  const nuevoSb = (opciones) => sbFalso({
    estado_usuario: [{ user_id: U, data: {
      settings: { notif: { tz: "America/Santiago" } },
      habitos: { defs: [{ id: "h1", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" }], log: {} },
      ritual: { dias: {} }, agenda: { dias: {} }, agua: { meta: 2000, vaso: 250, dias: {} },
    } }],
    norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }],
    norte_pendientes: [], agua_pendientes: [],
  }, AHORA, opciones);
  function claudeFalso(respuestas) {
    const pedidos = []; let i = 0;
    return { pedidos, messages: { create: async (p) => {
      pedidos.push(JSON.parse(JSON.stringify(p)));
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      if (r instanceof Error) throw r;
      return r;
    } } };
  }
  const texto = (t, extra = []) => ({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "", signature: "firma" }, ...extra, { type: "text", text: t }] });
  const pedir = (sb, body, { claude = null, azure = null, token = TOKEN } = {}) =>
    atenderCharla({ sb, body, autorizacion: token ? "Bearer " + token : undefined, claude, azure, ahora: AHORA });

  /* ---------- El token y las acciones ---------- */
  const sb0 = nuevoSb();
  const t1 = await pedir(sb0, { accion: "charla", texto: "hola" }, { token: null }), t2 = await pedir(sb0, { accion: "bailar" });
  test("charla: sin token responde 401 (y no dice qué acciones hay); una acción que no existe, 400", () => {
    assert.deepEqual([t1.status, t1.cuerpo.error], [401, "no-autorizado"]);
    assert.deepEqual([t2.status, t2.cuerpo.error], [400, "accion-invalida"]);
  });

  /* ---------- Una charla simple ---------- */
  const sb1 = nuevoSb(), c1 = claudeFalso([texto("Vas bien, te falta meditar.\n[cara: feliz]")]);
  const r1 = await pedir(sb1, { accion: "charla", texto: "¿Cómo voy?", historial: [{ rol: "norte", texto: "Hola" }, { rol: "yo", texto: "Hola Norte" }, { rol: "norte", texto: "¿En qué te ayudo?" }] }, { claude: c1 });
  test("charla: responde con Claude Haiku 5.5, esfuerzo bajo, la personalidad de Norte y tu día de hoy", () => {
    assert.equal(r1.status, 200); assert.equal(r1.cuerpo.ok, true);
    assert.equal(r1.cuerpo.texto, "Vas bien, te falta meditar."); assert.equal(r1.cuerpo.cara, "feliz");
    assert.deepEqual(r1.cuerpo.hizo, []);
    const p = c1.pedidos[0];
    assert.equal(p.model, MODELO); assert.equal(MODELO, "claude-haiku-5-5"); assert.equal(p.output_config.effort, "low");
    assert.match(p.system, /Eres Norte/); assert.match(p.system, /"habitos_pendientes":\["Meditar"\]/, "el día de hoy va en el prompt");
    assert.deepEqual(p.tools.map(t => t.name), HERRAMIENTAS.map(h => h.name)); assert.ok(p.tools.every(t => !("accion" in t)), "a Claude no le llega el campo interno");
    assert.deepEqual(p.messages.map(m => m.role), ["user", "assistant", "user"], "el historial empieza con «yo» y alterna");
    assert.equal(p.messages[2].content, "¿Cómo voy?");
    assert.deepEqual(sb1.log.rpc.map(x => [x.fn, x.args.p_dia, x.args.p_charlas, x.args.p_max_charlas]), [["norte_uso_sumar", HOY, 1, LIMITES.charlas]]);
  });

  /* ---------- Con herramientas: marca el hábito por la misma bandeja ---------- */
  const sb2 = nuevoSb(), c2 = claudeFalso([
    { stop_reason: "tool_use", content: [{ type: "thinking", thinking: "", signature: "f" }, { type: "text", text: "Lo marco." }, { type: "tool_use", id: "tu1", name: "marcar_habito", input: { habito: "meditar" } }] },
    texto("Listo, marqué Meditar. Bien hecho.\n[cara: feliz]"),
  ]);
  const r2 = await pedir(sb2, { accion: "charla", texto: "Ya medité" }, { claude: c2 });
  test("charla con herramientas: marca el hábito en la bandeja de Rumbo y le devuelve el resultado a Claude", () => {
    assert.equal(r2.cuerpo.ok, true); assert.equal(r2.cuerpo.texto, "Listo, marqué Meditar. Bien hecho.");
    assert.deepEqual(r2.cuerpo.hizo.map(h => [h.accion, h.ok]), [["marcar_habito", true]]);
    const pend = sb2.tablas.norte_pendientes;
    assert.equal(pend.length, 1); assert.equal(pend[0].tipo, "habito"); assert.equal(pend[0].datos.hid, "h1"); assert.equal(pend[0].datos.fecha, HOY);
    const seg = c2.pedidos[1].messages;
    assert.equal(seg[seg.length - 2].role, "assistant"); assert.equal(seg[seg.length - 2].content[0].type, "thinking", "el turno de Claude vuelve completo, con su bloque de pensamiento");
    const res = seg[seg.length - 1].content[0];
    assert.equal(res.type, "tool_result"); assert.equal(res.tool_use_id, "tu1"); assert.equal(JSON.parse(res.content).ok, true);
  });

  /* ---------- Límites, sin cerebro, sin tabla, Claude ocupado y una negativa ---------- */
  const sb3 = nuevoSb(); sb3.uso[HOY] = { charlas: LIMITES.charlas, caracteres: 0, segundos: 0 };
  const c3 = claudeFalso([texto("no debería llegar")]), r3 = await pedir(sb3, { accion: "charla", texto: "hola" }, { claude: c3 });
  const r4 = await pedir(nuevoSb(), { accion: "charla", texto: "hola" });
  const r5 = await pedir(nuevoSb({ sinTabla: true }), { accion: "charla", texto: "hola" }, { claude: claudeFalso([texto("x")]) });
  const ocupado = Object.assign(new Error("overloaded"), { status: 529 });
  const r6 = await pedir(nuevoSb(), { accion: "charla", texto: "hola" }, { claude: claudeFalso([ocupado]) });
  const r7 = await pedir(nuevoSb(), { accion: "charla", texto: "hola" }, { claude: claudeFalso([{ stop_reason: "refusal", content: [] }]) });
  const r8 = await pedir(nuevoSb(), { accion: "charla", texto: "x".repeat(501) }, { claude: claudeFalso([texto("x")]) });
  test("charla: el límite del día, sin clave de Claude, sin la tabla, Claude ocupado, una negativa y un texto largo", () => {
    assert.deepEqual([r3.status, r3.cuerpo.error], [429, "limite-charlas"]); assert.equal(c3.pedidos.length, 0, "ni se llama a Claude");
    assert.deepEqual([r4.status, r4.cuerpo.error], [500, "sin-cerebro"]);
    assert.deepEqual([r5.status, r5.cuerpo.error], [500, "sin-servidor"], "sin supabase/norte-chat.sql todavía");
    assert.deepEqual([r6.status, r6.cuerpo.error], [503, "ocupado"]);
    assert.deepEqual([r7.status, r7.cuerpo.ok, r7.cuerpo.cara], [200, true, "serio"]);
    assert.deepEqual([r8.status, r8.cuerpo.error], [400, "dato-invalido"]);
    for (const r of [r3, r4, r5, r6, r8]) assert.ok(typeof r.cuerpo.texto === "string" && r.cuerpo.texto.length > 5, "siempre con una frase para decir");
  });
  test("la cara del final se quita del texto; si no viene o no existe, «contento»", () => {
    assert.deepEqual(separarCara("Hola.\n[cara: Sorprendido]"), { texto: "Hola.", cara: "sorprendido" });
    assert.deepEqual(separarCara("Hola."), { texto: "Hola.", cara: "contento" });
    assert.deepEqual(separarCara("Hola. [cara: furioso]"), { texto: "Hola.", cara: "contento" });
  });

  /* ---------- Oído y voz (Azure) ---------- */
  function wav(segundos, { rate = 16000, canales = 1, bits = 16 } = {}) {
    const datos = Math.round(segundos * rate) * canales * (bits / 8), b = Buffer.alloc(44 + datos);
    b.write("RIFF", 0, "ascii"); b.writeUInt32LE(36 + datos, 4); b.write("WAVE", 8, "ascii");
    b.write("fmt ", 12, "ascii"); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(canales, 22);
    b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * canales * bits / 8, 28); b.writeUInt16LE(canales * bits / 8, 32); b.writeUInt16LE(bits, 34);
    b.write("data", 36, "ascii"); b.writeUInt32LE(datos, 40);
    return b;
  }
  function fetchFalso(stt = { RecognitionStatus: "Success", DisplayText: "Tomé dos vasos de agua." }) {
    const llamadas = [];
    const f = async (url, o) => { llamadas.push({ url, o }); return url.includes(".stt.") ? { ok: true, status: 200, json: async () => stt } : { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
    f.llamadas = llamadas; return f;
  }
  const f1 = fetchFalso(), az1 = crearAzure({ clave: "clave", region: "Brazil South", fetch: f1 }), sbO = nuevoSb();
  const o1 = await pedir(sbO, { accion: "oir", audio: wav(2).toString("base64") }, { azure: az1 });
  const o2 = await pedir(nuevoSb(), { accion: "oir", audio: wav(31).toString("base64") }, { azure: az1 });
  const o3 = await pedir(nuevoSb(), { accion: "oir", audio: Buffer.from("no soy un wav").toString("base64") }, { azure: az1 });
  const o4 = await pedir(nuevoSb(), { accion: "oir", audio: wav(1).toString("base64") }, { azure: crearAzure({ clave: "c", region: "r", fetch: fetchFalso({ RecognitionStatus: "NoMatch" }) }) });
  const o5 = await pedir(nuevoSb(), { accion: "oir", audio: wav(1).toString("base64") });
  test("oír: pasa el WAV a Azure en español de Chile, suma los segundos y devuelve el texto", () => {
    assert.deepEqual([o1.status, o1.cuerpo.ok, o1.cuerpo.texto], [200, true, "Tomé dos vasos de agua."]);
    const ll = f1.llamadas[0];
    assert.match(ll.url, /^https:\/\/brazilsouth\.stt\.speech\.microsoft\.com\/.*language=es-CL/);
    assert.equal(ll.o.headers["Content-Type"], "audio/wav; codecs=audio/pcm; samplerate=16000"); assert.equal(ll.o.headers["Ocp-Apim-Subscription-Key"], "clave");
    assert.equal(sbO.log.rpc[0].args.p_segundos, 2);
    assert.deepEqual([o2.status, o2.cuerpo.error], [400, "dato-invalido"], "más de 30 segundos");
    assert.deepEqual([o3.status, o3.cuerpo.error], [400, "dato-invalido"], "no es un WAV");
    assert.deepEqual([o4.status, o4.cuerpo.ok, o4.cuerpo.error], [200, false, "no-te-oi"], "Azure no entendió nada");
    assert.deepEqual([o5.status, o5.cuerpo.error], [500, "sin-voz"]);
    assert.equal(leerWav(wav(1, { canales: 2 })).ok, false); assert.equal(leerWav(wav(1, { bits: 8 })).ok, false);
    assert.equal(crearAzure({ clave: "", region: "x" }), null);
  });
  const f2 = fetchFalso(), az2 = crearAzure({ clave: "clave", region: "brazilsouth", fetch: f2 }), sbH = nuevoSb();
  const h1 = await pedir(sbH, { accion: "hablar", texto: "Vas bien <de verdad> 💧" }, { azure: az2 });
  const h2 = await pedir(nuevoSb(), { accion: "hablar", texto: "Hola", voz: "catalina" }, { azure: az2 });
  const sbL = nuevoSb(); sbL.uso[HOY] = { charlas: 0, caracteres: LIMITES.caracteres - 2, segundos: 0 };
  const h3 = await pedir(sbL, { accion: "hablar", texto: "Hola" }, { azure: az2 });
  test("hablar: la voz chilena de Azure (Lorenzo por defecto), sin emojis, con el texto escapado y con límite", () => {
    assert.deepEqual([h1.status, h1.cuerpo.ok, h1.cuerpo.audio, h1.cuerpo.tipo], [200, true, "AQID", "audio/mpeg"]);
    const ll = f2.llamadas[0];
    assert.match(ll.url, /^https:\/\/brazilsouth\.tts\.speech\.microsoft\.com\/cognitiveservices\/v1$/);
    assert.match(ll.o.body, /<voice name="es-CL-LorenzoNeural">Vas bien &lt;de verdad&gt;<\/voice>/);
    assert.equal(sbH.log.rpc[0].args.p_caracteres, "Vas bien <de verdad>".length, "cuenta lo que se dice, sin el emoji");
    assert.match(f2.llamadas[1].o.body, /es-CL-CatalinaNeural/);
    assert.deepEqual([h3.status, h3.cuerpo.error], [429, "limite-caracteres"]);
  });
}
