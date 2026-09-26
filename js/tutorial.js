/* ============================================================
   RUMBO · Tutorial interactivo
   1) Recorridos guiados sobre la app real: oscurece la pantalla, ilumina el elemento
      y explica con una burbuja. Si un elemento no está (módulo oculto, otra vista),
      ese paso se salta: el recorrido nunca se queda pegado.
   2) Ayuda por pantalla: la primera vez que entras a una sección, un recorrido corto
      (se puede apagar). El botón ? de arriba lo repite.
   3) Misión "Primeros pasos" en Inicio: se marca sola al hacer cada cosa de verdad.
   4) Centro de tutoriales (Ajustes → 🎓 Tutoriales).
   Lo visto vive en settings.tutorial = { vistos: {id: ts}, mision, auto, ts }.
   ============================================================ */

/* -------- Recorridos -------- */
// Cada paso: { ruta?, el?: selector | { sel, txt } | [varios, el primero visible gana], titulo, texto (o fn(movil)), prep? }
// Un paso sin "el" se muestra al centro.
const TOURS = {
  general: {
    icon: "🧭", titulo: "Recorrido por Rumbo", desc: "Lo esencial en un minuto: tu día, tus tareas, tus hábitos, el menú y los rituales.",
    pasos: [
      { titulo: "Te muestro Rumbo 👋", texto: "Un recorrido de un minuto por lo esencial, sobre tu propia app. Sal cuando quieras con ✕ (o Esc)." },
      { ruta: "inicio", el: ["[data-tour=dia] .card", "[data-tour=dia]"], titulo: "Tu día empieza aquí",
        texto: "En la mañana <b>abres tu día</b> (tu enfoque, tu primer bocado y tus tareas) y en la noche lo <b>cierras</b>. ¿Día apretado? <b>⚡ Express</b> lo hace en 3 toques." },
      { ruta: "inicio", el: { sel: "#view .card", txt: "Tareas de hoy" }, titulo: "Tus tareas de hoy",
        texto: m => `Separadas en 💼 profesionales y 🏠 personales, con tu <b>${BOCADO.corto.toLowerCase()}</b> ${BOCADO.emoji} arriba: la más importante del día.${m ? " Desliza una tarea → para marcarla o ← para posponerla." : ""} Toca su texto para editarla.` },
      { ruta: "inicio", el: { sel: "#view .card", txt: "Hábitos de hoy" }, titulo: "Hábitos de hoy",
        texto: "Solo aparecen los que te tocan hoy según su frecuencia. Un toque y listo." },
      { el: ".topbar__meta", titulo: "Tus monedas y tu racha",
        texto: "⭐ son tus monedas: las ganas abriendo y cerrando días, con hábitos y objetivos, y las gastas en la Tienda. 🔥 es tu racha de días cerrados." },
      { el: ["#bottombar", "#nav"], titulo: "Tu menú",
        texto: m => m ? "Abajo tienes lo del día a día. En <b>☰ Más</b> está el resto: Finanzas, Salud, Lecturas, Tendencias y más."
          : "A la izquierda, lo del día a día arriba y el resto en <b>Más</b>. Con ⚙️ Personalizar menú ocultas lo que no uses." },
      { ruta: "ritual", prep: () => { RITUAL_VIEW = "dia"; }, el: "#view .seg", titulo: "Tus rituales",
        texto: "<b>Día</b>, <b>Semana</b>, <b>Mes</b> y <b>Trimestre</b>: abrir y cerrar cada ciclo mantiene vivo todo tu sistema. Cada ritual da ⭐." },
      { ruta: "semana", el: [".week-scroll", "#view .card"], titulo: "Tu semana",
        texto: "Tu plan (foco y 3 prioridades) y tus 7 días. Lo que no alcanzas lo decides al cerrar el día: <b>&gt;</b> mañana, <b>&lt;</b> otro día, <b>@</b> delegar o <b>✕</b> soltar." },
      { el: "#helpBtn", titulo: "¿Dudas? Toca ?",
        texto: "Cada pantalla tiene su propia ayuda. Y en <b>🎓 Tutoriales</b> (en el menú) repites cualquier recorrido." },
      { ruta: "inicio", el: "[data-tour=mision]", titulo: "Tu misión: primeros pasos",
        texto: "Seis cosas para arrancar. Se marcan solas cuando las haces y al completarlas ganas +100 ⭐ y la insignia Explorador." },
      { titulo: "¡Listo! 🚀", texto: "Eso es lo esencial. Parte abriendo tu día: te toma 30 segundos." },
    ],
  },
  ritual: {
    icon: "🌅", titulo: "Ritual", desc: "Abrir y cerrar tu día, tu semana, tu mes y tu trimestre.",
    pasos: [
      { ruta: "ritual", prep: () => { RITUAL_VIEW = "dia"; }, el: "#view .seg", titulo: "Cuatro ritmos",
        texto: "<b>Día</b> (cada día), <b>Semana</b> (domingo o lunes), <b>Mes</b> (al empezar y terminar) y <b>Trimestre</b> (cada 3 meses)." },
      { ruta: "ritual", el: ["[data-tour=ritual-dia] .card", "#view .card"], titulo: "Abrir y cerrar",
        texto: "Abrir: enfoque, primer bocado y tareas. Cerrar: decides qué pasa con lo pendiente, reflexionas y agradeces. Abrir y cerrar mantiene tu racha 🔥." },
      { ruta: "ritual", el: "#view [data-action=day-open-express], #view [data-action=day-close-express]", titulo: "⚡ Express",
        texto: "Para días apretados: 3 toques. Tus pendientes pasan a mañana y la racha se mantiene (con la mitad de monedas)." },
    ],
  },
  semana: {
    icon: "🗂️", titulo: "Semana", desc: "Tu plan, tus 7 días, recurrentes y lo que viene.",
    pasos: [
      { ruta: "semana", el: ".sem-nav", titulo: "Muévete entre semanas", texto: "‹ › para ver la semana pasada o planificar la próxima." },
      { ruta: "semana", el: { sel: "#view .card", txt: "Plan de la semana" }, titulo: "Tu plan",
        texto: "Un foco y 3 prioridades conectadas con tus objetivos del mes. Planificar y cerrar la semana dan +75 ⭐ cada uno." },
      { ruta: "semana", el: ".week-scroll", titulo: "Tus 7 días",
        texto: "Cada tarea vive en su fecha y guarda su historia. Los signos te dicen qué pasó: ✓ hecha, &gt; movida, &lt; programada, @ delegada, ✕ soltada." },
      { ruta: "semana", el: "[data-action=rec-open]", titulo: "🔁 Recurrentes", texto: "Pagar el arriendo el día 5, la reunión de los lunes: créalas una vez y aparecen solas." },
    ],
  },
  habitos: {
    icon: "📊", titulo: "Hábitos", desc: "Frecuencias reales, rachas y vistas.",
    pasos: [
      { ruta: "habitos", el: "[data-action=habit-add]", titulo: "Crea tus hábitos",
        texto: "Cada uno con su frecuencia: <b>diario</b>, <b>X por semana</b>, <b>días fijos</b> o <b>X al mes</b>. Ir al gimnasio 3 veces por semana cuenta como 100%." },
      { ruta: "habitos", el: "#view .seg", titulo: "Distintas vistas", texto: "Hoy para marcar rápido; semana, mes y año para ver tu constancia." },
      { ruta: "habitos", el: "#view .pill--streak", titulo: "Tu racha", texto: "Días seguidos cumpliendo todos los hábitos que tocaban. Pausa un hábito si lo necesitas: no rompe nada." },
    ],
  },
  metas: {
    icon: "🎯", titulo: "Objetivos", desc: "Metas del trimestre y objetivos del mes.",
    pasos: [
      { ruta: "metas", el: ".anio-nav", titulo: "Año a año", texto: "Revisa años anteriores o adelanta las metas del próximo." },
      { ruta: "metas", el: { sel: "#view .card", txt: "Trimestre" }, titulo: "Metas del trimestre", texto: "De 3 a 5 metas grandes. Se definen en la revisión trimestral (Ritual → Trimestre)." },
      { ruta: "metas", el: ".mes-actual", titulo: "Objetivos del mes", texto: "Pasos concretos hacia tus metas. Ábrelos y ciérralos con el ritual de mes." },
    ],
  },
  diario: {
    icon: "📔", titulo: "Diario", desc: "Tu historial de días, ánimo y reflexiones.",
    pasos: [
      { ruta: "diario", el: "#view .card", titulo: "Tu diario", texto: "Cada día que abres y cierras queda aquí: tu ánimo, tu reflexión y lo que agradeciste. También tus cierres de mes y de trimestre." },
    ],
  },
  finanzas: {
    icon: "💰", titulo: "Finanzas", desc: "Meta de ahorro, gastos recurrentes y seguimiento mensual.",
    pasos: [
      { ruta: "finanzas", el: { sel: "#view .card", txt: "Progreso" }, titulo: "Tu progreso del año", texto: "Cuánto llevas ahorrado frente a tu meta anual." },
      { ruta: "finanzas", el: { sel: "#view .card", txt: "Gastos recurrentes" }, titulo: "Gastos recurrentes", texto: "Lo que pagas todos los meses, para no olvidarlo." },
      { ruta: "finanzas", el: { sel: "#view .card", txt: "Seguimiento mensual" }, titulo: "Mes a mes", texto: "Anota ingreso y gasto: el ahorro se calcula solo y aparece en Inicio." },
    ],
  },
  tendencias: {
    icon: "📈", titulo: "Tendencias", desc: "Tu evolución en gráficos y tu postergación.",
    pasos: [
      { ruta: "tendencias", el: "#view .card", titulo: "Tu año en gráficos", texto: "Hábitos, ánimo, ahorro, lecturas y más. Abajo, tu índice de postergación y descubrimientos sobre tus días." },
    ],
  },
  calendario: {
    icon: "🗓️", titulo: "Calendario", desc: "Tu mes de un vistazo.",
    pasos: [
      { ruta: "calendario", el: [".cal-cell--today", "#view .card"], titulo: "Tu mes de un vistazo", texto: "Toca un día para agregar un evento. Ves tus tareas, eventos y cumpleaños juntos." },
    ],
  },
  recompensas: {
    icon: "🏆", titulo: "Recompensas", desc: "Rango, insignias y la Tienda.",
    pasos: [
      { ruta: "recompensas", el: ".rank-ladder", titulo: "Tu rango", texto: "La XP mide tu rango y <b>nunca baja</b>, aunque gastes monedas." },
      { ruta: "recompensas", el: ".badge-card", titulo: "Insignias", texto: "Se desbloquean con tus logros y cada una da ⭐. Destaca tu favorita en Inicio." },
      { ruta: "recompensas", el: { sel: "#view .card", txt: "gastar" }, titulo: "La Tienda", texto: "Gasta tus ⭐ en temas, títulos y detalles." },
    ],
  },
};
/* Recorrido de la pantalla actual (Inicio → el general) */
function tourDePantalla(ruta) { return ruta === "inicio" ? "general" : (TOURS[ruta] ? ruta : null); }

