/* ============================================================
   RUMBO · App core: router, navegación, Inicio y motor de eventos
   ============================================================ */

/* -------- Configuración de navegación -------- */
/* Principal: siempre visible. "Más" (mas: true): se puede ocultar en Personalizar menú (settings.menu.ocultos). */
const ROUTES = [
  { grupo: "Principal" },
  { id: "inicio", label: "Inicio", icon: "🏠", render: renderInicio, subtitle: "Tu centro de control diario." },
  { id: "ritual", label: "Ritual", icon: "🌅", render: renderRitual, subtitle: "Abre y cierra tu día, tu semana y tu mes." },
  { id: "semana", label: "Semana", icon: "🗂️", render: renderSemana, subtitle: "Tu plan y tus tareas de lunes a domingo." },
  { id: "habitos", label: "Hábitos", icon: "📊", render: renderHabitos, subtitle: "Marca cada día y cuida tu racha." },
  { id: "metas", label: "Objetivos", icon: "🎯", render: renderMetas, subtitle: "Tus metas trimestrales y mensuales." },
  { id: "diario", label: "Diario", icon: "📔", render: renderDiario, subtitle: "Tu día a día: ánimo, reflexión e historial del ritual." },
  { grupo: "Más" },
  { id: "tendencias", mas: true, label: "Tendencias", icon: "📈", render: renderTendencias, subtitle: "Tu evolución del año en gráficos." },
  { id: "calendario", mas: true, label: "Calendario", icon: "🗓️", render: renderCalendario, subtitle: "Tu mes de un vistazo." },
  { id: "finanzas", mas: true, label: "Finanzas", icon: "💰", render: renderFinanzas, subtitle: "Ahorro, gastos y seguimiento mensual." },
  { id: "salud", mas: true, label: "Salud y bienestar", icon: "💪", render: renderSalud, subtitle: "Entrenamiento, cocina y peso." },
  { id: "entrenamiento", mas: true, label: "Entrenamiento", icon: "🏋️", render: renderEntrenamiento, subtitle: "Tu rutina por bloques." },
  { id: "rueda", mas: true, label: "Rueda de la vida", icon: "🧭", render: renderRueda, subtitle: "Puntúa cada área del 0 al 10." },
  { id: "lecturas", mas: true, label: "Lecturas", icon: "📚", render: renderLecturas, subtitle: "Tu biblioteca personal de lectura." },
  { id: "relaciones", mas: true, label: "Relaciones", icon: "👥", render: renderRelaciones, subtitle: "Cumpleaños y con quién no hablas hace rato." },
  { id: "listas", mas: true, label: "Listas", icon: "🧾", render: renderListas, subtitle: "Compras, películas, viajes y más." },
  { id: "aprendizajes", mas: true, label: "Aprendizajes", icon: "🧠", render: renderAprendizajes, subtitle: "Temas profesionales y de interés." },
  { id: "notas", mas: true, label: "Notas", icon: "📝", render: renderNotas, subtitle: "Captura rápida y notas organizadas por categoría." },
  { id: "recompensas", mas: true, label: "Recompensas", icon: "🏆", render: renderRecompensas, subtitle: "Tu rango, tus insignias y la tienda de cosméticos." },
  { grupo: "Ajustes" },
  { id: "tienda", label: "Tienda", icon: "🛒", render: renderTienda, subtitle: "Desbloquea temas, títulos y detalles con tus ⭐." },
  { id: "cuenta", label: "Cuenta", icon: "🔐", render: renderCuenta, subtitle: "Tus datos, seguridad y sesión." },
  { id: "notif", label: "Notificaciones", icon: "🔔", render: renderNotificaciones, subtitle: "Recordatorios de tu ritual (mañana y noche)." },
];
const ROUTE_MAP = {};
ROUTES.forEach(r => { if (r.id) ROUTE_MAP[r.id] = r; });
/* Módulos ocultos por la persona (settings.menu.ocultos) */
function moduloOculto(id) { const m = STATE && STATE.settings && STATE.settings.menu; return !!(m && (m.ocultos || []).includes(id) && ROUTE_MAP[id] && ROUTE_MAP[id].mas); }
/* Orden de secciones para el gesto de deslizar (mismo orden del menú, sin las ocultas) */
function seccionesVisibles() { return ROUTES.filter(r => r.id && !moduloOculto(r.id)).map(r => r.id); }

let CURRENT = "inicio";
let CURRENT_USER = null;

/* -------- Init / arranque con autenticación -------- */
document.addEventListener("DOMContentLoaded", () => { boot(); });

async function boot() {
  // Listeners globales (una sola vez)
  document.addEventListener("click", onClick);
  // Teclado: Enter o Espacio activan los controles que no son botones (checkboxes de tareas, texto editable)
  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[data-action][tabindex]:not(button):not(input):not(textarea)')) {
      e.preventDefault(); e.target.click();
    }
  });
  document.getElementById("view").addEventListener("change", onBind);
  document.getElementById("view").addEventListener("input", onBindLive);
  document.getElementById("hamburger").addEventListener("click", () =>
    setSidebar(!document.getElementById("sidebar").classList.contains("is-open")));
  document.getElementById("sidebarBackdrop").addEventListener("click", () => setSidebar(false));
  initGestures();
  window.addEventListener("online", () => { if (CURRENT_USER) scheduleCloudSave(); });
  // Al volver a la app (cambiar de pestaña/ventana o enfocar), traer lo último de la nube;
  // al ocultarla/cerrarla, subir de inmediato lo pendiente (no perder el cierre recién hecho).
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushCloudSave(); else syncFromCloud(); });
  window.addEventListener("focus", () => syncFromCloud());
  window.addEventListener("pagehide", () => flushCloudSave());
  window.addEventListener("hashchange", onRoute);
  document.getElementById("authScreen").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); (document.getElementById("form-register").hidden ? doLogin : doRegister)(); }
  });

  const user = await BACKEND.getSession();
  if (user) await enterApp(user);
  else showAuth();
}

function showAuth() {
  document.getElementById("app").hidden = true;
  document.getElementById("authScreen").hidden = false;
}

async function enterApp(user) {
  CURRENT_USER = user;
  await loadUserState(user);
  applyTheme(STATE.settings.theme);
  applyCosmetics();
  buildNav();
  renderAccountBox();
  document.getElementById("authScreen").hidden = true;
  document.getElementById("app").hidden = false;
  updateTopbar();
  onRoute();
  if (!STATE.settings.onboarded) setTimeout(() => openOnboarding("nuevo"), 350);
  else if ((STATE.settings.introVersion || 1) < INTRO_VERSION) setTimeout(openNovedades, 450);
}

/* -------- Introducción (recorrido) para usuarios nuevos; se puede volver a ver -------- */
const INTRO_VERSION = 6;          // sube cuando haya novedades que mostrar a usuarios existentes (ver NOVEDADES)
let ONB_STEP = 0;
let ONB_MODE = "nuevo";           // nuevo (termina en el formulario) | repetir (termina en "Listo")
let ONB_ACTIVE = false;
const ONB_SLIDES = [
  { icon: "👋", titulo: "Bienvenido a Rumbo",
    cuerpo: "Tu vida en un solo lugar: un centro de control personal para tu día, tus hábitos, tus objetivos, tus finanzas y tu bienestar. Simple, privado y sincronizado entre tus dispositivos." },
  { icon: "🌅", titulo: "El ritual diario",
    cuerpo: `<b>Abre tu día</b> en la mañana: tu misión, tu ${BOCADO.corto.toLowerCase()}, tus tareas ${AMBITOS.pro.icon} profesionales y ${AMBITOS.per.icon} personales, y tu energía. De noche, <b>ciérralo</b>: decide qué pasa con lo pendiente, reflexiona y agradece.<br><br>La idea es usar la app lo <i>menos</i> posible: abrir y cerrar mantiene vivo todo tu sistema.` },
  { icon: BOCADO.emoji, titulo: "Tu Primer Bocado",
    cuerpo: `<i>¿Cómo te comes un elefante? Un bocado a la vez.</i><br><br>${BOCADO.titulo} es la tarea más importante del día: la que más mueve la aguja. <b>${BOCADO.accion}</b> y el resto del día fluye.` },
  { icon: "📋", titulo: "Tu registro diario",
    cuerpo: "Como en un bullet journal: cada tarea vive en su fecha y guarda su historia. Lo que no alcanzas lo decides al cerrar el día: <b>&gt;</b> mañana, <b>&lt;</b> otro día, <b>@</b> delegar o <b>✕</b> soltar.<br><br>Así ves cuánto postergas y qué se te repite, sin culpa: la métrica informa, no castiga. A la tercera postergación, Rumbo te pregunta si vale la pena." },
  { icon: "📅", titulo: "Ritual de semana",
    cuerpo: "El domingo (o el lunes, tú eliges) <b>cierras tu semana</b>: tus prioridades, tus números y tus pendientes. Y enseguida <b>planificas la siguiente</b>: un foco, 3 prioridades conectadas con tus objetivos del mes, tus días y tu premio." },
  { icon: "🗓️", titulo: "Ritual de mes",
    cuerpo: "Al empezar cada mes, <b>ábrelo</b>: mira cómo te fue, define un foco y 3 a 5 objetivos conectados con tus metas del trimestre. Al terminar, <b>ciérralo</b>: revisa tus objetivos, tus números y tu rueda de la vida." },
  { icon: "📊", titulo: "Hábitos con frecuencia real",
    cuerpo: "Cada hábito tiene su objetivo: <b>diario</b>, <b>X veces por semana</b>, <b>días fijos</b> o <b>X veces al mes</b>. Se miden contra ese objetivo, no contra 7 días: ir al gimnasio 3 veces por semana es un 100%." },
  { icon: "🧭", titulo: "Todo en un lugar", cuerpo: "__GRID__" },
  { icon: "🏆", titulo: "Recompensas",
    cuerpo: "Ganas <b>monedas ⭐</b> abriendo y cerrando tus días, cumpliendo hábitos y objetivos. Las monedas se gastan en la <b>Tienda</b> (temas, títulos y detalles).<br><br>La <b>XP</b> es distinta: mide tu rango y <b>nunca baja</b>, aunque gastes. Además desbloqueas insignias por tus logros." },
];
function openOnboarding(mode = "nuevo") { ONB_MODE = mode; ONB_STEP = 0; ONB_ACTIVE = true; renderOnboardingStep(); }
function onbMover(delta) {
  const max = ONB_MODE === "nuevo" ? ONB_SLIDES.length : ONB_SLIDES.length - 1;
  ONB_STEP = Math.max(0, Math.min(max, ONB_STEP + delta));
  renderOnboardingStep();
}
function onbSaltar() {
  if (ONB_MODE === "nuevo") { ONB_STEP = ONB_SLIDES.length; renderOnboardingStep(); }
  else onbTerminar();
}
function onbTerminar() {
  ONB_ACTIVE = false;
  if ((STATE.settings.introVersion || 0) < INTRO_VERSION) { STATE.settings.introVersion = INTRO_VERSION; saveState(); }
  closeModal();
}
function renderOnboardingStep() {
  const conForm = ONB_MODE === "nuevo";
  const total = ONB_SLIDES.length + (conForm ? 1 : 0);
  const dots = Array.from({ length: total }, (_, i) => `<span class="onb-dot ${i === ONB_STEP ? "is-on" : ""}"></span>`).join("");
  ONB_ACTIVE = true;
  if (ONB_STEP < ONB_SLIDES.length) {
    const s = ONB_SLIDES[ONB_STEP];
    const ultima = ONB_STEP === ONB_SLIDES.length - 1;
    let cuerpo = s.cuerpo;
    if (cuerpo === "__GRID__") {
      const areas = [["📔", "Diario"], ["🎯", "Objetivos"], ["🗂️", "Semana"], ["📊", "Hábitos"], ["📚", "Lecturas"], ["💰", "Finanzas"],
        ["💪", "Salud"], ["👥", "Relaciones"], ["🧾", "Listas"], ["📝", "Notas"], ["📈", "Tendencias"], ["🧭", "Rueda"]];
      cuerpo = `Rumbo reúne lo que hoy tienes disperso:
        <div class="onb-grid">${areas.map(a => `<div class="onb-area"><span>${a[0]}</span>${a[1]}</div>`).join("")}</div>`;
    }
    openModal(ONB_MODE === "nuevo" ? "Bienvenido 🎉" : "Introducción a Rumbo", `
      <div class="onb-slide"><div class="onb-ico">${s.icon}</div>
        <h3 class="onb-title">${s.titulo}</h3>
        <div class="onb-body">${cuerpo}</div></div>
      <div class="onb-dots">${dots}</div>
      <div class="onb-nav">
        ${ONB_STEP ? `<button class="btn-ghost" data-action="onb-prev">Atrás</button>` : `<button class="btn-ghost" data-action="onb-skip">Saltar</button>`}
        ${ONB_STEP && !ultima ? `<button class="btn-ghost onb-skip-link" data-action="onb-skip">Saltar</button>` : ""}
        <button class="btn btn--primary" data-action="${ultima && !conForm ? "onb-done" : "onb-next"}">${ultima ? (conForm ? "Continuar" : "Listo ✓") : "Siguiente"}</button>
      </div>
      <div class="text-xs muted onb-hint">Desliza o usa las flechas ← →</div>`);
  } else {
    openModal("Cuéntanos de ti", `
      <p class="soft" style="margin-bottom:16px">Último paso: personaliza tu experiencia (puedes cambiarlo cuando quieras).</p>
      <div class="field"><label>¿Cómo te llamas?</label><input class="input" id="ob-name" value="${escapeAttr(STATE.profile.name || (CURRENT_USER && CURRENT_USER.name) || "")}" placeholder="Tu nombre"></div>
      <div class="field"><label>Tu fecha de nacimiento</label><input class="input" type="date" id="ob-birth" value="${STATE.profile.birthDate || ""}">
        <div class="text-xs muted mt-8">Para tu contador de vida en la portada.</div></div>
      <div class="field"><label>¿Qué te mueve? (tu lema)</label><input class="input" id="ob-motto" value="${escapeAttr(STATE.profile.motto || "")}" placeholder="Ej: Ser mi mejor versión"></div>
      <div class="onb-dots">${dots}</div>
      <div class="onb-nav">
        <button class="btn-ghost" data-action="onb-prev">Atrás</button>
        <button class="btn btn--primary" data-action="onboarding-save">Empezar 🚀</button>
      </div>`);
  }
}
/* Novedades para usuarios existentes, por versión de la introducción (se muestran una sola vez:
   quien quedó en la 1 ve las de la 2 y la 3; quien quedó en la 2, solo las de la 3) */
