/* ============================================================
   RUMBO · La casa del elefante (Recompensas › Progreso y Tu cuarto, a pantalla completa)
   El cuarto de tu elefante se llena con tu rango y con lo que compras en la Tienda, y en
   su repisa luce las medallas que elijas (o las mejores, si no eliges). Tu elefante vive
   ahí en 3D (elefante-3d.js): tócalo y reacciona. En Progreso el cuarto es una tarjeta;
   al tocarla se abre a pantalla completa (lugar.js), con la ficha en una hoja.
   El 3D vive en cielo-3d.js; sin WebGL queda tu elefante de siempre y la repisa en fila.
   ============================================================ */

/* Lo que el cuarto gana con cada rango (el índice en RANGOS); con Aprendiz ya tiene
   ventana, alfombra, calendario y la repisa */
const CASA_COSAS = [
  { rango: 1, id: "planta", ico: "🪴", n: "una planta" },
  { rango: 2, id: "reloj", ico: "🕰️", n: "un reloj de pared" },
  { rango: 3, id: "biblioteca", ico: "📚", n: "una biblioteca con tus libros" },
  { rango: 4, id: "alcancia", ico: "🐷", n: "una mesita con alcancía" },
  { rango: 5, id: "cuadro", ico: "🖼️", n: "un cuadro de la cumbre" },
  { rango: 6, id: "copa", ico: "🏆", n: "la copa dorada y una guirnalda de luces" },
];
const REPISA_MAX = 5;

/* -------- Lo que hace tu elefante en su cuarto --------
   Va de un rincón a otro y hace algo en cada uno (cielo-3d.js lo hace caminar). Lo que puede hacer
   depende de lo que hay en el cuarto y de la hora (de noche duerme más, y con sueño, un poco más). Lo que hace
   «ahora» cambia cada 20 minutos: lo cuenta tu casa en Inicio y, al entrar, lo encuentras en eso.
   peso: [de día, al atardecer, de noche] */
const ELE_ACTIVIDADES = [
  { id: "siesta", ico: "💤", txt: "duerme la siesta en su alfombra", peso: [1, 2, 8] },
  { id: "ventana", ico: "🪟", txt: "mira por la ventana", peso: [3, 3, 2] },
  { id: "repisa", ico: "🏅", txt: "admira sus medallas en la repisa", medallas: true, peso: [2, 2, 1] },
  { id: "libros", ico: "📚", txt: "busca un libro en su biblioteca", cosa: "biblioteca", peso: [2, 2, 2] },
  { id: "planta", ico: "🪴", txt: "riega su planta", cosa: "planta", peso: [3, 2, 0] },
  { id: "peces", ico: "🐠", txt: "mira nadar a los peces", cosa: "pecera", peso: [2, 2, 2] },
  { id: "gato", ico: "🐈", txt: "le hace cariño al gato", cosa: "gato", peso: [2, 2, 2] },
  { id: "baile", ico: "🎶", txt: "baila con el tocadiscos", cosa: "tocadiscos", peso: [2, 3, 1] },
  { id: "pasea", ico: "👣", txt: "pasea olfateando el cuarto", peso: [3, 2, 1] },
  { id: "sentado", ico: "🐘", txt: "se sentó a esperarte", peso: [2, 2, 1] },
  { id: "cola", ico: "🌀", txt: "persigue su cola", peso: [1, 1, 0] },
];
function franjaCasa(h) { return h >= 20 || h < 6 ? 2 : h >= 18 || h < 8 ? 1 : 0; }   // como la luz del cuarto
/* Lo que puede hacer ahora, con cuántas ganas (peso) */
function eleActividades(s, ahora) {
  const f = franjaCasa((ahora || new Date()).getHours()), cosas = new Set(casaCosas(s).concat(cuartoPuestas(s)));
  const meds = repisaIds(s).length > 0, sueno = animoElefante(s) === "sueno";
  return ELE_ACTIVIDADES.filter(a => (!a.cosa || cosas.has(a.cosa)) && (!a.medallas || meds))
    .map(a => ({ ...a, w: a.peso[f] * (a.id === "siesta" && sueno ? 2 : 1) })).filter(a => a.w > 0);
}
/* Lo que hace ahora mismo: lo mismo durante 20 minutos (en Inicio y al entrar a tu casa) */
function eleActividadAhora(s, ahora) {
  ahora = ahora || new Date();
  const l = eleActividades(s, ahora), tot = l.reduce((m, a) => m + a.w, 0);
  if (!tot) return ELE_ACTIVIDADES.find(a => a.id === "sentado");
  let x = ((Math.imul(Math.floor(ahora.getTime() / 12e5), 2654435761) >>> 0) % 10007) / 10007 * tot;
  for (const a of l) { x -= a.w; if (x < 0) return a; }
  return l[l.length - 1];
}
function eleActividad(id) { return ELE_ACTIVIDADES.find(a => a.id === id) || ELE_ACTIVIDADES.find(a => a.id === "sentado"); }
/* El motor avisa cuando cambia de actividad: la hoja de tu casa dice lo que hace */
function eleHaciendo(id) {
  const el = document.getElementById("cuaAhora"); if (!el) return;
  const a = eleActividad(id); el.textContent = `${a.ico} Ahora ${a.txt}`;
}
function casaRango(s) { return rankFor((s.gamif && s.gamif.xp) || 0).idx; }
function casaCosas(s) { const r = casaRango(s); return CASA_COSAS.filter(c => c.rango <= r).map(c => c.id); }
function casaProxima(s) { const r = casaRango(s); return CASA_COSAS.find(c => c.rango > r) || null; }

