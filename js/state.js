/* ============================================================
   RUMBO · Estado global + persistencia (localStorage)
   ============================================================ */

const STORE_KEY = "rumbo_state_v1";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_CORTO = ["D","L","M","M","J","V","S"];

const YEAR = 2026;

/* Colores de lomo para los libros de la biblioteca (paleta BiPlot + armónicos) */
const LECT_COLORS = ["#17C3B2", "#FF6B4A", "#0E2A47", "#6C63FF", "#F4A63B", "#2E9E7B", "#E5527A", "#3E8BD6"];

/* -------- Datos por defecto (precargados desde tu bullet journal) -------- */
function defaultState() {
  const s = {
    profile: {
      name: "",
      birthDate: "",
      motto: "Construyendo mi mejor versión",
    },
    settings: { appName: "Rumbo", year: YEAR, theme: "biplot", onboarded: false, metaLibros: 12 },

    finanzas: {
      metaAnual: 0,
      metaMensual: 0,
      porque: "",
      gastos: [],
      // seguimiento mensual: ingreso, gasto, ahorro por mes (índice 0-11)
      meses: MESES.map(() => ({ ingreso: 0, gasto: 0, ahorro: 0 })),
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

    // hábitos: definición + registro { "YYYY-MM": { habitId: [dias marcados] } }
    habitos: {
      defs: [
        { id: uid(), nombre: "Deporte", icon: "🏋️" },
        { id: uid(), nombre: "Lectura", icon: "📖" },
        { id: uid(), nombre: "Estudio", icon: "✏️" },
        { id: uid(), nombre: "Música", icon: "🎵" },
        { id: uid(), nombre: "Alimento", icon: "🥗" },
        { id: uid(), nombre: "Agua", icon: "💧" },
        { id: uid(), nombre: "Meditar", icon: "🧘" },
        { id: uid(), nombre: "Vitaminas", icon: "💊" },
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
      puntos: 0,   // monedas gastables
      xp: 0,       // experiencia total (rango), no baja por gastar
      badges: [],  // ids de insignias ganadas
      owned: [],   // ids de cosméticos desbloqueados (temas/títulos/detalles)
      equipped: { titulo: null, insignia: null, acento: null, confeti: false },
    },

    // ritual matutino: días + 6 pilares del alto rendimiento
    ritual: {
      dias: {}, // "2026-09-20": { mision, pilar, sapo, energia, servir, proyectos:[], hecho:true }
      pilares: { "Psicología": 0, "Fisiología": 0, "Productividad": 0, "Magnetismo": 0, "Presencia": 0, "Propósito": 0 },
    },

    // planificador semanal: 7 días (Lun..Dom) + premio
    semana: {
      premio: "",
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
  s.gamif.puntos = 6000;

  return s;
}

/* Migración: rellena claves nuevas en estados guardados de versiones previas */
function migrate(s) {
  const d = defaultState();
  ["gamif", "ritual", "semana", "entrenamiento", "vida"].forEach(k => { if (!s[k]) s[k] = d[k]; });
  if (s.ritual && !s.ritual.pilares) s.ritual.pilares = d.ritual.pilares;
  if (s.settings && !s.settings.theme) s.settings.theme = "biplot";
  if (s.settings && s.settings.onboarded == null) s.settings.onboarded = true; // usuarios existentes ya pasaron
  if (s.settings && s.settings.metaLibros == null) s.settings.metaLibros = 12;
  const g = s.gamif;
  if (g.xp == null) g.xp = g.puntos || 0;
  if (!g.badges) g.badges = [];
  if (!g.owned) g.owned = [];
  if (!g.equipped) g.equipped = { titulo: null, insignia: null, acento: null, confeti: false };

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

  // Corrección única (bug de fecha UTC ya resuelto): un ritual guardado con la
  // fecha de HOY (2026-09-21) que en realidad fue la noche del 2026-09-20.
  // Se mueve al día correcto para que el 21 quede libre y se empiece limpio.
  // Solo mueve si el día destino está vacío (no pisa nada) y corre una sola vez.
  if (s.settings && !s.settings.fixNoche20sep2026) {
    const src = "2026-09-21", dst = "2026-09-20";
    if (s.ritual && s.ritual.dias && s.ritual.dias[src] && !s.ritual.dias[dst]) {
      s.ritual.dias[dst] = s.ritual.dias[src];
      delete s.ritual.dias[src];
      (s.vida && Array.isArray(s.vida.diario) ? s.vida.diario : []).forEach(e => {
        if (e && e.fromRitual && e.fecha === src) e.fecha = dst;
      });
    }
    s.settings.fixNoche20sep2026 = true;
  }

  return s;
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
  try { localStorage.setItem("rumbo_state_" + CURRENT_USER.id, JSON.stringify(STATE)); } catch (e) {}
  if (typeof scheduleCloudSave === "function") scheduleCloudSave();
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
