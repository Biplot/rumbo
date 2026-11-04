/* ============================================================
   RUMBO · 🎁 Invita y gana
   Tu enlace (o tu código) premia a los dos: cuando alguien nuevo entra con él, se hacen amigos y
   cierra su primer día, +100 ⭐ para cada uno. Al tercer amigo, tu elefante gana el pañuelo de la
   manada, que solo se consigue invitando. Las ⭐ de quien invita llegan hasta por 10 amigos.
   · El servidor (supabase/invitaciones.sql) anota quién llegó con quién: solo cuentas nuevas (de 14
     días o menos) que te mandan su solicitud. La app de quien llegó la activa cuando ya son amigos y
     ya cerró un día (lo revisa al cargar y después de cada cambio, con invitaRevisar).
   · Las ⭐ quedan en el ledger, así no se pagan dos veces ni entre dispositivos:
     "invita:<id del amigo>" (+100), "invitado:<id de quien te invitó>" (+100) y el pañuelo,
     "hito:invita:panuelo" (lo lee la prenda «panuelo» de elefante.js).
   · En Amigos: dentro de «Invita a un amigo» (sin amigos todavía y en el engranaje) y en la
     baldosa «Invita» de Juntos, que abre su hoja.
   ============================================================ */
const INVITA_PREMIO = 100, INVITA_PANUELO = 3, INVITA_TOPE = 10;
const INVITA = { datos: null, t: 0, cargando: false, otraVez: false, error: null, revT: null, intento: 0 };

/* ---------- La lógica (sin pantalla, se prueba en tests/invita.test.mjs) ---------- */
function invitaDiaCerrado(S) { return Object.values(((S || STATE).ritual || {}).dias || {}).some(d => d && d.cerrado); }
function invitaActivas(d) { return ((d && d.invitados) || []).filter(x => x && x.activa); }
function invitaTienePanuelo(S) { return ledgerVigente(S || STATE, "hito:invita:panuelo"); }
function invitaPrimerNombre(n) { return String(n || "").trim().split(/\s+/)[0] || "tu amigo"; }
/* Lo que se gana con lo que dice el servidor, sin repetir lo que ya está en el ledger */
function invitaPremios(S, d) {
  const L = (S.gamif && S.gamif.ledger) || [], r = [];
  let pagados = L.filter(m => m && !m.anulado && typeof m.id === "string" && m.id.startsWith("invita:")).length;
  invitaActivas(d).forEach(x => {
    if (pagados >= INVITA_TOPE || ledgerVigente(S, "invita:" + x.id)) return;
    pagados++; r.push({ id: "invita:" + x.id, delta: INVITA_PREMIO, nombre: x.nombre, motivo: "Invitaste a " + invitaPrimerNombre(x.nombre) });
  });
  const yo = d && d.invito;
  if (yo && yo.activa && yo.id && !ledgerVigente(S, "invitado:" + yo.id)) r.push({ id: "invitado:" + yo.id, delta: INVITA_PREMIO, nombre: yo.nombre, llegue: true, motivo: "Llegaste con " + invitaPrimerNombre(yo.nombre) });
  if (invitaActivas(d).length >= INVITA_PANUELO && !invitaTienePanuelo(S)) r.push({ id: "hito:invita:panuelo", delta: 0, panuelo: true, motivo: "El pañuelo de la manada" });
  return r;
}

