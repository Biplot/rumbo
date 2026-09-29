/* ============================================================
   RUMBO · Salud: Resumen · Recetas · Entrenar
   - Resumen: peso con su evolución, días entrenados, receta de la semana y nota del mes.
   - Recetas: tu recetario (STATE.recetas) con buscador, favoritas y rápidas.
   - Entrenar: rutinas con ejercicios reales (STATE.entrenamiento.dias[].bloques) y registro
     de cada entrenamiento (STATE.entrenamiento.registro).
   La comida ("días cocinando") deja de mostrarse, pero sus datos se conservan.
   ============================================================ */
let SALUD_TAB = "resumen";         // resumen | recetas | entrenar
let RECETA_FILTRO = "todas", RECETA_BUSCA = "";
let RUTINA_VER = null;             // rutina que se mira en Entrenar

const DIAS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const dowLunes = iso => (agDate(iso).getDay() + 6) % 7;   // lunes = 0

function renderSalud() {
  const t = (id, txt) => `<button class="tabs__b${SALUD_TAB === id ? " is-active" : ""}" role="tab" aria-selected="${SALUD_TAB === id}" data-action="salud-tab" data-v="${id}">${txt}</button>`;
  const tabs = `<div class="tabs" role="tablist" aria-label="Salud">${t("resumen", "Resumen")}${t("recetas", "Recetas")}${t("entrenar", "Entrenar")}</div>`;
  return tabs + (SALUD_TAB === "recetas" ? saludRecetas() : SALUD_TAB === "entrenar" ? saludEntrenar() : saludResumen());
}
/* La ruta antigua #entrenamiento abre Salud en Entrenar */
function renderEntrenamiento() { SALUD_TAB = "entrenar"; return renderSalud(); }

