/* ============================================================
   Rumbo · Zona sensible: borrar con seguro (Cuenta)
   Reiniciar tus datos y eliminar tu cuenta piden confirmar que es a propósito y que eres tú:
   - una hoja que dice con tus números lo que se borra, con el respaldo a un toque;
   - escribir la palabra (REINICIAR o ELIMINAR);
   - tu contraseña o, si entras solo con Google, un código a tu correo
     (5 intentos fallidos y hay que esperar 5 minutos).
   Cambiar la contraseña también pide la actual (o el código).
   Antes de reiniciar o importar un respaldo se guarda una copia de lo que tenías por 30 días
   (tabla respaldos, supabase/respaldos.sql; si aún no está, en este equipo) y se recupera desde Cuenta.
   El reemplazo queda marcado (STATE.reemplazo): así otro equipo no devuelve lo de antes al
   sincronizar (mergeStates, store.js).
   ============================================================ */
const ZONA = { accion: null, ocupado: false, importar: null };
const ZONA_VERIF = {};   // por formulario ("zona": la hoja, "cv": cambiar contraseña): { metodo: "clave" | "codigo", enviado, tieneClave }
const ZONA_PALABRA = { reiniciar: "REINICIAR", eliminar: "ELIMINAR" };
const ZONA_INTENTOS = 5, ZONA_ESPERA_MIN = 5, ZONA_REENVIO_S = 30;

