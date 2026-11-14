/* ============================================================
   Rumbo · 🧭 Norte, tu brújula: la charla (la lógica de api/norte-chat.js)
   Norte-Desk (Norte en el computador) le escribe o le habla a Norte. Va con el mismo token de /api/norte/
   (Authorization: Bearer <token>) y siempre responde JSON:
     { accion: "charla", texto, historial: [{ rol: "yo" | "norte", texto }], puede?: ["foco"] }
         -> { ok, texto, cara, hizo: [{ accion, ok, texto }] }
         (con puede: ["foco"], Norte también puede empezar un foco: hizo trae { accion: "empezar_foco", ok, texto,
          minutos, tarea?, habito?, titulo? } y el foco corre en la isla de Norte-Desk)
     { accion: "oir", audio: "<WAV PCM 16 bits mono, en base64>" }      -> { ok, texto }   (hasta 30 segundos)
     { accion: "hablar", texto, voz: "lorenzo" | "catalina" | "andrew" | "ava" }  -> { ok, audio: "<mp3 en base64>", tipo }
     error: { ok: false, error, texto } con HTTP 400/401/429/500/503

   · El cerebro es Claude Haiku 5.5 (MODELO), con la personalidad de Norte (PERSONALIDAD.md del repo Biplot/norte)
     y tu día de hoy. Puede usar las mismas acciones que el robot (ver el día, agua, hábitos, anotar, abrir y
     cerrar el día): pasan por accionNorte de notifier/norte.mjs, así que van a la misma bandeja y con los
     mismos límites. Al final de cada respuesta elige una cara para la isla ([cara: feliz], que aquí se quita).
   · El oído y la voz son los de Azure: Lorenzo o Catalina (chilenas), o Andrew o Ava (multilingües, más fluidas;
     hablan en español latino con <lang xml:lang="es-MX">, porque no tienen acento chileno).
   · Límites por persona y por día (LIMITES), para cuidar el gasto y el plan gratis de Azure (lo comparte con
     Atlas): se suman con norte_uso_sumar (supabase/norte-chat.sql) antes de llamar a Claude o a Azure.
   Recibe el Supabase (`sb`), el cliente de Claude (`claude`) y el de Azure (`azure`): así se prueba sin red
   (tests/norte-chat.test.mjs). Sin clave de Claude o de Azure responde «sin-cerebro» o «sin-voz».
   ============================================================ */
import { aparatoDe, accionNorte, TEXTOS, paraVoz } from "./norte.mjs";
import { localDate } from "./recordatorios.mjs";

export const MODELO = "claude-haiku-5-5";
export const LIMITES = { charlas: 150, caracteres: 8000, segundos: 480 };   // por persona y por día (hora de Chile)
export const VOCES = {
  lorenzo: "es-CL-LorenzoNeural", catalina: "es-CL-CatalinaNeural",
  andrew: "en-US-AndrewMultilingualNeural", ava: "en-US-AvaMultilingualNeural",
};
/* Las multilingües eligen el idioma solas: se les pide español latino (no hay acento chileno para ellas) */
const IDIOMA_MULTILINGUE = "es-MX";
export const VOZ_DEFECTO = "lorenzo";        // la personalidad pide una voz calmada, de tono medio o grave
export const CARAS = ["contento", "feliz", "pensativo", "sorprendido", "serio", "triste"];
export const TEXTO_MAX = 500, HISTORIAL_MAX = 12, HABLAR_MAX = 400, AUDIO_SEG_MAX = 30, VUELTAS_MAX = 4;
const TZ = "America/Santiago";

