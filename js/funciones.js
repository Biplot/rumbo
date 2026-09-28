/* ============================================================
   RUMBO · Funciones de la Tienda (se desbloquean una vez y quedan para siempre)
   ⏱️ Modo enfoque · 🔮 Pronóstico de la semana · 📊 Comparar meses · 🗂️ Informe del año
   📋 Plantillas de rutina · 🔔 Recordatorio de mediodía · 🎨 Packs de íconos

   La compra es un movimiento "compra:fun-<id>" del ledger (se paga una sola vez,
   también entre dispositivos). Las sesiones de enfoque viven en STATE.enfoque.sesiones
   (fusión por id, como los usos de consumibles).
   ============================================================ */

const FUNCIONES = [
  { id: "enfoque", icon: "⏱️", nombre: "Modo enfoque", costo: 600,
    desc: "Un temporizador ligado a una tarea: eliges tu primer bocado, partes 25 o 50 minutos y la pantalla muestra solo esa tarea. En Tendencias ves tus horas de foco.",
    donde: "Inicio → Tareas de hoy → ⏱️ Enfocarme" },
  { id: "pronostico", icon: "🔮", nombre: "Pronóstico de la semana", costo: 400,
    desc: "Te avisa qué días de la semana quedaron sobrecargados según tu capacidad real y tus reuniones de Google Calendar.",
    donde: "Semana y ritual semanal" },
  { id: "comparar", icon: "📊", nombre: "Comparar meses", costo: 500,
    desc: "Pones dos meses lado a lado: tareas, hábitos, postergación, ánimo y ahorro.",
    donde: "Tendencias" },
  { id: "informe-anio", icon: "🗂️", nombre: "Informe del año", costo: 400,
    desc: "Tu año completo en una imagen para guardar o compartir: días cerrados, hábitos, metas, libros y tu mejor mes.",
    donde: "Tendencias → Tu evolución (en diciembre, y cuando quieras para años anteriores)" },
  { id: "mediodia", icon: "🔔", nombre: "Recordatorio de mediodía", costo: 300,
    desc: "Un tercer aviso a la hora que elijas: “¿Cómo va tu primer bocado?”.",
    donde: "Notificaciones" },
];
/* Plantillas de rutina: hábitos + tareas recurrentes ya armados (200 ⭐ cada una) */
const PLANTILLAS = [
  { id: "manana", icon: "🌅", nombre: "Mañana productiva", costo: 200,
    habitos: [["🛏️", "Hacer la cama", { tipo: "diario" }], ["💧", "Vaso de agua al despertar", { tipo: "diario" }], ["🧘", "Meditar 10 minutos", { tipo: "diario" }], ["📖", "Leer 20 minutos", { tipo: "diario" }]],
    recurrentes: [["Revisar la agenda del día", "pro", { tipo: "semanal", dias: [0, 1, 2, 3, 4] }]] },
  { id: "salud", icon: "💪", nombre: "Salud y deporte", costo: 200,
    habitos: [["🏃", "Entrenar", { tipo: "semanal", veces: 3 }], ["🥗", "Comer sano", { tipo: "diario" }], ["💧", "Tomar 2 litros de agua", { tipo: "diario" }], ["😴", "Dormir 7 horas", { tipo: "diario" }]],
    recurrentes: [["Preparar las comidas de la semana", "per", { tipo: "semanal", dias: [6] }]] },
  { id: "estudio", icon: "🎓", nombre: "Estudio", costo: 200,
    habitos: [["📚", "Estudiar 45 minutos", { tipo: "dias", dias: [0, 1, 2, 3, 4] }], ["✏️", "Repasar apuntes", { tipo: "semanal", veces: 3 }], ["📵", "Estudiar sin celular", { tipo: "diario" }]],
    recurrentes: [["Planificar la semana de estudio", "per", { tipo: "semanal", dias: [0] }]] },
  { id: "finanzas", icon: "💰", nombre: "Finanzas personales", costo: 200,
    habitos: [["🧾", "Anotar mis gastos", { tipo: "diario" }], ["🚫", "Día sin compras", { tipo: "semanal", veces: 2 }]],
    recurrentes: [["Revisar los gastos de la semana", "per", { tipo: "semanal", dias: [6] }], ["Transferir al ahorro", "per", { tipo: "mensual", dia: 1 }], ["Pagar las cuentas del mes", "per", { tipo: "mensual", dia: 5 }]] },
];
/* Packs de íconos para hábitos (150 ⭐ cada uno, 24 íconos) */
const PACKS_ICONOS = [
  { id: "deporte", icon: "🏅", nombre: "Deporte", costo: 150, iconos: ["🏋️", "🏃", "🚴", "🏊", "⛹️", "🤸", "🧗", "🥊", "⚽", "🏀", "🎾", "🏐", "🏓", "🥋", "⛷️", "🏄", "🚣", "🤾", "🏌️", "🧘", "🥾", "🛹", "⛸️", "🤺"] },
  { id: "estudio", icon: "🎓", nombre: "Estudio", costo: 150, iconos: ["📚", "📖", "✏️", "📝", "📐", "🧮", "🔬", "🧪", "🌍", "🗣️", "🎓", "💡", "🧠", "📓", "🖊️", "📊", "💻", "⌨️", "🎧", "🗂️", "📅", "🔤", "🎹", "🎨"] },
  { id: "hogar", icon: "🏠", nombre: "Hogar", costo: 150, iconos: ["🧹", "🧺", "🧽", "🛏️", "🍳", "🪴", "🐕", "🐈", "🧾", "🔧", "🪛", "🛒", "🍽️", "🚿", "🗑️", "🧴", "🪟", "🛋️", "🧸", "👕", "🔑", "📦", "🌱", "🕯️"] },
  { id: "bienestar", icon: "🌿", nombre: "Bienestar", costo: 150, iconos: ["🧘", "💧", "🍎", "🥗", "😴", "🌞", "🚶", "🙏", "💊", "🫖", "🛁", "📵", "🌿", "😊", "❤️", "🎵", "🌙", "🤝", "✨", "🍵", "🥦", "🧃", "🌳", "🕊️"] },
];