/* -------- Lo que tienes (lo que se borra o lo que trae un respaldo) -------- */
function zonaResumen(S) {
  S = S || STATE || {};
  const n = x => Array.isArray(x) ? x.length : 0, num = v => Number(v).toLocaleString("es-CL");
  const fotos = Object.values((S.album && S.album.meses) || {}).reduce((a, m) => a + n(m && m.fotos), 0);
  const filas = [
    [n(S.habitos && S.habitos.defs), "hábitos y sus rachas", "hábito y su racha"],
    [n(S.vida && S.vida.diario), "entradas del diario", "entrada del diario"],
    [Object.keys((S.ritual && S.ritual.dias) || {}).length, "días de ritual", "día de ritual"],
    [(S.gamif && +S.gamif.puntos) || 0, "⭐ para la Tienda", "⭐ para la Tienda"],
    [n(S.gamif && S.gamif.badges), "medallas", "medalla"],
    [fotos, "fotos del álbum", "foto del álbum"],
    [n(S.lecturas), "lecturas", "lectura"],
    [n(S.finanzas && S.finanzas.gastos), "gastos anotados", "gasto anotado"],
    [n(S.alcancias && S.alcancias.lista) + n(S.deseos && S.deseos.lista), "alcancías y deseos", "alcancía o deseo"],
  ];
  return filas.filter(f => f[0] > 0).map(([v, pl, sg]) => ({ v: num(v), t: v === 1 ? sg : pl }));
}
function zonaResumenHtml(S, vacio) {
  const r = zonaResumen(S);
  return r.length ? `<ul class="zona-pierdes">${r.map(x => `<li><b>${x.v}</b><span>${escapeHtml(x.t)}</span></li>`).join("")}</ul>`
    : `<p class="text-sm muted zona-vacio">${escapeHtml(vacio)}</p>`;
}
const zonaNorm = s => String(s || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
function zonaFecha(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long" }) + " a las " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function zonaQuedan(iso) { const dias = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 864e5)); return dias === 1 ? "queda 1 día" : `quedan ${dias} días`; }

/* -------- La hoja: Reiniciar mis datos / Eliminar mi cuenta -------- */
function openZona(accion) {
  if (!ZONA_PALABRA[accion]) return;
  ZONA.accion = accion; ZONA.ocupado = false; delete ZONA_VERIF.zona;   // cada vez parte con la forma de tu cuenta
  const reiniciar = accion === "reiniciar", palabra = ZONA_PALABRA[accion];
  openModal(reiniciar ? "Reiniciar mis datos" : "Eliminar mi cuenta", `<div class="zona" id="zona-hoja" data-accion="${accion}">
    <p class="zona__intro">${reiniciar ? "Se borra todo lo tuyo en <b>todos tus equipos</b> y empiezas de cero. Tu cuenta sigue." : "Se borran tu cuenta y todo lo que tienes en Rumbo, <b>para siempre</b>. No se puede recuperar."}</p>
    ${zonaResumenHtml(STATE, "Aún no tienes casi nada guardado.")}
    ${reiniciar ? `<p class="zona-copia">🛟 Antes de borrar guardamos una copia por 30 días: la recuperas en Cuenta › Zona sensible.</p>` : ""}
    <button type="button" class="btn btn--soft btn-block" data-action="export">⭳ Descargar mi respaldo primero</button>
    <div class="field zona-campo"><label for="zona-palabra">Para seguir, escribe <b class="zona-palabra">${palabra}</b></label>
      <input class="input" id="zona-palabra" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" oninput="zonaRevisar()"></div>
    <div class="zona-verif" id="zona-verif"></div>
    <p class="zona-error" id="zona-error" role="alert" hidden></p>
    <div class="zona-botones"><button type="button" class="btn btn--soft" data-action="zona-cancelar">Cancelar</button>
      <button type="button" class="btn btn--peligro" id="zona-ok" data-action="zona-confirmar" disabled>${reiniciar ? "Reiniciar mis datos" : "Eliminar mi cuenta"}</button></div>
  </div>`);
  zonaVerifPintar("zona");
}

/* -------- ¿Eres tú? Tu contraseña, o un código a tu correo -------- */
async function zonaVerifPintar(pre) {
  const caja = document.getElementById(pre + "-verif"); if (!caja) return;
  if (!ZONA_VERIF[pre]) {
    ZONA_VERIF[pre] = { metodo: "clave", enviado: 0, tieneClave: true };
    caja.innerHTML = `<p class="text-sm muted">Un momento…</p>`;
    let ids = []; try { ids = (await BACKEND.identidades()) || []; } catch (e) {}
    // sin datos de identidades (p. ej. sin servidor) se pide la contraseña; si entras solo con Google, el código
    const tiene = !ids.length || ids.some(i => i.provider === "email");
    Object.assign(ZONA_VERIF[pre], { tieneClave: tiene, metodo: tiene ? "clave" : "codigo" });
    if (!document.body.contains(caja)) return;
  }
  const v = ZONA_VERIF[pre], email = (CURRENT_USER && CURRENT_USER.email) || "tu correo";
  const otro = (m, t) => `<button type="button" class="btn-link zona-otro" data-action="zona-metodo" data-pre="${pre}" data-v="${m}">${t}</button>`;
  caja.innerHTML = v.metodo === "clave"
    ? `<div class="field zona-campo"><label for="${pre}-clave">${pre === "cv" ? "Tu contraseña actual" : "Tu contraseña"}</label>
        <input class="input" type="password" id="${pre}-clave" autocomplete="current-password" oninput="zonaRevisar()"></div>
       ${otro("codigo", "Prefiero un código a mi correo")}`
    : `<div class="zona-codigo"><span class="text-sm soft">${v.enviado ? `Te mandamos un código de 6 números a <b>${escapeHtml(email)}</b>. Revisa también el spam.` : `Para confirmar que eres tú, te mandamos un código de 6 números a <b>${escapeHtml(email)}</b>.`}</span>
        <button type="button" class="btn btn--soft" data-action="zona-enviar" data-pre="${pre}">${v.enviado ? "Mandar otro código" : "Mandarme el código"}</button>
        <div class="field zona-campo" ${v.enviado ? "" : "hidden"}><label for="${pre}-codigo">El código que te llegó</label>
          <input class="input zona-codigo__in" id="${pre}-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,6);zonaRevisar()"></div></div>
       ${otro("clave", v.tieneClave ? "Prefiero usar mi contraseña" : "Tengo contraseña")}`;
  zonaRevisar();
}
function zonaVerifLleno(pre) {
  const v = ZONA_VERIF[pre]; if (!v) return false;
  if (v.metodo === "codigo") { const c = document.getElementById(pre + "-codigo"); return !!c && /^\d{6}$/.test(c.value); }
  const c = document.getElementById(pre + "-clave"); return !!c && c.value.length > 0;
}
/* El botón rojo se enciende con la palabra bien escrita y la contraseña (o el código) puesta */
function zonaRevisar() {
  const pal = document.getElementById("zona-palabra"), ok = document.getElementById("zona-ok");
  if (!pal || !ok) return;
  const bien = zonaNorm(pal.value) === ZONA_PALABRA[ZONA.accion];
  pal.classList.toggle("is-ok", bien);
  ok.disabled = ZONA.ocupado || !bien || !zonaVerifLleno("zona");
}
function zonaError(pre, msg) { const e = document.getElementById(pre + "-error"); if (!e) return toast(msg, true); e.textContent = msg || ""; e.hidden = !msg; }

/* 5 intentos fallidos y hay que esperar 5 minutos (en este equipo; Supabase además limita los intentos) */
function zonaIntentosClave() { return "rumbo_zona_" + ((CURRENT_USER && CURRENT_USER.id) || "x"); }
function zonaIntentos() { try { return JSON.parse(localStorage.getItem(zonaIntentosClave()) || "{}") || {}; } catch (e) { return {}; } }
function zonaEspera() { const x = zonaIntentos(); return x.hasta && x.hasta > Date.now() ? Math.ceil((x.hasta - Date.now()) / 60000) : 0; }
function zonaFallo() {
  const x = zonaIntentos(); x.n = (x.n || 0) + 1;
  if (x.n >= ZONA_INTENTOS) { x.hasta = Date.now() + ZONA_ESPERA_MIN * 60000; x.n = 0; }
  try { localStorage.setItem(zonaIntentosClave(), JSON.stringify(x)); } catch (e) {}
  return x;
}
function zonaAcierto() { try { localStorage.removeItem(zonaIntentosClave()); } catch (e) {} }
async function zonaVerificar(pre, nada) {
  const espera = zonaEspera();
  if (espera) return { error: `Te equivocaste ${ZONA_INTENTOS} veces. Espera ${espera} min para probar de nuevo.` };
  const v = ZONA_VERIF[pre] || { metodo: "clave" };
  let r;
  try {
    if (v.metodo === "codigo") {
      const c = (document.getElementById(pre + "-codigo") || {}).value || "";
      if (!/^\d{6}$/.test(c)) return { error: "Escribe los 6 números del código." };
      r = await BACKEND.verificarCodigo(c);
    } else {
      const c = (document.getElementById(pre + "-clave") || {}).value || "";
      if (!c) return { error: "Escribe tu contraseña." };
      r = await BACKEND.verificarClave(c);
    }
  } catch (e) { r = { error: "No se pudo revisar. Revisa tu conexión y prueba de nuevo." }; }
  if (r && r.ok) { zonaAcierto(); return { ok: true }; }
  if (r && (r.error === "clave" || r.error === "codigo")) {
    const x = zonaFallo(), que = r.error === "clave" ? "No es tu contraseña." : "Ese código no es o ya venció.";
    return { error: `${que} ${nada}` + (x.hasta ? ` Te equivocaste ${ZONA_INTENTOS} veces: espera ${ZONA_ESPERA_MIN} min para probar de nuevo.` : ` Te ${ZONA_INTENTOS - x.n === 1 ? "queda 1 intento" : `quedan ${ZONA_INTENTOS - x.n} intentos`}.`) };
  }
  return { error: (r && r.error) || "No se pudo revisar. Prueba de nuevo." };
}
async function zonaEnviarCodigo(pre) {
  const v = ZONA_VERIF[pre]; if (!v) return;
  const falta = Math.ceil(ZONA_REENVIO_S - (Date.now() - (v.enviado || 0)) / 1000);
  if (v.enviado && falta > 0) return zonaError(pre, `Espera ${falta} s para pedir otro código.`);
  const r = await BACKEND.enviarCodigo().catch(() => ({ error: "No se pudo mandar el código. Revisa tu conexión." }));
  if (r && r.error) return zonaError(pre, r.error);
  v.enviado = Date.now(); zonaError(pre, "");
  await zonaVerifPintar(pre);
  const c = document.getElementById(pre + "-codigo"); if (c) c.focus();
  toast("📧 Te mandamos el código a tu correo");
}

/* -------- Confirmar: la palabra, que eres tú, y recién ahí se borra -------- */
async function zonaConfirmar() {
  if (ZONA.ocupado) return;
  const pal = document.getElementById("zona-palabra"), ok = document.getElementById("zona-ok"), palabra = ZONA_PALABRA[ZONA.accion];
  if (!pal || zonaNorm(pal.value) !== palabra) return zonaError("zona", `Escribe ${palabra} para seguir.`);
  ZONA.ocupado = true; zonaRevisar(); zonaError("zona", "");
  const txt = ok.textContent; ok.textContent = "Revisando…";
  const v = await zonaVerificar("zona", "No se borró nada.");
  if (!v.ok) { ZONA.ocupado = false; ok.textContent = txt; zonaError("zona", v.error); zonaRevisar(); return; }
  ok.textContent = ZONA.accion === "reiniciar" ? "Reiniciando…" : "Eliminando…";
  if (ZONA.accion === "reiniciar") await zonaReiniciar(); else await zonaEliminar();
  ZONA.ocupado = false; if (document.body.contains(ok)) { ok.textContent = txt; zonaRevisar(); }
}
/* Reiniciar: primero la copia de 30 días; si no se pudo guardar en ningún lado, se descarga el respaldo */
async function zonaReiniciar() {
  const donde = await zonaRespaldo("reinicio");
  if (!donde) exportData();
  const nombre = STATE.profile.name, nacimiento = STATE.profile.birthDate, tema = STATE.settings.theme, ts = zonaReemplazoTs();
  STATE = defaultState();
  STATE.profile.name = nombre; STATE.profile.birthDate = nacimiento;
  STATE.settings.onboarded = true; STATE.settings.theme = tema; STATE.settings.introVersion = INTRO_VERSION;
  STATE.reemplazo = { ts, motivo: "reinicio" };
  applyTheme(tema); applyCosmetics(); saveState(); updateTopbar(); closeModal(); rerender();
  toast(donde ? "Datos reiniciados · tienes 30 días para recuperarlos en Cuenta" : "Datos reiniciados · se descargó un respaldo de lo que tenías");
}
async function zonaEliminar() {
  const uid = CURRENT_USER && CURRENT_USER.id;
  const res = await BACKEND.deleteAccount();
  if (res && res.error) return zonaError("zona", res.error);
  // lo que quedaba guardado en este equipo también se va
  try { ["rumbo_state_", "rumbo_pending_", "rumbo_zona_", "rumbo_respaldos_"].forEach(k => localStorage.removeItem(k + uid)); } catch (e) {}
  ZONA_IDB.borrarDe(uid);
  closeModal(); CURRENT_USER = null; STATE = null; location.hash = "";
  showAuth(); toast("Cuenta eliminada");
}

/* -------- La copia de 30 días: en tu cuenta (tabla respaldos) o, si aún no está, en este equipo -------- */
const ZONA_IDB = {
  _db: null,
  abrir() {
    if (!this._db) {
      this._db = new Promise((res, rej) => {
        if (typeof indexedDB === "undefined") return rej(new Error("sin-indexeddb"));
        const r = indexedDB.open("rumbo_respaldos", 1);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("copias")) r.result.createObjectStore("copias", { keyPath: "id" }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      this._db.catch(() => { this._db = null; });
    }
    return this._db;
  },
  async _tx(modo, fn) {
    const db = await this.abrir();
    return new Promise((res, rej) => { const t = db.transaction("copias", modo), r = fn(t.objectStore("copias")); t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  },
  async guardar(c) { try { await this._tx("readwrite", s => s.put(c)); return true; } catch (e) { return false; } },
  async todas() { try { return (await this._tx("readonly", s => s.getAll())) || []; } catch (e) { return []; } },
  async borrar(id) { try { await this._tx("readwrite", s => s.delete(id)); } catch (e) {} },
  async borrarDe(uid) { (await this.todas()).filter(c => c.uid === uid).forEach(c => this.borrar(c.id)); },
};
async function zonaRespaldo(motivo) {
  const data = JSON.parse(JSON.stringify(STATE));
  const r = await BACKEND.respaldoGuardar(motivo, data).catch(e => ({ error: String(e) }));
  if (r && r.ok) return "cuenta";
  const uid = CURRENT_USER && CURRENT_USER.id, ahora = Date.now();
  const mias = (await ZONA_IDB.todas()).filter(c => c.uid === uid).sort((a, b) => a.creado < b.creado ? -1 : 1);
  for (const c of mias.slice(0, Math.max(0, mias.length - RESPALDO_TOPE + 1))) await ZONA_IDB.borrar(c.id);   // quedan las 3 más nuevas
  const ok = await ZONA_IDB.guardar({ id: "e" + ahora.toString(36), uid, motivo, creado: new Date(ahora).toISOString(), vence: new Date(ahora + RESPALDO_DIAS * 864e5).toISOString(), data });
  return ok ? "equipo" : null;
}
async function zonaCopias() {
  const uid = CURRENT_USER && CURRENT_USER.id, ahora = Date.now();
  const r = await BACKEND.respaldosListar().catch(() => ({ lista: [] }));
  const cuenta = ((r && r.lista) || []).map(c => Object.assign({}, c, { donde: "cuenta" }));
  const equipo = (await ZONA_IDB.todas()).filter(c => c.uid === uid && Date.parse(c.vence) > ahora).map(({ data, ...c }) => Object.assign(c, { donde: "equipo" }));
  return cuenta.concat(equipo).sort((a, b) => a.creado < b.creado ? 1 : -1);
}
async function zonaCopiaData(id, donde) {
  if (donde === "equipo") { const c = (await ZONA_IDB.todas()).find(x => x.id === id); return c ? c.data : null; }
  const r = await BACKEND.respaldoTraer(id).catch(() => null);
  return r && r.data ? r.data : null;
}
/* En Cuenta › Zona sensible: «Recuperar mis datos» / «Deshacer la importación» mientras dure la copia */
async function zonaCargarRespaldos() {
  const caja = document.getElementById("acc-respaldos"); if (!caja) return;
  const copias = await zonaCopias();
  if (!document.body.contains(caja)) return;
  caja.innerHTML = copias.map(c => `<div class="zona-resp">
      <span>${c.motivo === "importacion" ? "Importaste un respaldo" : "Reiniciaste tus datos"} el <b>${escapeHtml(zonaFecha(c.creado))}</b> · ${zonaQuedan(c.vence)}${c.donde === "equipo" ? " · copia en este equipo" : ""}</span>
      <button type="button" class="btn btn--soft" data-action="zona-recuperar" data-id="${escapeAttr(c.id)}" data-donde="${c.donde}" data-motivo="${escapeAttr(c.motivo)}">${c.motivo === "importacion" ? "Deshacer la importación" : "Recuperar mis datos"}</button></div>`).join("");
}
async function zonaRecuperarAbrir(d) {
  const data = await zonaCopiaData(d.id, d.donde);
  if (!data) return toast("No encontramos esa copia: puede que ya haya vencido.", true);
  ZONA.recuperar = { id: d.id, donde: d.donde, data };
  const imp = d.motivo === "importacion";
  openModal(imp ? "Deshacer la importación" : "Recuperar mis datos", `<div class="zona">
    <p class="zona__intro">Vuelven tus datos como estaban ${imp ? "antes de importar" : "antes de reiniciar"}. Lo que hiciste desde entonces se reemplaza.</p>
    ${zonaResumenHtml(data, "Esa copia casi no tenía datos.")}
    <div class="zona-botones"><button type="button" class="btn btn--soft" data-action="zona-cancelar">Cancelar</button>
      <button type="button" class="btn btn--primary" data-action="zona-recuperar-ok">${imp ? "Deshacer la importación" : "Recuperar mis datos"}</button></div></div>`);
}
async function zonaRecuperar() {
  const r = ZONA.recuperar; if (!r) return;
  ZONA.recuperar = null;
  zonaReemplazar(r.data, "recuperacion");
  if (r.donde === "equipo") await ZONA_IDB.borrar(r.id); else await BACKEND.respaldoBorrar(r.id).catch(() => {});
  closeModal(); rerender(); toast("Volvieron tus datos ✅");
}
/* Reemplaza todo y lo marca, para que la fusión entre equipos no traiga de vuelta lo de antes */
function zonaReemplazoTs() { return Math.max(Date.now(), reemplazoTs(STATE) + 1); }   // siempre más nuevo que el anterior
function zonaReemplazar(data, motivo) {
  const ts = zonaReemplazoTs();
  STATE = migrate(JSON.parse(JSON.stringify(data)));
  STATE.reemplazo = { ts: Math.max(ts, reemplazoTs(STATE) + 1), motivo };
  applyTheme(STATE.settings.theme); applyCosmetics(); saveState(); updateTopbar();
}

/* -------- Importar un respaldo: se ve lo que trae y lo de ahora queda guardado 30 días -------- */
function zonaImportarAbrir(data) {
  ZONA.importar = data;
  openModal("Importar respaldo", `<div class="zona">
    <p class="zona__intro">Tus datos de ahora se reemplazan por los del archivo.</p>
    <span class="cj-sub">El respaldo trae</span>
    ${zonaResumenHtml(data, "Ese respaldo casi no tiene datos.")}
    <p class="zona-copia">🛟 Lo que tienes ahora queda guardado por 30 días: puedes deshacer la importación en Cuenta › Zona sensible.</p>
    <div class="zona-botones"><button type="button" class="btn btn--soft" data-action="zona-cancelar">Cancelar</button>
      <button type="button" class="btn btn--primary" data-action="zona-importar-ok">Reemplazar mis datos</button></div></div>`);
}
async function zonaImportar() {
  const data = ZONA.importar; if (!data) return;
  ZONA.importar = null;
  const donde = await zonaRespaldo("importacion");
  zonaReemplazar(data, "importacion");
  closeModal(); rerender();
  toast(donde ? "Datos importados ✅ · puedes deshacerlo en Cuenta por 30 días" : "Datos importados ✅");
}

/* -------- Cambiar tu contraseña: primero la actual (o el código) -------- */
async function zonaCambiarClave() {
  const nueva = (document.getElementById("acc-pass") || {}).value || "";
  if (nueva.length < 6) return zonaError("cv", "La nueva contraseña necesita al menos 6 caracteres.");
  zonaError("cv", "");
  const v = await zonaVerificar("cv", "No se cambió nada.");
  if (!v.ok) return zonaError("cv", v.error);
  const res = await BACKEND.updatePassword(nueva);
  if (res.error) return zonaError("cv", res.error);
  ["acc-pass", "cv-clave", "cv-codigo"].forEach(id => { const e = document.getElementById(id); if (e) e.value = ""; });
  ZONA_VERIF.cv.tieneClave = true;
  toast("Contraseña actualizada ✅");
}

function zonaAccion(a, d) {
  if (a === "zona-cancelar") { ZONA.importar = null; ZONA.recuperar = null; return closeModal(); }
  if (a === "zona-confirmar") return zonaConfirmar();
  if (a === "zona-metodo") { if (ZONA_VERIF[d.pre]) ZONA_VERIF[d.pre].metodo = d.v === "codigo" ? "codigo" : "clave"; zonaError(d.pre, ""); return zonaVerifPintar(d.pre); }
  if (a === "zona-enviar") return zonaEnviarCodigo(d.pre);
  if (a === "zona-recuperar") return zonaRecuperarAbrir(d);
  if (a === "zona-recuperar-ok") return zonaRecuperar();
  if (a === "zona-importar-ok") return zonaImportar();
  if (a === "zona-cambiar-clave") return zonaCambiarClave();
}
