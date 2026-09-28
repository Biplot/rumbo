/* ============================================================
   RUMBO · Logros (Entrega 4): insignias con niveles y secretas, títulos que piden
   una insignia y 🐘 tu elefante (crece con tu XP; sus accesorios se compran).
   Las insignias se suman a BADGES (recompensas.js): cada nivel es una insignia con
   su propio movimiento "insignia:<id>" en el ledger, así nunca se paga dos veces.
   ============================================================ */

/* -------- Métricas -------- */
/* checkBadges corre en cada render: las métricas que recorren toda la agenda se recuerdan hasta 30 s por estado,
   y se recalculan apenas cambia el ledger (marcar una tarea, cerrar el día…) */
const LG_CACHE = new WeakMap();
function lg_huella(s) { const L = (s.gamif && s.gamif.ledger) || []; let t = 0; for (const m of L) t = (t + (m.ts || 0) + (m.anulado ? 7 : 0)) % 2147483647; return L.length + ":" + t; }
function lg_memo(s, clave, fn) {
  let m = LG_CACHE.get(s); if (!m) { m = new Map(); LG_CACHE.set(s, m); }
  const c = m.get(clave), ahora = Date.now(), h = lg_huella(s);
  if (c && c.h === h && ahora - c.t < 30000) return c.v;
  const v = fn(s); m.set(clave, { t: ahora, h, v }); return v;
}
function lg_dias(s) { return Object.entries(s.ritual.dias || {}).filter(([, r]) => r); }
function lg_hora(ts) { const d = new Date(ts); return d.getHours() + d.getMinutes() / 60; }
function lg_mismoDia(ts, iso) { return !!ts && isoLocal(new Date(ts)) === iso; }
function lg_alba(s) { return lg_dias(s).filter(([iso, r]) => r.hecho && r.abiertoTs && lg_mismoDia(r.abiertoTs, iso) && lg_hora(r.abiertoTs) < 7).length; }
function lg_noche(s) { return lg_dias(s).filter(([iso, r]) => r.cerrado && r.cerradoTs && lg_mismoDia(r.cerradoTs, iso) && lg_hora(r.cerradoTs) < 22).length; }
function lg_buho(s) { return lg_dias(s).some(([iso, r]) => r.cerrado && r.cerradoTs && lg_mismoDia(r.cerradoTs, iso) && lg_hora(r.cerradoTs) >= 23 + 55 / 60); }
function lg_express(s) { return lg_dias(s).filter(([, r]) => r.cerrado && r.express && r.express.cierre).length; }
function lg_tareas(s, filtro) { let n = 0; Object.keys(agendaDias(s)).forEach(iso => { n += tareasDelDia(iso, s).filter(filtro).length; }); return n; }
function lg_delegadas(s) { return lg_memo(s, "delegadas", x => lg_tareas(x, t => estadoTarea(t) === "delegada")); }
function lg_soltadas(s) { return lg_memo(s, "soltadas", x => lg_tareas(x, t => estadoTarea(t) === "soltada")); }
function lg_domadas(s) { return lg_memo(s, "domadas", x => lg_tareas(x, t => estadoTarea(t) === "hecha" && (t.migraciones || 0) >= CRONICA)); }
function lg_libros(s) { return (s.lecturas || []).filter(l => l.estado === "terminado").length; }
function lg_compartidos(s) { return ((s.gamif && s.gamif.ledger) || []).filter(m => m && !m.anulado && String(m.id).startsWith("hito:compartir:")).length; }
/* Bandeja Cero: una semana pasada con 5+ tareas, todas resueltas y ninguna arrastrada de días anteriores */
function lg_bandejaCero(s) { return lg_memo(s, "bandeja", lg_bandejaCero_); }
function lg_bandejaCero_(s) {
  let l = agLunes(agSumar(todayISO(), -7));
  for (let i = 0; i < 12; i++, l = agSumar(l, -7)) {
    const ts = Array.from({ length: 7 }, (_, k) => tareasDelDia(agSumar(l, k), s)).flat();
    if (ts.length >= 5 && ts.every(t => estadoTarea(t) !== "pendiente" && !(t.migraciones > 0))) return true;
  }
  return false;
}
/* Capacidad Real: 5 días seguidos planificando dentro de tu capacidad y cumpliéndolo todo */
function lg_capacidadReal(s) { return lg_memo(s, "capacidad", lg_capacidadReal_); }
function lg_capacidadReal_(s) {
  let seguidos = 0;
  for (let b = 120; b >= 1; b--) {
    const iso = agSumar(todayISO(), -b), d = tmDia(s, iso), cap = tmCapacidad(s, iso);
    const ok = cap && d.planificadas > 0 && d.hechas >= d.planificadas && d.planificadas <= Math.ceil(cap.hechasProm) + 1;
    seguidos = ok ? seguidos + 1 : 0;
    if (seguidos >= 5) return true;
  }
  return false;
}
function lg_habitoHierro(s) {
  const n = {};
  Object.values(s.habitos.log || {}).forEach(mes => Object.entries(mes || {}).forEach(([hid, dias]) => { n[hid] = (n[hid] || 0) + Object.keys(dias || {}).length; }));
  return Object.values(n).some(x => x >= 66);
}
/* Todo Verde: un mes ya terminado con todos tus hábitos en su objetivo */
function lg_todoVerde(s) { return lg_memo(s, "verde", lg_todoVerde_); }
function lg_todoVerde_(s) {
  const h = agDate(todayISO());
  for (let i = 1; i <= 14; i++) {
    const d = new Date(h.getFullYear(), h.getMonth() - i, 1), desde = isoLocal(d), hasta = isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const hs = (s.habitos.defs || []).filter(x => hmActivo(x) && hmCreado(x) <= desde);
    if (hs.length && hs.every(x => cumplimiento(x, desde, hasta, s).pct === 100)) return true;
  }
  return false;
}
function lg_mesPerfecto(s) { return aniosConDatos(s).some(y => datosAnio(s, y).metas.mensuales.some(m => (m || []).length > 0 && m.every(o => o.done))); }
function lg_mesesAhorro(s) {
  let n = 0;
  aniosConDatos(s).forEach(y => datosAnio(s, y).finanzas.meses.forEach(m => {
    const meta = (m && m.metaAhorro) || s.finanzas.metaMensual || 0;
    if (m && meta > 0 && (m.ingreso || m.gasto) && (m.ingreso || 0) - (m.gasto || 0) >= meta) n++;
  }));
  return n;
}
function lg_metaAnual(s) { return aniosConDatos(s).some(y => { const D = datosAnio(s, y), meta = D.finanzas.metaAnual; return meta > 0 && D.finanzas.meses.reduce((a, m) => a + ((m.ingreso || 0) - (m.gasto || 0)), 0) >= meta; }); }
function lg_buenAmigo(s) { const mes = todayISO().slice(0, 7); return ((s.vida && s.vida.relaciones) || []).filter(p => String(p.ultimoContacto || "").startsWith(mes)).length >= 10; }
function lg_anioConRumbo(s) {
  const T = s.ritual.trimestres || {};
  return [...new Set(Object.keys(T).map(k => k.slice(0, 4)))].some(y => [1, 2, 3, 4].every(q => T[`${y}-Q${q}`] && T[`${y}-Q${q}`].cierre));
}
function lg_primerDia(s) { const ks = lg_dias(s).filter(([, r]) => r.hecho).map(([k]) => k).sort(); return ks[0] || null; }
function lg_aniversario(s) { const p = lg_primerDia(s); return !!p && agDiff(p, todayISO()) >= 365; }
function lg_anioNuevo(s) { return lg_dias(s).some(([iso, r]) => r.hecho && iso.endsWith("-01-01")); }
/* Remontada: una racha de 7+ días cerrados después de haber perdido otra de 3+ */
function lg_remontada(s) {
  const cerr = new Set(lg_dias(s).filter(([, r]) => r.cerrado).map(([k]) => k));
  if (cerr.size < 10) return false;
  const ks = [...cerr].sort();
  let run = 0, previa = false, prev = null;
  for (const iso of ks) {
    let seguido = prev && agSumar(prev, 1) === iso;
    if (!seguido && prev) { let d = agSumar(prev, 1); while (d < iso && diaCubierto(s, d)) d = agSumar(d, 1); seguido = d === iso; }
    if (seguido) run++; else { if (run >= 3) previa = true; run = 1; }
    if (run >= 7 && previa) return true;
    prev = iso;
  }
  return false;
}

