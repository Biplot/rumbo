/* ============================================================
   RUMBO · Módulos (render + modales)
   ============================================================ */

let SALUD_MONTH = new Date().getMonth();
let RUEDA_MONTH = new Date().getMonth();
let CAL_MONTH = new Date().getMonth();

/* Selector de meses reutilizable */
function monthsSelector(current, action) {
  return `<div class="months">${MESES_CORTO.map((m, i) =>
    `<button class="${i === current ? "is-active" : ""}" data-action="${action}" data-m="${i}" title="${MESES[i]}">${m}</button>`).join("")}</div>`;
}
// Navegador de mes compacto: ‹ [mes ▾] año › — mucho más limpio en móvil que la tira de 12 botones.
// `action` = acción de click para las flechas (data-m); `sel` = nombre para el <select> (data-month-nav).
function monthNav(current, action, sel) {
  const prev = (current + 11) % 12, next = (current + 1) % 12;
  const opts = MESES.map((m, i) => `<option value="${i}" ${i === current ? "selected" : ""}>${m}</option>`).join("");
  return `<div class="mnav">
    <button class="mnav__arrow" data-action="${action}" data-m="${prev}" aria-label="Mes anterior">‹</button>
    <label class="mnav__center">
      <select class="mnav__sel" data-month-nav="${sel}" aria-label="Elegir mes">${opts}</select>
      <span class="mnav__year">${STATE.settings.year}</span>
    </label>
    <button class="mnav__arrow" data-action="${action}" data-m="${next}" aria-label="Mes siguiente">›</button>
  </div>`;
}

/* ============================================================
   FINANZAS
   ============================================================ */
