/* ============================================================
   RUMBO · 📚 La biblioteca (arriba de Lecturas)
   Cada libro que terminas queda de pie en tu repisa: con el color que le elegiste, el grosor de sus
   páginas, la altura de su formato, una cinta dorada si le pusiste 5 ★, dos puntos si lo leíste con un
   amigo y una tarjetita si lo prestaste. Los huecos punteados son los que faltan para tu meta del año.
   · «Lo terminé» (en «Leyendo ahora» de Lecturas y en Inicio): ★, una frase si quieres (solo tuya) y a
     la repisa. +40 ⭐ una vez por libro (como siempre); releerlo suma «leído 2 veces» sin volver a pagar.
   · Los libros de antes de Rumbo llenan la repisa, pero no dan ⭐, no cuentan para la meta ni las medallas.
   · Se ordena por fecha, color, autor o tu nota, y se comparte como imagen (1080 × 1350).
   · Estilos: la repisa viene con Rumbo; seis más en la Tienda (key "biblioteca"), con probador.
   · Con amigos: tu repisa en las visitas (si la compartes: lomos, título, autor y ★; nunca tus notas
     ni tus frases), «Lo quiero leer», «Recomendar» (le llega a su «Por leer») y los préstamos, con su
     tarjetita y el recordatorio de tu elefante a los 30 días.
   El dibujo: js/biblioteca-motor.js (BIBLIO_MOTOR), que lee bibDatos() y llama a bibTocarLibro(id).
   Datos: los libros en STATE.lecturas (formato, antes, anio, frase, veces, prestado, recomienda, ts) y
   el ajuste en STATE.biblio = { orden, ts }. Recomendar: supabase/biblioteca.sql.
   ============================================================ */
const BIB_FORMATOS = [["bolsillo", "Bolsillo"], ["normal", "Normal"], ["grande", "Grande"]];
const BIB_ORDENES = [["fecha", "Fecha"], ["color", "Color"], ["autor", "Autor"], ["nota", "Tu nota"]];
const BIB_ESTILOS = [
  { id: "repisa", nombre: "La repisa", cos: null, desc: "de pino, con tu elefante al lado" },
  { id: "torre", nombre: "La torre de libros", cos: "bib-torre", desc: "tus libros acostados, uno encima del otro" },
  { id: "flotantes", nombre: "Las repisas flotantes", cos: "bib-flotantes", desc: "tablas sin soportes en una pared clara" },
  { id: "libreria", nombre: "La librería de barrio", cos: "bib-libreria", desc: "tu nombre en el letrero y el último en la vitrina" },
  { id: "escalera", nombre: "La pared con escalera", cos: "bib-escalera", desc: "de pared a pared, con su escalera corrediza" },
  { id: "arbol", nombre: "El árbol de libros", cos: "bib-arbol", desc: "cada libro brota en una rama; florece en tu meta" },
  { id: "antigua", nombre: "La biblioteca antigua", cos: "bib-antigua", desc: "cuero, letras doradas, el globo y la lámpara verde" },
];
const BIB_PRESTAMO_DIAS = 30, BIB_VISITA_MAX = 150;

