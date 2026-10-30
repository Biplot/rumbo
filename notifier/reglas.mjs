/* ============================================================
   Rumbo · Reglas de los avisos (sin dependencias, se prueban en tests/notifier.test.mjs)
   Todas reciben la fecha local "YYYY-MM-DD" de la persona y lo que ya hizo.
   ============================================================ */

/* ¿La hora "HH:MM" cae en la ventana de envío? (de la hora en punto hasta `ventana` minutos después) */
export function toMin(hhmm) { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); }
export function enVentana(nowMin, hhmm, ventana) { const diff = nowMin - toMin(hhmm); return diff >= 0 && diff < ventana; }
function aHora(min) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }

/* ---------- Qué avisos recibe cada persona: la misma regla que la app (avisosActivos en js/state.js) ----------
   settings.notif.avisos guarda solo lo que la persona eligió; lo demás vale como en "Recomendado".
   El de mediodía (antes se compraba en la Tienda) sigue encendido para quien ya tenía su hora. */
export const AVISOS_TIPOS = ["manana", "noche", "insistencia", "pendientes", "mediodia", "semana", "mes", "trimestre", "habitos", "cumpleanos", "contactos", "amigos"];
export const AVISOS_NIVELES = {
  esencial: ["manana", "noche"],
  recomendado: ["manana", "noche", "semana", "mes", "trimestre", "amigos"],
  todo: AVISOS_TIPOS,
};
export const AVISOS_HORAS = { manana: "08:00", noche: "21:00", mediodia: "13:00", habitos: "20:00" };
export function avisosActivos(n) {
  n = n || {};
  const elegidos = n.avisos && typeof n.avisos === "object" ? n.avisos : {};
  const base = new Set(AVISOS_NIVELES.recomendado);
  if (n.mediodia) base.add("mediodia");
  const out = {};
  AVISOS_TIPOS.forEach(k => { out[k] = typeof elegidos[k] === "boolean" ? elegidos[k] : base.has(k); });
  return out;
}
/* La hora de cada momento del día: mañana, noche, mediodía, hábitos y el segundo aviso de cierre
   (una hora después del de noche; null si eso pasa de la medianoche) */
export function horaAviso(n, momento) {
  n = n || {};
  if (momento === "insistencia") { const m = toMin(n.noche || AVISOS_HORAS.noche) + 60; return m < 24 * 60 ? aHora(m) : null; }
  if (momento === "habitos") return n.habitosHora || AVISOS_HORAS.habitos;
  return n[momento] || AVISOS_HORAS[momento];
}
/* Los momentos de la persona que caen en la ventana ahora. Mañana y noche siempre se miran (de ellos
   cuelgan semana, mes, trimestre, cumpleaños…); mediodía, hábitos y el segundo de cierre, solo si están
   encendidos. Si no hay ninguno, en esta pasada no hay nada que mandarle y no se lee su estado completo. */
export function horasEnVentana(n, nowMin, ventana) {
  const a = avisosActivos(n);
  return ["manana", "mediodia", "habitos", "noche", "insistencia"]
    .filter(k => k === "manana" || k === "noche" || a[k])
    .filter(k => { const h = horaAviso(n, k); return h != null && enVentana(nowMin, h, ventana); });
}

export function ultimoDiaMes(iso) { const [y, m] = iso.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
export function sumarDias(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function lunesDe(iso) { const dow = new Date(iso + "T12:00:00Z").getUTCDay(); return sumarDias(iso, -((dow + 6) % 7)); }

/* Ritual de semana (clave = lunes "YYYY-MM-DD", igual que STATE.ritual.semanas).
   Día del ritual: settings.ritualSemanal.dia (0 = domingo, 1 = lunes).
   · semana-cierre: el día del ritual (domingo en la noche / lunes en la mañana), si falta cerrar o planificar
   · semana-apertura: el día siguiente en la mañana, si la semana aún no se planifica
   Devuelve la hora a usar ("manana" | "noche") o null si hoy no toca. */
export function avisoSemana(tipo, hoy, diaSem, semanas) {
  const dow = new Date(hoy + "T12:00:00Z").getUTCDay(), L = lunesDe(hoy), w = k => semanas[k] || {};
  if (tipo === "semana-cierre") {
    if (diaSem === 0 && dow === 0) return w(L).cierre && w(sumarDias(L, 7)).apertura ? null : "noche";
    if (diaSem === 1 && dow === 1) return w(sumarDias(L, -7)).cierre && w(L).apertura ? null : "manana";
    return null;
  }
  if ((diaSem === 0 && dow === 1) || (diaSem === 1 && dow === 2)) return w(L).apertura ? null : "manana";
  return null;
}

/* Revisión trimestral (clave "YYYY-Qn", igual que STATE.ritual.trimestres).
   · tri-cierre: el penúltimo día del trimestre en la noche (el último ya lleva el aviso de cierre de mes),
     si el trimestre aún no se cierra
   · tri-apertura: el día 2 del trimestre en la mañana (el 1 ya lleva el de apertura de mes),
     si aún no se abre; si el anterior tampoco se cerró, el aviso invita a hacer las dos cosas
   Devuelve { hora, clave, pendienteAnterior } o null si hoy no toca. */
/* Aviso de mediodía (gratis desde la v73; antes era una función de la Tienda): solo si está encendido
   y el día no está cerrado */
export function avisoMediodia(data, hoy) {
  const notif = data && data.settings && data.settings.notif;
  if (!notif || !avisosActivos(notif).mediodia) return null;
  const r = ((data.ritual || {}).dias || {})[hoy];
  if (r && r.cerrado) return null;
  const sapo = r && r.hecho && r.sapo ? String(r.sapo).slice(0, 80) : "";
  return { body: sapo ? `¿Cómo va tu primer bocado? “${sapo}”` : "¿Cómo va tu primer bocado? Un paso chico ya cuenta." };
}
export function triClave(y, q) { return `${y}-Q${q}`; }
export function avisoTrimestre(tipo, hoy, trimestres) {
  const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7), d = +hoy.slice(8, 10), q = Math.ceil(m / 3);
  const t = k => (trimestres || {})[k] || {};
  if (tipo === "tri-cierre") {
    if (m % 3 !== 0 || d !== ultimoDiaMes(hoy) - 1) return null;
    const clave = triClave(y, q);
    return t(clave).cierre ? null : { hora: "noche", clave, pendienteAnterior: false };
  }
  if (tipo === "tri-apertura") {
    if (m % 3 !== 1 || d !== 2) return null;
    const clave = triClave(y, q), prev = q === 1 ? triClave(y - 1, 4) : triClave(y, q - 1);
    return t(clave).apertura ? null : { hora: "manana", clave, pendienteAnterior: !t(prev).cierre };
  }
  return null;
}

/* ---------- Avisos nuevos (v73) ---------- */
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function diaSemana(iso) { return DIAS_SEMANA[new Date(iso + "T12:00:00Z").getUTCDay()]; }
function enumerar(xs) { return xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]; }
/* "Ana, Pedro y 2 más" */
function enumerarCorto(xs, max = 3) { return xs.length > max ? xs.slice(0, max).join(", ") + " y " + (xs.length - max) + " más" : enumerar(xs); }

