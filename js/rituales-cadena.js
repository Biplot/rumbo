/* ============================================================
   RUMBO · Tu semana, tu mes y tu trimestre, desde tu día (v147)
   Ya no hay avisos grandes en Inicio: los rituales grandes se ofrecen al abrir el día.
   · El lunes (o el primer día que abras, hasta el miércoles): cierras la semana pasada (opcional)
     y abres la nueva (obligatorio: sin ella no se abre el día).
   · Del día 1 al 5: cierras el mes que terminó y abres el nuevo (opcionales).
   · Del día 1 al 15 del trimestre: cierras el anterior y abres el nuevo (opcionales).
   · El domingo, al cerrar tu día, puedes dejar lista la semana que viene (opcional).
   Orden (reloj de arena): los cierres de lo chico a lo grande, las aperturas de lo grande a lo chico,
   y tu día al final. Cada ritual es el de siempre (ritual-semana/mes/trimestre.js); la cadena solo
   los pone en fila, con una barra de avance. Lo desmarcado se vuelve a ofrecer al día siguiente
   (localStorage "rumbo-cadena-salto", por día y en este dispositivo).
   Las pruebas automáticas la apagan con localStorage "rumbo-sin-cadena" (lib.cjs).
   ============================================================ */

const CADENA_ORDEN = ["sem-cierre", "mes-cierre", "tri-cierre", "tri-apertura", "mes-apertura", "sem-apertura"];
const CADENA_PLAZO = { semana: 2, mes: 5, tri: 14 };   // lunes + 2 = miércoles · día 1 al 5 · día 1 al 15
let CADENA = null;   // { items, i, abrir: { tipo: "completo" | "express", op } | null, domingo }

function minusculaMes(m) { return MESES[m].toLowerCase(); }
function cadenaEnumerar(xs) { return xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]; }

/* Un paso de la cadena: qué es, cuánto toma y cuánto da */
function cadenaItem(tipo, clave, extra) {
  const it = { id: tipo + ":" + clave, tipo, clave, obligatorio: tipo === "sem-apertura" };
  if (tipo === "sem-cierre") Object.assign(it, { titulo: "Cerrar la semana del " + rangoSemanaTxt(clave), corto: "Cerrar la semana", frase: ["cerrar la semana pasada", "cierras la semana pasada"], pasos: SEM_PASOS.cierre.length, min: 5, pts: 75 });
  if (tipo === "sem-apertura") Object.assign(it, { titulo: "Abrir la semana del " + rangoSemanaTxt(clave), corto: "Abrir la semana", frase: ["abrir tu semana", "abres tu semana"], pasos: 1, min: 1, pts: 75 });   // v153: una pantalla (openSemCorta)
  if (tipo === "mes-cierre" || tipo === "mes-apertura") {
    const { m } = mesDeKey(clave), cierre = tipo === "mes-cierre";
    const pasos = cierre ? MES_PASOS.cierre.length + (m === 11 ? 1 : 0) : MES_PASOS.apertura.length;
    Object.assign(it, cierre
      ? { titulo: "Cerrar " + minusculaMes(m), corto: "Cerrar " + minusculaMes(m), frase: ["cerrar " + minusculaMes(m), "cierras " + minusculaMes(m)], pasos, min: m === 11 ? 8 : 6, pts: 150 }
      : { titulo: "Abrir " + minusculaMes(m), corto: "Abrir " + minusculaMes(m), frase: ["abrir " + minusculaMes(m), "abres " + minusculaMes(m)], pasos, min: 5, pts: 150 });
  }
  if (tipo === "tri-cierre" || tipo === "tri-apertura") {
    const { y, q } = triDeKey(clave), cierre = tipo === "tri-cierre", nom = triNombre(y, q);
    Object.assign(it, cierre
      ? { titulo: "Cerrar el " + nom, corto: "Cerrar el trimestre", frase: ["cerrar el " + nom, "cierras el " + nom], pasos: TRI_PASOS.cierre.length, min: 8, pts: TRI_MONEDAS }
      : { titulo: "Abrir el " + nom, corto: "Abrir el trimestre", frase: ["abrir el " + nom, "abres el " + nom], pasos: TRI_PASOS.apertura.length, min: 7, pts: TRI_MONEDAS });
  }
  return Object.assign(it, extra || {});
}

