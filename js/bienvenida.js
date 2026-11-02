/* ============================================================
   RUMBO · Bienvenida: lo que vive quien recién llega.
   · El día en que se creó la cuenta (settings.alta, "YYYY-MM-DD"): solo se guarda en
     las cuentas nuevas, al empezar la bienvenida. Con él, Rumbo no pide cerrar meses
     que la persona no vivió. Quien ya usaba la app no tiene alta y todo sigue igual.
   ============================================================ */

/* -------- El día de la cuenta -------- */
function cuentaAlta(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  const a = S && S.settings && S.settings.alta;
  return typeof a === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : null;
}
/* Al empezar la bienvenida de una cuenta nueva: hoy, o el primer día que ya tenga anotado */
function marcarAlta(S) {
  S = S || STATE;
  if (!S || !S.settings || S.settings.onboarded || cuentaAlta(S)) return false;
  const hoy = todayISO();
  const dias = Object.keys((S.ritual && S.ritual.dias) || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k < hoy).sort();
  S.settings.alta = dias.length ? dias[0] : hoy;
  return true;
}
/* ¿Ese mes terminó antes de que existiera la cuenta? (m de 0 a 11) */
function mesAntesDeLaCuenta(y, m, S) {
  const a = cuentaAlta(S);
  return !!a && `${y}-${String(m + 1).padStart(2, "0")}` < a.slice(0, 7);
}

/* -------- Saludo -------- */
const LEMA_DE_FABRICA = "Construyendo mi mejor versión";   // el lema que trae defaultState: no se muestra como si fuera suyo
/* «¡Hola, Camila!»: para todas las personas (en vez de «Bienvenido») */
function primerNombre() {
  const n = ((STATE && STATE.profile && STATE.profile.name) || (typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.name) || "").trim();
  return n && n !== "Tú" ? n.split(/\s+/)[0] : "";
}
function saludoBienvenida() { const n = primerNombre(); return n ? `¡Hola, ${n}! 👋` : "¡Hola! 👋"; }

/* ============================================================
   «Arma tu Rumbo»: la bienvenida que pregunta (cuentas nuevas)
   4 preguntas que se responden tocando: qué quieres ordenar primero, tus primeros
   hábitos (1 a 3, o una rutina armada de regalo), tu elefante con su nombre y cuándo
   te aviso. Reemplaza a las láminas y a «Cuéntanos de ti»; las láminas siguen en Ayuda.
   ============================================================ */
const ARMA_AREAS = [
  { id: "dia", t: "Mi día y mis tareas", mods: [] },
  { id: "habitos", t: "Mis hábitos", mods: [] },
  { id: "metas", t: "Mis metas", mods: ["metas"] },
  { id: "plata", t: "Mi plata", mods: ["finanzas"] },
  { id: "salud", t: "Mi salud", mods: ["salud"] },
  { id: "lecturas", t: "Mis lecturas", mods: ["lecturas"] },
  { id: "amigos", t: "Con amigos", mods: ["amigos"] },
  { id: "gente", t: "Mi gente", mods: ["relaciones"] },
];
/* Hábitos para partir: chicos y con frecuencia real (3 por semana cuenta como 100 %) */
const HAB_SUGERENCIAS = [
  { id: "leer", icon: "📖", nombre: "Leer 10 minutos", frecuencia: { tipo: "semanal", veces: 3 }, areas: ["lecturas"] },
  { id: "caminar", icon: "🏃", nombre: "Caminar 20 minutos", frecuencia: { tipo: "semanal", veces: 3 }, areas: ["salud"] },
  { id: "dormir", icon: "🛏️", nombre: "Dormir antes de las 12", frecuencia: { tipo: "diario" }, areas: ["salud"] },
  { id: "meditar", icon: "🧘", nombre: "Meditar 5 minutos", frecuencia: { tipo: "semanal", veces: 3 }, areas: [] },
  { id: "entrenar", icon: "🏋️", nombre: "Entrenar", frecuencia: { tipo: "semanal", veces: 3 }, areas: ["salud"] },
  { id: "fruta", icon: "🥗", nombre: "Comer una fruta", frecuencia: { tipo: "diario" }, areas: ["salud"] },
  { id: "ordenar", icon: "🧹", nombre: "Ordenar 10 minutos", frecuencia: { tipo: "diario" }, areas: ["dia"] },
  { id: "llamar", icon: "📞", nombre: "Llamar a alguien querido", frecuencia: { tipo: "semanal", veces: 1 }, areas: ["gente", "amigos"] },
  { id: "fumar", icon: "🚭", nombre: "Dejar de fumar", meta: "dejar", frecuencia: { tipo: "diario" }, areas: [] },
];
const HAB_MAX_INICIO = 3;
/* Los 8 que traía defaultState (los del bullet journal con que nació Rumbo): las cuentas nuevas eligen los suyos */
const HABITOS_DE_FABRICA = ["Deporte", "Lectura", "Estudio", "Música", "Alimento", "Agua", "Meditar", "Vitaminas"];

