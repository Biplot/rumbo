/* ============================================================
   RUMBO · 🧭 La Rueda de la vida (rueda.js)
   Cada mes pones una nota del 0 al 10 a cada área. La rueda la dibuja (la rosa de los vientos viene con
   Rumbo; el barco fantasma, el instrumento, la constelación, el mandala y el vitral se compran en la
   Tienda, key "rueda"), la compara con el mes pasado (la sombra punteada y una flecha por área) y te dice
   tu rumbo del mes: el área que más subió y la que pide cariño.
   · Se puntúa arrastrando cada punta sobre el dibujo, con los botones − / + o con las barras de abajo, y en
     «El minuto de la rueda» (un área a la vez). «Ver mi rumbo» la anima desde tu mes pasado.
   · «Lo que dice tu Rumbo»: pistas de tus datos del mes por área (tu agua, tus tareas Pro, tu ánimo del
     Diario, tus libros…) y los hábitos y objetivos que le asignaste a esa área. Nunca ponen la nota por ti.
   · El área más baja trae un paso chico (un hábito, un objetivo o un plan) que se crea en un toque.
   · Una frase por área y por mes («¿por qué un 5?»), que el mes siguiente se muestra al lado.
   · Tus áreas: cambiar nombres y colores, ocultar las que no te sirven (sus notas se guardan) y sumar
     hasta 10. El índice de cada área nunca cambia, así las notas de todos los meses siguen en su lugar.
   · Tu año, área por área (un mapa de colores) y la imagen para compartir (con o sin números).
   Datos: las notas en datosAnio(año).rueda.meses[mes][índice]; las frases en datosAnio(año).rueda.frases
   [mes][índice]; los nombres en STATE.rueda.areas; lo demás en STATE.rueda.cfg = { ocultas, colores,
   pasoNo, ts }. STATE.rueda.ts marca la última edición del año base (para la fusión entre equipos).
   ============================================================ */
const RUEDA_NOMBRES = ["Salud y deporte", "Familia y amor", "Trabajo y finanzas", "Ocio y amistad", "Tiempo para mí", "Emocional", "Educativa y cultural", "Espiritual y ética"];
const RUEDA_CORTOS = ["Salud", "Familia", "Trabajo", "Ocio", "Para mí", "Emoción", "Aprender", "Espíritu"];
const RUEDA_COLORES = ["#17A99A", "#E5527A", "#3E7BD6", "#E9A21F", "#8B5CF6", "#FF6B4A", "#2E9E7B", "#5B6BD6", "#C2410C", "#0E8AA8"];
const RUEDA_MAX_AREAS = 10, RUEDA_MIN_AREAS = 5;
const RUEDA_ESTILOS = [
  { id: "rosa", nombre: "La rosa de los vientos", cos: null, desc: "una punta de brújula por área; la más larga marca tu rumbo", r0: 0, r10: 118 },
  { id: "fantasma", nombre: "El barco fantasma", cos: "rueda-fantasma", desc: "inspirado en la leyenda del holandés errante: niebla, luna y faroles", r0: 22, r10: 100, oscuro: true, bg: "#06121A" },
  { id: "instrumento", nombre: "El instrumento", cos: "rueda-instrumento", desc: "bronce sobre una carta de navegación; tu nota es una gema en su marca", r0: 24, r10: 96, oscuro: true, bg: "#0F2236" },
  { id: "constelacion", nombre: "La constelación", cos: "rueda-constelacion", desc: "estrellas de noche que brillan más mientras más alta la nota", r0: 8, r10: 116.6, oscuro: true, bg: "#0C1430" },
  { id: "mandala", nombre: "El mandala", cos: "rueda-mandala", desc: "cuentas de colores, una por cada punto de nota", r0: 0, r10: 112 },
  { id: "vitral", nombre: "El vitral", cos: "rueda-vitral", desc: "vidrios de colores que se iluminan hasta tu nota", r0: 14, r10: 118, oscuro: true, bg: "#1E1A2E" },
];
/* Un paso chico para cada área de fábrica (el área que pide cariño) */
const RUEDA_PASOS = [
  { tipo: "habito", nombre: "Caminar 20 minutos", icon: "🏃" }, { tipo: "objetivo", nombre: "Un almuerzo en familia" },
  { tipo: "objetivo", nombre: "Ordenar mis finanzas del mes" }, { tipo: "plan", nombre: "Juntarme con amigos" },
  { tipo: "habito", nombre: "20 minutos para mí", icon: "☀️" }, { tipo: "habito", nombre: "Escribir 3 líneas en el Diario", icon: "✏️" },
  { tipo: "habito", nombre: "Leer 15 minutos", icon: "📖" }, { tipo: "habito", nombre: "Meditar 5 minutos", icon: "🧘" },
];
const RD = { sel: 0, anioK: null, minuto: null, anim: 0, drag: null };

