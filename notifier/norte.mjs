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
   «Hoy» es el día de la persona (settings.notif.tz, America/Santiago si no hay). Qué hábitos tocan
   hoy lo dice el mismo motor de la app (js/habitos-motor.js, vía notifier/habitos.mjs).
   Recibe el cliente de Supabase (`sb`), así se prueba sin red (tests/norte.test.mjs).
   ============================================================ */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { localDate } from "./recordatorios.mjs";
import { motorHabitos } from "./habitos.mjs";
import { vasoDe } from "./elefante.mjs";
import { VASOS_AL_DIA } from "./vaso.mjs";

export const TEXTO_MAX = 200;          // tareas, notas, primer bocado y gratitud
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
/* Lo que se va a guardar: sin caracteres de control. null si es demasiado largo */
function textoLimpio(v, max = TEXTO_MAX) {
  if (v == null) return "";
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
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
  let bocado = null, tareas = 0;
  const nuevasTareas = [], tareasHechas = new Set();
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
    else if (p.tipo === "abrir" && d.fecha === hoy) { dia.hecho = true; if (d.primer_bocado) bocado = d.primer_bocado; if (d.energia) dia.energia = d.energia; }
    else if (p.tipo === "cerrar" && d.fecha === hoy) dia.cerrado = true;
  }
  return { copia, pend, agua, dia, bocado, tareas, nuevasTareas, tareasHechas, motor: motorHabitos(copia, hoy) };
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

/* Tus tareas de hoy para mostrar (Norte-Desk): primero el bocado y las prioridades, las hechas al final */
function listaTareas(tareasDia, s) {
  const xs = tareasDia.filter(t => ["pendiente", "hecha"].includes(estadoTarea(t))).map(t => ({
    id: String(t.id), texto: visible(t.txt), ambito: t.ambito === "pro" ? "pro" : "per",
    hecha: estadoTarea(t) === "hecha" || s.tareasHechas.has(String(t.id)), bocado: !!t.esSapo, prioridad: !!t.prioridad,
  }));
  s.nuevasTareas.forEach(t => { if (!xs.some(x => x.id === t.id)) xs.push(Object.assign({}, t, { hecha: s.tareasHechas.has(t.id), bocado: false, prioridad: false })); });
  const peso = x => (x.hecha ? 10 : 0) + (x.bocado ? 0 : x.prioridad ? 1 : 2);
  return xs.filter(x => x.texto).sort((a, b) => peso(a) - peso(b)).slice(0, 30);
}

