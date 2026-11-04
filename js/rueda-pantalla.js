/* ============================================================
   RUMBO · 🧭 La pantalla de la Rueda de la vida (rueda-pantalla.js)
   La lógica y el dibujo están en rueda.js. Aquí: la pantalla (la rueda que se arrastra, las áreas,
   la ficha de cada una con sus pistas, su frase y el paso chico, tu rumbo del mes, todas las áreas con
   barras y tu año), «El minuto de la rueda», «Ver mi rumbo», compartir, el probador de estilos, tus
   áreas, el área de un objetivo y el paso «Rueda» del cierre del mes.
   ============================================================ */

/* ============ La pantalla ============ */
function rdFmt(x) { return String(x).replace(".", ","); }
function rdPromTxt(S, y, m) {
  const R = ruedaRumbo(S, y, m), [, ma] = ruedaAntes(y, m);
  if (R.prom == null) return "Todavía sin notas";
  const d = R.promAnt != null ? Math.round((R.prom - R.promAnt) * 10) / 10 : null;
  return `Promedio ${rdFmt(R.prom)}${d != null ? ` (${d >= 0 ? "+" : ""}${rdFmt(d)} desde ${MESES[ma].toLowerCase()})` : ""}`;
}
function rdOpciones(S, y, m) {
  const D = ruedaDibujoDatos(S, y, m);
  return { D, op: { estilo: ruedaEstilo(), cols: D.cols, ant: D.ant, etiquetas: D.etiquetas, sel: D.vis.indexOf(RD.sel), aria: `Rueda de la vida de ${MESES[m].toLowerCase()}: ` + D.vis.map((k, i) => `${D.etiquetas[i].corto} ${D.vals[i]}`).join(", ") } };
}
function renderRueda() {
  const S = STATE, y = anioVista(), m = RUEDA_MONTH, [, ma] = ruedaAntes(y, m);
  const { D, op } = rdOpciones(S, y, m);
  if (!D.vis.includes(RD.sel)) { RD.sel = D.vis[0]; op.sel = 0; }
  const E = RUEDA_ESTILOS.find(e => e.id === ruedaEstilo()), vacio = !D.vals.some(v => v > 0);
  return `${selectorAnio()}
  ${monthsSelector(m, "rueda-month")}
  ${vacio && typeof ruedaEnsenaHtml === "function" ? ruedaEnsenaHtml() : ""}
  <div class="rd">
    <section class="card rd-rueda" aria-labelledby="rd-t">
      <div class="rd-cab"><div><h2 class="card__title" id="rd-t">${MESES[m]}${y !== anioActual() ? " " + y : ""}</h2><span class="text-sm muted" id="rd-prom">${rdPromTxt(S, y, m)}</span></div>
        <button type="button" class="btn-ghost rd-estilo" data-action="ru-probador">${escapeHtml(E.nombre)} ›</button></div>
      <div class="rd-lienzo">${ruedaSVG(D.vals, Object.assign({}, op, { id: "rd-svg", arrastre: "pantalla" }))}</div>
      <div class="rd-ley" aria-hidden="true"><span><i class="rd-ley__l"></i>${MESES[m]}</span>${D.ant ? `<span><i class="rd-ley__p"></i>${MESES[ma]}</span>` : ""}</div>
      <p class="text-xs muted rd-ayuda">Arrastra cada punta desde el centro hasta su nota, o toca un área y usa − y +.</p>
      <div class="rd-bts"><button type="button" class="btn btn--soft" data-action="ru-minuto">${icoUI("timer")} El minuto de la rueda</button>
        ${vacio ? "" : `<button type="button" class="btn-ghost" data-action="ru-momento">${icoUI("compass")} Ver mi rumbo</button><button type="button" class="btn-ghost" data-action="ru-compartir">${icoUI("compartir")} Compartir</button>`}</div>
    </section>
    <div class="rd-panel">
      <div class="rd-areas" id="rd-areas" role="group" aria-label="Áreas">${rdChipsHtml(S, y, m)}</div>
      <section class="card rd-ficha" id="rd-ficha">${rdFichaHtml(S, y, m, RD.sel)}</section>
      <div class="rd-rumbo" id="rd-rumbo">${rdRumboHtml(S, y, m)}</div>
    </div>
  </div>
  <section class="card rd-barras" aria-labelledby="rd-bt">
    <div class="rd-barras__cab"><h2 class="card__title" id="rd-bt">Todas las áreas</h2><button type="button" class="btn-ghost" data-action="ru-areas-editar">${icoUI("settings")} Tus áreas</button></div>
    ${rdBarrasHtml(S, y, m)}
  </section>
  ${rdAnioHtml(S, y)}`;
}
function rdChipsHtml(S, y, m) {
  const v = ruedaMes(S, y, m);
  return ruedaVisibles(S).map(k => `<button type="button" class="rd-chip" data-action="ru-sel" data-k="${k}" aria-pressed="${k === RD.sel}" style="--c:${ruedaColor(S, k)}"><span>${escapeHtml(ruedaCorto(S, k))}</span><b>${v[k]}</b></button>`).join("");
}
function rdFichaHtml(S, y, m, k) {
  const v = ruedaMes(S, y, m)[k], [ya, ma] = ruedaAntes(y, m), antes = ruedaMes(S, ya, ma), hayAnt = ruedaHay(S, antes), col = ruedaColor(S, k), mes = MESES[m].toLowerCase(), mesAnt = MESES[ma].toLowerCase();
  const dif = hayAnt ? v - antes[k] : null, pistas = ruedaPistas(S, y, m, k), cu = ruedaCuidan(S, y, m, k), paso = ruedaPaso(S, y, m), fr = ruedaFrase(S, y, m, k), frAnt = ruedaFrase(S, ya, ma, k), nom = ruedaNombre(S, k);
  const cuidan = cu.habitos.map(h => h.nombre).concat(cu.objetivos.map(o => o.texto));
  return `<div class="rd-ficha__cab"><h3 class="rd-ficha__t"><span class="rd-punto" style="background:${col}"></span>${escapeHtml(nom)}</h3>
      <div class="rd-ajuste"><button type="button" class="rd-aj" data-action="ru-menos" aria-label="Bajar la nota de ${escapeAttr(nom)}">−</button><output id="rd-nota" aria-live="polite">${v}</output><button type="button" class="rd-aj" data-action="ru-mas" aria-label="Subir la nota de ${escapeAttr(nom)}">+</button></div></div>
    ${dif != null ? `<span class="rd-dif${dif > 0 ? " sube" : dif < 0 ? " baja" : ""}">${dif > 0 ? "↑ +" + dif : dif < 0 ? "↓ " + dif : "Igual que"} ${dif === 0 ? "en " + mesAnt : "desde " + mesAnt}</span>` : ""}
    <div class="rd-dice"><small>Lo que dice tu Rumbo en ${mes}</small>${pistas.length ? `<ul>${pistas.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`
      : `<p class="text-sm muted">Este mes no hay datos de esta área en Rumbo. Puedes asignarle hábitos (al crearlos o editarlos) y objetivos.</p>`}</div>
    ${cuidan.length ? `<p class="text-xs muted rd-cuidan">La cuidan: ${cuidan.map(escapeHtml).join(", ")}</p>` : ""}
    <div class="field rd-frase"><label for="rd-frase">¿Por qué un ${v}? <span class="text-xs muted">(solo tú la ves)</span></label>
      <input class="input" id="rd-frase" maxlength="100" value="${escapeAttr(fr)}" placeholder="Una línea, si quieres" onchange="rdFraseGuardar(this.value)">
      ${frAnt ? `<span class="text-xs muted">En ${mesAnt} escribiste: «${escapeHtml(frAnt)}»</span>` : ""}</div>
    ${paso && paso.k === k ? `<div class="rd-paso" style="--c:${col}"><span><b>Es el área que pide cariño.</b> ${escapeHtml(paso.txt)}</span>
      <span class="rd-paso__b"><button type="button" class="btn btn--primary" data-action="ru-paso">${paso.btn}</button><button type="button" class="btn-ghost" data-action="ru-paso-no">Ahora no</button></span></div>` : ""}`;
}
function rdRumboHtml(S, y, m) { const t = ruedaRumboTxt(S, ruedaRumbo(S, y, m)); return `<small>Tu rumbo de ${MESES[m].toLowerCase()}</small><b>${escapeHtml(t.t)}</b><span>${escapeHtml(t.s)}</span>`; }
function rdBarrasHtml(S, y, m) {
  const v = ruedaMes(S, y, m), pre = rutaAnio(y);
  return `<div class="rd-barras__l">${ruedaVisibles(S).map(k => `<div class="field rd-barra" style="--c:${ruedaColor(S, k)}">${elNota("rv-r-" + k, v[k], { min: 0, max: 10, titulo: escapeHtml(ruedaNombre(S, k)), label: ruedaNombre(S, k),
    attrs: `data-bind="${pre}rueda.meses.${m}.${k}" data-type="num" data-live` })}</div>`).join("")}</div>`;
}
function rdAnioHtml(S, y) {
  const vis = ruedaVisibles(S), meses = Array.from({ length: 12 }, (_, m) => ruedaMes(S, y, m));
  if (!meses.some(v => ruedaHay(S, v))) return "";
  if (RD.anioK != null && !vis.includes(RD.anioK)) RD.anioK = null;
  const filas = vis.map(k => { const c = ruedaColor(S, k);
    return `<button type="button" class="rd-anio__f${RD.anioK === k ? " is-on" : ""}" data-action="ru-anio-area" data-k="${k}" aria-pressed="${RD.anioK === k}"><span class="rd-anio__n">${escapeHtml(ruedaCorto(S, k))}</span>${meses.map((v, m) => `<i style="background:${v[k] ? rdA(c, 0.16 + 0.084 * v[k]) : "transparent"}" title="${MESES_CORTO[m]}: ${v[k] || "sin nota"}">${v[k] || ""}</i>`).join("")}</button>`; }).join("");
  const linea = RD.anioK != null && typeof svgLine === "function" ? `<div class="rd-anio__linea"><span class="text-sm"><b>${escapeHtml(ruedaNombre(S, RD.anioK))}</b> en ${y}</span>${svgLine(meses.map(v => v[RD.anioK] || null), { color: ruedaColor(S, RD.anioK), fmt: v => v })}</div>` : "";
  return `<section class="card rd-anio" aria-labelledby="rd-at"><div class="rd-barras__cab"><h2 class="card__title" id="rd-at">Tu año, área por área</h2><span class="text-xs muted">Toca un área para ver su línea</span></div>
    <div class="rd-anio__t"><div class="rd-anio__cab"><span></span>${MESES_CORTO.map(x => `<b>${x[0]}</b>`).join("")}</div>${filas}</div>${linea}</section>`;
}

/* ============ Arrastrar sobre la rueda (la pantalla y el cierre del mes) ============ */
function rdLocal(svg, ev) { const m = svg.getScreenCTM(); if (!m) return null; let q = svg.createSVGPoint(); q.x = ev.clientX; q.y = ev.clientY; q = q.matrixTransform(m.inverse()); return [q.x, q.y]; }
function rdEn(svg, q, n) {
  const E = RUEDA_ESTILOS.find(e => e.id === svg.dataset.estilo) || RUEDA_ESTILOS[0], dx = q[0] - 160, dy = q[1] - 160, dist = Math.hypot(dx, dy);
  let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
  const i = Math.round(a / (Math.PI * 2 / n)) % n;
  return { i, dentro: dist <= 168, v: Math.round(Math.max(0, Math.min(1, (dist - E.r0) / (E.r10 - E.r0))) * 10) };
}
function rdArrastreIni(ev) {
  const svg = ev.target && ev.target.closest && ev.target.closest("svg.rd-svg[data-arrastre]"); if (!svg) return;
  const q = rdLocal(svg, ev); if (!q) return;
  const fuente = svg.dataset.arrastre, vis = ruedaVisibles(STATE), hit = rdEn(svg, q, vis.length);
  RD.drag = { svg, fuente, i: hit.i, id: ev.pointerId, ultimo: null };
  try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
  if (fuente === "pantalla") { RD.sel = vis[hit.i]; if (!hit.dentro) { RD.drag = null; return rdRefrescar(true); } }
  rdArrastrar(ev);
}
function rdArrastrar(ev) {
  const D = RD.drag; if (!D) return;
  const q = rdLocal(D.svg, ev); if (!q) return;
  const vis = ruedaVisibles(STATE), v = rdEn(D.svg, q, vis.length).v, k = vis[D.i];
  if (v === D.ultimo) return;
  if (D.ultimo != null && typeof vibrar === "function") vibrar(4);
  D.ultimo = v;
  if (D.fuente === "pantalla") { ruedaPoner(STATE, anioVista(), RUEDA_MONTH, k, v); rdRefrescar(false); }
  else { const inp = document.getElementById("mc-r-" + k); if (inp) { inp.value = v; rdSalida(inp); } ruedaCierreDibujar(); }
}
function rdArrastreFin() { const D = RD.drag; if (!D) return; RD.drag = null; if (D.fuente === "pantalla") { saveState(); rdRefrescar(true); } }
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("pointerdown", rdArrastreIni);
  document.addEventListener("pointermove", ev => { if (RD.drag) rdArrastrar(ev); });
  ["pointerup", "pointercancel"].forEach(t => document.addEventListener(t, rdArrastreFin));
}
/* La nota escrita en el número de una barra (elNota) */
function rdSalida(inp) { const o = inp.closest('[data-el="nota"]'); const out = o && o.querySelector(".nota-rango__n"); if (out) out.innerHTML = `${inp.value}<small> de 10</small>`; inp.setAttribute("aria-valuetext", inp.value + " de 10"); }
/* Pone al día la pantalla sin volver a dibujarla entera (mientras arrastras) */
function rdRefrescar(ficha) {
  const svg = document.getElementById("rd-svg"); if (!svg) return;
  const S = STATE, y = anioVista(), m = RUEDA_MONTH, { D, op } = rdOpciones(S, y, m);
  svg.innerHTML = ruedaInner(D.vals, op); svg.dataset.estilo = op.estilo; svg.setAttribute("aria-label", op.aria);
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
  set("rd-areas", rdChipsHtml(S, y, m)); set("rd-rumbo", rdRumboHtml(S, y, m)); set("rd-prom", rdPromTxt(S, y, m));
  const fr = document.getElementById("rd-frase"), escribe = fr && document.activeElement === fr;
  if (ficha && !escribe) set("rd-ficha", iconizar(rdFichaHtml(S, y, m, RD.sel)));
  else { const o = document.getElementById("rd-nota"); if (o) o.textContent = ruedaMes(S, y, m)[RD.sel]; }
  const v = ruedaMes(S, y, m);
  D.vis.forEach(k => { const inp = document.getElementById("rv-r-" + k); if (inp && +inp.value !== v[k] && document.activeElement !== inp) { inp.value = v[k]; rdSalida(inp); } });
}
function ruedaTrasRender() {
  LIVE_HOOK = el => { if (!/rueda\.meses\./.test((el && el.dataset.bind) || "")) return; ruedaTocar(STATE, anioVista()); rdRefrescar(true); };
}
function rdFraseGuardar(txt) { ruedaPonerFrase(STATE, anioVista(), RUEDA_MONTH, RD.sel, txt); saveState(); }
function rdNota(d) { const y = anioVista(), m = RUEDA_MONTH; ruedaPoner(STATE, y, m, RD.sel, ruedaMes(STATE, y, m)[RD.sel] + d); saveState(); rdRefrescar(true); const b = document.querySelector(`#rd-ficha [data-action="ru-${d > 0 ? "mas" : "menos"}"]`); if (b) b.focus(); }

