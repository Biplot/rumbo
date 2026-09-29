/* ============================================================
   RUMBO · Google Calendar (solo lectura)
   La persona conecta su Google con el inicio de sesión oficial (Google Identity Services)
   y elige qué calendarios ver. Sus eventos aparecen en Inicio, Semana, Calendario y en
   la apertura del día. Rumbo nunca crea ni cambia nada en su calendario.

   Privacidad: en la cuenta (STATE, sincronizado) solo se guarda si está conectado y qué
   calendarios eligió: settings.gcal = { conectado, calendarios: [ids] | null, ts }.
   El permiso de Google (dura 1 hora) y los eventos quedan SOLO en este equipo (localStorage).
   Sin ID de cliente configurado, todo esto queda oculto.

   Conexión permanente: si la función del servidor "gcal" está instalada (supabase/functions/gcal),
   al conectar se usa el flujo con código y el servidor guarda, cifrado, el permiso de renovación.
   Cuando el permiso de 1 hora vence, se pide uno nuevo al servidor en silencio (settings.gcal.servidor).
   Sin la función, todo sigue como antes (🔄 renueva el permiso con un toque).
   ============================================================ */

const GCAL = {
  clientId: "686189112913-j7ekhutggk3c6tc04jatto3udrd88g1g.apps.googleusercontent.com",   // ID de cliente OAuth (proyecto "Rumbo" en Google Cloud, tipo "Aplicación web"); vacío = función oculta
  scope: "https://www.googleapis.com/auth/calendar.readonly",
  api: "https://www.googleapis.com/calendar/v3",
  gis: "https://accounts.google.com/gsi/client",
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  callback: "gcal-callback.html",    // página que recibe el permiso cuando se va y vuelve de Google
  redireccion: null,                 // null = automático (iPhone/iPad: ir y volver; resto: ventana de Google)
  diasAtras: 31, diasAdelante: 62,   // rango de eventos que se trae
  refrescoMin: 30,                   // cada cuánto se actualizan solos (si el permiso sigue vigente)
};
let GCAL_CARGANDO = false;
let GCAL_CLIENTE = null, GCAL_PENDIENTE = null;
let GCAL_CODIGO = null;          // cliente de Google para el flujo con código (conexión permanente)
let GCAL_SERVIDOR = null;        // ¿está instalada y configurada la función "gcal"? null = aún no se sabe

/* ¿El servidor puede mantener la conexión? Se pregunta una vez por sesión */
function gcalServidorListo() {
  if (GCAL_SERVIDOR !== null) return Promise.resolve(GCAL_SERVIDOR);
  if (gcalServidorListo.p) return gcalServidorListo.p;
  gcalServidorListo.p = BACKEND.llamarFuncion("gcal", { accion: "estado" }).then(d => {
    gcalServidorListo.p = null;
    if (d && d.error === "red") return false;          // sin conexión: se vuelve a preguntar después
    GCAL_SERVIDOR = !!(d && d.listo);
    // Conectado a la antigua: mostrar la invitación a conectar para siempre
    if (GCAL_SERVIDOR && STATE && gcalConectado() && !gcalState().servidor) rerender();
    return GCAL_SERVIDOR;
  });
  return gcalServidorListo.p;
}
/* Permiso nuevo desde el servidor, sin ventanas. null si no se puede (y avisa si hay que reconectar) */
async function gcalTokenServidor() {
  if (!gcalState().servidor) return null;
  const d = await BACKEND.llamarFuncion("gcal", { accion: "token" });
  if (d && d.access_token) { gcalGuardarToken(d.access_token, d.expires_in); return d.access_token; }
  if (d && d.error === "reconectar") { const g = gcalState(); g.servidor = false; g.ts = Date.now(); saveState(); }
  return null;
}
function gcalGuardarToken(token, expira) {
  const l = gcalLocal();
  l.token = token; l.exp = Date.now() + (Number(expira) || 3600) * 1000;
  gcalGuardarLocal(l);
}

function gcalDisponible() { return !!GCAL.clientId; }
function gcalState(S) {
  S = S || STATE;
  if (!S.settings.gcal || typeof S.settings.gcal !== "object") S.settings.gcal = { conectado: false, calendarios: null, servidor: false, ts: 0 };
  return S.settings.gcal;
}
function gcalConectado() { return gcalDisponible() && !!gcalState().conectado; }