/* ---------- Con el servidor ---------- */
async function invitaCargar(forzar) {
  if (typeof CURRENT_USER === "undefined" || !CURRENT_USER || !BACKEND.invitaciones || INVITA.error === "sin-servidor") return;
  if (INVITA.cargando) { if (forzar) INVITA.otraVez = true; return; }   // ya va una: al terminar, otra vez
  if (!forzar && INVITA.datos && Date.now() - INVITA.t < 60000) return;   // a lo más una vez por minuto
  INVITA.cargando = true;
  let d = await BACKEND.invitaciones();
  if (d && !d.error && d.invito && !d.invito.activa && invitaDiaCerrado(STATE)) {   // llegaste invitado y ya cerraste un día
    INVITA.intento = Date.now();
    const a = await BACKEND.invitacionActivar();
    if (a && a.r === "activa") { BACKEND.amigosAvisar("invita", {}); d = await BACKEND.invitaciones(); }
  }
  INVITA.cargando = false; INVITA.t = Date.now();
  if (INVITA.otraVez) { INVITA.otraVez = false; setTimeout(() => invitaCargar(true), 0); }
  if (!d || d.error) { INVITA.error = (d && d.error) || "error"; return; }
  INVITA.error = null; INVITA.datos = d;
  invitaPremiar();
  if (typeof CURRENT !== "undefined" && CURRENT === "amigos") { rerender(); if (typeof atRefrescarHoja === "function") atRefrescarHoja(); }
}
/* Después de cada cambio (saveState): si llegaste invitado y acabas de cerrar tu primer día, se activa */
function invitaRevisar() {
  const yo = INVITA.datos && INVITA.datos.invito;
  if (!yo || yo.activa || INVITA.cargando || Date.now() - INVITA.intento < 30000 || !invitaDiaCerrado(STATE)) return;   // a lo más cada 30 s (si todavía no son amigos)
  clearTimeout(INVITA.revT); INVITA.revT = setTimeout(() => invitaCargar(true), 1200);
}
/* Al mandar una solicitud: si tu cuenta es nueva, quedas como invitado de esa persona (lo decide el servidor) */
async function invitaRegistrar(otro) {
  if (!otro || !BACKEND.invitacionRegistrar || INVITA.error === "sin-servidor" || (INVITA.datos && INVITA.datos.invito)) return false;
  const r = await BACKEND.invitacionRegistrar(otro);
  if (r && r.error === "sin-servidor") INVITA.error = "sin-servidor";
  if (!r || r.r !== "registrada") return false;
  INVITA.t = 0; invitaCargar(true);
  return true;
}
function invitaOlvidar() { clearTimeout(INVITA.revT); Object.assign(INVITA, { datos: null, t: 0, cargando: false, otraVez: false, error: null, revT: null, intento: 0 }); }

/* Paga lo que corresponda y lo celebra */
function invitaPremiar() {
  const ps = invitaPremios(STATE, INVITA.datos); if (!ps.length) return;
  ps.forEach(p => registrarMovimiento(p.id, p.delta, p.delta, p.motivo, true));
  const total = ps.reduce((a, p) => a + p.delta, 0), quien = ps.filter(p => p.delta && !p.llegue).map(p => invitaPrimerNombre(p.nombre)), llegue = ps.find(p => p.llegue);
  if (total && typeof refreshPts === "function") refreshPts(total);
  if (ps.some(p => p.panuelo)) return setTimeout(openInvitaPanuelo, 400);
  if (llegue) return toast(`🎁 +${INVITA_PREMIO} ⭐: llegaste con ${invitaPrimerNombre(llegue.nombre)} y cerraste tu primer día. ${invitaPrimerNombre(llegue.nombre)} también gana.`);
  if (quien.length) toast(`🎁 +${total} ⭐: ${quien.length === 1 ? quien[0] + " cerró su primer día en Rumbo" : quien.join(", ") + " cerraron su primer día"}`);
}

