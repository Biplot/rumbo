/* ============================================================
   Rumbo · Qué recordatorio le toca a cada quien ahora
   (mañana / mediodía / noche, semana, mes y trimestre).
   Lo usa api/push.js cuando la base lo pide (pg_cron cada 5 min,
   supabase/notificaciones.sql). Idempotente vía la tabla notif_sent.
   Recibe el cliente de Supabase (`sb`) y la forma de enviar (`enviar`),
   así se prueba sin red (tests/notifier.test.mjs).
   ============================================================ */
import { ultimoDiaMes, lunesDe, avisoSemana, avisoTrimestre, avisoMediodia, enVentana, horasEnVentana } from "./reglas.mjs";

export const VENTANA_MIN = 30;           // tolerancia en minutos DESPUÉS de la hora elegida
const TZ_DEFECTO = "America/Santiago";

export const MSGS = {
  manana: { title: "🌅 Buenos días", body: "Inicia tu ritual y define tu enfoque del día.", url: "./#ritual", tag: "rumbo-manana" },
  mediodia: { title: "☀️ Mediodía", body: "¿Cómo va tu primer bocado?", url: "./#inicio", tag: "rumbo-mediodia" },
  noche: { title: "🌙 Cierra tu día", body: "Tómate un momento para reflexionar y cerrar tu día.", url: "./#ritual", tag: "rumbo-noche" },
  "mes-apertura": { title: "🗓️ Empieza un mes nuevo", body: "Abre tu mes: mira el anterior, define tu foco y tus objetivos.", url: "./#ritual", tag: "rumbo-mes-apertura" },
  "mes-cierre": { title: "🗓️ Último día del mes", body: "Cierra tu mes: revisa tus objetivos y reflexiona.", url: "./#ritual", tag: "rumbo-mes-cierre" },
  "semana-cierre": { title: "📅 Tu ritual semanal", body: "Cierra tu semana y planifica la que viene. Toma 10 minutos.", url: "./#ritual", tag: "rumbo-semana-cierre" },
  "semana-apertura": { title: "📅 Planifica tu semana", body: "Elige tu foco, tus 3 prioridades y reparte tus tareas en los días.", url: "./#ritual", tag: "rumbo-semana-apertura" },
  "tri-cierre": { title: "🧭 Termina el trimestre", body: "Cierra tu trimestre: revisa tus metas, tus números y lo que aprendiste (+200 ⭐).", url: "./#ritual", tag: "rumbo-tri-cierre" },
  "tri-apertura": { title: "🧭 Empieza un trimestre nuevo", body: "Abre tu trimestre: define tu foco y de 3 a 5 metas (+200 ⭐).", url: "./#ritual", tag: "rumbo-tri-apertura" },
};
const TRI_APERTURA_CON_CIERRE = "Cierra el trimestre que terminó y abre este: tu foco y de 3 a 5 metas (+200 ⭐ cada parte).";
/* Ritual de mes: apertura el día 1 (hora de "mañana"), cierre el último día (hora de "noche").
   Clave de mes "YYYY-MM" igual que STATE.ritual.meses en la app. Semana y trimestre: ver reglas.mjs */
const MES_TIPOS = { "mes-apertura": { hora: "manana", parte: "apertura" }, "mes-cierre": { hora: "noche", parte: "cierre" } };
const TIPOS = ["manana", "mediodia", "noche", "mes-apertura", "mes-cierre", "semana-cierre", "semana-apertura", "tri-cierre", "tri-apertura"];

export function localMinutes(tz, ahora = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ahora);
  return (+p.find(x => x.type === "hour").value % 24) * 60 + (+p.find(x => x.type === "minute").value);
}
export function localDate(tz, ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}
/* Las horas que muestra la app por defecto (mañana 08:00, noche 21:00) también valen aquí */
function conDefectos(n) { n = n || {}; return { ...n, manana: n.manana || "08:00", noche: n.noche || "21:00" }; }

/**
 * Manda los recordatorios que tocan ahora a cada dispositivo registrado.
 * `enviar(dispositivos, mensaje)` devuelve { enviadas, fallidas, borradas }.
 */
