/* ============================================================
   Rumbo · Avisos de la biblioteca: «Ana te recomendó un libro»
   Lo manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/biblioteca.sql) que la recomendación es de quien llama y que no se avisó ya.
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/biblioteca.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

export function mensajeLibro({ nombre, titulo, autor } = {}) {
  const quien = String(nombre || "").trim().split(/\s+/)[0] || "Un amigo";
  const t = String(titulo || "").trim() || "un libro";
  return { title: `${quien} te recomendó un libro`, body: `«${t}»${autor ? ` de ${String(autor).trim()}` : ""}: quedó en tu «Por leer».`, url: "./#lecturas", tag: "rumbo-libro-recomienda" };
}

export async function avisoLibro({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = parseInt(body && body.id, 10);
  if (!(id > 0)) return { enviadas: 0, motivo: "no-valido" };
  // se marca como avisada antes de mandar, así nunca llega dos veces
  const { data: rec, error } = await sb.from("libro_recomendaciones").update({ avisado: true })
    .eq("id", id).eq("de", yo).eq("avisado", false).select("para, titulo, autor").maybeSingle();
  if (error) throw new Error(error.message);
  if (!rec) return { enviadas: 0, motivo: "ya-avisado" };
  const [{ data: perfil }, { data: est }, { data: dispositivos, error: e2 }] = await Promise.all([
    sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle(),
    sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", rec.para).maybeSingle(),
    sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", rec.para),
  ]);
  if (e2) throw new Error(e2.message);
  if (!dispositivos || !dispositivos.length) return { enviadas: 0, motivo: "sin-dispositivos" };
  if (!puedeAvisarAmigo(est && est.notif, ahora)) return { enviadas: 0, motivo: "silencio" };
  return enviar(dispositivos, mensajeLibro({ nombre: perfil && perfil.nombre, titulo: rec.titulo, autor: rec.autor }));
}
