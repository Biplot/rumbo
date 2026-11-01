/* ============================================================
   RUMBO · 🐷 Tus alcancías (Finanzas)
   Cada cosa por la que ahorras tiene su alcancía: un nombre, una meta, una fecha si quieres y su estilo.
   «+» guarda un monto (se puede deshacer y cada aporte queda con su fecha); las monedas caen y se
   apilan (alcancia-motor.js). Llenarla da +50 ⭐ una vez (alc:<id>) y la medalla «Primera alcancía»;
   guardar algo cada semana durante 4 semanas seguidas, +20 ⭐ (alc-racha:<lunes>); en el viaje,
   cada parada (25, 50 y 75 %) da +10 ⭐ (alc-parada:<id>:<p>). Si deshaces y quedas bajo la meta, se devuelven.
   Al llegar a la meta, la alcancía se cierra (los chanchitos se rompen) y queda en «Cumplidas».
   Al cerrar el mes, lo que ahorraste (ingreso menos gasto) se reparte entre tus alcancías.
   Arriba en Finanzas va la torre del año: tus meses en pilas de monedas.
   El chanchito de greda viene con Rumbo; los demás estilos y los colores de las monedas, en la Tienda.
   Datos: STATE.alcancias (ver state.js); entre equipos se fusiona con alcMerge (store.js).
   ============================================================ */
const ALC_PREMIO = 50, ALC_RACHA = 20, ALC_PARADA = 10, ALC_RACHA_SEMANAS = 4;
const ALC_ESTILOS = [
  { id: "greda", nombre: "El chanchito de greda", cos: null, rompe: true, desc: "de Pomaire: cada moneda lo hace bambolear; en la meta se rompe con un mazo" },
  { id: "ele-suerte", nombre: "El elefante de la suerte", cos: "alc-ele-suerte", desc: "porcelana que se baña en oro desde las patas" },
  { id: "ele-greda", nombre: "El elefante de greda", cos: "alc-ele-greda", desc: "hermano del chanchito; en la meta levanta la trompa" },
  { id: "vidrio", nombre: "El chanchito de vidrio", cos: "alc-vidrio", rompe: true, desc: "se ven todas las monedas; en la meta se rompe" },
  { id: "frasco", nombre: "El frasco", cos: "alc-frasco", desc: "con su etiqueta escrita a mano" },
  { id: "caja", nombre: "La caja fuerte", cos: "alc-caja", desc: "para metas grandes: el monto se ve al abrirla" },
  { id: "viaje", nombre: "El viaje", cos: "alc-viaje", desc: "un bus que avanza hasta tu destino, con paradas" },
];
const ALC_MONEDAS = [
  { id: "oro", nombre: "Oro", cos: null },
  { id: "plata", nombre: "Plata", cos: "mon-plata" },
  { id: "cobre", nombre: "Cobre", cos: "mon-cobre" },
  { id: "estrella", nombre: "Estrella", cos: "mon-estrella" },
];

