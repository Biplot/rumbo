/* ============================================================
   RUMBO · App core: router, navegación, Inicio y motor de eventos
   ============================================================ */

/* -------- Configuración de navegación -------- */
/* Principal: siempre visible. "Módulos" (mas: true): se puede ocultar en Personalizar menú (settings.menu.ocultos).
   pie: true → no va en la lista del menú; se llega desde el pie (Recompensas y el menú de cuenta). */
const ROUTES = [
  { grupo: "Principal" },
  { id: "inicio", label: "Inicio", icon: "🏠", render: renderInicio, subtitle: "Tu centro de control diario." },
  { id: "semana", label: "Semana", icon: "🗂️", render: renderSemana, subtitle: "Tu plan y tus tareas de lunes a domingo." },
  { id: "habitos", label: "Hábitos", icon: "📊", render: renderHabitos, subtitle: "Marca cada día y cuida tu racha." },
  { id: "metas", label: "Objetivos", icon: "🎯", render: renderMetas, subtitle: "Tus metas trimestrales y mensuales, y las que logras con amigos." },
  { id: "ritual", label: "Ritual", icon: "🌅", render: renderRitual, subtitle: "Abre y cierra tu día, tu semana y tu mes." },
  { id: "diario", label: "Diario", icon: "📔", render: renderDiario, subtitle: "Tu día a día: ánimo, reflexión e historial del ritual." },
  { id: "amigos", label: "Amigos", icon: "🤝", render: renderAmigos, subtitle: "Invita, acompaña y manda ánimo. Tú eliges qué ven." },
  { grupo: "Módulos" },
  { id: "tendencias", mas: true, label: "Tendencias", icon: "📈", render: renderTendencias, subtitle: "Tu evolución del año en gráficos." },
  { id: "calendario", mas: true, label: "Calendario", icon: "🗓️", render: renderCalendario, subtitle: "Tu mes de un vistazo." },
  { id: "finanzas", mas: true, label: "Finanzas", icon: "💰", render: renderFinanzas, subtitle: "Ahorro, gastos y seguimiento mensual." },
  { id: "salud", mas: true, label: "Salud", icon: "💪", render: renderSalud, subtitle: "Peso, recetas y entrenamiento." },
  { id: "entrenamiento", pie: true, label: "Salud", icon: "🏋️", render: renderEntrenamiento, subtitle: "Tus rutinas y ejercicios." },
  { id: "rueda", mas: true, label: "Rueda de la vida", icon: "🧭", render: renderRueda, subtitle: "Puntúa cada área del 0 al 10." },
  { id: "lecturas", mas: true, label: "Lecturas", icon: "📚", render: renderLecturas, subtitle: "Tu biblioteca personal de lectura." },
  { id: "relaciones", mas: true, label: "Relaciones", icon: "👥", render: renderRelaciones, subtitle: "Cumpleaños y con quién no hablas hace rato." },
  { id: "listas", mas: true, label: "Listas", icon: "🧾", render: renderListas, subtitle: "Compras, películas, viajes y más." },
  { id: "aprendizajes", mas: true, label: "Aprendizajes", icon: "🧠", render: renderAprendizajes, subtitle: "Temas profesionales y de interés." },
  { id: "notas", mas: true, label: "Notas", icon: "📝", render: renderNotas, subtitle: "Tus ideas como post-its, con #etiquetas." },
  { id: "recompensas", pie: true, label: "Recompensas", icon: "🏆", render: renderRecompensas, subtitle: "Tu rango, tus monedas y la Tienda." },
  { id: "cuarto", pie: true, lugar: true, label: "Tu casa", icon: "🏠", render: renderCuarto, subtitle: "Tu elefante en su casa, a pantalla completa." },
  { id: "cielo", pie: true, lugar: true, label: "Tu vitrina", icon: "✨", render: renderCielo, subtitle: "Tus medallas en el cielo, a pantalla completa." },
  { id: "visita-casa", pie: true, lugar: true, label: "De visita", icon: "🏠", render: renderVisitaCasa, subtitle: "La casa del elefante de tu amigo." },
  { id: "visita-cielo", pie: true, lugar: true, label: "De visita", icon: "✨", render: renderVisitaCielo, subtitle: "Las medallas de tu amigo en su cielo." },
  { id: "apariencia", pie: true, label: "Apariencia", icon: "🎨", render: renderApariencia, subtitle: "Tu tema, tus títulos, tus marcos y tus efectos." },
  { id: "cuenta", pie: true, label: "Cuenta", icon: "🔐", render: renderCuenta, subtitle: "Tus datos, seguridad y sesión." },
  { id: "notif", pie: true, label: "Notificaciones", icon: "🔔", render: renderNotificaciones, subtitle: "Recordatorios de tu ritual (mañana y noche)." },
  { id: "tutoriales", pie: true, label: "Ayuda", icon: "🎓", render: renderTutoriales, subtitle: "Recorridos guiados para aprender Rumbo a tu ritmo." },
];
const ROUTE_MAP = {};
ROUTES.forEach(r => { if (r.id) ROUTE_MAP[r.id] = r; });
/* Módulos ocultos por la persona (settings.menu.ocultos) */
function moduloOculto(id) { const m = STATE && STATE.settings && STATE.settings.menu; return !!(m && (m.ocultos || []).includes(id) && ROUTE_MAP[id] && ROUTE_MAP[id].mas); }
/* Orden de secciones para el gesto de deslizar (mismo orden del menú, sin las ocultas) */
function seccionesVisibles() { return ROUTES.filter(r => r.id && !r.pie && !moduloOculto(r.id)).map(r => r.id); }

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
  initHojaMas();
  initArrastreVentana();
  window.addEventListener("online", () => { if (CURRENT_USER) scheduleCloudSave(); });
  // Al volver a la app (cambiar de pestaña/ventana o enfocar), traer lo último de la nube;
  // al ocultarla/cerrarla, subir de inmediato lo pendiente (no perder el cierre recién hecho).
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushCloudSave(); else { syncFromCloud(); gcalAlIniciar(); retomarEnfoque(); } });
  window.addEventListener("focus", () => syncFromCloud());
  window.addEventListener("pagehide", () => flushCloudSave());
  window.addEventListener("hashchange", onRoute);
  document.getElementById("authScreen").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); (document.getElementById("form-register").hidden ? doLogin : doRegister)(); }
  });

  // Si Google devolvió un error al iniciar sesión (p. ej. se canceló), mostrarlo en la pantalla de acceso
  const vuelta = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
  const errGoogle = vuelta.get("error_description") || vuelta.get("error");
  const user = await BACKEND.getSession();
  if (user) {
    const deVincular = /(^|&)vincular=1/.test(location.search.slice(1));
    await enterApp(user);
    // Al volver de vincular Google: quedarse en Cuenta y avisar si falló (p. ej. ese Google ya tiene otra cuenta)
    if (deVincular || errGoogle) {
      history.replaceState(null, "", location.pathname + "#cuenta"); onRoute();
      if (errGoogle) toast(_traducirVinculo(errGoogle), true);
      else toast("🔗 Listo: ahora puedes entrar también con Google");
    }
  } else {
    showAuth();
    if (errGoogle) { authError(vuelta.get("error") === "access_denied" || /denied|cancel/i.test(errGoogle) ? "Se canceló el inicio de sesión con Google." : "Google: " + errGoogle); history.replaceState(null, "", location.pathname); }
  }
}

function showAuth() {
  applyTheme(DEFAULT_THEME);   // la pantalla de acceso también sigue el modo del teléfono
  document.getElementById("app").hidden = true;
  document.getElementById("authScreen").hidden = false;
  quitarSplash();
  // "Continuar con Google" solo si está activo en Supabase
  const g = document.getElementById("auth-google");
  if (g && BACKEND.googleDisponible) BACKEND.googleDisponible().then(ok => { g.hidden = !ok; });
  // Quien llega desde la página de presentación (?crear=1) ve directo "Crear cuenta"
  if (/(^|&)crear=1/.test(location.search.slice(1))) switchAuthTab("register");
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
  quitarSplash();
  retomarEnfoque();       // ⏱️ sesión de enfoque en curso en este equipo
  if (!gcalRetorno()) gcalAlIniciar();   // Google Calendar: al volver de Google (iPhone) o al día si el permiso sigue vigente
  revisarDispositivoPush();              // 🔔 ¿este dispositivo sigue activado para esta cuenta?
  if (!STATE.settings.onboarded) setTimeout(() => openOnboarding("nuevo"), 350);
  else if (amigosHayInvitacion()) { /* la invitación de un amigo va primero; las novedades, la próxima vez */ }
  else if ((STATE.settings.introVersion || 1) < INTRO_VERSION) setTimeout(openNovedades, 450);
  else if (debeElegirElefante()) setTimeout(openElegirElefante, 600);
  procesarAtajo();
  amigosAlEntrar();                      // 🤝 la invitación que traías (?amigo=) y lo nuevo de tus amigos
  setTimeout(albumSubirPendientes, 1500); // 📷 las fotos del álbum que quedaron sin subir
}
/* La pantalla de carga (index.html) se va cuando ya se ve la app o el acceso */
function quitarSplash() {
  const s = document.getElementById("splash");
  if (!s) return;
  s.classList.add("is-fuera");
  setTimeout(() => s.remove(), 300);
}
/* Atajos del ícono (mantener presionado el ícono de Rumbo): ?atajo=abrir | tarea | cerrar.
   La bienvenida, las novedades y la elección del elefante van primero. */
function procesarAtajo() {
  const a = new URLSearchParams(location.search).get("atajo");
  if (!a) return;
  history.replaceState(null, "", location.pathname + location.hash);   // que recargar no lo repita
  if (!STATE.settings.onboarded || (STATE.settings.introVersion || 1) < INTRO_VERSION || debeElegirElefante()) return;
  setTimeout(() => {
    if (a === "abrir") {
      if (dayState() === "por-abrir") openRitualModal({ foco: "r-mision" }); else toast("Ya abriste tu día ✓");
    } else if (a === "cerrar") {
      const iso = puedeCerrarDia(todayISO()) ? todayISO() : pendingCierreDate();
      if (dayState() === "cerrado" && iso === todayISO()) toast("Tu día ya está cerrado ✓");
      else if (iso) openCierreModal(iso);
      else toast("Primero abre tu día 🌅", true);
    } else if (a === "tarea") openNuevaTarea();
  }, 400);
}