const NOVEDADES = {
  2: [
    [BOCADO.emoji, BOCADO.titulo, "Tu tarea más importante del día tiene nuevo nombre: ¿cómo te comes un elefante? Un bocado a la vez."],
    ["💼", "Tareas profesionales y personales", "Separa tus tareas del día en dos grupos, cada uno con su contador."],
    ["📊", "Hábitos con frecuencia", "Diario, X por semana, días fijos o X al mes. Se miden contra tu objetivo real."],
    ["🗓️", "Ritual de mes", "Abre y cierra cada mes, conectado con tus objetivos mensuales y trimestrales."],
    ["🎨", "Temas nuevos", "Navy es el nuevo tema base, Claro ahora es azul y llegan Bosque Claro y Bosque Oscuro a la Tienda."],
  ],
  3: [
    ["📋", "Registro diario", "Como en tu bullet journal: tus tareas viven en su fecha y guardan su historia. Ya no se borran al cambiar de semana."],
    ["↪", "Posponer al cerrar el día", "Decide qué pasa con cada pendiente: > mañana, < otro día, @ delegar, ✕ soltar o ✓ la hice. Lo que quede sin decidir te espera en la bandeja."],
    ["⚠", "La regla de las 3 postergaciones", "A la tercera vez, Rumbo te pregunta si vale la pena: hazla tu primer bocado, pártela en un paso más chico o suéltala."],
    ["🎯", "Foco y postergación", "En Tendencias: índice de postergación, días de arrastre, tu capacidad real, qué días postergas más y nuevos descubrimientos."],
    ["📅", "Ritual de semana", "El domingo (o el lunes) cierras tu semana y planificas la siguiente: foco, 3 prioridades, tus días y tu premio. +75 ⭐ cada uno."],
  ],
  4: [
    ["⚡", "Modo express", "¿Día apretado? Abre y cierra tu día en 3 toques con el botón ⚡ Express: tu primer bocado, tu energía y tu ánimo. Tus pendientes pasan a mañana y la racha se mantiene (mitad de monedas)."],
  ],
  5: [
    ["📆", "Rumbo, año tras año", "Objetivos, Finanzas, Salud, Rueda, Hábitos, Calendario y Tendencias tienen selector de año ‹ 2026 ›: revisa años anteriores o adelanta las metas del próximo. Tu 2026 queda intacto."],
    ["🎆", "Tu año en números", "Al cerrar diciembre verás tu año completo: días cerrados, hábitos, objetivos, ahorro, libros y tu mejor mes."],
  ],
  6: [
    ["🧭", "Menú más simple", "Arriba lo del día a día (Inicio, Ritual, Semana, Hábitos, Objetivos y Diario); el resto en Más. Con ⚙️ Personalizar menú ocultas lo que no uses, sin perder nada."],
    ["🗂️", "Una sola pantalla de Semana", "Tu plan (foco, prioridades y números) y tus 7 días juntos. Abajo, 📆 Más adelante: lo que tienes programado en los próximos meses."],
    ["🔁", "Tareas recurrentes", "Pagar el arriendo el día 5, la reunión de los lunes: créalas una vez en Semana → 🔁 Recurrentes y aparecen solas."],
    ["👆", "Tareas más cómodas", "En el celular, desliza una tarea a la derecha para marcarla o a la izquierda para posponerla. Toca su texto para editarlo."],
  ],
};
function openNovedades() {
  const desde = STATE.settings.introVersion || 1;
  const versiones = Object.keys(NOVEDADES).map(Number).filter(v => v > desde && v <= INTRO_VERSION).sort((a, b) => b - a);
  const lista = items => `<div class="novedades">${items.map(([ic, t, d]) => `<div class="novedad"><span class="novedad__ico">${ic}</span>
      <div><div class="novedad__t">${escapeHtml(t)}</div><div class="text-sm muted">${escapeHtml(d)}</div></div></div>`).join("")}</div>`;
  const cuerpo = versiones.map((v, i) => (i ? `<div class="divider"></div><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">También llegó antes</div>` : "") + lista(NOVEDADES[v])).join("");
  ONB_ACTIVE = false;
  openModal("✨ Novedades de Rumbo", `
    ${cuerpo}
    <div class="onb-nav mt-16">
      <button class="btn-ghost" data-action="intro-replay">📖 Ver la introducción</button>
      <button class="btn btn--primary" data-action="onb-done">¡Entendido!</button>
    </div>`);
}
function saveOnboarding() {
  STATE.profile.name = val("ob-name") || (CURRENT_USER && CURRENT_USER.name) || "Tú";
  STATE.profile.birthDate = val("ob-birth");
  STATE.profile.motto = val("ob-motto") || "Construyendo mi mejor versión";
  STATE.settings.onboarded = true;
  STATE.settings.introVersion = INTRO_VERSION;
  ONB_ACTIVE = false;
  saveState(); closeModal(); updateTopbar(); rerender();
  toast("¡Listo! Bienvenido a Rumbo 🎉");
  if (typeof maybePromptNotif === "function") setTimeout(maybePromptNotif, 500);
}

async function loadUserState(user) {
  const cloud = await BACKEND.loadState(user.id);
  let local = null;
  try { const raw = localStorage.getItem("rumbo_state_" + user.id); if (raw) local = JSON.parse(raw); } catch (e) {}
  // Fusiona nube + local: si el último guardado no alcanzó a subir a la nube (p. ej.
  // cerraste la app justo después de cerrar el día), lo local conserva ese cambio y la
  // fusión por timestamp lo recupera en vez de que la nube vieja lo borre.
  // Solo se fusiona lo local si quedó algo SIN subir; si no, la nube manda. (Antes se
  // fusionaba siempre y la copia local vieja pisaba lo hecho en otro dispositivo.)
  let pending = false;
  try { pending = !!localStorage.getItem("rumbo_pending_" + user.id); } catch (e) {}
  let data;
  if (cloud && local && pending) data = mergeStates(cloud, local);
  else data = cloud || local;
  STATE = data ? migrate(data) : defaultState();
  if (!STATE.profile.name || STATE.profile.name === "Chris") STATE.profile.name = user.name || STATE.profile.name;
  grantOwnerPerks();     // cuenta dueña: todos los temas desbloqueados
  ensureCurrentWeek();   // limpia el planificador si cambió la semana
  saveState();           // sube el resultado fusionado (recupera lo que faltó subir)
}

let _cloudTimer = null;
let _dirty = false;        // hay cambios locales sin confirmar en la nube
let _editSeq = 0;          // sube con cada cambio: un guardado solo "limpia" si no hubo otro después
function scheduleCloudSave() {
  clearTimeout(_cloudTimer);
  _dirty = true;
  _editSeq++;
  setSaveStatus("saving");
  _cloudTimer = setTimeout(() => { if (CURRENT_USER) subirANube(); }, 800);
}
async function subirANube() {
  const uidAct = CURRENT_USER.id, seq = _editSeq;
  const res = await BACKEND.saveState(uidAct, STATE);
  if (res && res.error) { setSaveStatus("offline"); return; }
  // Guardar localmente lo confirmado (puede venir fusionado con otro dispositivo)
  try { localStorage.setItem("rumbo_state_" + uidAct, JSON.stringify(STATE)); } catch (e) {}
  if (seq === _editSeq) {
    _dirty = false;
    try { localStorage.removeItem("rumbo_pending_" + uidAct); } catch (e) {}
    setSaveStatus("saved");
  }
}

/* Fuerza el guardado pendiente de inmediato (sin esperar el debounce). Se usa al
   salir/ocultar la app para que un cierre recién hecho alcance a subir a la nube. */
async function flushCloudSave() {
  if (!CURRENT_USER || !_dirty) return;
  clearTimeout(_cloudTimer);
  try { await subirANube(); } catch (e) { setSaveStatus("offline"); }
}

/* Trae el estado más reciente de la nube al volver a un dispositivo que estuvo
   abierto (evita pisar con datos viejos lo que editaste en otro equipo).
   Solo actúa si no hay cambios locales pendientes ni un modal abierto. */
