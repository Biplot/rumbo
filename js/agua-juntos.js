/* ============================================================
   RUMBO · 💧 Agua con otros (tercera entrega del agua)
   · «+ Un vaso» desde el aviso: el aviso del agua de tu elefante (a las 16:00, si vas atrasado) trae dos botones,
     «+ Un vaso» y «+ Tu botella». Sin abrir la app, el service worker (sw.js) anota el vaso en este teléfono
     (caché «rumbo-ajustes», /__agua-pend) y en el servidor (api/push.js → agua_pendientes). La app los suma al
     abrirse, o al tiro si estaba abierta, cada uno con su id: nunca dos veces. En iPhone el aviso no trae
     botones (Apple no los muestra): tocarlo abre la portilla.
   · La fuente de Rumbo: una plaza con una fuente que se llena con los vasos de todos hoy. Cada uno suma lo que
     lleva hasta su meta (y hasta 4 L); solo se ven totales, nadie ve cuánto tomó otro. Se apaga en «Tu agua».
     Al llegar a la meta de la comunidad (2 L por persona que tomó agua hoy), la fuente se enciende.
   · El bidón con amigos: un desafío de la semana (de lunes a domingo). Cada uno suma su agua de la semana (hasta
     5 L al día), con su color. «¡Salud!» le manda un brindis al grupo (un ánimo a cada uno) y a quien va atrás,
     un ánimo. Al terminar la semana: 1 ⭐ por litro que aportaste (hasta 30) y +20 ⭐ si lo llenaron.
     Lo arma quien tiene «El bidón» (Tienda, 300 ⭐); sumarse es gratis.
   Datos: supabase/agua.sql (store.js: aguaPendientesTomar, fuenteHoy/fuenteSumar y bidon*). El dibujo: las
   escenas «bidon» y «fuente» de AGUA_MOTOR (agua.js), que leen aguaBidonDatos y aguaFuenteDatos.
   ============================================================ */
const AGUA_PEND = { corriendo: false }, AGUA_PEND_CACHE = "rumbo-ajustes", AGUA_PEND_CLAVE = "/__agua-pend";
const FUENTE = { dato: null, t: 0, cargando: false, error: null, otras: 0, reloj: 0 };
const FUENTE_POR_PERSONA = 2000, FUENTE_TOPE = 4000, FUENTE_VASO = 250;
const BIDON = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [], subido: {} };
/* Un color por persona (el mismo para todos los que miran el bidón); quien salió, en gris */
const BD_COLORES = ["#2E9BDB", "#E8606B", "#F4AE3D", "#7D6BD6", "#2F9E74", "#D2508A", "#2A9BB8", "#8C9A2E"], BD_GRIS = "#9AA1C0";
const BD_TOPE_DIA = 5000, BD_PREMIO_TOPE = 30, BD_PREMIO_LLENO = 20, BD_COS = "agua-bidon", BD_META_MIN = 10000, BD_META_MAX = 200000;

/* ============ «+ Un vaso» desde el aviso ============ */
/* Suma al estado los vasos del aviso que todavía no están (por id). Devuelve lo sumado y los ids ya resueltos */
function aguaAplicarPendientes(lista, S) {
  S = S || STATE;
  const hoy = todayISO(), corte = agSumar(hoy, -(AGUA_DETALLE - 1)), manana = agSumar(hoy, 1), hechos = [], fechas = new Set();
  let ml = 0, n = 0;
  (Array.isArray(lista) ? lista : []).forEach(x => {
    if (!x || typeof x !== "object") return;
    const id = String(x.id || ""), f = String(x.fecha || "").slice(0, 10), v = Math.round(+x.ml);
    if (!/^[a-z0-9]{4,40}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    if (!(v >= 50 && v <= 3000) || f < corte || f > manana) { hechos.push(id); return; }
    const d = aguaDia(f, true, S);
    if (d.r.some(r => r && r.id === id) || (d.b || []).includes(id) || aguaTotal(d) + v > AGUA_TOPE) { hechos.push(id); return; }
    d.r.push({ id, ml: v, ts: +x.ts > 0 ? +x.ts : Date.now() }); d.r.sort((p, q) => (p.ts || 0) - (q.ts || 0));
    hechos.push(id); fechas.add(f); ml += v; n++;
  });
  return { ml, n, hechos, fechas: [...fechas] };
}
async function aguaPendCache() { try { return typeof caches !== "undefined" ? await caches.open(AGUA_PEND_CACHE) : null; } catch (e) { return null; } }
async function aguaPendLeer(cache) { try { const r = cache && await cache.match(AGUA_PEND_CLAVE), l = r ? JSON.parse(await r.text()) : []; return Array.isArray(l) ? l : []; } catch (e) { return []; } }
/* Trae los vasos del aviso (de este teléfono y del servidor) y los suma */
async function aguaPendientes() {
  if (typeof STATE === "undefined" || !STATE || !CURRENT_USER || AGUA_PEND.corriendo) return;
  AGUA_PEND.corriendo = true;
  try {
    const cache = await aguaPendCache();
    let lista = await aguaPendLeer(cache);
    if (BACKEND.aguaPendientesTomar) { const r = await BACKEND.aguaPendientesTomar(); if (Array.isArray(r)) lista = lista.concat(r); }
    if (!STATE || !lista.length) return;
    const res = aguaAplicarPendientes(lista);
    // del teléfono se quitan los resueltos (lo que el aviso anotó mientras tanto queda para la próxima)
    if (cache && res.hechos.length) {
      try {
        const quedan = (await aguaPendLeer(cache)).filter(x => !res.hechos.includes(x && x.id));
        if (quedan.length) await cache.put(AGUA_PEND_CLAVE, new Response(JSON.stringify(quedan), { headers: { "Content-Type": "application/json" } }));
        else await cache.delete(AGUA_PEND_CLAVE);
      } catch (e) { /* queda para la próxima: el id evita sumarlo dos veces */ }
    }
    if (!res.n) return;
    saveState(); aguaPintar(res.ml); res.fechas.forEach(f => aguaRevisar(f));
    toast(`💧 Desde el aviso: +${aguaMlTxt(res.ml)}${res.n > 1 ? ` (${res.n} vasos)` : ""}`);
    aguaJuntosCambio();
  } finally { AGUA_PEND.corriendo = false; }
}
/* El service worker avisa cuando anotó un vaso con la app abierta */
if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
  navigator.serviceWorker.addEventListener("message", ev => { if (ev.data && ev.data.tipo === "rumbo-agua-pend") aguaPendientes(); });
}

