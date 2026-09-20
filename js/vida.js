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
function renderDiario() {
  const entries = STATE.vida.diario;
  const ultimos = entries.slice(-14);
  const strip = ultimos.length ? `<div class="row-wrap" style="gap:6px">${ultimos.map(e =>
    `<span title="${fechaCorta(e.fecha)}" style="font-size:20px">${MOODS[e.mood - 1]}</span>`).join("")}</div>` : "";

  return `
  <div class="grid grid-2">
    <div class="card">
      <div class="card__title">¿Cómo estuvo tu día?</div>
      <div class="row mt-16" id="di-moods" style="gap:8px">
        ${MOODS.map((m, i) => `<button type="button" class="mood-btn ${i === 2 ? "is-on" : ""}" data-v="${i + 1}" onclick="moodPick(this)">${m}</button>`).join("")}
      </div>
      <input type="hidden" id="di-mood" value="3">
      <textarea class="input mt-16" id="di-texto" placeholder="¿Qué pasó hoy? ¿Cómo te sentiste?"></textarea>
      <input class="input mt-8" id="di-grat" placeholder="Algo que agradeces hoy 💛">
      <button class="btn btn--primary btn-block mt-16" data-action="diario-save">Guardar entrada (+10 ⭐)</button>
    </div>
    <div class="card">
      <div class="card__title mb-0">Tu ánimo reciente</div>
      <div class="mt-16">${strip || '<div class="empty">Aún no registras entradas.</div>'}</div>
      ${entries.length ? `<div class="divider"></div><div class="flex-between"><span class="soft text-sm">Entradas escritas</span><span class="big-num" style="font-size:22px">${entries.length}</span></div>` : ""}
    </div>
  </div>

  <div class="section-title">Entradas</div>
  ${entries.length ? entries.slice().reverse().map(e => `<div class="card" style="margin-bottom:12px">
    <div class="flex-between"><div class="row" style="gap:10px"><span style="font-size:24px">${MOODS[e.mood - 1]}</span>
      <div class="text-sm soft">${fechaCorta(e.fecha)}</div></div>
      <button class="icon-btn" data-action="diario-del" data-id="${e.id}">🗑</button></div>
    ${e.texto ? `<div class="mt-8">${escapeHtml(e.texto)}</div>` : ""}
    ${e.gratitud ? `<div class="chip chip--coral mt-8">💛 ${escapeHtml(e.gratitud)}</div>` : ""}
  </div>`).join("") : '<div class="card"><div class="empty">Escribe tu primera entrada arriba.</div></div>'}`;
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
function renderRelaciones() {
  const gente = STATE.vida.relaciones.slice().sort((a, b) => (diasHastaCumple(a.cumple) ?? 999) - (diasHastaCumple(b.cumple) ?? 999));
  return `
  <div class="flex-between"><div class="card__title" style="margin:0">Tu gente</div>
    <button class="btn btn--primary" data-action="rel-add">+ Agregar persona</button></div>
  <div class="grid grid-3 mt-16">
    ${gente.length ? gente.map(p => {
      const dCumple = diasHastaCumple(p.cumple);
      const dCont = diasDesde(p.ultimoContacto);
      const cumpleSoon = dCumple != null && dCumple <= 14;
      return `<div class="card" style="${cumpleSoon ? "border-color:var(--coral)" : ""}">
        <div class="flex-between"><div class="card__title" style="font-size:15px">${escapeHtml(p.nombre)}</div>
          <button class="icon-btn" data-action="rel-del" data-id="${p.id}">🗑</button></div>
        <div class="text-xs muted">${escapeHtml(p.vinculo || "")}</div>
        <div class="divider"></div>
        ${p.cumple ? `<div class="text-sm ${cumpleSoon ? "hl-coral" : "soft"}">🎂 ${dCumple === 0 ? "¡Hoy es su cumple!" : "Cumple en " + dCumple + " días"}</div>` : ""}
        <div class="text-sm soft mt-8">💬 ${dCont == null ? "Sin registro" : dCont === 0 ? "Hablaste hoy" : "Hace " + dCont + " días"}</div>
        <button class="btn btn--soft btn-block mt-8" data-action="rel-contacto" data-id="${p.id}">Hablé hoy</button>
      </div>`;
    }).join("") : '<div class="card"><div class="empty">Agrega a las personas que quieres cuidar.</div></div>'}
  </div>`;
}
function openRelModal() {
  openModal("Nueva persona", `
    <div class="field"><label>Nombre</label><input class="input" id="rel-nombre" placeholder="Ej: Ignacia"></div>
    <div class="field"><label>Vínculo</label><input class="input" id="rel-vinculo" placeholder="Ej: Pareja, amigo, mamá..."></div>
    <div class="field"><label>Cumpleaños</label><input class="input" type="date" id="rel-cumple"></div>
    <button class="btn btn--primary btn-block" data-action="rel-save">Agregar</button>`);
}
function saveRel() {
  const nombre = val("rel-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.vida.relaciones.push({ id: uid(), nombre, vinculo: val("rel-vinculo"), cumple: val("rel-cumple"), ultimoContacto: todayISO() });
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
    ${listas.length ? listas.map(l => {
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
    }).join("") : '<div class="card"><div class="empty">Crea tu primera lista.</div></div>'}
  </div>`;
}
function openListaModal() {
  const iconos = ["🛒", "🎬", "✈️", "📚", "🎵", "🎁", "🍽️", "🏋️", "💡", "✅"];
  openModal("Nueva lista", `
    <div class="field"><label>Nombre</label><input class="input" id="lst-nombre" placeholder="Ej: Compras"></div>
    <div class="field"><label>Ícono</label><div class="row-wrap" id="lst-iconos">${iconos.map(ic =>
      `<button type="button" class="btn btn--soft" style="padding:8px 12px" data-ic="${ic}" onclick="listaIconPick(this)">${ic}</button>`).join("")}</div>
      <input type="hidden" id="lst-icon" value="🛒"></div>
    <button class="btn btn--primary btn-block" data-action="lista-save">Crear lista</button>`);
}
function listaIconPick(btn) {
  document.getElementById("lst-icon").value = btn.dataset.ic;
  document.querySelectorAll("#lst-iconos .btn").forEach(b => b.classList.remove("btn--cian"));
  btn.classList.add("btn--cian");
}
function saveLista() {
  const nombre = val("lst-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.vida.listas.push({ id: uid(), nombre, icon: val("lst-icon") || "📄", items: [] });
  saveState(); closeModal(); rerender();
}