/* -------- Estado guardado -------- */
function tutorialState(S) {
  S = S || STATE;
  if (!S.settings.tutorial || typeof S.settings.tutorial !== "object") S.settings.tutorial = { vistos: {}, mision: "oculta", auto: true, ts: 0 };
  if (!S.settings.tutorial.vistos || typeof S.settings.tutorial.vistos !== "object") S.settings.tutorial.vistos = {};
  return S.settings.tutorial;
}
function tourVisto(id) { return !!tutorialState().vistos[id]; }
function marcarTourVisto(id) {
  const t = tutorialState();
  if (!t.vistos[id]) { t.vistos[id] = Date.now(); saveState(); }
}
function cambiarTutorial(campo, valor) {
  const t = tutorialState();
  t[campo] = valor; t.ts = Date.now();
  saveState();
}

/* -------- Motor del recorrido -------- */
let TOUR = null;   // { id, i, dir, n }
function tourIniciar(id) {
  if (!TOURS[id]) return;
  closeModal(); setSidebar(false);
  TOUR = { id, i: 0, dir: 1, n: 0 };
  document.addEventListener("keydown", tourTeclas, true);
  window.addEventListener("resize", tourReubicar);
  tourMostrar();
}
function tourTerminar() {
  if (!TOUR) return;
  marcarTourVisto(TOUR.id);
  TOUR = null;
  document.removeEventListener("keydown", tourTeclas, true);
  window.removeEventListener("resize", tourReubicar);
  const capa = document.getElementById("tour");
  if (capa) capa.remove();
}
function tourMover(dir) {
  if (!TOUR) return;
  TOUR.dir = dir; TOUR.i += dir;
  if (TOUR.i < 0) { TOUR.i = 0; TOUR.dir = 1; }
  tourMostrar();
}
function tourTeclas(e) {
  if (!TOUR) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tourTerminar(); }
  else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); tourMover(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); tourMover(-1); }
}
function tourVisible(el) {
  if (!el || !el.getClientRects().length) return false;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
}
/* Busca el elemento de un paso: el primer candidato visible (con texto, el más chico que lo contiene) */
function tourBuscar(el) {
  const lista = Array.isArray(el) ? el : [el];
  for (const c of lista) {
    const sel = typeof c === "string" ? c : c.sel;
    let els = [];
    try { els = Array.from(document.querySelectorAll(sel)); } catch (e) { els = []; }
    if (c.txt) els = els.filter(x => x.textContent.includes(c.txt)).filter((x, _, a) => !a.some(o => o !== x && x.contains(o)));
    const v = els.find(tourVisible);
    if (v) return v;
  }
  return null;
}
function tourMostrar() {
  if (!TOUR) return;
  const t = TOURS[TOUR.id], p = t.pasos[TOUR.i];
  if (!p) return tourTerminar();
  const n = ++TOUR.n;
  if (p.ruta && moduloOculto(p.ruta)) return tourSaltar();
  const antes = typeof RITUAL_VIEW !== "undefined" ? RITUAL_VIEW : null;
  if (p.prep) p.prep();
  if (p.ruta && CURRENT !== p.ruta) { go(p.ruta); setTimeout(() => n === (TOUR && TOUR.n) && tourUbicar(p, 0), 90); return; }
  if (p.prep && typeof RITUAL_VIEW !== "undefined" && RITUAL_VIEW !== antes) rerender();
  tourUbicar(p, 0);
}
function tourSaltar() {
  if (!TOUR) return;
  TOUR.i += TOUR.dir;
  if (TOUR.i < 0) { TOUR.i = 0; TOUR.dir = 1; }
  tourMostrar();
}
/* Ubica el paso: si el elemento aún no aparece, reintenta una vez; si no está, se salta */
function tourUbicar(p, intento) {
  if (!TOUR) return;
  if (!p.el) return tourPintar(p, null);
  const el = tourBuscar(p.el);
  if (!el) {
    if (!intento) { const n = TOUR.n; return setTimeout(() => n === (TOUR && TOUR.n) && tourUbicar(p, 1), 250); }
    return tourSaltar();
  }
  const r = el.getBoundingClientRect();
  if (r.top < 70 || r.bottom > window.innerHeight - 90) el.scrollIntoView({ block: "center", behavior: "auto" });
  tourPintar(p, el);
}
function tourPasoVisible() {
  // Numeración "3 de 8" contando solo los pasos que se pueden mostrar ahora (sin los de módulos ocultos)
  const t = TOURS[TOUR.id];
  const validos = t.pasos.map((p, i) => ({ p, i })).filter(x => !(x.p.ruta && moduloOculto(x.p.ruta)));
  return { n: validos.findIndex(x => x.i === TOUR.i) + 1, total: validos.length };
}
function tourPintar(p, el) {
  let capa = document.getElementById("tour");
  if (!capa) {
    capa = document.createElement("div");
    capa.id = "tour"; capa.className = "tour";
    capa.innerHTML = `<div class="tour-hueco"></div><div class="tour-pop" role="dialog" aria-modal="true" aria-live="polite"></div>`;
    document.body.appendChild(capa);
  }
  const t = TOURS[TOUR.id], movil = isMobileView();
  const { n, total } = tourPasoVisible();
  const ultimo = TOUR.i === t.pasos.length - 1;
  const texto = typeof p.texto === "function" ? p.texto(movil) : p.texto;
  capa.querySelector(".tour-pop").innerHTML = `
    <div class="flex-between"><span class="text-xs muted">${escapeHtml(t.titulo)} · ${n} de ${total}</span>
      <button class="icon-btn" data-action="tour-salir" aria-label="Salir del recorrido">✕</button></div>
    <div class="tour-pop__t">${p.titulo}</div>
    <div class="tour-pop__b">${texto}</div>
    <div class="tour-barra"><div style="width:${Math.round((n / total) * 100)}%"></div></div>
    <div class="row" style="gap:8px;justify-content:flex-end">
      ${TOUR.i ? `<button class="btn-ghost" data-action="tour-prev">Atrás</button>` : ""}
      <button class="btn btn--primary" data-action="tour-next">${ultimo ? "Listo ✓" : "Siguiente"}</button></div>`;
  capa.dataset.el = el ? "1" : "";
  TOUR.el = el;
  tourReubicar();
  const btn = capa.querySelector('[data-action="tour-next"]');
  if (btn) btn.focus({ preventScroll: true });
}
/* Pone el hueco sobre el elemento y la burbuja arriba o abajo, sin salirse de la pantalla */
function tourReubicar() {
  const capa = document.getElementById("tour");
  if (!capa || !TOUR) return;
  const hueco = capa.querySelector(".tour-hueco"), pop = capa.querySelector(".tour-pop");
  const W = window.innerWidth, H = window.innerHeight, M = 12;
  const el = TOUR.el && document.body.contains(TOUR.el) ? TOUR.el : null;
  pop.style.width = Math.min(360, W - 2 * M) + "px";
  if (!el) {
    hueco.style.cssText = `left:${W / 2}px;top:${H / 2}px;width:0;height:0`;
    pop.style.left = (W - pop.offsetWidth) / 2 + "px";
    pop.style.top = Math.max(M, (H - pop.offsetHeight) / 2) + "px";
    return;
  }
  const r = el.getBoundingClientRect(), pad = 6;
  const top = Math.max(4, r.top - pad), bottom = Math.min(H - 4, r.bottom + pad);   // si es más alto que la pantalla, se recorta
  const left = Math.max(4, r.left - pad), right = Math.min(W - 4, r.right + pad);
  hueco.style.cssText = `left:${left}px;top:${top}px;width:${right - left}px;height:${Math.max(0, bottom - top)}px`;
  const ph = pop.offsetHeight, pw = pop.offsetWidth;
  let y;
  if (H - bottom >= ph + 2 * M) y = bottom + M;
  else if (top >= ph + 2 * M) y = top - ph - M;
  else y = H - ph - M;   // no cabe arriba ni abajo: al pie, sobre el elemento
  const x = Math.min(W - pw - M, Math.max(M, left + (right - left) / 2 - pw / 2));
  pop.style.left = x + "px"; pop.style.top = Math.max(M, y) + "px";
}

