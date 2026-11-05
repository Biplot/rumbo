/* ============================================================
   RUMBO · 🎆 Tu año en Rumbo (v141, animada desde la v142): la historia de tu año en láminas para compartir
   Desde el 1 de diciembre (y todo enero, para el año que terminó): hasta 8 láminas de
   1080 × 1920 (formato historia de Instagram y WhatsApp), con lo que hiciste en el año.
   · Siempre la portada y el cierre (tu elefante, tus ⭐ y «nos vemos en el próximo»); entre
     medio, las que tienen datos, en este orden: días cerrados y tu mejor racha, tu hábito del
     año, tus medallas, tu agua, tus libros, objetivos y foco, tu ánimo y tu rueda (hasta 6).
   · Se ve como una historia animada (toca para avanzar, mantén para pausar) y se comparte una como
     video o imagen, o todas en imágenes.
   · Nada sale de la app sin que la persona lo decida. El ahorro nunca va en las láminas.
   Datos: lo que ya está en tu documento (nada nuevo que guardar, salvo `settings.tuAnioVisto`).
   ============================================================ */
const TU_ANIO = { W: 1080, H: 1920, MAX: 8 };
const TA = { y: 0, d: null, ele: null, laminas: [], i: -1, t: null, ini: 0, pausa: false, resto: 0, cargando: false, raf: 0, ini0: 0, pausado: 0, pausaDesde: 0, prev: null, prevOk: false, quieto: false, hoja: false, grabando: false, video: null, cuadros: 0, volver: null };
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
    cerrados: { k: "TU RITUAL", pre: "Cerraste", big: taNum(d.cerrados), cuenta: d.cerrados, sub: d.cerrados === 1 ? "día con tu ritual" : "días con tu ritual",
      lineas: d.mejor.n >= 2 ? [`Tu mejor racha: ${taPlural(d.mejor.n, "día seguido", "días seguidos")}`, `del ${taFecha(d.mejor.desde)} al ${taFecha(d.mejor.hasta)}`] : ["Cada día cerrado es un día que elegiste mirar."] },
    habitos: d.habitos.top ? { k: "TU HÁBITO DEL AÑO", pre: d.habitos.top.nombre, big: taNum(d.habitos.top.dias), cuenta: d.habitos.top.dias, sub: d.habitos.top.dias === 1 ? "día" : "días",
      lineas: [`Marcaste tus hábitos ${taPlural(d.habitos.marcas, "vez", "veces")}${d.habitos.pct != null ? ` y cumpliste el ${d.habitos.pct} %` : ""}.`] } : null,
    medallas: { k: "TUS MEDALLAS", pre: "Ganaste", big: taNum(d.medallas.length), cuenta: d.medallas.length, sub: d.medallas.length === 1 ? "medalla" : "medallas", lineas: d.medallas.slice(0, 3).map(m => m.nombre) },
    agua: { k: "TU AGUA", pre: "Tomaste", big: d.agua.litros >= 100 ? taNum(d.agua.litros) : taDec(d.agua.litros), cuenta: d.agua.litros, fmt: v => d.agua.litros >= 100 ? taNum(v) : taDec(Math.round(v * 10) / 10), sub: "litros de agua",
      lineas: [d.agua.litros >= 150 ? `Como ${taDec(Math.round(d.agua.litros / 150 * 10) / 10)} ${d.agua.litros / 150 >= 1.5 ? "tinas de baño llenas" : "tina de baño llena"}` : `Unos ${taNum(d.agua.litros * 4)} vasos`, d.agua.dias ? `Cumpliste tu meta ${taPlural(d.agua.dias, "día", "días")}` : ""].filter(Boolean) },
    libros: { k: "TUS LIBROS", pre: "Terminaste", big: taNum(d.libros.n), cuenta: d.libros.n, sub: d.libros.n === 1 ? "libro" : "libros",
      lineas: [d.libros.paginas ? `${taNum(d.libros.paginas)} páginas` : ""].filter(Boolean) },
    objetivos: { k: "TUS OBJETIVOS", pre: d.objetivos[1] ? "Cumpliste" : "Le diste", big: d.objetivos[1] ? `${d.objetivos[0]}/${d.objetivos[1]}` : fmtFoco(d.foco), cuenta: d.objetivos[1] ? d.objetivos[0] : null, fmt: v => `${Math.round(v)}/${d.objetivos[1]}`, sub: d.objetivos[1] ? "objetivos del mes" : "de foco a lo tuyo",
      lineas: [d.objetivos[1] && d.foco >= 60 ? `y ${fmtFoco(d.foco)} de foco` : "", d.mejorMes ? `Tu mejor mes: ${MESES[d.mejorMes.m].toLowerCase()} (${taDec(d.mejorMes.nota)}/10)` : ""].filter(Boolean) },
    animo: { k: "TU ÁNIMO", pre: "Tu ánimo en el Diario", big: taDec(d.animo.prom), cuenta: d.animo.prom, fmt: v => taDec(Math.round(v * 10) / 10), sub: "de 5, en promedio",
      lineas: [taPlural(d.animo.n, "día escrito", "días escritos"), d.animo.gratitud ? `${taPlural(d.animo.gratitud, "día", "días")} con gratitud` : ""].filter(Boolean) },
    rueda: d.rueda ? { k: "TU RUEDA DE LA VIDA", pre: "Tu área más fuerte", big: taDec(d.rueda.prom), cuenta: d.rueda.prom, fmt: v => taDec(Math.round(v * 10) / 10), sub: d.rueda.nombre, lineas: [`en promedio, en ${taPlural(d.rueda.meses, "mes", "meses")} con nota`] } : null,
    final: { k: `TU ${d.y} EN RUMBO`, pre: d.ele ? `Tu elefante ya es ${d.ele.etapa}` : "Gracias por este año", big: d.estrellas ? taNum(d.estrellas) : "", cuenta: d.estrellas || null, sub: d.estrellas ? "estrellas ganadas este año" : "",
      lineas: [`Nos vemos en ${d.y + 1}.`] },
  };
  return T[id];
}
function tuAnioAlt(id, d) { const t = tuAnioTexto(id, d); return t ? [t.pre, t.big, t.sub].concat(t.lineas || []).filter(Boolean).join(" ") : ""; }

