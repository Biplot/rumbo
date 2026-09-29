/* ============================================================
   RUMBO · Tienda en fichas
   Cada artículo es una ficha chica (ícono, nombre y precio). Al tocarla se abre su detalle,
   que es la misma tarjeta de siempre (con su botón de comprar o equipar): la lógica de compra
   no cambia. Primero "Te alcanza"; "Lo que tengo" muestra solo lo tuyo.
   ============================================================ */
let TIENDA_MIOS = false, TIENDA_FICHA = null;

/* Todos los artículos con una forma común: { key, cat, icon, nombre, costo, estado, attr, detalle(), accion? } */
function tiendaItems() {
  const saldo = STATE.gamif.puntos || 0, items = [];
  const estado = (tuyo, costo, bloqueado) => tuyo ? "tuyo" : bloqueado ? "bloqueado" : saldo >= costo ? "ok" : "falta";
  CONSUMIBLES.forEach(c => { const n = inventario(STATE, c.id);
    items.push({ key: "util:" + c.id, cat: "utiles", icon: c.icon, nombre: c.nombre, costo: c.costo, estado: estado(false, c.costo), tienes: n, attr: `data-util="${c.id}"`, detalle: () => utilCard(c) }); });
  FUNCIONES.forEach(f => { const fid = "fun:" + f.id;
    items.push({ key: fid, cat: "funciones", icon: f.icon, nombre: f.nombre, costo: f.costo, estado: estado(funcion(claveFuncion(fid)), f.costo), attr: `data-fun="${fid}"`, detalle: () => funcionCard(fid, f) }); });
  items.push({ key: "plantillas", cat: "funciones", icon: "📋", nombre: "Plantillas de rutina", costo: 200, precioTxt: "200 ⭐ c/u",
    estado: PLANTILLAS.every(p => funcion("plantilla-" + p.id)) ? "tuyo" : estado(false, 200), accion: `data-action="plantillas-open"` });
  PACKS_ICONOS.forEach(p => items.push({ key: "pack:" + p.id, cat: "funciones", icon: p.icon, nombre: "Íconos · " + p.nombre, costo: p.costo || 150,
    estado: estado(funcion("iconos-" + p.id), p.costo || 150), attr: `data-pack="${p.id}"`,
    detalle: () => funcionCard("iconos:" + p.id, { icon: p.icon, nombre: "Íconos · " + p.nombre, costo: p.costo || 150, desc: `24 íconos nuevos para tus hábitos: ${p.iconos.slice(0, 12).join(" ")}…`, donde: "Hábitos → ✎ editar un hábito" }) }));
  THEMES.forEach(t => { const tuyo = themeOwned(t.id);
    items.push({ key: "tema:" + t.id, cat: "temas", nombre: t.nombre, costo: t.costo, estado: STATE.settings.theme === t.id ? "equipado" : estado(tuyo, t.costo),
      tema: t, accion: `data-action="tema-preview" data-theme="${t.id}"` }); });
  [...TITULOS, ...DETALLES].forEach(it => {
    const bloq = it.requiere && !requisitoTitulo(it);
    items.push({ key: "cos:" + it.id, cat: "estilo", icon: it.icon, nombre: it.nombre, costo: it.costo, estado: isEquipped(it) ? "equipado" : estado(isOwned(it.id), it.costo, bloq),
      bloqueoTxt: bloq ? "Requiere insignia" : "", attr: `data-est="${it.id}"`, detalle: () => `<div data-est="${it.id}">${cosmeticCard(it)}</div>` });
  });
  COSMETICOS.forEach(it => {
    items.push({ key: "cos:" + it.id, cat: "efectos", icon: it.icon, nombre: it.nombre, costo: it.costo, estado: isOwned(it.id) && cosActivo(it.id) ? "equipado" : estado(isOwned(it.id), it.costo, !!it.rango),
      bloqueoTxt: it.rango ? "Rango Élite" : "", attr: `data-cos="${it.id}"`, detalle: () => cosmeticoCard(it) });
  });
  const faltan = PRENDAS_ELEFANTE.filter(p => !p.gana && !tienePrenda(p)).length;
  items.push({ key: "ele:ropa", cat: "elefante", icon: "👕", nombre: "Ropa para tu elefante", precioTxt: faltan ? `${faltan} por comprar` : "¡Todas!", estado: faltan ? "ok" : "tuyo", accion: `data-action="elefante-open" data-v="ropa"` });
  items.push({ key: "ele:tipos", cat: "elefante", icon: "🐘", nombre: "Tipos de elefante", precioTxt: "Se ganan", estado: "ok", accion: `data-action="elefante-open" data-v="tipo"` });
  return items;
}
const TIENDA_CATS = [["utiles", "Útiles"], ["funciones", "Funciones"], ["temas", "Temas"], ["estilo", "Títulos y detalles"], ["efectos", "Efectos"], ["elefante", "Elefante"]];

