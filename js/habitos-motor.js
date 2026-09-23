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

const HM_DIAS = ["L", "M", "M", "J", "V", "S", "D"];

/* Frecuencia normalizada (hábitos viejos = diario) */
function hmFreq(h) {
  const f = (h && h.frecuencia) || {};
  if (f.tipo === "semanal") return { tipo: "semanal", veces: Math.min(6, Math.max(1, +f.veces || 1)) };
  if (f.tipo === "mensual") return { tipo: "mensual", veces: Math.min(25, Math.max(1, +f.veces || 1)) };
  if (f.tipo === "dias") { const dias = (f.dias || []).map(Number).filter(x => x >= 0 && x <= 6); return dias.length ? { tipo: "dias", dias } : { tipo: "diario" }; }
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

function hmDone(h, iso, S) {
  const st = S || STATE; const d = hmDate(iso);
  const log = st.habitos.log[`${d.getFullYear()}-${d.getMonth() + 1}`];
  return !!(log && log[h.id] && log[h.id][d.getDate()]);
}
/* ¿Es un día programado? (solo diario / días fijos; los de cuota no tienen días) */
function hmProgramado(h, iso) {
  const f = hmFreq(h);
  if (f.tipo === "diario") return true;
  if (f.tipo === "dias") return f.dias.includes(hmDow(iso));
  return false;
}
/* Marcas en [desde, hasta]. soloProgramados: para "dias" los días extra no suman. */
function hmContar(h, desde, hasta, S, soloProgramados) {
  let n = 0;
  for (let d = desde; d <= hasta; d = hmAdd(d, 1)) {
    if (soloProgramados && !hmProgramado(h, d)) continue;
    if (hmDone(h, d, S)) n++;
  }
  return n;
}

/* Períodos del hábito que caen en [desde, hasta]: [{ key, desde, hasta, esperado }]
   · diario / días fijos: cada día programado es un período de cuota 1
   · semanal: semanas ISO cuyo jueves cae en el rango
   · mensual: meses que tocan el rango
   La cuota del primer período se prorratea si el hábito se creó a mitad. */
function hmPeriodos(h, desde, hasta) {
  const f = hmFreq(h), cre = hmCreado(h), out = [];
  if (f.tipo === "diario" || f.tipo === "dias") {
    for (let d = hmMax(desde, cre); d <= hasta; d = hmAdd(d, 1))
      if (hmProgramado(h, d)) out.push({ key: d, desde: d, hasta: d, esperado: 1 });
  } else if (f.tipo === "semanal") {
    for (let l = hmLunes(desde); l <= hasta; l = hmAdd(l, 7)) {
      const jue = hmAdd(l, 3), dom = hmAdd(l, 6);
      if (jue < desde || jue > hasta || dom < cre) continue;
      const disp = l >= cre ? 7 : hmDiff(cre, dom) + 1;
      out.push({ key: "S" + l, desde: l, hasta: dom, esperado: Math.min(f.veces, disp) });
    }
  } else {
    for (let m = hmMesIni(desde); m <= hasta; m = hmAdd(hmMesFin(m), 1)) {
      const fin = hmMesFin(m); if (fin < cre) continue;
      const disp = m >= cre ? hmDiff(m, fin) + 1 : hmDiff(cre, fin) + 1;
      out.push({ key: "M" + m.slice(0, 7), desde: m, hasta: fin, esperado: Math.min(f.veces, disp) });
    }
  }
  return out;
}

/* Cumplimiento real en [desde, hasta]:
   { esperado, hecho (tope por período), pct (0-100 | null), enCurso: {hecho, meta} | null } */
function cumplimiento(h, desde, hasta, S) {
  const res = { esperado: 0, hecho: 0, pct: null, enCurso: null };
  if (!hmActivo(h)) return res;
  const hoy = hmHoy();
  hmPeriodos(h, desde, hasta).forEach(p => {
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
    return { hecho: p.hecho, meta: p.esperado, cumplido: p.cumplido, texto: `${p.hecho}/${p.esperado} ${f.tipo === "semanal" ? "esta semana" : "este mes"}` };
  }
  const prog = hmProgramado(h, hoy), n = hmDone(h, hoy, S) ? 1 : 0;
  return { hecho: n, meta: prog ? 1 : 0, cumplido: prog ? n >= 1 : true, texto: prog ? (n ? "hecho hoy" : "toca hoy") : "hoy no toca" };
}

/* ¿Toca hoy? diarios, días fijos si hoy corresponde, y cuotas aún no cumplidas */
function tocaHoy(h, S) {
  if (!hmActivo(h) || hmCreado(h) > hmHoy()) return false;
  const f = hmFreq(h);
  if (f.tipo === "diario") return true;
  if (f.tipo === "dias") return hmProgramado(h, hmHoy());
  return !progresoPeriodoActual(h, S).cumplido;
}

/* Racha en períodos consecutivos cumplidos (el período en curso suma solo si ya cumplió) */
function rachaPeriodos(h, S) {
  if (!hmActivo(h)) return { n: 0, unidad: "" };
  const f = hmFreq(h), hoy = hmHoy();
  const unidad = f.tipo === "semanal" ? "sem" : f.tipo === "mensual" ? "meses" : "días";
  const desde = hmMax(hmCreado(h), hmAdd(hoy, f.tipo === "mensual" ? -1100 : f.tipo === "semanal" ? -800 : -400));
  const ps = hmPeriodos(h, desde, f.tipo === "semanal" ? hmAdd(hmLunes(hoy), 3) : hoy).filter(p => p.desde <= hoy);
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
    const p = hmPeriodos(h, hmMesIni(iso), hmMesFin(iso))[0];
    const key = "M" + iso.slice(0, 7);
    if (!p) return { key, esperado: 0, hecho: 0, cumplido: false };
    const n = hmContar(h, p.desde, p.hasta, S);
    return { key, esperado: p.esperado, hecho: n, cumplido: n >= p.esperado };
  }
  const l = hmLunes(iso), dom = hmAdd(l, 6), key = "S" + l;
  if (dom < cre) return { key, esperado: 0, hecho: 0, cumplido: false };
  let esperado, hecho;
  if (f.tipo === "semanal") {
    esperado = Math.min(f.veces, l >= cre ? 7 : hmDiff(cre, dom) + 1);
    hecho = hmContar(h, l, dom, S);
  } else {
    esperado = 0; for (let d = hmMax(l, cre); d <= dom; d = hmAdd(d, 1)) if (hmProgramado(h, d)) esperado++;
    hecho = hmContar(h, hmMax(l, cre), dom, S, true);
  }
  return { key, esperado, hecho, cumplido: esperado > 0 && hecho >= esperado };
}

/* Semana Perfecta: todos los hábitos (activos, no mensuales, creados antes del
   domingo) cumplieron su objetivo en la semana ISO que empieza en `lunes`. */
function semanaPerfecta(S, lunes) {
  const st = S || STATE, dom = hmAdd(lunes, 6);
  const hs = (st.habitos.defs || []).filter(h => hmActivo(h) && hmFreq(h).tipo !== "mensual" && hmCreado(h) <= dom);
  return hs.length > 0 && hs.every(h => hmMetaPeriodo(h, lunes, st).cumplido);
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
    const prog = hs.filter(h => hmCreado(h) <= iso && hmProgramado(h, iso));
    if (!prog.length) continue;
    if (prog.every(h => hmDone(h, iso, st))) s++;
    else if (b === 0) continue;
    else break;
  }
  return s;
}
