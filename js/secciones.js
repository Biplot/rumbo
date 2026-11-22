/* ============================================================
   RUMBO · Tus secciones y «Descubrir» (v154)
   En Más, arriba van TUS secciones (en tu orden) y abajo «Descubrir», con las demás en gris y un «+».
   Una sección es tuya si guardaste algo en ella (aparece sola con el primer dato), si la agregaste con «+»
   o si la despertó tu primera semana. Ocultarla la manda a Descubrir y no borra nada.
   Datos: settings.menu = { ocultos: [ids], fijadas: [ids], orden: [ids], ts }.
   Objetivos, Ritual y Diario siempre están (se pueden reordenar); Amigos está hasta que lo ocultes.
   Funciones puras (sin DOM) para poder probarlas: tests/secciones.test.mjs.
   ============================================================ */

const SECC_FIJAS = ["metas", "ritual", "diario"];
const SECC_MAS = ["tendencias", "finanzas", "salud", "rueda", "lecturas", "relaciones", "listas", "notas"];   // v154: Calendario vive en el Diario y Aprendizajes es un tipo de lista
const SECC_TODAS = SECC_FIJAS.concat(["amigos"], SECC_MAS);   // las de Más, en el orden de siempre

function seccMenu(S) {
  const m = (S && S.settings && S.settings.menu) || {};
  return { ocultos: Array.isArray(m.ocultos) ? m.ocultos : [], fijadas: Array.isArray(m.fijadas) ? m.fijadas : [], orden: Array.isArray(m.orden) ? m.orden : [] };
}
/* Todos los años con datos (el base y los guardados en S.anios) */
function seccAnios(S, k) {
  const out = [S[k]];
  Object.values(S.anios || {}).forEach(a => { if (a && a[k]) out.push(a[k]); });
  return out.filter(Boolean);
}
const seccVivos = l => (Array.isArray(l) ? l : []).filter(x => x && !x.borrado && !x.borrada && !x.quitado);

/* ¿Hay algo guardado en esta sección? (lo que la hace aparecer sola en tus secciones) */
function seccionConDatos(id, S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return false;
  try {
    if (id === "finanzas") {
      const f = S.finanzas || {};
      if ((+f.metaAnual || 0) > 0 || (+f.metaMensual || 0) > 0 || (f.porque || "").trim() || seccVivos(f.gastos).length) return true;
      if (seccAnios(S, "finanzas").some(x => (+x.metaAnual || 0) > 0 || (x.meses || []).some(m => m && ((+m.ingreso || 0) || (+m.gasto || 0) || (+m.ahorro || 0) || (+m.metaAhorro || 0))))) return true;
      const alc = S.alcancias || {}, fuera = new Set(alc.borradas || []);
      if ((alc.lista || []).some(a => a && !fuera.has(a.id))) return true;
      const des = S.deseos || {}, fueraD = new Set(des.borrados || []);
      return (des.lista || []).some(d => d && !fueraD.has(d.id));
    }
    if (id === "salud") {
      if ((S.salud || {}).pesoObjetivo) return true;
      if (seccAnios(S, "salud").some(x => (x.meses || []).some(m => m && ((m.objetivo || "").trim() || (+m.diasEntren || 0) || (+m.diasCocina || 0) || (m.notas || "").trim() || (m.recetaNombre || "").trim() || m.peso != null)))) return true;
      return seccVivos((S.entrenamiento || {}).registro).length > 0;
    }
    if (id === "rueda") return seccAnios(S, "rueda").some(x => (x.meses || []).some(m => Array.isArray(m) && m.some(n => (+n || 0) > 0)));
    if (id === "lecturas") return seccVivos(S.lecturas).length > 0;
    if (id === "relaciones") return seccVivos((S.vida || {}).relaciones).length > 0;
    if (id === "listas") return seccVivos((S.vida || {}).listas).some(l => l.tipo !== "deseos" && (seccVivos(l.items).length > 0)) || seccVivos(S.aprendizajes).length > 0 || !!(S.settings || {}).aprendLista;
    if (id === "aprendizajes") return seccVivos(S.aprendizajes).length > 0;
    if (id === "notas") return seccVivos(S.postits).length > 0 || (S.notas || []).some(c => c && seccVivos(c.notas || c.items).length > 0);
    if (id === "calendario") return Object.values(S.eventos || {}).some(l => Array.isArray(l) ? l.length > 0 : !!l) || !!((S.settings || {}).gcal || {}).conectado;
    // Tendencias no guarda nada propio: aparece cuando ya hay qué mostrar (una semana de días cerrados)
    if (id === "tendencias") return Object.values((S.ritual || {}).dias || {}).filter(r => r && r.cerrado).length >= 7;
  } catch (e) { return false; }
  return false;
}

