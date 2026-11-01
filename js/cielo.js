/* ============================================================
   RUMBO · El cielo de insignias (Recompensas › Insignias)
   Cada insignia es una medalla y cada familia una constelación: La Copa (rachas),
   La Brújula (grandes hitos), El Elefante (tareas y foco), El Sol (rituales),
   La Columna (hábitos) y La Medalla (tu vida). Las secretas aparecen sueltas al ganarlas.
   Tocar una medalla (en el cielo o en la lista) la abre de cerca, con su ficha.
   El 3D (three.js + cielo-3d.js) se baja solo al entrar a Insignias; sin WebGL
   quedan la lista y la ficha con una medalla plana.
   ============================================================ */

/* -------- Familias: el orden de ids es el de los puntos de su figura -------- */
const CIELO_FAMILIAS = [
  { id: "rachas", n: "Rachas", fig: "La Copa", ic: "llama", ids: ["primer-paso", "semana-fuego", "inquebrantable", "centenario"] },
  { id: "hitos", n: "Grandes hitos", fig: "La Brújula", ic: "brujula", ids: ["explorador", "estratega", "cuatro-semanas", "trimestre-rumbo", "mes-perfecto", "anio-rumbo"] },
  { id: "foco", n: "Tareas y foco", fig: "El Elefante", ic: "elefante", ids: ["cazador-sapos", "elefante-domado", "elefante-domado-p", "elefante-domado-o", "delegador-b", "delegador-p", "delegador-o", "soltar", "bandeja-cero", "capacidad-real", "enfocado-b", "enfocado-p", "enfocado-o"] },
  { id: "rituales", n: "Rituales", fig: "El Sol", ic: "sol", ids: ["madrugador", "alba-b", "alba-p", "alba-o", "noche-serena-b", "noche-serena-p", "noche-serena-o", "semana-redonda", "mes-redondo", "salvavidas"] },
  { id: "habitos", n: "Hábitos", fig: "La Columna", ic: "brote", ids: ["centurion", "semana-perfecta", "guerrero", "todo-verde", "habito-hierro"] },
  { id: "vida", n: "Tu vida", fig: "La Medalla", ic: "medalla", ids: ["primer-peso", "medio-camino", "ahorrador-b", "ahorrador-p", "ahorrador-o", "meta-anual", "pagina-uno", "devorador", "biblioteca-b", "biblioteca-p", "biblioteca-o", "peso-pluma", "buen-amigo", "embajador", "en-equipo", "primera-alcancia"] },
  { id: "secretas", n: "Secretas", fig: "", ic: "?", ids: ["buho", "aniversario", "anio-nuevo", "remontada"] },
];
/* Ícono grabado en la medalla: el de la insignia, el de su serie o el de su familia */
const CIELO_ICONOS = {
  "semana-redonda": "calendario", "mes-redondo": "calendario", salvavidas: "rayo", guerrero: "pesa",
  "primer-peso": "moneda", "medio-camino": "moneda", "meta-anual": "moneda", "pagina-uno": "libro", devorador: "libro",
  "peso-pluma": "pluma", "buen-amigo": "corazon", embajador: "flecha", "en-equipo": "equipo", "primera-alcancia": "moneda",
  buho: "buho", aniversario: "torta", "anio-nuevo": "fuegos", remontada: "vuelta",
  enfocado: "reloj", "noche-serena": "luna", ahorrador: "moneda", biblioteca: "libro",
};
const CIELO_METALES = {
  bronce: { n: "Bronce", css: "#C27A44" }, plata: { n: "Plata", css: "#C3C9D2" },
  oro: { n: "Oro", css: "#E7AE30" }, obsidiana: { n: "Obsidiana", css: "#3A3644" },
};
const CIELO_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* Metal: las series van por nivel; las secretas son de obsidiana; el resto, por lo que pagan */
function cieloMetal(b) {
  if (b.secreta) return "obsidiana";
  if (b.serie) return ["bronce", "plata", "oro"][b.nivel] || "bronce";
  const r = b.reward || 0;
  return r >= 300 ? "oro" : r >= 100 ? "plata" : "bronce";
}
function cieloFamilia(id) { return CIELO_FAMILIAS.find(f => f.ids.includes(id)) || null; }
function cieloIcono(b) {
  const f = cieloFamilia(b.id);
  return CIELO_ICONOS[b.id] || (b.serie && CIELO_ICONOS[b.serie]) || (f ? f.ic : "?");
}
/* Todas las insignias en el orden del cielo (las que no tienen familia van al final, solo en la lista) */
function cieloOrden() {
  const ids = CIELO_FAMILIAS.flatMap(f => f.ids).filter(id => findBadge(id));
  BADGES.forEach(b => { if (!ids.includes(b.id)) ids.push(b.id); });
  return ids;
}