/* ============ Los datos ============ */
function bibCfg(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { orden: "fecha", ts: 0 };
  if (!S.biblio || typeof S.biblio !== "object") S.biblio = { orden: "fecha", ts: 0 };
  return S.biblio;
}
function bibTerminado(l) { return !!l && l.estado === "terminado"; }
/* Para las ⭐, la meta del año y las medallas: los terminados en Rumbo (los de antes no) */
function bibCuenta(l) { return bibTerminado(l) && !l.antes; }
function bibDelAnio(S, anio) { anio = String(anio || anioActual()); return ((S || STATE).lecturas || []).filter(l => bibCuenta(l) && String(l.fin || "").startsWith(anio)).length; }
function bibMeta(S) { return Math.max(1, Math.round(+((S || STATE).settings.metaLibros) || 12)); }
function bibFormato(l) { return ["bolsillo", "grande"].includes(l && l.formato) ? l.formato : "normal"; }
/* El tono de un color (0–360), para ordenar como un arcoíris */
function bibTono(hex) {
  const h = String(hex || "").replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(h)) return 400;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.08) return 380 + (1 - mx) * 10;   // los grises y el azul noche, al final
  const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
}
/* Los libros de la repisa (terminados, también los de antes), en el orden que elegiste */
function bibLibros(S, orden) {
  S = S || STATE; orden = orden || bibCfg(S).orden || "fecha";
  const ls = (S.lecturas || []).filter(bibTerminado);
  const cuando = l => l.antes ? String(l.anio || "0000") + "-00-00" : String(l.fin || "9999");   // los de antes van primero, por año
  const porFecha = (a, b) => cuando(a).localeCompare(cuando(b)) || String(a.titulo || "").localeCompare(String(b.titulo || ""), "es");
  const cmp = {
    fecha: porFecha,
    color: (a, b) => bibTono(a.color) - bibTono(b.color) || porFecha(a, b),
    autor: (a, b) => (!a.autor - !b.autor) || String(a.autor || "").localeCompare(String(b.autor || ""), "es", { sensitivity: "base" }) || porFecha(a, b),   // sin autor, al final
    nota: (a, b) => (+b.valoracion || 0) - (+a.valoracion || 0) || porFecha(a, b),
  }[orden] || porFecha;
  return ls.slice().sort(cmp);
}
let BIB_ELE = { k: "", svg: "" };
function bibElefante() {
  if (typeof elefanteSVG !== "function" || typeof STATE === "undefined" || !STATE) return "";
  const k = JSON.stringify([STATE.gamif.equipped && STATE.gamif.equipped.ele, STATE.gamif.xp]);
  if (BIB_ELE.k !== k) { try { BIB_ELE = { k, svg: elefanteSVG({ anim: false }) }; } catch (e) { BIB_ELE = { k, svg: "" }; } }
  return BIB_ELE.svg;
}
function bibLomo(l) {
  return { id: String(l.id), titulo: String(l.titulo || "").slice(0, 80), autor: String(l.autor || "").slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(l.color || "") ? l.color : LECT_COLORS[0],
    paginas: Math.max(0, Math.min(3000, Math.round(+l.paginas || 0))), formato: bibFormato(l), estrellas: Math.max(0, Math.min(5, Math.round(+l.valoracion || 0))),
    juntos: !!l.juntos, prestado: l.prestado && l.prestado.a ? String(l.prestado.a).slice(0, 30) : "", antes: !!l.antes };
}
/* Lo que dibuja el motor (biblioteca-motor.js) */
function bibDatos(S) {
  S = S || STATE; if (!S) return null;
  const meta = bibMeta(S), delAnio = bibDelAnio(S);
  return { libros: bibLibros(S).map(bibLomo), huecos: Math.max(0, meta - delAnio), meta, delAnio, florece: delAnio >= meta,
    nombre: String((S.profile && S.profile.name) || "").trim().split(/\s+/)[0].slice(0, 20), elefante: bibElefante() };
}
function bibEstiloTuyo(id) { const e = BIB_ESTILOS.find(x => x.id === id); return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos))); }
function bibEstilo() { const eq = (typeof STATE !== "undefined" && STATE && STATE.gamif && STATE.gamif.equipped) || {}; return bibEstiloTuyo(eq.biblioteca) ? eq.biblioteca : "repisa"; }
function bibDiasEntre(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
function bibFechaLarga(iso) { return iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: iso.slice(0, 4) === String(anioActual()) ? undefined : "numeric" }) : ""; }
/* Lo prestado hace 30 días o más (para el recordatorio) */
function bibPrestamosViejos(S, hoy) { hoy = hoy || todayISO(); return ((S || STATE).lecturas || []).filter(l => l.prestado && l.prestado.desde && bibDiasEntre(l.prestado.desde, hoy) >= BIB_PRESTAMO_DIAS); }
/* Meses seguidos con al menos un libro terminado (la medalla «Un libro al mes»): el mejor tramo */
function bibMesesSeguidos(S) {
  const meses = [...new Set(((S || STATE).lecturas || []).filter(bibCuenta).map(l => String(l.fin || "").slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort();
  let mejor = 0, run = 0, prev = null;
  meses.forEach(m => {
    const [y, mm] = m.split("-").map(Number), sig = prev ? (prev[1] === 12 ? [prev[0] + 1, 1] : [prev[0], prev[1] + 1]) : null;
    run = sig && sig[0] === y && sig[1] === mm ? run + 1 : 1; mejor = Math.max(mejor, run); prev = [y, mm];
  });
  return mejor;
}
/* El libro más largo que terminaste en Rumbo («El ladrillo»: 600 páginas o más) */
function bibMasLargo(S) { return Math.max(0, ...((S || STATE).lecturas || []).filter(bibCuenta).map(l => +l.paginas || 0)); }

/* ============ La repisa, arriba de Lecturas ============ */
function bibRepisaHtml() {
  const S = STATE, cfg = bibCfg(), libros = bibLibros(), meta = bibMeta(S), del = bibDelAnio(S), estilo = bibEstilo(), anio = anioActual();
  const antes = libros.filter(l => l.antes).length;
  const prest = bibPrestamosViejos(S);
  const orden = `<div class="bib-orden" role="group" aria-label="Ordenar la repisa">${BIB_ORDENES.map(([k, t]) => `<button type="button" class="chip${cfg.orden === k ? " is-on" : ""}" aria-pressed="${cfg.orden === k}" data-action="bib-orden" data-v="${k}">${t}</button>`).join("")}</div>`;
  const nombre = BIB_ESTILOS.find(x => x.id === estilo).nombre;
  return `<section class="card bib" aria-labelledby="bib-t">
    <div class="bib__cab"><div><h2 class="card__title" id="bib-t">Tu biblioteca</h2>
      <span class="text-sm muted">${libros.length === 1 ? "1 libro" : libros.length + " libros"}${antes ? ` (${antes} de antes de Rumbo)` : ""} · <b>${del} de ${meta}</b> en ${anio}</span></div>
      <button type="button" class="btn-ghost bib__estilo" data-action="bib-probador">${escapeHtml(nombre)} ›</button></div>
    <canvas class="bib__cv" data-biblio="${estilo}" data-modo="lecturas" role="img" aria-label="${escapeAttr(`Tu biblioteca: ${libros.length} libros, ${del} de ${meta} en ${anio}`)}"></canvas>
    ${libros.length ? "" : `<p class="text-sm muted bib__vacio">Cuando termines un libro, queda de pie aquí con su color. Los huecos punteados son tu meta del año.</p>`}
    ${prest.map(l => `<div class="bib-prest"><span>📖 Le prestaste «${escapeHtml(l.titulo)}» a ${escapeHtml(l.prestado.a)} hace ${bibDiasEntre(l.prestado.desde, todayISO())} días. ¿Ya volvió?</span>
      <button class="btn btn--soft" data-action="bib-devuelto" data-id="${escapeAttr(l.id)}">Me lo devolvieron</button></div>`).join("")}
    <div class="bib__pie">${libros.length > 1 ? orden : ""}
      <span class="bib__bts"><button class="btn-ghost" data-action="bib-antes">${icoUI("plus")} Los que ya leí</button>${libros.length ? `<button class="btn-ghost" data-action="bib-compartir">${icoUI("share")} Compartir</button>` : ""}</span></div>
  </section>`;
}
/* El botón «Lo terminé» (en «Leyendo ahora» y en Inicio) */
function bibBotonTermine(l, clase) { return `<button type="button" class="btn btn--soft bib-termine ${clase || ""}" data-action="bib-termine" data-id="${escapeAttr(l.id)}">${icoUI("check")} Lo terminé</button>`; }

/* ============ «Lo terminé» ============ */
function openLoTermine(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  openModal("¿Qué te pareció?", `<div class="bib-fin">
    <div class="bib-fin__libro">${libroSpine(l, 34, 50)}<span><b>${escapeHtml(l.titulo || "Sin título")}</b><span class="text-xs muted">${escapeHtml(l.autor || "")}</span></span></div>
    <div class="field"><label>Tus estrellas</label>${elEscala("bf-estrellas", +l.valoracion || 0, { ico: "estrella", cero: true, label: "Valoración, de 1 a 5 estrellas", etiquetas: ["1 estrella", "2 estrellas", "3 estrellas", "4 estrellas", "5 estrellas"] })}</div>
    <div class="field"><label for="bf-frase">Una frase, si quieres <span class="text-xs muted">(solo para ti)</span></label><input class="input" id="bf-frase" maxlength="140" placeholder="Ej: Nadie se salva solo." value="${escapeAttr(l.frase || "")}"></div>
    <div class="row">
      ${+l.paginas > 0 ? "" : `<div class="field" style="flex:1"><label for="bf-paginas">Páginas</label><input class="input" id="bf-paginas" type="number" min="1" inputmode="numeric" placeholder="Ej: 296"></div>`}
      <div class="field" style="flex:2"><label>Formato <span class="text-xs muted">(la altura del lomo)</span></label>${elTramos("bf-formato", BIB_FORMATOS, bibFormato(l), { label: "Formato del libro" })}</div>
    </div>
    <button class="btn btn--primary btn-block" data-action="bib-termine-ok" data-id="${escapeAttr(l.id)}">A la repisa</button>
    <p class="text-xs muted" style="margin:0">${l.premiado || l.antes ? (l.veces ? `Va a quedar como «leído ${(+l.veces || 1) + 1} veces».` : "") : "Ganas 40 ⭐ y tu meta del año tiene un hueco menos."}</p></div>`);
}
function bibTerminar(id, op) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return null;
  op = op || {};
  const yaEstaba = bibTerminado(l) && !l.relee, eraRelectura = !!l.relee || (!!l.premiado && !bibTerminado(l));
  if (op.estrellas != null) l.valoracion = Math.max(0, Math.min(5, Math.round(+op.estrellas || 0)));
  if (op.frase != null) l.frase = String(op.frase).trim().slice(0, 140);
  if (op.formato) l.formato = bibFormato({ formato: op.formato });
  if (+op.paginas > 0 && !(+l.paginas > 0)) l.paginas = Math.min(3000, Math.round(+op.paginas));
  if (!yaEstaba) {
    if (eraRelectura) l.veces = (+l.veces || 1) + 1;
    l.estado = "terminado"; if (!l.inicio) l.inicio = todayISO(); l.fin = todayISO(); if (+l.paginas > 0) l.pagina = +l.paginas;
    delete l.relee;
  }
  l.ts = Date.now();
  let gano = 0;
  if (!l.premiado && !l.antes) { l.premiado = true; if (registrarMovimiento("lectura:" + l.id, 40, 40, "Libro terminado", true)) gano = 40; }
  saveState();
  if (l.juntos && typeof ljAvance === "function") ljAvance(l.id, l.pagina);   // lo lees con amigos (lecturas-amigos.js)
  if (typeof checkBadges === "function") checkBadges();
  return { l, gano, nuevo: !yaEstaba };
}
function bibTerminarDesdeHoja(id) {
  const e = document.getElementById("bf-estrellas"), f = document.getElementById("bf-formato"), p = document.getElementById("bf-paginas");
  const r = bibTerminar(id, { estrellas: e ? e.value : null, frase: val("bf-frase"), formato: f ? f.value : null, paginas: p ? p.value : 0 });
  if (!r) return;
  closeModal(); rerender();
  const del = bibDelAnio(STATE), meta = bibMeta(STATE);
  toast(`📚 «${r.l.titulo}» a tu repisa${r.gano ? ` · +${r.gano} ⭐` : ""} · ${del} de ${meta} en ${anioActual()}`);
  if (r.gano) refreshPts(r.gano);
  vibrar([10, 50, 14]);
  if (r.nuevo) setTimeout(() => { if (typeof BIBLIO_MOTOR !== "undefined") BIBLIO_MOTOR.sumar(r.l.id); }, 260);   // el lomo cae a su lugar
}
/* Releerlo: vuelve a «Leyendo»; al terminarlo, «leído 2 veces» (sin volver a pagar) */
function bibReleer(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  Object.assign(l, { estado: "leyendo", relee: true, pagina: 0, ts: Date.now() }); saveState(); closeModal(); rerender();
  toast(`📖 «${l.titulo}» de nuevo en «Leyendo ahora». Al terminarlo, vuelve a tu repisa.`);
}
function bibDejar(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  Object.assign(l, { estado: "dejado", ts: Date.now() }); delete l.relee; saveState(); closeModal(); rerender();
  toast(`«${l.titulo}» quedó como «Lo dejé». Sin culpa: si vuelves, está ahí.`);
}

/* ============ Los libros de antes de Rumbo ============ */
function bibAntesFila(i) {
  return `<div class="bib-antes__f"><input class="input" data-antes="t" maxlength="80" placeholder="Título" aria-label="Título del libro ${i + 1}">
    <input class="input" data-antes="a" maxlength="60" placeholder="Autor (opcional)" aria-label="Autor del libro ${i + 1}">
    <input class="input" data-antes="y" type="number" inputmode="numeric" min="1900" max="${anioActual()}" placeholder="Año" aria-label="Año en que lo leíste"></div>`;
}
function openLibrosAntes() {
  openModal("📚 Los que ya leíste", `<p class="text-sm muted" style="margin-top:0">Para que tu repisa no parta vacía: el título y, si te acuerdas, el año. Llenan la repisa, pero no dan ⭐ ni cuentan para tu meta.</p>
    <div class="bib-antes" id="bib-antes">${[0, 1, 2, 3].map(bibAntesFila).join("")}</div>
    <button class="btn-ghost" data-action="bib-antes-mas">${icoUI("plus")} Otro libro</button>
    <button class="btn btn--primary btn-block mt-8" data-action="bib-antes-ok">A la repisa</button>`);
}
function bibAgregarAntes(filas) {
  const hoyY = anioActual(), nuevos = [];
  (filas || []).forEach(f => {
    const t = String(f.titulo || "").trim().slice(0, 80); if (!t) return;
    const y = Math.round(+f.anio || 0);
    nuevos.push({ id: uid(), titulo: t, autor: String(f.autor || "").trim().slice(0, 60), estado: "terminado", antes: true, anio: y >= 1900 && y <= hoyY ? y : 0,
      paginas: 0, pagina: 0, valoracion: 0, nota: "", color: LECT_COLORS[Math.abs([...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % LECT_COLORS.length],
      inicio: "", fin: "", ts: Date.now() });
  });
  STATE.lecturas.push(...nuevos);
  return nuevos;
}
function bibAntesGuardar() {
  const filas = [...document.querySelectorAll("#bib-antes .bib-antes__f")].map(f => ({ titulo: f.querySelector('[data-antes="t"]').value, autor: f.querySelector('[data-antes="a"]').value, anio: f.querySelector('[data-antes="y"]').value }));
  const n = bibAgregarAntes(filas);
  if (!n.length) return toast("Escribe al menos un título", true);
  saveState(); closeModal(); rerender();
  toast(`📚 ${n.length === 1 ? "1 libro" : n.length + " libros"} de antes en tu repisa`);
}

/* ============ La ficha de un libro (al tocar su lomo) ============ */
function bibTocarLibro(id, cv) {
  if (cv && cv.dataset && cv.dataset.modo === "visita") return bibFichaVisita(id, cv);
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  const e = escapeHtml, i = escapeAttr(l.id), dias = l.inicio && l.fin ? Math.max(1, bibDiasEntre(l.inicio, l.fin) + 1) : 0;
  const amigos = (typeof AMIGOS !== "undefined" && AMIGOS.lista && AMIGOS.lista.amigos) || [];
  const cuando = l.antes ? (l.anio ? `Lo leíste en ${l.anio}, antes de Rumbo` : "Lo leíste antes de Rumbo") : l.fin ? `Lo terminaste el ${bibFechaLarga(l.fin)}${dias ? ` · te tomó ${dias === 1 ? "1 día" : dias + " días"}` : ""}` : "";
  const datos = [+l.paginas > 0 ? `${l.paginas} páginas` : "", BIB_FORMATOS.find(f => f[0] === bibFormato(l))[1].toLowerCase(), +l.veces > 1 ? `leído ${l.veces} veces` : "", l.juntos ? "lo leíste con amigos" : "", l.recomienda && l.recomienda.de ? `te lo recomendó ${e(l.recomienda.de)}` : ""].filter(Boolean).join(" · ");
  openModal(l.titulo || "Tu libro", `<div class="bib-ficha">
    <div class="bib-ficha__cab">${libroSpine(l, 44, 64)}<span><b class="bib-ficha__t">${e(l.titulo || "Sin título")}</b><span class="text-sm muted">${e(l.autor || "")}</span>
      ${+l.valoracion ? estrellas(l.valoracion) : ""}</span></div>
    ${cuando ? `<p class="text-sm" style="margin:0">${e(cuando)}</p>` : ""}
    ${datos ? `<p class="text-xs muted" style="margin:0">${datos}</p>` : ""}
    ${l.frase ? `<blockquote class="bib-ficha__frase">«${e(l.frase)}»<small>solo tú la ves</small></blockquote>` : ""}
    ${l.nota ? `<p class="text-sm muted bib-ficha__nota">${e(l.nota)}</p>` : ""}
    ${l.prestado ? `<div class="bib-prest"><span>Se lo prestaste a ${e(l.prestado.a)} el ${bibFechaLarga(l.prestado.desde)}.</span><button class="btn btn--soft" data-action="bib-devuelto" data-id="${i}">Me lo devolvieron</button></div>` : ""}
    <div class="bib-ficha__bts">
      ${l.prestado ? "" : `<button class="btn btn--soft" data-action="bib-prestar" data-id="${i}">Prestarlo</button>`}
      ${amigos.length && typeof BACKEND !== "undefined" && BACKEND.bibRecomendar ? `<button class="btn btn--soft" data-action="bib-recomendar" data-id="${i}">Recomendarlo</button>` : ""}
      ${l.antes ? "" : `<button class="btn btn--soft" data-action="bib-releer" data-id="${i}">Releerlo</button>`}
      <button class="btn-ghost" data-action="libro-edit" data-id="${i}">Editar</button>
    </div></div>`);
}

/* ============ Compartir la repisa (1080 × 1350, como el Álbum) ============ */
async function bibImagen() {
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), F = (p, px) => `${p} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`, d = bibDatos();
  d.libros = d.libros.map(x => Object.assign({}, x, { prestado: "" }));   // a quién prestaste es solo tuyo: no sale en la imagen
  const fondo = g.createLinearGradient(0, 0, 0, H); fondo.addColorStop(0, "#FBF6EC"); fondo.addColorStop(1, "#EFE4D0"); g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  g.fillStyle = "#2B2118"; g.font = F(800, 64); g.fillText(d.nombre ? `La biblioteca de ${d.nombre}` : "Mi biblioteca", 72, 132);
  g.fillStyle = "#7A6650"; g.font = F(600, 36);
  g.fillText(`${d.libros.length === 1 ? "1 libro" : d.libros.length + " libros"} · ${d.delAnio} de ${d.meta} en ${anioActual()}`, 72, 190);
  const caja = document.createElement("canvas"); caja.width = W - 96; caja.height = H - 380;
  try { if (typeof BIBLIO_MOTOR !== "undefined") await BIBLIO_MOTOR.dibujarEn(caja.getContext("2d"), bibEstilo(), d, caja.width, caja.height); } catch (e) { /* sin dibujo, queda el texto */ }
  g.drawImage(caja, 48, 240);
  g.fillStyle = "#2B2118"; g.font = F(700, 40); g.fillText("Mis libros con Rumbo", 72, H - 82);
  g.fillStyle = "#7A6650"; g.font = F(700, 32); g.fillText("rumbo.biplot.cl", 72, H - 36);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
async function bibCompartir() {
  const blob = await bibImagen(); if (!blob) return toast("No se pudo crear la imagen", true);
  const nombre = `rumbo-biblioteca-${todayISO()}.png`, texto = "Mi biblioteca en Rumbo · rumbo.biplot.cl";
  try {
    const file = new File([blob], nombre, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); if (typeof registrarCompartido === "function") registrarCompartido(); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (typeof registrarCompartido === "function") registrarCompartido();
  toast("Imagen descargada: compártela donde quieras");
}

/* ============ El probador de estilos (como el del agua) ============ */
function bibCosto(cos) { const it = typeof COSMETICOS !== "undefined" ? COSMETICOS.find(x => x.id === cos) : null; return it ? it.costo : 0; }
function openBibProbador() {
  const actual = bibEstilo();
  openModal("Cómo se ve tu biblioteca", `<p class="text-sm muted" style="margin-top:0">Tus mismos libros, dibujados de otra forma. Cámbialo cuando quieras: no se pierde nada.</p>
    <div class="bib-prob" id="bib-probador">${BIB_ESTILOS.map(e => {
      const tuyo = bibEstiloTuyo(e.id), on = e.id === actual;
      return `<button type="button" class="bib-prob__f${on ? " is-on" : ""}" data-action="bib-estilo" data-v="${e.id}" aria-pressed="${on}">
        <canvas class="bib-prob__cv" data-biblio="${e.id}" data-modo="chica" aria-hidden="true"></canvas>
        <b>${escapeHtml(e.nombre)}</b><small class="muted">${escapeHtml(e.desc)}</small>
        <span class="bib-prob__p">${on ? "✓ La tuya" : tuyo ? "Usar" : `${bibCosto(e.cos)} ⭐`}</span></button>`;
    }).join("")}</div>`, { ancho: true });
}
function bibElegirEstilo(id) {
  const e = BIB_ESTILOS.find(x => x.id === id); if (!e) return;
  if (!bibEstiloTuyo(id)) { if (typeof openFicha === "function") return openFicha("cos:" + e.cos); return; }
  eqCos().biblioteca = id === "repisa" ? null : id; saveState(); closeModal(); rerender();
  toast(`📚 ${e.nombre}: así se ve ahora tu biblioteca`);
}
function bibFichaHtml(it) { return `<canvas class="bib-ficha-cv" data-biblio="${escapeAttr(it.value)}" data-modo="chica" aria-hidden="true"></canvas>`; }
function bibMuestraHtml(it) { return `<canvas class="bib__cv" data-biblio="${escapeAttr(it.value)}" data-modo="muestra" aria-hidden="true"></canvas>`; }

/* ============ Con amigos ============ */
/* Lo que publicas para las visitas (si compartes tu biblioteca): lomos, título, autor y ★; nunca notas, frases ni a quién prestaste */
function bibPublica(S) {
  S = S || STATE;
  const libros = bibLibros(S, "fecha").slice(-BIB_VISITA_MAX).map(l => {
    const b = bibLomo(l);
    return { i: b.id.slice(0, 24), t: b.titulo.slice(0, 60), a: b.autor.slice(0, 40), c: b.color, p: b.paginas, f: b.formato[0], e: b.estrellas, j: b.juntos ? 1 : 0 };
  });
  return libros.length ? { estilo: bibEstilo(), libros, anio: bibDelAnio(S), meta: bibMeta(S) } : null;
}
/* Lo que llega de un amigo: se limpia (lo escribió otra persona) */
function bibVisitaLimpia(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.libros)) return null;
  const F = { b: "bolsillo", n: "normal", g: "grande" };
  const libros = v.libros.slice(0, BIB_VISITA_MAX).filter(x => x && typeof x === "object" && String(x.t || "").trim()).map((x, k) => ({
    id: "v" + k, titulo: String(x.t).trim().slice(0, 60), autor: String(x.a || "").trim().slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(x.c || "") ? x.c : LECT_COLORS[k % LECT_COLORS.length],
    paginas: Math.max(0, Math.min(3000, parseInt(x.p, 10) || 0)), formato: F[x.f] || "normal", estrellas: Math.max(0, Math.min(5, parseInt(x.e, 10) || 0)), juntos: !!x.j, prestado: "", antes: false }));
  const meta = Math.max(1, Math.min(500, parseInt(v.meta, 10) || 12)), anio = Math.max(0, Math.min(500, parseInt(v.anio, 10) || 0));
  return { estilo: BIB_ESTILOS.some(e => e.id === v.estilo) ? v.estilo : "repisa", libros, meta, delAnio: anio };
}
const BIB_VISITA = { id: null, nombre: "", datos: null };
async function bibVisitar(id) {
  const r = await BACKEND.amigosVisita(id);
  if (!r || r.error) return toast(r && r.error === "sin-servidor" ? "Las visitas todavía no están activas en el servidor." : amigosTextoError((r && r.error) || "error"), true);
  const a = typeof amigoPorId === "function" ? amigoPorId(id) : null, nombre = String((a && a.nombre) || r.nombre || "Tu amigo").slice(0, 60);
  const d = bibVisitaLimpia(r.biblioteca);
  if (!d || !d.libros.length) return toast(`${nombre} no muestra su biblioteca`, true);
  Object.assign(BIB_VISITA, { id, nombre, datos: d });
  openModal(`📚 La biblioteca de ${nombre}`, `<p class="text-sm muted" style="margin-top:0">${d.libros.length === 1 ? "1 libro" : d.libros.length + " libros"} · ${d.delAnio} de ${d.meta} este año. Toca un lomo: si te tinca, «Lo quiero leer».</p>
    <canvas class="bib__cv" id="bib-visita-cv" data-biblio="${d.estilo}" data-modo="visita" role="img" aria-label="${escapeAttr(`La biblioteca de ${nombre}: ${d.libros.length} libros`)}"></canvas>`, { ancho: true });
  const cv = document.getElementById("bib-visita-cv");
  if (cv) cv._bibDatos = () => ({ libros: BIB_VISITA.datos.libros, huecos: 0, meta: BIB_VISITA.datos.meta, delAnio: BIB_VISITA.datos.delAnio, florece: BIB_VISITA.datos.delAnio >= BIB_VISITA.datos.meta, nombre: BIB_VISITA.nombre.split(/\s+/)[0], elefante: "" });
}
function bibFichaVisita(id) {
  const b = BIB_VISITA.datos && BIB_VISITA.datos.libros.find(x => x.id === id); if (!b) return;
  const ya = STATE.lecturas.some(l => bibMismo(l, b));
  openModal(b.titulo, `<div class="bib-ficha">
    <div class="bib-ficha__cab"><div class="spine" style="background:${b.color};width:44px;height:64px"></div><span><b class="bib-ficha__t">${escapeHtml(b.titulo)}</b><span class="text-sm muted">${escapeHtml(b.autor)}</span>${b.estrellas ? estrellas(b.estrellas) : ""}</span></div>
    <p class="text-xs muted" style="margin:0">De la biblioteca de ${escapeHtml(BIB_VISITA.nombre)}${b.paginas ? ` · ${b.paginas} páginas` : ""}</p>
    <div class="bib-ficha__bts">${ya ? `<span class="chip">Ya está en tus libros</span>` : `<button class="btn btn--primary" data-action="bib-quiero" data-id="${escapeAttr(b.id)}">Lo quiero leer</button>`}
      <button class="btn-ghost" data-action="bib-visita-volver">‹ Su biblioteca</button></div></div>`);
}
function bibMismo(l, b) { return String(l.titulo || "").trim().toLowerCase() === String(b.titulo || "").trim().toLowerCase() && String(l.autor || "").trim().toLowerCase() === String(b.autor || "").trim().toLowerCase(); }
/* A tu «Por leer», con quién te lo recomendó */
function bibPorLeer(b, de) {
  if (STATE.lecturas.some(l => bibMismo(l, b))) return null;
  const l = { id: uid(), titulo: String(b.titulo || "").slice(0, 80), autor: String(b.autor || "").slice(0, 60), estado: "por-leer", paginas: Math.max(0, Math.min(3000, +b.paginas || 0)), pagina: 0, valoracion: 0, nota: "",
    color: /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : LECT_COLORS[0], inicio: "", fin: "", recomienda: { de: String(de || "").slice(0, 40) }, ts: Date.now() };
  STATE.lecturas.push(l); return l;
}
function bibQuiero(id) {
  const b = BIB_VISITA.datos && BIB_VISITA.datos.libros.find(x => x.id === id); if (!b) return;
  const l = bibPorLeer(b, BIB_VISITA.nombre); if (!l) return toast("Ya está en tus libros");
  saveState(); bibFichaVisita(id);
  toast(`📚 «${l.titulo}» quedó en tu «Por leer», con «te lo recomendó ${BIB_VISITA.nombre}»`);
}
/* Prestar un libro de verdad: queda su tarjetita en la repisa y, a los 30 días, tu elefante te lo recuerda */
function openPrestar(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  const amigos = ((typeof AMIGOS !== "undefined" && AMIGOS.lista && AMIGOS.lista.amigos) || []).slice(0, 12);
  openModal("¿A quién se lo prestas?", `<div class="field"><label for="bib-prest-a">Nombre</label><input class="input" id="bib-prest-a" maxlength="30" placeholder="Ej: Ana"></div>
    ${amigos.length ? `<div class="agua-chips" style="margin-bottom:10px">${amigos.map(a => `<button type="button" class="chip" onclick="document.getElementById('bib-prest-a').value=this.dataset.n" data-n="${escapeAttr(String(a.nombre || "").split(/\s+/)[0])}">${escapeHtml(a.nombre || "")}</button>`).join("")}</div>` : ""}
    <p class="text-xs muted">En tu repisa queda su tarjetita hasta que vuelva. A los ${BIB_PRESTAMO_DIAS} días, tu elefante te lo recuerda. Solo tú lo ves.</p>
    <button class="btn btn--primary btn-block" data-action="bib-prestar-ok" data-id="${escapeAttr(l.id)}">Prestarlo</button>`);
}
function bibPrestar(id, a) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return null;
  a = String(a || "").trim().slice(0, 30); if (!a) return null;
  l.prestado = { a, desde: todayISO() }; l.ts = Date.now(); saveState(); return l;
}
function bibDevuelto(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l || !l.prestado) return;
  const a = l.prestado.a; l.prestado = null; l.ts = Date.now(); saveState(); closeModal(); rerender();
  toast(`📚 «${l.titulo}» volvió a tu repisa${a ? ` (gracias, ${a})` : ""}`);
}
/* Recomendar: le llega a su «Por leer» (supabase/biblioteca.sql) */
function openRecomendar(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  const amigos = (AMIGOS.lista && AMIGOS.lista.amigos) || [];
  openModal(`Recomendar «${l.titulo}»`, `<p class="text-sm muted" style="margin-top:0">Le llega a su «Por leer», con tu nombre. Tu nota y tu frase no se mandan.</p>
    <div class="cj-amigos" id="bib-rec">${amigos.map(a => `<label class="cj-amigo"><input type="checkbox" value="${escapeAttr(a.id)}">${amigosAvatar(a, 30)}<span>${escapeHtml(a.nombre || "Sin nombre")}</span></label>`).join("")}</div>
    <button class="btn btn--primary btn-block mt-8" data-action="bib-recomendar-ok" data-id="${escapeAttr(l.id)}">Recomendar</button>`);
}
async function bibRecomendar(id) {
  const l = STATE.lecturas.find(x => x.id === id); if (!l) return;
  const para = [...document.querySelectorAll("#bib-rec input:checked")].map(i => i.value);
  if (!para.length) return toast("Elige a quién", true);
  let ok = 0, err = null;
  for (const p of para) {
    const r = await BACKEND.bibRecomendar(p, { titulo: l.titulo, autor: l.autor || "", paginas: +l.paginas || 0, color: l.color });
    if (r && !r.error) { ok++; BACKEND.amigosAvisar("libro-recomienda", { id: r.id }); } else err = r && r.error;
  }
  if (!ok) return toast(err === "sin-servidor" ? "Recomendar todavía no está activo en el servidor." : err === "limite" ? "Ya recomendaste muchos hoy" : amigosTextoError(err || "error"), true);
  closeModal();
  toast(`📚 Le recomendaste «${l.titulo}» a ${cjNombres(para.map(x => { const a = amigoPorId(x); return (a && a.nombre) || "tu amigo"; }))}`);
}
/* Las que te llegaron: a tu «Por leer» (una vez cada una) */
async function bibRecibirRecomendaciones() {
  if (!CURRENT_USER || !STATE || !BACKEND.bibRecomendaciones) return;
  const r = await BACKEND.bibRecomendaciones();
  if (!STATE || !Array.isArray(r) || !r.length) return;
  const nuevos = [];
  r.forEach(x => {
    const de = String(x.nombre || "Un amigo").split(/\s+/)[0];
    const l = bibPorLeer({ titulo: String(x.titulo || "").trim(), autor: String(x.autor || "").trim(), paginas: x.paginas, color: x.color }, de);
    if (l) nuevos.push({ l, de });
  });
  if (BACKEND.bibRecomendacionesVistas) BACKEND.bibRecomendacionesVistas(r.map(x => x.id));
  if (!nuevos.length) return;
  saveState(); if (CURRENT === "lecturas") rerender();
  toast(nuevos.length === 1 ? `📚 ${nuevos[0].de} te recomendó «${nuevos[0].l.titulo}»: quedó en tu «Por leer»` : `📚 Te recomendaron ${nuevos.length} libros: quedaron en tu «Por leer»`);
}

/* ============ Acciones (data-action="bib-…", ver onClick en app.js) ============ */
function bibAccion(a, d, el) {
  if (a === "bib-termine") return openLoTermine(d.id);
  if (a === "bib-termine-ok") return bibTerminarDesdeHoja(d.id);
  if (a === "bib-orden") { Object.assign(bibCfg(), { orden: d.v, ts: Date.now() }); saveState(); rerender(); return; }
  if (a === "bib-antes") return openLibrosAntes();
  if (a === "bib-antes-mas") { const c = document.getElementById("bib-antes"); if (c && c.children.length < 30) c.insertAdjacentHTML("beforeend", bibAntesFila(c.children.length)); return; }
  if (a === "bib-antes-ok") return bibAntesGuardar();
  if (a === "bib-compartir") return bibCompartir();
  if (a === "bib-probador") return openBibProbador();
  if (a === "bib-estilo") return bibElegirEstilo(d.v);
  if (a === "bib-ficha") return bibTocarLibro(d.id);
  if (a === "bib-releer") return bibReleer(d.id);
  if (a === "bib-dejar") return bibDejar(d.id);
  if (a === "bib-prestar") return openPrestar(d.id);
  if (a === "bib-prestar-ok") { const l = bibPrestar(d.id, val("bib-prest-a")); if (!l) return toast("Escribe a quién", true); closeModal(); rerender(); return toast(`📖 «${l.titulo}» prestado a ${l.prestado.a}. Su tarjetita queda en tu repisa.`); }
  if (a === "bib-devuelto") return bibDevuelto(d.id);
  if (a === "bib-recomendar") return openRecomendar(d.id);
  if (a === "bib-recomendar-ok") return bibRecomendar(d.id);
  if (a === "bib-visitar") return bibVisitar(d.id);
  if (a === "bib-quiero") return bibQuiero(d.id);
  if (a === "bib-visita-volver") return BIB_VISITA.id && bibVisitar(BIB_VISITA.id);
}