/* -------- Los datos -------- */
function alcDatos(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { lista: [], borradas: [], ocultar: false, ts: 0 };
  const a = S.alcancias;
  if (!a || typeof a !== "object" || !Array.isArray(a.lista)) S.alcancias = { lista: [], borradas: [], ocultar: false, ts: 0 };
  if (!Array.isArray(S.alcancias.borradas)) S.alcancias.borradas = [];
  return S.alcancias;
}
function alcPorId(id, S) { return alcDatos(S).lista.find(x => x && x.id === id) || null; }
/* Los aportes que siguen (sin los deshechos), del más viejo al más nuevo */
function alcAportes(a) { if (!a || !Array.isArray(a.aportes)) return []; const b = new Set(a.b || []); return a.aportes.filter(x => x && !b.has(x.id)).sort((x, y) => (x.ts || 0) - (y.ts || 0)); }
function alcGuardado(a) { return alcAportes(a).reduce((s, x) => s + (+x.monto || 0), 0); }
function alcFrac(a) { return a && a.meta > 0 ? alcGuardado(a) / a.meta : 0; }
function alcLlena(a) { return !!a && a.meta > 0 && alcGuardado(a) >= a.meta; }
function alcActivas(S) { const fuera = new Set(alcDatos(S).borradas); return alcDatos(S).lista.filter(a => a && !fuera.has(a.id) && !a.cerrada); }
function alcCerradas(S) { const fuera = new Set(alcDatos(S).borradas); return alcDatos(S).lista.filter(a => a && !fuera.has(a.id) && a.cerrada).sort((x, y) => y.cerrada - x.cerrada); }
/* Las que llegaron a su meta (abiertas o ya cerradas): la medalla «Primera alcancía» */
function alcCumplidas(S) { const fuera = new Set(alcDatos(S).borradas); return alcDatos(S).lista.filter(a => a && !fuera.has(a.id) && (a.cerrada || alcLlena(a))).length; }
function alcEstiloDe(id) { return ALC_ESTILOS.find(x => x.id === id) || ALC_ESTILOS[0]; }
function alcEstiloTuyo(id) { const e = ALC_ESTILOS.find(x => x.id === id); return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos))); }
function alcEstiloVer(a) { return a && alcEstiloTuyo(a.estilo) ? a.estilo : "greda"; }
function alcMonedaTuya(id) { const m = ALC_MONEDAS.find(x => x.id === id); return !!m && (!m.cos || (typeof isOwned === "function" && isOwned(m.cos))); }
function alcMoneda() { const eq = (typeof STATE !== "undefined" && STATE && STATE.gamif && STATE.gamif.equipped) || {}; return alcMonedaTuya(eq.moneda) ? eq.moneda : "oro"; }
function alcNuevoId(p) { return (p || "al") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function alcOculto(S) { return !!alcDatos(S).ocultar; }

/* Montos rápidos: salen de tu meta mensual (un cuarto, la mitad y la meta); sin meta, 5, 10 y 20 mil */
function alcRapidos(S) {
  S = S || STATE; const m = (S && S.finanzas && +S.finanzas.metaMensual) || 0;
  const r = v => Math.max(1000, Math.round(v / 1000) * 1000);
  const xs = m >= 4000 ? [r(m / 4), r(m / 2), r(m)] : [5000, 10000, 20000];
  return xs.filter((v, i) => xs.indexOf(v) === i);
}
/* Con fecha: cuánto al mes para llegar (desde este mes hasta el de la fecha, contándolo) */
function alcPorMes(a, hoy) {
  if (!a || !a.fecha || !(a.meta > 0)) return null;
  hoy = hoy || todayISO();
  const falta = Math.max(0, a.meta - alcGuardado(a)); if (!falta) return 0;
  const [y1, m1] = hoy.split("-").map(Number), [y2, m2] = a.fecha.split("-").map(Number);
  const meses = (y2 - y1) * 12 + (m2 - m1) + 1;
  return meses >= 1 ? Math.ceil(falta / meses / 100) * 100 : null;
}
function alcFechaTxt(f) { if (!f) return ""; const [y, m, d] = f.split("-").map(Number); return `${d} ${MESES[m - 1].slice(0, 3).toLowerCase()}${y !== new Date().getFullYear() ? " " + y : ""}`; }

/* -------- Crear, editar, guardar y deshacer -------- */
function alcCrear(o, S) {
  const D = alcDatos(S), ahora = Date.now();
  const a = { id: alcNuevoId("al"), nombre: String(o.nombre || "Mi alcancía").trim().slice(0, 40), meta: Math.max(0, Math.round(+o.meta || 0)), fecha: o.fecha || "",
    estilo: alcEstiloTuyo(o.estilo) ? o.estilo : "greda", destino: String(o.destino || "").trim().slice(0, 22), creada: ahora, cerrada: 0, ts: ahora, aportes: [], b: [] };
  D.lista.push(a); return a;
}
function alcEditar(id, cambios, S) {
  const a = alcPorId(id, S); if (!a) return null;
  if (cambios.nombre != null) a.nombre = String(cambios.nombre).trim().slice(0, 40) || a.nombre;
  if (cambios.meta != null) a.meta = Math.max(0, Math.round(+cambios.meta || 0));
  if (cambios.fecha != null) a.fecha = cambios.fecha;
  if (cambios.estilo != null && alcEstiloTuyo(cambios.estilo)) a.estilo = cambios.estilo;
  if (cambios.destino != null) a.destino = String(cambios.destino).trim().slice(0, 22);
  a.ts = Date.now(); return a;
}
function alcAportar(id, monto, origen, S, fecha) {
  const a = alcPorId(id, S); monto = Math.round(+monto);
  if (!a || a.cerrada || !(monto > 0)) return null;
  const x = { id: alcNuevoId("ap"), monto, ts: Date.now(), fecha: fecha || todayISO() };
  if (origen) x.o = origen;
  a.aportes.push(x); return x;
}
function alcDeshacerAporte(id, aporteId, S) {
  const a = alcPorId(id, S); if (!a || a.cerrada) return null;
  const xs = alcAportes(a).filter(y => !String(y.o || "").startsWith("compra:")), x = aporteId ? xs.find(y => y.id === aporteId) : xs[xs.length - 1]; if (!x) return null;
  a.b = a.b || []; a.b.push(x.id); return x;
}

/* -------- Los premios: la meta, las paradas del viaje y la racha de ahorro -------- */
function alcRevisar(id) {
  const a = alcPorId(id); if (!a || typeof registrarMovimiento !== "function") return;
  const llena = alcLlena(a), mov = "alc:" + a.id;
  if (llena && !ledgerVigente(STATE, mov)) {
    if (registrarMovimiento(mov, ALC_PREMIO, ALC_PREMIO, "Alcancía llena: " + a.nombre, true)) {
      toast(`🐷 ¡Llenaste «${a.nombre}»! +${ALC_PREMIO} ⭐`);
      if (STATE.gamif.equipped && STATE.gamif.equipped.confeti && typeof launchConfetti === "function") launchConfetti();
      if (typeof checkBadges === "function") setTimeout(checkBadges, 1200);
    }
  } else if (!llena && !a.cerrada && !a.caprichos && ledgerVigente(STATE, mov)) anularMovimiento(mov);
  if (alcEstiloVer(a) === "viaje") [25, 50, 75].forEach(p => {
    const m = `alc-parada:${a.id}:${p}`, pasa = alcFrac(a) * 100 >= p;
    if (pasa && !ledgerVigente(STATE, m)) { if (registrarMovimiento(m, ALC_PARADA, ALC_PARADA, `Parada del ${p} %: ${a.nombre}`, true) && !llena) toast(`🚌 Parada del ${p} %: +${ALC_PARADA} ⭐`); }
    else if (!pasa && !a.cerrada && ledgerVigente(STATE, m)) anularMovimiento(m);
  });
}
/* Las semanas (lunes) en que guardaste algo a mano; el reparto del cierre de mes no cuenta */
function alcSemanas(S) {
  const fuera = new Set(alcDatos(S).borradas), set = new Set();
  alcDatos(S).lista.forEach(a => { if (!a || fuera.has(a.id)) return; alcAportes(a).forEach(x => { if (!x.o && x.fecha) set.add(hmLunes(x.fecha)); }); });
  return set;
}
/* Semanas seguidas con algo guardado, contando hasta esta (o hasta la pasada, si esta aún no guardas) */
function alcRacha(S, hoy) {
  const set = alcSemanas(S); let l = hmLunes(hoy || todayISO()), n = 0;
  if (!set.has(l)) l = hmAdd(l, -7);
  while (set.has(l)) { n++; l = hmAdd(l, -7); }
  return n;
}
function alcRevisarRacha(hoy) {
  if (typeof registrarMovimiento !== "function") return;
  const set = alcSemanas(STATE), l0 = hmLunes(hoy || todayISO()), mov = "alc-racha:" + l0;
  let n = 0; for (let l = l0; set.has(l); l = hmAdd(l, -7)) n++;
  const toca = n >= ALC_RACHA_SEMANAS && n % ALC_RACHA_SEMANAS === 0;
  if (toca && !ledgerVigente(STATE, mov)) { if (registrarMovimiento(mov, ALC_RACHA, ALC_RACHA, `Racha de ahorro: ${n} semanas`, true)) toast(`🔥 ${n} semanas seguidas guardando algo: +${ALC_RACHA} ⭐`); }
  else if (!toca && ledgerVigente(STATE, mov)) anularMovimiento(mov);
}

/* -------- El cierre de mes: repartir lo que ahorraste -------- */
function alcAhorroMes(S, y, m) { const f = (datosAnio(S, y).finanzas.meses || [])[m] || {}; return (+f.ingreso || 0) - (+f.gasto || 0); }
function alcRepartido(S, key) {
  let t = 0; alcDatos(S).lista.forEach(a => alcAportes(a).forEach(x => { if (x.o === "cierre:" + key) t += +x.monto || 0; })); return t;
}
function alcRepartir(S, key, montos) {
  const y = +key.slice(0, 4), m = +key.slice(5, 7) - 1, fecha = isoLocal(new Date(y, m + 1, 0));
  let n = 0; Object.keys(montos).forEach(id => { if (alcAportar(id, montos[id], "cierre:" + key, S, fecha)) n++; });
  return n;
}
function alcRepartoHtml(y, m) {
  const key = mesKey(y, m), ahorro = alcAhorroMes(STATE, y, m), xs = alcActivas(STATE), ya = alcRepartido(STATE, key), mes = MESES[m].toLowerCase();
  if (!xs.length) return ahorro > 0 ? `<div class="card mt-16 alc-reparto"><b>🐷 Tus alcancías</b><p class="text-sm muted" style="margin:6px 0 0">En ${mes} ahorraste ${fmtCLP(ahorro)}. Crea una alcancía en Finanzas y, al cerrar el mes, aquí lo repartes con un toque.</p></div>` : "";
  if (ya) return `<div class="card mt-16 alc-reparto"><b>🐷 Repartiste ${fmtCLP(ya)} en tus alcancías</b><p class="text-xs muted" style="margin:6px 0 0">Los ves en Finanzas, con fecha de fin de ${mes}.</p></div>`;
  if (ahorro <= 0) return `<div class="card mt-16 alc-reparto"><b>🐷 Tus alcancías</b><p class="text-sm muted" style="margin:6px 0 0">En ${mes} no quedó ahorro para repartir (ingreso menos gasto). El próximo mes será.</p></div>`;
  const filas = xs.map(a => `<label class="alc-reparto__f"><span>${escapeHtml(a.nombre)}<small>${alcOculto() ? Math.round(alcFrac(a) * 100) + "%" : fmtCLP(alcGuardado(a)) + " de " + fmtCLP(a.meta)}</small></span>
      <input class="input" type="text" inputmode="numeric" placeholder="$0" data-alc-reparto="${escapeAttr(a.id)}" aria-label="Para ${escapeAttr(a.nombre)}"></label>`).join("");
  return `<div class="card mt-16 alc-reparto" data-mes="${key}"><b>🐷 En ${mes} ahorraste ${fmtCLP(ahorro)}</b>
    <p class="text-sm muted" style="margin:6px 0 10px">¿A qué alcancía va? Reparte lo que quieras (ingreso menos gasto).</p>
    ${filas}<div class="alc-reparto__pie">${xs.length === 1 ? "" : `<button type="button" class="btn-link" data-action="alc-reparto-todo" data-mes="${key}">Todo a la primera</button>`}
      <button type="button" class="btn btn--cian" data-action="alc-repartir" data-mes="${key}">Repartir</button></div></div>`;
}

/* -------- La torre del año: lo que ahorraste cada mes (ingreso menos gasto) -------- */
function alcTorreDatos(S, y, hoy) {
  hoy = hoy || todayISO();
  const D = datosAnio(S, y).finanzas, metaMes = +S.finanzas.metaMensual || 0, ya = +hoy.slice(0, 4), mh = +hoy.slice(5, 7) - 1;
  const meses = D.meses.map((f, i) => { f = f || {}; const ing = +f.ingreso || 0, gas = +f.gasto || 0; return { v: ing || gas ? ing - gas : null, meta: +f.metaAhorro || metaMes, futuro: y > ya || (y === ya && i > mh) }; });
  const total = meses.reduce((s, x) => s + (x.v || 0), 0);
  let sel = y === ya ? mh : 11; while (sel > 0 && meses[sel].v == null) sel--;
  return { y, meses, total, metaAnual: +D.metaAnual || 0, metaMes, sel };
}

/* -------- Lo que se ve: Finanzas -------- */
function alcMontoTxt(a) {
  const g = alcGuardado(a), ver = alcEstiloVer(a);
  if (alcOculto() || (ver === "caja" && !alcLlena(a))) return `${Math.round(Math.min(1, alcFrac(a)) * 100)}% <small>de tu meta</small>`;
  return `${fmtCLP(g)} <small>de ${fmtCLP(a.meta)}</small>`;
}
function alcTexto(a) {
  const g = alcGuardado(a), falta = Math.max(0, a.meta - g), oculto = alcOculto(), ver = alcEstiloVer(a);
  if (a.caprichos && !(a.meta > 0)) return "Suma deseos chicos desde Tus deseos con «A mis caprichos»";
  if (alcLlena(a)) return a.caprichos ? "¡Te alcanza para todos tus caprichos!" : `¡Meta cumplida! +${ALC_PREMIO} ⭐${g > a.meta && !oculto ? ` · ${fmtCLP(g - a.meta)} de más` : ""}`;
  if (ver === "caja" && !oculto) return "El monto se ve al abrirla";
  const pm = alcPorMes(a);
  const partes = [oculto ? `${Math.round(alcFrac(a) * 100)}%` : `Faltan ${fmtCLP(falta)}`];
  if (a.fecha) partes.push(pm && !oculto ? `${fmtCLP(pm)} al mes para el ${alcFechaTxt(a.fecha)}` : `para el ${alcFechaTxt(a.fecha)}`);
  return partes.join(" · ");
}
function alcBotonesHtml(a) {
  const llena = alcLlena(a), rompe = alcEstiloDe(alcEstiloVer(a)).rompe, n = alcAportes(a).length, id = escapeAttr(a.id);
  const rap = alcRapidos().slice(0, 2);
  return `<div class="alc__btns">${rap.map((v, i) => `<button type="button" class="btn ${i ? "btn--soft" : "btn--cian"}" data-action="alc-sumar" data-id="${id}" data-monto="${v}">+ ${fmtCLP(v)}</button>`).join("")}
      <button type="button" class="btn btn--soft" data-action="alc-otro" data-id="${id}">Otro</button></div>
    <div class="alc__pie"><button type="button" class="btn-link" data-action="alc-deshacer" data-id="${id}" data-alc-deshacer ${n ? "" : "hidden"}>Deshacer el último</button>
      ${a.caprichos ? "" : a.deseo ? `<button type="button" class="btn btn--primary alc__cerrar" data-action="des-comprar" data-id="${escapeAttr(a.deseo)}" data-alc-cerrar ${llena ? "" : "hidden"}>Lo compré</button>`
        : `<button type="button" class="btn btn--primary alc__cerrar" data-action="alc-cerrar" data-id="${id}" data-alc-cerrar ${llena ? "" : "hidden"}>${rompe ? "Romper el chanchito" : "Cerrar la alcancía"}</button>`}</div>`;
}
function alcCardHtml(a) {
  const ver = alcEstiloVer(a), e = alcEstiloDe(ver), pct = Math.round(Math.min(1, alcFrac(a)) * 100), id = escapeAttr(a.id);
  return `<article class="alc${alcLlena(a) ? " is-llena" : ""}" data-alc-card="${id}">
    <div class="alc__cab"><b>${escapeHtml(a.nombre)}</b>${a.deseo ? `<span class="chip alc__chip">💎 Deseo</span>` : a.caprichos ? `<span class="chip alc__chip">💎 Caprichos</span>` : ""}<button type="button" class="icon-btn" data-action="alc-editar" data-id="${id}" aria-label="Editar ${escapeAttr(a.nombre)}">✎</button></div>
    <canvas class="alc-cv" data-alc="${ver}" data-id="${id}" style="aspect-ratio:260/220" role="img" aria-label="${escapeAttr(e.nombre)}: ${escapeAttr(a.nombre)}, ${pct}%"></canvas>
    <div class="alc__estado"><div class="alc__t"><span data-alc-monto>${alcMontoTxt(a)}</span><b data-alc-pct>${pct}%</b></div>
      <div class="bar"><div class="bar__fill" data-alc-barra style="width:${pct}%"></div></div>
      <small class="text-xs muted" data-alc-txt>${escapeHtml(alcTexto(a))}</small></div>
    ${a.caprichos && typeof deseosEscaleraHtml === "function" ? `<div data-alc-escalera>${deseosEscaleraHtml(a)}</div>` : ""}
    ${alcBotonesHtml(a)}
  </article>`;
}
function alcTorreHtml() {
  const y = anioVista(), T = alcTorreDatos(STATE, y);
  if (!T.meses.some(x => x.v != null)) return `<p class="text-xs muted mt-16">🪙 La torre del año: anota ingreso y gasto en el seguimiento mensual y aquí se arman tus meses en pilas de monedas.</p>`;
  return `<div class="alc-torre"><canvas class="alc-cv alc-torre__cv" data-alc="torre" data-anio="${y}" role="img" aria-label="Lo que ahorraste cada mes de ${y}, en pilas de monedas"></canvas>
    <small class="text-xs muted" data-alc-torre-txt>${escapeHtml(alcTorreTxt(T, T.sel))}</small></div>`;
}
function alcTorreTxt(T, i) {
  const x = T.meses[i]; if (!x || x.v == null) return "Toca un mes para ver cuánto guardaste.";
  const mes = MESES[i].toLowerCase();
  if (alcOculto()) return x.meta > 0 ? `${mes}: ${Math.round(x.v / x.meta * 100)}% de tu meta del mes` : `${mes}: ${x.v < 0 ? "gastaste más de lo que ganaste" : "guardaste"}`;
  return `${mes}: ${x.v < 0 ? `gastaste ${fmtCLP(-x.v)} más de lo que ganaste` : `guardaste ${fmtCLP(x.v)}`}${x.meta > 0 && x.v >= 0 ? ` (${Math.round(x.v / x.meta * 100)}% de tu meta del mes)` : ""}`;
}
function alcFinanzasHtml() {
  if (!STATE) return "";
  const xs = alcActivas(), cerr = alcCerradas(), oc = alcOculto();
  const cab = `<div class="card__head"><div class="card__title">🐷 Tus alcancías</div>
      <div class="alc-sec__acc">${xs.length || cerr.length ? `<button type="button" class="btn-ghost" data-action="alc-ocultar" aria-pressed="${oc}">${oc ? "Mostrar montos" : "Ocultar montos"}</button>` : ""}
        <button type="button" class="btn-ghost" data-action="alc-nueva">+ Nueva</button></div></div>`;
  const vacio = `<div class="alc-vacio"><canvas class="alc-cv alc-vacio__cv" data-alc="greda" data-modo="muestra" data-frac="0.7" style="aspect-ratio:260/220" aria-hidden="true"></canvas>
      <div><b>Cada cosa por la que ahorras, en su alcancía</b><p class="text-sm muted">Ponle nombre y meta (un viaje, un fondo de emergencia, una bicicleta). Cuando guardes algo, toca «+» y mira caer las monedas. Llenarla da +${ALC_PREMIO} ⭐.</p>
        <button type="button" class="btn btn--cian" data-action="alc-nueva">+ Crear mi primera alcancía</button></div></div>`;
  const cumplidas = cerr.length ? `<details class="alc-cumplidas"><summary>Cumplidas (${cerr.length})</summary>
      ${cerr.map(a => `<div class="alc-cumplida"><span><b>${escapeHtml(a.nombre)}</b><small>${oc ? "" : fmtCLP(alcGuardado(a)) + " · "}${new Date(a.cerrada).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</small></span>
        <button type="button" class="btn-link" data-action="alc-otra" data-id="${escapeAttr(a.id)}">Otra igual</button></div>`).join("")}</details>` : "";
  const racha = alcRacha(STATE);
  return `<div class="card mt-24 alc-sec" id="alcancias">${cab}
    ${xs.length ? `<div class="alc-grid">${xs.map(alcCardHtml).join("")}</div>` : vacio}
    ${xs.length ? `<p class="text-xs muted mt-16">${racha ? `🔥 ${racha === 1 ? "Esta semana guardaste algo" : racha + " semanas seguidas guardando algo"}. ` : ""}Guarda algo cada semana: con ${ALC_RACHA_SEMANAS} seguidas, +${ALC_RACHA} ⭐. Tus amigos nunca ven tus alcancías.</p>` : ""}
    ${cumplidas}
  </div>`;
}
/* Después de guardar o deshacer: los textos cambian donde están (sin volver a dibujar Finanzas) y las monedas caen */
function alcPintar(id, delta) {
  if (typeof document === "undefined") return;
  const a = alcPorId(id); if (!a) return;
  const pct = Math.round(Math.min(1, alcFrac(a)) * 100), llena = alcLlena(a), n = alcAportes(a).length;
  document.querySelectorAll(`[data-alc-card="${CSS.escape(id)}"]`).forEach(c => {
    c.classList.toggle("is-llena", llena);
    const q = s => c.querySelector(s);
    if (q("[data-alc-monto]")) q("[data-alc-monto]").innerHTML = alcMontoTxt(a);
    if (q("[data-alc-pct]")) q("[data-alc-pct]").textContent = pct + "%";
    if (q("[data-alc-barra]")) q("[data-alc-barra]").style.width = pct + "%";
    if (q("[data-alc-txt]")) q("[data-alc-txt]").textContent = alcTexto(a);
    if (q("[data-alc-deshacer]")) q("[data-alc-deshacer]").hidden = !n;
    if (q("[data-alc-cerrar]")) q("[data-alc-cerrar]").hidden = !llena;
    if (q("[data-alc-escalera]") && typeof deseosEscaleraHtml === "function") q("[data-alc-escalera]").innerHTML = deseosEscaleraHtml(a);
  });
  if (document.getElementById("deseos") && typeof deseosHtml === "function" && (a.deseo || a.caprichos)) { const v = document.createElement("div"); v.innerHTML = iconizar(deseosHtml()); document.getElementById("deseos").replaceWith(v.firstElementChild); }
  if (delta && typeof ALC_MOTOR !== "undefined") ALC_MOTOR.cambio(id, delta);
}
function alcSumar(id, monto) {
  const x = alcAportar(id, monto); if (!x) return;
  saveState(); vibrar(10); alcPintar(id, x.monto);
  const t = alcSumar._t = alcSumar._t || {};   // cuando caen las monedas (una espera por alcancía)
  clearTimeout(t[id]); t[id] = setTimeout(() => { delete t[id]; alcRevisar(id); alcRevisarRacha(); if (typeof updateTopbar === "function") updateTopbar(); }, 700);
}
function alcQuitar(id, aporteId) {
  const x = alcDeshacerAporte(id, aporteId); if (!x) return;
  if (alcSumar._t && alcSumar._t[id]) { clearTimeout(alcSumar._t[id]); delete alcSumar._t[id]; }
  saveState(); alcPintar(id, -x.monto); alcRevisar(id); alcRevisarRacha();
  if (typeof updateTopbar === "function") updateTopbar();
  if (document.getElementById("alc-hoja")) { alcLeerBorrador(); openAlcEditar(id); }
}

/* -------- Las hojas: nueva, editar y otro monto -------- */
let ALC_BORRADOR = null;
function alcEstilosChipsHtml(sel) {
  const tuyos = ALC_ESTILOS.filter(x => alcEstiloTuyo(x.id)), faltan = ALC_ESTILOS.length - tuyos.length;
  return `<div class="alc-estilos">${tuyos.map(x => `<button type="button" class="alc-estilo${x.id === sel ? " is-on" : ""}" data-action="alc-estilo" data-v="${x.id}" aria-pressed="${x.id === sel}">
      <canvas class="alc-cv" data-alc="${x.id}" data-modo="muestra" data-frac="0.6" style="aspect-ratio:260/220" aria-hidden="true"></canvas><span>${escapeHtml(x.nombre)}</span></button>`).join("")}</div>
    ${faltan ? `<button type="button" class="btn-link" data-action="alc-tienda">${faltan === 1 ? "1 estilo más" : faltan + " estilos más"} en la Tienda</button>` : ""}`;
}
function alcLeerBorrador() {
  const d = ALC_BORRADOR; if (!d) return;
  const el = id => document.getElementById(id);
  if (el("alc-nombre")) d.nombre = el("alc-nombre").value;
  if (el("alc-meta")) d.meta = parseNum(el("alc-meta").value);
  if (el("alc-fecha")) d.fecha = el("alc-fecha").value;
  if (el("alc-destino")) d.destino = el("alc-destino").value;
}
function alcHojaHtml() {
  const d = ALC_BORRADOR, a = d.id ? alcPorId(d.id) : null;
  const aportes = a ? alcAportes(a).slice().reverse() : [];
  return `<div class="alc-hoja" id="alc-hoja">
    <div class="field"><label for="alc-nombre">¿Para qué ahorras?</label><input class="input" id="alc-nombre" maxlength="40" value="${escapeAttr(d.nombre || "")}" placeholder="Ej: Viaje al sur"></div>
    <div class="grid grid-2 alc-hoja__2">
      <div class="field"><label for="alc-meta">Tu meta ($)</label>${a && (a.deseo || a.caprichos) ? `<input class="input" id="alc-meta-fija" value="${fmtCLP(a.meta)}" disabled><small class="text-xs muted">${a.caprichos ? "Es la suma de tus caprichos." : "Sale del precio del deseo (cámbialo en Tus deseos)."}</small>`
        : `<input class="input" id="alc-meta" type="text" inputmode="numeric" value="${d.meta ? d.meta : ""}" placeholder="Ej: 600.000">`}</div>
      <div class="field"><label for="alc-fecha">Para cuándo (opcional)</label><input class="input" id="alc-fecha" type="date" value="${escapeAttr(d.fecha || "")}"></div>
    </div>
    <div class="field"><label>Estilo</label>${alcEstilosChipsHtml(d.estilo)}</div>
    ${d.estilo === "viaje" ? `<div class="field"><label for="alc-destino">Tu destino (el letrero del final)</label><input class="input" id="alc-destino" maxlength="22" value="${escapeAttr(d.destino || "")}" placeholder="Ej: Puerto Varas"></div>` : ""}
    <button type="button" class="btn btn--primary btn-block" data-action="alc-guardar">${a ? "Guardar cambios" : "Crear la alcancía"}</button>
    ${a ? `<div class="agua-sec"><span class="cj-sub">Lo que guardaste</span>
      ${aportes.length ? `<div class="agua-lista">${aportes.map(x => `<div class="agua-reg"><span>${alcFechaTxt(x.fecha)}${String(x.o || "").startsWith("cierre:") ? " · cierre de mes" : String(x.o || "").startsWith("compra:") ? " · compraste" : String(x.o || "").startsWith("sobra:") ? " · lo que sobró" : ""}</span><b>${fmtCLP(x.monto)}</b>
        ${String(x.o || "").startsWith("compra:") ? "<span></span>" : `<button class="icon-btn" data-action="alc-quitar" data-id="${escapeAttr(a.id)}" data-ap="${escapeAttr(x.id)}" aria-label="Quitar ${fmtCLP(x.monto)}">✕</button>`}</div>`).join("")}</div>` : `<p class="text-sm muted" style="margin:0">Aún no guardas nada en esta alcancía.</p>`}</div>
      <div class="alc-hoja__fin">${a.caprichos ? "<span></span>" : a.deseo ? `<button type="button" class="btn-link" data-action="des-comprar" data-id="${escapeAttr(a.deseo)}">Lo compré</button>` : `<button type="button" class="btn-link" data-action="alc-cerrar" data-id="${escapeAttr(a.id)}">Cerrar la alcancía</button>`}
        <button type="button" class="btn-link alc-borrar" data-action="alc-borrar" data-id="${escapeAttr(a.id)}">Borrar</button></div>` : ""}
  </div>`;
}
function openAlcNueva(base) {
  ALC_BORRADOR = Object.assign({ id: null, nombre: "", meta: 0, fecha: "", estilo: "greda", destino: "" }, base || {});
  openModal("Nueva alcancía", alcHojaHtml(), { ancho: true });
}
function openAlcEditar(id) {
  const a = alcPorId(id); if (!a) return;
  if (!ALC_BORRADOR || ALC_BORRADOR.id !== id) ALC_BORRADOR = { id, nombre: a.nombre, meta: a.meta, fecha: a.fecha || "", estilo: alcEstiloVer(a), destino: a.destino || "" };
  openModal(a.nombre, alcHojaHtml(), { ancho: true });
}
function alcGuardarHoja() {
  alcLeerBorrador();
  const d = ALC_BORRADOR; if (!d) return;
  if (!String(d.nombre || "").trim()) return toast("Ponle un nombre a tu alcancía", true);
  const fija = d.id && alcPorId(d.id) && (alcPorId(d.id).deseo || alcPorId(d.id).caprichos);
  if (fija) d.meta = alcPorId(d.id).meta;
  if (!(d.meta > 0) && !(fija && alcPorId(d.id).caprichos)) return toast("Ponle una meta (cuánto quieres juntar)", true);
  if (d.id) { alcEditar(d.id, d); alcRevisar(d.id); toast("Alcancía guardada"); }
  else { const a = alcCrear(d); toast(`🐷 «${a.nombre}» lista: toca «+» cuando guardes`); }
  ALC_BORRADOR = null; saveState(); closeModal(); if (typeof rerender === "function") rerender();
}
function openAlcOtro(id) {
  const a = alcPorId(id); if (!a) return;
  openModal("¿Cuánto guardaste?", `<div class="alc-otro" id="alc-otro">
    <p class="text-sm muted" style="margin:0 0 10px">En «${escapeHtml(a.nombre)}».</p>
    <div class="agua-chips">${alcRapidos().map(v => `<button type="button" class="chip" data-action="alc-otro-ok" data-id="${escapeAttr(id)}" data-monto="${v}">${fmtCLP(v)}</button>`).join("")}</div>
    <div class="alc-otro__f"><input class="input" id="alc-otro-monto" type="text" inputmode="numeric" placeholder="Otro monto" aria-label="Monto"
      onkeydown="if(event.key==='Enter'){event.preventDefault();alcAccion('alc-otro-ok',{id:'${escapeAttr(id)}'})}">
      <button type="button" class="btn btn--cian" data-action="alc-otro-ok" data-id="${escapeAttr(id)}">Guardar</button></div>
  </div>`);
  setTimeout(() => { const i = document.getElementById("alc-otro-monto"); if (i && matchMedia("(pointer: fine)").matches) i.focus(); }, 50);
}
/* Cerrar: los chanchitos se rompen (la animación) y la alcancía pasa a «Cumplidas» */
function alcCerrar(id) {
  const a = alcPorId(id); if (!a || a.cerrada) return;
  const rompe = alcEstiloDe(alcEstiloVer(a)).rompe && alcLlena(a);
  if (!alcLlena(a) && !confirm(`¿Cerrar «${a.nombre}» sin llegar a la meta?\nQueda en «Cumplidas» con lo que guardaste.`)) return;
  const fin = () => { a.cerrada = Date.now(); a.ts = a.cerrada; saveState(); closeModal(); if (typeof rerender === "function") rerender(); toast(rompe ? "🔨 ¡Crac! A disfrutar lo que juntaste" : `🐷 «${a.nombre}» quedó en Cumplidas`); };
  if (rompe && typeof ALC_MOTOR !== "undefined" && ALC_MOTOR.romper(id)) { closeModal(); document.querySelectorAll(`[data-alc-card="${CSS.escape(id)}"] button`).forEach(b => { b.disabled = true; }); vibrar([30, 30, 60]); setTimeout(fin, 2600); }
  else fin();
}
function alcAccion(a, d, el) {
  if (a === "alc-sumar") return alcSumar(d.id, +d.monto);
  if (a === "alc-deshacer") return alcQuitar(d.id);
  if (a === "alc-quitar") return alcQuitar(d.id, d.ap);
  if (a === "alc-otro") return openAlcOtro(d.id);
  if (a === "alc-otro-ok") {
    const v = d.monto ? +d.monto : parseNum(val("alc-otro-monto"));
    if (!(v > 0)) return toast("Escribe cuánto guardaste", true);
    closeModal(); return alcSumar(d.id, v);
  }
  if (a === "alc-nueva") return openAlcNueva();
  if (a === "alc-editar") { ALC_BORRADOR = null; return openAlcEditar(d.id); }
  if (a === "alc-estilo") { alcLeerBorrador(); if (ALC_BORRADOR && alcEstiloTuyo(d.v)) ALC_BORRADOR.estilo = d.v; const b = ALC_BORRADOR; return b && b.id ? openAlcEditar(b.id) : openModal("Nueva alcancía", alcHojaHtml(), { ancho: true }); }
  if (a === "alc-guardar") return alcGuardarHoja();
  if (a === "alc-cerrar") return alcCerrar(d.id);
  if (a === "alc-borrar") {
    const x = alcPorId(d.id); if (!x || !confirm(`¿Borrar «${x.nombre}» y todo lo que guardaste en ella?`)) return;
    const D = alcDatos(); D.borradas.push(x.id); D.lista = D.lista.filter(y => y.id !== x.id);
    if (ledgerVigente(STATE, "alc:" + x.id)) anularMovimiento("alc:" + x.id);
    [25, 50, 75].forEach(p => { if (ledgerVigente(STATE, `alc-parada:${x.id}:${p}`)) anularMovimiento(`alc-parada:${x.id}:${p}`); });
    if (typeof deseosAlcSuelta === "function") deseosAlcSuelta(x.id);
    alcRevisarRacha(); ALC_BORRADOR = null; saveState(); closeModal(); if (typeof rerender === "function") rerender(); return toast("Alcancía borrada");
  }
  if (a === "alc-otra") { const x = alcPorId(d.id); if (!x) return; return openAlcNueva({ nombre: x.nombre, meta: x.meta, estilo: alcEstiloVer(x), destino: x.destino || "" }); }
  if (a === "alc-ocultar") { const D = alcDatos(); D.ocultar = !D.ocultar; D.ts = Date.now(); saveState(); if (typeof rerender === "function") rerender(); return; }
  if (a === "alc-tienda") { closeModal(); ALC_BORRADOR = null; if (typeof TIENDA_SEC !== "undefined") TIENDA_SEC = "estilo"; return go("recompensas"); }
  if (a === "alc-repartir" || a === "alc-reparto-todo") {
    const caja = document.querySelector(`.alc-reparto[data-mes="${d.mes}"]`); if (!caja) return;
    const y = +d.mes.slice(0, 4), m = +d.mes.slice(5, 7) - 1, ahorro = alcAhorroMes(STATE, y, m), ins = [...caja.querySelectorAll("[data-alc-reparto]")];
    if (a === "alc-reparto-todo") { ins.forEach((i, k) => { i.value = k ? "" : String(ahorro); }); return; }
    const montos = {}; let t = 0; ins.forEach(i => { const v = parseNum(i.value); if (v > 0) { montos[i.dataset.alcReparto] = v; t += v; } });
    if (!t) return toast("Escribe cuánto va a cada alcancía", true);
    if (t > ahorro) return toast(`Eso es más de lo que ahorraste (${fmtCLP(ahorro)})`, true);
    alcRepartir(STATE, d.mes, montos); Object.keys(montos).forEach(alcRevisar); saveState();
    toast(`🐷 Repartiste ${fmtCLP(t)} en tus alcancías`);
    if (typeof rerender === "function") rerender();   // Finanzas, detrás del cierre
    if (typeof MES_WIZ !== "undefined" && MES_WIZ && typeof renderMesWiz === "function") { if (typeof mesWizLeer === "function") mesWizLeer(); renderMesWiz(); }
    return;
  }
}

/* -------- La Tienda: miniatura de la ficha y muestra grande en el detalle -------- */
function alcFichaHtml(it) {
  if (it.key === "moneda") return `<canvas class="alc-ficha" data-alc="moneda" data-modo="muestra" data-moneda="${escapeAttr(it.value)}" aria-hidden="true"></canvas>`;
  return `<canvas class="alc-ficha" data-alc="${escapeAttr(it.value)}" data-modo="muestra" data-frac="0.6" aria-hidden="true"></canvas>`;
}
function alcMuestraHtml(it) {
  const estilo = it.key === "moneda" ? "greda" : it.value;
  return `<canvas class="alc-cv" data-alc="${escapeAttr(estilo)}" data-modo="muestra" data-frac="0.62" ${it.key === "moneda" ? `data-moneda="${escapeAttr(it.value)}"` : ""} style="aspect-ratio:260/220" aria-hidden="true"></canvas>`;
}
