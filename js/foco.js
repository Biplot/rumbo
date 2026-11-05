/* ============================================================
   RUMBO · ⏱️ Foco: un modo foco que sabe para qué es tu tiempo (v140)
   Reemplaza al «Modo enfoque» de la Tienda (ahora es gratis). Cada sesión sabe a qué le das tiempo
   y lo suma ahí: una tarea (y su prioridad y objetivo), un hábito con duración, un objetivo del mes,
   el libro que lees o un objetivo en conjunto que se mide en horas.

   Datos (en tu documento, se fusionan entre equipos):
     STATE.enfoque.sesiones: [{ id, fecha, ts, ini, hora, min, real, completa, tipo, ref, titulo,
                                objId, area, habId, libroId, tareaId, conc, ritmo, con }]   (por id)
     STATE.enfoque.sigue:    { "<tipo>:<ref>": { txt, ts } }   lo que anotaste en «¿Qué sigue?»   (por clave)
     STATE.enfoque.pref:     { min, ritmo, estilo, sonido, modo, ts }   lo último que usaste   (la más nueva)
   La sesión en curso vive en este equipo (localStorage) con la hora en que termina cada tramo, así
   sobrevive a recargar o bloquear la pantalla. Con sesión en Supabase, el servidor avisa al terminar
   aunque cierres la app (supabase/foco.sql y notifier/foco.mjs, revisa cada 5 minutos).

   Reglas: nada te lo pide, no castiga (terminar antes guarda lo que hiciste) y pocas ⭐: +5 por sesión
   completa, hasta 4 al día (ledger "foco:<id>").
   ============================================================ */
const FOCO_MINS = [10, 15, 25, 45, 50, 90];
const FOCO_ESTRELLAS = 5, FOCO_TOPE_DIA = 4;
const FOCO_RELOJES = [
  { v: "anillo", n: "Anillo" }, { v: "arena", n: "Reloj de arena", cos: "foco-arena" },
  { v: "vela", n: "Vela", cos: "foco-vela" }, { v: "luna", n: "Luna", cos: "foco-luna" },
];
const FOCO_SONIDOS = [
  { v: "", n: "Silencio" }, { v: "suave", n: "Ruido suave" },
  { v: "lluvia", n: "Lluvia", cos: "foco-lluvia" }, { v: "mar", n: "Mar", cos: "foco-mar" },
];
const FOCO_CONC = [[1, "Me costó"], [2, "Bien"], [3, "Muy enfocado"]];

