/* ============================================================
   RUMBO · Listas compartidas con amigos (planes, etapa 2)
   «Películas por ver con Ana», «Restaurantes por probar», «El viaje al sur»: todos agregan,
   dicen «yo también» (+1), marcan lo que ya vieron y le ponen estrellas. Desde cualquier
   cosa de la lista, «Elegir para un plan» abre un plan nuevo (planes.js) con esa cosa y la
   misma gente. Viven en el módulo Listas (sección «Con amigos») y en Amigos; todo está en
   supabase/listas.sql. Tus listas personales siguen en tu documento, solo tuyas.
   ============================================================ */

const LCOM = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [], abiertas: {} };
/* De qué es: su ícono, el tipo del plan que sale de ahí y cómo se dice lo que falta y lo hecho */
const LC_TIPOS = [
  { id: "peliculas", nombre: "Películas", ico: "clapperboard", plan: "pelicula", por: "por ver", hecho: "Ya la vimos", seccion: "Vistas", verbo: "verla" },
  { id: "series", nombre: "Series", ico: "play", plan: "pelicula", por: "por ver", hecho: "Ya la vimos", seccion: "Vistas", verbo: "verla" },
  { id: "comida", nombre: "Comida", ico: "utensils", plan: "comer", por: "por probar", hecho: "Ya fuimos", seccion: "Probados", verbo: "ir" },
  { id: "viaje", nombre: "Viaje", ico: "route", plan: "viaje", por: "por conocer", hecho: "Ya fuimos", seccion: "Ya fuimos", verbo: "ir" },
  { id: "libros", nombre: "Libros", ico: "book-open", plan: "otro", por: "por leer", hecho: "Ya lo leímos", seccion: "Leídos", verbo: "leerlo" },
  { id: "otra", nombre: "Otra", ico: "sparkles", plan: "otro", por: "por hacer", hecho: "Ya lo hicimos", seccion: "Hechos", verbo: "hacerlo" },
];
const LC_POR_CARTA = 8;   // cuántas por ver se ven en la tarjeta (el resto, con «Ver todas»)

/* -------- Lo que llega del servidor lo escribieron otras personas: se limpia -------- */
function lcLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  const lista = v => (Array.isArray(v) ? v : []);
  return {
    id: String(x.id || "").replace(/[^\w-]/g, "").slice(0, 64), nombre: String(x.nombre || "").trim().slice(0, 60) || "Lista",   // el id va en onkeydown: solo letras, números y guiones
    tipo: LC_TIPOS.some(t => t.id === x.tipo) ? x.tipo : "otra",
    estado: x.estado === "activo" ? "activo" : "invitado", invita: String(x.invita || ""),
    miembros: lista(x.miembros).slice(0, 8).map(m => ({ id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60),
      avatar: (m && m.avatar) || null, estado: m && m.estado === "activo" ? "activo" : "invitado" })),
    items: lista(x.items).slice(0, 200).map(i => ({
      id: parseInt(i && i.id, 10) || 0, user_id: String((i && i.user_id) || ""), nombre: String((i && i.nombre) || "").slice(0, 60),
      texto: String((i && i.texto) || "").trim().slice(0, 80) || "Sin nombre", nota: String((i && i.nota) || "").trim().slice(0, 80),
      visto: cjFecha(i && i.visto), visto_por: String((i && i.visto_por) || ""),
      mas_uno: lista(i && i.mas_uno).slice(0, 8).map(String),
      estrellas: lista(i && i.estrellas).slice(0, 8).map(e => ({ id: String((e && e.id) || ""), n: Math.max(1, Math.min(5, parseInt(e && e.n, 10) || 1)) })),
    })).filter(i => i.id),
  };
}

