/* ============================================================
   Rumbo · El consultorio de La Línea
   La Línea es el diario de BiPlot: sale los lunes en biplot.cl/diario. Su sección «El consultorio» (Psst… ¿y tu día?)
   la firma el elefante de Rumbo, y su consejo de la semana se muestra en Inicio, con tu propio elefante.
   Se lee de biplot.cl/diario/ultima.json, el mismo archivo que leen el sitio y la oficina de BiPlot: sólo trae lo que
   ya se publicó. Se pide una vez por sesión; sin conexión, sin consejo o si lo cerraste (por número, en este
   dispositivo), no sale nada. No toca el estado del usuario ni la nube.
   ============================================================ */
const CONSULTORIO_URL = "https://biplot.cl/diario/ultima.json";
const CONSULTORIO_CERRADO = "rumbo-consultorio-cerrado";
let CONSULTORIO = null;          // { numero, titulo, texto, url } de la última edición publicada
let consultorioPedido = false;

/* Lo que llega se revisa antes de usarlo: sólo texto, con su largo, y el enlace armado aquí */
function leerConsultorio(d) {
  const e = d && d.edicion, c = e && e.consultorio;
  if (!c || typeof e.numero !== "number" || typeof c.texto !== "string" || !c.texto.trim() || !/^\/diario\/\d{4}-\d{2}-\d{2}\/$/.test(e.url || "")) return null;
  return { numero: e.numero, titulo: typeof c.titulo === "string" ? c.titulo.slice(0, 140) : "", texto: c.texto.slice(0, 700), url: "https://biplot.cl" + e.url + "#consultorio" };
}
function cargarConsultorio() {
  if (consultorioPedido || typeof fetch !== "function") return;
  consultorioPedido = true;
  fetch(CONSULTORIO_URL, { cache: "no-cache" })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      CONSULTORIO = leerConsultorio(d);
      if (CONSULTORIO && !consultorioCerrado() && CURRENT === "inicio" && STATE) rerender();
    })
    .catch(() => {});
}
function consultorioCerrado() {
  try { return !!CONSULTORIO && localStorage.getItem(CONSULTORIO_CERRADO) === String(CONSULTORIO.numero); } catch (e) { return false; }
}
function cerrarConsultorio() {
  try { if (CONSULTORIO) localStorage.setItem(CONSULTORIO_CERRADO, String(CONSULTORIO.numero)); } catch (e) {}
  rerender();
}
function renderConsultorioCard() {
  cargarConsultorio();
  if (!CONSULTORIO || consultorioCerrado()) return "";
  const c = CONSULTORIO;
  return `<div class="card consultorio mt-24" aria-label="El consultorio de La Línea">
    <div class="consultorio__ele" aria-hidden="true">${elefanteSVG({ anim: false })}</div>
    <div class="consultorio__txt">
      <div class="consultorio__ceja">Psst… ¿y tu día? · El consultorio de La Línea N.º ${c.numero}</div>
      ${c.titulo ? `<div class="card__title">${escapeHtml(c.titulo)}</div>` : ""}
      <p>${escapeHtml(c.texto)}</p>
      <div class="row-wrap" style="gap:10px">
        <a class="btn-ghost" href="${escapeAttr(c.url)}" target="_blank" rel="noopener">Leer La Línea →</a>
        <button class="btn-ghost" data-action="consultorio-cerrar" title="Vuelve con el número de la próxima semana">Listo, lo leí</button>
      </div>
    </div>
  </div>`;
}
