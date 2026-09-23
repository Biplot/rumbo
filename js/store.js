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

const LocalBackend = {
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
  if (local.semana && server.semana) out.semana.dias = buckets(local.semana.dias, server.semana.dias);

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
  // Suscripciones push: unir por endpoint (cada dispositivo tiene la suya)
  const ln = local.settings && local.settings.notif, sn = server.settings && server.settings.notif;
  if (ln && sn && out.settings && out.settings.notif) {
    const map = new Map();
    (sn.subs || []).forEach(x => x && x.endpoint && map.set(x.endpoint, x));
    (ln.subs || []).forEach(x => x && x.endpoint && map.set(x.endpoint, x));
    out.settings.notif.subs = Array.from(map.values());
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
