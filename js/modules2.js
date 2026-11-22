/* ============================================================
   RUMBO · Módulos añadidos (inspirados en Huella)
   Ritual Matutino · Planificador semanal · Entrenamiento
   ============================================================ */

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const PILARES = ["Psicología", "Fisiología", "Productividad", "Magnetismo", "Presencia", "Propósito"];
/* La energía, de 1 a 5 rayos: los mismos nombres en el ritual completo y en el express */
const ENERGIA_ETI = ["Sin pilas", "Poca", "Normal", "Buena", "A tope"];
const PILARES_INFO = {
  "Psicología": { icon: "🧠", desc: "Tu mentalidad y claridad: cómo te hablas, tu actitud y dónde pones el foco mental." },
  "Fisiología": { icon: "⚡", desc: "Tu energía física: sueño, movimiento, alimentación e hidratación." },
  "Productividad": { icon: "🎯", desc: "Enfocarte en lo que de verdad mueve la aguja y ejecutarlo, no en lo urgente-trivial." },
  "Magnetismo": { icon: "🧲", desc: "Cómo te conectas e influyes en otros: tu carisma, generosidad y relaciones." },
  "Presencia": { icon: "🧘", desc: "Estar plenamente en el momento, sin distracción ni piloto automático." },
  "Propósito": { icon: "🌟", desc: "Tu porqué: el sentido y la dirección detrás de lo que haces." },
};
function openPilaresInfo() {
  openModal("Los 6 pilares del Alto Rendimiento", `
    <p class="text-sm muted" style="margin-bottom:14px">Cada vez que abres tu ritual eliges el pilar en el que quieres enfocarte ese día. Con el tiempo ves cuáles cultivas más.</p>
    ${PILARES.map(p => `<div class="row" style="gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)">
      <span style="font-size:22px;line-height:1">${PILARES_INFO[p].icon}</span>
      <div><div class="card__title" style="font-size:14.5px">${p}</div>
        <div class="text-xs muted mt-8">${PILARES_INFO[p].desc}</div></div></div>`).join("")}`);
}

/* ============================================================
   RITUAL MATUTINO
   ============================================================ */
let RITUAL_VIEW = "dia";   // dia | semana | mes
function renderRitual() {
  const seg = elFiltros([["dia", "🌅 Día"], ["semana", "📅 Semana"], ["mes", "🗓️ Mes"], ["trimestre", "🧭 Trimestre"]], RITUAL_VIEW, { accion: "ritual-view", label: "Ritual" });
  const avisos = typeof cadenaRecordatorioHtml === "function" ? cadenaRecordatorioHtml() : "";   // rituales-cadena.js (antes: tarjetas grandes)
  if (RITUAL_VIEW === "trimestre") return seg + avisos + renderRitualTrimestre();
  if (RITUAL_VIEW === "mes") return seg + avisos + renderRitualMes();
  if (RITUAL_VIEW === "semana") return seg + avisos + renderRitualSemana();
  return seg + avisos + renderRitualDia();
}
function renderRitualDia() {
  const iso = todayISO();
  const r = STATE.ritual.dias[iso];
  const hecho = r && r.hecho;
  const logros = Object.values(STATE.ritual.dias).filter(x => x.hecho).length;
  const maxPilar = Math.max(1, ...Object.values(STATE.ritual.pilares));

  const cerrado = r && r.cerrado;
  let banner;
  if (!hecho) {
    banner = `<div class="card" data-coral="dia" style="background:var(--coral-btn, var(--coral));color:var(--on-coral)">
      <div class="card__title" style="color:var(--on-coral)">¿Listo para tu ritual de apertura?</div>
      <p class="mt-8" style="opacity:.9">Dos minutos para elegir tu enfoque del día.</p>
      <div class="row-wrap" style="gap:8px"><button class="btn" style="background:var(--on-coral);color:var(--coral-btn, var(--coral))" data-action="day-open">Comenzar ritual</button>
        <button class="btn" style="background:transparent;color:var(--on-coral);border:1px solid var(--on-coral)" data-action="day-open-express">⚡ Express</button></div></div>`;
  } else if (!cerrado) {
    banner = `<div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">✅ Día abierto — a ejecutar</div>
        <div class="text-sm soft mt-8">Cuando termines tu día, ciérralo para reflexionar.</div></div>
        <div class="row" style="gap:8px"><button class="btn btn--soft" data-action="day-open">Editar apertura</button>
          <button class="btn btn--soft" data-action="day-close-express">⚡ Express</button>
          <button class="btn btn--primary"${dayState() === "por-cerrar" ? ' data-coral="dia"' : ""} data-action="day-close">🌙 Cerrar el día</button></div></div></div>`;
  } else {
    banner = `<div class="card" style="background:linear-gradient(120deg, var(--cian-soft), var(--surface))">
      <div class="flex-between" style="flex-wrap:wrap;gap:12px"><div><div class="card__title">🌙 Día cerrado</div>
        <div class="text-sm soft mt-8">${escapeHtml((r.cierre && r.cierre.mejor) || "Ritual completo. Mañana volvemos a empezar.")}</div></div>
        <button class="btn btn--soft" data-action="day-close">Editar cierre</button></div></div>`;
  }

  const box = (titulo, contenido, vacio) => `<div class="card ritual-card">
    <div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em">${titulo}</div>
    <div class="mt-8">${contenido || `<span class="muted">${vacio}</span>`}</div></div>`;

  const energia = r && r.energia
    ? `<div class="energy">${Array.from({ length: 5 }, (_, i) => `<span class="${i < r.energia ? "on" : ""}"></span>`).join("")}</div>`
    : `<span class="muted">Sin definir</span>`;

  return `
  <div class="flex-between" style="flex-wrap:wrap;gap:10px">
    <div class="pill pill--streak" data-action="info-racha" role="button" tabindex="0">🔥 ${(n => n === 1 ? "1 día cerrado" : n + " días cerrados")(computeClosedStreak())} seguidos</div>
    <div class="pill pill--pts">🏆 ${logros} rituales completados</div>
  </div>
  <div class="mt-16">${renderPendingYesterday()}<div data-tour="ritual-dia">${banner}</div>${typeof reabrirCardHtml === "function" ? reabrirCardHtml() : ""}</div>

  ${!hecho ? `<div class="card mt-24"><div class="text-xs muted" style="text-transform:uppercase;letter-spacing:.06em">Al abrir tu día eliges</div>
    <div class="row-wrap mt-8" style="gap:8px">${["🎯 Tu misión", BOCADO.emoji + " Tu " + BOCADO.corto.toLowerCase(), "🏛️ Tu pilar", "⚡ Tu energía", "🙌 A quién sirves", "📋 Tus tareas"].map(t => `<span class="chip">${t}</span>`).join("")}</div></div>` : `<div class="grid grid-3 mt-24">
    ${box("Misión de hoy", r && escapeHtml(r.mision), "Todavía no defines tu misión.")}
    ${box(BOCADO.titulo + " de hoy", r && escapeHtml(r.sapo), "La tarea que más mueve la aguja.")}
    ${box("Pilar de hoy", r && r.pilar ? `<span class="chip chip--cian">${escapeHtml(r.pilar)}</span>` : "", "No elegido.")}
    ${box("Nivel de energía", energia)}
    ${box("A quién sirves hoy", r && escapeHtml(r.servir), "No definido.")}
    ${box("Proyectos de hoy", r && r.proyectos && r.proyectos.length ? r.proyectos.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join(" ") : "", "Sin proyectos.")}
  </div>`}

  <div class="card mt-24">
    <div class="card__head"><div class="card__title">Los 6 pilares del Alto Rendimiento</div>
      <button class="icon-btn" data-action="pilares-info" title="¿Qué son?" aria-label="Explicación" style="font-size:18px">❔</button></div>
    <div class="mt-16">
      ${PILARES.map(p => {
        const v = STATE.ritual.pilares[p] || 0;
        return `<div class="pilar-row"><span style="width:110px" class="text-sm">${p}</span>
          <div class="bar"><div class="bar__fill" style="width:${Math.round((v / maxPilar) * 100)}%"></div></div>
          <span class="chip">${v}</span></div>`;
      }).join("")}
    </div>
  </div>`;
}