/* Al tocar el aviso del agua (en iPhone no trae botones): en Inicio, la tarjeta «Agua de hoy»; si no, la portilla o «Tu agua» */
function aguaDesdeAviso() {
  const card = document.querySelector("[data-agua-card]");
  if (card && typeof CURRENT !== "undefined" && CURRENT === "inicio") {
    card.scrollIntoView({ block: "center", behavior: "smooth" }); card.classList.add("is-llamada"); setTimeout(() => card.classList.remove("is-llamada"), 1800); return;
  }
  if (aguaDatos().fab !== false) { AGUA_FAB.listo = true; aguaFabActualizar(); if (AGUA_FAB.el && !AGUA_FAB.el.hidden) return aguaFabAbrir(); }
  openAgua();
}

/* ============ Subir lo tuyo: la fuente y tus bidones (después de cada vaso, con calma) ============ */
let AGUA_JUNTOS_T = 0;
function aguaJuntosCambio() { clearTimeout(AGUA_JUNTOS_T); AGUA_JUNTOS_T = setTimeout(aguaJuntosSubir, 2500); }
/* Lo tuyo en la fuente: lo que llevas hoy, hasta tu meta y hasta 4 L */
function aguaFuenteMio(S) { return Math.max(0, Math.min(FUENTE_TOPE, aguaHoy(S), aguaMeta(S))); }
function aguaFuenteOn(S) { return aguaDatos(S).fuente !== false; }
async function aguaJuntosSubir() {
  if (typeof STATE === "undefined" || !STATE || !CURRENT_USER) return;
  const mio = aguaFuenteOn() ? aguaFuenteMio() : 0, d = FUENTE.dato, igual = d && d.fecha === todayISO() && d.yo === mio;   // solo si cambió lo tuyo
  if (BACKEND.fuenteSumar && FUENTE.error !== "sin-servidor" && !igual && (mio > 0 || (d && d.yo > 0))) {
    const r = await BACKEND.fuenteSumar(todayISO(), mio);
    if (r && !r.error) fuenteRecibir(r, true); else if (r && r.error === "sin-servidor") { FUENTE.error = r.error; aguaJuntosRepintar(); }
  }
  await bidonesSubir();
}

/* ============ La fuente de Rumbo ============ */
function fuenteLimpia(x) {
  x = x && typeof x === "object" ? x : {};
  const num = v => { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(0, n) : 0; };
  return { fecha: cjFecha(x.fecha) || todayISO(), ml: num(x.ml), personas: num(x.personas), yo: num(x.yo) };
}
function fuenteMeta(d) { return Math.max(1, d.personas) * FUENTE_POR_PERSONA; }
async function fuenteCargar(forzar) {
  if (!CURRENT_USER || !STATE || FUENTE.cargando || !BACKEND.fuenteHoy || FUENTE.error === "sin-servidor") return;
  if (!forzar && FUENTE.dato && FUENTE.dato.fecha === todayISO() && Date.now() - FUENTE.t < 30000) return;
  FUENTE.cargando = true;
  const r = await BACKEND.fuenteHoy(todayISO());
  FUENTE.cargando = false;
  if (!STATE) return;
  if (r && r.error) { FUENTE.error = r.error; aguaJuntosRepintar(); return; }
  fuenteRecibir(r, false);
}
/* Lo que llegó del servidor. Lo que subió de los demás desde la última vez llega como gotas a la fuente */
function fuenteRecibir(r, mio) {
  const d = fuenteLimpia(r), antes = FUENTE.dato;
  if (antes && antes.fecha === d.fecha) {
    const otros = (d.ml - d.yo) - (antes.ml - antes.yo);
    if (otros > 0) FUENTE.otras = Math.min(14, FUENTE.otras + Math.max(1, Math.round(otros / FUENTE_VASO)));
  }
  FUENTE.dato = d; FUENTE.t = Date.now(); FUENTE.error = null;
  fuentePintar();
}
/* Para la escena: el total, la meta y si cuentas tú */
function aguaFuenteDatos() {
  const d = FUENTE.dato || { ml: 0, personas: 0, yo: 0 };
  return { ml: d.ml, meta: fuenteMeta(d), personas: d.personas, tuyo: aguaFuenteOn() };
}
function aguaFuenteOtra() { if (FUENTE.otras > 0 && Math.random() < 0.06) { FUENTE.otras--; return true; } return false; }
function fuenteInfoHtml() {
  const d = FUENTE.dato;
  if (!d) return `<small class="muted">${FUENTE.error && FUENTE.error !== "sin-servidor" ? "No se pudo traer la fuente. Vuelve a abrir «Tu agua» en un rato." : "Trayendo la fuente…"}</small>`;
  const vasos = Math.floor(d.ml / FUENTE_VASO), meta = fuenteMeta(d), metaV = Math.round(meta / FUENTE_VASO), pct = Math.min(100, Math.round(d.ml / meta * 100)), on = d.ml > 0 && d.ml >= meta;
  return `<div class="fu__cifra"><b>${vasos.toLocaleString("es-CL")}</b> ${vasos === 1 ? "vaso" : "vasos"} hoy en Rumbo</div>
    <div class="fu__barra" role="img" aria-label="${pct} % de la meta de hoy"><b style="width:${pct}%"></b></div>
    <small class="muted">${d.personas === 1 ? "1 persona" : `${d.personas.toLocaleString("es-CL")} personas`} · la meta: ${metaV.toLocaleString("es-CL")} vasos${on ? " · <b class=\"fu__on\">¡la fuente se encendió!</b>" : ""}</small>
    ${aguaFuenteOn() && d.yo ? `<small class="muted">Tu parte: ${Math.floor(d.yo / FUENTE_VASO)} ${Math.floor(d.yo / FUENTE_VASO) === 1 ? "vaso" : "vasos"}</small>` : ""}`;
}
function fuenteSeccionHtml() {
  if (!BACKEND.fuenteHoy || FUENTE.error === "sin-servidor") return "";
  return `<div class="agua-sec" id="agua-fuente"><span class="cj-sub">La fuente de Rumbo</span>
    <p class="text-xs muted" style="margin:0 0 8px">Se llena con los vasos de todos hoy. Solo se ven totales: nadie ve cuánto tomaste.</p>
    <div class="fu"><canvas class="agua-cv fu__cv" data-agua="fuente" data-modo="hoja" style="aspect-ratio:280/210" role="img" aria-label="La fuente de Rumbo"></canvas>
      <div class="fu__info" id="agua-fuente-info" aria-live="polite">${fuenteInfoHtml()}</div></div>
    <label class="agua-inicio"><input type="checkbox" data-action="agua-fu-on" ${aguaFuenteOn() ? "checked" : ""}> Sumar mis vasos a la fuente (solo el total del día, sin tu nombre)</label></div>`;
}
function fuentePintar() { const el = document.getElementById("agua-fuente-info"); if (el) el.innerHTML = fuenteInfoHtml(); }

