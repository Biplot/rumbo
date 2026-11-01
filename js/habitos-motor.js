/* ============================================================
   RUMBO · Motor de hábitos: frecuencia objetivo y cumplimiento real
   Funciones puras y reutilizables. Reciben el estado S (opcional,
   por defecto STATE). Fechas en ISO local "YYYY-MM-DD".
   Semana ISO: lunes a domingo. Día de semana 0 = lunes.

   Frecuencias (habitos.defs[i].frecuencia):
     { tipo: "diario" }
     { tipo: "semanal", veces: 1..6 }   X veces por semana
     { tipo: "dias", dias: [0..6] }     días fijos
     { tipo: "mensual", veces: 1..25 }  X veces al mes
   Reglas:
     · No se exige nada antes de h.creado. Los pausados no se miden.
     · El período en curso no penaliza: solo entra al % cuando cierra
       (o antes, si ya cumplió su cuota).
     · Días de descanso (v55): un día de descanso no se espera; no corta la racha
       ni suma (si igual lo hiciste, cuenta como siempre). En vacaciones, los de
       X por semana o al mes piden en proporción a los días que estás.
   ============================================================ */

let HM_HOY = null;   // solo para tests: fija "hoy"
function hmHoy() { return HM_HOY || todayISO(); }
function hmDate(iso) { return new Date(iso + "T12:00:00"); }
function hmAdd(iso, n) { const d = hmDate(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function hmDiff(a, b) { return Math.round((hmDate(b) - hmDate(a)) / 86400000); }   // días de a → b
function hmDow(iso) { return (hmDate(iso).getDay() + 6) % 7; }
function hmLunes(iso) { return hmAdd(iso, -hmDow(iso)); }
function hmMesIni(iso) { return iso.slice(0, 8) + "01"; }
function hmMesFin(iso) { const d = hmDate(iso); return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
const hmMax = (a, b) => (a > b ? a : b);
const hmMin = (a, b) => (a < b ? a : b);

const HM_DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/* Frecuencia normalizada (hábitos viejos = diario) */
function hmFreq(h) {
  const f = (h && h.frecuencia) || {};
  if (f.tipo === "semanal") return { tipo: "semanal", veces: Math.min(6, Math.max(1, +f.veces || 1)) };
  if (f.tipo === "mensual") return { tipo: "mensual", veces: Math.min(25, Math.max(1, +f.veces || 1)) };
  if (f.tipo === "dias") { const dias = [...new Set((Array.isArray(f.dias) ? f.dias : []).map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))]; return dias.length ? { tipo: "dias", dias } : { tipo: "diario" }; }
  return { tipo: "diario" };
}
function hmFreqLabel(h) {
  const f = hmFreq(h);
  if (f.tipo === "semanal") return f.veces + "×/semana";
  if (f.tipo === "mensual") return f.veces + "×/mes";
  if (f.tipo === "dias") return f.dias.slice().sort().map(i => HM_DIAS[i]).join("·");
  return "Diario";
}
function hmCreado(h) { return (h && h.creado) || "0000-01-01"; }
function hmActivo(h) { return !!h && !h.pausado; }

/* Días libres y pases de hábito usados antes de v61 (ya no se venden): se respetan en la historia */
function hmUso(st, id) { const us = st && st.gamif && st.gamif.usos; return Array.isArray(us) && us.some(u => u && u.id === id && !u.anulado); }
function hmLibre(iso, S) { return hmUso(S || (typeof STATE !== "undefined" ? STATE : null), "libre:" + iso); }
function hmPase(h, iso, S) { return hmUso(S || (typeof STATE !== "undefined" ? STATE : null), "pase:" + h.id + ":" + iso); }

/* -------- Días de descanso (v55): se deciden antes (desde el día anterior), no se compran y tienen tope --------
   · Descanso de un hábito (diarios y días fijos): habitos.descansos = [{ id: "d:<hid>:<iso>", hid, fecha, ts, quitado? }],
     hasta HM_DESCANSOS_MES por mes en cada hábito.
   · Vacaciones: habitos.vacaciones = [{ id, desde, hasta, habitos: null (todos) | [ids], ts, quitado? }], hasta
     HM_VACACIONES_MAX días seguidos. Cubren todos los tipos de hábito.
   Las listas se reemplazan al cambiar (nunca se editan en su lugar): así el índice por lista sirve de caché. */
const HM_DESCANSOS_MES = 2, HM_VACACIONES_MAX = 21;
const HM_IDX_DESCANSOS = new WeakMap();
function hmEstado(S) { return S || (typeof STATE !== "undefined" ? STATE : null); }
function hmDescansosIdx(st) {
  const ds = st && st.habitos && st.habitos.descansos;
  if (!Array.isArray(ds) || !ds.length) return null;
  let idx = HM_IDX_DESCANSOS.get(ds);
  if (!idx) { idx = new Set(); ds.forEach(x => { if (x && !x.quitado && x.hid && x.fecha) idx.add(x.hid + "|" + x.fecha); }); HM_IDX_DESCANSOS.set(ds, idx); }
  return idx;
}
function hmVacaciones(S) { const st = hmEstado(S), vs = st && st.habitos && st.habitos.vacaciones; return Array.isArray(vs) ? vs.filter(v => v && !v.quitado && v.desde && v.hasta) : []; }
/* ¿Ese día es descanso de un hábito (marcado a mano)? */
function hmDescansoDia(h, iso, S) { const idx = hmDescansosIdx(hmEstado(S)); return !!idx && !!h && idx.has(h.id + "|" + iso); }
/* Las vacaciones que cubren ese día para ese hábito (o null) */
function hmVacacion(h, iso, S) { return (h && hmVacaciones(S).find(v => v.desde <= iso && iso <= v.hasta && (!Array.isArray(v.habitos) || v.habitos.includes(h.id)))) || null; }
function hmDescanso(h, iso, S) { return hmDescansoDia(h, iso, S) || !!hmVacacion(h, iso, S); }
function hmDiasVacacion(h, desde, hasta, S) {
  const vs = hmVacaciones(S); if (!vs.length) return 0;
  let n = 0; for (let d = desde; d <= hasta; d = hmAdd(d, 1)) if (hmVacacion(h, d, S)) n++;
  return n;
}
/* La cuota de un período con días fuera: en proporción a los días que estás (fuera 3 de 7, «3 por semana» pide 2) */
function hmCuota(veces, base, total, fuera, largo) {
  return fuera > 0 ? Math.min(base, Math.max(0, Math.ceil(veces * (total - fuera) / largo - 1e-9))) : base;
}
/* Descansos del mes de iso que ya tiene un hábito (los de un día; las vacaciones van aparte) */
function hmDescansosDelMes(h, iso, S) {
  const st = hmEstado(S), ds = (st && st.habitos && st.habitos.descansos) || [], mes = iso.slice(0, 7);
  return ds.filter(x => x && !x.quitado && x.hid === h.id && String(x.fecha).slice(0, 7) === mes).length;
}

/* Hecho = marcado, o cubierto con un pase de hábito (cuenta sin pagar monedas) */
function hmDone(h, iso, S) {
  const st = S || STATE; const d = hmDate(iso);
  const log = st.habitos.log[`${d.getFullYear()}-${d.getMonth() + 1}`];
  return !!(log && log[h.id] && log[h.id][d.getDate()]) || hmPase(h, iso, st);
}
/* ¿Es un día programado? (solo diario / días fijos; los de cuota no tienen días).
   Un día libre o de descanso no se programa: no exige ni corta (si igual lo hiciste, cuenta). */
function hmProgramado(h, iso, S) {
  const f = hmFreq(h);
  if (f.tipo !== "diario" && f.tipo !== "dias") return false;
  if (hmLibre(iso, S)) return false;
  if (f.tipo === "dias" && !f.dias.includes(hmDow(iso))) return false;
  if (hmDescanso(h, iso, S) && !hmDone(h, iso, hmEstado(S))) return false;
  return true;
}
/* ¿Tocaría ese día si no fuera de descanso? (para ofrecer el descanso: diarios y días fijos) */
function hmTocariaDia(h, iso) {
  const f = hmFreq(h);
  return f.tipo === "diario" || (f.tipo === "dias" && f.dias.includes(hmDow(iso)));
}
/* Marcas en [desde, hasta]. soloProgramados: para "dias" los días extra no suman. */
function hmContar(h, desde, hasta, S, soloProgramados) {
  let n = 0;
  for (let d = desde; d <= hasta; d = hmAdd(d, 1)) {
    if (soloProgramados && !hmProgramado(h, d, S)) continue;
    if (hmDone(h, d, S)) n++;
  }
  return n;
}

/* Períodos del hábito que caen en [desde, hasta]: [{ key, desde, hasta, esperado }]
   · diario / días fijos: cada día programado es un período de cuota 1
   · semanal: semanas ISO cuyo jueves cae en el rango
   · mensual: meses que tocan el rango
   La cuota del primer período se prorratea si el hábito se creó a mitad; con vacaciones, en
   proporción a los días que estás (un período todo de vacaciones no se pide: no corta ni suma). */
function hmPeriodos(h, desde, hasta, S) {
  const f = hmFreq(h), cre = hmCreado(h), out = [];
  if (f.tipo === "diario" || f.tipo === "dias") {
    for (let d = hmMax(desde, cre); d <= hasta; d = hmAdd(d, 1))
      if (hmProgramado(h, d, S)) out.push({ key: d, desde: d, hasta: d, esperado: 1 });
  } else if (f.tipo === "semanal") {
    for (let l = hmLunes(desde); l <= hasta; l = hmAdd(l, 7)) {
      const jue = hmAdd(l, 3), dom = hmAdd(l, 6);
      if (jue < desde || jue > hasta || dom < cre) continue;
      const esperado = hmCuotaSemana(h, l, S);
      if (esperado > 0) out.push({ key: "S" + l, desde: l, hasta: dom, esperado });
    }
  } else {
    for (let m = hmMesIni(desde); m <= hasta; m = hmAdd(hmMesFin(m), 1)) {
      const fin = hmMesFin(m); if (fin < cre) continue;
      const ini = hmMax(m, cre), disp = hmDiff(ini, fin) + 1;
      const esperado = hmCuota(f.veces, Math.min(f.veces, disp), disp, hmDiasVacacion(h, ini, fin, S), hmDiff(m, fin) + 1);
      if (esperado > 0) out.push({ key: "M" + m.slice(0, 7), desde: m, hasta: fin, esperado });
    }
  }
  return out;
}
/* La cuota de la semana que parte el lunes l (hábitos de X por semana) */
function hmCuotaSemana(h, l, S) {
  const f = hmFreq(h), dom = hmAdd(l, 6), ini = hmMax(l, hmCreado(h));
  if (dom < ini) return 0;
  const disp = hmDiff(ini, dom) + 1;
  return hmCuota(f.veces, Math.min(f.veces, disp), disp, hmDiasVacacion(h, ini, dom, S), 7);
}

/* Cumplimiento real en [desde, hasta]:
   { esperado, hecho (tope por período), pct (0-100 | null), enCurso: {hecho, meta} | null } */
function cumplimiento(h, desde, hasta, S) {
  const res = { esperado: 0, hecho: 0, pct: null, enCurso: null };
  if (!hmActivo(h)) return res;
  const hoy = hmHoy();
  hmPeriodos(h, desde, hasta, S).forEach(p => {
    if (p.desde > hoy) return;                                   // futuro
    const n = hmContar(h, p.desde, p.hasta, S);
    if (p.hasta >= hoy) {                                        // en curso: no penaliza
      res.enCurso = { hecho: n, meta: p.esperado };
      if (n < p.esperado) return;
    }
    res.esperado += p.esperado; res.hecho += Math.min(n, p.esperado);
  });
  res.pct = res.esperado ? Math.round((res.hecho / res.esperado) * 100) : null;
  return res;
}
function esperadoEnPeriodo(h, desde, hasta, S) { return cumplimiento(h, desde, hasta, S).esperado; }
function hechoEnPeriodo(h, desde, hasta, S) { return hmContar(h, desde, hasta, S); }

/* Agregado de varios hábitos (para donuts / barras): { esperado, hecho, pct } */
function cumplimientoGrupo(defs, desde, hasta, S) {
  let e = 0, x = 0;
  (defs || []).forEach(h => { const c = cumplimiento(h, desde, hasta, S); e += c.esperado; x += c.hecho; });
  return { esperado: e, hecho: x, pct: e ? Math.round((x / e) * 100) : null };
}

/* Progreso del período actual: { hecho, meta, cumplido, texto } */
function progresoPeriodoActual(h, S) {
  const f = hmFreq(h), hoy = hmHoy();
  if (f.tipo === "semanal" || f.tipo === "mensual") {
    const p = hmMetaPeriodo(h, hoy, S);
    const cuenta = `${p.hecho}/${p.esperado} ${f.tipo === "semanal" ? "esta semana" : "este mes"}`, vac = !!hmVacacion(h, hoy, S);
    return { hecho: p.hecho, meta: p.esperado, cumplido: p.cumplido, texto: vac ? (p.esperado ? "de vacaciones · " + cuenta : "de vacaciones") : cuenta, descanso: vac };
  }
  const prog = hmProgramado(h, hoy, S), n = hmDone(h, hoy, S) ? 1 : 0;
  const libre = !prog && hmDescanso(h, hoy, S) ? (hmVacacion(h, hoy, S) ? "de vacaciones" : "descansa hoy") : "";
  return { hecho: n, meta: prog ? 1 : 0, cumplido: prog ? n >= 1 : true, texto: prog ? (n ? "hecho hoy" : "toca hoy") : libre || "hoy no toca", descanso: !!libre };
}

/* ¿Toca hoy? diarios, días fijos si hoy corresponde, y cuotas aún no cumplidas */
function tocaHoy(h, S) {
  if (!hmActivo(h) || hmCreado(h) > hmHoy()) return false;
  if (hmDescanso(h, hmHoy(), S) && !hmDone(h, hmHoy(), hmEstado(S))) return false;   // hoy descansa
  const f = hmFreq(h);
  if (f.tipo === "diario" || f.tipo === "dias") return hmProgramado(h, hmHoy(), S);
  return !progresoPeriodoActual(h, S).cumplido;
}

/* Racha en períodos consecutivos cumplidos (el período en curso suma solo si ya cumplió) */
function rachaPeriodos(h, S) {
  if (!hmActivo(h)) return { n: 0, unidad: "" };
  const f = hmFreq(h), hoy = hmHoy();
  const unidad = f.tipo === "semanal" ? "sem" : f.tipo === "mensual" ? "meses" : "días";
  const desde = hmMax(hmCreado(h), hmAdd(hoy, f.tipo === "mensual" ? -1100 : f.tipo === "semanal" ? -800 : -400));
  const ps = hmPeriodos(h, desde, f.tipo === "semanal" ? hmAdd(hmLunes(hoy), 3) : hoy, S).filter(p => p.desde <= hoy);
  let n = 0;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i], ok = hmContar(h, p.desde, p.hasta, S) >= p.esperado;
    if (ok) n++;
    else if (p.hasta >= hoy) continue;   // en curso sin cumplir: no corta
    else break;
  }
  return { n, unidad };
}

