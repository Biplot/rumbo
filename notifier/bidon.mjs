/* ============================================================
   Rumbo · Avisos del bidón con amigos (agua, tercera entrega)
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/agua.sql) que el aviso corresponde y que no se mandó ya.
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/agua-juntos.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

const litros = ml => (Math.round(Number(ml || 0) / 50) * 50 / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 });

/* El aviso de cada tipo. nombre: quien lo provoca; b: { nombre, meta_ml }; total: lo que llevan */
export function mensajeBidon(tipo, { nombre, b, total } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const h = "«" + (String((b && b.nombre) || "").trim() || "el bidón") + "»", meta = b && b.meta_ml;
  if (tipo === "bidon-invita") return { title: `${quien} te invita a llenar un bidón`, body: `${h}: ${litros(meta)} L entre todos esta semana, cada uno con su agua. Sumarse es gratis.`, url: "./#amigos", tag: "rumbo-bidon-invita" };
  if (tipo === "bidon-acepta") return { title: `${quien} se sumó a ${h}`, body: "Su agua de la semana ya cuenta. ¿Un vaso y brindan?", url: "./#amigos", tag: "rumbo-bidon-acepta" };
  if (tipo === "bidon-lleno") return { title: `🥂 ¡Llenaron ${h}!`, body: `${litros(total || meta)} L entre todos. Al terminar la semana, ⭐ para cada uno según lo que aportó.`, url: "./#amigos", tag: "rumbo-bidon-lleno" };
  return null;
}

/* El aviso que pidió la app (yo: quien llama). Quien llama tiene que estar activo en el bidón;
   la invitación la hizo quien llama; al sumarse, avisa a quien lo invitó; «lleno», solo si el bidón
   de verdad se llenó, a cada uno una vez. Solo si tienen encendido «Amigos» y no es de noche donde viven. */
export async function avisoBidon({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = String((body && body.bidon) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: b, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    sb.from("bidones").select("nombre, meta_ml, lleno").eq("id", id).maybeSingle(),
    sb.from("bidon_miembros").select("user_id, estado, invita, avisos").eq("bidon", id),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (ms || []).find(m => m.user_id === yo);
  if (!b || !mio || mio.estado !== "activo") return { enviadas: 0, motivo: "no-corresponde" };
  const av = m => (m && m.avisos && typeof m.avisos === "object" ? m.avisos : {});
  const anotar = async (uid, cambio) => {
    const m = ms.find(x => x.user_id === uid);
    const { error } = await sb.from("bidon_miembros").update({ avisos: Object.assign({}, av(m), cambio) }).eq("bidon", id).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let tipo = body.tipo, para = [], cambio = null, total = 0;
  if (tipo === "bidon-invita") {
    para = ms.filter(m => m.estado === "invitado" && m.invita === yo && !av(m).invita).map(m => m.user_id);
    cambio = { invita: true };
  } else if (tipo === "bidon-acepta") {
    if (!mio.invita || av(mio).acepta) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { acepta: true });
    para = ms.filter(m => m.user_id === mio.invita && m.estado === "activo").map(m => m.user_id);
  } else if (tipo === "bidon-lleno") {
    if (!b.lleno) return { enviadas: 0, motivo: "no-corresponde" };
    const { data: aps, error: e3 } = await sb.from("bidon_aportes").select("ml").eq("bidon", id);
    if (e3) throw new Error(e3.message);
    total = (aps || []).reduce((t, a) => t + Number(a.ml || 0), 0);
    para = ms.filter(m => m.estado === "activo" && m.user_id !== yo && !av(m).lleno).map(m => m.user_id);
    cambio = { lleno: true };
  } else return { enviadas: 0, motivo: "tipo" };
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const msg = mensajeBidon(tipo, { nombre: perfil && perfil.nombre, b, total });
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