/* ============ El bidón con amigos ============ */
function bdLunes(iso) { const d = new Date(iso + "T12:00:00"); return agSumar(iso, -((d.getDay() + 6) % 7)); }
function bdFin(b) { return agSumar(b.lunes, 6); }
function bdEnCurso(b, hoy) { hoy = hoy || todayISO(); return hoy >= b.lunes && hoy <= bdFin(b); }
function bdNum(v) { const n = Math.round(Number(v)); return isFinite(n) ? Math.max(0, n) : 0; }
/* Lo que llega del servidor lo escribieron otras personas: se limpia */
function bdLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  const lista = v => (Array.isArray(v) ? v : []);
  return {
    id: String(x.id || "").slice(0, 64), nombre: String(x.nombre || "").trim().slice(0, 40) || "El bidón",
    meta: Math.max(5000, bdNum(x.meta_ml) || 40000), lunes: cjFecha(x.lunes) || bdLunes(todayISO()), lleno: cjFecha(x.lleno),
    creador: String(x.creador || ""), estado: x.estado === "activo" ? "activo" : "invitado", invita: String(x.invita || ""),
    miembros: lista(x.miembros).slice(0, 8).map(m => ({ id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60),
      avatar: (m && m.avatar) || null, estado: m && m.estado === "activo" ? "activo" : "invitado", color: Math.max(0, Math.min(7, parseInt(m && m.color, 10) || 0)) })),
    totales: lista(x.totales).slice(0, 50).map(t => ({ id: String((t && t.id) || ""), nombre: String((t && t.nombre) || "").slice(0, 60), ml: bdNum(t && t.ml), hoy: bdNum(t && t.hoy) })),
  };
}
function bdYo(b) { return b.miembros.find(m => m.yo) || null; }
function bdQuienInvita(b) { const m = b.miembros.find(x => x.id === b.invita); return (m && m.nombre) || "Un amigo"; }
/* Tu agua de cada día de la semana del bidón, hasta hoy (y hasta 5 L al día) */
function bdMisDias(b, hoy, S) {
  hoy = hoy || todayISO(); const out = {};
  for (let i = 0; i < 7; i++) { const f = agSumar(b.lunes, i); if (f > hoy) break; out[f] = Math.min(BD_TOPE_DIA, aguaTotal(aguaDia(f, false, S))); }
  return out;
}
function bdMioMl(b, S) { return Object.values(bdMisDias(b, null, S)).reduce((s, v) => s + v, 0); }
/* Cada persona con su color y sus litros: tú (lo tuyo, al día con este teléfono), quienes están y quienes salieron */
function bdPersonas(b) {
  const tot = id => b.totales.find(t => t.id === id) || {};
  const out = b.miembros.filter(m => m.estado === "activo").sort((p, q) => q.yo - p.yo || p.color - q.color).map(m => {
    const ml = m.yo && bdEnCurso(b) ? Math.max(bdMioMl(b), 0) : tot(m.id).ml || 0;
    return { id: m.id, yo: m.yo, nombre: m.yo ? "Tú" : m.nombre || "Sin nombre", ml, hoy: tot(m.id).hoy || 0, color: BD_COLORES[m.color] || BD_COLORES[0], m };
  });
  b.totales.filter(t => !out.some(p => p.id === t.id) && t.ml > 0)
    .forEach(t => out.push({ id: t.id, yo: false, nombre: (t.nombre || "Alguien") + " (salió)", ml: t.ml, hoy: 0, color: BD_GRIS, m: null }));
  return out;
}
function bdTotal(b) { return bdPersonas(b).reduce((s, p) => s + p.ml, 0); }
function bdPct(b) { return Math.min(100, Math.floor(bdTotal(b) / b.meta * 100)); }
/* Para la escena (agua.js): la meta en litros y una capa por persona */
function aguaBidonDatos(id) {
  const b = (BIDON.lista || []).find(x => x.id === id); if (!b) return null;
  return { meta: b.meta / 1000, enCurso: bdEnCurso(b) && b.estado === "activo", gente: bdPersonas(b).map(p => ({ c: p.color, l: p.ml / 1000, yo: p.yo })) };
}
/* Una buena meta: 1,5 L al día por persona en la semana, de a 5 L */
function bdSugerida(personas) { return Math.min(BD_META_MAX, Math.max(BD_META_MIN, Math.round(personas * 7 * 1500 / 5000) * 5000)); }
/* Al terminar la semana: 1 ⭐ por litro que aportaste (hasta 30) y +20 ⭐ si lo llenaron */
function bdPremio(b, mioMl) { return Math.min(BD_PREMIO_TOPE, Math.floor((mioMl || 0) / 1000)) + (b.lleno ? BD_PREMIO_LLENO : 0); }
function bdDiasQuedan(b) { return Math.max(0, Math.round((new Date(bdFin(b) + "T12:00:00") - new Date(todayISO() + "T12:00:00")) / 864e5)); }
/* "Faltan 12,5 L · quedan 3 días" o "¡Lo llenaron!" */
function bdTexto(b) {
  const tot = bdTotal(b), falta = Math.max(0, b.meta - tot), q = bdDiasQuedan(b);
  if (!bdEnCurso(b)) return b.lleno ? `¡Lo llenaron! ${litrosTxt(tot)} L entre todos` : `Terminó con ${litrosTxt(tot)} de ${litrosTxt(b.meta)} L`;
  if (tot >= b.meta) return `¡Lo llenaron! ${litrosTxt(tot)} L entre todos${q ? ` · y quedan ${q === 1 ? "1 día" : q + " días"}` : ""}`;
  return `Faltan ${litrosTxt(falta)} L · ${q === 0 ? "hoy es el último día" : q === 1 ? "queda 1 día" : `quedan ${q} días`}`;
}