/* ¿La despertó la primera semana? (las áreas que eligió y los pasos ya hechos; «*» ya no despierta todo) */
function seccionDespierta(id, S) {
  if (typeof usaPrimeraSemana !== "function" || typeof psDespiertas !== "function" || !usaPrimeraSemana(S)) return false;
  try { return psDespiertas(S).set.has(id); } catch (e) { return false; }
}

/* ¿Está en tus secciones? */
function seccionTuya(id, S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (SECC_FIJAS.includes(id)) return true;
  if (!SECC_TODAS.includes(id)) return true;   // lo que no es de Más (Inicio, Semana, Hábitos…) siempre está
  const m = seccMenu(S);
  if (m.ocultos.includes(id)) return false;
  if (id === "amigos") return true;
  return m.fijadas.includes(id) || seccionConDatos(id, S) || seccionDespierta(id, S);
}

/* Tus secciones de Más, en tu orden (lo que no ordenaste va al final, en el orden de siempre) */
function seccionesTuyas(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  const orden = seccMenu(S).orden, pos = id => { const i = orden.indexOf(id); return i < 0 ? 1000 + SECC_TODAS.indexOf(id) : i; };
  return SECC_TODAS.filter(id => seccionTuya(id, S)).sort((a, b) => pos(a) - pos(b));
}
/* Las que esperan en «Descubrir» */
function seccionesDescubrir(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  return SECC_TODAS.filter(id => !seccionTuya(id, S));
}

/* Agregar (con «+») o quitar (a Descubrir) una sección. Devuelve true si cambió algo. */
function seccionAgregar(id, S) {
  S = S || STATE;
  if (!SECC_TODAS.includes(id) || SECC_FIJAS.includes(id)) return false;
  const m = seccMenu(S), antes = seccionTuya(id, S);
  S.settings.menu = Object.assign({}, S.settings.menu, { ocultos: m.ocultos.filter(x => x !== id), fijadas: m.fijadas.includes(id) || id === "amigos" ? m.fijadas : m.fijadas.concat([id]), ts: Date.now() });
  return !antes;
}
function seccionQuitar(id, S) {
  S = S || STATE;
  if (!SECC_TODAS.includes(id) || SECC_FIJAS.includes(id)) return false;
  const m = seccMenu(S), antes = seccionTuya(id, S);
  S.settings.menu = Object.assign({}, S.settings.menu, { ocultos: m.ocultos.includes(id) ? m.ocultos : m.ocultos.concat([id]), fijadas: m.fijadas.filter(x => x !== id), ts: Date.now() });
  return antes;
}
/* Mover una de tus secciones un lugar (dir = -1 sube, 1 baja) */
function seccionMover(id, dir, S) {
  S = S || STATE;
  const l = seccionesTuyas(S), i = l.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= l.length) return false;
  [l[i], l[j]] = [l[j], l[i]];
  S.settings.menu = Object.assign({}, S.settings.menu, { orden: l, ts: Date.now() });
  return true;
}

/* Al guardar el primer dato en una sección, aparece sola: se avisa una vez y el menú se redibuja */
let SECC_ANTES = null;
function seccionesRevisar() {
  if (typeof STATE === "undefined" || !STATE) return;
  const ahora = seccionesTuyas(STATE).join(",");
  const prev = SECC_ANTES;
  SECC_ANTES = ahora;   // antes de redibujar: buildNav vuelve a llamar aquí
  if (prev == null || ahora === prev) return;
  const antes = new Set(prev.split(",")), nuevas = ahora.split(",").filter(id => id && !antes.has(id) && seccionConDatos(id, STATE));
  if (typeof buildNav === "function") buildNav();
  if (nuevas.length && typeof toast === "function" && typeof ROUTE_MAP !== "undefined" && ROUTE_MAP[nuevas[0]])
    toast(`📌 ${ROUTE_MAP[nuevas[0]].label} quedó en tus secciones de Más`);
}
/* Al cambiar de cuenta, se parte de cero (sin avisar de lo que ya estaba) */
function seccionesReiniciar() { SECC_ANTES = null; }
