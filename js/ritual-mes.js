/* ============================================================
   RUMBO · Ritual de Mes (apertura y cierre), conectado con Objetivos
   Datos: STATE.ritual.meses["YYYY-MM"] = { apertura: {…, ts}, cierre: {…, ts} }
   Los objetivos viven en STATE.metas.mensuales[m] (índice 0-11 del año fijo).
   // TODO año: metas.mensuales, finanzas.meses y rueda.meses usan el año fijo
   // (settings.year). El cruce diciembre → enero no tiene año siguiente.
   ============================================================ */

const MES_APERTURA_HASTA = 5;   // la apertura se ofrece del día 1 al 5
const MES_CIERRE_HASTA = 3;     // el cierre, del último día hasta el día 3 del mes siguiente

/* Clave de mes "YYYY-MM" (≠ monthKey "YYYY-M" del log de hábitos) */
function mesKey(y, m) { return `${y}-${String(m + 1).padStart(2, "0")}`; }
function mesDeKey(key) { const [y, m] = key.split("-").map(Number); return { y, m: m - 1 }; }
function mesPrev(y, m) { return m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }; }
function mesNext(y, m) { return m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }; }
/* ¿El mes cae en el año fijo? (solo ahí hay metas/finanzas/rueda) // TODO año: */
function mesEnAnio(y) { return y === STATE.settings.year; }
function ritualMes(key) { STATE.ritual.meses = STATE.ritual.meses || {}; return STATE.ritual.meses[key] || null; }
function mesAbierto(key) { const r = ritualMes(key); return !!(r && r.apertura); }
function mesCerrado(key) { const r = ritualMes(key); return !!(r && r.cierre); }
function nombreMes(y, m) { return `${MESES[m]}${y !== new Date().getFullYear() ? " " + y : ""}`; }

/* Rituales de mes pendientes hoy (dentro de su ventana): [{ tipo, y, m, key }] */
function ritualMesPendientes(hoy = new Date()) {
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  const out = [];
  if (d <= MES_CIERRE_HASTA) {
    const p = mesPrev(y, m), k = mesKey(p.y, p.m);
    if (!mesCerrado(k)) out.push({ tipo: "cierre", y: p.y, m: p.m, key: k });
  }
  if (d === daysInMonth(y, m) && !mesCerrado(mesKey(y, m))) out.push({ tipo: "cierre", y, m, key: mesKey(y, m) });
  if (d <= MES_APERTURA_HASTA && !mesAbierto(mesKey(y, m))) out.push({ tipo: "apertura", y, m, key: mesKey(y, m) });
  return out;
}
/* ¿Se puede cerrar ya este mes? (desde el día 25, o en la ventana de cierre) */
function mesCerrable(y, m, hoy = new Date()) {
  const ky = hoy.getFullYear(), km = hoy.getMonth();
  if (ky === y && km === m) return hoy.getDate() >= 25;
  const p = mesPrev(ky, km);
  return p.y === y && p.m === m;   // mes anterior: siempre se puede cerrar (tarde)
}

/* Banner/hero para Inicio y Ritual */
function renderMesBanner() {
  const pend = ritualMesPendientes();
  return pend.map(p => p.tipo === "apertura"
    ? heroCoral(`🗓️ Abre ${MESES[p.m]}`, "Mira el mes que pasó, define tu foco y tus objetivos del mes. Toma 5 minutos.", "Abrir el mes", "mes-open", { key: p.key })
    : heroCoral(`🗓️ Cierra ${MESES[p.m]}`, "Revisa tus objetivos, tus números y reflexiona antes de seguir.", "Cerrar el mes", "mes-close", { key: p.key })
  ).join("");
}