/* -------- El dibujo de cada lámina, con movimiento --------
   Cada lámina se pinta con su tiempo `t` (ms desde que empezó), al estilo de las historias del año:
   las cosas entran, los números cuentan, las figuras flotan y el fondo se mueve. `t = TA_FIN` es la
   lámina quieta (la que se comparte como imagen y la que ve quien pidió «reducir movimiento»). */
const TA_FIN = Infinity;
function taP(t, ini, dur) { return t === TA_FIN ? 1 : Math.max(0, Math.min(1, (t - ini) / dur)); }
function taSale(p) { return 1 - Math.pow(1 - p, 3); }   // rápido y frena
function taRebote(p) { const c = 1.70158; return p >= 1 ? 1 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }   // se pasa un poco y vuelve
function taBote(p) {   // cae y rebota
  const n = 7.5625, k = 2.75;
  if (p < 1 / k) return n * p * p;
  if (p < 2 / k) { p -= 1.5 / k; return n * p * p + 0.75; }
  if (p < 2.5 / k) { p -= 2.25 / k; return n * p * p + 0.9375; }
  p -= 2.625 / k; return n * p * p + 0.984375;
}
function taAmb(t) { return t === TA_FIN ? 0 : t / 1000; }   // el vaivén del fondo, en segundos (quieto en la imagen)
/* El número grande mientras cuenta: de 0 a lo suyo (p de 0 a 1) */
function taCuentaTxt(T, p) {
  if (!T || T.cuenta == null || p >= 1) return T ? T.big : "";
  const v = T.cuenta * taSale(Math.max(0, p));
  return T.fmt ? T.fmt(v) : taNum(v);
}