/* Cuota de la SEMANA (diario, días fijos, semanal) o del MES (mensual) que contiene iso.
   Se usa para el premio "habito-meta" y para la insignia Semana Perfecta.
   { key, esperado, hecho, cumplido } */
function hmMetaPeriodo(h, iso, S) {
  const f = hmFreq(h), cre = hmCreado(h);
  if (f.tipo === "mensual") {
    const p = hmPeriodos(h, hmMesIni(iso), hmMesFin(iso), S)[0];
    const key = "M" + iso.slice(0, 7);
    if (!p) return { key, esperado: 0, hecho: 0, cumplido: false };
    const n = hmContar(h, p.desde, p.hasta, S);
    return { key, esperado: p.esperado, hecho: n, cumplido: n >= p.esperado };
  }
  const l = hmLunes(iso), dom = hmAdd(l, 6), key = "S" + l;
  if (dom < cre) return { key, esperado: 0, hecho: 0, cumplido: false };
  let esperado, hecho;
  if (f.tipo === "semanal") {
    esperado = hmCuotaSemana(h, l, S);
    hecho = hmContar(h, l, dom, S);
  } else {
    esperado = 0; for (let d = hmMax(l, cre); d <= dom; d = hmAdd(d, 1)) if (hmProgramado(h, d, S)) esperado++;
    hecho = hmContar(h, hmMax(l, cre), dom, S, true);
  }
  return { key, esperado, hecho, cumplido: esperado > 0 && hecho >= esperado };
}

