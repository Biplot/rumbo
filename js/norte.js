/* ============================================================
   RUMBO · 🧭 Norte, tu brújula: el robot de voz del escritorio
   (En la interfaz se llama «Norte, tu brújula» porque «Norte» ya es un tema visual.)
   · Su pantalla, «Norte, tu brújula» (#norte, renderNorte; se llega desde Cuenta, el menú de tu cuenta y «Más»): los aparatos,
     tus alarmas (settings.norte.alarmas), los avisos de Norte, el modo noche, Norte aburrido y la pregunta «¿A qué hora te
     despierto?» al cerrar el día (settings.norte.ajustes). Editar hábito trae «Recordar a las…» (h.hora).
   · Conectar: en esa pantalla (solo la cuenta dueña, esCuentaDuena en app.js) se pide un código
     de 6 dígitos (norte_crear_codigo, dura 10 minutos y sirve una vez) que se ingresa en Norte. Mientras el
     código está a la vista, la lista de aparatos se revisa cada 5 segundos para avisar cuando Norte se conectó.
     Cada aparato se puede desconectar (su token deja de servir).
   · La bandeja: lo que le pides a Norte (api/norte.js → notifier/norte.mjs) no toca tu documento en el
     servidor. Hábitos, tareas, notas, abrir y cerrar el día esperan en norte_pendientes (supabase/norte.sql)
     y el agua en agua_pendientes (la suma agua-juntos.js, igual que «+ Un vaso» del aviso). Al abrir la app
     y al volver a ella, nortePendientes los toma (quedan reservados 2 minutos para este equipo; si no se pueden aplicar
     al tiro, se reintenta a los 5 segundos con lo ya tomado), los aplica
     con las funciones de la app, sube tu documento y recién ahí los confirma (se borran). Si la app se
     cierra a mitad, vuelven en 2 minutos; cada pedido aplicado queda en STATE.norte.hechos (21 días,
     se fusiona entre equipos con norteMerge en store.js), así ninguno se aplica dos veces.
   · Cómo se aplica cada uno (norteAplicar, sin pantalla, se prueba en tests/norte.test.mjs):
       habito  como marcarlo a mano en la fecha del pedido (toggleHabitDate en app.js): +5 ⭐ «habito:<id>:<fecha>»
               y +20 ⭐ si cumple la cuota «habito-meta:…»; después riega tu jardín y avisa a tus amigos si es en conjunto
       tarea   nuevaTarea (agenda.js) en el día del pedido, o en hoy si ya pasó; id fijo «nt<pedido>»
       nota    como notaCrear (notas.js), con sus #etiquetas; id fijo «nn<pedido>»
       abrir   la apertura corta (aplicarAperturaExpress): +25 ⭐ «ritual-apertura:<fecha>» la primera vez
       cerrar  el cierre corto sin elegir nada (aplicarCierreExpress): las pendientes pasan a mañana, el ánimo y
               la gratitud van al diario, +20 ⭐ «ritual-cierre:<fecha>» la primera vez y la nota de tu elefante
       Con «completo» (Norte-Desk) son los rituales enteros, como saveRitual y saveCierre (modules2.js), con sus ⭐:
       abrir   misión, bocado, pilar (y su contador), energía, a quién sirves, proyectos y las tareas del día (las nuevas,
               con id fijo «na<pedido><n>»; las que quitaste se borran, menos las que vienen de otros días): +50 ⭐
       cerrar  qué pasa con cada pendiente (mañana, otro día, delegar, soltar o «la hice», +15 ⭐ «tarea:<id>»; las que
               no se decidieron pasan a mañana), si cumpliste tu misión, el bocado, la energía, lo mejor del día, una
               cosa para mañana (la misión que te propone al abrir) y la nota (al diario, con el ánimo): +40 ⭐
       Fase 2 (norteAplicarFase2): alarmas (si su ts es más nuevo que settings.norte.alarmas.ts, las reemplaza) ·
       recordatorio (crear con id «nr<pedido>», avisado, borrar: quedan marcados en settings.norte.recordatorios) ·
       tarea_mover (a mañana con moverTarea y copia «nm<pedido>0», delegar o soltar) · alcancia (alcAportar, aporte
       «nk<pedido>»; los premios con alcRevisar) · diario (entrada «nd<pedido>», +10 ⭐ «diario:<id>») · lectura (la
       página y un foco de lectura «nl<pedido>» con libroId, +5 ⭐ como un foco)
     Los ids del libro de ⭐ son los mismos que al hacerlo a mano: marcar por voz y en la app no paga dos veces.
     La tarea del bocado, las que pasan a mañana y la entrada del diario también llevan id fijo («nb…», «nc…»,
     «dia<fecha>»): si dos equipos aplican el mismo pedido a la vez, al juntarse queda una de cada una.
   ============================================================ */
const NORTE = { corriendo: false, codigo: "", expira: 0, antes: [], reloj: 0, revisar: 0, alFoco: null, aparatos: null, cargando: false, creando: false, error: null,
  tomados: new Map(), reintento: 0, reintentos: 0 };
const NORTE_HECHOS_DIAS = 21, NORTE_HECHOS_MAX = 400, NORTE_TEXTO = 200, NORTE_NOTA = 600, NORTE_NOTA_LARGA = 1000;
/* El ritual completo da lo mismo que en la app (saveRitual y saveCierre en modules2.js); sus pilares son PILARES */
const NORTE_RITUAL = { apertura: 50, cierre: 40 };
const NORTE_PILARES = ["Psicología", "Fisiología", "Productividad", "Magnetismo", "Presencia", "Propósito"];
/* Lo que no se encuentra todavía (una tarea o un hábito que llega de otro equipo) se queda en la bandeja y se
   reintenta hasta 2 días; con la app abierta, la bandeja se revisa cada 20 segundos y al volver a su ventana */
const NORTE_ESPERA_MS = 2 * 864e5, NORTE_REVISAR_MS = 20e3, NORTE_ESPERAR = Object.freeze({ esperar: true });
/* Lo que se toma de la bandeja queda reservado 2 minutos para este equipo (norte_pendientes_tomar). Si en esa vuelta no se
   pudo aplicar (otra sincronización en curso, cambios sin subir, una ventana abierta o sin conexión), se guarda en
   NORTE.tomados y se reintenta a los 5 segundos con lo mismo, mientras la reserva siga siendo suya (con margen): antes
   había que esperar a que se liberara, y abrir el día con Norte tardaba minutos en aparecer (Chris, 2026-11-15) */
const NORTE_RESERVA_MS = 100e3, NORTE_REINTENTO_MS = 5e3, NORTE_REINTENTOS = 6;

/* Solo la cuenta dueña ve a Norte (y solo ella revisa la bandeja) */
function norteDisponible() { return typeof esCuentaDuena === "function" && esCuentaDuena(); }

/* STATE.norte = { hechos: [{ id, ts }] }: los pedidos de la bandeja ya resueltos en este documento */
function norteDatos(S) {
  S = S || STATE;
  if (!S.norte || typeof S.norte !== "object") S.norte = { hechos: [] };
  if (!Array.isArray(S.norte.hechos)) S.norte.hechos = [];
  return S.norte;
}
function norteLimpiarHechos(S, now) {
  const N = norteDatos(S), corte = (now || Date.now()) - NORTE_HECHOS_DIAS * 864e5;
  N.hechos = N.hechos.filter(x => x && x.id && (x.ts || 0) >= corte).slice(-NORTE_HECHOS_MAX);
}
/* Para comparar tareas: sin tildes, mayúsculas, signos ni espacios de más (como normalizar en notifier/norte.mjs) */
const norteNorm = v => String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const norteMisma = (a, b) => { const n = norteNorm(a); return !!n && n === norteNorm(b); };
const norteLineas = (v, max) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ").replace(/[ \t]+/g, " ")
  .split("\n").map(l => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max || NORTE_TEXTO);
const norteTexto = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || NORTE_TEXTO);
/* Las tareas que crea un pedido (el bocado al abrir, las que pasan a mañana al cerrar) llevan id fijo:
   si dos equipos aplican el mismo pedido a la vez, al juntarse queda una de cada una */
