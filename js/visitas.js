/* ============================================================
   RUMBO · Visitas (Amigos, etapa 4): la casa y la vitrina de un amigo
   Si lo eliges en Amigos › Lo que muestras («Tu casa», «Tu vitrina»), tu perfil público lleva
   una foto de tu cuarto (tu elefante, lo que tiene puesto, la pared, la repisa y los libros) y
   tus medallas con el día en que las ganaste (supabase/visitas.sql). Tus amigos la ven a
   pantalla completa, en 3D como tú, pero de visita: miran y tocan al elefante, nada más.
   La foto la publica amigosPublicar (amigos.js) cuando cambia.
   El motor 3D lee los datos con los mismos ganchos de siempre (cielo.js): mientras estás de
   visita (rutas #visita-casa y #visita-cielo) le llegan los de tu amigo.
   ============================================================ */

const VISITA = { id: null, nombre: "", casa: null, vitrina: null };
function enVisita() { return !!VISITA.id && (CURRENT === "visita-casa" || CURRENT === "visita-cielo"); }

/* -------- Lo que publicas -------- */
function casaPublica(S) {
  S = S || STATE;
  const c = cuartoEq(S), pared = c.pared && cuartoPared(S) ? c.pared : null;
  return {
    ele: { tipo: tipoElefante(S), etapa: etapaElefante(S.gamif.xp || 0).idx, ropa: ropaPuesta(S), animo: animoElefante(S) },
    cosas: casaCosas(S).concat(cuartoPuestas(S)), pared, repisa: repisaIds(S), libros: Math.min(48, lg_libros(S)), rango: casaRango(S),
  };
}
function vitrinaPublica(S) {
  S = S || STATE;
  const medallas = (S.gamif.badges || []).filter(id => findBadge(id)), fechas = {};
  medallas.forEach(id => { const m = (S.gamif.ledger || []).find(x => x && x.id === "insignia:" + id && !x.anulado); if (m && m.ts) fechas[id] = isoLocal(new Date(m.ts)); });
  return { medallas, fechas };
}

/* -------- Lo que llega de un amigo: solo lo que existe en la app (catálogos, medallas, fechas) -------- */
const visitaPropio = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
function visitaEntero(v, a, b) { return Math.max(a, Math.min(b, parseInt(v, 10) || 0)); }
function visitaCasaLimpia(c) {
  if (!c || typeof c !== "object") return null;
  const e = c.ele && typeof c.ele === "object" ? c.ele : {}, ropa = {};
  Object.keys(ESPACIOS_ELEFANTE).forEach(sl => { const p = prendaElefante(e.ropa && e.ropa[sl]); if (p && p.slot === sl) ropa[sl] = p.id; });
  const validas = new Set(CASA_COSAS.map(x => x.id).concat(CUARTO_TIENDA.filter(it => it.cosa).map(it => it.cosa)));
  const pared = CUARTO_TIENDA.find(it => it.pared && it.id === c.pared) || null;
  return {
    ele: { tipo: visitaPropio(TIPOS_ELEFANTE, e.tipo) ? e.tipo : "clasico", etapa: visitaEntero(e.etapa, 0, ETAPAS_ELEFANTE.length - 1), ropa,
      animo: ["sueno", "feliz", "normal"].includes(e.animo) ? e.animo : "normal" },
    cosas: [...new Set((Array.isArray(c.cosas) ? c.cosas : []).filter(x => validas.has(x)))],
    pared: pared ? pared.id : null, colores: pared ? pared.pared : null,
    repisa: [...new Set((Array.isArray(c.repisa) ? c.repisa : []).filter(id => typeof id === "string" && findBadge(id)))].slice(0, REPISA_MAX),
    libros: visitaEntero(c.libros, 0, 48), rango: visitaEntero(c.rango, 0, RANGOS.length - 1),
  };
}
function visitaVitrinaLimpia(v) {
  if (!v || typeof v !== "object") return null;
  const medallas = [...new Set((Array.isArray(v.medallas) ? v.medallas : []).filter(id => typeof id === "string" && findBadge(id)))], fechas = {};
  medallas.forEach(id => { const d = cjFecha(v.fechas && typeof v.fechas === "object" && visitaPropio(v.fechas, id) ? v.fechas[id] : ""); if (d) fechas[id] = d; });
  return { medallas, fechas };
}

