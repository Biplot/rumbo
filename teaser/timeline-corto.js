/* ============================================================
   RUMBO · Teaser — corte de 15 s (Reels / TikTok)
   La estructura del brief: gancho → abre tu día → montaje y
   descubrimiento → cierra tu día → CTA. Una frase por pantalla.
   ============================================================ */
window.TIMELINE_CORTO = function (L) {
  const DIA = "2026-09-22";
  const go = (w, ruta) => { w.location.hash = ruta; w.onRoute(); w.scrollTo(0, 0); };
  const click = sel => (w, d) => { const n = d.querySelector(sel); if (!n) throw new Error("sin elemento: " + sel); n.click(); };
  const ruta = r => w => go(w, r);
  const limpiaToast = (w, d) => { const t = d.getElementById("toast"); t.hidden = true; t.textContent = ""; };

  const BLANCO = "#FFFFFF", TINTA = "#0E2A47";

  return {
    duration: 15000,

    sky: [
      { t: 0,     top: "#0A1A2C", mid: "#14324C", bot: "#22496E" },
      { t: 1400,  top: "#3E6E90", mid: "#8C7C96", bot: "#E9A06E" },
      { t: 2600,  top: "#CFE0EC", mid: "#F6E4D2", bot: "#FDF6EE" },
      { t: 7000,  top: "#DCE9F2", mid: "#F4F6F3", bot: "#FBFBF9" },
      { t: 10600, top: "#1B2F4A", mid: "#3B3550", bot: "#6E4352" },
      { t: 12600, top: "#122238", mid: "#2C2A45", bot: "#4A3A50" },
      { t: 14000, top: "#E9F0F4", mid: "#FBFBF9", bot: "#FFFFFF" },
      { t: 15000, top: "#E9F0F4", mid: "#FBFBF9", bot: "#FFFFFF" },
    ],

    glow: [
      { t: 0,     col: "#E8563A", x: 0.5, y: 1.15, r: 0.55, al: 0.05 },
      { t: 1800,  col: "#FFB37A", x: 0.5, y: 0.98, r: 0.85, al: 0.45 },
      { t: 3400,  col: "#FFD9AE", x: 0.62, y: 0.18, r: 0.90, al: 0.28 },
      { t: 7000,  col: "#CFEDE6", x: 0.62, y: 0.15, r: 0.90, al: 0.22 },
      { t: 10600, col: "#E8563A", x: 0.5, y: 0.92, r: 0.85, al: 0.30 },
      { t: 14000, col: "#12A594", x: 0.5, y: 0.5, r: 0.90, al: 0.10 },
    ],

    device: [
      { t: 0,     x: 0.5, y: 0.76, s: 0.84, rot: -2.0 },
      { t: 2000,  x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 6900,  x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 7400,  x: 0.5, y: 0.580, s: 0.90, rot: 0 },
      { t: 10100, x: 0.5, y: 0.565, s: 0.97, rot: 0 },
      { t: 13100, x: 0.5, y: 0.580, s: 0.92, rot: 0, op: 1 },
      { t: 13900, x: 0.5, y: 1.00, s: 0.80, rot: 1.5, op: 0 },
    ],

    screenOff:  [ { t: 0, v: 1 }, { t: 1150, v: 1 }, { t: 1600, v: 0 } ],
    screenWarm: [ { t: 0, v: 0 }, { t: 10200, v: 0 }, { t: 10900, v: 0.26 }, { t: 12900, v: 0.26 }, { t: 13300, v: 0 } ],
    glare:      [ { t: 0, v: 0.52 }, { t: 2000, v: 0.34 }, { t: 10400, v: 0.20 } ],

    clock: [
      { t: 0,     iso: `${DIA}T07:10:00` },
      { t: 1400,  iso: `${DIA}T07:42:00` },
      { t: 5000,  iso: `${DIA}T13:05:00` },
      { t: 10000, iso: `${DIA}T21:34:00` },
    ],

    cues: [
      { t: 1300,  fn: ruta("inicio") },

      { t: 2300,  fn: click('#view [data-action="day-open"]') },
      { t: 2400,  fn: (w, d) => { d.getElementById("r-mision").value = ""; } },
      { t: 4750,  fn: click('[data-action="ritual-save"]') },

      { t: 5050,  fn: ruta("habitos") },
      { t: 5060,  fn: limpiaToast },
      { t: 5250,  fn: click(".hb-grid .hb-today:nth-child(1)") },
      { t: 5600,  fn: click(".hb-grid .hb-today:nth-child(2)") },
      { t: 5950,  fn: click(".hb-grid .hb-today:nth-child(4)") },
      { t: 6300,  fn: click(".hb-grid .hb-today:nth-child(6)") },

      { t: 7000,  fn: ruta("tendencias") },

      { t: 10050, fn: ruta("inicio") },
      { t: 10650, fn: click('#view [data-action="day-close"]') },
      { t: 10950, fn: click("#c-moods .mood-btn:nth-child(4)") },
      /* En 40 s el SAPO se marca antes, en la lista de tareas. Aquí no hay
         tiempo para ese paso y el cierre saldría diciendo que no se cumplió. */
      { t: 11080, fn: click("#c-sapo button:nth-child(1)") },
      { t: 12650, fn: click('[data-action="cierre-save"]') },
      { t: 12780, fn: limpiaToast },
      { t: 12820, fn: ruta("diario") },
    ],

    typing: [
      { t: [2450, 3500],   sel: "#r-mision", text: "Cerrar la propuesta de Andes" },
      { t: [3600, 4350],   sel: "#r-sapo",   text: "Llamar al banco" },
      { t: [11300, 12200], sel: "#c-mejor",  text: "Salí a correr con el cerro despejado." },
    ],

    ranges: [
      { t: [4350, 4650], sel: "#r-energia", from: 3, to: 4 },
    ],

    scroll: [
      { t: [4400, 4700],   target: "modal", from: 0, to: 300 },
      { t: [7600, 9400],   target: "win",   from: 0, to: 110 },
      { t: [11000, 11250], target: "modal", from: 0, to: 210 },
      { t: [12250, 12500], target: "modal", from: 210, to: 430 },
    ],

    taps: [
      { t: 2150,  sel: '#view [data-action="day-open"]' },
      { t: 4620,  sel: '[data-action="ritual-save"]' },
      { t: 5120,  sel: ".hb-grid .hb-today:nth-child(1)" },
      { t: 5470,  sel: ".hb-grid .hb-today:nth-child(2)" },
      { t: 5820,  sel: ".hb-grid .hb-today:nth-child(4)" },
      { t: 6170,  sel: ".hb-grid .hb-today:nth-child(6)" },
      { t: 10520, sel: '#view [data-action="day-close"]' },
      { t: 10820, sel: "#c-moods .mood-btn:nth-child(4)" },
      { t: 12520, sel: '[data-action="cierre-save"]' },
    ],

    cards: [
      { t: [150, 1450],    y: 0.085, size: 50, color: BLANCO, in: 380, out: 300, lines: ["Tus días", "pasan rápido."] },
      { t: [2200, 4750],   y: 0.048, size: 40, color: TINTA,  in: 380, out: 280, lines: ["Abre tu día."], sub: "Tu misión, tu SAPO, tu energía." },
      { t: [5200, 6750],   y: 0.048, size: 40, color: TINTA,  in: 340, out: 260, lines: ["Hábitos."], sub: "Un toque y listo." },
      { t: [7200, 9700],   y: 0.052, size: 44, color: TINTA,  in: 380, out: 300, lines: ["Rumbo aprende", "de ti."], sub: "Patrones tuyos que no veías." },
      { t: [10700, 12850], y: 0.048, size: 42, color: BLANCO, in: 380, out: 280, lines: ["Cierra tu día."], sub: "Un diario que se llena solo." },
    ],

    brand: [
      { t: 0, o: 0, y: 14 }, { t: 13600, o: 0, y: 14 }, { t: 14250, o: 1, y: 0 }, { t: 15000, o: 1, y: 0 },
    ],
  };
};
