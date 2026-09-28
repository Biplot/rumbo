/* ============================================================
   RUMBO · Consumibles de la Tienda (se usan y se vuelven a comprar)
   🛡️ Protector de racha · 🌴 Día libre · ⏪ Rescate de cierre · 🎟️ Pase de hábito · ✏️ Reabrir un día

   Datos (nunca se pierde ni se duplica nada entre dispositivos):
   · Cada COMPRA es un movimiento del ledger "consumo:<tipo>:<uid>" (delta = −costo).
   · Cada USO es un registro en gamif.usos = [{ id, tipo, fecha, hid?, ts, anulado? }]
     con id determinista ("protector:2026-09-23", "pase:<hábito>:2026-09-23"…):
     el mismo uso en dos dispositivos colapsa en uno. Se fusiona por id (gana el ts mayor).
   · Lo que tienes = compras vigentes − usos vigentes. No hay contador que pueda desincronizarse.
   ============================================================ */

const CONSUMIBLES = [
  { id: "protector", icon: "🛡️", nombre: "Protector de racha", costo: 150, max: 2,
    desc: "Si un día se te olvida cerrar, lo cubre y tu racha sigue. Se usa solo, al mediodía del día siguiente.",
    regla: "Máximo 2 guardados. No cubre dos días seguidos. El día cubierto no da monedas." },
  { id: "libre", icon: "🌴", nombre: "Día libre", costo: 200, anual: 10,
    desc: "Un día de descanso o vacaciones: tus hábitos diarios no cuentan y la racha queda en pausa.",
    regla: "Se reserva con anticipación (o para hoy). Hasta 10 al año. Si lo cancelas antes, vuelve a tu inventario." },
  { id: "rescate", icon: "⏪", nombre: "Rescate de cierre", costo: 100,
    desc: "Te deja cerrar el día de ayer después del mediodía, hasta las 23:59.",
    regla: "Solo el día anterior. Da la mitad de las monedas del cierre." },
  { id: "pase", icon: "🎟️", nombre: "Pase de hábito", costo: 80,
    desc: "Te saltas un hábito hoy (viaje, enfermedad) sin que baje tu cumplimiento ni corte tu racha.",
    regla: "1 por hábito a la semana. Se usa desde Hábitos." },
  { id: "reabrir", icon: "✏️", nombre: "Reabrir un día", costo: 120,
    desc: "Corriges un día ya cerrado de la última semana: tu ánimo, tus notas o lo que decidiste con tus pendientes.",
    regla: "Hasta 7 días atrás, desde Ritual → Día → Bitácora. No vuelve a dar las monedas del cierre." },
];
function consumible(tipo) { return CONSUMIBLES.find(c => c.id === tipo); }

/* -------- Inventario (derivado) -------- */
function usosDe(S) { S = S || STATE; S.gamif.usos = Array.isArray(S.gamif.usos) ? S.gamif.usos : []; return S.gamif.usos; }
function usoVigente(S, id) { const u = usosDe(S).find(x => x.id === id); return !!(u && !u.anulado); }
function comprasConsumible(S, tipo) {
  return ((S.gamif && S.gamif.ledger) || []).filter(m => m && !m.anulado && typeof m.id === "string" && m.id.startsWith("consumo:" + tipo + ":")).length;
}
function inventario(S, tipo) {
  S = S || STATE;
  // Un protector que cayó en un día que al final se cerró (sincronización tardía) se devuelve
  const cuenta = u => u.tipo === tipo && !u.anulado && !(tipo === "protector" && S.ritual && S.ritual.dias[u.fecha] && S.ritual.dias[u.fecha].cerrado);
  return Math.max(0, comprasConsumible(S, tipo) - usosDe(S).filter(cuenta).length);
}