/* Resumen automático de un mes (para la mirada atrás y los números del cierre) */
function resumenMes(y, m) {
  const S = STATE, pref = mesKey(y, m) + "-";
  const dias = Object.entries(S.ritual.dias || {}).filter(([k]) => k.startsWith(pref)).map(([, r]) => r || {});
  const tareas = { pro: [0, 0], per: [0, 0] };
  dias.forEach(r => { const t = r.cierre && r.cierre.tareas; if (t) ["pro", "per"].forEach(a => { tareas[a][0] += (t[a] || [0, 0])[0]; tareas[a][1] += (t[a] || [0, 0])[1]; }); });
  const desde = isoLocal(new Date(y, m, 1)), hasta = isoLocal(new Date(y, m + 1, 0));
  const enAnio = mesEnAnio(y);
  const objetivos = enAnio ? (S.metas.mensuales[m] || []) : [];
  const fin = enAnio ? (S.finanzas.meses[m] || {}) : {};
  const ahorro = (fin.ingreso || 0) - (fin.gasto || 0);
  return {
    abiertos: dias.filter(r => r.hecho).length,
    cerrados: dias.filter(r => r.cerrado).length,
    bocados: dias.filter(r => r.cierre && r.cierre.sapo).length,
    habitos: cumplimientoGrupo(S.habitos.defs, desde, hasta).pct,
    objetivos: [objetivos.filter(o => o.done).length, objetivos.length],
    tareas,
    ahorro, metaAhorro: fin.metaAhorro || S.finanzas.metaMensual || 0,
    libros: (S.lecturas || []).filter(l => l.estado === "terminado" && (l.fin || "").startsWith(pref)).length,
  };
}
function resumenMesHtml(r) {
  const n = (ico, label, v) => `<div class="mes-num"><div class="mes-num__v">${v}</div><div class="mes-num__l">${ico} ${label}</div></div>`;
  return `<div class="mes-nums">
    ${n("🌅", "días abiertos", r.abiertos)}
    ${n("🌙", "días cerrados", r.cerrados)}
    ${n("📊", "hábitos", r.habitos == null ? "—" : r.habitos + "%")}
    ${n("🎯", "objetivos", `${r.objetivos[0]}/${r.objetivos[1]}`)}
    ${n(BOCADO.emoji, "primeros bocados", r.bocados)}
    ${n(AMBITOS.pro.icon, "tareas pro", `${r.tareas.pro[0]}/${r.tareas.pro[1]}`)}
    ${n(AMBITOS.per.icon, "tareas personales", `${r.tareas.per[0]}/${r.tareas.per[1]}`)}
    ${n("💰", "ahorro" + (r.metaAhorro ? " / meta " + fmtCLP(r.metaAhorro) : ""), fmtCLP(r.ahorro))}
    ${n("📚", "libros terminados", r.libros)}
  </div>`;
}

/* ============================================================
   Asistente por pasos (apertura / cierre)
   ============================================================ */
let MES_WIZ = null;   // { tipo, y, m, key, paso, draft }
const MES_PASOS = {
  apertura: ["Mirada atrás", "Foco del mes", "Objetivos", "Hábitos", "Finanzas"],
  cierre: ["Objetivos", "Números", "Rueda de la vida", "Reflexión", "Nota del mes"],
};

function openMesApertura(key) {
  const { y, m } = mesDeKey(key);
  const prev = mesPrev(y, m), prevKey = mesKey(prev.y, prev.m);
  const r = ritualMes(key) || {}, a = r.apertura || {};
  const pc = (ritualMes(prevKey) || {}).cierre || {};
  const lista = mesEnAnio(y) ? (STATE.metas.mensuales[m] || []) : [];
  const objetivos = lista.filter(o => o.origen === "ritual-mes").map(o => ({ id: o.id, texto: o.texto, ambito: o.ambito || "per", triId: o.triId || "" }));
  const fin = mesEnAnio(y) ? STATE.finanzas.meses[m] || {} : {};
  const habitos = {};
  STATE.habitos.defs.forEach(h => { const f = hmFreq(h); habitos[h.id] = { tipo: f.tipo, veces: f.veces || 3, dias: f.dias, pausado: !!h.pausado }; });
  MES_WIZ = {
    tipo: "apertura", y, m, key, paso: 0,
    draft: {
      foco: a.foco || "", granMes: a.granMes || pc.proximo || "",
      objetivos, arrastrar: [], habitos, nuevosHabitos: [],
      metaAhorro: fin.metaAhorro != null ? fin.metaAhorro : (STATE.finanzas.metaMensual || 0),
    },
  };
  renderMesWiz();
}