/* -------- Resumen -------- */
function entrenosDelMes(y, m) {
  const pref = `${y}-${String(m + 1).padStart(2, "0")}-`;
  return new Set((STATE.entrenamiento.registro || []).filter(r => !r.borrado && r.fecha.startsWith(pref)).map(r => r.fecha)).size;
}
function saludResumen() {
  const hoy = todayISO(), y = anioActual(), m = +hoy.slice(5, 7) - 1;
  const sy = datosAnio(STATE, y).salud, mes = sy.meses[m], pre = rutaAnio(y), meta = STATE.salud.pesoObjetivo;
  const pesos = sy.meses.map((x, i) => ({ i, p: x.peso })).filter(x => x.p != null);
  const actual = pesoActualGlobal(STATE);
  const min = Math.min(...pesos.map(x => x.p), meta ?? Infinity), max = Math.max(...pesos.map(x => x.p), meta ?? -Infinity);
  const barra = pesos.length > 1 ? `<div class="spark" aria-hidden="true">${pesos.map(x => `<i title="${MESES[x.i]}: ${x.p} kg" style="height:${max > min ? 18 + Math.round(((x.p - min) / (max - min)) * 40) : 40}px"></i>`).join("")}</div>` : "";
  // La meta antigua partía en "todos los días del mes": si sigue así, se propone 12
  const metaE = !mes.diasEntrenTotal || mes.diasEntrenTotal >= daysInMonth(y, m) ? 12 : mes.diasEntrenTotal;
  const entrenados = Math.max(entrenosDelMes(y, m), mes.diasEntren || 0);
  const favoritas = (STATE.recetas || []).filter(r => !r.borrada);
  const sem = Math.floor((agDate(hoy) - new Date(y, 0, 1)) / (7 * 86400000));
  const pool = favoritas.filter(r => r.favorita).length ? favoritas.filter(r => r.favorita) : favoritas;
  const receta = pool.length ? pool[sem % pool.length] : null;
  return `
  <div class="grid grid-2 salud-top">
    <div class="card">
      <div class="text-sm muted">Peso actual</div>
      <div class="big-num" style="font-size:28px">${actual != null ? String(actual).replace(".", ",") + " kg" : "—"}</div>
      <div class="text-sm muted">${meta != null && meta !== "" ? `Meta ${String(meta).replace(".", ",")} kg${actual != null ? " · faltan " + String(Math.abs(actual - meta).toFixed(1)).replace(".", ",") : ""}` : "Sin meta de peso"}</div>
      ${barra}
    </div>
    <div class="card">
      <div class="text-sm muted">Entrenaste</div>
      <div class="big-num" style="font-size:28px">${entrenados} ${entrenados === 1 ? "día" : "días"}</div>
      <div class="text-sm muted">en ${MESES[m].toLowerCase()} · meta ${metaE}</div>
      <div class="bar mt-8"><div class="bar__fill" style="width:${Math.min(100, Math.round((entrenados / Math.max(1, metaE)) * 100))}%"></div></div>
      <button class="card__hint btn-texto mt-8" data-action="salud-tab" data-v="entrenar">Ir a entrenar ›</button>
    </div>
  </div>
  <div class="card mt-16">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px"><b>Registrar peso de ${MESES[m].toLowerCase()}</b>
      <div class="row" style="gap:8px"><input class="input" id="salud-peso" style="width:96px;text-align:center" inputmode="decimal" placeholder="kg" value="${mes.peso != null ? String(mes.peso).replace(".", ",") : ""}" aria-label="Peso en kg">
        <button class="btn btn--cian" data-action="salud-peso" aria-label="Guardar peso">Guardar</button></div></div>
    <div class="flex-between mt-8" style="gap:10px"><span class="text-sm muted">Meta de peso</span>
      <input class="input" style="width:96px;text-align:center" inputmode="decimal" data-bind="salud.pesoObjetivo" data-type="dec" value="${meta ?? ""}" placeholder="kg" aria-label="Meta de peso"></div>
  </div>
  <div class="card mt-16">
    <div class="flex-between"><b>Receta de la semana</b><button class="card__hint btn-texto" data-action="salud-tab" data-v="recetas">Ver recetas ›</button></div>
    ${receta ? `<button class="receta-mini mt-8" data-action="receta-ver" data-id="${receta.id}"><span class="receta-ico">${receta.icon || "🍽️"}</span>
      <span><b>${escapeHtml(receta.nombre)}</b><span class="text-sm muted" style="display:block">${recetaMeta(receta)}</span></span></button>`
      : `<div class="text-sm muted mt-8">Agrega tus recetas favoritas y aquí te sugiero una cada semana.</div>`}
  </div>
  <div class="card mt-16">
    <b>¿Cómo te sientes este mes?</b>
    <textarea class="input mt-8" style="min-height:80px" data-bind="${pre}salud.meses.${m}.notas" placeholder="Sueño, energía, lo que notaste en tu cuerpo…">${escapeHtml(mes.notas || "")}</textarea>
    <div class="flex-between mt-8" style="gap:10px"><span class="text-sm muted">Meta de días de entrenamiento este mes</span>
      <input class="input" style="width:80px;text-align:center" inputmode="numeric" data-bind="${pre}salud.meses.${m}.diasEntrenTotal" data-type="num" value="${metaE}" aria-label="Meta de días"></div>
  </div>`;
}
function guardarPeso() {
  const v = parseDecimal(val("salud-peso"));
  if (v == null || isNaN(v) || v <= 0) return toast("Escribe tu peso en kg", true);
  const hoy = todayISO(), y = anioActual(), m = +hoy.slice(5, 7) - 1;
  datosAnio(STATE, y, true).salud.meses[m].peso = v;
  saveState(); rerender(); toast("⚖️ Peso guardado");
}