/* -------- Insignias nuevas -------- */
const MEDALLAS = { b: { n: "Bronce", ico: "🥉" }, p: { n: "Plata", ico: "🥈" }, o: { n: "Oro", ico: "🥇" } };
/* Series con niveles: [umbral, recompensa] para bronce, plata y oro */
const SERIES = [
  { id: "alba", icon: "🌅", nombre: "Alba", desc: n => `Abre tu día antes de las 7:00 (${n} veces)`, metrica: lg_alba, niveles: [[10, 50], [30, 120], [100, 300]] },
  { id: "noche-serena", icon: "🌙", nombre: "Noche Serena", desc: n => `Cierra tu día antes de las 22:00 (${n} veces)`, metrica: lg_noche, niveles: [[20, 50], [60, 120], [150, 300]] },
  { id: "delegador", icon: "@", nombre: "Buen Delegador", desc: n => `Delega ${n} tareas`, metrica: lg_delegadas, niveles: [[10, 40], [30, 100], [100, 250]] },
  { id: "elefante-domado", icon: "🎪", nombre: "Elefante Domado", desc: n => n === 1 ? "Completa una tarea que habías postergado 3 veces o más" : `Doma ${n} tareas postergadas 3 veces o más`, metrica: lg_domadas, niveles: [[1, 50], [5, 150], [20, 400]] },
  { id: "ahorrador", icon: "🐷", nombre: "Ahorrador Constante", desc: n => `${n} meses cumpliendo tu meta de ahorro`, metrica: lg_mesesAhorro, niveles: [[3, 100], [6, 250], [12, 600]] },
  { id: "biblioteca", icon: "📚", nombre: "Biblioteca", desc: n => `Termina ${n} libros`, metrica: lg_libros, niveles: [[6, 80], [12, 200], [24, 500]] },
  { id: "enfocado", icon: "⏱️", nombre: "Enfocado", desc: n => `Completa ${n} sesiones del modo enfoque`, metrica: s => typeof sesionesCompletas === "function" ? sesionesCompletas(s) : 0, niveles: [[10, 60], [50, 150], [200, 400]] },
];
/* La insignia de bronce de Elefante Domado es la de siempre (id "elefante-domado") */
function idNivel(serie, k) { return k === 0 && serie.id === "elefante-domado" ? "elefante-domado" : `${serie.id}-${"bpo"[k]}`; }
const LOGROS = [
  { id: "centenario", icon: "💯", nombre: "Centenario", desc: "100 días cerrados seguidos", reward: 300, check: () => computeClosedStreak() >= 100 },
  { id: "anio-rumbo", icon: "🗓️", nombre: "Año con Rumbo", desc: "Cierra los 4 trimestres de un año", reward: 1000, check: lg_anioConRumbo },
  { id: "salvavidas", icon: "⚡", nombre: "Salvavidas", desc: "Cierra en modo Express un día difícil y mantén la racha (5 veces)", reward: 60, check: s => lg_express(s) >= 5 },
  { id: "bandeja-cero", icon: "📥", nombre: "Bandeja Cero", desc: "Una semana completa sin pendientes de días anteriores", reward: 120, check: lg_bandejaCero },
  { id: "soltar", icon: "✕", nombre: "Soltar es Avanzar", desc: "Suelta 10 tareas a conciencia", reward: 60, check: s => lg_soltadas(s) >= 10 },
  { id: "capacidad-real", icon: "🎯", nombre: "Capacidad Real", desc: "Planifica dentro de tu capacidad y cúmplela 5 días seguidos", reward: 150, check: lg_capacidadReal },
  { id: "habito-hierro", icon: "🧱", nombre: "Hábito de Hierro", desc: "Cumple un mismo hábito 66 días", reward: 300, check: lg_habitoHierro },
  { id: "todo-verde", icon: "🟩", nombre: "Todo Verde", desc: "Un mes con todos tus hábitos en su objetivo", reward: 250, check: lg_todoVerde },
  { id: "mes-perfecto", icon: "🏁", nombre: "Mes Perfecto", desc: "Cumple el 100% de tus objetivos del mes", reward: 300, check: lg_mesPerfecto },
  { id: "meta-anual", icon: "🏆", nombre: "Meta Anual", desc: "Llega al 100% de tu meta de ahorro del año", reward: 500, check: lg_metaAnual },
  { id: "buen-amigo", icon: "🤝", nombre: "Buen Amigo", desc: "Ponte al día con 10 personas de Relaciones en un mes", reward: 100, check: lg_buenAmigo },
  { id: "embajador", icon: "📤", nombre: "Embajador", desc: "Comparte tu mes 3 veces", reward: 100, check: s => lg_compartidos(s) >= 3 },
  // Secretas: se ven como ??? hasta ganarlas
  { id: "buho", icon: "🦉", nombre: "Búho", desc: "Cerraste tu día entre las 23:55 y las 23:59", reward: 77, secreta: true, check: lg_buho },
  { id: "aniversario", icon: "🎂", nombre: "Aniversario", desc: "Cumpliste un año usando Rumbo", reward: 365, secreta: true, check: lg_aniversario },
  { id: "anio-nuevo", icon: "🎇", nombre: "Año Nuevo con Rumbo", desc: "Abriste tu día el 1 de enero", reward: 101, secreta: true, check: lg_anioNuevo },
  { id: "remontada", icon: "🔁", nombre: "Remontada", desc: "Volviste a una racha de 7 días después de haberla perdido", reward: 70, secreta: true, check: lg_remontada },
];
/* Registrar en BADGES (una vez): logros simples y cada nivel de las series */
(function registrarLogros() {
  if (typeof BADGES === "undefined" || BADGES.some(b => b.id === "centenario")) return;
  const i = BADGES.findIndex(b => b.id === "elefante-domado");
  if (i >= 0) BADGES.splice(i, 1);   // pasa a ser el bronce de su serie
  LOGROS.forEach(b => BADGES.push(b));
  SERIES.forEach(se => se.niveles.forEach(([n, reward], k) => BADGES.push({
    id: idNivel(se, k), icon: se.icon, nombre: se.nombre + (k ? " · " + MEDALLAS["bpo"[k]].n : ""), desc: se.desc(n), reward, serie: se.id, nivel: k,
    check: s => { try { return se.metrica(s) >= n; } catch (e) { return false; } },
  })));
})();