/* Saca los hábitos de fábrica que nadie usó (sin marcas, sin ts: no los creó la persona). Solo antes de la bienvenida. */
function quitarHabitosDeFabrica(S) {
  if (!S || !S.habitos || !Array.isArray(S.habitos.defs) || (S.settings && S.settings.onboarded)) return 0;
  const usados = new Set();
  Object.values(S.habitos.log || {}).forEach(m => Object.keys(m || {}).forEach(id => { if (Object.values(m[id] || {}).some(Boolean)) usados.add(id); }));
  const antes = S.habitos.defs.length;
  S.habitos.defs = S.habitos.defs.filter(h => !(h && HABITOS_DE_FABRICA.includes(h.nombre) && !h.ts && !h.conjunto && !usados.has(h.id)));
  return antes - S.habitos.defs.length;
}
/* Un hábito de las sugerencias, listo para guardar */
function habDeSugerencia(s, hoy) {
  const h = { id: uid(), nombre: s.nombre, icon: s.icon, frecuencia: JSON.parse(JSON.stringify(s.frecuencia)), creado: hoy, ts: Date.now() };
  if (s.meta) h.meta = s.meta;
  return h;
}
function agregarSugerencia(S, sid, hoy) {
  const s = HAB_SUGERENCIAS.find(x => x.id === sid); if (!s) return null;
  if (S.habitos.defs.some(h => h.nombre.trim().toLowerCase() === s.nombre.toLowerCase())) return null;
  const h = habDeSugerencia(s, hoy || todayISO()); S.habitos.defs.push(h); return h;
}
/* Lo que se elige en «Arma tu Rumbo», aplicado al estado (sin pantallas: lo usan las pruebas) */
function armaAplicar(S, A, hoy) {
  hoy = hoy || todayISO();
  quitarHabitosDeFabrica(S);
  (A.habitos || []).slice(0, HAB_MAX_INICIO).forEach(id => agregarSugerencia(S, id, hoy));
  if (A.plantilla && typeof PLANTILLAS !== "undefined" && PLANTILLAS.some(p => p.id === A.plantilla)) {
    ledgerRegistrar(S, "compra:fun-plantilla-" + A.plantilla, 0, 0, "Regalo de bienvenida");   // la rutina armada, de regalo
    aplicarPlantilla(S, A.plantilla, hoy);
  }
  if (A.tipo) { const e = eleTocar(S); e.tipo = A.tipo; if (e.etapaVista == null) e.etapaVista = etapaElefante((S.gamif && S.gamif.xp) || 0).idx; e.nombre = String(A.nombre || "").trim().slice(0, 20); }
  S.settings.bienvenida = { areas: (A.areas || []).slice(), verTodo: !!A.verTodo, ts: Date.now() };
  S.settings.aperturaSimple = true;   // la primera semana se abre el día en versión corta (modules2.js)
  if (S.profile && S.profile.motto === LEMA_DE_FABRICA) S.profile.motto = "";
  return S;
}