const TA_PAL = {
  portada: { a: "#0C0F1E", b: "#1C2242", txt: "#EEF0F8", suave: "#9AA1C0", acento: "#FFBE55", forma: "#6F7FFF" },
  cerrados: { a: "#FFC970", b: "#F59A2C", txt: "#1A1300", suave: "#5C3B00", acento: "#1A1300" },
  habitos: { a: "#17A99A", b: "#0B6E64", txt: "#FFFFFF", suave: "#CDEFEA", acento: "#FFE9A8" },
  medallas: { a: "#2A1F5C", b: "#100B28", txt: "#FFFFFF", suave: "#B9B1E6", acento: "#FFD25A", forma: "#9B7CFF" },
  agua: { a: "#4CB8F0", b: "#1C6FB8", txt: "#FFFFFF", suave: "#DDF2FD", acento: "#FFFFFF" },
  libros: { a: "#F6F0D9", b: "#E6DAB0", txt: "#2A2118", suave: "#6E5E43", acento: "#B5462B" },
  objetivos: { a: "#EE6A52", b: "#B83A28", txt: "#FFFFFF", suave: "#FFE0D6", acento: "#FFE9A8" },
  animo: { a: "#E86A93", b: "#7A2A5E", txt: "#FFFFFF", suave: "#FFDCE8", acento: "#FFE9A8" },
  rueda: { a: "#123457", b: "#081A2E", txt: "#FFFFFF", suave: "#A9C2DC", acento: "#5FD3C4", forma: "#3FA9C9" },
  final: { a: "#3B4BD8", b: "#141A55", txt: "#FFFFFF", suave: "#C9D0FF", acento: "#FFBE55", forma: "#8FA0FF" },
};
/* Las figuras grandes que entran girando y flotan, en los bordes (lejos del texto y de los dibujos): [forma, x, y, radio, color] */
const TA_FORMAS = {
  portada: [["anillo", 985, 215, 165, "a"], ["circulo", -50, 1520, 230, "w"], ["estrella", 930, 1500, 70, "a"]],
  cerrados: [["circulo", 1010, 250, 230, "w"], ["estrella", 120, 560, 62, "a"], ["anillo", -40, 880, 120, "w"]],
  habitos: [["anillo", 990, 250, 200, "a"], ["circulo", -60, 760, 150, "w"], ["estrella", 960, 1150, 54, "a"]],
  medallas: [["estrella", 930, 300, 150, "a"], ["anillo", -30, 700, 130, "w"], ["circulo", 1060, 1100, 110, "w"]],
  agua: [["circulo", 960, 280, 200, "w"], ["anillo", 120, 520, 70, "w"], ["circulo", 1010, 960, 60, "w"]],
  libros: [["circulo", 1000, 280, 230, "a"], ["estrella", 110, 600, 60, "a"], ["anillo", -40, 1000, 110, "a"]],
  objetivos: [["circulo", 900, 330, 170, "a"], ["anillo", 110, 560, 70, "w"], ["estrella", 1000, 1000, 50, "a"]],
  animo: [["circulo", 990, 270, 210, "w"], ["estrella", 120, 620, 60, "a"], ["anillo", 1040, 1000, 100, "w"]],
  rueda: [["anillo", 980, 240, 190, "a"], ["circulo", -40, 820, 150, "w"], ["estrella", 960, 1080, 50, "a"]],
  final: [["anillo", 980, 215, 165, "a"], ["estrella", 140, 1560, 80, "a"], ["circulo", 1070, 1450, 180, "w"]],
};
const TA_OSCURAS = [TA_PAL.portada, TA_PAL.medallas, TA_PAL.rueda, TA_PAL.final];   // fondos oscuros: las figuras con más color
const TA_FONT = { d: `"Bricolage Grotesque", "Figtree", system-ui, sans-serif`, b: `"Figtree", system-ui, sans-serif` };
function taF(peso, px, disp) { return `${peso} ${px}px ${disp ? TA_FONT.d : TA_FONT.b}`; }
/* El tamaño del número grande: tan grande como quepa (se mide con el número final, para que no salte al contar) */
function taTamGrande(x, t, max, ancho) {
  let px = max; x.font = taF(800, px, true);
  while (px > 90 && x.measureText(t).width > ancho) { px -= 10; x.font = taF(800, px, true); }
  return px;
}
/* Lo que entra subiendo y apareciendo */
function taSube(x, p, dy, fn) {
  if (p <= 0) return; const e = taSale(p);
  x.save(); x.globalAlpha *= e; x.translate(0, (1 - e) * dy); fn(); x.restore();
}
function taForma(x, f, p, amb, i, P) {
  const [tipo, fx, fy, r, col] = f; if (p <= 0) return;
  const s = taRebote(p), dx = Math.sin(amb * 0.7 + i * 2) * 18, dy = Math.cos(amb * 0.6 + i) * 22, rot = (1 - p) * -1.2 + amb * 0.15 * (i % 2 ? -1 : 1);
  x.save(); x.translate(fx + dx, fy + dy); x.rotate(rot); x.scale(s, s);
  const osc = TA_OSCURAS.includes(P), est = tipo === "estrella";   // en los fondos oscuros: aros y círculos de luz, y la estrella bien dorada
  x.globalAlpha = col === "a" ? (osc ? (est ? 0.85 : 0.42) : 0.24) : 0.13;
  x.fillStyle = x.strokeStyle = col === "a" ? (osc && !est ? P.forma : P.acento) : "#FFFFFF";
  if (tipo === "circulo") { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); }
  else if (tipo === "anillo") { x.lineWidth = r * 0.22; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
  else taEstrella(x, 0, 0, r, r * 0.45);
  x.restore();
}
/* La lámina quieta en un canvas nuevo (para compartir como imagen) */
function tuAnioDibujar(id, d, op) {
  const c = document.createElement("canvas"); c.width = TU_ANIO.W; c.height = TU_ANIO.H;
  tuAnioPintar(c.getContext("2d"), id, d, op, TA_FIN);
  return c;
}
/* Pinta la lámina `id` en el instante `t` */
function tuAnioPintar(x, id, d, op, t) {
  op = op || {}; if (t == null) t = TA_FIN;
  const W = TU_ANIO.W, H = TU_ANIO.H, P = TA_PAL[id] || TA_PAL.portada, T = tuAnioTexto(id, d) || {}, amb = taAmb(t);
  x.save(); x.globalAlpha = 1; x.textBaseline = "alphabetic";
  const g = x.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, P.a); g.addColorStop(1, P.b);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const hx = W * 0.9 + Math.sin(amb * 0.5) * 60, hy = 200 + Math.cos(amb * 0.4) * 50;
  const h = x.createRadialGradient(hx, hy, 0, hx, hy, 700); h.addColorStop(0, "rgba(255,255,255,0.10)"); h.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = h; x.fillRect(0, 0, W, H);
  // Las figuras grandes y lo propio de cada lámina (de fondo o como dibujo)
  (TA_FORMAS[id] || []).forEach((f, i) => taForma(x, f, taP(t, 80 + i * 160, 900), amb, i, P));
  taFondo(id, x, d, P, op, t);
  // Arriba: la etiqueta
  x.textAlign = "left";
  taSube(x, taP(t, 100, 450), -30, () => { x.fillStyle = P.suave; x.font = taF(800, 30); taEspaciado(x, T.k || "", 90, 150, 6); });
  // El cuerpo
  x.textAlign = "center"; const cx = W / 2;
  const yBig = id === "portada" ? 1060 : id === "final" ? 1120 : 900;
  if (T.pre) taSube(x, taP(t, 250, 550), 60, () => { x.fillStyle = P.txt; x.font = taF(700, T.pre.length > 22 ? 52 : 60, true); taLineas(x, T.pre, cx, yBig - (id === "final" ? 300 : 280), W - 200, 70, 2); });
  if (T.big) {
    const px = taTamGrande(x, T.big, id === "portada" ? 320 : 300, W - 160);
    x.fillStyle = id === "cerrados" || id === "libros" ? P.txt : P.acento; x.font = taF(800, px, true);
    if (id === "portada") {   // el año cae cifra por cifra
      const cs = [...T.big], ws = cs.map(ch => x.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0);
      let xx = cx - tot / 2; x.textAlign = "left";
      cs.forEach((ch, i) => { const p = taP(t, 380 + i * 130, 750); if (p > 0) { x.save(); x.globalAlpha *= Math.min(1, p * 3); x.fillText(ch, xx, yBig - (1 - taBote(p)) * 520); x.restore(); } xx += ws[i]; });
      x.textAlign = "center";
    } else {   // los demás cuentan desde cero y se asoman con un salto
      const pe = taP(t, 450, 600);
      if (pe > 0) {
        const s = 0.55 + 0.45 * taRebote(pe), oy = yBig - px * 0.35;
        x.save(); x.globalAlpha *= Math.min(1, pe * 2.5); x.translate(cx, oy); x.scale(s, s); x.translate(-cx, -oy);
        x.fillText(taCuentaTxt(T, taP(t, 450, 1500)), cx, yBig); x.restore();
      }
    }
  }
  if (T.sub) taSube(x, taP(t, 950, 500), 50, () => { x.fillStyle = P.txt; x.font = taF(700, id === "portada" ? 84 : 58, true); taLineas(x, T.sub, cx, yBig + (id === "portada" ? 120 : 100), W - 200, 70, 2); });
  x.font = taF(600, 42);
  let yl = yBig + (id === "portada" ? 250 : 210);
  (T.lineas || []).forEach((l, i) => {
    const y0 = yl; x.font = taF(600, 42);
    const fin = (() => { x.save(); x.globalAlpha = 0; const r = taLineas(x, l, cx, y0, W - 220, 56, 2); x.restore(); return r; })();
    taSube(x, taP(t, 1300 + i * 220, 500), 40, () => { x.fillStyle = P.suave; x.font = taF(600, 42); taLineas(x, l, cx, y0, W - 220, 56, 2); });
    yl = fin + 8;
  });
  // Tu elefante en la portada y en el cierre: llega de un salto y se mece
  if ((id === "portada" || id === "final") && op.ele) {
    const pe = taP(t, 150, 750);
    if (pe > 0) {
      const w = 520, hh = Math.round(w * 240 / 260), s = taRebote(pe), bob = Math.sin(amb * 2.2) * 10 * Math.min(1, pe), ey = 290 + hh / 2 + bob;
      x.save(); x.globalAlpha *= Math.min(1, pe * 3); x.translate(cx, ey); x.scale(s, s); x.drawImage(op.ele, -w / 2, -hh / 2, w, hh); x.restore();
    }
  }
  if (id === "final") taSube(x, taP(t, 2100, 500), 40, () => { x.fillStyle = P.acento; x.font = taF(800, 46, true); x.fillText("Hazlo tú también en Rumbo", cx, 1690); });
  // Pie (siempre quieto: la marca)
  x.textAlign = "left";
  x.fillStyle = P.suave; x.globalAlpha = 0.5; x.fillRect(90, H - 170, W - 180, 2); x.globalAlpha = 1;
  x.fillStyle = P.txt; x.font = taF(800, 34, true); x.fillText("Rumbo", 90, H - 98);
  x.fillStyle = P.suave; x.font = taF(600, 28); x.fillText("rumbo.biplot.cl", 90, H - 58);
  x.textAlign = "right"; x.fillText("un bocado a la vez", W - 90, H - 58);
  x.restore();
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
/* El día del año (0 = 1 de enero) */
function taDiaN(y, iso) { return iso ? Math.round((new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - new Date(y, 0, 1)) / 864e5) : -1; }
/* Los dibujos: estrellas que titilan, el mapa del año que se llena, marcas que se trazan, medallas que caen y se mecen,
   el agua que sube, libros que caen a la repisa, la bandera que se iza, corazones que flotan y la rosa que gira */