function norteTareasAntes(S, dias) { const s = new Set(); dias.forEach(d => (agendaDias(S)[d] || []).forEach(t => t && s.add(t.id))); return s; }
function norteFijarIds(S, dias, antes, prefijo) {
  const nuevas = [];
  dias.forEach(d => (agendaDias(S)[d] || []).forEach(t => { if (t && !antes.has(t.id)) nuevas.push(t); }));
  nuevas.sort((a, b) => String(a.origen || "").localeCompare(String(b.origen || "")) || String(a.txt || "").localeCompare(String(b.txt || "")))
    .forEach((t, k) => { const id = prefijo + k.toString(36); if (t.origen === t.id) t.origen = id; t.id = id; });
}
/* La fecha del pedido (el día de la persona cuando se lo dijo a Norte); nunca después de hoy */
function norteFecha(f, hoy) { f = String(f || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(f) ? (f > hoy ? hoy : f) : hoy; }

/* -------- Lógica (sin pantalla, se puede testear) -------- */
/* Aplica la bandeja al estado. Devuelve { hechos: ids para confirmar, nuevos: cuántos se anotaron recién en
   STATE.norte.hechos, aplicados: lo que cambió algo, esperan: ids que se quedan en la bandeja, estrellas }.
   Lo ya aplicado (en este equipo u otro) no se repite. */
function norteAplicar(lista, S, op) {
  S = S || STATE; op = op || {};
  const hoy = op.hoy || todayISO(), now = op.now || Date.now(), N = norteDatos(S), ya = new Set(N.hechos.map(x => x && x.id));
  const res = { hechos: [], nuevos: 0, aplicados: [], esperan: [], estrellas: 0 };
  (Array.isArray(lista) ? lista : []).filter(p => p && typeof p === "object")
    .slice().sort((a, b) => String(a.creado || "").localeCompare(String(b.creado || "")))
    .forEach(p => {
      const id = String(p.id || "");
      if (!/^[a-z0-9]{8,40}$/.test(id) || res.hechos.includes(id) || res.esperan.includes(id)) return;
      if (ya.has(id)) { res.hechos.push(id); return; }   // ya resuelto antes (aquí o en otro equipo): se confirma
      const ef = norteAplicarUno(p, S, hoy, now);
      // Lo que este documento todavía no tiene (la tarea recién creada en otro equipo): no se confirma ni se anota,
      // así sigue en la bandeja y se aplica en la próxima vuelta
      if (ef === NORTE_ESPERAR) { res.esperan.push(id); return; }
      res.hechos.push(id);                                // resuelto (ahora o descartado): se confirma
      ya.add(id);
      N.hechos.push({ id, ts: now }); res.nuevos++;
      if (ef) { res.aplicados.push(ef); res.estrellas += ef.estrellas || 0; }
    });
  norteLimpiarHechos(S, now);
  return res;
}
function norteAplicarUno(p, S, hoy, now) {
  const d = p.datos && typeof p.datos === "object" ? p.datos : {}, iso = norteFecha(d.fecha, hoy), creadoTs = Date.parse(p.creado) || now;
  const reciente = now - creadoTs < NORTE_ESPERA_MS;   // si no se encuentra, ¿se espera o se descarta?
  if (p.tipo === "habito") {
    const h = ((S.habitos && S.habitos.defs) || []).find(x => x && x.id === d.hid);
    if (!h) return reciente ? NORTE_ESPERAR : null;            // todavía no llega a este documento (o lo borraste)
    if (h.pausado || hmMeta(h) !== "hacer") return null;        // está en pausa o es de dejar o reducir
    if (hmMarcado(h, iso, S)) return null;                       // ya lo marcaste (a mano o en otro equipo)
    const m = norteMarcarHabito(S, h, iso, now);
    return { tipo: "habito", hid: h.id, nombre: h.nombre || "tu hábito", iso, cuota: m.cuota, estrellas: m.estrellas };
  }
  if (p.tipo === "tarea_hecha") {   // Norte-Desk: completar una tarea de hoy, como tocarla en la app (+15 ⭐ «tarea:<id>»)
    const tid = String(d.tid || ""), t = tid && (buscarTarea(S, iso, tid) || buscarTarea(S, hoy, tid));
    if (!t) return tid && reciente ? NORTE_ESPERAR : null;      // creada en otro equipo y todavía no llega aquí
    if (t.borrada || estadoTarea(t) === "hecha") return null;
    marcarTarea(t, "hecha", { hechaTs: creadoTs });
    const pagado = ledgerRegistrar(S, "tarea:" + t.id, 15, 15, "Tarea con Norte", now);
    return { tipo: "tarea_hecha", txt: t.txt, iso, estrellas: pagado ? 15 : 0 };
  }
  if (p.tipo === "foco") {   // Norte-Desk: una sesión de foco, con id fijo «nf<pedido>» (dos equipos no la duplican)
    const min = Math.round(+d.min);
    if (!(min >= 1 && min <= 600)) return null;
    const E = focoDatos(S), fid = "nf" + p.id;
    if (E.sesiones.some(x => x && x.id === fid)) return null;
    const h = d.hid && ((S.habitos && S.habitos.defs) || []).find(x => x && x.id === d.hid);
    const t = d.tid && (buscarTarea(S, iso, d.tid) || buscarTarea(S, hoy, d.tid));
    const ini = +d.ini || (creadoTs - min * 60e3);
    const rec = { id: fid, fecha: iso, ts: now, ini, hora: new Date(ini).getHours(), min, real: min, completa: !!d.completa,
      tipo: h ? "habito" : t ? "tarea" : "libre", ref: h ? h.id : t ? t.id : "", titulo: norteTexto(d.titulo) || (h ? h.nombre : t ? t.txt : "Tiempo de foco"),
      ritmo: "una", con: "Norte-Desk" };
    if (h) rec.habId = h.id;
    if (t) rec.tareaId = t.id;
    E.sesiones.push(rec);
    let estrellas = focoDarEstrellas(S, rec) ? FOCO_ESTRELLAS : 0, habito = null;
    // como focoAlTerminar (foco-pantalla.js): un hábito con tiempo queda marcado al completar sus minutos de hoy
    if (h && +h.minutos > 0 && !h.pausado && hmMeta(h) === "hacer" && !hmMarcado(h, iso, S) && focoMinHabito(S, h.id, iso) >= +h.minutos) {
      estrellas += norteMarcarHabito(S, h, iso, now).estrellas;
      habito = h.nombre || "tu hábito";
    }
    return { tipo: "foco", min, iso, habito, estrellas };
  }
  if (p.tipo === "tarea") {
    const txt = norteTexto(d.texto), dia = iso < hoy ? hoy : iso, tid = "nt" + p.id;
    if (!txt || buscarTarea(S, dia, tid)) return null;
    // si ya la tienes ese día (escrita igual, aunque cambien mayúsculas o tildes), no se duplica
    if (tareasDelDia(dia, S).some(t => !t.borrada && tareaAbierta(t) && norteMisma(t.txt, txt))) return null;
    const t = nuevaTarea(S, dia, { txt, ambito: d.ambito === "pro" ? "pro" : "per", origen: tid });
    t.id = tid; t.ts = now;
    return { tipo: "tarea", txt, iso: dia, estrellas: 0 };
  }
  if (p.tipo === "nota") {
    const txt = norteLineas(d.texto, NORTE_NOTA_LARGA), nid = "nn" + p.id;   // una nota puede ser larga y con líneas («anota esto»)
    S.postits = Array.isArray(S.postits) ? S.postits : [];
    if (!txt || S.postits.some(n => n && n.id === nid)) return null;
    S.postits.push({ id: nid, titulo: "", texto: txt, etiquetas: typeof etiquetasDe === "function" ? etiquetasDe(txt) : [], fijada: false, color: "", archivada: false, ts: now });
    return { tipo: "nota", txt, estrellas: 0 };
  }
  if (p.tipo === "abrir") {
    S.ritual.dias = S.ritual.dias || {};
    const r0 = S.ritual.dias[iso], e = Math.round(+d.energia);
    let sapo = norteTexto(d.primer_bocado);
    if (r0 && r0.cerrado) return null;            // ya lo cerraste: por voz no se reabre
    if (r0 && r0.hecho && !sapo) return null;      // ya estaba abierto y no trae un bocado nuevo
    if (d.completo) return norteAbrirCompleto(p, S, iso, d, creadoTs, now);
    const yaEsta = sapo && tareasDelDia(iso, S).find(t => !t.borrada && ["pendiente", "hecha"].includes(estadoTarea(t)) && norteMisma(t.txt, sapo));
    if (yaEsta) sapo = yaEsta.txt;                 // la tarea que ya tenías (aunque la dijeras con otras mayúsculas o tildes)
    const antes = norteTareasAntes(S, [iso]);
    const nuevo = aplicarAperturaExpress(S, iso, { sapo, ambito: d.ambito === "per" ? "per" : "pro", energia: e >= 1 && e <= 5 ? e : 3 });
    norteFijarIds(S, [iso], antes, "nb" + p.id);   // la tarea del bocado, si se creó
    if (nuevo) S.ritual.dias[iso].abiertoTs = creadoTs;   // la hora en que se lo dijiste a Norte
    const pagado = nuevo && ledgerRegistrar(S, "ritual-apertura:" + iso, EXPRESS_MONEDAS.apertura, EXPRESS_MONEDAS.apertura, "Apertura con Norte", now);
    return { tipo: "abrir", iso, nuevo, sapo, estrellas: pagado ? EXPRESS_MONEDAS.apertura : 0 };
  }
  if (p.tipo === "cerrar") {
    const r = S.ritual.dias && S.ritual.dias[iso];
    if (!r || !r.hecho) return { tipo: "cerrar-sin-abrir", iso, estrellas: 0 };
    if (r.cerrado) return null;
    // la entrada del diario de ese día, con id fijo (si no estaba): dos equipos no la duplican
    S.vida.diario = S.vida.diario || [];
    if (!S.vida.diario.some(x => x && x.fecha === iso && x.fromRitual)) S.vida.diario.push({ id: "dia" + iso.replace(/-/g, ""), fecha: iso, fromRitual: true, ts: now });
    if (d.completo) return norteCerrarCompleto(p, S, iso, d, hoy, creadoTs, now);
    const m = Math.round(+d.animo), destinos = [...new Set([hoy, agSumar(iso, 1)])], antes = norteTareasAntes(S, destinos);
    const { nuevo, n } = aplicarCierreExpress(S, iso, { mood: m >= 1 && m <= 5 ? m : 3, gratitud: norteTexto(d.gratitud), elecciones: {} });
    norteFijarIds(S, destinos, antes, "nc" + p.id);   // las pendientes que pasaron a mañana (o a hoy, si el día ya pasó)
    if (nuevo) r.cerradoTs = creadoTs;   // a qué hora cerraste (insignias Noche Serena y Búho)
    const pagado = nuevo && ledgerRegistrar(S, "ritual-cierre:" + iso, EXPRESS_MONEDAS.cierre, EXPRESS_MONEDAS.cierre, "Cierre con Norte", now);
    if (nuevo && typeof notaElefanteGuardar === "function") notaElefanteGuardar(iso, S);   // 🐘 la nota de tu elefante
    return { tipo: "cerrar", iso, nuevo, n, estrellas: pagado ? EXPRESS_MONEDAS.cierre : 0 };
  }
  return norteAplicarFase2(p, S, d, iso, hoy, now, creadoTs, reciente);
}
/* Fase 2 (2026-11-20): alarmas, recordatorios, mover una tarea, alcancía, diario y lectura */
function norteAplicarFase2(p, S, d, iso, hoy, now, creadoTs, reciente) {
  if (p.tipo === "alarmas") {   // las que cambiaste en el robot: si son más nuevas que las de Rumbo, las reemplazan
    const N = norteAjustes(S), ts = Math.round(+d.ts);
    if (!(ts > 0) || ts <= (+(N.alarmas && N.alarmas.ts) || 0)) return null;
    N.alarmas = norteAlarmasDe(Object.assign({}, d, { ts }));
    return { tipo: "alarmas", estrellas: 0 };
  }
  if (p.tipo === "recordatorio") {   // iguales en Norte-Desk y el robot: crear (id fijo «nr<pedido>»), ya avisado o borrar
    const N = norteAjustes(S), id = String(d.id || "");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
    const r = N.recordatorios.find(x => x && x.id === id);
    if (d.op === "crear") {
      const que = norteTexto(d.que), cuando = Math.round(+d.cuando);
      if (r || !que || !(cuando > 0)) return null;
      N.recordatorios.push({ id, que, cuando, avisado: false, ts: now });
      norteLimpiarRecordatorios(S, now);
      return { tipo: "recordatorio", op: "crear", que, estrellas: 0 };
    }
    if (!r || !["avisado", "borrar"].includes(d.op)) return null;   // uno que solo vivía en Norte-Desk: nada que hacer aquí
    if (d.op === "avisado") { if (r.avisado) return null; r.avisado = true; }
    else { if (r.borrado) return null; r.borrado = true; }   // queda marcado (así otro equipo no lo trae de vuelta)
    r.ts = now;
    return { tipo: "recordatorio", op: d.op, estrellas: 0 };
  }
  if (p.tipo === "tarea_mover") {   // posponer, delegar o soltar, como en la app (agenda.js)
    const tid = String(d.tid || ""), destino = d.destino;
    if (!["manana", "delegar", "soltar"].includes(destino)) return null;
    let dia = iso, t = tid && buscarTarea(S, iso, tid);
    if (!t && tid && hoy !== iso) { t = buscarTarea(S, hoy, tid); dia = hoy; }
    if (!t) return tid && reciente ? NORTE_ESPERAR : null;   // creada en otro equipo y todavía no llega aquí
    if (t.borrada || !tareaAbierta(t)) return null;           // ya la hiciste, la moviste o la soltaste
    if (destino === "manana") {
      // a mañana; si ese día ya pasó, a hoy (como triageCierreCfg). La copia lleva id fijo «nm<pedido>0»
      const hacia = dia < hoy ? hoy : agSumar(dia, 1), antes = norteTareasAntes(S, [hacia]);
      moverTarea(S, t, dia, hacia, "migrada", { hoy });
      norteFijarIds(S, [hacia], antes, "nm" + p.id);
    } else if (destino === "delegar") marcarTarea(t, "delegada", { delegadaA: norteTexto(d.a, 80) });
    else marcarTarea(t, "soltada");
    return { tipo: "tarea_mover", destino, txt: t.txt, iso: dia, estrellas: 0 };
  }
  if (p.tipo === "alcancia") {   // como «+» en la alcancía (alcAportar), con id fijo del aporte «nk<pedido>»
    if (typeof alcPorId !== "function" || typeof alcAportar !== "function") return null;
    const a = alcPorId(String(d.aid || ""), S), monto = Math.round(+d.monto), kid = "nk" + p.id;
    if (!a) return reciente ? NORTE_ESPERAR : null;
    a.aportes = Array.isArray(a.aportes) ? a.aportes : [];
    if (a.cerrada || (alcDatos(S).borradas || []).includes(a.id) || !(monto > 0) || a.aportes.some(x => x && x.id === kid)) return null;
    const x = alcAportar(a.id, monto, null, S, iso);
    if (!x) return null;
    x.id = kid; x.ts = creadoTs;
    return { tipo: "alcancia", aid: a.id, nombre: a.nombre || "tu alcancía", monto, estrellas: 0 };
  }
  if (p.tipo === "diario") {   // una entrada del Diario, tal cual la dictaste (como «Guardar» en el Diario: +10 ⭐ «diario:<id>»)
    const txt = norteLineas(d.texto, NORTE_NOTA_LARGA), did = "nd" + p.id;
    S.vida = S.vida || {};
    S.vida.diario = Array.isArray(S.vida.diario) ? S.vida.diario : [];
    if (!txt || S.vida.diario.some(x => x && x.id === did)) return null;
    S.vida.diario.push({ id: did, fecha: iso, texto: txt, gratitud: "", ts: now, con: "Norte" });
    const pagado = ledgerRegistrar(S, "diario:" + did, 10, 10, "Diario con Norte", now);
    return { tipo: "diario", iso, estrellas: pagado ? 10 : 0 };
  }
  if (p.tipo === "lectura") {   // la página del libro y, con minutos, un foco de lectura (libroId), id fijo «nl<pedido>»
    const l = (Array.isArray(S.lecturas) ? S.lecturas : []).find(x => x && x.id === String(d.lid || ""));
    if (!l) return reciente ? NORTE_ESPERAR : null;
    let pagina = null, min = Math.round(+d.min), estrellas = 0;
    if (d.pagina != null && Number.isFinite(+d.pagina)) {
      const pg = Math.max(0, Math.round(+d.pagina));
      pagina = +l.paginas > 0 ? Math.min(pg, +l.paginas) : Math.min(pg, 3000);
      if (pagina !== (+l.pagina || 0)) { l.pagina = pagina; l.ts = now; }
    }
    const E = focoDatos(S), fid = "nl" + p.id;
    if (min >= 1 && min <= 600 && !E.sesiones.some(x => x && x.id === fid)) {
      const ini = +d.ini || (creadoTs - min * 60e3);
      const rec = { id: fid, fecha: iso, ts: now, ini, hora: new Date(ini).getHours(), min, real: min, completa: d.completa !== false,
        tipo: "libro", ref: l.id, libroId: l.id, titulo: norteTexto(l.titulo, 120) || "Leer", ritmo: "una", con: "Norte" };
      E.sesiones.push(rec);
      if (focoDarEstrellas(S, rec)) estrellas += FOCO_ESTRELLAS;   // +5 ⭐ si es completa y de 10 minutos o más, como un foco
    } else min = 0;
    if (pagina == null && !min) return null;
    return { tipo: "lectura", lid: l.id, titulo: l.titulo || "tu libro", pagina, min, juntos: !!l.juntos, estrellas };
  }
  return null;
}
/* STATE.settings.norte = { alarmas: { ts, lista, dormir, amanecer, sonido }, recordatorios: [{ id, que, cuando, avisado, borrado?, ts }] }
   Entre equipos se fusionan con norteAjustesMerge (store.js): las alarmas, las más nuevas; los recordatorios, por id */
function norteAjustes(S) {
  S = S || STATE;
  S.settings = S.settings || {};
  if (!S.settings.norte || typeof S.settings.norte !== "object") S.settings.norte = {};
  if (!Array.isArray(S.settings.norte.recordatorios)) S.settings.norte.recordatorios = [];
  return S.settings.norte;
}
/* Los recordatorios avisados o borrados se olvidan 30 días después de su hora (antes no: así otro equipo no los revive) */
function norteLimpiarRecordatorios(S, now) {
  const N = norteAjustes(S), corte = (now || Date.now()) - 30 * 864e5;
  N.recordatorios = N.recordatorios.filter(r => r && r.id && !((r.avisado || r.borrado) && +r.cuando < corte)).slice(-200);
}
const NORTE_SONIDOS = [["campanas", "Campanas"], ["marimba", "Marimba"], ["pajaros", "Pájaros"], ["brujula", "La brújula"], ["ola", "La ola"]];
const NORTE_ALARMAS_MAX = 10, NORTE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
/* Una alarma como la entienden el robot y el servidor (alarmaLimpia en notifier/norte.mjs); null si viene mal */
function norteAlarmaLimpia(a) {
  if (!a || typeof a !== "object" || !/^[A-Za-z0-9_-]{1,40}$/.test(String(a.id || "")) || !NORTE_HORA.test(String(a.hora || ""))) return null;
  const dias = [...new Set((Array.isArray(a.dias) ? a.dias : []).map(Number))].filter(x => Number.isInteger(x) && x >= 0 && x <= 6).sort((x, y) => x - y);
  const fecha = !dias.length && /^\d{4}-\d{2}-\d{2}$/.test(String(a.fecha || "")) ? a.fecha : null;
  return { id: String(a.id), hora: a.hora, dias, fecha, nombre: norteTexto(a.nombre, 40), sonido: NORTE_SONIDOS.some(x => x[0] === a.sonido) ? a.sonido : null, activa: a.activa !== false };
}
function norteAlarmasDe(x) {
  const a = x && typeof x === "object" ? x : {}, am = a.amanecer == null ? null : Number(a.amanecer);
  return {
    ts: +a.ts > 0 ? Math.round(+a.ts) : 0,
    lista: (Array.isArray(a.lista) ? a.lista : []).map(norteAlarmaLimpia).filter(Boolean).slice(0, NORTE_ALARMAS_MAX),
    dormir: NORTE_HORA.test(String(a.dormir || "")) ? a.dormir : null,
    amanecer: Number.isInteger(am) && am >= 0 && am <= 30 ? am : 10,
    sonido: NORTE_SONIDOS.some(s => s[0] === a.sonido) ? a.sonido : "campanas",
  };
}
/* Tus alarmas (una copia: para cambiarlas, norteAlarmasCambiar) */
function norteAlarmas(S) { return norteAlarmasDe(norteAjustes(S).alarmas); }
/* Cambia tus alarmas con fn(A) y las guarda con la hora del cambio (ts): así el robot sabe que las de Rumbo son más nuevas */
function norteAlarmasCambiar(fn, S, now) {
  S = S || STATE;
  const A = norteAlarmas(S);
  if (fn(A) === false) return null;
  A.lista = A.lista.map(norteAlarmaLimpia).filter(Boolean).slice(0, NORTE_ALARMAS_MAX);
  A.ts = Math.max(now || Date.now(), A.ts + 1);
  norteAjustes(S).alarmas = A;
  return A;
}
/* El ritual de apertura completo (Norte-Desk), como saveRitual (modules2.js). Lo que no vino se queda como estaba. */
function norteAbrirCompleto(p, S, iso, d, creadoTs, now) {
  const prev = S.ritual.dias[iso] || {}, nuevo = !prev.hecho;
  const sapo = norteTexto(d.primer_bocado), ambito = d.ambito === "per" ? "per" : "pro", e = Math.round(+d.energia);
  const pilar = NORTE_PILARES.includes(d.pilar) ? d.pilar : "", mision = norteTexto(d.mision), servir = norteTexto(d.servir);
  const proyectos = (Array.isArray(d.proyectos) ? d.proyectos : []).map(x => norteTexto(x, 60)).filter(Boolean).slice(0, 8);
  const r = S.ritual.dias[iso] = Object.assign({}, prev, { sapo, sapoAmbito: ambito, energia: e >= 1 && e <= 5 ? e : prev.energia || 3, hecho: true, ts: now });
  if (mision) r.mision = mision;
  if (pilar) r.pilar = pilar;
  if (servir) r.servir = servir;
  if (proyectos.length) r.proyectos = proyectos;
  if (nuevo) r.abiertoTs = creadoTs;   // la hora en que lo abriste en Norte-Desk
  // Las tareas del día: se empareja por texto (conserva id, estado e historia), como en la app
  const viva = t => t && !t.borrada && ["pendiente", "hecha"].includes(estadoTarea(t));
  const vivas = () => tareasDelDia(iso, S).filter(viva);
  vivas().forEach(t => { if (t.esSapo && !norteMisma(t.txt, sapo)) { delete t.esSapo; t.ts = now; } });
  const crear = (txt, amb, tid, esSapo) => {
    if (buscarTarea(S, iso, tid)) return;
    const t = nuevaTarea(S, iso, Object.assign({ txt, ambito: amb, origen: tid }, esSapo ? { esSapo: true } : {}));
    t.id = tid; t.ts = now;
  };
  if (sapo) {
    const ex = vivas().find(t => norteMisma(t.txt, sapo));
    if (ex) { ex.esSapo = true; ex.ambito = ambito; delete ex.bocadoSugerido; ex.ts = now; }
    else crear(sapo, ambito, "nb" + p.id + "0", true);   // el mismo id que espera «hoy» (notifier/norte.mjs)
  }
  const vistos = new Set([norteNorm(sapo)]);
  (Array.isArray(d.tareas_nuevas) ? d.tareas_nuevas : []).slice(0, 15).forEach((x, k) => {
    const txt = norteTexto(x && x.texto), amb = x && x.ambito === "pro" ? "pro" : "per";
    if (!txt || vistos.has(norteNorm(txt))) return;
    vistos.add(norteNorm(txt));
    const ex = vivas().find(t => norteMisma(t.txt, txt));
    if (ex) { if (ambitoDe(ex) !== amb) { ex.ambito = amb; ex.ts = now; } }
    else crear(txt, amb, "na" + p.id + k.toString(36), false);
  });
  // Las que quitaste se borran; las que vienen de otros días (y el bocado) se quedan, como en la app
  (Array.isArray(d.tareas_quitar) ? d.tareas_quitar : []).slice(0, 30).forEach(id => {
    const t = buscarTarea(S, iso, String(id));
    if (viva(t) && !t.esSapo && !(t.migraciones > 0) && !t.bocadoSugerido) borrarTarea(t);
  });
  if (nuevo && pilar) { S.ritual.pilares = S.ritual.pilares || {}; S.ritual.pilares[pilar] = (S.ritual.pilares[pilar] || 0) + 1; }
  const pagado = nuevo && ledgerRegistrar(S, "ritual-apertura:" + iso, NORTE_RITUAL.apertura, NORTE_RITUAL.apertura, "Ritual de apertura con Norte", now);
  return { tipo: "abrir", iso, nuevo, sapo, completo: true, estrellas: pagado ? NORTE_RITUAL.apertura : 0 };
}
/* El ritual de cierre completo (Norte-Desk), como saveCierre (modules2.js) */
function norteCerrarCompleto(p, S, iso, d, hoy, creadoTs, now) {
  const r = S.ritual.dias[iso];
  // Como triageCierreCfg (app.js): si el día ya pasó, las pendientes van a hoy (nunca a otro día pasado)
  const cfg = iso < hoy ? { mover: "hoy", min: agSumar(hoy, -1) } : { mover: "manana", min: agSumar(iso, 1) };
  const pedidas = new Map((Array.isArray(d.pendientes) ? d.pendientes : []).filter(x => x && x.id).map(x => [String(x.id), x]));
  const decisiones = [], hechas = [];
  tareasDelDia(iso, S).filter(tareaAbierta).forEach(t => {
    const x = pedidas.get(t.id) || {}, v = ["manana", "otro", "delegar", "soltar", "hecha"].includes(x.v) ? x.v : "manana";
    if (v === "hecha") { hechas.push(t); return; }
    decisiones.push({ iso, id: t.id, v: v === "manana" ? cfg.mover : v, fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha || "") ? x.fecha : "",
      quien: norteTexto(x.quien, 80), bocado: !!x.bocado && (v === "manana" || v === "otro"), paso: "" });
  });
  // Las que pasan a otro día llevan id fijo «nc<pedido><n>»: dos equipos no las duplican
  const destinos = [...new Set([hoy, agSumar(iso, 1), agSumar(cfg.min, 1)].concat(decisiones.filter(x => x.v === "otro" && x.fecha > iso).map(x => x.fecha)))];
  const antes = norteTareasAntes(S, destinos);
  const n = aplicarTriage(S, decisiones, { base: iso, min: cfg.min });
  norteFijarIds(S, destinos, antes, "nc" + p.id);
  let estrellas = 0;
  hechas.forEach(t => {   // «la hice»: como completarla a mano (+15 ⭐ «tarea:<id>»)
    marcarTarea(t, "hecha", { hechaTs: creadoTs }); n.hechas++;
    if (ledgerRegistrar(S, "tarea:" + t.id, 15, 15, "Tarea con Norte", now)) estrellas += 15;
  });
  const bocado = tareasDelDia(iso, S).find(t => t.esSapo && !t.borrada), m = Math.round(+d.animo), e = Math.round(+d.energia);
  r.cierre = Object.assign({}, r.cierre, {
    sapo: bocado ? estadoTarea(bocado) === "hecha" : d.bocado === true,
    mejor: norteTexto(d.gratitud), manana: norteTexto(d.manana), nota: norteTexto(d.nota, NORTE_NOTA),
  });
  if (["si", "parcial", "no"].includes(d.mision)) r.cierre.mision = d.mision;
  if (e >= 1 && e <= 5) r.cierre.energia = e;
  if (tareasDelDia(iso, S).length) r.cierre.tareas = resumenCierre(S, iso);
  r.cerrado = true;
  r.cerradoTs = creadoTs;   // a qué hora cerraste (insignias Noche Serena y Búho)
  r.ts = now;
  // El diario de ese día: el ánimo, la nota y lo mejor del día
  const entrada = S.vida.diario.find(x => x && x.fecha === iso && x.fromRitual);
  entrada.mood = m >= 1 && m <= 5 ? m : entrada.mood || 3;
  entrada.texto = r.cierre.nota || "";
  entrada.gratitud = r.cierre.mejor || "";
  entrada.ts = now;
  if (ledgerRegistrar(S, "ritual-cierre:" + iso, NORTE_RITUAL.cierre, NORTE_RITUAL.cierre, "Ritual de cierre con Norte", now)) estrellas += NORTE_RITUAL.cierre;
  if (typeof notaElefanteGuardar === "function") notaElefanteGuardar(iso, S);   // 🐘 la nota de tu elefante
  return { tipo: "cerrar", iso, nuevo: true, n, completo: true, estrellas };
}
/* Marca un hábito en una fecha con sus ⭐ (y la cuota del período), como al marcarlo a mano */
function norteMarcarHabito(S, h, iso, now) {
  const dt = agDate(iso), key = monthKey(dt.getFullYear(), dt.getMonth());
  S.habitos.log[key] = S.habitos.log[key] || {};
  S.habitos.log[key][h.id] = S.habitos.log[key][h.id] || {};
  S.habitos.log[key][h.id][dt.getDate()] = true;
  let estrellas = ledgerRegistrar(S, "habito:" + h.id + ":" + iso, 5, 5, undefined, now) ? 5 : 0;
  const meta = hmMetaPeriodo(h, iso, S);   // la cuota del período, como actualizarMetaHabito (app.js)
  const cuota = meta.cumplido && ledgerRegistrar(S, "habito-meta:" + h.id + ":" + meta.key, 20, 20, "Cuota de " + h.nombre, now);
  if (cuota) estrellas += 20;
  return { estrellas, cuota: !!cuota };
}
/* El aviso al aplicar: «🧭 Norte marcó Meditar, anotó 2 tareas y cerró tu día · +45 ⭐» */
function norteResumen(res) {
  const ef = (res && res.aplicados) || [], de = t => ef.filter(x => x.tipo === t), partes = [];
  const fs = de("foco"), hs = de("habito").concat(fs.filter(x => x.habito).map(x => ({ nombre: x.habito }))), ts = de("tarea"), ns = de("nota"), th = de("tarea_hecha");
  if (hs.length) partes.push(hs.length === 1 ? `marcó ${hs[0].nombre}` : `marcó ${hs.length} hábitos`);
  if (th.length) partes.push(`completó ${th.length === 1 ? "una tarea" : th.length + " tareas"}`);
  if (fs.length) { const m = fs.reduce((a, x) => a + x.min, 0); partes.push(`guardó ${m} min de foco`); }
  if (ts.length) partes.push(`anotó ${ts.length === 1 ? "una tarea" : ts.length + " tareas"}`);
  if (ns.length) partes.push(`guardó ${ns.length === 1 ? "una nota" : ns.length + " notas"}`);
  if (de("abrir").length) partes.push("abrió tu día");
  if (de("cerrar").length) partes.push("cerró tu día");
  // fase 2 (los recordatorios avisados o borrados no se cuentan: ya los viste en Norte)
  const al = de("alarmas"), rc = de("recordatorio").filter(x => x.op === "crear"), mv = de("tarea_mover"), ak = de("alcancia"), di = de("diario"), le = de("lectura");
  if (al.length) partes.push("actualizó tus alarmas");
  if (rc.length) partes.push(`anotó ${rc.length === 1 ? "un recordatorio" : rc.length + " recordatorios"}`);
  if (mv.length) partes.push(mv.length === 1 ? (mv[0].destino === "manana" ? "pasó una tarea a mañana" : mv[0].destino === "delegar" ? "delegó una tarea" : "soltó una tarea") : `movió ${mv.length} tareas`);
  if (ak.length) { const t = ak.reduce((x, y) => x + y.monto, 0); partes.push(`guardó $${Math.round(t).toLocaleString("es-CL")} en ${ak.length === 1 ? ak[0].nombre : "tus alcancías"}`); }
  if (di.length) partes.push(di.length === 1 ? "escribió en tu diario" : `escribió ${di.length} entradas en tu diario`);
  if (le.length) partes.push(le.length === 1 && le[0].pagina != null ? `anotó la página ${le[0].pagina} de ${le[0].titulo}` : "anotó tu lectura");
  if (!partes.length) return de("cerrar-sin-abrir").length ? "🧭 Norte no pudo cerrar tu día: no estaba abierto" : "";
  const lista = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
  return `🧭 Norte ${lista}${res.estrellas ? ` · +${res.estrellas} ⭐` : ""}`;
}