/* -------- Lecturas -------- */
function lcYo(l) { return l.miembros.find(m => m.yo) || null; }
function lcTipo(l) { return LC_TIPOS.find(t => t.id === l.tipo) || LC_TIPOS[5]; }
function lcIcono(l) { return icoUI(lcTipo(l).ico); }
function lcPorTxt(l, n) { return `${n} ${lcTipo(l).por}`; }
/* Los nombres en una frase: «Ana, Pedro y tú» */
function lcNombres(ns) { return cjNombres(ns.map(n => (n === "Tú" ? "tú" : n))); }
function lcCon(l) { return cjNombres(l.miembros.filter(m => !m.yo && m.estado === "activo").map(m => m.nombre || "Sin nombre")); }
function lcNombreDe(l, uid, conocido) {
  const yo = lcYo(l);
  if (uid && yo && uid === yo.id) return "Tú";
  const m = l.miembros.find(x => x.id === uid);
  return (m && m.nombre) || conocido || "Alguien";
}
/* Cuántos la quieren: quien la agregó y los +1 */
function lcQuieren(it) { return new Set([it.user_id, ...it.mas_uno].filter(Boolean)).size; }
/* Por ver: lo que más quieren arriba; las vistas, de la última a la primera */
function lcPorVer(l) { return l.items.filter(i => !i.visto).sort((a, b) => lcQuieren(b) - lcQuieren(a) || a.id - b.id); }
function lcVistas(l) { return l.items.filter(i => i.visto).sort((a, b) => b.visto.localeCompare(a.visto) || b.id - a.id); }
function lcPromedio(it) { return it.estrellas.length ? Math.round((it.estrellas.reduce((t, e) => t + e.n, 0) / it.estrellas.length) * 10) / 10 : 0; }
/* «agregaste tú · Pedro +1», «agregó Ana · tú y Pedro +1 · en Netflix» */
function lcQuienTxt(l, it) {
  const yo = lcYo(l), adder = it.user_id && yo && it.user_id === yo.id ? "agregaste tú" : `agregó ${lcNombreDe(l, it.user_id, it.nombre)}`;
  const mas = it.mas_uno.filter(u => u !== it.user_id).map(u => lcNombreDe(l, u));
  return adder + (mas.length ? ` · ${lcNombres(mas)} +1` : "") + (it.nota ? ` · ${it.nota}` : "");
}
function lcItemDe(id) {
  for (const l of LCOM.lista || []) { const it = l.items.find(i => i.id === id); if (it) return { l, it }; }
  return null;
}

/* -------- Cargar y mantener al día -------- */
async function listasCargar(forzar) {
  if (!CURRENT_USER || !STATE || LCOM.cargando || !BACKEND.listaLista) return;
  if (!forzar && (LCOM.lista || LCOM.error) && Date.now() - LCOM.t < 60000) return;   // a lo más una vez por minuto
  LCOM.cargando = true;
  const r = await BACKEND.listaLista();
  LCOM.cargando = false; LCOM.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { LCOM.error = r.error; lcRepintar(); return; }
  LCOM.error = null;
  LCOM.lista = (Array.isArray(r) ? r : []).map(lcLimpio).filter(l => l.id && lcYo(l));
  const nueva = LCOM.lista.find(l => l.estado === "invitado" && !LCOM.vistas.includes(l.id));
  LCOM.lista.forEach(l => { if (!LCOM.vistas.includes(l.id)) LCOM.vistas.push(l.id); });
  if (nueva && CURRENT !== "amigos" && CURRENT !== "listas") toast(`📋 ${lcQuienInvita(nueva)} te invita a la lista «${nueva.nombre}»`);
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  lcRepintar();
}
function lcQuienInvita(l) { const m = l.miembros.find(x => x.id === l.invita); return (m && m.nombre) || "Un amigo"; }
function lcRepintar() {
  if (!["amigos", "listas"].includes(CURRENT)) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view")) return;
  rerender();
}

