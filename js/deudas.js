/* ============================================================
   RUMBO · 💳 Tus deudas (Finanzas, v156)
   Como las alcancías, pero al revés: en vez de llenarse, se vacían. Anotas cada deuda en 20 segundos
   (nombre, cuánto debes hoy y, si quieres, la cuota y el interés como alto, medio, bajo o sin interés);
   Rumbo te dice por cuál partir según tu método (⛄ bola de nieve: la más chica primero; 🏔️ avalancha: la
   de interés más alto primero) y marca una con «Ataca esta»; «Abonar» baja la barra; arriba, cuánto debes
   y cuánto bajó este mes; y una fecha estimada para quedar libre según lo que puedes abonar al mes.
   Estrellas: +10 por abonar (una vez al día por deuda: deuda-abono:<id>:<fecha>) y +100 al saldar una
   (deuda-saldada:<id>); si deshaces, se devuelven. Medallas: «Primera deuda saldada» y «Sin deudas».
   El tono es sin culpa y el método es general (no es consejo financiero). Privado: los montos se ocultan
   como en las alcancías y tus amigos no ven nada de esto.
   Datos: STATE.deudas = { lista: [{ id, nombre, monto (lo que debías al anotarla), cuota (al mes, opcional),
     interes ("alto" | "medio" | "bajo" | "no"), dia (día de pago, opcional), aviso (recordatorio ese día),
     creada (ts), saldada (ts o 0), ts, movs: [{ id, tipo: "abono" | "ajuste", monto, fecha, ts }], b: [movs deshechos] }],
     borradas: [ids], metodo ("nieve" | "avalancha" | ""), abonoMes (lo que puedes abonar al mes), ocultar, ts }
   Entre equipos se fusiona con deudasMerge (store.js). Pruebas: tests/deudas.test.mjs y tests/e2e/deudas.cjs.
   ============================================================ */
const DEUDA_ABONO = 10, DEUDA_SALDADA = 100;
const DEUDA_INTERESES = [["alto", "Interés alto"], ["medio", "Interés medio"], ["bajo", "Interés bajo"], ["no", "Sin interés"]];
// Tasas mensuales aproximadas, solo para estimar la fecha (no es un cálculo bancario)
const DEUDA_TASA = { alto: 0.035, medio: 0.015, bajo: 0.006, no: 0 };
const DEUDA_METODOS = { nieve: { ico: "⛄", n: "Bola de nieve", d: "La más chica primero. Ves avances rápido y eso da ganas de seguir.", corto: "partes por la más chica" },
  avalancha: { ico: "🏔️", n: "Avalancha", d: "La de interés más alto primero. Pagas menos en total.", corto: "partes por la de interés más alto" } };

