/* ============================================================
   RUMBO · Función "gcal" (Supabase Edge Function)
   Mantiene conectado Google Calendar sin volver a pedir permiso cada hora.

   Cómo funciona
   · Al conectar, la app le pasa a esta función el "código" que entrega Google.
     La función lo cambia por un permiso de renovación (refresh token) usando la
     clave secreta del cliente OAuth, que vive SOLO aquí (secreto GOOGLE_CLIENT_SECRET).
   · El permiso de renovación se guarda CIFRADO (AES-GCM) en los datos internos de la
     cuenta (app_metadata.gcal): la persona no puede modificarlos y no se crea ninguna tabla.
   · Cuando el permiso de 1 hora vence, la app pide uno nuevo aquí, en silencio.
   · Solo lectura del calendario: el alcance lo fija Google al conectar (calendar.readonly).

   Acciones (POST JSON, con la sesión de Rumbo en Authorization):
     { accion: "estado" }                       -> { listo, conectado }
     { accion: "conectar", code, redirect_uri } -> { access_token, expires_in }
     { accion: "token" }                        -> { access_token, expires_in } | { error: "reconectar" }
     { accion: "desconectar" }                  -> { ok: true }

   Secretos (Supabase → Edge Functions → Secrets):
     GOOGLE_CLIENT_SECRET   la "clave secreta del cliente" de Google Cloud (obligatorio)
     GOOGLE_CLIENT_ID       opcional; por defecto, el ID de cliente de Rumbo
   SUPABASE_URL y la clave de administración (SUPABASE_SECRET_KEYS o SUPABASE_SERVICE_ROLE_KEY) los pone Supabase solo.
   ============================================================ */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ||
  "686189112913-j7ekhutggk3c6tc04jatto3udrd88g1g.apps.googleusercontent.com";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const ORIGENES = ["https://rumbo.biplot.cl", "https://biplot.github.io", "http://localhost:5178"];
const REDIRECCIONES_OK = /^(postmessage|https:\/\/rumbo\.biplot\.cl\/gcal-callback\.html|https:\/\/biplot\.github\.io\/rumbo\/gcal-callback\.html|http:\/\/localhost:5178\/gcal-callback\.html)$/;

/* Clave de administración: la nueva (SUPABASE_SECRET_KEYS) o la antigua (service_role), la que exista */
function claveAdmin() {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); if (k.default) return k.default as string; } catch { /* formato antiguo */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const admin = createClient(Deno.env.get("SUPABASE_URL")!, claveAdmin(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.includes(o) ? o : ORIGENES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

/* -------- Cifrado del permiso de renovación (clave derivada de la clave secreta) -------- */
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function llave() {
  const bruto = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rumbo-gcal:" + CLIENT_SECRET));
  return crypto.subtle.importKey("raw", bruto, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function cifrar(txt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(), new TextEncoder().encode(txt)));
  return b64(iv) + "." + b64(c);
}
async function descifrar(s: string) {
  const [iv, c] = s.split(".");
  const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await llave(), deB64(c));
  return new TextDecoder().decode(p);
}

/* -------- Google -------- */
async function google(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  return { ok: r.ok, datos: await r.json().catch(() => ({})) };
}
async function guardar(uid: string, meta: Record<string, unknown>, gcal: unknown) {
  await admin.auth.admin.updateUserById(uid, { app_metadata: { ...meta, gcal } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "método" }, 405);

  // Quién llama: la sesión de Rumbo
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: eu } = await admin.auth.getUser(jwt);
  if (eu || !u?.user) return json(req, { error: "sesion" }, 401);
  const user = u.user, meta = (user.app_metadata || {}) as Record<string, unknown>;
  const guardado = meta.gcal as { rt?: string } | undefined;

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }

  if (body.accion === "estado") return json(req, { listo: !!CLIENT_SECRET, conectado: !!guardado?.rt });
  if (!CLIENT_SECRET) return json(req, { error: "sin-configurar" }, 503);

  if (body.accion === "conectar") {
    if (!body.code || !REDIRECCIONES_OK.test(body.redirect_uri || "")) return json(req, { error: "datos" }, 400);
    const { ok, datos } = await google({ grant_type: "authorization_code", code: body.code, redirect_uri: body.redirect_uri });
    if (!ok || !datos.access_token) return json(req, { error: "google", detalle: datos.error || "" }, 400);
    if (!String(datos.scope || "").includes("calendar.readonly")) return json(req, { error: "sin-calendario" }, 400);
    // Google entrega el permiso de renovación solo la primera vez (o con prompt=consent)
    if (datos.refresh_token) await guardar(user.id, meta, { rt: await cifrar(datos.refresh_token), ts: Date.now() });
    else if (!guardado?.rt) return json(req, { error: "sin-renovacion" }, 400);
    return json(req, { access_token: datos.access_token, expires_in: datos.expires_in || 3600 });
  }

  if (body.accion === "token") {
    if (!guardado?.rt) return json(req, { error: "reconectar" }, 409);
    let rt = "";
    try { rt = await descifrar(guardado.rt); } catch { return json(req, { error: "reconectar" }, 409); }
    const { ok, datos } = await google({ grant_type: "refresh_token", refresh_token: rt });
    if (!ok || !datos.access_token) {
      // invalid_grant: la persona quitó el permiso en su cuenta de Google (o venció): hay que reconectar
      if (datos.error === "invalid_grant") { await guardar(user.id, meta, null); return json(req, { error: "reconectar" }, 409); }
      return json(req, { error: "google", detalle: datos.error || "" }, 502);
    }
    return json(req, { access_token: datos.access_token, expires_in: datos.expires_in || 3600 });
  }

  if (body.accion === "desconectar") {
    if (guardado?.rt) {
      try {
        const rt = await descifrar(guardado.rt);
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(rt), { method: "POST" });
      } catch { /* igual se borra */ }
      await guardar(user.id, meta, null);
    }
    return json(req, { ok: true });
  }

  return json(req, { error: "accion" }, 400);
});
