/* ============================================================
   RUMBO · 🎆 Tu año en Rumbo (v141): la historia de tu año en láminas para compartir
   Desde el 1 de diciembre (y todo enero, para el año que terminó): hasta 8 láminas de
   1080 × 1920 (formato historia de Instagram y WhatsApp), con lo que hiciste en el año.
   · Siempre la portada y el cierre (tu elefante, tus ⭐ y «nos vemos en el próximo»); entre
     medio, las que tienen datos, en este orden: días cerrados y tu mejor racha, tu hábito del
     año, tus medallas, tu agua, tus libros, objetivos y foco, tu ánimo y tu rueda (hasta 6).
   · Se ve como una historia (toca para avanzar, mantén para pausar) y se comparte una o todas.
   · Nada sale de la app sin que la persona lo decida. El ahorro nunca va en las láminas.
   Datos: lo que ya está en tu documento (nada nuevo que guardar, salvo `settings.tuAnioVisto`).
   ============================================================ */
const TU_ANIO = { W: 1080, H: 1920, MAX: 8 };
const TA = { y: 0, laminas: [], urls: [], i: 0, t: null, ini: 0, pausa: false, resto: 0, cargando: false };
const TA_MS = 6500;   // cuánto dura cada lámina en pantalla

/* -------- ¿Cuándo se puede ver? Desde el 1 de diciembre; en enero, la del año que terminó; los años anteriores, siempre -------- */
function tuAnioDisponible(y, hoy) {
  hoy = hoy || todayISO(); const ya = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
  return y < ya || (y === ya && m === 12);
}
/* El año que corresponde mostrar en Inicio (o null): diciembre → este año; enero → el que terminó */
function tuAnioDeTemporada(hoy) {
  hoy = hoy || todayISO(); const ya = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
  return m === 12 ? ya : m === 1 ? ya - 1 : null;
}