/* Compra un consumible (valida saldo y máximo). Devuelve { ok } | { ok:false, falta } | { ok:false, max } */
function comprarConsumible(S, tipo, now) {
  S = S || STATE;
  const c = consumible(tipo); if (!c) return { ok: false };
  recalcGamif(S);
  if (c.max && inventario(S, tipo) >= c.max) return { ok: false, max: c.max };
  if ((S.gamif.puntos || 0) < c.costo) return { ok: false, falta: c.costo - (S.gamif.puntos || 0) };
  ledgerRegistrar(S, "consumo:" + tipo + ":" + uid(), -c.costo, 0, "Compra: " + c.nombre, now);
  return { ok: true };
}
/* Usa un consumible (idempotente por id). Devuelve true si quedó registrado (o ya estaba). */
function usarConsumible(S, tipo, id, datos, now) {
  S = S || STATE;
  const usos = usosDe(S), ts = now || Date.now();
  const ex = usos.find(u => u.id === id);
  if (ex && !ex.anulado) return true;
  if (inventario(S, tipo) <= 0) return false;
  if (ex) { Object.assign(ex, datos || {}, { anulado: false, ts: Math.max(ts, (ex.ts || 0) + 1) }); }
  else usos.push(Object.assign({ id, tipo, ts }, datos || {}));
  return true;
}
/* Anula un uso (solo el día libre futuro se puede cancelar): vuelve al inventario */
function anularUso(S, id, now) {
  const u = usosDe(S).find(x => x.id === id);
  if (!u || u.anulado) return false;
  u.anulado = true; u.ts = Math.max(now || Date.now(), (u.ts || 0) + 1);
  return true;
}
/* -------- Reglas por consumible -------- */
function diaLibre(S, iso) { return usoVigente(S || STATE, "libre:" + iso); }
function diaProtegido(S, iso) { return usoVigente(S || STATE, "protector:" + iso); }
function pasoHabito(S, hid, iso) { return usoVigente(S || STATE, "pase:" + hid + ":" + iso); }
/* Días que no cortan la racha de cierres sin sumar: protegidos o libres */
function diaCubierto(S, iso) { return diaLibre(S, iso) || diaProtegido(S, iso); }

/* Protector: revisa los últimos 10 días en orden. Un día sin cerrar se cubre si ya pasó
   su ventana (el mediodía del día siguiente), el anterior estaba cerrado o era libre (no protegido:
   nunca dos seguidos) y queda algún protector. Devuelve los días cubiertos ahora. */
function aplicarProtectores(S, ahora) {
  S = S || STATE;
  const now = ahora || new Date(), hoy = isoLocal(now), cubiertos = [];
  const cerrado = iso => !!(S.ritual.dias[iso] && S.ritual.dias[iso].cerrado);
  for (let b = 10; b >= 1; b--) {
    const d = agSumar(hoy, -b), prev = agSumar(d, -1);
    if (cerrado(d) || diaCubierto(S, d)) continue;
    if (b === 1 && now.getHours() < 12) continue;                 // ayer: aún se puede cerrar gratis hasta las 12
    if (!(cerrado(prev) || diaLibre(S, prev))) continue;          // no había racha que salvar
    if (diaProtegido(S, prev)) continue;                          // no cubre dos días seguidos
    if (usarConsumible(S, "protector", "protector:" + d, { fecha: d }, now.getTime())) cubiertos.push(d);
  }
  return cubiertos;
}
/* Rescate: ¿se puede rescatar ayer ahora? (abierto, sin cerrar, sin cubrir, después del mediodía) */
function rescatePosible(S, ahora) {
  S = S || STATE;
  const now = ahora || new Date();
  if (now.getHours() < 12) return null;
  const ayer = agSumar(isoLocal(now), -1), r = S.ritual.dias[ayer];
  return r && r.hecho && !r.cerrado && !diaCubierto(S, ayer) ? ayer : null;
}
/* Pase: 1 por hábito por semana ISO */
function paseDisponibleSemana(S, hid, iso) {
  const l = hmLunes(iso), dom = hmAdd(l, 6);
  return !usosDe(S).some(u => u.tipo === "pase" && !u.anulado && u.hid === hid && u.fecha >= l && u.fecha <= dom);
}
/* Día libre: cuántos quedan en el año de iso */
function libresUsadosAnio(S, anio) { return usosDe(S).filter(u => u.tipo === "libre" && !u.anulado && String(u.fecha).startsWith(anio + "-")).length; }
/* Reabrir: días cerrados de la última semana (sin hoy) */
function reabrible(S, iso, hoy) {
  hoy = hoy || todayISO();
  const r = (S || STATE).ritual.dias[iso];
  return !!(r && r.cerrado) && iso < hoy && iso >= agSumar(hoy, -7);
}