/* -------- Los datos -------- */
function deudasDatos(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { lista: [], borradas: [], metodo: "", abonoMes: 0, ocultar: false, ts: 0 };
  const D = S.deudas;
  if (!D || typeof D !== "object" || !Array.isArray(D.lista)) S.deudas = { lista: [], borradas: [], metodo: "", abonoMes: 0, ocultar: false, ts: 0 };
  if (!Array.isArray(S.deudas.borradas)) S.deudas.borradas = [];
  return S.deudas;
}
function deudaPorId(id, S) { return deudasDatos(S).lista.find(d => d && d.id === id) || null; }
function deudaNuevoId(p) { return (p || "de") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/* Los movimientos que siguen (sin los deshechos), del más viejo al más nuevo */
function deudaMovs(d) { if (!d || !Array.isArray(d.movs)) return []; const b = new Set(d.b || []); return d.movs.filter(x => x && !b.has(x.id)).sort((x, y) => (x.ts || 0) - (y.ts || 0)); }
function deudaAbonado(d) { return deudaMovs(d).filter(x => x.tipo === "abono").reduce((s, x) => s + (+x.monto || 0), 0); }
/* Lo que llegó a deber: lo anotado más los ajustes (si subió por intereses, o si bajó por un acuerdo) */
function deudaTotal(d) { return Math.max(0, (+d.monto || 0) + deudaMovs(d).filter(x => x.tipo === "ajuste").reduce((s, x) => s + (+x.monto || 0), 0)); }
function deudaSaldo(d) { return d ? Math.max(0, deudaTotal(d) - deudaAbonado(d)) : 0; }
function deudaFrac(d) { const t = deudaTotal(d); return t > 0 ? Math.min(1, deudaAbonado(d) / t) : 0; }
function deudasTodas(S) { const fuera = new Set(deudasDatos(S).borradas); return deudasDatos(S).lista.filter(d => d && !fuera.has(d.id)); }
function deudasVivas(S) { return deudasTodas(S).filter(d => !d.saldada); }
function deudasSaldadasLista(S) { return deudasTodas(S).filter(d => d.saldada).sort((a, b) => b.saldada - a.saldada); }
function deudasSaldadas(S) { return deudasSaldadasLista(S).length; }
function deudasHay(S) { return deudasTodas(S).length > 0; }
function deudasMetodo(S) { return deudasDatos(S).metodo === "avalancha" ? "avalancha" : "nieve"; }
function deudasOculto(S) { return !!deudasDatos(S).ocultar; }
/* El orden según tu método: bola de nieve (lo que queda, de menos a más) o avalancha (interés, de más a menos) */
function deudasOrden(S) {
  const tasa = d => DEUDA_TASA[d.interes] != null ? DEUDA_TASA[d.interes] : DEUDA_TASA.medio;
  const l = deudasVivas(S).slice();
  return deudasMetodo(S) === "avalancha" ? l.sort((a, b) => tasa(b) - tasa(a) || deudaSaldo(a) - deudaSaldo(b)) : l.sort((a, b) => deudaSaldo(a) - deudaSaldo(b) || tasa(b) - tasa(a));
}
/* «Ataca esta»: la primera del orden (con una sola deuda no hace falta marcarla) */
function deudaAtacar(S) { const l = deudasOrden(S); return l.length >= 2 ? l[0] : null; }
function deudasDebes(S) { return deudasVivas(S).reduce((s, d) => s + deudaSaldo(d), 0); }
/* Lo abonado en un mes (YYYY-MM), en todas tus deudas (también las ya saldadas) */
function deudasAbonadoMes(S, ym) {
  return deudasTodas(S).reduce((s, d) => s + deudaMovs(d).filter(x => x.tipo === "abono" && String(x.fecha || "").startsWith(ym)).reduce((a, x) => a + (+x.monto || 0), 0), 0);
}
/* Lo que debías al terminar un mes (para Tendencias): cada deuda desde que la anotaste, con sus movimientos hasta ese día */
function deudasDebiaAl(S, iso) {
  return deudasTodas(S).reduce((s, d) => {
    const creada = d.creada ? isoLocal(new Date(d.creada)) : "";
    if (creada && creada > iso) return s;
    const ms = deudaMovs(d).filter(x => String(x.fecha || "") <= iso);
    const total = Math.max(0, (+d.monto || 0) + ms.filter(x => x.tipo === "ajuste").reduce((a, x) => a + (+x.monto || 0), 0));
    return s + Math.max(0, total - ms.filter(x => x.tipo === "abono").reduce((a, x) => a + (+x.monto || 0), 0));
  }, 0);
}
function deudasCuotas(S) { return deudasVivas(S).reduce((s, d) => s + (+d.cuota || 0), 0); }
/* Lo que puedes abonar al mes: lo que escribiste o, si no, la suma de tus cuotas */
function deudasAbonoMes(S) { return Math.max(0, Math.round(+deudasDatos(S).abonoMes || 0)) || deudasCuotas(S); }
/* ¿En cuántos meses quedas libre abonando P al mes? Cada mes suman los intereses (aproximados), se paga la cuota
   de cada una y lo que sobra va a la primera del orden (lo de una saldada pasa a la siguiente). null si no alcanza. */
function deudasLibreEn(S, P, hoy) {
  P = Math.max(0, Math.round(+P || 0));
  const orden = deudasOrden(S).map(d => ({ b: deudaSaldo(d), t: DEUDA_TASA[d.interes] != null ? DEUDA_TASA[d.interes] : DEUDA_TASA.medio, c: +d.cuota || 0 })).filter(x => x.b > 0);
  if (!orden.length) return { meses: 0, ym: (hoy || todayISO()).slice(0, 7) };
  if (!P) return null;
  let meses = 0;
  while (orden.some(x => x.b > 0.5) && meses < 600) {
    const antes = orden.reduce((s, x) => s + x.b, 0);
    orden.forEach(x => { x.b *= 1 + x.t; });
    let caja = P;
    orden.forEach(x => { const p = Math.min(x.b, x.c, caja); x.b -= p; caja -= p; });
    orden.forEach(x => { const p = Math.min(x.b, caja); x.b -= p; caja -= p; });
    meses++;
    if (meses === 1 && orden.reduce((s, x) => s + x.b, 0) >= antes) return null;   // los intereses se comen el abono
  }
  if (meses >= 600) return null;
  const [y, m] = (hoy || todayISO()).split("-").map(Number), f = new Date(y, m - 1 + meses, 1);
  return { meses, ym: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}` };
}

/* -------- Anotar, editar, abonar, ajustar y deshacer -------- */
function deudaCrear(o, S) {
  const D = deudasDatos(S), ahora = Date.now();
  const d = { id: deudaNuevoId("de"), nombre: String(o.nombre || "Mi deuda").trim().slice(0, 40), monto: Math.max(0, Math.round(+o.monto || 0)), cuota: Math.max(0, Math.round(+o.cuota || 0)),
    interes: DEUDA_TASA[o.interes] != null ? o.interes : "medio", dia: deudaDiaValido(o.dia), aviso: !!o.aviso && !!deudaDiaValido(o.dia), creada: ahora, saldada: 0, ts: ahora, movs: [], b: [] };
  D.lista.push(d); D.ts = ahora; return d;
}
function deudaDiaValido(v) { v = Math.round(+v || 0); return v >= 1 && v <= 31 ? v : 0; }
function deudaEditar(id, c, S) {
  const d = deudaPorId(id, S); if (!d) return null;
  if (c.nombre != null) d.nombre = String(c.nombre).trim().slice(0, 40) || d.nombre;
  if (c.cuota != null) d.cuota = Math.max(0, Math.round(+c.cuota || 0));
  if (c.interes != null && DEUDA_TASA[c.interes] != null) d.interes = c.interes;
  if (c.dia != null) d.dia = deudaDiaValido(c.dia);
  if (c.aviso != null) d.aviso = !!c.aviso && !!d.dia;
  d.ts = Date.now(); return d;
}
function deudaAbonar(id, monto, S, fecha) {
  const d = deudaPorId(id, S); monto = Math.round(+monto);
  if (!d || d.saldada || !(monto > 0)) return null;
  const x = { id: deudaNuevoId("ab"), tipo: "abono", monto: Math.min(monto, deudaSaldo(d)), ts: Date.now(), fecha: fecha || todayISO() };
  if (!(x.monto > 0)) return null;
  d.movs = d.movs || []; d.movs.push(x);
  if (deudaSaldo(d) <= 0) d.saldada = x.ts;
  d.ts = x.ts; return x;
}
/* «Lo que debo hoy es…»: la diferencia queda como un ajuste (sube por intereses o baja por un acuerdo) */
function deudaAjustar(id, nuevoSaldo, S, fecha) {
  const d = deudaPorId(id, S); if (!d) return null;
  const dif = Math.round(Math.max(0, +nuevoSaldo || 0) - deudaSaldo(d)); if (!dif) return null;
  const x = { id: deudaNuevoId("aj"), tipo: "ajuste", monto: dif, ts: Date.now(), fecha: fecha || todayISO() };
  d.movs = d.movs || []; d.movs.push(x);
  d.saldada = deudaSaldo(d) <= 0 ? (d.saldada || x.ts) : 0;
  d.ts = x.ts; return x;
}
function deudaDeshacer(id, movId, S) {
  const d = deudaPorId(id, S); if (!d) return null;
  const xs = deudaMovs(d), x = movId ? xs.find(y => y.id === movId) : xs[xs.length - 1]; if (!x) return null;
  d.b = d.b || []; d.b.push(x.id);
  d.saldada = deudaSaldo(d) <= 0 && deudaTotal(d) > 0 ? (d.saldada || Date.now()) : 0;
  d.ts = Date.now(); return x;
}

/* -------- Las estrellas: abonar (una vez al día por deuda) y saldar; si deshaces, se devuelven -------- */
function deudaRevisar(id) {
  const d = deudaPorId(id); if (!d || typeof registrarMovimiento !== "function") return { saldada: false };
  const dias = new Set(deudaMovs(d).filter(x => x.tipo === "abono").map(x => x.fecha));
  (STATE.gamif.ledger || []).filter(m => m && String(m.id).startsWith(`deuda-abono:${d.id}:`) && !m.anulado).forEach(m => {
    if (!dias.has(String(m.id).split(":")[2])) anularMovimiento(m.id);
  });
  dias.forEach(f => { const mov = `deuda-abono:${d.id}:${f}`; if (!ledgerVigente(STATE, mov)) registrarMovimiento(mov, DEUDA_ABONO, DEUDA_ABONO, "Abono: " + d.nombre, true); });
  // +100 al saldar, si la anotaste un día antes (una deuda anotada y saldada el mismo día no las da: así no se inventan)
  const mov = "deuda-saldada:" + d.id, vale = !!d.saldada && deudaSaldadaVale(d);
  if (vale && !ledgerVigente(STATE, mov)) registrarMovimiento(mov, DEUDA_SALDADA, DEUDA_SALDADA, "Deuda saldada: " + d.nombre, true);
  else if (!vale && ledgerVigente(STATE, mov)) anularMovimiento(mov);
  return { saldada: !!d.saldada };
}
function deudaSaldadaVale(d) { return !!(d && d.saldada && d.creada && isoLocal(new Date(d.creada)) < isoLocal(new Date(d.saldada))); }
function deudaAnularTodo(d) {
  if (typeof anularMovimiento !== "function") return;
  (STATE.gamif.ledger || []).filter(m => m && (String(m.id).startsWith(`deuda-abono:${d.id}:`) || m.id === "deuda-saldada:" + d.id) && !m.anulado).forEach(m => anularMovimiento(m.id));
}

/* -------- La tarjeta en Finanzas -------- */
function deudaMonto(n) { return deudasOculto() ? "$ •••" : fmtCLP(n); }
function deudaMesTxt(ym) { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1].toLowerCase()}${y !== new Date().getFullYear() ? " " + y : ""}`; }
function deudasHtml() {
  if (typeof STATE === "undefined" || !STATE) return "";
  const vivas = deudasVivas(), saldadas = deudasSaldadasLista(), oc = deudasOculto();
  if (!vivas.length && !saldadas.length) return `<div class="card mt-24 deu-sec ensena" id="deudas" data-ensena="deudas"><div class="ensena__txt">
      <div class="card__title">💳 ¿Tienes deudas?</div>
      <p class="text-sm soft mt-8">Anótalas y sal de a una: Rumbo te dice por cuál partir y cuándo quedarías libre según lo que puedes abonar al mes. Es privado: tus amigos no lo ven.</p>
      <button type="button" class="btn btn--soft mt-16" data-action="deu-nueva">+ Anotar una deuda</button></div></div>`;
  const ym = todayISO().slice(0, 7), bajo = deudasAbonadoMes(STATE, ym), atacar = deudaAtacar(), orden = deudasOrden();
  const fila = d => {
    const pct = Math.round(deudaFrac(d) * 100), int = DEUDA_INTERESES.find(x => x[0] === d.interes) || DEUDA_INTERESES[1];
    return `<button type="button" class="deu-fila" data-action="deu-editar" data-id="${escapeAttr(d.id)}" aria-label="${escapeAttr(d.nombre)}: quedan ${oc ? "montos ocultos" : fmtCLP(deudaSaldo(d))}">
      <span class="deu-fila__f"><b>${escapeHtml(d.nombre)}</b>${atacar && atacar.id === d.id ? `<span class="deu-ataca">Ataca esta</span>` : d.cuota ? `<small class="muted">${atacar ? "mín." : "cuota"} ${deudaMonto(d.cuota)}</small>` : ""}</span>
      <span class="deu-barra" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <span class="deu-fila__f text-xs muted"><span>Quedan ${deudaMonto(deudaSaldo(d))}${pct ? ` · pagaste el ${pct}%` : ""}</span><span class="deu-int">${int[1].toLowerCase()}</span></span></button>`;
  };
  const P = deudasAbonoMes(), libre = vivas.length ? deudasLibreEn(STATE, P) : null, met = DEUDA_METODOS[deudasMetodo()];
  const plan = !vivas.length ? `<div class="deu-plan is-libre">🎉 Quedaste sin deudas. Lo que abonabas cada mes ahora puede ir a tus alcancías.</div>`
    : !P ? `<div class="deu-plan"><label for="deu-abono-mes">¿Cuánto puedes abonar al mes, en total? Te digo cuándo quedas libre.</label>
        <div class="row mt-8" style="gap:8px"><input class="input" id="deu-abono-mes" type="text" inputmode="numeric" placeholder="Ej: 150.000"><button type="button" class="btn btn--soft" data-action="deu-abono-mes">Calcular</button></div></div>`
    : libre ? `<div class="deu-plan">Con <b>${deudaMonto(P)}</b> al mes para tus deudas, quedas libre en unos <b>${libre.meses === 1 ? "1 mes" : libre.meses + " meses"}</b> (${deudaMesTxt(libre.ym)}). <button type="button" class="btn-link" data-action="deu-abono-cambiar">Cambiar</button></div>`
    : `<div class="deu-plan is-ojo">Con ${deudaMonto(P)} al mes, los intereses se comen lo que abonas. Si puedes subir un poco el abono, empieza a bajar. <button type="button" class="btn-link" data-action="deu-abono-cambiar">Cambiar</button></div>`;
  return `<div class="card mt-24 deu-sec" id="deudas">
    <div class="card__head"><div class="card__title">💳 Tus deudas</div>
      <div class="alc-sec__acc"><button type="button" class="btn-ghost" data-action="deu-ocultar" aria-pressed="${oc}">${oc ? "Mostrar montos" : "Ocultar montos"}</button>
        <button type="button" class="btn-ghost" data-action="deu-nueva">+ Nueva</button></div></div>
    ${vivas.length ? `<div class="deu-total"><span class="text-xs muted">Debes hoy</span><b class="num">${deudaMonto(deudasDebes())}</b>${bajo ? `<span class="deu-bajo">↓ abonaste ${deudaMonto(bajo)} este mes</span>` : ""}</div>
    <div class="deu-lista">${orden.map(fila).join("")}</div>
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="deu-abonar">+ Abonar</button>` : ""}
    ${plan}
    ${vivas.length >= 2 ? `<p class="text-xs muted mt-8">${met.ico} ${met.n}: ${met.corto}; en las demás, lo mínimo. <button type="button" class="btn-link" data-action="deu-metodo">Cambiar</button></p>` : ""}
    ${saldadas.length ? `<details class="alc-cumplidas"><summary>Saldadas (${saldadas.length})</summary>
      ${saldadas.map(d => `<div class="alc-cumplida"><span><b>${escapeHtml(d.nombre)}</b><small>${oc ? "" : fmtCLP(deudaTotal(d)) + " · "}${new Date(d.saldada).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</small></span>
        <button type="button" class="btn-link" data-action="deu-editar" data-id="${escapeAttr(d.id)}">Ver</button></div>`).join("")}</details>` : ""}
    <p class="text-xs muted mt-16">Es un método general para ordenarte (así suele funcionar), no un consejo financiero. La fecha es una estimación.</p>
  </div>`;
}

/* -------- En el cierre del mes: ¿abonaste a tus deudas? (sin culpa si no) -------- */
function deudasCierreHtml(y, m) {
  if (!deudasHay()) return "";
  const ym = `${y}-${String(m + 1).padStart(2, "0")}`, abono = deudasAbonadoMes(STATE, ym), fin = isoLocal(new Date(y, m + 1, 0));
  const antes = deudasDebiaAl(STATE, isoLocal(new Date(y, m, 0))), ahora = deudasDebiaAl(STATE, fin), bajo = antes - ahora;
  const vivas = deudasVivas().length;
  return `<div class="card mt-16 deu-cierre"><div class="card__title" style="font-size:15px">💳 Tus deudas en ${MESES[m].toLowerCase()}</div>
    <p class="text-sm mt-8">${abono ? `Abonaste <b>${deudaMonto(abono)}</b>.${bajo > 0 && antes ? ` Lo que debes bajó ${deudaMonto(bajo)}.` : ""}` : "Este mes no anotaste abonos. Pasa: lo importante es el próximo."}
      ${vivas ? ` Debes ${deudaMonto(deudasDebes())}${deudaAtacar() ? `; la que atacas es «${escapeHtml(deudaAtacar().nombre)}»` : ""}.` : " 🎉 No te queda ninguna."}</p>
    ${vivas ? `<button type="button" class="btn btn--soft mt-8" data-action="deu-abonar">+ Anotar un abono</button>` : ""}</div>`;
}

/* -------- Las hojas: nueva o editar, abonar y el método -------- */
let DEU_BORRADOR = null;
function deuLeerBorrador() {
  const d = DEU_BORRADOR; if (!d) return;
  const el = id => document.getElementById(id);
  if (el("deu-nombre")) d.nombre = el("deu-nombre").value;
  if (el("deu-monto")) d.monto = parseNum(el("deu-monto").value);
  if (el("deu-cuota")) d.cuota = parseNum(el("deu-cuota").value);
  if (el("deu-dia")) d.dia = deudaDiaValido(el("deu-dia").value);
  if (el("deu-aviso")) d.aviso = el("deu-aviso").checked;
  if (el("deu-saldo")) d.saldo = el("deu-saldo").value === "" ? null : parseNum(el("deu-saldo").value);
}
function deuHojaHtml() {
  const b = DEU_BORRADOR, d = b.id ? deudaPorId(b.id) : null;
  const movs = d ? deudaMovs(d).slice().reverse() : [];
  return `<div class="deu-hoja" id="deu-hoja">
    <div class="field"><label for="deu-nombre">¿Qué deuda es?</label><input class="input" id="deu-nombre" maxlength="40" value="${escapeAttr(b.nombre || "")}" placeholder="Ej: Tarjeta, Crédito auto, Préstamo de mi hermana"></div>
    <div class="grid grid-2 alc-hoja__2">
      ${d ? `<div class="field"><label for="deu-saldo">Lo que debes hoy ($)</label><input class="input" id="deu-saldo" type="text" inputmode="numeric" value="${b.saldo != null ? b.saldo : deudaSaldo(d)}">
          <small class="text-xs muted">Si subió por intereses o bajó por un acuerdo, cámbialo aquí.</small></div>`
        : `<div class="field"><label for="deu-monto">¿Cuánto debes hoy? ($)</label><input class="input" id="deu-monto" type="text" inputmode="numeric" value="${b.monto || ""}" placeholder="Ej: 480.000"></div>`}
      <div class="field"><label for="deu-cuota">Cuota del mes (opcional)</label><input class="input" id="deu-cuota" type="text" inputmode="numeric" value="${b.cuota || ""}" placeholder="Ej: 45.000"></div>
    </div>
    <div class="field"><label>Interés</label><div class="fo-chips" id="deu-interes" role="group" aria-label="Interés">${DEUDA_INTERESES.map(([v, t]) =>
      `<button type="button" class="fo-chip${b.interes === v ? " is-on" : ""}" data-action="deu-interes" data-v="${v}" aria-pressed="${b.interes === v}">${t}</button>`).join("")}</div>
      <small class="text-xs muted">Una tarjeta o un avance en efectivo suelen ser de interés alto; un préstamo de alguien cercano, sin interés.</small></div>
    <div class="grid grid-2 alc-hoja__2">
      <div class="field"><label for="deu-dia">Día de pago (opcional)</label><input class="input" id="deu-dia" type="number" min="1" max="31" inputmode="numeric" value="${b.dia || ""}" placeholder="Ej: 5"></div>
      <label class="field row deu-aviso" style="gap:8px;align-items:center"><span class="sw"><input type="checkbox" id="deu-aviso" role="switch" ${b.aviso ? "checked" : ""}><span></span></span>
        <span class="text-sm">Avísame ese día</span></label>
    </div>
    ${typeof notifEstado === "function" && notifEstado() !== "activas" ? `<p class="text-xs muted" style="margin:-6px 0 12px">Para recibir el aviso, activa los avisos en este aparato (Ajustes › Avisos).</p>` : ""}
    <button type="button" class="btn btn--primary btn-block" data-action="deu-guardar">${d ? "Guardar cambios" : "Anotar la deuda"}</button>
    ${d ? `<div class="agua-sec"><span class="cj-sub">Lo que abonaste</span>
      ${movs.length ? `<div class="agua-lista">${movs.map(x => `<div class="agua-reg"><span>${alcFechaTxt(x.fecha)}${x.tipo === "ajuste" ? (x.monto > 0 ? " · subió" : " · bajó") : ""}</span><b>${x.tipo === "ajuste" ? (x.monto > 0 ? "+" : "−") + fmtCLP(Math.abs(x.monto)) : fmtCLP(x.monto)}</b>
          <button class="icon-btn" data-action="deu-quitar" data-id="${escapeAttr(d.id)}" data-mov="${escapeAttr(x.id)}" aria-label="Quitar ${fmtCLP(Math.abs(x.monto))}">✕</button></div>`).join("")}</div>`
        : `<p class="text-sm muted">Todavía nada. Toca «+ Abonar» cuando pagues.</p>`}
      <div class="alc-hoja__fin"><span></span><button type="button" class="btn-link alc-borrar" data-action="deu-borrar" data-id="${escapeAttr(d.id)}">Borrar</button></div></div>` : ""}
  </div>`;
}
function openDeudaNueva() {
  DEU_BORRADOR = { id: null, nombre: "", monto: 0, cuota: 0, interes: "medio", dia: 0, aviso: false };
  openModal("Nueva deuda", deuHojaHtml(), { ancho: true });
}
function openDeudaEditar(id) {
  const d = deudaPorId(id); if (!d) return;
  if (!DEU_BORRADOR || DEU_BORRADOR.id !== id) DEU_BORRADOR = { id, nombre: d.nombre, cuota: d.cuota || 0, interes: d.interes, dia: d.dia || 0, aviso: !!d.aviso, saldo: null };
  openModal(d.nombre, deuHojaHtml(), { ancho: true });
}
function deudaGuardarHoja() {
  deuLeerBorrador();
  const b = DEU_BORRADOR; if (!b) return;
  if (!String(b.nombre || "").trim()) return toast("Ponle un nombre a la deuda", true);
  if (b.id) {
    const antes = !!(deudaPorId(b.id) || {}).saldada;
    deudaEditar(b.id, b);
    if (b.saldo != null) deudaAjustar(b.id, b.saldo);
    const r = deudaRevisar(b.id);
    DEU_BORRADOR = null; saveState(); closeModal(); if (typeof rerender === "function") rerender();
    if (r.saldada && !antes) return deudaCelebrar(b.id);
    return toast("Deuda guardada");
  }
  if (!(b.monto > 0)) return toast("Escribe cuánto debes hoy", true);
  const primera = !deudasHay(), d = deudaCrear(b);
  DEU_BORRADOR = null; saveState(); closeModal(); if (typeof rerender === "function") rerender();
  if (typeof seccionesRevisar === "function") seccionesRevisar();
  // con la segunda, Rumbo pregunta por cuál partir (una vez)
  if (deudasVivas().length === 2 && !deudasDatos().metodo) return openDeudaMetodo(true);
  toast(primera ? "💳 Anotada. Cuando pagues, toca «+ Abonar»." : `💳 «${d.nombre}» anotada`);
}
let DEU_ABONO = { id: "" };
function openDeudaAbonar(id) {
  const vivas = deudasOrden(); if (!vivas.length) return;
  DEU_ABONO.id = id && vivas.some(d => d.id === id) ? id : (deudaAtacar() || vivas[0]).id;
  deuAbonarPintar();
}
function deuAbonarPintar() {
  const vivas = deudasOrden(), d = deudaPorId(DEU_ABONO.id) || vivas[0], atacar = deudaAtacar();
  const rapidos = [d.cuota, Math.round(deudaSaldo(d) / 4 / 1000) * 1000, deudaSaldo(d)].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 3);
  openModal("Abonar", `<div class="field"><label>¿A cuál?</label><div class="fo-chips" id="deu-a-cual" role="group" aria-label="Deuda">${vivas.map(x =>
      `<button type="button" class="fo-chip${x.id === d.id ? " is-on" : ""}" data-action="deu-abonar-cual" data-id="${escapeAttr(x.id)}" aria-pressed="${x.id === d.id}">${escapeHtml(x.nombre)}${atacar && atacar.id === x.id ? " · ataca esta" : ""}</button>`).join("")}</div></div>
    <div class="field"><label for="deu-abono">¿Cuánto abonaste?</label><input class="input" id="deu-abono" type="text" inputmode="numeric" placeholder="Ej: 50.000" autocomplete="off">
      ${rapidos.length ? `<div class="row-wrap mt-8" style="gap:6px">${rapidos.map(v => `<button type="button" class="chip" data-action="deu-abono-rapido" data-v="${v}">${v === deudaSaldo(d) ? "Todo: " : v === d.cuota ? "La cuota: " : ""}${fmtCLP(v)}</button>`).join("")}</div>` : ""}
      <small class="text-xs muted">Quedan ${deudaMonto(deudaSaldo(d))}.</small></div>
    <button type="button" class="btn btn--primary btn-block btn--precio" data-action="deu-abonar-ok"><span>Abonar</span><span class="btn__precio">+${DEUDA_ABONO} ${iconoLinea("estrella", 16)}</span></button>`);
  setTimeout(() => { const i = document.getElementById("deu-abono"); if (i) i.focus(); }, 60);
}
function deudaAbonarOk() {
  const v = parseNum(val("deu-abono")); if (!(v > 0)) return toast("Escribe cuánto abonaste", true);
  const id = DEU_ABONO.id, x = deudaAbonar(id, v); if (!x) return toast("Esa deuda ya está saldada", true);
  const r = deudaRevisar(id); saveState(); closeModal(); vibrar(10);   // r.saldada: este abono la dejó en cero (deudaAbonar no abona a una saldada)
  if (typeof updateTopbar === "function") updateTopbar();
  if (typeof rerender === "function") rerender();
  if (r.saldada) return deudaCelebrar(id);
  if (typeof toastAccion === "function") toastAccion(`💳 Abonaste ${fmtCLP(x.monto)} · quedan ${deudaMonto(deudaSaldo(deudaPorId(id)))}`, "Deshacer", () => deudaQuitar(id, x.id));
  else toast(`💳 Abonaste ${fmtCLP(x.monto)}`);
}
function deudaQuitar(id, movId) {
  const x = deudaDeshacer(id, movId); if (!x) return;
  deudaRevisar(id); saveState();
  if (typeof updateTopbar === "function") updateTopbar();
  if (typeof rerender === "function") rerender();
  if (document.getElementById("deu-hoja")) { DEU_BORRADOR = null; openDeudaEditar(id); }
}
function openDeudaMetodo(primeraVez) {
  const sel = deudasDatos().metodo || "nieve";
  openModal("¿Por cuál partimos?", `${Object.entries(DEUDA_METODOS).map(([v, m]) => `<button type="button" class="deu-metodo${sel === v ? " is-on" : ""}" data-action="deu-metodo-elegir" data-v="${v}" aria-pressed="${sel === v}">
      <b>${m.ico} ${m.n}</b><span>${m.d}</span></button>`).join("")}
    <p class="text-xs muted mt-8">En los dos pagas lo mínimo en todas y lo extra va a una. ${primeraVez ? "Lo puedes cambiar cuando quieras." : ""}</p>
    <button type="button" class="btn btn--primary btn-block mt-16" data-action="deu-metodo-ok" data-v="${sel}">Listo</button>`);
}
/* Al saldar una: la medalla, las estrellas y la bola de nieve (lo que le abonabas, a la siguiente) */
function deudaCelebrar(id) {
  const d = deudaPorId(id); if (!d) return;
  const sig = deudasOrden()[0], ninguna = !deudasVivas().length;
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti && typeof launchConfetti === "function") launchConfetti();
  if (typeof checkBadges === "function") setTimeout(checkBadges, 1500);
  openModal("¡Saldada!", `<div class="deu-fiesta">
      <div class="deu-medalla" aria-hidden="true">${ninguna ? "Sin deudas" : "Saldada"}</div>
      <h3>Saldaste «${escapeHtml(d.nombre)}»</h3>
      <p class="text-sm soft">${ledgerVigente(STATE, "deuda-saldada:" + d.id) ? `+${DEUDA_SALDADA} ⭐` : "Bien hecho"}${deudasSaldadas() === 1 ? " · tu primera deuda saldada" : ""}</p>
      ${ninguna ? `<p>🎉 Quedaste sin deudas. Lo que abonabas cada mes ahora puede ir a tus alcancías.</p><button type="button" class="btn btn--primary btn-block" data-action="close-modal">Seguir</button>`
        : d.cuota && sig ? `<p>Los ${fmtCLP(d.cuota)} que le abonabas cada mes, súmalos a «${escapeHtml(sig.nombre)}», la siguiente.</p>
          <button type="button" class="btn btn--primary btn-block" data-action="deu-bola" data-de="${escapeAttr(d.id)}" data-a="${escapeAttr(sig.id)}">Sumarlos a «${escapeHtml(sig.nombre)}»</button>
          <button type="button" class="btn-ghost btn-block mt-8" data-action="close-modal">Ahora no</button>`
        : `<p>Sigue con «${escapeHtml(sig.nombre)}»: lo que abonabas aquí, súmalo a esa.</p><button type="button" class="btn btn--primary btn-block" data-action="close-modal">Seguir</button>`}
    </div>`);
}

