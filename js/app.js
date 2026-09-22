/* ============================================================
   RUMBO · App core: router, navegación, Inicio y motor de eventos
   ============================================================ */

/* -------- Configuración de navegación -------- */
const ROUTES = [
  { grupo: "Principal" },
  { id: "inicio", label: "Inicio", icon: "🏠", render: renderInicio, subtitle: "Tu centro de control diario." },
  { id: "ritual", label: "Ritual Matutino", icon: "🌅", render: renderRitual, subtitle: "Empieza el día con intención y foco." },
  { id: "diario", label: "Diario", icon: "📔", render: renderDiario, subtitle: "Tu día a día: ánimo, reflexión e historial del ritual." },
  { grupo: "Análisis" },
  { id: "tendencias", label: "Tendencias", icon: "📈", render: renderTendencias, subtitle: "Tu evolución del año en gráficos." },
  { id: "recompensas", label: "Recompensas", icon: "🏆", render: renderRecompensas, subtitle: "Tu rango, tus insignias y la tienda de cosméticos." },
  { grupo: "Organización" },
  { id: "metas", label: "Objetivos y metas", icon: "🎯", render: renderMetas, subtitle: "Tus metas trimestrales y mensuales." },
  { id: "semana", label: "Planificador semanal", icon: "🗂️", render: renderSemana, subtitle: "Tus tareas de lunes a domingo." },
  { id: "habitos", label: "Hábitos", icon: "📊", render: renderHabitos, subtitle: "Marca cada día y cuida tu racha." },
  { id: "lecturas", label: "Lecturas", icon: "📚", render: renderLecturas, subtitle: "Tu biblioteca personal de lectura." },
  { id: "calendario", label: "Calendario", icon: "🗓️", render: renderCalendario, subtitle: "Tu mes de un vistazo." },
  { grupo: "Vida" },
  { id: "relaciones", label: "Relaciones", icon: "👥", render: renderRelaciones, subtitle: "Cumpleaños y con quién no hablas hace rato." },
  { id: "listas", label: "Listas", icon: "🧾", render: renderListas, subtitle: "Compras, películas, viajes y más." },
  { grupo: "Bienestar" },
  { id: "salud", label: "Salud y bienestar", icon: "💪", render: renderSalud, subtitle: "Entrenamiento, cocina y peso." },
  { id: "entrenamiento", label: "Entrenamiento", icon: "🏋️", render: renderEntrenamiento, subtitle: "Tu rutina por bloques." },
  { id: "rueda", label: "Rueda de la vida", icon: "🧭", render: renderRueda, subtitle: "Puntúa cada área del 0 al 10." },
  { grupo: "Recursos" },
  { id: "finanzas", label: "Finanzas", icon: "💰", render: renderFinanzas, subtitle: "Ahorro, gastos y seguimiento mensual." },
  { id: "aprendizajes", label: "Aprendizajes", icon: "🧠", render: renderAprendizajes, subtitle: "Temas profesionales y de interés." },
  { id: "notas", label: "Notas", icon: "📝", render: renderNotas, subtitle: "Captura rápida y notas organizadas por categoría." },
  { grupo: "Personalización" },
  { id: "tienda", label: "Tienda", icon: "🛒", render: renderTienda, subtitle: "Desbloquea temas, títulos y detalles con tus ⭐." },
  { id: "cuenta", label: "Cuenta", icon: "🔐", render: renderCuenta, subtitle: "Tus datos, seguridad y sesión." },
  { id: "notif", label: "Notificaciones", icon: "🔔", render: renderNotificaciones, subtitle: "Recordatorios de tu ritual (mañana y noche)." },
];
const ROUTE_MAP = {};
ROUTES.forEach(r => { if (r.id) ROUTE_MAP[r.id] = r; });
/* Orden de secciones para el gesto de deslizar (mismo orden del menú) */
const SECTION_ORDER = ROUTES.filter(r => r.id).map(r => r.id);

let CURRENT = "inicio";
let CURRENT_USER = null;

/* -------- Init / arranque con autenticación -------- */
document.addEventListener("DOMContentLoaded", () => { boot(); });

