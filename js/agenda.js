/* ============================================================
   RUMBO · Registro diario (agenda por fecha), estilo bullet journal
   Cada tarea vive en su día: STATE.agenda.dias["YYYY-MM-DD"] = [tarea, …]
   Nada se borra de la historia: una tarea que se mueve queda marcada en su
   día (> < @ ✕) y se copia al día nuevo. Así se puede medir la postergación.

   Tarea: {
     id, txt, ambito: "pro" | "per", esSapo?, estado, done, ts,
     origen,       // id de la primera tarea de la cadena (si se fue moviendo)
     creada,       // día en que se planificó por primera vez
     migraciones,  // cuántas veces se postergó la cadena antes de este registro
     destino?,     // a qué fecha se movió (migrada / programada)
     postergada?,  // se movió el mismo día o después (cuenta como postergación)
     delegadaA?, bocadoSugerido?, borrada?
   }
   Estados: pendiente · hecha · migrada (>) · programada (<) · delegada (@) · soltada (✕)
   Las borradas quedan marcadas (borrada: true) para que no revivan al sincronizar.
   ============================================================ */

const ESTADOS_TAREA = {
  pendiente: { sig: "•", label: "Pendiente" },
  hecha: { sig: "✓", label: "Hecha" },
  migrada: { sig: ">", label: "Migrada" },
  programada: { sig: "<", label: "Programada" },
  delegada: { sig: "@", label: "Delegada" },
  soltada: { sig: "✕", label: "Soltada" },
};
const DIAS_CORTO_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function estadoTarea(t) { return (t && t.estado) || (t && t.done ? "hecha" : "pendiente"); }
function tareaAbierta(t) { return estadoTarea(t) === "pendiente"; }
function tareaMovida(t) { const e = estadoTarea(t); return e === "migrada" || e === "programada"; }

