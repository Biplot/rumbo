/* ============================================================
   RUMBO · Estado global + persistencia (localStorage)
   ============================================================ */

const STORE_KEY = "rumbo_state_v1";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_CORTO = ["D","L","M","M","J","V","S"];


/* Textos del "Primer Bocado" (¿cómo te comes un elefante? Un bocado a la vez).
   Los nombres internos de datos siguen siendo sapo / esSapo / cierre.sapo. */
const BOCADO = { emoji: "🐘", titulo: "TU PRIMER BOCADO", accion: "Empieza por aquí", corto: "Primer bocado" };

/* Ámbitos de las tareas del día. Tareas antiguas sin ámbito = "per". */
const AMBITOS = {
  pro: { icon: "💼", label: "Profesionales", corto: "Pro" },
  per: { icon: "🏡", label: "Personales", corto: "Personal" },
};
function ambitoDe(t) { return t && t.ambito === "pro" ? "pro" : "per"; }

/* Colores de lomo para los libros de la biblioteca (paleta BiPlot + armónicos) */
const LECT_COLORS = ["#17C3B2", "#FF6B4A", "#0E2A47", "#6C63FF", "#F4A63B", "#2E9E7B", "#E5527A", "#3E8BD6"];

/* -------- Datos por defecto (precargados desde tu bullet journal) -------- */
function defaultState() {
  const YEAR = new Date().getFullYear();   // año base: el año en que empiezas a usar Rumbo (ver anios.js)
  const s = {
    profile: {
      name: "",
      birthDate: "",
      motto: "Construyendo mi mejor versión",
    },
    settings: {
      appName: "Rumbo", year: YEAR, theme: "navy", onboarded: false, introVersion: 0, metaLibros: 12,
      notif: { enabled: false, manana: "08:00", noche: "21:00", subs: [] },
      ritualSemanal: { dia: 0 },   // día del ritual semanal: 0 = domingo, 1 = lunes
      menu: { ocultos: [] },       // módulos de "Más" que la persona ocultó del menú
      tutorial: { vistos: {}, mision: "activa", auto: true, ts: 0 },   // recorridos vistos, misión Primeros pasos y ayuda automática
      gcal: { conectado: false, calendarios: null, ts: 0 },         // Google Calendar: si está conectado y qué calendarios ver (los eventos quedan en el equipo)
    },

    finanzas: {
      metaAnual: 0,
      metaMensual: 0,
      porque: "",
      gastos: [],
      // seguimiento mensual: ingreso, gasto, ahorro por mes (índice 0-11)
      meses: MESES.map(() => ({ ingreso: 0, gasto: 0, ahorro: 0, metaAhorro: 0 })),
    },

    // metas trimestrales (4) y mensuales (12)
    metas: {
      trimestres: [[], [], [], []],
      mensuales: [[], [], [], [], [], [], [], [], [], [], [], []],
    },

    // biblioteca de lecturas: lista libre de libros (no atada a meses)
    lecturas: [],

    // salud por mes
    salud: {
      pesoObjetivo: null,
      meses: MESES.map((_, i) => ({
        objetivo: "", diasEntren: 0, diasEntrenTotal: daysInMonth(YEAR, i),
        diasCocina: 0, diasCocinaTotal: daysInMonth(YEAR, i),
        notas: "", recetaNombre: "", recetaHecha: false, peso: null,
      })),
    },

    // hábitos: definición (frecuencia, creado, pausado?) + registro { "YYYY-M": { habitId: {día: true} } }
    habitos: {
      defs: [
        { id: uid(), nombre: "Deporte", icon: "🏋️", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Lectura", icon: "📖", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Estudio", icon: "✏️", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Música", icon: "🎵", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Alimento", icon: "🥗", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Agua", icon: "💧", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Meditar", icon: "🧘", frecuencia: { tipo: "diario" }, creado: todayISO() },
        { id: uid(), nombre: "Vitaminas", icon: "💊", frecuencia: { tipo: "diario" }, creado: todayISO() },
      ],
      log: {}, // ej: { "2026-9": { habitId: {5:true, 6:true} } }
    },

    // rueda de la vida: por mes, 8 áreas 0-10
    rueda: {
      areas: ["Salud y deporte","Familia y amor","Trabajo y finanzas","Ocio y amistad","Tiempo para mí","Emocional","Educativa y cultural","Espiritual y ética"],
      meses: MESES.map(() => [0,0,0,0,0,0,0,0]),
    },

    // aprendizajes profesionales + temas de interés
    aprendizajes: [],

    // notas: categorías con notas
    notas: [],

    // módulos de vida
    vida: { diario: [], ideas: [], relaciones: [], listas: [] },

    // calendario: eventos { "YYYY-MM-DD": [textos] }
    eventos: {},

    // gamificación
    gamif: {
      puntos: 0,   // DERIVADO del ledger: monedas gastables
      xp: 0,       // DERIVADO del ledger: experiencia total (rango), no baja por gastar
      badges: [],  // ids de insignias ganadas
      owned: [],   // DERIVADO del ledger (compra:*) + perks: caché por compatibilidad
      perks: [],   // desbloqueos sin cobro (cuenta dueña); no generan movimientos
      ledger: [],  // libro de movimientos: [{ id, ts, delta, xp, motivo, anulado? }]
      equipped: { titulo: null, insignia: null, acento: null, confeti: false },
    },

    // ritual matutino: días + 6 pilares del alto rendimiento
    ritual: {
      dias: {}, // "2026-09-20": { mision, pilar, sapo, sapoAmbito, energia, servir, proyectos:[], hecho:true }
      meses: {}, // ritual de mes: "2026-10": { apertura: {…, ts}, cierre: {…, ts} }
      trimestres: {}, // revisión trimestral: "2026-Q4": { apertura: {…, ts}, cierre: {…, ts} }
      semanas: {}, // ritual de semana, clave = lunes ISO: { plan: {…, ts}, apertura: {…, ts}, cierre: {…, ts} }
      pilares: { "Psicología": 0, "Fisiología": 0, "Productividad": 0, "Magnetismo": 0, "Presencia": 0, "Propósito": 0 },
    },

    // registro diario (bullet journal): tareas por fecha, con su historia (ver agenda.js)
    agenda: { dias: {}, recurrentes: [] },

    // metas, finanzas, salud y rueda de los años distintos al año base (ver anios.js)
    anios: {},

    // planificador semanal ANTIGUO (solo para clientes viejos; las tareas viven en agenda)
    semana: {
      premio: "",
      weekOf: "",           // lunes ISO de la semana actual (para limpiar al cambiar de semana)
      dias: [[], [], [], [], [], [], []],
    },

    // entrenamiento por bloques (plantilla genérica de arranque)
    entrenamiento: {
      objetivo: "",
      dias: [
        { id: uid(), nombre: "Día 1 · Empuje (pecho, hombros, tríceps)", premiado: false, bloques: [
          { id: uid(), nombre: "Bloque A", series: "4x8", done: false },
          { id: uid(), nombre: "Bloque B", series: "3x10", done: false },
          { id: uid(), nombre: "Bloque C", series: "3x12", done: false },
        ] },
        { id: uid(), nombre: "Día 2 · Tirón (espalda, bíceps)", premiado: false, bloques: [
          { id: uid(), nombre: "Bloque A", series: "4x8", done: false },
          { id: uid(), nombre: "Bloque B", series: "3x10", done: false },
        ] },
        { id: uid(), nombre: "Día 3 · Piernas y core", premiado: false, bloques: [
          { id: uid(), nombre: "Bloque A", series: "4x10", done: false },
          { id: uid(), nombre: "Bloque B", series: "3x15", done: false },
        ] },
      ],
    },
  };
  return s;
}