/* -------- Introducción (recorrido) para usuarios nuevos; se puede volver a ver -------- */
const INTRO_VERSION = 54;          // sube cuando haya novedades que mostrar a usuarios existentes (ver NOVEDADES)
let ONB_STEP = 0;
let ONB_MODE = "nuevo";           // nuevo (termina en el formulario) | repetir (termina en "Listo")
let ONB_ACTIVE = false;
const ONB_SLIDES = [
  { icon: "👋", titulo: "Bienvenido a Rumbo",
    cuerpo: "Tu vida en un solo lugar: un centro de control personal para tu día, tus hábitos, tus objetivos, tus finanzas y tu bienestar. Simple, privado y sincronizado entre tus dispositivos." },
  { icon: "🌅", titulo: "El ritual diario",
    cuerpo: `<b>Abre tu día</b> en la mañana: tu enfoque, tus tareas y tu <b>${BOCADO.corto.toLowerCase()}</b> ${BOCADO.emoji}, la tarea más importante (<i>¿cómo te comes un elefante? Un bocado a la vez</i>). De noche, <b>ciérralo</b>: decide qué pasa con lo pendiente y reflexiona.<br><br>La idea es usar la app lo <i>menos</i> posible: abrir y cerrar mantiene vivo todo tu sistema.` },
  { icon: "🧭", titulo: "Todo en un lugar", cuerpo: "__GRID__" },
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
  const eraNovedades = NOVEDADES_ABIERTAS;
  NOVEDADES_ABIERTAS = false;
  ONB_ACTIVE = false;
  if ((STATE.settings.introVersion || 0) < INTRO_VERSION) { STATE.settings.introVersion = INTRO_VERSION; saveState(); }
  closeModal();
  if (eraNovedades && debeElegirElefante()) setTimeout(openElegirElefante, 350);   // 🐘 primera vez: Clásico o Asiático
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
        <div class="onb-grid">${areas.map(a => `<div class="onb-area"><span>${a[0]}</span>${a[1]}</div>`).join("")}</div>
        ${ONB_MODE === "nuevo" ? `<p class="text-sm muted mt-16">Al terminar te muestro la app con un recorrido guiado 🧭</p>` : ""}`;
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
  7: [
    ["🧭", "Revisión trimestral", "Cada 3 meses cierras el trimestre (tus metas, tus números, lo aprendido) y abres el siguiente con su foco y de 3 a 5 metas. +200 ⭐ cada parte. En Ritual → Trimestre."],
  ],
  8: [
    ["📤", "Comparte tu mes", "Una imagen con tus números del mes (días cerrados, primeros bocados, objetivos, tareas) lista para tus historias. Tú eliges qué mostrar; el ahorro va oculto. En Ritual → Mes."],
  ],
  9: [
    ["🎓", "Tutorial interactivo", "Un recorrido guiado sobre tu propia app, ayuda en cada pantalla (botón ? arriba) y todos los recorridos en el menú → 🎓 Tutoriales."],
  ],
  10: [
    ["📆", "Google Calendar", "Conecta tu Google Calendar y ve tus reuniones junto a tus tareas: en Inicio, en Semana, en Calendario y al abrir tu día. Solo lectura: Rumbo nunca cambia nada en tu calendario. En Calendario → Conectar."],
  ],
  11: [
    ["🛒", "Tienda nueva", "Tus ⭐ ahora valen mucho más: funciones nuevas, temas, cosméticos y accesorios para tu elefante."],
    ["✏️", "Reabrir un día", "Corrige un día ya cerrado de la última semana: tu ánimo, tus notas o lo que decidiste con tus pendientes."],
    ["⏱️", "Modo enfoque y más", "Temporizador ligado a tu primer bocado, pronóstico de la semana, comparar meses, informe del año, plantillas de rutina y aviso de mediodía."],
    ["🎨", "6 temas nuevos", "Atardecer, Océano, Cuaderno, Terminal, Sakura y Alto contraste (gratis, para leer mejor). Además: celebraciones, checks, sonidos y marcos para tu avatar."],
    ["🐘", "Tu elefante e insignias con niveles", "Un elefante que crece con tu constancia, 16 insignias nuevas (algunas secretas) y series de bronce, plata y oro."],
  ],
  12: [
    ["🐘", "Elige tu elefante", "Tu elefante ahora es un dibujo propio que cambia en cada etapa, de cría a sabio. Elige entre el Clásico y el Asiático."],
    ["🔓", "Cuatro elefantes para ganar", "Mamut, Peluche, Geométrico y Tinta se desbloquean con tu constancia. Mira cuánto te falta en Recompensas → Tu elefante."],
    ["👕", "Ropa para tu elefante", "15 prendas en 6 espacios, con un probador para verlas puestas antes de comprarlas. Los accesorios que ya tenías siguen siendo tuyos."],
  ],
  13: [
    ["🎭", "Avatares", "Deja de ser una letra: elige un avatar en Cuenta → Tu avatar, o tocando tu inicial."],
    ["🏢", "El elenco de BiPlot HQ", "Lupe, Celda, Grilla, Faro y el resto de la oficina se ganan con un logro de su oficio. Plotty y Atlas te esperan desde hoy."],
    ["✏️", "Arma el tuyo", "Piel, peinado, lentes, barba y ropa, con el mismo trazo del elenco. También hay personajes de Rumbo como la Brújula, el Búho o tu propio elefante."],
  ],
  14: [
    ["☀️", "El botón del día", "En el celular, al centro de la barra de abajo: abre tu día en la mañana y ciérralo en la noche. En el computador está arriba del menú."],
    ["🧭", "Más, a mano", "Objetivos, Ritual, tus módulos, Recompensas, tu cuenta y la ayuda, en una hoja que se abre desde Más."],
    ["🏆", "Recompensas en un lugar", "Tu progreso, la Tienda (con categorías) y tus insignias, en tres pestañas."],
    ["👆", "Más fácil de usar", "Botones más grandes, tu elefante junto al saludo, hábitos de un toque y la semana con hoy primero."],
  ],
  15: [
    ["📔", "Diario con mapa del ánimo", "Tu mes como una grilla de colores según cómo te sentiste, y cada día en una línea que se abre al tocarla. Con buscador."],
    ["🗓️", "Calendario ordenado", "Siete columnas iguales en el celular y en el computador. Toca un día y ves su agenda."],
    ["💪", "Salud renovada", "Resumen con tu peso, un recetario y Entrenar con ejercicios reales, series y peso. Entrenamiento ahora vive aquí."],
    ["📝", "Notas como post-its", "Escribe arriba, ordena con #etiquetas, fija las importantes y pasa una nota a tarea con un toque."],
    ["🛒", "Tienda más simple", "Fichas chicas con ícono y precio. Toca una para ver qué hace y comprarla."],
  ],
  16: [
    ["🔔", "Notificaciones a tu medida", "Elige qué avisos recibir: lo esencial, lo recomendado o todo, o cada uno por separado. Llegan avisos nuevos: segundo aviso de cierre, días sin cerrar, hábitos pendientes, cumpleaños y contactos."],
    ["📲", "Vuelve a activarlas", "Renovamos cómo llegan los avisos para que sean puntuales. Entra a 🔔 Notificaciones y toca Activar en cada teléfono donde quieras recibirlos."],
    ["☀️", "Mediodía, gratis", "El aviso de mediodía ya no se compra en la Tienda. Si lo habías comprado, te devolvimos las ⭐."],
  ],
  17: [
    ["🎨", "Colores de BiPlot", "Navy y Claro estrenan los colores de la marca: azul profundo, acento cian y grises con un toque azul. En Claro, las barras ahora van en azul."],
    ["🎯", "Un solo botón coral", "Cada pantalla destaca en coral solo lo más importante: abrir o cerrar tu día cuando toca. Lo demás queda con borde."],
  ],
  18: [
    ["🖤", "Nuevo diseño: Ruta", "Rumbo estrena su diseño: blanco, negro y un solo acento coral, letras grandes y una acción clara a la vez."],
    ["📍", "Tu día como un recorrido", "En Inicio, tu misión va arriba como un destino y tu día en tres paradas: abres, das tu primer bocado y cierras. Una barra te muestra cuánto falta para tu hora de cierre."],
    ["🧾", "El recibo de tu día", "Al cerrar ves tu racha, tus horas y lo que ganaste, y puedes compartir la imagen de tu día en tus historias. ¿Borraste una tarea sin querer? Toca Deshacer."],
    ["🌙", "Ruta noche", "¿Prefieres oscuro? Ruta noche es gratis en Recompensas → Tienda → Temas. Si tenías otro tema elegido, lo conservas; Navy sigue disponible."],
  ],
  19: [
    ["🌗", "Tema automático", "Rumbo sigue el modo de tu teléfono: Ruta de día y Ruta noche de noche. ¿Lo quieres siempre claro u oscuro? Elige Ruta o Ruta noche en Recompensas → Tienda → Temas."],
    ["📲", "Atajos en el ícono", "Mantén presionado el ícono de Rumbo (Android y computador) para abrir tu día, agregar una tarea o cerrar tu día de una."],
  ],
  20: [
    ["🌌", "Tu cielo de insignias", "En Recompensas → Insignias cada insignia es una medalla en el cielo, y cada familia una constelación: La Copa, La Brújula, El Elefante, El Sol, La Columna y La Medalla. Enciéndelas una a una."],
    ["🏅", "Medallas de cerca", "Toca cualquier medalla, en el cielo o en la lista, para verla en 3D: gírala, dale vuelta y mira cuándo la ganaste o cuánto te falta."],
  ],
  21: [
    ["✨", "El momento de ganar", "Si al cerrar tu día ganas una medalla, llega girando, brilla y sube a su estrella en tu cielo. Si con ella completas una constelación, la figura se vuelve dorada."],
    ["🧾", "Medallas en tu recibo", "El recibo del día muestra las medallas que ganaste hoy o la que tienes más cerca y cuánto te falta. Tócalas para verlas de cerca."],
  ],
  22: [
    ["🏠", "La casa de tu elefante", "En Recompensas → Progreso tu elefante tiene su cuarto. Se llena con tu rango: una planta, un reloj, la biblioteca con los libros que terminaste… y la ventana sigue la hora del día."],
    ["🏅", "Tu repisa", "En su repisa tu elefante luce tus mejores medallas, o las que tú elijas en 🏅 Repisa. Tócalas para verlas de cerca."],
  ],
  23: [
    ["🧭", "Medallas en tus cierres", "Al cerrar un trimestre o el año ves las medallas que ganaste en ese tiempo."],
  ],
  24: [
    ["🛋️", "Decora el cuarto de tu elefante", "En la Tienda, la sección Cuarto trae un sillón, una lámpara, una pecera, un telescopio, un tocadiscos, un gato y más. Cada ficha te muestra cómo queda en su cuarto antes de comprarla."],
    ["🎨", "Paredes de colores", "Pinta el cuarto de salvia, durazno o azul noche. Lo que compras se puede guardar y volver a poner cuando quieras."],
  ],
  25: [
    ["🐘", "Tu elefante, en 3D", "Ahora vive en su cuarto en 3D, con su tipo, su etapa y la ropa que le pusiste. Tócalo: salta, saluda o le salen corazones."],
    ["⤢", "Tu cuarto a pantalla completa", "Toca el cuarto en Progreso y se abre de borde a borde. Arrastra para mirarlo, pellizca para acercarte y sube la hoja para ver su ficha y su repisa."],
  ],
  26: [
    ["✨", "Tu cielo a pantalla completa", "Toca el cielo en Insignias y llena la pantalla. Gíralo, pellizca para acercarte y elige una constelación en la hoja para ir hasta ella."],
  ],
  27: [
    ["🏠", "Tu casa y tu vitrina, en Inicio", "Dos botones bajo tu día: Tu casa te lleva directo a tu elefante y Tu vitrina a tus medallas, a pantalla completa. Tocar a tu elefante del día también te lleva a su casa."],
    ["🐘", "Tu elefante vive su día", "Camina por su casa y hace de todo: mira por la ventana, admira sus medallas, duerme la siesta y, con lo que le compres, riega la planta, baila o le hace cariño al gato."],
  ],
  28: [
    ["✏️", "Íconos de línea", "Hábitos, Tendencias y los packs de íconos de la Tienda usan íconos de línea, sobrios como los del menú."],
    ["📊", "Gráficos con sus datos", "En Tendencias, cada barra y cada punto muestran su valor."],
    ["✨", "Tu vitrina, con aire", "Las constelaciones y la repisa de tu casa están ordenadas: ninguna medalla tapa a otra."],
    ["🐘", "Tu elefante, despierto", "Si no cierras tu día anda con sueño, pero solo duerme cuando toma su siesta."],
  ],
  29: [
    ["🧭", "Norte, el tema de Rumbo", "Una aguja ámbar marca lo que sigue (abrir o cerrar tu día, tu racha, tus monedas) sobre tinta índigo. De día es la luz de la mañana; de noche, el mismo cielo de tu vitrina."],
    ["🌗", "Automático, ahora con Norte", "Rumbo sigue el modo de tu teléfono: Norte de día y Norte noche de noche. ¿Lo quieres fijo? Elige Norte o Norte noche en Recompensas → Tienda → Temas. Ruta y Ruta noche siguen ahí."],
    ["🎨", "Adiós a Navy y Claro", "Si usabas Navy ahora tienes Norte noche, y si usabas Claro, Norte: el mismo modo que tenías."],
  ],
  30: [
    ["🎨", "Menos temas, mejores", "Grafito y Medianoche dejan la Tienda: se parecían a Ruta noche y a Norte noche, que son gratis. Si los compraste, te devolvimos tus estrellas, y si los usabas ahora tienes su gemelo gratis."],
    ["🕘", "La hora se lee en todos los temas", "En el celular, Bosque Claro, Cuaderno y Sakura llevan la barra de arriba en su tinta oscura, para que la hora del iPhone no desaparezca."],
  ],
  31: [
    ["🌗", "Ruta y Bosque, también automáticos", "Como Norte, ahora siguen el modo de tu teléfono: Ruta automático es gratis y Bosque automático se activa cuando tienes Bosque Claro y Bosque Oscuro. Están en Recompensas → Tienda → Temas."],
    ["🔄", "Rumbo se actualiza solo", "Cuando sale una versión nueva, la app se recarga al abrirla. Si la estás usando, te avisa para que actualices cuando quieras."],
  ],
  32: [
    ["📲", "Arriba, sin difuminado", "En el iPhone, la hora ahora va en una barra sólida del color de tu tema, sin el difuminado de iOS 26. Si ya tenías Rumbo en tu pantalla de inicio, bórralo y agrégalo de nuevo desde Safari para estrenarla."],
  ],
  33: [
    ["🐘", "Tu casa y Tu vitrina, arriba", "La cara de tu elefante y la estrella con tus medallas están en la barra de arriba, en todas las pantallas. Una «z» si duerme la siesta y un punto si ganaste una medalla."],
    ["🏆", "Recompensas, más simple", "Tu rango arriba y la Tienda abajo, en dos secciones: Para tu día y Para tu estilo. Solo ves lo que puedes comprar; la ropa y los muebles de tu elefante se compran en Tu casa."],
    ["🎨", "Apariencia", "Lo que ya tienes se elige en Cuenta › Apariencia: tu tema (de día, de noche o automático), títulos, marcos y efectos."],
    ["✨", "Tus medallas, en el cielo", "Tu vitrina es el único lugar de tus medallas: la lista está en su hoja y cada una se abre de cerca. «Poner en tu repisa» reemplaza a Destacar."],
    ["🌲", "Bosque, una sola compra", "Trae día y noche por 900 ⭐. Si tenías uno de los dos, ya tienes los dos; si compraste los dos, te devolvimos 300 ⭐."],
  ],
  34: [
    ["🐾", "La manada", "Los avatares ahora son los amigos de tu elefante. Zorra, Castor, Hormiga, Abeja, Camaleón, Tortuga, Tamandúa, Llama y Ardilla se ganan con los mismos logros de antes, y el Cóndor y el Pudú vienen de regalo. Si ya ganaste uno, lo conservas."],
    ["🎭", "Tus avatares, al estilo de Rumbo", "Todos son planos y con los colores de Norte. Al que armas tú ahora le eliges el fondo, y «Tu elefante» muestra su cara completa."],
    ["🔵", "Marcos al día", "El marco Cian ahora es Índigo, y Aurora toma los colores de Norte."],
  ],
  35: [
    ["🧭", "Íconos Norte", "Toda la app habla un solo idioma: los emojis de los títulos, las pestañas, los botones y los avisos pasan a íconos de línea, con el mismo trazo del menú y los colores de Norte."],
    ["⭐", "La estrella de tus monedas", "Tus estrellas ahora son una estrella ámbar dibujada, igual en todos los teléfonos."],
    ["🍪", "El bocado del logo", "Tu primer bocado lleva la galleta mordida de Rumbo, y todo lo de tu elefante, su silueta de perfil."],
    ["✏️", "Lo tuyo no cambia", "Lo que escribes o eliges tú (tus recetas, tus listas, tus notas y tu diario) sigue con sus emojis."],
  ],
  36: [
    ["🤝", "Amigos", "Invita a tus amigos con tu enlace o tu código, mira cómo va su día y mándales ánimo. Está en el menú, debajo de Diario."],
    ["👀", "Tú eliges qué ven", "Siempre tu nombre y tu avatar; si quieres, también si abriste y cerraste tu día, tu racha y tu rango. Tus tareas, tu diario y tus finanzas nunca se muestran."],
    ["🔔", "Avisos de tus amigos", "Te llega un aviso cuando te mandan ánimo, te piden amistad o aceptan la tuya. Nunca de noche, y se apaga en Notificaciones."],
  ],
  37: [
    ["🤝", "Hábitos en conjunto", "Crea un hábito con uno o más amigos: al hacer uno nuevo, elige con quién. Cada uno lo marca en su Rumbo y ven quién ya cumplió hoy."],
    ["🔥", "Racha de a dos", "Sube cada vez que cumplen todos, y el día que lo hacen todos, +5 ⭐ para cada uno. Lo ves en Inicio, en Hábitos y en Amigos."],
    ["🔔", "Avisos para hacerlo juntos", "Te avisamos cuando te invitan, cuando un amigo ya lo hizo hoy y cuando lo cumplen todos. Si sales del hábito, se queda contigo con tu historial."],
  ],
  38: [
    ["🎯", "Objetivos en conjunto", "En Objetivos, crea una meta con tus amigos: juntar para un viaje, correr 100 km en el mes o leer 12 libros entre todos. Cada uno suma sus aportes."],
    ["📊", "La barra de todos", "Ves cuánto llevan, lo que puso cada uno con su color y cuántos días quedan. Te avisamos cuando alguien aporta y cuando lo logran."],
    ["🏅", "Medalla En Equipo", "Al lograr un objetivo juntos, +20 ⭐ para cada uno; la primera vez, además, la medalla En Equipo en el centro de La Medalla de tu vitrina."],
  ],
  39: [
    ["🏠", "De visita en su casa", "En el perfil de un amigo, toca «Visitar su casa»: ves a su elefante en su cuarto, en 3D, con lo que tiene y su repisa. Lo puedes tocar, pero no cambiar nada."],
    ["✨", "Su vitrina", "«Ver su vitrina» abre sus medallas en su cielo. Toca una para ver cuándo la ganó y si tú también la tienes."],
    ["👀", "Tú decides", "Tus amigos pueden visitar tu casa y tu vitrina. Si prefieres que no, apágalo en Amigos › Lo que muestras."],
  ],
  40: [
    ["🎟️", "Planes con amigos", "En Amigos › Planes, propón algo para juntarse: ver una película, ir a comer, salir a correr. Eliges cuándo, dónde y a quiénes invitas."],
    ["🗳️", "¿Cuándo pueden?", "Si no saben qué día, propón de 2 a 4 fechas: cada uno marca las que le sirven y tú eliges la que queda."],
    ["📅", "En tu agenda", "Si vas, el plan aparece en tu Semana, tu Calendario y en Inicio ese día. Tus amigos ven el plan, no tu agenda."],
  ],
  41: [
    ["📋", "Listas con amigos", "En Listas, crea una lista con tus amigos: películas por ver, restaurantes por probar o lugares para un viaje. Todos agregan."],
    ["👍", "Yo también y estrellas", "Dale +1 a lo que también quieres, marca lo que ya hicieron y ponle de 1 a 5 estrellas. Lo que más quieren queda arriba."],
    ["🎟️", "De la lista a un plan", "Toca el boleto junto a cualquier cosa de la lista: se abre un plan nuevo con eso y con la gente de la lista."],
  ],
  42: [
    ["📔", "¿Cómo estuvo?", "Después de un plan, ponle estrellas y una frase: queda en tu diario y ganas +10 ⭐. Si quieres, la ven los que fueron."],
    ["🧾", "La cuenta del plan", "Anota quién pagó qué y Rumbo calcula cuánto le debe cada uno. Cuando pagues, márcalo: «Ya le pagué»."],
    ["💰", "Tu parte, a Finanzas", "Con un toque, lo que te tocó se suma al gasto de ese mes en Finanzas."],
  ],
  43: [
    ["🎟️", "¿Quién se suma?", "Al proponer un plan, márcalo abierto a todos tus amigos: «Salgo a correr a las 19:00». El que pueda, se suma solo."],
    ["🎂", "Cumpleaños de tus amigos", "Si lo comparten, te avisamos el día de su cumpleaños para saludarlos. El tuyo, solo si quieres: Amigos › Lo que muestras."],
    ["📖", "Leer el mismo libro", "En Lecturas, abre un libro y toca «Leerlo con un amigo». Cada uno a su ritmo: ven en qué página va cada uno."],
  ],
  44: [
    ["🤝", "Amigos, en una pantalla", "Arriba, lo que espera tu respuesta: invitaciones, votar una fecha, solicitudes y lo que debes. Se responde ahí mismo, y el punto de Amigos dice cuántas cosas son."],
    ["📅", "Tu semana con amigos", "Tus planes y los cumpleaños de tus amigos de los próximos días, en una línea. Más abajo, una baldosa por cada cosa que hacen juntos: tócala y se abre."],
    ["⚙️", "Un solo «+ Nuevo»", "Para crear un plan, un hábito, un objetivo, una lista o una lectura con amigos. Invitar, tu código y lo que muestras están en el engranaje."],
  ],
  45: [
    ["📷", "Tu álbum del mes", "Al cerrar el mes, un paso nuevo: hasta 9 fotos de los mejores momentos, con una línea para cada una. La primera vez con 3 fotos comentadas, +30 ⭐."],
    ["📔", "Tus álbumes, en el Diario", "Cada mes muestra su álbum bajo el mapa del ánimo, y «Tus álbumes» arma la estantería del año con la portada de cada mes."],
    ["🖼️", "Estilos de álbum", "En la Tienda, «Tu álbum»: Bullet journal, Polaroid y Película. Se compran una vez y cada mes elige el suyo. Clásico viene incluido."],
  ],
  46: [
    ["📷", "Acomoda tus fotos", "En el álbum, toca una foto: pellizca para acercarla y arrástrala para elegir qué parte se ve en el marco. Así queda en las páginas, la estantería y el Diario."],
  ],
  47: [
    ["📷", "Tus notas, enteras", "Las páginas del álbum crecen lo que haga falta: en el Clásico ya se ven las notas de las fotos de abajo, y en todos los estilos cada comentario se lee completo."],
    ["🎆", "4 estilos de álbum nuevos", "Scrapbook, Postales, Revista y Noche estrellada (con estrellas que brillan). Están en la Tienda › Tu álbum."],
  ],
  48: [
    ["📤", "Comparte tu álbum", "En el álbum, toca «Compartir»: cada página se vuelve una imagen, como publicación (el carrusel de Instagram) o como historia, y la mandas por Instagram, WhatsApp o donde quieras. Se arma en tu teléfono y solo sale si tú la compartes."],
  ],
  49: [
    ["💧", "Agua para todos", "En Inicio, «Agua de hoy»: toca «+ Vaso» y mira cómo se llena. Tu meta sale de tu peso en Salud (o la eliges tú), el hábito «Agua» se marca solo y cumplirla da +10 ⭐."],
    ["🛍", "Estilos para tu agua", "La burbuja, la cantimplora, la bombilla y el reloj de agua, y sabores que cambian el color del agua. Están en la Tienda › Para tu estilo › Tu agua."],
  ],
  50: [
    ["💧", "Tu agua, a un toque", "Abajo a la derecha está tu botón de agua, en cualquier pantalla. Tócalo: se abre tu estilo en una ventana redonda y tocarlo es tomar un vaso. Si no lo quieres, se apaga en «Tu agua»."],
    ["☀️", "La meta sigue al calor", "En «Tu agua», elige tu ciudad: los días sobre 28 °C tu meta sube medio litro, y sobre 32 °C, un litro. Rumbo usa solo la ciudad que eliges, no tu ubicación."],
    ["🐘", "Estilos nuevos para tu agua", "El día de calor, la esclusa con su barquito y tu elefante, que en 3D riega su planta con cada vaso. Y el acuario del mes: un pez por cada día que cumples, en Salud y en tu cierre de mes."],
  ],
  51: [
    ["🐷", "Tus alcancías", "En Finanzas, cada cosa por la que ahorras tiene su alcancía: ponle nombre y meta, toca «+» cuando guardes y mira caer las monedas. El chanchito de greda de Pomaire viene con Rumbo: al llenarlo, se rompe con un mazo."],
    ["🪙", "La torre del año", "Arriba en Finanzas, tus meses en pilas de monedas (ingreso menos gasto), con la línea de tu meta del mes. Toca un mes para ver cuánto guardaste."],
    ["⭐", "Ahorrar se premia", "Llenar una alcancía da +50 ⭐ y la medalla «Primera alcancía»; guardar algo cada semana durante 4 semanas, +20 ⭐. Y al cerrar el mes, repartes lo que ahorraste entre tus alcancías con un toque."],
    ["🛍", "Más alcancías en la Tienda", "El elefante de la suerte, que se baña en oro; el elefante de greda; el chanchito de vidrio, el frasco, la caja fuerte y el viaje. Y monedas de plata, cobre y estrella. Con «Ocultar montos» se ven solo los porcentajes."],
  ],
  52: [
    ["💎", "Tus deseos, en Finanzas", "Anota lo que te gustaría comprarte, con su precio. Después de 7 días (30 si es caro) Rumbo te pregunta si todavía lo quieres; si sí, «Ahorrar para esto» le arma su alcancía, y «Lo compré» rompe el chanchito y anota cuánto pagaste."],
    ["🌱", "Lo que no gastaste", "Si ya no lo quieres, suéltalo: su precio suma a «Lo que no gastaste este año». Tus listas de deseos de antes se mudaron solas a Finanzas."],
    ["🐷", "Mis caprichos", "Para los deseos chicos, una sola alcancía en orden: marca cuál ya te alcanza. Usa «A mis caprichos» en cualquier deseo."],
  ],
  53: [
    ["🌱", "Tu jardín, en Hábitos e Inicio", "Tres macetas para los hábitos que estás formando: cada planta crece con sus días cumplidos. Si tienes más de tres, eliges cuáles; el jardín premia la constancia, no la cantidad."],
    ["🌳", "Echar raíces", "A los 66 días cumplidos, tu elefante trasplanta el hábito al patio como árbol y su maceta queda libre. Si lo dejas, el árbol pierde las hojas hasta que vuelves; nunca se pierde."],
    ["☀️", "El cielo de tu semana", "El cielo es lo que cumpliste esta semana: sol y mariposas o nublado. Da lo mismo cuántos hábitos tengas. Y cuando marcas un hábito, tu elefante riega su maceta."],
    ["🪟", "Cuatro estilos en la Tienda", "La entrada viene con Rumbo; la ventana, en píxeles, el terrario y el sur, en Recompensas › Tienda › Tu jardín."],
  ],
  54: [
    ["🚀", "Tu jardín en el espacio", "Dos temas especiales en la Tienda: Marte y la base lunar, a 1.200 ⭐ cada uno. Tus macetas en un invernadero y cada árbol en su cúpula."],
    ["🌍", "Lo que construyes se queda", "En Marte, tus raíces vuelven verde la arena (con 4 árboles aparece una laguna). En la Luna, cada hábito con raíces enciende un continente de la Tierra."],
    ["👽", "Tu elefante astronauta y Menta", "Tu elefante baja de vez en cuando su visor de cristal negro y lo sube para regar. Menta, el alienígena, se pasea entre tus cúpulas y salta cuando riegas."],
  ],
};
let NOVEDADES_ABIERTAS = false;
function openNovedades() {
  NOVEDADES_ABIERTAS = true;
  const desde = STATE.settings.introVersion || 1;
  const versiones = Object.keys(NOVEDADES).map(Number).filter(v => v > desde && v <= INTRO_VERSION).sort((a, b) => b - a);
  const lista = items => `<div class="novedades">${items.map(([ic, t, d]) => `<div class="novedad"><span class="novedad__ico">${ic}</span>
      <div><div class="novedad__t">${escapeHtml(t)}</div><div class="text-sm muted">${escapeHtml(d)}</div></div></div>`).join("")}</div>`;
  const cuerpo = versiones.map((v, i) => (i ? `<div class="divider"></div><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">También llegó antes</div>` : "") + lista(NOVEDADES[v])).join("");
  ONB_ACTIVE = false;
  // Se marcan como vistas apenas se muestran: cerrarlas con ✕, tocando fuera o deslizando
  // también cuenta (antes solo "Ahora no" las marcaba y volvían a salir en cada recarga).
  STATE.settings.introVersion = INTRO_VERSION; saveState();
  openModal("✨ Novedades de Rumbo", `
    ${cuerpo}
    <div class="onb-nav mt-16">
      <button class="btn-ghost" data-action="onb-done">Ahora no</button>
      <button class="btn btn--primary" data-action="tour-start" data-id="general">🎓 Hacer el recorrido</button>
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
  if (amigosHayInvitacion()) setTimeout(amigosAlEntrar, 400);   // 🤝 llegó con la invitación de un amigo: va primero
  else setTimeout(() => tourIniciar("general"), 400);   // recorrido guiado sobre la app real
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
  const avatar = typeof avatarActualHtml === "function" ? avatarActualHtml(initial) : initial;
  const marco = typeof marcoClase === "function" ? marcoClase() : "";
  box.innerHTML = iconizar(`<div class="account__avatar${marco}" data-action="av-abrir" title="Tu avatar">${avatar}</div>
    <div class="account__info" data-action="cuenta-menu" style="min-width:0;flex:1"><div class="account__name">${escapeHtml(CURRENT_USER.name || "")}</div>
    <div class="account__email">Cuenta, avisos y ayuda</div></div>`);
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
async function doLoginGoogle() {
  authError("");
  const res = await BACKEND.loginGoogle();   // si todo va bien, la página se va a Google
  if (res && res.error) authError(res.error);
}
async function doForgot() {
  const email = val("log-email");
  if (!email) return authError("Escribe tu correo arriba y vuelve a tocar el enlace.");
  await BACKEND.resetPassword(email);
  authError(""); toast("Si existe la cuenta te llegará un correo (se activa con Supabase).");
}
async function doLogout() {
  await soltarDispositivoPush();   // 🔔 este dispositivo deja de recibir los avisos de quien sale
  await BACKEND.logout();
  CURRENT_USER = null; STATE = null; location.hash = "";
  amigosOlvidar();   // lo de tus amigos en memoria no queda para quien entre después
  albumOlvidar();    // ni las direcciones de las fotos del álbum
  authError(""); showAuth();
}

/* -------- Navegación -------- */
/* Menú lateral (computador): lo principal arriba, los módulos en un grupo plegable.
   Recompensas y la cuenta viven en el pie (ver navegacion.js). */
function buildNav() {
  const nav = document.getElementById("nav");
  // Íconos de línea (los mismos de la barra inferior); el emoji queda solo si una sección no tiene dibujo
  const item = r => `<button class="nav__item" data-route="${r.id}"><span class="nav__ico">${ICONOS_LINEA[r.id] ? iconoLinea(r.id, 20) : r.icon}</span><span>${r.label}</span></button>`;
  const principal = ROUTES.filter(r => r.id && !r.mas && !r.pie);
  const mods = ROUTES.filter(r => r.id && r.mas && !moduloOculto(r.id));
  let abierto = true;
  try { abierto = localStorage.getItem("rumbo-nav-modulos") !== "0"; } catch (e) {}
  nav.innerHTML = principal.map(item).join("")
    + `<details class="nav-mods" id="navMods"${abierto ? " open" : ""}><summary class="nav__label nav-mods__sum">Módulos (${mods.length})${iconoLinea("chevron", 16)}</summary>
      ${mods.map(item).join("")}
      <button class="nav__item nav__item--sub" data-action="menu-personalizar"><span class="nav__ico">${iconoLinea("personalizar", 20)}</span><span>Personalizar menú</span></button></details>`;
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  const det = document.getElementById("navMods");
  det.addEventListener("toggle", () => { try { localStorage.setItem("rumbo-nav-modulos", det.open ? "1" : "0"); } catch (e) {} });
  document.getElementById("brandName").innerHTML = `${STATE.settings.appName.replace("i","<em>i</em>")}`;
  buildBottomNav();
  pintarPieNav();
}

function onRoute() {
  if (!CURRENT_USER) return;
  let hash = location.hash.replace("#", "") || "inicio";
  // v95: la Tienda está en Recompensas y las insignias en Tu vitrina (los enlaces viejos siguen sirviendo)
  const VIEJAS = { tienda: "recompensas", insignias: "cielo" };
  if (VIEJAS[hash]) { hash = VIEJAS[hash]; history.replaceState(null, "", "#" + hash); }
  CURRENT = ROUTE_MAP[hash] ? hash : "inicio";
  // a pantalla completa: sin barras (lugar.js); sin 3D, el lugar es una página con sus barras
  document.body.classList.toggle("en-lugar", !!ROUTE_MAP[CURRENT].lugar && !CIELO_ESTADO.sin3d);
  cerrarMas(); cerrarMenuCuenta();
  updateTopbar();
  rerender();
  entrarVista();
  marcarNavActiva();
  setSidebar(false);
  document.querySelector(".main").scrollTo?.(0, 0);
  window.scrollTo(0, 0);
  tourAuto(CURRENT);   // ayuda la primera vez que entras a esta pantalla
}

function go(id) { location.hash = id; }

/* -------- Personalizar menú: ocultar módulos de "Más" (los datos no se tocan) -------- */
function openPersonalizarMenu() {
  setSidebar(false); cerrarMas();
  const ocultos = new Set(((STATE.settings.menu || {}).ocultos) || []);
  openModal("Personalizar menú", `
    <p class="text-sm muted" style="margin-bottom:12px">Elige qué módulos ver en el menú. Ocultar uno no borra nada: vuelve a mostrarlo cuando quieras y todo seguirá ahí.</p>
    ${ROUTES.filter(r => r.mas).map(r => `<label class="mes-hab" style="cursor:pointer"><span class="mes-hab__n">${r.icon} ${r.label}</span>
      <input type="checkbox" class="menu-mod" value="${r.id}" ${ocultos.has(r.id) ? "" : "checked"}></label>`).join("")}
    <p class="text-xs muted mt-8">Inicio, Semana, Hábitos, Objetivos, Ritual y Diario siempre se ven.</p>
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
    if (e.target.closest && e.target.closest("[data-swipe], [data-gesto]")) return;   // deslizar una tarea (o mirar el cielo) no cambia de sección
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
    if (isFormEl(e.target) || (e.target.closest && e.target.closest("[data-sin-arrastre]"))) return;   // p. ej., encuadrar una foto del álbum
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
  const view = document.getElementById("view");
  view.innerHTML = iconizar(route.render());
  unSoloCoral(view);
  mountAfterRender();
  updateFab();
}
/* Un solo botón coral por pantalla (manual de marca BiPlot: si todo es urgente, nada lo es).
   Manda lo que lleva data-coral="dia" (abrir o cerrar el día cuando toca); si no hay, el primer
   botón coral. Los demás quedan como botón con borde. Los modales no pasan por aquí: son su propia pantalla. */
function unSoloCoral(root) {
  const coral = [...root.querySelectorAll(".btn--primary")];
  const manda = root.querySelector('[data-coral="dia"]') || coral[0];
  coral.forEach(b => {
    if (b === manda || (manda && manda.contains(b))) return;
    b.classList.remove("btn--primary");
    b.classList.add("btn--borde");
  });
}

/* Botón del día: vive en la barra inferior (móvil) y arriba del menú (computador) */
function updateFab() { actualizarBotonDia(); if (typeof aguaFabActualizar === "function") aguaFabActualizar(); }   // y el botón de agua (agua.js)

function updateTopbar() {
  const route = ROUTE_MAP[CURRENT];
  document.getElementById("pageTitle").textContent = route.label;
  document.getElementById("pageSubtitle").textContent = route.subtitle || "";
  const ayuda = document.getElementById("helpBtn");
  if (ayuda) ayuda.hidden = !tourDePantalla(CURRENT);
  document.getElementById("todayPill").innerHTML = icoUI("semana") + " " + escapeHtml(fechaLarga());
  document.getElementById("streakVal").textContent = computeClosedStreak();
  pintarMonedas(STATE.gamif.puntos);
  if (typeof pintarPuertas === "function") pintarPuertas();
}

/* -------- Estado del día (ciclo apertura → cierre) -------- */
function dayState() {
  const r = STATE.ritual.dias[todayISO()];
  if (!r || !r.hecho) return "por-abrir";
  if (r.cerrado) return "cerrado";
  return new Date().getHours() >= 18 ? "por-cerrar" : "en-curso";
}
/* Holgura para cerrar: los días que olvidaste cerrar se pueden cerrar durante los
   DIAS_HOLGURA días siguientes (ayer, anteayer y el anterior). También si ese día no lo
   abriste pero sí lo usaste (tareas o hábitos marcados). Cerrarlo a tiempo mantiene la racha. */
const DIAS_HOLGURA = 3;
function huboActividadDia(iso) {
  try {
    if (tareasDelDia(iso).length) return true;
    return (STATE.habitos.defs || []).some(h => hmDone(h, iso, STATE));
  } catch (e) { return false; }
}
/* Días anteriores sin cerrar que todavía se pueden cerrar, del más antiguo al más reciente */
function pendingCierreDates() {
  const out = [];
  for (let b = DIAS_HOLGURA; b >= 1; b--) {
    const d = new Date(); d.setDate(d.getDate() - b);
    const iso = isoLocal(d), r = STATE.ritual.dias[iso];
    if (r && r.cerrado) continue;
    if ((r && r.hecho) || huboActividadDia(iso)) out.push(iso);
  }
  return out;
}
/* El más antiguo pendiente (o null): es el que conviene cerrar primero */
function pendingCierreDate() { return pendingCierreDates()[0] || null; }
/* ¿Se puede cerrar este día? (abierto, o dentro de la holgura aunque no se haya abierto) */
function puedeCerrarDia(iso) {
  const r = STATE.ritual.dias[iso];
  return !!(r && r.hecho) || pendingCierreDates().includes(iso);
}
/* Al guardar el cierre de un día que no se abrió, queda marcado como abierto sin apertura */
function diaParaCerrar(iso) {
  const r = STATE.ritual.dias[iso];
  if (r && r.hecho) return r;
  if (!pendingCierreDates().includes(iso)) return null;
  return (STATE.ritual.dias[iso] = Object.assign(r || {}, { hecho: true, sinApertura: true, ts: Date.now() }));
}
/* Destino de las pendientes al cerrar: si el día ya pasó, van a hoy (nunca a otro día pasado) */
function triageCierreCfg(iso) {
  const hoy = todayISO();
  return iso < hoy ? { mover: "hoy", min: agSumar(hoy, -1) } : { mover: "manana", min: agSumar(iso, 1) };
}
function renderPendingYesterday() {
  const dias = pendingCierreDates();
  if (!dias.length) return "";
  const hoy = todayISO();
  const fila = iso => {
    const d = new Date(iso + "T12:00:00"), r = STATE.ritual.dias[iso];
    const quedan = DIAS_HOLGURA - agDiff(iso, hoy) + 1;   // días que le quedan para cerrarse (contando hoy)
    const nombre = agSumar(iso, 1) === hoy ? "ayer" : d.toLocaleDateString("es-CL", { weekday: "long" });
    return `<div class="flex-between" style="flex-wrap:wrap;gap:10px;padding:8px 0">
      <div><b>${escapeHtml(d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }))}</b>
        <div class="text-xs muted">${r && r.hecho ? "Lo abriste y quedó sin cerrar" : "No lo abriste, pero puedes cerrarlo igual"} · ${quedan <= 1 ? "último día para cerrarlo" : `quedan ${quedan} días`}</div></div>
      <div class="row-wrap" style="gap:8px"><button class="btn btn--soft" data-action="day-close-express" data-date="${iso}">⚡ Express</button>
        <button class="btn btn--primary" data-action="day-close" data-date="${iso}">Cerrar ${escapeHtml(nombre)}</button></div></div>`;
  };
  return `<div class="card" style="margin-bottom:16px;border:1px solid var(--coral);background:var(--coral-soft)">
    <div class="card__title">🌙 ${dias.length === 1 ? "Te quedó un día por cerrar" : `Te quedaron ${dias.length} días por cerrar`}</div>
    <div class="text-sm soft mt-8">Tienes ${DIAS_HOLGURA} días de holgura para cerrar un día. Si lo cierras a tiempo, tu racha sigue.</div>
    ${dias.map(fila).join("")}</div>`;
}
function computeClosedStreak() {
  const now = new Date(); let s = 0;
  for (let b = 0; b < 366; b++) {
    const d = new Date(now); d.setDate(now.getDate() - b);
    const iso = isoLocal(d);
    const r = STATE.ritual.dias[iso];
    if (r && r.cerrado) s++;
    else if (b === 0 || diaCubierto(STATE, iso)) continue;   // hoy, o un día libre/protegido de antes de v61: no corta
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
  saveState(); refreshPts(delta > 0 && !silencioso ? delta : 0);
  if (delta > 0 && !silencioso && !monedasALaVista()) toast("+" + delta + " ⭐");
  return true;
}
function anularMovimiento(id) {
  if (ledgerAnular(STATE, id)) { saveState(); refreshPts(); }
}
function refreshPts(ganado) {
  pintarMonedas(STATE.gamif.puntos, ganado);
  pintarPieNav();
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
  else if (el.dataset.type === "dec") val = parseDecimal(val);
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
  if (a.startsWith("am-")) { amigosAccion(a, d, el); return; }   // 🤝 Amigos (amigos.js)
  if (a.startsWith("cj-")) { conjuntoAccion(a, d); return; }      // hábitos en conjunto (conjunto.js)
  if (a.startsWith("oj-")) { objetivosAccion(a, d); return; }     // objetivos en conjunto (objetivos.js)
  if (a.startsWith("vis-")) { visitaAccion(a, d); return; }        // de visita en la casa de un amigo (visitas.js)
  if (a.startsWith("pl-")) { planesAccion(a, d); return; }         // planes con amigos (planes.js)
  if (a.startsWith("lc-")) { listasCompAccion(a, d); return; }     // listas compartidas (listas-amigos.js)
  if (a.startsWith("lj-")) { lecturasAmigosAccion(a, d); return; } // leer el mismo libro (lecturas-amigos.js)
  if (a.startsWith("alb-")) { albumAccion(a, d); return; }         // 📷 álbum del mes (album.js)
  if (a.startsWith("agua-")) { aguaAccion(a, d, el); return; }     // 💧 agua para todos (agua.js)
  if (a.startsWith("alc-")) { alcAccion(a, d, el); return; }       // 🐷 tus alcancías (alcancias.js)
  if (a.startsWith("des-")) { deseosAccion(a, d); return; }        // 💎 tus deseos (deseos.js)
  if (a.startsWith("jar-")) { jardinAccion(a, d, el); return; }    // 🌱 tu jardín (jardin.js)

  switch (a) {
    case "close-modal": closeModal(); break;
    case "export": exportData(); break;
    case "open-menu": openMas(); break;
    case "mas-cerrar": cerrarMas(); break;
    case "cuenta-menu": toggleMenuCuenta(); break;
    case "info-racha": openInfoRachas(); break;
    case "compartir-dia": compartirDia(); break;

    /* Notificaciones */
    case "notif-enable": enableNotifications(); break;
    case "notif-disable": disableNotifications(); break;
    case "notif-times": saveNotifTimes(); break;
    case "notif-test": testNotification(); break;
    case "notif-aviso": cambiarAviso(d.k, el.checked); break;
    case "notif-nivel": elegirNivelAvisos(d.n); break;

    /* Portal de usuarios */
    case "auth-tab": switchAuthTab(d.tab); break;
    case "auth-login": doLogin(); break;
    case "auth-google": doLoginGoogle(); break;
    case "acc-vincular-google": vincularGoogle(); break;
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
      if ((STATE.habitos.defs.find(h => h.id === d.id) || {}).conjunto) { conjuntoEliminarHabito(STATE.habitos.defs.find(h => h.id === d.id)); break; }
      if (confirm("¿Eliminar este hábito y su historial?")) {
        STATE.habitos.defs = STATE.habitos.defs.filter(h => h.id !== d.id);
        saveState(); closeModal(); rerender();
      } break;
    case "habit-save": saveHabit(); break;
    case "habit-cell": toggleHabitCell(d.id, +d.day); break;
    case "habit-month": HABIT_MONTH = +d.m; rerender(); break;
    case "habit-view": HABIT_VIEW = d.v; rerender(); break;
    case "habit-layout": HABIT_LAYOUT = d.v; rerender(); break;
    case "tienda-ficha": openFicha(d.key); break;
    case "tienda-sec": TIENDA_SEC = d.v; rerender(); break;
    case "tienda-mas": TIENDA_ABIERTOS.add(d.v); rerender(); break;
    /* Salud: Resumen · Recetas · Entrenar */
    case "salud-tab": SALUD_TAB = d.v; if (CURRENT !== "salud") go("salud"); else rerender(); break;
    case "salud-peso": guardarPeso(); break;
    case "receta-filtro": RECETA_FILTRO = d.v; rerender(); break;
    case "receta-nueva": openRecetaForm(null); break;
    case "receta-ver": openReceta(d.id); break;
    case "receta-editar": openRecetaForm(d.id); break;
    case "receta-guardar": guardarReceta(); break;
    case "receta-fav": recetaFavorita(d.id); break;
    case "receta-borrar": recetaBorrar(d.id); break;
    case "rutina-ver": RUTINA_VER = d.id; rerender(); break;
    case "rutina-nueva": openRutina(null); break;
    case "rutina-editar": openRutina(d.id); break;
    case "rutina-guardar": guardarRutina(); break;
    case "rutina-borrar": borrarRutina(); break;
    case "ejercicio-toggle": ejercicioToggle(d.dia, d.id); break;
    case "ejercicio-nuevo": openEjercicio(d.dia, null); break;
    case "ejercicio-editar": openEjercicio(d.dia, d.id); break;
    case "ejercicio-guardar": guardarEjercicio(); break;
    case "ejercicio-borrar": borrarEjercicio(); break;
    case "entreno-terminar": terminarEntreno(d.dia); break;
    case "habit-vista":
      HABIT_VIEW = d.v === "mes" ? "mensual" : d.v === "anio" ? "anual" : "diario";
      if (d.v === "hoy" || d.v === "semana") HABIT_LAYOUT = d.v;
      rerender(); break;
    case "sem-col-add": {
      const col = el.closest(".week-col"); if (!col) break;
      col.classList.add("is-add"); const inp = col.querySelector("input.input"); if (inp) inp.focus(); break;
    }
    case "habit-today": toggleHabitToday(d.id); break;
    case "habit-daycell": toggleHabitDate(d.id, +d.y, +d.m, +d.d); break;

    /* Tienda · funciones */
    case "fun-buy": comprarFuncion(d.id); break;
    case "enfoque-open": openEnfoque(); break;
    case "enfoque-iniciar": iniciarEnfoque(); break;
    case "enfoque-pausa": pausarEnfoque(); break;
    case "enfoque-terminar": terminarEnfoque(false); break;
    case "enfoque-hecha": enfoqueTareaHecha(d.fecha, d.id); break;
    case "plantillas-open": openPlantillas(); break;
    case "plantilla-aplicar": aplicarPlantillaUI(d.id); break;
    case "informe-anio": openInformeAnio(+d.y); break;
    case "elefante-open": openElefante(d.v); break;
    case "ele-elegir": openElegirElefante(); break;
    case "ele-tipo": elegirTipoElefante(d.id); break;
    case "ele-probar": probarPrenda(d.id); break;
    case "ele-comprar": comprarPrenda(d.id); break;
    case "ele-quitar": quitarEspacio(d.slot); break;
    case "ele-espacio": espacioElefante(d.slot); break;
    case "ele-cancelar": cancelarPrueba(); break;
    case "ele-toca": tocarElefante(el); break;
    case "av-abrir": openAvatar(); break;
    case "av-tab": AV_PRUEBA = null; openAvatar(d.v); break;
    case "av-elegir": elegirAvatar(d.id); break;
    case "av-probar": probarAvatar(d.id); break;
    case "av-comprar": comprarAvatar(d.id); break;
    case "av-quitar": quitarAvatar(); break;
    case "av-propio": propioCambiar(d.k, d.v); break;

    /* Tienda · útiles (consumibles) */
    case "util-buy": comprarConsumibleUI(d.id); break;
    case "reabrir-dia": usarReabrir(d.iso); break;

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
    case "nota-crear": notaCrear(); break;
    case "nota-filtro": NOTA_FILTRO = d.v; rerender(); break;
    case "nota-abrir": notaAbrir(d.id); break;
    case "nota-guardar": notaGuardar(); break;
    case "nota-fijar": notaFijar(); break;
    case "nota-archivar": notaArchivar(); break;
    case "nota-borrar": notaBorrar(); break;
    case "nota-tarea": notaATarea(); break;
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
    case "cal-dia": CAL_DIA = d.date; rerender(); break;
    case "evento-save": saveEvento(); break;
    case "evento-del": {
      const arr = STATE.eventos[d.date] || []; arr.splice(+d.i, 1);
      if (!arr.length) delete STATE.eventos[d.date]; saveState(); rerender(); break;
    }

    /* Ciclo del día */
    case "day-open": openRitualModal(); break;
    case "aviso-reinstalar-ok": try { localStorage.setItem("rumbo-aviso-reinstalar", "1"); } catch (e) {} rerender(); break;
    case "mision-barra": openRitualModal({ foco: "r-mision" }); break;
    case "mision-reciente": openRitualModal({ mision: d.txt, foco: "r-sapo" }); break;
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
    case "informe-open": openInformeMes(d.key); break;
    case "informe-compartir": compartirInforme(); break;
    case "informe-descargar": descargarInforme(); break;
    case "tri-ritual": openTriRitual(d.cierre, d.apertura); break;
    case "tri-open": openTriApertura(d.key); break;
    case "tri-close": openTriCierre(d.key, null); break;
    case "triw-next": triWizMover(1); break;
    case "triw-prev": triWizMover(-1); break;
    case "triw-finish": triWizFinish(); break;
    case "triw-mas": triWizMas(); break;
    case "rec-save": guardarRecurrente(); break;
    case "rec-del": eliminarRecurrente(d.id); break;
    case "sem-ir": SEM_LUNES = d.lunes === agLunes(todayISO()) ? null : d.lunes; if (CURRENT !== "semana") go("semana"); else rerender(); window.scrollTo(0, 0); break;
    case "menu-guardar": guardarPersonalizarMenu(); break;
    case "anio-nav": if (+d.dir === 0) { ANIO_VISTA = null; rerender(); } else cambiarAnioVista(+d.dir); break;

    /* Bitácora */
    case "bita-toggle": BITA_OPEN[d.iso] = !BITA_OPEN[d.iso]; rerender(); break;
    case "diario-dia": diarioElegir(d.iso); break;
    case "diario-mes": diarioMover(+d.dir); break;

    /* Tareas (registro diario por fecha) */
    case "tarea-add": {
      const input = document.getElementById(d.input);
      const txt = input.value.trim(); if (!txt) return;
      const ambEl = d.amb && document.getElementById(d.amb);
      nuevaTarea(STATE, d.fecha, { txt, ambito: ambEl && ambEl.value === "pro" ? "pro" : "per" });
      saveState(); rerender();
      if (d.cerrar) { closeModal(); toast("Tarea agregada a hoy ✓"); }
      break;
    }
    case "bocado-hecho":   // la parada del primer bocado en Inicio marca la misma tarea
    case "tarea-toggle": {
      const t = buscarTarea(STATE, d.fecha, d.id); if (!t) break;
      const hecha = estadoTarea(t) !== "hecha";
      marcarTarea(t, hecha ? "hecha" : "pendiente", hecha ? { hechaTs: Date.now() } : null);
      hecha ? registrarMovimiento("tarea:" + t.id, 15, 15, "Tarea") : anularMovimiento("tarea:" + t.id);
      if (hecha) { alCompletarTarea(t); vibrar(t.esSapo ? [12, 50, 18] : 10); }   // sonido y celebraciones de la Tienda
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
      if (!t) break;
      borrarTarea(t); saveState(); rerender(); vibrar(10);
      // Sin preguntar "¿seguro?": se borra al tiro y se puede deshacer
      const fecha = d.fecha, id = d.id;
      toastAccion("Tarea borrada", "Deshacer", () => {
        const u = buscarTarea(STATE, fecha, id);
        if (u) { delete u.borrada; u.ts = Date.now(); saveState(); rerender(); }
      });
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
      STATE.settings.theme = d.theme; STATE.settings.temaElegido = d.theme; saveState(); applyTheme(d.theme); closeModal(); rerender();
      toast("Tema aplicado: " + (THEMES.find(t => t.id === d.theme) || {}).nombre);
      break;
    }
    case "tema-buy": {
      const f = familiaDeTema(d.theme);
      if (!f || familiaTuya(f)) break;
      recalcGamif(STATE);
      if (STATE.gamif.puntos < f.costo) { toast("Te faltan " + (f.costo - STATE.gamif.puntos) + " ⭐", true); break; }
      if (!confirm(`¿Desbloquear ${f.nombre} por ${f.costo} estrellas?\nTe quedarán ${STATE.gamif.puntos - f.costo}.`)) break;
      const res = ledgerComprar(STATE, "tema-" + f.id, f.costo);
      if (!res.ok && !res.yaTenia) { toast("Te faltan " + (res.falta || f.costo) + " ⭐", true); break; }
      const aplicar = f.solo || f.auto;   // los de día y noche quedan en automático
      STATE.settings.theme = aplicar; STATE.settings.temaElegido = aplicar; saveState(); applyTheme(aplicar); updateTopbar(); closeModal(); rerender();
      toast("🛍️ " + f.nombre + " desbloqueado y aplicado");
      break;
    }

    /* Recompensas / cosméticos */
    case "cos-buy": buyItem(d.id); break;
    case "cos-equip": equipItem(d.id); break;
    case "ins-ver": abrirInsignia(d.id); break;
    case "cuarto-ver": cuartoVer(); break;
    case "cuarto-entrar": cuartoEntrar(); break;
    case "lugar-entrar": lugarAbrir(d.ruta, el); break;
    case "ele-casa": tocarElefante(el); setTimeout(() => { if (CURRENT === "inicio") lugarAbrir("cuarto", el); }, sinMovimiento() ? 0 : 420); break;
    case "cielo-mirar": if (CIELO_ESTADO.motor) CIELO_ESTADO.motor.mirarFamilia(d.id); break;
    case "lugar-volver": lugarVolver(); break;
    case "hoja-alternar": hojaAlternar(); break;
    case "cuarto-decorar": cuartoDecorar(); break;
    case "repisa-elegir": REPISA_SEL = null; openRepisa(); break;
    case "repisa-toggle": repisaToggle(d.id); break;
    case "repisa-guardar": repisaGuardar(false); break;
    case "repisa-auto": repisaGuardar(true); break;
    case "repisa-medalla": repisaMedalla(d.id); break;

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
    case "consultorio-cerrar": cerrarConsultorio(); break;
    case "profile-save": saveProfile(); break;
    case "onboarding-save": saveOnboarding(); break;
    case "onb-next": onbMover(1); break;
    case "onb-prev": onbMover(-1); break;
    case "onb-skip": onbSaltar(); break;
    case "onb-done": onbTerminar(); break;
    case "tour-start":
      if ((STATE.settings.introVersion || 0) < INTRO_VERSION) { STATE.settings.introVersion = INTRO_VERSION; saveState(); }
      tourIniciar(d.id); break;
    case "gcal-conectar": gcalConectar(); break;
    case "gcal-actualizar": gcalActualizar(true); break;
    case "gcal-config": openGcalConfig(); break;
    case "gcal-guardar": gcalGuardarConfig(); break;
    case "gcal-desconectar": gcalDesconectar(); break;
    case "tour-pantalla": cerrarMas(); if (tourDePantalla(CURRENT)) tourIniciar(tourDePantalla(CURRENT)); break;
    case "tour-next": tourMover(1); break;
    case "tour-prev": tourMover(-1); break;
    case "tour-salir": tourTerminar(); break;
    case "tour-reset": tourReiniciar(); break;
    case "mision-ir": go(d.ruta); break;
    case "mision-ocultar": misionMostrar(false); toast("Primeros pasos oculto · vuelve a mostrarlo en Ayuda"); break;
    case "mision-cerrar": cambiarTutorial("mision", "completada"); rerender(); break;
    case "show-tutorial": case "intro-replay": setSidebar(false); cerrarMas(); cerrarMenuCuenta(); openOnboarding(STATE.settings.onboarded ? "repetir" : "nuevo"); break;
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

const BASE_THEMES = ["auto", "norte", "norte-noche", "ruta-auto", "ruta", "ruta-noche", "alto-contraste"];   // gratis (alto contraste: accesibilidad)
const DEFAULT_THEME = "auto";   // v91: Norte de día y Norte noche de noche, según el modo del teléfono
/* Los automáticos no son un tema en sí: según el teléfono (modo claro u oscuro) se ve el primero o el segundo
   de su par. "auto" (el predeterminado) es Norte / Norte noche; v93 suma Ruta y Bosque. */
const OSCURO = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function parDeTema(t) { const th = THEMES.find(x => x.id === t); return th && th.par; }
function resolverTema(t) { const par = parDeTema(t); return par ? par[OSCURO && OSCURO.matches ? 1 : 0] : t; }
// Si el teléfono pasa a modo oscuro (o vuelve a claro) con la app abierta, Rumbo lo sigue al tiro
if (OSCURO) {
  const alCambiar = () => { const t = STATE ? STATE.settings.theme : DEFAULT_THEME; if (parDeTema(t)) applyTheme(t); };
  OSCURO.addEventListener ? OSCURO.addEventListener("change", alCambiar) : OSCURO.addListener && OSCURO.addListener(alCambiar);
}
/* Fuentes de los temas Bosque: se cargan solo cuando se aplica uno de ellos */
const FUNDOS_FONTS_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Mulish:wght@400;500;600;700&display=swap";
function applyTheme(t) {
  const id = resolverTema(THEMES.some(x => x.id === t) ? t : DEFAULT_THEME);
  document.documentElement.setAttribute("data-theme", id);
  loadThemeFonts(id);
  // El color del navegador (Android) y de la barra de estado sigue a la barra de arriba del tema
  const meta = document.querySelector('meta[name="theme-color"]'), th = THEMES.find(x => x.id === id);
  if (meta && th) meta.setAttribute("content", th.barra || th.bg);
  // Para la próxima vez que se abra: el tema de día y de noche, y su color de barra, antes de que cargue el código
  try {
    const base = THEMES.find(x => x.id === t) ? t : DEFAULT_THEME, par = parDeTema(base) || [id, id];
    const barra = x => { const y = THEMES.find(z => z.id === x) || {}; return y.barra || y.bg; };
    localStorage.setItem("rumbo-tema-inicio", JSON.stringify({ t: par, c: par.map(barra) }));
  } catch (e) {}
}
/* Fuentes por tema: se piden solo al usar el tema (o su vista previa) */
const THEME_FONTS = {
  cuaderno: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Karla:wght@400;500;600;700&display=swap",
  terminal: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap",
};
function loadThemeFonts(id) {
  if (id.startsWith("bosque")) return loadFundosFonts();
  const url = THEME_FONTS[id]; if (!url || document.getElementById("font-" + id)) return;
  const l = document.createElement("link");
  l.id = "font-" + id; l.rel = "stylesheet"; l.href = url;
  document.head.appendChild(l);
}
function loadFundosFonts() {
  if (document.getElementById("fundosFonts")) return;
  const l = document.createElement("link");
  l.id = "fundosFonts"; l.rel = "stylesheet"; l.href = FUNDOS_FONTS_URL;
  document.head.appendChild(l);
}
function themeOwned(id) {
  const f = typeof familiaDeTema === "function" && familiaDeTema(id);   // v95: los temas se tienen por familia
  if (f) return familiaTuya(f);
  return BASE_THEMES.includes(id) || (STATE.gamif.owned || []).includes("tema-" + id);
}
/* Cuenta dueña: desbloquea todos los temas automáticamente al entrar.
   El correo va encriptado (hash), no en texto plano, para no exponerlo. */
/* Cuentas dueñas (hash del correo, nunca el correo en claro): todo lo que se COMPRA queda desbloqueado.
   Lo que se GANA con logros (tipos de elefante, corona, medalla, marco Diamante) se gana como todos,
   salvo el Mamut. */
const OWNER_SIN_PERK = ["mar-diamante", "ele-corona", "ele-medalla", "ele-tipo-peluche", "ele-tipo-geometrico", "ele-tipo-tinta"];
const OWNER_HASHES = ["h1805468134", "h3574416572"];
function esCuentaDuena() {
  return !!(CURRENT_USER && CURRENT_USER.email && typeof _hash === "function" && OWNER_HASHES.includes(_hash(CURRENT_USER.email.trim().toLowerCase())));
}
function grantOwnerPerks() {
  try {
    if (!esCuentaDuena()) return;
    // Van a gamif.perks (no al ledger): desbloquear no genera movimientos de cobro
    const L = x => (typeof x !== "undefined" && Array.isArray(x)) ? x : [];
    STATE.gamif.perks = Array.from(new Set([
      ...THEMES.map(t => "tema-" + t.id),
      ...L(TITULOS).map(t => t.id), ...L(DETALLES).map(d => d.id),
      ...(typeof COSMETICOS !== "undefined" ? COSMETICOS.map(c => c.id) : []),
      ...(typeof FUNCIONES !== "undefined" ? FUNCIONES.map(f => "fun-" + f.id) : []),
      ...(typeof PLANTILLAS !== "undefined" ? PLANTILLAS.map(p => "fun-plantilla-" + p.id) : []),
      ...(typeof PACKS_ICONOS !== "undefined" ? PACKS_ICONOS.map(p => "fun-iconos-" + p.id) : []),
      ...(typeof PRENDAS_ELEFANTE !== "undefined" ? PRENDAS_ELEFANTE.map(p => p.compra || "ele-" + p.id) : []),
      "ele-tipo-mamut",
      ...(typeof AVATAR_PRECIOS !== "undefined" ? Object.keys(AVATAR_PRECIOS).map(id => "av-" + id) : []),
    ])).filter(id => !OWNER_SIN_PERK.includes(id));
    recalcGamif(STATE);
  } catch (e) {}
}

const FONT_SG = "'Space Grotesk',sans-serif";
const FONT_IT = "'Inter Tight',sans-serif";
const FONT_FIG = "'Figtree',sans-serif";
const FONT_BRI = "'Bricolage Grotesque',sans-serif";
const FONT_CORMORANT = "'Cormorant Garamond',Georgia,serif";
const FONT_MULISH = "'Mulish',sans-serif";
/* Orden = orden en la Tienda */
const THEMES = [
  /* --- Bases gratis: Automático (predeterminado), Norte y su versión de noche, y Ruta --- */
  { id: "auto", nombre: "Automático", base: "Base", auto: true, par: ["norte", "norte-noche"], concepto: "Norte de día y Norte noche de noche: sigue el modo claro u oscuro de tu teléfono. El tema predeterminado.", costo: 0,
    bg: "#F5F6FA", card: "#FFFFFF", accent: "#3949C9", cta: "#F4AE3D", onCta: "#161A2E", text: "#161A2E", font: FONT_FIG, fontDisplay: FONT_BRI, radius: "16px", barra: "#161A2E" },
  { id: "norte", nombre: "Norte", base: "Base", concepto: "El tema de Rumbo: una aguja ámbar para lo que sigue, sobre tinta índigo y con la luz de la mañana. Siempre claro, aunque tu teléfono esté en modo oscuro.", costo: 0,
    bg: "#F5F6FA", card: "#FFFFFF", accent: "#3949C9", cta: "#F4AE3D", onCta: "#161A2E", text: "#161A2E", font: FONT_FIG, fontDisplay: FONT_BRI, radius: "16px", barra: "#161A2E" },
  { id: "norte-noche", nombre: "Norte noche", base: "Base", concepto: "Norte en oscuro: el mismo cielo índigo de tu vitrina y la misma aguja ámbar. Descansa la vista en la noche.", costo: 0,
    bg: "#0C0F1E", card: "#141932", accent: "#8D9BFF", cta: "#FFBE55", onCta: "#0C0F1E", text: "#EEF0F8", font: FONT_FIG, fontDisplay: FONT_BRI, radius: "16px", barra: "#0C0F1E" },
  { id: "ruta-auto", nombre: "Ruta automático", base: "Base", auto: true, par: ["ruta", "ruta-noche"], concepto: "Ruta de día y Ruta noche de noche: sigue el modo claro u oscuro de tu teléfono.", costo: 0,
    bg: "#FFFFFF", card: "#F3F3F3", accent: "#0B0B0C", cta: "#0B0B0C", onCta: "#FFFFFF", text: "#0B0B0C", font: FONT_IT, fontDisplay: FONT_IT, radius: "14px", barra: "#0B0B0C" },
  { id: "ruta", nombre: "Ruta", base: "Base", concepto: "Como una app de viajes: blanco, negro y un solo acento coral. Letras grandes y una acción clara a la vez. Siempre claro, aunque tu teléfono esté en modo oscuro.", costo: 0,
    bg: "#FFFFFF", card: "#F3F3F3", accent: "#0B0B0C", cta: "#0B0B0C", onCta: "#FFFFFF", text: "#0B0B0C", font: FONT_IT, fontDisplay: FONT_IT, radius: "14px", barra: "#0B0B0C" },
  { id: "ruta-noche", nombre: "Ruta noche", base: "Base", concepto: "El diseño Ruta en oscuro: negro profundo, texto blanco y el mismo acento coral. Descansa la vista en la noche.", costo: 0,
    bg: "#0B0B0C", card: "#1F1F21", accent: "#FFFFFF", cta: "#FFFFFF", onCta: "#0B0B0C", text: "#F5F5F5", font: FONT_IT, fontDisplay: FONT_IT, radius: "14px", barra: "#0B0B0C" },
  /* --- Tienda --- */
  { id: "bosque-auto", nombre: "Bosque automático", base: "Tienda", auto: true, par: ["bosque-claro", "bosque-oscuro"], concepto: "Bosque Claro de día y Bosque Oscuro de noche: sigue el modo claro u oscuro de tu teléfono. Se activa cuando tienes los dos.", costo: 0,
    bg: "#F7F5F0", card: "#FFFFFF", accent: "#C8A165", cta: "#16301F", onCta: "#F7F5F0", text: "#0A140E", font: FONT_MULISH, fontDisplay: FONT_CORMORANT, radius: "12px", barra: "#16301F" },
  { id: "bosque-claro", nombre: "Bosque Claro", base: "Tienda", concepto: "Marfil, verde bosque y detalles dorados. Títulos con serifa clásica.", costo: 550,
    bg: "#F7F5F0", card: "#FFFFFF", accent: "#C8A165", cta: "#16301F", onCta: "#F7F5F0", text: "#0A140E", font: FONT_MULISH, fontDisplay: FONT_CORMORANT, radius: "12px", barra: "#16301F" },
  { id: "bosque-oscuro", nombre: "Bosque Oscuro", base: "Tienda", concepto: "Verde profundo con acento dorado. Sobrio, cálido y con carácter.", costo: 650,
    bg: "#0A140E", card: "#0F1F16", accent: "#C8A165", cta: "#C8A165", onCta: "#0A140E", text: "#F7F5F0", font: FONT_MULISH, fontDisplay: FONT_CORMORANT, radius: "12px" },
  { id: "atardecer", nombre: "Atardecer", base: "Tienda", concepto: "Violeta profundo con acento durazno. Cálido para cerrar el día.", costo: 800,
    bg: "#1D1530", card: "#28203F", accent: "#FF9E7A", cta: "#E8618A", onCta: "#1E0F18", text: "#F7EEF6", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  { id: "oceano", nombre: "Océano", base: "Tienda", concepto: "Azul petróleo y turquesa. Fresco y tranquilo.", costo: 800,
    bg: "#06222A", card: "#0B2F38", accent: "#39D0E0", cta: "#FFB84D", onCta: "#2A1A00", text: "#E6F4F5", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
  { id: "cuaderno", nombre: "Cuaderno", base: "Tienda", concepto: "Papel crema, tinta azul y títulos con serifa. Como un bullet journal.", costo: 900,
    bg: "#F4EFE3", card: "#FFFDF7", accent: "#2F4B7C", cta: "#B23A2E", onCta: "#FFFFFF", text: "#1F2A3D", font: "'Karla',sans-serif", fontDisplay: "'Fraunces',Georgia,serif", radius: "12px", barra: "#24395F" },
  { id: "terminal", nombre: "Terminal", base: "Tienda", concepto: "Negro y verde fósforo con letra monoespaciada. Para los más técnicos.", costo: 1000,
    bg: "#0A0F0B", card: "#0F1711", accent: "#39FF88", cta: "#FFB000", onCta: "#1A1100", text: "#D8FFE4", font: "'IBM Plex Mono',monospace", fontDisplay: "'IBM Plex Mono',monospace", radius: "6px" },
  { id: "sakura", nombre: "Sakura", base: "Tienda", concepto: "Rosado suave y verde hoja. Claro y liviano.", costo: 900,
    bg: "#FFF6F7", card: "#FFFFFF", accent: "#E26D8A", cta: "#4F7A39", onCta: "#FFFFFF", text: "#3A2230", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px", barra: "#3A2230" },
  { id: "alto-contraste", nombre: "Alto contraste", base: "Accesibilidad", concepto: "Negro, blanco y amarillo, pensado para leer mejor. Gratis.", costo: 0,
    bg: "#000000", card: "#0B0B0B", accent: "#FFD400", cta: "#FFFFFF", onCta: "#000000", text: "#FFFFFF", font: FONT_SG, fontDisplay: FONT_SG, radius: "12px" },
];

/* -------- Temas como familias (v95) --------
   Norte, Ruta y Bosque tienen día y noche: son una sola ficha con su modo (Automático, Día o Noche).
   Bosque se compra una vez, con los dos modos; quien ya tenía uno de los dos, tiene la familia. */
const TEMA_FAMILIAS = [
  { id: "norte", nombre: "Norte", auto: "auto", dia: "norte", noche: "norte-noche", costo: 0,
    concepto: "El tema de Rumbo: una aguja ámbar para lo que sigue, sobre tinta índigo. De día es la luz de la mañana; de noche, el cielo de tu vitrina." },
  { id: "ruta", nombre: "Ruta", auto: "ruta-auto", dia: "ruta", noche: "ruta-noche", costo: 0,
    concepto: "Como una app de viajes: blanco y negro, un solo acento coral y letras grandes. De noche, negro profundo." },
  { id: "bosque", nombre: "Bosque", auto: "bosque-auto", dia: "bosque-claro", noche: "bosque-oscuro", costo: 900,
    concepto: "Marfil y verde bosque de día, verde profundo de noche, con detalles dorados y títulos con serifa. Una compra, con los dos modos." },
  { id: "atardecer", nombre: "Atardecer", solo: "atardecer", modo: "noche", costo: 800 },
  { id: "oceano", nombre: "Océano", solo: "oceano", modo: "noche", costo: 800 },
  { id: "cuaderno", nombre: "Cuaderno", solo: "cuaderno", modo: "dia", costo: 900 },
  { id: "terminal", nombre: "Terminal", solo: "terminal", modo: "noche", costo: 1000 },
  { id: "sakura", nombre: "Sakura", solo: "sakura", modo: "dia", costo: 900 },
  { id: "alto-contraste", nombre: "Alto contraste", solo: "alto-contraste", modo: "noche", costo: 0 },
];
const temasDeFamilia = f => f.solo ? [f.solo] : [f.auto, f.dia, f.noche];
function familiaDeTema(id) { return TEMA_FAMILIAS.find(f => f.id === id || temasDeFamilia(f).includes(id)) || null; }
/* Tuya si es gratis, si la compraste como familia o si tenías uno de sus temas (antes de v95 se compraban por separado) */
function familiaTuya(f) {
  if (!f.costo) return true;
  const o = STATE.gamif.owned || [];
  return o.includes("tema-" + f.id) || temasDeFamilia(f).some(id => o.includes("tema-" + id));
}

/* Vista previa de un tema (por su familia): cómo se ve, y su modo si es tuya o el botón para desbloquearla */
function openThemePreview(id) {
  const f = familiaDeTema(id); if (!f) return;
  const temas = f.solo ? [f.solo] : [f.dia, f.noche];
  temas.forEach(t => loadThemeFonts(t));
  const maqueta = t => `
    <div style="background:${t.bg};border-radius:14px;padding:14px;font-family:${t.font};color:${t.text}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-weight:700;font-size:17px;font-family:${t.fontDisplay || t.font}">Rumbo</div>
        <div style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:12px">⭐ 320</div>
      </div>
      <div style="background:${t.card};border-radius:${t.radius};padding:14px;margin-bottom:10px">
        <div style="font-size:12px;opacity:.7">Ahorro del mes</div>
        <div style="font-size:24px;font-weight:700;font-family:${t.fontDisplay || t.font}">$540.000</div>
        <div style="height:8px;background:rgba(128,128,128,.25);border-radius:99px;margin-top:8px;overflow:hidden"><div style="width:66%;height:100%;background:${t.accent};border-radius:99px"></div></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span style="background:${t.accent};color:${t.bg};border-radius:${t.radius};padding:4px 10px;font-size:12px;font-weight:600">🎯 Misión</span>
        <span style="background:${t.card};border-radius:${t.radius};padding:4px 10px;font-size:12px">${BOCADO.emoji} ${BOCADO.corto}</span>
        <button style="margin-left:auto;background:${t.cta};color:${t.onCta || "#fff"};border:none;border-radius:${t.radius};padding:8px 16px;font-size:12px;font-weight:700;font-family:${t.font}">Abre tu día</button>
      </div>
    </div>`;
  const mock = temas.map((id, i) => `${f.solo ? "" : `<div class="text-xs muted" style="margin:${i ? "12px" : "0"} 0 6px">${i ? "De noche" : "De día"}</div>`}${maqueta(THEMES.find(x => x.id === id))}`).join("");
  const actual = STATE.settings.theme;
  const cta = !familiaTuya(f)
    ? botonCompra(f.costo, `data-action="tema-buy" data-theme="${f.id}"`, "Desbloquear " + escapeHtml(f.nombre))
    : f.solo
      ? (actual === f.solo ? `<button class="btn btn--soft btn-block" data-action="close-modal">Ya es tu tema actual</button>`
        : `<button class="btn btn--cian btn-block" data-action="set-theme" data-theme="${f.solo}">Aplicar este tema</button>`)
      : `<div class="tema-modos">${[["auto", "Automático", "Sigue el modo claro u oscuro de tu teléfono"], ["dia", "Siempre de día", ""], ["noche", "Siempre de noche", ""]].map(([k, l, sub]) =>
          `<button class="tema-modo${actual === f[k] ? " is-on" : ""}" data-action="set-theme" data-theme="${f[k]}" aria-pressed="${actual === f[k]}"><b>${l}</b>${sub ? `<small>${sub}</small>` : ""}${actual === f[k] ? "<span>✓</span>" : ""}</button>`).join("")}</div>`;
  const concepto = f.concepto || (THEMES.find(x => x.id === f.solo) || {}).concepto || "";
  openModal(f.nombre, `
    <p class="text-sm muted" style="margin-bottom:14px">${escapeHtml(concepto)}</p>
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
  else { STATE.habitos.log[key][habitId][day] = true; registrarMovimiento(movId, 5, 5); vibrar(10); }
  actualizarMetaHabito(habitId, isoLocal(new Date(year, monthIdx, day)));
  if (typeof jardinAlMarcar === "function") jardinAlMarcar(habitId, !cur);   // 🌱 tu elefante riega (o trasplanta a los 66 días)
  saveState();
  updateTopbar();
  rerender();
  conjuntoAlMarcar(habitId, isoLocal(new Date(year, monthIdx, day)));   // si es en conjunto: tus amigos lo ven
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
/* Tu elefante, chico, junto al saludo: al tocarlo reacciona y te lleva a su casa */
function eleHero() {
  if (typeof elefanteSVG !== "function") return "";
  const papel = TIPOS_ELEFANTE[tipoElefante()].papel ? " papel" : "";
  return `<div class="ele-hero ele-toca${papel}" data-action="ele-casa" role="button" tabindex="0" title="Ir a su casa" aria-label="Tu elefante: ${escapeAttr(nombreElefante())}. Ir a su casa">${elefanteSVG()}</div>`;
}
/* Tu día como un recorrido (diseño Ruta): abres, das tu primer bocado y llegas al cierre.
   Como en una app de viajes: arriba el destino (tu misión), abajo las paradas con su hora
   y una barra que avanza hasta tu hora de cierre. El botón principal es uno solo. */
function horaCorta(ts) { return ts ? new Date(ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : ""; }
/* La hora en que piensas cerrar: la del recordatorio de la noche (21:00 si no hay) */
function horaCierrePlan() {
  const n = STATE.settings.notif;
  return n && /^\d{1,2}:\d{2}$/.test(n.noche || "") ? n.noche.padStart(5, "0") : "21:00";
}
function duracionCorta(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`; }
/* Cuánto llevas del día y cuánto falta para tu cierre (como la llegada de un viaje) */
function etaCierre(abiertoTs) {
  const [hh, mm] = horaCierrePlan().split(":").map(Number);
  const ahora = new Date();
  const fin = new Date(ahora); fin.setHours(hh, mm, 0, 0);
  const ini = abiertoTs ? new Date(abiertoTs) : new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 8);
  // (si abriste después de tu hora de cierre, el recorrido ya está completo)
  const pct = ini >= fin ? 100 : Math.max(0, Math.min(100, Math.round((ahora - ini) / (fin - ini) * 100)));
  const min = Math.round((fin - ahora) / 60000);
  return { pct, min, ini: horaCorta(ini.getTime()), fin: horaCierrePlan(),
    falta: min <= 0 ? "Es hora de cerrar tu día" : `Faltan ${duracionCorta(min)} para tu cierre` };
}
/* La barra de avance se mueve sola mientras miras Inicio */
function refrescarEta() {
  const el = document.querySelector("#view .ruta-eta");
  if (!el || document.hidden) return;
  const e = etaCierre(+el.dataset.abierto || 0);
  el.querySelector(".ruta-eta__barra i").style.width = e.pct + "%";
  el.querySelector(".ruta-eta__txt").textContent = e.falta;
}
setInterval(refrescarEta, 60000);
/* Misiones de los días anteriores, para elegir con un toque (como los destinos recientes) */
function misionesRecientes(max = 2) {
  const out = [], vistos = new Set();
  const add = (txt, sub) => {
    const t = String(txt || "").trim(), k = t.toLowerCase();
    if (!t || vistos.has(k) || out.length >= max) return;
    vistos.add(k); out.push({ txt: t, sub });
  };
  for (let b = 1; b <= 14 && out.length < max; b++) {
    const d = new Date(); d.setDate(d.getDate() - b);
    const iso = isoLocal(d), r = STATE.ritual.dias[iso];
    if (!r) continue;
    if (b === 1 && r.cierre && r.cierre.manana) add(r.cierre.manana, "Lo anotaste anoche para hoy");
    if (r.mision) add(r.mision, b === 1 ? "Tu misión de ayer" : "Tu misión del " + diaCorto(iso));
  }
  return out;
}
function renderDayHero() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  const st = dayState();
  if (st === "cerrado") return renderCierreResumen(r);
  const name = escapeHtml(STATE.profile.name);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const fecha = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const abierto = st !== "por-abrir", porCerrar = st === "por-cerrar";
  const tb = tareasDelDia(iso).find(t => t.esSapo && !tareaMovida(t));
  const bocadoTxt = (tb && tb.txt) || (r && r.sapo) || "";
  const bocadoHecho = tb ? estadoTarea(tb) === "hecha" : !!(r && r.cierre && r.cierre.sapo);
  const paso = (estado, marca, cuerpo, hora, acc, accChica) => `<li class="ruta__p is-${estado}"><span class="ruta__m ruta__m--${marca}" aria-hidden="true"></span>
      <div class="ruta__txt">${cuerpo}</div>${hora ? `<span class="ruta__hora">${hora}</span>` : ""}${acc ? `<div class="ruta__acc${accChica ? " ruta__acc--chica" : ""}">${acc}</div>` : ""}</li>`;

  // El destino: tu misión de hoy, en una barra como la de "¿A dónde vas?"
  const mision = abierto && r.mision ? r.mision : "";
  const barra = `<button type="button" class="mision-barra" data-action="mision-barra" aria-label="${mision ? "Misión de hoy: " + escapeAttr(mision) + ". Tócala para cambiarla" : "Escribe tu misión de hoy"}">
      ${iconoLinea("mision", 22)}
      <span class="mision-barra__txt"><span class="mision-barra__eti">Misión de hoy</span>
        <span class="mision-barra__v${mision ? "" : " is-vacia"}">${mision ? escapeHtml(mision) : abierto ? "Sin misión · escríbela" : "¿Cuál es tu misión?"}</span></span>
      <span class="mision-barra__hoy">${iconoLinea("reloj", 15)}Hoy</span></button>`;
  const rec = abierto ? [] : misionesRecientes();
  const recientes = rec.length ? `<div class="recientes" aria-label="Misiones recientes">${rec.map(m =>
    `<button type="button" class="reciente" data-action="mision-reciente" data-txt="${escapeAttr(m.txt)}">${iconoLinea("historial", 18)}
      <span class="reciente__txt"><b>${escapeHtml(m.txt)}</b><small>${m.sub}</small></span>${iconoLinea("flecha", 16)}</button>`).join("")}</div>` : "";

  // 1) Abrir el día
  const det = abierto ? [r.energia ? "Energía " + r.energia + "/5" : "", r.pilar ? escapeHtml(r.pilar) : ""].filter(Boolean).join(" · ") : "";
  const p1 = !abierto
    ? paso("actual", "abre", `<span class="ruta__t">Abre tu día</span><span class="ruta__s">Elige tu primer bocado y arranca. Toma 30 segundos (o 3 toques en express).</span>`, "",
        `<button class="btn btn--primary" data-coral="dia" data-action="day-open">${iconoLinea("sol", 18)}Abre tu día</button><button class="btn btn--soft" data-action="day-open-express">${iconoLinea("rayo", 16)}Express</button>`)
    : paso("hecho", "abre", `<span class="ruta__t">Abriste tu día</span>${det ? `<span class="ruta__s">${det}</span>` : ""}`, horaCorta(r.abiertoTs));

  // 2) Primer bocado (con la hora en que lo diste)
  const p2 = paso(bocadoHecho ? "hecho" : abierto ? "actual" : "pend", "bocado",
    `<span class="ruta__eti">${BOCADO.corto}</span><span class="ruta__t${bocadoTxt ? "" : " ruta__t--vacio"}">${bocadoTxt ? escapeHtml(bocadoTxt) : abierto ? "Sin primer bocado hoy" : "Lo eliges al abrir tu día"}</span>`,
    bocadoHecho && tb && tb.hechaTs ? horaCorta(tb.hechaTs) : "",
    tb && abierto ? `<button class="btn ${bocadoHecho ? "btn--soft" : "btn--cian"} ruta__hecho" data-action="bocado-hecho" data-fecha="${iso}" data-id="${tb.id}" aria-pressed="${bocadoHecho}" aria-label="${bocadoHecho ? "Desmarcar tu primer bocado" : "Marcar tu primer bocado como hecho"}">${bocadoHecho ? iconoLinea("hecho", 16) + "Hecho" : "Hecho"}</button>` : "", true);

  // 3) Cerrar el día (a tu hora de siempre)
  const p3 = paso(porCerrar ? "actual" : "pend", "cierre",
    `<span class="ruta__t">Cierra tu día</span><span class="ruta__s">${porCerrar ? "Tu día está por terminar. Cierra el ritual y reflexiona." : "Dos minutos para decidir qué pasa con lo pendiente y agradecer."}</span>`,
    abierto ? horaCierrePlan() : "",
    !abierto ? "" : porCerrar
      ? `<button class="btn btn--primary" data-coral="dia" data-action="day-close">${iconoLinea("luna", 18)}Cierra tu día</button><button class="btn btn--soft" data-action="day-close-express">${iconoLinea("rayo", 16)}Express</button>`
      : `<button class="btn btn--soft" data-action="day-close">${iconoLinea("luna", 18)}Cerrar el día</button><button class="btn-ghost" data-action="day-close-express">${iconoLinea("rayo", 15)}Express</button>`);

  // Avance del día hacia tu cierre
  const e = abierto ? etaCierre(r.abiertoTs) : null;
  const eta = e ? `<div class="ruta-eta" data-abierto="${r.abiertoTs || ""}">
      <div class="ruta-eta__barra" aria-hidden="true"><i style="width:${e.pct}%"></i></div>
      <div class="ruta-eta__fila"><span>${e.ini}</span><b class="ruta-eta__txt">${e.falta}</b><span>${e.fin}</span></div></div>` : "";
  const rd = abierto ? resumenDia(STATE, iso) : null;
  // En el celular la racha no cabe en la barra de arriba (van las puertas): va aquí, al pie de tu día
  const racha = computeClosedStreak(), chips = [rd && rd.planificadas ? `<span class="chip">${rd.hechas} de ${rd.planificadas} tareas</span>` : "",
    rd && r.servir ? `<span class="chip">Hoy sirves a ${escapeHtml(r.servir)}</span>` : ""].filter(Boolean);
  const pie = `<div class="ruta-dia__pie${chips.length ? "" : " solo-movil"}">
      <button type="button" class="chip ruta-dia__racha" data-action="info-racha">${iconoLinea("llama", 14)} ${racha === 1 ? "1 día cerrado" : racha + " días cerrados"}</button>${chips.join("")}</div>`;
  return `<section class="card hero-focus ruta-dia" data-estado="${st}">
    <div class="ruta-dia__top"><div class="ruta-dia__cab">
      <div class="ruta-dia__fecha">${fecha}</div>
      <div class="ruta-dia__saludo">${saludo}, ${name}.</div>
      <h2 class="ruta-dia__t">${porCerrar ? "Llegaste al final del día" : "¿A dónde va tu día?"}</h2></div>${eleHero()}</div>
    ${barra}${recientes}
    <ol class="ruta">${p1}${p2}${p3}</ol>${eta}${pie}
  </section>`;
}
function cumpliChip(v) {
  if (v === "si") return `<span class="chip chip--done">cumplida</span>`;
  if (v === "parcial") return `<span class="chip chip--coral">parcial</span>`;
  if (v === "no") return `<span class="chip">no</span>`;
  return "";
}
/* Monedas que ganaste hoy (las que no se anularon) */
function monedasDeHoy() {
  const hoy = todayISO();
  return ((STATE.gamif && STATE.gamif.ledger) || [])
    .filter(m => !m.anulado && m.delta > 0 && m.ts && isoLocal(new Date(m.ts)) === hoy)
    .reduce((a, m) => a + m.delta, 0);
}
/* Al llegar: el recibo de tu día (como el de un viaje), con tu racha, tus paradas y lo que ganaste */
function renderCierreResumen(r) {
  const iso = todayISO();
  const c = r.cierre || {};
  const s = dayAutoSummary();
  const rd = resumenDia(STATE, iso);
  const mov = rd.migradas + rd.programadas;
  // El bocado que no se dio muestra qué se decidió con él (> < @ ✕)
  const tb = tareasDelDia(iso).find(t => t.esSapo);
  const eb = tb ? estadoTarea(tb) : null;
  const racha = computeClosedStreak();
  const ganadas = monedasDeHoy();
  const fecha = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const parada = (marca, t, sub, hora) => `<li class="ruta__p is-hecho"><span class="ruta__m ruta__m--${marca}" aria-hidden="true"></span>
      <div class="ruta__txt"><span class="ruta__t">${t}</span>${sub ? `<span class="ruta__s">${sub}</span>` : ""}</div>${hora ? `<span class="ruta__hora">${hora}</span>` : ""}</li>`;
  const bocadoSub = !r.sapo ? "" : c.sapo ? "Hecho" : eb && eb !== "pendiente" && eb !== "hecha" ? signoTarea(tb) : "Quedó pendiente";
  const paradas = parada("abre", r.sinApertura ? "Día sin apertura" : "Abriste tu día", r.pilar ? escapeHtml(r.pilar) : "", horaCorta(r.abiertoTs))
    + (r.sapo ? parada("bocado", escapeHtml(r.sapo), `${BOCADO.corto} · ${bocadoSub}`, c.sapo && tb && tb.hechaTs ? horaCorta(tb.hechaTs) : "") : "")
    + parada("cierre", "Cerraste tu día", "", horaCorta(r.cerradoTs));
  const tot = c.tareas ? [c.tareas.pro[0] + c.tareas.per[0], c.tareas.pro[1] + c.tareas.per[1]] : [s.tareasDone, s.tareasTotal];
  const movidas = [mov ? `↪ ${mov} a otro día` : "", rd.delegadas ? `@ ${rd.delegadas} delegada${rd.delegadas === 1 ? "" : "s"}` : "",
    rd.soltadas ? `✕ ${rd.soltadas} soltada${rd.soltadas === 1 ? "" : "s"}` : ""].filter(Boolean);
  const fila = (k, v) => `<div class="recibo__fila"><dt>${k}</dt><dd>${v}</dd></div>`;
  const filas = fila("Misión", `${r.mision ? escapeHtml(r.mision) : "—"} ${cumpliChip(c.mision)}`)
    + (tot[1] ? fila("Tareas", `${tot[0]} de ${tot[1]} hechas${movidas.length ? `<span class="recibo__mov">${movidas.map(m => `<span class="chip">${m}</span>`).join("")}</span>` : ""}`) : "")
    + (s.habTotal ? fila("Hábitos", `${s.habDone} de ${s.habTotal}`) : "")
    + fila("Energía", `${r.energia || "—"} → ${c.energia || "—"} de 5`);
  const notas = (c.mejor ? `<div class="recibo__nota"><span>Agradeces</span>${escapeHtml(c.mejor)}</div>` : "")
    + (c.manana ? `<div class="recibo__nota"><span>Para mañana</span><b class="hl-cian">${escapeHtml(c.manana)}</b></div>` : "")
    + (c.nota ? `<div class="recibo__nota"><span>Tu nota</span>"${escapeHtml(c.nota)}"</div>` : "");
  return `<section class="card hero-focus ruta-dia recibo" data-estado="cerrado">
    <div class="ruta-dia__top"><div class="ruta-dia__cab">
      <div class="ruta-dia__fecha">${fecha}</div>
      <div class="recibo__ok">${iconoLinea("hecho", 16)}Día cerrado</div>
      <h2 class="ruta-dia__t">Llegaste, ${escapeHtml(STATE.profile.name)}.</h2></div>${eleHero()}</div>
    <div class="recibo__racha" data-action="info-racha" role="button" tabindex="0" title="Qué es la racha"><b class="recibo__n" data-n="${racha}">${racha}</b><span>${racha === 1 ? "día cerrado<br>seguido" : "días cerrados<br>seguidos"}</span></div>
    <ol class="ruta">${paradas}</ol>
    <dl class="recibo__filas">${filas}</dl>
    ${notas}
    ${typeof reciboMedallasHtml === "function" ? reciboMedallasHtml(iso) : ""}
    ${ganadas ? `<div class="recibo__total"><span>Ganaste hoy</span><b>+${ganadas} ${iconoLinea("estrella", 18)}</b></div>` : ""}
    <div class="recibo__acc"><button class="btn btn--soft" data-action="compartir-dia">${iconoLinea("compartir", 18)}Compartir mi día</button>
      <button class="btn-ghost" data-action="day-close">Editar el cierre</button></div>
    <div class="text-sm muted recibo__pie">Mañana volvemos a empezar.</div>
  </section>`;
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
  btn.innerHTML = iconizarTexto(AMBITOS[el.value].icon + (btn.dataset.compacto ? "" : " " + AMBITOS[el.value].corto));
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
/* La app instalada antes de v94 lleva la barra de estado translúcida (iOS la guarda al instalar): ahí el iPhone
   difumina el borde de arriba. Se nota porque la página empieza bajo la hora (safe-area de arriba > 0). */
function instalacionAntigua() {
  if (navigator.standalone !== true) return false;
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(d); const h = d.offsetHeight; d.remove();
  return h > 0;
}
function avisoReinstalarHtml() {
  try { if (localStorage.getItem("rumbo-aviso-reinstalar")) return ""; } catch (e) { return ""; }
  if (!instalacionAntigua()) return "";
  return `<div class="card aviso-reinstalar" style="margin-bottom:20px">
    <div class="card__title">📲 Quita el difuminado de arriba</div>
    <p class="text-sm soft" style="margin:6px 0 12px">Tu iPhone guardó la barra de arriba de cuando agregaste Rumbo a tu pantalla de inicio. Para estrenar la nueva, sin difuminado: borra el ícono de Rumbo, abre <b>${escapeHtml(location.host)}</b> en Safari y toca Compartir → Agregar a pantalla de inicio. Tus datos están en tu cuenta: solo tendrás que volver a entrar.</p>
    <button class="btn btn--soft" data-action="aviso-reinstalar-ok">Entendido</button></div>`;
}

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
  const metaMes = s.finanzas.metaMensual || 0;
  const pctAhorro = metaMes ? Math.max(0, Math.min(100, Math.round((ahorroMes / metaMes) * 100))) : null;

  const libro = s.lecturas.find(l => l.estado === "leyendo") || s.lecturas.find(l => l.titulo);
  const pesos = [pesoActualGlobal(s)].filter(p => p != null);
  const pesoActual = pesos.length ? pesos[pesos.length - 1] : null;

  const habBtn = h => {
    const on = habitDone(h.id, mIdx, day);
    const prog = progresoPeriodoActual(h);
    return `<button class="hab-chip${on ? " is-on" : ""}" data-action="quick-habit" data-id="${h.id}" aria-pressed="${on}"
      title="${escapeAttr(h.nombre + " · " + prog.texto)}"><span class="hab-chip__i">${icoHab(h.icon, 20)}</span><span class="hab-chip__n">${escapeHtml(h.nombre)}</span></button>`;
  };
  const { toca: habToca, cumplidos: habCumplidos } = habitosHoy();
  // Los hábitos en conjunto van aparte, con cómo va cada uno (conjunto.js)
  const propios = l => l.filter(h => !h.conjunto), propiosToca = propios(habToca), propiosCumplidos = propios(habCumplidos);
  const habitsToday = (propiosToca.length ? `<div class="hab-chips">${propiosToca.map(habBtn).join("")}</div>` : "")
    + (propiosCumplidos.length ? `<details class="hb-more"><summary>${icoHab("✅", 15)} Ya cumplidos este período (${propiosCumplidos.length})</summary>
      <div class="hab-chips mt-8">${propiosCumplidos.map(habBtn).join("")}</div></details>` : "")
    + cjInicioHtml(habToca.concat(habCumplidos).filter(h => h.conjunto));
  const doneToday = habToca.filter(h => habitDone(h.id, mIdx, day)).length;

  const metasMes = (anioHoy.metas.mensuales[mIdx] || []).filter(m => !m.done);
  const aguaCard = typeof aguaInicioHtml === "function" ? aguaInicioHtml() : "";   // 💧 agua.js

  // Números de otros módulos: solo si el módulo está en tu menú y tiene algo que mostrar
  const kpis = [];
  if (!moduloOculto("finanzas") && (metaMes || ahorroMes))
    kpis.push(statCard("💰", "Ahorro de " + MESES[mIdx], fmtCLP(ahorroMes), metaMes ? `Meta ${fmtCLP(metaMes)} · ${pctAhorro}%` : "Sin meta mensual", pctAhorro));
  if (!moduloOculto("lecturas") && libro && libro.titulo)
    kpis.push(statCard("📚", "Leyendo ahora", escapeHtml(libro.titulo), libro.estado === "leyendo" ? "En curso" : "Último libro"));
  if (!moduloOculto("salud") && pesoActual != null)
    kpis.push(statCard("⚖️", "Peso actual", pesoActual + " kg", s.salud.pesoObjetivo != null && s.salud.pesoObjetivo !== "" ? "Meta " + s.salud.pesoObjetivo + " kg" : "Sin meta de peso"));

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
    <div class="card__head"><div class="card__title">📋 Tareas de hoy</div>
      <div class="row" style="gap:10px">${funcion("enfoque") ? `<button class="btn-ghost" data-action="enfoque-open" style="padding:4px 10px">⏱️ Enfocarme</button>` : ""}<a class="card__hint" href="#semana">Ver semana →</a></div></div>
    ${renderBandejaPendientes()}
    ${tareasHoy.length ? (bocado ? tareaRowHtml(bocado, hoyISO, { sinSub: true }) : "") + grupo("pro") + grupo("per")
    : '<div class="empty" style="padding:14px">Sin tareas para hoy. Defínelas en tu ritual de apertura.</div>'}
    <div class="row mt-8">${ambitoPicker("inicio-amb", "per")}<input class="input" id="inicio-tarea" placeholder="Nueva tarea..." style="padding:9px 11px">
      <button class="btn btn--cian" data-action="tarea-add" data-fecha="${hoyISO}" data-input="inicio-tarea" data-amb="inicio-amb" style="padding:9px 12px">+</button></div>
    ${pieTareas}
  </div>`;

  return `
  ${avisoReinstalarHtml()}
  ${renderPendingYesterday()}
  ${renderTrimestreBanner()}
  ${renderMesBanner()}
  ${renderSemanaBanner()}
  <div data-tour="dia">${renderDayHero()}</div>
  ${renderAtajos()}
  ${renderMisionCard()}
  ${plHoyHtml()}${plDespuesInicioHtml()}${amigosCumplesHoyHtml()}
  ${gcalConectado() ? `<div style="margin-bottom:20px">${renderGcalHoy()}</div>` : ""}
  <div class="grid grid-${Math.min(3, 2 + (metasMes.length ? 1 : 0) + (aguaCard ? 1 : 0))} inicio-main">
    ${tareasCard}
    <div class="card">
      <div class="card__head"><div class="card__title">Hábitos de hoy${habToca.length ? ` <span class="muted" style="font-weight:500;white-space:nowrap">· ${doneToday} de ${habToca.length}</span>` : ""}</div>
        <a class="card__hint" href="#habitos">Ver panel →</a></div>
      ${typeof jardinInicioHtml === "function" ? jardinInicioHtml() : ""}
      ${habitsToday || '<div class="empty">Agrega hábitos en el panel.</div>'}
    </div>
    ${aguaCard}
    ${metasMes.length ? `<div class="card">
      <div class="card__head"><div class="card__title">Metas de ${MESES[mIdx]}</div>
        <a class="card__hint" href="#metas">Ver metas →</a></div>
      ${metasMes.map(m => `<div class="item-row"><span class="check"></span>
        <div class="item-row__main"><div class="item-row__title">${escapeHtml(m.texto)}</div></div></div>`).join("")}
    </div>` : ""}
  </div>
  ${renderConsultorioCard()}
  ${kpis.length ? `<div class="grid grid-${Math.min(3, kpis.length)} mt-24">${kpis.join("")}</div>` : ""}

  <div class="card mt-24" style="background:linear-gradient(120deg, var(--surface), var(--surface-2))">
    <div class="flex-between" style="flex-wrap:wrap;gap:14px">
      <div class="row" style="gap:14px;align-items:flex-start">
      <div class="account__avatar avatar-lg${marcoClase()}" data-action="av-abrir" title="Cambiar avatar" role="button" tabindex="0">${avatarActualHtml(((s.profile.name || "R").trim()[0] || "R").toUpperCase())}</div>
      <div>
        <div class="card__title">${escapeHtml(s.profile.name)}</div>
        <div class="text-sm muted">${escapeHtml(s.profile.motto)}${s.profile.birthDate ? ` · ${edadTexto(s.profile.birthDate)}` : ""}</div>
        <div class="row-wrap" style="gap:8px;margin-top:10px">
          <span class="chip chip--cian">${rankFor(s.gamif.xp || 0).cur.icon} ${rankFor(s.gamif.xp || 0).cur.nombre}</span>
          ${tituloEquipado() ? `<span class="chip">${tituloEquipado().icon} ${escapeHtml(tituloEquipado().nombre)}</span>` : ""}
          ${insigniaDestacada() ? `<span class="chip chip--coral">${insigniaDestacada().icon} ${escapeHtml(insigniaDestacada().nombre)}</span>` : ""}
          <a class="chip" href="#recompensas" style="text-decoration:none">🏆 Ver recompensas</a>
        </div>
      </div></div>
      <button class="btn-ghost" data-action="edit-profile">✎ Editar perfil</button>
    </div>
  </div>`;
}

/* Todo en un lugar: tus secciones a un toque, como los servicios en la portada de una app
   de viajes (en el celular; en el computador ya están en el menú de la izquierda) */
function renderAtajos() {
  const mods = typeof modulosMas === "function" ? modulosMas().slice(0, 4) : [];
  if (mods.length < 2) return "";
  return `<section class="atajos" aria-label="Todo en un lugar">
    <div class="atajos__head"><h2>Todo en un lugar</h2><button class="atajos__todo" data-action="open-menu">Ver todo</button></div>
    <div class="atajos__grid">${mods.map(r => `<button class="atajo" data-route="${r.id}">${iconoLinea(r.id, 24)}<span>${escapeHtml(r.label)}</span></button>`).join("")}</div>
  </section>`;
}

function statCard(ico, label, value, sub, pct) {
  return `<div class="card">
    <div class="flex-between" style="align-items:flex-start">
      <div class="stat">
        <div class="stat__label">${label}</div>
        <div class="stat__value">${value}</div>
        <div class="text-xs muted">${sub || ""}</div>
      </div>
      <div class="stat__ico">${icoHab(ico, 20)}</div>
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
  document.title = STATE.settings.appName + " · Un bocado a la vez";
  saveState(); closeModal(); rerender(); toast("Perfil actualizado");
}

/* ============================================================
   CUENTA · seguridad, datos y sesión
   ============================================================ */
/* Cuenta: ¿se puede entrar con Google? Si no, ofrece vincularlo (se completa después de dibujar) */
async function cargarVinculoGoogle() {
  const caja = document.getElementById("acc-google");
  if (!caja || !BACKEND.googleDisponible || !(await BACKEND.googleDisponible())) return;
  const ids = await BACKEND.identidades();
  const g = ids.find(i => i.provider === "google");
  if (!document.body.contains(caja)) return;
  caja.innerHTML = iconizar(`<div class="card mt-16"><div class="flex-between" style="flex-wrap:wrap;gap:10px">
    <div style="min-width:0"><div class="card__title" style="font-size:15px">🔗 Entrar con Google</div>
      <div class="text-sm muted mt-8">${g ? `✅ Vinculada con <b>${escapeHtml(g.email || "tu Google")}</b>: puedes entrar con tu correo o con Google, es la misma cuenta.`
        : "Agrega tu Google como otra forma de entrar a esta misma cuenta (aunque sea otro correo). Tus datos no cambian."}</div></div>
    ${g ? "" : `<button class="btn btn--soft" data-action="acc-vincular-google">Vincular con Google</button>`}</div></div>`);
}
async function vincularGoogle() {
  const res = await BACKEND.vincularGoogle();   // si todo va bien, la página se va a Google y vuelve a Cuenta
  if (res && res.error) toast(res.error, true);
}
function renderCuenta() {
  const email = (CURRENT_USER && CURRENT_USER.email) || "";
  setTimeout(cargarVinculoGoogle, 0);
  return `
  <div class="card">
    <div class="card__title">👤 Tu cuenta</div>
    <div class="mt-8 text-sm soft">Sesión iniciada como <b>${escapeHtml(email)}</b></div>
  </div>

  <button type="button" class="card mt-16 cuenta-apariencia" data-route="apariencia">
    <span class="cuenta-apariencia__ico">${iconoLinea("personalizar", 22)}</span>
    <span class="cuenta-apariencia__tx"><b>Apariencia</b><small>Tu tema (de día, de noche o automático), títulos, marcos y efectos</small></span>${iconoLinea("chevron", 18)}</button>

  ${renderAvatarCuenta()}

  <div id="acc-google"></div>

  ${renderGcalCard()}

  <div class="card mt-16">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px"><div><div class="card__title" style="font-size:15px">📖 Introducción</div>
      <div class="text-sm muted mt-8">Vuelve a ver el recorrido por Rumbo.</div></div>
      <button class="btn btn--soft" data-action="show-tutorial">📖 Ver introducción</button></div>
  </div>

  <div class="card mt-16">
    <div class="card__title" style="font-size:15px">🔑 Contraseña</div>
    <div class="field mt-16"><label>Nueva contraseña</label>
      <input class="input" type="password" id="acc-pass" placeholder="Mínimo 6 caracteres"></div>
    <button class="btn btn--soft btn-block" data-action="acc-change-pass">Actualizar contraseña</button>
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

  <div class="card mt-16">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px"><div><div class="card__title" style="font-size:15px">↩ Sesión</div>
      <div class="text-sm muted mt-8">Tus datos quedan guardados en tu cuenta.</div></div>
      <button class="btn btn--soft" data-action="logout">Cerrar sesión</button></div>
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
/* title es texto (sus emojis pasan a íconos); con op.tituloHtml es HTML ya escapado (para un ícono que eligió la persona) */
function openModal(title, bodyHtml, op) {
  // La ventana se reutiliza: al abrirse de nuevo parte desde arriba (si ya estaba abierta, conserva su posición)
  if (document.getElementById("modalOverlay").hidden) document.getElementById("modal").scrollTop = 0;
  document.getElementById("modal").classList.toggle("modal--ancho", !!(op && op.ancho));
  document.getElementById("modal").classList.remove("modal--hoja");
  document.getElementById("modalTitle").innerHTML = op && op.tituloHtml ? iconizar(title) : iconizarTexto(title);
  document.getElementById("modalBody").innerHTML = iconizar(bodyHtml);
  document.getElementById("modalOverlay").hidden = false;
}
function closeModal() { ONB_ACTIVE = false; document.getElementById("modalOverlay").hidden = true; }
document.addEventListener("click", e => { if (e.target.id === "modalOverlay") closeModal(); });

let toastTimer = null;
function toast(msg, coral = false) {
  const t = document.getElementById("toast");
  t.innerHTML = iconizarTexto(msg); t.className = "toast" + (coral ? " toast--coral" : ""); t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
/* Los emojis van como entidad (&#x…;): se ven igual, pero iconizar (iconos.js) no los cambia por un ícono, así lo que escribes tú queda como lo escribiste */
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])).replace(/\p{Extended_Pictographic}/gu, c => "&#x" + c.codePointAt(0).toString(16) + ";"); }
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
