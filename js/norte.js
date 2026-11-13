/* ============================================================
   RUMBO · 🧭 Norte, tu brújula: el robot de voz del escritorio
   (En la interfaz se llama «Norte, tu brújula» porque «Norte» ya es un tema visual.)
   · Conectar: Cuenta › «Norte, tu brújula» (solo la cuenta dueña, esCuentaDuena en app.js) pide un código
     de 6 dígitos (norte_crear_codigo, dura 10 minutos y sirve una vez) que se ingresa en Norte. Mientras el
     código está a la vista, la lista de aparatos se revisa cada 5 segundos para avisar cuando Norte se conectó.
     Cada aparato se puede desconectar (su token deja de servir).
   · La bandeja: lo que le pides a Norte (api/norte.js → notifier/norte.mjs) no toca tu documento en el
     servidor. Hábitos, tareas, notas, abrir y cerrar el día esperan en norte_pendientes (supabase/norte.sql)
     y el agua en agua_pendientes (la suma agua-juntos.js, igual que «+ Un vaso» del aviso). Al abrir la app
     y al volver a ella, nortePendientes los toma (quedan reservados 2 minutos para este equipo), los aplica
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
     Los ids del libro de ⭐ son los mismos que al hacerlo a mano: marcar por voz y en la app no paga dos veces.
     La tarea del bocado, las que pasan a mañana y la entrada del diario también llevan id fijo («nb…», «nc…»,
     «dia<fecha>»): si dos equipos aplican el mismo pedido a la vez, al juntarse queda una de cada una.
   ============================================================ */
const NORTE = { corriendo: false, codigo: "", expira: 0, antes: [], reloj: 0, revisar: 0, alFoco: null, aparatos: null, cargando: false, creando: false, error: null };
const NORTE_HECHOS_DIAS = 21, NORTE_HECHOS_MAX = 400, NORTE_TEXTO = 200;
/* Lo que no se encuentra todavía (una tarea o un hábito que llega de otro equipo) se queda en la bandeja y se
   reintenta hasta 2 días; con la app abierta, la bandeja se revisa cada 20 segundos y al volver a su ventana */
const NORTE_ESPERA_MS = 2 * 864e5, NORTE_REVISAR_MS = 20e3, NORTE_ESPERAR = Object.freeze({ esperar: true });

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
const norteTexto = v => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim().slice(0, NORTE_TEXTO);
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
    const t = nuevaTarea(S, dia, { txt, ambito: d.ambito === "pro" ? "pro" : "per", origen: tid });
    t.id = tid; t.ts = now;
    return { tipo: "tarea", txt, iso: dia, estrellas: 0 };
  }
  if (p.tipo === "nota") {
    const txt = norteTexto(d.texto), nid = "nn" + p.id;
    S.postits = Array.isArray(S.postits) ? S.postits : [];
    if (!txt || S.postits.some(n => n && n.id === nid)) return null;
    S.postits.push({ id: nid, titulo: "", texto: txt, etiquetas: typeof etiquetasDe === "function" ? etiquetasDe(txt) : [], fijada: false, color: "", archivada: false, ts: now });
    return { tipo: "nota", txt, estrellas: 0 };
  }
  if (p.tipo === "abrir") {
    S.ritual.dias = S.ritual.dias || {};
    const r0 = S.ritual.dias[iso], sapo = norteTexto(d.primer_bocado), e = Math.round(+d.energia);
    if (r0 && r0.cerrado) return null;            // ya lo cerraste: por voz no se reabre
    if (r0 && r0.hecho && !sapo) return null;      // ya estaba abierto y no trae un bocado nuevo
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
    const m = Math.round(+d.animo), destinos = [...new Set([hoy, agSumar(iso, 1)])], antes = norteTareasAntes(S, destinos);
    const { nuevo, n } = aplicarCierreExpress(S, iso, { mood: m >= 1 && m <= 5 ? m : 3, gratitud: norteTexto(d.gratitud), elecciones: {} });
    norteFijarIds(S, destinos, antes, "nc" + p.id);   // las pendientes que pasaron a mañana (o a hoy, si el día ya pasó)
    if (nuevo) r.cerradoTs = creadoTs;   // a qué hora cerraste (insignias Noche Serena y Búho)
    const pagado = nuevo && ledgerRegistrar(S, "ritual-cierre:" + iso, EXPRESS_MONEDAS.cierre, EXPRESS_MONEDAS.cierre, "Cierre con Norte", now);
    if (nuevo && typeof notaElefanteGuardar === "function") notaElefanteGuardar(iso, S);   // 🐘 la nota de tu elefante
    return { tipo: "cerrar", iso, nuevo, n, estrellas: pagado ? EXPRESS_MONEDAS.cierre : 0 };
  }
  return null;
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
  if (!partes.length) return de("cerrar-sin-abrir").length ? "🧭 Norte no pudo cerrar tu día: no estaba abierto" : "";
  const lista = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
  return `🧭 Norte ${lista}${res.estrellas ? ` · +${res.estrellas} ⭐` : ""}`;
}