/* op: { mision: misión elegida (una reciente), foco: id del campo donde parte el cursor } */
function openRitualModal(op) {
  op = op || {};
  // El lunes, el día 1 o al empezar un trimestre, primero la semana, el mes o el trimestre (rituales-cadena.js)
  if (!op.cadena && typeof cadenaInterceptar === "function" && cadenaInterceptar({ tipo: "completo", op })) return;
  const r = STATE.ritual.dias[todayISO()] || {};
  let misionDefault = op.mision || r.mision || "", misionDeSemana = false;
  if (!misionDefault) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yc = STATE.ritual.dias[isoLocal(y)];
    if (yc && yc.cierre && yc.cierre.manana) misionDefault = yc.cierre.manana;
  }
  if (!misionDefault && typeof misionDejadaParaHoy === "function") misionDefault = misionDejadaParaHoy();   // «Deja listo mañana» (activacion.js)
  // Si no, la prioridad de tu semana que dejaste para hoy
  const pHoy = !misionDefault && typeof prioridadDeHoy === "function" ? prioridadDeHoy() : null;
  if (pHoy) { misionDefault = pHoy.texto; misionDeSemana = true; }
  const lista = tareasDelDia(todayISO());
  const vivas = lista.filter(t => ["pendiente", "hecha"].includes(estadoTarea(t)));
  // Las que vienen de días anteriores (postergadas) se muestran aparte: ya están en tu lista de hoy
  const bocadoPrev = vivas.find(t => t.esSapo);
  const sugerido = !r.sapo && !bocadoPrev ? vivas.find(t => t.bocadoSugerido && tareaAbierta(t)) : null;
  // (el bocado sugerido va en su cuadro, no en la lista de las que vienen)
  const vienen = vivas.filter(t => (t.migraciones > 0 || t.bocadoSugerido) && !t.esSapo && t !== sugerido);
  const propias = vivas.filter(t => !vienen.includes(t) && t !== sugerido);
  const tareasDe = a => propias.filter(t => !t.esSapo && ambitoDe(t) === a).map(t => t.txt).join("\n");
  // Las que vienen de otros días se quedan aunque no estén en los cuadros: cuentan para la capacidad
  RITUAL_VIENEN = vivas.filter(t => t.migraciones > 0 || t.bocadoSugerido).map(t => t.txt);
  const sapoDefault = r.sapo || (bocadoPrev && bocadoPrev.txt) || (sugerido && sugerido.txt) || "";
  const bocadoAmb = r.sapoAmbito || (bocadoPrev ? ambitoDe(bocadoPrev) : sugerido ? ambitoDe(sugerido) : "pro");
  const uno = aperturaUnCampo();
  if (uno) return openAperturaUnCampo({ op, r, misionDefault: misionDefault || sapoDefault, misionDeSemana, bocadoAmb, tareasDe, vienen });
  openModal("Ritual de apertura", `
    ${typeof cadenaBarraDia === "function" ? cadenaBarraDia(op) : ""}
    ${!r.hecho && typeof pendientesEnAperturaHtml === "function" ? pendientesEnAperturaHtml() : ""}
    ${gcalAperturaHtml()}${plAperturaHtml()}
    <div class="field"><label>Misión de hoy</label><input class="input" id="r-mision" value="${escapeAttr(misionDefault)}" placeholder="¿Qué hará hoy un gran día?">
      ${misionDeSemana ? `<div class="text-xs mt-8 hl-cian">↳ Viene de la prioridad que dejaste para hoy en tu semana</div>` : ""}
      ${!r.hecho && typeof aperturaRecientesHtml === "function" ? aperturaRecientesHtml(misionDefault) : ""}</div>

    ${prioridadesSemanaMini()}
    <div class="field"><label>📋 Tareas del día</label>
      <div style="background:var(--coral-soft);border:1px solid var(--coral);border-radius:var(--r-sm);padding:12px;margin-bottom:10px">
        <label style="color:var(--coral);margin-bottom:6px">${BOCADO.emoji} ${BOCADO.titulo} — la tarea más importante (empieza por aquí)</label>
        <input class="input" id="r-sapo" value="${escapeAttr(sapoDefault)}" placeholder="La que más mueve la aguja hoy" oninput="ritualCapHint()">
        ${STATE.settings.aperturaSimple ? `<div class="text-xs mt-8 soft">¿Cómo te comes un elefante? Un bocado a la vez: haz esta primero y lo demás pesa menos.${typeof glosa === "function" ? " " + glosa("bocado", "¿Por qué «bocado»?") : ""}</div>` : ""}
        ${sugerido ? `<div class="text-xs mt-8" style="color:var(--coral)">↪ Ayer no alcanzaste tu primer bocado; te lo dejé como sugerencia.</div>` : ""}
        <div class="mt-8">${elAmbito("r-sapo-amb", bocadoAmb, { label: "Tu primer bocado: ¿profesional o personal?" })}</div>
      </div>
      <div class="grid grid-2" style="gap:10px">
        <div><label class="text-xs muted" style="display:block;margin-bottom:6px">${AMBITOS.pro.icon} ${AMBITOS.pro.label} (una por línea)</label>
          <textarea class="input" id="r-tareas-pro" style="min-height:88px" placeholder="Ej: Enviar propuesta&#10;Revisar informe" oninput="ritualCapHint()">${escapeHtml(tareasDe("pro"))}</textarea></div>
        <div><label class="text-xs muted" style="display:block;margin-bottom:6px">${AMBITOS.per.icon} ${AMBITOS.per.label} (una por línea)</label>
          <textarea class="input" id="r-tareas-per" style="min-height:88px" placeholder="Ej: Llamar al banco&#10;Comprar para la semana" oninput="ritualCapHint()">${escapeHtml(tareasDe("per"))}</textarea></div>
      </div>
      ${vienen.length ? `<div class="vienen mt-8"><div class="text-xs muted">↪ Vienen de días anteriores (${vienen.length}) · ya están en tu lista de hoy</div>
        <div class="row-wrap mt-8" style="gap:6px">${vienen.map(t => `<span class="chip">${AMBITOS[ambitoDe(t)].icon} ${escapeHtml(t.txt)}${t.migraciones ? ` · ↪ ${t.migraciones}` : ""}</span>`).join("")}</div></div>` : ""}
      <div class="text-xs muted mt-8" id="r-cap">${capacidadHint(contarTareasRitual(sapoDefault, tareasDe("pro"), tareasDe("per"), RITUAL_VIENEN), tmCapacidad(STATE, todayISO()))}</div>
      <div class="text-xs muted mt-8">Tu primer bocado y estas tareas aparecen juntos en Inicio y en tu Semana.</div>
      <button type="button" class="btn-link text-xs mt-8" data-action="apertura-modo" data-v="uno">Usar un solo campo: «lo más importante de hoy»</button></div>

    ${aperturaExtrasHtml(r)}
    <div class="modal__cta">${r.hecho ? `<button class="btn btn--primary btn-block" data-action="ritual-save">Guardar cambios</button>`
      : `<button class="btn btn--primary btn-block btn--precio" data-action="ritual-save"><span>Abrir mi día</span><span class="btn__precio">+50 ${iconoLinea("estrella", 16)}</span></button>`}</div>`);
  if (op.foco) enfocarCampo(op.foco);
}
/* -------- v153: un solo «lo más importante de hoy» --------
   Las cuentas nuevas (aperturaSimple) abren el día con un solo campo que guarda la misión y el primer bocado a la vez,
   y las tareas como renglones (Enter agrega otro). settings.misionAparte: true = misión y bocado separados (como siempre),
   false = un campo. Sin elegir: un campo para las cuentas nuevas, separados para las de antes. */
