/* ============================================================
   RUMBO · Capa de datos (Store) con backend intercambiable
   Fase 1: backend LOCAL (multi-perfil en este navegador).
   Fase 2: se reemplaza por SupabaseBackend sin tocar la app.

   Interfaz común:
     getSession()            -> {id,email,name} | null
     register({name,email,password}) -> user | {error}
     login({email,password})         -> user | {error}
     logout()
     loadState(userId)       -> state | null   (la "nube")
     saveState(userId,state)
     resetPassword(email)    -> {ok} | {error}
   ============================================================ */

/* Hash local de juguete: NO es seguridad real. Solo sirve para la
   demo local. Con Supabase, las contraseñas las maneja el servidor
   de forma segura y esta app nunca las ve. */
function _hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return "h" + (h >>> 0);
}

/* Llama a la función de notificaciones de la app (api/push.js, en Vercel) */
async function _pushFetch(metodo, body, jwt) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (jwt) headers.Authorization = "Bearer " + jwt;
    const r = await fetch("api/push/", { method: metodo, headers, cache: "no-store", body: metodo === "GET" ? undefined : JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? d : { error: d.error || "http-" + r.status, status: r.status };
  } catch (e) { return { error: "red" }; }
}

/* Amigos: código para invitar (6 letras y números sin los que se confunden, como rumbo_codigo_amigo en supabase/amigos.sql) */
function _codigoAmigo() {
  const L = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let c = ""; for (let i = 0; i < 6; i++) c += L[Math.floor(Math.random() * L.length)];
  return c;
}
/* Errores de Amigos en palabras de la app: sin-servidor (falta correr supabase/amigos.sql o conjunto.sql), red, limite,
   no-amigos y los de los hábitos y objetivos en conjunto (no-miembro, fecha, amigos, nombre, icono, frecuencia, meta, unidad, cantidad)
   y de los planes (titulo, tipo, hora, lugar, enlace, opciones, respuesta, no-creador, votacion, cancelado, monto, para) y las listas (texto, estrellas) */
function _amigosError(e) {
  const m = String((e && (e.message || e.details)) || e || "");
  if (/limite/.test(m)) return "limite";
  if (/no-amigos/.test(m)) return "no-amigos";
  if (["no-miembro", "fecha", "amigos", "nombre", "icono", "frecuencia", "meta", "unidad", "cantidad",
    "titulo", "tipo", "hora", "lugar", "enlace", "opciones", "respuesta", "no-creador", "votacion", "cancelado", "texto", "estrellas", "monto", "para", "no-abierto", "autor", "paginas", "pagina"].includes(m.trim())) return m.trim();
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return "red";
  if ((e && ["PGRST202", "PGRST205", "42P01", "42883"].includes(e.code)) || /does not exist|Could not find the (function|table)|schema cache/i.test(m)) return "sin-servidor";
  return m || "error";
}