async function boot() {
  // Listeners globales (una sola vez)
  document.addEventListener("click", onClick);
  document.getElementById("view").addEventListener("change", onBind);
  document.getElementById("view").addEventListener("input", onBindLive);
  document.getElementById("hamburger").addEventListener("click", () =>
    setSidebar(!document.getElementById("sidebar").classList.contains("is-open")));
  document.getElementById("sidebarBackdrop").addEventListener("click", () => setSidebar(false));
  initGestures();
  window.addEventListener("online", () => { if (CURRENT_USER) scheduleCloudSave(); });
  // Al volver a la app (cambiar de pestaña/ventana o enfocar), traer lo último de la nube
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncFromCloud(); });
  window.addEventListener("focus", () => syncFromCloud());
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
  if (!STATE.settings.onboarded) setTimeout(openOnboarding, 350);
}

/* -------- Tutorial / onboarding para usuarios nuevos -------- */
let ONB_STEP = 0;
const ONB_SLIDES = [
  { icon: "👋", titulo: "Bienvenido a Rumbo", cuerpo: "Tu vida en un solo lugar. Un centro de control personal para tu día, tus hábitos, tus finanzas, tus lecturas y tu bienestar — todo en una sola app." },
  { icon: "🌅", titulo: "Tu día, de principio a fin", cuerpo: "El corazón de Rumbo es un ritual diario: <b>abre tu día</b> (tu misión, tu SAPO 🐸 y tu energía), vívelo, y <b>ciérralo</b> de noche con una breve reflexión y gratitud. Con solo abrir y cerrar, tu sistema sigue vivo — la idea es usar la app lo <i>menos</i> posible." },
  { icon: "🧭", titulo: "Todo en un lugar", cuerpo: "__GRID__" },
];
function openOnboarding() { ONB_STEP = 0; renderOnboardingStep(); }
function renderOnboardingStep() {
  const total = ONB_SLIDES.length + 1; // 3 diapositivas + formulario
  const dots = Array.from({ length: total }, (_, i) => `<span class="onb-dot ${i === ONB_STEP ? "is-on" : ""}"></span>`).join("");
  if (ONB_STEP < ONB_SLIDES.length) {
    const s = ONB_SLIDES[ONB_STEP];
    let cuerpo = s.cuerpo;
    if (cuerpo === "__GRID__") {
      const areas = [["🌅", "Ritual"], ["📓", "Bitácora"], ["📔", "Diario"], ["📊", "Hábitos"], ["📚", "Lecturas"], ["💰", "Finanzas"], ["📈", "Tendencias"], ["🏆", "Recompensas"]];
      cuerpo = `Rumbo reúne lo que hoy tienes disperso:
        <div class="onb-grid">${areas.map(a => `<div class="onb-area"><span>${a[0]}</span>${a[1]}</div>`).join("")}</div>
        <div class="text-xs muted" style="margin-top:12px">Y ganas ⭐, subes de rango y desbloqueas insignias mientras avanzas.</div>`;
    }
    openModal("Bienvenido 🎉", `
      <div class="onb-slide"><div class="onb-ico">${s.icon}</div>
        <h3 class="onb-title">${s.titulo}</h3>
        <div class="onb-body">${cuerpo}</div></div>
      <div class="onb-dots">${dots}</div>
      <div class="onb-nav">
        <button class="btn-ghost" data-action="onb-skip">Saltar</button>
        <button class="btn btn--primary" data-action="onb-next">${ONB_STEP === ONB_SLIDES.length - 1 ? "Continuar" : "Siguiente"}</button>
      </div>`);
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
function saveOnboarding() {
  STATE.profile.name = val("ob-name") || (CURRENT_USER && CURRENT_USER.name) || "Tú";
  STATE.profile.birthDate = val("ob-birth");
  STATE.profile.motto = val("ob-motto") || "Construyendo mi mejor versión";
  STATE.settings.onboarded = true;
  saveState(); closeModal(); updateTopbar(); rerender();
  toast("¡Listo! Bienvenido a Rumbo 🎉");
  if (typeof maybePromptNotif === "function") setTimeout(maybePromptNotif, 500);
}

async function loadUserState(user) {
  let data = await BACKEND.loadState(user.id);
  if (!data) { try { const raw = localStorage.getItem("rumbo_state_" + user.id); if (raw) data = JSON.parse(raw); } catch (e) {} }
  STATE = data ? migrate(data) : defaultState();
  if (!STATE.profile.name || STATE.profile.name === "Chris") STATE.profile.name = user.name || STATE.profile.name;
  ensureCurrentWeek();   // limpia el planificador si cambió la semana
  saveState();
}

let _cloudTimer = null;
let _dirty = false;        // hay cambios locales sin confirmar en la nube
function scheduleCloudSave() {
  clearTimeout(_cloudTimer);
  _dirty = true;
  setSaveStatus("saving");
  _cloudTimer = setTimeout(async () => {
    if (!CURRENT_USER) return;
    const res = await BACKEND.saveState(CURRENT_USER.id, STATE);
    if (res && res.error) { setSaveStatus("offline"); }
    else { _dirty = false; setSaveStatus("saved"); }
  }, 800);
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
    if (r.grupo) return `<div class="nav__label">${r.grupo}</div>`;
    return `<button class="nav__item" data-route="${r.id}">
      <span class="nav__ico">${r.icon}</span><span>${r.label}</span></button>`;
  }).join("");
  document.getElementById("brandName").innerHTML = `${STATE.settings.appName.replace("i","<em>i</em>")}`;
  buildBottomNav();
}