function aperturaUnCampo() {
  const m = STATE.settings.misionAparte;
  return m === false || (m == null && !!STATE.settings.aperturaSimple);
}
function cambiarModoApertura(v) {
  STATE.settings.misionAparte = v !== "uno";
  saveState(); openRitualModal({ cadena: { n: 1, total: 1 } });   // sin volver a pasar por la cadena
}
function openAperturaUnCampo({ op, r, misionDefault, misionDeSemana, bocadoAmb, tareasDe, vienen }) {
  const filas = [["pro", tareasDe("pro")], ["per", tareasDe("per")]].flatMap(([a, txt]) => txt.split("\n").filter(Boolean).map(t => ({ a, t })));
  const glosaB = typeof glosa === "function" ? " " + glosa("bocado", "¿Por qué «bocado»?") : "";
  openModal("Abre tu día", `
    ${typeof cadenaBarraDia === "function" ? cadenaBarraDia(op) : ""}
    ${!r.hecho && typeof pendientesEnAperturaHtml === "function" ? pendientesEnAperturaHtml() : ""}
    ${gcalAperturaHtml()}${plAperturaHtml()}
    <div class="field apert-lo"><label for="r-mision">🎯 Lo más importante de hoy</label>
      <input class="input" id="r-mision" value="${escapeAttr(misionDefault)}" placeholder="Lo que más mueve la aguja hoy" oninput="aperturaSincronizar()" autocomplete="off">
      <div class="text-xs mt-8 soft">Empieza por aquí: es tu misión y tu primer bocado.${glosaB}</div>
      ${misionDeSemana ? `<div class="text-xs mt-8 hl-cian">↳ Viene de la prioridad que dejaste para hoy en tu semana</div>` : ""}
      ${!r.hecho && typeof aperturaRecientesHtml === "function" ? aperturaRecientesHtml(misionDefault) : ""}
      <input type="hidden" id="r-sapo" value="${escapeAttr(misionDefault)}"><input type="hidden" id="r-sapo-amb" value="${bocadoAmb}"></div>
    <div class="field"><label for="r-nueva">¿Algo más para hoy? <span class="text-xs muted">(opcional)</span></label>
      <div class="apert-tareas" id="r-lista">${filas.map(f => aperturaFilaHtml(f.t, f.a)).join("")}</div>
      <div class="row mt-8" style="gap:8px">${ambitoPicker("r-nueva-amb", bocadoAmb, true)}<input class="input" id="r-nueva" placeholder="Otra tarea…" enterkeyhint="enter" autocomplete="off"
          onkeydown="if (event.key === 'Enter') { event.preventDefault(); aperturaTareaAgregar(); }">
        <button type="button" class="btn btn--cian" onclick="aperturaTareaAgregar()" aria-label="Agregar tarea">+</button></div>
      <textarea id="r-tareas-pro" hidden>${escapeHtml(tareasDe("pro"))}</textarea><textarea id="r-tareas-per" hidden>${escapeHtml(tareasDe("per"))}</textarea>
      ${vienen.length ? `<div class="vienen mt-8"><div class="text-xs muted">↪ Vienen de días anteriores (${vienen.length}) · ya están en tu lista de hoy</div>
        <div class="row-wrap mt-8" style="gap:6px">${vienen.map(t => `<span class="chip">${AMBITOS[ambitoDe(t)].icon} ${escapeHtml(t.txt)}${t.migraciones ? ` · ↪ ${t.migraciones}` : ""}</span>`).join("")}</div></div>` : ""}
      <div class="text-xs muted mt-8" id="r-cap"></div>
      <button type="button" class="btn-link text-xs mt-8" data-action="apertura-modo" data-v="dos">Separar misión y primer bocado</button></div>
    ${aperturaExtrasHtml(r)}
    <div class="modal__cta">${r.hecho ? `<button class="btn btn--primary btn-block" data-action="ritual-save">Guardar cambios</button>`
      : `<button class="btn btn--primary btn-block btn--precio" data-action="ritual-save"><span>Abrir mi día</span><span class="btn__precio">+50 ${iconoLinea("estrella", 16)}</span></button>`}</div>`);
  ritualCapHint();
  if (op.foco) enfocarCampo(op.foco === "r-sapo" ? "r-nueva" : "r-mision");
}
function aperturaFilaHtml(txt, amb) {
  return `<div class="apert-tarea" data-amb="${amb}" data-txt="${escapeAttr(txt)}"><span>${AMBITOS[amb].icon} ${escapeHtml(txt)}</span>
    <button type="button" class="icon-btn" onclick="aperturaTareaQuitar(this)" aria-label="Quitar ${escapeAttr(txt)}">✕</button></div>`;
}
/* Los renglones se guardan en los cuadros de siempre (ocultos): saveRitual no cambia */
function aperturaVolcar() {
  const filas = [...document.querySelectorAll("#r-lista .apert-tarea")];
  ["pro", "per"].forEach(a => { const t = document.getElementById("r-tareas-" + a); if (t) t.value = filas.filter(f => f.dataset.amb === a).map(f => f.dataset.txt).join("\n"); });
  ritualCapHint();
}
function aperturaTareaAgregar() {
  const i = document.getElementById("r-nueva"), txt = i ? i.value.trim() : ""; if (!txt) return;
  const amb = val("r-nueva-amb") === "pro" ? "pro" : "per";
  document.getElementById("r-lista").insertAdjacentHTML("beforeend", iconizar(aperturaFilaHtml(txt, amb)));
  i.value = ""; i.focus(); aperturaVolcar();
}
function aperturaTareaQuitar(btn) { const f = btn.closest(".apert-tarea"); if (f) f.remove(); aperturaVolcar(); }
function aperturaSincronizar() { const m = document.getElementById("r-mision"), s = document.getElementById("r-sapo"); if (m && s) s.value = m.value; ritualCapHint(); }