/* -------- Acciones (UI) -------- */
function comprarConsumibleUI(tipo, silencioso) {
  const c = consumible(tipo); if (!c) return false;
  recalcGamif(STATE);
  if (c.max && inventario(STATE, tipo) >= c.max) { toast(`Ya tienes ${c.max} ${c.nombre.toLowerCase()}s guardados`, true); return false; }
  if (STATE.gamif.puntos < c.costo) { toast("Te faltan " + (c.costo - STATE.gamif.puntos) + " ⭐", true); return false; }
  if (!silencioso && !confirm(`¿Comprar ${c.nombre} por ${c.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - c.costo} ⭐.`)) return false;
  const res = comprarConsumible(STATE, tipo);
  if (!res.ok) { toast(res.max ? "Llegaste al máximo" : "Te faltan " + res.falta + " ⭐", true); return false; }
  saveState(); updateTopbar();
  if (!silencioso) { toast(`${c.icon} ${c.nombre} · tienes ${inventario(STATE, tipo)}`); rerender(); }
  return true;
}
/* Tiene uno o lo compra en el momento (con confirmación) */
function asegurarConsumible(tipo) {
  if (inventario(STATE, tipo) > 0) return true;
  const c = consumible(tipo);
  recalcGamif(STATE);
  if (STATE.gamif.puntos < c.costo) { toast(`Necesitas ${c.nombre.toLowerCase()} (${c.costo} ⭐) · te faltan ${c.costo - STATE.gamif.puntos} ⭐`, true); return false; }
  if (!confirm(`No tienes ${c.nombre.toLowerCase()}. ¿Comprar uno por ${c.costo} ⭐ y usarlo ahora?`)) return false;
  return comprarConsumibleUI(tipo, true);
}
/* Al abrir la app (y al cambiar de día): protectores automáticos */
function revisarProtectores() {
  if (!STATE || !STATE.ritual) return;
  const dias = aplicarProtectores(STATE);
  if (!dias.length) return;
  saveState();
  toast(`🛡️ Usaste un protector: tu racha de ${computeClosedStreak()} ${computeClosedStreak() === 1 ? "día" : "días"} sigue viva`);
  if (typeof rerender === "function" && CURRENT_USER) { updateTopbar(); rerender(); }
}
/* Rescate: usa uno y abre el cierre de ayer */
function usarRescate() {
  const ayer = rescatePosible(STATE); if (!ayer) return toast("Ya no hay un día que rescatar", true);
  if (!asegurarConsumible("rescate")) return;
  usarConsumible(STATE, "rescate", "rescate:" + ayer, { fecha: ayer });
  saveState(); updateTopbar();
  openCierreModal(ayer);
}
function cierreEsRescate(iso) { return typeof STATE !== "undefined" && !!STATE && usoVigente(STATE, "rescate:" + iso); }
/* Monedas del cierre: la mitad si es un rescate */
function monedasCierre(iso, base) { return cierreEsRescate(iso) ? Math.round(base / 2) : base; }
/* Pase de hábito para hoy */
function usarPase(hid) {
  const h = STATE.habitos.defs.find(x => x.id === hid); if (!h) return;
  const hoy = todayISO();
  if (hmDone(h, hoy)) return toast("Ese hábito ya está cumplido hoy");
  if (!paseDisponibleSemana(STATE, hid, hoy)) return toast("Ya usaste un pase para este hábito esta semana", true);
  if (!asegurarConsumible("pase")) return;
  usarConsumible(STATE, "pase", "pase:" + hid + ":" + hoy, { fecha: hoy, hid });
  saveState(); updateTopbar(); rerender();
  toast(`🎟️ Pase usado: ${h.nombre} cuenta como cumplido hoy`);
}
/* Reabrir un día cerrado de la última semana */
function usarReabrir(iso) {
  if (!reabrible(STATE, iso)) return toast("Solo se pueden reabrir días cerrados de la última semana", true);
  if (!usoVigente(STATE, "reabrir:" + iso)) {
    if (!asegurarConsumible("reabrir")) return;
    usarConsumible(STATE, "reabrir", "reabrir:" + iso, { fecha: iso });
    saveState(); updateTopbar();
  }
  openCierreModal(iso);
}
/* Día libre: reservar o cancelar */
function openDiaLibre() {
  const hoy = todayISO(), anio = hoy.slice(0, 4);
  const reservados = usosDe(STATE).filter(u => u.tipo === "libre" && !u.anulado).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  const quedan = consumible("libre").anual - libresUsadosAnio(STATE, anio);
  openModal("🌴 Días libres", `
    <p class="text-sm soft">Ese día tus hábitos diarios no cuentan y tu racha queda en pausa: ni suma ni se corta. Tienes <b>${inventario(STATE, "libre")}</b> guardado${inventario(STATE, "libre") === 1 ? "" : "s"} · te quedan <b>${quedan}</b> este año.</p>
    <div class="field mt-16"><label>Reservar un día</label>
      <div class="row" style="gap:8px"><input class="input" type="date" id="libre-fecha" min="${hoy}" max="${agSumar(hoy, 180)}" value="${agSumar(hoy, 1)}">
        <button class="btn btn--primary" data-action="libre-reservar">Reservar${inventario(STATE, "libre") ? "" : " · 200 ⭐"}</button></div></div>
    ${reservados.length ? `<div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px">Tus días libres</div>
      ${reservados.map(u => `<div class="item-row"><div class="item-row__main"><div class="item-row__title">🌴 ${escapeHtml(fechaCortaMes(u.fecha))}</div></div>
        ${u.fecha > hoy ? `<button class="btn-ghost" data-action="libre-cancelar" data-fecha="${u.fecha}">Cancelar</button>` : `<span class="chip">${u.fecha === hoy ? "hoy" : "usado"}</span>`}</div>`).join("")}` : ""}`);
}
function reservarDiaLibre() {
  const iso = (document.getElementById("libre-fecha") || {}).value, hoy = todayISO();
  if (!iso || iso < hoy) return toast("Elige hoy o un día futuro", true);
  if (diaLibre(STATE, iso)) return toast("Ese día ya es libre");
  if (STATE.ritual.dias[iso] && STATE.ritual.dias[iso].cerrado) return toast("Ese día ya está cerrado", true);
  if (libresUsadosAnio(STATE, iso.slice(0, 4)) >= consumible("libre").anual) return toast("Ya usaste tus 10 días libres de ese año", true);
  if (!asegurarConsumible("libre")) return;
  usarConsumible(STATE, "libre", "libre:" + iso, { fecha: iso });
  saveState(); updateTopbar(); rerender(); openDiaLibre();
  toast("🌴 Día libre reservado: " + fechaCortaMes(iso));
}
function cancelarDiaLibre(iso) {
  if (iso <= todayISO()) return toast("Solo se cancelan días libres futuros", true);
  anularUso(STATE, "libre:" + iso);
  saveState(); updateTopbar(); rerender(); openDiaLibre();
  toast("Día libre cancelado · vuelve a tu inventario");
}

