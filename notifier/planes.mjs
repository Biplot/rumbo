/* ============================================================
   Rumbo · Avisos de los planes con amigos
   · Los que pide la app (api/push.js, accion "amigos", tipo "plan-…"), después de revisar en
     la base (supabase/planes.sql) que corresponden y que no se mandaron ya: te invitan, alguien
     respondió, ya tiene fecha (se eligió la que votaban), cambió cuándo o dónde y se canceló.
   · El recordatorio del día («Hoy: …»), que manda la base cada 5 minutos (recordatoriosPlanes):
     unas 3 horas antes (o en la mañana, si el plan no tiene hora) a quienes van o tal vez van.
   Todos con el aviso «Amigos» y nunca de noche (puedeAvisarAmigo).
   Recibe el cliente de Supabase (`sb`, con la clave de servicio) y la forma de enviar
   (`enviar`), así se prueba sin red en tests/planes.test.mjs.
   ============================================================ */
import { puedeAvisarAmigo } from "./amigos.mjs";

const TZ_DEFECTO = "America/Santiago";
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/* El recordatorio: desde 3 horas antes hasta 10 minutos antes; sin hora, de 9:00 a 20:00 de ese día */
export const RECUERDA = { antes: 3 * 60, hasta: 10, sinHora: ["09:00", "20:00"] };

