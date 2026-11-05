/* ============================================================
   RUMBO · ⏱️ Foco: la pantalla (pantalla completa o en la barra), elegir en qué, el cierre de la
   sesión, los sonidos de fondo, los dibujos del reloj y tu tiempo en Tendencias (v140).
   La lógica y los datos están en foco.js; con un amigo, en foco-amigos.js.
   ============================================================ */
let FOCO_TIMER = null;
const FOCO_UI = { sel: "", min: 25, ritmo: "una", estilo: "anillo", sonido: "", modo: "completa", pre: null, cierre: null, anota: false };
const FOCO_TINTA = { fondo: "#0C0F1E", vacio: "#252C52", ambar: "#FFBE55", indigo: "#8D9BFF", luna: "#F3EDD2", texto: "#EEF0F8", borde: "#39416A" };

/* -------- Los cuatro dibujos del reloj (viewBox 0 0 240 240). f: cuánto pasó del tramo (0 a 1) -------- */
function focoDibujo(estilo, f, op) {
  op = op || {}; f = Math.max(0, Math.min(1, +f || 0));
  const T = FOCO_TINTA, ac = op.descanso ? T.indigo : T.ambar;
  if (estilo === "arena") {
    const a = 1 - f;
    let g = `<rect x="70" y="14" width="100" height="10" rx="4" fill="#8A5A2B"/><rect x="70" y="216" width="100" height="10" rx="4" fill="#8A5A2B"/>`;
    g += `<path d="M80 24 L160 24 L160 36 C160 76 126 100 124 120 C126 140 160 164 160 204 L160 216 L80 216 L80 204 C80 164 114 140 116 120 C114 100 80 76 80 36 Z" fill="rgba(255,255,255,.05)" stroke="${T.borde}" stroke-width="3"/>`;
    if (a > 0) g += `<path d="M${(120 - 36 * a - 4).toFixed(1)} ${(116 - 80 * a).toFixed(1)} L${(120 + 36 * a + 4).toFixed(1)} ${(116 - 80 * a).toFixed(1)} L122 116 L118 116 Z" fill="${ac}"/>`;
    if (f > 0 && f < 1) g += `<line x1="120" y1="120" x2="120" y2="${(214 - 60 * f).toFixed(1)}" stroke="${ac}" stroke-width="2"/>`;
    if (f > 0) g += `<path d="M${(120 - 38 * f - 6).toFixed(1)} 214 Q120 ${(214 - 70 * f).toFixed(1)} ${(120 + 38 * f + 6).toFixed(1)} 214 Z" fill="${ac}"/>`;
    return g;
  }
  if (estilo === "vela") {
    const h = 120 * (1 - f) + 14, top = 214 - h;
    return `<circle cx="120" cy="${(top - 34).toFixed(1)}" r="46" fill="${T.ambar}" opacity=".12"/>
      <rect x="96" y="${top.toFixed(1)}" width="48" height="${h.toFixed(1)}" rx="8" fill="${T.luna}"/><path d="M96 ${(top + 10).toFixed(1)} q6 10 0 18" stroke="#E5DDB8" stroke-width="5" fill="none"/>
      <line x1="120" y1="${top.toFixed(1)}" x2="120" y2="${(top - 8).toFixed(1)}" stroke="#2A2F45" stroke-width="3"/>
      <g class="foco-llama"><path d="M120 ${(top - 62).toFixed(1)} c16 20 18 34 12 44 c-4 8 -20 8 -24 0 c-6 -10 -2 -24 12 -44 z" fill="#F59A2C"/><path d="M120 ${(top - 40).toFixed(1)} c8 12 8 20 5 25 c-3 4 -7 4 -10 0 c-3 -5 -3 -13 5 -25 z" fill="#FFD25A"/></g>
      <rect x="74" y="214" width="92" height="10" rx="5" fill="${T.borde}"/>`;
  }
  if (estilo === "luna") {
    const r = 92, rx = Math.abs(1 - 2 * f) * r;
    let g = `<circle cx="120" cy="120" r="${r}" fill="${T.vacio}"/>`;
    if (f >= 1) g += `<circle cx="120" cy="120" r="${r}" fill="${T.luna}"/>`;
    else if (f > 0) g += `<path d="M120 ${120 - r} A${r} ${r} 0 0 1 120 ${120 + r} A${rx.toFixed(1)} ${r} 0 0 ${f < .5 ? 0 : 1} 120 ${120 - r} Z" fill="${T.luna}"/>`;
    return g + [[34, 40], [206, 52], [30, 196], [212, 190]].map(s => `<circle cx="${s[0]}" cy="${s[1]}" r="2" fill="#fff" opacity=".6"/>`).join("");
  }
  const rr = 104, L = 2 * Math.PI * rr;   // el anillo: lo que queda, en ámbar (en el descanso, índigo)
  return `<circle cx="120" cy="120" r="${rr}" fill="none" stroke="${T.vacio}" stroke-width="12"/>
    <circle cx="120" cy="120" r="${rr}" fill="none" stroke="${ac}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(L * (1 - f)).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 120 120)"/>`;
}
function focoDibujoSvg(estilo, f, clase) { return `<svg class="${clase || ""}" viewBox="0 0 240 240" aria-hidden="true">${focoDibujo(estilo, f)}</svg>`; }

