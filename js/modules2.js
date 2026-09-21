/* ============================================================
   RUMBO · Módulos añadidos (inspirados en Huella)
   Ritual Matutino · Planificador semanal · Entrenamiento
   ============================================================ */

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const PILARES = ["Psicología", "Fisiología", "Productividad", "Magnetismo", "Presencia", "Propósito"];
const PILARES_INFO = {
  "Psicología": { icon: "🧠", desc: "Tu mentalidad y claridad: cómo te hablas, tu actitud y dónde pones el foco mental." },
  "Fisiología": { icon: "⚡", desc: "Tu energía física: sueño, movimiento, alimentación e hidratación." },
  "Productividad": { icon: "🎯", desc: "Enfocarte en lo que de verdad mueve la aguja y ejecutarlo, no en lo urgente-trivial." },
  "Magnetismo": { icon: "🧲", desc: "Cómo te conectas e influyes en otros: tu carisma, generosidad y relaciones." },
  "Presencia": { icon: "🧘", desc: "Estar plenamente en el momento, sin distracción ni piloto automático." },
  "Propósito": { icon: "🌟", desc: "Tu porqué: el sentido y la dirección detrás de lo que haces." },
};
function openPilaresInfo() {
  openModal("Los 6 pilares del Alto Rendimiento", `
    <p class="text-sm muted" style="margin-bottom:14px">Cada vez que abres tu ritual eliges el pilar en el que quieres enfocarte ese día. Con el tiempo ves cuáles cultivas más.</p>
    ${PILARES.map(p => `<div class="row" style="gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)">
      <span style="font-size:22px;line-height:1">${PILARES_INFO[p].icon}</span>
      <div><div class="card__title" style="font-size:14.5px">${p}</div>
        <div class="text-xs muted mt-8">${PILARES_INFO[p].desc}</div></div></div>`).join("")}`);
}

/* ============================================================
   RITUAL MATUTINO
   ============================================================ */
function renderRitual() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  const hecho = r && r.hecho;
  const logros = Object.values(STATE.ritual.dias).filter(x => x.hecho).length;
  const maxPilar = Math.max(1, ...Object.values(STATE.ritual.pilares));

  const cerrado = r && r.cerrado;
  let banner;
  if (!hecho) {
    banner = `<div class="card" style="background:linear-gradient(120deg, var(--coral), #ff8a70);color:#fff">
      <div class="card__title" style="color:#fff">¿Listo para tu ritual de apertura?</div>
      <p class="mt-8" style="opacity:.9">Dos minutos para elegir tu enfoque del día.</p>
      <button class="btn" style="background:#fff;color:var(--coral)" data-action="day-open">Comenzar ritual</button></div>`;
  } else if (!cerrado) {
    banner = `<div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">✅ Día abierto — a ejecutar</div>
        <div class="text-sm soft mt-8">Cuando termines tu día, ciérralo para reflexionar.</div></div>
        <div class="row" style="gap:8px"><button class="btn btn--soft" data-action="day-open">Editar apertura</button>
          <button class="btn btn--primary" data-action="day-close">🌙 Cerrar el día</button></div></div></div>`;
  } else {
    banner = `<div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">🌙 Día cerrado</div>
        <div class="text-sm soft mt-8">${escapeHtml((r.cierre && r.cierre.mejor) || "Ritual completo. Mañana volvemos a empezar.")}</div></div>
        <button class="btn btn--soft" data-action="day-close">Editar cierre</button></div></div>`;
  }

  const box = (titulo, contenido, vacio) => `<div class="card ritual-card">
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em">${titulo}</div>
    <div class="mt-8">${contenido || `<span class="muted">${vacio}</span>`}</div></div>`;

  const energia = r && r.energia
    ? `<div class="energy">${Array.from({ length: 5 }, (_, i) => `<span class="${i < r.energia ? "on" : ""}"></span>`).join("")}</div>`
    : `<span class="muted">Sin definir</span>`;

  return `
  <div class="flex-between" style="flex-wrap:wrap;gap:10px">
    <div class="pill pill--streak">🔥 Racha de ritual: ${computeRitualStreak()} días</div>
    <div class="pill pill--pts">🏆 ${logros} rituales completados</div>
  </div>
  <div class="mt-16">${banner}</div>

  <div class="grid grid-3 mt-24">
    ${box("Misión de hoy", r && escapeHtml(r.mision), "Todavía no defines tu misión.")}
    ${box("Tu SAPO de hoy", r && escapeHtml(r.sapo), "La tarea que más evitas.")}
    ${box("Pilar de hoy", r && r.pilar ? `<span class="chip chip--cian">${escapeHtml(r.pilar)}</span>` : "", "No elegido.")}
    ${box("Nivel de energía", energia)}
    ${box("A quién sirves hoy", r && escapeHtml(r.servir), "No definido.")}
    ${box("Proyectos de hoy", r && r.proyectos && r.proyectos.length ? r.proyectos.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join(" ") : "", "Sin proyectos.")}
  </div>

  <div class="card mt-24">
    <div class="card__head"><div class="card__title">Los 6 pilares del Alto Rendimiento</div>
      <button class="icon-btn" data-action="pilares-info" title="¿Qué son?" aria-label="Explicación" style="font-size:18px">❔</button></div>
    <div class="mt-16">
      ${PILARES.map(p => {
        const v = STATE.ritual.pilares[p] || 0;
        return `<div class="pilar-row"><span style="width:110px" class="text-sm">${p}</span>
          <div class="bar"><div class="bar__fill" style="width:${Math.round((v / maxPilar) * 100)}%"></div></div>
          <span class="chip">${v}</span></div>`;
      }).join("")}
    </div>
  </div>`;
}