/* Semana Perfecta: todos los hábitos (activos, no mensuales, creados antes del
   domingo) cumplieron su objetivo en la semana ISO que empieza en `lunes`.
   Uno que esa semana no pedía nada (toda de descanso o vacaciones) no entra. */
function semanaPerfecta(S, lunes) {
  const st = S || STATE, dom = hmAdd(lunes, 6);
  const hs = (st.habitos.defs || []).filter(h => hmActivo(h) && hmFreq(h).tipo !== "mensual" && hmCreado(h) <= dom)
    .map(h => hmMetaPeriodo(h, lunes, st)).filter((m, i, a) => m.esperado > 0 || !hmHayDescansoEn(st, lunes, dom));
  return hs.length > 0 && hs.every(m => m.cumplido);
}
function hmHayDescansoEn(S, desde, hasta) {
  const st = hmEstado(S);
  return ((st && st.habitos && st.habitos.descansos) || []).some(x => x && !x.quitado && x.fecha >= desde && x.fecha <= hasta) ||
    hmVacaciones(st).some(v => v.desde <= hasta && v.hasta >= desde);
}

/* Racha global de hábitos: días seguidos en que se hicieron TODOS los hábitos que
   tocaban ese día (diarios y días fijos). Los de cuota no cortan; un día sin nada
   programado no corta ni suma. Hoy, si aún no está completo, no corta. */