/* Lo que se compra en la Tienda para el cuarto (compra:<id> en el ledger, como los títulos).
   Las cosas llegan puestas en su lugar y se pueden guardar; la pared se pinta de un color a la vez.
   fem: el nombre es femenino (para decir «guardada» o «guardado»).
   gamif.equipped.cuarto = { off: [ids guardados], pared: id, ts }: en la fusión gana el cambio más reciente */
const CUARTO_TIENDA = [
  { id: "cua-lampara", cosa: "lampara", fem: true, icon: "💡", nombre: "Lámpara de pie", costo: 300, desc: "En el rincón, junto a la ventana. Al atardecer y de noche llena el cuarto de luz cálida." },
  { id: "cua-globo", cosa: "globo", icon: "🌍", nombre: "Globo terráqueo", costo: 300, desc: "En su pie de madera, girando despacio. Para planear los viajes que vienen." },
  { id: "cua-guitarra", cosa: "guitarra", fem: true, icon: "🎸", nombre: "Guitarra", costo: 350, desc: "Apoyada en la pared, bajo el cuadro, lista para cuando haya ganas." },
  { id: "cua-sillon", cosa: "sillon", icon: "🛋️", nombre: "Sillón de lectura", costo: 450, desc: "Un sillón mullido con su cojín, mirando hacia la alfombra." },
  { id: "cua-tocadiscos", cosa: "tocadiscos", icon: "🎶", nombre: "Tocadiscos", costo: 500, desc: "En un mueble bajo, cerca de la alfombra. El disco gira y suelta notas." },
  { id: "cua-pecera", cosa: "pecera", fem: true, icon: "🐠", nombre: "Pecera", costo: 550, desc: "Con tres peces que nadan todo el día, sobre su mueble." },
  { id: "cua-telescopio", cosa: "telescopio", icon: "🔭", nombre: "Telescopio", costo: 650, desc: "Apunta a la ventana, para mirar las estrellas (y tus medallas en el cielo)." },
  { id: "cua-gato", cosa: "gato", icon: "🐈", nombre: "Un gato", costo: 900, desc: "Duerme la siesta en su cojín, frente a la alfombra, y mueve la cola." },
  { id: "par-salvia", pared: ["#C6DAB9", "#B6CDA7"], icon: "🎨", nombre: "Pared salvia", costo: 200, desc: "Un verde suave, a rayas, para todo el cuarto." },
  { id: "par-durazno", pared: ["#F7D0B4", "#EFC09F"], icon: "🎨", nombre: "Pared durazno", costo: 200, desc: "Un durazno tibio, a rayas, para todo el cuarto." },
  { id: "par-noche", pared: ["#3A4766", "#33405D"], icon: "🎨", nombre: "Pared azul noche", costo: 250, desc: "Un azul profundo, a rayas: el cuarto se vuelve más acogedor." },
];
function cuartoEq(s) {
  const c = s.gamif.equipped && s.gamif.equipped.cuarto;
  return c && typeof c === "object" ? { off: Array.isArray(c.off) ? c.off : [], pared: c.pared || null, ts: c.ts || 0 } : { off: [], pared: null, ts: 0 };
}
function cuartoTuyo(s, id) { return ((s.gamif && s.gamif.owned) || []).includes(id); }
/* Las cosas compradas que están puestas (los ids que usa el 3D) */
function cuartoPuestas(s) { const off = cuartoEq(s).off; return CUARTO_TIENDA.filter(it => it.cosa && cuartoTuyo(s, it.id) && !off.includes(it.id)).map(it => it.cosa); }
/* Los colores de la pared pintada (o null: el gris de siempre) */
function cuartoPared(s) { const id = cuartoEq(s).pared, it = CUARTO_TIENDA.find(x => x.id === id && x.pared); return it && cuartoTuyo(s, id) ? it.pared : null; }
function cuartoActivo(id) {
  const it = CUARTO_TIENDA.find(x => x.id === id); if (!it || !isOwned(id)) return false;
  const c = cuartoEq(STATE);
  return it.pared ? c.pared === id : !c.off.includes(id);
}
function guardarCuarto(s, c) { s.gamif.equipped = s.gamif.equipped || {}; s.gamif.equipped.cuarto = { off: c.off.slice(), pared: c.pared, ts: Date.now() }; }
/* Poner o guardar una cosa; pintar o volver al gris (lo llama equipItem de recompensas.js) */
function equipCuarto(it) {
  const c = cuartoEq(STATE);
  if (it.pared) c.pared = c.pared === it.id ? null : it.id;
  else c.off = c.off.includes(it.id) ? c.off.filter(x => x !== it.id) : c.off.concat(it.id);
  guardarCuarto(STATE, c);
}
/* Recién comprada: la pared se pinta de una vez (la cosa ya llega puesta) */
function cuartoComprado(it) {
  if (!it.pared) return;
  const c = cuartoEq(STATE); c.pared = it.id; guardarCuarto(STATE, c);
}

