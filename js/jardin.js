/* ============================================================
   RUMBO · 🌱 El jardín de tus hábitos (Hábitos e Inicio)
   Macetas, raíces y cielo: el jardín premia la constancia, no la cantidad de hábitos.
   · Tres macetas al frente para los hábitos que estás formando. Si tienes más de tres sin raíces, eliges
     cuáles van en maceta (los demás siguen en Hábitos, sin planta). Cada planta crece con sus días cumplidos.
   · Un hábito echa raíces con 66 días cumplidos (como la medalla «Hábito de Hierro»): tu elefante lo
     trasplanta al patio como árbol y su maceta queda libre. Si lo dejas (en pausa o un tiempo sin
     marcarlo), el árbol queda sin hojas hasta que vuelves; nunca se pierde.
   · El cielo es tu constancia de la semana: lo que cumpliste de lo que tocaba desde el lunes. Al partir
     la semana pesa también la anterior, así un mal lunes no apaga el sol. Nada se seca.
   · Cuando marcas un hábito que está en maceta, tu elefante la riega (jardinAlMarcar → JARDIN_MOTOR).
   La entrada viene con Rumbo; la ventana, el terrario, en píxeles y el sur, en la Tienda (gamif.equipped.jardin).
   Temas especiales (1.200 ⭐ cada uno): Marte y la base lunar, con tu elefante de visor negro y Menta, el alienígena.
   Datos: STATE.jardin = { macetas: [ids que elegiste], inicio (en Inicio), raices: { id: "YYYY-MM-DD" }, ts }.
   raices guarda el día en que se celebró cada trasplante (para no celebrarlo dos veces).
   ============================================================ */
const JARDIN_RAICES = 66, JARDIN_MACETAS = 3;
const JARDIN_ESTILOS = [
  { id: "entrada", nombre: "La entrada", cos: null, w: 320, h: 220, desc: "el jardín frente a la casa de tu elefante, que se asoma por la ventana" },
  { id: "ventana", nombre: "La ventana", cos: "jar-ventana", w: 320, h: 240, desc: "desde adentro de Tu casa: las macetas en la ventana y los árboles afuera" },
  { id: "terrario", nombre: "El terrario", cos: "jar-terrario", w: 320, h: 240, desc: "en tu escritorio: los hábitos que echaron raíces pasan al frasco" },
  { id: "pixeles", nombre: "En píxeles", cos: "jar-pixeles", w: 320, h: 240, desc: "un jardín de videojuego antiguo, con tu elefante y un marcador" },
  { id: "sur", nombre: "El sur", cos: "jar-sur", w: 480, h: 200, desc: "un lago con su volcán, araucarias y las macetas en el muelle" },
  // Temas especiales (1.200 ⭐): tu elefante con casco y visor de cristal negro, y Menta, el alienígena
  { id: "marte", nombre: "Marte", cos: "jar-marte", w: 480, h: 260, especial: true, desc: "una colonia en Marte: tus raíces vuelven verde la arena y Menta se pasea entre tus cúpulas" },
  { id: "luna", nombre: "La base lunar", cos: "jar-luna", w: 480, h: 260, especial: true, desc: "una base en la Luna con la Tierra de fondo: cada hábito con raíces enciende un continente" },
];
const JARDIN_FLORES = ["#F28CB0", "#FFD24A", "#9AA6FF", "#FF8A5B", "#C49BF5", "#5CC8E8", "#FF6B8A"];