/* -------- Los datos del año -------- */
function tuAnioDatos(S, y, hoy) {
  S = S || STATE; hoy = hoy || todayISO();
  const pref = y + "-", ini = `${y}-01-01`, fin = hoy.startsWith(pref) ? hoy : `${y}-12-31`;
  // Días cerrados, tu mejor racha y el mapa del año (un punto por día)
  const dias = (S.ritual && S.ritual.dias) || {}, mapa = [];
  let cerrados = 0, racha = 0, desde = "", mejor = { n: 0, desde: "", hasta: "" };
  for (let d = ini; d <= `${y}-12-31`; d = agSumar(d, 1)) {
    const r = dias[d], c = !!(r && r.cerrado) && d <= fin; mapa.push(d > fin ? -1 : c ? 1 : 0);
    if (d > fin) continue;
    if (c) { cerrados++; if (!racha) desde = d; racha++; if (racha > mejor.n) mejor = { n: racha, desde, hasta: d }; }
    else if (d === hoy || (typeof diaCubierto === "function" && diaCubierto(S, d))) { /* hoy o un día protegido: no corta */ }
    else racha = 0;
  }
  // Hábitos: cuántas veces marcaste y tu hábito del año
  const porHab = {}; let marcas = 0;
  Object.entries((S.habitos && S.habitos.log) || {}).forEach(([k, hs]) => {
    if (!k.startsWith(pref)) return;
    Object.entries(hs || {}).forEach(([hid, ds]) => { const n = Object.values(ds || {}).filter(Boolean).length; marcas += n; porHab[hid] = (porHab[hid] || 0) + n; });
  });
  const topId = Object.keys(porHab).sort((a, b) => porHab[b] - porHab[a])[0], th = topId && (S.habitos.defs || []).find(h => h.id === topId);
  const pctHab = typeof cumplimientoGrupo === "function" && (S.habitos.defs || []).length ? cumplimientoGrupo(S.habitos.defs, ini, fin, S).pct : null;
  // Medallas ganadas en el año (su movimiento «insignia:<id>» trae la hora)
  const enAnio = ts => ts > 0 && new Date(ts).getFullYear() === y;
  const led = ((S.gamif && S.gamif.ledger) || []).filter(m => m && !m.anulado);
  const meds = (typeof medallasDelAnio === "function" ? medallasDelAnio(S, y).slice().reverse().map(m => m.id)   // las de tu vitrina (cielo.js), la más nueva primero
    : led.filter(m => String(m.id).startsWith("insignia:") && enAnio(m.ts)).sort((a, b) => b.ts - a.ts).map(m => m.id.slice(9)))
    .map(id => { const b = typeof BADGES !== "undefined" ? BADGES.find(x => x.id === id) : null; return b ? { nombre: b.nombre, icon: b.icon } : null; }).filter(Boolean);
  // Agua
  let ml = 0, aguaDias = 0;
  const ad = (S.agua && S.agua.dias) || {};
  Object.keys(ad).filter(f => f.startsWith(pref) && f <= fin).forEach(f => {
    const v = typeof aguaTotal === "function" ? aguaTotal(typeof aguaDia === "function" ? aguaDia(f, false, S) : ad[f]) : 0; ml += v;
    if (typeof aguaDiaCumplido === "function" && aguaDiaCumplido(f, S)) aguaDias++;
  });
  // Libros
  const libros = (S.lecturas || []).filter(l => l && l.estado === "terminado" && !l.antes && String(l.fin || "").startsWith(pref)).sort((a, b) => String(a.fin).localeCompare(String(b.fin)));
  // Objetivos, foco y tu mejor mes
  const ra = typeof resumenAnio === "function" ? resumenAnio(S, y) : { objetivos: [0, 0], trimestrales: [0, 0], mejorMes: null };
  const foco = typeof minutosFoco === "function" ? Math.round(minutosFoco(S, ini, fin)) : 0;
  // Tu ánimo en el Diario
  const diario = ((S.vida && S.vida.diario) || []).filter(e => e && String(e.fecha || "").startsWith(pref));
  const moods = diario.map(e => +e.mood).filter(x => x >= 1 && x <= 5);
  const gratitud = new Set(diario.filter(e => String(e.gratitud || "").trim()).map(e => e.fecha)).size;
  // Tu rueda: el área más alta del año (promedio de los meses con nota)
  let rueda = null;
  if (typeof ruedaVisibles === "function" && typeof datosAnio === "function") {
    const M = ((datosAnio(S, y) || {}).rueda || {}).meses || [];
    ruedaVisibles(S).forEach(k => {
      const vs = M.map(mm => +((mm || [])[k] || 0)).filter(v => v > 0);
      if (!vs.length) return;
      const p = vs.reduce((a, b) => a + b, 0) / vs.length;
      if (!rueda || p > rueda.prom) rueda = { k, nombre: ruedaNombre(S, k), prom: Math.round(p * 10) / 10, meses: vs.length };
    });
  }
  // Tus ⭐ y tu elefante
  const estrellas = led.filter(m => (m.delta || 0) > 0 && enAnio(m.ts)).reduce((a, m) => a + m.delta, 0);
  let ele = null;
  if (typeof etapaElefante === "function") { const e = etapaElefante((S.gamif && S.gamif.xp) || 0); ele = { etapa: e.etapa.n, tipo: typeof TIPOS_ELEFANTE !== "undefined" && typeof tipoElefante === "function" ? TIPOS_ELEFANTE[tipoElefante()].n : "" }; }
  return {
    y, nombre: (String((S.profile && S.profile.name) || "").trim().split(/\s+/)[0] || "").replace(/^.*@.*$/, ""),   // el nombre de pila; nunca un correo
    cerrados, mejor, mapa,
    habitos: { marcas, pct: pctHab, top: th ? { nombre: th.nombre, icon: th.icon, dias: porHab[topId] } : null },
    medallas: meds, agua: { litros: Math.round(ml / 100) / 10, dias: aguaDias },
    libros: { n: libros.length, paginas: libros.reduce((a, l) => a + (+l.paginas || 0), 0), lista: libros.map(l => ({ titulo: l.titulo, color: l.color || "", paginas: +l.paginas || 0 })) },
    objetivos: ra.objetivos, trimestrales: ra.trimestrales, mejorMes: ra.mejorMes, foco,
    animo: { prom: moods.length ? Math.round(moods.reduce((a, b) => a + b, 0) / moods.length * 10) / 10 : null, n: diario.length, gratitud },
    rueda, estrellas, ele,
  };
}
/* Las láminas que tienen algo que contar (siempre la portada y el cierre; hasta 8) */
function tuAnioLaminas(d) {
  const medio = [
    ["cerrados", d.cerrados >= 1],
    ["habitos", !!d.habitos.top && d.habitos.marcas >= 3],
    ["medallas", d.medallas.length >= 1],
    ["agua", d.agua.litros >= 1],
    ["libros", d.libros.n >= 1],
    ["objetivos", d.objetivos[1] >= 1 || d.foco >= 60],
    ["animo", d.animo.prom != null && d.animo.n >= 5],
    ["rueda", !!d.rueda],
  ].filter(x => x[1]).map(x => x[0]).slice(0, TU_ANIO.MAX - 2);
  return ["portada"].concat(medio, ["final"]);
}

