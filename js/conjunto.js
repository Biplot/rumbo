/* ============================================================
   RUMBO · Hábitos en conjunto (Amigos, etapa 2)
   Un hábito que haces con uno o más amigos. Cada uno lo tiene como un hábito suyo
   (STATE.habitos.defs, id "cj-<id>" y conjunto: id): lo marca como cualquier otro, le da
   sus estrellas y cuenta para su racha. Lo compartido vive en supabase/conjunto.sql:
   quiénes están y qué días cumplió cada uno (la app sube tus marcas de la última semana).
   · Racha de a dos (o del grupo): hmRachaConjunto, en habitos-motor.js.
   · +5 ⭐ a cada uno el día que cumplen todos (ledger "conjunto:<id>:<día>").
   · Si sales, el hábito se queda contigo con su historial.
   ============================================================ */

/* Lo que se tiene en memoria: la lista del servidor (limpia) y cómo va la carga */
const CONJ = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] };
const CJ_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/* -------- Lo que llega del servidor lo escribieron otras personas: se limpia antes de usarlo -------- */
function cjIcono(ic) { return iconoDeEmoji(ic) ? String(ic).slice(0, 16) : "✅"; }
function cjFecha(f) { const s = String(f || "").slice(0, 10); return CJ_FECHA.test(s) ? s : ""; }
function cjFrecuencia(f) {
  f = f && typeof f === "object" ? f : {};
  return hmFreq({ frecuencia: { tipo: String(f.tipo || ""), veces: parseInt(f.veces, 10) || 1, dias: Array.isArray(f.dias) ? f.dias.slice(0, 7) : [] } });
}
function cjLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  return {
    id: String(x.id || "").slice(0, 64), nombre: String(x.nombre || "").trim().slice(0, 60) || "Hábito",
    icon: cjIcono(x.icono), frecuencia: cjFrecuencia(x.frecuencia), creado: cjFecha(x.creado) || todayISO(),
    estado: x.estado === "activo" ? "activo" : "invitado", invita: String(x.invita || ""),
    miembros: (Array.isArray(x.miembros) ? x.miembros : []).slice(0, 8).map(m => ({
      id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60), avatar: (m && m.avatar) || null,
      estado: m && m.estado === "activo" ? "activo" : "invitado", desde: cjFecha(m && m.desde),
      marcas: (Array.isArray(m && m.marcas) ? m.marcas : []).map(cjFecha).filter(Boolean),
    })),
  };
}

/* -------- Lecturas -------- */
function cjDef(c) { return c ? STATE.habitos.defs.find(h => h.conjunto === c.id) || null : null; }
function cjDeDef(h) { return h && h.conjunto ? (CONJ.lista || []).find(c => c.id === h.conjunto) || null : null; }
function cjYo(c) { return c.miembros.find(m => m.yo) || null; }
/* Tus marcas, según tu propio registro (manda lo que marcaste en este teléfono, aunque no se haya subido) */
function cjMisMarcas(h, desde) {
  const out = [], hoy = hmHoy();
  for (let d = hmMax(desde, hmAdd(hoy, -400)); d <= hoy; d = hmAdd(d, 1)) if (hmDone(h, d)) out.push(d);
  return out;
}
/* Los activos, con tus marcas tomadas de tu registro */
function cjMiembros(c) {
  const h = cjDef(c);
  return c.miembros.filter(m => m.estado === "activo").map(m => m.yo && h ? Object.assign({}, m, { marcas: cjMisMarcas(h, m.desde || c.creado) }) : m);
}
function cjRacha(c) { return hmRachaConjunto({ frecuencia: c.frecuencia, creado: c.creado }, cjMiembros(c)); }
function cjRachaTxt(c) {
  const r = cjRacha(c); if (!r.n) return "";
  const u = r.unidad === "sem" ? (r.n === 1 ? "semana" : "semanas") : r.unidad === "meses" ? (r.n === 1 ? "mes" : "meses") : (r.n === 1 ? "día" : "días");
  return `${r.n} ${u} de racha ${c.miembros.filter(m => m.estado === "activo").length === 2 ? "de a dos" : "del grupo"}`;
}
/* "Ana", "Ana y Bruno", "Ana, Bruno y Cami" */
function cjNombres(ns) { return ns.length <= 1 ? ns.join("") : ns.slice(0, -1).join(", ") + " y " + ns[ns.length - 1]; }
function cjCon(c) { return cjNombres(c.miembros.filter(m => !m.yo).map(m => m.nombre || "Sin nombre")); }
/* Cuánto lleva cada uno en el período de hoy: hecho hoy (diarios y días fijos) o n/meta (semana o mes) */
function cjProgreso(c, m) {
  const f = c.frecuencia, hoy = todayISO();
  if (f.tipo !== "semanal" && f.tipo !== "mensual") return { hecho: m.marcas.includes(hoy) };
  const ini = f.tipo === "semanal" ? hmLunes(hoy) : hmMesIni(hoy), fin = f.tipo === "semanal" ? hmAdd(ini, 6) : hmMesFin(hoy);
  const n = m.marcas.filter(d => d >= ini && d <= fin).length;
  return { hecho: n >= f.veces, n, meta: f.veces };
}

