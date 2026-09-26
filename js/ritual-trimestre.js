/* ============================================================
   RUMBO · Revisión trimestral (cierre y apertura del trimestre)
   Completa la cascada trimestre → mes → semana → día.
   Datos: STATE.ritual.trimestres["2026-Q4"] = { apertura: {…, ts}, cierre: {…, ts} }
   Las metas del trimestre viven en datosAnio(año).metas.trimestres[q] (0-3).
   Ventana: desde los últimos 7 días del trimestre hasta el día 10 del siguiente.
   ============================================================ */

const TRI_MONEDAS = 200;

function triKey(y, q) { return `${y}-Q${q + 1}`; }
function triDeKey(k) { const [y, q] = k.split("-Q").map(Number); return { y, q: q - 1 }; }
function triDeFecha(iso) { const d = agDate(iso); return { y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) }; }
function triPrev(y, q) { return q === 0 ? { y: y - 1, q: 3 } : { y, q: q - 1 }; }
function triNext(y, q) { return q === 3 ? { y: y + 1, q: 0 } : { y, q: q + 1 }; }
function triRango(y, q) { return [isoLocal(new Date(y, q * 3, 1)), isoLocal(new Date(y, q * 3 + 3, 0))]; }
function triNombre(y, q) { return `${q + 1}.er trimestre ${y}`.replace("2.er", "2.º").replace("4.er", "4.º"); }
function triMeses(q) { return MESES.slice(q * 3, q * 3 + 3).map(m => m.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " y $1"); }
function ritualTri(k, S) { S = S || STATE; S.ritual.trimestres = S.ritual.trimestres || {}; return S.ritual.trimestres[k] || null; }
function triConActividad(y, q, S) {
  S = S || STATE; const [a, b] = triRango(y, q);
  return Object.keys(S.ritual.dias || {}).some(k => k >= a && k <= b && S.ritual.dias[k].hecho);
}

/* Revisión pendiente hoy: { cierre?: {y,q}, apertura?: {y,q} } */
function ritualTriPendientes(now, S) {
  now = now || new Date(); S = S || STATE;
  const hoy = isoLocal(now), { y, q } = triDeFecha(hoy), out = {};
  const [, fin] = triRango(y, q), [ini] = triRango(y, q);
  if (hoy >= agSumar(fin, -6)) {                                   // últimos 7 días: cerrar este
    if (!(ritualTri(triKey(y, q), S) || {}).cierre && triConActividad(y, q, S)) out.cierre = { y, q };
    const n = triNext(y, q); if (!(ritualTri(triKey(n.y, n.q), S) || {}).apertura) out.apertura = n;
  }
  if (hoy <= agSumar(ini, 9)) {                                    // primeros 10 días: cerrar el anterior
    const p = triPrev(y, q);
    if (!(ritualTri(triKey(p.y, p.q), S) || {}).cierre && triConActividad(p.y, p.q, S)) out.cierre = p;
  }
  if (hoy <= agSumar(ini, 14) && !(ritualTri(triKey(y, q), S) || {}).apertura) out.apertura = { y, q };   // primeros 15 días: abrir
  return out;
}
function renderTrimestreBanner() {
  const p = ritualTriPendientes();
  if (p.cierre && p.apertura) return heroCoral("🧭 Tu revisión trimestral", `Cierra el ${triNombre(p.cierre.y, p.cierre.q)} y define las metas del que viene. Toma 15 minutos.`, "Comenzar", "tri-ritual", { cierre: triKey(p.cierre.y, p.cierre.q), apertura: triKey(p.apertura.y, p.apertura.q) });
  if (p.cierre) return heroCoral(`🧭 Cierra el ${triNombre(p.cierre.y, p.cierre.q)}`, "Revisa tus metas del trimestre, tus números y lo que aprendiste.", "Cerrar el trimestre", "tri-ritual", { cierre: triKey(p.cierre.y, p.cierre.q) });
  if (p.apertura) return heroCoral(`🧭 Abre el ${triNombre(p.apertura.y, p.apertura.q)}`, "Elige tu foco y de 3 a 5 metas para los próximos 3 meses.", "Abrir el trimestre", "tri-ritual", { apertura: triKey(p.apertura.y, p.apertura.q) });
  return "";
}

