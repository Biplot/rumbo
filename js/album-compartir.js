/* ============================================================
   RUMBO · Compartir el álbum del mes (en Instagram, WhatsApp…)
   Cada página se vuelve una imagen tal como se ve en la app (html2canvas-pro, que se baja
   la primera vez que compartes) y se enmarca con el fondo de su estilo: publicación
   (1080 × 1350, el carrusel de Instagram) o historia (1080 × 1920). Se comparte con el menú
   del teléfono o, en el computador, se descarga. Las imágenes se arman en tu equipo y solo
   salen de la app si tú las compartes.
   ============================================================ */
const ALBUM_FORMATOS = {
  post: { nombre: "Publicación", ayuda: "4:5 · para el carrusel de Instagram", ancho: 1080, alto: 1350, arriba: 54, abajo: 112, lado: 54 },
  historia: { nombre: "Historia", ayuda: "9:16 · para historias y estados", ancho: 1080, alto: 1920, arriba: 250, abajo: 180, lado: 80 },
};
/* El fondo del marco según el estilo: [arriba, abajo, letra] */
const ALBUM_FONDOS = {
  clasico: ["#ECE7DD", "#D6CDBE", "#2B2F3F"], bujo: ["#E6EAF7", "#C7CFEE", "#2F3DA8"], polaroid: ["#DCD6E6", "#B9AECC", "#45395F"],
  pelicula: ["#222222", "#050505", "#F4AE3D"], kraft: ["#A17B54", "#6B4F33", "#F6EAD6"], postal: ["#BCD3E2", "#86A9C2", "#1C4463"],
  revista: ["#2B2B2B", "#090909", "#FFD27A"], noche: ["#18205A", "#03040F", "#FFE7A8"],
};
const ALBUM_H2C = "js/vendor/html2canvas-pro-2.5.2.min.js";
/* Lo que está abierto: el mes, el formato, las páginas ya dibujadas (canvas) y las imágenes enmarcadas */
let ALB_COMP = null;

/* Dónde va la página dentro del marco: lo más grande que quepa entre los márgenes, centrada */
function albumEncaje(pw, ph, F) {
  const libreW = F.ancho - 2 * F.lado, libreH = F.alto - F.arriba - F.abajo;
  const s = Math.min(libreW / pw, libreH / ph), w = Math.round(pw * s), h = Math.round(ph * s);
  return { x: Math.round((F.ancho - w) / 2), y: Math.round(F.arriba + (libreH - h) / 2), w, h };
}
function albumNombreArchivo(key, i) { const { y, m } = mesDeKey(key); return `rumbo-album-${MESES[m].toLowerCase()}-${y}-${i + 1}.jpg`; }