/* -------- Sonidos de fondo, hechos en el teléfono (sin descargas) -------- */
const FOCO_AUDIO = { ctx: null, master: null, nodos: [], v: "", t: null };
function focoRuido(ctx, tipo) {
  const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let ult = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (tipo === "marron") { ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.5; } else d[i] = w; }
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s;
}
function focoSonar(v, segundos) {
  focoCallar(0.2);
  if (!v) return;
  try {
    const ctx = FOCO_AUDIO.ctx = FOCO_AUDIO.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const master = ctx.createGain(), t0 = ctx.currentTime; master.gain.setValueAtTime(0.0001, t0); master.gain.exponentialRampToValueAtTime(1, t0 + 1.5); master.connect(ctx.destination);
    const nodos = [], capa = (fuente, filtros, vol) => { let x = fuente; filtros.forEach(f => { x.connect(f); x = f; }); const g = ctx.createGain(); g.gain.value = vol; x.connect(g); g.connect(master); fuente.start(); nodos.push(fuente, g, ...filtros); return g; };
    const filtro = (tipo, f, q) => { const b = ctx.createBiquadFilter(); b.type = tipo; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    if (v === "suave") capa(focoRuido(ctx, "marron"), [filtro("lowpass", 700)], 0.32);
    if (v === "lluvia") { capa(focoRuido(ctx, "blanco"), [filtro("highpass", 900), filtro("lowpass", 7000)], 0.07); capa(focoRuido(ctx, "marron"), [filtro("lowpass", 1200)], 0.18); }
    if (v === "mar") {
      const g = capa(focoRuido(ctx, "marron"), [filtro("lowpass", 900)], 0.18), lfo = ctx.createOscillator(), prof = ctx.createGain();
      lfo.frequency.value = 0.09; prof.gain.value = 0.15; lfo.connect(prof); prof.connect(g.gain); lfo.start(); nodos.push(lfo, prof);
    }
    Object.assign(FOCO_AUDIO, { master, nodos, v });
    if (segundos) FOCO_AUDIO.t = setTimeout(() => focoCallar(1.5), segundos * 1000);
  } catch (e) {}
}
function focoCallar(seg) {
  clearTimeout(FOCO_AUDIO.t);
  const { ctx, master, nodos } = FOCO_AUDIO; if (!ctx || !master) return;
  try { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t); master.gain.exponentialRampToValueAtTime(0.0001, t + (seg || 2.5)); } catch (e) {}
  setTimeout(() => { nodos.forEach(n => { try { n.stop && n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }); try { master.disconnect(); } catch (e) {} }, ((seg || 2.5) + 0.1) * 1000);
  Object.assign(FOCO_AUDIO, { master: null, nodos: [], v: "" });
}
/* Dos notas suaves al cambiar de tramo */
function focoCampana() {
  try {
    const ctx = FOCO_AUDIO.ctx = FOCO_AUDIO.ctx || new (window.AudioContext || window.webkitAudioContext)(), t0 = ctx.currentTime;
    [[660, 0], [880, 0.22]].forEach(([f, ini]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + ini); g.gain.exponentialRampToValueAtTime(0.2, t0 + ini + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + 1.1); o.connect(g); g.connect(ctx.destination); o.start(t0 + ini); o.stop(t0 + ini + 1.2); });
  } catch (e) {}
}

/* Lo que muestran los contadores (elegir.js los repinta con su nombre) */
function focoFmtMin(v) { return +v ? v + " min" : "Sin duración"; }
function focoFmtPag(v) { return "pág. " + v; }

