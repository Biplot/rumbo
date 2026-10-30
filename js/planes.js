/* ============================================================
   RUMBO · Planes con amigos
   Juntarse: ver una película, ir a comer, salir a correr, un viaje. Quien lo propone elige
   qué, cuándo (o que voten entre 2 a 4 fechas), dónde (o a distancia, con un enlace) y a
   quiénes invita; cada uno responde voy, tal vez o no puedo. Todo vive en supabase/planes.sql.
   · Tus amigos ven el plan, no tu agenda. A ti el plan te aparece en Amigos, en tu Semana,
     en tu Calendario y en Inicio el día que toca (si vas o tal vez vas), como un evento.
   · Los avisos al celular los manda api/push.js (notifier/planes.mjs), con el aviso «Amigos».
   ============================================================ */

const PLAN = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] };
const PL_TIPOS = [["pelicula", "Película", "clapperboard"], ["comer", "Comer", "utensils"], ["cafe", "Café", "coffee"],
  ["deporte", "Deporte", "footprints"], ["viaje", "Viaje", "route"], ["otro", "Otro", "sparkles"]];
const PL_RESPUESTAS = { voy: "Voy", quizas: "Tal vez", no: "No puedo", pendiente: "Sin responder" };
const PL_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/* -------- Lo que llega del servidor lo escribieron otras personas: se limpia -------- */
function plHoraLimpia(h) { const s = String(h || "").slice(0, 5); return PL_HORA.test(s) ? s : ""; }
function plEnlaceLimpio(e) { const s = String(e || "").trim().slice(0, 300); return /^https?:\/\/\S+$/i.test(s) ? s : ""; }
function plLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  const lista = v => (Array.isArray(v) ? v : []), resp = r => (r in PL_RESPUESTAS ? r : "pendiente");
  return {
    id: String(x.id || "").slice(0, 64), titulo: String(x.titulo || "").trim().slice(0, 60) || "Plan",
    tipo: PL_TIPOS.some(([k]) => k === x.tipo) ? x.tipo : "otro",
    fecha: cjFecha(x.fecha), hora: plHoraLimpia(x.hora), lugar: String(x.lugar || "").trim().slice(0, 80), enlace: plEnlaceLimpio(x.enlace),
    creador: String(x.creador || ""), cancelado: !!x.cancelado, respuesta: resp(String(x.respuesta || "")), invita: String(x.invita || ""),
    miembros: lista(x.miembros).slice(0, 13).map(m => ({ id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60),
      avatar: (m && m.avatar) || null, respuesta: resp(String((m && m.respuesta) || "")) })),
    opciones: lista(x.opciones).slice(0, 4).map(o => ({ id: parseInt(o && o.id, 10) || 0, fecha: cjFecha(o && o.fecha), hora: plHoraLimpia(o && o.hora),
      votos: lista(o && o.votos).slice(0, 13).map(String) })).filter(o => o.id && o.fecha),
  };
}

