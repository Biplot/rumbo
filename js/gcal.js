/* ============================================================
   RUMBO · Google Calendar (solo lectura)
   La persona conecta su Google con el inicio de sesión oficial (Google Identity Services)
   y elige qué calendarios ver. Sus eventos aparecen en Inicio, Semana, Calendario y en
   la apertura del día. Rumbo nunca crea ni cambia nada en su calendario.

   Privacidad: en la cuenta (STATE, sincronizado) solo se guarda si está conectado y qué
   calendarios eligió: settings.gcal = { conectado, calendarios: [ids] | null, ts }.
   El permiso de Google (dura 1 hora) y los eventos quedan SOLO en este equipo (localStorage).
   Sin ID de cliente configurado, todo esto queda oculto.
   ============================================================ */

const GCAL = {
  clientId: "686189112913-j7ekhutggk3c6tc04jatto3udrd88g1g.apps.googleusercontent.com",   // ID de cliente OAuth (proyecto "Rumbo" en Google Cloud, tipo "Aplicación web"); vacío = función oculta
  scope: "https://www.googleapis.com/auth/calendar.readonly",
  api: "https://www.googleapis.com/calendar/v3",
  gis: "https://accounts.google.com/gsi/client",
  diasAtras: 31, diasAdelante: 62,   // rango de eventos que se trae
  refrescoMin: 30,                   // cada cuánto se actualizan solos (si el permiso sigue vigente)
};
let GCAL_CARGANDO = false;

function gcalDisponible() { return !!GCAL.clientId; }
function gcalState(S) {
  S = S || STATE;
  if (!S.settings.gcal || typeof S.settings.gcal !== "object") S.settings.gcal = { conectado: false, calendarios: null, ts: 0 };
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

/* -------- Google Identity Services (se carga solo al conectar) -------- */
function gcalCargarGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = GCAL.gis; s.async = true;
    s.onload = () => ok(); s.onerror = () => mal(new Error("No se pudo cargar el inicio de sesión de Google"));
    document.head.appendChild(s);
  });
}
/* Pide el permiso a Google (debe venir de un toque de la persona: abre una ventana de Google) */
async function gcalPedirToken(prompt) {
  await gcalCargarGIS();
  return new Promise((ok, mal) => {
    const cliente = google.accounts.oauth2.initTokenClient({
      client_id: GCAL.clientId, scope: GCAL.scope,
      callback: r => {
        if (!r || r.error || !r.access_token) return mal(new Error((r && r.error) || "sin permiso"));
        const l = gcalLocal();
        l.token = r.access_token; l.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        gcalGuardarLocal(l); ok(r.access_token);
      },
      error_callback: e => mal(new Error((e && e.type) || "ventana cerrada")),
    });
    cliente.requestAccessToken({ prompt: prompt == null ? "" : prompt });
  });
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
  try {
    const token = await gcalPedirToken("consent");
    const g = gcalState(); g.conectado = true; g.ts = Date.now(); saveState();
    await gcalTraer(token);
    toast("📆 Google Calendar conectado");
    rerender(); openGcalConfig();
  } catch (e) {
    toast("No se conectó Google Calendar: " + e.message, true);
  } finally { GCAL_CARGANDO = false; }
}
/* interactivo = viene de un toque (puede abrir la ventana de Google si el permiso venció) */
async function gcalActualizar(interactivo) {
  if (!gcalConectado() || GCAL_CARGANDO) return;
  GCAL_CARGANDO = true;
  try {
    let token = gcalTokenVigente();
    if (!token) { if (!interactivo) return; token = await gcalPedirToken(""); }
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
  if (gcalTokenVigente() && (!l.ts || Date.now() - l.ts > GCAL.refrescoMin * 60000)) gcalActualizar(false);
}
function gcalDesconectar() {
  const l = gcalLocal();
  try { if (l.token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(l.token, () => {}); } catch (e) { /* igual se borra aquí */ }
  try { localStorage.removeItem(gcalClave()); } catch (e) { /* nada que borrar */ }
  const g = gcalState(); g.conectado = false; g.ts = Date.now();
  saveState(); closeModal(); rerender();
  toast("Google Calendar desconectado. Tus eventos se borraron de este equipo.");
}
function openGcalConfig() {
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
  const l = gcalLocal();
  if (gcalTokenVigente() && l.ts) return "";
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
  if (!gcalConectado()) {
    return `<div class="card mt-16"><div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div style="min-width:0"><div class="card__title" style="font-size:15px">📆 Google Calendar</div>
        <div class="text-sm muted mt-8">Ve tus reuniones y eventos junto a tus tareas: en Inicio, Semana, aquí y al abrir tu día. Solo lectura.</div></div>
      <button class="btn btn--primary" data-action="gcal-conectar">Conectar Google Calendar</button></div></div>`;
  }
  const l = gcalLocal(), n = (gcalState().calendarios || []).length;
  const cuando = l.ts ? new Date(l.ts).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca";
  return `<div class="card mt-16"><div class="flex-between" style="flex-wrap:wrap;gap:12px">
    <div style="min-width:0"><div class="card__title" style="font-size:15px">📆 Google Calendar conectado</div>
      <div class="text-sm muted mt-8">${n} calendario${n === 1 ? "" : "s"} · actualizado ${cuando}</div></div>
    <div class="row" style="gap:8px"><button class="btn btn--soft" data-action="gcal-actualizar">🔄 Actualizar</button>
      <button class="btn-ghost" data-action="gcal-config">⚙️ Calendarios</button></div></div></div>`;
}
