/* ============================================================
   Rumbo · 🧭 Norte, tu brújula: lo que entiende el robot de voz (la lógica de api/norte.js)
   Norte (un ESP32 en el escritorio) hace POST a /api/norte/ con { accion, ... } y su token
   (Authorization: Bearer <token>, salvo al conectarse). Siempre responde JSON con una frase corta
   en español para que Norte la diga:
     éxito  { ok: true, texto, datos }          error  { ok: false, error, texto }  (HTTP 400/401/404/429/500)

   Nada de aquí escribe tu documento (estado_usuario): se lee para responder, y lo que pides va a
   la bandeja. Hábitos, tareas, notas, abrir y cerrar el día van a norte_pendientes (supabase/norte.sql);
   el agua, a agua_pendientes (supabase/agua.sql), igual que «+ Un vaso» del aviso (notifier/vaso.mjs).
   La app los aplica con sus propias funciones al abrirse o al volver (js/norte.js). Al responder,
   lo que espera en la bandeja ya cuenta (un hábito marcado por voz sale como hecho).

   Acciones: conectar · hoy · sumar_agua · marcar_habito · anotar · abrir_dia · cerrar_dia · completar_tarea · foco.
   «hoy» trae también tus tareas de hoy (con su id), tus hábitos con tiempo (sus minutos y los que llevas hoy) y
   las rachas de tus hábitos de hoy (y la que está en riesgo), para Norte-Desk; completar_tarea y foco van a la bandeja como tarea_hecha y foco (supabase/norte-foco.sql).
   Para Norte-Desk también: reportar_falla («esto falló», a norte_fallas: supabase/norte-fallas.sql), buenos_dias (el
   tiempo de tu ciudad con Open-Meteo y lo principal del día, en una frase) y agenda (tus próximas reuniones de Google
   Calendar, por la función gcal de Rumbo, si lo conectaste). Las notas anotadas pueden ser largas (NOTA_LARGA).
   abrir_dia y cerrar_dia con «completo: true» (Norte-Desk) traen el ritual entero, como en la app: al abrir, la misión, el
   pilar, a quién sirves, los proyectos y las tareas del día (nuevas y las que se quitan); al cerrar, si cumpliste tu misión,
   el bocado, qué pasa con cada pendiente, la energía, lo que agradeces, una cosa para mañana y una nota. Sin «completo»
   siguen siendo los rituales cortos del robot. «hoy» trae lo que esos formularios necesitan (la misión sugerida, etc.)
   y tu semana (el foco, las prioridades, el premio y los hábitos en foco del ritual semanal).
   Para las pantallas del robot, «hoy» trae además cómo fue cada día de la semana (semana.dias), los últimos siete días de
   tus hábitos de hoy (habitos_semana) y tu agua como la ves en Rumbo: tu vaso, tu botella, el estilo y el sabor que tienes
   puestos (solo si los compraste), la temperatura del día y la hora del último vaso; y la hora de la persona (hora, "HH:MM")
   para los avisos del robot. sumar_agua con «botella: true» suma tu botella.
   Fase 2 (2026-11-20; tipos nuevos de la bandeja en supabase/norte-fase2.sql): «hoy» trae también jardin (las macetas,
   como jardinEscena), habitos_hora (los hábitos de hoy con «Recordar a las…», h.hora), alcancias (las abiertas) y leyendo
   (los libros de «Leyendo ahora»). Lectura: alarmas (settings.norte.alarmas, o las del robot en la bandeja si son más
   nuevas; trae también `ajustes`), ajustes (los avisos de Norte, el modo noche y si se aburre: settings.norte.ajustes),
   recordatorios (settings.norte.recordatorios con la bandeja), social (ánimos y marcas de amigos en conjunto desde
   `desde`, los planes y cumpleaños de hoy) y tu_anio (las láminas, desde el 1 de diciembre). Escritura, a la bandeja:
   guardar_alarmas (alarmas), recordar · recordatorio_listo · borrar_recordatorio (recordatorio), mover_tarea (tarea_mover),
   alcancia, diario y lectura. animo es la única que escribe fuera de la bandeja: directo a la tabla animos, con las reglas de
   amigos_animo (amistad aceptada, 3 al día a la misma persona). buenos_dias suma los planes y cumpleaños de hoy.
   «Hoy» es el día de la persona (settings.notif.tz, America/Santiago si no hay). Qué hábitos tocan
   hoy lo dice el mismo motor de la app (js/habitos-motor.js, vía notifier/habitos.mjs).
   Recibe el cliente de Supabase (`sb`), así se prueba sin red (tests/norte.test.mjs).
   ============================================================ */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { localDate } from "./recordatorios.mjs";
import { motorHabitos } from "./habitos.mjs";
import { vasoDe, botellaDe } from "./elefante.mjs";
import { VASOS_AL_DIA } from "./vaso.mjs";
import { rachaConjunto } from "./habitos.mjs";
import { instantePlan } from "./planes.mjs";

export const TEXTO_MAX = 200;          // tareas, notas, primer bocado y gratitud
export const NOTA_MAX = 600;           // la nota libre del cierre
export const NOTA_LARGA = 1000;        // una nota anotada (Norte-Desk: «anota esto» con lo que copiaste)
export const FALLAS_HORA = 20;         // reportes de «esto falló» por hora
const DONDE_FALLA = ["charla", "voz", "ritual", "isla", "anotar", "ajustes", "otro"];
// Cada pedido de la bandeja pesa menos de 4000 bytes (norte_pendientes.datos en supabase/norte.sql); en JSON se deja
// margen, porque jsonb pesa algo más que el texto
export const DATOS_MAX = 2800;
const muyGrande = datos => Buffer.byteLength(JSON.stringify(datos), "utf8") > DATOS_MAX;
const MUY_LARGO = "Es mucho para guardar de una vez. Acorta tu nota o tus tareas y prueba de nuevo.";
// Los pilares del ritual de apertura (PILARES en js/modules2.js: si cambian allá, cambian aquí)
export const PILARES = ["Psicología", "Fisiología", "Productividad", "Magnetismo", "Presencia", "Propósito"];
const DECISIONES = ["manana", "otro", "delegar", "soltar", "hecha"];   // qué pasa con una pendiente al cerrar (TRIAGE_OPC)
const ID_TAREA = /^[A-Za-z0-9_-]{1,64}$/, FECHA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PEDIDOS_HORA = 60;        // pedidos a la bandeja por hora (un token filtrado no la llena)
export const VASOS_MAX = 6;            // vasos por pedido
const TZ_DEFECTO = "America/Santiago";

const sha = s => createHash("sha256").update(String(s), "utf8").digest("hex");
const sinTablas = e => /does not exist|schema cache|Could not find/i.test(String((e && e.message) || e));
export const hashCodigo = codigo => sha(codigo);   // igual que encode(sha256(convert_to(c, 'UTF8')), 'hex') en norte.sql
export const hashToken = token => sha(token);

/* ---------- Respuestas ---------- */
const exito = (texto, datos = {}, extra = {}) => ({ status: 200, cuerpo: Object.assign({ ok: true, texto, datos }, extra) });
const fallo = (status, error, texto, datos) => ({ status, cuerpo: Object.assign({ ok: false, error, texto }, datos ? { datos } : {}) });
export const TEXTOS = {
  "no-autorizado": "No estoy conectado a tu Rumbo. Pide un código en la app, en Cuenta, y conéctame.",
  "desconectado": "Me desconectaron desde la app. Si quieres seguir conmigo, pide un código nuevo en Cuenta.",
  "codigo-invalido": "Ese código no me sirve. Revisa los seis números en la app y prueba otra vez.",
  "codigo-vencido": "Ese código ya no sirve. Pide uno nuevo en la app, en Cuenta.",
  "demasiados-intentos": "Hubo demasiados intentos. Espera unos minutos y pide un código nuevo.",
  "demasiados-pedidos": "Vamos muy rápido. Abre Rumbo un momento y seguimos.",
  "accion-invalida": "No entendí qué quieres que haga.",
  "sin-servidor": "Todavía no estoy listo: falta activar mi parte en Rumbo.",
  "error": "Tuve un problema para hablar con Rumbo. Prueba de nuevo en un rato.",
};
const falloDe = (status, error, datos) => fallo(status, error, TEXTOS[error], datos);

/* ---------- Palabras ---------- */
/* Sin tildes, sin mayúsculas y sin signos: «Meditár!» y «meditar» son lo mismo */
export function normalizar(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}
/* Un nombre para decir en voz alta: sin emojis ni espacios de más */
export function paraVoz(s) {
  return String(s == null ? "" : s).replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍⃣]/gu, "").replace(/\s+/g, " ").trim();
}
/* Para comparar tareas: sin tildes, mayúsculas, signos ni espacios de más («Definir estructuras, NewHome» = «definir estructuras newhome») */
export const mismaTarea = (a, b) => { const n = normalizar(a); return !!n && n === normalizar(b); };
/* Lo que se va a guardar: sin caracteres de control. null si es demasiado largo */
function textoLimpio(v, max = TEXTO_MAX) {
  if (v == null) return "";
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? null : t;
}
/* Igual, pero conserva los saltos de línea (una nota copiada: un correo, una lista), hasta 2 seguidos */
function textoConLineas(v, max) {
  if (v == null) return "";
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ").replace(/[ \t]+/g, " ")
    .split("\n").map(l => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > max ? null : t;
}
/* «a», «a y b», «a, b y c», «a, b, c y 2 más» */
export function enLista(xs, y = "y") {
  const l = xs.filter(Boolean);
  if (l.length <= 1) return l[0] || "";
  if (l.length > 4) return `${l.slice(0, 3).join(", ")} ${y} ${l.length - 3} más`;
  return `${l.slice(0, -1).join(", ")} ${y} ${l[l.length - 1]}`;
}
const cuantos = (n, sg, pl, un = "un") => (n === 1 ? `${un} ${sg}` : `${n} ${pl}`);
const NUMEROS = ["cero", "un", "dos", "tres", "cuatro", "cinco", "seis"];
export const litrosTxt = ml => (Math.round(ml / 100) / 10).toLocaleString("es-CL", { maximumFractionDigits: 1 });
/* Un número entero entre min y max, o el valor por defecto si no vino; null si vino mal */
function entero(v, min, max, defecto) {
  if (v == null || v === "") return defecto;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
/* Una lista de textos cortos (un arreglo, o separados por comas): null si algo vino mal */
function listaTextos(v, maxN, maxLargo) {
  if (v == null || v === "") return [];
  const xs = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : null;
  if (!xs || xs.length > maxN * 2) return null;
  const out = [];
  for (const x of xs) {
    const t = textoLimpio(x, maxLargo);
    if (t == null) return null;
    if (t && !out.includes(t)) out.push(t);
  }
  return out.length > maxN ? null : out;
}
/* La fecha de n días después (o antes) de un día */
const diaMas = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const idNuevo = (letra, ahora, i = 0) => `${letra}${ahora.getTime().toString(36)}${i.toString(36)}${randomBytes(4).toString("hex")}`;

/* ---------- Hábitos ---------- */
const esHacer = h => !h || (h.meta !== "dejar" && h.meta !== "reducir");
/* Busca un hábito por nombre: igual (sin tildes ni mayúsculas), después por parte del nombre y por
   palabras («medit» o «meditación» encuentran «Meditar»). Devuelve los candidatos (0, 1 o varios). */
export function buscarHabito(defs, consulta) {
  const q = normalizar(consulta);
  if (!q) return [];
  const vivos = (Array.isArray(defs) ? defs : []).filter(h => h && h.id && !h.pausado && normalizar(h.nombre));
  const igual = vivos.filter(h => normalizar(h.nombre) === q);
  if (igual.length) return igual;
  const parte = vivos.filter(h => { const n = normalizar(h.nombre); return n.includes(q) || (n.length >= 3 && q.includes(n)); });
  if (parte.length) return parte;
  const raiz = (a, b) => a === b || (a.length >= 3 && b.startsWith(a)) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));
  const palabras = q.split(" ").filter(w => w.length >= 3);
  if (!palabras.length) return [];
  return vivos.filter(h => { const ws = normalizar(h.nombre).split(" "); return palabras.every(p => ws.some(w => raiz(p, w))); });
}

/* ---------- Tu día, con lo que espera en la bandeja ---------- */
function totalAgua(d) {
  if (!d) return 0;
  if (!Array.isArray(d.r)) return +d.ml || 0;
  const b = new Set(d.b || []);
  return d.r.filter(x => x && !b.has(x.id)).reduce((s, x) => s + (+x.ml || 0), 0);
}
/* ¿Ese vaso de agua_pendientes ya está en el día (lo sumó la app, o lo borraste)? */
function vasoYaEsta(data, v) {
  const d = data && data.agua && data.agua.dias && data.agua.dias[v.fecha];
  return !!(d && ((Array.isArray(d.r) && d.r.some(x => x && x.id === v.id)) || (Array.isArray(d.b) && d.b.includes(v.id))));
}
/* La meta: la que elegiste, o 2 L, más lo del calor del día (como notifier/elefante.mjs). La automática
   por tu peso solo se sabe en la app. */
function metaAgua(data, hoy) {
  const a = (data && data.agua) || {}, d = a.dias && a.dias[hoy];
  const c = a.clima && a.clima.on && d && typeof d.c === "number" && !d.cp ? d.c : null;
  return (a.meta > 0 ? +a.meta : 2000) + (c == null ? 0 : c >= 32 ? 1000 : c >= 28 ? 500 : 0);
}
function marcarEnLog(S, hid, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return;
  const k = `${y}-${m}`;
  S.habitos.log[k] = S.habitos.log[k] || {};
  S.habitos.log[k][hid] = Object.assign({}, S.habitos.log[k][hid], { [d]: true });
}
const estadoTarea = t => (t && t.estado) || (t && t.done ? "hecha" : "pendiente");
/* Un texto para mostrar (tareas): sin caracteres de control, hasta 200 */
const visible = s => String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
/* Minutos de foco de un hábito en un día (STATE.enfoque.sesiones, como focoMinHabito de js/foco.js) */
function focoMin(S, hid, iso) {
  return (((S && S.enfoque && S.enfoque.sesiones) || [])).filter(x => x && !x.borrada && x.fecha === iso && x.habId === hid)
    .reduce((a, x) => a + (+x.real || 0), 0);
}

