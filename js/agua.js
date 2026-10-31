/* ============================================================
   RUMBO · 💧 Agua para todos
   La tarjeta «Agua de hoy» en Inicio y la hoja «Tu agua»: cada vaso se registra con un toque,
   la meta sale de tu peso (Salud) o la eliges tú, al cumplirla se marca el hábito «Agua» y
   ganas +10 ⭐ (una vez al día; si deshaces y quedas bajo la meta, se devuelven).
   Cómo se ve es un estilo: la botella viene con Rumbo; la burbuja, la cantimplora, la bombilla,
   el reloj de agua, el día de calor, la esclusa y tu elefante riega (3D) se compran en Tienda ›
   Para tu estilo › «Tu agua», igual que los sabores (el color del agua) y el acuario del mes
   (un pez por cada día cumplido, en Salud y en el cierre de mes).
   El botón de agua (la portilla) vive abajo a la derecha en todas las pantallas: abre tu estilo
   en una ventana redonda y tocarlo es tomar un vaso.
   Los días de calor la meta sube (Open-Meteo, con la ciudad que eliges): medio litro sobre 28 °C
   y un litro sobre 32 °C. El agua se dibuja en canvas: olas con resortes, burbujas y chorros.
   Datos: STATE.agua (ver state.js); entre equipos se fusiona con aguaMerge (store.js).
   ============================================================ */
const AGUA_PREMIO = 10, AGUA_DETALLE = 14, AGUA_TOPE = 8000;
const AGUA_ESTILOS = [
  { id: "botella", nombre: "La botella", cos: null, desc: "se llena vaso a vaso" },
  { id: "burbuja", nombre: "La burbuja", cos: "agua-burbuja", desc: "flota, tiembla y se llena por volumen" },
  { id: "cantimplora", nombre: "La cantimplora", cos: "agua-cantimplora", desc: "cuatro tramos; se rellena en cada parada" },
  { id: "bombilla", nombre: "La bombilla", cos: "agua-bombilla", desc: "el vaso con lo que te queda; mantén apretado para tomar" },
  { id: "reloj", nombre: "El reloj de agua", cos: "agua-reloj", desc: "se vacía hasta tu próximo vaso" },
  { id: "calor", nombre: "El día de calor", cos: "agua-calor", desc: "la botella transpira con el sol de tu ciudad" },
  { id: "esclusa", nombre: "La esclusa", cos: "agua-esclusa", desc: "el barquito sube y zarpa en la meta" },
  { id: "elefante", nombre: "Tu elefante riega", cos: "agua-elefante", desc: "cada vaso riega su planta, que florece en la meta" },
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
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { meta: 0, vaso: 250, inicio: true, fab: false, clima: null, ts: 0, dias: {} };   // sin sesión (al salir de la cuenta): nada que guardar
  if (!S.agua || typeof S.agua !== "object" || !S.agua.dias || typeof S.agua.dias !== "object") S.agua = { meta: 0, vaso: 250, inicio: true, fab: true, clima: null, ts: 0, dias: {} };
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
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  const p = S && typeof pesoActualGlobal === "function" ? pesoActualGlobal(S) : null;
  return p > 0 ? Math.min(3500, Math.max(1500, Math.round(p * 35 / 50) * 50)) : 2000;
}
function aguaMetaBase(S) { const a = aguaDatos(S); return a.meta > 0 ? a.meta : aguaMetaAuto(S); }
/* Los días de calor: sobre 28 °C medio litro más, sobre 32 °C un litro (la temperatura del día queda en dias[fecha].c) */
function aguaExtraCalor(c) { return c >= 32 ? 1000 : c >= 28 ? 500 : 0; }
/* La temperatura del día, para mostrarla; y la que cuenta para la meta (no cuenta si llegó cuando ya habías cumplido: cp) */
function aguaTempDe(fecha, S) {
  const a = aguaDatos(S); if (!a.clima || !a.clima.on) return null;
  const d = a.dias[fecha || todayISO()]; return d && typeof d.c === "number" ? d.c : null;
}
function aguaCalorDe(fecha, S) { const d = aguaDatos(S).dias[fecha || todayISO()]; return d && d.cp ? null : aguaTempDe(fecha, S); }
function aguaMeta(S, fecha) { const c = aguaCalorDe(fecha, S); return Math.min(AGUA_TOPE, aguaMetaBase(S) + (c == null ? 0 : aguaExtraCalor(c))); }
function aguaCalorTxt(S) {
  const c = aguaCalorDe(null, S), x = c == null ? 0 : aguaExtraCalor(c);
  return x ? `Hoy ${c} °C: tu meta sube ${x >= 1000 ? "un litro" : "medio litro"}` : "";
}
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
  const total = aguaTotal(d), meta = aguaMeta(null, fecha), mov = "agua:" + fecha, h = aguaHabito();
  const [y, m, dd] = fecha.split("-").map(Number);
  if (total >= meta && !d.p) {
    d.p = true; saveState();
    registrarMovimiento(mov, AGUA_PREMIO, AGUA_PREMIO, "Meta de agua", true);
    toast(`💧 ¡Meta de agua cumplida! +${AGUA_PREMIO} ⭐${typeof isOwned === "function" && isOwned("agua-acuario") ? " · llegó un pez a tu acuario" : ""}`);
    if (h && !habitDone(h.id, m - 1, dd, y) && (typeof tocaHoy !== "function" || tocaHoy(h))) { d.h = true; saveState(); toggleHabitDate(h.id, y, m - 1, dd); return; }
  } else if (total < meta && d.p) {
    d.p = false; saveState(); anularMovimiento(mov);
    if (d.h) { d.h = false; saveState(); if (h && habitDone(h.id, m - 1, dd, y)) { toggleHabitDate(h.id, y, m - 1, dd); return; } }
  }
  if (typeof updateTopbar === "function") updateTopbar();
}

/* -------- El clima de tu ciudad (Open-Meteo, gratis y sin cuenta) --------
   Solo viajan las coordenadas de la ciudad que eliges, nunca tu ubicación. Sin conexión queda tu meta de siempre. */
let AGUA_CLIMA_PIDIO = "", AGUA_CIUDADES = [], AGUA_CIUDAD_BUSCAR = false;
const AGUA_SOL_SVG = `<svg class="agua-sol" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`;
function aguaClimaRevisar() {
  if (typeof fetch !== "function" || typeof STATE === "undefined" || !STATE) return;
  const a = aguaDatos(), cl = a.clima, hoy = todayISO();
  if (!cl || !cl.on || !isFinite(cl.lat) || !isFinite(cl.lon) || cl.lat === null || AGUA_CLIMA_PIDIO === hoy) return;
  const d = a.dias[hoy]; if (d && typeof d.c === "number") return;   // ya está la de hoy
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  AGUA_CLIMA_PIDIO = hoy;
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${(+cl.lat).toFixed(2)}&longitude=${(+cl.lon).toFixed(2)}&daily=temperature_2m_max&timezone=auto&forecast_days=1`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error("clima " + r.status))))
    .then(j => {
      const t = j && j.daily && j.daily.temperature_2m_max && j.daily.temperature_2m_max[0];
      if (typeof t !== "number" || todayISO() !== hoy) return;
      const dd = aguaDia(hoy, true); if (typeof dd.c === "number") return;
      dd.c = Math.round(t); if (dd.p) dd.cp = true;   // si ya cumpliste, la meta de hoy no cambia (y no se devuelven las ⭐)
      saveState(); aguaPintar(0);
      if (document.getElementById("agua-hoja")) openAgua();
    })
    .catch(() => { AGUA_CLIMA_PIDIO = ""; });
}
function aguaCiudadBuscar(q) {
  q = String(q || "").trim(); const caja = () => document.getElementById("agua-ciudades");
  if (q.length < 2) { if (caja()) caja().innerHTML = `<small class="text-xs muted">Escribe al menos dos letras.</small>`; return; }
  if (caja()) caja().innerHTML = `<small class="text-xs muted">Buscando…</small>`;
  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=es&format=json`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error("ciudades " + r.status))))
    .then(j => {
      AGUA_CIUDADES = ((j && j.results) || []).filter(x => isFinite(x.latitude) && isFinite(x.longitude)).slice(0, 5)
        .map(x => ({ ciudad: [x.name, x.admin1 && x.admin1 !== x.name ? x.admin1 : "", x.country].filter(Boolean).join(", "), lat: Math.round(x.latitude * 100) / 100, lon: Math.round(x.longitude * 100) / 100 }));
      if (!caja()) return;
      caja().innerHTML = AGUA_CIUDADES.length ? AGUA_CIUDADES.map((x, i) => `<button type="button" class="chip" data-action="agua-ciudad" data-i="${i}">${escapeHtml(x.ciudad)}</button>`).join("")
        : `<small class="text-xs muted">No encontré «${escapeHtml(q)}». Prueba con otro nombre.</small>`;
    })
    .catch(() => { if (caja()) caja().innerHTML = `<small class="text-xs muted">No pude buscar: revisa tu conexión.</small>`; });
}