/* -------- Los datos -------- */
function jardinDatos(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  if (!S) return { macetas: [], inicio: true, raices: {}, ts: 0 };
  const j = S.jardin;
  if (!j || typeof j !== "object") S.jardin = { macetas: [], inicio: true, raices: {}, ts: 0 };
  if (!Array.isArray(S.jardin.macetas)) S.jardin.macetas = [];
  if (!S.jardin.raices || typeof S.jardin.raices !== "object") S.jardin.raices = {};
  return S.jardin;
}
function jardinEstiloDe(id) { return JARDIN_ESTILOS.find(x => x.id === id) || JARDIN_ESTILOS[0]; }
function jardinEstiloTuyo(id) { const e = JARDIN_ESTILOS.find(x => x.id === id); return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos))); }
function jardinEstilo(S) {
  S = S || (typeof STATE !== "undefined" ? STATE : null);
  const eq = (S && S.gamif && S.gamif.equipped) || {};
  return eq.jardin && jardinEstiloTuyo(eq.jardin) ? eq.jardin : "entrada";
}
/* Los días cumplidos de cada hábito y la última vez que lo marcaste (de una pasada por el registro) */
function jardinConteo(S) {
  S = S || STATE;
  const out = {}, log = (S.habitos && S.habitos.log) || {};
  Object.entries(log).forEach(([mk, mes]) => {
    const [y, m] = mk.split("-").map(Number); if (!y || !m) return;
    Object.entries(mes || {}).forEach(([hid, dias]) => {
      const o = out[hid] || (out[hid] = { dias: 0, ultimo: "" });
      Object.entries(dias || {}).forEach(([d, v]) => { if (!v) return; o.dias++; const iso = `${y}-${String(m).padStart(2, "0")}-${String(+d).padStart(2, "0")}`; if (iso > o.ultimo) o.ultimo = iso; });
    });
  });
  return out;
}
function jardinDiasDe(hid, S) { return (jardinConteo(S)[hid] || { dias: 0 }).dias; }
/* ¿Lo dejaste? En pausa, o sin marcarlo más de lo que su frecuencia aguanta: el árbol queda sin hojas */
function jardinDejado(h, info, hoy) {
  if (!h || h.pausado) return true;
  const f = hmFreq(h), tope = f.tipo === "mensual" ? 62 : f.tipo === "semanal" ? 28 : 21;
  return !info || !info.ultimo || hmDiff(info.ultimo, hoy) > tope;
}
function jardinColor(id) { let n = 0; String(id || "").split("").forEach(ch => { n = (n * 31 + ch.charCodeAt(0)) >>> 0; }); return JARDIN_FLORES[n % JARDIN_FLORES.length]; }
/* Cómo crece la planta de una maceta: 0 (semilla) → 1 (a punto de echar raíces); florece al acercarse */
function jardinCrecer(dias) { return 0.08 + 0.92 * Math.min(1, Math.max(0, dias) / JARDIN_RAICES); }

/* El cielo: constancia de la semana (desde el lunes; hoy cuenta solo si ya lo hiciste).
   Los de X por semana cuentan lo que ya debía llevar a esta altura; los mensuales y en pausa no entran.
   Al partir la semana, la anterior pesa como 3 marcas: un mal lunes no apaga el sol. */
function jardinCielo(S, hoyIso) {
  S = S || STATE;
  const hoy = hoyIso || hmHoy(), lunes = hmLunes(hoy), PESO = 3;
  const defs = (S.habitos.defs || []).filter(h => hmActivo(h) && hmFreq(h).tipo !== "mensual" && hmCreado(h) <= hoy);
  let esp = 0, hecho = 0;
  defs.forEach(h => {
    const f = hmFreq(h), desde = hmMax(lunes, hmCreado(h));
    if (f.tipo === "semanal") {
      const n = Math.min(f.veces, hmContar(h, desde, hoy, S)), debe = Math.floor(f.veces * hmDow(hoy) / 7);
      hecho += n; esp += Math.max(n, debe);
      return;
    }
    for (let d = desde; d <= hoy; d = hmAdd(d, 1)) {
      if (!hmProgramado(h, d, S)) continue;
      const ok = hmDone(h, d, S); if (d === hoy && !ok) continue;
      esp++; if (ok) hecho++;
    }
  });
  const ant = cumplimientoGrupo(defs, hmAdd(lunes, -7), hmAdd(lunes, -1), S);
  const previo = ant.pct != null ? ant.pct / 100 : 0.7;
  const c = defs.length ? (hecho + previo * PESO) / (esp + PESO) : 0.7;
  return { c: Math.max(0, Math.min(1, c)), pct: esp ? Math.round(hecho / esp * 100) : null, esp, hecho };
}
function jardinCieloTxt(c) { return c >= 0.8 ? "sol y mariposas" : c >= 0.6 ? "sol entre nubes" : c >= 0.4 ? "nublado" : "muy nublado"; }