export async function enviarRecordatorios({ sb, enviar, ahora = new Date(), ventana = VENTANA_MIN }) {
  /* 1) Quién tiene al menos un dispositivo activado */
  const { data: subs, error: e1 } = await sb.from("suscripciones_push").select("id, user_id, endpoint, p256dh, auth");
  if (e1) throw new Error("No se pudo leer suscripciones_push: " + e1.message);
  const dispositivos = new Map();
  for (const s of subs || []) {
    if (!dispositivos.has(s.user_id)) dispositivos.set(s.user_id, []);
    dispositivos.get(s.user_id).push(s);
  }
  const r = { usuarios: dispositivos.size, en_hora: 0, enviados: 0, saltados: 0, fallidos: 0, borrados: 0 };
  if (!dispositivos.size) return r;

  /* 2) Solo sus horarios: así correr cada 5 minutos no lee el estado completo de todos */
  const { data: filas, error: e2 } = await sb.from("estado_usuario").select("user_id, notif:data->settings->notif").in("user_id", [...dispositivos.keys()]);
  if (e2) throw new Error("No se pudo leer estado_usuario: " + e2.message);
  const candidatos = (filas || []).filter(f => {
    const n = conDefectos(f.notif);
    try { return horasEnVentana(n, localMinutes(n.tz || TZ_DEFECTO, ahora), ventana).length > 0; }
    catch (e) { return false; }                   // zona horaria inválida: no se le puede calcular la hora
  }).map(f => f.user_id);
  r.en_hora = candidatos.length;
  if (!candidatos.length) return r;

  /* 3) El estado completo solo de quien tiene alguna hora en la ventana ahora */
  const { data: usuarios, error: e3 } = await sb.from("estado_usuario").select("user_id, data").in("user_id", candidatos);
  if (e3) throw new Error("No se pudo leer estado_usuario: " + e3.message);

  for (const row of usuarios || []) {
    const data = row.data || {};
    const notif = conDefectos(data.settings && data.settings.notif);
    const tz = notif.tz || TZ_DEFECTO;
    let nowMin, hoy;
    try { nowMin = localMinutes(tz, ahora); hoy = localDate(tz, ahora); } catch (e) { continue; }

    const dia = +hoy.slice(8, 10), mes = hoy.slice(0, 7);
    const ritualMes = ((data.ritual || {}).meses || {})[mes] || {};
    const semanas = (data.ritual || {}).semanas || {};
    const diaSem = (((data.settings || {}).ritualSemanal) || {}).dia === 1 ? 1 : 0;
    const trimestres = (data.ritual || {}).trimestres || {};

    for (const tipo of TIPOS) {
      const mt = MES_TIPOS[tipo];
      let hora = tipo, tri = null, medio = null;
      if (tipo === "mediodia") { medio = avisoMediodia(data, hoy); if (!medio) continue; }
      if (mt) {
        if (tipo === "mes-apertura" && dia !== 1) continue;
        if (tipo === "mes-cierre" && dia !== ultimoDiaMes(hoy)) continue;
        if (ritualMes[mt.parte]) continue;          // ese ritual ya está hecho: no avisar
        hora = mt.hora;
      }
      if (tipo.startsWith("semana-")) {
        hora = avisoSemana(tipo, hoy, diaSem, semanas);
        if (!hora) continue;                        // hoy no toca o ya está hecho
      }
      if (tipo.startsWith("tri-")) {
        tri = avisoTrimestre(tipo, hoy, trimestres);
        if (!tri) continue;                         // hoy no toca o ya está hecho
        hora = tri.hora;
      }
      if (!enVentana(nowMin, notif[hora], ventana)) continue; // fuera de la ventana

      // Un aviso por persona, tipo y día: si ya está anotado (o no se pudo anotar), no se reenvía
      const { error: insErr } = await sb.from("notif_sent").insert({ user_id: row.user_id, tipo, fecha: hoy });
      if (insErr) { r.saltados++; continue; }

      const sufijo = mt ? mes : tipo.startsWith("semana-") ? lunesDe(hoy) : tri ? tri.clave : "";
      const base = tri && tri.pendienteAnterior ? { ...MSGS[tipo], body: TRI_APERTURA_CON_CIERRE } : medio ? { ...MSGS[tipo], body: medio.body } : MSGS[tipo];
      const msg = sufijo ? { ...base, tag: base.tag + "-" + sufijo } : base;
      const e = await enviar(dispositivos.get(row.user_id) || [], msg);
      r.enviados += e.enviadas; r.fallidos += e.fallidas; r.borrados += e.borradas;
    }
  }
  return r;
}