/* Tu estado con lo de la bandeja ya puesto (en una copia): lo que la app hará al abrirse */
function simular(data, bandeja, hoy) {
  const copia = JSON.parse(JSON.stringify(data && typeof data === "object" ? data : {}));
  if (!copia.habitos || typeof copia.habitos !== "object") copia.habitos = { defs: [], log: {} };
  if (!Array.isArray(copia.habitos.defs)) copia.habitos.defs = [];
  if (!copia.habitos.log || typeof copia.habitos.log !== "object") copia.habitos.log = {};
  const aplicados = new Set(((copia.norte && copia.norte.hechos) || []).map(x => x && x.id));
  const pend = ((bandeja && bandeja.norte) || []).filter(p => p && p.id && !aplicados.has(p.id))
    .sort((a, b) => String(a.creado || "").localeCompare(String(b.creado || "")));
  const agua = ((bandeja && bandeja.agua) || []).filter(v => v && v.id && !vasoYaEsta(copia, v));
  const dia = Object.assign({}, ((copia.ritual && copia.ritual.dias) || {})[hoy]);
  let bocado = null, bocadoPedido = null, tareas = 0, mananaAyer = "";
  const nuevasTareas = [], tareasHechas = new Set(), quitadas = new Set(), ayer = diaMas(hoy, -1);
  let alarmas = null;
  const recOps = [], movidas = new Set(), aportes = [], paginas = new Map();
  if (!copia.enfoque || typeof copia.enfoque !== "object" || Array.isArray(copia.enfoque)) copia.enfoque = {};
  if (!Array.isArray(copia.enfoque.sesiones)) copia.enfoque.sesiones = [];
  for (const p of pend) {
    const d = p.datos || {};
    if (p.tipo === "habito" && d.hid && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "")) marcarEnLog(copia, d.hid, d.fecha);
    else if (p.tipo === "tarea") {   // van a tu día de hoy (o al día en que la app las aplique), con id fijo «nt<pedido>»
      tareas++;
      nuevasTareas.push({ id: "nt" + p.id, texto: visible(d.texto), ambito: d.ambito === "pro" ? "pro" : "per" });
    }
    else if (p.tipo === "tarea_hecha" && d.tid) tareasHechas.add(String(d.tid));
    else if (p.tipo === "foco" && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "")) {
      copia.enfoque.sesiones.push({ id: "nf" + p.id, fecha: d.fecha, habId: d.hid || undefined, real: +d.min || 0 });
      // como la app al aplicarlo: si con esto completa los minutos del hábito, queda marcado
      const h = d.hid && copia.habitos.defs.find(x => x && x.id === d.hid);
      if (h && +h.minutos > 0 && focoMin(copia, h.id, d.fecha) >= +h.minutos) marcarEnLog(copia, h.id, d.fecha);
    }
    else if (p.tipo === "abrir" && d.fecha === hoy) {
      dia.hecho = true;
      // la app crea la tarea del bocado con id fijo «nb<pedido>0» (norteFijarIds numera las nuevas desde 0), o marca
      // como bocado la que ya tenía ese texto
      if (d.primer_bocado) { bocado = d.primer_bocado; bocadoPedido = { id: "nb" + p.id + "0", ambito: d.ambito === "per" ? "per" : "pro" }; }
      if (d.energia) dia.energia = d.energia;
      // el ritual completo (Norte-Desk): lo demás de la apertura y las tareas del día, con id fijo «na<pedido><n>»
      ["mision", "pilar", "servir"].forEach(k => { if (d[k]) dia[k] = d[k]; });
      if (Array.isArray(d.proyectos) && d.proyectos.length) dia.proyectos = d.proyectos;
      (Array.isArray(d.tareas_nuevas) ? d.tareas_nuevas : []).forEach((t, k) => {
        if (t && t.texto) nuevasTareas.push({ id: "na" + p.id + k.toString(36), texto: visible(t.texto), ambito: t.ambito === "pro" ? "pro" : "per", porTexto: true });
      });
      (Array.isArray(d.tareas_quitar) ? d.tareas_quitar : []).forEach(id => quitadas.add(String(id)));
    }
    else if (p.tipo === "cerrar" && d.fecha === hoy) dia.cerrado = true;
    else if (p.tipo === "cerrar" && d.fecha === ayer && d.manana) mananaAyer = d.manana;   // ayer dejaste algo para hoy
    // Fase 2: lo que el robot dejó y la app todavía no aplica
    else if (p.tipo === "alarmas" && +d.ts > (alarmas ? +alarmas.ts : -1)) alarmas = d;   // las del robot, si son más nuevas
    else if (p.tipo === "recordatorio" && d.id) recOps.push(d);
    else if (p.tipo === "tarea_mover" && d.tid) movidas.add(String(d.tid));   // ya no está pendiente hoy
    else if (p.tipo === "alcancia" && d.aid && +d.monto > 0) aportes.push({ aid: String(d.aid), monto: Math.round(+d.monto) });
    else if (p.tipo === "lectura" && d.lid) {
      if (d.pagina != null) paginas.set(String(d.lid), +d.pagina);
      // con minutos, una sesión de foco de lectura (como la que creará la app, id fijo «nl<pedido>»)
      if (+d.min > 0 && FECHA.test(d.fecha || "")) copia.enfoque.sesiones.push({ id: "nl" + p.id, fecha: d.fecha, libroId: String(d.lid), real: +d.min });
    }
  }
  return { copia, pend, agua, dia, bocado, bocadoPedido, tareas, nuevasTareas, tareasHechas, quitadas, mananaAyer, motor: motorHabitos(copia, hoy),
    alarmas, recOps, movidas, aportes, paginas };
}

/* Tu estado con lo que espera en la bandeja ya puesto, en una copia (no se guarda nada), para los avisos del celular
   (notifier/recordatorios.mjs): así no te recuerda abrir o cerrar el día, un hábito o el agua que ya le dijiste a
   Norte (o que anotaste con «+ Un vaso» desde el aviso) mientras la app todavía no lo aplica. */
export function conBandeja(data, bandeja, hoy) {
  const s = simular(data, bandeja, hoy), c = s.copia;   // hábitos y foco ya marcados en la copia
  if (!c.ritual || typeof c.ritual !== "object") c.ritual = {};
  if (!c.ritual.dias || typeof c.ritual.dias !== "object") c.ritual.dias = {};
  for (const p of s.pend) {
    const d = p.datos || {};
    if ((p.tipo !== "abrir" && p.tipo !== "cerrar") || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "")) continue;
    const r = Object.assign({}, c.ritual.dias[d.fecha]);
    if (p.tipo === "abrir") {
      r.hecho = true;
      if (d.primer_bocado && !r.sapo) r.sapo = visible(d.primer_bocado);
      if (d.energia && !r.energia) r.energia = d.energia;
    } else r.cerrado = true;
    c.ritual.dias[d.fecha] = r;
  }
  if (s.agua.length) {
    if (!c.agua || typeof c.agua !== "object") c.agua = {};
    if (!c.agua.dias || typeof c.agua.dias !== "object") c.agua.dias = {};
    for (const v of s.agua) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha || "")) continue;
      const d = Object.assign({}, c.agua.dias[v.fecha]);
      const r = Array.isArray(d.r) ? d.r.slice() : (+d.ml > 0 ? [{ id: "ml", ml: +d.ml }] : []);
      r.push({ id: v.id, ml: +v.ml || 0 });
      d.r = r;
      c.agua.dias[v.fecha] = d;
    }
  }
  return c;
}

/* Tus tareas de hoy para mostrar (Norte-Desk): primero el bocado y las prioridades, las hechas al final. Todas (la
   respuesta muestra 30). «antigua»: viene de otro día (no se quita al abrir el día); «postergada»: cuántas veces se movió. */
function listaTareas(tareasDia, s) {
  const xs = tareasDia.filter(t => ["pendiente", "hecha"].includes(estadoTarea(t)) && !s.quitadas.has(String(t.id))
    && !(s.movidas.has(String(t.id)) && estadoTarea(t) === "pendiente" && !s.tareasHechas.has(String(t.id)))).map(t => ({
    id: String(t.id), texto: visible(t.txt), ambito: t.ambito === "pro" ? "pro" : "per",
    hecha: estadoTarea(t) === "hecha" || s.tareasHechas.has(String(t.id)), bocado: !!t.esSapo, prioridad: !!t.prioridad,
    antigua: (+t.migraciones || 0) > 0 || !!t.bocadoSugerido, postergada: +t.migraciones || 0,
  }));
  // las nuevas del ritual completo son como en la app: si ya tienes una con ese texto (aunque la quites), no se crea otra
  const textos = new Set(tareasDia.filter(t => ["pendiente", "hecha"].includes(estadoTarea(t))).map(t => normalizar(t.txt)));
  s.nuevasTareas.forEach(t => {
    if (xs.some(x => x.id === t.id || (t.porTexto && mismaTarea(x.texto, t.texto))) || (t.porTexto && textos.has(normalizar(t.texto))) || s.quitadas.has(t.id) || s.movidas.has(t.id)) return;
    xs.push({ id: t.id, texto: t.texto, ambito: t.ambito, hecha: s.tareasHechas.has(t.id), bocado: false, prioridad: false, antigua: false, postergada: 0 });
  });
  // El bocado que espera en la bandeja (abriste el día con Norte): como lo dejará la app (aplicarAperturaExpress), la
  // tarea con ese texto pasa a ser el bocado, o se crea con id fijo «nb<pedido>0». Así se puede completar desde Norte-Desk
  // (completar_tarea) antes de que la app lo aplique: el tarea_hecha queda en la bandeja después del abrir.
  if (s.bocado && s.bocadoPedido) {
    const txt = visible(s.bocado), igual = xs.find(x => mismaTarea(x.texto, txt));
    xs.forEach(x => { if (x.bocado && x !== igual) x.bocado = false; });
    if (igual) igual.bocado = true;
    else if (txt) xs.push({ id: s.bocadoPedido.id, texto: txt, ambito: s.bocadoPedido.ambito, hecha: s.tareasHechas.has(s.bocadoPedido.id), bocado: true, prioridad: false, antigua: false, postergada: 0 });
  }
  const peso = x => (x.hecha ? 10 : 0) + (x.bocado ? 0 : x.prioridad ? 1 : 2);
  return xs.filter(x => x.texto).sort((a, b) => peso(a) - peso(b));
}
/* Los proyectos de tus últimos días (los más recientes primero), para elegirlos al abrir el día */
function proyectosRecientes(copia, hoy) {
  const dias = (copia.ritual && copia.ritual.dias) || {}, out = [];
  for (let i = 1; i <= 30 && out.length < 8; i++) {
    const r = dias[diaMas(hoy, -i)];
    ((r && Array.isArray(r.proyectos)) ? r.proyectos : []).forEach(p => { const t = visible(p); if (t && !out.includes(t) && out.length < 8) out.push(t); });
  }
  return out;
}

/* Tu semana: el plan del ritual semanal de la app (STATE.ritual.semanas[lunes], js/ritual-semana.js): el foco, las
   prioridades (hecha si su tarea de la semana está hecha, como prioridadHecha; también si se completó por Norte y espera
   en la bandeja), el premio y los hábitos en foco. La semana va de lunes a domingo. */
function semanaDe(copia, hoy, s) {
  const lunes = diaMas(hoy, -((new Date(hoy + "T12:00:00Z").getUTCDay() + 6) % 7));
  const w = ((copia.ritual && copia.ritual.semanas) || {})[lunes] || {}, a = w.apertura && typeof w.apertura === "object" ? w.apertura : null;
  const dias = (copia.agenda && copia.agenda.dias) || {};
  const hecha = p => {
    for (let i = 0; i < 7; i++) {
      if ((dias[diaMas(lunes, i)] || []).some(t => t && !t.borrada && t.prioridad === p.id && (estadoTarea(t) === "hecha" || s.tareasHechas.has(String(t.id))))) return true;
    }
    return false;
  };
  const defs = copia.habitos.defs;
  // Tus números de la semana hasta hoy (como los del ritual semanal de la app): días abiertos y cerrados, hábitos,
  // tareas hechas y minutos de foco. Lo que espera en la bandeja ya cuenta.
  const diasHasta = Array.from({ length: (Date.parse(hoy) - Date.parse(lunes)) / 864e5 + 1 }, (_, i) => diaMas(lunes, i));
  const ritual = (copia.ritual && copia.ritual.dias) || {}, rDe = d => (d === hoy ? Object.assign({}, ritual[d], s.dia) : ritual[d]) || {};
  let tareasHechas = 0;
  diasHasta.forEach(d => (dias[d] || []).forEach(t => { if (t && !t.borrada && (estadoTarea(t) === "hecha" || s.tareasHechas.has(String(t.id)))) tareasHechas++; }));
  tareasHechas += s.nuevasTareas.filter(t => s.tareasHechas.has(t.id)).length;
  const foco = ((copia.enfoque && copia.enfoque.sesiones) || []).filter(x => x && !x.borrada && x.fecha >= lunes && x.fecha <= hoy).reduce((t, x) => t + (+x.real || 0), 0);
  const cumple = s.motor.cumplimiento(lunes, hoy);
  const numeros = {
    dias: diasHasta.length, abiertos: diasHasta.filter(d => rDe(d).hecho).length, cerrados: diasHasta.filter(d => rDe(d).cerrado).length,
    habitos_pct: cumple.pct, tareas_hechas: tareasHechas, foco_min: Math.round(foco),
  };
  // Cómo fue cada día, de lunes a domingo (la fila de días de la pantalla de Norte): "cerrado", "abierto", "nada"
  // (pasó sin abrirlo; hoy, todavía sin abrir) o null (todavía no llega)
  const estados = Array.from({ length: 7 }, (_, i) => { const d = diaMas(lunes, i); if (d > hoy) return null; const r = rDe(d); return r.cerrado ? "cerrado" : r.hecho ? "abierto" : "nada"; });
  return {
    desde: lunes, hasta: diaMas(lunes, 6), planificada: !!a, numeros, dias: estados,
    foco: a && a.foco ? visible(a.foco) : null,
    premio: w.plan && w.plan.premio ? visible(w.plan.premio) : null,
    prioridades: ((a && Array.isArray(a.prioridades)) ? a.prioridades : []).filter(p => p && p.texto).slice(0, 5).map(p => ({
      id: String(p.id || ""), texto: visible(p.texto), ambito: p.ambito === "pro" ? "pro" : "per", dia: FECHA.test(p.dia || "") ? p.dia : null, hecha: hecha(p),
    })),
    habitos_foco: ((a && Array.isArray(a.habitosFoco)) ? a.habitosFoco : []).map(id => defs.find(h => h && h.id === id)).filter(Boolean).map(h => paraVoz(h.nombre)).filter(Boolean),
  };
}