/* ============ Los datos ============ */
function ruedaCfg(S) {
  S = S || STATE; const r = S.rueda;
  if (!r.cfg || typeof r.cfg !== "object") r.cfg = {};
  const c = r.cfg;
  if (!Array.isArray(c.ocultas)) c.ocultas = [];
  if (!c.colores || typeof c.colores !== "object") c.colores = {};
  if (!c.pasoNo || typeof c.pasoNo !== "object") c.pasoNo = {};
  return c;
}
function ruedaEsDeFabrica(S, k) { return k < 8 && String((S || STATE).rueda.areas[k] || "").trim() === RUEDA_NOMBRES[k]; }
function ruedaNombre(S, k) { return String((S || STATE).rueda.areas[k] || "").trim() || "Área " + (k + 1); }
function ruedaCorto(S, k) { S = S || STATE; if (ruedaEsDeFabrica(S, k)) return RUEDA_CORTOS[k]; const p = ruedaNombre(S, k).split(/\s+/)[0]; return p.length > 11 ? p.slice(0, 10) + "…" : p; }
function ruedaColor(S, k) { const c = ruedaCfg(S).colores[k]; return /^#[0-9a-f]{6}$/i.test(c || "") ? c : RUEDA_COLORES[k % RUEDA_COLORES.length]; }
/* Las áreas que se ven (por índice); las ocultas guardan sus notas */
function ruedaVisibles(S) {
  S = S || STATE; const oc = new Set(ruedaCfg(S).ocultas.map(Number));
  return S.rueda.areas.map((_, k) => k).filter(k => !oc.has(k) && String(S.rueda.areas[k] || "").trim());
}
function ruedaYM(y, m) { return y + "-" + String(m + 1).padStart(2, "0"); }
function ruedaAntes(y, m) { return m > 0 ? [y, m - 1] : [y - 1, 11]; }
/* Las notas de un mes, una por índice de área (las que faltan, 0) */
function ruedaMes(S, y, m) { S = S || STATE; const a = (datosAnio(S, y).rueda.meses || [])[m] || []; return S.rueda.areas.map((_, k) => Math.max(0, Math.min(10, +a[k] || 0))); }
function ruedaHay(S, vals) { return ruedaVisibles(S).some(k => (vals[k] || 0) > 0); }
/* El promedio de las áreas que se ven (null si el mes no tiene notas) */
function ruedaPromedio(S, vals) {
  S = S || STATE; const vs = ruedaVisibles(S).map(k => +(vals || [])[k] || 0), s = vs.reduce((a, b) => a + b, 0);
  return s > 0 && vs.length ? Math.round(s / vs.length * 10) / 10 : null;
}
/* Marca la edición (año base: STATE.rueda.ts; los otros años: tocarAnio) */
function ruedaTocar(S, y) { S = S || STATE; if (+y === anioBase(S)) S.rueda.ts = Date.now(); else tocarAnio(S, y, "rueda"); }
function ruedaPoner(S, y, m, k, v) {
  S = S || STATE; const D = datosAnio(S, y, true);
  D.rueda.meses = D.rueda.meses || Array.from({ length: 12 }, () => []);
  const a = D.rueda.meses[m] = Array.isArray(D.rueda.meses[m]) ? D.rueda.meses[m] : [];
  while (a.length < S.rueda.areas.length) a.push(0);
  a[k] = Math.max(0, Math.min(10, Math.round(+v || 0)));
  ruedaTocar(S, y);
  return a[k];
}
/* El rumbo del mes: el área que más subió y la que pide cariño */
function ruedaRumbo(S, y, m) {
  S = S || STATE; const vis = ruedaVisibles(S), v = ruedaMes(S, y, m), [ya, ma] = ruedaAntes(y, m), a = ruedaMes(S, ya, ma);
  const hay = ruedaHay(S, v), hayAnt = ruedaHay(S, a);
  let mejor = null, menor = null, alto = null;
  vis.forEach(k => {
    if (hayAnt) { const d = v[k] - a[k]; if (d > 0 && (!mejor || d > mejor.dif)) mejor = { k, dif: d }; }
    if (v[k] > 0 && (!menor || v[k] < menor.v)) menor = { k, v: v[k] };
    if (!alto || v[k] > alto.v) alto = { k, v: v[k] };
  });
  return { hay, hayAnt, mejor, menor, alto: hay ? alto : null, prom: ruedaPromedio(S, v), promAnt: ruedaPromedio(S, a) };
}
function ruedaRumboTxt(S, R) {
  if (!R.hay) return { t: "Todavía sin notas", s: "Pon una nota a cada área: te toma un minuto." };
  const t = R.mejor ? `Apuntas a ${ruedaCorto(S, R.mejor.k)} (+${R.mejor.dif})` : R.hayAnt ? "Te mantienes estable" : `Tu área más alta: ${ruedaCorto(S, R.alto.k)} (${R.alto.v})`;
  const s = R.menor && R.menor.v <= 6 ? `Pide cariño: ${ruedaNombre(S, R.menor.k)} (${R.menor.v})` : "Ninguna área está bajo 7: buen mes.";
  return { t, s };
}

/* ============ Lo que dice tu Rumbo (pistas del mes, nunca la nota) ============ */
function ruedaDias(y, m) {
  const n = daysInMonth(y, m), hoy = todayISO(), out = [];
  for (let d = 1; d <= n; d++) { const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (iso > hoy) break; out.push(iso); }
  return out;
}
function ruedaDiasHabito(S, h, y, m) { const log = ((S.habitos.log || {})[`${y}-${m + 1}`] || {})[h.id] || {}; return Object.keys(log).filter(d => log[d]).length; }
const RUEDA_HAB_NOMBRE = { 6: /estud|leer|lectur|curso|idioma|ingl|aprend/i, 7: /medit|orar|rez|yoga|respir|gratitud/i, 0: /deport|entren|correr|caminar|gimnas|ejercic|bici|nadar/i };
function ruedaPistas(S, y, m, k) {
  S = S || STATE; const ym = ruedaYM(y, m), out = [], plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const dias = ruedaDias(y, m), diario = ((S.vida && S.vida.diario) || []).filter(e => e && String(e.fecha || "").startsWith(ym));
  const libros = (S.lecturas || []).filter(l => l && l.estado === "terminado" && !l.antes && String(l.fin || "").startsWith(ym));
  const etiquetados = (S.habitos.defs || []).filter(h => h && !h.pausado && h.area === k);
  const deNombre = re => (S.habitos.defs || []).filter(h => h && !h.pausado && h.area == null && re.test(h.nombre || ""));
  if (ruedaEsDeFabrica(S, k)) {
    if (k === 0) {
      if (typeof aguaDiaCumplido === "function" && typeof aguaDia === "function" && dias.some(f => aguaDia(f, false, S))) out.push(`Tu agua: ${dias.filter(f => aguaDiaCumplido(f, S)).length} de ${dias.length} días cumplida`);
      const sm = (datosAnio(S, y).salud.meses || [])[m]; if (sm && +sm.diasEntren > 0) out.push(`Salud: ${plural(+sm.diasEntren, "día", "días")} de entrenamiento`);
    } else if (k === 1) {
      const n = ((S.vida && S.vida.relaciones) || []).filter(p => String(p.ultimoContacto || "").startsWith(ym)).length;
      if (n) out.push(`Hablaste con ${plural(n, "persona", "personas")} de Relaciones`);
    } else if (k === 2) {
      let pro = 0; if (typeof tareasDelDia === "function") dias.forEach(f => { pro += tareasDelDia(f, S).filter(t => ambitoDe(t) === "pro" && estadoTarea(t) === "hecha").length; });
      if (pro) out.push(`${plural(pro, "tarea Pro hecha", "tareas Pro hechas")}`);
      const fm = (datosAnio(S, y).finanzas.meses || [])[m]; if (fm && +fm.metaAhorro > 0) out.push(`Ahorro: ${Math.round((+fm.ahorro || 0) / +fm.metaAhorro * 100)} % de tu meta del mes`);
    } else if (k === 3) {
      if (typeof PLAN !== "undefined" && Array.isArray(PLAN.lista) && typeof plVa === "function") { const n = PLAN.lista.filter(p => plVa(p) && String(p.fecha || "").startsWith(ym)).length; if (n) out.push(`${plural(n, "plan con amigos", "planes con amigos")}`); }
    } else if (k === 4) {
      const n = ((S.habitos && S.habitos.descansos) || []).filter(d => d && !d.quitado && String(d.fecha || "").startsWith(ym)).length;
      if (n) out.push(`${plural(n, "día de descanso", "días de descanso")} en tus hábitos`);
      if (libros.length) out.push(`${plural(libros.length, "libro terminado", "libros terminados")}`);
    } else if (k === 5) {
      const moods = diario.map(e => +e.mood).filter(x => x >= 1 && x <= 5);
      if (moods.length) out.push(`Tu ánimo en el Diario: ${String(Math.round(moods.reduce((a, b) => a + b, 0) / moods.length * 10) / 10).replace(".", ",")} de 5`);
      const g = new Set(diario.filter(e => String(e.gratitud || "").trim()).map(e => e.fecha)).size; if (g) out.push(`${plural(g, "día", "días")} con gratitud`);
    } else if (k === 6) {
      if (libros.length) { const p = libros.reduce((a, l) => a + (+l.paginas || 0), 0); out.push(p ? `${p} páginas en ${plural(libros.length, "libro terminado", "libros terminados")}` : `${plural(libros.length, "libro terminado", "libros terminados")}`); }
    } else if (k === 7) {
      const g = new Set(diario.filter(e => String(e.gratitud || "").trim()).map(e => e.fecha)).size; if (g) out.push(`${plural(g, "día", "días")} con gratitud en el Diario`);
    }
    if (RUEDA_HAB_NOMBRE[k]) deNombre(RUEDA_HAB_NOMBRE[k]).forEach(h => { const n = ruedaDiasHabito(S, h, y, m); if (n) out.push(`${h.nombre}: ${plural(n, "día", "días")}`); });
  }
  etiquetados.forEach(h => out.push(`${h.nombre}: ${plural(ruedaDiasHabito(S, h, y, m), "día", "días")} este mes`));
  ((datosAnio(S, y).metas.mensuales || [])[m] || []).filter(o => o && o.area === k).forEach(o => out.push(`Objetivo: «${o.texto}»${o.done ? " ✓" : ""}`));
  return out.slice(0, 4);
}
/* Lo que cuida cada área (U5): hábitos y objetivos del mes con esa área */
function ruedaCuidan(S, y, m, k) {
  S = S || STATE;
  return { habitos: (S.habitos.defs || []).filter(h => h && !h.pausado && h.area === k), objetivos: ((datosAnio(S, y).metas.mensuales || [])[m] || []).filter(o => o && o.area === k) };
}
/* El paso chico para el área que pide cariño (una vez por mes; «Ahora no» lo guarda) */
function ruedaPaso(S, y, m) {
  S = S || STATE; const R = ruedaRumbo(S, y, m); if (!R.menor || R.menor.v > 6) return null;
  const k = R.menor.k; if (ruedaCfg(S).pasoNo[ruedaYM(y, m)]) return null;
  const base = ruedaEsDeFabrica(S, k) ? RUEDA_PASOS[k] : { tipo: "habito", nombre: "", icon: "✅" };
  const txt = base.nombre ? `¿${base.tipo === "plan" ? "Un plan" : base.tipo === "objetivo" ? "Un objetivo" : "Un hábito chico"}? «${base.nombre}»` : `¿Un hábito chico para «${ruedaNombre(S, k)}»?`;
  return Object.assign({ k, txt, btn: base.tipo === "plan" ? "Proponer plan" : base.tipo === "objetivo" ? "Agregar objetivo" : "Crear hábito" }, base);
}
/* Una frase por área y por mes (solo tuya) */
function ruedaFrase(S, y, m, k) { const f = (datosAnio(S || STATE, y).rueda.frases || {})[m] || {}; return String(f[k] || ""); }
function ruedaPonerFrase(S, y, m, k, txt) {
  S = S || STATE; const D = datosAnio(S, y, true); D.rueda.frases = D.rueda.frases || {};
  const f = D.rueda.frases[m] = D.rueda.frases[m] || {}; txt = String(txt || "").trim().slice(0, 100);
  if (txt) f[k] = txt; else delete f[k];
  ruedaTocar(S, y);
}
/* Tu estilo de rueda (uno a la vez; la rosa viene con Rumbo) */
function ruedaEstiloTuyo(id) { const e = RUEDA_ESTILOS.find(x => x.id === id); return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos))); }
function ruedaEstilo() { const eq = (typeof STATE !== "undefined" && STATE && STATE.gamif && STATE.gamif.equipped) || {}; return ruedaEstiloTuyo(eq.rueda) ? eq.rueda : "rosa"; }