/* -------- Textos -------- */
const TA_MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function taNum(n) { return Math.round(+n || 0).toLocaleString("es-CL"); }
function taDec(n) { return String(n).replace(".", ","); }
function taFecha(iso) { return iso ? `${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1].toLowerCase()}` : ""; }
function taPlural(n, a, b) { return `${taNum(n)} ${n === 1 ? a : b}`; }
/* Cada lámina: qué dice (también sirve de texto alternativo) */
function tuAnioTexto(id, d) {
  const T = {
    portada: { k: `TU ${d.y} EN RUMBO`, big: String(d.y), sub: "en Rumbo", lineas: [d.nombre ? `La historia de ${d.nombre}, día a día.` : "Tu historia, día a día."] },
    cerrados: { k: "TU RITUAL", pre: "Cerraste", big: taNum(d.cerrados), sub: d.cerrados === 1 ? "día con tu ritual" : "días con tu ritual",
      lineas: d.mejor.n >= 2 ? [`Tu mejor racha: ${taPlural(d.mejor.n, "día seguido", "días seguidos")}`, `del ${taFecha(d.mejor.desde)} al ${taFecha(d.mejor.hasta)}`] : ["Cada día cerrado es un día que elegiste mirar."] },
    habitos: d.habitos.top ? { k: "TU HÁBITO DEL AÑO", pre: d.habitos.top.nombre, big: taNum(d.habitos.top.dias), sub: d.habitos.top.dias === 1 ? "día" : "días",
      lineas: [`Marcaste tus hábitos ${taPlural(d.habitos.marcas, "vez", "veces")}${d.habitos.pct != null ? ` y cumpliste el ${d.habitos.pct} %` : ""}.`] } : null,
    medallas: { k: "TUS MEDALLAS", pre: "Ganaste", big: taNum(d.medallas.length), sub: d.medallas.length === 1 ? "medalla" : "medallas", lineas: d.medallas.slice(0, 3).map(m => m.nombre) },
    agua: { k: "TU AGUA", pre: "Tomaste", big: taDec(d.agua.litros >= 100 ? Math.round(d.agua.litros) : d.agua.litros), sub: "litros de agua",
      lineas: [d.agua.litros >= 150 ? `Como ${taDec(Math.round(d.agua.litros / 150 * 10) / 10)} ${d.agua.litros / 150 >= 1.5 ? "tinas de baño llenas" : "tina de baño llena"}` : `Unos ${taNum(d.agua.litros * 4)} vasos`, d.agua.dias ? `Cumpliste tu meta ${taPlural(d.agua.dias, "día", "días")}` : ""].filter(Boolean) },
    libros: { k: "TUS LIBROS", pre: "Terminaste", big: taNum(d.libros.n), sub: d.libros.n === 1 ? "libro" : "libros",
      lineas: [d.libros.paginas ? `${taNum(d.libros.paginas)} páginas` : ""].filter(Boolean) },
    objetivos: { k: "TUS OBJETIVOS", pre: d.objetivos[1] ? "Cumpliste" : "Le diste", big: d.objetivos[1] ? `${d.objetivos[0]}/${d.objetivos[1]}` : fmtFoco(d.foco), sub: d.objetivos[1] ? "objetivos del mes" : "de foco a lo tuyo",
      lineas: [d.objetivos[1] && d.foco >= 60 ? `y ${fmtFoco(d.foco)} de foco` : "", d.mejorMes ? `Tu mejor mes: ${MESES[d.mejorMes.m].toLowerCase()} (${taDec(d.mejorMes.nota)}/10)` : ""].filter(Boolean) },
    animo: { k: "TU ÁNIMO", pre: "Tu ánimo en el Diario", big: taDec(d.animo.prom), sub: "de 5, en promedio",
      lineas: [taPlural(d.animo.n, "día escrito", "días escritos"), d.animo.gratitud ? `${taPlural(d.animo.gratitud, "día", "días")} con gratitud` : ""].filter(Boolean) },
    rueda: d.rueda ? { k: "TU RUEDA DE LA VIDA", pre: "Tu área más fuerte", big: taDec(d.rueda.prom), sub: d.rueda.nombre, lineas: [`en promedio, en ${taPlural(d.rueda.meses, "mes", "meses")} con nota`] } : null,
    final: { k: `TU ${d.y} EN RUMBO`, pre: d.ele ? `Tu elefante ya es ${d.ele.etapa}` : "Gracias por este año", big: d.estrellas ? taNum(d.estrellas) : "", sub: d.estrellas ? "estrellas ganadas este año" : "",
      lineas: [`Nos vemos en ${d.y + 1}.`] },
  };
  return T[id];
}
function tuAnioAlt(id, d) { const t = tuAnioTexto(id, d); return t ? [t.pre, t.big, t.sub].concat(t.lineas || []).filter(Boolean).join(" ") : ""; }