/* Lo que toca hoy, en orden. La primera semana de una cuenta nueva, nada: los rituales grandes esperan */
function cadenaItems(now) {
  now = now || new Date();
  if (typeof primeraSemanaActiva === "function" && primeraSemanaActiva(STATE, isoLocal(now))) return [];
  const hoy = isoLocal(now), W = agLunes(hoy), out = {};
  if (hoy <= agSumar(W, CADENA_PLAZO.semana)) {
    const P = agSumar(W, -7);
    if (!semanaCerrada(P) && semanaConActividad(P)) out["sem-cierre"] = P;
    if (!semanaAbierta(W)) out["sem-apertura"] = W;
  }
  const y = now.getFullYear(), m = now.getMonth();
  if (now.getDate() <= CADENA_PLAZO.mes) {
    const p = mesPrev(y, m), pk = mesKey(p.y, p.m), k = mesKey(y, m);
    if (!mesCerrado(pk) && !(typeof mesAntesDeLaCuenta === "function" && mesAntesDeLaCuenta(p.y, p.m))) out["mes-cierre"] = pk;
    if (!mesAbierto(k)) out["mes-apertura"] = k;
  }
  const t = triDeFecha(hoy), [ini] = triRango(t.y, t.q);
  if (hoy <= agSumar(ini, CADENA_PLAZO.tri)) {
    const p = triPrev(t.y, t.q), pk = triKey(p.y, p.q), k = triKey(t.y, t.q);
    if (!(ritualTri(pk) || {}).cierre && triConActividad(p.y, p.q)) out["tri-cierre"] = pk;
    if (!(ritualTri(k) || {}).apertura) out["tri-apertura"] = k;
  }
  return CADENA_ORDEN.filter(tp => out[tp]).map(tp => cadenaItem(tp, out[tp]));
}

/* -------- Dejar para mañana (por día, en este dispositivo) -------- */
function cadenaSaltados() {
  try { const x = JSON.parse(localStorage.getItem("rumbo-cadena-salto") || "null"); return x && x.fecha === todayISO() && Array.isArray(x.ids) ? x.ids : []; }
  catch (e) { return []; }
}
function cadenaSaltar(ids) {
  try { localStorage.setItem("rumbo-cadena-salto", JSON.stringify({ fecha: todayISO(), ids: [...new Set(cadenaSaltados().concat(ids))] })); } catch (e) {}
}
function cadenaApagada() { try { return !!localStorage.getItem("rumbo-sin-cadena"); } catch (e) { return false; } }
/* Lo que se ofrece al abrir el día: lo obligatorio siempre; lo demás, si hoy no lo dejaste para mañana */
function cadenaPorOfrecer(now) {
  if (cadenaApagada()) return [];
  const s = cadenaSaltados();
  return cadenaItems(now).filter(it => it.obligatorio || !s.includes(it.id));
}

/* -------- Al abrir el día --------
   abrir: { tipo: "completo" | "express", op }. Devuelve true si mostró la cadena (el día espera). */