/* Tu agua como la ves en Rumbo (js/agua.js), para la pantalla del agua de Norte: tu vaso y tu botella, el estilo y el
   sabor que tienes puestos (solo si los compraste en la Tienda; si no, la botella y el natural, como aguaEstilo y
   aguaSabor), la temperatura del día si usas el clima (aguaTempDe) y la hora del último vaso (ms; lo que espera en la
   bandeja cuenta). */
const AGUA_ESTILOS = { botella: null, burbuja: "agua-burbuja", cantimplora: "agua-cantimplora", bombilla: "agua-bombilla", reloj: "agua-reloj", calor: "agua-calor", esclusa: "agua-esclusa", elefante: "agua-elefante" };
const AGUA_SABORES = { natural: null, pepino: "sabor-pepino", frutilla: "sabor-frutilla", te: "sabor-te", arandano: "sabor-arandano" };
function aguaComoSeVe(copia, hoy, s) {
  const g = (copia && copia.gamif) || {}, puesto = g.equipped || {}, tuyos = Array.isArray(g.owned) ? g.owned : [];
  const elegido = (lista, id, defecto) => (Object.prototype.hasOwnProperty.call(lista, id) && (!lista[id] || tuyos.includes(lista[id])) ? id : defecto);
  const a = (copia && copia.agua) || {}, d = a.dias && a.dias[hoy];
  const temp = a.clima && a.clima.on && d && typeof d.c === "number" ? d.c : null;
  const marcas = [...(d && Array.isArray(d.r) ? d.r.filter(x => x && !(d.b || []).includes(x.id)).map(x => +x.ts || 0) : []), ...s.agua.filter(v => v.fecha === hoy).map(v => +v.ts || 0)];
  return {
    vaso: vasoDe(copia), botella: botellaDe(copia),
    estilo: elegido(AGUA_ESTILOS, puesto.agua, "botella"), sabor: elegido(AGUA_SABORES, puesto.sabor, "natural"),
    temp, ultimo: marcas.length ? Math.max(...marcas) || null : null,
  };
}

/* Lo que Norte cuenta de tu día (la acción «hoy») */
export function resumenDia(data, bandeja, hoy) {
  const s = simular(data, bandeja, hoy), { copia, dia, motor } = s;
  const defs = copia.habitos.defs.filter(h => h && h.id && !h.pausado);
  const pendientes = motor.pendientesHoy().map(h => paraVoz(h.nombre)).filter(Boolean);
  const hechos = defs.filter(h => esHacer(h) && motor.hecho(h, hoy)).map(h => paraVoz(h.nombre)).filter(Boolean);
  const tareasDia = (((copia.agenda && copia.agenda.dias) || {})[hoy] || []).filter(t => t && !t.borrada);
  const sapo = tareasDia.find(t => t.esSapo);
  // El primer bocado está hecho si su tarea lo está (también si se completó por Norte y espera en la bandeja)
  const tareas = listaTareas(tareasDia, s), tareaBocado = tareas.find(x => x.bocado);
  let primer = null;
  if (s.bocado) primer = { texto: paraVoz(s.bocado), hecho: !!(tareaBocado && tareaBocado.hecha) };
  else if (sapo) primer = { texto: paraVoz(sapo.txt), hecho: estadoTarea(sapo) === "hecha" || s.tareasHechas.has(String(sapo.id)) };
  else if (dia.sapo) primer = { texto: paraVoz(dia.sapo), hecho: !!(dia.cierre && dia.cierre.sapo) };
  // Las rachas de tus hábitos de hoy (los que faltan y los hechos), como en la app: { nombre, n, unidad }, de 1 o más
  const deHoy = new Set([...motor.pendientesHoy().map(h => h.id), ...defs.filter(h => esHacer(h) && motor.hecho(h, hoy)).map(h => h.id)]);
  const rachas = defs.filter(h => deHoy.has(h.id)).map(h => Object.assign({ nombre: paraVoz(h.nombre) }, motor.racha(h)))
    .filter(r => r.nombre && r.n >= 1).map(r => ({ nombre: r.nombre, n: r.n, unidad: r.unidad }));
  const riesgo = motor.enRiesgo();
  const ml = totalAgua(copia.agua && copia.agua.dias && copia.agua.dias[hoy]) + s.agua.filter(v => v.fecha === hoy).reduce((t, v) => t + (+v.ml || 0), 0);
  // Los últimos siete días de tus hábitos de hoy (el tablero de la semana en Norte), del más antiguo a hoy:
  // h hecho · x tocaba y no se hizo · - no tocaba (o no existía) · p hoy, todavía sin hacer
  const habitosSemana = defs.filter(h => deHoy.has(h.id)).slice(0, 6).map(h => ({
    nombre: paraVoz(h.nombre),
    dias: Array.from({ length: 7 }, (_, i) => {
      const d = diaMas(hoy, i - 6);
      if (motor.hecho(h, d)) return "h";
      if (d === hoy) return "p";
      return d >= (h.creado || "0000-01-01") && motor.programado(h, d) ? "x" : "-";
    }).join(""),
  })).filter(x => x.nombre);
  // la misión de hoy que dejaste anoche («Una cosa para mañana»), como la propone la app al abrir el día
  const rAyer = ((copia.ritual && copia.ritual.dias) || {})[diaMas(hoy, -1)], manana = s.mananaAyer || (rAyer && rAyer.cierre && rAyer.cierre.manana) || "";
  return {
    fecha: hoy,
    abierto: !!dia.hecho,
    mision: dia.mision ? paraVoz(dia.mision) : null,
    mision_sugerida: !dia.mision && manana ? visible(manana) : null,
    primer_bocado: primer,
    energia: dia.energia ? +dia.energia : null,
    pilar: PILARES.includes(dia.pilar) ? dia.pilar : null,
    servir: dia.servir ? visible(dia.servir) : null,
    proyectos: Array.isArray(dia.proyectos) ? dia.proyectos.map(visible).filter(Boolean) : [],
    proyectos_recientes: proyectosRecientes(copia, hoy),
    cerrado: !!dia.cerrado,
    habitos_pendientes: pendientes,
    habitos_hechos: hechos,
    agua: Object.assign({ ml, meta_ml: metaAgua(copia, hoy) }, aguaComoSeVe(copia, hoy, s)),
    tareas_pendientes: tareas.filter(x => !x.hecha).length,
    en_bandeja: s.pend.length + s.agua.length,
    tareas: tareas.slice(0, 30),
    habitos_tiempo: defs.filter(h => esHacer(h) && +h.minutos > 0)
      .map(h => ({ nombre: paraVoz(h.nombre), minutos: +h.minutos, hoy: focoMin(copia, h.id, hoy), hecho: motor.hecho(h, hoy) })),
    habitos_racha: rachas,
    habitos_semana: habitosSemana,
    racha_en_riesgo: riesgo ? { nombre: paraVoz(riesgo.nombre), n: riesgo.n, unidad: riesgo.unidad } : null,
    semana: semanaDe(copia, hoy, s),
    // la ciudad que elegiste para el agua (Open-Meteo): Norte busca el tiempo y lo cercano ahí
    ciudad: copia.agua && copia.agua.clima && copia.agua.clima.ciudad ? visible(copia.agua.clima.ciudad) : null,
    // Fase 2 (las pantallas y avisos del robot)
    jardin: jardinDe(motor, copia.habitos.defs, hoy),
    habitos_hora: defs.filter(h => deHoy.has(h.id) && esHacer(h) && HORA.test(h.hora || ""))
      .map(h => ({ nombre: paraVoz(h.nombre), hora: h.hora, hecho: motor.hecho(h, hoy) })).filter(x => x.nombre)
      .sort((a, b) => a.hora.localeCompare(b.hora)),
    alcancias: alcanciasDe(copia, s).map(a => ({ id: a.id, nombre: a.nombre, meta: a.meta, total: a.total })),
    leyendo: leyendoDe(copia, s),
  };
}
/* Las macetas del jardín (hasta 3): { nombre, dias (cumplidos, hacia 66), hecho_hoy }. Lo marcado en la bandeja ya cuenta */
function jardinDe(motor, defs, hoy) {
  let macetas = [];
  try { macetas = motor.jardin() || []; } catch (e) { macetas = []; }
  return macetas.slice(0, 3).map(m => {
    const h = defs.find(x => x && x.id === m.id);
    return { nombre: paraVoz(m.nombre), dias: Math.max(0, +m.dias || 0), hecho_hoy: !!h && motor.hecho(h, hoy) };
  }).filter(m => m.nombre);
}
/* Tus alcancías abiertas (STATE.alcancias: sin las borradas ni las cerradas, como alcActivas), con lo guardado (los aportes
   deshechos no cuentan) y lo que espera en la bandeja */
function alcanciasDe(copia, s) {
  const A = copia.alcancias && typeof copia.alcancias === "object" ? copia.alcancias : {}, fuera = new Set(Array.isArray(A.borradas) ? A.borradas : []);
  return (Array.isArray(A.lista) ? A.lista : []).filter(a => a && a.id && !fuera.has(a.id) && !a.cerrada).map(a => {
    const b = new Set(Array.isArray(a.b) ? a.b : []);
    const total = (Array.isArray(a.aportes) ? a.aportes : []).filter(x => x && !b.has(x.id)).reduce((t, x) => t + (+x.monto || 0), 0)
      + (s ? s.aportes.filter(x => x.aid === String(a.id)).reduce((t, x) => t + x.monto, 0) : 0);
    return { id: String(a.id), nombre: paraVoz(a.nombre) || "Tu alcancía", meta: Math.max(0, Math.round(+a.meta || 0)), total: Math.round(total) };
  });
}
/* Los libros de «Leyendo ahora» (STATE.lecturas con estado "leyendo"), con la página que dijiste a Norte si espera en la bandeja */
function leyendoDe(copia, s) {
  return (Array.isArray(copia.lecturas) ? copia.lecturas : []).filter(l => l && l.id && l.estado === "leyendo").slice(0, 10).map(l => ({
    id: String(l.id), titulo: visible(l.titulo) || "Tu libro", autor: l.autor ? visible(l.autor) : null,
    pagina: s && s.paginas.has(String(l.id)) ? s.paginas.get(String(l.id)) : Math.max(0, Math.round(+l.pagina || 0)),
    paginas: Math.max(0, Math.round(+l.paginas || 0)),
  }));
}
export function textoHoy(d) {
  const partes = [];
  partes.push(d.cerrado ? "Ya cerraste tu día." : d.abierto ? "Tu día está abierto." : "Todavía no abres tu día.");
  if (d.mision && !d.cerrado) partes.push(`Tu misión: ${d.mision}.`);
  if (d.primer_bocado && d.primer_bocado.texto) partes.push(`Tu primer bocado es ${d.primer_bocado.texto}${d.primer_bocado.hecho ? ", y ya lo hiciste." : "."}`);
  if (d.habitos_pendientes.length) partes.push(`Te ${d.habitos_pendientes.length === 1 ? "falta" : "faltan"} ${cuantos(d.habitos_pendientes.length, "hábito", "hábitos")}: ${enLista(d.habitos_pendientes)}.`);
  else if (d.habitos_hechos.length) partes.push("Ya hiciste tus hábitos de hoy.");
  partes.push(`Llevas ${litrosTxt(d.agua.ml)} de ${litrosTxt(d.agua.meta_ml)} litros de agua.`);
  if (d.tareas_pendientes) partes.push(`Tienes ${cuantos(d.tareas_pendientes, "tarea pendiente", "tareas pendientes", "una")}.`);
  return partes.join(" ");
}

/* ---------- Lectura ---------- */
async function leerEstado(sb, uid) {
  const { data, error } = await sb.from("estado_usuario").select("data").eq("user_id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return (data && data.data && typeof data.data === "object") ? data.data : {};
}
async function leerBandeja(sb, uid) {
  const [n, a] = await Promise.all([
    sb.from("norte_pendientes").select("id, tipo, datos, creado").eq("user_id", uid),
    sb.from("agua_pendientes").select("id, fecha, ml, ts").eq("user_id", uid),
  ]);
  if (n.error) throw new Error(n.error.message);
  if (a.error && !sinTablas(a.error)) throw new Error(a.error.message);   // sin supabase/agua.sql: sin agua pendiente
  return { norte: n.data || [], agua: (a.error ? [] : a.data) || [] };
}
const hoyDe = (data, ahora) => localDate((data && data.settings && data.settings.notif && data.settings.notif.tz) || TZ_DEFECTO, ahora);
/* Un pedido más a la bandeja, si no van demasiados en la última hora */
/* `id`: el del pedido, si quien llama lo necesita antes (el recordatorio lleva el id fijo «nr<pedido>») */
async function aLaBandeja(sb, uid, tipo, datos, ahora, id = idNuevo("n", ahora)) {
  const desde = new Date(ahora.getTime() - 3600e3).toISOString();
  const { count, error: e1 } = await sb.from("norte_pendientes").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("creado", desde);
  if (e1) throw new Error(e1.message);
  if ((count || 0) >= PEDIDOS_HORA) return { limite: true };
  const { error } = await sb.from("norte_pendientes").insert({ id, user_id: uid, tipo, datos });
  if (error) throw new Error(error.message);
  return { id };
}

/* ---------- Conectar (sin token) ---------- */
async function conectar({ sb, body, ip }) {
  let codigo = typeof body.codigo === "number" ? String(body.codigo).padStart(6, "0") : String(body.codigo == null ? "" : body.codigo).replace(/\s+/g, "");
  if (!/^\d{6}$/.test(codigo)) return falloDe(400, "codigo-invalido");
  const aparato = String(body.aparato == null ? "" : body.aparato).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 64);
  const nombre = (String(body.nombre == null ? "" : body.nombre).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 40)) || "Norte";
  const token = randomBytes(32).toString("hex");
  const { data, error } = await sb.rpc("norte_conectar", {
    p_codigo_hash: hashCodigo(codigo), p_ip: sha("norte|" + (ip || "")).slice(0, 32), p_token_hash: hashToken(token), p_aparato: aparato, p_nombre: nombre,
  });
  if (error) { if (sinTablas(error)) return falloDe(500, "sin-servidor"); throw new Error(error.message); }
  const r = data || {};
  if (r.error === "demasiados-intentos") return falloDe(429, "demasiados-intentos");
  if (r.error === "codigo-vencido") return falloDe(400, "codigo-vencido");
  if (!r.ok) return falloDe(400, "codigo-invalido");
  return exito(`Listo, ya estoy conectado a tu Rumbo. Pregúntame cómo va tu día cuando quieras.`, { nombre }, { token });
}