/* -------- Lo que el motor 3D necesita de la visita (los ganchos de cielo.js preguntan enVisita()) -------- */
function visitaActividades() {
  const c = VISITA.casa; if (!c) return [];
  return eleActividadesCon({ cosas: c.cosas, medallas: c.repisa.length > 0, sueno: c.ele.animo === "sueno" });
}
function visitaFecha(iso) { const d = new Date(iso + "T12:00:00"); return `${d.getDate()} ${CIELO_MESES[d.getMonth()]} ${d.getFullYear()}`; }
/* Como cieloInfo, pero con lo que ganó tu amigo (sin su avance: eso no se comparte) */
function visitaInfo(id) {
  const I = cieloInfo(id); if (!I) return null;
  const v = VISITA.vitrina || { medallas: [], fechas: {} }, gano = v.medallas.includes(id);
  return Object.assign({}, I, { gano, oculta: !!I.b.secreta && !gano, fecha: gano && v.fechas[id] ? visitaFecha(v.fechas[id]) : "", avance: null });
}

/* -------- Entrar -------- */
async function visitar(id, lugar) {
  const r = await BACKEND.amigosVisita(id);
  if (!r || r.error) return toast(r && r.error === "sin-servidor" ? "Las visitas todavía no están activas en el servidor." : amigosTextoError((r && r.error) || "error"), true);
  const a = amigoPorId(id);
  Object.assign(VISITA, { id, nombre: String((a && a.nombre) || r.nombre || "").slice(0, 60), casa: visitaCasaLimpia(r.casa), vitrina: visitaVitrinaLimpia(r.vitrina) });
  const ruta = lugar === "cielo" ? "visita-cielo" : "visita-casa";
  if (lugar === "cielo" ? !VISITA.vitrina : !VISITA.casa) return toast(`${VISITA.nombre || "Tu amigo"} no muestra su ${lugar === "cielo" ? "vitrina" : "casa"}`, true);
  closeModal();
  if (!(typeof lugarEntrar === "function" && lugarEntrar(ruta))) go(ruta);
}
/* Una medalla de tu amigo, de cerca (en una ficha: su metal, qué es y cuándo la ganó) */
function visitaMedalla(id) {
  const I = visitaInfo(id); if (!I) return;
  const n = escapeHtml(VISITA.nombre || "Tu amigo"), tuya = (STATE.gamif.badges || []).includes(id), M = CIELO_METALES[I.metal];
  openModal(I.oculta ? "Insignia secreta" : I.b.nombre, `<div class="vis-med">
      <span class="vis-med__m" style="--metal:${M.css}" aria-hidden="true">${I.oculta ? "?" : I.b.icon}</span>
      <span class="text-xs muted">${escapeHtml(I.familia ? I.familia.n : "Insignia")} · ${M.n}</span>
      <p class="text-sm">${escapeHtml(I.oculta ? "Se revela el día que la ganes." : I.b.desc)}</p>
      <b class="vis-med__e">${I.gano ? `${n} la ganó${I.fecha ? " el " + escapeHtml(I.fecha) : ""}` : `${n} todavía no la tiene`}</b>
      <span class="text-xs muted">${tuya ? "✓ Tú también la tienes" : "Tú todavía no la tienes"}</span></div>`);
}
function visitaAccion(a, d) {
  if (a === "vis-casa" || a === "vis-cielo") {
    const ruta = a === "vis-cielo" ? "visita-cielo" : "visita-casa";
    if (enVisita()) { if (!(typeof lugarEntrar === "function" && lugarEntrar(ruta))) go(ruta); return; }
    return visitar(d.id, a === "vis-cielo" ? "cielo" : "casa");
  }
  if (a === "vis-medalla") return visitaMedalla(d.id);
}