let _syncing = false;
async function syncFromCloud() {
  if (!CURRENT_USER || _dirty || _syncing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const modal = document.getElementById("modalOverlay");
  if (modal && !modal.hidden) return;           // no interrumpir una edición en curso
  _syncing = true;
  try {
    const data = await BACKEND.loadState(CURRENT_USER.id);   // también actualiza la versión conocida
    if (data && !_dirty) {
      STATE = migrate(data);
      ensureCurrentWeek();
      try { localStorage.setItem("rumbo_state_" + CURRENT_USER.id, JSON.stringify(STATE)); } catch (e) {}
      updateTopbar();
      rerender();
    }
  } catch (e) { /* silencioso */ }
  finally { _syncing = false; }
}
/* Indicador de guardado en la topbar: guardando / guardado / sin conexión */
function setSaveStatus(s) {
  const el = document.getElementById("saveStatus"); if (!el) return;
  el.hidden = false; el.className = "save-status is-" + s;
  if (s === "saving") { el.innerHTML = `<span class="ss-dot"></span><span class="ss-txt">Guardando…</span>`; el.title = ""; }
  else if (s === "offline") { el.innerHTML = `<span class="ss-ico">⚠</span><span class="ss-txt">Sin conexión</span>`; el.title = "Tus cambios están guardados en este dispositivo y se subirán cuando vuelva la conexión."; }
  else { el.innerHTML = `<span class="ss-ico">✓</span><span class="ss-txt">Guardado</span>`; el.title = "Sincronizado con tu cuenta."; }
}

function renderAccountBox() {
  const box = document.getElementById("accountBox");
  if (!box || !CURRENT_USER) return;
  const initial = (CURRENT_USER.name || CURRENT_USER.email || "?").trim()[0].toUpperCase();
  box.innerHTML = `<div class="account__avatar">${initial}</div>
    <div style="min-width:0;flex:1"><div class="account__name">${escapeHtml(CURRENT_USER.name || "")}</div>
    <div class="account__email">${escapeHtml(CURRENT_USER.email)}</div></div>`;
}

/* -------- Handlers del portal -------- */
function switchAuthTab(tab) {
  document.getElementById("tab-login").classList.toggle("is-active", tab === "login");
  document.getElementById("tab-register").classList.toggle("is-active", tab === "register");
  document.getElementById("form-login").hidden = tab !== "login";
  document.getElementById("form-register").hidden = tab !== "register";
  authError("");
}
function authError(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg || ""; el.hidden = !msg; el.classList.remove("auth__error--ok");
}
function authInfo(msg) {
  const el = document.getElementById("auth-error");
  el.textContent = msg || ""; el.hidden = !msg; el.classList.add("auth__error--ok");
}
async function doRegister() {
  const res = await BACKEND.register({ name: val("reg-name"), email: val("reg-email"), password: document.getElementById("reg-pass").value });
  if (res.error) return authError(res.error);
  if (res.info) { switchAuthTab("login"); return authInfo(res.info); }
  await enterApp(res); toast("¡Bienvenido, " + res.name + "! 🎉");
}
async function doLogin() {
  const res = await BACKEND.login({ email: val("log-email"), password: document.getElementById("log-pass").value });
  if (res.error) return authError(res.error);
  await enterApp(res); toast("¡Hola de nuevo!");
}
async function doForgot() {
  const email = val("log-email");
  if (!email) return authError("Escribe tu correo arriba y vuelve a tocar el enlace.");
  await BACKEND.resetPassword(email);
  authError(""); toast("Si existe la cuenta te llegará un correo (se activa con Supabase).");
}
async function doLogout() {
  await BACKEND.logout();
  CURRENT_USER = null; STATE = null; location.hash = "";
  authError(""); showAuth();
}

/* -------- Navegación -------- */
function buildNav() {
  const nav = document.getElementById("nav");
  nav.innerHTML = ROUTES.map(r => {
    if (r.grupo === "Ajustes") return `<button class="nav__item nav__item--sub" data-action="menu-personalizar"><span class="nav__ico">⚙️</span><span>Personalizar menú</span></button>
      <div class="nav__label">${r.grupo}</div>`;
    if (r.grupo) return `<div class="nav__label">${r.grupo}</div>`;
    if (moduloOculto(r.id)) return "";
    return `<button class="nav__item" data-route="${r.id}">
      <span class="nav__ico">${r.icon}</span><span>${r.label}</span></button>`;
  }).join("");
  document.getElementById("brandName").innerHTML = `${STATE.settings.appName.replace("i","<em>i</em>")}`;
  buildBottomNav();
}

/* Barra inferior en móvil: accesos directos + Menú (abre el lateral) */
const BOTTOM_NAV = ["inicio", "semana", "habitos", "metas"];
function buildBottomNav() {
  const bar = document.getElementById("bottombar");
  if (!bar) return;
  const items = BOTTOM_NAV.map(id => {
    const r = ROUTE_MAP[id]; if (!r) return "";
    return `<button class="bottombar__item" data-route="${id}">
      <span class="bico">${r.icon}</span>${r.label.split(" ")[0]}</button>`;
  }).join("");
  bar.innerHTML = items + `<button class="bottombar__item" data-action="open-menu">
    <span class="bico">☰</span>Más</button>`;
}

function onRoute() {
  if (!CURRENT_USER) return;
  const hash = location.hash.replace("#", "") || "inicio";
  CURRENT = ROUTE_MAP[hash] ? hash : "inicio";
  document.querySelectorAll(".nav__item, .bottombar__item").forEach(el =>
    el.classList.toggle("is-active", el.dataset.route === CURRENT));
  updateTopbar();
  rerender();
  setSidebar(false);
  document.querySelector(".main").scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function go(id) { location.hash = id; }

/* -------- Personalizar menú: ocultar módulos de "Más" (los datos no se tocan) -------- */
function openPersonalizarMenu() {
  setSidebar(false);
  const ocultos = new Set(((STATE.settings.menu || {}).ocultos) || []);
  openModal("Personalizar menú", `
    <p class="text-sm muted" style="margin-bottom:12px">Elige qué módulos ver en el menú. Ocultar uno no borra nada: vuelve a mostrarlo cuando quieras y todo seguirá ahí.</p>
    ${ROUTES.filter(r => r.mas).map(r => `<label class="mes-hab" style="cursor:pointer"><span class="mes-hab__n">${r.icon} ${r.label}</span>
      <input type="checkbox" class="menu-mod" value="${r.id}" ${ocultos.has(r.id) ? "" : "checked"}></label>`).join("")}
    <p class="text-xs muted mt-8">Inicio, Ritual, Semana, Hábitos, Objetivos y Diario siempre se ven.</p>
    <button class="btn btn--primary btn-block mt-16" data-action="menu-guardar">Guardar</button>`);
}
function guardarPersonalizarMenu() {
  const ocultos = Array.from(document.querySelectorAll(".menu-mod")).filter(c => !c.checked).map(c => c.value);
  STATE.settings.menu = { ocultos, ts: Date.now() };
  saveState(); closeModal(); buildNav();
  if (moduloOculto(CURRENT)) go("inicio"); else onRoute();
  toast(ocultos.length ? `Menú actualizado · ${ocultos.length} módulo${ocultos.length === 1 ? "" : "s"} oculto${ocultos.length === 1 ? "" : "s"}` : "Menú actualizado");
}

/* Menú lateral en móvil: abrir/cerrar con fondo oscuro */
function setSidebar(open) {
  const sb = document.getElementById("sidebar");
  const bd = document.getElementById("sidebarBackdrop");
  if (sb) sb.classList.toggle("is-open", open);
  if (bd) bd.classList.toggle("is-visible", open);
  document.body.classList.toggle("nav-open", open);
}

/* ============================================================
   GESTOS TÁCTILES (móvil)
   1) Deslizar para cerrar el menú
   2) Deslizar entre secciones
   4) Deslizar el modal hacia abajo para cerrarlo
   ============================================================ */
function isMobileView() { return window.matchMedia("(max-width: 760px)").matches; }
function isFormEl(el) { return !!(el && el.closest && el.closest("input, textarea, select, [contenteditable], .swatch, .mood-btn")); }
function startsInScrollableX(el) {
  let n = el;
  while (n && n !== document.body) {
    if (n.scrollWidth - n.clientWidth > 6) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    n = n.parentElement;
  }
  return false;
}
function navigateSection(dir) {
  const orden = seccionesVisibles();
  const i = orden.indexOf(CURRENT);
  if (i === -1) return;
  const j = i + dir;
  if (j < 0 || j >= orden.length) return; // sin dar la vuelta en los extremos
  go(orden[j]);
}
function attachSwipe(el, onSwipe) {
  if (!el) return;
  let x = 0, y = 0, ok = false;
  el.addEventListener("touchstart", e => { if (e.touches.length !== 1) { ok = false; return; } x = e.touches[0].clientX; y = e.touches[0].clientY; ok = true; }, { passive: true });
  el.addEventListener("touchend", e => { if (!ok) return; ok = false; const t = e.changedTouches[0]; onSwipe(t.clientX - x, t.clientY - y); }, { passive: true });
}
function initGestures() {
  // (1) Cerrar el menú deslizando hacia la izquierda
  attachSwipe(document.getElementById("sidebar"), (dx, dy) => { if (dx < -45 && Math.abs(dx) > Math.abs(dy)) setSidebar(false); });
  attachSwipe(document.getElementById("sidebarBackdrop"), (dx) => { if (dx < -30) setSidebar(false); });

  // (2) Deslizar entre secciones (sobre el contenido)
  const view = document.getElementById("view");
  let sx = 0, sy = 0, st = 0, valid = false;
  view.addEventListener("touchstart", e => {
    valid = false;
    if (e.touches.length !== 1 || !isMobileView()) return;
    if (!document.getElementById("modalOverlay").hidden) return;
    if (document.getElementById("sidebar").classList.contains("is-open")) return;
    if (startsInScrollableX(e.target) || isFormEl(e.target)) return;
    if (e.target.closest && e.target.closest("[data-swipe]")) return;   // deslizar una tarea no cambia de sección
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); valid = true;
  }, { passive: true });
  view.addEventListener("touchend", e => {
    if (!valid) return; valid = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 600) navigateSection(dx < 0 ? 1 : -1);
  }, { passive: true });

  // (3) Deslizar una tarea: → hecha, ← posponer
  initSwipeTareas(view);

  // (4) Deslizar el modal hacia abajo para cerrarlo
  const overlay = document.getElementById("modalOverlay");
  const modal = document.getElementById("modal");
  let my = 0, moved = 0, dragging = false;
  modal.addEventListener("touchstart", e => {
    dragging = false;
    if (e.touches.length !== 1 || modal.scrollTop > 0) return;
    if (isFormEl(e.target)) return;
    my = e.touches[0].clientY; moved = 0; dragging = true;
    modal.style.transition = "none";
  }, { passive: true });
  modal.addEventListener("touchmove", e => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - my;
    if (dy <= 0) { moved = 0; modal.style.transform = ""; return; } // subiendo: scroll normal
    if (modal.scrollTop > 0) { dragging = false; modal.style.transform = ""; return; }
    moved = dy;
    e.preventDefault(); // arrastrando hacia abajo desde el tope: descartar
    modal.style.transform = `translateY(${(dy * 0.7).toFixed(0)}px)`;
    overlay.style.background = `rgba(4,14,26,${Math.max(0.25, 0.7 - dy / 700).toFixed(2)})`;
  }, { passive: false });
  const endModal = () => {
    if (!dragging) return; dragging = false;
    modal.style.transition = "transform .2s ease";
    overlay.style.background = "";
    modal.style.transform = "";
    if (moved > 110) closeModal();
  };
  modal.addEventListener("touchend", endModal, { passive: true });
  modal.addEventListener("touchcancel", endModal, { passive: true });

  // (5) Introducción: deslizar o flechas del teclado para avanzar / retroceder
  attachSwipe(modal, (dx, dy) => {
    if (!ONB_ACTIVE || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    onbMover(dx < 0 ? 1 : -1);
  });
  document.addEventListener("keydown", e => {
    if (!ONB_ACTIVE || document.getElementById("modalOverlay").hidden || isFormEl(e.target)) return;
    if (e.key === "ArrowRight") onbMover(1);
    else if (e.key === "ArrowLeft") onbMover(-1);
  });
}

function rerender() {
  if (typeof checkBadges === "function") checkBadges();
  const route = ROUTE_MAP[CURRENT];
  document.getElementById("view").innerHTML = route.render();
  mountAfterRender();
  updateFab();
}

/* Botón flotante (móvil): la acción del día, siempre a un toque.
   Se oculta en Inicio y Ritual (ahí la acción ya está visible) y al cerrar el día. */