async function bidonesCargar(forzar) {
  if (!CURRENT_USER || !STATE || BIDON.cargando || !BACKEND.bidonLista) return;
  if (!forzar && (BIDON.lista || BIDON.error) && Date.now() - BIDON.t < 60000) return;   // a lo más una vez por minuto
  BIDON.cargando = true;
  const r = await BACKEND.bidonLista();
  BIDON.cargando = false; BIDON.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { BIDON.error = r.error; bdRepintar(); return; }
  BIDON.error = null;
  BIDON.lista = (Array.isArray(r) ? r : []).map(bdLimpio).filter(b => b.id && bdYo(b));
  bdPremios(); bdCelebrar();
  const nueva = BIDON.lista.find(b => b.estado === "invitado" && bdEnCurso(b) && !BIDON.vistas.includes(b.id));
  BIDON.lista.forEach(b => { if (!BIDON.vistas.includes(b.id)) BIDON.vistas.push(b.id); });
  if (nueva && CURRENT !== "amigos") toast(`💧 ${bdQuienInvita(nueva)} te invita al bidón «${nueva.nombre}»`);
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  bdRepintar();
  bidonesSubir();
}
/* Lo tuyo de la semana a cada bidón en curso (solo si cambió desde la última vez) */
async function bidonesSubir() {
  if (!BIDON.lista || !BACKEND.bidonAportar || BIDON.subiendo) return;
  BIDON.subiendo = true;
  let cambio = false;
  try {
    const hoy = todayISO();
    for (const b of BIDON.lista.filter(x => x.estado === "activo" && bdEnCurso(x, hoy))) {
      const dias = bdMisDias(b, hoy), firma = hoy + JSON.stringify(dias);
      if (BIDON.subido[b.id] === firma) continue;
      const r = await BACKEND.bidonAportar(b.id, dias, hoy);
      if (!r || r.error) continue;
      BIDON.subido[b.id] = firma; cambio = true;
      if (r.recien) BACKEND.amigosAvisar("bidon-lleno", { bidon: b.id });
    }
  } finally { BIDON.subiendo = false; }
  if (cambio) await bidonesCargar(true);
}
/* Los llenos que todavía no celebraste en este equipo */
function bdVistosClave() { return "rumbo_bd_llenos_" + ((CURRENT_USER && CURRENT_USER.id) || ""); }
function bdCelebrar() {
  let vistos = []; try { vistos = JSON.parse(localStorage.getItem(bdVistosClave()) || "[]"); } catch (e) {}
  const nuevos = (BIDON.lista || []).filter(b => b.estado === "activo" && b.lleno && !vistos.includes(b.id));
  if (!nuevos.length) return;
  try { localStorage.setItem(bdVistosClave(), JSON.stringify(vistos.concat(nuevos.map(b => b.id)).slice(-30))); } catch (e) {}
  const b = nuevos[0];
  if (b.lleno >= agSumar(todayISO(), -1)) { toast(`🥂 ¡Llenaron «${b.nombre}»! ${litrosTxt(b.meta)} L entre todos`); vibrar([12, 60, 12]); }
}
function bdPremios() {
  const hoy = todayISO(), ganados = [];
  (BIDON.lista || []).filter(b => b.estado === "activo" && bdFin(b) < hoy).forEach(b => {
    const id = "bidon:" + b.id; if (ledgerVigente(STATE, id)) return;
    const yo = bdYo(b), mio = (b.totales.find(t => t.id === yo.id) || {}).ml || 0, n = bdPremio(b, mio);
    if (n > 0 && registrarMovimiento(id, n, n, "El bidón con amigos", true)) ganados.push({ b, n, mio });
  });
  if (!ganados.length) return;
  const g = ganados[0], total = ganados.reduce((s, x) => s + x.n, 0);
  toast(`🥂 Terminó «${g.b.nombre}»: aportaste ${litrosTxt(g.mio)} L · +${total} ⭐`); refreshPts(total); vibrar([12, 60, 12]);
}
function bdRepintar() {
  aguaJuntosRepintar();
  if (CURRENT === "amigos") {
    const a = document.activeElement;
    if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view"))) rerender();
  }
  if (typeof atRefrescarHoja === "function") atRefrescarHoja();
  const det = document.getElementById("bd-detalle"); if (det && det.dataset.id) { const b = (BIDON.lista || []).find(x => x.id === det.dataset.id); if (b) bdDetallePintar(b); }
}

