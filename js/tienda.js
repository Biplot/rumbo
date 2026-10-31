/* ============================================================
   RUMBO · Tienda en fichas (v95: por para qué sirve)
   La Tienda vende; lo que ya tienes se usa donde corresponde: temas, títulos, marcos y efectos
   en Cuenta › Apariencia; la ropa y los muebles de tu elefante, en Tu casa (Vestir y Decorar).
   Dos secciones: Para tu día (herramientas) y Para tu estilo (temas, íconos, efectos y perfil).
   Cada artículo es una ficha chica (ícono, nombre y precio); al tocarla se abre su detalle, que es
   la misma tarjeta de siempre (con su botón de comprar o equipar).
   ============================================================ */
let TIENDA_FICHA = null, TIENDA_SEC = "dia";
const TIENDA_ABIERTOS = new Set();   // grupos con «Ver todo» abierto (los demás muestran sus primeras fichas)
const TIENDA_POR_GRUPO = 6;

/* Todos los artículos con una forma común: { key, cat, sub, icon, nombre, costo, estado, attr, detalle(), accion? }
   cat: "dia" | "estilo" | "cuarto" (el cuarto se decora desde Tu casa) */
function tiendaTodos() {
  const saldo = STATE.gamif.puntos || 0, items = [];
  const estado = (tuyo, costo, bloqueado) => tuyo ? "tuyo" : bloqueado ? "bloqueado" : saldo >= costo ? "ok" : "falta";
  // Para tu día
  FUNCIONES.forEach(f => { const fid = "fun:" + f.id;
    items.push({ key: fid, cat: "dia", sub: "herramientas", icon: f.icon, nombre: f.nombre, costo: f.costo, estado: estado(funcion(claveFuncion(fid)), f.costo), attr: `data-fun="${fid}"`, detalle: () => funcionCard(fid, f) }); });
  items.push({ key: "plantillas", cat: "dia", sub: "herramientas", icon: "📋", nombre: "Plantillas de rutina", costo: 200, precioTxt: "200 ⭐ c/u",
    estado: PLANTILLAS.every(p => funcion("plantilla-" + p.id)) ? "tuyo" : estado(false, 200), accion: `data-action="plantillas-open"` });
  CONSUMIBLES.forEach(c => { const n = inventario(STATE, c.id);
    items.push({ key: "util:" + c.id, cat: "dia", sub: "utiles", icon: c.icon, nombre: c.nombre, costo: c.costo, estado: estado(false, c.costo), tienes: n, attr: `data-util="${c.id}"`, detalle: () => utilCard(c) }); });
  // Para tu estilo
  TEMA_FAMILIAS.forEach(f => { const activa = familiaDeTema(STATE.settings.theme) === f;
    items.push({ key: "tema:" + f.id, cat: "estilo", sub: "temas", nombre: f.nombre, costo: f.costo, precioTxt: f.costo ? "" : "Gratis",
      estado: activa ? "equipado" : estado(familiaTuya(f), f.costo), familia: f, accion: `data-action="tema-preview" data-theme="${f.id}"` }); });
  PACKS_ICONOS.forEach(p => items.push({ key: "pack:" + p.id, cat: "estilo", sub: "iconos", icon: p.icon, iconoHtml: icoHab(p.icon, 26), nombre: p.nombre, costo: p.costo || 150,
    estado: estado(funcion("iconos-" + p.id), p.costo || 150), attr: `data-pack="${p.id}"`,
    detalle: () => funcionCard("iconos:" + p.id, { icon: icoHab(p.icon, 24), nombre: "Íconos · " + p.nombre, costo: p.costo || 150, desc: `24 íconos de línea nuevos para tus hábitos:<span class="pack-vista">${p.iconos.slice(0, 12).map(e => icoHab(e, 20)).join("")}</span>`, donde: "Hábitos → ✎ editar un hábito" }) }));
  const cosEstado = it => isOwned(it.id) && cosActivo(it.id) ? "equipado" : estado(isOwned(it.id), it.costo, !!it.rango);
  COSMETICOS.forEach(it => {
    const sub = it.grupo === "marco" ? "perfil" : it.grupo === "plantilla" ? "informe" : it.grupo === "album" ? "album" : it.grupo === "agua" || it.grupo === "sabor" ? "agua" : "terminar";
    const iconoHtml = (it.key === "agua" || it.key === "sabor" || it.key === "acuario") && typeof aguaFichaHtml === "function" ? aguaFichaHtml(it) : undefined;
    items.push({ key: "cos:" + it.id, cat: "estilo", sub, icon: it.icon, iconoHtml, nombre: it.nombre, costo: it.costo, estado: cosEstado(it),
      bloqueoTxt: it.rango ? "Rango Élite" : "", attr: `data-cos="${it.id}"`, detalle: () => cosmeticoCard(it) });
  });
  [...TITULOS, ...DETALLES].forEach(it => {
    const bloq = it.requiere && !requisitoTitulo(it), sub = it.key === "confeti" ? "terminar" : "perfil";
    items.push({ key: "cos:" + it.id, cat: "estilo", sub, icon: it.icon, nombre: it.nombre, costo: it.costo, estado: isEquipped(it) ? "equipado" : estado(isOwned(it.id), it.costo, bloq),
      bloqueoTxt: bloq ? "Requiere insignia" : "", attr: `data-est="${it.id}"`, detalle: () => `<div data-est="${it.id}">${cosmeticCard(it)}</div>` });
  });
  // El cuarto de tu elefante: se decora desde Tu casa
  CUARTO_TIENDA.forEach(it => {
    items.push({ key: "cos:" + it.id, cat: "cuarto", sub: "cuarto", icon: it.icon, pared: it.pared, nombre: it.nombre, costo: it.costo, estado: isOwned(it.id) && cuartoActivo(it.id) ? "equipado" : estado(isOwned(it.id), it.costo),
      enUsoTxt: it.pared ? "Pintada" : "En el cuarto", tuyoTxt: it.pared ? "Es tuya" : it.fem ? "Guardada" : "Guardado", attr: `data-cua="${it.id}"`, detalle: () => cuartoCard(it), alAbrir: () => cuartoVista(it.id) });
  });
  return items;
}
const esTuyo = it => it.estado === "tuyo" || it.estado === "equipado";
/* Lo que se vende: lo que no tienes (los útiles se compran una y otra vez) */
function tiendaItems() { return tiendaTodos().filter(i => i.cat !== "cuarto" && (i.sub === "utiles" || !esTuyo(i))); }
const TIENDA_SECS = [["dia", "Para tu día"], ["estilo", "Para tu estilo"]];
const TIENDA_SUBS = {
  dia: [["herramientas", "Herramientas"], ["utiles", "Útiles"]],
  estilo: [["temas", "Temas"], ["iconos", "Íconos de hábitos"], ["terminar", "Al terminar algo"], ["perfil", "Tu perfil"], ["album", "Tu álbum"], ["agua", "Tu agua"], ["informe", "Plantillas del informe"]],
};