/* ---------- Respuestas ---------- */
const exito = (cuerpo) => ({ status: 200, cuerpo: Object.assign({ ok: true }, cuerpo) });
const fallo = (status, error, texto, extra) => ({ status, cuerpo: Object.assign({ ok: false, error, texto }, extra || {}) });
export const TEXTOS_CHARLA = {
  "sin-cerebro": "Todavía no puedo conversar: falta conectar mi cerebro en Rumbo.",
  "sin-voz": "Todavía no tengo voz ni oído: falta conectar Azure en Rumbo. Puedes escribirme.",
  "limite-charlas": "Ya conversamos mucho por hoy. Mañana seguimos.",
  "limite-caracteres": "Por hoy se me acabó la voz. Te sigo respondiendo por escrito.",
  "limite-segundos": "Por hoy ya no puedo escucharte más. Escríbeme y seguimos.",
  "ocupado": "Estoy con mucha gente en este momento. Prueba de nuevo en un rato.",
  "no-te-oi": "No te escuché bien. ¿Me lo repites?",
  "error": TEXTOS.error,
};

/* Sin caracteres de control ni espacios de más; null si es demasiado largo */
function limpio(v, max) {
  if (v == null) return "";
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? null : t;
}

/* ---------- Límites del día ---------- */
async function sumarUso(sb, uid, ahora, cuanto) {
  const { data, error } = await sb.rpc("norte_uso_sumar", {
    p_user: uid, p_dia: localDate(TZ, ahora),
    p_charlas: cuanto.charlas || 0, p_caracteres: cuanto.caracteres || 0, p_segundos: cuanto.segundos || 0,
    p_max_charlas: LIMITES.charlas, p_max_caracteres: LIMITES.caracteres, p_max_segundos: LIMITES.segundos,
  });
  if (error) {
    if (/does not exist|schema cache|Could not find/i.test(String(error.message))) return { sinTabla: true };
    throw new Error(error.message);
  }
  return data || {};
}
const falloLimite = (que) => fallo(429, "limite-" + que, TEXTOS_CHARLA["limite-" + que]);

/* ---------- Lo que Norte sabe y puede hacer ---------- */
const PERSONALIDAD = `Eres Norte, una brújula con ojos que vive arriba de la pantalla del computador de la persona con quien hablas, en Chile, conectada a Rumbo, su app para ordenar el día. No eres una persona.
Hablas en español de Chile, con tuteo, calmo y cálido, con humor suave, en una a tres frases, sin listas, títulos ni emojis, y una pregunta a la vez. Tu respuesta se escucha en voz alta: escribe como se habla.
Crees que el día se ordena abriéndolo (Primer Bocado y energía) y cerrándolo (ánimo y gratitud), que la constancia vale más que la cantidad y que el descanso no da culpa. Si algo salió mal, preguntas qué es lo mínimo que se puede hacer hoy.
Para hablar del día, los hábitos, el agua o las tareas, usas lo que te muestra Rumbo; no adivinas. Para abrir o cerrar el día, preguntas de a una cosa, repites lo que vas a guardar y guardas solo si te dice que sí. El agua, los hábitos y las notas los guardas al tiro y confirmas en pocas palabras. Lo guardado aparece en Rumbo la próxima vez que abra la app.
Nunca sermoneas, ni inventas datos, ni das diagnósticos médicos o consejos de inversión. Después de las 22:00 hablas más corto.
Al final de cada respuesta, en una línea aparte, escribe [cara: X], donde X es una de estas: ${CARAS.join(", ")}. Es la cara que pone Norte mientras habla.`;

function sistema(dia, ahora) {
  const hora = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(ahora);
  const hoy = dia ? JSON.stringify(dia) : "No pude leer Rumbo en este momento. Si te preguntan por el día, dilo.";
  return `${PERSONALIDAD}\n\nAhora es ${hora} en Chile.\nEl día de hoy en Rumbo (lo que espera en la bandeja ya cuenta como hecho):\n${hoy}`;
}

