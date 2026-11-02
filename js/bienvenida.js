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
    : st === "en-curso" ? `Bien. Ahora, a tu <b>${BOCADO.corto.toLowerCase()}</b>: lo más importante primero. En la noche vuelves para cerrar el día.`
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
  if (a === "bv-hab") {
    const h = agregarSugerencia(STATE, d.id, todayISO());
    if (!h) return toast("Ese hábito ya lo tienes");
    saveState(); rerender(); toast(`${h.nombre}: listo, ya está en tus hábitos`);
  }
}
/* Al abrir el primer día: el elefante celebra y cuenta qué hacer con las ⭐ y cuándo volver */
function celebrarPrimerDia() {
  if (typeof escenaElefante !== "function" || !eleEstado().tipo) return;
  const quien = nombreDelElefante();
  escenaElefante({ svg: elefanteSVG({ animo: "feliz" }), titulo: "¡Abriste tu primer día!",
    texto: `Ganaste +50 ⭐: se gastan en la Tienda, en cosas para tu día y tu estilo. Esta noche vuelve a cerrarlo: son 2 minutos y +40 ⭐.${quien ? " " + escapeHtml(quien) + " te espera." : ""}`,
    botones: `<button class="btn btn--primary" data-cerrar="1">¡Vamos!</button>`, clase: "is-primero" });
}
