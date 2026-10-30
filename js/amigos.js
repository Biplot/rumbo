/* ============================================================
   RUMBO · Amigos (etapa 1)
   Invitar con un enlace o un código, aceptar solicitudes, ver cómo va el día
   de tus amigos, mandar ánimo y elegir qué muestras de ti.
   Lo tuyo sigue en tu documento privado; lo que ven tus amigos vive en tablas
   aparte (supabase/amigos.sql) y la app publica ahí solo lo que elegiste
   mostrar (amigosPublicar). Compañía, no competencia: no hay rankings.

   Los hábitos en conjunto (etapa 2) están en conjunto.js; los objetivos en conjunto (etapa 3), en objetivos.js.

   Datos propios: settings.amigos = { activo, muestra: { dia, racha, rango } }
   Invitación: rumbo.biplot.cl/?amigo=CODIGO (se guarda hasta que entras).
   ============================================================ */

const AMIGOS_MUESTRA_BASE = { dia: true, racha: true, rango: true };
const AMIGOS_FRASES = ["¡Vamos, tú puedes!", "¡Bien hecho!", "Hoy se puede", "Estoy contigo", "Un bocado a la vez"];
/* Lo que se tiene en memoria: la lista del servidor y cómo va la carga */
const AMIGOS = { lista: null, t: 0, cargando: false, error: null, codigo: "", animosVistos: [], pubFirma: "", pubT: null, msg: "" };

function amigosCfg(S) {
  S = S || STATE;
  const c = S.settings.amigos = S.settings.amigos || {};
  c.muestra = Object.assign({}, AMIGOS_MUESTRA_BASE, c.muestra || {});
  return c;
}

/* Lo que ven tus amigos de tu día: solo lo que elegiste mostrar */
function amigosEstadoPublico(datos, muestra) {
  const m = Object.assign({}, AMIGOS_MUESTRA_BASE, muestra || {}), e = { fecha: datos.fecha };
  if (m.dia) { e.abrio = !!datos.abrio; e.cerro = !!datos.cerro; }
  if (m.racha) e.racha = datos.racha || 0;
  if (m.rango) { e.rango = datos.rango || 0; e.rangoNombre = datos.rangoNombre || ""; }
  return e;
}
/* Tu perfil para tus amigos: nombre, avatar, lo que muestras y cómo va tu día */
function amigosPerfilPropio() {
  const cfg = amigosCfg(), hoy = todayISO(), d = (STATE.ritual.dias || {})[hoy] || {}, r = rankFor(STATE.gamif.xp || 0);
  return {
    nombre: (((STATE.profile && STATE.profile.name) || (CURRENT_USER && CURRENT_USER.name) || "").trim()).slice(0, 60),
    avatar: typeof avatarPublico === "function" ? avatarPublico() : null,
    muestra: cfg.muestra,
    estado: amigosEstadoPublico({ fecha: hoy, abrio: !!d.hecho, cerro: !!d.cerrado, racha: computeClosedStreak(), rango: r.idx, rangoNombre: r.cur.nombre }, cfg.muestra),
  };
}
/* Publica tu perfil cuando cambia (después de guardar); solo si ya usas Amigos */
function amigosPublicar(ya) {
  if (!CURRENT_USER || !STATE || !amigosCfg().activo || !BACKEND.amigosPerfil || AMIGOS.error === "sin-servidor") return;
  clearTimeout(AMIGOS.pubT);
  AMIGOS.pubT = setTimeout(async () => {
    const p = amigosPerfilPropio(), firma = JSON.stringify(p);
    if (!ya && firma === AMIGOS.pubFirma) return;
    const r = await BACKEND.amigosPerfil(p);
    if (r && !r.error) { AMIGOS.pubFirma = firma; if (r.codigo) AMIGOS.codigo = r.codigo; }
  }, ya ? 0 : 1500);
}