/* -------- La bandeja: al abrir, al volver a la app y cada 20 segundos mientras se ve -------- */
async function nortePendientes() {
  if (typeof STATE === "undefined" || !STATE || !CURRENT_USER || NORTE.corriendo || !norteDisponible() || !BACKEND.nortePendientesTomar) return;
  NORTE.corriendo = true;
  try {
    // Primero se mira si hay algo (es barato); solo entonces se trae tu día
    const lista = await BACKEND.nortePendientesTomar();
    if (!Array.isArray(lista) || !lista.length || !STATE) return;
    // Lo tuyo sin subir se junta con la nube y llega lo de tus otros equipos, antes de aplicar. Si no se pudo traer
    // (sin conexión, cambios sin subir o una ventana abierta), se aplica en otra vuelta: con un día viejo, una tarea
    // creada en otro equipo no se encontraría (lo tomado vuelve a estar libre en 2 minutos)
    if (typeof flushCloudSave === "function") await flushCloudSave();
    if (typeof syncFromCloud === "function" && !(await syncFromCloud())) return;
    const res = norteAplicar(lista, STATE);
    if (res.nuevos) {
      saveState();
      norteEfectos(res);
      if (typeof flushCloudSave === "function") await flushCloudSave();
      if (typeof _dirty !== "undefined" && _dirty) return;   // no alcanzó a subir: vuelven en 2 minutos y su id evita aplicarlos otra vez
    }
    if (res.hechos.length && BACKEND.nortePendientesConfirmar) await BACKEND.nortePendientesConfirmar(res.hechos);
  } catch (e) { console.warn("norte", e); }
  finally { NORTE.corriendo = false; }
}
/* Lo que hace la app después de marcar a mano (riega tu jardín, avisa a tus amigos) y el aviso */
function norteEfectos(res) {
  res.aplicados.forEach(ef => {
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
  NORTE.revisar = setInterval(() => { if (!document.hidden) nortePendientes(); }, NORTE_REVISAR_MS);
  if (!NORTE.alFoco) { NORTE.alFoco = () => { if (CURRENT_USER) norteAlVolver(); }; window.addEventListener("focus", NORTE.alFoco); }
}
function norteAlVolver() { setTimeout(nortePendientes, 1500); }   // después de que syncFromCloud trae lo último
/* Al salir de la cuenta: ni el código ni la lista quedan para quien entre después */
function norteOlvidar() {
  clearInterval(NORTE.reloj);
  clearInterval(NORTE.revisar); NORTE.revisar = 0;
  Object.assign(NORTE, { corriendo: false, codigo: "", expira: 0, antes: [], reloj: 0, aparatos: null, cargando: false, creando: false, error: null });
}

/* -------- Cuenta › «Norte, tu brújula» -------- */
function renderNorteCuenta() {
  if (!norteDisponible()) return "";
  setTimeout(() => { norteCargarAparatos(); if (NORTE.codigo && NORTE.expira > Date.now()) norteReloj(); }, 0);
  return `<div class="card mt-16" id="acc-norte">${norteCuentaHtml()}</div>`;
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
  const el = document.getElementById("acc-norte");
  if (el) el.innerHTML = typeof iconizar === "function" ? iconizar(norteCuentaHtml()) : norteCuentaHtml();
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
  else { NORTE.error = null; NORTE.aparatos = (Array.isArray(r) ? r : []).filter(a => a && a.id); }
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
  norteRepintar(); toast("🧭 Norte desconectado");
}
/* data-action="norte-…" (desde onClick en app.js) */
function norteAccion(a, d) {
  if (a === "norte-conectar") return norteConectar();
  if (a === "norte-desconectar") return norteDesconectar(d.id);
}