/* Tu casa: con «Tu elefante riega» puesto, si tomaste agua hace menos de 20 minutos, el elefante va a regar su planta (casa.js) */
function aguaEleRiega(S, ahora) {
  const eq = (S && S.gamif && S.gamif.equipped) || {};
  if (eq.agua !== "elefante" || typeof isOwned !== "function" || !isOwned("agua-elefante")) return false;
  const e = aguaEstado(S); return !!e.ultimo && ((ahora ? +ahora : Date.now()) - e.ultimo) < 20 * 60000;
}

/* -------- El acuario del mes: un pez por cada día que cumpliste tu meta; con 7 seguidos, uno dorado -------- */
function aguaDiaCumplido(f, S) { const d = aguaDia(f, false, S); return !!d && (!!d.p || aguaTotal(d) >= aguaMeta(S, f)); }
function aguaMesAcuario(y, m, S) {
  const n = new Date(y, m + 1, 0).getDate(), hoy = todayISO(), dias = [];
  let racha = 0, dorados = 0;
  for (let d = 1; d <= n; d++) {
    const f = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, ok = f <= hoy && aguaDiaCumplido(f, S);
    dias.push({ d, f, ok, futuro: f > hoy, hoy: f === hoy });
    racha = ok ? racha + 1 : 0; if (racha && racha % 7 === 0) dorados++;
  }
  return { y, m, dias, peces: dias.filter(x => x.ok).length, dorados };
}
function aguaAcuarioHtml(y, m, cierre) {
  if (typeof isOwned !== "function" || !isOwned("agua-acuario")) return "";
  const hoy = todayISO(); if (y == null) { y = +hoy.slice(0, 4); m = +hoy.slice(5, 7) - 1; }
  const A = aguaMesAcuario(y, m), mes = MESES[m].toLowerCase(), clave = `${y}-${String(m + 1).padStart(2, "0")}`;
  const cuenta = `${A.peces} ${A.peces === 1 ? "pez" : "peces"}${A.dorados ? ` · ${A.dorados} ${A.dorados === 1 ? "dorado" : "dorados"}` : ""}`;
  return `<div class="card mt-16 agua-acuario">
    <div class="flex-between" style="gap:10px;flex-wrap:wrap"><b>🐠 Tu acuario de ${mes}</b><span class="text-sm muted">${cuenta}</span></div>
    <canvas class="agua-cv agua-acuario__cv" data-agua="acuario" data-modo="mes" data-mes="${clave}" style="aspect-ratio:280/190" role="img" aria-label="Tu acuario de ${mes}: ${cuenta}"></canvas>
    <div class="agua-mes" aria-hidden="true">${A.dias.map(x => `<i class="${x.ok ? "is-on" : x.futuro ? "is-futuro" : ""}${x.hoy ? " is-hoy" : ""}"></i>`).join("")}</div>
    <small class="text-xs muted">${cierre ? `Tu acuario de ${mes}: ${cuenta}. Queda guardado aquí y en Salud.` : "Cada día que cumples tu meta de agua llega un pez. Con 7 días seguidos, uno dorado."}</small>
  </div>`;
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
function aguaCalorHtml() { const t = aguaCalorTxt(); return `<small class="agua-calor" data-agua-calor ${t ? "" : "hidden"}>${t ? AGUA_SOL_SVG + escapeHtml(t) : ""}</small>`; }
function aguaInicioHtml() {
  if (!STATE || aguaDatos().inicio === false) return "";
  const e = aguaEstado(), estilo = aguaEstilo();
  setTimeout(aguaClimaRevisar, 0);
  return `<div class="card agua-card" data-agua-card>
    <div class="card__head"><div class="card__title">💧 Agua de hoy</div><button type="button" class="card__hint agua-abrir" data-action="agua-abrir">Tu agua →</button></div>
    <div class="agua-card__c">
      <canvas class="agua-cv" data-agua="${estilo}" data-modo="tarjeta" style="aspect-ratio:140/200" role="img" aria-label="${escapeAttr(AGUA_ESTILOS.find(x => x.id === estilo).nombre)}: ${escapeAttr(litrosTxt(e.ml))} de ${escapeAttr(litrosTxt(e.meta))} litros"></canvas>
      <div class="agua-card__info">
        <div class="agua-cifra" data-agua-cifra aria-live="polite">${aguaCifraHtml(e)}</div>
        <div class="agua-vasos" data-agua-vasos aria-hidden="true">${aguaVasitosHtml(e)}</div>
        <small class="agua-texto" data-agua-texto>${escapeHtml(aguaTexto(estilo, e))}</small>
        ${aguaCalorHtml()}
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
  const calor = aguaCalorTxt();
  document.querySelectorAll("[data-agua-calor]").forEach(x => { x.hidden = !calor; x.innerHTML = calor ? AGUA_SOL_SVG + escapeHtml(calor) : ""; });
  document.querySelectorAll("[data-agua-anillo]").forEach(x => { x.style.strokeDashoffset = String(100 - Math.min(100, e.frac * 100)); });
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
    <div class="agua-sec"><span class="cj-sub">Días de calor</span>${aguaCalorAjusteHtml()}</div>
    <div class="agua-sec"><span class="cj-sub">Tu vaso</span><div class="agua-chips">${[200, 250, 300, 350].map(v => chip("agua-vaso", v, v + " ml", aguaVaso() === v)).join("")}</div></div>
    <div class="agua-sec"><span class="cj-sub">Estilo</span><div class="agua-chips">${tuyos.map(x => chip("agua-estilo", x.id, x.nombre, x.id === estilo)).join("")}
      ${faltan ? `<button type="button" class="btn-link" data-action="agua-tienda">${faltan === 1 ? "1 estilo más" : faltan + " estilos más"} en la Tienda</button>` : ""}</div>
      ${sabores.length > 1 ? `<div class="agua-chips">${sabores.map(x => chip("agua-sabor", x.id, `<i class="agua-gota" style="background:${x.c ? x.c[1] : "#2E9BDB"}"></i>${x.nombre}`, x.id === sabor)).join("")}</div>` : ""}</div>
    <label class="agua-inicio"><input type="checkbox" data-action="agua-inicio" ${a.inicio !== false ? "checked" : ""}> Mostrar «Agua de hoy» en Inicio</label>
    <label class="agua-inicio"><input type="checkbox" data-action="agua-fab" ${a.fab !== false ? "checked" : ""}> Botón de agua abajo a la derecha</label>
  </div>`, { ancho: true });
}
function aguaCalorAjusteHtml() {
  const cl = aguaDatos().clima, c = aguaTempDe(), x = aguaCalorDe() == null ? 0 : aguaExtraCalor(c);
  const regla = "Sobre 28 °C tu meta sube medio litro; sobre 32 °C, un litro.";
  const cp = c != null && aguaCalorDe() == null && aguaExtraCalor(c) ? " · hoy ya la habías cumplido" : "";
  if (cl && cl.on && cl.ciudad && !AGUA_CIUDAD_BUSCAR) return `<div class="agua-clima"><span>${AGUA_SOL_SVG}<span><b>${escapeHtml(cl.ciudad)}</b>${c != null ? ` · hoy ${c} °C${x ? ` · meta +${litrosTxt(x)} L` : cp}` : ""}</span></span>
      <span class="agua-chips"><button type="button" class="btn-link" data-action="agua-ciudad-cambiar">Cambiar ciudad</button><button type="button" class="btn-link" data-action="agua-calor-off">Apagar</button></span></div>
    <small class="text-xs muted">${regla} Rumbo usa solo la ciudad que elegiste, no tu ubicación.</small>`;
  return `<small class="text-xs muted">${regla} Elige tu ciudad: Rumbo no usa tu ubicación.</small>
    ${cl && cl.ciudad && !cl.on && !AGUA_CIUDAD_BUSCAR ? `<div class="agua-chips"><button type="button" class="chip" data-action="agua-calor-on">${AGUA_SOL_SVG}Activar con ${escapeHtml(cl.ciudad)}</button></div>` : ""}
    <div class="agua-ciudad"><input class="input" id="agua-ciudad-q" placeholder="Tu ciudad" autocomplete="address-level2" aria-label="Tu ciudad"
        onkeydown="if(event.key==='Enter'){event.preventDefault();aguaCiudadBuscar(this.value)}">
      <button type="button" class="btn btn--soft" data-action="agua-ciudad-buscar">Buscar</button></div>
    <div class="agua-chips" id="agua-ciudades"></div>
    ${cl && cl.on && cl.ciudad && AGUA_CIUDAD_BUSCAR ? `<button type="button" class="btn-link" data-action="agua-ciudad-volver">Seguir con ${escapeHtml(cl.ciudad)}</button>` : ""}`;
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
  if (a === "agua-fab") { aguaAjuste({ fab: !!(el && el.checked) }); aguaFabActualizar(); return; }
  if (a === "agua-tienda") { closeModal(); if (typeof TIENDA_SEC !== "undefined") TIENDA_SEC = "estilo"; return go("recompensas"); }
  // los días de calor
  if (a === "agua-ciudad-buscar") { const q = document.getElementById("agua-ciudad-q"); return aguaCiudadBuscar(q && q.value); }
  if (a === "agua-ciudad") {
    const x = AGUA_CIUDADES[+d.i]; if (!x) return;
    AGUA_CIUDAD_BUSCAR = false; AGUA_CLIMA_PIDIO = "";
    aguaAjuste({ clima: { on: true, ciudad: x.ciudad, lat: x.lat, lon: x.lon } }); aguaClimaRevisar();
    return toast(`☀️ Listo: los días de calor en ${x.ciudad.split(",")[0]}, tu meta sube sola`);
  }
  if (a === "agua-ciudad-cambiar") { AGUA_CIUDAD_BUSCAR = true; return openAgua(); }
  if (a === "agua-ciudad-volver") { AGUA_CIUDAD_BUSCAR = false; return openAgua(); }
  if (a === "agua-calor-off") return aguaAjuste({ clima: Object.assign({}, aguaDatos().clima, { on: false }) });
  if (a === "agua-calor-on") { AGUA_CLIMA_PIDIO = ""; aguaAjuste({ clima: Object.assign({}, aguaDatos().clima, { on: true }) }); return aguaClimaRevisar(); }
  // el botón de agua (la portilla)
  if (a === "agua-fab-abrir") return aguaFabAbrir();
  if (a === "agua-fab-cerrar") return aguaFabCerrar();
  if (a === "agua-fab-tomar") {
    if (performance.now() - AGUA_FAB.sorbio < 500) return;   // la bombilla: lo que tomaste a sorbos ya se registró
    aguaSumar(aguaVaso()); return;
  }
  if (a === "agua-fab-hoja") { aguaFabCerrar(); return openAgua(); }
}
/* La Tienda: miniatura de la ficha y muestra grande en el detalle */
function aguaFichaHtml(it) {
  if (it.key === "sabor") { const s = AGUA_SABORES.find(x => x.id === it.value); return `<svg class="agua-ficha-gota" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5s-7 8-7 12.5a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z" fill="${s && s.c ? s.c[1] : "#2E9BDB"}"/></svg>`; }
  if (it.key === "acuario") return `<canvas class="agua-ficha agua-ficha--ancha" data-agua="acuario" data-modo="muestra" aria-hidden="true"></canvas>`;
  return `<canvas class="agua-ficha" data-agua="${escapeAttr(it.value)}" data-modo="muestra" data-frac="0.62" aria-hidden="true"></canvas>`;
}
function aguaMuestraHtml(it) {
  if (it.key === "acuario") return `<canvas class="agua-cv" data-agua="acuario" data-modo="muestra" style="aspect-ratio:280/190" aria-hidden="true"></canvas>`;
  const estilo = it.key === "sabor" ? aguaEstilo() : it.value, sabor = it.key === "sabor" ? it.value : "";
  return `<canvas class="agua-cv" data-agua="${escapeAttr(estilo)}" data-modo="muestra" data-frac="0.62" ${sabor ? `data-sabor="${escapeAttr(sabor)}"` : ""} style="aspect-ratio:140/200" aria-hidden="true"></canvas>`;
}