/* Barra inferior en móvil: accesos directos + Menú (abre el lateral) */
const BOTTOM_NAV = ["inicio", "ritual", "habitos", "diario"];
function buildBottomNav() {
  const bar = document.getElementById("bottombar");
  if (!bar) return;
  const items = BOTTOM_NAV.map(id => {
    const r = ROUTE_MAP[id]; if (!r) return "";
    return `<button class="bottombar__item" data-route="${id}">
      <span class="bico">${r.icon}</span>${r.label.split(" ")[0]}</button>`;
  }).join("");
  bar.innerHTML = items + `<button class="bottombar__item" data-action="open-menu">
    <span class="bico">☰</span>Menú</button>`;
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
  const i = SECTION_ORDER.indexOf(CURRENT);
  if (i === -1) return;
  const j = i + dir;
  if (j < 0 || j >= SECTION_ORDER.length) return; // sin dar la vuelta en los extremos
  go(SECTION_ORDER[j]);
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
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); valid = true;
  }, { passive: true });
  view.addEventListener("touchend", e => {
    if (!valid) return; valid = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && dt < 600) navigateSection(dx < 0 ? 1 : -1);
  }, { passive: true });

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
      <button class="btn btn--primary" data-action="day-close" data-date="${iso}">Cerrar ${escapeHtml(d.toLocaleDateString("es-CL", { weekday: "long" }))}</button>
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
  const habTotal = STATE.habitos.defs.length;
  const habDone = STATE.habitos.defs.filter(h => habitDone(h.id, mIdx, day)).length;
  const wd = (new Date().getDay() + 6) % 7;
  const tareas = STATE.semana.dias[wd] || [];
  const tareasDone = tareas.filter(t => t.done).length;
  return { habDone, habTotal, tareasDone, tareasTotal: tareas.length };
}

