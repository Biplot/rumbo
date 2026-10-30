/* ============================================================
   RUMBO · Notificaciones al celular (Web Push, lado cliente)
   Igual que Fundos 360: cada dispositivo se registra en la tabla
   suscripciones_push (BACKEND.pushRegistrar) y el envío lo hace el servidor
   de la app (api/push.js) cuando la base se lo pide (pg_cron cada 5 min,
   supabase/notificaciones.sql). Los horarios siguen en settings.notif
   (manana, noche, mediodia, tz). La clave pública la entrega el servidor.
   ============================================================ */

let PUSH_DISPOSITIVO = null;   // ¿este navegador está activado? true | false | null (aún no se sabe)
let PUSH_CLAVE = null;         // clave pública del servidor (se pide una vez)

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function abiertaComoApp() {
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
}
/* "si" | "ios_instalar" (iPhone/iPad desde Safari: hay que agregarla a inicio y abrirla desde el ícono) | "no" */
function soportePush() {
  if (esIOS() && !abiertaComoApp()) return "ios_instalar";
  return typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window ? "si" : "no";
}
function notifSupported() { return soportePush() === "si"; }
function notifPerm() { return notifSupported() ? Notification.permission : "unsupported"; }

async function pushClave() {
  if (PUSH_CLAVE) return PUSH_CLAVE;
  const r = await BACKEND.pushApi("GET");
  if (!r || !r.clave) throw new Error((r && r.error) || "sin clave");
  return (PUSH_CLAVE = r.clave);
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function mismaClave(a, b) {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}
/* La suscripción de este navegador, si hay una (no registra nada) */
async function suscripcionActual() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
/* Suscribe este navegador con la clave del servidor (si estaba con otra clave, empieza de nuevo) */
async function suscribirPush(clave) {
  const reg = await navigator.serviceWorker.ready;
  const bytes = urlBase64ToUint8Array(clave);
  const existente = await reg.pushManager.getSubscription();
  if (existente) {
    if (mismaClave(existente.options && existente.options.applicationServerKey, bytes)) return existente;
    await existente.unsubscribe();
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
}
/* «App en iPhone», «Chrome en Windows»: para reconocer cada dispositivo */
function describirDispositivo() {
  const ua = navigator.userAgent;
  const sistema = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iPad"
    : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "este dispositivo";
  const navegador = /edg\//i.test(ua) ? "Edge" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Navegador";
  return abiertaComoApp() ? `App en ${sistema}` : `${navegador} en ${sistema}`;
}
function conLimite(promesa, ms) { return Promise.race([promesa, new Promise(r => setTimeout(() => r(null), ms))]); }

/* Al entrar: si este navegador tiene una suscripción que no figura en la cuenta (se quitó desde
   otro lado, el servicio la dio por muerta, era de otra cuenta o del sistema anterior), se suelta. */
async function revisarDispositivoPush() {
  try {
    if (notifPerm() !== "granted") PUSH_DISPOSITIVO = false;
    else {
      const sub = await suscripcionActual();
      if (!sub) PUSH_DISPOSITIVO = false;
      else {
        const existe = await BACKEND.pushExiste(sub.endpoint);
        if (existe === false) await sub.unsubscribe().catch(() => {});
        // Si no se pudo saber (sin red), se ofrece activar: volver a registrarlo no duplica nada
        PUSH_DISPOSITIVO = existe === true;
      }
    }
  } catch (e) { /* sin service worker o sin permiso: nada que revisar */ }
  if (CURRENT === "notif") rerender();
}
/* Al cerrar sesión: este dispositivo deja de recibir los avisos de quien se va. Nunca demora la salida. */
async function soltarDispositivoPush() {
  try {
    const sub = await conLimite(suscripcionActual(), 2000);
    if (sub) {
      await conLimite(BACKEND.pushQuitar(sub.endpoint).catch(() => {}), 3000);
      await sub.unsubscribe().catch(() => {});
    }
  } catch (e) { /* la salida sigue igual */ }
  PUSH_DISPOSITIVO = null;
}

function renderNotificaciones() {
  const n = STATE.settings.notif || {};
  const soporte = soportePush();
  const perm = notifPerm();
  const activo = perm === "granted" && PUSH_DISPOSITIVO === true;
  if (soporte === "si" && !activo) pushClave().catch(() => {});   // pedirla antes, para activar al tiro

  let banner, tono = "notif-banner";
  if (soporte === "ios_instalar") { banner = "En iPhone, las notificaciones funcionan con Rumbo <b>instalada en la pantalla de inicio</b>: en Safari toca Compartir → Agregar a inicio y abre Rumbo desde ese ícono."; tono += " is-warn"; }
  else if (soporte === "no") { banner = "Este navegador no soporta notificaciones."; tono += " is-warn"; }
  else if (perm === "denied") { banner = "El permiso está bloqueado. Actívalo en los ajustes de notificaciones de tu navegador/teléfono para Rumbo."; tono += " is-warn"; }
  else if (activo) { banner = "✅ Notificaciones activadas en este dispositivo."; tono += " is-ok"; }
  else if (PUSH_DISPOSITIVO === null && perm === "granted") { banner = "Revisando este dispositivo…"; }
  else if (n.enabled && !n.version) { banner = "Renovamos cómo llegan los avisos: toca <b>Activar</b> otra vez en cada dispositivo donde quieras recibirlos."; tono += " is-warn"; }
  else { banner = "Actívalas para recibir tus recordatorios de mañana y noche."; }

  return `
  <div class="card">
    <div class="card__title">🔔 Recordatorios del ritual</div>
    <p class="soft mt-8">Un aviso en la <b>mañana</b> para iniciar tu día y otro en la <b>noche</b> para cerrarlo — aunque tengas la app cerrada.</p>
    <div class="${tono} mt-16">${banner}</div>
    ${activo
      ? `<button class="btn btn--soft btn-block mt-16" data-action="notif-disable">Desactivar en este dispositivo</button>`
      : `<button class="btn btn--primary btn-block mt-16" data-action="notif-enable" ${soporte !== "si" || perm === "denied" ? "disabled" : ""}>Activar notificaciones</button>`}
  </div>

  ${renderAvisos(n)}

  ${activo ? `<button class="btn-ghost btn-block mt-16" data-action="notif-test">Enviar una notificación de prueba</button>` : ""}
  <p class="text-xs muted mt-16">📱 Se activan en cada dispositivo por separado. En iPhone, Rumbo tiene que estar instalada en la pantalla de inicio.</p>`;
}

/* ---------- Qué avisos recibir (settings.notif.avisos; catálogo y niveles en state.js) ---------- */
const AVISOS_INFO = {
  manana: ["🌅", "Abrir el día", "Para iniciar tu ritual. No llega si ya lo abriste."],
  noche: ["🌙", "Cerrar el día", "Para cerrarlo. No llega si ya lo cerraste."],
  insistencia: ["🔁", "Segundo aviso de cierre", "Una hora después del de la noche, solo si aún no cierras el día."],
  pendientes: ["⏳", "Días sin cerrar", "Si te quedó un día sin cerrar (tienes 3 días para hacerlo). Va dentro del aviso de la mañana."],
  mediodia: ["☀️", "Mediodía", "“¿Cómo va tu primer bocado?”, a la hora que elijas."],
  semana: ["📅", "Ritual semanal", ""],
  mes: ["🗓️", "Ritual de mes", "El día 1 en la mañana para abrirlo y el último día en la noche para cerrarlo."],
  trimestre: ["🧭", "Revisión trimestral", "El penúltimo día del trimestre en la noche y el día 2 del siguiente en la mañana."],
  habitos: ["✅", "Hábitos pendientes", "A la hora que elijas, solo si te falta alguno de los que tocan hoy."],
  cumpleanos: ["🎂", "Cumpleaños", "En la mañana del día, de las personas que tienes en Relaciones."],
  contactos: ["💬", "Contactos pendientes", "Los domingos en la mañana: a quién hace tiempo que no le escribes (según Relaciones)."],
  amigos: ["🤝", "Amigos", "Cuando un amigo te manda ánimo, te pide amistad o acepta la tuya. Nunca de noche (de 22:00 a 8:00)."],
};
const AVISOS_GRUPOS = [
  ["Tu día", ["manana", "noche", "insistencia", "pendientes", "mediodia"]],
  ["Semana, mes y trimestre · solo si aún no lo haces", ["semana", "mes", "trimestre"]],
  ["Hábitos y relaciones", ["habitos", "cumpleanos", "contactos"]],
  ["Amigos", ["amigos"]],
];
const AVISOS_NIVEL_TXT = {
  esencial: "Abrir y cerrar el día.",
  recomendado: "Abrir y cerrar el día, más semana, mes, trimestre y tus amigos.",
  todo: "Todos los avisos.",
  personalizado: "Elegiste tus propios avisos.",
};
/* Hora editable al lado del aviso (mañana y noche siempre; mediodía y hábitos cuando están encendidos) */
const AVISOS_HORA = { manana: ["notif-manana", "manana"], noche: ["notif-noche", "noche"], mediodia: ["notif-mediodia", "mediodia"], habitos: ["notif-habitos", "habitosHora"] };

function renderAvisos(n) {
  const act = avisosActivos(n), nivel = nivelAvisos(n);
  const semanaTxt = diaRitualSemanal() === 1
    ? "El lunes a tu hora de la mañana, y el martes si aún no planificas tu semana. Cambia el día en Ritual → Semana."
    : "El domingo a tu hora de la noche, y el lunes en la mañana si aún no planificas tu semana. Cambia el día en Ritual → Semana.";
  const fila = k => {
    const [ic, titulo, desc] = AVISOS_INFO[k];
    const h = AVISOS_HORA[k], conHora = h && (k === "manana" || k === "noche" || act[k]);
    const hora = conHora ? `<input class="input aviso__hora" type="time" id="${h[0]}" value="${n[h[1]] || AVISOS_HORAS[k === "habitos" ? "habitos" : k]}" aria-label="Hora: ${titulo}">` : "";
    return `<div class="aviso">
      <div class="aviso__txt"><span class="aviso__t">${ic} ${titulo}</span><span class="text-xs muted">${k === "semana" ? semanaTxt : desc}</span></div>
      <label class="sw"><input type="checkbox" role="switch" data-action="notif-aviso" data-k="${k}" ${act[k] ? "checked" : ""} aria-label="${titulo}"><span></span></label>
      ${hora}
    </div>`;
  };
  return `
  <div class="card mt-16">
    <div class="card__title" style="font-size:15px">Qué avisos quieres recibir</div>
    <div class="seg seg--full mt-16" role="group" aria-label="Nivel de avisos">${[["esencial", "Lo esencial"], ["recomendado", "Recomendado"], ["todo", "Todo"]]
      .map(([k, l]) => `<button class="${nivel === k ? "is-active" : ""}" aria-pressed="${nivel === k}" data-action="notif-nivel" data-n="${k}">${l}</button>`).join("")}</div>
    <p class="text-xs muted mt-8">${AVISOS_NIVEL_TXT[nivel]} Valen para todos tus dispositivos.</p>
    ${AVISOS_GRUPOS.map(([g, ks]) => `<div class="aviso-grupo">${g}</div>${ks.map(fila).join("")}`).join("")}
    <button class="btn btn--cian btn-block mt-16" data-action="notif-times">Guardar horarios</button>
  </div>`;
}

/* Un interruptor: se guarda al tiro. Al encender mediodía u hábitos sin hora, queda la sugerida. */
function cambiarAviso(k, on) {
  if (!AVISOS_TIPOS.includes(k)) return;
  const n = STATE.settings.notif = STATE.settings.notif || { subs: [] };
  n.avisos = Object.assign({}, n.avisos, { [k]: !!on });
  if (on && k === "mediodia" && !n.mediodia) n.mediodia = AVISOS_HORAS.mediodia;
  if (on && k === "habitos" && !n.habitosHora) n.habitosHora = AVISOS_HORAS.habitos;
  saveState();
  rerender();
}
/* Un nivel de un toque: deja encendido exactamente lo de ese nivel */
function elegirNivelAvisos(nivel) {
  if (!AVISOS_NIVELES[nivel]) return;
  const n = STATE.settings.notif = STATE.settings.notif || { subs: [] };
  const on = new Set(AVISOS_NIVELES[nivel]);
  n.avisos = {};
  AVISOS_TIPOS.forEach(k => { n.avisos[k] = on.has(k); });
  if (on.has("mediodia") && !n.mediodia) n.mediodia = AVISOS_HORAS.mediodia;
  if (on.has("habitos") && !n.habitosHora) n.habitosHora = AVISOS_HORAS.habitos;
  saveState();
  rerender();
  toast("🔔 Avisos: " + ({ esencial: "lo esencial", recomendado: "recomendado", todo: "todos" })[nivel]);
}

async function enableNotifications() {
  const soporte = soportePush();
  if (soporte === "ios_instalar") { closeModal(); return toast("En iPhone, abre Rumbo desde el ícono de tu pantalla de inicio", true); }
  if (soporte !== "si") return toast("Tu navegador no soporta notificaciones", true);
  // El permiso primero: el navegador solo lo pregunta justo después de tocar el botón
  let perm;
  try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
  if (perm !== "granted") { closeModal(); if (CURRENT === "notif") rerender(); return toast("Permiso no concedido", true); }
  try {
    const sub = await suscribirPush(await pushClave());
    const j = sub.toJSON();
    const r = await BACKEND.pushRegistrar({ endpoint: j.endpoint || sub.endpoint, p256dh: (j.keys || {}).p256dh || "", auth: (j.keys || {}).auth || "", dispositivo: describirDispositivo() });
    if (r && r.error) throw new Error(r.error);
    STATE.settings.notif = STATE.settings.notif || { subs: [] };
    const n = STATE.settings.notif;
    n.enabled = true;
    n.version = 2;                                   // dispositivos en suscripciones_push (ya no en el estado)
    n.manana = n.manana || "08:00";
    n.noche = n.noche || "21:00";
    n.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    PUSH_DISPOSITIVO = true;
    saveState();
    closeModal();
    if (CURRENT === "notif") rerender();
    toast("🔔 Notificaciones activadas en este dispositivo");
  } catch (e) {
    console.warn("push subscribe", e);
    closeModal();
    toast("No se pudieron activar aquí. Intenta de nuevo en un rato.", true);
  }
}

async function disableNotifications() {
  try {
    const sub = await suscripcionActual();
    if (sub) {
      await BACKEND.pushQuitar(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) { console.warn(e); }
  PUSH_DISPOSITIVO = false;
  if (CURRENT === "notif") rerender();
  toast("Notificaciones desactivadas en este dispositivo");
}

function saveNotifTimes() {
  const m = (document.getElementById("notif-manana") || {}).value || "08:00";
  const no = (document.getElementById("notif-noche") || {}).value || "21:00";
  STATE.settings.notif = STATE.settings.notif || { subs: [] };
  STATE.settings.notif.manana = m;
  STATE.settings.notif.noche = no;
  try { STATE.settings.notif.tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
  const md = document.getElementById("notif-mediodia");
  if (md && md.value) STATE.settings.notif.mediodia = md.value;
  const hb = document.getElementById("notif-habitos");
  if (hb && hb.value) STATE.settings.notif.habitosHora = hb.value;
  saveState();
  rerender();
  toast("Horarios guardados ⏰");
}

/* La prueba sale del servidor, igual que los recordatorios: si llega, llegan los avisos */
async function testNotification() {
  const sub = await suscripcionActual().catch(() => null);
  if (!sub || PUSH_DISPOSITIVO !== true) return toast("Primero activa las notificaciones en este dispositivo", true);
  toast("Enviando la prueba…");
  const r = await BACKEND.pushApi("POST", { accion: "prueba", endpoint: sub.endpoint });
  if (r && r.enviadas > 0) return toast("Prueba enviada: te llega en unos segundos 👀");
  if (r && (r.borradas > 0 || r.error === "no-registrado")) {
    await sub.unsubscribe().catch(() => {});
    PUSH_DISPOSITIVO = false;
    if (CURRENT === "notif") rerender();
    return toast("Este dispositivo ya no está activado. Vuelve a activarlo.", true);
  }
  toast("No se pudo enviar la prueba. Intenta de nuevo en un rato.", true);
}

/* Ofrecer activar tras el onboarding (solo si el permiso aún no se decidió) */
function maybePromptNotif() {
  if (notifPerm() !== "default") return;
  openModal("🔔 Recordatorios de tu ritual", `
    <p class="soft">¿Quieres que Rumbo te avise en la <b>mañana</b> para iniciar tu día y en la <b>noche</b> para cerrarlo?</p>
    <div class="row mt-16">
      <button class="btn btn--soft" style="flex:1" data-action="close-modal">Ahora no</button>
      <button class="btn btn--primary" style="flex:1" data-action="notif-enable">Activar</button>
    </div>
    <p class="text-xs muted mt-16">Podrás cambiarlo cuando quieras en 🔔 Notificaciones.</p>`);
}