/* -------- Números de un trimestre -------- */
function resumenTrimestre(y, q, S) {
  S = S || STATE;
  const [desde, hasta] = triRango(y, q), D = datosAnio(S, y);
  const dias = Object.keys(S.ritual.dias || {}).filter(k => k >= desde && k <= hasta).map(k => S.ritual.dias[k]);
  const mens = [0, 1, 2].flatMap(i => D.metas.mensuales[q * 3 + i] || []);
  const tris = D.metas.trimestres[q] || [];
  const tm = tmResumen(S, desde, hasta);
  const notas = [0, 1, 2].map(i => (((S.ritual.meses || {})[mesKey(y, q * 3 + i)] || {}).cierre || {}).nota).filter(Boolean);
  const rueda = [0, 1, 2].map(i => D.rueda.meses[q * 3 + i] || []).filter(a => a.some(v => v > 0));
  const ruedaProm = rueda.length ? Math.round((rueda.flat().reduce((a, b) => a + b, 0) / rueda.flat().length) * 10) / 10 : null;
  return {
    cerrados: dias.filter(r => r.cerrado).length, abiertos: dias.filter(r => r.hecho).length,
    habitos: cumplimientoGrupo(S.habitos.defs, desde, hasta, S).pct,
    trimestrales: [tris.filter(o => o.done).length, tris.length], objetivos: [mens.filter(o => o.done).length, mens.length],
    tareas: tm.cumplimiento, postergacion: tm.tareas ? tm.indice : null,
    semanas: Object.keys(S.ritual.semanas || {}).filter(k => k >= agLunes(desde) && k <= hasta && S.ritual.semanas[k].apertura && S.ritual.semanas[k].cierre).length,
    ahorro: [0, 1, 2].reduce((a, i) => { const m = D.finanzas.meses[q * 3 + i] || {}; return a + ((m.ingreso || 0) - (m.gasto || 0)); }, 0),
    nota: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
    rueda: ruedaProm,
  };
}
function resumenTrimestreHtml(r) {
  const n = (ico, label, v) => `<div class="mes-num"><div class="mes-num__v">${v}</div><div class="mes-num__l">${ico} ${label}</div></div>`;
  const pct = v => (v == null ? "—" : v + "%"), dec = v => (v == null ? "—" : String(v).replace(".", ","));
  return `<div class="mes-nums">
    ${n("🧭", "metas del trimestre", `${r.trimestrales[0]}/${r.trimestrales[1]}`)}
    ${n("🎯", "objetivos de los meses", `${r.objetivos[0]}/${r.objetivos[1]}`)}
    ${n("📊", "hábitos", pct(r.habitos))}
    ${n("🌙", "días cerrados", r.cerrados)}
    ${n("📅", "semanas redondas", r.semanas)}
    ${n("✓", "tareas completadas", pct(r.tareas))}
    ${n("↪", "postergación", pct(r.postergacion))}
    ${n("💰", "ahorro", fmtCLP(r.ahorro))}
    ${n("⭐", "nota de los meses", dec(r.nota))}
    ${n("🧭", "rueda de la vida", dec(r.rueda))}
  </div>`;
}

/* ============================================================
   Asistente (cierre / apertura)
   ============================================================ */
let TRI_WIZ = null;   // { tipo, key, y, q, paso, draft, siguiente }
const TRI_PASOS = { cierre: ["Metas", "Números", "Reflexión", "Nota"], apertura: ["Mirada atrás", "Foco", "Metas"] };