/* Días sin cerrar: igual que la app (pendingCierreDates en js/app.js). Un día de los 3 anteriores
   (DIAS_HOLGURA) que no se cerró y que se abrió o se usó (tareas o hábitos marcados).
   `hecho(h, iso)` es hmDone del motor de hábitos de la app. Del más antiguo al más reciente. */
export const DIAS_HOLGURA = 3;
export function diasSinCerrar(data, hoy, hecho) {
  const dias = ((data && data.ritual) || {}).dias || {};
  const agenda = (((data && data.agenda) || {}).dias) || {};
  const habitos = (((data && data.habitos) || {}).defs) || [];
  const out = [];
  for (let b = DIAS_HOLGURA; b >= 1; b--) {
    const iso = sumarDias(hoy, -b), r = dias[iso];
    if (r && r.cerrado) continue;
    const uso = (agenda[iso] || []).some(t => t && !t.borrada) || habitos.some(h => { try { return hecho(h, iso); } catch (e) { return false; } });
    if ((r && r.hecho) || uso) out.push(iso);
  }
  return out;
}
/* "Te quedó el martes sin cerrar: puedes cerrarlo hasta el viernes." */
export function textoDiasSinCerrar(pend, hoy) {
  if (!pend.length) return "";
  const limite = sumarDias(pend[0], DIAS_HOLGURA);
  const hasta = limite <= hoy ? "hasta hoy" : limite === sumarDias(hoy, 1) ? "hasta mañana" : "hasta el " + diaSemana(limite);
  const nombres = pend.map(iso => (iso === sumarDias(hoy, -1) ? "ayer" : "el " + diaSemana(iso)));
  return pend.length === 1
    ? `Te quedó ${nombres[0]} sin cerrar: puedes cerrarlo ${hasta}.`
    : `Te quedaron ${pend.length} días sin cerrar (${enumerar(nombres)}). El primero se puede cerrar ${hasta}.`;
}

/* Hábitos que tocan hoy y aún faltan: { nombres } con la regla de la app (tocaHoy y hmDone) */
export function textoHabitos(nombres) {
  if (!nombres.length) return "";
  return `Te ${nombres.length === 1 ? "falta 1" : "faltan " + nombres.length}: ${enumerarCorto(nombres)}.`;
}

/* Cumpleaños de hoy (Relaciones). Como la app (new Date(año, mes, día)): un 29 de febrero
   se celebra el 1 de marzo en los años que no son bisiestos. */
export function cumpleanosHoy(data, hoy) {
  const gente = ((((data && data.vida) || {}).relaciones) || []).filter(p => p && p.cumple && p.nombre);
  const y = +hoy.slice(0, 4), bisiesto = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return gente.filter(p => {
    const md = String(p.cumple).slice(5, 10);
    return md === hoy.slice(5) || (md === "02-29" && !bisiesto && hoy.slice(5) === "03-01");
  }).map(p => p.nombre);
}
export function textoCumpleanos(nombres) {
  if (!nombres.length) return "";
  return nombres.length === 1 ? `Hoy cumple ${nombres[0]}. ¡Escríbele!` : `Hoy cumplen ${enumerarCorto(nombres)}.`;
}

/* Contactos pendientes (Relaciones): como relDeuda en js/vida.js. Toca escribir cuando pasaron
   tantos días como la frecuencia elegida (30 por defecto; 0 = sin recordatorio). Más atrasado primero. */
function diasEntre(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000); }
export function contactosPendientes(data, hoy) {
  const gente = ((((data && data.vida) || {}).relaciones) || []).filter(p => p && p.nombre);
  return gente.map(p => {
    const f = p.frecuencia ?? 30;
    if (f === 0) return null;
    const deuda = p.ultimoContacto ? diasEntre(String(p.ultimoContacto).slice(0, 10), hoy) - f : 9999;
    return deuda >= 0 ? { nombre: p.nombre, deuda } : null;
  }).filter(Boolean).sort((a, b) => b.deuda - a.deuda).map(x => x.nombre);
}
export function textoContactos(nombres) {
  if (!nombres.length) return "";
  return `Hace tiempo que no hablas con ${enumerarCorto(nombres)}.`;
}