function funcion(id, S) { S = S || STATE; return ((S.gamif && S.gamif.owned) || []).includes("fun-" + id); }
function itemFuncion(fid) {
  const [tipo, id] = fid.split(":");
  if (tipo === "fun") return FUNCIONES.find(f => f.id === id);
  if (tipo === "plantilla") { const p = PLANTILLAS.find(x => x.id === id); return p && { ...p, nombre: "Plantilla " + p.nombre }; }
  if (tipo === "iconos") { const p = PACKS_ICONOS.find(x => x.id === id); return p && { ...p, nombre: "Íconos " + p.nombre }; }
  return null;
}
/* fid: "fun:enfoque" | "plantilla:salud" | "iconos:deporte" → compra "fun-enfoque" | "fun-plantilla-salud" | "fun-iconos-deporte" */
function claveFuncion(fid) { const [tipo, id] = fid.split(":"); return tipo === "fun" ? id : tipo + "-" + id; }
function comprarFuncion(fid) {
  const it = itemFuncion(fid); if (!it) return false;
  const clave = claveFuncion(fid);
  if (funcion(clave)) return true;
  recalcGamif(STATE);
  if (STATE.gamif.puntos < it.costo) { toast("Te faltan " + (it.costo - STATE.gamif.puntos) + " ⭐", true); return false; }
  if (!confirm(`¿Desbloquear "${it.nombre}" por ${it.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - it.costo} ⭐.`)) return false;
  const res = ledgerComprar(STATE, "fun-" + clave, it.costo);
  if (!res.ok && !res.yaTenia) { toast("Te faltan " + res.falta + " ⭐", true); return false; }
  saveState(); updateTopbar(); rerender();
  if (fid.startsWith("plantilla:")) openPlantillas();   // comprada desde su lista: queda lista para aplicar
  toast(`${it.icon} ${it.nombre} desbloqueado`);
  return true;
}
/* Si no la tiene, ofrece comprarla (para los botones que aparecen en otras pantallas) */
function asegurarFuncion(fid) { return funcion(claveFuncion(fid)) || comprarFuncion(fid); }

/* ============================================================
   ⏱️ MODO ENFOQUE
   La sesión activa vive en este dispositivo (localStorage) con su hora de término,
   así sobrevive a recargar o bloquear la pantalla. Al terminar queda en STATE.enfoque.
   ============================================================ */