/* La repisa automática: oro, obsidiana, plata y bronce, las más nuevas primero; de cada serie
   solo su mejor nivel, y la insignia destacada va primero */
const CASA_PESO = { oro: 4, obsidiana: 3, plata: 2, bronce: 1 };
function repisaAuto(s) {
  const g = (s.gamif.badges || []).filter(id => findBadge(id)), dest = s.gamif.equipped && s.gamif.equipped.insignia;
  const ts = id => { const m = (s.gamif.ledger || []).find(x => x && x.id === "insignia:" + id && !x.anulado); return (m && m.ts) || 0; };
  const mejor = g.filter(id => { const b = findBadge(id); return !b.serie || !g.some(o => { const c = findBadge(o); return c.serie === b.serie && c.nivel > b.nivel; }); });
  const l = mejor.sort((a, b) => (CASA_PESO[cieloMetal(findBadge(b))] - CASA_PESO[cieloMetal(findBadge(a))]) || ts(b) - ts(a));
  if (dest && l.includes(dest)) l.unshift(...l.splice(l.indexOf(dest), 1));
  return l.slice(0, REPISA_MAX);
}
/* gamif.equipped.repisa = { ids, auto, ts }: en la fusión gana el cambio más reciente */
function repisaElegida(s) { const r = s.gamif.equipped && s.gamif.equipped.repisa; return r && !r.auto && Array.isArray(r.ids) ? r : null; }
function repisaIds(s) {
  const r = repisaElegida(s), g = s.gamif.badges || [];
  return r ? r.ids.filter(id => g.includes(id) && findBadge(id)).slice(0, REPISA_MAX) : repisaAuto(s);
}
function guardarRepisa(s, ids) {
  s.gamif.equipped = s.gamif.equipped || {};
  s.gamif.equipped.repisa = ids ? { ids: ids.slice(0, REPISA_MAX), auto: false, ts: Date.now() } : { ids: [], auto: true, ts: Date.now() };
}

