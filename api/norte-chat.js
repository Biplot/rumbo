/* ============================================================
   Rumbo · 🧭 Norte, tu brújula: la charla (función de Vercel). Norte-Desk le escribe o le habla a Norte aquí.

     POST /api/norte-chat/   JSON UTF-8, con el mismo token de /api/norte/ (Authorization: Bearer <token>)
       { accion: "charla", texto, historial, puede? }   -> { ok, texto, cara, hizo }   (puede: ["foco"]: empezar un foco)
       { accion: "oir", audio }                 -> { ok, texto }
       { accion: "hablar", texto, voz }         -> { ok, audio, tipo }
     Error: { ok: false, error, texto } con HTTP 400/401/429/500/503.

   OJO con la barra final, igual que /api/norte/ (vercel.json tiene trailingSlash).

   La lógica vive en notifier/norte-chat.mjs (se prueba sin red en tests/norte-chat.test.mjs). Las claves
   nunca salen del servidor.

   Variables de entorno:
     SUPABASE_SERVICE_ROLE_KEY   la misma de api/push.js y api/norte.js
     ANTHROPIC_API_KEY           Claude (el cerebro). Sin ella, la charla responde «sin-cerebro»
     AZURE_SPEECH_KEY            Azure (el oído y la voz), la misma de Atlas. Sin ella, «sin-voz»
     AZURE_SPEECH_REGION         la región de esa clave (por ejemplo, brazilsouth)
   ============================================================ */
"use strict";
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eakkoggblavtaudbzzos.supabase.co";
const ERROR = { ok: false, error: "error", texto: "Tuve un problema para hablar con Rumbo. Prueba de nuevo en un rato." };

let _admin = null, _claude = null;
function admin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.");
  if (!_admin) _admin = createClient(SUPABASE_URL, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}
/* El cliente de Claude: lee ANTHROPIC_API_KEY del entorno. null si no está */
async function claude() {
  if (!String(process.env.ANTHROPIC_API_KEY || "").trim()) return null;
  if (!_claude) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    _claude = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  }
  return _claude;
}

function cuerpoJSON(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(Buffer.isBuffer(b) ? b.toString("utf8") : String(b || "{}")); } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "metodo", texto: "Háblame con POST." });
  const body = cuerpoJSON(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ ok: false, error: "json", texto: "No entendí lo que me mandaste." });
  try {
    const { atenderCharla, crearAzure } = await import("../notifier/norte-chat.mjs");
    const r = await atenderCharla({
      sb: admin(), body, autorizacion: req.headers.authorization,
      claude: await claude(),
      azure: crearAzure({ clave: process.env.AZURE_SPEECH_KEY, region: process.env.AZURE_SPEECH_REGION }),
    });
    return res.status(r.status).json(r.cuerpo);
  } catch (e) {
    console.error("api/norte-chat", e);
    return res.status(500).json(ERROR);
  }
};