/* Ayuda automática la primera vez que entras a una pantalla */
function tourAuto(ruta) {
  if (!STATE || !STATE.settings.onboarded || TOUR) return;
  const id = ruta === "inicio" ? null : tourDePantalla(ruta);
  if (!id || tutorialState().auto === false || tourVisto(id)) return;
  setTimeout(() => {
    if (TOUR || CURRENT !== ruta || !document.getElementById("modalOverlay").hidden || ONB_ACTIVE || tourVisto(id)) return;
    tourIniciar(id);
  }, 700);
}

/* -------- Misión "Primeros pasos" -------- */
const MISION = [
  { id: "abrir", icon: "🌅", t: "Abre tu primer día", ruta: "ritual", check: s => Object.values(s.ritual.dias || {}).some(r => r && r.hecho) },
  { id: "bocado", icon: BOCADO.emoji, t: `Completa tu ${BOCADO.corto.toLowerCase()}`, ruta: "inicio",
    check: s => Object.values((s.agenda && s.agenda.dias) || {}).some(d => Array.isArray(d) && d.some(x => x && !x.borrada && x.esSapo && estadoTarea(x) === "hecha")) },
  { id: "habito", icon: "📊", t: "Marca un hábito", ruta: "habitos",
    check: s => Object.values((s.habitos && s.habitos.log) || {}).some(m => Object.values(m || {}).some(h => Object.values(h || {}).some(Boolean))) },
  { id: "objetivo", icon: "🎯", t: "Define un objetivo del mes", ruta: "metas", check: s => todosLosMensuales(s).flat().some(o => o && o.texto) },
  { id: "cerrar", icon: "🌙", t: "Cierra tu día", ruta: "ritual", check: s => Object.values(s.ritual.dias || {}).some(r => r && r.cerrado) },
  { id: "semana", icon: "📅", t: "Planifica tu semana", ruta: "semana", check: s => Object.values(s.ritual.semanas || {}).some(w => w && w.apertura) },
];
function misionPasos(S) {
  S = S || STATE;
  return MISION.map(m => { let ok = false; try { ok = !!m.check(S); } catch (e) { ok = false; } return Object.assign({}, m, { ok }); });
}
function misionCompleta(S) { return misionPasos(S).every(m => m.ok); }

