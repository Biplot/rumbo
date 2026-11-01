/* ============================================================
   RUMBO · 🛋 Días de descanso y vacaciones (Hábitos, ritual de la semana, Inicio y Calendario)
   El descanso se decide antes, no se compra y tiene tope. Es parte del plan, no un rescate:
   · Descanso de un hábito (diarios y días fijos): marcas un día que viene, desde el día anterior
     (nunca hoy ni un día que pasó). Hasta 2 por mes en cada hábito. Se puede quitar mientras no llegue.
     En la vista Semana se toca el día que viene; también en la hoja del hábito y en el ritual de la semana.
   · Vacaciones: eliges desde y hasta (hasta 21 días seguidos, desde mañana) y los hábitos (todos o
     algunos). Al volver todo sigue solo; «Volví antes» las corta.
   Un día de descanso no corta la racha ni suma; no da ni cuesta ⭐; si igual lo haces, cuenta como
   siempre. Los de X por semana o al mes no usan descanso de un día: en vacaciones piden en proporción.
   El jardín lo respeta: no suma a los 66 días, el cielo no lo espera, la maceta tiene su hamaquita y
   en vacaciones un letrero dice cuándo vuelves. Las reglas viven en habitos-motor.js (hmDescanso).
   Hábitos en conjunto: tus descansos se comparten (supabase/conjunto.sql) y la racha de a dos los
   respeta solo los días que descansan todos.
   Datos: STATE.habitos.descansos y STATE.habitos.vacaciones (ver habitos-motor.js); se fusionan por id.
   ============================================================ */
const DSC_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DSC_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
function dscMes(iso) { return DSC_MESES[+iso.slice(5, 7) - 1]; }
/* "el viernes 7" · "el lunes 29 de diciembre" (con mes si no es el de hoy) */
function dscDiaTxt(iso, conMes) {
  const d = +iso.slice(8, 10), mes = conMes || iso.slice(0, 7) !== hmHoy().slice(0, 7) ? " de " + dscMes(iso) : "";
  return `el ${DSC_DIAS[hmDow(iso)]} ${d}${mes}`;
}
function dscDef(id) { return (STATE.habitos.defs || []).find(h => h.id === id) || null; }
/* Los hábitos que pueden tener descanso de un día: activos, diarios o de días fijos */
function dscElegibles(S) { return ((S || STATE).habitos.defs || []).filter(h => hmActivo(h) && ["diario", "dias"].includes(hmFreq(h).tipo)); }