let ARMA = null;   // { paso, areas, habitos, plantilla, otro, tipo, nombre, manana, noche, verTodo }
function armaActiva() { return !!ARMA; }
function armaIniciar() {
  const n = (STATE.settings.notif || {}), e = eleEstado();
  ARMA = { paso: 0, areas: ["dia", "habitos"], habitos: [], plantilla: null, otro: false, tipo: e.tipo || "clasico", nombre: e.nombre || "",
    manana: n.manana || "08:00", noche: n.noche || "21:30", verTodo: false };
  ONB_ACTIVE = false;
  armaPintar();
}
function armaSoporte() { return typeof soportePush === "function" ? soportePush() : "no"; }
function armaTotal() { return armaSoporte() === "no" ? 3 : 4; }
function armaLeer() {
  if (!ARMA) return;
  const n = document.getElementById("arma-nombre"); if (n) ARMA.nombre = n.value.trim().slice(0, 20);
  const m = document.getElementById("arma-manana"); if (m && m.value) ARMA.manana = m.value;
  const no = document.getElementById("arma-noche"); if (no && no.value) ARMA.noche = no.value;
}
function armaPuntos() { const t = armaTotal(); return `<div class="onb-dots" aria-label="Paso ${ARMA.paso + 1} de ${t}">${Array.from({ length: t }, (_, i) => `<span class="onb-dot ${i === ARMA.paso ? "is-on" : ""}"></span>`).join("")}</div>`; }
function armaSugerencias() {
  // primero las que calzan con lo que quiere ordenar
  const quiere = new Set(ARMA.areas);
  return HAB_SUGERENCIAS.slice().sort((a, b) => (b.areas.some(x => quiere.has(x)) ? 1 : 0) - (a.areas.some(x => quiere.has(x)) ? 1 : 0));
}
function armaCuantos() {
  const p = ARMA.plantilla && typeof PLANTILLAS !== "undefined" ? PLANTILLAS.find(x => x.id === ARMA.plantilla) : null;
  return ARMA.habitos.length + (p ? p.habitos.length : 0);
}
function armaPintar() {
  if (!ARMA) return;
  const A = ARMA, t = armaTotal();
  const atras = `<button class="btn-ghost" data-action="arma-atras">Atrás</button>`;
  if (A.paso === 0) {
    openModal(saludoBienvenida(), `<div class="arma">
      <h3 class="arma__h">¿Qué quieres ordenar primero?</h3>
      <p class="arma__p">Elige una o más. Te muestro primero lo tuyo; lo demás queda a mano en Más.</p>
      <div class="arma-chips">${ARMA_AREAS.map(a => { const on = A.areas.includes(a.id); return `<button type="button" class="arma-chip ${on ? "is-on" : ""}" data-action="arma-area" data-id="${a.id}" aria-pressed="${on}">${escapeHtml(a.t)}</button>`; }).join("")}</div>
      ${armaPuntos()}
      <div class="onb-nav"><button class="btn-ghost" data-action="arma-saltar">Saltar y ver todo</button><button class="btn btn--primary" data-action="arma-sig">Siguiente</button></div></div>`);
  } else if (A.paso === 1) {
    const n = armaCuantos();
    const rutinas = typeof PLANTILLAS !== "undefined" ? PLANTILLAS : [];
    openModal("Tus primeros hábitos", `<div class="arma">
      <p class="arma__p">Empieza con 1 a ${HAB_MAX_INICIO}. Tu jardín crece igual con pocos, y siempre puedes sumar más.</p>
      <div class="arma-chips">${armaSugerencias().map(s => { const on = A.habitos.includes(s.id); return `<button type="button" class="arma-chip arma-chip--hab ${on ? "is-on" : ""}" data-action="arma-hab" data-id="${s.id}" aria-pressed="${on}">${icoHab(s.icon, 16)} ${escapeHtml(s.nombre)}<small>${s.meta === "dejar" ? "días sin" : escapeHtml(hmFreqLabel({ frecuencia: s.frecuencia }).toLowerCase())}</small></button>`; }).join("")}
        <button type="button" class="arma-chip ${A.otro ? "is-on" : ""}" data-action="arma-otro" aria-pressed="${A.otro}">${iconoLinea("personalizar", 16)} Otro, lo escribo yo</button></div>
      ${rutinas.length ? `<div class="arma__sub">O una rutina armada, de regalo</div>
      <div class="arma-rutinas">${rutinas.map(p => { const on = A.plantilla === p.id; return `<button type="button" class="arma-rutina ${on ? "is-on" : ""}" data-action="arma-rutina" data-id="${p.id}" aria-pressed="${on}">
        <span class="arma-rutina__t">${icoHab(p.icon, 18)} ${escapeHtml(p.nombre)}</span><span class="arma-rutina__d">${p.habitos.map(h => escapeHtml(h[1])).join(" · ")}</span></button>`; }).join("")}</div>
      <p class="arma__nota">La rutina suma sus hábitos y tareas que se repiten. Las demás siguen en la Tienda.</p>` : ""}
      ${armaPuntos()}
      <div class="onb-nav">${atras}<button class="btn btn--primary" data-action="arma-sig">${n ? `Plantar ${n} ${n === 1 ? "hábito" : "hábitos"}` : A.otro ? "Siguiente" : "Seguir sin hábitos"}</button></div></div>`);
  } else if (A.paso === 2) {
    const tipos = ["clasico", "asiatico"].filter(id => typeof TIPOS_ELEFANTE !== "undefined" && TIPOS_ELEFANTE[id]);
    openModal("Te presento a tu compañero", `<div class="arma">
      <div class="arma-ele">${elefanteSVG({ tipo: A.tipo, etapa: 0, ropa: {}, animo: "feliz" })}</div>
      <p class="arma__p">Te acompaña, crece con tu constancia y te explica lo que no entiendas.</p>
      <div class="seg arma-seg" role="radiogroup" aria-label="Tu elefante">${tipos.map(id => `<button type="button" role="radio" aria-checked="${A.tipo === id}" class="${A.tipo === id ? "is-active" : ""}" data-action="arma-tipo" data-id="${id}">${escapeHtml(TIPOS_ELEFANTE[id].n)}</button>`).join("")}</div>
      <div class="field mt-16"><label for="arma-nombre">¿Cómo se llama?</label><input class="input" id="arma-nombre" maxlength="20" autocomplete="off" placeholder="Ej: Tito" value="${escapeAttr(A.nombre)}"></div>
      ${armaPuntos()}
      <div class="onb-nav">${atras}<button class="btn btn--primary" data-action="arma-sig">${t === 3 ? "Empezar" : "Listo"}</button></div></div>`);
  } else {
    const sop = armaSoporte(), quien = nombreDelElefante() || "Tu elefante";
    const dice = txt => `<div class="arma-dice"><span class="arma-cara">${elefanteCaraSVG()}</span><div class="arma-burbuja"><b>${escapeHtml(quien)}</b>${txt}</div></div>`;
    openModal("¿Cuándo te aviso?", `<div class="arma">
      ${sop === "ios_instalar"
        ? dice("En iPhone, los avisos llegan cuando agregas Rumbo a tu pantalla de inicio (Compartir › Agregar a inicio) y lo abres desde ahí. Después los activas en Notificaciones.")
          + `${armaPuntos()}<div class="onb-nav">${atras}<button class="btn btn--primary" data-action="arma-fin">Entendido</button></div>`
        : dice("Te recuerdo abrir tu día en la mañana y cerrarlo en la noche. Nada más.")
          + `<div class="arma-horas"><label class="field"><span>Mañana</span><input class="input" type="time" id="arma-manana" value="${escapeAttr(A.manana)}"></label>
            <label class="field"><span>Noche</span><input class="input" type="time" id="arma-noche" value="${escapeAttr(A.noche)}"></label></div>
            <p class="arma__nota">No llegan si ya abriste o cerraste el día. Los cambias cuando quieras en Notificaciones.</p>
            ${armaPuntos()}<div class="onb-nav"><button class="btn-ghost" data-action="arma-fin">Ahora no</button><button class="btn btn--primary" data-action="arma-avisos">Activar avisos</button></div>`}</div>`);
  }
}
function armaAccion(a, d) {
  if (!ARMA) return false;
  armaLeer();
  const A = ARMA;
  if (a === "arma-area") { A.areas = A.areas.includes(d.id) ? A.areas.filter(x => x !== d.id) : A.areas.concat(d.id); armaPintar(); return true; }
  if (a === "arma-hab") {
    if (A.habitos.includes(d.id)) A.habitos = A.habitos.filter(x => x !== d.id);
    else if (A.habitos.length >= HAB_MAX_INICIO) toast(`Con ${HAB_MAX_INICIO} basta para partir: después sumas más`);
    else A.habitos = A.habitos.concat(d.id);
    armaPintar(); return true;
  }
  if (a === "arma-otro") { A.otro = !A.otro; armaPintar(); return true; }
  if (a === "arma-rutina") { A.plantilla = A.plantilla === d.id ? null : d.id; armaPintar(); return true; }
  if (a === "arma-tipo") { A.tipo = d.id; armaPintar(); return true; }
  if (a === "arma-atras") { A.paso = Math.max(0, A.paso - 1); armaPintar(); return true; }
  if (a === "arma-sig") { if (A.paso + 1 >= armaTotal()) { armaTerminar(false); return true; } A.paso++; if (A.paso === 3) armaGuardarElefante(); armaPintar(); return true; }
  if (a === "arma-saltar") { A.verTodo = true; A.habitos = []; A.plantilla = null; A.tipo = eleEstado().tipo || null; armaTerminar(false); return true; }
  if (a === "arma-fin") { armaTerminar(false); return true; }
  if (a === "arma-avisos") { armaTerminar(true); return true; }
  return false;
}
/* El elefante se guarda al pasar a los avisos: así el último paso ya habla con su cara */
function armaGuardarElefante() {
  if (!ARMA || !ARMA.tipo) return;
  const e = eleTocar(); e.tipo = ARMA.tipo; e.nombre = ARMA.nombre; if (e.etapaVista == null) e.etapaVista = etapaElefante(STATE.gamif.xp || 0).idx;
  saveState(); if (typeof pintarPuertas === "function") pintarPuertas();
}
function armaTerminar(conAvisos) {
  if (!ARMA) return;
  const A = ARMA; ARMA = null;
  armaAplicar(STATE, A, todayISO());
  STATE.settings.onboarded = true; STATE.settings.introVersion = INTRO_VERSION;
  ONB_ACTIVE = false;
  if (conAvisos) {
    const n = STATE.settings.notif = STATE.settings.notif || { subs: [] };
    n.manana = A.manana || "08:00"; n.noche = A.noche || "21:30";
  }
  saveState(); if (typeof flushCloudSave === "function") flushCloudSave();   // que los hábitos de fábrica no vuelvan desde la nube
  closeModal(); updateTopbar(); rerender();
  const seguir = () => {
    if (typeof amigosHayInvitacion === "function" && amigosHayInvitacion()) return setTimeout(amigosAlEntrar, 400);   // la invitación de un amigo va primero
    setTimeout(() => tourIniciar("general", { alTerminar: A.otro ? () => setTimeout(() => { go("habitos"); setTimeout(() => openHabitModal(), 350); }, 300) : null }), 400);
  };
  if (conAvisos && typeof enableNotifications === "function") enableNotifications().finally(seguir);   // el permiso se pide en el mismo toque
  else seguir();
}