function updateFab() {
  const fab = document.getElementById("dayFab");
  if (!fab) return;
  if (!STATE || CURRENT === "inicio" || CURRENT === "ritual") { fab.hidden = true; return; }
  const st = dayState();
  if (st === "por-abrir") {
    fab.hidden = false; fab.className = "day-fab day-fab--open";
    fab.dataset.action = "day-open"; fab.innerHTML = `<span class="day-fab__ico">🌅</span> Abre tu día`;
  } else if (st === "en-curso" || st === "por-cerrar") {
    fab.hidden = false; fab.className = "day-fab day-fab--close";
    fab.dataset.action = "day-close"; fab.innerHTML = `<span class="day-fab__ico">🌙</span> Cierra tu día`;
  } else {
    fab.hidden = true; // día cerrado
  }
}

function updateTopbar() {
  const route = ROUTE_MAP[CURRENT];
  document.getElementById("pageTitle").textContent = route.label;
  document.getElementById("pageSubtitle").textContent = route.subtitle || "";
  document.getElementById("todayPill").textContent = "📅 " + fechaLarga();
  document.getElementById("streakVal").textContent = computeClosedStreak();
  document.getElementById("ptsVal").textContent = STATE.gamif.puntos;
}

/* -------- Estado del día (ciclo apertura → cierre) -------- */
function dayState() {
  const r = STATE.ritual.dias[todayISO()];
  if (!r || !r.hecho) return "por-abrir";
  if (r.cerrado) return "cerrado";
  return new Date().getHours() >= 18 ? "por-cerrar" : "en-curso";
}
/* Si olvidaste cerrar ayer, permite cerrarlo SOLO durante la mañana (antes de las 12).
   Devuelve la fecha (ISO) del día anterior pendiente de cierre, o null. */
function pendingCierreDate() {
  if (new Date().getHours() >= 12) return null;           // solo en la mañana
  const y = new Date(); y.setDate(y.getDate() - 1);
  const iso = isoLocal(y);
  const r = STATE.ritual.dias[iso];
  return (r && r.hecho && !r.cerrado) ? iso : null;
}
function renderPendingYesterday() {
  const iso = pendingCierreDate();
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  const fecha = d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return `<div class="card" style="margin-bottom:16px;border:1px solid var(--coral);background:var(--coral-soft)">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="card__title">🌙 Te quedó un día por cerrar</div>
        <div class="text-sm soft mt-8">Olvidaste cerrar el <b>${escapeHtml(fecha)}</b>. Ciérralo antes de arrancar hoy.</div></div>
      <div class="row-wrap" style="gap:8px"><button class="btn btn--soft" data-action="day-close-express" data-date="${iso}">⚡ Express</button>
        <button class="btn btn--primary" data-action="day-close" data-date="${iso}">Cerrar ${escapeHtml(d.toLocaleDateString("es-CL", { weekday: "long" }))}</button></div>
    </div></div>`;
}
function computeClosedStreak() {
  const now = new Date(); let s = 0;
  for (let b = 0; b < 366; b++) {
    const d = new Date(now); d.setDate(now.getDate() - b);
    const iso = isoLocal(d);
    const r = STATE.ritual.dias[iso];
    if (r && r.cerrado) s++;
    else if (b === 0) continue;
    else break;
  }
  return s;
}
function dayAutoSummary() {
  const mIdx = new Date().getMonth(), day = new Date().getDate();
  // Hábitos de hoy: los que tocan + los que marcaste hoy aunque no tocaran
  const hoyHabs = STATE.habitos.defs.filter(h => !h.pausado && (tocaHoy(h) || habitDone(h.id, mIdx, day) || (hmProgramado(h, todayISO()) && hmCreado(h) <= todayISO())));
  const habTotal = hoyHabs.length;
  const habDone = hoyHabs.filter(h => habitDone(h.id, mIdx, day)).length;
  const rd = resumenDia(STATE, todayISO());
  return { habDone, habTotal, tareasDone: rd.hechas, tareasTotal: rd.planificadas };
}

/* -------- Puntos (gamificación) -------- */
/* Todo cambio de monedas/XP pasa por el ledger (ver state.js). El id es determinista
   por evento: el mismo evento nunca paga dos veces, ni entre dispositivos. */
function registrarMovimiento(id, delta, xp, motivo, silencioso) {
  const ok = ledgerRegistrar(STATE, id, delta, xp == null ? Math.max(0, delta) : xp, motivo);
  if (!ok) return false;
  saveState(); refreshPts();
  if (delta > 0 && !silencioso) toast("+" + delta + " ⭐");
  return true;
}
function anularMovimiento(id) {
  if (ledgerAnular(STATE, id)) { saveState(); refreshPts(); }
}
function refreshPts() {
  const el = document.getElementById("ptsVal");
  if (el) el.textContent = STATE.gamif.puntos;
}
function computeRitualStreak() {
  const now = new Date(); let streak = 0;
  for (let back = 0; back < 366; back++) {
    const d = new Date(now); d.setDate(now.getDate() - back);
    const iso = isoLocal(d);
    if (STATE.ritual.dias[iso] && STATE.ritual.dias[iso].hecho) streak++;
    else if (back === 0) continue;
    else break;
  }
  return streak;
}

/* -------- Motor de binding (inputs -> estado) -------- */
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, val) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = val;
}

function onBind(e) {
  const mn = e.target.closest("[data-month-nav]");
  if (mn) { setMonthNav(mn.dataset.monthNav, +mn.value); return; }
  const el = e.target.closest("[data-bind]");
  if (!el) return;
  const path = el.dataset.bind;
  let val = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.type === "num") val = parseNum(val);
  prepararRutaAnio(path);   // año distinto al base: se crea al escribir y se marca su hora
  setPath(STATE, path, val);
  saveState();
  if (el.dataset.render !== "no") { updateTopbar(); rerender(); }
}
// para sliders con actualización en vivo (data-live)
function onBindLive(e) {
  const el = e.target.closest("[data-bind][data-live]");
  if (!el) return;
  prepararRutaAnio(el.dataset.bind);
  setPath(STATE, el.dataset.bind, el.dataset.type === "num" ? parseNum(el.value) : el.value);
  saveState();
  if (typeof LIVE_HOOK === "function") LIVE_HOOK(el);
}
let LIVE_HOOK = null;

