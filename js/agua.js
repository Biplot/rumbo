/* ============================================================
   RUMBO · 💧 Agua para todos
   La tarjeta «Agua de hoy» en Inicio y la hoja «Tu agua»: cada vaso se registra con un toque,
   la meta sale de tu peso (Salud) o la eliges tú, al cumplirla se marca el hábito «Agua» y
   ganas +10 ⭐ (una vez al día; si deshaces y quedas bajo la meta, se devuelven).
   Cómo se ve es un estilo: la botella viene con Rumbo; la burbuja, la cantimplora, la bombilla
   y el reloj de agua se compran en Tienda › Para tu estilo › «Tu agua», igual que los sabores
   (el color del agua). El agua se dibuja en canvas: olas con resortes, burbujas y chorros.
   Datos: STATE.agua (ver state.js); entre equipos se fusiona con aguaMerge (store.js).
   ============================================================ */
const AGUA_PREMIO = 10, AGUA_DETALLE = 14, AGUA_TOPE = 8000;
const AGUA_ESTILOS = [
  { id: "botella", nombre: "La botella", cos: null, desc: "se llena vaso a vaso" },
  { id: "burbuja", nombre: "La burbuja", cos: "agua-burbuja", desc: "flota, tiembla y se llena por volumen" },
  { id: "cantimplora", nombre: "La cantimplora", cos: "agua-cantimplora", desc: "cuatro tramos; se rellena en cada parada" },
  { id: "bombilla", nombre: "La bombilla", cos: "agua-bombilla", desc: "el vaso con lo que te queda; mantén apretado para tomar" },
  { id: "reloj", nombre: "El reloj de agua", cos: "agua-reloj", desc: "se vacía hasta tu próximo vaso" },
];
const AGUA_SABORES = [
  { id: "natural", nombre: "Natural", cos: null, c: null },
  { id: "pepino", nombre: "Pepino", cos: "sabor-pepino", c: ["#B9F0C2", "#5CC88A", "#2F8F5E"] },
  { id: "frutilla", nombre: "Frutilla", cos: "sabor-frutilla", c: ["#FFC2D0", "#F27A98", "#C2456A"] },
  { id: "te", nombre: "Té", cos: "sabor-te", c: ["#FFE0A6", "#E3A548", "#A86A1E"] },
  { id: "arandano", nombre: "Arándano", cos: "sabor-arandano", c: ["#D6CCFF", "#9C86F0", "#6550C2"] },
];
const AGUA_TRAMOS = ["mañana", "mediodía", "tarde", "noche"];

/* -------- Los datos -------- */
function aguaDatos(S) {
  S = S || STATE;
  if (!S.agua || typeof S.agua !== "object" || !S.agua.dias || typeof S.agua.dias !== "object") S.agua = { meta: 0, vaso: 250, inicio: true, ts: 0, dias: {} };
  return S.agua;
}
function aguaDia(fecha, crear, S) {
  const a = aguaDatos(S); let d = a.dias[fecha];
  if (d && crear && !d.r) d = a.dias[fecha] = { r: d.ml ? [{ id: "resumen", ml: +d.ml, ts: 0 }] : [], b: [] };
  if (!d && crear) d = a.dias[fecha] = { r: [], b: [] };
  if (d && d.r && !Array.isArray(d.b)) d.b = [];
  return d || null;
}
/* Los vasos que siguen (sin los borrados) */
function aguaRegistros(d) { if (!d || !d.r) return []; const b = new Set(d.b || []); return d.r.filter(x => x && !b.has(x.id)); }
function aguaTotal(d) { if (!d) return 0; return d.r ? aguaRegistros(d).reduce((s, x) => s + (+x.ml || 0), 0) : +d.ml || 0; }
function aguaHoy(S) { return aguaTotal(aguaDia(todayISO(), false, S)); }
/* La meta: la que elegiste, o 35 ml por kilo de tu último peso en Salud (entre 1,5 y 3,5 L), o 2 L */
function aguaMetaAuto(S) {
  const p = typeof pesoActualGlobal === "function" ? pesoActualGlobal(S || STATE) : null;
  return p > 0 ? Math.min(3500, Math.max(1500, Math.round(p * 35 / 50) * 50)) : 2000;
}
function aguaMeta(S) { const a = aguaDatos(S); return a.meta > 0 ? a.meta : aguaMetaAuto(S); }
function aguaVaso(S) { const v = +aguaDatos(S).vaso; return v >= 100 && v <= 1000 ? v : 250; }
/* Pasados 14 días, cada día queda solo con su total (el documento no crece de más) */
function aguaCompactar(S, hoy) {
  const a = aguaDatos(S), corte = agSumar(hoy || todayISO(), -AGUA_DETALLE);
  Object.keys(a.dias).forEach(k => { const d = a.dias[k]; if (k < corte && d && d.r) a.dias[k] = { ml: aguaTotal(d) }; });
}
function aguaEstiloTuyo(id) { const e = AGUA_ESTILOS.find(x => x.id === id); return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos))); }
function aguaEstilo() { const eq = (STATE && STATE.gamif && STATE.gamif.equipped) || {}; return aguaEstiloTuyo(eq.agua) ? eq.agua : "botella"; }
function aguaSaborTuyo(id) { const s = AGUA_SABORES.find(x => x.id === id); return !!s && (!s.cos || (typeof isOwned === "function" && isOwned(s.cos))); }
function aguaSabor() { const eq = (STATE && STATE.gamif && STATE.gamif.equipped) || {}; return aguaSaborTuyo(eq.sabor) ? eq.sabor : "natural"; }
/* El hábito que es el agua: «Agua», «Tomar 2 litros de agua», «Hidratarme»… (no «Vaso de agua al despertar») */
function aguaHabito() {
  return ((STATE.habitos && STATE.habitos.defs) || []).find(h => h && !h.pausado && !h.conjunto
    && /^\s*(agua|tomar (\d[\d,.]* ?(l|lts?|litros?) de )?agua|beber agua|hidrat)/i.test(h.nombre || "")) || null;
}
/* Lo que se muestra de un día: los litros, los vasos y el texto según el estilo */
function aguaEstado(S) {
  const d = aguaDia(todayISO(), false, S), ml = aguaTotal(d), meta = aguaMeta(S), vaso = aguaVaso(S), regs = aguaRegistros(d);
  return { ml, meta, vaso, frac: meta ? ml / meta : 0, ultimo: regs.length ? regs[regs.length - 1].ts : 0, n: regs.length };
}
/* El reloj de agua: un vaso cada (horario despierto, 8:00 a 22:00) / (vasos de la meta) */
function aguaRitmoMin(meta, vaso) { return Math.round(14 * 60 / Math.max(1, Math.ceil(meta / vaso))); }
function aguaRelojQueda(est, ahora) {
  ahora = ahora || Date.now();
  const ritmo = aguaRitmoMin(est.meta, est.vaso) * 60000, d = new Date(ahora), ocho = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8).getTime();
  const desde = Math.max(est.ultimo || 0, ocho);
  return ahora < ocho && !est.ultimo ? 1 : Math.max(0, 1 - (ahora - desde) / ritmo);
}
function aguaTexto(estilo, e) {
  const falta = Math.max(0, e.meta - e.ml), vasos = Math.ceil(falta / e.vaso);
  if (e.ml >= e.meta) return e.ml > e.meta ? `¡Meta cumplida! Llevas ${litrosTxt(e.ml - e.meta)} L extra` : "¡Meta del día cumplida!";
  if (estilo === "cantimplora") { const t = Math.min(3, Math.floor(e.ml / (e.meta / 4))); return `Tramo ${t + 1} · ${AGUA_TRAMOS[t]} · quedan ${Math.round(e.meta / 4 - (e.ml - t * e.meta / 4))} ml`; }
  if (estilo === "bombilla") return `Te quedan ${litrosTxt(falta)} L en el vaso`;
  if (estilo === "reloj") { const q = aguaRelojQueda(e), m = Math.ceil(q * aguaRitmoMin(e.meta, e.vaso)); return q <= 0 ? "¡Hora de un vaso!" : `Próximo vaso en ${m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min"}`; }
  return vasos === 1 ? "Te falta 1 vaso" : `Te faltan ${vasos} vasos`;
}
function litrosTxt(ml) { return (ml / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 }); }