/* -------- Cargar y mantener al día -------- */
async function conjuntoCargar(forzar) {
  if (!CURRENT_USER || !STATE || CONJ.cargando || !BACKEND.conjuntoLista) return;
  if (!forzar && (CONJ.lista || CONJ.error) && Date.now() - CONJ.t < 60000) return;   // a lo más una vez por minuto
  CONJ.cargando = true;
  const r = await BACKEND.conjuntoLista();
  CONJ.cargando = false; CONJ.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { CONJ.error = r.error; cjRepintar(); return; }
  CONJ.error = null;
  CONJ.lista = (Array.isArray(r) ? r : []).map(cjLimpio).filter(c => c.id && cjYo(c));
  if (cjAjustarHabitos()) saveState();
  await cjSubirMarcas();
  cjPremios();
  const nueva = CONJ.lista.find(c => c.estado === "invitado" && !CONJ.vistas.includes(c.id));
  CONJ.lista.forEach(c => { if (!CONJ.vistas.includes(c.id)) CONJ.vistas.push(c.id); });
  if (nueva && CURRENT !== "amigos") toast(`🤝 ${cjQuienInvita(nueva)} te invita a «${nueva.nombre}»`);
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  cjRepintar();
}
function cjQuienInvita(c) { const m = c.miembros.find(x => x.id === c.invita); return (m && m.nombre) || "Un amigo"; }
/* Repinta la vista si muestra hábitos en conjunto (y no estás escribiendo en ella) */
function cjRepintar() {
  if (!["amigos", "inicio", "habitos"].includes(CURRENT)) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view")) return;
  rerender();
}

/* Tu copia de cada hábito en conjunto: se crea si falta, toma el nombre, el ícono y la
   frecuencia de todos, y si ya no estás en él se queda contigo como hábito propio */
