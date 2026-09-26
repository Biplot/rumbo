/* ============================================================
   RUMBO · Recompensas: rangos (XP), insignias y tienda de cosméticos
   ============================================================ */

/* -------- Rangos (Set A · Alto Valor) -------- */
const RANGOS = [
  { min: 0, nombre: "Aprendiz", icon: "🌱", color: "#7a8ca0" },
  { min: 300, nombre: "Constante", icon: "🔥", color: "#FF6B4A" },
  { min: 900, nombre: "Enfocado", icon: "⚡", color: "#17C3B2" },
  { min: 2000, nombre: "Imparable", icon: "🚀", color: "#3ee0cf" },
  { min: 4000, nombre: "Maestro", icon: "🏔️", color: "#17C3B2" },
  { min: 7000, nombre: "Élite", icon: "💎", color: "#8FF3E8" },
  { min: 12000, nombre: "Alto Valor", icon: "👑", color: "#FFC24A" },
];
function rankFor(xp) {
  let cur = RANGOS[0], next = null;
  for (let i = 0; i < RANGOS.length; i++) {
    if (xp >= RANGOS[i].min) { cur = RANGOS[i]; next = RANGOS[i + 1] || null; }
  }
  return { cur, next, idx: RANGOS.indexOf(cur) };
}

/* -------- Helpers para condiciones de insignias -------- */
function g_ahorroAcum(s) { return datosAnio(s, anioActual()).finanzas.meses.reduce((a, m) => a + ((m.ingreso || 0) - (m.gasto || 0)), 0); }
function g_pesoActual(s) { return pesoActualGlobal(s); }
function g_habitMarks(s) { let c = 0; for (const k in s.habitos.log) { const mm = s.habitos.log[k]; for (const h in mm) c += Object.keys(mm[h]).length; } return c; }
function g_ritualesHechos(s) { return Object.values(s.ritual.dias).filter(d => d.hecho).length; }
function g_sapos(s) { return Object.values(s.ritual.dias).filter(d => d.cierre && d.cierre.sapo).length; }
function g_diasEntren(s) { return aniosConDatos(s).reduce((t, y) => t + datosAnio(s, y).salud.meses.reduce((a, m) => a + (m.diasEntren || 0), 0), 0); }
/* Semana Perfecta: en alguna semana ISO reciente, todos los hábitos (no mensuales,
   no pausados) cumplieron su objetivo. Ver semanaPerfecta() en habitos-motor.js */
function g_semanaPerfecta(s) {
  let l = hmLunes(hmHoy());
  for (let i = 0; i < 9; i++, l = hmAdd(l, -7)) if (semanaPerfecta(s, l)) return true;
  return false;
}