/* -------- Registrar, deshacer y la meta (⭐ y el hábito) -------- */
function aguaSumar(ml) {
  ml = Math.round(+ml); if (!(ml > 0)) return;
  const hoy = todayISO(), d = aguaDia(hoy, true);
  if (aguaTotal(d) + ml > AGUA_TOPE) return toast("Ya registraste mucha agua hoy.", true);
  d.r.push({ id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ml, ts: Date.now() });
  aguaCompactar(); saveState(); vibrar(10);
  aguaPintar(ml);
  clearTimeout(aguaSumar._t); aguaSumar._t = setTimeout(() => aguaRevisar(hoy), 950);   // después del chorro
}
function aguaQuitar(id) {
  const hoy = todayISO(), d = aguaDia(hoy), regs = aguaRegistros(d); if (!regs.length) return;
  const r = id ? regs.find(x => x.id === id) : regs[regs.length - 1]; if (!r) return;
  d.b.push(r.id); saveState();
  aguaPintar(-r.ml); aguaRevisar(hoy);
  if (id && typeof openAgua === "function" && document.getElementById("agua-hoja")) openAgua();
}
function aguaRevisar(fecha) {
  const d = aguaDia(fecha); if (!d) return;
  const total = aguaTotal(d), meta = aguaMeta(), mov = "agua:" + fecha, h = aguaHabito();
  const [y, m, dd] = fecha.split("-").map(Number);
  if (total >= meta && !d.p) {
    d.p = true; saveState();
    registrarMovimiento(mov, AGUA_PREMIO, AGUA_PREMIO, "Meta de agua", true);
    toast(`💧 ¡Meta de agua cumplida! +${AGUA_PREMIO} ⭐`);
    if (h && !habitDone(h.id, m - 1, dd, y) && (typeof tocaHoy !== "function" || tocaHoy(h))) { d.h = true; saveState(); toggleHabitDate(h.id, y, m - 1, dd); return; }
  } else if (total < meta && d.p) {
    d.p = false; saveState(); anularMovimiento(mov);
    if (d.h) { d.h = false; saveState(); if (h && habitDone(h.id, m - 1, dd, y)) { toggleHabitDate(h.id, y, m - 1, dd); return; } }
  }
  if (typeof updateTopbar === "function") updateTopbar();
}

/* -------- La tarjeta en Inicio -------- */
function aguaVasitosHtml(e) { const n = Math.min(16, Math.ceil(e.meta / e.vaso)), llenos = Math.floor(e.ml / e.vaso); return Array.from({ length: n }, (_, i) => `<i class="${i < llenos ? "is-on" : ""}"></i>`).join(""); }
function aguaCifraHtml(e) { return `${litrosTxt(e.ml)} <small>de ${litrosTxt(e.meta)} L</small>`; }
function aguaControlesHtml(e, estilo) {
  const v = e.vaso;
  return `<div class="agua-btns"><button class="btn btn--cian" data-action="agua-sumar" data-ml="${v}">+ Vaso<small>${v} ml</small></button>
      <button class="btn btn--soft" data-action="agua-sumar" data-ml="500">+ Botella<small>500 ml</small></button></div>
    <button class="btn-link agua-deshacer" data-action="agua-deshacer" ${e.n ? "" : "hidden"}>Deshacer el último</button>
    ${estilo === "bombilla" ? `<small class="agua-ayuda">También puedes mantener apretado el vaso para tomar a sorbos.</small>` : ""}`;
}
function aguaInicioHtml() {
  if (!STATE || aguaDatos().inicio === false) return "";
  const e = aguaEstado(), estilo = aguaEstilo();
  return `<div class="card agua-card" data-agua-card>
    <div class="card__head"><div class="card__title">💧 Agua de hoy</div><button type="button" class="card__hint agua-abrir" data-action="agua-abrir">Tu agua →</button></div>
    <div class="agua-card__c">
      <canvas class="agua-cv" data-agua="${estilo}" data-modo="tarjeta" style="aspect-ratio:140/200" role="img" aria-label="${escapeAttr(AGUA_ESTILOS.find(x => x.id === estilo).nombre)}: ${escapeAttr(litrosTxt(e.ml))} de ${escapeAttr(litrosTxt(e.meta))} litros"></canvas>
      <div class="agua-card__info">
        <div class="agua-cifra" data-agua-cifra aria-live="polite">${aguaCifraHtml(e)}</div>
        <div class="agua-vasos" data-agua-vasos aria-hidden="true">${aguaVasitosHtml(e)}</div>
        <small class="agua-texto" data-agua-texto>${escapeHtml(aguaTexto(estilo, e))}</small>
        ${aguaControlesHtml(e, estilo)}
      </div>
    </div>
  </div>`;
}
/* Después de registrar: los textos se cambian donde están (sin volver a dibujar la pantalla) y el agua se anima */
function aguaPintar(delta) {
  if (typeof document === "undefined") return;
  const e = aguaEstado(), estilo = aguaEstilo();
  document.querySelectorAll("[data-agua-cifra]").forEach(x => { x.innerHTML = aguaCifraHtml(e); });
  document.querySelectorAll("[data-agua-vasos]").forEach(x => { x.innerHTML = aguaVasitosHtml(e); });
  document.querySelectorAll("[data-agua-texto]").forEach(x => { x.textContent = aguaTexto(estilo, e); });
  document.querySelectorAll(".agua-deshacer").forEach(x => { x.hidden = !e.n; });
  if (document.getElementById("agua-hoy-lista")) document.getElementById("agua-hoy-lista").innerHTML = aguaListaHtml();
  if (delta) AGUA_MOTOR.verter(delta);
}