let ENFOQUE_TIMER = null;
function enfoqueClave() { return "rumbo-enfoque:" + ((CURRENT_USER && CURRENT_USER.id) || "local"); }
function enfoqueActiva() { try { return JSON.parse(localStorage.getItem(enfoqueClave()) || "null"); } catch (e) { return null; } }
function enfoqueGuardar(a) { try { a ? localStorage.setItem(enfoqueClave(), JSON.stringify(a)) : localStorage.removeItem(enfoqueClave()); } catch (e) {} }
function enfoqueRestante(a, ahora) { return a.pausa ? a.restante : Math.max(0, a.fin - (ahora || Date.now())); }
function sesionesEnfoque(S) { S = S || STATE; S.enfoque = S.enfoque || {}; if (!Array.isArray(S.enfoque.sesiones)) S.enfoque.sesiones = []; return S.enfoque.sesiones; }
/* Minutos de foco en [desde, hasta] */
function minutosFoco(S, desde, hasta) { return sesionesEnfoque(S).filter(x => !x.borrada && x.fecha >= desde && x.fecha <= hasta).reduce((a, x) => a + (x.real || 0), 0); }
function sesionesCompletas(S) { return sesionesEnfoque(S).filter(x => !x.borrada && x.completa).length; }
function fmtFoco(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h ${m ? m + " min" : ""}`.trim() : `${m} min`; }

function openEnfoque() {
  if (!asegurarFuncion("fun:enfoque")) return;
  const a = enfoqueActiva(); if (a) return mostrarEnfoque();
  const hoy = todayISO();
  const pend = tareasDelDia(hoy).filter(t => estadoTarea(t) === "pendiente");
  pend.sort((x, y) => (y.esSapo ? 1 : 0) - (x.esSapo ? 1 : 0));
  openModal("⏱️ Modo enfoque", `
    <p class="text-sm soft">Elige una tarea y una duración. La pantalla mostrará solo esa tarea hasta que termines.</p>
    <div class="field mt-16"><label>Tarea</label>
      <select class="input" id="enf-tarea">${pend.map(t => `<option value="${t.id}">${t.esSapo ? BOCADO.emoji + " " : ""}${escapeHtml(t.txt)}</option>`).join("")}
        <option value="">Otra cosa (sin tarea)</option></select></div>
    <div class="field" id="enf-libre-f" ${pend.length ? "hidden" : ""}><label>¿En qué te vas a enfocar?</label><input class="input" id="enf-libre" placeholder="Ej: Preparar la presentación"></div>
    <div class="field"><label>Duración</label>
      <div class="seg" id="enf-min">${[25, 50].map((m, i) => `<button type="button" class="${i === 0 ? "is-active" : ""}" data-m="${m}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('is-active'));this.classList.add('is-active')">${m} min</button>`).join("")}</div></div>
    <button class="btn btn--primary btn-block mt-16" data-action="enfoque-iniciar">Empezar</button>
    <p class="text-xs muted mt-8">Esta semana llevas <b>${fmtFoco(minutosFoco(STATE, agLunes(hoy), agSumar(agLunes(hoy), 6)))}</b> de foco.</p>`);
  const sel = document.getElementById("enf-tarea");
  if (sel) sel.onchange = () => { document.getElementById("enf-libre-f").hidden = !!sel.value; };
}
function iniciarEnfoque() {
  const sel = document.getElementById("enf-tarea"), hoy = todayISO();
  const tareaId = sel ? sel.value : "";
  const t = tareaId ? buscarTarea(STATE, hoy, tareaId) : null;
  const titulo = t ? t.txt : ((document.getElementById("enf-libre") || {}).value || "").trim() || "Tiempo de foco";
  const b = document.querySelector("#enf-min .is-active"), min = b ? +b.dataset.m : 25;
  const ahora = Date.now();
  enfoqueGuardar({ id: uid(), tareaId, fecha: hoy, titulo, bocado: !!(t && t.esSapo), min, ini: ahora, fin: ahora + min * 60000, pausa: false, restante: 0, pausadoMs: 0 });
  closeModal(); mostrarEnfoque();
  pedirPermisoAviso();
}
function pedirPermisoAviso() { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {} }
function mostrarEnfoque() {
  const a = enfoqueActiva(); if (!a) return cerrarOverlayEnfoque();
  let el = document.getElementById("enfoque");
  if (!el) { el = document.createElement("div"); el.id = "enfoque"; el.className = "enfoque"; document.body.appendChild(el); }
  el.innerHTML = `<div class="enfoque__in">
    <div class="enfoque__k">${a.bocado ? BOCADO.emoji + " Tu primer bocado" : "⏱️ En foco"}</div>
    <div class="enfoque__t">${escapeHtml(a.titulo)}</div>
    <div class="enfoque__reloj" id="enf-reloj">--:--</div>
    <div class="enfoque__barra"><div id="enf-barra"></div></div>
    <div class="row-wrap" style="gap:10px;justify-content:center">
      <button class="btn btn--soft" data-action="enfoque-pausa">${a.pausa ? "▶ Seguir" : "⏸ Pausar"}</button>
      <button class="btn-ghost" data-action="enfoque-terminar">Terminar antes</button></div>
    <p class="text-xs muted mt-16">Puedes bloquear la pantalla: al volver, el tiempo sigue donde corresponde.</p></div>`;
  el.hidden = false;
  tickEnfoque();
  clearInterval(ENFOQUE_TIMER); ENFOQUE_TIMER = setInterval(tickEnfoque, 1000);
}
function tickEnfoque() {
  const a = enfoqueActiva(); if (!a) return cerrarOverlayEnfoque();
  const r = enfoqueRestante(a), s = Math.ceil(r / 1000);
  const reloj = document.getElementById("enf-reloj"), barra = document.getElementById("enf-barra");
  if (reloj) reloj.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  if (barra) barra.style.width = (100 - (r / (a.min * 60000)) * 100).toFixed(1) + "%";
  document.title = a.pausa ? "⏸ Rumbo" : `${reloj ? reloj.textContent : ""} · ${a.titulo}`;
  if (!a.pausa && r <= 0) terminarEnfoque(true);
}
function pausarEnfoque() {
  const a = enfoqueActiva(); if (!a) return;
  if (a.pausa) { a.fin = Date.now() + a.restante; a.pausa = false; }
  else { a.restante = enfoqueRestante(a); a.pausa = true; }
  enfoqueGuardar(a); mostrarEnfoque();
}
/* completa: llegó al final. Registra la sesión y pregunta si terminó la tarea. */
function terminarEnfoque(completa) {
  const a = enfoqueActiva(); if (!a) return;
  clearInterval(ENFOQUE_TIMER);
  const real = Math.round(((a.min * 60000) - enfoqueRestante(a)) / 60000);
  if (real >= 1) sesionesEnfoque(STATE).push({ id: a.id, fecha: a.fecha, ts: Date.now(), min: a.min, real: Math.min(real, a.min), completa: !!completa, tareaId: a.tareaId || null, titulo: a.titulo });
  enfoqueGuardar(null); saveState();
  document.title = "Rumbo";
  cerrarOverlayEnfoque();
  if (completa) avisoFinEnfoque(a);
  const t = a.tareaId ? buscarTarea(STATE, a.fecha, a.tareaId) : null;
  if (t && estadoTarea(t) === "pendiente") {
    openModal(completa ? "⏱️ ¡Tiempo!" : "⏱️ Sesión terminada", `
      <p class="soft">${real >= 1 ? `Sumaste <b>${fmtFoco(real)}</b> de foco.` : "La sesión fue muy corta para contarla."} ¿Terminaste <b>${escapeHtml(t.txt)}</b>?</p>
      <div class="row mt-16" style="gap:8px"><button class="btn btn--primary" style="flex:1" data-action="enfoque-hecha" data-fecha="${a.fecha}" data-id="${t.id}">Sí, la terminé ✓</button>
        <button class="btn btn--soft" data-action="close-modal">Todavía no</button></div>`);
  } else toast(real >= 1 ? `⏱️ ${fmtFoco(real)} de foco registrados` : "Sesión cancelada");
  if (typeof celebrar === "function" && completa) celebrar("enfoque");
  rerender();
}
function enfoqueTareaHecha(fecha, id) {
  const t = buscarTarea(STATE, fecha, id);
  if (t && estadoTarea(t) !== "hecha") {
    marcarTarea(t, "hecha");
    registrarMovimiento("tarea:" + t.id, 15, 15, "Tarea");
    if (typeof alCompletarTarea === "function") alCompletarTarea(t);
  }
  saveState(); closeModal(); rerender(); toast("✓ Tarea hecha");
}
function cerrarOverlayEnfoque() { clearInterval(ENFOQUE_TIMER); const el = document.getElementById("enfoque"); if (el) el.hidden = true; }
async function avisoFinEnfoque(a) {
  try { if (typeof sonar === "function") sonar("fin"); } catch (e) {}
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    const op = { body: `Terminaste tu sesión de ${a.min} min: ${a.titulo}`, icon: "assets/icon-192.png", badge: "assets/icon-192.png", tag: "rumbo-enfoque", data: { url: "./#inicio" } };
    reg ? reg.showNotification("⏱️ ¡Tiempo!", op) : new Notification("⏱️ ¡Tiempo!", op);
  } catch (e) {}
}
/* Al abrir la app o volver a ella: si había una sesión, se retoma (o se cierra si ya terminó) */
function retomarEnfoque() { if (enfoqueActiva()) mostrarEnfoque(); }

/* Tarjeta de foco para Tendencias */
function renderFocoTendencias() {
  if (!funcion("enfoque")) return "";
  const hoy = todayISO(), L = agLunes(hoy);
  const semanas = Array.from({ length: 8 }, (_, i) => agSumar(L, -7 * (7 - i)));
  const horas = semanas.map(l => +(minutosFoco(STATE, l, agSumar(l, 6)) / 60).toFixed(1));
  const esta = minutosFoco(STATE, L, agSumar(L, 6));
  const n = sesionesEnfoque(STATE).filter(x => !x.borrada && x.fecha >= L).length;
  return `<div class="section-title">⏱️ Foco</div>
  <div class="grid grid-2"><div class="card stat"><div class="stat__label">⏱️ Foco esta semana</div><div class="stat__value">${fmtFoco(esta)}</div>
      <div class="text-xs muted mt-8">${n} ${n === 1 ? "sesión" : "sesiones"} · ${sesionesCompletas(STATE)} completas en total</div>
      <button class="btn btn--cian mt-16" data-action="enfoque-open">Enfocarme ahora</button></div>
    <div class="card"><div class="card__head"><div class="card__title">Horas de foco por semana</div><span class="card__hint">últimas 8</span></div>
      ${svgBar(horas, { color: "var(--cian)", fmt: v => String(v).replace(".", ",") + " h", labels: semanas.map(l => { const d = agDate(l); return d.getDate() + "/" + (d.getMonth() + 1); }) })}</div></div>`;
}

/* ============================================================
   🔮 PRONÓSTICO DE LA SEMANA
   Capacidad del día = tu promedio real de tareas hechas (últimos 14 días; 5 si aún no hay datos),
   descontando las horas de reuniones de Google Calendar (jornada de 8 horas).
   ============================================================ */
function horasReunion(iso) {
  const ev = typeof gcalEventosDia === "function" ? gcalEventosDia(iso) : [];
  const min = t => { const [h, m] = String(t || "").split(":").map(Number); return h * 60 + (m || 0); };
  return ev.filter(e => !e.todoDia && e.hora && e.horaFin).reduce((a, e) => a + Math.max(0, min(e.horaFin) - min(e.hora)) / 60, 0);
}
function pronosticoDia(iso, S, cap) {
  S = S || STATE;
  const base = cap && cap.hechasProm ? cap.hechasProm : 5;
  const reun = horasReunion(iso);
  const capacidad = Math.max(1, Math.round(base * (1 - Math.min(0.75, reun / 8)) * 10) / 10);
  const tareas = tareasDelDia(iso, S).filter(t => ["pendiente", "hecha"].includes(estadoTarea(t))).length;
  const nivel = diaLibre(S, iso) ? "libre" : tareas > capacidad * 1.25 ? "sobrecargado" : tareas > capacidad ? "justo" : "ok";
  return { iso, tareas, capacidad, reun: Math.round(reun * 10) / 10, nivel };
}
function pronosticoSemana(L, S) {
  S = S || STATE;
  const cap = tmCapacidad(S, todayISO()), hoy = todayISO();
  return Array.from({ length: 7 }, (_, i) => agSumar(L, i)).filter(iso => iso >= hoy).map(iso => pronosticoDia(iso, S, cap));
}
function chipPronostico(p) {
  if (!p) return "";
  if (p.nivel === "libre") return `<span class="chip">🌴 libre</span>`;
  const t = `${p.tareas} de ~${String(p.capacidad).replace(".", ",")}${p.reun ? ` · ${String(p.reun).replace(".", ",")} h reuniones` : ""}`;
  return p.nivel === "sobrecargado" ? `<span class="chip chip--coral" title="Tareas planificadas vs. tu capacidad">🔮 ${t}</span>`
    : p.nivel === "justo" ? `<span class="chip" title="Tareas planificadas vs. tu capacidad">🔮 justo · ${t}</span>` : "";
}
function renderPronosticoSemana(L) {
  if (!funcion("pronostico")) return "";
  const ps = pronosticoSemana(L); if (!ps.length) return "";
  const sobre = ps.filter(p => p.nivel === "sobrecargado");
  const nombres = sobre.map(p => DIAS_SEMANA[(agDate(p.iso).getDay() + 6) % 7].toLowerCase());
  const cap = tmCapacidad(STATE, todayISO());
  return `<div class="card mt-16 pronostico ${sobre.length ? "is-warn" : ""}"><div class="card__title" style="font-size:15px">🔮 Pronóstico de la semana</div>
    <p class="text-sm soft mt-8">${sobre.length ? `Ojo: <b>${nombres.join(", ")}</b> ${sobre.length === 1 ? "quedó sobrecargado" : "quedaron sobrecargados"}. Mueve algo a un día más liviano o suelta lo que no es clave.` : "Tu semana está dentro de tu capacidad. 👌"}</p>
    <p class="text-xs muted mt-8">${cap ? `Tu capacidad real: ~${String(cap.hechasProm).replace(".", ",")} tareas al día` : "Aún no hay datos de tu capacidad: se usa 5 tareas al día"}${gcalConectado() ? ", menos tus reuniones de Google Calendar." : "."}</p></div>`;
}

/* ============================================================
   📊 COMPARAR MESES (en Tendencias)
   ============================================================ */
let COMPARAR = null;   // { a: "YYYY-MM", b: "YYYY-MM" }
function datosComparar(key, S) {
  S = S || STATE;
  const { y, m } = mesDeKey(key), r = resumenMes(y, m);
  const desde = isoLocal(new Date(y, m, 1)), hasta = isoLocal(new Date(y, m + 1, 0));
  const tm = tmResumen(S, desde, hasta);
  const moods = (S.vida.diario || []).filter(e => e.mood && e.fecha >= desde && e.fecha <= hasta).map(e => e.mood);
  return {
    cerrados: r.cerrados, habitos: r.habitos, tareas: tm.tareas ? tm.hechas : null, cumpl: tm.cumplimiento,
    postergacion: r.postergacion, animo: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    ahorro: (r.ahorro || r.metaAhorro) ? r.ahorro : null, bocados: r.bocados, libros: r.libros,
    foco: funcion("enfoque", S) ? Math.round(minutosFoco(S, desde, hasta)) : null,
  };
}
function renderCompararMeses() {
  const hoy = agDate(todayISO());
  const keys = Array.from({ length: 24 }, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return mesKey(d.getFullYear(), d.getMonth()); });
  if (!funcion("comparar")) return `<div class="card mt-24 locked-card"><div class="flex-between" style="gap:12px;flex-wrap:wrap">
    <div><div class="card__title">📊 Comparar meses</div><div class="text-sm muted mt-8">Pon dos meses lado a lado: tareas, hábitos, postergación, ánimo y ahorro.</div></div>
    <button class="btn btn--primary" data-action="fun-buy" data-id="fun:comparar">Desbloquear · 500 ⭐</button></div></div>`;
  COMPARAR = COMPARAR || { a: keys[0], b: keys[1] };
  const nom = k => { const { y, m } = mesDeKey(k); return `${MESES[m]} ${y}`; };
  const sel = (lado) => `<select class="input" onchange="COMPARAR.${lado}=this.value;rerender()">${keys.map(k => `<option value="${k}" ${COMPARAR[lado] === k ? "selected" : ""}>${nom(k)}</option>`).join("")}</select>`;
  const A = datosComparar(COMPARAR.a), B = datosComparar(COMPARAR.b);
  const fila = (ico, label, k, fmt, mejorAlto = true) => {
    const a = A[k], b = B[k]; if (a == null && b == null) return "";
    let flecha = "";
    if (a != null && b != null && a !== b) flecha = (a > b) === mejorAlto ? '<span class="hl-cian">▲</span>' : '<span style="color:var(--coral)">▼</span>';
    return `<tr><td>${ico} ${label}</td><td><b>${a == null ? "—" : fmt(a)}</b> ${flecha}</td><td>${b == null ? "—" : fmt(b)}</td></tr>`;
  };
  const pct = v => v + "%", num = v => String(v).replace(".", ",");
  return `<div class="section-title">📊 Comparar meses</div>
  <div class="card"><div class="row" style="gap:10px;flex-wrap:wrap">${sel("a")}<span class="muted">vs</span>${sel("b")}</div>
    <table class="tabla-comparar mt-16"><thead><tr><th></th><th>${nom(COMPARAR.a)}</th><th>${nom(COMPARAR.b)}</th></tr></thead><tbody>
      ${fila("🌙", "Días cerrados", "cerrados", num)}
      ${fila("📊", "Hábitos", "habitos", pct)}
      ${fila("📋", "Tareas hechas", "tareas", num)}
      ${fila("✅", "Cumplimiento de tareas", "cumpl", pct)}
      ${fila("↪", "Postergación", "postergacion", pct, false)}
      ${fila(BOCADO.emoji, "Primeros bocados", "bocados", num)}
      ${fila("😊", "Ánimo promedio", "animo", num)}
      ${fila("💰", "Ahorro", "ahorro", fmtCLP)}
      ${fila("📚", "Libros terminados", "libros", num)}
      ${fila("⏱️", "Foco", "foco", fmtFoco)}
    </tbody></table>
    <p class="text-xs muted mt-8">▲ mejor · ▼ peor que el mes de la derecha.</p></div>`;
}

/* ============================================================
   🗂️ INFORME DEL AÑO (imagen para compartir, usa el dibujo del informe del mes)
   ============================================================ */
function informeAnioDisponible(y) { const h = agDate(todayISO()); return y < h.getFullYear() || (y === h.getFullYear() && h.getMonth() === 11); }
function datosInformeAnio(y) {
  const r = resumenAnio(STATE, y);
  return {
    y, mes: String(y), etiqueta: "MI AÑO", sub: "Mi año", nombre: (STATE.profile && STATE.profile.name) || "",
    foco: "", mejor: "", nota: r.nota, notaLabel: "nota del año", cerrado: true,
    tarjetas: [
      { v: String(r.cerrados), l: "días cerrados", c: "cian" },
      { v: r.habitos == null ? "—" : r.habitos + "%", l: "hábitos cumplidos", c: "cian" },
      { v: r.trimestrales[1] ? `${r.trimestrales[0]}/${r.trimestrales[1]}` : "—", l: "metas del trimestre", c: "coral" },
      { v: r.objetivos[1] ? `${r.objetivos[0]}/${r.objetivos[1]}` : "—", l: "objetivos del mes", c: "coral" },
      { v: r.libros ? String(r.libros) : "—", l: "libros terminados", c: "cian" },
      { v: r.mejorMes ? MESES[r.mejorMes.m] : "—", l: "tu mejor mes", c: "coral" },
    ],
    ahorro: r.ahorro,
  };
}
function openInformeAnio(y) {
  if (!asegurarFuncion("fun:informe-anio")) return;
  if (!informeAnioDisponible(y)) return toast(`El informe de ${y} se abre en diciembre`, true);
  openInformeMes("anio:" + y);
}

/* ============================================================
   📋 PLANTILLAS DE RUTINA
   ============================================================ */
function aplicarPlantilla(S, pid, hoy) {
  const p = PLANTILLAS.find(x => x.id === pid); if (!p) return { habitos: 0, tareas: 0 };
  hoy = hoy || todayISO();
  const nombres = new Set((S.habitos.defs || []).map(h => h.nombre.trim().toLowerCase()));
  let nh = 0, nr = 0;
  p.habitos.forEach(([icon, nombre, frecuencia]) => {
    if (nombres.has(nombre.toLowerCase())) return;
    S.habitos.defs.push({ id: uid(), nombre, icon, frecuencia: JSON.parse(JSON.stringify(frecuencia)), creado: hoy, ts: Date.now() });
    nh++;
  });
  const txts = new Set(recurrentes(S).filter(r => !r.borrada).map(r => r.txt.trim().toLowerCase()));
  p.recurrentes.forEach(([txt, ambito, regla]) => {
    if (txts.has(txt.toLowerCase())) return;
    crearRecurrente(S, { txt, ambito, regla: JSON.parse(JSON.stringify(regla)), desde: hoy });
    nr++;
  });
  return { habitos: nh, tareas: nr };
}
function openPlantillas() {
  const txtFreq = f => hmFreqLabel({ frecuencia: f });
  openModal("📋 Plantillas de rutina", `
    <p class="text-sm soft">Hábitos y tareas recurrentes ya armados para partir rápido. Se agregan a los tuyos (no se repiten) y después puedes editarlos.</p>
    ${PLANTILLAS.map(p => {
      const tiene = funcion("plantilla-" + p.id);
      return `<div class="card mt-16"><div class="flex-between" style="gap:10px"><div class="card__title" style="font-size:15px">${p.icon} ${p.nombre}</div>
        ${tiene ? `<button class="btn btn--cian" data-action="plantilla-aplicar" data-id="${p.id}">Aplicar</button>` : `<button class="btn btn--primary" data-action="fun-buy" data-id="plantilla:${p.id}">200 ⭐</button>`}</div>
        <div class="text-xs muted mt-8">${p.habitos.map(([i, n, f]) => `${i} ${n} <span class="muted">(${txtFreq(f)})</span>`).join(" · ")}</div>
        <div class="text-xs muted mt-8">🔁 ${p.recurrentes.map(([t, , r]) => `${t} <span class="muted">(${textoRegla(r).toLowerCase()})</span>`).join(" · ")}</div></div>`;
    }).join("")}`);
}
function aplicarPlantillaUI(pid) {
  const r = aplicarPlantilla(STATE, pid);
  saveState(); closeModal(); rerender();
  toast(r.habitos || r.tareas ? `📋 Listo: ${r.habitos} hábitos y ${r.tareas} tareas recurrentes` : "Ya tenías todo lo de esta plantilla");
}

/* ============================================================
   🎨 PACKS DE ÍCONOS (se suman al selector de íconos de hábitos)
   ============================================================ */
function iconosExtra() { return PACKS_ICONOS.filter(p => funcion("iconos-" + p.id)).flatMap(p => p.iconos); }

/* ============================================================
   Tienda: sección Funciones
   ============================================================ */
function renderFuncionesTienda() {
  const card = (fid, it, extra) => {
    const tiene = funcion(claveFuncion(fid));
    return `<div class="card util-card" data-fun="${fid}">
      <div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">${it.icon}</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${it.nombre}</div>
          <div class="text-xs muted">${tiene ? '<b class="hl-cian">✓ Desbloqueada</b>' : it.costo + " ⭐ · una vez"}</div></div></div>
      <p class="text-sm soft mt-8">${it.desc}</p>
      ${it.donde ? `<p class="text-xs muted mt-8">📍 ${it.donde}</p>` : ""}${extra || ""}
      ${tiene ? "" : `<button class="btn btn--primary btn-block mt-8" data-action="fun-buy" data-id="${fid}">Desbloquear · ${it.costo} ⭐</button>`}
    </div>`;
  };
  const plantillas = { icon: "📋", nombre: "Plantillas de rutina", costo: 200, desc: "Hábitos y tareas recurrentes ya armados: " + PLANTILLAS.map(p => p.nombre).join(", ") + ".", donde: "Hábitos → 📋 Plantillas" };
  const packs = `<div class="row-wrap mt-8" style="gap:6px">${PACKS_ICONOS.map(p => funcion("iconos-" + p.id)
    ? `<span class="chip chip--cian">${p.icon} ${p.nombre} ✓</span>`
    : `<button class="chip" data-action="fun-buy" data-id="iconos:${p.id}">${p.icon} ${p.nombre} · 150 ⭐</button>`).join("")}</div>`;
  return `<div class="section-title">⚙️ Funciones <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· se desbloquean una vez y quedan para siempre</span></div>
    <div class="grid grid-3">
      ${FUNCIONES.map(f => card("fun:" + f.id, f)).join("")}
      <div class="card util-card"><div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">📋</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${plantillas.nombre}</div><div class="text-xs muted">200 ⭐ cada una</div></div></div>
        <p class="text-sm soft mt-8">${plantillas.desc}</p><p class="text-xs muted mt-8">📍 ${plantillas.donde}</p>
        <button class="btn btn--soft btn-block mt-8" data-action="plantillas-open">Ver plantillas</button></div>
      <div class="card util-card"><div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">🎨</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">Packs de íconos</div><div class="text-xs muted">150 ⭐ cada pack · 24 íconos</div></div></div>
        <p class="text-sm soft mt-8">Más íconos para tus hábitos.</p>${packs}</div>
    </div>`;
}