/* -------- Motor de acciones (botones) -------- */
function onClick(e) {
  // Navegación del menú
  const navBtn = e.target.closest("[data-route]");
  if (navBtn) { go(navBtn.dataset.route); return; }

  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  const d = el.dataset;

  switch (a) {
    case "close-modal": closeModal(); break;
    case "export": exportData(); break;
    case "open-menu": setSidebar(true); break;

    /* Notificaciones */
    case "notif-enable": enableNotifications(); break;
    case "notif-disable": disableNotifications(); break;
    case "notif-times": saveNotifTimes(); break;
    case "notif-test": testNotification(); break;

    /* Portal de usuarios */
    case "auth-tab": switchAuthTab(d.tab); break;
    case "auth-login": doLogin(); break;
    case "auth-register": doRegister(); break;
    case "auth-forgot": doForgot(); break;
    case "logout": if (confirm("¿Cerrar sesión?")) doLogout(); break;

    /* Cuenta */
    case "acc-change-pass": doChangePass(); break;
    case "acc-import": { const el = document.getElementById("acc-file"); if (el) el.click(); break; }
    case "acc-delete": doDeleteAccount(); break;

    /* Metas */
    case "meta-add": {
      const input = document.getElementById(d.input);
      const txt = input.value.trim(); if (!txt) return;
      const metas = datosAnio(STATE, +d.anio || anioActual(), true).metas;
      const bucket = d.bucket === "tri" ? metas.trimestres : metas.mensuales;
      bucket[+d.idx].push({ id: uid(), texto: txt, done: false, ts: Date.now() });
      saveState(); rerender(); break;
    }
    case "meta-toggle": {
      const metas = datosAnio(STATE, +d.anio || anioActual(), true).metas;
      const bucket = d.bucket === "tri" ? metas.trimestres : metas.mensuales;
      const it = bucket[+d.idx].find(x => x.id === d.id); it.done = !it.done; it.ts = Date.now();
      saveState(); rerender(); break;
    }
    case "meta-del": {
      const metas = datosAnio(STATE, +d.anio || anioActual(), true).metas;
      const bucket = d.bucket === "tri" ? metas.trimestres : metas.mensuales;
      bucket[+d.idx] = bucket[+d.idx].filter(x => x.id !== d.id);
      saveState(); rerender(); break;
    }

    /* Finanzas gastos */
    case "gasto-add": openGastoModal(); break;
    case "gasto-del": STATE.finanzas.gastos = STATE.finanzas.gastos.filter(g => g.id !== d.id); saveState(); rerender(); break;
    case "gasto-save": saveGasto(); break;

    /* Hábitos */
    case "habit-add": openHabitModal(); break;
    case "habit-edit": openHabitModal(d.id); break;
    case "habit-del":
      if (confirm("¿Eliminar este hábito y su historial?")) {
        STATE.habitos.defs = STATE.habitos.defs.filter(h => h.id !== d.id);
        saveState(); closeModal(); rerender();
      } break;
    case "habit-save": saveHabit(); break;
    case "habit-cell": toggleHabitCell(d.id, +d.day); break;
    case "habit-month": HABIT_MONTH = +d.m; rerender(); break;
    case "habit-view": HABIT_VIEW = d.v; rerender(); break;
    case "habit-layout": HABIT_LAYOUT = d.v; rerender(); break;
    case "habit-today": toggleHabitToday(d.id); break;
    case "habit-daycell": toggleHabitDate(d.id, +d.y, +d.m, +d.d); break;

    /* Inicio: quick habit toggle hoy */
    case "quick-habit": toggleHabitToday(d.id); break;

    /* Lecturas · biblioteca */
    case "lect-filter": LECT_FILTER = d.f; rerender(); break;
    case "libro-add": openLibroModal(); break;
    case "libro-edit": openLibroModal(d.id); break;
    case "libro-save": saveLibro(); break;
    case "libro-del":
      if (confirm("¿Eliminar este libro de tu biblioteca?")) {
        STATE.lecturas = STATE.lecturas.filter(x => x.id !== d.id);
        saveState(); closeModal(); rerender();
      } break;
    case "libro-color":
      document.getElementById("lb-color").value = d.c;
      document.querySelectorAll(".swatches .swatch").forEach(b => b.classList.toggle("is-on", b.dataset.c === d.c));
      break;

    /* Salud receta toggle */
    case "receta-toggle": {
      { const y = anioVista(), mes = datosAnio(STATE, y, true).salud.meses[+d.idx]; mes.recetaHecha = !mes.recetaHecha; tocarAnio(STATE, y, "salud"); }
      saveState(); rerender(); break;
    }
    case "salud-month": SALUD_MONTH = +d.m; rerender(); break;

    /* Rueda mes */
    case "rueda-month": RUEDA_MONTH = +d.m; rerender(); break;

    /* Aprendizajes */
    case "apr-add": openAprModal(d.tipo); break;
    case "apr-del": STATE.aprendizajes = STATE.aprendizajes.filter(x => x.id !== d.id); saveState(); rerender(); break;
    case "apr-save": saveApr(); break;
    case "apr-toggle": { const a = STATE.aprendizajes.find(x => x.id === d.id); if (a) { a.done = !a.done; a.done ? registrarMovimiento("aprendizaje:" + a.id, 10, 10, "Aprendizaje") : anularMovimiento("aprendizaje:" + a.id); } saveState(); rerender(); break; }

    /* Notas */
    case "nota-add-cat": openNotaCatModal(); break;
    case "nota-cat-save": saveNotaCat(); break;
    case "nota-add": openNotaModal(d.cat); break;
    case "nota-save": saveNota(); break;
    case "nota-del": {
      const c = STATE.notas.find(c => c.id === d.cat); c.items = c.items.filter(n => n.id !== d.id); saveState(); rerender(); break;
    }
    case "cat-del": if (confirm("¿Eliminar la categoría y sus notas?")) { STATE.notas = STATE.notas.filter(c => c.id !== d.cat); saveState(); rerender(); } break;

    /* Calendario */
    case "cal-prev": CAL_MONTH = (CAL_MONTH + 11) % 12; rerender(); break;
    case "cal-next": CAL_MONTH = (CAL_MONTH + 1) % 12; rerender(); break;
    case "cal-goto": CAL_MONTH = +d.m; rerender(); break;
    case "cal-add": openEventoModal(d.date); break;
    case "evento-save": saveEvento(); break;
    case "evento-del": {
      const arr = STATE.eventos[d.date] || []; arr.splice(+d.i, 1);
      if (!arr.length) delete STATE.eventos[d.date]; saveState(); rerender(); break;
    }

    /* Ciclo del día */
    case "day-open": openRitualModal(); break;
    case "day-close": openCierreModal(d.date); break;
    case "day-open-express": openExpressApertura(); break;
    case "day-close-express": openExpressCierre(d.date); break;
    case "express-apertura-save": saveExpressApertura(); break;
    case "express-cierre-save": saveExpressCierre(); break;
    case "cierre-save": saveCierre(); break;

    /* Ritual matutino */
    case "ritual-start": openRitualModal(); break;
    case "ritual-save": saveRitual(); break;
    case "pilares-info": openPilaresInfo(); break;

    /* Ritual de mes */
    case "ritual-view": RITUAL_VIEW = d.v; rerender(); break;
    case "mes-open": openMesApertura(d.key); break;
    case "mes-close": openMesCierre(d.key); break;
    case "mes-next": mesWizMover(1); break;
    case "mes-prev": mesWizMover(-1); break;
    case "mes-finish": mesWizFinish(); break;
    case "mes-hab-add": mesHabAdd(); break;
    case "sem-ritual": openSemanaRitual(d.cierre, d.apertura); break;
    case "sem-open": openSemApertura(d.lunes); break;
    case "sem-close": openSemCierre(d.lunes); break;
    case "semw-next": semWizMover(1); break;
    case "semw-prev": semWizMover(-1); break;
    case "semw-finish": semWizFinish(); break;
    case "semw-add": semWizAdd(d.fecha, +d.i); break;
    case "semw-del": semWizDel(d.fecha, +d.i); break;
    case "sem-dia": guardarDiaRitualSemanal(+d.v); break;
    case "menu-personalizar": openPersonalizarMenu(); break;
    case "rec-open": openRecurrentes(); break;
    case "rec-save": guardarRecurrente(); break;
    case "rec-del": eliminarRecurrente(d.id); break;
    case "sem-ir": SEM_LUNES = d.lunes === agLunes(todayISO()) ? null : d.lunes; if (CURRENT !== "semana") go("semana"); else rerender(); window.scrollTo(0, 0); break;
    case "menu-guardar": guardarPersonalizarMenu(); break;
    case "anio-nav": if (+d.dir === 0) { ANIO_VISTA = null; rerender(); } else cambiarAnioVista(+d.dir); break;

    /* Bitácora */
    case "bita-toggle": BITA_OPEN[d.iso] = !BITA_OPEN[d.iso]; rerender(); break;

    /* Tareas (registro diario por fecha) */
    case "tarea-add": {
      const input = document.getElementById(d.input);
      const txt = input.value.trim(); if (!txt) return;
      const ambEl = d.amb && document.getElementById(d.amb);
      nuevaTarea(STATE, d.fecha, { txt, ambito: ambEl && ambEl.value === "pro" ? "pro" : "per" });
      saveState(); rerender(); break;
    }
    case "tarea-toggle": {
      const t = buscarTarea(STATE, d.fecha, d.id); if (!t) break;
      const hecha = estadoTarea(t) !== "hecha";
      marcarTarea(t, hecha ? "hecha" : "pendiente");
      hecha ? registrarMovimiento("tarea:" + t.id, 15, 15, "Tarea") : anularMovimiento("tarea:" + t.id);
      saveState(); rerender(); break;
    }
    case "tarea-editar": openEditarTarea(d.fecha, d.id); break;
    case "tarea-editar-save": guardarEditarTarea(); break;
    case "tarea-ambito": {
      const t = buscarTarea(STATE, d.fecha, d.id);
      if (t) { t.ambito = ambitoDe(t) === "pro" ? "per" : "pro"; t.ts = Date.now(); saveState(); rerender(); }
      break;
    }
    case "tarea-del": {
      const t = buscarTarea(STATE, d.fecha, d.id);
      if (t) { borrarTarea(t); saveState(); rerender(); }
      break;
    }
    case "tarea-deshacer": {
      const t = buscarTarea(STATE, d.fecha, d.id);
      if (t && deshacerMovimiento(STATE, t, d.fecha)) { saveState(); rerender(); toast("Movimiento deshecho"); }
      else toast("No se puede deshacer: la tarea ya cambió en su nuevo día", true);
      break;
    }
    case "tarea-posponer": openPosponerTarea(d.fecha, d.id); break;
    case "posponer-save": guardarPosponer(); break;
    case "bandeja-open": openBandeja(); break;
    case "bandeja-save": guardarBandeja(); break;
    case "sem-nav": SEM_LUNES = +d.dir === 0 ? null : agSumar(SEM_LUNES || agLunes(todayISO()), 7 * +d.dir); rerender(); break;

    /* Entrenamiento */
    case "entren-add-dia": openDiaModal(); break;
    case "entren-dia-save": saveDia(); break;
    case "entren-del-dia": if (confirm("¿Eliminar este día?")) { STATE.entrenamiento.dias = STATE.entrenamiento.dias.filter(x => x.id !== d.id); saveState(); rerender(); } break;
    case "entren-add-bloque": openBloqueModal(d.dia); break;
    case "entren-bloque-save": saveBloque(); break;
    case "entren-bloque-toggle": toggleBloque(d.dia, d.id); break;
    case "entren-del-bloque": {
      const dia = STATE.entrenamiento.dias.find(x => x.id === d.dia);
      dia.bloques = dia.bloques.filter(b => b.id !== d.id); saveState(); rerender(); break;
    }

    /* Tienda · temas */
    case "tema-preview": openThemePreview(d.theme); break;
    case "set-theme": {
      if (!themeOwned(d.theme)) break;
      STATE.settings.theme = d.theme; saveState(); applyTheme(d.theme); closeModal(); rerender();
      toast("Tema aplicado: " + (THEMES.find(t => t.id === d.theme) || {}).nombre);
      break;
    }
    case "tema-buy": {
      const th = THEMES.find(t => t.id === d.theme) || {};
      if (themeOwned(d.theme)) break;
      recalcGamif(STATE);
      if (STATE.gamif.puntos < th.costo) { toast("Te faltan " + (th.costo - STATE.gamif.puntos) + " ⭐", true); break; }
      if (!confirm(`¿Desbloquear el tema "${th.nombre}" por ${th.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - th.costo} ⭐.`)) break;
      const res = ledgerComprar(STATE, "tema-" + d.theme, th.costo);
      if (!res.ok && !res.yaTenia) { toast("Te faltan " + (res.falta || th.costo) + " ⭐", true); break; }
      STATE.settings.theme = d.theme; saveState(); applyTheme(d.theme); updateTopbar(); closeModal(); rerender();
      toast("🛍️ Tema " + th.nombre + " desbloqueado y aplicado");
      break;
    }

    /* Recompensas / cosméticos */
    case "cos-buy": buyItem(d.id); break;
    case "cos-equip": equipItem(d.id); break;
    case "badge-destacar":
      STATE.gamif.equipped.insignia = (STATE.gamif.equipped.insignia === d.id ? null : d.id);
      saveState(); rerender(); break;

    /* Vida · Diario */
    case "diario-save": {
      const texto = val("di-texto"), grat = val("di-grat");
      const mood = parseNum(document.getElementById("di-mood").value) || 3;
      if (!texto && !grat) return toast("Escribe algo primero", true);
      const entrada = { id: uid(), fecha: todayISO(), mood, texto, gratitud: grat, ts: Date.now() };
      STATE.vida.diario.push(entrada);
      saveState(); registrarMovimiento("diario:" + entrada.id, 10, 10, "Diario"); rerender(); break;
    }
    case "diario-del": STATE.vida.diario = STATE.vida.diario.filter(e => e.id !== d.id); saveState(); rerender(); break;

    /* Vida · Ideas */
    case "idea-add": {
      const input = document.getElementById(d.input); const t = input.value.trim(); if (!t) return;
      STATE.vida.ideas.push({ id: uid(), texto: t, hecha: false }); saveState(); rerender(); break;
    }
    case "idea-toggle": { const i = STATE.vida.ideas.find(x => x.id === d.id); i.hecha = !i.hecha; saveState(); rerender(); break; }
    case "idea-del": STATE.vida.ideas = STATE.vida.ideas.filter(i => i.id !== d.id); saveState(); rerender(); break;

    /* Vida · Relaciones */
    case "rel-add": openRelModal(); break;
    case "rel-edit": openRelModal(d.id); break;
    case "rel-save": saveRel(); break;
    case "rel-contacto": { const p = STATE.vida.relaciones.find(x => x.id === d.id); p.ultimoContacto = todayISO(); saveState(); rerender(); toast("💬 Registrado"); break; }
    case "rel-del": STATE.vida.relaciones = STATE.vida.relaciones.filter(p => p.id !== d.id); saveState(); rerender(); break;

    /* Vida · Listas */
    case "lista-add": openListaModal(); break;
    case "lista-save": saveLista(); break;
    case "lista-del": if (confirm("¿Eliminar esta lista?")) { STATE.vida.listas = STATE.vida.listas.filter(l => l.id !== d.id); saveState(); rerender(); } break;
    case "lista-item-add": {
      const input = document.getElementById(d.input); const t = input.value.trim(); if (!t) return;
      const l = STATE.vida.listas.find(x => x.id === d.lista); l.items.push({ id: uid(), txt: t, done: false }); saveState(); rerender(); break;
    }
    case "lista-deseo-add": {
      const nom = document.getElementById("lid-" + d.lista); const cos = document.getElementById("lic-" + d.lista);
      const t = nom ? nom.value.trim() : ""; if (!t) return;
      const l = STATE.vida.listas.find(x => x.id === d.lista);
      l.items.push({ id: uid(), txt: t, costo: parseNum(cos ? cos.value : 0), done: false });
      saveState(); rerender(); break;
    }
    case "lista-item-toggle": { const l = STATE.vida.listas.find(x => x.id === d.lista); const it = l.items.find(i => i.id === d.id); it.done = !it.done; saveState(); rerender(); break; }
    case "lista-item-del": { const l = STATE.vida.listas.find(x => x.id === d.lista); l.items = l.items.filter(i => i.id !== d.id); saveState(); rerender(); break; }

    /* Perfil / onboarding */
    case "edit-profile": openProfileModal(); break;
    case "profile-save": saveProfile(); break;
    case "onboarding-save": saveOnboarding(); break;
    case "onb-next": onbMover(1); break;
    case "onb-prev": onbMover(-1); break;
    case "onb-skip": onbSaltar(); break;
    case "onb-done": onbTerminar(); break;
    case "show-tutorial": case "intro-replay": setSidebar(false); openOnboarding(STATE.settings.onboarded ? "repetir" : "nuevo"); break;
    case "reset-data":
      if (confirm("¿Borrar TODOS tus datos y empezar de cero? Esto no se puede deshacer.")) {
        const name = STATE.profile.name, birth = STATE.profile.birthDate, theme = STATE.settings.theme;
        STATE = defaultState();
        STATE.profile.name = name; STATE.profile.birthDate = birth;
        STATE.settings.onboarded = true; STATE.settings.theme = theme;
        applyTheme(theme); applyCosmetics(); saveState(); updateTopbar(); closeModal(); rerender();
        toast("Datos reiniciados · empieza de cero ✨");
      }
      break;
  }
}