/* -------- Datos -------- */
function focoDatos(S) {
  S = S || STATE;
  if (!S.enfoque || typeof S.enfoque !== "object" || Array.isArray(S.enfoque)) S.enfoque = {};
  const e = S.enfoque;
  if (!Array.isArray(e.sesiones)) e.sesiones = [];
  if (!e.sigue || typeof e.sigue !== "object" || Array.isArray(e.sigue)) e.sigue = {};
  if (!e.pref || typeof e.pref !== "object" || Array.isArray(e.pref)) e.pref = {};
  return e;
}
function sesionesEnfoque(S) { return focoDatos(S).sesiones; }
function focoSesiones(S, desde, hasta, f) { return sesionesEnfoque(S).filter(x => x && !x.borrada && x.fecha >= desde && x.fecha <= hasta && (!f || f(x))); }
/* Minutos de foco en [desde, hasta] (con un filtro opcional) */
function minutosFoco(S, desde, hasta, f) { return focoSesiones(S, desde, hasta, f).reduce((a, x) => a + (+x.real || 0), 0); }
function sesionesCompletas(S) { return sesionesEnfoque(S).filter(x => !x.borrada && x.completa).length; }
function fmtFoco(min) { min = Math.round(+min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? " " + m : ""}` : `${m} min`; }
/* "6 h 40" para una línea corta; "40 min" si no llega a una hora */
function focoPref(S) {
  const p = focoDatos(S).pref;
  return {
    min: FOCO_MINS.includes(+p.min) ? +p.min : 25, ritmo: ["una", "ciclos", "libre"].includes(p.ritmo) ? p.ritmo : "una",
    estilo: FOCO_RELOJES.some(r => r.v === p.estilo) ? p.estilo : "anillo", sonido: FOCO_SONIDOS.some(s => s.v === p.sonido) ? p.sonido : "",
    modo: p.modo === "barra" ? "barra" : "completa", ts: +p.ts || 0,
  };
}
function focoGuardarPref(S, cambios) { const e = focoDatos(S); e.pref = Object.assign({}, focoPref(S), cambios, { ts: Date.now() }); return e.pref; }
/* Lo que usas tiene que ser tuyo (los de la Tienda): si no, el de fábrica */
function focoTieneCos(id, S) { if (!id) return true; S = S || STATE; return ((S.gamif && S.gamif.owned) || []).includes(id); }
function focoEstiloUsable(v, S) { const r = FOCO_RELOJES.find(x => x.v === v); return r && focoTieneCos(r.cos, S) ? v : "anillo"; }
function focoSonidoUsable(v, S) { const r = FOCO_SONIDOS.find(x => x.v === v); return r && focoTieneCos(r.cos, S) ? v : ""; }

/* Los tramos de una sesión: [minutos, "f" foco | "d" descanso | "l" descanso largo | "x" libre] */
function focoTramos(ritmo, min) {
  min = Math.max(1, Math.min(240, Math.round(+min || 25)));
  if (ritmo === "libre") return [[0, "x"]];
  if (ritmo !== "ciclos") return [[min, "f"]];
  const d = min >= 45 ? 10 : 5, out = [];
  for (let i = 0; i < 4; i++) { out.push([min, "f"]); out.push(i < 3 ? [d, "d"] : [15, "l"]); }
  return out;
}
function focoTramosMin(tramos) { return tramos.filter(t => t[1] === "f").reduce((a, t) => a + t[0], 0); }
/* "4 × 25 min · descansos de 5 · uno largo de 15 · 2 h 10 en total" */
function focoRitmoTxt(ritmo, min) {
  if (ritmo === "libre") return "Cuenta hacia arriba hasta que pares";
  if (ritmo !== "ciclos") return `Una sesión de ${min} min`;
  const t = focoTramos("ciclos", min), total = t.reduce((a, x) => a + x[0], 0);
  return `4 × ${min} min · descansos de ${t[1][0]} · uno largo de 15 · ${fmtFoco(total)} en total`;
}

/* -------- A qué le das tiempo -------- */
function focoClave(d) { return d ? d.tipo + ":" + (d.ref || "") : ""; }
/* El objetivo del mes detrás de una tarea: la tarea viene de una prioridad de la semana que lo empuja */
function focoObjDeTarea(S, fecha, t) {
  if (!t || !t.prioridad || typeof ritualSemana !== "function") return "";
  const r = ritualSemana(agLunes(fecha), S), p = ((r && r.apertura && r.apertura.prioridades) || []).find(x => x.id === t.prioridad);
  return (p && p.objId) || "";
}
function focoObjetivo(S, id) { return id && typeof objetivoDe === "function" ? objetivoDe(id, S) : null; }
/* Minutos de un hábito con duración en un día */
function focoMinHabito(S, hid, iso) { return minutosFoco(S, iso, iso, x => x.habId === hid); }
function focoHabitosConTiempo(S) { return (S.habitos.defs || []).filter(h => h && !h.pausado && +h.minutos > 0 && (typeof hmMeta !== "function" || hmMeta(h) === "hacer")); }
/* Todo lo que puedes elegir hoy, en grupos (lo que más sirve, primero) */
function focoDestinos(S, hoy) {
  S = S || STATE; hoy = hoy || todayISO();
  const grupos = [], y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1;
  const tareas = (typeof tareasDelDia === "function" ? tareasDelDia(hoy, S) : []).filter(t => estadoTarea(t) === "pendiente")
    .sort((a, b) => (b.esSapo ? 1 : 0) - (a.esSapo ? 1 : 0) || (b.prioridad ? 1 : 0) - (a.prioridad ? 1 : 0));
  const enTareas = new Set(tareas.map(t => t.prioridad).filter(Boolean));
  const hoyItems = tareas.map(t => {
    const objId = focoObjDeTarea(S, hoy, t), o = focoObjetivo(S, objId);
    return { tipo: "tarea", ref: t.id, fecha: hoy, titulo: t.txt, bocado: !!t.esSapo, objId, area: o && o.area != null ? o.area : null,
      icon: t.esSapo ? BOCADO.emoji : t.prioridad ? "🎯" : "☐", sub: [t.esSapo ? "Primer bocado" : t.prioridad ? "Prioridad de la semana" : "Tarea de hoy", o ? "🎯 " + o.texto : ""].filter(Boolean).join(" · ") };
  });
  if (hoyItems.length) grupos.push({ k: "hoy", t: "Hoy", items: hoyItems });
  const habs = focoHabitosConTiempo(S).map(h => {
    const hecho = focoMinHabito(S, h.id, hoy), falta = Math.max(0, +h.minutos - hecho), listo = typeof habitDoneDate === "function" && habitDoneDate(h.id, agDate(hoy));
    return { tipo: "habito", ref: h.id, habId: h.id, titulo: h.nombre, icon: h.icon, area: h.area != null ? h.area : null, min: listo ? +h.minutos : (falta || +h.minutos),
      sub: listo ? `${h.minutos} min · ya lo hiciste hoy` : hecho ? `${hecho} de ${h.minutos} min hoy` : `${h.minutos} min` };
  });
  if (habs.length) grupos.push({ k: "habitos", t: "Hábitos con tiempo", items: habs });
  const r = typeof ritualSemana === "function" ? ritualSemana(agLunes(hoy), S) : null;
  const prios = ((r && r.apertura && r.apertura.prioridades) || []).filter(p => p && p.id && String(p.texto || "").trim() && !enTareas.has(p.id)).map(p => {
    const o = focoObjetivo(S, p.objId);
    return { tipo: "prioridad", ref: p.id, titulo: p.texto, objId: p.objId || "", area: o && o.area != null ? o.area : null, icon: "🎯", sub: o ? "🎯 " + o.texto : "Prioridad de la semana" };
  });
  if (prios.length) grupos.push({ k: "semana", t: "Prioridades de la semana", items: prios });
  const objs = (((datosAnio(S, y).metas || {}).mensuales || [])[m] || []).filter(o => o && !o.done && String(o.texto || "").trim()).map(o => {
    const min = focoMinObjetivo(S, o.id, y, m);
    return { tipo: "objetivo", ref: o.id, objId: o.id, titulo: o.texto, area: o.area != null ? o.area : null, icon: "🎯", sub: min ? `${fmtFoco(min)} este mes` : "Objetivo de " + MESES[m].toLowerCase() };
  });
  if (objs.length) grupos.push({ k: "objetivos", t: "Objetivos de " + MESES[m].toLowerCase(), items: objs });
  const libros = (S.lecturas || []).filter(l => l && l.estado === "leyendo").map(l => ({ tipo: "libro", ref: l.id, libroId: l.id, titulo: l.titulo, icon: "📖",
    area: null, sub: +l.pagina ? `Ibas en la página ${+l.pagina}${+l.paginas ? " de " + +l.paginas : ""}` : "Leer" }));
  if (libros.length) grupos.push({ k: "libros", t: "Lo que estás leyendo", items: libros });
  const juntos = (typeof OBJ !== "undefined" && Array.isArray(OBJ.lista) ? OBJ.lista : []).filter(o => o && o.estado === "activo" && !o.cumplido && /^horas?$/i.test(String(o.unidad || "").trim()))
    .map(o => ({ tipo: "juntos", ref: o.id, titulo: o.nombre, icon: "👥", area: null, sub: "Objetivo en conjunto · en horas" }));
  if (juntos.length) grupos.push({ k: "juntos", t: "Objetivos con amigos", items: juntos });
  return grupos;
}
function focoDestinoDe(S, clave, hoy) {
  for (const g of focoDestinos(S, hoy)) { const x = g.items.find(i => focoClave(i) === clave); if (x) return x; }
  return null;
}

/* -------- Lo que ya sumaste -------- */
function focoMesRango(y, m) { const ym = `${y}-${String(m + 1).padStart(2, "0")}`; return [ym + "-01", ym + "-31"]; }
function focoMinObjetivo(S, id, y, m) { const [a, b] = focoMesRango(y, m); return minutosFoco(S, a, b, x => x.objId === id); }
/* Las últimas 4 semanas de un objetivo (de lunes a domingo, la última es esta) */
function focoSemanasObjetivo(S, id, hoy) {
  const L = agLunes(hoy || todayISO());
  return [-3, -2, -1, 0].map(k => { const l = agSumar(L, 7 * k); return { lunes: l, min: minutosFoco(S, l, agSumar(l, 6), x => x.objId === id) }; });
}
/* Minutos de un área de tu Rueda en un mes: lo que hiciste por objetivos y hábitos con esa área */
function focoMinArea(S, y, m, k) { const [a, b] = focoMesRango(y, m); return minutosFoco(S, a, b, x => x.area === k); }
/* Tu mejor hora: el tramo de 2 horas con más minutos de foco (con al menos 3 sesiones y 60 min) */
function focoMejorHora(S, desde, hasta) {
  const xs = focoSesiones(S, desde, hasta, x => x.hora != null && +x.real > 0);
  if (xs.length < 3 || xs.reduce((a, x) => a + +x.real, 0) < 60) return null;
  const por = {}; xs.forEach(x => { const h = Math.floor(+x.hora / 2) * 2; por[h] = (por[h] || 0) + +x.real; });
  const h = +Object.keys(por).sort((a, b) => por[b] - por[a] || a - b)[0];
  return [h, h + 2];
}
/* Por objetivo, en un mes (los que tienen minutos, de más a menos) */
function focoPorObjetivo(S, y, m) {
  const [a, b] = focoMesRango(y, m), por = {};
  focoSesiones(S, a, b, x => x.objId).forEach(x => { por[x.objId] = (por[x.objId] || 0) + +x.real; });
  return Object.keys(por).map(id => ({ id, o: focoObjetivo(S, id), min: por[id] })).filter(x => x.o).sort((p, q) => q.min - p.min);
}
/* ⭐ por una sesión completa: +5, hasta 4 al día */
function focoEstrellasHoy(S, iso) { return ((S.gamif && S.gamif.ledger) || []).filter(x => x && !x.anulado && String(x.id).startsWith("foco:") && x.fecha === iso).length; }
function focoDarEstrellas(S, rec) {
  if (!rec || !rec.completa || +rec.real < 10 || focoEstrellasHoy(S, rec.fecha) >= FOCO_TOPE_DIA) return false;
  if (!ledgerRegistrar(S, "foco:" + rec.id, FOCO_ESTRELLAS, FOCO_ESTRELLAS, "Sesión de foco")) return false;
  const m = S.gamif.ledger.find(x => x.id === "foco:" + rec.id); if (m) m.fecha = rec.fecha;
  return true;
}

/* -------- La sesión en curso (este equipo) --------
   { v: 2, id, fecha, ini, destino, ritmo, min, tramos, tramo, tIni, fin, pausa, restante, focoMs, modo, estilo, sonido, sala, pend } */
function focoClaveLocal() { return "rumbo-enfoque:" + ((typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.id) || "local"); }
function focoActiva() {
  let a = null; try { a = JSON.parse(localStorage.getItem(focoClaveLocal()) || "null"); } catch (e) { return null; }
  if (!a || typeof a !== "object") return null;
  if (a.v !== 2) {   // una sesión del modo enfoque de antes (v139 y anteriores)
    const len = (+a.min || 25) * 60000, fin = +a.fin || Date.now();
    a = { v: 2, id: a.id || uid(), fecha: a.fecha || todayISO(), ini: +a.ini || fin - len, destino: { tipo: a.tareaId ? "tarea" : "libre", ref: a.tareaId || "", fecha: a.fecha, titulo: a.titulo || "Tiempo de foco", bocado: !!a.bocado },
      ritmo: "una", min: +a.min || 25, tramos: [[+a.min || 25, "f"]], tramo: 0, tIni: fin - len, fin, pausa: !!a.pausa, restante: +a.restante || 0, focoMs: 0, modo: "completa", estilo: "anillo", sonido: "", pend: 0 };
  }
  return a;
}
function focoGuardarActiva(a) { try { a ? localStorage.setItem(focoClaveLocal(), JSON.stringify(a)) : localStorage.removeItem(focoClaveLocal()); } catch (e) {} }
function focoTramoAct(a) { return a.tramos[Math.min(a.tramo, a.tramos.length - 1)]; }
function focoEsLibre(a) { return focoTramoAct(a)[1] === "x"; }
/* Lo que lleva el tramo de ahora (ms) y lo que le falta */
function focoLleva(a, ahora) { ahora = ahora || Date.now(); return focoEsLibre(a) ? (a.pausa ? a.restante : ahora - a.tIni) : focoTramoAct(a)[0] * 60000 - focoRestante(a, ahora); }
function focoRestante(a, ahora) { ahora = ahora || Date.now(); if (focoEsLibre(a)) return 0; return a.pausa ? a.restante : Math.max(0, a.fin - ahora); }
/* Avanza los tramos que ya terminaron (también los que pasaron con la app cerrada). Devuelve { cambio, terminada } */
function focoAvanzar(a, ahora) {
  ahora = ahora || Date.now(); let cambio = false;
  if (a.pausa || focoEsLibre(a)) return { cambio, terminada: false };
  while (a.tramo < a.tramos.length && ahora >= a.fin) {
    const t = a.tramos[a.tramo];
    if (t[1] === "f") a.focoMs += t[0] * 60000;
    a.tramo++; cambio = true;
    if (a.tramo >= a.tramos.length) return { cambio, terminada: true };
    a.tIni = a.fin; a.fin = a.tIni + a.tramos[a.tramo][0] * 60000;
  }
  return { cambio, terminada: false };
}
/* Minutos de foco que llevas (sin los descansos) */
function focoMinHechos(a, ahora) {
  if (a.tramo >= a.tramos.length) return Math.round(a.focoMs / 60000);
  const t = focoTramoAct(a), enCurso = t[1] === "f" || t[1] === "x" ? focoLleva(a, ahora) : 0;
  return Math.floor((a.focoMs + Math.max(0, enCurso)) / 60000);
}
function focoPausar(a, ahora) {
  ahora = ahora || Date.now();
  if (a.pausa) { if (focoEsLibre(a)) a.tIni = ahora - a.restante; else { a.fin = ahora + a.restante; a.tIni = a.fin - focoTramoAct(a)[0] * 60000; } a.pausa = false; }
  else { a.restante = focoEsLibre(a) ? ahora - a.tIni : Math.max(0, a.fin - ahora); a.pausa = true; }
  return a;
}
/* Salta el descanso de ahora */
function focoSaltar(a, ahora) {
  ahora = ahora || Date.now(); const t = focoTramoAct(a); if (!t || (t[1] !== "d" && t[1] !== "l")) return a;
  a.tramo++; if (a.tramo < a.tramos.length) { a.tIni = ahora; a.fin = ahora + a.tramos[a.tramo][0] * 60000; a.pausa = false; }
  return a;
}
function focoNueva(destino, op, ahora) {
  ahora = ahora || Date.now(); op = op || {};
  const ritmo = ["una", "ciclos", "libre"].includes(op.ritmo) ? op.ritmo : "una", min = Math.max(1, Math.min(240, Math.round(+op.min || 25)));
  const tramos = focoTramos(ritmo, min), fin = op.fin && op.fin > ahora ? op.fin : ahora + tramos[0][0] * 60000;
  return { v: 2, id: uid(), fecha: op.fecha || todayISO(), ini: ahora, destino, ritmo, min, tramos, tramo: 0, tIni: ritmo === "libre" ? ahora : fin - tramos[0][0] * 60000,
    fin: ritmo === "libre" ? null : fin, pausa: false, restante: 0, focoMs: 0, modo: op.modo === "barra" ? "barra" : "completa", estilo: op.estilo || "anillo", sonido: op.sonido || "", sala: op.sala || null, con: op.con || "", pend: 0 };
}
/* El registro que queda al terminar (null si fue menos de un minuto) */
function focoRegistro(a, completa, ahora) {
  const real = Math.min(focoMinHechos(a, ahora), 600); if (real < 1) return null;
  const d = a.destino || {}, ini = new Date(a.ini);
  const rec = { id: a.id, fecha: a.fecha, ts: ahora || Date.now(), ini: a.ini, hora: ini.getHours(), min: a.ritmo === "libre" ? real : focoTramosMin(a.tramos), real, completa: !!completa,
    tipo: d.tipo || "libre", ref: d.ref || "", titulo: String(d.titulo || "Tiempo de foco").slice(0, 120), ritmo: a.ritmo };
  if (d.objId) rec.objId = d.objId;
  if (d.area != null) rec.area = d.area;
  if (d.habId) rec.habId = d.habId;
  if (d.libroId) rec.libroId = d.libroId;
  if (d.tipo === "tarea") rec.tareaId = d.ref;
  if (a.con) rec.con = String(a.con).slice(0, 60);
  return rec;
}
function focoGuardarSigue(S, clave, txt) {
  if (!clave) return; const e = focoDatos(S), t = String(txt || "").trim().slice(0, 140);
  e.sigue[clave] = { txt: t, ts: Date.now() };
}
function focoSigue(S, clave) { const x = clave && focoDatos(S).sigue[clave]; return (x && x.txt) || ""; }

/* -------- Fusión entre equipos (store.js) -------- */
function focoMerge(local, server) {
  local = local || {}; server = server || {};
  const sigue = {}, ks = new Set([...Object.keys(server.sigue || {}), ...Object.keys(local.sigue || {})]);
  ks.forEach(k => { const a = (local.sigue || {})[k], b = (server.sigue || {})[k]; sigue[k] = !a ? b : !b ? a : (+b.ts || 0) > (+a.ts || 0) ? b : a; });
  const pa = local.pref || {}, pb = server.pref || {};
  return { sesiones: usosMerge(local.sesiones, server.sesiones), sigue, pref: (+pb.ts || 0) > (+pa.ts || 0) ? pb : pa };
}
