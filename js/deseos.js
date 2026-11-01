/* ============================================================
   RUMBO · 💎 Tus deseos (Finanzas, arriba de tus alcancías)
   Un deseo recorre un camino: lo anotas (nombre, precio y, si quieres, el enlace), espera 7 días
   (30 si cuesta más de $300.000) y Rumbo te pregunta si todavía lo quieres; «Ahorrar para esto»
   le crea su alcancía (unida a él: si cambias el precio, cambia la meta) o lo suma a «Mis caprichos»,
   una sola alcancía para varios deseos chicos, en orden; «Lo compré» anota cuánto pagaste (si fue
   menos, cuánto te ahorraste; lo que sobró puede ir a otra alcancía; si quieres, se suma al gasto
   del mes) y rompe el chanchito. «Ya no lo quiero» lo suelta: su precio suma a «Lo que no gastaste»
   del año (sin estrellas). La espera se puede saltar y se apaga en los ajustes.
   Las listas de deseos de antes (Listas) se mudan solas aquí (migrate, state.js).
   Datos: STATE.deseos (ver state.js); entre equipos se fusiona con deseosMerge (store.js).
   ============================================================ */
const DESEO_ESPERA = 7, DESEO_ESPERA_CARO = 30, DESEO_CARO = 300000;

/* -------- Los datos -------- */
function deseosDatos(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { lista: [], borrados: [], espera: true, ts: 0 };
  const D = S.deseos;
  if (!D || typeof D !== "object" || !Array.isArray(D.lista)) S.deseos = { lista: [], borrados: [], espera: true, ts: 0 };
  if (!Array.isArray(S.deseos.borrados)) S.deseos.borrados = [];
  return S.deseos;
}
function deseoPorId(id, S) { return deseosDatos(S).lista.find(d => d && d.id === id) || null; }
function deseosVivos(S) { const fuera = new Set(deseosDatos(S).borrados); return deseosDatos(S).lista.filter(d => d && !fuera.has(d.id)); }
function deseoEspera(d) { return (+d.precio || 0) > DESEO_CARO ? DESEO_ESPERA_CARO : DESEO_ESPERA; }
function deseoDias(d, hoy) {
  if (!d.creado) return 999;
  const a = new Date(d.creado + "T12:00"), b = new Date((hoy || todayISO()) + "T12:00");
  return Math.max(0, Math.round((b - a) / 86400000));
}
/* La alcancía del deseo, si sigue abierta */
function deseoAlc(d, S) { if (!d || !d.alc || typeof alcPorId !== "function") return null; const a = alcPorId(d.alc, S); return a && !a.cerrada && !(alcDatos(S).borradas || []).includes(a.id) ? a : null; }
/* espera · decidir · ahorro · tengo · soltado */
function deseoEstado(d, S, hoy) {
  if (d.soltado) return "soltado";
  if (d.tengo) return "tengo";
  if (deseoAlc(d, S)) return "ahorro";
  if (!deseosDatos(S).espera || d.listo || deseoDias(d, hoy) >= deseoEspera(d)) return "decidir";
  return "espera";
}
/* Lo que no gastaste: el precio de lo que soltaste este año */
function deseosNoGastaste(S, anio) {
  anio = String(anio || new Date().getFullYear());
  return deseosVivos(S).filter(d => d.soltado && String(d.soltado).slice(0, 4) === anio).reduce((s, d) => s + (+d.precio || 0), 0);
}
/* «Mis caprichos»: la alcancía que junta deseos chicos; su meta es la suma de los que siguen ahí */
function deseosCaprichosAlc(S) { return alcActivas(S).find(a => a.caprichos) || null; }
function deseosDeCaprichos(S) {
  const c = deseosCaprichosAlc(S); if (!c) return [];
  return deseosVivos(S).filter(d => d.capricho && d.alc === c.id && !d.tengo && !d.soltado).sort((x, y) => (x.orden || 0) - (y.orden || 0));
}
/* Ajusta las metas a los precios: la alcancía de un deseo, al precio; la de caprichos, a la suma */
function deseosSincronizar(S) {
  deseosVivos(S).forEach(d => { const a = deseoAlc(d, S); if (a && !d.capricho && !d.tengo && !d.soltado && a.meta !== +d.precio) { a.meta = +d.precio || 0; a.ts = Date.now(); } });
  const c = deseosCaprichosAlc(S);
  if (c) { const m = deseosDeCaprichos(S).reduce((s, d) => s + (+d.precio || 0), 0); if (c.meta !== m) { c.meta = m; c.ts = Date.now(); } }
}
/* Los caprichos en orden: cuál ya te alcanza con lo guardado */
function deseosEscalera(S) {
  const c = deseosCaprichosAlc(S); if (!c) return [];
  let acum = 0; const g = alcGuardado(c);
  return deseosDeCaprichos(S).map((d, i) => { acum += +d.precio || 0; return { d, i, hasta: acum, alcanza: g >= acum, falta: Math.max(0, acum - g) }; });
}
/* A tu ritmo: tu meta mensual (o lo que ahorraste en promedio los últimos meses con ahorro), repartida entre tus alcancías */
function deseosRitmo(S, hoy) {
  S = S || STATE; const meta = +((S.finanzas || {}).metaMensual) || 0;
  if (meta > 0) return meta;
  hoy = hoy || todayISO(); const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1, xs = [];
  for (let k = 1; k <= 3; k++) { const mm = (m - k + 12) % 12, yy = m - k < 0 ? y - 1 : y; const f = ((datosAnio(S, yy).finanzas.meses || [])[mm]) || {}; const v = (+f.ingreso || 0) - (+f.gasto || 0); if (v > 0) xs.push(v); }
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
}
function deseoCuando(falta, S, nuevo, hoy) {
  const r = deseosRitmo(S, hoy); if (!r) return "";
  if (falta <= 0) return "ya te alcanza";
  const n = Math.ceil(falta / (r / Math.max(1, alcActivas(S).length + (nuevo ? 1 : 0))));
  const mes = MESES[(new Date((hoy || todayISO()) + "T12:00").getMonth() + n) % 12].toLowerCase();
  return n > 36 ? "a tu ritmo, en más de 3 años" : `a tu ritmo, en ${n === 1 ? "1 mes" : n + " meses"}: en ${mes}`;
}

