/* ============================================================
   RUMBO · Módulos de vida: Diario, Ideas, Relaciones, Listas
   ============================================================ */

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

function fechaCorta(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
function diasDesde(iso) {
  if (!iso) return null;
  const a = new Date(iso + "T00:00:00"), b = new Date();
  return Math.floor((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - a) / 86400000);
}
function diasHastaCumple(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < hoy) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - hoy) / 86400000);
}

/* ============================================================
   DIARIO + estado de ánimo
   ============================================================ */
/* Estado de la vista (no se guarda): mes que se mira, día abierto y búsqueda */
let DIARIO_MES = null, DIARIO_SEL = null, DIARIO_BUSCA = "";
const ANIMO_COLOR = ["#E8563A", "#F59E5B", "#C9B458", "#7CC4A0", "#2BB6A5"];
const ANIMO_TXT = ["Difícil", "Regular", "Normal", "Bien", "Muy bien"];

/* Todos los días con algo en el diario (ritual abierto/cerrado o entrada manual), del más nuevo al más viejo */
function diarioFechas() {
  const set = new Set();
  (STATE.vida.diario || []).forEach(e => e.fecha && set.add(e.fecha));
  Object.keys(STATE.ritual.dias || {}).forEach(f => { if (STATE.ritual.dias[f] && STATE.ritual.dias[f].hecho) set.add(f); });
  return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
}
function diarioAnimo(fecha) {
  const e = (STATE.vida.diario || []).find(x => x.fecha === fecha && x.mood);
  return e ? e.mood : null;
}
/* Lo que se muestra en la línea de un día: título y bajada */
function diarioResumen(fecha) {
  const r = STATE.ritual.dias[fecha], c = (r && r.cierre) || {};
  const es = (STATE.vida.diario || []).filter(e => e.fecha === fecha);
  const manual = es.find(e => !e.fromRitual && !e.fromRitualMes && !e.fromRitualSemana && !e.fromRitualTri);
  const sem = es.find(e => e.fromRitualSemana), mes = es.find(e => e.fromRitualMes), tri = es.find(e => e.fromRitualTri);
  const titulo = (r && (r.mision || r.sapo)) || (manual && (manual.titulo || manual.texto)) || (tri ? "Cierre de trimestre" : mes ? "Cierre de mes" : sem ? "Cierre de semana" : "Tu día");
  const gratitud = c.mejor || (es.find(e => e.gratitud) || {}).gratitud || "";
  const sub = gratitud || c.nota || (r ? (r.cerrado ? "Día cerrado" : "Día abierto") : "");
  return { titulo, sub, r, es, manual };
}
function diarioTexto(fecha) {
  const { r, es } = diarioResumen(fecha), c = (r && r.cierre) || {};
  return [r && r.mision, r && r.sapo, r && r.servir, c.mejor, c.nota, c.manana, ...es.map(e => [e.titulo, e.texto, e.gratitud].join(" "))].filter(Boolean).join(" ").toLowerCase();
}

