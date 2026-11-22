/* ============================================================
   RUMBO · Que quien llega abra su primer día y vuelva (v152)
   · Al terminar la bienvenida se abre la apertura del primer día (antes partía un recorrido).
     Si ya es de noche (desde las 18:00): «Deja listo mañana», y la primera semana parte mañana.
   · Los avisos se ofrecen cuando la persona ya vio para qué sirven: al abrir su primer día
     («¿Te aviso a las 21:00 para cerrarlo?»), al cerrar el primero («¿Te aviso mañana a las 08:00?»)
     y una sola vez más al cerrar el tercero. En iPhone sin instalar: los pasos para instalarla.
     Lo ofrecido queda en settings.avisosOferta = { abrir, cierre, cierre3 } (ts).
   · En Android y computador, «Instalar Rumbo» con el aviso del navegador (beforeinstallprompt).
   ============================================================ */

/* -------- Instalar la app (Android y computador) -------- */
let INSTALAR_EVT = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALAR_EVT = e; });
  window.addEventListener("appinstalled", () => { INSTALAR_EVT = null; });
}
function instalarDisponible() { return !!INSTALAR_EVT && !(typeof abiertaComoApp === "function" && abiertaComoApp()); }
async function instalarApp() {
  if (!INSTALAR_EVT) return toast("Desde el menú del navegador: «Instalar app» o «Agregar a la pantalla de inicio»");
  const e = INSTALAR_EVT; INSTALAR_EVT = null;
  try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === "accepted") toast("📲 Rumbo quedó en tu pantalla de inicio"); } catch (err) {}
  if (typeof CURRENT !== "undefined" && CURRENT === "notif") rerender();
}

/* -------- El primer día, al terminar la bienvenida -------- */
function primerDiaEmpezar() {
  if (typeof dayState !== "function" || dayState() !== "por-abrir") return;
  if (new Date().getHours() >= 18) return openDejaListoManana();
  openRitualModal({ foco: "r-mision" });
}
function activacionDice(txt) {
  const quien = (typeof nombreDelElefante === "function" && nombreDelElefante()) || "Tu elefante";
  const cara = typeof eleEstado === "function" && eleEstado().tipo && typeof elefanteCaraSVG === "function" ? elefanteCaraSVG() : "🐘";
  return `<div class="arma-dice"><span class="arma-cara">${cara}</span><div class="arma-burbuja"><b>${escapeHtml(quien)}</b>${txt}</div></div>`;
}
/* De noche: se deja anotado lo de mañana (y, si se puede, el aviso para abrirlo) */
function openDejaListoManana() {
  const puede = avisosOfertaTipo() === "permiso";
  openModal("Deja listo mañana", `
    ${activacionDice("Ya es de noche: hoy no hace falta abrir el día. Anota lo más importante de mañana y te espero en la mañana para abrir tu primer día.")}
    <div class="field mt-16"><label for="dl-mision">🎯 Lo más importante de mañana</label>
      <input class="input" id="dl-mision" maxlength="120" autocomplete="off" placeholder="Ej: Enviar la propuesta"></div>
    ${puede ? `<label class="dl-aviso"><input type="checkbox" id="dl-aviso" checked>
      <span>Avísame mañana a las <input class="input" type="time" id="dl-hora" value="${escapeAttr(((STATE.settings.notif || {}).manana) || "08:00")}" aria-label="Hora del aviso"> para abrir mi día</span></label>` : ""}
    <div class="modal__cta"><button class="btn btn--primary btn-block" data-action="dl-guardar">Listo, hasta mañana</button></div>`);
  setTimeout(() => { const i = document.getElementById("dl-mision"); if (i) i.focus(); }, 80);
}
function guardarDejaListo() {
  const hoy = todayISO(), man = agSumar(hoy, 1), txt = val("dl-mision");
  STATE.settings.mananaPrimera = { fecha: man, mision: txt, ts: Date.now() };   // openRitualModal la sugiere como misión
  if (typeof cuentaAlta === "function" && cuentaAlta() === hoy) STATE.settings.alta = man;   // la primera semana parte mañana
  const aviso = document.getElementById("dl-aviso"), quiere = !!(aviso && aviso.checked);
  if (quiere) {
    const n = STATE.settings.notif = STATE.settings.notif || { subs: [] };
    n.manana = val("dl-hora") || n.manana || "08:00";
    avisosOfertaMarcar("abrir");
  }
  saveState(); closeModal(); updateTopbar(); rerender();
  if (quiere && typeof enableNotifications === "function") enableNotifications();
  else toast("🌙 Listo. Mañana abres tu primer día");
}
/* La misión que dejaste anotada para hoy (desde «Deja listo mañana») */
function misionDejadaParaHoy() {
  const m = STATE.settings.mananaPrimera;
  return m && m.fecha === todayISO() && m.mision ? m.mision : "";
}
/* En Inicio, la noche del registro: lo que dejaste listo */
function dejaListoInicioHtml() {
  const m = STATE.settings.mananaPrimera;
  if (!m || m.fecha <= todayISO()) return "";
  const hora = ((STATE.settings.notif || {}).enabled && (STATE.settings.notif || {}).manana) || "";
  return `<div class="card deja-listo" style="margin-bottom:20px">${activacionDice(`Mañana${hora ? " a las " + escapeHtml(hora) : ""} te espero para abrir tu primer día${m.mision ? `, con <b>«${escapeHtml(m.mision)}»</b> como lo más importante` : ""}. Hoy, a descansar.`)}</div>`;
}

