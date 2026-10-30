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

/* El par ordenado como en la tabla amistades (a < b, igual que least/greatest de uuid en Postgres) */
export function parAmistad(x, y) {
  const a = String(x).toLowerCase(), b = String(y).toLowerCase();
  return a < b ? [a, b] : [b, a];
}