/* -------- Lecturas -------- */
function plYo(p) { return p.miembros.find(m => m.yo) || null; }
function plEsMio(p) { const yo = plYo(p); return !!yo && yo.id === p.creador; }
function plIcono(p) { return icoUI((PL_TIPOS.find(([k]) => k === p.tipo) || PL_TIPOS[5])[2]); }
/* ¿Está en tu agenda? Si tiene fecha, no se canceló y vas o tal vez vas */
function plVa(p) { return !!p.fecha && !p.cancelado && (p.respuesta === "voy" || p.respuesta === "quizas"); }
function plDelDia(iso) { return (PLAN.lista || []).filter(p => plVa(p) && p.fecha === iso).sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99")); }
/* "hoy · 21:00", "mañana", "vie 7 nov · 21:00" */
function plFechaTxt(iso, hora) {
  const hoy = todayISO(), d = agDate(iso);
  const dia = iso === hoy ? "hoy" : iso === agSumar(hoy, 1) ? "mañana" : iso === agSumar(hoy, -1) ? "ayer"
    : `${DIAS_CORTO_ES[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()}`;
  return hora ? `${dia} · ${hora}` : dia;
}
function plCuando(p) { return p.fecha ? plFechaTxt(p.fecha, p.hora) : "Por definir: votan la fecha"; }
function plDonde(p) { return p.lugar || (p.enlace ? "a distancia" : ""); }
function plNombre(m) { return m.yo ? "Tú" : m.nombre || "Sin nombre"; }
function plQuienPropone(p) { const m = p.miembros.find(x => x.id === p.creador); return m ? plNombre(m) : "Un amigo"; }
function plVan(p) { return p.miembros.filter(m => m.respuesta === "voy"); }
/* Con quién: los demás que van (o, si nadie respondió, los invitados) */
function plCon(p) {
  const otros = p.miembros.filter(m => !m.yo && m.respuesta !== "no"), van = otros.filter(m => m.respuesta === "voy");
  return cjNombres((van.length ? van : otros).map(plNombre));
}
function plVoto(p) { const yo = plYo(p); return !!yo && p.opciones.some(o => o.votos.includes(yo.id)); }

/* -------- Cargar y mantener al día -------- */
async function planesCargar(forzar) {
  if (!CURRENT_USER || !STATE || PLAN.cargando || !BACKEND.planLista) return;
  if (!forzar && (PLAN.lista || PLAN.error) && Date.now() - PLAN.t < 60000) return;   // a lo más una vez por minuto
  PLAN.cargando = true;
  const r = await BACKEND.planLista(todayISO());
  PLAN.cargando = false; PLAN.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { PLAN.error = r.error; plRepintar(); return; }
  PLAN.error = null;
  PLAN.lista = (Array.isArray(r) ? r : []).map(plLimpio).filter(p => p.id && plYo(p));
  const nueva = PLAN.lista.find(p => p.respuesta === "pendiente" && !p.cancelado && !PLAN.vistas.includes(p.id));
  PLAN.lista.forEach(p => { if (!PLAN.vistas.includes(p.id)) PLAN.vistas.push(p.id); });
  if (nueva && CURRENT !== "amigos") toast(`🎟️ ${plQuienPropone(nueva)} te invita: «${nueva.titulo}»${nueva.fecha ? ", " + plFechaTxt(nueva.fecha, nueva.hora) : ""}`);
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  plRepintar();
}
/* Para Inicio, Semana y Calendario: trae los planes si ya usas Amigos (a lo más una vez por minuto) */
function planesAlDia() { if (STATE && amigosCfg().activo) planesCargar(false); }
function plRepintar() {
  if (!["amigos", "inicio", "semana", "calendario"].includes(CURRENT)) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view")) return;
  rerender();
}

/* -------- El formulario -------- */
function plZona() {
  const n = STATE.settings && STATE.settings.notif;
  try { return (n && n.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Santiago"; } catch (e) { return "America/Santiago"; }
}
function plRadio(nombre) { const r = document.querySelector(`input[name="${nombre}"]:checked`); return r ? r.value : ""; }
/* Lo que dice el formulario: { titulo, tipo, fecha, hora, opciones, lugar, enlace } */
function plLeerForm() {
  const cuando = plRadio("pl-cuando") || "fija", distancia = plRadio("pl-donde") === "distancia";
  return {
    titulo: val("pl-titulo"), tipo: plRadio("pl-tipo") || "otro",
    fecha: cuando === "fija" ? val("pl-fecha") || null : null, hora: cuando === "fija" ? val("pl-hora").slice(0, 5) || null : null,
    opciones: cuando === "votar" ? [...document.querySelectorAll("#pl-ops .pl-op")].map(f => ({ fecha: f.querySelector("[data-k=fecha]").value, hora: f.querySelector("[data-k=hora]").value.slice(0, 5) }))
      .filter(o => o.fecha) : [],
    lugar: distancia ? "" : val("pl-lugar"), enlace: distancia ? val("pl-enlace") : "", tz: plZona(), votar: cuando === "votar",
  };
}
async function planGuardar(id) {
  if (PLAN.guardando) return;
  const p = id ? (PLAN.lista || []).find(x => x.id === id) : null, f = plLeerForm();
  const amigos = [...document.querySelectorAll("#pl-amigos input:checked")].map(i => i.value);
  if (!f.titulo) return toast("¿Qué van a hacer? Ponle un nombre al plan", true);
  if (!p && !f.votar && !f.fecha) return toast("Elige el día (o que voten la fecha)", true);
  if (!p && f.votar && f.opciones.length < 2) return toast("Para votar, propón al menos 2 fechas", true);
  if (f.enlace && !/^https?:\/\//i.test(f.enlace)) f.enlace = "https://" + f.enlace;
  if (!p && !amigos.length) return toast("Elige al menos un amigo", true);
  PLAN.guardando = true;
  try {
    if (p) {
      const r = await BACKEND.planEditar(p.id, f, todayISO());
      if (r && r.error) return toast(plTextoError(r.error), true);
      if (r.cambio) BACKEND.amigosAvisar(!p.fecha && f.fecha ? "plan-fecha" : "plan-cambio", { plan: p.id });
      if (amigos.length) {
        const ri = await BACKEND.planInvitar(p.id, amigos);
        if (ri && ri.error) return toast(plTextoError(ri.error), true);
        BACKEND.amigosAvisar("plan-invita", { plan: p.id });
      }
      closeModal(); toast(r.cambio ? "Plan actualizado: les avisamos del cambio" : "Plan actualizado");
    } else {
      const r = await BACKEND.planCrear(f, amigos, todayISO());
      if (r && r.error) return toast(plTextoError(r.error), true);
      BACKEND.amigosAvisar("plan-invita", { plan: r.id });
      closeModal(); vibrar(10);
      toast(`🎟️ Invitaste a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}. Te avisamos cuando respondan.`);
    }
  } finally { PLAN.guardando = false; }
  await planesCargar(true);
}
async function planResponder(id, respuesta) {
  const r = await BACKEND.planResponder(id, respuesta);
  if (r && r.error) return toast(plTextoError(r.error), true);
  if (r.r === respuesta) {
    BACKEND.amigosAvisar("plan-responde", { plan: id });
    toast({ voy: "🎟️ ¡Vas! Queda en tu Semana y tu Calendario.", quizas: "Le avisamos que tal vez vas", no: "Le avisamos que no puedes" }[respuesta]);
    vibrar(10);
  }
  closeModal();
  await planesCargar(true);
}
async function planVotar(id) {
  const ops = [...document.querySelectorAll("#pl-votos input:checked")].map(i => parseInt(i.value, 10));
  const r = await BACKEND.planVotar(id, ops);
  if (r && r.error) return toast(plTextoError(r.error), true);
  toast(ops.length ? `Marcaste ${ops.length === 1 ? "1 fecha" : ops.length + " fechas"} que te sirven` : "Quitaste tus fechas");
  closeModal();
  await planesCargar(true);
}
async function planFijar(id, opcion) {
  const r = await BACKEND.planFijar(id, opcion);
  if (r && r.error) return toast(plTextoError(r.error), true);
  BACKEND.amigosAvisar("plan-fecha", { plan: id });
  closeModal(); toast("🎟️ Listo: el plan ya tiene fecha. Les avisamos.");
  await planesCargar(true);
}
async function planCancelar(id) {
  const p = (PLAN.lista || []).find(x => x.id === id);
  if (!confirm(`¿Cancelar «${p ? p.titulo : "este plan"}»? Les avisamos a los invitados.`)) return;
  const r = await BACKEND.planCancelar(id);
  if (r && r.error) return toast(plTextoError(r.error), true);
  if (r.r === "cancelado") BACKEND.amigosAvisar("plan-cancela", { plan: id });
  closeModal(); toast("Plan cancelado");
  await planesCargar(true);
}
function plTextoError(e) {
  return {
    "sin-servidor": "Los planes todavía no están activos en el servidor.",
    amigos: "Elige al menos un amigo (hasta 12).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no estás en este plan.",
    "no-creador": "Solo quien propuso el plan lo puede cambiar.",
    limite: "Llegaste al máximo: hasta 13 personas por plan y 20 planes nuevos al día.",
    titulo: "Ponle un nombre de hasta 60 letras.",
    tipo: "Elige qué van a hacer.",
    fecha: "Elige un día de hoy en adelante (hasta un año más).",
    hora: "Revisa la hora.",
    opciones: "Para votar, propón de 2 a 4 fechas.",
    lugar: "El lugar puede tener hasta 80 letras.",
    enlace: "Revisa el enlace: tiene que ser una dirección web.",
    votacion: "Ya no se está votando la fecha.",
    cancelado: "Este plan se canceló.",
  }[e] || amigosTextoError(e);
}

/* -------- Acciones (data-action="pl-…", ver onClick en app.js) -------- */
function planesAccion(a, d) {
  if (a === "pl-nuevo") { closeModal(); return openPlanForm(null, d.amigo ? [d.amigo] : []); }
  if (a === "pl-editar") return openPlanForm(d.id);
  if (a === "pl-guardar") return planGuardar(d.id || null);
  if (a === "pl-ver") return openPlan(d.id);
  if (a === "pl-resp") return planResponder(d.id, d.v);
  if (a === "pl-votar") return planVotar(d.id);
  if (a === "pl-fijar") return planFijar(d.id, parseInt(d.op, 10));
  if (a === "pl-cancelar") return planCancelar(d.id);
  if (a === "pl-op-mas") return plOpMas();
}
/* Al cambiar «una fecha / que voten» y «un lugar / a distancia», se ve lo que corresponde */
function plFormModo() {
  const votar = plRadio("pl-cuando") === "votar", dist = plRadio("pl-donde") === "distancia";
  const ver = (id, si) => { const e = document.getElementById(id); if (e) e.hidden = !si; };
  ver("pl-fija", !votar); ver("pl-votar", votar); ver("pl-lugar-box", !dist); ver("pl-enlace-box", dist);
}
function plOpFila(o) {
  return `<div class="pl-op"><input class="input" type="date" data-k="fecha" min="${todayISO()}" value="${escapeHtml((o && o.fecha) || "")}" aria-label="Fecha">
    <input class="input" type="time" data-k="hora" value="${escapeHtml((o && o.hora) || "")}" aria-label="Hora (opcional)"></div>`;
}
function plOpMas() {
  const c = document.getElementById("pl-ops"); if (!c || c.querySelectorAll(".pl-op").length >= 4) return;
  c.insertAdjacentHTML("beforeend", plOpFila(null));
  if (c.querySelectorAll(".pl-op").length >= 4) { const b = document.querySelector('[data-action="pl-op-mas"]'); if (b) b.hidden = true; }
}

/* -------- Dibujo -------- */
function plCaras(p, t) {
  const van = plVan(p);
  return van.length ? `<span class="pl-caras">${van.slice(0, 4).map(m => amigosAvatar(m, t || 24)).join("")}${van.length > 4 ? `<span class="pl-caras__mas">+${van.length - 4}</span>` : ""}</span>` : "";
}
function plMarca(p) {
  if (p.cancelado) return `<span class="pl-tag pl-tag--no">Cancelado</span>`;
  if (p.respuesta === "pendiente") return `<span class="pl-tag pl-tag--ambar">¿Vas?</span>`;
  if (!p.fecha && !plVoto(p)) return `<span class="pl-tag pl-tag--ambar">Vota</span>`;
  if (p.respuesta === "quizas") return `<span class="pl-tag">Tal vez</span>`;
  if (p.respuesta === "no") return `<span class="pl-tag pl-tag--no">No vas</span>`;
  return "";
}
function plFila(p) {
  const donde = plDonde(p);
  return `<button type="button" class="pl-fila${p.cancelado ? " is-cancelado" : ""}" data-action="pl-ver" data-id="${escapeHtml(p.id)}">
    <span class="pl-ico pl-ico--${p.tipo}">${plIcono(p)}</span>
    <span class="pl-fila__t"><b>${escapeHtml(p.titulo)}</b><span class="text-xs muted">${escapeHtml(plCuando(p))}${donde ? " · " + escapeHtml(donde) : ""}</span></span>
    ${plCaras(p, 22)}${plMarca(p)}</button>`;
}
/* Amigos: la tarjeta de planes (invitaciones primero, después los próximos y los que se votan) */
function plAmigosHtml(amigos) {
  if (PLAN.error === "sin-servidor") return "";
  const l = PLAN.lista || [], hoy = todayISO();
  if (!l.length && !amigos.length) return "";
  const inv = l.filter(p => p.respuesta === "pendiente" && !p.cancelado);
  const prox = l.filter(p => !inv.includes(p) && p.fecha && p.fecha >= hoy), votar = l.filter(p => !inv.includes(p) && !p.fecha);
  const invHtml = inv.map(p => `<div class="pl-inv">${plFila(p)}
      <div class="pl-inv__b"><button class="btn-ghost" data-action="pl-resp" data-id="${escapeHtml(p.id)}" data-v="no">No puedo</button>
        <button class="btn btn--soft" data-action="pl-resp" data-id="${escapeHtml(p.id)}" data-v="quizas">Tal vez</button>
        <button class="btn btn--primary" data-action="pl-resp" data-id="${escapeHtml(p.id)}" data-v="voy">Voy</button></div></div>`).join("");
  const seccion = (t, ps) => ps.length ? `<div class="cj-sub mt-8">${t}</div>${ps.map(plFila).join("")}` : "";
  return `<div class="card pl-card"><div class="flex-between"><div class="card__title">${icoUI("ticket")} Planes</div>
      ${amigos.length ? `<button class="btn btn--soft pl-card__nuevo" data-action="pl-nuevo">${icoUI("plus")} Nuevo plan</button>` : ""}</div>
    ${inv.length ? `<div class="cj-sub mt-8">Te invitan</div>${invHtml}` : ""}
    ${seccion("Próximos", prox)}${seccion("Por definir", votar)}
    ${!l.length ? `<p class="text-sm muted mt-8">Una película el viernes, un asado o salir a correr: propón un plan, invita a tus amigos y cada uno responde si va. Queda en la Semana y el Calendario de cada uno.</p>` : ""}</div>`;
}
/* El perfil de un amigo: los planes que tienen juntos (para «Lo que hacen juntos») */
function plJuntos(amigoId) {
  return (PLAN.lista || []).filter(p => !p.cancelado && p.miembros.some(m => m.id === amigoId && m.respuesta !== "no"))
    .map(p => `<button type="button" class="cj-junto" data-action="pl-ver" data-id="${escapeHtml(p.id)}">${plIcono(p)}<b>${escapeHtml(p.titulo)}</b><span class="text-xs muted">${escapeHtml(plCuando(p))}</span></button>`);
}
/* Semana: los planes de un día, en su columna */
function plDiaHtml(iso) {
  planesAlDia();
  const ps = plDelDia(iso);
  return ps.length ? `<div class="pl-dia">${ps.map(p => `<button type="button" class="pl-ev" data-action="pl-ver" data-id="${escapeHtml(p.id)}">
    <span class="pl-ev__h">${p.hora || "Plan"}</span><span class="pl-ev__t">${plIcono(p)} ${escapeHtml(p.titulo)}</span></button>`).join("")}</div>` : "";
}
/* Inicio: los planes de hoy */
function plHoyHtml() {
  planesAlDia();
  const ps = plDelDia(todayISO());
  if (!ps.length) return "";
  return `<div class="card pl-hoy">${ps.map(p => {
    const con = plCon(p), donde = plDonde(p);
    return `<button type="button" class="pl-hoy__p" data-action="pl-ver" data-id="${escapeHtml(p.id)}">
      <span class="pl-hoy__k">${icoUI("ticket")} Hoy${p.hora ? " a las " + p.hora : ""}${p.respuesta === "quizas" ? " · tal vez vas" : ""}</span>
      <b>${escapeHtml(p.titulo)}${con ? " con " + escapeHtml(con) : ""}</b>
      ${donde ? `<span class="text-xs muted">${icoUI(p.lugar ? "map-pin" : "link")} ${escapeHtml(donde)}</span>` : ""}
      ${plCaras(p, 26)}</button>`;
  }).join("")}</div>`;
}
/* Apertura del día: para planificar alrededor del plan */
function plAperturaHtml() {
  const ps = plDelDia(todayISO());
  return ps.length ? `<div class="gcal-apertura"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">🎟️ Hoy tienes un plan</div>
    ${ps.map(p => `<div class="gcal-ev"><span class="gcal-ev__h">${p.hora || "Hoy"}</span><span class="gcal-ev__t">${escapeHtml(p.titulo)}${plCon(p) ? " · con " + escapeHtml(plCon(p)) : ""}</span></div>`).join("")}</div>` : "";
}
/* Calendario: los planes del mes (como eventos) */
function plCalendario(year, m, push) {
  planesAlDia();
  const mes = `${year}-${String(m + 1).padStart(2, "0")}`;
  (PLAN.lista || []).filter(p => plVa(p) && p.fecha.slice(0, 7) === mes)
    .forEach(p => push(+p.fecha.slice(8), { icon: "🎟️", label: (p.hora ? p.hora + " " : "") + p.titulo, cls: "plan", type: "plan", id: p.id }));
}

/* El formulario: nuevo plan (con amigos elegidos) o editar uno (solo quien lo propuso) */
function openPlanForm(id, pre) {
  const p = id ? (PLAN.lista || []).find(x => x.id === id) : null;
  if (p && !plEsMio(p)) return;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [], dentro = new Set(p ? p.miembros.map(m => m.id) : []);
  const libres = amigos.filter(a => !dentro.has(a.id)), tipo = p ? p.tipo : "pelicula", dist = !!(p && p.enlace && !p.lugar);
  const votando = p && !p.fecha;
  const radio = (nombre, v, txt, on) => `<label class="pl-chip"><input type="radio" name="${nombre}" value="${v}" ${on ? "checked" : ""} onchange="plFormModo()"><span>${txt}</span></label>`;
  openModal(p ? "Editar plan" : "🎟️ Nuevo plan", `<div class="pl-form">
    <div class="field"><label>Qué</label><div class="pl-chips">${PL_TIPOS.map(([k, l, ic]) => radio("pl-tipo", k, icoUI(ic) + " " + l, k === tipo)).join("")}</div></div>
    <div class="field"><label for="pl-titulo">Nombre</label><input class="input" id="pl-titulo" maxlength="60" value="${escapeHtml(p ? p.titulo : "")}" placeholder="Ej: Ver Dune: Parte Dos"></div>
    <div class="field"><label>Cuándo</label>
      ${p ? "" : `<div class="pl-seg">${radio("pl-cuando", "fija", "Una fecha", true)}${radio("pl-cuando", "votar", "Que voten", false)}</div>`}
      <div id="pl-fija" class="pl-dos">
        <input class="input" type="date" id="pl-fecha" min="${todayISO()}" value="${escapeHtml(p ? p.fecha : "")}" aria-label="Día">
        <input class="input" type="time" id="pl-hora" value="${escapeHtml(p ? p.hora : "")}" aria-label="Hora (opcional)"></div>
      ${votando ? `<p class="text-xs muted mt-8">Se está votando la fecha. Si eliges un día aquí, la votación se cierra.</p>` : ""}
      ${p ? "" : `<div id="pl-votar" hidden><div id="pl-ops">${plOpFila(null)}${plOpFila(null)}</div>
        <button type="button" class="btn-ghost mt-8" data-action="pl-op-mas">${icoUI("plus")} Otra fecha</button>
        <p class="text-xs muted">Cada uno marca las que le sirven y tú eliges la fecha.</p></div>`}</div>
    <div class="field"><label>Dónde <span class="muted" style="font-weight:500">(opcional)</span></label>
      <div class="pl-seg">${radio("pl-donde", "lugar", icoUI("map-pin") + " Un lugar", !dist)}${radio("pl-donde", "distancia", icoUI("link") + " A distancia", dist)}</div>
      <div id="pl-lugar-box" ${dist ? "hidden" : ""}><input class="input" id="pl-lugar" maxlength="80" value="${escapeHtml(p ? p.lugar : "")}" placeholder="Ej: Casa de Ana"></div>
      <div id="pl-enlace-box" ${dist ? "" : "hidden"}><input class="input" id="pl-enlace" maxlength="300" inputmode="url" value="${escapeHtml(p ? p.enlace : "")}" placeholder="El enlace de la videollamada"></div></div>
    ${(p ? libres : amigos).length && (!p || p.miembros.length < 13) ? `<div class="field cj-modal"><label>${p ? "Invitar a alguien más" : "Con quién"}</label>
      <div class="cj-amigos" id="pl-amigos">${(p ? libres : amigos).map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}" ${(pre || []).includes(a.id) ? "checked" : ""}>${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div></div>` : ""}
    <p class="text-xs muted">${p ? "Si cambias cuándo o dónde, les avisamos a los invitados." : "Ven el plan, no tu agenda. Cada uno responde voy, tal vez o no puedo, y queda en su Semana y su Calendario."}</p>
    <button class="btn btn--primary btn-block" data-action="pl-guardar" data-id="${p ? escapeHtml(p.id) : ""}">${p ? "Guardar cambios" : "Invitar"}</button>
    ${p ? `<button class="btn-ghost btn-block mt-8" data-action="pl-cancelar" data-id="${escapeHtml(p.id)}">Cancelar el plan</button>` : ""}</div>`);
}
/* El detalle: cuándo, dónde, quiénes van, tu respuesta y (si se vota) las fechas */
function openPlan(id) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p) return;
  const mio = plEsMio(p), yo = plYo(p), donde = p.lugar ? `${icoUI("map-pin")} ${escapeHtml(p.lugar)}`
    : p.enlace ? `${icoUI("link")} <a href="${escapeHtml(p.enlace)}" target="_blank" rel="noopener noreferrer">A distancia: abrir el enlace</a>` : "";
  const orden = { voy: 0, quizas: 1, pendiente: 2, no: 3 };
  const gente = p.miembros.slice().sort((a, b) => orden[a.respuesta] - orden[b.respuesta]).map(m => `<div class="pl-persona">${amigosAvatar(m, 30)}
      <b>${escapeHtml(plNombre(m))}${m.id === p.creador ? ` <span class="text-xs muted" style="font-weight:500">· lo propuso</span>` : ""}</b>
      <span class="pl-resp pl-resp--${m.respuesta}">${PL_RESPUESTAS[m.respuesta]}</span></div>`).join("");
  const n = p.miembros.filter(m => m.respuesta === "voy").length;
  const votos = !p.fecha && !p.cancelado ? `<div class="cj-sub mt-8">¿Qué fechas te sirven?</div>
    <div class="pl-votos" id="pl-votos">${p.opciones.map(o => `<div class="pl-voto">
        <label><input type="checkbox" value="${o.id}" ${yo && o.votos.includes(yo.id) ? "checked" : ""}><b>${escapeHtml(plFechaTxt(o.fecha, o.hora))}</b></label>
        <span class="pl-voto__n">${o.votos.length ? `${o.votos.length === 1 ? "1 puede" : o.votos.length + " pueden"}` : "nadie aún"}</span>
        ${mio ? `<button class="btn-ghost" data-action="pl-fijar" data-id="${escapeHtml(p.id)}" data-op="${o.id}">Elegir</button>` : ""}</div>`).join("")}</div>
    <button class="btn btn--soft" data-action="pl-votar" data-id="${escapeHtml(p.id)}">Guardar mis fechas</button>
    ${mio ? `<p class="text-xs muted" style="margin:0">Cuando quieras, toca «Elegir» en la fecha que quede: el plan pasa a la agenda de todos.</p>` : ""}` : "";
  const responder = !mio && !p.cancelado ? `<div class="pl-rsvp">${["voy", "quizas", "no"].map(v => `<button class="${p.respuesta === v ? "btn btn--primary" : "btn btn--soft"}" data-action="pl-resp" data-id="${escapeHtml(p.id)}" data-v="${v}">${PL_RESPUESTAS[v]}</button>`).join("")}</div>` : "";
  openModal(p.titulo, `<div class="pl-det">
    <div class="pl-det__cab"><span class="pl-ico pl-ico--${p.tipo} pl-ico--xl">${plIcono(p)}</span>
      <span><b>${escapeHtml(plCuando(p)).replace(/^./, c => c.toUpperCase())}</b><span class="text-sm muted">${mio ? "Lo propusiste tú" : escapeHtml(plQuienPropone(p)) + " te invita"}</span></span></div>
    ${p.cancelado ? `<div class="pl-cancelado">${icoUI("x")} Este plan se canceló.</div>` : ""}
    ${donde ? `<div class="pl-det__donde">${donde}</div>` : ""}
    ${responder}
    ${votos}
    <div class="cj-sub mt-8">${n === 1 ? "Va 1" : "Van " + n} de ${p.miembros.length}</div>
    <div class="pl-gente">${gente}</div>
    ${mio && !p.cancelado ? `<div class="row-wrap" style="gap:8px"><button class="btn-ghost" data-action="pl-editar" data-id="${escapeHtml(p.id)}">${icoUI("pencil")} Editar o invitar</button></div>` : ""}</div>`);
}