function renderMisionCard() {
  const t = tutorialState();
  if (t.mision !== "activa") return "";
  const pasos = misionPasos(), hechos = pasos.filter(m => m.ok).length;
  if (hechos === pasos.length) {
    return `<div class="card mision mision--ok" data-tour="mision" style="margin-bottom:20px">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">🎉 ¡Completaste tus primeros pasos!</div>
        <div class="text-sm soft mt-8">Ganaste la insignia 🧭 Explorador (+100 ⭐). Ya conoces lo esencial de Rumbo.</div></div>
        <button class="btn btn--primary" data-action="mision-cerrar">Genial</button></div></div>`;
  }
  return `<div class="card mision" data-tour="mision" style="margin-bottom:20px">
    <div class="card__head"><div class="card__title">🚀 Primeros pasos · ${hechos}/${pasos.length}</div>
      <button class="btn-ghost" data-action="mision-ocultar" title="Puedes volver a mostrarla en 🎓 Tutoriales">Ocultar</button></div>
    <div class="bar"><div class="bar__fill" style="width:${Math.round((hechos / pasos.length) * 100)}%"></div></div>
    <div class="mision__lista mt-16">${pasos.map(m => `<button class="mision__paso ${m.ok ? "is-ok" : ""}" data-action="mision-ir" data-ruta="${m.ruta}" ${m.ok ? "disabled" : ""}>
      <span class="check ${m.ok ? "is-on" : ""}">${m.ok ? "✓" : ""}</span><span>${m.icon} ${escapeHtml(m.t)}</span></button>`).join("")}</div>
    <div class="text-xs muted mt-8">Se marcan solos cuando los haces. Al completarlos: +100 ⭐ e insignia Explorador.</div>
  </div>`;
}