/* -------- Lo que vive solo en este equipo -------- */
function gcalClave() { return "rumbo-gcal:" + ((CURRENT_USER && CURRENT_USER.id) || "anon"); }
function gcalLocal() {
  try { return JSON.parse(localStorage.getItem(gcalClave()) || "null") || {}; } catch (e) { return {}; }
}
function gcalGuardarLocal(x) {
  try { localStorage.setItem(gcalClave(), JSON.stringify(x)); } catch (e) { /* sin espacio o bloqueado: se sigue sin caché */ }
}
function gcalTokenVigente() { const l = gcalLocal(); return l.token && l.exp > Date.now() + 60000 ? l.token : null; }

/* -------- Eventos: de la respuesta de Google a { iso: [eventos] } -------- */
/* Un evento de Google → uno o más días (los de día completo que duran varios días se repiten) */
function gcalNormalizar(item, calId) {
  if (!item || item.status === "cancelled" || !item.start) return [];
  const titulo = (item.summary || "(Sin título)").trim();
  const base = { id: item.id, cal: calId, titulo, lugar: item.location || "" };
  if (item.start.date) {
    const out = [];
    const fin = item.end && item.end.date ? item.end.date : agSumar(item.start.date, 1);   // fin exclusivo
    for (let iso = item.start.date, n = 0; iso < fin && n < 62; iso = agSumar(iso, 1), n++) out.push(Object.assign({ iso, todoDia: true, hora: "", horaFin: "" }, base));
    return out;
  }
  const ini = new Date(item.start.dateTime), fin = item.end && item.end.dateTime ? new Date(item.end.dateTime) : ini;
  if (isNaN(ini)) return [];
  const hhmm = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const isoIni = isoLocal(ini), isoFin = isoLocal(fin);
  return [Object.assign({ iso: isoIni, todoDia: false, hora: hhmm(ini), horaFin: isoFin === isoIni ? hhmm(fin) : "" }, base)];
}
function gcalAgrupar(lista) {
  const dias = {};
  lista.forEach(e => { (dias[e.iso] = dias[e.iso] || []).push(e); });
  Object.values(dias).forEach(d => d.sort((a, b) => (b.todoDia - a.todoDia) || a.hora.localeCompare(b.hora) || a.titulo.localeCompare(b.titulo)));
  return dias;
}
function gcalEventosDia(iso) {
  if (!gcalConectado()) return [];
  const l = gcalLocal(), elegidos = gcalState().calendarios;
  return ((l.eventos || {})[iso] || []).filter(e => !elegidos || elegidos.includes(e.cal));
}

/* -------- Pedir el permiso a Google --------
   · Computador y Android: ventana de Google (Google Identity Services). La librería se precarga al
     mostrar el botón, para que la ventana se abra en el mismo toque (si no, el navegador la bloquea).
   · iPhone y iPad (sobre todo con Rumbo instalado en la pantalla de inicio): iOS bloquea esas ventanas,
     así que se va a la página de Google y se vuelve a gcal-callback.html, que guarda el permiso. */