/* Todo lo que se dibuja: { macetas: [{ id, nombre, icon, dias, t, color }], arboles: [{ id, nombre, hojas, color }],
   formando: [los que podrían ir en maceta], sinMaceta, elegir (hay que elegir macetas), c, pct } */
function jardinEscena(S, hoyIso) {
  S = S || STATE;
  const hoy = hoyIso || hmHoy(), j = jardinDatos(S), cuenta = jardinConteo(S), defs = S.habitos.defs || [];
  const diasDe = h => (cuenta[h.id] || { dias: 0 }).dias;
  const arboles = defs.filter(h => diasDe(h) >= JARDIN_RAICES).map(h => ({ id: h.id, nombre: h.nombre, icon: h.icon, hojas: !jardinDejado(h, cuenta[h.id], hoy), color: jardinColor(h.id) }));
  const formando = defs.filter(h => hmActivo(h) && diasDe(h) < JARDIN_RAICES);
  const tuyas = j.macetas.map(id => formando.find(h => h.id === id)).filter(Boolean).slice(0, JARDIN_MACETAS);
  // Las que elegiste van primero y en su lugar (las plantas no saltan de maceta); si falta alguna (no elegiste
  // o una echó raíces), se completa: con pocos hábitos, en su orden; con más de tres, con las más avanzadas
  let resto = formando.filter(h => !tuyas.includes(h));
  if (formando.length > JARDIN_MACETAS) resto = resto.sort((a, b) => diasDe(b) - diasDe(a) || hmCreado(a).localeCompare(hmCreado(b)));
  const enMaceta = tuyas.concat(resto).slice(0, JARDIN_MACETAS);
  const cielo = jardinCielo(S, hoy);
  return {
    macetas: enMaceta.map(h => ({ id: h.id, nombre: h.nombre, icon: h.icon, dias: diasDe(h), t: jardinCrecer(diasDe(h)), color: jardinColor(h.id) })),
    arboles, formando: formando.map(h => ({ id: h.id, nombre: h.nombre, icon: h.icon, dias: diasDe(h) })),
    sinMaceta: Math.max(0, formando.length - JARDIN_MACETAS), elegir: formando.length > JARDIN_MACETAS && tuyas.length < JARDIN_MACETAS,
    c: cielo.c, pct: cielo.pct,
  };
}
/* Para la Tienda: un jardín de muestra (tres macetas a distinta altura, tres árboles y sol) */
function jardinMuestra() {
  return { macetas: [{ id: "m1", t: 0.9, color: JARDIN_FLORES[0] }, { id: "m2", t: 0.58, color: JARDIN_FLORES[1] }, { id: "m3", t: 0.3, color: JARDIN_FLORES[2] }],
    arboles: [{ id: "a1", hojas: true, color: JARDIN_FLORES[3] }, { id: "a2", hojas: true, color: JARDIN_FLORES[4] }, { id: "a3", hojas: true, color: JARDIN_FLORES[5] }], c: 0.92 };
}
/* El color de tu elefante (el tipo que elegiste) para asomarse por la ventana o regar en píxeles */
function jardinPiel(S) {
  const P = { clasico: ["#9FB2C8", "#7C91AB"], asiatico: ["#A9A39C", "#86807A"], mamut: ["#8B5C3E", "#6A432B"], peluche: ["#B8C7DA", "#95A8C0"], geometrico: ["#7FA8CF", "#5C86B0"], tinta: ["#E8E4DA", "#9AA0AE"] };
  let t = "clasico"; try { if (typeof tipoElefante === "function") t = tipoElefante(S); } catch (e) {}
  return P[t] || P.clasico;
}
function jardinLecturaTxt(e) {
  const m = e.macetas.length, r = e.arboles.length;
  const partes = [];
  partes.push(m ? `${m} en maceta` : "sin macetas");
  if (e.sinMaceta) partes.push(`${e.sinMaceta} sin maceta`);
  partes.push(r ? `${r} ${r === 1 ? "árbol" : "árboles"}` : "aún sin árboles");
  return partes.join(" · ") + ` · cielo: ${jardinCieloTxt(e.c)}${e.pct != null ? ` (${e.pct} % esta semana)` : ""}`;
}