function openRitualModal() {
  const r = STATE.ritual.dias[todayISO()] || {};
  let misionDefault = r.mision || "";
  if (!misionDefault) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yc = STATE.ritual.dias[isoLocal(y)];
    if (yc && yc.cierre && yc.cierre.manana) misionDefault = yc.cierre.manana;
  }
  const wd = (new Date().getDay() + 6) % 7;
  const otrasTareas = (STATE.semana.dias[wd] || []).filter(t => !t.esSapo).map(t => t.txt).join("\n");
  openModal("Ritual de apertura", `
    <div class="field"><label>Misión de hoy</label><input class="input" id="r-mision" value="${escapeAttr(misionDefault)}" placeholder="¿Qué hará hoy un gran día?"></div>

    <div class="field"><label>📋 Tareas del día</label>
      <div style="background:var(--coral-soft);border:1px solid rgba(255,107,74,.3);border-radius:var(--r-sm);padding:12px;margin-bottom:10px">
        <label style="color:var(--coral);margin-bottom:6px">🐸 Tu SAPO — la tarea más importante (cómetela primero)</label>
        <input class="input" id="r-sapo" value="${escapeAttr(r.sapo || "")}" placeholder="La que más mueve la aguja hoy">
      </div>
      <label class="text-xs muted" style="display:block;margin-bottom:6px">Otras tareas (una por línea)</label>
      <textarea class="input" id="r-tareas" style="min-height:88px" placeholder="Ej: Llamar al banco&#10;Comprar para la semana">${escapeHtml(otrasTareas)}</textarea>
      <div class="text-xs muted mt-8">El SAPO y estas tareas aparecen juntos en Inicio y en tu Planificador.</div></div>

    <div class="field"><label>Pilar de hoy</label>
      <select class="select" id="r-pilar">${PILARES.map(p => `<option ${r.pilar === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
    <div class="field"><label>Nivel de energía: <span id="r-elabel">${r.energia || 3}</span>/5</label>
      <input type="range" min="1" max="5" step="1" id="r-energia" value="${r.energia || 3}" style="width:100%;accent-color:var(--cian)"
        oninput="document.getElementById('r-elabel').textContent=this.value"></div>
    <div class="field"><label>¿A quién sirves hoy?</label><input class="input" id="r-servir" value="${escapeAttr(r.servir || "")}" placeholder="Persona, equipo, cliente..."></div>
    <div class="field"><label>Proyectos de hoy (separa con comas)</label><input class="input" id="r-proy" value="${escapeAttr((r.proyectos || []).join(", "))}" placeholder="Proyecto A, Proyecto B"></div>
    <button class="btn btn--primary btn-block" data-action="ritual-save">Guardar ritual (+50 ⭐)</button>`);
}
function saveRitual() {
  const iso = todayISO();
  const prev = STATE.ritual.dias[iso];
  const yaHecho = prev && prev.hecho;
  const pilar = document.getElementById("r-pilar").value;
  STATE.ritual.dias[iso] = {
    mision: val("r-mision"), sapo: val("r-sapo"), pilar,
    energia: parseNum(document.getElementById("r-energia").value),
    servir: val("r-servir"),
    proyectos: val("r-proy").split(",").map(s => s.trim()).filter(Boolean),
    hecho: true,
  };
  // Tareas del día -> Planificador semanal (día de hoy). El SAPO es la 1ª tarea (esSapo).
  const wd = (new Date().getDay() + 6) % 7;
  const sapoTxt = val("r-sapo");
  const lines = document.getElementById("r-tareas").value.split("\n").map(s => s.trim()).filter(Boolean);
  const prevTareas = STATE.semana.dias[wd] || [];
  const findPrev = txt => prevTareas.find(t => t.txt === txt);
  const nuevas = [];
  if (sapoTxt) {
    const ex = findPrev(sapoTxt);
    nuevas.push(ex ? { ...ex, esSapo: true } : { id: uid(), txt: sapoTxt, done: false, esSapo: true });
  }
  lines.forEach(txt => {
    if (txt === sapoTxt) return;
    const ex = findPrev(txt);
    nuevas.push(ex ? { ...ex, esSapo: false } : { id: uid(), txt, done: false });
  });
  STATE.semana.dias[wd] = nuevas;

  if (!yaHecho) { STATE.ritual.pilares[pilar] = (STATE.ritual.pilares[pilar] || 0) + 1; addPoints(50); }
  saveState(); closeModal(); updateTopbar(); rerender();
}

function openCierreModal() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  if (!r || !r.hecho) return toast("Primero abre tu día 🌅", true);
  const c = r.cierre || {};
  const dEntry = (STATE.vida.diario || []).find(e => e.fecha === iso && e.fromRitual);
  const moodCur = dEntry ? dEntry.mood : 3;
  const wd = (new Date().getDay() + 6) % 7;
  const sapoTask = (STATE.semana.dias[wd] || []).find(t => t.esSapo);
  const sapoDone = c.sapo !== undefined ? c.sapo : (sapoTask ? sapoTask.done : false);
  const sapoCur = sapoDone ? "1" : "0";
  const segBtn = (grupo, v, label, cur) =>
    `<button type="button" class="${cur === v ? "is-active" : ""}" data-v="${v}" onclick="segPick(this,'${grupo}-v')">${label}</button>`;
  openModal("Ritual de cierre", `
    <div class="field"><label>¿Cómo te sentiste hoy?</label>
      <div class="row mt-8" id="c-moods" style="gap:8px">
        ${MOODS.map((m, i) => `<button type="button" class="mood-btn ${i + 1 === moodCur ? "is-on" : ""}" data-v="${i + 1}" onclick="cierreMoodPick(this)">${m}</button>`).join("")}
      </div><input type="hidden" id="c-mood" value="${moodCur}"></div>
    <div class="field"><label>¿Cumpliste tu misión?</label>
      <div class="seg" id="c-mision">
        ${segBtn("c-mision", "si", "Sí", c.mision || "si")}
        ${segBtn("c-mision", "parcial", "Parcial", c.mision)}
        ${segBtn("c-mision", "no", "No", c.mision)}
      </div><input type="hidden" id="c-mision-v" value="${c.mision || "si"}"></div>
    <div class="field"><label>🐸 ¿Te comiste tu SAPO?${r.sapo ? ` <span class="text-xs muted">(${escapeHtml(r.sapo)})</span>` : ""}</label>
      <div class="seg" id="c-sapo">
        ${segBtn("c-sapo", "1", "Sí", sapoCur)}
        ${segBtn("c-sapo", "0", "No", sapoCur)}
      </div><input type="hidden" id="c-sapo-v" value="${sapoCur}"></div>
    <div class="field"><label>Energía con la que terminas: <span id="c-elabel">${c.energia || 3}</span>/5</label>
      <input type="range" min="1" max="5" step="1" id="c-energia" value="${c.energia || 3}" style="width:100%;accent-color:var(--cian)"
        oninput="document.getElementById('c-elabel').textContent=this.value"></div>
    <div class="field"><label>Lo mejor del día / gratitud</label><textarea class="input" id="c-mejor" placeholder="¿Qué agradeces de hoy?">${escapeHtml(c.mejor || "")}</textarea></div>
    <div class="field"><label>Una cosa para mañana</label><input class="input" id="c-manana" value="${escapeAttr(c.manana || "")}" placeholder="Se sembrará como tu misión de mañana"></div>
    <div class="field"><label>Nota de cierre (libre)</label><textarea class="input" id="c-nota" placeholder="¿Cómo estuvo el día?">${escapeHtml(c.nota || "")}</textarea></div>
    <p class="text-xs muted" style="margin:-4px 0 12px">📔 Tu ánimo, esta nota y tu gratitud se guardan en tu <b>Diario de vida</b>.</p>
    <button class="btn btn--primary btn-block" data-action="cierre-save">Cerrar el día (+40 ⭐)</button>`);
}
function cierreMoodPick(btn) {
  document.getElementById("c-mood").value = btn.dataset.v;
  document.querySelectorAll("#c-moods .mood-btn").forEach(b => b.classList.remove("is-on"));
  btn.classList.add("is-on");
}
function saveCierre() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  if (!r || !r.hecho) return toast("Primero abre tu día 🌅", true);
  const yaCerrado = r.cerrado;
  r.cierre = {
    mision: document.getElementById("c-mision-v").value,
    sapo: document.getElementById("c-sapo-v").value === "1",
    energia: parseNum(document.getElementById("c-energia").value),
    mejor: val("c-mejor"), manana: val("c-manana"), nota: val("c-nota"),
  };
  r.cerrado = true;

  // Conecta el cierre con el Diario de vida: una entrada por día, actualizable
  const mood = parseNum(document.getElementById("c-mood").value) || 3;
  STATE.vida.diario = STATE.vida.diario || [];
  let dEntry = STATE.vida.diario.find(e => e.fecha === iso && e.fromRitual);
  if (!dEntry) { dEntry = { id: uid(), fecha: iso, fromRitual: true }; STATE.vida.diario.push(dEntry); }
  dEntry.mood = mood;
  dEntry.texto = r.cierre.nota || "";
  dEntry.gratitud = r.cierre.mejor || "";

  if (!yaCerrado) addPoints(40);
  saveState(); closeModal(); updateTopbar(); rerender();
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti) launchConfetti();
  toast("Día cerrado 🌙 ¡Descansa!");
}

/* ============================================================
   BITÁCORA · historial de rituales (estilo bullet journal)
   ============================================================ */
let BITA_OPEN = {};

function bitaCard(iso, r) {
  const d = new Date(iso + "T00:00:00");
  const dow = DIAS_SEMANA[(d.getDay() + 6) % 7].slice(0, 3);
  const fecha = `${dow} ${d.getDate()} · ${MESES_CORTO[d.getMonth()]}`;
  const c = r.cierre || {};
  const estadoChip = r.cerrado
    ? `<span class="chip chip--done">🌙 Cerrado</span>`
    : `<span class="chip chip--coral">🌅 Abierto</span>`;
  const energia = r.cerrado ? `${r.energia || "—"} → ${c.energia || "—"}` : `${r.energia || "—"}`;
  const hayExtras = c.mejor || c.nota || c.manana || r.servir || (r.proyectos && r.proyectos.length);
  const open = !!BITA_OPEN[iso];
  const dash = "<span class='muted'>—</span>";
  return `<div class="card bita-day">
    <div class="bita-day__head"><div class="bita-date">${fecha}</div>${estadoChip}</div>
    <div class="bita-row"><span class="bita-k">🎯 Misión</span>
      <span class="bita-v">${r.mision ? escapeHtml(r.mision) : dash} ${r.cerrado ? cumpliChip(c.mision) : ""}</span></div>
    <div class="bita-row"><span class="bita-k">🐸 SAPO</span>
      <span class="bita-v">${r.sapo ? escapeHtml(r.sapo) : dash} ${r.cerrado ? (c.sapo ? "<span class='chip chip--done'>hecho</span>" : "<span class='chip'>pendiente</span>") : ""}</span></div>
    <div class="bita-row"><span class="bita-k">⚡ Energía</span>
      <span class="bita-v">${energia} <span class="muted text-xs">/ 5</span> ${r.pilar ? `<span class="chip chip--cian">${escapeHtml(r.pilar)}</span>` : ""}</span></div>
    ${open ? `
      ${c.mejor ? `<div class="bita-row"><span class="bita-k">🙏 Gratitud</span><span class="bita-v">${escapeHtml(c.mejor)}</span></div>` : ""}
      ${c.nota ? `<div class="bita-row"><span class="bita-k">📝 Nota</span><span class="bita-v">${escapeHtml(c.nota)}</span></div>` : ""}
      ${c.manana ? `<div class="bita-row"><span class="bita-k">🌱 Para mañana</span><span class="bita-v">${escapeHtml(c.manana)}</span></div>` : ""}
      ${r.servir ? `<div class="bita-row"><span class="bita-k">🙌 Serví a</span><span class="bita-v">${escapeHtml(r.servir)}</span></div>` : ""}
      ${r.proyectos && r.proyectos.length ? `<div class="bita-row"><span class="bita-k">📂 Proyectos</span><span class="bita-v">${r.proyectos.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join(" ")}</span></div>` : ""}
    ` : ""}
    ${hayExtras ? `<button class="bita-more" data-action="bita-toggle" data-iso="${iso}">${open ? "▲ Ver menos" : "▼ Ver más"}</button>` : ""}
  </div>`;
}

function renderBitacora() {
  const dias = STATE.ritual.dias || {};
  const entries = Object.entries(dias)
    .filter(([, r]) => r && r.hecho)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)); // más reciente arriba

  const total = entries.length;
  const cerrados = entries.filter(([, r]) => r.cerrado).length;

  const header = `
  <div class="grid grid-3">
    <div class="card stat"><div class="stat__label">📓 Días registrados</div><div class="stat__value">${total}</div></div>
    <div class="card stat"><div class="stat__label">🌙 Días cerrados</div><div class="stat__value">${cerrados}</div></div>
    <div class="card stat"><div class="stat__label">🔥 Racha actual</div><div class="stat__value">${computeClosedStreak()}</div></div>
  </div>`;

  if (!total) {
    return header + `<div class="mt-24"><div class="card"><div class="empty">
      Tu bitácora está vacía por ahora.<br>Abre y cierra tu día en el <b>Ritual Matutino</b> y cada jornada quedará guardada aquí 📓
      <div class="mt-16"><button class="btn btn--primary" data-action="day-open">🌅 Abrir mi día</button></div>
    </div></div></div>`;
  }

  // Agrupar por mes (respetando el orden descendente)
  const groups = []; const idx = {};
  entries.forEach(e => {
    const d = new Date(e[0] + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ y: d.getFullYear(), m: d.getMonth(), items: [] }); }
    groups[idx[key]].items.push(e);
  });

  const body = groups.map(g =>
    `<div class="section-title">${MESES[g.m]} ${g.y}</div>
     <div class="bita-list">${g.items.map(([iso, r]) => bitaCard(iso, r)).join("")}</div>`
  ).join("");

  return header + `<div class="mt-24">${body}</div>`;
}

/* ============================================================
   PLANIFICADOR SEMANAL
   ============================================================ */
function renderSemana() {
  ensureCurrentWeek();
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dow);

  const cols = DIAS_SEMANA.map((nombre, i) => {
    const fecha = new Date(monday); fecha.setDate(monday.getDate() + i);
    const esHoy = isoLocal(fecha) === todayISO();
    const tareas = STATE.semana.dias[i];
    const inputId = `sem-${i}`;
    return `<div class="week-col card" style="${esHoy ? "border-color:var(--coral)" : ""}">
      <div class="flex-between"><div class="card__title" style="font-size:14px">${nombre}</div>
        <span class="dia-badge">${fecha.getDate()}/${MESES_CORTO[fecha.getMonth()]}</span></div>
      <div class="mt-8">
        ${tareas.length ? tareas.map(t => `<div class="item-row" style="padding:8px 10px${t.esSapo ? ";border-color:rgba(255,107,74,.4)" : ""}">
          <span class="check ${t.done ? "is-on" : ""}" data-action="sem-toggle" data-day="${i}" data-id="${t.id}">${t.done ? "✓" : ""}</span>
          <div class="item-row__main"><div class="item-row__title text-sm ${t.done ? "strike" : ""}">${t.esSapo ? "🐸 " : ""}${escapeHtml(t.txt)}</div></div>
          <button class="icon-btn" data-action="sem-del" data-day="${i}" data-id="${t.id}">✕</button></div>`).join("")
        : '<div class="text-xs muted" style="padding:6px">Sin tareas.</div>'}
      </div>
      <div class="row mt-8"><input class="input" id="${inputId}" placeholder="Nueva tarea..." style="padding:8px 10px">
        <button class="btn btn--cian" data-action="sem-add" data-day="${i}" data-input="${inputId}" style="padding:8px 12px">+</button></div>
    </div>`;
  }).join("");

  const total = STATE.semana.dias.flat().length;
  const done = STATE.semana.dias.flat().filter(t => t.done).length;

  return `
  <div class="grid grid-2">
    <div class="card"><div class="text-xs muted" style="text-transform:uppercase">🏆 Tu premio de la semana</div>
      <input class="input mt-8" data-bind="semana.premio" data-render="no" value="${escapeAttr(STATE.semana.premio)}" placeholder="¿Con qué te vas a premiar al cumplir?"></div>
    <div class="card"><div class="flex-between"><div><div class="text-xs muted" style="text-transform:uppercase">Avance semanal</div>
      <div class="big-num">${done}<span class="text-sm muted">/${total} tareas</span></div></div>
      <button class="btn-ghost" data-action="sem-clear">Vaciar semana</button></div>
      <div class="bar mt-8"><div class="bar__fill" style="width:${total ? Math.round(done / total * 100) : 0}%"></div></div></div>
  </div>
  <div class="week-scroll mt-24">${cols}</div>`;
}

/* ============================================================
   ENTRENAMIENTO
   ============================================================ */
function renderEntrenamiento() {
  const e = STATE.entrenamiento;
  const dias = e.dias.map(dia => {
    const done = dia.bloques.filter(b => b.done).length;
    return `<div class="card">
      <div class="card__head"><div class="card__title" style="font-size:15px">${escapeHtml(dia.nombre)}</div>
        <div class="row" style="gap:6px"><span class="chip ${done === dia.bloques.length && dia.bloques.length ? "chip--done" : ""}">${done}/${dia.bloques.length}</span>
        <button class="icon-btn" data-action="entren-del-dia" data-id="${dia.id}">🗑</button></div></div>
      ${dia.bloques.map(b => `<div class="blk">
        <span class="check ${b.done ? "is-on" : ""}" data-action="entren-bloque-toggle" data-dia="${dia.id}" data-id="${b.id}">${b.done ? "✓" : ""}</span>
        <div class="item-row__main"><div class="item-row__title text-sm ${b.done ? "strike" : ""}">${escapeHtml(b.nombre)}</div></div>
        <span class="chip">${escapeHtml(b.series || "")}</span>
        <button class="icon-btn" data-action="entren-del-bloque" data-dia="${dia.id}" data-id="${b.id}">✕</button></div>`).join("")}
      <button class="btn-ghost btn-block mt-8" data-action="entren-add-bloque" data-dia="${dia.id}">+ Bloque</button>
      ${dia.premiado ? '<div class="chip chip--coral mt-8">¡Día completado! +30 ⭐</div>' : ""}
    </div>`;
  }).join("");

  return `
  <div class="card">
    <div class="text-xs muted" style="text-transform:uppercase">🎯 Objetivo</div>
    <textarea class="input mt-8" style="min-height:60px" data-bind="entrenamiento.objetivo" data-render="no" placeholder="¿Qué buscas con tu entrenamiento?">${escapeHtml(e.objetivo)}</textarea>
  </div>
  <div class="flex-between mt-24"><div class="section-title" style="margin:0">Rutina de la semana</div>
    <button class="btn btn--primary" data-action="entren-add-dia">+ Nuevo día</button></div>
  <div class="grid grid-3 mt-16">${dias || '<div class="empty">Aún no tienes días de entrenamiento.</div>'}</div>`;
}

let DIA_TARGET = null;
function openDiaModal() {
  openModal("Nuevo día de entrenamiento", `
    <div class="field"><label>Nombre del día</label><input class="input" id="dia-nombre" placeholder="Ej: Día 4 · Full body"></div>
    <button class="btn btn--primary btn-block" data-action="entren-dia-save">Crear día</button>`);
}
function saveDia() {
  const nombre = val("dia-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.entrenamiento.dias.push({ id: uid(), nombre, premiado: false, bloques: [] });
  saveState(); closeModal(); rerender();
}
function openBloqueModal(diaId) {
  DIA_TARGET = diaId;
  openModal("Nuevo bloque", `
    <div class="field"><label>Nombre del bloque</label><input class="input" id="blk-nombre" placeholder="Ej: Bloque A · Press banca"></div>
    <div class="field"><label>Series x reps</label><input class="input" id="blk-series" placeholder="Ej: 4x8"></div>
    <button class="btn btn--primary btn-block" data-action="entren-bloque-save">Agregar bloque</button>`);
}
function saveBloque() {
  const nombre = val("blk-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  const dia = STATE.entrenamiento.dias.find(x => x.id === DIA_TARGET);
  dia.bloques.push({ id: uid(), nombre, series: val("blk-series"), done: false });
  saveState(); closeModal(); rerender();
}
