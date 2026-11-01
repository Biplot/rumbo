/* ============================================================
   RUMBO · 🐷 El motor de las alcancías (Finanzas y la Tienda)
   Canvas 2D: las monedas caen por la ranura y se apilan (una pila de alturas en la que cada moneda
   se apoya en lo más alto bajo ella y resbala si queda en una punta). Siete estilos: el chanchito de
   greda (viene con Rumbo), el elefante de la suerte (porcelana que se baña en oro), el elefante de
   greda, el chanchito de vidrio, el frasco, la caja fuerte y el viaje; y la torre del año.
   Cada lienzo canvas[data-alc] se monta solo (data-id: la alcancía; data-modo="muestra": la Tienda).
   Solo se anima lo que se ve y mientras se mueve; quieto no gasta batería.
   ============================================================ */
const ALC_MOTOR = (() => {
  if (typeof document === "undefined") return { cambio() {}, romper() { return false; }, montar() {} };
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const QUIETO = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const C = {};
  const hex = c => { c = String(c || "#888").trim(); if (c.startsWith("rgb")) return (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number); c = c.replace("#", ""); if (c.length === 3) c = c.split("").map(x => x + x).join(""); const n = parseInt(c, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const luz = c => { const [r, g, b] = hex(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const mezcla = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(",")})`; };
  /* Los colores de los materiales (greda, porcelana, acero, vidrio, el paisaje) de día y de noche; la letra y los fondos, del tema */
  const CLARO = { oro: "#F4AE3D", "oro-claro": "#FFD98A", "oro-osc": "#B9761A", coral: "#E8606B", verde: "#2F9E74", vidrio: "rgba(255,255,255,.72)", "vidrio-borde": "rgba(22,26,46,.28)",
    piel: "#8FA5C2", "piel-osc": "#7088A8", "piel-claro": "#B4C6DB", rosa: "#F0B3C1", acero: "#8E98AE", "acero-osc": "#6E7891", "acero-claro": "#B9C1D2",
    cielo: "#BFE3FA", "cielo-2": "#EAF6FD", lago: "#5FA9D6", cerro: "#9ED3A6", "cerro-2": "#7FC28C", greda: "#C4682F", "greda-osc": "#8C3E18", "greda-claro": "#E39A62",
    madera: "#9A6A3E", "madera-osc": "#6B4524", kraft: "#DCBC8C", porcelana: "#EFEBE2", "porcelana-claro": "#FFFFFF", "porcelana-osc": "#B9B1A0" };
  const OSCURO = { oro: "#FFBE55", "oro-claro": "#FFE1A3", "oro-osc": "#C9821F", coral: "#FF7A85", verde: "#4CC795", vidrio: "rgba(200,220,255,.08)", "vidrio-borde": "rgba(220,230,255,.35)",
    piel: "#7C8FAD", "piel-osc": "#60739A", "piel-claro": "#9DB0CB", rosa: "#D99AAA", acero: "#5C6680", "acero-osc": "#454E66", "acero-claro": "#7D88A3",
    cielo: "#14204A", "cielo-2": "#2A3B6E", lago: "#2C5C8C", cerro: "#1E3A3F", "cerro-2": "#173033", greda: "#B35E2B", "greda-osc": "#7A3415", "greda-claro": "#D08652",
    madera: "#8F633B", "madera-osc": "#5E3D20", kraft: "#CDAE80", porcelana: "#D6D1C6", "porcelana-claro": "#F2EEE6", "porcelana-osc": "#8E8778" };
  function colores() {
    const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue(k).trim();
    C.text = v("--text") || "#161A2E"; C.oscuro = luz(C.text) > 0.55;
    C["text-muted"] = v("--text-muted") || (C.oscuro ? "#9AA1C0" : "#5A6183"); C.line = v("--line") || (C.oscuro ? "#262C4A" : "#E1E4EE"); C["line-strong"] = v("--line-strong") || (C.oscuro ? "#39416A" : "#CBD0DF");
    C.surface = v("--surface") || (C.oscuro ? "#141932" : "#FFFFFF"); C["surface-2"] = v("--surface-2") || (C.oscuro ? "#1C2242" : "#EEF0F6"); C.bg = v("--bg") || (C.oscuro ? "#0C0F1E" : "#F5F6FA");
    Object.assign(C, C.oscuro ? OSCURO : CLARO);
    C.indigo = v("--cian") || (C.oscuro ? "#8D9BFF" : "#3949C9");
  }
  /* Los colores de las monedas (Tienda): oro viene con Rumbo */
  const PALETAS = {
    oro: { id: "oro", claro: "#FFD98A", base: "#F4AE3D", osc: "#B9761A" },
    plata: { id: "plata", claro: "#FFFFFF", base: "#C6CDD9", osc: "#7D879B" },
    cobre: { id: "cobre", claro: "#F7C3A0", base: "#CF7A47", osc: "#8E431D" },
    estrella: { id: "estrella", claro: "#FFF2B8", base: "#FFD24A", osc: "#C28E0E", estrella: true },
  };
  let MON = PALETAS.oro;
  const vib = n => { try { if (Array.isArray(n) && typeof window.vibrar === "function") window.vibrar(n); } catch (e) {} };
  const letraQueCabe = (ctx, txt, peso, tam, ancho, fam) => { let t = tam; ctx.font = `${peso} ${t}px ${fam}`; while (t > tam * 0.68 && ctx.measureText(txt).width > ancho) { t -= 0.5; ctx.font = `${peso} ${t}px ${fam}`; } };
  const cortar = (ctx, txt, ancho) => { txt = String(txt || ""); if (ctx.measureText(txt).width <= ancho) return txt; while (txt.length > 1 && ctx.measureText(txt + "…").width > ancho) txt = txt.slice(0, -1); return txt.trim() + "…"; };
  const fmt = n => "$" + Math.round(n).toLocaleString("es-CL");
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v)), azar = (a, b) => a + Math.random() * (b - a);
  const semilla = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const CONF = () => [C.oro, C.coral, C.indigo, C.verde, "#56B6F0", "#F28CB0"];
  const lg = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const rg = (ctx, x, y, r0, r1, st, x1 = x, y1 = y) => { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const ro = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  const sombra = (ctx, x, y, rx, a = 0.2) => { ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.16); ctx.fillStyle = rg(ctx, 0, 0, 0, rx, [[0, `rgba(8,14,36,${C.oscuro ? a * 2 : a})`], [1, "rgba(8,14,36,0)"]]); ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.3); ctx.fill(); ctx.restore(); };
  const estrella = (ctx, x, y, r1, r2) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r2 : r1; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); };
  const brilloVidrio = (ctx, x, y, rx, ry, a0, a1, w = 3, al = 0.6) => { ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0, a1); ctx.stroke(); };

  /* -------- Las monedas: con canto, estrías, estrella grabada y brillo -------- */
  function monedaCara(ctx, x, y, r, ap) {
    const ry = Math.max(0.5, r * ap), th = r * 0.3 * Math.max(0.2, 1 - ap * 0.8);
    ctx.fillStyle = MON.osc;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + r, y + th); ctx.ellipse(x, y + th, r, ry, 0, 0, Math.PI); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, ry, 0, Math.PI, 0, true); ctx.fill();
    if (r > 5 && th > 1) { ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 0.6; for (let i = 1; i < 12; i++) { const f = -1 + i * 2 / 12, xi = x + r * f, d = ry * Math.sqrt(1 - f * f); ctx.beginPath(); ctx.moveTo(xi, y + d); ctx.lineTo(xi, y + d + th); ctx.stroke(); } }
    ctx.fillStyle = lg(ctx, x - r * 0.7, y - ry, x + r * 0.7, y + ry, [[0, MON.claro], [0.55, MON.base], [1, mezcla(MON.base, MON.osc, 0.35)]]);
    ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = rgba(MON.osc, 0.55); ctx.lineWidth = Math.max(0.6, r * 0.09); ctx.beginPath(); ctx.ellipse(x, y, r * 0.74, ry * 0.74, 0, 0, 6.3); ctx.stroke();
    if (r > 4) { ctx.save(); ctx.translate(x, y); ctx.scale(1, Math.max(0.05, ap)); ctx.fillStyle = MON.estrella ? C.indigo : rgba(MON.osc, 0.5); estrella(ctx, 0, 0, r * (MON.estrella ? 0.52 : 0.4), r * (MON.estrella ? 0.22 : 0.17)); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = Math.max(0.6, r * 0.1); ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(x, y, r * 0.86, ry * 0.86, 0, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  }
  const SPRITES = new Map();
  function moneda(ctx, x, y, r) {
    const key = r + "|" + MON.id + "|" + (C.oscuro ? 1 : 0); let s = SPRITES.get(key);
    if (!s) {
      const pad = 2, w = r * 2 + pad * 2, oy = pad + r * 0.42 + 0.5, h = oy + r * 0.42 + r * 0.3 + pad, esc = 3, c = document.createElement("canvas");
      c.width = Math.ceil(w * esc); c.height = Math.ceil(h * esc); const x2 = c.getContext("2d"); x2.scale(esc, esc); monedaCara(x2, w / 2, oy, r, 0.42);
      s = { c, w, h, ox: w / 2, oy }; SPRITES.set(key, s);
    }
    ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  }

  /* Una pila: columnas de alturas; cada moneda se apoya en lo más alto bajo ella y resbala si queda en una punta */
  class Pila {
    constructor(x0, x1, piso, r) { this.x0 = x0; this.x1 = x1; this.piso = piso; this.r = r; this.t = r * 0.4; this.paso = 2; this.n = Math.ceil((x1 - x0) / 2) + 1; this.h = new Float32Array(this.n); }
    i(x) { return limitar(Math.round((x - this.x0) / this.paso), 0, this.n - 1); }
    alto(x) { let m = 0; for (let k = this.i(x - this.r * 0.8); k <= this.i(x + this.r * 0.8); k++) m = Math.max(m, this.h[k]); return m; }
    asentar(x) {
      const r = this.r; x = limitar(x, this.x0 + r * 0.9, this.x1 - r * 0.9);
      for (let k = 0; k < 14; k++) {
        const c = this.alto(x), L = this.alto(x - r), R = this.alto(x + r);
        if (L < c - this.t * 1.1 && x - r * 0.5 > this.x0 + r * 0.9) x -= r * 0.5;
        else if (R < c - this.t * 1.1 && x + r * 0.5 < this.x1 - r * 0.9) x += r * 0.5;
        else break;
      }
      const base = this.alto(x);
      for (let k = this.i(x - r * 0.8); k <= this.i(x + r * 0.8); k++) this.h[k] = base + this.t;
      return { x, y: this.piso - base - this.t * 0.5 };
    }
    media() { let s = 0; for (const v of this.h) s += v; return s / this.n; }
    vaciar() { this.h.fill(0); }
  }
  const MONTON = (() => { const p = new Pila(58, 214, 202, 6.5), rnd = semilla(5), out = []; for (let i = 0; i < 46; i++) out.push(p.asentar(136 + (rnd() + rnd() + rnd() - 1.5) * 70)); return out; })();
  const monton = (ctx, al) => { if (al <= 0) return; ctx.globalAlpha = Math.min(1, al); for (const q of MONTON) moneda(ctx, q.x, q.y, 6.5); ctx.globalAlpha = 1; };
  function capacidad(x0, x1, piso, r, alto) { const p = new Pila(x0, x1, piso, r), rnd = semilla(7); let n = 0; while (p.media() < alto && n < 400) { p.asentar(x0 + rnd() * (x1 - x0)); n++; } return n; }
  /* Partículas: papel picado, monedas sueltas, destellos y polvo */
  class Particulas {
    constructor() { this.l = []; }
    confeti(x, y, n, f = 1) { const cs = CONF(); for (let i = 0; i < n; i++) this.l.push({ t: "c", x, y, vx: azar(-2.4, 2.4) * f, vy: azar(-4.2, -1.4) * f, g: 0.12, a: azar(0, 6), va: azar(-0.3, 0.3), w: azar(3, 6), h: azar(2, 4), c: cs[i % cs.length], vida: 1, fl: azar(0, 6) }); }
    monedas(x, y, n, f = 1, suelo = 214) { for (let i = 0; i < n; i++) this.l.push({ t: "m", x: x + azar(-6, 6), y: y + azar(-4, 4), vx: azar(-2.2, 2.2) * f, vy: azar(-4.5, -1.5) * f, g: 0.2, r: azar(4.5, 6.5), giro: azar(0, 6), suelo: suelo + azar(-4, 4), vida: 1 }); }
    brillo(x, y, n, rx = 30, ry = 20) { for (let i = 0; i < n; i++) this.l.push({ t: "b", x: x + azar(-rx, rx), y: y + azar(-ry, ry), vx: 0, vy: -0.25, g: 0, vida: azar(0.6, 1), s: azar(2, 4.5) }); }
    polvo(x, y, n, c) { for (let i = 0; i < n; i++) this.l.push({ t: "p", x: x + azar(-30, 30), y: y + azar(-12, 12), vx: azar(-1, 1), vy: azar(-1, 0.2), g: -0.01, r: azar(3, 8), c, vida: 1 }); }
    get vivas() { return this.l.length > 0; }
    paso(k) {
      this.l = this.l.filter(p => {
        p.vy += p.g * k; p.x += p.vx * k; p.y += p.vy * k;
        if (p.t === "m") { p.giro += 0.3 * k; if (p.y > p.suelo) { p.y = p.suelo; p.vy *= -0.35; p.vx *= 0.7; if (Math.abs(p.vy) < 0.5) { p.vy = 0; p.g = 0; p.vida -= 0.01 * k; } } }
        else if (p.t === "c") { p.a += p.va * k; p.fl += 0.2 * k; p.vx *= 0.99; p.vida -= 0.007 * k; }
        else if (p.t === "p") { p.r += 0.2 * k; p.vida -= 0.02 * k; }
        else p.vida -= 0.022 * k;
        return p.vida > 0 && p.y < 280;
      });
    }
    pintar(ctx) {
      for (const p of this.l) {
        ctx.globalAlpha = Math.min(1, p.vida * 1.5);
        if (p.t === "c") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.cos(p.fl)); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
        else if (p.t === "m") monedaCara(ctx, p.x, p.y, p.r, 0.3 + 0.65 * Math.abs(Math.cos(p.giro)));
        else if (p.t === "p") { ctx.fillStyle = rgba(p.c, 0.35 * p.vida); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
        else { ctx.fillStyle = "#FFF6D8"; ctx.save(); ctx.translate(p.x, p.y); ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? p.s * 0.3 : p.s * 1.6; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
    }
  }


  /* -------- Las que dejan ver la pila: el chanchito de vidrio y el frasco -------- */
  function conPila(o) {
    const a = { meta: o.meta, guardado: 0, hist: [], cayendo: [], quietas: [], pila: new Pila(o.x0, o.x1, o.piso, o.r), part: new Particulas(), fiesta: 0, roto: 0, golpe: 0 };
    a.cap = capacidad(o.x0, o.x1, o.piso, o.r, o.alto); a.valor = o.meta / a.cap;
    const rnd = semilla(11);
    const rehacer = () => { a.pila.vaciar(); a.quietas = a.quietas.map(q => Object.assign(q, a.pila.asentar(q.x0))); };
    a.inicial = monto => { a.guardado = monto; const n = Math.min(400, Math.round(monto / a.valor)); for (let i = 0; i < n; i++) { const x0 = o.x0 + rnd() * (o.x1 - o.x0); a.quietas.push(Object.assign({ x0 }, a.pila.asentar(x0))); } if (a.guardado >= a.meta) { a.fiesta = 1; a.t0 = -99; } };
    a.sumar = monto => {
      const n = Math.min(40, Math.max(1, Math.round(monto / a.valor))); a.guardado += monto;
      for (let i = 0; i < n; i++) a.cayendo.push({ x: o.boca[0] + azar(-2, 2), y: o.boca[1] - 60 - i * 15, vy: 0, giro: azar(0, 6), fase: 0, destino: o.x0 + Math.random() * (o.x1 - o.x0) });
    };
    a.quitar = monto => { a.guardado = Math.max(0, a.guardado - monto); a.cayendo = []; const n = Math.max(0, a.quietas.length - Math.min(400, Math.round(a.guardado / a.valor))); a.quietas.splice(a.quietas.length - n); rehacer(); if (a.guardado < a.meta) a.fiesta = 0; };
    a.paso = (k, t) => {
      a.golpe = Math.max(0, a.golpe - 0.08 * k);
      for (let i = a.cayendo.length - 1; i >= 0; i--) {
        const c = a.cayendo[i]; c.vy += 0.32 * k; c.y += c.vy * k; c.giro += 0.25 * k;
        if (c.fase === 0 && c.y >= o.boca[1]) { c.fase = 1; a.golpe = 1; a.part.brillo(o.boca[0], o.boca[1] - 4, 1, 6, 3); if (o.entrada) { c.y = o.entrada.y; c.vy = 0.5; c.x = c.destino; } }
        if (c.fase === 1) { c.x += (c.destino - c.x) * 0.12 * k; const tope = o.piso - a.pila.alto(c.x) - a.pila.t * 0.5; if (c.y >= tope) { const q = a.pila.asentar(c.destino); a.quietas.push(Object.assign({ x0: c.destino }, q)); a.cayendo.splice(i, 1); } }
      }
      a.part.paso(k);
      if (a.guardado >= a.meta && !a.cayendo.length && !a.fiesta) { a.fiesta = 1; a.t0 = t; o.lleno && o.lleno(a, t); }
    };
    a.mueve = () => a.cayendo.length > 0 || a.part.vivas || a.golpe > 0 || (a.fiesta && o.anima && o.anima(a));
    a.pintar = (ctx, t) => {
      o.atras(ctx, t, a);
      if (!a.roto) {
        ctx.save(); o.clip(ctx);
        if (o.fondo) o.fondo(ctx, t, a);
        for (const q of a.quietas) moneda(ctx, q.x, q.y, o.r);
        for (const c of a.cayendo) if (c.fase === 1) monedaCara(ctx, c.x, c.y, o.r, 0.35 + 0.55 * Math.abs(Math.cos(c.giro)));
        ctx.restore();
      }
      o.frente(ctx, t, a);
      for (const c of a.cayendo) if (c.fase === 0) monedaCara(ctx, c.x, c.y, o.r * 0.95, 0.3 + 0.65 * Math.abs(Math.cos(c.giro)));
      a.part.pintar(ctx);
    };
    return a;
  }


  /* 2 · El chanchito de greda de Pomaire: redondo, de barro bruñido color teja, patitas en punta, asa arriba y hocico de botón.
     No se ve por dentro: cada moneda lo hace bambolear y la tarjeta del cuello marca el avance. Se rompe con un mazo */
  function greda(d) {
    const CX = 122, CY = 126, RX = 68, RY = 56, PIE = 213, rnd = semilla(21);
    const humo = Array.from({ length: 7 }, () => ({ x: CX + (rnd() - 0.5) * RX * 1.6, y: CY + (rnd() - 0.2) * RY * 1.2, r: 10 + rnd() * 18, a: 0.05 + rnd() * 0.07 }));
    const puntos = Array.from({ length: 34 }, () => ({ x: CX + (rnd() - 0.5) * RX * 1.9, y: CY + (rnd() - 0.5) * RY * 1.9, r: 0.4 + rnd() * 0.7 }));
    const a = { meta: d.meta, guardado: d.guardado, cayendo: [], part: new Particulas(), giro: 0, vgiro: 0, mazo: -1, grieta: 0, roto: 0, trozos: null, nombre: d.nombre, tag: Math.min(1, d.guardado / d.meta) };
    const valor = Math.max(1, d.meta / 30), RANURA = [124, 70];
    a.sumar = m => { a.guardado += m; const n = Math.min(8, Math.max(1, Math.round(m / valor))); for (let i = 0; i < n; i++) a.cayendo.push({ x: RANURA[0] + azar(-2, 2), y: 6 - i * 16, vy: 0, giro: azar(0, 6) }); };
    a.quitar = m => { a.guardado = Math.max(0, a.guardado - m); a.cayendo = []; };
    a.romper = () => { if (a.mazo >= 0 || a.roto) return false; a.mazo = 0; return true; };
    function romperYa() {
      a.roto = 1; a.aparece = 0; vib([40, 30, 80]);
      const rs = semilla(31);
      a.trozos = Array.from({ length: 22 }, (_, i) => {
        const pata = i >= 19, cx = pata ? [86, 160, 100][i - 19] : CX + (rs() - 0.5) * RX * 1.6, cy = pata ? 196 : CY + (rs() - 0.5) * RY * 1.5;
        const n = 5 + Math.floor(rs() * 2), r = pata ? 8 : 10 + rs() * 8, p = [];
        if (pata) p.push([-6, -14], [6, -14], [2, 14], [-2, 14]);
        else for (let s2 = 0; s2 < n; s2++) { const an = s2 / n * 6.283 + rs() * 0.6, rr = r * (0.55 + rs() * 0.55); p.push([Math.cos(an) * rr, Math.sin(an) * rr * 0.8]); }
        const dx = cx - CX, dy = cy - CY + 10, d = Math.hypot(dx, dy) || 1;
        return { p, x: cx, y: cy, vx: dx / d * azar(1.2, 3.4), vy: pata ? -azar(1, 2) : dy / d * azar(0.6, 1.8) - azar(2.4, 4.4), a: 0, va: azar(-0.2, 0.2), vida: 2.2, luz: rs(), cara: rs() < 0.3 };
      });
      a.part.monedas(CX, CY, Math.min(46, Math.round(a.guardado / valor) + 8), 1.25, 204);
      a.part.polvo(CX, CY, 18, C.greda); a.part.confeti(CX, CY - 30, 40, 1.2);
    }
    a.paso = (k, t) => {
      // el bamboleo cuando cae una moneda
      a.vgiro += -a.giro * 0.18 * k; a.vgiro *= Math.pow(0.86, k); a.giro += a.vgiro * k;
      a.tag += (Math.min(1, a.guardado / a.meta) - a.tag) * 0.1 * k;
      for (let i = a.cayendo.length - 1; i >= 0; i--) { const c = a.cayendo[i]; c.vy += 0.32 * k; c.y += c.vy * k; c.giro += 0.25 * k; if (c.y >= RANURA[1]) { a.cayendo.splice(i, 1); a.vgiro += azar(0.012, 0.022) * (Math.random() < 0.5 ? -1 : 1); a.part.brillo(RANURA[0], RANURA[1] - 4, 2, 8, 4); } }
      if (a.mazo >= 0 && !a.roto) { a.mazo += (QUIETO ? 1 : 0.018) * k; if (a.mazo >= 0.72 && !a.grieta) { a.grieta = 0.01; vib(25); a.part.polvo(RANURA[0], RANURA[1], 8, C.greda); a.vgiro += 0.03; } if (a.grieta) a.grieta += 0.06 * k; if (a.mazo >= 1) romperYa(); }
      if (a.trozos) { a.trozos.forEach(tr => { tr.vy += 0.24 * k; tr.x += tr.vx * k; tr.y += tr.vy * k; tr.a += tr.va * k; if (tr.y > 200) { tr.y = 200; tr.vy *= -0.25; tr.vx *= 0.75; tr.va *= 0.7; tr.vida -= 0.012 * k; } }); a.trozos = a.trozos.filter(tr => tr.vida > 0); if (!a.trozos.length) a.trozos = null; }
      if (a.roto && a.aparece < 1) a.aparece = Math.min(1, (a.aparece || 0) + (QUIETO ? 1 : 0.02) * k);
      a.part.paso(k);
    };
    a.mueve = () => (a.roto && a.aparece < 1) || a.cayendo.length > 0 || a.part.vivas || Math.abs(a.vgiro) > 0.0005 || Math.abs(a.giro) > 0.0005 || (a.mazo >= 0 && !a.roto) || !!a.trozos || Math.abs(Math.min(1, a.guardado / a.meta) - a.tag) > 0.002;
    // una pata en punta, como un cono de barro
    const pata = (ctx, x, y, tx, ty, base, oscura) => {
      const G = C.greda, GO = C["greda-osc"], GC = C["greda-claro"];
      ctx.fillStyle = lg(ctx, x - base, 0, x + base, 0, oscura ? [[0, GO], [1, mezcla(GO, "#000", 0.25)]] : [[0, GC], [0.45, G], [1, GO]]);
      ctx.beginPath(); ctx.moveTo(x - base, y); ctx.lineTo(tx - 3.6, ty - 3); ctx.quadraticCurveTo(tx, ty + 1.5, tx + 3.6, ty - 3); ctx.lineTo(x + base, y); ctx.closePath(); ctx.fill();
    };
    a.pintar = (ctx, t) => {
      const G = C.greda, GO = C["greda-osc"], GC = C["greda-claro"];
      sombra(ctx, CX + 4, PIE + 2, 92, 0.24);
      if (a.roto) {
        monton(ctx, a.aparece);
        const forma = tr => { ctx.beginPath(); tr.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
        for (const tr of (a.trozos || [])) {
          ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.a); ctx.globalAlpha = Math.max(0, Math.min(1, tr.vida));
          ctx.save(); ctx.translate(1.6, 2.4); forma(tr); ctx.fillStyle = mezcla(GO, "#000", 0.25); ctx.fill(); ctx.restore();
          // por fuera bruñido; algunos muestran el lado de adentro, más opaco
          forma(tr); ctx.fillStyle = tr.cara ? mezcla(G, "#C9A27A", 0.45) : mezcla(GC, G, tr.luz); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = rgba(GO, 0.8); ctx.stroke();
          if (!tr.cara) { ctx.strokeStyle = "rgba(255,240,220,.4)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tr.p[0][0] * 0.5, tr.p[0][1] * 0.5); ctx.lineTo(tr.p[1][0] * 0.5, tr.p[1][1] * 0.5); ctx.stroke(); }
          ctx.restore();
        }
        ctx.globalAlpha = 1; a.part.pintar(ctx); return;
      }
      ctx.save(); ctx.translate(CX + 4, PIE); ctx.rotate(a.giro); ctx.translate(-(CX + 4), -PIE);
      // patas de atrás (en sombra)
      pata(ctx, 84, 166, 77, PIE - 3, 12, true); pata(ctx, 150, 170, 157, PIE - 4, 12, true);
      // el asa arriba, un aro de greda
      ctx.lineCap = "round";
      ctx.strokeStyle = GO; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(90, 66, 12, 16, -0.15, Math.PI * 0.82, Math.PI * 2.2); ctx.stroke();
      ctx.strokeStyle = lg(ctx, 76, 48, 104, 76, [[0, GC], [1, G]]); ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(90, 66, 12, 16, -0.15, Math.PI * 0.85, Math.PI * 2.17); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,220,.45)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(90, 66, 12, 16, -0.15, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
      // el cuerpo redondo y bruñido: luz arriba a la izquierda, sombra abajo
      const p = new Path2D(); p.ellipse(CX, CY, RX, RY, 0, 0, 6.3);
      ctx.strokeStyle = GO; ctx.lineWidth = 2.5; ctx.stroke(p);
      ctx.fillStyle = rg(ctx, CX - 30, CY - 30, 6, RX * 1.35, [[0, GC], [0.45, G], [0.85, mezcla(G, GO, 0.7)], [1, GO]], CX, CY); ctx.fill(p);
      ctx.save(); ctx.clip(p);
      // el ahumado del horno y los granitos del barro
      humo.forEach(m => { ctx.fillStyle = rg(ctx, m.x, m.y, 0, m.r, [[0, `rgba(50,18,6,${m.a})`], [1, "rgba(50,18,6,0)"]]); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = "rgba(60,20,8,.18)"; puntos.forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.3); ctx.fill(); });
      // las pasadas del bruñido: brillos finos que siguen la forma
      ctx.lineCap = "round";
      [[0.92, 1.12, 1.42, 0.16], [0.8, 1.05, 1.5, 0.12], [0.66, 1.2, 1.55, 0.1], [0.86, 1.62, 1.8, 0.09]].forEach(([k2, a0, a1, al]) => { ctx.strokeStyle = `rgba(255,236,214,${al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(CX, CY, RX * k2, RY * k2, 0, Math.PI * a0, Math.PI * a1); ctx.stroke(); });
      // la luz reflejada abajo
      ctx.strokeStyle = rgba(GC, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(CX, CY, RX - 3, RY - 3, 0, Math.PI * 0.18, Math.PI * 0.62); ctx.stroke();
      // la grieta antes de romperse
      if (a.grieta) { ctx.strokeStyle = "#2A0E04"; ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.globalAlpha = Math.min(1, a.grieta); const L = Math.min(1, a.grieta); [[[124, 72], [116, 90], [126, 104], [112, 124], [122, 146], [116, 170]], [[116, 90], [96, 98], [84, 92]], [[112, 124], [88, 134]], [[126, 104], [150, 112], [162, 104]]].forEach(g => { ctx.beginPath(); g.slice(0, Math.max(2, Math.ceil(g.length * L))).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }); ctx.globalAlpha = 1; }
      ctx.restore();
      // el brillo del bruñido
      ctx.fillStyle = rg(ctx, CX - 28, CY - 30, 0, 26, [[0, "rgba(255,244,228,.55)"], [1, "rgba(255,244,228,0)"]]); ctx.beginPath(); ctx.ellipse(CX - 28, CY - 30, 26, 15, -0.5, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,250,240,.75)"; ctx.beginPath(); ctx.ellipse(CX - 34, CY - 34, 6, 3, -0.6, 0, 6.3); ctx.fill();
      // patas de adelante
      pata(ctx, 100, 172, 95, PIE, 13, false); pata(ctx, 164, 166, 172, PIE - 1, 13, false);
      // las orejas en punta, con su hueco
      const oreja = (x, y, r, s) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(s, s);
        ctx.fillStyle = lg(ctx, -12, -20, 12, 6, [[0, GC], [1, G]]); ctx.beginPath(); ctx.moveTo(-13, 6); ctx.lineTo(-3, -17); ctx.quadraticCurveTo(1, -22, 4, -17); ctx.lineTo(13, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = mezcla(GO, "#000", 0.15); ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, -11); ctx.quadraticCurveTo(1.5, -13, 3, -11); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,240,220,.45)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-11, 3); ctx.lineTo(-3, -15); ctx.stroke();
        ctx.restore();
      };
      oreja(150, 78, 0.18, 1); oreja(172, 88, 0.42, 0.92);
      // el hocico de botón: un cilindro corto con la punta plana y dos hoyitos
      ctx.fillStyle = lg(ctx, 0, 104, 0, 134, [[0, GC], [0.5, G], [1, GO]]); ro(ctx, 180, 104, 32, 30, 8); ctx.fill();
      ctx.fillStyle = lg(ctx, 206, 104, 222, 134, [[0, mezcla(GC, "#fff", 0.15)], [1, G]]); ctx.beginPath(); ctx.ellipse(212, 119, 9, 15, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = rgba(GO, 0.8); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = "#2A0E04"; [[209, 115], [215, 121]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 1.7, 2.8, 0.2, 0, 6.3); ctx.fill(); });
      // el ojo marcado con un punzón y la boca
      ctx.fillStyle = "#24100A"; ctx.beginPath(); ctx.ellipse(170, 106, 2.8, 3.2, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,250,240,.8)"; ctx.beginPath(); ctx.arc(171, 105, 0.9, 0, 6.3); ctx.fill();
      ctx.strokeStyle = rgba(GO, 0.9); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(170, 106, 5.5, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(190, 139); ctx.quadraticCurveTo(196, 142, 202, 138); ctx.stroke();
      // la ranura, con su labio
      ctx.fillStyle = mezcla(GC, "#fff", 0.1); ro(ctx, RANURA[0] - 16, RANURA[1] - 5, 32, 9, 4.5); ctx.fill();
      ctx.fillStyle = "#2A0E04"; ro(ctx, RANURA[0] - 12, RANURA[1] - 3, 24, 5, 2.5); ctx.fill();
      ctx.restore();
      // la tarjeta colgada del cuello: el avance
      const tx = 232, ty = 172, pend = Math.sin(t * 2) * (QUIETO ? 0 : 0.04) + a.giro * 2;
      ctx.strokeStyle = C.madera; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(172, 158); ctx.quadraticCurveTo(200, 176, tx - 15, ty - 6); ctx.stroke();
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(pend - 0.08);
      ctx.fillStyle = C.kraft; ctx.beginPath(); ctx.moveTo(-17, -12); ctx.lineTo(12, -12); ctx.lineTo(19, 0); ctx.lineTo(12, 12); ctx.lineTo(-17, 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba("#5A3A12", 0.4); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(12, 0, 2, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#3E2A12"; ctx.textAlign = "center"; ctx.font = "700 13px Caveat, Figtree, system-ui, sans-serif"; ctx.fillText(Math.round(a.tag * 100) + "%", -3, 4.5);
      ctx.restore();
      // el mazo de madera: toma impulso y golpea el lomo
      if (a.mazo >= 0 && !a.roto) {
        const m = Math.min(1, a.mazo), sube = f => 1 - (1 - f) * (1 - f);
        const th = m < 0.6 ? 0.1 + 0.32 * sube(m / 0.6) : m < 0.72 ? 0.42 - 0.42 * Math.pow((m - 0.6) / 0.12, 2) : -0.05 * Math.sin((m - 0.72) * 30) * (1 - m) * 3;
        ctx.save(); ctx.translate(200, 54); ctx.rotate(th);
        ctx.fillStyle = lg(ctx, 0, -4, 0, 4, [[0, mezcla(C.madera, "#fff", 0.25)], [1, C["madera-osc"]]]); ro(ctx, -64, -4, 78, 8, 4); ctx.fill();
        ctx.fillStyle = C["madera-osc"]; ro(ctx, 4, -5, 10, 10, 4); ctx.fill();
        ctx.fillStyle = lg(ctx, -90, 0, -62, 0, [[0, mezcla(C.madera, "#fff", 0.3)], [0.6, C.madera], [1, C["madera-osc"]]]); ro(ctx, -90, -15, 28, 30, 7); ctx.fill();
        ctx.fillStyle = rgba("#000", 0.16); ctx.fillRect(-90, -9, 28, 2.2); ctx.fillRect(-90, 7, 28, 2.2);
        ctx.fillStyle = rgba("#fff", 0.25); ro(ctx, -86, -12, 5, 24, 2.5); ctx.fill();
        ctx.restore();
      }
      for (const c of a.cayendo) monedaCara(ctx, c.x, c.y, 6.5, 0.3 + 0.65 * Math.abs(Math.cos(c.giro)));
      a.part.pintar(ctx);
    };
    return a;
  }


  /* 3 · El chanchito de vidrio: se ven todas las monedas; al llenarlo, se rompe */
  function vidrio(d) {
    const CX = 132, CY = 132, RX = 84, RY = 58;
    const cuerpo = () => { const p = new Path2D(); p.ellipse(CX, CY, RX, RY, 0, 0, 6.3); return p; };
    const vid = () => C.oscuro ? "rgba(200,225,255,.07)" : "rgba(255,240,246,.6)";
    const a = conPila({
      meta: d.meta, x0: CX - RX + 10, x1: CX + RX - 10, piso: CY + RY - 4, r: 7.5, alto: RY * 1.75, boca: [128, 76],
      clip: ctx => { ctx.clip(cuerpo()); },
      anima: a => !!a.trozos,
      atras: (ctx, t, a) => {
        sombra(ctx, CX, 206, 98);
        if (a.roto) { monton(ctx, a.aparece); for (const tr of (a.trozos || [])) { ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.a); ctx.globalAlpha = Math.max(0, Math.min(1, tr.vida)); ctx.fillStyle = vid(); ctx.strokeStyle = C.rosa; ctx.lineWidth = 2; ctx.beginPath(); tr.p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(tr.p[1][0] * 0.6, tr.p[1][1] * 0.6); ctx.lineTo(tr.p[2][0] * 0.6, tr.p[2][1] * 0.6); ctx.stroke(); ctx.restore(); } ctx.globalAlpha = 1; return; }
        [[78, 176], [104, 182], [160, 182], [186, 176]].forEach(([x, y]) => { ctx.fillStyle = vid(); ro(ctx, x - 9, y, 18, 22, 6); ctx.fill(); ctx.strokeStyle = C.rosa; ctx.lineWidth = 2; ctx.stroke(); brilloVidrio(ctx, x - 3, y + 11, 3, 8, Math.PI * 0.9, Math.PI * 1.3, 1.6, 0.6); });
        ctx.fillStyle = vid(); ctx.fill(cuerpo());
        ctx.fillStyle = rg(ctx, CX, CY + 30, 10, 90, [[0, "rgba(242,140,176,0)"], [1, "rgba(242,140,176,.18)"]]); ctx.fill(cuerpo());
      },
      frente: (ctx, t, a) => {
        if (a.roto) return;
        const p = cuerpo(); ctx.strokeStyle = C.rosa; ctx.lineWidth = 3; ctx.stroke(p);
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(CX, CY, RX - 4, RY - 4, 0, Math.PI * 0.95, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = vid(); ctx.beginPath(); ctx.ellipse(220, 136, 14, 17, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = C.rosa; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.fillStyle = C.rosa; [[216, 131], [216, 141]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 2.4, 3.4, 0, 0, 6.3); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(168, 84); ctx.lineTo(184, 60); ctx.lineTo(194, 90); ctx.closePath(); ctx.fillStyle = vid(); ctx.fill(); ctx.strokeStyle = C.rosa; ctx.stroke();
        ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(196, 112, 3.6, 0, 6.3); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(197.2, 110.6, 1.2, 0, 6.3); ctx.fill();
        ctx.strokeStyle = C.rosa; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(48, 128); ctx.bezierCurveTo(30, 118, 40, 102, 46, 112); ctx.stroke();
        // el tapón de corcho abajo y la ranura
        ctx.fillStyle = C.madera; ctx.beginPath(); ctx.ellipse(132, 189, 9, 3.5, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = mezcla(C.rosa, "#fff", 0.4); ro(ctx, 112, 72, 34, 9, 4.5); ctx.fill(); ctx.fillStyle = C.text; ro(ctx, 116, 74 + a.golpe, 26, 5, 2.5); ctx.fill();
        brilloVidrio(ctx, CX, CY, RX - 12, RY - 12, Math.PI * 1.08, Math.PI * 1.32, 5, 0.7);
        brilloVidrio(ctx, CX, CY, RX - 16, RY - 16, Math.PI * 1.38, Math.PI * 1.44, 4, 0.55);
        brilloVidrio(ctx, CX, CY, RX - 10, RY - 10, Math.PI * 0.08, Math.PI * 0.24, 3, 0.35);
        if (a.grieta) { ctx.strokeStyle = C.oscuro ? "#fff" : C.text; ctx.lineWidth = 1.3; ctx.globalAlpha = Math.min(1, a.grieta); a.grietas.forEach(g => { ctx.beginPath(); g.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }); ctx.globalAlpha = 1; }
      },
    });
    const pasoBase = a.paso;
    a.paso = (k, t) => {
      pasoBase(k, t);
      if (a.grieta && !a.roto) { a.grieta += 0.03 * k; if (a.grieta > 1.4) romperYa(); }
      if (a.roto && a.aparece < 1) a.aparece = Math.min(1, (a.aparece || 0) + (QUIETO ? 1 : 0.02) * k);
      if (a.trozos) { a.trozos.forEach(tr => { tr.vy += 0.22 * k; tr.x += tr.vx * k; tr.y += tr.vy * k; tr.a += tr.va * k; if (tr.y > 196) { tr.y = 196; tr.vy *= -0.3; tr.vx *= 0.8; tr.va *= 0.8; tr.vida -= 0.01 * k; } }); a.trozos = a.trozos.filter(tr => tr.vida > 0); if (!a.trozos.length) a.trozos = null; }
    };
    const mueveBase = a.mueve; a.mueve = () => mueveBase() || (a.grieta && !a.roto) || !!a.trozos || (a.roto && a.aparece < 1);
    function romperYa() {
      a.roto = 1; a.aparece = 0; vib([30, 30, 60]);
      a.trozos = Array.from({ length: 9 }, (_, i) => {
        const a0 = i / 9 * 6.283, a1 = (i + 1) / 9 * 6.283, cx = CX + Math.cos((a0 + a1) / 2) * RX * 0.5, cy = CY + Math.sin((a0 + a1) / 2) * RY * 0.5;
        const p = [[CX - cx, CY - cy], [CX + Math.cos(a0) * RX - cx, CY + Math.sin(a0) * RY - cy], [CX + Math.cos((a0 + a1) / 2) * RX * 1.02 - cx, CY + Math.sin((a0 + a1) / 2) * RY * 1.02 - cy], [CX + Math.cos(a1) * RX - cx, CY + Math.sin(a1) * RY - cy]];
        return { p, x: cx, y: cy, vx: Math.cos((a0 + a1) / 2) * azar(1.2, 2.6), vy: Math.sin((a0 + a1) / 2) * azar(1, 2.5) - 2.5, a: 0, va: azar(-0.12, 0.12), vida: 1.6 };
      });
      a.quietas.forEach((q, i) => { if (i % 2 === 0) a.part.monedas(q.x, q.y, 1, 1.2, 204); });
      a.part.brillo(CX, CY, 14, 70, 40); a.part.confeti(CX, CY - 20, 46, 1.3);
    }
    a.romper = () => { if (a.grieta || a.roto) return false; a.grieta = 0.01;
      a.grietas = Array.from({ length: 5 }, () => { let x = CX + azar(-40, 40), y = CY + azar(-30, 20); const g = [[x, y]]; for (let i = 0; i < 4; i++) { x += azar(-14, 14); y += azar(-12, 12); g.push([x, y]); } return g; }); return true; };
    a.nombre = d.nombre; a.inicial(d.guardado); return a;
  }


  /* 4 · El frasco: vidrio grueso, tapa de rosca, cordel y etiqueta escrita a mano */
  function frasco(d) {
    const X0 = 70, X1 = 190, Y0 = 52, Y1 = 202;
    let tapa = 0;
    const cuerpo = () => { const p = new Path2D(); if (p.roundRect) p.roundRect(X0, Y0, X1 - X0, Y1 - Y0, 22); else p.rect(X0, Y0, X1 - X0, Y1 - Y0); return p; };
    const vid = () => C.oscuro ? "rgba(200,225,255,.06)" : "rgba(235,245,250,.55)";
    const a = conPila({
      meta: d.meta, x0: X0 + 5, x1: X1 - 5, piso: Y1 - 7, r: 7.5, alto: (Y1 - Y0) * 0.88, boca: [130, 34],
      clip: ctx => { ctx.clip(cuerpo()); },
      anima: a => tapa > 0.01 || a.part.vivas,
      lleno: a => { tapa = 1; a.part.brillo(130, 60, 16, 50, 30); a.part.confeti(130, 40, 26, 0.9); },
      atras: (ctx) => {
        sombra(ctx, 130, 206, 74);
        ctx.fillStyle = vid(); ctx.fill(cuerpo()); ro(ctx, X0 + 12, Y0 - 12, X1 - X0 - 24, 14, 4); ctx.fill();
      },
      frente: (ctx, t, a) => {
        tapa = Math.max(0, tapa - 0.012);
        // el vidrio: bordes más gruesos, fondo grueso y reflejos
        const p = cuerpo();
        ctx.fillStyle = lg(ctx, X0, 0, X1, 0, [[0, "rgba(120,170,200,.22)"], [0.12, "rgba(255,255,255,0)"], [0.88, "rgba(255,255,255,0)"], [1, "rgba(80,120,160,.25)"]]); ctx.fill(p);
        ctx.strokeStyle = C["vidrio-borde"]; ctx.lineWidth = 2.6; ctx.stroke(p);
        ctx.fillStyle = "rgba(160,200,225,.22)"; ro(ctx, X0 + 3, Y1 - 10, X1 - X0 - 6, 7, 6); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(X0 + 13, Y0 + 26); ctx.lineTo(X0 + 13, Y1 - 46); ctx.stroke();
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X0 + 22, Y0 + 30); ctx.lineTo(X0 + 22, Y0 + 70); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(X1 - 12, Y0 + 40); ctx.lineTo(X1 - 12, Y1 - 30); ctx.stroke();
        ro(ctx, X0 + 12, Y0 - 12, X1 - X0 - 24, 14, 4); ctx.strokeStyle = C["vidrio-borde"]; ctx.lineWidth = 2; ctx.stroke();
        // el cordel con su moño
        ctx.strokeStyle = C.madera; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X0 + 12, Y0 - 2); ctx.quadraticCurveTo(130, Y0 + 4, X1 - 12, Y0 - 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(150, Y0 + 4, 8, 4, -0.4, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.ellipse(164, Y0 + 3, 8, 4, 0.4, 0, 6.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(157, Y0 + 4); ctx.lineTo(152, Y0 + 18); ctx.moveTo(157, Y0 + 4); ctx.lineTo(163, Y0 + 17); ctx.stroke();
        // la tapa de rosca (salta en la meta)
        ctx.save(); const s = Math.sin(Math.min(1, tapa) * Math.PI), salto = s * 22; ctx.translate(130, 32 - salto); ctx.rotate(-0.25 * s);
        ctx.fillStyle = lg(ctx, -60, -10, 60, 10, [[0, mezcla(C.indigo, "#fff", 0.25)], [0.5, C.indigo], [1, mezcla(C.indigo, "#000", 0.25)]]); ro(ctx, -60, -11, 120, 20, 6); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1; for (let x = -54; x <= 54; x += 6) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 6); ctx.stroke(); }
        ctx.fillStyle = mezcla(C.indigo, "#fff", 0.35); ro(ctx, -60, -11, 120, 5, 3); ctx.fill();
        ctx.fillStyle = "#0B1020"; ro(ctx, -15, -5, 30, 6, 3); ctx.fill();
        ctx.restore();
        // la etiqueta de papel kraft, con dos tiras de cinta y letra a mano
        ctx.save(); ctx.translate(130, 130); ctx.rotate(-0.035);
        ctx.fillStyle = C.kraft; ctx.beginPath(); ctx.moveTo(-48, -20); for (let x = -48; x <= 48; x += 6) ctx.lineTo(x, -20 + (x / 6 % 2 ? 1 : -1)); ctx.lineTo(48, 20); for (let x = 48; x >= -48; x -= 6) ctx.lineTo(x, 20 + (x / 6 % 2 ? 1 : -1)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-46, -16, 22, 8); ctx.restore(); ctx.save(); ctx.translate(40, -16); ctx.rotate(0.5); ctx.fillRect(-11, -4, 22, 8); ctx.restore();
        ctx.fillStyle = "#3E2A12"; ctx.textAlign = "center"; letraQueCabe(ctx, a.nombre, 700, 16, 88, "Caveat, Figtree, system-ui, sans-serif"); ctx.fillText(cortar(ctx, a.nombre, 90), 0, -1);
        ctx.font = "600 13px Caveat, Figtree, system-ui, sans-serif"; ctx.fillText(a.guardado >= a.meta ? "¡meta cumplida!" : d.oculto ? `${Math.round(a.guardado / a.meta * 100)}% lleno` : `faltan ${fmt(a.meta - a.guardado)}`, 0, 14); ctx.restore();
      },
    });
    a.nombre = d.nombre; a.inicial(d.guardado); return a;
  }


  /* 5 · La caja fuerte: acero, remaches y una perilla con números; en la meta, la puerta se abre */
  function caja(d) {
    const lleno0 = d.guardado >= d.meta ? 1 : 0, a = { meta: d.meta, guardado: d.guardado, part: new Particulas(), giro: 0, giroMeta: 0, puerta: lleno0, nombre: d.nombre, ver: Math.min(1, d.guardado / d.meta) };
    const DX = 130, DY = 112, DR = 62;
    const adentro = (() => { const p = new Pila(74, 186, 160, 6.5), out = [], rnd = semilla(3); for (let i = 0; i < 64; i++) out.push(p.asentar(74 + rnd() * 112)); return out; })();
    a.sumar = m => { a.guardado += m; a.giroMeta += 2.2 + Math.random(); a.part.monedas(DX + 50, 22, 3, 0.4, 208); };
    a.quitar = m => { a.guardado = Math.max(0, a.guardado - m); a.giroMeta -= 2.5; };
    a.paso = k => {
      a.giro += (a.giroMeta - a.giro) * 0.08 * k; a.ver += (Math.min(1, a.guardado / a.meta) - a.ver) * 0.08 * k;
      const meta = a.guardado >= a.meta ? 1 : 0, antes = a.puerta; a.puerta += (meta - a.puerta) * 0.05 * k;
      if (antes < 0.5 && a.puerta >= 0.5) { a.part.confeti(DX, DY, 40, 1.1); a.part.brillo(DX, DY + 20, 18, 50, 30); vib([20, 40, 20]); }
      a.part.paso(k);
    };
    a.mueve = () => Math.abs(a.giroMeta - a.giro) > 0.01 || Math.abs((a.guardado >= a.meta ? 1 : 0) - a.puerta) > 0.005 || Math.abs(Math.min(1, a.guardado / a.meta) - a.ver) > 0.002 || a.part.vivas;
    a.pintar = (ctx, t) => {
      const A = C.acero, AO = C["acero-osc"], AC = C["acero-claro"];
      sombra(ctx, 130, 208, 104, 0.26);
      // el cuerpo con bisel: luz arriba a la izquierda, sombra abajo a la derecha
      ctx.fillStyle = lg(ctx, 34, 24, 226, 206, [[0, AC], [0.5, A], [1, AO]]); ro(ctx, 32, 24, 196, 182, 20); ctx.fill();
      ctx.fillStyle = lg(ctx, 40, 32, 220, 198, [[0, A], [1, mezcla(A, AO, 0.6)]]); ro(ctx, 42, 34, 176, 162, 14); ctx.fill();
      ctx.strokeStyle = rgba("#fff", 0.35); ctx.lineWidth = 1.2; ro(ctx, 42, 34, 176, 162, 14); ctx.stroke();
      [[40, 32], [220, 32], [40, 198], [220, 198]].forEach(([x, y]) => { ctx.fillStyle = rg(ctx, x - 1, y - 1, 0, 4, [[0, AC], [1, AO]]); ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = AO; [[28, 62], [28, 150]].forEach(([x, y]) => { ro(ctx, x, y, 8, 22, 3); ctx.fill(); });
      ctx.fillStyle = mezcla(AO, "#000", 0.3); [[52, 204], [194, 204]].forEach(([x, y]) => { ro(ctx, x, y, 18, 8, 3); ctx.fill(); });
      // adentro: estantes con lo que guardaste (se ve al abrir)
      ctx.save(); ctx.beginPath(); ctx.arc(DX, DY, DR - 3, 0, 6.3); ctx.clip();
      ctx.fillStyle = rg(ctx, DX, DY, 10, DR, [[0, mezcla(AO, "#000", 0.2)], [1, mezcla(AO, "#000", 0.5)]]); ctx.fillRect(DX - DR, DY - DR, DR * 2, DR * 2);
      if (a.puerta > 0.02) {
        ctx.fillStyle = rgba("#FFD98A", 0.25 * Math.min(1, a.puerta)); ctx.beginPath(); ctx.arc(DX, DY + 10, DR, 0, 6.3); ctx.fill();
        ctx.fillStyle = AC; ctx.fillRect(DX - DR, DY - 8, DR * 2, 3);
        const lingote = (x, y) => { ctx.fillStyle = lg(ctx, x, y, x, y + 10, [[0, C["oro-claro"]], [1, C["oro-osc"]]]); ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 24, y); ctx.lineTo(x + 28, y + 10); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fill(); };
        lingote(84, DY - 19); lingote(112, DY - 19); lingote(140, DY - 19); lingote(98, DY - 29); lingote(126, DY - 29);
        for (const q of adentro) moneda(ctx, q.x, q.y + 12, 6.5);
      }
      ctx.restore();
      // el anillo del avance, con brillo en la punta
      ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.strokeStyle = mezcla(AO, "#000", 0.2); ctx.beginPath(); ctx.arc(DX, DY, DR + 7, 0, 6.3); ctx.stroke();
      const fin = -Math.PI / 2 + Math.PI * 2 * a.ver;
      ctx.strokeStyle = lg(ctx, DX - DR, DY - DR, DX + DR, DY + DR, [[0, C["oro-claro"]], [1, C.oro]]); ctx.beginPath(); ctx.arc(DX, DY, DR + 7, -Math.PI / 2, fin + 0.0001); ctx.stroke();
      if (a.ver > 0.02) { ctx.fillStyle = rgba("#FFF6D8", 0.9); ctx.beginPath(); ctx.arc(DX + Math.cos(fin) * (DR + 7), DY + Math.sin(fin) * (DR + 7), 3, 0, 6.3); ctx.fill(); }
      // la puerta (se abre hacia la izquierda)
      const ab = Math.min(1, a.puerta), sx = 1 - 0.86 * ab;
      ctx.save(); ctx.translate(DX - DR, DY); ctx.scale(sx, 1); ctx.translate(-(DX - DR), -DY);
      ctx.fillStyle = rg(ctx, DX - 20, DY - 24, 6, DR, [[0, mezcla(AC, "#fff", 0.2)], [0.7, AC], [1, A]]); ctx.beginPath(); ctx.arc(DX, DY, DR - 2, 0, 6.3); ctx.fill();
      ctx.strokeStyle = AO; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(DX, DY, DR - 13, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = rgba("#fff", 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(DX, DY, DR - 11, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
      for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; ctx.fillStyle = rg(ctx, DX + Math.cos(an) * (DR - 6) - 0.6, DY + Math.sin(an) * (DR - 6) - 0.6, 0, 3, [[0, AC], [1, AO]]); ctx.beginPath(); ctx.arc(DX + Math.cos(an) * (DR - 6), DY + Math.sin(an) * (DR - 6), 2.6, 0, 6.3); ctx.fill(); }
      ctx.save(); ctx.translate(DX, DY); ctx.rotate(a.giro);
      ctx.fillStyle = AO; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.3); ctx.fill();
      ctx.fillStyle = rg(ctx, -6, -6, 2, 20, [[0, mezcla(AC, "#fff", 0.3)], [1, A]]); ctx.beginPath(); ctx.arc(0, 0, 19, 0, 6.3); ctx.fill();
      ctx.strokeStyle = C.text; ctx.lineWidth = 1; for (let i = 0; i < 40; i++) { const an = i / 40 * 6.283, r0 = i % 10 === 0 ? 12 : i % 5 === 0 ? 14 : 15.5; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); ctx.lineTo(Math.cos(an) * 18, Math.sin(an) * 18); ctx.stroke(); }
      ctx.fillStyle = C.text; ctx.font = "800 5.5px Figtree, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ["0", "25", "50", "75"].forEach((n, i) => { const an = -Math.PI / 2 + i * Math.PI / 2; ctx.fillText(n, Math.cos(an) * 8.5, Math.sin(an) * 8.5); });
      ctx.strokeStyle = AO; ctx.lineWidth = 6; ctx.lineCap = "round"; for (let i = 0; i < 3; i++) { const an = i / 3 * 6.283 + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 26, Math.sin(an) * 26); ctx.lineTo(Math.cos(an) * 42, Math.sin(an) * 42); ctx.stroke(); ctx.fillStyle = rg(ctx, Math.cos(an) * 44 - 1, Math.sin(an) * 44 - 1, 0, 5, [[0, AC], [1, AO]]); ctx.beginPath(); ctx.arc(Math.cos(an) * 44, Math.sin(an) * 44, 5, 0, 6.3); ctx.fill(); }
      ctx.restore();
      ctx.restore();
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = C.oro; ctx.beginPath(); ctx.moveTo(DX, DY - DR - 12); ctx.lineTo(DX - 5, DY - DR - 20); ctx.lineTo(DX + 5, DY - DR - 20); ctx.closePath(); ctx.fill();
      a.part.pintar(ctx);
    };
    return a;
  }


  /* 6 · El viaje: el lago Llanquihue y el volcán Osorno; el bus avanza por la carretera hasta Puerto Varas */
  function viaje(d) {
    const f0 = Math.min(1, d.guardado / d.meta), a = { meta: d.meta, guardado: d.guardado, part: new Particulas(), pos: f0, nombre: d.nombre, paradas: new Set([0.25, 0.5, 0.75].filter(p => f0 >= p)), polvo: [] };
    const destino = String(d.destino || d.nombre || "Tu destino");
    const RUTA = [[34, 186], [66, 176], [96, 182], [128, 168], [156, 170], [184, 154], [204, 150], [226, 142]];
    const largo = (() => { let s = 0; for (let i = 1; i < RUTA.length; i++) s += Math.hypot(RUTA[i][0] - RUTA[i - 1][0], RUTA[i][1] - RUTA[i - 1][1]); return s; })();
    const punto = f => { let d = limitar(f, 0, 1) * largo; for (let i = 1; i < RUTA.length; i++) { const s = Math.hypot(RUTA[i][0] - RUTA[i - 1][0], RUTA[i][1] - RUTA[i - 1][1]); if (d <= s) { const k = d / s; return [RUTA[i - 1][0] + (RUTA[i][0] - RUTA[i - 1][0]) * k, RUTA[i - 1][1] + (RUTA[i][1] - RUTA[i - 1][1]) * k, Math.atan2(RUTA[i][1] - RUTA[i - 1][1], RUTA[i][0] - RUTA[i - 1][0])]; } d -= s; } const u = RUTA[RUTA.length - 1]; return [u[0], u[1], 0]; };
    const trazo = ctx => { ctx.beginPath(); RUTA.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
    const arboles = [[20, 150, 1], [52, 160, 0.8], [110, 150, 0.9], [150, 146, 0.7], [204, 128, 0.8], [250, 160, 1.1], [78, 204, 1.2], [176, 196, 1]];
    a.sumar = m => { a.guardado += m; const [x, y] = punto(a.pos); a.part.monedas(x, y - 30, 3, 0.5, y - 6); };
    a.quitar = m => { a.guardado = Math.max(0, a.guardado - m); const f = Math.min(1, a.guardado / a.meta); [0.25, 0.5, 0.75].forEach(p => { if (f < p) a.paradas.delete(p); }); };
    a.paso = k => {
      const meta = Math.min(1, a.guardado / a.meta), antes = a.pos; a.pos += limitar(meta - a.pos, -0.006 * k, 0.006 * k); if (QUIETO) a.pos = meta;
      [0.25, 0.5, 0.75].forEach(p => { if (antes < p && a.pos >= p && !a.paradas.has(p)) { a.paradas.add(p); const [x, y] = punto(p); a.part.confeti(x, y - 16, 14, 0.6); a.aviso = { txt: "+10 ⭐", x, y: y - 26, vida: 1 }; } });
      if (antes < 1 && a.pos >= 0.999) { const [x, y] = punto(1); a.part.confeti(x, y - 30, 50, 1.2); vib([20, 40, 20]); }
      if (Math.abs(meta - a.pos) > 0.001 && !QUIETO && Math.random() < 0.5) { const [x, y] = punto(a.pos); a.polvo.push({ x: x - 12, y: y - 2, r: 2, v: 1 }); }
      a.polvo = a.polvo.filter(p => { p.r += 0.15 * k; p.v -= 0.03 * k; p.x -= 0.2 * k; return p.v > 0; });
      if (a.aviso) { a.aviso.y -= 0.3 * k; a.aviso.vida -= 0.012 * k; if (a.aviso.vida <= 0) a.aviso = null; }
      a.part.paso(k);
    };
    a.mueve = () => Math.abs(Math.min(1, a.guardado / a.meta) - a.pos) > 0.001 || a.part.vivas || a.polvo.length > 0 || !!a.aviso;
    a.pintar = (ctx, t) => {
      ctx.save(); ro(ctx, 2, 2, 256, 216, 16); ctx.clip();
      // el cielo, el sol y las nubes
      ctx.fillStyle = lg(ctx, 0, 0, 0, 120, [[0, C.cielo], [1, C["cielo-2"]]]); ctx.fillRect(0, 0, 260, 220);
      ctx.fillStyle = C.oscuro ? "#F3E6C4" : "#FFD27A"; ctx.beginPath(); ctx.arc(46, 34, 12, 0, 6.3); ctx.fill(); ctx.fillStyle = rgba(C.oscuro ? "#F3E6C4" : "#FFD27A", 0.25); ctx.beginPath(); ctx.arc(46, 34, 20, 0, 6.3); ctx.fill();
      const nube = (x, y, s) => { ctx.fillStyle = rgba("#fff", C.oscuro ? 0.15 : 0.9); [[0, 0, 10], [10, -4, 12], [22, 0, 9], [11, 4, 10]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.3); ctx.fill(); }); };
      if (C.oscuro) { ctx.fillStyle = "rgba(255,255,255,.75)"; [[20, 60, 1], [96, 18, 0.8], [130, 44, 1.1], [150, 14, 0.7], [232, 30, 1], [248, 64, 0.8], [70, 70, 0.7], [210, 10, 0.9]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); }); }
      else { nube(84 + (QUIETO ? 0 : (t * 3) % 40), 30, 0.8); nube(170, 22, 0.65); }
      // el volcán Osorno: un cono perfecto con nieve
      ctx.fillStyle = lg(ctx, 150, 30, 230, 110, [[0, C.oscuro ? "#4A5878" : "#8C9AB8"], [1, C.oscuro ? "#2A3350" : "#6E7C9A"]]); ctx.beginPath(); ctx.moveTo(140, 112); ctx.lineTo(190, 34); ctx.lineTo(242, 112); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.moveTo(176, 56); ctx.lineTo(190, 34); ctx.lineTo(205, 57); ctx.lineTo(198, 54); ctx.lineTo(193, 60); ctx.lineTo(187, 54); ctx.lineTo(182, 59); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.moveTo(190, 34); ctx.lineTo(242, 112); ctx.lineTo(214, 112); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.oscuro ? "#2B3A5A" : "#9FB3CF"; ctx.beginPath(); ctx.moveTo(0, 116); ctx.lineTo(40, 86); ctx.lineTo(74, 108); ctx.lineTo(108, 92); ctx.lineTo(150, 116); ctx.fill();
      // el lago con reflejos
      ctx.fillStyle = lg(ctx, 0, 110, 0, 136, [[0, C.lago], [1, mezcla(C.lago, "#000", 0.15)]]); ctx.fillRect(0, 110, 260, 30);
      ctx.strokeStyle = rgba("#fff", 0.5); ctx.lineWidth = 1.2; [[30, 118, 22], [120, 124, 30], [200, 120, 18], [80, 130, 16]].forEach(([x, y, w]) => { ctx.beginPath(); ctx.moveTo(x + (QUIETO ? 0 : Math.sin(t + x) * 3), y); ctx.lineTo(x + w + (QUIETO ? 0 : Math.sin(t + x) * 3), y); ctx.stroke(); });
      // los campos
      ctx.fillStyle = C.cerro; ctx.beginPath(); ctx.moveTo(0, 140); ctx.bezierCurveTo(70, 128, 150, 146, 260, 132); ctx.lineTo(260, 220); ctx.lineTo(0, 220); ctx.fill();
      ctx.fillStyle = C["cerro-2"]; ctx.beginPath(); ctx.moveTo(0, 176); ctx.bezierCurveTo(80, 160, 160, 190, 260, 166); ctx.lineTo(260, 220); ctx.lineTo(0, 220); ctx.fill();
      // la carretera: asfalto, borde y línea al centro
      ctx.lineCap = "round"; ctx.lineJoin = "round"; trazo(ctx); ctx.strokeStyle = C.oscuro ? "#3B4560" : "#6B7385"; ctx.lineWidth = 12; ctx.stroke();
      trazo(ctx); ctx.strokeStyle = C.oscuro ? "#4A5574" : "#868EA0"; ctx.lineWidth = 9; ctx.stroke();
      ctx.setLineDash([5, 6]); trazo(ctx); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.oro; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; ctx.beginPath(); let d = 0; const hasta = a.pos * largo; ctx.moveTo(RUTA[0][0], RUTA[0][1] + 6);
      for (let i = 1; i < RUTA.length; i++) { const s = Math.hypot(RUTA[i][0] - RUTA[i - 1][0], RUTA[i][1] - RUTA[i - 1][1]); if (d + s <= hasta) ctx.lineTo(RUTA[i][0], RUTA[i][1] + 6); else { const k = (hasta - d) / s; ctx.lineTo(RUTA[i - 1][0] + (RUTA[i][0] - RUTA[i - 1][0]) * k, RUTA[i - 1][1] + (RUTA[i][1] - RUTA[i - 1][1]) * k + 6); break; } d += s; }
      ctx.stroke(); ctx.globalAlpha = 1;
      // árboles
      arboles.forEach(([x, y, s]) => { ctx.fillStyle = C.madera; ctx.fillRect(x - 1.2 * s, y - 2, 2.4 * s, 6 * s); ctx.fillStyle = C.oscuro ? "#1F4A35" : "#2F7A4E"; ctx.beginPath(); ctx.moveTo(x, y - 18 * s); ctx.lineTo(x + 7 * s, y); ctx.lineTo(x - 7 * s, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.moveTo(x, y - 18 * s); ctx.lineTo(x - 7 * s, y); ctx.lineTo(x - 2 * s, y); ctx.closePath(); ctx.fill(); });
      // tu casa, con chimenea y humo
      ctx.fillStyle = C.surface; ctx.strokeStyle = C.text; ctx.lineWidth = 1.4; ro(ctx, 10, 172, 28, 22, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.coral; ctx.beginPath(); ctx.moveTo(6, 174); ctx.lineTo(24, 156); ctx.lineTo(42, 174); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.madera; ctx.fillRect(21, 182, 7, 12); ctx.fillStyle = "#9FD3F0"; ctx.fillRect(13, 178, 6, 6);
      ctx.fillStyle = C.text; ctx.fillRect(32, 158, 4, 9);
      for (let i = 0; i < 3; i++) { const f = ((t * 0.4 + i / 3) % 1); ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - f)})`; ctx.beginPath(); ctx.arc(34 + f * 8, 154 - f * 20, 2 + f * 3, 0, 6.3); ctx.fill(); }
      // las paradas: un letrero con estrella cuando llegas
      [0.25, 0.5, 0.75].forEach(p => { const [x, y] = punto(p), ok = a.pos >= p; ctx.strokeStyle = C.text; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + 9, y - 2); ctx.lineTo(x + 9, y - 20); ctx.stroke(); ctx.fillStyle = ok ? C.oro : C.surface; ctx.beginPath(); ctx.arc(x + 9, y - 24, 6, 0, 6.3); ctx.fill(); ctx.stroke(); if (ok) { ctx.fillStyle = "#fff"; estrella(ctx, x + 9, y - 24, 3.4, 1.4); ctx.fill(); } });
      // el destino: letrero de madera y bandera
      const [fx, fy] = punto(1), ondea = QUIETO ? 0 : Math.sin(t * 6) * 2;
      ctx.strokeStyle = C["madera-osc"]; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(fx + 4, fy); ctx.lineTo(fx + 4, fy - 44); ctx.stroke();
      ctx.fillStyle = a.pos >= 0.999 ? C.oro : C.coral; ctx.beginPath(); ctx.moveTo(fx + 4, fy - 44); ctx.quadraticCurveTo(fx + 14, fy - 42 + ondea, fx + 22, fy - 40); ctx.lineTo(fx + 4, fy - 33); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C["madera-osc"]; ctx.fillRect(fx - 32, fy - 38, 3, 34);
      ctx.save(); ctx.translate(fx - 31, fy - 44); ctx.rotate(-0.04); ctx.fillStyle = C["madera-osc"]; ro(ctx, -33, -8, 66, 17, 3); ctx.fill(); ctx.fillStyle = C.madera; ro(ctx, -32, -9, 64, 15, 3); ctx.fill(); ctx.fillStyle = "#FFF6E6"; ctx.textAlign = "center"; letraQueCabe(ctx, destino, 800, 9.5, 58, "Figtree, system-ui, sans-serif"); ctx.fillText(cortar(ctx, destino, 60), 0, 2); ctx.restore();
      for (const p of a.polvo) { ctx.fillStyle = `rgba(255,255,255,${p.v * 0.6})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill(); }
      // el bus: carrocería, ventanas, ruedas con tapa y luz
      const [bx, by, ang] = punto(a.pos), mov = Math.abs(Math.min(1, a.guardado / a.meta) - a.pos) > 0.001, bote = QUIETO || !mov ? 0 : Math.abs(Math.sin(t * 14)) * 1.4;
      ctx.save(); ctx.translate(bx, by - 11 - bote); ctx.rotate(ang * 0.7);
      ctx.fillStyle = "rgba(8,14,36,.22)"; ctx.beginPath(); ctx.ellipse(0, 13 + bote, 20, 3, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = lg(ctx, 0, -11, 0, 9, [[0, mezcla(C.indigo, "#fff", 0.2)], [1, mezcla(C.indigo, "#000", 0.15)]]); ro(ctx, -19, -11, 38, 20, 5); ctx.fill();
      ctx.fillStyle = C.oro; ctx.fillRect(-19, 2, 38, 2.5);
      ctx.fillStyle = rgba("#DFF2FF", 0.92); for (let i = 0; i < 4; i++) { ro(ctx, -16 + i * 8, -8, 6, 7, 1.5); ctx.fill(); }
      ctx.fillStyle = rgba("#DFF2FF", 0.92); ro(ctx, 13, -8, 5, 9, 1.5); ctx.fill();
      ctx.fillStyle = "#FFF3B0"; ctx.beginPath(); ctx.arc(18, 5, 1.6, 0, 6.3); ctx.fill();
      [-10, 10].forEach(x => { ctx.fillStyle = "#1B2436"; ctx.beginPath(); ctx.arc(x, 9, 4.4, 0, 6.3); ctx.fill(); ctx.fillStyle = "#C9D1E0"; ctx.beginPath(); ctx.arc(x, 9, 1.8, 0, 6.3); ctx.fill(); });
      ctx.restore();
      ctx.restore();
      if (a.aviso) { ctx.globalAlpha = Math.max(0, a.aviso.vida); ctx.fillStyle = C.text; ctx.font = "800 12px Figtree, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText(a.aviso.txt, a.aviso.x + 9, a.aviso.y - 10); ctx.globalAlpha = 1; }
      a.part.pintar(ctx);
    };
    return a;
  }


  /* ============ El elefante, cinco caminos ============ */
  // Un tubo que se adelgaza a lo largo de una curva (trompas y colmillos). Siempre con el mismo sentido de giro, para unirlo a la silueta
  function tuboQ(P0, P1, P2, w0, w1, n = 18) {
    const L = [], R = [], M = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, u = 1 - f;
      const x = u * u * P0[0] + 2 * u * f * P1[0] + f * f * P2[0], y = u * u * P0[1] + 2 * u * f * P1[1] + f * f * P2[1];
      const dx = 2 * u * (P1[0] - P0[0]) + 2 * f * (P2[0] - P1[0]), dy = 2 * u * (P1[1] - P0[1]) + 2 * f * (P2[1] - P1[1]), d = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * f) / 2, nx = -dy / d, ny = dx / d;
      L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]); M.push({ x, y, nx, ny, w, an: Math.atan2(dy, dx) });
    }
    const pts = L.concat(R.slice().reverse());
    let area = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
    if (area < 0) pts.reverse();
    const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath();
    return { p, L, R, M };
  }
  const elip = (p, x, y, rx, ry, rot = 0) => { p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const caja2 = (p, x, y, w, h, r) => { if (p.roundRect) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h); };
  const entre = (A, B, f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
  // El borde de afuera de una silueta, sin las rayas de adentro (para el vidrio y la porcelana)
  const OFF = document.createElement("canvas"), OCTX = OFF.getContext("2d");
  function contorno(ctx, path, color, w) {
    const cv = ctx.canvas; if (OFF.width !== cv.width || OFF.height !== cv.height) { OFF.width = cv.width; OFF.height = cv.height; }
    OCTX.setTransform(1, 0, 0, 1, 0, 0); OCTX.clearRect(0, 0, OFF.width, OFF.height); OCTX.setTransform(ctx.getTransform());
    OCTX.strokeStyle = color; OCTX.lineWidth = w; OCTX.lineJoin = "round"; OCTX.stroke(path);
    OCTX.globalCompositeOperation = "destination-out"; OCTX.fill(path); OCTX.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(OFF, 0, 0); ctx.restore();
  }
  // La tarjeta de papel con el avance, amarrada de un cordel
  function tarjeta(ctx, x0, y0, tx, ty, pct, t, giro) {
    const pend = Math.sin(t * 2) * (QUIETO ? 0 : 0.04) + giro * 2;
    ctx.strokeStyle = C.madera; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 - 4, (y0 + ty) / 2, tx - 12, ty - 1); ctx.stroke();
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(pend + 0.06);
    ctx.fillStyle = C.kraft; ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(-12, -12); ctx.lineTo(17, -12); ctx.lineTo(17, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba("#5A3A12", 0.4); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(-12, 0, 2, 0, 6.3); ctx.fill();
    ctx.fillStyle = "#3E2A12"; ctx.textAlign = "center"; ctx.font = "700 13px Caveat, Figtree, system-ui, sans-serif"; ctx.fillText(Math.round(pct * 100) + "%", 3, 4.5);
    ctx.restore();
  }
  // Luces de la trompa: una franja clara del lado de la luz y una sombra del otro
  function luzTubo(ctx, tr, claro, oscuro, desde = 1, hasta) {
    const M = tr.M, n = hasta == null ? M.length - 2 : hasta, s = (M[(M.length / 2) | 0].nx + M[(M.length / 2) | 0].ny) < 0 ? 1 : -1;
    ctx.save(); ctx.clip(tr.p); ctx.lineCap = "round";
    ctx.strokeStyle = oscuro; ctx.lineWidth = 5; ctx.beginPath(); for (let i = desde; i <= n; i++) { const m = M[i]; const x = m.x - s * m.nx * m.w * 0.8, y = m.y - s * m.ny * m.w * 0.8; i > desde ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.strokeStyle = claro; ctx.lineWidth = 2.4; ctx.beginPath(); for (let i = desde; i <= n; i++) { const m = M[i]; const x = m.x + s * m.nx * m.w * 0.45, y = m.y + s * m.ny * m.w * 0.45; i > desde ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.restore();
  }
  // La punta de la trompa: un disco con dos hoyitos
  function puntaTrompa(ctx, tr, fondo, borde, hoyo) {
    const m = tr.M[tr.M.length - 1];
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.an);
    ctx.fillStyle = fondo; ctx.beginPath(); ctx.ellipse(0, 0, 3.4, m.w, 0, 0, 6.3); ctx.fill(); ctx.strokeStyle = borde; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = hoyo; [-0.42, 0.42].forEach(f => { ctx.beginPath(); ctx.ellipse(0.4, m.w * f, 1.3, 2, 0, 0, 6.3); ctx.fill(); });
    ctx.restore();
    return [m.x, m.y];
  }


  /* A · El elefante de greda: hermano del chanchito de Pomaire */
  function eleGreda(d) {
    const CX = 150, CY = 124, RX = 70, RY = 52, HX = 86, HY = 102, HR = 36, PIE = 206, rnd = semilla(43);
    const humo = Array.from({ length: 8 }, () => ({ x: 60 + rnd() * 160, y: 80 + rnd() * 90, r: 10 + rnd() * 18, a: 0.05 + rnd() * 0.07 }));
    const puntos = Array.from({ length: 44 }, () => ({ x: 50 + rnd() * 175, y: 66 + rnd() * 112, r: 0.4 + rnd() * 0.7 }));
    const RANURA = [166, 74], R0 = [[64, 116], [30, 140], [42, 186]], U0 = [[62, 110], [18, 100], [30, 50]];
    const lleno0 = d.guardado >= d.meta ? 1 : 0, valor = Math.max(1, d.meta / 30);
    const a = { meta: d.meta, guardado: d.guardado, cayendo: [], part: new Particulas(), giro: 0, vgiro: 0, tag: Math.min(1, d.guardado / d.meta), trompa: lleno0, fiesta: lleno0, t0: -99, chorro: false, nombre: d.nombre, punta: [42, 186] };
    a.sumar = m => { a.guardado += m; const n = Math.min(8, Math.max(1, Math.round(m / valor))); for (let i = 0; i < n; i++) a.cayendo.push({ x: RANURA[0] + azar(-2, 2), y: 4 - i * 16, vy: 0, giro: azar(0, 6) }); };
    a.quitar = m => { a.guardado = Math.max(0, a.guardado - m); a.cayendo = []; if (a.guardado < a.meta) a.fiesta = 0; };
    a.paso = (k, t) => {
      a.vgiro += -a.giro * 0.18 * k; a.vgiro *= Math.pow(0.86, k); a.giro += a.vgiro * k;
      a.tag += (Math.min(1, a.guardado / a.meta) - a.tag) * 0.1 * k;
      for (let i = a.cayendo.length - 1; i >= 0; i--) { const c = a.cayendo[i]; c.vy += 0.32 * k; c.y += c.vy * k; c.giro += 0.25 * k; if (c.y >= RANURA[1]) { a.cayendo.splice(i, 1); a.vgiro += azar(0.008, 0.016) * (Math.random() < 0.5 ? -1 : 1); a.part.brillo(RANURA[0], RANURA[1] - 4, 2, 8, 4); } }
      if (a.guardado >= a.meta && !a.cayendo.length && !a.fiesta) { a.fiesta = 1; a.t0 = t; vib([20, 40, 20]); }
      a.trompa += ((a.fiesta ? 1 : 0) - a.trompa) * (QUIETO ? 1 : 0.06) * k;
      a.chorro = !!a.fiesta && t - a.t0 < 3.2 && a.trompa > 0.6;
      if (a.chorro && Math.random() < 0.35) { a.part.monedas(a.punta[0], a.punta[1] - 4, 1, 0.8, 200); if (Math.random() < 0.7) a.part.confeti(a.punta[0], a.punta[1] - 6, 2, 0.8); }
      a.part.paso(k);
    };
    a.mueve = () => a.cayendo.length > 0 || a.part.vivas || Math.abs(a.vgiro) > 0.0005 || Math.abs(a.giro) > 0.0005 || Math.abs((a.fiesta ? 1 : 0) - a.trompa) > 0.004 || a.chorro || Math.abs(Math.min(1, a.guardado / a.meta) - a.tag) > 0.002;
    // patas como columnas de barro, con las uñas sin bruñir
    const columna = (ctx, x, y0, y1, w, osc) => {
      const G = C.greda, GO = C["greda-osc"], GC = C["greda-claro"];
      ctx.fillStyle = lg(ctx, x - w / 2, 0, x + w / 2, 0, osc ? [[0, GO], [1, mezcla(GO, "#000", 0.25)]] : [[0, GC], [0.45, G], [1, GO]]);
      ctx.beginPath(); ctx.moveTo(x - w / 2 + 1, y0); ctx.lineTo(x - w / 2 - 1, y1 - 5); ctx.quadraticCurveTo(x - w / 2 - 1, y1, x - w / 2 + 4, y1); ctx.lineTo(x + w / 2 - 4, y1); ctx.quadraticCurveTo(x + w / 2 + 1, y1, x + w / 2 + 1, y1 - 5); ctx.lineTo(x + w / 2 - 1, y0); ctx.closePath(); ctx.fill();
      if (!osc) { ctx.fillStyle = "#EAD6B8"; [-7, -1, 5].forEach(dx => { ctx.beginPath(); ctx.ellipse(x + dx, y1 - 1.5, 2.8, 2.4, 0, Math.PI, 0); ctx.fill(); }); }
    };
    a.pintar = (ctx, t) => {
      const G = C.greda, GO = C["greda-osc"], GC = C["greda-claro"];
      sombra(ctx, CX - 14, PIE + 2, 108, 0.24);
      ctx.save(); ctx.translate(CX, PIE); ctx.rotate(a.giro); ctx.translate(-CX, -PIE);
      columna(ctx, 122, 150, PIE - 4, 22, true); columna(ctx, 204, 148, PIE - 4, 22, true);
      // la cola con su mechón
      ctx.strokeStyle = GO; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(218, 118); ctx.quadraticCurveTo(234, 128, 231, 150); ctx.stroke();
      ctx.fillStyle = mezcla(GO, "#000", 0.2); ctx.beginPath(); ctx.ellipse(231, 154, 3.6, 6, 0.1, 0, 6.3); ctx.fill();
      // cuerpo y cabeza: una sola pieza de greda bruñida
      const p = new Path2D(); elip(p, CX, CY, RX, RY); elip(p, HX, HY, HR, HR);
      ctx.strokeStyle = GO; ctx.lineWidth = 2.5; ctx.stroke(p);
      ctx.fillStyle = rg(ctx, 96, 80, 6, 150, [[0, GC], [0.4, G], [0.85, mezcla(G, GO, 0.7)], [1, GO]], CX - 10, CY); ctx.fill(p);
      ctx.save(); ctx.clip(p);
      humo.forEach(m => { ctx.fillStyle = rg(ctx, m.x, m.y, 0, m.r, [[0, `rgba(50,18,6,${m.a})`], [1, "rgba(50,18,6,0)"]]); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = "rgba(60,20,8,.18)"; puntos.forEach(q => { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.3); ctx.fill(); });
      ctx.lineCap = "round";
      [[0.9, 1.12, 1.42, 0.16], [0.78, 1.06, 1.5, 0.12], [0.64, 1.2, 1.55, 0.1], [0.86, 1.6, 1.8, 0.09]].forEach(([k2, a0, a1, al]) => { ctx.strokeStyle = `rgba(255,236,214,${al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(CX, CY, RX * k2, RY * k2, 0, Math.PI * a0, Math.PI * a1); ctx.stroke(); });
      ctx.strokeStyle = "rgba(255,236,214,.13)"; ctx.beginPath(); ctx.arc(HX, HY, HR * 0.8, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      ctx.strokeStyle = rgba(GC, 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(CX, CY, RX - 3, RY - 3, 0, Math.PI * 0.18, Math.PI * 0.62); ctx.stroke();
      ctx.restore();
      // el brillo del bruñido
      [[124, 90, 30, 13, -0.3], [74, 84, 14, 8, -0.6]].forEach(([x, y, rx, ry, r]) => { ctx.fillStyle = rg(ctx, x, y, 0, rx, [[0, "rgba(255,244,228,.5)"], [1, "rgba(255,244,228,0)"]]); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = "rgba(255,250,240,.7)"; ctx.beginPath(); ctx.ellipse(116, 86, 6, 2.6, -0.4, 0, 6.3); ctx.fill();
      columna(ctx, 104, 154, PIE, 25, false); columna(ctx, 186, 154, PIE, 25, false);
      // la trompa: baja descansando y sube en la meta
      const e = a.trompa * a.trompa * (3 - 2 * a.trompa), tr = tuboQ(entre(R0[0], U0[0], e), entre(R0[1], U0[1], e), entre(R0[2], U0[2], e), 24, 13);
      ctx.fillStyle = G; ctx.fill(tr.p); luzTubo(ctx, tr, rgba(GC, 0.9), rgba(GO, 0.55));
      ctx.strokeStyle = rgba(GO, 0.5); ctx.lineWidth = 1.3; [6, 9, 12, 15].forEach(i => { ctx.beginPath(); ctx.moveTo(...tr.L[i]); ctx.lineTo(...tr.R[i]); ctx.stroke(); });
      a.punta = puntaTrompa(ctx, tr, GC, GO, "#2A0E04");
      // el colmillo, de greda sin pulir
      const co = tuboQ([70, 126], [60, 138], [48, 138], 7, 2.6, 8); ctx.fillStyle = "#EFE0C6"; ctx.fill(co.p); ctx.strokeStyle = "rgba(90,50,20,.3)"; ctx.lineWidth = 0.8; ctx.stroke(co.p);
      // la oreja: un plato de greda con su borde marcado
      ctx.fillStyle = "rgba(40,12,4,.18)"; ctx.beginPath(); ctx.ellipse(118, 108, 25, 31, -0.12, 0, 6.3); ctx.fill();
      ctx.fillStyle = lg(ctx, 96, 76, 136, 134, [[0, GC], [0.6, G], [1, mezcla(G, GO, 0.5)]]); ctx.beginPath(); ctx.ellipse(114, 104, 25, 31, -0.12, 0, 6.3); ctx.fill();
      ctx.strokeStyle = rgba(GO, 0.7); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = rgba(GO, 0.45); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(114, 104, 19, 25, -0.12, 0, 6.3); ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,220,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(114, 104, 21, 27, -0.12, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      // el ojo marcado con un punzón
      ctx.fillStyle = "#24100A"; ctx.beginPath(); ctx.ellipse(74, 97, 2.8, 3.2, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,250,240,.8)"; ctx.beginPath(); ctx.arc(75, 96, 0.9, 0, 6.3); ctx.fill();
      ctx.strokeStyle = rgba(GO, 0.9); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(74, 97, 5.6, Math.PI * 1.15, Math.PI * 1.8); ctx.stroke();
      // la ranura en el lomo
      ctx.fillStyle = mezcla(GC, "#fff", 0.1); ro(ctx, RANURA[0] - 16, RANURA[1] - 5, 32, 9, 4.5); ctx.fill();
      ctx.fillStyle = "#2A0E04"; ro(ctx, RANURA[0] - 12, RANURA[1] - 3, 24, 5, 2.5); ctx.fill();
      ctx.restore();
      // la tarjeta amarrada a la cola
      tarjeta(ctx, 231, 159, 238, 186, a.tag, t, a.giro);
      for (const c of a.cayendo) monedaCara(ctx, c.x, c.y, 6.5, 0.3 + 0.65 * Math.abs(Math.cos(c.giro)));
      a.part.pintar(ctx);
    };
    return a;
  }


  /* C · El elefante de la suerte: porcelana blanca que se va bañando en oro desde las patas */
  function eleSuerte(d) {
    const CX = 148, CY = 120, RX = 64, RY = 48, HX = 88, HY = 98, HR = 34, BASE = 184, ARRIBA = 42;
    const tr = tuboQ([62, 108], [20, 100], [34, 46], 22, 11);
    const co = tuboQ([72, 122], [62, 134], [50, 132], 6.5, 2.4, 8);
    const patas = [[122, 146, BASE - 4, 21, 1], [198, 144, BASE - 4, 21, 1], [106, 150, BASE + 3, 23, 0], [182, 150, BASE + 3, 23, 0]];
    const cuerpo = () => { const p = new Path2D(); elip(p, CX, CY, RX, RY); elip(p, HX, HY, HR, HR); return p; };
    const silueta = (() => { const p = cuerpo(); p.addPath(tr.p); patas.forEach(([x, y0, y1, w]) => caja2(p, x - w / 2, y0, w, y1 - y0, [3, 3, 6, 6])); elip(p, 110, 100, 23, 29, -0.1); return p; })();
    const manta = (() => { const p = new Path2D(); p.moveTo(114, 84); p.quadraticCurveTo(156, 62, 200, 86); p.lineTo(203, 110); for (let x = 203; x > 113; x -= 15) p.quadraticCurveTo(x - 7.5, 121, x - 15, 110); p.closePath(); return p; })();
    const RANURA = [158, 74];
    const lleno0 = d.guardado >= d.meta ? 1 : 0, valor = Math.max(1, d.meta / 30);
    const a = { meta: d.meta, guardado: d.guardado, cayendo: [], part: new Particulas(), nivel: Math.min(1, d.guardado / d.meta), fiesta: lleno0, t0: -99, brillo: false, nombre: d.nombre };
    a.sumar = m => { a.guardado += m; const n = Math.min(6, Math.max(1, Math.round(m / valor))); for (let i = 0; i < n; i++) a.cayendo.push({ x: RANURA[0] + azar(-2, 2), y: 4 - i * 16, vy: 0, giro: azar(0, 6) }); };
    a.quitar = m => { a.guardado = Math.max(0, a.guardado - m); a.cayendo = []; if (a.guardado < a.meta) a.fiesta = 0; };
    a.paso = (k, t) => {
      for (let i = a.cayendo.length - 1; i >= 0; i--) { const c = a.cayendo[i]; c.vy += 0.32 * k; c.y += c.vy * k; c.giro += 0.25 * k; if (c.y >= RANURA[1]) { a.cayendo.splice(i, 1); a.part.brillo(RANURA[0], RANURA[1] - 4, 2, 8, 4); } }
      const meta = Math.min(1, a.guardado / a.meta); a.nivel += (meta - a.nivel) * (QUIETO ? 1 : 0.045) * k;
      if (a.guardado >= a.meta && !a.cayendo.length && !a.fiesta && a.nivel > 0.985) { a.fiesta = 1; a.t0 = t; vib([20, 40, 20]); a.part.confeti(110, 70, 30, 0.9); }
      a.brillo = !!a.fiesta && t - a.t0 < 3.4;
      if (a.brillo && Math.random() < 0.25) a.part.brillo(130, 110, 1, 90, 70);
      a.part.paso(k);
    };
    a.mueve = () => a.cayendo.length > 0 || a.part.vivas || Math.abs(Math.min(1, a.guardado / a.meta) - a.nivel) > 0.001 || a.brillo;
    const pata = (ctx, [x, y0, y1, w], m) => {
      ctx.fillStyle = lg(ctx, x - w / 2, 0, x + w / 2, 0, [[0, m.claro], [0.5, m.base], [1, m.osc]]); ro(ctx, x - w / 2, y0, w, y1 - y0, [3, 3, 6, 6]); ctx.fill();
      ctx.strokeStyle = m.linea; ctx.lineWidth = 1.2; [y1 - 12, y1 - 8].forEach(y => { ctx.beginPath(); ctx.moveTo(x - w / 2 + 1, y); ctx.lineTo(x + w / 2 - 1, y); ctx.stroke(); });
    };
    // la figura completa en un material: primero porcelana, encima el oro hasta donde llega lo ahorrado
    const figura = (ctx, m) => {
      patas.filter(q => q[4]).forEach(q => pata(ctx, q, { ...m, claro: m.osc, base: m.osc }));
      ctx.strokeStyle = m.osc; ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(210, 112); ctx.quadraticCurveTo(225, 120, 222, 142); ctx.stroke();
      ctx.fillStyle = m.osc; ctx.beginPath(); ctx.ellipse(222, 146, 3.2, 5.5, 0.1, 0, 6.3); ctx.fill();
      ctx.fillStyle = rg(ctx, 100, 78, 6, 140, [[0, m.claro], [0.45, m.base], [1, m.osc]], CX - 10, CY); ctx.fill(cuerpo());
      ctx.fillStyle = lg(ctx, 16, 46, 64, 110, [[0, m.claro], [0.55, m.base], [1, m.osc]]); ctx.fill(tr.p);
      ctx.strokeStyle = m.linea; ctx.lineWidth = 1.2; [4, 7, 10, 13].forEach(i => { ctx.beginPath(); ctx.moveTo(...tr.L[i]); ctx.lineTo(...tr.R[i]); ctx.stroke(); });
      puntaTrompa(ctx, tr, m.claro, m.linea, m.linea);
      patas.filter(q => !q[4]).forEach(q => pata(ctx, q, m));
      // la manta del lomo, en relieve, con su fila de perlas
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fill(manta); ctx.strokeStyle = m.linea; ctx.lineWidth = 1.4; ctx.stroke(manta);
      ctx.save(); ctx.translate(0, -6); ctx.globalAlpha = 0.7; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 203; x > 113; x -= 15) { ctx.moveTo(x, 110); ctx.quadraticCurveTo(x - 7.5, 121, x - 15, 110); } ctx.stroke(); ctx.restore();
      ctx.fillStyle = m.osc; for (let x = 120; x < 200; x += 10) { ctx.beginPath(); ctx.arc(x, 88 + Math.pow((x - 157) / 44, 2) * 8 - 6, 1.4, 0, 6.3); ctx.fill(); }
      // la oreja y el tocado de la frente
      ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.beginPath(); ctx.ellipse(114, 104, 23, 29, -0.1, 0, 6.3); ctx.fill();
      ctx.fillStyle = lg(ctx, 94, 74, 128, 128, [[0, m.claro], [0.6, m.base], [1, m.osc]]); ctx.beginPath(); ctx.ellipse(110, 100, 23, 29, -0.1, 0, 6.3); ctx.fill();
      ctx.strokeStyle = m.linea; ctx.lineWidth = 1.2; ctx.stroke(); ctx.beginPath(); ctx.ellipse(110, 100, 17, 23, -0.1, 0, 6.3); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(64, 80); ctx.quadraticCurveTo(84, 66, 104, 76); ctx.stroke(); ctx.beginPath(); ctx.moveTo(66, 85); ctx.quadraticCurveTo(84, 72, 103, 81); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(84, 76); ctx.quadraticCurveTo(79, 86, 84, 92); ctx.quadraticCurveTo(89, 86, 84, 76); ctx.stroke();
      ctx.fillStyle = "#2B2620"; ctx.beginPath(); ctx.ellipse(76, 98, 2.6, 3, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = m.linea; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(76, 98, 5.4, Math.PI * 1.15, Math.PI * 1.8); ctx.stroke();
    };
    const gema = (ctx, x, y, r, c, gota) => {
      ctx.fillStyle = mezcla(c, "#000", 0.3); ctx.beginPath(); if (gota) { ctx.moveTo(x, y - r * 1.5); ctx.quadraticCurveTo(x + r * 1.1, y, x, y + r); ctx.quadraticCurveTo(x - r * 1.1, y, x, y - r * 1.5); } else ctx.arc(x, y, r + 0.8, 0, 6.3); ctx.fill();
      ctx.fillStyle = rg(ctx, x - r * 0.3, y - r * 0.3, 0, r, [[0, mezcla(c, "#fff", 0.45)], [1, c]]); ctx.beginPath(); if (gota) { ctx.moveTo(x, y - r * 1.2); ctx.quadraticCurveTo(x + r * 0.85, y, x, y + r * 0.75); ctx.quadraticCurveTo(x - r * 0.85, y, x, y - r * 1.2); } else ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, 6.3); ctx.fill();
    };
    a.pintar = (ctx, t) => {
      const PORC = { base: C.porcelana, claro: C["porcelana-claro"], osc: C["porcelana-osc"], linea: "rgba(70,60,45,.32)" };
      const ORO = { base: C.oro, claro: mezcla(C["oro-claro"], "#fff", 0.35), osc: C["oro-osc"], linea: rgba(mezcla(C["oro-osc"], "#000", 0.35), 0.75) };
      // la base: madera lacada con filetes de oro y el nombre de la meta grabado
      sombra(ctx, 136, 206, 112, 0.22);
      const B0 = 40, B1 = 232, BX = 136, BR = 96;
      ctx.fillStyle = lg(ctx, B0, 0, B1, 0, [[0, mezcla(C.indigo, "#000", 0.5)], [0.35, mezcla(C.indigo, "#000", 0.22)], [1, mezcla(C.indigo, "#000", 0.6)]]);
      ctx.beginPath(); ctx.moveTo(B0, BASE); ctx.lineTo(B0, BASE + 14); ctx.ellipse(BX, BASE + 14, BR, 12, 0, Math.PI, 0, true); ctx.lineTo(B1, BASE); ctx.ellipse(BX, BASE, BR, 12, 0, 0, Math.PI, false); ctx.fill();
      ctx.fillStyle = lg(ctx, 0, BASE - 12, 0, BASE + 12, [[0, mezcla(C.indigo, "#000", 0.15)], [1, mezcla(C.indigo, "#000", 0.35)]]); ctx.beginPath(); ctx.ellipse(BX, BASE, BR, 12, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = C.oro; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(BX, BASE, BR, 12, 0, 0, 6.3); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(BX, BASE + 14, BR, 12, 0, 0.15, Math.PI - 0.15); ctx.stroke();
      ctx.save(); ctx.fillStyle = C["oro-claro"]; ctx.font = "800 8px Figtree, system-ui, sans-serif"; ctx.textAlign = "center"; try { ctx.letterSpacing = "1.6px"; } catch (e) {}
      ctx.fillText(cortar(ctx, a.nombre.toUpperCase(), 160), BX, BASE + 20); ctx.restore();
      // la figura: porcelana, y el oro subiendo
      figura(ctx, PORC);
      const L = BASE + 4 - a.nivel * (BASE + 4 - ARRIBA), ola = x => L + (a.nivel > 0.995 ? 0 : Math.sin(x * 0.07 + t * 2.4) * 1.6);
      if (a.nivel > 0.002) {
        const nivel = new Path2D(); nivel.moveTo(0, 230); nivel.lineTo(0, ola(0)); for (let x = 0; x <= 260; x += 5) nivel.lineTo(x, ola(x)); nivel.lineTo(260, 230); nivel.closePath();
        ctx.save(); ctx.clip(nivel); figura(ctx, ORO); ctx.restore();
        if (a.nivel < 0.995) { ctx.save(); ctx.clip(silueta); ctx.strokeStyle = "rgba(255,246,216,.95)"; ctx.lineWidth = 1.6; ctx.beginPath(); for (let x = 0; x <= 260; x += 5) x ? ctx.lineTo(x, ola(x)) : ctx.moveTo(x, ola(x)); ctx.stroke(); ctx.restore(); }
      }
      contorno(ctx, silueta, mezcla(C["porcelana-osc"], C["oro-osc"], Math.min(1, a.nivel)), 2.5);
      // el brillo de la porcelana o del oro
      [[122, 90, 28, 12, -0.3], [76, 84, 13, 7, -0.6]].forEach(([x, y, rx, ry, r]) => { ctx.fillStyle = rg(ctx, x, y, 0, rx, [[0, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]]); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r, 0, 6.3); ctx.fill(); });
      // las piedras: siempre a color
      gema(ctx, 157, 96, 4.6, C.indigo); gema(ctx, 124, 104, 2.6, C.verde); gema(ctx, 191, 104, 2.6, C.verde); gema(ctx, 84, 85, 3.4, C.coral, true);
      // en la meta: un brillo que cruza el oro
      if (a.fiesta) { const s = ((t - a.t0) % 1.7) / 1.2; if (t - a.t0 < 3.4 && s <= 1) { ctx.save(); ctx.clip(silueta); const x = -40 + s * 330, g = ctx.createLinearGradient(x - 26, 0, x + 26, 40); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.7)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 260, 220); ctx.restore(); } }
      // la ranura en la manta
      ctx.fillStyle = lg(ctx, 142, 68, 174, 80, [[0, C["oro-claro"]], [1, C["oro-osc"]]]); ro(ctx, RANURA[0] - 15, RANURA[1] - 5, 30, 9, 4.5); ctx.fill();
      ctx.fillStyle = "#1A140C"; ro(ctx, RANURA[0] - 11, RANURA[1] - 3, 22, 5, 2.5); ctx.fill();
      for (const c of a.cayendo) monedaCara(ctx, c.x, c.y, 6.5, 0.3 + 0.65 * Math.abs(Math.cos(c.giro)));
      a.part.pintar(ctx);
    };
    return a;
  }

  /* -------- La torre del año: lo que ahorraste cada mes, en pilas de monedas -------- */
  const MESES_C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const bonito = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };
  const corto = (v, sin$) => v >= 1e6 ? (sin$ ? "" : "$") + (v / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " M" : v ? (sin$ ? "" : "$") + Math.round(v / 1000).toLocaleString("es-CL") + " mil" : "$0";
  function torre(W, H, cv) {
    const anio = +cv.dataset.anio || new Date().getFullYear(), datos = () => (typeof STATE !== "undefined" && STATE ? alcTorreDatos(STATE, anio) : null);
    const ANG = W < 420, X0 = ANG ? 58 : 74, PASO = (W - X0 - (ANG ? 12 : 26)) / 11, R = Math.min(12, PASO * 0.4), ESP = R * 0.38, PISO = H - 34;
    const T0 = datos(), a = { elegido: T0 ? T0.sel : 0, crece: QUIETO ? 1 : 0 };
    a.tocar = x => {
      const T = datos(), i = Math.round((x - X0) / PASO); if (!T || i < 0 || i > 11 || T.meses[i].v == null) return;
      a.elegido = i; const txt = cv.parentElement && cv.parentElement.querySelector("[data-alc-torre-txt]"); if (txt) txt.textContent = alcTorreTxt(T, i);
    };
    a.repetir = () => { a.crece = 0; };
    a.paso = k => { a.crece = Math.min(1, a.crece + (QUIETO ? 1 : 0.012) * k); };
    a.mueve = () => a.crece < 1;
    a.pintar = ctx => {
      const T = datos(); if (!T) return;
      const oc = alcOculto(), max = Math.max(T.metaMes || 0, ...T.meses.map(x => x.v || 0), 1), POR = bonito(max / Math.max(8, Math.floor((PISO - 46) / ESP))), paso = bonito(max / 3);
      const yDe = v => PISO - v / POR * ESP, xl = X0 - (ANG ? 18 : 22);
      ctx.font = `600 ${ANG ? 9 : 10}px Figtree, system-ui, sans-serif`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let v = 0; v <= max * 1.12; v += paso) { const y = yDe(v); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xl, y + 4); ctx.lineTo(W - 8, y + 4); ctx.stroke(); if (!oc || !v) { ctx.fillStyle = C["text-muted"]; ctx.fillText(oc ? "0" : corto(v, ANG), xl - 5, y + 4); } }
      if (T.metaMes > 0) {
        const ym = yDe(T.metaMes) + 4; ctx.setLineDash([5, 4]); ctx.strokeStyle = C.oro; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(xl, ym); ctx.lineTo(W - 8, ym); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C["oro-osc"]; ctx.font = `800 ${ANG ? 9 : 10}px Figtree, system-ui, sans-serif`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText(ANG ? "meta" : "meta del mes", W - 8, ym - 5);
      }
      ctx.textBaseline = "alphabetic";
      T.meses.forEach((m, i) => {
        const x = X0 + i * PASO, sel = i === a.elegido, v = m.v;
        ctx.fillStyle = sel ? C.text : C["text-muted"]; ctx.font = `${sel ? 800 : 600} ${ANG ? 9.5 : 11}px Figtree, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(MESES_C[i], x, PISO + 24);
        if (v == null) { ctx.strokeStyle = C["line-strong"]; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, PISO, R, R * 0.42, 0, 0, 6.3); ctx.stroke(); ctx.setLineDash([]); return; }
        if (v < 0) {
          const h = Math.min(26, (-v / POR) * ESP) * Math.min(1, a.crece * 4);
          ctx.fillStyle = rgba(C.coral, 0.12); ro(ctx, x - R, PISO + 4, R * 2, Math.max(3, h), 4); ctx.fill(); ctx.strokeStyle = C.coral; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
          if (sel) { ctx.fillStyle = C.coral; ctx.font = "800 11px Figtree, system-ui, sans-serif"; ctx.fillText(oc ? "−" : "−" + fmt(-v), x, PISO - 10); }
          return;
        }
        const n = Math.min(60, Math.round(v / POR)), mostrar = Math.floor(n * limitar(a.crece * 12 - i * 0.7, 0, 1));
        for (let j = 0; j < mostrar; j++) moneda(ctx, x + Math.sin(i * 7 + j * 2.3) * 1.2, PISO - j * ESP, R);
        if (sel && mostrar === n) {
          const top = PISO - n * ESP - 12;
          ctx.strokeStyle = C.indigo; ctx.lineWidth = 2; ro(ctx, x - R - 4, top - 2, R * 2 + 8, n * ESP + 22, 8); ctx.stroke();
          const txt = oc ? (m.meta > 0 ? Math.round(v / m.meta * 100) + "%" : "") : fmt(v);
          if (txt) { ctx.font = "800 11px Figtree, system-ui, sans-serif"; const w = ctx.measureText(txt).width + 12, bx = limitar(x - w / 2, 2, W - w - 2);
            ctx.fillStyle = C.indigo; ro(ctx, bx, top - 24, w, 18, 9); ctx.fill(); ctx.fillStyle = C.oscuro ? "#0C0F1E" : "#fff"; ctx.textAlign = "center"; ctx.fillText(txt, bx + w / 2, top - 11.5); }
        }
      });
    };
    return a;
  }
  /* La muestra de un color de monedas (Tienda) */
  function monedaEscena() {
    return { paso() {}, mueve: () => false, pintar(ctx) {
      sombra(ctx, 130, 196, 90, 0.2);
      for (let i = 0; i < 6; i++) moneda(ctx, 70 + (i % 2) * 3, 190 - i * 6, 22);
      for (let i = 0; i < 4; i++) moneda(ctx, 196 - (i % 2) * 2, 190 - i * 6, 22);
      monedaCara(ctx, 130, 100, 62, 0.96);
    } };
  }

  /* ============ Montar cada lienzo ============ */
  const FAB = { greda, "ele-suerte": eleSuerte, "ele-greda": eleGreda, vidrio, frasco, caja, viaje };
  const MUESTRA = { greda: "Para las vacaciones", "ele-suerte": "Fondo de emergencia", "ele-greda": "Fondo de emergencia", vidrio: "Regalos de Navidad", frasco: "Bicicleta nueva", caja: "Pie para el depto", viaje: "Viaje al sur" };
  function datosDe(cv, estilo) {
    if (cv.dataset.modo === "muestra" || !cv.dataset.id) { const meta = 300000, f = +cv.dataset.frac || 0.6; return { meta, guardado: Math.round(meta * f / 10000) * 10000, nombre: MUESTRA[estilo] || "Mi alcancía", destino: "Puerto Varas", oculto: false }; }
    const a = typeof STATE !== "undefined" && STATE ? alcPorId(cv.dataset.id) : null; if (!a) return null;
    return { meta: Math.max(1, a.meta), guardado: alcGuardado(a), nombre: a.nombre, destino: a.destino, oculto: alcOculto() };
  }
  const vivas = new Set(), quietas = new Set();
  function medir(T) { const w = T.cv.clientWidth || T.W; T.k = w / T.W; const pw = Math.max(1, Math.round(w * DPR)), ph = Math.max(1, Math.round(w * T.H / T.W * DPR)); if (T.cv.width !== pw || T.cv.height !== ph) { T.cv.width = pw; T.cv.height = ph; } }
  function pintar(T, t) {
    if (!T.muestra && (typeof STATE === "undefined" || !STATE)) return;   // sin sesión (al salir de la cuenta) no hay alcancías que dibujar
    MON = PALETAS[T.moneda || (typeof alcMoneda === "function" ? alcMoneda() : "oro")] || PALETAS.oro;
    const { ctx, cv, k } = T; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(k * DPR, 0, 0, k * DPR, 0, 0);
    try { T.escena.pintar(ctx, t); } catch (e) { if (!T.fallo) { T.fallo = true; console.warn("alcancía", e); } }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }
  function montar(cv) {
    if (cv.dataset.listo) return; cv.dataset.listo = "1";
    if (!C.text) colores();
    const estilo = cv.dataset.alc; let W = 260, H = 220, escena;
    if (estilo === "torre") { const ancho = cv.clientWidth || 340; [W, H] = ancho < 480 ? [340, 200] : [520, 190]; cv.style.aspectRatio = W + "/" + H; escena = torre(W, H, cv); }
    else if (estilo === "moneda") escena = monedaEscena();
    else { const d = datosDe(cv, estilo); if (!d) return; escena = (FAB[estilo] || FAB.greda)(d); }
    const T = { cv, ctx: cv.getContext("2d"), escena, W, H, k: 1, visible: false, activo: estilo === "torre" ? 0 : 0.6, t0: performance.now(), id: cv.dataset.id || "", muestra: cv.dataset.modo === "muestra" || !cv.dataset.id && estilo !== "torre", moneda: cv.dataset.moneda || "" };
    medir(T); pintar(T, 0);
    if (T.muestra) { quietas.add(T); if (window.ResizeObserver) new ResizeObserver(() => { medir(T); pintar(T, 0); }).observe(cv); return T; }
    vivas.add(T);
    if (escena.tocar) cv.addEventListener("pointerdown", e => { const r = cv.getBoundingClientRect(); escena.tocar((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); T.activo = 0.3; despertar(); });
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { T.visible = es[es.length - 1].isIntersecting; if (T.visible) despertar(); }, { rootMargin: "60px" }).observe(cv);
    else T.visible = true;
    if (window.ResizeObserver) new ResizeObserver(() => { medir(T); pintar(T, (performance.now() - T.t0) / 1000); }).observe(cv);
    return T;
  }
  let vivo = false, ant = 0;
  function despertar() { if (!vivo) { vivo = true; ant = performance.now(); requestAnimationFrame(marco); } }
  function marco(ahora) {
    const dt = Math.min(0.05, Math.max(0.001, (ahora - ant) / 1000)); ant = ahora;
    const k = Math.max(1, Math.min(3, Math.round(dt * 60)));
    let algo = false;
    for (const T of vivas) {
      if (!T.cv.isConnected) { vivas.delete(T); continue; }
      if (!T.visible || document.hidden || (typeof STATE === "undefined" || !STATE)) continue;
      if (!(T.escena.mueve() || T.activo > 0)) continue;
      const t = (ahora - T.t0) / 1000; T.activo -= dt;
      if (QUIETO) { for (let i = 0; i < 400 && T.escena.mueve(); i++) T.escena.paso(3, t + i / 20); }
      else T.escena.paso(k, t);
      pintar(T, t);
      if (!QUIETO && (T.escena.mueve() || T.activo > 0)) algo = true;
    }
    if (algo) requestAnimationFrame(marco); else vivo = false;
  }
  /* Guardar o deshacer: las monedas caen (o se van) en los lienzos de esa alcancía */
  function cambio(id, delta) {
    vivas.forEach(T => { if (T.id !== id || !T.cv.isConnected) return; if (delta > 0) T.escena.sumar(delta); else if (T.escena.quitar) T.escena.quitar(-delta); T.activo = 1.2; });
    despertar();
  }
  /* Romper el chanchito (greda o vidrio): el mazo o la grieta, los pedazos y las monedas */
  function romper(id) {
    let ok = false;
    vivas.forEach(T => { if (T.id === id && T.cv.isConnected && T.escena.romper && T.escena.romper()) { ok = true; T.activo = 3; T.visible = true; } });
    if (ok) despertar();
    return ok;
  }
  const repintar = () => { colores(); SPRITES.clear(); quietas.forEach(T => { if (!T.cv.isConnected) quietas.delete(T); else pintar(T, 0); }); vivas.forEach(T => { T.activo = Math.max(T.activo, 0.1); }); despertar(); };
  new MutationObserver(repintar).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(repintar);
  let espera = null;
  new MutationObserver(() => { if (espera) return; espera = setTimeout(() => { espera = null; document.querySelectorAll("canvas[data-alc]:not([data-listo])").forEach(montar); quietas.forEach(T => { if (!T.cv.isConnected) quietas.delete(T); }); }, 20); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) vivas.forEach(T => { T.activo = Math.max(T.activo, 0.1); }); despertar(); });
  return { montar, cambio, romper, repintar };
})();