/* -------- Las reglas: ¿se puede descansar ese día? { ok, quitar, motivo } -------- */
function dscPuede(h, iso, S) {
  S = S || STATE;
  const hoy = hmHoy(), f = hmFreq(h);
  if (!h || h.pausado) return { ok: false, motivo: "Ese hábito está en pausa." };
  if (f.tipo === "semanal" || f.tipo === "mensual") return { ok: false, motivo: `Los de «${hmFreqLabel(h)}» no necesitan descanso de un día: ya eliges cuándo.` };
  if (hmDescansoDia(h, iso, S)) return iso > hoy ? { ok: true, quitar: true } : { ok: false, motivo: "Ese día ya llegó: el descanso queda." };
  if (iso <= hoy) return { ok: false, motivo: iso === hoy ? "Hoy ya no: el descanso se decide desde el día anterior." : "Ese día ya pasó: el descanso se decide antes." };
  if (!hmTocariaDia(h, iso)) return { ok: false, motivo: `Ese día no toca «${h.nombre}».` };
  if (hmVacacion(h, iso, S)) return { ok: false, motivo: "Ese día ya estás de vacaciones." };
  if (hmDescansosDelMes(h, iso, S) >= HM_DESCANSOS_MES) return { ok: false, motivo: `Ya usaste los ${HM_DESCANSOS_MES} descansos de ${dscMes(iso)} de «${h.nombre}».` };
  return { ok: true };
}
/* Deja o quita el descanso (la lista se reemplaza: el motor la usa de caché) */
function dscPoner(h, iso, on, S) {
  S = S || STATE;
  const id = "d:" + h.id + ":" + iso, x = { id, hid: h.id, fecha: iso, ts: Date.now() };
  if (!on) x.quitado = true;
  S.habitos.descansos = (S.habitos.descansos || []).filter(d => d && d.id !== id).concat([x]);
}
/* Tocar un día: deja o quita el descanso, con su aviso. Devuelve si cambió */
function dscAlternar(hid, iso) {
  const h = dscDef(hid); if (!h) return false;
  const r = dscPuede(h, iso);
  if (!r.ok) { toast(r.motivo, true); return false; }
  dscPoner(h, iso, !r.quitar);
  saveState();
  if (r.quitar) toast(`Quitaste el descanso: ${dscDiaTxt(iso)} vuelve a tocar «${h.nombre}».`);
  else {
    const quedan = HM_DESCANSOS_MES - hmDescansosDelMes(h, iso);
    toast(`«${h.nombre}» descansa ${dscDiaTxt(iso)}. ${quedan ? `Te queda ${quedan} en ${dscMes(iso)}.` : `Usaste los ${HM_DESCANSOS_MES} de ${dscMes(iso)}.`}`);
  }
  if (h.conjunto) cjSincronizarDescansos();
  dscRepintar();
  return true;
}
/* Repinta donde se esté mirando: la hoja del hábito, el paso del ritual o la vista */
function dscRepintar() {
  const hoja = document.getElementById("dsc-hoja"), rit = document.getElementById("dsc-ritual");
  if (hoja) hoja.outerHTML = dscHojaHtml(dscDef(hoja.dataset.id));
  if (rit) rit.outerHTML = dscRitualHtml(rit.dataset.lunes);
  if (!hoja && !rit) rerender();
}

/* -------- Una semana de un hábito: siete días para tocar -------- */
function dscDiaBoton(h, iso, op) {
  op = op || {};
  const hoy = hmHoy(), d = agDate(iso), dia = hmDescansoDia(h, iso), vac = hmVacacion(h, iso), toca = hmTocariaDia(h, iso);
  const hecho = hmDone(h, iso), pasado = iso <= hoy, puede = !pasado && toca && !vac;
  const cls = ["dsc-dia", dia ? "is-desc" : "", vac ? "is-vac" : "", hecho ? "is-hecho" : "", !toca ? "is-no" : "", iso === hoy ? "is-hoy" : ""].join(" ").replace(/\s+/g, " ").trim();
  const estado = dia ? "descanso" : vac ? "vacaciones" : hecho ? "hecho" : !toca ? "no toca" : pasado ? "" : "toca";
  const ico = dia ? icoUI("moon") : vac ? icoUI("tree-palm") : hecho ? "✓" : "";
  return `<button type="button" class="${cls}" data-action="dsc-dia" data-id="${escapeAttr(h.id)}" data-f="${iso}" ${puede || dia ? "" : "disabled"}
    aria-pressed="${!!dia}" aria-label="${escapeAttr(`${DSC_DIAS[hmDow(iso)]} ${d.getDate()}: ${estado || "pasó"}`)}">
    <span class="dsc-dia__d">${DIAS_CORTO[d.getDay()]}</span><span class="dsc-dia__n">${d.getDate()}</span><span class="dsc-dia__i">${ico}</span></button>`;
}
function dscSemanaHtml(h, lunes) { return `<div class="dsc-semana">${Array.from({ length: 7 }, (_, i) => dscDiaBoton(h, hmAdd(lunes, i))).join("")}</div>`; }
/* Cuántos descansos le quedan en los meses que toca la semana: "te quedan 2 en noviembre" */
function dscQuedanTxt(h, lunes) {
  const meses = [...new Set([hmAdd(lunes, 0), hmAdd(lunes, 6)].map(x => x.slice(0, 7)))].filter(m => m >= hmHoy().slice(0, 7));
  return meses.map(m => { const q = Math.max(0, HM_DESCANSOS_MES - hmDescansosDelMes(h, m + "-01")), mes = dscMes(m + "-01");
    return q ? `te queda${q === 1 ? "" : "n"} ${q} en ${mes}` : `ya no te quedan en ${mes}`; }).join(" · ");
}

