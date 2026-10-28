/* ============================================================
   RUMBO · El cielo de insignias en 3D (three.js r128)
   Lo carga cielo.js solo al entrar a Insignias. Un renderer para dos escenas:
   el cielo nocturno con sus constelaciones de medallas y el estudio donde una
   medalla se mira de cerca (se gira, se le da vuelta, brilla su metal).
   D: datos de la app → { orden(), info(id), ganadas(), familias, tocar(id), perdido() }
   ============================================================ */
function crearMotorCielo(T, D) {
  const QUIETO = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const VEL = QUIETO ? 1e-4 : 1;
  const MOVIL = Math.min(screen.width || 1000, screen.height || 1000) < 700;
  const TACTIL = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
  const UI = "'Inter Tight', system-ui, sans-serif", MONO = "ui-monospace, 'IBM Plex Mono', Menlo, monospace";

  let r;
  try { r = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" }); }
  catch (e) { throw new Error("WebGL: " + (e && e.message)); }
  /* WebGL por software (sin GPU): sin movimiento continuo, se dibuja solo cuando algo cambia */
  let LENTO = false;
  try { const gl = r.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info"); LENTO = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))); } catch (e) {}
  const CALMO = QUIETO || LENTO;
  r.setPixelRatio(LENTO ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping;
  const canvas = r.domElement; canvas.className = "cielo__canvas";

  /* -------- Metales, familias y figuras -------- */
  const METAL = {
    bronce: { c: 0xC27A44, css: "#C27A44", luz: "#FFB27A" },
    plata: { c: 0xD4D9E0, css: "#C3C9D2", luz: "#DCE6FF" },
    oro: { c: 0xF0B83E, css: "#E7AE30", luz: "#FFE08A" },
    obsidiana: { c: 0x2A2731, css: "#3A3644", luz: "#C7AEFF" },
  };
  const FAM = {}; D.familias.forEach(f => { FAM[f.id] = f; });
  /* Cada figura: centro en el cielo (yc: giro, pc: altura, en radianes), tamaño s, puntos p y trazos l */
  const FIG = {
    rachas: { yc: 0.52, pc: 0.72, s: 0.085, p: [[-0.85, 0.85], [0.85, 0.85], [0, -0.1], [0, -0.95]], l: [[0, 1], [0, 2], [1, 2], [2, 3]] },
    hitos: { yc: 0.03, pc: 0.74, s: 0.092, p: [[0, 0.95], [0.75, 0], [0, -0.95], [-0.75, 0], [0, 0], [0.52, 0.62]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 0], [4, 5]] },
    foco: { yc: -0.48, pc: 0.6, s: 0.21, p: [[0.98, -0.75], [0.92, -0.25], [0.8, 0.2], [0.5, 0.6], [0, 0.62], [-0.6, 0.45], [-0.98, 0.05], [-0.62, -0.75], [-0.32, -0.75], [0, -0.32], [0.25, -0.75], [0.5, -0.75], [0.38, 0.22]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 2], [3, 12]] },
    rituales: { yc: 0.52, pc: 0.35, s: 0.12, p: [], l: [] },
    habitos: { yc: 0.1, pc: 0.5, s: 0.12, p: [[0, -1], [0.06, -0.5], [0, 0], [-0.06, 0.5], [0, 1]], l: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    vida: { yc: -0.3, pc: 0.3, s: 0.13, p: [[-0.55, 1.25], [-0.18, 0.52], [0.55, 1.25], [0.18, 0.52]], l: [[0, 1], [2, 3]] },
  };
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * 6.283; FIG.rituales.p.push([Math.cos(a) * 0.42, -Math.sin(a) * 0.42]); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * 6.283; FIG.rituales.p.push([Math.cos(a), -Math.sin(a)]); FIG.rituales.l.push([i, (i + 1) % 5], [i, i + 5]); }
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i / 10 * 6.283; FIG.vida.p.push([Math.cos(a) * 0.7, -0.3 + Math.sin(a) * 0.7]); FIG.vida.l.push([4 + i, 4 + (i + 1) % 10]); }
  FIG.vida.l.push([1, 4], [3, 4]);
  const SECRETAS = { buho: [0.27, 0.55], aniversario: [-0.17, 0.43], "anio-nuevo": [0.8, 0.52], remontada: [-0.22, 0.86] };

  /* -------- Utilidades -------- */
  const lerp = (a, b, k) => a + (b - a) * k;
  const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
  const eIO = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const eOut = k => 1 - Math.pow(1 - k, 3);
  const eBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
  function semilla(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function Animador() { this.l = []; }
  Animador.prototype.add = function (dur, fn, demora, fin) { this.l.push({ t: -(demora || 0) * VEL, d: Math.max(1e-4, dur * VEL), fn, fin }); };
  Animador.prototype.tick = function (dt) {
    for (let i = 0; i < this.l.length; i++) {
      const a = this.l[i]; a.t += dt; if (a.t < 0) continue;
      const k = Math.min(1, a.t / a.d); a.fn(k);
      if (k >= 1) { this.l.splice(i--, 1); if (a.fin) a.fin(); }
    }
  };
  Animador.prototype.vacio = function () { return this.l.length === 0; };
  const A = new Animador();

  function mat(c, o) {
    const p = Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o || {});
    if (p.envMapIntensity === undefined) p.envMapIntensity = p.metalness > 0.3 ? 1 : 0.28;
    const m = new T.MeshStandardMaterial(p); m.color.convertSRGBToLinear();
    return m;
  }
  const MATS = {};
  function matMetal(m) {
    if (MATS[m]) return MATS[m];
    const o = { metalness: 1, roughness: m === "bronce" ? 0.34 : 0.24 };
    if (m === "obsidiana") { o.metalness = 0.55; o.roughness = 0.12; }
    return (MATS[m] = mat(METAL[m].c, o));
  }
  const VIDRIOS = {};
  function vidrioDe(m) {
    if (VIDRIOS[m]) return VIDRIOS[m];
    return (VIDRIOS[m] = new T.MeshPhysicalMaterial({ color: new T.Color(0xDCE8F5).lerp(new T.Color(METAL[m].c), 0.5).convertSRGBToLinear(), metalness: 0, roughness: 0.22, transmission: 0.6, transparent: true, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3 }));
  }
  function malla(geo, m, x, y, z) { const me = new T.Mesh(geo, m); if (x !== undefined) me.position.set(x, y, z); return me; }
  function lienzo(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return [c, c.getContext("2d")]; }
  function tex(c, srgb) { const t = new T.CanvasTexture(c); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
  const TEX = {};
  function texCache(k, fn) { if (!TEX[k]) { TEX[k] = fn(); TEX[k].compartida = true; } return TEX[k]; }
  function hexA(hex, a) { const c = new T.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; }
  function oscuro(hex, k) { return "#" + new T.Color(hex).multiplyScalar(k).getHexString(); }
  function rr(g, x, y, w, h, q) { g.beginPath(); g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q); g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath(); }
  /* Texto en arco (arriba o abajo de un círculo de radio rad, ya trasladado al centro) */
  function arco(g, txt, rad, arriba) {
    const anchos = [], esp = 3; let total = 0;
    for (let i = 0; i < txt.length; i++) { anchos.push(g.measureText(txt[i]).width); total += anchos[i] + (i ? esp : 0); }
    let a = arriba ? -total / 2 / rad : total / 2 / rad;
    for (let i = 0; i < txt.length; i++) {
      const medio = a + (arriba ? 1 : -1) * anchos[i] / 2 / rad;
      g.save(); g.rotate(medio); g.translate(0, arriba ? -rad : rad); g.fillText(txt[i], 0, 0); g.restore();
      a += (arriba ? 1 : -1) * (anchos[i] + esp) / rad;
    }
  }
  /* Íconos de línea grabados en las medallas, en una caja de 100 × 100 */
  function icono(g, tipo, cx, cy, s, color, grosor) {
    g.save(); g.translate(cx - s / 2, cy - s / 2); g.scale(s / 100, s / 100);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = grosor || 7; g.lineCap = "round"; g.lineJoin = "round";
    const P = d => g.stroke(new Path2D(d)), F = d => g.fill(new Path2D(d));
    const C = (x, y, q, lleno) => { g.beginPath(); g.arc(x, y, q, 0, Math.PI * 2); if (lleno) g.fill(); else g.stroke(); };
    switch (tipo) {
      case "llama": P("M50 8 C58 26 78 38 76 62 C74 82 62 92 50 92 C38 92 26 82 24 62 C23 46 36 38 40 24 C44 34 50 36 50 36 C50 26 50 16 50 8 Z"); P("M50 58 C56 66 60 72 58 80 C56 86 44 86 42 80 C40 72 46 66 50 58 Z"); break;
      case "brujula": C(50, 50, 40); F("M50 16 L60 50 L40 50 Z"); P("M50 16 L60 50 L50 84 L40 50 Z"); break;
      case "elefante": P("M40 34 C50 24 80 24 88 40 C92 50 90 62 88 66 L88 84 L78 84 L77 70 L58 70 L57 84 L47 84 L46 66 C40 66 36 62 34 58 C30 66 28 76 22 82 C18 86 12 84 14 78 C18 74 20 64 18 54 C16 40 26 30 40 34 Z"); P("M44 40 C56 38 60 52 52 60"); C(29, 45, 3.5, true); break;
      case "reloj": C(50, 56, 36); P("M50 8 L50 18 M40 8 L60 8 M50 56 L50 34 M50 56 L64 62"); break;
      case "sol": C(50, 50, 16); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(50 + Math.cos(a) * 27, 50 + Math.sin(a) * 27); g.lineTo(50 + Math.cos(a) * 41, 50 + Math.sin(a) * 41); g.stroke(); } break;
      case "luna": P("M64 14 A36 36 0 1 0 64 86 A28 28 0 1 1 64 14 Z"); break;
      case "calendario": rr(g, 14, 20, 72, 68, 10); g.stroke(); P("M14 40 L86 40 M32 12 L32 28 M68 12 L68 28"); C(50, 64, 11); break;
      case "rayo": P("M56 8 L24 56 L48 56 L42 92 L76 42 L52 42 Z"); break;
      case "brote": P("M50 92 L50 46"); P("M50 58 C30 58 20 44 22 28 C40 28 50 40 50 58 Z"); P("M50 48 C54 30 68 20 82 22 C82 40 68 50 50 48 Z"); break;
      case "pesa": P("M30 50 L70 50"); rr(g, 14, 30, 14, 40, 4); g.stroke(); rr(g, 72, 30, 14, 40, 4); g.stroke(); P("M8 42 L8 58 M92 42 L92 58"); break;
      case "moneda": C(50, 50, 38); C(50, 50, 27); g.font = "800 40px " + UI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("$", 50, 52); break;
      case "libro": P("M50 30 C38 22 24 22 12 26 L12 78 C24 74 38 74 50 82 C62 74 76 74 88 78 L88 26 C76 22 62 22 50 30 Z M50 30 L50 82"); break;
      case "pluma": P("M82 12 C50 14 26 38 22 76 L18 92 M22 76 C42 74 62 62 72 44 C78 32 81 22 82 12 Z M34 64 L58 40"); break;
      case "corazon": P("M50 84 C20 64 10 46 18 30 C26 16 44 18 50 32 C56 18 74 16 82 30 C90 46 80 64 50 84 Z"); break;
      case "flecha": P("M50 62 L50 12 M32 30 L50 12 L68 30 M24 46 L24 86 L76 86 L76 46"); break;
      case "medalla": C(50, 62, 24); P("M34 10 L46 40 M66 10 L54 40"); break;
      case "buho": P("M26 30 L34 14 L42 26 M74 30 L66 14 L58 26 M26 30 C14 60 26 90 50 90 C74 90 86 60 74 30 C66 22 34 22 26 30 Z"); C(38, 44, 9); C(62, 44, 9); P("M46 58 L50 64 L54 58"); break;
      case "torta": rr(g, 18, 52, 64, 34, 6); g.stroke(); P("M18 66 C30 72 40 60 50 66 C60 72 70 60 82 66 M50 52 L50 32"); F("M50 14 C56 22 56 28 50 30 C44 28 44 22 50 14 Z"); break;
      case "fuegos": for (let j = 0; j < 10; j++) { const b2 = j / 10 * Math.PI * 2; g.beginPath(); g.moveTo(50 + Math.cos(b2) * 14, 50 + Math.sin(b2) * 14); g.lineTo(50 + Math.cos(b2) * 40, 50 + Math.sin(b2) * 40); g.stroke(); } C(50, 50, 5, true); break;
      case "vuelta": P("M78 40 A30 30 0 0 0 24 34 M22 18 L24 34 L40 34 M22 60 A30 30 0 0 0 76 66 M78 82 L76 66 L60 66"); break;
      default: g.font = "800 70px " + UI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 50, 54);
    }
    g.restore();
  }

  /* Reflejos para el metal: un estudio de fotografía chico, pasado por PMREM (una vez) */
  let ENV = null;
  function envEstudio() {
    if (ENV) return ENV;
    const s = new T.Scene();
    s.add(new T.Mesh(new T.BoxGeometry(24, 14, 24), new T.MeshBasicMaterial({ color: 0x1C1A18, side: T.BackSide })));
    const panel = (w, h, x, y, z, rx, ry, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    panel(12, 12, 0, 6.8, 0, Math.PI / 2, 0, new T.Color(2.6, 2.45, 2.2));
    panel(3, 7, -11.5, 1.5, 2, 0, Math.PI / 2, new T.Color(2.4, 2.2, 1.9));
    panel(2.4, 7, 11.5, 2, -1, 0, -Math.PI / 2, new T.Color(1.6, 1.55, 1.6));
    panel(8, 2.2, 0, 1.2, 11.5, 0, Math.PI, new T.Color(1.3, 1.26, 1.3));
    panel(24, 1, 0, -2.4, -11.8, 0, 0, new T.Color(0.5, 0.45, 0.39));
    const pm = new T.PMREMGenerator(r); ENV = pm.fromScene(s, 0.035).texture; pm.dispose();
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return ENV;
  }

  /* Texturas de luz (compartidas) */
  function texSuave() { return texCache("suave", () => { const [c, g] = lienzo(128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,.55)"); gr.addColorStop(0.55, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c); }); }
  function texAnillo() { return texCache("anillo", () => { const [c, g] = lienzo(128); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 52, 0, 6.283); g.stroke(); g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 16; g.beginPath(); g.arc(64, 64, 52, 0, 6.283); g.stroke(); return tex(c); }); }
  function texBrillo() {
    return texCache("brillo", () => {
      const [c, g] = lienzo(128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,.95)"); gr.addColorStop(0.3, "rgba(255,255,255,.28)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      g.globalCompositeOperation = "lighter";
      [[64, 0, 64, 128], [0, 64, 128, 64]].forEach(l => { const lg = g.createLinearGradient(l[0], l[1], l[2], l[3]); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,.55)"); lg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = lg; if (l[0] === 64) g.fillRect(62, 0, 4, 128); else g.fillRect(0, 62, 128, 4); });
      return tex(c);
    });
  }
  function texEstela() { return texCache("estela", () => { const [c, g] = lienzo(256, 32), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.85, "rgba(220,230,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,1)"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 16); g.lineTo(256, 8); g.lineTo(256, 24); g.closePath(); g.fill(); return tex(c); }); }
  function brillo(grupo, color, s, x, y, z, opa) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: texSuave(), color, transparent: true, opacity: opa === undefined ? 1 : opa, depthWrite: false, blending: T.AdditiveBlending }));
    sp.scale.setScalar(s); sp.position.set(x, y, z); grupo.add(sp); return sp;
  }
  function texTexto(l1, l2) {
    const [c, g] = lienzo(512, 128); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#EEF1FF"; g.font = "800 44px " + UI; g.fillText(l1, 256, 46);
    g.font = "600 24px " + MONO; g.fillStyle = "#B7C0E6"; g.fillText(l2, 256, 96); return tex(c);
  }
  /* Rótulo de una constelación en el cielo: su figura y cuántas lleva */
  function texRotulo(l1, l2) {
    const [c, g] = lienzo(512, 160); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#EEF1FF"; g.font = "800 50px " + UI; g.fillText(l1, 256, 52);
    g.font = "600 34px " + UI; g.fillStyle = "#B7C0E6"; g.fillText(l2, 256, 118); return tex(c);
  }
  const figNombre = f => FAM[f].fig.replace(/^(La|El) /, "").toUpperCase();

  /* Libera lo que no es compartido (materiales y texturas de caché se quedan) */
  function compartido(m) { for (const k in MATS) if (MATS[k] === m) return true; for (const k in VIDRIOS) if (VIDRIOS[k] === m) return true; return false; }
  function liberar(o3) {
    o3.traverse(o => {
      if (o.geometry && !o.isSprite) o.geometry.dispose();   // los sprites comparten una sola geometría
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      ms.forEach(m => { if (compartido(m)) return; ["map", "bumpMap"].forEach(t => { if (m[t] && !m[t].compartida) m[t].dispose(); }); m.dispose(); });
    });
  }

  /* -------- La medalla: silueta por familia, cara y reverso grabados -------- */
  const CONTORNOS = {}, EXT = 2.3;
  function contorno(f) {
    f = f || "vida";
    if (CONTORNOS[f]) return CONTORNOS[f];
    let pts = [];
    const polar = (N, fn, a0) => { for (let i = 0; i < N; i++) { const a = (a0 || 0) + Math.PI / 2 + i / N * Math.PI * 2, q = fn(i); pts.push([Math.cos(a) * q, Math.sin(a) * q]); } };
    if (f === "rachas") polar(240, i => { const t = (i / 240 * 16) % 1, tri = 1 - Math.abs(t * 2 - 1); return 0.9 + 0.15 * Math.pow(tri, 2.4); });
    else if (f === "hitos") polar(16, i => (i % 4 === 0 ? 1.12 : i % 2 ? 0.76 : 0.94));
    else if (f === "rituales") polar(32, i => (i % 2 ? 0.88 : 1.06));
    else if (f === "habitos") polar(8, () => 1.0, Math.PI / 8);
    else if (f === "vida") polar(120, () => 0.96);
    else if (f === "foco") { const s = new T.Shape(); s.moveTo(-0.86, 0.9); s.lineTo(0.86, 0.9); s.bezierCurveTo(0.9, 0.1, 0.62, -0.62, 0, -1.08); s.bezierCurveTo(-0.62, -0.62, -0.9, 0.1, -0.86, 0.9); s.getPoints(40).forEach(p => pts.push([p.x, p.y + 0.06])); pts.pop(); }
    else pts = [[0, 1.1], [0.42, 0.7], [0.78, 0.36], [0.62, -0.3], [0.3, -1.02], [-0.3, -1.02], [-0.62, -0.3], [-0.78, 0.36], [-0.42, 0.7]];
    const sh = new T.Shape(); pts.forEach((p, k) => { if (k) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); sh.closePath();
    return (CONTORNOS[f] = { pts, shape: sh, anillo: { hitos: 0.5, foco: 0.5, secretas: 0.46 }[f] || 0.6, texto: { hitos: 0.63, foco: 0.68, secretas: 0.62 }[f] || 0.75 });
  }
  function trazar(g, pts, N, esc) { const k = N / EXT * (esc || 1); g.beginPath(); pts.forEach((p, i) => { const x = N / 2 + p[0] * k, y = N / 2 - p[1] * k; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }
  /* Cara o reverso: un mapa de color (grabados oscuros) y uno de relieve (blanco = alto) */
  function caraMedalla(I, dorso) {
    const N = 512, k = N / EXT, C = contorno(I.fam), [cA, ga] = lienzo(N), [cR, gr] = lienzo(N), c = N / 2;
    ga.fillStyle = "#BDBDBD"; ga.fillRect(0, 0, N, N); gr.fillStyle = "#000"; gr.fillRect(0, 0, N, N);
    trazar(ga, C.pts, N); ga.fillStyle = "#E0E0E0"; ga.fill();
    trazar(gr, C.pts, N); gr.fillStyle = "#707070"; gr.fill();
    [ga, gr].forEach((g, j) => { trazar(g, C.pts, N, 0.9); g.strokeStyle = "#FFFFFF"; g.lineWidth = j ? 10 : 7; g.stroke(); });
    const ambos = fn => { fn(ga, false); fn(gr, true); };
    const arcoTxt = (g, txt, rad, tam) => {
      g.save(); g.translate(c, c); let s = tam; g.font = `800 ${s}px ${UI}`;
      while (g.measureText(txt).width + txt.length * 3 > Math.PI * rad * 0.92 && s > 12) { s -= 1; g.font = `800 ${s}px ${UI}`; }
      g.textAlign = "center"; g.textBaseline = "middle"; arco(g, txt, rad, true); g.restore();
    };
    if (!dorso) {
      ambos((g, rel) => { g.strokeStyle = "#FFFFFF"; g.lineWidth = rel ? 7 : 5; g.beginPath(); g.arc(c, c, C.anillo * k, 0, 6.283); g.stroke(); });
      ambos((g, rel) => icono(g, I.oculta ? "?" : I.ic, c, c - 4, C.anillo * k * 1.45, "#FFFFFF", rel ? 10 : 8));
      ambos((g, rel) => { g.fillStyle = rel ? "#1A1A1A" : "#7E7E7E"; arcoTxt(g, I.oculta ? "SECRETA" : I.nombreCorto.toUpperCase(), C.texto * k, 30); });
      ambos((g, rel) => {
        const y = c + C.anillo * k + (C.texto - C.anillo) * k * 0.55;
        if (I.serie) for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(c + (i - 1) * 26, y, 8, 0, 6.283); if (i <= I.nivel) { g.fillStyle = "#FFFFFF"; g.fill(); } else { g.strokeStyle = rel ? "#1A1A1A" : "#8A8A8A"; g.lineWidth = 3; g.stroke(); } }
        else { g.fillStyle = "#FFFFFF"; g.beginPath(); for (let j = 0; j <= 10; j++) { const a = -Math.PI / 2 + j / 10 * 6.283, q = j % 2 ? 4.5 : 11; g.lineTo(c + Math.cos(a) * q, y + Math.sin(a) * q); } g.fill(); }
      });
    } else {
      const F = FIG[I.fam];
      ambos((g, rel) => { g.fillStyle = rel ? "#1A1A1A" : "#7E7E7E"; arcoTxt(g, F ? "RUMBO · " + FAM[I.fam].fig.toUpperCase() : I.fam === "secretas" ? "SECRETA · RUMBO" : "RUMBO", C.texto * k, 24); });
      if (F && I.idx >= 0) {
        let mx = 0.01; F.p.forEach(p => { mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1])); });
        const esc = C.anillo * k * 0.92 / mx, cy = c - 8, P = p => [c + p[0] * esc, cy - p[1] * esc];
        ambos((g, rel) => { g.strokeStyle = rel ? "#1A1A1A" : "#8A8A8A"; g.lineWidth = rel ? 5 : 3; F.l.forEach(par => { const a = P(F.p[par[0]]), d = P(F.p[par[1]]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(d[0], d[1]); g.stroke(); }); });
        ambos(g => { g.fillStyle = "#FFFFFF"; F.p.forEach((p, j) => { const q = P(p); g.beginPath(); g.arc(q[0], q[1], j === I.idx ? 9 : 6, 0, 6.283); g.fill(); }); const q2 = P(F.p[I.idx]); g.strokeStyle = "#FFFFFF"; g.lineWidth = 4; g.beginPath(); g.arc(q2[0], q2[1], 19, 0, 6.283); g.stroke(); });
      } else ambos(g => { g.fillStyle = "#FFFFFF"; g.font = "800 150px " + UI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", c, c - 14); });
      const av = I.avance, l1 = I.gano ? (I.fecha ? "GANADA EL" : "GANADA") : "POR GANAR";
      const l2 = I.gano ? I.fecha.toUpperCase() : av ? (av.u === "%" ? `${av.v}% DE ${av.meta}%` : `${av.v} DE ${av.meta}`) : "";
      ambos((g, rel) => {
        g.fillStyle = rel ? "#1A1A1A" : "#7E7E7E"; g.textAlign = "center"; g.textBaseline = "middle";
        const chico = C.anillo < 0.6;   // escudo y rombos se angostan abajo: letra más chica y más arriba
        g.font = `700 ${chico ? 17 : 20}px ${MONO}`; g.fillText(l1, c, c + C.anillo * k + (chico ? 12 : 18));
        g.font = `800 ${chico ? 21 : 26}px ${MONO}`; g.fillText(l2, c, c + C.anillo * k + (chico ? 35 : 46));
      });
    }
    const tA = tex(cA), tR = tex(cR, false);
    [tA, tR].forEach(t => { t.repeat.set(1 / EXT, 1 / EXT); t.offset.set(0.5, 0.5); });
    return [tA, tR];
  }
  function heroMedalla(I) {
    const g = new T.Group(), C = contorno(I.fam), M = METAL[I.metal], gano = I.gano;
    const geo = new T.ExtrudeGeometry(C.shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 3, curveSegments: 1 }); geo.translate(0, 0, -0.06);
    const rugo = I.metal === "obsidiana" ? 0.1 : 0.27, colorV = new T.Color(0xDCE8F5).lerp(new T.Color(M.c), 0.5).convertSRGBToLinear();
    g.add(new T.Mesh(geo, gano ? mat(M.c, { metalness: 1, roughness: rugo, envMapIntensity: 1.4 }) : vidrioDe(I.metal)));
    [false, true].forEach(dorso => {
      const [map, bumpMap] = caraMedalla(I, dorso), o = { map, bumpMap, bumpScale: 0.022, envMapIntensity: 1.4 };
      const mt = gano ? new T.MeshStandardMaterial(Object.assign({ color: new T.Color(M.c).convertSRGBToLinear(), metalness: 1, roughness: rugo + 0.04 }, o))
        : new T.MeshPhysicalMaterial(Object.assign({ color: colorV, metalness: 0, roughness: 0.25, transmission: 0.5, transparent: true, clearcoat: 1, clearcoatRoughness: 0.1 }, o));
      const d = new T.Mesh(new T.ShapeGeometry(C.shape), mt); d.position.z = dorso ? -0.112 : 0.112; if (dorso) d.rotation.y = Math.PI; g.add(d);
    });
    if (I.fam === "vida") {   // La Medalla: con cinta y argolla
      const [lc, gc] = lienzo(64, 256); [["#E4532F", 0, 22], ["#F4EDE3", 22, 20], ["#E4532F", 42, 22]].forEach(x => { gc.fillStyle = x[0]; gc.fillRect(x[1], 0, x[2], 256); });
      const mc = mat(0xFFFFFF, { map: tex(lc), roughness: 0.7, side: T.DoubleSide });
      [1, -1].forEach(s => { const cinta = new T.Mesh(new T.PlaneGeometry(0.34, 1.05), mc); cinta.position.set(s * 0.22, 1.36, -0.03); cinta.rotation.z = s * 0.38; g.add(cinta); });
      g.add(malla(new T.TorusGeometry(0.09, 0.025, 10, 28), gano ? matMetal(I.metal) : vidrioDe(I.metal), 0, 0.98, 0));
      g.position.y = -0.3;
    }
    return g;
  }
  /* De lejos, en el cielo: una medalla chica por insignia */
  function texNodo(I, on) {
    return texCache(`nodo:${I.fam}:${I.metal}:${I.ic}:${on ? 1 : 0}`, () => {
      const [cv, g] = lienzo(128), M = METAL[I.metal], c = 64, C = contorno(I.fam);
      if (on) { const gl = g.createRadialGradient(c, c, 8, c, c, 64); gl.addColorStop(0, hexA(M.luz, 0.5)); gl.addColorStop(1, hexA(M.luz, 0)); g.fillStyle = gl; g.fillRect(0, 0, 128, 128); }
      g.beginPath(); C.pts.forEach((p, i) => { const x = c + p[0] * 42, y = c - p[1] * 42; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      if (on) { const gm = g.createLinearGradient(30, 20, 100, 108); gm.addColorStop(0, "#FFFFFF"); gm.addColorStop(0.42, M.css); gm.addColorStop(1, oscuro(M.c, 0.55)); g.fillStyle = gm; g.fill(); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 3; g.stroke(); icono(g, I.ic, c, c, 44, "rgba(36,26,12,.75)", 9); }
      else { g.strokeStyle = "rgba(160,175,215,.8)"; g.lineWidth = 3.5; g.stroke(); icono(g, I.ic, c, c, 38, "rgba(160,175,215,.5)", 7); }
      return tex(cv);
    });
  }

  /* -------- El elefante de Rumbo, en silueta sobre la loma -------- */
  function crearElefante(piel) {
    const el = { g: new T.Group(), alza: 0.85, orejaBase: 1.35, orejas: [], ojos: [], trompa: [] }, g = el.g, esf = new T.SphereGeometry(1, 24, 16);
    const negro = mat(0x141416, { roughness: 0.3 }), blanco = new T.MeshBasicMaterial({ color: 0xFFFFFF });
    const cuerpo = new T.Group(); g.add(cuerpo);
    [[0.1, 1.08, 0, 0.9, 0.78, 0.72], [-0.4, 1.04, 0, 0.66, 0.72, 0.68], [0.55, 1.22, 0, 0.44, 0.52, 0.52]].forEach(p => { const m = malla(esf, piel, p[0], p[1], p[2]); m.scale.set(p[3], p[4], p[5]); cuerpo.add(m); });
    const pg = new T.CylinderGeometry(0.21, 0.25, 0.68, 16);
    [[0.48, 0.32], [0.48, -0.32], [-0.54, 0.3], [-0.54, -0.3]].forEach(p => g.add(malla(pg, piel, p[0], 0.34, p[1])));
    const cola = new T.Group(); cola.position.set(-1.02, 1.12, 0); cola.rotation.z = -0.45; g.add(cola);
    cola.add(malla(new T.CylinderGeometry(0.022, 0.032, 0.44, 8), piel, 0, -0.22, 0));
    const mechon = malla(esf, piel, 0, -0.45, 0); mechon.scale.set(0.055, 0.09, 0.055); cola.add(mechon);
    const cab = new T.Group(); cab.position.set(0.95, 1.52, 0); cab.rotation.z = 0.5; g.add(cab);
    const cr = malla(esf, piel); cr.scale.set(0.56, 0.54, 0.54); cab.add(cr);
    const frente = malla(esf, piel, 0.1, 0.2, 0); frente.scale.set(0.44, 0.38, 0.46); cab.add(frente);
    [1, -1].forEach(s => {
      const piv = new T.Group(); piv.position.set(-0.14, 0.06, s * 0.34); cab.add(piv);
      const o = malla(esf, piel, -0.06, -0.06, s * 0.34); o.scale.set(0.07, 0.54, 0.46); piv.add(o);
      el.orejas.push({ p: piv, s });
    });
    [1, -1].forEach(s => {
      const ojo = malla(esf, negro, 0.45, 0.16, s * 0.25); ojo.scale.setScalar(0.06); ojo.userData.r = 0.06; cab.add(ojo); el.ojos.push(ojo);
      const br = malla(esf, blanco, 0.5, 0.185, s * 0.235); br.scale.setScalar(0.019); br.userData.r = 0.019; cab.add(br); el.ojos.push(br);
    });
    const nT = 13;
    for (let i = 0; i < nT; i++) { const tr = malla(esf, piel); tr.scale.setScalar(i === nT - 1 ? 0.085 : lerp(0.2, 0.072, i / (nT - 1))); cab.add(tr); el.trompa.push(tr); }
    let x, y;
    el.ponerTrompa = () => {
      x = 0.46; y = -0.1;
      for (let i = 0; i < nT; i++) {
        const s = i / (nT - 1), ang = lerp(-0.62 - 1.0 * s + 0.95 * s * s * s, -0.25 + 2.35 * s, el.alza);
        el.trompa[i].position.set(x, y, 0); x += Math.cos(ang) * 0.078; y += Math.sin(ang) * 0.078;
      }
    };
    el.ponerTrompa();
    el.vivo = t => {
      cuerpo.scale.y = 1 + 0.012 * Math.sin(t * 2.1);
      const f = CALMO ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.8)), 10);
      el.orejas.forEach(o => { o.p.rotation.y = -o.s * (el.orejaBase + 0.42 * f); });
      const parp = !CALMO && (t % 4.3) < 0.12 ? 0.12 : 1;
      el.ojos.forEach(o => { o.scale.y = o.userData.r * parp; });
    };
    return el;
  }

  /* ============================================================
     EL CIELO
     ============================================================ */
  const POS = new T.Vector3(1.0, 1.3, 7.6), R = 60;
  const VISTA = { yaw: 0.02, pitch: 0.45, fov: 56, aspecto: 1.6, lim: { yaw: [-0.6, 0.6], pitch: [-0.22, 0.3] }, vaiven: 0.025 };
  const dirMirar = (yaw, pitch) => new T.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  const enCielo = (yaw, pitch, rad) => dirMirar(yaw, pitch).multiplyScalar(rad || R).add(POS);
  const cielo = { escena: new T.Scene(), u: { yaw: 0, pitch: 0 }, uObj: { yaw: 0, pitch: 0 }, nodos: {}, porFam: {}, lineas: [], rotulos: {} };
  const cam = new T.PerspectiveCamera(56, 1.6, 0.1, 400);
  let uE = null, elefante = null, halo = null, fugaz = null;
  (function armarCielo() {
    const e = cielo.escena; e.background = new T.Color(0x05060C);
    const domoM = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false,
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 vP; void main(){ float y = clamp(vP.y, -0.2, 1.0); vec3 c = mix(vec3(0.16,0.21,0.38), vec3(0.05,0.07,0.17), smoothstep(0.0, 0.32, y)); c = mix(c, vec3(0.012,0.016,0.045), smoothstep(0.3, 1.0, y)); float l = pow(max(dot(vP, normalize(vec3(-0.75, 0.32, -0.58))), 0.0), 14.0); c += vec3(0.1, 0.12, 0.2) * l; gl_FragColor = vec4(c, 1.0); }" });
    const domo = new T.Mesh(new T.SphereGeometry(95, 48, 24), domoM); domo.position.copy(POS); e.add(domo);
    const tierra = new T.Mesh(new T.CircleGeometry(90, 48), mat(0x080A12, { roughness: 1 })); tierra.rotation.x = -Math.PI / 2; e.add(tierra);
    const loma = new T.Mesh(new T.SphereGeometry(6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x0A0D1C, { roughness: 1 })); loma.scale.set(1, 0.36, 1); loma.position.set(0, -0.08, 0); e.add(loma);
    const cerroM = mat(0x090C18, { roughness: 1 });
    [[-30, -45, 22, 0.25], [18, -55, 28, 0.2], [-60, -20, 26, 0.3], [55, -30, 24, 0.24], [0, -70, 30, 0.16]].forEach(c => { const m = new T.Mesh(new T.SphereGeometry(c[2], 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cerroM); m.scale.y = c[3]; m.position.set(c[0], 0, c[1]); e.add(m); });
    e.add(new T.HemisphereLight(0x5A6BA8, 0x05060A, 0.55));
    const luna = new T.DirectionalLight(0xB4C2FF, 0.9); luna.position.set(-8, 6, -12); e.add(luna);
    const relleno = new T.DirectionalLight(0x2A3460, 0.18); relleno.position.set(3, 3, 10); e.add(relleno);
    // El elefante sobre la loma, de perfil, con la trompa hacia las estrellas
    elefante = crearElefante(mat(0x1B2141, { roughness: 1 }));
    elefante.g.scale.setScalar(0.62); elefante.g.position.set(0.15, 1.98, 0.2); elefante.g.rotation.y = Math.PI; e.add(elefante.g);
    // Estrellas de fondo y la Vía Láctea
    const rnd = semilla(7), nE = MOVIL ? 1400 : 2200, pe = new Float32Array(nE * 3), ta = new Float32Array(nE), fa = new Float32Array(nE);
    for (let i = 0; i < nE; i++) {
      let d;
      if (i < nE * 0.38) { const u = rnd() * 6.283, off = (rnd() + rnd() + rnd() - 1.5) * 0.12; d = new T.Vector3(Math.cos(u), off, Math.sin(u)); d.applyAxisAngle(new T.Vector3(1, 0, 0.4).normalize(), 0.95); if (d.y < 0) d.y = -d.y; d.normalize(); }
      else { const u2 = rnd() * 6.283, y = 0.02 + Math.pow(rnd(), 0.8) * 0.98, q = Math.sqrt(1 - y * y); d = new T.Vector3(q * Math.cos(u2), y, q * Math.sin(u2)); }
      pe[i * 3] = POS.x + d.x * 80; pe[i * 3 + 1] = POS.y + d.y * 80; pe[i * 3 + 2] = POS.z + d.z * 80; ta[i] = 0.8 + Math.pow(rnd(), 3) * 2.4; fa[i] = rnd() * 6.283;
    }
    const gE = new T.BufferGeometry(); gE.setAttribute("position", new T.BufferAttribute(pe, 3)); gE.setAttribute("tam", new T.BufferAttribute(ta, 1)); gE.setAttribute("fase", new T.BufferAttribute(fa, 1));
    uE = { uT: { value: 0 }, uPR: { value: 1 } };
    e.add(new T.Points(gE, new T.ShaderMaterial({ uniforms: uE, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: "attribute float tam; attribute float fase; uniform float uT; uniform float uPR; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float tw = 0.7 + 0.3 * sin(uT * (1.1 + fase * 0.25) + fase * 7.0); gl_PointSize = tam * uPR * (0.85 + 0.3 * tw); vA = tw * (0.35 + 0.17 * tam); }",
      fragmentShader: "varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(d)); gl_FragColor = vec4(0.86, 0.9, 1.0, a * vA); }" })));
    // Una medalla por insignia: el brillo (que titila) y la medalla chica encima
    D.orden().forEach(id => {
      const I = D.info(id); if (!I || !I.fam) return;
      let yaw, pitch;
      if (I.fam === "secretas") { if (!SECRETAS[id]) return; [yaw, pitch] = SECRETAS[id]; }
      else { const F = FIG[I.fam], p = F && F.p[I.idx]; if (!p) return; yaw = F.yc - p[0] * F.s / Math.cos(F.pc); pitch = F.pc + p[1] * F.s; }
      const pos = enCielo(yaw, pitch);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: texBrillo(), color: new T.Color(METAL[I.metal].luz), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      sp.position.copy(pos); e.add(sp);
      const nodo = new T.Sprite(new T.SpriteMaterial({ map: texNodo(I, false), transparent: true, depthWrite: false }));
      nodo.position.copy(pos).sub(POS).multiplyScalar(0.99).add(POS); nodo.renderOrder = 2; e.add(nodo);
      const E = { id, I, sp, nodo, pos, yaw, pitch, fase: rnd() * 6.28, on: null, pop: 1, tam: { bronce: 1.9, plata: 2.3, oro: 2.9, obsidiana: 2.5 }[I.metal] };
      cielo.nodos[id] = E; (cielo.porFam[I.fam] = cielo.porFam[I.fam] || []).push(E);
      encender(E, false);
    });
    // Los trazos de cada figura: tenues hasta que sus dos medallas se encienden
    Object.keys(FIG).forEach(f => {
      const L = cielo.porFam[f]; if (!L) return;
      FIG[f].l.forEach(par => {
        const a = L[par[0]], b = L[par[1]]; if (!a || !b) return;
        const g = new T.BufferGeometry().setFromPoints([a.pos, b.pos]), m = new T.LineBasicMaterial({ color: 0x6F7DB0, transparent: true, opacity: 0.12, depthWrite: false });
        const ln = new T.Line(g, m); e.add(ln); cielo.lineas.push({ f, a, b, ln, m, g, on: false });
      });
    });
    halo = new T.Sprite(new T.SpriteMaterial({ map: texAnillo(), color: 0xFFFFFF, transparent: true, depthWrite: false, opacity: 0.9 })); halo.visible = false; halo.renderOrder = 3; e.add(halo);
    // La estrella fugaz que trae una medalla nueva
    const cabeza = new T.Sprite(new T.SpriteMaterial({ map: texBrillo(), color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); cabeza.scale.setScalar(2.2); cabeza.visible = false; e.add(cabeza);
    const estela = new T.Sprite(new T.SpriteMaterial({ map: texEstela(), color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); estela.center.set(1, 0.5); estela.visible = false; e.add(estela);
    fugaz = { cabeza, estela, prev: new T.Vector3(), activa: false };
  })();

  function encender(E, on) {
    if (E.on === on) return;
    E.on = on;
    if (on) { E.sp.material.color.set(METAL[E.I.metal].luz); E.sp.material.opacity = 1; E.sp.visible = true; }
    else { E.sp.material.color.set(0x8C9AC4); E.sp.material.opacity = 0.6; E.sp.visible = false; }
    E.nodo.material.map = texNodo(E.I, on); E.nodo.material.needsUpdate = true;
    E.nodo.visible = on || E.I.fam !== "secretas";
  }
  const completa = f => (cielo.porFam[f] || []).every(E => E.on);
  function pintarLineas(f, anim) {
    const oro = completa(f);
    cielo.lineas.forEach(o => {
      if (f && o.f !== f) return;
      const on = o.a.on && o.b.on, dorada = completa(o.f);
      o.m.color.set(on ? (dorada ? 0xFFE3A3 : 0xA9B8E8) : 0x6F7DB0); o.m.opacity = on ? (dorada ? 0.9 : 0.42) : 0.12;
      if (on && !o.on && anim) {   // el trazo nuevo crece desde la vecina hasta la medalla recién llegada
        const p = o.g.attributes.position, de = o.a.nuevo ? o.b : o.a, a = de === o.a ? o.b : o.a, V = new T.Vector3();
        const poner = k => { V.copy(de.pos).lerp(a.pos, eOut(k)); p.setXYZ(0, de.pos.x, de.pos.y, de.pos.z); p.setXYZ(1, V.x, V.y, V.z); p.needsUpdate = true; };
        poner(0); A.add(0.55, poner);
      }
      o.on = on;
    });
    return oro;
  }
  function rotular(f) {
    const F = FIG[f], L = cielo.porFam[f]; if (!F || !L) return;
    const n = L.filter(E => E.on).length, txt = n === L.length ? `${FAM[f].n} · completa` : `${FAM[f].n} · ${n} de ${L.length}`;
    let sp = cielo.rotulos[f];
    if (sp && sp.userData.txt === txt) return sp;
    if (!sp) {
      sp = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
      const ab = F.p.reduce((m, p) => Math.min(m, p[1]), 1), s = limitar(F.s, 0.11, 0.13);
      sp.position.copy(enCielo(F.yc, F.pc + ab * F.s - 0.075, R - 1)); sp.scale.set(s * R * 2.4, s * R * 0.75, 1); cielo.escena.add(sp); cielo.rotulos[f] = sp;
    } else if (sp.material.map) sp.material.map.dispose();
    sp.material.map = texRotulo(figNombre(f), txt); sp.material.needsUpdate = true; sp.userData.txt = txt;
    sp.material.opacity = n === L.length ? 0.9 : 0.42;
    return sp;
  }

  /* Medallas nuevas desde la última visita: llegan como estrella fugaz */
  const leerVisto = () => D.visto(), guardarVisto = ids => D.guardarVisto(ids);
  const V0 = new T.Vector3();
  function llegar(E, demora) {
    const ini = enCielo(E.yaw + 0.42, E.pitch + 0.2), fin = E.pos;
    A.add(0.01, () => { fugaz.cabeza.visible = fugaz.estela.visible = true; fugaz.prev.copy(ini); fugaz.activa = true; etiquetaNueva(E); }, demora);
    A.add(1.15, k => {
      const kk = eOut(k); V0.copy(ini).lerp(fin, kk).sub(POS).normalize().multiplyScalar(R).add(POS);
      fugaz.prev.copy(fugaz.cabeza.position); fugaz.cabeza.position.copy(V0); fugaz.estela.position.copy(V0);
      fugaz.estela.scale.set(lerp(16, 2, kk), 0.7, 1); fugaz.estela.material.opacity = 1 - kk * 0.6;
    }, demora, () => { fugaz.cabeza.visible = fugaz.estela.visible = false; fugaz.activa = false; });
    A.add(0.7, k => {
      if (!E.on) {
        E.nuevo = true; encender(E, true); pintarLineas(E.I.fam, true); E.nuevo = false;
        const sp = rotular(E.I.fam); if (sp && completa(E.I.fam)) sp.material.opacity = 0.42;
      }
      E.pop = k < 0.3 ? lerp(0.5, 3.2, k / 0.3) : lerp(3.2, 1, eOut((k - 0.3) / 0.7));
    }, demora + 1.1);
    A.add(0.9, k => { const sp = cielo.rotulos[E.I.fam]; if (sp && completa(E.I.fam)) sp.material.opacity = 0.42 + 0.48 * k; }, demora + 2.0);
  }
  let etqNueva = null;
  function etiquetaNueva(E) { etqNueva = { E, hasta: reloj + 3.2 }; }

  /* Pone cada medalla como está en el estado (y celebra las recién ganadas) */
  function actualizar() {
    const gan = D.ganadas(), visto = leerVisto(), nuevas = [];
    Object.values(cielo.nodos).forEach(E => {
      const on = gan.has(E.id);
      if (on && !E.on && visto && !visto.includes(E.id) && !QUIETO && nuevas.length < 4) nuevas.push(E);
      else encender(E, on);
    });
    Object.keys(FIG).forEach(f => { pintarLineas(f, false); rotular(f); });
    nuevas.forEach((E, i) => llegar(E, 0.5 + i * 2.6));
    guardarVisto([...gan]);
    pedir();
  }

  function ponerCamara(t) {
    const vaiven = CALMO || arrastre ? 0 : Math.sin(t * 0.21) * VISTA.vaiven;
    // En vertical (celular) el lente se abre poco: el cielo se recorre arrastrando y no sobra suelo abajo
    const asp = ancho / alto, rel = VISTA.aspecto / asp, yaw = VISTA.yaw + cielo.u.yaw + vaiven, pitch = VISTA.pitch + cielo.u.pitch + (asp < 1 ? 0.02 : 0);
    cam.aspect = asp; cam.fov = VISTA.fov * limitar(Math.pow(rel, 0.6), 1, 1.12);
    cam.position.copy(POS); const d = dirMirar(yaw, pitch); cam.lookAt(POS.x + d.x, POS.y + d.y, POS.z + d.z);
    cam.updateProjectionMatrix();
  }
  const PV = new T.Vector3();
  function enPantalla(v) { PV.copy(v).project(cam); return PV.z < 1 && PV.z > -1 ? [(PV.x + 1) / 2 * ancho, (1 - PV.y) / 2 * alto] : null; }
  /* ¿Qué medalla hay bajo el dedo? La más cercana dentro de un radio */
  function nodoEn(x, y) {
    let mejor = null, dmin = TACTIL ? 34 : 24;
    Object.values(cielo.nodos).forEach(E => {
      if (!E.nodo.visible) return; const p = enPantalla(E.pos); if (!p) return;
      const d = Math.hypot(p[0] - x, p[1] - y); if (d < dmin) { dmin = d; mejor = E; }
    });
    return mejor;
  }
  let hoverE = null;
  function hover(E) {
    if (E === hoverE) return;
    hoverE = E; canvas.style.cursor = E ? "pointer" : "";
    halo.visible = !!E; pedir();
    if (!E) etiqueta(null);
  }
  function etiqueta(E, titulo) {
    const el = document.getElementById("cieloEtq"); if (!el) return;
    if (!E) { el.hidden = true; el.dataset.id = ""; return; }
    if (el.dataset.id !== E.id || el.dataset.titulo !== (titulo || "")) {   // el texto se arma una vez; cada cuadro solo se mueve
      const I = D.info(E.id); if (!I) { el.hidden = true; return; }
      el.innerHTML = "<b></b><span></span>"; el.querySelector("b").textContent = I.oculta ? "Secreta" : I.b.nombre;
      el.querySelector("span").textContent = titulo || (I.gano ? (I.fecha ? "Ganada el " + I.fecha : "Ganada") : I.avance ? I.avance.txt : "Por ganar");
      el.dataset.id = E.id; el.dataset.titulo = titulo || "";
    }
    const p = enPantalla(E.pos); if (!p) { el.hidden = true; return; }
    el.hidden = false; el.style.left = p[0] + "px"; el.style.top = p[1] + "px";
  }

  /* ============================================================
     DE CERCA: el estudio nocturno donde se mira una medalla
     ============================================================ */
  let est = null, hero = null;
  const camI = new T.PerspectiveCamera(30, 1, 0.05, 200), giro = { rot: 0, obj: 0, vel: 0, pitch: 0.12, zoom: 1, quieto: 2 };
  function domo(arriba, abajo, foco) {
    const m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: { a: { value: new T.Color(arriba) }, b: { value: new T.Color(abajo) }, f: { value: new T.Color(foco) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 a; uniform vec3 b; uniform vec3 f; varying vec3 vP; void main(){ vec3 c = mix(b, a, smoothstep(-0.5, 0.7, vP.y)); float s = pow(max(dot(vP, normalize(vec3(0.0, 0.25, -1.0))), 0.0), 3.0); c = mix(c, f, s * 0.85); gl_FragColor = vec4(c, 1.0); }" });
    return new T.Mesh(new T.SphereGeometry(60, 48, 24), m);
  }
  function estudio() {
    if (est) return est;
    est = { escena: new T.Scene(), giro: new T.Group() }; const e = est.escena; e.add(est.giro);
    e.add(domo(0x0B1030, 0x03040A, 0x1B2550));
    const ne = 900, pe = new Float32Array(ne * 3), rnd = semilla(12);
    for (let i = 0; i < ne; i++) { const u = rnd() * 6.283, y2 = rnd() * 2 - 1, q = Math.sqrt(1 - y2 * y2); pe[i * 3] = Math.cos(u) * q * 40; pe[i * 3 + 1] = y2 * 40; pe[i * 3 + 2] = Math.sin(u) * q * 40; }
    const ge = new T.BufferGeometry(); ge.setAttribute("position", new T.BufferAttribute(pe, 3));
    e.add(new T.Points(ge, new T.PointsMaterial({ color: 0xDDE6FF, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false })));
    e.add(new T.HemisphereLight(0x6070B0, 0x05060A, 0.5));
    const c4 = new T.DirectionalLight(0xFFFFFF, 1.5); c4.position.set(-3, 4, 5); e.add(c4);
    const c5 = new T.DirectionalLight(0xA8B8FF, 1.2); c5.position.set(3, 2, -4); e.add(c5);
    e.environment = envEstudio();
    return est;
  }
  /* La medalla con su constelación detrás (la estrella que es ella queda justo a su espalda) */
  function heroDe(id) {
    const I = D.info(id), g = new T.Group(), luz = new T.Color(METAL[I.metal].luz);
    const cuerpo = new T.Group(); cuerpo.add(heroMedalla(I)); g.add(cuerpo);
    const nc = 90, pc = new Float32Array(nc * 3), rc = semilla(id.length * 31 + 5);
    for (let k = 0; k < nc; k++) { const a = rc() * 6.283, y = (rc() - 0.5) * 2, q = 1.5 + rc() * 0.9, h = Math.sqrt(1 - y * y * 0.6); pc[k * 3] = Math.cos(a) * q * h; pc[k * 3 + 1] = y * q * 0.6; pc[k * 3 + 2] = Math.sin(a) * q * h; }
    const gc = new T.BufferGeometry(); gc.setAttribute("position", new T.BufferAttribute(pc, 3));
    const chis = new T.Points(gc, new T.PointsMaterial({ color: luz, size: 0.04, transparent: true, opacity: I.gano ? 0.95 : 0.35, depthWrite: false, blending: T.AdditiveBlending })); g.add(chis);
    const fondo = new T.Group(), S = 3.2, F = FIG[I.fam]; let cx = 0, cy = 0;
    if (F && I.idx >= 0 && F.p[I.idx]) {
      const lista = FAM[I.fam].ids.map(x => D.info(x));
      cx = F.p[I.idx][0] * S; cy = F.p[I.idx][1] * S; fondo.position.set(-cx, -cy, -6);
      F.l.forEach(par => {
        const a = lista[par[0]], b = lista[par[1]]; if (!a || !b) return;
        const on = a.gano && b.gano, gl = new T.BufferGeometry().setFromPoints([new T.Vector3(F.p[par[0]][0] * S, F.p[par[0]][1] * S, 0), new T.Vector3(F.p[par[1]][0] * S, F.p[par[1]][1] * S, 0)]);
        fondo.add(new T.Line(gl, new T.LineBasicMaterial({ color: on ? 0xFFE3A3 : 0xA9B8E8, transparent: true, opacity: on ? 0.6 : 0.2, depthWrite: false })));
      });
      lista.forEach((E, j) => { if (!E || j === I.idx || !F.p[j]) return; const sp = new T.Sprite(new T.SpriteMaterial({ map: texNodo(E, E.gano), transparent: true, opacity: E.gano ? 1 : 0.6, depthWrite: false })); sp.position.set(F.p[j][0] * S, F.p[j][1] * S, 0); sp.scale.setScalar(E.gano ? 1.15 : 0.8); fondo.add(sp); });
      const n = lista.filter(E => E && E.gano).length;
      const rot = new T.Sprite(new T.SpriteMaterial({ map: texTexto(figNombre(I.fam), `${FAM[I.fam].n.toUpperCase()} · ${n} DE ${lista.length}`), transparent: true, opacity: 0.85, depthWrite: false }));
      rot.position.set(cx, cy - 3.6, 0); rot.scale.set(3.4, 0.85, 1); fondo.add(rot);
    } else { brillo(fondo, 0x7B5BFF, 10, 0, 0, 0, 0.35); brillo(fondo, 0xC7AEFF, 5, 1.2, 0.6, 0, 0.2); fondo.position.set(0, 0, -6); }
    brillo(fondo, luz, 8.5, cx, cy, 0, I.gano ? 0.42 : 0.12);
    const anim = t => { cuerpo.position.y = CALMO ? 0 : Math.sin(t * 1.3) * 0.06; chis.rotation.y = CALMO ? 0 : -t * 0.12; };
    return { g, anim, fondo, cuerpo, A: new Animador() };
  }
  /* El momento de ganar: la medalla llega girando entre chispas, se luce un momento y sube a su
     estrella en la constelación, que se enciende (y se vuelve dorada si con ella se completa) */
  const ALZA = 2.3;   // su estrella queda arriba de la medalla, para que se vea el viaje
  function heroGanar(id) {
    const I = D.info(id), g = new T.Group(), luz = new T.Color(METAL[I.metal].luz), An = new Animador();
    const cuerpo = new T.Group(); cuerpo.add(heroMedalla(I)); g.add(cuerpo);
    const aura = brillo(g, luz, 5.5, 0, 0, -0.5, 0);
    // Chispas que salen disparadas cuando llega
    const nb = 80, pb = new Float32Array(nb * 3), dir = [], rb = semilla(id.length * 17 + 3);
    for (let i = 0; i < nb; i++) { const u = rb() * 6.283, y = rb() * 2 - 1, q = Math.sqrt(1 - y * y), v = 1.4 + rb() * 1.6; dir.push([Math.cos(u) * q * v, y * v * 0.8, Math.sin(u) * q * v * 0.6]); }
    const gb = new T.BufferGeometry(); gb.setAttribute("position", new T.BufferAttribute(pb, 3));
    const mb = new T.PointsMaterial({ color: luz, size: 0.07, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    g.add(new T.Points(gb, mb));
    const fondo = new T.Group(), S = 3.2, F = FIG[I.fam], h = { g, fondo, cuerpo, A: An, y0: 0, vuela: false };
    let nodo = null, rot = null, anillo = null, llegada = null, objetivo = null, completa = false, n = 0, N = 0;
    const lineas = [];
    if (F && I.idx >= 0 && F.p[I.idx]) {
      const lista = FAM[I.fam].ids.map(x => D.info(x)), P = j => new T.Vector3(F.p[j][0] * S, F.p[j][1] * S, 0);
      const cx = F.p[I.idx][0] * S, cy = F.p[I.idx][1] * S;
      fondo.position.set(-cx, -cy + ALZA, -6); objetivo = new T.Vector3(0, ALZA, -6);
      F.l.forEach(par => {
        const a = lista[par[0]], b = lista[par[1]]; if (!a || !b) return;
        const toca = par[0] === I.idx || par[1] === I.idx, on = a.gano && b.gano, antes = on && !toca;
        const desde = P(toca && par[1] === I.idx ? par[1] : par[0]), hasta = P(toca && par[1] === I.idx ? par[0] : par[1]);
        const gl = new T.BufferGeometry().setFromPoints([desde, antes ? hasta : desde.clone()]);
        const m = new T.LineBasicMaterial({ color: antes ? 0xA9B8E8 : 0x6F7DB0, transparent: true, opacity: antes ? 0.45 : 0.15, depthWrite: false });
        fondo.add(new T.Line(gl, m)); lineas.push({ m, gl, desde, hasta, on, nueva: on && toca });
        if (!on) gl.attributes.position.setXYZ(1, hasta.x, hasta.y, hasta.z);   // tenue pero entera
      });
      lista.forEach((E, j) => {
        if (!E || !F.p[j]) return;
        const yo = j === I.idx, prendida = E.gano && !yo;
        const sp = new T.Sprite(new T.SpriteMaterial({ map: texNodo(E, prendida), transparent: true, opacity: prendida ? 1 : 0.55, depthWrite: false }));
        sp.position.copy(P(j)); sp.scale.setScalar(prendida ? 1.15 : 0.8); fondo.add(sp); if (yo) nodo = sp;
      });
      N = lista.length; n = lista.filter(E => E && E.gano).length; completa = n === N;
      // La figura entera (con su rótulo abajo): la cámara se aleja hasta verla cuando la medalla sube
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      F.p.forEach(q => { x0 = Math.min(x0, q[0] * S); x1 = Math.max(x1, q[0] * S); y0 = Math.min(y0, q[1] * S); y1 = Math.max(y1, q[1] * S); });
      rot = new T.Sprite(new T.SpriteMaterial({ map: texTexto(figNombre(I.fam), `${FAM[I.fam].n.toUpperCase()} · ${n - 1} DE ${N}`), transparent: true, opacity: 0, depthWrite: false }));
      rot.position.set((x0 + x1) / 2, y0 - 1.5, 0); rot.scale.set(3.4, 0.85, 1); fondo.add(rot);
      const abajo = y0 - 2;
      h.vista = { k: 0, c: new T.Vector3(fondo.position.x + (x0 + x1) / 2, fondo.position.y + (abajo + y1) / 2, -6), mw: Math.max((x1 - x0) / 2, 1.7) + 1, mh: (y1 - abajo) / 2 + 0.9 };
      llegada = brillo(fondo, luz, 4.5, cx, cy, 0, 0);
      anillo = new T.Sprite(new T.SpriteMaterial({ map: texAnillo(), color: luz, transparent: true, opacity: 0, depthWrite: false })); anillo.position.set(cx, cy, 0); fondo.add(anillo);
    } else { brillo(fondo, 0x7B5BFF, 10, 0, 0, 0, 0.35); brillo(fondo, 0xC7AEFF, 5, 1.2, 0.6, 0, 0.2); fondo.position.set(0, 0, -6); }
    const encender = () => {   // su estrella queda prendida y sus trazos, dibujados
      if (!nodo) return;
      nodo.material.map = texNodo(I, true); nodo.material.opacity = 1; nodo.material.needsUpdate = true;
      rot.material.map.dispose(); rot.material.map = texTexto(figNombre(I.fam), completa ? "¡COMPLETA!" : `${FAM[I.fam].n.toUpperCase()} · ${n} DE ${N}`); rot.material.needsUpdate = true;
    };
    const trazo = (o, k) => { const p = o.gl.attributes.position, V = o.desde.clone().lerp(o.hasta, eOut(k)); p.setXYZ(1, V.x, V.y, V.z); p.needsUpdate = true; o.m.color.set(completa ? 0xFFE3A3 : 0xA9B8E8); o.m.opacity = 0.15 + 0.4 * k; };
    h.anim = t => { if (!h.vuela) cuerpo.position.y = h.y0 + (CALMO ? 0 : Math.sin(t * 1.3) * 0.05); };
    if (QUIETO) {   // sin movimiento: la medalla al frente y su estrella ya encendida
      aura.material.opacity = 0.5; encender(); if (nodo) { nodo.scale.setScalar(1.15); rot.material.opacity = 0.85; }
      lineas.forEach(o => { if (o.nueva) trazo(o, 1); if (completa && o.on) { o.m.color.set(0xFFE3A3); o.m.opacity = 0.9; } });
      return h;
    }
    cuerpo.scale.setScalar(0.001);
    An.add(1.3, k => { cuerpo.scale.setScalar(Math.max(0.001, eBack(k))); cuerpo.rotation.y = lerp(-3 * Math.PI, 0, eOut(k)); h.y0 = lerp(-0.6, 0, eOut(k)); aura.material.opacity = 0.55 * eOut(k); });
    An.add(1.3, k => {
      const p = gb.attributes.position, e = eOut(k) * 1.6;
      for (let i = 0; i < nb; i++) p.setXYZ(i, dir[i][0] * e, dir[i][1] * e - 0.6 * k * k, dir[i][2] * e);
      p.needsUpdate = true; mb.opacity = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
    }, 0.3);
    An.add(1.7, k => { cuerpo.rotation.y = Math.sin(k * Math.PI * 2) * 0.35 * (1 - k * 0.4); }, 1.3);
    if (!objetivo) return h;   // las secretas no tienen figura: se quedan brillando
    const P0 = new T.Vector3();
    An.add(1.2, k => {
      if (!h.vuela) { h.vuela = true; P0.copy(cuerpo.position); }
      const q = eIO(k); cuerpo.position.lerpVectors(P0, objetivo, q); cuerpo.scale.setScalar(lerp(1, 0.12, q));
      cuerpo.rotation.y = q * Math.PI * 2; aura.material.opacity = 0.55 * (1 - q);
    }, 3.1, () => { cuerpo.visible = false; });
    An.add(1.7, k => { h.vista.k = eIO(k); }, 3.1);
    An.add(0.7, k => { rot.material.opacity = 0.85 * k; }, 4.5);
    An.add(0.75, k => {
      if (k > 0 && nodo.material.opacity < 1) encender();
      nodo.scale.setScalar(k < 0.35 ? lerp(0.8, 1.9, k / 0.35) : lerp(1.9, 1.15, eOut((k - 0.35) / 0.65)));
      llegada.material.opacity = 0.7 * Math.sin(Math.PI * k);
      anillo.scale.setScalar(lerp(0.6, 3.6, eOut(k))); anillo.material.opacity = 0.9 * (1 - k);
    }, 4.3);
    lineas.filter(o => o.nueva).forEach(o => An.add(0.6, k => trazo(o, k), 4.45));
    if (completa) An.add(1.0, k => { lineas.forEach(o => { if (o.on) { o.m.color.set(0xA9B8E8).lerp(new T.Color(0xFFE3A3), k); o.m.opacity = lerp(0.45, 0.9, k); } }); llegada.material.opacity = Math.max(llegada.material.opacity, 0.35 * k); }, 5.0);
    return h;
  }
  function quitarHero() {
    if (!hero) return;
    if (hero.g.parent) hero.g.parent.remove(hero.g);
    est.escena.remove(hero.fondo); liberar(hero.g); liberar(hero.fondo); hero = null;
  }
  function ponerHero(id, pop, ganar) {
    const s = estudio();
    quitarHero();
    hero = ganar ? heroGanar(id) : heroDe(id);
    (ganar ? s.escena : s.giro).add(hero.g); s.escena.add(hero.fondo);   // al ganar, la medalla no gira con el dedo: viaja
    giro.rot = giro.obj = 0; giro.vel = 0; giro.quieto = 0;
    if (pop && !QUIETO && !ganar) { const c = hero.cuerpo; c.scale.setScalar(0.001); hero.A.add(0.55, k => { c.scale.setScalar(Math.max(0.001, eBack(k))); }); }
    pedir();
  }
  /* Aleja la cámara hasta que la medalla (una esfera de radio 2) quepa entera en la vista */
  const PUNTOS = [[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]];
  function encuadrar() {
    const t = Math.tan(15 * Math.PI / 180) * 0.92, asp = ancho / alto, tH = t * asp, sp = Math.sin(giro.pitch), cp = Math.cos(giro.pitch);
    let d = 1.5;
    for (let it = 0; it < 160; it++) {
      let ok = true; const cy = d * sp, cz = d * cp;
      for (let i = 0; i < PUNTOS.length && ok; i++) {
        const P = PUNTOS[i], vy = P[1] - cy, vz = P[2] - cz, z = -(vy * sp + vz * cp), y = vy * cp - vz * sp;
        if (z <= 0.1 || Math.abs(P[0]) > z * tH || Math.abs(y) > z * t) ok = false;
      }
      if (ok) break; d *= 1.03;
    }
    d *= giro.zoom;
    camI.fov = 30; camI.aspect = asp; camI.position.set(0, d * sp, d * cp); camI.lookAt(0, 0, 0); camI.updateProjectionMatrix();
  }

  /* Al subir la medalla, la cámara pasa de mirarla a ella a mirar su constelación entera */
  const P1 = new T.Vector3(), M1 = new T.Vector3();
  function mirarFigura(v) {
    const t = Math.tan(15 * Math.PI / 180), d = Math.max(v.mh / t, v.mw / (t * ancho / alto));
    P1.set(v.c.x, v.c.y + d * Math.sin(giro.pitch), v.c.z + d * Math.cos(giro.pitch));
    camI.position.lerp(P1, v.k); M1.set(0, 0, 0).lerp(v.c, v.k); camI.lookAt(M1); camI.updateProjectionMatrix();
  }

  /* ============================================================
     El lienzo: dónde se cuelga, cómo se mide y el bucle de cuadros
     ============================================================ */
  let modo = null, caja = null, ancho = 1, alto = 1, raf = 0, ultimo = 0, reloj = 0, visible = true, sucio = true, arrastre = null;
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => medir()) : null;
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); if (visible) arrancar(); }) : null;
  function colgar(c) {
    if (caja !== c) {
      if (caja) { if (ro) ro.unobserve(caja); if (io) io.unobserve(caja); }
      caja = c; visible = true;
      if (ro) ro.observe(c); if (io) io.observe(c);
    }
    if (canvas.parentNode !== c) c.appendChild(canvas);
    medir();
  }
  function medir() {
    if (!caja) return;
    const b = caja.getBoundingClientRect(), w = Math.max(1, Math.round(b.width)), h = Math.max(1, Math.round(b.height));
    if (w !== ancho || h !== alto || canvas.width < 2) { ancho = w; alto = h; r.setSize(w, h, false); }
    pedir();
  }
  function arrancar() { if (!raf && modo) { ultimo = 0; raf = requestAnimationFrame(cuadro); } }
  function pedir() { sucio = true; arrancar(); }
  function detener() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function cuadro(now) {
    raf = 0;
    if (!modo || !caja || !document.body.contains(canvas)) return;
    if (LENTO && ultimo && now - ultimo < 66) { raf = requestAnimationFrame(cuadro); return; }   // por software: unos 15 cuadros por segundo
    const dt = Math.min(LENTO ? 0.1 : 0.05, ultimo ? (now - ultimo) / 1000 : 0.016); ultimo = now;
    const ocupado = !A.vacio() || arrastre || (modo === "cielo" && etqNueva) || (modo === "cerca" && hero && !hero.A.vacio()) || Math.abs(giro.vel) > 1e-4 || (modo === "cerca" && Math.abs(giro.obj - giro.rot) > 1e-3);
    if (!visible && modo === "cielo") return;   // el cielo quedó fuera de la vista: vuelve al reaparecer
    if (CALMO && !ocupado && !sucio) return;   // sin movimiento: se dibuja solo cuando algo cambia (pedir)
    raf = requestAnimationFrame(cuadro);
    sucio = false; reloj += dt; A.tick(dt);
    if (modo === "cielo") {
      const k = Math.min(1, dt * 8); cielo.u.yaw += (cielo.uObj.yaw - cielo.u.yaw) * k; cielo.u.pitch += (cielo.uObj.pitch - cielo.u.pitch) * k;
      ponerCamara(reloj);
      uE.uT.value = CALMO ? 0 : reloj; uE.uPR.value = r.getPixelRatio();
      elefante.vivo(reloj * 0.6);
      // En pantallas chicas las medallas crecen un poco para que se vean y se puedan tocar
      const esc = limitar(Math.tan(cam.fov * Math.PI / 360) / Math.tan(28 * Math.PI / 180) * 500 / alto, 1, 1.6);
      Object.values(cielo.nodos).forEach(E => {
        const pop = E.pop || 1;
        if (E.on) { E.sp.material.opacity = CALMO ? 0.92 : 0.82 + 0.18 * Math.sin(reloj * 1.7 + E.fase); E.sp.scale.setScalar(E.tam * pop * esc); }
        E.nodo.scale.setScalar((E.on ? 3.3 * (E.I.metal === "oro" ? 1.12 : 1) : 2.4) * limitar(pop, 1, 2.2) * esc);
      });
      if (hoverE) { halo.position.copy(hoverE.nodo.position); halo.scale.setScalar(hoverE.nodo.scale.x * 1.35 * (1 + (CALMO ? 0 : 0.06 * Math.sin(reloj * 5)))); etiqueta(hoverE); }
      else if (etqNueva) { if (reloj < etqNueva.hasta) etiqueta(etqNueva.E, "¡Medalla nueva!"); else { etqNueva = null; etiqueta(null); } }
      if (fugaz.activa) {
        const p1 = enPantalla(fugaz.prev), p2 = enPantalla(fugaz.cabeza.position);
        if (p1 && p2 && Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]) > 1e-6) fugaz.estela.material.rotation = Math.atan2(-(p2[1] - p1[1]), p2[0] - p1[0]);
      }
      r.toneMappingExposure = 1; r.render(cielo.escena, cam);
    } else if (modo === "cerca" && hero) {
      if (!arrastre) {
        if (Math.abs(giro.vel) > 1e-4) { giro.rot += giro.vel; giro.obj = giro.rot; giro.vel *= Math.pow(0.04, dt); giro.quieto = 0; }
        else { giro.quieto += dt; giro.rot += (giro.obj - giro.rot) * Math.min(1, dt * 5); }
      }
      // quieta un rato: se mece un poco para que el metal juegue con la luz
      const mece = CALMO || arrastre || giro.quieto < 1.2 ? 0 : Math.sin((giro.quieto - 1.2) * 0.7) * 0.35 * Math.min(1, (giro.quieto - 1.2) / 1.5);
      est.giro.rotation.y = giro.rot + mece;
      hero.A.tick(dt); hero.anim(reloj); encuadrar();
      if (hero.vista && hero.vista.k > 0) mirarFigura(hero.vista);
      r.toneMappingExposure = 1; r.render(est.escena, camI);
    }
  }

  /* -------- Dedo y mouse -------- */
  canvas.addEventListener("pointerdown", ev => {
    if (!modo || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, movido: false, tipo: ev.pointerType };
    if (modo === "cerca" || ev.pointerType !== "touch") { try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} }
    giro.vel = 0; arrancar();
  });
  canvas.addEventListener("pointermove", ev => {
    const b = canvas.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top;
    if (!arrastre || arrastre.id !== ev.pointerId) { if (modo === "cielo" && ev.pointerType === "mouse") hover(nodoEn(x, y)); return; }
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y; arrastre.x = ev.clientX; arrastre.y = ev.clientY;
    if (!arrastre.movido && Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) > 6) { arrastre.movido = true; hover(null); }
    if (!arrastre.movido) return;
    if (modo === "cielo") {
      const k = (cam.fov * Math.PI / 180) / alto;
      cielo.uObj.yaw = limitar(cielo.uObj.yaw + dx * k, VISTA.lim.yaw[0], VISTA.lim.yaw[1]);
      if (arrastre.tipo !== "touch") cielo.uObj.pitch = limitar(cielo.uObj.pitch + dy * k, VISTA.lim.pitch[0], VISTA.lim.pitch[1]);
    } else {
      giro.rot += dx * 0.01; giro.obj = giro.rot; giro.vel = dx * 0.01; giro.quieto = 0;
      giro.pitch = limitar(giro.pitch + dy * 0.004, -0.15, 0.7);
    }
    pedir();
  });
  const soltarDedo = (ev, cancelado) => {
    if (!arrastre || arrastre.id !== ev.pointerId) return;
    const a = arrastre; arrastre = null;
    if (cancelado || a.movido || modo !== "cielo") return;
    const b = canvas.getBoundingClientRect(), E = nodoEn(ev.clientX - b.left, ev.clientY - b.top);
    if (E) { hover(null); D.tocar(E.id); }
  };
  canvas.addEventListener("pointerup", ev => soltarDedo(ev, false));
  canvas.addEventListener("pointercancel", ev => soltarDedo(ev, true));
  canvas.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse" && !arrastre) hover(null); });
  canvas.addEventListener("wheel", ev => { if (modo !== "cerca") return; ev.preventDefault(); giro.zoom = limitar(giro.zoom * (1 + ev.deltaY * 0.0012), 0.6, 1.5); pedir(); }, { passive: false });
  canvas.addEventListener("webglcontextlost", ev => { ev.preventDefault(); detener(); modo = null; D.perdido(); });

  /* -------- Lo que usa cielo.js -------- */
  return {
    montar(c) { modo = "cielo"; canvas.style.touchAction = "pan-y"; colgar(c); actualizar(); arrancar(); },
    soltar() {
      modo = null; hover(null); detener();
      // lo que quedaba por animar (una estrella fugaz a medio camino) se termina de golpe
      A.l.length = 0; etqNueva = null; fugaz.activa = fugaz.cabeza.visible = fugaz.estela.visible = false;
      Object.values(cielo.nodos).forEach(E => { E.pop = 1; });
      if (caja) { if (ro) ro.unobserve(caja); if (io) io.unobserve(caja); }
      caja = null;
    },
    lento: LENTO,
    abrir(id, c) { hover(null); etqNueva = null; etiqueta(null); modo = "cerca"; canvas.style.touchAction = "none"; giro.pitch = 0.12; giro.zoom = 1; colgar(c); ponerHero(id, true); arrancar(); },
    cambiar(id) { if (modo === "cerca") { giro.pitch = 0.12; ponerHero(id, true); arrancar(); } },
    /* El momento de ganar (cielo.js lo abre al cerrar el día o desde el aviso de medalla nueva) */
    ganar(id, c) {
      hover(null); etqNueva = null; etiqueta(null); modo = "cerca"; canvas.style.touchAction = "none"; giro.pitch = 0.04; giro.zoom = 1;
      if (c) colgar(c);
      ponerHero(id, false, true); arrancar();
    },
    voltear() { if (modo !== "cerca") return; const base = Math.round(giro.rot / Math.PI) * Math.PI; giro.obj = base + Math.PI; giro.vel = 0; giro.quieto = 0; pedir(); },
    /* Dónde está una medalla en el lienzo (para las pruebas) */
    donde(id) { const E = cielo.nodos[id]; if (!E || modo !== "cielo" || !E.nodo.visible) return null; ponerCamara(reloj); return enPantalla(E.pos); },
    cerrar() { if (est) quitarHero(); modo = null; detener(); },
  };
}