function openTriRitual(cierre, apertura) {
  if (cierre) openTriCierre(cierre, apertura || null); else if (apertura) openTriApertura(apertura);
}
function openTriCierre(key, siguiente) {
  const { y, q } = triDeKey(key), c = (ritualTri(key) || {}).cierre || {};
  const estados = {};
  (datosAnio(STATE, y).metas.trimestres[q] || []).forEach(o => { estados[o.id] = o.estadoCierre || (o.done ? "cumplido" : "no"); });
  TRI_WIZ = { tipo: "cierre", key, y, q, paso: 0, siguiente,
    draft: { estados, logro: c.logro || "", aprendizaje: c.aprendizaje || "", cambiar: c.cambiar || "", nota: c.nota || 7 } };
  renderTriWiz();
}
function openTriApertura(key, op) {
  const { y, q } = triDeKey(key), a = (ritualTri(key) || {}).apertura || {};
  const lista = datosAnio(STATE, y).metas.trimestres[q] || [];
  const metas = lista.filter(o => o.origen === "ritual-tri").map(o => ({ id: o.id, texto: o.texto }));
  TRI_WIZ = { tipo: "apertura", key, y, q, paso: op && op.desdeCierre ? 1 : 0,
    draft: { foco: a.foco || "", granTrimestre: a.granTrimestre || "", metas, arrastrar: [] } };
  renderTriWiz();
}
function renderTriWiz() {
  const w = TRI_WIZ; if (!w) return;
  const pasos = TRI_PASOS[w.tipo], ult = w.paso === pasos.length - 1;
  const hecho = (ritualTri(w.key) || {})[w.tipo];
  const boton = hecho ? "Guardar cambios" : w.tipo === "apertura" ? `Abrir el trimestre (+${TRI_MONEDAS} ⭐)` : w.siguiente ? `Cerrar y abrir el siguiente (+${TRI_MONEDAS} ⭐)` : `Cerrar el trimestre (+${TRI_MONEDAS} ⭐)`;
  openModal(`${w.tipo === "apertura" ? "Abrir" : "Cerrar"} el ${triNombre(w.y, w.q)}`, `
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Paso ${w.paso + 1} de ${pasos.length} · ${pasos[w.paso]}</div>
    <div class="mes-wiz mt-16">${(w.tipo === "apertura" ? triAperturaPaso : triCierrePaso)(w)}</div>
    <div class="onb-dots">${pasos.map((p, i) => `<span class="onb-dot ${i === w.paso ? "is-on" : ""}" title="${p}"></span>`).join("")}</div>
    <div class="onb-nav">
      <button class="btn-ghost" data-action="${w.paso ? "triw-prev" : "close-modal"}">${w.paso ? "Atrás" : "Cancelar"}</button>
      <button class="btn btn--primary" data-action="${ult ? "triw-finish" : "triw-next"}">${ult ? boton : "Siguiente"}</button>
    </div>`);
}
function triCierrePaso(w) {
  const d = w.draft;
  if (w.paso === 0) {
    const lista = datosAnio(STATE, w.y).metas.trimestres[w.q] || [];
    if (!lista.length) return `<div class="empty">No tenías metas para este trimestre. Defínelas al abrir el siguiente 🧭</div>`;
    const seg = (id, v, label) => `<button type="button" class="${d.estados[id] === v ? "is-active" : ""}" data-v="${v}" onclick="segPick(this,'tc-e-${id}')">${label}</button>`;
    return `<p class="text-sm muted" style="margin-bottom:10px">${triMeses(w.q)}: ¿cómo te fue con cada meta?</p>` + lista.map(o => `<div class="mes-obj">
      <div class="text-sm" style="font-weight:600">🧭 ${escapeHtml(o.texto)}</div>
      <div class="seg">${seg(o.id, "cumplido", "✅ Cumplida")}${seg(o.id, "parcial", "◐ Parcial")}${seg(o.id, "no", "✕ No")}</div>
      <input type="hidden" id="tc-e-${o.id}" value="${d.estados[o.id]}"></div>`).join("");
  }
  if (w.paso === 1) return resumenTrimestreHtml(resumenTrimestre(w.y, w.q));
  if (w.paso === 2) return `<div class="field"><label>🏆 Tu logro principal del trimestre</label><textarea class="input" id="tc-logro">${escapeHtml(d.logro)}</textarea></div>
    <div class="field"><label>🧠 Lo que aprendiste</label><textarea class="input" id="tc-apr">${escapeHtml(d.aprendizaje)}</textarea></div>
    <div class="field"><label>🔧 Qué cambiarías el próximo trimestre</label><input class="input" id="tc-cambiar" value="${escapeAttr(d.cambiar)}" placeholder="Lo verás al abrir el siguiente"></div>`;
  return `<div class="field"><label>Nota del trimestre: <b id="tc-nl" style="font-size:20px">${d.nota}</b>/10</label>
    <input type="range" min="1" max="10" step="1" id="tc-nota" value="${d.nota}" style="width:100%;accent-color:var(--cian)" oninput="document.getElementById('tc-nl').textContent=this.value"></div>
    <p class="text-xs muted">📔 El cierre queda también en tu Diario.${w.siguiente ? " Al guardar, abres el trimestre siguiente." : ""}</p>`;
}
function triAperturaPaso(w) {
  const d = w.draft, p = triPrev(w.y, w.q), pk = triKey(p.y, p.q), pc = (ritualTri(pk) || {}).cierre;
  if (w.paso === 0) return `<div class="card__title">Así te fue en el ${triNombre(p.y, p.q)}</div>
    <div class="mt-16">${resumenTrimestreHtml(resumenTrimestre(p.y, p.q))}</div>
    ${pc ? `<div class="divider"></div>${pc.logro ? `<div class="text-xs muted">🏆 Tu logro principal</div><div class="mt-8">${escapeHtml(pc.logro)}</div>` : ""}
      ${pc.aprendizaje ? `<div class="text-xs muted mt-16">🧠 Lo que aprendiste</div><div class="mt-8">${escapeHtml(pc.aprendizaje)}</div>` : ""}`
    : `<p class="text-xs muted mt-16">No cerraste ese trimestre. Cierra este al final para ver aquí tu reflexión.</p>`}`;
  if (w.paso === 1) return `<div class="field"><label>Foco del trimestre (una palabra o tema)</label>
      <input class="input" id="ta-foco" value="${escapeAttr(d.foco)}" placeholder="Ej: Crecer, Salud, Lanzamiento">
      ${pc && pc.cambiar ? `<div class="text-xs muted mt-8">🔧 El trimestre pasado anotaste para cambiar: <b>${escapeHtml(pc.cambiar)}</b></div>` : ""}</div>
    <div class="field"><label>¿Cómo se ve un gran trimestre?</label>
      <textarea class="input" id="ta-gran" placeholder="Imagina que es fin de ${MESES[w.q * 3 + 2].toLowerCase()} y valió la pena: ¿qué pasó?">${escapeHtml(d.granTrimestre)}</textarea></div>`;
  const filas = Array.from({ length: Math.max(3, d.metas.length) }, (_, i) => {
    const m = d.metas[i] || { id: "", texto: "" };
    return `<div class="mes-obj"><input type="hidden" id="ta-id-${i}" value="${escapeAttr(m.id || "")}">
      <input class="input" id="ta-m-${i}" value="${escapeAttr(m.texto)}" placeholder="Meta ${i + 1}${i < 3 ? "" : " (opcional)"}"></div>`;
  }).join("");
  const pend = (datosAnio(STATE, p.y).metas.trimestres[p.q] || []).filter(o => !o.done);
  const actuales = datosAnio(STATE, w.y).metas.trimestres[w.q] || [];
  const arrastrables = pend.filter(o => !actuales.some(x => x.arrastrado === o.id));
  return `<p class="text-sm muted" style="margin-bottom:12px">De 3 a 5 metas para ${triMeses(w.q)}. Serán la guía de tus objetivos de cada mes.</p>
    ${filas}
    ${d.metas.length < 5 ? `<button type="button" class="btn-ghost mt-8" data-action="triw-mas">+ Otra meta</button>` : ""}
    ${arrastrables.length ? `<div class="divider"></div><div class="text-xs muted" style="margin-bottom:8px">↪ Traer metas no cumplidas del trimestre anterior</div>
      ${arrastrables.map(o => `<label class="row" style="gap:8px;padding:4px 0"><input type="checkbox" class="ta-arr" value="${o.id}" ${d.arrastrar.includes(o.id) ? "checked" : ""}> ${escapeHtml(o.texto)}</label>`).join("")}` : ""}`;
}
function triWizLeer() {
  const w = TRI_WIZ; if (!w) return;
  const d = w.draft, el = id => document.getElementById(id);
  if (w.tipo === "cierre") {
    if (w.paso === 0) Object.keys(d.estados).forEach(id => { if (el("tc-e-" + id)) d.estados[id] = val("tc-e-" + id); });
    if (w.paso === 2 && el("tc-logro")) { d.logro = val("tc-logro"); d.aprendizaje = val("tc-apr"); d.cambiar = val("tc-cambiar"); }
    if (w.paso === 3 && el("tc-nota")) d.nota = parseNum(el("tc-nota").value) || 7;
  } else {
    if (w.paso === 1 && el("ta-foco")) { d.foco = val("ta-foco"); d.granTrimestre = val("ta-gran"); }
    if (w.paso === 2 && el("ta-m-0")) {
      const n = document.querySelectorAll("[id^='ta-m-']").length;
      d.metas = Array.from({ length: n }, (_, i) => ({ id: val("ta-id-" + i), texto: val("ta-m-" + i) }));
      d.arrastrar = Array.from(document.querySelectorAll(".ta-arr:checked")).map(x => x.value);
    }
  }
}
function triWizMover(delta) { triWizLeer(); const w = TRI_WIZ; if (!w) return; w.paso = Math.max(0, Math.min(TRI_PASOS[w.tipo].length - 1, w.paso + delta)); renderTriWiz(); }
function triWizMas() { triWizLeer(); if (TRI_WIZ.draft.metas.length < 5) { while (TRI_WIZ.draft.metas.length < 3) TRI_WIZ.draft.metas.push({ id: "", texto: "" }); TRI_WIZ.draft.metas.push({ id: "", texto: "" }); } renderTriWiz(); }
function triWizFinish() {
  triWizLeer(); const w = TRI_WIZ; if (!w) return; TRI_WIZ = null;
  if (w.tipo === "cierre") guardarTriCierre(w); else guardarTriApertura(w);
}

