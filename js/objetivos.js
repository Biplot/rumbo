/* ============================================================
   RUMBO · Objetivos en conjunto (Amigos, etapa 3)
   Una meta con avance sumado entre varios: juntar para un viaje, correr 100 km en el
   mes, leer 12 libros entre todos. Cada uno suma sus aportes; la barra muestra lo de
   cada uno. Todo vive en supabase/objetivos.sql (tus objetivos personales siguen en
   tu documento, solo tuyos).
   · Al lograrlo: +20 ⭐ a cada uno (ledger "objetivo-juntos:<id>") y, la primera vez,
     la medalla En Equipo (logros.js). Si después ya no llega (se borró un aporte o subió
     la meta), se anula.
   · Si sales, tus aportes siguen sumando.
   ============================================================ */

const OBJ = { lista: null, t: 0, cargando: false, error: null, guardando: false, vistas: [] };
/* Un color por persona en la barra (se leen igual de día y de noche); quien salió, en gris */
const OJ_COLORES = ["#5563D6", "#E0951F", "#2F9E74", "#D9644A", "#8A63D2", "#2A9BB8", "#D2508A", "#8C9A2E"], OJ_GRIS = "#9AA1C0";
const OJ_UNIDADES = [["$", "Dinero ($)"], ["km", "Kilómetros"], ["libros", "Libros"], ["horas", "Horas"], ["veces", "Veces"], ["otra", "Otra…"]];