/* Miniatura de un tema: mitad su día y mitad su noche (si tiene los dos), con su botón y su acento */
function temaMiniHtml(f, clase = "ficha__ico ficha__ico--tema") {
  const d = THEMES.find(t => t.id === (f.solo || f.dia)), n = THEMES.find(t => t.id === (f.solo || f.noche));
  return `<span class="${clase}" style="background:${f.solo ? d.bg : `linear-gradient(90deg, ${d.bg} 50%, ${n.bg} 50%)`}"><i style="background:${d.cta}"></i><i style="background:${n.accent}"></i></span>`;
}
function fichaHtml(it) {
  const precio = it.estado === "equipado" ? (it.enUsoTxt || "En uso") : it.estado === "tuyo" ? (it.tuyoTxt || "Es tuyo")
    : it.estado === "bloqueado" ? "🔒 " + (it.bloqueoTxt || "Bloqueado") : (it.precioTxt || it.costo + " ⭐");
  const icono = it.familia ? temaMiniHtml(it.familia)
    : it.pared ? `<span class="ficha__ico ficha__ico--pared" style="--p1:${it.pared[0]};--p2:${it.pared[1]}" aria-hidden="true"></span>`
    : `<span class="ficha__ico">${it.iconoHtml || it.icon}</span>`;
  const modos = it.familia ? `<span class="ficha__modos">${it.familia.solo ? (it.familia.modo === "dia" ? "De día" : "De noche") : "Día · Noche · Auto"}</span>` : "";
  return `<button class="ficha is-${it.estado}${it.familia ? " ficha--tema" : ""}" ${it.accion || `data-action="tienda-ficha" data-key="${escapeAttr(it.key)}"`} ${it.attr || ""}>
    ${esTuyo(it) ? `<span class="ficha__ok" aria-hidden="true">✓</span>` : ""}
    ${icono}<span class="ficha__n">${escapeHtml(it.nombre)}</span>${modos}<span class="ficha__p">${precio}${it.tienes ? ` · tienes ${it.tienes}` : ""}</span></button>`;
}