/* -------- Elegir las medallas de la repisa -------- */
let REPISA_SEL = null;
function openRepisa() {
  if (!REPISA_SEL) REPISA_SEL = repisaIds(STATE).slice();
  const g = STATE.gamif.badges || [], orden = cieloOrden().filter(id => g.includes(id));
  const ficha = id => {
    const b = findBadge(id), on = REPISA_SEL.includes(id);
    return `<button type="button" class="med-chip repisa-sel__b${on ? " is-on" : ""}" data-action="repisa-toggle" data-id="${id}" aria-pressed="${on}">${medChip(b, escapeHtml(b.nombre))}</button>`;
  };
  openModal("Tu repisa", orden.length ? `
    <p class="text-sm muted">Elige hasta ${REPISA_MAX} medallas para que tu elefante las luzca en su cuarto. Llevas <b>${REPISA_SEL.length} de ${REPISA_MAX}</b>.</p>
    <div class="repisa-sel mt-16">${orden.map(ficha).join("")}</div>
    <div class="modal__cta onb-nav"><button class="btn-ghost" data-action="repisa-auto">Que elija sola</button>
      <button class="btn btn--primary" data-action="repisa-guardar">Guardar</button></div>`
    : `<p class="text-sm muted">Aún no ganas medallas. Cierra tu primer día y la primera, Primer Paso, llega a tu repisa.</p>
    <button class="btn btn--soft btn-block mt-16" data-action="close-modal">Entendido</button>`);
}
function repisaToggle(id) {
  if (!REPISA_SEL) return;
  const i = REPISA_SEL.indexOf(id);
  if (i >= 0) REPISA_SEL.splice(i, 1);
  else if (REPISA_SEL.length >= REPISA_MAX) return toast(`La repisa tiene ${REPISA_MAX} lugares: quita una primero`, true);
  else REPISA_SEL.push(id);
  openRepisa();
}
/* Desde la medalla de cerca: «Poner en tu repisa» o sacarla (la repisa pasa a ser elegida por ti) */
function repisaMedalla(id) {
  if (!(STATE.gamif.badges || []).includes(id)) return;
  const ids = repisaIds(STATE).slice(), i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1);
  else if (ids.length >= REPISA_MAX) return toast(`Tu repisa tiene ${REPISA_MAX} lugares: saca una desde Tu casa › Repisa`, true);
  else ids.unshift(id);
  guardarRepisa(STATE, ids); saveState();
  if (typeof CERCA !== "undefined" && CERCA.id && typeof pintarCerca === "function") pintarCerca();
  toast(i >= 0 ? "La sacaste de tu repisa" : "Está en tu repisa 🏅");
}
function repisaGuardar(auto) {
  guardarRepisa(STATE, auto ? null : REPISA_SEL || []);
  REPISA_SEL = null;
  saveState(); closeModal(); rerender();
  toast(auto ? "Tu elefante elige solo sus mejores medallas" : "Repisa lista 🏅");
}

