/* ============================================================
   RUMBO · 📚 La biblioteca: el motor de dibujo (canvas)
   Cada libro que terminas queda de pie en tu biblioteca: el color que le elegiste, el grosor de sus
   páginas, la altura de su formato, una cinta dorada si le pusiste 5 ★, dos puntos si lo leíste con
   un amigo y una tarjetita con el nombre si lo prestaste. Al final, punteados, los huecos que faltan
   para tu meta del año.
   Ocho estilos: la repisa con tu elefante (gratis) y, en la Tienda, la torre, las repisas flotantes,
   la librería de barrio, la pared con escalera, el árbol de libros, la biblioteca antigua y el colegio
   en invierno.

   BIBLIO_MOTOR.montar(cv)            monta un canvas[data-biblio] (se hace solo al aparecer en la página)
                .refrescar()          vuelve a leer los datos y redibuja todo
                .sumar(id)            ese libro llega cayendo a su lugar (y confeti si con él se cumple la meta)
                .dibujarEn(ctx, estilo, datos, w, h)   un dibujo quieto, centrado (la imagen de compartir);
                                      devuelve una promesa que se cumple cuando ya está tu elefante
   El canvas: data-biblio = estilo, data-modo = lecturas (tu biblioteca: los datos salen de bibDatos())
   | visita (la de un amigo: cv._bibDatos()) | muestra (la Tienda: libros de ejemplo) | chica (miniatura quieta).
   Tocar un lomo llama a bibTocarLibro(id, cv) (en lecturas y visita).
   Datos: { libros: [{ id, titulo, autor, color, paginas, formato, estrellas, juntos, prestado, antes }],
            huecos, meta, delAnio, florece, nombre, elefante }
   Anima solo lo que se ve y solo mientras algo se mueve; respeta «reducir movimiento».
   ============================================================ */
