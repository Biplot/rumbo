/* ============================================================
   RUMBO · 🌵 Dejar y reducir hábitos (Hábitos, Inicio, el cierre del día y el jardín)
   Hoy Rumbo mide lo que haces; para dejar algo hay que medir lo que no haces. Al crear un hábito
   eliges: Hacerlo (de siempre), Dejarlo o Reducirlo.
   · Dejar: cuenta los días sin. Tú solo avisas si caes. Con un toque confirmas el día (en Hábitos,
     Inicio o al cerrar el día) y ganas tus ⭐ (+5, como marcar). El día sin confirmar cuenta como limpio,
     pero sus ⭐ esperan. Una caída devuelve la racha a 0; no borra el mes, la mejor racha ni el cactus.
     «¿Desde cuándo?»: puedes partir con los días que ya llevas.
   · Reducir: un límite por día o por semana («Café: máximo 2 al día»). Cada vez, un toque (+1); el día
     es verde mientras no pases el límite.
   · Antojos superados: el antojo que te ganaste, con qué lo gatilló, +1 ⭐ (hasta 5 al día por hábito);
     tu plan para el antojo y, con el tiempo, tu patrón (cuándo y por qué llegan).
   · Lo que te ahorras: si le pones cuánto te costaba al día, suma lo que no gastaste y, con un toque,
     pasa a una alcancía.
   · Nombre discreto en Inicio; tus amigos no ven tus hábitos. En el jardín, un cactus (cierra su flor
     el día que caes). Medallas: Hábito de Hierro a los 66 días y «Libre» a los 100 días sin.
   Las reglas viven en habitos-motor.js (hmMeta, hmDone, hmCaida, hmCuenta). Datos: habitos.caidas,
   habitos.cuentas y habitos.antojos (listas que se reemplazan al cambiar; se fusionan por id).
   ============================================================ */
const DJ_GATILLOS = ["Estrés", "Aburrimiento", "Después de comer", "Con amigos", "Un café", "Al despertar", "De noche", "Otro"];
const DJ_ANTOJOS_DIA = 5;   // ⭐ por antojos superados, a lo más, por día y hábito
const DJ_MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DJ_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function djDef(id) { return (STATE.habitos.defs || []).find(h => h.id === id) || null; }
function djNombre(h, enInicio) { return enInicio && h.discreto ? h.discreto : h.nombre; }
function djDiaTxt(iso) { const d = new Date(iso + "T12:00:00"); return `el ${DJ_DIAS[(d.getDay() + 6) % 7]} ${d.getDate()}`; }
function djPlural(n, uno, varios) { return `${n} ${n === 1 ? uno : varios}`; }
/* «12 días sin fumar» si el nombre es «Dejar de fumar»; si no, «12 días sin caer» */
function djSinTxt(h, n) {
  const m = String(h.nombre || "").match(/^dejar (de |el |la |los |las )?(.+)$/i);
  return `${n === 1 ? "día" : "días"} sin ${m ? m[2].toLowerCase() : "caer"}`;
}