/* -------- Tu elefante: su nombre -------- */
function nombreDelElefante(S) {
  S = S || STATE;
  const n = S && S.gamif && S.gamif.equipped && S.gamif.equipped.ele && S.gamif.equipped.ele.nombre;
  return typeof n === "string" ? n.trim() : "";
}
function openNombreElefante() {
  openModal("El nombre de tu elefante", `<div class="field"><label for="ele-nombre">¿Cómo se llama?</label>
    <input class="input" id="ele-nombre" maxlength="20" autocomplete="off" placeholder="Ej: Tito" value="${escapeAttr(nombreDelElefante())}"></div>
    <p class="text-xs muted">Es quien te explica las cosas en Rumbo. Déjalo en blanco si prefieres «tu elefante».</p>
    <div class="modal__cta"><button class="btn btn--primary btn-block" data-action="ele-nombre-ok">Guardar</button></div>`);
  setTimeout(() => { const i = document.getElementById("ele-nombre"); if (i) i.focus(); }, 60);
}
function guardarNombreElefante() {
  const v = (document.getElementById("ele-nombre") || {}).value || "";
  eleTocar().nombre = v.trim().slice(0, 20);
  saveState(); closeModal(); rerender();
  toast(nombreDelElefante() ? `🐘 Ahora se llama ${nombreDelElefante()}` : "🐘 Listo: es «tu elefante»");
}

/* ============================================================
   La primera semana (los 7 días desde el día de la cuenta)
   ============================================================ */
function diasEntreISO(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
/* 1 = el día de la cuenta; 0 = sin alta (cuenta de antes) */
function primeraSemanaDia(S, hoy) { const a = cuentaAlta(S); return a ? diasEntreISO(a, hoy || todayISO()) + 1 : 0; }
function primeraSemanaActiva(S, hoy) { const d = primeraSemanaDia(S, hoy); return d >= 1 && d <= 7; }
function yaCerroUnDia(S) { S = S || STATE; return Object.values((S.ritual && S.ritual.dias) || {}).some(r => r && r.cerrado); }

/* Inicio en la primera semana: los rituales grandes esperan. Hasta que cierra su primer día (o el día 3),
   ninguno; después, uno a la vez (el más urgente). «Planifica tu semana», desde el día 3 o el domingo. */
function inicioRitualesPrimeraSemana() {
  const d = primeraSemanaDia();
  if (!yaCerroUnDia() && d < 3) return "";
  const semana = d >= 3 || new Date().getDay() === 0;
  return renderTrimestreBanner() || renderMesBanner(1) || (semana ? renderSemanaBanner() : "");
}
/* Lo que dice tu elefante arriba de tu día, la primera semana */
function inicioGuiaHtml() {
  if (!primeraSemanaActiva()) return "";
  const st = dayState(), nombre = primerNombre(), quien = nombreDelElefante() || "Tu elefante";
  const txt = st === "por-abrir" ? `Hoy solo una cosa${nombre ? ", " + escapeHtml(nombre) : ""}: <b>abre tu día</b>. Eliges lo más importante y listo.`
    : st === "en-curso" ? `Bien. Ahora, a tu <b>${glosa("bocado", BOCADO.corto.toLowerCase())}</b>: lo más importante primero. En la noche vuelves para cerrar el día.`
    : st === "por-cerrar" ? "Es hora de <b>cerrar tu día</b>: decides qué pasa con lo pendiente y anotas cómo te fue. Son 2 minutos."
    : "Día cerrado. Mañana te espero para abrir el siguiente.";
  const cara = eleEstado().tipo ? `<span class="guia__cara">${elefanteCaraSVG()}</span>` : `<span class="guia__cara guia__cara--sin">${icoHab("🐘", 22)}</span>`;
  return `<div class="guia" role="note">${cara}<div class="guia__burbuja"><b class="guia__quien">${escapeHtml(quien)}</b><span>${txt}</span></div></div>`;
}
/* La portilla de agua, la primera semana, espera a que registres tu primer vaso (en la tarjeta de Inicio) */
function aguaEsperaPrimerVaso() {
  if (!primeraSemanaActiva()) return false;
  const dias = (typeof aguaDatos === "function" ? aguaDatos().dias : null) || {};
  return !Object.values(dias).some(d => d && (typeof aguaTotal === "function" ? aguaTotal(d) : +d.ml || 0) > 0);
}

/* Hábitos sin ningún hábito: tu primero, a un toque */
function habPrimerHtml() {
  const tiene = new Set(STATE.habitos.defs.map(h => h.nombre.trim().toLowerCase()));
  const sug = HAB_SUGERENCIAS.filter(s => !tiene.has(s.nombre.toLowerCase()));
  return `<div class="card mt-16 hab-primero">
    <div class="card__title">Tu primer hábito</div>
    <p class="text-sm soft mt-8">Elige uno chico: tocarlo lo agrega. Con 1 a 3 basta para partir, y tu jardín crece igual con pocos.</p>
    <div class="arma-chips mt-16">${sug.map(s => `<button type="button" class="arma-chip arma-chip--hab" data-action="bv-hab" data-id="${s.id}">${icoHab(s.icon, 16)} ${escapeHtml(s.nombre)}<small>${s.meta === "dejar" ? "días sin" : escapeHtml(hmFreqLabel({ frecuencia: s.frecuencia }).toLowerCase())}</small></button>`).join("")}</div>
    <div class="row mt-16" style="gap:8px;flex-wrap:wrap"><button class="btn btn--primary" data-action="habit-add">+ Crear uno propio</button>
      <button class="btn-ghost" data-action="plantillas-open">${icoHab("📋", 16)} Rutinas armadas</button></div>
  </div>`;
}
function bienvenidaAccion(a, d) {
  const b = STATE.settings.bienvenida;
  if (a === "bv-hab") {
    const h = agregarSugerencia(STATE, d.id, todayISO());
    if (!h) return toast("Ese hábito ya lo tienes");
    saveState(); rerender(); return toast(`${h.nombre}: listo, ya está en tus hábitos`);
  }
  if (a === "bv-ir") return psIr(d.id);
  if (a === "bv-ver-todo") { cerrarMas(); verTodasLasSecciones(); return openMas(); }
  if (a === "bv-ocultar") { if (b) { b.fin = "oculta"; b.ts = Date.now(); saveState(); buildNav(); rerender(); } return toast("Tu primera semana quedó oculta · vuelve a mostrarla en Ayuda"); }
  if (a === "bv-cerrar") { if (b) { b.fin = "cerrada"; b.ts = Date.now(); saveState(); buildNav(); rerender(); } return; }
  if (a === "bv-resumen-ok") { if (b) { b.resumen = Date.now(); saveState(); } closeModal(); buildNav(); return rerender(); }
  if (a === "bv-glosa") return openGlosa(d.k);
  if (a === "bv-palabras") return go("tutoriales");
  if (a === "bv-foco") { const el = document.getElementById(d.id); if (el) { el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); } return; }
  if (a === "bv-fin-listo") { rerender(); return toast("Guardado: lo ves en tu torre del año"); }
}
/* Ir al paso que toca de «Tu primera semana» */
function psIr(id) {
  if (id === "abrir") return dayState() === "por-abrir" ? openRitualModal() : toast("Tu día ya está abierto ✓");
  if (id === "cerrar") { const iso = typeof puedeCerrarDia === "function" && puedeCerrarDia(todayISO()) ? todayISO() : null; return iso ? openCierreModal(iso) : toast("Primero abre tu día 🌅", true); }
  if (id === "habito") return go("habitos");
  if (id === "semana") return go("semana");
  if (id === "objetivo") { go("metas"); return setTimeout(() => { const el = document.getElementById("mt-mes-" + new Date().getMonth()); if (el) { el.scrollIntoView({ block: "center" }); el.focus({ preventScroll: true }); } }, 350); }
  if (id === "plata") return go("finanzas");
  if (id === "mas") { verTodasLasSecciones(); setTimeout(() => { openMas(); toast("Estas son todas tus secciones. Con Personalizar ocultas las que no uses."); }, 200); return; }
  if (id === "resumen") return openResumenPrimeraSemana();
}
function modulosTodos() { return typeof ROUTES !== "undefined" ? ROUTES.filter(r => r.id && !r.pie && ROUTE_MAP[r.id] && ROUTE_MAP[r.id].mas) : []; }