const LocalBackend = {
  /* Sin servidor: la función no existe (las pruebas la simulan en /functions/v1/…) */
  async llamarFuncion(nombre, body) {
    try {
      const r = await fetch("functions/v1/" + nombre, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d.error || "http-" + r.status, status: r.status };
    } catch (e) { return { error: "red" }; }
  },
  /* Notificaciones: sin servidor, los dispositivos se anotan en este navegador (las pruebas simulan api/push/) */
  _pushSubs() { try { return JSON.parse(localStorage.getItem("rumbo_push_subs") || "[]"); } catch { return []; } },
  _savePushSubs(s) { try { localStorage.setItem("rumbo_push_subs", JSON.stringify(s)); } catch {} },
  async pushRegistrar(d) { this._savePushSubs(this._pushSubs().filter(x => x.endpoint !== d.endpoint).concat([d])); return { ok: true }; },
  async pushQuitar(endpoint) { this._savePushSubs(this._pushSubs().filter(x => x.endpoint !== endpoint)); return { ok: true }; },
  async pushExiste(endpoint) { return this._pushSubs().some(x => x.endpoint === endpoint); },
  async pushApi(metodo, body) { return _pushFetch(metodo, body, null); },
  _users() { try { return JSON.parse(localStorage.getItem("rumbo_users") || "{}"); } catch { return {}; } },
  _saveUsers(u) { try { localStorage.setItem("rumbo_users", JSON.stringify(u)); } catch {} },
  _pub(u) { return { id: u.id, email: u.email, name: u.name }; },

  async getSession() {
    const uid = localStorage.getItem("rumbo_session");
    if (!uid) return null;
    const u = this._users()[uid];
    return u ? this._pub(u) : null;
  },
  async register({ name, email, password }) {
    email = (email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return { error: "Escribe un correo válido." };
    if (!password || password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
    const users = this._users();
    if (Object.values(users).some(u => u.email === email)) return { error: "Ya existe una cuenta con ese correo." };
    const id = "u_" + Math.random().toString(36).slice(2, 10);
    users[id] = { id, email, name: (name || "").trim() || email.split("@")[0], pass: _hash(password) };
    this._saveUsers(users);
    localStorage.setItem("rumbo_session", id);
    return this._pub(users[id]);
  },
  async login({ email, password }) {
    email = (email || "").trim().toLowerCase();
    const u = Object.values(this._users()).find(x => x.email === email);
    if (!u || u.pass !== _hash(password || "")) return { error: "Correo o contraseña incorrectos." };
    localStorage.setItem("rumbo_session", u.id);
    return this._pub(u);
  },
  async logout() { localStorage.removeItem("rumbo_session"); },
  async googleDisponible() { return false; },
  async loginGoogle() { return { error: "Iniciar sesión con Google no está disponible en modo local." }; },
  async identidades() { return []; },
  async vincularGoogle() { return { error: "Vincular Google no está disponible en modo local." }; },
  async loadState(uid) {
    try { const raw = localStorage.getItem("rumbo_cloud_" + uid); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  async saveState(uid, state) {
    try { localStorage.setItem("rumbo_cloud_" + uid, JSON.stringify(state)); return { ok: true }; }
    catch (e) { return { error: "local" }; }
  },
  async resetPassword() { return { ok: true }; },
  async updatePassword(newPass) {
    const id = localStorage.getItem("rumbo_session"); if (!id) return { error: "No hay sesión." };
    const users = this._users(); if (users[id]) { users[id].pass = _hash(newPass); this._saveUsers(users); }
    return { ok: true };
  },
  /* -------- Amigos sin servidor: las mismas reglas que supabase/amigos.sql, guardadas en este navegador.
     Las cuentas locales comparten esta "base", así se prueban dos personas en un mismo equipo. -------- */
  _amDb() {
    const vacia = { perfiles: {}, amistades: [], animos: [], sig: 1, conjuntos: [], cmiembros: [], cmarcas: [], cdescansos: [], objetivos: [], omiembros: [], oaportes: [],
      planes: [], pinvitados: [], popciones: [], pvotos: [], precuerdos: [], pgastos: [], listas: [], lmiembros: [], litems: [], lvotos: [], lecturas: [], ljmiembros: [] };
    try { return Object.assign(vacia, JSON.parse(localStorage.getItem("rumbo_amigos") || "{}")); } catch { return vacia; }
  },
  _amGuardar(db) { try { localStorage.setItem("rumbo_amigos", JSON.stringify(db)); } catch {} },
  _amPar(db, x, y) { return db.amistades.find(f => (f.a === x && f.b === y) || (f.a === y && f.b === x)); },
  _amFicha(db, id) { const p = db.perfiles[id] || {}; return { id, nombre: p.nombre || "", avatar: p.avatar || null }; },
  async amigosPerfil(p) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), prev = db.perfiles[yo];
    let codigo = prev && prev.codigo;
    if (!codigo) { const usados = new Set(Object.values(db.perfiles).map(x => x.codigo)); do codigo = _codigoAmigo(); while (usados.has(codigo)); }
    db.perfiles[yo] = { user_id: yo, codigo, nombre: String(p.nombre || "").slice(0, 60), avatar: p.avatar || null, muestra: p.muestra || {}, estado: p.estado || {},
      casa: p.casa || null, vitrina: p.vitrina || null };
    this._amGuardar(db);
    return { codigo };
  },
  /* La casa y la vitrina de un amigo (solo de amigos, como las reglas de perfiles) */
  async amigosVisita(otro) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), f = this._amPar(db, yo, otro), p = db.perfiles[otro];
    if (!f || f.estado !== "aceptada" || !p) return { error: "no-amigos" };
    return { nombre: p.nombre, avatar: p.avatar, casa: p.casa || null, vitrina: p.vitrina || null };
  },
  async amigosBuscar(codigo) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), c = String(codigo || "").trim().toUpperCase();
    const p = Object.values(db.perfiles).find(x => x.codigo === c && x.user_id !== yo);
    if (!p) return null;
    const f = this._amPar(db, yo, p.user_id);
    return f && f.estado === "bloqueada" ? null : { user_id: p.user_id, nombre: p.nombre, avatar: p.avatar };
  },
  async amigosPedir(codigo) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), c = String(codigo || "").trim().toUpperCase();
    const p = Object.values(db.perfiles).find(x => x.codigo === c);
    if (!p) return { estado: "no-existe" };
    const otro = p.user_id;
    if (otro === yo) return { estado: "tu-codigo" };
    const f = this._amPar(db, yo, otro);
    if (f) {
      if (f.estado === "bloqueada") return { estado: "no-existe" };
      if (f.estado === "aceptada") return { estado: "ya", otro };
      if (f.pide === otro) { f.estado = "aceptada"; f.aceptada_at = new Date().toISOString(); this._amGuardar(db); return { estado: "aceptada", otro }; }
      return { estado: "pedida", otro };
    }
    if (db.amistades.filter(x => x.pide === yo && x.estado === "pendiente").length >= 20) return { estado: "limite" };
    db.amistades.push({ a: yo, b: otro, estado: "pendiente", pide: yo, creada: new Date().toISOString() });
    this._amGuardar(db);
    return { estado: "pedida", otro };
  },
  async amigosResponder(otro, acepta) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), f = this._amPar(db, yo, otro);
    if (!f || f.estado !== "pendiente") return { r: "nada" };
    if (acepta) {
      if (f.pide !== otro) return { r: "nada" };
      f.estado = "aceptada"; f.aceptada_at = new Date().toISOString(); this._amGuardar(db); return { r: "aceptada" };
    }
    db.amistades = db.amistades.filter(x => x !== f); this._amGuardar(db); return { r: "rechazada" };
  },
  async amigosQuitar(otro) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), f = this._amPar(db, yo, otro);
    if (!f || (f.estado === "bloqueada" && f.bloquea !== yo)) return { r: "nada" };
    db.amistades = db.amistades.filter(x => x !== f); this._amGuardar(db); return { r: "quitada" };
  },
  async amigosBloquear(otro) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), f = this._amPar(db, yo, otro);
    if (f && f.estado === "bloqueada" && f.bloquea !== yo) return { r: "bloqueada" };
    db.amistades = db.amistades.filter(x => x !== f).concat([{ a: yo, b: otro, estado: "bloqueada", pide: yo, bloquea: yo }]);
    // Bloquear te saca de los hábitos en conjunto que compartían (como el trigger de supabase/conjunto.sql)
    const juntos = db.cmiembros.filter(m => m.user_id === otro).map(m => m.habito);
    juntos.forEach(h => this._cjSacar(db, h, yo));
    db.omiembros.filter(m => m.user_id === otro).map(m => m.objetivo).forEach(o => this._ojSacar(db, o, yo));   // y de los objetivos
    // y de los planes: en los tuyos sale el otro; en los suyos (o de un tercero), sales tú (supabase/planes.sql)
    db.planes.filter(p => [yo, otro].every(u => db.pinvitados.some(i => i.plan === p.id && i.user_id === u)))
      .forEach(p => { const sale = p.creador === yo ? otro : yo; db.pinvitados = db.pinvitados.filter(i => !(i.plan === p.id && i.user_id === sale)); });
    db.lmiembros.filter(m => m.user_id === otro).map(m => m.lista).forEach(l => this._lcSacar(db, l, yo));   // y de las listas compartidas
    db.ljmiembros.filter(m => m.user_id === otro).map(m => m.lectura).forEach(l => this._ljSacar(db, l, yo));   // y de las lecturas
    this._amGuardar(db); return { r: "bloqueada" };
  },
  async amigosLista() {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mis = db.amistades.filter(f => f.a === yo || f.b === yo).map(f => Object.assign({ otro: f.a === yo ? f.b : f.a }, f));
    return {
      codigo: (db.perfiles[yo] || {}).codigo || "",
      amigos: mis.filter(m => m.estado === "aceptada").map(m => Object.assign(this._amFicha(db, m.otro), { estado: (db.perfiles[m.otro] || {}).estado || {}, desde: m.aceptada_at || null }))
        .sort((x, y) => x.nombre.toLowerCase().localeCompare(y.nombre.toLowerCase())),
      recibidas: mis.filter(m => m.estado === "pendiente" && m.pide === m.otro).map(m => this._amFicha(db, m.otro)),
      enviadas: mis.filter(m => m.estado === "pendiente" && m.pide === yo).map(m => this._amFicha(db, m.otro)),
      bloqueados: mis.filter(m => m.estado === "bloqueada" && m.bloquea === yo).map(m => this._amFicha(db, m.otro)),
      animos: db.animos.filter(x => x.para === yo && !x.visto).sort((x, y) => y.id - x.id)
        .map(x => Object.assign(this._amFicha(db, x.de), { id: x.id, de: x.de, mensaje: x.mensaje, creado: x.creado })),
    };
  },
  async amigosAnimo(para, mensaje) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), f = this._amPar(db, yo, para);
    if (!f || f.estado !== "aceptada") return { error: "no-amigos" };
    const dia = Date.now() - 864e5;
    if (db.animos.filter(x => x.de === yo && x.para === para && new Date(x.creado).getTime() > dia).length >= 3) return { error: "limite" };
    const id = db.sig++;
    db.animos.push({ id, de: yo, para, mensaje: String(mensaje || "").trim().slice(0, 120), creado: new Date().toISOString(), visto: false });
    this._amGuardar(db);
    return { id };
  },
  async amigosAnimosVistos() {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(); let n = 0;
    db.animos.forEach(x => { if (x.para === yo && !x.visto) { x.visto = true; n++; } });
    this._amGuardar(db); return { n };
  },
  async amigosAvisar() { return { ok: true }; },   // sin servidor no hay avisos al celular

  /* -------- Hábitos en conjunto sin servidor: las reglas de supabase/conjunto.sql -------- */
  _cjHoy(hoy) {   // el día del teléfono, si no se aleja más de un día
    const t = todayISO(), d = Math.round((new Date(hoy + "T12:00:00") - new Date(t + "T12:00:00")) / 864e5);
    return Math.abs(d) <= 1 ? hoy : t;
  },
  _cjValida(nombre, icono, frecuencia) {
    const n = String(nombre || "").trim();
    if (!n || n.length > 60) return "nombre";
    if (String(icono || "").length > 16) return "icono";
    if (!frecuencia || typeof frecuencia !== "object" || Array.isArray(frecuencia) || JSON.stringify(frecuencia).length > 200) return "frecuencia";
    return null;
  },
  _cjActivo(db, h, yo) { return db.cmiembros.find(m => m.habito === h && m.user_id === yo && m.estado === "activo"); },
  _cjSacar(db, h, quien) {   // sale con sus marcas; si no queda nadie activo, se borra el hábito
    db.cmarcas = db.cmarcas.filter(x => !(x.habito === h && x.user_id === quien));
    db.cdescansos = (db.cdescansos || []).filter(x => !(x.habito === h && x.user_id === quien));
    db.cmiembros = db.cmiembros.filter(m => !(m.habito === h && m.user_id === quien));
    if (!db.cmiembros.some(m => m.habito === h && m.estado === "activo")) {
      db.conjuntos = db.conjuntos.filter(x => x.id !== h);
      db.cmiembros = db.cmiembros.filter(m => m.habito !== h);
      db.cmarcas = db.cmarcas.filter(x => x.habito !== h);
    }
  },
  async conjuntoCrear(nombre, icono, frecuencia, amigos, hoy) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mal = this._cjValida(nombre, icono, frecuencia); if (mal) return { error: mal };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo);
    if (!ids.length || ids.length > 7) return { error: "amigos" };
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.cmiembros.filter(m => m.user_id === yo).length >= 30) return { error: "limite" };
    const id = "cj" + (db.sig++) + Date.now().toString(36), d = this._cjHoy(hoy), t = Date.now();
    db.conjuntos.push({ id, nombre: String(nombre).trim(), icono: icono || "", frecuencia, creador: yo, creado: d });
    db.cmiembros.push({ habito: id, user_id: yo, estado: "activo", invita: null, desde: d, creado: t });
    ids.forEach((x, i) => db.cmiembros.push({ habito: id, user_id: x, estado: "invitado", invita: yo, desde: null, creado: t + 1 + i }));
    this._amGuardar(db);
    return { id };
  },
  async conjuntoInvitar(h, amigos) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._cjActivo(db, h, yo)) return { error: "no-miembro" };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo && !db.cmiembros.some(m => m.habito === h && m.user_id === x));
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.cmiembros.filter(m => m.habito === h).length + ids.length > 8) return { error: "limite" };
    ids.forEach(x => db.cmiembros.push({ habito: h, user_id: x, estado: "invitado", invita: yo, desde: null, creado: Date.now() }));
    this._amGuardar(db);
    return { n: ids.length };
  },
  async conjuntoResponder(h, acepta, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const m = db.cmiembros.find(x => x.habito === h && x.user_id === yo && x.estado === "invitado");
    if (!m) return { habito: null };
    if (!acepta) { this._cjSacar(db, h, yo); this._amGuardar(db); return { habito: null }; }
    if (db.cmiembros.filter(x => x.user_id === yo && x.estado === "activo").length >= 30) return { error: "limite" };
    m.estado = "activo"; m.desde = this._cjHoy(hoy);
    const c = db.conjuntos.find(x => x.id === h);
    this._amGuardar(db);
    return { habito: { id: c.id, nombre: c.nombre, icono: c.icono, frecuencia: c.frecuencia, creado: c.creado, desde: m.desde } };
  },
  async conjuntoSalir(h) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!db.cmiembros.some(m => m.habito === h && m.user_id === yo)) return { r: "nada" };
    this._cjSacar(db, h, yo); this._amGuardar(db);
    return { r: "salio" };
  },
  async conjuntoEditar(h, nombre, icono, frecuencia) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._cjActivo(db, h, yo)) return { error: "no-miembro" };
    const mal = this._cjValida(nombre, icono, frecuencia); if (mal) return { error: mal };
    Object.assign(db.conjuntos.find(x => x.id === h), { nombre: String(nombre).trim(), icono: icono || "", frecuencia });
    this._amGuardar(db);
    return { r: "editado" };
  },
  async conjuntoMarcar(h, fecha, hecho) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), m = this._cjActivo(db, h, yo);
    if (!m) return { error: "no-miembro" };
    const t = todayISO(), dias = Math.round((new Date(fecha + "T12:00:00") - new Date(t + "T12:00:00")) / 864e5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "") || dias < -8 || dias > 1 || fecha < m.desde) return { error: "fecha" };
    db.cmarcas = db.cmarcas.filter(x => !(x.habito === h && x.user_id === yo && x.fecha === fecha));
    if (hecho) db.cmarcas.push({ habito: h, user_id: yo, fecha });
    this._amGuardar(db);
    const req = db.cmiembros.filter(x => x.habito === h && x.estado === "activo" && x.desde <= fecha);
    return { todos: req.length >= 2 && req.every(x => db.cmarcas.some(k => k.habito === h && k.user_id === x.user_id && k.fecha === fecha)) };
  },
  async conjuntoLista() {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb();
    return db.cmiembros.filter(m => m.user_id === yo).sort((a, b) => a.creado - b.creado).map(mio => {
      const c = db.conjuntos.find(x => x.id === mio.habito);
      return {
        id: c.id, nombre: c.nombre, icono: c.icono, frecuencia: c.frecuencia, creado: c.creado, estado: mio.estado, invita: mio.invita,
        miembros: db.cmiembros.filter(m => m.habito === c.id).sort((a, b) => (a.estado > b.estado) - (a.estado < b.estado) || a.creado - b.creado)
          .map(m => Object.assign(this._amFicha(db, m.user_id), { yo: m.user_id === yo, estado: m.estado, desde: m.desde,
            marcas: db.cmarcas.filter(k => k.habito === c.id && k.user_id === m.user_id).map(k => k.fecha).sort(),
            descansos: (db.cdescansos || []).filter(k => k.habito === c.id && k.user_id === m.user_id).map(k => k.fecha).sort() })),
      };
    });
  },
  /* Tus días de descanso en un hábito en conjunto (supabase/conjunto.sql): desde ayer, hasta 60 por vez */
  async conjuntoDescansos(h, fechas, descansa) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), m = this._cjActivo(db, h, yo);
    if (!m) return { error: "no-miembro" };
    const t = todayISO(), ok = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "") && Math.round((new Date(f + "T12:00:00") - new Date(t + "T12:00:00")) / 864e5) >= -1;
    if (!Array.isArray(fechas) || fechas.length > 60 || !fechas.every(ok)) return { error: "fecha" };
    db.cdescansos = (db.cdescansos || []).filter(x => !(x.habito === h && x.user_id === yo && fechas.includes(x.fecha)));
    if (descansa) fechas.forEach(fecha => db.cdescansos.push({ habito: h, user_id: yo, fecha }));
    this._amGuardar(db);
    return { ok: true };
  },

  /* -------- Objetivos en conjunto sin servidor: las reglas de supabase/objetivos.sql -------- */
  _ojValida(nombre, unidad, meta) {
    const n = String(nombre || "").trim();
    if (!n || n.length > 60) return "nombre";
    if (String(unidad || "").trim().length > 12) return "unidad";
    if (!(Number(meta) > 0) || Number(meta) > 1e12) return "meta";
    return null;
  },
  _ojActivo(db, o, yo) { return db.omiembros.find(m => m.objetivo === o && m.user_id === yo && m.estado === "activo"); },
  _ojSacar(db, o, quien) {   // sale (sus aportes siguen); si no queda nadie activo, se borra con sus aportes
    db.omiembros = db.omiembros.filter(m => !(m.objetivo === o && m.user_id === quien));
    if (!db.omiembros.some(m => m.objetivo === o && m.estado === "activo")) {
      db.objetivos = db.objetivos.filter(x => x.id !== o);
      db.omiembros = db.omiembros.filter(m => m.objetivo !== o);
      db.oaportes = db.oaportes.filter(a => a.objetivo !== o);
    }
  },
  _ojRecalcular(db, o, hoy) {
    const x = db.objetivos.find(y => y.id === o), total = Math.round(db.oaportes.filter(a => a.objetivo === o).reduce((t, a) => t + a.cantidad, 0) * 100) / 100;
    const antes = x.cumplido;
    x.cumplido = total >= x.meta ? (x.cumplido || hoy) : null;
    return { total, cumplido: !!x.cumplido, recien: !antes && !!x.cumplido };
  },
  async objetivoCrear(nombre, unidad, meta, fechaLimite, amigos, hoy) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mal = this._ojValida(nombre, unidad, meta); if (mal) return { error: mal };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo);
    if (!ids.length || ids.length > 7) return { error: "amigos" };
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.omiembros.filter(m => m.user_id === yo).length >= 20) return { error: "limite" };
    const id = "oj" + (db.sig++) + Date.now().toString(36), d = this._cjHoy(hoy), t = Date.now();
    db.objetivos.push({ id, nombre: String(nombre).trim(), unidad: String(unidad || "").trim(), meta: Math.round(Number(meta) * 100) / 100, fecha_limite: fechaLimite || null, creador: yo, creado: d, cumplido: null });
    db.omiembros.push({ objetivo: id, user_id: yo, estado: "activo", invita: null, desde: d, creado: t });
    ids.forEach((x, i) => db.omiembros.push({ objetivo: id, user_id: x, estado: "invitado", invita: yo, desde: null, creado: t + 1 + i }));
    this._amGuardar(db);
    return { id };
  },
  async objetivoInvitar(o, amigos) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._ojActivo(db, o, yo)) return { error: "no-miembro" };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo && !db.omiembros.some(m => m.objetivo === o && m.user_id === x));
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.omiembros.filter(m => m.objetivo === o).length + ids.length > 8) return { error: "limite" };
    ids.forEach(x => db.omiembros.push({ objetivo: o, user_id: x, estado: "invitado", invita: yo, desde: null, creado: Date.now() }));
    this._amGuardar(db);
    return { n: ids.length };
  },
  async objetivoResponder(o, acepta, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const m = db.omiembros.find(x => x.objetivo === o && x.user_id === yo && x.estado === "invitado");
    if (!m) return { r: "nada" };
    if (!acepta) { this._ojSacar(db, o, yo); this._amGuardar(db); return { r: "rechazado" }; }
    if (db.omiembros.filter(x => x.user_id === yo && x.estado === "activo").length >= 20) return { error: "limite" };
    m.estado = "activo"; m.desde = this._cjHoy(hoy);
    this._amGuardar(db);
    return { r: "unido" };
  },
  async objetivoSalir(o) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!db.omiembros.some(m => m.objetivo === o && m.user_id === yo)) return { r: "nada" };
    this._ojSacar(db, o, yo); this._amGuardar(db);
    return { r: "salio" };
  },
  async objetivoEditar(o, nombre, unidad, meta, fechaLimite) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._ojActivo(db, o, yo)) return { error: "no-miembro" };
    const mal = this._ojValida(nombre, unidad, meta); if (mal) return { error: mal };
    Object.assign(db.objetivos.find(x => x.id === o), { nombre: String(nombre).trim(), unidad: String(unidad || "").trim(), meta: Math.round(Number(meta) * 100) / 100, fecha_limite: fechaLimite || null });
    const r = this._ojRecalcular(db, o, todayISO());
    this._amGuardar(db);
    return r;
  },
  async objetivoAportar(o, cantidad, nota, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._ojActivo(db, o, yo)) return { error: "no-miembro" };
    const c = Math.round(Number(cantidad) * 100) / 100;
    if (!(c > 0) || c > 1e12) return { error: "cantidad" };
    if (db.oaportes.filter(a => a.objetivo === o && a.user_id === yo && Date.now() - a.creado < 864e5).length >= 30) return { error: "limite" };
    const id = db.sig++, d = this._cjHoy(hoy);
    db.oaportes.push({ id, objetivo: o, user_id: yo, cantidad: c, nota: String(nota || "").trim().slice(0, 80), fecha: d, creado: Date.now() });
    const r = this._ojRecalcular(db, o, d);
    this._amGuardar(db);
    return Object.assign(r, { id });
  },
  async objetivoBorrarAporte(aporte) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const a = db.oaportes.find(x => x.id === aporte && x.user_id === yo);
    if (!a) return null;
    db.oaportes = db.oaportes.filter(x => x !== a);
    const r = this._ojRecalcular(db, a.objetivo, todayISO());
    this._amGuardar(db);
    return r;
  },
  async objetivoLista() {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb();
    return db.omiembros.filter(m => m.user_id === yo).sort((a, b) => a.creado - b.creado).map(mio => {
      const o = db.objetivos.find(x => x.id === mio.objetivo), aps = db.oaportes.filter(a => a.objetivo === o.id), tot = {};
      aps.forEach(a => { tot[a.user_id] = Math.round(((tot[a.user_id] || 0) + a.cantidad) * 100) / 100; });
      return {
        id: o.id, nombre: o.nombre, unidad: o.unidad, meta: o.meta, fecha_limite: o.fecha_limite, creado: o.creado, cumplido: o.cumplido, estado: mio.estado, invita: mio.invita,
        miembros: db.omiembros.filter(m => m.objetivo === o.id).sort((a, b) => (a.estado > b.estado) - (a.estado < b.estado) || a.creado - b.creado)
          .map(m => Object.assign(this._amFicha(db, m.user_id), { yo: m.user_id === yo, estado: m.estado, desde: m.desde })),
        totales: Object.keys(tot).map(id => ({ id, nombre: this._amFicha(db, id).nombre, total: tot[id] })),
        aportes: aps.slice().sort((a, b) => b.creado - a.creado || b.id - a.id).slice(0, 30).map(a => ({ id: a.id, user_id: a.user_id, cantidad: a.cantidad, nota: a.nota, fecha: a.fecha })),
      };
    });
  },
  /* -------- Planes con amigos sin servidor: las reglas de supabase/planes.sql -------- */
  _plHora(h) { return h == null || h === "" ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? h : false; },
  _plValida(p) {
    const t = String(p.titulo || "").trim(), lugar = String(p.lugar || "").trim(), enlace = String(p.enlace || "").trim();
    if (!t || t.length > 60) return "titulo";
    if (!["pelicula", "comer", "cafe", "deporte", "viaje", "otro"].includes(p.tipo)) return "tipo";
    if (this._plHora(p.hora) === false) return "hora";
    if (lugar.length > 80) return "lugar";
    if (enlace.length > 300 || (enlace && !/^https?:\/\/\S+$/i.test(enlace))) return "enlace";
    return null;
  },
  _plFechaOk(f, hoy) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f || "")) && f >= hoy && f <= agSumar(hoy, 366); },
  _plMio(db, id, yo) { return db.planes.find(p => p.id === id && p.creador === yo && !p.cancelado); },
  async planCrear(p, amigos, hoy) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mal = this._plValida(p || {}); if (mal) return { error: mal };
    const d = this._cjHoy(hoy);
    let ops = [];
    if (p.fecha) { if (!this._plFechaOk(p.fecha, d)) return { error: "fecha" }; }
    else {
      if (!Array.isArray(p.opciones) || p.opciones.length < 2 || p.opciones.length > 4) return { error: "opciones" };
      for (const o of p.opciones) {
        if (!o || !/^\d{4}-\d{2}-\d{2}$/.test(String(o.fecha || ""))) return { error: "opciones" };
        if (!this._plFechaOk(o.fecha, d)) return { error: "fecha" };
        if (this._plHora(o.hora) === false) return { error: "hora" };
      }
      ops = p.opciones.map(o => ({ fecha: o.fecha, hora: this._plHora(o.hora) })).filter((o, i, a) => a.findIndex(x => x.fecha === o.fecha && x.hora === o.hora) === i);
    }
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo);
    if (!ids.length || ids.length > 12) return { error: "amigos" };
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.planes.filter(x => x.creador === yo && Date.now() - x.creado < 864e5).length >= 20) return { error: "limite" };
    const id = "pl" + (db.sig++) + Date.now().toString(36), t = Date.now();
    db.planes.push({ id, titulo: String(p.titulo).trim(), tipo: p.tipo, fecha: p.fecha || null, hora: p.fecha ? this._plHora(p.hora) : null,
      lugar: String(p.lugar || "").trim(), enlace: String(p.enlace || "").trim(), tz: p.tz || "America/Santiago", creador: yo, cancelado: false, creado: t, updated: t });
    db.pinvitados.push({ plan: id, user_id: yo, respuesta: "voy", invita: null, n: db.sig++ });
    ids.forEach(x => db.pinvitados.push({ plan: id, user_id: x, respuesta: "pendiente", invita: yo, n: db.sig++ }));
    ops.forEach(o => db.popciones.push({ id: db.sig++, plan: id, fecha: o.fecha, hora: o.hora }));
    this._amGuardar(db);
    return { id };
  },
  /* «¿Quién se suma?»: abierto a todos tus amigos, con fecha */
  async planAbiertoCrear(p, hoy) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mal = this._plValida(p || {}); if (mal) return { error: mal };
    if (!this._plFechaOk(p.fecha, this._cjHoy(hoy))) return { error: "fecha" };
    if (db.planes.filter(x => x.creador === yo && Date.now() - x.creado < 864e5).length >= 20) return { error: "limite" };
    const id = "pl" + (db.sig++) + Date.now().toString(36), t = Date.now();
    db.planes.push({ id, titulo: String(p.titulo).trim(), tipo: p.tipo, fecha: p.fecha, hora: this._plHora(p.hora), lugar: String(p.lugar || "").trim(),
      enlace: String(p.enlace || "").trim(), tz: p.tz || "America/Santiago", creador: yo, cancelado: false, abierto: true, creado: t, updated: t });
    db.pinvitados.push({ plan: id, user_id: yo, respuesta: "voy", invita: null, n: db.sig++ });
    this._amGuardar(db);
    return { id };
  },
  async planSumarme(id, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), p = db.planes.find(x => x.id === id);
    if (!p || !p.abierto || p.cancelado || p.fecha < this._cjHoy(hoy)) return { error: "no-abierto" };
    if (p.creador === yo) return { r: "nada" };
    const f = this._amPar(db, yo, p.creador); if (!f || f.estado !== "aceptada") return { error: "no-amigos" };
    const i = db.pinvitados.find(x => x.plan === id && x.user_id === yo);
    if (i) { i.respuesta = "voy"; this._amGuardar(db); return { r: "voy" }; }
    if (db.pinvitados.filter(x => x.plan === id).length >= 13) return { error: "limite" };
    db.pinvitados.push({ plan: id, user_id: yo, respuesta: "voy", invita: p.creador, n: db.sig++ }); this._amGuardar(db);
    return { r: "sumado" };
  },
  async planEditar(id, p, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), x = this._plMio(db, id, yo);
    if (!x) return { error: "no-creador" };
    const mal = this._plValida(p || {}); if (mal) return { error: mal };
    if (p.fecha && p.fecha !== x.fecha && !this._plFechaOk(p.fecha, this._cjHoy(hoy))) return { error: "fecha" };
    const antes = [x.fecha, x.hora, x.lugar, x.enlace].join("|");
    const fecha = p.fecha || x.fecha;
    Object.assign(x, { titulo: String(p.titulo).trim(), tipo: p.tipo, lugar: String(p.lugar || "").trim(), enlace: String(p.enlace || "").trim(),
      fecha, hora: fecha ? this._plHora(p.hora) : null, updated: Date.now() });
    this._amGuardar(db);
    return { cambio: antes !== [x.fecha, x.hora, x.lugar, x.enlace].join("|") };
  },
  async planInvitar(id, amigos) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._plMio(db, id, yo)) return { error: "no-creador" };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo && !db.pinvitados.some(i => i.plan === id && i.user_id === x));
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.pinvitados.filter(i => i.plan === id).length + ids.length > 13) return { error: "limite" };
    ids.forEach(x => db.pinvitados.push({ plan: id, user_id: x, respuesta: "pendiente", invita: yo, n: db.sig++ }));
    this._amGuardar(db);
    return { n: ids.length };
  },
  async planResponder(id, respuesta) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!["voy", "quizas", "no"].includes(respuesta)) return { error: "respuesta" };
    const p = db.planes.find(x => x.id === id);
    if (p && p.cancelado) return { error: "cancelado" };
    const i = p && p.creador !== yo && db.pinvitados.find(x => x.plan === id && x.user_id === yo);
    if (!i) return { r: "nada" };
    i.respuesta = respuesta; this._amGuardar(db);
    return { r: respuesta };
  },
  async planVotar(id, opciones) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!db.pinvitados.some(i => i.plan === id && i.user_id === yo)) return { error: "no-miembro" };
    const p = db.planes.find(x => x.id === id);
    if (!p || p.fecha || p.cancelado) return { error: "votacion" };
    const mias = db.popciones.filter(o => o.plan === id).map(o => o.id);
    db.pvotos = db.pvotos.filter(v => !(v.user_id === yo && mias.includes(v.opcion)));
    const nuevas = [...new Set(opciones || [])].filter(o => mias.includes(o));
    nuevas.forEach(o => db.pvotos.push({ opcion: o, user_id: yo }));
    this._amGuardar(db);
    return { n: nuevas.length };
  },
  async planFijar(id, opcion) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), p = this._plMio(db, id, yo);
    if (!p) return { error: "no-creador" };
    const o = db.popciones.find(x => x.id === opcion && x.plan === id);
    if (!o) return { error: "opciones" };
    Object.assign(p, { fecha: o.fecha, hora: o.hora, updated: Date.now() });
    this._amGuardar(db);
    return { r: "fijado" };
  },
  async planCancelar(id) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), p = this._plMio(db, id, yo);
    if (!p) return { r: "nada" };
    Object.assign(p, { cancelado: true, updated: Date.now() });
    this._amGuardar(db);
    return { r: "cancelado" };
  },
  /* ¿Va (o fue)? voy o tal vez, y no se canceló */
  _plVa(db, id, yo) { const p = db.planes.find(x => x.id === id); return !!p && !p.cancelado && db.pinvitados.some(i => i.plan === id && i.user_id === yo && ["voy", "quizas"].includes(i.respuesta)); },
  async planRecordar(id, estrellas, frase, compartir, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._plVa(db, id, yo)) return { error: "no-miembro" };
    const p = db.planes.find(x => x.id === id);
    if (!p.fecha || p.fecha > this._cjHoy(hoy)) return { error: "fecha" };
    if (!(Number.isInteger(estrellas) && estrellas >= 1 && estrellas <= 5)) return { error: "estrellas" };
    const r = db.precuerdos.find(x => x.plan === id && x.user_id === yo), datos = { estrellas, frase: String(frase || "").trim().slice(0, 140), compartir: !!compartir };
    if (r) Object.assign(r, datos); else db.precuerdos.push(Object.assign({ plan: id, user_id: yo, n: db.sig++ }, datos));
    this._amGuardar(db);
    return { r: r ? "cambiado" : "nuevo" };
  },
  async planGasto(id, monto, detalle, para, pago) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._plVa(db, id, yo)) return { error: "no-miembro" };
    const m = Math.round(Number(monto) * 100) / 100;
    if (!(m > 0) || m > 1e8) return { error: "monto" };
    const pedidos = [...new Set(para || [])];
    const ok = pedidos.filter(u => db.pinvitados.some(i => i.plan === id && i.user_id === u && ["voy", "quizas"].includes(i.respuesta)));
    if (!ok.length || ok.length !== pedidos.length) return { error: "para" };
    if (pago && (ok.length !== 1 || ok[0] === yo)) return { error: "para" };
    if (db.pgastos.filter(g => g.plan === id).length >= 100) return { error: "limite" };
    const g = { id: db.sig++, plan: id, user_id: yo, monto: m, detalle: String(detalle || "").trim().slice(0, 60), para: ok, pago: !!pago };
    db.pgastos.push(g); this._amGuardar(db);
    return { id: g.id };
  },
  async planGastoBorrar(gasto) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), g = db.pgastos.find(x => x.id === gasto && x.user_id === yo);
    if (!g) return { r: "nada" };
    db.pgastos = db.pgastos.filter(x => x !== g); this._amGuardar(db);
    return { r: "borrado" };
  },
  async planLista(hoy) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), d = this._cjHoy(hoy), desde = agSumar(d, -30);
    const orden = (a, b) => (a.fecha == null) - (b.fecha == null) || String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.hora || "").localeCompare(String(b.hora || "")) || a.creado - b.creado;
    const ficha = (p, respuesta, invita, miembro) => ({
      id: p.id, titulo: p.titulo, tipo: p.tipo, fecha: p.fecha, hora: p.hora, lugar: p.lugar, enlace: p.enlace, creador: p.creador, cancelado: p.cancelado, abierto: !!p.abierto,
      respuesta, invita,
      miembros: db.pinvitados.filter(i => i.plan === p.id).sort((a, b) => a.n - b.n)
        .map(i => Object.assign(this._amFicha(db, i.user_id), { yo: i.user_id === yo, respuesta: i.respuesta })),
      opciones: p.fecha ? [] : db.popciones.filter(o => o.plan === p.id)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora || "").localeCompare(String(b.hora || "")) || a.id - b.id)
        .map(o => ({ id: o.id, fecha: o.fecha, hora: o.hora,
          votos: db.pvotos.filter(v => v.opcion === o.id && db.pinvitados.some(i => i.plan === p.id && i.user_id === v.user_id)).map(v => v.user_id) })),
      recuerdos: !miembro ? [] : db.precuerdos.filter(r => r.plan === p.id && (r.user_id === yo || r.compartir)).sort((a, b) => a.n - b.n)
        .map(r => ({ id: r.user_id, estrellas: r.estrellas, frase: r.frase, compartir: r.compartir })),
      gastos: !miembro ? [] : db.pgastos.filter(g => g.plan === p.id).sort((a, b) => a.id - b.id)
        .map(g => ({ id: g.id, user_id: g.user_id, monto: g.monto, detalle: g.detalle, para: g.para.slice(), pago: g.pago })),
    });
    const mios = db.pinvitados.filter(i => i.user_id === yo).map(mio => ({ mio, p: db.planes.find(x => x.id === mio.plan) }))
      .filter(({ p }) => p && (!p.fecha || p.fecha >= desde) && (!p.cancelado || Date.now() - p.updated < 7 * 864e5))
      .map(({ mio, p }) => ({ p, f: ficha(p, mio.respuesta, mio.invita, true) }));
    // «¿Quién se suma?»: los abiertos de tus amigos, de hoy en adelante, en los que todavía no estás
    const abiertos = db.planes.filter(p => p.abierto && !p.cancelado && p.fecha >= d && p.creador !== yo
        && (f => f && f.estado === "aceptada")(this._amPar(db, yo, p.creador)) && !db.pinvitados.some(i => i.plan === p.id && i.user_id === yo))
      .map(p => ({ p, f: ficha(p, "abierto", p.creador, false) }));
    return mios.concat(abiertos).sort((a, b) => orden(a.p, b.p)).map(x => x.f);
  },
  /* -------- Listas compartidas sin servidor: las reglas de supabase/listas.sql -------- */
  _lcValida(nombre, tipo) {
    const n = String(nombre || "").trim();
    if (!n || n.length > 60) return "nombre";
    if (!["peliculas", "series", "comida", "viaje", "libros", "otra"].includes(tipo)) return "tipo";
    return null;
  },
  _lcActivo(db, l, yo) { return db.lmiembros.find(m => m.lista === l && m.user_id === yo && m.estado === "activo"); },
  _lcItem(db, item, yo) { const i = db.litems.find(x => x.id === item); return i && this._lcActivo(db, i.lista, yo) ? i : null; },
  _lcSacar(db, l, quien) {   // sale (lo que agregó se queda); si no queda nadie activo, se borra con todo
    db.lmiembros = db.lmiembros.filter(m => !(m.lista === l && m.user_id === quien));
    if (!db.lmiembros.some(m => m.lista === l && m.estado === "activo")) {
      const items = db.litems.filter(i => i.lista === l).map(i => i.id);
      db.listas = db.listas.filter(x => x.id !== l);
      db.lmiembros = db.lmiembros.filter(m => m.lista !== l);
      db.litems = db.litems.filter(i => i.lista !== l);
      db.lvotos = db.lvotos.filter(v => !items.includes(v.item));
    }
  },
  async listaCrear(nombre, tipo, amigos) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), mal = this._lcValida(nombre, tipo); if (mal) return { error: mal };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo);
    if (!ids.length || ids.length > 7) return { error: "amigos" };
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.lmiembros.filter(m => m.user_id === yo).length >= 20) return { error: "limite" };
    const id = "lc" + (db.sig++) + Date.now().toString(36);
    db.listas.push({ id, nombre: String(nombre).trim(), tipo, creador: yo });
    db.lmiembros.push({ lista: id, user_id: yo, estado: "activo", invita: null, n: db.sig++ });
    ids.forEach(x => db.lmiembros.push({ lista: id, user_id: x, estado: "invitado", invita: yo, n: db.sig++ }));
    this._amGuardar(db);
    return { id };
  },
  async listaInvitar(l, amigos) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._lcActivo(db, l, yo)) return { error: "no-miembro" };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo && !db.lmiembros.some(m => m.lista === l && m.user_id === x));
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.lmiembros.filter(m => m.lista === l).length + ids.length > 8) return { error: "limite" };
    ids.forEach(x => db.lmiembros.push({ lista: l, user_id: x, estado: "invitado", invita: yo, n: db.sig++ }));
    this._amGuardar(db);
    return { n: ids.length };
  },
  async listaResponder(l, acepta) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const m = db.lmiembros.find(x => x.lista === l && x.user_id === yo && x.estado === "invitado");
    if (!m) return { r: "nada" };
    if (!acepta) { this._lcSacar(db, l, yo); this._amGuardar(db); return { r: "rechazado" }; }
    if (db.lmiembros.filter(x => x.user_id === yo && x.estado === "activo").length >= 20) return { error: "limite" };
    m.estado = "activo"; this._amGuardar(db);
    return { r: "unido" };
  },
  async listaSalir(l) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!db.lmiembros.some(m => m.lista === l && m.user_id === yo)) return { r: "nada" };
    this._lcSacar(db, l, yo); this._amGuardar(db);
    return { r: "salio" };
  },
  async listaEditar(l, nombre, tipo) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._lcActivo(db, l, yo)) return { error: "no-miembro" };
    const mal = this._lcValida(nombre, tipo); if (mal) return { error: mal };
    Object.assign(db.listas.find(x => x.id === l), { nombre: String(nombre).trim(), tipo });
    this._amGuardar(db);
    return { r: "ok" };
  },
  async listaAgregar(l, texto, nota) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!this._lcActivo(db, l, yo)) return { error: "no-miembro" };
    const t = String(texto || "").trim();
    if (!t || t.length > 80) return { error: "texto" };
    if (db.litems.filter(i => i.lista === l).length >= 200 || db.litems.filter(i => i.user_id === yo && Date.now() - i.creado < 864e5).length >= 50) return { error: "limite" };
    const id = db.sig++;
    db.litems.push({ id, lista: l, user_id: yo, texto: t, nota: String(nota || "").trim().slice(0, 80), visto: null, visto_por: null, creado: Date.now() });
    this._amGuardar(db);
    return { id };
  },
  async listaItemBorrar(item) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), i = this._lcItem(db, item, yo);
    if (!i || (i.user_id && i.user_id !== yo)) return { r: "nada" };
    db.litems = db.litems.filter(x => x !== i); db.lvotos = db.lvotos.filter(v => v.item !== item);
    this._amGuardar(db);
    return { r: "borrado" };
  },
  async listaItemNota(item, nota) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), i = this._lcItem(db, item, yo);
    if (!i) return { error: "no-miembro" };
    i.nota = String(nota || "").trim().slice(0, 80); this._amGuardar(db);
    return { r: "ok" };
  },
  async listaItemVisto(item, visto, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), i = this._lcItem(db, item, yo);
    if (!i) return { error: "no-miembro" };
    if (visto) { i.visto = i.visto || this._cjHoy(hoy); i.visto_por = i.visto_por || yo; }
    else {
      i.visto = null; i.visto_por = null;
      db.lvotos.forEach(v => { if (v.item === item) v.estrellas = null; });
      db.lvotos = db.lvotos.filter(v => !(v.item === item && !v.mas_uno));
    }
    this._amGuardar(db);
    return { r: visto ? "visto" : "por-ver" };
  },
  async listaItemMarcar(item, masUno, estrellas) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb(), i = this._lcItem(db, item, yo);
    if (!i) return { error: "no-miembro" };
    if (estrellas != null && !(Number.isInteger(estrellas) && estrellas >= 1 && estrellas <= 5)) return { error: "estrellas" };
    db.lvotos = db.lvotos.filter(v => !(v.item === item && v.user_id === yo));
    const e = i.visto ? (estrellas == null ? null : estrellas) : null;
    if (masUno || e != null) db.lvotos.push({ item, user_id: yo, mas_uno: !!masUno, estrellas: e });
    this._amGuardar(db);
    return { r: "ok" };
  },
  async listaLista() {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb();
    return db.lmiembros.filter(m => m.user_id === yo).sort((a, b) => a.n - b.n).map(mio => {
      const l = db.listas.find(x => x.id === mio.lista);
      return {
        id: l.id, nombre: l.nombre, tipo: l.tipo, estado: mio.estado, invita: mio.invita,
        miembros: db.lmiembros.filter(m => m.lista === l.id).sort((a, b) => (a.estado > b.estado) - (a.estado < b.estado) || a.n - b.n)
          .map(m => Object.assign(this._amFicha(db, m.user_id), { yo: m.user_id === yo, estado: m.estado })),
        items: db.litems.filter(i => i.lista === l.id).sort((a, b) => a.creado - b.creado || a.id - b.id).map(i => ({
          id: i.id, user_id: i.user_id, nombre: i.user_id ? this._amFicha(db, i.user_id).nombre : "", texto: i.texto, nota: i.nota, visto: i.visto, visto_por: i.visto_por,
          mas_uno: db.lvotos.filter(v => v.item === i.id && v.mas_uno).map(v => v.user_id),
          estrellas: db.lvotos.filter(v => v.item === i.id && v.estrellas != null).map(v => ({ id: v.user_id, n: v.estrellas })),
        })),
      };
    });
  },
  /* -------- Leer el mismo libro sin servidor: las reglas de supabase/lecturas.sql -------- */
  _ljSacar(db, l, quien) {
    db.ljmiembros = db.ljmiembros.filter(m => !(m.lectura === l && m.user_id === quien));
    if (!db.ljmiembros.some(m => m.lectura === l && m.estado === "activo")) {
      db.lecturas = db.lecturas.filter(x => x.id !== l); db.ljmiembros = db.ljmiembros.filter(m => m.lectura !== l);
    }
  },
  async lecturaCrear(titulo, autor, paginas, amigos) {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb(), t = String(titulo || "").trim(), a = String(autor || "").trim(), n = parseInt(paginas, 10);
    if (!t || t.length > 80) return { error: "titulo" };
    if (a.length > 60) return { error: "autor" };
    if (!(n >= 1 && n <= 10000)) return { error: "paginas" };
    const ids = [...new Set(amigos || [])].filter(x => x && x !== yo);
    if (!ids.length || ids.length > 7) return { error: "amigos" };
    if (ids.some(x => { const f = this._amPar(db, yo, x); return !f || f.estado !== "aceptada"; })) return { error: "no-amigos" };
    if (db.ljmiembros.filter(m => m.user_id === yo).length >= 20) return { error: "limite" };
    const id = "lj" + (db.sig++) + Date.now().toString(36);
    db.lecturas.push({ id, titulo: t, autor: a, paginas: n, creador: yo });
    db.ljmiembros.push({ lectura: id, user_id: yo, estado: "activo", invita: null, pagina: 0, terminado: null, n: db.sig++ });
    ids.forEach(x => db.ljmiembros.push({ lectura: id, user_id: x, estado: "invitado", invita: yo, pagina: 0, terminado: null, n: db.sig++ }));
    this._amGuardar(db);
    return { id };
  },
  async lecturaResponder(l, acepta) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const m = db.ljmiembros.find(x => x.lectura === l && x.user_id === yo && x.estado === "invitado");
    if (!m) return { r: "nada" };
    if (!acepta) { this._ljSacar(db, l, yo); this._amGuardar(db); return { r: "rechazado" }; }
    if (db.ljmiembros.filter(x => x.user_id === yo && x.estado === "activo").length >= 20) return { error: "limite" };
    m.estado = "activo"; this._amGuardar(db);
    return { r: "unido" };
  },
  async lecturaSalir(l) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    if (!db.ljmiembros.some(m => m.lectura === l && m.user_id === yo)) return { r: "nada" };
    this._ljSacar(db, l, yo); this._amGuardar(db);
    return { r: "salio" };
  },
  async lecturaAvance(l, pagina, hoy) {
    const yo = localStorage.getItem("rumbo_session"), db = this._amDb();
    const m = db.ljmiembros.find(x => x.lectura === l && x.user_id === yo && x.estado === "activo"), lib = db.lecturas.find(x => x.id === l);
    if (!m || !lib) return { error: "no-miembro" };
    const p = parseInt(pagina, 10); if (!(p >= 0)) return { error: "pagina" };
    const antes = m.terminado;
    m.pagina = Math.min(p, lib.paginas); m.terminado = p >= lib.paginas ? (m.terminado || this._cjHoy(hoy)) : null; m.actualizado = new Date().toISOString();
    this._amGuardar(db);
    return { pagina: m.pagina, terminado: !!m.terminado, recien: !antes && !!m.terminado };
  },
  async lecturaLista() {
    const yo = localStorage.getItem("rumbo_session"); if (!yo) return { error: "sesion" };
    const db = this._amDb();
    return db.ljmiembros.filter(m => m.user_id === yo).sort((a, b) => a.n - b.n).map(mio => {
      const l = db.lecturas.find(x => x.id === mio.lectura);
      return { id: l.id, titulo: l.titulo, autor: l.autor, paginas: l.paginas, estado: mio.estado, invita: mio.invita,
        miembros: db.ljmiembros.filter(m => m.lectura === l.id).sort((a, b) => (a.estado > b.estado) - (a.estado < b.estado) || a.n - b.n)
          .map(m => Object.assign(this._amFicha(db, m.user_id), { yo: m.user_id === yo, estado: m.estado, pagina: m.pagina, terminado: m.terminado, actualizado: m.actualizado || null })) };
    });
  },
  /* -------- Álbum del mes: sin servidor, las fotos quedan en este navegador (IndexedDB, ver album.js) -------- */
  async albumSubir() { return { ok: true, local: true }; },
  async albumUrls() { return {}; },
  async albumBorrar() { return { ok: true }; },
  async albumBorrarTodo() { return { ok: true }; },
  async deleteAccount() {
    const id = localStorage.getItem("rumbo_session"); if (!id) return { error: "No hay sesión." };
    const users = this._users(); delete users[id]; this._saveUsers(users);
    try { localStorage.removeItem("rumbo_cloud_" + id); localStorage.removeItem("rumbo_state_" + id); } catch {}
    localStorage.removeItem("rumbo_session");
    return { ok: true };
  },
};