/* html2canvas-pro, una sola vez (si falla la red, se reintenta la próxima) */
let ALBUM_H2C_CARGA = null;
function albumH2C() {
  if (typeof html2canvas === "function") return Promise.resolve();
  if (!ALBUM_H2C_CARGA) ALBUM_H2C_CARGA = new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = ALBUM_H2C; s.async = true;
    s.onload = ok; s.onerror = () => { s.remove(); ALBUM_H2C_CARGA = null; mal(new Error("html2canvas")); };
    document.head.appendChild(s);
  });
  return ALBUM_H2C_CARGA;
}
/* Las páginas del mes como imágenes: se arman fuera de la pantalla (540 px de ancho, al doble) */
async function albumPaginasImagen(key, avance) {
  await albumH2C();
  albumFuentes();
  const host = document.createElement("div");
  host.className = "alb-lienzo"; host.setAttribute("aria-hidden", "true");
  host.innerHTML = albumPaginasHtml(key);
  host.querySelectorAll("img").forEach(img => { img.loading = "eager"; });   // fuera de la pantalla, las «lazy» no cargarían nunca
  await albumPintar(host);   // las fotos, antes de entrar al documento (así no las toma otro pintado)
  // las que vienen del servidor se traen como blob: así el dibujo no depende de los permisos (CORS) de la dirección firmada
  const propias = [];
  await Promise.all([...host.querySelectorAll("img[src^='http']")].map(async img => {
    try { const r = await fetch(img.src); if (r.ok) { const u = URL.createObjectURL(await r.blob()); propias.push(u); img.src = u; } } catch (e) { /* queda la dirección firmada */ }
  }));
  document.body.appendChild(host);
  try {
    await Promise.all([...host.querySelectorAll("img")].map(img => (img.complete && img.naturalWidth) || img.classList.contains("is-sin") ? null
      : new Promise(ok => { img.addEventListener("load", ok, { once: true }); img.addEventListener("error", ok, { once: true }); setTimeout(ok, 15000); })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const pags = [...host.querySelectorAll(".alb")], out = [];
    for (let i = 0; i < pags.length; i++) {
      if (avance) avance(i, pags.length);
      const pg = pags[i];
      out.push(await html2canvas(pg, { scale: 2, backgroundColor: null, logging: false, useCORS: true,
        // solo se copia lo que hace falta: los estilos y la página (el resto de la app no)
        ignoreElements: el => el.nodeType === 1 && !(el.contains(pg) || pg.contains(el) || el.closest("head")) }));
    }
    return out;
  } finally { host.remove(); propias.forEach(u => URL.revokeObjectURL(u)); }
}
/* Una página en su marco: el fondo del estilo, la página con sombra y el nombre del mes */
function albumEnmarcar(pagina, i, n, key, formato, estilo) {
  const F = ALBUM_FORMATOS[formato], [a, b, tinta] = ALBUM_FONDOS[estilo] || ALBUM_FONDOS.clasico, { y, m } = mesDeKey(key);
  const c = document.createElement("canvas"); c.width = F.ancho; c.height = F.alto;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, F.alto);
  g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, F.ancho, F.alto);
  const r = albumEncaje(pagina.width, pagina.height, F), radio = 18;
  const forma = () => { x.beginPath(); if (x.roundRect) x.roundRect(r.x, r.y, r.w, r.h, radio); else x.rect(r.x, r.y, r.w, r.h); };
  x.save(); x.shadowColor = "rgba(10, 12, 30, .38)"; x.shadowBlur = 44; x.shadowOffsetY = 18; x.fillStyle = a; forma(); x.fill(); x.restore();
  x.save(); forma(); x.clip(); x.drawImage(pagina, r.x, r.y, r.w, r.h); x.restore();
  const letra = ((typeof getComputedStyle === "function" && getComputedStyle(document.documentElement).getPropertyValue("--font-display")) || "").trim() || "sans-serif";
  x.fillStyle = tinta; x.textBaseline = "alphabetic";
  if (formato === "historia") {
    x.textAlign = "center";
    x.font = `700 68px ${letra}`; x.fillText(`Álbum de ${MESES[m].toLowerCase()}`, F.ancho / 2, 148);
    x.globalAlpha = .75; x.font = `600 34px ${letra}`; x.fillText(n > 1 ? `${y} · ${i + 1} de ${n}` : String(y), F.ancho / 2, 204);
    x.font = `600 30px ${letra}`; x.fillText("Rumbo", F.ancho / 2, F.alto - 82);
  } else {
    const base = F.alto - 46;
    x.textAlign = "left"; x.font = `700 34px ${letra}`; x.fillText(`Álbum de ${MESES[m].toLowerCase()} · ${y}`, F.lado, base);
    x.textAlign = "right"; x.globalAlpha = .75; x.font = `600 30px ${letra}`; x.fillText(n > 1 ? `${i + 1}/${n} · Rumbo` : "Rumbo", F.ancho - F.lado, base);
  }
  x.globalAlpha = 1;
  return c;
}