function taFondo(id, x, d, P, op, t) {
  const W = TU_ANIO.W, H = TU_ANIO.H, amb = taAmb(t), quieto = t === TA_FIN;
  let s = 7; const az = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  if (id === "portada" || id === "final") {
    x.fillStyle = "#FFFFFF"; const pe = taP(t, 0, 900);
    for (let i = 0; i < 70; i++) {
      const a = 0.25 + az() * 0.6, sx = az() * W, sy = az() * H * 0.75, r = 1.5 + az() * 2.5;
      x.globalAlpha = a * pe * (quieto ? 1 : 0.6 + 0.4 * Math.sin(amb * (1.4 + (i % 5) * 0.45) + i));
      x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
  }
  if (id === "final" && !quieto && t > 1700) {   // papel picado que cae
    const cols = [P.acento, "#5FD3C4", "#E86A93", "#FFFFFF"];
    for (let i = 0; i < 36; i++) {
      const cy = ((amb - 1.7) * (230 + (i % 4) * 40) + (i * 61) % 400) % (H + 120) - 60, cxx = (i * 97 + Math.sin(amb * 1.3 + i) * 30) % W;
      if (cy < -40) continue;
      x.save(); x.globalAlpha = 0.75; x.fillStyle = cols[i % cols.length]; x.translate(cxx, cy); x.rotate(amb * (2 + i % 3) + i); x.fillRect(-7, -12, 14, 24); x.restore();
    }
  }
  if (id === "cerrados") {   // el mapa del año: una fila por mes, un punto por día; se llena día a día y se enciende tu mejor racha
    const x0 = 150, y0 = 1260, paso = 25, r = 8.5;
    const r0 = d.mejor.n >= 2 ? taDiaN(d.y, d.mejor.desde) : -1, r1 = d.mejor.n >= 2 ? taDiaN(d.y, d.mejor.hasta) : -2, brilla = taSale(taP(t, 2300, 500));
    x.font = taF(700, 24); x.textAlign = "right";
    for (let m = 0; m < 12; m++) {
      const dm = new Date(d.y, m + 1, 0).getDate(), base = Math.round((new Date(d.y, m, 1) - new Date(d.y, 0, 1)) / 864e5);
      x.globalAlpha = taP(t, 450 + m * 110, 300); x.fillStyle = P.suave; x.fillText(TA_MESES_CORTO[m], x0 - 22, y0 + m * 34 + 8); x.globalAlpha = 1;
      for (let k = 0; k < dm; k++) {
        const n = base + k, pe = taP(t, 500 + n * 4.2, 240); if (pe <= 0) continue;
        const v = d.mapa[n], rr = r * taRebote(pe), cxx = x0 + k * paso, cyy = y0 + m * 34;
        x.beginPath(); x.arc(cxx, cyy, Math.max(0, rr), 0, Math.PI * 2);
        x.fillStyle = v === 1 ? "#1A1300" : v === 0 ? "rgba(26,19,0,0.16)" : "rgba(26,19,0,0.06)"; x.fill();
        if (v === 1 && n >= r0 && n <= r1 && brilla > 0) {   // tu mejor racha, encendida
          const pul = quieto ? 1 : 1 + 0.12 * Math.sin(amb * 4 + n * 0.3);
          x.globalAlpha = brilla; x.fillStyle = "#FFFFFF"; x.beginPath(); x.arc(cxx, cyy, rr * 0.62 * pul, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
        }
      }
    }
    x.textAlign = "left";
  }
  if (id === "habitos") {   // marcas como en una agenda, que se trazan una por una
    x.strokeStyle = "rgba(255,255,255,0.16)"; x.lineWidth = 10; x.lineCap = "round"; x.lineJoin = "round";
    const L1 = Math.hypot(26, 28), L2 = Math.hypot(48, 58);
    for (let i = 0; i < 14; i++) {
      const p = taP(t, 600 + i * 90, 380); if (p <= 0) continue;
      const cx = 140 + (i % 7) * 135, cy = 1380 + Math.floor(i / 7) * 150 + (quieto ? 0 : Math.sin(amb * 1.6 + i) * 4), l = taSale(p) * (L1 + L2);
      x.beginPath(); x.moveTo(cx - 34, cy);
      if (l <= L1) x.lineTo(cx - 34 + 26 * l / L1, cy + 28 * l / L1);
      else { x.lineTo(cx - 8, cy + 28); const q = (l - L1) / L2; x.lineTo(cx - 8 + 48 * q, cy + 28 - 58 * q); }
      x.stroke();
    }
  }
  if (id === "medallas") {   // medallas que caen, rebotan y se mecen
    const n = Math.min(5, Math.max(3, d.medallas.length));
    for (let i = 0; i < n; i++) {
      const p = taP(t, 500 + i * 160, 900); if (p <= 0) continue;
      const cx = W / 2 + (i - (n - 1) / 2) * 170, cy = 1580 + (i % 2) * 40 - (1 - taBote(p)) * 380;
      const ang = quieto ? 0 : Math.sin(amb * 2.4 + i * 1.3) * 0.07;
      x.save(); x.globalAlpha = Math.min(1, p * 4); x.translate(cx, cy - 220); x.rotate(ang); x.translate(-cx, -(cy - 220));
      x.strokeStyle = i % 2 ? "#6C5CE7" : "#E5527A"; x.lineWidth = 16; x.lineCap = "butt"; x.beginPath(); x.moveTo(cx - 30, cy - 220); x.lineTo(cx, cy - 60); x.lineTo(cx + 30, cy - 220); x.stroke();
      const gr = x.createRadialGradient(cx - 18, cy - 18, 8, cx, cy, 70); gr.addColorStop(0, "#FFF1B8"); gr.addColorStop(1, "#E0A526");
      x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, 64, 0, Math.PI * 2); x.fill();
      x.fillStyle = "rgba(120,72,0,0.55)"; taEstrella(x, cx, cy, 30, 13);
      if (!quieto) { const b = (amb * 0.8 + i * 0.37) % 2.2; if (b < 0.5) { x.globalAlpha = 0.5 * Math.sin(b / 0.5 * Math.PI); x.fillStyle = "#FFFFFF"; x.beginPath(); x.arc(cx - 20, cy - 22, 14, 0, Math.PI * 2); x.fill(); } }   // un brillo que pasa
      x.restore();
    }
  }
  if (id === "agua") {   // el agua sube y las olas se mueven; burbujas que suben
    const sube = taSale(taP(t, 250, 1500));
    [[1370, "rgba(255,255,255,0.14)"], [1450, "rgba(255,255,255,0.18)"], [1530, "rgba(255,255,255,0.22)"]].forEach(([yy, col], k) => {
      const y2 = yy + (1 - sube) * 650;
      x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
      for (let px = 0; px <= W; px += 20) x.lineTo(px, y2 + Math.sin(px / 90 + k * 1.7 + amb * (1.1 + k * 0.35)) * 26);
      x.lineTo(W, H); x.closePath(); x.fill();
    });
    if (!quieto && sube > 0.6) {
      x.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 10; i++) { const by = H - 20 - ((amb * (70 + i * 6) + i * 90) % 520), bx = 110 + (i * 137) % 860 + Math.sin(amb * 2 + i) * 10; if (by < 1400) continue; x.beginPath(); x.arc(bx, by, 5 + (i % 4) * 3, 0, Math.PI * 2); x.fill(); }
    }
  }
  if (id === "libros") {   // los lomos de tus libros caen a la repisa
    const L = d.libros.lista.slice(0, 12), cols = ["#B5462B", "#2E6E8E", "#C08A2D", "#3E7B4F", "#6B4C8A", "#8A3B3B"];
    let px = 120; const base = 1560;
    x.fillStyle = "#8A6B44"; x.fillRect(90, base, (W - 180) * taSale(taP(t, 250, 500)), 22);
    L.forEach((l, i) => {
      const w = 54 + (l.paginas % 5) * 8, h = 300 + ((l.paginas || 200) % 7) * 22, p = taP(t, 550 + i * 110, 650);
      if (p > 0) {
        const oy = -(1 - taBote(p)) * 520;
        x.save(); x.globalAlpha = Math.min(1, p * 4);
        x.fillStyle = /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : cols[i % cols.length]; x.fillRect(px, base - h + oy, w, h);
        x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(px + 8, base - h + 30 + oy, w - 16, 6); x.fillRect(px + 8, base - 50 + oy, w - 16, 6);
        x.restore();
      }
      px += w + 10;
    });
    if (d.libros.lista.length) taSube(x, taP(t, 650 + L.length * 110 + 300, 500), 20, () => { x.fillStyle = P.suave; x.font = taF(600, 34); x.textAlign = "center"; taLineas(x, d.libros.lista.slice(-3).map(l => `«${l.titulo}»`).join(" · "), W / 2, 1640, W - 200, 44, 2); x.textAlign = "left"; });
  }
  if (id === "objetivos") {   // la montaña sube y se iza la bandera
    const dy = (1 - taSale(taP(t, 250, 900))) * 520, cima = W * 0.42;
    x.fillStyle = "rgba(255,255,255,0.12)"; x.beginPath(); x.moveTo(-40, H - 160 + dy); x.lineTo(cima, 1440 + dy); x.lineTo(W + 40, H - 160 + dy); x.closePath(); x.fill();
    const pp = taSale(taP(t, 1050, 400));
    if (pp > 0) { x.strokeStyle = "#FFFFFF"; x.lineWidth = 6; x.beginPath(); x.moveTo(cima, 1440 + dy); x.lineTo(cima, 1440 + dy - 130 * pp); x.stroke(); }
    const pf = taSale(taP(t, 1350, 600));
    if (pf > 0) {
      const fy = 1440 + dy - 70 - 60 * pf, ola = quieto ? 0 : Math.sin(amb * 5) * 10;
      x.fillStyle = "#FFE9A8"; x.beginPath(); x.moveTo(cima, fy); x.quadraticCurveTo(cima + 55, fy + 10 - ola, cima + 110, fy + 35 + ola); x.quadraticCurveTo(cima + 55, fy + 60 - ola, cima, fy + 70); x.closePath(); x.fill();
    }
  }
  if (id === "animo") {   // corazones suaves que flotan hacia arriba
    for (let i = 0; i < 9; i++) {
      const a = 0.14 + az() * 0.12, hx = 120 + az() * (W - 240), hy = 1300 + az() * 330, hs = 30 + az() * 40;
      const sube = quieto ? 0 : (amb * 40 + i * 53) % 260, fade = quieto ? 1 : Math.min(1, (260 - sube) / 80);
      x.globalAlpha = a * taP(t, 400 + i * 80, 500) * fade; x.fillStyle = "#FFFFFF"; taCorazon(x, hx + (quieto ? 0 : Math.sin(amb * 1.5 + i) * 12), hy - sube, hs);
    }
    x.globalAlpha = 1;
  }
  if (id === "rueda" && d.rueda) {   // una rosa de los vientos que gira y se asienta
    const cx = W / 2, cy = 1440, R = 230, p = taP(t, 400, 1400), rot = quieto ? 0 : (1 - taRebote(p)) * -Math.PI * 1.5 + Math.sin(amb * 1.3) * 0.02;
    if (p > 0) {
      x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(taSale(Math.min(1, p * 1.6)), taSale(Math.min(1, p * 1.6))); x.translate(-cx, -cy);
      x.strokeStyle = "rgba(255,255,255,0.18)"; x.lineWidth = 3; [R, R * 0.66, R * 0.33].forEach(r => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); });
      for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4, l = k % 2 ? R * 0.62 : R; x.fillStyle = k === 0 ? "#5FD3C4" : "rgba(255,255,255,0.28)";
        x.beginPath(); x.moveTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.lineTo(cx + Math.cos(a + 0.18) * 40, cy + Math.sin(a + 0.18) * 40); x.lineTo(cx + Math.cos(a - 0.18) * 40, cy + Math.sin(a - 0.18) * 40); x.closePath(); x.fill(); }
      x.restore();
    }
  }
}
function taEstrella(x, cx, cy, R, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
function taCorazon(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * 0.35); x.bezierCurveTo(cx - s, cy - s * 0.4, cx - s * 0.4, cy - s, cx, cy - s * 0.4); x.bezierCurveTo(cx + s * 0.4, cy - s, cx + s, cy - s * 0.4, cx, cy + s * 0.35); x.fill(); }

