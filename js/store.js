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
/* Errores de Amigos en palabras de la app: sin-servidor (falta correr supabase/amigos.sql), red, limite, no-amigos */
function _amigosError(e) {
  const m = String((e && (e.message || e.details)) || e || "");
  if (/limite/.test(m)) return "limite";
  if (/no-amigos/.test(m)) return "no-amigos";
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
    const vacia = { perfiles: {}, amistades: [], animos: [], sig: 1 };
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
    db.perfiles[yo] = { user_id: yo, codigo, nombre: String(p.nombre || "").slice(0, 60), avatar: p.avatar || null, muestra: p.muestra || {}, estado: p.estado || {} };
    this._amGuardar(db);
    return { codigo };
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
    const fila = { user_id: uid, nombre: String(p.nombre || "").slice(0, 60), avatar: p.avatar || null, muestra: p.muestra || {}, estado: p.estado || {}, updated_at: new Date().toISOString() };
    for (let i = 0; i < 3; i++) {   // el código lo pone la base; si chocara con otro (muy raro), se intenta de nuevo
      const { data, error } = await this._client().from("perfiles").upsert(fila, { onConflict: "user_id" }).select("codigo").single();
      if (!error) return { codigo: data.codigo };
      if (!/codigo/.test(error.message || "")) return { error: _amigosError(error) };
    }
    return { error: "codigo" };
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
    const { error } = await this._client().rpc("delete_user");
    if (error) return { error: _traducir(error.message) };
    this._ver = {};
    await this._client().auth.signOut();
    return { ok: true };
  },
};

/* Backend activo. Para volver a la demo local: const BACKEND = LocalBackend; */
const BACKEND = SupabaseBackend;
