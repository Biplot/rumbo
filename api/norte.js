/* ============================================================
   Rumbo · 🧭 Norte, tu brújula (función de Vercel): el robot de voz del escritorio habla aquí.

     POST /api/norte/   JSON UTF-8, siempre responde JSON
       { accion: "conectar", codigo: "482913", aparato, nombre }   -> { ok, token, texto }   (sin token)
       Authorization: Bearer <token>
       { accion: "hoy" }                                          -> { ok, texto, datos: { fecha, abierto, … } }
       { accion: "sumar_agua", vasos: 1 }                         (1 a 6)
       { accion: "marcar_habito", habito: "meditar" }
       { accion: "anotar", texto, tipo: "tarea" | "nota", ambito: "pro" | "per" }
       { accion: "abrir_dia", primer_bocado, energia: 1-5, ambito }
       { accion: "cerrar_dia", animo: 1-5, gratitud }
     Error: { ok: false, error, texto } con HTTP 400/401/404/429/500.

   OJO con la barra final: vercel.json tiene trailingSlash, así que /api/norte (sin barra) responde
   308 hacia /api/norte/. Norte debe llamar a /api/norte/ (o seguir el 308 repitiendo el POST).

   La lógica vive en notifier/norte.mjs (se prueba sin red en tests/norte.test.mjs). Aquí solo se
   arma el cliente de Supabase con la clave de servicio, que nunca sale del servidor: Norte tiene su
   propio token, y en la base queda solo su sha256 (supabase/norte.sql).

   Variables de entorno (las mismas de api/push.js):
     SUPABASE_SERVICE_ROLE_KEY   clave secreta de Supabase (service_role o sb_secret_…)
     SUPABASE_URL                opcional; por defecto, la de Rumbo
   ============================================================ */
"use strict";
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eakkoggblavtaudbzzos.supabase.co";
const ERROR = { ok: false, error: "error", texto: "Tuve un problema para hablar con Rumbo. Prueba de nuevo en un rato." };

let _admin = null;
function admin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.");
  if (!_admin) _admin = createClient(SUPABASE_URL, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

/* El cuerpo: Vercel ya lo trae como objeto si llegó con Content-Type: application/json; si no, se lee el texto */
function cuerpoJSON(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(Buffer.isBuffer(b) ? b.toString("utf8") : String(b || "{}")); } catch (e) { return null; }
}
/* La IP de quien llama (solo para el límite de intentos al conectarse; en la base queda con hash) */
function ipDe(req) {
  const f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return f || String(req.headers["x-real-ip"] || "") || (req.socket && req.socket.remoteAddress) || "";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "metodo", texto: "Háblame con POST." });
  const body = cuerpoJSON(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ ok: false, error: "json", texto: "No entendí lo que me mandaste." });
  try {
    const { atenderNorte } = await import("../notifier/norte.mjs");
    const r = await atenderNorte({ sb: admin(), body, autorizacion: req.headers.authorization, ip: ipDe(req) });
    return res.status(r.status).json(r.cuerpo);
  } catch (e) {
    console.error("api/norte", e);
    return res.status(500).json(ERROR);
  }
};
