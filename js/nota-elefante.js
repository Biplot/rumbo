/* ============================================================
   Rumbo · El diario del elefante
   Al cerrar el día, tu elefante te deja una nota corta sobre tu día. Se arma con tus datos
   (la hora del cierre, el agua, tus hábitos, tus tareas, la racha, las medallas, el ánimo y
   lo que viene mañana), sin inteligencia artificial y sin mandar nada afuera.
   - No usa lo que escribiste a mano (la misión, la nota, la gratitud): así se puede compartir
     sin miedo. Los nombres de tus hábitos y de tu libro sí, porque son de la app.
   - Se guarda en la entrada del día del Diario (vida.diario, la de fromRitual: e.ele = { texto, ts })
     al cerrar, y viaja entre equipos con ella. Si vuelves a cerrar (editar el cierre), se rehace.
   - Las frases cambian de un día a otro, pero el mismo día sale siempre igual (una semilla por fecha).
   ============================================================ */
const NOTA_ELE_FIRMA = "Tu elefante";

/* Una elección que depende solo de la fecha (y de para qué es): el mismo día, la misma frase */
function notaEleAzar(iso, sal) {
  let h = 2166136261;
  const s = String(iso) + "·" + sal;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}
function notaEleUna(iso, sal, frases) { return frases[Math.floor(notaEleAzar(iso, sal) * frases.length) % frases.length]; }

/* Lo que tu elefante dice que hará contigo mañana, según el hábito */
const NOTA_ELE_BROMAS = [
  [/le[eé]r|lectura|libro/i, "yo llevo el marcapáginas"],
  [/ingl[eé]s|idioma|franc[eé]s|alem[aá]n|portugu[eé]s|italiano|japon[eé]s|chino/i, "yo llevo el diccionario"],
  [/deporte|gimnasio|gym|correr|entren|bici|nadar|caminar|yoga|pesas|ejercicio|f[uú]tbol|trotar/i, "yo estiro la trompa"],
  [/medit|respir/i, "yo respiro contigo"],
  [/agua|hidrat/i, "yo lleno el balde"],
  [/m[uú]sica|guitarra|piano|cantar|bater[ií]a|viol[ií]n/i, "yo pongo la música"],
  [/estudi|curso|clase|tarea/i, "yo saco los lápices"],
  [/dormir|sue[ñn]o|acostar/i, "yo apago la luz"],
  [/vitamina|remedio|pastilla|medicamento/i, "yo te lo dejo a mano"],
  [/alimento|comer|fruta|verdura|cocinar|ensalada/i, "yo lavo la fruta"],
  [/escrib|diario|journal/i, "yo te presto la trompa de lápiz"],
  [/orden|limpi/i, "yo sacudo con la trompa"],
];
function notaEleBroma(nombre) { const b = NOTA_ELE_BROMAS.find(([re]) => re.test(nombre || "")); return b ? b[1] : "yo te acompaño"; }