function gcalUsarRedireccion() {
  if (GCAL.redireccion != null) return !!GCAL.redireccion;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function gcalCargarGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  if (gcalCargarGIS.p) return gcalCargarGIS.p;
  gcalCargarGIS.p = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = GCAL.gis; s.async = true;
    s.onload = () => ok(); s.onerror = () => { gcalCargarGIS.p = null; mal(new Error("No se pudo cargar el inicio de sesión de Google")); };
    document.head.appendChild(s);
  });
  return gcalCargarGIS.p;
}
/* Deja listo el cliente de Google antes del toque (no hace nada en iPhone ni sin ID) */
function gcalPrecargar() {
  if (!gcalDisponible()) return Promise.resolve();
  gcalServidorListo().catch(() => {});
  if (gcalUsarRedireccion()) return Promise.resolve();
  if (GCAL_CLIENTE) return Promise.resolve();
  return gcalCargarGIS().then(() => {
    if (!GCAL_CODIGO && google.accounts.oauth2.initCodeClient) GCAL_CODIGO = google.accounts.oauth2.initCodeClient({
      client_id: GCAL.clientId, scope: GCAL.scope, ux_mode: "popup",
      callback: r => {
        const p = GCAL_PENDIENTE; GCAL_PENDIENTE = null;
        if (!p) return;
        if (!r || r.error || !r.code) return p.mal(new Error((r && r.error) || "sin permiso"));
        p.ok({ code: r.code });
      },
      error_callback: e => { const p = GCAL_PENDIENTE; GCAL_PENDIENTE = null; if (p) p.mal(new Error((e && e.type) === "popup_failed_to_open" ? "el navegador bloqueó la ventana de Google" : "se cerró la ventana de Google")); },
    });
    if (GCAL_CLIENTE) return;
    GCAL_CLIENTE = google.accounts.oauth2.initTokenClient({
      client_id: GCAL.clientId, scope: GCAL.scope,
      callback: r => {
        const p = GCAL_PENDIENTE; GCAL_PENDIENTE = null;
        if (!p) return;
        if (!r || r.error || !r.access_token) return p.mal(new Error((r && r.error) || "sin permiso"));
        const l = gcalLocal();
        l.token = r.access_token; l.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        gcalGuardarLocal(l); p.ok(r.access_token);
      },
      error_callback: e => { const p = GCAL_PENDIENTE; GCAL_PENDIENTE = null; if (p) p.mal(new Error((e && e.type) === "popup_failed_to_open" ? "el navegador bloqueó la ventana de Google" : "se cerró la ventana de Google")); },
    });
  });
}
/* Pide el permiso (debe llamarse directo desde un toque). prompt "consent" = primera vez */
function gcalPedirToken(prompt) {
  if (gcalUsarRedireccion()) { gcalRedirigir(prompt); return new Promise(() => {}); }   // la página se va a Google
  return new Promise((ok, mal) => {
    GCAL_PENDIENTE = { ok, mal };
    const pedir = () => GCAL_CLIENTE.requestAccessToken({ prompt: prompt == null ? "" : prompt });
    if (GCAL_CLIENTE) pedir();                     // en el mismo toque: el navegador no la bloquea
    else gcalPrecargar().then(pedir, mal);         // respaldo (puede que el navegador la bloquee)
  });
}
/* Conexión permanente: pide a Google un código (debe llamarse directo desde un toque) */
function gcalPedirCodigo() {
  if (gcalUsarRedireccion()) { gcalRedirigir("consent", true); return new Promise(() => {}); }
  return new Promise((ok, mal) => {
    GCAL_PENDIENTE = { ok, mal };
    const pedir = () => GCAL_CODIGO.requestCode();
    if (GCAL_CODIGO) pedir(); else gcalPrecargar().then(() => GCAL_CODIGO ? pedir() : mal(new Error("Google no está disponible")), mal);
  });
}
/* Cambia el código por el permiso en el servidor (que guarda la renovación) */
async function gcalCanjear(code, redirectUri) {
  const d = await BACKEND.llamarFuncion("gcal", { accion: "conectar", code, redirect_uri: redirectUri });
  if (!d || !d.access_token) {
    const txt = d && d.error === "sin-renovacion" ? "Google no entregó el permiso permanente. Quita el acceso de Rumbo en myaccount.google.com/permissions y conecta otra vez."
      : d && d.error === "sin-calendario" ? "no diste permiso para ver tu calendario." : "el servidor no pudo completar la conexión.";
    throw new Error(txt);
  }
  gcalGuardarToken(d.access_token, d.expires_in);
  const g = gcalState(); g.conectado = true; g.servidor = true; g.ts = Date.now(); saveState();
  return d.access_token;
}
function gcalRedirectUri() { return new URL(GCAL.callback, location.href.split("#")[0]).href; }
function gcalRedirigir(prompt, codigo) {
  const estado = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    localStorage.setItem("rumbo-gcal-oauth", JSON.stringify({ estado, clave: gcalClave(), conectar: prompt === "consent", codigo: !!codigo, ruta: CURRENT, ts: Date.now() }));
  } catch (e) { toast("No se puede guardar en este equipo (¿modo privado?)", true); return; }
  const q = new URLSearchParams({ client_id: GCAL.clientId, redirect_uri: gcalRedirectUri(), response_type: codigo ? "code" : "token", scope: GCAL.scope, include_granted_scopes: "true", state: estado });
  if (codigo) q.set("access_type", "offline");
  if (prompt) q.set("prompt", prompt);
  location.href = GCAL.auth + "?" + q.toString();
}
/* Al volver de Google (iPhone): gcal-callback.html dejó el resultado en "rumbo-gcal-vuelta" */
function gcalRetorno() {
  if (!gcalDisponible()) return false;
  let v = null;
  try { v = JSON.parse(localStorage.getItem("rumbo-gcal-vuelta") || "null"); localStorage.removeItem("rumbo-gcal-vuelta"); } catch (e) { v = null; }
  if (!v) return false;
  if (!v.ok) { toast("No se conectó Google Calendar: " + (v.error || "intenta de nuevo"), true); return true; }
  if (v.code) {   // conexión permanente (iPhone): el servidor cambia el código por el permiso
    gcalCanjear(v.code, gcalRedirectUri()).then(t => gcalTerminar(true, t), e => toast("No se conectó Google Calendar: " + e.message, true));
    return true;
  }
  if (v.conectar) { const g = gcalState(); g.conectado = true; g.ts = Date.now(); saveState(); }
  gcalTerminar(!!v.conectar, gcalTokenVigente());
  return true;
}
/* Con el permiso en mano: traer calendarios y eventos */
async function gcalTerminar(conectar, token) {
  if (!token) return;
  GCAL_CARGANDO = true;
  try {
    await gcalTraer(token);
    toast(conectar ? "📆 Google Calendar conectado" : "📆 Calendario actualizado");
    rerender();
    if (conectar) openGcalConfig();
  } catch (e) {
    toast("No se pudieron traer tus eventos de Google", true);
  } finally { GCAL_CARGANDO = false; }
}
async function gcalGet(ruta, token) {
  const r = await fetch(GCAL.api + ruta, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 401) { const l = gcalLocal(); delete l.token; delete l.exp; gcalGuardarLocal(l); throw Object.assign(new Error("permiso vencido"), { vencido: true }); }
  if (!r.ok) throw new Error("Google respondió " + r.status);
  return r.json();
}
/* Trae la lista de calendarios y los eventos del rango; guarda todo en este equipo */
async function gcalTraer(token) {
  const cal = await gcalGet("/users/me/calendarList?minAccessRole=reader&fields=items(id,summary,summaryOverride,backgroundColor,selected,primary)", token);
  const lista = (cal.items || []).map(c => ({ id: c.id, nombre: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || "", selected: !!c.selected, primary: !!c.primary }));
  const g = gcalState();
  if (!g.calendarios) { g.calendarios = lista.filter(c => c.selected || c.primary).map(c => c.id); g.ts = Date.now(); saveState(); }
  const hoy = todayISO(), desde = agSumar(hoy, -GCAL.diasAtras), hasta = agSumar(hoy, GCAL.diasAdelante);
  const tMin = new Date(desde + "T00:00:00").toISOString(), tMax = new Date(hasta + "T00:00:00").toISOString();
  const todos = [];
  for (const id of g.calendarios.filter(id => lista.some(c => c.id === id))) {
    const q = `?timeMin=${encodeURIComponent(tMin)}&timeMax=${encodeURIComponent(tMax)}&singleEvents=true&orderBy=startTime&maxResults=250&fields=items(id,summary,location,status,start,end)`;
    const r = await gcalGet(`/calendars/${encodeURIComponent(id)}/events${q}`, token);
    (r.items || []).forEach(it => todos.push(...gcalNormalizar(it, id)));
  }
  const l = gcalLocal();
  Object.assign(l, { lista, eventos: gcalAgrupar(todos), desde, hasta, ts: Date.now() });
  gcalGuardarLocal(l);
}