/* -------- Lo que llega del servidor lo escribieron otras personas: se limpia -------- */
function ojNum(v) { const n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
function ojLimpio(x) {
  x = x && typeof x === "object" ? x : {};
  const lista = v => (Array.isArray(v) ? v : []);
  return {
    id: String(x.id || "").slice(0, 64), nombre: String(x.nombre || "").trim().slice(0, 60) || "Objetivo",
    unidad: String(x.unidad || "").trim().slice(0, 12), meta: Math.max(0.01, ojNum(x.meta) || 1),
    fechaLimite: cjFecha(x.fecha_limite), creado: cjFecha(x.creado) || todayISO(), cumplido: cjFecha(x.cumplido),
    estado: x.estado === "activo" ? "activo" : "invitado", invita: String(x.invita || ""),
    miembros: lista(x.miembros).slice(0, 8).map(m => ({ id: String((m && m.id) || ""), yo: !!(m && m.yo), nombre: String((m && m.nombre) || "").slice(0, 60),
      avatar: (m && m.avatar) || null, estado: m && m.estado === "activo" ? "activo" : "invitado", desde: cjFecha(m && m.desde) })),
    totales: lista(x.totales).slice(0, 50).map(t => ({ id: String((t && t.id) || ""), nombre: String((t && t.nombre) || "").slice(0, 60), total: Math.max(0, ojNum(t && t.total)) })),
    aportes: lista(x.aportes).slice(0, 30).map(a => ({ id: parseInt(a && a.id, 10) || 0, user_id: String((a && a.user_id) || ""), cantidad: Math.max(0, ojNum(a && a.cantidad)),
      nota: String((a && a.nota) || "").slice(0, 80), fecha: cjFecha(a && a.fecha) })),
  };
}

/* -------- Lecturas -------- */
function ojYo(o) { return o.miembros.find(m => m.yo) || null; }
function ojTotal(o) { return Math.round(o.totales.reduce((t, x) => t + x.total, 0) * 100) / 100; }
function ojPct(o) { return Math.min(100, Math.floor((ojTotal(o) / o.meta) * 100)); }
/* "$380.000", "64 km", "12,5 horas" */
function ojFmt(n, unidad) {
  if (unidad === "$") return fmtCLP(n);
  const t = (Math.round(n * 100) / 100).toLocaleString("es-CL", { maximumFractionDigits: 2 });
  return unidad ? t + " " + unidad : t;
}
function ojIcono(o) { return icoUI({ $: "piggy-bank", km: "footprints", libros: "book-open", horas: "timer", veces: "repeat" }[o.unidad] || "target"); }
/* Cada persona con su color y lo que lleva: tú primero, después quienes están y al final quienes salieron */
function ojPersonas(o) {
  const tot = id => (o.totales.find(t => t.id === id) || {}).total || 0;
  const act = o.miembros.filter(m => m.estado === "activo").sort((a, b) => b.yo - a.yo);
  const out = act.map((m, i) => ({ id: m.id, yo: m.yo, nombre: m.yo ? "Tú" : m.nombre || "Sin nombre", total: tot(m.id), color: OJ_COLORES[i % OJ_COLORES.length], m }));
  o.totales.filter(t => !act.some(m => m.id === t.id) && t.total > 0)
    .forEach(t => out.push({ id: t.id, yo: false, nombre: (t.nombre || "Alguien") + " (salió)", total: t.total, color: OJ_GRIS, m: null }));
  return out;
}
function ojCon(o) { return cjNombres(o.miembros.filter(m => !m.yo).map(m => m.nombre || "Sin nombre")); }
function ojFechaLarga(iso) { return new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long" }); }
/* Lo que se dice del plazo: logrado, terminado, vence hoy o cuántos días quedan */
function ojPlazo(o) {
  if (o.cumplido) return `Lo lograron el ${ojFechaLarga(o.cumplido)}`;
  if (!o.fechaLimite) return "sin fecha límite";
  const d = Math.round((new Date(o.fechaLimite + "T12:00:00") - new Date(todayISO() + "T12:00:00")) / 864e5);
  if (d < 0) return `terminó el ${ojFechaLarga(o.fechaLimite)}`;
  if (d === 0) return "vence hoy";
  return `hasta el ${ojFechaLarga(o.fechaLimite)} · ${d === 1 ? "queda 1 día" : "quedan " + d + " días"}`;
}

/* -------- Cargar y mantener al día -------- */
async function objetivosCargar(forzar) {
  if (!CURRENT_USER || !STATE || OBJ.cargando || !BACKEND.objetivoLista) return;
  if (!forzar && (OBJ.lista || OBJ.error) && Date.now() - OBJ.t < 60000) return;   // a lo más una vez por minuto
  OBJ.cargando = true;
  const r = await BACKEND.objetivoLista();
  OBJ.cargando = false; OBJ.t = Date.now();
  if (!STATE) return;
  if (r && r.error) { OBJ.error = r.error; ojRepintar(); return; }
  OBJ.error = null;
  OBJ.lista = (Array.isArray(r) ? r : []).map(ojLimpio).filter(o => o.id && ojYo(o));
  ojPremios();
  const nueva = OBJ.lista.find(o => o.estado === "invitado" && !OBJ.vistas.includes(o.id));
  OBJ.lista.forEach(o => { if (!OBJ.vistas.includes(o.id)) OBJ.vistas.push(o.id); });
  if (nueva && CURRENT !== "amigos" && CURRENT !== "metas") toast(`🎯 ${ojQuienInvita(nueva)} te invita al objetivo «${nueva.nombre}»`);
  if (typeof amigosMarcarNav === "function") amigosMarcarNav();
  ojRepintar();
}
function ojQuienInvita(o) { const m = o.miembros.find(x => x.id === o.invita); return (m && m.nombre) || "Un amigo"; }
function ojRepintar() {
  if (!["amigos", "metas"].includes(CURRENT)) return;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest("#view")) return;
  rerender();
}
/* +20 ⭐ a cada uno al lograrlo (la medalla En Equipo la da checkBadges); si deja de estar logrado, se anula */
function ojPremios() {
  const ganados = [];
  (OBJ.lista || []).filter(o => o.estado === "activo").forEach(o => {
    const id = "objetivo-juntos:" + o.id, yo = ojYo(o);
    const vale = !!o.cumplido && (!yo.desde || yo.desde <= o.cumplido);
    if (vale && !ledgerVigente(STATE, id)) { if (registrarMovimiento(id, 20, 20, "Objetivo en conjunto", true)) ganados.push(o); }
    else if (!vale && ledgerVigente(STATE, id)) anularMovimiento(id);
  });
  if (ganados.length) { toast(`🏅 ¡Lo lograron juntos! «${ganados[0].nombre}» +20 ⭐`); refreshPts(20 * ganados.length); vibrar([12, 60, 12]); }
}

/* -------- Crear, editar, invitar, unirse, aportar y salir -------- */
function ojLeerNumero(v, unidad) { return unidad === "$" ? parseNum(v) : parseDecimal(v); }
function ojUnidadForm() { const u = val("oj-unidad"); return u === "otra" ? val("oj-unidad-otra").slice(0, 12) : u; }
async function objetivoGuardar(id) {
  if (OBJ.guardando) return;
  const o = id ? (OBJ.lista || []).find(x => x.id === id) : null;
  const nombre = val("oj-nombre"), unidad = ojUnidadForm(), meta = ojLeerNumero(val("oj-meta"), unidad), limite = val("oj-limite") || null;
  const amigos = [...document.querySelectorAll("#oj-amigos input:checked")].map(i => i.value);
  if (!nombre) return toast("Ponle un nombre", true);
  if (!(meta > 0)) return toast("¿Cuánto quieren lograr? Escribe la meta", true);
  if (!o && !amigos.length) return toast("Elige al menos un amigo", true);
  if (amigos.length > 7) return toast("Puedes hacerlo con hasta 7 amigos", true);
  OBJ.guardando = true;
  try {
    if (o) {
      if (nombre !== o.nombre || unidad !== o.unidad || meta !== o.meta || (limite || "") !== o.fechaLimite) {
        const r = await BACKEND.objetivoEditar(o.id, nombre, unidad, meta, limite);
        if (r && r.error) return toast(ojTextoError(r.error), true);
      }
      if (amigos.length) {
        const r = await BACKEND.objetivoInvitar(o.id, amigos);
        if (r && r.error) return toast(ojTextoError(r.error), true);
        BACKEND.amigosAvisar("objetivo-invita", { objetivo: o.id });
      }
      closeModal(); toast("Objetivo actualizado");
    } else {
      const r = await BACKEND.objetivoCrear(nombre, unidad, meta, limite, amigos, todayISO());
      if (r && r.error) return toast(ojTextoError(r.error), true);
      BACKEND.amigosAvisar("objetivo-invita", { objetivo: r.id });
      closeModal();
      toast(`🎯 Le avisamos a ${cjNombres(amigos.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}. Cuando se sume, empiezan a sumar juntos.`);
    }
  } finally { OBJ.guardando = false; }
  await objetivosCargar(true);
}
async function objetivoResponder(id, acepta) {
  const r = await BACKEND.objetivoResponder(id, acepta, todayISO());
  if (r && r.error) return toast(ojTextoError(r.error), true);
  if (acepta && r.r === "unido") {
    const o = (OBJ.lista || []).find(x => x.id === id);
    toast(`🎯 Te sumaste a «${o ? o.nombre : "el objetivo"}». Está en Objetivos.`);
    BACKEND.amigosAvisar("objetivo-acepta", { objetivo: id });
  }
  closeModal();
  await objetivosCargar(true);
}
async function objetivoAportar(id) {
  if (OBJ.guardando) return;
  const o = (OBJ.lista || []).find(x => x.id === id); if (!o) return;
  const cant = ojLeerNumero(val("oj-cant"), o.unidad);
  if (!(cant > 0)) return toast("Escribe cuánto sumas", true);
  OBJ.guardando = true;
  const r = await BACKEND.objetivoAportar(id, cant, val("oj-nota"), todayISO()).finally(() => { OBJ.guardando = false; });
  if (r && r.error) return toast(ojTextoError(r.error), true);
  closeModal(); vibrar(10);
  toast(`Sumaste ${ojFmt(cant, o.unidad)} a «${o.nombre}»`);
  BACKEND.amigosAvisar("objetivo-aporte", { objetivo: id, aporte: r.id });
  await objetivosCargar(true);
}
async function objetivoBorrarAporte(aporte) {
  if (!confirm("¿Borrar este aporte? Deja de sumar al objetivo.")) return;
  const r = await BACKEND.objetivoBorrarAporte(aporte);
  if (r && r.error) return toast(ojTextoError(r.error), true);
  closeModal(); toast("Aporte borrado");
  await objetivosCargar(true);
}
async function objetivoSalir(id) {
  const o = (OBJ.lista || []).find(x => x.id === id);
  if (!confirm(`¿Salir de «${o ? o.nombre : "este objetivo"}»? Tus aportes siguen sumando para los demás.`)) return;
  const r = await BACKEND.objetivoSalir(id);
  if (r && r.error) return toast(ojTextoError(r.error), true);
  closeModal(); toast("Saliste del objetivo");   // las estrellas que ganaste al lograrlo se quedan contigo
  await objetivosCargar(true);
}
function ojTextoError(e) {
  return {
    "sin-servidor": "Los objetivos en conjunto todavía no están activos en el servidor.",
    amigos: "Elige al menos un amigo (hasta 7).",
    "no-amigos": "Solo puedes invitar a tus amigos.",
    "no-miembro": "Ya no estás en este objetivo.",
    limite: "Llegaste al máximo: hasta 8 personas por objetivo, 20 objetivos en conjunto y 30 aportes al día.",
    nombre: "Ponle un nombre de hasta 60 letras.",
    unidad: "La unidad puede tener hasta 12 letras.",
    meta: "La meta tiene que ser mayor que cero.",
    cantidad: "Escribe cuánto sumas (más que cero).",
  }[e] || amigosTextoError(e);
}

/* -------- Acciones (data-action="oj-…", ver onClick en app.js) -------- */
function objetivosAccion(a, d) {
  if (a === "oj-nuevo") { closeModal(); return openObjetivoForm(null, d.amigo ? [d.amigo] : []); }
  if (a === "oj-editar") return openObjetivoForm(d.id);
  if (a === "oj-guardar") return objetivoGuardar(d.id || null);
  if (a === "oj-ver") return openObjetivo(d.id);
  if (a === "oj-aportar") return openAporte(d.id);
  if (a === "oj-aporte-ok") return objetivoAportar(d.id);
  if (a === "oj-aporte-del") return objetivoBorrarAporte(parseInt(d.id, 10));
  if (a === "oj-unirme") return objetivoResponder(d.id, true);
  if (a === "oj-rechazar") return objetivoResponder(d.id, false);
  if (a === "oj-salir") return objetivoSalir(d.id);
}
/* Al cambiar qué suman: la unidad propia aparece con «Otra…», y la meta dice en qué va */
function ojUnidadCambia(sel) {
  const otra = document.getElementById("oj-otra-box"); if (otra) otra.hidden = sel.value !== "otra";
  const m = document.getElementById("oj-meta-u"); if (m) m.textContent = sel.value === "otra" ? "" : sel.value === "$" ? "en pesos" : "en " + sel.value;
}

/* -------- Dibujo -------- */
function ojBarra(o, alto) {
  const ps = ojPersonas(o), base = Math.max(o.meta, ojTotal(o));
  return `<div class="oj-barra" style="height:${alto || 12}px" role="img" aria-label="${escapeHtml(`${ojFmt(ojTotal(o), o.unidad)} de ${ojFmt(o.meta, o.unidad)}`)}">${ps.filter(p => p.total > 0)
    .map(p => `<i style="width:${(p.total / base) * 100}%;background:${p.color}"></i>`).join("")}</div>`;
}
function ojLeyenda(o) {
  return `<div class="oj-ley">${ojPersonas(o).map(p => `<span><i style="background:${p.color}"></i>${escapeHtml(p.nombre)} · ${escapeHtml(ojFmt(p.total, o.unidad))}</span>`).join("")}</div>`;
}
/* La tarjeta de un objetivo (en Objetivos) */
function ojTarjeta(o) {
  const con = ojCon(o);
  return `<div class="card oj${o.cumplido ? " is-logrado" : ""}">
    <button type="button" class="oj__cab" data-action="oj-ver" data-id="${escapeHtml(o.id)}"><span class="oj__ico">${ojIcono(o)}</span>
      <span class="oj__t"><b>${escapeHtml(o.nombre)}</b><span class="text-xs muted">${con ? "con " + escapeHtml(con) + " · " : ""}${escapeHtml(ojPlazo(o))}</span></span></button>
    <div class="oj__n"><b>${escapeHtml(ojFmt(ojTotal(o), o.unidad))}</b><span class="muted">de ${escapeHtml(ojFmt(o.meta, o.unidad))}</span><span class="oj__pct">${ojPct(o)} %</span></div>
    ${ojBarra(o)}
    ${ojLeyenda(o)}
    ${o.cumplido ? `<div class="oj__logro">${icoUI("medal")} ¡Lo lograron juntos!</div>` : ""}
    <button class="btn ${o.cumplido ? "btn--soft" : "btn--primary"}" data-action="oj-aportar" data-id="${escapeHtml(o.id)}">Sumar un aporte</button></div>`;
}
/* Objetivos: la sección «Con amigos», arriba de tus objetivos personales */
function ojSeccionMetas() {
  if (!amigosCfg().activo) return "";
  objetivosCargar(false);
  if (OBJ.error === "sin-servidor") return "";
  const act = (OBJ.lista || []).filter(o => o.estado === "activo"), inv = (OBJ.lista || []).filter(o => o.estado === "invitado");
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  if (!act.length && !inv.length && !amigos.length) return "";
  const boton = amigos.length ? `<button class="btn btn--soft" data-action="oj-nuevo">${icoUI("handshake")} Objetivo con amigos</button>` : "";
  return `<div class="section-title" style="margin-top:0">Con amigos</div>
    ${ojInvitacionesHtml()}
    ${act.length ? `<div class="grid grid-2 oj-grid">${act.map(ojTarjeta).join("")}</div>${boton ? `<div class="mt-16">${boton}</div>` : ""}`
      : `<div class="card"><p class="text-sm muted" style="margin:0 0 14px">Una meta con avance sumado: juntar para un viaje, correr 100 km en el mes o leer 12 libros entre varios. Cada aporte se ve en la barra, y al lograrlo ganan la medalla En Equipo.</p>${boton}</div>`}
    <div class="section-title">Tus objetivos <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· los personales siguen aquí, solo para ti</span></div>`;
}
/* Invitaciones a objetivos (en Objetivos y en Amigos) */
function ojInvitacionesHtml() {
  const inv = (OBJ.lista || []).filter(o => o.estado === "invitado");
  if (!inv.length) return "";
  return `<div class="card oj-invs"><div class="card__title">${icoUI("mision")} Te invitan a un objetivo</div>
    ${inv.map(o => `<div class="am-sol cj-inv"><span class="cj-fila__ico">${ojIcono(o)}</span><span class="am-sol__t"><b>${escapeHtml(o.nombre)}</b>
      <span class="text-xs muted">${escapeHtml(ojQuienInvita(o))} te invita · ${escapeHtml(ojFmt(o.meta, o.unidad))} · ${escapeHtml(ojPlazo(o))}</span></span>
      <span class="am-sol__b"><button class="btn-ghost" data-action="oj-rechazar" data-id="${escapeHtml(o.id)}">Ahora no</button><button class="btn btn--primary" data-action="oj-unirme" data-id="${escapeHtml(o.id)}">Unirme</button></span></div>`).join("")}</div>`;
}
/* Amigos: una tarjeta con los objetivos en conjunto, en corto */
function ojAmigosHtml(amigos) {
  if (OBJ.error === "sin-servidor") return "";
  const act = (OBJ.lista || []).filter(o => o.estado === "activo");
  if (!act.length && !amigos.length) return "";
  return `<div class="card"><div class="card__title">${icoUI("mision")} Objetivos en conjunto</div>
    ${act.length ? act.map(o => `<button type="button" class="oj-mini" data-action="oj-ver" data-id="${escapeHtml(o.id)}"><span class="oj__ico">${ojIcono(o)}</span>
      <span class="oj__t"><b>${escapeHtml(o.nombre)}</b><span class="text-xs muted">${o.cumplido ? "¡Lo lograron!" : ojPct(o) + " % · " + escapeHtml(ojFmt(ojTotal(o), o.unidad)) + " de " + escapeHtml(ojFmt(o.meta, o.unidad))}</span></span>${ojBarra(o, 6)}</button>`).join("")
      : `<p class="text-sm muted mt-8">Metas con avance sumado, como juntar para un viaje o correr 100 km entre varios.</p>`}
    <div class="mt-16"><button class="btn btn--soft" data-action="oj-nuevo">${icoUI("handshake")} Objetivo con amigos</button></div></div>`;
}
/* El perfil de un amigo: los objetivos que comparten (para «Lo que hacen juntos») */
function ojJuntos(amigoId) {
  return (OBJ.lista || []).filter(o => o.estado === "activo" && o.miembros.some(m => m.id === amigoId && m.estado === "activo"))
    .map(o => `<button type="button" class="cj-junto" data-action="oj-ver" data-id="${escapeHtml(o.id)}">${ojIcono(o)}<b>${escapeHtml(o.nombre)}</b><span class="text-xs muted">${o.cumplido ? "¡Lo lograron!" : ojPct(o) + " %" + (o.unidad === "$" ? " juntado" : "")}</span></button>`);
}

/* El formulario: nuevo objetivo (con amigos elegidos) o editar uno */
function openObjetivoForm(id, pre) {
  const o = id ? (OBJ.lista || []).find(x => x.id === id) : null;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [], dentro = new Set(o ? o.miembros.map(m => m.id) : []);
  const libres = amigos.filter(a => !dentro.has(a.id));
  const uSel = o ? (OJ_UNIDADES.some(([k]) => k === o.unidad) ? o.unidad : "otra") : "$";
  const metaU = uSel === "otra" ? "" : uSel === "$" ? "en pesos" : "en " + uSel;
  openModal(o ? "Editar objetivo" : "🎯 Objetivo con amigos", `
    <div class="field"><label for="oj-nombre">Nombre</label><input class="input" id="oj-nombre" maxlength="60" value="${escapeHtml(o ? o.nombre : "")}" placeholder="Ej: Viaje a Chiloé"></div>
    <div class="oj-form2">
      <div class="field"><label for="oj-unidad">Qué suman</label><select class="input" id="oj-unidad" onchange="ojUnidadCambia(this)">${OJ_UNIDADES.map(([k, l]) => `<option value="${k}" ${k === uSel ? "selected" : ""}>${l}</option>`).join("")}</select>
        <div id="oj-otra-box" class="mt-8" ${uSel === "otra" ? "" : "hidden"}><input class="input" id="oj-unidad-otra" maxlength="12" placeholder="Ej: páginas" value="${escapeHtml(uSel === "otra" ? o.unidad : "")}"></div></div>
      <div class="field"><label for="oj-meta">Meta <span class="muted" id="oj-meta-u" style="font-weight:500">${metaU}</span></label><input class="input" id="oj-meta" inputmode="decimal" value="${o ? escapeHtml(String(o.meta).replace(".", ",")) : ""}" placeholder="Ej: 600000"></div>
    </div>
    <div class="field"><label for="oj-limite">Fecha límite <span class="muted" style="font-weight:500">(opcional)</span></label><input class="input" type="date" id="oj-limite" min="${o ? "" : todayISO()}" value="${o ? o.fechaLimite : ""}"></div>
    ${(o ? libres : amigos).length && (!o || o.miembros.length < 8) ? `<div class="field cj-modal"><label>${o ? "Invitar a alguien más" : "Con quién"}</label>
      <div class="cj-amigos" id="oj-amigos">${(o ? libres : amigos).map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(a.id)}" ${(pre || []).includes(a.id) ? "checked" : ""}>${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div></div>` : ""}
    ${o ? `<p class="text-xs muted">Es el mismo objetivo para todos: si lo cambias, cambia para todos.</p>`
      : `<p class="text-xs muted">Cada uno suma sus aportes y la barra muestra lo de cada uno. Al lograrlo, +20 ⭐ para cada uno y la medalla En Equipo.</p>`}
    <button class="btn btn--primary btn-block mt-8" data-action="oj-guardar" data-id="${o ? escapeHtml(o.id) : ""}">${o ? "Guardar cambios" : "Crear objetivo"}</button>
    ${o ? `<button class="btn-ghost btn-block mt-8" data-action="oj-salir" data-id="${escapeHtml(o.id)}">Salir del objetivo</button>` : ""}`);
}
/* El detalle: la barra, quiénes están y los últimos aportes (los tuyos se pueden borrar) */
function openObjetivo(id) {
  const o = (OBJ.lista || []).find(x => x.id === id); if (!o) return;
  if (o.estado === "invitado") return openModal(o.nombre, `<div class="am-confirma"><span class="oj__ico oj__ico--xl">${ojIcono(o)}</span>
      <p class="text-sm muted">${escapeHtml(ojQuienInvita(o))} te invita a lograr ${escapeHtml(ojFmt(o.meta, o.unidad))} juntos · ${escapeHtml(ojPlazo(o))}.</p>
      <div class="row-wrap" style="gap:8px;justify-content:center"><button class="btn btn--primary" data-action="oj-unirme" data-id="${escapeHtml(o.id)}">Unirme</button><button class="btn-ghost" data-action="oj-rechazar" data-id="${escapeHtml(o.id)}">Ahora no</button></div></div>`);
  const ps = ojPersonas(o), nombre = uid => { const p = ps.find(x => x.id === uid); return p ? p.nombre : "Alguien"; };
  const invitados = o.miembros.filter(m => m.estado === "invitado");
  openModal(o.nombre, `<div class="oj-det">
    <div class="oj__n"><b>${escapeHtml(ojFmt(ojTotal(o), o.unidad))}</b><span class="muted">de ${escapeHtml(ojFmt(o.meta, o.unidad))}</span><span class="oj__pct">${ojPct(o)} %</span></div>
    ${ojBarra(o, 14)}
    ${ojLeyenda(o)}
    <p class="text-sm muted" style="margin:0">${escapeHtml(ojPlazo(o)).replace(/^./, c => c.toUpperCase())}${invitados.length ? ` · esperando a ${escapeHtml(cjNombres(invitados.map(m => m.nombre || "tu amigo")))}` : ""}</p>
    ${o.cumplido ? `<div class="oj__logro">${icoUI("medal")} ¡Lo lograron juntos! +20 ⭐ para cada uno.</div>` : ""}
    <button class="btn btn--primary" data-action="oj-aportar" data-id="${escapeHtml(o.id)}">Sumar un aporte</button>
    <div class="cj-sub mt-8">Últimos aportes</div>
    ${o.aportes.length ? `<div class="oj-aps">${o.aportes.map(a => `<div class="oj-ap"><span class="oj-ap__d" style="background:${(ps.find(p => p.id === a.user_id) || {}).color || OJ_GRIS}"></span>
        <span class="oj-ap__t"><b>${escapeHtml(nombre(a.user_id))} · ${escapeHtml(ojFmt(a.cantidad, o.unidad))}</b>${a.nota ? `<span>«${escapeHtml(a.nota)}»</span>` : ""}</span>
        <span class="text-xs muted">${a.fecha ? escapeHtml(new Date(a.fecha + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })) : ""}</span>
        ${a.user_id === ojYo(o).id ? `<button type="button" class="am-x" data-action="oj-aporte-del" data-id="${a.id}" aria-label="Borrar este aporte" title="Borrar este aporte">${icoUI("x")}</button>` : ""}</div>`).join("")}</div>`
      : `<p class="text-sm muted">Todavía no hay aportes. ¡Parte tú!</p>`}
    <div class="row-wrap" style="gap:8px"><button class="btn-ghost" data-action="oj-editar" data-id="${escapeHtml(o.id)}">${icoUI("pencil")} Editar o invitar</button></div></div>`);
}
function openAporte(id) {
  const o = (OBJ.lista || []).find(x => x.id === id); if (!o) return;
  const falta = Math.max(0, o.meta - ojTotal(o));
  openModal(`Sumar a «${o.nombre}»`, `<div class="oj-det">
    <div class="field"><label for="oj-cant">Cuánto sumas${o.unidad ? ` <span class="muted" style="font-weight:500">${o.unidad === "$" ? "en pesos" : "en " + escapeHtml(o.unidad)}</span>` : ""}</label>
      <input class="input" id="oj-cant" inputmode="decimal" autocomplete="off" placeholder="${o.unidad === "$" ? "Ej: 20000" : "Ej: 5"}"></div>
    <div class="field"><label for="oj-nota">Una nota <span class="muted" style="font-weight:500">(opcional)</span></label><input class="input" id="oj-nota" maxlength="80" placeholder="Ej: lo del sueldo"></div>
    ${falta > 0 && !o.cumplido ? `<p class="text-xs muted" style="margin:0">Faltan ${escapeHtml(ojFmt(falta, o.unidad))} para la meta.</p>` : ""}
    <button class="btn btn--primary btn-block" data-action="oj-aporte-ok" data-id="${escapeHtml(o.id)}">Sumar</button></div>`);
  setTimeout(() => { const i = document.getElementById("oj-cant"); if (i) i.focus(); }, 80);
}