/* -------- Al marcar un hábito: el elefante riega y, si llegó a 66 días, lo trasplanta -------- */
function jardinAlMarcar(hid, marcado) {
  if (!marcado || typeof STATE === "undefined") return;
  const h = (STATE.habitos.defs || []).find(x => x.id === hid); if (!h) return;
  const j = jardinDatos(), dias = jardinDiasDe(hid);
  if (dias >= JARDIN_RAICES && !j.raices[hid]) {
    j.raices[hid] = todayISO(); j.ts = Date.now();
    if (typeof JARDIN_MOTOR !== "undefined") JARDIN_MOTOR.trasplantar(hid);
    setTimeout(() => jardinCelebrar(h), 900);
    return;
  }
  if (dias < JARDIN_RAICES && typeof JARDIN_MOTOR !== "undefined") JARDIN_MOTOR.regar(hid);
}
function jardinCelebrar(h) {
  if (typeof openModal !== "function") return toast(`🌳 «${h.nombre}» echó raíces`);
  vibrar([20, 40, 20, 40, 60]);
  openModal("🌳 Echó raíces", `<div class="jar-raices">
    <canvas class="jar-cv" data-jardin="${escapeAttr(jardinEstilo())}" data-vivo="1" style="aspect-ratio:${jardinEstiloDe(jardinEstilo()).w}/${jardinEstiloDe(jardinEstilo()).h}" role="img" aria-label="Tu jardín, con el árbol nuevo"></canvas>
    <p><b>«${escapeHtml(h.nombre)}»</b> cumplió ${JARDIN_RAICES} días. Tu elefante lo trasplantó al patio: ahora es un árbol, y su maceta quedó libre para un hábito nuevo.</p>
    <p class="text-sm muted">El árbol se queda aunque un día lo dejes: solo pierde las hojas hasta que vuelves.</p>
    <button type="button" class="btn btn--primary btn-block" data-action="jar-cerrar">¡Qué bien!</button>
  </div>`);
}

/* -------- La tarjeta (Hábitos) y el jardín de Inicio -------- */
function jardinCanvasHtml(clase, extra) {
  const est = jardinEstiloDe(jardinEstilo());
  return `<canvas class="${clase || "jar-cv"}" data-jardin="${est.id}" style="aspect-ratio:${est.w}/${est.h}" role="img" aria-label="Tu jardín: ${escapeAttr(jardinLecturaTxt(jardinEscena()))}" ${extra || ""}></canvas>`;
}
function jardinCardHtml() {
  if (!(STATE.habitos.defs || []).length) return "";
  const e = jardinEscena();
  return `<div class="card jar-card">
    <div class="card__head"><div class="card__title">🌱 Tu jardín</div><button type="button" class="card__hint btn-link" data-action="jar-abrir">Ver →</button></div>
    <button type="button" class="jar-lienzo" data-action="jar-abrir" aria-label="Abrir tu jardín">${jardinCanvasHtml()}</button>
    <p class="jar-lectura">${escapeHtml(jardinLecturaTxt(e))}</p>
    ${e.elegir ? `<div class="jar-aviso"><span>Tienes ${e.formando.length} hábitos formándose: elige los ${JARDIN_MACETAS} que van en maceta.</span><button type="button" class="btn btn--soft" data-action="jar-macetas">Elegir</button></div>` : ""}
  </div>`;
}
function jardinInicioHtml() {
  if (!(STATE.habitos.defs || []).length || jardinDatos().inicio === false) return "";
  return `<button type="button" class="jar-lienzo jar-lienzo--inicio" data-action="jar-abrir" aria-label="Abrir tu jardín">${jardinCanvasHtml()}</button>`;
}

