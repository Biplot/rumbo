/* ============================================================
   RUMBO · Consumibles de la Tienda (se usan y se vuelven a comprar)
   ✏️ Reabrir un día

   Datos (nunca se pierde ni se duplica nada entre dispositivos):
   · Cada COMPRA es un movimiento del ledger "consumo:<tipo>:<uid>" (delta = −costo).
   · Cada USO es un registro en gamif.usos = [{ id, tipo, fecha, hid?, ts, anulado? }]
     con id determinista ("reabrir:2026-09-23"): el mismo uso en dos dispositivos
     colapsa en uno. Se fusiona por id (gana el ts mayor).
   · Lo que tienes = compras vigentes − usos vigentes.

   Protector de racha, Día libre, Rescate de cierre y Pase de hábito se retiraron (v61):
   proteger rachas y hábitos quitaba el foco. Lo no usado se devolvió (retirarConsumibles
   en state.js); lo ya usado se sigue respetando para no cambiar rachas pasadas.
   ============================================================ */

const CONSUMIBLES = [
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
  return Math.max(0, comprasConsumible(S, tipo) - usosDe(S).filter(u => u.tipo === tipo && !u.anulado).length);
}

/* Compra un consumible (valida saldo). Devuelve { ok } | { ok:false, falta } */
function comprarConsumible(S, tipo, now) {
  S = S || STATE;
  const c = consumible(tipo); if (!c) return { ok: false };
  recalcGamif(S);
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

/* -------- Usos históricos (consumibles retirados): se respetan, no se crean nuevos -------- */
function diaLibre(S, iso) { return usoVigente(S || STATE, "libre:" + iso); }
function diaProtegido(S, iso) { return usoVigente(S || STATE, "protector:" + iso); }
/* Días que no cortan la racha de cierres sin sumar: protegidos o libres (solo del pasado) */
function diaCubierto(S, iso) { return diaLibre(S, iso) || diaProtegido(S, iso); }

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
  if (STATE.gamif.puntos < c.costo) { toast("Te faltan " + (c.costo - STATE.gamif.puntos) + " ⭐", true); return false; }
  if (!silencioso && !confirm(`¿Comprar ${c.nombre} por ${c.costo} ⭐?\nTe quedarán ${STATE.gamif.puntos - c.costo} ⭐.`)) return false;
  const res = comprarConsumible(STATE, tipo);
  if (!res.ok) { toast("Te faltan " + res.falta + " ⭐", true); return false; }
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

/* -------- Tienda -------- */
function renderUtilesTienda() {
  const card = c => {
    const n = inventario(STATE, c.id);
    return `<div class="card util-card" data-util="${c.id}">
      <div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">${c.icon}</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${c.nombre}</div>
          <div class="text-xs muted">${c.costo} ⭐ · ${n ? `<b class="hl-cian">tienes ${n}</b>` : "no tienes"}</div></div></div>
      <p class="text-sm soft mt-8">${c.desc}</p>
      <p class="text-xs muted mt-8">${c.regla}</p>
      <button class="btn btn--primary btn-block mt-8" data-action="util-buy" data-id="${c.id}">Comprar · ${c.costo} ⭐</button>
    </div>`;
  };
  return `<div class="section-title">🧰 Útiles <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· se usan y se vuelven a comprar</span></div>
    <div class="grid grid-3">${CONSUMIBLES.map(card).join("")}</div>`;
}