/* -------- La bandeja: al abrir, al volver a la app y cada 20 segundos mientras se ve -------- */
async function nortePendientes() {
  if (typeof STATE === "undefined" || !STATE || !CURRENT_USER || NORTE.corriendo || !norteDisponible() || !BACKEND.nortePendientesTomar) return;
  NORTE.corriendo = true;
  let reintentar = false;
  try {
    // Primero se mira si hay algo (es barato); solo entonces se trae tu día. A lo recién tomado se suma lo que esta app
    // tomó en una vuelta anterior y no alcanzó a aplicar, mientras su reserva siga vigente
    const ahora = Date.now(), nuevos = await BACKEND.nortePendientesTomar();
    NORTE.tomados.forEach((x, id) => { if (x.hasta <= ahora) NORTE.tomados.delete(id); });
    if (Array.isArray(nuevos)) nuevos.forEach(p => { if (p && p.id) NORTE.tomados.set(String(p.id), { p, hasta: ahora + NORTE_RESERVA_MS }); });
    const lista = [...NORTE.tomados.values()].map(x => x.p);
    if (!lista.length || !STATE) return;
    // Lo tuyo sin subir se junta con la nube y llega lo de tus otros equipos, antes de aplicar. Si no se pudo traer
    // (sin conexión, cambios sin subir, otra sincronización en curso o una ventana abierta), se reintenta en unos segundos:
    // con un día viejo, una tarea creada en otro equipo no se encontraría
    if (typeof flushCloudSave === "function") await flushCloudSave();
    if (typeof syncFromCloud === "function" && !(await syncFromCloud())) { reintentar = true; return; }
    const res = norteAplicar(lista, STATE);
    if (res.nuevos) {
      saveState();
      norteEfectos(res);
      if (typeof flushCloudSave === "function") await flushCloudSave();
      // no alcanzó a subir: se reintenta (su id en STATE.norte.hechos evita aplicarlos otra vez) y se confirma al subir
      if (typeof _dirty !== "undefined" && _dirty) { reintentar = true; return; }
    }
    if (res.hechos.length && BACKEND.nortePendientesConfirmar) await BACKEND.nortePendientesConfirmar(res.hechos);
    res.hechos.concat(res.esperan).forEach(id => NORTE.tomados.delete(id));   // las que esperan vuelven solas a la bandeja
    NORTE.reintentos = 0;
  } catch (e) { console.warn("norte", e); reintentar = NORTE.tomados.size > 0; }
  finally {
    NORTE.corriendo = false;
    if (reintentar) norteReintentar(); else NORTE.reintentos = 0;
  }
}
/* Otra vuelta en unos segundos con lo que ya se tomó (hasta NORTE_REINTENTOS seguidas; después sigue la de cada 20 segundos) */
function norteReintentar() {
  if (typeof setTimeout !== "function" || NORTE.reintentos >= NORTE_REINTENTOS) return;
  NORTE.reintentos++;
  if (typeof clearTimeout === "function") clearTimeout(NORTE.reintento);
  NORTE.reintento = setTimeout(nortePendientes, NORTE_REINTENTO_MS);
}
/* Lo que hace la app después de marcar a mano (riega tu jardín, avisa a tus amigos) y el aviso */
function norteEfectos(res) {
  res.aplicados.forEach(ef => {
    if (ef.tipo === "alcancia") {   // los premios de la alcancía (llenarla, las paradas del viaje y la racha de ahorro), como al tocar «+»
      if (typeof alcRevisar === "function") alcRevisar(ef.aid);
      if (typeof alcRevisarRacha === "function") alcRevisarRacha();
      return;
    }
    if (ef.tipo === "lectura" && ef.juntos && ef.pagina != null && typeof ljAvance === "function") { ljAvance(ef.lid, ef.pagina, true); return; }   // lo lees con amigos
    if (ef.tipo !== "habito") return;
    if (typeof jardinAlMarcar === "function") jardinAlMarcar(ef.hid, true);
    if (typeof conjuntoAlMarcar === "function") conjuntoAlMarcar(ef.hid, ef.iso);
  });
  if (!res.aplicados.length) return;
  if (typeof updateTopbar === "function") updateTopbar();
  if (typeof refreshPts === "function") refreshPts(res.estrellas);
  if (typeof rerender === "function") rerender();
  const t = norteResumen(res);
  if (t) toast(t, !res.aplicados.some(x => x.tipo !== "cerrar-sin-abrir"));
}
/* Con Rumbo abierto al lado de Norte-Desk la pestaña nunca se esconde: por eso, además de al entrar y al volver,
   se revisa al volver a su ventana y cada 20 segundos mientras se ve */
