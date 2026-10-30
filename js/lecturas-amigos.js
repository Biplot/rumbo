/* ============================================================
   RUMBO · Leer el mismo libro con amigos (planes, etapa 4)
   Cada uno tiene el libro en sus Lecturas (STATE.lecturas, con juntos: <id>) y avanza a su
   ritmo; lo compartido es solo en qué página va cada uno (supabase/lecturas.sql). En la
   tarjeta de «Leyendo ahora» se ve el avance de los demás, y te avisamos cuando alguien lo termina.
   ============================================================ */

const LJ = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] };

/* -------- Lo que llega del servidor lo escribieron otras personas: se limpia -------- */
function ljLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  const lista = v => (Array.isArray(v) ? v : []), paginas = Math.max(1, Math.min(10000, parseInt(x.paginas, 10) || 1));
  return {
    id: String(x.id || "").replace(/[^\w-]/g, "").slice(0, 64), titulo: String(x.titulo || "").trim().slice(0, 80) || "Libro",
    autor: String(x.autor || "").trim().slice(0, 60), paginas, estado: x.estado === "activo" ? "activo" : "invitado", invita: String(x.invita || ""),
    miembros: lista(x.miembros).slice(0, 8).map(m => ({ id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60),
      avatar: (m && m.avatar) || null, estado: m && m.estado === "activo" ? "activo" : "invitado",
      pagina: Math.max(0, Math.min(paginas, parseInt(m && m.pagina, 10) || 0)), terminado: cjFecha(m && m.terminado) })),
  };
}

/* -------- Lecturas -------- */
function ljYo(l) { return l.miembros.find(m => m.yo) || null; }
function ljPct(l, m) { return m.terminado ? 100 : Math.min(100, Math.round((m.pagina / l.paginas) * 100)); }
function ljDe(id) { return (LJ.lista || []).find(l => l.id === id) || null; }
function ljLibro(id) { return (STATE.lecturas || []).find(b => b.juntos === id) || null; }
function ljQuienInvita(l) { const m = l.miembros.find(x => x.id === l.invita); return (m && m.nombre) || "Un amigo"; }
function ljCon(l) { return cjNombres(l.miembros.filter(m => !m.yo && m.estado === "activo").map(m => m.nombre || "Sin nombre")); }

/* -------- Cargar y mantener al día -------- */
async function lecturasCargar(forzar) {
  if (!CURRENT_USER || !STATE || LJ.cargando || !BACKEND.lecturaLista) return;
  if (!forzar && (LJ.lista || LJ.error) && Date.now() - LJ.t < 60000) return;   // a lo más una vez por minuto
  LJ.cargando = true;
  const r = await BACKEND.lecturaLista();
  LJ.cargando = false; LJ.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { LJ.error = r.error; ljRepintar(); return; }
  LJ.error = null;
  LJ.lista = (Array.isArray(r) ? r : []).map(ljLimpio).filter(l => l.id && ljYo(l));
  const nueva = LJ.lista.find(l => l.estado === "invitado" && !LJ.vistas.includes(l.id));
  LJ.lista.forEach(l => { if (!LJ.vistas.includes(l.id)) LJ.vistas.push(l.id); });
  if (nueva && CURRENT !== "amigos" && CURRENT !== "lecturas") toast(`📖 ${ljQuienInvita(nueva)} te invita a leer «${nueva.titulo}»`);
  ljPonerAlDia();
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  ljRepintar();
}
/* Si avanzaste en este equipo sin conexión (o en otro), se manda tu página */
function ljPonerAlDia() {
  (LJ.lista || []).filter(l => l.estado === "activo").forEach(l => {
    const b = ljLibro(l.id), yo = ljYo(l);
    if (b && yo && (parseInt(b.pagina, 10) || 0) !== yo.pagina && !(yo.terminado && b.estado === "terminado")) ljAvance(b.id, b.estado === "terminado" ? l.paginas : b.pagina, true);
  });
}
function ljRepintar() {
  if (!["amigos", "lecturas"].includes(CURRENT)) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view")) return;
  rerender();
}