/* Fechas ISO locales (sin depender de otros archivos) */
function agDate(iso) { return new Date(iso + "T12:00:00"); }
function agSumar(iso, n) { const d = agDate(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function agLunes(iso) { const d = agDate(iso); return agSumar(iso, -((d.getDay() + 6) % 7)); }
function agDiff(a, b) { return Math.round((agDate(b) - agDate(a)) / 86400000); }   // días de a → b
function diaCorto(iso) { const d = agDate(iso); return `${DIAS_CORTO_ES[d.getDay()]} ${d.getDate()}`; }
function fechaCortaMes(iso) { const d = agDate(iso); return `${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()}`; }

/* -------- Acceso -------- */
function agendaDias(S) {
  S = S || STATE;
  if (!S.agenda || typeof S.agenda !== "object") S.agenda = { dias: {} };
  if (!S.agenda.dias || typeof S.agenda.dias !== "object") S.agenda.dias = {};
  return S.agenda.dias;
}
function agendaDia(S, iso) { const d = agendaDias(S); return d[iso] || (d[iso] = []); }
/* Tareas visibles de un día (sin las borradas) */
function tareasDelDia(iso, S) { return ((agendaDias(S)[iso]) || []).filter(t => t && !t.borrada); }
function buscarTarea(S, iso, id) { return ((agendaDias(S)[iso]) || []).find(t => t && t.id === id) || null; }

/* -------- Cambios (siempre con ts nuevo, para que la fusión elija lo último) -------- */
function nuevaTarea(S, iso, p) {
  const t = {
    id: uid(), txt: String(p.txt || "").trim(), ambito: p.ambito === "pro" ? "pro" : "per",
    estado: "pendiente", done: false, creada: p.creada || iso, migraciones: p.migraciones || 0, ts: Date.now(),
  };
  t.origen = p.origen || t.id;
  if (p.esSapo) t.esSapo = true;
  if (p.bocadoSugerido) t.bocadoSugerido = true;
  agendaDia(S, iso).push(t);
  return t;
}
function marcarTarea(t, estado, extra) {
  t.estado = estado;
  t.done = estado === "hecha";
  if (extra) Object.assign(t, extra);
  t.ts = Date.now();
  return t;
}
function borrarTarea(t) { t.borrada = true; t.ts = Date.now(); return t; }

/* Mueve una tarea a otra fecha (bullet journal: la original queda marcada > o <
   y se escribe de nuevo en el día destino). Si se mueve el mismo día o después,
   cuenta como postergación; si se replanifica antes de su día, no.
   opciones: { hoy, txt (primer paso más chico), comoBocado } */
function moverTarea(S, t, desde, hacia, tipo, op) {
  op = op || {};
  const hoy = op.hoy || todayISO();
  const postergada = desde <= hoy;
  marcarTarea(t, tipo === "programada" ? "programada" : "migrada", { destino: hacia, postergada });
  return nuevaTarea(S, hacia, {
    txt: op.txt || t.txt, ambito: t.ambito, origen: t.origen || t.id, creada: t.creada || desde,
    migraciones: (t.migraciones || 0) + (postergada ? 1 : 0),
    bocadoSugerido: !!(op.comoBocado || (t.esSapo && postergada)),
  });
}
/* Deshace un movimiento si la copia sigue intacta (pendiente) */
function deshacerMovimiento(S, t, iso) {
  if (!tareaMovida(t) || !t.destino) return false;
  const copia = tareasDelDia(t.destino, S).find(x => (x.origen || x.id) === (t.origen || t.id) && x.id !== t.id && tareaAbierta(x));
  if (!copia) return false;
  borrarTarea(copia);
  marcarTarea(t, "pendiente", { destino: undefined, postergada: undefined });
  delete t.destino; delete t.postergada;
  return true;
}

/* Tareas pendientes de días anteriores (bandeja), las más recientes primero */
function pendientesAnteriores(S, hoy, dias) {
  const out = [], desde = agSumar(hoy, -(dias || 30));
  Object.keys(agendaDias(S)).forEach(iso => {
    if (iso >= hoy || iso < desde) return;
    tareasDelDia(iso, S).forEach(t => { if (tareaAbierta(t)) out.push({ t, iso }); });
  });
  return out.sort((a, b) => (a.iso < b.iso ? 1 : -1));
}

/* -------- Resúmenes -------- */
/* { pro: [hechas, planificadas], per: [hechas, planificadas] } (formato de cierre.tareas) */
function tareasResumen(tareas) {
  const r = { pro: [0, 0], per: [0, 0] };
  (tareas || []).forEach(t => { if (!t || t.borrada) return; const a = ambitoDe(t); r[a][1]++; if (estadoTarea(t) === "hecha") r[a][0]++; });
  return r;
}
/* Conteo por estado de un día */
function resumenDia(S, iso) {
  const r = { planificadas: 0, hechas: 0, pendientes: 0, migradas: 0, programadas: 0, delegadas: 0, soltadas: 0 };
  tareasDelDia(iso, S).forEach(t => {
    r.planificadas++;
    const e = estadoTarea(t);
    if (e === "hecha") r.hechas++; else if (e === "pendiente") r.pendientes++;
    else if (e === "migrada") r.migradas++; else if (e === "programada") r.programadas++;
    else if (e === "delegada") r.delegadas++; else if (e === "soltada") r.soltadas++;
  });
  return r;
}
/* Resumen que se guarda en cierre.tareas */
function resumenCierre(S, iso) {
  const lista = tareasDelDia(iso, S);
  return Object.assign(tareasResumen(lista), resumenDia(S, iso));
}

/* -------- Migración desde el planificador semanal (semana.dias) -------- */
/* Crea la agenda a partir de la semana guardada. Idempotente: además, en cada carga
   importa (por id) tareas que un cliente antiguo haya agregado a semana.dias. */
function migrarAgenda(s) {
  if (!s.agenda || typeof s.agenda !== "object") s.agenda = { dias: {} };
  if (!s.agenda.dias || typeof s.agenda.dias !== "object") s.agenda.dias = {};
  const sem = s.semana;
  if (!sem || !sem.weekOf || !Array.isArray(sem.dias)) return s;
  const conocidas = new Set();
  Object.values(s.agenda.dias).forEach(l => (l || []).forEach(t => t && conocidas.add(t.id)));
  const borr = new Set(sem.borradas || []);
  sem.dias.forEach((lista, i) => {
    const iso = agSumar(sem.weekOf, i);
    (lista || []).forEach(t => {
      if (!t || t.id == null || conocidas.has(t.id) || borr.has(t.id)) return;
      const n = {
        id: t.id, txt: t.txt || "", ambito: t.ambito === "pro" ? "pro" : "per",
        estado: t.done ? "hecha" : "pendiente", done: !!t.done, origen: t.id, creada: iso, migraciones: 0, ts: t.ts || 1,
      };
      if (t.esSapo) n.esSapo = true;
      (s.agenda.dias[iso] = s.agenda.dias[iso] || []).push(n);
      conocidas.add(t.id);
    });
  });
  // El premio de la semana pasa al plan de esa semana
  if (sem.premio && s.ritual) {
    s.ritual.semanas = s.ritual.semanas || {};
    const w = s.ritual.semanas[sem.weekOf] = s.ritual.semanas[sem.weekOf] || {};
    if (!w.plan) w.plan = { premio: sem.premio, ts: 1 };
  }
  return s;
}

/* -------- UI compartida (Inicio y Planificador) -------- */
/* Etiqueta del signo de una tarea resuelta sin hacer: "> jue 26", "@ Ana", "✕ soltada" */
function signoTarea(t) {
  const e = estadoTarea(t);
  if (e === "migrada") return `&gt; ${diaCorto(t.destino)}`;
  if (e === "programada") return `&lt; ${fechaCortaMes(t.destino)}`;
  if (e === "delegada") return `@ ${escapeHtml(t.delegadaA || "delegada")}`;
  if (e === "soltada") return "✕ soltada";
  return "";
}
function chipMigraciones(t) {
  const n = t.migraciones || 0;
  if (!n) return "";
  return `<span class="chip chip--mig ${n >= 3 ? "is-cronica" : ""}" title="Postergada ${n} ${n === 1 ? "vez" : "veces"}">↪ ${n}</span>`;
}
function tareaRowHtml(t, iso, op) {
  op = op || {};
  const e = estadoTarea(t);
  const viva = e === "pendiente" || e === "hecha";
  const hecha = e === "hecha";
  const meta = (viva ? "" : `<span class="chip chip--sig">${signoTarea(t)}</span>`) + chipMigraciones(t);
  const marca = viva
    ? `<span class="check ${hecha ? "is-on" : ""}" data-action="tarea-toggle" data-fecha="${iso}" data-id="${t.id}" role="checkbox" aria-checked="${hecha}">${hecha ? "✓" : ""}</span>`
    : `<span class="sig" aria-label="${ESTADOS_TAREA[e].label}">${ESTADOS_TAREA[e].sig}</span>`;
  const acciones = viva
    ? `${op.conAmbito === false || (op.ambitoSoloBocado && !t.esSapo) ? "" : ambitoChip(t, iso, op.compacto)}
       ${e === "pendiente" ? `<button class="icon-btn" data-action="tarea-posponer" data-fecha="${iso}" data-id="${t.id}" title="Posponer" aria-label="Posponer">↪</button>` : ""}
       <button class="icon-btn" data-action="tarea-del" data-fecha="${iso}" data-id="${t.id}" title="Borrar" aria-label="Borrar">✕</button>`
    : (tareaMovida(t) ? `<button class="icon-btn" data-action="tarea-deshacer" data-fecha="${iso}" data-id="${t.id}" title="Deshacer" aria-label="Deshacer">↶</button>` : "");
  return `<div class="item-row tarea-row ${viva ? "" : "is-moved"} ${t.esSapo ? "is-bocado" : ""}" style="padding:${op.compacto ? "8px 10px" : "9px 11px"}">
    ${marca}
    <div class="item-row__main"><div class="item-row__title text-sm ${hecha || e === "soltada" ? "strike" : ""}">${t.esSapo ? BOCADO.emoji + " " : ""}${escapeHtml(t.txt)}</div>
      ${t.esSapo && !op.compacto && viva ? `<div class="item-row__sub hl-coral">${BOCADO.titulo} · ${BOCADO.accion}</div>` : ""}
      ${meta ? `<div class="tarea-meta">${meta}</div>` : ""}</div>
    ${acciones}</div>`;
}

/* -------- Posponer (se completa en la fase 2) -------- */
function renderBandejaPendientes() { return ""; }
function openPosponerTarea() { toast("Muy pronto podrás posponer desde aquí", true); }