/* -------- Recetas -------- */
function recetaMeta(r) {
  return [r.minutos ? r.minutos + " min" : "", r.porciones ? r.porciones + (r.porciones == 1 ? " porción" : " porciones") : "", ...(r.etiquetas || []).slice(0, 1)].filter(Boolean).join(" · ");
}
function saludRecetas() {
  const q = RECETA_BUSCA.trim().toLowerCase();
  const todas = (STATE.recetas || []).filter(r => !r.borrada);
  const etiquetas = [...new Set(todas.flatMap(r => r.etiquetas || []))].slice(0, 6);
  const lista = todas.filter(r =>
    (RECETA_FILTRO === "todas" || (RECETA_FILTRO === "favoritas" && r.favorita) || (RECETA_FILTRO === "rapidas" && r.minutos && r.minutos <= 20) || (r.etiquetas || []).includes(RECETA_FILTRO))
    && (!q || [r.nombre, r.ingredientes, (r.etiquetas || []).join(" ")].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (b.favorita - a.favorita) || a.nombre.localeCompare(b.nombre));
  const chip = (v, t) => `<button class="chip-f${RECETA_FILTRO === v ? " is-on" : ""}" data-action="receta-filtro" data-v="${escapeAttr(v)}">${t}</button>`;
  return `
  <div class="row" style="gap:8px"><input class="input" id="receta-busca" placeholder="Buscar receta o ingrediente…" value="${escapeAttr(RECETA_BUSCA)}"
      oninput="recetaBuscar(this.value)" aria-label="Buscar receta" style="flex:1;min-width:0">
    <button class="btn btn--primary" data-action="receta-nueva">+ Nueva</button></div>
  <div class="chips-f mt-8">${chip("todas", "Todas")}${chip("favoritas", "★ Favoritas")}${chip("rapidas", "Rápidas")}${etiquetas.map(e => chip(e, escapeHtml(e))).join("")}</div>
  <div id="recetas-lista">${recetasHtml(lista, todas.length)}</div>`;
}
function recetasHtml(lista, total) {
  if (!total) return `<div class="card mt-16"><div class="empty">Tu recetario está vacío. Agrega tu primera receta con <b>+ Nueva</b>: ingredientes, pasos y cuánto se demora.</div></div>`;
  if (!lista.length) return `<div class="card mt-16"><div class="empty">No encontré recetas con ese filtro.</div></div>`;
  return `<div class="recetas mt-16">${lista.map(r => `<button class="card receta" data-action="receta-ver" data-id="${r.id}">
    <span class="receta-ico receta-ico--big">${r.icon || "🍽️"}</span>
    <b>${escapeHtml(r.nombre)}</b><span class="text-sm muted">${recetaMeta(r) || "&nbsp;"}${r.favorita ? ' · <span style="color:#F5C451">★</span>' : ""}</span></button>`).join("")}</div>`;
}
function recetaBuscar(v) {
  RECETA_BUSCA = v || "";
  const el = document.getElementById("recetas-lista");
  if (!el) return;
  const box = document.createElement("div"); box.innerHTML = saludRecetas();
  const nuevo = box.querySelector("#recetas-lista");
  if (nuevo) el.innerHTML = nuevo.innerHTML;
}
const ICONOS_RECETA = ["🍽️", "🥗", "🍳", "🍝", "🍲", "🥘", "🍛", "🥪", "🌮", "🍕", "🥣", "🥞", "🍰", "🍪", "🥤", "🐟", "🍗", "🥩", "🥦", "🍜"];
function openReceta(id) {
  const r = (STATE.recetas || []).find(x => x.id === id);
  if (!r) return;
  const lineas = t => (t || "").split("\n").map(x => x.trim()).filter(Boolean);
  openModal(`${r.icon || "🍽️"} ${r.nombre}`, `
    <div class="text-sm muted">${recetaMeta(r) || "Sin tiempo ni porciones"}${(r.etiquetas || []).length ? " · " + r.etiquetas.map(escapeHtml).join(", ") : ""}</div>
    ${lineas(r.ingredientes).length ? `<div class="section-title" style="margin:16px 0 8px">Ingredientes</div><ul class="receta-lista">${lineas(r.ingredientes).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
    ${lineas(r.pasos).length ? `<div class="section-title" style="margin:16px 0 8px">Preparación</div><ol class="receta-lista">${lineas(r.pasos).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ol>` : ""}
    <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
      <button class="btn btn--soft" data-action="receta-fav" data-id="${r.id}">${r.favorita ? "★ Quitar de favoritas" : "☆ Favorita"}</button>
      <button class="btn-ghost" data-action="receta-editar" data-id="${r.id}">✎ Editar</button>
      <button class="btn-ghost" data-action="receta-borrar" data-id="${r.id}" style="color:var(--coral)">🗑 Borrar</button></div>`);
}
let RECETA_EDIT = null;
function openRecetaForm(id) {
  const r = id ? (STATE.recetas || []).find(x => x.id === id) : null;
  RECETA_EDIT = r ? r.id : null;
  const ico = (r && r.icon) || "🍽️";
  openModal(r ? "Editar receta" : "Nueva receta", `
    <div class="field"><label>Nombre</label><input class="input" id="rc-nombre" value="${escapeAttr(r ? r.nombre : "")}" placeholder="Ej: Ensalada de quinoa"></div>
    <div class="field"><label>Ícono</label><div class="row-wrap" style="gap:6px" id="rc-iconos">${ICONOS_RECETA.map(i => `<button type="button" class="mood-btn ${i === ico ? "is-on" : ""}" onclick="recetaIcono(this)">${i}</button>`).join("")}</div>
      <input type="hidden" id="rc-icon" value="${ico}"></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Minutos</label><input class="input" id="rc-min" inputmode="numeric" value="${r && r.minutos ? r.minutos : ""}" placeholder="20"></div>
      <div class="field" style="flex:1"><label>Porciones</label><input class="input" id="rc-por" inputmode="numeric" value="${r && r.porciones ? r.porciones : ""}" placeholder="2"></div></div>
    <div class="field"><label>Etiquetas (separadas por coma)</label><input class="input" id="rc-tags" value="${escapeAttr(r ? (r.etiquetas || []).join(", ") : "")}" placeholder="Desayunos, Saludable"></div>
    <div class="field"><label>Ingredientes (uno por línea)</label><textarea class="input" id="rc-ing" style="min-height:90px">${escapeHtml(r ? r.ingredientes || "" : "")}</textarea></div>
    <div class="field"><label>Preparación (un paso por línea)</label><textarea class="input" id="rc-pasos" style="min-height:90px">${escapeHtml(r ? r.pasos || "" : "")}</textarea></div>
    <button class="btn btn--primary btn-block" data-action="receta-guardar">Guardar receta</button>`);
}
function recetaIcono(btn) {
  document.querySelectorAll("#rc-iconos .mood-btn").forEach(b => b.classList.remove("is-on"));
  btn.classList.add("is-on"); document.getElementById("rc-icon").value = btn.textContent;
}
function guardarReceta() {
  const nombre = val("rc-nombre"); if (!nombre) return toast("Ponle un nombre a la receta", true);
  STATE.recetas = STATE.recetas || [];
  let r = RECETA_EDIT ? STATE.recetas.find(x => x.id === RECETA_EDIT) : null;
  if (!r) { r = { id: uid(), favorita: false }; STATE.recetas.push(r); }
  Object.assign(r, { nombre, icon: val("rc-icon") || "🍽️", minutos: parseInt(val("rc-min"), 10) || null, porciones: parseInt(val("rc-por"), 10) || null,
    etiquetas: val("rc-tags").split(",").map(x => x.trim()).filter(Boolean).slice(0, 6), ingredientes: val("rc-ing"), pasos: val("rc-pasos"), ts: Date.now() });
  saveState(); closeModal(); rerender(); toast("🍽️ Receta guardada");
}
function recetaFavorita(id) {
  const r = (STATE.recetas || []).find(x => x.id === id); if (!r) return;
  r.favorita = !r.favorita; r.ts = Date.now(); saveState(); rerender(); openReceta(id);
}
function recetaBorrar(id) {
  const r = (STATE.recetas || []).find(x => x.id === id); if (!r) return;
  if (!confirm(`¿Borrar la receta "${r.nombre}"?`)) return;
  r.borrada = true; r.ts = Date.now(); saveState(); closeModal(); rerender(); toast("Receta borrada");
}

/* -------- Entrenar -------- */
function rutinas() { return (STATE.entrenamiento.dias || []).filter(d => !d.borrado); }
/* La rutina de hoy: la asignada a este día de la semana; si no hay, la que sigue a la última que hiciste */
function rutinaDeHoy() {
  const hoy = todayISO(), rs = rutinas();
  if (!rs.length) return { r: null, asignada: false };
  const asignada = rs.find(r => r.dow === dowLunes(hoy));
  if (asignada) return { r: asignada, asignada: true };
  if (rs.some(r => r.dow != null)) return { r: null, asignada: false };   // hoy es día de descanso
  const reg = (STATE.entrenamiento.registro || []).filter(x => !x.borrado).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const i = reg.length ? rs.findIndex(r => r.id === reg[0].diaId) : -1;
  return { r: reg.length && reg[0].fecha === hoy ? rs.find(r => r.id === reg[0].diaId) || rs[0] : rs[(i + 1) % rs.length], asignada: false };
}
function ejercicioHoy(b) { return b.doneFecha === todayISO(); }
function saludEntrenar() {
  const hoy = todayISO(), rs = rutinas(), { r: rh, asignada } = rutinaDeHoy();
  if (!RUTINA_VER || !rs.some(r => r.id === RUTINA_VER)) RUTINA_VER = rh ? rh.id : rs[0] && rs[0].id;
  const ver = rs.find(r => r.id === RUTINA_VER);
  const reg = (STATE.entrenamiento.registro || []).filter(x => !x.borrado);
  const ultima = id => { const f = reg.filter(x => x.diaId === id).map(x => x.fecha).sort().pop(); return f ? (f === hoy ? "hoy" : `hace ${Math.round((agDate(hoy) - agDate(f)) / 86400000)} días`) : "nunca"; };
  const lunes = agLunes(hoy);
  const semana = Array.from({ length: 7 }, (_, i) => {
    const iso = agSumar(lunes, i), r = rs.find(x => x.dow === i), hecho = reg.some(x => x.fecha === iso);
    return `<div class="sd${hecho ? " is-hecho" : ""}${iso === hoy ? " is-hoy" : ""}"><b>${"LMMJVSD"[i]}</b><span>${hecho ? "✓" : r ? escapeHtml(r.nombre.replace(/^D[ií]a \d+ · /, "").split(" ")[0]) : "·"}</span></div>`;
  }).join("");
  if (!rs.length) return `<div class="card"><div class="empty">Aún no tienes rutinas. Crea la primera con sus ejercicios.</div>
    <button class="btn btn--primary btn-block" data-action="rutina-nueva">+ Nueva rutina</button></div>`;
  const hechos = ver ? ver.bloques.filter(ejercicioHoy).length : 0, total = ver ? ver.bloques.length : 0;
  const terminado = ver && reg.some(x => x.fecha === hoy && x.diaId === ver.id);
  return `
  <div class="card hoy-entreno">
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">${rh ? (asignada ? "Hoy toca" : "Te toca") + " · " + DIAS_LARGO[dowLunes(hoy)] : "Hoy · " + DIAS_LARGO[dowLunes(hoy)]}</div>
    <div class="big-num" style="font-size:24px">${rh ? escapeHtml(rh.nombre.replace(/^D[ií]a \d+ · /, "")) : "Descanso"}</div>
    <div class="text-sm muted">${rh ? `${rh.bloques.length} ejercicio${rh.bloques.length === 1 ? "" : "s"} · la última vez: ${ultima(rh.id)}` : "No tienes una rutina para hoy. Igual puedes hacer cualquiera."}</div>
  </div>
  <div class="chips-f mt-16">${rs.map(r => `<button class="chip-f${r.id === RUTINA_VER ? " is-on" : ""}" data-action="rutina-ver" data-id="${r.id}">${escapeHtml(r.nombre.replace(/^D[ií]a \d+ · /, ""))}${r.dow != null ? ` · ${"LMMJVSD"[r.dow]}` : ""}</button>`).join("")}
    <button class="chip-f" data-action="rutina-nueva">+ Rutina</button></div>
  ${ver ? `<div class="card mt-8" style="padding:4px 0">
    <div class="rutina-head"><b>${escapeHtml(ver.nombre)}</b><span class="text-sm muted">${ver.dow != null ? "Los " + DIAS_LARGO[ver.dow].toLowerCase() : "Cualquier día"} · ${hechos}/${total} hoy</span></div>
    ${ver.bloques.map(b => `<div class="ejercicio${ejercicioHoy(b) ? " is-hecho" : ""}">
      <span class="check ${ejercicioHoy(b) ? "is-on" : ""}" data-action="ejercicio-toggle" data-dia="${ver.id}" data-id="${b.id}" role="checkbox" aria-checked="${ejercicioHoy(b)}" tabindex="0">${ejercicioHoy(b) ? "✓" : ""}</span>
      <button class="ejercicio__t" data-action="ejercicio-editar" data-dia="${ver.id}" data-id="${b.id}"><b>${escapeHtml(b.nombre)}</b>
        <span class="text-sm muted">${[b.series, b.peso].filter(Boolean).map(escapeHtml).join(" · ") || "Toca para agregar series y peso"}</span></button></div>`).join("") || `<div class="empty" style="padding:14px">Esta rutina no tiene ejercicios todavía.</div>`}
    <button class="cal-ag cal-ag--add" data-action="ejercicio-nuevo" data-dia="${ver.id}"><span class="cal-ag__h">+</span><span class="muted">Agregar ejercicio</span></button>
  </div>
  <div class="row mt-8" style="gap:8px;flex-wrap:wrap">
    ${terminado ? `<span class="chip chip--done">✓ Entrenamiento de hoy registrado</span>` : `<button class="btn btn--primary" data-action="entreno-terminar" data-dia="${ver.id}">${hechos && hechos < total ? `Terminé (${hechos}/${total})` : "Terminé el entrenamiento"}</button>`}
    <button class="btn-ghost" data-action="rutina-editar" data-id="${ver.id}">✎ Rutina</button></div>` : ""}
  <div class="section-title">Tu semana</div>
  <div class="semana-ent">${semana}</div>
  <div class="card mt-16"><div class="text-xs muted" style="text-transform:uppercase">🎯 Objetivo</div>
    <textarea class="input mt-8" style="min-height:60px" data-bind="entrenamiento.objetivo" data-render="no" placeholder="¿Qué buscas con tu entrenamiento?">${escapeHtml(STATE.entrenamiento.objetivo || "")}</textarea></div>`;
}
function ejercicioToggle(diaId, id) {
  const dia = rutinas().find(x => x.id === diaId); const b = dia && dia.bloques.find(x => x.id === id); if (!b) return;
  const hoy = todayISO();
  b.doneFecha = b.doneFecha === hoy ? null : hoy; b.done = b.doneFecha === hoy; dia.ts = Date.now();
  if (dia.bloques.length && dia.bloques.every(ejercicioHoy)) registrarEntreno(dia);
  saveState(); rerender();
}
/* Registra el entrenamiento de hoy (una vez por día y rutina) y suma el día en Salud */
function registrarEntreno(dia) {
  const hoy = todayISO(), E = STATE.entrenamiento;
  E.registro = E.registro || [];
  const id = hoy + ":" + dia.id;
  if (E.registro.some(x => x.id === id && !x.borrado)) return false;
  E.registro.push({ id, fecha: hoy, diaId: dia.id, ts: Date.now() });
  const y = anioActual(), m = +hoy.slice(5, 7) - 1, mes = datosAnio(STATE, y, true).salud.meses[m];
  mes.diasEntren = Math.max(mes.diasEntren || 0, entrenosDelMes(y, m));
  if (!dia.premiado) { dia.premiado = true; registrarMovimiento("entreno:" + dia.id, 30, 30, "Entrenamiento"); }
  else registrarMovimiento("entreno-dia:" + hoy, 10, 10, "Entrenamiento");
  toast("💪 ¡Entrenamiento registrado!");
  return true;
}
function terminarEntreno(diaId) {
  const dia = rutinas().find(x => x.id === diaId); if (!dia) return;
  const hoy = todayISO();
  dia.bloques.forEach(b => { b.doneFecha = hoy; b.done = true; }); dia.ts = Date.now();
  registrarEntreno(dia); saveState(); rerender();
}
let EJ_EDIT = null;
function openEjercicio(diaId, id) {
  const dia = rutinas().find(x => x.id === diaId); if (!dia) return;
  const b = id ? dia.bloques.find(x => x.id === id) : null;
  EJ_EDIT = { diaId, id: b ? b.id : null };
  openModal(b ? "Editar ejercicio" : "Nuevo ejercicio", `
    <div class="field"><label>Ejercicio</label><input class="input" id="ej-nombre" value="${escapeAttr(b ? b.nombre : "")}" placeholder="Ej: Sentadilla"></div>
    <div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Series × repeticiones</label><input class="input" id="ej-series" value="${escapeAttr(b ? b.series || "" : "")}" placeholder="4 × 10"></div>
      <div class="field" style="flex:1"><label>Peso</label><input class="input" id="ej-peso" value="${escapeAttr(b ? b.peso || "" : "")}" placeholder="60 kg"></div></div>
    <button class="btn btn--primary btn-block" data-action="ejercicio-guardar">Guardar</button>
    ${b ? `<button class="btn-ghost btn-block mt-8" data-action="ejercicio-borrar" style="color:var(--coral)">🗑 Quitar de la rutina</button>` : ""}`);
}
function guardarEjercicio() {
  const nombre = val("ej-nombre"); if (!nombre) return toast("Escribe el ejercicio", true);
  const dia = rutinas().find(x => x.id === EJ_EDIT.diaId); if (!dia) return;
  let b = EJ_EDIT.id ? dia.bloques.find(x => x.id === EJ_EDIT.id) : null;
  if (!b) { b = { id: uid(), done: false }; dia.bloques.push(b); }
  Object.assign(b, { nombre, series: val("ej-series"), peso: val("ej-peso") }); dia.ts = Date.now();
  saveState(); closeModal(); rerender();
}
function borrarEjercicio() {
  const dia = rutinas().find(x => x.id === EJ_EDIT.diaId); if (!dia) return;
  dia.bloques = dia.bloques.filter(x => x.id !== EJ_EDIT.id); dia.ts = Date.now();
  saveState(); closeModal(); rerender();
}
let RUTINA_EDIT = null;
function openRutina(id) {
  const r = id ? rutinas().find(x => x.id === id) : null;
  RUTINA_EDIT = r ? r.id : null;
  const dow = r && r.dow != null ? r.dow : "";
  openModal(r ? "Editar rutina" : "Nueva rutina", `
    <div class="field"><label>Nombre</label><input class="input" id="ru-nombre" value="${escapeAttr(r ? r.nombre : "")}" placeholder="Ej: Piernas y core"></div>
    <div class="field"><label>¿Qué día la haces?</label><select class="select input" id="ru-dow"><option value="">Cualquier día (se turnan)</option>
      ${DIAS_LARGO.map((d, i) => `<option value="${i}" ${dow === i ? "selected" : ""}>${d}</option>`).join("")}</select></div>
    <button class="btn btn--primary btn-block" data-action="rutina-guardar">Guardar</button>
    ${r ? `<button class="btn-ghost btn-block mt-8" data-action="rutina-borrar" style="color:var(--coral)">🗑 Borrar rutina</button>` : ""}`);
}
function guardarRutina() {
  const nombre = val("ru-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  const dv = document.getElementById("ru-dow").value, dow = dv === "" ? null : +dv;
  let r = RUTINA_EDIT ? rutinas().find(x => x.id === RUTINA_EDIT) : null;
  if (!r) { r = { id: uid(), premiado: false, bloques: [] }; STATE.entrenamiento.dias.push(r); }
  if (dow != null) rutinas().forEach(x => { if (x !== r && x.dow === dow) { x.dow = null; x.ts = Date.now(); } });   // un día, una rutina
  Object.assign(r, { nombre, dow, ts: Date.now() });
  RUTINA_VER = r.id; saveState(); closeModal(); rerender();
}
function borrarRutina() {
  const r = rutinas().find(x => x.id === RUTINA_EDIT); if (!r) return;
  if (!confirm(`¿Borrar la rutina "${r.nombre}"? Tus entrenamientos ya registrados se conservan.`)) return;
  r.borrado = true; r.ts = Date.now(); RUTINA_VER = null;
  saveState(); closeModal(); rerender();
}
