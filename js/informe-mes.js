/* ============================================================
   RUMBO · Informe mensual para compartir ("📤 Compartir mi mes")
   Dibuja una imagen vertical (1080 × 1920, formato historia) con los números
   del mes y la comparte con el menú del teléfono, o la descarga en el computador.
   Nada sale de la app sin que la persona lo decida; el ahorro va oculto por defecto.
   ============================================================ */

const INFORME = { ancho: 1080, alto: 1920 };
let INFORME_OP = null;
let INFORME_ELE = null;   // imagen de tu elefante (se prepara al abrir el informe)   // { key, foco, mejor, nota, ahorro }

/* Datos del informe de un mes */
function datosInforme(key) {
  if (String(key).startsWith("anio:")) return datosInformeAnio(+key.slice(5));   // 🗂️ Informe del año (funciones.js)
  const { y, m } = mesDeKey(key);
  const r = resumenMes(y, m), rm = ritualMes(key) || {};
  const diasMes = daysInMonth(y, m);
  const hoy = agDate(todayISO());
  const diasTranscurridos = hoy.getFullYear() === y && hoy.getMonth() === m ? hoy.getDate() : diasMes;
  const tm = tmResumen(STATE, isoLocal(new Date(y, m, 1)), isoLocal(new Date(y, m + 1, 0)));
  return {
    y, m, mes: MESES[m], foco: (rm.apertura || {}).foco || "", mejor: (rm.cierre || {}).mejor || "",
    nota: (rm.cierre || {}).nota || null, cerrado: !!rm.cierre,
    habitos: r.habitos, cerrados: r.cerrados, dias: diasTranscurridos, bocados: r.bocados,
    objetivos: r.objetivos, tareas: tm.tareas ? tm.cumplimiento : null, postergacion: r.postergacion,
    ahorro: r.ahorro, metaAhorro: r.metaAhorro, nombre: (STATE.profile && STATE.profile.name) || "",
  };
}

/* Texto en varias líneas dentro de un ancho (devuelve la y final) */
function informeTexto(ctx, texto, x, y, ancho, alto, maxLineas) {
  const palabras = String(texto).split(/\s+/), lineas = [];
  let l = "";
  palabras.forEach(p => { const t = l ? l + " " + p : p; if (ctx.measureText(t).width > ancho && l) { lineas.push(l); l = p; } else l = t; });
  if (l) lineas.push(l);
  const vis = lineas.slice(0, maxLineas || 99);
  if (lineas.length > vis.length) vis[vis.length - 1] = vis[vis.length - 1].replace(/\s*\S*$/, "") + "…";
  vis.forEach((t, i) => ctx.fillText(t, x, y + i * alto));
  return y + vis.length * alto;
}