/* -------- Los datos (las listas se reemplazan: el motor las usa de caché) -------- */
function djCaidaPoner(h, iso, on, S) {
  S = S || STATE;
  const id = "c:" + h.id + ":" + iso, x = { id, hid: h.id, fecha: iso, ts: Date.now() };
  if (!on) x.quitado = true;
  S.habitos.caidas = (S.habitos.caidas || []).filter(c => c && c.id !== id).concat([x]);
}
function djCuentaPoner(h, iso, n, S) {
  S = S || STATE;
  const id = "n:" + h.id + ":" + iso;
  S.habitos.cuentas = (S.habitos.cuentas || []).filter(c => c && c.id !== id).concat([{ id, hid: h.id, fecha: iso, n: Math.max(0, Math.min(999, Math.round(n) || 0)), ts: Date.now() }]);
}
function djAntojos(h, desde, S) { return ((S || STATE).habitos.antojos || []).filter(a => a && a.hid === h.id && (!desde || a.fecha >= desde)); }
function djAntojoAgregar(h, gatillo, S) {
  S = S || STATE;
  const ahora = new Date(), hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const a = { id: "a" + uid(), hid: h.id, fecha: hmHoy(), hora, gatillo: String(gatillo || "").slice(0, 30), ts: Date.now() };
  S.habitos.antojos = (S.habitos.antojos || []).concat([a]);
  return a;
}
/* Lo que más se repite en los últimos 30 días: el gatillo y la franja horaria */
function djPatron(h, S) {
  const xs = djAntojos(h, hmAdd(hmHoy(), -30), S); if (xs.length < 3) return null;
  const cuenta = k => xs.reduce((m, a) => { const v = k(a); if (v) m[v] = (m[v] || 0) + 1; return m; }, {});
  const top = m => Object.entries(m).sort((a, b) => b[1] - a[1])[0];
  const g = top(cuenta(a => a.gatillo)), f = top(cuenta(a => { const hh = parseInt(a.hora, 10); return isNaN(hh) ? "" : hh < 12 ? "en la mañana" : hh < 15 ? "a mediodía" : hh < 20 ? "en la tarde" : "de noche"; }));
  return { gatillo: g ? g[0] : "", franja: f ? f[0] : "" };
}
/* Lo que te ahorras: días limpios × lo que te costaba; lo ya pasado a alcancías se descuenta */
function djAhorro(h, S) {
  const costo = Math.max(0, +h.costo || 0); if (!costo) return null;
  const total = hmDiasCumplidos(h, S).dias * costo, pasado = Math.max(0, +h.ahorroPasado || 0);
  return { total, pasado, disponible: Math.max(0, total - pasado) };
}
/* Días limpios (o dentro del límite) en los últimos n días que ya terminaron, más hoy si ya cumple */
function djLimpios(h, n, S) {
  const hoy = hmHoy(); let ok = 0, tot = 0;
  for (let i = n - 1; i >= 0; i--) { const d = hmAdd(hoy, -i); if (d < hmCreado(h)) continue; if (d === hoy && !hmDone(h, d, S)) continue; tot++; if (hmDone(h, d, S)) ok++; }
  return { ok, tot };
}