/* -------- La hoja «Compartir el álbum» -------- */
function openAlbumCompartir(key) {
  const a = albumMes(key); if (!a || !a.fotos.length) return;
  albumCompLimpiar();
  ALB_COMP = { key, formato: (ALB_COMP && ALB_COMP.formato) || "post", paginas: null, elegidas: [], imgs: [], error: false, avance: "" };
  renderAlbumCompartir();
  albumCompPreparar();
}
function albumCompLimpiar() { if (ALB_COMP) (ALB_COMP.imgs || []).forEach(x => x && URL.revokeObjectURL(x.url)); }
function renderAlbumCompartir() {
  const c = ALB_COMP; if (!c) return;
  const { m } = mesDeKey(c.key), F = ALBUM_FORMATOS[c.formato], listo = c.imgs.length && c.imgs.every(Boolean), n = c.elegidas.filter(Boolean).length;
  const vistas = c.error ? `<div class="alb-comp__msg">${icoUI("triangle-alert")} No pude preparar las imágenes. Revisa tu conexión y vuelve a intentarlo.
      <button class="btn btn--soft" data-action="alb-comp-reintentar">Reintentar</button></div>`
    : !listo ? `<div class="alb-comp__msg"><span class="alb-comp__girando"></span> ${c.avance || "Preparando las páginas…"}</div>`
    : c.imgs.map((x, i) => `<button type="button" class="alb-comp__v alb-comp__v--${c.formato}${c.elegidas[i] ? " is-on" : ""}" data-action="alb-comp-pag" data-i="${i}"
        aria-pressed="${c.elegidas[i] ? "true" : "false"}" aria-label="Página ${i + 1}"><img src="${x.url}" alt=""><i>${icoUI("hecho")}</i></button>`).join("");
  const html = `<div class="alb-comp" id="alb-comp">
    <div class="seg">${Object.entries(ALBUM_FORMATOS).map(([k, f]) => `<button type="button" class="${k === c.formato ? "is-active" : ""}" data-action="alb-comp-formato" data-v="${k}">${f.nombre}</button>`).join("")}</div>
    <p class="text-xs muted" style="margin:0">${F.ayuda}${listo && c.imgs.length > 1 ? " · toca una página para dejarla fuera" : ""}</p>
    <div class="alb-comp__vistas">${vistas}</div>
    <div class="alb-comp__acc"><button class="btn btn--primary" data-action="alb-comp-enviar" ${listo && n ? "" : "disabled"}>${icoUI("compartir")} Compartir${listo && c.imgs.length > 1 ? ` ${n === 1 ? "1 página" : n + " páginas"}` : ""}</button>
      <button class="btn btn--soft" data-action="alb-comp-bajar" ${listo && n ? "" : "disabled"}>${icoUI("download")} Descargar</button></div>
    <p class="text-xs muted" style="margin:0">Las imágenes se crean en tu equipo. Solo salen de la app si tú las compartes.</p>
    <button class="btn-link" data-action="alb-ver" data-key="${escapeHtml(c.key)}">← Volver al álbum</button></div>`;
  if (document.getElementById("alb-comp")) document.getElementById("alb-comp").outerHTML = html;
  else openModal(`Compartir el álbum de ${MESES[m].toLowerCase()}`, html);
}
/* ¿Sigue abierta la hoja de este mes? (si la cerraste mientras se armaba, no se dibuja nada) */
function albumCompAbierta(c) { return ALB_COMP === c && !!document.getElementById("alb-comp"); }
async function albumCompPreparar() {
  const c = ALB_COMP; c.error = false;
  try {
    const estilo = albumEstilo(albumMes(c.key));
    c.paginas = await albumPaginasImagen(c.key, (i, n) => { c.avance = n > 1 ? `Preparando la página ${i + 1} de ${n}…` : "Preparando la página…"; if (albumCompAbierta(c)) renderAlbumCompartir(); });
    c.estilo = estilo; c.elegidas = c.paginas.map(() => true);
    await albumCompEnmarcar(c);
  } catch (e) { c.error = true; }
  if (albumCompAbierta(c)) renderAlbumCompartir();
}
async function albumCompEnmarcar(c) {
  albumCompLimpiar();
  c.imgs = c.paginas.map(() => null);
  const formato = c.formato;
  for (let i = 0; i < c.paginas.length; i++) {
    const cv = albumEnmarcar(c.paginas[i], i, c.paginas.length, c.key, formato, c.estilo);
    const blob = await new Promise(ok => cv.toBlob(ok, "image/jpeg", .92));
    if (c.formato !== formato) return;   // cambiaste de formato mientras tanto
    c.imgs[i] = { blob, url: URL.createObjectURL(blob) };
  }
}
async function albumCompFormato(v) {
  const c = ALB_COMP; if (!c || !ALBUM_FORMATOS[v] || c.formato === v) return;
  c.formato = v;
  if (!c.paginas) return renderAlbumCompartir();
  c.imgs = []; renderAlbumCompartir();
  await albumCompEnmarcar(c);
  if (albumCompAbierta(c) && c.formato === v) renderAlbumCompartir();
}
function albumCompArchivos() {
  const c = ALB_COMP;
  return c.imgs.map((x, i) => (c.elegidas[i] && x ? new File([x.blob], albumNombreArchivo(c.key, i), { type: "image/jpeg" }) : null)).filter(Boolean);
}
async function albumCompEnviar() {
  const c = ALB_COMP; if (!c || !c.imgs.length) return;
  const files = albumCompArchivos(); if (!files.length) return;
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: `Álbum de ${MESES[mesDeKey(c.key).m].toLowerCase()}` });
      if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu álbum");
      return;
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  albumCompBajar(files);   // sin menú de compartir (computador): se descargan
}
async function albumCompBajar(files) {
  files = files || albumCompArchivos(); if (!files.length) return;
  for (const f of files) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (files.length > 1) await new Promise(ok => setTimeout(ok, 350));
  }
  toast(files.length === 1 ? "🖼️ Imagen descargada" : `🖼️ ${files.length} imágenes descargadas`);
  if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu álbum");
}
function albumCompAccion(a, d) {
  const c = ALB_COMP;
  if (a === "alb-compartir") return openAlbumCompartir(d.key);
  if (!c) return;
  if (a === "alb-comp-formato") return albumCompFormato(d.v);
  if (a === "alb-comp-pag") { const i = +d.i; if (c.elegidas.length > 1 && c.elegidas[i] !== undefined) { c.elegidas[i] = !c.elegidas[i]; renderAlbumCompartir(); } return; }
  if (a === "alb-comp-enviar") return albumCompEnviar();
  if (a === "alb-comp-bajar") return albumCompBajar();
  if (a === "alb-comp-reintentar") { c.paginas = null; c.imgs = []; c.avance = ""; renderAlbumCompartir(); return albumCompPreparar(); }
}