/* -------- El dibujo de cada lámina -------- */
const TA_PAL = {
  portada: { a: "#0C0F1E", b: "#1C2242", txt: "#EEF0F8", suave: "#9AA1C0", acento: "#FFBE55" },
  cerrados: { a: "#FFC970", b: "#F59A2C", txt: "#1A1300", suave: "#5C3B00", acento: "#1A1300" },
  habitos: { a: "#17A99A", b: "#0B6E64", txt: "#FFFFFF", suave: "#CDEFEA", acento: "#FFE9A8" },
  medallas: { a: "#2A1F5C", b: "#100B28", txt: "#FFFFFF", suave: "#B9B1E6", acento: "#FFD25A" },
  agua: { a: "#4CB8F0", b: "#1C6FB8", txt: "#FFFFFF", suave: "#DDF2FD", acento: "#FFFFFF" },
  libros: { a: "#F6F0D9", b: "#E6DAB0", txt: "#2A2118", suave: "#6E5E43", acento: "#B5462B" },
  objetivos: { a: "#EE6A52", b: "#B83A28", txt: "#FFFFFF", suave: "#FFE0D6", acento: "#FFE9A8" },
  animo: { a: "#E86A93", b: "#7A2A5E", txt: "#FFFFFF", suave: "#FFDCE8", acento: "#FFE9A8" },
  rueda: { a: "#123457", b: "#081A2E", txt: "#FFFFFF", suave: "#A9C2DC", acento: "#5FD3C4" },
  final: { a: "#3B4BD8", b: "#141A55", txt: "#FFFFFF", suave: "#C9D0FF", acento: "#FFBE55" },
};
const TA_FONT = { d: `"Bricolage Grotesque", "Figtree", system-ui, sans-serif`, b: `"Figtree", system-ui, sans-serif` };
function taF(peso, px, disp) { return `${peso} ${px}px ${disp ? TA_FONT.d : TA_FONT.b}`; }
/* El número grande: tan grande como quepa */
function taGrande(x, t, cx, y, max, ancho) {
  let px = max; x.font = taF(800, px, true);
  while (px > 90 && x.measureText(t).width > ancho) { px -= 10; x.font = taF(800, px, true); }
  x.fillText(t, cx, y); return px;
}
function tuAnioDibujar(id, d, op) {
  op = op || {};
  const W = TU_ANIO.W, H = TU_ANIO.H, P = TA_PAL[id] || TA_PAL.portada, t = tuAnioTexto(id, d) || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, P.a); g.addColorStop(1, P.b);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const halo = (cx, cy, r, col) => { const h = x.createRadialGradient(cx, cy, 0, cx, cy, r); h.addColorStop(0, col); h.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = h; x.fillRect(0, 0, W, H); };
  halo(W * 0.9, 200, 700, "rgba(255,255,255,0.10)");
  // Lo propio de cada lámina, de fondo o como dibujo
  taFondo(id, x, d, P, op);
  // Arriba: la etiqueta
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  x.fillStyle = P.suave; x.font = taF(800, 30); taEspaciado(x, t.k || "", 90, 150, 6);
  // El cuerpo
  x.textAlign = "center"; const cx = W / 2;
  const yBig = id === "portada" ? 1060 : id === "final" ? 1120 : 900;
  if (t.pre) { x.fillStyle = P.txt; x.font = taF(700, t.pre.length > 22 ? 52 : 60, true); taLineas(x, t.pre, cx, yBig - (id === "final" ? 300 : 280), W - 200, 70, 2); }
  if (t.big) { x.fillStyle = id === "cerrados" || id === "libros" ? P.txt : P.acento; taGrande(x, t.big, cx, yBig, id === "portada" ? 320 : 300, W - 160); }
  if (t.sub) { x.fillStyle = P.txt; x.font = taF(700, id === "portada" ? 84 : 58, true); taLineas(x, t.sub, cx, yBig + (id === "portada" ? 120 : 100), W - 200, 70, 2); }
  x.fillStyle = P.suave; x.font = taF(600, 42);
  let yl = yBig + (id === "portada" ? 250 : 210);
  (t.lineas || []).forEach(l => { yl = taLineas(x, l, cx, yl, W - 220, 56, 2) + 8; });
  // Tu elefante en la portada y en el cierre
  if ((id === "portada" || id === "final") && op.ele) {
    const w = 520, h = Math.round(w * 240 / 260); x.drawImage(op.ele, cx - w / 2, 290, w, h);
  }
  if (id === "final") { x.fillStyle = P.acento; x.font = taF(800, 46, true); x.fillText("Hazlo tú también en Rumbo", cx, 1690); }
  // Pie
  x.textAlign = "left"; x.fillStyle = "rgba(255,255,255,0.0)";
  x.fillStyle = P.suave; x.globalAlpha = 0.5; x.fillRect(90, H - 170, W - 180, 2); x.globalAlpha = 1;
  x.fillStyle = P.txt; x.font = taF(800, 34, true); x.fillText("Rumbo", 90, H - 98);
  x.fillStyle = P.suave; x.font = taF(600, 28); x.fillText("rumbo.biplot.cl", 90, H - 58);
  x.textAlign = "right"; x.fillStyle = P.suave; x.font = taF(600, 28); x.fillText("un bocado a la vez", W - 90, H - 58); x.textAlign = "left";
  return c;
}
function taEspaciado(x, t, px, py, esp) { let xx = px; for (const ch of t) { x.fillText(ch, xx, py); xx += x.measureText(ch).width + esp; } }
/* Texto en varias líneas centrado (devuelve la y siguiente) */
function taLineas(x, texto, cx, y, ancho, alto, max) {
  const palabras = String(texto).split(/\s+/), ls = []; let l = "";
  palabras.forEach(p => { const tt = l ? l + " " + p : p; if (x.measureText(tt).width > ancho && l) { ls.push(l); l = p; } else l = tt; });
  if (l) ls.push(l);
  const vis = ls.slice(0, max || 3); if (ls.length > vis.length) vis[vis.length - 1] = vis[vis.length - 1].replace(/\s*\S*$/, "") + "…";
  vis.forEach((s, i) => x.fillText(s, cx, y + i * alto));
  return y + vis.length * alto;
}
/* Los dibujos de fondo: estrellas, el mapa del año, medallas, olas, lomos, la rueda… */
function taFondo(id, x, d, P, op) {
  const W = TU_ANIO.W, H = TU_ANIO.H;
  let s = 7; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  if (id === "portada" || id === "final") {
    x.fillStyle = "#FFFFFF";
    for (let i = 0; i < 70; i++) { x.globalAlpha = 0.25 + az() * 0.6; x.beginPath(); x.arc(az() * W, az() * H * 0.75, 1.5 + az() * 2.5, 0, Math.PI * 2); x.fill(); }
    x.globalAlpha = 1;
  }
  if (id === "cerrados") {   // el mapa del año: una fila por mes, un punto por día
    const x0 = 150, y0 = 1260, paso = 25, r = 8.5;
    x.font = taF(700, 24); x.textAlign = "right";
    for (let m = 0; m < 12; m++) {
      const dm = new Date(d.y, m + 1, 0).getDate(), base = Math.round((new Date(d.y, m, 1) - new Date(d.y, 0, 1)) / 864e5);
      x.fillStyle = P.suave; x.fillText(TA_MESES_CORTO[m], x0 - 22, y0 + m * 34 + 8);
      for (let k = 0; k < dm; k++) {
        const v = d.mapa[base + k]; x.beginPath(); x.arc(x0 + k * paso, y0 + m * 34, r, 0, Math.PI * 2);
        x.fillStyle = v === 1 ? "#1A1300" : v === 0 ? "rgba(26,19,0,0.16)" : "rgba(26,19,0,0.06)"; x.fill();
      }
    }
    x.textAlign = "left";
  }
  if (id === "habitos") {   // marcas como en una agenda
    x.strokeStyle = "rgba(255,255,255,0.16)"; x.lineWidth = 10; x.lineCap = "round"; x.lineJoin = "round";
    for (let i = 0; i < 14; i++) { const cx = 140 + (i % 7) * 135, cy = 1380 + Math.floor(i / 7) * 150; x.beginPath(); x.moveTo(cx - 34, cy); x.lineTo(cx - 8, cy + 28); x.lineTo(cx + 40, cy - 30); x.stroke(); }
  }
  if (id === "medallas") {   // medallas que cuelgan
    const n = Math.min(5, Math.max(3, d.medallas.length));
    for (let i = 0; i < n; i++) {
      const cx = W / 2 + (i - (n - 1) / 2) * 170, cy = 1580 + (i % 2) * 40;
      x.strokeStyle = i % 2 ? "#6C5CE7" : "#E5527A"; x.lineWidth = 16; x.beginPath(); x.moveTo(cx - 30, cy - 220); x.lineTo(cx, cy - 60); x.lineTo(cx + 30, cy - 220); x.stroke();
      const gr = x.createRadialGradient(cx - 18, cy - 18, 8, cx, cy, 70); gr.addColorStop(0, "#FFF1B8"); gr.addColorStop(1, "#E0A526");
      x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 64, 0, Math.PI * 2); x.fill();
      x.fillStyle = "rgba(120,72,0,0.55)"; taEstrella(x, cx, cy, 30, 13);
    }
  }
  if (id === "agua") {   // olas abajo
    [[1370, "rgba(255,255,255,0.14)"], [1450, "rgba(255,255,255,0.18)"], [1530, "rgba(255,255,255,0.22)"]].forEach(([yy, col], k) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
      for (let px = 0; px <= W; px += 20) x.lineTo(px, yy + Math.sin(px / 90 + k * 1.7) * 26);
      x.lineTo(W, H); x.closePath(); x.fill();
    });
  }
  if (id === "libros") {   // los lomos de tus libros en una repisa
    const L = d.libros.lista.slice(0, 12), cols = ["#B5462B", "#2E6E8E", "#C08A2D", "#3E7B4F", "#6B4C8A", "#8A3B3B"];
    let px = 120; const base = 1560;
    L.forEach((l, i) => {
      const w = 54 + (l.paginas % 5) * 8, h = 300 + ((l.paginas || 200) % 7) * 22;
      x.fillStyle = /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : cols[i % cols.length]; x.fillRect(px, base - h, w, h);
      x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(px + 8, base - h + 30, w - 16, 6); x.fillRect(px + 8, base - 50, w - 16, 6);
      px += w + 10;
    });
    x.fillStyle = "#8A6B44"; x.fillRect(90, base, W - 180, 22);
    if (d.libros.lista.length) { x.fillStyle = P.suave; x.font = taF(600, 34); x.textAlign = "center"; taLineas(x, d.libros.lista.slice(-3).map(l => `«${l.titulo}»`).join(" · "), W / 2, 1640, W - 200, 44, 2); x.textAlign = "left"; }
  }
  if (id === "objetivos") {   // banderas en la cima
    x.fillStyle = "rgba(255,255,255,0.12)"; x.beginPath(); x.moveTo(-40, H - 160); x.lineTo(W * 0.42, 1440); x.lineTo(W + 40, H - 160); x.closePath(); x.fill();
    x.strokeStyle = "#FFFFFF"; x.lineWidth = 6; x.beginPath(); x.moveTo(W * 0.42, 1440); x.lineTo(W * 0.42, 1310); x.stroke();
    x.fillStyle = "#FFE9A8"; x.beginPath(); x.moveTo(W * 0.42, 1310); x.lineTo(W * 0.42 + 110, 1345); x.lineTo(W * 0.42, 1380); x.closePath(); x.fill();
  }
  if (id === "animo") {   // corazones suaves
    for (let i = 0; i < 9; i++) { x.globalAlpha = 0.14 + az() * 0.12; x.fillStyle = "#FFFFFF"; taCorazon(x, 120 + az() * (W - 240), 1300 + az() * 330, 30 + az() * 40); }
    x.globalAlpha = 1;
  }
  if (id === "rueda" && d.rueda) {   // una rosa de los vientos
    const cx = W / 2, cy = 1440, R = 230;
    x.strokeStyle = "rgba(255,255,255,0.18)"; x.lineWidth = 3; [R, R * 0.66, R * 0.33].forEach(r => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); });
    for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4, l = k % 2 ? R * 0.62 : R; x.fillStyle = k === 0 ? "#5FD3C4" : "rgba(255,255,255,0.28)";
      x.beginPath(); x.moveTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.lineTo(cx + Math.cos(a + 0.18) * 40, cy + Math.sin(a + 0.18) * 40); x.lineTo(cx + Math.cos(a - 0.18) * 40, cy + Math.sin(a - 0.18) * 40); x.closePath(); x.fill(); }
  }
}
function taEstrella(x, cx, cy, R, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
function taCorazon(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.4, cy - s, cx, cy - s * 0.4); x.bezierCurveTo(cx + s * 0.4, cy - s, cx + s, cy - s * 0.4, cx, cy + s * 0.35); x.fill(); }