const BIBLIO_MOTOR = (() => {
  const IDS = ["repisa", "torre", "flotantes", "libreria", "escalera", "arbol", "antigua", "invierno"];
  if (typeof document === "undefined" || typeof window === "undefined") return { montar() {}, refrescar() {}, sumar() {}, dibujarEn() { return Promise.resolve(); }, ESTILOS: IDS.slice() };

  const QUIETO = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const LECT = ["#17C3B2", "#FF6B4A", "#0E2A47", "#6C63FF", "#F4A63B", "#2E9E7B", "#E5527A", "#3E8BD6"];   // los 8 colores de Lecturas
  const PIX_MAX = 6e6;   // un lienzo muy alto (muchos libros) baja su resolución para no pesar

  /* ---------- utilidades ---------- */
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rgb = h => { h = String(h || "#888888").trim(); if (h.startsWith("rgb")) return (h.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h.slice(0, 6), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const tono = h => { const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 0; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
  function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.fill(); }
  function recortar(g, s, max) { s = String(s); if (max <= 4) return ""; if (g.measureText(s).width <= max) return s; while (s.length > 1 && g.measureText(s + "…").width > max) s = s.slice(0, -1); return s.trim() + "…"; }

  /* ---------- los colores: los del tema de Rumbo y una paleta propia para la madera, el cielo y la calle ---------- */
  const PAL = {
    claro: { oro: "#F4AE3D", oroClaro: "#FFD98A", oroOsc: "#B9761A", verde: "#2F9E74", coral: "#E8606B", indigoInk: "#3949C9", acero: "#8E98AE",
      cielo: "#BFE3FA", cielo2: "#EAF6FD", cerro: "#9ED3A6", cerro2: "#7FC28C", madera: "#9A6A3E", maderaOsc: "#6B4524", haya: "#E2BA83", hayaOsc: "#AE7C47",
      pared: "#E7EAF3", pared2: "#DCE0EC", suelo: "#CDB394", papel: "#F5EDDB", fachada: "#EAD8C2", fachada2: "#D8BFA2", interior: "#FFF2D6", toldo: "#2F9E74", vereda: "#C9CCD6" },
    oscuro: { oro: "#FFBE55", oroClaro: "#FFE1A3", oroOsc: "#C9821F", verde: "#4CC795", coral: "#FF7A85", indigoInk: "#9AA6FF", acero: "#5C6680",
      cielo: "#14204A", cielo2: "#2A3B6E", cerro: "#1E3A3F", cerro2: "#173033", madera: "#8F633B", maderaOsc: "#5E3D20", haya: "#C99F6B", hayaOsc: "#8A5E33",
      pared: "#1A1F3B", pared2: "#151A33", suelo: "#3B2F29", papel: "#DED4BC", fachada: "#3A3247", fachada2: "#2D2739", interior: "#FFD98A", toldo: "#2C8A66", vereda: "#2A2F45" },
  };
  const T = {}, F = { cuerpo: "system-ui, -apple-system, 'Segoe UI', sans-serif", titulo: "system-ui, -apple-system, 'Segoe UI', sans-serif", mano: "Caveat, 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" };
  function leerTema() {
    const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue("--" + k).trim();
    const texto = v("text") || getComputedStyle(document.body || document.documentElement).color || "#161A2E";
    const [r, g, b] = rgb(texto), oscuro = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;   // letra clara: fondo oscuro
    Object.assign(T, PAL[oscuro ? "oscuro" : "claro"], { oscuro, text: texto, textMuted: v("text-muted") || (oscuro ? "#9AA1C0" : "#5A6183"), surface: v("surface") || (oscuro ? "#141932" : "#FFFFFF") });
    if (v("font-body")) F.cuerpo = v("font-body");
    if (v("font-display")) F.titulo = v("font-display");
  }
  leerTema();

  /* ---------- los elefantes (el SVG de la app como imagen) ---------- */
  const ELE_DEMO = "<svg class=\"ele-svg\" viewBox=\"0 0 260 240\" xmlns=\"http://www.w3.org/2000/svg\" role=\"img\" aria-label=\"Elefante Clásico, etapa Adulto, feliz\"> <ellipse cx=\"128\" cy=\"224\" rx=\"88\" ry=\"9\" fill=\"#0E2A47\" opacity=\"0.13\"/> <g transform=\"translate(128 222) scale(1) translate(-128 -222)\"><g class=\"ele-salto\"><g class=\"ele-breathe\"> <g class=\"ele-cola\"><path d=\"M54 142 C40 148 34 162 38 172\" stroke=\"#9FB2C8\" stroke-width=\"5\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"38\" cy=\"174\" r=\"4.5\" fill=\"#7C91AB\"/><\/g><rect x=\"80\" y=\"166\" width=\"26\" height=\"50\" rx=\"12\" fill=\"#7C91AB\"/><rect x=\"138\" y=\"166\" width=\"26\" height=\"50\" rx=\"12\" fill=\"#7C91AB\"/><path d=\"M50 150 C50 104 92 92 126 95 C166 98 186 120 183 156 C181 186 150 196 115 196 C74 196 50 186 50 150 Z\" fill=\"#9FB2C8\"/><path d=\"M70 118 C92 102 130 100 152 108\" stroke=\"#C3D1E0\" stroke-width=\"7\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"/><path d=\"M62 184 C88 194 140 196 172 180\" stroke=\"#7C91AB\" stroke-width=\"8\" fill=\"none\" stroke-linecap=\"round\" opacity=\".45\"/><rect x=\"56\" y=\"168\" width=\"30\" height=\"52\" rx=\"14\" fill=\"#9FB2C8\"/><rect x=\"148\" y=\"168\" width=\"30\" height=\"52\" rx=\"14\" fill=\"#9FB2C8\"/> <g transform=\"translate(168 118) scale(1) translate(-168 -118)\"><g class=\"ele-cab\"><g class=\"ele-ear\"><path d=\"M152 58 C116 56 104 96 114 126 C121 150 152 152 164 132 Z\" fill=\"#7C91AB\"/><path d=\"M148 70 C126 72 120 100 126 120 C131 136 148 138 156 126 Z\" fill=\"#E8B4BF\" opacity=\".85\"/><\/g><circle cx=\"185\" cy=\"95\" r=\"44\" fill=\"#9FB2C8\"/><path d=\"M156 70 C166 58 182 54 196 56\" stroke=\"#C3D1E0\" stroke-width=\"6\" fill=\"none\" stroke-linecap=\"round\" opacity=\".8\"/><path d=\"M212 112 C229 132 233 160 223 179 C217 191 228 200 238 190\" stroke=\"#9FB2C8\" stroke-width=\"20\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M219 140 l11 -3 M222 154 l11 -1 M221 167 l10 2\" stroke=\"#7C91AB\" stroke-width=\"2.2\" stroke-linecap=\"round\" opacity=\".7\"/><path d=\"M204 124 C209 133 218 136 224 133 C217 129 210 124 207 118 Z\" fill=\"#FFF8EC\" /><ellipse cx=\"211\" cy=\"105\" rx=\"7.5\" ry=\"4.5\" fill=\"#FF8FA3\" opacity=\"0.75\"/><g class=\"ele-ojo\"><path d=\"M191 90 Q199 81 207 90\" stroke=\"#1B2436\" stroke-width=\"3.6\" fill=\"none\" stroke-linecap=\"round\"/><\/g><circle cx=\"199\" cy=\"88\" r=\"11.5\" fill=\"rgba(255,255,255,.18)\" stroke=\"#2A2F3A\" stroke-width=\"3\"/><path d=\"M187.5 86 L166 83\" stroke=\"#2A2F3A\" stroke-width=\"3\" stroke-linecap=\"round\"/><g transform=\"rotate(-12 243 200)\"><rect x=\"228\" y=\"190\" width=\"30\" height=\"22\" rx=\"3\" fill=\"#E8563A\"/><rect x=\"231\" y=\"193\" width=\"24\" height=\"16\" rx=\"2\" fill=\"#FFF3EC\"/><path d=\"M243 193 v16\" stroke=\"#E8563A\" stroke-width=\"2\"/><\/g><\/g><\/g> <\/g><\/g><\/g><\/svg>";   // el elefante de la app, con lentes (la Tienda sin sesión)
  const IMGS = new Map();
  function imagenEle(svg) {
    if (!svg) return null;
    let o = IMGS.get(svg);
    if (!o) {
      o = { img: new Image(), listo: false, espera: [] };
      o.img.onload = () => { o.listo = true; o.espera.splice(0).forEach(f => f()); refrescar(); };
      o.img.onerror = () => { o.espera.splice(0).forEach(f => f()); };
      o.img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      if (IMGS.size > 12) IMGS.delete(IMGS.keys().next().value);
      IMGS.set(svg, o);
    }
    return o;
  }
  function elefante(g, svg, x, piso, w, dy) { const o = imagenEle(svg); if (!o || !o.listo) return; const h = w * 240 / 260; g.drawImage(o.img, x, piso - h * .93 + (dy || 0), w, h); }

  /* ---------- los libros: de los datos de la app a lo que se dibuja ---------- */
  function aLibro(x, i) {
    x = x && typeof x === "object" ? x : {};
    const t = String(x.titulo || "Sin título").slice(0, 120), p = +x.paginas > 0 ? Math.min(5000, Math.round(+x.paginas)) : 0;
    const col = /^#[0-9a-f]{6}$/i.test(String(x.color || "")) || /^#[0-9a-f]{3}$/i.test(String(x.color || "")) ? x.color : LECT[hash(t) % 8];
    return { id: String(x.id != null ? x.id : "l" + i), t, a: String(x.autor || "").slice(0, 80), p, pd: p || 280, col, e: Math.max(0, Math.min(5, Math.round(+x.estrellas || 0))),
      fmt: x.formato === "bolsillo" ? "b" : x.formato === "grande" ? "g" : "n", am: !!x.juntos, pr: String(x.prestado || "").trim().slice(0, 24), antes: !!x.antes, h: hash(String(x.id) + t) };
  }
  const grosor = b => Math.max(8, Math.min(28, 6 + b.pd / 32));
  const altoF = (b, base) => base * (b.fmt === "b" ? .74 : b.fmt === "g" ? 1 : .84 + (b.h % 9) / 100);

  /* Los libros de ejemplo (la Tienda y el probador) */
  const EJEMPLO = [
    ["Martín Rivas", "Alberto Blest Gana", 416, 2, 4], ["El principito", "Antoine de Saint-Exupéry", 96, 4, 5, "bolsillo"], ["Desolación", "Gabriela Mistral", 248, 5, 5],
    ["La vuelta al mundo en 80 días", "Julio Verne", 288, 7, 4], ["Subterra", "Baldomero Lillo", 192, 1, 4], ["Orgullo y prejuicio", "Jane Austen", 432, 6, 5, "", 1],
    ["Frankenstein", "Mary Shelley", 280, 3, 3], ["Platero y yo", "Juan Ramón Jiménez", 176, 0, 4, "bolsillo"], ["Hijo de ladrón", "Manuel Rojas", 384, 2, 4, "", 0, "Tomás"],
    ["Moby Dick", "Herman Melville", 640, 7, 4, "grande"], ["Alicia en el país de las maravillas", "Lewis Carroll", 160, 6, 5, "bolsillo"], ["Mujercitas", "Louisa May Alcott", 520, 1, 4],
    ["La Odisea", "Homero", 464, 4, 4], ["Don Quijote de la Mancha", "Miguel de Cervantes", 1056, 3, 5, "grande"], ["Veinte mil leguas de viaje submarino", "Julio Verne", 448, 0, 4],
    ["Cuentos de la selva", "Horacio Quiroga", 128, 5, 4, "bolsillo"], ["Niebla", "Miguel de Unamuno", 272, 2, 3], ["Jane Eyre", "Charlotte Brontë", 560, 6, 5],
  ].map(([titulo, autor, paginas, c, estrellas, formato, juntos, prestado], i) => ({ id: "m" + i, titulo, autor, paginas, color: LECT[c], estrellas, formato: formato || "normal", juntos: !!juntos, prestado: prestado || "" }));
  function datosMuestra(estilo) {
    const n = estilo === "repisa" || estilo === "arbol" ? 9 : 14, libros = EJEMPLO.slice(0, n);
    const own = typeof bibDatos === "function" ? (() => { try { return bibDatos() || {}; } catch (e) { return {}; } })() : {};
    return { libros, meta: 12, delAnio: n, huecos: Math.max(0, 12 - n), florece: n >= 12, nombre: own.nombre || "Coni", elefante: own.elefante || ELE_DEMO };
  }

  /* ---------- piezas de dibujo ---------- */
  function madera(g, x, y, w, h, col) {
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.fillStyle = rgba("#FFFFFF", .22); if (w > h) g.fillRect(x, y, w, 1); else g.fillRect(x, y, 1, h);
    g.fillStyle = rgba("#000000", .18); if (w > h) g.fillRect(x, y + h - 1, w, 1); else g.fillRect(x + w - 1, y, 1, h);
    g.strokeStyle = rgba("#000000", .06); g.lineWidth = .6; g.beginPath();
    if (w > h) { for (let k = 1; k < 3; k++) { const yy = y + h * k / 3; g.moveTo(x + 4, yy); g.bezierCurveTo(x + w * .3, yy - .6, x + w * .6, yy + .6, x + w - 4, yy); } }
    else { for (let k = 1; k < 3; k++) { const xx = x + w * k / 3; g.moveTo(xx, y + 4); g.bezierCurveTo(xx - .6, y + h * .3, xx + .6, y + h * .6, xx, y + h - 4); } }
    g.stroke();
  }
  function pared(g, W, H, piso) {
    const gr = g.createLinearGradient(0, 0, 0, piso); gr.addColorStop(0, T.pared); gr.addColorStop(1, T.pared2); g.fillStyle = gr; g.fillRect(0, 0, W, piso);
    g.fillStyle = T.suelo; g.fillRect(0, piso, W, H - piso);
    g.strokeStyle = rgba("#000000", .1); g.lineWidth = .8; g.beginPath();
    for (let y = piso + 6; y < H; y += 7) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke(); g.fillStyle = rgba("#000000", .12); g.fillRect(0, piso, W, 2);
  }
  /* Un lomo de pie (x, y = arriba) */
  function lomo(g, x, y, w, h, b, o, sel) {
    o = o || {};
    if (b.pr && o.prestamo !== false) return tarjeta(g, x, y, w, h, b);
    let col = b.col; if (o.tinte) col = o.tinte(col);
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, mix(col, "#000000", .26)); gr.addColorStop(.2, col); gr.addColorStop(.62, mix(col, "#FFFFFF", .08)); gr.addColorStop(1, mix(col, "#000000", .3));
    g.fillStyle = gr; rr(g, x, y, w, h, Math.min(2, w * .2)); g.fill();
    const claro = lum(col) > .4, tinta = claro ? "rgba(22,26,46,.8)" : "rgba(255,255,255,.9)";
    if (o.cuero) {
      for (let k = 0; k < 4; k++) { const yy = y + h * (.13 + k * .245); g.fillStyle = mix(col, "#000000", .4); g.fillRect(x + .5, yy, w - 1, 2.4); g.fillStyle = rgba("#FFFFFF", .16); g.fillRect(x + .5, yy, w - 1, .7); }
      g.fillStyle = o.oro; g.fillRect(x + 1, y + h * .055, w - 2, 1); g.fillRect(x + 1, y + h * .95, w - 2, 1);
    } else if (!o.minimal && b.h % 3 !== 0) {
      g.fillStyle = claro ? mix(col, "#000000", .3) : mix(col, "#FFFFFF", .42);
      g.fillRect(x + 1, y + h * .07, w - 2, 1.4); g.fillRect(x + 1, y + h * .9, w - 2, 1.4); if (b.h % 5 === 0) g.fillRect(x + 1, y + h * .12, w - 2, .8);
    }
    if (w >= 9.5 && o.texto !== false) {
      const fs = Math.min(o.fs || 8.5, w * .56), desde = h * (o.cuero ? .2 : .14) + (b.am ? 5 : 0);
      g.save(); g.translate(x + w / 2, y + h - desde); g.rotate(-Math.PI / 2);
      if ("letterSpacing" in g) g.letterSpacing = o.mayus ? ".6px" : "0px";
      g.font = `${o.peso || 700} ${fs}px ${o.fuente || F.cuerpo}`; g.textBaseline = "middle"; g.fillStyle = o.cuero ? o.oro : tinta;
      g.fillText(recortar(g, o.mayus ? b.t.toUpperCase() : b.t, h - desde - h * .12), 0, .5);
      if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.restore();
    }
    if (b.e === 5 && o.cinta !== false) { const cx = x + w * .62; g.fillStyle = o.cintaCol || T.oro; g.beginPath(); g.moveTo(cx - 1.7, y + 3); g.lineTo(cx + 1.7, y + 3); g.lineTo(cx + 1.7, y - 7); g.lineTo(cx, y - 5.2); g.lineTo(cx - 1.7, y - 7); g.closePath(); g.fill(); }
    if (b.am) { const cy = y + h - 5.5, cx = x + w / 2; g.fillStyle = "#FFFFFF"; circ(g, cx - 2.1, cy, 1.9); g.fillStyle = T.oro; circ(g, cx + 2.1, cy, 1.9); }
    if (sel) { g.save(); g.strokeStyle = o.selCol || T.indigoInk; g.lineWidth = 1.4; rr(g, x - 1, y - 1, w + 2, h + 2, 2.5); g.stroke(); g.restore(); }
  }
  /* Prestado: el hueco del libro y la tarjetita con el nombre */
  function tarjeta(g, x, y, w, h, b) {
    g.save(); g.setLineDash([2.5, 2]); g.strokeStyle = rgba(T.text, .32); g.lineWidth = 1; rr(g, x + .5, y + .5, w - 1, h - 1, 1.5); g.stroke(); g.restore();
    g.save(); g.translate(x + w / 2, y + h); g.rotate(-.07);
    const tw = Math.max(8, w - 1), th = h * .66;
    g.fillStyle = mix(T.papel, "#FFFFFF", .3); g.fillRect(-tw / 2, -th, tw, th); g.strokeStyle = rgba("#000000", .15); g.lineWidth = .6; g.strokeRect(-tw / 2, -th, tw, th);
    g.rotate(-Math.PI / 2); g.font = `700 ${Math.min(10, tw * 1.05)}px ${F.mano}`; g.textBaseline = "middle"; g.fillStyle = "#3949C9"; g.fillText(recortar(g, b.pr, th - 4), 3, .5);
    g.restore();
  }
  function huecos(g, hs, etiqueta, col) {
    if (!hs || !hs.length) return;
    col = col || T.indigoInk;
    g.save(); g.setLineDash([3, 2.4]); g.lineWidth = 1.1; g.strokeStyle = rgba(col, .7);
    hs.forEach(h => { rr(g, h.x + .5, h.y + .5, h.w - 1, h.h - 1, 2); g.stroke(); }); g.restore();
    if (etiqueta) { const h0 = hs[0]; g.font = `700 12px ${F.mano}`; g.fillStyle = col; g.textBaseline = "alphabetic"; g.fillText(etiqueta, h0.x, h0.y - 3); }
  }
  /* Repartir los lomos en las tablas, en orden; devuelve dónde va cada uno y hasta dónde llegó */
  const anchoLomo = (b, es, prestamo) => (b.pr && prestamo !== false ? 9 : grosor(b)) * es;
  function fluir(L, est, base, gap, es, sel, orden, prestamo) {
    const idx = orden || L.map((_, i) => i), pos = []; let e = 0, x = est[0].x0, lleno = false;
    for (const i of idx) {
      const b = L[i], w = anchoLomo(b, es, prestamo), h = altoF(b, base);
      if (x + w > est[e].x1) { if (e < est.length - 1) { e++; x = est[e].x0; } else lleno = true; }
      pos[i] = { x, y: est[e].yb - h - (b.id === sel ? 5 : 0), w, h, e }; x += w + gap;
    }
    return { pos, e, x, lleno };
  }
  /* Cuántas tablas hacen falta para los libros y los huecos (de un ancho dado) */
  function filasPara(L, x0, x1, gap, es, nh, prestamo) {
    let filas = 1, x = x0;
    L.forEach(b => { const w = anchoLomo(b, es, prestamo); if (x + w > x1) { filas++; x = x0; } x += w + gap; });
    for (let k = 0; k < nh; k++) { const w = 14 * es; if (x + w > x1) { filas++; x = x0; } x += w + 1.6; }
    return filas;
  }
  function lugaresMeta(r, est, base, n, es) {
    const out = []; let e = r.e || 0, x = r.x != null ? r.x : est[0].x0;
    for (let k = 0; k < n; k++) { const w = 14 * es, h = base * .84; if (x + w > est[e].x1) { if (e >= est.length - 1) break; e++; x = est[e].x0; } out.push({ x, y: est[e].yb - h, w, h }); x += w + 1.6; }
    return out;
  }
  function planta(g, x, y, s) {   // una maceta con hojas (y = base)
    g.fillStyle = T.coral; g.beginPath(); g.moveTo(x - 7 * s, y - 13 * s); g.lineTo(x + 7 * s, y - 13 * s); g.lineTo(x + 5.5 * s, y); g.lineTo(x - 5.5 * s, y); g.closePath(); g.fill();
    g.fillStyle = rgba("#000000", .12); g.fillRect(x - 7 * s, y - 13 * s, 14 * s, 2.5 * s);
    g.fillStyle = T.verde; [[-6, -22, -.6], [0, -27, 0], [6, -22, .6], [-3, -18, -.3], [3, -18, .3]].forEach(([dx, dy, r]) => { g.save(); g.translate(x + dx * s * .5, y - 13 * s); g.rotate(r); g.beginPath(); g.ellipse(0, (dy + 13) * s * .5, 3.2 * s, 7 * s, 0, 0, Math.PI * 2); g.fill(); g.restore(); });
  }
  function portada(g, x, y, w, h, b, sel) {
    const col = b.col, claro = lum(col) > .4;
    g.fillStyle = rgba("#000000", .2); g.fillRect(x + 2, y + 3, w, h);
    g.fillStyle = col; g.fillRect(x, y, w, h); g.fillStyle = mix(col, "#000000", .25); g.fillRect(x, y, 4, h);
    g.fillStyle = claro ? "rgba(22,26,46,.85)" : "rgba(255,255,255,.92)"; g.textBaseline = "top";
    g.font = `800 9.5px ${F.titulo}`;
    const pal = b.t.split(" "), lineas = []; let l = "";
    pal.forEach(p => { const t = l ? l + " " + p : p; if (g.measureText(t).width > w - 10 && l) { lineas.push(l); l = p; } else l = t; }); if (l) lineas.push(l);
    lineas.slice(0, 4).forEach((s, k) => g.fillText(recortar(g, s, w - 10), x + 7, y + 8 + k * 11));
    g.font = `600 7px ${F.cuerpo}`; g.fillText(recortar(g, b.a, w - 10), x + 7, y + h - 13);
    g.fillStyle = claro ? "rgba(22,26,46,.25)" : "rgba(255,255,255,.3)"; g.fillRect(x + 7, y + h - 18, w - 16, .8);
    if (sel) { g.strokeStyle = T.indigoInk; g.lineWidth = 1.4; g.strokeRect(x - 1, y - 1, w + 2, h + 2); }
  }
  function pintarLomos(g, v, L, o, solo) {
    L.forEach((b, i) => {
      if (solo && !solo(i)) return; const it = v.items.get(b.id); if (!it || !it.tg) return;
      g.save(); g.globalAlpha = it.a; lomo(g, it.x, it.y, it.tg.w, it.tg.h, b, o, b.id === v.sel); g.restore();
      v.hits.push({ x: it.x, y: it.y - 6, w: it.tg.w, h: it.tg.h + 6, id: b.id });
    });
  }

  /* ============ Los estilos: layout (dónde va cada libro y el tamaño del dibujo) y draw ============ */
  const E = {};

  /* La repisa (gratis): un mueble de pino con tu elefante al lado; suma repisas cuando se llena */
  E.repisa = {
    caida: 90,
    layout(v, L, nh) {
      const x0 = 36, x1 = 252, es = 1.3, gap = 1.6, base = 58;
      const filas = Math.max(3, filasPara(L, x0, x1, gap, es, nh));
      const est = Array.from({ length: filas }, (_, k) => ({ x0, x1, yb: 104 + 68 * k }));
      const r = fluir(L, est, base, gap, es, v.sel);
      r.huecos = lugaresMeta(r, est, base, nh, es); r.est = est;
      const yl = est[filas - 1].yb; r.yl = yl; r.P = yl + 14; r.W = 360; r.H = r.P + 18;
      return r;
    },
    draw(g, v, L, r, t) {
      const W = r.W, H = r.H, P = r.P, yl = r.yl;
      pared(g, W, H, P);
      g.fillStyle = rgba("#000000", T.oscuro ? .28 : .08); g.fillRect(30, 36, 244, P - 34);
      g.fillStyle = mix(T.hayaOsc, T.pared, .45); g.fillRect(30, 38, 228, yl - 30);
      madera(g, 20, 30, 248, 8, T.haya);
      r.est.forEach(e => madera(g, 30, e.yb, 228, 7, T.haya));
      planta(g, 234, 30, .9);
      pintarLomos(g, v, L, {});
      huecos(g, r.huecos, r.huecos.length ? (r.huecos.length === 1 ? "falta 1" : `faltan ${r.huecos.length}`) : "");
      madera(g, 24, 30, 12, yl - 22, T.haya); madera(g, 252, 30, 12, yl - 22, T.haya); madera(g, 24, yl + 6, 240, 8, T.hayaOsc);
      const dt = t - (v.saltoT || -9), dy = dt < .55 ? -Math.sin(dt / .55 * Math.PI) * 8 : 0;
      elefante(g, v.datos.elefante, 266, P + 2, 92, dy);
      return dt < .55;
    },
  };

  /* La torre: los libros acostados, uno encima del otro; cuando crece, la vista se aleja */
  E.torre = {
    caida: 170, prestamo: false,
    layout(v, L) {
      const P = 260, cx = 200, pos = []; let yb = P;
      L.forEach((b, i) => {
        const th = Math.max(6, Math.min(30, 4 + b.pd / 36)), len = b.fmt === "b" ? 84 : b.fmt === "g" ? 124 : 100 + b.h % 14, j = ((b.h >> 4) % 9 - 4) * 2.2;
        pos[i] = { x: cx - len / 2 + j + (b.id === v.sel ? 12 : 0), y: yb - th, w: len, h: th }; yb -= th;
      });
      return { pos, alto: P - yb, P, cx, W: 320, H: 280 };
    },
    draw(g, v, L, r, t, dt) {
      const P = r.P, cx = r.cx;
      pared(g, r.W, r.H, P);
      elefante(g, v.datos.elefante, 6, P + 2, 100);
      const z = Math.min(1, 226 / Math.max(1, r.alto)); v.z = v.z == null || QUIETO || v.quieto ? z : v.z + (z - v.z) * (1 - Math.exp(-dt * 4));
      v.wob = (v.wob || 0) * Math.exp(-dt * 2.6);
      const ang = QUIETO || v.quieto ? 0 : v.wob * .03 * Math.sin(t * 13);
      g.save(); g.translate(cx, P); g.rotate(ang); g.scale(v.z, v.z); g.translate(-cx, -P);
      g.fillStyle = rgba("#000000", .14); g.beginPath(); g.ellipse(cx + 4, P, 70, 5, 0, 0, Math.PI * 2); g.fill();
      L.forEach(b => {
        const it = v.items.get(b.id); if (!it || !it.tg) return; const p = it.tg;
        g.save(); g.globalAlpha = it.a; acostado(g, it.x, it.y, p.w, p.h, b, b.id === v.sel); g.restore();
        v.hits.push({ x: cx + (it.x - cx) * v.z, y: P + (it.y - P) * v.z, w: (p.w + 6) * v.z, h: Math.max(6, p.h * v.z), id: b.id });
      });
      g.restore();
      const ult = L.length ? v.items.get(L[L.length - 1].id) : null;
      if (ult && ult.nuevo && ult.tg && Math.abs(ult.y - ult.tg.y) < .8) { ult.nuevo = false; v.wob = 1; }
      return Math.abs(v.z - z) > .002 || v.wob > .02;
    },
  };
  function acostado(g, x, y, w, h, b, sel) {
    const col = b.col, dd = 5;
    g.fillStyle = mix(col, "#FFFFFF", .16); g.beginPath(); g.moveTo(x, y); g.lineTo(x + dd, y - dd * .6); g.lineTo(x + w + dd, y - dd * .6); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.fillStyle = T.papel; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + dd, y - dd * .6); g.lineTo(x + w + dd, y + h - dd * .6); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    if (h > 3) { g.strokeStyle = rgba("#000000", .12); g.lineWidth = .5; g.beginPath(); for (let k = 1; k < h / 2.2; k++) { const yy = y + k * 2.2; g.moveTo(x + w + .5, yy); g.lineTo(x + w + dd - .5, yy - dd * .6); } g.stroke(); }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, mix(col, "#FFFFFF", .1)); gr.addColorStop(1, mix(col, "#000000", .25));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (h >= 7.5) { const claro = lum(col) > .4; g.font = `700 ${Math.min(9.5, h * .62)}px ${F.cuerpo}`; g.textBaseline = "middle"; g.textAlign = "center"; g.fillStyle = claro ? "rgba(22,26,46,.8)" : "rgba(255,255,255,.9)"; g.fillText(recortar(g, b.t, w - 12), x + w / 2, y + h / 2 + .5); g.textAlign = "left"; }
    if (b.e === 5) { g.fillStyle = T.oro; g.fillRect(x + w + 1.5, y + h - 1, 2.6, 7); }
    if (b.am) { g.fillStyle = "#FFFFFF"; circ(g, x + 6, y + h / 2, 1.7); g.fillStyle = T.oro; circ(g, x + 10, y + h / 2, 1.7); }
    if (sel) { g.strokeStyle = T.indigoInk; g.lineWidth = 1.4; g.strokeRect(x - 1, y - 1, w + 2, h + 2); }
  }

  /* Las repisas flotantes: tablas sin soportes en una pared clara, una a la izquierda y otra a la derecha */
  E.flotantes = {
    caida: 80,
    layout(v, L, nh) {
      const es = 1.15, gap = 1.4, base = 62, ancho = 174;
      let orden = null;
      if (v.modo === "muestra" || v.modo === "chica") orden = L.map((_, i) => i).sort((a, b) => (tono(L[a].col) - tono(L[b].col)) || (L[a].h % 97) - (L[b].h % 97));
      const Ls = orden ? orden.map(i => L[i]) : L;
      // pocas: una tabla corta por fila, a la izquierda y a la derecha; muchas: tablas largas de lado a lado
      let filas = Math.max(3, filasPara(Ls, 30, 30 + ancho, gap, es, nh)), est;
      if (filas <= 6) est = Array.from({ length: filas }, (_, k) => { const x0 = k % 2 ? 134 : 30; return { x0, x1: x0 + ancho, yb: 82 + 80 * k }; });
      else {
        const largas = n => Array.from({ length: n }, (_, k) => ({ x0: 30, x1: k ? 308 : 226, yb: 82 + 80 * k, larga: true }));   // la primera deja lugar al cuadro
        const cabe = n => { const e = largas(n), q = fluir(L, e, base, gap, es, v.sel, orden); return !q.lleno && lugaresMeta(q, e, base, nh, es).length >= nh; };
        filas = Math.max(3, filasPara(Ls, 30, 308, gap, es, nh)); while (filas > 3 && cabe(filas - 1)) filas--; while (!cabe(filas) && filas < 600) filas++;
        est = largas(filas);
      }
      const r = fluir(L, est, base, gap, es, v.sel, orden);
      r.huecos = lugaresMeta(r, est, base, nh, es); r.est = est; r.W = 340; r.H = est[filas - 1].yb + 20;
      return r;
    },
    draw(g, v, L, r) {
      const W = r.W, H = r.H;
      g.fillStyle = mix(T.pared, T.surface, .55); g.fillRect(0, 0, W, H);
      // un cuadro arriba a la derecha
      g.save(); g.strokeStyle = rgba(T.text, .35); g.lineWidth = 1.2; g.fillStyle = T.surface; g.fillRect(238, 18, 70, 52); g.strokeRect(238, 18, 70, 52);
      g.fillStyle = mix(T.cielo, T.surface, .3); g.fillRect(245, 25, 56, 38); g.fillStyle = T.coral; circ(g, 288, 36, 5);
      g.fillStyle = mix(T.verde, T.surface, .25); g.beginPath(); g.moveTo(245, 63); g.lineTo(262, 42); g.lineTo(276, 56); g.lineTo(285, 47); g.lineTo(301, 63); g.closePath(); g.fill(); g.restore();
      const tin = T.oscuro ? c => mix(c, "#2A3050", .22) : c => mix(c, "#FFFFFF", .34);
      // la planta va en la última tabla de la izquierda, que es un poco más larga
      const largas = !!r.est[0].larga, kPlanta = largas ? 0 : r.est.length - 1 - ((r.est.length - 1) % 2);
      r.est.forEach((e, k) => {
        const x1 = k === kPlanta && !largas ? e.x1 + 26 : e.x1 + 6;
        const sg = g.createLinearGradient(0, e.yb + 4, 0, e.yb + 13); sg.addColorStop(0, rgba("#000000", T.oscuro ? .35 : .13)); sg.addColorStop(1, rgba("#000000", 0)); g.fillStyle = sg; g.fillRect(e.x0 - 4, e.yb + 4, x1 - e.x0 + 8, 9);
        g.fillStyle = T.oscuro ? mix(T.surface, "#FFFFFF", .1) : "#FFFFFF"; g.fillRect(e.x0 - 6, e.yb, x1 - e.x0 + 6, 4); g.fillStyle = rgba("#000000", .1); g.fillRect(e.x0 - 6, e.yb + 3, x1 - e.x0 + 6, 1);
      });
      if (!largas) planta(g, r.est[kPlanta].x1 + 18, r.est[kPlanta].yb, .8);
      pintarLomos(g, v, L, { tinte: tin, minimal: true, mayus: true, fs: 7, peso: 700 });
      huecos(g, r.huecos, "");
      // los sujetalibros: al final de cada tabla con libros
      const fin = r.est.map(() => 0); L.forEach(b => { const it = v.items.get(b.id); if (it && it.tg) fin[it.tg.e] = Math.max(fin[it.tg.e], it.x + it.tg.w); });
      fin.forEach((x, k) => { if (!x) return; const yb = r.est[k].yb; g.fillStyle = T.acero; g.fillRect(x + 1.5, yb - 30, 2.6, 30); g.fillRect(x + 1.5, yb - 2, 12, 2); });
    },
  };

  /* La librería de barrio: fachada con tu nombre, vitrina con el último libro y tu elefante en la puerta */
  E.libreria = {
    caida: 70,
    layout(v, L) {
      const est = [{ x0: 110, x1: 238, yb: 158 }, { x0: 110, x1: 238, yb: 222 }];
      const n = L.length, resto = L.map((_, i) => i).slice(0, Math.max(0, n - 1));
      let r = { pos: [] };
      // adentro caben los más nuevos: se dejan afuera los más viejos hasta que entren
      let lo = 0, hi = resto.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (fluir(L, est, 50, 1.2, 1, v.sel, resto.slice(m)).lleno) lo = m + 1; else hi = m; }
      if (resto.length) r = fluir(L, est, 50, 1.2, 1, v.sel, resto.slice(lo));
      if (n) r.pos[n - 1] = { x: 34, y: 124 - (L[n - 1].id === v.sel ? 3 : 0), w: 58, h: 80, cara: true };
      r.W = 360; r.H = 272;
      return r;
    },
    draw(g, v, L, r) {
      const W = r.W, H = r.H, noche = T.oscuro;
      g.fillStyle = T.fachada; g.fillRect(0, 0, W, H); g.fillStyle = T.fachada2; g.fillRect(0, 0, W, 8);
      for (let y = 14; y < 250; y += 12) { g.fillStyle = rgba("#000000", .035); g.fillRect(0, y, W, 1); }
      madera(g, 64, 14, 232, 30, T.maderaOsc);
      const nom = String(v.datos.nombre || "").trim();
      g.font = `800 15px ${F.titulo}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = T.oroClaro;
      g.fillText(recortar(g, nom ? `Librería de ${nom}` : "La librería", 216), 180, 30); g.textAlign = "left";
      for (let k = 0, x = 8; x < W - 8; x += 19, k++) { g.fillStyle = k % 2 ? T.toldo : mix(T.papel, "#FFFFFF", .3); g.fillRect(x, 52, 19, 22); g.beginPath(); g.arc(x + 9.5, 74, 9.5, 0, Math.PI); g.fill(); }
      g.fillStyle = rgba("#000000", .16); g.fillRect(8, 52, W - 16, 3);
      if (noche) { const gl = g.createRadialGradient(133, 160, 20, 133, 160, 170); gl.addColorStop(0, rgba(T.oroClaro, .35)); gl.addColorStop(1, rgba(T.oroClaro, 0)); g.fillStyle = gl; g.fillRect(0, 60, W, H - 60); }
      madera(g, 20, 90, 226, 144, T.maderaOsc);
      const ig = g.createLinearGradient(0, 96, 0, 228); ig.addColorStop(0, T.interior); ig.addColorStop(1, mix(T.interior, T.hayaOsc, .35)); g.fillStyle = ig; g.fillRect(26, 96, 214, 132);
      [158, 222].forEach(yb => madera(g, 106, yb, 134, 5, T.hayaOsc));
      madera(g, 100, 96, 6, 130, T.maderaOsc);
      madera(g, 28, 206, 70, 20, T.madera);
      const n = L.length;
      pintarLomos(g, v, L, {}, i => i < n - 1);
      if (n) {
        const b = L[n - 1], it = v.items.get(b.id);
        if (it && it.tg) {
          const p = it.tg; g.save(); g.globalAlpha = it.a; portada(g, it.x, it.y, p.w, p.h, b, b.id === v.sel); g.restore(); v.hits.push({ x: it.x, y: it.y, w: p.w, h: p.h, id: b.id });
          g.save(); g.translate(70, 205); g.rotate(-.08); g.fillStyle = "#FFFFFF"; g.fillRect(0, -18, 28, 18); g.font = `700 10px ${F.mano}`; g.fillStyle = "#B23A47"; g.textBaseline = "middle"; g.fillText("recién", 3, -12.5); g.fillText("leído", 4.5, -5); g.restore();
        }
      }
      g.save(); g.globalAlpha = noche ? .08 : .2; g.strokeStyle = "#FFFFFF"; g.lineWidth = 6; g.beginPath(); g.moveTo(60, 228); g.lineTo(150, 96); g.moveTo(90, 228); g.lineTo(170, 110); g.stroke(); g.restore();
      madera(g, 254, 90, 84, 162, T.maderaOsc); madera(g, 260, 96, 72, 156, T.madera);
      g.fillStyle = noche ? T.interior : mix(T.interior, T.cielo, .3); g.fillRect(268, 104, 56, 60);
      g.fillStyle = "#FFFFFF"; g.fillRect(274, 124, 44, 15); g.strokeStyle = rgba("#000000", .3); g.lineWidth = .6; g.beginPath(); g.moveTo(281, 124); g.lineTo(296, 112); g.lineTo(311, 124); g.stroke();
      g.font = `800 7.5px ${F.cuerpo}`; g.textAlign = "center"; g.fillStyle = "#1D7553"; g.fillText("ABIERTO", 296, 132); g.textAlign = "left";
      g.fillStyle = T.oro; circ(g, 268, 190, 2.4);
      g.fillStyle = T.vereda; g.fillRect(0, 252, W, H - 252); g.fillStyle = rgba("#000000", .14); g.fillRect(0, 252, W, 2);
      elefante(g, v.datos.elefante, 252, 262, 82);
    },
  };

  /* La pared con escalera: tres cuerpos de repisas (de cuatro para arriba) y la escalera corrediza en su riel */
  E.escalera = {
    caida: 80,
    layout(v, L, nh) {
      const bays = [[24, 121], [129, 231], [239, 336]], es = .9, gap = 1.2, base = 41;
      // cuántas filas (tres cuerpos por fila, de cuatro para arriba): las justas para los libros y los huecos
      const armar = f => { const rows = Array.from({ length: f }, (_, k) => 88 + 51 * k), est = []; rows.forEach(yb => bays.forEach(([a, b]) => est.push({ x0: a + 3, x1: b - 3, yb }))); return { rows, est }; };
      const cabe = f => { const A = armar(f), q = fluir(L, A.est, base, gap, es, v.sel); return !q.lleno && lugaresMeta(q, A.est, base, nh, es).length >= nh; };
      let f = Math.max(4, Math.ceil(filasPara(L, 0, 91, gap, es, nh) / 3));
      while (f > 4 && cabe(f - 1)) f--;
      while (!cabe(f) && f < 400) f++;
      const { rows, est } = armar(f), r = fluir(L, est, base, gap, es, v.sel);
      r.huecos = lugaresMeta(r, est, base, nh, es); r.bays = bays; r.rows = rows;
      r.P = rows[rows.length - 1] + 15; r.W = 360; r.H = r.P + 16;
      return r;
    },
    draw(g, v, L, r, t, dt) {
      const W = r.W, H = r.H, P = r.P, ultRow = r.rows[r.rows.length - 1];
      pared(g, W, H, P);
      g.fillStyle = mix(T.oroOsc, "#000000", .1); g.fillRect(10, 26, W - 20, 3);
      madera(g, 14, 34, 332, P - 34, T.maderaOsc);
      g.fillStyle = mix(T.maderaOsc, "#000000", .35); r.bays.forEach(([a, b]) => g.fillRect(a, 42, b - a, ultRow - 37));
      r.rows.forEach(yb => r.bays.forEach(([a, b]) => madera(g, a, yb, b - a, 5, T.madera)));
      pintarLomos(g, v, L, { fs: 7 });
      huecos(g, r.huecos, "");
      // la escalera corre hasta el último libro
      const ultB = L.length ? v.items.get(L[L.length - 1].id) : null, ult = ultB && ultB.tg;
      const meta = ult ? Math.max(18, Math.min(W - 64, ult.x - 14)) : 40;
      v.lx = v.lx == null || QUIETO || v.quieto ? meta : v.lx + (meta - v.lx) * (1 - Math.exp(-dt * 3));
      const lx = v.lx, pasos = Math.max(11, Math.round((P - 24) / 21));
      g.strokeStyle = mix(T.madera, "#000000", .15); g.lineWidth = 3.2; g.lineCap = "round";
      g.beginPath(); g.moveTo(lx, 30); g.lineTo(lx + 12, P + 6); g.moveTo(lx + 26, 30); g.lineTo(lx + 38, P + 6); g.stroke();
      g.lineWidth = 2.2; g.beginPath(); for (let k = 1; k < pasos; k++) { const f = k / pasos, y = 30 + (P + 6 - 30) * f; g.moveTo(lx + 12 * f, y); g.lineTo(lx + 26 + 12 * f, y); } g.stroke();
      g.fillStyle = T.oroOsc; circ(g, lx, 28, 2.6); circ(g, lx + 26, 28, 2.6); g.fillStyle = T.acero; circ(g, lx + 12, P + 7, 2.6); circ(g, lx + 38, P + 7, 2.6); g.lineCap = "butt";
      return Math.abs(v.lx - meta) > .5;
    },
  };

  /* La biblioteca antigua: cuero, letras doradas, el globo que gira y la lámpara verde */
  const CONT = [[0, .5, .34, .24], [.9, .25, .22, .3], [1.6, -.2, .26, .32], [2.6, .45, .4, .22], [3.4, -.45, .2, .18], [4.3, .1, .3, .36], [5.2, .6, .24, .16]];
  const POLVO = Array.from({ length: 18 }, (_, k) => ({ x: 248 + (hash("p" + k) % 100), y: 70 + (hash("q" + k) % 170), s: .6 + (hash("s" + k) % 9) / 10, f: (hash("f" + k) % 628) / 100 }));
  E.antigua = {
    caida: 90, ambiente: true,
    layout(v, L, nh) {
      const x0 = 30, x1 = 226, es = 1.15, gap = 1.3, base = 60;
      const filas = Math.max(3, filasPara(L, x0, x1, gap, es, nh));
      const est = Array.from({ length: filas }, (_, k) => ({ x0, x1, yb: 92 + 74 * k }));
      const r = fluir(L, est, base, gap, es, v.sel);
      r.huecos = lugaresMeta(r, est, base, nh, es); r.est = est; r.W = 360; r.H = est[filas - 1].yb + 32;
      return r;
    },
    draw(g, v, L, r, t) {
      const W = r.W, H = r.H, ORO = "#D8B25E", piso = H - 20;
      g.fillStyle = "#2A1A10"; g.fillRect(0, 0, W, H);
      for (let x = 240; x < W; x += 40) { g.fillStyle = "#33200F"; g.fillRect(x + 4, 12, 32, piso - 16); g.fillStyle = "#1E120A"; g.fillRect(x + 4, 12, 32, 1.5); g.fillRect(x + 4, 12, 1.5, piso - 16); }
      g.fillStyle = "#1A0F08"; g.fillRect(0, piso, W, H - piso); g.fillStyle = "#6B2626"; g.fillRect(0, piso + 6, W, H - piso - 6);
      g.fillStyle = rgba(ORO, .3); for (let x = 6; x < W; x += 12) circ(g, x, piso + 13, 1.2);
      madera(g, 16, 14, 222, piso - 14, "#4A2A14"); g.fillStyle = "#1C110A"; g.fillRect(26, 24, 202, piso - 34);
      r.est.forEach(e => madera(g, 26, e.yb, 202, 6, "#5A3519"));
      pintarLomos(g, v, L, { tinte: c => mix(c, "#3A2212", .5), cuero: true, oro: ORO, cintaCol: "#C8312E", fuente: F.titulo, peso: 600, fs: 8 });
      g.save(); g.globalAlpha = .7; huecos(g, r.huecos, ""); g.restore();
      // el globo en su pie, sobre el piso
      const cx = 300, cy = piso - 102, R = 30, fi = QUIETO || v.quieto ? .6 : t * .25;
      g.strokeStyle = "#5A3519"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy + R + 4); g.lineTo(cx, piso - 14); g.moveTo(cx - 20, piso - 2); g.lineTo(cx, piso - 14); g.lineTo(cx + 20, piso - 2); g.stroke();
      g.save(); g.translate(cx, cy); g.rotate(.4);
      const oc = g.createRadialGradient(-R * .35, -R * .35, 3, 0, 0, R); oc.addColorStop(0, "#5C8F8A"); oc.addColorStop(1, "#22403F"); g.fillStyle = oc; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
      CONT.forEach(([lon, lat, rx, ry]) => { const a = lon + fi, c = Math.cos(a); if (c < -.15) return; const x = R * Math.sin(a) * Math.cos(lat), y = -R * Math.sin(lat); g.fillStyle = rgba("#C9B27C", Math.min(1, .35 + c)); g.beginPath(); g.ellipse(x, y, Math.max(.5, R * rx * Math.max(.05, c)), R * ry, 0, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = rgba("#FFFFFF", .12); g.lineWidth = .7; for (let k = 0; k < 4; k++) { const a = fi + k * Math.PI / 4, s = Math.sin(a); g.beginPath(); g.ellipse(0, 0, Math.abs(R * s), R, 0, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.ellipse(0, 0, R, R * .18, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
      g.strokeStyle = "#B08A3E"; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, R + 4, -Math.PI * .55, Math.PI * .55); g.stroke();
      g.restore();
      // la lámpara verde y su luz con polvo
      const lx = 300;
      g.strokeStyle = "#B08A3E"; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 22); g.lineTo(lx, 40); g.stroke();
      g.fillStyle = "#2E6B4E"; g.beginPath(); g.moveTo(lx - 22, 58); g.quadraticCurveTo(lx, 30, lx + 22, 58); g.closePath(); g.fill();
      g.fillStyle = rgba("#FFFFFF", .2); g.beginPath(); g.ellipse(lx - 7, 47, 6, 2.5, -.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFE7B0"; g.beginPath(); g.ellipse(lx, 58, 12, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.globalCompositeOperation = "lighter";
      const cono = g.createRadialGradient(lx, 60, 6, lx, 120, 170); cono.addColorStop(0, "rgba(255,206,130,.32)"); cono.addColorStop(1, "rgba(255,206,130,0)"); g.fillStyle = cono; g.fillRect(120, 40, W - 120, 220);
      const tt = QUIETO || v.quieto ? 0 : t;
      POLVO.forEach(p => { const y = 70 + ((p.y - 70 - tt * 4 * p.s) % 170 + 170) % 170, x = p.x + Math.sin(tt * .4 + p.f) * 6; const a = (.25 + .3 * Math.sin(tt * 1.6 + p.f)) * Math.max(0, 1 - Math.hypot(x - lx, y - 70) / 190); g.fillStyle = `rgba(255,226,170,${a.toFixed(3)})`; circ(g, x, y, p.s); });
      g.restore();
      const vi = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .85); vi.addColorStop(0, "rgba(0,0,0,0)"); vi.addColorStop(1, "rgba(0,0,0,.35)"); g.fillStyle = vi; g.fillRect(0, 0, W, H);
      return true;
    },
  };

  /* El árbol de libros: cada libro brota en una rama como un libro abierto; con muchos, el árbol suma ramas */
  const ARBOLES = {};
  function arbol(nivel) {
    if (ARBOLES[nivel]) return ARBOLES[nivel];
    let s = 11 + nivel * 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const segs = [], hojas = [];
    const prof = 4 + nivel, f = Math.pow(.84, nivel);
    function rama(x, y, ang, len, w, n) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len; segs.push({ x, y, x2, y2, w });
      if (n >= prof) { for (let k = 0; k < 3; k++) { const q = .35 + k * .3; hojas.push({ x: x + (x2 - x) * q + (rnd() - .5) * 12 * f, y: y + (y2 - y) * q + (rnd() - .5) * 10 * f, r: ang + (rnd() - .5) * 1.4 }); } return; }
      const m = n < 1 ? 3 : 2 + (rnd() < .4 ? 1 : 0);
      for (let k = 0; k < m; k++) rama(x2, y2, ang + (k - (m - 1) / 2) * (.62 + rnd() * .22) * (n >= 4 ? .8 : 1) + (rnd() - .5) * .25, len * (.7 + rnd() * .1) * (n >= 3 ? .92 : 1), w * .66, n + 1);
    }
    rama(150, 252, -Math.PI / 2, 62 * (nivel ? .95 : 1), 15, 0);
    // que todo quepa en el cuadro: si se sale por arriba o por los lados, se achica desde la base
    let minY = 252, minX = 150, maxX = 150; segs.forEach(sg => { minY = Math.min(minY, sg.y2); minX = Math.min(minX, sg.x2); maxX = Math.max(maxX, sg.x2); });
    const k = Math.min(1, (252 - 14) / (252 - minY), 136 / Math.max(1, 150 - minX), 176 / Math.max(1, maxX - 150));
    const esc = p => ({ x: 150 + (p.x - 150) * k, y: 252 + (p.y - 252) * k });
    segs.forEach(sg => { const a = esc({ x: sg.x, y: sg.y }), b = esc({ x: sg.x2, y: sg.y2 }); Object.assign(sg, { x: a.x, y: a.y, x2: b.x, y2: b.y, w: Math.max(.8, sg.w * Math.sqrt(k)) }); });
    hojas.forEach(h => Object.assign(h, esc(h)));
    // repartidas: cada hoja nueva va lo más lejos posible de las que ya están
    const orden = [], quedan = hojas.slice(); let ini = 0, mejor = 1e9;
    quedan.forEach((h, j) => { const dd = Math.hypot(h.x - 150, h.y - 96); if (dd < mejor) { mejor = dd; ini = j; } });
    orden.push(quedan.splice(ini, 1)[0]);
    const dmin = quedan.map(h => Math.hypot(orden[0].x - h.x, orden[0].y - h.y));
    while (quedan.length) {
      let jj = 0, dm = -1; for (let j = 0; j < quedan.length; j++) if (dmin[j] > dm) { dm = dmin[j]; jj = j; }
      const h = quedan.splice(jj, 1)[0]; dmin.splice(jj, 1); orden.push(h);
      for (let j = 0; j < quedan.length; j++) dmin[j] = Math.min(dmin[j], Math.hypot(h.x - quedan[j].x, h.y - quedan[j].y));
    }
    return (ARBOLES[nivel] = { segs, hojas: orden, todas: hojas.slice(), esc: Math.max(.45, Math.pow(k, .7) * Math.pow(.86, nivel)) });
  }
  E.arbol = {
    caida: 0, crece: true, ambiente: true, prestamo: false,
    layout(v, L) {
      let nivel = 0; while (nivel < 3 && arbol(nivel).hojas.length < L.length + 16) nivel++;
      const A = arbol(nivel), pos = L.map((b, i) => { const h = A.hojas[i % A.hojas.length]; return { x: h.x, y: h.y - (b.id === v.sel ? 3 : 0), w: 0, h: 0, r: h.r }; });
      return { pos, A, W: 340, H: 272 };
    },
    draw(g, v, L, r, t, dt) {
      const W = r.W, H = r.H, A = r.A, quieto = QUIETO || v.quieto;
      const cie = g.createLinearGradient(0, 0, 0, 240); cie.addColorStop(0, T.cielo); cie.addColorStop(1, T.cielo2); g.fillStyle = cie; g.fillRect(0, 0, W, H);
      if (T.oscuro) { g.fillStyle = "rgba(255,255,255,.7)"; for (let k = 0; k < 24; k++) circ(g, hash("e" + k) % W, hash("y" + k) % 150, (hash("r" + k) % 10) / 10 + .3); }
      g.fillStyle = T.cerro2; g.beginPath(); g.ellipse(170, 292, 260, 52, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.cerro; g.beginPath(); g.ellipse(120, 300, 220, 52, 0, 0, Math.PI * 2); g.fill();
      const copa = T.oscuro ? mix(T.verde, "#14204A", .55) : T.verde, rc = 15 * Math.max(.55, A.esc);
      g.fillStyle = rgba(copa, T.oscuro ? .45 : .2); A.todas.forEach(h => circ(g, h.x, h.y, rc));
      g.fillStyle = rgba(copa, T.oscuro ? .3 : .14); A.todas.forEach((h, k) => { if (k % 2) circ(g, h.x + 6 * A.esc, h.y - 5 * A.esc, rc * .73); });
      g.strokeStyle = T.madera; g.lineCap = "round";
      A.segs.forEach(sg => { g.lineWidth = sg.w; g.beginPath(); g.moveTo(sg.x, sg.y); g.lineTo(sg.x2, sg.y2); g.stroke(); });
      g.lineCap = "butt";
      const flor = v.datos.florece ? 1 : 0;
      v.flor = v.flor == null || quieto ? flor : v.flor + (flor - v.flor) * (1 - Math.exp(-dt * 2));
      if (v.flor > .01) A.hojas.slice(L.length, L.length + 16).forEach((h, k) => { const s = v.flor * (.8 + (k % 3) * .15) * Math.max(.6, A.esc); g.fillStyle = k % 2 ? T.coral : "#FFFFFF"; for (let p = 0; p < 5; p++) { const a = p * Math.PI * 2 / 5 + k; circ(g, h.x + Math.cos(a) * 2.6 * s, h.y + Math.sin(a) * 2.6 * s, 1.9 * s); } g.fillStyle = T.oro; circ(g, h.x, h.y, 1.3 * s); });
      const tam = 1.45 * A.esc;
      L.forEach((b, i) => {
        const it = v.items.get(b.id); if (!it || !it.tg) return; const p = it.tg, sw = quieto ? 0 : Math.sin(t * 1.3 + i * .9) * .12;
        g.save(); g.globalAlpha = it.a; g.translate(it.x, it.y); g.rotate(p.r + Math.PI / 2 + sw); g.scale(it.s * tam, it.s * tam); hojaLibro(g, b.col, b.id === v.sel, b.e === 5); g.restore();
        v.hits.push({ x: it.x - 20 * A.esc, y: it.y - 17 * A.esc, w: 40 * A.esc, h: 34 * A.esc, id: b.id });
      });
      elefante(g, v.datos.elefante, 214, 258, 88);
      return true;
    },
  };
  function hojaLibro(g, col, sel, fav) {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 3); g.quadraticCurveTo(-6, 0, -11, 2); g.lineTo(-11, -5); g.quadraticCurveTo(-6, -7.5, 0, -4); g.quadraticCurveTo(6, -7.5, 11, -5); g.lineTo(11, 2); g.quadraticCurveTo(6, 0, 0, 3); g.closePath(); g.fill();
    g.fillStyle = mix(T.papel, "#FFFFFF", .4); g.beginPath(); g.moveTo(0, 1.4); g.quadraticCurveTo(-5.5, -1.4, -9.6, .4); g.lineTo(-9.6, -4.3); g.quadraticCurveTo(-5.5, -6, 0, -3); g.quadraticCurveTo(5.5, -6, 9.6, -4.3); g.lineTo(9.6, .4); g.quadraticCurveTo(5.5, -1.4, 0, 1.4); g.closePath(); g.fill();
    g.strokeStyle = rgba(col, .8); g.lineWidth = .7; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 1.4); g.stroke();
    if (fav) { g.fillStyle = T.oro; g.fillRect(-.9, 1.5, 1.8, 5); }
    if (sel) { g.strokeStyle = T.indigoInk; g.lineWidth = 1.3; g.beginPath(); g.ellipse(0, -1.5, 13.5, 8, 0, 0, Math.PI * 2); g.stroke(); }
  }

  /* El colegio en invierno: la biblioteca de un castillo con nieve en la ventana y en los techos de afuera, una chimenea
     encendida y búhos con bufanda. Cada libro nuevo lo trae un búho entre copos de nieve; tus libros de antes llevan su
     cadena. En tu meta del año se prenden las luces de colores de la guirnalda y el pino de afuera, con su estrella */
  E.invierno = (() => {
    const DUR = 1.6, V = { x0: 232, x1: 336, ys: 100, sill: 170 }, PINO = 312;
    const suave = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const azar = (i, k) => (hash(i + ":" + k) % 1000) / 1000;
    const bez = (a, c, b, u) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y });
    /* Los brillos y el muro se dibujan una vez y después se copian: en el teléfono cuesta mucho menos */
    const GLOW = new Map(), TEJAS = new Map();
    function brillo(g, x, y, r, col, a) {
      if (!(r > 0) || !(a > 0)) return;
      let s = GLOW.get(col);
      if (!s) { s = document.createElement("canvas"); s.width = s.height = 64; const c = s.getContext("2d"), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(1, rgba(col, 0)); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); GLOW.set(col, s); }
      const ga = g.globalAlpha; g.globalAlpha = ga * Math.min(1, a); g.drawImage(s, x - r, y - r, r * 2, r * 2); g.globalAlpha = ga;
    }
    function muro(g, W, H, noche) {
      const m = g.getTransform ? g.getTransform() : { a: 1, b: 0 }, sc = Math.max(.5, Math.min(4, Math.hypot(m.a, m.b) || 1)), key = (noche ? "n" : "d") + sc.toFixed(2);
      g.fillStyle = noche ? "#17152A" : "#7F7790"; g.fillRect(0, 0, W, H);
      let pat = TEJAS.get(key);
      if (pat === undefined) {
        pat = null;
        try {
          const tw = 200, th = 80, cv = document.createElement("canvas"); cv.width = Math.round(tw * sc); cv.height = Math.round(th * sc);
          const c = cv.getContext("2d"); c.scale(cv.width / tw, cv.height / th); c.fillStyle = noche ? "#17152A" : "#7F7790"; c.fillRect(0, 0, tw, th);
          const c1 = noche ? "#232039" : "#9E96AA", c2 = noche ? "#2C2845" : "#B1A9BC";
          for (let fila = 0; fila < 4; fila++) for (let k = -1; k < 5; k++) { const q = ((k % 4) + 4) % 4, w = 44 + azar(fila * 31 + q, "w") * 10, x = k * 50 + (fila % 2) * 25, y = fila * 20; c.fillStyle = mix(c1, c2, azar(fila, "c" + q)); rr(c, x + 1, y + 1, w - 2, 18, 2.5); c.fill(); }
          pat = g.createPattern(cv, "repeat");
          if (pat && pat.setTransform && typeof DOMMatrix === "function") pat.setTransform(new DOMMatrix().scale(tw / cv.width, th / cv.height));
        } catch (e) { pat = null; }
        TEJAS.set(key, pat);
      }
      if (pat) { g.fillStyle = pat; g.fillRect(0, 0, W, H); }
    }
    function estrellita(g, x, y, r) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * .42 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); g.fill(); }
    function ojiva(g, x0, x1, ys, yb) { const w = x1 - x0; g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0, ys); g.arc(x1, ys, w, Math.PI, Math.PI * 4 / 3); g.arc(x0, ys, w, Math.PI * 5 / 3, Math.PI * 2); g.lineTo(x1, yb); g.closePath(); }
    function farol(g, x, y0, y1, t, i, noche, fuerte, quieto) {
      g.strokeStyle = noche ? "#77728A" : "#4A4555"; g.lineWidth = .9;
      for (let y = y0, k = 0; y < y1 - 1; y += 3.2, k++) { g.beginPath(); g.ellipse(x, y + 1.6, k % 2 ? .5 : 1.3, 1.6, 0, 0, Math.PI * 2); g.stroke(); }
      const f = quieto ? 1 : 1 + Math.sin(t * 6 + i * 2) * .06 + Math.sin(t * 13 + i) * .04, m = fuerte ? 1.35 : 1;
      brillo(g, x, y1 + 10, (noche ? 46 : 26) * f * m, fuerte ? "#FFD36B" : "#FFC46B", Math.min(.8, (noche ? .5 : .32) * m));
      g.fillStyle = "#2C2836"; g.beginPath(); g.moveTo(x - 7, y1 + 3.5); g.lineTo(x, y1 - 1.5); g.lineTo(x + 7, y1 + 3.5); g.closePath(); g.fill();
      g.fillStyle = rgba("#FFD98A", .95); g.fillRect(x - 5, y1 + 3.5, 10, 13);
      g.fillStyle = "#FFF3C9"; g.beginPath(); g.ellipse(x, y1 + 10.5, 1.8 * f, 3.2 * f, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#2C2836"; g.lineWidth = 1.4; g.strokeRect(x - 5, y1 + 3.5, 10, 13);
      g.fillStyle = "#2C2836"; g.fillRect(x - 6, y1 + 16.5, 12, 2.4); g.fillRect(x - 1.5, y1 + 18.9, 3, 1.8);
    }
    function vela(g, x, yb, h, col, t, i, noche, quieto) {
      const f = quieto ? 1 : 1 + Math.sin(t * 11 + i * 3) * .1 + Math.sin(t * 7 + i) * .06;
      brillo(g, x, yb - h - 4, (noche ? 22 : 12) * f, "#FFB45A", noche ? .45 : .25);
      g.fillStyle = col; rr(g, x - 2.3, yb - h, 4.6, h, 1.2); g.fill();
      g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(x - 1.5, yb - h + 1.5, 1, h - 3);
      g.fillStyle = "#FFB43D"; g.beginPath(); g.ellipse(x, yb - h - 4, 1.8 * f, 3.4 * f, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFF3C9"; g.beginPath(); g.ellipse(x, yb - h - 3, .8, 1.6, 0, 0, Math.PI * 2); g.fill();
    }
    /* Un búho (x, y = el centro) con su bufanda tejida de un solo color */
    function buho(g, x, y, s, t, o) {
      g.save(); g.translate(x, y); g.scale(s, s);
      const cuerpo = "#8A6A4E", ala = mix(cuerpo, "#000000", .28);
      g.fillStyle = ala;
      if (o.vuela) { const a = o.quieto ? 0 : Math.sin(t * 16); [-1, 1].forEach(k => { g.save(); g.scale(k, 1); g.translate(4.6, -1); g.rotate(-.35 - a * .55); g.beginPath(); g.ellipse(6.4, 0, 8, 3.2, 0, 0, Math.PI * 2); g.fill(); g.restore(); }); }
      else [-1, 1].forEach(k => { g.beginPath(); g.ellipse(k * 5.4, 2.2, 2.6, 5.4, k * .16, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = cuerpo; g.beginPath(); g.ellipse(0, 1, 6, 7.4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-5.6, -3.4); g.lineTo(-4.8, -9.2); g.lineTo(-1.8, -5.4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(5.6, -3.4); g.lineTo(4.8, -9.2); g.lineTo(1.8, -5.4); g.closePath(); g.fill();
      g.fillStyle = "#E9D7B8"; g.beginPath(); g.ellipse(0, 3.6, 3.8, 4.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#FFF6DF"; circ(g, -2.4, -2.2, 2.5); circ(g, 2.4, -2.2, 2.5);
      if (o.parpadea) { g.strokeStyle = "#2A1E14"; g.lineWidth = .9; g.beginPath(); g.moveTo(-3.9, -2); g.quadraticCurveTo(-2.4, -1, -.9, -2); g.moveTo(.9, -2); g.quadraticCurveTo(2.4, -1, 3.9, -2); g.stroke(); }
      else { g.fillStyle = "#F4AE3D"; circ(g, -2.4, -2.2, 1.55); circ(g, 2.4, -2.2, 1.55); g.fillStyle = "#1A140E"; circ(g, -2.3, -2.1, .85); circ(g, 2.5, -2.1, .85); g.fillStyle = "#FFFFFF"; circ(g, -2, -2.6, .35); circ(g, 2.8, -2.6, .35); }
      g.fillStyle = "#F4A63B"; g.beginPath(); g.moveTo(-1, -.7); g.lineTo(1, -.7); g.lineTo(0, 1.2); g.closePath(); g.fill();
      g.strokeStyle = "#E0A040"; g.lineWidth = 1; g.lineCap = "round"; g.beginPath(); g.moveTo(-1.8, 8); g.lineTo(-1.8, 9.6); g.moveTo(1.8, 8); g.lineTo(1.8, 9.6); g.stroke(); g.lineCap = "butt";
      g.fillStyle = o.bufanda; rr(g, -5.6, 1.5, 11.2, 2.7, 1.2); g.fill();
      g.save(); g.translate(2.4, 3.4); g.rotate(.25 + (o.vuela && !o.quieto ? Math.sin(t * 9) * .3 : 0)); rr(g, -1.3, 0, 2.6, 6, .8); g.fill(); g.fillStyle = "#FFFFFF"; g.fillRect(-1.3, 5.4, 2.6, .9); g.restore();
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-5, 2.6, 10, .5);
      g.restore();
    }
    /* La capa de tu elefante: va detrás de él (en su caja de 260 × 240) y flamea un poco */
    function capa(g, x, piso, w, dy, t, quieto) {
      const s = w / 260, y0 = piso - w * 240 / 260 * .93 + (dy || 0), o = quieto ? 0 : Math.sin(t * 2.2) * 5, o2 = quieto ? 0 : Math.sin(t * 2.2 + 1.3) * 4;
      const forma = (dx, dy2) => {
        const Q = (px, py) => [x + px * s + dx, y0 + py * s + dy2];
        g.beginPath(); g.moveTo(...Q(156, 96)); g.bezierCurveTo(...Q(116, 80), ...Q(72, 86), ...Q(46, 108));
        g.bezierCurveTo(...Q(28, 128 + o2), ...Q(10, 158 + o), ...Q(4 + o, 200));
        g.quadraticCurveTo(...Q(22, 190 + o2), ...Q(36, 202)); g.quadraticCurveTo(...Q(50, 192), ...Q(66, 200));
        g.lineTo(...Q(150, 160)); g.closePath();
      };
      g.fillStyle = "#6C63FF"; forma(2.5, 2); g.fill();
      g.fillStyle = "#2E2A6E"; forma(0, 0); g.fill();
    }
    function layout(v, L, nh) {
      const x0 = 26, x1 = 196, es = 1.2, gap = 1.4, base = 50;
      const filas = Math.max(3, filasPara(L, x0, x1, gap, es, nh));
      const est = Array.from({ length: filas }, (_, k) => ({ x0, x1, yb: 88 + 70 * k }));
      const r = fluir(L, est, base, gap, es, v.sel);
      r.huecos = lugaresMeta(r, est, base, nh, es); r.est = est;
      const yl = est[filas - 1].yb; r.yl = yl; r.P = yl + 56; r.W = 360; r.H = r.P + 16;
      return r;
    }
    /* Lo que no se mueve (el muro, el librero con sus libros, la piedra de la chimenea, el suelo) se pinta en una capa
       aparte y se copia en cada cuadro; se vuelve a pintar solo si algo cambia. Lo que se mueve va encima */
    /* Cada lomo se dibuja una vez (por tamaño y tema) y después se copia: así repintar la capa quieta cuesta poco */
    const SPR = new Map(), TIRA = 150;
    function sprite(b, w, h, sc, noche) {
      const id = b.id + "@" + sc.toFixed(2) + (noche ? "n" : "d"), key = [b.col, b.t, b.pr, b.e, b.am ? 1 : 0, w.toFixed(2), h.toFixed(2), document.fonts ? document.fonts.status : ""].join("|");
      let s = SPR.get(id);
      if (s && s.key === key) return s;
      const mx = 3, my = 9, cv = (s && s.cv) || document.createElement("canvas"); cv.width = Math.max(1, Math.ceil((w + mx * 2) * sc)); cv.height = Math.max(1, Math.ceil((h + my + 3) * sc));
      const c = cv.getContext("2d"); c.setTransform(sc, 0, 0, sc, 0, 0); lomo(c, mx, my, w, h, b, O, false);
      s = { key, cv, mx, my, w: cv.width / sc, h: cv.height / sc };
      if (SPR.size > 2400) SPR.clear();
      SPR.set(id, s); return s;
    }
    function fijo(g, v, L, r, noche, vuelan, sc, y0, y1) {
      const W = r.W, H = r.H, P = r.P, yl = r.yl, fueraDe = it => y0 != null && (it.tg.y > y1 + 12 || it.tg.y + it.tg.h + 16 < y0);
      muro(g, W, H, noche);
      g.fillStyle = noche ? "#3A3552" : "#CFC8D8"; ojiva(g, V.x0 - 7, V.x1 + 7, V.ys, V.sill + 2); g.fill();
      if (!noche) { const yb = Math.min(P + 4, 300); g.fillStyle = "rgba(228,240,255,.14)"; g.beginPath(); g.moveTo(V.x0 + 6, V.sill + 6); g.lineTo(V.x1 - 6, V.sill + 6); g.lineTo(V.x1 - 6 - (V.x1 - V.x0 - 12) * .35 * (yb - V.sill) / 118, yb); g.lineTo(V.x0 + 6 - 82 * (yb - V.sill) / 118, yb); g.closePath(); g.fill(); }
      // el librero de roble con dos pináculos y la guirnalda de pino
      const roble = noche ? "#3B2A22" : "#5E3E2A", fondo = noche ? "#1A1320" : "#4A3328";
      g.fillStyle = fondo; g.fillRect(18, 30, 186, yl - 24);
      g.fillStyle = roble; g.fillRect(12, 30, 8, yl - 22); g.fillRect(202, 30, 8, yl - 22); g.fillRect(10, 26, 202, 6);
      [[16, 26], [206, 26]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x, y - 14); g.lineTo(x + 6, y); g.closePath(); g.fill(); circ(g, x, y - 15, 1.8); });
      r.est.forEach(s => { g.fillStyle = roble; g.fillRect(s.x0 - 8, s.yb, s.x1 - s.x0 + 16, 6); g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(s.x0 - 8, s.yb, s.x1 - s.x0 + 16, 1); });
      for (let x = 12; x <= 210; x += 5) { g.fillStyle = (x / 5) % 2 ? (noche ? "#1F4A3A" : "#2E6A4E") : (noche ? "#285A46" : "#3C7E5C"); g.beginPath(); g.ellipse(x, 30 + Math.sin(x * .7) * 1.2, 4.4, 3.4, 0, 0, Math.PI * 2); g.fill(); }
      [16, 206].forEach(x => { g.fillStyle = "#D8344E"; g.beginPath(); g.moveTo(x, 31); g.lineTo(x - 5, 28); g.lineTo(x - 5, 34); g.closePath(); g.fill(); g.beginPath(); g.moveTo(x, 31); g.lineTo(x + 5, 28); g.lineTo(x + 5, 34); g.closePath(); g.fill(); circ(g, x, 31, 1.4); });
      // la barra de las cadenas: bajo cada repisa que tiene libros de antes
      const fierro = noche ? "#8D93A8" : "#A9AFC0", conAntes = new Set();
      L.forEach((b, i) => { const it = v.items.get(b.id); if (b.antes && it && it.tg && !vuelan.has(i)) conAntes.add(it.tg.e); });
      conAntes.forEach(e => { const yb = r.est[e].yb; g.fillStyle = fierro; g.fillRect(20, yb + 11, 182, 2); g.fillStyle = "#D8B35A"; rr(g, 202, yb + 12, 8, 7, 1.5); g.fill(); g.strokeStyle = "#D8B35A"; g.lineWidth = 1.2; g.beginPath(); g.arc(206, yb + 12.5, 2.4, Math.PI, 0); g.stroke(); g.fillStyle = "#6A4A1A"; circ(g, 206, yb + 15.4, .9); });
      if (sc) L.forEach((b, i) => {   // con capa: cada lomo desde su copia, y el seleccionado con su borde
        const it = v.items.get(b.id); if (!it || !it.tg || vuelan.has(i) || fueraDe(it)) return;
        const s = sprite(b, it.tg.w, it.tg.h, sc, noche);
        g.save(); g.globalAlpha = it.a; g.drawImage(s.cv, it.x - s.mx, it.y - s.my, s.w, s.h); g.restore();
        if (b.id === v.sel) { g.strokeStyle = O.selCol; g.lineWidth = 1.4; rr(g, it.x - 1, it.y - 1, it.tg.w + 2, it.tg.h + 2, 2.5); g.stroke(); }
      });
      else { const hs = v.hits; v.hits = []; pintarLomos(g, v, L, O, i => !vuelan.has(i)); v.hits = hs; }
      L.forEach((b, i) => {
        const it = v.items.get(b.id); if (!b.antes || !it || !it.tg || vuelan.has(i) || fueraDe(it)) return;
        const x0 = it.x + it.tg.w / 2, y0 = it.y + it.tg.h - 7, x1 = x0 + 3, y1 = r.est[it.tg.e].yb + 11.5, n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 2.4));
        g.strokeStyle = fierro; g.lineWidth = .8; for (let k = 0; k <= n; k++) { const u = k / n; g.beginPath(); g.ellipse(x0 + (x1 - x0) * u + Math.sin(u * Math.PI) * 1.2, y0 + (y1 - y0) * u, k % 2 ? .5 : 1.1, 1.3, 0, 0, Math.PI * 2); g.stroke(); }
      });
      const nh = r.huecos.length; huecos(g, r.huecos, nh ? (nh === 1 ? "falta 1" : `faltan ${nh}`) : "", "#FFE3A3");
      // la piedra de la chimenea, con dos botas colgando
      g.fillStyle = noche ? "#35304A" : "#B8B0C2"; g.fillRect(292, P - 84, 66, 84);
      g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 1; g.beginPath(); [70, 54, 38, 22].forEach(q => { g.moveTo(292, P - q); g.lineTo(358, P - q); }); g.stroke();
      g.fillStyle = noche ? "#4A4466" : "#CFC8D8"; rr(g, 286, P - 90, 74, 7, 2); g.fill();
      [[300, "#E5527A"], [350, "#17C3B2"]].forEach(([x, c]) => { g.fillStyle = c; rr(g, x - 3.5, P - 81, 7, 12, 1.5); g.fill(); rr(g, x - 3.5, P - 73, 10, 5, 2.5); g.fill(); g.fillStyle = "#FFFFFF"; rr(g, x - 4, P - 83, 8, 3.4, 1.4); g.fill(); });
      // el suelo de piedra y los soportes de los faroles del muro (si la biblioteca es muy alta)
      g.fillStyle = noche ? "#2A2539" : "#6E667B"; g.fillRect(0, P, W, H - P);
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < W + 10; x += 30) { g.moveTo(x, P); g.lineTo(x - 8, H); } g.moveTo(0, P + 8); g.lineTo(W, P + 8); g.stroke();
      for (let y = 420; y < P - 200; y += 380) { g.fillStyle = noche ? "#77728A" : "#4A4555"; g.fillRect(286, y - 2, 30, 2.4); g.fillRect(314, y - 8, 2.4, 14); }
    }
    const O = { selCol: "#FFE3A3" };
    function draw(g, v, L, r, t, dt) {
      const W = r.W, H = r.H, P = r.P, noche = !!T.oscuro, quieto = QUIETO || !!v.quieto, d = v.datos, tt = quieto ? 0 : t;
      const logro = d.meta > 0 && d.delAnio >= d.meta, blanco = noche ? "#DCE6FA" : "#FFFFFF";
      dt = dt || 0; if (!v.parts) v.parts = [];
      if (v.logroAntes === false && logro && !quieto) {   // se acaba de cumplir la meta: chispas desde la estrella del pino y la guirnalda
        for (let k = 0; k < 22; k++) { const a = Math.random() * Math.PI * 2, s = 18 + Math.random() * 38; v.parts.push({ x: PINO, y: 110, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, vida: .8 + Math.random() * .7, r: 1.6, c: ["#FFD36B", "#FFFFFF", "#FFE3A3"][k % 3], g: 26 }); }
        for (let k = 0; k < 16; k++) { const a = Math.random() * Math.PI * 2, s = 16 + Math.random() * 30; v.parts.push({ x: 20 + Math.random() * 180, y: 34, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, vida: .6 + Math.random() * .6, r: 1.2, c: LECT[k % 8], g: 40, punto: true }); }
      }
      v.logroAntes = logro;
      // los libros que vienen llegando (cada uno con su búho) no van todavía en su lugar; los que se están moviendo, tampoco
      const vuelan = new Map(), mueven = new Set();
      L.forEach((b, i) => {
        const it = v.items.get(b.id); if (!it || !it.tg) return;
        if (it.nuevo) { it.nuevo = false; if (!quieto) it.vuelo = t; }
        if (it.vuelo == null) return;
        const u = (t - it.vuelo) / DUR;
        if (quieto || u >= 1 || u < 0) {   // llegó: chispas y el búho se vuelve
          it.vuelo = null;
          if (!quieto) { for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, s = 12 + Math.random() * 26; v.parts.push({ x: it.tg.x + it.tg.w / 2, y: it.tg.y + 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 12, vida: .5 + Math.random() * .4, r: 1.4, c: ["#FFFFFF", "#D6E8FF", "#FFE3A3"][k % 3], g: 10 }); } v.vuelta = { t, x: it.tg.x + it.tg.w / 2, y: it.tg.y - 12 }; }
          return;
        }
        vuelan.set(i, u);
      });
      L.forEach((b, i) => { const it = v.items.get(b.id); if (it && it.tg && !vuelan.has(i) && (Math.abs(it.x - it.tg.x) + Math.abs(it.y - it.tg.y) > .25 || it.a < .99)) mueven.add(i); });
      const fuera = new Set([...vuelan.keys(), ...mueven]);
      g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();   // los brillos no se salen del dibujo (la imagen de compartir)
      // la capa quieta: copiada si nada cambió
      const cv = v.cv, usaCapa = !quieto && cv && typeof cv.getContext === "function" && cv.width > 0;
      if (usaCapa) {
        // la capa quieta va en franjas: al cambiar un libro se repinta solo su franja
        const pw = cv.width, sc = pw / W, th = Math.max(1, Math.round(TIRA * sc)), nT = Math.max(1, Math.ceil(cv.height / th));
        if (!v.tiras || v.tiras.sc !== sc || v.tiras.n !== nT || v.tiras.H !== H) v.tiras = { sc, n: nT, H, t: Array.from({ length: nT }, () => ({ cv: null, key: "" })) };
        const base = [W, H, pw, noche ? 1 : 0, document.fonts ? document.fonts.status + document.fonts.size : ""].join("|"), partes = v.tiras.t.map(() => []);
        const marca = (ya, yb, txt) => { const a = Math.max(0, Math.floor(ya * sc / th)), z = Math.min(nT - 1, Math.floor(yb * sc / th)); for (let k = a; k <= z; k++) partes[k].push(txt); };
        L.forEach((b, i) => { const it = v.items.get(b.id); if (it && it.tg && !fuera.has(i)) marca(it.tg.y - 10, it.tg.y + it.tg.h + 15, b.id + b.col + b.t + b.pr + b.e + (b.am ? 1 : 0) + (b.antes ? 1 : 0) + b.fmt + it.tg.x.toFixed(1) + "," + it.tg.y.toFixed(1) + (b.id === v.sel ? "S" : "")); });
        r.huecos.forEach((q, k) => marca(q.y - 16, q.y + q.h + 2, "h" + q.x.toFixed(1) + "," + q.y.toFixed(1) + (k ? "" : "/" + r.huecos.length)));
        v.tiras.t.forEach((tira, k) => {
          const key = base + "#" + partes[k].join(";"), alto = Math.min(th, cv.height - k * th);
          if (key === tira.key && tira.cv) return;
          if (!tira.cv) tira.cv = document.createElement("canvas");
          if (tira.cv.width !== pw || tira.cv.height !== alto) { tira.cv.width = pw; tira.cv.height = alto; }
          const c = tira.cv.getContext("2d"), y0 = k * th / sc, y1 = (k * th + alto) / sc;
          c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, pw, alto); c.setTransform(sc, 0, 0, sc, 0, -k * th);
          c.save(); c.beginPath(); c.rect(0, y0, W, y1 - y0); c.clip(); fijo(c, v, L, r, noche, fuera, sc, y0, y1); c.restore();
          tira.key = key;
        });
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); v.tiras.t.forEach((tira, k) => { if (tira.cv) g.drawImage(tira.cv, 0, k * th); }); g.restore();
        mueven.forEach(i => { const b = L[i], it = v.items.get(b.id), sp = sprite(b, it.tg.w, it.tg.h, sc, noche); g.save(); g.globalAlpha = it.a; g.drawImage(sp.cv, it.x - sp.mx, it.y - sp.my, sp.w, sp.h); g.restore(); if (b.id === v.sel) { g.strokeStyle = O.selCol; g.lineWidth = 1.4; rr(g, it.x - 1, it.y - 1, it.tg.w + 2, it.tg.h + 2, 2.5); g.stroke(); } });
      } else fijo(g, v, L, r, noche, fuera);
      L.forEach((b, i) => { const it = v.items.get(b.id); if (it && it.tg && !vuelan.has(i)) v.hits.push({ x: it.x, y: it.y - 6, w: it.tg.w, h: it.tg.h + 6, id: b.id }); });
      // la ventana: la nieve, una torrecita y el pino de afuera
      g.save(); ojiva(g, V.x0, V.x1, V.ys, V.sill); g.clip();
      const cielo = g.createLinearGradient(0, 0, 0, V.sill); cielo.addColorStop(0, noche ? "#0A1030" : "#9DB8D6"); cielo.addColorStop(1, noche ? "#26325F" : "#E8F0F7");
      g.fillStyle = cielo; g.fillRect(V.x0, 0, V.x1 - V.x0, V.sill);
      if (noche) {
        brillo(g, 306, 50, 34, "#FFF3C9", .35); g.fillStyle = "#FFF3C9"; circ(g, 306, 50, 11);
        g.fillStyle = "rgba(220,214,190,.55)"; circ(g, 302, 47, 2.2); circ(g, 309, 54, 1.6);
        for (let i = 0; i < 16; i++) { const tw = .4 + .6 * Math.abs(Math.sin(tt * (1 + azar(i, "vt")) + i)); g.fillStyle = rgba("#FFFFFF", .75 * tw); estrellita(g, V.x0 + 4 + azar(i, "vx") * (V.x1 - V.x0 - 8), 14 + azar(i, "vy") * 90, azar(i, "vr") < .2 ? 1.8 : 1); }
      }
      g.fillStyle = noche ? "#2A3050" : "#7D869E"; g.fillRect(246, 130, 22, 40); g.fillStyle = noche ? "#FFD27A" : "#F6E7B0"; rr(g, 253, 140, 8, 11, 4); g.fill();
      g.fillStyle = noche ? "#1E2440" : "#4E5874"; g.beginPath(); g.moveTo(240, 132); g.lineTo(257, 98); g.lineTo(274, 132); g.closePath(); g.fill();
      g.fillStyle = blanco; g.beginPath(); g.moveTo(257, 98); g.lineTo(249, 114); g.quadraticCurveTo(253, 118, 257, 114); g.quadraticCurveTo(261, 118, 265, 114); g.closePath(); g.fill(); g.fillRect(244, 129, 26, 3);
      const verde = noche ? "#1F4A3A" : "#2E6A4E";
      [[170, 20, 142], [152, 16, 128], [136, 11, 114]].forEach(([yb, w, yt]) => { g.fillStyle = verde; g.beginPath(); g.moveTo(PINO - w, yb); g.lineTo(PINO, yt); g.lineTo(PINO + w, yb); g.closePath(); g.fill(); g.fillStyle = blanco; g.beginPath(); g.moveTo(PINO - w, yb); g.quadraticCurveTo(PINO, yb - 6, PINO + w, yb); g.quadraticCurveTo(PINO, yb - 2, PINO - w, yb); g.fill(); });
      if (logro) {   // el pino encendido, con su estrella
        [[-8, 162], [8, 160], [0, 150], [-12, 146], [12, 144], [-4, 136], [4, 128], [0, 120]].forEach(([dx, y], i) => { const c = LECT[(i * 3) % 8], tw = quieto ? 1 : .7 + .3 * Math.sin(t * 4 + i * 1.7); brillo(g, PINO + dx, y, 7, c, .6 * tw); g.fillStyle = mix(c, "#FFFFFF", .3 * tw); circ(g, PINO + dx, y, 1.7); });
        brillo(g, PINO, 110, 18, "#FFD36B", .7); g.fillStyle = "#FFD36B"; estrellita(g, PINO, 110, 4.6);
      }
      g.fillStyle = blanco; g.beginPath(); g.moveTo(V.x0, 172); g.lineTo(V.x0, 164); for (let x = V.x0; x <= V.x1; x += 13) g.quadraticCurveTo(x + 6.5, 158 + (x % 3), x + 13, 164); g.lineTo(V.x1, 172); g.closePath(); g.fill();
      for (let i = 0; i < 28; i++) { const x = V.x0 + azar(i, "nx") * (V.x1 - V.x0) + Math.sin(tt * .8 + i) * 5, y = (azar(i, "ny") * 180 + tt * (12 + azar(i, "nv") * 16)) % 180 - 6; g.fillStyle = rgba("#FFFFFF", noche ? .85 : .95); circ(g, x, y, .8 + azar(i, "nr") * 1.1); }
      brillo(g, V.x0, V.sill, 44, "#FFFFFF", noche ? .35 : .6); brillo(g, V.x1, V.sill, 44, "#FFFFFF", noche ? .35 : .6);
      g.strokeStyle = rgba("#FFFFFF", noche ? .05 : .16); g.lineWidth = .8; g.beginPath();
      for (let k = -14; k < 14; k++) { g.moveTo(V.x0 + k * 12, V.sill); g.lineTo(V.x0 + k * 12 + 170, V.sill - 170); g.moveTo(V.x0 + k * 12, 0); g.lineTo(V.x0 + k * 12 + 170, 170); }
      g.stroke(); g.restore();
      // las piedras de la ventana: el parteluz, dos arcos chicos y un rosetón de cuatro hojas; y la nieve en el alféizar
      const piedra = noche ? "#3A3552" : "#CFC8D8", wc = (V.x0 + V.x1) / 2; g.strokeStyle = piedra; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(wc, V.sill); g.lineTo(wc, 72); g.stroke();
      ojiva(g, V.x0, wc, V.ys + 12, V.sill); g.stroke(); ojiva(g, wc, V.x1, V.ys + 12, V.sill); g.stroke();
      g.lineWidth = 2.6; g.beginPath(); g.arc(wc, 46, 13, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1.6; [[0, -5.5], [5.5, 0], [0, 5.5], [-5.5, 0]].forEach(([a, b]) => { g.beginPath(); g.arc(wc + a, 46 + b, 5, 0, Math.PI * 2); g.stroke(); });
      g.fillStyle = noche ? "#4A4466" : "#DCD6E3"; rr(g, V.x0 - 12, V.sill, V.x1 - V.x0 + 24, 6, 1.5); g.fill();
      g.fillStyle = blanco; g.beginPath(); g.moveTo(V.x0 - 12, V.sill + 1); for (let x = V.x0 - 12; x < V.x1 + 12; x += 12) g.quadraticCurveTo(x + 6, V.sill - 5, x + 12, V.sill + 1); g.closePath(); g.fill();
      // las luces de la guirnalda: se prenden en tu meta
      for (let k = 0; k < 15; k++) { const x = 18 + k * 13.4, c = LECT[k % 8], tw = logro ? (quieto ? 1 : .7 + .3 * Math.sin(t * 4 + k * 1.9)) : 0; if (logro) brillo(g, x, 34, 7, c, .55 * tw); g.fillStyle = logro ? mix(c, "#FFFFFF", .25 * tw) : (noche ? "#4A5060" : "#6E7486"); g.beginPath(); g.ellipse(x, 34.5, 1.5, 2.1, 0, 0, Math.PI * 2); g.fill(); }
      // los faroles (más fuertes con la meta cumplida); en una biblioteca muy alta, más faroles en el muro
      farol(g, 112, 0, 8, tt, 0, noche, logro, quieto); farol(g, 218, 0, 34, tt, 1, noche, logro, quieto);
      for (let y = 420, k = 2; y < P - 200; y += 380, k++) farol(g, 290, y, y + 10, tt, k, noche, logro, quieto);
      // el fuego de la chimenea y sus dos velas
      brillo(g, 326, P - 12, noche ? 74 : 48, "#FF9A3D", noche ? .45 : .28);
      g.fillStyle = "#1A1218"; g.beginPath(); g.moveTo(304, P); g.lineTo(304, P - 44); g.quadraticCurveTo(325, P - 66, 346, P - 44); g.lineTo(346, P); g.closePath(); g.fill();
      brillo(g, 325, P - 14, 26, "#FF8A3D", .6);
      g.fillStyle = "#5A3A22"; rr(g, 310, P - 8, 30, 5, 2); g.fill(); rr(g, 314, P - 13, 22, 5, 2); g.fill();
      for (let i = 0; i < 5; i++) { const fx = 313 + i * 6, fh = quieto ? 13 : 12 + Math.sin(t * 8 + i * 2) * 4; g.fillStyle = i % 2 ? "#FFB43D" : "#FF6B2D"; g.beginPath(); g.moveTo(fx - 4.5, P - 10); g.quadraticCurveTo(fx, P - 10 - fh * 1.7, fx + 4.5, P - 10); g.fill(); }
      g.fillStyle = "#FFE08A"; g.beginPath(); g.moveTo(320, P - 10); g.quadraticCurveTo(325, P - 10 - (quieto ? 14 : 13 + Math.sin(t * 9) * 3), 330, P - 10); g.fill();
      vela(g, 316, P - 90, 8, "#F3E9D6", t, 4, noche, quieto); vela(g, 334, P - 90, 10, "#D8344E", t, 5, noche, quieto);
      // tu elefante, con su capa
      const ds = t - (v.saltoT || -9), dy = !quieto && ds < .55 ? -Math.sin(ds / .55 * Math.PI) * 7 : 0;
      capa(g, 202, P + 4, 80, dy, tt, quieto);
      elefante(g, d.elefante, 202, P + 4, 80, dy);
      // el búho de la ventana, con bufanda: parpadea cada tanto
      buho(g, 320, 160, 1, tt, { parpadea: (tt % 4.3) > 4.14, bufanda: "#E5527A", quieto });
      // los libros que llegan, cada uno con su búho entre copos de nieve
      vuelan.forEach((u, i) => {
        const b = L[i], it = v.items.get(b.id), tg = it.tg, lejos = tg.y > 320;
        const desde = lejos ? { x: 376, y: tg.y - 170 } : { x: 290, y: 66 }, ctrl = lejos ? { x: (376 + tg.x) / 2, y: tg.y - 150 } : { x: (290 + tg.x) / 2 + 34, y: Math.min(tg.y, 110) - 54 };
        const p = bez(desde, ctrl, tg, suave(u));
        lomo(g, p.x, p.y, tg.w, tg.h, b, O, b.id === v.sel); v.hits.push({ x: p.x, y: p.y - 6, w: tg.w, h: tg.h + 6, id: b.id });
        buho(g, p.x + tg.w / 2, p.y - 11, 1.1, t, { vuela: true, bufanda: "#17C3B2", quieto });
        if (Math.random() < .55) v.parts.push({ x: p.x + 2 + Math.random() * 10, y: p.y - 8 + Math.random() * 6, vx: (Math.random() - .5) * 14, vy: 12, vida: .8, r: .9 + Math.random() * .6, c: "#FFFFFF", g: 6 });
      });
      if (v.vuelta && !quieto) {   // el búho se vuelve por donde vino
        const k = (t - v.vuelta.t) / 1.1;
        if (k >= 0 && k < 1) { const lejos = v.vuelta.y > 320, fin = lejos ? { x: 376, y: v.vuelta.y - 150 } : { x: 300, y: 56 }, p = bez(v.vuelta, { x: (v.vuelta.x + fin.x) / 2, y: Math.min(v.vuelta.y, fin.y) - 26 }, fin, suave(k)); g.save(); g.globalAlpha *= 1 - Math.max(0, (k - .7) / .3); buho(g, p.x, p.y, 1.05, t, { vuela: true, bufanda: "#17C3B2", quieto }); g.restore(); }
        else if (k >= 1) v.vuelta = null;
      }
      // las chispas y los copos
      if (v.parts.length) {
        v.parts.forEach(q => { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt; g.save(); g.globalAlpha *= Math.max(0, Math.min(1, q.vida * 1.6)); g.fillStyle = q.c; if (q.punto) circ(g, q.x, q.y, q.r); else estrellita(g, q.x, q.y, q.r * 1.6); g.restore(); });
        v.parts = v.parts.filter(q => q.vida > 0);
      }
      g.restore();
      if (vuelan.size || v.vuelta || v.parts.length || ds < .55) r.mov = true;
      return true;
    }
    return { caida: 0, ambiente: true, layout, draw };
  })();

  /* ============ Cada lienzo ============ */
  const vistas = new Set();
  function leerDatos(v) {
    let d = null;
    try {
      if (v.modo === "muestra" || v.modo === "chica") d = datosMuestra(v.estilo);
      else if (v.modo === "visita") d = typeof v.cv._bibDatos === "function" ? v.cv._bibDatos() : null;
      else d = typeof bibDatos === "function" ? bibDatos() : null;
    } catch (e) { d = null; }
    if (!d || typeof d !== "object") d = v.modo === "lecturas" && typeof bibDatos !== "function" ? datosMuestra(v.estilo) : { libros: [] };
    const libros = (Array.isArray(d.libros) ? d.libros : []).slice(0, 3000).map(aLibro);
    return { libros, huecos: Math.max(0, Math.min(60, Math.round(+d.huecos || 0))), meta: Math.max(0, +d.meta || 0), delAnio: Math.max(0, +d.delAnio || 0),
      florece: !!d.florece, nombre: String(d.nombre || ""), elefante: typeof d.elefante === "string" ? d.elefante : "" };
  }
  /* Pone al día los libros (sus posiciones, que se mueven hacia su lugar) y devuelve el layout */
  function preparar(v, dt) {
    v.datos = leerDatos(v);
    const L = v.datos.libros, Es = E[v.estilo];
    if (v.sel != null && !L.some(b => b.id === v.sel)) v.sel = null;
    const r = Es.layout(v, L, Es.layout.length > 2 ? v.datos.huecos : 0);
    const k = QUIETO || v.quieto || !dt ? 1 : 1 - Math.exp(-dt * 9); let mov = false;
    const vivos = new Set();
    L.forEach((b, i) => {
      const tg = r.pos[i]; if (!tg) return; vivos.add(b.id);
      let it = v.items.get(b.id);
      if (!it) { it = { x: null, y: null, a: 1, s: 1, nuevo: v.nuevos.has(b.id) }; v.items.set(b.id, it); }
      if (v.nuevos.has(b.id) && it.x != null && !QUIETO && !v.quieto) { it.y = tg.y - (Es.caida || 0); it.a = Es.caida ? 0 : 1; it.s = Es.crece ? 0 : 1; it.nuevo = true; }
      v.nuevos.delete(b.id);
      if (it.x == null) { it.x = tg.x; it.y = tg.y - (it.nuevo && !QUIETO && !v.quieto ? Es.caida || 0 : 0); it.a = it.nuevo && !QUIETO && !v.quieto && Es.caida ? 0 : 1; it.s = it.nuevo && Es.crece && !QUIETO && !v.quieto ? 0 : 1; }
      it.x += (tg.x - it.x) * k; it.y += (tg.y - it.y) * k; it.a += (1 - it.a) * Math.min(1, k * 1.6); it.s += (1 - it.s) * k;
      if (Math.abs(tg.x - it.x) + Math.abs(tg.y - it.y) > .25 || it.a < .99 || it.s < .99) mov = true; else { it.x = tg.x; it.y = tg.y; it.a = 1; it.s = 1; }
      it.tg = tg;
    });
    v.items.forEach((_, id) => { if (!vivos.has(id)) v.items.delete(id); });
    r.mov = mov;
    return r;
  }
  function pintar(v, t, dt) {
    const r = preparar(v, dt), g = v.g;
    // el tamaño del dibujo cambia con los libros: el lienzo crece hacia abajo
    if (r.W !== v.W || r.H !== v.H) { v.W = r.W; v.H = r.H; v.cv.style.aspectRatio = `${r.W} / ${r.H}`; medir(v, true); }
    const sc = v.cv.width / r.W;
    g.setTransform(sc, 0, 0, sc, 0, 0); g.clearRect(0, 0, r.W, r.H);
    v.hits = [];
    const ambiente = E[v.estilo].draw(g, v, v.datos.libros, r, t, dt);
    if (v.conf.length) {
      v.conf.forEach(p => { p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 6; p.vida -= dt; g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.vida)); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-2.5, -1.2, 5, 2.4); g.restore(); });
      v.conf = v.conf.filter(p => p.vida > 0 && p.y < r.H + 10);
    }
    // lo de ambiente (el polvo, el globo, las hojas al viento) se mueve un rato después de despertar, no para siempre
    const ahora = performance.now();
    return r.mov || !!v.conf.length || (!QUIETO && !v.quieto && !!ambiente && ahora < v.ambienteHasta);
  }
  function medir(v, sinPintar) {
    const w = v.cv.clientWidth || v.W || 360, h = w * (v.H || 272) / (v.W || 360);
    const dpr = Math.max(.5, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(PIX_MAX / Math.max(1, w * h))));
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    const cambio = v.cv.width !== pw || v.cv.height !== ph;
    if (cambio) { v.cv.width = pw; v.cv.height = ph; }
    if (sinPintar) return;
    if (cambio) { try { v.vivo = pintar(v, performance.now() / 1000, 1 / 60); } catch (e) { console.error(e); } }
    v.sucio = true; despertar(v, false);
  }
  function despertar(v, conAmbiente) {
    if (conAmbiente !== false) v.ambienteHasta = performance.now() + 8000;
    v.sucio = true; arrancar();
  }
  function tocado(v, e) {
    const rc = v.cv.getBoundingClientRect(); if (!rc.width) return null;
    const x = (e.clientX - rc.left) / rc.width * v.W, y = (e.clientY - rc.top) / rc.height * v.H;
    for (let k = v.hits.length - 1; k >= 0; k--) { const h = v.hits[k]; if (x >= h.x - 1.5 && x <= h.x + h.w + 1.5 && y >= h.y - 1.5 && y <= h.y + h.h + 1.5) return h; }
    return null;
  }
  function confeti(v) { const W = v.W || 360; for (let k = 0; k < 70; k++) v.conf.push({ x: W * (.2 + Math.random() * .6), y: 10 + Math.random() * 20, vx: (Math.random() - .5) * 120, vy: -40 - Math.random() * 90, c: LECT[k % 8], r: Math.random() * 6, vida: 1.6 + Math.random() * .6 }); }

  function montar(cv) {
    if (!cv || cv.dataset.listo) return; cv.dataset.listo = "1";
    const estilo = E[cv.dataset.biblio] ? cv.dataset.biblio : (cv.dataset.biblio === "flotante" ? "flotantes" : "repisa");
    const modo = ["lecturas", "muestra", "visita", "chica"].includes(cv.dataset.modo) ? cv.dataset.modo : "lecturas";
    const v = { cv, g: cv.getContext("2d"), estilo, modo, quieto: modo === "chica", items: new Map(), nuevos: new Set(), sel: null, hits: [], conf: [], sucio: true, vivo: false, visible: true, ambienteHasta: 0, W: 0, H: 0, datos: { libros: [] } };
    if (modo === "muestra") { const m = datosMuestra(estilo).libros, i = m.findIndex(b => b.titulo === "Orgullo y prejuicio"); v.sel = i >= 0 ? "m" + i : null; }
    vistas.add(v);
    const r0 = preparar(v, 0); v.W = r0.W; v.H = r0.H; cv.style.aspectRatio = `${r0.W} / ${r0.H}`;
    medir(v, true);
    if (modo !== "chica") {
      cv.addEventListener("click", e => {
        const h = tocado(v, e); if (!h) return;
        v.sel = h.id; despertar(v);
        if ((modo === "lecturas" || modo === "visita") && typeof bibTocarLibro === "function") { try { bibTocarLibro(h.id, cv); } catch (err) { console.error(err); } }
      });
      cv.addEventListener("pointermove", e => { cv.style.cursor = tocado(v, e) ? "pointer" : "default"; });
    }
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { v.visible = es[es.length - 1].isIntersecting; if (v.visible) despertar(v); }, { rootMargin: "80px" }).observe(cv);
    if (window.ResizeObserver) new ResizeObserver(() => medir(v)).observe(cv);
    despertar(v);
    return v;
  }

  /* Un solo bucle para todos los lienzos: corre mientras alguno se mueve y se detiene cuando todos están quietos */
  let corriendo = false, ult = 0;
  function arrancar() { if (corriendo) return; corriendo = true; ult = performance.now(); requestAnimationFrame(bucle); }
  function bucle(ms) {
    const t = ms / 1000, dt = Math.min(.05, Math.max(0, (ms - ult) / 1000)); ult = ms;
    let alguno = false;
    vistas.forEach(v => {
      if (!v.cv.isConnected) { vistas.delete(v); return; }
      if (!v.visible || document.hidden) return;
      if (v.sucio || v.vivo) { v.sucio = false; try { v.vivo = pintar(v, t, v.vivo ? dt : 1 / 60); } catch (err) { v.vivo = false; console.error(err); } }
      if (v.vivo || v.sucio) alguno = true;
    });
    if (alguno) requestAnimationFrame(bucle); else corriendo = false;
  }

  function refrescar() { vistas.forEach(v => { if (!v.cv.isConnected) { vistas.delete(v); return; } despertar(v, false); }); }
  function sumar(id) {
    id = String(id);
    vistas.forEach(v => {
      if (v.modo !== "lecturas" || !v.cv.isConnected) return;
      const d = leerDatos(v);
      v.nuevos.add(id); v.sel = id; v.saltoT = performance.now() / 1000;
      if (d.meta > 0 && d.delAnio === d.meta && !QUIETO) confeti(v);
      despertar(v);
    });
  }

  /* Un dibujo quieto en un contexto dado (la imagen para compartir): el mueble centrado en w × h */
  function dibujarEn(ctx, estilo, datos, w, h) {
    estilo = E[estilo] ? estilo : "repisa";
    const v = { cv: { _bibDatos: () => datos, width: w, height: h, style: {} }, g: ctx, estilo, modo: "visita", quieto: true, items: new Map(), nuevos: new Set(), sel: null, hits: [], conf: [], datos: { libros: [] }, ambienteHasta: 0 };
    const dibujar = () => {
      const r = preparar(v, 0), k = Math.min(w / r.W, h / r.H), ox = (w - r.W * k) / 2, oy = (h - r.H * k) / 2;
      ctx.save(); ctx.setTransform(k, 0, 0, k, ox, oy);
      E[estilo].draw(ctx, v, v.datos.libros, r, 0, 0);
      ctx.restore();
    };
    dibujar();
    const o = imagenEle(v.datos.elefante);
    if (!o || o.listo) return Promise.resolve();
    return new Promise(res => { o.espera.push(() => { try { dibujar(); } catch (e) { console.error(e); } res(); }); });
  }

  // Cada lienzo nuevo se monta solo
  let espera = null;
  new MutationObserver(() => { if (espera) return; espera = setTimeout(() => { espera = null; document.querySelectorAll("canvas[data-biblio]:not([data-listo])").forEach(montar); }, 20); })
    .observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => document.querySelectorAll("canvas[data-biblio]:not([data-listo])").forEach(montar), 0);
  // el tema cambia los colores
  const cambioTema = () => { leerTema(); refrescar(); };
  new MutationObserver(cambioTema).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  if (window.matchMedia) { const mq = matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", cambioTema); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refrescar).catch(() => {});

  return { montar, refrescar, sumar, dibujarEn, ESTILOS: IDS.slice() };
})();