/* ---------- Cómo se ve ---------- */
function bdGenteHtml(b) {
  const ps = bdPersonas(b);
  return ps.map(p => `<div class="bd__p"><i style="background:${p.color}"></i><span>${escapeHtml(p.nombre)}</span><b>${litrosTxt(p.ml)} L</b></div>`).join("");
}
function bdTarjetaHtml(b) {
  const e = escapeHtml, id = e(b.id), tot = bdTotal(b), curso = bdEnCurso(b), otros = b.miembros.filter(m => m.estado === "activo" && !m.yo).length;
  return `<div class="bd" data-bd="${id}">
    <canvas class="agua-cv bd__cv" data-agua="bidon" data-modo="hoja" data-bidon="${id}" style="aspect-ratio:140/210" role="img" aria-label="${e(b.nombre)}: ${e(litrosTxt(tot))} de ${e(litrosTxt(b.meta))} litros"></canvas>
    <div class="bd__info">
      <b class="bd__nombre">${e(b.nombre)}</b>
      <div class="bd__cifra" data-bd-cifra="${id}">${litrosTxt(tot)} <small>de ${litrosTxt(b.meta)} L</small></div>
      <div class="bd__gente" data-bd-gente="${id}">${bdGenteHtml(b)}</div>
      <small class="bd__texto muted" data-bd-texto="${id}">${e(bdTexto(b))}</small>
      <div class="bd__btns">${curso && otros ? `<button class="btn btn--soft" data-action="agua-bd-salud" data-id="${id}">🥂 ¡Salud!</button>` : ""}<button class="btn-ghost" data-action="agua-bd-ver" data-id="${id}">Ver</button></div>
    </div></div>`;
}
function bdInvitacionHtml(b) {
  const id = escapeHtml(b.id);
  return `<div class="bd-inv"><span class="pl-ico">${icoUI("droplet")}</span><span class="bd-inv__t"><b>${escapeHtml(b.nombre)}</b>
    <span class="text-xs muted">${escapeHtml(bdQuienInvita(b))} te invita a llenar ${litrosTxt(b.meta)} L entre todos esta semana. Sumarse es gratis.</span></span>
    <span class="bd-inv__b"><button class="btn-ghost" data-action="agua-bd-rechazar" data-id="${id}">Ahora no</button><button class="btn btn--primary" data-action="agua-bd-unirme" data-id="${id}">Unirme</button></span></div>`;
}
function bdArmarHtml() {
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  if (!amigos.length) return `<p class="text-sm muted bd-vacio">Llenen un bidón entre amigos durante la semana: cada uno suma su agua con su color. Primero suma a un amigo en Amigos.</p>
    <button class="btn btn--soft" data-action="agua-bd-amigos">${icoUI("amigos")} Ir a Amigos</button>`;
  return `<p class="text-sm muted bd-vacio">Llenen un bidón entre amigos durante la semana: cada uno suma su agua con su color y, al terminar, ⭐ según lo que aportaste.</p>
    <button class="btn btn--soft" data-action="agua-bd-nuevo">${icoUI("plus")} Armar un bidón${isOwned(BD_COS) ? "" : " · 300 ⭐"}</button>`;
}
function bdTerminadoHtml(b) {
  const yo = bdYo(b), mio = (b.totales.find(t => t.id === yo.id) || {}).ml || 0, n = bdPremio(b, mio);
  return `<button type="button" class="bd-fin" data-action="agua-bd-ver" data-id="${escapeHtml(b.id)}"><span class="pl-ico">${icoUI("droplet")}</span>
    <span class="bd-inv__t"><b>${escapeHtml(b.nombre)}</b><span class="text-xs muted">${escapeHtml(bdTexto(b))} · aportaste ${litrosTxt(mio)} L${n ? ` · +${n} ⭐` : ""}</span></span>${icoUI("chevron")}</button>`;
}
/* Lo del bidón (en «Tu agua» y en Amigos): invitaciones, los de esta semana y el último que terminó */
function bdCuerpoHtml() {
  if (!BIDON.lista) return `<p class="text-sm muted bd-vacio">${BIDON.error && BIDON.error !== "sin-servidor" ? "No se pudieron traer tus bidones." : "Trayendo tus bidones…"}</p>`;
  const l = BIDON.lista, inv = l.filter(b => b.estado === "invitado" && bdEnCurso(b)), act = l.filter(b => b.estado === "activo" && bdEnCurso(b));
  const fin = l.filter(b => b.estado === "activo" && !bdEnCurso(b)).slice(0, 1);
  return inv.map(bdInvitacionHtml).join("") + act.map(bdTarjetaHtml).join("") + (act.length ? "" : bdArmarHtml()) + fin.map(bdTerminadoHtml).join("");
}
function bdSeccionHtml() {
  if (!BACKEND.bidonLista || BIDON.error === "sin-servidor" || (typeof AMIGOS !== "undefined" && AMIGOS.error === "sin-servidor")) return "";
  return `<div class="agua-sec" id="agua-bidon"><span class="cj-sub">Con amigos · El bidón de la semana</span><div id="agua-bidon-c">${bdCuerpoHtml()}</div></div>`;
}
/* En «Tu agua»: el bidón y la fuente, al día sin volver a armar la hoja (los dibujos siguen) */
function aguaJuntosHtml() { return bdSeccionHtml() + fuenteSeccionHtml(); }
function aguaJuntosRepintar() {
  if (typeof document === "undefined") return;
  const c = document.getElementById("agua-bidon-c");
  if (c) {
    const b = (BIDON.lista || []).filter(x => x.estado === "activo" && bdEnCurso(x));
    const firma = bdCuerpoFirma();
    if (c.dataset.firma !== firma) { const h = bdCuerpoHtml(); c.innerHTML = typeof iconizar === "function" ? iconizar(h) : h; c.dataset.firma = firma; }
    else b.forEach(x => {
      const id = CSS.escape(x.id), tot = bdTotal(x);
      const cifra = c.querySelector(`[data-bd-cifra="${id}"]`), gente = c.querySelector(`[data-bd-gente="${id}"]`), texto = c.querySelector(`[data-bd-texto="${id}"]`);
      if (cifra) cifra.innerHTML = `${litrosTxt(tot)} <small>de ${litrosTxt(x.meta)} L</small>`;
      if (gente) gente.innerHTML = bdGenteHtml(x);
      if (texto) texto.textContent = bdTexto(x);
    });
  }
  const sb = document.getElementById("agua-bidon"), sf = document.getElementById("agua-fuente");
  if (sb && (BIDON.error === "sin-servidor")) sb.remove();
  if (sf && FUENTE.error === "sin-servidor") sf.remove();
  fuentePintar();
}
/* Qué bidones hay (si cambia, se vuelve a armar la sección; si no, solo los números) */
function bdCuerpoFirma() { return (BIDON.lista ? BIDON.lista.map(b => b.id + b.estado + (bdEnCurso(b) ? 1 : 0) + b.miembros.length).join() : BIDON.error || "…") + ((AMIGOS.lista && AMIGOS.lista.amigos) || []).length; }
/* Tu agua cambió: los números del bidón se ponen al día al tiro (los tuyos salen de este teléfono) */
function aguaJuntosPintarYa() { if (BIDON.lista) aguaJuntosRepintar(); }