/* -------- Crear, editar, invitar, unirse y salir -------- */
async function listaCompGuardar(id) {
  if (LCOM.guardando) return;
  const l = id ? (LCOM.lista || []).find(x => x.id === id) : null;
  const nombre = val("lc-nombre"), tipo = (document.querySelector('input[name="lc-tipo"]:checked') || {}).value || "otra";
  const amigos = [...document.querySelectorAll("#lc-amigos input:checked")].map(i => i.value);
  if (!nombre) return toast("Ponle un nombre a la lista", true);
  if (!l && !amigos.length) return toast("Elige al menos un amigo", true);
  LCOM.guardando = true;
  try {
    if (l) {
      if (nombre !== l.nombre || tipo !== l.tipo) {
        const r = await BACKEND.listaEditar(l.id, nombre, tipo);
        if (r && r.error) return toast(lcTextoError(r.error), true);
      }
      if (amigos.length) {
        const r = await BACKEND.listaInvitar(l.id, amigos);
        if (r && r.error) return toast(lcTextoError(r.error), true);
        BACKEND.amigosAvisar("lista-invita", { lista: l.id });
      }
      closeModal(); toast("Lista actualizada");
    } else {
      const r = await BACKEND.listaCrear(nombre, tipo, amigos);
      if (r && r.error) return toast(lcTextoError(r.error), true);
      BACKEND.amigosAvisar("lista-invita", { lista: r.id });
      closeModal();
      toast(`📋 Le avisamos a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}. Mientras, ya puedes agregar.`);
    }
  } finally { LCOM.guardando = false; }
  await listasCargar(true);
}
async function listaCompResponder(id, acepta) {
  const r = await BACKEND.listaResponder(id, acepta);
  if (r && r.error) return toast(lcTextoError(r.error), true);
  if (acepta && r.r === "unido") {
    const l = (LCOM.lista || []).find(x => x.id === id);
    toast(`📋 Te sumaste a «${l ? l.nombre : "la lista"}». Está en Listas.`);
    BACKEND.amigosAvisar("lista-acepta", { lista: id });
  }
  closeModal();
  await listasCargar(true);
}
async function listaCompSalir(id) {
  const l = (LCOM.lista || []).find(x => x.id === id);
  if (!confirm(`¿Salir de «${l ? l.nombre : "esta lista"}»? Lo que agregaste se queda para los demás.`)) return;
  const r = await BACKEND.listaSalir(id);
  if (r && r.error) return toast(lcTextoError(r.error), true);
  closeModal(); toast("Saliste de la lista");
  await listasCargar(true);
}

/* -------- Las cosas de la lista -------- */
async function listaCompAgregar(id) {
  const input = document.getElementById("lc-in-" + id), texto = input ? input.value.trim() : "";
  if (!texto) return toast("Escribe qué agregar", true);
  const r = await BACKEND.listaAgregar(id, texto, "");
  if (r && r.error) return toast(lcTextoError(r.error), true);
  if (input) { input.value = ""; input.blur(); }   // sin el foco puesto, la tarjeta se vuelve a dibujar con lo nuevo
  vibrar(10);
  BACKEND.amigosAvisar("lista-agrega", { lista: id, item: r.id });
  await listasCargar(true);
  const otro = document.getElementById("lc-in-" + id); if (otro) otro.focus();
}
/* Tu +1 y tus estrellas van juntos (lista_item_marcar): se manda lo que queda */
async function listaCompMarcar(itemId, cambio) {
  const x = lcItemDe(itemId); if (!x) return;
  const yo = lcYo(x.l), mio = x.it.estrellas.find(e => e.id === yo.id);
  const masUno = "masUno" in cambio ? cambio.masUno : x.it.mas_uno.includes(yo.id);
  const estrellas = "estrellas" in cambio ? cambio.estrellas : mio ? mio.n : null;
  const r = await BACKEND.listaItemMarcar(itemId, masUno, estrellas);
  if (r && r.error) return toast(lcTextoError(r.error), true);
  vibrar(8);
  await listasCargar(true);
  if (document.getElementById("lc-item-det")) openListaItem(itemId);
}
async function listaCompVisto(itemId) {
  const x = lcItemDe(itemId); if (!x) return;
  const r = await BACKEND.listaItemVisto(itemId, !x.it.visto, todayISO());
  if (r && r.error) return toast(lcTextoError(r.error), true);
  vibrar(10);
  if (!x.it.visto) toast(`✅ «${x.it.texto}»: ${lcTipo(x.l).hecho.toLowerCase()}. Ponle estrellas cuando quieras.`);
  await listasCargar(true);
  if (document.getElementById("lc-item-det")) openListaItem(itemId);
}
async function listaCompNota(itemId) {
  const r = await BACKEND.listaItemNota(itemId, val("lc-nota"));
  if (r && r.error) return toast(lcTextoError(r.error), true);
  toast("Nota guardada");
  await listasCargar(true);
  openListaItem(itemId);
}
async function listaCompBorrar(itemId) {
  const x = lcItemDe(itemId); if (!x) return;
  if (!confirm(`¿Borrar «${x.it.texto}» de la lista? Se borra para todos.`)) return;
  const r = await BACKEND.listaItemBorrar(itemId);
  if (r && r.error) return toast(lcTextoError(r.error), true);
  closeModal(); toast("Borrado de la lista");
  await listasCargar(true);
}
/* «Elegir para un plan»: un plan nuevo con esa cosa y la gente de la lista (los que son tus amigos) */
function listaCompPlan(itemId) {
  const x = lcItemDe(itemId); if (!x) return;
  const t = lcTipo(x.l), amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  const gente = x.l.miembros.filter(m => !m.yo && m.estado === "activo" && amigos.some(a => a.id === m.id)).map(m => m.id);
  const titulo = (t.plan === "pelicula" ? "Ver " : "") + x.it.texto;
  closeModal();
  openPlanForm(null, gente, { titulo: titulo.slice(0, 60), tipo: t.plan, lista: x.l.nombre });
}
function lcTextoError(e) {
  return {
    "sin-servidor": "Las listas compartidas todavía no están activas en el servidor.",
    amigos: "Elige al menos un amigo (hasta 7).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no estás en esta lista.",
    limite: "Llegaste al máximo: hasta 8 personas y 200 cosas por lista, 20 listas compartidas y 50 cosas nuevas al día.",
    nombre: "Ponle un nombre de hasta 60 letras.",
    tipo: "Elige de qué es la lista.",
    texto: "Escribe qué agregar (hasta 80 letras).",
    estrellas: "Las estrellas van de 1 a 5.",
  }[e] || amigosTextoError(e);
}