function norteAlEntrar() {
  setTimeout(nortePendientes, 1500);
  clearInterval(NORTE.revisar);
  if (!norteDisponible()) return;
  setTimeout(() => { if (!Array.isArray(NORTE.aparatos)) norteCargarAparatos(); }, 4000);   // ¿hay un Norte? (la pregunta del despertador)
  const m = typeof document !== "undefined" && document.getElementById("cuentaMenuNorte");   // el menú de tu cuenta lleva a #norte
  if (m) m.hidden = false;
  NORTE.revisar = setInterval(() => { if (!document.hidden) nortePendientes(); }, NORTE_REVISAR_MS);
  if (!NORTE.alFoco) { NORTE.alFoco = () => { if (CURRENT_USER) norteAlVolver(); }; window.addEventListener("focus", NORTE.alFoco); }
}
function norteAlVolver() { setTimeout(nortePendientes, 1500); }   // después de que syncFromCloud trae lo último
/* Al salir de la cuenta: ni el código ni la lista quedan para quien entre después */
function norteOlvidar() {
  const m = typeof document !== "undefined" && document.getElementById("cuentaMenuNorte");
  if (m) m.hidden = true;
  clearInterval(NORTE.reloj);
  clearInterval(NORTE.revisar); NORTE.revisar = 0;
  if (typeof clearTimeout === "function") clearTimeout(NORTE.reintento);
  Object.assign(NORTE, { corriendo: false, codigo: "", expira: 0, antes: [], reloj: 0, aparatos: null, cargando: false, creando: false, error: null,
    tomados: new Map(), reintento: 0, reintentos: 0 });
}