/* "el vie 7 nov a las 21:00" (el día de la semana de la fecha, sin zona horaria) */
export function fechaPlan(fecha, hora) {
  const [y, m, d] = String(fecha || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `el ${DIAS[dow]} ${d} ${MESES[m - 1]}${hora ? " a las " + hora : ""}`;
}
/* Lo que identifica cuándo y dónde es: si cambia, se avisa */
export function firmaPlan(p) { return [p.fecha || "", p.hora || "", p.lugar || "", p.enlace || ""].join("|"); }
function nombres(ns) { return ns.length <= 1 ? ns.join("") : ns.slice(0, -1).join(", ") + " y " + ns[ns.length - 1]; }
function donde(p) { return p.lugar ? `, en ${p.lugar}` : p.enlace ? ", a distancia" : ""; }

/* El aviso de cada tipo. nombre: quien lo provoca; p: el plan; van: cuántos van; con: con quiénes (recordatorio) */
export function mensajePlan(tipo, { nombre, p, respuesta, van, con } = {}) {
  const quien = String(nombre || "").trim() || "Un amigo";
  const t = "«" + (String((p && p.titulo) || "").trim() || "el plan") + "»";
  const url = "./#amigos";
  const vanTxt = n => (n === 1 ? "Por ahora va 1." : `Ya van ${n}.`);
  if (tipo === "plan-invita") return p && p.fecha
    ? { title: `${quien} te invita a un plan`, body: `${t}, ${fechaPlan(p.fecha, p.hora)}${donde(p)}. ¿Vas?`, url, tag: "rumbo-plan-invita" }
    : { title: `${quien} te invita a un plan`, body: `${t}: vota las fechas que te sirven.`, url, tag: "rumbo-plan-invita" };
  if (tipo === "plan-responde") {
    if (respuesta === "voy") return { title: `${quien} va a ${t}`, body: vanTxt(van || 1), url, tag: "rumbo-plan-responde" };
    if (respuesta === "quizas") return { title: `${quien} tal vez va a ${t}`, body: vanTxt(van || 1), url, tag: "rumbo-plan-responde" };
    if (respuesta === "no") return { title: `${quien} no puede ir a ${t}`, body: vanTxt(van || 1), url, tag: "rumbo-plan-responde" };
    return null;
  }
  if (tipo === "plan-fecha") return { title: `Ya hay fecha: ${t}`, body: `Quedó ${fechaPlan(p.fecha, p.hora)}${donde(p)}. ¿Vas?`, url, tag: "rumbo-plan-cambio" };
  if (tipo === "plan-cambio") return { title: `Cambió el plan ${t}`, body: `Ahora es ${fechaPlan(p.fecha, p.hora)}${donde(p)}.`, url, tag: "rumbo-plan-cambio" };
  if (tipo === "plan-cancela") return { title: `${quien} canceló ${t}`, body: "Ya no va: lo sacamos de tu agenda.", url, tag: "rumbo-plan-cancela" };
  if (tipo === "plan-hoy") {
    const c = String(con || "").trim(), d = p.lugar ? `en ${p.lugar}` : p.enlace ? "a distancia" : "";
    const body = c ? `Con ${c}${d ? ", " + d : ""}.` : d ? d.charAt(0).toUpperCase() + d.slice(1) + "." : "¡Que lo pasen bien!";
    return { title: `Hoy: ${t}${p.hora ? " a las " + p.hora : ""}`, body, url, tag: "rumbo-plan-hoy" };
  }
  return null;
}

/* El instante en que empieza «fecha hora» en la zona del plan (con el cambio de horario incluido) */
export function instantePlan(fecha, hora, tz) {
  const [y, m, d] = fecha.split("-").map(Number), [h, mi] = String(hora || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const fmt = zona => new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  let f; try { f = fmt(tz || TZ_DEFECTO); } catch (e) { f = fmt(TZ_DEFECTO); }
  const desfase = t => { const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - t; };
  let t = guess - desfase(guess);
  t = guess - desfase(t);
  return new Date(t);
}
/* ¿Es hora del recordatorio de este plan? */
export function tocaRecordar(p, ahora = new Date()) {
  if (!p || !p.fecha || p.cancelado) return false;
  const [desde, hasta] = p.hora
    ? [instantePlan(p.fecha, p.hora, p.tz) - RECUERDA.antes * 60000, instantePlan(p.fecha, p.hora, p.tz) - RECUERDA.hasta * 60000]
    : [+instantePlan(p.fecha, RECUERDA.sinHora[0], p.tz), +instantePlan(p.fecha, RECUERDA.sinHora[1], p.tz)];
  return +ahora >= desde && +ahora < hasta;
}

/* A quién le llega cada aviso que pide la app (yo: quien llama), y lo que se anota para no repetirlo */
export function destinatariosPlan(tipo, { p, invitados, yo }) {
  const av = i => (i.avisos && typeof i.avisos === "object" ? i.avisos : {});
  const otros = (invitados || []).filter(i => i.user_id !== p.creador);
  const firma = firmaPlan(p);
  if (tipo === "plan-invita") {
    if (p.creador !== yo || p.cancelado) return null;
    return otros.filter(i => i.invita === yo && i.respuesta === "pendiente" && !av(i).invita).map(i => ({ uid: i.user_id, tipo, cambio: { invita: true, firma } }));
  }
  if (tipo === "plan-cambio" || tipo === "plan-fecha") {   // plan-fecha: se eligió la fecha que se votaba
    if (p.creador !== yo || p.cancelado || !p.fecha) return null;
    return otros.filter(i => i.respuesta !== "no" && av(i).firma !== firma).map(i => ({ uid: i.user_id, tipo, cambio: { firma } }));
  }
  if (tipo === "plan-cancela") {
    if (p.creador !== yo || !p.cancelado) return null;
    return otros.filter(i => i.respuesta !== "no" && !av(i).cancela).map(i => ({ uid: i.user_id, tipo, cambio: { cancela: true } }));
  }
  return null;
}

async function dispositivosDe(sb, uid) {
  const [{ data: est }, { data: dispositivos, error }] = await Promise.all([
    sb.from("estado_usuario").select("notif:data->settings->notif").eq("user_id", uid).maybeSingle(),
    sb.from("suscripciones_push").select("id, endpoint, p256dh, auth").eq("user_id", uid),
  ]);
  if (error) throw new Error(error.message);
  return { notif: est && est.notif, dispositivos: dispositivos || [] };
}

/* El aviso que pidió la app. Solo si corresponde (quien llama está en el plan; invitar, cambiar y
   cancelar, solo quien lo propuso), a quienes tienen encendido «Amigos» y no es de noche donde viven. */
export async function avisoPlan({ sb, yo, body, enviar, ahora = new Date() }) {
  const id = String((body && body.plan) || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { enviadas: 0, motivo: "no-valido" };
  const [{ data: p, error: e1 }, { data: invitados, error: e2 }] = await Promise.all([
    sb.from("planes").select("titulo, tipo, fecha, hora, lugar, enlace, creador, cancelado").eq("id", id).maybeSingle(),
    sb.from("planes_invitados").select("user_id, respuesta, invita, avisos").eq("plan", id),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const mio = (invitados || []).find(i => i.user_id === yo);
  if (!p || !mio) return { enviadas: 0, motivo: "no-corresponde" };
  const anotar = async (uid, cambio) => {
    const i = invitados.find(x => x.user_id === uid);
    const { error } = await sb.from("planes_invitados").update({ avisos: Object.assign({}, i.avisos, cambio) }).eq("plan", id).eq("user_id", uid);
    if (error) throw new Error(error.message);
  };
  let para;
  if (body.tipo === "plan-responde") {
    const r = mio.respuesta, av = mio.avisos && typeof mio.avisos === "object" ? mio.avisos : {};
    if (yo === p.creador || p.cancelado || !["voy", "quizas", "no"].includes(r)) return { enviadas: 0, motivo: "no-corresponde" };
    if (av.responde === r) return { enviadas: 0, motivo: "ya-avisado" };
    await anotar(yo, { responde: r });
    para = invitados.some(i => i.user_id === p.creador) ? [{ uid: p.creador, tipo: "plan-responde", cambio: null }] : [];
  } else {
    para = destinatariosPlan(body.tipo, { p, invitados, yo });
    if (!para) return { enviadas: 0, motivo: "no-corresponde" };
  }
  if (!para.length) return { enviadas: 0, motivo: "nadie" };
  const { data: perfil } = await sb.from("perfiles").select("nombre").eq("user_id", yo).maybeSingle();
  const van = invitados.filter(i => i.respuesta === "voy").length;
  let enviadas = 0;
  for (const x of para) {
    const { notif, dispositivos } = await dispositivosDe(sb, x.uid);
    if (!dispositivos.length || !puedeAvisarAmigo(notif, ahora)) continue;
    if (x.cambio) await anotar(x.uid, x.cambio);
    const msg = mensajePlan(x.tipo, { nombre: perfil && perfil.nombre, p, respuesta: mio.respuesta, van });
    enviadas += ((await enviar(dispositivos, msg)) || {}).enviadas || 0;
  }
  return { enviadas };
}

/* El recordatorio del día: lo llama api/push.js cada vez que la base pide los recordatorios.
   A quienes van o tal vez van, una vez por fecha y hora del plan (avisos.recuerda). */
export async function recordatoriosPlanes({ sb, enviar, ahora = new Date() }) {
  const dia = n => new Date(+ahora + n * 864e5).toISOString().slice(0, 10);
  const { data: planes, error } = await sb.from("planes").select("id, titulo, fecha, hora, lugar, enlace, tz, creador, cancelado")
    .eq("cancelado", false).gte("fecha", dia(-1)).lte("fecha", dia(1));
  if (error) throw new Error(error.message);
  const r = { planes: 0, enviadas: 0 };
  for (const p of planes || []) {
    if (!tocaRecordar(p, ahora)) continue;
    r.planes++;
    const clave = p.fecha + "|" + (p.hora || "");
    const { data: invitados, error: e2 } = await sb.from("planes_invitados").select("user_id, respuesta, avisos").eq("plan", p.id);
    if (e2) throw new Error(e2.message);
    const van = (invitados || []).filter(i => i.respuesta === "voy" || i.respuesta === "quizas");
    const para = van.filter(i => !(i.avisos && i.avisos.recuerda === clave));
    if (!para.length) continue;
    const { data: perfiles } = await sb.from("perfiles").select("user_id, nombre").in("user_id", van.map(i => i.user_id));
    const nombre = uid => ((perfiles || []).find(x => x.user_id === uid) || {}).nombre || "un amigo";
    for (const i of para) {
      const { notif, dispositivos } = await dispositivosDe(sb, i.user_id);
      if (!dispositivos.length || !puedeAvisarAmigo(notif, ahora)) continue;
      const { error: e3 } = await sb.from("planes_invitados").update({ avisos: Object.assign({}, i.avisos, { recuerda: clave }) }).eq("plan", p.id).eq("user_id", i.user_id);
      if (e3) throw new Error(e3.message);
      const con = nombres(van.filter(x => x.user_id !== i.user_id && x.respuesta === "voy").map(x => nombre(x.user_id)));
      r.enviadas += ((await enviar(dispositivos, mensajePlan("plan-hoy", { p, con }))) || {}).enviadas || 0;
    }
  }
  return r;
}