const BASE_THEMES = ["navy", "claro"];
const DEFAULT_THEME = "navy";
/* Fuentes de los temas Bosque: se cargan solo cuando se aplica uno de ellos */
const FUNDOS_FONTS_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Mulish:wght@400;500;600;700&display=swap";
function applyTheme(t) {
  const id = THEMES.some(x => x.id === t) ? t : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", id);
  if (id.startsWith("bosque")) loadFundosFonts();
}
function loadFundosFonts() {
  if (document.getElementById("fundosFonts")) return;
  const l = document.createElement("link");
  l.id = "fundosFonts"; l.rel = "stylesheet"; l.href = FUNDOS_FONTS_URL;
  document.head.appendChild(l);
}
function themeOwned(id) {
  return BASE_THEMES.includes(id) || (STATE.gamif.owned || []).includes("tema-" + id);
}
/* Cuenta dueña: desbloquea todos los temas automáticamente al entrar.
   El correo va encriptado (hash), no en texto plano, para no exponerlo. */
function grantOwnerPerks() {
  try {
    if (!CURRENT_USER || !CURRENT_USER.email || typeof _hash !== "function") return;
    if (_hash(CURRENT_USER.email.trim().toLowerCase()) !== "h1805468134") return;
    // Van a gamif.perks (no al ledger): desbloquear no genera movimientos de cobro
    STATE.gamif.perks = THEMES.map(t => "tema-" + t.id);
    recalcGamif(STATE);
  } catch (e) {}
}

