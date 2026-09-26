/* ============================================================
   Rumbo · Envío de recordatorios de ritual (mañana / noche, semana, mes y trimestre)
   Corre en GitHub Actions cada ~15 min y manda Web Push a quien
   le toque su hora local. Idempotente vía la tabla notif_sent.

   Secrets (env) que necesita:
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
     VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
   ============================================================ */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { ultimoDiaMes, lunesDe, avisoSemana, avisoTrimestre } from "./reglas.mjs";

const trim = v => (v == null ? "" : String(v).trim());
const SUPABASE_URL = trim(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = trim(process.env.SUPABASE_SERVICE_ROLE_KEY);
const VAPID_PUBLIC = trim(process.env.VAPID_PUBLIC);
const VAPID_PRIVATE = trim(process.env.VAPID_PRIVATE);
let VAPID_SUBJECT = trim(process.env.VAPID_SUBJECT) || "mailto:cmaulenb@outlook.com";
if (!/^mailto:|^https?:/i.test(VAPID_SUBJECT)) VAPID_SUBJECT = "mailto:" + VAPID_SUBJECT;

// Diagnóstico (sin exponer valores): qué secrets llegaron
console.log("Secrets presentes:",
  { SUPABASE_URL: !!SUPABASE_URL, SERVICE_ROLE: !!SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC: !!VAPID_PUBLIC, VAPID_PRIVATE: !!VAPID_PRIVATE, VAPID_SUBJECT: VAPID_SUBJECT });

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.log("Faltan secrets; no hay nada que hacer (no-op).");
  process.exit(0);
}
console.log("Longitudes:", { publicLen: VAPID_PUBLIC.length, privateLen: VAPID_PRIVATE.length });

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
} catch (e) {
  console.error("VAPID inválido (revisa VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT):", e.message);
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WINDOW_MIN = 30; // tolerancia en minutos DESPUÉS de la hora objetivo

const MSGS = {
  manana: { title: "🌅 Buenos días", body: "Inicia tu ritual y define tu enfoque del día.", url: "./#ritual", tag: "rumbo-manana" },
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

function localMinutes(tz) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return (+p.find(x => x.type === "hour").value) * 60 + (+p.find(x => x.type === "minute").value);
}
function localDate(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function toMin(hhmm) { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); }

const { data: usuarios, error } = await sb.from("estado_usuario").select("user_id, data");
if (error) { console.error("No se pudo leer estado_usuario:", error.message); process.exit(1); }

let enviados = 0, fallidos = 0, saltados = 0;

for (const row of usuarios || []) {
  const notif = row && row.data && row.data.settings && row.data.settings.notif;
  if (!notif || !notif.enabled || !(notif.subs || []).length) continue;

  const tz = notif.tz || "America/Santiago";
  const nowMin = localMinutes(tz);
  const hoy = localDate(tz);

  const dia = +hoy.slice(8, 10), mes = hoy.slice(0, 7);
  const ritualMes = ((row.data.ritual || {}).meses || {})[mes] || {};
  const semanas = (row.data.ritual || {}).semanas || {};
  const diaSem = (((row.data.settings || {}).ritualSemanal) || {}).dia === 1 ? 1 : 0;
  const trimestres = (row.data.ritual || {}).trimestres || {};

  for (const tipo of ["manana", "noche", "mes-apertura", "mes-cierre", "semana-cierre", "semana-apertura", "tri-cierre", "tri-apertura"]) {
    const mt = MES_TIPOS[tipo];
    let hora = tipo, tri = null;
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
    const diff = nowMin - toMin(notif[hora]);
    if (diff < 0 || diff >= WINDOW_MIN) continue; // fuera de la ventana

    // Dedup: registrar el envío; si ya existe (PK duplicada) o falla, no reenviar
    const { error: insErr } = await sb.from("notif_sent").insert({ user_id: row.user_id, tipo, fecha: hoy });
    if (insErr) { saltados++; continue; }

    const sufijo = mt ? mes : tipo.startsWith("semana-") ? lunesDe(hoy) : tri ? tri.clave : "";
    const msg = tri && tri.pendienteAnterior ? { ...MSGS[tipo], body: TRI_APERTURA_CON_CIERRE } : MSGS[tipo];
    const payload = JSON.stringify(sufijo ? { ...msg, tag: msg.tag + "-" + sufijo } : msg);
    for (const sub of notif.subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        enviados++;
      } catch (e) {
        fallidos++;
        console.log("push fail", (e && e.statusCode) || "", String(sub.endpoint || "").slice(0, 40));
      }
    }
  }
}

console.log(`Listo. usuarios=${(usuarios || []).length} enviados=${enviados} saltados=${saltados} fallidos=${fallidos}`);