/* -------- Acciones (data-action="lc-…", ver onClick en app.js) -------- */
function listasCompAccion(a, d) {
  if (a === "lc-nueva") { closeModal(); return openListaCompForm(null, d.amigo ? [d.amigo] : []); }
  if (a === "lc-editar") return openListaCompForm(d.id);
  if (a === "lc-guardar") return listaCompGuardar(d.id || null);
  if (a === "lc-unirme") return listaCompResponder(d.id, true);
  if (a === "lc-rechazar") return listaCompResponder(d.id, false);
  if (a === "lc-salir") return listaCompSalir(d.id);
  if (a === "lc-agregar") return listaCompAgregar(d.id);
  if (a === "lc-item") return openListaItem(parseInt(d.id, 10));
  if (a === "lc-mas1") { const x = lcItemDe(parseInt(d.id, 10)); if (x) listaCompMarcar(x.it.id, { masUno: !x.it.mas_uno.includes(lcYo(x.l).id) }); return; }
  if (a === "lc-visto") return listaCompVisto(parseInt(d.id, 10));
  if (a === "lc-estrellas") { const x = lcItemDe(parseInt(d.id, 10)), n = parseInt(d.n, 10); if (!x) return;
    const mio = x.it.estrellas.find(e => e.id === lcYo(x.l).id); return listaCompMarcar(x.it.id, { estrellas: mio && mio.n === n ? null : n }); }
  if (a === "lc-nota-ok") return listaCompNota(parseInt(d.id, 10));
  if (a === "lc-borrar") return listaCompBorrar(parseInt(d.id, 10));
  if (a === "lc-plan") return listaCompPlan(parseInt(d.id, 10));
  if (a === "lc-todas") { LCOM.abiertas[d.id] = !LCOM.abiertas[d.id]; return rerender(); }
  if (a === "lc-ir") { closeModal(); return go("listas"); }
}