/* -------- La hoja del jardín: macetas, árboles, cielo, estilo -------- */
function jardinHojaHtml() {
  const e = jardinEscena(), j = jardinDatos(), est = jardinEstilo();
  const maceta = m => { const falta = Math.max(0, JARDIN_RAICES - m.dias);
    return `<div class="jar-item"><span class="hab-ico">${typeof icoHab === "function" ? icoHab(m.icon, 18) : ""}</span>
      <div class="jar-item__main"><b>${escapeHtml(m.nombre)}</b><span class="text-xs muted">${m.dias} de ${JARDIN_RAICES} días · ${falta === 1 ? "falta 1 para echar raíces" : `faltan ${falta} para echar raíces`}</span>
      <span class="jar-barra" aria-hidden="true"><i style="width:${Math.round(Math.min(1, m.dias / JARDIN_RAICES) * 100)}%;background:${m.color}"></i></span></div></div>`; };
  const arbol = a => `<div class="jar-item"><span class="hab-ico">${typeof icoHab === "function" ? icoHab(a.icon, 18) : ""}</span>
      <div class="jar-item__main"><b>${escapeHtml(a.nombre)}</b><span class="text-xs muted">${a.hojas ? "Echó raíces 🌳" : "Sin hojas por ahora: vuelve a hacerlo y reverdece"}</span></div></div>`;
  const estilos = JARDIN_ESTILOS.filter(x => jardinEstiloTuyo(x.id));
  return `<div class="jar-hoja">
    ${jardinCanvasHtml("jar-cv", 'data-vivo="1"')}
    <p class="jar-lectura">Esta semana: <b>${jardinCieloTxt(e.c)}</b>${e.pct != null ? ` · cumpliste el ${e.pct} % de lo que tocaba` : ""}.</p>
    <div class="agua-sec"><div class="flex-between"><span class="cj-sub">En maceta · los que estás formando</span>${e.formando.length > JARDIN_MACETAS ? `<button type="button" class="btn-link" data-action="jar-macetas">Cambiar</button>` : ""}</div>
      ${e.macetas.length ? e.macetas.map(maceta).join("") : `<p class="text-sm muted" style="margin:0">Todos tus hábitos echaron raíces. Crea uno nuevo y tendrá su maceta.</p>`}
      ${e.sinMaceta ? `<p class="text-xs muted" style="margin:6px 0 0">${e.sinMaceta} ${e.sinMaceta === 1 ? "hábito sigue" : "hábitos siguen"} en Hábitos sin maceta: el jardín crece con la constancia, no con la cantidad.</p>` : ""}</div>
    <div class="agua-sec"><span class="cj-sub">En el patio · los que echaron raíces</span>
      ${e.arboles.length ? e.arboles.map(arbol).join("") : `<p class="text-sm muted" style="margin:0">Cuando un hábito cumpla ${JARDIN_RAICES} días, tu elefante lo trasplanta aquí como árbol.</p>`}</div>
    <div class="agua-sec"><span class="cj-sub">Estilo</span>
      <div class="jar-estilos">${estilos.map(x => `<button type="button" class="chip${x.id === est ? " is-on" : ""}" data-action="jar-estilo" data-v="${x.id}" aria-pressed="${x.id === est}">${escapeHtml(x.nombre)}</button>`).join("")}
        ${estilos.length < JARDIN_ESTILOS.length ? `<button type="button" class="chip" data-action="jar-tienda">＋ Más estilos en la Tienda</button>` : ""}</div></div>
    <label class="jar-check"><input type="checkbox" id="jar-inicio" data-action="jar-inicio" ${j.inicio !== false ? "checked" : ""}> Mostrarlo en Inicio, sobre tus hábitos de hoy</label>
    <details class="jar-como"><summary>Cómo funciona</summary>
      <ul><li><b>${JARDIN_MACETAS} macetas</b> para los hábitos que estás formando. Si tienes más, eliges cuáles; los demás siguen en Hábitos.</li>
      <li>Cada planta crece con sus días cumplidos y florece cerca de los ${JARDIN_RAICES}. Ahí <b>echa raíces</b>: pasa al patio como árbol y libera su maceta.</li>
      <li><b>El cielo</b> es tu constancia de la semana: da lo mismo cuántos hábitos tengas.</li>
      <li><b>Nada se seca.</b> Si dejas un hábito con raíces, su árbol pierde las hojas hasta que vuelves.</li></ul></details>
  </div>`;
}
function openJardin() { openModal("🌱 Tu jardín", jardinHojaHtml(), { ancho: true }); }