function renderFinanzas() {
  const f = STATE.finanzas;
  const totalGastos = f.gastos.reduce((s, g) => s + g.monto, 0);
  const ahorroAnual = f.meses.reduce((s, m) => s + ((m.ingreso || 0) - (m.gasto || 0)), 0);
  const pctAnual = f.metaAnual ? Math.min(100, Math.round((ahorroAnual / f.metaAnual) * 100)) : 0;

  return `
  <div class="grid grid-3">
    <div class="card">
      <div class="stat"><div class="stat__label">💰 Meta de ahorro anual</div></div>
      <input class="input mt-8" type="text" inputmode="numeric" data-bind="finanzas.metaAnual" data-type="num" value="${f.metaAnual}">
      <div class="text-xs muted mt-8">Este año ahorraré</div>
    </div>
    <div class="card">
      <div class="stat"><div class="stat__label">📆 Meta mensual</div></div>
      <input class="input mt-8" type="text" inputmode="numeric" data-bind="finanzas.metaMensual" data-type="num" value="${f.metaMensual}">
      <div class="text-xs muted mt-8">Cada mes ahorraré</div>
    </div>
    <div class="card">
      <div class="stat"><div class="stat__label">🎯 Tu "por qué"</div></div>
      <input class="input mt-8" data-bind="finanzas.porque" value="${escapeAttr(f.porque)}">
      <div class="text-xs muted mt-8">Lo que te mueve</div>
    </div>
  </div>

  <div class="card mt-24">
    <div class="card__head">
      <div class="card__title">Progreso del año</div>
      <span class="chip chip--cian">${pctAnual}%</span>
    </div>
    <div class="flex-between mb-0" style="align-items:flex-end">
      <div class="big-num hl-cian">${fmtCLP(ahorroAnual)}</div>
      <div class="text-sm muted">de ${fmtCLP(f.metaAnual)}</div>
    </div>
    <div class="bar mt-16"><div class="bar__fill" style="width:${pctAnual}%"></div></div>
  </div>

  <div class="grid grid-2 mt-24">
    <div class="card">
      <div class="card__head"><div class="card__title">Gastos recurrentes</div>
        <button class="btn-ghost" data-action="gasto-add">+ Agregar</button></div>
      ${f.gastos.length ? f.gastos.map(g => `
        <div class="item-row">
          <div class="item-row__main">
            <div class="item-row__title">${escapeHtml(g.nombre)}</div>
            ${g.nota ? `<div class="item-row__sub">${escapeHtml(g.nota)}</div>` : ""}
          </div>
          <div class="hl-coral" style="font-weight:600">${fmtCLP(g.monto)}</div>
          <button class="icon-btn" data-action="gasto-del" data-id="${g.id}">🗑</button>
        </div>`).join("") : '<div class="empty">Sin gastos cargados.</div>'}
      <div class="divider"></div>
      <div class="flex-between"><span class="soft">Total mensual</span><span class="big-num" style="font-size:22px">${fmtCLP(totalGastos)}</span></div>
    </div>

    <div class="card">
      <div class="card__head"><div class="card__title">Seguimiento mensual</div>
        <span class="card__hint">Ingreso · Gasto · Ahorro</span></div>
      <div class="habit-grid">
        <table>
          <thead><tr><th class="name"></th><th>Ingreso</th><th>Gasto</th><th>Ahorro</th></tr></thead>
          <tbody>
            ${f.meses.map((m, i) => {
              const ahorro = (m.ingreso || 0) - (m.gasto || 0);
              return `<tr>
                <td class="name">${MESES_CORTO[i]}</td>
                <td><input class="input" style="padding:6px 8px;width:96px;text-align:right" type="text" inputmode="numeric" data-bind="finanzas.meses.${i}.ingreso" data-type="num" value="${m.ingreso || 0}"></td>
                <td><input class="input" style="padding:6px 8px;width:96px;text-align:right" type="text" inputmode="numeric" data-bind="finanzas.meses.${i}.gasto" data-type="num" value="${m.gasto || 0}"></td>
                <td style="font-weight:600;color:${ahorro >= 0 ? 'var(--cian)' : 'var(--coral)'}">${fmtCLP(ahorro)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function openGastoModal() {
  openModal("Nuevo gasto recurrente", `
    <div class="field"><label>Nombre</label><input class="input" id="g-nombre" placeholder="Ej: Arriendo"></div>
    <div class="field"><label>Monto mensual ($)</label><input class="input" id="g-monto" type="text" inputmode="numeric" placeholder="0"></div>
    <div class="field"><label>Nota (opcional)</label><input class="input" id="g-nota" placeholder="Ej: San Diego"></div>
    <button class="btn btn--primary btn-block" data-action="gasto-save">Agregar gasto</button>`);
}
function saveGasto() {
  const nombre = val("g-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.finanzas.gastos.push({ id: uid(), nombre, monto: parseNum(val("g-monto")), nota: val("g-nota") });
  saveState(); closeModal(); rerender(); toast("Gasto agregado");
}

/* ============================================================
   METAS (trimestrales + mensuales)
   ============================================================ */
function renderMetas() {
  const tri = STATE.metas.trimestres;
  const totalT = tri.flat().length;
  const doneT = tri.flat().filter(m => m.done).length;
  const pct = totalT ? Math.round((doneT / totalT) * 100) : 0;
  const curM = new Date().getMonth();
  const curTri = Math.floor(curM / 3);

  const triCards = tri.map((list, i) => {
    if (i < curTri && list.length === 0) return ""; // ocultar trimestres pasados vacíos
    const inputId = `mt-tri-${i}`;
    const done = list.filter(m => m.done).length;
    return `<div class="card">
      <div class="card__head"><div class="card__title">${i + 1}° Trimestre</div>
        <span class="chip">${done}/${list.length}</span></div>
      ${list.map(m => metaRow(m, "tri", i)).join("") || '<div class="empty">Sin metas aún.</div>'}
      <div class="row mt-8">
        <input class="input" id="${inputId}" placeholder="Nueva meta...">
        <button class="btn btn--cian" data-action="meta-add" data-bucket="tri" data-idx="${i}" data-input="${inputId}">+</button>
      </div>
    </div>`;
  }).join("");

  const mesCards = STATE.metas.mensuales.map((list, i) => {
    if (i < curM && list.length === 0) return ""; // ocultar meses pasados vacíos
    const inputId = `mt-mes-${i}`;
    return `<div class="card">
      <div class="card__head"><div class="card__title" style="font-size:14px">${MESES[i]}</div>
        <span class="chip">${list.filter(m => m.done).length}/${list.length}</span></div>
      ${list.map(m => metaRow(m, "mes", i)).join("") || '<div class="empty" style="padding:12px">—</div>'}
      <div class="row mt-8">
        <input class="input" id="${inputId}" placeholder="Meta de ${MESES_CORTO[i]}...">
        <button class="btn btn--cian" data-action="meta-add" data-bucket="mes" data-idx="${i}" data-input="${inputId}">+</button>
      </div>
    </div>`;
  }).join("");

  return `
  <div class="card" style="background:linear-gradient(120deg, var(--surface), var(--surface-2))">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="text-xs soft" style="text-transform:uppercase;letter-spacing:.08em">Resumen ${STATE.settings.year}</div>
        <div class="big-num">${doneT} <span class="text-sm muted">de ${totalT} metas trimestrales</span></div></div>
      <div style="min-width:160px;flex:1;max-width:320px"><div class="flex-between"><span class="text-sm soft">Completadas</span><span class="hl-cian">${pct}%</span></div>
        <div class="bar mt-8"><div class="bar__fill" style="width:${pct}%"></div></div></div>
    </div>
  </div>

  <div class="section-title">Metas trimestrales</div>
  <div class="grid grid-2">${triCards}</div>

  <div class="section-title">Metas mensuales clave</div>
  <div class="grid grid-3">${mesCards}</div>`;
}
function metaRow(m, bucket, idx) {
  return `<div class="item-row">
    <span class="check ${m.done ? "is-on" : ""}" data-action="meta-toggle" data-bucket="${bucket}" data-idx="${idx}" data-id="${m.id}">${m.done ? "✓" : ""}</span>
    <div class="item-row__main"><div class="item-row__title ${m.done ? "strike" : ""}">${escapeHtml(m.texto)}</div></div>
    <button class="icon-btn" data-action="meta-del" data-bucket="${bucket}" data-idx="${idx}" data-id="${m.id}">🗑</button>
  </div>`;
}

/* ============================================================
   HÁBITOS · Panel con vistas Diario / Mensual / Anual
   ============================================================ */
let HABIT_VIEW = "diario";   // diario | mensual | anual
let HABIT_LAYOUT = "hoy";    // hoy | semana  (dentro de Diario)

function habitDoneDate(id, dObj) {
  const log = STATE.habitos.log[`${dObj.getFullYear()}-${dObj.getMonth() + 1}`];
  return !!(log && log[id] && log[id][dObj.getDate()]);
}
function donutSvg(pct, color = "var(--cian)") {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return `<svg width="72" height="72" viewBox="0 0 72 72" style="flex-shrink:0">
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="8"/>
    <circle cx="36" cy="36" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 36 36)"/>
    <text x="36" y="41" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${pct}%</text></svg>`;
}

function renderHabitos() {
  const defs = STATE.habitos.defs;
  const tabs = [["diario", "Diario"], ["mensual", "Mensual"], ["anual", "Anual"]];
  const head = `
  <div class="flex-between" style="flex-wrap:wrap;gap:12px">
    <div class="pill pill--streak">🔥 Racha: ${computeStreak()} días</div>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <div class="seg">${tabs.map(([k, l]) => `<button class="${HABIT_VIEW === k ? "is-active" : ""}" data-action="habit-view" data-v="${k}">${l}</button>`).join("")}</div>
      <button class="btn btn--primary" data-action="habit-add">+ Nuevo hábito</button>
    </div>
  </div>`;
  if (!defs.length) return head + `<div class="card mt-16"><div class="empty">Aún no tienes hábitos. Crea el primero con “+ Nuevo hábito”.</div></div>`;
  const body = HABIT_VIEW === "mensual" ? habitViewMensual() : HABIT_VIEW === "anual" ? habitViewAnual() : habitViewDiario();
  return head + `<div class="mt-16">${body}</div>`;
}

function habitViewDiario() {
  const defs = STATE.habitos.defs;
  const now = new Date();
  const subs = [["hoy", "Hoy"], ["semana", "Semana"]];
  const sub = `<div class="seg" style="margin-bottom:16px">${subs.map(([k, l]) => `<button class="${HABIT_LAYOUT === k ? "is-active" : ""}" data-action="habit-layout" data-v="${k}">${l}</button>`).join("")}</div>`;

  if (HABIT_LAYOUT === "semana") {
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setDate(now.getDate() - dow);
    const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
    const rows = defs.map(h => {
      const cells = dias.map(d => {
        const on = habitDoneDate(h.id, d);
        const isT = isoLocal(d) === todayISO();
        return `<button class="hb-day ${on ? "on" : ""} ${isT ? "today" : ""}" data-action="habit-daycell" data-id="${h.id}" data-y="${d.getFullYear()}" data-m="${d.getMonth()}" data-d="${d.getDate()}">
          <span class="hb-day__dow">${DIAS_CORTO[d.getDay()]}</span><span class="hb-day__n">${d.getDate()}</span></button>`;
      }).join("");
      return `<div class="card hb-week"><div class="hb-week__name">${h.icon} ${escapeHtml(h.nombre)}
        <button class="icon-btn" data-action="habit-del" data-id="${h.id}">🗑</button></div><div class="hb-week__days">${cells}</div></div>`;
    }).join("");
    return sub + rows;
  }

  // Hoy (grilla de toggles)
  const done = defs.filter(h => habitDoneDate(h.id, now)).length;
  const cards = defs.map(h => {
    const on = habitDoneDate(h.id, now);
    return `<button class="card hb-today ${on ? "is-on" : ""}" data-action="habit-today" data-id="${h.id}">
      <div class="hb-today__ico">${h.icon}</div><div class="hb-today__name">${escapeHtml(h.nombre)}</div>
      <div class="hb-today__check">${on ? "✓" : ""}</div></button>`;
  }).join("");
  return sub + `<div class="text-sm muted" style="margin-bottom:12px">Hoy llevas <b>${done}/${defs.length}</b> hábitos</div><div class="hb-grid">${cards}</div>`;
}

function habitGrid(m) {
  const year = STATE.settings.year;
  const nDays = daysInMonth(year, m);
  const defs = STATE.habitos.defs;
  const todayD = (new Date().getMonth() === m && new Date().getFullYear() === year) ? new Date().getDate() : -1;
  const header = `<tr><th class="name">Hábito</th>${Array.from({ length: nDays }, (_, k) => {
    const d = k + 1; const wd = new Date(year, m, d).getDay();
    return `<th class="${d === todayD ? "today" : ""}">${DIAS_CORTO[wd]}<br>${d}</th>`;
  }).join("")}<th>%</th></tr>`;
  const rows = defs.map(h => {
    let count = 0;
    const cells = Array.from({ length: nDays }, (_, k) => {
      const d = k + 1; const on = habitDone(h.id, m, d); if (on) count++;
      return `<td><span class="cell ${on ? "on" : ""} ${d === todayD ? "today" : ""}" data-action="habit-cell" data-id="${h.id}" data-day="${d}"></span></td>`;
    }).join("");
    const pct = Math.round((count / nDays) * 100);
    return `<tr><td class="name">${h.icon} ${escapeHtml(h.nombre)}
      <button class="icon-btn" data-action="habit-del" data-id="${h.id}" style="margin-left:4px">🗑</button></td>
      ${cells}<td style="font-weight:600;color:var(--cian-ink)">${pct}%</td></tr>`;
  }).join("");
  return `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}

function habitViewMensual() {
  const m = HABIT_MONTH, year = STATE.settings.year, defs = STATE.habitos.defs;
  const nDays = daysInMonth(year, m);
  const now = new Date();
  const isCur = now.getMonth() === m && now.getFullYear() === year;
  const elapsed = isCur ? now.getDate() : nDays;
  let marks = 0; defs.forEach(h => { for (let d = 1; d <= elapsed; d++) if (habitDone(h.id, m, d)) marks++; });
  const posibles = defs.length * elapsed;
  const pct = posibles ? Math.round((marks / posibles) * 100) : 0;
  const ranking = defs.map(h => { let c = 0; for (let d = 1; d <= nDays; d++) if (habitDone(h.id, m, d)) c++; return { h, pct: Math.round((c / nDays) * 100) }; }).sort((a, b) => b.pct - a.pct);

  return `${monthsSelector(m, "habit-month")}
  <div class="grid grid-2">
    <div class="card"><div class="card__title">Progreso de ${MESES[m]}</div>
      <div class="row" style="gap:16px;align-items:center;margin-top:14px">${donutSvg(pct)}
        <div><div class="text-sm muted">Cumplimiento</div><div class="text-sm muted mt-8">${marks} de ${posibles} marcas posibles</div></div></div></div>
    <div class="card"><div class="card__title">Mejores hábitos del mes</div>
      <div class="mt-16">${ranking.map((r, i) => `<div class="flex-between" style="padding:6px 0"><span class="text-sm">${i + 1}. ${r.h.icon} ${escapeHtml(r.h.nombre)}</span><span class="hl-cian">${r.pct}%</span></div>`).join("")}</div></div>
  </div>
  <div class="section-title">Calendario del mes</div>
  <div class="card habit-grid">${habitGrid(m)}</div>`;
}

function habitViewAnual() {
  const year = STATE.settings.year, defs = STATE.habitos.defs;
  const porMes = MESES.map((_, m) => { let c = 0; const nd = daysInMonth(year, m); defs.forEach(h => { for (let d = 1; d <= nd; d++) if (habitDone(h.id, m, d)) c++; }); return c; });
  const total = porMes.reduce((a, b) => a + b, 0);
  const prom = Math.round(total / 12);
  const ranking = defs.map(h => { let c = 0; MESES.forEach((_, m) => { const nd = daysInMonth(year, m); for (let d = 1; d <= nd; d++) if (habitDone(h.id, m, d)) c++; }); return { h, c }; }).sort((a, b) => b.c - a.c);
  return `
  <div class="grid grid-3">
    ${statCard("✅", "Marcas del año", total, "en " + year)}
    ${statCard("📅", "Promedio / mes", prom, "marcas")}
    ${statCard("🔥", "Racha actual", computeStreak() + " días", "seguidos")}
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card"><div class="card__head"><div class="card__title">Por mes</div><span class="card__hint">marcas</span></div>${svgBar(porMes, { color: "var(--cian)", fmt: v => v })}</div>
    <div class="card"><div class="card__title">Top del año</div>
      <div class="mt-16">${ranking.map((r, i) => `<div class="flex-between" style="padding:6px 0"><span class="text-sm">${i + 1}. ${r.h.icon} ${escapeHtml(r.h.nombre)}</span><span class="hl-cian">${r.c}</span></div>`).join("")}</div></div>
  </div>`;
}
function openHabitModal() {
  const iconos = ["🏋️","📖","✏️","🎵","🥗","💧","🧘","💊","🏃","☀️","🛏️","🚭","🧹","💻","📞","🙏"];
  openModal("Nuevo hábito", `
    <div class="field"><label>Nombre del hábito</label><input class="input" id="h-nombre" placeholder="Ej: Meditar"></div>
    <div class="field"><label>Ícono</label>
      <div class="row-wrap" id="h-iconos">${iconos.map((ic, i) =>
        `<button type="button" class="btn--soft btn" style="padding:8px 12px" data-ic="${ic}" onclick="pickIcon(this)">${ic}</button>`).join("")}</div>
      <input type="hidden" id="h-icon" value="🏋️"></div>
    <button class="btn btn--primary btn-block mt-8" data-action="habit-save">Crear hábito</button>`);
}
function pickIcon(btn) {
  document.getElementById("h-icon").value = btn.dataset.ic;
  document.querySelectorAll("#h-iconos .btn").forEach(b => b.classList.remove("btn--cian"));
  btn.classList.add("btn--cian");
}
function saveHabit() {
  const nombre = val("h-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.habitos.defs.push({ id: uid(), nombre, icon: val("h-icon") || "✅" });
  saveState(); closeModal(); rerender(); toast("Hábito creado");
}

/* ============================================================
   LECTURAS · Biblioteca personal
   ============================================================ */
let LECT_FILTER = "todos";

const LECT_ESTADOS = {
  "por-leer":  { label: "Por leer",  chip: "" },
  "leyendo":   { label: "Leyendo",   chip: "chip--coral" },
  "terminado": { label: "Terminado", chip: "chip--done" },
};

function lectPct(l) {
  if (l.estado === "terminado") return 100;
  if (+l.paginas > 0) return Math.min(100, Math.round((+l.pagina / +l.paginas) * 100));
  return l.estado === "leyendo" ? 6 : 0;
}
function estrellas(n) {
  n = Math.max(0, Math.min(5, Math.round(n || 0)));
  return `<span class="stars">${"★".repeat(n)}<span class="stars__off">${"★".repeat(5 - n)}</span></span>`;
}
function libroSpine(l, w, h) {
  if (l.portada) return `<div class="spine spine--img" style="width:${w}px;height:${h}px;background-image:url('${l.portada}')"></div>`;
  return `<div class="spine" style="background:${l.color || "#17C3B2"};width:${w}px;height:${h}px"></div>`;
}
function libroCoverUpload(input) {
  const f = input.files && input.files[0]; input.value = "";
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 160, scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      const data = cv.toDataURL("image/jpeg", 0.72);
      const hid = document.getElementById("lb-portada"); if (hid) hid.value = data;
      const prev = document.getElementById("lb-portada-prev");
      if (prev) { prev.style.backgroundImage = `url('${data}')`; prev.classList.add("has-img"); }
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}
function libroCoverClear() {
  const hid = document.getElementById("lb-portada"); if (hid) hid.value = "";
  const prev = document.getElementById("lb-portada-prev");
  if (prev) { prev.style.backgroundImage = ""; prev.classList.remove("has-img"); }
}

function renderLecturas() {
  const libros = STATE.lecturas;
  const year = STATE.settings.year;
  const terminados = libros.filter(l => l.estado === "terminado");
  const leyendo = libros.filter(l => l.estado === "leyendo");
  const porLeer = libros.filter(l => l.estado === "por-leer");
  const meta = +STATE.settings.metaLibros || 12;
  const pctMeta = meta > 0 ? Math.min(100, Math.round(terminados.length / meta * 100)) : 0;
  const valorados = terminados.filter(l => +l.valoracion > 0);
  const prom = valorados.length ? (valorados.reduce((a, l) => a + +l.valoracion, 0) / valorados.length).toFixed(1) : "—";

  /* Encabezado: meta anual + stats */
  const header = `
  <div class="grid grid-4">
    <div class="card lect-meta">
      <div class="stat__label">🎯 Meta ${year}</div>
      <div class="row" style="align-items:baseline;gap:8px;margin:4px 0 10px">
        <span class="big-num">${terminados.length}</span>
        <span class="text-sm muted">de <input class="meta-input" type="number" min="1" data-bind="settings.metaLibros" data-type="num" value="${meta}"> libros</span>
      </div>
      <div class="bar"><div class="bar__fill" style="width:${pctMeta}%"></div></div>
    </div>
    <div class="card stat"><div class="stat__label">📖 Leyendo</div><div class="stat__value">${leyendo.length}</div></div>
    <div class="card stat"><div class="stat__label">📚 Por leer</div><div class="stat__value">${porLeer.length}</div></div>
    <div class="card stat"><div class="stat__label">⭐ Valoración</div><div class="stat__value">${prom}</div></div>
  </div>`;

  /* Leyendo ahora */
  const leyendoAhora = leyendo.length ? `
    <div class="section-title">📖 Leyendo ahora</div>
    <div class="grid grid-2">
      ${leyendo.map(l => {
        const idx = libros.indexOf(l);
        const pct = lectPct(l);
        return `<div class="card lect-now">
          <div class="lect-now__top">
            ${libroSpine(l, 46, 66)}
            <div style="flex:1;min-width:0">
              <div class="lect-now__title">${escapeHtml(l.titulo) || "Sin título"}</div>
              <div class="text-sm muted">${escapeHtml(l.autor) || "—"}</div>
            </div>
            <button class="icon-btn" data-action="libro-edit" data-id="${l.id}" title="Editar">✎</button>
          </div>
          <div class="bar mt-8"><div class="bar__fill bar__fill--coral" style="width:${pct}%"></div></div>
          <div class="lect-now__foot">
            <label class="text-xs muted">Página</label>
            <input class="input lect-page" type="number" min="0" ${l.paginas ? `max="${l.paginas}"` : ""} data-bind="lecturas.${idx}.pagina" data-type="num" value="${l.pagina || 0}">
            <span class="text-xs muted">/ ${l.paginas || "—"} · ${pct}%</span>
          </div>
        </div>`;
      }).join("")}
    </div>` : "";

  /* Filtros */
  const conteo = { todos: libros.length, leyendo: leyendo.length, "por-leer": porLeer.length, terminado: terminados.length };
  const tabs = [["todos", "Todos"], ["leyendo", "Leyendo"], ["por-leer", "Por leer"], ["terminado", "Terminados"]];
  const filtros = `<div class="seg lect-seg mt-24">${tabs.map(([k, lbl]) =>
    `<button class="${LECT_FILTER === k ? "is-active" : ""}" data-action="lect-filter" data-f="${k}">${lbl} <span class="seg-count">${conteo[k]}</span></button>`).join("")}</div>`;

  /* Grilla de libros */
  const visibles = LECT_FILTER === "todos" ? libros : libros.filter(l => l.estado === LECT_FILTER);
  const cards = visibles.map(l => {
    const est = LECT_ESTADOS[l.estado] || LECT_ESTADOS["por-leer"];
    const pct = lectPct(l);
    return `<div class="card lect-card" data-action="libro-edit" data-id="${l.id}">
      ${libroSpine(l, 38, 56)}
      <div class="lect-card__body">
        <div class="lect-card__title">${escapeHtml(l.titulo) || "Sin título"}</div>
        <div class="text-xs muted">${escapeHtml(l.autor) || "—"}</div>
        ${l.estado === "terminado" && l.valoracion ? estrellas(l.valoracion) : ""}
        ${l.estado === "leyendo" && l.paginas ? `<div class="lect-mini-bar"><div style="width:${pct}%"></div></div>` : ""}
        <span class="chip ${est.chip} lect-card__chip">${est.label}</span>
      </div>
    </div>`;
  }).join("");
  const addCard = `<button class="lect-add" data-action="libro-add">＋ Agregar libro</button>`;

  const cuerpo = libros.length
    ? `<div class="lect-grid mt-16">${cards}${addCard}</div>`
    : `<div class="mt-16"><div class="card"><div class="empty">Tu biblioteca está vacía.<br>Agrega tu primer libro para empezar 📚</div></div>
       <div class="lect-grid mt-16">${addCard}</div></div>`;

  return header + leyendoAhora + filtros + cuerpo;
}

function openLibroModal(id) {
  const l = id ? STATE.lecturas.find(x => x.id === id) : null;
  const colorSel = l ? l.color : LECT_COLORS[0];
  const colores = LECT_COLORS.map(c =>
    `<button type="button" class="swatch ${c === colorSel ? "is-on" : ""}" data-action="libro-color" data-c="${c}" style="background:${c}"></button>`).join("");
  const opt = (v, lbl) => `<option value="${v}" ${l && l.estado === v ? "selected" : ""}>${lbl}</option>`;
  const optStar = n => `<option value="${n}" ${l && +l.valoracion === n ? "selected" : ""}>${n === 0 ? "Sin valorar" : "★".repeat(n) + " (" + n + ")"}</option>`;
  openModal(id ? "Editar libro" : "Nuevo libro", `
    <input type="hidden" id="lb-id" value="${id || ""}">
    <input type="hidden" id="lb-color" value="${colorSel}">
    <div class="field"><label>Título</label><input class="input" id="lb-titulo" placeholder="Ej: Hábitos atómicos" value="${l ? escapeAttr(l.titulo) : ""}"></div>
    <div class="field"><label>Autor</label><input class="input" id="lb-autor" placeholder="Ej: James Clear" value="${l ? escapeAttr(l.autor) : ""}"></div>
    <div class="row">
      <div class="field" style="flex:1;margin-bottom:0"><label>Estado</label><select class="select" id="lb-estado">${opt("por-leer", "Por leer")}${opt("leyendo", "Leyendo")}${opt("terminado", "Terminado")}</select></div>
      <div class="field" style="flex:1;margin-bottom:0"><label>Valoración</label><select class="select" id="lb-valoracion">${optStar(0)}${optStar(1)}${optStar(2)}${optStar(3)}${optStar(4)}${optStar(5)}</select></div>
    </div>
    <div class="row mt-16">
      <div class="field" style="flex:1;margin-bottom:0"><label>Página actual</label><input class="input" type="number" min="0" id="lb-pagina" value="${l ? (l.pagina || 0) : 0}"></div>
      <div class="field" style="flex:1;margin-bottom:0"><label>Páginas totales</label><input class="input" type="number" min="0" id="lb-paginas" placeholder="Ej: 296" value="${l && l.paginas ? l.paginas : ""}"></div>
    </div>
    <div class="field mt-16"><label>Nota o aprendizaje clave</label><textarea class="input" id="lb-nota" placeholder="Lo que te llevas del libro...">${l ? escapeHtml(l.nota) : ""}</textarea></div>
    <input type="hidden" id="lb-portada" value="${l && l.portada ? l.portada : ""}">
    <div class="field"><label>Portada (opcional)</label>
      <div class="row" style="gap:12px;align-items:center">
        <div class="cover-prev ${l && l.portada ? "has-img" : ""}" id="lb-portada-prev" style="${l && l.portada ? `background-image:url('${l.portada}')` : ""}"></div>
        <div class="row" style="gap:8px">
          <input type="file" id="lb-portada-file" accept="image/*" hidden onchange="libroCoverUpload(this)">
          <button type="button" class="btn btn--soft" style="padding:8px 12px" onclick="document.getElementById('lb-portada-file').click()">Subir imagen</button>
          <button type="button" class="btn-ghost" onclick="libroCoverClear()">Quitar</button>
        </div>
      </div>
    </div>
    <div class="field"><label>Color del lomo <span class="text-xs muted">(si no pones portada)</span></label><div class="swatches">${colores}</div></div>
    <div class="row" style="margin-top:6px">
      <button class="btn btn--primary" style="flex:1" data-action="libro-save">${id ? "Guardar cambios" : "Agregar a mi biblioteca"}</button>
      ${id ? `<button class="btn btn--soft" data-action="libro-del" data-id="${id}" title="Eliminar">🗑</button>` : ""}
    </div>`);
}

function saveLibro() {
  const id = val("lb-id");
  const titulo = val("lb-titulo");
  if (!titulo) return toast("Ponle un título", true);
  const estado = document.getElementById("lb-estado").value;
  const valoracion = parseNum(document.getElementById("lb-valoracion").value);
  const pagina = parseNum(document.getElementById("lb-pagina").value);
  const paginas = parseNum(document.getElementById("lb-paginas").value);
  const nota = val("lb-nota");
  const color = document.getElementById("lb-color").value || LECT_COLORS[0];
  const portada = (document.getElementById("lb-portada") || {}).value || "";

  let l = id ? STATE.lecturas.find(x => x.id === id) : null;
  if (!l) { l = { id: uid(), inicio: "", fin: "" }; STATE.lecturas.push(l); }
  Object.assign(l, { titulo, autor: val("lb-autor"), estado, valoracion, pagina, paginas, nota, color, portada });

  /* Fechas automáticas según el estado */
  if (estado === "leyendo" && !l.inicio) l.inicio = todayISO();
  if (estado === "terminado") { if (!l.inicio) l.inicio = todayISO(); if (!l.fin) l.fin = todayISO(); if (paginas) l.pagina = paginas; }
  if (estado !== "terminado") l.fin = "";

  /* Recompensa al terminar un libro: una sola vez por libro (aunque lo pases a
     "leyendo" y de vuelta a "terminado"), para que las monedas sean coherentes. */
  if (estado === "terminado" && !l.premiado) { l.premiado = true; registrarMovimiento("lectura:" + l.id, 40, 40, "Libro terminado"); }
  saveState(); closeModal();
  if (typeof checkBadges === "function") checkBadges();
  rerender();
}

/* ============================================================
   SALUD Y BIENESTAR
   ============================================================ */
function renderSalud() {
  const i = SALUD_MONTH;
  const s = STATE.salud;
  const mes = s.meses[i];
  const deTot = s.meses.reduce((a, m) => a + (m.diasEntren || 0), 0);
  const dcTot = s.meses.reduce((a, m) => a + (m.diasCocina || 0), 0);
  const pesos = s.meses.map(m => m.peso).filter(p => p != null);
  const pesoActual = pesos.length ? pesos[pesos.length - 1] : null;
  const pePct = mes.diasEntrenTotal ? Math.round((mes.diasEntren / mes.diasEntrenTotal) * 100) : 0;
  const pcPct = mes.diasCocinaTotal ? Math.round((mes.diasCocina / mes.diasCocinaTotal) * 100) : 0;

  return `
  <div class="grid grid-4">
    ${statCard("🏋️", "Días entrenados (año)", deTot, "Total acumulado")}
    ${statCard("🍳", "Días cocinando (año)", dcTot, "Total acumulado")}
    ${statCard("⚖️", "Peso actual", pesoActual != null ? pesoActual + " kg" : "—", s.pesoObjetivo != null ? "Meta " + s.pesoObjetivo + " kg" : "Define tu meta")}
    ${statCard("🎯", "Peso objetivo", `<input class="input" style="width:90px" type="text" inputmode="numeric" data-bind="salud.pesoObjetivo" data-type="num" value="${s.pesoObjetivo ?? ""}" placeholder="—">`, "kg")}
  </div>

  ${monthNav(i, "salud-month", "salud")}

  <div class="grid grid-2">
    <div class="card">
      <div class="card__title mb-0">${MESES[i]} · Objetivo</div>
      <textarea class="input mt-8" data-bind="salud.meses.${i}.objetivo" placeholder="¿Qué quieres lograr este mes?">${escapeHtml(mes.objetivo)}</textarea>
      <div class="row mt-16">
        <div style="flex:1">
          <label class="text-xs muted">Días entrenados</label>
          <div class="row"><input class="input" style="width:64px;text-align:center" type="text" inputmode="numeric" data-bind="salud.meses.${i}.diasEntren" data-type="num" value="${mes.diasEntren}">
            <span class="muted">/</span><input class="input" style="width:64px;text-align:center" type="text" inputmode="numeric" data-bind="salud.meses.${i}.diasEntrenTotal" data-type="num" value="${mes.diasEntrenTotal}"></div>
          <div class="bar mt-8"><div class="bar__fill" style="width:${pePct}%"></div></div>
        </div>
        <div style="flex:1">
          <label class="text-xs muted">Días cocinando</label>
          <div class="row"><input class="input" style="width:64px;text-align:center" type="text" inputmode="numeric" data-bind="salud.meses.${i}.diasCocina" data-type="num" value="${mes.diasCocina}">
            <span class="muted">/</span><input class="input" style="width:64px;text-align:center" type="text" inputmode="numeric" data-bind="salud.meses.${i}.diasCocinaTotal" data-type="num" value="${mes.diasCocinaTotal}"></div>
          <div class="bar mt-8"><div class="bar__fill bar__fill--coral" style="width:${pcPct}%"></div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card__title mb-0">Notas del mes</div>
      <textarea class="input mt-8" style="min-height:90px" data-bind="salud.meses.${i}.notas" placeholder="¿Cómo te sentiste?">${escapeHtml(mes.notas)}</textarea>
      <div class="divider"></div>
      <div class="card__title mb-0" style="font-size:14px">🍽️ Receta del mes</div>
      <div class="row mt-8">
        <span class="check ${mes.recetaHecha ? "is-on" : ""}" data-action="receta-toggle" data-idx="${i}">${mes.recetaHecha ? "✓" : ""}</span>
        <input class="input" data-bind="salud.meses.${i}.recetaNombre" placeholder="Nombre de la receta" value="${escapeAttr(mes.recetaNombre)}">
      </div>
      <div class="row mt-8"><label class="text-xs muted" style="width:90px">Peso (kg)</label>
        <input class="input" style="width:110px" type="text" inputmode="decimal" data-bind="salud.meses.${i}.peso" data-type="num" value="${mes.peso ?? ""}"></div>
    </div>
  </div>`;
}

/* ============================================================
   RUEDA DE LA VIDA (radar)
   ============================================================ */
function renderRueda() {
  const i = RUEDA_MONTH;
  const areas = STATE.rueda.areas;
  const vals = STATE.rueda.meses[i];
  const prom = (vals.reduce((a, b) => a + b, 0) / areas.length).toFixed(1);

  const sliders = areas.map((a, k) => `
    <div class="field" style="margin-bottom:12px">
      <div class="flex-between"><label style="margin:0">${a}</label><span class="chip chip--cian" id="rv-${k}">${vals[k]}</span></div>
      <input type="range" min="0" max="10" step="1" style="width:100%;accent-color:var(--cian)"
        data-bind="rueda.meses.${i}.${k}" data-type="num" data-live value="${vals[k]}">
    </div>`).join("");

  return `
  ${monthsSelector(i, "rueda-month")}
  <div class="grid grid-2">
    <div class="card">
      <div class="card__head"><div class="card__title">${MESES[i]}</div><span class="chip chip--cian">Promedio ${prom}</span></div>
      <div class="radar-wrap">
        <svg id="radar" viewBox="0 0 360 360" width="100%" style="max-width:380px">${radarStatic()}
          <polygon id="radarPoly" points="" fill="rgba(23,195,178,0.22)" stroke="var(--cian)" stroke-width="2"/>
          <g id="radarDots"></g>
        </svg>
      </div>
    </div>
    <div class="card">
      <div class="card__title mb-0">Puntúa cada área (0–10)</div>
      <div class="mt-16">${sliders}</div>
    </div>
  </div>`;
}
function radarStatic() {
  // grillas concéntricas + ejes
  const cx = 180, cy = 180, R = 130, n = STATE.rueda.areas.length;
  let g = "";
  for (let ring = 1; ring <= 5; ring++) {
    const r = (R * ring) / 5;
    const pts = ptsPolygon(cx, cy, r, n);
    g += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }
  for (let k = 0; k < n; k++) {
    const [x, y] = pointAt(cx, cy, R, k, n);
    g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    const [lx, ly] = pointAt(cx, cy, R + 22, k, n);
    const label = STATE.rueda.areas[k].split(" ")[0];
    g += `<text x="${lx}" y="${ly}" fill="var(--text-muted)" font-size="9" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
  }
  return g;
}
function pointAt(cx, cy, r, k, n) {
  const ang = (Math.PI * 2 * k) / n - Math.PI / 2;
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
}
function ptsPolygon(cx, cy, r, n) {
  return Array.from({ length: n }, (_, k) => pointAt(cx, cy, r, k, n).map(v => v.toFixed(1)).join(",")).join(" ");
}
function drawRadar() {
  const i = RUEDA_MONTH, vals = STATE.rueda.meses[i], n = vals.length, cx = 180, cy = 180, R = 130;
  const poly = document.getElementById("radarPoly");
  const dots = document.getElementById("radarDots");
  if (!poly) return;
  const pts = vals.map((v, k) => pointAt(cx, cy, (R * v) / 10, k, n));
  poly.setAttribute("points", pts.map(p => p.map(x => x.toFixed(1)).join(",")).join(" "));
  dots.innerHTML = pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--coral)"/>`).join("");
}

/* ============================================================
   APRENDIZAJES + TEMAS DE INTERÉS
   ============================================================ */
function renderAprendizajes() {
  const prof = STATE.aprendizajes.filter(a => a.tipo === "prof");
  const inter = STATE.aprendizajes.filter(a => a.tipo === "interes");
  const list = arr => arr.length ? arr.map(a => `
    <div class="item-row">
      <span class="check ${a.done ? "is-on" : ""}" data-action="apr-toggle" data-id="${a.id}">${a.done ? "✓" : ""}</span>
      <div class="item-row__main"><div class="item-row__title ${a.done ? "strike" : ""}">${escapeHtml(a.tema)}</div>
        ${a.objetivo ? `<div class="item-row__sub">${escapeHtml(a.objetivo)}</div>` : ""}</div>
      <button class="icon-btn" data-action="apr-del" data-id="${a.id}">🗑</button>
    </div>`).join("") : '<div class="empty">Nada aún.</div>';
  const chip = arr => `<span class="chip">${arr.filter(a => a.done).length}/${arr.length}</span>`;
  return `
  <div class="grid grid-2">
    <div class="card">
      <div class="card__head"><div class="card__title">🧠 Aprendizajes profesionales</div>
        <div class="row" style="gap:6px">${chip(prof)}<button class="btn-ghost" data-action="apr-add" data-tipo="prof">+ Agregar</button></div></div>
      ${list(prof)}
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">💡 Temas de interés</div>
        <div class="row" style="gap:6px">${chip(inter)}<button class="btn-ghost" data-action="apr-add" data-tipo="interes">+ Agregar</button></div></div>
      ${list(inter)}
    </div>
  </div>`;
}
let APR_TIPO = "prof";
function openAprModal(tipo) {
  APR_TIPO = tipo;
  openModal(tipo === "prof" ? "Nuevo aprendizaje profesional" : "Nuevo tema de interés", `
    <div class="field"><label>Tema</label><input class="input" id="ap-tema" placeholder="Ej: Copilot Studio"></div>
    <div class="field"><label>Objetivo</label><input class="input" id="ap-obj" placeholder="¿Para qué?"></div>
    <button class="btn btn--primary btn-block" data-action="apr-save">Agregar</button>`);
}
function saveApr() {
  const tema = val("ap-tema"); if (!tema) return toast("Falta el tema", true);
  STATE.aprendizajes.push({ id: uid(), tema, objetivo: val("ap-obj"), tipo: APR_TIPO, done: false });
  saveState(); closeModal(); rerender(); toast("Agregado");
}

/* ============================================================
   ANOTACIONES
   ============================================================ */
function renderNotas() {
  /* Captura rápida (bandeja de ideas) */
  const ideas = STATE.vida.ideas || [];
  const pend = ideas.filter(i => !i.hecha);
  const done = ideas.filter(i => i.hecha);
  const ideaRow = i => `<div class="item-row">
    <span class="check ${i.hecha ? "is-on" : ""}" data-action="idea-toggle" data-id="${i.id}">${i.hecha ? "✓" : ""}</span>
    <div class="item-row__main"><div class="item-row__title ${i.hecha ? "strike" : ""}">${escapeHtml(i.texto)}</div></div>
    <button class="icon-btn" data-action="idea-del" data-id="${i.id}">🗑</button></div>`;
  const captura = `
  <div class="card">
    <div class="card__head"><div class="card__title">💡 Captura rápida</div><span class="chip">${pend.length} pendientes</span></div>
    <div class="row"><input class="input" id="idea-input" placeholder="Anota una idea o pendiente y suéltalo aquí...">
      <button class="btn btn--cian" data-action="idea-add" data-input="idea-input">+</button></div>
    <div class="mt-16">${pend.length ? pend.map(ideaRow).join("") : '<div class="empty">Bandeja vacía. ✨</div>'}</div>
    ${done.length ? `<div class="divider"></div><div class="text-xs muted" style="margin-bottom:8px">Procesadas</div>${done.map(ideaRow).join("")}` : ""}
  </div>`;

  /* Categorías (notas organizadas) */
  const cats = STATE.notas.length
    ? `<div class="grid grid-2 mt-16">${STATE.notas.map(c => `<div class="card">
        <div class="card__head"><div class="card__title">${escapeHtml(c.nombre)}</div>
          <div class="row" style="gap:4px">
            <button class="btn-ghost" data-action="nota-add" data-cat="${c.id}">+ Nota</button>
            <button class="icon-btn" data-action="cat-del" data-cat="${c.id}">🗑</button></div></div>
        ${c.items.length ? c.items.map(n => `<div class="item-row">
          <div class="item-row__main"><div class="item-row__title">${escapeHtml(n.titulo)}</div>
            ${n.texto ? `<div class="item-row__sub">${escapeHtml(n.texto)}</div>` : ""}</div>
          <button class="icon-btn" data-action="nota-del" data-cat="${c.id}" data-id="${n.id}">🗑</button></div>`).join("")
        : '<div class="empty" style="padding:14px">Sin notas.</div>'}
      </div>`).join("")}</div>`
    : `<div class="card mt-16"><div class="empty">Crea una categoría para organizar lo que quieras guardar (ej. "Ideas de negocio", "Aprendizajes").</div></div>`;

  return `
  ${captura}
  <div class="flex-between mt-24"><div class="section-title" style="margin:0">🗂️ Categorías</div>
    <button class="btn btn--primary" data-action="nota-add-cat">+ Nueva categoría</button></div>
  ${cats}`;
}
function openNotaCatModal() {
  openModal("Nueva categoría", `
    <div class="field"><label>Nombre</label><input class="input" id="nc-nombre" placeholder="Ej: Ideas de negocio"></div>
    <button class="btn btn--primary btn-block" data-action="nota-cat-save">Crear</button>`);
}
function saveNotaCat() {
  const nombre = val("nc-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.notas.push({ id: uid(), nombre, items: [] });
  saveState(); closeModal(); rerender();
}
let NOTA_CAT = null;
function openNotaModal(catId) {
  NOTA_CAT = catId;
  openModal("Nueva nota", `
    <div class="field"><label>Título</label><input class="input" id="n-titulo" placeholder="Título"></div>
    <div class="field"><label>Detalle</label><textarea class="input" id="n-texto" placeholder="Escribe aquí..."></textarea></div>
    <button class="btn btn--primary btn-block" data-action="nota-save">Guardar nota</button>`);
}
function saveNota() {
  const titulo = val("n-titulo"); if (!titulo) return toast("Falta el título", true);
  const c = STATE.notas.find(c => c.id === NOTA_CAT);
  c.items.push({ id: uid(), titulo, texto: val("n-texto") });
  saveState(); closeModal(); rerender();
}

/* ============================================================
   CALENDARIO
   ============================================================ */
// Reúne todo lo que tiene fecha en el mes: eventos, rituales, cumpleaños y libros terminados.
function calMonthItems(year, m) {
  const map = {}; // día -> [{icon,label,cls,type,date?}]
  const push = (day, it) => { (map[day] = map[day] || []).push(it); };
  const nDays = daysInMonth(year, m);
  const mm = String(m + 1).padStart(2, "0");

  // Eventos manuales
  for (const iso in STATE.eventos) {
    const p = iso.split("-").map(Number);
    if (p[0] === year && p[1] === m + 1)
      (STATE.eventos[iso] || []).forEach(e => push(p[2], { icon: "📌", label: e, cls: "cian", type: "evento", date: iso }));
  }
  // Rituales (abierto / cerrado)
  for (let d = 1; d <= nDays; d++) {
    const iso = `${year}-${mm}-${String(d).padStart(2, "0")}`;
    const r = STATE.ritual.dias[iso];
    if (r) push(d, r.cerrado
      ? { icon: "🌙", label: "Ritual cerrado", cls: "coral", type: "ritual" }
      : { icon: "🌅", label: "Día abierto", cls: "soft", type: "ritual" });
  }
  // Cumpleaños (mes + día, recurrente)
  (STATE.vida.relaciones || []).forEach(pn => {
    if (!pn.cumple) return;
    const p = pn.cumple.split("-").map(Number);
    if (p.length === 3 && p[1] === m + 1 && p[2] >= 1 && p[2] <= nDays)
      push(p[2], { icon: "🎂", label: `Cumpleaños de ${pn.nombre}`, cls: "coral", type: "cumple" });
  });
  // Libros terminados
  (STATE.lecturas || []).forEach(l => {
    if (!l.fin) return;
    const p = l.fin.split("-").map(Number);
    if (p[0] === year && p[1] === m + 1) push(p[2], { icon: "📖", label: `Terminaste “${l.titulo}”`, cls: "cian", type: "libro" });
  });
  return map;
}

function renderCalendario() {
  const m = CAL_MONTH, year = STATE.settings.year;
  const first = new Date(year, m, 1);
  let startDow = (first.getDay() + 6) % 7; // lunes = 0
  const nDays = daysInMonth(year, m);
  const items = calMonthItems(year, m);
  const cells = [];
  for (let k = 0; k < startDow; k++) cells.push("");
  for (let d = 1; d <= nDays; d++) cells.push(d);

  const head = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
    .map(d => `<th style="padding:8px;font-size:11px;color:var(--text-muted);text-align:center">${d}</th>`).join("");

  let rows = "", i = 0;
  while (i < cells.length) {
    let tr = "<tr>";
    for (let c = 0; c < 7; c++, i++) {
      const d = cells[i];
      if (!d) { tr += `<td class="cal-cell cal-cell--empty"></td>`; continue; }
      const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const its = items[d] || [];
      const isToday = iso === todayISO();
      const dots = its.filter(x => x.type !== "evento");
      const evs = its.filter(x => x.type === "evento");
      tr += `<td class="cal-cell ${isToday ? "cal-cell--today" : ""}" data-action="cal-add" data-date="${iso}">
        <div class="cal-num">${d}</div>
        ${dots.length ? `<div class="cal-dots">${dots.map(x => `<span title="${escapeAttr(x.label)}">${x.icon}</span>`).join("")}</div>` : ""}
        ${evs.slice(0, 2).map(e => `<div class="cal-ev cal-ev--${e.cls}" title="${escapeAttr(e.label)}">${escapeHtml(e.label.length > 15 ? e.label.slice(0, 14) + "…" : e.label)}</div>`).join("")}
        ${evs.length > 2 ? `<div class="cal-more">+${evs.length - 2}</div>` : ""}
      </td>`;
    }
    tr += "</tr>"; rows += tr;
  }

  // Agenda del mes: todo lo fechado, ordenado por día
  const agenda = [];
  Object.keys(items).map(Number).sort((a, b) => a - b).forEach(day =>
    items[day].forEach(it => agenda.push({ day, ...it })));
  const agendaHtml = agenda.length
    ? agenda.map(it => {
        const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(it.day).padStart(2, "0")}`;
        const clickable = it.type === "evento" ? `data-action="cal-add" data-date="${iso}" style="cursor:pointer"` : "";
        return `<div class="agenda-row" ${clickable}>
          <span class="agenda-day">${String(it.day).padStart(2, "0")}</span>
          <span class="agenda-ico">${it.icon}</span>
          <span class="agenda-label">${escapeHtml(it.label)}</span></div>`;
      }).join("")
    : `<div class="empty">Nada agendado este mes. Haz clic en un día para añadir un evento.</div>`;

  // Resumen del mes (chips)
  const nCumple = agenda.filter(x => x.type === "cumple").length;
  const nLibro = agenda.filter(x => x.type === "libro").length;
  const nRitual = agenda.filter(x => x.type === "ritual").length;
  const metasMes = (STATE.metas.mensuales[m] || []);
  const resumen = `<div class="cal-summary">
    <span class="chip">🌙 ${nRitual} ${nRitual === 1 ? "ritual" : "rituales"}</span>
    <span class="chip">🎂 ${nCumple} cumpleaños</span>
    <span class="chip">📖 ${nLibro} ${nLibro === 1 ? "libro" : "libros"}</span>
    <span class="chip">🎯 ${metasMes.filter(g => g.done).length}/${metasMes.length} metas</span>
  </div>`;

  return `
  ${monthNav(m, "cal-goto", "cal")}
  ${resumen}
  <div class="card mt-16" style="overflow-x:auto">
    <table class="cal-table">
      <thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <div class="cal-legend">
      <span>🌅 Día abierto</span><span>🌙 Ritual cerrado</span><span>🎂 Cumpleaños</span><span>📖 Libro terminado</span><span>📌 Evento</span>
    </div>
  </div>
  <div class="section-title">Agenda de ${MESES[m]}</div>
  <div class="card">${agendaHtml}</div>`;
}
let EVENTO_DATE = null;
function openEventoModal(date) {
  EVENTO_DATE = date;
  const evs = STATE.eventos[date] || [];
  openModal("Eventos · " + date, `
    ${evs.map((e, i) => `<div class="item-row"><div class="item-row__main">${escapeHtml(e)}</div>
      <button class="icon-btn" data-action="evento-del" data-date="${date}" data-i="${i}">🗑</button></div>`).join("")}
    <div class="field mt-8"><label>Nuevo evento</label><input class="input" id="ev-txt" placeholder="Ej: Cumpleaños..."></div>
    <button class="btn btn--primary btn-block" data-action="evento-save">Agregar</button>`);
}
function saveEvento() {
  const txt = val("ev-txt"); if (!txt) return;
  STATE.eventos[EVENTO_DATE] = STATE.eventos[EVENTO_DATE] || [];
  STATE.eventos[EVENTO_DATE].push(txt);
  saveState(); closeModal(); rerender();
}

/* ============================================================
   afterRender hook
   ============================================================ */
function afterRender(route) {
  if (route === "rueda") {
    drawRadar();
    LIVE_HOOK = (el) => {
      const k = el.dataset.bind.split(".").pop();
      const badge = document.getElementById("rv-" + k);
      if (badge) badge.textContent = el.value;
      drawRadar();
    };
  }
}