/* -------- Centro de tutoriales -------- */
function renderTutoriales() {
  const t = tutorialState(), pasos = misionPasos(), hechos = pasos.filter(m => m.ok).length;
  const fila = id => {
    const x = TOURS[id], visto = tourVisto(id);
    return `<div class="item-row"><span style="font-size:20px">${x.icon}</span>
      <div class="item-row__main"><div class="item-row__title">${escapeHtml(x.titulo)}</div><div class="item-row__sub">${escapeHtml(x.desc)}</div></div>
      ${visto ? '<span class="chip chip--done">✓ visto</span>' : ""}
      <button class="btn btn--soft" data-action="tour-start" data-id="${id}">${visto ? "Repetir" : "Ver"}</button></div>`;
  };
  const pantallas = Object.keys(TOURS).filter(id => id !== "general" && !moduloOculto(id));
  const g = TOURS.general;
  return `
  <div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
    <div class="flex-between" style="flex-wrap:wrap;gap:14px">
      <div style="min-width:0"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Recorrido guiado</div>
        <div class="big-num">${g.icon} ${g.titulo}</div>
        <div class="text-sm soft">${g.desc}</div></div>
      <button class="btn btn--primary" data-action="tour-start" data-id="general">${tourVisto("general") ? "Repetir recorrido" : "Empezar recorrido"}</button>
    </div>
  </div>
  <div class="grid grid-2 mt-16">
    <div class="card">
      <div class="card__head"><div class="card__title">🚀 Primeros pasos · ${hechos}/${pasos.length}</div>
        <label class="row text-sm" style="gap:6px;cursor:pointer"><input type="checkbox" ${t.mision === "activa" ? "checked" : ""} onchange="misionMostrar(this.checked)"> En Inicio</label></div>
      ${pasos.map(m => `<div class="item-row"><span class="check ${m.ok ? "is-on" : ""}">${m.ok ? "✓" : ""}</span>
        <div class="item-row__main"><div class="item-row__title ${m.ok ? "strike" : ""}">${m.icon} ${escapeHtml(m.t)}</div></div>
        ${m.ok ? "" : `<button class="btn-ghost" data-action="mision-ir" data-ruta="${m.ruta}">Ir</button>`}</div>`).join("")}
    </div>
    <div class="card">
      <div class="card__title">⚙️ Preferencias</div>
      <label class="mes-hab mt-16" style="cursor:pointer"><span class="mes-hab__n">Mostrar la ayuda la primera vez que entro a cada pantalla</span>
        <input type="checkbox" ${t.auto === false ? "" : "checked"} onchange="tutorialAuto(this.checked)"></label>
      <p class="text-xs muted mt-8">Arriba, el botón <b>?</b> repite la ayuda de la pantalla en que estás.</p>
      <div class="divider"></div>
      <button class="btn-ghost btn-block" data-action="show-tutorial">📖 Ver la introducción (láminas)</button>
      <button class="btn-ghost btn-block mt-8" data-action="tour-reset">↺ Volver a mostrar toda la ayuda</button>
    </div>
  </div>
  <div class="section-title mt-24">Ayuda por pantalla</div>
  <div class="card">${pantallas.map(fila).join("")}</div>`;
}
function misionMostrar(on) { cambiarTutorial("mision", on ? "activa" : "oculta"); rerender(); }
function tutorialAuto(on) { cambiarTutorial("auto", !!on); toast(on ? "La ayuda aparecerá en cada pantalla nueva" : "Ayuda automática apagada"); }
function tourReiniciar() {
  const t = tutorialState();
  t.vistos = {}; t.auto = true; t.ts = t.reset = Date.now();
  saveState(); rerender(); toast("Listo: la ayuda volverá a aparecer en cada pantalla");
}