/* Al abrir el primer día: el elefante celebra y cuenta qué hacer con las ⭐ y cuándo volver */
function celebrarPrimerDia() {
  if (typeof escenaElefante !== "function" || !eleEstado().tipo) return;
  const quien = nombreDelElefante();
  escenaElefante({ svg: elefanteSVG({ animo: "feliz" }), titulo: "¡Abriste tu primer día!",
    texto: `Ganaste +50 ⭐: se gastan en la Tienda, en cosas para tu día y tu estilo. Esta noche vuelve a cerrarlo: son 2 minutos y +40 ⭐.${quien ? " " + escapeHtml(quien) + " te espera." : ""}`,
    botones: `<button class="btn btn--primary" data-cerrar="1">¡Vamos!</button>`, clase: "is-primero" });
}

/* ============================================================
   «Tu primera semana»: la misión de las cuentas nuevas (reemplaza a «Primeros pasos»)
   Un paso por día, en orden. Cada paso se marca solo con lo que la persona hace de verdad y
   despierta su sección en Más. Si se salta un día, la misión espera: no hay castigo.
   Al completarla: +100 ⭐ e insignia Explorador (recompensas.js).
   ============================================================ */
const PS_PASOS = [
  { id: "abrir", dia: 1, t: "Abre tu día", premio: 50, despierta: ["ritual"],
    check: S => Object.values(S.ritual.dias || {}).some(r => r && r.hecho) },
  { id: "cerrar", dia: 1, t: "Esta noche, ciérralo", premio: 40, despierta: ["diario"],
    check: S => Object.values(S.ritual.dias || {}).some(r => r && r.cerrado) },
  { id: "habito", dia: 2, t: "Marca un hábito", premio: 5, despierta: [],
    check: S => Object.values((S.habitos && S.habitos.log) || {}).some(m => Object.values(m || {}).some(h => Object.values(h || {}).some(Boolean))) },
  { id: "semana", dia: 3, t: "Planifica tu semana (la versión corta)", premio: 75, despierta: ["calendario"],
    check: S => Object.values((S.ritual && S.ritual.semanas) || {}).some(w => w && w.apertura) },
  { id: "objetivo", dia: 4, t: "Un objetivo para este mes", despierta: ["metas"],
    check: S => typeof todosLosMensuales === "function" && todosLosMensuales(S).flat().some(o => o && o.texto) },
  { id: "plata", dia: 5, t: "Tu plata: una alcancía o un gasto del mes", despierta: ["finanzas"],
    check: S => !!((S.alcancias && Array.isArray(S.alcancias.lista) && S.alcancias.lista.length) || (S.finanzas && (S.finanzas.gastos || []).length)
      || (typeof datosAnio === "function" && datosAnio(S, new Date().getFullYear()).finanzas.meses.some(m => (m.ingreso || 0) || (m.gasto || 0)))) },
  { id: "mas", dia: 6, t: "Elige qué más quieres ver", despierta: ["*"],
    check: S => !!(S.settings.bienvenida && S.settings.bienvenida.verTodo) },
  { id: "resumen", dia: 7, t: "Tu primera semana, en números", despierta: ["tendencias"],
    check: S => !!(S.settings.bienvenida && S.settings.bienvenida.resumen) },
];
/* ¿Esta cuenta usa la primera semana? (las que pasaron por «Arma tu Rumbo») */
function usaPrimeraSemana(S) { S = S || STATE; return !!(S && S.settings && S.settings.bienvenida && cuentaAlta(S)); }
function psPasos(S, hoy) {
  S = S || STATE;
  const dia = Math.max(1, primeraSemanaDia(S, hoy));
  let antesOk = true;
  return PS_PASOS.map(p => {
    let ok = false; try { ok = !!p.check(S); } catch (e) { ok = false; }
    const estado = ok ? "ok" : !antesOk ? "luego" : dia >= p.dia ? "ahora" : "luego";
    if (!ok) antesOk = false;
    return Object.assign({}, p, { ok, estado });
  });
}
/* Un paso que llegó se puede hacer aunque el anterior quedó pendiente de otro día: solo «ahora» el primero */
function psActual(S, hoy) { return psPasos(S, hoy).find(p => p.estado === "ahora") || null; }
function primeraSemanaCompleta(S) { S = S || STATE; return usaPrimeraSemana(S) && psPasos(S).every(p => p.ok); }