/* ---------- Quién habla: el token de Norte ---------- */
async function aparatoDe(sb, autorizacion, ahora) {
  const token = String(autorizacion || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "no-autorizado" };
  const h = hashToken(token);
  const { data, error } = await sb.from("norte_aparatos").select("id, user_id, token_hash, desconectado").eq("token_hash", h).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || typeof data.token_hash !== "string" || data.token_hash.length !== h.length || !timingSafeEqual(Buffer.from(data.token_hash), Buffer.from(h))) return { error: "no-autorizado" };
  if (data.desconectado) return { error: "desconectado" };
  await sb.from("norte_aparatos").update({ ultimo_uso: ahora.toISOString() }).eq("id", data.id);
  return { uid: data.user_id, aparato: data.id };
}

/* ---------- Las acciones con token ---------- */
async function hoy({ sb, uid, ahora }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora);
  const d = resumenDia(data, await leerBandeja(sb, uid), dia);
  d.hora = horaDe(data, ahora); d.ahora = ahora.getTime();   // el robot calcula con esto su reloj del agua (agua.ultimo)
  return exito(textoHoy(d), d);
}
/* La hora de la persona ("HH:MM" en su zona): el robot la usa para sus avisos (8:00, 16:00, 20:00 y 21:00),
   porque su reloj viene del servidor de conversación y no sabe en qué zona está */
function horaDe(data, ahora) {
  const tz = (data && data.settings && data.settings.notif && data.settings.notif.tz) || TZ_DEFECTO;
  const f = z => new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ahora);
  try { return f(tz); } catch { return f(TZ_DEFECTO); }
}

async function sumarAgua({ sb, uid, body, ahora }) {
  // «botella: true»: tu botella entera de una vez (la de «+ Tu botella» del aviso del agua), en vez de vasos
  const botella = body.botella === true;
  const vasos = botella ? 1 : entero(body.vasos, 1, VASOS_MAX, 1);
  if (vasos == null) return fallo(400, "dato-invalido", "Puedo anotar de uno a seis vasos a la vez.");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), ml = botella ? botellaDe(data) : vasoDe(data);
  const desde = new Date(ahora.getTime() - 864e5).toISOString();
  const { count, error: e1 } = await sb.from("agua_pendientes").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("creado", desde);
  if (e1) { if (sinTablas(e1)) return falloDe(500, "sin-servidor"); throw new Error(e1.message); }
  if ((count || 0) + vasos > VASOS_AL_DIA) return fallo(429, "demasiados-pedidos", "Ya anoté mucha agua sin que abras Rumbo. Ábrelo un momento y seguimos.");
  const bandeja = await leerBandeja(sb, uid), antes = resumenDia(data, bandeja, dia).agua;
  const filas = Array.from({ length: vasos }, (_, i) => ({ user_id: uid, id: idNuevo("a", ahora, i), fecha: dia, ml, ts: ahora.getTime() + i }));
  const { error } = await sb.from("agua_pendientes").upsert(filas, { onConflict: "user_id,id", ignoreDuplicates: true });
  if (error) { if (sinTablas(error)) return falloDe(500, "sin-servidor"); throw new Error(error.message); }
  const agua = { ml: antes.ml + vasos * ml, meta_ml: antes.meta_ml };
  const llegaste = antes.ml < agua.meta_ml && agua.ml >= agua.meta_ml;
  const texto = `${botella ? "Anotada tu botella." : vasos === 1 ? "Anotado, un vaso." : `Anotados ${NUMEROS[vasos]} vasos.`} ${llegaste
    ? `Llegaste a tus ${litrosTxt(agua.meta_ml)} litros de hoy, bien hecho.` : `Llevas ${litrosTxt(agua.ml)} de ${litrosTxt(agua.meta_ml)} litros.`}`;
  return exito(texto, { fecha: dia, vasos, ml_vaso: ml, agua });
}

