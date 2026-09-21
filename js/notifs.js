/* ============================================================
   RUMBO · Notificaciones (Web Push, lado cliente)
   La suscripción se guarda en settings.notif.subs (dentro del estado).
   El ENVÍO mañana/noche lo hace el servidor (Parte B, Edge Function).
   ============================================================ */

const VAPID_PUBLIC = "BEmWz9J7qwK6VfhvfGCPMLQbWXDR_aU_soFpJCwkAlnN7OoYSw3qJcT7Wm1RDmu1e80F2rmJ-dEB1NK44MQznUM";

function notifSupported() {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}
function notifPerm() { return notifSupported() ? Notification.permission : "unsupported"; }

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function renderNotificaciones() {
  const n = STATE.settings.notif || {};
  const perm = notifPerm();
  const activo = n.enabled && perm === "granted" && (n.subs || []).length > 0;

  let banner, tono = "notif-banner";
  if (perm === "unsupported") { banner = "Tu navegador no soporta notificaciones. En iPhone: abre Rumbo <b>instalada en la pantalla de inicio</b> (Compartir → Agregar a inicio)."; tono += " is-warn"; }
  else if (perm === "denied") { banner = "El permiso está bloqueado. Actívalo en los ajustes de notificaciones de tu navegador/teléfono para Rumbo."; tono += " is-warn"; }
  else if (activo) { banner = "✅ Notificaciones activadas en este dispositivo."; tono += " is-ok"; }
  else { banner = "Actívalas para recibir tus recordatorios de mañana y noche."; }

  return `
  <div class="card">
    <div class="card__title">🔔 Recordatorios del ritual</div>
    <p class="soft mt-8">Un aviso en la <b>mañana</b> para iniciar tu día y otro en la <b>noche</b> para cerrarlo — aunque tengas la app cerrada.</p>
    <div class="${tono} mt-16">${banner}</div>
    ${activo
      ? `<button class="btn btn--soft btn-block mt-16" data-action="notif-disable">Desactivar en este dispositivo</button>`
      : `<button class="btn btn--primary btn-block mt-16" data-action="notif-enable" ${perm === "unsupported" ? "disabled" : ""}>Activar notificaciones</button>`}
  </div>

  <div class="card mt-16">
    <div class="card__title" style="font-size:15px">Horarios</div>
    <div class="notif-horas mt-16">
      <div class="notif-hora"><label class="text-xs muted">🌅 Mañana · iniciar</label>
        <input class="input" type="time" id="notif-manana" value="${n.manana || "08:00"}"></div>
      <div class="notif-hora"><label class="text-xs muted">🌙 Noche · cerrar</label>
        <input class="input" type="time" id="notif-noche" value="${n.noche || "21:00"}"></div>
    </div>
    <button class="btn btn--cian btn-block mt-16" data-action="notif-times">Guardar horarios</button>
  </div>

  ${perm === "granted" ? `<button class="btn-ghost btn-block mt-16" data-action="notif-test">Enviar una notificación de prueba</button>` : ""}
  <p class="text-xs muted mt-16">📱 En iPhone se requiere tener Rumbo instalada en la pantalla de inicio. El envío automático a tus horarios se activa con el servidor (lo montamos en la Parte B).</p>`;
}

async function enableNotifications() {
  if (!notifSupported()) return toast("Tu navegador no soporta notificaciones", true);
  let perm;
  try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
  if (perm !== "granted") { closeModal(); if (CURRENT === "notif") rerender(); return toast("Permiso no concedido", true); }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
    const j = sub.toJSON();
    STATE.settings.notif = STATE.settings.notif || { manana: "08:00", noche: "21:00", subs: [] };
    const n = STATE.settings.notif;
    n.enabled = true;
    n.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    n.subs = (n.subs || []).filter(s => s.endpoint !== j.endpoint);
    n.subs.push({ endpoint: j.endpoint, keys: j.keys, ua: (navigator.userAgent || "").slice(0, 120) });
    saveState();
    closeModal();
    if (CURRENT === "notif") rerender();
    toast("🔔 Notificaciones activadas");
  } catch (e) {
    console.warn("push subscribe", e);
    closeModal();
    toast("No se pudo activar el push aquí", true);
  }
}

async function disableNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const ep = sub.endpoint;
      await sub.unsubscribe();
      if (STATE.settings.notif) STATE.settings.notif.subs = (STATE.settings.notif.subs || []).filter(s => s.endpoint !== ep);
    }
  } catch (e) { console.warn(e); }
  if (STATE.settings.notif) STATE.settings.notif.enabled = false;
  saveState();
  if (CURRENT === "notif") rerender();
  toast("Notificaciones desactivadas");
}

function saveNotifTimes() {
  const m = (document.getElementById("notif-manana") || {}).value || "08:00";
  const no = (document.getElementById("notif-noche") || {}).value || "21:00";
  STATE.settings.notif = STATE.settings.notif || { subs: [] };
  STATE.settings.notif.manana = m;
  STATE.settings.notif.noche = no;
  saveState();
  rerender();
  toast("Horarios guardados ⏰");
}

async function testNotification() {
  if (notifPerm() !== "granted") return toast("Primero activa las notificaciones", true);
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("🌅 Rumbo", {
      body: "Así se verán tus recordatorios. ¡A iniciar tu día!",
      icon: "assets/icon-192.png", badge: "assets/icon-192.png",
      tag: "rumbo-test", data: { url: "./#ritual" },
    });
    toast("Notificación enviada 👀");
  } catch (e) { toast("No se pudo mostrar la prueba", true); }
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