const FONT_SG = "'Space Grotesk',sans-serif";
const FONT_CORMORANT = "'Cormorant Garamond',Georgia,serif";
const FONT_MULISH = "'Mulish',sans-serif";
/* Orden = orden en la Tienda */
const THEMES = [
  /* --- 2 bases gratis --- */
  { id: "navy", nombre: "Navy sobrio", base: "Base", concepto: "Oscuro calmado: navy profundo y planos, sin neón. El tema predeterminado.", costo: 0,
    bg: "#0C1B2C", card: "#122539", accent: "#2BB6A5", cta: "#E8563A", onCta: "#FFFFFF", text: "#EAF0F6", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  { id: "claro", nombre: "Claro", base: "Base", concepto: "Fondo claro, mucho aire y un acento azul. Sereno y profesional.", costo: 0,
    bg: "#FBFBF9", card: "#FFFFFF", accent: "#3B6FB0", cta: "#E8563A", onCta: "#FFFFFF", text: "#111F31", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  /* --- Tienda --- */
  { id: "grafito", nombre: "Grafito", base: "Navy sobrio", concepto: "Modo oscuro neutro en grafito. Elegante y de bajo perfil.", costo: 400,
    bg: "#111418", card: "#1A1E24", accent: "#39B9AE", cta: "#E8563A", onCta: "#FFFFFF", text: "#E9ECEF", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  { id: "medianoche", nombre: "Medianoche", base: "Navy sobrio", concepto: "Oscuro con acento índigo. Sobrio pero con personalidad.", costo: 500,
    bg: "#131A2C", card: "#1C2540", accent: "#8B93E8", cta: "#E8563A", onCta: "#FFFFFF", text: "#E7EAF4", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  { id: "bosque-claro", nombre: "Bosque Claro", base: "Claro", concepto: "Marfil, verde bosque y detalles dorados. Títulos con serifa clásica.", costo: 550,
    bg: "#F7F5F0", card: "#FFFFFF", accent: "#C8A165", cta: "#16301F", onCta: "#F7F5F0", text: "#0A140E", font: FONT_MULISH, fontDisplay: FONT_CORMORANT, radius: "12px" },
  { id: "bosque-oscuro", nombre: "Bosque Oscuro", base: "Navy sobrio", concepto: "Verde profundo con acento dorado. Sobrio, cálido y con carácter.", costo: 650,
    bg: "#0A140E", card: "#0F1F16", accent: "#C8A165", cta: "#C8A165", onCta: "#0A140E", text: "#F7F5F0", font: FONT_MULISH, fontDisplay: FONT_CORMORANT, radius: "12px" },
];

function renderTienda() {
  const actual = STATE.settings.theme;
  const saldo = STATE.gamif.puntos;

  const themeCards = THEMES.map(t => {
    const active = t.id === actual;
    const owned = themeOwned(t.id);
    let badge;
    if (active) badge = '<span class="chip chip--cian">✓ Activo</span>';
    else if (owned) badge = '<span class="chip">Desbloqueado</span>';
    else badge = `<span class="chip chip--coral">🔒 ${t.costo} ⭐</span>`;
    const mainAction = owned
      ? `<button class="btn ${active ? "btn--soft" : "btn--cian"} btn-block mt-8" data-action="set-theme" data-theme="${t.id}">${active ? "✓ Aplicado" : "Aplicar"}</button>`
      : `<button class="btn btn--primary btn-block mt-8" data-action="tema-buy" data-theme="${t.id}">Desbloquear · ${t.costo} ⭐</button>`;
    return `<div class="card theme-card ${active ? "is-active" : ""}">
      <button class="theme-preview" data-action="tema-preview" data-theme="${t.id}" style="background:${t.bg};width:100%;border:none;cursor:pointer;${owned ? "" : "opacity:.9"}">
        <div class="theme-preview__card" style="background:${t.card};border-radius:${t.radius};color:${t.text};font-family:${t.fontDisplay || t.font}">Aa</div>
        <div class="theme-preview__btn" style="background:${t.cta};border-radius:${t.radius}"></div>
        <span class="theme-preview__dot" style="background:${t.accent}"></span>
        <span class="theme-preview__eye">👁 Vista previa</span>
      </button>
      <div class="flex-between mt-16"><div class="card__title">${t.nombre}</div>${badge}</div>
      <div class="text-xs muted mt-8">${t.concepto}</div>
      ${mainAction}
    </div>`;
  }).join("");

  return `
  <div class="card">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px">
      <div><div class="card__title">🛒 Tienda</div>
        <div class="text-sm muted mt-8">Gasta tus ⭐ en personalizar tu app. Todo mantiene la línea de marca BiPlot.</div></div>
      <div class="pill pill--pts" style="font-size:16px">⭐ ${saldo}</div>
    </div>
  </div>

  <div class="section-title">🎨 Temas <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· toca la miniatura para la vista previa</span></div>
  <div class="grid grid-3">${themeCards}</div>

  <div class="section-title">🏷️ Títulos <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· aparecen junto a tu nombre en Inicio</span></div>
  <div class="grid grid-4">${TITULOS.map(cosmeticCard).join("")}</div>

  <div class="section-title">✨ Detalles</div>
  <div class="grid grid-4">${DETALLES.map(cosmeticCard).join("")}</div>

  <p class="text-xs muted mt-24">Ganas ⭐ usando la app (cerrar el día, hábitos, rituales…).</p>`;
}

function openThemePreview(themeId) {
  const t = THEMES.find(x => x.id === themeId); if (!t) return;
  if (t.id.startsWith("bosque")) loadFundosFonts();
  const owned = themeOwned(t.id);
  const active = STATE.settings.theme === t.id;
  const mock = `
    <div style="background:${t.bg};border-radius:14px;padding:14px;font-family:${t.font};color:${t.text}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-weight:700;font-size:17px;font-family:${t.fontDisplay || t.font}">Rumbo</div>
        <div style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:11px">⭐ 320</div>
      </div>
      <div style="background:${t.card};border-radius:${t.radius};padding:14px;margin-bottom:10px">
        <div style="font-size:11px;opacity:.7">Ahorro del mes</div>
        <div style="font-size:24px;font-weight:700;font-family:${t.fontDisplay || t.font}">$540.000</div>
        <div style="height:8px;background:rgba(128,128,128,.25);border-radius:99px;margin-top:8px;overflow:hidden"><div style="width:66%;height:100%;background:${t.accent};border-radius:99px"></div></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="background:${t.accent};color:${t.bg};border-radius:${t.radius};padding:4px 10px;font-size:11px;font-weight:600">🎯 Misión</span>
        <span style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:11px">${BOCADO.emoji} ${BOCADO.corto}</span>
        <button style="margin-left:auto;background:${t.cta};color:${t.onCta || "#fff"};border:none;border-radius:${t.radius};padding:8px 16px;font-size:12px;font-weight:700;font-family:${t.font}">Abre tu día</button>
      </div>
    </div>`;
  const cta = active
    ? `<button class="btn btn--soft btn-block" data-action="close-modal">Ya es tu tema actual</button>`
    : owned
      ? `<button class="btn btn--cian btn-block" data-action="set-theme" data-theme="${t.id}">Aplicar este tema</button>`
      : `<button class="btn btn--primary btn-block" data-action="tema-buy" data-theme="${t.id}">Desbloquear · ${t.costo} ⭐</button>`;
  openModal("Vista previa · " + t.nombre, `
    <p class="text-sm muted" style="margin-bottom:14px">${escapeHtml(t.concepto)}</p>
    ${mock}
    <div class="mt-16">${cta}</div>`);
}

function toggleBloque(diaId, bloqueId) {
  const dia = STATE.entrenamiento.dias.find(x => x.id === diaId);
  const b = dia.bloques.find(b => b.id === bloqueId);
  b.done = !b.done;
  const allDone = dia.bloques.length && dia.bloques.every(x => x.done);
  // Premio de una sola vez: se otorga la primera vez que completas el día y nunca se
  // vuelve a dar (aunque desmarques y vuelvas a marcar). Evita farmear monedas.
  if (allDone && !dia.premiado) { dia.premiado = true; registrarMovimiento("entreno:" + dia.id, 30, 30, "Entrenamiento"); }
  saveState(); rerender();
}

/* -------- Navegador de mes (dropdown del monthNav) -------- */
function setMonthNav(name, m) {
  if (name === "salud") SALUD_MONTH = m;
  else if (name === "rueda") RUEDA_MONTH = m;
  else if (name === "habit") HABIT_MONTH = m;
  else if (name === "cal") CAL_MONTH = m;
  rerender();
}

/* -------- Hábitos: toggle celda -------- */
let HABIT_MONTH = new Date().getMonth();
function toggleHabitDate(habitId, year, monthIdx, day) {
  const key = monthKey(year, monthIdx);
  STATE.habitos.log[key] = STATE.habitos.log[key] || {};
  STATE.habitos.log[key][habitId] = STATE.habitos.log[key][habitId] || {};
  const cur = STATE.habitos.log[key][habitId][day];
  const movId = "habito:" + habitId + ":" + isoLocal(new Date(year, monthIdx, day));
  if (cur) { delete STATE.habitos.log[key][habitId][day]; anularMovimiento(movId); }
  else { STATE.habitos.log[key][habitId][day] = true; registrarMovimiento(movId, 5, 5); }
  actualizarMetaHabito(habitId, isoLocal(new Date(year, monthIdx, day)));
  saveState();
  updateTopbar();
  rerender();
}
// Grilla mensual: usa el mes seleccionado
function toggleHabitCell(habitId, day) { toggleHabitDate(habitId, anioVista(), HABIT_MONTH, day); }
// Toggle del día de hoy (vista Diario e Inicio)
function toggleHabitToday(habitId) { const n = new Date(); toggleHabitDate(habitId, n.getFullYear(), n.getMonth(), n.getDate()); }
function habitDone(habitId, monthIdx, day, year) {
  const key = monthKey(year || anioActual(), monthIdx);
  return !!(STATE.habitos.log[key] && STATE.habitos.log[key][habitId] && STATE.habitos.log[key][habitId][day]);
}
/* +20 ⭐ al cumplir la cuota del período (semana, o mes si es mensual).
   Anulable: si al desmarcar deja de cumplirse, el movimiento se anula. */
function actualizarMetaHabito(habitId, iso) {
  const h = STATE.habitos.defs.find(x => x.id === habitId);
  if (!h || h.pausado) return;
  const meta = hmMetaPeriodo(h, iso);
  const id = "habito-meta:" + habitId + ":" + meta.key;
  if (meta.cumplido) { if (registrarMovimiento(id, 20, 20, "Cuota de " + h.nombre, true)) toast("🎯 " + h.nombre + ": ¡cuota cumplida! +20 ⭐"); }
  else if (ledgerVigente(STATE, id)) anularMovimiento(id);
}
/* Racha global: días seguidos cumpliendo todos los hábitos que tocaban (ver motor) */
function computeStreak() { return rachaGlobalHabitos(STATE); }

/* ============================================================
   Ciclo del día: hero del Inicio + resumen de cierre
   ============================================================ */
/* segundo: botón secundario opcional { label, action, data } (p. ej. el modo express) */
function heroCoral(title, sub, btnLabel, action, data = {}, segundo = null) {
  const attrs = d => Object.entries(d || {}).map(([k, v]) => ` data-${k}="${escapeAttr(v)}"`).join("");
  const extra = attrs(data);
  return `<div class="card hero-focus" style="margin-bottom:20px">
    <div class="flex-between" style="flex-wrap:wrap;gap:16px">
      <div style="min-width:0">
        <div class="hero-focus__title">${title}</div>
        <div class="text-sm muted" style="margin-top:4px">${sub}</div></div>
      <div class="row-wrap" style="gap:8px">
        ${segundo ? `<button class="btn btn--soft" data-action="${segundo.action}"${attrs(segundo.data)}>${segundo.label}</button>` : ""}
        <button class="btn btn--primary" data-action="${action}"${extra}>${btnLabel}</button></div>
    </div></div>`;
}
function renderDayHero() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  const st = dayState();
  const name = escapeHtml(STATE.profile.name);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  if (st === "por-abrir")
    return heroCoral(`${saludo}, ${name}.`, "Antes de arrancar, define tu enfoque del día. Toma 30 segundos (o 3 toques en express).", "🌅 Abre tu día", "day-open", {}, { label: "⚡ Express", action: "day-open-express" });

  if (st === "por-cerrar")
    return heroCoral(`${saludo}, ${name}.`, "Tu día está por terminar. Cierra el ritual y reflexiona.", "🌙 Cierra tu día", "day-close", {}, { label: "⚡ Express", action: "day-close-express" });

  if (st === "cerrado") return renderCierreResumen(r);

  // en-curso
  const rd = resumenDia(STATE, iso);
  const chips = `<div class="row-wrap" style="gap:8px;margin-top:8px">
    ${r.mision ? `<span class="chip chip--cian">🎯 ${escapeHtml(r.mision)}</span>` : ""}
    ${r.sapo ? `<span class="chip chip--coral">${BOCADO.emoji} ${escapeHtml(r.sapo)}</span>` : ""}
    ${r.servir ? `<span class="chip">🙌 ${escapeHtml(r.servir)}</span>` : ""}
    ${r.pilar ? `<span class="chip">${escapeHtml(r.pilar)}</span>` : ""}
    ${rd.planificadas ? `<span class="chip">📋 ${rd.hechas}/${rd.planificadas} tareas</span>` : ""}</div>`;
  return `<div class="card" style="margin-bottom:24px;border-left:3px solid var(--cian)">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Tu enfoque de hoy</div>${chips}</div>
      <div class="row-wrap" style="gap:8px"><button class="btn-ghost" data-action="day-close-express">⚡ Express</button>
        <button class="btn btn--soft" data-action="day-close">🌙 Cerrar el día</button></div>
    </div></div>`;
}
function cumpliChip(v) {
  if (v === "si") return `<span class="chip chip--done">cumplida</span>`;
  if (v === "parcial") return `<span class="chip chip--coral">parcial</span>`;
  if (v === "no") return `<span class="chip">no</span>`;
  return "";
}
function renderCierreResumen(r) {
  const c = r.cierre || {};
  const s = dayAutoSummary();
  const rd = resumenDia(STATE, todayISO());
  const mov = rd.migradas + rd.programadas;
  // El bocado que no se dio muestra qué se decidió con él (> < @ ✕)
  const tb = tareasDelDia(todayISO()).find(t => t.esSapo);
  const eb = tb ? estadoTarea(tb) : null;
  const chipBocado = c.sapo ? '<span class="chip chip--done">hecho</span>'
    : eb && eb !== "pendiente" && eb !== "hecha" ? `<span class="chip chip--sig">${signoTarea(tb)}</span>` : '<span class="chip">pendiente</span>';
  return `<div class="card" style="margin-bottom:24px;background:linear-gradient(120deg,var(--cian-soft),var(--surface))">
    <div class="card__head"><div class="card__title">✅ Día cerrado</div>
      <span class="chip chip--streak" style="color:var(--coral)">🔥 ${computeClosedStreak()} días cerrados</span></div>
    <div class="grid grid-2">
      <div>
        <div class="text-xs muted">Misión</div><div class="mt-8">${r.mision ? escapeHtml(r.mision) : "—"} ${cumpliChip(c.mision)}</div>
        <div class="text-xs muted mt-16">${BOCADO.emoji} ${BOCADO.corto}</div><div class="mt-8">${r.sapo ? escapeHtml(r.sapo) : "—"} ${chipBocado}</div>
        <div class="text-xs muted mt-16">Energía inicio → cierre</div>
        <div class="mt-8">${r.energia || "—"} → ${c.energia || "—"} / 5</div>
      </div>
      <div>
        ${c.mejor ? `<div class="text-xs muted">Lo mejor / gratitud</div><div class="mt-8">${escapeHtml(c.mejor)}</div>` : ""}
        ${c.manana ? `<div class="text-xs muted mt-16">Una cosa para mañana</div><div class="mt-8 hl-cian">${escapeHtml(c.manana)}</div>` : ""}
        <div class="row-wrap mt-16" style="gap:8px">
          <span class="chip">📊 Hábitos ${s.habDone}/${s.habTotal}</span>
          ${c.tareas ? `<span class="chip">${AMBITOS.pro.icon} ${c.tareas.pro[0]}/${c.tareas.pro[1]}</span>
            <span class="chip">${AMBITOS.per.icon} ${c.tareas.per[0]}/${c.tareas.per[1]}</span>`
            : `<span class="chip">🗂️ Tareas ${s.tareasDone}/${s.tareasTotal}</span>`}
          ${mov ? `<span class="chip">↪ ${mov} a otro día</span>` : ""}
          ${rd.delegadas ? `<span class="chip">@ ${rd.delegadas} delegada${rd.delegadas === 1 ? "" : "s"}</span>` : ""}
          ${rd.soltadas ? `<span class="chip">✕ ${rd.soltadas} soltada${rd.soltadas === 1 ? "" : "s"}</span>` : ""}
        </div>
      </div>
    </div>
    ${c.nota ? `<div class="divider"></div><div class="text-sm soft">"${escapeHtml(c.nota)}"</div>` : ""}
    <div class="text-sm muted mt-16">Mañana volvemos a empezar 🌅</div>
  </div>`;
}
/* Chip de ámbito de una tarea (clic para alternar Pro/Personal) */
function ambitoChip(t, iso, compacto) {
  const a = ambitoDe(t);
  return `<button class="chip chip--amb" data-action="tarea-ambito" data-fecha="${iso}" data-id="${t.id}" title="${AMBITOS[a].label} · clic para cambiar">${AMBITOS[a].icon}${compacto ? "" : " " + AMBITOS[a].corto}</button>`;
}
/* Toggle Pro/Personal para inputs de nueva tarea (guarda el valor en un input oculto) */
function ambitoPicker(hiddenId, cur, compacto) {
  const a = cur === "pro" ? "pro" : "per";
  return `<input type="hidden" id="${hiddenId}" value="${a}"><button type="button" class="chip chip--amb amb-pick" title="Ámbito de la nueva tarea: ${AMBITOS[a].label}"
    ${compacto ? 'data-compacto="1"' : ""} onclick="ambFlip(this,'${hiddenId}')">${AMBITOS[a].icon}${compacto ? "" : " " + AMBITOS[a].corto}</button>`;
}
function ambFlip(btn, hiddenId) {
  const el = document.getElementById(hiddenId);
  el.value = el.value === "pro" ? "per" : "pro";
  btn.textContent = AMBITOS[el.value].icon + (btn.dataset.compacto ? "" : " " + AMBITOS[el.value].corto);
  btn.title = "Ámbito de la nueva tarea: " + AMBITOS[el.value].label;
}
function segPick(btn, hiddenId) {
  Array.from(btn.parentNode.children).forEach(b => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  document.getElementById(hiddenId).value = btn.dataset.v;
}

/* ============================================================
   INICIO (dashboard)
   ============================================================ */
function renderInicio() {
  const s = STATE;
  ensureCurrentWeek();
  generarRecurrentes(s);   // tareas recurrentes al día (por si cambió la fecha con la app abierta)
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const mIdx = new Date().getMonth();
  const day = new Date().getDate();

  // stats
  const anioHoy = datosAnio(s, anioActual());
  const mesFin = anioHoy.finanzas.meses[mIdx];
  const ahorroMes = (mesFin.ingreso || 0) - (mesFin.gasto || 0);
  const metaMes = s.finanzas.metaMensual || 1;
  const pctAhorro = Math.min(100, Math.round((ahorroMes / metaMes) * 100));

  const libro = s.lecturas.find(l => l.estado === "leyendo") || s.lecturas.find(l => l.titulo);
  const pesos = [pesoActualGlobal(s)].filter(p => p != null);
  const pesoActual = pesos.length ? pesos[pesos.length - 1] : null;

  const habBtn = h => {
    const on = habitDone(h.id, mIdx, day);
    const prog = progresoPeriodoActual(h);
    return `<button class="nav__item" style="background:${on ? 'var(--cian-soft)' : 'var(--surface-2)'};border:1px solid var(--line);justify-content:space-between"
      data-action="quick-habit" data-id="${h.id}">
      <span><span class="nav__ico">${h.icon}</span> ${escapeHtml(h.nombre)} <span class="text-xs muted">· ${prog.texto}</span></span>
      <span class="check ${on ? 'is-on' : ''}">${on ? '✓' : ''}</span></button>`;
  };
  const { toca: habToca, cumplidos: habCumplidos } = habitosHoy();
  const habitsToday = habToca.map(habBtn).join("")
    + (habCumplidos.length ? `<details class="hb-more"><summary>✅ Ya cumplidos este período (${habCumplidos.length})</summary>
      <div class="grid mt-8" style="gap:8px">${habCumplidos.map(habBtn).join("")}</div></details>` : "");
  const doneToday = habToca.filter(h => habitDone(h.id, mIdx, day)).length;

  const metasMes = (anioHoy.metas.mensuales[mIdx] || []).filter(m => !m.done);

  const hoyISO = todayISO();
  const tareasHoy = tareasDelDia(hoyISO);
  const bocado = tareasHoy.find(t => t.esSapo && !tareaMovida(t));
  const grupo = a => {
    const all = tareasHoy.filter(t => ambitoDe(t) === a);
    const ts = all.filter(t => t !== bocado);
    if (!ts.length) return "";
    // vivas primero; las resueltas sin hacer (> < @ ✕) al final del grupo
    ts.sort((x, y) => (tareaMovida(x) || estadoTarea(x) === "soltada" || estadoTarea(x) === "delegada") - (tareaMovida(y) || estadoTarea(y) === "soltada" || estadoTarea(y) === "delegada"));
    return `<div class="tarea-grupo"><span>${AMBITOS[a].icon} ${AMBITOS[a].label}</span>
      <span class="chip" title="hechas / planificadas hoy">${all.filter(t => estadoTarea(t) === "hecha").length}/${all.length}</span></div>${ts.map(t => tareaRowHtml(t, hoyISO, { ambitoSoloBocado: true })).join("")}`;
  };
  const p7 = tmResumen(STATE, agSumar(hoyISO, -6), hoyISO);
  const cronicasAbiertas = p7.cronicas.filter(c => c.estado === "pendiente").length;
  const pieTareas = p7.tareas >= 5 ? `<div class="flex-between text-xs muted mt-8" style="gap:8px;flex-wrap:wrap">
      <span>↪ Postergación 7 días: <b>${p7.indice}%</b>${cronicasAbiertas ? ` · <span class="hl-coral">${cronicasAbiertas} postergada${cronicasAbiertas === 1 ? "" : "s"} 3+ veces</span>` : ""}</span>
      <a href="#tendencias">Ver métricas →</a></div>` : "";
  const tareasCard = `<div class="card">
    <div class="card__head"><div class="card__title">📋 Tareas de hoy</div><a class="card__hint" href="#semana">Ver semana →</a></div>
    ${renderBandejaPendientes()}
    ${tareasHoy.length ? (bocado ? tareaRowHtml(bocado, hoyISO) : "") + grupo("pro") + grupo("per")
    : '<div class="empty" style="padding:14px">Sin tareas para hoy. Defínelas en tu ritual de apertura.</div>'}
    <div class="row mt-8">${ambitoPicker("inicio-amb", "per")}<input class="input" id="inicio-tarea" placeholder="Nueva tarea..." style="padding:9px 11px">
      <button class="btn btn--cian" data-action="tarea-add" data-fecha="${hoyISO}" data-input="inicio-tarea" data-amb="inicio-amb" style="padding:9px 12px">+</button></div>
    ${pieTareas}
  </div>`;

  return `
  ${renderPendingYesterday()}
  ${renderMesBanner()}
  ${renderSemanaBanner()}
  ${renderDayHero()}
  <div class="grid grid-4">
    ${statCard("💰", "Ahorro de " + MESES[mIdx], fmtCLP(ahorroMes), `Meta ${fmtCLP(metaMes)} · ${pctAhorro}%`, pctAhorro)}
    ${statCard("🔥", "Racha de hábitos", computeStreak() + (computeStreak() === 1 ? " día" : " días"), doneToday + "/" + habToca.length + " hoy")}
    ${statCard("📚", "Leyendo ahora", libro && libro.titulo ? libro.titulo : "—", libro && libro.estado === "leyendo" ? "En curso" : "Sin libro activo")}
    ${statCard("⚖️", "Peso actual", pesoActual != null ? pesoActual + " kg" : "—", "Meta " + s.salud.pesoObjetivo + " kg")}
  </div>

  <div class="grid grid-3 mt-24">
    ${tareasCard}
    <div class="card">
      <div class="card__head"><div class="card__title">Hábitos de hoy</div>
        <a class="card__hint" href="#habitos">Ver panel →</a></div>
      <div class="grid" style="gap:8px">${habitsToday || '<div class="empty">Agrega hábitos en el panel.</div>'}</div>
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">Metas de ${MESES[mIdx]}</div>
        <a class="card__hint" href="#metas">Ver metas →</a></div>
      ${metasMes.length ? metasMes.map(m => `<div class="item-row"><span class="check"></span>
        <div class="item-row__main"><div class="item-row__title">${escapeHtml(m.texto)}</div></div></div>`).join("")
      : '<div class="empty">Sin metas pendientes este mes. 🎉</div>'}
      <div class="divider"></div>
      <div class="flex-between">
        <span class="text-sm soft">Tu "por qué" financiero</span>
        <span class="chip chip--coral">${escapeHtml(STATE.finanzas.porque || "—")}</span>
      </div>
    </div>
  </div>

  <div class="card mt-24" style="background:linear-gradient(120deg, var(--surface), var(--surface-2))">
    <div class="flex-between" style="flex-wrap:wrap;gap:14px">
      <div>
        <div class="text-xs soft" style="letter-spacing:.08em;text-transform:uppercase">${saludo}, ${escapeHtml(s.profile.name)}</div>
        <div class="big-num">${edadTexto(s.profile.birthDate)}</div>
        <div class="text-sm muted">${escapeHtml(s.profile.motto)}</div>
        <div class="row-wrap" style="gap:8px;margin-top:10px">
          <span class="chip chip--cian">${rankFor(s.gamif.xp || 0).cur.icon} ${rankFor(s.gamif.xp || 0).cur.nombre}</span>
          ${tituloEquipado() ? `<span class="chip">${tituloEquipado().icon} ${escapeHtml(tituloEquipado().nombre)}</span>` : ""}
          ${insigniaDestacada() ? `<span class="chip chip--coral">${insigniaDestacada().icon} ${escapeHtml(insigniaDestacada().nombre)}</span>` : ""}
          <a class="chip" href="#recompensas" style="text-decoration:none">🏆 Ver recompensas</a>
        </div>
      </div>
      <button class="btn-ghost" data-action="edit-profile">✎ Editar perfil</button>
    </div>
  </div>`;
}

function statCard(ico, label, value, sub, pct) {
  return `<div class="card">
    <div class="flex-between" style="align-items:flex-start">
      <div class="stat">
        <div class="stat__label">${label}</div>
        <div class="stat__value">${value}</div>
        <div class="text-xs muted">${sub || ""}</div>
      </div>
      <div class="stat__ico">${ico}</div>
    </div>
    ${pct != null ? `<div class="bar mt-16"><div class="bar__fill" style="width:${pct}%"></div></div>` : ""}
  </div>`;
}

/* -------- Perfil modal -------- */
function openProfileModal() {
  openModal("Editar perfil", `
    <div class="field"><label>Nombre</label><input class="input" id="pf-name" value="${escapeAttr(STATE.profile.name)}"></div>
    <div class="field"><label>Fecha de nacimiento</label><input class="input" type="date" id="pf-birth" value="${STATE.profile.birthDate}"></div>
    <div class="field"><label>Frase / lema</label><input class="input" id="pf-motto" value="${escapeAttr(STATE.profile.motto)}"></div>
    <div class="field"><label>Nombre de la app</label><input class="input" id="pf-app" value="${escapeAttr(STATE.settings.appName)}"></div>
    <button class="btn btn--primary btn-block" data-action="profile-save">Guardar</button>
    <div class="divider"></div>
    <button class="btn-ghost btn-block" data-action="show-tutorial">📖 Ver introducción</button>
    <button class="btn-ghost btn-block" data-action="reset-data" style="margin-top:6px;color:var(--coral);border-color:var(--coral)">🗑 Reiniciar mis datos (empezar de cero)</button>`);
}
function saveProfile() {
  STATE.profile.name = val("pf-name") || STATE.profile.name || "Tú";
  STATE.profile.birthDate = val("pf-birth");
  STATE.profile.motto = val("pf-motto");
  STATE.settings.appName = val("pf-app") || "Rumbo";
  document.getElementById("brandName").innerHTML = STATE.settings.appName.replace("i", "<em>i</em>");
  document.title = STATE.settings.appName + " · Tu vida en un solo lugar";
  saveState(); closeModal(); rerender(); toast("Perfil actualizado");
}

/* ============================================================
   CUENTA · seguridad, datos y sesión
   ============================================================ */
function renderCuenta() {
  const email = (CURRENT_USER && CURRENT_USER.email) || "";
  return `
  <div class="card">
    <div class="card__title">👤 Tu cuenta</div>
    <div class="mt-8 text-sm soft">Sesión iniciada como <b>${escapeHtml(email)}</b></div>
  </div>

  <div class="card mt-16">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px"><div><div class="card__title" style="font-size:15px">📖 Introducción</div>
      <div class="text-sm muted mt-8">Vuelve a ver el recorrido por Rumbo.</div></div>
      <button class="btn btn--soft" data-action="show-tutorial">📖 Ver introducción</button></div>
  </div>

  <div class="card mt-16">
    <div class="card__title" style="font-size:15px">🔑 Contraseña</div>
    <div class="field mt-16"><label>Nueva contraseña</label>
      <input class="input" type="password" id="acc-pass" placeholder="Mínimo 6 caracteres"></div>
    <button class="btn btn--primary btn-block" data-action="acc-change-pass">Actualizar contraseña</button>
  </div>

  <div class="card mt-16">
    <div class="card__title" style="font-size:15px">💾 Tus datos</div>
    <p class="soft mt-8 text-sm">Descarga una copia de todo, o restaura desde un respaldo.</p>
    <div class="row-wrap mt-16">
      <button class="btn btn--soft" data-action="export">⭳ Respaldar (descargar)</button>
      <button class="btn btn--soft" data-action="acc-import">⭱ Importar respaldo</button>
    </div>
    <input type="file" id="acc-file" accept="application/json,.json" hidden onchange="importBackup(this)">
  </div>

  <div class="card mt-16" style="border-color:var(--coral)">
    <div class="card__title" style="font-size:15px">⚠️ Zona sensible</div>
    <div class="row-wrap mt-16">
      <button class="btn-ghost" data-action="reset-data" style="color:var(--coral);border-color:var(--coral)">🗑 Reiniciar mis datos</button>
      <button class="btn-ghost" data-action="acc-delete" style="color:var(--coral);border-color:var(--coral)">✕ Eliminar mi cuenta</button>
    </div>
    <p class="text-xs muted mt-8">Reiniciar borra tus datos pero conserva tu cuenta. Eliminar borra todo y cierra tu cuenta para siempre.</p>
  </div>`;
}

async function doChangePass() {
  const p = document.getElementById("acc-pass").value;
  if (!p || p.length < 6) return toast("Mínimo 6 caracteres", true);
  const res = await BACKEND.updatePassword(p);
  if (res.error) return toast(res.error, true);
  document.getElementById("acc-pass").value = "";
  toast("Contraseña actualizada ✅");
}

function importBackup(input) {
  const f = input.files && input.files[0];
  input.value = "";
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { return toast("El archivo no es un respaldo válido", true); }
    if (!data || typeof data !== "object" || !data.settings || !data.profile) return toast("Ese archivo no parece un respaldo de Rumbo", true);
    if (!confirm("Esto REEMPLAZARÁ tus datos actuales con los del respaldo. ¿Continuar?")) return;
    STATE = migrate(data);
    applyTheme(STATE.settings.theme); applyCosmetics();
    saveState(); updateTopbar(); rerender();
    toast("Datos importados ✅");
  };
  reader.readAsText(f);
}

async function doDeleteAccount() {
  if (!confirm("¿Eliminar tu cuenta y TODOS tus datos para siempre? Esto no se puede deshacer.")) return;
  if (!confirm("Última confirmación: se borrará todo y no podrás recuperarlo. ¿Seguro?")) return;
  const res = await BACKEND.deleteAccount();
  if (res.error) return toast(res.error, true);
  CURRENT_USER = null; STATE = null; location.hash = "";
  showAuth(); toast("Cuenta eliminada");
}

/* ============================================================
   Utilidades UI compartidas (modal, toast, escape)
   ============================================================ */
function openModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalOverlay").hidden = false;
}
function closeModal() { ONB_ACTIVE = false; document.getElementById("modalOverlay").hidden = true; }
document.addEventListener("click", e => { if (e.target.id === "modalOverlay") closeModal(); });

let toastTimer = null;
function toast(msg, coral = false) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast" + (coral ? " toast--coral" : ""); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

function exportData() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `rumbo-respaldo-${todayISO()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast("Respaldo descargado");
}

/* mountAfterRender: hook para módulos que necesitan JS tras render (ej. radar) */
function mountAfterRender() {
  LIVE_HOOK = null;
  if (typeof afterRender === "function") afterRender(CURRENT);
}