/* Pilar, energía, a quién sirves y proyectos. En las cuentas nuevas (aperturaSimple) van plegados en «Más para tu día»
   y el pilar parte sin elegir; quien los abre una vez los encuentra abiertos la próxima (settings.aperturaMas). */
function aperturaExtrasHtml(r) {
  const simple = !!STATE.settings.aperturaSimple;
  const campos = `
    <div class="field"><label>Pilar de hoy${simple ? ` <span class="text-xs muted">(opcional)</span>` : ""}</label>
      ${elLista("r-pilar", PILARES.map(p => ({ v: p, t: p, d: (PILARES_INFO[p] || {}).desc || "" })), simple ? (r.pilar || "") : (r.pilar || PILARES[0]), { label: "Pilar de hoy" })}</div>
    <div class="field"><label>Tu energía</label>
      ${elEscala("r-energia", r.energia || 3, { ico: "rayo", etiquetas: ENERGIA_ETI, label: "Tu energía, de 1 a 5" })}</div>
    <div class="field"><label for="r-servir">¿A quién sirves hoy?</label><input class="input" id="r-servir" value="${escapeAttr(r.servir || "")}" placeholder="Persona, equipo, cliente...">
      ${simple ? `<div class="text-xs muted mt-8">A quién le sirve lo que haces hoy: le da sentido a tu día.</div>` : ""}</div>
    <div class="field"><label for="r-proy">Proyectos de hoy (separa con comas)</label><input class="input" id="r-proy" value="${escapeAttr((r.proyectos || []).join(", "))}" placeholder="Proyecto A, Proyecto B"></div>`;
  if (!simple) return campos;
  const abierto = STATE.settings.aperturaMas === true || !!(r.pilar || r.servir || (r.proyectos || []).length);
  return `<details class="r-mas" id="r-mas" ${abierto ? "open" : ""} ontoggle="aperturaMasToggle(this.open)">
    <summary><span class="r-mas__t">Más para tu día</span><span class="r-mas__d">tu energía, tu pilar y a quién sirves</span></summary>${campos}</details>`;
}
function aperturaMasToggle(open) { if (!!STATE.settings.aperturaMas !== !!open) { STATE.settings.aperturaMas = !!open; saveState(); } }
/* Deja el cursor al final de un campo de la ventana (como al tocar la barra de búsqueda de una app de viajes) */
function enfocarCampo(id) {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el.setSelectionRange && el.type !== "range") { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} }
    el.scrollIntoView({ block: "center" });
  }, 60);
}
/* Cuántas tareas quedan en el plan del día (sin repetir líneas) */
let RITUAL_VIENEN = [];
function contarTareasRitual(sapo, pro, per, vienen) {
  const set = new Set([pro, per].flatMap(x => String(x || "").split("\n").map(s => s.trim()).filter(Boolean)));
  if (sapo && sapo.trim()) set.add(sapo.trim());
  (vienen || []).forEach(t => set.add(t));
  return set.size;
}
function ritualCapHint() {
  const el = document.getElementById("r-cap"); if (!el) return;
  const n = contarTareasRitual(val("r-sapo"), document.getElementById("r-tareas-pro").value, document.getElementById("r-tareas-per").value, RITUAL_VIENEN);
  el.innerHTML = iconizar(capacidadHint(n, tmCapacidad(STATE, todayISO())));
}
function saveRitual() {
  const iso = todayISO();
  const prev = STATE.ritual.dias[iso];
  const yaHecho = prev && prev.hecho;
  const pilar = document.getElementById("r-pilar").value;
  // ...prev conserva el cierre/estado del día si ya estaba cerrado (no borrar historial)
  STATE.ritual.dias[iso] = {
    ...(prev || {}),
    mision: val("r-mision"), sapo: val("r-sapo"), sapoAmbito: val("r-sapo-amb") === "per" ? "per" : "pro", pilar,
    energia: parseNum(document.getElementById("r-energia").value),
    servir: val("r-servir"),
    proyectos: val("r-proy").split(",").map(s => s.trim()).filter(Boolean),
    hecho: true,
    ts: Date.now(),
  };
  if (!yaHecho) STATE.ritual.dias[iso].abiertoTs = Date.now();   // a qué hora abriste el día (descubrimientos)
  // Tareas del día → registro diario (hoy). Se empareja por texto para conservar id,
  // estado e historia; solo se marca `ts` si la tarea cambió (no pisar otro dispositivo).
  const sapoTxt = val("r-sapo");
  const sapoAmb = STATE.ritual.dias[iso].sapoAmbito;
  const leer = id => document.getElementById(id).value.split("\n").map(s => s.trim()).filter(Boolean);
  const vivas = tareasDelDia(iso).filter(t => ["pendiente", "hecha"].includes(estadoTarea(t)));
  const porTxt = txt => vivas.find(t => t.txt === txt);
  const vistos = new Set(), now = Date.now();
  const ajustar = (t, esSapo, ambito) => {
    let cambio = false;
    if (!!t.esSapo !== esSapo) { if (esSapo) t.esSapo = true; else delete t.esSapo; cambio = true; }
    if (ambitoDe(t) !== ambito) { t.ambito = ambito; cambio = true; }
    if (esSapo && t.bocadoSugerido) { delete t.bocadoSugerido; cambio = true; }
    if (cambio) t.ts = now;
  };
  // Si cambió el primer bocado, el anterior deja de serlo
  vivas.forEach(t => { if (t.esSapo && t.txt !== sapoTxt) { delete t.esSapo; t.ts = now; } });
  if (sapoTxt) {
    const ex = porTxt(sapoTxt);
    if (ex) ajustar(ex, true, sapoAmb); else nuevaTarea(STATE, iso, { txt: sapoTxt, ambito: sapoAmb, esSapo: true });
    vistos.add(sapoTxt);
  }
  [["pro", leer("r-tareas-pro")], ["per", leer("r-tareas-per")]].forEach(([ambito, lines]) => lines.forEach(txt => {
    if (vistos.has(txt)) return;   // misma línea en ambos cuadros: se queda la primera
    vistos.add(txt);
    const ex = porTxt(txt);
    if (ex) ajustar(ex, false, ambito); else nuevaTarea(STATE, iso, { txt, ambito });
  }));
  // Las tareas de hoy que se quitaron de los cuadros se borran; las que vienen de otros días se quedan
  vivas.filter(t => !vistos.has(t.txt) && !(t.migraciones > 0) && !t.bocadoSugerido).forEach(borrarTarea);

  if (!yaHecho) {
    if (pilar) STATE.ritual.pilares[pilar] = (STATE.ritual.pilares[pilar] || 0) + 1;
    const primero = !Object.keys(STATE.ritual.dias).some(k => k !== iso && STATE.ritual.dias[k] && STATE.ritual.dias[k].hecho);
    registrarMovimiento("ritual-apertura:" + iso, 50, 50, "Ritual de apertura");
    vibrar(20);
    if (primero && STATE.settings.aperturaSimple && typeof celebrarPrimerDia === "function") setTimeout(celebrarPrimerDia, 450);   // bienvenida.js
  }
  saveState(); closeModal(); updateTopbar(); rerender();
}