function openMesCierre(key) {
  const { y, m } = mesDeKey(key);
  const c = (ritualMes(key) || {}).cierre || {};
  const lista = mesEnAnio(y) ? (STATE.metas.mensuales[m] || []) : [];
  const estados = {};
  lista.forEach(o => { estados[o.id] = { estado: o.estadoCierre || (o.done ? "cumplido" : "no"), nota: o.notaCierre || "" }; });
  const rueda = mesEnAnio(y) ? (STATE.rueda.meses[m] || []).slice() : [];
  MES_WIZ = {
    tipo: "cierre", y, m, key, paso: 0,
    draft: {
      estados, rueda: STATE.rueda.areas.map((_, i) => rueda[i] || 0),
      mejor: c.mejor || "", aprendizaje: c.aprendizaje || "", dejar: c.dejar || "", proximo: c.proximo || "",
      nota: c.nota || 7,
    },
  };
  renderMesWiz();
}

function renderMesWiz() {
  const w = MES_WIZ; if (!w) return;
  const pasos = MES_PASOS[w.tipo], ult = w.paso === pasos.length - 1;
  const dots = pasos.map((p, i) => `<span class="onb-dot ${i === w.paso ? "is-on" : ""}" title="${p}"></span>`).join("");
  const body = (w.tipo === "apertura" ? mesAperturaPaso : mesCierrePaso)(w);
  const titulo = (w.tipo === "apertura" ? "Abrir " : "Cerrar ") + nombreMes(w.y, w.m);
  const premio = (ritualMes(w.key) || {})[w.tipo] ? "Guardar cambios" : (w.tipo === "apertura" ? "Abrir el mes (+150 ⭐)" : "Cerrar el mes (+150 ⭐)");
  openModal(titulo, `
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Paso ${w.paso + 1} de ${pasos.length} · ${pasos[w.paso]}</div>
    <div class="mes-wiz mt-16">${body}</div>
    <div class="onb-dots">${dots}</div>
    <div class="onb-nav">
      <button class="btn-ghost" data-action="${w.paso ? "mes-prev" : "close-modal"}">${w.paso ? "Atrás" : "Cancelar"}</button>
      <button class="btn btn--primary" data-action="${ult ? "mes-finish" : "mes-next"}">${ult ? premio : "Siguiente"}</button>
    </div>`);
}

