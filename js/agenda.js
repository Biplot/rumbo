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
     delegadaA?, bocadoSugerido?, borrada?,
     prioridad?    // id de la prioridad de la semana que avanza (ritual semanal)
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
  if (p.prioridad) t.prioridad = p.prioridad;
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
    bocadoSugerido: !!(op.comoBocado || (t.esSapo && postergada)), prioridad: t.prioridad,
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
/* Compara lo planificado con tu capacidad real (tmCapacidad). Vacío si aún no hay datos. */
function capacidadHint(n, cap) {
  if (!cap) return "";
  const prom = String(cap.hechasProm).replace(".", ",");
  if (n > Math.ceil(cap.hechasProm) + 1) return `<span class="hl-coral">⚠ Llevas ${n} tareas y en promedio completas ${prom} por día. ¿Cuáles pueden esperar?</span>`;
  return `Llevas ${n} tarea${n === 1 ? "" : "s"} · en promedio completas ${prom} por día.`;
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
    <div class="item-row__main"><div class="item-row__title text-sm ${hecha || e === "soltada" ? "strike" : ""}">${t.esSapo ? BOCADO.emoji + " " : t.prioridad ? '<span title="Prioridad de la semana">🎯</span> ' : ""}${escapeHtml(t.txt)}</div>
      ${t.esSapo && !op.compacto && viva ? `<div class="item-row__sub hl-coral">${BOCADO.titulo} · ${BOCADO.accion}</div>` : ""}
      ${meta ? `<div class="tarea-meta">${meta}</div>` : ""}</div>
    ${acciones}</div>`;
}

/* ============================================================
   Posponer (bullet journal): decidir qué pasa con cada tarea pendiente
   Se usa en el cierre del día, la bandeja de pendientes, el botón ↪ y el
   cierre de semana. Mover no da ni quita monedas: la métrica informa, no castiga.
   ============================================================ */
const TRIAGE_OPC = {
  manana: { sig: ">", label: "Mañana" },
  hoy: { sig: ">", label: "Hoy" },
  semana: { sig: ">", label: "Próx. semana" },
  otro: { sig: "<", label: "Otro día" },
  delegar: { sig: "@", label: "Delegar" },
  soltar: { sig: "✕", label: "Soltar" },
  hecha: { sig: "✓", label: "La hice" },
};
const CRONICA = 3;   // regla del bullet journal: a la tercera postergación, pregúntate si vale la pena

/* items: [{ t, iso }] · cfg: { mover: "manana" | "hoy" | "semana", base: fecha de referencia, min: fecha mínima para "Otro día",
   moverLabel?: texto del botón principal, conDia?: mostrar siempre el día de cada tarea } */
function triageHtml(items, cfg) {
  const opciones = [cfg.mover, "otro", "delegar", "soltar", "hecha"];
  const rows = items.map(({ t, iso }) => {
    const n = (t.migraciones || 0) + 1;
    const alerta = n >= CRONICA
      ? `<div class="triage-alerta tr-alerta">⚠ Sería la ${n}.ª vez que la postergas. ¿Vale la pena? Puedes hacerla tu primer bocado, partirla en un paso más chico, programarla o soltarla.
          <label class="row mt-8" style="gap:8px"><input type="checkbox" class="tr-bocado"> ${BOCADO.emoji} Hacerla mi primer bocado</label>
          <input class="input mt-8 tr-paso" placeholder="O escribe un primer paso más chico (opcional)"></div>` : "";
    return `<div class="triage-row" data-iso="${iso}" data-id="${t.id}">
      <div class="triage-t">${t.esSapo ? BOCADO.emoji + " " : AMBITOS[ambitoDe(t)].icon + " "}${escapeHtml(t.txt)} ${chipMigraciones(t)}
        ${cfg.conDia || iso !== cfg.base ? `<span class="text-xs muted">· ${diaCorto(iso)}</span>` : ""}</div>
      <div class="seg seg--triage" role="group" aria-label="Qué hacer con esta tarea">${opciones.map(v =>
        `<button type="button" class="${v === cfg.mover ? "is-active" : ""}" data-v="${v}" onclick="triagePick(this)"><b>${TRIAGE_OPC[v].sig}</b> ${v === cfg.mover && cfg.moverLabel ? cfg.moverLabel : TRIAGE_OPC[v].label}</button>`).join("")}</div>
      <input type="hidden" class="tr-v" value="${cfg.mover}">
      <div class="triage-extra tr-otro" hidden><label class="text-xs muted">¿Para qué día?</label>
        <input type="date" class="input tr-fecha" min="${cfg.min}" value="${agSumar(cfg.min, 1)}"></div>
      <div class="triage-extra tr-delegar" hidden><input class="input tr-quien" placeholder="¿A quién se la delegas?"></div>
      ${alerta}
    </div>`;
  }).join("");
  return `<div class="triage">
    ${items.length > 1 ? `<div class="flex-between triage-head"><span class="text-xs muted">Elige qué hacer con cada una</span>
      <button type="button" class="btn-ghost" onclick="triageTodas(this,'${cfg.mover}')">Todas → ${(cfg.moverLabel || TRIAGE_OPC[cfg.mover].label).toLowerCase()}</button></div>` : ""}
    ${rows}</div>`;
}
function triagePick(btn) {
  const row = btn.closest(".triage-row");
  row.querySelectorAll(".seg--triage button").forEach(b => b.classList.toggle("is-active", b === btn));
  const v = btn.dataset.v;
  row.querySelector(".tr-v").value = v;
  row.querySelector(".tr-otro").hidden = v !== "otro";
  row.querySelector(".tr-delegar").hidden = v !== "delegar";
  const al = row.querySelector(".tr-alerta");
  if (al) al.hidden = !["manana", "hoy", "semana", "otro"].includes(v);
}
function triageTodas(btn, v) {
  btn.closest(".triage").querySelectorAll(".triage-row").forEach(row => {
    const b = row.querySelector(`.seg--triage button[data-v="${v}"]`); if (b) triagePick(b);
  });
}
function leerTriage(cont) {
  return Array.from((cont || document).querySelectorAll(".triage-row")).map(row => ({
    iso: row.dataset.iso, id: row.dataset.id,
    v: row.querySelector(".tr-v").value,
    fecha: (row.querySelector(".tr-fecha") || {}).value || "",
    quien: ((row.querySelector(".tr-quien") || {}).value || "").trim(),
    bocado: !!(row.querySelector(".tr-bocado") || {}).checked,
    paso: ((row.querySelector(".tr-paso") || {}).value || "").trim(),
  }));
}
/* Vuelve a marcar decisiones ya tomadas (al ir y volver entre pasos de un asistente) */
function restaurarTriage(cont, decisiones) {
  if (!cont) return;
  (decisiones || []).forEach(x => {
    const row = Array.from(cont.querySelectorAll(".triage-row")).find(r => r.dataset.iso === x.iso && r.dataset.id === x.id);
    if (!row) return;
    const b = row.querySelector(`.seg--triage button[data-v="${x.v}"]`); if (b) triagePick(b);
    if (x.fecha) row.querySelector(".tr-fecha").value = x.fecha;
    if (x.quien) row.querySelector(".tr-quien").value = x.quien;
    const bo = row.querySelector(".tr-bocado"); if (bo) bo.checked = !!x.bocado;
    const pa = row.querySelector(".tr-paso"); if (pa) pa.value = x.paso || "";
  });
}
/* Aplica las decisiones. Devuelve un conteo para el mensaje final. */
function aplicarTriage(S, decisiones, cfg) {
  const n = { movidas: 0, delegadas: 0, soltadas: 0, hechas: 0 };
  const hoy = todayISO();
  decisiones.forEach(d => {
    const t = buscarTarea(S, d.iso, d.id);
    if (!t || t.borrada || !tareaAbierta(t)) return;
    if (["manana", "hoy", "semana", "otro"].includes(d.v)) {
      let destino = d.v === "manana" ? agSumar(cfg.base, 1) : d.v === "hoy" ? hoy
        : d.v === "semana" ? agSumar(agLunes(cfg.base), 7) : d.fecha;
      if (!destino || destino <= d.iso) destino = d.v === "otro" ? agSumar(cfg.min, 1) : agSumar(d.iso, 1);
      moverTarea(S, t, d.iso, destino, d.v === "otro" ? "programada" : "migrada", { hoy, txt: d.paso || undefined, comoBocado: d.bocado });
      n.movidas++;
    } else if (d.v === "delegar") { marcarTarea(t, "delegada", { delegadaA: d.quien }); n.delegadas++; }
    else if (d.v === "soltar") { marcarTarea(t, "soltada"); n.soltadas++; }
    else if (d.v === "hecha") {
      marcarTarea(t, "hecha"); n.hechas++;
      if (typeof registrarMovimiento === "function") registrarMovimiento("tarea:" + t.id, 15, 15, "Tarea", true);
    }
  });
  return n;
}
function textoTriage(n) {
  const p = [];
  if (n.hechas) p.push(`✓ ${n.hechas} hecha${n.hechas === 1 ? "" : "s"}`);
  if (n.movidas) p.push(`↪ ${n.movidas} a otro día`);
  if (n.delegadas) p.push(`@ ${n.delegadas} delegada${n.delegadas === 1 ? "" : "s"}`);
  if (n.soltadas) p.push(`✕ ${n.soltadas} soltada${n.soltadas === 1 ? "" : "s"}`);
  return p.join(" · ");
}

/* -------- Bandeja: pendientes de días anteriores -------- */
function itemsBandeja() {
  const hoy = todayISO();
  const cierreAyer = typeof pendingCierreDate === "function" ? pendingCierreDate() : null;   // esas se deciden al cerrar ayer
  return pendientesAnteriores(STATE, hoy, 30).filter(x => x.iso !== cierreAyer);
}
function renderBandejaPendientes() {
  const items = itemsBandeja();
  if (!items.length) return "";
  return `<div class="bandeja">
    <div><b>📥 ${items.length} pendiente${items.length === 1 ? "" : "s"} de días anteriores</b>
      <div class="text-xs muted">Decide qué hacer con ${items.length === 1 ? "ella" : "ellas"}: hoy, otro día, delegar o soltar.</div></div>
    <button class="btn btn--soft" data-action="bandeja-open">Resolver</button></div>`;
}
function openBandeja() {
  const items = itemsBandeja();
  if (!items.length) return toast("No tienes pendientes de días anteriores 🎉");
  const hoy = todayISO();
  openModal("Pendientes de días anteriores", `
    <p class="text-sm muted" style="margin-bottom:12px">Como en tu agenda de papel: cada tarea abierta se decide. Por defecto pasan a hoy.</p>
    <div id="bandeja-triage">${triageHtml(items, { mover: "hoy", base: hoy, min: hoy })}</div>
    <button class="btn btn--primary btn-block mt-16" data-action="bandeja-save">Guardar decisiones</button>`);
}
function guardarBandeja() {
  const hoy = todayISO();
  const n = aplicarTriage(STATE, leerTriage(document.getElementById("bandeja-triage")), { base: hoy, min: hoy });
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(textoTriage(n) || "Listo");
}

/* -------- ↪ Posponer una tarea puntual -------- */
function openPosponerTarea(iso, id) {
  const t = buscarTarea(STATE, iso, id);
  if (!t || !tareaAbierta(t)) return;
  const hoy = todayISO();
  const base = iso < hoy ? hoy : iso;
  const mover = iso < hoy ? "hoy" : "manana";
  openModal("Posponer tarea", `
    <div id="posponer-triage" data-base="${base}">${triageHtml([{ t, iso }], { mover, base, min: base, moverLabel: iso > hoy ? "Día siguiente" : null })}</div>
    <p class="text-xs muted mt-8">${iso > hoy ? "Moverla antes de su día es replanificar: no cuenta como postergación." : "Moverla cuenta como postergación en tus métricas."}</p>
    <button class="btn btn--primary btn-block mt-16" data-action="posponer-save">Guardar</button>`);
}
function guardarPosponer() {
  const cont = document.getElementById("posponer-triage");
  const base = cont.dataset.base;
  const n = aplicarTriage(STATE, leerTriage(cont), { base, min: base });
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(textoTriage(n) || "Listo");
}