/* -------- La hoja del hábito (Editar hábito): esta semana y la próxima -------- */
function dscHojaHtml(h) {
  if (!h) return "";
  const f = hmFreq(h), lunes = hmLunes(hmHoy());
  if (h.pausado) return `<div class="field dsc-hoja" id="dsc-hoja" data-id="${escapeAttr(h.id)}"><label>${icoUI("moon")} Días de descanso</label><p class="text-xs muted">Está en pausa: no hace falta descansar.</p></div>`;
  if (f.tipo === "semanal" || f.tipo === "mensual") return `<div class="field dsc-hoja" id="dsc-hoja" data-id="${escapeAttr(h.id)}"><label>${icoUI("moon")} Días de descanso</label>
    <p class="text-xs muted">Los de «${escapeHtml(hmFreqLabel(h))}» no necesitan descanso de un día: ya eliges cuándo. En vacaciones, la semana pide en proporción.</p></div>`;
  return `<div class="field dsc-hoja" id="dsc-hoja" data-id="${escapeAttr(h.id)}"><label>${icoUI("moon")} Días de descanso</label>
    <p class="text-xs muted">Toca un día que viene para descansar: no corta tu racha ni suma. Hasta ${HM_DESCANSOS_MES} por mes: ${escapeHtml(dscQuedanTxt(h, lunes))}.</p>
    <div class="text-xs muted mt-8">Esta semana</div>${dscSemanaHtml(h, lunes)}
    <div class="text-xs muted mt-8">La próxima</div>${dscSemanaHtml(h, hmAdd(lunes, 7))}</div>`;
}

/* -------- El paso «Descansos» del ritual de la semana -------- */
function dscRitualHtml(lunes) {
  const hs = dscElegibles().filter(h => hmCreado(h) <= hmAdd(lunes, 6));
  const vacs = hmVacaciones().filter(v => v.desde <= hmAdd(lunes, 6) && v.hasta >= lunes);
  return `<div id="dsc-ritual" data-lunes="${lunes}">
    <div class="card__title">¿Qué días vas a descansar?</div>
    <p class="text-xs muted mt-8">Opcional. Toca el día que no vas a hacer un hábito: no corta tu racha ni suma. Se guarda al tocar; hasta ${HM_DESCANSOS_MES} por mes en cada hábito.</p>
    ${vacs.length ? `<p class="text-sm mt-8">${icoUI("tree-palm")} ${vacs.map(v => `De vacaciones del ${+v.desde.slice(8)} al ${+v.hasta.slice(8)} de ${dscMes(v.hasta)}`).join(" · ")}</p>` : ""}
    ${hs.length ? hs.map(h => `<div class="dsc-fila"><div class="dsc-fila__n">${icoHab(h.icon, 16)} <span>${escapeHtml(h.nombre)}</span>
        <span class="text-xs muted">${escapeHtml(dscQuedanTxt(h, lunes))}</span></div>${dscSemanaHtml(h, lunes)}</div>`).join("")
      : `<div class="empty">No tienes hábitos diarios o de días fijos. Los de «X por semana» ya eligen cuándo.</div>`}
    <button type="button" class="btn-ghost mt-8" data-action="dsc-vacaciones">${icoUI("tree-palm")} ¿Te vas de vacaciones?</button>
  </div>`;
}

