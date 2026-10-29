/* ============================================================
   RUMBO · El camino del año (Tendencias › Tu evolución)
   Las medallas que ganaste en el año aparecen en el sendero en el día en que pasó,
   como hitos con la forma de su familia: faro (rachas), bandera (grandes hitos),
   portal (tareas y foco), farol (rituales), piedras (hábitos) y casita (tu vida).
   Tocar un hito abre su medalla de cerca (cielo.js). Se puede compartir como imagen.
   El 3D vive en cielo-3d.js; sin WebGL queda la lista de medallas con su fecha.
   ============================================================ */

/* Las medallas ganadas en un año (del ledger), en orden, con su lugar en el sendero:
   u = 0 el 1 de enero, u = 1 el 31 de diciembre a medianoche */
function medallasDelAnio(s, y) {
  const g = (s.gamif && s.gamif.badges) || [], ini = new Date(y, 0, 1).getTime(), fin = new Date(y + 1, 0, 1).getTime();
  return ((s.gamif && s.gamif.ledger) || [])
    .filter(m => m && !m.anulado && typeof m.id === "string" && m.id.startsWith("insignia:") && m.ts >= ini && m.ts < fin)
    .sort((a, b) => a.ts - b.ts)
    .map(m => ({ id: m.id.slice(9), ts: m.ts, u: (m.ts - ini) / (fin - ini), iso: isoLocal(new Date(m.ts)) }))
    .filter(x => g.includes(x.id) && findBadge(x.id));
}
function medallasDelTrimestre(s, y, q) { return medallasDelAnio(s, y).filter(m => Math.floor(new Date(m.ts).getMonth() / 3) === q); }
/* Dónde va «estás aquí»: hoy, si es el año que se mira; al final, si ya pasó */
function caminoHoy(y) {
  const ini = new Date(y, 0, 1).getTime(), fin = new Date(y + 1, 0, 1).getTime(), ahora = Date.now();
  return ahora < ini ? 0 : ahora >= fin ? 1 : (ahora - ini) / (fin - ini);
}
function fechaMedalla(ts) { const d = new Date(ts); return `${d.getDate()} ${CIELO_MESES[d.getMonth()]}`; }

/* Lo que el motor necesita para dibujar el camino del año que se mira */
function caminoDatos() {
  const y = typeof anioVista === "function" ? anioVista() : new Date().getFullYear();
  return { y, medallas: medallasDelAnio(STATE, y), hoy: caminoHoy(y) };
}

/* -------- La tarjeta en Tendencias -------- */
function chipsMedallas(lista) {
  return lista.map(m => { const b = findBadge(m.id); return `<button class="med-chip" data-action="ins-ver" data-id="${m.id}">${medChip(b, `${escapeHtml(b.nombre)} <small class="med-chip__f">${fechaMedalla(m.ts)}</small>`)}</button>`; }).join("");
}
function caminoCardHtml(y) {
  const l = medallasDelAnio(STATE, y), actual = y === anioActual(), futuro = y > anioActual();
  const porTri = [0, 1, 2, 3].map(q => l.filter(m => Math.floor(new Date(m.ts).getMonth() / 3) === q).length);
  const vacio = futuro ? `${y} aún no empieza: su camino está por hacerse.` : `Aún no hay medallas en tu camino de ${y}. Cada una que ganes queda aquí, en su día.`;
  return `<div class="card camino-card${CIELO_ESTADO.sin3d ? " is-sin3d" : ""}" style="margin-bottom:18px">
    <div class="card__head"><div class="card__title">🛤️ Tu camino de ${y}</div>
      <span class="card__hint">${l.length === 1 ? "1 medalla" : `${l.length} medallas`}${actual ? " hasta hoy" : ""}</span></div>
    <section class="camino" id="camino" data-gesto aria-label="Tu camino de ${y}">
      <div class="camino__lienzo" id="caminoLienzo" role="img" aria-label="El sendero de ${y}, de enero a diciembre, con ${l.length} medallas en el día en que las ganaste. Abajo está la lista."></div>
      <div class="cielo__etq" id="caminoEtq" hidden></div>
      ${l.length ? "" : `<div class="camino__vacio">${vacio}</div>`}
      <div class="camino__carga" aria-hidden="true">Trazando el camino…</div>
    </section>
    <div class="camino__tris" aria-label="Medallas por trimestre">${porTri.map((n, q) => `<span><b>T${q + 1}</b> ${n}</span>`).join("")}</div>
    ${l.length ? `<details class="camino__det"${CIELO_ESTADO.sin3d ? " open" : ""}><summary>Ver la lista</summary><div class="recibo__meds-l">${chipsMedallas(l)}</div></details>
    <div class="camino__pie"><button class="btn btn--soft" data-action="camino-compartir" data-y="${y}">${typeof iconoLinea === "function" ? iconoLinea("compartir", 18) : ""}Compartir mi camino</button></div>`
    : `<p class="text-sm muted camino__vacio-txt">${vacio}</p>`}
  </div>`;
}

