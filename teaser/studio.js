/* ============================================================
   RUMBO · Teaser — motor de estudio
   Cada fotograma es una función pura del tiempo del timeline.
   Nada depende del reloj real ni de cuánto tarde la captura,
   así el render sale idéntico corrida tras corrida.
   ============================================================ */
const Studio = (() => {
  const q = new URLSearchParams(location.search);
  const FORMAT = q.get("format") === "wide" ? "wide" : "vertical";
  const CUT = q.get("cut") === "corto" ? "corto" : "completo";

  /* Geometría por formato. El teléfono mide siempre lo mismo en CSS
     (la app se maqueta igual en los dos) y solo cambia su escala. */
  const L = FORMAT === "wide"
    ? { W: 960, H: 540, U: 0.60, deviceScale: 0.66, deviceX: 0.27, deviceY: 0.5,
        textX: 0.50, textW: 0.44, textAlign: "left" }
    : { W: 540, H: 960, U: 1.00, deviceScale: 1.00, deviceX: 0.5, deviceY: 0.545,
        textX: 0.07, textW: 0.86, textAlign: "center" };

  const SCREEN = { w: 322, h: 698, pad: 9 };

  const el = {};
  const S = { lastMs: -1, now: 0, cueAt: 0, cards: [], taps: [], toastAt: -1e9 };
  const TOAST_MS = 1700;   // lo que dura un aviso, medido en tiempo de timeline
  let TL = null, app = null, appDoc = null;

  /* ---------- utilidades ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const norm = (t, a, b) => clamp((t - a) / Math.max(1, b - a), 0, 1);

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixHex = (a, b, k) => {
    const A = hex(a), B = hex(b);
    return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`;
  };

  /* Interpola una pista de keyframes [{t, ...}] en el instante t */
  function at(kfs, t, mix) {
    if (!kfs || !kfs.length) return null;
    if (t <= kfs[0].t) return mix(kfs[0], kfs[0], 0);
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i], b = kfs[i + 1];
      if (t >= a.t && t <= b.t) {
        const e = b.ease === "linear" ? x => x : (b.ease === "out" ? easeOut : easeInOut);
        return mix(a, b, e(norm(t, a.t, b.t)));
      }
    }
    const last = kfs[kfs.length - 1];
    return mix(last, last, 1);
  }

  const $app = sel => (appDoc ? appDoc.querySelector(sel) : null);

  /* ---------- montaje ---------- */
  function buildStage() {
    el.stage = document.getElementById("stage");
    el.sky = document.getElementById("sky");
    el.glow = document.getElementById("glow");
    el.device = document.getElementById("device");
    el.shell = document.getElementById("shell");
    el.screen = document.getElementById("screen");
    el.app = document.getElementById("app");
    el.screenOff = document.getElementById("screenOff");
    el.screenWarm = document.getElementById("screenWarm");
    el.glare = document.getElementById("glare");
    el.taps = document.getElementById("taps");
    el.ui = document.getElementById("ui");
    el.brand = document.getElementById("brand");
    el.grain = document.getElementById("grain");

    el.stage.style.width = L.W + "px";
    el.stage.style.height = L.H + "px";
    el.screen.style.width = SCREEN.w + "px";
    el.screen.style.height = SCREEN.h + "px";
    el.app.style.width = SCREEN.w + "px";
    el.app.style.height = SCREEN.h + "px";

    /* El teléfono se posiciona por transform: así la escala no
       reflowea la app de adentro. */
    const outW = SCREEN.w + SCREEN.pad * 2, outH = SCREEN.h + SCREEN.pad * 2;
    el.device.style.width = outW + "px";
    el.device.style.height = outH + "px";
    el.device.style.left = "0px";
    el.device.style.top = "0px";
    el.deviceBase = { outW, outH };

    el.grain.style.backgroundImage = grainUrl();

    /* Marca del cierre, escalada al formato */
    const u = L.U;
    el.brand.querySelector("svg").setAttribute("width", 64 * u);
    el.brand.querySelector("svg").setAttribute("height", 64 * u);
    el.brand.querySelector(".name").style.fontSize = 60 * u + "px";
    el.brand.querySelector(".by").style.fontSize = 20 * u + "px";
    el.brand.querySelector(".rule").style.cssText += `;width:${64 * u}px;margin:${26 * u}px 0 ${22 * u}px`;
    el.brand.querySelector(".tag").style.fontSize = 26 * u + "px";
    el.brand.querySelector(".dom").style.cssText += `;font-size:${28 * u}px;margin-top:${34 * u}px`;
  }

  /* Grano fino: evita el banding de los degradados grandes */
  function grainUrl() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const d = x.createImageData(128, 128);
    let s = 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 120 + rnd() * 135;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return `url(${c.toDataURL()})`;
  }

  /* ---------- textos ---------- */
  function buildCards() {
    S.cards = (TL.cards || []).map(def => {
      const node = document.createElement("div");
      node.className = "card";
      const u = L.U;
      const size = (def.size || 44) * u;
      node.style.cssText = `left:${L.textX * L.W}px;width:${L.textW * L.W}px;` +
        `text-align:${def.align || L.textAlign};color:${def.color || "#0E2A47"};` +
        `font-size:${size}px;line-height:${def.lh || 1.18};font-weight:${def.weight || 700};` +
        `letter-spacing:-0.02em;`;
      const lines = def.lines.map(html => {
        const ln = document.createElement("span");
        ln.className = "ln";
        ln.innerHTML = html;
        node.appendChild(ln);
        return ln;
      });
      if (def.sub) {
        const sb = document.createElement("span");
        sb.className = "ln";
        sb.innerHTML = def.sub;
        sb.style.cssText = `display:block;font-size:${(def.subSize || 20) * u}px;font-weight:500;opacity:.78;margin-top:${14 * u}px;letter-spacing:0`;
        node.appendChild(sb);
        lines.push(sb);
      }
      el.ui.appendChild(node);
      /* En 16:9 el texto vive en la columna de la derecha y se centra
         verticalmente; en 9:16 va sobre el teléfono, donde lo puso el guion. */
      const alto = node.offsetHeight;
      return { def, node, lines, size, top: FORMAT === "wide" ? (L.H - alto) / 2 : (def.y != null ? def.y : 0.2) * L.H };
    });
  }

  function applyCards(t) {
    for (const c of S.cards) {
      const [a, b] = c.def.t;
      const IN = c.def.in || 520, OUT = c.def.out || 420;
      if (t < a - 60 || t > b + OUT + 60) { c.node.style.opacity = 0; c.node.style.visibility = "hidden"; continue; }
      c.node.style.visibility = "visible";
      const u = L.U;
      const yBase = c.top;
      const fadeOut = t > b ? norm(t, b, b + OUT) : 0;
      c.node.style.opacity = 1 - fadeOut;
      c.node.style.top = yBase - easeOut(fadeOut) * 14 * u + "px";
      c.lines.forEach((ln, i) => {
        const k = easeOut(norm(t, a + i * 90, a + i * 90 + IN));
        ln.style.opacity = k;
        ln.style.transform = `translateY(${(1 - k) * 22 * u}px)`;
      });
    }
  }

  /* ---------- toques en pantalla ---------- */
  function applyTaps(t) {
    el.taps.innerHTML = "";
    for (const tp of (TL.taps || [])) {
      const dur = tp.dur || 480;
      if (t < tp.t || t > tp.t + dur) continue;
      const target = $app(tp.sel);
      if (!target) continue;
      const r = target.getBoundingClientRect();
      const k = norm(t, tp.t, tp.t + dur);
      const d = document.createElement("div");
      d.className = "tap";
      const size = lerp(16, tp.size || 76, easeOut(k));
      d.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;` +
        `width:${size}px;height:${size}px;opacity:${(1 - k) * 0.9}`;
      el.taps.appendChild(d);
    }
  }

  /* ---------- escritura en los campos ---------- */
  function applyTyping(t) {
    for (const ty of (TL.typing || [])) {
      const [a, b] = ty.t;
      if (t < a) continue;
      const node = $app(ty.sel);
      if (!node) continue;
      const k = norm(t, a, b);
      const n = Math.round(k * ty.text.length);
      const v = ty.text.slice(0, n);
      if (node.value !== v) {
        node.value = v;
        if (ty.event) node.dispatchEvent(new app.Event("input", { bubbles: true }));
      }
      /* El cursor se ve donde está escribiendo */
      if (k < 1 && node.setSelectionRange && node.type !== "range") {
        try { node.focus({ preventScroll: true }); node.setSelectionRange(n, n); } catch (e) {}
      }
    }
  }

  /* ---------- deslizadores ---------- */
  function applyRanges(t) {
    for (const r of (TL.ranges || [])) {
      const [a, b] = r.t;
      if (t < a) continue;
      const node = $app(r.sel);
      if (!node) continue;
      const v = Math.round(lerp(r.from, r.to, easeOut(norm(t, a, b))));
      if (+node.value !== v) {
        node.value = v;
        node.dispatchEvent(new app.Event("input", { bubbles: true }));
      }
    }
  }

  /* ---------- desplazamiento dentro de la app ---------- */
  function applyScroll(t) {
    for (const s of (TL.scroll || [])) {
      const [a, b] = s.t;
      /* Sólo manda dentro de su ventana. Si siguiera aplicándose después,
         arrastraría su posición a las escenas siguientes, que ya navegaron
         a otra vista y arrancan arriba. */
      if (t < a || t > b) continue;
      const k = easeInOut(norm(t, a, b));
      const y = lerp(s.from, s.to, k);
      if (s.target === "modal") { const m = $app("#modal"); if (m) m.scrollTop = y; }
      else app.scrollTo(0, y);
    }
  }

  /* ---------- fondo ---------- */
  function applySky(t) {
    const sky = at(TL.sky, t, (a, b, k) => ({
      top: mixHex(a.top, b.top, k), mid: mixHex(a.mid, b.mid, k), bot: mixHex(a.bot, b.bot, k),
    }));
    if (sky) el.sky.style.background = `linear-gradient(175deg, ${sky.top} 0%, ${sky.mid} 52%, ${sky.bot} 100%)`;

    const g = at(TL.glow, t, (a, b, k) => ({
      col: mixHex(a.col, b.col, k), x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k),
      r: lerp(a.r, b.r, k), al: lerp(a.al, b.al, k),
    }));
    if (g) {
      el.glow.style.background = `radial-gradient(${g.r * 100}% ${g.r * 100}% at ${g.x * 100}% ${g.y * 100}%, ${g.col} 0%, transparent 70%)`;
      el.glow.style.opacity = g.al;
    }
  }

  /* ---------- teléfono ---------- */
  function applyDevice(t) {
    const d = at(TL.device, t, (a, b, k) => ({
      x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k),
      rot: lerp(a.rot || 0, b.rot || 0, k), op: lerp(a.op == null ? 1 : a.op, b.op == null ? 1 : b.op, k),
    })) || { x: L.deviceX, y: L.deviceY, s: 1, rot: 0, op: 1 };

    /* El guion está escrito para 9:16. En 16:9 el teléfono se corre a la
       izquierda para dejarle la derecha al texto, conservando su movimiento. */
    const dx = FORMAT === "wide" ? L.deviceX + (d.x - 0.5) * 0.40 : d.x;
    const dy = FORMAT === "wide" ? L.deviceY + (d.y - 0.565) * 0.55 : d.y;

    const s = d.s * L.deviceScale;
    const cx = dx * L.W - el.deviceBase.outW / 2;
    const cy = dy * L.H - el.deviceBase.outH / 2;
    el.device.style.transform = `translate(${cx}px,${cy}px) scale(${s}) rotate(${d.rot}deg)`;
    el.device.style.opacity = d.op;

    const off = at(TL.screenOff, t, (a, b, k) => lerp(a.v, b.v, k));
    if (off != null) el.screenOff.style.opacity = off;
    const warm = at(TL.screenWarm, t, (a, b, k) => lerp(a.v, b.v, k));
    if (warm != null) el.screenWarm.style.opacity = warm;
    const glare = at(TL.glare, t, (a, b, k) => lerp(a.v, b.v, k));
    if (glare != null) el.glare.style.opacity = glare;
  }

  function applyBrand(t) {
    const v = at(TL.brand, t, (a, b, k) => ({ o: lerp(a.o, b.o, k), y: lerp(a.y || 0, b.y || 0, k) }));
    if (!v) return;
    el.brand.style.opacity = v.o;
    el.brand.style.transform = `translateY(${v.y}px)`;
  }

  /* ---------- avisos de la app ---------- */
  function applyToast(t) {
    const node = appDoc && appDoc.getElementById("toast");
    if (!node || node.hidden) return;
    const k = norm(t, S.toastAt, S.toastAt + TOAST_MS);
    if (k >= 1) { node.hidden = true; node.textContent = ""; return; }
    /* Entra desde abajo y se desvanece, como en la app */
    const inK = easeOut(norm(t, S.toastAt, S.toastAt + 220));
    const outK = norm(t, S.toastAt + TOAST_MS - 320, S.toastAt + TOAST_MS);
    node.style.opacity = inK * (1 - outK);
    node.style.transform = `translateX(-50%) translateY(${(1 - inK) * 14 + outK * 8}px)`;
  }

  /* ---------- reloj de la app ---------- */
  function applyClock(t) {
    const c = at(TL.clock, t, a => a.iso);
    if (c && app.__vnow !== new Date(c).getTime()) app.__vnow = c;
  }

  /* ---------- acciones sobre la app ---------- */
  function runCues(t) {
    const cues = TL.cues || [];
    while (S.cueAt < cues.length && cues[S.cueAt].t <= t) {
      try { cues[S.cueAt].fn(app, appDoc); } catch (e) { console.error("cue", S.cueAt, e.message); }
      S.cueAt++;
    }
  }

  /* ---------- API ---------- */
  function seek(ms) {
    if (ms < S.lastMs) throw new Error("El timeline solo avanza hacia adelante");
    S.now = ms;
    applyClock(ms);
    runCues(ms);
    applyToast(ms);
    applyTyping(ms);
    applyRanges(ms);
    applyScroll(ms);
    applySky(ms);
    applyDevice(ms);
    applyCards(ms);
    applyTaps(ms);
    applyBrand(ms);
    S.lastMs = ms;
    return true;
  }

  async function init() {
    buildStage();

    /* Espera a que la app haya entrado con la cuenta de demo.
       El frame se vuelve a leer en cada intento: al principio el iframe
       aún es `about:blank` y quedarse con ese documento deja mirando un
       DOM que nunca se llena. Y se mira el DOM y no `app.STATE` porque
       las variables `let` de un frame no son propiedades de su window. */
    await new Promise((res, rej) => {
      const limite = Date.now() + 20000;
      const tick = () => {
        const f = document.getElementById("app");
        const w = f.contentWindow, d = f.contentDocument;
        const raiz = d && d.getElementById("app");
        const vista = d && d.getElementById("view");
        if (w && d && d.readyState === "complete" && !/about:blank/.test(w.location.href) &&
            raiz && !raiz.hidden && vista && vista.children.length > 0) {
          app = w; appDoc = d;
          return res();
        }
        if (Date.now() > limite) return rej(new Error("La app no entró con la cuenta de demo"));
        setTimeout(tick, 40);
      };
      tick();
    });
    await appDoc.fonts.ready;

    /* Los avisos de la app se esconden solos a los 2,2 s de reloj real.
       Con las animaciones congeladas ese temporizador no sirve: aquí el
       aviso nace y muere con el tiempo del timeline. */
    app.toast = msg => {
      const t = appDoc.getElementById("toast");
      t.textContent = msg; t.className = "toast"; t.hidden = false;
      S.toastAt = S.now;
    };
    appDoc.getElementById("toast").hidden = true;

    TL = (CUT === "corto" ? window.TIMELINE_CORTO : window.TIMELINE)(L);
    buildCards();
    seek(0);
    return { duration: TL.duration, format: FORMAT, cut: CUT, W: L.W, H: L.H };
  }

  return { init, seek, get L() { return L; }, get app() { return app; } };
})();
window.Studio = Studio;
