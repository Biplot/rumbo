/* ============================================================
   RUMBO · Datos por año (metas, finanzas, salud y rueda)
   El "año base" (settings.year, 2026 para quienes ya usaban la app) sigue
   viviendo donde siempre: STATE.metas, STATE.finanzas.meses, STATE.salud.meses
   y STATE.rueda.meses. Así nada de lo existente se mueve.
   Los demás años viven en STATE.anios["2027"] = {
     metas:    { trimestres: [4 × []], mensuales: [12 × []] },
     finanzas: { metaAnual, meses: [12 × { ingreso, gasto, ahorro, metaAhorro }], ts },
     salud:    { meses: [12 × { objetivo, diasEntren, … }], ts },
     rueda:    { meses: [12 × [8 notas]], ts },
   }
   Un año nuevo se guarda recién cuando se escribe algo en él (no al mirarlo).
   Lo global sigue arriba: finanzas.metaMensual/porque/gastos, salud.pesoObjetivo, rueda.areas.
   ============================================================ */

function anioBase(S) { S = S || STATE; return (S && S.settings && S.settings.year) || new Date().getFullYear(); }
function anioActual() { return new Date().getFullYear(); }

/* Año nuevo vacío. La meta de ahorro anual parte con la del año anterior. */
function anioVacio(S, y) {
  const prev = y - 1;
  const metaPrev = prev === anioBase(S) ? (S.finanzas.metaAnual || 0) : (((S.anios || {})[prev] || {}).finanzas || {}).metaAnual || 0;
  return {
    metas: { trimestres: [[], [], [], []], mensuales: Array.from({ length: 12 }, () => []) },
    finanzas: { metaAnual: metaPrev, meses: Array.from({ length: 12 }, () => ({ ingreso: 0, gasto: 0, ahorro: 0, metaAhorro: 0 })) },
    salud: { meses: Array.from({ length: 12 }, (_, i) => ({
      objetivo: "", diasEntren: 0, diasEntrenTotal: daysInMonth(y, i), diasCocina: 0, diasCocinaTotal: daysInMonth(y, i),
      notas: "", recetaNombre: "", recetaHecha: false, peso: null })) },
    rueda: { meses: Array.from({ length: 12 }, () => [0, 0, 0, 0, 0, 0, 0, 0]) },
  };
}

/* Datos de un año: { metas, finanzas, salud, rueda, base? }.
   crear = true lo guarda en STATE.anios (solo al escribir). */
function datosAnio(S, y, crear) {
  S = S || STATE; y = +y || anioActual();
  if (y === anioBase(S)) return { metas: S.metas, finanzas: S.finanzas, salud: S.salud, rueda: S.rueda, base: true };
  const guardado = (S.anios || {})[y];
  if (guardado) return guardado;
  const nuevo = anioVacio(S, y);
  if (crear) { S.anios = S.anios || {}; S.anios[y] = nuevo; }
  return nuevo;
}
/* Prefijo de ruta para data-bind: "" (año base) o "anios.2027." */
function rutaAnio(y, S) { return +y === anioBase(S) ? "" : `anios.${+y}.`; }
/* Marca la hora de edición de una sección de un año no base (para la fusión) */
function tocarAnio(S, y, seccion) {
  S = S || STATE; y = +y;
  if (y === anioBase(S)) return;
  const a = datosAnio(S, y, true);
  if (a[seccion]) a[seccion].ts = Date.now();
}
/* Antes de escribir con data-bind en "anios.Y.seccion…": crea el año y marca ts */
function prepararRutaAnio(path) {
  const m = /^anios\.(\d{4})\.(\w+)/.exec(path || "");
  if (!m) return;
  datosAnio(STATE, +m[1], true);
  tocarAnio(STATE, +m[1], m[2]);
}
/* Años que tienen datos (base, guardados y el actual), ordenados */
function aniosConDatos(S) {
  S = S || STATE;
  const set = new Set([anioBase(S), anioActual(), ...Object.keys(S.anios || {}).map(Number)]);
  return Array.from(set).filter(Boolean).sort((a, b) => a - b);
}
/* Todos los objetivos mensuales de todos los años (para buscar por id) */
function todosLosMensuales(S) {
  S = S || STATE;
  return aniosConDatos(S).flatMap(y => datosAnio(S, y).metas.mensuales || []);
}

/* Último peso registrado (el más reciente de todos los años) */
function pesoActualGlobal(S) {
  let p = null;
  aniosConDatos(S).forEach(y => datosAnio(S, y).salud.meses.forEach(m => { if (m && m.peso != null) p = m.peso; }));
  return p;
}

/* -------- Año que se está mirando en pantalla (Objetivos, Finanzas, Salud, Rueda, Hábitos, Calendario, Tendencias) -------- */
let ANIO_VISTA = null;   // null = el año actual
function anioVista() { return ANIO_VISTA || anioActual(); }
function cambiarAnioVista(delta) {
  const lista = aniosConDatos(), min = lista[0], max = Math.max(lista[lista.length - 1], anioActual() + 1);
  ANIO_VISTA = Math.min(max, Math.max(min, anioVista() + delta));
  if (ANIO_VISTA === anioActual()) ANIO_VISTA = null;
  rerender();
}
/* ‹ 2026 › — el año siguiente se puede abrir para planificar */
function selectorAnio() {
  const y = anioVista(), lista = aniosConDatos();
  const min = lista[0], max = Math.max(lista[lista.length - 1], anioActual() + 1);
  return `<div class="anio-nav" role="group" aria-label="Año">
    <button class="icon-btn" data-action="anio-nav" data-dir="-1" aria-label="Año anterior" ${y <= min ? "disabled" : ""}>‹</button>
    <b>${y}</b>
    <button class="icon-btn" data-action="anio-nav" data-dir="1" aria-label="Año siguiente" ${y >= max ? "disabled" : ""}>›</button>
    ${y !== anioActual() ? `<button class="btn-ghost" data-action="anio-nav" data-dir="0">Ir a ${anioActual()}</button>` : ""}
  </div>`;
}
