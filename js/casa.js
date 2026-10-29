/* ============================================================
   RUMBO · La casa del elefante (Recompensas › Progreso)
   El cuarto de tu elefante se llena con tu rango y en su repisa luce las medallas
   que elijas (o las mejores, si no eliges). Tocar una medalla de la repisa la abre
   de cerca, como en el cielo (cielo.js). El 3D vive en cielo-3d.js; sin WebGL queda
   tu elefante de siempre y la repisa como una fila de medallas.
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
    const f = m.fotoCuarto({ cosa: it.cosa || null, pared: it.pared || null }, Math.round(b.width * k), Math.round(b.height * k));
    if (!f) return;
    const img = new Image(); img.className = "cua-vista__img"; img.alt = `${it.nombre} en el cuarto de tu elefante`;
    img.onload = () => { el.classList.add("is-foto"); el.querySelector(".cua-vista__pie").hidden = false; };
    img.src = f.url; el.insertBefore(img, el.firstChild);
    if (f.ancla) {   // el cuarto entero: tu elefante, sobre su alfombra
      const e = document.createElement("div"), a = f.ancla;
      e.className = "cua-vista__ele" + (a.noche ? " is-noche" : ""); e.setAttribute("aria-hidden", "true");
      e.style.left = a.x * 100 + "%"; e.style.top = a.y * 100 + "%"; e.style.width = a.ancho * 100 + "%";
      e.innerHTML = elefanteSVG({ anim: false }); el.insertBefore(e, img.nextSibling);
    }
  } catch (e) {}
}
function cuartoVer() {
  closeModal();
  const ir = () => { const c = document.querySelector(".casa-card"); if (c) c.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "center" }); };
  if (CURRENT === "recompensas") ir(); else { go("recompensas"); setTimeout(ir, 120); }
}
function cuartoDecorar() {
  go("tienda");
  setTimeout(() => { const s = document.getElementById("tienda-cuarto"); if (s) s.scrollIntoView({ behavior: "auto", block: "start" }); }, 120);
}

/* -------- La tarjeta de Progreso: el cuarto, tu elefante y lo que viene -------- */
function casaCardHtml() {
  const s = STATE, { cur } = rankFor(s.gamif.xp || 0), cosas = casaCosas(s), prox = casaProxima(s), ids = repisaIds(s);
  const T = TIPOS_ELEFANTE[tipoElefante()], total = CASA_COSAS.length + 1;
  const nombres = ids.map(id => findBadge(id).nombre).join(", ");
  const compras = CUARTO_TIENDA.filter(it => it.cosa && cuartoPuestas(s).includes(it.cosa));
  const faltaXp = prox ? RANGOS[prox.rango].min - (s.gamif.xp || 0) : 0;
  const repisa = ids.length
    ? ids.map(id => { const b = findBadge(id); return `<button class="med-chip" data-action="ins-ver" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; }).join("")
    : `<span class="text-sm muted">Vacía por ahora: tu primera medalla llega al cerrar tu primer día.</span>`;
  return `<div class="card ele-card casa-card${CIELO_ESTADO.sin3d ? " is-sin3d" : ""}" data-tour="elefante">
    <section class="casa" id="casa" data-gesto aria-label="El cuarto de tu elefante">
      <div class="casa__lienzo" id="casaLienzo" role="img" aria-label="El cuarto de tu elefante (${escapeAttr(cur.nombre)}): ${cosas.length + 1} de ${total} cosas.${compras.length ? " De la Tienda: " + escapeAttr(compras.map(it => it.nombre.toLowerCase()).join(", ")) + "." : ""}${nombres ? " En la repisa: " + escapeAttr(nombres) + "." : ""}"></div>
      <div class="casa__ele ele-toca${T.papel ? " papel" : ""}" id="casaEle" data-action="ele-toca" role="button" tabindex="0" aria-label="Tu elefante: ${escapeAttr(nombreElefante())}">${elefanteSVG()}</div>
      <div class="cielo__etq" id="casaEtq" hidden></div>
      <div class="casa__carga" aria-hidden="true">Arreglando el cuarto…</div>
    </section>
    ${eleFichaHtml()}
    <div class="casa__repisa"><span class="recibo__k">Tu repisa</span><div class="recibo__meds-l">${repisa}</div></div>
    <div class="casa__pie">
      <span class="text-xs muted">Tu cuarto · ${cosas.length + 1} de ${total}${prox ? ` · Próximo: ${prox.ico} ${prox.n} al llegar a ${RANGOS[prox.rango].nombre} (faltan ${faltaXp.toLocaleString("es-CL")} XP)` : " · ¡Completo! 👑"}</span>
      <span class="casa__btns"><button class="btn-ghost" data-action="cuarto-decorar" style="padding:4px 10px">🛍️ Decorar</button>
        <button class="btn-ghost" data-action="repisa-elegir" style="padding:4px 10px">🏅 Repisa</button></span>
    </div>
  </div>`;
}