let CIERRE_DATE = null;
function openCierreModal(date) {
  const iso = date || todayISO();
  CIERRE_DATE = iso;
  if (!puedeCerrarDia(iso)) return toast("Primero abre tu día 🌅", true);
  if (typeof cieloPrecargar === "function") cieloPrecargar();   // por si cerrar el día trae una medalla
  const r = STATE.ritual.dias[iso] || {};
  const esHoy = iso === todayISO();
  const c = r.cierre || {};
  const dEntry = (STATE.vida.diario || []).find(e => e.fecha === iso && e.fromRitual);
  const moodCur = dEntry ? dEntry.mood : 3;
  const dObj = new Date(iso + "T12:00:00");
  const tareasDia = tareasDelDia(iso);
  const sapoTask = tareasDia.find(t => t.esSapo);
  // Pendientes del día (el primer bocado primero): se decide qué pasa con cada una
  const pendientes = tareasDia.filter(tareaAbierta).sort((a, b) => (b.esSapo ? 1 : 0) - (a.esSapo ? 1 : 0));
  const tr = tareasDia.length ? tareasResumen(tareasDia) : (c.tareas || null);
  const sapoDone = c.sapo !== undefined ? c.sapo : (sapoTask ? estadoTarea(sapoTask) === "hecha" : false);
  const sapoCur = sapoDone ? "1" : "0";
  const fechaLarga = dObj.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  const corrige = !esHoy && !!r.cerrado;   // un día pasado ya cerrado (reabierto)
  const titulo = esHoy ? "Cierra tu " + dObj.toLocaleDateString("es-CL", { weekday: "long" }) : (corrige ? "Corregir el " : "Cerrar el ") + fechaLarga;
  const mananaLabel = esHoy ? "Una cosa para mañana" : "Una cosa para el día siguiente";
  // v153: a la vista, lo que importa al cerrar (ánimo, tus hábitos, lo pendiente y una cosa para mañana); lo demás, plegado
  const misionIgual = !!(r.mision && r.sapo && r.mision.trim() === r.sapo.trim());   // un solo «lo más importante»: una sola pregunta
  const hechas = tr ? tr.pro[0] + tr.per[0] : 0;
  const misionDef = c.mision || (sapoDone ? "si" : hechas ? "parcial" : "no");   // deducida (antes partía en «Sí» aunque no hubieras hecho nada)
  const masAbierto = STATE.settings.cierreMas === true || (STATE.settings.cierreMas == null && !STATE.settings.aperturaSimple);
  const habs = cierreHabitosHtml(iso);
  openModal(titulo, `
    ${corrige ? `<p class="reabrir-aviso">✏️ Día reabierto: cambia lo que quieras y toca «Guardar cambios». Las ⭐ del cierre no se vuelven a dar.</p>` : ""}
    ${finRecorridoHtml(iso, r, sapoTask)}
    <div class="field"><label>¿Cómo te sentiste ${esHoy ? "hoy" : "ese día"}? <b class="mood-eti" id="c-mood-eti">${MOOD_ETI[moodCur - 1] || ""}</b></label>
      <div class="row mt-8" id="c-moods" style="gap:8px">
        ${MOODS.map((m, i) => `<button type="button" class="mood-btn ${i + 1 === moodCur ? "is-on" : ""}" data-v="${i + 1}" aria-label="${MOOD_ETI[i]}" title="${MOOD_ETI[i]}" aria-pressed="${i + 1 === moodCur}" onclick="cierreMoodPick(this)">${m}</button>`).join("")}
      </div><input type="hidden" id="c-mood" value="${moodCur}"></div>
    ${habs}
    ${typeof djCierreHtml === "function" ? djCierreHtml(iso) : ""}
    ${sapoTask ? `<div class="field"><label>${BOCADO.emoji} ${misionIgual ? "Lo más importante" : "Tu primer bocado"}</label>
        <div class="text-sm">${escapeHtml(sapoTask.txt)} ${estadoTarea(sapoTask) === "hecha" ? '<span class="chip chip--done">✓ hecho</span>'
          : tareaAbierta(sapoTask) ? '<span class="chip chip--coral">pendiente</span>' : `<span class="chip">${signoTarea(sapoTask)}</span>`}</div></div>`
    : `<div class="field"><label>${BOCADO.emoji} ${misionIgual ? "¿Hiciste lo más importante?" : "¿Diste tu primer bocado?"}${r.sapo ? ` <span class="text-xs muted">(${escapeHtml(r.sapo)})</span>` : ""}</label>
      ${elTramos("c-sapo-v", [["1", "Sí"], ["0", "No"]], sapoCur, { label: "¿Diste tu primer bocado?", attrs: 'id="c-sapo"' })}</div>`}
    ${pendientes.length ? `<details class="field cierre-pend" id="c-pend-det"><summary><b>↪ ${pendientes.length} ${pendientes.length === 1 ? "pendiente pasa" : "pendientes pasan"} a ${esHoy ? "mañana" : "hoy"}</b> <span class="cierre-pend__c">Cambiar</span></summary>
      <div id="c-triage" class="mt-8">${triageHtml(pendientes.map(t => ({ t, iso })), Object.assign({ base: iso }, triageCierreCfg(iso)))}</div></details>` : ""}
    <div class="field"><label>${mananaLabel}</label><input class="input" id="c-manana" value="${escapeAttr(c.manana || "")}" placeholder="Se sembrará como tu misión del día siguiente"></div>
    ${typeof norteDespertarHtml === "function" ? norteDespertarHtml(iso) : ""}
    <details class="r-mas cierre-mas" id="c-mas" ${masAbierto ? "open" : ""} ontoggle="cierreMasToggle(this.open)">
      <summary><span class="r-mas__t">Más para tu cierre</span><span class="r-mas__d">tu misión, tu energía, tu gratitud y una nota</span></summary>
      ${misionIgual ? `<input type="hidden" id="c-mision-igual" value="1"><input type="hidden" id="c-mision-v" value="${misionDef}">`
        : `<div class="field"><label>¿Cumpliste tu misión?</label>
        ${elTramos("c-mision-v", [["si", "Sí"], ["parcial", "Parcial"], ["no", "No"]], misionDef, { label: "¿Cumpliste tu misión?", attrs: 'id="c-mision"' })}</div>`}
      ${tr && (tr.pro[1] || tr.per[1]) ? `<div class="field"><label>📋 Tus tareas del día</label>
        <div class="row-wrap"><span class="chip">${AMBITOS.pro.icon} ${AMBITOS.pro.label} ${tr.pro[0]}/${tr.pro[1]}</span>
          <span class="chip">${AMBITOS.per.icon} ${AMBITOS.per.label} ${tr.per[0]}/${tr.per[1]}</span></div></div>` : ""}
      <div class="field"><label>Energía con la que terminas</label>
        ${elEscala("c-energia", c.energia || 3, { ico: "rayo", etiquetas: ENERGIA_ETI, label: "Energía con la que terminas, de 1 a 5" })}</div>
      <div class="field"><label>Lo mejor del día / gratitud</label><textarea class="input" id="c-mejor" placeholder="¿Qué agradeces de hoy?">${escapeHtml(c.mejor || "")}</textarea></div>
      <div class="field"><label>Nota de cierre (libre)</label><textarea class="input" id="c-nota" placeholder="¿Cómo estuvo el día?">${escapeHtml(c.nota || "")}</textarea></div>
    </details>
    <p class="text-xs muted" style="margin:-4px 0 12px">📔 Tu ánimo, tu nota y tu gratitud se guardan en tu <b>Diario de vida</b>.</p>
    ${typeof cadenaDomingoHtml === "function" ? cadenaDomingoHtml(iso) : ""}
    <div class="modal__cta">${r.cerrado ? `<button class="btn btn--primary btn-block" data-action="cierre-save">Guardar cambios</button>`
      : `<button class="btn btn--primary btn-block btn--precio" data-action="cierre-save"><span>Cerrar el día</span><span class="btn__precio">+40 ${iconoLinea("estrella", 16)}</span></button>`}</div>`);
}
function cierreMasToggle(open) { if (STATE.settings.cierreMas !== !!open) { STATE.settings.cierreMas = !!open; saveState(); } }
/* Tus hábitos de ese día, para marcar al cerrar (antes el cierre no los preguntaba) */
function cierreHabitosLista(iso) {
  return (STATE.habitos.defs || []).filter(h => h && !h.pausado && !h.conjunto && hmMeta(h) === "hacer" && hmCreado(h) <= iso
    && (hmProgramado(h, iso, STATE) || hmDone(h, iso, STATE)));
}
function cierreHabitosHtml(iso) {
  const l = cierreHabitosLista(iso); if (!l.length) return "";
  return `<div class="field"><label>✅ Tus hábitos de ${iso === todayISO() ? "hoy" : "ese día"}</label>
    <div class="cierre-habs" id="c-habs">${l.map(h => { const on = hmDone(h, iso, STATE); return `<button type="button" class="cierre-hab ${on ? "is-on" : ""}" data-action="cierre-hab" data-id="${h.id}" data-f="${iso}" aria-pressed="${on}">${icoHab(h.icon, 16)} <span>${escapeHtml(h.nombre)}</span>${on ? " ✓" : ""}</button>`; }).join("")}</div></div>`;
}
function cierreMarcarHabito(id, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  toggleHabitDate(id, y, m - 1, d);
  const b = document.querySelector(`#c-habs [data-id="${id}"]`), h = (STATE.habitos.defs || []).find(x => x.id === id);
  if (b && h) { const on = hmDone(h, iso, STATE); b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); b.innerHTML = iconizar(`${icoHab(h.icon, 16)} <span>${escapeHtml(h.nombre)}</span>${on ? " ✓" : ""}`); }
}
/* Fin del recorrido: las horas de tu día, como el resumen de un viaje al llegar */
function finRecorridoHtml(iso, r, sapoTask) {
  const hitos = [];
  if (r.abiertoTs) hitos.push({ h: horaCorta(r.abiertoTs), t: "Abriste", c: "abre" });
  if (sapoTask && estadoTarea(sapoTask) === "hecha") hitos.push({ h: sapoTask.hechaTs ? horaCorta(sapoTask.hechaTs) : "Hecho", t: BOCADO.corto, c: "bocado" });
  if (r.cerradoTs) hitos.push({ h: horaCorta(r.cerradoTs), t: "Cerraste", c: "ahora" });
  else if (iso === todayISO()) hitos.push({ h: horaCorta(Date.now()), t: "Ahora", c: "ahora" });
  if (hitos.length < 2) return "";
  return `<div class="fin-ruta"><div class="fin-ruta__eti">Fin del recorrido</div>
    <ol class="fin-ruta__linea">${hitos.map(x => `<li class="is-${x.c}"><span class="fin-ruta__m" aria-hidden="true"></span><b>${x.h}</b><span>${x.t}</span></li>`).join("")}</ol></div>`;
}
function cierreMoodPick(btn) {
  const eti = document.getElementById("c-mood-eti");
  if (eti) eti.textContent = MOOD_ETI[+btn.dataset.v - 1] || "";
  document.getElementById("c-mood").value = btn.dataset.v;
  document.querySelectorAll("#c-moods .mood-btn").forEach(b => b.classList.remove("is-on"));
  btn.classList.add("is-on");
}
function saveCierre() {
  const iso = CIERRE_DATE || todayISO();
  const r = diaParaCerrar(iso);
  if (!r) return toast("Primero abre tu día 🌅", true);
  const yaCerrado = r.cerrado;
  const semana = typeof cadenaDomingoLeer === "function" && cadenaDomingoLeer();   // el domingo: dejar lista la semana
  if (typeof djCierreGuardar === "function") djCierreGuardar(iso);   // lo que estás dejando: confirmar o caí (dejar.js)
  // Decisiones sobre las pendientes (mañana, otro día, delegar, soltar, la hice)
  const trCont = document.getElementById("c-triage");
  const decid = trCont ? aplicarTriage(STATE, leerTriage(trCont), Object.assign({ base: iso }, triageCierreCfg(iso))) : null;
  const sapoTask = tareasDelDia(iso).find(t => t.esSapo);
  const sapoEl = document.getElementById("c-sapo-v");
  const sapoHecho = sapoTask ? estadoTarea(sapoTask) === "hecha" : !!(sapoEl && sapoEl.value === "1");
  r.cierre = {
    mision: document.getElementById("c-mision-igual") ? (sapoHecho ? "si" : "no") : document.getElementById("c-mision-v").value,
    sapo: sapoHecho,
    energia: parseNum(document.getElementById("c-energia").value),
    mejor: val("c-mejor"), manana: val("c-manana"), nota: val("c-nota"),
  };
  // Resumen del día para métricas (hechas, movidas, soltadas… por ámbito)
  if (tareasDelDia(iso).length) r.cierre.tareas = resumenCierre(STATE, iso);
  r.cerrado = true;
  if (!yaCerrado) r.cerradoTs = Date.now();   // a qué hora cerraste (insignias Noche Serena y Búho)
  r.ts = Date.now();

  // Conecta el cierre con el Diario de vida: una entrada por día, actualizable
  const mood = parseNum(document.getElementById("c-mood").value) || 3;
  STATE.vida.diario = STATE.vida.diario || [];
  let dEntry = STATE.vida.diario.find(e => e.fecha === iso && e.fromRitual);
  if (!dEntry) { dEntry = { id: uid(), fecha: iso, fromRitual: true }; STATE.vida.diario.push(dEntry); }
  dEntry.mood = mood;
  dEntry.texto = r.cierre.nota || "";
  dEntry.gratitud = r.cierre.mejor || "";
  dEntry.ts = Date.now();

  if (!yaCerrado) registrarMovimiento("ritual-cierre:" + iso, 40, 40, "Ritual de cierre");
  const medallas = !yaCerrado && typeof cierreMedallasEmpieza === "function";   // las que gane se muestran al final
  if (medallas) cierreMedallasEmpieza();
  if (typeof notaElefanteGuardar === "function") notaElefanteGuardar(iso);   // 🐘 la nota de tu elefante sobre tu día (nota-elefante.js)
  if (typeof norteDespertarGuardar === "function") norteDespertarGuardar(iso);   // ⏰ a qué hora te despierta Norte (norte.js)
  saveState(); closeModal(); updateTopbar(); rerender();
  const hubo = medallas && cierreMedallasTermina();
  if (STATE.gamif.equipped && STATE.gamif.equipped.confeti) launchConfetti();
  const ofrece = !yaCerrado && !semana && typeof activacionTrasCierre === "function" && activacionTrasCierre();   // el 1.er y 3.er cierre ofrecen los avisos
  if (!yaCerrado) { sonar("cierre"); vibrar([15, 60, 25]); animarRacha(); if (!hubo && !semana && !ofrece && typeof celebrarCierreElefante === "function") celebrarCierreElefante(); }
  const resumenTr = decid ? textoTriage(decid) : "";
  if (yaCerrado) toast(resumenTr ? `Cambios guardados ✓ · ${resumenTr}` : "Cambios guardados ✓");
  else toast(resumenTr ? `Día cerrado 🌙 · ${resumenTr}` : "Día cerrado 🌙 ¡Descansa!");
  if (semana && typeof cadenaDomingoEmpezar === "function") cadenaDomingoEmpezar(iso);
}