/* -------- La ficha en la Tienda: con una foto de cómo queda en tu cuarto -------- */
function cuartoCard(it) {
  const tuyo = isOwned(it.id), activo = tuyo && cuartoActivo(it.id), pared = !!it.pared;
  const pie = !tuyo ? botonCompra(it.costo, `data-action="cos-buy" data-id="${it.id}"`)
    : `<button class="btn ${activo ? "btn--soft" : "btn--cian"} btn-block" data-action="cos-equip" data-id="${it.id}">${pared ? (activo ? "✓ Pintada — volver al gris" : "Pintar el cuarto") : (activo ? "✓ En el cuarto — guardar" : "Poner en el cuarto")}</button>`;
  const a = it.fem || pared ? "a" : "o", la = it.fem ? "la" : "lo";
  const estado = tuyo ? (pared ? (activo ? "Es tuya · el cuarto está pintado así" : "Es tuya · píntalo cuando quieras")
      : activo ? `Es tuy${a} · está en el cuarto` : `Es tuy${a} · guardad${a}: pon${la} cuando quieras`)
    : `${it.costo} ⭐ · ${pared ? "se pinta al comprarla y la cambias cuando quieras" : `llega puest${a} en su lugar`}`;
  return `<div class="card cua-card" data-cua="${it.id}">
    <figure class="cua-vista${pared ? " cua-vista--pared" : ""}" id="cuaVista"${pared ? ` style="--p1:${it.pared[0]};--p2:${it.pared[1]}"` : ""}>
      <span class="cua-vista__ico" aria-hidden="true">${pared ? "" : it.icon}</span>
      <figcaption class="cua-vista__pie" hidden>${tuyo ? "Tu cuarto, ahora" : "Así quedaría en el cuarto de tu elefante"}</figcaption>
    </figure>
    <p class="text-sm mt-8">${escapeHtml(it.desc)}</p>
    <div class="text-xs muted mt-4">${estado}</div>
    <div class="mt-8">${pie}</div>
    ${tuyo ? `<button class="btn-ghost btn-block mt-8" data-action="cuarto-ver">🏠 Ver el cuarto</button>` : ""}
  </div>`;
}
/* La foto: el cuarto de verdad (con lo que ya tiene) y esta cosa puesta, o pintado de este color */
async function cuartoVista(id) {
  const it = CUARTO_TIENDA.find(x => x.id === id);
  if (!it || CIELO_ESTADO.sin3d || !cieloEscenas() || !document.getElementById("cuaVista")) return;
  try {
    const m = await cieloMotor();
    const el = document.getElementById("cuaVista"), card = el && el.closest("[data-cua]");
    if (!el || !card || card.dataset.cua !== id || !m.fotoCuarto) return;
    const b = el.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1);
    const url = m.fotoCuarto({ cosa: it.cosa || null, pared: it.pared || null }, Math.round(b.width * k), Math.round(b.height * k));
    if (!url) return;
    const img = new Image(); img.className = "cua-vista__img"; img.alt = `${it.nombre} en el cuarto de tu elefante`;
    img.onload = () => { el.classList.add("is-foto"); el.querySelector(".cua-vista__pie").hidden = false; };
    img.src = url; el.insertBefore(img, el.firstChild);
  } catch (e) {}
}
/* Ver el cuarto: a pantalla completa (sin 3D, como página) */
function cuartoVer() {
  closeModal();
  if (!lugarEntrar("cuarto")) go("cuarto");
}
/* Decorar: el catálogo del cuarto (muebles y paredes) se abre aquí mismo, en tu casa. Cada ficha muestra
   cómo queda en su cuarto y se compra, se pone o se guarda desde ahí. */
function cuartoDecorar() {
  const items = tiendaTodos().filter(i => i.cat === "cuarto");
  TIENDA_FICHA = null;
  openModal("Decorar tu cuarto", `<p class="text-sm muted">Muebles y paredes para el cuarto de tu elefante. Lo que compras se puede guardar y volver a poner cuando quieras. Tienes <b>${(STATE.gamif.puntos || 0).toLocaleString("es-CL")} ⭐</b>.</p>
    <div class="fichas mt-16">${items.map(fichaHtml).join("")}</div>`);
  document.getElementById("modal").classList.add("modal--hoja");
}

function casaAria(cur, cosas, total, compras, nombres) {
  return `El cuarto de tu elefante (${cur.nombre}), donde tu elefante ${nombreElefante()} ${eleActividadAhora(STATE).txt}: ${cosas.length + 1} de ${total} cosas.${compras.length ? " De la Tienda: " + compras.map(it => it.nombre.toLowerCase()).join(", ") + "." : ""}${nombres ? " En la repisa: " + nombres + "." : ""}`;
}