/* -------- Las reglas de la interfaz -------- */
/* Un día con caída no se confirma (no da ⭐): toggleHabitDate lo pregunta antes de marcar */
function djBloqueaMarca(hid, iso) {
  const h = djDef(hid); if (!h || hmMeta(h) === "hacer") return false;
  if (hmMeta(h) === "reducir") { toast("En los de límite no se marca: suma con +1 cada vez.", true); return true; }
  if (hmCaida(h, iso) && !hmMarcado(h, iso, STATE)) { toast("Ese día marcaste una caída. Deshazla si fue un error.", true); return true; }
  return false;
}
function djConfirmar(h, iso) {
  if (hmCaida(h, iso) || hmMarcado(h, iso, STATE)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  toggleHabitDate(h.id, y, m - 1, d);
  return true;
}
function djCaer(h, iso) {
  if (hmMarcado(h, iso, STATE)) { const [y, m, d] = iso.split("-").map(Number); toggleHabitDate(h.id, y, m - 1, d); }   // la confirmación de ese día se deshace
  djCaidaPoner(h, iso, true);
  saveState();
}

/* -------- Hábitos › Hoy: la tarjeta -------- */
function djCardHtml(h) {
  const hoy = hmHoy(), r = rachaPeriodos(h).n;
  if (hmMeta(h) === "reducir") {
    const l = hmLimite(h), p = progresoPeriodoActual(h), n = hmCuenta(h, hoy);
    return `<div class="card hb-today hb-lim ${p.sePaso ? "is-pasado" : ""}" data-id="${h.id}">
      <div class="hb-today__ico">${icoHab(h.icon, 28)}</div><div class="hb-today__name">${escapeHtml(h.nombre)}</div>
      <div class="hb-lim__cont"><button type="button" class="hb-lim__b" data-action="rd-menos" data-id="${h.id}" aria-label="Uno menos" ${n ? "" : "disabled"}>−</button>
        <b>${p.hecho}</b><button type="button" class="hb-lim__b" data-action="rd-mas" data-id="${h.id}" aria-label="Uno más${h.unidad ? ": " + escapeAttr(h.unidad) : ""}">+</button></div>
      <div class="hb-today__prog">de ${l.n}${h.unidad ? " " + escapeHtml(h.unidad) : ""} ${l.per === "semana" ? "esta semana" : "hoy"}${p.sePaso ? ` · te pasaste por ${p.hecho - l.n}` : ""}${r ? ` · 🔥 ${r} ${l.per === "semana" ? (r === 1 ? "semana" : "semanas") : (r === 1 ? "día" : "días")}` : ""}</div>
      <button class="hb-today__edit icon-btn" data-action="habit-edit" data-id="${h.id}" title="Editar hábito" aria-label="Editar">✎</button></div>`;
  }
  const p = progresoPeriodoActual(h), ok = p.cumplido;
  return `<div class="card hb-today hb-dejar ${ok ? "is-on" : ""} ${p.caida ? "is-caida" : ""}" data-action="${p.caida ? "dj-ver" : "habit-today"}" data-id="${h.id}" role="button" tabindex="0">
      <div class="hb-today__ico">${icoHab(h.icon, 28)}</div><div class="hb-today__name">${escapeHtml(h.nombre)}</div>
      <div class="hb-dejar__n"><b>${r}</b> ${djSinTxt(h, r)}</div>
      <div class="hb-today__prog">${p.caida ? "Caíste hoy: mañana parte otra racha" : ok ? "Confirmado hoy · +5 ⭐" : "Tócalo para confirmar hoy"}</div>
      <div class="hb-dejar__acc">${p.caida ? `<button type="button" class="chip" data-action="dj-caida-quitar" data-id="${h.id}">Deshacer la caída</button>`
        : `<button type="button" class="chip chip--oro" data-action="dj-antojo" data-id="${h.id}">${icoUI("zap")} Antojo superado</button><button type="button" class="chip" data-action="dj-caida" data-id="${h.id}">Caí</button>`}
        <button type="button" class="chip" data-action="dj-ver" data-id="${h.id}">Ver</button></div>
      <div class="hb-today__check">${ok ? "✓" : ""}</div>
      <button class="hb-today__edit icon-btn" data-action="habit-edit" data-id="${h.id}" title="Editar hábito" aria-label="Editar">✎</button></div>`;
}
/* Inicio: el botón del hábito (nombre discreto si lo pusiste) */
function djChipHtml(h) {
  if (hmMeta(h) === "reducir") {
    const p = progresoPeriodoActual(h), l = hmLimite(h);
    return `<button class="hab-chip hab-chip--lim${p.sePaso ? " is-pasado" : ""}" data-action="rd-mas" data-id="${h.id}" title="${escapeAttr(h.nombre + ": un toque suma uno")}">
      <span class="hab-chip__i">${icoHab(h.icon, 20)}</span><span class="hab-chip__n">${escapeHtml(djNombre(h, true))} <small>${p.hecho}/${l.n}</small></span></button>`;
  }
  const p = progresoPeriodoActual(h), r = rachaPeriodos(h).n;
  return `<button class="hab-chip${p.cumplido ? " is-on" : ""}" data-action="quick-habit" data-id="${h.id}" aria-pressed="${p.cumplido}" title="${escapeAttr(djNombre(h, true) + " · " + r + " días")}">
    <span class="hab-chip__i">${icoHab(h.icon, 20)}</span><span class="hab-chip__n">${escapeHtml(djNombre(h, true))} <small>${r} ${r === 1 ? "día" : "días"}</small></span></button>`;
}

/* -------- Semana y el calendario del mes: cada día -------- */
/* { cls, act, txt, label } para el día iso de un hábito de dejar o reducir */
function djCelda(h, iso) {
  const hoy = hmHoy(), meta = hmMeta(h), antes = iso < hmCreado(h);
  if (iso > hoy || antes) return { cls: "", act: "", txt: "", label: iso > hoy ? "todavía no llega" : "antes de empezar" };
  if (meta === "dejar") {
    const cae = hmCaida(h, iso), conf = hmMarcado(h, iso, STATE);
    return { cls: cae ? "cae" : conf ? "on" : iso < hoy ? "on sin" : "", act: `data-action="dj-dia" data-id="${h.id}" data-f="${iso}"`,
      txt: "", label: cae ? "caída" : conf ? "confirmado" : iso < hoy ? "limpio (sin confirmar)" : "por confirmar" };
  }
  const n = hmCuenta(h, iso), l = hmLimite(h), sobre = l.per === "dia" ? n > l.n : hmSePaso(h, iso);
  return { cls: sobre ? "cae" : iso < hoy && l.per === "dia" ? "on" : "", act: `data-action="rd-dia" data-id="${h.id}" data-f="${iso}"`, txt: String(n), label: `${n} ${h.unidad || ""}`.trim() };
}

/* -------- La hoja del hábito: cuántos días, el mes, los antojos y lo que te ahorras -------- */
function openDejarHoja(id) {
  const h = djDef(id); if (!h) return;
  const meta = hmMeta(h), r = rachaPeriodos(h).n, mejor = hmMejorRacha(h), lim = djLimpios(h, 30), hoy = hmHoy();
  const dias = Array.from({ length: 30 }, (_, i) => hmAdd(hoy, i - 29));
  const tira = dias.map(d => { const c = djCelda(h, d); return `<i class="${c.cls} ${d === hoy ? "hoy" : ""}" title="${escapeAttr(djDiaTxt(d) + ": " + c.label)}"></i>`; }).join("");
  const sem = djAntojos(h, hmAdd(hoy, -6)), pat = djPatron(h), ah = djAhorro(h), alc = typeof alcActivas === "function" ? alcActivas() : [];
  const unidad = meta === "reducir" ? (hmLimite(h).per === "semana" ? (r === 1 ? "semana" : "semanas") : (r === 1 ? "día" : "días")) + " dentro del límite" : djSinTxt(h, r);
  openModal(escapeHtml(h.nombre), `<div class="dj-hoja" id="dj-hoja" data-id="${h.id}">
    <div class="dj-hoja__n"><b>${r}</b><span>${unidad}</span></div>
    <div class="dj-hoja__mini"><span>Mejor racha: <b>${mejor}</b></span><span>Últimos 30 días: <b>${lim.ok} de ${lim.tot}</b> ${meta === "reducir" ? "dentro" : "limpios"}</span></div>
    <div class="dj-tira" role="img" aria-label="Los últimos 30 días">${tira}</div>
    ${meta === "dejar" ? `<div class="dj-hoja__sec"><b>${icoUI("zap")} Tus antojos</b>
      <p class="text-sm">${sem.length ? `Esta semana superaste <b>${djPlural(sem.length, "antojo", "antojos")}</b>.` : "Esta semana no anotaste antojos."}${pat ? ` Suelen llegar <b>${escapeHtml(pat.franja)}</b>${pat.gatillo ? `, sobre todo por <b>${escapeHtml(pat.gatillo.toLowerCase())}</b>` : ""}.` : ""}</p>
      ${h.plan ? `<p class="text-sm">Tu plan para el antojo: <b>«${escapeHtml(h.plan)}»</b></p>` : `<p class="text-xs muted">Escribe tu plan para el antojo en Editar hábito (por ejemplo, «salgo a caminar 5 minutos»).</p>`}</div>` : ""}
    ${ah ? `<div class="dj-hoja__sec"><b>${icoUI("piggy-bank")} Lo que te ahorras</b>
      <p class="text-sm"><b class="dj-plata">${fmtCLP(ah.total)}</b> desde que empezaste (${fmtCLP(+h.costo)} por día)${ah.pasado ? `; ya pasaste ${fmtCLP(ah.pasado)} a tus alcancías` : ""}.</p>
      ${ah.disponible && alc.length ? `<div class="dj-pasar">${elLista("dj-alc", alc.map(a => ({ v: a.id, t: a.nombre })), alc[0].id, { label: "A qué alcancía" })}
        <button class="btn btn--soft" data-action="dj-ahorro-pasar" data-id="${h.id}">Pasar ${fmtCLP(ah.disponible)}</button></div>`
      : ah.disponible ? `<p class="text-xs muted">Crea una alcancía en Finanzas para pasarle lo que te ahorras.</p>` : ""}</div>` : ""}
    <p class="text-xs muted">Es privado: tus amigos no ven tus hábitos.${h.discreto ? ` En Inicio se llama «${escapeHtml(h.discreto)}».` : ""}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn-ghost" data-action="habit-edit" data-id="${h.id}">Editar</button></div></div>`);
}

/* -------- Antojo superado, caída y lo de cada día -------- */
function openAntojo(id) {
  const h = djDef(id); if (!h) return;
  openModal("Antojo superado", `<p class="text-sm">Bien ahí. ${h.plan ? `Tu plan: <b>«${escapeHtml(h.plan)}»</b>.` : "Respira: el antojo pasa en unos minutos."}</p>
    <div class="field mt-16"><label>¿Qué lo gatilló?</label>
      <div class="rapidas dj-gatillos" role="group" aria-label="Qué lo gatilló">${DJ_GATILLOS.map(g => `<button type="button" data-action="dj-antojo-ok" data-id="${h.id}" data-g="${escapeAttr(g)}">${escapeHtml(g)}</button>`).join("")}</div></div>
    <p class="text-xs muted">Toca uno y queda anotado. +1 ⭐ por antojo, hasta ${DJ_ANTOJOS_DIA} al día. Con el tiempo verás cuándo y por qué llegan.</p>`);
}
function djAntojoOk(id, gatillo) {
  const h = djDef(id); if (!h) return;
  const hoy = hmHoy(), n = djAntojos(h, hoy).length, a = djAntojoAgregar(h, gatillo);
  saveState(); closeModal();
  if (n < DJ_ANTOJOS_DIA) registrarMovimiento("antojo:" + a.id, 1, 1, "Antojo superado", true);
  toast(n < DJ_ANTOJOS_DIA ? `Antojo superado (${gatillo.toLowerCase()}). +1 ⭐` : `Antojo superado (${gatillo.toLowerCase()}). Hoy ya ganaste las ${DJ_ANTOJOS_DIA} ⭐ de antojos; igual queda anotado.`);
  rerender();
}
function openCaida(id) {
  const h = djDef(id); if (!h) return;
  openModal("¿Caíste hoy?", `<p class="text-sm">Caer es parte de dejarlo. Tu racha vuelve a 0, pero no se borra lo que llevas: el mes, tu mejor racha y tu cactus siguen ahí.</p>
    <div class="row mt-16" style="gap:8px;flex-wrap:wrap"><button class="btn btn--primary" data-action="dj-caida-ok" data-id="${h.id}">Sí, caí hoy</button>
      <button class="btn-ghost" data-action="close-modal">No, me equivoqué</button></div>`);
}
function djCaidaOk(id) {
  const h = djDef(id); if (!h) return;
  const hoy = hmHoy(); djCaer(h, hoy); closeModal(); rerender();
  const l = djLimpios(h, 30);
  toast(`Caer es parte de dejarlo. Llevas ${l.ok} de ${l.tot} días limpios este mes. Mañana parte otra racha.`);
}
/* Semana y calendario del mes (dejar): un día que pasó cambia entre limpio y caída; hoy, confirmar o deshacer */
function djDiaToggle(id, iso) {
  const h = djDef(id); if (!h) return;
  const hoy = hmHoy();
  if (iso > hoy) return toast("Ese día todavía no llega.", true);
  if (hmCaida(h, iso)) { djCaidaPoner(h, iso, false); saveState(); rerender(); return toast(`Quitaste la caída de ${djDiaTxt(iso)}.`); }
  if (iso === hoy) { if (hmMarcado(h, iso, STATE)) { const [y, m, d] = iso.split("-").map(Number); toggleHabitDate(h.id, y, m - 1, d); } else djConfirmar(h, iso); return; }
  djCaer(h, iso); rerender(); toast(`Marcaste una caída ${djDiaTxt(iso)}. Tócalo de nuevo para quitarla.`);
}
/* Reducir: +1 / −1 (hoy o el día que elegiste) */
function rdSumar(id, iso, delta) {
  const h = djDef(id); if (!h) return;
  iso = iso || hmHoy();
  if (iso > hmHoy()) return toast("Ese día todavía no llega.", true);
  const antes = hmSePaso(h, iso), n = Math.max(0, hmCuenta(h, iso) + delta);
  djCuentaPoner(h, iso, n); saveState();
  const l = hmLimite(h), ahora = hmSePaso(h, iso);
  if (delta > 0) vibrar(10);
  if (ahora && !antes) toast(`Te pasaste del límite (${l.n} ${l.per === "semana" ? "por semana" : "al día"}). Mañana es otro día.`, true);
  const hoja = document.getElementById("rd-dia");
  if (hoja) { hoja.outerHTML = rdDiaHtml(h, iso); rerender(); return; }
  rerender();
}
function rdDiaHtml(h, iso) {
  const n = hmCuenta(h, iso), l = hmLimite(h), sobre = l.per === "dia" ? n > l.n : hmSePaso(h, iso);
  return `<div id="rd-dia" class="rd-dia"><div class="hb-lim__cont"><button type="button" class="hb-lim__b" data-action="rd-menos" data-id="${h.id}" data-f="${iso}" aria-label="Uno menos" ${n ? "" : "disabled"}>−</button>
    <b>${n}</b><button type="button" class="hb-lim__b" data-action="rd-mas" data-id="${h.id}" data-f="${iso}" aria-label="Uno más">+</button></div>
    <p class="text-sm ${sobre ? "hl-coral" : "muted"}">${l.per === "semana" ? `Esa semana: ${hmCuentaRango(h, hmLunes(iso), hmAdd(hmLunes(iso), 6))} de ${l.n}` : `Límite: ${l.n}${h.unidad ? " " + escapeHtml(h.unidad) : ""} al día`}${sobre ? " · te pasaste" : ""}</p></div>`;
}
function openRdDia(id, iso) {
  const h = djDef(id); if (!h) return;
  if (iso > hmHoy()) return toast("Ese día todavía no llega.", true);
  openModal(`${escapeHtml(h.nombre)} · ${djDiaTxt(iso).replace(/^el /, "")}`, rdDiaHtml(h, iso));
}
/* Lo que te ahorras, a una alcancía */
function djAhorroPasar(id) {
  const h = djDef(id), sel = document.getElementById("dj-alc"); if (!h || !sel) return;
  const ah = djAhorro(h); if (!ah || !ah.disponible) return;
  const a = alcAportar(sel.value, ah.disponible, "dejar:" + h.id);
  if (!a) return toast("No se pudo pasar a esa alcancía.", true);
  h.ahorroPasado = (+h.ahorroPasado || 0) + ah.disponible; h.ts = Date.now();
  saveState(); alcRevisar(sel.value);
  const alc = alcPorId(sel.value);
  toast(`🐷 Pasaste ${fmtCLP(ah.disponible)} a «${alc ? alc.nombre : "tu alcancía"}».`);
  openDejarHoja(h.id);
}

/* -------- El formulario de hábito: ¿qué quieres? Hacerlo, dejarlo o reducirlo -------- */
function djFormHtml(h) {
  const meta = h ? hmMeta(h) : "hacer", l = h ? hmLimite(h) : { n: 2, per: "dia" }, hoy = hmHoy();
  const seg = h ? `<span class="chip chip--freq">${meta === "dejar" ? "Para dejar" : meta === "reducir" ? "Para reducir" : "Para hacer"}</span>`
    : elTramos("h-meta", [["hacer", "Hacerlo"], ["dejar", "Dejarlo"], ["reducir", "Reducirlo"]], meta, { label: "¿Qué quieres?", fn: "djMetaElegir", attrs: 'id="h-meta-seg"' });
  return `<div class="field"><label>¿Qué quieres?</label>${seg}${h ? `<input type="hidden" id="h-meta" value="${meta}">` : ""}</div>
    <div id="dj-box-dejar" ${meta === "dejar" ? "" : "hidden"}>
      <div class="field"><label for="h-desde">¿Desde cuándo?</label><input class="input" type="date" id="h-desde" max="${hoy}" min="${hmAdd(hoy, -365)}" value="${h && meta === "dejar" ? hmCreado(h) : hoy}">
        <div class="text-xs muted mt-8">Si ya llevas días sin, parte desde ahí.</div></div>
      <div class="field"><label for="h-costo">¿Cuánto te costaba al día? (opcional)</label><input class="input" type="number" id="h-costo" min="0" step="100" inputmode="numeric" value="${h && +h.costo ? +h.costo : ""}" placeholder="Ej: 3500">
        <div class="text-xs muted mt-8">Rumbo suma lo que no gastas y lo puedes pasar a una alcancía.</div></div>
      <div class="field"><label for="h-plan">Tu plan para el antojo (opcional)</label><input class="input" id="h-plan" maxlength="80" value="${escapeAttr((h && h.plan) || "")}" placeholder="Ej: salgo a caminar 5 minutos"></div>
    </div>
    <div id="dj-box-reducir" ${meta === "reducir" ? "" : "hidden"}>
      <div class="field"><label>Tu límite</label><div class="dj-limite">
        ${elContador("h-lim-n", l.n, { min: 0, max: 99, label: "Tu límite" })}
        <input class="input" id="h-unidad" maxlength="20" value="${escapeAttr((h && h.unidad) || "")}" placeholder="Ej: cafés" aria-label="Qué cuentas (por ejemplo, cafés)"></div>
        <div class="mt-8">${elTramos("h-lim-per", [["dia", "Al día"], ["semana", "Por semana"]], l.per, { label: "Cada cuánto", attrs: 'id="h-lim-seg"' })}</div>
        <div class="text-xs muted mt-8">Cada vez, un toque (+1). Mientras no pases el límite, el día es verde.</div></div>
    </div>
    <div id="dj-box-discreto" ${meta === "hacer" ? "hidden" : ""}><div class="field"><label for="h-discreto">Nombre en Inicio (opcional)</label>
      <input class="input" id="h-discreto" maxlength="30" value="${escapeAttr((h && h.discreto) || "")}" placeholder="Ej: Mi reto">
      <div class="text-xs muted mt-8">Es privado: tus amigos no ven tus hábitos. Con un nombre discreto, en Inicio se ve así.</div></div></div>`;
}
function djMetaPick(btn) { if (btn) btn.click(); }
function djMetaElegir(m) {
  const ver = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };
  ver("dj-box-dejar", m === "dejar"); ver("dj-box-reducir", m === "reducir"); ver("dj-box-discreto", m !== "hacer");
  ver("h-freq-box", m === "hacer"); ver("h-cj-box", m === "hacer");
  // Un ícono que calce, si no elegiste otro: el cigarro tachado para dejar
  const ic = document.getElementById("h-icon");
  if (ic && m === "dejar" && ic.value === "🏋️") elMarcar(document.getElementById("h-iconos"), "🚭");
  const nom = document.getElementById("h-nombre");
  if (nom && !nom.value.trim()) nom.placeholder = m === "dejar" ? "Ej: Dejar de fumar" : m === "reducir" ? "Ej: Café" : "Ej: Meditar";
}
/* Lo que el formulario agrega al hábito (o null si es de hacer) */
function djLeerForm() {
  const meta = val("h-meta");
  if (meta !== "dejar" && meta !== "reducir") return null;
  const hoy = hmHoy(), discreto = val("h-discreto").slice(0, 30);
  if (meta === "dejar") {
    let desde = val("h-desde"); if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || desde > hoy) desde = hoy; if (desde < hmAdd(hoy, -365)) desde = hmAdd(hoy, -365);
    return { meta, frecuencia: { tipo: "diario" }, creado: desde, costo: Math.max(0, Math.round(parseNum(val("h-costo")) || 0)), plan: val("h-plan").slice(0, 80), discreto };
  }
  const per = val("h-lim-per") === "semana" ? "semana" : "dia";
  return { meta, frecuencia: per === "semana" ? { tipo: "semanal", veces: 1 } : { tipo: "diario" }, limite: { n: Math.max(0, Math.min(999, Math.round(parseNum(val("h-lim-n")) || 0))), per }, unidad: val("h-unidad").slice(0, 20), discreto };
}