/* -------- Piezas de interfaz -------- */
function renderUtilesTienda() {
  const card = c => {
    const n = inventario(STATE, c.id), lleno = c.max && n >= c.max;
    const extra = c.id === "libre" ? `<button class="btn-ghost btn-block mt-8" data-action="libre-open">🌴 Reservar o ver mis días libres</button>` : "";
    return `<div class="card util-card" data-util="${c.id}">
      <div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">${c.icon}</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${c.nombre}</div>
          <div class="text-xs muted">${c.costo} ⭐ · ${n ? `<b class="hl-cian">tienes ${n}</b>` : "no tienes"}${c.max ? ` (máx. ${c.max})` : ""}</div></div></div>
      <p class="text-sm soft mt-8">${c.desc}</p>
      <p class="text-xs muted mt-8">${c.regla}</p>
      <button class="btn ${lleno ? "btn--soft" : "btn--primary"} btn-block mt-8" data-action="util-buy" data-id="${c.id}" ${lleno ? "disabled" : ""}>${lleno ? "Máximo guardado" : "Comprar · " + c.costo + " ⭐"}</button>
      ${extra}
    </div>`;
  };
  return `<div class="section-title">🧰 Útiles <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· se usan y se vuelven a comprar</span></div>
    <div class="grid grid-3">${CONSUMIBLES.map(card).join("")}</div>`;
}
/* Inicio: hoy es día libre */
function renderDiaLibreHero() {
  return `<div class="card hero-focus" style="margin-bottom:20px"><div class="flex-between" style="flex-wrap:wrap;gap:16px">
    <div><div class="hero-focus__title">🌴 Hoy es tu día libre</div>
      <div class="text-sm muted" style="margin-top:4px">Descansa: tus hábitos diarios no cuentan y tu racha queda en pausa. Si igual quieres, puedes abrir tu día.</div></div>
    <button class="btn btn--soft" data-action="day-open">Abrir mi día igual</button></div></div>`;
}
/* Inicio: ayer quedó sin cerrar y ya pasó el mediodía → rescate */
function renderRescateCard() {
  const ayer = rescatePosible(STATE); if (!ayer) return "";
  const n = inventario(STATE, "rescate"), d = new Date(ayer + "T12:00:00");
  return `<div class="card" style="margin-bottom:16px;border:1px solid var(--coral);background:var(--coral-soft)">
    <div class="flex-between" style="flex-wrap:wrap;gap:12px">
      <div><div class="card__title">⏪ ¿Rescatas el ${escapeHtml(d.toLocaleDateString("es-CL", { weekday: "long" }))}?</div>
        <div class="text-sm soft mt-8">Ayer quedó sin cerrar. Con un rescate lo cierras hasta las 23:59 (mitad de monedas) y tu racha sigue.</div></div>
      <button class="btn btn--primary" data-action="rescate-usar">${n ? `Usar rescate (tienes ${n})` : "Rescatar · 100 ⭐"}</button></div></div>`;
}