/* ============================================================
   Supabase (producción) · requiere el <script> de supabase-js en index.html
   ============================================================ */
const SUPABASE_URL = "https://eakkoggblavtaudbzzos.supabase.co";
const SUPABASE_KEY = "sb_publishable_HQfNYK25HuN1cI9KgrKiyw_cJ6_osLk";

/* Errores al vincular Google a una cuenta existente */
function _traducirVinculo(m) {
  m = m || "";
  if (/manual linking/i.test(m)) return "Falta activar \"Allow manual linking\" en Supabase (Authentication).";
  if (/already.*(linked|exists|in use)|identity.*exists/i.test(m)) return "Ese Google ya está en otra cuenta de Rumbo. Entra con Google, elimina esa cuenta (Cuenta → Eliminar mi cuenta) y vuelve a vincular desde aquí.";
  return _traducir(m);
}
function _traducir(m) {
  m = m || "";
  if (/already registered|already exists|User already/i.test(m)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Confirma tu correo antes de entrar (revisa tu bandeja).";
  if (/email rate limit exceeded/i.test(m)) return "Se alcanzó el límite de correos por ahora. Intenta de nuevo en un rato.";
  if (/rate limit|too many|429/i.test(m)) return "Demasiados intentos. Espera un momento e intenta otra vez.";
  if (/signups?.*(disabled|not allowed)/i.test(m)) return "El registro está desactivado temporalmente.";
  if (/password/i.test(m) && /(6|characters|short|weak)/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/unable to validate email|invalid.*email|email.*invalid/i.test(m)) return "El correo no parece válido.";
  return m;
}

/* ============================================================
   Fusión de estados para concurrencia multi-dispositivo.
   Base = local (intención más reciente de ESTE dispositivo);
   se unen aditivamente las colecciones para no perder lo del otro.
   ============================================================ */
/* El álbum del mes en dos equipos: { meses: { "YYYY-MM": { estilo, portada, ts, fotos: [{ id, …, ts }], borradas: [id] } } } */
function albumMerge(l, s) {
  const lm = (l && l.meses) || {}, sm = (s && s.meses) || {}, meses = {}, copia = x => JSON.parse(JSON.stringify(x));
  new Set([...Object.keys(lm), ...Object.keys(sm)]).forEach(k => {
    const a = lm[k], b = sm[k];
    if (!a || !b) { meses[k] = copia(a || b); return; }
    const nuevo = (a.ts || 0) >= (b.ts || 0) ? a : b, otro = nuevo === a ? b : a;
    const borradas = Array.from(new Set([...(a.borradas || []), ...(b.borradas || [])])), fuera = new Set(borradas), fotos = new Map();
    (b.fotos || []).forEach(f => { if (f && f.id) fotos.set(f.id, f); });
    (a.fotos || []).forEach(f => { if (!f || !f.id) return; const o = fotos.get(f.id); if (!o || (o.ts || 0) <= (f.ts || 0)) fotos.set(f.id, f); });
    const orden = [...(nuevo.fotos || []), ...(otro.fotos || [])].map(f => f && f.id).filter((id, i, arr) => id && arr.indexOf(id) === i && !fuera.has(id));
    meses[k] = { estilo: nuevo.estilo, portada: nuevo.portada, ts: nuevo.ts || 0, fotos: orden.map(id => copia(fotos.get(id))), borradas };
  });
  return { meses };
}
/* El agua en dos equipos: los ajustes, del más nuevo; cada día junta sus vasos por id (lo borrado no vuelve).
   Un día resumido ({ ml }, pasados 14 días) se queda con el detalle si el otro lo tiene, o con el total mayor */
function aguaMerge(l, s) {
  l = l || {}; s = s || {};
  const nuevo = (l.ts || 0) >= (s.ts || 0) ? l : s, dl = l.dias || {}, ds = s.dias || {}, dias = {};
  new Set([...Object.keys(dl), ...Object.keys(ds)]).forEach(k => {
    const a = dl[k], b = ds[k];
    if (!a || !b) { dias[k] = JSON.parse(JSON.stringify(a || b)); return; }
    if (!a.r && !b.r) { dias[k] = { ml: Math.max(+a.ml || 0, +b.ml || 0) }; return; }
    const r = new Map(); [...(b.r || []), ...(a.r || [])].forEach(x => { if (x && x.id) r.set(x.id, { id: x.id, ml: +x.ml || 0, ts: x.ts || 0 }); });
    dias[k] = { r: [...r.values()].sort((x, y) => x.ts - y.ts), b: Array.from(new Set([...(a.b || []), ...(b.b || [])])) };
    if (a.p || b.p) dias[k].p = true;
    if (a.h || b.h) dias[k].h = true;
    const c = typeof a.c === "number" ? a.c : typeof b.c === "number" ? b.c : null;   // la temperatura del día (la meta de calor)
    if (c != null) dias[k].c = c;
    if (a.cp || b.cp) dias[k].cp = true;
  });
  const clima = nuevo.clima && typeof nuevo.clima === "object" ? { on: !!nuevo.clima.on, ciudad: String(nuevo.clima.ciudad || ""), lat: +nuevo.clima.lat, lon: +nuevo.clima.lon } : null;
  return { meta: +nuevo.meta || 0, vaso: +nuevo.vaso || 250, inicio: nuevo.inicio !== false, fab: nuevo.fab !== false, clima, ts: Math.max(l.ts || 0, s.ts || 0), dias };
}
/* Las alcancías en dos equipos: cada una por id; nombre, meta, fecha, estilo y destino, del ts más nuevo; los aportes se juntan
   por id y lo deshecho no vuelve; cerrada en cualquiera de los dos queda cerrada; las borradas no reviven. Ocultar, del más nuevo */
function alcMerge(l, s) {
  l = l || {}; s = s || {};
  const borradas = Array.from(new Set([...(l.borradas || []), ...(s.borradas || [])])), fuera = new Set(borradas), map = new Map();
  [...(s.lista || []), ...(l.lista || [])].forEach(a => {
    if (!a || !a.id || fuera.has(a.id)) return;
    const o = map.get(a.id); if (!o) { map.set(a.id, JSON.parse(JSON.stringify(a))); return; }
    const nuevo = (a.ts || 0) >= (o.ts || 0) ? a : o, ap = new Map();
    [...(o.aportes || []), ...(a.aportes || [])].forEach(x => { if (x && x.id) ap.set(x.id, Object.assign({}, x)); });
    map.set(a.id, Object.assign(JSON.parse(JSON.stringify(nuevo)), {
      aportes: [...ap.values()].sort((x, y) => (x.ts || 0) - (y.ts || 0)), b: Array.from(new Set([...(o.b || []), ...(a.b || [])])),
      cerrada: Math.max(+o.cerrada || 0, +a.cerrada || 0), creada: Math.min(+o.creada || +a.creada || 0, +a.creada || +o.creada || 0), ts: Math.max(o.ts || 0, a.ts || 0) }));
  });
  const nuevo = (l.ts || 0) >= (s.ts || 0) ? l : s;
  return { lista: [...map.values()].sort((x, y) => (x.creada || 0) - (y.creada || 0)), borradas, ocultar: !!nuevo.ocultar, ts: Math.max(l.ts || 0, s.ts || 0) };
}
/* Los deseos en dos equipos: cada uno por id, gana el ts más nuevo; los borrados no reviven; la espera, del ajuste más nuevo */
function deseosMerge(l, s) {
  l = l || {}; s = s || {};
  const borrados = Array.from(new Set([...(l.borrados || []), ...(s.borrados || [])])), fuera = new Set(borrados), map = new Map();
  [...(s.lista || []), ...(l.lista || [])].forEach(d => { if (!d || !d.id || fuera.has(d.id)) return; const o = map.get(d.id); if (!o || (d.ts || 0) >= (o.ts || 0)) map.set(d.id, JSON.parse(JSON.stringify(d))); });
  const nuevo = (l.ts || 0) >= (s.ts || 0) ? l : s;
  return { lista: [...map.values()], borrados, espera: nuevo.espera !== false, ts: Math.max(l.ts || 0, s.ts || 0) };
}
/* El jardín en dos equipos: las macetas y si se ve en Inicio, de lo elegido más nuevo; los trasplantes celebrados se juntan */
function jardinMerge(l, s) {
  l = l || {}; s = s || {};
  const nuevo = (l.ts || 0) >= (s.ts || 0) ? l : s, raices = {};
  [s.raices, l.raices].forEach(r => Object.entries(r || {}).forEach(([id, f]) => { if (f && (!raices[id] || String(f) < raices[id])) raices[id] = String(f); }));
  return { macetas: Array.isArray(nuevo.macetas) ? nuevo.macetas.slice(0, 3) : [], inicio: nuevo.inicio !== false, raices, ts: Math.max(l.ts || 0, s.ts || 0) };
}
function mergeStates(server, local) {
  if (!server) return local;
  if (!local) return server;
  const out = JSON.parse(JSON.stringify(local));
  // Lo que solo existe en la nube (p. ej. datos de una versión más nueva) se conserva
  Object.keys(server).forEach(k => { if (!(k in out)) out[k] = JSON.parse(JSON.stringify(server[k])); });

  // Une dos arrays de objetos por id. Conserva los solo-server; en conflicto gana
  // el más nuevo por `ts` (si existe), y si no hay ts gana local (a).
  const byId = (a, b) => {
    const map = new Map();
    (b || []).forEach(x => x && x.id != null && map.set(x.id, x));
    (a || []).forEach(x => {
      if (!x || x.id == null) return;
      const other = map.get(x.id);
      if (other && (other.ts || 0) > (x.ts || 0)) return; // el server es más nuevo: no pisar
      map.set(x.id, x);
    });
    return Array.from(map.values());
  };
  const buckets = (la, sa) => (la || []).map((arr, i) => byId(arr, (sa || [])[i] || []));

  out.lecturas = byId(local.lecturas, server.lecturas);
  out.recetas = byId(local.recetas, server.recetas);
  out.postits = byId(local.postits, server.postits);
  if (local.entrenamiento && server.entrenamiento) {
    out.entrenamiento.dias = byId(local.entrenamiento.dias, server.entrenamiento.dias);
    out.entrenamiento.registro = byId(local.entrenamiento.registro, server.entrenamiento.registro);
  }
  out.aprendizajes = byId(local.aprendizajes, server.aprendizajes);

  if (local.vida && server.vida) {
    out.vida.diario = byId(local.vida.diario, server.vida.diario);
    out.vida.ideas = byId(local.vida.ideas, server.vida.ideas);
    out.vida.relaciones = byId(local.vida.relaciones, server.vida.relaciones);
    out.vida.listas = byId(local.vida.listas, server.vida.listas).map(l => {
      const sl = (server.vida.listas || []).find(x => x.id === l.id);
      const ll = (local.vida.listas || []).find(x => x.id === l.id);
      return (sl && ll) ? { ...l, items: byId(ll.items, sl.items) } : l;
    });
  }
  if (local.finanzas && server.finanzas) out.finanzas.gastos = byId(local.finanzas.gastos, server.finanzas.gastos);

  if (Array.isArray(local.notas) && Array.isArray(server.notas)) {
    out.notas = byId(local.notas, server.notas).map(c => {
      const sc = server.notas.find(x => x.id === c.id), lc = local.notas.find(x => x.id === c.id);
      return (sc && lc) ? { ...c, items: byId(lc.items, sc.items) } : c;
    });
  }
  if (local.metas && server.metas) {
    out.metas.trimestres = buckets(local.metas.trimestres, server.metas.trimestres);
    out.metas.mensuales = buckets(local.metas.mensuales, server.metas.mensuales);
  }
  // semana: si son semanas distintas gana la más reciente; si es la misma, se unen las
  // tareas por id (gana `ts`) y se quitan las borradas en cualquiera de los dos lados.
  if (local.semana && server.semana) {
    const lw = local.semana.weekOf || "", sw = server.semana.weekOf || "";
    if (sw > lw) out.semana = JSON.parse(JSON.stringify(server.semana));
    else if (sw === lw) {
      const borr = Array.from(new Set([...(server.semana.borradas || []), ...(local.semana.borradas || [])]));
      const fuera = new Set(borr);
      out.semana.dias = buckets(local.semana.dias, server.semana.dias).map(d => d.filter(t => !fuera.has(t.id)));
      out.semana.borradas = borr;
    }
  }

  // ritual.dias: dict por fecha. Conserva días solo-server; en conflicto gana el
  // más nuevo por `ts` (si existe) para no perder el cierre hecho en otro dispositivo.
  if (local.ritual && server.ritual) {
    const sd = server.ritual.dias || {}, ld = local.ritual.dias || {}, md = {};
    new Set([...Object.keys(sd), ...Object.keys(ld)]).forEach(k => {
      const s = sd[k], l = ld[k];
      if (!s) md[k] = l; else if (!l) md[k] = s;
      else md[k] = (l.ts || 0) >= (s.ts || 0) ? l : s;
    });
    out.ritual.dias = md;

    // ritual.meses ("YYYY-MM") y ritual.trimestres ("YYYY-Qn"): apertura y cierre por separado (gana ts)
    ["meses", "trimestres"].forEach(campo => {
      const sm = server.ritual[campo] || {}, lm = local.ritual[campo] || {}, mm = {};
      new Set([...Object.keys(sm), ...Object.keys(lm)]).forEach(k => {
        const s = sm[k] || {}, l = lm[k] || {}, r = {};
        ["apertura", "cierre"].forEach(p => {
          const a = l[p], b = s[p];
          if (a || b) r[p] = !b ? a : !a ? b : ((a.ts || 0) >= (b.ts || 0) ? a : b);
        });
        mm[k] = r;
      });
      out.ritual[campo] = mm;
    });

    // ritual.semanas: por lunes ISO; plan, apertura y cierre se fusionan por separado (gana ts)
    const ss = server.ritual.semanas || {}, ls = local.ritual.semanas || {}, ws = {};
    new Set([...Object.keys(ss), ...Object.keys(ls)]).forEach(k => {
      const s = ss[k] || {}, l = ls[k] || {}, r = {};
      ["plan", "apertura", "cierre"].forEach(p => {
        const a = l[p], b = s[p];
        if (a || b) r[p] = !b ? a : !a ? b : ((a.ts || 0) >= (b.ts || 0) ? a : b);
      });
      ws[k] = r;
    });
    out.ritual.semanas = ws;
  }

  // agenda (registro diario): por fecha; en cada día se unen las tareas por id y gana
  // el cambio más reciente (ts). Las borradas quedan marcadas y no reviven.
  if (local.agenda || server.agenda) {
    const la = (local.agenda && local.agenda.dias) || {}, sa = (server.agenda && server.agenda.dias) || {};
    const dias = {};
    new Set([...Object.keys(la), ...Object.keys(sa)]).forEach(k => { dias[k] = byId(la[k] || [], sa[k] || []); });
    out.agenda = Object.assign({}, out.agenda || {}, { dias,
      recurrentes: byId((local.agenda && local.agenda.recurrentes) || [], (server.agenda && server.agenda.recurrentes) || []) });
  }

  // album (álbum del mes): por mes; las fotos por id (gana ts), las borradas no reviven; estilo y portada, el ts del mes
  if (local.album || server.album) out.album = albumMerge(local.album, server.album);
  if (local.agua || server.agua) out.agua = aguaMerge(local.agua, server.agua);
  if (local.alcancias || server.alcancias) out.alcancias = alcMerge(local.alcancias, server.alcancias);
  if (local.deseos || server.deseos) out.deseos = deseosMerge(local.deseos, server.deseos);
  if (local.jardin || server.jardin) out.jardin = jardinMerge(local.jardin, server.jardin);

  // eventos: dict por fecha -> unión de arrays de texto
  out.eventos = {};
  new Set([...Object.keys(server.eventos || {}), ...Object.keys(local.eventos || {})]).forEach(k => {
    out.eventos[k] = Array.from(new Set([...((server.eventos || {})[k] || []), ...((local.eventos || {})[k] || [])]));
  });

  // habitos.log: deep-merge mes -> hábito -> día (unión de marcas); defs por id
  if (local.habitos && server.habitos) {
    const lg = local.habitos.log || {}, sg = server.habitos.log || {}, ml = {};
    new Set([...Object.keys(lg), ...Object.keys(sg)]).forEach(mk => {
      ml[mk] = {}; const lh = lg[mk] || {}, sh = sg[mk] || {};
      new Set([...Object.keys(lh), ...Object.keys(sh)]).forEach(hid => { ml[mk][hid] = { ...(sh[hid] || {}), ...(lh[hid] || {}) }; });
    });
    out.habitos.log = ml;
    out.habitos.defs = byId(local.habitos.defs, server.habitos.defs);
    // Días de descanso y vacaciones: por id; gana el cambio más nuevo (quitar deja la marca «quitado»)
    out.habitos.descansos = byId(local.habitos.descansos, server.habitos.descansos);
    out.habitos.vacaciones = byId(local.habitos.vacaciones, server.habitos.vacaciones);
  }

  // gamif: el saldo se DERIVA del libro de movimientos (ledger), fusionado por id.
  // Nunca se toma el máximo de saldos (eso duplicaba monedas tras gastar en otro equipo).
  if (local.gamif && server.gamif) {
    const lL = Array.isArray(local.gamif.ledger), sL = Array.isArray(server.gamif.ledger);
    out.gamif.badges = Array.from(new Set([...(server.gamif.badges || []), ...(local.gamif.badges || [])]));
    // Consumibles usados: por id (ids deterministas: el mismo uso en dos equipos es uno solo)
    out.gamif.usos = JSON.parse(JSON.stringify(usosMerge(local.gamif.usos, server.gamif.usos)));
    if (lL || sL) {
      // Si un lado aún no tiene ledger (estado viejo), su saldo se ignora: el lado con
      // ledger es más nuevo por construcción (se migra al cargar).
      out.gamif.ledger = JSON.parse(JSON.stringify(
        lL && sL ? ledgerMerge(local.gamif.ledger, server.gamif.ledger) : (lL ? local.gamif.ledger : server.gamif.ledger)));
      recalcGamif(out);
      syncHabitLogFromLedger(out);
    } else {
      // Ambos anteriores al ledger: criterio conservador (menor saldo), XP no baja.
      out.gamif.puntos = Math.min(local.gamif.puntos || 0, server.gamif.puntos || 0);
      out.gamif.xp = Math.max(local.gamif.xp || 0, server.gamif.xp || 0);
      out.gamif.owned = Array.from(new Set([...(server.gamif.owned || []), ...(local.gamif.owned || [])]));
    }
  }
  // Elefante (tipo y ropa): gana el cambio más reciente; un equipo con versión antigua no lo borra
  const le = local.gamif && local.gamif.equipped && local.gamif.equipped.ele, se = server.gamif && server.gamif.equipped && server.gamif.equipped.ele;
  if (se && out.gamif && out.gamif.equipped && (!le || (se.ts || 0) > (le.ts || 0))) out.gamif.equipped.ele = JSON.parse(JSON.stringify(se));
  // Avatar: gana el cambio más reciente; un equipo con versión antigua no lo borra
  const la = local.gamif && local.gamif.equipped && local.gamif.equipped.avatar, sa = server.gamif && server.gamif.equipped && server.gamif.equipped.avatar;
  if (sa && out.gamif && out.gamif.equipped && (!la || (sa.ts || 0) > (la.ts || 0))) out.gamif.equipped.avatar = JSON.parse(JSON.stringify(sa));
  // Repisa del cuarto del elefante: gana el cambio más reciente
  const lr = local.gamif && local.gamif.equipped && local.gamif.equipped.repisa, sr = server.gamif && server.gamif.equipped && server.gamif.equipped.repisa;
  if (sr && out.gamif && out.gamif.equipped && (!lr || (sr.ts || 0) > (lr.ts || 0))) out.gamif.equipped.repisa = JSON.parse(JSON.stringify(sr));
  // Lo comprado para el cuarto (qué está guardado y el color de la pared): gana el cambio más reciente
  const lc = local.gamif && local.gamif.equipped && local.gamif.equipped.cuarto, sc = server.gamif && server.gamif.equipped && server.gamif.equipped.cuarto;
  if (sc && out.gamif && out.gamif.equipped && (!lc || (sc.ts || 0) > (lc.ts || 0))) out.gamif.equipped.cuarto = JSON.parse(JSON.stringify(sc));
  // Sesiones de enfoque: por id (cada sesión se crea en un solo equipo)
  if (local.enfoque || server.enfoque) out.enfoque = { ...(out.enfoque || {}), sesiones: JSON.parse(JSON.stringify(usosMerge((local.enfoque || {}).sesiones, (server.enfoque || {}).sesiones))) };
  // Suscripciones push: unir por endpoint (cada dispositivo tiene la suya)
  const ln = local.settings && local.settings.notif, sn = server.settings && server.settings.notif;
  if (ln && sn && out.settings && out.settings.notif) {
    const map = new Map();
    (sn.subs || []).forEach(x => x && x.endpoint && map.set(x.endpoint, x));
    (ln.subs || []).forEach(x => x && x.endpoint && map.set(x.endpoint, x));
    out.settings.notif.subs = Array.from(map.values());
  }
  // Versión de la introducción vista: nunca retrocede (Novedades se muestra una sola vez)
  if (local.settings && server.settings && out.settings) {
    const iv = Math.max(local.settings.introVersion || 0, server.settings.introVersion || 0);
    if (iv) out.settings.introVersion = iv;
  }
  // Años distintos al base (anios.js): por año. Metas se unen por id (como las del año base);
  // finanzas, salud y rueda: gana la sección editada más recientemente (ts).
  if (local.anios || server.anios) {
    const la = local.anios || {}, sa = server.anios || {}, ma = {};
    const cl = o => JSON.parse(JSON.stringify(o));
    new Set([...Object.keys(la), ...Object.keys(sa)]).forEach(y => {
      const l = la[y], s = sa[y];
      if (!l || !s) { ma[y] = cl(l || s); return; }
      const r = cl(l);
      r.metas = {
        trimestres: buckets((l.metas || {}).trimestres || [[], [], [], []], (s.metas || {}).trimestres),
        mensuales: buckets((l.metas || {}).mensuales || Array.from({ length: 12 }, () => []), (s.metas || {}).mensuales),
      };
      ["finanzas", "salud", "rueda"].forEach(k => {
        const a = l[k], b = s[k];
        if (b && (!a || (b.ts || 0) > (a.ts || 0))) r[k] = cl(b);
      });
      ma[y] = r;
    });
    out.anios = ma;
  }
  // Día del ritual semanal, módulos ocultos del menú y Google Calendar: gana el cambio más reciente
  if (local.settings && server.settings && out.settings) {
    ["ritualSemanal", "menu", "gcal"].forEach(k => {
      const lr = local.settings[k], sr = server.settings[k];
      if (sr && (!lr || (sr.ts || 0) > (lr.ts || 0))) out.settings[k] = JSON.parse(JSON.stringify(sr));
    });
  }
  // Tutorial: los recorridos vistos se suman (salvo los anteriores a un "volver a mostrar la ayuda");
  // misión y ayuda automática: gana el cambio más reciente
  if (local.settings && server.settings && out.settings && (local.settings.tutorial || server.settings.tutorial)) {
    const lt = local.settings.tutorial || {}, st = server.settings.tutorial || {};
    const gana = !local.settings.tutorial || (server.settings.tutorial && (st.ts || 0) > (lt.ts || 0)) ? st : lt;
    const r = JSON.parse(JSON.stringify(gana));
    const reset = Math.max(lt.reset || 0, st.reset || 0), vistos = {};
    [lt.vistos || {}, st.vistos || {}].forEach(v => Object.keys(v).forEach(k => { if (v[k] > reset) vistos[k] = Math.max(vistos[k] || 0, v[k]); }));
    r.vistos = vistos;
    if (reset) r.reset = reset;
    out.settings.tutorial = r;
  }
  // El resto (profile, settings, salud, rueda, ritual.pilares, entrenamiento) lo gana local.
  return out;
}

const SupabaseBackend = {
  _c: null,
  _ver: {}, // uid -> updated_at conocido del servidor (para concurrencia optimista)
  _client() {
    if (!this._c) this._c = supabase.createClient(SUPABASE_URL, SUPABASE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } });
    return this._c;
  },
  _pub(u) {
    if (!u) return null;
    const name = (u.user_metadata && u.user_metadata.name) || (u.email ? u.email.split("@")[0] : "");
    return { id: u.id, email: u.email, name };
  },
  async getSession() {
    const { data } = await this._client().auth.getSession();
    return data && data.session ? this._pub(data.session.user) : null;
  },
  async register({ name, email, password }) {
    email = (email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return { error: "Escribe un correo válido." };
    if (!password || password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
    const { data, error } = await this._client().auth.signUp({ email, password, options: { data: { name: (name || "").trim() } } });
    if (error) return { error: _traducir(error.message) };
    if (!data.session) return { info: "Cuenta creada ✅ Revisa tu correo para confirmarla y luego inicia sesión." };
    return this._pub(data.user);
  },
  async login({ email, password }) {
    const { data, error } = await this._client().auth.signInWithPassword({ email: (email || "").trim().toLowerCase(), password });
    if (error) return { error: _traducir(error.message) };
    return this._pub(data.user);
  },
  async logout() { this._ver = {}; await this._client().auth.signOut(); },
  /* Llama a una función del servidor (Supabase Edge Functions) con la sesión de la persona */
  async llamarFuncion(nombre, body) {
    const { data } = await this._client().auth.getSession();
    const jwt = data && data.session && data.session.access_token;
    if (!jwt) return { error: "sesion" };
    try {
      const r = await fetch(SUPABASE_URL + "/functions/v1/" + nombre, {
        method: "POST", body: JSON.stringify(body || {}),
        headers: { Authorization: "Bearer " + jwt, apikey: SUPABASE_KEY, "Content-Type": "application/json" } });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d.error || "http-" + r.status, status: r.status };
    } catch (e) { return { error: "red" }; }
  },
  /* Notificaciones al celular (como Fundos 360): cada dispositivo es una fila de suscripciones_push
     (supabase/notificaciones.sql); el envío lo hace api/push.js cuando la base se lo pide. */
  async pushRegistrar(d) {
    const { error } = await this._client().rpc("registrar_suscripcion_push", { p_endpoint: d.endpoint, p_p256dh: d.p256dh, p_auth: d.auth, p_dispositivo: d.dispositivo });
    return error ? { error: error.message } : { ok: true };
  },
  async pushQuitar(endpoint) {
    const { error } = await this._client().from("suscripciones_push").delete().eq("endpoint", endpoint);
    return error ? { error: error.message } : { ok: true };
  },
  /* ¿Este dispositivo sigue registrado en esta cuenta? null = no se pudo saber (sin red o sin el SQL) */
  async pushExiste(endpoint) {
    const { data, error } = await this._client().from("suscripciones_push").select("id").eq("endpoint", endpoint).maybeSingle();
    return error ? null : !!data;
  },
  async pushApi(metodo, body) {
    const { data } = await this._client().auth.getSession();
    return _pushFetch(metodo, body, data && data.session && data.session.access_token);
  },
  /* -------- Amigos (supabase/amigos.sql): lo compartido vive en tablas aparte, con reglas de acceso -------- */
  async amigosPerfil(p) {
    const { data: ses } = await this._client().auth.getSession();
    const uid = ses && ses.session && ses.session.user.id; if (!uid) return { error: "sesion" };
    const fila = { user_id: uid, nombre: String(p.nombre || "").slice(0, 60), avatar: p.avatar || null, muestra: p.muestra || {}, estado: p.estado || {},
      casa: p.casa || null, vitrina: p.vitrina || null, updated_at: new Date().toISOString() };
    if (this._sinVisitas) { delete fila.casa; delete fila.vitrina; }
    for (let i = 0; i < 4; i++) {   // el código lo pone la base; si chocara con otro (muy raro), se intenta de nuevo
      const { data, error } = await this._client().from("perfiles").upsert(fila, { onConflict: "user_id" }).select("codigo").single();
      if (!error) return { codigo: data.codigo };
      // Mientras no se corra supabase/visitas.sql, el perfil se publica sin la casa ni la vitrina
      if (!this._sinVisitas && /casa|vitrina/.test(error.message || "") && /column|schema/i.test(error.message || "")) { this._sinVisitas = true; delete fila.casa; delete fila.vitrina; continue; }
      if (!/codigo/.test(error.message || "")) return { error: _amigosError(error) };
    }
    return { error: "codigo" };
  },
  /* La casa y la vitrina de un amigo: las reglas de perfiles dejan leer solo a sus amigos */
  async amigosVisita(otro) {
    try {
      const { data, error } = await this._client().from("perfiles").select("nombre, avatar, casa, vitrina").eq("user_id", otro).maybeSingle();
      if (error) return { error: _amigosError(error) };
      return data || { error: "no-amigos" };
    } catch (e) { return { error: _amigosError(e) }; }
  },
  async _amRpc(fn, args) {
    try { const { data, error } = await this._client().rpc(fn, args || {}); return error ? { error: _amigosError(error) } : { data }; }
    catch (e) { return { error: _amigosError(e) }; }
  },
  async amigosLista() { const r = await this._amRpc("amigos_lista"); return r.error ? r : r.data; },
  async amigosBuscar(codigo) { const r = await this._amRpc("amigos_buscar", { p_codigo: codigo }); return r.error ? r : (r.data && r.data[0]) || null; },
  async amigosPedir(codigo) { const r = await this._amRpc("amigos_pedir", { p_codigo: codigo }); return r.error ? r : r.data; },
  async amigosResponder(otro, acepta) { const r = await this._amRpc("amigos_responder", { p_otro: otro, p_acepta: !!acepta }); return r.error ? r : { r: r.data }; },
  async amigosQuitar(otro) { const r = await this._amRpc("amigos_quitar", { p_otro: otro }); return r.error ? r : { r: r.data }; },
  async amigosBloquear(otro) { const r = await this._amRpc("amigos_bloquear", { p_otro: otro }); return r.error ? r : { r: r.data }; },
  async amigosAnimo(para, mensaje) { const r = await this._amRpc("amigos_animo", { p_para: para, p_mensaje: mensaje || "" }); return r.error ? r : { id: r.data }; },
  async amigosAnimosVistos() { const r = await this._amRpc("amigos_animos_vistos"); return r.error ? r : { n: r.data }; },
  /* El aviso al celular del otro (api/push.js revisa en la base que corresponda) */
  async amigosAvisar(tipo, datos) { return this.pushApi("POST", Object.assign({ accion: "amigos", tipo }, datos || {})); },
  /* -------- Hábitos en conjunto (supabase/conjunto.sql) -------- */
  async conjuntoLista() { const r = await this._amRpc("conjunto_lista"); return r.error ? r : r.data || []; },
  async conjuntoCrear(nombre, icono, frecuencia, amigos, hoy) {
    const r = await this._amRpc("conjunto_crear", { p_nombre: nombre, p_icono: icono || "", p_frecuencia: frecuencia, p_amigos: amigos, p_hoy: hoy });
    return r.error ? r : { id: r.data };
  },
  async conjuntoInvitar(h, amigos) { const r = await this._amRpc("conjunto_invitar", { p_id: h, p_amigos: amigos }); return r.error ? r : { n: r.data }; },
  async conjuntoResponder(h, acepta, hoy) { const r = await this._amRpc("conjunto_responder", { p_id: h, p_acepta: !!acepta, p_hoy: hoy }); return r.error ? r : { habito: r.data }; },
  async conjuntoSalir(h) { const r = await this._amRpc("conjunto_salir", { p_id: h }); return r.error ? r : { r: r.data }; },
  async conjuntoEditar(h, nombre, icono, frecuencia) {
    const r = await this._amRpc("conjunto_editar", { p_id: h, p_nombre: nombre, p_icono: icono || "", p_frecuencia: frecuencia });
    return r.error ? r : { r: r.data };
  },
  async conjuntoMarcar(h, fecha, hecho) { const r = await this._amRpc("conjunto_marcar", { p_id: h, p_fecha: fecha, p_hecho: !!hecho }); return r.error ? r : r.data; },
  async conjuntoDescansos(h, fechas, descansa) { const r = await this._amRpc("conjunto_descansos", { p_id: h, p_fechas: fechas, p_descansa: !!descansa }); return r.error ? r : r.data || { ok: true }; },
  /* -------- Objetivos en conjunto (supabase/objetivos.sql) -------- */
  async objetivoLista() { const r = await this._amRpc("objetivo_lista"); return r.error ? r : r.data || []; },
  async objetivoCrear(nombre, unidad, meta, fechaLimite, amigos, hoy) {
    const r = await this._amRpc("objetivo_crear", { p_nombre: nombre, p_unidad: unidad || "", p_meta: meta, p_fecha_limite: fechaLimite || null, p_amigos: amigos, p_hoy: hoy });
    return r.error ? r : { id: r.data };
  },
  async objetivoInvitar(o, amigos) { const r = await this._amRpc("objetivo_invitar", { p_id: o, p_amigos: amigos }); return r.error ? r : { n: r.data }; },
  async objetivoResponder(o, acepta, hoy) { const r = await this._amRpc("objetivo_responder", { p_id: o, p_acepta: !!acepta, p_hoy: hoy }); return r.error ? r : { r: r.data }; },
  async objetivoSalir(o) { const r = await this._amRpc("objetivo_salir", { p_id: o }); return r.error ? r : { r: r.data }; },
  async objetivoEditar(o, nombre, unidad, meta, fechaLimite) {
    const r = await this._amRpc("objetivo_editar", { p_id: o, p_nombre: nombre, p_unidad: unidad || "", p_meta: meta, p_fecha_limite: fechaLimite || null });
    return r.error ? r : r.data;
  },
  async objetivoAportar(o, cantidad, nota, hoy) { const r = await this._amRpc("objetivo_aportar", { p_id: o, p_cantidad: cantidad, p_nota: nota || "", p_hoy: hoy }); return r.error ? r : r.data; },
  async objetivoBorrarAporte(aporte) { const r = await this._amRpc("objetivo_borrar_aporte", { p_aporte: aporte }); return r.error ? r : r.data; },
  /* -------- Planes con amigos (supabase/planes.sql) -------- */
  async planLista(hoy) { const r = await this._amRpc("plan_lista", { p_hoy: hoy }); return r.error ? r : r.data || []; },
  async planCrear(p, amigos, hoy) {
    const r = await this._amRpc("plan_crear", { p_titulo: p.titulo, p_tipo: p.tipo, p_fecha: p.fecha || null, p_hora: p.hora || null,
      p_opciones: p.fecha ? null : (p.opciones || []).map(o => ({ fecha: o.fecha, hora: o.hora || "" })), p_lugar: p.lugar || "", p_enlace: p.enlace || "",
      p_tz: p.tz || "", p_amigos: amigos, p_hoy: hoy });
    return r.error ? r : { id: r.data };
  },
  async planEditar(id, p, hoy) {
    const r = await this._amRpc("plan_editar", { p_id: id, p_titulo: p.titulo, p_tipo: p.tipo, p_fecha: p.fecha || null, p_hora: p.hora || null,
      p_lugar: p.lugar || "", p_enlace: p.enlace || "", p_hoy: hoy });
    return r.error ? r : r.data;
  },
  async planInvitar(id, amigos) { const r = await this._amRpc("plan_invitar", { p_id: id, p_amigos: amigos }); return r.error ? r : { n: r.data }; },
  async planResponder(id, respuesta) { const r = await this._amRpc("plan_responder", { p_id: id, p_respuesta: respuesta }); return r.error ? r : { r: r.data }; },
  async planVotar(id, opciones) { const r = await this._amRpc("plan_votar", { p_id: id, p_opciones: opciones }); return r.error ? r : { n: r.data }; },
  async planFijar(id, opcion) { const r = await this._amRpc("plan_fijar", { p_id: id, p_opcion: opcion }); return r.error ? r : { r: r.data }; },
  async planCancelar(id) { const r = await this._amRpc("plan_cancelar", { p_id: id }); return r.error ? r : { r: r.data }; },
  async planAbiertoCrear(p, hoy) {
    const r = await this._amRpc("plan_abierto_crear", { p_titulo: p.titulo, p_tipo: p.tipo, p_fecha: p.fecha || null, p_hora: p.hora || null,
      p_lugar: p.lugar || "", p_enlace: p.enlace || "", p_tz: p.tz || "", p_hoy: hoy });
    return r.error ? r : { id: r.data };
  },
  async planSumarme(id, hoy) { const r = await this._amRpc("plan_sumarme", { p_id: id, p_hoy: hoy }); return r.error ? r : { r: r.data }; },
  async planRecordar(id, estrellas, frase, compartir, hoy) {
    const r = await this._amRpc("plan_recordar", { p_id: id, p_estrellas: estrellas, p_frase: frase || "", p_compartir: !!compartir, p_hoy: hoy });
    return r.error ? r : { r: r.data };
  },
  async planGasto(id, monto, detalle, para, pago) {
    const r = await this._amRpc("plan_gasto", { p_id: id, p_monto: monto, p_detalle: detalle || "", p_para: para, p_pago: !!pago });
    return r.error ? r : { id: r.data };
  },
  async planGastoBorrar(gasto) { const r = await this._amRpc("plan_gasto_borrar", { p_gasto: gasto }); return r.error ? r : { r: r.data }; },
  /* -------- Listas compartidas (supabase/listas.sql) -------- */
  async listaLista() { const r = await this._amRpc("lista_lista"); return r.error ? r : r.data || []; },
  async listaCrear(nombre, tipo, amigos) { const r = await this._amRpc("lista_crear", { p_nombre: nombre, p_tipo: tipo, p_amigos: amigos }); return r.error ? r : { id: r.data }; },
  async listaInvitar(l, amigos) { const r = await this._amRpc("lista_invitar", { p_id: l, p_amigos: amigos }); return r.error ? r : { n: r.data }; },
  async listaResponder(l, acepta) { const r = await this._amRpc("lista_responder", { p_id: l, p_acepta: !!acepta }); return r.error ? r : { r: r.data }; },
  async listaSalir(l) { const r = await this._amRpc("lista_salir", { p_id: l }); return r.error ? r : { r: r.data }; },
  async listaEditar(l, nombre, tipo) { const r = await this._amRpc("lista_editar", { p_id: l, p_nombre: nombre, p_tipo: tipo }); return r.error ? r : { r: r.data }; },
  async listaAgregar(l, texto, nota) { const r = await this._amRpc("lista_agregar", { p_id: l, p_texto: texto, p_nota: nota || "" }); return r.error ? r : { id: r.data }; },
  async listaItemBorrar(item) { const r = await this._amRpc("lista_item_borrar", { p_item: item }); return r.error ? r : { r: r.data }; },
  async listaItemNota(item, nota) { const r = await this._amRpc("lista_item_nota", { p_item: item, p_nota: nota || "" }); return r.error ? r : { r: r.data }; },
  async listaItemVisto(item, visto, hoy) { const r = await this._amRpc("lista_item_visto", { p_item: item, p_visto: !!visto, p_hoy: hoy }); return r.error ? r : { r: r.data }; },
  async listaItemMarcar(item, masUno, estrellas) {
    const r = await this._amRpc("lista_item_marcar", { p_item: item, p_mas_uno: !!masUno, p_estrellas: estrellas == null ? null : estrellas });
    return r.error ? r : { r: r.data };
  },
  /* -------- Leer el mismo libro (supabase/lecturas.sql) -------- */
  async lecturaLista() { const r = await this._amRpc("lectura_lista"); return r.error ? r : r.data || []; },
  async lecturaCrear(titulo, autor, paginas, amigos) {
    const r = await this._amRpc("lectura_crear", { p_titulo: titulo, p_autor: autor || "", p_paginas: paginas, p_amigos: amigos });
    return r.error ? r : { id: r.data };
  },
  async lecturaResponder(l, acepta) { const r = await this._amRpc("lectura_responder", { p_id: l, p_acepta: !!acepta }); return r.error ? r : { r: r.data }; },
  async lecturaSalir(l) { const r = await this._amRpc("lectura_salir", { p_id: l }); return r.error ? r : { r: r.data }; },
  async lecturaAvance(l, pagina, hoy) { const r = await this._amRpc("lectura_avance", { p_id: l, p_pagina: pagina, p_hoy: hoy }); return r.error ? r : r.data; },
  /* -------- Álbum del mes (supabase/album.sql): las fotos en Storage, en la carpeta privada de cada uno -------- */
  _albErr(error) { const m = String((error && error.message) || error || ""); return /bucket not found|not found/i.test(m) ? "sin-servidor" : /fetch|network|failed/i.test(m) ? "red" : m || "error"; },
  async albumSubir(ruta, blob) {
    try {
      const { error } = await this._client().storage.from("album").upload(ruta, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "31536000" });
      return error ? { error: this._albErr(error) } : { ok: true };
    } catch (e) { return { error: "red" }; }
  },
  /* Direcciones firmadas (una hora) para ver las fotos: { "ruta.jpg": url } */
  async albumUrls(rutas) {
    try {
      const { data, error } = await this._client().storage.from("album").createSignedUrls(rutas, 3600);
      if (error) return { error: this._albErr(error) };
      const out = {}; (data || []).forEach(d => { if (d && d.path && d.signedUrl) out[d.path] = d.signedUrl; });
      return out;
    } catch (e) { return { error: "red" }; }
  },
  async albumBorrar(rutas) {
    try { const { error } = await this._client().storage.from("album").remove(rutas); return error ? { error: this._albErr(error) } : { ok: true }; }
    catch (e) { return { error: "red" }; }
  },
  /* Al borrar la cuenta: todas tus fotos (carpeta por mes) */
  async albumBorrarTodo(uid) {
    try {
      const b = this._client().storage.from("album"), { data: meses } = await b.list(uid, { limit: 1000 });
      for (const m of meses || []) {
        const { data: fotos } = await b.list(`${uid}/${m.name}`, { limit: 1000 });
        if (fotos && fotos.length) await b.remove(fotos.map(f => `${uid}/${m.name}/${f.name}`));
      }
      return { ok: true };
    } catch (e) { return { error: "red" }; }
  },
  /* ¿Está activo "Iniciar sesión con Google" en Supabase? (Authentication → Providers → Google).
     Se consulta al mostrar la pantalla de acceso: así el botón aparece solo cuando funciona. */
  async googleDisponible() {
    if (this._google != null) return this._google;
    try {
      const r = await fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_KEY } });
      const d = r.ok ? await r.json() : {};
      this._google = !!(d.external && d.external.google);
    } catch (e) { return false; }   // sin conexión: se vuelve a preguntar la próxima vez
    return this._google;
  },
  /* Va a Google y vuelve a Rumbo; supabase-js termina la sesión al volver (detectSessionInUrl).
     Si el correo de Google ya tiene cuenta en Rumbo, Supabase las une: son los mismos datos. */
  async loginGoogle() {
    const { error } = await this._client().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } },
    });
    return error ? { error: _traducir(error.message) } : { ok: true };
  },
  /* Formas de entrar de la cuenta actual: [{ provider: "email" | "google", email }] */
  async identidades() {
    const { data, error } = await this._client().auth.getUserIdentities();
    if (error || !data) return [];
    return (data.identities || []).map(i => ({ provider: i.provider, email: (i.identity_data && i.identity_data.email) || "" }));
  },
  /* Agrega Google como otra forma de entrar a ESTA cuenta (aunque el correo sea distinto).
     Requiere "Allow manual linking" en Supabase. Va a Google y vuelve a Cuenta. */
  async vincularGoogle() {
    const { error } = await this._client().auth.linkIdentity({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname + "?vincular=1", queryParams: { prompt: "select_account" } },
    });
    return error ? { error: _traducirVinculo(error.message) } : { ok: true };
  },
  async loadState(uid) {
    const { data, error } = await this._client().from("estado_usuario").select("data, updated_at").eq("user_id", uid).maybeSingle();
    if (error) { console.warn("loadState", error.message); return null; }
    if (data) this._ver[uid] = data.updated_at;   // recordar versión del servidor
    return data ? data.data : null;
  },
  async saveState(uid, state) {
    const client = this._client();
    const now = new Date().toISOString();
    const known = this._ver[uid];
    // Con versión conocida: update condicional (solo si nadie escribió en el intermedio)
    if (known) {
      const { data, error } = await client.from("estado_usuario")
        .update({ data: state, updated_at: now }).eq("user_id", uid).eq("updated_at", known)
        .select("updated_at");
      if (error) { console.warn("saveState", error.message); return { error: error.message }; }
      if (data && data.length) { this._ver[uid] = data[0].updated_at; return { ok: true }; } // guardado OK
      return await this._saveWithMerge(uid, state); // conflicto -> fusionar
    }
    // Sin versión conocida: puede existir una fila más nueva (p. ej. tras refrescar el
    // token con la app abierta). Leer antes de escribir para no pisar datos del otro
    // dispositivo: si ya hay fila, fusionar; si no, insertar.
    const { data: row } = await client.from("estado_usuario").select("updated_at").eq("user_id", uid).maybeSingle();
    if (row) { this._ver[uid] = row.updated_at; return await this._saveWithMerge(uid, state); }
    const { data, error } = await client.from("estado_usuario")
      .upsert({ user_id: uid, data: state, updated_at: now }).select("updated_at");
    if (error) { console.warn("saveState", error.message); return { error: error.message }; }
    if (data && data.length) this._ver[uid] = data[0].updated_at;
    return { ok: true };
  },
  async _saveWithMerge(uid, localState) {
    const client = this._client();
    for (let intento = 0; intento < 3; intento++) {
      const { data: row, error: e1 } = await client.from("estado_usuario").select("data, updated_at").eq("user_id", uid).maybeSingle();
      if (e1 || !row) { console.warn("saveState merge (lectura)", e1 && e1.message); return { error: e1 ? e1.message : "sin fila" }; }
      const merged = mergeStates(row.data, localState);
      if (typeof migrate === "function") migrate(merged);   // normaliza y recalcula derivados (monedas)
      const now = new Date().toISOString();
      const { data, error } = await client.from("estado_usuario")
        .update({ data: merged, updated_at: now }).eq("user_id", uid).eq("updated_at", row.updated_at)
        .select("updated_at");
      if (error) { console.warn("saveState merge", error.message); return { error: error.message }; }
      if (data && data.length) {
        this._ver[uid] = data[0].updated_at;
        // Aplicar el estado fusionado en memoria si es el usuario activo
        if (typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.id === uid && typeof STATE !== "undefined") {
          STATE = merged;
          if (typeof updateTopbar === "function") updateTopbar();
          if (typeof rerender === "function") rerender();
          if (typeof toast === "function") toast("Sincronizado con otro dispositivo ✅");
        }
        return { ok: true };
      }
      // Otro cambio en el intermedio: reintentar
    }
    console.warn("saveState merge: no se pudo tras varios intentos");
    return { error: "conflicto" };
  },
  async resetPassword(email) {
    const { error } = await this._client().auth.resetPasswordForEmail((email || "").trim().toLowerCase());
    return error ? { error: _traducir(error.message) } : { ok: true };
  },
  async updatePassword(newPass) {
    const { error } = await this._client().auth.updateUser({ password: newPass });
    return error ? { error: _traducir(error.message) } : { ok: true };
  },
  async deleteAccount() {
    const { data: ses } = await this._client().auth.getSession();
    if (ses && ses.session) await this.albumBorrarTodo(ses.session.user.id);   // 📷 tus fotos del álbum, antes que la cuenta
    const { error } = await this._client().rpc("delete_user");
    if (error) return { error: _traducir(error.message) };
    this._ver = {};
    await this._client().auth.signOut();
    return { ok: true };
  },
};

/* Backend activo. Para volver a la demo local: const BACKEND = LocalBackend; */
const BACKEND = SupabaseBackend;
