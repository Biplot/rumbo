/* ============================================================
   RUMBO · ⏱️ Foco con un amigo (supabase/foco.sql): parten juntos a la misma hora, cada uno en lo
   suyo, y terminan al mismo tiempo. Ves en qué está el otro y si se salió antes. Sin chat.
   · Invitas desde «Enfocarme» → «Con un amigo». La invitación dura 15 minutos.
   · A quien invitan le llega un aviso al celular; al abrir Rumbo ve la invitación y elige en qué se
     enfoca él. Al aceptar, parten los dos con el mismo fin (la hora del servidor).
   · Mientras corre se revisa cada 20 segundos si el otro sigue.
   ============================================================ */
const FS = { sala: null, t: 0, vistas: [], espera: null, poll: null, destino: null, revisando: false };

function focoAmigosLista() { return (typeof AMIGOS !== "undefined" && AMIGOS.lista && AMIGOS.lista.amigos) || []; }
function focoAmigosPuede() { return !!(typeof CURRENT_USER !== "undefined" && CURRENT_USER && BACKEND.focoSalaInvitar && focoAmigosLista().length); }
function focoAmigoNombre(p) { return String((p && p.nombre) || "").trim().split(/\s+/)[0] || "Tu amigo"; }
/* El fin de la sala en la hora de este teléfono (por si su reloj no coincide con el del servidor) */
function focoSalaFinLocal(s) { const fin = Date.parse(s.fin), srv = Date.parse(s.ahora); return isFinite(srv) ? fin - (srv - Date.now()) : fin; }

/* -------- Invitar -------- */
function focoAmigoElegir() {
  const sel = FOCO_UI.sel, hoy = todayISO();
  let d = sel === "libre:" ? null : focoDestinoDe(STATE, sel, hoy);
  if (!d) { const t = ((document.getElementById("fo-libre") || {}).value || "").trim(); d = { tipo: "libre", ref: "", titulo: t || "Tiempo de foco" }; }
  FS.destino = Object.assign({}, d); delete FS.destino.sub; delete FS.destino.min;
  const min = Math.max(5, Math.min(120, FOCO_UI.ritmo === "libre" ? 25 : FOCO_UI.min));
  const amigos = focoAmigosLista();
  openModal("👥 Enfocarse con un amigo", `<p class="text-sm muted" style="margin:0 0 12px">Parten juntos ${min} min, cada uno en lo suyo, y terminan al mismo tiempo. Tu amigo ve en qué estás: <b>${escapeHtml(FS.destino.titulo)}</b>.</p>
    <div class="fo-amigos">${amigos.map(a => `<button type="button" class="fo-amigo" data-action="foco-amigo-invitar" data-id="${escapeAttr(a.id)}" data-min="${min}">${amigosAvatar(a, 36)}<b>${escapeHtml(a.nombre || "Amigo")}</b></button>`).join("")}</div>
    <p class="text-xs muted mt-16">Le llega un aviso al celular. La invitación dura 15 minutos.</p>`);
}
async function focoAmigoInvitar(otro, min, el) {
  if (el) el.disabled = true;
  const r = await BACKEND.focoSalaInvitar(otro, min, FS.destino ? FS.destino.titulo : "");
  if (r && r.error) { if (el) el.disabled = false; return toast(r.error === "ocupado" ? "Tu amigo ya está en una sesión de foco" : r.error === "no-amigos" ? "Solo con tus amigos" : typeof amigosTextoError === "function" ? amigosTextoError(r.error) : "No se pudo invitar", true); }
  BACKEND.amigosAvisar && BACKEND.amigosAvisar("foco-invita", { sala: r.id });
  const a = focoAmigosLista().find(x => x.id === otro);
  FS.espera = { id: r.id, nombre: focoAmigoNombre(a), min, desde: Date.now() };
  focoEsperaHtml();
  focoSalaVigilar(4000);
}
function focoEsperaHtml() {
  const e = FS.espera; if (!e) return;
  openModal("👥 Esperando a " + e.nombre, `<div class="fo-espera"><div class="fo-espera__punto" aria-hidden="true"></div>
    <p>Le avisamos a <b>${escapeHtml(e.nombre)}</b>. Cuando se sume, parten los dos ${e.min} min.</p>
    <p class="text-xs muted">La invitación dura 15 minutos. Puedes dejar esto abierto o seguir usando Rumbo.</p></div>
    <button type="button" class="btn btn--soft btn-block mt-16" data-action="foco-sala-cancelar" data-id="${e.id}">Cancelar la invitación</button>`);
}
/* Revisa la sala cada `ms` mientras haya algo que esperar (la invitación o la sesión juntos) */
function focoSalaVigilar(ms) { clearInterval(FS.poll); FS.poll = setInterval(() => focoSalaRevisar(true), ms); }
function focoSalaDejar() { clearInterval(FS.poll); FS.poll = null; }

