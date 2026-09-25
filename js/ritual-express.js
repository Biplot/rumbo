/* ============================================================
   RUMBO · Modo express del ritual diario (apertura y cierre en 3 toques)
   Para los días apretados: el día queda abierto y cerrado de verdad (la racha
   se mantiene) y da la mitad de las monedas del ritual completo.
   Marca: STATE.ritual.dias[iso].express = { apertura?: true, cierre?: true }
   ============================================================ */

const EXPRESS_MONEDAS = { apertura: 25, cierre: 20 };   // la mitad de 50 y 40

/* -------- Lógica (sin pantalla, se puede testear) -------- */

/* Candidatas a primer bocado: la sugerida de ayer, las prioridades de la semana
   sin hacer y las tareas abiertas de hoy (sin repetir), máximo 4. */
function candidatasBocado(S, iso) {
  const out = [], vistos = new Set();
  const add = (txt, ambito) => { txt = (txt || "").trim(); if (!txt || vistos.has(txt) || out.length >= 4) return; vistos.add(txt); out.push({ txt, ambito: ambito === "per" ? "per" : "pro" }); };
  const hoy = tareasDelDia(iso, S).filter(tareaAbierta);
  hoy.filter(t => t.bocadoSugerido).forEach(t => add(t.txt, ambitoDe(t)));
  const L = agLunes(iso), a = (ritualSemana(L, S) || {}).apertura;
  ((a && a.prioridades) || []).filter(p => !prioridadHecha(p, L, S)).forEach(p => add(p.texto, p.ambito));
  hoy.forEach(t => add(t.txt, ambitoDe(t)));
  return out;
}

/* Abre el día en modo express. Las tareas del día quedan como están; el bocado
   se marca en la tarea que ya existe o se crea. Devuelve true si el día se abrió ahora. */
function aplicarAperturaExpress(S, iso, { sapo, ambito, energia }) {
  const prev = S.ritual.dias[iso] || {};
  const nuevo = !prev.hecho;
  sapo = (sapo || "").trim();
  ambito = ambito === "per" ? "per" : "pro";
  S.ritual.dias[iso] = Object.assign({}, prev, {
    sapo, sapoAmbito: ambito, energia: energia || prev.energia || 3, hecho: true,
    express: Object.assign({}, prev.express, { apertura: true }), ts: Date.now(),
  });
  if (nuevo) S.ritual.dias[iso].abiertoTs = Date.now();
  const vivas = tareasDelDia(iso, S).filter(t => estadoTarea(t) === "pendiente" || estadoTarea(t) === "hecha");
  const now = Date.now();
  vivas.forEach(t => { if (t.esSapo && t.txt !== sapo) { delete t.esSapo; t.ts = now; } });
  if (sapo) {
    const ex = vivas.find(t => t.txt === sapo);
    if (ex) { ex.esSapo = true; ex.ambito = ambito; delete ex.bocadoSugerido; ex.ts = now; }
    else nuevaTarea(S, iso, { txt: sapo, ambito, esSapo: true });
  }
  return nuevo;
}

/* Pendientes del cierre express: las crónicas (esta sería su 3.ª postergación o más)
   se deciden una a una; el resto pasa al día siguiente. */