/* ---------- La pantalla ---------- */
function invitaDisponible() { return !!INVITA.datos && !INVITA.error; }
function invitaPanuelo() { const p = typeof prendaElefante === "function" && prendaElefante("panuelo"); return p ? prendaMini(p) : ""; }
function invitaFila(x) {
  const e = escapeHtml, nom = e(x.nombre || "Sin nombre");
  const est = x.activa ? `<span class="inv__ok">${icoUI("check")} Cerró su primer día · +${INVITA_PREMIO} ⭐</span>`
    : !x.amigos ? `<span class="text-xs muted">Te mandó su solicitud: acéptala para que cuente</span>`
    : `<span class="text-xs muted">Falta que cierre su primer día</span>`;
  return `<div class="inv__f">${amigosAvatar(x, 30)}<span class="inv__fn"><b>${nom}</b>${est}</span>${!x.activa && !x.amigos ? `<button class="btn btn--soft" data-action="am-aceptar" data-id="${e(x.id)}">Aceptar</button>` : ""}</div>`;
}
/* El bloque «Invita y gana» (dentro de «Invita a un amigo» y en su hoja) */
function invitaHtml() {
  if (!invitaDisponible()) return "";
  const d = INVITA.datos, act = invitaActivas(d), n = act.length, tiene = invitaTienePanuelo(STATE), yo = d.invito;
  const puesto = typeof ropaPuesta === "function" && ropaPuesta().cuello === "panuelo";
  const meta = tiene
    ? `<div class="inv__meta inv__meta--ok"><span>${icoUI("check")} Tu elefante ya tiene <b>el pañuelo de la manada</b>.</span>${puesto ? "" : `<button class="btn btn--soft" data-action="inv-poner">Ponérselo</button>`}</div>`
    : `<div class="inv__meta"><span>Al tercero, <b>el pañuelo de la manada</b> para tu elefante: solo se gana invitando.</span>
        <div class="inv__barra" role="img" aria-label="${n} de ${INVITA_PANUELO} amigos"><div class="bar"><div class="bar__fill" style="width:${Math.round(Math.min(n, INVITA_PANUELO) / INVITA_PANUELO * 100)}%"></div></div><b>${n} de ${INVITA_PANUELO}</b></div></div>`;
  const llegue = !yo ? "" : `<p class="inv__llegue text-sm">${yo.activa ? `${icoUI("check")} Llegaste con <b>${escapeHtml(yo.nombre || "un amigo")}</b>: +${INVITA_PREMIO} ⭐ para cada uno.`
    : `Llegaste con <b>${escapeHtml(yo.nombre || "un amigo")}</b>: cuando sean amigos y cierres tu primer día, ganan +${INVITA_PREMIO} ⭐ cada uno.`}</p>`;
  return `<div class="inv">
    <div class="inv__cab"><span class="inv__pan" aria-hidden="true">${invitaPanuelo()}</span>
      <span><b>Invita y gana</b><span class="text-sm muted">Por cada amigo nuevo que entre con tu enlace y cierre su primer día: +${INVITA_PREMIO} ⭐ para ti y +${INVITA_PREMIO} ⭐ para él.</span></span></div>
    ${meta}
    ${d.invitados.length ? `<div class="inv__lista">${d.invitados.map(invitaFila).join("")}</div>` : ""}
    ${n >= INVITA_TOPE ? `<p class="text-xs muted" style="margin:0">Ya ganaste las ⭐ de ${INVITA_TOPE} amigos. Puedes seguir invitando: a ellos les siguen llegando sus ⭐.</p>` : ""}
    ${llegue}
  </div>`;
}
/* La baldosa de «Juntos» */
function invitaBaldosa() {
  if (!invitaDisponible() || typeof atBaldosa !== "function") return "";
  const n = invitaActivas(INVITA.datos).length, tiene = invitaTienePanuelo(STATE);
  return atBaldosa("invita", icoUI("gift"), "Invita", tiene ? n : `${Math.min(n, INVITA_PANUELO)}/${INVITA_PANUELO}`, tiene ? `+${INVITA_PREMIO} ⭐ por cada amigo` : `+${INVITA_PREMIO} ⭐ y un pañuelo`);
}
/* El momento de ganar el pañuelo */
function openInvitaPanuelo() {
  const ele = typeof elefanteSVG === "function" ? elefanteSVG({ anim: false, ropa: Object.assign({}, ropaPuesta(), { cuello: "panuelo" }) }) : "";
  openModal("🎉 El pañuelo de la manada", `<div class="inv-gana">
    <div class="inv-gana__ele">${ele}</div>
    <p>Tres amigos entraron con tu invitación y cerraron su primer día. Tu elefante ganó <b>el pañuelo de la manada</b>, que solo se consigue invitando.</p>
    <div class="row-wrap" style="gap:8px;justify-content:center"><button class="btn btn--primary" data-action="inv-poner">Ponérselo</button><button class="btn-ghost" data-action="close-modal">Después</button></div></div>`);
}
function invitaPoner() {
  if (!invitaTienePanuelo(STATE)) return;
  eleTocar().ropa.cuello = "panuelo"; saveState(); closeModal(); rerender();
  toast("🧣 Tu elefante lleva el pañuelo de la manada");
}

/* ---------- Acciones (data-action="inv-…", ver onClick en app.js) ---------- */
function invitaAccion(a) {
  if (a === "inv-poner") return invitaPoner();
}