/* Datos de ejemplo: rellena el año para poder revisar tendencias */
function seedRand(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
function seedDemo(s) {
  const year = s.settings.year;
  const today = new Date();
  const curM = today.getMonth();
  const curD = today.getDate();

  // Finanzas: ingreso/gasto ene→sep
  for (let m = 0; m <= 8; m++) {
    s.finanzas.meses[m].ingreso = 1250000 + Math.round(seedRand("ing" + m) * 260000);
    s.finanzas.meses[m].gasto = 880000 + Math.round(seedRand("gas" + m) * 210000);
  }

  // Salud: peso y días ene→sep
  const pesos = [85, 83.5, 83.4, 81.5, 81.0, 80.2, 79.6, 79.0, 78.5];
  for (let m = 0; m <= 8; m++) {
    s.salud.meses[m].peso = pesos[m];
    s.salud.meses[m].diasEntren = 12 + Math.round(seedRand("de" + m) * 10);
    s.salud.meses[m].diasCocina = 5 + Math.round(seedRand("dc" + m) * 9);
  }

  // Rueda de la vida: meses 0→7 mejorando (sep ya viene seteado)
  const rbase = [2, 4, 6, 4, 3, 3, 5, 4];
  for (let m = 0; m < 8; m++) {
    s.rueda.meses[m] = rbase.map((b, k) =>
      Math.max(1, Math.min(10, b + Math.round((m / 8) * 3) + (seedRand("r" + m + "-" + k) < 0.5 ? 0 : 1))));
  }

  // Hábitos: marcar días ene→hoy
  s.habitos.defs.forEach(h => {
    const rate = 0.6 + seedRand("rate" + h.id) * 0.3;
    for (let m = 0; m <= 8; m++) {
      const key = monthKey(year, m);
      s.habitos.log[key] = s.habitos.log[key] || {};
      s.habitos.log[key][h.id] = s.habitos.log[key][h.id] || {};
      const dmax = (m === curM) ? curD : daysInMonth(year, m);
      for (let d = 1; d <= dmax; d++) {
        if (seedRand(h.id + "-" + m + "-" + d) < rate) s.habitos.log[key][h.id][d] = true;
      }
    }
  });

  // Ritual: días cerrados recientes (para la racha)
  for (let off = 1; off <= 26; off++) {
    const dt = new Date(today); dt.setDate(today.getDate() - off);
    const iso = isoLocal(dt);
    if (off <= 8 || seedRand("cl" + iso) < 0.7) s.ritual.dias[iso] = { hecho: true, cerrado: true };
  }

  // Monedas de prueba para explorar la tienda completa
  ledgerRegistrar(s, "demo-monedas", 6000, 0, "Monedas de prueba");

  return s;
}

/* Migración: rellena claves nuevas en estados guardados de versiones previas */
function migrate(s) {
  const d = defaultState();
  ["gamif", "ritual", "semana", "entrenamiento", "vida"].forEach(k => { if (!s[k]) s[k] = d[k]; });
  if (s.ritual && !s.ritual.pilares) s.ritual.pilares = d.ritual.pilares;
  if (s.ritual && (!s.ritual.meses || typeof s.ritual.meses !== "object")) s.ritual.meses = {};
  if (s.ritual && (!s.ritual.trimestres || typeof s.ritual.trimestres !== "object")) s.ritual.trimestres = {};
  if (s.ritual && (!s.ritual.semanas || typeof s.ritual.semanas !== "object")) s.ritual.semanas = {};
  migrarAgenda(s);   // tareas → registro diario por fecha (idempotente)
  compactarAgenda(s); // historia de más de 90 días en formato corto (idempotente, no pierde nada)
  recurrentes(s);     // agenda.recurrentes por defecto
  generarRecurrentes(s); // tareas recurrentes de las próximas 2 semanas (id fijo: no duplica)
  if (!s.anios || typeof s.anios !== "object" || Array.isArray(s.anios)) s.anios = {};   // años distintos al base
  if (s.finanzas && Array.isArray(s.finanzas.meses)) s.finanzas.meses.forEach(fm => { if (fm && fm.metaAhorro == null) fm.metaAhorro = 0; });
  // Temas: los existentes conservan el suyo. Retirados: bosque → bosque-claro; el resto → navy.
  if (s.settings) {
    const TEMAS = ["navy", "claro", "grafito", "medianoche", "bosque-claro", "bosque-oscuro"];
    if (s.settings.theme === "bosque") s.settings.theme = "bosque-claro";
    if (!TEMAS.includes(s.settings.theme)) s.settings.theme = "navy";
  }
  if (s.settings && s.settings.onboarded == null) s.settings.onboarded = true; // usuarios existentes ya pasaron
  // Versión de la introducción vista: los existentes quedan en 1 (verán "Novedades" una vez)
  if (s.settings && s.settings.introVersion == null) s.settings.introVersion = s.settings.onboarded ? 1 : 0;
  if (s.settings && s.settings.metaLibros == null) s.settings.metaLibros = 12;
  if (s.settings && !s.settings.notif) s.settings.notif = { enabled: false, manana: "08:00", noche: "21:00", subs: [] };
  if (s.settings && s.settings.notif && !Array.isArray(s.settings.notif.subs)) s.settings.notif.subs = [];
  if (s.settings && (!s.settings.ritualSemanal || typeof s.settings.ritualSemanal !== "object")) s.settings.ritualSemanal = { dia: 0 };
  if (s.settings && (!s.settings.menu || !Array.isArray(s.settings.menu.ocultos))) s.settings.menu = { ocultos: [] };
  // Tutorial: quienes ya usaban la app no ven la misión Primeros pasos (la activan en 🎓 Tutoriales)
  if (s.settings && (!s.settings.tutorial || typeof s.settings.tutorial !== "object")) s.settings.tutorial = { vistos: {}, mision: s.settings.onboarded ? "oculta" : "activa", auto: true, ts: 0 };
  if (s.settings && (!s.settings.tutorial.vistos || typeof s.settings.tutorial.vistos !== "object")) s.settings.tutorial.vistos = {};
  if (s.settings && (!s.settings.gcal || typeof s.settings.gcal !== "object")) s.settings.gcal = { conectado: false, calendarios: null, ts: 0 };
  const g = s.gamif;
  if (g.xp == null) g.xp = g.puntos || 0;
  if (!g.badges) g.badges = [];
  if (!g.owned) g.owned = [];
  if (!Array.isArray(g.perks)) g.perks = [];
  if (!g.equipped) g.equipped = { titulo: null, insignia: null, acento: null, confeti: false };
  // Tema retirado "bosque" → "bosque-claro" (en owned viejo y en el ledger)
  g.owned = g.owned.map(o => o === "tema-bosque" ? "tema-bosque-claro" : o);
  if (Array.isArray(g.ledger)) g.ledger.forEach(m => { if (m && m.id === "compra:tema-bosque") m.id = "compra:tema-bosque-claro"; });
  ensureLedger(s);    // monedas: libro de movimientos (idempotente)
  recalcGamif(s);

  // Hábitos con frecuencia: los existentes quedan "diario", creados el día de su primera marca (o hoy)
  if (s.habitos && Array.isArray(s.habitos.defs)) {
    s.habitos.log = s.habitos.log || {};
    s.habitos.defs.forEach(h => {
      if (!h) return;
      if (!h.frecuencia) h.frecuencia = { tipo: "diario" };
      if (!h.creado) h.creado = primeraMarcaHabito(s.habitos.log, h.id) || todayISO();
    });
  }

  // Biblioteca de lecturas: migrar del modelo viejo (12 meses, 1 libro/mes) a lista libre
  if (!Array.isArray(s.lecturas)) s.lecturas = [];
  const esModeloViejo = s.lecturas.length &&
    s.lecturas.some(l => l && l.estado === undefined && (l.iniciado !== undefined || l.finalizado !== undefined));
  if (esModeloViejo) {
    s.lecturas = s.lecturas
      .filter(l => l && (l.titulo || "").trim())
      .map((l, i) => ({
        id: uid(),
        titulo: l.titulo.trim(),
        autor: "",
        estado: l.finalizado ? "terminado" : (l.iniciado ? "leyendo" : "por-leer"),
        paginas: 0,
        pagina: 0,
        valoracion: 0,
        nota: "",
        color: LECT_COLORS[i % LECT_COLORS.length],
        inicio: l.inicio || "",
        fin: l.fin || "",
      }));
  }

  return s;
}

/* ============================================================
   Monedas y XP: libro de movimientos (ledger) idempotente.
   Cada evento tiene un id determinista (p. ej. "ritual-cierre:2026-09-23"),
   así el mismo evento en dos dispositivos colapsa en un solo movimiento.
   puntos, xp y owned se DERIVAN siempre del ledger.
   ============================================================ */
const SALDO_INICIAL = "saldo-inicial";

/* Migración: crea el ledger desde el saldo viejo. Idempotente. */
function ensureLedger(s) {
  const g = s.gamif = s.gamif || {};
  if (Array.isArray(g.ledger)) return s;
  const perks = new Set(g.perks || []);
  g.ledger = [{ id: SALDO_INICIAL, ts: 0, delta: g.puntos > 0 ? g.puntos : 0, xp: g.xp > 0 ? g.xp : 0, motivo: "Saldo al migrar" }];
  // Insignias y compras existentes: ya pagadas/cobradas (delta 0, ts 0 → cualquier movimiento real gana)
  (g.badges || []).forEach(b => g.ledger.push({ id: "insignia:" + b, ts: 0, delta: 0, xp: 0, motivo: "Migración" }));
  (g.owned || []).forEach(o => { if (!perks.has(o)) g.ledger.push({ id: "compra:" + o, ts: 0, delta: 0, xp: 0, motivo: "Migración" }); });
  return s;
}

/* Recalcula los derivados (puntos, xp, owned) desde el ledger */
function recalcGamif(s) {
  const g = s.gamif; if (!g || !Array.isArray(g.ledger)) return s;
  let puntos = 0, xp = 0; const owned = new Set(g.perks || []);
  g.ledger.forEach(m => {
    if (!m || m.anulado) return;
    puntos += m.delta || 0;
    xp += Math.max(0, m.xp || 0);
    if (typeof m.id === "string" && m.id.startsWith("compra:")) owned.add(m.id.slice(7));
  });
  g.puntos = puntos; g.xp = xp; g.owned = Array.from(owned);
  return s;
}

/* Fusión de dos ledgers por id: gana el ts más reciente.
   Excepción: dos "saldo-inicial" distintos → se conserva el menor (conservador). */
function ledgerMerge(a, b) {
  const map = new Map();
  [...(b || []), ...(a || [])].forEach(m => {
    if (!m || m.id == null) return;
    const o = map.get(m.id);
    if (!o) { map.set(m.id, m); return; }
    if (m.id === SALDO_INICIAL) { if ((m.delta || 0) < (o.delta || 0)) map.set(m.id, m); return; }
    if ((m.ts || 0) > (o.ts || 0)) map.set(m.id, m);
  });
  return Array.from(map.values());
}

/* Registra un movimiento. Si ya existe vigente, no hace nada (devuelve false).
   Si existía anulado (acción reversible), lo reactiva con un ts nuevo y su delta original. */
function ledgerRegistrar(s, id, delta, xp, motivo, now) {
  ensureLedger(s);
  const L = s.gamif.ledger;
  const ex = L.find(m => m.id === id);
  if (ex && !ex.anulado) return false;
  const ts = now || Date.now();
  if (ex) { ex.anulado = false; ex.ts = Math.max(ts, (ex.ts || 0) + 1); }
  else { const m = { id, ts, delta: delta || 0, xp: Math.max(0, xp || 0) }; if (motivo) m.motivo = motivo; L.push(m); }
  recalcGamif(s);
  return true;
}

/* Anula un movimiento reversible (desmarcar). No se borra: queda anulado con ts nuevo.
   Si no existía (marca anterior al ledger), deja un registro anulado de 0 para que
   volver a marcar no pague de nuevo. */
function ledgerAnular(s, id, now) {
  ensureLedger(s);
  const L = s.gamif.ledger;
  const ts = now || Date.now();
  const ex = L.find(m => m.id === id);
  if (!ex) L.push({ id, ts, delta: 0, xp: 0, anulado: true });
  else if (!ex.anulado) { ex.anulado = true; ex.ts = Math.max(ts, (ex.ts || 0) + 1); }
  else return false;
  recalcGamif(s);
  return true;
}

/* Movimiento vigente? */
function ledgerVigente(s, id) {
  const m = ((s.gamif && s.gamif.ledger) || []).find(x => x.id === id);
  return !!(m && !m.anulado);
}

/* Compra: valida contra el saldo derivado y no cobra dos veces */
function ledgerComprar(s, itemId, costo, now) {
  recalcGamif(s);
  const id = "compra:" + itemId;
  if (ledgerVigente(s, id) || (s.gamif.owned || []).includes(itemId)) return { ok: false, yaTenia: true };
  if ((s.gamif.puntos || 0) < costo) return { ok: false, falta: costo - (s.gamif.puntos || 0) };
  ledgerRegistrar(s, id, -costo, 0, "Compra", now);
  return { ok: true };
}

/* Las marcas de hábitos hechas con ledger siguen el estado de su movimiento
   (así desmarcar en un dispositivo se propaga al otro). */
function syncHabitLogFromLedger(s) {
  if (!s.habitos || !s.gamif || !Array.isArray(s.gamif.ledger)) return s;
  s.habitos.log = s.habitos.log || {};
  s.gamif.ledger.forEach(m => {
    if (!m || typeof m.id !== "string" || !m.id.startsWith("habito:")) return;
    const p = m.id.split(":"); if (p.length !== 3) return;
    const [y, mo, d] = p[2].split("-").map(Number); if (!y || !mo || !d) return;
    const key = `${y}-${mo}`;
    if (m.anulado) { if (s.habitos.log[key] && s.habitos.log[key][p[1]]) delete s.habitos.log[key][p[1]][d]; }
    else {
      s.habitos.log[key] = s.habitos.log[key] || {};
      s.habitos.log[key][p[1]] = s.habitos.log[key][p[1]] || {};
      s.habitos.log[key][p[1]][d] = true;
    }
  });
  return s;
}

/* Primer día marcado de un hábito en el log { "YYYY-M": { hid: { d: true } } } → ISO o null */
function primeraMarcaHabito(log, hid) {
  let best = null;
  Object.keys(log || {}).forEach(k => {
    const [y, m] = k.split("-").map(Number); const days = (log[k] || {})[hid];
    if (!y || !m || !days) return;
    Object.keys(days).forEach(d => {
      if (!days[d]) return;
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`;
      if (!best || iso < best) best = iso;
    });
  });
  return best;
}

/* -------- Helpers de persistencia -------- */
let STATE = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { STATE = migrate(JSON.parse(raw)); saveState(); return; }
  } catch (e) { console.warn("No se pudo leer el estado", e); }
  STATE = defaultState();
  saveState();
}
function saveState() {
  if (typeof CURRENT_USER === "undefined" || !CURRENT_USER) return;
  try {
    localStorage.setItem("rumbo_state_" + CURRENT_USER.id, JSON.stringify(STATE));
    localStorage.setItem("rumbo_pending_" + CURRENT_USER.id, "1");   // hay cambios sin subir
  } catch (e) {}
  if (typeof scheduleCloudSave === "function") scheduleCloudSave();
}

/* Registra ids de tareas del planificador borradas, para que la fusión con otro
   dispositivo no las reviva. Se vacía al cambiar de semana. */
function semMarcarBorradas(ids) {
  if (!ids || !ids.length) return;
  const b = STATE.semana.borradas || (STATE.semana.borradas = []);
  ids.forEach(id => { if (id != null && !b.includes(id)) b.push(id); });
}

/* -------- Utilidades -------- */
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmtCLP(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function parseNum(v) { const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10); return isNaN(n) ? 0 : n; }

/* Fecha local YYYY-MM-DD (NO usar toISOString: eso da UTC y descuadra el día en Chile) */
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayISO() { return isoLocal(new Date()); }

/* Lunes (ISO) de la semana actual */
function currentMondayISO() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - dow);
  return isoLocal(monday);
}
/* Si cambió la semana, limpia el planificador. Devuelve true si limpió. */
function ensureCurrentWeek() {
  if (typeof STATE === "undefined" || !STATE || !STATE.semana) return false;
  const wk = currentMondayISO();
  if (STATE.semana.weekOf !== wk) {
    STATE.semana.dias = [[], [], [], [], [], [], []];
    STATE.semana.borradas = [];
    STATE.semana.weekOf = wk;
    return true;
  }
  return false;
}

function fechaLarga(d = new Date()) {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function edadTexto(birthISO) {
  if (!birthISO) return "";
  const b = new Date(birthISO + "T00:00:00");
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  let m = now.getMonth() - b.getMonth();
  let d = now.getDate() - b.getDate();
  if (d < 0) { m--; const prev = new Date(now.getFullYear(), now.getMonth(), 0).getDate(); d += prev; }
  if (m < 0) { y--; m += 12; }
  return `${y} años, ${m} meses y ${d} días`;
}

function monthKey(year, monthIdx) { return `${year}-${monthIdx + 1}`; }
function daysInMonth(year, monthIdx) { return new Date(year, monthIdx + 1, 0).getDate(); }