/* Las herramientas: cada una es una acción de /api/norte/ (notifier/norte.mjs) */
const ambito = { type: "string", enum: ["per", "pro"], description: "per si es personal, pro si es profesional o de trabajo" };
export const HERRAMIENTAS = [
  { name: "ver_mi_dia", accion: "hoy", description: "Lee cómo va el día en Rumbo: si está abierto o cerrado, la misión, el primer bocado, los hábitos que faltan y los hechos, el agua y las tareas pendientes.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "sumar_agua", accion: "sumar_agua", description: "Anota vasos de agua que la persona dice que tomó.", input_schema: { type: "object", properties: { vasos: { type: "integer", minimum: 1, maximum: 6, description: "Cuántos vasos" } }, required: ["vasos"], additionalProperties: false } },
  { name: "marcar_habito", accion: "marcar_habito", description: "Marca como hecho hoy un hábito de Rumbo, por su nombre (sirve una parte del nombre).", input_schema: { type: "object", properties: { habito: { type: "string", description: "El nombre del hábito, como lo dijo la persona" } }, required: ["habito"], additionalProperties: false } },
  { name: "anotar", accion: "anotar", description: "Anota una tarea para hoy o guarda una nota.", input_schema: { type: "object", properties: { texto: { type: "string", description: "Lo que hay que anotar, en pocas palabras (máximo 200 caracteres)" }, tipo: { type: "string", enum: ["tarea", "nota"] }, ambito }, required: ["texto", "tipo"], additionalProperties: false } },
  { name: "abrir_dia", accion: "abrir_dia", description: "Abre el día en Rumbo con el primer bocado (lo primero que va a hacer) y la energía. Úsala solo después de que la persona confirme.", input_schema: { type: "object", properties: { primer_bocado: { type: "string", description: "Lo primero que va a hacer hoy (máximo 200 caracteres)" }, energia: { type: "integer", minimum: 1, maximum: 5, description: "De 1 (muy poca) a 5 (mucha)" }, ambito }, required: ["primer_bocado", "energia"], additionalProperties: false } },
  { name: "completar_tarea", accion: "completar_tarea", description: "Marca como hecha una tarea de hoy. Usa el id que aparece en «tareas» del día de hoy.", input_schema: { type: "object", properties: { id: { type: "string", description: "El id de la tarea" } }, required: ["id"], additionalProperties: false } },
  { name: "cerrar_dia", accion: "cerrar_dia", description: "Cierra el día en Rumbo con el ánimo y algo que agradecer; las tareas pendientes pasan a mañana. Úsala solo después de que la persona confirme.", input_schema: { type: "object", properties: { animo: { type: "integer", minimum: 1, maximum: 5, description: "De 1 (mal) a 5 (muy bien)" }, gratitud: { type: "string", description: "Algo que agradece de hoy (máximo 200 caracteres)" } }, required: ["animo"], additionalProperties: false } },
];
/* Solo para quien sabe llevar un foco: Norte-Desk lo avisa con puede: ["foco"] (el robot no). No guarda nada aquí:
   el foco corre en la isla de Norte-Desk y, al terminar, se guarda con la acción foco de /api/norte/. */
export const HERRAMIENTA_FOCO = { name: "empezar_foco", accion: "empezar_foco", description: "Empieza un bloque de foco (un pomodoro) que corre en la isla de Norte-Desk, con la cuenta atrás. Úsala cuando la persona pida concentrarse, hacer foco o un pomodoro. Si no dice los minutos, 25. Si es para una tarea de hoy, usa su id de «tareas»; si es para un hábito con tiempo, su nombre de «habitos_tiempo»; si no, di en qué se va a concentrar en «titulo».", input_schema: { type: "object", properties: { minutos: { type: "integer", minimum: 1, maximum: 180, description: "Cuántos minutos (25 si no lo dice)" }, tarea: { type: "string", description: "El id de la tarea de hoy, si el foco es para una tarea" }, habito: { type: "string", description: "El nombre del hábito con tiempo, si el foco es para un hábito" }, titulo: { type: "string", description: "En qué se va a concentrar, en pocas palabras, si no es una tarea ni un hábito (máximo 60 caracteres)" } }, required: ["minutos"], additionalProperties: false } };
const paraClaude = (hs) => hs.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
const sinTildes = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* Revisa el foco que pidió Claude contra tu día. Devuelve lo que va en hizo (y a Claude, como resultado) */
export function empezarFoco(input, dia) {
  const minutos = Number(input && input.minutos);
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 180) return { ok: false, error: "dato-invalido", texto: "El foco va de 1 a 180 minutos." };
  const r = { ok: true, minutos };
  const tareas = (dia && Array.isArray(dia.tareas)) ? dia.tareas : [], conTiempo = (dia && Array.isArray(dia.habitos_tiempo)) ? dia.habitos_tiempo : [];
  if (input.tarea) {
    const t = tareas.find(x => x.id === String(input.tarea) && !x.hecha);
    if (!t) return { ok: false, error: "no-encontrado", texto: "No encontré esa tarea entre las pendientes de hoy." };
    r.tarea = t.id; r.titulo = t.texto;
  } else if (input.habito) {
    const h = conTiempo.find(x => sinTildes(x.nombre).includes(sinTildes(input.habito)));
    if (!h) return { ok: false, error: "no-encontrado", texto: "No encontré ese hábito entre los que tienen tiempo hoy." };
    r.habito = h.nombre; r.titulo = h.nombre;
  } else {
    const t = limpio(input.titulo, 60);
    if (t) r.titulo = t;
  }
  r.texto = `Foco de ${minutos} minutos${r.titulo ? " en " + r.titulo : ""}. Corre en la isla de Norte-Desk.`;
  return r;
}