/* -------- «¿En qué pones tu tiempo?» -------- */
function focoIcono(i) { return i.bocado ? icoUI("bocado") : i.icon === "🎯" ? icoUI("target") : i.icon === "☐" ? icoUI("square-check") : i.icon === "👥" ? icoUI("handshake") : icoHab(i.icon || "⏱️", 18); }
function openFoco(pre) {
  const a = focoActiva(); if (a) return mostrarFoco(true);
  const p = focoPref(STATE), hoy = todayISO();
  Object.assign(FOCO_UI, { min: p.min, ritmo: p.ritmo, estilo: focoEstiloUsable(p.estilo), sonido: focoSonidoUsable(p.sonido), modo: p.modo, pre: pre || null, anota: false });
  const grupos = focoDestinos(STATE, hoy);
  let sel = pre && pre.tipo ? pre.tipo + ":" + (pre.ref || "") : "";
  if (sel && !grupos.some(g => g.items.some(i => focoClave(i) === sel))) sel = "";
  if (!sel) { const prim = grupos[0] && grupos[0].items[0]; sel = prim ? focoClave(prim) : "libre:"; }
  FOCO_UI.sel = sel;
  const d = focoDestinoDe(STATE, sel, hoy); if (d && d.min) { FOCO_UI.min = d.min; if (!FOCO_MINS.includes(d.min)) FOCO_UI.ritmo = "una"; }
  openModal("⏱️ Enfocarme", focoElegirHtml(grupos));
  focoElegirPintar();
}
function focoElegirHtml(grupos) {
  const op = i => `<button type="button" class="fo-op" role="radio" data-action="foco-elegir" data-k="${escapeAttr(focoClave(i))}">
      <span class="fo-op__i">${focoIcono(i)}</span><span class="fo-op__txt"><b>${escapeHtml(i.titulo)}</b>${i.sub ? `<small>${escapeHtml(i.sub)}</small>` : ""}</span></button>`;
  const lista = grupos.map(g => `<div class="fo-g"><div class="fo-g__t">${escapeHtml(g.t)}</div>${g.items.slice(0, g.k === "hoy" ? 6 : 8).map(op).join("")}</div>`).join("");
  const sem = minutosFoco(STATE, agLunes(todayISO()), agSumar(agLunes(todayISO()), 6));
  const amigos = typeof focoAmigosPuede === "function" && focoAmigosPuede();
  return `<p class="text-sm muted" style="margin:0 0 10px">¿En qué pones tu tiempo? Lo que hagas se suma ahí.</p>
    <div class="fo-lista" role="radiogroup" aria-label="En qué te enfocas">${lista}
      <div class="fo-g"><div class="fo-g__t">Otra cosa</div><button type="button" class="fo-op" role="radio" data-action="foco-elegir" data-k="libre:"><span class="fo-op__i">${icoHab("⏱️", 18)}</span><span class="fo-op__txt"><b>Algo que no está en la lista</b></span></button>
        <input class="input mt-8" id="fo-libre" maxlength="80" placeholder="¿En qué te vas a enfocar?" hidden></div></div>
    <div class="fo-sigue" id="fo-sigue" hidden></div>
    <div class="field mt-16"><label>Duración <span class="text-xs muted">(minutos)</span></label><div class="fo-chips" id="fo-min" role="group" aria-label="Duración en minutos"></div></div>
    <div class="field"><label>Ritmo</label><div class="fo-chips" id="fo-ritmo" role="group" aria-label="Ritmo">
      <button type="button" class="fo-chip" data-action="foco-ritmo" data-v="una">Una sesión</button><button type="button" class="fo-chip" data-action="foco-ritmo" data-v="ciclos">Ciclos con descansos</button></div>
      <p class="text-xs muted mt-8" id="fo-ritmo-txt"></p></div>
    <details class="fo-mas"><summary>Reloj, sonido y pantalla</summary>
      <div class="field mt-8"><label>Dibujo del reloj</label><div class="fo-relojes" id="fo-estilo">${FOCO_RELOJES.map(r => { const tuyo = focoTieneCos(r.cos), c = r.cos && COSMETICOS.find(x => x.id === r.cos);
        return `<button type="button" class="fo-reloj${tuyo ? "" : " is-lock"}" data-action="foco-estilo" data-v="${r.v}">${focoDibujoSvg(r.v, 0.4)}<span>${r.n}${tuyo ? "" : `<em>${c ? c.costo : ""} ⭐</em>`}</span></button>`; }).join("")}</div></div>
      <div class="field"><label>Sonido de fondo</label><div class="fo-chips" id="fo-sonido">${FOCO_SONIDOS.map(s => { const tuyo = focoTieneCos(s.cos), c = s.cos && COSMETICOS.find(x => x.id === s.cos);
        return `<button type="button" class="fo-chip${tuyo ? "" : " is-lock"}" data-action="foco-sonido-elegir" data-v="${s.v}">${s.n}${tuyo ? "" : ` · ${c ? c.costo : ""} ⭐`}</button>`; }).join("")}</div></div>
      <div class="field"><label>Mientras corre</label><div class="fo-chips" id="fo-modo"><button type="button" class="fo-chip" data-action="foco-modo" data-v="completa">Pantalla completa</button><button type="button" class="fo-chip" data-action="foco-modo" data-v="barra">En la barra</button></div>
        <p class="text-xs muted mt-8">«En la barra» deja la app libre: el reloj queda arriba y lo tocas para verlo en grande.</p></div></details>
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="foco-empezar">Empezar</button>
    ${amigos ? `<button type="button" class="btn-ghost btn-block mt-8" data-action="foco-amigo-elegir">${icoUI("handshake")} Con un amigo</button>` : ""}
    <p class="text-xs muted mt-8" style="text-align:center">${sem ? `Esta semana llevas <b>${fmtFoco(sem)}</b> de foco.` : "Nada te lo pide: úsalo cuando te sirva."}</p>`;
}
function focoElegirPintar() {
  const m = document.getElementById("modal"); if (!m) return;
  const mins = FOCO_MINS.includes(FOCO_UI.min) ? FOCO_MINS : FOCO_MINS.concat(FOCO_UI.min).sort((a, b) => a - b), cm = document.getElementById("fo-min");
  if (cm) cm.innerHTML = mins.map(x => `<button type="button" class="fo-chip" data-action="foco-min" data-v="${x}">${x}</button>`).join("") + `<button type="button" class="fo-chip" data-action="foco-min" data-v="libre">Libre</button>`;
  const marcar = (sel, on) => m.querySelectorAll(sel).forEach(b => { const v = on(b); b.classList.toggle("is-on", v); b.setAttribute(b.getAttribute("role") === "radio" ? "aria-checked" : "aria-pressed", String(v)); });
  marcar(".fo-op", b => b.dataset.k === FOCO_UI.sel);
  marcar("#fo-min .fo-chip", b => FOCO_UI.ritmo === "libre" ? b.dataset.v === "libre" : +b.dataset.v === FOCO_UI.min);
  marcar("#fo-ritmo .fo-chip", b => b.dataset.v === FOCO_UI.ritmo);
  marcar("#fo-estilo .fo-reloj", b => b.dataset.v === FOCO_UI.estilo);
  marcar("#fo-sonido .fo-chip", b => b.dataset.v === FOCO_UI.sonido);
  marcar("#fo-modo .fo-chip", b => b.dataset.v === FOCO_UI.modo);
  const libre = document.getElementById("fo-libre"); if (libre) libre.hidden = FOCO_UI.sel !== "libre:";
  const rt = document.getElementById("fo-ritmo-txt"); if (rt) rt.textContent = focoRitmoTxt(FOCO_UI.ritmo, FOCO_UI.min);
  const ri = document.getElementById("fo-ritmo"); if (ri) ri.hidden = FOCO_UI.ritmo === "libre";
  const sg = document.getElementById("fo-sigue"), txt = focoSigue(STATE, FOCO_UI.sel);
  if (sg) { sg.hidden = !txt; sg.innerHTML = txt ? `<span>La última vez anotaste</span>«${escapeHtml(txt)}»` : ""; }
}
function focoEmpezar() {
  const hoy = todayISO();
  let d = FOCO_UI.sel === "libre:" ? null : focoDestinoDe(STATE, FOCO_UI.sel, hoy);
  if (!d) { const t = ((document.getElementById("fo-libre") || {}).value || "").trim(); d = { tipo: "libre", ref: "", titulo: t || "Tiempo de foco" }; }
  const destino = Object.assign({}, d); delete destino.sub; delete destino.min;
  focoGuardarPref(STATE, { min: FOCO_UI.min, ritmo: FOCO_UI.ritmo, estilo: FOCO_UI.estilo, sonido: FOCO_UI.sonido, modo: FOCO_UI.modo }); saveState();
  focoArrancar(focoNueva(destino, { ritmo: FOCO_UI.ritmo, min: FOCO_UI.min, modo: FOCO_UI.modo, estilo: FOCO_UI.estilo, sonido: FOCO_UI.sonido }));
}
function focoArrancar(a) {
  focoGuardarActiva(a); closeModal();
  if (a.sonido) focoSonar(a.sonido);
  focoAvisoServidor(a);
  mostrarFoco(a.modo !== "barra");
  try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
}
/* El servidor avisa al terminar el tramo de foco aunque cierres la app (supabase/foco.sql) */
function focoAvisoServidor(a) {
  if (!BACKEND.focoAviso) return;
  const t = a && !a.pausa && a.fin && focoTramoAct(a);
  if (!t) { BACKEND.focoAvisoQuitar && BACKEND.focoAvisoQuitar(); return; }
  BACKEND.focoAviso(new Date(a.fin).toISOString(), String((a.destino && a.destino.titulo) || "").slice(0, 80), t[1] === "f" ? (a.tramo + 1 >= a.tramos.length ? "fin" : "descanso") : "foco");
}