/* -------- La casa de tu amigo (ruta #visita-casa) -------- */
function visitaSinDatos(ruta) {
  setTimeout(() => { if (CURRENT === ruta) go("amigos"); }, 0);   // llegaste directo (sin visita abierta): a Amigos
  return "";
}
function renderVisitaCasa() {
  if (!VISITA.id || !VISITA.casa) return visitaSinDatos("visita-casa");
  const c = VISITA.casa, n = escapeHtml(VISITA.nombre || "tu amigo"), ahora = eleElegirAhora(visitaActividades()), r = RANGOS[c.rango];
  const chip = id => { const b = findBadge(id); return `<button class="med-chip" data-action="vis-medalla" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; };
  const compras = CUARTO_TIENDA.filter(it => it.cosa && c.cosas.includes(it.cosa)), pared = CUARTO_TIENDA.find(it => it.id === c.pared);
  const tipo = TIPOS_ELEFANTE[c.ele.tipo], etapa = ETAPAS_ELEFANTE[c.ele.etapa];
  const cab = `<div class="hoja__t">🐘 El elefante de ${n} · ${escapeHtml(tipo.n)} · ${escapeHtml(etapa.n)}</div>
    <div class="hoja__ahora" id="cuaAhora" aria-live="polite">${ahora.ico} Ahora ${ahora.txt}</div>
    <div class="hoja__s">Estás de visita: puedes mirar y tocar a su elefante, pero no cambiar nada.</div>
    <div class="hoja__bts">${VISITA.vitrina ? `<button class="hb" data-action="vis-cielo">✨ Su vitrina</button>` : ""}<button class="hb" data-action="am-animo" data-id="${escapeHtml(VISITA.id)}">🎉 Mandarle ánimo</button></div>`;
  const cuerpo = `<div class="hoja__k">Su repisa</div>
    <div class="recibo__meds-l">${c.repisa.length ? c.repisa.map(chip).join("") : `<span class="text-sm muted">Vacía por ahora.</span>`}</div>
    ${compras.length || pared ? `<div class="hoja__k">Su cuarto</div><div class="fila-chips">${compras.concat(pared ? [pared] : []).map(it => `<span class="chip">${it.icon} ${escapeHtml(it.nombre)}</span>`).join("")}</div>` : ""}
    <p class="text-xs muted hoja__pista">Su elefante va de un rincón a otro. Tócalo y reacciona. Arrastra para mirar el cuarto y pellizca para acercarte.</p>`;
  const titulo = `La casa de ${n}`, sub = `De visita · ${escapeHtml(r.nombre)}`;
  if (CIELO_ESTADO.sin3d) return lugarPlanoHtml({ titulo, sub, dibujo: elefanteSVG({ anim: false, tipo: c.ele.tipo, etapa: c.ele.etapa, ropa: c.ele.ropa, animo: c.ele.animo }), cab, cuerpo });
  return lugarHtml({
    lienzo: "lugarLienzo", titulo, sub, chip: "De visita",
    aria: `La casa de ${VISITA.nombre || "tu amigo"}: su elefante ${ahora.txt}.${c.repisa.length ? " En la repisa: " + c.repisa.map(id => findBadge(id).nombre).join(", ") + "." : ""}`,
    hojaAria: "Su elefante y su cuarto", carga: "Llegando a su casa…", extra: `<div class="cielo__etq" id="casaEtq" hidden></div>`, cab, cuerpo,
  });
}

/* -------- La vitrina de tu amigo (ruta #visita-cielo) -------- */
function renderVisitaCielo() {
  if (!VISITA.id || !VISITA.vitrina) return visitaSinDatos("visita-cielo");
  const v = VISITA.vitrina, n = escapeHtml(VISITA.nombre || "tu amigo"), orden = cieloOrden();
  const tiene = id => v.medallas.includes(id), total = orden.filter(tiene).length;
  const completas = CIELO_FAMILIAS.filter(f => f.fig && f.ids.every(tiene)).length;
  const chip = id => { const b = findBadge(id); return `<button class="med-chip" data-action="vis-medalla" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; };
  const familias = CIELO_FAMILIAS.map(f => {
    const ganadas = f.ids.filter(id => findBadge(id) && tiene(id));
    if (!f.fig && !ganadas.length) return "";
    return `<div class="hoja__k">${f.n}${f.fig ? " · " + f.fig : ""} · ${ganadas.length} de ${f.ids.length}</div>
      <div class="recibo__meds-l">${ganadas.length ? ganadas.map(chip).join("") : `<span class="text-xs muted">Ninguna todavía</span>`}</div>`;
  }).join("");
  const sub = `De visita · ${total} de ${orden.length} medallas`;
  const cab = `<div class="hoja__t">✨ Las medallas de ${n}</div>
    <div class="hoja__s">${completas ? `${completas === 1 ? "1 constelación completa" : completas + " constelaciones completas"}. ` : ""}Toca una medalla para ver cuándo la ganó.</div>
    <div class="hoja__bts">${VISITA.casa ? `<button class="hb" data-action="vis-casa">🏠 Su casa</button>` : ""}${CIELO_ESTADO.sin3d ? "" : CIELO_FAMILIAS.filter(f => f.fig).map(f => `<button class="hb" data-action="cielo-mirar" data-id="${f.id}">${f.n} ${f.ids.filter(tiene).length}/${f.ids.length}</button>`).join("")}</div>`;
  const titulo = `La vitrina de ${n}`;
  if (CIELO_ESTADO.sin3d) return lugarPlanoHtml({ titulo, sub, cab, cuerpo: familias });
  return lugarHtml({
    lienzo: "lugarLienzo", titulo, sub, oscuro: true, fondo: "#05060C",
    aria: `La vitrina de ${VISITA.nombre || "tu amigo"}: ${total} de ${orden.length} medallas encendidas en el cielo. En la hoja de abajo están las suyas, por familia.`,
    hojaAria: "Sus medallas por familia", carga: "Encendiendo su cielo…", extra: `<div class="cielo__etq" id="cieloEtq" hidden></div>`, cab, cuerpo: familias,
  });
}