/* -------- Leer con un amigo, unirse, avanzar y salir -------- */
async function lecturaJuntosGuardar(libroId) {
  const b = (STATE.lecturas || []).find(x => x.id === libroId); if (!b || LJ.guardando) return;
  const paginas = parseNum(val("lj-paginas")) || parseInt(b.paginas, 10) || 0;
  const amigos = [...document.querySelectorAll("#lj-amigos input:checked")].map(i => i.value);
  if (!(paginas > 0)) return toast("¿Cuántas páginas tiene? Así se ve en qué va cada uno", true);
  if (!amigos.length) return toast("Elige al menos un amigo", true);
  LJ.guardando = true;
  const r = await BACKEND.lecturaCrear(b.titulo, b.autor || "", paginas, amigos).finally(() => { LJ.guardando = false; });
  if (r && r.error) return toast(ljTextoError(r.error), true);
  b.juntos = r.id; b.paginas = paginas; if (b.estado === "por-leer") { b.estado = "leyendo"; b.inicio = b.inicio || todayISO(); }
  saveState();
  BACKEND.amigosAvisar("lectura-invita", { lectura: r.id });
  closeModal();
  toast(`📖 Invitaste a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))} a leer «${b.titulo}» contigo`);
  await lecturasCargar(true);
  if (+b.pagina > 0) ljAvance(b.id, b.pagina, true);
}
async function lecturaJuntosResponder(id, acepta) {
  const l = ljDe(id);
  const r = await BACKEND.lecturaResponder(id, acepta);
  if (r && r.error) return toast(ljTextoError(r.error), true);
  if (acepta && r.r === "unido" && l) {
    // El libro va a tus Lecturas (o se une al que ya tenías con ese título)
    let b = ljLibro(id) || (STATE.lecturas || []).find(x => !x.juntos && String(x.titulo || "").trim().toLowerCase() === l.titulo.toLowerCase());
    if (!b) { b = { id: uid(), titulo: l.titulo, autor: l.autor, estado: "leyendo", valoracion: 0, pagina: 0, paginas: l.paginas, nota: "", color: LECT_COLORS[0], portada: "", inicio: todayISO(), fin: "" }; STATE.lecturas.push(b); }
    Object.assign(b, { juntos: id, paginas: b.paginas || l.paginas, estado: b.estado === "terminado" ? b.estado : "leyendo", inicio: b.inicio || todayISO() });
    saveState();
    toast(`📖 Te sumaste a leer «${l.titulo}». Está en tus Lecturas.`);
    BACKEND.amigosAvisar("lectura-acepta", { lectura: id });
  }
  closeModal();
  await lecturasCargar(true);
}
async function lecturaJuntosSalir(id) {
  const l = ljDe(id);
  if (!confirm(`¿Dejar de leer «${l ? l.titulo : "este libro"}» con tus amigos? El libro sigue en tus Lecturas.`)) return;
  const r = await BACKEND.lecturaSalir(id);
  if (r && r.error) return toast(ljTextoError(r.error), true);
  const b = ljLibro(id); if (b) { delete b.juntos; saveState(); }
  closeModal(); toast("Ya no lo lees con ellos");
  await lecturasCargar(true);
}
/* En qué página vas (desde «Leyendo ahora» o al guardar el libro). Al terminarlo, les avisamos */
async function ljAvance(libroId, valor, callado) {
  const b = (STATE.lecturas || []).find(x => x.id === libroId); if (!b || !b.juntos || !BACKEND.lecturaAvance) return;
  const pagina = Math.max(0, parseInt(valor, 10) || 0);
  const r = await BACKEND.lecturaAvance(b.juntos, pagina, todayISO());
  if (r && r.error) { if (!callado) toast(ljTextoError(r.error), true); return; }
  if (r.recien) { BACKEND.amigosAvisar("lectura-termina", { lectura: b.juntos }); if (!callado) toast(`📖 ¡Terminaste «${b.titulo}»! Les avisamos a los que lo leen contigo.`); }
  const l = ljDe(b.juntos), yo = l && ljYo(l);
  if (yo) { yo.pagina = r.pagina; yo.terminado = r.terminado ? yo.terminado || todayISO() : ""; }
}
function ljTextoError(e) {
  return {
    "sin-servidor": "Leer con amigos todavía no está activo en el servidor.",
    amigos: "Elige al menos un amigo (hasta 7).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no lo lees con ellos.",
    limite: "Llegaste al máximo: 20 lecturas con amigos.",
    titulo: "El título puede tener hasta 80 letras.",
    autor: "El autor puede tener hasta 60 letras.",
    paginas: "Escribe cuántas páginas tiene (de 1 a 10.000).",
    pagina: "Revisa la página.",
  }[e] || amigosTextoError(e);
}

/* -------- Acciones (data-action="lj-…", ver onClick en app.js) -------- */
function lecturasAmigosAccion(a, d) {
  if (a === "lj-nueva") return openLecturaJuntos(d.libro);
  if (a === "lj-guardar") return lecturaJuntosGuardar(d.libro);
  if (a === "lj-unirme") return lecturaJuntosResponder(d.id, true);
  if (a === "lj-rechazar") return lecturaJuntosResponder(d.id, false);
  if (a === "lj-salir") return lecturaJuntosSalir(d.id);
  if (a === "lj-ir") { closeModal(); return go("lecturas"); }
}