/* -------- Insignias (solo se ganan) -------- */
const BADGES = [
  { id: "primer-paso", icon: "🔥", nombre: "Primer Paso", desc: "Cierra tu primer día", reward: 20, check: s => Object.values(s.ritual.dias).some(d => d.cerrado) },
  { id: "semana-fuego", icon: "🔥", nombre: "Semana de Fuego", desc: "7 días cerrados seguidos", reward: 50, check: () => computeClosedStreak() >= 7 },
  { id: "inquebrantable", icon: "💠", nombre: "Inquebrantable", desc: "30 días cerrados seguidos", reward: 150, check: () => computeClosedStreak() >= 30 },
  { id: "madrugador", icon: "🌅", nombre: "Madrugador", desc: "Completa 10 rituales de apertura", reward: 40, check: s => g_ritualesHechos(s) >= 10 },
  { id: "cazador-sapos", icon: "🐘", nombre: "Bocado a Bocado", desc: "Completa 10 primeros bocados", reward: 50, check: s => g_sapos(s) >= 10 },
  { id: "semana-perfecta", icon: "📊", nombre: "Semana Perfecta", desc: "Todos tus hábitos cumplen su objetivo en una semana", reward: 60, check: s => g_semanaPerfecta(s) },
  { id: "centurion", icon: "🎖️", nombre: "Centurión", desc: "Marca 100 hábitos", reward: 40, check: s => g_habitMarks(s) >= 100 },
  { id: "primer-peso", icon: "💰", nombre: "Primer Peso", desc: "Registra tu primer ahorro mensual", reward: 20, check: s => aniosConDatos(s).some(y => datosAnio(s, y).finanzas.meses.some(m => (m.ingreso || 0) - (m.gasto || 0) > 0)) },
  { id: "medio-camino", icon: "💵", nombre: "A Medio Camino", desc: "Llega al 50% de tu meta anual", reward: 80, check: s => { const meta = datosAnio(s, anioActual()).finanzas.metaAnual; return meta > 0 && g_ahorroAcum(s) >= meta * 0.5; } },
  { id: "pagina-uno", icon: "📖", nombre: "Página Uno", desc: "Termina tu primer libro", reward: 20, check: s => s.lecturas.some(l => l.estado === "terminado") },
  { id: "devorador", icon: "📚", nombre: "Devorador de Libros", desc: "Termina 3 libros", reward: 60, check: s => s.lecturas.filter(l => l.estado === "terminado").length >= 3 },
  { id: "peso-pluma", icon: "⚖️", nombre: "Peso Pluma", desc: "Alcanza tu peso objetivo", reward: 100, check: s => { const p = g_pesoActual(s); return p != null && p <= s.salud.pesoObjetivo; } },
  { id: "mes-redondo", icon: "🗓️", nombre: "Mes Redondo", desc: "Abre y cierra el mismo mes", reward: 100, check: s => g_mesesRedondos(s).length >= 1 },
  { id: "semana-redonda", icon: "📅", nombre: "Semana Redonda", desc: "Planifica y cierra la misma semana", reward: 75, check: s => g_semanasRedondas(s).length >= 1 },
  { id: "cuatro-semanas", icon: "📆", nombre: "4 Semanas Seguidas", desc: "Planifica y cierra 4 semanas seguidas", reward: 200, check: s => g_semanasSeguidas(s, 4) },
  { id: "trimestre-rumbo", icon: "🧭", nombre: "Trimestre con Rumbo", desc: "3 meses seguidos abiertos y cerrados", reward: 250, check: s => g_trimestreConRumbo(s) },
  { id: "guerrero", icon: "💪", nombre: "Guerrero", desc: "Acumula 50 días entrenados", reward: 60, check: s => g_diasEntren(s) >= 50 },
  { id: "elefante-domado", icon: "🎪", nombre: "Elefante Domado", desc: "Completa una tarea que habías postergado 3 veces o más", reward: 50, check: s => tmElefanteDomado(s) },
];
function findBadge(id) { return BADGES.find(b => b.id === id); }

/* Revisa y otorga insignias nuevas (se llama en cada render) */
function checkBadges() {
  const g = STATE.gamif; g.badges = g.badges || [];
  let gained = 0, count = 0, last = "";
  BADGES.forEach(b => {
    if (g.badges.includes(b.id)) return;
    let ok = false; try { ok = b.check(STATE); } catch (e) { ok = false; }
    if (ok) {
      g.badges.push(b.id);
      // La recompensa sale de su movimiento "insignia:<id>": nunca se paga dos veces
      if (registrarMovimiento("insignia:" + b.id, b.reward || 0, b.reward || 0, "Insignia " + b.nombre, true)) gained += b.reward || 0;
      count++; last = b.nombre;
    }
  });
  if (count > 0) {
    saveState(); refreshPts();
    if (gained > 0) toast(count === 1 ? `🏅 ${last} · +${gained} ⭐` : `🏅 ${count} insignias · +${gained} ⭐`);
  }
}