/* Dibuja el informe en un canvas y lo devuelve */
function dibujarInforme(d, op) {
  const W = INFORME.ancho, H = INFORME.alto;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  // Paleta: Navy incluida; Cuaderno, Atardecer y Terminal se compran en la Tienda (cosmeticos.js)
  const P = (typeof PALETAS_INFORME !== "undefined" && PALETAS_INFORME[op.plantilla]) || { arriba: "#0E2A47", abajo: "#081A2E", marca: "#0E2A47", acento: "#17C3B2", acento2: "#FF6B4A", texto: "#EAF2F8", suave: "#9FB3C8",
    halo1: "rgba(23,195,178,0.20)", halo2: "rgba(255,107,74,0.14)", tarjeta: "rgba(255,255,255,0.06)", borde: "rgba(255,255,255,0.10)", fuente: `"Space Grotesk", system-ui, sans-serif` };
  const F = (peso, px, titulo) => `${peso} ${px}px ${titulo && P.titulo ? P.titulo : P.fuente}`;
  const NAVY = P.arriba, NOCHE = P.abajo, CIAN = P.acento, CORAL = P.acento2, TXT = P.texto, SUAVE = P.suave;
  const MAY = t => (P.mayus ? String(t).toUpperCase() : t);

  // Fondo: azul profundo con un halo cian arriba y coral abajo
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, NAVY); g.addColorStop(1, NOCHE);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const halo = (cx, cy, r, color) => { const h = x.createRadialGradient(cx, cy, 0, cx, cy, r); h.addColorStop(0, color); h.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = h; x.fillRect(0, 0, W, H); };
  halo(W * 0.85, 160, 620, P.halo1);
  halo(W * 0.1, H - 180, 560, P.halo2);
  if (P.puntos) { x.fillStyle = P.puntos; for (let py = 20; py < H; py += 44) for (let px = 20; px < W; px += 44) { x.beginPath(); x.arc(px, py, 2.2, 0, Math.PI * 2); x.fill(); } }
  if (P.lineas) { x.fillStyle = "rgba(57,255,136,0.035)"; for (let py = 0; py < H; py += 6) x.fillRect(0, py, W, 2); }

  // Marca: el ícono de Rumbo ("el bocado": un círculo con un bocado y la flecha que apunta ahí) + nombre
  const M = 96, mx = 90, my = 110, u = M / 100, px = v => mx + v * u, py = v => my + v * u;
  x.fillStyle = P.marca; x.strokeStyle = CIAN; x.lineWidth = 3;
  x.beginPath(); x.roundRect(mx, my, M, M, P.radio || 24); x.fill(); x.stroke();
  const circ = (cx, cy, r, color) => { x.fillStyle = color; x.beginPath(); x.arc(px(cx), py(cy), r * u, 0, Math.PI * 2); x.fill(); };
  circ(48, 54, 32, CIAN);
  [[72, 31, 13], [59, 21, 8.5], [82, 45, 8.5]].forEach(([cx, cy, r]) => circ(cx, cy, r, P.marca));   // el bocado
  x.strokeStyle = P.marca; x.lineWidth = 7.5 * u; x.lineCap = "round"; x.lineJoin = "round";
  x.beginPath(); x.moveTo(px(32), py(72)); x.lineTo(px(54), py(50)); x.stroke();
  x.beginPath(); x.moveTo(px(41), py(48)); x.lineTo(px(55), py(48)); x.lineTo(px(55), py(62)); x.stroke();
  circ(73, 30, 5.5, CORAL);
  x.fillStyle = TXT; x.font = F(700, 48, true); x.textBaseline = "alphabetic"; x.fillText("Rumbo", mx + M + 28, my + 58);
  x.fillStyle = SUAVE; x.font = F(500, 28); x.fillText((d.sub || "Mi mes") + (d.nombre ? " · " + d.nombre : ""), mx + M + 30, my + 96);

  // Título: el mes
  let y = 390;
  x.fillStyle = CIAN; x.font = F(600, 34); x.fillText(d.etiqueta || String(d.y), 90, y - 96);
  x.font = F(700, 150, true);
  const tam = Math.min(150, Math.floor(150 * (W - 180) / x.measureText(MAY(d.mes)).width));
  x.fillStyle = TXT; x.font = F(700, tam, true); x.fillText(MAY(d.mes), 84, y + 40);
  y += 110;
  if (op.foco && d.foco) { x.fillStyle = SUAVE; x.font = F(500, 38); x.fillText("Foco: ", 90, y); const w = x.measureText("Foco: ").width; x.fillStyle = CORAL; x.font = F(700, 38); x.fillText(d.foco, 90 + w, y); y += 30; }

  // Nota del mes (círculo, arriba a la derecha junto a la marca)
  if (op.nota && d.nota) {
    const r = 78, cx = W - 90 - r, cy = my + M / 2 - 6;
    x.lineWidth = 16; x.strokeStyle = P.borde; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = CORAL; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * d.nota) / 10); x.stroke();
    x.fillStyle = TXT; x.textAlign = "center"; x.font = F(700, 72); x.fillText(String(d.nota), cx, cy + 25);
    x.fillStyle = SUAVE; x.font = F(500, 24); x.fillText(d.notaLabel || "nota del mes", cx, cy + r + 44); x.textAlign = "left";
  }

  // Tarjetas: 2 columnas × 3 filas
  const pct = v => (v == null ? "—" : v + "%");
  const COL = { cian: CIAN, coral: CORAL, suave: SUAVE };
  const tarjetas = d.tarjetas ? d.tarjetas.map(t => ({ v: t.v, l: t.l, color: COL[t.c] || CIAN })).filter(t => t.v !== "—") : [
    { v: pct(d.habitos), l: "hábitos cumplidos", color: CIAN },
    { v: `${d.cerrados}/${d.dias}`, l: "días cerrados", color: CIAN },
    { v: String(d.bocados), l: "primeros bocados 🐘", color: CORAL },
    { v: d.objetivos[1] ? `${d.objetivos[0]}/${d.objetivos[1]}` : "—", l: "objetivos del mes", color: CORAL },
    { v: pct(d.tareas), l: "tareas completadas", color: CIAN },
    { v: pct(d.postergacion), l: "postergación", color: SUAVE },
  ].filter(t => t.v !== "—");   // sin datos no se muestra
  if (op.ahorro) tarjetas.push({ v: fmtCLP(d.ahorro), l: d.tarjetas ? "ahorro del año" : "ahorro del mes", color: CIAN });
  if (tarjetas.length % 2) tarjetas[tarjetas.length - 1].ancho = true;   // la última sola ocupa todo el ancho
  const top = 640, gap = 28, cw = (W - 180 - gap) / 2, ch = 230;
  tarjetas.forEach((t, i) => {
    const col = t.ancho ? 0 : i % 2, fila = Math.floor(i / 2);   // "ancho" solo puede ser la última
    const tx = 90 + col * (cw + gap), ty = top + fila * (ch + gap), tw = t.ancho ? W - 180 : cw;
    x.fillStyle = P.tarjeta; x.strokeStyle = P.borde; x.lineWidth = 2;
    x.beginPath(); x.roundRect(tx, ty, tw, ch, P.radio || 28); x.fill(); x.stroke();
    x.fillStyle = t.color; x.fillRect(tx + 36, ty + 40, 44, 6);
    x.font = F(700, 88, true);
    const tv = Math.min(88, Math.floor(88 * (tw - 70) / x.measureText(t.v).width));   // que el número quepa en la tarjeta
    x.fillStyle = TXT; x.font = F(700, tv, true); x.fillText(t.v, tx + 34, ty + 140);
    x.fillStyle = SUAVE; x.font = F(500, 30); x.fillText(t.l, tx + 36, ty + 192);
  });
  y = top + Math.ceil(tarjetas.length / 2) * (ch + gap) + 40;

  // Lo mejor del mes (cita)
  if (op.mejor && d.mejor && y < H - 360) {
    x.fillStyle = CORAL; x.font = F(700, 110); x.fillText("“", 84, y + 70);
    x.fillStyle = SUAVE; x.font = F(600, 28); x.fillText("LO MEJOR DEL MES", 170, y + 20);
    x.fillStyle = TXT; x.font = F(500, 42);
    informeTexto(x, d.mejor, 170, y + 80, W - 260, 56, 4);
  }

  // Tu elefante (con su tipo, etapa y ropa), sobre el pie a la derecha
  if (INFORME_ELE) x.drawImage(INFORME_ELE, W - 90 - 230, H - 190 - 212, 230, 212);
  // Pie
  x.fillStyle = P.borde; x.fillRect(90, H - 170, W - 180, 2);
  x.fillStyle = TXT; x.font = F(600, 32); x.fillText("Hecho con Rumbo", 90, H - 104);
  x.fillStyle = SUAVE; x.font = F(500, 28); x.fillText("rumbo.biplot.cl · by BiPlot", 90, H - 62);
  x.textAlign = "right"; x.fillStyle = CIAN; x.font = F(600, 28); x.fillText("un bocado a la vez", W - 90, H - 62); x.textAlign = "left";
  return c;
}

