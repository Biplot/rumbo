/* ============================================================
   Rumbo · Tu elefante te escribe (sin dependencias, se prueba en tests/notifier.test.mjs)
   Los avisos al celular hablan como tu elefante: en primera persona, cortos y con cariño.
   Son notificaciones de texto (no audio). La forma cambia de un día a otro, pero el mismo
   día sale siempre igual (una semilla por fecha y por aviso).

   Además, dos avisos propios de tu elefante, con un tope de UNO al día entre los dos
   (los que tú pides, como abrir y cerrar el día, no cuentan para el tope):
   - elefante-racha: a la hora de tus hábitos, si un hábito con racha de 3 o más
     aún no está hecho hoy («Tu racha de Leer va en 12 días…»).
   - elefante-agua: a las 16:00, si anotas tu agua y hoy vas bajo el 40 % de tu meta.
   ============================================================ */

/* Una elección que depende solo del día y del aviso */
export function azar(hoy, sal) {
  let h = 2166136261;
  const s = String(hoy) + "·" + sal;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}
export function una(hoy, sal, frases) { return frases[Math.floor(azar(hoy, sal) * frases.length) % frases.length]; }

/* Lo que tu elefante dice que hace contigo, según el hábito (igual que en js/nota-elefante.js) */
const BROMAS = [
  [/le[eé]r|lectura|libro/i, "¿Diez páginas antes de dormir? Yo te espero con el libro abierto."],
  [/ingl[eé]s|idioma|franc[eé]s|alem[aá]n|portugu[eé]s|italiano|japon[eé]s|chino/i, "¿Quince minutos? Yo llevo el diccionario."],
  [/deporte|gimnasio|gym|correr|entren|bici|nadar|caminar|yoga|pesas|ejercicio|f[uú]tbol|trotar/i, "¿Diez minutos y la salvamos? Yo estiro la trompa."],
  [/medit|respir/i, "¿Cinco minutos de calma? Yo respiro contigo."],
  [/agua|hidrat/i, "¿Un vaso? Yo lleno el balde."],
  [/m[uú]sica|guitarra|piano|cantar|bater[ií]a|viol[ií]n/i, "¿Un ratito de música? Yo pongo el disco."],
  [/estudi|curso|clase/i, "¿Un repaso corto? Yo saco los lápices."],
  [/vitamina|remedio|pastilla|medicamento/i, "Te la dejé a mano, al lado del vaso."],
  [/escrib|diario|journal/i, "¿Unas líneas? Yo te presto la trompa de lápiz."],
];
export function broma(nombre) { const b = BROMAS.find(([re]) => re.test(nombre || "")); return b ? b[1] : "¿La salvamos hoy? Yo te acompaño."; }

const UNIDAD = { "días": ["día", "días"], sem: ["semana", "semanas"], meses: ["mes", "meses"] };
export function textoRacha({ nombre, n, unidad }) {
  const [sg, pl] = UNIDAD[unidad] || UNIDAD["días"];
  return `Tu racha de ${nombre} va en ${n} ${n === 1 ? sg : pl}. ${broma(nombre)}`;
}

/* El agua de un día: los vasos que siguen (sin los borrados), o el total si ya se resumió (agua.js) */
function totalAgua(d) {
  if (!d) return 0;
  if (!Array.isArray(d.r)) return +d.ml || 0;
  const b = new Set(d.b || []);
  return d.r.filter(x => x && !b.has(x.id)).reduce((s, x) => s + (+x.ml || 0), 0);
}
function sumarDias(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/* ¿Vas atrasado con el agua? Solo si la anotas (algún vaso en los últimos 7 días). La meta es la que elegiste
   (o 2 L) más lo del calor del día (agua.js: sobre 28 °C medio litro, sobre 32 °C un litro); el aviso no la nombra,
   porque la automática por peso solo se sabe en la app. */
export const AGUA_ATRASO = 0.4;
export function aguaAtrasada(data, hoy) {
  const a = data && data.agua; if (!a || !a.dias || typeof a.dias !== "object") return null;
  let usa = false;
  for (let i = 0; i <= 7 && !usa; i++) usa = totalAgua(a.dias[sumarDias(hoy, -i)]) > 0;
  if (!usa) return null;
  const d = a.dias[hoy], ml = totalAgua(d);
  const c = a.clima && a.clima.on && d && typeof d.c === "number" && !d.cp ? d.c : null;
  const meta = (a.meta > 0 ? +a.meta : 2000) + (c == null ? 0 : c >= 32 ? 1000 : c >= 28 ? 500 : 0);
  return ml < meta * AGUA_ATRASO ? { ml, meta } : null;
}
const litros = ml => (Math.round(ml / 50) * 50 / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 });
export function textoAgua({ ml }, hoy) {
  if (!ml) return una(hoy, "agua0", ["Hoy todavía no anotas agua. ¿Partimos con un vaso? Yo te acompaño con mi balde.", "¿Y el agua de hoy? Un vaso ahora y yo me tomo otro contigo."]);
  return una(hoy, "agua", [`Llevas ${litros(ml)} L hoy. ¿Un vaso? Yo ya me tomé un balde.`, `Vas en ${litros(ml)} L. Un vaso ahora y llegas mejor a la noche.`]);
}