async function marcarHabito({ sb, uid, body, ahora }) {
  const consulta = textoLimpio(body.habito, 80);
  if (!consulta) return fallo(400, "dato-invalido", "¿Qué hábito marco?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), bandeja = await leerBandeja(sb, uid);
  const s = simular(data, bandeja, dia), d = resumenDia(data, bandeja, dia);
  const deHoy = [...d.habitos_pendientes, ...d.habitos_hechos];
  const xs = buscarHabito(s.copia.habitos.defs, consulta);
  if (!xs.length) return fallo(404, "habito-no-encontrado", deHoy.length ? `No encontré ese hábito. Hoy tienes ${enLista(deHoy)}.` : "No encontré ese hábito en tu Rumbo.", { habitos: deHoy });
  if (xs.length > 1) {
    const opciones = xs.map(h => paraVoz(h.nombre));
    return fallo(400, "habito-ambiguo", `¿Cuál de estos? ${enLista(opciones, "o")}.`, { opciones });
  }
  const h = xs[0], nombre = paraVoz(h.nombre) || "tu hábito";
  if (!esHacer(h)) return fallo(400, "habito-en-la-app", `${nombre} es ${h.meta === "dejar" ? "para dejarlo" : "de límite"}; eso se anota en la app.`, { habito: nombre });
  if (s.motor.hecho(h, dia)) return exito(`${nombre} ya estaba marcado hoy.`, { habito: nombre, ya: true, habitos_pendientes: d.habitos_pendientes });
  const r = await aLaBandeja(sb, uid, "habito", { hid: h.id, nombre: String(h.nombre).slice(0, 80), fecha: dia }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const quedan = d.habitos_pendientes.filter(n => n !== nombre);
  const cola = quedan.length ? ` Te ${quedan.length === 1 ? "queda" : "quedan"} ${cuantos(quedan.length, "hábito", "hábitos")}: ${enLista(quedan)}.`
    : d.habitos_pendientes.includes(nombre) ? " Con eso terminas tus hábitos de hoy." : "";
  return exito(`Listo, marqué ${nombre}.${cola}`, { habito: nombre, fecha: dia, habitos_pendientes: quedan });
}

async function anotar({ sb, uid, body, ahora }) {
  const texto = body.tipo === "nota" ? textoConLineas(body.texto, NOTA_LARGA) : textoLimpio(body.texto);
  if (texto == null) return fallo(400, "dato-invalido", "Es muy largo para anotarlo. Dímelo más corto.");
  if (!texto) return fallo(400, "dato-invalido", "¿Qué anoto?");
  const tipo = body.tipo == null || body.tipo === "" ? "tarea" : body.tipo;
  const ambito = body.ambito == null || body.ambito === "" ? "per" : body.ambito;
  if (!["tarea", "nota"].includes(tipo)) return fallo(400, "dato-invalido", "Puedo anotar una tarea o una nota.");
  if (!["pro", "per"].includes(ambito)) return fallo(400, "dato-invalido", "¿Es algo personal o profesional?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora);
  // Una tarea que ya tienes hoy (escrita igual, aunque cambien mayúsculas o tildes) no se anota otra vez
  if (tipo === "tarea") {
    const ya = resumenDia(data, await leerBandeja(sb, uid), dia).tareas.find(t => !t.hecha && mismaTarea(t.texto, texto));
    if (ya) return exito(`Ya la tenías en tus tareas de hoy: ${paraVoz(ya.texto)}.`, { tipo, fecha: dia, texto: ya.texto, ambito: ya.ambito, ya: true, id: ya.id });
  }
  const r = await aLaBandeja(sb, uid, tipo, tipo === "tarea" ? { texto, ambito, fecha: dia } : { texto, fecha: dia }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const eco = paraVoz(texto);
  return exito(tipo === "tarea" ? (eco && eco.length <= 80 ? `Anotado en tus tareas de hoy: ${eco}.` : "Anotado en tus tareas de hoy.") : "Guardé tu nota.",
    { tipo, fecha: dia, texto, ambito: tipo === "tarea" ? ambito : undefined });
}

async function abrirDia({ sb, uid, body, ahora }) {
  const bocado = textoLimpio(body.primer_bocado);
  if (bocado == null) return fallo(400, "dato-invalido", "Tu primer bocado es muy largo. Dímelo más corto.");
  const energia = entero(body.energia, 1, 5, 3);
  if (energia == null) return fallo(400, "dato-invalido", "Tu energía va de uno a cinco.");
  const ambito = body.ambito == null || body.ambito === "" ? "pro" : body.ambito;
  if (!["pro", "per"].includes(ambito)) return fallo(400, "dato-invalido", "¿Tu primer bocado es personal o profesional?");
  // El ritual completo (Norte-Desk): lo mismo que el ritual de apertura de la app (openRitualModal en js/modules2.js)
  const extra = {};
  if (body.completo === true) {
    const mision = textoLimpio(body.mision), servir = textoLimpio(body.servir);
    if (mision == null) return fallo(400, "dato-invalido", "Tu misión es muy larga. Dímela en una frase.");
    if (servir == null) return fallo(400, "dato-invalido", "Es muy largo. ¿A quién sirves hoy, en pocas palabras?");
    const pilar = body.pilar == null ? "" : body.pilar;
    if (pilar && !PILARES.includes(pilar)) return fallo(400, "dato-invalido", `Tu pilar es uno de estos: ${enLista(PILARES, "o")}.`);
    const proyectos = listaTextos(body.proyectos, 8, 60);
    if (proyectos == null) return fallo(400, "dato-invalido", "Son muchos proyectos, o alguno es muy largo.");
    const nuevas = body.tareas_nuevas == null ? [] : body.tareas_nuevas, quitar = body.tareas_quitar == null ? [] : body.tareas_quitar;
    if (!Array.isArray(nuevas) || nuevas.length > 15) return fallo(400, "dato-invalido", "Son muchas tareas de una vez.");
    const tareas = [];
    for (const t of nuevas) {
      const texto = textoLimpio(t && t.texto), amb = t && t.ambito;
      if (!texto || !["pro", "per"].includes(amb)) return fallo(400, "dato-invalido", "Una de tus tareas vino incompleta.");
      tareas.push({ texto, ambito: amb });
    }
    if (!Array.isArray(quitar) || quitar.length > 30 || !quitar.every(id => typeof id === "string" && ID_TAREA.test(id))) return fallo(400, "dato-invalido", "¿Qué tareas quito?");
    Object.assign(extra, { completo: true },
      mision ? { mision } : {}, servir ? { servir } : {}, pilar ? { pilar } : {}, proyectos.length ? { proyectos } : {},
      tareas.length ? { tareas_nuevas: tareas } : {}, quitar.length ? { tareas_quitar: [...new Set(quitar)] } : {});
  }
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  if (d.cerrado) return fallo(400, "dia-cerrado", "Tu día ya está cerrado. Mañana lo abrimos.");
  if (d.abierto && !bocado) return exito("Tu día ya estaba abierto.", { fecha: dia, ya: true });
  const datos = Object.assign({ primer_bocado: bocado, energia, ambito, fecha: dia }, extra);
  if (muyGrande(datos)) return fallo(400, "dato-invalido", MUY_LARGO);
  const r = await aLaBandeja(sb, uid, "abrir", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const eco = paraVoz(bocado), n = (extra.tareas_nuevas || []).length;
  const texto = d.abierto ? `Tu día ya estaba abierto. Anoté tu primer bocado: ${eco}.`
    : `Listo, abrí tu día.${eco ? ` Tu primer bocado: ${eco}. Empieza por ahí.` : ""}${n ? ` Anoté ${cuantos(n, "tarea", "tareas", "una")} más.` : ""}`;
  return exito(texto, Object.assign({ fecha: dia, primer_bocado: bocado || null, energia, ambito, ya: d.abierto }, extra));
}

/* «2 pasan a mañana, 1 a otro día, soltaste 1 y 1 ya la hiciste» */
function textoPendientes(c) {
  const p = [];
  if (c.manana) p.push(c.manana === 1 ? "una pasa a mañana" : `${c.manana} pasan a mañana`);
  if (c.otro) p.push(c.otro === 1 ? "una va a otro día" : `${c.otro} van a otro día`);
  if (c.delegar) p.push(c.delegar === 1 ? "delegaste una" : `delegaste ${c.delegar}`);
  if (c.soltar) p.push(c.soltar === 1 ? "soltaste una" : `soltaste ${c.soltar}`);
  if (c.hecha) p.push(c.hecha === 1 ? "una ya la hiciste" : `${c.hecha} ya las hiciste`);
  return p.length ? `De tus pendientes, ${enLista(p)}.` : "";
}

async function cerrarDia({ sb, uid, body, ahora }) {
  const animo = entero(body.animo, 1, 5, 3);
  if (animo == null) return fallo(400, "dato-invalido", "Tu ánimo va de uno a cinco.");
  const gratitud = textoLimpio(body.gratitud);
  if (gratitud == null) return fallo(400, "dato-invalido", "Es muy largo. Dime lo que agradeces en una frase.");
  // El ritual completo (Norte-Desk): lo mismo que el ritual de cierre de la app (openCierreModal en js/modules2.js)
  const extra = {};
  if (body.completo === true) {
    const mision = body.mision == null ? "" : body.mision;
    if (mision && !["si", "parcial", "no"].includes(mision)) return fallo(400, "dato-invalido", "¿Cumpliste tu misión? Sí, parcial o no.");
    if (body.bocado != null && typeof body.bocado !== "boolean") return fallo(400, "dato-invalido", "¿Diste tu primer bocado? Sí o no.");
    const energia = entero(body.energia, 1, 5, null);
    if (energia == null && body.energia != null && body.energia !== "") return fallo(400, "dato-invalido", "Tu energía va de uno a cinco.");
    const manana = textoLimpio(body.manana), nota = textoLimpio(body.nota, NOTA_MAX);
    if (manana == null) return fallo(400, "dato-invalido", "Lo de mañana es muy largo. Dímelo en una frase.");
    if (nota == null) return fallo(400, "dato-invalido", "Tu nota es muy larga.");
    const lista = body.pendientes == null ? [] : body.pendientes;
    if (!Array.isArray(lista) || lista.length > 40) return fallo(400, "dato-invalido", "¿Qué hago con tus pendientes?");
    const pendientes = [];
    for (const x of lista) {
      const id = x && x.id, v = x && x.v;
      if (typeof id !== "string" || !ID_TAREA.test(id) || !DECISIONES.includes(v)) return fallo(400, "dato-invalido", "¿Qué hago con tus pendientes?");
      const q = { id, v };
      if (v === "otro") {
        if (!FECHA.test(x.fecha || "")) return fallo(400, "dato-invalido", "¿Para qué día la dejo?");
        q.fecha = x.fecha;
      }
      if (v === "delegar") {
        const quien = textoLimpio(x.quien, 80);
        if (quien == null) return fallo(400, "dato-invalido", "¿A quién se la delegas, en pocas palabras?");
        if (quien) q.quien = quien;
      }
      if (x.bocado === true && (v === "manana" || v === "otro")) q.bocado = true;   // la crónica pasa como primer bocado
      if (!pendientes.some(y => y.id === id)) pendientes.push(q);
    }
    Object.assign(extra, { completo: true },
      mision ? { mision } : {}, typeof body.bocado === "boolean" ? { bocado: body.bocado } : {}, energia ? { energia } : {},
      manana ? { manana } : {}, nota ? { nota } : {}, pendientes.length ? { pendientes } : {});
  }
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  if (!d.abierto) return fallo(400, "dia-sin-abrir", "Primero hay que abrir tu día. Dime tu primer bocado y lo abrimos.");
  if (d.cerrado) return exito("Tu día ya estaba cerrado. Que descanses.", { fecha: dia, ya: true });
  const datos = Object.assign({ animo, gratitud, fecha: dia }, extra);
  if (muyGrande(datos)) return fallo(400, "dato-invalido", MUY_LARGO);
  const r = await aLaBandeja(sb, uid, "cerrar", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  // las pendientes que no se decidieron pasan a mañana (el cierre corto: js/ritual-express.js)
  const n = d.tareas_pendientes, abiertas = new Set(d.tareas.filter(x => !x.hecha).map(x => x.id));
  const cuenta = { manana: 0, otro: 0, delegar: 0, soltar: 0, hecha: 0 };
  (extra.pendientes || []).forEach(x => { if (abiertas.has(x.id) && x.v !== "manana") cuenta[x.v]++; });
  cuenta.manana = Math.max(0, n - cuenta.otro - cuenta.delegar - cuenta.soltar - cuenta.hecha);
  const pasan = extra.completo ? textoPendientes(cuenta)
    : n ? `${n === 1 ? "Tu tarea pendiente pasa" : `Tus ${n} tareas pendientes pasan`} a mañana.` : "";
  const texto = `Listo, cerré tu día.${pasan ? " " + pasan : ""}${gratitud ? " Gracias por lo que compartiste." : ""} Que descanses.`;
  return exito(texto, Object.assign({ fecha: dia, animo, gratitud, pasan_a_manana: cuenta.manana }, extra));
}

/* Completar una tarea de hoy (por su id, el que trae «hoy»): va a la bandeja como tarea_hecha */
async function completarTarea({ sb, uid, body, ahora }) {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return fallo(400, "dato-invalido", "¿Qué tarea completo?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  const t = d.tareas.find(x => x.id === id);
  if (!t) return fallo(404, "tarea-no-encontrada", "No encontré esa tarea en tu día de hoy.");
  const eco = paraVoz(t.texto).slice(0, 80) || "tu tarea";
  if (t.hecha) return exito(`${eco} ya estaba hecha.`, { id, ya: true });
  const r = await aLaBandeja(sb, uid, "tarea_hecha", { tid: id, fecha: dia, texto: t.texto }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const quedan = d.tareas.filter(x => !x.hecha && x.id !== id).length;
  return exito(`Listo, completé ${eco}.${quedan ? ` Te ${quedan === 1 ? "queda una tarea" : `quedan ${quedan} tareas`}.` : " Con eso terminas tus tareas de hoy."}`,
    { id, fecha: dia, quedan });
}

/* Una sesión de foco hecha en Norte-Desk: va a la bandeja como foco y la app la suma a tu historial de foco.
   Si es de un hábito con tiempo y completa sus minutos de hoy, la app lo marca (como al terminar un foco en Rumbo). */
async function foco({ sb, uid, body, ahora }) {
  const min = entero(body.minutos, 1, 600, null);
  if (min == null) return fallo(400, "dato-invalido", "¿Cuántos minutos de foco?");
  const completa = body.completa === true;
  let ini = Date.parse(body.inicio);
  if (!Number.isFinite(ini) || ini > ahora.getTime() || ini < ahora.getTime() - 12 * 3600e3) ini = ahora.getTime() - min * 60e3;
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), bandeja = await leerBandeja(sb, uid);
  const s = simular(data, bandeja, dia), d = resumenDia(data, bandeja, dia);
  const datos = { fecha: dia, min, completa, ini };
  let destino = "", completaHabito = false;
  if (body.habito) {
    const xs = buscarHabito(s.copia.habitos.defs, textoLimpio(body.habito, 80) || "");
    if (xs.length !== 1) return fallo(404, "habito-no-encontrado", "No encontré ese hábito en tu Rumbo.");
    const h = xs[0];
    datos.hid = h.id; datos.titulo = String(h.nombre).slice(0, 120); destino = paraVoz(h.nombre);
    completaHabito = +h.minutos > 0 && esHacer(h) && !s.motor.hecho(h, dia) && focoMin(s.copia, h.id, dia) + min >= +h.minutos;
  } else if (body.tarea) {
    const t = d.tareas.find(x => x.id === String(body.tarea));
    if (!t) return fallo(404, "tarea-no-encontrada", "No encontré esa tarea en tu día de hoy.");
    datos.tid = t.id; datos.titulo = t.texto.slice(0, 120); destino = paraVoz(t.texto).slice(0, 80);
  } else datos.titulo = "Tiempo de foco";
  const r = await aLaBandeja(sb, uid, "foco", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const texto = `Guardé ${min === 1 ? "un minuto" : min + " minutos"} de foco${destino ? " en " + destino : ""}.${completaHabito ? ` Con eso completas ${destino} hoy, bien hecho.` : ""}`;
  return exito(texto, { fecha: dia, minutos: min, completa, habito: datos.hid ? destino : undefined, completa_habito: completaHabito });
}

/* ---------- «Esto falló» (Norte-Desk): lo que salió mal, con su contexto, para revisarlo y arreglarlo ---------- */
/* Va a norte_fallas (supabase/norte-fallas.sql), no a tu documento: es para quien arregla a Norte, no para la app */
async function reportarFalla({ sb, uid, body, ahora }) {
  const texto = textoLimpio(body.texto, 500), pregunta = textoLimpio(body.pregunta, 1000), respuesta = textoLimpio(body.respuesta, 2000);
  const version = textoLimpio(body.version, 30), donde = DONDE_FALLA.includes(body.donde) ? body.donde : "otro";
  if (texto == null || pregunta == null || respuesta == null || version == null) return fallo(400, "dato-invalido", "Es muy largo. Cuéntamelo más corto.");
  if (!texto && !pregunta && !respuesta) return fallo(400, "dato-invalido", "¿Qué falló?");
  const lista = (v, n, max) => (Array.isArray(v) ? v : []).slice(-n).map(x => (typeof x === "string" ? textoLimpio(x, max) : null)).filter(Boolean);
  const contexto = (Array.isArray(body.contexto) ? body.contexto : []).slice(-10)
    .map(m => m && typeof m === "object" ? { rol: m.rol === "norte" ? "norte" : "yo", texto: textoLimpio(m.texto, 500) || "" } : null).filter(x => x && x.texto);
  const desde = new Date(ahora.getTime() - 3600e3).toISOString();
  const { count, error: ec } = await sb.from("norte_fallas").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("creado", desde);
  if (ec) throw new Error(ec.message);
  if ((count || 0) >= FALLAS_HORA) return falloDe(429, "demasiados-pedidos");
  const { error } = await sb.from("norte_fallas").insert({
    id: idNuevo("f", ahora), user_id: uid, texto, pregunta, respuesta, donde, version,
    contexto: { conversacion: contexto, errores: lista(body.errores, 10, 300) },
  });
  if (error) throw new Error(error.message);
  return exito("Gracias. Lo anoté para revisarlo y arreglarlo.", { donde });
}

/* ---------- Buenos días (Norte-Desk): el tiempo de tu ciudad y lo principal de tu día, en una frase ---------- */
const SANTIAGO = { ciudad: "Santiago", lat: -33.45, lon: -70.66 };
/* Los códigos del tiempo de Open-Meteo (WMO) en palabras */
export function cieloDe(codigo) {
  const c = +codigo;
  if (c === 0) return "despejado";
  if (c === 1 || c === 2) return "parcialmente nublado";
  if (c === 3) return "nublado";
  if (c === 45 || c === 48) return "con neblina";
  if (c >= 51 && c <= 57) return "con llovizna";
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "con lluvia";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "con nieve";
  if (c >= 95) return "con tormenta";
  return "";
}
/* El tiempo de hoy en tu ciudad (la del agua en Rumbo; si no hay, Santiago), con Open-Meteo: gratis y sin cuenta.
   Solo viajan las coordenadas de la ciudad. null si no se pudo (sin red o sin respuesta en 4 s) */
export async function tiempoDe(clima, red) {
  const c = clima && Number.isFinite(+clima.lat) && Number.isFinite(+clima.lon) ? clima : SANTIAGO;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${(+c.lat).toFixed(2)}&longitude=${(+c.lon).toFixed(2)}`
    + "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=1";
  try {
    const r = await red(url, { signal: AbortSignal.timeout(4000) });
    if (!r || !r.ok) return null;
    const j = await r.json(), d = j.daily || {}, ahora = j.current || {}, n = v => (Number.isFinite(+v) ? Math.round(+v) : null);
    const ciudad = String(c.ciudad || "").split(",")[0].trim() || "tu ciudad";
    return { ciudad, temp: n(ahora.temperature_2m), max: n((d.temperature_2m_max || [])[0]), min: n((d.temperature_2m_min || [])[0]),
      lluvia: n((d.precipitation_probability_max || [])[0]), cielo: cieloDe(ahora.weather_code != null ? ahora.weather_code : (d.weather_code || [])[0]) };
  } catch (e) { return null; }
}
export function textoBuenosDias(t, d) {
  const p = [];
  if (t) {
    const ahora = t.temp != null ? `hay ${t.temp}°` : "";
    const como = [ahora, t.cielo ? `está ${t.cielo}` : ""].filter(Boolean).join(" y ");
    p.push(`Buenos días. En ${t.ciudad}${como ? " " + como : ""}${t.max != null ? `, con máxima de ${t.max}°` : ""}.`);
    if (t.lluvia != null && t.lluvia >= 50) p.push(`Hay ${t.lluvia}% de probabilidad de lluvia: lleva paraguas.`);
  } else p.push("Buenos días.");
  if (d && !d.abierto) { if (d.mision_sugerida) p.push(`Anoche dejaste para hoy: ${paraVoz(d.mision_sugerida)}.`); }
  else if (d && d.mision) p.push(`Tu misión: ${paraVoz(d.mision)}.`);
  const faltan = d && d.semana ? d.semana.prioridades.filter(x => !x.hecha).length : 0, hab = d ? d.habitos_pendientes.length : 0;
  const cosas = [hab ? cuantos(hab, "hábito", "hábitos") : "", faltan ? `${cuantos(faltan, "prioridad", "prioridades", "una")} de la semana` : ""].filter(Boolean);
  if (cosas.length) p.push(`Hoy tienes ${enLista(cosas)}.`);
  // F22: los planes de hoy con tus amigos y sus cumpleaños
  const planes = (d && d.planes_hoy) || [], cumples = (d && d.cumples_hoy) || [];
  if (planes.length) p.push(`Hoy tienes ${enLista(planes.map(planTxt))}.`);
  if (cumples.length) p.push(`Y está de cumpleaños ${enLista(cumples)}: mándale un saludo.`);
  if (d && !d.abierto && !d.cerrado) p.push("¿Abrimos el día?");
  return p.join(" ");
}
async function buenosDias({ sb, uid, ahora, red = globalThis.fetch }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  const clima = data && data.agua && data.agua.clima ? data.agua.clima : null;
  // Los planes y cumpleaños de hoy (sin las tablas de amigos, o si fallan, el saludo sale igual)
  let soc = { planes_hoy: [], cumples_hoy: [] };
  const [tiempo] = await Promise.all([tiempoDe(clima, red), socialDe(sb, uid, data, dia, ahora.getTime(), true).then(x => { soc = x; }, () => {})]);
  d.planes_hoy = soc.planes_hoy; d.cumples_hoy = soc.cumples_hoy;
  return exito(textoBuenosDias(tiempo, d), { fecha: dia, tiempo, abierto: d.abierto, cerrado: d.cerrado, planes_hoy: soc.planes_hoy, cumples_hoy: soc.cumples_hoy });
}

/* ---------- Tu agenda (Norte-Desk): las próximas reuniones de tu Google Calendar ---------- */
/* Las lee la función «gcal» de Rumbo (supabase/functions/gcal, acción «proximos»), que guarda cifrado el permiso de
   Google: aquí no llega ni el permiso ni la clave. Solo si conectaste Google Calendar en Rumbo (settings.gcal). */
export const AGENDA_HORAS = 36;
async function agenda({ sb, uid }) {
  const data = await leerEstado(sb, uid), g = (data && data.settings && data.settings.gcal) || {};
  if (!g.conectado) return exito("No tengo tu calendario: conéctalo en Rumbo, en Calendario.", { conectado: false, eventos: [] });
  if (!sb.functions || typeof sb.functions.invoke !== "function") return exito("No pude leer tu calendario.", { conectado: true, eventos: [], error: "sin-funcion" });
  const calendarios = Array.isArray(g.calendarios) && g.calendarios.length ? g.calendarios.filter(x => typeof x === "string").slice(0, 10) : null;
  const { data: r, error } = await sb.functions.invoke("gcal", { body: { accion: "proximos", user_id: uid, calendarios, horas: AGENDA_HORAS } });
  if (error || !r || r.error || !Array.isArray(r.eventos)) {
    const reconectar = !!r && (r.error === "reconectar" || r.error === "sin-conectar");
    return exito(reconectar ? "Tu calendario se desconectó: vuelve a conectarlo en Rumbo, en Calendario." : "No pude leer tu calendario.", { conectado: !reconectar, eventos: [], error: reconectar ? "reconectar" : "gcal" });
  }
  const eventos = r.eventos.filter(e => e && e.inicio).slice(0, 15).map(e => ({
    titulo: visible(e.titulo) || "(sin título)", inicio: String(e.inicio), fin: e.fin ? String(e.fin) : null, todo_el_dia: !!e.todo_el_dia, lugar: e.lugar ? visible(e.lugar) : null,
  }));
  const prox = eventos.find(e => !e.todo_el_dia);
  return exito(prox ? `Tu próxima reunión: ${paraVoz(prox.titulo)}.` : "No tienes reuniones en las próximas horas.", { conectado: true, eventos });
}

/* ============================================================
   Fase 2 (2026-11-20): alarmas, recordatorios, mover tareas, alcancías, diario, lectura, amigos y tu año
   ============================================================ */
export const SONIDOS = ["campanas", "marimba", "pajaros", "brujula", "ola"];   // los tonos del robot (alarmas.cc)
export const ALARMAS_MAX = 10;          // como kMaxAlarmas en el robot
export const RECORDATORIOS_MAX = 50;    // recordatorios por avisar a la vez
export const MONTO_MAX = 100000000;     // un aporte a una alcancía, en pesos
export const DIARIO_MAX = 1000;         // lo que dictas al diario
export const ANIMOS_DIA = 3;            // ánimos de una persona a otra al día (como amigos_animo en amigos.sql)
export const ANIMOS_DIA_TOTAL = 30;     // y a todos sus amigos (un token filtrado no llena de ánimos a nadie)
export const ALARMAS_DEFECTO = Object.freeze({ ts: 0, lista: [], dormir: null, amanecer: 10, sonido: "campanas" });
const ID_CORTO = /^[A-Za-z0-9_-]{1,40}$/;
const MESES_TXT = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const tzDe = data => (data && data.settings && data.settings.notif && data.settings.notif.tz) || TZ_DEFECTO;
const pesosTxt = n => `${Math.round(+n || 0).toLocaleString("es-CL")} pesos`;
const inicialDe = s => (paraVoz(s).charAt(0) || "?").toUpperCase();

/* Busca por nombre, sin tildes ni mayúsculas: igual, por la primera palabra («Ana» encuentra «Ana Pérez»), por parte del
   nombre y por palabras («pagar luz» encuentra «Pagar la luz»). Devuelve los candidatos (0, 1 o varios). */
export function buscarPorNombre(xs, consulta, nombreDe = x => x.nombre) {
  const q = normalizar(consulta), lista = (Array.isArray(xs) ? xs : []).filter(x => x && normalizar(nombreDe(x)));
  if (!q) return [];
  const n = x => normalizar(nombreDe(x));
  const igual = lista.filter(x => n(x) === q);
  if (igual.length) return igual;
  const primera = lista.filter(x => n(x).split(" ")[0] === q);
  if (primera.length) return primera;
  const parte = lista.filter(x => n(x).includes(q) || (n(x).length >= 3 && q.includes(n(x))));
  if (parte.length) return parte;
  const palabras = q.split(" ").filter(w => w.length >= 3);
  if (!palabras.length) return [];
  return lista.filter(x => { const ws = n(x).split(" "); return palabras.every(p => ws.some(w => w.startsWith(p) || (w.length >= 3 && p.startsWith(w)))); });
}
/* "HH:MM" de un instante en la zona de la persona */
function horaEn(ms, tz) {
  const f = z => new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
  try { return f(tz); } catch { return f(TZ_DEFECTO); }
}
/* «a las 16:30», «mañana a las 8:00», «el 3 de diciembre a las 9:15» */
function cuandoTxt(ms, tz, hoy) {
  let dia; try { dia = localDate(tz, new Date(ms)); } catch { dia = localDate(TZ_DEFECTO, new Date(ms)); }
  const h = horaEn(ms, tz).replace(/^0(\d)/, "$1");
  if (dia === hoy) return `a las ${h}`;
  if (dia === diaMas(hoy, 1)) return `mañana a las ${h}`;
  return `el ${+dia.slice(8, 10)} de ${MESES_TXT[+dia.slice(5, 7) - 1]} a las ${h}`;
}

/* ---------- Alarmas (F07): viven en Rumbo (settings.norte.alarmas, con su ts) y el robot las sigue ---------- */
/* Una alarma como la entienden la app y el robot: { id, hora "HH:MM", dias [0..6] (0 = domingo; [] = una vez), fecha
   (solo las de una vez, o null), nombre, sonido (o null = el de siempre), activa }. null si viene mal. */
export function alarmaLimpia(a) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const id = typeof a.id === "string" && ID_CORTO.test(a.id) ? a.id : null, hora = typeof a.hora === "string" && HORA.test(a.hora) ? a.hora : null;
  if (!id || !hora || (a.dias != null && !Array.isArray(a.dias))) return null;
  const dias = [...new Set((a.dias || []).map(Number))];
  if (dias.length > 7 || !dias.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
  if (a.fecha != null && a.fecha !== "" && !FECHA.test(a.fecha)) return null;
  const nombre = textoLimpio(a.nombre, 40);
  if (nombre == null) return null;
  if (a.sonido != null && a.sonido !== "" && !SONIDOS.includes(a.sonido)) return null;
  if (a.activa != null && typeof a.activa !== "boolean") return null;
  return { id, hora, dias: dias.sort((x, y) => x - y), fecha: dias.length || !a.fecha ? null : a.fecha, nombre, sonido: a.sonido || null, activa: a.activa !== false };
}
/* Tus alarmas, con lo que falte puesto (las que vengan mal se dejan fuera) */
export function alarmasDe(x) {
  const a = x && typeof x === "object" ? x : {}, am = a.amanecer == null ? null : Number(a.amanecer);
  return {
    ts: Number.isFinite(+a.ts) && +a.ts > 0 ? Math.round(+a.ts) : 0,
    lista: (Array.isArray(a.lista) ? a.lista : []).map(alarmaLimpia).filter(Boolean).slice(0, ALARMAS_MAX),
    dormir: typeof a.dormir === "string" && HORA.test(a.dormir) ? a.dormir : null,
    amanecer: Number.isInteger(am) && am >= 0 && am <= 30 ? am : ALARMAS_DEFECTO.amanecer,
    sonido: SONIDOS.includes(a.sonido) ? a.sonido : ALARMAS_DEFECTO.sonido,
  };
}
/* Las de Rumbo, o las que el robot dejó en la bandeja si son más nuevas (la app todavía no las aplica) */
function alarmasActuales(data, s) {
  const enRumbo = alarmasDe(data && data.settings && data.settings.norte && data.settings.norte.alarmas);
  const delRobot = s.alarmas ? alarmasDe(s.alarmas) : null;
  return delRobot && delRobot.ts > enRumbo.ts ? delRobot : enRumbo;
}
const DIAS_TXT = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function textoAlarmas(A) {
  const act = A.lista.filter(a => a.activa);
  if (!act.length) return A.lista.length ? "Tus alarmas están apagadas." : "No tienes alarmas.";
  const una = act.length === 1 ? act[0] : null;
  if (una) {
    const d = una.dias, lista = d.map(x => DIAS_TXT[x]);
    const cuando = d.length === 7 ? "todos los días" : d.join() === "1,2,3,4,5" ? "de lunes a viernes" : d.join() === "0,6" ? "el fin de semana"
      : d.length ? `los ${lista.length > 1 ? lista.slice(0, -1).join(", ") + " y " + lista[lista.length - 1] : lista[0]}` : "una vez";
    return `Tienes una alarma a las ${una.hora.replace(/^0(\d)/, "$1")}, ${cuando}.`;
  }
  return `Tienes ${act.length} alarmas activas.`;
}
/* «alarmas» trae también tus ajustes de Norte (`ajustes`): así el robot los revisa en el mismo pedido de cada 15 minutos */
async function alarmas({ sb, uid, ahora }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
  const A = alarmasActuales(data, s);
  return exito(textoAlarmas(A), Object.assign({}, A, { ajustes: ajustesDe(data) }));
}

/* ---------- Tus ajustes de Norte (Rumbo › «Norte, tu brújula»): qué avisos da, el modo noche y si se aburre ----------
   settings.norte.ajustes = { ts, agua, agenda, habitos, amigos, planes, avisos_dia, noche: { auto, desde, hasta }, aburrido,
   pregunta_cierre }. Lo que nunca se tocó viene encendido, con la noche automática (según tu hora de dormir y tu primera
   alarma). pregunta_cierre es solo de la app («¿A qué hora te despierto?» al cerrar el día): al robot no le llega. */
export const AJUSTES_DEFECTO = Object.freeze({ ts: 0, agua: true, agenda: true, habitos: true, amigos: true, planes: true, avisos_dia: true,
  noche: Object.freeze({ auto: true, desde: "23:00", hasta: "07:00" }), aburrido: true });
export function ajustesDe(data) {
  const a = (data && data.settings && data.settings.norte && data.settings.norte.ajustes) || {}, n = a.noche && typeof a.noche === "object" ? a.noche : {};
  const si = k => a[k] !== false, D = AJUSTES_DEFECTO.noche;
  return {
    ts: Number.isFinite(+a.ts) && +a.ts > 0 ? Math.round(+a.ts) : 0,
    agua: si("agua"), agenda: si("agenda"), habitos: si("habitos"), amigos: si("amigos"), planes: si("planes"), avisos_dia: si("avisos_dia"),
    noche: { auto: n.auto !== false, desde: HORA.test(n.desde || "") ? n.desde : D.desde, hasta: HORA.test(n.hasta || "") ? n.hasta : D.hasta },
    aburrido: si("aburrido"),
  };
}
async function ajustes({ sb, uid }) {
  const A = ajustesDe(await leerEstado(sb, uid));
  const apagados = ["agua", "agenda", "habitos", "amigos", "planes", "avisos_dia"].filter(k => !A[k]).length;
  return exito(apagados ? `Tienes ${cuantos(apagados, "aviso apagado", "avisos apagados", "un")}.` : "Tienes todos mis avisos encendidos.", A);
}
/* El robot cambió sus alarmas (con su ts): van a la bandeja y la app las pone si son más nuevas que las de Rumbo */
async function guardarAlarmas({ sb, uid, body, ahora }) {
  let ts = Number(body.ts);
  if (!Number.isFinite(ts) || ts <= 0) return fallo(400, "dato-invalido", "Me faltó la hora del cambio de tus alarmas.");
  ts = Math.min(Math.round(ts), ahora.getTime());   // un reloj adelantado no deja las alarmas trabadas
  if (!Array.isArray(body.lista) || body.lista.length > ALARMAS_MAX) return fallo(400, "dato-invalido", `Puedo guardar hasta ${ALARMAS_MAX} alarmas.`);
  const lista = body.lista.map(alarmaLimpia);
  if (lista.some(a => !a) || new Set(lista.map(a => a.id)).size !== lista.length) return fallo(400, "dato-invalido", "Una de tus alarmas vino mal.");
  if (body.dormir != null && body.dormir !== "" && !(typeof body.dormir === "string" && HORA.test(body.dormir))) return fallo(400, "dato-invalido", "Tu hora de dormir vino mal.");
  const amanecer = entero(body.amanecer, 0, 30, ALARMAS_DEFECTO.amanecer);
  if (amanecer == null) return fallo(400, "dato-invalido", "El amanecer va de cero a treinta minutos.");
  const sonido = body.sonido == null || body.sonido === "" ? ALARMAS_DEFECTO.sonido : body.sonido;
  if (!SONIDOS.includes(sonido)) return fallo(400, "dato-invalido", `El sonido es uno de estos: ${enLista(SONIDOS, "o")}.`);
  const datos = { ts, lista, dormir: body.dormir || null, amanecer, sonido };
  if (muyGrande(datos)) return fallo(400, "dato-invalido", MUY_LARGO);
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), actual = alarmasActuales(data, simular(data, await leerBandeja(sb, uid), dia));
  // Las de Rumbo son más nuevas (las cambiaste en la app): se quedan, y el robot recibe esas
  if (actual.ts >= ts) return exito("Tus alarmas de Rumbo son más nuevas. Te las paso.", Object.assign({ ya: true }, actual));
  const r = await aLaBandeja(sb, uid, "alarmas", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  return exito("Guardé tus alarmas en Rumbo.", datos);
}

/* ---------- Recordatorios con hora (F08): iguales en Norte-Desk y el robot (settings.norte.recordatorios) ---------- */
/* Los de Rumbo con lo que espera en la bandeja (crear, avisado, borrar), sin los borrados */
function recordatoriosDe(data, s) {
  const m = new Map(), lista = data && data.settings && data.settings.norte && data.settings.norte.recordatorios;
  (Array.isArray(lista) ? lista : []).forEach(r => {
    if (!r || typeof r.id !== "string" || !ID_TAREA.test(r.id) || !Number.isFinite(+r.cuando)) return;
    m.set(r.id, { id: r.id, que: visible(r.que), cuando: Math.round(+r.cuando), avisado: !!r.avisado, borrado: !!r.borrado });
  });
  s.recOps.forEach(o => {
    const r = m.get(String(o.id));
    if (o.op === "crear" && !r && Number.isFinite(+o.cuando)) m.set(String(o.id), { id: String(o.id), que: visible(o.que), cuando: Math.round(+o.cuando), avisado: false, borrado: false });
    else if (o.op === "avisado" && r) r.avisado = true;
    else if (o.op === "borrar" && r) r.borrado = true;
  });
  return [...m.values()].filter(r => !r.borrado && r.que).map(({ borrado, ...r }) => r).sort((a, b) => a.cuando - b.cuando);
}
async function recordatorios({ sb, uid, ahora }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
  // Los que faltan por avisar y los avisados de las últimas 24 horas
  const lista = recordatoriosDe(data, s).filter(r => !r.avisado || r.cuando >= ahora.getTime() - 864e5);
  const faltan = lista.filter(r => !r.avisado), prox = faltan[0];
  const texto = !faltan.length ? "No tienes recordatorios pendientes."
    : `Tienes ${cuantos(faltan.length, "recordatorio", "recordatorios")}. El próximo: ${paraVoz(prox.que)}, ${cuandoTxt(prox.cuando, tzDe(data), dia)}.`;
  return exito(texto, { lista });
}
async function recordar({ sb, uid, body, ahora }) {
  const que = textoLimpio(body.que);
  if (que == null) return fallo(400, "dato-invalido", "Es muy largo. ¿Qué te recuerdo, en pocas palabras?");
  if (!que) return fallo(400, "dato-invalido", "¿Qué te recuerdo?");
  const cuando = Math.round(Number(body.cuando));
  if (!Number.isFinite(cuando) || cuando < ahora.getTime() - 5 * 60e3 || cuando > ahora.getTime() + 366 * 864e5) return fallo(400, "dato-invalido", "¿A qué hora te lo recuerdo?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
  if (recordatoriosDe(data, s).filter(r => !r.avisado).length >= RECORDATORIOS_MAX) return fallo(429, "demasiados-recordatorios", "Ya tienes muchos recordatorios pendientes. Borra alguno y seguimos.");
  const pid = idNuevo("n", ahora), id = "nr" + pid;
  const r = await aLaBandeja(sb, uid, "recordatorio", { op: "crear", id, que, cuando }, ahora, pid);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const eco = paraVoz(que);
  return exito(`Listo, te recuerdo ${cuandoTxt(cuando, tzDe(data), dia)}${eco && eco.length <= 80 ? `: ${eco}` : ""}.`, { id, que, cuando, avisado: false });
}
/* «Ya avisé» y «borrar»: por el id que trae «recordatorios» */
function recordatorioOp(op) {
  return async ({ sb, uid, body, ahora }) => {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!ID_TAREA.test(id)) return fallo(400, "dato-invalido", "¿Qué recordatorio?");
    const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
    const x = recordatoriosDe(data, s).find(r => r.id === id);
    if (!x) return op === "borrar" ? exito("Ese recordatorio ya no estaba.", { id, ya: true }) : fallo(404, "recordatorio-no-encontrado", "No encontré ese recordatorio.");
    if (op === "avisado" && x.avisado) return exito("Ya estaba avisado.", { id, ya: true });
    const r = await aLaBandeja(sb, uid, "recordatorio", { op, id }, ahora);
    if (r.limite) return falloDe(429, "demasiados-pedidos");
    return exito(op === "borrar" ? `Borré el recordatorio: ${paraVoz(x.que)}.` : "Listo.", { id });
  };
}

/* ---------- Posponer, delegar o soltar una tarea de hoy (F18), como en la app ---------- */
const DESTINOS = ["manana", "delegar", "soltar"];
async function moverTareaAccion({ sb, uid, body, ahora }) {
  const destino = body.destino;
  if (!DESTINOS.includes(destino)) return fallo(400, "dato-invalido", "¿La paso a mañana, la delegas o la sueltas?");
  const a = textoLimpio(body.a, 80);
  if (a == null) return fallo(400, "dato-invalido", "¿A quién se la delegas, en pocas palabras?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  const abiertas = d.tareas.filter(t => !t.hecha);
  let t = null;
  if (body.tid != null && body.tid !== "") {
    t = typeof body.tid === "string" ? abiertas.find(x => x.id === body.tid.trim()) : null;
  } else {
    const consulta = textoLimpio(body.tarea, 200);
    if (!consulta) return fallo(400, "dato-invalido", "¿Qué tarea?");
    const xs = buscarPorNombre(abiertas, consulta, x => x.texto);
    if (xs.length > 1) {
      const opciones = xs.slice(0, 5).map(x => paraVoz(x.texto).slice(0, 80));
      return fallo(400, "tarea-ambigua", `¿Cuál de estas? ${enLista(opciones, "o")}.`, { opciones: xs.slice(0, 5).map(x => ({ id: x.id, texto: x.texto })) });
    }
    t = xs[0] || null;
  }
  if (!t) return fallo(404, "tarea-no-encontrada", abiertas.length ? "No encontré esa tarea entre tus pendientes de hoy." : "No tienes tareas pendientes hoy.");
  const datos = { tid: t.id, fecha: dia, destino, texto: t.texto };
  if (destino === "delegar" && a) datos.a = a;
  const r = await aLaBandeja(sb, uid, "tarea_mover", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const eco = paraVoz(t.texto).slice(0, 80) || "tu tarea";
  const texto = destino === "manana" ? `Listo, ${eco} pasa a mañana.` : destino === "soltar" ? `Listo, soltaste ${eco}. Una cosa menos.`
    : a ? `Listo, le delegaste ${eco} a ${paraVoz(a)}.` : `Listo, delegaste ${eco}.`;
  return exito(texto, Object.assign({ id: t.id, destino, quedan: abiertas.length - 1 }, a && destino === "delegar" ? { a } : {}));
}

/* ---------- Aportar a una alcancía (F23) ---------- */
async function alcancia({ sb, uid, body, ahora }) {
  const monto = entero(typeof body.monto === "string" ? body.monto.replace(/[.$\s]/g, "") : body.monto, 1, MONTO_MAX, null);
  if (monto == null) return fallo(400, "dato-invalido", "¿Cuánto guardo?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
  const abiertas = alcanciasDe(s.copia, s);
  if (!abiertas.length) return fallo(404, "alcancia-no-encontrada", "No tienes alcancías abiertas. Crea una en Rumbo, en Finanzas.");
  let a = null;
  if (body.id != null && body.id !== "") a = abiertas.find(x => x.id === String(body.id)) || null;
  else if (body.alcancia != null && body.alcancia !== "") {
    const xs = buscarPorNombre(abiertas, textoLimpio(body.alcancia, 80) || "");
    if (xs.length > 1) { const opciones = xs.map(x => x.nombre); return fallo(400, "alcancia-ambigua", `¿En cuál? ${enLista(opciones, "o")}.`, { opciones }); }
    a = xs[0] || null;
  } else if (abiertas.length === 1) a = abiertas[0];   // si tienes una sola, es esa
  else return fallo(400, "alcancia-ambigua", `¿En cuál? ${enLista(abiertas.map(x => x.nombre), "o")}.`, { opciones: abiertas.map(x => x.nombre) });
  if (!a) return fallo(404, "alcancia-no-encontrada", `No encontré esa alcancía. Tienes ${enLista(abiertas.map(x => x.nombre))}.`, { alcancias: abiertas.map(x => x.nombre) });
  const r = await aLaBandeja(sb, uid, "alcancia", { aid: a.id, monto, fecha: dia, nombre: a.nombre.slice(0, 40) }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const total = a.total + monto, falta = Math.max(0, a.meta - total), llena = a.meta > 0 && total >= a.meta;
  const cola = llena ? (a.total < a.meta ? ` Llenaste ${a.nombre}, bien hecho.` : "") : a.meta > 0 ? ` Te faltan ${pesosTxt(falta)}.` : "";
  return exito(`Guardé ${pesosTxt(monto)} en ${a.nombre}.${cola}`, { id: a.id, nombre: a.nombre, monto, meta: a.meta, total, falta, llena });
}

/* ---------- Dictar al diario (F25): tal cual lo dices ---------- */
async function diario({ sb, uid, body, ahora }) {
  const texto = textoConLineas(body.texto, DIARIO_MAX);
  if (texto == null) return fallo(400, "dato-invalido", "Es muy largo para una entrada. Divídelo en dos.");
  if (!texto) return fallo(400, "dato-invalido", "¿Qué escribo en tu diario?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora);
  const r = await aLaBandeja(sb, uid, "diario", { texto, fecha: dia }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  return exito("Lo guardé en tu diario.", { fecha: dia, texto });
}

/* ---------- Sesión de lectura (F24): la página del libro y, con minutos, un foco de lectura ---------- */
async function lectura({ sb, uid, body, ahora }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), s = simular(data, await leerBandeja(sb, uid), dia);
  const libros = leyendoDe(s.copia, s);
  if (!libros.length) return fallo(404, "libro-no-encontrado", "No tienes libros en Leyendo ahora. Agrégalo en Rumbo, en Lecturas.");
  let l = null;
  if (body.id != null && body.id !== "") l = libros.find(x => x.id === String(body.id)) || null;
  else if (body.libro != null && body.libro !== "") {
    const xs = buscarPorNombre(libros, textoLimpio(body.libro, 120) || "", x => x.titulo);
    if (xs.length > 1) { const opciones = xs.map(x => x.titulo); return fallo(400, "libro-ambiguo", `¿Cuál? ${enLista(opciones, "o")}.`, { opciones }); }
    l = xs[0] || null;
  } else if (libros.length === 1) l = libros[0];
  else return fallo(400, "libro-ambiguo", `¿Cuál estás leyendo? ${enLista(libros.map(x => x.titulo), "o")}.`, { opciones: libros.map(x => x.titulo) });
  if (!l) return fallo(404, "libro-no-encontrado", `No encontré ese libro. Estás leyendo ${enLista(libros.map(x => x.titulo))}.`, { libros: libros.map(x => x.titulo) });
  const pagina = entero(body.pagina, 0, 3000, null), min = entero(body.minutos, 1, 600, null);
  if ((body.pagina != null && body.pagina !== "" && pagina == null) || (body.minutos != null && body.minutos !== "" && min == null)) return fallo(400, "dato-invalido", "La página o los minutos vinieron mal.");
  if (pagina == null && min == null) return fallo(400, "dato-invalido", "¿En qué página quedaste?");
  const datos = { lid: l.id, fecha: dia, titulo: l.titulo.slice(0, 120) };
  if (pagina != null) datos.pagina = l.paginas > 0 ? Math.min(pagina, l.paginas) : pagina;
  if (min != null) {
    let ini = Date.parse(body.inicio);
    if (!Number.isFinite(ini) || ini > ahora.getTime() || ini < ahora.getTime() - 12 * 3600e3) ini = ahora.getTime() - min * 60e3;
    Object.assign(datos, { min, completa: body.completa !== false, ini });
  }
  const r = await aLaBandeja(sb, uid, "lectura", datos, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const titulo = paraVoz(l.titulo), avance = datos.pagina != null ? datos.pagina - l.pagina : 0, termino = datos.pagina != null && l.paginas > 0 && datos.pagina >= l.paginas;
  const partes = [];
  if (min != null) partes.push(`Guardé ${min === 1 ? "un minuto" : min + " minutos"} de lectura`);
  if (datos.pagina != null) partes.push(`${partes.length ? "y anoté" : "Anoté"} la página ${datos.pagina} de ${titulo}${avance > 0 ? `: ${avance === 1 ? "una página" : avance + " páginas"} más` : ""}`);
  const texto = `${partes.join(" ")}.${termino ? " ¡Lo terminaste! Márcalo como terminado en Rumbo para ponerlo en tu biblioteca." : ""}`;
  return exito(texto, { id: l.id, titulo: l.titulo, pagina: datos.pagina != null ? datos.pagina : l.pagina, paginas: l.paginas, minutos: min, termino });
}

/* ---------- Amigos (F20, F21 y F22): lo que comparten contigo, en las tablas de amigos.sql, conjunto.sql y planes.sql ---------- */
/* Tus amigos (amistad aceptada) con su nombre y lo que muestran (perfiles.estado, con su cumpleaños si lo comparten) */
async function amigosDe(sb, uid) {
  const [x, y] = await Promise.all([
    sb.from("amistades").select("a, b").eq("a", uid).eq("estado", "aceptada"),
    sb.from("amistades").select("a, b").eq("b", uid).eq("estado", "aceptada"),
  ]);
  const e = x.error || y.error;
  if (e) throw new Error(e.message);
  const ids = [...new Set([...(x.data || []).map(r => r.b), ...(y.data || []).map(r => r.a)])].filter(id => id && id !== uid);
  if (!ids.length) return [];
  const { data, error } = await sb.from("perfiles").select("user_id, nombre, estado").in("user_id", ids);
  if (error) throw new Error(error.message);
  return ids.map(id => {
    const p = (data || []).find(r => r && r.user_id === id) || {};
    return { id, nombre: paraVoz(p.nombre).slice(0, 60), estado: p.estado && typeof p.estado === "object" ? p.estado : {} };
  });
}
/* Cada parte por separado: si falta una tabla (no se corrió su SQL), esa lista queda vacía */
async function oVacio(fn) {
  try { return await fn(); } catch (e) { if (sinTablas(e)) return []; throw e; }
}
async function animosDe(sb, uid, desde, amigos) {
  const { data, error } = await sb.from("animos").select("id, de, creado").eq("para", uid).gte("creado", new Date(desde).toISOString());
  if (error) throw new Error(error.message);
  return (data || []).map(a => ({ de: (amigos.find(f => f.id === a.de) || {}).nombre || "Un amigo", ts: Date.parse(a.creado) || 0 }))
    .sort((a, b) => a.ts - b.ts).slice(-20);
}
/* Las marcas de tus amigos en los hábitos en conjunto desde `desde` (de hoy o ayer), con la racha del grupo. Sin la columna
   «creado» de las marcas (supabase/norte-fase2.sql), van las de los días desde `desde`, con ts al comienzo de su día. */
async function conjuntoDe(sb, uid, desde, amigos, hoy, tz) {
  const { data: mios, error } = await sb.from("habitos_conjunto_miembros").select("habito, estado").eq("user_id", uid);
  if (error) throw new Error(error.message);
  const out = [], ayer = diaMas(hoy, -1);
  for (const habito of (mios || []).filter(m => m && m.estado === "activo").map(m => m.habito).slice(0, 10)) {
    const corte = diaMas(hoy, -400);
    let mq = await sb.from("habitos_conjunto_marcas").select("user_id, fecha, creado").eq("habito", habito).gte("fecha", corte);
    if (mq.error && /creado/.test(mq.error.message || "")) mq = await sb.from("habitos_conjunto_marcas").select("user_id, fecha").eq("habito", habito).gte("fecha", corte);
    if (mq.error) throw new Error(mq.error.message);
    const marcas = (mq.data || []).filter(m => m && FECHA.test(String(m.fecha || "").slice(0, 10))).map(m => Object.assign({}, m, { fecha: String(m.fecha).slice(0, 10) }));
    const tsDe = m => (m.creado ? Date.parse(m.creado) : instantePlan(m.fecha, "00:00", tz).getTime()) || 0;
    // sin «creado», no se sabe la hora: van las de los días desde «desde» (el robot las reconoce por hábito, quién y fecha)
    let diaDesde; try { diaDesde = localDate(tz, new Date(desde)); } catch { diaDesde = localDate(TZ_DEFECTO, new Date(desde)); }
    const nuevas = marcas.filter(m => m.user_id !== uid && m.fecha >= ayer && (m.creado ? tsDe(m) >= desde : m.fecha >= diaDesde));
    if (!nuevas.length) continue;
    const [{ data: h, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
      sb.from("habitos_conjunto").select("nombre, frecuencia, creado").eq("id", habito).maybeSingle(),
      sb.from("habitos_conjunto_miembros").select("user_id, estado, desde").eq("habito", habito),
    ]);
    if (e1 || e2) throw new Error((e1 || e2).message);
    if (!h) continue;
    let descansos = [];
    try {
      const dq = await sb.from("habitos_conjunto_descansos").select("user_id, fecha").eq("habito", habito).gte("fecha", corte);
      descansos = dq.error ? [] : dq.data || [];
    } catch (e) { descansos = []; }
    const activos = (ms || []).filter(m => m && m.estado === "activo").map(m => ({ desde: m.desde, marcas: marcas.filter(x => x.user_id === m.user_id).map(x => x.fecha),
      descansos: descansos.filter(x => x && x.user_id === m.user_id).map(x => String(x.fecha).slice(0, 10)) }));
    let racha = { n: 0, unidad: "días" };
    try { racha = rachaConjunto({ frecuencia: h.frecuencia, creado: h.creado }, activos, hoy); } catch (e) { /* sin racha */ }
    nuevas.forEach(m => {
      const quien = (amigos.find(f => f.id === m.user_id) || {}).nombre || "Un amigo";
      out.push({ habito: paraVoz(h.nombre), quien, inicial: inicialDe(quien), racha: racha.n, unidad: racha.unidad, fecha: m.fecha, ts: tsDe(m) });
    });
  }
  return out.sort((a, b) => a.ts - b.ts).slice(-20);
}
/* Los planes de hoy en los que participas (vas o tal vez vas), sin los cancelados */
async function planesHoyDe(sb, uid, hoy) {
  const { data: inv, error } = await sb.from("planes_invitados").select("plan, respuesta").eq("user_id", uid);
  if (error) throw new Error(error.message);
  const ids = [...new Set((inv || []).filter(i => i && (i.respuesta === "voy" || i.respuesta === "quizas")).map(i => i.plan))];
  if (!ids.length) return [];
  const { data: ps, error: e2 } = await sb.from("planes").select("id, titulo, fecha, hora, lugar, tz, cancelado").in("id", ids).eq("fecha", hoy);
  if (e2) throw new Error(e2.message);
  return (ps || []).filter(p => p && !p.cancelado && p.fecha === hoy).map(p => ({
    titulo: visible(p.titulo) || "Un plan", hora: HORA.test(p.hora || "") ? p.hora : null, lugar: p.lugar ? visible(p.lugar) : null,
    ts_inicio: instantePlan(p.fecha, HORA.test(p.hora || "") ? p.hora : "00:00", p.tz).getTime(),
  })).sort((a, b) => a.ts_inicio - b.ts_inicio);
}
/* Todo lo social de una vez: ánimos y marcas en conjunto desde `desde`, los planes de hoy y los cumpleaños de hoy */
/* `soloDia`: solo los planes y cumpleaños de hoy (para el buenos días) */
async function socialDe(sb, uid, data, hoy, desde, soloDia = false) {
  const amigos = await oVacio(() => amigosDe(sb, uid)), tz = tzDe(data);
  const [animos, conjunto, planes_hoy] = await Promise.all([
    soloDia ? [] : oVacio(() => animosDe(sb, uid, desde, amigos)),
    soloDia ? [] : oVacio(() => conjuntoDe(sb, uid, desde, amigos, hoy, tz)),
    oVacio(() => planesHoyDe(sb, uid, hoy)),
  ]);
  const cumples_hoy = amigos.filter(a => a.nombre && a.estado.cumple === hoy.slice(5)).map(a => a.nombre);
  return { animos, conjunto, planes_hoy, cumples_hoy };
}
const planTxt = p => `${paraVoz(p.titulo)}${p.hora ? ` a las ${p.hora.replace(/^0(\d)/, "$1")}` : ""}`;
export function textoSocial(x) {
  const p = [];
  const de = [...new Set(x.animos.map(a => a.de))];
  if (de.length) p.push(`${enLista(de)} te ${de.length === 1 ? "mandó" : "mandaron"} ánimo.`);
  x.conjunto.slice(-2).forEach(c => p.push(`${c.quien} cumplió ${c.habito}${c.racha > 1 ? `: llevan ${c.racha} ${c.unidad === "sem" ? "semanas" : c.unidad === "meses" ? "meses" : "días"} juntos` : ""}.`));
  if (x.cumples_hoy.length) p.push(`Hoy está de cumpleaños ${enLista(x.cumples_hoy)}.`);
  if (x.planes_hoy.length) p.push(`Hoy tienes ${enLista(x.planes_hoy.map(planTxt))}.`);
  return p.length ? p.join(" ") : "Nada nuevo de tus amigos.";
}
async function social({ sb, uid, body, ahora }) {
  let desde = Number(body.desde);
  if (!Number.isFinite(desde)) desde = ahora.getTime() - 864e5;
  desde = Math.max(ahora.getTime() - 7 * 864e5, Math.min(desde, ahora.getTime()));
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora);
  const x = await socialDe(sb, uid, data, dia, desde);
  return exito(textoSocial(x), x);
}
/* «Mándale ánimo a Ana» (F20): directo a la tabla animos, con las reglas de amigos_animo (amistad aceptada y hasta 3 al
   día a la misma persona). Esa función usa auth.uid(), que aquí no hay: el servidor revisa lo mismo con la clave de servicio. */
async function animo({ sb, uid, body, ahora }) {
  const consulta = textoLimpio(body.a, 60), mensaje = textoLimpio(body.mensaje, 120);
  if (!consulta) return fallo(400, "dato-invalido", "¿A quién le mando ánimo?");
  if (mensaje == null) return fallo(400, "dato-invalido", "El mensaje es muy largo.");
  const amigos = (await oVacio(() => amigosDe(sb, uid))).filter(a => a.nombre);
  if (!amigos.length) return fallo(404, "amigo-no-encontrado", "Todavía no tienes amigos en Rumbo. Invítalos desde Amigos.");
  const xs = buscarPorNombre(amigos, consulta);
  if (xs.length > 1) { const opciones = xs.slice(0, 5).map(a => a.nombre); return fallo(400, "amigo-ambiguo", `¿A quién? ${enLista(opciones, "o")}.`, { opciones }); }
  if (!xs.length) return fallo(404, "amigo-no-encontrado", "No encontré a ese amigo en Rumbo.");
  const f = xs[0], dia = new Date(ahora.getTime() - 864e5).toISOString();
  const [c1, c2] = await Promise.all([
    sb.from("animos").select("id", { count: "exact", head: true }).eq("de", uid).eq("para", f.id).gte("creado", dia),
    sb.from("animos").select("id", { count: "exact", head: true }).eq("de", uid).gte("creado", dia),
  ]);
  if (c1.error || c2.error) throw new Error((c1.error || c2.error).message);
  if ((c1.count || 0) >= ANIMOS_DIA) return fallo(429, "limite-animos", `Ya le mandaste ánimo tres veces hoy a ${f.nombre}. Mañana puedes mandarle más.`);
  if ((c2.count || 0) >= ANIMOS_DIA_TOTAL) return falloDe(429, "demasiados-pedidos");
  const { error } = await sb.from("animos").insert({ de: uid, para: f.id, mensaje: mensaje || "" });
  if (error) throw new Error(error.message);
  return exito(`Listo, le mandé ánimo a ${f.nombre}.`, { a: f.nombre });
}

/* ---------- Tu año en Rumbo (F28): las láminas, con los números del año ---------- */
/* Desde el 1 de diciembre, y en enero la del año que terminó (como tuAnioDisponible y tuAnioDeTemporada en js/tu-anio.js) */
export function tuAnioDisponible(anio, hoy) { const ya = +hoy.slice(0, 4), m = +hoy.slice(5, 7); return anio < ya || (anio === ya && m === 12); }
const tuAnioDeTemporada = hoy => { const ya = +hoy.slice(0, 4), m = +hoy.slice(5, 7); return m === 12 ? ya : m === 1 ? ya - 1 : null; };
/* Los números del año (lo que espera en la bandeja ya cuenta), solo las láminas con datos: { titulo, numero, unidad, texto } */
export function laminasAnio(copia, anio, hoy) {
  const pref = anio + "-", fin = hoy.startsWith(pref) ? hoy : `${anio}-12-31`, ini = `${anio}-01-01`;
  const dias = (copia.ritual && copia.ritual.dias) || {}, enAnio = d => d.startsWith(pref) && d <= fin;
  let abiertos = 0, cerrados = 0, racha = 0, mejor = 0;
  for (let d = ini; d <= fin; d = diaMas(d, 1)) {
    const r = dias[d] || {};
    if (r.hecho || r.cerrado) abiertos++;
    if (r.cerrado) { cerrados++; racha++; mejor = Math.max(mejor, racha); } else if (d !== hoy) racha = 0;
  }
  let marcas = 0;
  Object.entries((copia.habitos && copia.habitos.log) || {}).forEach(([k, hs]) => { if (k.startsWith(pref)) Object.values(hs || {}).forEach(ds => { marcas += Object.values(ds || {}).filter(Boolean).length; }); });
  const ml = Object.entries((copia.agua && copia.agua.dias) || {}).filter(([d]) => enAnio(d)).reduce((t, [, x]) => t + totalAgua(x), 0);
  const vasos = Math.round(ml / (vasoDe(copia) || 250));
  const libros = (Array.isArray(copia.lecturas) ? copia.lecturas : []).filter(l => l && l.estado === "terminado" && !l.antes && String(l.fin || "").startsWith(pref)).length;
  const foco = Math.round(((copia.enfoque && copia.enfoque.sesiones) || []).filter(x => x && !x.borrada && enAnio(String(x.fecha || ""))).reduce((t, x) => t + (+x.real || 0), 0));
  const estrellas = ((copia.gamif && copia.gamif.ledger) || []).filter(m => m && !m.anulado && (+m.delta || 0) > 0 && +m.ts > 0 && new Date(+m.ts).getUTCFullYear() === anio).reduce((t, m) => t + (+m.delta || 0), 0);
  const L = [
    [abiertos, "Días abiertos", "días", `Abriste tu día ${cuantos(abiertos, "vez", "veces", "una")}.`],
    [cerrados, "Días cerrados", "días", `Cerraste ${cuantos(cerrados, "día", "días")} con tu ritual.`],
    [mejor >= 2 ? mejor : 0, "Tu mejor racha", "días seguidos", `Tu mejor racha fue de ${mejor} días seguidos cerrando el día.`],
    [marcas, "Hábitos", "veces", `Marcaste tus hábitos ${cuantos(marcas, "vez", "veces", "una")}.`],
    [vasos, "Tu agua", "vasos", `Tomaste unos ${vasos} vasos de agua.`],
    [libros, "Tus libros", "libros", `Terminaste ${cuantos(libros, "libro", "libros")}.`],
    [foco, "Tu foco", "minutos", `Le diste ${foco} minutos de foco a lo tuyo.`],
    [estrellas, "Tus estrellas", "estrellas", `Ganaste ${estrellas} estrellas.`],
  ];
  return L.filter(x => x[0] > 0).map(([numero, titulo, unidad, texto]) => ({ titulo, numero, unidad, texto }));
}
async function tuAnio({ sb, uid, body, ahora }) {
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), ya = +dia.slice(0, 4);
  const anio = entero(body.anio, 2020, ya, tuAnioDeTemporada(dia) || ya);
  if (anio == null) return fallo(400, "dato-invalido", "¿De qué año?");
  const disponible = tuAnioDisponible(anio, dia);
  if (!disponible) return exito(`Tu ${anio} en Rumbo se abre el 1 de diciembre. Te aviso cuando esté.`, { anio, disponible, laminas: [] });
  const s = simular(data, await leerBandeja(sb, uid), dia), laminas = laminasAnio(s.copia, anio, dia);
  return exito(laminas.length ? `Tu ${anio} en Rumbo, en ${cuantos(laminas.length, "lámina", "láminas", "una")}. Empecemos.` : `Todavía no hay mucho de tu ${anio} en Rumbo.`,
    { anio, disponible, laminas });
}

const ACCIONES = { hoy, sumar_agua: sumarAgua, marcar_habito: marcarHabito, anotar, abrir_dia: abrirDia, cerrar_dia: cerrarDia, completar_tarea: completarTarea, foco,
  reportar_falla: reportarFalla, buenos_dias: buenosDias, agenda,
  // fase 2
  alarmas, guardar_alarmas: guardarAlarmas, ajustes, recordatorios, recordar, recordatorio_listo: recordatorioOp("avisado"), borrar_recordatorio: recordatorioOp("borrar"),
  mover_tarea: moverTareaAccion, alcancia, diario, lectura, social, animo, tu_anio: tuAnio };

/* Para la charla (notifier/norte-chat.mjs): quién habla y las mismas acciones, con la persona ya identificada.
   Así lo que Norte hace conversando pasa por la misma bandeja, con los mismos límites y los mismos textos. */
export { aparatoDe };
export async function accionNorte({ sb, uid, accion, body = {}, ahora = new Date(), red }) {
  if (!Object.prototype.hasOwnProperty.call(ACCIONES, accion)) return falloDe(400, "accion-invalida");
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  try {
    return await ACCIONES[accion]({ sb, uid, body: b, ahora, red: red || globalThis.fetch });
  } catch (e) {
    if (sinTablas(e)) return falloDe(500, "sin-servidor");
    throw e;
  }
}

/**
 * Atiende un pedido de Norte. Devuelve { status, cuerpo } (api/norte.js lo responde tal cual).
 * `autorizacion`: el encabezado Authorization; `ip`: la de quien llama (solo para el límite al conectarse).
 */
export async function atenderNorte({ sb, body, autorizacion, ip = "", ahora = new Date(), red }) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const accion = typeof b.accion === "string" ? b.accion : "";
  try {
    if (accion === "conectar") return await conectar({ sb, body: b, ip });
    if (!Object.prototype.hasOwnProperty.call(ACCIONES, accion)) {
      // sin token no se dice nada más (ni siquiera qué acciones hay)
      const quien = await aparatoDe(sb, autorizacion, ahora);
      if (quien.error) return falloDe(401, quien.error);
      return falloDe(400, "accion-invalida");
    }
    const quien = await aparatoDe(sb, autorizacion, ahora);
    if (quien.error) return falloDe(401, quien.error);
    return await ACCIONES[accion]({ sb, uid: quien.uid, body: b, ahora, red: red || globalThis.fetch });
  } catch (e) {
    if (sinTablas(e)) return falloDe(500, "sin-servidor");
    throw e;
  }
}