/* ---------- La hoja de un bidón ---------- */
function bdDetalleHtml(b) {
  const e = escapeHtml, id = e(b.id), curso = bdEnCurso(b), ps = bdPersonas(b);
  const otros = ps.filter(p => !p.yo && p.m), atras = curso && otros.length && bdTotal(b) < b.meta ? otros.slice().sort((x, y) => x.ml - y.ml)[0] : null;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [], dentro = new Set(b.miembros.map(m => m.id)), libres = amigos.filter(a => !dentro.has(a.id));
  const yo = bdYo(b), mio = (b.totales.find(t => t.id === yo.id) || {}).ml || 0;
  return `<div class="bd bd--grande">
      <canvas class="agua-cv bd__cv" data-agua="bidon" data-modo="hoja" data-bidon="${id}" style="aspect-ratio:140/210" role="img" aria-label="${e(b.nombre)}"></canvas>
      <div class="bd__info">
        <div class="bd__cifra">${litrosTxt(bdTotal(b))} <small>de ${litrosTxt(b.meta)} L</small></div>
        <small class="bd__texto muted">${e(bdTexto(b))}</small>
        <div class="bd__gente">${ps.map(p => `<div class="bd__p"><i style="background:${p.color}"></i><span>${e(p.nombre)}</span><b>${litrosTxt(p.ml)} L</b></div>`).join("")}</div>
      </div></div>
    ${b.miembros.some(m => m.estado === "invitado") ? `<p class="text-xs muted">Invitados: ${e(cjNombres(b.miembros.filter(m => m.estado === "invitado").map(m => m.nombre || "Sin nombre")))}</p>` : ""}
    <div class="bd-acc">
      ${curso && otros.length ? `<button class="btn btn--primary" data-action="agua-bd-salud" data-id="${id}">🥂 ¡Salud! al grupo</button>` : ""}
      ${atras ? `<button class="btn btn--soft" data-action="agua-bd-animo" data-id="${id}" data-para="${e(atras.id)}">Ánimo a ${e(atras.nombre)}</button>` : ""}
    </div>
    <p class="text-xs muted">${curso ? `De lunes a domingo, cuenta el agua que anota cada uno en su Rumbo (hasta ${litrosTxt(BD_TOPE_DIA)} L al día). Nadie ve tus vasos ni a qué hora: solo los litros.` : `La semana terminó. ${bdPremio(b, mio) ? `Te llevaste ${bdPremio(b, mio)} ⭐: 1 por litro que aportaste${b.lleno ? " y 20 porque lo llenaron" : ""}.` : "Sin ⭐ esta vez: suman 1 por litro que aportas y 20 si lo llenan."}`}
${curso ? ` Al terminar la semana: 1 ⭐ por litro que aportaste (hasta ${BD_PREMIO_TOPE}) y +${BD_PREMIO_LLENO} ⭐ si lo llenan.` : ""}</p>
    ${curso && libres.length && b.miembros.length < 8 ? `<div class="field cj-modal"><label>Invitar a alguien más</label>
      <div class="cj-amigos" id="bd-mas">${libres.map(a => `<label class="cj-amigo"><input type="checkbox" value="${e(a.id)}">${amigosAvatar(a, 30)}<span>${e(a.nombre || "Sin nombre")}</span></label>`).join("")}</div>
      <button class="btn btn--soft mt-8" data-action="agua-bd-invitar" data-id="${id}">Invitar</button></div>` : ""}
    ${curso ? `<button class="btn-ghost btn-block mt-8" data-action="agua-bd-salir" data-id="${id}">Salir del bidón</button>` : ""}`;
}
function bdDetallePintar(b) { const el = document.getElementById("bd-detalle"); if (!el) return; const a = document.activeElement; if (a && el.contains(a) && a.type === "checkbox") return; el.innerHTML = iconizar(bdDetalleHtml(b)); }
function openBidon(id) {
  const b = (BIDON.lista || []).find(x => x.id === id); if (!b) return;
  if (b.estado === "invitado") return openModal(b.nombre, `<div class="am-confirma">${bdInvitacionHtml(b)}</div>`);
  openModal(`💧 ${b.nombre}`, `<div id="bd-detalle" data-id="${escapeHtml(b.id)}">${bdDetalleHtml(b)}</div>`);
}