const notaEleLista = l => l.length <= 1 ? (l[0] || "") : l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
const notaEleHora = ts => new Date(ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/* Los datos del día (iso), leídos de lo que ya guarda Rumbo */
function notaEleDatos(iso, S) {
  S = S || STATE;
  const r = (S.ritual && S.ritual.dias && S.ritual.dias[iso]) || {}, c = r.cierre || {};
  const d = agDate(iso);
  // hábitos «para hacer» de ese día: los programados y los que marcaste aunque no tocaran
  const marcado = h => { const log = S.habitos.log[`${d.getFullYear()}-${d.getMonth() + 1}`]; return !!(log && log[h.id] && log[h.id][d.getDate()]); };
  const habs = (S.habitos.defs || []).filter(h => !h.pausado && hmMeta(h) === "hacer" && (!h.creado || h.creado <= iso) && (hmProgramado(h, iso, S) || marcado(h)));
  const hechos = habs.filter(marcado);
  // agua
  const ad = typeof aguaDia === "function" ? aguaDia(iso, false, S) : null;
  const agua = ad ? { ml: aguaTotal(ad), meta: aguaMeta(S, iso), temp: ad.c != null ? Math.round(ad.c) : null } : null;
  // tareas (el resumen que guardó el cierre, si está)
  const t = c.tareas ? [c.tareas.pro[0] + c.tareas.per[0], c.tareas.pro[1] + c.tareas.per[1]] : null;
  // medallas de ese día y la racha (se escribe al cerrar: es la racha de ese momento)
  const medallas = typeof insigniasDelDia === "function" ? insigniasDelDia(S, iso).map(id => findBadge(id)).filter(Boolean).map(b => b.nombre) : [];
  const racha = typeof computeClosedStreak === "function" ? computeClosedStreak() : 0;
  // el ánimo (del Diario) y la energía
  const de = ((S.vida && S.vida.diario) || []).find(e => e.fecha === iso && e.fromRitual);
  const libro = (S.lecturas || []).find(l => l && l.fin === iso && l.estado === "terminado");
  // mañana: un plan con amigos, un cumpleaños o un hábito que toca
  const man = agSumar(iso, 1);
  const plan = typeof plDelDia === "function" ? (plDelDia(man)[0] || null) : null;
  const amigos = (typeof AMIGOS !== "undefined" && AMIGOS.lista && AMIGOS.lista.amigos) || [];
  const cumple = typeof amigoCumpleEn === "function" ? amigos.find(a => { try { return amigoCumpleEn(a, iso) === 1; } catch (e) { return false; } }) : null;
  // de lo que toca mañana, primero lo que es propio de ese día (un hábito de días fijos); si no, uno de los diarios
  const tocan = (S.habitos.defs || []).filter(h => !h.pausado && hmMeta(h) === "hacer" && hmProgramado(h, man, S));
  const habMan = tocan.find(h => hmFreq(h).tipo === "dias") || tocan[Math.floor(notaEleAzar(iso, "man-hab") * tocan.length)] || null;
  return {
    cerradoTs: r.cerradoTs || null, sapo: !!(r.sapo && c.sapo), energia: [+r.energia || 0, +c.energia || 0],
    habs: habs.length, hechos: hechos.map(h => h.nombre), agua, tareas: t, medallas, racha,
    mood: de && de.mood ? +de.mood : 0, libro: libro ? libro.titulo : "",
    plan: plan ? plan.titulo : "", cumple: cumple ? (cumple.nombre || "un amigo") : "", habMan: habMan ? habMan.nombre : "",
  };
}

/* La nota: una apertura (la hora), hasta tres cosas del día, el ánimo si fue difícil y lo de mañana */
function notaElefante(iso, S) {
  const x = notaEleDatos(iso, S), uno = (sal, fr) => notaEleUna(iso, sal, fr), partes = [];
  // la hora del cierre
  if (x.cerradoTs) {
    const h = new Date(x.cerradoTs).getHours(), hh = notaEleHora(x.cerradoTs);
    partes.push(h >= 5 && h < 20 ? uno("hora", [`Cerraste temprano, a las ${hh}.`, `Hoy cerraste a las ${hh}: te queda tiempo para descansar.`])
      : h >= 23 || h < 5 ? uno("hora", [`Cerraste tarde, a las ${hh}.`, `Ya eran las ${hh} cuando cerraste.`])
      : uno("hora", [`Hoy cerraste a las ${hh}.`, `Cerraste tu día a las ${hh}.`]));
  } else partes.push("Hoy cerraste tu día.");
  // lo del día, de lo más especial a lo más común
  const cosas = [];
  if (x.medallas.length === 1) cosas.push(uno("med", [`Ganaste la medalla ${x.medallas[0]}: ya brilla en tu cielo.`, `Llegó ${x.medallas[0]} a tu vitrina.`]));
  else if (x.medallas.length > 1) cosas.push(`Ganaste ${x.medallas.length} medallas: tu cielo está más lleno.`);
  if (x.libro) cosas.push(`Terminaste «${x.libro}».`);
  const hito = [3, 7, 14, 21, 30, 50, 66, 100, 150, 200, 365].includes(x.racha) || (x.racha > 7 && x.racha % 10 === 0);
  if (hito) cosas.push(uno("racha", [`Llevas ${x.racha} días seguidos cerrando: ya es costumbre.`, `Van ${x.racha} días seguidos. Te estoy anotando en la pared.`]));
  if (x.agua && x.agua.ml > 0) {
    const L = litrosTxt(x.agua.ml), calor = x.agua.temp != null && x.agua.temp >= 28 ? ` con ${x.agua.temp} °C` : "";
    if (x.agua.ml >= x.agua.meta) cosas.push(uno("agua", [`Tomaste ${L} L${calor} y cumpliste tu meta.`, `Cumpliste tu agua: ${L} L${calor}. Yo me tomé un balde.`]));
    else cosas.push(x.agua.meta - x.agua.ml <= 500 ? `Tomaste ${L} L${calor}: te faltó poquito.` : `Tomaste ${L} L de agua${calor}.`);
  }
  if (x.habs && x.hechos.length === x.habs) cosas.push(x.habs === 1 ? `Cumpliste ${x.hechos[0]}.` : uno("hab", [`Cumpliste tus ${x.habs} hábitos.`, `No se te escapó ningún hábito: los ${x.habs}.`]));
  else if (x.hechos.length) cosas.push(`Hiciste ${notaEleLista(x.hechos.slice(0, 2))}${x.hechos.length > 2 ? ` y ${x.hechos.length - 2} más` : ""}.`);
  if (x.tareas && x.tareas[0] > 0) cosas.push(x.tareas[0] === x.tareas[1] ? `Sacaste todas tus tareas (${x.tareas[0]}).` : `Sacaste ${x.tareas[0]} de ${x.tareas[1]} tareas.`);
  else if (x.sapo) cosas.push("Le diste el primer bocado al día.");
  if (x.energia[0] && x.energia[1] && x.energia[1] - x.energia[0] >= 2) cosas.push(`Empezaste con energía ${x.energia[0]} y terminaste en ${x.energia[1]}: buen repunte.`);
  partes.push(...cosas.slice(0, 3));
  if (!cosas.length) partes.push(uno("nada", ["Fue un día tranquilo, y también cuentan.", "Un día simple también es un día con rumbo."]));
  // el ánimo: si fue difícil, se dice; si fue muy bueno, se celebra
  if (x.mood && x.mood <= 2) partes.push(uno("mood", ["Fue un día difícil. Mañana es otro, y yo sigo aquí.", "Hoy costó. Descansa, que mañana te espero."]));
  else if (x.mood === 5 && cosas.length) partes.push(uno("mood", ["Se nota que fue un buen día.", "Hoy te vi contento."]));
  else if (x.energia[1] && x.energia[1] <= 2) partes.push("Terminaste con poca energía: hoy toca dormir temprano.");
  // mañana
  if (x.plan) partes.push(`Mañana tienes «${x.plan}» con tus amigos: yo cuido la casa.`);
  else if (x.cumple) partes.push(`Mañana está de cumpleaños ${x.cumple}: ¿le mandamos un saludo?`);
  else if (x.habMan) partes.push(`Mañana toca ${x.habMan}: ${notaEleBroma(x.habMan)}.`);
  else partes.push(uno("man", ["Mañana seguimos.", "Mañana te espero con el café.", "Mañana volvemos a empezar."]));
  return partes.join(" ");
}

/* Al cerrar (normal o express): la nota se escribe en la entrada del día del Diario */
function notaElefanteGuardar(iso, S) {
  S = S || STATE;
  if (typeof checkBadges === "function" && typeof STATE !== "undefined" && S === STATE) checkBadges();   // las medallas del cierre ya cuentan
  S.vida.diario = S.vida.diario || [];
  let e = S.vida.diario.find(x => x.fecha === iso && x.fromRitual);
  if (!e) { e = { id: uid(), fecha: iso, fromRitual: true }; S.vida.diario.push(e); }
  e.ele = { texto: notaElefante(iso, S), ts: Date.now() };
  e.ts = Date.now();
  return e.ele;
}
function notaElefanteDe(iso, S) {
  const e = (((S || STATE).vida || {}).diario || []).find(x => x.fecha === iso && x.fromRitual && x.ele && x.ele.texto);
  return e ? e.ele : null;
}

/* -------- En la app: el recibo del cierre y el Diario -------- */
function notaElefanteHtml(iso, op) {
  const n = notaElefanteDe(iso); if (!n) return "";
  const dibujo = !(op && op.sinDibujo) && typeof elefanteSVG === "function" ? `<span class="ele-nota__ele" aria-hidden="true">${elefanteSVG({ anim: false })}</span>` : "";
  return `<figure class="ele-nota${op && op.compacta ? " ele-nota--compacta" : ""}">
    <div class="ele-nota__cab">${dibujo}<span class="ele-nota__k">Tu elefante te dejó una nota</span></div>
    <blockquote class="ele-nota__t">${escapeHtml(n.texto)}</blockquote>
    <figcaption class="ele-nota__pie"><span>— ${NOTA_ELE_FIRMA}</span>
      <button type="button" class="btn-link ele-nota__comp" data-action="elenota-compartir" data-iso="${iso}">${typeof iconoLinea === "function" ? iconoLinea("compartir", 16) : ""}Compartir</button></figcaption>
  </figure>`;
}

/* -------- Compartir: una imagen 1080 × 1350 (la publicación de Instagram), con tu elefante -------- */
function notaEleLineas(g, texto, ancho) {
  const out = []; let l = "";
  texto.split(/\s+/).forEach(p => { const t = l ? l + " " + p : p; if (g.measureText(t).width > ancho && l) { out.push(l); l = p; } else l = t; });
  if (l) out.push(l);
  return out;
}
function notaEleSvgImagen(svg) {
  return new Promise(res => {
    if (!svg) return res(null);
    const m = svg.match(/viewBox="([\d.\s-]+)"/), vb = m ? m[1].split(/\s+/).map(Number) : [0, 0, 300, 260];
    const conTam = svg.replace("<svg", `<svg width="${vb[2]}" height="${vb[3]}"`).replace(/class="[^"]*ele-anim[^"]*"/g, "");
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(conTam.includes("xmlns=") ? conTam : conTam.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'));
  });
}
async function imagenNotaElefante(iso) {
  const n = notaElefanteDe(iso); if (!n) return null;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  try { await Promise.all(["800 60px 'Bricolage Grotesque'", "500 46px 'Figtree'", "700 40px 'Figtree'"].map(f => document.fonts.load(f))); } catch (e) {}
  const F = (peso, px, fam) => `${peso} ${px}px ${fam === "t" ? "'Bricolage Grotesque'" : "'Figtree'"}, system-ui, -apple-system, 'Segoe UI', sans-serif`;
  // la noche de tu vitrina, con estrellas quietas
  const cielo = g.createLinearGradient(0, 0, 0, H); cielo.addColorStop(0, "#0C1130"); cielo.addColorStop(1, "#1C2557");
  g.fillStyle = cielo; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = notaEleAzar(iso, "x" + i) * W, y = notaEleAzar(iso, "y" + i) * 520, r = 1 + notaEleAzar(iso, "r" + i) * 2.4;
    g.fillStyle = `rgba(255,255,255,${0.25 + notaEleAzar(iso, "a" + i) * 0.55})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // la marca y la fecha
  g.fillStyle = "#FFFFFF"; g.font = F(800, 64, "t"); g.textBaseline = "alphabetic"; g.fillText("rumbo", 84, 136);
  g.fillStyle = "#F4AE3D"; g.beginPath(); g.arc(84 + g.measureText("rumbo").width + 18, 124, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#A9B8E8"; g.font = F(700, 34);
  g.fillText(agDate(iso).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), 84, 196);
  // la hoja de papel con la nota
  const X = 72, Y = 300, PW = W - 144, PH = 860;
  g.save(); g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 40; g.shadowOffsetY = 16;
  g.fillStyle = "#FFF8EA"; g.beginPath(); g.roundRect ? g.roundRect(X, Y, PW, PH, 34) : g.rect(X, Y, PW, PH); g.fill(); g.restore();
  g.strokeStyle = "rgba(57,73,201,.10)"; g.lineWidth = 2;
  for (let y = Y + 170; y < Y + PH - 60; y += 66) { g.beginPath(); g.moveTo(X + 50, y); g.lineTo(X + PW - 50, y); g.stroke(); }
  g.fillStyle = "#3949C9"; g.font = F(800, 46, "t"); g.fillText("Tu elefante te dejó una nota", X + 56, Y + 104);
  // el texto, ajustado al alto que hay
  let px = 60, lineas;
  do { g.font = F(500, px); lineas = notaEleLineas(g, n.texto, PW - 112); px -= 2; } while (lineas.length * px * 1.42 > PH - 330 && px > 32);
  px += 2; g.fillStyle = "#161A2E"; g.font = F(500, px);
  lineas.forEach((l, i) => g.fillText(l, X + 56, Y + 196 + i * px * 1.42));
  g.fillStyle = "#5A6183"; g.font = F(700, 38); g.fillText("— " + NOTA_ELE_FIRMA, X + 56, Y + PH - 64);
  // tu elefante, asomado a la hoja
  const ele = await notaEleSvgImagen(typeof elefanteSVG === "function" ? elefanteSVG({ anim: false }) : "");
  if (ele) { const ew = 330, eh = ew * (ele.height / ele.width || 0.86); g.drawImage(ele, W - ew - 40, Y + PH - eh * 0.62, ew, eh); }
  // el pie
  g.fillStyle = "#FFFFFF"; g.font = F(700, 44); g.fillText("Mi día con Rumbo", 84, H - 92);
  g.fillStyle = "#A9B8E8"; g.font = F(700, 34); g.fillText("rumbo.biplot.cl", 84, H - 44);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
async function compartirNotaElefante(iso) {
  const blob = await imagenNotaElefante(iso);
  if (!blob) return toast("No se pudo crear la imagen", true);
  const nombre = `rumbo-nota-${iso}.png`, texto = "La nota que me dejó mi elefante en Rumbo · rumbo.biplot.cl";
  try {
    const file = new File([blob], nombre, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); if (typeof registrarCompartido === "function") registrarCompartido(); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (typeof registrarCompartido === "function") registrarCompartido();
  toast("Imagen descargada: compártela donde quieras");
}
function notaElefanteAccion(a, d) {
  if (a === "elenota-compartir") return compartirNotaElefante(d.iso || todayISO());
}
