/* ============================================================
   RUMBO · Lugares a pantalla completa: tu casa y tu vitrina
   El lugar llena la pantalla de borde a borde. Arriba flota una barra (‹, título y ⭐) y
   abajo una hoja que se arrastra: asomada, a media altura o completa (en pantallas anchas
   es un panel al costado). Al subir la hoja, el 3D se encuadra en lo que queda libre.
   Se entra desde la tarjeta del lugar (crece desde ahí); ‹ o Escape vuelven a donde estabas.
   Lugares: tu casa (casa.js) y tu vitrina de medallas (cielo.js), y las de un amigo de visita (visitas.js).
   Se llega por las dos puertas de la barra de arriba (la cara de tu elefante y tus medallas) o tocando a tu
   elefante en la tarjeta del día. Sin WebGL, el lugar se ve como una página con su hoja.
   ============================================================ */
const LUGAR = { volver: null, desde: null, hoja: "asomada" };
const LUGAR_BASE = { cuarto: "inicio", cielo: "inicio", "visita-casa": "amigos", "visita-cielo": "amigos" };   // a dónde vuelve ‹ si llegaste directo
const HOJA_ESTADOS = ["asomada", "media", "completa"];
function lugarAncho() { return window.matchMedia && matchMedia("(min-width: 900px)").matches; }

/* { lienzo, titulo, sub, chip (texto) o chipHtml, oscuro, fondo, aria, carga, extra, cab, cuerpo } */
function lugarHtml(o) {
  return `<div class="lugar${o.oscuro ? " lugar--osc" : ""}" id="lugar" data-gesto${o.fondo ? ` style="background:${o.fondo}"` : ""}>
    <div class="lugar__lienzo" id="${o.lienzo}" role="img" aria-label="${escapeAttr(o.aria || o.titulo)}"></div>
    ${o.extra || ""}
    <div class="lugar__carga" aria-hidden="true">${o.carga || "Cargando…"}</div>
    <header class="lugar__hud">
      <button type="button" class="lugar__vol vidrio" data-action="lugar-volver" aria-label="Volver">${typeof iconoLinea === "function" ? iconoLinea("atras", 20) : "‹"}</button>
      <div class="lugar__t vidrio"><b>${o.titulo}</b>${o.sub ? `<small>${o.sub}</small>` : ""}</div>
      ${o.chipHtml || (o.chip ? `<span class="lugar__c vidrio">${o.chip}</span>` : "")}
    </header>
    <section class="hoja" id="lugarHoja" data-estado="${LUGAR.hoja}" aria-label="${escapeAttr(o.hojaAria || o.titulo)}">
      <button type="button" class="hoja__asa" data-action="hoja-alternar" aria-label="Subir o bajar la hoja"><i></i></button>
      <div class="hoja__cab">${o.cab}</div>
      <div class="hoja__cuerpo">${o.cuerpo || ""}</div>
    </section>
  </div>`;
}