/* ============================================================
   BITÁCORA · historial de rituales (estilo bullet journal)
   ============================================================ */
let BITA_OPEN = {};

/* (La Bitácora vive en el Diario de vida: vida.js. Reabrir un día: consumibles.js) */

/* ============================================================
   PLANIFICADOR SEMANAL
   ============================================================ */
let SEM_LUNES = null;   // lunes de la semana que muestra el planificador (null = la actual)
/* La pantalla Semana vive en ritual-semana.js (renderSemana) */
function guardarPremioSemana(lunes, v) {
  STATE.ritual.semanas = STATE.ritual.semanas || {};
  const w = STATE.ritual.semanas[lunes] = STATE.ritual.semanas[lunes] || {};
  w.plan = Object.assign({}, w.plan || {}, { premio: String(v || "").trim(), ts: Date.now() });
  saveState();
}

/* ============================================================
   ENTRENAMIENTO
   ============================================================ */
/* renderEntrenamiento: ahora es la pestaña Entrenar de Salud (js/salud.js) */

let DIA_TARGET = null;
function openDiaModal() {
  openModal("Nuevo día de entrenamiento", `
    <div class="field"><label>Nombre del día</label><input class="input" id="dia-nombre" placeholder="Ej: Día 4 · Full body"></div>
    <button class="btn btn--primary btn-block" data-action="entren-dia-save">Crear día</button>`);
}
function saveDia() {
  const nombre = val("dia-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  STATE.entrenamiento.dias.push({ id: uid(), nombre, premiado: false, bloques: [] });
  saveState(); closeModal(); rerender();
}
function openBloqueModal(diaId) {
  DIA_TARGET = diaId;
  openModal("Nuevo bloque", `
    <div class="field"><label>Nombre del bloque</label><input class="input" id="blk-nombre" placeholder="Ej: Bloque A · Press banca"></div>
    <div class="field"><label>Series x reps</label><input class="input" id="blk-series" placeholder="Ej: 4x8"></div>
    <button class="btn btn--primary btn-block" data-action="entren-bloque-save">Agregar bloque</button>`);
}
function saveBloque() {
  const nombre = val("blk-nombre"); if (!nombre) return toast("Ponle un nombre", true);
  const dia = STATE.entrenamiento.dias.find(x => x.id === DIA_TARGET);
  dia.bloques.push({ id: uid(), nombre, series: val("blk-series"), done: false });
  saveState(); closeModal(); rerender();
}
