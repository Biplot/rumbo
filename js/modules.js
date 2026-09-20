/* ============================================================
   RUMBO · Módulos (render + modales)
   ============================================================ */

let SALUD_MONTH = new Date().getMonth();
let RUEDA_MONTH = new Date().getMonth();
let CAL_MONTH = new Date().getMonth();

/* Selector de meses reutilizable */
function monthsSelector(current, action) {
  return `<div class="months">${MESES.map((m, i) =>
    `<button class="${i === current ? "is-active" : ""}" data-action="${action}" data-m="${i}">${m}</button>`).join("")}</div>`;
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

  const triCards = tri.map((list, i) => {
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
   HÁBITOS
   ============================================================ */
function renderHabitos() {
  const m = HABIT_MONTH;
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
      ${cells}<td style="font-weight:600;color:var(--cian)">${pct}%</td></tr>`;
  }).join("");

  return `
  <div class="flex-between" style="flex-wrap:wrap;gap:12px">
    <div class="pill pill--streak">🔥 Racha: ${computeStreak()} días</div>
    <button class="btn btn--primary" data-action="habit-add">+ Nuevo hábito</button>
  </div>
  ${monthsSelector(m, "habit-month")}
  <div class="card habit-grid">
    ${defs.length ? `<table><thead>${header}</thead><tbody>${rows}</tbody></table>`
      : '<div class="empty">Aún no tienes hábitos. Crea el primero con “+ Nuevo hábito”.</div>'}
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
   LECTURAS
   ============================================================ */
function renderLecturas() {
  const cards = STATE.lecturas.map((l, i) => {
    const pct = l.finalizado ? 100 : l.iniciado ? 50 : 0;
    return `<div class="card">
      <div class="card__head">
        <div class="card__title" style="font-size:14px">${MESES[i]}</div>
        <div class="row" style="gap:6px">
          <span class="chip ${l.iniciado ? "chip--cian" : ""}" data-action="lect-toggle" data-idx="${i}" data-field="iniciado" style="cursor:pointer">I</span>
          <span class="chip ${l.finalizado ? "chip--done" : ""}" data-action="lect-toggle" data-idx="${i}" data-field="finalizado" style="cursor:pointer">F</span>
        </div>
      </div>
      <input class="input" data-bind="lecturas.${i}.titulo" placeholder="Título del libro..." value="${escapeAttr(l.titulo)}">
      <div class="row mt-8">
        <div style="flex:1"><label class="text-xs muted">Inicio</label>
          <input class="input" type="date" data-bind="lecturas.${i}.inicio" data-render="no" value="${l.inicio || ""}"></div>
        <div style="flex:1"><label class="text-xs muted">Fin</label>
          <input class="input" type="date" data-bind="lecturas.${i}.fin" data-render="no" value="${l.fin || ""}"></div>
      </div>
      <div class="bar mt-16"><div class="bar__fill ${l.finalizado ? "" : "bar__fill--coral"}" style="width:${pct}%"></div></div>
    </div>`;
  }).join("");
  const leidos = STATE.lecturas.filter(l => l.finalizado).length;
  return `
  <div class="card" style="background:linear-gradient(120deg, var(--surface), var(--surface-2))">
    <div class="flex-between"><div><div class="text-xs soft" style="text-transform:uppercase;letter-spacing:.08em">${STATE.settings.year}</div>
      <div class="big-num">${leidos} <span class="text-sm muted">libros terminados</span></div></div>
      <div class="stat__ico" style="width:48px;height:48px;font-size:24px">📚</div></div>
  </div>
  <div class="grid grid-3 mt-24">${cards}</div>`;
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
    ${statCard("⚖️", "Peso actual", pesoActual != null ? pesoActual + " kg" : "—", "Meta " + s.pesoObjetivo + " kg")}
    ${statCard("🎯", "Peso objetivo", `<input class="input" style="width:90px" type="text" inputmode="numeric" data-bind="salud.pesoObjetivo" data-type="num" value="${s.pesoObjetivo}">`, "kg")}
  </div>

  ${monthsSelector(i, "salud-month")}

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
  const list = (arr, tipo) => arr.length ? arr.map(a => `
    <div class="item-row">
      <div class="item-row__main"><div class="item-row__title">${escapeHtml(a.tema)}</div>
        <div class="item-row__sub">${escapeHtml(a.objetivo)}</div></div>
      <button class="icon-btn" data-action="apr-del" data-id="${a.id}">🗑</button>
    </div>`).join("") : '<div class="empty">Nada aún.</div>';
  return `
  <div class="grid grid-2">
    <div class="card">
      <div class="card__head"><div class="card__title">🧠 Aprendizajes profesionales</div>
        <button class="btn-ghost" data-action="apr-add" data-tipo="prof">+ Agregar</button></div>
      ${list(prof, "prof")}
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">💡 Temas de interés</div>
        <button class="btn-ghost" data-action="apr-add" data-tipo="interes">+ Agregar</button></div>
      ${list(inter, "interes")}
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
  STATE.aprendizajes.push({ id: uid(), tema, objetivo: val("ap-obj"), tipo: APR_TIPO });
  saveState(); closeModal(); rerender(); toast("Agregado");
}

/* ============================================================
   ANOTACIONES
   ============================================================ */
function renderNotas() {
  if (!STATE.notas.length)
    return `<div class="flex-between"><div class="card__title">Tus categorías y notas</div>
      <button class="btn btn--primary" data-action="nota-add-cat">+ Nueva categoría</button></div>
      <div class="card mt-16"><div class="empty">Todavía no creas ninguna categoría. Empieza con la primera.</div></div>`;
  return `
  <div class="flex-between"><div class="card__title">Tus categorías y notas</div>
    <button class="btn btn--primary" data-action="nota-add-cat">+ Nueva categoría</button></div>
  <div class="grid grid-2 mt-16">
    ${STATE.notas.map(c => `<div class="card">
      <div class="card__head"><div class="card__title">${escapeHtml(c.nombre)}</div>
        <div class="row" style="gap:4px">
          <button class="btn-ghost" data-action="nota-add" data-cat="${c.id}">+ Nota</button>
          <button class="icon-btn" data-action="cat-del" data-cat="${c.id}">🗑</button></div></div>
      ${c.items.length ? c.items.map(n => `<div class="item-row">
        <div class="item-row__main"><div class="item-row__title">${escapeHtml(n.titulo)}</div>
          ${n.texto ? `<div class="item-row__sub">${escapeHtml(n.texto)}</div>` : ""}</div>
        <button class="icon-btn" data-action="nota-del" data-cat="${c.id}" data-id="${n.id}">🗑</button></div>`).join("")
      : '<div class="empty" style="padding:14px">Sin notas.</div>'}
    </div>`).join("")}
  </div>`;
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
function renderCalendario() {
  const m = CAL_MONTH, year = STATE.settings.year;
  const first = new Date(year, m, 1);
  let startDow = (first.getDay() + 6) % 7; // lunes = 0
  const nDays = daysInMonth(year, m);
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
      if (!d) { tr += `<td style="height:92px;border:1px solid var(--line)"></td>`; continue; }
      const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const evs = STATE.eventos[iso] || [];
      const isToday = iso === todayISO();
      tr += `<td style="height:92px;border:1px solid var(--line);vertical-align:top;padding:6px;cursor:pointer" data-action="cal-add" data-date="${iso}">
        <div style="font-size:12px;font-weight:600;color:${isToday ? "var(--coral)" : "var(--text-soft)"}">${d}</div>
        ${evs.map((e, ei) => `<div class="chip chip--cian" style="display:block;margin-top:3px;font-size:10.5px;padding:3px 6px" title="${escapeAttr(e)}">${escapeHtml(e.length > 16 ? e.slice(0, 15) + "…" : e)}</div>`).join("")}
      </td>`;
    }
    tr += "</tr>"; rows += tr;
  }

  return `
  <div class="flex-between">
    <button class="btn--soft btn" data-action="cal-prev">‹</button>
    <div class="card__title">${MESES[m]} ${year}</div>
    <button class="btn--soft btn" data-action="cal-next">›</button>
  </div>
  <div class="card mt-16" style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;min-width:640px">
      <thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <p class="text-xs muted mt-8">Haz clic en un día para agregar un evento.</p>
  </div>`;
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