function cjAjustarHabitos() {
  let cambio = false; const dentro = new Set();
  CONJ.lista.filter(c => c.estado === "activo").forEach(c => {
    dentro.add(c.id);
    let h = cjDef(c);
    if (!h) {
      h = STATE.habitos.defs.find(x => x.id === "cj-" + c.id);
      if (!h) STATE.habitos.defs.push(h = { id: "cj-" + c.id, creado: cjYo(c).desde || c.creado });
      h.conjunto = c.id; h.ts = Date.now(); cambio = true;
    }
    if (h.nombre !== c.nombre || h.icon !== c.icon || JSON.stringify(hmFreq(h)) !== JSON.stringify(c.frecuencia) || h.pausado) {
      Object.assign(h, { nombre: c.nombre, icon: c.icon, frecuencia: c.frecuencia, pausado: false, ts: Date.now() }); cambio = true;
    }
  });
  STATE.habitos.defs.forEach(h => { if (h.conjunto && !dentro.has(h.conjunto)) { delete h.conjunto; h.ts = Date.now(); cambio = true; } });
  return cambio;
}
/* Sube tus marcas de la última semana que el servidor todavía no tiene (p. ej. las de sin conexión) */
async function cjSubirMarcas() {
  const hoy = todayISO(), cola = [];
  CONJ.lista.filter(c => c.estado === "activo").forEach(c => {
    const h = cjDef(c), yo = cjYo(c); if (!h) return;
    for (let d = hmMax(yo.desde || c.creado, hmAdd(hoy, -7)); d <= hoy; d = hmAdd(d, 1)) {
      const mio = hmDone(h, d);
      if (mio !== yo.marcas.includes(d)) cola.push({ c, yo, d, mio });
    }
  });
  for (const x of cola) {
    const r = await BACKEND.conjuntoMarcar(x.c.id, x.d, x.mio);
    if (!r || r.error) continue;
    x.yo.marcas = x.mio ? [...new Set(x.yo.marcas.concat(x.d))].sort() : x.yo.marcas.filter(d => d !== x.d);
    if (x.mio && x.d === hoy) BACKEND.amigosAvisar("conjunto-marca", { habito: x.c.id, fecha: x.d, racha: cjRacha(x.c).n });
  }
}
/* +5 ⭐ a cada uno el día que cumplen todos (la última semana; si alguien desmarca, se anula) */
function cjPremios() {
  const hoy = todayISO(), ganados = [];
  (CONJ.lista || []).filter(c => c.estado === "activo").forEach(c => {
    const h = cjDef(c), yo = cjYo(c); if (!h) return;
    const ms = cjMiembros(c);
    for (let d = hmMax(yo.desde || c.creado, hmAdd(hoy, -7)); d <= hoy; d = hmAdd(d, 1)) {
      const id = "conjunto:" + c.id + ":" + d, todos = hmTodosConjunto(ms, d);
      if (todos && !ledgerVigente(STATE, id)) { if (registrarMovimiento(id, 5, 5, "Hábito en conjunto", true)) ganados.push(c); }
      else if (!todos && ledgerVigente(STATE, id)) anularMovimiento(id);
    }
  });
  if (ganados.length) { toast(`🤝 ¡Lo hicieron todos! «${ganados[0].nombre}» +5 ⭐`); refreshPts(5 * ganados.length); }
}
/* Al marcar o desmarcar tu copia (toggleHabitDate): avisa a los demás y revisa si cumplieron todos */
async function conjuntoAlMarcar(habitId, iso) {
  const h = STATE && STATE.habitos.defs.find(x => x.id === habitId);
  if (!h || !h.conjunto || !CURRENT_USER || !BACKEND.conjuntoMarcar) return;
  const c = cjDeDef(h), yo = c && cjYo(c), hecho = hmDone(h, iso);
  if (yo && iso < (yo.desde || c.creado)) return;
  const r = await BACKEND.conjuntoMarcar(h.conjunto, iso, hecho);
  if (!r || r.error) return;   // se sube después, al cargar (cjSubirMarcas)
  if (!c) return conjuntoCargar(true);
  yo.marcas = hecho ? [...new Set(yo.marcas.concat(iso))].sort() : yo.marcas.filter(d => d !== iso);
  if (hecho) BACKEND.amigosAvisar("conjunto-marca", { habito: c.id, fecha: iso, racha: cjRacha(c).n });
  if (!!r.todos !== hmTodosConjunto(cjMiembros(c), iso)) return conjuntoCargar(true);   // alguien marcó hace poco: se trae de nuevo
  cjPremios(); cjRepintar();
}