/* ============ El paso chico para el área que pide cariño ============ */
function rdPasoCrear() {
  const y = anioVista(), m = RUEDA_MONTH, p = ruedaPaso(STATE, y, m); if (!p) return;
  const hayPlanes = p.tipo === "plan" && typeof openPlanForm === "function" && typeof PLAN !== "undefined" && PLAN.error !== "sin-servidor" && typeof AMIGOS !== "undefined" && AMIGOS.lista && (AMIGOS.lista.amigos || []).length;
  if (p.tipo === "habito") return openHabitModal(null, { pre: { nombre: p.nombre, icon: p.icon, area: p.k } });
  if (hayPlanes) return openPlanForm(null, []);
  const D = datosAnio(STATE, y, true); D.metas.mensuales[m] = D.metas.mensuales[m] || [];
  D.metas.mensuales[m].push({ id: uid(), texto: p.nombre || "Cuidar " + ruedaNombre(STATE, p.k), done: false, area: p.k, ts: Date.now() });
  saveState(); rerender(); toast(`🎯 «${p.nombre}» quedó en tus objetivos de ${MESES[m].toLowerCase()}`);
}
function rdPasoNo() { const c = ruedaCfg(); c.pasoNo[ruedaYM(anioVista(), RUEDA_MONTH)] = 1; c.ts = Date.now(); STATE.rueda.ts = Date.now(); saveState(); rdRefrescar(true); }