/* -------- En los cierres: las medallas del trimestre o del año -------- */
function medallasCierreHtml(lista, titulo, pie) {
  if (!lista.length) return "";
  return `<div class="cierre-meds"><div class="recibo__k">${titulo} · ${lista.length}</div>
    <div class="recibo__meds-l">${chipsMedallas(lista)}</div>${pie ? `<p class="text-xs muted mt-8">${pie}</p>` : ""}</div>`;
}

/* -------- Compartir: una imagen vertical con la foto del camino -------- */
async function imagenCamino(y) {
  const l = medallasDelAnio(STATE, y), W = 1080, H = 1920;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  try { await Promise.all(["800 300px 'Inter Tight'", "700 60px 'Inter Tight'", "600 40px 'Inter Tight'"].map(f => document.fonts.load(f))); } catch (e) {}
  const F = (w, px) => `${w} ${px}px 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const CORAL = "#E8563A", GRIS = "#A9A9AE";
  g.fillStyle = "#0B0B0C"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#FFFFFF"; g.font = F(800, 72); g.textBaseline = "alphabetic";
  g.fillText("rumbo", 96, 180);
  g.fillStyle = CORAL; g.beginPath(); g.arc(96 + g.measureText("rumbo").width + 20, 168, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = GRIS; g.font = F(600, 40); g.fillText(`MI CAMINO DE ${y}`, 96, 260);
  // La foto del camino (3D) o, sin WebGL, el sendero dibujado con un punto por medalla
  const foto = CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d ? CIELO_ESTADO.motor.foto(1080, 900) : null;
  const img = foto ? await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = foto; }) : null;
  g.save(); g.beginPath(); g.roundRect ? g.roundRect(60, 320, 960, 800, 40) : g.rect(60, 320, 960, 800); g.clip();
  if (img) g.drawImage(img, 60 - 60, 320 - 50, 1080, 900);
  else {
    g.fillStyle = "#14231A"; g.fillRect(60, 320, 960, 800);
    const P = t => [140 + t * 800, 720 + Math.sin(t * Math.PI * 3) * 220];
    g.strokeStyle = CORAL; g.lineWidth = 18; g.lineCap = "round"; g.beginPath();
    for (let t = 0; t <= 1.0001; t += 0.01) { const p = P(t); if (t) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); } g.stroke();
    l.forEach(m => { const p = P(m.u), b = findBadge(m.id); g.fillStyle = CIELO_METALES[cieloMetal(b)].css; g.beginPath(); g.arc(p[0], p[1], 22, 0, Math.PI * 2); g.fill(); });
  }
  g.restore();
  // Cuántas, en grande, y al lado lo que son
  g.fillStyle = "#FFFFFF"; g.font = F(800, 260); g.fillText(String(l.length), 84, 1400);
  const xn = 84 + g.measureText(String(l.length)).width + 36;
  g.font = F(700, 64); g.fillText(l.length === 1 ? "medalla" : "medallas", xn, 1310); g.fillText(`en ${y}`, xn, 1390);
  // Las tres más valiosas, con su fecha
  const top = l.slice().sort((a, b) => (CASA_PESO[cieloMetal(findBadge(b.id))] - CASA_PESO[cieloMetal(findBadge(a.id))]) || b.ts - a.ts).slice(0, 3);
  g.font = F(600, 42); g.fillStyle = "#D4D4D8";
  top.forEach((m, i) => {
    let t = `${findBadge(m.id).nombre} · ${fechaMedalla(m.ts)}`;
    while (g.measureText(t).width > 888 && t.length > 4) t = t.slice(0, -2) + "…";
    g.fillText(t, 96, 1500 + i * 66);
  });
  g.fillStyle = "#FFFFFF"; g.font = F(700, 50); g.fillText("Mi año tiene rumbo.", 96, 1800);
  g.fillStyle = GRIS; g.font = F(600, 40); g.fillText("rumbo.biplot.cl", 96, 1862);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
async function compartirCamino(y) {
  const blob = await imagenCamino(y);
  if (!blob) return toast("No se pudo crear la imagen", true);
  const n = medallasDelAnio(STATE, y).length, nombre = `rumbo-camino-${y}.png`;
  const texto = `Mi camino de ${y}: ${n} ${n === 1 ? "medalla" : "medallas"} con Rumbo · rumbo.biplot.cl`;
  try {
    const file = new File([blob], nombre, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Imagen descargada: compártela donde quieras");
}