/* -------- Vacaciones -------- */
/* ¿Se pueden guardar? Devuelve el problema en palabras o null */
function vacError(desde, hasta, ids, S) {
  const hoy = hmHoy();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || "") || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || "")) return "Elige cuándo te vas y cuándo vuelves.";
  if (desde <= hoy) return "Las vacaciones parten desde mañana: el descanso se decide antes.";
  if (hasta < desde) return "El último día va después del primero.";
  if (hmDiff(desde, hasta) + 1 > HM_VACACIONES_MAX) return `Hasta ${HM_VACACIONES_MAX} días seguidos.`;
  if (Array.isArray(ids) && !ids.length) return "Elige al menos un hábito.";
  if (hmVacaciones(S).some(v => v.desde <= hasta && v.hasta >= desde)) return "Ya tienes vacaciones en esas fechas.";
  return null;
}
function vacCrear(desde, hasta, ids, S) {
  S = S || STATE;
  const v = { id: "v" + uid(), desde, hasta, habitos: Array.isArray(ids) ? ids.slice() : null, ts: Date.now() };
  S.habitos.vacaciones = (S.habitos.vacaciones || []).concat([v]);
  return v;
}
/* Cancelar (si no parten) o «Volví antes» (terminan ayer; hoy vuelve a tocar) */
function vacTerminar(id, S) {
  S = S || STATE;
  const hoy = hmHoy(), v = (S.habitos.vacaciones || []).find(x => x && x.id === id); if (!v) return null;
  const nueva = Object.assign({}, v, { ts: Date.now() });
  if (v.desde >= hoy) nueva.quitado = true; else nueva.hasta = hmMin(v.hasta, hmAdd(hoy, -1));
  S.habitos.vacaciones = S.habitos.vacaciones.map(x => (x && x.id === id ? nueva : x));
  return nueva;
}
/* Las de hoy (para avisos): la que termina más tarde */
function vacHoy(S) { const hoy = hmHoy(); return hmVacaciones(S).filter(v => v.desde <= hoy && hoy <= v.hasta).sort((a, b) => b.hasta.localeCompare(a.hasta))[0] || null; }
function vacQuienesTxt(v) {
  if (!Array.isArray(v.habitos)) return "todos tus hábitos";
  const ns = v.habitos.map(dscDef).filter(Boolean).map(h => h.nombre);
  return ns.length ? cjNombres(ns) : "sin hábitos";
}
function vacRangoTxt(v) { return `del ${dscDiaTxt(v.desde).replace(/^el /, "")} al ${dscDiaTxt(v.hasta, true).replace(/^el /, "")}`; }
function vacFilaHtml(v) {
  const hoy = hmHoy(), ya = v.desde <= hoy;
  return `<div class="item-row dsc-vac"><span class="hab-ico">${icoUI("tree-palm")}</span>
    <div class="item-row__main"><div class="item-row__title">${ya ? "De vacaciones" : "Vacaciones"} ${escapeHtml(vacRangoTxt(v))}</div>
      <div class="item-row__sub">${escapeHtml(vacQuienesTxt(v))} · vuelves ${escapeHtml(dscDiaTxt(hmAdd(v.hasta, 1)))}</div></div>
    <button class="btn-ghost" data-action="dsc-vac-fin" data-id="${escapeAttr(v.id)}">${ya ? "Volví antes" : "Cancelar"}</button></div>`;
}
function openVacaciones() {
  const hoy = hmHoy(), manana = hmAdd(hoy, 1), activos = (STATE.habitos.defs || []).filter(hmActivo);
  const vigentes = hmVacaciones().filter(v => v.hasta >= hoy).sort((a, b) => a.desde.localeCompare(b.desde));
  openModal("🌴 Vacaciones", `
    <p class="text-sm muted">Elige cuándo te vas y los hábitos que descansan. Esos días no cortan tu racha ni suman; los de «X por semana» piden en proporción. Al volver, todo sigue solo.</p>
    ${vigentes.length ? `<div class="mt-16">${vigentes.map(vacFilaHtml).join("")}</div>` : ""}
    <div class="grid grid-2 mt-16" style="gap:10px">
      <div class="field"><label for="vac-desde">Primer día</label><input class="input" type="date" id="vac-desde" min="${manana}" value="${manana}" oninput="vacResumen()"></div>
      <div class="field"><label for="vac-hasta">Último día</label><input class="input" type="date" id="vac-hasta" min="${manana}" value="${hmAdd(manana, 6)}" oninput="vacResumen()"></div>
    </div>
    <div class="field"><label>Hábitos</label>
      <div class="seg" role="radiogroup" aria-label="Qué hábitos descansan">
        <button type="button" class="is-active" data-action="dsc-vac-todos" data-v="1" aria-pressed="true">Todos</button>
        <button type="button" data-action="dsc-vac-todos" data-v="0" aria-pressed="false">Elegir</button></div>
      <div id="vac-habs" class="mt-8" hidden>${activos.map(h => `<label class="mes-hab" style="cursor:pointer"><span class="mes-hab__n">${icoHab(h.icon, 16)} ${escapeHtml(h.nombre)} <span class="text-xs muted">· ${escapeHtml(hmFreqLabel(h))}</span></span>
        <input type="checkbox" class="vac-hab" value="${escapeAttr(h.id)}" checked onchange="vacResumen()"></label>`).join("")}</div></div>
    <p class="text-sm" id="vac-resumen" aria-live="polite"></p>
    <p class="text-xs muted">Hasta ${HM_VACACIONES_MAX} días seguidos, desde mañana. Para un solo día, usa el descanso del hábito.</p>
    <button class="btn btn--primary btn-block mt-8" data-action="dsc-vac-ok">Guardar vacaciones</button>`);
  vacResumen();
}
function vacLeer() {
  const todos = !!document.querySelector('[data-action="dsc-vac-todos"][data-v="1"].is-active');
  return { desde: val("vac-desde"), hasta: val("vac-hasta"), ids: todos ? null : [...document.querySelectorAll(".vac-hab:checked")].map(i => i.value) };
}
function vacResumen() {
  const el = document.getElementById("vac-resumen"); if (!el) return;
  const { desde, hasta, ids } = vacLeer(), err = vacError(desde, hasta, ids);
  el.classList.toggle("hl-coral", !!err);
  el.textContent = err || `${hmDiff(desde, hasta) + 1} días de vacaciones · vuelves ${dscDiaTxt(hmAdd(hasta, 1), true)}.`;
}
function vacGuardar() {
  const { desde, hasta, ids } = vacLeer(), err = vacError(desde, hasta, ids);
  if (err) { toast(err, true); vacResumen(); return; }
  const v = vacCrear(desde, hasta, ids);
  saveState(); closeModal(); rerender();
  toast(`🌴 ¡Buen viaje! Vuelves ${dscDiaTxt(hmAdd(v.hasta, 1), true)}: hasta entonces, tu racha te espera.`);
  cjSincronizarDescansos();
}
function vacFin(id) {
  const v = vacTerminar(id); if (!v) return;
  saveState();
  toast(v.quitado ? "Cancelaste las vacaciones." : "¡Bienvenido de vuelta! Desde hoy tus hábitos vuelven a tocar.");
  cjSincronizarDescansos();
  const hoja = document.getElementById("modalOverlay");   // con la hoja de vacaciones abierta, se rearma; si no, la vista
  if (hoja && !hoja.hidden && document.getElementById("vac-resumen")) openVacaciones(); else rerender();
}