/* ============ Ver mi rumbo: la rueda gira desde tu mes pasado ============ */
function rdAnimar(id, desde, hasta, op, dur) {
  const svg = document.getElementById(id); if (!svg) return;
  cancelAnimationFrame(RD.anim);
  const quieto = typeof sinMovimiento === "function" ? sinMovimiento() : (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (quieto) { svg.innerHTML = ruedaInner(hasta, op); return; }
  const t0 = performance.now();
  const paso = t => { const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3);
    if (!svg.isConnected) return;
    svg.innerHTML = ruedaInner(hasta.map((h, i) => (desde[i] || 0) + (h - (desde[i] || 0)) * e), op);
    if (u < 1) RD.anim = requestAnimationFrame(paso); };
  RD.anim = requestAnimationFrame(paso);
}
function openRuedaMomento() {
  const S = STATE, y = anioVista(), m = RUEDA_MONTH, D = ruedaDibujoDatos(S, y, m), t = ruedaRumboTxt(S, ruedaRumbo(S, y, m)), estilo = ruedaEstilo();
  const ele = typeof elefanteSVG === "function" ? elefanteSVG({ anim: false, animo: "feliz" }) : "";
  const desde = D.ant || D.vals.map(() => 0), op = { estilo, cols: D.cols, mini: true };
  openModal(`🧭 Tu rumbo de ${MESES[m].toLowerCase()}`, `<div class="rd-mom">
    <div class="rd-mom__r">${ruedaSVG(desde, Object.assign({ id: "rd-mom-svg", aria: "Tu rueda de " + MESES[m].toLowerCase() }, op))}</div>
    <div class="rd-mom__dice">${ele ? `<span class="rd-mom__ele">${ele}</span>` : ""}<p><b>${escapeHtml(t.t)}.</b> ${escapeHtml(t.s)}</p></div>
    <button type="button" class="btn btn--primary btn-block" data-action="close-modal">Listo</button></div>`);
  rdAnimar("rd-mom-svg", desde, D.vals, op, 1100);
}

