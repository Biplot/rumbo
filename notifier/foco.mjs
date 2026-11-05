/* ============================================================
   Rumbo · Avisos del foco (supabase/foco.sql)
   · avisosFoco: «¡Tiempo!» cuando termina el tramo de tu sesión de foco aunque cerraste la app.
     La base llama a api/push.js cada 5 minutos: aquí se mandan los que ya pasaron (una vez).
   · avisoSala: el foco con un amigo. «Ana te invita a enfocarse juntos» (a quien invitan) y
     «Bruno se sumó: parten ahora» (a quien invitó). Se revisa en la base que corresponda y que
     no se haya avisado antes.
   Reciben el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueban sin red en tests/foco.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

const primerNombre = n => String(n || "").trim().split(/\s+/)[0] || "Tu amigo";

export function mensajeFoco({ titulo, tipo } = {}) {
  const t = String(titulo || "").trim();
  if (tipo === "descanso") return { title: "⏱️ Toca un descanso", body: t ? `Terminó tu bloque de «${t}». Abre Rumbo para seguir.` : "Terminó tu bloque de foco. Abre Rumbo para seguir.", url: "./#inicio", tag: "rumbo-enfoque" };
  if (tipo === "foco") return { title: "⏱️ A enfocarse otra vez", body: t ? `Terminó el descanso: sigue con «${t}».` : "Terminó el descanso.", url: "./#inicio", tag: "rumbo-enfoque" };
  return { title: "⏱️ ¡Tiempo!", body: t ? `Terminaste tu sesión de «${t}». Abre Rumbo para cerrarla.` : "Terminaste tu sesión de foco.", url: "./#inicio", tag: "rumbo-enfoque" };
}

export async function avisosFoco({ sb, enviar, ahora = new Date() }) {
  // se marcan como avisados antes de mandar, así nunca llegan dos veces
  const { data: filas, error } = await sb.from("foco_avisos").update({ avisado: true })
    .eq("avisado", false).lte("fin", ahora.toISOString()).select("user_id, titulo, tipo");
  if (error) throw new Error(error.message);
  let enviadas = 0;
  for (const f of filas || []) {
    const { data: dispositivos, error: e2 } = await sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", f.user_id);
    if (e2) throw new Error(e2.message);
    if (!dispositivos || !dispositivos.length) continue;
    const r = await enviar(dispositivos, mensajeFoco(f));
    enviadas += (r && r.enviadas) || 0;
  }
  return { avisos: (filas || []).length, enviadas };
}

export function mensajeSala({ tipo, nombre, min, titulo } = {}) {
  const quien = primerNombre(nombre);
  if (tipo === "foco-acepta") return { title: `${quien} se sumó: parten ahora`, body: titulo ? `${quien} se enfoca en «${titulo}» mientras tú en lo tuyo.` : "Abre Rumbo para ver tu sesión juntos.", url: "./#inicio", tag: "rumbo-foco" };
  return { title: `${quien} te invita a enfocarse juntos`, body: `${min || 25} min, cada uno en lo suyo${titulo ? ` (${quien}: «${titulo}»)` : ""}. La invitación dura 15 minutos.`, url: "./#inicio", tag: "rumbo-foco" };
}

export async function avisoSala({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = parseInt(body && body.sala, 10), tipo = body && body.tipo;
  if (!id || (tipo !== "foco-invita" && tipo !== "foco-acepta")) return { enviadas: 0, motivo: "no-valido" };
  const campo = tipo === "foco-invita" ? "avisado_invita" : "avisado_acepta";
  let q = sb.from("foco_salas").update({ [campo]: true }).eq("id", id).eq(campo, false);
  q = tipo === "foco-invita" ? q.eq("anfitrion", yo).eq("estado", "invitada") : q.eq("invitado", yo).eq("estado", "activa");
  const { data: s, error } = await q.select("anfitrion, invitado, min, titulo_a, titulo_b").maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) return { enviadas: 0, motivo: "ya-avisado" };
  const para = tipo === "foco-invita" ? s.invitado : s.anfitrion;
  const [{ data: perfil }, { data: est }, { data: dispositivos, error: e2 }] = await Promise.all([
    sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle(),
    sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", para).maybeSingle(),
    sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", para),
  ]);
  if (e2) throw new Error(e2.message);
  if (!dispositivos || !dispositivos.length) return { enviadas: 0, motivo: "sin-dispositivos" };
  if (!puedeAvisarAmigo(est && est.notif, ahora)) return { enviadas: 0, motivo: "silencio" };
  return enviar(dispositivos, mensajeSala({ tipo, nombre: perfil && perfil.nombre, min: s.min, titulo: tipo === "foco-invita" ? s.titulo_a : s.titulo_b }));
}
