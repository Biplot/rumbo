/* ============================================================
   Rumbo · Avisos de los hábitos en conjunto (Amigos, etapa 2)
   Los manda api/push.js cuando la app lo pide, después de revisar en la base
   (supabase/conjunto.sql) que el aviso corresponde y que no se mandó ya.
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/conjunto.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";
import { rachaConjunto } from "./habitos.mjs";

/* Al marcar un día: si con eso cumplieron todos (los activos que ya estaban, al menos dos),
   "todos" para los demás; si no, "marca" para los que aún no lo hacen ese día.
   A cada uno, una vez por día y por hábito (avisos.todos / avisos.marca guardan la fecha). */
export function destinatariosMarca({ miembros, marcas, yo, fecha }) {
  const activos = (miembros || []).filter(m => m.estado === "activo" && m.desde && m.desde <= fecha);
  const hizo = new Set((marcas || []).filter(x => x.fecha === fecha).map(x => x.user_id));
  const av = m => (m.avisos && typeof m.avisos === "object" ? m.avisos : {});
  if (activos.length >= 2 && activos.every(m => hizo.has(m.user_id)))
    return { tipo: "todos", para: activos.filter(m => m.user_id !== yo && av(m).todos !== fecha).map(m => m.user_id) };
  return { tipo: "marca", para: activos.filter(m => m.user_id !== yo && !hizo.has(m.user_id) && av(m).marca !== fecha).map(m => m.user_id) };
}

/* El aviso de cada tipo. nombre: quien lo provoca; habito: su nombre; racha: { n, unidad } (solo "todos");
   grupo: si son más de dos */
export function mensajeConjunto(tipo, { nombre, habito, racha, grupo } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const h = "«" + (String(habito || "").trim() || "su hábito") + "»";
  const url = "./#inicio";
  if (tipo === "conjunto-invita") return { title: `${quien} te invita a un hábito`, body: `${h}, para hacerlo juntos en Rumbo.`, url: "./#amigos", tag: "rumbo-conjunto-invita" };
  if (tipo === "conjunto-acepta") return { title: `${quien} se sumó a ${h}`, body: "Ya lo hacen juntos: cada uno lo marca en su Rumbo.", url, tag: "rumbo-conjunto-acepta" };
  if (tipo === "marca") return { title: `${quien} ya cumplió ${h} hoy`, body: grupo ? "Te toca: si lo haces hoy, lo cumplen todos." : "Te toca: si lo haces hoy, lo cumplen los dos.", url, tag: "rumbo-conjunto-marca" };
  if (tipo === "todos") {
    const r = racha && racha.n > 1 ? racha : null;
    const u = r ? (r.unidad === "sem" ? "semanas" : r.unidad === "meses" ? "meses" : "días") : "";
    return { title: `¡Lo hicieron todos! ${h}`, body: (r ? `Racha ${grupo ? "del grupo" : "de a dos"}: ${r.n} ${u}. ` : "") + "+5 ⭐ para cada uno.", url, tag: "rumbo-conjunto-todos" };
  }
  return null;
}

/* El aviso que pidió la app (yo: quien llama). Quien llama tiene que estar activo en el hábito;
   la invitación la hizo quien llama; al sumarse, avisa a quien lo invitó; al marcar, revisa
   que de verdad marcó ese día. A cada uno se le avisa una vez (avisos de su fila en
   habitos_conjunto_miembros), y solo si tiene encendido «Amigos» y no es de noche donde vive. */
export async function avisoConjunto({ sb, yo, body, enviar, ahora = new Date() }) {
  const habito = String((body && body.habito) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(habito)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: h, error: e1 }, { data: ms, error: e2 }] = await Promise.all([
    sb.from("habitos_conjunto").select("nombre, frecuencia, creado").eq("id", habito).maybeSingle(),
    sb.from("habitos_conjunto_miembros").select("user_id, estado, invita, desde, avisos").eq("habito", habito),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (ms || []).find(m => m.user_id === yo);
  if (!h || !mio || mio.estado !== "activo") return { enviadas: 0, motivo: "no-corresponde" };
  const anotar = async (uid, cambio) => {
    const m = ms.find(x => x.user_id === uid);
    const { error } = await sb.from("habitos_conjunto_miembros").update({ avisos: Object.assign({}, m.avisos, cambio) }).eq("habito", habito).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let tipo = body.tipo, para = [], cambio = null, racha = null;
  if (tipo === "conjunto-invita") {
    para = ms.filter(m => m.estado === "invitado" && m.invita === yo && !(m.avisos && m.avisos.invita)).map(m => m.user_id);
    cambio = { invita: true };
  } else if (tipo === "conjunto-acepta") {
    if (!mio.invita || (mio.avisos && mio.avisos.acepta)) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { acepta: true });
    para = ms.filter(m => m.user_id === mio.invita && m.estado === "activo").map(m => m.user_id);
  } else if (tipo === "conjunto-marca") {
    const fecha = String(body.fecha || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { enviadas: 0, motivo: "no-valido" };
    const desde = new Date(fecha + "T12:00:00Z"); desde.setUTCDate(desde.getUTCDate() - 400);
    const { data: marcas, error: e3 } = await sb.from("habitos_conjunto_marcas").select("user_id, fecha")
      .eq("habito", habito).gte("fecha", desde.toISOString().slice(0, 10)).lte("fecha", fecha);
    if (e3) throw new Error(e3.message);
    if (!(marcas || []).some(x => x.user_id === yo && x.fecha === fecha)) return { enviadas: 0, motivo: "no-corresponde" };
    const d = destinatariosMarca({ miembros: ms, marcas, yo, fecha });
    tipo = d.tipo; para = d.para; cambio = { [d.tipo]: fecha };
    if (tipo === "todos") {
      // Los días que descansaron todos no cortan la racha (sin la tabla de descansos, como antes)
      const { data: descansos } = await sb.from("habitos_conjunto_descansos").select("user_id, fecha")
        .eq("habito", habito).gte("fecha", desde.toISOString().slice(0, 10)).lte("fecha", fecha);
      const activos = ms.filter(m => m.estado === "activo").map(m => ({ desde: m.desde, marcas: marcas.filter(x => x.user_id === m.user_id).map(x => x.fecha),
        descansos: (descansos || []).filter(x => x.user_id === m.user_id).map(x => x.fecha) }));
      racha = rachaConjunto({ frecuencia: h.frecuencia, creado: h.creado }, activos, fecha);
    }
  } else return { enviadas: 0, motivo: "tipo" };
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const msg = mensajeConjunto(tipo, { nombre: perfil && perfil.nombre, habito: h.nombre, racha, grupo: ms.filter(m => m.estado === "activo").length > 2 });
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