/* «+ Un vaso» y «+ Tu botella» en el aviso del agua (Android y computador; en iPhone, tocarlo abre la portilla).
   El service worker (sw.js) los anota sin abrir la app, con la firma del aviso (notifier/vaso.mjs) */
export function vasoDe(data) { const v = +(data && data.agua && data.agua.vaso); return v >= 100 && v <= 1000 ? v : 250; }
export function botellaDe(data) { const v = +(data && data.agua && data.agua.botella); return v >= 250 && v <= 3000 ? v : 500; }
const mlTxt = ml => (ml >= 1000 ? litros(ml) + " L" : ml + " ml");
export function accionesAgua({ data, uid, hoy, ml, meta, firma }) {
  const vaso = vasoDe(data), botella = botellaDe(data);
  return {
    actions: [{ action: "vaso", title: `+ Un vaso (${mlTxt(vaso)})` }, { action: "botella", title: `+ Tu botella (${mlTxt(botella)})` }],
    agua: { u: uid, d: hoy, f: firma, vaso, botella, ml: Math.round(ml || 0), meta: Math.round(meta || 0) },
  };
}

/* Los avisos de siempre, con la voz de tu elefante (título y texto; el título queda corto) */
export const VOZ = {
  manana: ["🌅 Buenos días", ["Ya estoy despierto y con la trompa lista. ¿Abrimos tu día y elegimos tu primer bocado?", "Te guardé un café. Abre tu día y dime qué va primero.", "Un día nuevo: ¿lo abrimos juntos? Son dos minutos."]],
  mediodia: ["☀️ Mediodía", ["¿Cómo va tu primer bocado? Un paso chico ya cuenta: yo te aplaudo con la trompa."]],
  noche: ["🌙 Cierra tu día", ["Ya me estoy poniendo el pijama. ¿Cerramos tu día antes de dormir?", "Cuéntame cómo te fue: cierra tu día y te dejo una nota.", "Un minuto para cerrar el día, y te dejo mi nota de hoy."]],
  "noche-2": ["🌙 ¿Cerramos el día?", ["Sigo despierto esperándote. Cierra hoy y tu racha sigue.", "No me duermo sin tu cierre: es un minuto y tu racha sigue."]],
  "mes-apertura": ["🗓️ Empieza un mes nuevo", ["Mes nuevo, hoja nueva. ¿Miramos el anterior y elegimos tu foco y tus objetivos?"]],
  "mes-cierre": ["🗓️ Último día del mes", ["Hoy se cierra el mes. ¿Lo repasamos juntos? Traigo el álbum."]],
  "semana-cierre": ["📅 Tu ritual semanal", ["Hora del repaso: cierra tu semana y planifica la que viene. Diez minutos y listo."]],
  "semana-apertura": ["📅 Planifica tu semana", ["¿Armamos la semana? Tu foco, tus 3 prioridades y las tareas repartidas en los días."]],
  "tri-cierre": ["🧭 Termina el trimestre", ["Se acaba el trimestre: repasemos tus metas, tus números y lo que aprendiste (+200 ⭐)."]],
  "tri-apertura": ["🧭 Empieza un trimestre nuevo", ["Trimestre nuevo: elige tu foco y de 3 a 5 metas (+200 ⭐). Yo te ayudo a anotarlas."]],
  "elefante-racha": ["🔥 Tu racha te espera", null],
  "elefante-agua": ["💧 ¿Un vaso?", null],
};
export function voz(tipo, hoy) {
  const v = VOZ[tipo]; if (!v) return null;
  return { title: v[0], body: v[1] ? una(hoy, tipo, v[1]) : "" };
}
/* Lo que se suma a un texto informativo (días sin cerrar, hábitos, cumpleaños, contactos) */
export const COLA = {
  "dias-sin-cerrar": "Yo te lo guardo mientras.",
  habitos: "Vamos de a uno: yo te acompaño.",
  cumpleanos: "¿Le escribimos? Yo le canto con la trompa.",
  contactos: "¿Le mandamos un saludo?",
};