/* La Tienda, dentro de Recompensas: Para tu día · Para tu estilo */
function tiendaHtml() {
  const venta = tiendaItems(), sec = TIENDA_SECS.some(([id]) => id === TIENDA_SEC) ? TIENDA_SEC : "dia";
  const deSec = venta.filter(i => i.cat === sec);
  // Lo que te alcanza va primero (sin repetirlo más abajo)
  const alcanza = deSec.filter(i => i.estado === "ok" && i.costo && i.sub !== "utiles").sort((a, b) => b.costo - a.costo).slice(0, 3);
  const resto = deSec.filter(i => !alcanza.includes(i));
  const grupo = ([id, titulo]) => {
    const xs = resto.filter(i => i.sub === id); if (!xs.length) return "";
    const todos = TIENDA_ABIERTOS.has(id) || xs.length <= TIENDA_POR_GRUPO + 1, vis = todos ? xs : xs.slice(0, TIENDA_POR_GRUPO);
    return `<section id="tienda-${id}" class="tienda-sec"><div class="section-title">${titulo}</div><div class="fichas">${vis.map(fichaHtml).join("")}</div>
      ${todos ? "" : `<button type="button" class="btn-ghost tienda-mas" data-action="tienda-mas" data-v="${id}">Ver todo (${xs.length})</button>`}</section>`;
  };
  const cuerpo = TIENDA_SUBS[sec].map(grupo).join("");
  return `<section class="tienda" id="tienda" aria-label="Tienda">
    <div class="tienda__cab"><h2 class="section-title tienda__t">Tienda</h2>
      <div class="seg tienda-seg" role="tablist" aria-label="Secciones de la Tienda">${TIENDA_SECS.map(([id, l]) =>
        `<button role="tab" aria-selected="${id === sec}" class="${id === sec ? "is-active" : ""}" data-action="tienda-sec" data-v="${id}">${l}</button>`).join("")}</div></div>
    ${alcanza.length ? `<section class="tienda-sec"><div class="section-title">✨ Te alcanza</div><div class="fichas">${alcanza.map(fichaHtml).join("")}</div></section>` : ""}
    ${cuerpo || (alcanza.length ? "" : `<div class="card mt-16"><div class="empty">Ya tienes todo lo de esta sección. 🎉</div></div>`)}
    <div class="tienda-links">
      <button type="button" class="tienda-link tienda-elefante" data-action="lugar-entrar" data-ruta="cuarto">${iconoLinea("inicio", 20)}
        <span><b>Ropa y muebles para tu elefante</b><small>Se compran en Tu casa, viendo cómo quedan</small></span>${iconoLinea("chevron", 16)}</button>
      <button type="button" class="tienda-link" data-route="apariencia">${iconoLinea("personalizar", 20)}
        <span><b>Lo que ya tienes</b><small>Temas, títulos, marcos y efectos se eligen en Cuenta › Apariencia</small></span>${iconoLinea("chevron", 16)}</button>
    </div>
    <p class="text-xs muted mt-16">Ganas ⭐ usando la app: cerrar el día, hábitos, rituales y objetivos.</p>
  </section>`;
}

