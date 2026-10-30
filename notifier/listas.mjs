/* ============================================================
   Rumbo · Avisos de las listas compartidas con amigos
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/listas.sql) que el aviso corresponde y que no se mandó ya: te invitan,
   alguien se sumó y alguien agregó algo (a cada uno, uno al día por lista).
   Con el aviso «Amigos» y nunca de noche (puedeAvisarAmigo).
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/listas.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

/* El aviso de cada tipo. nombre: quien lo provoca; l: la lista; texto: lo que agregó */
export function mensajeLista(tipo, { nombre, l, texto } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const n = "«" + (String((l && l.nombre) || "").trim() || "su lista") + "»";
  const url = "./#listas";
  if (tipo === "lista-invita") return { title: `${quien} te invita a una lista`, body: `${n}: la arman entre todos en Rumbo.`, url: "./#amigos", tag: "rumbo-lista-invita" };
  if (tipo === "lista-acepta") return { title: `${quien} se sumó a ${n}`, body: "Ahora también puede agregar y darle +1 a lo que quiere.", url, tag: "rumbo-lista-acepta" };
  if (tipo === "lista-agrega") return { title: `${quien} agregó algo a ${n}`, body: `«${String(texto || "").trim()}». ¿Le das +1?`, url, tag: "rumbo-lista-agrega" };
  return null;
}

/* Al agregar: a los demás de la lista, una vez al día cada uno (avisos.agrega guarda la fecha) */
export function destinatariosAgrega({ miembros, yo, fecha }) {
  const av = m => (m.avisos && typeof m.avisos === "object" ? m.avisos : {});
  return (miembros || []).filter(m => m.estado === "activo" && m.user_id !== yo && av(m).agrega !== fecha).map(m => m.user_id);
}

/* El aviso que pidió la app (yo: quien llama, activo en la lista). La invitación la hizo quien llama;
   al sumarse, avisa a quien lo invitó; lo agregado tiene que ser suyo y de los últimos minutos. */
export async function avisoLista({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = String((body && body.lista) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: l, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    sb.from("listas_compartidas").select("nombre, tipo").eq("id", id).maybeSingle(),
    sb.from("listas_compartidas_miembros").select("user_id, estado, invita, avisos").eq("lista", id),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (ms || []).find(m => m.user_id === yo);
  if (!l || !mio || mio.estado !== "activo") return { enviadas: 0, motivo: "no-corresponde" };
  const anotar = async (uid, cambio) => {
    const m = ms.find(x => x.user_id === uid);
    const { error } = await sb.from("listas_compartidas_miembros").update({ avisos: Object.assign({}, m.avisos, cambio) }).eq("lista", id).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let para = [], cambio = null, texto = "";
  if (body.tipo === "lista-invita") {
    para = ms.filter(m => m.estado === "invitado" && m.invita === yo && !(m.avisos && m.avisos.invita)).map(m => m.user_id);
    cambio = { invita: true };
  } else if (body.tipo === "lista-acepta") {
    if (!mio.invita || (mio.avisos && mio.avisos.acepta)) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { acepta: true });
    para = ms.filter(m => m.user_id === mio.invita && m.estado === "activo").map(m => m.user_id);
  } else if (body.tipo === "lista-agrega") {
    const item = parseInt(body.item, 10);
    const { data: it, error: e3 } = await sb.from("listas_compartidas_items").select("texto, creado").eq("id", item).eq("lista", id).eq("user_id", yo).maybeSingle();
    if (e3) throw new Error(e3.message);
    if (!it || ahora - new Date(it.creado) > 15 * 60000) return { enviadas: 0, motivo: "no-corresponde" };
    const fecha = new Date(it.creado).toISOString().slice(0, 10);
    para = destinatariosAgrega({ miembros: ms, yo, fecha }); cambio = { agrega: fecha }; texto = it.texto;
  } else return { enviadas: 0, motivo: "tipo" };
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const msg = mensajeLista(body.tipo, { nombre: perfil && perfil.nombre, l, texto });
  let enviadas = 0;
  for (const uid of para) {
    const [{ data: est }, { data: dispositivos, error: e4 }] = await Promise.all([
      sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", uid).maybeSingle(),
      sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", uid),
    ]);
    if (e4) throw new Error(e4.message);
    if (!dispositivos || !dispositivos.length || !puedeAvisarAmigo(est && est.notif, ahora)) continue;
    if (cambio) await anotar(uid, cambio);
    enviadas += ((await enviar(dispositivos, msg)) || {}).enviadas || 0;
  }
  return { enviadas };
}