/* ---------- Armar un bidón ---------- */
function openBidonForm(pre) {
  if (!isOwned(BD_COS)) {
    if (typeof openFicha === "function" && typeof tiendaTodos === "function" && tiendaTodos().some(x => x.key === "cos:" + BD_COS)) return openFicha("cos:" + BD_COS);
    return toast("El bidón está en la Tienda (300 ⭐). Sumarse al de un amigo es gratis.", true);
  }
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  if (!amigos.length) return toast("Primero suma a un amigo en Amigos", true);
  const sel = (pre || []).filter(x => amigos.some(a => a.id === x)), sug = bdSugerida(1 + Math.max(2, sel.length));
  BD_META_TOCADA = false;
  openModal("💧 Un bidón con amigos", `
    <div class="field"><label for="bd-nombre">Nombre</label><input class="input" id="bd-nombre" maxlength="40" value="El bidón de la semana"></div>
    <div class="field cj-modal"><label>Con quién</label>
      <div class="cj-amigos" id="bd-amigos">${amigos.map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}" ${sel.includes(a.id) ? "checked" : ""} onchange="bdFormCambia()">${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div></div>
    <div class="field"><label>Meta de la semana</label>${elContador("bd-meta", sug, { min: BD_META_MIN, max: BD_META_MAX, paso: 5000, fmtFn: "bdLitrosFmt", fmt: bdLitrosFmt, unidad: "L", label: "Meta del bidón", fn: "bdMetaElegir" })}
      <small class="text-xs muted" id="bd-meta-ayuda">${bdMetaAyuda(1 + Math.max(2, sel.length))}</small></div>
    <p class="text-xs muted">Es de esta semana (de lunes a domingo) y cuenta el agua que anota cada uno, también la de los días que ya pasaron. Nadie ve tus vasos: solo los litros.</p>
    <button class="btn btn--primary btn-block mt-8" data-action="agua-bd-crear">Armar el bidón</button>`);
}
function bdLitrosFmt(ml) { return litrosTxt(ml); }
let BD_META_TOCADA = false;
function bdMetaElegir() { BD_META_TOCADA = true; }
function bdMetaAyuda(n) { return `Para ${n} personas, ${litrosTxt(bdSugerida(n))} L es un buen desafío: 1,5 L al día cada uno.`; }
/* Al elegir amigos: si no tocaste la meta, se ajusta a cuántos son */
function bdFormCambia() {
  const n = 1 + document.querySelectorAll("#bd-amigos input:checked").length, ay = document.getElementById("bd-meta-ayuda");
  if (ay) ay.textContent = bdMetaAyuda(Math.max(2, n));
  if (BD_META_TOCADA) return;
  const c = document.querySelector('[data-el="contador"][data-el-id="bd-meta"]'), inp = document.getElementById("bd-meta");
  if (!c || !inp) return;
  const v = bdSugerida(Math.max(2, n)); c.dataset.v = v; inp.value = v; if (typeof elContadorPintar === "function") elContadorPintar(c);
}
async function bidonCrear() {
  if (BIDON.guardando) return;
  const nombre = (val("bd-nombre") || "").trim(), meta = +val("bd-meta"), amigos = [...document.querySelectorAll("#bd-amigos input:checked")].map(i => i.value);
  if (!nombre) return toast("Ponle un nombre", true);
  if (!amigos.length) return toast("Elige al menos un amigo", true);
  if (amigos.length > 7) return toast("Puedes armarlo con hasta 7 amigos", true);
  BIDON.guardando = true;
  try {
    const r = await BACKEND.bidonCrear(nombre, meta, amigos, todayISO());
    if (r && r.error) return toast(bdTextoError(r.error), true);
    BACKEND.amigosAvisar("bidon-invita", { bidon: r.id });
    closeModal(); BD_META_TOCADA = false;
    toast(`💧 Le avisamos a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}. Tu agua de la semana ya cuenta.`);
  } finally { BIDON.guardando = false; }
  await bidonesCargar(true);
}
async function bidonResponder(id, acepta) {
  const r = await BACKEND.bidonResponder(id, acepta, todayISO());
  if (r && r.error) return toast(bdTextoError(r.error), true);
  if (acepta && r.r === "unido") {
    const b = (BIDON.lista || []).find(x => x.id === id);
    toast(`💧 Te sumaste a «${b ? b.nombre : "el bidón"}». Tu agua de la semana ya cuenta.`);
    BACKEND.amigosAvisar("bidon-acepta", { bidon: id });
  }
  closeModal();
  await bidonesCargar(true);
}
async function bidonSalir(id) {
  const b = (BIDON.lista || []).find(x => x.id === id);
  if (!confirm(`¿Salir de «${b ? b.nombre : "este bidón"}»? Lo que aportaste sigue en el bidón para los demás.`)) return;
  const r = await BACKEND.bidonSalir(id);
  if (r && r.error) return toast(bdTextoError(r.error), true);
  closeModal(); toast("Saliste del bidón");
  delete BIDON.subido[id];
  await bidonesCargar(true);
}
async function bidonInvitar(id) {
  const amigos = [...document.querySelectorAll("#bd-mas input:checked")].map(i => i.value);
  if (!amigos.length) return toast("Elige a quién invitar", true);
  const r = await BACKEND.bidonInvitar(id, amigos);
  if (r && r.error) return toast(bdTextoError(r.error), true);
  BACKEND.amigosAvisar("bidon-invita", { bidon: id });
  toast(`💧 Le avisamos a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}`);
  await bidonesCargar(true);
}
/* ¡Salud!: un brindis al grupo (un ánimo a cada uno, que les llega como aviso) */
async function bidonSalud(id) {
  const b = (BIDON.lista || []).find(x => x.id === id); if (!b) return;
  const otros = b.miembros.filter(m => m.estado === "activo" && !m.yo);
  if (!otros.length) return toast("Todavía no se suma nadie más", true);
  AGUA_MOTOR.brindar(id); vibrar([10, 40, 10]);
  const msg = `🥂 ¡Salud! Vamos en ${litrosTxt(bdTotal(b))} de ${litrosTxt(b.meta)} L en «${b.nombre}».`;
  let ok = 0, err = null;
  for (const m of otros) {
    const r = await BACKEND.amigosAnimo(m.id, msg);
    if (r && !r.error) { ok++; BACKEND.amigosAvisar("animo", { id: r.id }); } else err = r && r.error;
  }
  if (!ok) return toast(err === "limite" ? "Ya brindaste mucho hoy: mañana se puede de nuevo" : bdTextoError(err), true);
  toast(`🥂 Le mandaste ¡Salud! a ${cjNombres(otros.map(m => m.nombre || "tu amigo"))}`);
}
async function bidonAnimo(id, para) {
  const b = (BIDON.lista || []).find(x => x.id === id), m = b && b.miembros.find(x => x.id === para); if (!m) return;
  const r = await BACKEND.amigosAnimo(para, `💧 ¡Vamos con «${b.nombre}»! Un vaso ahora y seguimos llenándolo.`);
  if (r && r.error) return toast(r.error === "limite" ? "Ya le mandaste varios hoy" : bdTextoError(r.error), true);
  BACKEND.amigosAvisar("animo", { id: r.id });
  toast(`💪 Le mandaste ánimo a ${m.nombre || "tu amigo"}`);
}
function bdTextoError(e) {
  return {
    "sin-servidor": "El bidón todavía no está activo en el servidor.",
    amigos: "Elige al menos un amigo (hasta 7).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no estás en este bidón.",
    limite: "Llegaste al máximo: hasta 8 personas por bidón, 3 bidones armados por semana y 5 bidones a la vez.",
    nombre: "Ponle un nombre de hasta 40 letras.",
    meta: "La meta va de 10 a 200 L.",
  }[e] || (typeof amigosTextoError === "function" ? amigosTextoError(e) : "No se pudo. Prueba de nuevo.");
}

