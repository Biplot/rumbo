/* ============================================================
   Rumbo · Avisos de leer el mismo libro con amigos
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/lecturas.sql) que el aviso corresponde y que no se mandó ya: te invitan a
   leer, alguien se sumó y alguien lo terminó. Con el aviso «Amigos» y nunca de noche.
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/etapa4.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

/* El aviso de cada tipo. nombre: quien lo provoca; l: el libro */
export function mensajeLectura(tipo, { nombre, l } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const t = "«" + (String((l && l.titulo) || "").trim() || "el libro") + "»";
  const url = "./#lecturas";
  if (tipo === "lectura-invita") return { title: `${quien} te invita a leer ${t}`, body: "Cada uno a su ritmo: solo se comparte en qué página va cada uno.", url: "./#amigos", tag: "rumbo-lectura-invita" };
  if (tipo === "lectura-acepta") return { title: `${quien} se sumó a leer ${t}`, body: "Ya ven en qué página va cada uno.", url, tag: "rumbo-lectura-acepta" };
  if (tipo === "lectura-termina") return { title: `${quien} terminó ${t}`, body: "¿En qué página vas tú?", url, tag: "rumbo-lectura-termina" };
  return null;
}

/* El aviso que pidió la app (yo: quien llama, activo en la lectura). La invitación la hizo quien llama;
   al sumarse, avisa a quien lo invitó; terminarlo, a los demás que lo leen (una vez por persona). */
export async function avisoLectura({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = String((body && body.lectura) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: l, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    sb.from("lecturas_conjunto").select("titulo").eq("id", id).maybeSingle(),
    sb.from("lecturas_conjunto_miembros").select("user_id, estado, invita, terminado, avisos").eq("lectura", id),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (ms || []).find(m => m.user_id === yo);
  if (!l || !mio || mio.estado !== "activo") return { enviadas: 0, motivo: "no-corresponde" };
  const av = m => (m.avisos && typeof m.avisos === "object" ? m.avisos : {});
  const anotar = async (uid, cambio) => {
    const m = ms.find(x => x.user_id === uid);
    const { error } = await sb.from("lecturas_conjunto_miembros").update({ avisos: Object.assign({}, m.avisos, cambio) }).eq("lectura", id).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let para = [], cambio = null;
  if (body.tipo === "lectura-invita") {
    para = ms.filter(m => m.estado === "invitado" && m.invita === yo && !av(m).invita).map(m => m.user_id);
    cambio = { invita: true };
  } else if (body.tipo === "lectura-acepta" || body.tipo === "lectura-termina") {
    const clave = body.tipo === "lectura-acepta" ? "acepta" : "termina";
    if (clave === "acepta" && !mio.invita) return { enviadas: 0, motivo: "no-corresponde" };
    if (clave === "termina" && !mio.terminado) return { enviadas: 0, motivo: "no-corresponde" };
    if (av(mio)[clave]) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { [clave]: true });
    para = clave === "acepta" ? ms.filter(m => m.user_id === mio.invita && m.estado === "activo").map(m => m.user_id)
      : ms.filter(m => m.user_id !== yo && m.estado === "activo").map(m => m.user_id);
  } else return { enviadas: 0, motivo: "tipo" };
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const msg = mensajeLectura(body.tipo, { nombre: perfil && perfil.nombre, l });
  let enviadas = 0;
  for (const uid of para) {
    const [{ data: est }, { data: dispositivos, error: e3 }] = await Promise.all([
      sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", uid).maybeSingle(),
      sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", uid),
    ]);
    if (e3) throw new Error(e3.message);
    if (!dispositivos || !dispositivos.length || !puedeAvisarAmigo(est && est.notif, ahora)) continue;
    if (cambio) await anotar(uid, cambio);
    enviadas += ((await enviar(dispositivos, msg)) || {}).enviadas || 0;
  }
  return { enviadas };
}