/* -------- Lo que pasa con tu sala (al abrir la app, al volver y mientras esperas) -------- */
async function focoSalaRevisar(forzar) {
  if (!focoAmigosPuedeRevisar() || FS.revisando) return;
  if (!forzar && Date.now() - FS.t < 20000) return;
  FS.revisando = true; FS.t = Date.now();
  const s = await BACKEND.focoSalaMia().catch(() => null);
  FS.revisando = false;
  if (s && s.error) { FS.t = Date.now() + 10 * 60000; return; }   // sin supabase/foco.sql todavía: no hay salas (se vuelve a mirar en 10 min)
  FS.sala = s || null;
  const a = focoActiva();
  if (FS.espera) {   // invitaste y esperas
    if (s && s.id === FS.espera.id && s.estado === "activa") {
      const e = FS.espera; FS.espera = null; closeModal();
      toast(`👥 ${e.nombre} se sumó: parten ahora`);
      return focoSalaArrancar(s, FS.destino);
    }
    if (!s || s.id !== FS.espera.id) { const e = FS.espera; FS.espera = null; focoSalaDejar(); if (document.querySelector("#modal [data-action='foco-sala-cancelar']")) closeModal(); return toast(`${e.nombre} no se sumó esta vez`); }
    return;
  }
  if (a && a.sala) {   // la sesión juntos: ¿el otro sigue?
    const box = document.getElementById("fo-sala"); if (box) box.outerHTML = focoSalaHtml(a);
    if (!s || s.id !== a.sala) focoSalaDejar();
    return;
  }
  if (s && s.soy === "invitado" && s.estado === "invitada" && !FS.vistas.includes(s.id) && !a) { FS.vistas.push(s.id); focoInvitacionHtml(s); }
}
function focoAmigosPuedeRevisar() { return !!(typeof CURRENT_USER !== "undefined" && CURRENT_USER && BACKEND.focoSalaMia && typeof AMIGOS !== "undefined" && (AMIGOS.lista || amigosCfg().activo)); }
/* Te invitan: eliges en qué te enfocas tú y te sumas */
function focoInvitacionHtml(s) {
  const grupos = focoDestinos(STATE, todayISO()), items = [].concat(...grupos.map(g => g.items)).slice(0, 6);
  FOCO_UI.sel = items[0] ? focoClave(items[0]) : "libre:";
  const op = i => `<button type="button" class="fo-op" role="radio" data-action="foco-elegir" data-k="${escapeAttr(focoClave(i))}"><span class="fo-op__i">${focoIcono(i)}</span><span class="fo-op__txt"><b>${escapeHtml(i.titulo)}</b>${i.sub ? `<small>${escapeHtml(i.sub)}</small>` : ""}</span></button>`;
  const quien = focoAmigoNombre(s.otro);
  openModal(`👥 ${quien} te invita a enfocarse`, `<div class="fo-inv">${amigosAvatar(s.otro, 44)}<div><b>${s.min} min juntos</b>, cada uno en lo suyo.${s.su_titulo ? `<div class="text-sm muted">${escapeHtml(quien)}: «${escapeHtml(s.su_titulo)}»</div>` : ""}</div></div>
    <p class="text-sm muted mt-16" style="margin-bottom:8px">¿En qué te enfocas tú?</p>
    <div class="fo-lista" role="radiogroup" aria-label="En qué te enfocas">${items.map(op).join("")}
      <button type="button" class="fo-op" role="radio" data-action="foco-elegir" data-k="libre:"><span class="fo-op__i">${icoHab("⏱️", 18)}</span><span class="fo-op__txt"><b>Otra cosa</b></span></button>
      <input class="input mt-8" id="fo-libre" maxlength="80" placeholder="¿En qué te vas a enfocar?" hidden></div>
    <div class="fo-dos mt-16"><button type="button" class="btn btn--primary" data-action="foco-sala-aceptar" data-id="${s.id}">Sumarme</button><button type="button" class="btn btn--soft" data-action="foco-sala-rechazar" data-id="${s.id}">Ahora no</button></div>`);
  focoElegirPintar();
}
async function focoSalaAceptar(id, el) {
  const hoy = todayISO();
  let d = FOCO_UI.sel === "libre:" ? null : focoDestinoDe(STATE, FOCO_UI.sel, hoy);
  if (!d) { const t = ((document.getElementById("fo-libre") || {}).value || "").trim(); d = { tipo: "libre", ref: "", titulo: t || "Tiempo de foco" }; }
  const destino = Object.assign({}, d); delete destino.sub; delete destino.min;
  if (el) el.disabled = true;
  const r = await BACKEND.focoSalaResponder(id, true, destino.titulo);
  if (r && r.error) { if (el) el.disabled = false; return toast("No se pudo sumar", true); }
  if (r.r !== "activa") { closeModal(); return toast("La invitación ya venció"); }
  BACKEND.amigosAvisar && BACKEND.amigosAvisar("foco-acepta", { sala: id });
  const s = await BACKEND.focoSalaMia();
  if (!s || s.error || s.id !== +id) { closeModal(); return toast("No se pudo sumar", true); }
  FS.sala = s;
  focoSalaArrancar(s, destino);
}
function focoSalaArrancar(s, destino) {
  const p = focoPref(STATE);
  focoArrancar(focoNueva(destino || { tipo: "libre", ref: "", titulo: "Tiempo de foco" }, { ritmo: "una", min: s.min, fin: focoSalaFinLocal(s), sala: s.id, con: focoAmigoNombre(s.otro),
    estilo: focoEstiloUsable(p.estilo), sonido: focoSonidoUsable(p.sonido), modo: p.modo }));
  focoSalaVigilar(20000);
}
/* El recuadro del otro en la pantalla de foco */
function focoSalaHtml(a) {
  if (!a || !a.sala) return "";
  const s = FS.sala && FS.sala.id === a.sala ? FS.sala : null, quien = a.con || (s ? focoAmigoNombre(s.otro) : "tu amigo");
  const salio = s && s.salio === "otro";
  return `<div class="foco__sala" id="fo-sala">${s ? amigosAvatar(s.otro, 34) : ""}<div><b>${escapeHtml(quien)}</b> ${salio ? "terminó antes: sigue la tuya" : "también está en foco"}${s && s.su_titulo && !salio ? `<small>«${escapeHtml(s.su_titulo)}»</small>` : ""}</div></div>`;
}
/* Te sales antes: el otro lo ve y sigue con lo suyo */
function focoSalaAlTerminar(a, completa) {
  focoSalaDejar();
  if (a && a.sala && BACKEND.focoSalaSalir && !completa) BACKEND.focoSalaSalir(a.sala);
}

function focoAmigosAccion(a, d, el) {
  if (a === "foco-amigo-elegir") return focoAmigoElegir();
  if (a === "foco-amigo-invitar") return focoAmigoInvitar(d.id, +d.min, el);
  if (a === "foco-sala-cancelar") { FS.espera = null; focoSalaDejar(); closeModal(); BACKEND.focoSalaSalir(+d.id); return toast("Invitación cancelada"); }
  if (a === "foco-sala-aceptar") return focoSalaAceptar(+d.id, el);
  if (a === "foco-sala-rechazar") { closeModal(); BACKEND.focoSalaResponder(+d.id, false, ""); return; }
}
function focoAmigosOlvidar() { focoSalaDejar(); Object.assign(FS, { sala: null, t: 0, vistas: [], espera: null, destino: null, revisando: false }); }