/* -------- Las acciones (app.js las manda aquí) -------- */
function deuAccion(a, d) {
  if (a === "deu-nueva") return openDeudaNueva();
  if (a === "deu-editar") { DEU_BORRADOR = null; return openDeudaEditar(d.id); }
  if (a === "deu-interes") { deuLeerBorrador(); if (DEU_BORRADOR && DEUDA_TASA[d.v] != null) DEU_BORRADOR.interes = d.v;
    document.querySelectorAll("#deu-interes .fo-chip").forEach(b => { const on = b.dataset.v === d.v; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); }); return; }
  if (a === "deu-guardar") return deudaGuardarHoja();
  if (a === "deu-abonar") return openDeudaAbonar(d.id);
  if (a === "deu-abonar-cual") { DEU_ABONO.id = d.id; return deuAbonarPintar(); }
  if (a === "deu-abono-rapido") { const i = document.getElementById("deu-abono"); if (i) i.value = d.v; return; }
  if (a === "deu-abonar-ok") return deudaAbonarOk();
  if (a === "deu-quitar") return deudaQuitar(d.id, d.mov);
  if (a === "deu-borrar") {
    const x = deudaPorId(d.id); if (!x || !confirm(`¿Borrar «${x.nombre}» y lo que abonaste? Las estrellas que te dio se devuelven.`)) return;
    const D = deudasDatos(); D.borradas.push(x.id); D.lista = D.lista.filter(y => y.id !== x.id); D.ts = Date.now();
    deudaAnularTodo(x); DEU_BORRADOR = null; saveState(); closeModal();
    if (typeof updateTopbar === "function") updateTopbar();
    if (typeof rerender === "function") rerender(); return toast("Deuda borrada");
  }
  if (a === "deu-ocultar") { const D = deudasDatos(); D.ocultar = !D.ocultar; D.ts = Date.now(); saveState(); if (typeof rerender === "function") rerender(); return; }
  if (a === "deu-metodo") return openDeudaMetodo(false);
  if (a === "deu-metodo-elegir") {
    document.querySelectorAll(".deu-metodo").forEach(b => { const on = b.dataset.v === d.v; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
    const ok = document.querySelector('[data-action="deu-metodo-ok"]'); if (ok) ok.dataset.v = d.v; return;
  }
  if (a === "deu-metodo-ok") {
    const D = deudasDatos(); D.metodo = d.v === "avalancha" ? "avalancha" : "nieve"; D.ts = Date.now(); saveState(); closeModal();
    if (typeof rerender === "function") rerender();
    const at = deudaAtacar(); return toast(at ? `${DEUDA_METODOS[D.metodo].ico} Partimos por «${at.nombre}»` : "Listo");
  }
  if (a === "deu-abono-mes") {
    const v = parseNum(val("deu-abono-mes")); if (!(v > 0)) return toast("Escribe cuánto puedes abonar al mes", true);
    const D = deudasDatos(); D.abonoMes = v; D.ts = Date.now(); saveState(); if (typeof rerender === "function") rerender(); return;
  }
  if (a === "deu-abono-cambiar") { const D = deudasDatos(); D.abonoMes = 0; D.ts = Date.now();
    if (!deudasCuotas(STATE)) { saveState(); if (typeof rerender === "function") rerender(); return; }
    openModal("Lo que puedes abonar al mes", `<div class="field"><label for="deu-abono-mes">En total, para todas tus deudas</label>
      <input class="input" id="deu-abono-mes" type="text" inputmode="numeric" value="${deudasCuotas(STATE)}"></div>
      <p class="text-xs muted">Tus cuotas suman ${fmtCLP(deudasCuotas(STATE))}. Lo que pongas sobre eso va a la deuda que atacas.</p>
      <button type="button" class="btn btn--primary btn-block mt-16" data-action="deu-abono-mes-ok">Guardar</button>`); return; }
  if (a === "deu-abono-mes-ok") {
    const v = parseNum(val("deu-abono-mes")); if (!(v > 0)) return toast("Escribe cuánto puedes abonar al mes", true);
    const D = deudasDatos(); D.abonoMes = v; D.ts = Date.now(); saveState(); closeModal(); if (typeof rerender === "function") rerender(); return;
  }
  if (a === "deu-bola") {
    const de = deudaPorId(d.de), sig = deudaPorId(d.a); if (!de || !sig) return closeModal();
    deudaEditar(sig.id, { cuota: (+sig.cuota || 0) + (+de.cuota || 0) }); saveState(); closeModal();
    if (typeof rerender === "function") rerender();
    return toast(`⛄ «${sig.nombre}» ahora recibe ${fmtCLP(sig.cuota)} al mes`);
  }
}