function guardarTriCierre(w) {
  const d = w.draft, now = Date.now();
  const D = datosAnio(STATE, w.y, true);
  (D.metas.trimestres[w.q] || []).forEach(o => {
    const e = d.estados[o.id]; if (!e) return;
    o.estadoCierre = e; if (e === "cumplido") o.done = true; o.ts = now;
  });
  STATE.ritual.trimestres = STATE.ritual.trimestres || {};
  const rt = STATE.ritual.trimestres[w.key] = STATE.ritual.trimestres[w.key] || {};
  rt.cierre = { logro: d.logro, aprendizaje: d.aprendizaje, cambiar: d.cambiar, nota: d.nota, numeros: resumenTrimestre(w.y, w.q), ts: now };
  // Diario: una entrada por trimestre (fecha: último día del trimestre, o hoy si cierras antes)
  STATE.vida.diario = STATE.vida.diario || [];
  let e = STATE.vida.diario.find(x => x.fromRitualTri && x.trimestre === w.key);
  if (!e) { e = { id: uid(), fromRitualTri: true, tipo: "trimestre", trimestre: w.key }; STATE.vida.diario.push(e); }
  const fin = triRango(w.y, w.q)[1], hoy = todayISO();
  Object.assign(e, { fecha: hoy < fin ? hoy : fin, nota: d.nota, gratitud: d.logro,
    texto: [d.aprendizaje && "Aprendizaje: " + d.aprendizaje, d.cambiar && "Para cambiar: " + d.cambiar].filter(Boolean).join(" · "), ts: now });
  const pagado = registrarMovimiento("ritual-tri-cierre:" + w.key, TRI_MONEDAS, TRI_MONEDAS, "Cierre de trimestre", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti) launchConfetti();
  toast(`🧭 Trimestre cerrado · ${d.nota}/10${pagado ? ` · +${TRI_MONEDAS} ⭐` : ""}`);
  if (w.siguiente && !(ritualTri(w.siguiente) || {}).apertura) openTriApertura(w.siguiente, { desdeCierre: true });
}
function guardarTriApertura(w) {
  const d = w.draft, now = Date.now();
  const D = datosAnio(STATE, w.y, true);
  const lista = D.metas.trimestres[w.q] = D.metas.trimestres[w.q] || [];
  const vivos = new Set();
  d.metas.filter(m => m.texto).slice(0, 5).forEach(m => {
    const ex = m.id && lista.find(x => x.id === m.id);
    if (ex) { ex.texto = m.texto; ex.ts = now; vivos.add(ex.id); }
    else { const n = { id: uid(), texto: m.texto, done: false, origen: "ritual-tri", ts: now }; lista.push(n); vivos.add(n.id); }
  });
  D.metas.trimestres[w.q] = lista.filter(x => x.origen !== "ritual-tri" || vivos.has(x.id) || x.done || x.arrastrado);
  const p = triPrev(w.y, w.q);
  d.arrastrar.forEach(pid => {
    const po = (datosAnio(STATE, p.y).metas.trimestres[p.q] || []).find(x => x.id === pid);
    if (!po || D.metas.trimestres[w.q].some(x => x.arrastrado === pid)) return;
    D.metas.trimestres[w.q].push({ id: uid(), texto: po.texto, done: false, origen: "ritual-tri", arrastrado: pid, ts: now });
  });
  STATE.ritual.trimestres = STATE.ritual.trimestres || {};
  const rt = STATE.ritual.trimestres[w.key] = STATE.ritual.trimestres[w.key] || {};
  rt.apertura = { foco: d.foco, granTrimestre: d.granTrimestre, ts: now };
  const pagado = registrarMovimiento("ritual-tri-apertura:" + w.key, TRI_MONEDAS, TRI_MONEDAS, "Apertura de trimestre", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(`🧭 ${triNombre(w.y, w.q)} abierto${pagado ? ` · +${TRI_MONEDAS} ⭐` : ""}. ¡A por él!`);
}

/* -------- Vista Ritual → Trimestre -------- */
function renderRitualTrimestre() {
  const { y, q } = triDeFecha(todayISO()), key = triKey(y, q);
  const r = ritualTri(key) || {}, a = r.apertura;
  const metas = datosAnio(STATE, y).metas.trimestres[q] || [];
  const p = triPrev(y, q), pk = triKey(p.y, p.q);
  const acciones = [`<button class="btn ${a ? "btn--soft" : "btn--primary"}" data-action="tri-open" data-key="${key}">${a ? "Editar apertura" : "🧭 Abrir el trimestre"}</button>`];
  const [, fin] = triRango(y, q);
  if (todayISO() >= agSumar(fin, -6)) acciones.push(`<button class="btn ${r.cierre ? "btn--soft" : "btn--primary"}" data-action="tri-close" data-key="${key}">${r.cierre ? "Editar cierre" : "🌙 Cerrar el trimestre"}</button>`);
  if (!(ritualTri(pk) || {}).cierre && triConActividad(p.y, p.q)) acciones.push(`<button class="btn-ghost" data-action="tri-close" data-key="${pk}">Cerrar el ${triNombre(p.y, p.q)}</button>`);
  const hist = Object.keys(STATE.ritual.trimestres || {}).filter(k => k < key).sort().reverse().slice(0, 8).map(k => {
    const x = STATE.ritual.trimestres[k], t = triDeKey(k);
    return `<div class="item-row"><div class="item-row__main"><div class="item-row__title">${triNombre(t.y, t.q)}${x.apertura && x.apertura.foco ? ` · <span class="hl-cian">${escapeHtml(x.apertura.foco)}</span>` : ""}</div>
      <div class="item-row__sub">${x.cierre && x.cierre.logro ? escapeHtml(x.cierre.logro) : ""}</div></div>
      ${x.cierre ? `<span class="chip chip--done">Cerrado ✓ ${x.cierre.nota}/10</span>` : ""}</div>`;
  }).join("");
  return `
  <div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">${triNombre(y, q)} · ${triMeses(q)}</div>
        <div class="big-num">${a && a.foco ? escapeHtml(a.foco) : "Sin foco definido"}</div>
        ${a && a.granTrimestre ? `<div class="text-sm soft mt-8">${escapeHtml(a.granTrimestre)}</div>` : ""}</div>
      <div class="row-wrap">${acciones.join("")}</div>
    </div>
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card"><div class="card__head"><div class="card__title">🧭 Metas del trimestre</div><a class="card__hint" href="#metas">Ver objetivos →</a></div>
      ${metas.length ? metas.map(o => metaRow(o, "tri", q, y)).join("") : '<div class="empty">Define tus metas al abrir el trimestre.</div>'}</div>
    <div class="card"><div class="card__title">📊 El trimestre hasta hoy</div><div class="mt-16">${resumenTrimestreHtml(resumenTrimestre(y, q))}</div></div>
  </div>
  ${hist ? `<div class="section-title">Trimestres anteriores</div><div class="card">${hist}</div>` : ""}`;
}

/* Insignia: primera revisión trimestral (cerrar un trimestre) */
function g_trimestresCerrados(s) { return Object.values((s.ritual && s.ritual.trimestres) || {}).filter(x => x && x.cierre).length; }