/* -------- Dibujo -------- */
/* «Leyendo ahora»: en qué va cada uno de los que lo leen contigo */
function ljAvanceHtml(b) {
  const l = b && b.juntos ? ljDe(b.juntos) : null; if (!l) return "";
  const otros = l.miembros.filter(m => !m.yo);
  return `<div class="lj-otros">${otros.map(m => `<div class="lj-otro${m.estado === "invitado" ? " is-inv" : ""}">${amigosAvatar(m, 22)}
      <span class="lj-otro__t"><b>${escapeHtml(m.nombre || "Sin nombre")}</b><span>${m.estado === "invitado" ? "invitado" : m.terminado ? "¡Lo terminó!" : `pág. ${m.pagina} · ${ljPct(l, m)} %`}</span></span>
      <span class="lj-otro__bar"><i style="width:${m.estado === "invitado" ? 0 : ljPct(l, m)}%"></i></span></div>`).join("")}</div>`;
}
/* Invitaciones a leer (en Lecturas y en Amigos) */
function ljInvitacionesHtml() {
  const inv = (LJ.lista || []).filter(l => l.estado === "invitado");
  if (!inv.length) return "";
  return `<div class="card oj-invs"><div class="card__title">${icoUI("book-open")} Te invitan a leer</div>
    ${inv.map(l => `<div class="am-sol cj-inv"><span class="cj-fila__ico">${icoUI("book-open")}</span><span class="am-sol__t"><b>${escapeHtml(l.titulo)}</b>
      <span class="text-xs muted">${escapeHtml(ljQuienInvita(l))} te invita${l.autor ? " · " + escapeHtml(l.autor) : ""} · ${l.paginas} páginas</span></span>
      <span class="am-sol__b"><button class="btn-ghost" data-action="lj-rechazar" data-id="${escapeHtml(l.id)}">Ahora no</button><button class="btn btn--primary" data-action="lj-unirme" data-id="${escapeHtml(l.id)}">Leerlo</button></span></div>`).join("")}</div>`;
}
/* Lecturas: lo de arriba (invitaciones), si ya usas Amigos */
function ljLecturasHtml() {
  if (!STATE || !amigosCfg().activo) return "";
  lecturasCargar(false);
  return LJ.error === "sin-servidor" ? "" : ljInvitacionesHtml();
}
/* En el libro (editar): leerlo con un amigo, o con quiénes lo lees */
function ljLibroHtml(b) {
  if (!b || !STATE || !amigosCfg().activo || LJ.error === "sin-servidor") return "";
  const l = b.juntos ? ljDe(b.juntos) : null;
  if (l) return `<div class="lj-libro">${icoUI("handshake")}<span>Lo lees con ${escapeHtml(ljCon(l) || "tus amigos")}</span>
    <button type="button" class="btn-link" data-action="lj-salir" data-id="${escapeHtml(l.id)}">Dejar de leerlo juntos</button></div>`;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  return amigos.length ? `<button type="button" class="btn btn--soft lj-libro__b" data-action="lj-nueva" data-libro="${escapeHtml(b.id)}">${icoUI("handshake")} Leerlo con un amigo</button>` : "";
}
/* El perfil de un amigo: los libros que leen juntos (para «Lo que hacen juntos») */
function ljJuntos(amigoId) {
  return (LJ.lista || []).filter(l => l.estado === "activo" && l.miembros.some(m => m.id === amigoId && m.estado === "activo"))
    .map(l => { const m = l.miembros.find(x => x.id === amigoId);
      return `<button type="button" class="cj-junto" data-action="lj-ir">${icoUI("book-open")}<b>${escapeHtml(l.titulo)}</b><span class="text-xs muted">${m.terminado ? "lo terminó" : "va en la pág. " + m.pagina}</span></button>`; });
}
/* El formulario: con quién lo lees (y cuántas páginas tiene, si no lo habías puesto) */
function openLecturaJuntos(libroId) {
  const b = (STATE.lecturas || []).find(x => x.id === libroId); if (!b) return;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  openModal(`📖 Leer «${b.titulo}» con amigos`, `<div class="pl-form">
    ${+b.paginas > 0 ? "" : `<div class="field"><label for="lj-paginas">Cuántas páginas tiene</label><input class="input" id="lj-paginas" inputmode="numeric" placeholder="Ej: 296"></div>`}
    <div class="field cj-modal"><label>Con quién</label>
      <div class="cj-amigos" id="lj-amigos">${amigos.map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}">${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div></div>
    <p class="text-xs muted">Cada uno lo lee a su ritmo, en sus Lecturas. Solo se comparte en qué página va cada uno, y les avisamos cuando alguien lo termina.</p>
    <button class="btn btn--primary btn-block" data-action="lj-guardar" data-libro="${escapeHtml(b.id)}">Invitar</button></div>`);
}
