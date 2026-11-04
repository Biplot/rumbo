/* ============================================================
   Rumbo · «+ Un vaso» desde el aviso (sin abrir la app)
   El aviso del agua (elefante-agua, notifier/recordatorios.mjs) lleva una firma: quién es y de qué día,
   firmada con el secreto de configuracion_push. Al tocar «+ Un vaso» o «+ Tu botella», el service worker
   (sw.js) la manda de vuelta con el vaso a api/push.js, sin sesión: la firma dice que el aviso fue para esa
   persona. Se anota en agua_pendientes (supabase/agua.sql) y la app lo suma al abrirse (agua-juntos.js).
   Se prueba sin red en tests/agua-juntos.test.mjs.
   ============================================================ */
import { createHmac, timingSafeEqual } from "node:crypto";

export const VASOS_AL_DIA = 20;   // un aviso no puede anotar más que esto en un día

export function firmaVaso(secreto, uid, fecha) {
  return createHmac("sha256", String(secreto || "")).update(`vaso|${uid}|${fecha}`).digest("base64url").slice(0, 32);
}
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const entre = (a, b) => Math.round((new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 864e5);
const sinTablas = e => /does not exist|schema cache|Could not find/i.test(String((e && e.message) || e));

/* body: { u: usuario, d: el día del aviso, f: la firma, id, ml, ts, fecha: el día en que se tocó } */
export async function vasoDesdeAviso({ sb, body, secreto, ahora = new Date() }) {
  const b = body && typeof body === "object" ? body : {};
  const uid = String(b.u || "").toLowerCase(), d = String(b.d || ""), fecha = String(b.fecha || ""), id = String(b.id || "");
  const ml = Math.round(Number(b.ml)), ts = Math.round(Number(b.ts));
  if (!/^[0-9a-f-]{36}$/.test(uid) || !FECHA.test(d) || !FECHA.test(fecha) || !/^[a-z0-9]{4,40}$/.test(id)) return { ok: false, motivo: "no-valido" };
  if (!(ml >= 50 && ml <= 3000) || !(Math.abs(ts - ahora.getTime()) < 2 * 864e5)) return { ok: false, motivo: "no-valido" };
  if (!secreto) return { ok: false, motivo: "sin-secreto" };
  // un aviso de hoy (o de ayer o mañana, por la zona horaria) y tocado el mismo día o al siguiente
  if (Math.abs(entre(d, ahora.toISOString().slice(0, 10))) > 1 || entre(fecha, d) < 0 || entre(fecha, d) > 1) return { ok: false, motivo: "vencido" };
  const esperada = Buffer.from(firmaVaso(secreto, uid, d)), f = Buffer.from(String(b.f || ""));
  if (f.length !== esperada.length || !timingSafeEqual(f, esperada)) return { ok: false, motivo: "firma" };
  const desde = new Date(ahora.getTime() - 864e5).toISOString();
  const { count, error: e1 } = await sb.from("agua_pendientes").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("creado", desde);
  if (e1) { if (sinTablas(e1)) return { ok: false, motivo: "sin-tablas" }; throw new Error(e1.message); }
  if ((count || 0) >= VASOS_AL_DIA) return { ok: false, motivo: "limite" };
  const { error } = await sb.from("agua_pendientes").upsert({ user_id: uid, id, fecha, ml, ts }, { onConflict: "user_id,id", ignoreDuplicates: true });
  if (error) { if (sinTablas(error)) return { ok: false, motivo: "sin-tablas" }; throw new Error(error.message); }
  return { ok: true };
}