/* -------- Ofrecer los avisos en el momento justo -------- */
/* "permiso" (se puede pedir) | "instalar" (iPhone sin instalar) | null (ya están, están bloqueados o no hay soporte) */
function avisosOfertaTipo() {
  if (typeof soportePush !== "function") return null;
  const sop = soportePush();
  if (sop === "ios_instalar") return "instalar";
  if (sop !== "si") return null;
  return notifPerm() === "default" ? "permiso" : null;
}
function avisosOfertaMarcar(momento) {
  const o = STATE.settings.avisosOferta = STATE.settings.avisosOferta || {};
  o[momento] = Date.now();
}
/* ¿Toca ofrecerlos ahora? momento: "abrir" (primer día abierto) | "cierre" (primer cierre) | "cierre3" (tercer cierre) */
function avisosOfertaPuede(momento) {
  const tipo = avisosOfertaTipo(); if (!tipo) return false;
  const o = STATE.settings.avisosOferta || {};
  if (o[momento]) return false;
  if (tipo === "instalar" && momento === "cierre3") return false;   // en iPhone, los pasos se muestran dos veces como mucho
  return true;
}
function avisosOfertaHtml(momento) {
  const tipo = avisosOfertaTipo(), n = STATE.settings.notif || {};
  if (tipo === "instalar") return `
    ${activacionDice("Para que te avise en la mañana y en la noche, Rumbo tiene que estar en tu pantalla de inicio. Son 3 pasos:")}
    <ol class="notif-pasos"><li>En Safari, toca <b>Compartir</b> (el cuadrado con la flecha)</li><li>Elige <b>Agregar a inicio</b></li><li>Abre Rumbo desde ese ícono y entra con tu mismo correo</li></ol>
    <div class="modal__cta"><button class="btn btn--primary btn-block" data-action="avisos-oferta-no" data-m="${momento}">Entendido</button></div>`;
  const noche = momento === "abrir";
  const campo = noche ? "noche" : "manana", hora = n[campo] || (noche ? "21:00" : "08:00");
  const txt = noche ? "¿Te aviso esta noche para cerrarlo? Son 2 minutos y tu racha empieza." : momento === "cierre" ? "¿Te aviso mañana para abrir tu día? Es lo que más ayuda a volver." : "Llevas 3 días cerrados. ¿Te aviso en la mañana para no cortar la racha?";
  return `
    ${activacionDice(txt)}
    <label class="field mt-16 avisos-oferta__hora"><span>${noche ? "🌙 Esta noche, a las" : "🌅 En la mañana, a las"}</span>
      <input class="input" type="time" id="ao-hora" data-campo="${campo}" value="${escapeAttr(hora)}"></label>
    <p class="text-xs muted">No llega si ya lo hiciste. Lo cambias cuando quieras en Notificaciones.</p>
    <div class="modal__cta row" style="gap:8px">
      <button class="btn btn--soft" style="flex:1" data-action="avisos-oferta-no" data-m="${momento}">Ahora no</button>
      <button class="btn btn--primary" style="flex:1" data-action="avisos-oferta-si" data-m="${momento}">Sí, avísame</button></div>`;
}
function openAvisosOferta(momento) {
  if (!avisosOfertaPuede(momento)) return false;
  avisosOfertaMarcar(momento); saveState();
  openModal(avisosOfertaTipo() === "instalar" ? "📲 Instala Rumbo" : "🔔 ¿Te aviso?", avisosOfertaHtml(momento));
  return true;
}
function avisosOfertaSi() {
  const h = document.getElementById("ao-hora");
  if (h && h.value) { const n = STATE.settings.notif = STATE.settings.notif || { subs: [] }; n[h.dataset.campo] = h.value; saveState(); }
  if (typeof enableNotifications === "function") enableNotifications(); else closeModal();   // el permiso se pide en el mismo toque
}
function avisosOfertaNo() { closeModal(); }
/* Tras guardar el cierre de un día nuevo: el primero y el tercero ofrecen los avisos. Devuelve true si mostró algo. */
function activacionTrasCierre() {
  const n = Object.values(STATE.ritual.dias || {}).filter(r => r && r.cerrado).length;
  const momento = n === 1 ? "cierre" : n === 3 ? "cierre3" : null;
  if (!momento || !avisosOfertaPuede(momento)) return false;
  // Si el cierre trajo una medalla, su momento va primero: la pregunta espera a que se cierre
  const medalla = () => typeof CERCA !== "undefined" && !!CERCA.id;
  let vueltas = 0;
  const intentar = () => { if (medalla() && vueltas++ < 240) return setTimeout(intentar, 500); openAvisosOferta(momento); };
  setTimeout(intentar, 1400);
  return true;
}