/* -------- Tienda de cosméticos -------- */
const TITULOS = [
  { id: "tit-constructor", nombre: "Constructor", icon: "🛠️", costo: 300 },
  { id: "tit-enfocado", nombre: "El Enfocado", icon: "🎯", costo: 250 },
  { id: "tit-imparable", nombre: "Imparable", icon: "🚀", costo: 450 },
  { id: "tit-altovalor", nombre: "Alto Valor", icon: "👑", costo: 700 },
];
const DETALLES = [
  { id: "det-confeti", nombre: "Confeti al cerrar el día", icon: "🎉", costo: 350, key: "confeti" },
  { id: "det-acento-oro", nombre: "Acento Oro", icon: "🟡", costo: 200, key: "acento", value: "#FFC24A" },
  { id: "det-acento-neon", nombre: "Acento Neón", icon: "💗", costo: 200, key: "acento", value: "#FF4FD8" },
  { id: "det-acento-verde", nombre: "Acento Verde", icon: "🟢", costo: 200, key: "acento", value: "#3BE38B" },
];
function findCosmetic(id) { return TITULOS.concat(DETALLES).find(c => c.id === id); }
function isOwned(id) { return (STATE.gamif.owned || []).includes(id); }

function buyItem(id) {
  const it = findCosmetic(id); if (!it || isOwned(id)) return;
  recalcGamif(STATE);   // valida contra el saldo derivado del ledger
  if (STATE.gamif.puntos < it.costo) return toast("Te faltan " + (it.costo - STATE.gamif.puntos) + " ⭐", true);
  if (!confirm(`¿Comprar "${it.nombre}" por ${it.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - it.costo} ⭐.`)) return;
  const res = ledgerComprar(STATE, id, it.costo);
  if (!res.ok) return res.yaTenia ? rerender() : toast("Te faltan " + res.falta + " ⭐", true);
  saveState(); updateTopbar(); rerender();
  toast("🛍️ " + it.nombre + " desbloqueado");
}

/* Tarjeta de cosmético (usada en la Tienda) */
function cosmeticCard(it) {
  const owned = isOwned(it.id), eq = isEquipped(it);
  return `<div class="card">
    <div class="row" style="gap:10px"><span style="font-size:24px">${it.icon}</span>
      <div style="flex:1"><div class="card__title" style="font-size:14px">${it.nombre}</div>
        <div class="text-xs muted">${owned ? "Desbloqueado" : it.costo + " ⭐"}</div></div></div>
    <div class="mt-8">${owned
      ? `<button class="btn ${eq ? "btn--soft" : "btn--cian"} btn-block" data-action="cos-equip" data-id="${it.id}">${eq ? "✓ Equipado — quitar" : "Equipar"}</button>`
      : `<button class="btn btn--primary btn-block" data-action="cos-buy" data-id="${it.id}">Comprar · ${it.costo} ⭐</button>`}</div>
  </div>`;
}
function equipItem(id) {
  const it = findCosmetic(id); if (!it || !isOwned(id)) return;
  const eq = STATE.gamif.equipped;
  if (TITULOS.includes(it)) { eq.titulo = (eq.titulo === id ? null : id); }
  else if (it.key === "confeti") { eq.confeti = !eq.confeti; }
  else if (it.key === "acento") { eq.acento = (eq.acento === it.value ? null : it.value); }
  applyCosmetics(); saveState(); rerender();
}
function isEquipped(it) {
  const eq = STATE.gamif.equipped;
  if (TITULOS.includes(it)) return eq.titulo === it.id;
  if (it.key === "confeti") return !!eq.confeti;
  if (it.key === "acento") return eq.acento === it.value;
  return false;
}

/* Aplica cosméticos globales (acento) */
function applyCosmetics() {
  const eq = (STATE.gamif && STATE.gamif.equipped) || {};
  const root = document.documentElement;
  if (eq.acento) root.style.setProperty("--coral", eq.acento);
  else root.style.removeProperty("--coral");
}