/* Fecha en que se ganó: la del movimiento "insignia:<id>" del ledger */
function cieloFecha(id, s) {
  const m = ((s.gamif && s.gamif.ledger) || []).find(x => x && x.id === "insignia:" + id && !x.anulado);
  if (!m || !m.ts) return "";
  const d = new Date(m.ts);
  return `${d.getDate()} ${CIELO_MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/* Avance de las que aún no se ganan: [valor(s), meta, unidad] */
function cieloPctMeta(s) { const meta = datosAnio(s, anioActual()).finanzas.metaAnual; return meta > 0 ? Math.round((g_ahorroAcum(s) / meta) * 100) : null; }
const CIELO_AVANCE = {
  "primer-paso": [s => (Object.values(s.ritual.dias).some(d => d && d.cerrado) ? 1 : 0), 1, "día cerrado"],
  "semana-fuego": [() => computeClosedStreak(), 7, "días seguidos"],
  inquebrantable: [() => computeClosedStreak(), 30, "días seguidos"],
  centenario: [() => computeClosedStreak(), 100, "días seguidos"],
  madrugador: [s => g_ritualesHechos(s), 10, "rituales de apertura"],
  "cazador-sapos": [s => g_sapos(s), 10, "primeros bocados"],
  centurion: [s => g_habitMarks(s), 100, "hábitos marcados"],
  guerrero: [s => g_diasEntren(s), 50, "días entrenados"],
  "pagina-uno": [s => lg_libros(s), 1, "libro"],
  devorador: [s => lg_libros(s), 3, "libros"],
  estratega: [s => g_trimestresCerrados(s), 1, "revisión trimestral"],
  salvavidas: [s => lg_express(s), 5, "días salvados"],
  soltar: [s => lg_soltadas(s), 10, "tareas soltadas"],
  embajador: [s => lg_compartidos(s), 3, "veces compartido"],
  "medio-camino": [cieloPctMeta, 50, "%"],
  "meta-anual": [cieloPctMeta, 100, "%"],
};
const CIELO_UNIDADES = { alba: "veces", "noche-serena": "veces", delegador: "tareas delegadas", "elefante-domado": "tareas domadas", ahorrador: "meses", biblioteca: "libros", enfocado: "sesiones" };
function cieloAvance(b, s) {
  let v, meta, u;
  try {
    if (b.serie) {
      const se = SERIES.find(x => x.id === b.serie);
      v = se.metrica(s); meta = se.niveles[b.nivel][0]; u = CIELO_UNIDADES[se.id] || "";
    } else {
      const a = CIELO_AVANCE[b.id]; if (!a) return null;
      v = a[0](s); meta = a[1]; u = a[2];
    }
  } catch (e) { return null; }
  if (v == null || !isFinite(v)) return null;
  v = Math.max(0, Math.min(Math.round(v), meta));
  return { v, meta, u, pct: Math.round((v / meta) * 100),
    txt: u === "%" ? `${v}% de tu meta anual · pide ${meta}%` : `${v} de ${meta} ${u}` };
}

/* Todo lo que la ficha y la medalla necesitan saber de una insignia */
function cieloInfo(id, s = STATE) {
  const b = findBadge(id); if (!b) return null;
  const fam = cieloFamilia(id), gano = ((s.gamif && s.gamif.badges) || []).includes(id);
  const se = b.serie ? SERIES.find(x => x.id === b.serie) : null;
  return {
    id, b, fam: fam ? fam.id : null, familia: fam, idx: fam ? fam.ids.indexOf(id) : -1,
    metal: cieloMetal(b), ic: cieloIcono(b), gano, oculta: !!b.secreta && !gano,
    serie: se, nivel: se ? b.nivel : -1, nombreCorto: se ? se.nombre : b.nombre,
    fecha: gano ? cieloFecha(id, s) : "", avance: gano ? null : cieloAvance(b, s),
  };
}
function cieloEncendidas(fam, s = STATE) { const g = (s.gamif && s.gamif.badges) || []; return fam.ids.filter(id => g.includes(id)).length; }
function cieloCompletas(s = STATE) { return CIELO_FAMILIAS.filter(f => f.fig && cieloEncendidas(f, s) === f.ids.length).length; }

function cieloTactil() { return typeof window !== "undefined" && !!(window.matchMedia && matchMedia("(pointer: coarse)").matches); }

/* -------- Tu vitrina a pantalla completa (ruta #cielo, lugar.js): tus medallas en el cielo y, en la hoja, todas por familia -------- */
function renderCielo() {
  const g = STATE.gamif, orden = cieloOrden(), n = orden.filter(id => g.badges.includes(id)).length, c = cieloCompletas(), tactil = cieloTactil();
  const chip = id => {
    const b = findBadge(id), tiene = g.badges.includes(id), oculta = b.secreta && !tiene;
    return `<button class="med-chip${tiene ? "" : " is-por"}" data-action="ins-ver" data-id="${id}">${tiene ? medChip(b, escapeHtml(b.nombre))
      : `<span class="med-chip__m med-chip__m--por" aria-hidden="true">${oculta ? "?" : "🔒"}</span>${oculta ? "Secreta" : escapeHtml(b.nombre)}`}</button>`;
  };
  const familias = CIELO_FAMILIAS.map(f => {
    const e = cieloEncendidas(f), tot = f.ids.length;
    return `<div class="hoja__k">${f.n}${f.fig ? " · " + f.fig : ""} · ${e} de ${tot}${f.fig && e === tot ? " ✓" : ""}</div><div class="recibo__meds-l">${f.ids.filter(findBadge).map(chip).join("")}</div>`;
  }).join("");
  const cab = `<div class="hoja__t">✨ ${tactil ? "Toca" : "Haz clic en"} una medalla para verla de cerca</div>
    <div class="hoja__s">Arrastra para mirar el cielo y ${tactil ? "pellizca" : "usa la rueda"} para acercarte. Toca una constelación para ir a ella.</div>
    <div class="hoja__bts">${CIELO_FAMILIAS.filter(f => f.fig).map(f => `<button class="hb" data-action="cielo-mirar" data-id="${f.id}">${f.n} ${cieloEncendidas(f)}/${f.ids.length}</button>`).join("")}</div>`;
  const cuerpo = familias;
  if (CIELO_ESTADO.sin3d) {
    // Sin 3D: la misma lista, como página; las medallas que ves aquí ya cuentan como vistas
    cieloGuardarVisto(g.badges.slice());
    return lugarPlanoHtml({ titulo: "Tu vitrina", sub: `${n} de ${orden.length} medallas · ${c === 1 ? "1 constelación completa" : `${c} constelaciones completas`}`,
      cab: `<div class="hoja__t">✨ Toca una medalla para verla de cerca</div><div class="hoja__s">Tus medallas por constelación, con las que te faltan.</div>`, cuerpo });
  }
  return lugarHtml({
    lienzo: "lugarLienzo", titulo: "Tu vitrina", sub: `${n} de ${orden.length} medallas · ${c === 1 ? "1 constelación completa" : `${c} constelaciones completas`}`,
    oscuro: true, fondo: "#05060C", aria: `Tu vitrina: ${n} de ${orden.length} medallas encendidas en el cielo. En la hoja de abajo están todas, por familia.`,
    hojaAria: "Tus medallas por familia", carga: "Encendiendo el cielo…", extra: `<div class="cielo__etq" id="cieloEtq" hidden></div>`, cab, cuerpo,
  });
}

/* -------- Carga diferida del 3D -------- */
const CIELO_ESTADO = { motor: null, carga: null, scripts: null, sin3d: false };
const CIELO_V = (typeof document !== "undefined" && document.currentScript && (document.currentScript.src.match(/\?v=\d+/) || [""])[0]) || "";
function cieloScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => { s.remove(); mal(new Error("no cargó " + src)); };
    document.head.appendChild(s);
  });
}
/* three.js y el motor del cielo, bajados una sola vez (si falla la red, se reintenta después) */
function cieloScripts() {
  if (!CIELO_ESTADO.scripts) {
    CIELO_ESTADO.scripts = (window.THREE ? Promise.resolve() : cieloScript("js/vendor/three-0.128.0.min.js"))
      .then(() => (typeof crearMotorCielo === "function" ? null : cieloScript("js/cielo-3d.js" + CIELO_V)))
      .then(() => (typeof crearElefante3D === "function" ? null : cieloScript("js/elefante-3d.js" + CIELO_V)))
      .catch(e => { CIELO_ESTADO.scripts = null; throw e; });
  }
  return CIELO_ESTADO.scripts;
}
/* Promesa del motor 3D (una sola vez). Falla si no hay WebGL o no se pudo bajar three.js */
function cieloMotor() {
  if (CIELO_ESTADO.motor) return Promise.resolve(CIELO_ESTADO.motor);
  if (CIELO_ESTADO.sin3d) return Promise.reject(new Error("sin 3D"));
  if (!CIELO_ESTADO.carga) {
    CIELO_ESTADO.carga = cieloScripts()
      .then(() => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]) : null))
      .then(() => {
        // De visita (visitas.js) los mismos ganchos entregan la casa y las medallas de tu amigo, sin tocar las tuyas
        const vis = () => typeof enVisita === "function" && enVisita(), VC = () => VISITA.casa || null;
        CIELO_ESTADO.motor = crearMotorCielo(window.THREE, {
          orden: cieloOrden, info: id => (vis() ? visitaInfo(id) : cieloInfo(id)), familias: CIELO_FAMILIAS,
          ganadas: () => new Set(vis() ? ((VISITA.vitrina && VISITA.vitrina.medallas) || []) : STATE.gamif.badges || []),
          tocar: id => (vis() ? visitaMedalla(id) : abrirInsignia(id)), perdido: cieloSin3d,
          visto: () => (vis() ? null : cieloVisto()), guardarVisto: ids => { if (!vis()) cieloGuardarVisto(ids); },
          // La casa del elefante (casa.js)
          repisa: () => (vis() ? (VC() ? VC().repisa : []) : typeof repisaIds === "function" ? repisaIds(STATE) : []),
          cosas: () => (vis() ? (VC() ? VC().cosas : []) : typeof casaCosas === "function" ? casaCosas(STATE).concat(cuartoPuestas(STATE)) : []),
          pared: () => (vis() ? (VC() ? VC().colores : null) : typeof cuartoPared === "function" ? cuartoPared(STATE) : null),
          libros: () => (vis() ? (VC() ? VC().libros : 0) : typeof lg_libros === "function" ? lg_libros(STATE) : 0),
          vacio: () => { if (!vis() && typeof openRepisa === "function") { REPISA_SEL = null; openRepisa(); } },
          // Tu elefante en 3D (elefante-3d.js): el mismo del dibujo, con su tipo, etapa, ropa y ánimo
          elefante: () => (vis() ? (VC() ? Object.assign({}, VC().ele) : null)
            : typeof tipoElefante === "function" ? { tipo: tipoElefante(), etapa: etapaElefante(STATE.gamif.xp || 0).idx, ropa: ropaPuesta(), animo: animoElefante() } : null),
          tocoEle: () => { if (typeof vibrar === "function") vibrar(12); },
          // lo que hace en su cuarto (casa.js): ahora mismo, lo que puede hacer y el aviso cuando cambia
          ahora: () => (vis() ? eleElegirAhora(visitaActividades()).id : typeof eleActividadAhora === "function" ? eleActividadAhora(STATE).id : "sentado"),
          actividades: () => (vis() ? visitaActividades() : typeof eleActividades === "function" ? eleActividades(STATE) : []).map(a => [a.id, a.w]),
          haciendo: id => { if (typeof eleHaciendo === "function") eleHaciendo(id); },
          entrar: l => { if (typeof lugarDesdeTarjeta === "function") lugarDesdeTarjeta(l); },
          cerrados: () => (vis() ? [] : Object.keys(STATE.ritual.dias || {}).filter(k => STATE.ritual.dias[k] && STATE.ritual.dias[k].cerrado)),
        });
        return CIELO_ESTADO.motor;
      })
      .catch(e => {
        // Sin WebGL no hay vuelta (cieloSin3d lo recuerda); si fue la red, se reintenta la próxima vez que entres
        CIELO_ESTADO.carga = null; cieloSin3d();
        throw e;
      });
  }
  return CIELO_ESTADO.carga;
}
function cieloSin3d() {
  if (window.THREE) CIELO_ESTADO.sin3d = true;
  if (CERCA.id) pintarCerca();
  const L = typeof CURRENT !== "undefined" && CIELO_LUGARES[CURRENT];
  if (L && CIELO_ESTADO.sin3d) { document.body.classList.remove("en-lugar"); rerender(); }   // sin 3D, el lugar es una página
}

/* Dónde vive el 3D: el cuarto de tu elefante en Tu casa y el cielo en Tu vitrina, los dos a pantalla
   completa (libre: se giran y se acercan) */
const CIELO_LUGARES = {
  cuarto: { lugar: "casa", lienzo: "lugarLienzo", marco: ".lugar", libre: true },
  cielo: { lugar: "cielo", lienzo: "lugarLienzo", marco: ".lugar", libre: true },
  "visita-casa": { lugar: "casa", lienzo: "lugarLienzo", marco: ".lugar", libre: true },     // la casa y la vitrina de un amigo (visitas.js)
  "visita-cielo": { lugar: "cielo", lienzo: "lugarLienzo", marco: ".lugar", libre: true },
};
/* Tras cada render se monta (o se vuelve a colgar) el 3D de la pantalla; fuera de ellas, se pausa.
   Una ficha abierta manda: sigue abierta mientras no cambies de pantalla */
function cieloTrasRender(route) {
  if (CERCA.id && route !== CERCA.ruta) cerrarInsignia(true);
  if (CERCA.id) { pintarCerca(true); return; }
  montarLugar(route);
}
function montarLugar(route) {
  const L = CIELO_LUGARES[route];
  if (!L) { if (CIELO_ESTADO.motor) CIELO_ESTADO.motor.soltar(); return; }
  const caja = document.getElementById(L.lienzo); if (!caja) return;
  if (CIELO_ESTADO.sin3d) return;
  const listo = m => { m.montar(caja.isConnected ? caja : document.getElementById(L.lienzo), L.lugar, { libre: !!L.libre }); if (L.libre && typeof lugarMontado === "function") lugarMontado(); };
  if (CIELO_ESTADO.motor) { listo(CIELO_ESTADO.motor); return; }
  caja.closest(L.marco).classList.add("is-cargando");
  cieloMotor().then(m => {
    const c2 = document.getElementById(L.lienzo);
    if (c2) c2.closest(L.marco).classList.remove("is-cargando");
    if (c2 && CURRENT === route && !CERCA.id) listo(m);
  }).catch(() => {
    const sec = document.querySelector(L.marco); if (sec) sec.classList.remove("is-cargando");
    if (CURRENT === route && CIELO_ESTADO.sin3d) { document.body.classList.remove("en-lugar"); rerender(); }   // sin 3D, el lugar es una página
  });
}

/* Medallas que el cielo ya mostró en este equipo: las nuevas llegan como estrella fugaz */
const CIELO_CLAVE_VISTO = "rumbo-cielo-visto";
function cieloVisto() { try { const v = JSON.parse(localStorage.getItem(CIELO_CLAVE_VISTO) || "null"); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
function cieloGuardarVisto(ids) { try { localStorage.setItem(CIELO_CLAVE_VISTO, JSON.stringify(ids)); } catch (e) {} if (typeof pintarPuertas === "function") pintarPuertas(); }

/* -------- De cerca: la medalla grande y su ficha (modo "ver") o el momento de ganarla ("ganar") -------- */
const CERCA = { id: null, modo: "ver", cola: [], i: 0, ruta: null, volver: null, hist: false };
function cercaEl() {
  let el = document.getElementById("insCerca");
  if (el) return el;
  el = document.createElement("div");
  el.id = "insCerca"; el.className = "ins-cerca"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "insCercaT");
  el.innerHTML = iconizar(`<div class="ins-cerca__escena">
      <div class="ins-cerca__lienzo" id="insCercaLienzo"></div>
      <div class="ins-cerca__plano" id="insCercaPlano" hidden></div>
      <button class="ins-cerca__x" data-c="cerrar" aria-label="Cerrar">✕</button>
      <button class="ins-cerca__nav ins-cerca__nav--ant" data-c="ant" aria-label="Insignia anterior">‹</button>
      <button class="ins-cerca__nav ins-cerca__nav--sig" data-c="sig" aria-label="Insignia siguiente">›</button>
      <div class="ins-cerca__pista" id="insCercaPista"></div>
    </div>
    <div class="ins-cerca__ficha" id="insCercaFicha"></div>`);
  document.body.appendChild(el);
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    const c = b.dataset.c;
    if (c === "cerrar" || c === "listo") cerrarInsignia();
    else if (c === "ant" || c === "sig") moverInsignia(c === "sig" ? 1 : -1);
    else if (c === "nivel") cambiarInsignia(b.dataset.id);
    else if (c === "voltear" && CIELO_ESTADO.motor) CIELO_ESTADO.motor.voltear();
    else if (c === "siguiente") siguienteGanada();
    else if (c === "alcielo") { cerrarInsignia(true, true); if (!(typeof lugarEntrar === "function" && lugarEntrar("cielo"))) go("cielo"); }
  });
  document.addEventListener("keydown", e => {
    if (!CERCA.id) return;
    if (e.key === "Escape") { e.preventDefault(); cerrarInsignia(); }
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && CERCA.modo === "ver" && !isFormEl(e.target)) { e.preventDefault(); moverInsignia(e.key === "ArrowRight" ? 1 : -1); }
    else if (e.key === "Tab") {   // el foco no sale de la ficha mientras está abierta
      const f = [...el.querySelectorAll("button:not([disabled])")].filter(x => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("popstate", () => { if (CERCA.id && CERCA.hist) { CERCA.hist = false; cerrarInsignia(); } });
  return el;
}
function fichaCercaHtml(I) {
  const g = STATE.gamif, M = CIELO_METALES[I.metal], fam = I.familia;
  const nombre = I.oculta ? "Insignia secreta" : I.b.nombre;
  const desc = I.oculta ? "Se revela el día que la ganes. Sigue usando Rumbo: algunas aparecen cuando menos lo esperas." : I.b.desc;
  const estado = I.gano
    ? `<div class="ins-cerca__estado is-ganada">✓ Ganada${I.fecha ? ` el ${I.fecha}` : ""} · +${I.b.reward} ⭐</div>`
    : I.avance
      ? `<div class="ins-cerca__estado"><div class="bar"><div class="bar__fill" style="width:${I.avance.pct}%"></div></div>
          <span>${I.avance.txt} · +${I.b.reward} ⭐ al ganarla</span></div>`
      : `<div class="ins-cerca__estado">🔒 Por ganar · +${I.b.reward} ⭐</div>`;
  const niveles = I.serie ? `<div class="ins-cerca__niveles" role="group" aria-label="Niveles de ${escapeHtml(I.serie.nombre)}">
      ${I.serie.niveles.map(([n], k) => {
        const id = idNivel(I.serie, k), ok = g.badges.includes(id), med = MEDALLAS["bpo"[k]];
        return `<button class="${id === I.id ? "is-on" : ""}${ok ? " is-ganada" : ""}" data-c="nivel" data-id="${id}" aria-pressed="${id === I.id}">
          <span>${med.ico}</span><b>${med.n}</b><small>${ok ? "Ganada" : n}</small></button>`;
      }).join("")}</div>` : "";
  const constel = fam && fam.fig
    ? `<div class="ins-cerca__const">Estrella de <b>${fam.fig}</b> · ${cieloEncendidas(fam)} de ${fam.ids.length} encendidas</div>` : "";
  const enRepisa = typeof repisaIds === "function" && repisaIds(STATE).includes(I.id);
  return `<div class="ins-cerca__fam">${I.fam === "secretas" ? "Secreta" : escapeHtml(fam ? fam.n : "Insignia")} · ${M.n}</div>
    <h2 class="ins-cerca__t" id="insCercaT">${escapeHtml(nombre)}</h2>
    <p class="ins-cerca__desc">${escapeHtml(desc)}</p>
    ${estado}${niveles}${constel}
    <div class="ins-cerca__acc">
      ${CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d ? `<button class="btn btn--soft" data-c="voltear">↻ Dar vuelta</button>` : ""}
      ${I.gano && typeof repisaMedalla === "function" ? `<button class="btn btn--linea" data-action="repisa-medalla" data-id="${I.id}" aria-pressed="${enRepisa}">${enRepisa ? "✓ En tu repisa" : "🏅 Poner en tu repisa"}</button>` : ""}
    </div>`;
}
/* La ficha del momento de ganar: qué ganaste y qué se encendió en tu cielo */
function fichaGanarHtml(I) {
  const fam = I.familia, M = CIELO_METALES[I.metal], tot = CERCA.cola.length, mas = CERCA.i < tot - 1;
  const n = fam ? cieloEncendidas(fam) : 0, completa = !!(fam && fam.fig) && n === fam.ids.length;
  const constel = fam && fam.fig
    ? completa ? `<div class="ins-cerca__const is-completa">✦ ¡Completaste <b>${fam.fig}</b>! Sus ${fam.ids.length} estrellas brillan en tu cielo.</div>`
      : `<div class="ins-cerca__const">Se encendió su estrella en <b>${fam.fig}</b> · ${n} de ${fam.ids.length}</div>`
    : I.fam === "secretas" ? `<div class="ins-cerca__const">Una secreta: desde hoy brilla suelta en tu cielo.</div>` : "";
  return `<div class="ins-cerca__fam is-nueva">¡Medalla nueva!${tot > 1 ? ` · ${CERCA.i + 1} de ${tot}` : ""}</div>
    <h2 class="ins-cerca__t" id="insCercaT">${escapeHtml(I.b.nombre)}</h2>
    <p class="ins-cerca__desc">${escapeHtml(I.b.desc)}</p>
    <div class="ins-cerca__estado is-ganada">+${I.b.reward} ⭐ · ${escapeHtml(fam ? fam.n : "Insignia")} · ${M.n}</div>
    ${constel}
    <div class="ins-cerca__acc">
      ${mas ? `<button class="btn btn--linea" data-c="siguiente">Siguiente medalla ›</button>` : `<button class="btn btn--linea" data-c="listo">Listo</button>`}
      <button class="btn btn--soft" data-c="alcielo">Ver en tu vitrina</button>
    </div>`;
}
/* Medalla plana (sin WebGL): su silueta en el color del metal, con el ícono de la insignia */
function planoCercaHtml(I, gana) {
  const ico = I.oculta ? "❔" : I.b.icon;
  return `<div class="ins-plano ins-plano--${I.metal}${I.gano ? "" : " is-vidrio"}${gana ? " is-gana" : ""}" aria-hidden="true"><span>${ico}</span></div>`;
}
/* Pinta la ficha (y la medalla plana si no hay 3D). conservar: no mueve el foco */
function pintarCerca(conservar) {
  const el = cercaEl(), I = cieloInfo(CERCA.id); if (!I) return;
  const gana = CERCA.modo === "ganar";
  document.getElementById("insCercaFicha").innerHTML = iconizar(gana ? fichaGanarHtml(I) : fichaCercaHtml(I));
  const plano = document.getElementById("insCercaPlano"), con3d = !!CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d;
  const antes = plano.dataset.id;
  plano.hidden = con3d || (!CIELO_ESTADO.sin3d && !!CIELO_ESTADO.carga);
  if (!plano.hidden && antes !== CERCA.id + CERCA.modo) { plano.innerHTML = iconizar(planoCercaHtml(I, gana)); plano.dataset.id = CERCA.id + CERCA.modo; }
  el.classList.toggle("is-plano", !con3d);
  el.classList.toggle("is-ganar", gana);
  document.getElementById("insCercaPista").textContent = !con3d || gana ? "" : cieloTactil() ? "Arrastra para girarla" : "Arrastra para girarla · ← → para cambiar";
  if (!conservar) { const x = el.querySelector(gana ? '[data-c="listo"], [data-c="siguiente"]' : ".ins-cerca__x"); if (x) x.focus({ preventScroll: true }); }
}
function abrirCapa(id, modo, cola) {
  const el = cercaEl(), abierta = !!CERCA.id;
  if (!abierta) { CERCA.volver = document.activeElement; CERCA.ruta = CURRENT; }
  CERCA.id = id; CERCA.modo = modo; CERCA.cola = cola || []; CERCA.i = 0;
  el.hidden = false; document.body.classList.add("ins-cerca-abierta");
  if (!abierta && history.pushState) { try { history.pushState({ insCerca: 1 }, ""); CERCA.hist = true; } catch (e) { CERCA.hist = false; } }
  const motor = CIELO_ESTADO.sin3d ? null : cieloMotor();   // antes de pintar: mientras carga no se ve la medalla plana
  pintarCerca();
  if (!motor) return;
  motor.then(m => {
    if (!CERCA.id) return;
    const caja = document.getElementById("insCercaLienzo");
    if (CERCA.modo === "ganar") m.ganar(CERCA.id, caja); else m.abrir(CERCA.id, caja);
    pintarCerca(true);
  }).catch(() => { if (CERCA.id) pintarCerca(true); });
}
function abrirInsignia(id) { if (findBadge(id)) abrirCapa(id, "ver"); }
function cambiarInsignia(id) {
  if (!CERCA.id || !findBadge(id) || id === CERCA.id) return;
  CERCA.id = id;
  if (CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d) CIELO_ESTADO.motor.cambiar(id);
  pintarCerca(true);
}
/* Anterior / siguiente, en el orden del cielo (las secretas sin ganar se saltan) */
function moverInsignia(dir) {
  if (CERCA.modo !== "ver") return;
  const g = STATE.gamif.badges, l = cieloOrden().filter(id => id === CERCA.id || !findBadge(id).secreta || g.includes(id));
  const i = l.indexOf(CERCA.id); if (i < 0) return;
  cambiarInsignia(l[(i + dir + l.length) % l.length]);
}
/* alCielo: se va a Insignias a ver llegar las medallas como estrella fugaz (no se marcan vistas) */
function cerrarInsignia(sinHistoria, alCielo) {
  if (!CERCA.id) return;
  const el = cercaEl(), gano = CERCA.modo === "ganar" ? CERCA.cola.slice() : [];
  CERCA.id = null; CERCA.modo = "ver"; CERCA.cola = [];
  el.hidden = true; document.body.classList.remove("ins-cerca-abierta");
  if (CERCA.hist) { CERCA.hist = false; if (!sinHistoria) { try { history.back(); } catch (e) {} } }
  if (gano.length && !alCielo) { const v = cieloVisto(); cieloGuardarVisto(v ? [...new Set(v.concat(gano))] : [...STATE.gamif.badges]); }
  const m = CIELO_ESTADO.motor;
  if (m) { m.cerrar(); montarLugar(CURRENT); }
  const v = CERCA.volver; CERCA.volver = null;
  if (v && document.body.contains(v) && v.focus) v.focus({ preventScroll: true });
}

/* -------- El momento de ganar -------- */
function abrirMomento(ids) {
  ids = (ids || []).filter(id => findBadge(id)); if (!ids.length) return;
  if (CERCA.id && CERCA.modo === "ganar") { ids.forEach(id => { if (!CERCA.cola.includes(id)) CERCA.cola.push(id); }); pintarCerca(true); return; }
  if (CERCA.id) cerrarInsignia(true);
  const ov = document.getElementById("modalOverlay");
  if (ov && !ov.hidden && typeof closeModal === "function") closeModal();
  // Quien nunca abrió su cielo: lo de antes queda visto, para que estas lleguen como estrella fugaz si va a verlas
  if (!cieloVisto()) cieloGuardarVisto(STATE.gamif.badges.filter(id => !ids.includes(id)));
  abrirCapa(ids[0], "ganar", ids);
}
function siguienteGanada() {
  if (CERCA.modo !== "ganar" || CERCA.i >= CERCA.cola.length - 1) return;
  CERCA.i++; CERCA.id = CERCA.cola[CERCA.i];
  if (CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d) CIELO_ESTADO.motor.ganar(CERCA.id);
  pintarCerca();
}

/* checkBadges avisa aquí las insignias recién ganadas. Devuelve true si se anuncian aquí (sin toast).
   Durante el cierre del día se juntan y se muestran al final; fuera, un aviso que se puede tocar */
const INS_NUEVAS = { cola: [], cierre: 0, timer: 0 };
function cieloEscenas() { try { return !localStorage.getItem("rumbo-sin-escenas"); } catch (e) { return true; } }   // las pruebas automáticas las apagan
function tomarNuevas() { const l = INS_NUEVAS.cola; INS_NUEVAS.cola = []; return l; }
function anunciarInsignias(ids) {
  ids.forEach(id => { if (!INS_NUEVAS.cola.includes(id)) INS_NUEVAS.cola.push(id); });
  if (Date.now() - INS_NUEVAS.cierre < 4000) return true;   // el cierre en curso las muestra al final
  if (typeof document === "undefined" || !cieloEscenas()) { INS_NUEVAS.cola = []; return false; }
  if (CERCA.id && CERCA.modo === "ganar") { abrirMomento(tomarNuevas()); return true; }
  avisoInsignias(); return true;
}
function avisoInsignias() {
  const ids = INS_NUEVAS.cola.slice(); if (!ids.length) return;
  let el = document.getElementById("insAviso");
  if (!el) {
    el = document.createElement("button"); el.id = "insAviso"; el.className = "ins-aviso"; el.type = "button";
    el.addEventListener("click", () => { el.hidden = true; clearTimeout(INS_NUEVAS.timer); abrirMomento(tomarNuevas()); });
    document.body.appendChild(el);
  }
  const b = findBadge(ids[ids.length - 1]), tot = ids.reduce((a, id) => a + (findBadge(id).reward || 0), 0);
  el.innerHTML = iconizar(`<span class="ins-aviso__m" style="--metal:${CIELO_METALES[cieloMetal(b)].css}">${b.icon}</span>
    <span class="ins-aviso__t"><b>${ids.length === 1 ? "¡Medalla nueva!" : `¡${ids.length} medallas nuevas!`}</b><span>${escapeHtml(b.nombre)}${ids.length > 1 ? " y más" : ""} · +${tot} ⭐</span></span>
    <span class="ins-aviso__ver">Verla ›</span>`);
  el.hidden = false; el.classList.remove("is-entra"); void el.offsetWidth; el.classList.add("is-entra");
  clearTimeout(INS_NUEVAS.timer);
  INS_NUEVAS.timer = setTimeout(() => { el.hidden = true; INS_NUEVAS.cola = []; }, 7000);   // sin tocarlo, igual llegan a tu cielo
}
/* El cierre del día junta las medallas que gane y las muestra después de la racha */
function cierreMedallasEmpieza() { INS_NUEVAS.cierre = Date.now(); }
function cierreMedallasTermina() {
  INS_NUEVAS.cierre = 0;
  if (!INS_NUEVAS.cola.length) return false;
  if (!cieloEscenas()) { INS_NUEVAS.cola = []; return false; }
  const ids = tomarNuevas();
  setTimeout(() => abrirMomento(ids), 1000);
  return true;
}
/* Al abrir el cierre se baja el 3D en silencio: si ganas una medalla, el momento parte sin esperar */
function cieloPrecargar() {
  if (typeof window === "undefined" || CIELO_ESTADO.sin3d || !cieloEscenas()) return;
  cieloScripts().catch(() => {});
}

/* -------- En el recibo del día -------- */
/* Las insignias que ganaste un día (del ledger), en el orden en que llegaron */
function insigniasDelDia(s, iso) {
  const g = (s.gamif && s.gamif.badges) || [];
  return ((s.gamif && s.gamif.ledger) || [])
    .filter(m => m && !m.anulado && typeof m.id === "string" && m.id.startsWith("insignia:") && m.ts && isoLocal(new Date(m.ts)) === iso)
    .sort((a, b) => a.ts - b.ts).map(m => m.id.slice(9)).filter(id => g.includes(id) && findBadge(id));
}
/* La medalla que tienes más cerca: la de mayor avance (sin secretas; de cada serie, su próximo nivel) */
function cieloMasCerca(s) {
  const g = (s.gamif && s.gamif.badges) || []; let mejor = null;
  cieloOrden().forEach(id => {
    const b = findBadge(id); if (!b || b.secreta || g.includes(id)) return;
    if (b.serie && b.nivel > 0 && !g.includes(idNivel(SERIES.find(x => x.id === b.serie), b.nivel - 1))) return;
    const a = cieloAvance(b, s); if (!a || a.pct <= 0 || a.pct >= 100) return;
    if (!mejor || a.pct > mejor.a.pct || (a.pct === mejor.a.pct && a.meta - a.v < mejor.a.meta - mejor.a.v)) mejor = { id, b, a };
  });
  return mejor;
}
/* -------- Las medallas de un año o de un trimestre (del ledger, en orden): para los cierres -------- */
function medallasDelAnio(s, y) {
  const g = (s.gamif && s.gamif.badges) || [], ini = new Date(y, 0, 1).getTime(), fin = new Date(y + 1, 0, 1).getTime();
  return ((s.gamif && s.gamif.ledger) || [])
    .filter(m => m && !m.anulado && typeof m.id === "string" && m.id.startsWith("insignia:") && m.ts >= ini && m.ts < fin)
    .sort((a, b) => a.ts - b.ts)
    .map(m => ({ id: m.id.slice(9), ts: m.ts }))
    .filter(x => g.includes(x.id) && findBadge(x.id));
}
function medallasDelTrimestre(s, y, q) { return medallasDelAnio(s, y).filter(m => Math.floor(new Date(m.ts).getMonth() / 3) === q); }
function fechaMedalla(ts) { const d = new Date(ts); return `${d.getDate()} ${CIELO_MESES[d.getMonth()]}`; }
function chipsMedallas(lista) {
  return lista.map(m => { const b = findBadge(m.id); return `<button class="med-chip" data-action="ins-ver" data-id="${m.id}">${medChip(b, `${escapeHtml(b.nombre)} <small class="med-chip__f">${fechaMedalla(m.ts)}</small>`)}</button>`; }).join("");
}
function medallasCierreHtml(lista, titulo, pie) {
  if (!lista.length) return "";
  return `<div class="cierre-meds"><div class="recibo__k">${titulo} · ${lista.length}</div>
    <div class="recibo__meds-l">${chipsMedallas(lista)}</div>${pie ? `<p class="text-xs muted mt-8">${pie}</p>` : ""}</div>`;
}
function medChip(b, etiqueta) {
  return `<span class="med-chip__m" style="--metal:${CIELO_METALES[cieloMetal(b)].css}" aria-hidden="true">${b.icon}</span>${etiqueta}`;
}
function reciboMedallasHtml(iso) {
  const hoy = insigniasDelDia(STATE, iso);
  if (hoy.length) return `<div class="recibo__meds"><span class="recibo__k">${hoy.length === 1 ? "Medalla de hoy" : "Medallas de hoy"}</span>
    <div class="recibo__meds-l">${hoy.map(id => { const b = findBadge(id); return `<button class="med-chip" data-action="ins-ver" data-id="${id}">${medChip(b, escapeHtml(b.nombre))}</button>`; }).join("")}</div></div>`;
  const c = cieloMasCerca(STATE); if (!c) return "";
  return `<button class="recibo__cerca" data-action="ins-ver" data-id="${c.id}" aria-label="Lo más cerca: ${escapeAttr(c.b.nombre)}, ${escapeAttr(c.a.txt)}">
    <span class="recibo__k">Lo más cerca</span>
    <span class="recibo__cerca-n">${medChip(c.b, `<b>${escapeHtml(c.b.nombre)}</b>`)}<small>${escapeHtml(c.a.txt)}</small></span>
    <span class="bar"><span class="bar__fill" style="width:${c.a.pct}%"></span></span></button>`;
}