/* -------- Lo que se ve en Hábitos e Inicio -------- */
/* Aviso arriba en Hábitos (y en Inicio) mientras estás de vacaciones */
function vacAvisoHtml() {
  const v = vacHoy(); if (!v) return "";
  return `<div class="dsc-aviso">${icoUI("tree-palm")}<div><b>De vacaciones hasta ${escapeHtml(dscDiaTxt(v.hasta, true))}</b>
    <span class="text-xs muted">Vuelves ${escapeHtml(dscDiaTxt(hmAdd(v.hasta, 1), true))} · ${escapeHtml(vacQuienesTxt(v))}</span></div>
    <button class="btn-ghost" data-action="dsc-vac-fin" data-id="${escapeAttr(v.id)}">Volví antes</button></div>`;
}
/* "Hoy descansan: Entrenar e Inglés" (Inicio, dentro de Hábitos de hoy) */
function dscHoyHtml(descansan) {
  if (!descansan.length) return "";
  return `<div class="dsc-hoy text-xs muted">${icoUI("moon")} Hoy descansan: ${escapeHtml(cjNombres(descansan.map(h => h.nombre)))}</div>`;
}

/* -------- Calendario: los días de descanso y de vacaciones -------- */
function dscCalendario(year, m, push) {
  const mm = String(m + 1).padStart(2, "0"), pref = `${year}-${mm}-`, n = daysInMonth(year, m);
  for (let d = 1; d <= n; d++) {
    const iso = pref + String(d).padStart(2, "0");
    const v = hmVacaciones().find(x => x.desde <= iso && iso <= x.hasta);
    if (v) push(d, { icon: "🌴", label: iso === v.hasta ? `De vacaciones · vuelves ${dscDiaTxt(hmAdd(v.hasta, 1))}` : "De vacaciones", type: "descanso", sub: vacQuienesTxt(v) });
  }
  (STATE.habitos.descansos || []).forEach(x => {
    if (!x || x.quitado || !String(x.fecha).startsWith(pref)) return;
    const h = dscDef(x.hid); if (!h) return;
    push(+x.fecha.slice(8), { icon: "😴", label: "Descansa: " + h.nombre, type: "descanso", sub: "Día de descanso" });
  });
}