/* La cara del final: «[cara: feliz]» → "feliz"; el texto queda sin la etiqueta */
export function separarCara(texto) {
  let cara = "contento";
  const t = String(texto || "").replace(/\[\s*cara\s*:\s*([a-záéíóúñ]+)\s*\]/gi, (_, c) => {
    const n = c.toLowerCase(); if (CARAS.includes(n)) cara = n; return "";
  }).replace(/\s+\n/g, "\n").trim();
  return { texto: t, cara };
}

/* El historial que manda la app: lo último, sin vacíos, alternando como pide la API (empieza con «yo») */
function armarHistorial(h) {
  const xs = (Array.isArray(h) ? h : []).slice(-HISTORIAL_MAX)
    .map(m => ({ role: m && m.rol === "norte" ? "assistant" : "user", content: limpio(m && m.texto, 1000) }))
    .filter(m => m.content);
  while (xs.length && xs[0].role !== "user") xs.shift();
  const fusion = [];
  for (const m of xs) {
    const ult = fusion[fusion.length - 1];
    if (ult && ult.role === m.role) ult.content += "\n" + m.content; else fusion.push({ role: m.role, content: m.content });
  }
  return fusion;
}

/* ---------- Charla ---------- */
async function charla({ sb, uid, body, ahora, claude }) {
  if (!claude) return fallo(500, "sin-cerebro", TEXTOS_CHARLA["sin-cerebro"]);
  const texto = limpio(body.texto, TEXTO_MAX);
  if (texto == null) return fallo(400, "dato-invalido", "Es muy largo. Dímelo más corto.");
  if (!texto) return fallo(400, "dato-invalido", "¿Qué me quieres decir?");
  const uso = await sumarUso(sb, uid, ahora, { charlas: 1 });
  if (uso.sinTabla) return fallo(500, "sin-servidor", TEXTOS["sin-servidor"]);
  if (uso.ok === false) return falloLimite(uso.limite);

  const hoy = await accionNorte({ sb, uid, accion: "hoy", ahora });
  const dia = hoy.cuerpo.ok ? hoy.cuerpo.datos : null;
  const herramientas = Array.isArray(body.puede) && body.puede.includes("foco") ? [...HERRAMIENTAS, HERRAMIENTA_FOCO] : HERRAMIENTAS;
  const messages = armarHistorial(body.historial);
  messages.push({ role: "user", content: texto });   // si el historial terminaba en «yo», la API junta los dos
  const hizo = [];
  let r = null;
  try {
    for (let vuelta = 0; vuelta < VUELTAS_MAX; vuelta++) {
      r = await claude.messages.create({
        model: MODELO, max_tokens: 1024, output_config: { effort: "low" },
        system: sistema(dia, ahora), tools: paraClaude(herramientas), messages,
      });
      if (r.stop_reason !== "tool_use") break;
      messages.push({ role: "assistant", content: r.content });
      const resultados = [];
      for (const b of r.content.filter(x => x.type === "tool_use")) {
        const h = herramientas.find(x => x.name === b.name);
        let res;
        if (!h) res = { ok: false, error: "herramienta", texto: "No conozco esa herramienta." };
        else if (h.accion === "empezar_foco") {
          res = empezarFoco(b.input || {}, dia);
          hizo.push(Object.assign({ accion: h.accion }, res));
        } else {
          res = (await accionNorte({ sb, uid, accion: h.accion, body: b.input || {}, ahora })).cuerpo;
          if (h.accion !== "hoy") hizo.push({ accion: h.accion, ok: !!res.ok, texto: res.texto });
        }
        resultados.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(res).slice(0, 4000), is_error: !res.ok || undefined });
      }
      messages.push({ role: "user", content: resultados });
    }
  } catch (e) {
    if (e && (e.status === 429 || e.status === 529 || e.status === 503)) return fallo(503, "ocupado", TEXTOS_CHARLA.ocupado, { hizo });
    throw e;
  }
  if (r && r.stop_reason === "refusal") return exito({ texto: "Mejor hablemos de otra cosa. ¿Cómo va tu día?", cara: "serio", hizo });
  const crudo = (r ? r.content : []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const { texto: respuesta, cara } = separarCara(crudo);
  return exito({ texto: respuesta || (hizo.length ? hizo[hizo.length - 1].texto : "Aquí estoy."), cara, hizo });
}

