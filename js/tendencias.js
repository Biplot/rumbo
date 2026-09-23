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

/* ============================================================
   DESCUBRIMIENTOS · patrones y correlaciones desde tus datos
   ============================================================ */
function computeInsights() {
  const S = STATE;
  const out = [];
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const pctMejor = (a, b) => Math.round((a / b - 1) * 100);

  // Ánimo por fecha (promedio si hay varias entradas ese día)
  const moodMap = {};
  (S.vida.diario || []).forEach(e => { if (e && e.mood && e.fecha) (moodMap[e.fecha] = moodMap[e.fecha] || []).push(e.mood); });
  const moodDates = Object.keys(moodMap);
  const moodAt = f => avg(moodMap[f]);

  // 1) Ánimo vs cada hábito → el de mayor efecto positivo.
  //    Solo cuentan los días en que el hábito "tocaba" (diario / días fijos) o se hizo,
  //    desde su creación: un hábito semanal no "falta" los días que no le tocan.
  let best = null;
  (S.habitos.defs || []).forEach(h => {
    const con = [], sin = [];
    moodDates.forEach(f => {
      if (f < hmCreado(h)) return;
      const hecho = hmDone(h, f, S);
      if (hecho) con.push(moodAt(f));
      else if (hmProgramado(h, f)) sin.push(moodAt(f));
    });
    if (con.length >= 4 && sin.length >= 4) {
      const d = avg(con) - avg(sin);
      if (d >= 0.4 && (!best || d > best.d)) best = { h, d, con: avg(con), sin: avg(sin) };
    }
  });
  if (best) out.push({ icon: best.h.icon || "✨", strength: best.d, text: `Tu ánimo es <b>${pctMejor(best.con, best.sin)}% mejor</b> los días que haces <b>${escapeHtml(best.h.nombre)}</b>.` });

  // 2) Ánimo los días que cierras tu ritual
  { const con = [], sin = [];
    moodDates.forEach(f => { const r = S.ritual.dias[f]; (r && r.cerrado ? con : sin).push(moodAt(f)); });
    if (con.length >= 4 && sin.length >= 4) { const d = avg(con) - avg(sin);
      if (d >= 0.4) out.push({ icon: "🌙", strength: d, text: `Tu ánimo es <b>${pctMejor(avg(con), avg(sin))}% mejor</b> los días que <b>cierras tu ritual</b>.` }); } }

  // 3) Fin de semana vs semana
  { const wk = [], we = [];
    moodDates.forEach(f => { const dow = new Date(f + "T00:00:00").getDay(); (dow === 0 || dow === 6 ? we : wk).push(moodAt(f)); });
    if (wk.length >= 3 && we.length >= 3) { const d = avg(we) - avg(wk);
      if (Math.abs(d) >= 0.4) out.push({ icon: d > 0 ? "🎉" : "📅", strength: Math.abs(d),
        text: d > 0 ? `Tu ánimo es mejor los <b>fines de semana</b>.` : `Tu ánimo <b>baja los fines de semana</b> — cuidar el descanso ahí podría ayudar.` }); } }

  // 4) Los días que das tu primer bocado
  { const con = [], sin = [];
    moodDates.forEach(f => { const r = S.ritual.dias[f]; if (r && r.cerrado && r.cierre) (r.cierre.sapo ? con : sin).push(moodAt(f)); });
    if (con.length >= 4 && sin.length >= 4) { const d = avg(con) - avg(sin);
      if (d >= 0.4) out.push({ icon: BOCADO.emoji, strength: d, text: `Los días que das tu <b>primer bocado</b>, tu ánimo es <b>${pctMejor(avg(con), avg(sin))}% mejor</b>.` }); } }

  // 5) Racha de cierre
  { const streak = computeClosedStreak();
    if (streak >= 3) out.push({ icon: "🔥", strength: 0.3 + Math.min(streak, 30) / 30, text: `Llevas <b>${streak} días</b> cerrando tu día seguidos. ¡No rompas la cadena!` }); }

  // 6) Constancia de gratitud (últimos 14 días)
  { const hoy = new Date(); let con = 0;
    for (let i = 0; i < 14; i++) { const d = new Date(hoy); d.setDate(hoy.getDate() - i); const f = isoLocal(d); if ((S.vida.diario || []).some(e => e.fecha === f && e.gratitud)) con++; }
    if (con >= 5) out.push({ icon: "🙏", strength: 0.2 + con / 28, text: `Anotaste algo que agradeces <b>${con} de los últimos 14 días</b>.` }); }

  return out.sort((a, b) => b.strength - a.strength);
}

function renderDescubrimientos() {
  const ins = computeInsights().slice(0, 4);
  const cuerpo = ins.length
    ? `<div class="grid grid-2">${ins.map(i => `<div class="card insight-card"><div class="insight-ico">${i.icon}</div><div class="insight-txt">${i.text}</div></div>`).join("")}</div>`
    : `<div class="card"><div class="empty">Registra tu ánimo (en el cierre del ritual) y tus hábitos unos días. Cuando haya suficiente, aquí verás <b>qué te hace bien</b> — correlaciones entre tu día y cómo te sientes. 🔍</div></div>`;
  return `<div class="section-title">💡 Tus descubrimientos</div>${cuerpo}`;
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

  // % de cumplimiento real por mes (contra la frecuencia de cada hábito)
  const habPct = MESES.map((_, m) => cumplimientoGrupo(S.habitos.defs, ...mesRango(m), S).pct);

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
  const habSem = cumplimientoGrupo(S.habitos.defs, semanaISO[0], semanaISO[6], S);
  const habPctSem = habSem.pct == null ? 0 : habSem.pct;
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
  ${renderDescubrimientos()}

  <div class="grid grid-4 mt-24">
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
