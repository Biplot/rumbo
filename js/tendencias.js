/* ============================================================
   RUMBO · Tendencias (gráficos SVG sin librerías)
   ============================================================ */

function svgLine(values, opts = {}) {
  const { color = "var(--cian)", goal = null, fmt = (v) => v } = opts;
  const W = 680, H = 200, padL = 46, padR = 18, padT = 14, padB = 28;
  const idx = values.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (!idx.length) return `<div class="empty" style="height:160px;display:grid;place-items:center">Sin datos aún.</div>`;

  const vs = idx.map(p => p[1]).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo; lo -= span * 0.14; hi += span * 0.14;
  const n = values.length;
  const X = i => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const yy = padT + (g / 3) * (H - padT - padB);
    const val = hi - (g / 3) * (hi - lo);
    grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL - 8}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${fmt(Math.round(val * 10) / 10)}</text>`;
  }
  const goalLine = goal != null ? `<line x1="${padL}" y1="${Y(goal).toFixed(1)}" x2="${W - padR}" y2="${Y(goal).toFixed(1)}" stroke="var(--coral)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${W - padR}" y="${(Y(goal) - 5).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--coral)">meta ${fmt(goal)}</text>` : "";
  const path = idx.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
  const dots = idx.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.2" fill="${color}"/>`).join("");
  const xl = values.map((v, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${MESES_CORTO[i]}</text>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${goalLine}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}</svg>`;
}

function svgBar(values, opts = {}) {
  const { color = "var(--cian)", fmt = (v) => v } = opts;
  const W = 680, H = 200, padL = 46, padR = 18, padT = 14, padB = 28;
  const present = values.filter(v => v != null);
  if (!present.length) return `<div class="empty" style="height:160px;display:grid;place-items:center">Sin datos aún.</div>`;
  let hi = Math.max(...present, 0); if (hi <= 0) hi = 1;
  const n = values.length;
  const bw = ((W - padL - padR) / n) * 0.6;
  const X = i => padL + ((i + 0.5) / n) * (W - padL - padR);
  const Y = v => padT + (1 - v / hi) * (H - padT - padB);
  const base = H - padB;

  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const yy = padT + (g / 3) * (H - padT - padB);
    const val = hi - (g / 3) * hi;
    grid += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>
      <text x="${padL - 8}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${fmt(Math.round(val))}</text>`;
  }
  const bars = values.map((v, i) => {
    if (v == null) return "";
    const h = Math.max(0, base - Y(v));
    return `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}"/>`;
  }).join("");
  const xl = values.map((v, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${MESES_CORTO[i]}</text>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${bars}${xl}</svg>`;
}

function renderTendencias() {
  const S = STATE;
  const now = new Date();
  const curM = now.getMonth();

  const pesos = S.salud.meses.map(m => (m.peso != null ? m.peso : null));
  const pesoActual = pesos.filter(p => p != null).slice(-1)[0];

  const ahorroVals = S.finanzas.meses.map(m => ((m.ingreso || m.gasto) ? (m.ingreso || 0) - (m.gasto || 0) : null));
  const ahorroAcum = ahorroVals.reduce((a, v) => a + (v || 0), 0);
  const pctAnual = S.finanzas.metaAnual ? Math.min(100, Math.round((ahorroAcum / S.finanzas.metaAnual) * 100)) : 0;

  const habPct = MESES.map((_, m) => {
    const key = monthKey(S.settings.year, m);
    const log = S.habitos.log[key];
    if (!log) return null;
    const days = (m === curM) ? now.getDate() : daysInMonth(S.settings.year, m);
    const total = S.habitos.defs.length * days;
    if (!total) return null;
    let marked = 0;
    for (const hid in log) for (const d in log[hid]) if (+d <= days) marked++;
    return Math.round((marked / total) * 100);
  });

  const ruedaAvg = S.rueda.meses.map(a => {
    const sum = a.reduce((x, y) => x + y, 0);
    return sum > 0 ? +(sum / a.length).toFixed(1) : null;
  });

  const libros = S.lecturas.filter(l => l.estado === "terminado").length;
  const deTot = S.salud.meses.reduce((a, m) => a + (m.diasEntren || 0), 0);

  /* Libros terminados por mes (según fecha de término) */
  const librosMes = MESES.map((_, m) => S.lecturas.filter(l => {
    if (l.estado !== "terminado" || !l.fin) return false;
    const d = new Date(l.fin + "T00:00:00");
    return d.getFullYear() === S.settings.year && d.getMonth() === m;
  }).length);

  /* Estado de ánimo por mes (desde el Diario de vida) */
  const diario = S.vida.diario || [];
  const moodByMonth = MESES.map((_, m) => {
    const es = diario.filter(e => {
      if (!e.mood || !e.fecha) return false;
      const d = new Date(e.fecha + "T00:00:00");
      return d.getFullYear() === S.settings.year && d.getMonth() === m;
    });
    return es.length ? +(es.reduce((a, e) => a + e.mood, 0) / es.length).toFixed(1) : null;
  });

  /* Resumen de los últimos 7 días */
  const hoy = new Date();
  const semanaISO = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(hoy); d.setDate(hoy.getDate() - i); semanaISO.push(isoLocal(d)); }
  const setSemana = new Set(semanaISO);
  const moodsSem = diario.filter(e => e.mood && setSemana.has(e.fecha)).map(e => e.mood);
  const moodAvgSem = moodsSem.length ? moodsSem.reduce((a, b) => a + b, 0) / moodsSem.length : null;
  const moodEmojiSem = moodAvgSem != null ? MOODS[Math.round(moodAvgSem) - 1] : "—";
  const cerradosSem = semanaISO.filter(iso => S.ritual.dias[iso] && S.ritual.dias[iso].cerrado).length;
  let habMarc = 0, habPos = 0;
  semanaISO.forEach(iso => {
    const d = new Date(iso + "T00:00:00");
    S.habitos.defs.forEach(h => { habPos++; if (habitDone(h.id, d.getMonth(), d.getDate())) habMarc++; });
  });
  const habPctSem = habPos ? Math.round((habMarc / habPos) * 100) : 0;
  const tareasSem = (S.semana.dias || []).flat();
  const tareasDoneSem = tareasSem.filter(t => t.done).length;
  const gratisSem = diario.filter(e => e.gratitud && setSemana.has(e.fecha));

  const resumenSemana = `
  <div class="section-title">Resumen de la semana</div>
  <div class="card">
    <div class="grid grid-4">
      <div class="stat"><div class="stat__label">😊 Ánimo</div><div class="stat__value">${moodEmojiSem} <small>${moodAvgSem != null ? moodAvgSem.toFixed(1) : "—"}</small></div></div>
      <div class="stat"><div class="stat__label">🌙 Días cerrados</div><div class="stat__value">${cerradosSem}<small>/7</small></div></div>
      <div class="stat"><div class="stat__label">📊 Hábitos</div><div class="stat__value">${habPctSem}%</div></div>
      <div class="stat"><div class="stat__label">📋 Tareas hechas</div><div class="stat__value">${tareasDoneSem}<small>/${tareasSem.length}</small></div></div>
    </div>
    ${gratisSem.length ? `<div class="divider"></div>
      <div class="text-xs muted" style="margin-bottom:8px">💛 Gratitudes de la semana</div>
      <div class="row-wrap" style="gap:8px">${gratisSem.map(e => `<span class="chip chip--coral">${escapeHtml(e.gratitud)}</span>`).join("")}</div>` : ""}
  </div>`;

  return `
  <div class="grid grid-4">
    ${statCard("💰", "Ahorro acumulado", fmtCLP(ahorroAcum), "Meta " + fmtCLP(S.finanzas.metaAnual), pctAnual)}
    ${statCard("⚖️", "Peso actual", (pesoActual != null ? pesoActual + " kg" : "—"), "Meta " + S.salud.pesoObjetivo + " kg")}
    ${statCard("🏋️", "Días entrenados", deTot, "en el año")}
    ${statCard("🔥", "Racha de días", computeClosedStreak() + " días", "cerrados seguidos")}
  </div>

  ${resumenSemana}

  <div class="section-title">Tu evolución ${S.settings.year}</div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card__head"><div class="card__title">⚖️ Peso (kg)</div><span class="card__hint">objetivo ${S.salud.pesoObjetivo} kg</span></div>
      ${svgLine(pesos, { color: "var(--cian)", goal: S.salud.pesoObjetivo, fmt: v => v })}
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">💰 Ahorro por mes</div><span class="card__hint">ingreso − gasto</span></div>
      ${svgBar(ahorroVals, { color: "var(--cian)", fmt: v => "$" + Math.round(v / 1000) + "k" })}
    </div>
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card">
      <div class="card__head"><div class="card__title">📊 Cumplimiento de hábitos</div><span class="card__hint">% del mes</span></div>
      ${svgBar(habPct, { color: "var(--coral)", fmt: v => v + "%" })}
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">🧭 Rueda de la vida</div><span class="card__hint">promedio mensual</span></div>
      ${svgLine(ruedaAvg, { color: "var(--cian)", fmt: v => v })}
    </div>
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card">
      <div class="card__head"><div class="card__title">😊 Estado de ánimo por mes</div><span class="card__hint">promedio 1–5 · desde tu Diario</span></div>
      ${svgLine(moodByMonth, { color: "var(--coral)", fmt: v => v })}
    </div>
    <div class="card">
      <div class="card__head"><div class="card__title">📚 Libros terminados por mes</div><span class="card__hint">${libros} en el año</span></div>
      ${svgBar(librosMes, { color: "var(--cian)", fmt: v => v })}
    </div>
  </div>
  <p class="text-xs muted mt-24">Los datos incluyen ejemplos precargados para que veas el panel funcionando. Edítalos o bórralos cuando quieras desde cada módulo.</p>`;
}
