/* ============================================================
   Rumbo · Reglas de los avisos (sin dependencias, se prueban en tests/notifier.test.mjs)
   Todas reciben la fecha local "YYYY-MM-DD" de la persona y lo que ya hizo.
   ============================================================ */

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