/* -------- Elegir las macetas -------- */
function jardinMacetasHtml() {
  const e = jardinEscena(), sel = new Set(e.macetas.map(m => m.id));
  return `<div class="jar-hoja" id="jar-elegir">
    <p class="text-sm muted" style="margin:0">Elige hasta ${JARDIN_MACETAS} hábitos para formar ahora. Los demás siguen en Hábitos como siempre; la planta guarda lo que creció si la cambias.</p>
    <div class="jar-opciones">${e.formando.map(h => `<label class="jar-opcion"><input type="checkbox" value="${escapeAttr(h.id)}" ${sel.has(h.id) ? "checked" : ""} data-action="jar-marca">
      <span class="hab-ico">${typeof icoHab === "function" ? icoHab(h.icon, 18) : ""}</span><span class="jar-opcion__n">${escapeHtml(h.nombre)}</span><span class="text-xs muted">${h.dias} de ${JARDIN_RAICES} días</span></label>`).join("")}</div>
    <button type="button" class="btn btn--primary btn-block" data-action="jar-macetas-ok">Guardar mis macetas</button>
  </div>`;
}
function openJardinMacetas() { openModal("Tus macetas", jardinMacetasHtml()); }
function jardinElegidas() { return Array.from(document.querySelectorAll("#jar-elegir input[type=checkbox]:checked")).map(i => i.value); }
function jardinGuardarMacetas(ids, S) {
  const j = jardinDatos(S), validos = new Set(jardinEscena(S).formando.map(h => h.id));
  j.macetas = (ids || []).filter(id => validos.has(id)).slice(0, JARDIN_MACETAS); j.ts = Date.now();
}

/* -------- Acciones (jar-*) -------- */
function jardinAccion(a, d, el) {
  if (a === "jar-abrir") return openJardin();
  if (a === "jar-cerrar") return closeModal();
  if (a === "jar-macetas") return openJardinMacetas();
  if (a === "jar-marca") {
    const marcadas = jardinElegidas();
    if (marcadas.length > JARDIN_MACETAS && el) { el.checked = false; toast(`Son ${JARDIN_MACETAS} macetas: desmarca una para cambiarla`, true); }
    return;
  }
  if (a === "jar-macetas-ok") {
    const ids = jardinElegidas(); if (!ids.length) return toast("Elige al menos un hábito para tus macetas", true);
    jardinGuardarMacetas(ids); saveState(); closeModal(); rerender(); return toast("🌱 Listo: esas son tus macetas");
  }
  if (a === "jar-estilo") {
    if (!jardinEstiloTuyo(d.v)) return;
    const eq = typeof eqCos === "function" ? eqCos() : (STATE.gamif.equipped = STATE.gamif.equipped || {});
    eq.jardin = d.v === "entrada" ? null : d.v; saveState(); rerender(); return openJardin();
  }
  if (a === "jar-inicio") { const j = jardinDatos(); j.inicio = !!(el && el.checked); j.ts = Date.now(); saveState(); rerender(); return; }
  if (a === "jar-tienda") { closeModal(); if (typeof TIENDA_SEC !== "undefined") TIENDA_SEC = "estilo"; return go("recompensas"); }
}

/* -------- La Tienda: miniatura de la ficha y muestra grande en el detalle -------- */
function jardinFichaHtml(it) { const e = jardinEstiloDe(it.value); return `<canvas class="jar-ficha" data-jardin="${escapeAttr(it.value)}" data-modo="muestra" style="aspect-ratio:${e.w}/${e.h}" aria-hidden="true"></canvas>`; }
function jardinMuestraHtml(it) { const e = jardinEstiloDe(it.value); return `<canvas class="jar-cv" data-jardin="${escapeAttr(it.value)}" data-modo="muestra" data-vivo="1" style="aspect-ratio:${e.w}/${e.h}" aria-hidden="true"></canvas>`; }
