/* ============================================================
   RUMBO · Consumibles de la Tienda (se usan y se vuelven a comprar)
   ✏️ Reabrir un día · 🌅 Abrir un día olvidado

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
    regla: "Hasta 7 días atrás. Toca el día en Ritual → Día («Reabrir un día») o en tu Diario; se paga al usarlo. No vuelve a dar las ⭐ del cierre.",
    usar: "reabrir-hoja", usarTxt: "✏️ Elegir el día" },
  { id: "abrir", icon: "🌅", nombre: "Abrir un día olvidado", costo: 120,
    desc: "¿Se te olvidó abrir un día de la última semana? Lo abres ahora: anotas tu misión, tu primer bocado y tu energía, y enseguida lo cierras.",
    regla: "Hasta 7 días atrás, en Ritual → Día («Abrir o reabrir un día»); se paga al usarlo. No da las ⭐ de la apertura (al cerrarlo, sí las del cierre) y cuenta para tus rachas.",
    usar: "reabrir-hoja", usarTxt: "🌅 Elegir el día" },
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
  if (!silencioso && !confirm(`¿Comprar ${c.nombre} por ${c.costo} estrellas?\nTe quedarán ${STATE.gamif.puntos - c.costo}.`)) return false;
  const res = comprarConsumible(STATE, tipo);
  if (!res.ok) { toast("Te faltan " + res.falta + " ⭐", true); return false; }
  saveState(); updateTopbar();
  if (!silencioso) { toast(`${c.icon} ${c.nombre} · tienes ${inventario(STATE, tipo)}`); rerender(); }
  return true;
}
/* Tiene uno o lo compra en el momento (con confirmación). pregunta: qué se hará con él */
function asegurarConsumible(tipo, pregunta) {
  if (inventario(STATE, tipo) > 0) return true;
  const c = consumible(tipo);
  recalcGamif(STATE);
  if (STATE.gamif.puntos < c.costo) { toast(`${c.nombre} cuesta ${c.costo} ⭐ · te faltan ${c.costo - STATE.gamif.puntos} ⭐`, true); return false; }
  if (!confirm(`${pregunta || "¿Comprar " + c.nombre.toLowerCase() + " y usarlo ahora?"}\nCuesta ${c.costo} ⭐ · te quedarán ${STATE.gamif.puntos - c.costo}.`)) return false;
  return comprarConsumibleUI(tipo, true);
}
/* ¿Ya pagaste por ese día? (reabrirlo o abrirlo): entonces se edita gratis */
function diaPagado(S, iso) { return usoVigente(S, "reabrir:" + iso) || usoVigente(S, "abrir:" + iso); }
/* Reabrir un día cerrado de la última semana: un toque en el día, una confirmación y se abre su cierre */
function usarReabrir(iso) {
  if (!reabrible(STATE, iso)) return toast("Solo se pueden reabrir días cerrados de la última semana", true);
  if (!diaPagado(STATE, iso)) {
    if (!asegurarConsumible("reabrir", `¿Reabrir el ${reabrirFechaTxt(iso)} para corregir su cierre?`)) return;
    usarConsumible(STATE, "reabrir", "reabrir:" + iso, { fecha: iso });
    saveState(); updateTopbar();
  }
  openCierreModal(iso);
}
function reabrirFechaTxt(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

/* -------- 🌅 Abrir un día olvidado --------
   Un día de los 7 anteriores que no abriste (ni se puede cerrar gratis por la holgura). Nunca antes de que
   existiera la cuenta (settings.alta, bienvenida.js). No da las ⭐ de la apertura; queda marcado tarde: true. */
function abrible(S, iso, hoy) {
  S = S || STATE; hoy = hoy || todayISO();
  const r = S.ritual.dias[iso], alta = typeof cuentaAlta === "function" ? cuentaAlta(S) : null;
  return !(r && r.hecho) && iso < hoy && iso >= agSumar(hoy, -7) && !(alta && iso < alta);
}
function usarAbrir(iso) {
  if (!abrible(STATE, iso)) return toast("Solo se pueden abrir días de la última semana que no abriste", true);
  if (!usoVigente(STATE, "abrir:" + iso)) {
    if (!asegurarConsumible("abrir", `¿Abrir el ${reabrirFechaTxt(iso)}, que se te olvidó?`)) return;
    usarConsumible(STATE, "abrir", "abrir:" + iso, { fecha: iso });
    saveState(); updateTopbar();
  }
  openAperturaTarde(iso);
}
let APERTURA_TARDE = null;
/* La apertura de un día que ya pasó: lo justo para recordarlo (sin tareas: ese día ya pasó) */
function openAperturaTarde(iso) {
  APERTURA_TARDE = iso;
  const r = STATE.ritual.dias[iso] || {};
  openModal("Abrir el " + reabrirFechaTxt(iso), `
    <p class="reabrir-aviso">🌅 Se te olvidó abrirlo: anota lo que tenías en mente ese día y luego ciérralo. No da las ⭐ de la apertura.</p>
    <div class="field"><label>🎯 Tu misión de ese día</label><input class="input" id="at-mision" value="${escapeAttr(r.mision || "")}" placeholder="Lo más importante que querías lograr"></div>
    <div class="field"><label>${BOCADO.emoji} Tu primer bocado <span class="text-xs muted">(opcional)</span></label><input class="input" id="at-sapo" value="${escapeAttr(r.sapo || "")}" placeholder="La tarea que más movía la aguja"></div>
    <div class="field"><label>⚡ Tu energía al empezar</label>
      ${elEscala("at-energia", r.energia || 3, { ico: "rayo", etiquetas: ENERGIA_ETI, label: "Tu energía al empezar, de 1 a 5" })}</div>
    <div class="modal__cta"><button class="btn btn--primary btn-block" data-action="apertura-tarde-save">Abrirlo y seguir al cierre</button></div>`);
}
function saveAperturaTarde() {
  const iso = APERTURA_TARDE;
  if (!iso || !(abrible(STATE, iso) || (STATE.ritual.dias[iso] || {}).tarde) || !usoVigente(STATE, "abrir:" + iso)) return toast("Ese día ya no se puede abrir", true);
  const prev = STATE.ritual.dias[iso] || {};
  STATE.ritual.dias[iso] = Object.assign({}, prev, {
    hecho: true, tarde: true, mision: val("at-mision"), sapo: val("at-sapo"),
    energia: parseNum(val("at-energia")) || prev.energia || 3, ts: Date.now(),
  });
  APERTURA_TARDE = null;
  saveState(); updateTopbar(); rerender();
  toast("🌅 Día abierto · ahora ciérralo");
  openCierreModal(iso);
}

/* -------- Dónde se usan: los 7 días anteriores a hoy --------
   estado: "editar" (cerrado y ya pagado: se edita gratis) | "reabrir" (cerrado) | "cerrar" (abierto sin cerrar, o
   sin abrir pero usado dentro de la holgura: se cierra gratis) | "abrir" (se te olvidó abrirlo) | "nada" (antes de tu cuenta) */
function reabrirDias(S, hoy) {
  S = S || STATE; hoy = hoy || todayISO();
  const out = [];
  for (let b = 7; b >= 1; b--) {
    const iso = agSumar(hoy, -b), r = S.ritual.dias[iso];
    const estado = reabrible(S, iso, hoy) ? (diaPagado(S, iso) ? "editar" : "reabrir")
      : r && r.hecho ? "cerrar"
      : typeof puedeCerrarDia === "function" && typeof STATE !== "undefined" && S === STATE && puedeCerrarDia(iso) ? "cerrar"
      : abrible(S, iso, hoy) ? "abrir" : "nada";
    out.push({ iso, estado });
  }
  return out;
}
/* Texto del botón para un día cerrado (Diario) */
function reabrirBotonTxt(iso) {
  if (diaPagado(STATE, iso)) return "✏️ Editar el cierre";
  return inventario(STATE, "reabrir") > 0 ? "✏️ Reabrir este día" : `✏️ Reabrir este día · ${consumible("reabrir").costo} ⭐`;
}
const REABRIR_EST = {
  reabrir: { ico: "🌙", txt: "cerrado: tócalo para reabrirlo" },
  editar: { ico: "✏️", txt: "ya pagado: edítalo gratis" },
  abrir: { ico: "🌅", txt: "se te olvidó abrirlo: ábrelo" },
  cerrar: { ico: "⏳", txt: "sin cerrar: ciérralo gratis" },
  nada: { ico: "·", txt: "antes de tu cuenta" },
};
/* La tira de la semana: cada día es un botón */
function reabrirTiraHtml(dias) {
  dias = dias || reabrirDias();
  return `<div class="reabrir-tira" role="group" aria-label="Tus últimos 7 días">${dias.map(({ iso, estado }) => {
    const d = new Date(iso + "T12:00:00"), e = REABRIR_EST[estado];
    const dow = DIAS_SEMANA[(d.getDay() + 6) % 7].slice(0, 3);
    const aria = `${reabrirFechaTxt(iso)}, ${e.txt}`;
    const dentro = `<small>${dow}</small><b>${d.getDate()}</b><span aria-hidden="true">${e.ico}</span>`;
    if (estado === "nada") return `<span class="reabrir-tira__d is-nada" title="${escapeAttr(aria)}" aria-label="${escapeAttr(aria)}">${dentro}</span>`;
    const accion = estado === "cerrar" ? `data-action="day-close" data-date="${iso}"` : estado === "abrir" ? `data-action="abrir-dia" data-iso="${iso}"` : `data-action="reabrir-dia" data-iso="${iso}"`;
    return `<button type="button" class="reabrir-tira__d is-${estado}" ${accion} title="${escapeAttr(aria)}" aria-label="${escapeAttr(aria)}">${dentro}</button>`;
  }).join("")}</div>`;
}
/* Qué significa cada día (solo los que aparecen en la tira) */
function reabrirLeyendaHtml(dias) {
  const hay = new Set(dias.map(x => x.estado));
  const ks = ["reabrir", "editar", "abrir", "cerrar"].filter(k => hay.has(k));
  return ks.length ? `<ul class="reabrir-leyenda">${ks.map(k => `<li><span aria-hidden="true">${REABRIR_EST[k].ico}</span> ${REABRIR_EST[k].txt}</li>`).join("")}</ul>` : "";
}
/* Cuánto cuesta, dicho en corto */
function reabrirPrecioTxt() {
  recalcGamif(STATE);
  const guardados = [["reabrir", "reabrir"], ["abrir", "abrir"]].map(([t, v]) => [inventario(STATE, t), v]).filter(x => x[0]);
  return `${consumible("reabrir").costo} ⭐ por día, se cobra al tocarlo · tienes ${STATE.gamif.puntos} ⭐.`
    + (guardados.length ? ` Guardados: ${guardados.map(([n, v]) => n + " para " + v).join(" y ")}.` : "")
    + " Lo que ya pagaste se edita gratis.";
}
/* Tarjeta en Ritual → Día (si hay algún día cerrado o sin abrir en la última semana) */
function reabrirCardHtml() {
  const dias = reabrirDias();
  if (!dias.some(x => ["reabrir", "editar", "abrir"].includes(x.estado))) return "";
  return `<div class="card reabrir-card mt-16" data-tour="reabrir">
    <div class="card__title" style="font-size:15px">✏️ Abrir o reabrir un día</div>
    <p class="text-sm soft mt-8">¿Se te olvidó abrir un día o quieres corregir un cierre? Toca el día.</p>
    ${reabrirTiraHtml(dias)}
    ${reabrirLeyendaHtml(dias)}
    <p class="text-xs muted mt-8">${reabrirPrecioTxt()}</p>
  </div>`;
}
/* La hoja para elegir el día (desde la Tienda) */
function abrirReabrirHoja() {
  const dias = reabrirDias();
  const hay = dias.some(x => x.estado !== "nada");
  openModal("✏️ Abrir o reabrir un día", `
    <p class="text-sm soft">Elige el día. Si lo cerraste, se abre su cierre para corregirlo; si se te olvidó abrirlo, anotas tu misión y lo cierras.</p>
    ${reabrirTiraHtml(dias)}
    ${reabrirLeyendaHtml(dias)}
    <p class="text-xs muted mt-8">${hay ? reabrirPrecioTxt() : "Tu cuenta es de hoy: todavía no hay días anteriores para abrir o reabrir."}</p>
    <p class="text-xs muted mt-8">No repite las ⭐ de la apertura ni del cierre ya cobrado. Hoy no hace falta: tu día se abre y su cierre se edita gratis.</p>`);
}

/* -------- Tienda -------- */
function renderUtilesTienda() {
  return `<div class="section-title">🧰 Útiles <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· se usan y se vuelven a comprar</span></div>
    <div class="grid grid-3">${CONSUMIBLES.map(utilCard).join("")}</div>`;
}
/* Tarjeta de un útil (también es el detalle de su ficha en la Tienda) */
function utilCard(c) {
  const n = inventario(STATE, c.id);
  return `<div class="card util-card" data-util="${c.id}">
    <div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">${c.icon}</span>
      <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${c.nombre}</div>
        <div class="text-xs muted">${c.costo} ⭐ · ${n ? `<b class="hl-cian">tienes ${n}</b>` : "no tienes"}</div></div></div>
    <p class="text-sm soft mt-8">${c.desc}</p>
    <p class="text-xs muted mt-8">${c.regla}</p>
    ${c.usar ? `<button class="btn btn--primary btn-block mt-8" data-action="${c.usar}">${c.usarTxt}</button>` : ""}
    ${botonCompra(c.costo, `data-action="util-buy" data-id="${c.id}"`, c.usar ? "Guardar uno para después" : "Comprar", "btn-block mt-8")}
  </div>`;
}
