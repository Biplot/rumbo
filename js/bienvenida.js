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