function cadenaInterceptar(abrir) {
  const r = STATE.ritual.dias[todayISO()];
  if (r && r.hecho) return false;   // editar la apertura de hoy: directo
  const items = cadenaPorOfrecer();
  if (!items.length) return false;
  openCadenaIntro(items, abrir);
  return true;
}
function cadenaTitulo(items) {
  const ap = t => items.find(i => i.tipo === t);
  if (ap("tri-apertura")) { const { y, q } = triDeKey(ap("tri-apertura").clave); return "Empieza el " + triNombre(y, q); }
  if (ap("mes-apertura")) { const { m } = mesDeKey(ap("mes-apertura").clave); return "Empieza " + minusculaMes(m) + (ap("sem-apertura") ? " y una semana nueva" : ""); }
  if (ap("sem-apertura")) return "Empieza una semana nueva";
  return "Antes de seguir";
}
function cadenaDiaNombre() { return DIAS_SEMANA[(new Date().getDay() + 6) % 7].toLowerCase(); }
function openCadenaIntro(items, abrir) {
  CADENA = { items, i: 0, abrir: abrir || null, intro: true };
  const cierra = items.some(i => i.tipo.endsWith("cierre")), abre = items.some(i => i.tipo.endsWith("apertura"));
  const obligatorio = items.some(i => i.obligatorio);
  const antes = abrir ? "Antes de abrir tu día, " : "";
  const sub = antes + (cierra && abre ? "cierra lo que terminó y abre lo que empieza." : abre ? "abre lo que empieza." : "cierra lo que terminó.");
  const ptsDia = abrir ? (abrir.tipo === "express" ? EXPRESS_MONEDAS.apertura : 50) : 0;
  const filas = items.map((it, i) => `<label class="cad-fila${it.obligatorio ? " is-oblig" : ""}">
      <input type="checkbox" id="cad-${i}" checked ${it.obligatorio ? "disabled" : ""} onchange="cadenaMinutos()">
      <span class="cad-fila__t"><b>${escapeHtml(it.titulo)}</b><small>${it.pasos === 1 ? "1 pantalla" : it.pasos + " pasos"} · ${it.min === 1 ? "1 minuto" : "unos " + it.min + " min"}${it.obligatorio ? " · obligatorio" : ""}</small></span>
      <span class="cad-fila__pts">+${it.pts} ⭐</span></label>`).join("");
  const dia = abrir ? `<div class="cad-fila is-dia"><span class="cad-fila__dia" aria-hidden="true">★</span>
      <span class="cad-fila__t"><b>Abrir tu ${cadenaDiaNombre()}</b><small>siempre al final</small></span><span class="cad-fila__pts">+${ptsDia} ⭐</span></div>` : "";
  const nota = obligatorio
    ? "Tu semana se abre antes que tu día: es lo único obligatorio. Lo demás lo puedes desmarcar y te lo ofrezco mañana."
    : abrir ? "Lo que desmarques te lo vuelvo a ofrecer mañana al abrir tu día." : "Lo que desmarques queda para otro día.";
  openModal(cadenaTitulo(items), `
    <p class="text-sm soft" style="margin-bottom:12px">${sub}</p>
    <div class="cad-lista" id="cad-lista">${filas}${dia}</div>
    <p class="text-xs muted mt-8">${nota}</p>
    <div class="modal__cta">
      <button class="btn btn--primary btn-block" data-action="cadena-empezar" id="cad-ir">${cadenaBotonTxt()}</button>
      ${!obligatorio && abrir ? `<button class="btn-ghost btn-block mt-8" data-action="cadena-saltar">Hoy solo mi día</button>` : ""}
      ${!abrir ? `<button class="btn-ghost btn-block mt-8" data-action="close-modal">Ahora no</button>` : ""}
    </div>`);
}
/* Los minutos según lo marcado */
function cadenaElegidos() {
  const c = CADENA; if (!c) return [];
  return c.items.filter((it, i) => { const el = document.getElementById("cad-" + i); return it.obligatorio || !el || el.checked; });
}
function cadenaBotonTxt() {
  const c = CADENA; if (!c) return "Comenzar";
  const el = c.intro && document.getElementById("cad-lista") ? cadenaElegidos() : c.items;
  const min = el.reduce((s, it) => s + it.min, 0) + (c.abrir ? 2 : 0);
  return el.length ? `Comenzar · unos ${min} min` : c.abrir ? "Abrir mi día" : "Listo";
}
function cadenaMinutos() { const b = document.getElementById("cad-ir"); if (b) b.textContent = cadenaBotonTxt(); }

function cadenaEmpezar() {
  const c = CADENA; if (!c) return;
  const elegidos = cadenaElegidos();
  const fuera = c.items.filter(it => !elegidos.includes(it)).map(it => it.id);
  if (fuera.length) cadenaSaltar(fuera);
  c.items = elegidos; c.i = 0; c.intro = false;
  cadenaPaso();
}
/* «Hoy solo mi día»: lo opcional queda para mañana */
function cadenaSoloDia() {
  const c = CADENA; if (!c) return;
  cadenaSaltar(c.items.filter(it => !it.obligatorio).map(it => it.id));
  c.items = c.items.filter(it => it.obligatorio); c.i = 0; c.intro = false;
  cadenaPaso();
}
/* Desde el recordatorio de Inicio (el día ya abierto) */
function cadenaRetomar() {
  const items = cadenaItems();
  if (!items.length) return toast("No te queda nada por cerrar ni abrir ✓");
  openCadenaIntro(items.map(it => Object.assign({}, it, { obligatorio: false })), null);
}
function cadenaCortar() { CADENA = null; }