/* -------- Dibujo -------- */
function lcEstrellas(n, tam) {
  return `<span class="lc-est" aria-label="${n ? n + " de 5 estrellas" : "Sin estrellas"}">${[1, 2, 3, 4, 5].map(k => `<span class="${k <= Math.round(n) ? "on" : ""}">${iconoLinea("estrella", tam || 13)}</span>`).join("")}</span>`;
}
function lcCaras(l) {
  const act = l.miembros.filter(m => m.estado === "activo");
  return `<span class="pl-caras">${act.slice(0, 4).map(m => amigosAvatar(m, 24)).join("")}${act.length > 4 ? `<span class="pl-caras__mas">+${act.length - 4}</span>` : ""}</span>`;
}
function lcFila(l, it) {
  const yo = lcYo(l), mio = yo && it.user_id === yo.id, quiero = yo && it.mas_uno.includes(yo.id), n = it.mas_uno.filter(u => u !== it.user_id).length;
  return `<div class="lc-item">
    <button type="button" class="lc-check" data-action="lc-visto" data-id="${it.id}" aria-label="${escapeHtml(lcTipo(l).hecho)}: ${escapeHtml(it.texto)}" title="${escapeHtml(lcTipo(l).hecho)}"></button>
    <button type="button" class="lc-item__t" data-action="lc-item" data-id="${it.id}"><b>${escapeHtml(it.texto)}</b><span>${escapeHtml(lcQuienTxt(l, it))}</span></button>
    ${mio ? "<span></span>" : `<button type="button" class="lc-mas1${quiero ? " is-on" : ""}" data-action="lc-mas1" data-id="${it.id}" aria-pressed="${!!quiero}" title="Yo también quiero">+1${n > 1 ? ` · ${n}` : ""}</button>`}
    <button type="button" class="icon-btn lc-plan" data-action="lc-plan" data-id="${it.id}" aria-label="Elegir «${escapeHtml(it.texto)}» para un plan" title="Elegir para un plan">${icoUI("ticket")}</button></div>`;
}
function lcFilaVista(l, it) {
  const p = lcPromedio(it);
  return `<div class="lc-item is-visto">
    <button type="button" class="lc-check is-on" data-action="lc-visto" data-id="${it.id}" aria-label="Desmarcar: ${escapeHtml(it.texto)}" title="Desmarcar">${icoUI("hecho")}</button>
    <button type="button" class="lc-item__t" data-action="lc-item" data-id="${it.id}"><b>${escapeHtml(it.texto)}</b><span>${escapeHtml(plFechaTxt(it.visto, ""))}${it.estrellas.length ? ` · ${it.estrellas.length === 1 ? "1 nota" : it.estrellas.length + " notas"}` : " · ponle estrellas"}</span></button>
    ${p ? lcEstrellas(p) : ""}</div>`;
}
/* La tarjeta de una lista compartida (en Listas) */
function lcTarjeta(l) {
  const porVer = lcPorVer(l), vistas = lcVistas(l), todas = !!LCOM.abiertas[l.id], con = lcCon(l);
  const mostrar = todas ? porVer : porVer.slice(0, LC_POR_CARTA);
  return `<div class="card lc">
    <div class="lc__cab"><span class="pl-ico pl-ico--${lcTipo(l).plan}">${lcIcono(l)}</span>
      <span class="lc__t"><b>${escapeHtml(l.nombre)}</b><span class="text-xs muted">${con ? "con " + escapeHtml(con) + " · " : ""}${lcPorTxt(l, porVer.length)}</span></span>
      ${lcCaras(l)}<button type="button" class="icon-btn" data-action="lc-editar" data-id="${escapeHtml(l.id)}" aria-label="Editar la lista" title="Editar o invitar">${icoUI("pencil")}</button></div>
    ${mostrar.map(it => lcFila(l, it)).join("") || `<p class="text-sm muted" style="margin:6px 0">Nada por ahora. Agrega lo primero.</p>`}
    ${porVer.length > LC_POR_CARTA ? `<button type="button" class="btn-ghost lc-todas" data-action="lc-todas" data-id="${escapeHtml(l.id)}">${todas ? "Ver menos" : `Ver las ${porVer.length}`}</button>` : ""}
    <div class="row lc-add"><input class="input" id="lc-in-${escapeHtml(l.id)}" maxlength="80" placeholder="Agregar…" onkeydown="if(event.key==='Enter'){event.preventDefault();listaCompAgregar('${escapeHtml(l.id)}')}">
      <button class="btn btn--cian" data-action="lc-agregar" data-id="${escapeHtml(l.id)}" aria-label="Agregar">${icoUI("plus")}</button></div>
    ${vistas.length ? `<details class="lc-vistas"><summary>${escapeHtml(lcTipo(l).seccion)} · ${vistas.length}</summary>${vistas.map(it => lcFilaVista(l, it)).join("")}</details>` : ""}</div>`;
}
/* Invitaciones a listas, en Listas (en Amigos están en «Para responder») */
function lcInvitacionesHtml() {
  const inv = (LCOM.lista || []).filter(l => l.estado === "invitado");
  if (!inv.length) return "";
  return `<div class="card oj-invs"><div class="card__title">${icoUI("listas")} Te invitan a una lista</div>
    ${inv.map(l => `<div class="am-sol cj-inv"><span class="cj-fila__ico">${lcIcono(l)}</span><span class="am-sol__t"><b>${escapeHtml(l.nombre)}</b>
      <span class="text-xs muted">${escapeHtml(lcQuienInvita(l))} te invita · ${l.items.length === 1 ? "1 cosa" : l.items.length + " cosas"}</span></span>
      <span class="am-sol__b"><button class="btn-ghost" data-action="lc-rechazar" data-id="${escapeHtml(l.id)}">Ahora no</button><button class="btn btn--primary" data-action="lc-unirme" data-id="${escapeHtml(l.id)}">Unirme</button></span></div>`).join("")}</div>`;
}
/* Listas: la sección «Con amigos», arriba de tus listas de siempre */
function lcSeccionListas() {
  if (!amigosCfg().activo) return "";
  listasCargar(false);
  if (LCOM.error === "sin-servidor") return "";
  const act = (LCOM.lista || []).filter(l => l.estado === "activo"), amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  if (!act.length && !(LCOM.lista || []).length && !amigos.length) return "";
  const boton = amigos.length ? `<button class="btn btn--soft" data-action="lc-nueva">${icoUI("handshake")} Lista con amigos</button>` : "";
  return `<div class="flex-between"><div class="card__title" style="margin:0">Con amigos</div>${act.length ? boton : ""}</div>
    <div class="mt-16">${lcInvitacionesHtml()}</div>
    ${act.length ? `<div class="grid grid-2 lc-grid">${act.map(lcTarjeta).join("")}</div>`
      : `<div class="card"><p class="text-sm muted" style="margin:0 0 14px">Películas por ver, restaurantes por probar, lugares para un viaje: una lista que arman entre varios. Cada uno agrega, dice «yo también» y marca lo que ya hicieron. Y de ahí, a un plan.</p>${boton}</div>`}
    <div class="divider"></div>`;
}
/* El perfil de un amigo: las listas que comparten (para «Lo que hacen juntos») */
function lcJuntos(amigoId) {
  return (LCOM.lista || []).filter(l => l.estado === "activo" && l.miembros.some(m => m.id === amigoId && m.estado === "activo"))
    .map(l => `<button type="button" class="cj-junto" data-action="lc-ir">${lcIcono(l)}<b>${escapeHtml(l.nombre)}</b><span class="text-xs muted">${lcPorTxt(l, lcPorVer(l).length)}</span></button>`);
}