/* -------- Secciones que despiertan -------- */
const PS_BASE = ["ritual"];
function psDespiertas(S) {
  S = S || STATE;
  const b = S.settings.bienvenida || {};
  const set = new Set(PS_BASE);
  (b.areas || []).forEach(a => { const x = ARMA_AREAS.find(z => z.id === a); if (x) x.mods.forEach(m => set.add(m)); });
  let todo = false;
  psPasos(S).forEach(p => { if (p.ok || p.estado === "ahora") p.despierta.forEach(m => { if (m === "*") todo = true; else set.add(m); }); });
  return { set, todo };
}
/* ¿Esta sección de Más todavía duerme? (solo en la primera semana de una cuenta nueva, hasta «Ver todo») */
function seccionDormida(id, S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S || !usaPrimeraSemana(S)) return false;
  const b = S.settings.bienvenida;
  if (b.verTodo || b.fin || primeraSemanaCompleta(S)) return false;
  const { set, todo } = psDespiertas(S);
  return !todo && !set.has(id);
}
/* Recién despierta: punto «Nuevo» en Más hasta que la visitas */
function seccionNueva(id, S) {
  S = S || STATE;
  if (!usaPrimeraSemana(S) || seccionDormida(id, S)) return false;
  const b = S.settings.bienvenida, vistas = b.vistas || {};
  if (vistas[id]) return false;
  const deArranque = PS_BASE.includes(id) || (b.areas || []).some(a => { const x = ARMA_AREAS.find(z => z.id === a); return x && x.mods.includes(id); });
  return !deArranque && !b.verTodo && psPasos(S).some(p => (p.ok || p.estado === "ahora") && p.despierta.includes(id));
}
function seccionVista(id) {
  if (!STATE || !usaPrimeraSemana()) return;
  const b = STATE.settings.bienvenida; b.vistas = b.vistas || {};
  if (!b.vistas[id] && typeof ROUTE_MAP !== "undefined" && ROUTE_MAP[id] && ROUTE_MAP[id].mas) { b.vistas[id] = Date.now(); saveState(); }
}
function hayDormidas() { return typeof modulosTodos === "function" ? modulosTodos().some(r => seccionDormida(r.id)) : false; }
function verTodasLasSecciones() {
  const b = STATE.settings.bienvenida; if (!b) return;
  b.verTodo = true; b.ts = Date.now(); saveState(); buildNav(); rerender();
  toast("Listo: ya ves todas las secciones de Rumbo");
}