/* ============ Acciones (data-action="agua-bd-…" y "agua-fu-…", desde aguaAccion) ============ */
function aguaJuntosAccion(a, d, el) {
  if (a === "agua-bd-nuevo") { closeModal(); return openBidonForm(d.amigo ? [d.amigo] : []); }
  if (a === "agua-bd-crear") return bidonCrear();
  if (a === "agua-bd-ver") return openBidon(d.id);
  if (a === "agua-bd-unirme") return bidonResponder(d.id, true);
  if (a === "agua-bd-rechazar") return bidonResponder(d.id, false);
  if (a === "agua-bd-salir") return bidonSalir(d.id);
  if (a === "agua-bd-salud") return bidonSalud(d.id);
  if (a === "agua-bd-animo") return bidonAnimo(d.id, d.para);
  if (a === "agua-bd-invitar") return bidonInvitar(d.id);
  if (a === "agua-bd-amigos") { closeModal(); return go("amigos"); }
  if (a === "agua-fu-on") {
    Object.assign(aguaDatos(), { fuente: !!(el && el.checked), ts: Date.now() }); saveState();
    fuentePintar(); aguaJuntosSubir();
    return toast(el && el.checked ? "💧 Tus vasos suman a la fuente (solo el total)" : "Tus vasos ya no suman a la fuente");
  }
}

/* ============ Al entrar, al volver a la app y con «Tu agua» abierta ============ */
/* Al salir de la cuenta: nada del bidón ni de la fuente queda para quien entre después */
function aguaJuntosOlvidar() {
  clearTimeout(AGUA_JUNTOS_T); clearInterval(FUENTE.reloj);
  Object.assign(FUENTE, { dato: null, t: 0, cargando: false, error: null, otras: 0, reloj: 0 });
  Object.assign(BIDON, { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [], subido: {}, subiendo: false });
}
function aguaJuntosAlEntrar() {
  setTimeout(() => { aguaPendientes(); fuenteCargar(true).then(() => aguaJuntosSubir()); bidonesCargar(false); }, 1200);
}
function aguaJuntosAlVolver() { aguaPendientes(); fuenteCargar(false); }
/* Con «Tu agua» abierta: la fuente al día cada 30 segundos (así llegan las gotas de los demás) */
function aguaJuntosHojaAbierta() {
  fuenteCargar(false); bidonesCargar(false);
  clearInterval(FUENTE.reloj);
  FUENTE.reloj = setInterval(() => { if (!document.getElementById("agua-fuente") && !document.getElementById("agua-bidon")) { clearInterval(FUENTE.reloj); return; } if (!document.hidden) { fuenteCargar(false); bidonesCargar(false); } }, 30000);
}
