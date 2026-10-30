/* ============================================================
   RUMBO · Amigos en una pantalla (el tablero)
   Todo lo de tus amigos de un vistazo, en vez de una tarjeta por cosa:
   · «Para responder»: lo que espera tu respuesta (invitaciones a planes, hábitos, objetivos,
     listas y libros; votar una fecha; solicitudes; lo que debes de un plan; los ánimos). Se
     responde ahí mismo, y el número del punto de Amigos en la barra es cuántas cosas hay.
   · «Esta semana»: tus planes y los cumpleaños de tus amigos de los próximos 7 días.
   · «Juntos»: una baldosa por cada cosa que hacen con amigos (planes, hábitos, objetivos,
     listas y lecturas) y la de tus amigos. Al tocarla se abre como hoja, sin salir de Amigos.
   · Arriba, «+ Nuevo» (plan, hábito, objetivo, lista o lectura) y el engranaje: invitar, tu
     código, lo que muestras y bloqueados. Sin amigos, «Invita a un amigo» queda en la pantalla.
   Lo de juntos sigue también en sus módulos (Semana, Hábitos, Objetivos, Listas, Lecturas).
   ============================================================ */

/* La hoja abierta (planes, habitos, objetivos, listas, lecturas, amigos, ajustes, nuevo o leer),
   si «Para responder» se ve entera y la pestaña de la hoja de planes */
const AT = { hoja: null, toda: false, pestana: "proximos" };
/* Cuántas cosas por responder se ven antes de «Ver todo» (en el celular, menos: que se vea la semana) */
function atMaxBandeja() { return typeof isMobileView === "function" && isMobileView() ? 3 : 5; }

/* -------- Lo que espera tu respuesta (también es el número del punto de Amigos) -------- */
function amPendientes() {
  const l = AMIGOS.lista; if (!l) return [];
  const hoy = todayISO(), out = [], planes = PLAN.lista || [];
  planes.filter(plInvitacion).forEach(p => out.push({ tipo: "plan", p }));
  // ya respondiste, pero falta decir qué fechas te sirven (quien lo propuso no vota: elige)
  planes.filter(p => !p.fecha && !p.cancelado && (p.respuesta === "voy" || p.respuesta === "quizas") && !plEsMio(p) && !plVoto(p))
    .forEach(p => out.push({ tipo: "votar", p }));
  (l.recibidas || []).forEach(a => out.push({ tipo: "solicitud", a }));
  (CONJ.lista || []).filter(c => c.estado === "invitado").forEach(c => out.push({ tipo: "habito", c }));
  (OBJ.lista || []).filter(o => o.estado === "invitado").forEach(o => out.push({ tipo: "objetivo", o }));
  (LCOM.lista || []).filter(x => x.estado === "invitado").forEach(x => out.push({ tipo: "lista", x }));
  (LJ.lista || []).filter(x => x.estado === "invitado").forEach(x => out.push({ tipo: "lectura", x }));
  planes.filter(p => plVa(p) && p.fecha <= hoy).forEach(p => {
    const yo = plYo(p);
    plDeudas(p).filter(d => d.de === yo.id).forEach(d => out.push({ tipo: "deuda", p, d }));
  });
  const animos = (l.animos || []).filter(a => !AMIGOS.animosVistos.includes(a.id));
  if (animos.length) out.push({ tipo: "animo", animos });   // todos los ánimos, en una fila
  return out;
}
/* Esta semana: tus planes (si vas o tal vez), los abiertos de tus amigos y sus cumpleaños, de hoy a 6 días más */
function amSemana() {
  const hoy = todayISO(), fin = agSumar(hoy, 6), out = [];
  (PLAN.lista || []).filter(p => p.fecha && p.fecha >= hoy && p.fecha <= fin && !p.cancelado && (plVa(p) || p.respuesta === "abierto"))
    .forEach(p => out.push({ tipo: "plan", fecha: p.fecha, hora: p.hora || "99", p }));
  ((AMIGOS.lista && AMIGOS.lista.amigos) || []).forEach(a => {
    const n = amigoCumpleEn(a);
    if (n != null && n <= 6) out.push({ tipo: "cumple", fecha: agSumar(hoy, n), hora: "", a });
  });
  return out.sort((x, y) => x.fecha.localeCompare(y.fecha) || x.hora.localeCompare(y.hora));
}

