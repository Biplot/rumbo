/* ============================================================
   RUMBO · 🌱 El motor del jardín (Hábitos, Inicio y la Tienda)
   Canvas 2D. Siete estilos del mismo jardín: la entrada (viene con Rumbo), la ventana, el terrario,
   en píxeles y el sur, y los temas especiales Marte y la base lunar. Las mismas reglas en todos: hasta tres macetas (cada planta crece con sus
   días cumplidos y florece cerca de echar raíces), un árbol por hábito con raíces (sin hojas si lo
   dejaste) y un cielo que es tu constancia de la semana.
   Cada lienzo canvas[data-jardin="<estilo>"] se monta solo con jardinEscena() (jardin.js);
   data-modo="muestra" dibuja un jardín de ejemplo (la Tienda).
   regar(id): tu elefante riega esa maceta (al marcar el hábito). trasplantar(id): el árbol nuevo brota.
   Días de descanso: la maceta del hábito que descansa hoy tiene su hamaquita, y en vacaciones un letrero
   dice cuándo vuelves (en todos los estilos: se dibujan encima, donde quedó cada maceta).
   En las tarjetas queda quieto (no gasta batería): se mueve al regar o trasplantar, en la hoja del jardín y en la
   muestra de la Tienda (data-vivo), un rato y solo si se ve.
   ============================================================ */
