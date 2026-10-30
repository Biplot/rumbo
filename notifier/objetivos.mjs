/* ============================================================
   Rumbo · Avisos de los objetivos en conjunto (Amigos, etapa 3)
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/objetivos.sql) que el aviso corresponde y que no se mandó ya.
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/objetivos.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

/* "$380.000", "64 km", "12,5 horas" (como ojFmt de la app) */
export function fmtObjetivo(n, unidad) {
  const v = Math.round(Number(n || 0) * 100) / 100;
  if (unidad === "$") return "$" + Math.round(v).toLocaleString("es-CL");
  const t = v.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  return unidad ? t + " " + unidad : t;
}

/* El aviso de cada tipo. nombre: quien lo provoca; o: { nombre, unidad, meta }; total: lo aportado */
export function mensajeObjetivo(tipo, { nombre, o, total, cantidad } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const h = "«" + (String((o && o.nombre) || "").trim() || "su objetivo") + "»";
  const u = o && o.unidad, meta = o && o.meta;
  const url = "./#metas";
  if (tipo === "objetivo-invita") return { title: `${quien} te invita a un objetivo`, body: `${h}: lograr ${fmtObjetivo(meta, u)} juntos en Rumbo.`, url: "./#amigos", tag: "rumbo-objetivo-invita" };
  if (tipo === "objetivo-acepta") return { title: `${quien} se sumó a ${h}`, body: "Ya suman juntos: cada aporte se ve en la barra.", url, tag: "rumbo-objetivo-acepta" };
  if (tipo === "aporte") {
    const pct = meta ? Math.min(100, Math.floor((total / meta) * 100)) : 0;
    return { title: `${quien} sumó ${fmtObjetivo(cantidad, u)} a ${h}`, body: `Van ${fmtObjetivo(total, u)} de ${fmtObjetivo(meta, u)} (${pct} %).`, url, tag: "rumbo-objetivo-aporte" };
  }
  if (tipo === "cumplido") return { title: `¡Lo lograron! ${h}`, body: `Juntaron ${fmtObjetivo(total, u)} entre todos. +20 ⭐ para cada uno y una medalla en tu vitrina.`, url, tag: "rumbo-objetivo-cumplido" };
  return null;
}

/* Al aportar: si con eso se logró, "cumplido" para los demás (una vez por objetivo); si no,
   "aporte" para los demás, a cada uno una vez por día (avisos.aporte guarda la fecha) */
export function destinatariosAporte({ miembros, yo, cumplido, fecha }) {
  const otros = (miembros || []).filter(m => m.estado === "activo" && m.user_id !== yo);
  const av = m => (m.avisos && typeof m.avisos === "object" ? m.avisos : {});
  if (cumplido) return { tipo: "cumplido", para: otros.filter(m => !av(m).cumplido).map(m => m.user_id), cambio: { cumplido: true } };
  return { tipo: "aporte", para: otros.filter(m => av(m).aporte !== fecha).map(m => m.user_id), cambio: { aporte: fecha } };
}

/* El aviso que pidió la app (yo: quien llama). Quien llama tiene que estar activo en el objetivo;
   la invitación la hizo quien llama; al sumarse, avisa a quien lo invitó; el aporte tiene que ser
   suyo y de los últimos minutos. Solo si tienen encendido «Amigos» y no es de noche donde viven. */
export async function avisoObjetivo({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = String((body && body.objetivo) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: o, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    sb.from("objetivos_conjunto").select("nombre, unidad, meta, cumplido").eq("id", id).maybeSingle(),
    sb.from("objetivos_conjunto_miembros").select("user_id, estado, invita, avisos").eq("objetivo", id),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (ms || []).find(m => m.user_id === yo);
  if (!o || !mio || mio.estado !== "activo") return { enviadas: 0, motivo: "no-corresponde" };
  o.meta = Number(o.meta);
  const anotar = async (uid, cambio) => {
    const m = ms.find(x => x.user_id === uid);
    const { error } = await sb.from("objetivos_conjunto_miembros").update({ avisos: Object.assign({}, m.avisos, cambio) }).eq("objetivo", id).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let tipo = body.tipo, para = [], cambio = null, total = 0, cantidad = 0;
  if (tipo === "objetivo-invita") {
    para = ms.filter(m => m.estado === "invitado" && m.invita === yo && !(m.avisos && m.avisos.invita)).map(m => m.user_id);
    cambio = { invita: true };
  } else if (tipo === "objetivo-acepta") {
    if (!mio.invita || (mio.avisos && mio.avisos.acepta)) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { acepta: true });
    para = ms.filter(m => m.user_id === mio.invita && m.estado === "activo").map(m => m.user_id);
  } else if (tipo === "objetivo-aporte") {
    const aporte = parseInt(body.aporte, 10);
    const { data: ap, error: e3 } = await sb.from("objetivos_conjunto_aportes").select("cantidad, fecha, creado").eq("id", aporte).eq("objetivo", id).eq("user_id", yo).maybeSingle();
    if (e3) throw new Error(e3.message);
    if (!ap || ahora - new Date(ap.creado) > 15 * 60000) return { enviadas: 0, motivo: "no-corresponde" };
    const { data: aps, error: e4 } = await sb.from("objetivos_conjunto_aportes").select("cantidad").eq("objetivo", id);
    if (e4) throw new Error(e4.message);
    total = (aps || []).reduce((t, a) => t + Number(a.cantidad), 0); cantidad = Number(ap.cantidad);
    const d = destinatariosAporte({ miembros: ms, yo, cumplido: !!o.cumplido, fecha: String(ap.fecha) });
    tipo = d.tipo; para = d.para; cambio = d.cambio;
  } else return { enviadas: 0, motivo: "tipo" };
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const msg = mensajeObjetivo(tipo, { nombre: perfil && perfil.nombre, o, total, cantidad });
  let enviadas = 0;
  for (const uid of para) {
    const [{ data: est }, { data: dispositivos, error: e5 }] = await Promise.all([
      sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", uid).maybeSingle(),
      sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", uid),
    ]);
    if (e5) throw new Error(e5.message);
    if (!dispositivos || !dispositivos.length || !puedeAvisarAmigo(est && est.notif, ahora)) continue;
    if (cambio) await anotar(uid, cambio);
    enviadas += ((await enviar(dispositivos, msg)) || {}).enviadas || 0;
  }
  return { enviadas };
}
