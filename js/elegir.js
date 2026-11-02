/* ============================================================
   Elegir en Rumbo: las 9 piezas para elegir, cada una con su regla.
   1 Tramos (una entre 2 y 5 cortas) · 2 Contador (un número de a poco) · 3 Escala (cuánto: rayos, estrellas o
   una nota de 1 a 10) · 4 Galería (lo que se ve, viéndolo) · 5 Muestras (colores con nombre) · 6 Fichas (varias a
   la vez) · 7 Respuestas rápidas (un toque y listo) · 8 Filtros (qué parte ver) · 9 Lista (una entre muchas, con
   su porqué).
   Reglas: lo elegido se ve igual en todas partes (relleno índigo en texto; anillo índigo y ✓ en dibujos y
   colores); nada se parte en dos líneas; cada opción mide al menos 44 px; lo que falta va al final con candado
   y precio. Cada pieza deja su valor en un input oculto con el id de siempre: el código que lee el formulario
   no cambia, y al elegir se avisa con un evento «change» en ese input (y con data-el-fn, si la pieza lo trae).
   ============================================================ */

const EL_RAYO = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M13.2 2.5 5 13.4h6.1L10 21.5l8.4-11.2h-6.2l1-7.8Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const EL_ESTRELLA = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const EL_ESC = s => (typeof escapeAttr === "function" ? escapeAttr(s) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
const EL_OPS = ops => (ops || []).map(o => Array.isArray(o) ? Object.assign({ v: o[0], t: o[1] }, o[2] || {}) : o);
const EL_IGUAL = (a, b) => String(a) === String(b);

/* Deja el valor en el input oculto y avisa (evento change + la función de la pieza) */
function elAvisar(cont, valor, btn) {
  const id = cont.dataset.elId, input = id ? document.getElementById(id) : null;
  if (input) { input.value = valor; input.dispatchEvent(new Event("change", { bubbles: true })); }
  const fn = cont.dataset.elFn;
  if (fn && typeof window[fn] === "function") window[fn](valor, btn, cont);
}

/* ---------- 1 · Tramos ----------
   ops: [[valor, texto, { ico, aria }]] · op: { label, fn, cls, ico (solo íconos: el nombre del elegido va abajo) } */
function elTramos(id, ops, valor, op = {}) {
  const o = EL_OPS(ops), elegido = o.find(x => EL_IGUAL(x.v, valor));
  return `<input type="hidden" id="${id}" value="${EL_ESC(valor ?? "")}">
    <div class="seg tramos${op.ico ? " tramos--ico" : ""}${op.cls ? " " + op.cls : ""}" role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="tramos" data-el-id="${id}"${op.fn ? ` data-el-fn="${op.fn}"` : ""}${op.attrs ? " " + op.attrs : ""}>${o.map(x => {
      const on = EL_IGUAL(x.v, valor), nombre = x.aria || x.t || "";
      return `<button type="button" class="${on ? "is-active" : ""}" aria-pressed="${on}" data-v="${EL_ESC(x.v)}" data-nombre="${EL_ESC(nombre)}"${op.ico || x.aria ? ` aria-label="${EL_ESC(nombre)}" title="${EL_ESC(nombre)}"` : ""}>${x.ico || ""}${op.ico ? "" : x.t || ""}</button>`;
    }).join("")}</div>${op.ico ? `<div class="tramos__nombre" aria-hidden="true">${elegido ? EL_ESC(elegido.aria || elegido.t) : ""}</div>` : ""}`;
}
/* Pro / Personal: los mismos tramos en todas partes (antes: una ficha que cambiaba al tocarla, tramos o un desplegable) */
function elAmbito(id, cur, op = {}) {
  const a = cur === "per" ? "per" : "pro";
  return elTramos(id, ["pro", "per"].map(k => [k, op.compacto ? "" : `<span class="tramos__t">${AMBITOS[k].corto}</span>`, { ico: AMBITOS[k].icon, aria: k === "pro" ? "Profesional" : "Personal" }]), a,
    { label: op.label || "¿Profesional o personal?", cls: "tramos--amb" + (op.compacto ? " tramos--amb-c" : ""), fn: op.fn });
}

/* ---------- 2 · Contador ----------
   op: { min, max, paso, fmt(v) → texto, unidad, label, auto: { on, texto, valor } (interruptor encima), fn } */
function elContador(id, valor, op = {}) {
  const min = op.min ?? 0, max = op.max ?? 99, paso = op.paso ?? 1, auto = op.auto;
  const v = Math.min(max, Math.max(min, +valor || (auto ? auto.valor : min)));
  const apagado = !!(auto && auto.on);
  const fmt = op.fmt ? op.fmt(v) : String(v);
  return `<div class="contador-caja">
    ${auto ? `<button type="button" class="el-inter" role="switch" aria-checked="${apagado}" data-el="auto" data-el-cont="${id}"><span>${EL_ESC(auto.texto || "Automática")}</span><i class="sw-mini" aria-hidden="true"></i></button>` : ""}
    <input type="hidden" id="${id}" value="${apagado ? 0 : v}">
    <div class="contador${apagado ? " is-auto" : ""}" role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="contador" data-el-id="${id}" data-min="${min}" data-max="${max}" data-paso="${paso}" data-v="${v}"${op.fn ? ` data-el-fn="${op.fn}"` : ""}${op.fmtFn ? ` data-el-fmt="${op.fmtFn}"` : ""}${op.unidad ? ` data-unidad="${EL_ESC(op.unidad)}"` : ""}${auto ? ` data-auto="${auto.valor}"` : ""}>
      <button type="button" data-d="-1" aria-label="Menos" ${apagado || v <= min ? "disabled" : ""}>−</button>
      <output aria-live="polite">${fmt}${op.unidad ? ` <small>${EL_ESC(op.unidad)}</small>` : ""}</output>
      <button type="button" data-d="1" aria-label="Más" ${apagado || v >= max ? "disabled" : ""}>+</button>
    </div></div>`;
}
function elContadorPintar(c) {
  const v = +c.dataset.v, min = +c.dataset.min, max = +c.dataset.max, auto = c.classList.contains("is-auto");
  const fn = c.dataset.elFmt && typeof window[c.dataset.elFmt] === "function" ? window[c.dataset.elFmt] : String;
  c.querySelector("output").innerHTML = EL_ESC(fn(v)) + (c.dataset.unidad ? ` <small>${EL_ESC(c.dataset.unidad)}</small>` : "");
  const [menos, mas] = c.querySelectorAll("button[data-d]");
  menos.disabled = auto || v <= min; mas.disabled = auto || v >= max;
}
function elContadorPaso(c, d) {
  const min = +c.dataset.min, max = +c.dataset.max, paso = +c.dataset.paso;
  const v = Math.min(max, Math.max(min, Math.round((+c.dataset.v + d * paso) / paso) * paso));
  if (v === +c.dataset.v) return;
  c.dataset.v = v; elContadorPintar(c); elAvisar(c, v);
}

/* ---------- 3 · Escala ----------
   Hasta 5: íconos que se llenan (rayos o estrellas). op: { n, ico: "rayo" | "estrella", etiquetas, label, contId, fn, cero } */
function elEscala(id, valor, op = {}) {
  const n = op.n || 5, v = Math.max(0, Math.min(n, +valor || 0)), ico = op.ico === "estrella" ? EL_ESTRELLA : EL_RAYO;
  const eti = op.etiquetas || [], nombre = i => eti[i - 1] || `${i} de ${n}`;
  return `<input type="hidden" id="${id}" value="${v || ""}">
    <div class="escala escala--${op.ico === "estrella" ? "estrella" : "rayo"}" role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="escala" data-el-id="${id}"${op.contId ? ` id="${op.contId}"` : ""}${op.fn ? ` data-el-fn="${op.fn}"` : ""}${op.cero ? ` data-cero="1"` : ""}>${Array.from({ length: n }, (_, k) => {
      const i = k + 1;
      return `<button type="button" class="${i <= v ? "is-lleno" : ""}${i === v ? " is-active" : ""}" aria-pressed="${i === v}" data-v="${i}" aria-label="${EL_ESC(nombre(i))}" title="${EL_ESC(nombre(i))}">${ico}</button>`;
    }).join("")}</div>${eti.length ? `<div class="escala__nombre" aria-hidden="true">${v ? EL_ESC(nombre(v)) : ""}</div>` : ""}`;
}
function elEscalaPintar(c, v) {
  c.querySelectorAll("button").forEach(b => { const i = +b.dataset.v; b.classList.toggle("is-lleno", i <= v); b.classList.toggle("is-active", i === v); b.setAttribute("aria-pressed", String(i === v)); });
  const nom = c.nextElementSibling;
  if (nom && nom.classList.contains("escala__nombre")) { const b = c.querySelector(`button[data-v="${v}"]`); nom.textContent = b ? b.getAttribute("aria-label") : ""; }
}
/* Una nota de 1 a 10 (o de 0 a 10): un deslizador con el número grande. op: { min, max, titulo (va a la izquierda del número), label, oninput, attrs } */
function elNota(id, valor, op = {}) {
  const min = op.min ?? 1, max = op.max ?? 10, v = valor ?? Math.round((min + max) / 2);
  const num = `<output class="nota-rango__n" aria-hidden="true">${v}<small> de ${max}</small></output>`;
  return `<div class="nota-rango${op.titulo ? " nota-rango--fila" : ""}" data-el="nota">
    ${op.titulo ? `<div class="nota-rango__cab"><label for="${id}">${op.titulo}</label>${num}</div>` : num}
    <input type="range" class="rango" min="${min}" max="${max}" step="1" id="${id}" value="${v}"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} aria-valuetext="${v} de ${max}"${op.oninput ? ` oninput="${op.oninput}"` : ""}${op.attrs ? " " + op.attrs : ""}>
    <div class="nota-rango__m" aria-hidden="true"><span>${min}</span><span>${max}</span></div></div>`;
}

/* ---------- 4 · Galería ----------
   ops: [{ v, nombre, thumb (html), lock: { precio, key (de la Tienda) } (va al final, con candado; abre su ficha en la Tienda), desc }]
   op: { id (input oculto) | accion (data-action), label, cls, fila (una fila que se desliza), fn, attr (nombre del data-* con el valor),
         extra (atributos para cada opción tuya) } · cada opción puede traer attrs propios */
function elGaleria(ops, valor, op = {}) {
  const tuyos = ops.filter(x => !x.lock), faltan = ops.filter(x => x.lock);
  const attr = op.attr || "v";
  const boton = x => {
    const on = !x.lock && EL_IGUAL(x.v, valor);
    const act = x.lock ? (x.lock.accion ? ` data-action="${x.lock.accion}"` : ` data-action="tienda-ficha" data-key="${EL_ESC(x.lock.key || "")}"`) : op.accion ? ` data-action="${op.accion}"` : "";
    const aria = x.lock ? `${x.nombre}: aún no lo tienes${x.lock.precio ? `, ${x.lock.precio} estrellas en la Tienda` : ""}` : x.nombre;
    return `<button type="button" class="el-gal__op${on ? " is-on" : ""}${x.lock ? " is-lock" : ""}"${x.lock ? "" : ` aria-pressed="${on}"`} data-${attr}="${EL_ESC(x.v)}"${act}${!x.lock && op.extra ? " " + op.extra : ""}${!x.lock && x.attrs ? " " + x.attrs : ""} aria-label="${EL_ESC(aria)}"${x.desc ? ` title="${EL_ESC(x.desc)}"` : ""}>
      <i class="el-gal__img">${x.thumb || ""}</i><span class="el-gal__n">${EL_ESC(x.nombre)}${x.lock && x.lock.precio ? ` <em>${x.lock.precio} ⭐</em>` : ""}</span></button>`;
  };
  return `${op.id ? `<input type="hidden" id="${op.id}" value="${EL_ESC(valor ?? "")}">` : ""}<div class="el-gal${op.fila ? " el-gal--fila" : ""}${op.cls ? " " + op.cls : ""}"${op.contId ? ` id="${op.contId}"` : ""} role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="galeria"${op.id ? ` data-el-id="${op.id}"` : ""}${op.fn ? ` data-el-fn="${op.fn}"` : ""} data-el-attr="${attr}">${tuyos.map(boton).join("")}${faltan.map(boton).join("")}</div>`;
}

/* Marca desde el código la opción de una galería o muestras (p. ej. al cambiar algo que la sugiere) */
function elMarcar(cont, valor) {
  if (!cont) return;
  const attr = cont.dataset.elAttr || "v";
  cont.querySelectorAll(":scope > button:not(.is-lock)").forEach(b => { const on = EL_IGUAL(b.dataset[attr], valor); b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
  const id = cont.dataset.elId, input = id && document.getElementById(id); if (input) input.value = valor;
}

/* ---------- 5 · Muestras ----------
   ops: [{ v, nombre, color, lock }] · el nombre del elegido va debajo (también para quien no ve los colores) */
function elMuestras(ops, valor, op = {}) {
  const tuyos = ops.filter(x => !x.lock), faltan = ops.filter(x => x.lock), elegido = ops.find(x => EL_IGUAL(x.v, valor));
  const attr = op.attr || "v";
  const boton = x => {
    const on = !x.lock && EL_IGUAL(x.v, valor);
    const act = x.lock ? (x.lock.accion ? ` data-action="${x.lock.accion}"` : ` data-action="tienda-ficha" data-key="${EL_ESC(x.lock.key || "")}"`) : op.accion ? ` data-action="${op.accion}"` : "";
    const aria = x.lock ? `${x.nombre}: aún no lo tienes${x.lock.precio ? `, ${x.lock.precio} estrellas` : ""}` : x.nombre;
    return `<button type="button" class="el-mu__op${on ? " is-on" : ""}${x.lock ? " is-lock" : ""}"${x.lock ? "" : ` aria-pressed="${on}"`} data-${attr}="${EL_ESC(x.v)}"${act}${!x.lock && op.extra ? " " + op.extra : ""} aria-label="${EL_ESC(aria)}" title="${EL_ESC(aria)}"><i style="background:${x.color || "transparent"}"${x.color ? "" : ' class="is-sin"'}></i>${op.nombres ? `<span>${EL_ESC(x.nombre)}</span>` : ""}</button>`;
  };
  return `${op.id ? `<input type="hidden" id="${op.id}" value="${EL_ESC(valor ?? "")}">` : ""}<div class="el-mu-caja"><div class="el-mu"${op.contId ? ` id="${op.contId}"` : ""} role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="muestras"${op.id ? ` data-el-id="${op.id}"` : ""}${op.fn ? ` data-el-fn="${op.fn}"` : ""} data-el-attr="${attr}">${tuyos.map(boton).join("")}${faltan.map(boton).join("")}</div>
    ${op.nombres ? "" : `<div class="el-mu__nombre" aria-hidden="true">${elegido ? EL_ESC(elegido.nombre) : ""}</div>`}</div>`;
}

/* ---------- 6 · Fichas: varias a la vez ----------
   Casillas de verdad (el lector de pantalla las lee como tales) con forma de ficha: relleno índigo y ✓.
   ops: [[valor, texto]] · valores: lo marcado · op: { name, cls (de cada input), label, tope, dias (sin ✓), attrs } */
function elFichas(ops, valores, op = {}) {
  const o = EL_OPS(ops), marcados = (valores || []).map(String);
  const n = o.filter(x => marcados.includes(String(x.v))).length;
  return `<div class="el-fichas${op.dias ? " el-fichas--dias" : ""}" role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} data-el="fichas"${op.tope ? ` data-tope="${op.tope}"` : ""}${op.id ? ` id="${op.id}"` : ""}>${o.map(x =>
    `<label class="el-ficha"${x.aria ? ` title="${EL_ESC(x.aria)}"` : ""}><input type="checkbox" value="${EL_ESC(x.v)}"${op.name ? ` name="${op.name}"` : ""}${op.cls ? ` class="${op.cls}"` : ""}${marcados.includes(String(x.v)) ? " checked" : ""}${x.aria ? ` aria-label="${EL_ESC(x.aria)}"` : ""}${x.attrs ? " " + x.attrs : ""}${op.attrs ? " " + op.attrs : ""}><span>${x.t}</span></label>`).join("")}</div>${op.tope ? `<div class="el-fichas__tope" aria-live="polite">${n} de ${op.tope}</div>` : ""}`;
}
function elFichasTope(g) {
  const tope = +g.dataset.tope; if (!tope) return;
  const ins = [...g.querySelectorAll("input[type=checkbox]")], n = ins.filter(x => x.checked).length;
  ins.forEach(x => { x.disabled = !x.checked && n >= tope; x.closest(".el-ficha, label").classList.toggle("is-tope", x.disabled); });
  const t = g.nextElementSibling; if (t && t.classList.contains("el-fichas__tope")) t.textContent = `${n} de ${tope}`;
}

/* Fichas con frases largas: una lista con casillas (filas de 48 px con su ✓) · ops: [[valor, texto, { sub, attrs }]] */
function elCasillas(ops, valores, op = {}) {
  const o = EL_OPS(ops), marcados = (valores || []).map(String);
  return `<div class="el-casillas" role="group"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""}${op.tope ? ` data-tope="${op.tope}"` : ""}>${o.map(x =>
    `<label class="el-casilla"><input type="checkbox" value="${EL_ESC(x.v)}"${op.cls ? ` class="${op.cls}"` : ""}${marcados.includes(String(x.v)) ? " checked" : ""}${x.attrs ? " " + x.attrs : ""}${op.attrs ? " " + op.attrs : ""}><span><b>${x.t}</b>${x.sub ? `<small>${x.sub}</small>` : ""}</span><i aria-hidden="true"></i></label>`).join("")}</div>${op.tope ? `<div class="el-fichas__tope" aria-live="polite">${o.filter(x => marcados.includes(String(x.v))).length} de ${op.tope}</div>` : ""}`;
}

/* ---------- 8 · Filtros: qué parte de la pantalla ver ----------
   ops: [[valor, texto, cuenta]] · op: { accion, attr (nombre del data-*), label, extra (atributos de cada botón) } */
function elFiltros(ops, valor, op = {}) {
  const attr = op.attr || "v";
  return `<div class="filtros${op.cls ? " " + op.cls : ""}" role="tablist"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""}>${EL_OPS(ops).map(x => {
    const on = EL_IGUAL(x.v, valor), cuenta = x[2] !== undefined ? x[2] : x.n;
    return `<button type="button" role="tab" class="${on ? "is-active" : ""}" aria-selected="${on}" data-${attr}="${EL_ESC(x.v)}"${op.accion ? ` data-action="${op.accion}"` : ""}${op.extra ? " " + op.extra : ""}>${x.t}${cuenta !== undefined && cuenta !== null && cuenta !== "" ? ` <em>${cuenta}</em>` : ""}</button>`;
  }).join("")}</div>`;
}

/* ---------- 9 · Lista: una entre muchas, o con su porqué ----------
   ops: [{ v, t, d (la línea que explica) }] · hasta 6 van a la vista; con más, una fila con lo elegido que abre
   su propia hoja (encima de la ventana, sin perder lo escrito). op: { label, fn, vacio (texto si no hay nada elegido), hoja (forzar) } */
function elLista(id, ops, valor, op = {}) {
  const o = EL_OPS(ops), elegido = o.find(x => EL_IGUAL(x.v, valor));
  const datos = `data-el="lista" data-el-id="${id}"${op.fn ? ` data-el-fn="${op.fn}"` : ""}`;
  const hidden = `<input type="hidden" id="${id}" value="${EL_ESC(valor ?? "")}">`;
  if (op.hoja || o.length > 6) {
    EL_LISTAS[id] = { ops: o, label: op.label || "", fn: op.fn || "" };
    return `${hidden}<button type="button" class="el-fila" data-el="lista-fila" data-el-id="${id}"${op.fn ? ` data-el-fn="${op.fn}"` : ""} aria-haspopup="dialog"${op.label ? ` aria-label="${EL_ESC(op.label)}: ${EL_ESC(elegido ? elegido.t : op.vacio || "elige")}"` : ""}>
      <span class="el-fila__t">${elegido ? EL_ESC(elegido.t) : `<span class="muted">${EL_ESC(op.vacio || "Elige")}</span>`}</span><span class="el-fila__f" aria-hidden="true">›</span></button>`;
  }
  return `${hidden}<div class="el-lista" role="radiogroup"${op.label ? ` aria-label="${EL_ESC(op.label)}"` : ""} ${datos}>${o.map(x => elListaOp(x, valor)).join("")}</div>`;
}
const EL_LISTAS = {};
function elListaOp(x, valor) {
  const on = EL_IGUAL(x.v, valor);
  return `<button type="button" role="radio" aria-checked="${on}" class="${on ? "is-on" : ""}" data-v="${EL_ESC(x.v)}"><span><b>${EL_ESC(x.t)}</b>${x.d ? `<span>${EL_ESC(x.d)}</span>` : ""}</span><i aria-hidden="true"></i></button>`;
}
/* La hoja de una lista larga: encima de la ventana abierta, sin cerrarla */
function elHojaAbrir(fila) {
  const id = fila.dataset.elId, L = EL_LISTAS[id]; if (!L) return;
  const valor = (document.getElementById(id) || {}).value;
  elHojaCerrar();
  const h = document.createElement("div");
  h.className = "el-hoja"; h.id = "elHoja";
  h.innerHTML = `<div class="el-hoja__fondo" data-el="hoja-x"></div>
    <div class="el-hoja__c" role="dialog" aria-modal="true" aria-label="${EL_ESC(L.label || "Elige")}">
      <div class="el-hoja__cab"><b>${EL_ESC(L.label || "Elige")}</b><button type="button" class="icon-btn" data-el="hoja-x" aria-label="Cerrar">✕</button></div>
      <div class="el-lista" role="radiogroup" data-el="lista" data-el-id="${id}"${L.fn ? ` data-el-fn="${L.fn}"` : ""} data-el-hoja="1">${L.ops.map(x => elListaOp(x, valor)).join("")}</div></div>`;
  document.body.appendChild(h);
  EL_HOJA_FILA = fila;
  const on = h.querySelector('[aria-checked="true"]') || h.querySelector(".el-lista button");
  if (on) { on.focus({ preventScroll: true }); const c = h.querySelector(".el-hoja__c"); c.scrollTop = Math.max(0, on.offsetTop - c.clientHeight / 2); }
}
let EL_HOJA_FILA = null;
function elHojaCerrar() {
  const h = document.getElementById("elHoja"); if (!h) return;
  h.remove();
  if (EL_HOJA_FILA && document.body.contains(EL_HOJA_FILA)) EL_HOJA_FILA.focus({ preventScroll: true });
  EL_HOJA_FILA = null;
}

/* ---------- Un solo oyente para todas las piezas ---------- */
let EL_REPITIO = false, EL_REP = null;
function elRepetirParar() { clearTimeout(EL_REP); EL_REP = null; }
function elOyentes() {
document.addEventListener("click", e => {
  const t = e.target;
  if (!t || !t.closest) return;
  const tramo = t.closest('[data-el="tramos"] > button');
  if (tramo) {
    const g = tramo.parentNode;
    g.querySelectorAll(":scope > button").forEach(b => { const on = b === tramo; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on)); });
    const nom = g.nextElementSibling; if (nom && nom.classList.contains("tramos__nombre")) nom.textContent = tramo.dataset.nombre || "";
    return elAvisar(g, tramo.dataset.v, tramo);
  }
  const paso = t.closest('[data-el="contador"] button[data-d]');
  if (paso) { if (EL_REPITIO) { EL_REPITIO = false; return; } return elContadorPaso(paso.closest('[data-el="contador"]'), +paso.dataset.d); }
  const auto = t.closest('[data-el="auto"]');
  if (auto) {
    const c = document.querySelector(`[data-el="contador"][data-el-id="${auto.dataset.elCont}"]`); if (!c) return;
    const on = auto.getAttribute("aria-checked") !== "true";
    auto.setAttribute("aria-checked", String(on)); c.classList.toggle("is-auto", on);
    if (!on && c.dataset.auto) c.dataset.v = Math.min(+c.dataset.max, Math.max(+c.dataset.min, Math.round(+c.dataset.auto / +c.dataset.paso) * +c.dataset.paso));
    elContadorPintar(c); return elAvisar(c, on ? 0 : +c.dataset.v);
  }
  const esc = t.closest('[data-el="escala"] > button');
  if (esc) {
    const g = esc.parentNode; let v = +esc.dataset.v;
    if (g.dataset.cero && esc.classList.contains("is-active")) v = 0;   // tocar de nuevo la elegida la quita (sin valorar)
    elEscalaPintar(g, v); return elAvisar(g, v || "", esc);
  }
  const gal = t.closest('[data-el="galeria"][data-el-id] > button:not(.is-lock), [data-el="muestras"][data-el-id] > button:not(.is-lock)');
  if (gal) {
    const g = gal.parentNode;
    g.querySelectorAll(":scope > button:not(.is-lock)").forEach(b => { const on = b === gal; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on)); });
    const nom = g.parentNode.querySelector(".el-mu__nombre"); if (nom) nom.textContent = gal.getAttribute("aria-label") || "";
    return elAvisar(g, gal.dataset[g.dataset.elAttr || "v"], gal);
  }
  const lop = t.closest('[data-el="lista"] > button');
  if (lop) {
    const g = lop.parentNode, id = g.dataset.elId;
    g.querySelectorAll(":scope > button").forEach(b => { const on = b === lop; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); });
    if (g.dataset.elHoja) {
      const fila = document.querySelector(`[data-el="lista-fila"][data-el-id="${id}"]`);
      if (fila) { const txt = lop.querySelector("b").textContent; fila.querySelector(".el-fila__t").textContent = txt;
        const L = EL_LISTAS[id]; if (L && L.label) fila.setAttribute("aria-label", `${L.label}: ${txt}`); }
      elAvisar(fila || g, lop.dataset.v, lop);
      return setTimeout(elHojaCerrar, 120);
    }
    return elAvisar(g, lop.dataset.v, lop);
  }
  const fila = t.closest('[data-el="lista-fila"]');
  if (fila) return elHojaAbrir(fila);
  if (t.closest('[data-el="hoja-x"]')) return elHojaCerrar();
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.getElementById("elHoja")) { e.stopPropagation(); elHojaCerrar(); } }, true);
/* Fichas con tope («2 de 3»): al llegar al tope, las demás esperan */
document.addEventListener("change", e => { const g = e.target && e.target.closest && e.target.closest('[data-tope]'); if (g) elFichasTope(g); });
/* La nota grande sigue al deslizador */
document.addEventListener("input", e => {
  const r = e.target; if (!r || !r.classList || !r.classList.contains("rango")) return;
  const caja = r.closest(".nota-rango"), n = caja && caja.querySelector(".nota-rango__n");
  if (n) n.innerHTML = `${r.value}<small> de ${r.max}</small>`;
  r.setAttribute("aria-valuetext", `${r.value} de ${r.max}`);
});
/* Contador: mantener apretado repite (de a poco, más rápido mientras sigues) */
document.addEventListener("pointerdown", e => {
  const b = e.target && e.target.closest && e.target.closest('[data-el="contador"] button[data-d]'); if (!b || b.disabled) return;
  const c = b.closest('[data-el="contador"]'); let n = 0; EL_REPITIO = false; elRepetirParar();
  const tic = () => { if (b.disabled) return elRepetirParar(); EL_REPITIO = true; elContadorPaso(c, +b.dataset.d); n++; EL_REP = setTimeout(tic, n > 6 ? 60 : 140); };
  EL_REP = setTimeout(tic, 420);
});
["pointerup", "pointercancel", "pointerleave"].forEach(ev => document.addEventListener(ev, elRepetirParar));
}
if (typeof document !== "undefined" && document.addEventListener) elOyentes();