function rachaGlobalHabitos(S) {
  const st = S || STATE, hoy = hmHoy();
  const hs = (st.habitos.defs || []).filter(h => hmActivo(h) && ["diario", "dias"].includes(hmFreq(h).tipo));
  if (!hs.length) {
    // sin hábitos de días: días seguidos con al menos una marca
    let s = 0;
    for (let b = 0; b < 366; b++) {
      const iso = hmAdd(hoy, -b);
      if ((st.habitos.defs || []).some(h => hmActivo(h) && hmDone(h, iso, st))) s++;
      else if (b === 0) continue; else break;
    }
    return s;
  }
  const minCre = hs.reduce((a, h) => hmMin(a, hmCreado(h)), "9999-12-31");
  let s = 0;
  for (let b = 0; b < 366; b++) {
    const iso = hmAdd(hoy, -b);
    if (iso < minCre) break;
    const prog = hs.filter(h => hmCreado(h) <= iso && hmProgramado(h, iso, st));
    if (!prog.length) continue;
    if (prog.every(h => hmDone(h, iso, st))) s++;
    else if (b === 0) continue;
    else break;
  }
  return s;
}

/* ============================================================
   Hábitos en conjunto (Amigos): la racha de a dos (o del grupo)
   def: { frecuencia, creado } del hábito compartido.
   miembros: los activos, [{ desde: "YYYY-MM-DD", marcas: ["YYYY-MM-DD", …] }].
   Un período cuenta si cumplieron TODOS los que ya estaban al empezar ese período
   (y eran al menos dos). Como rachaPeriodos: el período en curso suma solo si ya
   cumplieron, y no corta mientras sigue abierto. Sin días libres ni pases: es de varios.
   Descansos (v55): cada uno puede traer descansos: ["YYYY-MM-DD", …]. Se respetan solo si
   descansan todos: ese día no corta ni suma (y en los de cuota, los días que descansan todos
   bajan la cuota en proporción).
   La usan la app (js/conjunto.js) y el servidor (notifier/habitos.mjs).
   ============================================================ */
