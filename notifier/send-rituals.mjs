/* ============================================================
   Rumbo · Envío de recordatorios de ritual (mañana / noche)
   Corre en GitHub Actions cada ~15 min y manda Web Push a quien
   le toque su hora local. Idempotente vía la tabla notif_sent.

   Secrets (env) que necesita:
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
     VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
   ============================================================ */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const {
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.log("Faltan secrets; no hay nada que hacer (no-op).");
  process.exit(0);
}

webpush.setVapidDetails(VAPID_SUBJECT || "mailto:cmaulenb@outlook.com", VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WINDOW_MIN = 30; // tolerancia en minutos DESPUÉS de la hora objetivo

const MSGS = {
  manana: { title: "🌅 Buenos días", body: "Inicia tu ritual y define tu enfoque del día.", url: "./#ritual", tag: "rumbo-manana" },
  noche: { title: "🌙 Cierra tu día", body: "Tómate un momento para reflexionar y cerrar tu día.", url: "./#ritual", tag: "rumbo-noche" },
};

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

  for (const tipo of ["manana", "noche"]) {
    const diff = nowMin - toMin(notif[tipo]);
    if (diff < 0 || diff >= WINDOW_MIN) continue; // fuera de la ventana

    // Dedup: registrar el envío; si ya existe (PK duplicada) o falla, no reenviar
    const { error: insErr } = await sb.from("notif_sent").insert({ user_id: row.user_id, tipo, fecha: hoy });
    if (insErr) { saltados++; continue; }

    const payload = JSON.stringify(MSGS[tipo]);
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