/* -------- Crear, invitar, unirse, editar y salir -------- */
function cjAmigosElegidos() { return [...document.querySelectorAll("#cj-amigos input:checked")].map(i => i.value); }
/* Desde el formulario de hábito (saveHabit): crea el hábito en conjunto y tu copia */
async function conjuntoCrearHabito(datos, amigos) {
  if (amigos.length > 7) { toast("Puedes hacerlo con hasta 7 amigos", true); return false; }
  const icon = cjIcono(datos.icon), r = await BACKEND.conjuntoCrear(datos.nombre, icon, datos.frecuencia, amigos, todayISO());
  if (r && r.error) { toast(cjTextoError(r.error), true); return false; }
  STATE.habitos.defs.push({ id: "cj-" + r.id, conjunto: r.id, nombre: datos.nombre.trim().slice(0, 60), icon, frecuencia: datos.frecuencia, creado: todayISO(), ts: Date.now() });
  BACKEND.amigosAvisar("conjunto-invita", { habito: r.id });
  const ns = cjNombres(amigos.map(id => { const a = amigoPorId(id); return (a && a.nombre) || "tu amigo"; }));
  setTimeout(() => toast(`🤝 Le avisamos a ${ns}. Cuando se sume, lo verás en tu hábito.`), 50);
  conjuntoCargar(true);
  return true;
}
/* Editar tu copia de un hábito en conjunto: el cambio va para todos; y las invitaciones nuevas */
async function conjuntoGuardar(h, datos, amigos) {
  const icon = cjIcono(datos.icon), freq = datos.frecuencia;
  if (datos.nombre !== h.nombre || icon !== h.icon || JSON.stringify(hmFreq({ frecuencia: freq })) !== JSON.stringify(hmFreq(h))) {
    const r = await BACKEND.conjuntoEditar(h.conjunto, datos.nombre, icon, freq);
    if (r && r.error) { toast(cjTextoError(r.error), true); return false; }
  }
  if (amigos.length) {
    const r = await BACKEND.conjuntoInvitar(h.conjunto, amigos);
    if (r && r.error) { toast(cjTextoError(r.error), true); return false; }
    BACKEND.amigosAvisar("conjunto-invita", { habito: h.conjunto });
  }
  Object.assign(h, { nombre: datos.nombre.trim().slice(0, 60), icon, frecuencia: freq, pausado: false, ts: Date.now() });
  conjuntoCargar(true);
  return true;
}
async function conjuntoResponder(id, acepta) {
  const r = await BACKEND.conjuntoResponder(id, acepta, todayISO());
  if (r && r.error) return toast(cjTextoError(r.error), true);
  if (acepta && r.habito) {
    const c = cjLimpio(Object.assign({}, r.habito, { estado: "activo" }));
    let h = STATE.habitos.defs.find(x => x.conjunto === c.id || x.id === "cj-" + c.id);
    if (!h) STATE.habitos.defs.push(h = { id: "cj-" + c.id, creado: cjFecha(r.habito.desde) || todayISO() });
    Object.assign(h, { conjunto: c.id, nombre: c.nombre, icon: c.icon, frecuencia: c.frecuencia, pausado: false, ts: Date.now() });
    saveState();
    toast(`🤝 Te sumaste a «${c.nombre}». Ya está en tus hábitos.`);
    BACKEND.amigosAvisar("conjunto-acepta", { habito: c.id });
  }
  closeModal();
  await conjuntoCargar(true);
}
/* Salir: tu copia se queda contigo, con su historial */
async function conjuntoSalir(id) {
  const h = STATE.habitos.defs.find(x => x.conjunto === id), c = (CONJ.lista || []).find(x => x.id === id);
  const nombre = (c && c.nombre) || (h && h.nombre) || "este hábito";
  if (!confirm(`¿Salir de «${nombre}»? El hábito se queda contigo, con tu historial, y tus amigos dejan de verte en él.`)) return;
  const r = await BACKEND.conjuntoSalir(id);
  if (r && r.error) return toast(cjTextoError(r.error), true);
  if (h) { delete h.conjunto; h.ts = Date.now(); saveState(); }
  closeModal(); toast("Saliste del hábito en conjunto. Sigue en tus hábitos.");
  await conjuntoCargar(true); rerender();
}
/* Eliminar tu copia: primero sales del hábito en conjunto (si no, volvería al cargar) */
async function conjuntoEliminarHabito(h) {
  if (!confirm("¿Eliminar este hábito y su historial? También sales del hábito en conjunto.")) return;
  const r = await BACKEND.conjuntoSalir(h.conjunto);
  if (r && r.error) return toast(cjTextoError(r.error), true);
  STATE.habitos.defs = STATE.habitos.defs.filter(x => x.id !== h.id);
  saveState(); closeModal(); rerender(); conjuntoCargar(true);
}
function cjTextoError(e) {
  return {
    "sin-servidor": "Los hábitos en conjunto todavía no están activos en el servidor.",
    amigos: "Elige al menos un amigo (hasta 7).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no estás en este hábito en conjunto.",
    limite: "Llegaste al máximo: hasta 8 personas por hábito y 30 hábitos en conjunto.",
    nombre: "Ponle un nombre de hasta 60 letras.",
  }[e] || amigosTextoError(e);
}