/* -------- Puntos (gamificación) -------- */
function addPoints(n) {
  STATE.gamif.puntos = Math.max(0, STATE.gamif.puntos + n);
  STATE.gamif.xp = Math.max(0, (STATE.gamif.xp || 0) + n);
  saveState();
  const el = document.getElementById("ptsVal");
  if (el) el.textContent = STATE.gamif.puntos;
  if (n > 0) toast("+" + n + " ⭐");
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
  setPath(STATE, path, val);
  saveState();
  if (el.dataset.render !== "no") { updateTopbar(); rerender(); }
}
// para sliders con actualización en vivo (data-live)
function onBindLive(e) {
  const el = e.target.closest("[data-bind][data-live]");
  if (!el) return;
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
      const bucket = d.bucket === "tri" ? STATE.metas.trimestres : STATE.metas.mensuales;
      bucket[+d.idx].push({ id: uid(), texto: txt, done: false });
      saveState(); rerender(); break;
    }
    case "meta-toggle": {
      const bucket = d.bucket === "tri" ? STATE.metas.trimestres : STATE.metas.mensuales;
      const it = bucket[+d.idx].find(x => x.id === d.id); it.done = !it.done;
      saveState(); rerender(); break;
    }
    case "meta-del": {
      const bucket = d.bucket === "tri" ? STATE.metas.trimestres : STATE.metas.mensuales;
      bucket[+d.idx] = bucket[+d.idx].filter(x => x.id !== d.id);
      saveState(); rerender(); break;
    }

    /* Finanzas gastos */
    case "gasto-add": openGastoModal(); break;
    case "gasto-del": STATE.finanzas.gastos = STATE.finanzas.gastos.filter(g => g.id !== d.id); saveState(); rerender(); break;
    case "gasto-save": saveGasto(); break;

    /* Hábitos */
    case "habit-add": openHabitModal(); break;
    case "habit-del":
      if (confirm("¿Eliminar este hábito y su historial?")) {
        STATE.habitos.defs = STATE.habitos.defs.filter(h => h.id !== d.id);
        saveState(); rerender();
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
      STATE.salud.meses[+d.idx].recetaHecha = !STATE.salud.meses[+d.idx].recetaHecha;
      saveState(); rerender(); break;
    }
    case "salud-month": SALUD_MONTH = +d.m; rerender(); break;

    /* Rueda mes */
    case "rueda-month": RUEDA_MONTH = +d.m; rerender(); break;

    /* Aprendizajes */
    case "apr-add": openAprModal(d.tipo); break;
    case "apr-del": STATE.aprendizajes = STATE.aprendizajes.filter(x => x.id !== d.id); saveState(); rerender(); break;
    case "apr-save": saveApr(); break;
    case "apr-toggle": { const a = STATE.aprendizajes.find(x => x.id === d.id); if (a) { a.done = !a.done; addPoints(a.done ? 10 : -10); } saveState(); rerender(); break; }

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
    case "cierre-save": saveCierre(); break;

    /* Ritual matutino */
    case "ritual-start": openRitualModal(); break;
    case "ritual-save": saveRitual(); break;
    case "pilares-info": openPilaresInfo(); break;

    /* Bitácora */
    case "bita-toggle": BITA_OPEN[d.iso] = !BITA_OPEN[d.iso]; rerender(); break;

    /* Planificador semanal */
    case "sem-add": {
      const input = document.getElementById(d.input);
      const txt = input.value.trim(); if (!txt) return;
      STATE.semana.dias[+d.day].push({ id: uid(), txt, done: false });
      saveState(); rerender(); break;
    }
    case "sem-toggle": {
      const t = STATE.semana.dias[+d.day].find(x => x.id === d.id);
      t.done = !t.done; addPoints(t.done ? 15 : -15);
      saveState(); rerender(); break;
    }
    case "sem-del": STATE.semana.dias[+d.day] = STATE.semana.dias[+d.day].filter(x => x.id !== d.id); saveState(); rerender(); break;
    case "sem-clear": if (confirm("¿Vaciar todas las tareas de la semana?")) { STATE.semana.dias = [[],[],[],[],[],[],[]]; saveState(); rerender(); } break;

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
      if (STATE.gamif.puntos < th.costo) { toast("Te faltan " + (th.costo - STATE.gamif.puntos) + " ⭐", true); break; }
      if (!confirm(`¿Desbloquear el tema "${th.nombre}" por ${th.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - th.costo} ⭐.`)) break;
      STATE.gamif.puntos -= th.costo; STATE.gamif.owned.push("tema-" + d.theme);
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
      STATE.vida.diario.push({ id: uid(), fecha: todayISO(), mood, texto, gratitud: grat });
      saveState(); addPoints(10); rerender(); break;
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
    case "onb-next": ONB_STEP = Math.min(ONB_SLIDES.length, ONB_STEP + 1); renderOnboardingStep(); break;
    case "onb-prev": ONB_STEP = Math.max(0, ONB_STEP - 1); renderOnboardingStep(); break;
    case "onb-skip": ONB_STEP = ONB_SLIDES.length; renderOnboardingStep(); break;
    case "show-tutorial": openOnboarding(); break;
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

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t || "biplot");
}
function themeOwned(id) {
  return id === "biplot" || id === "light" || (STATE.gamif.owned || []).includes("tema-" + id);
}