function renderDiario() {
  const hoy = todayISO();
  if (!DIARIO_MES) DIARIO_MES = hoy.slice(0, 7);
  const [y, m] = DIARIO_MES.split("-").map(Number);
  const pref = DIARIO_MES + "-", nDias = daysInMonth(y, m - 1);
  const todas = diarioFechas(), delMes = todas.filter(f => f.startsWith(pref));
  const conDato = new Set(todas);

  // Mapa del ánimo: un cuadro por día con el color de cómo te sentiste
  const celdas = [];
  for (let k = 0; k < (new Date(y, m - 1, 1).getDay() + 6) % 7; k++) celdas.push(`<span class="dmap__c dmap__c--vacio"></span>`);
  for (let d = 1; d <= nDias; d++) {
    const iso = pref + String(d).padStart(2, "0"), a = diarioAnimo(iso);
    const cls = [iso === hoy ? "is-hoy" : "", iso === DIARIO_SEL ? "is-sel" : "", !a && conDato.has(iso) ? "is-dato" : "", iso > hoy ? "is-futuro" : ""].join(" ");
    celdas.push(conDato.has(iso) || iso === hoy
      ? `<button class="dmap__c ${cls}" data-action="diario-dia" data-iso="${iso}" ${a ? `style="background:${ANIMO_COLOR[a - 1]}"` : ""} aria-label="${d}${a ? ", " + ANIMO_TXT[a - 1] : ""}">${d}</button>`
      : `<span class="dmap__c ${cls}">${d}</span>`);
  }
  const animos = delMes.map(diarioAnimo).filter(Boolean);
  const prom = animos.length ? (animos.reduce((x, v) => x + v, 0) / animos.length).toFixed(1).replace(".", ",") : "—";
  const nombreMes = `${MESES[m - 1]} ${y}`;

  const mapa = `<div class="card dmap">
    <div class="dmap__nav"><button class="icon-btn" data-action="diario-mes" data-dir="-1" aria-label="Mes anterior">‹</button>
      <b>${nombreMes}</b><button class="icon-btn" data-action="diario-mes" data-dir="1" aria-label="Mes siguiente" ${DIARIO_MES >= hoy.slice(0, 7) ? "disabled" : ""}>›</button></div>
    <div class="dmap__g dmap__dow">${["L", "M", "M", "J", "V", "S", "D"].map(x => `<span>${x}</span>`).join("")}</div>
    <div class="dmap__g">${celdas.join("")}</div>
    <div class="dmap__ley">${ANIMO_COLOR.map((c, i) => `<i style="background:${c}" title="${ANIMO_TXT[i]}"></i>`).join("")}<span>tu ánimo de cada día</span></div>
  </div>
  <div class="dnums">
    <div><b>${delMes.length}</b><span>días</span></div>
    <div><b>${prom}</b><span>ánimo</span></div>
    <div><b>${computeClosedStreak()}</b><span>seguidos</span></div>
  </div>
  <div class="dbusca"><input class="input" id="diario-busca" placeholder="Buscar en tu diario…" value="${escapeAttr(DIARIO_BUSCA)}" oninput="diarioBuscar(this.value)" aria-label="Buscar en tu diario"></div>`;

  return `<div class="diario-layout"><div class="diario-izq">${mapa}</div>
    <div id="diario-lista">${diarioListaHtml()}</div></div>`;
}
function diarioListaHtml() {
  const hoy = todayISO(), q = DIARIO_BUSCA.trim().toLowerCase();
  const todas = diarioFechas();
  const fechas = q ? todas.filter(f => diarioTexto(f).includes(q)) : todas.filter(f => f.startsWith(DIARIO_MES + "-"));
  if (!todas.length) return `<div class="card"><div class="empty">Tu diario se llena solo al <b>cerrar tu día</b>: ahí registras tu ánimo, lo que agradeces y tu reflexión. <a href="#ritual">Ir al ritual →</a></div></div>`;
  if (!fechas.length) return `<div class="card"><div class="empty">${q ? "No encontré nada con “" + escapeHtml(DIARIO_BUSCA) + "”." : "Sin días registrados este mes."}</div></div>`;
  return `${q ? `<div class="text-sm muted" style="margin:0 4px 8px">${fechas.length} día${fechas.length === 1 ? "" : "s"} con “${escapeHtml(DIARIO_BUSCA)}”</div>` : ""}
    <div class="card dlista">${fechas.map(f => {
      const d = agDate(f), a = diarioAnimo(f), { titulo, sub } = diarioResumen(f), abierto = f === DIARIO_SEL;
      return `<button class="dfila${abierto ? " is-abierta" : ""}" data-action="diario-dia" data-iso="${f}" aria-expanded="${abierto}">
        <span class="dfila__f"><b>${d.getDate()}</b><span>${q ? MESES_CORTO[d.getMonth()] : DIAS_SEMANA[(d.getDay() + 6) % 7].slice(0, 3)}</span></span>
        <i class="dfila__a" style="background:${a ? ANIMO_COLOR[a - 1] : "var(--surface-3)"}"></i>
        <span class="dfila__t"><span class="dfila__m">${escapeHtml(titulo)}</span><span class="dfila__s">${escapeHtml(f === hoy && !sub ? "Hoy" : sub)}</span></span>
        <span class="dfila__ch" aria-hidden="true">${abierto ? "✕" : "›"}</span></button>
        ${abierto ? `<div class="ddet">${diarioDetalle(f)}</div>` : ""}`;
    }).join("")}</div>`;
}
function diarioBuscar(v) {
  DIARIO_BUSCA = v || "";
  const el = document.getElementById("diario-lista");
  if (el) el.innerHTML = diarioListaHtml();
}
function diarioElegir(iso) {
  DIARIO_SEL = DIARIO_SEL === iso ? null : iso;
  if (iso && !DIARIO_BUSCA) DIARIO_MES = iso.slice(0, 7);
  rerender();
}
function diarioMover(dir) {
  const [y, m] = DIARIO_MES.split("-").map(Number), f = new Date(y, m - 1 + dir, 1);
  DIARIO_MES = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`; DIARIO_SEL = null; rerender();
}

/* Detalle de un día abierto en la lista: todo lo que registraste, sin íconos de más */
function diarioDetalle(fecha) {
  const { r, es, manual } = diarioResumen(fecha), c = (r && r.cierre) || {};
  const a = diarioAnimo(fecha), kv = (k, v) => v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : "";
  const out = [];
  if (a) out.push(kv("Ánimo", `${MOODS[a - 1]} ${ANIMO_TXT[a - 1]}`));
  if (r) {
    if (r.mision) out.push(kv("Misión", escapeHtml(r.mision) + (r.cerrado ? " " + cumpliChip(c.mision) : "")));
    if (r.sapo) out.push(kv(BOCADO.corto, escapeHtml(r.sapo) + (r.cerrado ? (c.sapo ? " ✓" : " · pendiente") : "")));
    out.push(kv("Energía", r.cerrado ? `${r.energia || "—"} → ${c.energia || "—"}` : `${r.energia || "—"}`));
    if (r.pilar) out.push(kv("Pilar", escapeHtml(r.pilar)));
    if (r.servir) out.push(kv("Serví a", escapeHtml(r.servir)));
  }
  const grat = c.mejor || (es.find(e => e.gratitud && !e.fromRitualMes && !e.fromRitualSemana && !e.fromRitualTri) || {}).gratitud;
  if (grat) out.push(kv("Gratitud", escapeHtml(grat)));
  if (c.manana) out.push(kv("Para mañana", escapeHtml(c.manana)));
  const nota = c.nota || (manual && manual.texto);
  if (nota) out.push(kv("Nota", escapeHtml(nota)));
  const cierre = (e, nombre, lo) => e ? kv(nombre, `${e.nota != null ? e.nota + "/10" : ""}${e.gratitud ? " · " + lo + ": " + escapeHtml(e.gratitud) : ""}${e.texto ? "<br><span class='muted'>" + escapeHtml(e.texto) + "</span>" : ""}`) : "";
  out.push(cierre(es.find(e => e.fromRitualSemana), "Cierre de semana", "lo mejor"));
  out.push(cierre(es.find(e => e.fromRitualMes), "Cierre de mes", "lo mejor"));
  out.push(cierre(es.find(e => e.fromRitualTri), "Cierre de trimestre", "logro"));
  const acciones = [];
  if (r && r.cerrado && fecha >= agSumar(todayISO(), -7) && typeof reabrible === "function") acciones.push(`<a class="card__hint" href="#ritual">Editar desde el Ritual ›</a>`);
  if (!r && manual) acciones.push(`<button class="btn-ghost" data-action="diario-del" data-id="${manual.id}">🗑 Borrar</button>`);
  return out.join("") + (acciones.length ? `<div class="row mt-8" style="gap:10px">${acciones.join("")}</div>` : "");
}

function diarioDayCard(fecha) {
  const S = STATE;
  const r = S.ritual.dias[fecha];
  const es = (S.vida.diario || []).filter(e => e.fecha === fecha);
  const moodE = es.find(e => e.mood);
  const mood = moodE ? moodE.mood : null;
  const c = (r && r.cierre) || {};
  const d = new Date(fecha + "T00:00:00");
  const dow = DIAS_SEMANA[(d.getDay() + 6) % 7].slice(0, 3);
  const fechaTxt = `${dow} ${d.getDate()} · ${MESES_CORTO[d.getMonth()]}`;
  const open = !!BITA_OPEN[fecha];
  const dash = "<span class='muted'>—</span>";

  const chip = r ? (r.cerrado ? `<span class="chip chip--done">🌙 Cerrado</span>` : `<span class="chip chip--coral">🌅 Abierto</span>`) : "";
  const manual = es.find(e => !e.fromRitual && !e.fromRitualMes && !e.fromRitualSemana && !e.fromRitualTri);
  const triE = es.find(e => e.fromRitualTri);
  const mesE = es.find(e => e.fromRitualMes);
  const semE = es.find(e => e.fromRitualSemana);
  const gratitud = (r ? c.mejor : "") || (es.find(e => e.gratitud && !e.fromRitualMes && !e.fromRitualSemana && !e.fromRitualTri) || {}).gratitud || "";
  const nota = (r ? c.nota : "") || (manual && manual.texto) || "";

  const rows = [];
  if (r) {
    rows.push(`<div class="bita-row"><span class="bita-k">🎯 Misión</span><span class="bita-v">${r.mision ? escapeHtml(r.mision) : dash} ${r.cerrado ? cumpliChip(c.mision) : ""}</span></div>`);
    rows.push(`<div class="bita-row"><span class="bita-k">${BOCADO.emoji} ${BOCADO.corto}</span><span class="bita-v">${r.sapo ? escapeHtml(r.sapo) : dash} ${r.cerrado ? (c.sapo ? "<span class='chip chip--done'>hecho</span>" : "<span class='chip'>pendiente</span>") : ""}</span></div>`);
    const energia = r.cerrado ? `${r.energia || "—"} → ${c.energia || "—"}` : `${r.energia || "—"}`;
    rows.push(`<div class="bita-row"><span class="bita-k">⚡ Energía</span><span class="bita-v">${energia} <span class="muted text-xs">/ 5</span> ${r.pilar ? `<span class="chip chip--cian">${escapeHtml(r.pilar)}</span>` : ""}</span></div>`);
  }
  if (mesE) {
    const { y: my, m: mm } = mesDeKey(mesE.mes);
    rows.unshift(`<div class="bita-row"><span class="bita-k">🗓️ Cierre de mes</span><span class="bita-v"><b>${MESES[mm]} ${my}</b> <span class="chip chip--done">${mesE.nota}/10</span></span></div>`
      + (mesE.gratitud ? `<div class="bita-row"><span class="bita-k">🌟 Lo mejor</span><span class="bita-v">${escapeHtml(mesE.gratitud)}</span></div>` : "")
      + (mesE.texto ? `<div class="bita-row"><span class="bita-k">🧠 Reflexión</span><span class="bita-v">${escapeHtml(mesE.texto)}</span></div>` : ""));
  }
  if (triE) {
    const t = triDeKey(triE.trimestre);
    rows.unshift(`<div class="bita-row"><span class="bita-k">🧭 Cierre de trimestre</span><span class="bita-v"><b>${triNombre(t.y, t.q)}</b> <span class="chip chip--done">${triE.nota}/10</span></span></div>`
      + (triE.gratitud ? `<div class="bita-row"><span class="bita-k">🏆 Logro</span><span class="bita-v">${escapeHtml(triE.gratitud)}</span></div>` : "")
      + (triE.texto ? `<div class="bita-row"><span class="bita-k">🧠 Reflexión</span><span class="bita-v">${escapeHtml(triE.texto)}</span></div>` : ""));
  }
  if (semE) {
    rows.unshift(`<div class="bita-row"><span class="bita-k">📅 Cierre de semana</span><span class="bita-v"><b>${rangoSemanaCorto(semE.semana)}</b> <span class="chip chip--done">${semE.nota}/10</span></span></div>`
      + (semE.gratitud ? `<div class="bita-row"><span class="bita-k">🌟 Lo mejor</span><span class="bita-v">${escapeHtml(semE.gratitud)}</span></div>` : "")
      + (semE.texto ? `<div class="bita-row"><span class="bita-k">🧠 Reflexión</span><span class="bita-v">${escapeHtml(semE.texto)}</span></div>` : ""));
  }
  if (nota) rows.push(`<div class="bita-row"><span class="bita-k">📝 Nota</span><span class="bita-v">${escapeHtml(nota)}</span></div>`);
  if (gratitud) rows.push(`<div class="bita-row"><span class="bita-k">🙏 Gratitud</span><span class="bita-v">${escapeHtml(gratitud)}</span></div>`);

  const extras = [];
  if (r) {
    if (c.manana) extras.push(`<div class="bita-row"><span class="bita-k">🌱 Para mañana</span><span class="bita-v">${escapeHtml(c.manana)}</span></div>`);
    if (r.servir) extras.push(`<div class="bita-row"><span class="bita-k">🙌 Serví a</span><span class="bita-v">${escapeHtml(r.servir)}</span></div>`);
    if (r.proyectos && r.proyectos.length) extras.push(`<div class="bita-row"><span class="bita-k">📂 Proyectos</span><span class="bita-v">${r.proyectos.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join(" ")}</span></div>`);
  }
  const delBtn = (!r && manual) ? `<button class="icon-btn" data-action="diario-del" data-id="${manual.id}">🗑</button>` : "";

  return `<div class="card bita-day">
    <div class="bita-day__head">
      <div class="row" style="gap:10px">${mood ? `<span style="font-size:22px">${MOODS[mood - 1]}</span>` : ""}<div class="bita-date">${fechaTxt}</div></div>
      <div class="row" style="gap:8px">${chip}${delBtn}</div>
    </div>
    ${rows.join("")}
    ${open ? extras.join("") : ""}
    ${extras.length ? `<button class="bita-more" data-action="bita-toggle" data-iso="${fecha}">${open ? "▲ Ver menos" : "▼ Ver más"}</button>` : ""}
  </div>`;
}
function moodPick(btn) {
  document.getElementById("di-mood").value = btn.dataset.v;
  document.querySelectorAll("#di-moods .mood-btn").forEach(b => b.classList.remove("is-on"));
  btn.classList.add("is-on");
}

/* ============================================================
   IDEAS (bandeja de entrada / captura rápida)
   ============================================================ */
function renderIdeas() {
  const ideas = STATE.vida.ideas;
  const pend = ideas.filter(i => !i.hecha);
  const done = ideas.filter(i => i.hecha);
  const row = i => `<div class="item-row">
    <span class="check ${i.hecha ? "is-on" : ""}" data-action="idea-toggle" data-id="${i.id}">${i.hecha ? "✓" : ""}</span>
    <div class="item-row__main"><div class="item-row__title ${i.hecha ? "strike" : ""}">${escapeHtml(i.texto)}</div></div>
    <button class="icon-btn" data-action="idea-del" data-id="${i.id}">🗑</button></div>`;
  return `
  <div class="card">
    <div class="card__head"><div class="card__title">💡 Captura rápida</div><span class="chip">${pend.length} pendientes</span></div>
    <div class="row"><input class="input" id="idea-input" placeholder="Anota una idea o pendiente y suéltalo aquí...">
      <button class="btn btn--cian" data-action="idea-add" data-input="idea-input">+</button></div>
    <div class="mt-16">${pend.length ? pend.map(row).join("") : '<div class="empty">Bandeja vacía. ✨</div>'}</div>
    ${done.length ? `<div class="divider"></div><div class="text-xs muted mb-0" style="margin-bottom:8px">Procesadas</div>${done.map(row).join("")}` : ""}
  </div>`;
}

/* ============================================================
   RELACIONES (cumpleaños + último contacto)
   ============================================================ */
const REL_AV_COLORS = ["#17C3B2", "#FF6B4A", "#7C5CFC", "#F5A623", "#3AAED8", "#E056A0", "#4CAF7D"];
function relIniciales(nombre) {
  const parts = (nombre || "?").trim().split(/\s+/);
  return ((parts[0][0] || "") + (parts[1] ? parts[1][0] : "")).toUpperCase();
}
function relColor(nombre) {
  let h = 0; for (const c of (nombre || "")) h += c.charCodeAt(0);
  return REL_AV_COLORS[h % REL_AV_COLORS.length];
}
function relFreqLabel(f) {
  return f === 0 ? "sin recordatorio" : f === 7 ? "cada semana" : f === 14 ? "cada 2 semanas"
    : f === 30 ? "cada mes" : f === 90 ? "cada 3 meses" : "cada " + f + " días";
}
// "Deuda" de contacto: días transcurridos menos la frecuencia deseada. >=0 => toca escribir.
function relDeuda(p) {
  const f = p.frecuencia ?? 30;
  if (f === 0) return -9999;                 // sin recordatorio: nunca "atrasado"
  const dc = diasDesde(p.ultimoContacto);
  if (dc == null) return 9999;               // sin registro: máxima prioridad
  return dc - f;
}

function renderRelaciones() {
  const gente = STATE.vida.relaciones.slice();
  if (!gente.length) {
    return `
    <div class="flex-between"><div class="card__title" style="margin:0">Tu gente</div>
      <button class="btn btn--primary" data-action="rel-add">+ Agregar persona</button></div>
    <div class="card mt-16"><div class="empty">Agrega a las personas que quieres cuidar. Rumbo te avisará cuándo hace tiempo que no hablan y cuándo se acerca un cumpleaños.</div></div>`;
  }

  // Necesitan atención (atrasados) y próximos cumpleaños
  const atn = gente.filter(p => relDeuda(p) >= 0).sort((a, b) => relDeuda(b) - relDeuda(a));
  const cumples = gente.filter(p => p.cumple && diasHastaCumple(p.cumple) <= 60)
    .sort((a, b) => diasHastaCumple(a.cumple) - diasHastaCumple(b.cumple));

  const summary = `<div class="grid grid-2 mt-16">
    <div class="card">
      <div class="card__title" style="font-size:15px">⚠️ Necesitan atención</div>
      ${atn.length ? atn.slice(0, 6).map(p => {
        const dc = diasDesde(p.ultimoContacto);
        return `<div class="rel-attn-row">
          <span class="rel-attn-name">${escapeHtml(p.nombre)}</span>
          <span class="text-xs muted">${dc == null ? "sin registro" : "hace " + dc + " d"}</span>
          <button class="btn btn--soft" style="padding:5px 11px;font-size:12.5px" data-action="rel-contacto" data-id="${p.id}">Hablé hoy</button>
        </div>`;
      }).join("") : `<div class="text-sm soft mt-8">Estás al día con todos 🎉</div>`}
    </div>
    <div class="card">
      <div class="card__title" style="font-size:15px">🎂 Próximos cumpleaños</div>
      ${cumples.length ? cumples.slice(0, 6).map(p => {
        const dd = diasHastaCumple(p.cumple);
        return `<div class="rel-attn-row">
          <span class="rel-attn-name">${escapeHtml(p.nombre)}</span>
          <span class="text-xs ${dd <= 14 ? "hl-coral" : "muted"}">${dd === 0 ? "¡hoy! 🎉" : "en " + dd + " d"}</span></div>`;
      }).join("") : `<div class="text-sm soft mt-8">Sin cumpleaños en los próximos 2 meses.</div>`}
    </div>
  </div>`;

  // Tarjetas: primero quienes más necesitan atención
  const orden = gente.sort((a, b) => relDeuda(b) - relDeuda(a));
  const cards = orden.map(p => {
    const dCumple = diasHastaCumple(p.cumple);
    const dCont = diasDesde(p.ultimoContacto);
    const cumpleSoon = dCumple != null && dCumple <= 14;
    const deuda = relDeuda(p);
    const attn = deuda >= 0;
    const freq = p.frecuencia ?? 30;
    const status = freq === 0 ? "" : `<span class="rel-status rel-status--${attn ? "attn" : "ok"}">${attn ? "Toca escribir" : "Al día"}</span>`;
    return `<div class="card rel-card ${attn ? "rel-card--attn" : ""}">
      <div class="rel-head">
        <div class="rel-avatar" style="background:${relColor(p.nombre)}">${escapeHtml(relIniciales(p.nombre))}</div>
        <div class="rel-idbox"><div class="rel-name">${escapeHtml(p.nombre)}</div>
          <div class="text-xs muted">${escapeHtml(p.vinculo || "")}</div></div>
        <div class="rel-tools">
          <button class="icon-btn" data-action="rel-edit" data-id="${p.id}" title="Editar">✏️</button>
          <button class="icon-btn" data-action="rel-del" data-id="${p.id}" title="Eliminar">🗑</button></div>
      </div>
      <div class="divider" style="margin:12px 0"></div>
      ${p.cumple ? `<div class="text-sm ${cumpleSoon ? "hl-coral" : "soft"}">🎂 ${dCumple === 0 ? "¡Hoy es su cumple!" : "Cumple en " + dCumple + " días"}</div>` : ""}
      <div class="rel-line"><span class="text-sm soft">💬 ${dCont == null ? "Sin registro" : dCont === 0 ? "Hablaron hoy" : "Hace " + dCont + " días"}</span>${status}</div>
      ${freq !== 0 ? `<div class="text-xs muted mt-8">🔁 Meta: ${relFreqLabel(freq)}</div>` : ""}
      ${p.notas ? `<div class="rel-notas">${escapeHtml(p.notas)}</div>` : ""}
      <button class="btn btn--soft btn-block mt-8" data-action="rel-contacto" data-id="${p.id}">Hablé hoy</button>
    </div>`;
  }).join("");

  return `
  <div class="flex-between"><div class="card__title" style="margin:0">Tu gente</div>
    <button class="btn btn--primary" data-action="rel-add">+ Agregar persona</button></div>
  ${summary}
  <div class="section-title">Todas tus personas</div>
  <div class="grid grid-3">${cards}</div>`;
}
function openRelModal(id) {
  const p = id ? STATE.vida.relaciones.find(x => x.id === id) : null;
  const curFreq = p ? (p.frecuencia ?? 30) : 30;
  const freqs = [[7, "Cada semana"], [14, "Cada 2 semanas"], [30, "Cada mes"], [90, "Cada 3 meses"], [0, "Sin recordatorio"]];
  openModal(p ? "Editar persona" : "Nueva persona", `
    <input type="hidden" id="rel-id" value="${p ? p.id : ""}">
    <div class="field"><label>Nombre</label><input class="input" id="rel-nombre" placeholder="Ej: Ignacia" value="${p ? escapeAttr(p.nombre) : ""}"></div>
    <div class="field"><label>Vínculo</label><input class="input" id="rel-vinculo" placeholder="Ej: Pareja, amigo, mamá..." value="${p ? escapeAttr(p.vinculo || "") : ""}"></div>
    <div class="field"><label>Cumpleaños</label><input class="input" type="date" id="rel-cumple" value="${p ? (p.cumple || "") : ""}"></div>
    <div class="field"><label>¿Cada cuánto quieres hablarle?</label>
      <select class="input" id="rel-frecuencia">${freqs.map(([v, l]) => `<option value="${v}" ${v === curFreq ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="field"><label>Notas</label><textarea class="input" id="rel-notas" style="min-height:80px" placeholder="Lo que quieras recordar de esta persona...">${p ? escapeHtml(p.notas || "") : ""}</textarea></div>
    <button class="btn btn--primary btn-block" data-action="rel-save">${p ? "Guardar" : "Agregar"}</button>`);
}
function saveRel() {
  const nombre = val("rel-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  const data = { nombre, vinculo: val("rel-vinculo"), cumple: val("rel-cumple"), frecuencia: +val("rel-frecuencia"), notas: val("rel-notas") };
  const id = val("rel-id");
  if (id) {
    const p = STATE.vida.relaciones.find(x => x.id === id);
    if (p) Object.assign(p, data);
  } else {
    STATE.vida.relaciones.push({ id: uid(), ...data, ultimoContacto: todayISO() });
  }
  saveState(); closeModal(); rerender();
}

/* ============================================================
   LISTAS
   ============================================================ */
function renderListas() {
  const listas = STATE.vida.listas;
  return `
  <div class="flex-between"><div class="card__title" style="margin:0">Tus listas</div>
    <button class="btn btn--primary" data-action="lista-add">+ Nueva lista</button></div>
  <div class="grid grid-3 mt-16">
    ${listas.length ? listas.map(l => l.tipo === "deseos" ? listaDeseosCard(l) : listaNormalCard(l)).join("")
      : '<div class="card"><div class="empty">Crea tu primera lista. También puedes crear una <b>Lista de deseos</b> que suma los montos.</div></div>'}
  </div>`;
}
function listaNormalCard(l) {
  const done = l.items.filter(i => i.done).length;
  const inputId = "li-" + l.id;
  return `<div class="card">
    <div class="card__head"><div class="card__title" style="font-size:15px">${l.icon || "📄"} ${escapeHtml(l.nombre)}</div>
      <div class="row" style="gap:6px"><span class="chip">${done}/${l.items.length}</span>
        <button class="icon-btn" data-action="lista-del" data-id="${l.id}">🗑</button></div></div>
    ${l.items.map(it => `<div class="item-row" style="padding:8px 10px">
      <span class="check ${it.done ? "is-on" : ""}" data-action="lista-item-toggle" data-lista="${l.id}" data-id="${it.id}">${it.done ? "✓" : ""}</span>
      <div class="item-row__main"><div class="item-row__title text-sm ${it.done ? "strike" : ""}">${escapeHtml(it.txt)}</div></div>
      <button class="icon-btn" data-action="lista-item-del" data-lista="${l.id}" data-id="${it.id}">✕</button></div>`).join("")}
    <div class="row mt-8"><input class="input" id="${inputId}" placeholder="Agregar ítem..." style="padding:8px 10px">
      <button class="btn btn--cian" data-action="lista-item-add" data-lista="${l.id}" data-input="${inputId}" style="padding:8px 12px">+</button></div>
  </div>`;
}
function listaDeseosCard(l) {
  const total = l.items.reduce((a, i) => a + (+i.costo || 0), 0);
  const conseguido = l.items.filter(i => i.done).reduce((a, i) => a + (+i.costo || 0), 0);
  return `<div class="card">
    <div class="card__head"><div class="card__title" style="font-size:15px">💎 ${escapeHtml(l.nombre)}</div>
      <button class="icon-btn" data-action="lista-del" data-id="${l.id}">🗑</button></div>
    ${l.items.map(it => `<div class="item-row" style="padding:8px 10px">
      <span class="check ${it.done ? "is-on" : ""}" data-action="lista-item-toggle" data-lista="${l.id}" data-id="${it.id}" title="Marcar como conseguido">${it.done ? "✓" : ""}</span>
      <div class="item-row__main"><div class="item-row__title text-sm ${it.done ? "strike" : ""}">${escapeHtml(it.txt)}</div></div>
      <span class="text-sm ${it.done ? "muted" : "hl-coral"}" style="white-space:nowrap">${fmtCLP(it.costo || 0)}</span>
      <button class="icon-btn" data-action="lista-item-del" data-lista="${l.id}" data-id="${it.id}">✕</button></div>`).join("")}
    <div class="row mt-8">
      <input class="input" id="lid-${l.id}" placeholder="Deseo..." style="padding:8px 10px;flex:2">
      <input class="input" id="lic-${l.id}" type="text" inputmode="numeric" placeholder="$" style="padding:8px 10px;flex:1">
      <button class="btn btn--cian" data-action="lista-deseo-add" data-lista="${l.id}" style="padding:8px 12px">+</button></div>
    <div class="divider"></div>
    <div class="flex-between text-sm"><span class="soft">Total deseado</span><span class="hl-coral">${fmtCLP(total)}</span></div>
    <div class="flex-between text-sm mt-8"><span class="soft">Ya conseguido</span><span class="hl-cian">${fmtCLP(conseguido)}</span></div>
  </div>`;
}
function openListaModal() {
  const iconos = ["🛒", "🎬", "✈️", "📚", "🎵", "🎁", "🍽️", "🏋️", "💡", "✅"];
  openModal("Nueva lista", `
    <div class="field"><label>Tipo</label>
      <div class="seg" id="lst-tipos" style="width:100%">
        <button type="button" class="is-active" data-t="normal" onclick="listaTipoPick(this)" style="flex:1">Normal</button>
        <button type="button" data-t="deseos" onclick="listaTipoPick(this)" style="flex:1">💎 Lista de deseos</button>
      </div><input type="hidden" id="lst-tipo" value="normal"></div>
    <div class="field"><label>Nombre</label><input class="input" id="lst-nombre" placeholder="Ej: Compras"></div>
    <div class="field" id="lst-icon-field"><label>Ícono</label><div class="row-wrap" id="lst-iconos">${iconos.map(ic =>
      `<button type="button" class="btn btn--soft" style="padding:8px 12px" data-ic="${ic}" onclick="listaIconPick(this)">${ic}</button>`).join("")}</div>
      <input type="hidden" id="lst-icon" value="🛒"></div>
    <p class="text-xs muted" style="margin:-4px 0 12px" id="lst-deseo-hint" hidden>💎 En una lista de deseos cada ítem lleva un monto y verás el total (para cuantificar tus gastos lujosos).</p>
    <button class="btn btn--primary btn-block" data-action="lista-save">Crear lista</button>`);
}
function listaTipoPick(btn) {
  document.getElementById("lst-tipo").value = btn.dataset.t;
  document.querySelectorAll("#lst-tipos button").forEach(b => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  const esDeseos = btn.dataset.t === "deseos";
  document.getElementById("lst-icon-field").hidden = esDeseos;
  document.getElementById("lst-deseo-hint").hidden = !esDeseos;
}
function listaIconPick(btn) {
  document.getElementById("lst-icon").value = btn.dataset.ic;
  document.querySelectorAll("#lst-iconos .btn").forEach(b => b.classList.remove("btn--cian"));
  btn.classList.add("btn--cian");
}
function saveLista() {
  const nombre = val("lst-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  const tipo = (document.getElementById("lst-tipo") || {}).value || "normal";
  STATE.vida.listas.push({ id: uid(), nombre, tipo, icon: tipo === "deseos" ? "💎" : (val("lst-icon") || "📄"), items: [] });
  saveState(); closeModal(); rerender();
}