/* ============ El minuto de la rueda: un área a la vez ============ */
function openRuedaMinuto() { RD.minuto = { i: 0 }; openModal("⏱ El minuto de la rueda", `<div class="rd-min" id="rd-min"></div>`); rdMinutoPintar(); }
function rdMinutoPintar() {
  const c = document.getElementById("rd-min"); if (!c || !RD.minuto) return;
  const S = STATE, y = anioVista(), m = RUEDA_MONTH, vis = ruedaVisibles(S), i = Math.min(RD.minuto.i, vis.length - 1), k = vis[i], v = ruedaMes(S, y, m)[k], [ya, ma] = ruedaAntes(y, m), a = ruedaMes(S, ya, ma)[k];
  c.innerHTML = iconizar(`<div class="rd-min__prog" aria-hidden="true">${vis.map((_, j) => `<i class="${j < i ? "ok" : j === i ? "on" : ""}"></i>`).join("")}</div>
    <div class="rd-min__area" style="--c:${ruedaColor(S, k)}"><span class="rd-punto"></span><b>${escapeHtml(ruedaNombre(S, k))}</b>${a > 0 ? `<span class="text-sm muted">En ${MESES[ma].toLowerCase()}: ${a}</span>` : ""}</div>
    <div class="rd-min__notas" role="group" aria-label="Nota de 0 a 10 para ${escapeAttr(ruedaNombre(S, k))}">${Array.from({ length: 11 }, (_, n) => `<button type="button" class="${n === v ? "is-on" : ""}" aria-pressed="${n === v}" data-action="ru-min-nota" data-v="${n}" style="--c:${ruedaColor(S, k)}">${n}</button>`).join("")}</div>
    <div class="rd-min__pie"><button type="button" class="btn-ghost" data-action="ru-min-atras"${i === 0 ? " disabled" : ""}>Anterior</button><span class="text-sm muted">${i + 1} de ${vis.length}</span>
      <button type="button" class="btn btn--soft" data-action="ru-min-sig">${i === vis.length - 1 ? "Terminar" : "Siguiente"}</button></div>`);
}
function rdMinutoNota(v) {
  const vis = ruedaVisibles(STATE), k = vis[RD.minuto.i]; ruedaPoner(STATE, anioVista(), RUEDA_MONTH, k, v); saveState(); rdMinutoPintar();
  clearTimeout(RD.minuto.t); RD.minuto.t = setTimeout(() => rdMinutoPaso(1), 260);
}
function rdMinutoPaso(d) {
  if (!RD.minuto) return; clearTimeout(RD.minuto.t);
  const n = ruedaVisibles(STATE).length, i = RD.minuto.i + d;
  if (i >= n) { RD.minuto = null; closeModal(); rerender(); return openRuedaMomento(); }
  RD.minuto.i = Math.max(0, i); rdMinutoPintar();
}