const THEMES = [
  { id: "biplot", nombre: "BiPlot", concepto: "El dashboard original: azul profundo, limpio y moderno.", costo: 0,
    bg: "#0A1F34", card: "#102A46", accent: "#17C3B2", cta: "#FF6B4A", text: "#EAF2FB", font: "'Space Grotesk',sans-serif", radius: "10px" },
  { id: "light", nombre: "Claro", concepto: "Sobre gris niebla, tarjetas blancas y texto azul. Diurno y sobrio.", costo: 0,
    bg: "#F2F4F7", card: "#FFFFFF", accent: "#17C3B2", cta: "#FF6B4A", text: "#0E2A47", font: "'Space Grotesk',sans-serif", radius: "10px" },
  { id: "pixel", nombre: "8-Bit Arcade", concepto: "Retro pixelado: tipografía de consola, bordes duros y sombras sólidas.", costo: 400,
    bg: "#0A1F34", card: "#102A46", accent: "#17C3B2", cta: "#FF6B4A", text: "#EAF2FB", font: "'Press Start 2P',monospace", radius: "0" },
  { id: "terminal", nombre: "Terminal", concepto: "Consola retro: monoespaciado cian sobre casi negro.", costo: 400,
    bg: "#05141F", card: "#08202F", accent: "#8FF3E8", cta: "#FF6B4A", text: "#8FF3E8", font: "'VT323',monospace", radius: "6px" },
  { id: "neon", nombre: "Neón", concepto: "Noche cyberpunk: acentos magenta y cian que brillan.", costo: 600,
    bg: "#0B0A1F", card: "#151233", accent: "#22E7FF", cta: "#FF4FD8", text: "#EDE9FF", font: "'Space Grotesk',sans-serif", radius: "12px" },
  { id: "matrix", nombre: "Matrix", concepto: "Verde fósforo sobre negro. Modo hacker total.", costo: 600,
    bg: "#000000", card: "#04140A", accent: "#3BE38B", cta: "#3BE38B", text: "#4dff9b", font: "'VT323',monospace", radius: "2px" },
  { id: "papel", nombre: "Papel", concepto: "Cálido tipo cuaderno: crema, sepia y tinta azul.", costo: 300,
    bg: "#F3EEE3", card: "#FBF8F1", accent: "#17877A", cta: "#E0603A", text: "#2E2A22", font: "'Space Grotesk',sans-serif", radius: "10px" },
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
        <div class="theme-preview__card" style="background:${t.card};border-radius:${t.radius};color:${t.text};font-family:${t.font}">Aa</div>
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
  const owned = themeOwned(t.id);
  const active = STATE.settings.theme === t.id;
  const mock = `
    <div style="background:${t.bg};border-radius:14px;padding:14px;font-family:${t.font};color:${t.text}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-weight:700;font-size:15px">Rumbo</div>
        <div style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:11px">⭐ 320</div>
      </div>
      <div style="background:${t.card};border-radius:${t.radius};padding:14px;margin-bottom:10px">
        <div style="font-size:11px;opacity:.7">Ahorro del mes</div>
        <div style="font-size:24px;font-weight:700">$540.000</div>
        <div style="height:8px;background:rgba(128,128,128,.25);border-radius:99px;margin-top:8px;overflow:hidden"><div style="width:66%;height:100%;background:${t.accent};border-radius:99px"></div></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="background:${t.accent};color:${t.bg};border-radius:${t.radius};padding:4px 10px;font-size:11px;font-weight:600">🎯 Misión</span>
        <span style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:11px">🐸 SAPO</span>
        <button style="margin-left:auto;background:${t.cta};color:#fff;border:none;border-radius:${t.radius};padding:8px 16px;font-size:12px;font-weight:700;font-family:${t.font}">Abre tu día</button>
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
  if (allDone && !dia.premiado) { dia.premiado = true; addPoints(30); }
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
  if (cur) { delete STATE.habitos.log[key][habitId][day]; addPoints(-5); }
  else { STATE.habitos.log[key][habitId][day] = true; addPoints(5); }
  saveState();
  updateTopbar();
  rerender();
}
// Grilla mensual: usa el mes seleccionado
function toggleHabitCell(habitId, day) { toggleHabitDate(habitId, STATE.settings.year, HABIT_MONTH, day); }
// Toggle del día de hoy (vista Diario e Inicio)
function toggleHabitToday(habitId) { const n = new Date(); toggleHabitDate(habitId, n.getFullYear(), n.getMonth(), n.getDate()); }
function habitDone(habitId, monthIdx, day) {
  const key = monthKey(STATE.settings.year, monthIdx);
  return !!(STATE.habitos.log[key] && STATE.habitos.log[key][habitId] && STATE.habitos.log[key][habitId][day]);
}
function computeStreak() {
  // días consecutivos (terminando hoy) con al menos un hábito marcado
  const now = new Date();
  let streak = 0;
  for (let back = 0; back < 366; back++) {
    const d = new Date(now); d.setDate(now.getDate() - back);
    const key = monthKey(d.getFullYear(), d.getMonth());
    const log = STATE.habitos.log[key];
    let any = false;
    if (log) for (const hid in log) { if (log[hid][d.getDate()]) { any = true; break; } }
    if (any) streak++;
    else if (back === 0) continue; // hoy aún puede estar vacío
    else break;
  }
  return streak;
}

/* ============================================================
   Ciclo del día: hero del Inicio + resumen de cierre
   ============================================================ */
function heroCoral(title, sub, btnLabel, action) {
  return `<div class="card" style="background:linear-gradient(120deg,var(--coral),#ff8a70);color:#fff;margin-bottom:24px">
    <div class="flex-between" style="flex-wrap:wrap;gap:16px">
      <div><div class="big-num" style="color:#fff">${title}</div>
        <div style="opacity:.92;margin-top:4px">${sub}</div></div>
      <button class="btn" style="background:#fff;color:var(--coral)" data-action="${action}">${btnLabel}</button>
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
    return heroCoral(`${saludo}, ${name}.`, "Antes de arrancar, define tu enfoque del día. Toma 30 segundos.", "🌅 Abre tu día", "day-open");

  if (st === "por-cerrar")
    return heroCoral(`${saludo}, ${name}.`, "Tu día está por terminar. Cierra el ritual y reflexiona.", "🌙 Cierra tu día", "day-close");

  if (st === "cerrado") return renderCierreResumen(r);

  // en-curso
  const wd = (new Date().getDay() + 6) % 7;
  const tHoy = STATE.semana.dias[wd] || [];
  const tDone = tHoy.filter(t => t.done).length;
  const chips = `<div class="row-wrap" style="gap:8px;margin-top:8px">
    ${r.mision ? `<span class="chip chip--cian">🎯 ${escapeHtml(r.mision)}</span>` : ""}
    ${r.sapo ? `<span class="chip chip--coral">🐸 ${escapeHtml(r.sapo)}</span>` : ""}
    ${r.servir ? `<span class="chip">🙌 ${escapeHtml(r.servir)}</span>` : ""}
    ${r.pilar ? `<span class="chip">${escapeHtml(r.pilar)}</span>` : ""}
    ${tHoy.length ? `<span class="chip">📋 ${tDone}/${tHoy.length} tareas</span>` : ""}</div>`;
  return `<div class="card" style="margin-bottom:24px;border-left:3px solid var(--cian)">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Tu enfoque de hoy</div>${chips}</div>
      <button class="btn btn--soft" data-action="day-close">🌙 Cerrar el día</button>
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
  return `<div class="card" style="margin-bottom:24px;background:linear-gradient(120deg,var(--cian-soft),var(--surface))">
    <div class="card__head"><div class="card__title">✅ Día cerrado</div>
      <span class="chip chip--streak" style="color:var(--coral)">🔥 ${computeClosedStreak()} días cerrados</span></div>
    <div class="grid grid-2">
      <div>
        <div class="text-xs muted">Misión</div><div class="mt-8">${r.mision ? escapeHtml(r.mision) : "—"} ${cumpliChip(c.mision)}</div>
        <div class="text-xs muted mt-16">SAPO</div><div class="mt-8">${r.sapo ? escapeHtml(r.sapo) : "—"} ${c.sapo ? '<span class="chip chip--done">hecho</span>' : '<span class="chip">pendiente</span>'}</div>
        <div class="text-xs muted mt-16">Energía inicio → cierre</div>
        <div class="mt-8">${r.energia || "—"} → ${c.energia || "—"} / 5</div>
      </div>
      <div>
        ${c.mejor ? `<div class="text-xs muted">Lo mejor / gratitud</div><div class="mt-8">${escapeHtml(c.mejor)}</div>` : ""}
        ${c.manana ? `<div class="text-xs muted mt-16">Una cosa para mañana</div><div class="mt-8 hl-cian">${escapeHtml(c.manana)}</div>` : ""}
        <div class="row-wrap mt-16" style="gap:8px">
          <span class="chip">📊 Hábitos ${s.habDone}/${s.habTotal}</span>
          <span class="chip">🗂️ Tareas ${s.tareasDone}/${s.tareasTotal}</span>
        </div>
      </div>
    </div>
    ${c.nota ? `<div class="divider"></div><div class="text-sm soft">"${escapeHtml(c.nota)}"</div>` : ""}
    <div class="text-sm muted mt-16">Mañana volvemos a empezar 🌅</div>
  </div>`;
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
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const mIdx = new Date().getMonth();
  const day = new Date().getDate();

  // stats
  const mesFin = s.finanzas.meses[mIdx];
  const ahorroMes = (mesFin.ingreso || 0) - (mesFin.gasto || 0);
  const metaMes = s.finanzas.metaMensual || 1;
  const pctAhorro = Math.min(100, Math.round((ahorroMes / metaMes) * 100));

  const libro = s.lecturas.find(l => l.estado === "leyendo") || s.lecturas.find(l => l.titulo);
  const pesos = s.salud.meses.map(m => m.peso).filter(p => p != null);
  const pesoActual = pesos.length ? pesos[pesos.length - 1] : null;

  const habitsToday = s.habitos.defs.map(h => {
    const on = habitDone(h.id, mIdx, day);
    return `<button class="nav__item" style="background:${on ? 'var(--cian-soft)' : 'var(--surface-2)'};border:1px solid var(--line);justify-content:space-between"
      data-action="quick-habit" data-id="${h.id}">
      <span><span class="nav__ico">${h.icon}</span> ${h.nombre}</span>
      <span class="check ${on ? 'is-on' : ''}">${on ? '✓' : ''}</span></button>`;
  }).join("");
  const doneToday = s.habitos.defs.filter(h => habitDone(h.id, mIdx, day)).length;

  const metasMes = (s.metas.mensuales[mIdx] || []).filter(m => !m.done);

  const wd = (new Date().getDay() + 6) % 7;
  const tareasHoy = s.semana.dias[wd] || [];
  const tareasCard = `<div class="card">
    <div class="card__head"><div class="card__title">📋 Tareas de hoy</div><a class="card__hint" href="#semana">Ver semana →</a></div>
    ${tareasHoy.length ? tareasHoy.map(t => `<div class="item-row" style="padding:9px 11px${t.esSapo ? ";border-color:rgba(255,107,74,.4)" : ""}">
      <span class="check ${t.done ? "is-on" : ""}" data-action="sem-toggle" data-day="${wd}" data-id="${t.id}">${t.done ? "✓" : ""}</span>
      <div class="item-row__main"><div class="item-row__title text-sm ${t.done ? "strike" : ""}">${t.esSapo ? "🐸 " : ""}${escapeHtml(t.txt)}</div>
        ${t.esSapo ? '<div class="item-row__sub hl-coral">Tu SAPO · cómetela primero</div>' : ""}</div>
      <button class="icon-btn" data-action="sem-del" data-day="${wd}" data-id="${t.id}">✕</button></div>`).join("")
    : '<div class="empty" style="padding:14px">Sin tareas para hoy. Defínelas en tu ritual de apertura.</div>'}
    <div class="row mt-8"><input class="input" id="inicio-tarea" placeholder="Nueva tarea..." style="padding:9px 11px">
      <button class="btn btn--cian" data-action="sem-add" data-day="${wd}" data-input="inicio-tarea" style="padding:9px 12px">+</button></div>
  </div>`;

  return `
  ${renderPendingYesterday()}
  ${renderDayHero()}
  <div class="grid grid-4">
    ${statCard("💰", "Ahorro de " + MESES[mIdx], fmtCLP(ahorroMes), `Meta ${fmtCLP(metaMes)} · ${pctAhorro}%`, pctAhorro)}
    ${statCard("🔥", "Racha de hábitos", computeStreak() + (computeStreak() === 1 ? " día" : " días"), doneToday + "/" + s.habitos.defs.length + " hoy")}
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
    <button class="btn-ghost btn-block" data-action="show-tutorial">🎓 Ver el tutorial otra vez</button>
    <button class="btn-ghost btn-block" data-action="reset-data" style="margin-top:6px;color:var(--coral);border-color:rgba(255,107,74,.4)">🗑 Reiniciar mis datos (empezar de cero)</button>`);
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

  <div class="card mt-16" style="border-color:rgba(255,107,74,.35)">
    <div class="card__title" style="font-size:15px">⚠️ Zona sensible</div>
    <div class="row-wrap mt-16">
      <button class="btn-ghost" data-action="reset-data" style="color:var(--coral);border-color:rgba(255,107,74,.4)">🗑 Reiniciar mis datos</button>
      <button class="btn-ghost" data-action="acc-delete" style="color:var(--coral);border-color:rgba(255,107,74,.4)">✕ Eliminar mi cuenta</button>
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
function closeModal() { document.getElementById("modalOverlay").hidden = true; }
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