/* -------- Modal: vista previa, qué mostrar, compartir o descargar -------- */
async function openInformeMes(key) {
  const rm = ritualMes(key) || {};
  const pal = typeof paletasDisponibles === "function" ? paletasDisponibles() : ["navy"];
  const ultima = (STATE.gamif.equipped || {}).plantilla;
  INFORME_OP = { key, foco: true, mejor: !!(rm.cierre && rm.cierre.mejor), nota: true, ahorro: false, plantilla: pal.includes(ultima) ? ultima : "navy" };
  if (typeof loadThemeFonts === "function") pal.forEach(p => loadThemeFonts(p));
  INFORME_ELE = typeof elefanteImagen === "function" ? await elefanteImagen() : null;
  if (document.fonts && document.fonts.load) { try { await Promise.all(['700 40px "Fraunces"', '500 30px "Karla"', '700 40px "IBM Plex Mono"'].map(f => document.fonts.load(f))); } catch (e) {} }
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  renderInformeModal();
}
function renderInformeModal() {
  const op = INFORME_OP, d = datosInforme(op.key);
  const url = dibujarInforme(d, op).toDataURL("image/png");
  const chk = (k, label, extra) => `<label class="chip" style="cursor:pointer"><input type="checkbox" ${op[k] ? "checked" : ""} onchange="informeOpcion('${k}', this.checked)"> ${label}${extra || ""}</label>`;
  openModal(`📤 Compartir ${d.mes}`, `
    <img src="${url}" alt="Vista previa del informe de ${d.mes}" class="informe-prev">
    ${typeof PALETAS_INFORME !== "undefined" ? `<div class="text-xs muted mt-16">Diseño</div>
    <div class="row-wrap mt-8" style="gap:6px">${Object.keys(PALETAS_INFORME).map(k => {
      const tiene = k === "navy" || isOwned("pla-" + k);
      return tiene ? `<button type="button" class="chip ${op.plantilla === k ? "chip--cian" : ""}" onclick="informeOpcion('plantilla','${k}')">${PALETAS_INFORME[k].nombre}</button>`
        : `<a class="chip" href="#tienda" onclick="closeModal()" title="Se desbloquea en la Tienda">🔒 ${PALETAS_INFORME[k].nombre}</a>`;
    }).join("")}</div>` : ""}
    <div class="text-xs muted mt-16">Qué mostrar</div>
    <div class="row-wrap mt-8" style="gap:6px">
      ${d.tarjetas ? chk("nota", "Nota del año") + chk("ahorro", "Ahorro 💰")
        : chk("foco", "Foco") + chk("nota", "Nota del mes", d.nota ? "" : " (al cerrar)") + chk("mejor", "Lo mejor del mes") + chk("ahorro", "Ahorro 💰")}
    </div>
    <div class="row mt-16" style="gap:8px">
      <button class="btn btn--primary" style="flex:1" data-action="informe-compartir">Compartir</button>
      <button class="btn btn--soft" data-action="informe-descargar">Descargar</button>
    </div>
    <p class="text-xs muted mt-8">La imagen se crea en tu equipo. Solo sale de la app si tú la compartes.</p>`);
}
function informeOpcion(k, v) {
  INFORME_OP[k] = v;
  if (k === "plantilla") { STATE.gamif.equipped.plantilla = v; saveState(); }   // recuerda la última elegida
  renderInformeModal();
}
function informeBlob() {
  const c = dibujarInforme(datosInforme(INFORME_OP.key), INFORME_OP);
  return new Promise(res => c.toBlob(res, "image/png"));
}
function nombreArchivoInforme() {
  if (String(INFORME_OP.key).startsWith("anio:")) return `rumbo-${INFORME_OP.key.slice(5)}.png`;
  const { y, m } = mesDeKey(INFORME_OP.key); return `rumbo-${MESES[m].toLowerCase()}-${y}.png`; }
async function compartirInforme() {
  const blob = await informeBlob(), nombre = nombreArchivoInforme();
  const file = typeof File === "function" ? new File([blob], nombre, { type: "image/png" }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Mi mes en Rumbo" }); if (typeof registrarCompartido === "function") registrarCompartido(); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  descargarInforme(blob);   // sin menú de compartir (computador): se descarga
}
async function descargarInforme(blob) {
  blob = blob || await informeBlob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombreArchivoInforme();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("🖼️ Imagen descargada");
  if (typeof registrarCompartido === "function") registrarCompartido();
}