/* Compartir (informe del mes/año): hito para la insignia Embajador */
function registrarCompartido() {
  if (typeof ledgerRegistrar !== "function") return;
  ledgerRegistrar(STATE, "hito:compartir:" + uid(), 0, 0, "Compartiste tu mes");
  saveState();
}

/* Tarjetas de insignias para Recompensas: las series muestran su nivel y la meta siguiente */
function insigniasHtml(g) {
  const tiene = id => g.badges.includes(id);
  const destacar = (id) => `<button class="btn-ghost btn-block mt-8" data-action="badge-destacar" data-id="${id}">${g.equipped.insignia === id ? "★ Destacada" : "Destacar"}</button>`;
  const simple = b => {
    const earned = tiene(b.id), oculta = b.secreta && !earned;
    return `<div class="card badge-card ${earned ? "" : "is-locked"}" style="text-align:center">
      <div style="font-size:32px;line-height:1">${oculta ? "❔" : b.icon}</div>
      <div class="card__title" style="font-size:14px;margin-top:6px">${oculta ? "???" : b.nombre}</div>
      <div class="text-xs muted" style="margin-top:4px">${oculta ? "Insignia secreta" : b.desc}</div>
      ${earned ? destacar(b.id) : `<div class="chip mt-8" style="display:inline-block">🔒 +${b.reward} ⭐</div>`}
    </div>`;
  };
  const serie = se => {
    const ids = se.niveles.map((_, k) => idNivel(se, k));
    const k = ids.reduce((a, id, i) => (tiene(id) ? i : a), -1);
    const sig = se.niveles[k + 1], valor = (() => { try { return se.metrica(STATE); } catch (e) { return 0; } })();
    const med = k >= 0 ? MEDALLAS["bpo"[k]] : null;
    return `<div class="card badge-card ${k >= 0 ? "" : "is-locked"}" style="text-align:center">
      <div style="font-size:32px;line-height:1">${se.icon}${med ? `<span class="badge-med">${med.ico}</span>` : ""}</div>
      <div class="card__title" style="font-size:14px;margin-top:6px">${se.nombre}${med ? ` · ${med.n}` : ""}</div>
      <div class="text-xs muted" style="margin-top:4px">${sig ? se.desc(sig[0]) : "¡Nivel máximo! 🥇"}</div>
      <div class="badge-niveles mt-8">${se.niveles.map(([n], i) => `<span class="${i <= k ? "on" : ""}" title="${MEDALLAS["bpo"[i]].n}: ${n}">${MEDALLAS["bpo"[i]].ico}</span>`).join("")}</div>
      ${sig ? `<div class="bar mt-8"><div class="bar__fill" style="width:${Math.min(100, Math.round((valor / sig[0]) * 100))}%"></div></div>
        <div class="text-xs muted mt-8">${Math.min(valor, sig[0])}/${sig[0]} · +${sig[1]} ⭐</div>` : ""}
      ${k >= 0 ? destacar(ids[k]) : ""}
    </div>`;
  };
  const simples = BADGES.filter(b => !b.serie && !b.secreta), secretas = BADGES.filter(b => b.secreta);
  return `${simples.map(simple).join("")}${SERIES.map(serie).join("")}${secretas.map(simple).join("")}`;
}
function totalInsignias() { return BADGES.length; }