/* ============ Compartir tu rueda como imagen (1080 × 1350) ============ */
function openRuedaCompartir() {
  openModal("Compartir tu rueda", `<p class="text-sm muted" style="margin-top:0">Tu rueda del mes en una imagen para historias, con la marca de Rumbo al pie. Tus frases nunca van en la imagen.</p>
    <div class="row-wrap" style="gap:8px"><button type="button" class="btn btn--primary" data-action="ru-comp" data-n="1">Con números</button><button type="button" class="btn btn--soft" data-action="ru-comp" data-n="0">Solo el dibujo</button></div>`);
}
function ruedaImagenSVG(S, y, m, conNumeros) {
  const D = ruedaDibujoDatos(S, y, m), E = RUEDA_ESTILOS.find(e => e.id === ruedaEstilo());
  const tema = E.oscuro ? { text: "#EAF2F8", muted: "#A9B8C9", surface: "#0E1626", line: "#33415C" } : { text: "#131A2E", muted: "#586179", surface: "#FFFFFF", line: "#D9DFEB" };
  const et = D.etiquetas.map(e => ({ corto: e.corto, v: conNumeros ? e.v : "", ant: null }));
  return { svg: ruedaSVG(D.vals, { estilo: E.id, cols: D.cols, etiquetas: et, tema, sel: -1 }), E };
}
async function ruedaImagen(conNumeros) {
  const S = STATE, y = anioVista(), m = RUEDA_MONTH, { svg, E } = ruedaImagenSVG(S, y, m, conNumeros), R = ruedaRumbo(S, y, m);
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const fondo = g.createLinearGradient(0, 0, 0, H);
  if (E.oscuro) { fondo.addColorStop(0, "#0A1020"); fondo.addColorStop(1, E.bg || "#141B33"); } else { fondo.addColorStop(0, "#F6F7FB"); fondo.addColorStop(1, "#E7EBF5"); }
  g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  const tinta = E.oscuro ? "#EAF2F8" : "#131A2E", suave = E.oscuro ? "#A9B8C9" : "#586179";
  g.fillStyle = tinta; g.textAlign = "center"; g.font = "800 66px Figtree, system-ui, sans-serif"; g.fillText(`Mi rueda de ${MESES[m].toLowerCase()}`, W / 2, 140);
  const t = R.mejor ? `Este mes apunto a ${ruedaCorto(S, R.mejor.k)}` : R.alto ? `Mi área más alta: ${ruedaCorto(S, R.alto.k)}` : "Mi vida, área por área";
  g.fillStyle = suave; g.font = "600 40px Figtree, system-ui, sans-serif"; g.fillText(t, W / 2, 205);
  const img = new Image(); img.decoding = "sync";
  await new Promise(res => { img.onload = res; img.onerror = res; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  try { const w = 1040, h = w * 416 / 492; g.drawImage(img, (W - w) / 2, 260, w, h); } catch (e) {}
  g.fillStyle = suave; g.font = "700 34px Figtree, system-ui, sans-serif"; g.fillText("Rumbo · rumbo.biplot.cl", W / 2, H - 70);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
async function ruedaCompartir(conNumeros) {
  closeModal();
  const blob = await ruedaImagen(conNumeros); if (!blob) return toast("No se pudo crear la imagen", true);
  const nombre = `rumbo-rueda-${todayISO()}.png`, texto = "Mi rueda de la vida en Rumbo · rumbo.biplot.cl";
  try {
    const file = new File([blob], nombre, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); if (typeof registrarCompartido === "function") registrarCompartido(); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (typeof registrarCompartido === "function") registrarCompartido();
  toast("Imagen descargada: compártela donde quieras");
}

/* ============ El probador de estilos ============ */
function ruedaCosto(cos) { const it = typeof COSMETICOS !== "undefined" ? COSMETICOS.find(x => x.id === cos) : null; return it ? it.costo : 0; }
function openRuedaProbador() {
  const actual = ruedaEstilo(), d = ruedaMuestraVals();
  openModal("Cómo se ve tu rueda", `<p class="text-sm muted" style="margin-top:0">Tus mismas notas, dibujadas de otra forma. Cámbiala cuando quieras: no se pierde nada.</p>
    <div class="rd-prob" id="rd-probador">${RUEDA_ESTILOS.map(e => { const tuyo = ruedaEstiloTuyo(e.id), on = e.id === actual;
      return `<button type="button" class="rd-prob__f${on ? " is-on" : ""}" data-action="ru-estilo" data-v="${e.id}" aria-pressed="${on}">${ruedaSVG(d.vals, { estilo: e.id, cols: d.cols, mini: true, aria: e.nombre })}
        <b>${escapeHtml(e.nombre)}</b><small class="muted">${escapeHtml(e.desc)}</small><span class="rd-prob__p">${on ? "✓ La tuya" : tuyo ? "Usar" : `${ruedaCosto(e.cos)} ⭐`}</span></button>`; }).join("")}</div>`, { ancho: true });
}
function ruedaElegirEstilo(id) {
  const e = RUEDA_ESTILOS.find(x => x.id === id); if (!e) return;
  if (!ruedaEstiloTuyo(id)) { if (typeof openFicha === "function") return openFicha("cos:" + e.cos); return; }
  eqCos().rueda = id === "rosa" ? null : id; saveState(); closeModal(); rerender();
  toast(`🧭 ${e.nombre}: así se ve ahora tu rueda`);
}

/* ============ Tus áreas: nombres, colores, ocultar y sumar (hasta 10) ============ */
function openRuedaAreas() {
  const c = ruedaCfg();
  RD.editar = { areas: STATE.rueda.areas.slice(), ocultas: c.ocultas.map(Number), colores: Object.assign({}, c.colores) };
  openModal("Tus áreas", `<div id="rd-ar"></div>`); rdAreasPintar();
}
function rdAreasLeer() { const E = RD.editar; if (!E) return; E.areas.forEach((_, k) => { const i = document.getElementById("rd-ar-n-" + k); if (i) E.areas[k] = i.value; }); }
function rdAreasVisibles() { const E = RD.editar; return E.areas.filter((n, k) => String(n || "").trim() && !E.ocultas.includes(k)).length; }
function rdAreasPintar(foco) {
  const E = RD.editar, c = document.getElementById("rd-ar"); if (!E || !c) return;
  const color = k => /^#[0-9a-f]{6}$/i.test(E.colores[k] || "") ? E.colores[k] : RUEDA_COLORES[k % RUEDA_COLORES.length];
  c.innerHTML = iconizar(`<p class="text-sm muted" style="margin-top:0">Cambia el nombre o el color, oculta las que no te sirven (sus notas se guardan) o suma otras. Se ven entre ${RUEDA_MIN_AREAS} y ${RUEDA_MAX_AREAS}.</p>
    <div class="rd-ar">${E.areas.map((n, k) => { const oc = E.ocultas.includes(k);
      return `<div class="rd-ar__f${oc ? " is-oculta" : ""}"><button type="button" class="rd-ar__c" style="background:${color(k)}" data-action="ru-ar-color" data-k="${k}" aria-label="Cambiar el color de ${escapeAttr(n || "esta área")}"></button>
        <input class="input" id="rd-ar-n-${k}" value="${escapeAttr(n)}" maxlength="30" aria-label="Nombre del área ${k + 1}">
        <button type="button" class="btn-ghost" data-action="ru-ar-ver" data-k="${k}">${oc ? "Mostrar" : "Ocultar"}</button></div>`; }).join("")}</div>
    ${E.areas.length < RUEDA_MAX_AREAS ? `<button type="button" class="btn btn--soft mt-8" data-action="ru-ar-mas">${icoUI("plus")} Sumar un área</button>` : ""}
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="ru-ar-ok">Guardar</button>`);
  if (foco != null) { const i = document.getElementById("rd-ar-n-" + foco); if (i) { i.focus(); i.select(); } }
}
function rdAreasAccion(a, d) {
  const E = RD.editar; if (!E) return; rdAreasLeer();
  const k = +d.k;
  if (a === "ru-ar-color") { const actual = /^#[0-9a-f]{6}$/i.test(E.colores[k] || "") ? E.colores[k] : RUEDA_COLORES[k % RUEDA_COLORES.length]; E.colores[k] = RUEDA_COLORES[(RUEDA_COLORES.indexOf(actual) + 1) % RUEDA_COLORES.length]; return rdAreasPintar(); }
  if (a === "ru-ar-ver") {
    if (E.ocultas.includes(k)) E.ocultas = E.ocultas.filter(x => x !== k);
    else { if (rdAreasVisibles() <= RUEDA_MIN_AREAS) return toast(`Deja al menos ${RUEDA_MIN_AREAS} áreas a la vista`, true); E.ocultas.push(k); }
    return rdAreasPintar();
  }
  if (a === "ru-ar-mas") { if (E.areas.length >= RUEDA_MAX_AREAS) return; E.areas.push("Nueva área"); return rdAreasPintar(E.areas.length - 1); }
  if (a === "ru-ar-ok") {
    E.areas = E.areas.map((n, i) => String(n || "").trim().slice(0, 30) || RUEDA_NOMBRES[i] || "Área " + (i + 1));
    if (rdAreasVisibles() < RUEDA_MIN_AREAS) return toast(`Deja al menos ${RUEDA_MIN_AREAS} áreas a la vista`, true);
    STATE.rueda.areas = E.areas; const c = ruedaCfg(); c.ocultas = E.ocultas.slice().sort((x, y) => x - y); c.colores = E.colores; c.ts = Date.now(); STATE.rueda.ts = Date.now();
    RD.editar = null; saveState(); closeModal(); rerender(); toast("🧭 Tus áreas quedaron guardadas");
  }
}

/* ============ El área de un objetivo (U5) ============ */
function openRuedaMetaArea(d) {
  const metas = datosAnio(STATE, +d.anio || anioActual()).metas, b = d.bucket === "tri" ? metas.trimestres : metas.mensuales, o = (b[+d.idx] || []).find(x => x.id === d.id); if (!o) return;
  RD.meta = { bucket: d.bucket, idx: +d.idx, anio: +d.anio || anioActual(), id: d.id };
  openModal("Área de tu rueda", `<p class="text-sm muted" style="margin-top:0">«${escapeHtml(o.texto)}»: ¿a qué área de tu vida le aporta? Aparece en esa área de tu rueda.</p>
    <div class="rd-meta-l">${ruedaVisibles(STATE).map(k => `<button type="button" class="rd-chip" data-action="ru-meta-poner" data-k="${k}" aria-pressed="${o.area === k}" style="--c:${ruedaColor(STATE, k)}"><span>${escapeHtml(ruedaNombre(STATE, k))}</span></button>`).join("")}
      <button type="button" class="btn-ghost" data-action="ru-meta-poner" data-k="">Ninguna</button></div>`);
}
function rdMetaPoner(k) {
  const M = RD.meta; if (!M) return; const metas = datosAnio(STATE, M.anio, true).metas, b = M.bucket === "tri" ? metas.trimestres : metas.mensuales, o = (b[M.idx] || []).find(x => x.id === M.id); if (!o) return;
  if (k === "" || k == null) delete o.area; else o.area = +k;
  o.ts = Date.now(); RD.meta = null; saveState(); closeModal(); rerender();
}
function ruedaMetaChip(m, bucket, idx, y) {
  const S = STATE, tiene = m.area != null && S.rueda.areas[m.area] != null;
  return `<button type="button" class="rd-meta" data-action="ru-meta-area" data-bucket="${bucket}" data-idx="${idx}" data-anio="${y}" data-id="${m.id}" title="Área de tu rueda" aria-label="Área de tu rueda: ${tiene ? escapeAttr(ruedaNombre(S, m.area)) : "ninguna"}">${tiene ? `<i style="background:${ruedaColor(S, m.area)}"></i>${escapeHtml(ruedaCorto(S, m.area))}` : "+ área"}</button>`;
}

/* ============ El paso «Rueda» del cierre del mes (ritual-mes.js) ============ */
function ruedaCierreHtml(y, m, vals) {
  const S = STATE, vis = ruedaVisibles(S), [ya, ma] = ruedaAntes(y, m), a = ruedaMes(S, ya, ma), hayAnt = ruedaHay(S, a), estilo = ruedaEstilo();
  RD.cierre = { y, m };
  const vv = vis.map(k => +vals[k] || 0);
  return `<p class="text-sm muted" style="margin-bottom:8px">De 0 a 10, ¿cómo estuvo cada área este mes? Arrastra sobre la rueda o usa las barras.</p>
    <div class="rd-cierre">${ruedaSVG(vv, { estilo, cols: vis.map(k => ruedaColor(S, k)), ant: hayAnt ? vis.map(k => a[k]) : null, etiquetas: vis.map((k, i) => ({ corto: ruedaCorto(S, k), v: vv[i], ant: hayAnt ? a[k] : null })), id: "rd-cierre-svg", arrastre: "cierre", aria: "Tu rueda del mes" })}</div>
    <p class="rd-cierre__rumbo text-sm" id="rd-cierre-rumbo">${escapeHtml(rdCierreRumbo(vis.map(k => +vals[k] || 0), hayAnt ? a : null))}</p>
    ${vis.map(k => `<div class="field rd-barra" style="--c:${ruedaColor(S, k)}">${elNota("mc-r-" + k, +vals[k] || 0, { min: 0, max: 10, titulo: escapeHtml(ruedaNombre(S, k)), label: ruedaNombre(S, k), oninput: "ruedaCierreDibujar()" })}</div>`).join("")}`;
}
function rdCierreRumbo(vv, a) {
  const S = STATE, vis = ruedaVisibles(S); let mejor = null;
  if (a) vis.forEach((k, i) => { const d = vv[i] - a[k]; if (d > 0 && (!mejor || d > mejor.d)) mejor = { k, d }; });
  return mejor ? `Este mes apuntas a ${ruedaCorto(S, mejor.k)} (+${mejor.d}).` : "";
}
function ruedaCierreDibujar() {
  const svg = document.getElementById("rd-cierre-svg"); if (!svg || !RD.cierre) return;
  const S = STATE, vis = ruedaVisibles(S), { y, m } = RD.cierre, [ya, ma] = ruedaAntes(y, m), a = ruedaMes(S, ya, ma), hayAnt = ruedaHay(S, a);
  const vv = vis.map(k => { const i = document.getElementById("mc-r-" + k); return i ? +i.value || 0 : 0; });
  svg.innerHTML = ruedaInner(vv, { estilo: ruedaEstilo(), cols: vis.map(k => ruedaColor(S, k)), ant: hayAnt ? vis.map(k => a[k]) : null, etiquetas: vis.map((k, i) => ({ corto: ruedaCorto(S, k), v: vv[i], ant: hayAnt ? a[k] : null })) });
  const r = document.getElementById("rd-cierre-rumbo"); if (r) r.textContent = rdCierreRumbo(vv, hayAnt ? a : null);
}

/* ============ Acciones (data-action="ru-…", ver onClick en app.js) ============ */
function ruedaAccion(a, d, el) {
  if (a === "ru-sel") { RD.sel = +d.k; return rdRefrescar(true); }
  if (a === "ru-mas") return rdNota(1);
  if (a === "ru-menos") return rdNota(-1);
  if (a === "ru-paso") return rdPasoCrear();
  if (a === "ru-paso-no") return rdPasoNo();
  if (a === "ru-momento") return openRuedaMomento();
  if (a === "ru-minuto") return openRuedaMinuto();
  if (a === "ru-min-nota") return rdMinutoNota(+d.v);
  if (a === "ru-min-sig") return rdMinutoPaso(1);
  if (a === "ru-min-atras") return rdMinutoPaso(-1);
  if (a === "ru-compartir") return openRuedaCompartir();
  if (a === "ru-comp") return ruedaCompartir(d.n === "1");
  if (a === "ru-probador") return openRuedaProbador();
  if (a === "ru-estilo") return ruedaElegirEstilo(d.v);
  if (a === "ru-areas-editar") return openRuedaAreas();
  if (a.startsWith("ru-ar-")) return rdAreasAccion(a, d);
  if (a === "ru-anio-area") { RD.anioK = RD.anioK === +d.k ? null : +d.k; return rerender(); }
  if (a === "ru-meta-area") return openRuedaMetaArea(d);
  if (a === "ru-meta-poner") return rdMetaPoner(d.k);
}