function pendientesCierreExpress(S, iso) {
  const abiertas = tareasDelDia(iso, S).filter(tareaAbierta);
  const esCronica = t => (t.migraciones || 0) + 1 >= CRONICA;
  return { cronicas: abiertas.filter(esCronica), resto: abiertas.filter(t => !esCronica(t)) };
}
/* elecciones: { idTarea: "manana" | "soltar" } solo para las crónicas */
function decisionesCierreExpress(S, iso, elecciones) {
  const { cronicas, resto } = pendientesCierreExpress(S, iso);
  return resto.map(t => ({ iso, id: t.id, v: "manana" }))
    .concat(cronicas.map(t => ({ iso, id: t.id, v: (elecciones || {})[t.id] === "soltar" ? "soltar" : "manana" })));
}
/* Cierra el día en modo express. Devuelve { nuevo, n } (n = conteo de decisiones). */
function aplicarCierreExpress(S, iso, { mood, gratitud, elecciones }) {
  const r = S.ritual.dias[iso];
  const nuevo = !r.cerrado;
  const n = aplicarTriage(S, decisionesCierreExpress(S, iso, elecciones), { base: iso, min: agSumar(iso, 1) });
  const bocado = tareasDelDia(iso, S).find(t => t.esSapo);
  r.cierre = Object.assign({}, r.cierre, {
    sapo: bocado ? estadoTarea(bocado) === "hecha" : !!(r.cierre && r.cierre.sapo),
    mejor: (gratitud || "").trim() || ((r.cierre && r.cierre.mejor) || ""),
  });
  if (tareasDelDia(iso, S).length) r.cierre.tareas = resumenCierre(S, iso);
  r.cerrado = true;
  r.express = Object.assign({}, r.express, { cierre: true });
  r.ts = Date.now();
  // Diario: una entrada por día (ánimo y gratitud)
  S.vida.diario = S.vida.diario || [];
  let e = S.vida.diario.find(x => x.fecha === iso && x.fromRitual);
  if (!e) { e = { id: uid(), fecha: iso, fromRitual: true }; S.vida.diario.push(e); }
  e.mood = mood || e.mood || 3;
  if (r.cierre.mejor) e.gratitud = r.cierre.mejor;
  e.ts = Date.now();
  return { nuevo, n };
}

/* -------- Pantallas -------- */
let EXPRESS_FECHA = null;