/* -------- Tu cuarto a pantalla completa (ruta #cuarto) -------- */
function renderCuarto() {
  const s = STATE, { cur } = rankFor(s.gamif.xp || 0), cosas = casaCosas(s), prox = casaProxima(s), ids = repisaIds(s);
  const total = CASA_COSAS.length + 1, compras = CUARTO_TIENDA.filter(it => it.cosa && cuartoPuestas(s).includes(it.cosa));
  const { sig } = etapaElefante(s.gamif.xp || 0), faltaXp = prox ? RANGOS[prox.rango].min - (s.gamif.xp || 0) : 0;
  const nombres = ids.map(id => findBadge(id).nombre).join(", ");
  const chip = id => { const b = findBadge(id); return `<button class="med-chip" data-action="ins-ver" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; };
  const ahora = eleActividadAhora(s);
  const cab = `<div class="hoja__t">🐘 Tu elefante · ${eleEstado().tipo ? nombreElefante() : "¡elígelo!"}</div>
    <div class="hoja__ahora" id="cuaAhora" aria-live="polite">${ahora.ico} Ahora ${ahora.txt}</div>
    <div class="hoja__s">${eleTexto()}</div>
    <div class="hoja__bts">${eleEstado().tipo ? "" : `<button class="btn btn--primary" data-action="ele-elegir">Elegir mi elefante</button>`}
      <button class="hb" data-action="elefante-open" data-v="ropa">👕 Vestir</button><button class="hb" data-action="elefante-open" data-v="tipo">🐘 Tipos</button>
      <button class="hb" data-action="cuarto-decorar">🛍️ Decorar</button><button class="hb" data-action="repisa-elegir">🏅 Repisa</button></div>`;
  const cuerpo = `${sig ? `<div class="hoja__k">Hacia ${sig.n}</div><div class="bar"><div class="bar__fill" style="width:${eleProgreso()}%"></div></div>` : ""}
    <div class="hoja__k">Tu repisa</div>
    <div class="recibo__meds-l">${ids.length ? ids.map(chip).join("") : `<span class="text-sm muted">Vacía por ahora: tu primera medalla llega al cerrar tu primer día.</span>`}</div>
    <div class="hoja__k">Tu cuarto · ${cosas.length + 1} de ${total}</div>
    <p class="text-sm muted">${prox ? `Próximo: ${prox.ico} ${prox.n} al llegar a ${RANGOS[prox.rango].nombre} (faltan ${faltaXp.toLocaleString("es-CL")} XP).` : "¡Completo! 👑 Tiene todo lo que da el rango."}</p>
    ${compras.length ? `<div class="hoja__k">Lo que le compraste</div><div class="fila-chips">${compras.map(it => `<span class="chip">${it.icon} ${escapeHtml(it.nombre)}</span>`).join("")}</div>` : `<p class="text-sm muted">Con 🛍️ Decorar le compras sillón, lámpara, pecera, telescopio, un gato y más para su cuarto.</p>`}
    <p class="text-xs muted hoja__pista">Tu elefante va de un rincón a otro: mira por la ventana, admira sus medallas y, con lo que le compres, riega, baila o juega con el gato. Tócalo y reacciona. Arrastra para mirar el cuarto y pellizca para acercarte.</p>`;
  if (CIELO_ESTADO.sin3d) return lugarPlanoHtml({ titulo: "Tu casa", sub: `${escapeHtml(cur.nombre)} · ${cosas.length + 1} de ${total}`, dibujo: elefanteSVG({ anim: false }), cab, cuerpo });
  return lugarHtml({
    lienzo: "lugarLienzo", titulo: "Tu casa", sub: `${escapeHtml(cur.nombre)} · ${cosas.length + 1} de ${total}${compras.length ? ` · ${compras.length} de la Tienda` : ""}`,
    chip: `⭐ ${(s.gamif.puntos || 0).toLocaleString("es-CL")}`, aria: casaAria(cur, cosas, total, compras, nombres),
    hojaAria: "Tu elefante y tu cuarto", carga: "Arreglando el cuarto…", extra: `<div class="cielo__etq" id="casaEtq" hidden></div>`, cab, cuerpo,
  });
}