/* -------- Cuenta › Apariencia: lo que ya tienes, para usarlo -------- */
function temaFamiliaHtml(f) {
  const t = STATE.settings.theme, activa = familiaDeTema(t) === f;
  const modos = f.solo
    ? `<button class="btn btn--soft fam-card__usar" data-action="set-theme" data-theme="${f.solo}" ${activa ? 'aria-pressed="true"' : ""}>${activa ? "✓ En uso" : "Usar"}</button>`
    : `<div class="seg fam-card__modos" role="group" aria-label="Modo de ${escapeAttr(f.nombre)}">${[["auto", "Auto"], ["dia", "Día"], ["noche", "Noche"]].map(([k, l]) =>
        `<button class="${t === f[k] ? "is-active" : ""}" data-action="set-theme" data-theme="${f[k]}" aria-pressed="${t === f[k]}">${l}</button>`).join("")}</div>`;
  return `<div class="fam-card${activa ? " is-activa" : ""}" data-familia="${f.id}">
    <button type="button" class="fam-card__prev" data-action="tema-preview" data-theme="${f.id}" aria-label="Ver ${escapeAttr(f.nombre)}">${temaMiniHtml(f, "fam-card__mini")}</button>
    <div class="fam-card__tx"><b>${escapeHtml(f.nombre)}</b><small>${activa ? "En uso" : f.solo ? (f.modo === "dia" ? "De día" : "De noche") : "Día, noche o automático"}</small></div>
    ${modos}</div>`;
}
function renderApariencia() {
  const mias = tiendaTodos().filter(i => i.cat === "estilo" && i.sub !== "temas" && esTuyo(i));
  const fams = TEMA_FAMILIAS.filter(familiaTuya);
  const grupo = ([id, titulo]) => { const xs = mias.filter(i => i.sub === id);
    return xs.length ? `<section class="tienda-sec"><div class="section-title">${titulo}</div><div class="fichas">${xs.map(fichaHtml).join("")}</div></section>` : ""; };
  const resto = TIENDA_SUBS.estilo.filter(([id]) => id !== "temas").map(grupo).join("");
  return `
  <p class="text-sm muted" style="margin-bottom:16px">Cómo se ve Rumbo con lo que ya tienes. Lo nuevo está en <a href="#recompensas">Recompensas › Tienda</a>.</p>
  <section class="tienda-sec"><div class="section-title">Tema</div><div class="fam-cards">${fams.map(temaFamiliaHtml).join("")}</div></section>
  ${resto || `<div class="card mt-16"><div class="empty">Los títulos, marcos, íconos y efectos que compres en la Tienda aparecen aquí para usarlos.</div></div>`}`;
}

/* Detalle de una ficha: la tarjeta de siempre, en una hoja */
function openFicha(key) {
  const it = tiendaTodos().find(x => x.key === key);
  if (!it || !it.detalle) return;
  TIENDA_FICHA = key;
  const volver = it.cat === "cuarto" ? `<button class="btn-ghost ficha-volver" data-action="cuarto-decorar">‹ Decorar</button>` : "";
  openModal(it.nombre, `${volver}<div class="ficha-detalle">${it.detalle()}</div>`);
  document.getElementById("modal").classList.add("modal--hoja");
  if (it.alAbrir) it.alAbrir();
}
/* Después de comprar o equipar desde la hoja: se vuelve a dibujar con el estado nuevo */
function refrescarFicha() {
  if (!TIENDA_FICHA || document.getElementById("modalOverlay").hidden) { TIENDA_FICHA = null; return; }
  openFicha(TIENDA_FICHA);
}
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-action]");
  if (el && el.closest(".ficha-detalle") && ["util-buy", "fun-buy", "cos-buy", "cos-equip"].includes(el.dataset.action)) setTimeout(refrescarFicha, 0);
});