/* -------- Acciones -------- */
async function gcalConectar() {
  if (!gcalDisponible() || GCAL_CARGANDO) return;
  GCAL_CARGANDO = true;
  let token;
  if (GCAL_SERVIDOR) {   // conexión permanente: una sola vez y se renueva sola
    try { const { code } = await gcalPedirCodigo(); token = await gcalCanjear(code, "postmessage"); }
    catch (e) { GCAL_CARGANDO = false; return toast("No se conectó Google Calendar: " + e.message, true); }
    GCAL_CARGANDO = false;
    return gcalTerminar(true, token);
  }
  try { token = await gcalPedirToken("consent"); }
  catch (e) { GCAL_CARGANDO = false; return toast("No se conectó Google Calendar: " + e.message, true); }
  const g = gcalState(); g.conectado = true; g.ts = Date.now(); saveState();
  GCAL_CARGANDO = false;
  await gcalTerminar(true, token);
}
/* interactivo = viene de un toque (puede abrir la ventana de Google si el permiso venció) */
async function gcalActualizar(interactivo) {
  if (!gcalConectado() || GCAL_CARGANDO) return;
  GCAL_CARGANDO = true;
  try {
    let token = gcalTokenVigente() || await gcalTokenServidor();
    if (!token) { if (!interactivo) { rerender(); return; } token = await gcalPedirToken(""); }
    await gcalTraer(token);
    if (interactivo) toast("📆 Calendario actualizado");
    rerender();
    // Si la configuración sigue abierta (se tocó 🔄 ahí), se vuelve a dibujar con la lista nueva
    if (!document.getElementById("modalOverlay").hidden && document.querySelector("#modalBody .gcal-cal, #modalBody [data-action=gcal-guardar]")) openGcalConfig();
  } catch (e) {
    if (interactivo) toast(e.vencido ? "Tu permiso de Google venció: toca 🔄 otra vez" : "No se pudo actualizar el calendario", true);
    else if (e.vencido) rerender();
  } finally { GCAL_CARGANDO = false; }
}
/* Al abrir la app y al volver a ella: actualizar sin molestar (solo si el permiso sigue vigente) */
function gcalAlIniciar() {
  if (!gcalConectado()) return;
  const l = gcalLocal();
  const puede = gcalTokenVigente() || gcalState().servidor;   // con la conexión permanente, siempre se puede
  if (puede && (!l.ts || Date.now() - l.ts > GCAL.refrescoMin * 60000)) gcalActualizar(false);
}
/* Con la app abierta: se actualiza sola cada media hora */
if (typeof window !== "undefined" && window.setInterval) window.setInterval(() => { if (typeof STATE !== "undefined" && STATE && !document.hidden) gcalAlIniciar(); }, 5 * 60000);
function gcalDesconectar() {
  if (gcalState().servidor) BACKEND.llamarFuncion("gcal", { accion: "desconectar" });
  const l = gcalLocal();
  try { if (l.token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(l.token, () => {}); } catch (e) { /* igual se borra aquí */ }
  try { localStorage.removeItem(gcalClave()); } catch (e) { /* nada que borrar */ }
  const g = gcalState(); g.conectado = false; g.servidor = false; g.ts = Date.now();
  saveState(); closeModal(); rerender();
  toast("Google Calendar desconectado. Tus eventos se borraron de este equipo.");
}
function openGcalConfig() {
  gcalPrecargar().catch(() => {});
  const l = gcalLocal(), g = gcalState(), lista = l.lista || [];
  const elegidos = new Set(g.calendarios || []);
  openModal("📆 Google Calendar", `
    <p class="text-sm soft">Rumbo <b>solo lee</b> tus eventos: nunca crea ni cambia nada en tu calendario. Tus eventos quedan guardados solo en este equipo.</p>
    <div class="text-xs muted mt-16" style="text-transform:uppercase;letter-spacing:.06em">Calendarios que quieres ver</div>
    ${lista.length ? lista.map(c => `<label class="mes-hab" style="cursor:pointer"><span class="mes-hab__n"><span class="gcal-dot" style="background:${escapeAttr(c.color || "var(--cian)")}"></span>${escapeHtml(c.nombre)}</span>
      <input type="checkbox" class="gcal-cal" value="${escapeAttr(c.id)}" ${elegidos.has(c.id) ? "checked" : ""}></label>`).join("")
    : `<div class="empty">Toca 🔄 Actualizar para traer tus calendarios.</div>`}
    <button class="btn btn--primary btn-block mt-16" data-action="gcal-guardar">Guardar</button>
    <div class="row mt-8" style="gap:8px">
      <button class="btn-ghost" style="flex:1" data-action="gcal-actualizar">🔄 Actualizar</button>
      <button class="btn-ghost" style="flex:1;color:var(--coral)" data-action="gcal-desconectar">Desconectar</button></div>`);
}
function gcalGuardarConfig() {
  const ids = Array.from(document.querySelectorAll(".gcal-cal")).filter(c => c.checked).map(c => c.value);
  const g = gcalState(); g.calendarios = ids; g.ts = Date.now();
  saveState(); closeModal();
  const token = gcalTokenVigente();
  if (token) gcalActualizar(true); else rerender();
  toast(`📆 ${ids.length} calendario${ids.length === 1 ? "" : "s"}`);
}

/* -------- Piezas de interfaz -------- */
function gcalFila(e, compacto) {
  const hora = e.todoDia ? "Todo el día" : e.hora + (e.horaFin && !compacto ? "–" + e.horaFin : "");
  return `<div class="gcal-ev${compacto ? " gcal-ev--c" : ""}" title="${escapeAttr(e.titulo + (e.lugar ? " · " + e.lugar : ""))}">
    <span class="gcal-ev__h">${hora}</span><span class="gcal-ev__t">${escapeHtml(e.titulo)}</span></div>`;
}
/* Aviso cuando los eventos pueden estar desactualizados (el permiso de Google dura 1 hora) */
function gcalAvisoActualizar() {
  if (!gcalConectado()) return "";
  const l = gcalLocal(), g = gcalState();
  gcalPrecargar().catch(() => {});
  // Ya conectado "a la antigua" y el servidor ya puede mantenerlo: invitar a reconectar una vez
  if (!g.servidor && GCAL_SERVIDOR) return `<div class="gcal-permanente"><span class="text-sm">Conéctalo una vez más y tu calendario se actualizará solo, sin volver a pedirte permiso.</span>
    <button class="btn btn--linea" data-action="gcal-conectar">Conectar para siempre</button></div>`;
  if (g.servidor || (gcalTokenVigente() && l.ts)) return "";
  return `<button class="btn-ghost gcal-refrescar" data-action="gcal-actualizar">🔄 ${l.ts ? "Actualizar" : "Traer"} eventos de Google</button>`;
}
/* Inicio: los eventos de hoy */
function renderGcalHoy() {
  if (!gcalConectado()) return "";
  const evs = gcalEventosDia(todayISO());
  return `<div class="card" data-tour="gcal">
    <div class="card__head"><div class="card__title">📆 Hoy en tu calendario</div>
      <button class="icon-btn" data-action="gcal-config" title="Calendarios de Google" aria-label="Configurar Google Calendar">⚙️</button></div>
    ${evs.length ? evs.map(e => gcalFila(e)).join("") : `<div class="empty" style="padding:10px">Sin eventos hoy.</div>`}
    ${gcalAvisoActualizar()}
  </div>`;
}
/* Semana: eventos de un día (compacto) */
function gcalDiaHtml(iso) {
  const evs = gcalEventosDia(iso);
  return evs.length ? `<div class="gcal-dia">${evs.map(e => gcalFila(e, true)).join("")}</div>` : "";
}
/* Apertura del día: para planificar las tareas alrededor de las reuniones */
function gcalAperturaHtml() {
  if (!gcalConectado()) return "";
  const evs = gcalEventosDia(todayISO());
  if (!evs.length) return "";
  return `<div class="gcal-apertura"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">📆 Hoy en tu calendario</div>
    ${evs.map(e => gcalFila(e)).join("")}</div>`;
}
/* Calendario: tarjeta para conectar o configurar */
function renderGcalCard() {
  if (!gcalDisponible()) return "";
  gcalPrecargar().catch(() => {});
  if (!gcalConectado()) {
    return `<div class="card mt-16"><div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0"><div class="card__title" style="font-size:15px">📆 Google Calendar</div>
        <div class="text-sm muted mt-8">Ve tus reuniones y eventos junto a tus tareas: en Inicio, Semana, aquí y al abrir tu día. Solo lectura.</div></div>
      <button class="btn btn--linea" data-action="gcal-conectar">Conectar Google Calendar</button></div></div>`;
  }
  const l = gcalLocal(), n = (gcalState().calendarios || []).length;
  const cuando = l.ts ? new Date(l.ts).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca";
  return `<div class="card mt-16"><div class="flex-between" style="flex-wrap:wrap;gap:12px">
    <div style="min-width:0"><div class="card__title" style="font-size:15px">📆 Google Calendar conectado</div>
      <div class="text-sm muted mt-8">${n} calendario${n === 1 ? "" : "s"} · actualizado ${cuando}${gcalState().servidor ? " · se actualiza solo" : ""}</div></div>
    <div class="row" style="gap:8px"><button class="btn btn--soft" data-action="gcal-actualizar">🔄 Actualizar</button>
      <button class="btn-ghost" data-action="gcal-config">⚙️ Calendarios</button></div></div></div>`;
}