/* Confeti (detalle equipable) */
function launchConfetti() {
  const colors = ["#17C3B2", "#FF6B4A", "#FFC24A", "#8FF3E8", "#FF4FD8"];
  for (let i = 0; i < 48; i++) {
    const c = document.createElement("div");
    c.className = "confetti-bit";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = (Math.random() * 0.35).toFixed(2) + "s";
    c.style.transform = `rotate(${Math.floor(Math.random() * 360)}deg)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }
}

/* ============================================================
   Página Recompensas
   ============================================================ */
function renderRecompensas() {
  const g = STATE.gamif;
  const { cur, next, idx } = rankFor(g.xp || 0);
  const prog = next ? Math.min(100, Math.round(((g.xp - cur.min) / (next.min - cur.min)) * 100)) : 100;
  const falta = next ? (next.min - g.xp) : 0;

  const heroRank = `<div class="card" style="background:linear-gradient(120deg, var(--surface), var(--surface-2));border-left:3px solid ${cur.color}">
    <div class="flex-between" style="flex-wrap:wrap;gap:16px">
      <div class="row" style="gap:14px">
        <div style="font-size:44px;line-height:1">${cur.icon}</div>
        <div>
          <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.08em">Rango ${idx + 1} de ${RANGOS.length}</div>
          <div class="big-num" style="color:${cur.color}">${cur.nombre}</div>
          <div class="text-sm muted">${(g.xp || 0).toLocaleString("es-CL")} XP acumulada</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="pill pill--pts" style="font-size:16px">⭐ ${g.puntos}</div>
        <div class="text-xs muted mt-8">monedas gastables</div>
      </div>
    </div>
    <div class="mt-16">
      <div class="flex-between text-xs muted"><span>${cur.nombre}</span>${next ? `<span>${next.icon} ${next.nombre} · faltan ${falta.toLocaleString("es-CL")} XP</span>` : "<span>¡Rango máximo! 👑</span>"}</div>
      <div class="bar mt-8"><div class="bar__fill" style="width:${prog}%"></div></div>
    </div>
  </div>`;

  // Insignias
  const badges = BADGES.map(b => {
    const earned = g.badges.includes(b.id);
    const destacada = g.equipped.insignia === b.id;
    return `<div class="card badge-card ${earned ? "" : "is-locked"}" style="text-align:center">
      <div style="font-size:32px;line-height:1">${b.icon}</div>
      <div class="card__title" style="font-size:14px;margin-top:6px">${b.nombre}</div>
      <div class="text-xs muted" style="margin-top:4px">${b.desc}</div>
      ${earned
        ? `<button class="btn-ghost btn-block mt-8" data-action="badge-destacar" data-id="${b.id}">${destacada ? "★ Destacada" : "Destacar"}</button>`
        : `<div class="chip mt-8" style="display:inline-block">🔒 +${b.reward} ⭐</div>`}
    </div>`;
  }).join("");
  const ganadas = g.badges.length;

  // Escalera de rangos (aspiracional, compacta)
  const escalera = RANGOS.map((r, i) => {
    const estado = i < idx ? "logrado" : (i === idx ? "actual" : "bloqueado");
    return `<div class="rank-pill ${estado}" title="${r.nombre} · ${r.min.toLocaleString("es-CL")} XP">
      <span class="rank-pill__ico">${r.icon}</span>
      <div class="rank-pill__txt"><span class="rank-pill__name">${r.nombre}</span><span class="rank-pill__xp">${r.min >= 1000 ? (r.min / 1000) + "k" : r.min} XP</span></div>
    </div>`;
  }).join("");

  return `
  ${heroRank}

  <div class="section-title">🏔️ Escalera de rangos</div>
  <div class="card"><div class="rank-ladder">${escalera}</div></div>

  <div class="flex-between mt-24"><div class="section-title" style="margin:0">🏅 Insignias · ${ganadas}/${BADGES.length}</div></div>
  <div class="grid grid-auto mt-16">${badges}</div>

  <div class="card mt-24">
    <div class="flex-between" style="flex-wrap:wrap;gap:10px">
      <div><div class="card__title">🛒 ¿Quieres gastar tus ⭐?</div>
        <div class="text-sm muted mt-8">Desbloquea temas, títulos y detalles en la Tienda.</div></div>
      <a class="btn btn--cian" href="#tienda">Ir a la Tienda →</a>
    </div>
  </div>`;
}

/* Helpers para mostrar lo equipado en Inicio */
function tituloEquipado() { const id = STATE.gamif.equipped.titulo; return id ? TITULOS.find(t => t.id === id) : null; }
function insigniaDestacada() { const id = STATE.gamif.equipped.insignia; return id ? findBadge(id) : null; }
