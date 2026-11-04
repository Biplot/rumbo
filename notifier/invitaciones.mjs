/* ============================================================
   Rumbo · Aviso de «Invita y gana»: «Bruno cerró su primer día en Rumbo»
   Lo pide la app de quien llegó invitado, apenas se activa su invitación. api/push.js lo manda
   después de revisar en la base (supabase/invitaciones.sql) que de verdad está activa y que no
   se avisó ya; le llega a quien lo invitó. Recibe el cliente de Supabase (`sb`, con la clave de
   servicio) y la forma de enviar (`enviar`), así se prueba sin red en tests/invita.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

export function mensajeInvita({ nombre } = {}) {
  const quien = String(nombre || "").trim().split(/\s+/)[0] || "Tu amigo";
  return { title: `${quien} cerró su primer día en Rumbo`, body: "Entró con tu invitación: +100 ⭐ para cada uno. Abre Rumbo para recibirlas.", url: "./#amigos", tag: "rumbo-invita" };
}

export async function avisoInvita({ sb, yo, enviar, ahora = new Date() }) {
  // se marca como avisada antes de mandar, así nunca llega dos veces
  const { data: inv, error } = await sb.from("invitaciones").update({ avisado: true })
    .eq("invitado", yo).eq("avisado", false).not("activa_at", "is", null).select("invita").maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) return { enviadas: 0, motivo: "ya-avisado" };
  const [{ data: perfil }, { data: est }, { data: dispositivos, error: e2 }] = await Promise.all([
    sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle(),
    sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", inv.invita).maybeSingle(),
    sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", inv.invita),
  ]);
  if (e2) throw new Error(e2.message);
  if (!dispositivos || !dispositivos.length) return { enviadas: 0, motivo: "sin-dispositivos" };
  if (!puedeAvisarAmigo(est && est.notif, ahora)) return { enviadas: 0, motivo: "silencio" };
  return enviar(dispositivos, mensajeInvita({ nombre: perfil && perfil.nombre }));
}