/* Lo que Norte cuenta de tu día (la acción «hoy») */
export function resumenDia(data, bandeja, hoy) {
  const s = simular(data, bandeja, hoy), { copia, dia, motor } = s;
  const defs = copia.habitos.defs.filter(h => h && h.id && !h.pausado);
  const pendientes = motor.pendientesHoy().map(h => paraVoz(h.nombre)).filter(Boolean);
  const hechos = defs.filter(h => esHacer(h) && motor.hecho(h, hoy)).map(h => paraVoz(h.nombre)).filter(Boolean);
  const tareasDia = (((copia.agenda && copia.agenda.dias) || {})[hoy] || []).filter(t => t && !t.borrada);
  const sapo = tareasDia.find(t => t.esSapo);
  let primer = null;
  if (s.bocado) primer = { texto: paraVoz(s.bocado), hecho: !!(sapo && sapo.txt === s.bocado && estadoTarea(sapo) === "hecha") };
  else if (sapo) primer = { texto: paraVoz(sapo.txt), hecho: estadoTarea(sapo) === "hecha" };
  else if (dia.sapo) primer = { texto: paraVoz(dia.sapo), hecho: !!(dia.cierre && dia.cierre.sapo) };
  const nuevoBocado = s.bocado && !tareasDia.some(t => t.txt === s.bocado) ? 1 : 0;   // abrir el día crea la tarea del bocado
  // Las rachas de tus hábitos de hoy (los que faltan y los hechos), como en la app: { nombre, n, unidad }, de 1 o más
  const deHoy = new Set([...motor.pendientesHoy().map(h => h.id), ...defs.filter(h => esHacer(h) && motor.hecho(h, hoy)).map(h => h.id)]);
  const rachas = defs.filter(h => deHoy.has(h.id)).map(h => Object.assign({ nombre: paraVoz(h.nombre) }, motor.racha(h)))
    .filter(r => r.nombre && r.n >= 1).map(r => ({ nombre: r.nombre, n: r.n, unidad: r.unidad }));
  const riesgo = motor.enRiesgo();
  const ml = totalAgua(copia.agua && copia.agua.dias && copia.agua.dias[hoy]) + s.agua.filter(v => v.fecha === hoy).reduce((t, v) => t + (+v.ml || 0), 0);
  return {
    fecha: hoy,
    abierto: !!dia.hecho,
    mision: dia.mision ? paraVoz(dia.mision) : null,
    primer_bocado: primer,
    energia: dia.energia ? +dia.energia : null,
    cerrado: !!dia.cerrado,
    habitos_pendientes: pendientes,
    habitos_hechos: hechos,
    agua: { ml, meta_ml: metaAgua(copia, hoy) },
    tareas_pendientes: tareasDia.filter(t => estadoTarea(t) === "pendiente" && !s.tareasHechas.has(String(t.id))).length
      + s.nuevasTareas.filter(t => !s.tareasHechas.has(t.id)).length + nuevoBocado,
    en_bandeja: s.pend.length + s.agua.length,
    tareas: listaTareas(tareasDia, s),
    habitos_tiempo: defs.filter(h => esHacer(h) && +h.minutos > 0)
      .map(h => ({ nombre: paraVoz(h.nombre), minutos: +h.minutos, hoy: focoMin(copia, h.id, hoy), hecho: motor.hecho(h, hoy) })),
    habitos_racha: rachas,
    racha_en_riesgo: riesgo ? { nombre: paraVoz(riesgo.nombre), n: riesgo.n, unidad: riesgo.unidad } : null,
  };
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
    sb.from("agua_pendientes").select("id, fecha, ml").eq("user_id", uid),
  ]);
  if (n.error) throw new Error(n.error.message);
  if (a.error && !sinTablas(a.error)) throw new Error(a.error.message);   // sin supabase/agua.sql: sin agua pendiente
  return { norte: n.data || [], agua: (a.error ? [] : a.data) || [] };
}
const hoyDe = (data, ahora) => localDate((data && data.settings && data.settings.notif && data.settings.notif.tz) || TZ_DEFECTO, ahora);
/* Un pedido más a la bandeja, si no van demasiados en la última hora */
async function aLaBandeja(sb, uid, tipo, datos, ahora) {
  const desde = new Date(ahora.getTime() - 3600e3).toISOString();
  const { count, error: e1 } = await sb.from("norte_pendientes").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("creado", desde);
  if (e1) throw new Error(e1.message);
  if ((count || 0) >= PEDIDOS_HORA) return { limite: true };
  const id = idNuevo("n", ahora);
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
  return exito(textoHoy(d), d);
}

