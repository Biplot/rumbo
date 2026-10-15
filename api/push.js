/* ============================================================
   Rumbo · Notificaciones al celular (función de Vercel), igual que Fundos 360
   (app/api/avisos/push + lib/push/servidor.ts).

   La base (Supabase) llama aquí cada 5 minutos con pg_cron + pg_net
   (supabase/notificaciones.sql), firmando con el secreto de configuracion_push.
   Aquí se ve a quién le toca un recordatorio (notifier/recordatorios.mjs) y se
   le envía con Web Push a cada dispositivo suyo (tabla suscripciones_push).

     GET                                    -> { clave }  clave pública para activar (la app la pide)
     POST  x-push-secreto: <secreto>         -> { usuarios, en_hora, enviados, ... }  (solo la base)
     POST  Authorization: Bearer <sesión>
           { accion: "prueba", endpoint }    -> { enviadas, fallidas, borradas }  prueba a ESTE dispositivo

   Variables de entorno (Vercel → Settings → Environment Variables):
     SUPABASE_SERVICE_ROLE_KEY   clave secreta de Supabase (service_role o sb_secret_…)
     SUPABASE_URL                opcional; por defecto, la de Rumbo
   El secreto y las claves VAPID viven en configuracion_push (las claves se
   generan aquí la primera vez), nunca en el repo ni en el navegador.
   ============================================================ */
"use strict";
const { createHash, timingSafeEqual } = require("crypto");
const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://eakkoggblavtaudbzzos.supabase.co";
const RUTA = "/api/push/";
// Un recordatorio que no alcanza a llegar en 2 horas (celular apagado) ya no sirve.
const TTL = 2 * 60 * 60;
const PRUEBA = { title: "🔔 Prueba de Rumbo", body: "Así te llegarán tus recordatorios a este dispositivo.", url: "./#notif", tag: "rumbo-prueba" };