/* -------- Títulos que piden una insignia -------- */
const TITULOS_LOGRO = [
  { id: "tit-madrugador", nombre: "El Madrugador", icon: "🌅", costo: 300, requiere: "madrugador" },
  { id: "tit-estratega", nombre: "Estratega", icon: "♟️", costo: 400, requiere: "estratega" },
  { id: "tit-domador", nombre: "Domador de Elefantes", icon: "🎪", costo: 500, requiere: "elefante-domado-p" },
  { id: "tit-lector", nombre: "Lector Voraz", icon: "📚", costo: 400, requiere: "biblioteca-p" },
];
(function registrarTitulos() { if (typeof TITULOS !== "undefined" && !TITULOS.some(t => t.id === "tit-madrugador")) TITULOS.push(...TITULOS_LOGRO); })();
function requisitoTitulo(it) { return !it.requiere || (STATE.gamif.badges || []).includes(it.requiere); }
function nombreRequisito(it) { const b = findBadge(it.requiere); return b ? b.nombre : it.requiere; }

/* ============================================================
   🐘 TU ELEFANTE
   ============================================================ */
const ETAPAS_ELEFANTE = [
  { min: 0, nombre: "Cría", tam: 44 },
  { min: 900, nombre: "Joven", tam: 58 },
  { min: 4000, nombre: "Adulto", tam: 72 },
  { min: 12000, nombre: "Sabio", tam: 84, corona: true },
];
const ACCESORIOS = [
  { id: "acc-gorro", icon: "🧢", nombre: "Gorro", costo: 150, pos: "cabeza" },
  { id: "acc-bufanda", icon: "🧣", nombre: "Bufanda", costo: 200, pos: "cuello" },
  { id: "acc-lentes", icon: "🕶️", nombre: "Lentes", costo: 250, pos: "cara" },
  { id: "acc-mochila", icon: "🎒", nombre: "Mochila", costo: 400, pos: "lomo" },
];
function etapaElefante(xp) {
  let e = ETAPAS_ELEFANTE[0], sig = null;
  ETAPAS_ELEFANTE.forEach((x, i) => { if (xp >= x.min) { e = x; sig = ETAPAS_ELEFANTE[i + 1] || null; } });
  return { etapa: e, sig, idx: ETAPAS_ELEFANTE.indexOf(e) };
}
/* Con sueño: ayer y hoy sin cerrar (y ya tenía historia). Nunca retrocede de etapa. */
function elefanteConSueno(s) {
  s = s || STATE;
  const hoy = todayISO(), ayer = agSumar(hoy, -1), c = iso => !!(s.ritual.dias[iso] && s.ritual.dias[iso].cerrado) || diaCubierto(s, iso);
  return Object.values(s.ritual.dias || {}).some(r => r && r.cerrado) && !c(hoy) && !c(ayer) && !c(agSumar(hoy, -2));
}
function accesoriosPuestos() { const eq = STATE.gamif.equipped || {}; return (Array.isArray(eq.acc) ? eq.acc : []).filter(id => isOwned(id)); }
function elefanteHtml(op) {
  op = op || {};
  const { etapa } = etapaElefante(STATE.gamif.xp || 0), sueno = elefanteConSueno();
  const tam = op.tam || etapa.tam, acc = op.acc || accesoriosPuestos();
  const pieza = id => { const a = ACCESORIOS.find(x => x.id === id); return a ? `<span class="ele-acc ele-acc--${a.pos}">${a.icon}</span>` : ""; };
  return `<div class="ele ${sueno ? "is-sueno" : ""}" style="--t:${tam}px" aria-label="Tu elefante: ${etapa.nombre}${sueno ? ", con sueño" : ""}">
    <span class="ele-cuerpo">🐘</span>${etapa.corona ? '<span class="ele-acc ele-acc--corona">👑</span>' : ""}${acc.map(pieza).join("")}${sueno ? '<span class="ele-zz">💤</span>' : ""}</div>`;
}
function renderElefanteCard() {
  const xp = STATE.gamif.xp || 0, { etapa, sig } = etapaElefante(xp), sueno = elefanteConSueno();
  const prog = sig ? Math.min(100, Math.round(((xp - etapa.min) / (sig.min - etapa.min)) * 100)) : 100;
  return `<div class="card ele-card" data-tour="elefante"><div class="row" style="gap:16px;align-items:center">
    ${elefanteHtml()}
    <div style="flex:1;min-width:0"><div class="card__title" style="font-size:15px">🐘 Tu elefante · ${etapa.nombre}${etapa.corona ? " 👑" : ""}</div>
      <div class="text-xs muted mt-8">${sueno ? "Tiene sueño: cierra tu día para despertarlo. Nunca pierde lo que creció." : sig ? `Crece con tu constancia: ${sig.nombre} a los ${sig.min.toLocaleString("es-CL")} XP.` : "Llegó a su última etapa. ¡Sabio como tú!"}</div>
      ${sig ? `<div class="bar mt-8"><div class="bar__fill" style="width:${prog}%"></div></div>` : ""}
      <button class="btn-ghost mt-8" data-action="elefante-open" style="padding:4px 10px">🎒 Accesorios</button></div></div></div>`;
}
function openElefante() {
  const puestos = accesoriosPuestos();
  openModal("🐘 Tu elefante", `
    <div style="display:grid;place-items:center;padding:8px 0 4px">${elefanteHtml({ tam: 96 })}</div>
    <p class="text-sm soft" style="text-align:center">Nace como cría y cambia de etapa con tu XP: se gana, no se compra. Lo que sí se compra son sus accesorios.</p>
    <div class="grid grid-2 mt-16">${ACCESORIOS.map(a => {
      const tiene = isOwned(a.id), on = puestos.includes(a.id);
      return `<div class="card" style="padding:12px"><div class="row" style="gap:8px"><span style="font-size:24px">${a.icon}</span><b class="text-sm" style="flex:1">${a.nombre}</b></div>
        ${tiene ? `<button class="btn ${on ? "btn--soft" : "btn--cian"} btn-block mt-8" data-action="acc-toggle" data-id="${a.id}">${on ? "✓ Puesto — quitar" : "Ponérselo"}</button>`
          : `<button class="btn btn--primary btn-block mt-8" data-action="acc-buy" data-id="${a.id}">Comprar · ${a.costo} ⭐</button>`}</div>`;
    }).join("")}</div>
    <div class="text-xs muted mt-16" style="text-align:center">${ETAPAS_ELEFANTE.map(e => `${e.nombre}${e.min ? " · " + e.min.toLocaleString("es-CL") + " XP" : ""}`).join(" → ")}</div>`);
}
function comprarAccesorio(id) {
  const a = ACCESORIOS.find(x => x.id === id); if (!a || isOwned(id)) return;
  recalcGamif(STATE);
  if (STATE.gamif.puntos < a.costo) return toast("Te faltan " + (a.costo - STATE.gamif.puntos) + " ⭐", true);
  if (!confirm(`¿Comprar ${a.nombre} para tu elefante por ${a.costo} ⭐?`)) return;
  const res = ledgerComprar(STATE, id, a.costo);
  if (!res.ok && !res.yaTenia) return toast("Te faltan " + res.falta + " ⭐", true);
  const eq = STATE.gamif.equipped; eq.acc = Array.isArray(eq.acc) ? eq.acc : []; if (!eq.acc.includes(id)) eq.acc.push(id);
  saveState(); updateTopbar(); rerender(); openElefante();
  toast(`${a.icon} ${a.nombre} para tu elefante`);
}
function toggleAccesorio(id) {
  const eq = STATE.gamif.equipped; eq.acc = Array.isArray(eq.acc) ? eq.acc : [];
  eq.acc = eq.acc.includes(id) ? eq.acc.filter(x => x !== id) : eq.acc.concat(id);
  saveState(); rerender(); openElefante();
}
function renderElefanteTienda() {
  return `<div class="section-title">🐘 Tu elefante <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· crece con tu XP; sus accesorios se compran</span></div>
  <div class="grid grid-2">${renderElefanteCard()}
    <div class="card"><div class="card__title" style="font-size:14px">Accesorios</div>
      <div class="row-wrap mt-8" style="gap:6px">${ACCESORIOS.map(a => `<span class="chip ${isOwned(a.id) ? "chip--cian" : ""}">${a.icon} ${a.nombre} · ${isOwned(a.id) ? "✓" : a.costo + " ⭐"}</span>`).join("")}</div>
      <button class="btn btn--soft btn-block mt-16" data-action="elefante-open">Ver y comprar accesorios</button></div></div>`;
}
