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
  { id: "vida", n: "Tu vida", fig: "La Medalla", ic: "medalla", ids: ["primer-peso", "medio-camino", "ahorrador-b", "ahorrador-p", "ahorrador-o", "meta-anual", "pagina-uno", "devorador", "biblioteca-b", "biblioteca-p", "biblioteca-o", "peso-pluma", "buen-amigo", "embajador"] },
  { id: "secretas", n: "Secretas", fig: "", ic: "?", ids: ["buho", "aniversario", "anio-nuevo", "remontada"] },
];
/* Ícono grabado en la medalla: el de la insignia, el de su serie o el de su familia */
const CIELO_ICONOS = {
  "semana-redonda": "calendario", "mes-redondo": "calendario", salvavidas: "rayo", guerrero: "pesa",
  "primer-peso": "moneda", "medio-camino": "moneda", "meta-anual": "moneda", "pagina-uno": "libro", devorador: "libro",
  "peso-pluma": "pluma", "buen-amigo": "corazon", embajador: "flecha",
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

/* -------- El cielo en la pantalla de Insignias -------- */
function cieloTactil() { return typeof window !== "undefined" && !!(window.matchMedia && matchMedia("(pointer: coarse)").matches); }
function cieloHtml(g) {
  const orden = cieloOrden(), n = orden.filter(id => g.badges.includes(id)).length, c = cieloCompletas();
  return `<section class="cielo${CIELO_ESTADO.sin3d ? " is-sin3d" : ""}" id="cielo" data-gesto aria-label="Tu cielo de insignias">
    <div class="cielo__lienzo" id="cieloLienzo" role="img" aria-label="Tu cielo: ${n} de ${orden.length} medallas encendidas. Abajo está la lista para verlas una por una."></div>
    <div class="cielo__cab"><div class="cielo__t">Tu cielo</div>
      <div class="cielo__s">${n} de ${orden.length} medallas · ${c === 1 ? "1 constelación completa" : `${c} constelaciones completas`}</div></div>
    <div class="cielo__etq" id="cieloEtq" hidden></div>
    <div class="cielo__pista">${cieloTactil() ? "Toca una medalla para verla de cerca" : "Haz clic en una medalla para verla de cerca · arrastra para mirar"}</div>
    <div class="cielo__carga" aria-hidden="true">Encendiendo el cielo…</div>
  </section>`;
}

/* -------- Carga diferida del 3D -------- */
const CIELO_ESTADO = { motor: null, carga: null, sin3d: false };
const CIELO_V = (typeof document !== "undefined" && document.currentScript && (document.currentScript.src.match(/\?v=\d+/) || [""])[0]) || "";
function cieloScript(src) {
  return new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => { s.remove(); mal(new Error("no cargó " + src)); };
    document.head.appendChild(s);
  });
}
/* Promesa del motor 3D (una sola vez). Falla si no hay WebGL o no se pudo bajar three.js */
function cieloMotor() {
  if (CIELO_ESTADO.motor) return Promise.resolve(CIELO_ESTADO.motor);
  if (CIELO_ESTADO.sin3d) return Promise.reject(new Error("sin 3D"));
  if (!CIELO_ESTADO.carga) {
    CIELO_ESTADO.carga = (window.THREE ? Promise.resolve() : cieloScript("js/vendor/three-0.128.0.min.js"))
      .then(() => (typeof crearMotorCielo === "function" ? null : cieloScript("js/cielo-3d.js" + CIELO_V)))
      .then(() => (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]) : null))
      .then(() => {
        CIELO_ESTADO.motor = crearMotorCielo(window.THREE, {
          orden: cieloOrden, info: id => cieloInfo(id), ganadas: () => new Set(STATE.gamif.badges || []), familias: CIELO_FAMILIAS,
          tocar: id => abrirInsignia(id), perdido: cieloSin3d,
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
  const sec = document.getElementById("cielo"); if (sec) sec.classList.add("is-sin3d");
  if (CERCA.id) pintarCerca();
}

/* Tras cada render: en Insignias se monta (o se vuelve a colgar) el cielo; fuera, se pausa */
function cieloTrasRender(route) {
  if (route !== "insignias") {
    if (CERCA.id) cerrarInsignia(true);
    if (CIELO_ESTADO.motor) CIELO_ESTADO.motor.soltar();
    return;
  }
  const caja = document.getElementById("cieloLienzo"); if (!caja) return;
  if (CERCA.id) pintarCerca(true);
  if (CIELO_ESTADO.sin3d) return;
  if (CIELO_ESTADO.motor) { if (!CERCA.id) CIELO_ESTADO.motor.montar(caja); return; }
  caja.closest(".cielo").classList.add("is-cargando");
  cieloMotor().then(m => {
    const c2 = document.getElementById("cieloLienzo");
    if (c2) c2.closest(".cielo").classList.remove("is-cargando");
    if (c2 && CURRENT === "insignias" && !CERCA.id) m.montar(c2);
  }).catch(() => {
    const sec = document.getElementById("cielo"); if (sec) sec.classList.remove("is-cargando");
    if (!CIELO_ESTADO.sin3d && sec) sec.classList.add("is-sin3d");
  });
}

/* -------- De cerca: la medalla grande y su ficha -------- */
const CERCA = { id: null, volver: null, hist: false };
function cercaEl() {
  let el = document.getElementById("insCerca");
  if (el) return el;
  el = document.createElement("div");
  el.id = "insCerca"; el.className = "ins-cerca"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "insCercaT");
  el.innerHTML = `<div class="ins-cerca__escena">
      <div class="ins-cerca__lienzo" id="insCercaLienzo"></div>
      <div class="ins-cerca__plano" id="insCercaPlano" hidden></div>
      <button class="ins-cerca__x" data-c="cerrar" aria-label="Volver al cielo">✕</button>
      <button class="ins-cerca__nav ins-cerca__nav--ant" data-c="ant" aria-label="Insignia anterior">‹</button>
      <button class="ins-cerca__nav ins-cerca__nav--sig" data-c="sig" aria-label="Insignia siguiente">›</button>
      <div class="ins-cerca__pista" id="insCercaPista"></div>
    </div>
    <div class="ins-cerca__ficha" id="insCercaFicha"></div>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    const c = b.dataset.c;
    if (c === "cerrar") cerrarInsignia();
    else if (c === "ant" || c === "sig") moverInsignia(c === "sig" ? 1 : -1);
    else if (c === "nivel") cambiarInsignia(b.dataset.id);
    else if (c === "voltear" && CIELO_ESTADO.motor) CIELO_ESTADO.motor.voltear();
  });
  document.addEventListener("keydown", e => {
    if (!CERCA.id) return;
    if (e.key === "Escape") { e.preventDefault(); cerrarInsignia(); }
    else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !isFormEl(e.target)) { e.preventDefault(); moverInsignia(e.key === "ArrowRight" ? 1 : -1); }
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
  const destacada = g.equipped && g.equipped.insignia === I.id;
  return `<div class="ins-cerca__fam">${I.fam === "secretas" ? "Secreta" : escapeHtml(fam ? fam.n : "Insignia")} · ${M.n}</div>
    <h2 class="ins-cerca__t" id="insCercaT">${escapeHtml(nombre)}</h2>
    <p class="ins-cerca__desc">${escapeHtml(desc)}</p>
    ${estado}${niveles}${constel}
    <div class="ins-cerca__acc">
      ${CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d ? `<button class="btn btn--soft" data-c="voltear">↻ Dar vuelta</button>` : ""}
      ${I.gano ? `<button class="btn btn--linea" data-action="badge-destacar" data-id="${I.id}">${destacada ? "★ Destacada" : "Destacar"}</button>` : ""}
    </div>`;
}
/* Medalla plana (sin WebGL): su silueta en el color del metal, con el ícono de la insignia */
function planoCercaHtml(I) {
  const ico = I.oculta ? "❔" : I.b.icon;
  return `<div class="ins-plano ins-plano--${I.metal}${I.gano ? "" : " is-vidrio"}" aria-hidden="true"><span>${ico}</span></div>`;
}
/* Pinta la ficha (y la medalla plana si no hay 3D). conservar: no mueve el foco */
function pintarCerca(conservar) {
  const el = cercaEl(), I = cieloInfo(CERCA.id); if (!I) return;
  document.getElementById("insCercaFicha").innerHTML = fichaCercaHtml(I);
  const plano = document.getElementById("insCercaPlano"), con3d = !!CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d;
  plano.hidden = con3d || (!CIELO_ESTADO.sin3d && !!CIELO_ESTADO.carga);
  if (!plano.hidden) plano.innerHTML = planoCercaHtml(I);
  el.classList.toggle("is-plano", !con3d);
  document.getElementById("insCercaPista").textContent = con3d ? (cieloTactil() ? "Arrastra para girarla" : "Arrastra para girarla · ← → para cambiar") : "";
  if (!conservar) { const x = el.querySelector(".ins-cerca__x"); if (x) x.focus({ preventScroll: true }); }
}
function abrirInsignia(id) {
  if (!findBadge(id)) return;
  const el = cercaEl(), abierta = !!CERCA.id;
  if (!abierta) CERCA.volver = document.activeElement;
  CERCA.id = id;
  el.hidden = false; document.body.classList.add("ins-cerca-abierta");
  if (!abierta && history.pushState) { try { history.pushState({ insCerca: 1 }, ""); CERCA.hist = true; } catch (e) { CERCA.hist = false; } }
  const motor = CIELO_ESTADO.sin3d ? null : cieloMotor();   // antes de pintar: mientras carga no se ve la medalla plana
  pintarCerca();
  if (!motor) return;
  motor.then(m => { if (CERCA.id) { m.abrir(CERCA.id, document.getElementById("insCercaLienzo")); pintarCerca(true); } })
    .catch(() => { if (CERCA.id) pintarCerca(true); });
}
function cambiarInsignia(id) {
  if (!CERCA.id || !findBadge(id) || id === CERCA.id) return;
  CERCA.id = id;
  if (CIELO_ESTADO.motor && !CIELO_ESTADO.sin3d) CIELO_ESTADO.motor.cambiar(id);
  pintarCerca(true);
}
/* Anterior / siguiente, en el orden del cielo (las secretas sin ganar se saltan) */
function moverInsignia(dir) {
  const g = STATE.gamif.badges, l = cieloOrden().filter(id => id === CERCA.id || !findBadge(id).secreta || g.includes(id));
  const i = l.indexOf(CERCA.id); if (i < 0) return;
  cambiarInsignia(l[(i + dir + l.length) % l.length]);
}
function cerrarInsignia(sinHistoria) {
  if (!CERCA.id) return;
  const el = cercaEl(); CERCA.id = null;
  el.hidden = true; document.body.classList.remove("ins-cerca-abierta");
  if (CERCA.hist) { CERCA.hist = false; if (!sinHistoria) { try { history.back(); } catch (e) {} } }
  const m = CIELO_ESTADO.motor;
  if (m) { m.cerrar(); const caja = document.getElementById("cieloLienzo"); if (caja && CURRENT === "insignias") m.montar(caja); }
  const v = CERCA.volver; CERCA.volver = null;
  if (v && document.body.contains(v) && v.focus) v.focus({ preventScroll: true });
}