/* ============ El dibujo (SVG, en un cuadro de 320 con centro en 160,160) ============ */
const RD_N = { n: 8 };
function rdAng(k, n) { return (Math.PI * 2 * k) / n - Math.PI / 2; }
function rdP(k, r, d, n, cx, cy) { const a = rdAng(k, n) + (d || 0); return [(cx == null ? 160 : cx) + r * Math.cos(a), (cy == null ? 160 : cy) + r * Math.sin(a)]; }
function rdF(p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }
function rdL(a, b, col, w, extra) { return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${extra || ""}/>`; }
function rdC(p, r, fill, extra) { return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0, r).toFixed(1)}" fill="${fill}"${extra || ""}/>`; }
function rdA(hex, a) { return hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0"); }
function rdSector(r0, r1, a0, a1) {
  const c = 160, p0 = [c + r1 * Math.cos(a0), c + r1 * Math.sin(a0)], p1 = [c + r1 * Math.cos(a1), c + r1 * Math.sin(a1)], q1 = [c + r0 * Math.cos(a1), c + r0 * Math.sin(a1)], q0 = [c + r0 * Math.cos(a0), c + r0 * Math.sin(a0)];
  return `M${rdF(q0)} L${rdF(p0)} A${r1.toFixed(1)} ${r1.toFixed(1)} 0 0 1 ${rdF(p1)} L${rdF(q1)}${r0 > 0 ? ` A${r0.toFixed(1)} ${r0.toFixed(1)} 0 0 0 ${rdF(q0)}` : ""} Z`;
}
function rdEstrella(cx, cy, r, c1, c2) {
  let g = ""; for (let k = 0; k < 8; k++) { const w = k % 2 ? r * 0.55 : r, t = rdP(k, w, 0, 8, cx, cy), a = rdP(k, w * 0.28, -Math.PI / 8, 8, cx, cy), b = rdP(k, w * 0.28, Math.PI / 8, 8, cx, cy);
    g += `<path d="M${cx} ${cy} L${rdF(a)} L${rdF(t)} Z" fill="${c1}"/><path d="M${cx} ${cy} L${rdF(b)} L${rdF(t)} Z" fill="${c2}"/>`; }
  return g;
}
const RD_FONDO = (() => { const o = []; let x = 7; for (let s = 0; s < 46; s++) { x = (x * 9301 + 49297) % 233280; const a = x / 233280; x = (x * 9301 + 49297) % 233280; o.push([a * 320, (x / 233280) * 320, 0.4 + ((s * 37) % 10) / 10]); } return o; })();
/* El arte de cada estilo. vals y cols van en el orden de las áreas visibles; u: sufijo para los id */
const RUEDA_ARTE = {
  rosa(vals, cols, T) {
    const n = vals.length, d = Math.PI / n; let g = "";
    for (let i = 1; i <= 5; i++) g += `<circle cx="160" cy="160" r="${(118 * i / 5).toFixed(1)}" fill="none" stroke="${T.line}" stroke-width="${i === 5 ? 1.6 : 1}"${i === 5 ? "" : ' stroke-dasharray="2 5"'}/>`;
    for (let t = 0; t < 64; t++) { const a = Math.PI * 2 * t / 64, l = t % 8 === 0 ? 9 : t % 2 === 0 ? 5 : 2.5; g += `<line x1="${(160 + 122 * Math.cos(a)).toFixed(1)}" y1="${(160 + 122 * Math.sin(a)).toFixed(1)}" x2="${(160 + (122 + l) * Math.cos(a)).toFixed(1)}" y2="${(160 + (122 + l) * Math.sin(a)).toFixed(1)}" stroke="${T.muted}" stroke-width="1" opacity=".55"/>`; }
    for (let k = 0; k < n; k++) g += rdL([160, 160], rdP(k, 118, 0, n), T.line, 1);
    vals.forEach((x, k) => { const r = Math.max(0.5, x) / 10 * 118, w = Math.max(9, r * 0.26), tip = rdP(k, r, 0, n), l = rdP(k, w, -d, n), rr = rdP(k, w, d, n);
      g += `<path d="M160 160 L${rdF(l)} L${rdF(tip)} Z" fill="${cols[k]}"/><path d="M160 160 L${rdF(rr)} L${rdF(tip)} Z" fill="${rdA(cols[k], 0.55)}"/>`; });
    return g + `<circle cx="160" cy="160" r="8" fill="${T.surface}" stroke="${T.text}" stroke-width="2"/><circle cx="160" cy="160" r="2.8" fill="${T.text}"/>`;
  },
  fantasma(vals, cols, T, u) {
    const n = vals.length;
    let g = `<defs><linearGradient id="rdn${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#040A10"/><stop offset=".7" stop-color="#0C2A2C"/><stop offset="1" stop-color="#123A36"/></linearGradient><radialGradient id="rdl${u}"><stop offset="0" stop-color="#E6FFF4" stop-opacity=".55"/><stop offset="1" stop-color="#E6FFF4" stop-opacity="0"/></radialGradient></defs>`;
    g += `<rect width="320" height="320" fill="url(#rdn${u})"/><circle cx="214" cy="34" r="30" fill="url(#rdl${u})"/><circle cx="214" cy="34" r="11" fill="#DDF7EA"/><circle cx="210" cy="31" r="2.4" fill="#BFE3D3"/>`;
    g += '<path d="M72 46 L72 236 M72 58 C122 66 132 126 116 182 L108 174 L100 190 L90 178 L82 196 L72 184 Z" stroke="#3E5E5A" stroke-width="3" fill="#2A4744" fill-opacity=".45"/>';
    vals.forEach((x, k) => { const c = cols[k], a = rdP(k, 22, 0, n), b = rdP(k, 100, 0, n), h = rdP(k, 22 + 78 * Math.max(0.05, x / 10), 0, n), m = rdP(k, 124, 0, n), on = 0.15 + 0.85 * x / 10;
      g += rdL(a, b, "#9AF5D8", 7, ' opacity=".18"') + rdL(a, b, "#C8FFEC", 1.4, ' opacity=".5"') + rdL(rdP(k, 104, 0, n), m, "#9AF5D8", 9, ' opacity=".2"') + rdL(a, h, c, 9, ' opacity=".25"') + rdL(a, h, c, 3);
      g += rdC(m, 12, "#B8FFE0", ` opacity="${(on * 0.25).toFixed(2)}"`) + `<path d="M${m[0].toFixed(1)} ${(m[1] - 8).toFixed(1)} C${(m[0] + 5).toFixed(1)} ${(m[1] - 2).toFixed(1)} ${(m[0] + 4).toFixed(1)} ${(m[1] + 5).toFixed(1)} ${m[0].toFixed(1)} ${(m[1] + 5).toFixed(1)} C${(m[0] - 4).toFixed(1)} ${(m[1] + 5).toFixed(1)} ${(m[0] - 5).toFixed(1)} ${(m[1] - 2).toFixed(1)} ${m[0].toFixed(1)} ${(m[1] - 8).toFixed(1)} Z" fill="${c}" opacity="${on.toFixed(2)}"/>`; });
    g += '<circle cx="160" cy="160" r="96" fill="none" stroke="#9AF5D8" stroke-width="12" opacity=".16"/><circle cx="160" cy="160" r="96" fill="none" stroke="#C8FFEC" stroke-width="1.6" opacity=".6"/><circle cx="160" cy="160" r="89" fill="none" stroke="#C8FFEC" stroke-width="1" opacity=".25" stroke-dasharray="3 6"/>';
    g += '<circle cx="160" cy="160" r="20" fill="#9AF5D8" opacity=".2"/><circle cx="160" cy="160" r="20" fill="none" stroke="#C8FFEC" stroke-width="1.5" opacity=".7"/><circle cx="160" cy="160" r="5" fill="#E6FFF4"/>';
    for (let i = 0; i < 5; i++) g += `<ellipse cx="${40 + i * 70}" cy="${262 + (i % 2) * 18}" rx="${90 - i * 6}" ry="16" fill="#D8FFF0" opacity=".08"/>`;
    return g;
  },
  instrumento(vals, cols, T, u) {
    const n = vals.length;
    let g = `<defs><linearGradient id="rdo${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7DC8A"/><stop offset=".55" stop-color="#D4A23E"/><stop offset="1" stop-color="#9C7224"/></linearGradient></defs><rect width="320" height="320" fill="#0F2236"/>`;
    for (let i = 0; i <= 320; i += 32) g += `<path d="M${i} 0 V320 M0 ${i} H320" stroke="#1C3A58" stroke-width="1"/>`;
    for (let t = 0; t < 32; t++) g += rdL([160, 160], rdP(t, 230, 0, 32), "#1F4164", 0.8);
    vals.forEach((x, k) => { const c = cols[k], a = rdP(k, 24, 0, n), b = rdP(k, 100, 0, n);
      g += rdL(a, b, `url(#rdo${u})`, 8) + rdL(rdP(k, 104, 0, n), rdP(k, 130, 0, n), `url(#rdo${u})`, 11) + rdC(rdP(k, 132, 0, n), 6, "#F7DC8A", ' stroke="#9C7224" stroke-width="1.5"');
      for (let j = 1; j <= 10; j++) g += rdL(rdP(k, 24 + 7.2 * j, 0.045, n), rdP(k, 24 + 7.2 * j, -0.045, n), "#7A5A1C", j % 5 ? 0.8 : 1.4);
      const r = 24 + 7.2 * Math.max(0.3, x), s = 6.2;
      g += rdL(a, rdP(k, r, 0, n), c, 2.2, ' opacity=".9"') + `<path d="M${rdF(rdP(k, r + s, 0, n))} L${rdF(rdP(k, r, 0.09, n))} L${rdF(rdP(k, r - s, 0, n))} L${rdF(rdP(k, r, -0.09, n))} Z" fill="${c}" stroke="#FFFFFF" stroke-width="1.1"/>`; });
    g += `<circle cx="160" cy="160" r="104" fill="none" stroke="url(#rdo${u})" stroke-width="9"/><circle cx="160" cy="160" r="104" fill="none" stroke="#7A5A1C" stroke-width="1" stroke-dasharray="1 6"/>`;
    return g + `<circle cx="160" cy="160" r="24" fill="url(#rdo${u})"/><circle cx="160" cy="160" r="17" fill="none" stroke="#7A5A1C" stroke-width="1.2"/><circle cx="160" cy="160" r="6" fill="#17C3B2" stroke="#FFFFFF" stroke-width="1.2"/>`;
  },
  constelacion(vals, cols) {
    const n = vals.length; let g = '<rect width="320" height="320" fill="#0C1430"/>';
    RD_FONDO.forEach((s, i) => { g += rdC(s, s[2] * 1.1, "#FFFFFF", ` opacity="${(0.25 + s[2] * 0.4).toFixed(2)}"${i % 5 === 0 ? ' class="rd-titila"' : ""}`); });
    const pts = vals.map((x, k) => rdP(k, Math.max(0.5, x) / 10 * 118 * 0.92 + 8, 0, n));
    g += `<path d="M${pts.map(rdF).join(" L")} Z" fill="#8391FF" fill-opacity=".08" stroke="#C9D2FF" stroke-width="1.2" stroke-opacity=".6"/>`;
    pts.forEach((p, k) => { const x = vals[k], c = cols[k], r = 2.5 + x * 0.55;
      g += rdC(p, r * 2.6, c, ` opacity="${(0.08 + x * 0.025).toFixed(2)}"`) + `<path d="M${(p[0] - r * 1.7).toFixed(1)} ${p[1].toFixed(1)} H${(p[0] + r * 1.7).toFixed(1)} M${p[0].toFixed(1)} ${(p[1] - r * 1.7).toFixed(1)} V${(p[1] + r * 1.7).toFixed(1)}" stroke="#FFFFFF" stroke-width="1" opacity="${(0.3 + x * 0.06).toFixed(2)}"/>` + rdC(p, r, "#FFFFFF") + rdC(p, r * 0.55, c); });
    return g;
  },
  mandala(vals, cols, T) {
    const n = vals.length; let g = "";
    for (let i = 0; i < 48; i++) { const a = Math.PI * 2 * i / 48; g += rdC([160 + 122 * Math.cos(a), 160 + 122 * Math.sin(a)], 2, T.muted, ' opacity=".5"'); }
    for (let k = 0; k < n; k++) for (let j = 2; j <= 5; j++) g += rdC(rdP(k, 118 * j / 5.4, Math.PI / n, n), 1.6, T.muted, ' opacity=".45"');
    vals.forEach((x, k) => { const c = cols[k], nn = Math.round(x);
      for (let j = 1; j <= nn; j++) { const r = 118 * j / 10.5; g += rdC(rdP(k, r, 0, n), 3 + j * 0.9, j % 2 ? c : rdA(c, 0.55));
        if (j % 3 === 0) [-1, 1].forEach(s => { g += rdC(rdP(k, r, s * 0.16, n), 2.2, rdA(c, 0.7)); }); } });
    return g + `<circle cx="160" cy="160" r="9" fill="${T.text}"/><circle cx="160" cy="160" r="4" fill="#F2B53A"/>`;
  },
  vitral(vals, cols) {
    const n = vals.length, d = Math.PI / n;
    let g = '<rect width="320" height="320" fill="#1E1A2E"/><circle cx="160" cy="160" r="132" fill="#2B2540"/>';
    vals.forEach((x, k) => { const a0 = rdAng(k, n) - d, a1 = rdAng(k, n) + d, c = cols[k];
      for (let j = 0; j < 10; j++) { const r0 = 14 + 104 * j / 10, r1 = 14 + 104 * (j + 1) / 10, on = j < Math.round(x);
        g += `<path d="${rdSector(r0, r1, a0, a1)}" fill="${on ? rdA(c, 0.6 + 0.04 * j) : rdA(c, 0.12)}" stroke="#15121F" stroke-width="2.2"/>`; } });
    return g + '<circle cx="160" cy="160" r="14" fill="#F2C24B" stroke="#15121F" stroke-width="2.2"/><circle cx="160" cy="160" r="118" fill="none" stroke="#15121F" stroke-width="3"/><circle cx="160" cy="160" r="127" fill="none" stroke="#3B3354" stroke-width="7"/>';
  },
};
let RD_UID = 0;
function rdEsc(x) { return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const RD_TEMA = { text: "var(--text)", muted: "var(--text-muted)", surface: "var(--surface)", line: "var(--line)" };
/* El SVG de una rueda. vals/ant: por área visible. op: { estilo, cols, etiquetas: [{ corto, v, ant }], sel, mini, id, tema } */
function ruedaSVG(vals, op) {
  op = op || {}; const E = RUEDA_ESTILOS.find(x => x.id === op.estilo) || RUEDA_ESTILOS[0], T = Object.assign({}, RD_TEMA, op.tema || {}), u = "r" + (++RD_UID);
  const n = Math.max(3, vals.length), cols = op.cols || vals.map((_, k) => RUEDA_COLORES[k % 10]);
  return `<svg xmlns="http://www.w3.org/2000/svg"${op.id ? ` id="${op.id}"` : ""} class="rd-svg${op.mini ? " rd-svg--mini" : ""}" viewBox="${op.mini ? "0 0 320 320" : "-86 -48 492 416"}" font-family="Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif" role="img" aria-label="${rdEsc(op.aria || "Rueda de la vida")}" data-estilo="${E.id}"${op.arrastre ? ` data-arrastre="${op.arrastre}"` : ""}>${ruedaInner(vals, Object.assign({}, op, { E, T, u, n, cols }))}</svg>`;
}
function ruedaInner(vals, op) {
  const E = op.E || RUEDA_ESTILOS.find(x => x.id === op.estilo) || RUEDA_ESTILOS[0], T = op.T || Object.assign({}, RD_TEMA, op.tema || {}), u = op.u || "r" + (++RD_UID), n = vals.length, cols = op.cols || vals.map((_, k) => RUEDA_COLORES[k % 10]);
  let g = "";
  if (E.bg) g += `<defs><clipPath id="rdc${u}"><circle cx="160" cy="160" r="160"/></clipPath></defs><g clip-path="url(#rdc${u})">${RUEDA_ARTE[E.id](vals, cols, T, u)}</g>`;
  else g += RUEDA_ARTE[E.id](vals, cols, T, u);
  // la sombra del mes pasado
  if (op.ant && op.ant.some(v => v > 0)) {
    const pts = op.ant.map((v, k) => rdP(k, E.r0 + (E.r10 - E.r0) * Math.max(0.3, v) / 10, 0, n));
    g += `<path d="M${pts.map(rdF).join(" L")} Z" fill="none" stroke="${E.oscuro ? "#FFFFFF" : T.text}" stroke-width="1.6" stroke-dasharray="5 4" opacity=".6"/>`;
  }
  if (!op.mini && op.etiquetas) op.etiquetas.forEach((e, k) => {
    const p = rdP(k, 178, 0, n); let x = p[0], y = p[1]; const anc = Math.abs(x - 160) < 10 ? "middle" : x > 160 ? "start" : "end";
    if (anc !== "middle") x += x > 160 ? -14 : 14;
    const s = k === op.sel, flecha = e.ant != null && e.ant > 0 && e.v !== e.ant ? (e.v > e.ant ? " ↑" : " ↓") : "";
    g += `<g class="rd-eti" data-i="${k}"><text x="${x.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="${anc}" font-size="17" font-weight="${s ? 800 : 700}" fill="${s ? cols[k] : T.text}">${rdEsc(e.corto)}</text>`;
    g += `<text x="${x.toFixed(1)}" y="${(y + 16).toFixed(1)}" text-anchor="${anc}" font-size="15.5" font-weight="700" fill="${T.muted}">${e.v}${flecha}</text></g>`;
  });
  return g;
}
/* Las áreas visibles listas para dibujar */
function ruedaDibujoDatos(S, y, m) {
  S = S || STATE; const vis = ruedaVisibles(S), v = ruedaMes(S, y, m), [ya, ma] = ruedaAntes(y, m), a = ruedaMes(S, ya, ma), hayAnt = ruedaHay(S, a);
  return { vis, vals: vis.map(k => v[k]), ant: hayAnt ? vis.map(k => a[k]) : null, cols: vis.map(k => ruedaColor(S, k)),
    etiquetas: vis.map(k => ({ corto: ruedaCorto(S, k), v: v[k], ant: hayAnt ? a[k] : null })) };
}
/* La muestra de la Tienda y del probador (las notas de este mes, o unas de ejemplo) */
const RUEDA_MUESTRA = [7, 9, 6, 6, 4, 7, 6, 6];
function ruedaMuestraVals() {
  if (typeof STATE === "undefined" || !STATE || !STATE.rueda) return { vals: RUEDA_MUESTRA, cols: RUEDA_COLORES.slice(0, 8) };
  const d = ruedaDibujoDatos(STATE, anioActual(), new Date().getMonth());
  return d.vals.some(v => v > 0) ? d : { vals: RUEDA_MUESTRA, cols: RUEDA_COLORES.slice(0, 8) };
}
function ruedaFichaHtml(it) { const d = ruedaMuestraVals(); return `<span class="rd-ficha-mini">${ruedaSVG(d.vals, { estilo: it.value, cols: d.cols, mini: true, aria: it.nombre })}</span>`; }
function ruedaMuestraHtml(it) { const d = ruedaMuestraVals(); return ruedaSVG(d.vals, { estilo: it.value, cols: d.cols, mini: true, aria: it.nombre }); }