function fichaHtml(it) {
  const precio = it.estado === "equipado" ? "En uso" : it.estado === "tuyo" ? (it.cat === "elefante" ? it.precioTxt : "Es tuyo")
    : it.estado === "bloqueado" ? "🔒 " + (it.bloqueoTxt || "Bloqueado") : (it.precioTxt || it.costo + " ⭐");
  const icono = it.tema ? `<span class="ficha__ico ficha__ico--tema" style="background:${it.tema.bg}"><i style="background:${it.tema.cta}"></i><i style="background:${it.tema.accent}"></i></span>`
    : `<span class="ficha__ico">${it.icon}</span>`;
  return `<button class="ficha is-${it.estado}${it.tema ? " ficha--tema" : ""}" ${it.accion || `data-action="tienda-ficha" data-key="${escapeAttr(it.key)}"`} ${it.attr || ""}>
    ${it.estado === "tuyo" || it.estado === "equipado" ? `<span class="ficha__ok" aria-hidden="true">✓</span>` : ""}
    ${icono}<span class="ficha__n">${escapeHtml(it.nombre)}</span><span class="ficha__p">${precio}${it.tienes ? ` · tienes ${it.tienes}` : ""}</span></button>`;
}

function renderTienda() {
  const saldo = STATE.gamif.puntos || 0, todos = tiendaItems();
  const lista = TIENDA_MIOS ? todos.filter(i => i.estado === "tuyo" || i.estado === "equipado") : todos;
  const alcanza = TIENDA_MIOS ? [] : todos.filter(i => i.estado === "ok" && i.costo && i.cat !== "elefante" && i.cat !== "utiles").sort((a, b) => b.costo - a.costo).slice(0, 6);
  const grupo = (id, titulo) => { const xs = lista.filter(i => i.cat === id);
    return xs.length ? `<section id="tienda-${id}" class="tienda-sec"><div class="section-title">${titulo}</div><div class="fichas">${xs.map(fichaHtml).join("")}</div></section>` : ""; };
  return `
  ${tabsRecompensas()}
  <div class="tienda-saldo"><div><div class="text-sm muted">Tu saldo</div><b>${saldo} ⭐</b></div>
    <button class="chip-f${TIENDA_MIOS ? " is-on" : ""}" data-action="tienda-mios">${TIENDA_MIOS ? "✓ Lo que tengo" : "Ver lo que tengo"}</button></div>
  <nav class="tienda-cats" aria-label="Categorías de la tienda">
    ${TIENDA_CATS.map(([id, l]) => `<button class="tienda-cat" data-action="tienda-ir" data-id="${id}">${l}</button>`).join("")}
  </nav>
  ${alcanza.length ? `<section class="tienda-sec"><div class="section-title">✨ Te alcanza</div><div class="fichas">${alcanza.map(fichaHtml).join("")}</div></section>` : ""}
  ${TIENDA_CATS.map(([id, l]) => grupo(id, l)).join("")}
  ${TIENDA_MIOS && !lista.length ? `<div class="card mt-16"><div class="empty">Todavía no tienes nada de la tienda. Ganas ⭐ abriendo y cerrando tus días.</div></div>` : ""}
  <p class="text-xs muted mt-24">Ganas ⭐ usando la app: cerrar el día, hábitos, rituales y objetivos.</p>`;
}

/* Detalle de una ficha: la tarjeta de siempre, en una hoja */
function openFicha(key) {
  const it = tiendaItems().find(x => x.key === key);
  if (!it || !it.detalle) return;
  TIENDA_FICHA = key;
  openModal(it.nombre, `<div class="ficha-detalle">${it.detalle()}</div>`);
  document.getElementById("modal").classList.add("modal--hoja");
}
/* Después de comprar o equipar desde la hoja: se vuelve a dibujar con el estado nuevo */
function refrescarFicha() {
  if (!TIENDA_FICHA || document.getElementById("modalOverlay").hidden) { TIENDA_FICHA = null; return; }
  if (CURRENT === "tienda") openFicha(TIENDA_FICHA);
}
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-action]");
  if (el && el.closest(".ficha-detalle") && ["util-buy", "fun-buy", "cos-buy", "cos-equip"].includes(el.dataset.action)) setTimeout(refrescarFicha, 0);
});