let _admin = null;
function admin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.");
  if (!_admin) _admin = createClient(SUPABASE_URL, clave, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

/* La fila única de configuracion_push; la primera vez se generan las claves VAPID. */
async function obtenerConfiguracion() {
  const sb = admin();
  const leer = () => sb.from("configuracion_push").select("secreto, url_envio, vapid_publica, vapid_privada").eq("id", true).maybeSingle();
  let { data, error } = await leer();
  if (error) throw new Error(`No se pudo leer configuracion_push (¿se corrió supabase/notificaciones.sql?): ${error.message}`);
  if (!data) throw new Error("configuracion_push no tiene su fila (vuelve a correr supabase/notificaciones.sql).");
  if (!data.vapid_publica || !data.vapid_privada) {
    // El filtro evita pisar las de otra llamada que las haya generado al mismo tiempo; después se relee.
    const k = webpush.generateVAPIDKeys();
    const { error: eClaves } = await sb.from("configuracion_push")
      .update({ vapid_publica: k.publicKey, vapid_privada: k.privateKey, updated_at: new Date().toISOString() })
      .eq("id", true).is("vapid_publica", null);
    ({ data, error } = await leer());
    if (eClaves || error || !data || !data.vapid_publica || !data.vapid_privada) {
      throw new Error(`No se pudieron guardar las claves de las notificaciones: ${((eClaves || error) || {}).message || "la fila quedó sin claves"}`);
    }
  }
  return data;
}

/* En tiempo constante y sobre los hashes. */
function secretoValido(recibido, esperado) {
  if (!recibido || !esperado) return false;
  const a = createHash("sha256").update(String(recibido)).digest();
  const b = createHash("sha256").update(String(esperado)).digest();
  return timingSafeEqual(a, b);
}

/* La base necesita saber a qué dirección llamar: se anota sola la primera vez que
   alguien activa las notificaciones en producción (nunca desde una vista previa) y
   solo con el dominio de Rumbo, para que nadie la desvíe falseando el encabezado Host. */
const DOMINIO = process.env.PUSH_DOMINIO || "rumbo.biplot.cl";
async function anotarUrlEnvio(config, host) {
  if (process.env.VERCEL_ENV !== "production" || String(host || "").toLowerCase() !== DOMINIO) return;
  const url = `https://${host}${RUTA}`;
  if (config.url_envio === url) return;
  const { error } = await admin().from("configuracion_push").update({ url_envio: url, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) console.error("No se pudo anotar la dirección de las notificaciones:", error.message);
  else config.url_envio = url;
}

/* Los servicios de notificaciones piden una dirección de contacto: la de la app. */
function asunto(config, host) {
  if (config.url_envio) return new URL(config.url_envio).origin;
  if (host) return `https://${host}`;
  return "https://rumbo.biplot.cl";
}

/**
 * Manda el aviso a esos dispositivos. Los que el servicio de notificaciones da por
 * muertos (404/410: se desinstaló la app o se quitó el permiso) se borran; los demás
 * errores quedan anotados en la fila para revisarlos.
 */
async function enviarPush(config, dispositivos, mensaje, host) {
  const sb = admin();
  const cuerpo = JSON.stringify(mensaje);
  const opciones = {
    vapidDetails: { subject: asunto(config, host), publicKey: config.vapid_publica, privateKey: config.vapid_privada },
    TTL,
    urgency: "high",
  };
  let enviadas = 0, fallidas = 0;
  const muertas = [];
  await Promise.all(dispositivos.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo, opciones);
      enviadas++;
      await sb.from("suscripciones_push").update({ ultimo_envio_at: new Date().toISOString(), ultimo_error: null }).eq("id", s.id);
    } catch (err) {
      const status = err && err.statusCode;
      if (status === 404 || status === 410) { muertas.push(s.id); return; }
      fallidas++;
      const texto = `${status || ""} ${(err && err.message) || err}`.trim().slice(0, 300);
      console.error("push", texto, String(s.endpoint).slice(0, 40));
      await sb.from("suscripciones_push").update({ ultimo_error: texto }).eq("id", s.id);
    }
  }));
  if (muertas.length) await sb.from("suscripciones_push").delete().in("id", muertas);
  return { enviadas, fallidas, borradas: muertas.length };
}

function cuerpoJSON(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const host = req.headers["x-forwarded-host"] || req.headers.host || null;
  try {
    if (req.method === "GET") {
      const config = await obtenerConfiguracion();
      await anotarUrlEnvio(config, host);
      return res.status(200).json({ clave: config.vapid_publica });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
    const config = await obtenerConfiguracion();

    /* La base: los recordatorios que tocan ahora */
    if (req.headers["x-push-secreto"] != null) {
      if (!secretoValido(req.headers["x-push-secreto"], config.secreto)) return res.status(401).json({ error: "No autorizado" });
      const { enviarRecordatorios } = await import("../notifier/recordatorios.mjs");
      const r = await enviarRecordatorios({ sb: admin(), enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
      console.log("recordatorios", JSON.stringify(r));
      return res.status(200).json(r);
    }

    /* La app: una prueba a este dispositivo (debe ser de quien llama) */
    const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return res.status(401).json({ error: "sesion" });
    const { data: u, error: eUsuario } = await admin().auth.getUser(jwt);
    if (eUsuario || !u || !u.user) return res.status(401).json({ error: "sesion" });
    const body = cuerpoJSON(req);
    if (body.accion !== "prueba" || typeof body.endpoint !== "string") return res.status(400).json({ error: "Acción no válida" });
    const { data: fila, error: eFila } = await admin().from("suscripciones_push")
      .select("id, endpoint, p256dh, auth").eq("endpoint", body.endpoint).eq("user_id", u.user.id).maybeSingle();
    if (eFila) throw new Error(eFila.message);
    if (!fila) return res.status(404).json({ error: "no-registrado" });
    return res.status(200).json(await enviarPush(config, [fila], PRUEBA, host));
  } catch (e) {
    console.error("api/push", e);
    return res.status(500).json({ error: (e && e.message) || "error" });
  }
};