/* ---------- Lectores de pantalla: lo elegido se anuncia en todas partes ----------
   Muchas pantallas marcan lo elegido solo con una clase (is-active, is-on). Este observador copia esa marca a
   aria-pressed / aria-selected, también cuando la clase cambia después de pintar. */
const EL_ARIA = [
  [".seg > button:not([role])", "is-active", "aria-pressed"],
  [".seg > button[role=tab], .filtros > button, .months > button, .tabs__b", "is-active", "aria-selected"],
  [".mood-btn, .swatch, .nota-color, .chip-f, .av-color, .vest-esp, .alc-estilo, .tema-modo, .repisa-sel__b, .el-gal__op:not(.is-lock), .el-mu__op:not(.is-lock), .dsc-dia", "is-on", "aria-pressed"],
];
const EL_ARIA_SEL = EL_ARIA.map(x => x[0]).join(", ");
function elAriaUno(el) {
  for (const [sel, cls, attr] of EL_ARIA) if (el.matches(sel)) {
    const on = el.classList.contains("dsc-dia") ? el.classList.contains("is-desc")
      : attr === "aria-selected" ? el.classList.contains("is-active") || el.classList.contains("is-on") : el.classList.contains(cls);
    if (el.getAttribute(attr) !== String(on)) el.setAttribute(attr, String(on));
    return;
  }
}
function elAria(root) { if (root && root.querySelectorAll) { if (root.matches && root.matches(EL_ARIA_SEL)) elAriaUno(root); root.querySelectorAll(EL_ARIA_SEL).forEach(elAriaUno); } }
if (typeof MutationObserver === "function" && typeof document !== "undefined") {
  const obs = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === "attributes") { if (m.target.matches && m.target.matches(EL_ARIA_SEL)) elAriaUno(m.target); }
      else m.addedNodes.forEach(n => { if (n.nodeType === 1) elAria(n); });
    }
  });
  const iniciar = () => { obs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] }); elAria(document.body); };
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar);
}