/* -------- Anotar, editar, soltar, ahorrar y comprar -------- */
function deseoNuevo(o, S) {
  const D = deseosDatos(S), ahora = Date.now();
  const d = { id: "de" + ahora.toString(36) + Math.random().toString(36).slice(2, 6), nombre: String(o.nombre || "").trim().slice(0, 40) || "Mi deseo", precio: Math.max(0, Math.round(+o.precio || 0)),
    link: deseoLinkLimpio(o.link), creado: o.creado || todayISO(), listo: false, alc: "", capricho: false, orden: 0, soltado: "", tengo: null, ts: ahora };
  D.lista.push(d); return d;
}
function deseoLinkLimpio(u) { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 300) : ""; } catch (e) { return ""; } }
function deseoTocar(d) { d.ts = Date.now(); }
/* Ahorrar para esto: su alcancía (con su nombre y su precio como meta) o «Mis caprichos» */
function deseoAhorrar(id, capricho, S) {
  const d = deseoPorId(id, S); if (!d || d.tengo || d.soltado || deseoAlc(d, S)) return null;
  let a;
  if (capricho) {
    a = deseosCaprichosAlc(S) || alcCrear({ nombre: "Mis caprichos", meta: 0, estilo: "greda" }, S);
    a.caprichos = true; d.capricho = true; d.orden = Date.now();
  } else { a = alcCrear({ nombre: d.nombre, meta: d.precio, estilo: "greda" }, S); a.deseo = d.id; d.capricho = false; }
  d.alc = a.id; d.listo = true; deseoTocar(d); a.ts = Date.now();
  deseosSincronizar(S); return a;
}
/* Ya no lo quiero: si su alcancía tiene plata, sigue como alcancía suelta; si está vacía, se borra */
function deseoSoltar(id, S, hoy) {
  const d = deseoPorId(id, S); if (!d || d.tengo || d.soltado) return null;
  const a = deseoAlc(d, S); let queda = null;
  if (a && !d.capricho) {
    if (alcGuardado(a) > 0) { a.deseo = ""; a.ts = Date.now(); queda = a; }
    else { const A = alcDatos(S); A.borradas.push(a.id); A.lista = A.lista.filter(x => x.id !== a.id); }
  }
  d.soltado = hoy || todayISO(); d.alc = d.capricho ? d.alc : ""; deseoTocar(d);
  deseosSincronizar(S); return { d, queda };
}
/* Lo compré: lo que pagaste, lo que sobró (a otra alcancía, si eliges) y, si quieres, al gasto del mes */
function deseoComprar(id, o, S, hoy) {
  const d = deseoPorId(id, S); if (!d || d.tengo || d.soltado) return null;
  hoy = hoy || todayISO();
  const pagado = Math.max(0, Math.round(+o.pagado || 0)), a = deseoAlc(d, S), r = { d, sobra: 0, ahorro: Math.max(0, (+d.precio || 0) - pagado), cerrar: null };
  if (a && d.capricho) {
    const sale = Math.min(pagado, Math.max(0, alcGuardado(a)));
    if (sale > 0) a.aportes.push({ id: alcNuevoId("ap"), monto: -sale, ts: Date.now(), fecha: hoy, o: "compra:" + d.id });
    a.ts = Date.now();
  } else if (a) {
    r.sobra = Math.max(0, alcGuardado(a) - pagado);
    if (r.sobra > 0 && o.destino && o.destino !== a.id) alcAportar(o.destino, r.sobra, "sobra:" + d.id, S, hoy);
    r.cerrar = a;
  }
  d.tengo = { pagado, fecha: hoy, gasto: !!o.gasto }; deseoTocar(d);
  if (o.gasto && pagado > 0) {
    const y = +hoy.slice(0, 4), m = +hoy.slice(5, 7) - 1, D = datosAnio(S, y, true);
    D.finanzas.meses[m].gasto = Math.max(0, (+D.finanzas.meses[m].gasto || 0) + pagado);
    if (!D.base && typeof tocarAnio === "function") tocarAnio(S, y, "finanzas");
  }
  deseosSincronizar(S); return r;
}
/* Si una alcancía de un deseo se borra o se cierra sin comprarlo, el deseo vuelve a esperar tu respuesta */
function deseosAlcSuelta(alcId, S) {
  deseosVivos(S).forEach(d => { if (d.alc === alcId && !d.tengo && !d.soltado) { d.alc = ""; d.capricho = false; deseoTocar(d); } });
  deseosSincronizar(S);
}