/* Trae la lista (amigos, solicitudes, ánimos). La primera vez activa Amigos y crea tu perfil. */
async function amigosCargar(forzar) {
  if (!CURRENT_USER || AMIGOS.cargando) return;
  if (!forzar && (AMIGOS.lista || AMIGOS.error) && Date.now() - AMIGOS.t < 60000) return;   // a lo más una vez por minuto (también si falló)
  AMIGOS.cargando = true;
  const cfg = amigosCfg(), p = amigosPerfilPropio(), r = await BACKEND.amigosPerfil(p);
  if (r && !r.error && !cfg.activo) { cfg.activo = true; saveState(); }   // Amigos queda activo cuando ya tienes perfil
  const l = r && r.error ? r : await BACKEND.amigosLista();
  AMIGOS.cargando = false; AMIGOS.t = Date.now();
  if (l && l.error) AMIGOS.error = l.error;
  else { AMIGOS.error = null; AMIGOS.lista = l; AMIGOS.pubFirma = JSON.stringify(p); AMIGOS.codigo = l.codigo || (r && r.codigo) || AMIGOS.codigo; }
  amigosMarcarNav();
  if (CURRENT === "amigos") rerender();
  if (!AMIGOS.error) { conjuntoCargar(forzar); objetivosCargar(forzar); }   // y lo que hacen juntos (conjunto.js, objetivos.js)
}
/* Al salir de la cuenta: se olvida lo cargado (amigos y hábitos en conjunto) */
function amigosOlvidar() {
  clearTimeout(AMIGOS.pubT);
  Object.assign(AMIGOS, { lista: null, t: 0, cargando: false, error: null, codigo: "", animosVistos: [], pubFirma: "", pubT: null, msg: "" });
  Object.assign(CONJ, { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] });
  Object.assign(OBJ, { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] });
}
/* Cuántas cosas nuevas hay: solicitudes recibidas, ánimos sin ver e invitaciones a hábitos y objetivos */
function amigosNuevos() {
  const l = AMIGOS.lista; if (!l) return 0;
  return (l.recibidas || []).length + (l.animos || []).filter(a => !AMIGOS.animosVistos.includes(a.id)).length
    + (CONJ.lista || []).filter(c => c.estado === "invitado").length + (OBJ.lista || []).filter(o => o.estado === "invitado").length;
}
function amigosMarcarNav() {
  const n = amigosNuevos();
  document.querySelectorAll('[data-route="amigos"]').forEach(el => el.classList.toggle("tiene-nuevo", n > 0));
}

/* -------- Al entrar a la app: la invitación pendiente y lo nuevo -------- */
function amigosGuardarInvitacion() {
  const c = new URLSearchParams(location.search).get("amigo");
  if (!c) return;
  try { localStorage.setItem("rumbo_invitacion", c.trim().toUpperCase().slice(0, 12)); } catch (e) {}
  const q = new URLSearchParams(location.search); q.delete("amigo");
  history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
}
if (typeof location !== "undefined") amigosGuardarInvitacion();
function amigosHayInvitacion() { try { return !!localStorage.getItem("rumbo_invitacion"); } catch (e) { return false; } }
/* Al entrar (y al terminar la bienvenida): primero la invitación que traías; si no, lo nuevo de tus amigos */
async function amigosAlEntrar() {
  let inv = null; try { inv = localStorage.getItem("rumbo_invitacion"); } catch (e) {}
  if (inv) {
    if (!STATE.settings.onboarded) return;   // quien llega nuevo la ve al terminar la bienvenida (saveOnboarding)
    try { localStorage.removeItem("rumbo_invitacion"); } catch (e) {}
    setTimeout(() => amigosAgregar(inv), 500);
    return;
  }
  if (!amigosCfg().activo) return;
  await amigosCargar(true);
  const l = AMIGOS.lista; if (!l) return;
  const a = (l.animos || [])[0], s = (l.recibidas || [])[0];
  if (a) toast(`🎉 ${a.nombre || "Un amigo"} te mandó ánimo${a.mensaje ? ": «" + a.mensaje + "»" : ""}`);
  else if (s) toast(`🤝 ${s.nombre || "Alguien"} quiere sumarte a sus amigos`);
}