/* -------- La historia a pantalla completa -------- */
async function openTuAnio(y) {
  y = +y || anioActual();
  if (!tuAnioDisponible(y) && !(typeof esCuentaDuena === "function" && esCuentaDuena())) return toast(`Tu ${y} en Rumbo llega el 1 de diciembre`, true);
  if (TA.cargando) return; TA.cargando = true;
  try {
    if (typeof loadThemeFonts === "function") loadThemeFonts("norte");
    if (document.fonts && document.fonts.load) { try { await Promise.all([`800 120px "Bricolage Grotesque"`, `700 60px "Bricolage Grotesque"`, `600 40px "Figtree"`, `800 30px "Figtree"`].map(f => document.fonts.load(f))); } catch (e) {} }
    const ele = typeof elefanteImagen === "function" ? await elefanteImagen({ animo: "feliz" }) : null;
    const d = tuAnioDatos(STATE, y);
    TA.urls.forEach(u => URL.revokeObjectURL(u));
    TA.y = y; TA.d = d; TA.laminas = tuAnioLaminas(d); TA.i = 0;
    TA.canvas = TA.laminas.map(id => tuAnioDibujar(id, d, { ele }));
    TA.urls = await Promise.all(TA.canvas.map(c => new Promise(res => c.toBlob(b => res(b ? URL.createObjectURL(b) : c.toDataURL("image/jpeg", .9)), "image/jpeg", .9))));
  } finally { TA.cargando = false; }
  if (STATE.settings && !(STATE.settings.tuAnioVisto || []).includes(y)) { STATE.settings.tuAnioVisto = (STATE.settings.tuAnioVisto || []).concat(y); saveState(); }
  tuAnioMostrar(); rerender();   // encima de lo que esté abierto (el cierre de diciembre sigue ahí al salir)
}
function tuAnioMostrar() {
  let el = document.getElementById("tuanio");
  if (!el) { el = document.createElement("div"); el.id = "tuanio"; el.className = "tuanio"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Tu año en Rumbo"); document.body.appendChild(el); }
  const n = TA.laminas.length;
  el.innerHTML = `<div class="tuanio__in">
    <div class="tuanio__barras" aria-hidden="true">${TA.laminas.map((_, i) => `<span><i id="ta-b${i}"></i></span>`).join("")}</div>
    <button type="button" class="tuanio__x" data-action="ta-cerrar" aria-label="Cerrar">✕</button>
    <div class="tuanio__lam" id="ta-lam"><img id="ta-img" alt=""><button type="button" class="tuanio__zona tuanio__zona--a" data-action="ta-ant" aria-label="Lámina anterior"></button><button type="button" class="tuanio__zona tuanio__zona--s" data-action="ta-sig" aria-label="Lámina siguiente"></button></div>
    <div class="tuanio__acc"><button type="button" class="tuanio__btn tuanio__btn--p" data-action="ta-compartir">Compartir esta</button><button type="button" class="tuanio__btn" data-action="ta-todas">Compartir las ${n}</button></div>
    <p class="tuanio__nota">Las imágenes se crean en tu teléfono. Solo salen de la app si tú las compartes.</p></div>`;
  TA.volver = document.activeElement;
  el.hidden = false; document.body.classList.add("en-foco");
  const lam = el.querySelector("#ta-lam");
  lam.addEventListener("pointerdown", () => tuAnioPausa(true)); ["pointerup", "pointercancel", "pointerleave"].forEach(ev => lam.addEventListener(ev, () => tuAnioPausa(false)));
  tuAnioIr(0);
  const sig = el.querySelector('[data-action="ta-sig"]'); if (sig) sig.focus({ preventScroll: true });
}
function tuAnioIr(i) {
  const n = TA.laminas.length; if (!n) return;
  TA.i = Math.max(0, Math.min(n - 1, i));
  const img = document.getElementById("ta-img"); if (!img) return;
  img.src = TA.urls[TA.i]; img.alt = tuAnioAlt(TA.laminas[TA.i], TA.d);
  img.classList.remove("is-entra"); void img.offsetWidth; img.classList.add("is-entra");
  TA.laminas.forEach((_, k) => { const b = document.getElementById("ta-b" + k); if (b) { b.style.transition = "none"; b.style.width = k < TA.i ? "100%" : "0%"; } });
  const ult = TA.i === n - 1, s = document.querySelector('[data-action="ta-sig"]'); if (s) s.setAttribute("aria-label", ult ? "Ver de nuevo" : "Lámina siguiente");
  TA.resto = TA_MS; tuAnioCorrer();
}
function tuAnioCorrer() {
  clearTimeout(TA.t); const b = document.getElementById("ta-b" + TA.i); if (!b) return;
  const reducir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducir) { b.style.width = "100%"; return; }   // sin moverse sola: se avanza tocando
  TA.ini = Date.now(); void b.offsetWidth; b.style.transition = `width ${TA.resto}ms linear`; b.style.width = "100%";
  TA.t = setTimeout(() => { if (TA.i < TA.laminas.length - 1) tuAnioIr(TA.i + 1); }, TA.resto);
}
function tuAnioPausa(on) {
  if (on === TA.pausa) return; TA.pausa = on;
  const b = document.getElementById("ta-b" + TA.i); if (!b) return;
  if (on) { clearTimeout(TA.t); TA.resto = Math.max(300, TA.resto - (Date.now() - TA.ini)); const w = getComputedStyle(b).width; b.style.transition = "none"; b.style.width = w; }
  else tuAnioCorrer();
}
function tuAnioCerrar() {
  clearTimeout(TA.t); const el = document.getElementById("tuanio"); if (el) el.hidden = true;
  if (!document.getElementById("foco") || document.getElementById("foco").hidden) document.body.classList.remove("en-foco");
  if (TA.volver && TA.volver.isConnected && TA.volver.focus) TA.volver.focus({ preventScroll: true }); TA.volver = null;
}
async function tuAnioArchivos(idx) {
  return Promise.all(idx.map(i => new Promise(res => TA.canvas[i].toBlob(b => res(new File([b], `rumbo-${TA.y}-${i + 1}.jpg`, { type: "image/jpeg" })), "image/jpeg", .92))));
}
async function tuAnioCompartir(todas) {
  clearTimeout(TA.t);
  const idx = todas ? TA.laminas.map((_, i) => i) : [TA.i];
  const files = await tuAnioArchivos(idx);
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title: `Mi ${TA.y} en Rumbo` }); if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu año"); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  files.forEach((f, k) => setTimeout(() => {   // sin menú de compartir (computador): se descargan
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, k * 250));
  toast(files.length === 1 ? "🖼️ Imagen descargada" : `🖼️ ${files.length} imágenes descargadas`);
  if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu año");
}
function tuAnioAccion(a, d) {
  if (a === "ta-abrir") return openTuAnio(+d.y);
  if (a === "ta-cerrar") return tuAnioCerrar();
  if (a === "ta-sig") return TA.i >= TA.laminas.length - 1 ? tuAnioIr(0) : tuAnioIr(TA.i + 1);
  if (a === "ta-ant") return tuAnioIr(TA.i - 1);
  if (a === "ta-compartir") return tuAnioCompartir(false);
  if (a === "ta-todas") return tuAnioCompartir(true);
}
if (typeof document !== "undefined") document.addEventListener("keydown", e => {
  const el = document.getElementById("tuanio"); if (!el || el.hidden) return;
  if (e.key === "Escape") tuAnioCerrar(); else if (e.key === "ArrowRight") tuAnioAccion("ta-sig", {}); else if (e.key === "ArrowLeft") tuAnioIr(TA.i - 1);
});