/* -------- Cuenta › «Norte, tu brújula» -------- */
/* Cuenta › «Norte, tu brújula»: lleva a su pantalla */
function renderNorteCuenta() {
  if (!norteDisponible()) return "";
  return `<button type="button" class="card mt-16 cuenta-apariencia" data-route="norte">
    <span class="cuenta-apariencia__ico">${typeof iconoLinea === "function" ? iconoLinea("norte", 22) : "🧭"}</span>
    <span class="cuenta-apariencia__tx"><b>Norte, tu brújula</b><small>Tu robot del escritorio: conectarlo, tus alarmas, sus avisos y el modo noche</small></span>${typeof iconoLinea === "function" ? iconoLinea("chevron", 18) : ""}</button>`;
}
/* -------- La pantalla «Norte, tu brújula» (#norte): todo lo de Norte en un lugar --------
   1 Aparatos (conectar con código, la lista, desconectar) · 2 Tus alarmas · 3 Avisos de Norte · 4 Modo noche ·
   5 Norte aburrido · 6 La pregunta del despertador al cerrar el día. Solo la cuenta dueña (norteDisponible). */
function renderNorte() {
  if (!norteDisponible()) return `<div class="card"><div class="empty">Norte, tu brújula todavía no está disponible para tu cuenta.</div></div>`;
  setTimeout(() => { norteCargarAparatos(); if (NORTE.codigo && NORTE.expira > Date.now()) norteReloj(); }, 0);
  return `<div class="card" id="acc-norte">${norteCuentaHtml()}</div>
    <div id="norte-config">${norteConfigHtml()}</div>`;
}
function norteConfigHtml() {
  return `<div class="card mt-16">${norteAlarmasHtml()}</div>
    <div class="card mt-16" id="norte-avisos">${norteAvisosHtml()}</div>`;
}
function norteVenceTxt() {
  const s = Math.max(0, Math.round((NORTE.expira - Date.now()) / 1000));
  return `Vence en ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function norteFechaCorta(x) {
  const t = Date.parse(x);
  return t ? new Date(t).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "";
}
function norteCuentaHtml() {
  const vigente = NORTE.codigo && NORTE.expira > Date.now();
  return `<div class="flex-between" style="flex-wrap:wrap;gap:10px">
      <div style="min-width:0"><div class="card__title" style="font-size:15px">🧭 Norte, tu brújula</div>
        <div class="text-sm muted mt-8">Tu robot del escritorio: le hablas y anota en tu Rumbo. Marca hábitos, suma agua, anota tareas y notas, y abre o cierra tu día. Rumbo lo aplica al abrirse.</div></div>
      <button class="btn btn--soft" data-action="norte-conectar"${NORTE.creando ? " disabled" : ""}>${vigente ? "Pedir otro código" : "Conectar"}</button></div>
    ${vigente ? `<div class="norte-codigo mt-16" role="status">
      <span class="text-xs muted">Ingresa este código en Norte</span>
      <b class="norte-codigo__n" aria-label="Código ${NORTE.codigo.split("").join(" ")}">${NORTE.codigo.slice(0, 3)} ${NORTE.codigo.slice(3)}</b>
      <span class="text-xs muted" id="norte-vence">${norteVenceTxt()}</span></div>` : ""}
    ${norteListaHtml()}`;
}
function norteListaHtml() {
  if (NORTE.error === "sin-servidor") return `<p class="text-xs muted mt-8">Falta activar Norte en el servidor (supabase/norte.sql).</p>`;
  const l = NORTE.aparatos;
  if (!l) return NORTE.error ? `<p class="text-xs muted mt-8">No se pudo traer tus aparatos. Vuelve a abrir Cuenta en un rato.</p>` : "";
  if (!l.length) return `<p class="text-xs muted mt-8">Todavía no conectas ningún Norte.</p>`;
  return `<div class="norte-aparatos mt-16">${l.map(a => `<div class="flex-between norte-aparato">
      <div style="min-width:0"><b>${escapeHtml(a.nombre || "Norte")}</b>${a.aparato ? ` <span class="text-xs muted">· ${escapeHtml(String(a.aparato).slice(-8))}</span>` : ""}
        <div class="text-xs muted">Conectado el ${escapeHtml(norteFechaCorta(a.creado))} · ${a.ultimo_uso ? "te habló el " + escapeHtml(norteFechaCorta(a.ultimo_uso)) : "todavía no te habla"}</div></div>
      <button class="btn-ghost" data-action="norte-desconectar" data-id="${escapeAttr(a.id)}">Desconectar</button></div>`).join("")}</div>`;
}
function norteRepintar() {
  const ic = h => (typeof iconizar === "function" ? iconizar(h) : h);
  const el = document.getElementById("acc-norte"), cfg = document.getElementById("norte-config");
  if (el) el.innerHTML = ic(norteCuentaHtml());
  if (cfg) cfg.innerHTML = ic(norteConfigHtml());
}
function norteError(e) {
  return { limite: "Pediste muchos códigos. Espera un rato y vuelve a intentarlo.", "sin-servidor": "Falta activar Norte en el servidor (supabase/norte.sql).",
    red: "Sin conexión. Prueba de nuevo en un rato." }[e] || "No se pudo. Prueba de nuevo.";
}
async function norteCargarAparatos() {
  if (!CURRENT_USER || NORTE.cargando || !BACKEND.norteAparatos) return null;
  NORTE.cargando = true;
  const r = await BACKEND.norteAparatos();
  NORTE.cargando = false;
  if (!CURRENT_USER) return null;
  if (r && r.error) NORTE.error = r.error;
  else { NORTE.error = null; NORTE.aparatos = (Array.isArray(r) ? r : []).filter(a => a && a.id); norteRecordarHay(); }
  norteRepintar();
  return NORTE.aparatos;
}
async function norteConectar() {
  if (NORTE.creando || !BACKEND.norteCrearCodigo) return;
  NORTE.creando = true; norteRepintar();
  const r = await BACKEND.norteCrearCodigo();
  NORTE.creando = false;
  if (!r || r.error || !/^\d{6}$/.test(String(r.codigo || ""))) { norteRepintar(); return toast(norteError(r && r.error), true); }
  NORTE.codigo = String(r.codigo); NORTE.expira = Date.parse(r.expira) || Date.now() + 10 * 60e3;
  NORTE.antes = (NORTE.aparatos || []).map(a => a.id);
  norteRepintar(); norteReloj();
}
/* Mientras el código está a la vista: la cuenta regresiva y, cada 5 segundos, ¿ya se conectó Norte? */
function norteReloj() {
  clearInterval(NORTE.reloj);
  let n = 0;
  NORTE.reloj = setInterval(async () => {
    const el = document.getElementById("norte-vence");
    if (!el || !NORTE.codigo) { clearInterval(NORTE.reloj); return; }
    if (NORTE.expira <= Date.now()) { clearInterval(NORTE.reloj); NORTE.codigo = ""; norteRepintar(); return toast("El código venció. Pide otro cuando quieras.", true); }
    el.textContent = norteVenceTxt();
    if (++n % 5 || document.hidden) return;
    const l = await norteCargarAparatos();
    if (l && l.some(a => !NORTE.antes.includes(a.id))) {
      clearInterval(NORTE.reloj); NORTE.codigo = ""; norteRepintar();
      toast("🧭 Norte quedó conectado. Pregúntale cómo va tu día.");
    }
  }, 1000);
}
async function norteDesconectar(id) {
  if (!id || !BACKEND.norteDesconectar) return;
  if (!confirm("¿Desconectar este Norte? Dejará de anotar en tu Rumbo hasta que lo conectes de nuevo.")) return;
  const r = await BACKEND.norteDesconectar(id);
  if (r && r.error) return toast(norteError(r.error), true);
  NORTE.aparatos = (NORTE.aparatos || []).filter(a => a.id !== id);
  norteRecordarHay(); norteRepintar(); toast("🧭 Norte desconectado");
}
/* -------- Fase 2: ¿hay un Norte conectado? (para la pregunta del despertador al cerrar el día) -------- */
/* La lista de aparatos se trae al abrir Cuenta y al entrar a la app; entre visitas queda recordada en este equipo */
function norteClaveHay() { return "rumbo-norte-hay:" + ((typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.id) || "local"); }
function norteHayAparato() {
  if (!norteDisponible()) return false;
  if (Array.isArray(NORTE.aparatos)) return NORTE.aparatos.length > 0;
  try { return localStorage.getItem(norteClaveHay()) === "1"; } catch (e) { return false; }
}
function norteRecordarHay() {
  if (!Array.isArray(NORTE.aparatos)) return;
  try { if (NORTE.aparatos.length) localStorage.setItem(norteClaveHay(), "1"); else localStorage.removeItem(norteClaveHay()); } catch (e) {}
}

/* -------- Cuenta › «Norte, tu brújula» › Tus alarmas (F07) --------
   Viven en Rumbo (STATE.settings.norte.alarmas) y el robot las trae cada 15 minutos; cada cambio lleva la hora (ts) */
const NORTE_DIAS = [[1, "L", "Lunes"], [2, "M", "Martes"], [3, "M", "Miércoles"], [4, "J", "Jueves"], [5, "V", "Viernes"], [6, "S", "Sábado"], [0, "D", "Domingo"]];
const norteSonidoTxt = v => (NORTE_SONIDOS.find(x => x[0] === v) || [, "El de siempre"])[1];
/* «Lun a vie», «Todos los días», «Sáb y dom», «Una vez · vie 21 nov» */
function norteDiasTxt(a) {
  const d = a.dias;
  if (!d.length) return a.fecha ? `Una vez · ${typeof diaCorto === "function" ? diaCorto(a.fecha) : a.fecha}` : "Una vez";
  if (d.length === 7) return "Todos los días";
  if (d.join() === "1,2,3,4,5") return "De lunes a viernes";
  if (d.join() === "0,6") return "Sábado y domingo";
  const n = NORTE_DIAS.filter(x => d.includes(x[0])).map(x => x[2].slice(0, 3).toLowerCase());
  return n.length === 1 ? n[0] : n.slice(0, -1).join(", ") + " y " + n[n.length - 1];
}
function norteAlarmasHtml() {
  const A = norteAlarmas(), orden = A.lista.slice().sort((x, y) => x.hora.localeCompare(y.hora));
  const fila = a => `<div class="aviso norte-alarma${a.activa ? "" : " is-off"}">
      <div class="aviso__txt"><span class="aviso__t">${escapeHtml(a.hora)}${a.nombre ? ` · ${escapeHtml(a.nombre)}` : ""}</span>
        <span class="text-xs muted">${escapeHtml(norteDiasTxt(a))}${a.sonido ? " · " + escapeHtml(norteSonidoTxt(a.sonido)) : ""}</span></div>
      <button type="button" class="btn-link norte-alarma__cambiar" data-action="norte-alarma-editar" data-id="${escapeAttr(a.id)}">Cambiar</button>
      <label class="sw"><input type="checkbox" role="switch" data-action="norte-alarma-activa" data-id="${escapeAttr(a.id)}" ${a.activa ? "checked" : ""} aria-label="Alarma de las ${escapeAttr(a.hora)}"><span></span></label>
    </div>`;
  return `<div class="norte-alarmas" id="norte-alarmas">
    <div class="card__title" style="font-size:15px">⏰ Tus alarmas</div>
    <p class="text-xs muted" style="margin:4px 0 0">Suenan en tu Norte, con el amanecer en su pantalla antes de la hora. Si las cambias en Norte, aquí se ven igual.</p>
    ${orden.length ? orden.map(fila).join("") : `<p class="text-sm muted mt-8">Todavía no tienes alarmas.</p>`}
    ${A.lista.length < NORTE_ALARMAS_MAX ? `<button type="button" class="btn btn--soft mt-8" data-action="norte-alarma-nueva">+ Agregar alarma</button>` : `<p class="text-xs muted mt-8">Tienes las ${NORTE_ALARMAS_MAX} alarmas que caben en Norte.</p>`}
    <div class="aviso-grupo">🌙 Dormir y despertar</div>
    <div class="aviso">
      <div class="aviso__txt"><span class="aviso__t">Hora de dormir</span><span class="text-xs muted">Norte te propone cerrar el día y se queda en silencio hasta tu alarma.</span></div>
      <input class="input aviso__hora" type="time" id="norte-dormir" value="${escapeAttr(A.dormir || "")}" aria-label="Hora de dormir" onchange="norteDormir(this.value)">
    </div>
    <div class="aviso">
      <div class="aviso__txt"><span class="aviso__t">Amanecer</span><span class="text-xs muted">Los minutos antes de la alarma en que su pantalla se va iluminando. 0 es sin amanecer.</span></div>
      ${elContador("norte-amanecer", A.amanecer, { min: 0, max: 30, paso: 5, label: "Minutos de amanecer", unidad: "min", fn: "norteAmanecer" })}
    </div>
    <div class="field mt-8"><label>Sonido de tus alarmas</label>
      ${elLista("norte-sonido", NORTE_SONIDOS, A.sonido, { label: "Sonido de tus alarmas", hoja: true, fn: "norteSonido" })}</div>
  </div>`;
}
function norteGuardarAlarmas(fn, aviso) {
  const A = norteAlarmasCambiar(fn);
  if (!A) return null;
  saveState(); norteRepintar();
  if (aviso) toast(aviso);
  return A;
}
function norteDormir(v) { norteGuardarAlarmas(A => { const n = NORTE_HORA.test(v || "") ? v : null; if (A.dormir === n) return false; A.dormir = n; }); }
function norteAmanecer(v) { norteGuardarAlarmas(A => { const n = Math.max(0, Math.min(30, Math.round(+v || 0))); if (A.amanecer === n) return false; A.amanecer = n; }); }
function norteSonido(v) { norteGuardarAlarmas(A => { if (!NORTE_SONIDOS.some(x => x[0] === v) || A.sonido === v) return false; A.sonido = v; }); }
/* La próxima fecha de una alarma de una vez: hoy si su hora todavía no pasa, si no mañana */
function norteFechaUnaVez(hora) {
  const hoy = todayISO(), d = new Date(), ahora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return hora > ahora ? hoy : agSumar(hoy, 1);
}
/* La hoja para agregar o cambiar una alarma */
let NORTE_ALARMA = null;
function openNorteAlarma(id) {
  const a = id ? norteAlarmas().lista.find(x => x.id === id) : null;
  if (id && !a) return;
  NORTE_ALARMA = a ? a.id : null;
  openModal(a ? "Cambiar alarma" : "Nueva alarma", `
    <div class="field"><label for="na-hora">Hora</label><input class="input" type="time" id="na-hora" value="${escapeAttr(a ? a.hora : "07:00")}" style="max-width:180px"></div>
    <div class="field"><label for="na-nombre">Nombre <span class="text-xs muted">(opcional)</span></label>
      <input class="input" id="na-nombre" maxlength="40" value="${escapeAttr(a ? a.nombre : "")}" placeholder="Ej: Despertar, Remedio, Salir al trabajo"></div>
    <div class="field"><label>Días</label>
      ${elFichas(NORTE_DIAS.map(([v, l, n]) => [v, l, { aria: n }]), a ? a.dias : [1, 2, 3, 4, 5], { id: "na-dias", dias: true, label: "Días de la alarma" })}
      <div class="text-xs muted mt-8">Sin ningún día, suena una sola vez.</div></div>
    <div class="field"><label>Sonido</label>
      ${elLista("na-sonido", [["", "El de siempre"]].concat(NORTE_SONIDOS), a && a.sonido ? a.sonido : "", { label: "Sonido de esta alarma", hoja: true })}</div>
    <button class="btn btn--primary btn-block mt-8" data-action="norte-alarma-guardar">${a ? "Guardar cambios" : "Agregar alarma"}</button>
    ${a ? `<button class="btn-ghost btn-block mt-8" data-action="norte-alarma-borrar" data-id="${escapeAttr(a.id)}" style="color:var(--coral);border-color:var(--coral)">Borrar alarma</button>` : ""}`);
}
function norteAlarmaGuardar() {
  const hora = val("na-hora");
  if (!NORTE_HORA.test(hora || "")) return toast("Elige la hora de la alarma", true);
  const dias = [...document.querySelectorAll("#na-dias input:checked")].map(x => +x.value);
  const datos = { hora, dias, fecha: dias.length ? null : norteFechaUnaVez(hora), nombre: val("na-nombre"), sonido: val("na-sonido") || null };
  const id = NORTE_ALARMA;
  const A = norteGuardarAlarmas(A => {
    const a = id && A.lista.find(x => x.id === id);
    if (a) Object.assign(a, datos, { activa: true });
    else { if (A.lista.length >= NORTE_ALARMAS_MAX) return false; A.lista.push(Object.assign({ id: "al" + Date.now().toString(36), activa: true }, datos)); }
  });
  if (!A) return toast(`Caben ${NORTE_ALARMAS_MAX} alarmas en Norte`, true);
  NORTE_ALARMA = null; closeModal(); norteRepintar();
  toast(`⏰ Alarma de las ${hora} ${id ? "guardada" : "lista"}. Norte la tendrá en unos minutos.`);
}
function norteAlarmaBorrar(id) {
  if (!confirm("¿Borrar esta alarma? También se borra en tu Norte.")) return;
  norteGuardarAlarmas(A => { const n = A.lista.length; A.lista = A.lista.filter(x => x.id !== id); if (A.lista.length === n) return false; });
  NORTE_ALARMA = null; closeModal(); norteRepintar(); toast("Alarma borrada");
}
function norteAlarmaActiva(id, on) {
  norteGuardarAlarmas(A => {
    const a = A.lista.find(x => x.id === id); if (!a || a.activa === !!on) return false;
    a.activa = !!on;
    if (on && !a.dias.length && (!a.fecha || a.fecha < todayISO())) a.fecha = norteFechaUnaVez(a.hora);   // una de una vez que ya sonó: la próxima
  });
}

/* -------- Al cerrar el día: «¿A qué hora te despierto?» (F07, solo con un Norte conectado; es opcional) --------
   Es la alarma «despertar» (de una vez, para el día siguiente), con la hora de la última vez puesta */
function norteDespertarHtml(iso) {
  if (!norteHayAparato() || !norteAjustesVer().pregunta_cierre) return "";
  const manana = agSumar(iso, 1);
  if (manana < todayISO()) return "";
  const d = norteAlarmas().lista.find(a => a.id === "despertar"), on = !!(d && d.activa), hora = (d && d.hora) || "07:00";
  return `<div class="field norte-despertar"><label for="c-despertar">⏰ ¿A qué hora te despierto? <span class="text-xs muted">(opcional)</span></label>
    <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap">
      <input class="input" type="time" id="c-despertar" value="${escapeAttr(hora)}" style="width:140px" aria-label="Hora para despertar" oninput="document.getElementById('c-despertar-on').checked=true">
      <label class="row" style="gap:8px;align-items:center"><span class="sw" style="order:0"><input type="checkbox" role="switch" id="c-despertar-on" ${on ? "checked" : ""} aria-label="Que Norte me despierte"><span></span></span>
        <span class="text-sm">Que Norte me despierte</span></label></div></div>`;
}
function norteDespertarGuardar(iso) {
  const h = document.getElementById("c-despertar"), sw = document.getElementById("c-despertar-on");
  if (!h || !sw) return;
  const on = sw.checked, hora = h.value, fecha = agSumar(iso, 1);
  if (on && !NORTE_HORA.test(hora || "")) return;
  norteAlarmasCambiar(A => {
    const d = A.lista.find(a => a.id === "despertar");
    if (!on) { if (!d || !d.activa) return false; d.activa = false; return; }
    if (d && d.activa && d.hora === hora && d.fecha === fecha && !d.dias.length) return false;   // sin cambios
    if (d) Object.assign(d, { hora, dias: [], fecha, activa: true });
    else { if (A.lista.length >= NORTE_ALARMAS_MAX) return false; A.lista.push({ id: "despertar", hora, dias: [], fecha, nombre: "Despertar", sonido: null, activa: true }); }
  });
}

/* -------- Avisos de Norte, modo noche y lo demás (settings.norte.ajustes, con su ts) --------
   Lo que nunca se tocó viene encendido, con la noche automática (según tu hora de dormir y tu primera alarma). El robot los
   lee con la acción «ajustes» (o dentro de «alarmas»); pregunta_cierre es solo de la app. */
const NORTE_AJUSTES_DEF = { agua: true, agenda: true, habitos: true, amigos: true, planes: true, avisos_dia: true, aburrido: true, pregunta_cierre: true };
const NORTE_AVISOS = [
  ["agua", "💧 Tu agua", "Te recuerda tomar agua cada 90 minutos."],
  ["agenda", "📅 Tu agenda", "Te avisa 10 minutos antes de cada reunión."],
  ["habitos", "✅ Hábitos a su hora", "A la hora que pusiste en el hábito, si todavía no lo haces."],
  ["amigos", "🤝 Tus amigos", "Cuando te mandan ánimo o cumplen un hábito que hacen juntos."],
  ["planes", "🎉 Tus planes", "Unas 3 horas antes de cada plan con amigos."],
  ["avisos_dia", "🧭 Los avisos del día", "8:00 abrir tu día, 16:00 el agua, 20:00 tu racha y 21:00 cerrar el día."],
];
function norteAjustesVer(S) {
  const a = norteAjustes(S).ajustes || {}, n = a.noche && typeof a.noche === "object" ? a.noche : {}, out = { ts: +a.ts > 0 ? Math.round(+a.ts) : 0 };
  Object.keys(NORTE_AJUSTES_DEF).forEach(k => { out[k] = a[k] !== false; });
  out.noche = { auto: n.auto !== false, desde: NORTE_HORA.test(n.desde || "") ? n.desde : "23:00", hasta: NORTE_HORA.test(n.hasta || "") ? n.hasta : "07:00" };
  return out;
}
/* Cambia tus ajustes con fn(A) y los guarda con la hora del cambio */
function norteAjustesCambiar(fn, S, now) {
  S = S || STATE;
  const A = norteAjustesVer(S);
  if (fn(A) === false) return null;
  A.ts = Math.max(now || Date.now(), A.ts + 1);
  norteAjustes(S).ajustes = A;
  return A;
}
function norteAvisosHtml() {
  const A = norteAjustesVer(), sw = (k, on, titulo) => `<label class="sw"><input type="checkbox" role="switch" data-action="norte-ajuste" data-k="${k}" ${on ? "checked" : ""} aria-label="${escapeAttr(titulo)}"><span></span></label>`;
  const fila = (k, titulo, desc, on) => `<div class="aviso"><div class="aviso__txt"><span class="aviso__t">${titulo}</span><span class="text-xs muted">${desc}</span></div>${sw(k, on, titulo.replace(/^\S+\s/, ""))}</div>`;
  const hayNorte = norteHayAparato();
  return `<div class="card__title" style="font-size:15px">🔔 Avisos de Norte</div>
    <p class="text-xs muted" style="margin:4px 0 0">Lo que tu Norte te dice solo, sin que le preguntes.${hayNorte ? "" : " Conecta tu Norte arriba para que los use."}</p>
    ${NORTE_AVISOS.map(([k, t, d]) => fila(k, t, d, A[k])).join("")}
    <div class="aviso-grupo">🌙 Modo noche</div>
    <p class="text-xs muted" style="margin:4px 0 0">De noche, Norte baja la luz y no da avisos (las alarmas sí suenan).</p>
    ${fila("noche-auto", "Automático", `Desde tu hora de dormir hasta tu primera alarma (sin hora de dormir, desde las 23:00; sin alarma, hasta las 7:00).`, A.noche.auto)}
    ${A.noche.auto ? "" : `<div class="aviso"><div class="aviso__txt"><span class="aviso__t">Desde</span></div>
        <input class="input aviso__hora" type="time" id="norte-noche-desde" value="${escapeAttr(A.noche.desde)}" aria-label="Modo noche desde" onchange="norteNoche('desde', this.value)"></div>
      <div class="aviso"><div class="aviso__txt"><span class="aviso__t">Hasta</span></div>
        <input class="input aviso__hora" type="time" id="norte-noche-hasta" value="${escapeAttr(A.noche.hasta)}" aria-label="Modo noche hasta" onchange="norteNoche('hasta', this.value)"></div>`}
    <div class="aviso-grupo">✨ Más</div>
    ${fila("aburrido", "😴 Norte aburrido", "Cuando nadie le habla un rato, hace sus animaciones de espera.", A.aburrido)}
    ${fila("pregunta_cierre", "⏰ «¿A qué hora te despierto?»", "La pregunta al cerrar el día en Rumbo, para la alarma de mañana.", A.pregunta_cierre)}`;
}
function norteAjuste(k, on) {
  if (!norteAjustesCambiar(A => {
    if (k === "noche-auto") { if (A.noche.auto === on) return false; A.noche.auto = on; return; }
    if (!(k in NORTE_AJUSTES_DEF) || A[k] === on) return false;
    A[k] = on;
  })) return;
  saveState(); norteRepintar();
}
function norteNoche(cual, v) {
  if (!NORTE_HORA.test(v || "") || !["desde", "hasta"].includes(cual)) return;
  if (norteAjustesCambiar(A => { if (A.noche[cual] === v) return false; A.noche[cual] = v; })) { saveState(); norteRepintar(); }
}

/* -------- Editar hábito › «Recordar a las…» (F13): Norte te avisa a esa hora si todavía no lo haces (h.hora) -------- */
function norteHoraHabitoHtml(h) {
  if (!norteDisponible()) return "";
  return `<div class="mt-16" id="h-hora-box"><label class="text-xs muted" for="h-hora">Recordar a las… <span>(opcional: tu Norte te avisa a esa hora si todavía no lo haces)</span></label>
    <div class="row mt-8" style="gap:10px;align-items:center"><input class="input" type="time" id="h-hora" value="${escapeAttr((h && NORTE_HORA.test(h.hora || "") && h.hora) || "")}" style="width:140px">
      <button type="button" class="btn-link" onclick="document.getElementById('h-hora').value=''">Sin hora</button></div></div>`;
}
/* La hora del formulario: "HH:MM", "" (sin hora) o null (el formulario no la trae) */
function norteHoraHabitoLeer() {
  const el = typeof document !== "undefined" && document.getElementById("h-hora");
  if (!el) return null;
  return NORTE_HORA.test(el.value || "") ? el.value : "";
}

/* data-action="norte-…" (desde onClick en app.js) */
function norteAccion(a, d, el) {
  if (a === "norte-conectar") return norteConectar();
  if (a === "norte-desconectar") return norteDesconectar(d.id);
  if (a === "norte-alarma-nueva") return openNorteAlarma(null);
  if (a === "norte-alarma-editar") return openNorteAlarma(d.id);
  if (a === "norte-alarma-guardar") return norteAlarmaGuardar();
  if (a === "norte-alarma-borrar") return norteAlarmaBorrar(d.id);
  if (a === "norte-alarma-activa") return norteAlarmaActiva(d.id, !!(el && el.checked));
  if (a === "norte-ajuste") return norteAjuste(d.k, !!(el && el.checked));
}
