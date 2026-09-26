/* ============================================================
   RUMBO · Tendencias (gráficos SVG sin librerías)
   ============================================================ */

function svgLine(values, opts = {}) {
  const { color = "var(--cian)", goal = null, fmt = (v) => v, labels = MESES_CORTO } = opts;
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
  const xl = values.map((v, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${labels[i] ?? ""}</text>`).join("");

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${grid}${goalLine}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}</svg>`;
}

function svgBar(values, opts = {}) {
  const { color = "var(--cian)", fmt = (v) => v, labels = MESES_CORTO, max = null } = opts;
  const W = 680, H = 200, padL = 46, padR = 18, padT = 14, padB = 28;
  const present = values.filter(v => v != null);
  if (!present.length) return `<div class="empty" style="height:160px;display:grid;place-items:center">Sin datos aún.</div>`;
  let hi = max != null ? max : Math.max(...present, 0); if (hi <= 0) hi = 1;
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
  const xl = values.map((v, i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${labels[i] ?? ""}</text>`).join("");

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

  // ---- Tareas y postergación (registro diario) ----
  const hoyT = todayISO();
  const diasPlan = Object.keys(agendaDias(S)).filter(f => f < hoyT && tmDia(S, f).pct != null);

  // 7) Energía de la mañana vs cumplimiento del día
  { const alto = [], bajo = [];
    diasPlan.forEach(f => { const r = S.ritual.dias[f]; if (!r || !r.energia) return; const p = tmDia(S, f).pct;
      if (r.energia >= 4) alto.push(p); else if (r.energia <= 2) bajo.push(p); });
    if (alto.length >= 4 && bajo.length >= 4) { const a = avg(alto), b = avg(bajo);
      if (a - b >= 15) out.push({ icon: "⚡", strength: (a - b) / 40, text: `Los días que partes con <b>energía alta</b> completas el <b>${Math.round(a)}%</b> de tus tareas; con energía baja, el ${Math.round(b)}%.` }); } }

  // 8) Hora a la que abres el día vs cumplimiento
  { const temprano = [], tarde = [];
    diasPlan.forEach(f => { const r = S.ritual.dias[f]; if (!r || !r.abiertoTs) return; const p = tmDia(S, f).pct;
      (new Date(r.abiertoTs).getHours() < 9 ? temprano : tarde).push(p); });
    if (temprano.length >= 4 && tarde.length >= 4) { const a = avg(temprano), b = avg(tarde);
      if (Math.abs(a - b) >= 15) out.push({ icon: "⏰", strength: Math.abs(a - b) / 40, text: a > b
        ? `Cuando abres tu día <b>antes de las 9</b> completas el <b>${Math.round(a)}%</b> de tus tareas (${Math.round(b)}% si lo abres más tarde).`
        : `Abrir tu día más tarde no te juega en contra: completas el ${Math.round(b)}% de tus tareas.` }); } }

  // 9) El hábito que más te ayuda a cumplir tus tareas
  { let mejor = null;
    (S.habitos.defs || []).forEach(h => { if (h.pausado) return; const con = [], sin = [];
      diasPlan.forEach(f => { if (f < hmCreado(h)) return; const p = tmDia(S, f).pct;
        if (hmDone(h, f, S)) con.push(p); else if (hmProgramado(h, f)) sin.push(p); });
      if (con.length >= 4 && sin.length >= 4) { const d = avg(con) - avg(sin); if (d >= 15 && (!mejor || d > mejor.d)) mejor = { h, d }; } });
    if (mejor) out.push({ icon: mejor.h.icon || "✨", strength: mejor.d / 40, text: `Los días que haces <b>${escapeHtml(mejor.h.nombre)}</b> completas <b>${Math.round(mejor.d)} puntos más</b> de tus tareas.` }); }

  // 10) El día de la semana en que más postergas
  { const r = tmResumen(S, agSumar(hoyT, -55), hoyT);
    const cand = r.porDia.map((d, i) => ({ ...d, i })).filter(d => d.pct != null && d.planificadas >= 5);
    if (cand.length >= 3 && r.indice != null) { const peor = cand.reduce((a, b) => (b.pct > a.pct ? b : a));
      if (peor.pct >= 30 && peor.pct >= r.indice * 1.4) out.push({ icon: "📅", strength: peor.pct / 100, text: `Los <b>${DIAS_SEMANA[peor.i].toLowerCase()}</b> postergas el <b>${peor.pct}%</b> de tus tareas (tu promedio es ${r.indice}%).` }); }
    // 11) Lo profesional vs lo personal
    const pro = r.porAmbito.pro.indice, per = r.porAmbito.per.indice;
    if (pro != null && per != null && Math.abs(pro - per) >= 15) out.push({ icon: pro > per ? AMBITOS.pro.icon : AMBITOS.per.icon, strength: Math.abs(pro - per) / 60,
      text: `Postergas más lo <b>${pro > per ? "profesional" : "personal"}</b> (${Math.max(pro, per)}%) que lo ${pro > per ? "personal" : "profesional"} (${Math.min(pro, per)}%).` }); }

  // 12) Postergar mucho vs tu ánimo
  { const mucho = [], poco = [];
    diasPlan.forEach(f => { if (!moodMap[f]) return; const d = tmDia(S, f);
      (d.movidas / d.planificadas >= 0.5 ? mucho : poco).push(moodAt(f)); });
    if (mucho.length >= 4 && poco.length >= 4) { const d = avg(poco) - avg(mucho);
      if (d >= 0.4) out.push({ icon: "🌧️", strength: d, text: `Los días que postergas más de la mitad de tus tareas, tu ánimo es <b>${Math.round((1 - avg(mucho) / avg(poco)) * 100)}% más bajo</b>.` }); } }

  return out.sort((a, b) => b.strength - a.strength);
}

/* ============================================================
   FOCO Y POSTERGACIÓN · métricas del registro diario (últimos 30 días)
   ============================================================ */
function renderFocoPostergacion() {
  const S = STATE, hoy = todayISO(), desde = agSumar(hoy, -29);
  const r = tmResumen(S, desde, hoy);
  const titulo = `<div class="section-title">🎯 Foco y postergación <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· últimos 30 días</span></div>`;
  if (r.tareas < 3) return titulo + `<div class="card"><div class="empty">Cuando tengas unos días de tareas en tu registro diario, aquí verás cuánto postergas, qué días y qué tareas se te repiten. Empieza cerrando tu día y decidiendo tus pendientes.</div></div>`;
  const cap = tmCapacidad(S, hoy, 14);
  const serie = tmSerieSemanas(S, hoy, 8);
  const lblSem = serie.map(x => { const d = agDate(x.lunes); return `${d.getDate()}/${d.getMonth() + 1}`; });
  const amb = a => r.porAmbito[a].indice == null ? "—" : r.porAmbito[a].indice + "%";
  const estadoChip = c => c.estado === "hecha" ? '<span class="chip chip--done">✓ hecha</span>' : c.estado === "pendiente" ? '<span class="chip chip--coral">pendiente</span>' : `<span class="chip">${ESTADOS_TAREA[c.estado].sig} ${ESTADOS_TAREA[c.estado].label.toLowerCase()}</span>`;
  return titulo + `
  <div class="grid grid-4">
    ${statCard("↪", "Índice de postergación", r.indice + "%", `${r.postergadas} de ${r.tareas} tareas movidas de día`)}
    ${statCard("⏳", "Días de arrastre", r.arrastre == null ? "—" : String(r.arrastre).replace(".", ",") + (r.arrastre === 1 ? " día" : " días"), "entre planificar y hacer")}
    ${statCard(BOCADO.emoji, "Primer bocado postergado", r.bocado.pct == null ? "—" : r.bocado.pct + "%", r.bocado.dias ? `${r.bocado.postergados} de ${r.bocado.dias} días` : "sin datos aún")}
    ${statCard("⚡", "Capacidad real", cap ? String(cap.hechasProm).replace(".", ",") + " / día" : "—", cap ? `planificas ${String(cap.planProm).replace(".", ",")} por día` : "faltan días con datos")}
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card"><div class="card__head"><div class="card__title">Postergación por semana</div><span class="card__hint">% de tareas movidas</span></div>
      ${svgBar(serie.map(x => x.indice), { labels: lblSem, max: 100, fmt: v => v + "%", color: "var(--coral)" })}</div>
    <div class="card"><div class="card__head"><div class="card__title">¿Qué día postergas más?</div><span class="card__hint">% por día de la semana</span></div>
      ${svgBar(r.porDia.map(d => d.pct), { labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"], max: 100, fmt: v => v + "%", color: "var(--cian)" })}</div>
  </div>
  <div class="grid grid-2 mt-24">
    <div class="card"><div class="card__title">Cómo cierras tus tareas</div>
      <div class="row-wrap mt-16" style="gap:8px">
        <span class="chip chip--done">✓ ${r.cumplimiento}% completadas</span>
        <span class="chip">✕ ${r.soltadas} soltadas</span><span class="chip">@ ${r.delegadas} delegadas</span>
        <span class="chip">• ${r.pendientes} pendientes</span></div>
      <div class="row-wrap mt-16" style="gap:8px">
        <span class="chip">${AMBITOS.pro.icon} Postergas ${amb("pro")} de lo profesional</span>
        <span class="chip">${AMBITOS.per.icon} Postergas ${amb("per")} de lo personal</span></div>
      <p class="text-xs muted mt-16">Soltar no es fallar: si sueltas mucho, quizás anotas más de lo que cabe en tu día.</p></div>
    <div class="card"><div class="card__title">Más postergadas</div>
      ${r.cronicas.length ? `<div class="mt-8">${r.cronicas.slice(0, 5).map(c => `<div class="flex-between" style="padding:8px 0;gap:8px;border-top:1px solid var(--line)">
        <span class="text-sm">${escapeHtml(c.txt)}</span><span class="row" style="gap:6px"><span class="chip chip--mig is-cronica">↪ ${c.n}</span>${estadoChip(c)}</span></div>`).join("")}</div>
        <p class="text-xs muted mt-8">Regla del bullet journal: si la postergaste 3 veces, pregúntate si vale la pena. Hazla tu primer bocado, pártela o suéltala.</p>`
      : `<div class="empty">Ninguna tarea postergada 3 veces o más. 👏</div>`}</div>
  </div>`;
}

function renderDescubrimientos() {
  const ins = computeInsights().slice(0, 6);
  const cuerpo = ins.length
    ? `<div class="grid grid-2">${ins.map(i => `<div class="card insight-card"><div class="insight-ico">${i.icon}</div><div class="insight-txt">${i.text}</div></div>`).join("")}</div>`
    : `<div class="card"><div class="empty">Registra tu ánimo (en el cierre del ritual) y tus hábitos unos días. Cuando haya suficiente, aquí verás <b>qué te hace bien</b> — correlaciones entre tu día y cómo te sientes. 🔍</div></div>`;
  return `<div class="section-title">💡 Tus descubrimientos</div>${cuerpo}`;
}

/* Totales de un año para compararlo con el anterior */
function totalesAnio(S, y) {
  const D = datosAnio(S, y);
  const ahorro = D.finanzas.meses.reduce((a, m) => a + ((m.ingreso || 0) - (m.gasto || 0)), 0);
  const habitos = cumplimientoGrupo(S.habitos.defs, `${y}-01-01`, `${y}-12-31`, S).pct;
  const entreno = D.salud.meses.reduce((a, m) => a + (m.diasEntren || 0), 0);
  const cerrados = Object.keys(S.ritual.dias || {}).filter(k => k.startsWith(y + "-") && S.ritual.dias[k].cerrado).length;
  const libros = (S.lecturas || []).filter(l => l.estado === "terminado" && (l.fin || "").startsWith(y + "-")).length;
  return { ahorro, habitos, entreno, cerrados, libros, hay: !!(ahorro || entreno || cerrados || libros) };
}
/* Fila "Comparado con el año anterior" (solo si el anterior tiene datos) */
function comparacionAnios(S, y) {
  const a = totalesAnio(S, y), b = totalesAnio(S, y - 1);
  if (!b.hay) return "";
  const chip = (ico, label, va, vb, fmt) => {
    const dif = va == null || vb == null ? "" : va > vb ? ' <span class="delta is-up">▲</span>' : va < vb ? ' <span class="delta is-down">▼</span>' : "";
    return `<span class="chip">${ico} ${label}: <b>${fmt(va)}</b> <span class="muted">vs ${fmt(vb)}</span>${dif}</span>`;
  };
  const pct = v => (v == null ? "—" : v + "%"), n = v => v;
  return `<div class="row-wrap" style="gap:8px;margin-bottom:16px"><span class="text-xs muted" style="width:100%">Comparado con ${y - 1}</span>
    ${chip("🌙", "días cerrados", a.cerrados, b.cerrados, n)}${chip("📊", "hábitos", a.habitos, b.habitos, pct)}
    ${chip("💰", "ahorro", a.ahorro, b.ahorro, fmtCLP)}${chip("🏋️", "días entrenados", a.entreno, b.entreno, n)}${chip("📚", "libros", a.libros, b.libros, n)}</div>`;
}

function renderTendencias() {
  const S = STATE;
  const now = new Date();
  const curM = now.getMonth();
  const y = anioVista(), D = datosAnio(S, y);   // la evolución es del año que se mira (‹ año ›)

  const pesos = D.salud.meses.map(m => (m.peso != null ? m.peso : null));
  const pesoActual = pesoActualGlobal(S);
  // Tarjetas de arriba: siempre el año actual (el selector ‹ año › solo cambia "Tu evolución")
  const H = datosAnio(S, anioActual());

  const ahorroVals = D.finanzas.meses.map(m => ((m.ingreso || m.gasto) ? (m.ingreso || 0) - (m.gasto || 0) : null));
  const ahorroAcum = H.finanzas.meses.reduce((a, m) => a + ((m.ingreso || 0) - (m.gasto || 0)), 0);
  const pctAnual = H.finanzas.metaAnual ? Math.min(100, Math.round((ahorroAcum / H.finanzas.metaAnual) * 100)) : 0;

  // % de cumplimiento real por mes (contra la frecuencia de cada hábito)
  const habPct = MESES.map((_, m) => cumplimientoGrupo(S.habitos.defs, ...mesRango(m), S).pct);

  const ruedaAvg = D.rueda.meses.map(a => {
    const sum = a.reduce((x, y) => x + y, 0);
    return sum > 0 ? +(sum / a.length).toFixed(1) : null;
  });

  const libros = S.lecturas.filter(l => l.estado === "terminado").length;
  const deTot = H.salud.meses.reduce((a, m) => a + (m.diasEntren || 0), 0);

  /* Libros terminados por mes (según fecha de término) */
  const librosMes = MESES.map((_, m) => S.lecturas.filter(l => {
    if (l.estado !== "terminado" || !l.fin) return false;
    const d = new Date(l.fin + "T00:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  }).length);

  /* Estado de ánimo por mes (desde el Diario de vida) */
  const diario = S.vida.diario || [];
  const moodByMonth = MESES.map((_, m) => {
    const es = diario.filter(e => {
      if (!e.mood || !e.fecha) return false;
      const d = new Date(e.fecha + "T00:00:00");
      return d.getFullYear() === y && d.getMonth() === m;
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
  // Últimos 7 días del registro diario (planificadas = todo lo anotado para esos días)
  const tareasSem = semanaISO.flatMap(iso => tareasDelDia(iso, S));
  const tareasDoneSem = tareasSem.filter(t => estadoTarea(t) === "hecha").length;
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
    ${statCard("💰", "Ahorro acumulado", fmtCLP(ahorroAcum), "Meta " + fmtCLP(H.finanzas.metaAnual), pctAnual)}
    ${statCard("⚖️", "Peso actual", (pesoActual != null ? pesoActual + " kg" : "—"), S.salud.pesoObjetivo != null ? "Meta " + S.salud.pesoObjetivo + " kg" : "Define tu meta en Salud")}
    ${statCard("🏋️", "Días entrenados", deTot, "en " + anioActual())}
    ${statCard("🔥", "Racha de días", computeClosedStreak() + " días", "cerrados seguidos")}
  </div>

  ${resumenSemana}

  ${renderFocoPostergacion()}

  <div class="section-title">Tu evolución</div>
  ${selectorAnio()}
  ${comparacionAnios(S, y)}
  <div class="grid grid-2">
    <div class="card">
      <div class="card__head"><div class="card__title">⚖️ Peso (kg)</div><span class="card__hint">${S.salud.pesoObjetivo != null ? "objetivo " + S.salud.pesoObjetivo + " kg" : ""}</span></div>
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