function hmRachaConjunto(def, miembros) {
  const f = hmFreq(def), hoy = hmHoy(), S0 = { habitos: { defs: [], log: {} }, gamif: { usos: [] } };
  const unidad = f.tipo === "semanal" ? "sem" : f.tipo === "mensual" ? "meses" : "días";
  const ms = (miembros || []).map(m => ({ desde: m.desde || hmCreado(def), marcas: new Set(m.marcas || []), descansos: new Set(m.descansos || []) }));
  const desde = hmMax(hmCreado(def), hmAdd(hoy, f.tipo === "mensual" ? -1100 : f.tipo === "semanal" ? -800 : -400));
  const ps = hmPeriodos(def, desde, f.tipo === "semanal" ? hmAdd(hmLunes(hoy), 3) : hoy, S0).filter(p => p.desde <= hoy);
  const cuenta = (m, p) => { let n = 0; for (let d = p.desde; d <= p.hasta; d = hmAdd(d, 1)) if (m.marcas.has(d)) n++; return n; };
  let n = 0;
  const todosDescansan = (req, d) => req.length >= 2 && req.every(m => m.descansos.has(d));
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i], req = ms.filter(m => m.desde <= p.desde);
    let esperado = p.esperado;
    if (f.tipo === "diario" || f.tipo === "dias") {
      if (todosDescansan(req, p.desde) && !req.every(m => m.marcas.has(p.desde))) continue;   // descansaron todos: no corta ni suma
    } else {
      let fuera = 0; for (let d = p.desde; d <= p.hasta; d = hmAdd(d, 1)) if (todosDescansan(req, d)) fuera++;
      esperado = hmCuota(f.veces, p.esperado, hmDiff(p.desde, p.hasta) + 1, fuera, f.tipo === "semanal" ? 7 : hmDiff(p.desde, p.hasta) + 1);
      if (!esperado) continue;
    }
    if (req.length >= 2 && req.every(m => cuenta(m, p) >= esperado)) n++;
    else if (p.hasta >= hoy) continue;   // en curso: no corta
    else break;
  }
  return { n, unidad };
}
/* ¿Ese día lo hicieron todos? (los activos que ya estaban, al menos dos) */
function hmTodosConjunto(miembros, iso) {
  const req = (miembros || []).filter(m => (m.desde || "") <= iso);
  return req.length >= 2 && req.every(m => (m.marcas || []).includes(iso));
}