/* -------- Lo que se ve: Tus deseos, en Finanzas -------- */
let DESEOS_NUEVO = false;
function deseoFilaHtml(d) {
  const est = deseoEstado(d), id = escapeAttr(d.id), oc = typeof alcOculto === "function" && alcOculto();
  const precio = oc ? "" : `<span class="des__p">${fmtCLP(d.precio)}</span>`;
  const link = d.link ? `<a class="des__link" href="${escapeAttr(d.link)}" target="_blank" rel="noopener noreferrer">Ver en la tienda ↗</a>` : "";
  const cab = `<div class="des__t"><button type="button" class="des__n" data-action="des-editar" data-id="${id}">${escapeHtml(d.nombre)}</button>${precio}</div>`;
  const soltar = `<button type="button" class="btn-link des__soltar" data-action="des-soltar" data-id="${id}">Ya no lo quiero</button>`;
  if (est === "espera") {
    const total = deseoEspera(d), dias = deseoDias(d), queda = Math.max(1, total - dias), cu = deseoCuando(d.precio, null, true);
    return `<div class="des des--espera" data-des="${id}">${cab}
      <span class="des__est">Esperando · ${queda === 1 ? "queda 1 día" : `quedan ${queda} días`}</span>
      <div class="des__espera" aria-hidden="true"><i style="width:${Math.min(100, dias / total * 100).toFixed(0)}%"></i></div>
      <small class="des__info">${dias ? `Lo quieres hace ${dias === 1 ? "1 día" : dias + " días"}` : "Lo anotaste hoy"}${cu ? " · " + cu : ""}</small>
      <div class="des__btns"><button type="button" class="btn-link" data-action="des-saltar" data-id="${id}">Saltar la espera</button>${soltar}${link}</div></div>`;
  }
  if (est === "decidir") {
    const cu = deseoCuando(d.precio, null, true);
    return `<div class="des des--decidir" data-des="${id}">${cab}
      <span class="des__est des__est--decidir">${d.listo ? "Listo para decidir" : `Pasaron ${deseoEspera(d)} días`} · ¿todavía lo quieres?</span>
      ${cu ? `<small class="des__info">${cu}</small>` : ""}
      <div class="des__btns"><button type="button" class="btn btn--cian" data-action="des-ahorrar" data-id="${id}">Ahorrar para esto</button>
        <button type="button" class="btn btn--soft" data-action="des-capricho" data-id="${id}">A mis caprichos</button>${soltar}${link}</div></div>`;
  }
  if (est === "ahorro") {
    const a = deseoAlc(d);
    if (d.capricho) {
      const e = deseosEscalera(STATE).find(x => x.d.id === d.id) || { i: 0, alcanza: false, falta: d.precio };
      return `<div class="des des--ahorro" data-des="${id}">${cab}
        <span class="des__est des__est--ahorro">En tus caprichos · ${e.i + 1}º</span>
        <small class="des__info">${e.alcanza ? "¡Ya te alcanza!" : oc ? "Todavía no te alcanza" : `Te faltan ${fmtCLP(e.falta)}`}</small>
        <div class="des__btns"><button type="button" class="btn ${e.alcanza ? "btn--primary" : "btn--soft"}" data-action="des-comprar" data-id="${id}">Lo compré</button>${soltar}${link}</div></div>`;
    }
    const g = alcGuardado(a), p = Math.round(Math.min(1, g / Math.max(1, a.meta)) * 100), cu = deseoCuando(a.meta - g);
    return `<div class="des des--ahorro" data-des="${id}">${cab}
      <span class="des__est des__est--ahorro">Ahorrando · ${p}%</span>
      <div class="bar"><div class="bar__fill" style="width:${p}%"></div></div>
      <small class="des__info">${oc ? `${p}% de su alcancía` : `${fmtCLP(g)} de ${fmtCLP(a.meta)}`}${cu ? " · " + cu : ""}</small>
      <div class="des__btns"><button type="button" class="btn-link" data-action="des-ver-alc" data-id="${escapeAttr(a.id)}">Ir a su alcancía</button>
        <button type="button" class="btn ${g >= a.meta ? "btn--primary" : "btn--soft"}" data-action="des-comprar" data-id="${id}">Lo compré</button>${soltar}${link}</div></div>`;
  }
  return "";
}
function deseosHtml() {
  if (!STATE) return "";
  const xs = deseosVivos(), orden = { decidir: 0, espera: 1, ahorro: 2 };
  const vivos = xs.map(d => ({ d, e: deseoEstado(d) })).filter(x => orden[x.e] != null).sort((a, b) => orden[a.e] - orden[b.e] || (a.d.creado || "").localeCompare(b.d.creado || ""));
  const tengo = xs.filter(d => d.tengo).sort((a, b) => (b.tengo.fecha || "").localeCompare(a.tengo.fecha || ""));
  const soltados = xs.filter(d => d.soltado).sort((a, b) => b.soltado.localeCompare(a.soltado));
  const nogaste = deseosNoGastaste(STATE), oc = typeof alcOculto === "function" && alcOculto(), D = deseosDatos();
  const decidir = vivos.filter(x => x.e === "decidir").length;
  const form = `<form class="des-nuevo" id="des-nuevo" onsubmit="event.preventDefault();deseosAccion('des-anotar',{})" ${DESEOS_NUEVO ? "" : "hidden"}>
      <input class="input" id="des-nombre" maxlength="40" placeholder="¿Qué quieres?" aria-label="Qué quieres">
      <input class="input" id="des-precio" type="text" inputmode="numeric" placeholder="Precio" aria-label="Precio">
      <input class="input des-nuevo__link" id="des-link" type="text" inputmode="url" autocomplete="url" placeholder="Enlace de la tienda (opcional)" aria-label="Enlace de la tienda">
      <button type="submit" class="btn btn--cian">Anotar</button></form>`;
  return `<div class="card mt-24 des-sec" id="deseos">
    <div class="card__head"><div class="card__title">💎 Tus deseos${decidir ? ` <span class="chip chip--cian">${decidir} por decidir</span>` : ""}</div>
      <button type="button" class="btn-ghost" data-action="des-nuevo">${DESEOS_NUEVO ? "Cancelar" : "+ Nuevo deseo"}</button></div>
    ${form}
    ${nogaste ? `<div class="des-nogaste"><span>Lo que no gastaste este año</span><b>${oc ? "•••" : fmtCLP(nogaste)}</b></div>` : ""}
    ${vivos.length ? `<div class="des-lista">${vivos.map(x => deseoFilaHtml(x.d)).join("")}</div>`
      : `<p class="text-sm muted" style="margin:0">Anota lo que te gustaría comprarte. Después de unos días, Rumbo te pregunta si todavía lo quieres y, si sí, le arma su alcancía.</p>`}
    ${tengo.length ? `<details class="alc-cumplidas"><summary>Lo tienes (${tengo.length})</summary>${tengo.map(d => {
      const ah = (+d.precio || 0) - (+d.tengo.pagado || 0);
      return `<div class="alc-cumplida"><span><b>${escapeHtml(d.nombre)}</b><small>${oc ? "" : `Pagaste ${fmtCLP(d.tengo.pagado)}${ah > 0 ? ` · te ahorraste ${fmtCLP(ah)}` : ""} · `}${d.tengo.fecha ? alcFechaTxt(d.tengo.fecha) : "antes"}</small></span></div>`; }).join("")}</details>` : ""}
    ${soltados.length ? `<details class="alc-cumplidas"><summary>Soltados (${soltados.length})</summary>${soltados.map(d => `<div class="alc-cumplida"><span><b>${escapeHtml(d.nombre)}</b><small>${oc ? "" : fmtCLP(d.precio) + " · "}${alcFechaTxt(d.soltado)}</small></span>
        <button type="button" class="btn-link" data-action="des-volver" data-id="${escapeAttr(d.id)}">Lo quiero de nuevo</button></div>`).join("")}</details>` : ""}
    <p class="text-xs muted mt-16">${D.espera ? `Un deseo nuevo espera ${DESEO_ESPERA} días (${DESEO_ESPERA_CARO} si cuesta más de ${fmtCLP(DESEO_CARO)}) antes de pedir su alcancía. ` : "Sin espera: los deseos nuevos piden su alcancía al tiro. "}
      <button type="button" class="btn-link" data-action="des-espera">${D.espera ? "Quitar la espera" : "Volver a la espera"}</button></p>
  </div>`;
}
/* Los caprichos en orden, dentro de su alcancía */
function deseosEscaleraHtml(a) {
  const xs = deseosEscalera(STATE); if (!a || !a.caprichos) return "";
  if (!xs.length) return `<small class="text-xs muted">Suma deseos chicos desde Tus deseos con «A mis caprichos».</small>`;
  const oc = alcOculto();
  return `<ol class="des-escalera">${xs.map(x => `<li class="${x.alcanza ? "is-ok" : ""}"><i>${x.alcanza ? "✓" : x.i + 1}</i><span>${escapeHtml(x.d.nombre)}</span>${oc ? "" : `<small>${fmtCLP(x.d.precio)}</small>`}</li>`).join("")}</ol>`;
}
/* El cierre de mes te recuerda los deseos que esperan respuesta */
function deseosCierreHtml() {
  const xs = deseosVivos().filter(d => deseoEstado(d) === "decidir");
  if (!xs.length) return "";
  return `<div class="card mt-16 alc-reparto"><b>💎 ${xs.length === 1 ? "Un deseo espera" : xs.length + " deseos esperan"} tu respuesta</b>
    <p class="text-sm muted" style="margin:6px 0 0">${xs.slice(0, 4).map(d => escapeHtml(d.nombre)).join(", ")}${xs.length > 4 ? "…" : ""}. ¿Todavía los quieres? Respóndelo en Finanzas › Tus deseos.</p></div>`;
}