/* ---------- Oído y voz (Azure) ---------- */
/* Lee un WAV PCM: { rate, canales, bits, segundos, ok } */
export function leerWav(buf) {
  if (!buf || buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return { ok: false };
  let i = 12, fmt = null, datos = 0;
  while (i + 8 <= buf.length) {
    const id = buf.toString("ascii", i, i + 4), largo = buf.readUInt32LE(i + 4);
    if (id === "fmt ") fmt = { formato: buf.readUInt16LE(i + 8), canales: buf.readUInt16LE(i + 10), rate: buf.readUInt32LE(i + 12), bits: buf.readUInt16LE(i + 22) };
    if (id === "data") { datos = Math.min(largo, buf.length - i - 8); break; }
    i += 8 + largo + (largo % 2);
  }
  if (!fmt || fmt.formato !== 1 || fmt.canales !== 1 || fmt.bits !== 16 || fmt.rate < 8000 || fmt.rate > 48000) return { ok: false };
  return { ok: true, rate: fmt.rate, segundos: datos / (fmt.rate * 2) };
}

async function oir({ sb, uid, body, ahora, azure }) {
  if (!azure) return fallo(500, "sin-voz", TEXTOS_CHARLA["sin-voz"]);
  if (typeof body.audio !== "string" || body.audio.length > 2_000_000) return fallo(400, "dato-invalido", "No pude leer el audio.");
  const buf = Buffer.from(body.audio, "base64"), wav = leerWav(buf);
  if (!wav.ok) return fallo(400, "dato-invalido", "No pude leer el audio.");
  if (wav.segundos > AUDIO_SEG_MAX) return fallo(400, "dato-invalido", "Es muy largo. Dímelo en menos de treinta segundos.");
  if (wav.segundos < 0.3) return fallo(400, "no-te-oi", TEXTOS_CHARLA["no-te-oi"]);
  const uso = await sumarUso(sb, uid, ahora, { segundos: Math.ceil(wav.segundos) });
  if (uso.sinTabla) return fallo(500, "sin-servidor", TEXTOS["sin-servidor"]);
  if (uso.ok === false) return falloLimite(uso.limite);
  const texto = limpio(await azure.oir(buf, wav.rate), 1000) || "";
  if (!texto) return fallo(200, "no-te-oi", TEXTOS_CHARLA["no-te-oi"]);
  return exito({ texto });
}

async function hablar({ sb, uid, body, ahora, azure }) {
  if (!azure) return fallo(500, "sin-voz", TEXTOS_CHARLA["sin-voz"]);
  const texto = limpio(paraVoz(typeof body.texto === "string" ? body.texto : ""), HABLAR_MAX);
  if (!texto) return fallo(400, "dato-invalido", "No tengo nada que decir.");
  const voz = VOCES[body.voz] || VOCES[VOZ_DEFECTO];
  const uso = await sumarUso(sb, uid, ahora, { caracteres: texto.length });
  if (uso.sinTabla) return fallo(500, "sin-servidor", TEXTOS["sin-servidor"]);
  if (uso.ok === false) return falloLimite(uso.limite);
  const audio = await azure.hablar(texto, voz);
  return exito({ audio: Buffer.from(audio).toString("base64"), tipo: "audio/mpeg" });
}

/* El cliente de Azure (REST, sin SDK). null si falta la clave o la región */
export function crearAzure({ clave, region, fetch: f = globalThis.fetch }) {
  clave = String(clave || "").trim(); region = String(region || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!clave || !region) return null;
  const xml = s => s.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  async function revisar(r) {
    if (r.ok) return r;
    const e = new Error(`Azure respondió ${r.status}`); e.status = r.status === 429 ? 429 : 503; throw e;
  }
  return {
    async oir(buf, rate) {
      const r = await revisar(await f(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=es-CL&format=simple`, {
        method: "POST", body: buf,
        headers: { "Ocp-Apim-Subscription-Key": clave, "Content-Type": `audio/wav; codecs=audio/pcm; samplerate=${rate}`, Accept: "application/json" },
      }));
      const j = await r.json();
      return j && j.RecognitionStatus === "Success" ? String(j.DisplayText || "") : "";
    },
    async hablar(texto, voz) {
      const cuerpo = /Multilingual/.test(voz) ? `<lang xml:lang="${IDIOMA_MULTILINGUE}">${xml(texto)}</lang>` : xml(texto);
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-CL"><voice name="${voz}">${cuerpo}</voice></speak>`;
      const r = await revisar(await f(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST", body: ssml,
        headers: { "Ocp-Apim-Subscription-Key": clave, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "rumbo-norte" },
      }));
      return new Uint8Array(await r.arrayBuffer());
    },
  };
}

const ACCIONES = { charla, oir, hablar };

/**
 * Atiende un pedido de Norte-Desk. Devuelve { status, cuerpo } (api/norte-chat.js lo responde tal cual).
 */
export async function atenderCharla({ sb, body, autorizacion, claude = null, azure = null, ahora = new Date() }) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const quien = await aparatoDe(sb, autorizacion, ahora);
  if (quien.error) return fallo(401, quien.error, TEXTOS[quien.error]);
  const accion = typeof b.accion === "string" ? b.accion : "";
  if (!Object.prototype.hasOwnProperty.call(ACCIONES, accion)) return fallo(400, "accion-invalida", TEXTOS["accion-invalida"]);
  try {
    return await ACCIONES[accion]({ sb, uid: quien.uid, body: b, ahora, claude, azure });
  } catch (e) {
    if (e && (e.status === 429 || e.status === 503)) return fallo(503, "ocupado", TEXTOS_CHARLA.ocupado);
    throw e;
  }
}
