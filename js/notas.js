/* ============================================================
   RUMBO · Notas estilo post-it
   STATE.postits: [{ id, titulo, texto, etiquetas: [..], fijada, color, archivada, borrada, ts }]
   - Escribes arriba; las #etiquetas del texto se guardan solas.
   - Fijas las importantes, filtras por etiqueta y una nota pasa a tarea de hoy con un toque.
   - Migración (state.js): las notas por categoría pasan con su categoría como etiqueta y la
     captura rápida como notas sueltas. Los datos de antes no se borran.
   ============================================================ */
let NOTA_FILTRO = "todas", NOTA_BUSCA = "", NOTA_EDIT = null;
const NOTA_COLORES = ["", "#F5C451", "#2BB6A5", "#E8563A", "#8B93E8", "#7CC4A0"];

function etiquetaSlug(t) { return String(t || "").trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 30); }
function etiquetasDe(texto) {
  return [...new Set((String(texto || "").match(/#[\p{L}\p{N}_-]+/gu) || []).map(etiquetaSlug))];
}
function postits() { return (STATE.postits || []).filter(n => !n.borrada); }

function renderNotas() {
  const vivas = postits().filter(n => !n.archivada);
  const conteo = {};
  vivas.forEach(n => (n.etiquetas || []).forEach(e => { conteo[e] = (conteo[e] || 0) + 1; }));
  const tags = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a] || a.localeCompare(b)).slice(0, 10);
  const nArch = postits().filter(n => n.archivada).length;
  const chip = (v, t) => `<button class="chip-f${NOTA_FILTRO === v ? " is-on" : ""}" data-action="nota-filtro" data-v="${escapeAttr(v)}">${t}</button>`;
  return `
  <div class="nota-cap">
    <textarea class="input" id="nota-nueva" rows="1" placeholder="Escribe una nota… #etiqueta" aria-label="Nueva nota"
      onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();notaCrear();}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
    <button class="btn btn--cian nota-cap__b" data-action="nota-crear" aria-label="Guardar nota">+</button>
  </div>
  <div class="row mt-8" style="gap:8px"><input class="input" id="nota-busca" placeholder="Buscar en tus notas…" value="${escapeAttr(NOTA_BUSCA)}" oninput="notaBuscar(this.value)" aria-label="Buscar en tus notas" style="flex:1;min-width:0"></div>
  <div class="chips-f mt-8">${chip("todas", "Todas")}${tags.map(t => chip(t, "#" + escapeHtml(t))).join("")}${nArch ? chip("archivadas", `Archivadas (${nArch})`) : ""}</div>
  <div id="notas-lista">${notasListaHtml()}</div>`;
}
function notasListaHtml() {
  const q = NOTA_BUSCA.trim().toLowerCase();
  const base = postits().filter(n => NOTA_FILTRO === "archivadas" ? n.archivada : !n.archivada && (NOTA_FILTRO === "todas" || (n.etiquetas || []).includes(NOTA_FILTRO)));
  const lista = base.filter(n => !q || [n.titulo, n.texto, (n.etiquetas || []).join(" ")].join(" ").toLowerCase().includes(q))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!postits().length) return `<div class="card mt-16"><div class="empty">Tus notas aparecen aquí como post-its. Escribe arriba y usa <b>#etiquetas</b> para ordenarlas.</div></div>`;
  if (!lista.length) return `<div class="card mt-16"><div class="empty">No hay notas con ese filtro.</div></div>`;
  const tarjeta = n => `<button class="postit" data-action="nota-abrir" data-id="${n.id}" ${n.color ? `style="--pc:${n.color}"` : ""}>
      ${n.titulo ? `<b class="postit__t">${escapeHtml(n.titulo)}</b>` : ""}
      ${n.texto ? `<span class="postit__x">${escapeHtml(n.texto.replace(/#[\p{L}\p{N}_-]+/gu, "").trim() || n.texto)}</span>` : ""}
      ${(n.etiquetas || []).length ? `<span class="postit__tags">${n.etiquetas.map(e => "#" + escapeHtml(e)).join(" ")}</span>` : ""}
    </button>`;
  const fij = lista.filter(n => n.fijada && !n.archivada), resto = lista.filter(n => !(n.fijada && !n.archivada));
  return (fij.length ? `<div class="section-title">📌 Fijadas</div><div class="postits">${fij.map(tarjeta).join("")}</div>` : "")
    + (resto.length ? `<div class="section-title">${NOTA_FILTRO === "archivadas" ? "Archivadas" : fij.length ? "Recientes" : "Tus notas"}</div><div class="postits">${resto.map(tarjeta).join("")}</div>` : "");
}
function notaBuscar(v) {
  NOTA_BUSCA = v || "";
  const el = document.getElementById("notas-lista");
  if (el) el.innerHTML = notasListaHtml();
}
function notaCrear() {
  const el = document.getElementById("nota-nueva");
  const texto = el ? el.value.trim() : ""; if (!texto) return;
  STATE.postits = STATE.postits || [];
  const et = etiquetasDe(texto);
  if (NOTA_FILTRO !== "todas" && NOTA_FILTRO !== "archivadas" && !et.includes(NOTA_FILTRO)) et.push(NOTA_FILTRO);   // si miras #trabajo, la nota nueva va a #trabajo
  STATE.postits.push({ id: uid(), titulo: "", texto, etiquetas: et, fijada: false, color: "", archivada: false, ts: Date.now() });
  saveState(); rerender();
  const nuevo = document.getElementById("nota-nueva"); if (nuevo) nuevo.focus();
}
function notaAbrir(id) {
  const n = postits().find(x => x.id === id); if (!n) return;
  NOTA_EDIT = id;
  openModal("Nota", `
    <div class="field"><input class="input" id="ne-titulo" value="${escapeAttr(n.titulo || "")}" placeholder="Título (opcional)" aria-label="Título"></div>
    <div class="field"><textarea class="input" id="ne-texto" style="min-height:140px" aria-label="Texto">${escapeHtml(n.texto || "")}</textarea>
      <div class="text-xs muted mt-8">Etiquetas: escribe #palabra en el texto.</div></div>
    <div class="field"><label>Color</label><div class="row" style="gap:8px" id="ne-colores">${NOTA_COLORES.map(c => `<button type="button" class="nota-color${(n.color || "") === c ? " is-on" : ""}" data-c="${c}" style="background:${c || "var(--surface-3)"}" onclick="notaColor(this)" aria-label="${c ? "Color" : "Sin color"}"></button>`).join("")}</div></div>
    <button class="btn btn--primary btn-block" data-action="nota-guardar">Guardar</button>
    <div class="row mt-8" style="gap:8px;flex-wrap:wrap">
      <button class="btn-ghost" data-action="nota-fijar">${n.fijada ? "📌 Desfijar" : "📌 Fijar"}</button>
      <button class="btn-ghost" data-action="nota-tarea">☑ A tarea de hoy</button>
      <button class="btn-ghost" data-action="nota-archivar">${n.archivada ? "↩ Sacar del archivo" : "🗄 Archivar"}</button>
      <button class="btn-ghost" data-action="nota-borrar" style="color:var(--coral)">🗑 Borrar</button></div>`);
}
function notaColor(btn) {
  document.querySelectorAll("#ne-colores .nota-color").forEach(b => b.classList.remove("is-on"));
  btn.classList.add("is-on");
}
function notaActual() { return postits().find(x => x.id === NOTA_EDIT); }
function notaGuardar() {
  const n = notaActual(); if (!n) return;
  const texto = document.getElementById("ne-texto").value.trim(), titulo = val("ne-titulo");
  if (!texto && !titulo) return notaBorrar(true);
  const color = (document.querySelector("#ne-colores .nota-color.is-on") || {}).dataset;
  // Conserva las etiquetas que vinieron de una categoría y suma las del texto
  const deCat = (n.etiquetas || []).filter(e => !etiquetasDe(n.texto).includes(e));
  Object.assign(n, { titulo, texto, etiquetas: [...new Set([...deCat, ...etiquetasDe(texto)])], color: color ? color.c : n.color, ts: Date.now() });
  saveState(); closeModal(); rerender();
}
function notaFijar() { const n = notaActual(); if (!n) return; n.fijada = !n.fijada; n.ts = Date.now(); saveState(); closeModal(); rerender(); }
function notaArchivar() {
  const n = notaActual(); if (!n) return;
  n.archivada = !n.archivada; if (n.archivada) n.fijada = false; n.ts = Date.now();
  saveState(); closeModal(); rerender(); toast(n.archivada ? "🗄 Nota archivada" : "Nota de vuelta");
}
function notaBorrar(sinPreguntar) {
  const n = notaActual(); if (!n) return;
  if (!sinPreguntar && !confirm("¿Borrar esta nota?")) return;
  n.borrada = true; n.ts = Date.now(); saveState(); closeModal(); rerender(); toast("Nota borrada");
}
function notaATarea() {
  const n = notaActual(); if (!n) return;
  const txt = (n.titulo || n.texto || "").replace(/#[\p{L}\p{N}_-]+/gu, "").trim().split("\n")[0].slice(0, 140);
  if (!txt) return;
  nuevaTarea(STATE, todayISO(), { txt, ambito: (n.etiquetas || []).includes("trabajo") ? "pro" : "per" });
  n.archivada = true; n.fijada = false; n.ts = Date.now();
  saveState(); closeModal(); rerender(); toast("☑ Pasó a tus tareas de hoy");
}
