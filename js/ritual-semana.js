/* ============================================================
   RUMBO · Ritual de Semana (cierre y apertura)
   Cascada: trimestre → mes → semana → día. Cada semana tiene un foco, 3 prioridades
   (ligadas a los objetivos del mes), tareas repartidas en los días y un premio.
   Datos: STATE.ritual.semanas["YYYY-MM-DD" (lunes)] = {
     plan: { premio, ts },
     apertura: { foco, prioridades: [{ id, texto, ambito, objId, dia }], habitosFoco: [id], ts },
     cierre: { evaluacion: { idPrioridad: "cumplida" | "parcial" | "no" }, mejor, aprendizaje,
               ajustar, premioGanado, nota, numeros, ts } }
   Día del ritual: STATE.settings.ritualSemanal.dia (0 = domingo, 1 = lunes). Ese día se
   hace todo seguido: primero se cierra la semana y luego se planifica la siguiente.
   ============================================================ */

const SEM_CIERRE_VIERNES_HORA = 14;   // la semana se puede cerrar desde el viernes a las 14:00

/* -------- Datos -------- */
function diaRitualSemanal(S) { const r = ((S || STATE).settings || {}).ritualSemanal; return r && r.dia === 1 ? 1 : 0; }
function ritualSemana(lunes, S) { S = S || STATE; S.ritual.semanas = S.ritual.semanas || {}; return S.ritual.semanas[lunes] || null; }
function semanaAbierta(lunes, S) { const r = ritualSemana(lunes, S); return !!(r && r.apertura); }
function semanaCerrada(lunes, S) { const r = ritualSemana(lunes, S); return !!(r && r.cierre); }
/* Día en que toca el ritual que cierra la semana `lunes`: su domingo o el lunes siguiente */
function diaDelRitualSemana(lunes, S) { return agSumar(lunes, 6 + diaRitualSemanal(S)); }
/* "21 al 27 de septiembre" · "28 de septiembre al 4 de octubre" */
function rangoSemanaTxt(lunes) {
  const a = agDate(lunes), b = agDate(agSumar(lunes, 6)), mes = d => MESES[d.getMonth()].toLowerCase();
  return a.getMonth() === b.getMonth() ? `${a.getDate()} al ${b.getDate()} de ${mes(b)}` : `${a.getDate()} de ${mes(a)} al ${b.getDate()} de ${mes(b)}`;
}
/* "21–27 sep" · "28 sep – 4 oct" (sin cortar "4 oct" en dos líneas) */
function rangoSemanaCorto(lunes) {
  const dom = agSumar(lunes, 6), a = agDate(lunes), b = agDate(dom), f = iso => fechaCortaMes(iso).replace(" ", "\u00a0");
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${f(dom)}` : `${f(lunes)} – ${f(dom)}`;
}
/* ¿Hubo algo en la semana? (plan, días de ritual o tareas) */
function semanaConActividad(lunes, S) {
  S = S || STATE;
  if (semanaAbierta(lunes, S)) return true;
  for (let i = 0; i < 7; i++) {
    const iso = agSumar(lunes, i), r = S.ritual.dias[iso];
    if ((r && r.hecho) || tareasDelDia(iso, S).length) return true;
  }
  return false;
}
/* Objetivo del mes por id (en cualquier mes del año fijo) */
function objetivoDe(id, S) {
  if (!id) return null;
  for (const lista of todosLosMensuales(S)) { const o = (lista || []).find(x => x.id === id); if (o) return o; }
  return null;
}
/* Cuántas prioridades semanales empujan un objetivo del mes (para Objetivos) */
function prioridadesDeObjetivo(id, S) {
  let n = 0;
  Object.values((S || STATE).ritual.semanas || {}).forEach(w => ((w.apertura || {}).prioridades || []).forEach(p => { if (p.objId === id) n++; }));
  return n;
}
/* ¿Se hizo la tarea de una prioridad durante la semana? */
function prioridadHecha(p, lunes, S) {
  for (let i = 0; i < 7; i++) if (tareasDelDia(agSumar(lunes, i), S).some(t => t.prioridad === p.id && estadoTarea(t) === "hecha")) return true;
  return false;
}

/* -------- Ventanas --------
   Aviso en Inicio (ritualSemanaPendientes):
   · cierre: el día del ritual y hasta el mediodía del día siguiente (si la semana tuvo algo)
   · apertura: desde el día del ritual hasta el martes de la semana que empieza
   Botones en Ritual → Semana (semanaCerrable / semanaPlanificable): más amplios. */
function ritualSemanaPendientes(now, S) {
  now = now || new Date(); S = S || STATE;
  const hoy = isoLocal(now), W = agLunes(hoy), out = {};
  [agSumar(W, -7), W].forEach(L => {
    const dia = diaDelRitualSemana(L, S), sig = agSumar(L, 7);
    if (hoy < dia) return;
    const enCierre = hoy === dia || (hoy === agSumar(dia, 1) && now.getHours() < 12);
    if (enCierre && !semanaCerrada(L, S) && semanaConActividad(L, S)) out.cierre = L;
    if (hoy <= agSumar(sig, 1) && !semanaAbierta(sig, S)) out.apertura = sig;
  });
  return out;
}
/* La semana actual se puede cerrar desde el viernes 14:00; la anterior, siempre */
function semanaCerrable(lunes, now) {
  now = now || new Date();
  const hoy = isoLocal(now), W = agLunes(hoy);
  if (lunes === W) { const vie = agSumar(W, 4); return hoy > vie || (hoy === vie && now.getHours() >= SEM_CIERRE_VIERNES_HORA); }
  return lunes === agSumar(W, -7);
}
/* La actual se planifica siempre; la próxima, desde que se puede cerrar la actual */
function semanaPlanificable(lunes, now) {
  now = now || new Date();
  const W = agLunes(isoLocal(now));
  return lunes === W || (lunes === agSumar(W, 7) && semanaCerrable(W, now));
}

/* Aviso para Inicio y Ritual */
function renderSemanaBanner() {
  const p = ritualSemanaPendientes();
  if (p.cierre && p.apertura) return heroCoral("📅 Tu ritual semanal", "Cierra tu semana y planifica la que viene: tus prioridades, tus números, tus pendientes y tu foco. Toma 10 minutos.", "Comenzar", "sem-ritual", { cierre: p.cierre, apertura: p.apertura });
  if (p.cierre) return heroCoral("📅 Cierra tu semana", `Revisa tus prioridades y tus números, y decide qué pasa con lo pendiente (${rangoSemanaTxt(p.cierre)}).`, "Cerrar la semana", "sem-ritual", { cierre: p.cierre });
  if (p.apertura) return heroCoral("📅 Planifica tu semana", "Elige tu foco y tus 3 prioridades, y reparte tus tareas en los días.", "Planificar la semana", "sem-ritual", { apertura: p.apertura });
  return "";
}

/* -------- Números de la semana -------- */
function resumenSemanaRitual(lunes, S, evaluacion) {
  S = S || STATE;
  const fin = agSumar(lunes, 6);
  const dias = Array.from({ length: 7 }, (_, i) => S.ritual.dias[agSumar(lunes, i)]).filter(Boolean);
  const tm = tmResumen(S, lunes, fin);
  const r = ritualSemana(lunes, S) || {};
  const prios = (r.apertura || {}).prioridades || [];
  const ev = evaluacion || (r.cierre || {}).evaluacion || null;
  return {
    abiertos: dias.filter(x => x.hecho).length,
    cerrados: dias.filter(x => x.cerrado).length,
    bocados: dias.filter(x => x.cierre && x.cierre.sapo).length,
    habitos: cumplimientoGrupo(S.habitos.defs, lunes, fin, S).pct,
    prioridades: ev && prios.length ? [prios.filter(p => ev[p.id] === "cumplida").length, prios.length] : null,
    tareas: [tm.hechas, tm.tareas],
    postergacion: tm.tareas ? tm.indice : null, arrastre: tm.arrastre,
    soltadas: tm.soltadas, delegadas: tm.delegadas,
  };
}
function resumenSemanaHtml(r, ant) {
  const n = (ico, label, v, extra) => `<div class="mes-num"><div class="mes-num__v">${v}${extra || ""}</div><div class="mes-num__l">${ico} ${label}</div></div>`;
  const pct = x => (x && x[1] ? Math.round((x[0] / x[1]) * 100) : null);
  // Flecha contra la semana anterior (verde si mejoró)
  const delta = (a, b, menosEsMejor) => {
    if (a == null || b == null || a === b) return "";
    const mejor = menosEsMejor ? a < b : a > b;
    return `<span class="delta ${mejor ? "is-up" : "is-down"}" title="Semana anterior: ${b}%">${a > b ? "▲" : "▼"}</span>`;
  };
  return `<div class="mes-nums">
    ${r.prioridades ? n("🎯", "prioridades cumplidas", `${r.prioridades[0]}/${r.prioridades[1]}`) : ""}
    ${n("✓", "tareas completadas", `${r.tareas[0]}/${r.tareas[1]}`, delta(pct(r.tareas), ant && pct(ant.tareas), false))}
    ${n("↪", "postergación", r.postergacion == null ? "—" : r.postergacion + "%", delta(r.postergacion, ant && ant.postergacion, true))}
    ${n("⏳", "días de arrastre", r.arrastre == null ? "—" : String(r.arrastre).replace(".", ","))}
    ${n(BOCADO.emoji, "primeros bocados", r.bocados)}
    ${n("📊", "hábitos", r.habitos == null ? "—" : r.habitos + "%")}
    ${n("🌅", "días abiertos", `${r.abiertos}/7`)}
    ${n("🌙", "días cerrados", `${r.cerrados}/7`)}
    ${n("✕", "soltadas · @ delegadas", `${r.soltadas} · ${r.delegadas}`)}
  </div>`;
}

/* Migración semanal: pendientes de días anteriores → por defecto a la próxima semana
   (si la semana ya terminó hace rato, a hoy) */
function cfgTriageSemana(lunes) {
  const hoy = todayISO(), sig = agSumar(lunes, 7);
  return sig > hoy ? { mover: "semana", base: lunes, min: hoy, conDia: true } : { mover: "hoy", base: hoy, min: hoy, conDia: true };
}

/* ============================================================
   Asistente por pasos (cierre / apertura)
   ============================================================ */
let SEM_WIZ = null;   // { tipo, lunes, paso, draft, siguiente }
const SEM_PASOS = {
  cierre: ["Prioridades", "Números", "Pendientes", "Reflexión", "Nota"],
  apertura: ["Mirada atrás", "Foco y prioridades", "Tus días", "Premio y hábitos"],
};

function openSemanaRitual(cierre, apertura) {
  if (cierre) openSemCierre(cierre, apertura || null);
  else if (apertura) openSemApertura(apertura);
}

function openSemApertura(lunes, op) {
  op = op || {};
  const r = ritualSemana(lunes) || {}, a = r.apertura || {};
  const prioridades = (a.prioridades || []).map(p => Object.assign({}, p));
  while (prioridades.length < 3) prioridades.push({ id: "", texto: "", ambito: "pro", objId: "", dia: "" });
  SEM_WIZ = {
    tipo: "apertura", lunes, paso: op.desdeCierre ? 1 : 0,   // recién cerrada: la mirada atrás ya se vio
    draft: { foco: a.foco || "", prioridades, premio: (r.plan || {}).premio || "", habitosFoco: (a.habitosFoco || []).slice(), nuevas: {}, ambDia: {} },
  };
  renderSemWiz();
}

function openSemCierre(lunes, siguiente) {
  const r = ritualSemana(lunes) || {}, c = r.cierre || {}, a = r.apertura || {};
  const evaluacion = {};
  (a.prioridades || []).forEach(p => { evaluacion[p.id] = (c.evaluacion || {})[p.id] || (prioridadHecha(p, lunes) ? "cumplida" : "no"); });
  // Si ya es el día del ritual, al cerrar se sigue con la planificación de la próxima
  const sig = agSumar(lunes, 7);
  if (!siguiente && !semanaAbierta(sig) && todayISO() >= diaDelRitualSemana(lunes) && semanaPlanificable(sig)) siguiente = sig;
  SEM_WIZ = {
    tipo: "cierre", lunes, paso: 0, siguiente: siguiente || null,
    draft: {
      evaluacion, mejor: c.mejor || "", aprendizaje: c.aprendizaje || "", ajustar: c.ajustar || "",
      premioGanado: c.premioGanado == null ? null : !!c.premioGanado, nota: c.nota || 7, triage: null,
    },
  };
  renderSemWiz();
}

function renderSemWiz() {
  const w = SEM_WIZ; if (!w) return;
  const pasos = SEM_PASOS[w.tipo], ult = w.paso === pasos.length - 1;
  // Al volver a dibujar el mismo paso (agregar una tarea) se conserva el scroll
  const prevEl = document.getElementById("sem-wiz");
  const scroll = prevEl && w._pasoDibujado === w.paso ? prevEl.scrollTop : 0;
  const dots = pasos.map((p, i) => `<span class="onb-dot ${i === w.paso ? "is-on" : ""}" title="${p}"></span>`).join("");
  const body = (w.tipo === "apertura" ? semAperturaPaso : semCierrePaso)(w);
  const yaHecho = (ritualSemana(w.lunes) || {})[w.tipo];
  const boton = yaHecho ? "Guardar cambios"
    : w.tipo === "apertura" ? "Planificar la semana (+75 ⭐)"
    : w.siguiente ? "Cerrar y planificar la próxima (+75 ⭐)" : "Cerrar la semana (+75 ⭐)";
  openModal(`${w.tipo === "apertura" ? "Planificar" : "Cerrar"} la semana · ${rangoSemanaCorto(w.lunes)}`, `
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Paso ${w.paso + 1} de ${pasos.length} · ${pasos[w.paso]}</div>
    <div class="mes-wiz mt-16" id="sem-wiz">${body}</div>
    <div class="onb-dots">${dots}</div>
    <div class="onb-nav">
      <button class="btn-ghost" data-action="${w.paso ? "semw-prev" : "close-modal"}">${w.paso ? "Atrás" : "Cancelar"}</button>
      <button class="btn btn--primary" data-action="${ult ? "semw-finish" : "semw-next"}">${ult ? boton : "Siguiente"}</button>
    </div>`);
  const cont = document.getElementById("sem-wiz");
  if (w.tipo === "cierre" && w.paso === 2 && w.draft.triage) restaurarTriage(cont, w.draft.triage);
  if (cont && scroll) cont.scrollTop = scroll;
  if (w.focus) { const f = document.getElementById(w.focus); if (f) f.focus(); w.focus = null; }
  w._pasoDibujado = w.paso;
}

/* -------- Apertura: pasos -------- */
function semAperturaPaso(w) {
  const d = w.draft, prev = agSumar(w.lunes, -7), hoy = todayISO();
  if (w.paso === 0) {
    const pc = (ritualSemana(prev) || {}).cierre;
    const cron = tmResumen(STATE, agSumar(w.lunes, -28), hoy).cronicas.filter(c => c.estado === "pendiente");
    return `<div class="card__title">Así te fue la semana del ${rangoSemanaTxt(prev)}</div>
      <div class="mt-16">${resumenSemanaHtml(resumenSemanaRitual(prev), resumenSemanaRitual(agSumar(prev, -7)))}</div>
      ${pc ? `<div class="divider"></div>
        ${pc.mejor ? `<div class="text-xs muted">🌟 Lo mejor de la semana</div><div class="mt-8">${escapeHtml(pc.mejor)}</div>` : ""}
        ${pc.aprendizaje ? `<div class="text-xs muted mt-16">🧠 Qué aprendiste</div><div class="mt-8">${escapeHtml(pc.aprendizaje)}</div>` : ""}
        ${pc.ajustar ? `<div class="text-xs muted mt-16">🔧 Para ajustar</div><div class="mt-8 hl-cian">${escapeHtml(pc.ajustar)}</div>` : ""}`
      : `<p class="text-xs muted mt-16">No cerraste esa semana. Cierra esta al final para ver aquí tu reflexión.</p>`}
      ${cron.length ? `<div class="divider"></div><div class="text-xs muted">⚠ Postergadas 3 veces o más</div>
        <div class="row-wrap mt-8" style="gap:6px">${cron.slice(0, 5).map(c => `<span class="chip chip--mig is-cronica">↪ ${c.n} · ${escapeHtml(c.txt)}</span>`).join("")}</div>
        <p class="text-xs muted mt-8">¿Alguna merece ser prioridad esta semana? ¿O es mejor soltarla?</p>` : ""}`;
  }
  if (w.paso === 1) {
    // Los objetivos son los del mes al que pertenece la semana (el de su jueves)
    const jue = agDate(agSumar(w.lunes, 3)), y = jue.getFullYear(), m = jue.getMonth();
    const objs = datosAnio(STATE, y).metas.mensuales[m] || [];
    const pc = (ritualSemana(prev) || {}).cierre || {};
    const rows = d.prioridades.map((p, i) => `<div class="mes-obj">
        <input type="hidden" id="sp-id-${i}" value="${escapeAttr(p.id || "")}">
        <div class="row" style="gap:8px">${ambitoPicker("sp-a-" + i, p.ambito, true)}
          <input class="input" id="sp-t-${i}" value="${escapeAttr(p.texto)}" placeholder="Prioridad ${i + 1}${i ? " (opcional)" : ""}" style="flex:1;min-width:0"></div>
        ${objs.length ? `<select class="select" id="sp-o-${i}"><option value="">— Sin vínculo con un objetivo de ${MESES[m]} —</option>${objs.filter(o => !o.done || o.id === p.objId).map(o => `<option value="${o.id}" ${p.objId === o.id ? "selected" : ""}>🎯 ${escapeHtml(o.texto)}</option>`).join("")}</select>` : ""}
      </div>`).join("");
    return `<div class="field"><label>Foco de la semana (una palabra o tema)</label>
        <input class="input" id="sw-foco" value="${escapeAttr(d.foco)}" placeholder="Ej: Cerrar el proyecto, Descanso, Ventas">
        ${pc.ajustar ? `<div class="text-xs muted mt-8">🔧 La semana pasada anotaste para ajustar: <b>${escapeHtml(pc.ajustar)}</b></div>` : ""}</div>
      <div class="field"><label>Tus 3 prioridades</label>
        <p class="text-xs muted" style="margin-bottom:10px">Lo que, si lo logras, hace que la semana valga la pena.${objs.length ? ` Vincúlalas a tus objetivos de ${MESES[m]} para que empujen en la misma dirección.` : ""}</p>
        ${rows}
        ${objs.length ? "" : `<p class="text-xs muted mt-8">Aún no tienes objetivos para ${MESES[m]}. Defínelos al abrir el mes (Ritual → Mes).</p>`}</div>`;
  }
  if (w.paso === 2) {
    const cap = tmCapacidad(STATE, hoy);
    const lim = cap ? Math.ceil(cap.hechasProm) + 1 : null;
    const fechas = Array.from({ length: 7 }, (_, i) => agSumar(w.lunes, i));
    const conTexto = d.prioridades.map((p, i) => ({ p, i })).filter(x => x.p.texto);
    const selDia = ({ p, i }) => `<div class="row" style="gap:8px;margin-bottom:6px"><span class="text-sm" style="flex:1;min-width:0">🎯 ${escapeHtml(p.texto)}</span>
      <select class="select" id="sp-d-${i}" style="max-width:130px" onchange="semWizDiaPrioridad(${i}, this.value)"><option value="">Sin día</option>${fechas.filter(iso => iso >= hoy).map(iso => `<option value="${iso}" ${p.dia === iso ? "selected" : ""}>${diaCorto(iso)}</option>`).join("")}</select></div>`;
    const dias = fechas.map((iso, i) => {
      const ex = tareasDelDia(iso).filter(t => tareaAbierta(t) || estadoTarea(t) === "hecha");
      const prios = conTexto.filter(({ p }) => p.dia === iso && !ex.some(t => t.prioridad === p.id || t.txt === p.texto)).map(x => x.p);
      const nuevas = d.nuevas[iso] || [];
      const n = ex.filter(tareaAbierta).length + prios.length + nuevas.length;
      const pasado = iso < hoy, sobre = lim && n > lim;
      return `<div class="semw-dia ${pasado ? "is-pasado" : ""} ${iso === hoy ? "is-hoy" : ""}">
        <div class="flex-between" style="gap:8px"><b class="text-sm">${DIAS_SEMANA[i]} ${agDate(iso).getDate()}</b>
          <span class="text-xs ${sobre ? "hl-coral" : "muted"}">${n} pendiente${n === 1 ? "" : "s"}${sobre ? " · ⚠ más de lo que sueles completar" : ""}</span></div>
        ${ex.length || prios.length || nuevas.length ? `<div class="row-wrap mt-8" style="gap:6px">
          ${ex.map(t => `<span class="chip ${estadoTarea(t) === "hecha" ? "chip--done" : ""}">${t.prioridad ? "🎯 " : AMBITOS[ambitoDe(t)].icon + " "}${escapeHtml(t.txt)}${t.migraciones ? ` · ↪ ${t.migraciones}` : ""}</span>`).join("")}
          ${prios.map(p => `<span class="chip chip--cian">🎯 ${escapeHtml(p.texto)}</span>`).join("")}
          ${nuevas.map((t, k) => `<span class="chip chip--cian">${AMBITOS[t.ambito].icon} ${escapeHtml(t.txt)}<button type="button" class="chip-x" data-action="semw-del" data-fecha="${iso}" data-i="${k}" aria-label="Quitar">✕</button></span>`).join("")}</div>` : ""}
        ${pasado ? "" : `<div class="row mt-8">${ambitoPicker("sw-amb-" + i, d.ambDia[i] || "pro", true)}
          <input class="input" id="sw-in-${i}" placeholder="Agregar tarea…" style="padding:7px 10px" onkeydown="if(event.key==='Enter'){event.preventDefault();this.nextElementSibling.click()}">
          <button type="button" class="btn btn--cian" data-action="semw-add" data-fecha="${iso}" data-i="${i}" style="padding:7px 12px" aria-label="Agregar">+</button></div>`}
      </div>`;
    }).join("");
    return `${conTexto.length ? `<div class="field"><label>¿Qué día avanzas cada prioridad?</label>${conTexto.map(selDia).join("")}</div>` : ""}
      <p class="text-xs muted" style="margin-bottom:6px">${cap ? `Tu capacidad real: en promedio completas <b>${String(cap.hechasProm).replace(".", ",")}</b> tareas por día. Deja espacio para lo imprevisto.` : "Reparte tus tareas en los días. Menos es más: deja espacio para lo imprevisto."}</p>
      ${dias}`;
  }
  const activos = STATE.habitos.defs.filter(hmActivo);
  return `<div class="field"><label>🏆 Tu premio de la semana</label>
      <input class="input" id="sw-premio" value="${escapeAttr(d.premio)}" placeholder="¿Con qué te vas a premiar al cumplir tus prioridades?"></div>
    <div class="field"><label>✨ Hábitos en foco (elige hasta 3)</label>
      ${activos.length ? activos.map(h => `<label class="mes-hab" style="cursor:pointer"><span class="mes-hab__n">${h.icon} ${escapeHtml(h.nombre)} <span class="text-xs muted">· ${hmFreqLabel(h)}</span></span>
        <input type="checkbox" class="sw-hab" value="${h.id}" ${d.habitosFoco.includes(h.id) ? "checked" : ""} onchange="semHabLimite(this)"></label>`).join("")
      : `<div class="empty">No tienes hábitos activos.</div>`}
      <p class="text-xs muted mt-8">Los verás con su avance de la semana en Ritual → Semana.</p></div>`;
}
function semHabLimite(cb) {
  if (cb.checked && document.querySelectorAll(".sw-hab:checked").length > 3) { cb.checked = false; toast("Elige hasta 3 hábitos en foco", true); }
}

/* -------- Cierre: pasos -------- */
function semCierrePaso(w) {
  const d = w.draft, r = ritualSemana(w.lunes) || {}, a = r.apertura || {};
  if (w.paso === 0) {
    const prios = a.prioridades || [];
    if (!prios.length) return `<div class="empty">No definiste prioridades para esta semana. La próxima, elígelas al planificarla 🎯</div>`;
    const segB = (id, v, label, cur) => `<button type="button" class="${cur === v ? "is-active" : ""}" data-v="${v}" onclick="segPick(this,'sc-e-${id}')">${label}</button>`;
    return prios.map(p => {
      const e = d.evaluacion[p.id] || "no", obj = objetivoDe(p.objId);
      return `<div class="mes-obj">
        <div class="text-sm" style="font-weight:600">${AMBITOS[ambitoDe(p)].icon} ${escapeHtml(p.texto)}</div>
        ${obj ? `<div class="text-xs muted">↳ 🎯 ${escapeHtml(obj.texto)}</div>` : ""}
        <div class="seg">${segB(p.id, "cumplida", "✅ Cumplida", e)}${segB(p.id, "parcial", "◐ Parcial", e)}${segB(p.id, "no", "✕ No", e)}</div>
        <input type="hidden" id="sc-e-${p.id}" value="${e}"></div>`;
    }).join("");
  }
  if (w.paso === 1) return resumenSemanaHtml(resumenSemanaRitual(w.lunes, STATE, d.evaluacion), resumenSemanaRitual(agSumar(w.lunes, -7)));
  if (w.paso === 2) {
    const items = pendientesAnteriores(STATE, todayISO(), 30);
    const hoyPend = tareasDelDia(todayISO()).some(tareaAbierta);
    if (!items.length) return `<div class="empty">No tienes tareas pendientes de días anteriores. ¡Semana al día! 🎉</div>
      ${hoyPend ? `<p class="text-xs muted mt-8">Las de hoy las decides en tu cierre del día.</p>` : ""}`;
    const cfg = cfgTriageSemana(w.lunes);
    return `<p class="text-sm muted" style="margin-bottom:12px">Migración semanal, como en tu agenda de papel: decide qué pasa con cada tarea abierta. Por defecto pasan ${cfg.mover === "semana" ? "al lunes de la próxima semana" : "a hoy"}.</p>
      ${triageHtml(items, cfg)}
      ${hoyPend ? `<p class="text-xs muted mt-8">Las de hoy las decides en tu cierre del día.</p>` : ""}`;
  }
  if (w.paso === 3) {
    const premio = (r.plan || {}).premio;
    const segP = (v, label) => `<button type="button" class="${d.premioGanado === v ? "is-active" : ""}" data-v="${v ? 1 : 0}" onclick="segPick(this,'sc-premio')">${label}</button>`;
    return `<div class="field"><label>🌟 Lo mejor de la semana</label><textarea class="input" id="sc-mejor">${escapeHtml(d.mejor)}</textarea></div>
      <div class="field"><label>🧠 Qué aprendiste</label><textarea class="input" id="sc-apr">${escapeHtml(d.aprendizaje)}</textarea></div>
      <div class="field"><label>🔧 Qué ajustarías la próxima semana</label><input class="input" id="sc-ajustar" value="${escapeAttr(d.ajustar)}" placeholder="Lo verás al planificar la próxima"></div>
      ${premio ? `<div class="field"><label>🏆 Tu premio: ${escapeHtml(premio)} · ¿Te lo ganaste?</label>
        <div class="seg">${segP(true, "🎉 ¡Sí!")}${segP(false, "Esta vez no")}</div>
        <input type="hidden" id="sc-premio" value="${d.premioGanado == null ? "" : d.premioGanado ? 1 : 0}"></div>` : ""}`;
  }
  return `<div class="field"><label>Nota de la semana: <b id="sc-nl" style="font-size:20px">${d.nota}</b>/10</label>
    <input type="range" min="1" max="10" step="1" id="sc-nota" value="${d.nota}" style="width:100%;accent-color:var(--cian)"
      oninput="document.getElementById('sc-nl').textContent=this.value"></div>
    <p class="text-xs muted">📔 El cierre queda también en tu Diario.${w.siguiente ? " Al guardar, sigues con la planificación de la próxima semana." : ""}</p>`;
}

/* Lee los campos del paso actual al borrador */
function semWizLeer() {
  const w = SEM_WIZ; if (!w) return;
  const d = w.draft, el = id => document.getElementById(id);
  if (w.tipo === "apertura") {
    if (w.paso === 1 && el("sw-foco")) {
      d.foco = val("sw-foco");
      d.prioridades = d.prioridades.map((p, i) => Object.assign({}, p, {
        id: val("sp-id-" + i) || p.id || "", texto: val("sp-t-" + i), ambito: val("sp-a-" + i) === "per" ? "per" : "pro",
        objId: el("sp-o-" + i) ? val("sp-o-" + i) : (p.objId || ""),
      }));
    }
    if (w.paso === 2) for (let i = 0; i < 7; i++) if (el("sw-amb-" + i)) d.ambDia[i] = val("sw-amb-" + i);
    if (w.paso === 3 && el("sw-premio")) {
      d.premio = val("sw-premio");
      d.habitosFoco = Array.from(document.querySelectorAll(".sw-hab:checked")).map(x => x.value).slice(0, 3);
    }
  } else {
    if (w.paso === 0) Object.keys(d.evaluacion).forEach(id => { if (el("sc-e-" + id)) d.evaluacion[id] = val("sc-e-" + id); });
    if (w.paso === 2) d.triage = leerTriage(el("sem-wiz"));
    if (w.paso === 3 && el("sc-mejor")) {
      d.mejor = val("sc-mejor"); d.aprendizaje = val("sc-apr"); d.ajustar = val("sc-ajustar");
      if (el("sc-premio")) { const v = val("sc-premio"); d.premioGanado = v === "" ? null : v === "1"; }
    }
    if (w.paso === 4 && el("sc-nota")) d.nota = parseNum(el("sc-nota").value) || 7;
  }
}
function semWizMover(delta) {
  semWizLeer();
  const w = SEM_WIZ; if (!w) return;
  w.paso = Math.max(0, Math.min(SEM_PASOS[w.tipo].length - 1, w.paso + delta));
  renderSemWiz();
}
function semWizAdd(iso, i) {
  const w = SEM_WIZ; if (!w) return;
  semWizLeer();
  const txt = val("sw-in-" + i);
  if (!txt) return;
  (w.draft.nuevas[iso] = w.draft.nuevas[iso] || []).push({ txt, ambito: val("sw-amb-" + i) === "per" ? "per" : "pro" });
  w.focus = "sw-in-" + i;
  renderSemWiz();
}
function semWizDel(iso, k) {
  const w = SEM_WIZ; if (!w || !w.draft.nuevas[iso]) return;
  semWizLeer();
  w.draft.nuevas[iso].splice(k, 1);
  renderSemWiz();
}
function semWizDiaPrioridad(i, iso) {
  const w = SEM_WIZ; if (!w || !w.draft.prioridades[i]) return;
  semWizLeer();
  w.draft.prioridades[i].dia = iso;
  renderSemWiz();
}
function semWizFinish() {
  semWizLeer();
  const w = SEM_WIZ; if (!w) return;
  SEM_WIZ = null;
  if (w.tipo === "apertura") guardarSemApertura(w); else guardarSemCierre(w);
}

function guardarSemApertura(w) {
  const d = w.draft, now = Date.now(), hoy = todayISO();
  STATE.ritual.semanas = STATE.ritual.semanas || {};
  const rs = STATE.ritual.semanas[w.lunes] = STATE.ritual.semanas[w.lunes] || {};
  const prioridades = d.prioridades.filter(p => p.texto).map(p => ({
    id: p.id || uid(), texto: p.texto, ambito: p.ambito === "per" ? "per" : "pro", objId: p.objId || "", dia: p.dia || "",
  }));
  // Cada prioridad con día queda como tarea de ese día (una sola vez). Si cambió de día
  // antes de llegar a él, la tarea anterior se quita: es replanificar, no postergar.
  prioridades.forEach(p => {
    if (!p.dia) return;
    for (let i = 0; i < 7; i++) {
      const iso = agSumar(w.lunes, i);
      if (iso === p.dia || iso <= hoy) continue;
      tareasDelDia(iso).filter(t => t.prioridad === p.id && tareaAbierta(t)).forEach(borrarTarea);
    }
    const ya = tareasDelDia(p.dia).some(t => t.prioridad === p.id || (t.txt === p.texto && !tareaMovida(t)));
    if (!ya) nuevaTarea(STATE, p.dia, { txt: p.texto, ambito: p.ambito, prioridad: p.id });
  });
  Object.keys(d.nuevas).forEach(iso => d.nuevas[iso].forEach(t => nuevaTarea(STATE, iso, { txt: t.txt, ambito: t.ambito })));
  rs.apertura = { foco: d.foco, prioridades, habitosFoco: d.habitosFoco.slice(0, 3), ts: now };
  if (((rs.plan || {}).premio || "") !== d.premio) rs.plan = { premio: d.premio, ts: now };
  const pagado = registrarMovimiento("ritual-semana-apertura:" + w.lunes, 75, 75, "Apertura de semana", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(`📅 Semana planificada${pagado ? " · +75 ⭐" : ""}. ¡A por ella!`);
}

function guardarSemCierre(w) {
  const d = w.draft, now = Date.now(), hoy = todayISO();
  const n = d.triage && d.triage.length ? aplicarTriage(STATE, d.triage, cfgTriageSemana(w.lunes)) : null;
  STATE.ritual.semanas = STATE.ritual.semanas || {};
  const rs = STATE.ritual.semanas[w.lunes] = STATE.ritual.semanas[w.lunes] || {};
  rs.cierre = {
    evaluacion: Object.assign({}, d.evaluacion), mejor: d.mejor, aprendizaje: d.aprendizaje, ajustar: d.ajustar,
    premioGanado: d.premioGanado, nota: d.nota, numeros: resumenSemanaRitual(w.lunes, STATE, d.evaluacion), ts: now,
  };
  // Entrada en el Diario (una por semana, actualizable)
  STATE.vida.diario = STATE.vida.diario || [];
  let e = STATE.vida.diario.find(x => x.fromRitualSemana && x.semana === w.lunes);
  if (!e) { e = { id: uid(), fromRitualSemana: true, tipo: "semana", semana: w.lunes }; STATE.vida.diario.push(e); }
  const dom = agSumar(w.lunes, 6);
  Object.assign(e, {
    fecha: hoy < dom ? hoy : dom, nota: d.nota,
    texto: [d.aprendizaje && "Aprendizaje: " + d.aprendizaje, d.ajustar && "Para ajustar: " + d.ajustar].filter(Boolean).join(" · "),
    gratitud: d.mejor, ts: now,
  });
  const pagado = registrarMovimiento("ritual-semana-cierre:" + w.lunes, 75, 75, "Cierre de semana", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti) launchConfetti();
  const extra = n ? textoTriage(n) : "";
  toast(`📅 Semana cerrada · ${d.nota}/10${pagado ? " · +75 ⭐" : ""}${extra ? " · " + extra : ""}`);
  if (w.siguiente && !semanaAbierta(w.siguiente)) openSemApertura(w.siguiente, { desdeCierre: true });
}

/* ============================================================
   Vista "Semana" dentro de Ritual
   ============================================================ */
/* Avance de un hábito en la semana: { hecho, meta, texto } */
function habSemana(h, lunes) {
  const f = hmFreq(h), dom = agSumar(lunes, 6);
  if (f.tipo === "mensual") { const p = progresoPeriodoActual(h); return { hecho: p.hecho, meta: p.meta, texto: p.texto }; }
  let meta = 0;
  if (f.tipo === "semanal") meta = f.veces;
  else for (let x = hmMax(lunes, hmCreado(h)); x <= dom; x = hmAdd(x, 1)) if (hmProgramado(h, x)) meta++;
  const hecho = hmContar(h, lunes, dom, undefined, f.tipo === "dias");
  return { hecho, meta, texto: `${hecho}/${meta} esta semana` };
}
function guardarDiaRitualSemanal(dia) {
  STATE.settings.ritualSemanal = { dia: dia === 1 ? 1 : 0, ts: Date.now() };
  saveState(); rerender();
  toast(`Tu ritual semanal queda el ${dia === 1 ? "lunes" : "domingo"}`);
}
/* Prioridades de la semana en la apertura del día (cascada semana → día) */
function prioridadesSemanaMini() {
  const L = agLunes(todayISO()), a = (ritualSemana(L) || {}).apertura;
  if (!a || !(a.prioridades || []).length) return "";
  return `<div class="sem-mini"><div class="text-xs muted">📅 Prioridades de la semana${a.foco ? ` · foco: <b>${escapeHtml(a.foco)}</b>` : ""}</div>
    <div class="row-wrap mt-8" style="gap:6px">${a.prioridades.map(p => `<span class="chip ${prioridadHecha(p, L) ? "chip--done" : ""}">🎯 ${escapeHtml(p.texto)}</span>`).join("")}</div></div>`;
}

/* ============================================================
   Pantalla Semana (una sola): plan de la semana arriba, los 7 días abajo.
   Reemplaza al Planificador y a Ritual → Semana (que muestra lo mismo).
   ============================================================ */
function renderRitualSemana() { return renderSemana(); }
function renderSemana() {
  const hoy = todayISO(), actual = agLunes(hoy);
  const L = SEM_LUNES || actual, esActual = L === actual;
  const prevL = agSumar(L, -7), sigL = agSumar(L, 7);
  const fechas = Array.from({ length: 7 }, (_, i) => agSumar(L, i));
  const r = ritualSemana(L) || {}, a = r.apertura, plan = r.plan || {}, c = r.cierre;

  // Acciones según la semana que se mira
  const acciones = [];
  if (semanaPlanificable(L)) acciones.push(`<button class="btn ${a ? "btn--soft" : "btn--primary"}" data-action="sem-open" data-lunes="${L}">${a ? "Editar plan" : "📅 Planificar la semana"}</button>`);
  if (semanaCerrable(L)) acciones.push(`<button class="btn ${c ? "btn--soft" : "btn--primary"}" data-action="sem-close" data-lunes="${L}">${c ? "Editar cierre" : "🌙 Cerrar la semana"}</button>`);
  if (esActual && !semanaCerrada(prevL) && semanaConActividad(prevL)) acciones.push(`<button class="btn-ghost" data-action="sem-close" data-lunes="${prevL}">Cerrar la semana anterior</button>`);
  if (esActual && semanaPlanificable(sigL)) acciones.push(`<button class="btn-ghost" data-action="sem-open" data-lunes="${sigL}">${semanaAbierta(sigL) ? "Editar plan de la próxima" : "Planificar la próxima"}</button>`);

  const ev = (c && c.evaluacion) || {};
  const estadoP = p => ev[p.id] === "cumplida" ? '<span class="chip chip--done">✅ cumplida</span>'
    : ev[p.id] === "parcial" ? '<span class="chip chip--coral">◐ parcial</span>'
    : ev[p.id] === "no" ? '<span class="chip">✕ no</span>'
    : prioridadHecha(p, L) ? '<span class="chip chip--done">✓ hecha</span>'
    : p.dia ? `<span class="chip">${diaCorto(p.dia)}</span>` : "";
  const prios = a && (a.prioridades || []).length ? a.prioridades.map(p => {
    const obj = objetivoDe(p.objId);
    return `<div class="item-row"><div class="item-row__main"><div class="item-row__title">🎯 ${escapeHtml(p.texto)}</div>
      ${obj ? `<div class="item-row__sub">↳ ${escapeHtml(obj.texto)}</div>` : ""}</div>${estadoP(p)}</div>`;
  }).join("") : `<div class="empty">${semanaPlanificable(L) ? "Elige tu foco y tus 3 prioridades al planificar la semana (+75 ⭐)." : "Esta semana no tuvo plan."}</div>`;

  const habs = ((a && a.habitosFoco) || []).map(id => STATE.habitos.defs.find(h => h.id === id)).filter(Boolean);
  const habsHtml = habs.length ? habs.map(h => {
    const p = habSemana(h, L), pct = p.meta ? Math.min(100, Math.round((p.hecho / p.meta) * 100)) : 0;
    return `<div class="pilar-row"><span class="text-sm" style="width:130px">${h.icon} ${escapeHtml(h.nombre)}</span>
      <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div><span class="chip">${p.hecho}/${p.meta}</span></div>`;
  }).join("") : `<div class="empty">Elige hasta 3 hábitos en foco al planificar la semana.</div>`;

  const cols = fechas.map((iso, i) => {
    const d = agDate(iso), tareas = tareasDelDia(iso), inputId = `sem-${i}`;
    return `<div class="week-col card ${iso === hoy ? "is-hoy" : ""}">
      <div class="flex-between"><div class="card__title" style="font-size:14px">${DIAS_SEMANA[i]}</div>
        <span class="dia-badge">${d.getDate()}/${MESES_CORTO[d.getMonth()]}</span></div>
      <div class="mt-8">${tareas.length ? tareas.map(t => tareaRowHtml(t, iso, { compacto: true })).join("") : '<div class="text-xs muted" style="padding:6px">Sin tareas.</div>'}</div>
      <div class="row mt-8">${ambitoPicker(inputId + "-amb", "per", true)}<input class="input" id="${inputId}" placeholder="Nueva tarea..." style="padding:8px 10px">
        <button class="btn btn--cian" data-action="tarea-add" data-fecha="${iso}" data-input="${inputId}" data-amb="${inputId}-amb" style="padding:8px 12px">+</button></div>
    </div>`;
  }).join("");

  const dia = diaRitualSemanal();
  const segDia = [[0, "Domingo"], [1, "Lunes"]].map(([v, l]) => `<button class="${dia === v ? "is-active" : ""}" data-action="sem-dia" data-v="${v}">${l}</button>`).join("");
  const hist = Object.keys(STATE.ritual.semanas || {}).filter(k => k < actual && (STATE.ritual.semanas[k].apertura || STATE.ritual.semanas[k].cierre))
    .sort().reverse().slice(0, 8).map(k => {
      const x = STATE.ritual.semanas[k];
      return `<div class="item-row"><div class="item-row__main"><div class="item-row__title">${rangoSemanaCorto(k)}${x.apertura && x.apertura.foco ? ` · <span class="hl-cian">${escapeHtml(x.apertura.foco)}</span>` : ""}</div>
        <div class="item-row__sub">${x.cierre && x.cierre.mejor ? escapeHtml(x.cierre.mejor) : ""}</div></div>
        ${x.apertura ? '<span class="chip chip--done">Planificada ✓</span>' : ""} ${x.cierre ? `<span class="chip chip--done">Cerrada ✓ ${x.cierre.nota}/10</span>` : ""}</div>`;
    }).join("");

  return `
  <div class="sem-nav">
    <button class="icon-btn" data-action="sem-nav" data-dir="-1" aria-label="Semana anterior">‹</button>
    <div class="sem-nav__t"><b>${esActual ? "Esta semana" : L < actual ? "Semana pasada" : "Semana próxima"}</b> · ${rangoSemanaTxt(L)}</div>
    <button class="icon-btn" data-action="sem-nav" data-dir="1" aria-label="Semana siguiente">›</button>
    ${esActual ? "" : `<button class="btn-ghost" data-action="sem-nav" data-dir="0">Ir a esta semana</button>`}
  </div>
  <div class="card mt-16" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">📅 Plan de la semana</div>
        <div class="big-num">${a && a.foco ? escapeHtml(a.foco) : "Sin foco definido"}</div>
        ${plan.premio && c && c.premioGanado ? `<div class="text-sm soft mt-8">🏆 Premio ganado: ${escapeHtml(plan.premio)} 🎉</div>` : ""}</div>
      ${acciones.length ? `<div class="row-wrap">${acciones.join("")}</div>` : ""}
    </div>
  </div>
  <div class="grid grid-2 mt-16">
    <div class="card"><div class="card__title">🎯 Prioridades</div><div class="mt-8">${prios}</div></div>
    <div class="card"><div class="card__title">📊 ${esActual ? "Esta semana hasta hoy" : "Números de la semana"}</div>
      <div class="mt-16">${resumenSemanaHtml(resumenSemanaRitual(L, STATE, c ? ev : null), resumenSemanaRitual(prevL))}</div></div>
  </div>
  <div class="week-scroll mt-24">${cols}</div>
  <p class="text-xs muted mt-8">Signos: ✓ hecha · &gt; movida a otro día · &lt; programada · @ delegada · ✕ soltada · ↪ n veces postergada.</p>
  <div class="grid grid-2 mt-16">
    <div class="card"><div class="card__title">✨ Hábitos en foco</div><div class="mt-16">${habsHtml}</div></div>
    <div class="card"><div class="card__title">🏆 Tu premio de la semana</div>
      <input class="input mt-16" id="sem-premio" value="${escapeAttr(plan.premio || "")}" placeholder="¿Con qué te vas a premiar al cumplir?"
        onchange="guardarPremioSemana('${L}', this.value)"></div>
  </div>
  <details class="hb-more mt-16"><summary>⚙️ Tu día de ritual semanal${hist ? " y semanas anteriores" : ""}</summary>
    <div class="card mt-16"><div class="seg" style="display:inline-flex">${segDia}</div>
      <p class="text-xs muted mt-16">Ese día cierras la semana y planificas la siguiente, todo seguido. Puedes cerrar desde el viernes en la tarde.
        ${STATE.settings.notif && STATE.settings.notif.enabled ? `Te avisaremos el ${dia ? "lunes en la mañana" : "domingo en la noche"}${dia ? " y el martes" : " y el lunes en la mañana"} si aún no planificas.` : "Activa las notificaciones para que te lo recordemos."}</p></div>
    ${hist ? `<div class="card mt-16">${hist}</div>` : ""}
  </details>`;
}

/* Insignias: semanas "redondas" (planificadas y cerradas) */
function g_semanasRedondas(s) {
  return Object.keys((s.ritual && s.ritual.semanas) || {}).filter(k => s.ritual.semanas[k].apertura && s.ritual.semanas[k].cierre).sort();
}
function g_semanasSeguidas(s, n) {
  const set = new Set(g_semanasRedondas(s));
  return Array.from(set).some(k => { for (let i = 1; i < n; i++) if (!set.has(agSumar(k, 7 * i))) return false; return true; });
}
