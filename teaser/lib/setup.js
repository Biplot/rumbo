/* ============================================================
   RUMBO · Teaser — shims de captura
   Dos ajustes que hacen reproducible cada fotograma:
     · reloj virtual: el timeline decide si es de mañana o de noche
     · sin transiciones CSS: el movimiento lo dicta el timeline,
       no el reloj real del navegador
   ============================================================ */

/* El saludo de la app y la fecha del ritual salen de `new Date()`.
   Aquí ese reloj es una variable que el timeline mueve a voluntad. */
const CLOCK_SHIM = `(() => {
  const Real = Date;
  let vnow = null;
  Object.defineProperty(window, "__vnow", {
    get: () => vnow,
    set: v => { vnow = v == null ? null : (typeof v === "string" ? new Real(v).getTime() : v); },
  });
  function V(...a) {
    if (!(this instanceof V)) return new Real(...a).toString();
    return a.length === 0 ? new Real(vnow == null ? Real.now() : vnow) : new Real(...a);
  }
  V.prototype = Real.prototype;
  V.now = () => (vnow == null ? Real.now() : vnow);
  V.parse = Real.parse; V.UTC = Real.UTC;
  window.Date = V;
})();`;

/* Sin esto, las transiciones de la app avanzarían con el reloj real
   mientras la captura de un fotograma tarda lo suyo: el resultado
   saldría distinto en cada corrida. */
const FREEZE = `(() => {
  const css = "*,*::before,*::after{transition:none!important;animation:none!important}";
  const add = () => {
    if (document.getElementById("teaser-freeze")) return;
    const s = document.createElement("style");
    s.id = "teaser-freeze"; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
  else add();
})();`;

async function applyShims(context) {
  await context.addInitScript(CLOCK_SHIM);
  await context.addInitScript(FREEZE);
}

module.exports = { applyShims };
