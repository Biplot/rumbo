/* ============================================================
   RUMBO · Teaser — guion
   El brief, escena por escena. Los "cues" no simulan la app:
   hacen clic en ella. Lo que se ve en pantalla lo calcula Rumbo.
   ============================================================ */
window.TIMELINE = function (L) {
  const DIA = "2026-09-22";
  const go = (w, ruta) => { w.location.hash = ruta; w.onRoute(); w.scrollTo(0, 0); };
  const click = sel => (w, d) => { const n = d.querySelector(sel); if (!n) throw new Error("sin elemento: " + sel); n.click(); };
  const ruta = r => w => go(w, r);
  const limpiaToast = (w, d) => { const t = d.getElementById("toast"); t.hidden = true; t.textContent = ""; };

  const BLANCO = "#FFFFFF", TINTA = "#0E2A47";

  return {
    duration: 40000,

    /* ---------- El cielo: de madrugada a noche y de vuelta a la luz ---------- */
    sky: [
      { t: 0,     top: "#08172A", mid: "#123049", bot: "#1C4266" },
      { t: 2400,  top: "#14324B", mid: "#31567B", bot: "#7A6580" },
      { t: 4200,  top: "#3E6E90", mid: "#8C7C96", bot: "#E9A06E" },
      { t: 6000,  top: "#CFE0EC", mid: "#F6E4D2", bot: "#FDF6EE" },
      { t: 17000, top: "#DCE9F2", mid: "#F4F6F3", bot: "#FBFBF9" },
      { t: 26000, top: "#E7EFF4", mid: "#FAF6F0", bot: "#FBFBF9" },
      { t: 28200, top: "#1B2F4A", mid: "#3B3550", bot: "#6E4352" },
      { t: 31000, top: "#122238", mid: "#2C2A45", bot: "#57394E" },
      { t: 36300, top: "#122238", mid: "#2C2A45", bot: "#4A3A50" },
      { t: 37900, top: "#E9F0F4", mid: "#FBFBF9", bot: "#FFFFFF" },
      { t: 40000, top: "#E9F0F4", mid: "#FBFBF9", bot: "#FFFFFF" },
    ],

    glow: [
      { t: 0,     col: "#E8563A", x: 0.5, y: 1.18, r: 0.55, al: 0.00 },
      { t: 2600,  col: "#F07A4A", x: 0.5, y: 1.08, r: 0.70, al: 0.22 },
      { t: 4200,  col: "#FFB37A", x: 0.5, y: 0.98, r: 0.85, al: 0.45 },
      { t: 7000,  col: "#FFD9AE", x: 0.62, y: 0.18, r: 0.90, al: 0.30 },
      { t: 17000, col: "#CFEDE6", x: 0.62, y: 0.15, r: 0.90, al: 0.22 },
      { t: 28200, col: "#E8563A", x: 0.5, y: 0.92, r: 0.85, al: 0.30 },
      { t: 36300, col: "#E8563A", x: 0.5, y: 0.95, r: 0.80, al: 0.22 },
      { t: 37900, col: "#12A594", x: 0.5, y: 0.5, r: 0.90, al: 0.10 },
    ],

    /* ---------- El teléfono en cuadro ---------- */
    device: [
      { t: 0,     x: 0.5, y: 0.80, s: 0.80, rot: -2.2 },
      { t: 2600,  x: 0.5, y: 0.68, s: 0.86, rot: -1.2 },
      { t: 4200,  x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 16900, x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 17600, x: 0.5, y: 0.580, s: 0.90, rot: 0 },
      { t: 27300, x: 0.5, y: 0.580, s: 0.90, rot: 0 },
      { t: 28000, x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 33900, x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 34400, x: 0.5, y: 0.580, s: 0.90, rot: 0 },
      { t: 37200, x: 0.5, y: 0.580, s: 0.90, rot: 0, op: 1 },
      { t: 38400, x: 0.5, y: 1.00, s: 0.78, rot: 1.5, op: 0 },
    ],

    /* La pantalla se enciende cuando la mano toma el teléfono */
    screenOff: [ { t: 0, v: 1 }, { t: 3250, v: 1 }, { t: 3800, v: 0 } ],
    /* Luz cálida de noche sobre la pantalla */
    screenWarm: [ { t: 0, v: 0 }, { t: 27300, v: 0 }, { t: 28400, v: 0.26 }, { t: 36300, v: 0.26 }, { t: 37200, v: 0 } ],
    glare: [ { t: 0, v: 0.55 }, { t: 4200, v: 0.34 }, { t: 27400, v: 0.20 } ],

    /* ---------- La hora del día que ve la app ---------- */
    clock: [
      { t: 0,     iso: `${DIA}T06:58:00` },
      { t: 4200,  iso: `${DIA}T07:42:00` },
      { t: 11000, iso: `${DIA}T13:05:00` },
      { t: 17000, iso: `${DIA}T15:20:00` },
      { t: 27400, iso: `${DIA}T21:34:00` },
    ],

    /* ---------- Acciones sobre la app real ---------- */
    cues: [
      { t: 3900,  fn: ruta("inicio") },

      /* — Ritual de apertura — */
      { t: 4950,  fn: click('#view [data-action="day-open"]') },
      { t: 5060,  fn: (w, d) => { d.getElementById("r-mision").value = ""; } },
      { t: 10150, fn: click('[data-action="ritual-save"]') },
      { t: 10800, fn: limpiaToast },

      /* — Durante el día — */
      { t: 11050, fn: ruta("habitos") },
      { t: 11520, fn: click(".hb-grid .hb-today:nth-child(1)") },
      { t: 12000, fn: click(".hb-grid .hb-today:nth-child(2)") },
      { t: 12480, fn: click(".hb-grid .hb-today:nth-child(4)") },
      { t: 12960, fn: click(".hb-grid .hb-today:nth-child(6)") },

      { t: 13650, fn: ruta("notas") },
      { t: 15320, fn: click('[data-action="idea-add"]') },

      { t: 15700, fn: ruta("inicio") },
      { t: 16350, fn: click("#view .item-row .check") },

      /* — Descubrimientos — */
      { t: 17100, fn: ruta("tendencias") },

      /* — Todo en un solo lugar — */
      { t: 21900, fn: ruta("calendario") },
      { t: 22420, fn: ruta("metas") },
      { t: 22940, fn: ruta("lecturas") },
      { t: 23460, fn: ruta("finanzas") },
      { t: 23980, fn: ruta("relaciones") },
      { t: 24500, fn: ruta("salud") },
      { t: 25020, fn: ruta("rueda") },
      { t: 25540, fn: ruta("recompensas") },

      /* — Ritual de cierre — */
      { t: 27500, fn: ruta("inicio") },
      { t: 28320, fn: click('#view [data-action="day-close"]') },
      { t: 28950, fn: click("#c-moods .mood-btn:nth-child(4)") },
      { t: 33250, fn: click('[data-action="cierre-save"]') },
      { t: 33700, fn: limpiaToast },
      { t: 33780, fn: ruta("diario") },
    ],

    /* ---------- Lo que se escribe, se escribe de verdad ---------- */
    typing: [
      { t: [5220, 6700],   sel: "#r-mision", text: "Cerrar la propuesta de Andes" },
      { t: [7050, 8450],   sel: "#r-sapo",   text: "Llamar al banco antes de las 11" },
      { t: [13820, 15100], sel: "#idea-input", text: "Regalarle un libro a la Fran" },
      { t: [29500, 31000], sel: "#c-mejor",  text: "Salí a correr con el cerro despejado." },
      { t: [31800, 32900], sel: "#c-manana", text: "Empezar por lo difícil" },
    ],

    ranges: [
      { t: [9250, 9800], sel: "#r-energia", from: 3, to: 4 },
    ],

    scroll: [
      { t: [8600, 9200],   target: "modal", from: 0, to: 300 },
      { t: [18400, 20600], target: "win",   from: 0, to: 120 },
      { t: [29050, 29450], target: "modal", from: 0, to: 210 },
      { t: [31150, 31650], target: "modal", from: 210, to: 430 },
      { t: [34600, 36900], target: "win",   from: 0, to: 340 },
    ],

    taps: [
      { t: 4790,  sel: '#view [data-action="day-open"]' },
      { t: 6900,  sel: "#r-sapo", size: 60 },
      { t: 9980,  sel: '[data-action="ritual-save"]' },
      { t: 11380, sel: ".hb-grid .hb-today:nth-child(1)" },
      { t: 11860, sel: ".hb-grid .hb-today:nth-child(2)" },
      { t: 12340, sel: ".hb-grid .hb-today:nth-child(4)" },
      { t: 12820, sel: ".hb-grid .hb-today:nth-child(6)" },
      { t: 15180, sel: '[data-action="idea-add"]' },
      { t: 16210, sel: "#view .item-row .check" },
      { t: 28180, sel: '#view [data-action="day-close"]' },
      { t: 28810, sel: "#c-moods .mood-btn:nth-child(4)" },
      { t: 33110, sel: '[data-action="cierre-save"]' },
    ],

    /* ---------- Tipografía en pantalla ---------- */
    cards: [
      { t: [420, 2050],    y: 0.085, size: 54, color: BLANCO, lines: ["Tus días", "pasan rápido."] },
      { t: [2280, 3700],   y: 0.085, size: 44, color: BLANCO, weight: 600, lines: ["¿Cuántos recuerdas", "de verdad?"] },

      { t: [5200, 9900],   y: 0.048, size: 40, color: TINTA, lines: ["Abre tu día."], sub: "Tu misión, tu SAPO, tu energía. 30 segundos." },

      { t: [11250, 13350], y: 0.048, size: 40, color: TINTA, lines: ["Hábitos."], sub: "Un toque y listo." },
      { t: [13750, 15450], y: 0.048, size: 40, color: TINTA, lines: ["Ideas."], sub: "Suéltalas antes de que se te olviden." },
      { t: [15780, 16850], y: 0.048, size: 40, color: TINTA, lines: ["Tareas."], sub: "Lo importante, primero." },

      { t: [17650, 21350], y: 0.052, size: 44, color: TINTA, lines: ["Rumbo aprende", "de ti."], sub: "Patrones tuyos que no veías." },

      { t: [22250, 26800], y: 0.052, size: 44, color: TINTA, lines: ["Tu vida entera,", "ordenada."], sub: "Metas · Lecturas · Finanzas · Salud · Tu gente" },

      { t: [28450, 33150], y: 0.048, size: 42, color: BLANCO, lines: ["Cierra tu día."], sub: "Un diario que se llena solo." },
      { t: [34350, 36950], y: 0.052, size: 44, color: BLANCO, lines: ["Día a día,", "tu progreso real."], sub: "La constancia se ve." },
    ],

    brand: [
      { t: 0, o: 0, y: 14 }, { t: 37700, o: 0, y: 14 }, { t: 38500, o: 1, y: 0 }, { t: 40000, o: 1, y: 0 },
    ],
  };
};