/* Abre el ritual del paso actual; al final, tu día */
function cadenaPaso() {
  const c = CADENA; if (!c) return;
  const it = c.items[c.i], prev = c.items[c.i - 1];
  if (!it) return cadenaFin();
  if (it.tipo === "sem-cierre") openSemCierre(it.clave, null);
  else if (it.tipo === "sem-apertura") openSemCorta(it.clave);   // v153: la semana en una pantalla («Afinar más» abre los 5 pasos)
  else if (it.tipo === "mes-cierre") openMesCierre(it.clave);
  else if (it.tipo === "mes-apertura") openMesApertura(it.clave);
  else if (it.tipo === "tri-cierre") openTriCierre(it.clave, null);
  else if (it.tipo === "tri-apertura") openTriApertura(it.clave, { desdeCierre: !!(prev && prev.tipo === "tri-cierre") });
}
function cadenaActiva(tipo, clave) {
  const c = CADENA; if (!c || c.intro) return false;
  const it = c.items[c.i];
  return !!it && (tipo == null || (it.tipo === tipo && it.clave === clave));
}
/* Lo llaman los rituales al guardar: si era el paso actual, sigue con el próximo */
function cadenaTermino(tipo, clave) {
  if (!cadenaActiva(tipo, clave)) return false;
  CADENA.i++;
  cadenaPaso();
  return true;
}
function cadenaFin() {
  const c = CADENA; CADENA = null;
  if (!c) return;
  if (c.abrir) {
    const op = Object.assign({}, c.abrir.op || {}, { cadena: { n: c.items.length + 1, total: c.items.length + 1 } });
    if (c.abrir.tipo === "express") openExpressApertura(op); else openRitualModal(op);
  } else if (c.domingo) toast("📅 Tu semana quedó lista. Mañana abres tu día directo.");
  else closeModal();   // desde el recordatorio, sin nada marcado
}

/* La barra de avance arriba de cada ritual de la cadena */
function cadenaBarra(n, total, txt) {
  return `<div class="cad-barra"><small>${n} de ${total} · ${escapeHtml(txt)}</small>
    <div class="cad-barra__seg">${Array.from({ length: total }, (_, i) => `<i class="${i + 1 < n ? "on" : i + 1 === n ? "ahora" : ""}"></i>`).join("")}</div></div>`;
}
function cadenaBarraHtml(tipo, clave) {
  if (!cadenaActiva(tipo, clave)) return "";
  const c = CADENA, total = c.items.length + (c.abrir ? 1 : 0);
  return cadenaBarra(c.i + 1, total, c.items[c.i].corto);
}
function cadenaBarraDia(op) { return op && op.cadena && op.cadena.total > 1 ? cadenaBarra(op.cadena.n, op.cadena.total, "Tu día") : ""; }

/* -------- La misión del día sale de tu semana -------- */
function prioridadDeHoy() {
  const hoy = todayISO(), a = (ritualSemana(agLunes(hoy)) || {}).apertura;
  return ((a && a.prioridades) || []).find(p => p.dia === hoy && p.texto) || null;
}

/* -------- Recordatorio chico (Inicio y Ritual), en vez de las tarjetas grandes -------- */
function cadenaRecordatorioHtml() {
  if (cadenaApagada()) return "";
  const items = cadenaItems(); if (!items.length) return "";
  const r = STATE.ritual.dias[todayISO()] || {};
  if (!r.hecho) return `<div class="cad-aviso" role="note"><span>📅 Hoy, al abrir tu día, también ${cadenaEnumerar(items.map(i => i.frase[1]))}.</span></div>`;
  return `<div class="cad-aviso" role="note"><span>📅 Te quedó pendiente ${cadenaEnumerar(items.map(i => i.frase[0]))}.</span>
    <button class="btn-ghost" data-action="cadena-retomar">Hacerlo ahora</button></div>`;
}

/* -------- El domingo, al cerrar tu día: dejar lista la semana (opcional) -------- */
function cadenaDomingoHtml(iso) {
  if (iso !== todayISO() || agDate(iso).getDay() !== 0) return "";
  if (typeof primeraSemanaActiva === "function" && primeraSemanaActiva()) return "";
  const W = agLunes(iso), sig = agSumar(W, 7);
  if (semanaAbierta(sig)) return "";
  const cerrar = !semanaCerrada(W);
  return `<label class="cad-domingo"><input type="checkbox" id="c-semana" ${STATE.settings.domingoSemana === true ? "checked" : ""}>
    <span><b>📅 Después, dejar lista mi semana</b><small>${cerrar ? "Cierras esta semana y planificas" : "Planificas"} la del ${rangoSemanaTxt(sig)} (+${cerrar ? 150 : 75} ⭐). Si no, mañana al abrir tu día.</small></span></label>`;
}
/* Se lee antes de cerrar la ventana; recuerda lo que elegiste para el próximo domingo */
function cadenaDomingoLeer() {
  const el = document.getElementById("c-semana"); if (!el) return false;
  STATE.settings.domingoSemana = !!el.checked;
  return !!el.checked;
}
function cadenaDomingoEmpezar(iso) {
  const W = agLunes(iso), sig = agSumar(W, 7), items = [];
  if (!semanaCerrada(W)) items.push(cadenaItem("sem-cierre", W));
  if (!semanaAbierta(sig)) items.push(cadenaItem("sem-apertura", sig, { obligatorio: false }));
  if (!items.length) return;
  CADENA = { items, i: 0, abrir: null, domingo: true, intro: false };
  cadenaPaso();
}
