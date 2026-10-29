/* ============================================================
   RUMBO · El cielo de insignias en 3D (three.js r128)
   Lo carga cielo.js al entrar a tu vitrina o a tu casa. Un renderer para tres escenas:
   el cielo nocturno con sus constelaciones de medallas (tu vitrina), el estudio donde
   una medalla se mira de cerca (se gira, se le da vuelta, brilla su metal) y el cuarto
   de tu elefante (tu casa).
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
  r.shadowMap.enabled = !LENTO; r.shadowMap.type = T.PCFSoftShadowMap;   // solo el sol del cuarto hace sombra
  const canvas = r.domElement; canvas.className = "cielo__canvas";

  /* -------- Metales, familias y figuras -------- */
  const METAL = {
    bronce: { c: 0xC27A44, css: "#C27A44", luz: "#FFB27A" },
    plata: { c: 0xD4D9E0, css: "#C3C9D2", luz: "#DCE6FF" },
    oro: { c: 0xF0B83E, css: "#E7AE30", luz: "#FFE08A" },
    obsidiana: { c: 0x2A2731, css: "#3A3644", luz: "#C7AEFF" },
  };
  const FAM = {}; D.familias.forEach(f => { FAM[f.id] = f; });
  /* Cada figura: centro en el cielo (yc: giro, pc: altura, en radianes), tamaño s, puntos p y trazos l.
     Tres arriba (La Copa, La Brújula, El Elefante) y tres abajo (El Sol, La Columna, La Medalla), en tres
     columnas, con aire entre una y otra y entre cada figura y su rótulo: ninguna medalla tapa a otra */
  const FIG = {
    rachas: { yc: 0.56, pc: 0.76, s: 0.085, p: [[-0.85, 0.85], [0.85, 0.85], [0, -0.1], [0, -0.95]], l: [[0, 1], [0, 2], [1, 2], [2, 3]] },
    hitos: { yc: 0.0, pc: 0.775, s: 0.125, p: [[0, 0.95], [0.75, 0], [0, -0.95], [-0.75, 0], [0, 0], [0.52, 0.62]], l: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 0], [4, 5]] },
    foco: { yc: -0.52, pc: 0.775, s: 0.17, p: [[0.98, -0.75], [0.92, -0.25], [0.8, 0.2], [0.5, 0.6], [0, 0.62], [-0.6, 0.45], [-0.98, 0.05], [-0.72, -0.75], [-0.3, -0.75], [0, -0.32], [0.12, -0.75], [0.52, -0.75], [0.38, 0.22]],
      l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 2], [3, 12]] },
    rituales: { yc: 0.56, pc: 0.4, s: 0.135, p: [], l: [] },
    habitos: { yc: 0.0, pc: 0.375, s: 0.13, p: [[0, -1], [0.06, -0.5], [0, 0], [-0.06, 0.5], [0, 1]], l: [[0, 1], [1, 2], [2, 3], [3, 4]] },
    vida: { yc: -0.52, pc: 0.35, s: 0.165, p: [[-0.75, 1.0], [-0.25, 0.84], [0.75, 1.0], [0.25, 0.84]], l: [[0, 1], [2, 3]] },
  };
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * 6.283; FIG.rituales.p.push([Math.cos(a) * 0.42, -Math.sin(a) * 0.42]); }
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * 6.283; FIG.rituales.p.push([Math.cos(a), -Math.sin(a)]); FIG.rituales.l.push([i, (i + 1) % 5], [i, i + 5]); }
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i / 10 * 6.283; FIG.vida.p.push([Math.cos(a) * 0.66, -0.17 + Math.sin(a) * 0.66]); FIG.vida.l.push([4 + i, 4 + (i + 1) % 10]); }
  FIG.vida.l.push([1, 4], [3, 4]);
  const SECRETAS = { buho: [0.27, 0.56], aniversario: [-0.24, 0.42], "anio-nuevo": [0.86, 0.6], remontada: [-0.2, 0.86] };   // en los huecos entre figuras

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
  /* A pantalla completa (lugar.js), la barra de arriba y la hoja (o el panel al costado) tapan parte del lienzo:
     cada cámara se encuadra en lo que queda libre (setViewOffset). zoom: lo que acercaste con pellizco o rueda */
  const ENC = { arriba: 0, abajo: 0, der: 0 }, ENCo = { arriba: 0, abajo: 0, der: 0 };
  const ZOOM = { cielo: 1 }, ZOOMo = { cielo: 1 }, ZOOM_LIM = { cielo: [0.62, 1.12] };
  function areaLibre() { return [Math.max(160, ancho - ENC.der), Math.max(120, alto - ENC.arriba - ENC.abajo)]; }
  function corrimiento(c, w, h) { if (ENC.arriba || ENC.abajo || ENC.der) c.setViewOffset(w, h, 0, -ENC.arriba, ancho, alto); else c.clearViewOffset(); }
  function vistaMoviendo() { return ["arriba", "abajo", "der"].some(k => Math.abs(ENC[k] - ENCo[k]) > 0.5) || Math.abs(ZOOM.cielo - ZOOMo.cielo) > 1e-3; }
  function acercarVista(dt) { const k = Math.min(1, dt * 7); ["arriba", "abajo", "der"].forEach(q => { ENC[q] += (ENCo[q] - ENC[q]) * k; }); ZOOM.cielo += (ZOOMo.cielo - ZOOM.cielo) * k; }

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
  function caraMedalla(I, dorso, chica) {
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
    const tA = tex(chica ? achicar(cA, chica) : cA), tR = tex(chica ? achicar(cR, chica) : cR, false);
    [tA, tR].forEach(t => { t.repeat.set(1 / EXT, 1 / EXT); t.offset.set(0.5, 0.5); });
    return [tA, tR];
  }
  /* Se dibuja a 512 px y se guarda más chica (las medallas de la repisa no necesitan más) */
  function achicar(cv, n) { const [c2, g2] = lienzo(n); g2.drawImage(cv, 0, 0, n, n); return c2; }
  /* mini: para la repisa, solo la cara de adelante y en 256 px */
  function heroMedalla(I, mini) {
    const g = new T.Group(), C = contorno(I.fam), M = METAL[I.metal], gano = I.gano;
    const geo = new T.ExtrudeGeometry(C.shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: mini ? 2 : 3, curveSegments: 1 }); geo.translate(0, 0, -0.06);
    const rugo = (I.metal === "obsidiana" ? 0.1 : 0.27) + (mini ? 0.1 : 0), metal = mini ? 0.7 : 1, colorV = new T.Color(0xDCE8F5).lerp(new T.Color(M.c), 0.5).convertSRGBToLinear();
    g.add(new T.Mesh(geo, gano ? mat(M.c, { metalness: metal, roughness: rugo, envMapIntensity: 1.4 }) : vidrioDe(I.metal)));
    (mini ? [false] : [false, true]).forEach(dorso => {
      const [map, bumpMap] = caraMedalla(I, dorso, mini ? 256 : 0), o = { map, bumpMap, bumpScale: 0.022, envMapIntensity: 1.4 };
      const mt = gano ? new T.MeshStandardMaterial(Object.assign({ color: new T.Color(M.c).convertSRGBToLinear(), metalness: metal, roughness: rugo + 0.04 }, o))
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
  const VISTA = { yaw: 0.02, pitch: 0.48, fov: 56, aspecto: 1.6, lim: { yaw: [-0.6, 0.6], pitch: [-0.22, 0.3] }, vaiven: 0.025 };
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
    elefante.g.scale.setScalar(0.46); elefante.g.position.set(-1.05, 1.94, 0.46); elefante.g.rotation.y = Math.PI; e.add(elefante.g);
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
      sp.position.copy(enCielo(F.yc, F.pc + ab * F.s - 0.068, R - 1)); sp.scale.set(s * R * 2.4, s * R * 0.75, 1); cielo.escena.add(sp); cielo.rotulos[f] = sp;
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
    const [w, h] = areaLibre(), asp = w / h, rel = VISTA.aspecto / asp, yaw = VISTA.yaw + cielo.u.yaw + vaiven, pitch = VISTA.pitch + cielo.u.pitch + (asp < 1 ? 0.02 : 0);
    cam.aspect = asp; cam.fov = VISTA.fov * limitar(Math.pow(rel, 0.6), 1, 1.12) * ZOOM.cielo;
    cam.position.copy(POS); const d = dirMirar(yaw, pitch); cam.lookAt(POS.x + d.x, POS.y + d.y, POS.z + d.z);
    corrimiento(cam, w, h); cam.updateProjectionMatrix();
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

  /* ============================================================
     LA CASA DEL ELEFANTE: su cuarto en Progreso (casa.js decide qué tiene)
     Tu elefante no es 3D: es el dibujo de siempre, puesto encima de la alfombra
     ============================================================ */
  const camC = new T.PerspectiveCamera(31, 1.25, 0.1, 200);
  const CASA_V = { target: new T.Vector3(-0.3, 1.45, -0.3), dist: 16.5, yaw: 0.8, pitch: 0.5, aspecto: 1.25 };
  const ALFOMBRA = new T.Vector3(0.55, 0, 0.6), REPISA_Y = 2.15;
  const CAJA = new T.BoxGeometry(1, 1, 1), ESF = new T.SphereGeometry(1, 20, 14);
  let casa = null;
  function cm(geo, m, x, y, z) { const me = malla(geo, m, x, y, z); me.castShadow = me.receiveShadow = true; return me; }
  function bloque(w, h, d, m, x, y, z) { const b = cm(CAJA, m, x, y, z); b.scale.set(w, h, d); return b; }
  function texSombra() { return texCache("sombra", () => { const [c, g] = lienzo(128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(0,0,0,.7)"); gr.addColorStop(0.55, "rgba(0,0,0,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c); }); }
  /* La hora del día manda la luz: de día, al atardecer o de noche */
  const franjaDe = h => (h >= 20 || h < 6 ? "noche" : h >= 18 || h < 8 ? "tarde" : "dia");
  function texVentana(f) {
    return texCache("ventana:" + f, () => {
      const [c, g] = lienzo(256, 228), gr = g.createLinearGradient(0, 0, 0, 228);
      if (f === "noche") {
        gr.addColorStop(0, "#0B1030"); gr.addColorStop(1, "#24305E"); g.fillStyle = gr; g.fillRect(0, 0, 256, 228);
        const rs = semilla(3); g.fillStyle = "#FFFFFF"; for (let i = 0; i < 40; i++) { g.globalAlpha = 0.4 + rs() * 0.6; g.beginPath(); g.arc(rs() * 256, rs() * 160, 0.6 + rs() * 1.2, 0, 6.283); g.fill(); }
        g.globalAlpha = 1; g.fillStyle = "#FFF4D6"; g.beginPath(); g.arc(178, 58, 20, 0, 6.283); g.fill(); g.fillStyle = "#24305E"; g.beginPath(); g.arc(188, 52, 18, 0, 6.283); g.fill();
        g.fillStyle = "#1A2238";
      } else if (f === "tarde") {
        gr.addColorStop(0, "#7FA9DE"); gr.addColorStop(0.62, "#F7C7A1"); gr.addColorStop(1, "#FFD9A6"); g.fillStyle = gr; g.fillRect(0, 0, 256, 228);
        g.fillStyle = "#FFF1C9"; g.beginPath(); g.arc(84, 170, 30, 0, 6.283); g.fill(); g.fillStyle = "#6F8E86";
      } else {
        gr.addColorStop(0, "#6FA8E0"); gr.addColorStop(1, "#CDE6F7"); g.fillStyle = gr; g.fillRect(0, 0, 256, 228);
        g.fillStyle = "#FFF6D8"; g.beginPath(); g.arc(196, 54, 22, 0, 6.283); g.fill();
        g.fillStyle = "rgba(255,255,255,.85)"; [[90, 70, 26], [112, 66, 20], [70, 76, 18], [160, 120, 16], [176, 116, 12]].forEach(q => { g.beginPath(); g.arc(q[0], q[1], q[2], 0, 6.283); g.fill(); });
        g.fillStyle = "#6E9A6A";
      }
      g.beginPath(); g.moveTo(0, 228); g.lineTo(0, 196); g.quadraticCurveTo(70, 176, 130, 200); g.quadraticCurveTo(200, 180, 256, 196); g.lineTo(256, 228); g.fill();
      return tex(c);
    });
  }
  const LUZ_FRANJA = {
    dia: { fondo: 0xDCE4EA, hemi: [0xF2F4FF, 0x5A4A3E, 0.55], sol: [0xFFE9CF, 1.9], vent: [0xFFE2C0, 0.9], cuarto: 0, exp: 1.05 },
    tarde: { fondo: 0xE6D6CB, hemi: [0xFFE4D2, 0x5A4A3E, 0.45], sol: [0xFFC9A0, 1.35], vent: [0xFFB27A, 1.4], cuarto: 0.25, exp: 1.0 },
    noche: { fondo: 0x151A2C, hemi: [0x7B8BC4, 0x1B1A22, 0.3], sol: [0x9FB2FF, 0.35], vent: [0x9FB2FF, 0.5], cuarto: 1.1, exp: 1.0 },
  };
  const MESES_C = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  /* El calendario de la pared: el mes de hoy, con un punto en cada día que cerraste */
  function texCalendario(hoy, cerrados) {
    const [c, g] = lienzo(256, 320), y = hoy.getFullYear(), m = hoy.getMonth(), d0 = (new Date(y, m, 1).getDay() + 6) % 7, nd = new Date(y, m + 1, 0).getDate();
    g.fillStyle = "#FBFAF6"; g.fillRect(0, 0, 256, 320); g.fillStyle = "#E4532F"; g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#FFFFFF"; g.font = "800 28px " + UI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(MESES_C[m], 128, 34);
    g.font = "700 13px " + MONO; g.fillStyle = "#9A948A"; "LMMJVSD".split("").forEach((l, i) => g.fillText(l, 26 + i * 34, 82));
    for (let dia = 1; dia <= nd; dia++) {
      const pos = d0 + dia - 1, x = 26 + (pos % 7) * 34, yy = 108 + Math.floor(pos / 7) * 38, iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      if (dia === hoy.getDate()) { g.strokeStyle = "#E4532F"; g.lineWidth = 3; g.beginPath(); g.arc(x, yy, 15, 0, 6.283); g.stroke(); }
      g.fillStyle = "#3A3A3E"; g.font = "600 16px " + MONO; g.fillText(String(dia), x, yy - 2);
      if (cerrados.has(iso)) { g.fillStyle = "#3E9C95"; g.beginPath(); g.arc(x, yy + 11, 3.2, 0, 6.283); g.fill(); }
    }
    return tex(c);
  }
  function armarCasa() {
    if (casa) return casa;
    const e = new T.Scene(), rnd = semilla(5);
    casa = { escena: e, franja: null, claves: {}, lugares: [], cosas: {} };
    e.environment = envEstudio();
    const hemi = new T.HemisphereLight(0xF2F4FF, 0x5A4A3E, 0.55); e.add(hemi);
    const sol = new T.DirectionalLight(0xFFE9CF, 1.9); sol.position.set(7, 11, 8); e.add(sol);
    if (!LENTO) {
      sol.castShadow = true; const n = MOVIL ? 1024 : 2048; sol.shadow.mapSize.set(n, n);
      const sc = sol.shadow.camera; sc.left = sc.bottom = -7; sc.right = sc.top = 7; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
      sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
    }
    const vent = new T.PointLight(0xFFD2A0, 1.0, 7, 1.5); vent.position.set(-2.9, 2.5, 1.3); e.add(vent);
    const cuarto = new T.PointLight(0xFFC98A, 0, 9, 1.6); cuarto.position.set(0.4, 3.6, 0.2); e.add(cuarto);
    casa.luz = { hemi, sol, vent, cuarto };
    // Piso de madera, dos muros a rayas y zócalos
    const [cp, gp] = lienzo(512);
    for (let k = 0; k < 8; k++) {
      const tono = 196 + Math.floor(rnd() * 22); gp.fillStyle = `rgb(${tono},${Math.floor(tono * 0.76)},${Math.floor(tono * 0.54)})`; gp.fillRect(0, k * 64, 512, 64);
      gp.strokeStyle = "rgba(90,60,30,.12)"; gp.lineWidth = 1.5; for (let v = 0; v < 5; v++) { const yv = k * 64 + 8 + v * 11 + rnd() * 4; gp.beginPath(); gp.moveTo(0, yv); gp.bezierCurveTo(150, yv + rnd() * 6 - 3, 350, yv + rnd() * 6 - 3, 512, yv); gp.stroke(); }
      gp.fillStyle = "rgba(70,45,25,.55)"; gp.fillRect(0, k * 64, 512, 2); gp.fillRect(rnd() * 450, k * 64, 2, 64);
    }
    const madPiso = mat(0xFFFFFF, { map: tex(cp), roughness: 0.7 }), canto = mat(0x8E6440);
    const piso = new T.Mesh(CAJA, [canto, canto, madPiso, canto, canto, canto]); piso.scale.set(7.3, 0.3, 7.3); piso.position.set(-0.15, -0.15, -0.15); piso.receiveShadow = true; e.add(piso);
    const [cw, gw] = lienzo(256); gw.fillStyle = "#DCE3E7"; gw.fillRect(0, 0, 256, 256); gw.fillStyle = "#D2DADF"; for (let k = 0; k < 8; k += 2) gw.fillRect(k * 32, 0, 32, 256);
    const tw = tex(cw); tw.wrapS = tw.wrapT = T.RepeatWrapping; tw.repeat.set(5, 3);
    casa.muro = { g: gw, t: tw, clave: "gris" };   // la pared se puede pintar (Tienda): se redibuja la misma textura
    const muro = mat(0xFFFFFF, { map: tw, roughness: 0.95 }), muroCanto = mat(0xEDEAE4);
    const mi = new T.Mesh(CAJA, [muro, muroCanto, muroCanto, muroCanto, muroCanto, muroCanto]); mi.scale.set(0.3, 4.2, 7.3); mi.position.set(-3.65, 2.1, -0.15); mi.receiveShadow = true; e.add(mi);
    const mf = new T.Mesh(CAJA, [muroCanto, muroCanto, muroCanto, muroCanto, muro, muroCanto]); mf.scale.set(7.3, 4.2, 0.3); mf.position.set(-0.15, 2.1, -3.65); mf.receiveShadow = true; e.add(mf);
    const zoc = mat(0xF6F4EF); e.add(bloque(0.06, 0.16, 7.0, zoc, -3.47, 0.08, 0)); e.add(bloque(7.0, 0.16, 0.06, zoc, 0, 0.08, -3.47));
    // La alfombra (donde se para tu elefante) y su sombra
    const [la, ga] = lienzo(512);
    [[256, "#C9472C"], [236, "#E4532F"], [206, "#F4EDE3"], [190, "#E4532F"], [120, "#D24A2D"], [104, "#F4EDE3"], [92, "#E4532F"]].forEach(c => { ga.fillStyle = c[1]; ga.beginPath(); ga.arc(256, 256, c[0], 0, 6.283); ga.fill(); });
    const alf = new T.Mesh(new T.CircleGeometry(1.75, 64), mat(0xFFFFFF, { map: tex(la), roughness: 1 })); alf.rotation.x = -Math.PI / 2; alf.position.set(ALFOMBRA.x, 0.012, ALFOMBRA.z); alf.receiveShadow = true; e.add(alf);
    const sombraE = new T.Mesh(new T.PlaneGeometry(2.6, 1.5), new T.MeshBasicMaterial({ map: texSombra(), transparent: true, opacity: 0.35, depthWrite: false })); sombraE.rotation.x = -Math.PI / 2; sombraE.position.set(ALFOMBRA.x, 0.02, ALFOMBRA.z); e.add(sombraE); casa.sombra = sombraE;
    // Tu elefante en 3D (elefante-3d.js): se arma en actualizarCasa con su tipo, etapa, ropa y ánimo
    casa.eleRaiz = new T.Group(); casa.eleRaiz.position.set(ALFOMBRA.x - 0.1, 0.02, ALFOMBRA.z); casa.eleRaiz.rotation.y = 0.35; casa.eleRaiz.scale.setScalar(0.95); e.add(casa.eleRaiz);
    // La ventana (cambia con la hora) con sus cortinas
    const madera = mat(0xB98656, { roughness: 0.7 }), madOsc = mat(0x8C603A, { roughness: 0.75 }), marcoV = mat(0xF7F5F0, { roughness: 0.6 });
    casa.ventana = new T.Mesh(new T.PlaneGeometry(1.7, 1.5), new T.MeshBasicMaterial({ map: texVentana("dia"), toneMapped: false })); casa.ventana.rotation.y = Math.PI / 2; casa.ventana.position.set(-3.49, 2.45, 1.3); e.add(casa.ventana);
    e.add(bloque(0.1, 0.1, 1.86, marcoV, -3.46, 3.24, 1.3)); e.add(bloque(0.1, 0.1, 1.86, marcoV, -3.46, 1.66, 1.3)); e.add(bloque(0.1, 1.6, 0.1, marcoV, -3.46, 2.45, 0.42)); e.add(bloque(0.1, 1.6, 0.1, marcoV, -3.46, 2.45, 2.18));
    e.add(bloque(0.06, 1.5, 0.05, marcoV, -3.47, 2.45, 1.3)); e.add(bloque(0.06, 0.05, 1.7, marcoV, -3.47, 2.45, 1.3)); e.add(bloque(0.3, 0.07, 2.0, marcoV, -3.35, 1.6, 1.3));
    const cortina = mat(0xEFE9DF, { roughness: 1 }); e.add(bloque(0.08, 2.3, 0.4, cortina, -3.4, 2.3, 0.08)); e.add(bloque(0.08, 2.3, 0.4, cortina, -3.4, 2.3, 2.52));
    // El calendario con tus días cerrados
    casa.calendario = new T.Mesh(new T.PlaneGeometry(0.62, 0.78), mat(0xFFFFFF, { roughness: 0.8 })); casa.calendario.rotation.y = Math.PI / 2; casa.calendario.position.set(-3.48, 1.6, -1.75); casa.calendario.receiveShadow = true; e.add(casa.calendario);
    // La repisa: cinco lugares para tus medallas
    e.add(bloque(3.3, 0.07, 0.42, madera, 0.95, REPISA_Y, -3.28));
    [-0.55, 2.45].forEach(x => { const sq = bloque(0.06, 0.26, 0.3, madOsc, x, REPISA_Y - 0.15, -3.35); e.add(sq); });
    for (let i = 0; i < 5; i++) {   // bien separadas y mirando hacia ti, para que ninguna tape a la de al lado
      const x = -0.6 + i * 0.79, base = bloque(0.3, 0.045, 0.18, madOsc, x, REPISA_Y + 0.057, -3.22); e.add(base);
      const g = new T.Group(); g.position.set(x, REPISA_Y + 0.33, -3.2); g.rotation.y = 0.75; e.add(g);
      casa.lugares.push({ i, g, pos: new T.Vector3(x, REPISA_Y + 0.33, -3.2), id: null, fase: i * 1.3 });
    }
    // Lo que llega con el rango
    const C = casa.cosas;
    { // 🪴 planta
      const p = new T.Group(); p.position.set(2.85, 0, -2.85); e.add(p);
      p.add(cm(new T.LatheGeometry([[0, 0], [0.2, 0], [0.27, 0.46], [0.3, 0.5], [0, 0.5]].map(q => new T.Vector2(q[0], q[1])), 32), mat(0x2E3035, { roughness: 0.6 })));
      const hojas = new T.Group(); hojas.position.y = 0.48; p.add(hojas);
      const verde = [mat(0x5E9563, { roughness: 0.8 }), mat(0x7AAE6E, { roughness: 0.8 })];
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, h = cm(ESF, verde[k % 2]); h.scale.set(0.07, 0.42 + (k % 3) * 0.08, 0.16); h.position.set(Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12); h.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * -0.5, "YXZ"); hojas.add(h); }
      C.planta = p; p.userData.hojas = hojas;
    }
    { // 🕰️ reloj de pared, con la hora de verdad
      const [lr, g] = lienzo(256); g.fillStyle = "#FBFAF6"; g.beginPath(); g.arc(128, 128, 128, 0, 6.283); g.fill();
      g.strokeStyle = "#2A2A2E"; for (let k = 0; k < 60; k++) { const a = k / 60 * 6.283, l = k % 5 ? 8 : 20; g.lineWidth = k % 5 ? 2 : 6; g.beginPath(); g.moveTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116); g.lineTo(128 + Math.sin(a) * (116 - l), 128 - Math.cos(a) * (116 - l)); g.stroke(); }
      g.fillStyle = "#E4532F"; g.font = "700 18px " + MONO; g.textAlign = "center"; g.fillText("RUMBO", 128, 176);
      const rl = new T.Group(); rl.position.set(-0.75, 3.15, -3.46); e.add(rl);
      const aro = cm(new T.CylinderGeometry(0.4, 0.4, 0.07, 48), matMetal("bronce")); aro.rotation.x = Math.PI / 2; rl.add(aro);
      const cara = new T.Mesh(new T.CircleGeometry(0.35, 48), mat(0xFFFFFF, { map: tex(lr), roughness: 0.6 })); cara.position.z = 0.037; rl.add(cara);
      const negro = mat(0x141416, { roughness: 0.3 });
      const aguja = (largo, ancho) => { const p = new T.Group(); p.position.z = 0.045; const m = bloque(ancho, largo, 0.012, negro, 0, largo / 2 - 0.03, 0); m.castShadow = false; p.add(m); rl.add(p); return p; };
      rl.userData.h = aguja(0.2, 0.03); rl.userData.m = aguja(0.29, 0.02); C.reloj = rl;
    }
    { // 📚 biblioteca: los libros son los que terminaste
      const b = new T.Group(); b.position.set(-2.35, 0, -3.2); e.add(b);
      b.add(bloque(0.06, 2.7, 0.55, madera, -0.92, 1.35, 0)); b.add(bloque(0.06, 2.7, 0.55, madera, 0.92, 1.35, 0)); b.add(bloque(1.9, 2.7, 0.04, madOsc, 0, 1.35, -0.255));
      [0.04, 0.92, 1.8, 2.68].forEach(y => b.add(bloque(1.84, 0.06, 0.52, madera, 0, y, 0.01)));
      b.userData.libros = new T.Group(); b.add(b.userData.libros); b.userData.n = -1; C.biblioteca = b;
    }
    { // 🐷 mesita con alcancía, bajo la ventana
      const a = new T.Group(); e.add(a);
      a.add(cm(new T.CylinderGeometry(0.42, 0.42, 0.05, 32), madera, -2.85, 0.68, 1.3)); a.add(cm(new T.CylinderGeometry(0.05, 0.07, 0.66, 12), madOsc, -2.85, 0.33, 1.3)); a.add(cm(new T.CylinderGeometry(0.25, 0.27, 0.04, 24), madOsc, -2.85, 0.02, 1.3));
      const ch = new T.Group(); ch.position.set(-2.85, 0.705, 1.3); ch.rotation.y = -0.5; a.add(ch);
      const mc = matMetal("bronce"), negro = mat(0x141416, { roughness: 0.3 });
      const cu = cm(ESF, mc, 0, 0.26, 0); cu.scale.set(0.27, 0.22, 0.22); ch.add(cu);
      const ho = cm(new T.CylinderGeometry(0.07, 0.075, 0.08, 20), mc, 0.29, 0.27, 0); ho.rotation.z = Math.PI / 2; ch.add(ho);
      [1, -1].forEach(s => {
        ch.add(cm(new T.ConeGeometry(0.05, 0.09, 10), mc, 0.15, 0.45, 0.08 * s));
        ch.add(cm(new T.CylinderGeometry(0.04, 0.04, 0.1, 10), mc, 0.13, 0.05, 0.1 * s)); ch.add(cm(new T.CylinderGeometry(0.04, 0.04, 0.1, 10), mc, -0.13, 0.05, 0.1 * s));
        const oj = cm(ESF, negro, 0.22, 0.33, 0.085 * s); oj.scale.setScalar(0.022); ch.add(oj);
      });
      ch.add(bloque(0.13, 0.012, 0.025, negro, 0, 0.48, 0)); C.alcancia = a;
    }
    { // 🖼️ cuadro de la cumbre, sobre la repisa
      const [lc, g] = lienzo(256, 192), gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, "#F7C7A1"); gr.addColorStop(1, "#FBEFE2"); g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
      g.fillStyle = "#FFF1C9"; g.beginPath(); g.arc(186, 64, 22, 0, 6.283); g.fill();
      g.fillStyle = "#8FA3B8"; g.beginPath(); g.moveTo(0, 192); g.lineTo(70, 96); g.lineTo(118, 150); g.lineTo(176, 70); g.lineTo(256, 192); g.fill();
      g.fillStyle = "#2E3D6B"; g.beginPath(); g.moveTo(40, 192); g.lineTo(128, 56); g.lineTo(216, 192); g.fill();
      g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(108, 87); g.lineTo(128, 56); g.lineTo(148, 87); g.lineTo(136, 82); g.lineTo(128, 92); g.lineTo(120, 82); g.fill();
      g.fillStyle = "#E4532F"; g.fillRect(127, 30, 2.5, 28); g.beginPath(); g.moveTo(129.5, 30); g.lineTo(146, 36); g.lineTo(129.5, 42); g.fill();
      const q = new T.Group(); q.position.set(-3.47, 2.55, -0.45); q.rotation.y = Math.PI / 2; e.add(q);
      q.add(bloque(1.04, 0.8, 0.05, madOsc, 0, 0, 0));
      const lam = new T.Mesh(new T.PlaneGeometry(0.92, 0.68), mat(0xFFFFFF, { map: tex(lc), roughness: 0.8 })); lam.position.z = 0.027; q.add(lam); C.cuadro = q;
    }
    { // 🏆 copa dorada en su pedestal y una guirnalda de luces
      const c = new T.Group(); e.add(c);
      c.add(cm(new T.CylinderGeometry(0.32, 0.36, 0.9, 32), mat(0xEDE6DA, { roughness: 0.5 }), 2.45, 0.45, -1.3));
      const copa = cm(new T.LatheGeometry([[0, 0], [0.11, 0], [0.11, 0.03], [0.04, 0.05], [0.025, 0.14], [0.03, 0.18], [0.1, 0.22], [0.13, 0.32], [0.12, 0.42], [0.1, 0.42], [0.105, 0.33], [0, 0.3]].map(q => new T.Vector2(q[0], q[1])), 32), matMetal("oro"), 2.45, 0.9, -1.3);
      copa.scale.setScalar(1.6); c.add(copa);
      const ln = new T.Group(); c.add(ln); const pts = [], focos = [];
      for (let i = 0; i <= 22; i++) { const t = i / 22, x = -3.3 + t * 6.5, y = 3.9 - Math.sin(t * Math.PI * 3) ** 2 * 0.22; pts.push(new T.Vector3(x, y, -3.44)); }
      ln.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x3A3330 })));
      const colores = [0xFFD27A, 0xFF9F6B, 0xFFF1C9];
      pts.forEach((p, i) => { if (i % 2) return; const f = new T.Mesh(ESF, new T.MeshBasicMaterial({ color: colores[i % 3], toneMapped: false })); f.scale.setScalar(0.05); f.position.copy(p).add(new T.Vector3(0, -0.06, 0.03)); ln.add(f); focos.push(f); });
      c.userData.luces = ln; c.userData.focos = focos; C.copa = c;
    }

    // Lo que se compra en la Tienda (casa.js): cada cosa en un rincón libre, con su foco para la foto de la ficha
    const negroC = mat(0x141416, { roughness: 0.3 }), metalOsc = mat(0x2A2A2E, { roughness: 0.4, metalness: 0.6 });
    const cosa = (id, x, z, ry, foco) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.userData.foco = foco; e.add(g); C[id] = g; return g; };
    { // 🛋️ sillón de lectura, mirando a la alfombra
      const s = cosa("sillon", -2.45, 2.6, 2.15, [-2.45, 0.6, 2.6, 0.95]), tela = mat(0x3C7A74, { roughness: 0.95 });
      [[-0.42, -0.3], [0.42, -0.3], [-0.42, 0.34], [0.42, 0.34]].forEach(q => s.add(cm(new T.CylinderGeometry(0.035, 0.025, 0.24, 8), madOsc, q[0], 0.12, q[1])));
      s.add(bloque(1.12, 0.26, 0.92, tela, 0, 0.37, 0.02)); s.add(bloque(0.8, 0.14, 0.74, mat(0x4E8F88, { roughness: 0.95 }), 0, 0.57, 0.09));
      s.add(bloque(1.12, 0.8, 0.22, tela, 0, 0.84, -0.36));
      [-1, 1].forEach(k => s.add(bloque(0.17, 0.46, 0.92, tela, k * 0.475, 0.62, 0.02)));
      const coj = bloque(0.36, 0.3, 0.1, mat(0xE4532F, { roughness: 0.95 }), 0.16, 0.8, -0.2); coj.rotation.set(-0.25, 0, 0.2); s.add(coj);
    }
    { // 💡 lámpara de pie: al atardecer y de noche alumbra el rincón
      const l = cosa("lampara", -3.05, 3.1, 0, [-3.05, 1.1, 3.1, 1.15]);
      l.add(cm(new T.CylinderGeometry(0.2, 0.22, 0.05, 24), metalOsc, 0, 0.025, 0)); l.add(cm(new T.CylinderGeometry(0.022, 0.022, 1.8, 10), metalOsc, 0, 0.92, 0));
      const pant = new T.Mesh(new T.CylinderGeometry(0.19, 0.3, 0.36, 28, 1, true), mat(0xF3E6CF, { roughness: 0.9, side: T.DoubleSide, emissive: 0xFFC57A, emissiveIntensity: 0 }));
      pant.position.y = 1.86; pant.castShadow = true; l.add(pant);
      const foco = new T.Mesh(ESF, new T.MeshBasicMaterial({ color: 0xFFE6B0 })); foco.scale.setScalar(0.07); foco.position.y = 1.78; l.add(foco);
      l.userData.pantalla = pant;
      // la luz queda siempre en la escena (prenderla o apagarla no recompila los materiales)
      casa.luz.lampara = new T.PointLight(0xFFB86B, 0, 6.5, 1.6); casa.luz.lampara.position.set(-3.05, 1.72, 3.1); e.add(casa.luz.lampara);
    }
    { // 🔭 telescopio en su trípode, junto al sillón, apuntando a la ventana
      const t = cosa("telescopio", -0.45, 3.2, -1.95, [-0.45, 0.8, 3.2, 0.95]);
      const pata = new T.CylinderGeometry(0.018, 0.024, 1.12, 8);
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283 + 0.5, q = cm(pata, madera, Math.sin(a) * 0.2, 0.52, Math.cos(a) * 0.2); q.rotation.set(-Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36); t.add(q); }
      t.add(cm(new T.CylinderGeometry(0.06, 0.06, 0.08, 12), metalOsc, 0, 1.06, 0));
      const piv = new T.Group(); piv.position.y = 1.14; piv.rotation.x = -0.3; t.add(piv);
      const eje = (geo, m, y, z) => { const o = cm(geo, m, 0, y, z); o.rotation.x = Math.PI / 2; piv.add(o); return o; };
      eje(new T.CylinderGeometry(0.095, 0.07, 1.0, 20), mat(0x2E3D6B, { roughness: 0.35, metalness: 0.2 }), 0, 0.1);
      eje(new T.CylinderGeometry(0.105, 0.105, 0.09, 20), matMetal("oro"), 0, 0.58);
      eje(new T.CylinderGeometry(0.03, 0.03, 0.18, 10), metalOsc, 0.01, -0.46); eje(new T.CylinderGeometry(0.024, 0.024, 0.3, 10), metalOsc, 0.12, 0.18);
      const lente = new T.Mesh(new T.CircleGeometry(0.09, 20), mat(0x0B1030, { roughness: 0.1, metalness: 0.5 })); lente.position.z = 0.63; piv.add(lente);
    }
    { // 🐠 pecera con tres peces, sobre su mueble (mirando hacia ti), al lado de la alfombra
      const p = cosa("pecera", 3.05, 0.75, 0.8, [3.05, 0.8, 0.75, 0.8]);
      p.add(bloque(1.0, 0.62, 0.5, madera, 0, 0.31, 0)); p.add(bloque(1.04, 0.04, 0.54, madOsc, 0, 0.64, 0));
      [-0.245, 0.245].forEach(x => p.add(bloque(0.45, 0.46, 0.02, madOsc, x, 0.31, 0.255)));
      p.add(bloque(0.9, 0.1, 0.42, mat(0xE8D7B0, { roughness: 1 }), 0, 0.71, 0));
      const alga = mat(0x4E9A5A, { roughness: 0.8 });
      [[-0.3, 0.08, 0.3], [-0.2, -0.08, 0.2], [0.33, -0.04, 0.26]].forEach(q => p.add(cm(new T.ConeGeometry(0.04, q[2], 6), alga, q[0], 0.76 + q[2] / 2, q[1])));
      const peces = [];
      [0xFF8A3D, 0xFFC24A, 0xE4532F].forEach((c, i) => {
        const f = new T.Group(), m = mat(c, { roughness: 0.5 });
        const cu = cm(ESF, m); cu.scale.set(0.07, 0.045, 0.026); f.add(cu);
        const co = cm(new T.ConeGeometry(0.035, 0.05, 4), m, -0.085, 0, 0); co.rotation.z = -Math.PI / 2; f.add(co);
        [-1, 1].forEach(k => { const oj = malla(ESF, negroC, 0.042, 0.012, 0.02 * k); oj.scale.setScalar(0.008); f.add(oj); });
        f.scale.setScalar(1.35); f.userData = { fase: i * 2.1, y: 0.82 + i * 0.08, vel: 0.55 + i * 0.17 }; p.add(f); peces.push(f);
      });
      const agua = new T.Mesh(CAJA, new T.MeshStandardMaterial({ color: new T.Color(0x58B7DA).convertSRGBToLinear(), transparent: true, opacity: 0.48, roughness: 0.1, depthWrite: false }));
      agua.scale.set(0.88, 0.42, 0.4); agua.position.y = 0.87; p.add(agua);
      const vidrio = new T.Mesh(CAJA, new T.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false }));
      vidrio.scale.set(0.92, 0.5, 0.44); vidrio.position.y = 0.92; p.add(vidrio);
      // el marco: arriba y abajo, y las cuatro esquinas
      [0.67, 1.165].forEach(y => { [-0.22, 0.22].forEach(z => p.add(bloque(0.94, 0.03, 0.025, metalOsc, 0, y, z))); [-0.46, 0.46].forEach(x => p.add(bloque(0.025, 0.03, 0.46, metalOsc, x, y, 0))); });
      [-0.46, 0.46].forEach(x => [-0.22, 0.22].forEach(z => p.add(bloque(0.02, 0.5, 0.02, metalOsc, x, 0.92, z))));
      p.userData.peces = peces; nadar(p, 0);
    }
    { // 🐈 un gato que duerme la siesta en su cojín (y mueve la cola)
      const g = cosa("gato", 1.35, 3.05, 0.5, [1.35, 0.3, 3.05, 0.62]);
      g.add(cm(new T.CylinderGeometry(0.44, 0.47, 0.13, 28), mat(0xD9A441, { roughness: 1 }), 0, 0.065, 0));
      const pelo = mat(0xE39147, { roughness: 0.9 }), claro = mat(0xF6E3C8, { roughness: 0.9 });
      const cu = cm(ESF, pelo, -0.02, 0.25, 0); cu.scale.set(0.3, 0.16, 0.24); g.add(cu);
      const ca = cm(ESF, pelo, 0.24, 0.27, 0.1); ca.scale.set(0.13, 0.11, 0.12); g.add(ca);
      [-1, 1].forEach(k => {
        const o = cm(new T.ConeGeometry(0.045, 0.09, 4), pelo, 0.25, 0.38, 0.1 + k * 0.06); o.rotation.set(k * 0.35, 0, -0.25); g.add(o);
        const oj = bloque(0.012, 0.008, 0.04, negroC, 0.355, 0.29, 0.1 + k * 0.045); oj.rotation.y = -k * 0.4; oj.castShadow = false; g.add(oj);
        const pa = cm(ESF, claro, 0.27, 0.15, 0.03 + k * 0.08); pa.scale.set(0.07, 0.04, 0.045); g.add(pa);
      });
      const ho = cm(ESF, claro, 0.34, 0.24, 0.1); ho.scale.set(0.045, 0.035, 0.05); g.add(ho);
      const cola = new T.Group(); cola.position.set(-0.02, 0.15, 0); cola.rotation.y = -0.94; g.add(cola);
      const tc = cm(new T.TorusGeometry(0.33, 0.045, 8, 24, 2.2), pelo); tc.rotation.x = Math.PI / 2; cola.add(tc);
      g.userData.cola = cola; burbujas(g, "z", "#5C7FA8", 0.3, 0.5, 0.1);
    }
    { // 🎶 tocadiscos sobre un mueble bajo, adelante a la derecha
      const t = cosa("tocadiscos", 2.9, 2.45, 0.8, [2.9, 0.7, 2.45, 0.85]);
      t.add(bloque(1.3, 0.6, 0.5, madera, 0, 0.36, 0));
      [-0.55, 0.55].forEach(x => [-0.18, 0.18].forEach(z => t.add(cm(new T.CylinderGeometry(0.025, 0.02, 0.06, 8), madOsc, x, 0.03, z))));
      [-0.32, 0.32].forEach(x => t.add(bloque(0.6, 0.48, 0.02, madOsc, x, 0.36, 0.251)));
      t.add(bloque(0.64, 0.09, 0.46, mat(0xEFE9DF, { roughness: 0.6 }), -0.24, 0.705, 0));
      const plato = new T.Group(); plato.position.set(-0.3, 0.757, 0.02); t.add(plato);
      plato.add(cm(new T.CylinderGeometry(0.19, 0.19, 0.016, 40), mat(0x18181B, { roughness: 0.35 })));
      plato.add(malla(new T.CylinderGeometry(0.065, 0.065, 0.018, 24), mat(0xE4532F, { roughness: 0.7 })));
      const marca = malla(CAJA, mat(0xFBFAF6), 0.03, 0, 0); marca.scale.set(0.05, 0.02, 0.016); plato.add(marca);
      t.add(cm(new T.CylinderGeometry(0.03, 0.03, 0.05, 10), metalOsc, -0.02, 0.775, -0.16));
      const brazo = bloque(0.018, 0.018, 0.25, metalOsc, -0.08, 0.795, -0.06); brazo.rotation.y = 0.45; t.add(brazo);
      t.add(bloque(0.3, 0.4, 0.26, madOsc, 0.42, 0.86, -0.02));
      const cono = malla(new T.CircleGeometry(0.085, 20), negroC, 0.42, 0.89, 0.111); t.add(cono);
      t.userData.plato = plato; burbujas(t, "♪", "#E4532F", -0.3, 0.95, 0.02);
    }
    { // 🌍 globo terráqueo en su pie de madera, bajo la repisa
      const g = cosa("globo", 0.0, -3.0, 0, [-0.05, 0.7, -3.0, 0.7]);
      g.add(cm(new T.CylinderGeometry(0.2, 0.24, 0.05, 24), madOsc, 0, 0.025, 0)); g.add(cm(new T.CylinderGeometry(0.03, 0.045, 0.6, 10), madera, 0, 0.33, 0));
      const eje = new T.Group(); eje.position.y = 0.62; eje.rotation.z = 0.41; g.add(eje);
      const aro = cm(new T.TorusGeometry(0.31, 0.014, 8, 40, Math.PI), matMetal("oro"), 0, 0.31, 0); aro.rotation.z = -Math.PI / 2; eje.add(aro);
      const tierra = cm(new T.SphereGeometry(0.27, 32, 20), mat(0xFFFFFF, { map: texGlobo(), roughness: 0.55 }), 0, 0.31, 0); eje.add(tierra);
      g.userData.tierra = tierra;
    }
    { // 🎸 guitarra apoyada en la pared, bajo el cuadro
      const g = cosa("guitarra", -3.2, -0.8, Math.PI / 2, [-3.25, 0.65, -0.8, 0.8]);
      const gu = new T.Group(); gu.rotation.x = -0.18; g.add(gu);
      const caja = mat(0xD99A5B, { roughness: 0.5 }), oscura = mat(0x5A3A22, { roughness: 0.6 });
      [[0.22, 0.24], [0.17, 0.5]].forEach(q => { const b = cm(new T.CylinderGeometry(q[0], q[0], 0.1, 32), caja, 0, q[1], 0); b.rotation.x = Math.PI / 2; gu.add(b); });
      gu.add(malla(new T.CircleGeometry(0.062, 24), negroC, 0, 0.44, 0.052));
      gu.add(bloque(0.14, 0.03, 0.012, oscura, 0, 0.2, 0.056));
      gu.add(bloque(0.07, 0.58, 0.04, oscura, 0, 0.92, 0)); gu.add(bloque(0.09, 0.16, 0.035, oscura, 0, 1.28, -0.005));
      const cuerdas = bloque(0.03, 1.0, 0.004, mat(0xEDEDED, { roughness: 0.3, metalness: 0.6 }), 0, 0.72, 0.054); cuerdas.castShadow = false; gu.add(cuerdas);
    }
    return casa;
  }
  /* Símbolos que suben y se desvanecen (las notas del tocadiscos, los zzz del gato) */
  function texSimbolo(t, color) { return texCache("sim:" + t + color, () => { const [c, g] = lienzo(64); g.fillStyle = color; g.font = "800 46px " + UI; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 32, 34); return tex(c); }); }
  function burbujas(grupo, t, color, x, y, z) {
    grupo.userData.burbujas = [0, 1, 2].map(i => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: texSimbolo(t, color), transparent: true, depthWrite: false, opacity: 0 }));
      sp.scale.setScalar(0.2 + i * 0.03); grupo.add(sp); return { sp, x, y, z, fase: i / 3 };
    });
    flotar(grupo.userData.burbujas, 0);
  }
  function flotar(l, t) {
    l.forEach((b, i) => {
      const f = CALMO ? 0.4 : (t * 0.3 + b.fase) % 1;
      b.sp.position.set(b.x + Math.sin(f * 5 + i * 2) * 0.07, b.y + f * 0.75, b.z);
      b.sp.material.opacity = CALMO ? (i ? 0 : 0.85) : Math.sin(f * Math.PI) * 0.9;
    });
  }
  /* Los peces van y vienen por la pecera */
  function nadar(p, t) {
    p.userData.peces.forEach(f => {
      const u = f.userData, a = t * u.vel + u.fase;
      f.position.set(Math.sin(a) * 0.31, u.y + Math.sin(a * 2.3) * 0.02, Math.sin(a * 0.5 + u.fase) * 0.1);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
  }
  /* El globo: océano, continentes inventados y los polos */
  function texGlobo() {
    return texCache("globo", () => {
      const [c, g] = lienzo(512, 256), rs = semilla(21);
      g.fillStyle = "#3F7FB8"; g.fillRect(0, 0, 512, 256);
      [[90, 80, 60, 45], [125, 170, 35, 55], [255, 80, 45, 35], [272, 160, 40, 55], [365, 90, 80, 45], [425, 185, 35, 22]].forEach(([x, y, w, h], i) => {
        g.fillStyle = i % 2 ? "#7DB36A" : "#A8C77E";
        for (let k = 0; k < 14; k++) { g.beginPath(); g.ellipse(x + (rs() - 0.5) * w, y + (rs() - 0.5) * h, w * (0.25 + rs() * 0.3), h * (0.25 + rs() * 0.3), rs() * 3, 0, 6.283); g.fill(); }
      });
      g.fillStyle = "#F4F1EA"; g.fillRect(0, 0, 512, 16); g.fillRect(0, 240, 512, 16);
      g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = 1.5; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(0, k * 256 / 6); g.lineTo(512, k * 256 / 6); g.stroke(); }
      return tex(c);
    });
  }
  /* La pared: gris de siempre o el color que compraste (dos tonos, a rayas) */
  function pintarPared(p) {
    const M = casa.muro, k = p ? p.join() : "gris"; if (M.clave === k) return;
    M.clave = k; const [a, b] = p || ["#DCE3E7", "#D2DADF"];
    M.g.fillStyle = a; M.g.fillRect(0, 0, 256, 256); M.g.fillStyle = b; for (let i = 0; i < 8; i += 2) M.g.fillRect(i * 32, 0, 32, 256);
    M.t.needsUpdate = true;
  }
  /* Los libros de la biblioteca: uno por libro que terminaste (hasta llenarla) */
  function ponerLibros(n) {
    const b = casa.cosas.biblioteca, g = b.userData.libros; if (b.userData.n === n) return;
    b.userData.n = n;
    while (g.children.length) g.remove(g.children[0]);   // caja y colores son compartidos: no hay nada que liberar
    const mats = casa.matsLibro || (casa.matsLibro = [0xE4532F, 0x2E3D6B, 0xD9A441, 0x6E9A6A, 0xEDE3D0, 0x3B3B40, 0x9C4A3A, 0x5C7FA8].map(c => mat(c, { roughness: 0.7 })));
    const rnd = semilla(11); let k = 0;
    [0.07, 0.95, 1.83].forEach(y => {
      let x = -0.86;
      while (k < n && x < 0.86) {
        const w = 0.06 + rnd() * 0.06, h = 0.48 + rnd() * 0.24; if (x + w > 0.86) break;
        const lb = bloque(w, h, 0.36 + rnd() * 0.06, mats[Math.floor(rnd() * mats.length)], x + w / 2, y + h / 2, 0.02); g.add(lb); x += w + 0.004; k++;
      }
    });
  }
  /* Las medallas de la repisa (las mismas que se abren de cerca) o un lugar libre */
  function ponerRepisa(ids) {
    casa.lugares.forEach((L, i) => {
      const id = ids[i] || null; if (L.id === id && L.listo) return;
      while (L.g.children.length) { const o = L.g.children.pop(); liberar(o); }
      L.id = id; L.listo = true;
      if (id) {
        const I = D.info(id); if (!I) return;
        const m = heroMedalla(I, true); m.scale.setScalar(0.22); m.traverse(o => { if (o.isMesh) o.castShadow = true; }); L.g.add(m);
      } else {
        const aro = new T.Mesh(new T.TorusGeometry(0.85, 0.06, 10, 40), vidrioDe("plata")); aro.scale.setScalar(0.22); L.g.add(aro);
      }
    });
  }
  /* op (para la foto de la Tienda): { cosa, pared } que se muestran aunque aún no sean tuyas */
  function actualizarCasa(op) {
    const h = new Date(), f = franjaDe(h.getHours()), L = LUZ_FRANJA[f];
    if (casa.franja !== f) {
      casa.franja = f; casa.escena.background = new T.Color(L.fondo);
      casa.ventana.material.map = texVentana(f); casa.ventana.material.needsUpdate = true;
      const { hemi, sol, vent, cuarto } = casa.luz;
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
      sol.color.set(L.sol[0]); sol.intensity = L.sol[1]; vent.color.set(L.vent[0]); vent.intensity = L.vent[1]; cuarto.intensity = L.cuarto;
    }
    const cosas = new Set(D.cosas()); if (op && op.cosa) cosas.add(op.cosa);
    Object.keys(casa.cosas).forEach(k => { casa.cosas[k].visible = cosas.has(k); });
    pintarPared(op && op.pared ? op.pared : D.pared ? D.pared() : null);
    // la lámpara alumbra al atardecer y de noche
    const lam = cosas.has("lampara") ? { dia: 0, tarde: 0.6, noche: 1.4 }[casa.franja] : 0;
    casa.luz.lampara.intensity = lam; casa.cosas.lampara.userData.pantalla.material.emissiveIntensity = lam ? 0.4 + lam * 0.4 : 0;
    if (cosas.has("biblioteca")) ponerLibros(Math.min(48, D.libros()));
    const cerr = D.cerrados ? D.cerrados() : [], claveCal = h.toDateString() + cerr.length;
    if (casa.claves.cal !== claveCal) {
      casa.claves.cal = claveCal;
      if (casa.calendario.material.map) casa.calendario.material.map.dispose();
      casa.calendario.material.map = texCalendario(h, new Set(cerr)); casa.calendario.material.needsUpdate = true;
    }
    ponerRepisa(D.repisa());
    ponerElefante();
    ponerHora(true);
    pedir();
  }
  /* Tu elefante: se vuelve a armar solo cuando cambia su tipo, su etapa, su ropa o su ánimo */
  function ponerElefante() {
    const spec = D.elefante && typeof crearElefante3D === "function" ? D.elefante() : null, clave = JSON.stringify(spec);
    if (casa.claves.ele === clave) return;
    casa.claves.ele = clave;
    if (casa.ele) { casa.eleRaiz.remove(casa.ele.g); casa.ele.dispose(); casa.ele = null; }
    if (!spec) return;
    casa.ele = crearElefante3D(T, Object.assign({}, spec, { calmo: CALMO }));
    casa.ele.g.traverse(o => { if (o.isMesh) o.castShadow = !LENTO; });
    casa.eleRaiz.add(casa.ele.g);
    if (rut && rut.pose) casa.ele.postura(rut.pose, true);   // si le cambiaste la ropa, sigue en lo que estaba
  }
  let segCasa = -1;
  function ponerHora(forzar) {
    const r0 = casa.cosas.reloj; if (!r0 || !r0.visible) return;
    const d = new Date(), s0 = d.getSeconds(); if (!forzar && s0 === segCasa) return; segCasa = s0;
    const mi = d.getMinutes() + s0 / 60; r0.userData.m.rotation.z = -mi / 60 * 6.283; r0.userData.h.rotation.z = -((d.getHours() % 12) + mi / 60) / 12 * 6.283;
  }
  /* En pantalla completa (libre) el cuarto se gira un poco y se acerca; arriba y abajo es lo que tapan la barra y la hoja */
  const VC = { yaw: CASA_V.yaw, zoom: 1 }, VCo = { yaw: CASA_V.yaw, zoom: 1 }, VC_LIM = { yaw: [CASA_V.yaw - 0.55, CASA_V.yaw + 0.55], zoom: [0.62, 1.12] };
  function vistaCasaMoviendo() { return Math.abs(VC.yaw - VCo.yaw) > 1e-3 || Math.abs(VC.zoom - VCo.zoom) > 1e-3; }
  function camaraCasa() {
    // en la tarjeta el cuarto entra entero; a pantalla completa y en vertical se acerca más (se recortan un poco los bordes; se mira arrastrando)
    const [w, h] = areaLibre(), asp = w / h, rel = CASA_V.aspecto / asp;
    const d = CASA_V.dist * Math.max(1, Math.pow(rel, casa && casa.libre ? 0.6 : 0.92)) * VC.zoom, t = CASA_V.target;
    camC.aspect = asp; camC.position.set(t.x + d * Math.sin(VC.yaw) * Math.cos(CASA_V.pitch), t.y + d * Math.sin(CASA_V.pitch), t.z + d * Math.cos(VC.yaw) * Math.cos(CASA_V.pitch));
    camC.lookAt(t);
    corrimiento(camC, w, h); camC.updateProjectionMatrix(); camC.updateMatrixWorld();
  }
  const PC = new T.Vector3();
  function enPantallaC(v) { PC.copy(v).project(camC); return PC.z < 1 && PC.z > -1 ? [(PC.x + 1) / 2 * ancho, (1 - PC.y) / 2 * alto] : null; }
  /* Una foto para la ficha de la Tienda: esa cosa en su rincón (aunque aún no sea tuya) o el cuarto
     pintado de ese color, con tu elefante en su alfombra. Después todo vuelve a como está */
  const camF = new T.PerspectiveCamera(30, 1, 0.1, 100);
  function fotoCuarto(op, w, hh) {
    armarCasa(); actualizarCasa(op);
    const pr = r.getPixelRatio(), a0 = ancho, h0 = alto, o = op.cosa && casa.cosas[op.cosa];
    r.setPixelRatio(1); r.setSize(w, hh, false); ancho = w; alto = hh;
    let c = camC;
    if (o) {
      const [x, y, z, rad] = o.userData.foco, asp = w / hh, d = rad / Math.tan(15 * Math.PI / 180) / Math.min(1, asp) * 1.15, pit = 0.42;
      camF.aspect = asp; camF.position.set(x + d * Math.sin(CASA_V.yaw) * Math.cos(pit), y + d * Math.sin(pit), z + d * Math.cos(CASA_V.yaw) * Math.cos(pit));
      camF.lookAt(x, y, z); camF.updateProjectionMatrix(); c = camF;
    } else { const v = { ...VC }, e = { ...ENC }; Object.assign(VC, { yaw: CASA_V.yaw, zoom: 1 }); Object.assign(ENC, { arriba: 0, abajo: 0, der: 0 }); camaraCasa(); Object.assign(VC, v); Object.assign(ENC, e); }   // el cuarto entero, de frente
    ponerHora(true);
    // en la foto, tu elefante posa parado en su alfombra (después vuelve a lo que estaba haciendo)
    const antes = rut ? { x: rut.x, z: rut.z, rot: rut.rot } : null;
    if (rut) { Object.assign(rut, { x: ALFOMBRA.x - 0.1, z: ALFOMBRA.z, rot: 0.35 }); rutPoner(); }
    if (casa.ele) casa.ele.postura({}, true);
    r.toneMappingExposure = LUZ_FRANJA[casa.franja].exp; r.render(casa.escena, c);
    let url = null; try { url = canvas.toDataURL("image/jpeg", 0.88); } catch (e) { url = null; }
    r.setPixelRatio(pr); ancho = a0; alto = h0; if (a0 && h0) r.setSize(a0, h0, false);
    if (antes) { Object.assign(rut, antes); rutPoner(); }
    if (casa.ele && rut && rut.pose) casa.ele.postura(rut.pose, true);
    actualizarCasa();
    return url;
  }
  /* ¿Está tu elefante bajo el dedo? */
  const RAY = new T.Raycaster(), NDC = new T.Vector2();
  function eleEn(x, y) {
    if (!casa || !casa.ele) return false;
    camaraCasa(); NDC.set(x / ancho * 2 - 1, -(y / alto) * 2 + 1); RAY.setFromCamera(NDC, camC);
    return RAY.intersectObject(casa.ele.g, true).some(h => h.object.isMesh);
  }
  const REACCIONES = ["salta", "saluda", "corazones"]; let nReac = 0;
  function tocarEle() { if (!casa.ele || casa.ele.ocupado()) return; casa.ele.reaccion(REACCIONES[nReac++ % REACCIONES.length]); if (rut) rut.toque = true; if (D.tocoEle) D.tocoEle(); pedir(); }

  /* ============================================================
     La rutina de tu elefante: va de un rincón a otro y hace algo en cada uno.
     casa.js dice qué hace ahora (lo mismo que cuenta tu casa en Inicio) y qué puede hacer según
     lo que hay en el cuarto y la hora. Gira hacia donde va, camina, se acomoda y lo hace un rato;
     entre una cosa y otra te mira. Si lo tocas, deja lo que hacía y reacciona.
     En calma (sin animaciones) lo encuentras quieto en su rincón, haciendo lo de ahora.
     en: dónde se para · mira: hacia dónde («tu»: hacia ti) · pose: su postura (elefante-3d.js)
     ============================================================ */
  const RUT = {
    siesta: { en: [0.45, 0.6], mira: 0.35, pose: { echado: 1, dormir: 1 }, dura: [12, 18] },
    ventana: { en: [-0.55, 1.05], mira: Math.PI, pose: { alza: 0.55 }, dura: [6, 9], mirar: 0.5 },
    repisa: { en: [0.95, -1.45], mira: Math.PI / 2, pose: { alza: 0.75 }, dura: [6, 9], mirar: 0.55 },
    libros: { en: [-1.7, -1.35], mira: 1.91, pose: { alza: 0.35 }, dura: [6, 8], mirar: 0.45 },
    planta: { en: [1.3, -1.7], mira: 0.64, pose: { regar: 1, alza: 0.15 }, dura: [5, 7] },
    peces: { en: [0.85, 0.58], mira: -0.13, pose: { alza: 0.05 }, dura: [6, 9], mirar: 0.5, rapido: true },
    gato: { en: [0.95, 1.5], mira: -1.31, pose: { olfa: 0.6 }, dura: [5, 7], corazones: 1.6 },
    baile: { en: [0.9, 0.9], mira: "tu", pose: { baile: 1 }, dura: [6, 9] },
    pasea: { en: "suelto", pose: { olfa: 1, andar: 0.2 }, dura: [3.5, 5], mirar: 0.3 },
    sentado: { en: [0.45, 0.6], mira: "tu", pose: { sentado: 1 }, dura: [6, 9], tu: true },
    cola: { en: "aqui", pose: { andar: 0.8 }, dura: [2.6, 2.6], gira: 5 },
  };
  const ANG = a => Math.atan2(Math.sin(a), Math.cos(a));   // entre -π y π
  const azar = r => r[0] + Math.random() * (r[1] - r[0]);
  let rut = null;
  /* Hacia dónde tiene que mirar para verte (la cámara), y cuánto gira la cabeza para eso */
  function anguloTu(x, z) { camaraCasa(); return Math.atan2(-(camC.position.z - z), camC.position.x - x); }
  function giroTu() { return limitar(ANG(anguloTu(rut.x, rut.z) - rut.rot) / 0.62, -1, 1); }
  function rutLugar(id) {
    const R = RUT[id], quieto = CALMO && (R.en === "suelto" || R.en === "aqui");
    const [x, z] = quieto ? RUT.siesta.en : R.en === "suelto" ? [-1.2 + Math.random() * 2.4, -1.2 + Math.random() * 2.5] : R.en === "aqui" ? [rut.x, rut.z] : R.en;
    const mira = quieto ? 0.35 : R.mira === "tu" ? anguloTu(x, z) + 0.35 : R.en === "suelto" ? Math.random() * 6.283 : R.en === "aqui" ? rut.rot : R.mira;
    return { x, z, mira };
  }
  function rutPoner() {
    if (!casa || !rut) return;
    casa.eleRaiz.position.set(rut.x, 0.02, rut.z); casa.eleRaiz.rotation.y = rut.rot;
    casa.sombra.position.set(rut.x + 0.1 * Math.cos(rut.rot), 0.02, rut.z - 0.1 * Math.sin(rut.rot)); casa.sombra.rotation.z = rut.rot;
  }
  function posar(p, ya) { rut.pose = p; if (casa.ele) casa.ele.postura(p, ya); }
  /* Empieza a hacer algo: camina hasta su rincón (o ya está ahí: aca; en calma no camina, salvo en las pruebas) */
  function empezar(id, aca, caminar) {
    if (!RUT[id]) id = "sentado";
    rut.act = id; rut.t = 0; rut.hizo = false; rut.dest = rutLugar(id);
    if (aca || (CALMO && !caminar)) {
      Object.assign(rut, { x: rut.dest.x, z: rut.dest.z, rot: rut.dest.mira, fase: "hace", dura: azar(RUT[id].dura) });
      posar(CALMO && id === "cola" ? RUT.sentado.pose : { ...RUT[id].pose, ...(RUT[id].tu ? { giro: giroTu(), alza: 0.2 } : {}) }, true);
      rutPoner();
    } else rut.fase = Math.hypot(rut.dest.x - rut.x, rut.dest.z - rut.z) > 0.08 ? "gira" : "acomoda";
    if (D.haciendo) D.haciendo(id);
  }
  /* Lo que sigue: al azar entre lo que puede hacer (no lo mismo dos veces) */
  function siguiente() {
    const l = (D.actividades ? D.actividades() : [["sentado", 1], ["pasea", 1]]).filter(([id]) => RUT[id] && id !== rut.act);
    let x = Math.random() * l.reduce((m, a) => m + a[1], 0);
    for (const [id, w] of l) { x -= w; if (x < 0) return id; }
    return l.length ? l[l.length - 1][0] : "sentado";
  }
  /* Al montar el cuarto: si pasó un rato (o cambió lo que hace ahora), lo encuentras en eso, en su rincón */
  function rutinaAlEntrar() {
    if (!casa) return;
    const ahora = D.ahora ? D.ahora() : "sentado";
    if (!rut) rut = { x: ALFOMBRA.x - 0.1, z: ALFOMBRA.z, rot: 0.35, act: null, fase: "hace", t: 0, dura: 0, pose: {}, visto: 0 };
    if (rut.ahora !== ahora || Date.now() - rut.visto > 120000 || CALMO) { rut.ahora = ahora; rut.toque = false; empezar(ahora, true); }
    else if (D.haciendo) D.haciendo(rut.act);   // sigue en lo suyo: la hoja nueva dice qué
    rut.visto = Date.now();
  }
  function avanzarRutina(dt) {
    if (!casa || !casa.ele || !rut) return;
    const E = casa.ele, R = RUT[rut.act]; rut.visto = Date.now();
    if (rut.toque) {   // lo tocaste: se para, te mira y reacciona; después elige otra cosa
      if (E.ocupado()) { posar({ giro: giroTu(), alza: 0.25 }); return; }
      rut.toque = false; if (rut.fase === "hace") { rut.fase = "espera"; rut.t = 0; rut.dura = azar([1, 2]); }
    }
    rut.t += dt;
    if (rut.fase === "gira" || rut.fase === "acomoda") {
      const obj = rut.fase === "gira" ? Math.atan2(-(rut.dest.z - rut.z), rut.dest.x - rut.x) : rut.dest.mira, d = ANG(obj - rut.rot);
      rut.rot += Math.sign(d) * Math.min(Math.abs(d), dt * 2.4);
      posar({ andar: 0.55 });
      if (Math.abs(d) < 0.03) { if (rut.fase === "gira") rut.fase = "camina"; else { rut.fase = "hace"; rut.dura = azar(R.dura); } rut.t = 0; }
    } else if (rut.fase === "camina") {
      const dx = rut.dest.x - rut.x, dz = rut.dest.z - rut.z, dist = Math.hypot(dx, dz);
      if (dist < 0.04) { rut.fase = "acomoda"; rut.t = 0; }
      else { const k = Math.min(dist, 0.6 * dt) / dist; rut.x += dx * k; rut.z += dz * k; rut.rot += ANG(Math.atan2(-dz, dx) - rut.rot) * Math.min(1, dt * 6); }
      posar({ andar: 1 });
    } else if (rut.fase === "hace") {
      const p = { ...R.pose };
      if (R.mirar) p.giro = Math.sin(rut.t * (R.rapido ? 1.5 : 0.7)) * R.mirar;
      if (R.tu) { p.giro = giroTu(); p.alza = 0.2; }
      if (R.gira) rut.rot += dt * R.gira;
      if (R.corazones && !rut.hizo && rut.t > R.corazones) { rut.hizo = true; E.reaccion("corazones"); }
      posar(p);
      if (rut.t > rut.dura) { rut.fase = "espera"; rut.t = 0; rut.dura = azar([1.5, 3]); }
    } else {   // espera: te mira un momento y elige lo que sigue
      posar({ giro: giroTu(), alza: 0.2 });
      if (rut.t > rut.dura) empezar(siguiente(), false, true);
    }
    rutPoner();
  }
  /* ¿Qué lugar de la repisa hay bajo el dedo? */
  function lugarEn(x, y) {
    let mejor = null, dmin = TACTIL ? 36 : 28;
    casa.lugares.forEach(L => { const p = enPantallaC(L.pos); if (!p) return; const d = Math.hypot(p[0] - x, p[1] - y); if (d < dmin) { dmin = d; mejor = L; } });
    return mejor;
  }
  let hoverL = null;
  function hoverCasa(L) {
    if (L === hoverL) return;
    hoverL = L; canvas.style.cursor = L ? "pointer" : "";
    const el = document.getElementById("casaEtq"); if (!el) return;
    if (!L) { el.hidden = true; return; }
    const I = L.id ? D.info(L.id) : null, p = enPantallaC(L.pos); if (!p) { el.hidden = true; return; }
    el.innerHTML = "<b></b><span></span>";
    el.querySelector("b").textContent = I ? I.b.nombre : "Lugar libre";
    el.querySelector("span").textContent = I ? (I.fecha ? "Ganada el " + I.fecha : "Ganada") : "Toca para elegir una medalla";
    el.style.left = p[0] + "px"; el.style.top = (p[1] - 14) + "px"; el.hidden = false;
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
    if (modo === "casa" && ultimo && now - ultimo < 32) { raf = requestAnimationFrame(cuadro); return; }   // se mueve poco: 30 cuadros bastan
    const dt = Math.min(LENTO ? 0.1 : 0.05, ultimo ? (now - ultimo) / 1000 : 0.016); ultimo = now;
    const ocupado = !A.vacio() || arrastre || vistaMoviendo() || (modo === "casa" && casa && ((casa.ele && casa.ele.ocupado()) || vistaCasaMoviendo())) || (modo === "cielo" && (etqNueva || Math.abs(cielo.uObj.yaw - cielo.u.yaw) > 1e-3 || Math.abs(cielo.uObj.pitch - cielo.u.pitch) > 1e-3)) || (modo === "cerca" && hero && !hero.A.vacio()) || Math.abs(giro.vel) > 1e-4 || (modo === "cerca" && Math.abs(giro.obj - giro.rot) > 1e-3);
    if (!visible && modo !== "cerca") return;   // quedó fuera de la vista: vuelve al reaparecer
    if (CALMO && !ocupado && !sucio) return;   // sin movimiento: se dibuja solo cuando algo cambia (pedir)
    raf = requestAnimationFrame(cuadro);
    sucio = false; reloj += dt; A.tick(dt); acercarVista(dt);
    if (modo === "cielo") {
      const k = Math.min(1, dt * 8); cielo.u.yaw += (cielo.uObj.yaw - cielo.u.yaw) * k; cielo.u.pitch += (cielo.uObj.pitch - cielo.u.pitch) * k;
      ponerCamara(reloj);
      uE.uT.value = CALMO ? 0 : reloj; uE.uPR.value = r.getPixelRatio();
      elefante.vivo(reloj * 0.6);
      // En pantallas chicas las medallas crecen un poco para que se vean y se puedan tocar
      const esc = limitar(Math.tan(cam.fov * Math.PI / 360) / Math.tan(28 * Math.PI / 180) * 500 / alto, 1, 1.3);
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
    } else if (modo === "casa" && casa) {
      const kv = Math.min(1, dt * 7); VC.yaw += (VCo.yaw - VC.yaw) * kv; VC.zoom += (VCo.zoom - VC.zoom) * kv;
      camaraCasa(); ponerHora(false);
      if (!CALMO) avanzarRutina(dt);
      if (casa.ele) casa.ele.vivo(reloj);
      // las medallas de la repisa se mecen apenas, para que el metal brille; la planta respira
      casa.lugares.forEach(L => { L.g.rotation.y = 0.75 + (CALMO ? 0 : Math.sin(reloj * 0.6 + L.fase) * 0.12); });
      const p = casa.cosas.planta; if (p.visible) p.userData.hojas.rotation.y = CALMO ? 0 : Math.sin(reloj * 0.4) * 0.05;
      const c = casa.cosas.copa; if (c.visible) c.userData.focos.forEach((f, i) => { f.material.color.setHSL([0.11, 0.05, 0.13][i % 3], 1, CALMO ? 0.72 : 0.62 + 0.16 * Math.sin(reloj * 2 + i)); });
      // lo de la Tienda: los peces nadan, el disco y el globo giran, el gato mueve la cola
      const K = casa.cosas, t = CALMO ? 0 : reloj;
      if (K.pecera.visible) nadar(K.pecera, t);
      if (K.tocadiscos.visible) { K.tocadiscos.userData.plato.rotation.y = -t * 3.5; flotar(K.tocadiscos.userData.burbujas, t); }
      if (K.globo.visible) K.globo.userData.tierra.rotation.y = 0.8 + t * 0.25;
      if (K.gato.visible) { K.gato.userData.cola.rotation.y = -0.94 + Math.sin(t * 1.4) * 0.12; flotar(K.gato.userData.burbujas, t); }
      r.toneMappingExposure = LUZ_FRANJA[casa.franja].exp; r.render(casa.escena, camC);
    }
  }

  /* -------- Dedo y mouse -------- */
  /* ¿El lugar está a pantalla completa? (ahí se gira más, se acerca y se pellizca) */
  function libre() { return (modo === "casa" && casa && casa.libre) || (modo === "cielo" && cielo.libre); }
  function zoomObj() { return modo === "casa" ? VCo.zoom : modo === "cielo" ? ZOOMo.cielo : 1; }
  function ponerZoom(z) {
    if (modo === "casa") VCo.zoom = limitar(z, VC_LIM.zoom[0], VC_LIM.zoom[1]);
    else if (modo === "cielo") ZOOMo.cielo = limitar(z, ZOOM_LIM.cielo[0], ZOOM_LIM.cielo[1]);
    pedir();
  }
  const dedos = new Map();   // para pellizcar (dos dedos) a pantalla completa
  let pellizco = null;
  canvas.addEventListener("pointerdown", ev => {
    if (libre()) { dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoomObj() }; } }
    if (!modo || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    arrastre = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, movido: false, tipo: ev.pointerType };
    if (modo === "cerca" || ev.pointerType !== "touch") { try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} }
    giro.vel = 0; arrancar();
  });
  canvas.addEventListener("pointermove", ev => {
    const b = canvas.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top;
    // pellizcar: cada dedo actualiza su posición (el arrastre sigue solo a uno) y la distancia entre ambos acerca o aleja
    if (dedos.has(ev.pointerId)) {
      dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pellizco && dedos.size === 2 && libre()) {
        const [a, c] = [...dedos.values()], d = Math.hypot(a.x - c.x, a.y - c.y);
        ponerZoom(pellizco.z * pellizco.d / Math.max(20, d)); if (arrastre) arrastre.movido = true; return;
      }
    }
    if (!arrastre || arrastre.id !== ev.pointerId) {
      if (ev.pointerType === "mouse") { if (modo === "cielo") { const E = nodoEn(x, y); hover(E); if (!E) canvas.style.cursor = cielo.libre ? "grab" : D.entrar ? "zoom-in" : ""; } else if (modo === "casa" && casa) { const L = lugarEn(x, y); hoverCasa(L); if (!L) canvas.style.cursor = eleEn(x, y) ? "pointer" : casa.libre ? "grab" : D.entrar ? "zoom-in" : ""; } }
      return;
    }
    if (modo === "casa") {
      const dx = ev.clientX - arrastre.x; arrastre.x = ev.clientX; arrastre.y = ev.clientY;
      if (Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) > 6) arrastre.movido = true;
      if (casa && casa.libre && arrastre.movido) { VCo.yaw = limitar(VCo.yaw - dx * 0.006, VC_LIM.yaw[0], VC_LIM.yaw[1]); hoverCasa(null); pedir(); }
      return;
    }
    const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y; arrastre.x = ev.clientX; arrastre.y = ev.clientY;
    if (!arrastre.movido && Math.hypot(ev.clientX - arrastre.x0, ev.clientY - arrastre.y0) > 6) { arrastre.movido = true; hover(null); }
    if (!arrastre.movido) return;
    if (modo === "cielo") {
      const k = (cam.fov * Math.PI / 180) / alto;
      cielo.uObj.yaw = limitar(cielo.uObj.yaw + dx * k, VISTA.lim.yaw[0], VISTA.lim.yaw[1]);
      if (arrastre.tipo !== "touch" || cielo.libre) cielo.uObj.pitch = limitar(cielo.uObj.pitch + dy * k, VISTA.lim.pitch[0], VISTA.lim.pitch[1]);
    } else {
      giro.rot += dx * 0.01; giro.obj = giro.rot; giro.vel = dx * 0.01; giro.quieto = 0;
      giro.pitch = limitar(giro.pitch + dy * 0.004, -0.15, 0.7);
    }
    pedir();
  });
  const soltarDedo = (ev, cancelado) => {
    dedos.delete(ev.pointerId); if (dedos.size < 2) pellizco = null;
    if (!arrastre || arrastre.id !== ev.pointerId) return;
    const a = arrastre; arrastre = null;
    if (cancelado || a.movido) return;
    const b = canvas.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top;
    if (modo === "casa" && casa) {
      const L = lugarEn(x, y);
      if (L) { hoverCasa(null); if (L.id) D.tocar(L.id); else D.vacio(); }
      else if (eleEn(x, y)) tocarEle();
      else if (!casa.libre && D.entrar) D.entrar("casa");   // en la tarjeta: tocar el cuarto lo abre a pantalla completa
      return;
    }
    if (modo !== "cielo") return;
    const E = nodoEn(x, y);
    if (E) { hover(null); D.tocar(E.id); } else if (!cielo.libre && D.entrar) D.entrar("cielo");
  };
  canvas.addEventListener("pointerup", ev => soltarDedo(ev, false));
  canvas.addEventListener("pointercancel", ev => soltarDedo(ev, true));
  canvas.addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse" && !arrastre) { hover(null); if (casa) hoverCasa(null); } });
  canvas.addEventListener("wheel", ev => {
    if (libre()) { ev.preventDefault(); ponerZoom(zoomObj() * (1 + ev.deltaY * 0.0012)); return; }
    if (modo !== "cerca") return; ev.preventDefault(); giro.zoom = limitar(giro.zoom * (1 + ev.deltaY * 0.0012), 0.6, 1.5); pedir();
  }, { passive: false });
  canvas.addEventListener("dblclick", () => {
    if (!libre()) return;
    if (modo === "casa") { VCo.yaw = CASA_V.yaw; VCo.zoom = 1; }
    else if (modo === "cielo") { cielo.uObj.yaw = cielo.uObj.pitch = 0; ZOOMo.cielo = 1; }
    pedir();
  });
  canvas.addEventListener("webglcontextlost", ev => { ev.preventDefault(); detener(); modo = null; D.perdido(); });

  /* -------- Lo que usa cielo.js -------- */
  return {
    montar(c, lugar, op) {
      const lib = !!(op && op.libre);
      if (!lib) { Object.assign(ENC, { arriba: 0, abajo: 0, der: 0 }); Object.assign(ENCo, ENC); }
      if (lugar === "casa") {
        const libre = !!(op && op.libre); armarCasa();
        if (casa.libre !== libre) { casa.libre = libre; Object.assign(VC, { yaw: CASA_V.yaw, zoom: 1 }); Object.assign(VCo, { yaw: CASA_V.yaw, zoom: 1 }); }
        modo = "casa"; canvas.style.touchAction = libre ? "none" : "pan-y"; actualizarCasa(); rutinaAlEntrar(); colgar(c); arrancar(); return;
      }
      if (cielo.libre !== lib) { cielo.libre = lib; cielo.uObj.yaw = cielo.uObj.pitch = 0; ZOOM.cielo = ZOOMo.cielo = 1; }
      modo = "cielo"; canvas.style.touchAction = lib ? "none" : "pan-y"; colgar(c); actualizar(); arrancar();
    },
    fotoCuarto,
    /* Lo que tapan la barra de arriba y la hoja de abajo (px): el cuarto se encuadra en lo que queda; ya: sin animar */
    encuadre(e, ya) { ENCo.arriba = Math.max(0, e.arriba || 0); ENCo.abajo = Math.max(0, e.abajo || 0); ENCo.der = Math.max(0, e.der || 0); if (ya) Object.assign(ENC, ENCo); pedir(); },
    /* Gira el cielo hacia una constelación (desde la hoja, a pantalla completa) */
    mirarFamilia(id) {
      const F = FIG[id]; if (!F || modo !== "cielo") return;
      cielo.uObj.yaw = limitar(F.yc - VISTA.yaw, VISTA.lim.yaw[0], VISTA.lim.yaw[1]); cielo.uObj.pitch = limitar(F.pc - VISTA.pitch - 0.05, VISTA.lim.pitch[0], VISTA.lim.pitch[1]); pedir();
    },
    /* Cómo está la vista del lugar montado (para las pruebas) */
    vista() { return { modo, libre: libre(), enc: { ...ENC }, zoom: modo === "casa" ? VC.zoom : ZOOM[modo] || 1, u: modo === "cielo" ? { ...cielo.uObj } : null }; },
    /* Dónde está tu elefante en el lienzo (para las pruebas) */
    dondeElefante() { if (modo !== "casa" || !casa || !casa.ele) return null; camaraCasa(); const v = new T.Vector3(); casa.ele.g.getWorldPosition(v); v.y += 0.9; return enPantallaC(v); },
    /* Lo que ocupa en el lienzo cada medalla y cada rótulo del cielo (para las pruebas: que no se tapen) */
    cajasCielo() {
      if (modo !== "cielo") return [];
      ponerCamara(reloj);
      const out = [], v = new T.Vector3(), k = areaLibre()[1] / (2 * Math.tan(cam.fov * Math.PI / 360));   // px por unidad, en lo que no tapan la barra y la hoja
      const caja = (o, f, tipo, w, h) => {
        v.copy(o.position).project(cam); if (v.z > 1 || v.z < -1) return;
        const d = o.position.distanceTo(cam.position), x = (v.x + 1) / 2 * ancho, y = (1 - v.y) / 2 * alto, hw = w * k / d / 2, hh = h * k / d / 2;
        out.push({ f, tipo, x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh });
      };
      Object.values(cielo.nodos).forEach(E => { if (E.nodo.visible) caja(E.nodo, E.I.fam, "medalla", E.nodo.scale.x * 0.78, E.nodo.scale.y * 0.78); });
      Object.keys(cielo.rotulos).forEach(f => { const sp = cielo.rotulos[f]; caja(sp, f, "rotulo", sp.scale.x * 0.82, sp.scale.y * 0.62); });
      if (elefante) {   // la silueta del elefante sobre la loma
        const b = new T.Box3().setFromObject(elefante.g), q = [];
        [b.min.x, b.max.x].forEach(x => [b.min.y, b.max.y].forEach(y => [b.min.z, b.max.z].forEach(z => { v.set(x, y, z).project(cam); q.push([(v.x + 1) / 2 * ancho, (1 - v.y) / 2 * alto]); })));
        out.push({ f: "loma", tipo: "silueta", x0: Math.min(...q.map(a => a[0])), x1: Math.max(...q.map(a => a[0])), y0: Math.min(...q.map(a => a[1])), y1: Math.max(...q.map(a => a[1])) });
      }
      return out;
    },
    /* Lo que ocupa en el lienzo cada medalla de la repisa (para las pruebas: que no se tapen) */
    cajasRepisa() {
      if (modo !== "casa" || !casa) return [];
      camaraCasa();
      const v = new T.Vector3();
      return casa.lugares.filter(L => L.id).map(L => {
        const b = new T.Box3().setFromObject(L.g), q = [];
        [b.min.x, b.max.x].forEach(x => [b.min.y, b.max.y].forEach(y => [b.min.z, b.max.z].forEach(z => { v.set(x, y, z).project(camC); q.push([(v.x + 1) / 2 * ancho, (1 - v.y) / 2 * alto]); })));
        return { i: L.i, x0: Math.min(...q.map(a => a[0])), x1: Math.max(...q.map(a => a[0])), y0: Math.min(...q.map(a => a[1])), y1: Math.max(...q.map(a => a[1])) };
      });
    },
    /* Qué está haciendo tu elefante y dónde (para las pruebas) */
    rutina() { return rut && casa && casa.ele ? { act: rut.act, fase: rut.fase, x: rut.x, z: rut.z, rot: rut.rot, pose: casa.ele.pose() } : null; },
    /* Adelanta su rutina unos segundos, empezando (si se pide) por una actividad (para las pruebas) */
    rutinaPaso(seg, id) {
      if (!casa || !casa.ele) return null; if (!rut) rutinaAlEntrar();
      if (id) empezar(id, false, true);
      for (let i = 0, n = Math.round((seg || 0) * 30); i < n; i++) { reloj += 1 / 30; avanzarRutina(1 / 30); casa.ele.vivo(reloj); }
      pedir(); return this.rutina();
    },
    /* Dónde está un lugar de la repisa en el lienzo (para las pruebas) */
    dondeRepisa(i) { if (modo !== "casa" || !casa || !casa.lugares[i]) return null; camaraCasa(); return enPantallaC(casa.lugares[i].pos); },
    /* Qué cosas se ven en el cuarto y de qué color está la pared (para las pruebas) */
    cuarto() { return casa ? { cosas: Object.keys(casa.cosas).filter(k => casa.cosas[k].visible), pared: casa.muro.clave, lampara: casa.luz.lampara.intensity, elefante: casa.claves.ele ? JSON.parse(casa.claves.ele) : null, reaccion: !!(casa.ele && casa.ele.ocupado()), libre: !!casa.libre, vista: { ...VC, ...ENC } } : null; },
    soltar() {
      modo = null; hover(null); if (casa) hoverCasa(null); detener();
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