/* -------- La historia a pantalla completa -------- */
function taAhora() { return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now(); }
function taQuieto() { return typeof window !== "undefined" && !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
async function openTuAnio(y) {
  y = +y || anioActual();
  if (!tuAnioDisponible(y) && !(typeof esCuentaDuena === "function" && esCuentaDuena())) return toast(`Tu ${y} en Rumbo llega el 1 de diciembre`, true);
  if (TA.cargando) return; TA.cargando = true;
  try {
    if (typeof loadThemeFonts === "function") loadThemeFonts("norte");
    if (document.fonts && document.fonts.load) { try { await Promise.all([`800 120px "Bricolage Grotesque"`, `700 60px "Bricolage Grotesque"`, `600 40px "Figtree"`, `800 30px "Figtree"`].map(f => document.fonts.load(f))); } catch (e) {} }
    TA.ele = typeof elefanteImagen === "function" ? await elefanteImagen({ animo: "feliz" }) : null;
    TA.d = tuAnioDatos(STATE, y); TA.y = y; TA.laminas = tuAnioLaminas(TA.d); TA.i = 0; TA.video = null; TA.archivos = [];
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
    <div class="tuanio__lam" id="ta-lam"><canvas id="ta-cv" width="${TU_ANIO.W}" height="${TU_ANIO.H}" role="img"></canvas><button type="button" class="tuanio__zona tuanio__zona--a" data-action="ta-ant" aria-label="Lámina anterior"></button><button type="button" class="tuanio__zona tuanio__zona--s" data-action="ta-sig" aria-label="Lámina siguiente"></button></div>
    <div class="tuanio__acc"><button type="button" class="tuanio__btn tuanio__btn--p" data-action="ta-compartir">Compartir esta</button><button type="button" class="tuanio__btn" data-action="ta-todas">Compartir las ${n}</button></div>
    <p class="tuanio__nota">Las imágenes y los videos se crean en tu teléfono. Solo salen de la app si tú los compartes.</p>
    <div class="tuanio__hoja" id="ta-hoja" hidden></div></div>`;
  TA.volver = document.activeElement; TA.quieto = taQuieto();
  el.hidden = false; document.body.classList.add("en-foco");
  const lam = el.querySelector("#ta-lam");
  lam.addEventListener("pointerdown", () => tuAnioPausa(true)); ["pointerup", "pointercancel", "pointerleave"].forEach(ev => lam.addEventListener(ev, () => tuAnioPausa(false)));
  TA.prevOk = false; TA.i = -1; tuAnioIr(0);
  const sig = el.querySelector('[data-action="ta-sig"]'); if (sig) sig.focus({ preventScroll: true });
  taPrepararImagenes();
}
function tuAnioIr(i) {
  const n = TA.laminas.length; if (!n) return;
  i = Math.max(0, Math.min(n - 1, i));
  const cv = document.getElementById("ta-cv"); if (!cv) return;
  if (!TA.quieto && TA.i >= 0 && i !== TA.i) {   // la que se va queda debajo mientras entra la nueva en un círculo que crece
    TA.prev = TA.prev || document.createElement("canvas"); TA.prev.width = cv.width; TA.prev.height = cv.height;
    TA.prev.getContext("2d").drawImage(cv, 0, 0); TA.prevOk = true;
  }
  TA.i = i;
  cv.setAttribute("aria-label", tuAnioAlt(TA.laminas[TA.i], TA.d));
  TA.laminas.forEach((_, k) => { const b = document.getElementById("ta-b" + k); if (b) { b.style.transition = "none"; b.style.width = k < TA.i ? "100%" : "0%"; } });
  const ult = TA.i === n - 1, s = document.querySelector('[data-action="ta-sig"]'); if (s) s.setAttribute("aria-label", ult ? "Ver de nuevo" : "Lámina siguiente");
  TA.ini0 = taAhora(); TA.pausado = 0; TA.pausaDesde = TA.pausa ? taAhora() : 0;
  TA.resto = TA_MS; tuAnioCorrer(); tuAnioAnimar();
}
/* El reloj de la lámina (se detiene mientras mantienes el dedo) */
function taTiempo() { return (TA.pausaDesde || taAhora()) - TA.ini0 - TA.pausado; }
function tuAnioAnimar() { if (TA.raf) cancelAnimationFrame(TA.raf); TA.raf = requestAnimationFrame(tuAnioCuadro); }
function tuAnioCuadro() {
  TA.raf = 0;
  const el = document.getElementById("tuanio"), cv = document.getElementById("ta-cv"); if (!el || el.hidden || !cv || TA.i < 0) return;
  const t = TA.quieto && !TA.grabando ? TA_FIN : taTiempo(), x = cv.getContext("2d");
  if (TA.pausaDesde && TA.ultT === t && TA.ultI === TA.i) { TA.raf = requestAnimationFrame(tuAnioCuadro); return; }   // en pausa: nada cambia
  TA.ultT = t; TA.ultI = TA.i;
  const rev = TA.prevOk && t !== TA_FIN ? taSale(taP(t, 0, 520)) : 1;
  if (rev < 1) { x.drawImage(TA.prev, 0, 0); x.save(); x.beginPath(); x.arc(TU_ANIO.W / 2, TU_ANIO.H * 0.45, Math.max(1, rev * 2250), 0, Math.PI * 2); x.clip(); }
  tuAnioPintar(x, TA.laminas[TA.i], TA.d, { ele: TA.ele }, t);
  if (rev < 1) x.restore(); else TA.prevOk = false;
  TA.cuadros = (TA.cuadros || 0) + 1;
  if (!(TA.quieto && !TA.grabando)) TA.raf = requestAnimationFrame(tuAnioCuadro);
}
function tuAnioCorrer() {
  clearTimeout(TA.t); const b = document.getElementById("ta-b" + TA.i); if (!b) return;
  if (TA.quieto) { b.style.width = "100%"; return; }   // sin moverse sola: se avanza tocando
  if (TA.pausa || TA.grabando || TA.hoja) return;
  TA.ini = Date.now(); void b.offsetWidth; b.style.transition = `width ${TA.resto}ms linear`; b.style.width = "100%";
  TA.t = setTimeout(() => { if (TA.i < TA.laminas.length - 1) tuAnioIr(TA.i + 1); }, TA.resto);
}
/* Detiene la barra (y el movimiento, si `reloj`) sin perder lo que llevaba */
function taDetenerBarra() {
  clearTimeout(TA.t); const b = document.getElementById("ta-b" + TA.i); if (!b) return;
  if (b.style.transition && b.style.transition !== "none") { TA.resto = Math.max(300, TA.resto - (Date.now() - TA.ini)); const w = getComputedStyle(b).width; b.style.transition = "none"; b.style.width = w; }
}
function tuAnioPausa(on) {
  if (on === TA.pausa || TA.grabando) return; TA.pausa = on;
  if (on) { taDetenerBarra(); if (!TA.pausaDesde) TA.pausaDesde = taAhora(); }
  else { if (TA.pausaDesde) { TA.pausado += taAhora() - TA.pausaDesde; TA.pausaDesde = 0; } tuAnioCorrer(); }
}
function tuAnioCerrar() {
  if (TA.grabando) return;
  clearTimeout(TA.t); if (TA.raf) cancelAnimationFrame(TA.raf); TA.raf = 0; TA.hoja = false; TA.video = null;
  const el = document.getElementById("tuanio"); if (el) el.hidden = true;
  if (!document.getElementById("foco") || document.getElementById("foco").hidden) document.body.classList.remove("en-foco");
  if (TA.volver && TA.volver.isConnected && TA.volver.focus) TA.volver.focus({ preventScroll: true }); TA.volver = null;
}

/* -------- Compartir: como imagen (quieta) o como video (la lámina moviéndose) -------- */
const TA_VIDEO_MS = 6000;
function taVideoTipo() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  return ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]   // H.264 primero: es lo que mejor reciben Instagram y WhatsApp
   .find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || "";
}
function tuAnioVideoPuede() {
  if (TA.quieto || typeof document === "undefined") return false;
  return typeof document.createElement("canvas").captureStream === "function" && !!taVideoTipo();
}
/* La imagen quieta de una lámina, en JPEG (queda guardada: el iPhone pide abrir el menú de compartir justo después del toque) */
async function taArchivo(i) {
  TA.archivos = TA.archivos || [];
  if (TA.archivos[i]) return TA.archivos[i];
  const c = tuAnioDibujar(TA.laminas[i], TA.d, { ele: TA.ele });
  const b = await new Promise(res => c.toBlob(res, "image/jpeg", 0.92));
  c.width = c.height = 1;
  return (TA.archivos[i] = new File([b], `rumbo-${TA.y}-${i + 1}.jpg`, { type: "image/jpeg" }));
}
async function tuAnioArchivos(idx) { const fs = []; for (const i of idx) fs.push(await taArchivo(i)); return fs; }   // de a una, para no ocupar mucha memoria
/* Las deja listas de a una, sin apuro, mientras ves la historia */
function taPrepararImagenes() {
  const y = TA.y, sig = k => {
    if (TA.y !== y || k >= TA.laminas.length) return;
    const el = document.getElementById("tuanio"); if (!el || el.hidden) return;
    if (TA.grabando) return setTimeout(() => sig(k), 1000);
    taArchivo(k).then(() => setTimeout(() => sig(k + 1), 150)).catch(() => {});
  };
  setTimeout(() => sig(0), 1200);
}
async function taMandar(files, titulo) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title: titulo }); if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu año"); return true; }
    catch (e) { if (e && e.name === "AbortError") return false; }
  }
  files.forEach((f, k) => setTimeout(() => {   // sin menú de compartir (computador): se descargan
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, k * 250));
  const vid = files.some(f => /^video\//.test(f.type));
  toast(vid ? "🎬 Video descargado" : files.length === 1 ? "🖼️ Imagen descargada" : `🖼️ ${files.length} imágenes descargadas`);
  if (typeof registrarCompartido === "function") registrarCompartido("Compartiste tu año");
  return true;
}
async function tuAnioCompartir(todas) {
  taDetenerBarra();
  const idx = todas ? TA.laminas.map((_, i) => i) : [TA.i];
  await taMandar(await tuAnioArchivos(idx), `Mi ${TA.y} en Rumbo`);
  tuAnioCorrer();
}
/* La hoja de «Compartir esta»: video o imagen */
function tuAnioHoja(estado, extra) {
  const h = document.getElementById("ta-hoja"); if (!h) return;
  if (!estado) { h.hidden = true; h.innerHTML = ""; TA.hoja = false; tuAnioCorrer(); return; }
  TA.hoja = true; taDetenerBarra(); h.hidden = false;
  if (estado === "elegir") h.innerHTML = `<b>Compartir esta lámina</b>
    <button type="button" class="tuanio__btn tuanio__btn--p" data-action="ta-video">Como video <small>se mueve, ${TA_VIDEO_MS / 1000} s</small></button>
    <button type="button" class="tuanio__btn" data-action="ta-imagen">Como imagen</button>
    <button type="button" class="tuanio__btn tuanio__btn--x" data-action="ta-hoja-cerrar">Cancelar</button>`;
  else if (estado === "grabando") h.innerHTML = `<b>Grabando tu video…</b><div class="tuanio__prog" aria-hidden="true"><i id="ta-prog"></i></div><small class="tuanio__nota">Toma ${TA_VIDEO_MS / 1000} segundos. No cierres esta pantalla.</small>`;
  else if (estado === "listo") h.innerHTML = `<b>Tu video está listo</b>
    <button type="button" class="tuanio__btn tuanio__btn--p" data-action="ta-video-mandar">Compartir video</button>
    <button type="button" class="tuanio__btn tuanio__btn--x" data-action="ta-hoja-cerrar">Listo</button>`;
  else if (estado === "error") h.innerHTML = `<b>No se pudo grabar el video</b><small class="tuanio__nota">${escapeHtml(extra || "Compártela como imagen.")}</small>
    <button type="button" class="tuanio__btn tuanio__btn--p" data-action="ta-imagen">Como imagen</button>
    <button type="button" class="tuanio__btn tuanio__btn--x" data-action="ta-hoja-cerrar">Cancelar</button>`;
  const b = h.querySelector("button"); if (b) b.focus({ preventScroll: true });
}
/* Graba la lámina de nuevo desde el comienzo, tal como se ve (la grabación es en tiempo real) */
async function tuAnioGrabar() {
  const cv = document.getElementById("ta-cv"), tipo = taVideoTipo(); if (!cv || !tipo) return tuAnioHoja("error");
  tuAnioHoja("grabando"); TA.grabando = true; TA.prevOk = false;
  let stream = null;
  try {
    stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 8000000 }), partes = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
    const fin = new Promise((res, rej) => { rec.onstop = res; rec.onerror = e => rej(e.error || e); });
    TA.ini0 = taAhora(); TA.pausado = 0; TA.pausaDesde = 0; tuAnioAnimar();
    rec.start(250);
    const t0 = Date.now(), prog = setInterval(() => { const p = document.getElementById("ta-prog"); if (p) p.style.width = Math.min(100, (Date.now() - t0) / TA_VIDEO_MS * 100) + "%"; }, 150);
    await new Promise(r => setTimeout(r, TA_VIDEO_MS));
    clearInterval(prog); rec.stop(); await fin;
    const blob = new Blob(partes, { type: tipo.split(";")[0] });
    if (!blob.size) throw new Error("vacío");
    TA.video = new File([blob], `rumbo-${TA.y}-${TA.i + 1}.${/mp4/.test(tipo) ? "mp4" : "webm"}`, { type: blob.type });
    TA.grabando = false; tuAnioHoja("listo");
  } catch (e) {
    TA.grabando = false; TA.video = null; tuAnioHoja("error");
  } finally {
    if (stream) stream.getTracks().forEach(tr => tr.stop());
    TA.grabando = false; if (TA.quieto) tuAnioAnimar();
  }
}
function tuAnioAccion(a, d) {
  if (a === "ta-abrir") return openTuAnio(+d.y);
  if (TA.grabando) return;
  if (a === "ta-cerrar") return tuAnioCerrar();
  if (a === "ta-sig") { if (TA.hoja) return; return TA.i >= TA.laminas.length - 1 ? tuAnioIr(0) : tuAnioIr(TA.i + 1); }
  if (a === "ta-ant") { if (TA.hoja) return; return tuAnioIr(TA.i - 1); }
  if (a === "ta-compartir") return tuAnioVideoPuede() ? tuAnioHoja("elegir") : tuAnioCompartir(false);
  if (a === "ta-todas") return tuAnioCompartir(true);
  if (a === "ta-video") return tuAnioGrabar();
  if (a === "ta-imagen") { tuAnioHoja(null); return tuAnioCompartir(false); }
  if (a === "ta-video-mandar") { const f = TA.video; return f ? taMandar([f], `Mi ${TA.y} en Rumbo`).then(ok => { if (ok) tuAnioHoja(null); }) : tuAnioHoja(null); }
  if (a === "ta-hoja-cerrar") { TA.video = null; return tuAnioHoja(null); }
}
if (typeof document !== "undefined") document.addEventListener("keydown", e => {
  const el = document.getElementById("tuanio"); if (!el || el.hidden) return;
  if (e.key === "Escape") { if (TA.hoja && !TA.grabando) tuAnioHoja(null); else tuAnioCerrar(); }
  else if (TA.hoja) return;
  else if (e.key === "ArrowRight") tuAnioAccion("ta-sig", {}); else if (e.key === "ArrowLeft") tuAnioIr(TA.i - 1);
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
