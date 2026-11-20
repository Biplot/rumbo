/* ============================================================
   Rumbo · El motor de hábitos de la app, en el servidor
   Carga js/habitos-motor.js (el mismo archivo que usa la app) en un contexto aislado,
   así "qué hábito toca hoy" y "está hecho" se calculan igual en los dos lados.
   Las fechas son las de la persona ("YYYY-MM-DD" en su zona horaria).
   ============================================================ */
import fs from "node:fs";
import vm from "node:vm";

const CODIGO = new vm.Script(fs.readFileSync(new URL("../js/habitos-motor.js", import.meta.url), "utf8"), { filename: "habitos-motor.js" });
// El jardín de la app (js/jardin.js: solo datos al cargarse; lo que dibuja está en jardin-motor.js), para las macetas de Norte
let JARDIN = null;
const jardinScript = () => JARDIN || (JARDIN = new vm.Script(fs.readFileSync(new URL("../js/jardin.js", import.meta.url), "utf8"), { filename: "jardin.js" }));
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* { hecho(h, iso), pendientesHoy() } sobre el estado de una persona */
export function motorHabitos(data, hoy) {
  const S = data || {};
  if (!S.habitos || typeof S.habitos !== "object") S.habitos = { defs: [], log: {} };
  if (!Array.isArray(S.habitos.defs)) S.habitos.defs = [];
  if (!S.habitos.log || typeof S.habitos.log !== "object") S.habitos.log = {};
  const ctx = vm.createContext({ isoLocal, todayISO: () => hoy, STATE: S });
  CODIGO.runInContext(ctx);
  vm.runInContext(`HM_HOY = ${JSON.stringify(hoy)};`, ctx);
  return {
    hecho: (h, iso) => !!ctx.hmDone(h, iso, S),
    /* ¿Tocaba ese día? (diarios y días fijos, sin días libres ni descansos; los de veces por semana no tienen día fijo) */
    programado: (h, iso) => !!ctx.hmProgramado(h, iso, S),
    /* Los que tocan hoy (activos, ya creados, del día o con la cuota sin cumplir) y aún no se marcan */
    pendientesHoy: () => S.habitos.defs.filter(h => h && ctx.hmPendienteHoy(h, S)),
    /* La racha de un hábito, como en la app (rachaPeriodos): { n, unidad } con unidad "días", "sem" o "meses" */
    racha: h => ctx.rachaPeriodos(h, S),
    /* El cumplimiento de tus hábitos entre dos fechas, como los números de la semana en la app (cumplimientoGrupo):
       { esperado, hecho, pct } (pct null si no tocaba ninguno) */
    cumplimiento: (desde, hasta) => { const c = ctx.cumplimientoGrupo(S.habitos.defs, desde, hasta, S); return { esperado: c.esperado, hecho: c.hecho, pct: c.pct }; },
    /* Tu racha en riesgo: de los que hoy faltan, el de racha más larga (3 o más) — { nombre, n, unidad } o null */
    /* Las macetas de tu jardín, como las dibuja la app (jardinEscena): hasta 3, con sus días cumplidos hacia 66 */
    jardin: () => { if (typeof ctx.jardinEscena !== "function") jardinScript().runInContext(ctx); return ctx.jardinEscena(S, hoy).macetas; },
    enRiesgo: (min = 3) => S.habitos.defs.filter(h => h && ctx.hmPendienteHoy(h, S))
      .map(h => Object.assign({ nombre: h.nombre || "tu hábito", id: h.id }, ctx.rachaPeriodos(h, S)))
      .filter(r => r.n >= min).sort((a, b) => b.n - a.n)[0] || null,
  };
}

/* La racha de un hábito en conjunto (hmRachaConjunto de la app), contada hasta `hoy` */
export function rachaConjunto(def, miembros, hoy) {
  const ctx = vm.createContext({ isoLocal, todayISO: () => hoy, STATE: { habitos: { defs: [], log: {} }, gamif: { usos: [] } } });
  CODIGO.runInContext(ctx);
  vm.runInContext(`HM_HOY = ${JSON.stringify(hoy)};`, ctx);
  const r = ctx.hmRachaConjunto(def, miembros);
  return { n: r.n, unidad: r.unidad };
}
