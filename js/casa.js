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

/* -------- La tarjeta de Progreso: el cuarto, tu elefante y lo que viene -------- */
function casaCardHtml() {
  const s = STATE, { cur } = rankFor(s.gamif.xp || 0), cosas = casaCosas(s), prox = casaProxima(s), ids = repisaIds(s);
  const T = TIPOS_ELEFANTE[tipoElefante()], total = CASA_COSAS.length + 1;
  const nombres = ids.map(id => findBadge(id).nombre).join(", ");
  const faltaXp = prox ? RANGOS[prox.rango].min - (s.gamif.xp || 0) : 0;
  const repisa = ids.length
    ? ids.map(id => { const b = findBadge(id); return `<button class="med-chip" data-action="ins-ver" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; }).join("")
    : `<span class="text-sm muted">Vacía por ahora: tu primera medalla llega al cerrar tu primer día.</span>`;
  return `<div class="card ele-card casa-card${CIELO_ESTADO.sin3d ? " is-sin3d" : ""}" data-tour="elefante">
    <section class="casa" id="casa" data-gesto aria-label="El cuarto de tu elefante">
      <div class="casa__lienzo" id="casaLienzo" role="img" aria-label="El cuarto de tu elefante (${escapeAttr(cur.nombre)}): ${cosas.length + 1} de ${total} cosas.${nombres ? " En la repisa: " + escapeAttr(nombres) + "." : ""}"></div>
      <div class="casa__ele ele-toca${T.papel ? " papel" : ""}" id="casaEle" data-action="ele-toca" role="button" tabindex="0" aria-label="Tu elefante: ${escapeAttr(nombreElefante())}">${elefanteSVG()}</div>
      <div class="cielo__etq" id="casaEtq" hidden></div>
      <div class="casa__carga" aria-hidden="true">Arreglando el cuarto…</div>
    </section>
    ${eleFichaHtml()}
    <div class="casa__repisa"><span class="recibo__k">Tu repisa</span><div class="recibo__meds-l">${repisa}</div></div>
    <div class="casa__pie">
      <span class="text-xs muted">Tu cuarto · ${cosas.length + 1} de ${total}${prox ? ` · Próximo: ${prox.ico} ${prox.n} al llegar a ${RANGOS[prox.rango].nombre} (faltan ${faltaXp.toLocaleString("es-CL")} XP)` : " · ¡Completo! 👑"}</span>
      <button class="btn-ghost" data-action="repisa-elegir" style="padding:4px 10px">🏅 Repisa</button>
    </div>
  </div>`;
}