/* El formulario: nueva lista (con amigos elegidos) o editar una */
function openListaCompForm(id, pre) {
  const l = id ? (LCOM.lista || []).find(x => x.id === id) : null;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [], dentro = new Set(l ? l.miembros.map(m => m.id) : []);
  const libres = amigos.filter(a => !dentro.has(a.id)), tipo = l ? l.tipo : "peliculas";
  openModal(l ? "Editar lista" : "📋 Lista con amigos", `<div class="pl-form">
    <div class="field"><label>De qué es</label><div class="pl-chips">${LC_TIPOS.map(t => `<label class="pl-chip"><input type="radio" name="lc-tipo" value="${t.id}" ${t.id === tipo ? "checked" : ""}><span>${icoUI(t.ico)} ${t.nombre}</span></label>`).join("")}</div></div>
    <div class="field"><label for="lc-nombre">Nombre</label><input class="input" id="lc-nombre" maxlength="60" value="${escapeHtml(l ? l.nombre : "")}" placeholder="Ej: Películas por ver"></div>
    ${(l ? libres : amigos).length && (!l || l.miembros.length < 8) ? `<div class="field cj-modal"><label>${l ? "Invitar a alguien más" : "Con quién"}</label>
      <div class="cj-amigos" id="lc-amigos">${(l ? libres : amigos).map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}" ${(pre || []).includes(a.id) ? "checked" : ""}>${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div></div>` : ""}
    <p class="text-xs muted">${l ? "Es la misma lista para todos: si la cambias, cambia para todos." : "Ven solo esta lista, no tus listas personales. Cada uno agrega, dice «yo también» y marca lo que ya hicieron."}</p>
    <button class="btn btn--primary btn-block" data-action="lc-guardar" data-id="${l ? escapeHtml(l.id) : ""}">${l ? "Guardar cambios" : "Crear lista"}</button>
    ${l ? `<button class="btn-ghost btn-block mt-8" data-action="lc-salir" data-id="${escapeHtml(l.id)}">Salir de la lista</button>` : ""}</div>`);
}
/* Una cosa de la lista: quién la quiere, si ya la vieron, las estrellas de cada uno, la nota y el plan */
function openListaItem(itemId) {
  const x = lcItemDe(itemId); if (!x) return;
  const { l, it } = x, yo = lcYo(l), t = lcTipo(l), mio = it.user_id === yo.id;
  const mias = (it.estrellas.find(e => e.id === yo.id) || {}).n || 0, quiero = it.mas_uno.includes(yo.id);
  const quieren = [...new Set([it.user_id, ...it.mas_uno].filter(Boolean))].map(u => lcNombreDe(l, u, u === it.user_id ? it.nombre : ""));
  const quierenTxt = quieren.length ? `${quieren.length === 1 && quieren[0] !== "Tú" ? "Quiere" : "Quieren"} ${t.verbo}: ${lcNombres(quieren)}` : "";
  openModal(it.texto, `<div class="pl-det" id="lc-item-det">
    <div class="pl-det__cab"><span class="pl-ico pl-ico--${t.plan} pl-ico--xl">${lcIcono(l)}</span>
      <span><b>${escapeHtml(l.nombre)}</b><span class="text-sm muted">${escapeHtml(quierenTxt)}</span></span></div>
    ${it.visto ? `<div class="lc-det__visto">${icoUI("hecho")} ${escapeHtml(t.hecho)} · ${escapeHtml(plFechaTxt(it.visto, ""))}${it.visto_por === yo.id ? " (lo marcaste tú)" : it.visto_por ? " (lo marcó " + escapeHtml(lcNombreDe(l, it.visto_por)) + ")" : ""}</div>
      <div class="cj-sub">Tus estrellas</div>
      <div class="lc-det__est">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${n <= mias ? "on" : ""}" data-action="lc-estrellas" data-id="${it.id}" data-n="${n}" aria-label="${n} de 5">${iconoLinea("estrella", 26)}</button>`).join("")}</div>
      ${it.estrellas.filter(e => e.id !== yo.id).length ? `<div class="lc-det__notas">${it.estrellas.filter(e => e.id !== yo.id).map(e => `<span>${escapeHtml(lcNombreDe(l, e.id))} ${lcEstrellas(e.n, 12)}</span>`).join("")}</div>` : ""}
      <button class="btn-ghost" data-action="lc-visto" data-id="${it.id}">Desmarcar</button>`
    : `<div class="pl-rsvp lc-det__b">
        <button class="btn btn--primary" data-action="lc-plan" data-id="${it.id}">${icoUI("ticket")} Elegir para un plan</button>
        ${mio ? "" : `<button class="btn ${quiero ? "btn--primary" : "btn--soft"}" data-action="lc-mas1" data-id="${it.id}">${quiero ? "Quieres (+1)" : "Yo también +1"}</button>`}
        <button class="btn btn--soft" data-action="lc-visto" data-id="${it.id}">${icoUI("hecho")} ${escapeHtml(t.hecho)}</button></div>`}
    <div class="field" style="margin:0"><label for="lc-nota">Nota <span class="muted" style="font-weight:500">(dónde verla, dónde queda)</span></label>
      <div class="row" style="gap:6px"><input class="input" id="lc-nota" maxlength="80" value="${escapeHtml(it.nota)}" placeholder="Ej: en Netflix"><button class="btn btn--soft" data-action="lc-nota-ok" data-id="${it.id}">Guardar</button></div></div>
    ${mio || !it.user_id ? `<button class="btn-ghost" data-action="lc-borrar" data-id="${it.id}">${icoUI("trash-2")} Borrar de la lista</button>` : ""}</div>`);
}