/* -------- El cierre del día: confirmar con un toque -------- */
function djCierreHtml(iso) {
  const hs = (STATE.habitos.defs || []).filter(h => hmActivo(h) && hmMeta(h) === "dejar" && hmCreado(h) <= iso);
  if (!hs.length) return "";
  return `<div class="field"><label>${icoUI("ban")} Lo que estás dejando</label>${hs.map(h => {
    const cae = hmCaida(h, iso), conf = hmMarcado(h, iso, STATE);
    if (cae || conf) return `<div class="text-sm">${escapeHtml(h.nombre)}: ${cae ? "caíste, mañana parte otra racha" : "confirmado ✓"}</div>`;
    return `<div class="dj-cierre"><span class="text-sm">${escapeHtml(h.nombre)}</span>${elTramos("dj-c-" + h.id, [["si", "Hoy sin ✓ (+5 ⭐)"], ["cai", "Caí"]], "", { label: h.nombre })
      .replace('<input type="hidden" id="dj-c-', '<input type="hidden" class="dj-c" data-id="' + h.id + '" id="dj-c-')}</div>`;
  }).join("")}<p class="text-xs muted">Si no eliges, el día cuenta igual como limpio; las ⭐ esperan a que lo confirmes.</p></div>`;
}
function djCierreGuardar(iso) {
  document.querySelectorAll("input.dj-c").forEach(el => {
    const h = djDef(el.dataset.id); if (!h || !el.value) return;
    if (el.value === "si") djConfirmar(h, iso); else if (el.value === "cai") djCaer(h, iso);
  });
}

/* -------- Las acciones (data-action="dj-…" y "rd-…") -------- */
function dejarAccion(a, d) {
  if (a === "dj-ver") return openDejarHoja(d.id);
  if (a === "dj-antojo") return openAntojo(d.id);
  if (a === "dj-antojo-ok") return djAntojoOk(d.id, d.g);
  if (a === "dj-caida") return openCaida(d.id);
  if (a === "dj-caida-ok") return djCaidaOk(d.id);
  if (a === "dj-caida-quitar") { const h = djDef(d.id); if (h) { djCaidaPoner(h, d.f || hmHoy(), false); saveState(); rerender(); toast("Deshiciste la caída."); } return; }
  if (a === "dj-dia") return djDiaToggle(d.id, d.f);
  if (a === "dj-ahorro-pasar") return djAhorroPasar(d.id);
  if (a === "rd-mas") return rdSumar(d.id, d.f, +1);
  if (a === "rd-menos") return rdSumar(d.id, d.f, -1);
  if (a === "rd-dia") return openRdDia(d.id, d.f);
}
