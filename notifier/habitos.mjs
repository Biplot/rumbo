/* ============================================================
   Rumbo · El motor de hábitos de la app, en el servidor
   Carga js/habitos-motor.js (el mismo archivo que usa la app) en un contexto aislado,
   así "qué hábito toca hoy" y "está hecho" se calculan igual en los dos lados.
   Las fechas son las de la persona ("YYYY-MM-DD" en su zona horaria).
   ============================================================ */
import fs from "node:fs";
import vm from "node:vm";

const CODIGO = new vm.Script(fs.readFileSync(new URL("../js/habitos-motor.js", import.meta.url), "utf8"), { filename: "habitos-motor.js" });
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
    /* Los que tocan hoy (activos, ya creados, del día o con la cuota sin cumplir) y aún no se marcan */
    pendientesHoy: () => S.habitos.defs.filter(h => h && ctx.tocaHoy(h, S) && !ctx.hmDone(h, hoy, S)),
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