async function sumarAgua({ sb, uid, body, ahora }) {
  const vasos = entero(body.vasos, 1, VASOS_MAX, 1);
  if (vasos == null) return fallo(400, "dato-invalido", "Puedo anotar de uno a seis vasos a la vez.");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), ml = vasoDe(data);
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
  const texto = `${vasos === 1 ? "Anotado, un vaso." : `Anotados ${NUMEROS[vasos]} vasos.`} ${llegaste
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
  const texto = textoLimpio(body.texto);
  if (texto == null) return fallo(400, "dato-invalido", "Es muy largo para anotarlo. Dímelo más corto.");
  if (!texto) return fallo(400, "dato-invalido", "¿Qué anoto?");
  const tipo = body.tipo == null || body.tipo === "" ? "tarea" : body.tipo;
  const ambito = body.ambito == null || body.ambito === "" ? "per" : body.ambito;
  if (!["tarea", "nota"].includes(tipo)) return fallo(400, "dato-invalido", "Puedo anotar una tarea o una nota.");
  if (!["pro", "per"].includes(ambito)) return fallo(400, "dato-invalido", "¿Es algo personal o profesional?");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora);
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
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  if (d.cerrado) return fallo(400, "dia-cerrado", "Tu día ya está cerrado. Mañana lo abrimos.");
  if (d.abierto && !bocado) return exito("Tu día ya estaba abierto.", { fecha: dia, ya: true });
  const r = await aLaBandeja(sb, uid, "abrir", { primer_bocado: bocado, energia, ambito, fecha: dia }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  const eco = paraVoz(bocado);
  const texto = d.abierto ? `Tu día ya estaba abierto. Anoté tu primer bocado: ${eco}.`
    : `Listo, abrí tu día.${eco ? ` Tu primer bocado: ${eco}. Empieza por ahí.` : ""}`;
  return exito(texto, { fecha: dia, primer_bocado: bocado || null, energia, ambito, ya: d.abierto });
}

async function cerrarDia({ sb, uid, body, ahora }) {
  const animo = entero(body.animo, 1, 5, 3);
  if (animo == null) return fallo(400, "dato-invalido", "Tu ánimo va de uno a cinco.");
  const gratitud = textoLimpio(body.gratitud);
  if (gratitud == null) return fallo(400, "dato-invalido", "Es muy largo. Dime lo que agradeces en una frase.");
  const data = await leerEstado(sb, uid), dia = hoyDe(data, ahora), d = resumenDia(data, await leerBandeja(sb, uid), dia);
  if (!d.abierto) return fallo(400, "dia-sin-abrir", "Primero hay que abrir tu día. Dime tu primer bocado y lo abrimos.");
  if (d.cerrado) return exito("Tu día ya estaba cerrado. Que descanses.", { fecha: dia, ya: true });
  const r = await aLaBandeja(sb, uid, "cerrar", { animo, gratitud, fecha: dia }, ahora);
  if (r.limite) return falloDe(429, "demasiados-pedidos");
  // el cierre corto, sin elegir nada: las pendientes pasan a mañana (js/ritual-express.js)
  const n = d.tareas_pendientes;
  const texto = `Listo, cerré tu día.${n ? ` ${n === 1 ? "Tu tarea pendiente pasa" : `Tus ${n} tareas pendientes pasan`} a mañana.` : ""}${gratitud ? " Gracias por lo que compartiste." : ""} Que descanses.`;
  return exito(texto, { fecha: dia, animo, gratitud, pasan_a_manana: n });
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

const ACCIONES = { hoy, sumar_agua: sumarAgua, marcar_habito: marcarHabito, anotar, abrir_dia: abrirDia, cerrar_dia: cerrarDia, completar_tarea: completarTarea, foco };

/* Para la charla (notifier/norte-chat.mjs): quién habla y las mismas acciones, con la persona ya identificada.
   Así lo que Norte hace conversando pasa por la misma bandeja, con los mismos límites y los mismos textos. */
export { aparatoDe };
export async function accionNorte({ sb, uid, accion, body = {}, ahora = new Date() }) {
  if (!Object.prototype.hasOwnProperty.call(ACCIONES, accion)) return falloDe(400, "accion-invalida");
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  try {
    return await ACCIONES[accion]({ sb, uid, body: b, ahora });
  } catch (e) {
    if (sinTablas(e)) return falloDe(500, "sin-servidor");
    throw e;
  }
}

/**
 * Atiende un pedido de Norte. Devuelve { status, cuerpo } (api/norte.js lo responde tal cual).
 * `autorizacion`: el encabezado Authorization; `ip`: la de quien llama (solo para el límite al conectarse).
 */
export async function atenderNorte({ sb, body, autorizacion, ip = "", ahora = new Date() }) {
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
    return await ACCIONES[accion]({ sb, uid: quien.uid, body: b, ahora });
  } catch (e) {
    if (sinTablas(e)) return falloDe(500, "sin-servidor");
    throw e;
  }
}