/* -------- Las acciones (data-action="dsc-…") -------- */
function descansoAccion(a, d, el) {
  if (a === "dsc-dia") { dscAlternar(d.id, d.f); return; }
  if (a === "dsc-vacaciones") { openVacaciones(); return; }
  if (a === "dsc-vac-ok") { vacGuardar(); return; }
  if (a === "dsc-vac-fin") { vacFin(d.id); return; }
  if (a === "dsc-vac-todos") {
    const todos = d.v === "1";
    document.querySelectorAll('[data-action="dsc-vac-todos"]').forEach(b => { const on = b.dataset.v === d.v; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
    const box = document.getElementById("vac-habs"); if (box) box.hidden = todos;
    vacResumen();
  }
}

/* -------- Hábitos en conjunto: tus descansos se comparten (supabase/conjunto.sql) -------- */
/* Tus días de descanso en ese hábito, de hoy en adelante (los de un día y los de vacaciones) */
function cjMisDescansos(h, desde, hasta) {
  const out = [];
  for (let d = desde; d <= hasta; d = hmAdd(d, 1)) if (hmDescanso(h, d)) out.push(d);
  return out;
}
let CJ_DSC_SIN = false, CJ_DSC_CORRE = false;   // sin la tabla en el servidor no se insiste en esta sesión
async function cjSincronizarDescansos() {
  if (CJ_DSC_SIN || CJ_DSC_CORRE || typeof CONJ === "undefined" || !CONJ.lista || !CURRENT_USER || !BACKEND.conjuntoDescansos) return;
  CJ_DSC_CORRE = true;
  try {
    const hoy = hmHoy(), hasta = hmAdd(hoy, 400);
    for (const c of CONJ.lista.filter(x => x.estado === "activo")) {
      const h = cjDef(c), yo = cjYo(c); if (!h || !yo) continue;
      const mios = new Set(cjMisDescansos(h, hoy, hasta)), alla = new Set((yo.descansos || []).filter(d => d >= hoy));
      const poner = [...mios].filter(d => !alla.has(d)), quitar = [...alla].filter(d => !mios.has(d));
      for (const [lista, on] of [[poner, true], [quitar, false]]) {
        for (let i = 0; i < lista.length; i += 60) {
          const r = await BACKEND.conjuntoDescansos(c.id, lista.slice(i, i + 60), on);
          if (r && r.error) { if (r.error === "sin-servidor") CJ_DSC_SIN = true; return; }
        }
      }
      yo.descansos = (yo.descansos || []).filter(d => d < hoy).concat([...mios]).sort();
    }
  } finally { CJ_DSC_CORRE = false; }
}