/* -------- La tarjeta en Inicio -------- */
function psCuando(p, S) {
  const a = cuentaAlta(S); if (!a) return "";
  const f = agSumar(a, p.dia - 1), hoy = todayISO();
  if (f <= hoy) return "cuando quieras";
  if (f === agSumar(hoy, 1)) return "mañana";
  return new Date(f + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long" });
}
function primeraSemanaCardHtml() {
  const S = STATE, b = S.settings.bienvenida;
  if (!usaPrimeraSemana(S) || b.fin === "cerrada" || b.fin === "oculta") return "";
  const pasos = psPasos(S), hechos = pasos.filter(p => p.ok).length, dia = Math.min(7, Math.max(1, primeraSemanaDia(S)));
  if (hechos === pasos.length) return `<div class="card mision mision--ok" data-tour="mision" style="margin-bottom:20px">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">🎉 ¡Completaste tu primera semana!</div>
        <div class="text-sm soft mt-8">Ganaste la insignia 🧭 Explorador (+100 ⭐). Ya conoces Rumbo: ahora es tuyo.</div></div>
        <button class="btn btn--primary" data-action="bv-cerrar">Genial</button></div></div>`;
  const fila = p => {
    const ico = p.ok ? "✓" : "";
    const der = p.ok ? "" : p.estado === "ahora" ? (p.premio ? `+${p.premio} ⭐` : "") : psCuando(p, S);
    const tag = p.estado === "ahora" ? "button" : "div";
    return `<${tag} class="ps-paso is-${p.estado}" ${p.estado === "ahora" ? `data-action="bv-ir" data-id="${p.id}"` : ""}>
      <span class="check ${p.ok ? "is-on" : ""}">${ico}</span><span class="ps-paso__t">${escapeHtml(p.t)}</span>${der ? `<span class="ps-paso__d">${escapeHtml(der)}</span>` : ""}</${tag}>`;
  };
  return `<div class="card mision ps" data-tour="mision" style="margin-bottom:20px">
    <div class="card__head"><div class="card__title">🚀 Tu primera semana <span class="muted" style="font-weight:500">· día ${dia} de 7</span></div>
      <button class="btn-ghost" data-action="bv-ocultar" title="Puedes volver a mostrarla en Ayuda">Ocultar</button></div>
    <div class="bar"><div class="bar__fill" style="width:${Math.round((hechos / pasos.length) * 100)}%"></div></div>
    <div class="ps__pasos mt-16">${pasos.map(fila).join("")}</div>
    <div class="text-xs muted mt-8">Se marcan solos cuando los haces, y cada uno abre su sección. Si te saltas un día, la misión te espera. Al terminarla: +100 ⭐ e insignia Explorador.</div>
  </div>`;
}
/* -------- Tu primera semana, en números (el paso del día 7) -------- */
function psResumen(S) {
  S = S || STATE;
  const a = cuentaAlta(S) || todayISO(), hoy = todayISO();
  const dias = Object.keys(S.ritual.dias || {}).filter(k => k >= a && k <= hoy).map(k => S.ritual.dias[k]);
  let marcas = 0;
  Object.entries((S.habitos && S.habitos.log) || {}).forEach(([mk, m]) => {
    const [y, mo] = mk.split("-").map(Number);
    Object.values(m || {}).forEach(h => Object.entries(h || {}).forEach(([d, v]) => { const iso = `${y}-${String(mo).padStart(2, "0")}-${String(+d).padStart(2, "0")}`; if (v && iso >= a && iso <= hoy) marcas++; }));
  });
  let tareas = 0;
  Object.entries((S.agenda && S.agenda.dias) || {}).forEach(([k, l]) => { if (k >= a && k <= hoy && Array.isArray(l)) tareas += l.filter(t => t && !t.borrada && typeof estadoTarea === "function" && estadoTarea(t) === "hecha").length; });
  const desde = new Date(a + "T00:00:00").getTime();
  const estrellas = (S.gamif.ledger || []).filter(m => m && !m.anulado && (m.ts || 0) >= desde && (m.delta || 0) > 0).reduce((x, m) => x + m.delta, 0);
  return { abiertos: dias.filter(r => r && r.hecho).length, cerrados: dias.filter(r => r && r.cerrado).length, marcas, tareas, estrellas };
}
function openResumenPrimeraSemana() {
  const r = psResumen(), quien = nombreDelElefante() || "Tu elefante";
  const n = (v, t) => `<div class="stat"><div class="stat__value">${v}</div><div class="stat__label">${t}</div></div>`;
  openModal("Tu primera semana", `
    <div class="arma-dice"><span class="arma-cara">${eleEstado().tipo ? elefanteCaraSVG() : icoHab("🐘", 22)}</span><div class="arma-burbuja"><b>${escapeHtml(quien)}</b>Mira todo lo que hiciste en tu primera semana. Lo que viene es lo mismo: abrir, hacer lo importante y cerrar.</div></div>
    <div class="ps-numeros mt-16">${n(r.abiertos, "días abiertos")}${n(r.cerrados, "días cerrados")}${n(r.marcas, "hábitos marcados")}${n(r.tareas, "tareas hechas")}${n(r.estrellas + " ⭐", "ganadas")}</div>
    <div class="section-title mt-24">Lo que viene</div>
    <ul class="ps-viene">
      <li>En <b>Tendencias</b> ya empiezas a ver tus gráficos: cada día cerrado suma un punto.</li>
      <li>El domingo (o el lunes) cierras tu semana y planificas la siguiente: +75 ⭐ cada uno.</li>
      ${STATE.profile.birthDate ? "" : `<li>Si quieres, pon tu fecha de nacimiento en <b>Editar perfil</b> para ver tu contador de vida.</li>`}
    </ul>
    <div class="modal__cta"><button class="btn btn--primary btn-block" data-action="bv-resumen-ok">Seguir con mi Rumbo</button></div>`);
}

/* ============================================================
   Palabras de Rumbo: «¿Qué es esto?», a un toque (las explica tu elefante)
   La primera semana van con un subrayado punteado; todas juntas, en Ayuda.
   ============================================================ */
const GLOSARIO = {
  bocado: { t: "Primer bocado", d: "La tarea más importante del día. Viene del dicho: ¿cómo te comes un elefante? Un bocado a la vez. Hazla primero y lo demás pesa menos." },
  ritual: { t: "Ritual", d: "Abrir y cerrar un ciclo: tu día (cada día), tu semana, tu mes y tu trimestre. Son minutos, y mantienen vivo todo lo demás." },
  express: { t: "Express", d: "Para días apretados: abres o cierras tu día en 3 toques. Tus pendientes pasan a mañana y la racha se mantiene, con la mitad de las monedas." },
  racha: { t: "Racha", d: "Días seguidos cumpliendo. La de 🔥 cuenta los días que cerraste; la de hábitos, los días en que hiciste los que tocaban. Un descanso planificado no la corta." },
  monedas: { t: "⭐ Monedas", d: "Las ganas abriendo y cerrando días, con hábitos, rituales y objetivos. Las gastas en la Tienda: herramientas para tu día y cosas para tu estilo." },
  vitrina: { t: "✨ Tu vitrina", d: "Donde viven tus medallas, como constelaciones en el cielo. Cada una se gana con algo que hiciste de verdad." },
  xp: { t: "XP y rango", d: "La XP mide tu constancia y nunca baja, aunque gastes monedas. Con ella subes de rango y tu elefante crece de cría a sabio." },
  maceta: { t: "Maceta", d: "En tu jardín, hasta 3 de los hábitos que estás formando viven en una maceta. Con 66 días cumplidos echan raíces y pasan al jardín como árbol." },
  pilar: { t: "Pilares", d: "Seis focos para tu día: psicología, fisiología, productividad, magnetismo, presencia y propósito. Eliges uno al abrir tu día, si quieres; con el tiempo ves cuáles cultivas." },
};
/* El texto con su subrayado punteado (la primera semana) o liso (después; igual se puede tocar) */
function glosa(k, texto) {
  if (!GLOSARIO[k]) return texto;
  const marca = typeof primeraSemanaActiva === "function" && primeraSemanaActiva();
  return `<button type="button" class="glosa${marca ? " is-marca" : ""}" data-action="bv-glosa" data-k="${k}" title="¿Qué es?">${texto}</button>`;
}
function openGlosa(k) {
  const g = GLOSARIO[k]; if (!g) return;
  const quien = nombreDelElefante() || "Tu elefante";
  const otras = Object.keys(GLOSARIO).filter(x => x !== k);
  openModal(g.t, `
    <div class="arma-dice"><span class="arma-cara">${eleEstado().tipo ? elefanteCaraSVG() : icoHab("🐘", 22)}</span><div class="arma-burbuja"><b>${escapeHtml(quien)}</b>${escapeHtml(g.d)}</div></div>
    <div class="arma__sub mt-16">Otras palabras de Rumbo</div>
    <div class="arma-chips mt-8">${otras.map(x => `<button type="button" class="arma-chip" data-action="bv-glosa" data-k="${x}">${escapeHtml(GLOSARIO[x].t)}</button>`).join("")}</div>
    <div class="modal__cta"><button class="btn btn--soft btn-block" data-action="close-modal">Entendido</button></div>`);
}
/* En Ayuda: todas juntas */
function palabrasRumboHtml() {
  return `<div class="section-title mt-24">Palabras de Rumbo</div>
  <div class="card">${Object.keys(GLOSARIO).map(k => `<div class="item-row"><div class="item-row__main"><div class="item-row__title">${escapeHtml(GLOSARIO[k].t)}</div>
    <div class="item-row__sub">${escapeHtml(GLOSARIO[k].d)}</div></div></div>`).join("")}</div>`;
}

/* ============================================================
   Pantallas vacías que enseñan (el patrón de Alcancías: qué es, cuándo se llena y un botón)
   ============================================================ */
const TEND_DIAS = 7;
function diasCerrados(S) { S = S || STATE; return Object.values(S.ritual.dias || {}).filter(r => r && r.cerrado).length; }
function tendAprendiendo(S) { return diasCerrados(S) < TEND_DIAS; }
function tendEnsenaHtml() {
  const n = diasCerrados(), st = dayState();
  const btn = st === "por-abrir" ? `<button class="btn btn--primary" data-action="day-open">Abrir mi día</button>`
    : st !== "cerrado" ? `<button class="btn btn--primary" data-action="day-close">Cerrar mi día</button>` : "";
  return `<div class="card ensena" data-ensena="tendencias">
    <div class="ensena__ej" aria-hidden="true"><b>Ejemplo</b>${[30, 52, 44, 70, 62, 84, 76].map(h => `<span style="height:${h}%"></span>`).join("")}</div>
    <div class="ensena__txt"><div class="card__title">Tus gráficos aparecen con ${TEND_DIAS} días cerrados</div>
      <p class="text-sm soft mt-8">Aquí verás cómo cambian tu ánimo, tus hábitos y tu ahorro, y qué te hace bien. Cada vez que cierras tu día, suma un punto.</p>
      <div class="flex-between text-sm mt-16"><b>Llevas ${n} de ${TEND_DIAS}</b><span class="muted">${n >= TEND_DIAS ? "¡listo!" : `faltan ${TEND_DIAS - n}`}</span></div>
      <div class="bar mt-8"><div class="bar__fill" style="width:${Math.round((n / TEND_DIAS) * 100)}%"></div></div>
      ${btn ? `<div class="mt-16">${btn}</div>` : ""}</div></div>`;
}
function finSinDatos(S) {
  S = S || STATE;
  const f = S.finanzas, fy = typeof datosAnio === "function" ? datosAnio(S, new Date().getFullYear()).finanzas : f;
  return !(fy.metaAnual || f.metaMensual || (f.porque || "").trim() || (f.gastos || []).length || fy.meses.some(m => (m.ingreso || 0) || (m.gasto || 0))
    || (S.alcancias && Array.isArray(S.alcancias.lista) && S.alcancias.lista.length));
}
function finEnsenaHtml(pre) {
  const m = new Date().getMonth(), fy = datosAnio(STATE, new Date().getFullYear()).finanzas.meses[m];
  return `<div class="card ensena" data-ensena="finanzas">
    <div class="ensena__txt"><div class="card__title">Tu plata, en 2 minutos al mes</div>
      <p class="text-sm soft mt-8">Anota cuánto entró y cuánto salió este mes. Rumbo calcula tu ahorro y lo apila en tu torre del año. ¿Ahorras para algo? Más abajo, crea una alcancía.</p>
      <div class="grid grid-2 mt-16" style="gap:10px">
        <label class="field"><span class="text-xs muted">Entró en ${MESES[m]}</span><input class="input" type="text" inputmode="numeric" data-bind="${pre}finanzas.meses.${m}.ingreso" data-type="num" value="${fy.ingreso || 0}"></label>
        <label class="field"><span class="text-xs muted">Salió en ${MESES[m]}</span><input class="input" type="text" inputmode="numeric" data-bind="${pre}finanzas.meses.${m}.gasto" data-type="num" value="${fy.gasto || 0}"></label></div>
      <button class="btn btn--primary mt-8" data-action="bv-fin-listo">Guardar ${MESES[m].toLowerCase()}</button></div></div>`;
}
/* Desde qué mes mostrar el seguimiento (los meses antes de la cuenta, si están vacíos, no) */
function finDesdeMes(y, S) { const a = cuentaAlta(S); return a && +a.slice(0, 4) === y ? +a.slice(5, 7) - 1 : 0; }
function metasSinNada(metas) { return !metas.trimestres.flat().length && !metas.mensuales.flat().length; }
function metasEnsenaHtml() {
  const m = new Date().getMonth();
  return `<div class="card ensena" data-ensena="metas"><div class="ensena__txt">
    <div class="card__title">Un paso concreto este mes</div>
    <p class="text-sm soft mt-8">Un objetivo del mes es algo que puedes terminar en ${MESES[m].toLowerCase()}: leer 2 libros, ahorrar $100.000 o ir 8 veces al gimnasio. Las metas del trimestre son 3 a 5 cosas más grandes que esos pasos empujan.</p>
    <button class="btn btn--primary mt-16" data-action="bv-foco" data-id="mt-mes-${m}">Escribir mi objetivo de ${MESES[m].toLowerCase()}</button></div></div>`;
}
function ruedaEnsenaHtml() {
  return `<div class="card ensena" data-ensena="rueda" style="margin-bottom:18px"><div class="ensena__txt">
    <div class="card__title">Tu vida, área por área</div>
    <p class="text-sm soft mt-8">Pon una nota del 0 al 10 a cada área: te toma 1 minuto. Cada mes vuelves a hacerlo y ves qué áreas crecen y cuáles piden cariño.</p></div></div>`;
}
/* En Ayuda, para las cuentas nuevas: «Tu primera semana» con su interruptor «En Inicio» */
function primeraSemanaAyudaHtml() {
  const b = STATE.settings.bienvenida || {}, pasos = psPasos(), hechos = pasos.filter(p => p.ok).length;
  return `<div class="card">
    <div class="card__head"><div class="card__title">🚀 Tu primera semana · ${hechos}/${pasos.length}</div>
      <label class="row text-sm" style="gap:6px;cursor:pointer"><input type="checkbox" ${b.fin ? "" : "checked"} onchange="psMostrar(this.checked)"> En Inicio</label></div>
    ${pasos.map(p => `<div class="item-row"><span class="check ${p.ok ? "is-on" : ""}">${p.ok ? "✓" : ""}</span>
      <div class="item-row__main"><div class="item-row__title ${p.ok ? "strike" : ""}">${escapeHtml(p.t)}</div></div>
      ${p.estado === "ahora" ? `<button class="btn-ghost" data-action="bv-ir" data-id="${p.id}">Ir</button>` : ""}</div>`).join("")}
  </div>`;
}
function psMostrar(on) {
  const b = STATE.settings.bienvenida; if (!b) return;
  if (on) delete b.fin; else b.fin = "oculta";
  b.ts = Date.now(); saveState(); buildNav(); rerender();
}
