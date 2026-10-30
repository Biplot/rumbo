/* ============================================================
   Rumbo · Avisos de amigos (ánimo, solicitud y amistad aceptada)
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/amigos.sql) que el aviso corresponde. Sin dependencias de red:
   se prueban en tests/notifier.test.mjs.
   ============================================================ */
import { avisosActivos } from "./reglas.mjs";

const TZ_DEFECTO = "America/Santiago";
/* De noche no se avisa: de 22:00 a 8:00 (hora de quien recibe). El ánimo igual queda en la app. */
export const SILENCIO = { desde: 22 * 60, hasta: 8 * 60 };

function minutosLocales(tz, ahora) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ahora);
  const h = Number(p.find(x => x.type === "hour").value) % 24, m = Number(p.find(x => x.type === "minute").value);
  return h * 60 + m;
}

/* ¿Se le puede avisar ahora? Si tiene encendido el aviso «Amigos» y no es de noche donde vive */
export function puedeAvisarAmigo(notif, ahora = new Date()) {
  const n = notif || {};
  if (!avisosActivos(n).amigos) return false;
  let min;
  try { min = minutosLocales(n.tz || TZ_DEFECTO, ahora); } catch (e) { min = minutosLocales(TZ_DEFECTO, ahora); }
  return min >= SILENCIO.hasta && min < SILENCIO.desde;
}

/* El aviso de cada tipo; nombre es el de quien lo provoca */
export function mensajeAmigo(tipo, { nombre, mensaje } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const txt = String(mensaje || "").trim();
  if (tipo === "animo") return { title: `${quien} te mandó ánimo`, body: txt ? `«${txt}»` : "Para que sigas con todo hoy.", url: "./#amigos", tag: "rumbo-amigos-animo" };
  if (tipo === "solicitud") return { title: "Solicitud de amistad", body: `${quien} quiere sumarte a sus amigos en Rumbo.`, url: "./#amigos", tag: "rumbo-amigos-solicitud" };
  if (tipo === "aceptada") return { title: `${quien} aceptó tu solicitud`, body: "Ya son amigos en Rumbo.", url: "./#amigos", tag: "rumbo-amigos-aceptada" };
  return null;
}

/* Los cumpleaños de tus amigos (los que lo comparten en Amigos › Lo que muestras): una vez en el día,
   desde la mañana (puedeAvisarAmigo), a cada amigo suyo. El día es el de Chile. notif_sent evita repetirlo. */
export function mensajeCumple(nombre) {
  const quien = String(nombre || "").trim() || "un amigo";
  return { title: `🎂 Hoy está de cumpleaños ${quien}`, body: "Mándale un saludo desde Amigos.", url: "./#amigos", tag: "rumbo-amigo-cumple" };
}
export async function recordatoriosCumples({ sb, enviar, ahora = new Date() }) {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_DEFECTO, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  const { data: cumples, error } = await sb.from("perfiles").select("user_id, nombre").eq("estado->>cumple", dia.slice(5));
  if (error) throw new Error(error.message);
  const r = { cumples: (cumples || []).length, enviadas: 0 };
  for (const c of cumples || []) {
    const [{ data: f1, error: e1 }, { data: f2, error: e2 }] = await Promise.all([
      sb.from("amistades").select("a, b").eq("a", c.user_id).eq("estado", "aceptada"),
      sb.from("amistades").select("a, b").eq("b", c.user_id).eq("estado", "aceptada"),
    ]);
    if (e1 || e2) throw new Error((e1 || e2).message);
    for (const uid of [...(f1 || []).map(x => x.b), ...(f2 || []).map(x => x.a)]) {
      const [{ data: est }, { data: dispositivos, error: e3 }] = await Promise.all([
        sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", uid).maybeSingle(),
        sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", uid),
      ]);
      if (e3) throw new Error(e3.message);
      if (!dispositivos || !dispositivos.length || !puedeAvisarAmigo(est && est.notif, ahora)) continue;
      if ((await sb.from("notif_sent").insert({ user_id: uid, tipo: "cumple:" + c.user_id, fecha: dia })).error) continue;   // ya se le avisó hoy
      r.enviadas += ((await enviar(dispositivos, mensajeCumple(c.nombre))) || {}).enviadas || 0;
    }
  }
  return r;
}

/* El par ordenado como en la tabla amistades (a < b, igual que least/greatest de uuid en Postgres) */
export function parAmistad(x, y) {
  const a = String(x).toLowerCase(), b = String(y).toLowerCase();
  return a < b ? [a, b] : [b, a];
}