/* -------- La hoja «Tu agua» -------- */
function aguaListaHtml() {
  const regs = aguaRegistros(aguaDia(todayISO()));
  if (!regs.length) return `<p class="text-sm muted" style="margin:0">Aún no registras agua hoy.</p>`;
  return regs.slice().reverse().map(r => `<div class="agua-reg"><span>${r.ts ? new Date(r.ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span><b>${r.ml} ml</b>
    <button class="icon-btn" data-action="agua-quitar" data-id="${escapeAttr(r.id)}" aria-label="Quitar ${r.ml} ml">✕</button></div>`).join("");
}
function aguaSemanaHtml() {
  const hoy = todayISO(), meta = aguaMeta(), dias = Array.from({ length: 7 }, (_, i) => agSumar(hoy, i - 6));
  const vals = dias.map(f => aguaTotal(aguaDia(f))), tope = Math.max(meta, ...vals) * 1.08;
  return `<div class="agua-semana" role="img" aria-label="Agua de los últimos 7 días">
    <i class="agua-semana__meta" style="bottom:${(meta / tope * 100).toFixed(1)}%"></i>
    ${dias.map((f, i) => `<div class="agua-semana__d${f === hoy ? " is-hoy" : ""}"><span class="agua-semana__b${vals[i] >= meta ? " is-ok" : ""}" style="height:${(vals[i] / tope * 100).toFixed(1)}%" title="${litrosTxt(vals[i])} L"></span>
      <small>${["D", "L", "M", "M", "J", "V", "S"][new Date(f + "T12:00").getDay()]}</small></div>`).join("")}</div>`;
}
function openAgua() {
  const a = aguaDatos(), e = aguaEstado(), estilo = aguaEstilo(), sabor = aguaSabor(), auto = aguaMetaAuto();
  const tuyos = AGUA_ESTILOS.filter(x => aguaEstiloTuyo(x.id)), faltan = AGUA_ESTILOS.length - tuyos.length;
  const sabores = AGUA_SABORES.filter(x => aguaSaborTuyo(x.id)), peso = typeof pesoActualGlobal === "function" ? pesoActualGlobal(STATE) : null;
  const chip = (accion, v, txt, on) => `<button type="button" class="chip${on ? " chip--cian" : ""}" data-action="${accion}" data-v="${v}" aria-pressed="${on}">${txt}</button>`;
  openModal("Tu agua", `<div class="agua-hoja" id="agua-hoja">
    <div class="agua-card__c agua-hoja__c">
      <canvas class="agua-cv" data-agua="${estilo}" data-modo="hoja" style="aspect-ratio:140/200" role="img" aria-label="Tu agua de hoy"></canvas>
      <div class="agua-card__info">
        <div class="agua-cifra" data-agua-cifra aria-live="polite">${aguaCifraHtml(e)}</div>
        <div class="agua-vasos" data-agua-vasos aria-hidden="true">${aguaVasitosHtml(e)}</div>
        <small class="agua-texto" data-agua-texto>${escapeHtml(aguaTexto(estilo, e))}</small>
        ${aguaControlesHtml(e, estilo)}
      </div>
    </div>
    <div class="agua-sec"><span class="cj-sub">Hoy</span><div id="agua-hoy-lista" class="agua-lista">${aguaListaHtml()}</div></div>
    <div class="agua-sec"><span class="cj-sub">Esta semana</span>${aguaSemanaHtml()}</div>
    <div class="agua-sec"><span class="cj-sub">Tu meta</span><div class="agua-chips">
      ${chip("agua-meta", 0, `Automática · ${litrosTxt(auto)} L`, !(a.meta > 0))}${[1500, 2000, 2500, 3000, 3500].map(v => chip("agua-meta", v, litrosTxt(v) + " L", a.meta === v)).join("")}</div>
      <small class="text-xs muted">${peso ? `La automática sale de tu peso en Salud (${String(peso).replace(".", ",")} kg × 35 ml).` : "Con tu peso en Salud, la automática se calcula sola (35 ml por kilo)."} Al cumplirla: +${AGUA_PREMIO} ⭐ y el hábito «Agua» marcado.</small></div>
    <div class="agua-sec"><span class="cj-sub">Tu vaso</span><div class="agua-chips">${[200, 250, 300, 350].map(v => chip("agua-vaso", v, v + " ml", aguaVaso() === v)).join("")}</div></div>
    <div class="agua-sec"><span class="cj-sub">Estilo</span><div class="agua-chips">${tuyos.map(x => chip("agua-estilo", x.id, x.nombre, x.id === estilo)).join("")}
      ${faltan ? `<button type="button" class="btn-link" data-action="agua-tienda">${faltan === 1 ? "1 estilo más" : faltan + " estilos más"} en la Tienda</button>` : ""}</div>
      ${sabores.length > 1 ? `<div class="agua-chips">${sabores.map(x => chip("agua-sabor", x.id, `<i class="agua-gota" style="background:${x.c ? x.c[1] : "#2E9BDB"}"></i>${x.nombre}`, x.id === sabor)).join("")}</div>` : ""}</div>
    <label class="agua-inicio"><input type="checkbox" data-action="agua-inicio" ${a.inicio !== false ? "checked" : ""}> Mostrar «Agua de hoy» en Inicio</label>
  </div>`, { ancho: true });
}
function aguaAjuste(cambio) { Object.assign(aguaDatos(), cambio, { ts: Date.now() }); saveState(); aguaRevisar(todayISO()); openAgua(); if (typeof rerender === "function") rerender(); }
function aguaAccion(a, d, el) {
  if (a === "agua-sumar") return aguaSumar(+d.ml);
  if (a === "agua-deshacer") return aguaQuitar();
  if (a === "agua-quitar") return aguaQuitar(d.id);
  if (a === "agua-abrir") return openAgua();
  if (a === "agua-meta") return aguaAjuste({ meta: +d.v || 0 });
  if (a === "agua-vaso") return aguaAjuste({ vaso: +d.v || 250 });
  if (a === "agua-estilo") { if (!aguaEstiloTuyo(d.v)) return; eqCos().agua = d.v === "botella" ? null : d.v; saveState(); openAgua(); if (typeof rerender === "function") rerender(); return; }
  if (a === "agua-sabor") { if (!aguaSaborTuyo(d.v)) return; eqCos().sabor = d.v === "natural" ? null : d.v; saveState(); openAgua(); if (typeof rerender === "function") rerender(); return; }
  if (a === "agua-inicio") { aguaAjuste({ inicio: !!(el && el.checked) }); return; }
  if (a === "agua-tienda") { closeModal(); if (typeof TIENDA_SEC !== "undefined") TIENDA_SEC = "estilo"; return go("recompensas"); }
}
/* La Tienda: miniatura de la ficha y muestra grande en el detalle */
function aguaFichaHtml(it) {
  if (it.key === "sabor") { const s = AGUA_SABORES.find(x => x.id === it.value); return `<svg class="agua-ficha-gota" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5s-7 8-7 12.5a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z" fill="${s && s.c ? s.c[1] : "#2E9BDB"}"/></svg>`; }
  return `<canvas class="agua-ficha" data-agua="${escapeAttr(it.value)}" data-modo="muestra" data-frac="0.62" aria-hidden="true"></canvas>`;
}
function aguaMuestraHtml(it) {
  const estilo = it.key === "sabor" ? aguaEstilo() : it.value, sabor = it.key === "sabor" ? it.value : "";
  return `<canvas class="agua-cv" data-agua="${escapeAttr(estilo)}" data-modo="muestra" data-frac="0.62" ${sabor ? `data-sabor="${escapeAttr(sabor)}"` : ""} style="aspect-ratio:140/200" aria-hidden="true"></canvas>`;
}