/* -------- Dibujo -------- */
/* "Hoy", "Mañana", "Vie 7" */
function atDiaTxt(iso) {
  const hoy = todayISO();
  if (iso === hoy) return "Hoy";
  if (iso === agSumar(hoy, 1)) return "Mañana";
  const d = agDate(iso), s = DIAS_CORTO_ES[d.getDay()];
  return s.charAt(0).toUpperCase() + s.slice(1) + " " + d.getDate();
}
function atVacio(txt) { return `<p class="text-sm muted at-vacio">${txt}</p>`; }
/* Una fila de «Para responder»: qué es, de quién y los botones para responder ahí mismo */
function atFila(ico, titulo, sub, botones, ver) {
  const t = `<b>${titulo}</b><span>${sub}</span>`;
  return `<div class="at-fila">${ico}${ver ? `<button type="button" class="at-fila__t" ${ver}>${t}</button>` : `<span class="at-fila__t">${t}</span>`}
    <span class="at-fila__b">${botones}</span></div>`;
}
function atBotones(prefijo, id, si) {
  const i = escapeHtml(id);
  return `<button class="btn-ghost" data-action="${prefijo}-rechazar" data-id="${i}">Ahora no</button><button class="btn btn--primary" data-action="${prefijo}-unirme" data-id="${i}">${si}</button>`;
}
function atBandejaFila(it) {
  const e = escapeHtml;
  if (it.tipo === "plan" || it.tipo === "votar") {
    const p = it.p, donde = plDonde(p), ico = `<span class="pl-ico pl-ico--${p.tipo}">${plIcono(p)}</span>`, ver = `data-action="pl-ver" data-id="${e(p.id)}"`;
    if (it.tipo === "votar") return atFila(ico, e(p.titulo), `${e(plQuienPropone(p))} propone ${p.opciones.length} fechas: ¿cuáles te sirven?`, `<button class="btn btn--primary" ${ver}>Votar</button>`, ver);
    return atFila(ico, e(p.titulo), `${e(plQuienPropone(p))} ${p.abierto ? "pregunta quién se suma" : "te invita"} · ${e(plCuando(p))}${donde ? " · " + e(donde) : ""}`,
      p.fecha ? `<button class="btn-ghost" data-action="pl-resp" data-id="${e(p.id)}" data-v="no">No puedo</button><button class="btn btn--primary" data-action="pl-resp" data-id="${e(p.id)}" data-v="voy">Voy</button>`
        : `<button class="btn btn--primary" ${ver}>Responder</button>`, ver);
  }
  if (it.tipo === "solicitud") {
    const a = it.a;
    return atFila(amigosAvatar(a, 38), e(a.nombre || "Sin nombre"), "quiere sumarte a sus amigos",
      `<button class="btn-ghost" data-action="am-rechazar" data-id="${e(a.id)}">Ahora no</button><button class="btn btn--primary" data-action="am-aceptar" data-id="${e(a.id)}">Aceptar</button>`);
  }
  if (it.tipo === "habito") {
    const c = it.c;
    return atFila(`<span class="pl-ico pl-ico--deporte">${icoHab(c.icon, 20)}</span>`, e(c.nombre), `${e(cjQuienInvita(c))} te invita a un hábito · ${e(hmFreqLabel(c))}`, atBotones("cj", c.id, "Unirme"));
  }
  if (it.tipo === "objetivo") {
    const o = it.o;
    return atFila(`<span class="pl-ico">${ojIcono(o)}</span>`, e(o.nombre), `${e(ojQuienInvita(o))} te invita a un objetivo · ${e(ojFmt(o.meta, o.unidad))} · ${e(ojPlazo(o))}`,
      atBotones("oj", o.id, "Unirme"), `data-action="oj-ver" data-id="${e(o.id)}"`);
  }
  if (it.tipo === "lista") {
    const x = it.x;
    return atFila(`<span class="pl-ico pl-ico--${lcTipo(x).plan}">${lcIcono(x)}</span>`, e(x.nombre),
      `${e(lcQuienInvita(x))} te invita a una lista · ${x.items.length === 1 ? "1 cosa" : x.items.length + " cosas"}`, atBotones("lc", x.id, "Unirme"));
  }
  if (it.tipo === "lectura") {
    const x = it.x;
    return atFila(`<span class="pl-ico">${icoUI("book-open")}</span>`, e(x.titulo), `${e(ljQuienInvita(x))} te invita a leerlo${x.autor ? " · " + e(x.autor) : ""} · ${x.paginas} páginas`, atBotones("lj", x.id, "Leerlo"));
  }
  if (it.tipo === "deuda") {
    const { p, d } = it;
    return atFila(`<span class="pl-ico pl-ico--comer">${icoUI("finanzas")}</span>`, `Le debes ${fmtCLP(d.monto)} a ${e(plNombreDe(p, d.a))}`, `La cuenta de «${e(p.titulo)}»`,
      `<button class="btn btn--primary" data-action="pl-pague" data-id="${e(p.id)}" data-a="${e(d.a)}" data-m="${d.monto}">Ya le pagué</button>`, `data-action="pl-ver" data-id="${e(p.id)}"`);
  }
  if (it.tipo === "animo") {
    const as = it.animos, nombres = [...new Set(as.map(a => a.nombre || "Un amigo"))], frases = [...new Set(as.map(a => a.mensaje).filter(Boolean))];
    return atFila(`<span class="at-caras">${as.filter((x, i) => as.findIndex(y => y.nombre === x.nombre) === i).slice(0, 3).map(x => amigosAvatar(x, 38)).join("")}</span>`,
      `${e(cjNombres(nombres))} te ${nombres.length > 1 ? "mandaron" : "mandó"} ánimo`,
      frases.length ? frases.slice(0, 3).map(f => "«" + e(f) + "»").join(" · ") + (frases.length > 3 ? ` y ${frases.length - 3} más` : "") : "Para que sigas",
      `<button class="btn btn--primary" data-action="am-gracias">Gracias</button>`);
  }
  return "";
}
function atBandejaHtml(items) {
  if (!items.length) return `<div class="at-al-dia">${icoUI("hecho")} Nada por responder. Estás al día.</div>`;
  const max = atMaxBandeja(), ver = AT.toda ? items : items.slice(0, max);
  return `<div class="card at-bandeja">${ver.map(atBandejaFila).join("")}
    ${items.length > max ? `<button type="button" class="btn-ghost at-todo" data-action="am-bandeja">${AT.toda ? "Ver menos" : `Ver todo · ${items.length}`}</button>` : ""}</div>`;
}
function atSemanaHtml(items) {
  const e = escapeHtml, chips = items.map(it => {
    if (it.tipo === "cumple") {
      const a = it.a, hoy = it.fecha === todayISO();
      return `<button type="button" class="at-dia at-dia--cumple" data-action="${hoy ? "am-animo" : "am-ver"}" data-id="${e(a.id)}">
        <b>${atDiaTxt(it.fecha)}</b><span>${icoUI("cake")} ${e(a.nombre || "Tu amigo")}</span><small>${hoy ? "Está de cumpleaños: saluda" : "Su cumpleaños"}</small></button>`;
    }
    const p = it.p, abierto = p.respuesta === "abierto", con = plCon(p);
    return `<button type="button" class="at-dia${abierto ? " at-dia--abierto" : ""}" data-action="pl-ver" data-id="${e(p.id)}">
      <b>${atDiaTxt(p.fecha)}${p.hora ? " · " + p.hora : ""}</b><span>${plIcono(p)} ${e(p.titulo)}</span>
      <small>${abierto ? `${e(plQuienPropone(p))} pregunta: ¿te sumas?` : con ? "con " + e(con) : e(plDonde(p))}</small></button>`;
  });
  if (!chips.length) chips.push(PLAN.error === "sin-servidor" ? `<div class="at-dia at-dia--vacio"><b>Nada esta semana</b></div>`
    : `<button type="button" class="at-dia at-dia--vacio" data-action="pl-nuevo"><b>Nada esta semana</b><span>${icoUI("plus")} Proponer un plan</span></button>`);
  return `<div class="at-semana">${chips.join("")}</div>`;
}
function atBaldosa(k, ico, nombre, dato, sub, color) {
  return `<button type="button" class="at-tile${color ? " at-tile--" + color : ""}" data-action="am-hoja" data-v="${k}">
    <span class="at-tile__n"><span class="at-tile__i">${ico}</span>${nombre}</span>
    ${dato === "" ? "" : `<b class="at-tile__d">${dato}</b>`}<small>${sub}</small></button>`;
}
const atPlural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
/* Las baldosas de «Juntos», cada una con su estado (las que el servidor todavía no tiene, no se ven) */
function atBaldosasHtml(l) {
  const hoy = todayISO(), amigos = l.amigos || [], t = [];
  if (PLAN.error !== "sin-servidor") {
    const ps = PLAN.lista || [], prox = ps.filter(p => !p.cancelado && p.respuesta !== "abierto" && p.respuesta !== "no" && (!p.fecha || p.fecha >= hoy));
    const ab = ps.filter(p => p.respuesta === "abierto").length, abTxt = ab ? atPlural(ab, "abierto", "abiertos") : "";
    t.push(atBaldosa("planes", icoUI("ticket"), "Planes", prox.length || "",
      prox.length ? (prox.length === 1 ? "próximo" : "próximos") + (ab ? " · " + abTxt : "") : ab ? abTxt + ": ¿te sumas?" : "Propón uno", "ambar"));
  }
  if (CONJ.error !== "sin-servidor") {
    const act = (CONJ.lista || []).filter(c => c.estado === "activo"), racha = Math.max(0, ...act.map(c => cjRacha(c).n || 0));
    t.push(atBaldosa("habitos", icoUI("handshake"), "Hábitos", !act.length ? "" : racha ? `${icoUI("llama")} ${racha}` : act.length,
      !act.length ? "Hazlo con amigos" : racha ? "de racha · " + atPlural(act.length, "hábito", "hábitos") : act.length === 1 ? "hábito juntos" : "hábitos juntos", "verde"));
  }
  if (OBJ.error !== "sin-servidor") {
    const act = (OBJ.lista || []).filter(o => o.estado === "activo"), o = act.find(x => !x.cumplido) || act[0];
    t.push(atBaldosa("objetivos", icoUI("mision"), "Objetivos", o ? (o.cumplido ? icoUI("medal") : ojPct(o) + " %") : "",
      o ? escapeHtml(o.nombre) + (act.length > 1 ? ` y ${act.length - 1} más` : "") : "Una meta juntos"));
  }
  if (LCOM.error !== "sin-servidor") {
    const act = (LCOM.lista || []).filter(x => x.estado === "activo"), n = act.reduce((s, x) => s + lcPorVer(x).length, 0);
    t.push(atBaldosa("listas", icoUI("listas"), "Listas", act.length ? n : "", act.length ? (act.length === 1 ? lcTipo(act[0]).por : "en " + act.length + " listas") : "Arma una juntos"));
  }
  if (LJ.error !== "sin-servidor") {
    const act = (LJ.lista || []).filter(x => x.estado === "activo"), x = act[0];
    t.push(atBaldosa("lecturas", icoUI("book-open"), "Lecturas", x ? ljPct(x, ljYo(x)) + " %" : "", x ? (act.length > 1 ? atPlural(act.length, "libro", "libros") + " juntos" : escapeHtml(x.titulo)) : "Lee con amigos"));
  }
  const cumple = amigos.find(a => amigoCumpleEn(a) === 0);
  const dia = amigos.filter(a => { const e = amigosEstadoLimpio(a.estado); return e.fecha === hoy && (e.abrio || e.cerro); }).length;
  t.push(atBaldosa("amigos", icoUI("amigos"), "Amigos", amigos.length,
    cumple ? "Hoy cumple " + escapeHtml(cumple.nombre || "uno") : dia ? `${dia} ${dia === 1 ? "abrió" : "abrieron"} su día` : (l.enviadas || []).length ? atPlural(l.enviadas.length, "solicitud enviada", "solicitudes enviadas") : "en Rumbo"));
  return `<div class="at-tiles">${t.join("")}</div>`;
}
/* Sin amigos todavía: lo que podrán hacer juntos */
function atQueHacenHtml() {
  const f = [["ticket", "Planes", "Juntarse: una película, un asado o salir a correr."], ["handshake", "Hábitos", "Lo hacen juntos y suman una racha de a dos."],
    ["mision", "Objetivos", "Una meta con avance sumado, como juntar para un viaje."], ["listas", "Listas", "Películas por ver o restaurantes por probar, entre varios."],
    ["book-open", "Lecturas", "El mismo libro, cada uno a su ritmo."]];
  return `<div class="card"><div class="card__title">Lo que pueden hacer juntos</div>
    <div class="at-que">${f.map(([i, t, s]) => `<div class="at-que__f"><span class="pl-ico">${icoUI(i)}</span><span><b>${t}</b><span class="text-xs muted">${s}</span></span></div>`).join("")}</div></div>`;
}
/* La pantalla de Amigos (renderAmigos, con la lista ya cargada) */
function atTableroHtml(l) {
  const amigos = l.amigos || [], items = amPendientes();
  if (AT.hoja) setTimeout(atRefrescarHoja, 0);   // la hoja abierta también se pone al día
  const titulo = !amigos.length && !items.length ? "" : `<h2 class="at-h">Para responder${items.length ? ` <span>· ${items.length}</span>` : ""}</h2>`;
  // arriba, en una línea: «Para responder», «+ Nuevo» y el engranaje
  const cab = `<div class="at-cab">${titulo}<span class="at-cab__b">${amigos.length ? `<button class="btn btn--soft at-nuevo" data-action="am-hoja" data-v="nuevo">${icoUI("plus")} Nuevo</button>` : ""}
    <button type="button" class="icon-btn at-eng" data-action="am-hoja" data-v="ajustes" aria-label="Ajustes de Amigos" title="Invitar, tu código y lo que muestras">${icoUI("settings")}</button></span></div>`;
  const bandeja = atBandejaHtml(items);
  const enviadas = (l.enviadas || []).length ? `<div class="card at-enviadas">${amigosEnviadasHtml(l.enviadas)}</div>` : "";
  if (!amigos.length) return `<div class="am at">${cab}${items.length ? bandeja : ""}${amigosInvitarHtml()}${enviadas}${atQueHacenHtml()}</div>`;
  return `<div class="am at">${cab}<div class="at__cols">
    <div class="at__col">${bandeja}<section class="at-sec"><h2 class="at-h">Esta semana</h2>${atSemanaHtml(amSemana())}</section></div>
    <div class="at__col"><section class="at-sec"><h2 class="at-h">Juntos</h2>${atBaldosasHtml(l)}</section></div></div></div>`;
}