function openExpressApertura() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso] || {};
  const cands = candidatasBocado(STATE, iso);
  const actual = tareasDelDia(iso).find(t => t.esSapo);
  const sapo = (actual && actual.txt) || r.sapo || (cands[0] && cands[0].txt) || "";
  const amb = (actual && ambitoDe(actual)) || r.sapoAmbito || (cands[0] && cands[0].ambito) || "pro";
  const energia = r.energia || 3;
  openModal("⚡ Abre tu día · express", `
    <div class="field"><label>${BOCADO.emoji} Tu primer bocado</label>
      ${cands.length ? `<div class="row-wrap" style="gap:6px;margin-bottom:8px">${cands.map(c => `<button type="button" class="chip xp-cand" data-txt="${escapeAttr(c.txt)}" data-amb="${c.ambito}" onclick="expressElegir(this)">${AMBITOS[c.ambito].icon} ${escapeHtml(c.txt)}</button>`).join("")}</div>` : ""}
      <div class="row" style="gap:8px">${ambitoPicker("xp-amb", amb, true)}<input class="input" id="xp-sapo" value="${escapeAttr(sapo)}" placeholder="La tarea que más mueve la aguja hoy" style="flex:1;min-width:0"></div></div>
    <div class="field"><label>⚡ Tu energía</label>
      <div class="seg" id="xp-energia">${[1, 2, 3, 4, 5].map(v => `<button type="button" class="${v === energia ? "is-active" : ""}" data-v="${v}" onclick="segPick(this,'xp-energia-v')">${v}</button>`).join("")}</div>
      <input type="hidden" id="xp-energia-v" value="${energia}"></div>
    <p class="text-xs muted" style="margin:-4px 0 12px">Tus tareas de hoy quedan como están. Puedes completar tu misión y tus tareas después, con el ritual completo.</p>
    <button class="btn btn--primary btn-block" data-action="express-apertura-save">Abrir mi día (+${EXPRESS_MONEDAS.apertura} ⭐)</button>`);
}
function expressElegir(btn) {
  document.getElementById("xp-sapo").value = btn.dataset.txt;
  const h = document.getElementById("xp-amb");
  if (h.value !== btn.dataset.amb) h.nextElementSibling.click();   // alterna el chip de ámbito
}
function saveExpressApertura() {
  const iso = todayISO();
  const nuevo = aplicarAperturaExpress(STATE, iso, {
    sapo: val("xp-sapo"), ambito: val("xp-amb"), energia: parseNum(val("xp-energia-v")),
  });
  const pagado = nuevo && registrarMovimiento("ritual-apertura:" + iso, EXPRESS_MONEDAS.apertura, EXPRESS_MONEDAS.apertura, "Apertura express", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  toast(`⚡ Día abierto${pagado ? ` · +${EXPRESS_MONEDAS.apertura} ⭐` : ""}. ¡Empieza por tu bocado!`);
}

function openExpressCierre(date) {
  const iso = date || todayISO();
  const r = STATE.ritual.dias[iso];
  if (!r || !r.hecho) return toast("Primero abre tu día 🌅", true);
  EXPRESS_FECHA = iso;
  const { cronicas, resto } = pendientesCierreExpress(STATE, iso);
  const dE = (STATE.vida.diario || []).find(e => e.fecha === iso && e.fromRitual);
  const mood = (dE && dE.mood) || 3;
  const esHoy = iso === todayISO();
  const cuando = esHoy ? "mañana" : "al día siguiente";
  openModal(esHoy ? "⚡ Cierra tu día · express" : "⚡ Cerrar el " + agDate(iso).toLocaleDateString("es-CL", { weekday: "long", day: "numeric" }), `
    <div class="field"><label>¿Cómo te sentiste?</label>
      <div class="row mt-8" id="xc-moods" style="gap:8px">
        ${MOODS.map((m, i) => `<button type="button" class="mood-btn ${i + 1 === mood ? "is-on" : ""}" data-v="${i + 1}" onclick="expressMood(this)">${m}</button>`).join("")}
      </div><input type="hidden" id="xc-mood" value="${mood}"></div>
    ${cronicas.length ? `<div class="field"><label>⚠ ${cronicas.length === 1 ? "Ya la postergaste varias veces: ¿vale la pena?" : "Ya las postergaste varias veces: ¿valen la pena?"}</label>
      ${cronicas.map(t => `<div class="flex-between" style="gap:8px;padding:6px 0;flex-wrap:wrap"><span class="text-sm">${escapeHtml(t.txt)} ${chipMigraciones(t)}</span>
        <div class="seg" style="display:inline-flex"><button type="button" class="is-active" data-v="manana" onclick="segPick(this,'xc-c-${t.id}')">&gt; ${cuando === "mañana" ? "Mañana" : "Día siguiente"}</button><button type="button" data-v="soltar" onclick="segPick(this,'xc-c-${t.id}')">✕ Soltar</button></div>
        <input type="hidden" class="xc-cron" id="xc-c-${t.id}" data-id="${t.id}" value="manana"></div>`).join("")}</div>` : ""}
    ${resto.length ? `<div class="field"><label>↪ Pasan a ${cuando} (${resto.length})</label>
      <div class="row-wrap" style="gap:6px">${resto.map(t => `<span class="chip">${t.esSapo ? BOCADO.emoji : AMBITOS[ambitoDe(t)].icon} ${escapeHtml(t.txt)}</span>`).join("")}</div>
      <button type="button" class="btn-ghost mt-8" data-action="day-close" data-date="${iso}">Decidir una por una (cierre completo)</button></div>`
    : (cronicas.length ? "" : `<p class="text-sm muted" style="margin-bottom:12px">No te quedan pendientes. 🎉</p>`)}
    <div class="field"><label>Algo que agradeces (opcional)</label><input class="input" id="xc-gratitud" value="${escapeAttr((r.cierre && r.cierre.mejor) || "")}" placeholder="Una línea basta"></div>
    <button class="btn btn--primary btn-block" data-action="express-cierre-save">Cerrar mi día (+${EXPRESS_MONEDAS.cierre} ⭐)</button>`);
}
function expressMood(btn) {
  document.getElementById("xc-mood").value = btn.dataset.v;
  document.querySelectorAll("#xc-moods .mood-btn").forEach(b => b.classList.toggle("is-on", b === btn));
}
function saveExpressCierre() {
  const iso = EXPRESS_FECHA || todayISO();
  if (!STATE.ritual.dias[iso] || !STATE.ritual.dias[iso].hecho) return toast("Primero abre tu día 🌅", true);
  const elecciones = {};
  document.querySelectorAll(".xc-cron").forEach(el => { elecciones[el.dataset.id] = el.value; });
  const { nuevo, n } = aplicarCierreExpress(STATE, iso, { mood: parseNum(val("xc-mood")), gratitud: val("xc-gratitud"), elecciones });
  const pagado = nuevo && registrarMovimiento("ritual-cierre:" + iso, EXPRESS_MONEDAS.cierre, EXPRESS_MONEDAS.cierre, "Cierre express", true);
  saveState(); closeModal(); updateTopbar(); rerender();
  const t = textoTriage(n);
  toast(`⚡ Día cerrado${pagado ? ` · +${EXPRESS_MONEDAS.cierre} ⭐` : ""}${t ? " · " + t : ""}`);
}
