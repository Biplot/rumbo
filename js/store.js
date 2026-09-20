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
    try { localStorage.setItem("rumbo_cloud_" + uid, JSON.stringify(state)); } catch {}
  },
  async resetPassword() { return { ok: true }; },
};

/* ============================================================
   Supabase (producción) · requiere el <script> de supabase-js en index.html
   ============================================================ */
const SUPABASE_URL = "https://eakkoggblavtaudbzzos.supabase.co";
const SUPABASE_KEY = "sb_publishable_HQfNYK25HuN1cI9KgrKiyw_cJ6_osLk";

function _traducir(m) {
  m = m || "";
  if (/already registered|already exists|User already/i.test(m)) return "Ya existe una cuenta con ese correo.";
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Confirma tu correo antes de entrar (revisa tu bandeja).";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera un momento.";
  return m;
}

const SupabaseBackend = {
  _c: null,
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
    if (!data.session) return { error: "Cuenta creada ✅. Revisa tu correo para confirmarla y luego inicia sesión." };
    return this._pub(data.user);
  },
  async login({ email, password }) {
    const { data, error } = await this._client().auth.signInWithPassword({ email: (email || "").trim().toLowerCase(), password });
    if (error) return { error: _traducir(error.message) };
    return this._pub(data.user);
  },
  async logout() { await this._client().auth.signOut(); },
  async loadState(uid) {
    const { data, error } = await this._client().from("estado_usuario").select("data").eq("user_id", uid).maybeSingle();
    if (error) { console.warn("loadState", error.message); return null; }
    return data ? data.data : null;
  },
  async saveState(uid, state) {
    const { error } = await this._client().from("estado_usuario").upsert({ user_id: uid, data: state, updated_at: new Date().toISOString() });
    if (error) console.warn("saveState", error.message);
  },
  async resetPassword(email) {
    const { error } = await this._client().auth.resetPasswordForEmail((email || "").trim().toLowerCase());
    return error ? { error: _traducir(error.message) } : { ok: true };
  },
};

/* Backend activo. Para volver a la demo local: const BACKEND = LocalBackend; */
const BACKEND = SupabaseBackend;