/* -------- La hoja: cuánto se ve en cada estado y cómo se arrastra -------- */
function hojaVisible(estado, h) {
  const vh = window.innerHeight, cab = h.querySelector(".hoja__cab");
  const base = Math.round((cab ? cab.offsetHeight : 120) + 34 + (parseFloat(getComputedStyle(h).paddingBottom) || 0));
  if (estado === "completa") return Math.round(vh * 0.86);
  if (estado === "media") return Math.max(base + 40, Math.round(vh * 0.5));
  return base;
}
function hojaPoner(estado, ya) {
  const h = document.getElementById("lugarHoja"); if (!h) return;
  LUGAR.hoja = HOJA_ESTADOS.includes(estado) ? estado : "asomada";
  h.dataset.estado = LUGAR.hoja;
  if (ya) h.classList.add("sin-anim");
  if (!lugarAncho()) { const v = hojaVisible(LUGAR.hoja, h); h.dataset.vis = v; h.style.setProperty("--vis", v + "px"); }
  else { h.dataset.vis = 0; h.style.removeProperty("--vis"); }
  const asa = h.querySelector(".hoja__asa"); if (asa) asa.setAttribute("aria-expanded", String(LUGAR.hoja !== "asomada"));
  if (ya) { void h.offsetHeight; h.classList.remove("sin-anim"); }
  lugarEncuadre(ya);
}
function hojaAlternar() { hojaPoner(LUGAR.hoja === "asomada" ? "media" : "asomada"); }
/* Lo que tapan la barra y la hoja (o el panel al costado): el 3D se encuadra en el resto */
function lugarEncuadre(ya) {
  const m = CIELO_ESTADO.motor, h = document.getElementById("lugarHoja"), hud = document.querySelector(".lugar__hud");
  if (!m || !m.encuadre || !h) return;
  const arriba = hud ? Math.round(hud.getBoundingClientRect().bottom + 6) : 0;
  if (lugarAncho()) { const r = h.getBoundingClientRect(); m.encuadre({ arriba, abajo: 0, der: Math.round(window.innerWidth - r.left + 12) }, ya); return; }
  m.encuadre({ arriba, abajo: Math.min(+h.dataset.vis || 0, Math.round(window.innerHeight * 0.55)) }, ya);
}
function hojaArrastre(h) {
  if (h.dataset.arrastre) return; h.dataset.arrastre = "1";
  let a = null;
  const inicio = ev => {
    if (lugarAncho() || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    if (ev.target.closest("button:not(.hoja__asa), a, input, .med-chip")) return;
    if (LUGAR.hoja === "completa" && ev.target.closest(".hoja__cuerpo") && h.querySelector(".hoja__cuerpo").scrollTop > 0) return;
    a = { y0: ev.clientY, t0: performance.now(), v0: +h.dataset.vis || 0, id: ev.pointerId, movido: false };
  };
  h.addEventListener("pointerdown", inicio);
  window.addEventListener("pointermove", ev => {
    if (!a || ev.pointerId !== a.id) return;
    const dy = ev.clientY - a.y0;
    if (!a.movido && Math.abs(dy) < 6) return;
    if (!a.movido) { a.movido = true; h.classList.add("sin-anim"); try { h.setPointerCapture(ev.pointerId); } catch (e) {} }
    const v = Math.max(hojaVisible("asomada", h) * 0.7, Math.min(window.innerHeight * 0.9, a.v0 - dy));
    h.style.setProperty("--vis", v + "px"); h.dataset.vis = v;
  });
  const fin = ev => {
    if (!a || ev.pointerId !== a.id) return;
    const dy = ev.clientY - a.y0, dt = Math.max(1, performance.now() - a.t0), vel = dy / dt, movido = a.movido; a = null;
    h.classList.remove("sin-anim");
    if (!movido) return;
    const v = +h.dataset.vis, cerca = HOJA_ESTADOS.map(e => [e, Math.abs(hojaVisible(e, h) - v)]).sort((x, y) => x[1] - y[1])[0][0];
    const i = HOJA_ESTADOS.indexOf(LUGAR.hoja), rapido = Math.abs(vel) > 0.6;
    hojaPoner(rapido ? HOJA_ESTADOS[Math.max(0, Math.min(2, i + (vel < 0 ? 1 : -1)))] : cerca);
  };
  window.addEventListener("pointerup", fin); window.addEventListener("pointercancel", fin);
}

/* -------- Entrar y salir -------- */
function lugarEntrar(ruta, desdeEl) {
  if (CIELO_ESTADO.sin3d) return false;
  LUGAR.volver = CURRENT !== ruta ? CURRENT : LUGAR.volver;
  LUGAR.desde = desdeEl && !reduceMotion() ? desdeEl.getBoundingClientRect() : null;
  LUGAR.hoja = "asomada";
  go(ruta);
  return true;
}
function lugarVolver() {
  const ruta = CURRENT, base = LUGAR_BASE[ruta] || "recompensas", el = document.getElementById("lugar");
  // al terminar de desvanecerse, sale solo si sigues en el lugar (si ya te fuiste con atrás, no te devuelve)
  const ir = () => { if (CURRENT === ruta) go(LUGAR.volver && ROUTE_MAP[LUGAR.volver] && !ROUTE_MAP[LUGAR.volver].lugar ? LUGAR.volver : base); };
  if (!el || reduceMotion() || !el.animate) return ir();
  if (el.dataset.saliendo) return; el.dataset.saliendo = "1";
  el.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.97)" }], { duration: 170, easing: "ease-in" }).onfinish = ir;
}
/* Después de cada render del lugar: la hoja en su estado, el encuadre y (al entrar) la animación desde la tarjeta */
function lugarTrasRender() {
  const el = document.getElementById("lugar"); if (!el) return;
  hojaArrastre(document.getElementById("lugarHoja"));
  hojaPoner(LUGAR.hoja, true);
  const r = LUGAR.desde; LUGAR.desde = null;
  if (r && el.animate) {
    const W = window.innerWidth, H = window.innerHeight;
    el.animate([{ clipPath: `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round 18px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }],
      { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
    const hoja = document.getElementById("lugarHoja");
    if (hoja && hoja.animate) hoja.animate([{ transform: "translateY(100%)" }, { transform: getComputedStyle(hoja).transform }], { duration: 460, delay: 120, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
  } else if (el.animate && !reduceMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
}
/* Desde una puerta (o tu elefante del día): crece desde ese botón; sin 3D, el lugar se abre como página */
function lugarAbrir(ruta, el) {
  if (!LUGAR_BASE[ruta]) return;
  const desde = el && el.closest && el.closest(".puerta, .ele-hero, .ruta-dia__ele");
  if (!lugarEntrar(ruta, desde)) { LUGAR.volver = CURRENT !== ruta ? CURRENT : LUGAR.volver; go(ruta); }
}
/* Sin WebGL: el lugar es una página normal con lo de su hoja (y, en tu casa, tu elefante dibujado) */
function lugarPlanoHtml(o) {
  return `<section class="card lugar-plano${o.oscuro ? " lugar-plano--osc" : ""}" aria-label="${escapeAttr(o.titulo)}">
    <div class="lugar-plano__cab">${o.dibujo ? `<div class="lugar-plano__dib" aria-hidden="true">${o.dibujo}</div>` : ""}
      <div><h2 class="lugar-plano__t">${o.titulo}</h2>${o.sub ? `<div class="text-sm muted">${o.sub}</div>` : ""}</div></div>
    <div class="hoja__cab">${o.cab}</div><div class="hoja__cuerpo">${o.cuerpo || ""}</div>
  </section>`;
}

/* -------- Las puertas de la barra de arriba (en todas las pantallas) --------
   La cara de tu elefante lleva a Tu casa (con una «z» mientras duerme la siesta) y la estrella, con
   cuántas medallas tienes, a Tu vitrina (con un punto cuando hay una que todavía no viste en el cielo). */
let PUERTA_CARA = "";
function pintarPuertas() {
  if (!STATE || typeof cieloOrden !== "function") return;
  const cara = document.getElementById("puertaCara");
  if (cara && typeof elefanteCaraSVG === "function") { const svg = elefanteCaraSVG(); if (svg !== PUERTA_CARA) { PUERTA_CARA = svg; cara.innerHTML = svg; } }
  const a = typeof eleActividadAhora === "function" ? eleActividadAhora(STATE) : null, z = document.getElementById("puertaZ");
  if (z) z.hidden = !(a && a.id === "siesta");
  const casa = document.getElementById("puertaCasa");
  if (casa && a) casa.setAttribute("aria-label", `Tu casa: tu elefante ${a.txt}`);
  const orden = cieloOrden(), g = STATE.gamif.badges || [], n = orden.filter(id => g.includes(id)).length;
  const visto = typeof cieloVisto === "function" ? cieloVisto() : null, nuevas = visto ? g.filter(id => orden.includes(id) && !visto.includes(id)).length : 0;
  const num = document.getElementById("puertaN"); if (num) num.textContent = n;
  const punto = document.getElementById("puertaNuevo"); if (punto) punto.hidden = !nuevas;
  const vit = document.getElementById("puertaVitrina");
  if (vit) vit.setAttribute("aria-label", `Tu vitrina: ${n} de ${orden.length} medallas${nuevas ? ` · ${nuevas === 1 ? "1 nueva" : nuevas + " nuevas"}` : ""}`);
}
/* Desde la tarjeta de cada lugar (o tocando su 3D): casa → tu casa, cielo → tu vitrina */
function lugarDesdeTarjeta(l) {
  const ruta = { casa: "cuarto", cielo: "cielo" }[l];
  if (ruta) lugarEntrar(ruta, document.getElementById(l));
}
/* El motor ya colgó el lienzo: el encuadre se fija sin animar (si no, el lugar llegaría corriéndose) */
function lugarMontado() { lugarEncuadre(true); }
window.addEventListener("resize", () => { if (document.getElementById("lugar")) hojaPoner(LUGAR.hoja, true); });
document.addEventListener("keydown", ev => {
  if (ev.key !== "Escape" || !document.getElementById("lugar")) return;
  if (!document.getElementById("modalOverlay").hidden || (typeof CERCA !== "undefined" && CERCA.id)) return;
  lugarVolver();
});