/* -------- Apertura: pasos -------- */
function mesAperturaPaso(w) {
  const d = w.draft;
  const prev = mesPrev(w.y, w.m), prevKey = mesKey(prev.y, prev.m);
  if (w.paso === 0) {
    const pc = (ritualMes(prevKey) || {}).cierre;
    return `<div class="card__title">Así te fue en ${nombreMes(prev.y, prev.m)}</div>
      <div class="mt-16">${resumenMesHtml(resumenMes(prev.y, prev.m))}</div>
      ${pc ? `<div class="divider"></div>
        ${pc.mejor ? `<div class="text-xs muted">🌟 Lo mejor del mes</div><div class="mt-8">${escapeHtml(pc.mejor)}</div>` : ""}
        ${pc.aprendizaje ? `<div class="text-xs muted mt-16">🧠 Aprendizaje principal</div><div class="mt-8">${escapeHtml(pc.aprendizaje)}</div>` : ""}`
      : `<p class="text-xs muted mt-16">No cerraste ${MESES[prev.m]}. Este mes, ciérralo al final para ver tu reflexión aquí.</p>`}`;
  }
  if (w.paso === 1) {
    return `<div class="field"><label>Foco del mes (una palabra o tema)</label>
        <input class="input" id="mw-foco" value="${escapeAttr(d.foco)}" placeholder="Ej: Constancia, Salud, Lanzamiento"></div>
      <div class="field"><label>¿Cómo se ve un gran mes?</label>
        <textarea class="input" id="mw-gran" placeholder="Describe cómo sería terminar este mes y sentir que valió la pena">${escapeHtml(d.granMes)}</textarea>
        ${(((ritualMes(prevKey) || {}).cierre) || {}).proximo ? `<div class="text-xs muted mt-8">Precargado con lo que anotaste al cerrar ${MESES[prev.m]}.</div>` : ""}</div>`;
  }
  if (w.paso === 2) {
    const curTri = Math.floor(w.m / 3);
    const tri = mesEnAnio(w.y) ? (STATE.metas.trimestres[curTri] || []) : [];
    const rows = Array.from({ length: Math.max(5, d.objetivos.length) }, (_, i) => {
      const o = d.objetivos[i] || { texto: "", ambito: "pro", triId: "" };
      return `<div class="mes-obj">
        <input type="hidden" id="mo-id-${i}" value="${escapeAttr(o.id || "")}">
        <input class="input" id="mo-t-${i}" value="${escapeAttr(o.texto)}" placeholder="Objetivo ${i + 1}${i < 3 ? "" : " (opcional)"}">
        <div class="row" style="gap:8px">
          <select class="select" id="mo-a-${i}" style="max-width:150px">${["pro", "per"].map(a => `<option value="${a}" ${o.ambito === a ? "selected" : ""}>${AMBITOS[a].icon} ${AMBITOS[a].corto}</option>`).join("")}</select>
          <select class="select" id="mo-tri-${i}"><option value="">— Sin vínculo trimestral —</option>${tri.map(t => `<option value="${t.id}" ${o.triId === t.id ? "selected" : ""}>🎯 ${escapeHtml(t.texto)}</option>`).join("")}</select>
        </div></div>`;
    }).join("");
    const prevList = mesEnAnio(prev.y) ? (STATE.metas.mensuales[prev.m] || []).filter(o => !o.done) : [];
    const lista = mesEnAnio(w.y) ? STATE.metas.mensuales[w.m] || [] : [];
    const pendientesArr = prevList.filter(o => !lista.some(x => x.arrastrado === o.id));
    const manuales = lista.filter(o => o.origen !== "ritual-mes").length;
    return `<p class="text-sm muted" style="margin-bottom:12px">Idealmente de 3 a 5. Vincúlalos a una meta del ${curTri + 1}° trimestre para que empujen en la misma dirección.</p>
      ${rows}
      ${pendientesArr.length ? `<div class="divider"></div><div class="text-xs muted" style="margin-bottom:8px">↪ Arrastrar objetivos no cumplidos de ${MESES[prev.m]}</div>
        ${pendientesArr.map(o => `<label class="row" style="gap:8px;padding:4px 0"><input type="checkbox" class="mo-arr" value="${o.id}" ${d.arrastrar.includes(o.id) ? "checked" : ""}> ${escapeHtml(o.texto)}</label>`).join("")}` : ""}
      ${manuales ? `<p class="text-xs muted mt-8">Además tienes ${manuales} meta(s) de ${MESES[w.m]} agregadas a mano en Objetivos.</p>` : ""}`;
  }
  if (w.paso === 3) {
    const tipos = [["diario", "Diario"], ["semanal", "X/semana"], ["dias", "Días fijos"], ["mensual", "X/mes"]];
    const rows = STATE.habitos.defs.map(h => {
      const x = d.habitos[h.id];
      return `<div class="mes-hab ${x.pausado ? "is-paused" : ""}">
        <div class="mes-hab__n">${h.icon} ${escapeHtml(h.nombre)}</div>
        <div class="row" style="gap:6px">
          <select class="select" id="mh-tipo-${h.id}" style="max-width:130px">${tipos.filter(([k]) => k !== "dias" || x.tipo === "dias").map(([k, l]) => `<option value="${k}" ${x.tipo === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          <input class="input" type="number" min="1" max="25" id="mh-veces-${h.id}" value="${x.veces || 3}" style="width:64px" title="Veces (semanal o mensual)">
          <label class="row text-xs" style="gap:4px"><input type="checkbox" id="mh-pausa-${h.id}" ${x.pausado ? "checked" : ""}> ⏸</label>
        </div></div>`;
    }).join("");
    return `<p class="text-sm muted" style="margin-bottom:12px">Ajusta la frecuencia de tus hábitos para este mes, pausa los que no toquen o crea uno nuevo. (Los días fijos se editan en Hábitos.)</p>
      ${rows}
      ${d.nuevosHabitos.map(n => `<div class="mes-hab"><div class="mes-hab__n">✨ ${escapeHtml(n.nombre)}</div><span class="chip">${hmFreqLabel({ frecuencia: n.frecuencia })}</span></div>`).join("")}
      <div class="divider"></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <input class="input" id="mh-new-nombre" placeholder="Nuevo hábito" style="flex:1;min-width:140px">
        <select class="select" id="mh-new-tipo" style="max-width:130px">${tipos.filter(([k]) => k !== "dias").map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
        <input class="input" type="number" min="1" max="25" id="mh-new-veces" value="3" style="width:64px">
        <button class="btn btn--cian" data-action="mes-hab-add">+</button>
      </div>`;
  }
  const fin = mesEnAnio(w.y) ? STATE.finanzas.meses[w.m] || {} : {};
  return `<div class="field"><label>Meta de ahorro de ${MESES[w.m]} (opcional)</label>
      <input class="input" id="mw-ahorro" inputmode="numeric" value="${d.metaAhorro || ""}" placeholder="Ej: 200000">
      <div class="text-xs muted mt-8">Tu meta mensual general es ${fmtCLP(STATE.finanzas.metaMensual || 0)}.${fin.ingreso || fin.gasto ? " Llevas " + fmtCLP((fin.ingreso || 0) - (fin.gasto || 0)) + " este mes." : ""}</div></div>
    ${mesEnAnio(w.y) ? "" : `<p class="text-xs muted">Este mes está fuera del año ${STATE.settings.year}: objetivos y finanzas no se guardarán en tus metas.</p>`}`;
}

/* -------- Cierre: pasos -------- */
function mesCierrePaso(w) {
  const d = w.draft;
  if (w.paso === 0) {
    const lista = mesEnAnio(w.y) ? (STATE.metas.mensuales[w.m] || []) : [];
    if (!lista.length) return `<div class="empty">No tenías objetivos para ${MESES[w.m]}. El próximo mes, defínelos al abrirlo 🎯</div>`;
    const segB = (id, v, label, cur) => `<button type="button" class="${cur === v ? "is-active" : ""}" data-v="${v}" onclick="segPick(this,'mc-e-${id}')">${label}</button>`;
    return lista.map(o => {
      const e = d.estados[o.id] || { estado: "no", nota: "" };
      return `<div class="mes-obj">
        <div class="text-sm" style="font-weight:600">${o.ambito ? AMBITOS[ambitoDe(o)].icon + " " : ""}${escapeHtml(o.texto)}</div>
        <div class="seg mt-8">${segB(o.id, "cumplido", "✅ Cumplido", e.estado)}${segB(o.id, "parcial", "◐ Parcial", e.estado)}${segB(o.id, "no", "✕ No", e.estado)}</div>
        <input type="hidden" id="mc-e-${o.id}" value="${e.estado}">
        <input class="input mt-8" id="mc-n-${o.id}" value="${escapeAttr(e.nota)}" placeholder="Nota breve (opcional)"></div>`;
    }).join("");
  }
  if (w.paso === 1) return resumenMesHtml(resumenMes(w.y, w.m));
  if (w.paso === 2) {
    return STATE.rueda.areas.map((a, i) => `<div class="field"><label>${escapeHtml(a)}: <b id="mc-rl-${i}">${d.rueda[i]}</b>/10</label>
      <input type="range" min="0" max="10" step="1" id="mc-r-${i}" value="${d.rueda[i]}" style="width:100%;accent-color:var(--cian)"
        oninput="document.getElementById('mc-rl-${i}').textContent=this.value"></div>`).join("");
  }
  if (w.paso === 3) {
    return `<div class="field"><label>🌟 Lo mejor del mes</label><textarea class="input" id="mc-mejor">${escapeHtml(d.mejor)}</textarea></div>
      <div class="field"><label>🧠 Aprendizaje principal</label><textarea class="input" id="mc-apr">${escapeHtml(d.aprendizaje)}</textarea></div>
      <div class="field"><label>🛑 Qué dejar de hacer</label><input class="input" id="mc-dejar" value="${escapeAttr(d.dejar)}"></div>
      <div class="field"><label>🌱 Una cosa para el próximo mes</label><input class="input" id="mc-prox" value="${escapeAttr(d.proximo)}" placeholder="Se precargará al abrir el próximo mes"></div>`;
  }
  return `<div class="field"><label>Nota de ${MESES[w.m]}: <b id="mc-nl" style="font-size:20px">${d.nota}</b>/10</label>
    <input type="range" min="1" max="10" step="1" id="mc-nota" value="${d.nota}" style="width:100%;accent-color:var(--cian)"
      oninput="document.getElementById('mc-nl').textContent=this.value"></div>
    <p class="text-xs muted">📔 El cierre queda también en tu Diario.</p>`;
}

/* Lee los campos del paso actual al borrador */
function mesWizLeer() {
  const w = MES_WIZ; if (!w) return;
  const d = w.draft, el = id => document.getElementById(id);
  if (w.tipo === "apertura") {
    if (w.paso === 1) { d.foco = val("mw-foco"); d.granMes = val("mw-gran"); }
    if (w.paso === 2 && el("mo-t-0")) {
      const nFilas = document.querySelectorAll(".mes-obj input[id^='mo-t-']").length;
      d.objetivos = Array.from({ length: nFilas }, (_, i) => ({ id: val("mo-id-" + i), texto: val("mo-t-" + i), ambito: val("mo-a-" + i) === "per" ? "per" : "pro", triId: val("mo-tri-" + i) }));
      d.arrastrar = Array.from(document.querySelectorAll(".mo-arr:checked")).map(x => x.value);
    }
    if (w.paso === 3) STATE.habitos.defs.forEach(h => {
      if (!el("mh-tipo-" + h.id)) return;
      const x = d.habitos[h.id];
      x.tipo = val("mh-tipo-" + h.id); x.veces = parseNum(val("mh-veces-" + h.id)) || 1; x.pausado = el("mh-pausa-" + h.id).checked;
    });
    if (w.paso === 4 && el("mw-ahorro")) d.metaAhorro = parseNum(val("mw-ahorro"));
  } else {
    if (w.paso === 0) Object.keys(d.estados).forEach(id => { if (el("mc-e-" + id)) d.estados[id] = { estado: val("mc-e-" + id), nota: val("mc-n-" + id) }; });
    if (w.paso === 2) d.rueda = d.rueda.map((v, i) => el("mc-r-" + i) ? parseNum(el("mc-r-" + i).value) : v);
    if (w.paso === 3) { d.mejor = val("mc-mejor"); d.aprendizaje = val("mc-apr"); d.dejar = val("mc-dejar"); d.proximo = val("mc-prox"); }
    if (w.paso === 4 && el("mc-nota")) d.nota = parseNum(el("mc-nota").value) || 7;
  }
}
function mesWizMover(delta) {
  mesWizLeer();
  const w = MES_WIZ; if (!w) return;
  w.paso = Math.max(0, Math.min(MES_PASOS[w.tipo].length - 1, w.paso + delta));
  renderMesWiz();
}
function mesHabAdd() {
  mesWizLeer();
  const nombre = val("mh-new-nombre"); if (!nombre) return toast("Ponle un nombre al hábito", true);
  const tipo = val("mh-new-tipo"), veces = parseNum(val("mh-new-veces")) || 1;
  const frecuencia = tipo === "semanal" ? { tipo, veces: Math.min(6, veces) } : tipo === "mensual" ? { tipo, veces: Math.min(25, veces) } : { tipo: "diario" };
  MES_WIZ.draft.nuevosHabitos.push({ nombre, frecuencia });
  renderMesWiz();
}
function mesWizFinish() {
  mesWizLeer();
  const w = MES_WIZ; if (!w) return;
  if (w.tipo === "apertura") guardarMesApertura(w); else guardarMesCierre(w);
  MES_WIZ = null;
}

function guardarMesApertura(w) {
  const d = w.draft, now = Date.now();
  STATE.ritual.meses = STATE.ritual.meses || {};
  const rm = STATE.ritual.meses[w.key] = STATE.ritual.meses[w.key] || {};
  const ids = [];
  if (mesEnAnio(w.y)) {
    const lista = STATE.metas.mensuales[w.m] = STATE.metas.mensuales[w.m] || [];
    // Objetivos del ritual: editar sin duplicar (por id); los vaciados se quitan
    const vivos = new Set();
    d.objetivos.filter(o => o.texto).forEach(o => {
      const ex = o.id && lista.find(x => x.id === o.id);
      if (ex) { Object.assign(ex, { texto: o.texto, ambito: o.ambito, triId: o.triId || "", ts: now }); vivos.add(ex.id); }
      else { const n = { id: uid(), texto: o.texto, done: false, ambito: o.ambito, triId: o.triId || "", origen: "ritual-mes", ts: now }; lista.push(n); vivos.add(n.id); }
    });
    STATE.metas.mensuales[w.m] = lista.filter(x => x.origen !== "ritual-mes" || vivos.has(x.id) || x.done);
    // Arrastrar no cumplidos del mes anterior (una sola vez cada uno)
    const prev = mesPrev(w.y, w.m);
    if (mesEnAnio(prev.y)) d.arrastrar.forEach(pid => {
      const po = (STATE.metas.mensuales[prev.m] || []).find(x => x.id === pid);
      if (!po || STATE.metas.mensuales[w.m].some(x => x.arrastrado === pid)) return;
      const n = { id: uid(), texto: po.texto, done: false, ambito: po.ambito || "per", triId: po.triId || "", origen: "ritual-mes", arrastrado: pid, ts: now };
      STATE.metas.mensuales[w.m].push(n); vivos.add(n.id);
    });
    vivos.forEach(id => ids.push(id));
    STATE.finanzas.meses[w.m].metaAhorro = d.metaAhorro || 0;
  }
  // Hábitos: frecuencia / pausa / nuevos
  STATE.habitos.defs.forEach(h => {
    const x = d.habitos[h.id]; if (!x) return;
    const f = x.tipo === "semanal" ? { tipo: "semanal", veces: Math.min(6, Math.max(1, x.veces)) }
      : x.tipo === "mensual" ? { tipo: "mensual", veces: Math.min(25, Math.max(1, x.veces)) }
      : x.tipo === "dias" ? hmFreq(h) : { tipo: "diario" };
    if (JSON.stringify(f) !== JSON.stringify(hmFreq(h)) || !!h.pausado !== x.pausado) { h.frecuencia = f; h.pausado = x.pausado; h.ts = now; }
  });
  d.nuevosHabitos.forEach(n => STATE.habitos.defs.push({ id: uid(), nombre: n.nombre, icon: "✨", frecuencia: n.frecuencia, creado: todayISO(), ts: now }));
  rm.apertura = { foco: d.foco, granMes: d.granMes, objetivos: ids, metaAhorro: d.metaAhorro || 0, ts: now };
  registrarMovimiento("ritual-mes-apertura:" + w.key, 150, 150, "Apertura de " + MESES[w.m]);
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(`🗓️ ${MESES[w.m]} abierto. ¡A por él!`);
}

function guardarMesCierre(w) {
  const d = w.draft, now = Date.now();
  STATE.ritual.meses = STATE.ritual.meses || {};
  const rm = STATE.ritual.meses[w.key] = STATE.ritual.meses[w.key] || {};
  if (mesEnAnio(w.y)) {
    (STATE.metas.mensuales[w.m] || []).forEach(o => {
      const e = d.estados[o.id]; if (!e) return;
      o.estadoCierre = e.estado; o.notaCierre = e.nota;
      if (e.estado === "cumplido") o.done = true;
      o.ts = now;
    });
    STATE.rueda.meses[w.m] = d.rueda.slice();
  }
  const numeros = resumenMes(w.y, w.m);
  rm.cierre = { mejor: d.mejor, aprendizaje: d.aprendizaje, dejar: d.dejar, proximo: d.proximo, nota: d.nota, rueda: d.rueda.slice(), numeros, ts: now };
  // Entrada en el Diario (una por mes, actualizable)
  STATE.vida.diario = STATE.vida.diario || [];
  let e = STATE.vida.diario.find(x => x.fromRitualMes && x.mes === w.key);
  if (!e) { e = { id: uid(), fromRitualMes: true, tipo: "mes", mes: w.key }; STATE.vida.diario.push(e); }
  Object.assign(e, {
    fecha: isoLocal(new Date(w.y, w.m + 1, 0)), nota: d.nota,
    texto: [d.aprendizaje && "Aprendizaje: " + d.aprendizaje, d.dejar && "Dejar de hacer: " + d.dejar, d.proximo && "Para el próximo mes: " + d.proximo].filter(Boolean).join(" · "),
    gratitud: d.mejor, ts: now,
  });
  registrarMovimiento("ritual-mes-cierre:" + w.key, 150, 150, "Cierre de " + MESES[w.m]);
  saveState(); closeModal(); updateTopbar(); rerender();
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti) launchConfetti();
  toast(`🗓️ ${MESES[w.m]} cerrado · nota ${d.nota}/10`);
}

/* ============================================================
   Vista "Mes" dentro de Ritual
   ============================================================ */
function renderRitualMes() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), key = mesKey(y, m);
  const r = ritualMes(key) || {}, a = r.apertura;
  const lista = mesEnAnio(y) ? (STATE.metas.mensuales[m] || []) : [];
  const acciones = [];
  acciones.push(`<button class="btn ${a ? "btn--soft" : "btn--primary"}" data-action="mes-open" data-key="${key}">${a ? "Editar apertura" : "🗓️ Abrir " + MESES[m]}</button>`);
  if (mesCerrable(y, m)) acciones.push(`<button class="btn ${r.cierre ? "btn--soft" : "btn--primary"}" data-action="mes-close" data-key="${key}">${r.cierre ? "Editar cierre" : "🌙 Cerrar " + MESES[m]}</button>`);
  const prev = mesPrev(y, m), pk = mesKey(prev.y, prev.m);
  if (!mesCerrado(pk)) acciones.push(`<button class="btn-ghost" data-action="mes-close" data-key="${pk}">Cerrar ${MESES[prev.m]}</button>`);

  const hist = Object.keys(STATE.ritual.meses || {}).sort().reverse().slice(0, 12).map(k => {
    const { y: hy, m: hm } = mesDeKey(k), x = STATE.ritual.meses[k];
    return `<div class="item-row"><div class="item-row__main"><div class="item-row__title">${nombreMes(hy, hm)}${x.apertura && x.apertura.foco ? ` · <span class="hl-cian">${escapeHtml(x.apertura.foco)}</span>` : ""}</div>
      <div class="item-row__sub">${x.cierre && x.cierre.mejor ? escapeHtml(x.cierre.mejor) : ""}</div></div>
      ${x.apertura ? '<span class="chip chip--done">Abierto ✓</span>' : ""} ${x.cierre ? `<span class="chip chip--done">Cerrado ✓ ${x.cierre.nota}/10</span>` : ""}</div>`;
  }).join("");

  return `
  <div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">${MESES[m]} ${y}</div>
        <div class="big-num">${a && a.foco ? escapeHtml(a.foco) : "Sin foco definido"}</div>
        ${a && a.granMes ? `<div class="text-sm soft mt-8">${escapeHtml(a.granMes)}</div>` : ""}</div>
      <div class="row-wrap">${acciones.join("")}</div>
    </div>
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card"><div class="card__head"><div class="card__title">🎯 Objetivos de ${MESES[m]}</div><a class="card__hint" href="#metas">Ver objetivos →</a></div>
      ${lista.length ? lista.map(o => metaRow(o, "mes", m)).join("") : '<div class="empty">Define tus objetivos al abrir el mes.</div>'}</div>
    <div class="card"><div class="card__title">📊 ${MESES[m]} hasta hoy</div><div class="mt-16">${resumenMesHtml(resumenMes(y, m))}</div></div>
  </div>
  ${hist ? `<div class="section-title">Meses anteriores</div><div class="card">${hist}</div>` : ""}`;
}

/* Insignias: meses "redondos" (abiertos y cerrados) */
function g_mesesRedondos(s) {
  return Object.keys((s.ritual && s.ritual.meses) || {}).filter(k => s.ritual.meses[k].apertura && s.ritual.meses[k].cierre).sort();
}
function g_trimestreConRumbo(s) {
  const ks = g_mesesRedondos(s);
  const set = new Set(ks);
  return ks.some(k => {
    const { y, m } = mesDeKey(k), n1 = mesNext(y, m), n2 = mesNext(n1.y, n1.m);
    return set.has(mesKey(n1.y, n1.m)) && set.has(mesKey(n2.y, n2.m));
  });
}
