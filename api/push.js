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
           { accion: "amigos", tipo: "animo", id }              -> aviso del ánimo a quien lo recibe
           { accion: "amigos", tipo: "solicitud" | "aceptada", otro } -> aviso de la solicitud o de la amistad aceptada
             (se revisa en la base que corresponda y que no se haya avisado antes: supabase/amigos.sql)
           { accion: "amigos", tipo: "conjunto-invita" | "conjunto-acepta", habito }      -> hábitos en conjunto: la invitación
           { accion: "amigos", tipo: "conjunto-marca", habito, fecha }                   y al marcar: "ya lo hizo" o "lo hicieron todos"
             (supabase/conjunto.sql)
           { accion: "amigos", tipo: "objetivo-invita" | "objetivo-acepta", objetivo }    -> objetivos en conjunto: la invitación
           { accion: "amigos", tipo: "objetivo-aporte", objetivo, aporte }               y al aportar: "sumó" o "¡lo lograron!"
             (supabase/objetivos.sql)
           { accion: "amigos", tipo: "plan-invita" | "plan-responde" | "plan-fecha" | "plan-cambio" | "plan-cancela", plan }
             -> planes con amigos: te invitan, alguien respondió, cambió (o ya tiene fecha), se canceló
             (supabase/planes.sql). El recordatorio del día («Hoy: …») sale con los demás recordatorios.
           { accion: "amigos", tipo: "lista-invita" | "lista-acepta" | "lista-agrega", lista, item? }
             -> listas compartidas: te invitan, alguien se sumó, alguien agregó algo (supabase/listas.sql)

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

/**
 * Un aviso de amigos (notifier/amigos.mjs). Solo si de verdad corresponde: el ánimo es de quien
 * llama y no se avisó; la solicitud la pidió quien llama; la amistad la aceptó quien llama.
 * Se marca como avisado antes de mandar, así nunca llega dos veces.
 */
async function avisoAmigos(config, yo, body, host) {
  const sb = admin();
  const { mensajeAmigo, puedeAvisarAmigo, parAmistad } = await import("../notifier/amigos.mjs");
  let para = null, mensaje = "";
  if (body.tipo === "animo") {
    const { data, error } = await sb.from("animos").update({ avisado: true })
      .eq("id", Number(body.id)).eq("de", yo).eq("avisado", false).select("para, mensaje").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { enviadas: 0, motivo: "ya-avisado" };
    para = data.para; mensaje = data.mensaje;
  } else if (body.tipo === "solicitud" || body.tipo === "aceptada") {
    const otro = String(body.otro || "").toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(otro) || otro === yo) return { enviadas: 0, motivo: "no-valido" };
    const [a, b] = parAmistad(yo, otro);
    const { data: fila, error } = await sb.from("amistades").select("estado, pide, avisos").eq("a", a).eq("b", b).maybeSingle();
    if (error) throw new Error(error.message);
    const corresponde = fila && (body.tipo === "solicitud" ? fila.estado === "pendiente" && fila.pide === yo : fila.estado === "aceptada" && fila.pide === otro);
    if (!corresponde) return { enviadas: 0, motivo: "no-corresponde" };
    if (fila.avisos && fila.avisos[body.tipo]) return { enviadas: 0, motivo: "ya-avisado" };
    const { error: e2 } = await sb.from("amistades").update({ avisos: Object.assign({}, fila.avisos, { [body.tipo]: true }) }).eq("a", a).eq("b", b);
    if (e2) throw new Error(e2.message);
    para = otro;
  } else return { enviadas: 0, motivo: "tipo" };
  const [{ data: perfil }, { data: est }, { data: dispositivos, error: e3 }] = await Promise.all([
    sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle(),
    sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", para).maybeSingle(),
    sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", para),
  ]);
  if (e3) throw new Error(e3.message);
  if (!dispositivos || !dispositivos.length) return { enviadas: 0, motivo: "sin-dispositivos" };
  if (!puedeAvisarAmigo(est && est.notif, new Date())) return { enviadas: 0, motivo: "silencio" };
  return enviarPush(config, dispositivos, mensajeAmigo(body.tipo, { nombre: perfil && perfil.nombre, mensaje }), host);
}

/* Un aviso de un objetivo en conjunto: notifier/objetivos.mjs revisa en la base que corresponda */
async function avisoObjetivoApi(config, yo, body, host) {
  const { avisoObjetivo } = await import("../notifier/objetivos.mjs");
  return avisoObjetivo({ sb: admin(), yo, body, enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
}

/* Un aviso de un plan con amigos: notifier/planes.mjs revisa en la base que corresponda */
async function avisoPlanApi(config, yo, body, host) {
  const { avisoPlan } = await import("../notifier/planes.mjs");
  return avisoPlan({ sb: admin(), yo, body, enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
}
/* El recordatorio de los planes de hoy. Si todavía no se corre supabase/planes.sql, no hay planes que recordar. */
async function recordatoriosPlanesApi(config, host) {
  try {
    const { recordatoriosPlanes } = await import("../notifier/planes.mjs");
    return await recordatoriosPlanes({ sb: admin(), enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
  } catch (e) {
    if (/does not exist|schema cache|Could not find/i.test(String(e && e.message))) return { planes: 0, enviadas: 0, motivo: "sin-tablas" };
    throw e;
  }
}

/* Un aviso de una lista compartida: notifier/listas.mjs revisa en la base que corresponda */
async function avisoListaApi(config, yo, body, host) {
  const { avisoLista } = await import("../notifier/listas.mjs");
  return avisoLista({ sb: admin(), yo, body, enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
}

/* Un aviso de un hábito en conjunto: notifier/conjunto.mjs revisa en la base que corresponda */
async function avisoConjuntoApi(config, yo, body, host) {
  const { avisoConjunto } = await import("../notifier/conjunto.mjs");
  return avisoConjunto({ sb: admin(), yo, body, enviar: (dispositivos, msg) => enviarPush(config, dispositivos, msg, host) });
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
      r.planes = await recordatoriosPlanesApi(config, host);
      console.log("recordatorios", JSON.stringify(r));
      return res.status(200).json(r);
    }

    /* La app: una prueba a este dispositivo (debe ser de quien llama) */
    const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!jwt) return res.status(401).json({ error: "sesion" });
    const { data: u, error: eUsuario } = await admin().auth.getUser(jwt);
    if (eUsuario || !u || !u.user) return res.status(401).json({ error: "sesion" });
    const body = cuerpoJSON(req);
    if (body.accion === "amigos" && String(body.tipo || "").startsWith("conjunto-")) return res.status(200).json(await avisoConjuntoApi(config, u.user.id, body, host));
    if (body.accion === "amigos" && String(body.tipo || "").startsWith("objetivo-")) return res.status(200).json(await avisoObjetivoApi(config, u.user.id, body, host));
    if (body.accion === "amigos" && String(body.tipo || "").startsWith("plan-")) return res.status(200).json(await avisoPlanApi(config, u.user.id, body, host));
    if (body.accion === "amigos" && String(body.tipo || "").startsWith("lista-")) return res.status(200).json(await avisoListaApi(config, u.user.id, body, host));
    if (body.accion === "amigos") return res.status(200).json(await avisoAmigos(config, u.user.id, body, host));
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