/* -------- El botón de agua (la portilla) --------
   Abajo a la derecha, en todas las pantallas, con tu estilo en chico. Al tocarlo se abre una ventana redonda
   con tu estilo, cuánto llevas y un anillo; tocar tu estilo es tomar un vaso (en la bombilla, mantén apretado
   para tomar a sorbos). Se esconde con el teclado abierto, en hojas y ventanas, en Tu casa y Tu vitrina, y en
   Inicio mientras se ve la tarjeta «Agua de hoy». Se apaga en «Tu agua». */
const AGUA_FAB = { el: null, listo: false, pronto: 0, abierta: false, estilo: "", card: null, cardVisible: false, io: null, sorbio: -1e9, raf: 0 };
function aguaFabHtml(estilo) {
  return `<button type="button" class="agua-fab__velo" data-action="agua-fab-cerrar" tabindex="-1" aria-hidden="true"></button>
    <div class="agua-fab__cap">
      <span class="agua-fab__texto" data-agua-texto></span>
      ${aguaCalorHtml()}
      <span class="agua-fab__fila"><span class="agua-fab__pista">${estilo === "bombilla" ? "Mantén apretado para tomar" : `Toca para tomar ${aguaVaso()} ml`}</span>
        <button type="button" class="btn-link agua-deshacer" data-action="agua-deshacer" hidden>Deshacer</button>
        <button type="button" class="btn-link agua-fab__hoja" data-action="agua-fab-hoja">Tu agua ›</button></span>
    </div>
    <div class="agua-fab__port" role="dialog" aria-label="Agua de hoy">
      <svg class="agua-fab__anillo" viewBox="0 0 236 236" aria-hidden="true"><circle cx="118" cy="118" r="112" pathLength="100"/><circle class="agua-fab__prog" cx="118" cy="118" r="112" pathLength="100" data-agua-anillo/></svg>
      <div class="agua-fab__num" data-agua-cifra></div>
      <button type="button" class="agua-fab__tomar" data-action="agua-fab-tomar" aria-label="${escapeAttr((AGUA_ESTILOS.find(x => x.id === estilo) || AGUA_ESTILOS[0]).nombre)}: tomar un vaso"></button>
    </div>
    <button type="button" class="agua-fab__btn" data-action="agua-fab-abrir" aria-expanded="false" aria-label="Agua de hoy"></button>`;
}
/* Los dibujos se crean cuando hacen falta: el chico cuando el botón se muestra, el grande la primera vez que se abre */
function aguaFabLienzo(sel, modo) {
  const caja = AGUA_FAB.el && AGUA_FAB.el.querySelector(sel);
  if (caja && !caja.querySelector("canvas")) caja.innerHTML = `<canvas class="agua-cv" data-agua="${AGUA_FAB.estilo}" data-modo="${modo}" style="aspect-ratio:140/200"${modo === "boton" ? ' aria-hidden="true"' : ""}></canvas>`;
}
function aguaFabActualizar() {
  if (typeof document === "undefined" || typeof STATE === "undefined" || !STATE || !document.body) return;
  // al arrancar, el botón espera un momento: lo primero es que se vea la app
  if (!AGUA_FAB.el && !AGUA_FAB.listo) { if (!AGUA_FAB.pronto) AGUA_FAB.pronto = setTimeout(() => { AGUA_FAB.listo = true; AGUA_FAB.pronto = 0; aguaFabActualizar(); }, 900); return; }
  if (!AGUA_FAB.el) {
    const el = document.createElement("div"); el.className = "agua-fab"; el.id = "aguaFab"; el.hidden = true;
    document.body.appendChild(el); AGUA_FAB.el = el;
    const revisar = () => { if (AGUA_FAB.raf) return; AGUA_FAB.raf = requestAnimationFrame(() => { AGUA_FAB.raf = 0; aguaFabVer(); }); };
    new MutationObserver(revisar).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("focusin", revisar); document.addEventListener("focusout", () => setTimeout(revisar, 80));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && AGUA_FAB.abierta) { aguaFabCerrar(); const b = el.querySelector(".agua-fab__btn"); if (b) b.focus(); } });
  }
  const estilo = aguaEstilo();
  if (AGUA_FAB.estilo !== estilo) { AGUA_FAB.estilo = estilo; AGUA_FAB.el.innerHTML = aguaFabHtml(estilo); aguaPintar(0); }
  // En Inicio, mientras se ve la tarjeta «Agua de hoy», el botón no se repite
  const card = document.querySelector("[data-agua-card]");
  if (card !== AGUA_FAB.card) {
    if (AGUA_FAB.io) AGUA_FAB.io.disconnect();
    AGUA_FAB.card = card; AGUA_FAB.cardVisible = !!card; AGUA_FAB.io = null;
    if (card && "IntersectionObserver" in window) { AGUA_FAB.io = new IntersectionObserver(es => { AGUA_FAB.cardVisible = es[es.length - 1].isIntersecting; aguaFabVer(); }, { threshold: 0.2 }); AGUA_FAB.io.observe(card); }
  }
  aguaFabVer();
  setTimeout(aguaClimaRevisar, 0);
}
function aguaFabVer() {
  const el = AGUA_FAB.el; if (!el) return;
  const app = document.getElementById("app"), ruta = typeof ROUTE_MAP !== "undefined" && typeof CURRENT !== "undefined" ? ROUTE_MAP[CURRENT] : null;
  const ae = document.activeElement;
  const escribe = !!ae && ae !== document.body && !el.contains(ae) && ae.matches && ae.matches("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]), textarea, select, [contenteditable=''], [contenteditable=true]");
  const tapa = document.querySelector("#modalOverlay:not([hidden]), .sheet-overlay:not([hidden]), .tour, .enfoque, .ele-escena, .ins-cerca, .auth:not([hidden])");
  const ver = !!STATE && aguaDatos().fab !== false && !!app && !app.hidden && !(ruta && ruta.lugar) && !tapa && !escribe
    && !(typeof CURRENT !== "undefined" && CURRENT === "inicio" && AGUA_FAB.card && AGUA_FAB.card.isConnected && AGUA_FAB.cardVisible);
  if (!ver && AGUA_FAB.abierta) aguaFabCerrar();
  if (ver) aguaFabLienzo(".agua-fab__btn", "boton");
  if (el.hidden === ver) el.hidden = !ver;
  document.body.classList.toggle("con-agua-fab", ver);   // la página deja espacio abajo para que el botón no tape lo último
}
function aguaFabAbrir() {
  const el = AGUA_FAB.el; if (!el || el.hidden) return;
  aguaFabLienzo(".agua-fab__tomar", "portilla");
  AGUA_FAB.abierta = true; el.classList.add("is-open");
  const b = el.querySelector(".agua-fab__btn"); if (b) b.setAttribute("aria-expanded", "true");
  aguaPintar(0); vibrar(6);
  el.querySelectorAll("canvas[data-modo=portilla]").forEach(cv => { if (cv._aguaDespertar) cv._aguaDespertar(); });
  const t = el.querySelector(".agua-fab__tomar"); if (t) setTimeout(() => t.focus({ preventScroll: true }), 60);
}
function aguaFabCerrar() {
  const el = AGUA_FAB.el; if (!el) return;
  AGUA_FAB.abierta = false; el.classList.remove("is-open");
  const b = el.querySelector(".agua-fab__btn"); if (b) b.setAttribute("aria-expanded", "false");
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
    /* El día de calor: el cielo se calienta con la temperatura de tu ciudad y la botella transpira */
    calor() {
      const forma = new Path2D("M58 46 L82 46 L84 60 C84 66 98 68 98 80 L98 176 Q98 188 86 188 L54 188 Q42 188 42 176 L42 80 C42 68 56 66 56 60 Z");
      const ola = new Ola(24), burb = new Burbujas(), gotas = new Gotas(), chorro = new Chorro(), marco = redondeado(2, 2, 136, 196, 18);
      const sudor = Array.from({ length: 30 }, (_, i) => ({ x: 45 + ((i * 37) % 50), y: 84 + ((i * 53) % 100), r: 0.8 + (i % 4) * 0.4, cae: false, vy: 0, rastro: [] }));
      const ARR = 62, ABA = 186, yDe = f => ABA - (ABA - ARR) * limitar(f, 0, 1);
      let espera = 0;
      return {
        verter(ml) { if (ml > 0) { chorro.abrir(70, -6, 0.75); espera = 0.25; } else ola.tocar(0.5, -3, 6); },
        tocar(x) { ola.tocar((x - 42) / 56, azar(-4, 4), 3); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; chorro.paso(dt); for (let i = 0; i < k; i++) ola.paso();
          if (espera <= 0) nivel.paso(Math.min(1, e.frac)); else nivel.paso(nivel.x);
          const temp = e.temp, calor = temp == null ? 0.45 : limitar((temp - 16) / 22, 0, 1);
          ctx.save(); ctx.clip(marco);
          const cielo = ctx.createLinearGradient(0, 0, 0, 200);
          cielo.addColorStop(0, C.oscuro ? mezcla("#16244A", "#4A2A3A", calor) : mezcla("#CFEAFB", "#FFD49A", calor));
          cielo.addColorStop(1, C.oscuro ? mezcla("#1D2C55", "#3A2440", calor) : mezcla("#EEF8FD", "#FFF0D8", calor));
          ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, H);
          // el sol: los rayos giran más rápido mientras más calor hace
          const sx = 26, sy = 28, sr = 9 + calor * 4;
          ctx.fillStyle = `rgba(255,200,90,${0.14 + calor * 0.14})`; ctx.beginPath(); ctx.arc(sx, sy, sr * 1.9, 0, 6.3); ctx.fill();
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(QUIETO ? 0 : t * (0.15 + calor * 0.5)); ctx.fillStyle = `rgba(255,190,70,${0.55 + calor * 0.35})`;
          for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(sr + 2, -2); ctx.lineTo(sr + 8 + calor * 4 + (i % 2) * 3, 0); ctx.lineTo(sr + 2, 2); ctx.fill(); }
          ctx.restore();
          ctx.fillStyle = "#FFC94D"; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.3); ctx.fill();
          // el piso y el aire que tiembla
          ctx.fillStyle = C.oscuro ? "#3A3550" : "#E3C9A2"; ctx.fillRect(0, 188, W, 12);
          if (!QUIETO) for (let i = 0; i < 3 + Math.round(calor * 3); i++) {
            const y0 = 184 - ((t * 14 + i * 13) % 52), a = (1 - (184 - y0) / 52) * 0.4 * calor;
            ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.1; ctx.beginPath();
            for (let x = 0; x <= 140; x += 4) ctx.lineTo(x, y0 + Math.sin(x * 0.14 + t * 4 + i) * 1.8);
            ctx.stroke();
          }
          ctx.restore();
          sombra(ctx, 70, 190, 30, 3); atras(ctx, forma);
          const pts = pintarAgua(ctx, { vaso: forma, x0: 42, x1: 98, y: yDe(nivel.x), fondo: 190, ola, t, colores: cs });
          const ys = yEn(pts, 70);
          if (chorro.on) { ola.tocar(0.5, 0.6 * k, 1); if (Math.random() < 0.4) burb.soltar(70, ys + 8, 1); if (Math.random() < 0.3) gotas.soltar(70, ys, 1, 0.8); }
          ctx.save(); ctx.clip(forma); burb.paso(pts, k); burb.pintar(ctx); ctx.restore();
          chorro.pintar(ctx, ys, t, cs ? cs[1] : C.agua); gotas.paso(pts, k); gotas.pintar(ctx, cs ? cs[1] : C.agua);
          // la transpiración: más gotas con más calor; algunas corren dejando rastro
          ctx.save(); ctx.clip(forma);
          const n = Math.round(sudor.length * calor);
          sudor.forEach((g, i) => {
            if (i >= n) return;
            if (!g.cae && !QUIETO && Math.random() < 0.0015 * calor * k) { g.cae = true; g.vy = 0.15; }
            if (g.cae) { g.vy = Math.min(1.2, g.vy + 0.02 * k); g.y += g.vy * k; g.rastro.push([g.x, g.y]); if (g.rastro.length > 14) g.rastro.shift(); if (g.y > 186) { g.y = 84 + Math.random() * 30; g.cae = false; g.rastro = []; } }
            if (g.rastro.length > 1) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = g.r; ctx.beginPath(); g.rastro.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
            ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 1.25, 0, 0, 6.3); ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fill();
          });
          ctx.restore();
          frente(ctx, forma, 42, 98, 46, 188, e.frac >= 1);
          ctx.fillStyle = C.coral; ctx.fill(redondeado(56, 34, 28, 13, 4)); ctx.fillStyle = mezcla(C.coral, "#000000", 0.2); ctx.fill(redondeado(64, 26, 12, 9, 3));
          // el termómetro
          const tx = 122, top = 52, bot = 150, hm = bot - (bot - top) * calor;
          ctx.fillStyle = C.oscuro ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.88)"; ctx.fill(redondeado(tx - 5, top - 5, 10, bot - top + 8, 5));
          ctx.beginPath(); ctx.arc(tx, bot + 8, 9, 0, 6.3); ctx.fill();
          ctx.fillStyle = C.coral; ctx.fill(redondeado(tx - 2.5, hm, 5, bot - hm + 5, 2.5)); ctx.beginPath(); ctx.arc(tx, bot + 8, 6, 0, 6.3); ctx.fill();
          if (temp != null) { ctx.font = "800 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = C.tinta; ctx.fillText(`${temp}°`, tx, top - 10); }
        },
      };
    },
    /* La esclusa: cada vaso llena la cámara y el barquito sube; en la meta se abre la compuerta y zarpa al lago */
    esclusa() {
      const XA = 24, XB = 108, BAJO = 172, ALTO = 66, FONDO = 192, marco = redondeado(2, 2, 136, 196, 18);
      const ola = new Ola(30), olaLago = new Ola(10), olaCanal = new Ola(6), gotas = new Gotas(), chorro = new Chorro();
      const camara = new Path2D(); camara.rect(XA, 24, XB - XA, FONDO - 24);
      const lago = new Path2D(); lago.rect(XB, 40, 40, 170);
      const canal = new Path2D(); canal.rect(-4, 130, XA + 4, 80);
      const yDe = f => BAJO - (BAJO - ALTO) * limitar(f, 0, 1);
      let espera = 0, abierta = null, bx = null;
      const piedra = (ctx, x, y, w, h) => { ctx.fillStyle = C.oscuro ? "#4E5672" : "#A9B1C0"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 0.7; for (let yy = y + 7; yy < y + h; yy += 7) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); } };
      const compuerta = (ctx, x, y, h) => { ctx.fillStyle = "#9C6B42"; ctx.fillRect(x, y, 7, h); ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 0.7; for (let yy = y + 6; yy < y + h; yy += 6) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 7, yy); ctx.stroke(); } };
      function barco(ctx, x, y, ang, t) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(0.8, 0.8);
        ctx.strokeStyle = "#6B4A2E"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1.5, -32); ctx.quadraticCurveTo(14, -18, 18, -6); ctx.lineTo(1.5, -6); ctx.closePath(); ctx.fillStyle = "#FFFFFF"; ctx.fill();
        ctx.fillStyle = C.agua; ctx.fillRect(1.5, -16, 12.5, 4);
        ctx.beginPath(); ctx.moveTo(-1.5, -30); ctx.quadraticCurveTo(-8, -18, -10, -7); ctx.lineTo(-1.5, -7); ctx.closePath(); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(5, -36 + Math.sin(t * 8) * 1.5, 10, -34); ctx.lineTo(10, -30); ctx.quadraticCurveTo(5, -32 + Math.sin(t * 8 + 1) * 1.5, 0, -30); ctx.closePath(); ctx.fillStyle = C.ambar; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-19, -5); ctx.lineTo(21, -5); ctx.quadraticCurveTo(16, 6, 8, 6); ctx.lineTo(-12, 6); ctx.quadraticCurveTo(-18, 4, -19, -5); ctx.closePath(); ctx.fillStyle = C.coral; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(-18, -5, 39, 2.4);
        ctx.restore();
      }
      return {
        verter(ml) { if (ml > 0) { chorro.abrir(XB - 10, 30, 0.9); espera = 0.25; } else ola.tocar(0.5, 3, 6); },
        tocar(x) { if (x > XA && x < XB) ola.tocar((x - XA) / (XB - XA), azar(-4, 4), 3); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          espera -= dt; chorro.paso(dt); for (let i = 0; i < k; i++) { ola.paso(); olaLago.paso(); olaCanal.paso(); }
          if (espera <= 0) nivel.paso(Math.min(1, e.frac)); else nivel.paso(nivel.x);
          const lleno = e.frac >= 1, arriba = lleno && nivel.x > 0.97;
          if (abierta == null) abierta = arriba ? 1 : 0;
          abierta = limitar(abierta + (arriba ? 1 : -1) * dt / (QUIETO ? 0.01 : 1.2), 0, 1);
          const destino = abierta >= 1 ? 126 : 66; if (bx == null) bx = destino;
          bx += limitar(destino - bx, -0.55 * k, 0.55 * k); if (QUIETO) bx = destino;
          ctx.save(); ctx.clip(marco);
          const cielo = ctx.createLinearGradient(0, 0, 0, 130); cielo.addColorStop(0, C.oscuro ? "#101A3C" : "#BFE3F7"); cielo.addColorStop(1, C.oscuro ? "#22305E" : "#EEF7FC");
          ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = C.oscuro ? "#F3E6C4" : "#FFD27A"; ctx.beginPath(); ctx.arc(116, 20, 7, 0, 6.3); ctx.fill();
          ctx.fillStyle = C.oscuro ? "#1E3A3F" : "#9ED3A6"; ctx.beginPath(); ctx.moveTo(0, 74); ctx.bezierCurveTo(30, 44, 70, 60, 100, 52); ctx.bezierCurveTo(120, 46, 132, 44, 140, 48); ctx.lineTo(140, 130); ctx.lineTo(0, 130); ctx.fill();
          ctx.fillStyle = C.oscuro ? "#173033" : "#7FC28C"; ctx.beginPath(); ctx.moveTo(0, 96); ctx.bezierCurveTo(40, 80, 80, 92, 140, 84); ctx.lineTo(140, 140); ctx.lineTo(0, 140); ctx.fill();
          const ptsL = pintarAgua(ctx, { vaso: lago, x0: XB, x1: 148, y: ALTO, fondo: 200, ola: olaLago, t, colores: cs });
          pintarAgua(ctx, { vaso: canal, x0: -4, x1: XA, y: BAJO, fondo: 200, ola: olaCanal, t, colores: cs });
          const pts = pintarAgua(ctx, { vaso: camara, x0: XA, x1: XB, y: yDe(nivel.x), fondo: FONDO, ola, t, colores: cs });
          const ys = yEn(pts, XB - 10);
          if (chorro.on) { ola.tocar((XB - 10 - XA) / (XB - XA), 0.7 * k, 1); if (Math.random() < 0.35) gotas.soltar(XB - 10, ys, 1, 0.9); }
          chorro.pintar(ctx, ys, t, cs ? cs[1] : C.agua);
          piedra(ctx, XA - 6, 128, 6, 72); piedra(ctx, XA - 6, FONDO, XB - XA + 12, 8);
          compuerta(ctx, XA - 4, 112, FONDO - 112);
          compuerta(ctx, XB - 3, 56 - 60 * abierta, FONDO - 56);
          piedra(ctx, XB + 4, 34, 4, 22); ctx.fillStyle = C.oscuro ? "#3E465E" : "#8E97A8"; ctx.fillRect(XB - 8, 30, 18, 5);
          const sup = x => (x > XB ? yEn(ptsL, x) : yEn(pts, x));
          const by = sup(bx) - 1.2 + (QUIETO ? 0 : Math.sin(t * 2) * 0.5), ang = Math.atan2(sup(bx + 8) - sup(bx - 8), 16) * 0.9 + (QUIETO ? 0 : Math.sin(t * 1.7) * 0.03);
          barco(ctx, bx, by, ang, t);
          gotas.paso(pts, k); gotas.pintar(ctx, cs ? cs[1] : C.agua);
          // la escala: los vasos de tu meta
          const N = Math.max(1, Math.ceil(e.meta / e.vaso)), paso = N > 10 ? 4 : 2;
          ctx.font = "700 7px system-ui, sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = C.oscuro ? "rgba(255,255,255,.75)" : "rgba(20,26,46,.6)";
          for (let v = 0; v <= N; v += paso) { const yy = yDe(v / N); ctx.fillRect(XA - 3, yy - 0.5, 3, 1); if (yy < 126) ctx.fillText(String(v), XA - 5, yy + 2.5); }
          ctx.restore();
          ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.tinta, 0.12); ctx.stroke(marco);
          if (e.frac >= 1) { ctx.lineWidth = 3; ctx.strokeStyle = rgba(C.agua, 0.35); ctx.stroke(marco); }
        },
      };
    },
    /* Tu elefante riega, en chico o sin 3D: la planta crece hoja por hoja y florece en la meta; la trompa riega */
    elefante() {
      const hojas = Array(7).fill(0), caen = []; let riego = 0, flor = 0;
      const piel = () => (C.oscuro ? "#7C8FAD" : "#8FA5C2");
      return {
        verter(ml) { if (ml > 0) riego = 1.7; },
        tocar() { riego = Math.max(riego, 0.5); },
        dibujar(ctx, t, k, dt, e, nivel, cs) {
          nivel.paso(Math.min(1, e.frac)); riego = Math.max(0, riego - dt);
          const nh = Math.min(7, Math.floor(e.frac * 8 + 1e-6)), alto = 34 + 76 * limitar(nivel.x, 0, 1), base = 150, top = base - alto;
          sombra(ctx, 70, 194, 34, 4);
          // la trompa que asoma desde la izquierda
          const sale = QUIETO ? 1 : 0.65 + 0.35 * Math.min(1, riego), tipX = 30 + 16 * sale, tipY = 58;
          ctx.lineCap = "round"; ctx.strokeStyle = piel(); ctx.lineWidth = 15;
          ctx.beginPath(); ctx.moveTo(-10, 18); ctx.bezierCurveTo(tipX - 26, 14, tipX - 2, 30, tipX, tipY - 6); ctx.stroke();
          ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(tipX, tipY - 8); ctx.lineTo(tipX + 1, tipY); ctx.stroke();
          ctx.strokeStyle = "rgba(0,0,0,.14)"; ctx.lineWidth = 1.2; [0.45, 0.6, 0.75].forEach(f => { const x = -10 + (tipX + 10) * f, y = 18 + (tipY - 18) * f * f; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 3, y + 5); ctx.stroke(); });
          if (riego > 0 && !QUIETO && Math.random() < 0.6 * k) caen.push({ x: tipX + 2, y: tipY + 1, vx: azar(0.7, 1.3), vy: azar(-0.2, 0.4) });
          for (let i = caen.length - 1; i >= 0; i--) { const g = caen[i]; g.vy += 0.12 * k; g.x += g.vx * k; g.y += g.vy * k; if (g.y > base - 2 || g.x > 110) { caen.splice(i, 1); continue; } gota(ctx, g.x, g.y, 2, cs ? cs[1] : C.agua); }
          // la maceta
          ctx.fillStyle = "#C46B3E"; ctx.beginPath(); ctx.moveTo(48, 150); ctx.lineTo(92, 150); ctx.lineTo(86, 192); ctx.lineTo(54, 192); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#B25A30"; ctx.fill(redondeado(44, 144, 52, 10, 3));
          ctx.fillStyle = "#4A3426"; ctx.fillRect(48, 148, 44, 3);
          // el tallo, las hojas y la flor
          const mece = QUIETO ? 0 : Math.sin(t * 1.3) * 2;
          ctx.strokeStyle = "#3E9E5D"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(70, base); ctx.quadraticCurveTo(70 + mece, (base + top) / 2, 70 + mece * 1.5, top); ctx.stroke();
          for (let i = 0; i < 7; i++) {
            hojas[i] += ((i < nh ? 1 : 0) - hojas[i]) * Math.min(1, 0.08 * k); if (QUIETO) hojas[i] = i < nh ? 1 : 0;
            const s = hojas[i]; if (s < 0.02) continue;
            const y = base - 12 - (alto - 16) * (i + 1) / 8, lado = i % 2 ? 1 : -1, x = 70 + mece * (1 - (y - top) / alto) * 1.5;
            ctx.save(); ctx.translate(x, y); ctx.rotate(lado * (0.55 + Math.sin(t * 1.5 + i) * 0.05)); ctx.scale(s, s);
            ctx.beginPath(); ctx.ellipse(lado * 11, 0, 11, 4.6, 0, 0, 6.3); ctx.fillStyle = i % 2 ? "#3E9E5D" : "#56B874"; ctx.fill(); ctx.restore();
          }
          flor += ((e.frac >= 1 ? 1 : 0) - flor) * Math.min(1, 0.06 * k); if (QUIETO) flor = e.frac >= 1 ? 1 : 0;
          if (flor > 0.02) {
            ctx.save(); ctx.translate(70 + mece * 1.5, top); ctx.scale(flor, flor); ctx.rotate(QUIETO ? 0 : t * 0.3);
            for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -7, 4, 7, 0, 0, 6.3); ctx.fillStyle = "#F28CB0"; ctx.fill(); }
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.3); ctx.fillStyle = C.ambar; ctx.fill(); ctx.restore();
          }
        },
      };
    },
    /* El acuario del mes (280 × 190): un pez por cada día cumplido, uno dorado por cada 7 seguidos y algas que crecen */
    acuario(cv, modo) {
      const X0 = 10, X1 = 270, Y0 = 18, FONDO = 176, tanque = redondeado(X0, Y0, X1 - X0, FONDO - Y0, 12);
      const ola = new Ola(60), burb = new Burbujas(), gotas = new Gotas(), niv = new Nivel(0.5);
      const COLORES = [["#FF9A4D", "#E8602C"], ["#FFC94D", "#F09A1A"], ["#FF7A8A", "#D9455C"], ["#9C8CFF", "#6A55D9"], ["#5ED9B8", "#22A585"], ["#FF8FB0", "#E0507A"]];
      const algasX = [36, 66, 104, 172, 250];
      const leer = () => {
        if (modo === "muestra" || !cv.dataset.mes) return { peces: 18, dorados: 1, dias: 31 };
        const [y, m] = cv.dataset.mes.split("-").map(Number), A = aguaMesAcuario(y, m - 1);
        return { peces: A.peces, dorados: A.dorados, dias: A.dias.length };
      };
      const nuevoPez = (i, cae) => ({ x: azar(36, 244), y: cae ? -10 : azar(70, 150), dir: Math.random() < 0.5 ? -1 : 1, cara: 1, v: azar(0.25, 0.55), f: Math.random() * 6, s: azar(0.85, 1.15), c: COLORES[i % COLORES.length], cae: !!cae, vy: 0, i });
      let A = leer(), peces = Array.from({ length: A.peces }, (_, i) => nuevoPez(i));
      peces.forEach(p => { p.cara = p.dir; });
      niv.x = 0.22 + 0.78 * Math.min(1, A.peces / A.dias);
      function pez(ctx, p, t, dorado) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.cara * p.s * (dorado ? 1.25 : 1), p.s * (dorado ? 1.25 : 1));
        const [c1, c2] = dorado ? ["#FFE27A", "#E6A51E"] : p.c, cola = QUIETO ? 0 : Math.sin(t * 9 + p.f) * 0.35;
        ctx.save(); ctx.translate(-8, 0); ctx.rotate(cola); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-5, -6, -8, -7); ctx.quadraticCurveTo(-6, 0, -8, 7); ctx.quadraticCurveTo(-5, 6, 0, 0); ctx.fillStyle = c2; ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.moveTo(-2, -4.5); ctx.quadraticCurveTo(1, -9, 5, -4); ctx.fillStyle = c2; ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 5.2, 0, 0, 6.3); ctx.fillStyle = c1; ctx.fill();
        if (!dorado && p.i % 3 === 0) { ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fillRect(-2, -5, 2.2, 10); }
        ctx.beginPath(); ctx.arc(5.2, -1.2, 1.9, 0, 6.3); ctx.fillStyle = "#fff"; ctx.fill(); ctx.beginPath(); ctx.arc(5.7, -1.2, 1, 0, 6.3); ctx.fillStyle = "#14182A"; ctx.fill();
        ctx.restore();
      }
      return {
        tam: [280, 190],
        verter() { const antes = A.peces; A = leer(); for (let i = antes; i < A.peces; i++) { const p = nuevoPez(i, true); p.x = 140; peces.push(p); } if (A.peces < peces.length) peces.length = A.peces; },
        tocar(x, y) { ola.tocar((x - X0) / (X1 - X0), -4, 3); peces.forEach(p => { if (Math.hypot(p.x - x, p.y - (y || 100)) < 60) { p.dir = p.x < x ? -1 : 1; p.v = 1.4; } }); },
        dibujar(ctx, t, k, dt) {
          for (let i = 0; i < k; i++) ola.paso();
          niv.paso(0.22 + 0.78 * Math.min(1, A.peces / A.dias));
          if (!QUIETO && Math.random() < 0.1 * k) burb.soltar(222, 168, 1, [0.8, 2.2]);
          const y = FONDO - (FONDO - Y0 - 8) * niv.x;
          atras(ctx, tanque);
          const pts = pintarAgua(ctx, { vaso: tanque, x0: X0, x1: X1, y, fondo: FONDO, ola, t });
          ctx.save(); ctx.clip(tanque);
          const arena = new Path2D(); arena.moveTo(X0, FONDO); arena.lineTo(X0, 166); arena.bezierCurveTo(60, 156, 110, 170, 150, 163); arena.bezierCurveTo(190, 156, 230, 166, X1, 160); arena.lineTo(X1, FONDO); arena.closePath();
          ctx.fillStyle = C.oscuro ? "#A88D5E" : "#EAD5A6"; ctx.fill(arena);
          for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.ellipse(16 + (i * 37) % 250, 168 + (i * 7) % 8, 1.6 + (i % 3), 1.1 + (i % 2), 0, 0, 6.3); ctx.fillStyle = ["#C9B08A", "#A68D6E", "#E6D2AE", "#8E7B66"][i % 4]; ctx.fill(); }
          ctx.beginPath(); ctx.moveTo(184, 168); ctx.bezierCurveTo(184, 148, 198, 142, 210, 146); ctx.bezierCurveTo(224, 150, 230, 160, 228, 168); ctx.closePath(); ctx.fillStyle = C.oscuro ? "#5C6478" : "#9AA3B6"; ctx.fill();
          ctx.fillStyle = "#3A4155"; ctx.fill(redondeado(216, 166, 12, 5, 2));
          const nAlgas = Math.min(5, 1 + Math.floor(A.peces / 6));
          for (let a = 0; a < nAlgas; a++) {
            const bx = algasX[a], alto = 46 + (a * 17) % 30; let px = bx, py = 170;
            for (let s = 0; s < 7; s++) {
              const nx = bx + (QUIETO ? 0 : Math.sin(t * 1.3 + a + s * 0.6)) * (s * 1.4), ny = 170 - alto * (s + 1) / 7;
              ctx.lineCap = "round"; ctx.lineWidth = 5 - s * 0.5; ctx.strokeStyle = s % 2 ? "#3E9E5D" : "#4CB46C"; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
              if (s % 2) { ctx.beginPath(); ctx.ellipse(nx + (s % 4 ? 5 : -5), ny + 2, 5, 2.2, s % 4 ? 0.5 : -0.5, 0, 6.3); ctx.fillStyle = "#56C27A"; ctx.fill(); }
              px = nx; py = ny;
            }
          }
          peces.forEach((p, i) => {
            const s = yEn(pts, p.x);
            if (p.cae) { p.vy += 0.25 * k; p.y += p.vy * k; if (p.y > s) { if (p.vy > 1) { ola.tocar((p.x - X0) / (X1 - X0), 6, 2); gotas.soltar(p.x, s, 10, 1.3); burb.soltar(p.x, s + 12, 6); } p.vy *= 0.85; if (p.y > s + 22) p.cae = false; } }
            else if (!QUIETO) {
              p.f += 0.05 * k; p.x += p.dir * p.v * k; p.v += (0.4 - p.v) * 0.02 * k; p.y += Math.sin(p.f) * 0.18 * k;
              if (p.x < 26) p.dir = 1; if (p.x > 254) p.dir = -1; if (Math.random() < 0.002 * k) p.dir *= -1;
              p.y = limitar(p.y, s + 12, 156);
            }
            p.cara += (p.dir - p.cara) * 0.14 * k;
            pez(ctx, p, t, i < A.dorados);
          });
          burb.paso(pts, k); burb.pintar(ctx);
          ctx.restore();
          gotas.paso(pts, k); gotas.pintar(ctx, C.agua);
          frente(ctx, tanque, X0, X1, Y0, FONDO);
          ctx.fillStyle = rgba(C.tinta, 0.8); ctx.fill(redondeado(X0 - 2, Y0 - 5, X1 - X0 + 4, 7, 3));
        },
      };
    },
  };

  /* -------- Tu elefante riega, en 3D: el mismo elefante de Tu casa (elefante-3d.js) junto a su planta --------
     Se monta encima del dibujo en chico cuando three.js ya bajó; sin WebGL queda la planta en 2D. */
  let hayWebGL = null;
  const webgl = () => { if (hayWebGL == null) { try { const c = document.createElement("canvas"); hayWebGL = !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { hayWebGL = false; } } return hayWebGL; };
  function montar3D(cv, modo) {
    if (typeof cieloScripts !== "function" || !webgl()) return;
    cieloScripts().then(() => {
      if (!cv.isConnected || typeof crearElefante3D !== "function" || !window.THREE) return;
      const cv3 = document.createElement("canvas");
      cv3.className = cv.className; cv3.style.cssText = cv.style.cssText;
      Object.assign(cv3.dataset, { agua: "elefante", modo, listo: "1", tres: "1" });
      ["role", "aria-label"].forEach(a => { if (cv.hasAttribute(a)) cv3.setAttribute(a, cv.getAttribute(a)); });
      let obj; try { obj = elefante3D(cv3, modo); } catch (e) { return; }
      cv.replaceWith(cv3); obj.medir(); vivas.add(obj); obj.despertar();
    }).catch(() => {});
  }
  function elefante3D(cv, modo) {
    const T = window.THREE, r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(DPR); r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    const escena = new T.Scene(), raiz = new T.Group(); escena.add(raiz);
    const cam = new T.PerspectiveCamera(30, 140 / 200, 0.1, 60);
    const hemi = new T.HemisphereLight(0xF2F4FF, 0x6A5A4E, 0.75); escena.add(hemi);
    const sol = new T.DirectionalLight(0xFFE9CF, 1.75); sol.position.set(2.6, 5.5, 4.2); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 }); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.03; escena.add(sol);
    const relleno = new T.DirectionalLight(0xBFD4FF, 0.45); relleno.position.set(-4, 3, -1); escena.add(relleno);
    const lampara = new T.PointLight(0xFFC98A, 0, 6, 1.6); lampara.position.set(-1.2, 2.2, 1.2); escena.add(lampara);
    const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0 }, o || {}));
    const piso = new T.Mesh(new T.CircleGeometry(2.2, 64), mat(0xD9B98F, { roughness: 0.7 })); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; raiz.add(piso);
    const alfombra = new T.Mesh(new T.CircleGeometry(1.05, 56), mat(0x9FD3F0, { roughness: 0.95 })); alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(-0.2, 0.006, 0.25); alfombra.receiveShadow = true; raiz.add(alfombra);
    const muro = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 2.6, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76), mat(0xE4EAF2, { side: T.BackSide, roughness: 0.95 })); muro.position.y = 1.3; muro.receiveShadow = true; raiz.add(muro);
    // el elefante, con su tipo, etapa y ropa
    const datos = typeof tipoElefante === "function" ? { tipo: tipoElefante(), etapa: etapaElefante(STATE.gamif.xp || 0).idx, ropa: ropaPuesta(), animo: "feliz" } : { tipo: "clasico", etapa: 2, animo: "feliz" };
    const ele = crearElefante3D(T, Object.assign({ calmo: QUIETO }, datos));
    ele.g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ele.g.position.set(-0.85, 0, 0.15); ele.g.rotation.y = -0.42; raiz.add(ele.g);
    // dónde caen las gotas cuando riega: ahí va la planta (la punta de la trompa es lo más adelantado en la pose de regar)
    ele.postura({ regar: 1, alza: 0.12 }, true); ele.vivo(0.55); ele.g.updateMatrixWorld(true);
    const adelante = new T.Vector3(1, 0, 0).applyQuaternion(ele.g.quaternion);
    let punta = null, mejor = -1e9;
    ele.g.traverse(o => { if (o.isMesh) { const p = o.getWorldPosition(new T.Vector3()), d = p.dot(adelante); if (d > mejor) { mejor = d; punta = p; } } });
    const caida = punta ? punta.clone().add(adelante.clone().multiplyScalar(0.95)) : null;
    ele.postura({}, true);
    const enPlanta = caida ? new T.Vector3(caida.x, 0, caida.z) : new T.Vector3(0.45, 0, 0.6);
    const planta = new T.Group(); planta.position.copy(enPlanta); planta.scale.setScalar(1.55); raiz.add(planta);
    const maceta = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.26, 28), mat(0xC46B3E, { roughness: 0.7 })); maceta.position.y = 0.13; maceta.castShadow = true; planta.add(maceta);
    const labio = new T.Mesh(new T.CylinderGeometry(0.19, 0.19, 0.05, 28), mat(0xB25A30, { roughness: 0.7 })); labio.position.y = 0.26; planta.add(labio);
    const tierra = new T.Mesh(new T.CylinderGeometry(0.165, 0.165, 0.02, 28), mat(0x4A3426, { roughness: 1 })); tierra.position.y = 0.275; planta.add(tierra);
    const verde = mat(0x3E9E5D, { roughness: 0.55 }), verde2 = mat(0x56B874, { roughness: 0.55 });
    const tallo = new T.Mesh(new T.CylinderGeometry(0.016, 0.022, 1, 10), verde); tallo.castShadow = true; planta.add(tallo);
    const hojaG = new T.SphereGeometry(1, 16, 10), hojas = [];
    for (let k = 0; k < 7; k++) {
      const piv = new T.Group(), h = new T.Mesh(hojaG, k % 2 ? verde : verde2); h.scale.set(0.15, 0.022, 0.065); h.position.x = 0.14; h.castShadow = true; piv.add(h);
      piv.rotation.y = k * 2.1; piv.rotation.z = 0.45; piv.scale.setScalar(0.001); planta.add(piv); hojas.push({ piv, alto: 0.33 + k * 0.075, s: 0 });
    }
    const flor = new T.Group(); planta.add(flor); flor.scale.setScalar(0.001);
    const petalo = mat(0xF28CB0, { roughness: 0.5 });
    for (let k = 0; k < 6; k++) { const p = new T.Mesh(hojaG, petalo); p.scale.set(0.07, 0.02, 0.04); p.position.set(Math.cos(k * 1.047) * 0.06, 0, Math.sin(k * 1.047) * 0.06); p.rotation.y = -k * 1.047; flor.add(p); }
    const centro = new T.Mesh(hojaG, mat(0xF4AE3D, { roughness: 0.4 })); centro.scale.set(0.035, 0.025, 0.035); flor.add(centro);
    const desde = punta ? punta.clone().add(adelante.clone().multiplyScalar(0.06)) : new T.Vector3(-0.1, 0.75, 0.4), hasta = new T.Vector3(enPlanta.x - 0.05, 0.85, enPlanta.z);
    const gotaM = new T.MeshStandardMaterial({ color: 0x3AA8F0, roughness: 0.1, metalness: 0, emissive: 0x1A70B8, emissiveIntensity: 0.6, transparent: true, opacity: 0 });
    const gotaG = new T.SphereGeometry(0.036, 10, 8);
    const lluvia = Array.from({ length: 40 }, (_, i) => { const m = new T.Mesh(gotaG, gotaM); m.userData = { f: i / 40, j: new T.Vector3(azar(-0.05, 0.05), azar(-0.03, 0.03), azar(-0.05, 0.05)) }; m.scale.setScalar(azar(0.6, 1.3)); m.visible = false; raiz.add(m); return m; });
    let regando = 0, regar = false, florS = 0, ocupado = false;
    // el encuadre: el elefante y la planta
    const caja = new T.Box3(); ele.g.updateMatrixWorld(true); ele.g.traverse(o => { if (o.isMesh) caja.expandByObject(o); });
    caja.expandByPoint(new T.Vector3(enPlanta.x + 0.35, 1.5, enPlanta.z + 0.35)).expandByPoint(new T.Vector3(enPlanta.x - 0.35, 0, enPlanta.z - 0.35));
    const mira = caja.getCenter(new T.Vector3()), tam = caja.getSize(new T.Vector3());
    let giro = 0, giroMeta = 0, arrastre = null;
    if (modo !== "portilla") {
      cv.addEventListener("pointerdown", e => { arrastre = { x: e.clientX, g: giroMeta }; });
      cv.addEventListener("pointermove", e => { if (arrastre) { giroMeta = limitar(arrastre.g + (e.clientX - arrastre.x) * 0.008, -0.7, 0.7); obj.despertar(); } });
      const soltar = () => { arrastre = null; }; cv.addEventListener("pointerup", soltar); cv.addEventListener("pointercancel", soltar);
      cv.style.touchAction = "pan-y";
    }
    const medir = () => { const w = cv.clientWidth || 140, h = Math.round(w * 200 / 140); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    let oscuro = null;
    const tema = () => {
      if (oscuro === C.oscuro) return; oscuro = C.oscuro;
      muro.material.color.set(oscuro ? 0x2A3358 : 0xE4EAF2); piso.material.color.set(oscuro ? 0x8A6F52 : 0xD9B98F);
      hemi.intensity = oscuro ? 0.45 : 0.75; sol.intensity = oscuro ? 0.7 : 1.75; lampara.intensity = oscuro ? 1.4 : 0; r.toneMappingExposure = oscuro ? 1.15 : 1.05;
    };
    const t0 = performance.now(); let activo = 3, vivo = false, visible = false, ant = 0, cuadro = 0;
    const pausa = () => modo === "portilla" && !AGUA_FAB.abierta;
    const pintar = t => {
      if (typeof STATE === "undefined" || !STATE) return;
      tema(); const e = aguaEstado(), nh = Math.min(7, Math.floor(e.frac * 8 + 1e-6));
      giro += (giroMeta - giro) * 0.12; raiz.rotation.y = giro;
      const d = Math.max(tam.x / cam.aspect, tam.y) / (2 * Math.tan(cam.fov * Math.PI / 360)) * 0.94 + tam.z / 2;   // de cerca: el cuadro es angosto
      cam.position.set(mira.x + d * 0.1, mira.y + d * 0.3, mira.z + d); cam.lookAt(mira.x, mira.y - 0.05, mira.z);
      ele.vivo(QUIETO ? 0 : t);
      hojas.forEach((h, k) => { h.s = QUIETO ? (k < nh ? 1 : 0) : h.s + ((k < nh ? 1 : 0) - h.s) * 0.08; h.piv.scale.setScalar(Math.max(0.001, h.s)); h.piv.position.y = h.alto; h.piv.rotation.z = 0.45 + (QUIETO ? 0 : Math.sin(t * 1.5 + k) * 0.04); });
      const alto = 0.32 + 0.56 * Math.min(1, e.frac); tallo.scale.y = QUIETO ? alto : tallo.scale.y + (alto - tallo.scale.y) * 0.08; tallo.position.y = 0.28 + tallo.scale.y / 2;
      regando += ((regar ? 1 : 0) - regando) * 0.12; gotaM.opacity = 0.92 * regando;
      lluvia.forEach(m => { const u = m.userData, f = (u.f + t * 0.85) % 1; m.visible = regando > 0.04;
        m.position.set(desde.x + (hasta.x - desde.x) * f + u.j.x, desde.y + (hasta.y - desde.y) * f + Math.sin(f * Math.PI) * 0.18 + u.j.y, desde.z + (hasta.z - desde.z) * f + u.j.z); });
      florS = QUIETO ? (e.frac >= 1 ? 1 : 0) : florS + ((e.frac >= 1 ? 1 : 0) - florS) * 0.07; flor.scale.setScalar(Math.max(0.001, florS)); flor.position.y = 0.28 + tallo.scale.y + 0.02; flor.rotation.y = t * 0.4;
      r.render(escena, cam);
    };
    const marco = ahora => {
      if (!cv.isConnected) { vivo = false; vivas.delete(obj); try { if (ele.dispose) ele.dispose(); r.dispose(); r.forceContextLoss(); } catch (e) {} return; }
      const dt = Math.min(0.05, (ahora - ant) / 1000); ant = ahora; activo -= dt; cuadro++;
      if (typeof STATE === "undefined" || !STATE) { vivo = false; return; }
      if (activo > 0 || regando > 0.02 || cuadro % 3 === 0) pintar((ahora - t0) / 1000);
      if (visible && !document.hidden && !QUIETO && !pausa()) requestAnimationFrame(marco); else vivo = false;
    };
    const obj = {
      cv, medir,
      despertar() { activo = 3; if (!vivo && visible && !pausa()) { vivo = true; ant = performance.now(); requestAnimationFrame(marco); } else if (QUIETO) pintar(0); },
      escena: {
        verter(ml) {
          if (!(ml > 0) || ocupado) { obj.despertar(); return; }
          ocupado = true; ele.postura({ regar: 1, alza: 0.12 }); setTimeout(() => { regar = true; obj.despertar(); }, QUIETO ? 0 : 450);
          setTimeout(() => { regar = false; ele.postura({}); ocupado = false; if (aguaEstado().frac >= 1) ele.reaccion("corazones"); obj.despertar(); }, QUIETO ? 0 : 2700);
        },
        tocar() { if (!ocupado) ele.reaccion("saluda"); },
      },
    };
    cv._aguaDespertar = () => obj.despertar();
    new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) obj.despertar(); }, { rootMargin: "80px" }).observe(cv);
    if (window.ResizeObserver) new ResizeObserver(() => { medir(); pintar((performance.now() - t0) / 1000); }).observe(cv);
    // a media tarde, si vas bajo la mitad, te saluda para recordarte
    const hora = new Date().getHours(); if (modo !== "portilla" && hora >= 15 && aguaEstado().frac < 0.5) setTimeout(() => ele.reaccion("saluda"), 900);
    return obj;
  }

  /* -------- Montar un lienzo: su escena, su tamaño, su animación (solo mientras se ve) -------- */
  const vivas = new Set(), ultimo = {};
  function montar(cv) {
    if (cv.dataset.listo) return; cv.dataset.listo = "1";
    if (!C.tinta) colores();
    const estilo = ESCENAS[cv.dataset.agua] ? cv.dataset.agua : "botella", modo = cv.dataset.modo || "tarjeta";
    const escena = ESCENAS[estilo](cv, modo), ctx = cv.getContext("2d"), clave = modo + estilo;
    const SW = (escena.tam || [W, H])[0], SH = (escena.tam || [W, H])[1];
    const muestra = modo === "muestra", fracFija = +cv.dataset.frac || 0.62;
    const estado = () => { if (!muestra) return Object.assign(aguaEstado(), { temp: aguaTempDe() }); const meta = 2000; return { ml: meta * fracFija, meta, vaso: 250, frac: fracFija, ultimo: Date.now() - 30 * 60000, n: 1, temp: 31 }; };
    const e0 = estado(), niv = new Nivel(ultimo[clave] != null ? ultimo[clave] : estilo === "bombilla" ? Math.max(0, 1 - e0.frac) : estilo === "cantimplora" ? 1 : estilo === "reloj" ? aguaRelojQueda(e0) : Math.min(1, e0.frac));
    let k = 1, activo = 2.5, vivo = false, id = 0, ant = 0, cuadro = 0;
    const medir = () => { const w = cv.clientWidth || SW; k = w / SW; const pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(w * SH / SW * DPR)); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } };
    medir();
    // la portilla cerrada no se dibuja; el botón en chico se mueve solo después de un vaso (quieto no gasta batería)
    const enPausa = () => modo === "portilla" && !AGUA_FAB.abierta;
    const obj = { cv, escena, despertar() { activo = 3; if (!vivo && visible && !enPausa()) arrancar(); } };
    const pintar = (t, dt) => {
      if (!muestra && (typeof STATE === "undefined" || !STATE)) return;   // sin sesión (al salir de la cuenta) no hay agua que dibujar
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
      if (enPausa() || (!muestra && (typeof STATE === "undefined" || !STATE))) { vivo = false; return; }   // cerrada, o sin sesión
      // tranquila, el agua se mueve a 20 cuadros por segundo; después de un vaso, a 60
      if (activo > 0 || cuadro % 3 === 0) pintar((ahora - t0) / 1000, activo > 0 ? dt : dt * 3);
      if (vivo && visible && !document.hidden && !QUIETO && !(modo === "boton" && activo <= 0)) id = requestAnimationFrame(marco); else vivo = false;
    };
    const arrancar = () => { vivo = true; ant = performance.now(); id = requestAnimationFrame(marco); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !vivo) arrancar(); }, { rootMargin: "80px" }).observe(cv);
    if (window.ResizeObserver) new ResizeObserver(() => { medir(); pintar((performance.now() - t0) / 1000, 1 / 60); }).observe(cv);
    pintar(0, 1 / 60);
    if (!muestra) {
      vivas.add(obj);
      cv._aguaDespertar = () => obj.despertar();
      if (modo === "boton") return obj;
      let tSorbo = 0;
      cv.addEventListener("pointerdown", ev => {
        const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * SW, y = (ev.clientY - r.top) / r.height * SH;
        escena.tocar && escena.tocar(x, y); obj.despertar();
        if (estilo === "bombilla" && escena.sorbo) {
          // en la portilla un toque es un vaso y mantener es tomar a sorbos; en la tarjeta, apretar ya es sorber
          if (modo === "portilla") { clearTimeout(tSorbo); tSorbo = setTimeout(() => empezarSorbo(obj), 230); }
          else { ev.preventDefault(); empezarSorbo(obj, ev); }
        }
      });
      if (modo === "portilla") ["pointerup", "pointercancel", "pointerleave"].forEach(t => cv.addEventListener(t, () => clearTimeout(tSorbo)));
      if (estilo === "bombilla") { cv.style.touchAction = "none"; cv.addEventListener("contextmenu", ev => ev.preventDefault()); }
      if (estilo === "elefante" && modo !== "mes") montar3D(cv, modo);
    }
    return obj;
  }
  /* La bombilla: mientras mantienes apretado, tomas ~100 ml por segundo; al soltar, se registra */
  function empezarSorbo(obj, ev) {
    const esc = obj.escena; let ml = 0, ant = performance.now(), on = true;
    esc.sorbiendo = true; esc.sorbo(0); vibrar(12);
    const tic = () => { if (!on) return; const ahora = performance.now(); ml += (ahora - ant) / 1000 * 100; ant = ahora; esc.sorbo(ml); obj.despertar(); if (Math.random() < 0.15) vibrar(4); if (ml < 1500) requestAnimationFrame(tic); else fin(); };
    const fin = () => { if (!on) return; on = false; esc.sorbiendo = false; esc.sorbo(0); AGUA_FAB.sorbio = performance.now(); window.removeEventListener("pointerup", fin); window.removeEventListener("pointercancel", fin); const r = Math.round(ml / 10) * 10; if (r >= 10) { aguaSumar(r); toast(`💧 Tomaste ${r} ml`); } };
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