const JARDIN_MOTOR = (() => {
  if (typeof document === "undefined") return { regar() {}, trasplantar() {}, repintar() {}, montar() {} };
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const QUIETO = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const hex = c => { c = String(c || "#888").trim(); if (c.startsWith("rgb")) return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); const n = parseInt(c, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mezcla = (a, b, k) => { const x = hex(a), y = hex(b); k = Math.max(0, Math.min(1, k)); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const semilla = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const lg = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const rg = (ctx, x, y, r0, r1, st) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const FLORES = ["#F28CB0", "#FFD24A", "#9AA6FF", "#FF8A5B", "#C49BF5", "#5CC8E8", "#FFFFFF", "#FF6B8A"];
  let OSC = false, PIEL = "#9FB2C8", PIEL_OSC = "#7C91AB";
  function colores() {
    const t = getComputedStyle(document.documentElement).getPropertyValue("--text").trim(), [r, g, b] = hex(t || "#161A2E");
    OSC = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
    try { if (typeof jardinPiel === "function") [PIEL, PIEL_OSC] = jardinPiel(); } catch (e) {}
  }
  const ahora = () => performance.now() / 1000;
  let riego = { id: "", t0: -99 }, brote = { id: "", t0: -99 };
  let FIJA = false;   // en las tarjetas (quietas), los personajes de los temas especiales posan
  /* Un árbol recién trasplantado brota: crece de 0 a 1 en un poco más de un segundo */
  const brota = (a, t) => { if (!a || a.id !== brote.id) return 1; const d = t - brote.t0; return d < 0 ? 0.05 : d > 1.3 ? 1 : Math.max(0.05, 1 - Math.pow(1 - d / 1.3, 3)); };
  const ultimos = e => (e.arboles || []).slice(-8);

  /* -------- Piezas comunes (vista de lado) -------- */
  function verdeDe(c, dk, base) { return mezcla(base || (dk ? "#3FA36A" : "#3E9C57"), dk ? "#3A3F4E" : "#9AA39A", (1 - c) * 0.35); }
  function nube(ctx, x, y, s, col) { ctx.fillStyle = col; ctx.beginPath(); [[0, 0, 11], [11, -5, 13], [24, 0, 10], [12, 4, 11]].forEach(([dx, dy, rr]) => { ctx.moveTo(x + (dx + rr) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, rr * s, 0, 6.3); }); ctx.fill(); }
  function cielo(ctx, x, y, w, h, c, dk, t, sol) {
    ctx.fillStyle = lg(ctx, 0, y, 0, y + h, dk ? [[0, mezcla("#262A3E", "#101C46", c)], [1, mezcla("#3B4054", "#2A3F82", c)]] : [[0, mezcla("#98A1AF", "#5FB6EE", c)], [1, mezcla("#CBD0D8", "#DDF2FD", c)]]);
    ctx.fillRect(x, y, w, h);
    const r = semilla(9);
    if (dk) { ctx.fillStyle = "#FFFFFF"; const n = Math.round(c * 30); for (let i = 0; i < 30; i++) { const sx = x + r() * w, sy = y + r() * h * 0.6, s = 0.5 + r() * 0.8; if (i < n) { ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(t * 1.2 + i)); ctx.beginPath(); ctx.arc(sx, sy, s, 0, 6.3); ctx.fill(); } } ctx.globalAlpha = 1; }
    if (c >= 0.55 && sol) {
      const a = Math.min(1, (c - 0.55) / 0.35), [sx, sy] = sol; ctx.globalAlpha = a;
      if (dk) { ctx.fillStyle = "rgba(255,240,200,.12)"; ctx.beginPath(); ctx.arc(sx, sy, 20, 0, 6.3); ctx.fill(); ctx.fillStyle = "#F3E6C4"; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, 6.3); ctx.fill(); ctx.fillStyle = mezcla("#101C46", "#25397A", 0.25); ctx.beginPath(); ctx.arc(sx + 4.5, sy - 3, 8.6, 0, 6.3); ctx.fill(); }
      else { ctx.fillStyle = "rgba(255,214,107,.28)"; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 6.3); ctx.fill(); ctx.fillStyle = "#FFD66B"; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, 6.3); ctx.fill();
        ctx.strokeStyle = "rgba(255,214,107,.75)"; ctx.lineWidth = 2; ctx.lineCap = "round"; for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + t * 0.25; ctx.beginPath(); ctx.moveTo(sx + Math.cos(an) * 16, sy + Math.sin(an) * 16); ctx.lineTo(sx + Math.cos(an) * 20, sy + Math.sin(an) * 20); ctx.stroke(); } }
      ctx.globalAlpha = 1;
    }
    const n = c > 0.85 ? 1 : c > 0.6 ? 2 : c > 0.35 ? 4 : 6, col = dk ? `rgba(190,200,230,${0.16 + (1 - c) * 0.3})` : mezcla("#8C94A2", "#FFFFFF", c * 1.1);
    for (let i = 0; i < n; i++) { const s = (0.7 + r() * 0.6 + (1 - c) * 0.45) * Math.min(1.4, w / 300), cx = x + ((r() * (w + 60) + t * (3 + i)) % (w + 60)) - 30, cy = y + 14 + r() * Math.min(40, h * 0.3); nube(ctx, cx, cy, s, col); }
  }
  function flor(ctx, x, y, r, color) { ctx.fillStyle = color; for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283; ctx.beginPath(); ctx.ellipse(x + Math.cos(an) * r, y + Math.sin(an) * r, r * 0.85, r * 0.6, an, 0, 6.3); ctx.fill(); } ctx.fillStyle = "#F7C948"; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.3); ctx.fill(); }
  function hoja(ctx, x, y, s, dir, color) { ctx.fillStyle = color; ctx.save(); ctx.translate(x, y); ctx.rotate(dir * -0.6); ctx.beginPath(); ctx.ellipse(dir * s, 0, s, s * 0.45, 0, 0, 6.3); ctx.fill(); ctx.restore(); }
  /* Una maceta con su planta (de lado): t es lo que lleva hacia echar raíces. Devuelve dónde cae el agua */
  function maceta(ctx, x, y, k, t, color, dk, c, salto) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(0, 1, 14, 3, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = lg(ctx, -12, 0, 12, 0, [[0, "#E39A62"], [0.5, "#C4682F"], [1, "#8C3E18"]]); ctx.beginPath(); ctx.moveTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(9, 0); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#D27A45"; ctx.fillRect(-13.5, -21, 27, 5); ctx.fillStyle = "#5A3418"; ctx.beginPath(); ctx.ellipse(0, -21, 12, 2.4, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(-9, -15, 2.5, 12);
    const base = -21, verde = verdeDe(c, dk), verde2 = mezcla(verde, "#FFFFFF", 0.18), sy = 1 + (salto || 0) * 0.08;
    ctx.save(); ctx.translate(0, base); ctx.scale(1, sy); ctx.translate(0, -base);
    if (t < 0.15) { ctx.strokeStyle = verde; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(0, base - 6); ctx.stroke(); hoja(ctx, 0, base - 6, 3.6, -1, verde2); hoja(ctx, 0, base - 6, 3.6, 1, verde2); }
    else {
      const h = 10 + t * 46, pares = 1 + Math.floor(t * 5);
      ctx.strokeStyle = verde; ctx.lineWidth = 1.6 + t * 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, base); ctx.quadraticCurveTo(-3, base - h / 2, 0, base - h); ctx.stroke();
      for (let i = 0; i < pares; i++) { const yy = base - h * (0.25 + i * 0.65 / pares), s = 4 + t * 6 * (1 - i * 0.12); hoja(ctx, 0, yy, s, i % 2 ? 1 : -1, i % 2 ? verde : verde2); hoja(ctx, 0, yy - 2, s * 0.8, i % 2 ? -1 : 1, verde2); }
      if (t >= 0.62) { const n = Math.min(4, 1 + Math.floor((t - 0.62) * 9)), rr = 3 + t * 2.4; flor(ctx, 0, base - h - 2, rr, color); for (let i = 1; i < n; i++) flor(ctx, (i % 2 ? 1 : -1) * (6 + t * 6), base - h * (0.62 - i * 0.12), rr * 0.8, color); }
      else if (t >= 0.45) { ctx.fillStyle = mezcla(color, verde, 0.4); ctx.beginPath(); ctx.ellipse(0, base - h - 2, 2.6, 4, 0, 0, 6.3); ctx.fill(); }
    }
    ctx.restore(); ctx.restore();
    return { x, y: y - 21 * k, k };
  }
  /* Un árbol: con hojas (y flores si tu semana va bien) o sin hojas, si dejaste ese hábito */
  function arbol(ctx, x, y, s, dk, c, color, hojas) {
    const tronco = dk ? "#5E3D27" : "#8A5A36", verde = verdeDe(c, dk, dk ? "#2F7A52" : "#4FA463");
    ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 4 * s, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = tronco; ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.lineTo(x - 3 * s, y - 34 * s); ctx.lineTo(x + 3 * s, y - 34 * s); ctx.lineTo(x + 5 * s, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = tronco; ctx.lineCap = "round"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x, y - 26 * s); ctx.lineTo(x - 11 * s, y - 38 * s); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x + 10 * s, y - 42 * s); ctx.stroke();
    if (hojas === false) {
      ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(x, y - 34 * s); ctx.lineTo(x - 2 * s, y - 56 * s); ctx.moveTo(x - 11 * s, y - 38 * s); ctx.lineTo(x - 18 * s, y - 50 * s); ctx.moveTo(x - 11 * s, y - 38 * s); ctx.lineTo(x - 8 * s, y - 52 * s);
      ctx.moveTo(x + 10 * s, y - 42 * s); ctx.lineTo(x + 18 * s, y - 52 * s); ctx.moveTo(x + 10 * s, y - 42 * s); ctx.lineTo(x + 6 * s, y - 56 * s); ctx.moveTo(x - 2 * s, y - 50 * s); ctx.lineTo(x + 4 * s, y - 60 * s); ctx.stroke();
      ctx.fillStyle = dk ? "#7A5A3A" : "#C9965A"; [[-14, 2], [12, 1], [5, 3]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, 3 * s, 1.4 * s, 0.4, 0, 6.3); ctx.fill(); });
      return;
    }
    [[0, -54, 20], [-15, -44, 15], [15, -46, 16], [-6, -64, 14], [9, -62, 13]].forEach(([dx, dy, r], i) => { ctx.fillStyle = i % 2 ? verde : mezcla(verde, "#FFFFFF", 0.12); ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(x - 6 * s, y - 62 * s, 7 * s, 0, 6.3); ctx.fill();
    if (c > 0.7) { const r = semilla(Math.round(x * 7) + 1); ctx.fillStyle = color; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 34 * s, y - (40 + r() * 28) * s, 2.2 * s, 0, 6.3); ctx.fill(); } }
  }
  function mariposas(ctx, pts, t) { pts.forEach(([x, y, col], i) => { const a = Math.abs(Math.sin(t * 9 + i)) * 0.8 + 0.2, bx = x + Math.sin(t * 0.8 + i) * 10, by = y + Math.cos(t * 1.1 + i) * 5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(bx - 3 * a, by, 3.2 * a, 2.4, -0.4, 0, 6.3); ctx.ellipse(bx + 3 * a, by, 3.2 * a, 2.4, 0.4, 0, 6.3); ctx.fill(); ctx.fillStyle = "#2A2A2A"; ctx.fillRect(bx - 0.6, by - 2.4, 1.2, 4.8); }); }
  function elefanteCara(ctx, x, y, s) {
    ctx.fillStyle = PIEL_OSC; ctx.beginPath(); ctx.ellipse(x + 8 * s, y, 6 * s, 8 * s, 0.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = "#F0B3C1"; ctx.beginPath(); ctx.ellipse(x + 8.5 * s, y, 3.6 * s, 5.4 * s, 0.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = PIEL; ctx.beginPath(); ctx.arc(x, y, 9 * s, 0, 6.3); ctx.fill();
    ctx.strokeStyle = PIEL; ctx.lineWidth = 4.5 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - 6 * s, y + 3 * s); ctx.quadraticCurveTo(x - 12 * s, y + 10 * s, x - 9 * s, y + 14 * s); ctx.stroke();
    ctx.fillStyle = "#1B2436"; ctx.beginPath(); ctx.arc(x - 3 * s, y - 2 * s, 1.5 * s, 0, 6.3); ctx.fill();
    ctx.fillStyle = "rgba(240,179,193,.8)"; ctx.beginPath(); ctx.arc(x - 1 * s, y + 3.5 * s, 1.6 * s, 0, 6.3); ctx.fill();
  }
  /* El riego: la regadera inclinada sobre la maceta y las gotas */
  function regadera(ctx, p, t) {
    const d = t - riego.t0; if (d < 0 || d > 1.6) return;
    const k = p.k, x = p.x - 26 * k, y = p.y - 44 * k, a = Math.min(1, d / 0.25) * (d > 1.35 ? (1.6 - d) / 0.25 : 1);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y); ctx.rotate(0.55); ctx.scale(k, k);
    ctx.fillStyle = "#9AA4B8"; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(8, 10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#7D879B"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(22, -10); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 7, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-7, -6, 3, 14);
    ctx.restore(); ctx.globalAlpha = 1;
    if (d > 0.25 && d < 1.3) { ctx.fillStyle = "#5CC8E8"; for (let i = 0; i < 7; i++) { const f = ((d * 2.2 + i / 7) % 1), sx = x + 18 * k + Math.sin(i * 3) * 2, sy = y - 6 * k; ctx.beginPath(); ctx.ellipse(sx + (p.x - sx) * f * 0.5, sy + (p.y - sy) * f, 1.4 * k, 2.4 * k, 0, 0, 6.3); ctx.fill(); } }
  }
  function saltoDe(M, t) { if (!M || M.id !== riego.id) return 0; const d = t - riego.t0 - 0.6; return Math.max(0, Math.sin(d * 8)) * Math.max(0, 1 - d); }
  function plantar(ctx, pots, e, dk, t) {
    pots.forEach(([x, y, k], j) => { const M = e.macetas[j]; if (!M) return; const p = maceta(ctx, x, y, k, M.t, M.color, dk, e.c, saltoDe(M, t)); anotar(M, p); if (M.id === riego.id) regadera(ctx, p, t); });
  }
  /* -------- Días de descanso: dónde quedó cada maceta (al dibujar), la hamaquita y el letrero de vacaciones -------- */
  let POTS = [];
  function anotar(M, p) { if (M && p) POTS.push({ M, x: p.x, y: p.y, k: p.k }); }
  function hamaca(ctx, x, y, k, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.strokeStyle = OSC ? "#B08560" : "#8A5A36"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-12.5, -16); ctx.moveTo(11, 0); ctx.lineTo(12.5, -16); ctx.stroke();
    ctx.strokeStyle = OSC ? "#D9CBB0" : "#B9A27E"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-12.5, -15); ctx.lineTo(-9, -11.5); ctx.moveTo(12.5, -15); ctx.lineTo(9, -11.5); ctx.stroke();
    const vaiven = FIJA || QUIETO ? 0 : Math.sin(t * 1.6) * 0.9;
    ctx.beginPath(); ctx.moveTo(-9, -11.5); ctx.quadraticCurveTo(vaiven, -1, 9, -11.5); ctx.quadraticCurveTo(vaiven, -5.5, -9, -11.5); ctx.closePath();
    ctx.save(); ctx.clip();
    for (let i = -10; i < 10; i += 3) { ctx.fillStyle = (i / 3 | 0) % 2 ? "#F4AE3D" : "#E8606B"; ctx.fillRect(i, -14, 3, 14); }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 0.6; ctx.stroke();
    const z = FIJA || QUIETO ? 0 : (t * 0.5) % 1;
    ctx.fillStyle = OSC ? "rgba(225,230,245,.85)" : "rgba(40,48,80,.7)"; ctx.font = "800 6.5px Figtree, system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.globalAlpha = 1 - z * 0.6; ctx.fillText("z", 15 + z * 2, -18 - z * 4); ctx.font = "800 8.5px Figtree, system-ui, sans-serif"; ctx.fillText("z", 19 + z * 2, -25 - z * 4);
    ctx.globalAlpha = 1; ctx.restore();
  }
  function letrero(ctx, x, y, txt) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 2, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = OSC ? "#8F633B" : "#8A5A36"; ctx.fillRect(x - 1.3, y - 22, 2.6, 23);
    ctx.font = "700 13px Caveat, 'Segoe Print', cursive"; const w = Math.max(44, ctx.measureText(txt).width + 12);
    ctx.fillStyle = OSC ? "#E3D3B4" : "#F6E7C8"; ctx.strokeStyle = OSC ? "#6B4524" : "#9A6A3E"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 3, y - 38); ctx.lineTo(x + w / 2 - 3, y - 38); ctx.quadraticCurveTo(x + w / 2, y - 38, x + w / 2, y - 35); ctx.lineTo(x + w / 2, y - 23); ctx.quadraticCurveTo(x + w / 2, y - 20, x + w / 2 - 3, y - 20);
    ctx.lineTo(x - w / 2 + 3, y - 20); ctx.quadraticCurveTo(x - w / 2, y - 20, x - w / 2, y - 23); ctx.lineTo(x - w / 2, y - 35); ctx.quadraticCurveTo(x - w / 2, y - 38, x - w / 2 + 3, y - 38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4A2E16"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x, y - 28.5);
    ctx.restore();
  }
  /* Dónde se clava el letrero en cada estilo (un lugar despejado, cerca de las macetas) */
  const LETRERO = { entrada: [274, 214], ventana: [58, 167], terrario: [90, 236], pixeles: [252, 236], sur: [214, 196], marte: [292, 256], luna: [336, 250] };
  function descansos(ctx, W, H, e, t, estilo) {
    POTS.forEach(p => { if (p.M.descansa) hamaca(ctx, p.x, p.y, p.k, t); });
    if (!e.vuelve) return;
    const d = new Date(e.vuelve + "T12:00:00"), [x, y] = LETRERO[estilo] || [W - 40, H - 6];
    letrero(ctx, x, y, "Vuelvo el " + d.getDate());
  }

  /* -------- La entrada (viene con Rumbo) -------- */
  function entrada(ctx, W, H, e, t, dk) {
    cielo(ctx, 0, 0, W, H, e.c, dk, t, [56, 34]);
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#24503E" : "#A6D89A"); ctx.beginPath(); ctx.moveTo(0, 128); ctx.bezierCurveTo(70, 104, 140, 126, 200, 112); ctx.bezierCurveTo(250, 100, 300, 112, W, 108); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    const A = ultimos(e), n = A.length, s = n <= 3 ? 0.78 : n <= 5 ? 0.66 : 0.55;
    A.forEach((a, i) => arbol(ctx, n === 1 ? 70 : 18 + i * (136 / Math.max(1, n - 1)), 152 - (i % 2) * 6, s * (0.92 + (i % 3) * 0.06) * brota(a, t), dk, e.c, a.color, a.hojas));
    ctx.fillStyle = dk ? "#6B5640" : "#D9B88E"; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 144); ctx.lineTo(168, 144); ctx.moveTo(0, 152); ctx.lineTo(168, 152); ctx.stroke();
    for (let x = 6; x < 168; x += 16) { ctx.beginPath(); ctx.moveTo(x - 2.5, 160); ctx.lineTo(x - 2.5, 138); ctx.lineTo(x, 135); ctx.lineTo(x + 2.5, 138); ctx.lineTo(x + 2.5, 160); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = dk ? "#4C4660" : "#F1E6D3"; ctx.fillRect(172, 80, 132, 100);
    ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(172, 80, 132, 8);
    ctx.fillStyle = dk ? "#5E3D27" : "#8A5A36"; ctx.fillRect(278, 32, 12, 28);
    ctx.fillStyle = dk ? "#A64B5E" : "#E8606B"; ctx.beginPath(); ctx.moveTo(162, 84); ctx.lineTo(238, 38); ctx.lineTo(314, 84); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(162 + i * 9, 84 - i * 5.4); ctx.lineTo(314 - i * 9, 84 - i * 5.4); ctx.stroke(); }
    ctx.fillStyle = dk ? "#FFD98A" : "#CDEBFB"; ctx.fillRect(184, 98, 32, 28);
    ctx.save(); ctx.beginPath(); ctx.rect(184, 98, 32, 28); ctx.clip(); elefanteCara(ctx, 200, 116, 1); ctx.restore();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.4; ctx.strokeRect(184, 98, 32, 28);
    ctx.fillStyle = dk ? "#6B5640" : "#C9A37A"; ctx.fillRect(181, 126, 38, 4);
    ctx.fillStyle = dk ? "#FFD98A" : "#CDEBFB"; ctx.fillRect(266, 98, 26, 28); ctx.fillStyle = rgba("#E8606B", 0.75); ctx.beginPath(); ctx.moveTo(266, 98); ctx.quadraticCurveTo(276, 110, 270, 126); ctx.lineTo(266, 126); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.4; ctx.strokeRect(266, 98, 26, 28);
    ctx.fillStyle = dk ? "#3A2A20" : "#9A6A3E"; ctx.beginPath(); ctx.moveTo(228, 180); ctx.lineTo(228, 142); ctx.arc(241, 142, 13, Math.PI, 0); ctx.lineTo(254, 180); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#F4AE3D"; ctx.beginPath(); ctx.arc(249, 162, 1.8, 0, 6.3); ctx.fill();
    ctx.fillStyle = dk ? "#5A5E6E" : "#C9CDD6"; ctx.fillRect(222, 180, 38, 6); ctx.fillStyle = dk ? "#4A4E5E" : "#B7BCC6"; ctx.fillRect(216, 186, 50, 6);
    ctx.fillStyle = lg(ctx, 0, 176, 0, H, [[0, verdeDe(e.c, dk, dk ? "#2C5A40" : "#A2D88C")], [1, verdeDe(e.c, dk, dk ? "#1C3A2A" : "#6FB463")]]);
    ctx.beginPath(); ctx.moveTo(0, 168); ctx.quadraticCurveTo(110, 160, 216, 186); ctx.lineTo(266, 192); ctx.lineTo(W, 186); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = dk ? "#5A5E6E" : "#D9DCE3"; [[236, 198, 14, 4], [226, 210, 15, 4.5]].forEach(([x, y, rx, ry]) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); });
    const r = semilla(4); ctx.strokeStyle = verdeDe(e.c, dk, dk ? "#3E7A55" : "#5FA556"); ctx.lineWidth = 1.2; ctx.lineCap = "round";
    for (let i = 0; i < 22; i++) { const x = r() * W, y = 180 + r() * 38; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 5); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 6); ctx.stroke(); }
    plantar(ctx, [[70, 208, 1.05], [120, 206, 1.05], [170, 204, 1.05]], e, dk, t);
    if (e.c > 0.8) mariposas(ctx, [[96, 150, "#F28CB0"], [150, 140, "#FFD24A"]], t);
  }

  /* -------- La ventana -------- */
  function ventana(ctx, W, H, e, t, dk) {
    ctx.fillStyle = dk ? "#2C2A44" : "#EFE6F4"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = dk ? "#25233A" : "#E4D8EC"; ctx.fillRect(0, 196, W, H - 196); ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(0, 196, W, 3);
    const X0 = 62, X1 = 258, Y0 = 24, Y1 = 166;
    ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    cielo(ctx, X0, Y0, X1 - X0, Y1 - Y0, e.c, dk, t, [X1 - 34, Y0 + 26]);
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#24503E" : "#A6D89A"); ctx.beginPath(); ctx.moveTo(X0, 128); ctx.bezierCurveTo(120, 112, 180, 130, X1, 118); ctx.lineTo(X1, Y1); ctx.lineTo(X0, Y1); ctx.fill();
    const A = ultimos(e), n = A.length;
    A.forEach((a, i) => arbol(ctx, n === 1 ? 130 : X0 + 18 + i * ((X1 - X0 - 36) / Math.max(1, n - 1)), 144 + (i % 2) * 4, 0.5 * brota(a, t), dk, e.c, a.color, a.hojas));
    ctx.fillStyle = dk ? "#6B5640" : "#D9B88E"; for (let x = X0 + 4; x < X1; x += 12) ctx.fillRect(x, 142, 2.4, 14); ctx.fillRect(X0, 146, X1 - X0, 2);
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#2C5A40" : "#9FD48A"); ctx.fillRect(X0, 154, X1 - X0, 12);
    if (e.c > 0.8) mariposas(ctx, [[110, 112, "#F28CB0"], [200, 104, "#FFD24A"]], t);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(X0 + 20, Y1 - 10); ctx.lineTo(X0 + 70, Y0 + 10); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X0 + 36, Y1 - 10); ctx.lineTo(X0 + 82, Y0 + 20); ctx.stroke();
    ctx.strokeStyle = dk ? "#D8D4E6" : "#FFFFFF"; ctx.lineWidth = 8; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo((X0 + X1) / 2, Y0); ctx.lineTo((X0 + X1) / 2, Y1); ctx.moveTo(X0, Y0 + 58); ctx.lineTo(X1, Y0 + 58); ctx.stroke();
    if (dk) { ctx.fillStyle = rg(ctx, 20, 30, 0, 120, [[0, "rgba(255,210,140,.22)"], [1, "rgba(255,210,140,0)"]]); ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = dk ? "#3A3560" : "#D9CCE6"; ctx.beginPath(); ctx.ellipse(160, 222, 118, 14, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = dk ? "#4E4785" : "#C4B4D8"; ctx.lineWidth = 3; [0.78, 0.55].forEach(f => { ctx.beginPath(); ctx.ellipse(160, 222, 118 * f, 14 * f, 0, 0, 6.3); ctx.stroke(); });
    if (!dk && e.c > 0.6) { ctx.fillStyle = `rgba(255,244,214,${0.5 * (e.c - 0.6) / 0.4})`; ctx.beginPath(); ctx.moveTo(84, 204); ctx.lineTo(236, 204); ctx.lineTo(224, 232); ctx.lineTo(60, 232); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#E4D8EC"; ctx.fillRect(156, 204, 6, 28); }
    if (dk) { ctx.fillStyle = "rgba(255,217,138,.08)"; ctx.beginPath(); ctx.ellipse(160, 222, 80, 9, 0, 0, 6.3); ctx.fill(); }
    const cort = (x, dir) => { ctx.fillStyle = lg(ctx, x, 0, x + dir * 40, 0, [[0, dk ? "#6A5BA8" : "#9AA6FF"], [1, dk ? "#4E4385" : "#7C89F2"]]); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + dir * 40, 14); ctx.quadraticCurveTo(x + dir * 24, 90, x + dir * 34, 178); ctx.lineTo(x, 178); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1.2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + dir * i * 9, 16); ctx.quadraticCurveTo(x + dir * i * 6, 90, x + dir * i * 8, 176); ctx.stroke(); } };
    cort(34, 1); cort(286, -1);
    ctx.fillStyle = dk ? "#8A7F9E" : "#B9AEC8"; ctx.fillRect(26, 10, 268, 5);
    ctx.fillStyle = dk ? "#8A6A4A" : "#E2C9A6"; ctx.fillRect(40, 166, 240, 10); ctx.fillStyle = dk ? "#6B5038" : "#C9A982"; ctx.fillRect(40, 176, 240, 5);
    ctx.fillStyle = "#9AA4B8"; ctx.beginPath(); ctx.moveTo(250, 150); ctx.lineTo(268, 150); ctx.lineTo(266, 166); ctx.lineTo(252, 166); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#7D879B"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(252, 156); ctx.lineTo(240, 148); ctx.stroke(); ctx.beginPath(); ctx.arc(259, 150, 6, Math.PI, 0); ctx.stroke();
    const m = e.macetas.length, xs = m === 1 ? [160] : m === 2 ? [130, 190] : [110, 160, 210];
    plantar(ctx, xs.map(x => [x, 168, 1.3]), e, dk, t);
  }

  /* -------- El terrario: las macetas en el escritorio; los árboles, en el frasco -------- */
  function terrario(ctx, W, H, e, t, dk) {
    ctx.fillStyle = dk ? "#262840" : "#F3EBDD"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = dk ? "rgba(255,255,255,.03)" : "rgba(120,90,60,.05)"; for (let x = 4; x < W; x += 18) ctx.fillRect(x, 0, 7, 178);
    const X0 = 18, Y0 = 16, X1 = 122, Y1 = 112;
    ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
    cielo(ctx, X0, Y0, X1 - X0, Y1 - Y0, e.c, dk, t, [X1 - 26, Y0 + 24]);
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#24503E" : "#A6D89A"); ctx.beginPath(); ctx.moveTo(X0, 96); ctx.quadraticCurveTo(70, 84, X1, 94); ctx.lineTo(X1, Y1); ctx.lineTo(X0, Y1); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = dk ? "#D8D4E6" : "#FFFFFF"; ctx.lineWidth = 6; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo((X0 + X1) / 2, Y0); ctx.lineTo((X0 + X1) / 2, Y1); ctx.stroke();
    if (dk) { ctx.fillStyle = rg(ctx, 300, 10, 0, 220, [[0, "rgba(255,210,140,.20)"], [1, "rgba(255,210,140,0)"]]); ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = dk ? "#5A4030" : "#C99A6A"; ctx.fillRect(0, 176, W, 16);
    ctx.fillStyle = dk ? "#3E2C20" : "#A87B4F"; ctx.fillRect(0, 192, W, H - 192);
    ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 1; [182, 188, 206, 222].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(100, y - 2, 200, y + 2, W, y); ctx.stroke(); });
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(0, 176, W, 2);
    const cx = 222, top = 50, bot = 186, rx = 66;
    const frasco = () => { ctx.beginPath(); ctx.moveTo(cx - 36, top + 10); ctx.lineTo(cx - 36, top + 22); ctx.quadraticCurveTo(cx - rx, top + 28, cx - rx, top + 58); ctx.lineTo(cx - rx, bot - 12); ctx.quadraticCurveTo(cx - rx, bot, cx - rx + 12, bot); ctx.lineTo(cx + rx - 12, bot); ctx.quadraticCurveTo(cx + rx, bot, cx + rx, bot - 12); ctx.lineTo(cx + rx, top + 58); ctx.quadraticCurveTo(cx + rx, top + 28, cx + 36, top + 22); ctx.lineTo(cx + 36, top + 10); ctx.closePath(); };
    ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.beginPath(); ctx.ellipse(cx + 6, bot + 1, rx + 4, 5, 0, 0, 6.3); ctx.fill();
    ctx.save(); frasco(); ctx.fillStyle = dk ? "rgba(150,180,230,.10)" : "rgba(210,236,246,.5)"; ctx.fill(); ctx.clip();
    const r = semilla(21);
    ctx.fillStyle = dk ? "#5A5E70" : "#B9BCC6"; ctx.fillRect(cx - rx, bot - 12, rx * 2, 12);
    for (let i = 0; i < 44; i++) { ctx.fillStyle = r() > 0.5 ? (dk ? "#6E7284" : "#D3D6DE") : (dk ? "#45495A" : "#9DA1AD"); ctx.beginPath(); ctx.ellipse(cx - rx + r() * rx * 2, bot - 2 - r() * 9, 2.4, 1.8, 0, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = dk ? "#1E1A1A" : "#3A302C"; ctx.fillRect(cx - rx, bot - 18, rx * 2, 6);
    ctx.fillStyle = dk ? "#4A3020" : "#7A4E2E"; ctx.fillRect(cx - rx, bot - 38, rx * 2, 20);
    const suelo = bot - 38;
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#2F6E48" : "#6DBA5E"); ctx.beginPath(); ctx.moveTo(cx - rx, suelo + 6); for (let x = cx - rx; x < cx + rx; x += 8) ctx.quadraticCurveTo(x + 4, suelo - 5, x + 8, suelo + 1); ctx.lineTo(cx + rx, suelo + 8); ctx.lineTo(cx - rx, suelo + 8); ctx.fill();
    const A = ultimos(e), n = A.length;
    if (n < 6) [[cx - rx + 14, suelo + 2], [cx + rx - 16, suelo + 3]].forEach(([x, y]) => { ctx.fillStyle = "#F4EFE6"; ctx.fillRect(x - 1, y - 6, 2, 6); ctx.fillStyle = "#E8606B"; ctx.beginPath(); ctx.arc(x, y - 6, 4, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(x - 1.5, y - 8, 0.9, 0, 6.3); ctx.fill(); });
    const s = n <= 2 ? 0.62 : n <= 4 ? 0.52 : 0.44, filas = n > 4 ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n, 0];
    let k = 0;
    filas.forEach((cant, f) => { const paso = (rx * 2 - 34) / Math.max(1, cant); for (let i = 0; i < cant; i++, k++) { const a = A[k]; arbol(ctx, cx + (i - (cant - 1) / 2) * paso + (n > 4 ? (f ? 0.25 : -0.25) * paso : 0), suelo + 3 + f * 9, s * brota(a, t), dk, e.c, a.color, a.hojas); } });
    if (dk && e.c > 0.5) for (let i = 0; i < 6; i++) { const x = cx + Math.sin(t * 0.7 + i * 2.1) * rx * 0.7, y = top + 74 + Math.cos(t * 0.9 + i) * 26, a = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.fillStyle = rg(ctx, x, y, 0, 7, [[0, `rgba(255,236,140,${0.8 * a})`], [1, "rgba(255,236,140,0)"]]); ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.3); ctx.fill(); }
    if (e.c < 0.55) { const r2 = semilla(33), a = Math.min(0.75, (0.55 - e.c) * 2.2); ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ctx.fillRect(cx - rx, top, rx * 2, bot - top); ctx.fillStyle = `rgba(255,255,255,${a})`; for (let i = 0; i < 34; i++) { ctx.beginPath(); ctx.ellipse(cx - rx + 6 + r2() * (rx * 2 - 12), top + 34 + r2() * (bot - top - 70), 1.4, 1.9, 0, 0, 6.3); ctx.fill(); } }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx - rx + 9, top + 66); ctx.lineTo(cx - rx + 9, bot - 26); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - rx + 17, top + 60); ctx.lineTo(cx - rx + 17, top + 84); ctx.stroke();
    frasco(); ctx.strokeStyle = dk ? "rgba(200,215,240,.5)" : "rgba(110,140,160,.55)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = dk ? "rgba(200,215,240,.25)" : "rgba(110,140,160,.25)"; ctx.fillRect(cx - 38, top + 8, 76, 6);
    ctx.fillStyle = dk ? "#9A7A50" : "#C9A06A"; ctx.beginPath(); ctx.moveTo(cx - 32, top + 12); ctx.lineTo(cx - 30, top - 8); ctx.lineTo(cx + 30, top - 8); ctx.lineTo(cx + 32, top + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dk ? "#B4946A" : "#DDBA86"; ctx.beginPath(); ctx.ellipse(cx, top - 8, 30, 4, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = "rgba(90,60,30,.35)"; const r3 = semilla(7); for (let i = 0; i < 16; i++) ctx.fillRect(cx - 28 + r3() * 56, top - 4 + r3() * 14, 1.6, 1.6);
    ctx.strokeStyle = dk ? "#B4946A" : "#8A6A44"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + 30, top + 16); ctx.quadraticCurveTo(cx + 44, top + 22, cx + 50, top + 30); ctx.stroke();
    ctx.save(); ctx.translate(cx + 52, top + 40); ctx.rotate(0.16); ctx.fillStyle = dk ? "#CDB48C" : "#E8D2A8"; ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(30, -10); ctx.lineTo(30, 10); ctx.lineTo(-6, 10); ctx.lineTo(-12, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#5A3A1A"; ctx.font = "700 14px Caveat, cursive"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("raíces", 10, 1); ctx.restore();
    plantar(ctx, [[36, 186, 0.92], [78, 186, 0.92], [120, 186, 0.92]], e, dk, t);
  }

  /* -------- En píxeles -------- */
  const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
  const ARBOL_P = ["..ggg..", ".gLggg.", "gLggggg", "gggggGd", "ggggGdd", ".ggGdd.", "...t...", "...t...", "...t..."];
  const ARBOL_P_SECO = [".t...t.", "..t.t..", "t..t..t", ".t.t.t.", "..ttt..", "...t...", "...t...", "...t...", "...t..."];
  function pixeles(ctx, W, H, e, t, dk) {
    const P = 4, GW = 80, px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) * P, Math.round(y) * P, w * P, h * P); };
    const a = dk ? mezcla("#1A1C38", "#121A44", e.c) : mezcla("#7E8898", "#3C9BE0", e.c), b = dk ? mezcla("#363A58", "#2C3C7A", e.c) : mezcla("#BCC2CC", "#A8DCF8", e.c);
    for (let i = 0; i < 6; i++) px(0, i * 6, GW, 6, mezcla(a, b, i / 5));
    if (dk) { const r = semilla(3), nn = Math.round(e.c * 22); for (let i = 0; i < 22; i++) { const x = r() * GW, y = r() * 24; if (i < nn && ((t * 2 + i) | 0) % 4) px(x, y, 1, 1, "#FFFFFF"); } }
    if (e.c >= 0.55) { const sx = 66, sy = 4, c = dk ? "#F3E6C4" : "#FFD24A"; px(sx + 1, sy, 4, 1, c); px(sx, sy + 1, 6, 4, c); px(sx + 1, sy + 5, 4, 1, c);
      if (dk) { const fondo = y => mezcla(a, b, Math.floor(y / 6) / 5); px(sx + 2, sy, 3, 1, fondo(sy)); for (let y = sy + 1; y < sy + 5; y++) px(sx + 3, y, 3, 1, fondo(y)); px(sx + 3, sy + 5, 2, 1, fondo(sy + 5)); }
      else { px(sx + 1, sy + 1, 2, 1, "#FFF1B0"); px(sx - 2, sy + 2, 1, 2, c); px(sx + 7, sy + 2, 1, 2, c); px(sx + 2, sy - 2, 2, 1, c); px(sx + 2, sy + 7, 2, 1, c); } }
    const nn = e.c > 0.85 ? 1 : e.c > 0.6 ? 2 : e.c > 0.35 ? 3 : 4, nubeC = dk ? `rgba(200,206,230,${0.25 + (1 - e.c) * 0.3})` : mezcla("#8C94A2", "#FFFFFF", e.c);
    for (let i = 0; i < nn; i++) { const x = ((i * 23 + t * (1.2 + i * 0.5)) % 100) - 12, y = 3 + (i * 5) % 14; px(x + 2, y, 4, 1, nubeC); px(x + 1, y + 1, 7, 1, nubeC); px(x, y + 2, 9, 2, nubeC); }
    const cerro = dk ? "#22403A" : verdeDe(e.c, dk, "#6FB86A");
    for (let x = 0; x < GW; x++) { const hy = Math.round(30 + 2.5 * Math.sin(x / 6) + 1.5 * Math.sin(x / 2.7)); px(x, hy, 1, 37 - hy, cerro); }
    const g1 = verdeDe(e.c, dk, dk ? "#2E5A3E" : "#86CC6E"), g2 = verdeDe(e.c, dk, dk ? "#3A6A4A" : "#9EDA84");
    px(0, 36, GW, 24, g1); const r = semilla(4); for (let i = 0; i < 110; i++) px(r() * GW, 37 + r() * 23, 1, 1, g2);
    px(65, 41, 3, 19, dk ? "#5A4E40" : "#D9B98A"); for (let y = 42; y < 60; y += 3) px(65 + (y % 2), y, 1, 1, dk ? "#4A4034" : "#C4A272");
    const verde = verdeDe(e.c, dk, dk ? "#2F7A52" : "#3E9C57"), CL = { g: verde, L: mezcla(verde, "#FFFFFF", 0.3), G: mezcla(verde, "#000000", 0.1), d: mezcla(verde, "#000000", 0.25), t: dk ? "#5E3D27" : "#8A5A36" };
    ultimos(e).forEach((ar, i) => { if (brota(ar, t) < 0.5) return; const x = 1 + i * 7, y = 28 + (i % 2), sp = ar.hojas === false ? ARBOL_P_SECO : ARBOL_P;
      sp.forEach((row, yy) => [...row].forEach((ch, xx) => { if (CL[ch]) px(x + xx, y + yy, 1, 1, CL[ch]); }));
      if (ar.hojas !== false && e.c > 0.7) { px(x + 2, y + 2, 1, 1, ar.color); px(x + 5, y + 3, 1, 1, ar.color); } });
    const cerca = dk ? "#6B5640" : "#E0C09A"; px(0, 40, 56, 1, cerca); for (let x = 1; x < 56; x += 4) px(x, 38, 1, 4, cerca);
    const techo = dk ? "#A64B5E" : "#E8606B"; for (let k = 0; k < 6; k++) px(65 - 2 * k, 22 + k, 4 * k + 2, 1, techo);
    px(70, 20, 2, 3, dk ? "#5E3D27" : "#8A5A36"); px(57, 28, 18, 13, dk ? "#4C4660" : "#F1E6D3");
    const vent = dk ? "#FFD98A" : "#CDEBFB"; px(59, 31, 3, 3, vent); px(70, 31, 3, 3, vent); px(64, 34, 4, 7, dk ? "#3A2A20" : "#9A6A3E"); px(67, 37, 1, 1, "#F4AE3D");
    const d = t - riego.t0;
    [10, 21, 32].forEach((x, j) => {
      const M = e.macetas[j]; if (!M) return;
      anotar(M, { x: (x + 3) * P, y: 50 * P, k: 0.95 });
      const y = 56, riega = M.id === riego.id, sube = riega && d > 0.6 && d < 1.2 && ((d * 10) | 0) % 2 ? 1 : 0, yb = y - sube;
      px(x - 1, y + 1, 8, 1, "rgba(0,0,0,.18)"); px(x, y - 5, 6, 1, "#D27A45"); px(x + 1, y - 4, 4, 4, "#C4682F"); px(x + 4, y - 4, 1, 4, "#8C3E18"); px(x + 1, y - 6, 4, 1, "#5A3418");
      const tal = dk ? "#3FA36A" : "#3E9C57", hj = mezcla(tal, "#FFFFFF", 0.25), col = M.color, tt = M.t;
      if (tt < 0.15) { px(x + 2, yb - 7, 1, 1, tal); px(x + 3, yb - 8, 1, 1, hj); }
      else if (tt < 0.45) { px(x + 2, yb - 9, 1, 3, tal); px(x + 1, yb - 9, 1, 1, hj); px(x + 3, yb - 10, 1, 1, hj); }
      else { const hh = tt < 0.62 ? 6 : 8; px(x + 2, yb - 6 - hh, 1, hh, tal); px(x, yb - 9, 2, 1, hj); px(x + 3, yb - 11, 2, 1, hj); px(x + 1, yb - 13, 1, 1, hj);
        if (tt < 0.62) px(x + 2, yb - 13, 1, 1, mezcla(col, tal, 0.4)); else { px(x + 1, yb - 15, 3, 1, col); px(x + 2, yb - 16, 1, 3, col); px(x + 2, yb - 15, 1, 1, "#FFD24A"); if (tt > 0.8) { px(x + 4, yb - 11, 1, 1, col); px(x, yb - 12, 1, 1, col); } } }
      if (riega && d > 0 && d < 1.6) { px(x + 5, y - 22, 4, 3, "#9AA4B8"); px(x + 3, y - 22, 2, 1, "#7D879B"); px(x + 6, y - 23, 2, 1, "#7D879B"); for (let k = 0; k < 3; k++) px(x + 2 + (k % 2), y - 20 + ((d * 14 + k * 3) % 8), 1, 1, "#5CC8E8"); }
    });
    { const x = 42, y = 56, f = QUIETO ? 0 : ((t * 2) | 0) % 2; px(x + 3, y - 7, 7, 5, PIEL); px(x + 4, y - 8, 5, 1, PIEL); px(x + 1, y - 7, 4, 4, PIEL); px(x + 3, y - 8, 3, 4, PIEL_OSC); px(x + 2, y - 6, 1, 1, "#1B2436"); px(x, y - 4, 1, 2 + f, PIEL); px(x + 1, y - 4, 1, 1, PIEL); px(x + 4, y - 2, 2, 2, PIEL); px(x + 7, y - 2, 2, 2, PIEL); px(x + 10, y - 6, 1, 2, PIEL_OSC); px(x + 2, y, 9, 1, "rgba(0,0,0,.15)"); }
    if (e.c > 0.8) [[24, 44], [50, 34]].forEach(([x, y], i) => { const bx = x + Math.sin(t * 0.8 + i) * 4, by = y + Math.cos(t + i) * 2, w = ((t * 6 + i) | 0) % 2 ? 2 : 1, c = i ? "#FFD24A" : "#F28CB0"; px(bx - w, by, w, 1, c); px(bx + 1, by, w, 1, c); });
    if (e.c < 0.35) for (let i = 0; i < 30; i++) px((i * 37) % GW, (i * 13 + t * 24) % 60, 1, 2, "rgba(150,190,240,.7)");
    // el marcador: brotes en maceta y árboles
    const num = (v, x, y) => { String(Math.min(99, v)).split("").forEach((ch, k) => { const s = DIG[+ch]; for (let i = 0; i < 15; i++) if (s[i] === "1") px(x + k * 4 + i % 3, y + ((i / 3) | 0), 1, 1, "#FFFFFF"); }); };
    const nArb = (e.arboles || []).length, ancho = 24 + (nArb > 9 ? 4 : 0);
    px(1, 1, ancho, 8, "rgba(10,14,30,.55)");
    px(4, 3, 1, 5, "#7FD39B"); px(2, 4, 2, 1, "#7FD39B"); px(5, 3, 2, 1, "#7FD39B"); num(e.macetas.length, 8, 3);
    px(13, 3, 3, 3, "#7FD39B"); px(14, 6, 1, 2, "#C9A06A"); num(nArb, 18, 3);
  }

  /* -------- El sur: lago, volcán, araucarias, cabaña y muelle -------- */
  function araucaria(ctx, x, y, s, dk, c, hojas) {
    let verde = verdeDe(c, dk, dk ? "#245E44" : "#3E7E4E");
    if (hojas === false) verde = mezcla(verde, dk ? "#5A4A3A" : "#A08A68", 0.7);
    const osc = mezcla(verde, "#0E2A1C", 0.3);
    ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.beginPath(); ctx.ellipse(x, y, 10 * s, 2.4 * s, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = dk ? "#5E4636" : "#8C6A50"; ctx.fillRect(x - 1.6 * s, y - 50 * s, 3.2 * s, 50 * s);
    for (let k = 0; k < 2; k++) { const yy = y - (30 + k * 8) * s, w = (12 + k * 3) * s; ctx.strokeStyle = osc; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(x - w, yy - 4 * s); ctx.quadraticCurveTo(x - w * 0.5, yy + 2 * s, x, yy); ctx.quadraticCurveTo(x + w * 0.5, yy + 2 * s, x + w, yy - 4 * s); ctx.stroke(); if (hojas !== false) { ctx.fillStyle = verde; [-1, 1].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx * w, yy - 4 * s, 2.8 * s, 0, 6.3); ctx.fill(); }); } }
    ctx.fillStyle = verde; ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 46 * s); ctx.quadraticCurveTo(x - 18 * s, y - 62 * s, x, y - 64 * s); ctx.quadraticCurveTo(x + 18 * s, y - 62 * s, x + 20 * s, y - 46 * s);
    for (let i = 0; i < 5; i++) { const x0 = x + 20 * s - i * 8 * s; ctx.quadraticCurveTo(x0 - 4 * s, y - 40 * s, x0 - 8 * s, y - 46 * s); }
    ctx.closePath(); ctx.fill();
    if (hojas !== false) { ctx.fillStyle = mezcla(verde, "#FFFFFF", 0.16); ctx.beginPath(); ctx.ellipse(x - 6 * s, y - 57 * s, 8 * s, 3.5 * s, -0.15, 0, 6.3); ctx.fill(); }
  }
  function humo(ctx, x, y, t, k, dk) { for (let i = 0; i < 5; i++) { const f = ((t * 0.15 + i / 5) % 1); ctx.fillStyle = dk ? `rgba(200,206,230,${(1 - f) * 0.3})` : `rgba(255,255,255,${(1 - f) * 0.55})`; ctx.beginPath(); ctx.arc(x + f * 34 * k, y - f * 24 * k, (3 + f * 7) * k, 0, 6.3); ctx.fill(); } }
  function sur(ctx, W, H, e, t, dk) {
    cielo(ctx, 0, 0, W, H, e.c, dk, t, [66, 34]);
    if (!dk && e.c >= 0.88) { ctx.lineWidth = 3; ["#FF6B6B", "#FFB347", "#FFE066", "#7ED957", "#5CC8E8", "#9AA6FF"].forEach((c, i) => { ctx.strokeStyle = rgba(c, 0.32); ctx.beginPath(); ctx.arc(150, 160, 112 - i * 3, Math.PI * 1.1, Math.PI * 1.62); ctx.stroke(); }); }
    ctx.fillStyle = dk ? "#2E3554" : mezcla("#8E9BB8", "#A7AEBC", 1 - e.c); ctx.beginPath(); ctx.moveTo(0, 126); [[0, 100], [50, 86], [100, 98], [150, 88], [190, 104], [410, 104], [440, 86], [480, 96], [480, 126]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
    const vx = 300, vy = 32, volc = dk ? "#353D5E" : mezcla("#5B6C92", "#8A93A6", 1 - e.c), nieve = dk ? "#C8CEE0" : "#FFFFFF";
    const cono = () => { ctx.beginPath(); ctx.moveTo(150, 126); ctx.lineTo(vx - 14, vy); ctx.quadraticCurveTo(vx, vy - 3, vx + 14, vy); ctx.lineTo(450, 126); ctx.closePath(); };
    const nevado = () => { ctx.beginPath(); [[vx - 14, vy], [217, 80], [228, 76], [240, 86], [254, 78], [268, 90], [282, 80], [298, 92], [312, 80], [326, 90], [340, 78], [354, 86], [370, 76], [383, 80], [vx + 14, vy]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.quadraticCurveTo(vx, vy - 3, vx - 14, vy); ctx.fill(); };
    ctx.fillStyle = volc; cono(); ctx.fill(); ctx.fillStyle = nieve; nevado();
    ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.moveTo(vx + 2, vy); ctx.lineTo(450, 126); ctx.lineTo(vx + 40, 126); ctx.closePath(); ctx.fill();
    humo(ctx, vx + 2, vy - 4, t, 1, dk);
    ctx.fillStyle = dk ? "#1C3A2E" : verdeDe(e.c, dk, "#3F7A52"); ctx.fillRect(0, 122, W, 8); for (let x = 0; x < W; x += 7) { const h = 7 + ((x * 13) % 7); ctx.beginPath(); ctx.moveTo(x - 4, 124); ctx.lineTo(x, 124 - h); ctx.lineTo(x + 4, 124); ctx.fill(); }
    const lago = dk ? mezcla("#1A2440", "#162C60", e.c) : mezcla("#7F95A8", "#3B8EC4", e.c);
    ctx.fillStyle = lg(ctx, 0, 128, 0, H, [[0, mezcla(lago, "#FFFFFF", 0.15)], [1, lago]]); ctx.fillRect(0, 128, W, H - 128);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 128, W, H - 128); ctx.clip(); ctx.globalAlpha = 0.2; ctx.translate(0, 2 * 128); ctx.scale(1, -1); ctx.fillStyle = volc; cono(); ctx.fill(); ctx.fillStyle = nieve; nevado(); ctx.restore(); ctx.globalAlpha = 1;
    ctx.strokeStyle = dk ? "rgba(200,210,240,.25)" : "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2; for (let i = 0; i < 12; i++) { const x = (i * 61 + t * 5) % W, y = 136 + (i * 17) % 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y); ctx.stroke(); }
    if (e.c > 0.75) { const x = 190 + (QUIETO ? 0 : Math.sin(t * 0.25) * 16), y = 142; ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.ellipse(x, y, 9, 3.6, 0, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.quadraticCurveTo(x - 12, y - 4, x - 7, y - 2); ctx.fill(); ctx.strokeStyle = "#1E2433"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + 6, y - 2); ctx.quadraticCurveTo(x + 10, y - 10, x + 7, y - 14); ctx.stroke(); ctx.fillStyle = "#E8606B"; ctx.beginPath(); ctx.arc(x + 5.4, y - 14, 1.4, 0, 6.3); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.ellipse(x, y + 5, 9, 2, 0, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = verdeDe(e.c, dk, dk ? "#24503E" : "#8DC77A"); ctx.beginPath(); ctx.moveTo(176, H); ctx.lineTo(196, 166); ctx.bezierCurveTo(240, 156, 300, 162, 360, 156); ctx.bezierCurveTo(410, 152, 450, 156, W, 152); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    const A = ultimos(e), n = A.length; A.forEach((a, i) => araucaria(ctx, 302 + (i - (n - 1) / 2) * 21, 166 + (i % 2) * 4, 0.8 * brota(a, t), dk, e.c, a.hojas));
    { const x0 = 398, cw = 66, cb = 164, ch = 26;
      ctx.fillStyle = dk ? "#5A4A3A" : "#E2A94A"; ctx.fillRect(x0, cb - ch, cw, ch);
      ctx.strokeStyle = "rgba(0,0,0,.16)"; ctx.lineWidth = 1; for (let yy = cb - ch + 4, f = 0; yy < cb; yy += 5, f++) for (let xx = x0 + (f % 2) * 2.5; xx < x0 + cw - 2; xx += 5) { ctx.beginPath(); ctx.arc(xx + 2.5, yy, 2.5, 0, Math.PI); ctx.stroke(); }
      ctx.fillStyle = dk ? "#5E3D27" : "#7A4A30"; ctx.fillRect(x0 + cw - 18, cb - ch - 22, 7, 16);
      ctx.fillStyle = dk ? "#3A2A24" : "#6B3A2A"; ctx.beginPath(); ctx.moveTo(x0 - 6, cb - ch + 2); ctx.lineTo(x0 + cw / 2, cb - ch - 22); ctx.lineTo(x0 + cw + 6, cb - ch + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dk ? "#FFD98A" : "#CDEBFB"; ctx.fillRect(x0 + 10, cb - 18, 12, 10); ctx.fillStyle = dk ? "#3A2A20" : "#8A5A36"; ctx.fillRect(x0 + 40, cb - 20, 12, 20);
      if (dk) { ctx.fillStyle = rg(ctx, x0 + 16, cb - 13, 0, 26, [[0, "rgba(255,210,140,.3)"], [1, "rgba(255,210,140,0)"]]); ctx.beginPath(); ctx.arc(x0 + 16, cb - 13, 26, 0, 6.3); ctx.fill(); }
      humo(ctx, x0 + cw - 14, cb - ch - 24, t + 3, 0.6, dk); }
    ctx.fillStyle = dk ? "#3E2C20" : "#8A6040"; [10, 70, 130, 186].forEach(x => ctx.fillRect(x, 192, 4, 10));
    ctx.fillStyle = dk ? "#6B5040" : "#C99A6A"; ctx.fillRect(0, 180, 206, 10); ctx.fillStyle = dk ? "#4A3628" : "#A87B4F"; ctx.fillRect(0, 190, 206, 4);
    ctx.strokeStyle = "rgba(0,0,0,.14)"; ctx.lineWidth = 1; for (let x = 12; x < 206; x += 12) { ctx.beginPath(); ctx.moveTo(x, 180); ctx.lineTo(x, 190); ctx.stroke(); }
    plantar(ctx, [[48, 188, 1], [100, 188, 1], [152, 188, 1]], e, dk, t);
    if (e.c < 0.42) { const a = Math.min(0.7, (0.42 - e.c) * 1.6 + 0.2); ctx.strokeStyle = dk ? `rgba(180,195,230,${a})` : `rgba(220,230,245,${a})`; ctx.lineWidth = 1; for (let i = 0; i < 70; i++) { const x = (i * 53 + t * 110) % (W + 40) - 20, y = (i * 31 + t * 240) % (H + 20) - 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9); ctx.stroke(); } }
  }


  /* ============ Temas especiales: Marte y la base lunar ============
     Tu elefante con traje y casco: de vez en cuando baja el visor de cristal negro y lo sube para regar.
     Menta, el alienígena, se pasea entre tus cúpulas (en la Luna llega en su platillo) y salta cuando riegas.
     Lo que construyes se queda: en Marte tus raíces vuelven verde la arena (laguna desde 4 árboles, pasto
     y flores con 8); en la Luna encienden continentes de la Tierra (con sus ciudades, si el hábito sigue vivo).
     Tu semana pone el clima: remolinos y tormentas de arena en Marte, nubes y tormentas en la Tierra.
     En las tarjetas (quietas) el alienígena posa saludando y el visor está abajo; en la hoja se mueven. */
  const ESPACIO = (() => {
    function espacio(ctx, x, y, w, h, t, c, sd) {
      ctx.fillStyle = lg(ctx, 0, y, 0, y + h, [[0, "#04050D"], [1, "#0C1230"]]); ctx.fillRect(x, y, w, h);
      const a = 0.05 + 0.16 * c;
      ctx.fillStyle = rg(ctx, x + w * 0.22, y + h * 0.28, 0, w * 0.5, [[0, `rgba(130,80,210,${a})`], [1, "rgba(130,80,210,0)"]]); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rg(ctx, x + w * 0.78, y + h * 0.62, 0, w * 0.45, [[0, `rgba(60,150,230,${a * 0.8})`], [1, "rgba(60,150,230,0)"]]); ctx.fillRect(x, y, w, h);
      const r = semilla(sd || 5);
      for (let i = 0; i < Math.round(w * h / 900); i++) { const sx = x + r() * w, sy = y + r() * h, big = r() < 0.08, tw = 0.55 + 0.45 * Math.sin(t * 2 + i * 1.7); ctx.fillStyle = `rgba(255,255,255,${(big ? 0.9 : 0.55) * tw})`; ctx.fillRect(sx, sy, big ? 1.6 : 0.9, big ? 1.6 : 0.9); }
    }
    function fugaz(ctx, x, y, w, h, t, periodo) {
      const f = (t % periodo) / periodo; if (f > 0.18) return;
      const k = f / 0.18, x0 = x + w * (0.15 + 0.5 * ((Math.floor(t / periodo) * 0.37) % 1)), y0 = y + h * 0.12, px = x0 + k * w * 0.35, py = y0 + k * h * 0.22;
      ctx.strokeStyle = lg(ctx, px - 40, py - 25, px, py, [[0, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,.9)"]]); ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(px - 40, py - 25); ctx.lineTo(px, py); ctx.stroke();
    }
    const CONT = [
      { lon: 0.1, lat: 0.62, b: [[0, 0, 0.3, 0.17], [0.22, -0.12, 0.2, 0.14], [-0.18, 0.08, 0.16, 0.1], [0.05, -0.28, 0.1, 0.1]] },
      { lon: 0.55, lat: -0.35, b: [[0, 0.05, 0.17, 0.2], [0.04, -0.22, 0.11, 0.13], [-0.05, 0.25, 0.08, 0.06]] },
      { lon: 1.45, lat: 0.05, b: [[0, 0, 0.2, 0.24], [0.06, 0.22, 0.2, 0.1], [0.08, -0.22, 0.12, 0.1]] },
      { lon: 1.55, lat: 0.62, b: [[0, 0, 0.16, 0.09], [0.24, 0.02, 0.24, 0.12]] },
      { lon: 2.45, lat: 0.5, b: [[0, 0, 0.36, 0.17], [-0.25, 0.08, 0.18, 0.12], [0.2, -0.18, 0.14, 0.1]] },
      { lon: 3.25, lat: -0.42, b: [[0, 0, 0.22, 0.12], [0.12, 0.05, 0.08, 0.06]] },
      { lon: 4.35, lat: 0.22, b: [[0, 0, 0.13, 0.08], [0.14, 0.1, 0.1, 0.07], [-0.12, -0.08, 0.08, 0.05]] },
      { lon: 5.3, lat: -0.12, b: [[0, 0, 0.15, 0.19], [0.1, 0.18, 0.1, 0.07]] },
    ];
    const NUBES = (() => { const r = semilla(77), out = []; for (let i = 0; i < 30; i++) out.push({ lon: r() * 6.283, lat: (r() - 0.5) * 2.2, s: 0.06 + r() * 0.1 }); return out; })();
    function tierra(ctx, cx, cy, R, o, t) {
      const atm = o.humo > 0.05 ? mezcla("#7FB8FF", "#B0885A", Math.min(1, o.humo * 1.4)) : "#7FB8FF";
      ctx.fillStyle = rg(ctx, cx, cy, R * 0.96, R * 1.2, [[0, rgba(atm, 0.5)], [1, rgba(atm, 0)]]); ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, 6.3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.clip();
      const mar1 = mezcla("#55606E", "#2F80D2", o.mar), mar2 = mezcla("#232830", "#0F3A82", o.mar);
      ctx.fillStyle = rg(ctx, cx - R * 0.35, cy - R * 0.35, R * 0.05, R * 1.25, [[0, mezcla(mar1, "#FFFFFF", 0.18)], [0.55, mar1], [1, mar2]]); ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      const rot = o.rot, tilt = o.tilt || 0, proy = (lon, lat) => { const d = lon - rot, la = lat + tilt; return { x: cx + R * Math.cos(la) * Math.sin(d), y: cy - R * Math.sin(la), k: Math.cos(d) * Math.cos(la) }; };
      const blobs = [];
      CONT.forEach((C, i) => {
        const v = o.verdes[i], col = mezcla(o.seco, "#4E9F5A", v), col2 = mezcla(col, v > 0.5 ? "#7CC46A" : "#C9AE84", 0.35);
        C.b.forEach(([dl, dp, rl, rp], j) => { const lat = C.lat + dp, p = proy(C.lon + dl, lat); if (p.k <= 0.02) return;
          const K = 1.35, la = lat + tilt, rx = Math.max(0.6, K * R * rl * Math.cos(la) * Math.cos(C.lon + dl - rot)), ry = K * R * rp * (0.55 + 0.45 * Math.cos(la));
          ctx.fillStyle = j % 2 ? col2 : col; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, 6.3); ctx.fill();
          blobs.push({ i, j, x: p.x, y: p.y, rx, ry }); });
      });
      // hielo en los polos
      if (!tilt) ctx.fillStyle = "rgba(245,250,255,.92)"; if (!tilt) [[-1, 0.5], [1, 0.42]].forEach(([s, w]) => { ctx.beginPath(); ctx.ellipse(cx, cy + s * R * 0.97, R * w * o.hielo, R * 0.16 * Math.max(0.3, o.hielo), 0, 0, 6.3); ctx.fill(); });
      // incendios (solo «en juego»)
      if (o.fuego > 0) blobs.forEach((b, n) => { const r = semilla(n * 13 + 7), cant = Math.round(o.fuego * 4); for (let k = 0; k < cant; k++) { const fx = b.x + (r() - 0.5) * b.rx * 1.4, fy = b.y + (r() - 0.5) * b.ry * 1.4, a = 0.6 + 0.4 * Math.sin(t * 6 + n + k);
        ctx.fillStyle = rg(ctx, fx, fy, 0, 4, [[0, `rgba(255,170,60,${a})`], [1, "rgba(255,80,30,0)"]]); ctx.beginPath(); ctx.arc(fx, fy, 4, 0, 6.3); ctx.fill(); } });
      // nubes
      const cant = Math.round(o.nubes * NUBES.length), gris = o.tormenta > 0.3;
      NUBES.slice(0, cant).forEach((n, k) => { const p = proy(n.lon + t * 0.015, n.lat); if (p.k <= 0.05) return; ctx.fillStyle = gris ? `rgba(196,202,214,${0.55 + 0.25 * o.tormenta})` : "rgba(255,255,255,.72)";
        ctx.beginPath(); ctx.ellipse(p.x, p.y, R * n.s * 1.5 * Math.max(0.2, p.k), R * n.s * 0.55, 0, 0, 6.3); ctx.fill(); });
      if (o.tormenta > 0.3) { const p = proy(2.1 + t * 0.015, 0.28); if (p.k > 0.25) { ctx.strokeStyle = "rgba(225,230,240,.75)"; ctx.lineWidth = Math.max(1, R * 0.03); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(p.x, p.y, R * (0.04 + k * 0.035), t * 1.5 + k, t * 1.5 + k + 3.6); ctx.stroke(); } } }
      if (o.humo > 0) { ctx.fillStyle = `rgba(150,112,70,${Math.min(0.45, o.humo * 0.45)})`; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
      // la noche y las ciudades
      const xT = cx + R * (0.95 - 1.55 * o.noche);
      ctx.fillStyle = lg(ctx, xT - R * 0.28, 0, xT + R * 0.38, 0, [[0, "rgba(2,4,14,0)"], [1, "rgba(2,4,14,.86)"]]); ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      blobs.forEach(b => { const luz = o.luces[b.i]; if (!luz) return; const r = semilla(b.i * 31 + b.j * 7 + 3); for (let k = 0; k < 7; k++) { const lx = b.x + (r() - 0.5) * b.rx * 1.5, ly = b.y + (r() - 0.5) * b.ry * 1.5; if (lx < xT + R * 0.12) continue; ctx.fillStyle = `rgba(255,214,120,${0.85 * luz})`; ctx.beginPath(); ctx.arc(lx, ly, R * 0.012 + 0.6, 0, 6.3); ctx.fill(); } });
      ctx.restore();
      ctx.strokeStyle = `rgba(190,225,255,${0.4 * (1 - Math.min(1, o.humo))})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R - 0.6, Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
    }
    function verdeDe(c, base) { return mezcla(base || "#3FA36A", "#8A949A", (1 - c) * 0.3); }
    function flor(ctx, x, y, r, color) { ctx.fillStyle = color; for (let i = 0; i < 5; i++) { const an = i / 5 * 6.283; ctx.beginPath(); ctx.ellipse(x + Math.cos(an) * r, y + Math.sin(an) * r, r * 0.85, r * 0.6, an, 0, 6.3); ctx.fill(); } ctx.fillStyle = "#F7C948"; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 6.3); ctx.fill(); }
    function hoja(ctx, x, y, s, dir, color) { ctx.fillStyle = color; ctx.save(); ctx.translate(x, y); ctx.rotate(dir * -0.6); ctx.beginPath(); ctx.ellipse(dir * s, 0, s, s * 0.45, 0, 0, 6.3); ctx.fill(); ctx.restore(); }
    function planta(ctx, base, t, color, c) {
      const verde = verdeDe(c), verde2 = mezcla(verde, "#FFFFFF", 0.2);
      if (t < 0.15) { ctx.strokeStyle = verde; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(0, base - 6); ctx.stroke(); hoja(ctx, 0, base - 6, 3.6, -1, verde2); hoja(ctx, 0, base - 6, 3.6, 1, verde2); return; }
      const h = 10 + t * 42, pares = 1 + Math.floor(t * 5);
      ctx.strokeStyle = verde; ctx.lineWidth = 1.6 + t * 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, base); ctx.quadraticCurveTo(-3, base - h / 2, 0, base - h); ctx.stroke();
      for (let i = 0; i < pares; i++) { const yy = base - h * (0.25 + i * 0.65 / pares), s = 4 + t * 6 * (1 - i * 0.12); hoja(ctx, 0, yy, s, i % 2 ? 1 : -1, i % 2 ? verde : verde2); hoja(ctx, 0, yy - 2, s * 0.8, i % 2 ? -1 : 1, verde2); }
      if (t >= 0.62) { const n = Math.min(4, 1 + Math.floor((t - 0.62) * 9)), rr = 3 + t * 2.4; flor(ctx, 0, base - h - 2, rr, color); for (let i = 1; i < n; i++) flor(ctx, (i % 2 ? 1 : -1) * (6 + t * 6), base - h * (0.62 - i * 0.12), rr * 0.8, color); }
      else if (t >= 0.45) { ctx.fillStyle = mezcla(color, verde, 0.4); ctx.beginPath(); ctx.ellipse(0, base - h - 2, 2.6, 4, 0, 0, 6.3); ctx.fill(); }
    }
    function capsula(ctx, x, y, k, t, color, c, salto) {
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0, 1, 13, 2.6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = lg(ctx, -11, 0, 11, 0, [[0, "#F6F8FC"], [0.6, "#D6DBE5"], [1, "#9EA6B6"]]); ctx.beginPath(); ctx.moveTo(-11, -18); ctx.lineTo(11, -18); ctx.lineTo(9, 0); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(92,225,230,.9)"; ctx.fillRect(-10.4, -11, 20.8, 2.2); ctx.fillStyle = "rgba(92,225,230,.25)"; ctx.fillRect(-12, -13, 24, 6);
      ctx.fillStyle = "#E6E9F0"; ctx.fillRect(-12.5, -21, 25, 4); ctx.fillStyle = "#26304A"; ctx.beginPath(); ctx.ellipse(0, -21, 11, 2.2, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.translate(0, -21); ctx.scale(1, 1 + (salto || 0) * 0.08); ctx.translate(0, 21); planta(ctx, -21, t, color, c); ctx.restore();
      ctx.restore();
      return { x, y: y - 21 * k, k };
    }
    function arbol(ctx, x, y, s, c, color, hojas) {
      const tronco = "#8A5A36", verde = verdeDe(c, "#4FA463");
      ctx.fillStyle = tronco; ctx.beginPath(); ctx.moveTo(x - 5 * s, y); ctx.lineTo(x - 3 * s, y - 34 * s); ctx.lineTo(x + 3 * s, y - 34 * s); ctx.lineTo(x + 5 * s, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = tronco; ctx.lineCap = "round"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x, y - 26 * s); ctx.lineTo(x - 11 * s, y - 38 * s); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x + 10 * s, y - 42 * s); ctx.stroke();
      if (hojas === false) return;
      [[0, -54, 20], [-15, -44, 15], [15, -46, 16], [-6, -64, 14], [9, -62, 13]].forEach(([dx, dy, r], i) => { ctx.fillStyle = i % 2 ? verde : mezcla(verde, "#FFFFFF", 0.12); ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3); ctx.fill(); });
      if (c > 0.7) { const r = semilla(Math.round(x * 7) + 1); ctx.fillStyle = color; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 34 * s, y - (40 + r() * 28) * s, 2.2 * s, 0, 6.3); ctx.fill(); } }
    }
    function cupula(ctx, x, y, s, c, color, hojas) {
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 26 * s, 5 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#3C4E3A"; ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 4 * s, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(170,215,255,.12)"; ctx.beginPath(); ctx.ellipse(x, y, 24 * s, 36 * s, 0, Math.PI, 0); ctx.fill();
      arbol(ctx, x, y, 0.44 * s, c, color, hojas !== false);
      ctx.strokeStyle = "rgba(205,232,255,.6)"; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.ellipse(x, y, 24 * s, 36 * s, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(205,232,255,.22)"; ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 36 * s, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(x - 9 * s, y - 16 * s, 6 * s, 14 * s, -0.3, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      ctx.fillStyle = "#9AA2B2"; ctx.fillRect(x - 25 * s, y - 1 * s, 50 * s, 3 * s);
      ctx.fillStyle = "rgba(92,225,230,.9)"; ctx.beginPath(); ctx.arc(x + 18 * s, y + 0.5 * s, 1.4 * s, 0, 6.3); ctx.fill();
    }
    function regadera(ctx, p, t) {
      const d = t - riego.t0; if (d < 0 || d > 1.6) return;
      const k = p.k, x = p.x - 26 * k, y = p.y - 44 * k, a = Math.min(1, d / 0.25) * (d > 1.35 ? (1.6 - d) / 0.25 : 1);
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y); ctx.rotate(0.55); ctx.scale(k, k);
      ctx.fillStyle = "#C9D0DC"; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.lineTo(8, 10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#8E97A8"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(22, -10); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 7, Math.PI, 0); ctx.stroke();
      ctx.restore(); ctx.globalAlpha = 1;
      if (d > 0.25 && d < 1.3) { ctx.fillStyle = "#5CC8E8"; for (let i = 0; i < 7; i++) { const f = ((d * 2.2 + i / 7) % 1), sx = x + 18 * k, sy = y - 6 * k; ctx.beginPath(); ctx.ellipse(sx + (p.x - sx) * f * 0.5, sy + (p.y - sy) * f, 1.4 * k, 2.4 * k, 0, 0, 6.3); ctx.fill(); } }
    }
    function visorDe(t, desfase) {
      if (t - riego.t0 < 2.2) return 0;
      const p = FIJA ? 6 : (t + (desfase || 0)) % 11;
      if (p < 4) return 0; if (p < 4.6) return (p - 4) / 0.6; if (p < 8) return 1; if (p < 8.6) return 1 - (p - 8) / 0.6; return 0;
    }
    function astronauta(ctx, x, y, s, t, modo, op) {
      op = op || {};
      const by = y + (modo === "flota" ? Math.sin(t * 1.3) * 3 : -Math.abs(Math.sin(t * 1.4)) * 2.5), giro = modo === "flota" ? Math.sin(t * 0.7) * 0.12 : 0, v = op.visor || 0;
      ctx.save(); ctx.translate(x, by); ctx.rotate(giro); ctx.scale(s * (op.dir || 1), s);
      ctx.fillStyle = "rgba(0,0,0,.22)"; if (modo !== "flota") { ctx.beginPath(); ctx.ellipse(0, 22 + (y - by) / s, 11, 2.4, 0, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = "#B9C0CE"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(4, -4, 9, 17, 2) : ctx.rect(4, -4, 9, 17); ctx.fill();
      ctx.fillStyle = "#EEF1F6"; [[-7, 12], [1, 12]].forEach(([lx, ly]) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, 6, 9, 2.5) : ctx.rect(lx, ly, 6, 9); ctx.fill(); });
      ctx.fillStyle = "#8C94A6"; ctx.fillRect(-7, 19, 6, 2.5); ctx.fillRect(1, 19, 6, 2.5);
      ctx.fillStyle = lg(ctx, -10, 0, 10, 0, [[0, "#FFFFFF"], [1, "#C9CFDB"]]); ctx.beginPath(); ctx.ellipse(0, 7, 10, 10, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#E8606B"; ctx.fillRect(-9.5, 1, 3, 4); ctx.fillStyle = "#3949C9"; ctx.fillRect(-9.5, 5, 3, 2);
      ctx.fillStyle = "#5CE1E6"; ctx.fillRect(-3, 4, 3, 2.4); ctx.fillStyle = "#FF8A85"; ctx.fillRect(1, 4, 3, 2.4);
      ctx.fillStyle = "#D8DDE6"; ctx.beginPath(); ctx.ellipse(0, 2.5, 9, 2.2, 0, 0, 6.3); ctx.fill();
      // el casco: la cara, el visor de cristal negro y el brillo
      ctx.save(); ctx.beginPath(); ctx.arc(0, -8, 11, 0, 6.3); ctx.clip();
      ctx.fillStyle = "rgba(20,30,60,.55)"; ctx.fillRect(-12, -20, 24, 24); elefanteCara(ctx, -1, -7, 0.75);
      if (v > 0.01) {
        const h = 23 * v;
        ctx.fillStyle = lg(ctx, 0, -19, 0, 4, [[0, "#04060C"], [0.55, "#0E1424"], [1, "#25324E"]]); ctx.fillRect(-12, -19, 24, h);
        ctx.strokeStyle = "rgba(244,190,90,.9)"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(-12, -19 + h); ctx.quadraticCurveTo(0, -16.5 + h, 12, -19 + h); ctx.stroke();
        ctx.globalAlpha = Math.min(1, v * 1.3);
        ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(3, -5, 10, Math.PI * 1.12, Math.PI * 1.48); ctx.stroke();
        ctx.strokeStyle = "rgba(255,200,130,.5)"; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(0, 12, 15, Math.PI * 1.3, Math.PI * 1.7); ctx.stroke();
        if (op.refleja) { ctx.fillStyle = op.refleja; ctx.beginPath(); ctx.arc(4.5, -12, 1.9, 0, 6.3); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(4, -12.6, 0.6, 0, 6.3); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      ctx.fillStyle = "rgba(200,230,255,.14)"; ctx.beginPath(); ctx.arc(0, -8, 11, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -8, 11, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = v > 0.5 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -8, 8, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.strokeStyle = "#B9C0CE"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(6, -17); ctx.lineTo(9, -24); ctx.stroke(); ctx.fillStyle = (Math.floor(t * 2) % 2) ? "#FF8A85" : "#FFD0CC"; ctx.beginPath(); ctx.arc(9, -24, 1.6, 0, 6.3); ctx.fill();
      ctx.restore();
    }
    function alien(ctx, x, y, s, t, o) {
      o = o || {};
      const paso = o.camina ? Math.sin(t * 10) : 0, salto = o.salta || 0, by = y - salto * 12 - (o.camina ? Math.abs(paso) * 1.2 : Math.sin(t * 2) * 0.6);
      ctx.save(); ctx.translate(x, by); ctx.scale(s * (o.dir || 1), s);
      ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(0, 12.5 + (y - by) / s, 6, 1.6, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "#4FB45C"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-2.5, 6); ctx.lineTo(-3 - paso * 2.4, 12); ctx.moveTo(2.5, 6); ctx.lineTo(3 + paso * 2.4, 12); ctx.stroke();
      ctx.fillStyle = "#74D47A"; ctx.beginPath(); ctx.ellipse(0, 2, 5.2, 6.6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#B7F0A6"; ctx.beginPath(); ctx.ellipse(0, 3.6, 2.6, 3.6, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "#5FC46B"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-7.5, 4.5 + paso); ctx.stroke();
      const a = o.saluda ? -1.35 + Math.sin(t * 9) * 0.55 : 0.95 - paso * 0.3;
      ctx.beginPath(); ctx.moveTo(4, -0.5); ctx.lineTo(4 + Math.cos(a) * 6.5, -0.5 + Math.sin(a) * 6.5); ctx.stroke();
      ctx.strokeStyle = "#74D47A"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, -14); ctx.quadraticCurveTo(-5, -19, -6.5, -21.5); ctx.moveTo(3, -14); ctx.quadraticCurveTo(5, -19, 6.5, -21.5); ctx.stroke();
      const brillo = 0.55 + 0.45 * Math.sin(t * 4);
      [-6.5, 6.5].forEach(ax => { ctx.fillStyle = `rgba(196,155,245,${0.35 * brillo})`; ctx.beginPath(); ctx.arc(ax, -21.5, 3.6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#C49BF5"; ctx.beginPath(); ctx.arc(ax, -21.5, 1.8, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = "#86E284"; ctx.beginPath(); ctx.ellipse(0, -9, 8.4, 7.2, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.ellipse(-3, -13, 3.4, 1.8, -0.3, 0, 6.3); ctx.fill();
      const parpadea = (t % 4.3) < 0.14;
      ctx.fillStyle = "#0E1220";
      if (parpadea) { ctx.fillRect(-5.6, -9, 4.6, 0.9); ctx.fillRect(1, -9, 4.6, 0.9); }
      else { ctx.beginPath(); ctx.ellipse(-3.2, -9, 2.6, 3.5, 0.35, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.ellipse(3.2, -9, 2.6, 3.5, -0.35, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.arc(-2.3, -10.5, 0.85, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(4.1, -10.5, 0.85, 0, 6.3); ctx.fill(); }
      ctx.strokeStyle = "#1E3A24"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, -5.6, 1.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.restore();
    }
    function platillo(ctx, x, y, s, t, rayo, suelo) {
      if (rayo > 0) { ctx.fillStyle = lg(ctx, 0, y, 0, suelo, [[0, `rgba(170,255,210,${0.35 * rayo})`], [1, `rgba(170,255,210,${0.08 * rayo})`]]); ctx.beginPath(); ctx.moveTo(x - 8 * s, y + 4 * s); ctx.lineTo(x + 8 * s, y + 4 * s); ctx.lineTo(x + 26 * s, suelo); ctx.lineTo(x - 26 * s, suelo); ctx.closePath(); ctx.fill(); }
      ctx.save(); ctx.translate(x, y + Math.sin(t * 2.2) * 1.5); ctx.scale(s, s);
      ctx.fillStyle = "rgba(190,230,255,.35)"; ctx.beginPath(); ctx.ellipse(0, -4, 10, 9, 0, Math.PI, 0); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -4, 10, 9, 0, Math.PI, 0); ctx.clip(); alien(ctx, 0, 8, 0.62, t, { saluda: rayo > 0.5 }); ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, -4, 10, 9, 0, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = lg(ctx, 0, -5, 0, 5, [[0, "#E8ECF4"], [1, "#7D869A"]]); ctx.beginPath(); ctx.ellipse(0, 0, 24, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#5C6578"; ctx.beginPath(); ctx.ellipse(0, 2.5, 12, 3, 0, 0, Math.PI); ctx.fill();
      ["#FF8A85", "#FFD24A", "#5CE1E6", "#C49BF5", "#7ED97A"].forEach((c, i) => { const on = (Math.floor(t * 4) + i) % 2; ctx.fillStyle = on ? c : rgba(c, 0.35); ctx.beginPath(); ctx.arc(-16 + i * 8, 1, 1.5, 0, 6.3); ctx.fill(); });
      ctx.restore();
    }
    function saltaAlRegar(t) { const d = t - riego.t0; return d > 0.3 && d < 1.9 ? Math.abs(Math.sin((d - 0.3) * 6)) * (1 - (d - 0.3) / 1.6) : 0; }
    function marte(ctx, W, H, e, t) {
      const dk = OSC, HZ = 170;
      if (dk) { espacio(ctx, 0, 0, W, HZ, t, e.c * 0.6, 23); ctx.fillStyle = lg(ctx, 0, 40, 0, HZ, [[0, "rgba(60,20,40,0)"], [1, "rgba(130,55,55,.6)"]]); ctx.fillRect(0, 0, W, HZ);
        ctx.fillStyle = rg(ctx, 90, HZ - 6, 0, 130, [[0, "rgba(110,165,255,.42)"], [1, "rgba(110,165,255,0)"]]); ctx.fillRect(0, 0, W, HZ); }
      else { ctx.fillStyle = lg(ctx, 0, 0, 0, HZ, [[0, "#D4825C"], [1, "#F2C9A6"]]); ctx.fillRect(0, 0, W, HZ);
        ctx.fillStyle = rg(ctx, 92, 46, 0, 40, [[0, "rgba(255,246,230,.7)"], [1, "rgba(255,246,230,0)"]]); ctx.beginPath(); ctx.arc(92, 46, 40, 0, 6.3); ctx.fill(); ctx.fillStyle = "#FFF6E6"; ctx.beginPath(); ctx.arc(92, 46, 6.5, 0, 6.3); ctx.fill(); }
      // la Tierra: una estrellita azul
      const ex = 404, ey = 36, br = 0.7 + 0.3 * Math.sin(t * 2);
      ctx.fillStyle = rg(ctx, ex, ey, 0, 10, [[0, `rgba(140,200,255,${0.85 * br})`], [1, "rgba(140,200,255,0)"]]); ctx.beginPath(); ctx.arc(ex, ey, 10, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#7FC4FF"; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#E8ECF4"; ctx.beginPath(); ctx.arc(ex + 5.5, ey - 2, 0.9, 0, 6.3); ctx.fill();
      ctx.font = "600 10px Figtree, system-ui, sans-serif"; ctx.fillStyle = dk ? "rgba(220,230,255,.75)" : "rgba(90,40,30,.62)"; ctx.fillText("la Tierra", ex + 10, ey + 3.5);
      // Fobos cruza rápido; Deimos, lento
      const fx = ((t * 7) % 560) - 40; ctx.fillStyle = dk ? "#B9A898" : "rgba(120,80,60,.55)"; ctx.beginPath(); ctx.ellipse(fx, 30 + Math.sin(t * 0.3) * 3, 5.5, 3.6, 0.4, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(170 + Math.sin(t * 0.05) * 40, 62, 2.6, 2, 0, 0, 6.3); ctx.fill();
      // el gran volcán y las mesetas
      const lejos = dk ? "#3E2224" : "#C27050";
      ctx.fillStyle = lejos; ctx.beginPath(); ctx.moveTo(240, HZ); [[300, 140], [338, 120], [352, 114], [392, 114], [404, 120], [446, 140], [480, 152], [480, HZ]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dk ? "#2E1A1C" : "#B36446"; ctx.beginPath(); ctx.ellipse(372, 115, 18, 3, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = dk ? "#4A2A2A" : "#C87654"; ctx.beginPath(); ctx.moveTo(0, HZ); [[0, 150], [36, 146], [50, 132], [104, 132], [118, 148], [196, 152], [214, HZ]].forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
      // la arena, con ondas y piedras
      ctx.fillStyle = lg(ctx, 0, HZ - 6, 0, H, [[0, dk ? "#7A3A26" : "#D26C40"], [1, dk ? "#4A2216" : "#9A4426"]]); ctx.beginPath(); ctx.moveTo(0, HZ - 2); ctx.quadraticCurveTo(240, HZ - 16, W, HZ - 2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.strokeStyle = dk ? "rgba(255,190,150,.08)" : "rgba(120,40,20,.18)"; ctx.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const y = HZ + 8 + i * 10; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 30) ctx.quadraticCurveTo(x + 15, y - 3, x + 30, y); ctx.stroke(); }
      const r = semilla(9); ctx.fillStyle = "rgba(60,20,10,.35)"; for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(r() * W, HZ + 8 + r() * 82, 2 + r() * 3, 1 + r() * 1.4, 0, 0, 6.3); ctx.fill(); }
      // lo que tus raíces van volviendo verde: pasto, una laguna (desde 4) y flores (con 8)
      const P = [[292, 204], [332, 202], [372, 204], [412, 202], [312, 238], [352, 240], [392, 238], [432, 240]];
      for (let i = 0; i < e.r; i++) { const [x, y] = P[i]; ctx.fillStyle = "rgba(96,176,92,.5)"; ctx.beginPath(); ctx.ellipse(x, y + 3, 36, 10, 0, 0, 6.3); ctx.fill(); const rr = semilla(i + 40); ctx.fillStyle = "rgba(126,206,112,.6)"; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(x + (rr() - 0.5) * 64, y + 3 + (rr() - 0.5) * 16, 1.7, 0, 6.3); ctx.fill(); } }
      if (e.r >= 4) { ctx.fillStyle = "rgba(96,176,92,.5)"; ctx.beginPath(); ctx.ellipse(250, 250, 40, 9, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = dk ? "#2C5C8C" : "#5FA9D6"; ctx.beginPath(); ctx.ellipse(250, 250, 30, 6, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(246, 249, 14, 2.4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      if (e.r >= 8) { const rr = semilla(88); for (let k = 0; k < 26; k++) { const x = 220 + rr() * 250, y = 186 + rr() * 70; ctx.strokeStyle = "rgba(110,190,100,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1.5, y - 4); ctx.moveTo(x, y); ctx.lineTo(x + 1.5, y - 4.5); ctx.stroke(); if (k % 3 === 0) { ctx.fillStyle = FLORES[k % FLORES.length]; ctx.beginPath(); ctx.arc(x, y - 5, 1.5, 0, 6.3); ctx.fill(); } } }
      // un remolino de polvo si la semana va regular
      if (e.c >= 0.45 && e.c < 0.7) { const x = 230 + Math.sin(t * 0.25) * 160; for (let k = 0; k < 7; k++) { ctx.fillStyle = `rgba(230,170,130,${0.12 + k * 0.02})`; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 4 + k) * 2, 196 - k * 6, 4 + k * 1.6, 1.6 + k * 0.4, 0, 0, 6.3); ctx.fill(); } }
      // el rover, estacionado
      { const x = 34, y = 204; ctx.fillStyle = "#E6E9F0"; ctx.fillRect(x - 12, y - 8, 24, 6); ctx.fillStyle = "#8E97A8"; ctx.fillRect(x - 10, y - 12, 8, 4); ctx.strokeStyle = "#8E97A8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 6, y - 8); ctx.lineTo(x + 8, y - 16); ctx.stroke(); ctx.fillStyle = "#C9D0DC"; ctx.beginPath(); ctx.ellipse(x + 9, y - 17, 3.5, 1.6, -0.4, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#3A3F4C"; [-9, 0, 9].forEach(dx => { ctx.beginPath(); ctx.arc(x + dx, y, 3, 0, 6.3); ctx.fill(); }); ctx.fillStyle = (Math.floor(t * 1.5) % 2) ? "#FF8A85" : "#7A3A3A"; ctx.beginPath(); ctx.arc(x - 11, y - 9, 1, 0, 6.3); ctx.fill(); }
      // paneles solares
      [[214, 198], [242, 196]].forEach(([x, y]) => { ctx.strokeStyle = "#8E97A8"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 10, y + 16); ctx.stroke(); ctx.fillStyle = "#2B4A8A"; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 22, y + 6); ctx.lineTo(x + 18, y - 4); ctx.lineTo(x + 4, y - 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(200,220,255,.4)"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x + 11, y + 6); ctx.lineTo(x + 11, y - 4); ctx.moveTo(x + 2, y + 1); ctx.lineTo(x + 20, y + 1); ctx.stroke(); });
      // el túnel del invernadero a las cúpulas
      ctx.fillStyle = "#C9CFDB"; ctx.fillRect(200, 220, 76, 9); ctx.fillStyle = "rgba(0,0,0,.15)"; for (let x = 206; x < 276; x += 10) ctx.fillRect(x, 220, 2, 9);
      // el invernadero grande con tus macetas
      const gx = 118, gy = 228;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(gx, gy + 3, 88, 10, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,235,220,.16)"; ctx.beginPath(); ctx.ellipse(gx, gy, 84, 78, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = rg(ctx, gx, gy - 30, 0, 80, [[0, "rgba(255,214,140,.2)"], [1, "rgba(255,214,140,0)"]]); ctx.beginPath(); ctx.ellipse(gx, gy, 84, 78, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#8E96A6"; ctx.fillRect(gx - 56, gy - 2, 112, 5);
      macetas(ctx, [[gx - 34, gy - 2, 1.05], [gx, gy - 2, 1.05], [gx + 34, gy - 2, 1.05]], e, t);
      ctx.strokeStyle = "rgba(255,240,230,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(gx, gy, 84, 78, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,230,.22)"; ctx.lineWidth = 1.1; [56, 28, 1].forEach(rx => { ctx.beginPath(); ctx.ellipse(gx, gy, rx, 78, 0, Math.PI, 0); ctx.stroke(); }); [26, 52].forEach(dy => { const k = Math.sqrt(1 - (dy / 78) ** 2); ctx.beginPath(); ctx.ellipse(gx, gy - dy, 84 * k, 7 * k, 0, 0, Math.PI); ctx.stroke(); });
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(gx - 30, gy - 36, 12, 32, -0.3, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      ctx.fillStyle = "#B8BCC8"; ctx.fillRect(gx - 86, gy - 1, 172, 4);
      // las cúpulas de atrás, el alienígena entre ellas y las de adelante; la roca donde se esconde
      for (let i = 0; i < Math.min(4, e.r); i++) cup(ctx, P, i, 0.62, e, t);
      { const p = (QUIETO || FIJA) ? 8 : (t + 3) % 16, tormenta = e.c < 0.45; let x = 462, camina = false, dir = -1, saluda = false;
        if (!tormenta) { if (p < 1.5) x = 462 - p * 4; else if (p < 6) { x = 456 - (p - 1.5) / 4.5 * 120; camina = true; } else if (p < 9.5) { x = 336; saluda = true; } else if (p < 14) { x = 336 + (p - 9.5) / 4.5 * 126; camina = true; dir = 1; } else x = 462; }
        else x = 458 + Math.sin(t) * 2;
        alien(ctx, x, 224, 1.05, t, { camina, dir, saluda, salta: saltaAlRegar(t) }); }
      for (let i = 4; i < e.r; i++) cup(ctx, P, i, 0.62, e, t);
      ctx.fillStyle = dk ? "#5A2A1C" : "#A9502E"; ctx.beginPath(); ctx.moveTo(446, 238); ctx.quadraticCurveTo(450, 214, 466, 210); ctx.quadraticCurveTo(480, 214, 480, 238); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.ellipse(460, 216, 6, 2.4, -0.3, 0, 6.3); ctx.fill();
      astronauta(ctx, 214, 238, 1.05, t, "salta", { visor: visorDe(t, 0), refleja: "#FFF6E6" });
      if (e.c < 0.45) { const a = (0.45 - e.c) * 1.4; ctx.fillStyle = `rgba(190,110,70,${Math.min(0.55, a)})`; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = `rgba(240,180,140,${Math.min(0.6, a)})`; ctx.lineWidth = 1;
        for (let i = 0; i < 60; i++) { const x = (i * 47 + t * 90) % (W + 40) - 20, y = (i * 29) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12, y + 1); ctx.stroke(); } }
    }
    function luna(ctx, W, H, e, t) {
      const dk = OSC;
      espacio(ctx, 0, 0, W, H, t, e.c, 41);
      tierra(ctx, 372, 72, 56, tierraDe(e, "reverdece", t, dk ? 0.62 : 0.3), t);
      if (e.c > 0.8) fugaz(ctx, 0, 0, W * 0.6, H * 0.6, t, 5);
      { const f = ((t * 0.04) % 1), x = 40 + f * 260, y = 40 + Math.sin(f * 3) * 6; ctx.fillStyle = "#C9D0DC"; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = "#4A7BD0"; ctx.fillRect(x - 9, y - 1.4, 6, 2.8); ctx.fillRect(x + 3, y - 1.4, 6, 2.8); }
      // el suelo lunar
      ctx.fillStyle = lg(ctx, 0, 160, 0, H, [[0, "#A3A6B0"], [1, "#5C5F6A"]]); ctx.beginPath(); ctx.moveTo(0, 176); ctx.quadraticCurveTo(240, 150, W, 172); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = rg(ctx, 400, 170, 0, 200, [[0, "rgba(127,184,255,.10)"], [1, "rgba(127,184,255,0)"]]); ctx.fillRect(200, 150, 280, 110);
      [[40, 236, 18, 5], [300, 248, 14, 4], [196, 252, 9, 2.6], [470, 250, 10, 3]].forEach(([x, y, rx, ry]) => { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 1, rx, ry, 0, Math.PI, 0); ctx.stroke(); });
      ctx.fillStyle = "rgba(60,62,72,.5)"; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(236 + i * 9, 252 - i * 2, 2, 1, 0, 0, 6.3); ctx.fill(); }
      // el módulo de aterrizaje, lejos
      { const x = 26, y = 176; ctx.strokeStyle = "#B8BFCC"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x - 4, y - 8); ctx.moveTo(x + 8, y); ctx.lineTo(x + 4, y - 8); ctx.stroke(); ctx.fillStyle = "#D9A646"; ctx.fillRect(x - 6, y - 14, 12, 7); ctx.fillStyle = "#C9D0DC"; ctx.beginPath(); ctx.moveTo(x - 5, y - 14); ctx.lineTo(x - 3, y - 20); ctx.lineTo(x + 3, y - 20); ctx.lineTo(x + 5, y - 14); ctx.closePath(); ctx.fill(); }
      // paneles solares, la bandera y el módulo donde vive tu elefante
      [[246, 172], [272, 170]].forEach(([x, y]) => { ctx.strokeStyle = "#8E97A8"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 10, y + 16); ctx.stroke(); ctx.fillStyle = "#2B4A8A"; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 22, y + 6); ctx.lineTo(x + 18, y - 4); ctx.lineTo(x + 4, y - 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(200,220,255,.4)"; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x + 11, y + 6); ctx.lineTo(x + 11, y - 4); ctx.stroke(); });
      ctx.strokeStyle = "#D6DAE2"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(310, 192); ctx.lineTo(310, 150); ctx.stroke();
      ctx.fillStyle = "#3949C9"; ctx.fillRect(311, 151, 24, 15); ctx.fillStyle = "#FFFFFF"; ctx.font = "800 11px Figtree, system-ui, sans-serif"; ctx.fillText("R", 319, 163);
      ctx.fillStyle = "#D9DDE5"; ctx.fillRect(210, 206, 34, 12); ctx.fillStyle = "rgba(0,0,0,.12)"; for (let x = 214; x < 244; x += 8) ctx.fillRect(x, 206, 2, 12);
      ctx.fillStyle = lg(ctx, 0, 182, 0, 226, [[0, "#F2F4F8"], [1, "#B8BFCC"]]); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(238, 184, 54, 40, 10) : ctx.rect(238, 184, 54, 40); ctx.fill();
      ctx.fillStyle = dk ? "#FFD98A" : "#CDEBFB"; [[250, 198], [266, 198]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.3); ctx.fill(); });
      ctx.strokeStyle = "#9AA2B2"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(284, 184); ctx.lineTo(288, 172); ctx.stroke(); ctx.fillStyle = "#C9D0DC"; ctx.beginPath(); ctx.ellipse(290, 170, 7, 3.4, -0.5, 0, 6.3); ctx.fill();
      // el invernadero grande con tus macetas
      const gx = 122, gy = 218;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(gx, gy + 3, 98, 10, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(170,215,255,.12)"; ctx.beginPath(); ctx.ellipse(gx, gy, 94, 86, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = rg(ctx, gx, gy - 30, 0, 90, [[0, "rgba(255,214,140,.22)"], [1, "rgba(255,214,140,0)"]]); ctx.beginPath(); ctx.ellipse(gx, gy, 94, 86, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#8E96A6"; ctx.fillRect(gx - 60, gy - 2, 120, 5);
      macetas(ctx, [[gx - 36, gy - 2, 1.1], [gx, gy - 2, 1.1], [gx + 36, gy - 2, 1.1]], e, t);
      ctx.strokeStyle = "rgba(205,232,255,.65)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(gx, gy, 94, 86, 0, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(205,232,255,.2)"; ctx.lineWidth = 1.2; [62, 30, 1].forEach(rx => { ctx.beginPath(); ctx.ellipse(gx, gy, rx, 86, 0, Math.PI, 0); ctx.stroke(); }); [28, 56].forEach(dy => { const k = Math.sqrt(1 - (dy / 86) ** 2); ctx.beginPath(); ctx.ellipse(gx, gy - dy, 94 * k, 8 * k, 0, 0, Math.PI); ctx.stroke(); });
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(gx - 34, gy - 40, 14, 36, -0.3, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      ctx.fillStyle = "#B8BFCC"; ctx.fillRect(gx - 96, gy - 1, 192, 5);
      // las cúpulas con árboles
      const P = [[340, 196], [376, 194], [412, 196], [448, 194], [354, 230], [390, 232], [426, 230], [462, 232]];
      for (let i = 0; i < e.r; i++) cup(ctx, P, i, 0.66, e, t);
      // el platillo: llega, mira tus árboles con su luz y se va
      { const p = (QUIETO || FIJA) ? 6 : t % 18; let x, y, rayo = 0, ver = true;
        if (p < 4) { const k = p / 4, kk = k * k * (3 - 2 * k); x = 520 - kk * 125; y = 34 + kk * 96; }
        else if (p < 10) { x = 395 + Math.sin((p - 4) * 1.2) * 8; y = 130 + Math.sin((p - 4) * 2) * 2; rayo = Math.min(1, (p - 4) / 0.6, (10 - p) / 0.6); }
        else if (p < 13) { const k = (p - 10) / 3, kk = k * k; x = 395 - kk * 470; y = 130 - kk * 110; }
        else ver = false;
        if (ver) platillo(ctx, x, y, 1.05, t, rayo, 214); }
      astronauta(ctx, 226, 238, 1.05, t, "salta", { visor: visorDe(t, 5), refleja: "#7FB8FF" });
    }
    /* Las macetas de la app: cada una con su planta; tu elefante riega la que marcaste */
    function saltoDe(M, t) { if (!M || M.id !== riego.id) return 0; const d = t - riego.t0 - 0.6; return Math.max(0, Math.sin(d * 8)) * Math.max(0, 1 - d); }
    function macetas(ctx, pos, e, t) {
      pos.forEach(([x, y, k], j) => { const M = e.macetas[j]; if (!M) return; const p = capsula(ctx, x, y, k, M.t, M.color, e.c, saltoDe(M, t)); anotar(M, p); if (M.id === riego.id) regadera(ctx, p, t); });
    }
    /* Cada árbol en su cúpula: su color, sin hojas si dejaste el hábito, y brota al trasplantarlo */
    function cup(ctx, P, i, s, e, t) { const a = e.arboles[i]; if (!a || !P[i]) return; cupula(ctx, P[i][0], P[i][1], s * brota(a, t), e.c, a.color, a.hojas); }
    /* La Tierra reverdece: un continente por árbol (para siempre); sus ciudades se prenden si ese hábito sigue vivo */
    function tierraDe(e, modo, t, noche) {
      const c = e.c, n = e.r;
      const verdes = Array.from({ length: 8 }, (_, i) => (i < n ? 1 : 0)), luces = Array.from({ length: 8 }, (_, i) => (i < n && e.arboles[i] && e.arboles[i].hojas !== false ? 1 : 0));
      return { rot: t * 0.05, noche, nubes: 0.22 + (1 - c) * 0.6, tormenta: c < 0.45 ? (0.45 - c) / 0.45 : 0, fuego: 0, humo: 0, hielo: 1, mar: 0.3 + 0.7 * (n / 8), seco: "#94806A", verdes, luces };
    }
    const adaptar = e => { const arboles = ultimos(e); return { m: e.macetas.length, r: arboles.length, ts: e.macetas.map(x => x.t), c: e.c, macetas: e.macetas, arboles }; };
    return { marte: (ctx, W, H, e, t) => marte(ctx, W, H, adaptar(e), t), luna: (ctx, W, H, e, t) => luna(ctx, W, H, adaptar(e), t) };
  })();

  /* ============ Montar, mover y regar ============ */
  const ESCENAS = { entrada: [entrada, 320, 220], ventana: [ventana, 320, 240], terrario: [terrario, 320, 240], pixeles: [pixeles, 320, 240], sur: [sur, 480, 200], marte: [ESPACIO.marte, 480, 260], luna: [ESPACIO.luna, 480, 260] };
  const lienzos = new Set();
  const datosDe = cv => {
    let e = null;
    try { e = cv.dataset.modo === "muestra" ? jardinMuestra() : jardinEscena(); } catch (err) { e = null; }
    e = e || { macetas: [], arboles: [], c: 0.7 };
    return { macetas: (e.macetas || []).slice(0, 3), arboles: e.arboles || [], c: e.c == null ? 0.7 : e.c, vuelve: e.vuelve || null };
  };
  function pintar(L, t) {
    const { cv, ctx, W, H } = L, w = cv.clientWidth || W, k = w / W, pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(w * H / W * DPR));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(k * DPR, 0, 0, k * DPR, 0, 0);
    FIJA = !L.cv.dataset.vivo; POTS = [];
    try { L.f(ctx, W, H, L.e, t, OSC); descansos(ctx, W, H, L.e, t, L.cv.dataset.jardin); } catch (err) { if (!L.fallo) { L.fallo = true; console.warn("jardín", err); } }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  function montar(cv) {
    if (cv.dataset.listo) return; cv.dataset.listo = "1";
    if (!lienzos.size) colores();
    const [f, W, H] = ESCENAS[cv.dataset.jardin] || ESCENAS.entrada;
    // Quieto en las tarjetas (no gasta batería); se mueve en la hoja del jardín y en la muestra de la Tienda (data-vivo), y al regar
    const L = { cv, ctx: cv.getContext("2d"), f, W, H, e: datosDe(cv), visible: true, hasta: cv.dataset.vivo ? ahora() + 30 : 0 };
    if (!L.ctx) return;
    lienzos.add(L); pintar(L, QUIETO ? 0 : ahora());
    if ("IntersectionObserver" in window) { L.io = new IntersectionObserver(es => { L.visible = es[es.length - 1].isIntersecting; if (L.visible) despertar(); }, { rootMargin: "40px" }); L.io.observe(cv); }
    if (window.ResizeObserver) { L.ro = new ResizeObserver(() => pintar(L, QUIETO ? 0 : ahora())); L.ro.observe(cv); }
    despertar();
  }
  /* Un lienzo que ya no está en la página (se rearmó la vista) se suelta del todo */
  function soltar(L) { lienzos.delete(L); if (L.io) L.io.disconnect(); if (L.ro) L.ro.disconnect(); }
  let vivo = false, ultimo = 0;
  function despertar() { if (!vivo && !QUIETO) { vivo = true; requestAnimationFrame(marco); } }
  function marco(ms) {
    const t = ms / 1000, enRiego = t - riego.t0 < 1.8 || t - brote.t0 < 1.6;
    let algo = false;
    if (ms - ultimo > (enRiego ? 33 : 70)) {
      ultimo = ms;
      lienzos.forEach(L => { if (!L.cv.isConnected) { soltar(L); return; } if (!L.visible || document.hidden) return; if (t < L.hasta || enRiego) { pintar(L, t); algo = true; } });
    } else algo = [...lienzos].some(L => L.cv.isConnected && L.visible && !document.hidden && (t < L.hasta || enRiego));
    if (algo) requestAnimationFrame(marco); else vivo = false;
  }
  /* Tu elefante riega esa maceta (los lienzos se rearman al marcar: el riego sigue en los nuevos) */
  function regar(id) { riego = { id, t0: ahora() }; lienzos.forEach(L => { L.hasta = Math.max(L.hasta, ahora() + 4); }); if (QUIETO) lienzos.forEach(L => pintar(L, ahora() + 2)); else despertar(); }
  function trasplantar(id) { brote = { id, t0: ahora() + 0.3 }; lienzos.forEach(L => { L.hasta = Math.max(L.hasta, ahora() + 5); }); despertar(); }
  const repintar = () => { colores(); lienzos.forEach(L => { if (!L.cv.isConnected) soltar(L); else pintar(L, QUIETO ? 0 : ahora()); }); };
  new MutationObserver(repintar).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  if (document.fonts && document.fonts.load) document.fonts.load("700 14px Caveat").then(repintar, () => {});
  let espera = null;
  new MutationObserver(() => { if (espera) return; espera = setTimeout(() => { espera = null; lienzos.forEach(L => { if (!L.cv.isConnected) soltar(L); }); document.querySelectorAll("canvas[data-jardin]:not([data-listo])").forEach(montar); }, 20); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { lienzos.forEach(L => { if (L.cv.dataset.vivo) L.hasta = Math.max(L.hasta, ahora() + 8); }); despertar(); } });
  return { montar, regar, trasplantar, repintar };
})();