/* -------- La pantalla de foco -------- */
function mostrarFoco(grande) {
  const a = focoActiva(); if (!a) return cerrarFoco();
  const r = focoAvanzar(a); if (r.cambio) focoGuardarActiva(a);
  if (r.terminada) return focoTerminar(true);
  if (grande != null) { a.modo = grande ? "completa" : "barra"; focoGuardarActiva(a); }
  let el = document.getElementById("foco");
  if (!el) { el = document.createElement("div"); el.id = "foco"; el.className = "foco"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Sesión de foco"); document.body.appendChild(el); }
  el.innerHTML = iconizar(focoPantallaHtml(a));
  el.hidden = a.modo !== "completa";
  document.body.classList.toggle("en-foco", a.modo === "completa");
  focoTick();
  clearInterval(FOCO_TIMER); FOCO_TIMER = setInterval(focoTick, 1000);
}
function focoPantallaHtml(a) {
  const d = a.destino || {}, o = focoObjetivo(STATE, d.objId), t = focoTramoAct(a), desc = t[1] === "d" || t[1] === "l", sigue = focoSigue(STATE, focoClave(d));
  const h = d.habId && d.tipo !== "habito" && STATE.habitos.defs.find(x => x.id === d.habId), area = d.area != null && typeof ruedaCorto === "function" ? ruedaCorto(STATE, d.area) : "";
  const chips = [o ? `<span class="foco__chip foco__chip--o">🎯 ${escapeHtml(o.texto)}</span>` : "", h ? `<span class="foco__chip">${escapeHtml(h.nombre)} · ${h.minutos} min</span>` : "",
    area ? `<span class="foco__chip">${escapeHtml(area)}</span>` : "", a.con ? `<span class="foco__chip foco__chip--a">👥 Con ${escapeHtml(a.con)}</span>` : ""].filter(Boolean).join("");
  const ele = typeof elefanteSVG === "function" ? elefanteSVG({ animo: "normal", anim: false }) : "";
  return `<div class="foco__in" data-tramo="${t[1]}">
    <div class="foco__arriba"><button type="button" class="foco__mini" data-action="foco-barra"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg> Ver la app</button>
      ${a.sonido ? `<button type="button" class="foco__mini" data-action="foco-silencio" aria-pressed="${!!FOCO_AUDIO.v}">${FOCO_AUDIO.v ? "Sonido: sí" : "Sonido: no"}</button>` : ""}</div>
    <span class="foco__k" id="fo-k"></span>
    <h2 class="foco__t">${escapeHtml(d.titulo || "Tiempo de foco")}</h2>
    ${chips ? `<div class="foco__chips">${chips}</div>` : ""}
    ${sigue && !desc ? `<div class="foco__sigue"><span>La última vez anotaste</span>${escapeHtml(sigue)}</div>` : ""}
    <div class="foco__reloj${a.estilo !== "anillo" ? " debajo" : ""}"><svg id="fo-svg" viewBox="0 0 240 240" aria-hidden="true"></svg><div class="foco__num"><span id="fo-num" role="timer" aria-live="off">--:--</span><small id="fo-sub"></small></div></div>
    ${desc ? `<div class="foco__desc"><b>Buen bloque. ¿Algo para el cuerpo?</b><div class="foco__chips">
        ${typeof aguaSumar === "function" ? `<button type="button" class="foco__chip foco__chip--b" data-action="foco-vaso">💧 + Un vaso</button>` : ""}
        <button type="button" class="foco__chip foco__chip--b" data-action="foco-cuerpo" data-v="estirar">Estirarme</button><button type="button" class="foco__chip foco__chip--b" data-action="foco-cuerpo" data-v="lejos">Mirar lejos</button></div>
        <button type="button" class="foco__mini mt-8" data-action="foco-saltar">Saltar el descanso</button></div>` : ""}
    ${typeof focoSalaHtml === "function" ? focoSalaHtml(a) : ""}
    <div class="foco__acc"><button type="button" class="foco__btn foco__btn--p" data-action="foco-pausa">${a.pausa ? "Seguir" : "Pausar"}</button>
      <button type="button" class="foco__btn" data-action="foco-terminar">Terminar</button>
      <button type="button" class="foco__btn foco__btn--anota" data-action="foco-anotar">+ Anotar algo para después</button></div>
    <div class="foco__anota" id="fo-anota" hidden><input class="input" id="fo-anota-txt" maxlength="120" placeholder="Lo que se te cruzó…" autocomplete="off">
      <div class="foco__anota-b"><button type="button" class="foco__btn foco__btn--p" data-action="foco-anota-tarea">Tarea de hoy</button><button type="button" class="foco__btn" data-action="foco-anota-nota">Nota</button></div></div>
    <div class="foco__pend" id="fo-pend" aria-live="polite">${a.pend ? `Anotaste ${a.pend} ${a.pend === 1 ? "cosa" : "cosas"} para después` : ""}</div>
    ${ele ? `<div class="foco__ele" aria-hidden="true">${ele}</div>` : ""}</div>`;
}
function focoReloj(ms) { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s % 60).padStart(2, "0"); }
function focoTick() {
  const a = focoActiva(); if (!a) return cerrarFoco();
  const r = focoAvanzar(a);
  if (r.cambio) { focoGuardarActiva(a); if (r.terminada) return focoTerminar(true); focoCambioTramo(a); return; }
  const t = focoTramoAct(a), libre = t[1] === "x", desc = t[1] === "d" || t[1] === "l", n = a.tramos.filter(x => x[1] === "f").length;
  const nAct = a.tramos.slice(0, a.tramo + 1).filter(x => x[1] === "f").length;
  const ms = libre ? focoLleva(a) : focoRestante(a), f = libre ? (focoLleva(a) % 3600000) / 3600000 : 1 - ms / (t[0] * 60000);
  const k = desc ? (t[1] === "l" ? "Descanso largo" : "Descanso") : a.pausa ? "En pausa" : a.destino && a.destino.bocado ? BOCADO.corto + (n > 1 ? ` · ${nAct} de ${n}` : "") : libre ? "En foco · libre" : "En foco" + (n > 1 ? ` · ${nAct} de ${n}` : "");
  const set = (id, v) => { const x = document.getElementById(id); if (x && x.textContent !== v) x.textContent = v; };
  set("fo-k", k); set("fo-num", focoReloj(ms));
  set("fo-sub", libre ? "y contando" : desc ? "de descanso" : `de ${t[0]} min`);
  const svg = document.getElementById("fo-svg"); if (svg) svg.innerHTML = focoDibujo(a.estilo, f, { descanso: desc });
  const pill = document.getElementById("focoPill");
  if (pill) { pill.hidden = false; pill.classList.toggle("is-desc", desc); pill.classList.toggle("is-pausa", !!a.pausa); const pv = pill.querySelector(".foco-pill__t"); if (pv) pv.textContent = a.pausa ? "Pausa" : focoReloj(ms); pill.setAttribute("aria-label", `Sesión de foco: ${k}, ${focoReloj(ms)}. Toca para verla en grande`); }
  document.title = (a.pausa ? "En pausa" : focoReloj(ms)) + " · " + ((a.destino && a.destino.titulo) || "Rumbo");
}
/* Terminó un tramo: suena, vibra, avisa y repinta (el descanso trae sus ideas) */
function focoCambioTramo(a) {
  const t = focoTramoAct(a), desc = t[1] === "d" || t[1] === "l";
  focoCampana(); if (typeof vibrar === "function") vibrar([60, 80, 60]);
  focoNotificar(desc ? "Toca un descanso" : "A enfocarse otra vez", desc ? `${t[0]} min de descanso. Después sigues con ${(a.destino && a.destino.titulo) || "lo tuyo"}.` : (a.destino && a.destino.titulo) || "");
  focoAvisoServidor(a);
  mostrarFoco(a.modo === "completa" || desc ? null : false);
}
async function focoNotificar(titulo, cuerpo) {
  try {
    if (!document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    const op = { body: cuerpo, icon: "assets/icon-192.png", badge: "assets/badge-96.png", tag: "rumbo-enfoque", data: { url: "./#inicio" } };
    reg ? reg.showNotification("⏱️ " + titulo, op) : new Notification("⏱️ " + titulo, op);
  } catch (e) {}
}
function cerrarFoco() {
  clearInterval(FOCO_TIMER); FOCO_TIMER = null;
  const el = document.getElementById("foco"); if (el) el.hidden = true;
  const pill = document.getElementById("focoPill"); if (pill) pill.hidden = true;
  document.body.classList.remove("en-foco");
  if (/ · /.test(document.title)) document.title = "Rumbo";
}
/* Al abrir la app o volver a ella: la sesión sigue donde corresponde (o se cierra si ya terminó) */
function retomarFoco() { const a = focoActiva(); if (a) mostrarFoco(); else cerrarFoco(); }
function retomarEnfoque() { retomarFoco(); }

/* -------- Terminar y el cierre en tres toques -------- */
function focoTerminar(completa) {
  const a = focoActiva(); if (!a) return cerrarFoco();
  if (!completa) focoAvanzar(a);
  const ahora = Date.now(), rec = focoRegistro(a, completa, ahora);
  focoGuardarActiva(null); cerrarFoco(); focoCallar(); focoAvisoServidor(null);
  if (typeof focoSalaAlTerminar === "function") focoSalaAlTerminar(a, completa);
  if (completa) { focoCampana(); focoNotificar("¡Tiempo!", `Terminaste tu sesión: ${(a.destino && a.destino.titulo) || ""}`); }
  if (!rec) { toast(completa ? "Listo" : "Sesión cancelada: fue muy corta para contarla"); rerender(); return; }
  sesionesEnfoque(STATE).push(rec);
  const estrellas = focoDarEstrellas(STATE, rec);
  const marcado = focoAlTerminar(rec);
  saveState(); if (typeof refreshPts === "function") refreshPts(estrellas ? FOCO_ESTRELLAS : 0);
  if (completa && typeof celebrar === "function") celebrar("enfoque");
  FOCO_UI.cierre = { id: rec.id, estrellas, marcado };
  focoCierre(rec);
  rerender();
}
/* Lo que se suma solo: un hábito con duración queda marcado al completar sus minutos de hoy */
function focoAlTerminar(rec) {
  if (!rec.habId) return false;
  const h = STATE.habitos.defs.find(x => x.id === rec.habId); if (!h || !(+h.minutos > 0)) return false;
  const d = agDate(rec.fecha), hecho = typeof habitDoneDate === "function" && habitDoneDate(h.id, d);
  if (hecho || focoMinHabito(STATE, h.id, rec.fecha) < +h.minutos || typeof toggleHabitDate !== "function") return false;
  toggleHabitDate(h.id, d.getFullYear(), d.getMonth(), d.getDate());
  return true;
}
function focoCierre(rec) {
  const c = FOCO_UI.cierre || {}, d = rec, hoy = rec.fecha;
  const t = d.tipo === "tarea" ? buscarTarea(STATE, hoy, d.ref) : null;
  const h = d.habId && STATE.habitos.defs.find(x => x.id === d.habId), l = d.libroId && (STATE.lecturas || []).find(x => x.id === d.libroId);
  const o = focoObjetivo(STATE, d.objId), y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1;
  let extra = "";
  if (t && estadoTarea(t) === "pendiente") extra = `<div class="fo-c__fila"><span>¿Terminaste la tarea?</span><div class="fo-dos"><button type="button" class="btn btn--primary" data-action="foco-tarea-hecha" data-fecha="${hoy}" data-id="${t.id}">Lo terminé ✓</button><button type="button" class="btn btn--soft" data-action="foco-tarea-no">Todavía no</button></div></div>`;
  else if (h) {
    const hecho = focoMinHabito(STATE, h.id, hoy);
    extra = c.marcado ? `<div class="fo-c__ok">✓ «${escapeHtml(h.nombre)}» quedó marcado hoy</div>`
      : `<div class="fo-c__fila"><span>Llevas <b>${Math.min(hecho, h.minutos)} de ${h.minutos} min</b> de «${escapeHtml(h.nombre)}» hoy</span>${hecho < h.minutos ? `<button type="button" class="btn btn--soft" data-action="foco-habito" data-id="${h.id}">▶ ${h.minutos - hecho} min más</button>` : ""}</div>`;
  } else if (l) {
    extra = `<div class="fo-c__fila"><span>¿En qué página quedaste?${+l.paginas ? ` <small class="muted">(de ${+l.paginas})</small>` : ""}</span>${elContador("fo-pag", +l.pagina || 0, { min: 0, max: +l.paginas || 3000, label: "Página", fmt: focoFmtPag, fmtFn: "focoFmtPag" })}</div>`;
  } else if (d.tipo === "juntos") {
    const oj = (typeof OBJ !== "undefined" && OBJ.lista || []).find(x => x.id === d.ref), horas = Math.round(d.real / 60 * 10) / 10;
    if (oj && horas > 0) extra = `<div class="fo-c__fila"><span>¿Sumas <b>${String(horas).replace(".", ",")} ${horas === 1 ? "hora" : "horas"}</b> a «${escapeHtml(oj.nombre)}»?</span><button type="button" class="btn btn--primary" data-action="foco-aporte" data-id="${escapeAttr(oj.id)}" data-v="${horas}">Sumar</button></div>`;
  }
  if (o) extra += `<div class="fo-c__nota">🎯 Llevas <b>${fmtFoco(focoMinObjetivo(STATE, o.id, y, m))}</b> en «${escapeHtml(o.texto)}» este mes</div>`;
  openModal(rec.completa ? `⏱️ ¡Tiempo! ${fmtFoco(rec.real)}` : `⏱️ Sesión terminada · ${fmtFoco(rec.real)}`, `
    <p class="soft" style="margin:0 0 12px">${escapeHtml(rec.titulo)}</p>
    <div class="fo-c__fila"><span>¿Cómo estuvo tu concentración?</span><div class="fo-caras" role="radiogroup" aria-label="Tu concentración">
      ${FOCO_CONC.map(([v, n]) => `<button type="button" class="fo-cara${rec.conc === v ? " is-on" : ""}" role="radio" aria-checked="${rec.conc === v}" data-action="foco-conc" data-v="${v}">${n}</button>`).join("")}</div></div>
    ${extra}
    <div class="field mt-16"><label for="fo-sigue-txt">¿Qué sigue? <span class="text-xs muted">(te espera la próxima vez)</span></label>
      <input class="input" id="fo-sigue-txt" maxlength="140" placeholder="Ej: revisar las citas de la sección 2" value="${escapeAttr(focoSigue(STATE, focoClave(rec)))}"></div>
    ${c.estrellas ? `<div class="fo-c__ok">+${FOCO_ESTRELLAS} ⭐ por la sesión completa</div>` : ""}
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="foco-cierre-ok">Listo</button>`);
}
function focoRecActual() { const id = FOCO_UI.cierre && FOCO_UI.cierre.id; return id ? sesionesEnfoque(STATE).find(x => x.id === id) : null; }
function focoCierreOk() {
  const rec = focoRecActual();
  if (rec) {
    const s = document.getElementById("fo-sigue-txt"); if (s) focoGuardarSigue(STATE, focoClave(rec), s.value);
    const pag = document.getElementById("fo-pag"), l = rec.libroId && (STATE.lecturas || []).find(x => x.id === rec.libroId);
    if (pag && l && +pag.value !== (+l.pagina || 0)) {
      const p = Math.max(0, Math.round(+pag.value || 0)), antes = +l.pagina || 0; l.pagina = p; l.ts = Date.now();
      if (l.juntos && typeof ljAvance === "function") ljAvance(l.id, p);
      if (p > antes) toast(`📖 ${p - antes} ${p - antes === 1 ? "página" : "páginas"} en ${fmtFoco(rec.real)}`);
      if (+l.paginas && p >= +l.paginas && typeof openLoTermine === "function") { saveState(); closeModal(); FOCO_UI.cierre = null; return openLoTermine(l.id); }
    }
    saveState();
  }
  FOCO_UI.cierre = null; closeModal(); rerender();
}

/* -------- Acciones (data-action="foco-…") -------- */
function focoAccion(a, d, el) {
  if (a === "foco-abrir") return openFoco(d.tipo ? { tipo: d.tipo, ref: d.ref || d.id || "" } : null);
  if (a === "foco-habito") { closeModal(); return openFoco({ tipo: "habito", ref: d.id }); }
  if (a === "foco-objetivo") return openFoco({ tipo: "objetivo", ref: d.id });
  if (a === "foco-libro") { closeModal(); return openFoco({ tipo: "libro", ref: d.id }); }
  if (a === "foco-elegir") { FOCO_UI.sel = d.k; const x = focoDestinoDe(STATE, d.k); if (x && x.min && FOCO_UI.ritmo !== "libre") FOCO_UI.min = x.min; focoElegirPintar(); if (d.k === "libre:") { const i = document.getElementById("fo-libre"); if (i) i.focus(); } return; }
  if (a === "foco-min") { if (d.v === "libre") FOCO_UI.ritmo = "libre"; else { FOCO_UI.min = +d.v; if (FOCO_UI.ritmo === "libre") FOCO_UI.ritmo = "una"; } return focoElegirPintar(); }
  if (a === "foco-ritmo") { FOCO_UI.ritmo = d.v; return focoElegirPintar(); }
  if (a === "foco-estilo") { const r = FOCO_RELOJES.find(x => x.v === d.v); if (r && !focoTieneCos(r.cos)) return focoVerEnTienda(r.cos); FOCO_UI.estilo = d.v; return focoElegirPintar(); }
  if (a === "foco-sonido-elegir") { const s = FOCO_SONIDOS.find(x => x.v === d.v); if (s && !focoTieneCos(s.cos)) return focoVerEnTienda(s.cos); FOCO_UI.sonido = d.v; focoSonar(d.v, 4); return focoElegirPintar(); }
  if (a === "foco-modo") { FOCO_UI.modo = d.v; return focoElegirPintar(); }
  if (a === "foco-empezar") return focoEmpezar();
  if (a === "foco-ver") return mostrarFoco(true);
  if (a === "foco-barra") return mostrarFoco(false);
  if (a === "foco-pausa") { const s = focoActiva(); if (!s) return; focoPausar(s); focoGuardarActiva(s); focoAvisoServidor(s); if (s.pausa) focoCallar(1); else if (s.sonido) focoSonar(s.sonido); return mostrarFoco(); }
  if (a === "foco-terminar") return focoTerminar(false);
  if (a === "foco-saltar") { const s = focoActiva(); if (!s) return; focoSaltar(s); if (s.tramo >= s.tramos.length) { focoGuardarActiva(s); return focoTerminar(true); } focoGuardarActiva(s); focoAvisoServidor(s); return mostrarFoco(); }
  if (a === "foco-silencio") { const s = focoActiva(); if (!s || !s.sonido) return; if (FOCO_AUDIO.v) focoCallar(1); else focoSonar(s.sonido); return mostrarFoco(); }
  if (a === "foco-vaso") { if (typeof aguaSumar === "function" && aguaSumar(aguaVaso())) toast("💧 +1 vaso"); return; }
  if (a === "foco-cuerpo") { toast(d.v === "lejos" ? "20 segundos mirando algo lejano: tus ojos lo agradecen" : "Un minuto de estirarte: cuello, hombros y espalda"); return; }
  if (a === "foco-anotar") { const f = document.getElementById("fo-anota"); if (f) { f.hidden = !f.hidden; if (!f.hidden) document.getElementById("fo-anota-txt").focus(); } return; }
  if (a === "foco-anota-tarea" || a === "foco-anota-nota") return focoAnotar(a === "foco-anota-nota");
  if (a === "foco-conc") { const rec = focoRecActual(); if (!rec) return; rec.conc = +d.v; rec.ts = Date.now(); saveState(); document.querySelectorAll(".fo-cara").forEach(b => { const on = +b.dataset.v === rec.conc; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", String(on)); }); return; }
  if (a === "foco-tarea-hecha") { const t = buscarTarea(STATE, d.fecha, d.id); if (t && estadoTarea(t) !== "hecha") { marcarTarea(t, "hecha", { hechaTs: Date.now() }); registrarMovimiento("tarea:" + t.id, 15, 15, "Tarea"); if (typeof alCompletarTarea === "function") alCompletarTarea(t); saveState(); toast("✓ Tarea hecha"); } el.closest(".fo-c__fila").outerHTML = `<div class="fo-c__ok">✓ Tarea hecha</div>`; return; }
  if (a === "foco-tarea-no") { const f = el.closest(".fo-c__fila"); if (f) f.remove(); const i = document.getElementById("fo-sigue-txt"); if (i) i.focus(); return; }
  if (a === "foco-aporte") return focoAportar(d.id, +d.v, el);
  if (a === "foco-cierre-ok") return focoCierreOk();
  if (a === "foco-oir") return focoSonar(d.v, 6);
  if (a === "foco-obj-ver") return focoObjetivoHoja(d.id);
  if ((a.startsWith("foco-amigo") || a.startsWith("foco-sala")) && typeof focoAmigosAccion === "function") return focoAmigosAccion(a, d, el);
}
/* Lo que se te cruza: a tus tareas de hoy o a tus notas, sin cortar la sesión */
function focoAnotar(comoNota) {
  const i = document.getElementById("fo-anota-txt"), txt = i ? i.value.trim() : ""; if (!txt) { if (i) i.focus(); return; }
  if (comoNota) { STATE.postits = STATE.postits || []; STATE.postits.unshift({ id: uid(), titulo: "", texto: txt + " #foco", etiquetas: ["foco"], fijada: false, color: "", archivada: false, ts: Date.now() }); }
  else nuevaTarea(STATE, todayISO(), { txt, ambito: "per" });
  const a = focoActiva(); if (a) { a.pend = (a.pend || 0) + 1; focoGuardarActiva(a); }
  saveState(); i.value = "";
  const p = document.getElementById("fo-pend"); if (p && a) p.textContent = `Anotado ${comoNota ? "en tus notas" : "en tus tareas de hoy"} · ${a.pend} para después`;
  document.getElementById("fo-anota").hidden = true;
}
async function focoAportar(id, horas, el) {
  if (!BACKEND.objetivoAportar || !(horas > 0)) return;
  el.disabled = true;
  const r = await BACKEND.objetivoAportar(id, horas, "Foco", todayISO());
  if (r && r.error) { el.disabled = false; return toast(typeof ojTextoError === "function" ? ojTextoError(r.error) : "No se pudo sumar", true); }
  BACKEND.amigosAvisar && BACKEND.amigosAvisar("objetivo-aporte", { objetivo: id, aporte: r.id });
  el.closest(".fo-c__fila").outerHTML = `<div class="fo-c__ok">✓ Sumaste ${String(horas).replace(".", ",")} h al objetivo</div>`;
  if (typeof objetivosCargar === "function") objetivosCargar(true);
}
function focoVerEnTienda(cos) {
  closeModal(); if (typeof TIENDA_SEC !== "undefined") TIENDA_SEC = "estilo";
  go("recompensas"); setTimeout(() => { if (typeof openFicha === "function") openFicha("cos:" + cos); }, 350);
}
/* Un objetivo: sus horas de foco de las últimas 4 semanas */
function focoObjetivoHoja(id) {
  const o = focoObjetivo(STATE, id); if (!o) return;
  const sem = focoSemanasObjetivo(STATE, id), max = Math.max(60, ...sem.map(s => s.min)), hoy = todayISO(), y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1;
  openModal("⏱️ " + o.texto, `<p class="text-sm muted" style="margin:0 0 12px">Tu tiempo de foco en este objetivo: <b>${fmtFoco(focoMinObjetivo(STATE, id, y, m))}</b> en ${MESES[m].toLowerCase()}.</p>
    <div class="fo-sem" role="img" aria-label="${escapeAttr(sem.map((s, i) => (i === 3 ? "esta semana" : "semana del " + agDate(s.lunes).getDate()) + ": " + fmtFoco(s.min)).join(", "))}">
      ${sem.map((s, i) => `<div class="fo-sem__c"><span class="fo-sem__v">${s.min ? fmtFoco(s.min) : "—"}</span><i style="height:${Math.round((s.min / max) * 100)}%"></i><span class="fo-sem__l">${i === 3 ? "esta" : "sem. " + agDate(s.lunes).getDate() + "/" + (agDate(s.lunes).getMonth() + 1)}</span></div>`).join("")}</div>
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="foco-objetivo" data-id="${escapeAttr(id)}">▶ Dedicarle tiempo ahora</button>`);
}

/* -------- Donde aparece (solo si lo usaste) -------- */
/* Objetivos: «⏱ 6 h 40» bajo el objetivo y el ▶ para dedicarle tiempo */
function focoMetaSub(m, y, idx) { const min = focoMinObjetivo(STATE, m.id, y, idx); return min ? `<button type="button" class="item-row__sub fo-meta" data-action="foco-obj-ver" data-id="${escapeAttr(m.id)}">⏱ ${fmtFoco(min)} de foco</button>` : ""; }
function focoMetaBoton(m, y, idx) {
  const hoy = todayISO(); if (m.done || y !== +hoy.slice(0, 4) || idx !== +hoy.slice(5, 7) - 1) return "";
  return `<button type="button" class="icon-btn fo-play" data-action="foco-objetivo" data-id="${escapeAttr(m.id)}" title="Dedicarle tiempo" aria-label="Enfocarme en «${escapeAttr(m.texto)}»">▶</button>`;
}
/* Hábitos: el ▶ de un hábito con duración (y cuánto llevas hoy) */
function focoHabitoBoton(h) {
  if (!(+h.minutos > 0) || (typeof hmMeta === "function" && hmMeta(h) !== "hacer")) return "";
  const hoy = todayISO(), hecho = focoMinHabito(STATE, h.id, hoy), falta = Math.max(0, h.minutos - hecho);
  if (habitDoneDate(h.id, new Date())) return "";
  return `<button type="button" class="hb-today__play" data-action="foco-habito" data-id="${h.id}" aria-label="Enfocarme en ${escapeAttr(h.nombre)}: ${falta} minutos">▶ ${hecho ? falta + " más" : falta + " min"}</button>`;
}
/* El recibo del día: «1 h 15 de foco · 50 min en tu primer bocado» */
function focoReciboTxt(iso) {
  const min = minutosFoco(STATE, iso, iso); if (!min) return "";
  const bocado = tareasDelDia(iso).find(t => t.esSapo), mb = bocado ? minutosFoco(STATE, iso, iso, x => x.tareaId === bocado.id) : 0;
  return fmtFoco(min) + (mb ? ` · ${fmtFoco(mb)} en tu primer bocado` : "");
}
/* Tendencias: horas por semana, por objetivo y tu mejor hora (solo si ya lo usaste) */
function renderFocoTendencias() {
  if (!sesionesEnfoque(STATE).some(x => x && !x.borrada)) return "";
  const hoy = todayISO(), L = agLunes(hoy), y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1;
  const semanas = Array.from({ length: 8 }, (_, i) => agSumar(L, -7 * (7 - i)));
  const horas = semanas.map(l => +(minutosFoco(STATE, l, agSumar(l, 6)) / 60).toFixed(1));
  const esta = minutosFoco(STATE, L, agSumar(L, 6)), n = focoSesiones(STATE, L, agSumar(L, 6)).length;
  const objs = focoPorObjetivo(STATE, y, m).slice(0, 3), mejor = focoMejorHora(STATE, agSumar(hoy, -60), hoy);
  const areas = typeof ruedaVisibles === "function" ? ruedaVisibles(STATE).map(k => ({ k, min: focoMinArea(STATE, y, m, k) })).filter(x => x.min).sort((a, b) => b.min - a.min).slice(0, 3) : [];
  return `<div class="section-title">${icoHab("⏱️", 16)} Foco</div>
  <div class="grid grid-2"><div class="card stat"><div class="stat__label">${icoHab("⏱️", 14)} Foco esta semana</div><div class="stat__value">${fmtFoco(esta)}</div>
      <div class="text-xs muted mt-8">${n} ${n === 1 ? "sesión" : "sesiones"} · ${sesionesCompletas(STATE)} completas en total</div>
      ${mejor ? `<div class="text-sm mt-8">Te concentras mejor entre las <b>${mejor[0]}</b> y las <b>${mejor[1]}</b></div>` : ""}
      ${objs.length ? `<div class="fo-tend mt-8">${objs.map(x => `<div class="flex-between text-sm"><span>🎯 ${escapeHtml(x.o.texto)}</span><b class="hl-cian">${fmtFoco(x.min)}</b></div>`).join("")}</div>` : ""}
      ${areas.length ? `<div class="text-xs muted mt-8">En tu rueda: ${areas.map(x => `${escapeHtml(ruedaCorto(STATE, x.k))} ${fmtFoco(x.min)}`).join(" · ")}</div>` : ""}
      <button class="btn btn--cian mt-16" data-action="foco-abrir">Enfocarme ahora</button></div>
    <div class="card"><div class="card__head"><div class="card__title">Horas de foco por semana</div><span class="card__hint">últimas 8</span></div>
      ${svgBar(horas, { color: "var(--cian)", fmt: v => String(v).replace(".", ",") + " h", labels: semanas.map(l => { const d = agDate(l); return d.getDate() + "/" + (d.getMonth() + 1); }) })}</div></div>`;
}

/* -------- La Tienda: «Tu foco» -------- */
function focoFichaHtml(it) {
  if (it.key === "foco") return `<span class="fo-ficha">${focoDibujoSvg(it.value, 0.4)}</span>`;
  return `<span class="fo-ficha fo-ficha--son" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/></svg></span>`;
}
function focoMuestraHtml(it) {
  if (it.key === "foco") return `<div class="fo-muestra">${[0.15, 0.5, 0.85].map(f => focoDibujoSvg(it.value, f)).join("")}</div>`;
  return `<button type="button" class="btn btn--soft btn-block" data-action="foco-oir" data-v="${escapeAttr(it.value)}">▶ Escuchar 6 segundos</button>`;
}