/* ============================================================
   El dibujo: el agua (superficie con resortes, nivel con rebote, burbujas, gotas, chorros)
   y una escena por estilo, en un cuadro de 140 × 200. Cada lienzo anima solo mientras se ve.
   ============================================================ */
const AGUA_MOTOR = (() => {
  if (typeof document === "undefined") return { verter() {}, montar() {} };
  const DPR = Math.min(2, window.devicePixelRatio || 1), W = 140, H = 200;
  const QUIETO = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const C = { oscuro: false };
  const hex = c => { c = String(c || "#ffffff").trim(); if (c.startsWith("rgb")) return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); const n = parseInt(c, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const mezcla = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`; };
  const azar = (a, b) => a + Math.random() * (b - a), limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  function colores() {
    // el tema se sabe por la letra: clara sobre fondo oscuro, oscura sobre fondo claro
    const s = getComputedStyle(document.documentElement), tinta = s.getPropertyValue("--text").trim() || getComputedStyle(document.body).color;
    const [r, g, b] = hex(tinta); C.oscuro = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
    C.tinta = tinta || (C.oscuro ? "#EEF1F9" : "#141A2E");
    C.agua = C.oscuro ? "#3FAEEB" : "#2E9BDB"; C.claro = C.oscuro ? "#96DBFA" : "#8AD2F5"; C.osc = C.oscuro ? "#1D6FA8" : "#155F95";
    C.coral = C.oscuro ? "#FF7A85" : "#E8606B"; C.ambar = "#F4AE3D"; C.indigo = C.oscuro ? "#8E9BFF" : "#3949C9";
  }
  new MutationObserver(colores).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  /* La superficie: columnas unidas por resortes; un toque se esparce como ola */
  class Ola {
    constructor(n) { this.n = n; this.h = new Float32Array(n); this.v = new Float32Array(n); this.L = new Float32Array(n); this.R = new Float32Array(n); }
    tocar(f, fuerza, ancho = 2) { const c = Math.round(limitar(f, 0, 1) * (this.n - 1)); for (let i = -ancho; i <= ancho; i++) { const j = c + i; if (j >= 0 && j < this.n) this.v[j] += fuerza * (1 - Math.abs(i) / (ancho + 1)); } }
    inclinar(f) { for (let i = 0; i < this.n; i++) this.v[i] += f * (i / (this.n - 1) - 0.5) * 2; }
    paso() {
      const n = this.n, h = this.h, v = this.v, L = this.L, R = this.R;
      for (let i = 0; i < n; i++) { v[i] += -0.028 * h[i] - 0.032 * v[i]; h[i] += v[i]; }
      for (let p = 0; p < 5; p++) {
        for (let i = 0; i < n; i++) { if (i > 0) { L[i] = 0.2 * (h[i] - h[i - 1]); v[i - 1] += L[i]; } if (i < n - 1) { R[i] = 0.2 * (h[i] - h[i + 1]); v[i + 1] += R[i]; } }
        for (let i = 0; i < n; i++) { if (i > 0) h[i - 1] += L[i]; if (i < n - 1) h[i + 1] += R[i]; }
      }
      for (let i = 0; i < n; i++) h[i] = limitar(h[i], -18, 18);
    }
  }
  class Nivel { constructor(x) { this.x = x; this.v = 0; } paso(m) { if (QUIETO) { this.x = m; return; } this.v += (m - this.x) * 0.05; this.v *= 0.82; this.x += this.v; } }
  const yEn = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i], k = (x - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * k; } return pts[pts.length - 1][1]; };
  function trazar(p, pts, mover) {
    if (mover) p.moveTo(pts[0][0], pts[0][1]); else p.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) p.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    const u = pts[pts.length - 1]; p.lineTo(u[0], u[1]);
  }
  /* El agua dentro de un recipiente: colores planos, una línea de superficie y nada más */
  function pintarAgua(ctx, o) {
    const n = o.ola.n, amp = QUIETO ? 0 : 0.8, pts = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1); pts.push([o.x0 + (o.x1 - o.x0) * f, o.y + o.ola.h[i] + Math.sin(o.t * 1.7 + f * 9) * amp + Math.sin(o.t * 2.6 - f * 13) * amp * 0.45]); }
    const sup = new Path2D(); trazar(sup, pts, true);
    const cuerpo = new Path2D(); cuerpo.moveTo(o.x0 - 40, o.fondo + 80); cuerpo.lineTo(o.x0 - 40, pts[0][1]); trazar(cuerpo, pts); cuerpo.lineTo(o.x1 + 40, pts[n - 1][1]); cuerpo.lineTo(o.x1 + 40, o.fondo + 80); cuerpo.closePath();
    const cs = o.colores || [C.claro, C.agua, C.osc];
    ctx.save(); if (o.vaso) ctx.clip(o.vaso);
    const g = ctx.createLinearGradient(0, o.y - 10, 0, Math.max(o.y + 10, o.fondo));
    g.addColorStop(0, rgba(mezcla(cs[1], cs[0], 0.35), 0.92)); g.addColorStop(1, rgba(mezcla(cs[1], cs[2], 0.35), 0.95));
    ctx.fillStyle = g; ctx.fill(cuerpo);
    ctx.lineWidth = 1.4; ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.stroke(sup);
    ctx.restore();
    return pts;
  }
  class Burbujas {
    constructor() { this.l = []; }
    soltar(x, y, n = 1, r = [0.8, 2]) { for (let i = 0; i < n; i++) this.l.push({ x: x + azar(-3, 3), y: y + azar(-2, 2), r: azar(r[0], r[1]), vy: -azar(0.35, 0.8), f: Math.random() * 6 }); if (this.l.length > 80) this.l.splice(0, this.l.length - 80); }
    paso(sup, k) { this.l = this.l.filter(b => { b.y += b.vy * k; b.f += 0.12 * k; b.x += Math.sin(b.f) * 0.22 * k; return !sup || b.y > yEn(sup, b.x) + b.r; }); }
    pintar(ctx) { ctx.fillStyle = "rgba(255,255,255,.35)"; for (const b of this.l) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill(); } }
  }
  class Gotas {
    constructor() { this.l = []; }
    soltar(x, y, n, fuerza = 1) { for (let i = 0; i < n; i++) this.l.push({ x, y, vx: azar(-1.1, 1.1) * fuerza, vy: -azar(0.8, 2) * fuerza, r: azar(0.9, 2) }); }
    paso(sup, k) { this.l = this.l.filter(g => { g.vy += 0.13 * k; g.x += g.vx * k; g.y += g.vy * k; return !(g.vy > 0 && sup && g.y > yEn(sup, g.x)) && g.y < 260; }); }
    pintar(ctx, c) { ctx.fillStyle = c; for (const g of this.l) { ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 1.4, 0, 0, 6.3); ctx.fill(); } }
  }
  class Chorro {
    constructor() { this.t = 9; this.dur = 0; }
    abrir(x, y0, dur = 0.8) { this.x = x; this.y0 = y0; this.t = 0; this.dur = dur; }
    get on() { return this.t < this.dur; }
    paso(dt) { if (this.on) this.t += dt; }
    pintar(ctx, yFin, tiempo, color) {
      if (!this.on) return; const k = this.t / this.dur, w = 3.4 * Math.min(1, k * 6) * (k > 0.8 ? (1 - k) / 0.2 : 1); if (w <= 0.05) return;
      ctx.beginPath(); const n = 12;
      for (let i = 0; i <= n; i++) { const y = this.y0 + (yFin - this.y0) * i / n, ww = w * (1 - 0.35 * i / n), dx = Math.sin(tiempo * 30 + i) * 0.5; i ? ctx.lineTo(this.x - ww + dx, y) : ctx.moveTo(this.x - ww + dx, y); }
      for (let i = n; i >= 0; i--) { const y = this.y0 + (yFin - this.y0) * i / n, ww = w * (1 - 0.35 * i / n), dx = Math.sin(tiempo * 30 + i) * 0.5; ctx.lineTo(this.x + ww + dx, y); }
      ctx.closePath(); ctx.fillStyle = rgba(color, 0.85); ctx.fill();
    }
  }
  const redondeado = (x, y, w, h, r) => { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); return p; };
  const circulo = (x, y, r) => { const p = new Path2D(); p.arc(x, y, r, 0, 6.3); return p; };
  const atras = (ctx, p) => { ctx.fillStyle = C.oscuro ? "rgba(200,225,255,.06)" : "rgba(255,255,255,.75)"; ctx.fill(p); };
  const frente = (ctx, p, x0, x1, y0, y1, brillo) => {
    ctx.save(); ctx.clip(p); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(x0 + (x1 - x0) * 0.1, y0, (x1 - x0) * 0.06, y1 - y0); ctx.restore();
    if (brillo) { ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(C.agua, 0.4); ctx.stroke(p); }
    ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(C.tinta, C.oscuro ? 0.35 : 0.3); ctx.stroke(p);
  };
  const sombra = (ctx, cx, cy, rx, ry) => { ctx.fillStyle = C.oscuro ? "rgba(0,0,0,.2)" : "rgba(8,14,36,.08)"; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.3); ctx.fill(); };
  const gota = (ctx, x, y, r, c) => { ctx.beginPath(); ctx.moveTo(x, y - r * 1.7); ctx.bezierCurveTo(x + r * 0.5, y - r * 0.9, x + r, y - r * 0.35, x + r, y + r * 0.15); ctx.arc(x, y + r * 0.15, r, 0, Math.PI); ctx.bezierCurveTo(x - r, y - r * 0.35, x - r * 0.5, y - r * 0.9, x, y - r * 1.7); ctx.fillStyle = c; ctx.fill(); };
  const alturaCirculo = (f, R) => { let a = 0, b = 2 * R; for (let i = 0; i < 26; i++) { const h = (a + b) / 2, A = R * R * Math.acos(limitar((R - h) / R, -1, 1)) - (R - h) * Math.sqrt(Math.max(0, 2 * R * h - h * h)); if (A / (Math.PI * R * R) < f) a = h; else b = h; } return (a + b) / 2; };

  /* -------- Las escenas: cada una recibe el estado (ml, meta, frac…) en cada cuadro -------- */
  const ESCENAS = {
    botella() {
      const forma = new Path2D("M58 28 L82 28 L83 42 C84 54 114 58 114 78 L114 182 Q114 196 100 196 L40 196 Q26 196 26 182 L26 78 C26 58 56 54 57 42 Z");
      const ola = new Ola(30), burb = new Burbujas(), gotas = new Gotas(), chorro = new Chorro(); let tapa = 0, tapaMeta = 0, espera = 0;
      const yDe = f => 192 - 146 * limitar(f, 0, 1);
      return {
        verter(ml) { if (ml > 0) { tapaMeta = 1; chorro.abrir(70, -8, 0.8); espera = 0.28; setTimeout(() => { tapaMeta = 0; }, 950); } else ola.tocar(0.5, -3, 6); },
        tocar(x) { ola.tocar((x - 26) / 88, azar(-5, 5), 3); burb.soltar(x, 186, 3); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; chorro.paso(dt); for (let i = 0; i < k; i++) { ola.paso(); tapa += (tapaMeta - tapa) * 0.14; }
          if (espera <= 0) nivel.paso(Math.min(1, e.frac)); else nivel.paso(nivel.x);
          sombra(ctx, 70, 198, 46, 4); atras(ctx, forma);
          const pts = pintarAgua(ctx, { vaso: forma, x0: 26, x1: 114, y: yDe(nivel.x), fondo: 198, ola, t, colores: cs });
          const ys = yEn(pts, 70);
          if (chorro.on) { ola.tocar(0.5, 0.55 * k, 1); if (Math.random() < 0.4) burb.soltar(70, ys + 8, 1); if (Math.random() < 0.3) gotas.soltar(70, ys, 1, 0.9); }
          ctx.save(); ctx.clip(forma); burb.paso(pts, k); burb.pintar(ctx); ctx.restore();
          chorro.pintar(ctx, ys, t, cs ? cs[1] : C.agua); gotas.paso(pts, k); gotas.pintar(ctx, cs ? cs[1] : C.agua);
          ctx.font = "700 7.5px system-ui, sans-serif"; ctx.textAlign = "right";
          [0.25, 0.5, 0.75].forEach(f => { const yy = yDe(f), bajo = yy > yEn(pts, 104); ctx.fillStyle = bajo ? "rgba(255,255,255,.85)" : rgba(C.tinta, 0.45); ctx.fillRect(100, yy - 0.7, 10, 1.4); ctx.fillText(litrosTxt(e.meta * f), 97, yy + 2.6); });
          frente(ctx, forma, 26, 114, 28, 196, e.frac >= 1);
          ctx.save(); ctx.translate(70 + tapa * 12, 28 - tapa * 26); ctx.rotate(-tapa * 0.55); ctx.fillStyle = C.indigo; ctx.fill(redondeado(-16, -20, 32, 20, 5));
          ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1; for (let x = -10; x <= 10; x += 5) { ctx.beginPath(); ctx.moveTo(x, -16); ctx.lineTo(x, -4); ctx.stroke(); } ctx.restore();
        },
      };
    },
    burbuja() {
      const ola = new Ola(36), burb = new Burbujas(), gotas = new Gotas(), modos = [2, 3, 4].map(m => ({ m, a: 0, v: 0, f: Math.random() * 6 })), caidas = [];
      const sacudir = f => modos.forEach(o => { o.v += f * azar(-1, 1) / o.m; });
      let espera = 0;
      return {
        verter(ml) { if (ml > 0) { caidas.push({ x: 70 + azar(-10, 10), y: -10, vy: 1.6, cruzo: false }); espera = 0.7; } else sacudir(0.02); },
        tocar() { sacudir(0.03); ola.tocar(Math.random(), azar(-4, 4), 3); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; for (let i = 0; i < k; i++) { ola.paso(); modos.forEach(o => { o.v += -(0.035 + 0.012 * o.m) * o.a - 0.05 * o.v; o.a = limitar(o.a + o.v, -0.12, 0.12); }); }
          if (espera <= 0) nivel.paso(Math.min(1, e.frac)); else nivel.paso(nivel.x);
          const f = nivel.x, R = 50 + 6 * Math.min(1, f), cx = 70 + (QUIETO ? 0 : Math.sin(t * 0.7) * 2), cy = 102 + (QUIETO ? 0 : Math.sin(t * 1.1) * 3);
          sombra(ctx, cx, 192, R * 0.7, 4);
          const N = 64, pts = []; for (let i = 0; i < N; i++) { const a = i / N * 6.283; let r = 1; modos.forEach(o => { r += o.a * Math.cos(o.m * a + o.f); }); pts.push([cx + Math.cos(a) * R * r, cy + Math.sin(a) * R * r]); }
          const forma = new Path2D(); forma.moveTo((pts[N - 1][0] + pts[0][0]) / 2, (pts[N - 1][1] + pts[0][1]) / 2);
          for (let i = 0; i < N; i++) { const p = pts[i], q = pts[(i + 1) % N]; forma.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
          atras(ctx, forma);
          const sup = f > 0.003 ? pintarAgua(ctx, { vaso: forma, x0: cx - R - 6, x1: cx + R + 6, y: cy + R - alturaCirculo(Math.min(1, f), R), fondo: cy + R + 8, ola, t, colores: cs }) : null;
          if (sup) { if (!QUIETO && Math.random() < 0.04 * k) burb.soltar(cx + azar(-R / 2, R / 2), cy + R - 6, 1); ctx.save(); ctx.clip(forma); burb.paso(sup, k); burb.pintar(ctx); gotas.paso(sup, k); gotas.pintar(ctx, cs ? cs[1] : C.agua); ctx.restore(); }
          for (let i = caidas.length - 1; i >= 0; i--) {
            const c = caidas[i]; c.vy += 0.2 * k; c.y += c.vy * k;
            if (!c.cruzo && c.y > cy - R) { c.cruzo = true; sacudir(0.025); }
            const s = sup ? yEn(sup, c.x) : cy + R;
            if (c.y >= s) { caidas.splice(i, 1); ola.tocar((c.x - (cx - R - 6)) / (2 * R + 12), 6, 2); gotas.soltar(c.x, s, 8, 1.2); burb.soltar(c.x, s + 8, 5); espera = 0; continue; }
            ctx.save(); if (c.cruzo) ctx.clip(forma); gota(ctx, c.x, c.y, 5, cs ? cs[1] : C.agua); ctx.restore();
          }
          if (ctx.createConicGradient) { const g = ctx.createConicGradient(t * 0.35, cx, cy); [["#FF8AD0", 0], ["#FFD978", 0.25], ["#8CF5B4", 0.5], ["#78C8FF", 0.75], ["#FF8AD0", 1]].forEach(([c, o]) => g.addColorStop(o, rgba(c, 0.5))); ctx.strokeStyle = g; } else ctx.strokeStyle = "rgba(120,200,255,.5)";
          ctx.lineWidth = 2; ctx.stroke(forma);
          if (e.frac >= 1) { ctx.lineWidth = 4; ctx.strokeStyle = rgba(C.agua, 0.3); ctx.stroke(forma); }
          ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 0.8, Math.PI * 1.1, Math.PI * 1.34); ctx.stroke();
        },
      };
    },
    cantimplora() {
      const CX = 70, CY = 98, R = 44, interior = circulo(CX, CY, R), ola = new Ola(26), burb = new Burbujas(), chorro = new Chorro();
      let a = 0, va = 0, espera = 0;
      const nivelDe = e => { if (e.frac >= 1) return 1; const tramo = e.meta / 4, dentro = e.ml - Math.floor(e.ml / tramo) * tramo; return 1 - dentro / tramo; };
      return {
        verter(ml) { va += 0.09; ola.inclinar(-2.5); ola.tocar(0.85, -3, 3); if (ml > 0) { const e = aguaEstado(), tramo = e.meta / 4; if (Math.floor(e.ml / tramo) !== Math.floor((e.ml - ml) / tramo)) { chorro.abrir(CX, -8, 1); espera = 0.2; } } },
        tocar() { va += azar(-0.07, 0.07); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; chorro.paso(dt);
          for (let i = 0; i < k; i++) { ola.paso(); const ant = a; va += -a * 0.07; va *= 0.9; a += va; if (QUIETO) a = 0; ola.inclinar((a - ant) * 14); }
          if (espera <= 0) nivel.paso(nivelDe(e)); else nivel.paso(0);
          sombra(ctx, CX, 150, 44, 4);
          const girar = () => { ctx.translate(CX, CY); ctx.rotate(a); ctx.translate(-CX, -CY); };
          const caqui = C.oscuro ? "#6E6A48" : "#8C8556";
          ctx.save(); girar(); ctx.lineCap = "round"; ctx.lineWidth = 5; ctx.strokeStyle = mezcla(caqui, "#000000", 0.2);
          ctx.beginPath(); ctx.moveTo(CX - 50, CY - 22); ctx.bezierCurveTo(CX - 64, CY - 110, CX + 64, CY - 110, CX + 50, CY - 22); ctx.stroke();
          ctx.lineWidth = 11; ctx.strokeStyle = caqui; ctx.beginPath(); ctx.arc(CX, CY, R + 5, 0, 6.3); ctx.stroke();
          ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.beginPath(); ctx.arc(CX, CY, R + 5, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
          atras(ctx, interior); ctx.restore();
          const pts = pintarAgua(ctx, { vaso: interior, x0: CX - R, x1: CX + R, y: CY + R - 4 - (2 * R - 10) * limitar(nivel.x, 0, 1), fondo: CY + R + 2, ola, t, colores: cs });
          const ys = yEn(pts, CX);
          if (chorro.on) { ola.tocar(0.5, 0.6 * k, 1); if (Math.random() < 0.4) burb.soltar(CX, ys + 8, 1); }
          ctx.save(); ctx.clip(interior); burb.paso(pts, k); burb.pintar(ctx); ctx.restore();
          chorro.pintar(ctx, ys, t, cs ? cs[1] : C.agua);
          ctx.save(); girar(); frente(ctx, interior, CX - R, CX + R, CY - R, CY + R, e.frac >= 1);
          ctx.fillStyle = C.oscuro ? "#8D98A8" : "#B9C2D0"; ctx.fill(redondeado(CX - 7, CY - R - 12, 14, 13, 3));
          if (!chorro.on) { ctx.fillStyle = "#5C6B3C"; ctx.fill(redondeado(CX - 11, CY - R - 22, 22, 11, 4)); }
          ctx.restore();
          // los cuatro tramos del día
          const tramo = e.meta / 4, hechos = Math.min(4, Math.floor(e.ml / tramo));
          ctx.strokeStyle = rgba(C.tinta, 0.15); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(28, 182); ctx.lineTo(112, 182); ctx.stroke();
          for (let i = 0; i < 4; i++) { const x = 28 + i * 28; ctx.beginPath(); ctx.arc(x, 182, 6, 0, 6.3); ctx.fillStyle = i < hechos ? "#2F9E74" : i === hechos ? C.ambar : (C.oscuro ? "#2A3358" : "#E3E8F1"); ctx.fill(); }
        },
      };
    },
    bombilla() {
      const forma = new Path2D("M20 40 L120 40 L108 184 Q107 194 97 194 L43 194 Q33 194 32 184 Z"), ola = new Ola(28), burb = new Burbujas(), chorro = new Chorro();
      const hielos = [{ x: 46, s: 15, r: 0.3, f: 0 }, { x: 68, s: 13, r: -0.4, f: 2 }, { x: 92, s: 12, r: 0.7, f: 4 }];
      const B = [[84, 190], [104, 30], [106, 18], [122, 10]];
      let sorbo = 0, flujo = 0, espera = 0, lleno = false;
      const nivelDe = (e, s) => e.frac >= 1 ? 1 : Math.max(0, 1 - (e.ml + s) / e.meta);
      const api = {
        sorbiendo: false,
        verter(ml) { if (ml > 0) { flujo = 1; setTimeout(() => { flujo = 0; }, 700); espera = 0.1; const e = aguaEstado(); if (e.frac >= 1 && !lleno) { chorro.abrir(52, -8, 1.2); } } else ola.tocar(0.5, -3, 6); },
        tocar() {},
        sorbo(ml) { sorbo = ml; },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; chorro.paso(dt); for (let i = 0; i < k; i++) ola.paso();
          lleno = e.frac >= 1;
          if (api.sorbiendo) flujo += (1 - flujo) * 0.2; else if (!flujo) flujo = 0;
          nivel.paso(nivelDe(e, api.sorbiendo ? sorbo : 0));
          if (flujo > 0.1 && !lleno) ola.tocar((B[0][0] + 6 - 20) / 100, -0.45 * flujo, 1);
          sombra(ctx, 70, 196, 42, 4); atras(ctx, forma);
          const pts = pintarAgua(ctx, { vaso: forma, x0: 20, x1: 120, y: 188 - 140 * limitar(nivel.x, 0, 1), fondo: 196, ola, t, colores: cs });
          const ys = yEn(pts, 52);
          if (chorro.on) { ola.tocar((52 - 20) / 100, 0.6 * k, 1); }
          if (flujo > 0.3 && Math.random() < 0.25) burb.soltar(86, 186, 1, [0.6, 1.4]);
          const bombilla = (dx, alfa) => {
            ctx.save(); ctx.globalAlpha = alfa; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); ctx.moveTo(B[0][0] + dx, B[0][1]); B.slice(1).forEach(p => ctx.lineTo(p[0] + dx, p[1])); ctx.lineWidth = 6.5; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
            ctx.setLineDash([5, 5]); ctx.strokeStyle = C.coral; ctx.stroke(); ctx.setLineDash([]);
            if (flujo > 0.02) { ctx.setLineDash([6, 4]); ctx.lineDashOffset = t * 60; ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(cs ? cs[1] : C.agua, 0.9 * flujo); ctx.beginPath(); ctx.moveTo(B[0][0] + dx, B[0][1]); B.slice(1).forEach(p => ctx.lineTo(p[0] + dx, p[1])); ctx.stroke(); ctx.setLineDash([]); }
            ctx.restore();
          };
          const corte = yEn(pts, 100);
          ctx.save(); const sobre = new Path2D(); sobre.rect(0, -10, W, 10 + corte); ctx.clip(sobre); bombilla(0, 1); ctx.restore();
          ctx.save(); ctx.clip(forma); const bajo = new Path2D(); bajo.rect(0, corte, W, H); ctx.clip(bajo); bombilla(2.5, 0.75); ctx.restore();
          ctx.save(); ctx.clip(forma);
          hielos.forEach(h => { const s0 = yEn(pts, h.x), yy = Math.min(188 - h.s / 2, s0 + h.s * 0.12 + Math.sin(t * 1.6 + h.f) * 1.1); ctx.save(); ctx.translate(h.x, yy); ctx.rotate(h.r + Math.sin(t * 1.1 + h.f) * 0.08); ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fill(redondeado(-h.s / 2, -h.s / 2, h.s, h.s, 3.5)); ctx.restore(); });
          burb.paso(pts, k); burb.pintar(ctx); ctx.restore();
          chorro.pintar(ctx, ys, t, cs ? cs[1] : C.agua);
          frente(ctx, forma, 20, 120, 40, 194, lleno);
          ctx.save(); ctx.translate(26, 42); ctx.rotate(-0.5); ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.closePath(); ctx.fillStyle = "#F7D54A"; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 9.5, Math.PI, 0); ctx.closePath(); ctx.fillStyle = "#FFF3A8"; ctx.fill(); ctx.restore();
          if (api.sorbiendo && sorbo > 0) { ctx.font = "800 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = C.tinta; ctx.fillText(`+${Math.round(sorbo)} ml`, 70, 26); }
        },
      };
      return api;
    },
    reloj() {
      const A = new Path2D("M65 96 C65 86 30 80 30 54 C30 32 46 22 70 22 C94 22 110 32 110 54 C110 80 75 86 75 96 Z");
      const Bp = new Path2D("M65 104 C65 114 30 120 30 146 C30 168 46 178 70 178 C94 178 110 168 110 146 C110 120 75 114 75 104 Z");
      const todo = new Path2D(); todo.addPath(A); todo.addPath(Bp); todo.rect(65.5, 94, 9, 12);
      const olaA = new Ola(22), olaB = new Ola(22), burb = new Burbujas(); let giro = -1;
      return {
        verter(ml) { if (ml > 0 && giro < 0) giro = 0; else olaB.tocar(0.5, -3, 6); },
        tocar() { olaA.tocar(Math.random(), -3, 3); olaB.tocar(Math.random(), 3, 3); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          for (let i = 0; i < k; i++) { olaA.paso(); olaB.paso(); }
          let ang = 0;
          if (giro >= 0) { giro += dt / (QUIETO ? 0.01 : 1); const s = Math.min(1, giro); ang = Math.PI * (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2); if (giro >= 1) { giro = -1; ang = 0; olaA.tocar(0.5, 5, 8); } }
          nivel.paso(giro >= 0 ? nivel.x : aguaRelojQueda(e));
          const arriba = limitar(nivel.x, 0, 1);
          sombra(ctx, 70, 196, 50, 4);
          ctx.save(); ctx.translate(70, 100); ctx.rotate(ang); ctx.translate(-70, -100);
          ctx.fillStyle = "#B07E52"; ctx.fill(redondeado(18, 8, 104, 12, 4)); ctx.fill(redondeado(18, 180, 104, 12, 4));
          ctx.fillStyle = "#9C6B42"; ctx.fillRect(22, 20, 6, 160); ctx.fillRect(112, 20, 6, 160);
          atras(ctx, todo);
          if (arriba > 0.003) pintarAgua(ctx, { vaso: A, x0: 30, x1: 110, y: 94 - 70 * Math.pow(arriba, 0.85), fondo: 98, ola: olaA, t, colores: cs });
          const ptsB = pintarAgua(ctx, { vaso: Bp, x0: 30, x1: 110, y: 176 - 70 * Math.pow(1 - arriba, 0.85), fondo: 180, ola: olaB, t, colores: cs });
          if (arriba > 0.003 && giro < 0) {
            const ys = yEn(ptsB, 70); ctx.save(); ctx.clip(todo); ctx.strokeStyle = rgba(cs ? cs[1] : C.agua, 0.85); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(70, 96); ctx.lineTo(70, ys); ctx.stroke(); ctx.restore();
            if (Math.random() < 0.25 * k) { olaB.tocar(0.5, 0.7, 1); burb.soltar(70, ys + 5, 1, [0.5, 1.2]); }
          }
          ctx.save(); ctx.clip(Bp); burb.paso(ptsB, k); burb.pintar(ctx); ctx.restore();
          frente(ctx, A, 30, 110, 22, 96, arriba <= 0.003 && giro < 0);
          frente(ctx, Bp, 30, 110, 104, 178);
          ctx.restore();
        },
      };
    },
  };

  /* -------- Montar un lienzo: su escena, su tamaño, su animación (solo mientras se ve) -------- */
  const vivas = new Set(), ultimo = {};
  function montar(cv) {
    if (cv.dataset.listo) return; cv.dataset.listo = "1";
    if (!C.tinta) colores();
    const estilo = ESCENAS[cv.dataset.agua] ? cv.dataset.agua : "botella", modo = cv.dataset.modo || "tarjeta";
    const escena = ESCENAS[estilo](), ctx = cv.getContext("2d"), clave = modo + estilo;
    const muestra = modo === "muestra", fracFija = +cv.dataset.frac || 0.62;
    const estado = () => { if (!muestra) return aguaEstado(); const meta = 2000; return { ml: meta * fracFija, meta, vaso: 250, frac: fracFija, ultimo: Date.now() - 30 * 60000, n: 1 }; };
    const e0 = estado(), niv = new Nivel(ultimo[clave] != null ? ultimo[clave] : estilo === "bombilla" ? Math.max(0, 1 - e0.frac) : estilo === "cantimplora" ? 1 : estilo === "reloj" ? aguaRelojQueda(e0) : Math.min(1, e0.frac));
    let k = 1, activo = 2.5, vivo = false, id = 0, ant = 0, cuadro = 0;
    const medir = () => { const w = cv.clientWidth || W; k = w / W; const pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(w * H / W * DPR)); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } };
    medir();
    const obj = { cv, escena, despertar() { activo = 3; if (!vivo && visible) arrancar(); } };
    const pintar = (t, dt) => {
      const ks = QUIETO ? 1 : Math.max(1, Math.min(3, Math.round(dt * 60)));
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(k * DPR, 0, 0, k * DPR, 0, 0);
      const sabor = cv.dataset.sabor || aguaSabor(), cs = (AGUA_SABORES.find(s => s.id === sabor) || {}).c || null;
      escena.dibujar(ctx, t, ks, dt, estado(), niv, cs);
      ultimo[clave] = niv.x;
    };
    let visible = false;
    const t0 = performance.now();
    const marco = ahora => {
      if (!cv.isConnected) { vivo = false; vivas.delete(obj); return; }
      const dt = Math.min(0.05, Math.max(0.001, (ahora - ant) / 1000)); ant = ahora; activo -= dt; cuadro++;
      // tranquila, el agua se mueve a 20 cuadros por segundo; después de un vaso, a 60
      if (activo > 0 || cuadro % 3 === 0) pintar((ahora - t0) / 1000, activo > 0 ? dt : dt * 3);
      if (vivo && visible && !document.hidden && !QUIETO) id = requestAnimationFrame(marco); else vivo = false;
    };
    const arrancar = () => { vivo = true; ant = performance.now(); id = requestAnimationFrame(marco); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !vivo) arrancar(); }, { rootMargin: "80px" }).observe(cv);
    if (window.ResizeObserver) new ResizeObserver(() => { medir(); pintar((performance.now() - t0) / 1000, 1 / 60); }).observe(cv);
    pintar(0, 1 / 60);
    if (!muestra) {
      vivas.add(obj);
      cv.addEventListener("pointerdown", ev => {
        const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * W;
        escena.tocar && escena.tocar(x); obj.despertar();
        if (estilo === "bombilla" && escena.sorbo) { ev.preventDefault(); empezarSorbo(obj, ev); }
      });
      if (estilo === "bombilla") { cv.style.touchAction = "none"; cv.addEventListener("contextmenu", ev => ev.preventDefault()); }
    }
    return obj;
  }
  /* La bombilla: mientras mantienes apretado, tomas ~100 ml por segundo; al soltar, se registra */
  function empezarSorbo(obj, ev) {
    const esc = obj.escena; let ml = 0, ant = performance.now(), on = true;
    esc.sorbiendo = true; esc.sorbo(0); vibrar(12);
    const tic = () => { if (!on) return; const ahora = performance.now(); ml += (ahora - ant) / 1000 * 100; ant = ahora; esc.sorbo(ml); obj.despertar(); if (Math.random() < 0.15) vibrar(4); if (ml < 1500) requestAnimationFrame(tic); else fin(); };
    const fin = () => { if (!on) return; on = false; esc.sorbiendo = false; esc.sorbo(0); window.removeEventListener("pointerup", fin); window.removeEventListener("pointercancel", fin); const r = Math.round(ml / 10) * 10; if (r >= 10) { aguaSumar(r); toast(`💧 Tomaste ${r} ml`); } };
    window.addEventListener("pointerup", fin); window.addEventListener("pointercancel", fin);
    requestAnimationFrame(tic);
  }
  function verter(ml) { vivas.forEach(o => { if (!o.cv.isConnected) { vivas.delete(o); return; } o.escena.verter(ml); o.despertar(); }); }
  // Cada lienzo nuevo (Inicio, la hoja, la Tienda) se monta solo
  let espera = null;
  new MutationObserver(() => { if (espera) return; espera = setTimeout(() => { espera = null; document.querySelectorAll("canvas[data-agua]:not([data-listo])").forEach(montar); }, 20); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) vivas.forEach(o => o.despertar()); });
  return { montar, verter };
})();
