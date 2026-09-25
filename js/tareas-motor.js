/* ============================================================
   RUMBO · Motor de métricas de tareas y postergación (funciones puras)
   Lee el registro diario (agenda.js). Una "cadena" es una tarea y todas sus
   copias al moverla de día (mismo `origen`): cuenta como UNA tarea.

   · Índice de postergación: de las tareas (cadenas) que tuviste en el período,
     % que moviste de día al menos una vez (el mismo día o después de su fecha).
   · Días de arrastre: promedio de días entre que planificaste una tarea y la hiciste.
   · Crónicas: tareas postergadas 3 o más veces.
   · Primer bocado postergado: % de días en que moviste tu tarea más importante.
   · Capacidad real: tareas hechas por día (promedio) vs. planificadas.
   ============================================================ */

/* Índice de cadenas: origen → registros [{ t, iso }] ordenados por fecha */
function tmCadenas(S) {
  const idx = new Map();
  const dias = agendaDias(S);
  Object.keys(dias).sort().forEach(iso => {
    tareasDelDia(iso, S).forEach(t => {
      const k = t.origen || t.id;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push({ t, iso });
    });
  });
  return idx;
}
const tmPct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const tmPostergada = t => tareaMovida(t) && t.postergada !== false;
/* Movida antes de su día: fue replanificar, no cuenta en el plan de ese día */
const tmReplanificada = t => tareaMovida(t) && t.postergada === false;
/* Registros que cuentan como "el plan" de un día */
const tmPlanDia = (S, iso) => tareasDelDia(iso, S).filter(t => !tmReplanificada(t));

/* Resumen de un período [desde, hasta] */
function tmResumen(S, desde, hasta) {
  const cad = tmCadenas(S);
  const r = {
    tareas: 0, hechas: 0, postergadas: 0, soltadas: 0, delegadas: 0, pendientes: 0,
    indice: null, cumplimiento: null, arrastre: null, cronicas: [],
    bocado: { dias: 0, dados: 0, postergados: 0, pct: null },
    porAmbito: { pro: { tareas: 0, postergadas: 0, indice: null }, per: { tareas: 0, postergadas: 0, indice: null } },
    porDia: Array.from({ length: 7 }, () => ({ planificadas: 0, postergadas: 0, pct: null })),
  };
  const arrastres = [];
  cad.forEach(regs => {
    const enRango = regs.filter(x => x.iso >= desde && x.iso <= hasta);
    if (!enRango.length) return;
    r.tareas++;
    const amb = ambitoDe(enRango[0].t);
    r.porAmbito[amb].tareas++;
    const hecha = enRango.find(x => estadoTarea(x.t) === "hecha");
    const post = enRango.some(x => tmPostergada(x.t));
    if (hecha) { r.hechas++; arrastres.push(Math.max(0, agDiff(hecha.t.creada || hecha.iso, hecha.iso))); }
    if (post) { r.postergadas++; r.porAmbito[amb].postergadas++; }
    if (enRango.some(x => estadoTarea(x.t) === "soltada")) r.soltadas++;
    if (enRango.some(x => estadoTarea(x.t) === "delegada")) r.delegadas++;
    const ult = regs[regs.length - 1];
    if (tareaAbierta(ult.t) && ult.iso <= hasta) r.pendientes++;
    const maxMig = Math.max(...regs.map(x => x.t.migraciones || 0));
    if (maxMig >= CRONICA) r.cronicas.push({ txt: ult.t.txt, n: maxMig, estado: estadoTarea(ult.t), iso: ult.iso, id: ult.t.id });
  });
  // Por día de la semana y primer bocado: sobre cada registro del período (el plan de cada día)
  Object.keys(agendaDias(S)).forEach(iso => {
    if (iso < desde || iso > hasta) return;
    const dow = (agDate(iso).getDay() + 6) % 7;
    tmPlanDia(S, iso).forEach(t => {
      r.porDia[dow].planificadas++;
      if (tmPostergada(t)) r.porDia[dow].postergadas++;
      if (t.esSapo) {
        r.bocado.dias++;
        if (estadoTarea(t) === "hecha") r.bocado.dados++;
        else if (tmPostergada(t)) r.bocado.postergados++;
      }
    });
  });
  r.porDia.forEach(d => { d.pct = d.planificadas >= 3 ? tmPct(d.postergadas, d.planificadas) : null; });
  ["pro", "per"].forEach(a => { const x = r.porAmbito[a]; x.indice = x.tareas >= 3 ? tmPct(x.postergadas, x.tareas) : null; });
  r.indice = tmPct(r.postergadas, r.tareas);
  r.cumplimiento = tmPct(r.hechas, r.tareas);
  r.arrastre = arrastres.length ? Math.round((arrastres.reduce((a, b) => a + b, 0) / arrastres.length) * 10) / 10 : null;
  r.bocado.pct = r.bocado.dias ? tmPct(r.bocado.postergados, r.bocado.dias) : null;
  r.cronicas.sort((a, b) => b.n - a.n);
  return r;
}

/* Cumplimiento de un día: hechas / planificadas (null si no hubo plan).
   movidas = postergadas ese día (lo replanificado antes no cuenta). */
function tmDia(S, iso) {
  const plan = tmPlanDia(S, iso);
  const hechas = plan.filter(t => estadoTarea(t) === "hecha").length;
  return { planificadas: plan.length, hechas, movidas: plan.filter(tmPostergada).length,
    pct: plan.length ? tmPct(hechas, plan.length) : null };
}

/* Capacidad real: promedio de tareas hechas y planificadas por día en los últimos `dias`
   (solo días con plan). Null si hay menos de 5 días con datos. */
function tmCapacidad(S, hasta, dias) {
  dias = dias || 14;
  let n = 0, h = 0, p = 0;
  for (let i = 1; i <= dias; i++) {
    const iso = agSumar(hasta, -i);
    const d = tmDia(S, iso);
    if (!d.planificadas) continue;
    n++; h += d.hechas; p += d.planificadas;
  }
  if (n < 5) return null;
  return { dias: n, hechasProm: Math.round((h / n) * 10) / 10, planProm: Math.round((p / n) * 10) / 10 };
}

/* Serie por semana (lunes) de las últimas `n` semanas terminando en la de `hasta` */
function tmSerieSemanas(S, hasta, n) {
  n = n || 8;
  const out = [];
  const lunesFin = agLunes(hasta);
  for (let i = n - 1; i >= 0; i--) {
    const l = agSumar(lunesFin, -7 * i);
    const r = tmResumen(S, l, agSumar(l, 6));
    out.push({ lunes: l, tareas: r.tareas, indice: r.tareas ? r.indice : null, cumplimiento: r.tareas ? r.cumplimiento : null });
  }
  return out;
}

/* ¿Completaste alguna tarea que habías postergado 3 o más veces? (insignia) */
function tmElefanteDomado(S) {
  const dias = agendaDias(S);
  return Object.keys(dias).some(iso => tareasDelDia(iso, S).some(t => estadoTarea(t) === "hecha" && (t.migraciones || 0) >= CRONICA));
}