/* -------- Acciones (data-action="cj-…", ver onClick en app.js) -------- */
function conjuntoAccion(a, d) {
  if (a === "cj-unirme") return conjuntoResponder(d.id, true);
  if (a === "cj-rechazar") return conjuntoResponder(d.id, false);
  if (a === "cj-salir") return conjuntoSalir(d.id);
  if (a === "cj-nuevo") { closeModal(); return openHabitModal(null, { amigos: d.amigo ? [d.amigo] : [] }); }
  if (a === "cj-ver") { const h = STATE.habitos.defs.find(x => x.conjunto === d.id); if (h) openHabitModal(h.id); return; }
}

/* -------- Dibujo -------- */
/* La sección «Con amigos» del formulario de hábito */
function cjSeccionModal(h, pre) {
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  const checks = (lista, marcados) => `<div class="cj-amigos" id="cj-amigos">${lista.map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}" ${marcados.includes(a.id) ? "checked" : ""}>${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div>`;
  if (h && h.conjunto) {
    const c = cjDeDef(h), dentro = new Set(c ? c.miembros.map(m => m.id) : []);
    const libres = amigos.filter(a => !dentro.has(a.id));
    return `<div class="field cj-modal"><label>Con amigos</label>
      ${c ? `<div class="cj-quien">${c.miembros.map(m => `<span class="cj-q${m.estado === "invitado" ? " is-inv" : ""}">${amigosAvatar(m, 22)}<i>${m.yo ? "Tú" : escapeHtml(m.nombre || "Sin nombre")}${m.estado === "invitado" ? " · invitado" : ""}</i></span>`).join("")}</div>` : ""}
      <p class="text-xs muted mt-8">El nombre, el ícono y la frecuencia son los mismos para todos: si los cambias, cambian para todos.</p>
      ${libres.length && c && c.miembros.length < 8 ? `<div class="text-xs muted mt-8">Invitar a alguien más</div>${checks(libres, [])}` : ""}
      <button type="button" class="btn-ghost btn-block mt-8" data-action="cj-salir" data-id="${escapeHtml(h.conjunto)}">Salir del hábito en conjunto</button></div>`;
  }
  if (h || !amigosCfg().activo || CONJ.error === "sin-servidor" || !amigos.length) return "";
  return `<div class="field cj-modal"><label>Con amigos <span class="muted" style="font-weight:500">(opcional)</span></label>
    ${checks(amigos, pre || [])}
    <p class="text-xs muted mt-8">Lo hacen juntos: cada uno lo marca en su Rumbo y ven quién ya cumplió. El día que cumplen todos, +5 ⭐ para cada uno.</p></div>`;
}
/* Una fila: el hábito, cómo va cada uno hoy, la racha de a dos y (opcional) tu botón para marcarlo */
function cjFila(c, conMarcar) {
  const h = cjDef(c), ms = cjMiembros(c), hoy = todayISO();
  const otros = ms.filter(m => !m.yo), invitados = c.miembros.filter(m => m.estado === "invitado");
  const yoP = ms.find(m => m.yo), mioHoy = h ? hmDone(h, hoy) : !!(yoP && yoP.marcas.includes(hoy));
  const quien = ms.map(m => {
    const p = cjProgreso(c, m);
    return `<span class="cj-q${p.hecho ? " is-hecho" : ""}">${amigosAvatar(m, 22)}<i>${m.yo ? "Tú" : escapeHtml(m.nombre || "Sin nombre")}${p.meta ? ` ${p.n}/${p.meta}` : p.hecho ? " ✓" : ""}</i></span>`;
  }).join("");
  const linea = [];
  if (hmTodosConjunto(ms, hoy)) linea.push(`<b class="cj-ok">Hoy lo hicieron todos · +5 ⭐</b>`);
  else if (!mioHoy && otros.some(m => m.marcas.includes(hoy))) {
    const ya = otros.filter(m => m.marcas.includes(hoy));
    linea.push(`<b class="cj-va">${escapeHtml(cjNombres(ya.map(m => m.nombre || "Tu amigo")))} ya lo ${ya.length > 1 ? "hicieron" : "hizo"} hoy · te toca</b>`);
  }
  const racha = cjRachaTxt(c);
  if (racha) linea.push(`<span>🔥 ${racha}</span>`);
  if (!otros.length && invitados.length) linea.push(`<span>Esperando a ${escapeHtml(cjNombres(invitados.map(m => m.nombre || "tu amigo")))}</span>`);
  return `<div class="cj-fila">
    <button type="button" class="cj-fila__q" data-action="cj-ver" data-id="${escapeHtml(c.id)}"><span class="cj-fila__ico">${icoHab(c.icon, 22)}</span>
      <span class="cj-fila__t"><b>${escapeHtml(c.nombre)}</b><span class="text-xs muted">${otros.length || invitados.length ? "con " + escapeHtml(cjCon(c)) + " · " : ""}${escapeHtml(hmFreqLabel(c))}</span></span></button>
    ${conMarcar && h ? `<button type="button" class="cj-marcar${mioHoy ? " is-on" : ""}" data-action="quick-habit" data-id="${escapeHtml(h.id)}" aria-pressed="${mioHoy}">${mioHoy ? "✓ Hecho" : "Marcar"}</button>` : ""}
    <div class="cj-quien">${quien}</div>
    ${linea.length ? `<div class="cj-linea">${linea.join("")}</div>` : ""}</div>`;
}
/* Si todavía no llega la lista (sin conexión), la fila solo con tu copia */
function cjFilaDef(h) {
  const c = cjDeDef(h);
  if (c) return cjFila(c, true);
  const on = hmDone(h, todayISO());
  return `<div class="cj-fila"><span class="cj-fila__q"><span class="cj-fila__ico">${icoHab(h.icon, 22)}</span>
      <span class="cj-fila__t"><b>${escapeHtml(h.nombre)}</b><span class="text-xs muted">con amigos · ${escapeHtml(hmFreqLabel(h))}</span></span></span>
    <button type="button" class="cj-marcar${on ? " is-on" : ""}" data-action="quick-habit" data-id="${escapeHtml(h.id)}" aria-pressed="${on}">${on ? "✓ Hecho" : "Marcar"}</button></div>`;
}
/* Inicio: los hábitos en conjunto, dentro de la tarjeta «Hábitos de hoy» */
function cjInicioHtml(defs) {
  if (!defs.length) return "";
  conjuntoCargar(false);
  return `<div class="cj-inicio"><div class="cj-sub">${icoUI("handshake")} Con amigos</div>${defs.map(cjFilaDef).join("")}</div>`;
}
/* Hábitos › Hoy: con quién y la racha de a dos, en la tarjeta de tu copia */
function cjResumenHtml(h) {
  const c = cjDeDef(h); if (!c) return `<div class="hb-today__cj">${icoUI("handshake")} con amigos</div>`;
  const r = cjRachaTxt(c);
  return `<div class="hb-today__cj">${icoUI("handshake")} ${c.miembros.length > 1 ? "con " + escapeHtml(cjCon(c)) : "esperando a tus amigos"}${r ? " · " + r : ""}</div>`;
}
/* Amigos: las invitaciones a hábitos */
function cjInvitacionesHtml() {
  const inv = (CONJ.lista || []).filter(c => c.estado === "invitado");
  if (!inv.length) return "";
  return `<div class="card"><div class="card__title">${icoUI("handshake")} Te invitan a un hábito</div>
    ${inv.map(c => `<div class="am-sol cj-inv"><span class="cj-fila__ico">${icoHab(c.icon, 22)}</span><span class="am-sol__t"><b>${escapeHtml(c.nombre)}</b>
      <span class="text-xs muted">${escapeHtml(cjQuienInvita(c))} te invita · ${escapeHtml(hmFreqLabel(c))}${c.miembros.filter(m => !m.yo && m.estado === "activo").length > 1 ? " · con " + escapeHtml(cjNombres(c.miembros.filter(m => !m.yo && m.estado === "activo").map(m => m.nombre || "Sin nombre"))) : ""}</span></span>
      <span class="am-sol__b"><button class="btn-ghost" data-action="cj-rechazar" data-id="${escapeHtml(c.id)}">Ahora no</button><button class="btn btn--primary" data-action="cj-unirme" data-id="${escapeHtml(c.id)}">Unirme</button></span></div>`).join("")}</div>`;
}
/* Amigos: la tarjeta «Hábitos en conjunto» */
function cjAmigosHtml(amigos) {
  if (CONJ.error === "sin-servidor") return `<div class="card"><div class="card__title">${icoUI("handshake")} Hábitos en conjunto</div><p class="text-sm muted mt-8">Todavía no están activos en el servidor. Apenas lo estén, aquí podrás hacer hábitos con tus amigos.</p></div>`;
  const act = (CONJ.lista || []).filter(c => c.estado === "activo");
  const boton = amigos.length ? `<button class="btn btn--soft" data-action="cj-nuevo">${icoUI("handshake")} Hábito con amigos</button>` : "";
  return `<div class="card"><div class="card__title">${icoUI("handshake")} Hábitos en conjunto</div>
    ${act.length ? act.map(c => cjFila(c, true)).join("")
      : `<p class="text-sm muted mt-8">${amigos.length ? "Elige un hábito y hazlo con tus amigos: cada uno lo marca en su Rumbo, ven quién ya cumplió y suman una racha juntos. El día que cumplen todos, +5 ⭐ para cada uno." : "Cuando tengas amigos en Rumbo, aquí podrán hacer hábitos juntos."}</p>`}
    ${boton ? `<div class="mt-16">${boton}</div>` : ""}</div>`;
}
/* El perfil de un amigo: lo que hacen juntos */
function cjJuntosHtml(amigoId) {
  if (CONJ.error === "sin-servidor") return "";
  const juntos = (CONJ.lista || []).filter(c => c.estado === "activo" && c.miembros.some(m => m.id === amigoId && m.estado === "activo"));
  return `<div class="cj-juntos"><div class="cj-sub">Lo que hacen juntos</div>
    ${juntos.length ? juntos.map(c => { const r = cjRachaTxt(c); return `<button type="button" class="cj-junto" data-action="cj-ver" data-id="${escapeHtml(c.id)}">${icoHab(c.icon, 18)}<b>${escapeHtml(c.nombre)}</b><span class="text-xs muted">${r || escapeHtml(hmFreqLabel(c))}</span></button>`; }).join("")
      : `<p class="text-xs muted">Todavía no tienen hábitos juntos.</p>`}
    <button class="btn btn--soft" data-action="cj-nuevo" data-amigo="${escapeHtml(amigoId)}">${icoUI("handshake")} Proponer un hábito</button></div>`;
}