/* -------- Las hojas (se abren sobre Amigos y se ponen al día solas) -------- */
function atPie(botones) { return `<div class="at-hoja__pie">${botones}</div>`; }
function atHojaPlanes(amigos) {
  const l = PLAN.lista || [], hoy = todayISO(), mios = l.filter(p => p.respuesta !== "abierto");
  const orden = (a, b) => (a.fecha + (a.hora || "99")).localeCompare(b.fecha + (b.hora || "99"));
  const abiertos = l.filter(p => p.respuesta === "abierto").sort(orden), prox = mios.filter(p => p.fecha && p.fecha >= hoy).sort(orden);
  const pordef = mios.filter(p => !p.fecha), pasaron = l.filter(p => plVa(p) && p.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const tabs = [["proximos", "Próximos", abiertos.length + prox.length], ["pordefinir", "Por definir", pordef.length], ["pasaron", "Pasaron", pasaron.length]];
  const seg = `<div class="seg seg--full at-tabs" role="tablist" aria-label="Planes">${tabs.map(([v, t, n]) => `<button role="tab" aria-selected="${AT.pestana === v}" class="${AT.pestana === v ? "is-active" : ""}" data-action="am-pestana" data-v="${v}">${t}${n ? ` <em>${n}</em>` : ""}</button>`).join("")}</div>`;
  let cuerpo;
  if (AT.pestana === "pordefinir") cuerpo = pordef.map(plFila).join("") || atVacio("Nada por definir. Para que voten la fecha, al proponer un plan elige «Que voten».");
  else if (AT.pestana === "pasaron") cuerpo = pasaron.map(plFila).join("") || atVacio("Aquí quedan los planes que ya fueron, para contar cómo estuvieron y sacar la cuenta.");
  else cuerpo = (abiertos.length ? `<div class="cj-sub">¿Quién se suma?</div>${abiertos.map(p => `<div class="pl-inv">${plFila(p)}
        <div class="pl-inv__b"><button class="btn btn--soft" data-action="pl-sumarme" data-id="${escapeHtml(p.id)}">${icoUI("plus")} Me sumo</button></div></div>`).join("")}${prox.length ? `<div class="cj-sub mt-8">Tus planes</div>` : ""}` : "")
    + (prox.map(plFila).join("") || (abiertos.length ? "" : atVacio("Una película el viernes, un asado o salir a correr: propón un plan, invita a tus amigos y cada uno responde si va. Queda en la Semana y el Calendario de cada uno.")));
  return `<div class="at-hoja__cab">${seg}${amigos.length ? `<button class="btn btn--soft" data-action="pl-nuevo">${icoUI("plus")} Plan</button>` : ""}</div><div class="pl-card at-lista">${cuerpo}</div>`;
}
function atHojaHabitos(amigos) {
  const act = (CONJ.lista || []).filter(c => c.estado === "activo");
  return `${act.length ? act.map(c => cjFila(c, true)).join("")
      : atVacio("Elige un hábito y hazlo con tus amigos: cada uno lo marca en su Rumbo, ven quién ya cumplió y suman una racha juntos. El día que cumplen todos, +5 ⭐ para cada uno.")}
    ${atPie(`${amigos.length ? `<button class="btn btn--soft" data-action="cj-nuevo">${icoUI("handshake")} Hábito con amigos</button>` : ""}<button class="btn-ghost" data-action="am-ir" data-v="habitos">Ir a Hábitos</button>`)}`;
}
function atHojaObjetivos(amigos) {
  const act = (OBJ.lista || []).filter(o => o.estado === "activo");
  return `${act.length ? act.map(o => `<button type="button" class="oj-mini" data-action="oj-ver" data-id="${escapeHtml(o.id)}"><span class="oj__ico">${ojIcono(o)}</span>
      <span class="oj__t"><b>${escapeHtml(o.nombre)}</b><span class="text-xs muted">${o.cumplido ? "¡Lo lograron!" : ojPct(o) + " % · " + escapeHtml(ojFmt(ojTotal(o), o.unidad)) + " de " + escapeHtml(ojFmt(o.meta, o.unidad))}</span></span>${ojBarra(o, 6)}</button>`).join("")
      : atVacio("Metas con avance sumado, como juntar para un viaje o correr 100 km entre varios. Al lograrla, la medalla En Equipo.")}
    ${atPie(`${amigos.length ? `<button class="btn btn--soft" data-action="oj-nuevo">${icoUI("handshake")} Objetivo con amigos</button>` : ""}<button class="btn-ghost" data-action="am-ir" data-v="metas">Ir a Objetivos</button>`)}`;
}
function atHojaListas(amigos) {
  const act = (LCOM.lista || []).filter(x => x.estado === "activo");
  return `${act.length ? `<div class="at-listas">${act.map(lcTarjeta).join("")}</div>`
      : atVacio("Películas por ver, restaurantes por probar o lugares para un viaje: una lista que arman entre varios. Y de ahí, a un plan.")}
    ${atPie(`${amigos.length ? `<button class="btn btn--soft" data-action="lc-nueva">${icoUI("handshake")} Lista con amigos</button>` : ""}<button class="btn-ghost" data-action="lc-ir">Ir a Listas</button>`)}`;
}
function atHojaLecturas() {
  const act = (LJ.lista || []).filter(x => x.estado === "activo");
  return `${act.length ? act.map(x => {
      const yo = ljYo(x);
      return `<div class="at-libro"><div class="at-libro__cab"><span class="pl-ico">${icoUI("book-open")}</span><span><b>${escapeHtml(x.titulo)}</b>
          <span class="text-xs muted">${x.autor ? escapeHtml(x.autor) + " · " : ""}tú: ${yo.terminado ? "¡lo terminaste!" : `pág. ${yo.pagina} · ${ljPct(x, yo)} %`}</span></span></div>
        ${ljAvanceHtml(ljLibro(x.id) || { juntos: x.id })}</div>`;
    }).join("") : atVacio("Lean el mismo libro, cada uno a su ritmo: solo se comparte en qué página va cada uno.")}
    ${atPie(`<button class="btn btn--soft" data-action="am-hoja" data-v="leer">${icoUI("handshake")} Leer un libro con amigos</button><button class="btn-ghost" data-action="lj-ir">Ir a Lecturas</button>`)}`;
}
/* + Nuevo: qué crear con tus amigos */
function atHojaNuevo() {
  const op = (accion, ico, t, s, mas) => `<button type="button" class="at-op" data-action="${accion}"${mas || ""}><span class="pl-ico">${icoUI(ico)}</span>
    <span class="at-op__t"><b>${t}</b><span class="text-xs muted">${s}</span></span>${icoUI("chevron")}</button>`;
  return `<div class="at-ops">
    ${PLAN.error !== "sin-servidor" ? op("pl-nuevo", "ticket", "Un plan", "Juntarse: una película, comer, salir a correr.") : ""}
    ${CONJ.error !== "sin-servidor" ? op("cj-nuevo", "handshake", "Un hábito", "Lo hacen juntos y suman una racha.") : ""}
    ${OBJ.error !== "sin-servidor" ? op("oj-nuevo", "mision", "Un objetivo", "Una meta con avance sumado.") : ""}
    ${LCOM.error !== "sin-servidor" ? op("lc-nueva", "listas", "Una lista", "Películas por ver, restaurantes por probar…") : ""}
    ${LJ.error !== "sin-servidor" ? op("am-hoja", "book-open", "Una lectura", "El mismo libro, cada uno a su ritmo.", ` data-v="leer"`) : ""}</div>`;
}
/* Leer con amigos: tus libros (de Lecturas) que todavía lees solo */
function atHojaLeer() {
  const libros = (STATE.lecturas || []).filter(b => !b.juntos && b.estado !== "terminado").sort((a, b) => (b.estado === "leyendo") - (a.estado === "leyendo"));
  return libros.length ? `<p class="text-sm muted" style="margin:0 0 4px">¿Cuál quieres leer con amigos?</p><div class="at-ops">${libros.map(b => `<button type="button" class="at-op" data-action="lj-nueva" data-libro="${escapeHtml(b.id)}">
      <span class="pl-ico">${icoUI("book-open")}</span><span class="at-op__t"><b>${escapeHtml(b.titulo)}</b><span class="text-xs muted">${escapeHtml([b.autor, b.estado === "leyendo" ? "Leyendo" : "Por leer"].filter(Boolean).join(" · "))}</span></span>${icoUI("chevron")}</button>`).join("")}</div>`
    : `${atVacio("Primero agrega el libro en Lecturas. Desde ahí, ábrelo y toca «Leerlo con un amigo».")}${atPie(`<button class="btn btn--soft" data-action="lj-ir">Ir a Lecturas</button>`)}`;
}
/* Qué hoja es: el título y lo de adentro */
function atHoja(k) {
  const l = AMIGOS.lista; if (!l) return null;
  const amigos = l.amigos || [];
  if (k === "planes") return { titulo: "🎟️ Planes", cuerpo: atHojaPlanes(amigos) };
  if (k === "habitos") return { titulo: "🤝 Hábitos con amigos", cuerpo: atHojaHabitos(amigos) };
  if (k === "objetivos") return { titulo: "🎯 Objetivos con amigos", cuerpo: atHojaObjetivos(amigos) };
  if (k === "listas") return { titulo: "📋 Listas con amigos", cuerpo: atHojaListas(amigos) };
  if (k === "lecturas") return { titulo: "📖 Leyendo juntos", cuerpo: atHojaLecturas() };
  if (k === "amigos") return { titulo: "Tus amigos", cuerpo: amigosHoyHtml(l) };
  if (k === "ajustes") return { titulo: "Ajustes de Amigos", cuerpo: amigosInvitarHtml(true) + amigosMuestraHtml(l, true) };
  if (k === "nuevo") return { titulo: "Nuevo con amigos", cuerpo: atHojaNuevo() };
  if (k === "leer") return { titulo: "📖 Leer con amigos", cuerpo: atHojaLeer() };
  return null;
}
function atHojaEnvuelta(k, cuerpo) { return `<div id="at-hoja" class="at-hoja" data-hoja="${k}">${cuerpo}</div>`; }
function openAmigosHoja(k) {
  const h = atHoja(k); if (!h) return;
  if (k === "planes" && AT.hoja !== "planes") AT.pestana = "proximos";
  AT.hoja = k;
  openModal(h.titulo, atHojaEnvuelta(k, h.cuerpo));
}
/* Pone al día la hoja abierta, si sigue abierta (lo que estás escribiendo en ella se queda, con el foco) */
function atRefrescarHoja() {
  if (!AT.hoja) return;
  const body = document.getElementById("modalBody"), el = document.getElementById("at-hoja");
  if (!body || document.getElementById("modalOverlay").hidden || !el || el.dataset.hoja !== AT.hoja) { AT.hoja = null; return; }
  const a = document.activeElement, escribe = a && body.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "checkbox"));
  if (escribe && !a.id) return;
  const foco = escribe ? { id: a.id, v: a.value, i: a.selectionStart, f: a.selectionEnd } : null;
  const h = atHoja(AT.hoja); if (!h) return;
  body.innerHTML = iconizar(atHojaEnvuelta(AT.hoja, h.cuerpo));
  const x = foco && document.getElementById(foco.id);
  if (x) { x.value = foco.v; x.focus(); try { x.setSelectionRange(foco.i, foco.f); } catch (e) {} }
}