/* -------- Las hojas: editar y lo compré -------- */
function openDeseoEditar(id) {
  const d = deseoPorId(id); if (!d) return;
  const est = deseoEstado(d);
  openModal(d.nombre, `<div class="alc-hoja" id="des-hoja">
    <div class="field"><label for="des-e-nombre">¿Qué quieres?</label><input class="input" id="des-e-nombre" maxlength="40" value="${escapeAttr(d.nombre)}"></div>
    <div class="field"><label for="des-e-precio">Precio ($)</label><input class="input" id="des-e-precio" type="text" inputmode="numeric" value="${d.precio || ""}">
      ${est === "ahorro" && !d.capricho ? `<small class="text-xs muted">La meta de su alcancía cambia con el precio.</small>` : ""}</div>
    <div class="field"><label for="des-e-link">Enlace de la tienda (opcional)</label><input class="input" id="des-e-link" type="text" inputmode="url" autocomplete="url" value="${escapeAttr(d.link || "")}" placeholder="https://"></div>
    <button type="button" class="btn btn--primary btn-block" data-action="des-guardar" data-id="${escapeAttr(d.id)}">Guardar</button>
    <div class="alc-hoja__fin"><span class="text-xs muted">Lo anotaste ${d.creado ? "el " + alcFechaTxt(d.creado) : "antes"}.</span>
      <button type="button" class="btn-link alc-borrar" data-action="des-borrar" data-id="${escapeAttr(d.id)}">Borrar</button></div>
  </div>`);
}
function openDeseoComprar(id) {
  const d = deseoPorId(id); if (!d) return;
  const a = deseoAlc(d), g = a ? alcGuardado(a) : 0, otras = alcActivas().filter(x => !a || x.id !== a.id);
  const mes = MESES[new Date().getMonth()].toLowerCase();
  const sobra = a && !d.capricho ? Math.max(0, g - d.precio) : 0;
  openModal("Lo compré", `<div class="alc-hoja" id="des-comprar" data-id="${escapeAttr(d.id)}">
    <p class="text-sm muted" style="margin:0">${escapeHtml(d.nombre)}${a && !d.capricho ? ` · en su alcancía hay ${fmtCLP(g)}` : a ? " · sale de «Mis caprichos»" : ""}.</p>
    <div class="field"><label for="des-pagado">¿Cuánto pagaste?</label><input class="input" id="des-pagado" type="text" inputmode="numeric" value="${d.precio || ""}"
      oninput="deseoSobraTxt()"></div>
    <small class="text-xs muted" id="des-ahorro-txt"></small>
    ${a && !d.capricho ? `<div class="field" id="des-sobra-f" ${sobra ? "" : "hidden"}><label for="des-destino">Lo que sobró (<span id="des-sobra">${fmtCLP(sobra)}</span>) va a</label>
      <select class="input" id="des-destino"><option value="">Ninguna alcancía (queda fuera)</option>${otras.map(x => `<option value="${escapeAttr(x.id)}">${escapeHtml(x.nombre)}</option>`).join("")}</select></div>` : ""}
    <label class="agua-inicio"><input type="checkbox" id="des-gasto"> Sumarlo al gasto de ${mes} en Finanzas</label>
    <button type="button" class="btn btn--primary btn-block" data-action="des-comprar-ok" data-id="${escapeAttr(d.id)}">${a && !d.capricho && alcEstiloDe(alcEstiloVer(a)).rompe ? "Romper el chanchito y listo" : "Listo"}</button>
  </div>`);
  deseoSobraTxt();
}
function deseoSobraTxt() {
  const caja = document.getElementById("des-comprar"); if (!caja) return;
  const d = deseoPorId(caja.dataset.id); if (!d) return;
  const pagado = parseNum(val("des-pagado")), a = deseoAlc(d), ah = (+d.precio || 0) - pagado;
  const t = document.getElementById("des-ahorro-txt"); if (t) t.textContent = pagado && ah > 0 ? `Te ahorraste ${fmtCLP(ah)} sobre el precio que anotaste.` : "";
  if (a && !d.capricho) { const s = Math.max(0, alcGuardado(a) - pagado), f = document.getElementById("des-sobra-f"); if (f) { f.hidden = !s; document.getElementById("des-sobra").textContent = fmtCLP(s); } }
}
function deseosRefrescar() { saveState(); if (typeof rerender === "function") rerender(); }
function deseosAccion(a, d) {
  if (a === "des-nuevo") { DESEOS_NUEVO = !DESEOS_NUEVO; deseosRefrescar(); if (DESEOS_NUEVO) setTimeout(() => { const i = document.getElementById("des-nombre"); if (i) i.focus(); }, 30); return; }
  if (a === "des-anotar") {
    const nombre = val("des-nombre"), precio = parseNum(val("des-precio"));
    if (!nombre) { toast("Escribe qué quieres", true); return; }
    if (!(precio > 0)) { toast("Ponle un precio (aunque sea aproximado)", true); return; }
    const x = deseoNuevo({ nombre, precio, link: val("des-link") });
    DESEOS_NUEVO = false; deseosRefrescar();
    return toast(deseosDatos().espera ? `💎 Anotado: en ${deseoEspera(x)} días te pregunto si todavía lo quieres` : "💎 Anotado");
  }
  if (a === "des-saltar") { const x = deseoPorId(d.id); if (!x) return; x.listo = true; deseoTocar(x); return deseosRefrescar(); }
  if (a === "des-ahorrar" || a === "des-capricho") {
    const x = deseoPorId(d.id); if (x && !(x.precio > 0)) { toast("Primero ponle un precio", true); return openDeseoEditar(d.id); }
    const al = deseoAhorrar(d.id, a === "des-capricho"); if (!al) return;
    deseosRefrescar();
    toast(a === "des-capricho" ? "🐷 A tus caprichos: la alcancía marca cuál ya te alcanza" : `🐷 «${al.nombre}» ya tiene su alcancía`);
    return setTimeout(() => { const c = document.querySelector(`[data-alc-card="${CSS.escape(al.id)}"]`); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
  }
  if (a === "des-ver-alc") { const c = document.querySelector(`[data-alc-card="${CSS.escape(d.id)}"]`); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  if (a === "des-soltar") {
    const r = deseoSoltar(d.id); if (!r) return;
    if (r.queda) { alcRevisar(r.queda.id); }
    deseosRefrescar();
    return toast(r.queda ? `Soltado. Su alcancía sigue con ${fmtCLP(alcGuardado(r.queda))}: úsala para otra cosa o ciérrala` : `Soltado: ${fmtCLP(r.d.precio)} que no vas a gastar`);
  }
  if (a === "des-volver") { const x = deseoPorId(d.id); if (!x || !x.soltado) return; x.soltado = ""; x.listo = true; x.alc = ""; x.capricho = false; deseoTocar(x); return deseosRefrescar(); }
  if (a === "des-editar") return openDeseoEditar(d.id);
  if (a === "des-guardar") {
    const x = deseoPorId(d.id); if (!x) return;
    const nombre = val("des-e-nombre"), precio = parseNum(val("des-e-precio"));
    if (!nombre || !(precio > 0)) return toast("Ponle nombre y precio", true);
    x.nombre = nombre.slice(0, 40); x.precio = precio; x.link = deseoLinkLimpio(val("des-e-link")); deseoTocar(x);
    const al = deseoAlc(x); if (al && !x.capricho) { al.nombre = x.nombre; al.ts = Date.now(); }
    deseosSincronizar(); if (al) alcRevisar(al.id);
    closeModal(); deseosRefrescar(); return toast("Deseo guardado");
  }
  if (a === "des-borrar") {
    const x = deseoPorId(d.id); if (!x || !confirm(`¿Borrar «${x.nombre}»?${deseoAlc(x) && !x.capricho ? "\nSu alcancía sigue, sin el deseo." : ""}`)) return;
    const al = deseoAlc(x); if (al && !x.capricho) { al.deseo = ""; al.ts = Date.now(); }
    const D = deseosDatos(); D.borrados.push(x.id); D.lista = D.lista.filter(y => y.id !== x.id);
    deseosSincronizar(); closeModal(); deseosRefrescar(); return toast("Deseo borrado");
  }
  if (a === "des-comprar") return openDeseoComprar(d.id);
  if (a === "des-comprar-ok") {
    const x = deseoPorId(d.id); if (!x) return;
    const sel = document.getElementById("des-destino"), gasto = !!(document.getElementById("des-gasto") || {}).checked;
    const r = deseoComprar(d.id, { pagado: parseNum(val("des-pagado")), gasto, destino: sel ? sel.value : "" });
    if (!r) return;
    const msg = `🎉 ¡${x.nombre} es tuyo!${r.ahorro > 0 ? ` Te ahorraste ${fmtCLP(r.ahorro)}` : ""}`;
    closeModal();
    const fin = () => { if (r.cerrar) { r.cerrar.cerrada = Date.now(); r.cerrar.ts = r.cerrar.cerrada; } (deseosCaprichosAlc() ? [deseosCaprichosAlc().id] : []).forEach(alcRevisar); saveState(); if (typeof rerender === "function") rerender(); toast(msg); };
    saveState();
    if (r.cerrar && alcEstiloDe(alcEstiloVer(r.cerrar)).rompe && typeof ALC_MOTOR !== "undefined" && ALC_MOTOR.romper(r.cerrar.id)) {
      const c = document.querySelector(`[data-alc-card="${CSS.escape(r.cerrar.id)}"]`); if (c) { c.scrollIntoView({ behavior: "smooth", block: "center" }); c.querySelectorAll("button").forEach(b => { b.disabled = true; }); }
      vibrar([30, 30, 60]); setTimeout(fin, 2600);
    } else fin();
    return;
  }
  if (a === "des-ir") { if (typeof go === "function") go("finanzas"); return setTimeout(() => { const c = document.getElementById("deseos"); if (c) c.scrollIntoView({ block: "start" }); }, 80); }
  if (a === "des-espera") { const D = deseosDatos(); D.espera = !D.espera; D.ts = Date.now(); return deseosRefrescar(); }
}