/* -------- Dónde aparece -------- */
/* Inicio: en diciembre (y en enero, la del año que terminó), hasta que la veas */
function tuAnioInicioHtml() {
  const y = tuAnioDeTemporada(); if (y == null || !STATE.settings) return "";
  if ((STATE.settings.tuAnioVisto || []).includes(y)) return "";
  const d = tuAnioDatos(STATE, y); if (!d.cerrados && !d.habitos.marcas && !d.libros.n) return "";
  const mini = d.cerrados ? [d.cerrados, "días cerrados"] : d.habitos.marcas ? [d.habitos.marcas, "hábitos marcados"] : [d.libros.n, d.libros.n === 1 ? "libro" : "libros"];
  return `<section class="card tuanio-card" aria-labelledby="ta-card-t"><div class="tuanio-card__txt"><span class="tuanio-card__k">🎆 Ya está</span>
    <h2 class="tuanio-card__t" id="ta-card-t">Tu ${y} en Rumbo</h2><p>La historia de tu año en ${tuAnioLaminas(d).length} láminas, lista para compartir.</p>
    <button type="button" class="btn tuanio-card__btn" data-action="ta-abrir" data-y="${y}">Ver mi historia</button></div>
    <div class="tuanio-card__mini" aria-hidden="true"><b>${taNum(mini[0])}</b><span>${mini[1]}</span></div></section>`;
}
/* Tendencias y el cierre de diciembre: el botón */
function tuAnioBoton(y, clase) {
  const dueno = typeof esCuentaDuena === "function" && esCuentaDuena();
  if (!tuAnioDisponible(y) && !dueno) return "";
  return `<button type="button" class="btn ${clase || "btn--primary"}" data-action="ta-abrir" data-y="${y}">🎆 Tu ${y} en Rumbo${!tuAnioDisponible(y) ? " (vista previa)" : ""}</button>`;
}