/* -------- Agregar a alguien (enlace o código) -------- */
function amigosEnlace() { return location.origin + location.pathname + "?amigo=" + encodeURIComponent(AMIGOS.codigo || ""); }
async function amigosAgregar(codigo) {
  codigo = String(codigo || "").trim().toUpperCase();
  if (!codigo) return toast("Escribe el código de tu amigo", true);
  const yo = await BACKEND.amigosPerfil(amigosPerfilPropio());   // para que te vea con tu nombre
  if (yo && yo.error) return toast(amigosTextoError(yo.error), true);
  const cfg = amigosCfg();
  if (!cfg.activo) { cfg.activo = true; saveState(); }
  AMIGOS.codigo = yo.codigo || AMIGOS.codigo;
  if (codigo === AMIGOS.codigo) return toast("Ese es tu propio código", true);
  const p = await BACKEND.amigosBuscar(codigo);
  if (p && p.error) return toast(amigosTextoError(p.error), true);
  if (!p) return toast("No encontré a nadie con ese código. Revísalo y vuelve a intentarlo.", true);
  openModal("🤝 Agregar a un amigo", `<div class="am-confirma">
      ${amigosAvatar(p, 84)}<b>${escapeHtml(p.nombre || "Sin nombre")}</b>
      <p class="text-sm muted">Le mandas una solicitud. Cuando la acepte, se verán en Amigos y cada uno elige qué le muestra al otro.</p>
      <div class="row-wrap" style="gap:8px;justify-content:center"><button class="btn btn--primary" data-action="am-pedir" data-v="${escapeHtml(codigo)}">Mandar solicitud</button>
      <button class="btn-ghost" data-action="close-modal">Ahora no</button></div></div>`);
}
async function amigosPedir(codigo) {
  const r = await BACKEND.amigosPedir(codigo);
  closeModal();
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  const txt = { pedida: "📤 Solicitud enviada. Te avisamos cuando la acepte.", aceptada: "🤝 ¡Ya son amigos!", ya: "Ya son amigos", "tu-codigo": "Ese es tu propio código", "no-existe": "No encontré a nadie con ese código", limite: "Tienes muchas solicitudes sin respuesta. Espera a que te respondan." };
  toast(txt[r.estado] || "Listo", !["pedida", "aceptada", "ya"].includes(r.estado));
  if (r.estado === "pedida") BACKEND.amigosAvisar("solicitud", { otro: r.otro });
  if (r.estado === "aceptada") BACKEND.amigosAvisar("aceptada", { otro: r.otro });
  await amigosCargar(true);
  if (CURRENT !== "amigos") go("amigos");
}
async function amigosInvitar() {
  if (!AMIGOS.codigo) await amigosCargar(true);
  const url = amigosEnlace(), texto = "Te invito a ser mi amigo en Rumbo: así nos acompañamos con nuestros hábitos y metas.";
  if (navigator.share) {
    try { await navigator.share({ title: "Rumbo", text: texto, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  amigosCopiar(url, "Enlace copiado: mándaselo a tu amigo");
}
async function amigosCopiar(txt, aviso) {
  try { await navigator.clipboard.writeText(txt); toast("📋 " + (aviso || "Copiado")); }
  catch (e) { toast("No se pudo copiar: " + txt, true); }
}

/* -------- Responder, quitar y bloquear -------- */
async function amigosResponder(id, acepta) {
  const r = await BACKEND.amigosResponder(id, acepta);
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  if (acepta && r.r === "aceptada") { toast("🤝 ¡Ya son amigos!"); BACKEND.amigosAvisar("aceptada", { otro: id }); }
  await amigosCargar(true);
}
async function amigosQuitar(id) {
  const a = amigoPorId(id);
  if (!confirm(`¿Quitar a ${a ? a.nombre || "esta persona" : "esta persona"} de tus amigos? Dejarán de ver cómo va su día.`)) return;
  const r = await BACKEND.amigosQuitar(id);
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  closeModal(); toast("Ya no son amigos"); await amigosCargar(true);
}
async function amigosBloquear(id) {
  const a = amigoPorId(id);
  if (!confirm(`¿Bloquear a ${a ? a.nombre || "esta persona" : "esta persona"}? Deja de ser tu amigo y no puede volver a pedirte amistad.`)) return;
  const r = await BACKEND.amigosBloquear(id);
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  closeModal(); toast("Bloqueado"); await amigosCargar(true);
}
async function amigosDesbloquear(id) {
  const r = await BACKEND.amigosQuitar(id);
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  toast("Desbloqueado"); await amigosCargar(true);
}

/* -------- Ánimo -------- */
function openAnimo(id) {
  const a = amigoPorId(id); if (!a) return;
  AMIGOS.msg = AMIGOS_FRASES[0];
  openModal(`🎉 Ánimo para ${a.nombre || "tu amigo"}`, `<div class="am-animo-m">
      <div class="row-wrap" style="gap:6px">${AMIGOS_FRASES.map((f, i) => `<button type="button" class="chip am-frase ${i === 0 ? "chip--cian" : ""}" data-action="am-frase" data-v="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join("")}</div>
      <div class="field mt-16"><label for="am-msg">O escribe el tuyo</label><input class="input" id="am-msg" maxlength="120" placeholder="Máximo 120 letras"></div>
      <button class="btn btn--primary" data-action="am-animo-enviar" data-id="${escapeHtml(id)}">Mandar ánimo</button>
      <p class="text-xs muted mt-8">Le llega como aviso a su celular (nunca de noche). Puedes mandarle hasta 3 al día.</p></div>`);
}
async function amigosAnimoEnviar(id) {
  const propio = ((document.getElementById("am-msg") || {}).value || "").trim();
  const r = await BACKEND.amigosAnimo(id, propio || AMIGOS.msg);
  if (r && r.error) return toast(amigosTextoError(r.error), true);
  closeModal();
  const a = amigoPorId(id);
  toast(`🎉 Le mandaste ánimo a ${a ? a.nombre || "tu amigo" : "tu amigo"}`);
  BACKEND.amigosAvisar("animo", { id: r.id });
}
async function amigosGracias() {
  const l = AMIGOS.lista; if (!l) return;
  (l.animos || []).forEach(a => { if (!AMIGOS.animosVistos.includes(a.id)) AMIGOS.animosVistos.push(a.id); });
  await BACKEND.amigosAnimosVistos();
  l.animos = [];
  amigosMarcarNav(); rerender();
}

/* -------- Lo que muestras -------- */
function amigosMuestra(k, on) {
  const cfg = amigosCfg();
  if (!(k in AMIGOS_MUESTRA_BASE)) return;
  cfg.muestra[k] = !!on;
  saveState(); amigosPublicar(true);
  toast(on ? "Tus amigos lo verán" : "Tus amigos ya no lo verán");
}

/* -------- Acciones (data-action="am-…", ver onClick en app.js) -------- */
function amigosAccion(a, d, el) {
  if (a === "am-invitar") return amigosInvitar();
  if (a === "am-copiar") return amigosCopiar(d.v === "codigo" ? AMIGOS.codigo : amigosEnlace(), d.v === "codigo" ? "Código copiado" : "Enlace copiado: mándaselo a tu amigo");
  if (a === "am-codigo") return amigosAgregar((document.getElementById("am-cod") || {}).value);
  if (a === "am-pedir") return amigosPedir(d.v);
  if (a === "am-aceptar") return amigosResponder(d.id, true);
  if (a === "am-rechazar") return amigosResponder(d.id, false);
  if (a === "am-ver") return openAmigo(d.id);
  if (a === "am-animo") return openAnimo(d.id);
  if (a === "am-frase") { AMIGOS.msg = d.v; document.querySelectorAll(".am-frase").forEach(b => b.classList.toggle("chip--cian", b === el)); const i = document.getElementById("am-msg"); if (i) i.value = ""; return; }
  if (a === "am-animo-enviar") return amigosAnimoEnviar(d.id);
  if (a === "am-gracias") return amigosGracias();
  if (a === "am-quitar") return amigosQuitar(d.id);
  if (a === "am-bloquear") return amigosBloquear(d.id);
  if (a === "am-desbloquear") return amigosDesbloquear(d.id);
  if (a === "am-muestra") return amigosMuestra(d.k, el.checked);
  if (a === "am-actualizar") return amigosCargar(true);
}

/* -------- Dibujo -------- */
function amigoPorId(id) { const l = AMIGOS.lista; return l ? (l.amigos || []).concat(l.recibidas || [], l.enviadas || []).find(a => a.id === id) || null : null; }
function amigosTextoError(e) {
  return {
    "sin-servidor": "Amigos todavía no está activo en el servidor.",
    red: "Sin conexión. Prueba de nuevo cuando vuelva internet.",
    sesion: "Vuelve a iniciar sesión.",
    limite: "Ya le mandaste 3 ánimos hoy. Mañana puedes mandarle más.",
    "no-amigos": "Ya no son amigos.",
  }[e] || "No se pudo. Prueba de nuevo en un rato.";
}
/* El avatar de un amigo (el que eligió, o su inicial) */
function amigosAvatar(p, t) {
  const svg = typeof avatarDeOtro === "function" ? avatarDeOtro(p && p.avatar) : null;
  const ini = ((p && p.nombre) || "?").trim().charAt(0).toUpperCase() || "?";
  return `<span class="am-av" style="width:${t}px;height:${t}px;font-size:${Math.round(t * 0.42)}px">${svg || escapeHtml(ini)}</span>`;
}
/* Lo que publicó tu amigo viene de afuera: solo números, sí/no y textos cortos */
function amigosEstadoLimpio(e) {
  e = e && typeof e === "object" ? e : {};
  const out = { fecha: String(e.fecha || "").slice(0, 10) };
  if ("cerro" in e || "abrio" in e) { out.abrio = !!e.abrio; out.cerro = !!e.cerro; }
  if ("racha" in e) out.racha = Math.max(0, Math.min(9999, parseInt(e.racha, 10) || 0));
  if ("rango" in e) { out.rango = Math.max(0, Math.min(RANGOS.length - 1, parseInt(e.rango, 10) || 0)); out.rangoNombre = RANGOS[out.rango].nombre; }
  return out;
}
/* Cómo va su día, con lo que tu amigo muestra */
function amigosEstadoTxt(e) {
  e = amigosEstadoLimpio(e);
  const hoy = e.fecha === todayISO(), partes = [];
  if ("cerro" in e || "abrio" in e) {
    if (hoy && e.cerro) partes.push(`<span class="am-est is-ok">${icoUI("hecho")} Cerró su día</span>`);
    else if (hoy && e.abrio) partes.push(`<span class="am-est is-va">${icoUI("ritual")} Abrió su día</span>`);
    else partes.push(`<span class="am-est">Todavía no abre su día</span>`);
  }
  if (e.racha) partes.push(`<span class="am-est">${icoUI("llama")} ${e.racha === 1 ? "1 día" : e.racha + " días"} de racha</span>`);
  return partes.join(`<span class="am-sep">·</span>`) || `<span class="am-est">No comparte su día</span>`;
}
function amigoFila(a) {
  return `<div class="am-fila">
    <button type="button" class="am-fila__q" data-action="am-ver" data-id="${escapeHtml(a.id)}">${amigosAvatar(a, 42)}<span class="am-fila__t"><b>${escapeHtml(a.nombre || "Sin nombre")}</b><span>${amigosEstadoTxt(a.estado)}</span></span></button>
    <button type="button" class="am-animo-b" data-action="am-animo" data-id="${escapeHtml(a.id)}" aria-label="Mandar ánimo a ${escapeHtml(a.nombre || "tu amigo")}" title="Mandar ánimo">${icoUI("party-popper")}</button></div>`;
}
function openAmigo(id) {
  const a = amigoPorId(id); if (!a) return;
  const e = amigosEstadoLimpio(a.estado);
  const rango = "rango" in e ? `${escapeHtml(e.rangoNombre)} · rango ${e.rango + 1} de ${RANGOS.length}` : "";
  const f = a.desde ? new Date(a.desde) : null, desde = f && !isNaN(f) ? f.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "";
  openModal(a.nombre || "Tu amigo", `<div class="am-perfil">
      ${amigosAvatar(a, 96)}
      ${rango ? `<span class="text-sm muted">${rango}</span>` : ""}
      <div class="am-perfil__dia">${amigosEstadoTxt(e)}</div>
      <button class="btn btn--primary" data-action="am-animo" data-id="${escapeHtml(a.id)}">${icoUI("party-popper")} Mandar ánimo</button>
      ${cjJuntosHtml(a.id)}
      ${desde ? `<span class="text-xs muted">Amigos desde el ${desde}</span>` : ""}
      <div class="am-perfil__mas"><button class="btn-ghost" data-action="am-quitar" data-id="${escapeHtml(a.id)}">Quitar de amigos</button><button class="btn-ghost" data-action="am-bloquear" data-id="${escapeHtml(a.id)}">Bloquear</button></div>
    </div>`);
}

function renderAmigos() {
  amigosCargar(false);
  const l = AMIGOS.lista, cfg = amigosCfg();
  if (!l && AMIGOS.error) {
    return `<div class="card"><div class="empty">${AMIGOS.error === "sin-servidor"
      ? "Amigos todavía no está activo en el servidor. Apenas esté listo, aquí podrás invitar a tus amigos."
      : escapeHtml(amigosTextoError(AMIGOS.error))}<div class="mt-16"><button class="btn btn--soft" data-action="am-actualizar">Intentar de nuevo</button></div></div></div>`;
  }
  if (!l) return `<div class="card"><div class="empty">Cargando a tus amigos…</div></div>`;
  const animos = l.animos || [], recibidas = l.recibidas || [], enviadas = l.enviadas || [], amigos = l.amigos || [], bloqueados = l.bloqueados || [];
  const invitar = `<div class="card am-invita">
      <div class="am-invita__t"><div class="card__title">${icoUI("user-plus")} Invita a un amigo</div>
        <p class="text-sm muted">Mándale tu enlace por WhatsApp. Cuando entre a Rumbo te llega su solicitud, y cada uno elige qué le muestra al otro.</p></div>
      <div class="am-invita__acc"><button class="btn btn--primary" data-action="am-invitar">${icoUI("compartir")} Invitar</button>
        <button class="btn btn--soft" data-action="am-copiar" data-v="enlace">${icoUI("link")} Copiar enlace</button></div>
      <div class="am-codigos">
        <div><span class="text-xs muted">Tu código</span><button type="button" class="am-cod" data-action="am-copiar" data-v="codigo" title="Copiar tu código">${escapeHtml(AMIGOS.codigo || "······")}</button></div>
        <div class="am-codigos__otro"><label class="text-xs muted" for="am-cod">¿Te pasaron un código?</label>
          <div class="row" style="gap:6px"><input class="input" id="am-cod" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234"><button class="btn btn--soft" data-action="am-codigo">Agregar</button></div></div>
      </div></div>`;
  const animosHtml = animos.length ? `<div class="card am-animos"><div class="flex-between"><div class="card__title">${icoUI("party-popper")} Ánimo para ti</div><button class="btn-ghost" data-action="am-gracias">Gracias</button></div>
      ${animos.map(a => `<div class="am-animo-r">${amigosAvatar(a, 34)}<div><b>${escapeHtml(a.nombre || "Un amigo")}</b><span class="text-sm">${a.mensaje ? "«" + escapeHtml(a.mensaje) + "»" : "Te mandó ánimo"}</span></div></div>`).join("")}</div>` : "";
  const recibidasHtml = recibidas.length ? `<div class="card"><div class="card__title">Quieren ser tus amigos</div>
      ${recibidas.map(a => `<div class="am-sol">${amigosAvatar(a, 38)}<span class="am-sol__t"><b>${escapeHtml(a.nombre || "Sin nombre")}</b><span class="text-xs muted">te mandó una solicitud</span></span>
        <span class="am-sol__b"><button class="btn-ghost" data-action="am-rechazar" data-id="${escapeHtml(a.id)}">Ahora no</button><button class="btn btn--primary" data-action="am-aceptar" data-id="${escapeHtml(a.id)}">Aceptar</button></span></div>`).join("")}</div>` : "";
  const lista = `<div class="card"><div class="flex-between"><div class="card__title">Hoy</div><button class="btn-ghost" data-action="am-actualizar" aria-label="Actualizar" title="Actualizar">${icoUI("refresh-cw")}</button></div>
      ${amigos.length ? amigos.map(amigoFila).join("") : `<div class="empty">Todavía no tienes amigos en Rumbo. Invita a alguien con tu enlace o tu código.</div>`}
      ${enviadas.length ? `<div class="am-env"><span class="text-xs muted">Esperando respuesta</span>${enviadas.map(a => `<span class="chip">${escapeHtml(a.nombre || "Sin nombre")} <button type="button" class="am-x" data-action="am-rechazar" data-id="${escapeHtml(a.id)}" aria-label="Cancelar solicitud">${icoUI("x")}</button></span>`).join("")}</div>` : ""}</div>`;
  const fila = (k, t, s) => `<div class="aviso"><div class="aviso__txt"><span class="aviso__t">${t}</span><span class="text-xs muted">${s}</span></div>
      <label class="sw"><input type="checkbox" role="switch" data-action="am-muestra" data-k="${k}" ${cfg.muestra[k] ? "checked" : ""} aria-label="${t}"><span></span></label></div>`;
  const muestra = `<div class="card"><div class="card__title">${icoUI("eye")} Lo que muestras</div>
      <p class="text-sm muted mt-8">Tus amigos siempre ven tu nombre y tu avatar. Tus tareas, tu diario, tus notas, tus finanzas y tu salud nunca se muestran.</p>
      ${fila("dia", "Si abriste y cerraste tu día", "Solo eso: no ven tus tareas ni tu misión.")}
      ${fila("racha", "Tu racha", "Los días cerrados seguidos.")}
      ${fila("rango", "Tu rango", "Aprendiz, Constante, Enfocado…")}
      ${bloqueados.length ? `<div class="am-env mt-8"><span class="text-xs muted">Bloqueados</span>${bloqueados.map(a => `<span class="chip">${escapeHtml(a.nombre || "Sin nombre")} <button type="button" class="am-x am-x--txt" data-action="am-desbloquear" data-id="${escapeHtml(a.id)}">Desbloquear</button></span>`).join("")}</div>` : ""}</div>`;
  return `<div class="am">${animosHtml}${recibidasHtml}${cjInvitacionesHtml()}${ojInvitacionesHtml()}${invitar}${lista}${cjAmigosHtml(amigos)}${ojAmigosHtml(amigos)}${muestra}</div>`;
}
