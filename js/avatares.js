/* ============================================================
   RUMBO · Avatares
   El elenco de BiPlot HQ en versión avatar (se ganan con un logro de su oficio;
   Plotty y Atlas vienen desde el inicio), un creador para armar el tuyo y
   personajes de Rumbo (gratis, en la Tienda o por rango). Todo en SVG con el
   trazo del elenco: tinta #0B1726, color plano y una sombra dura.
   En la app son personajes: no se dice quién es real ni quién está detrás.

   Datos: gamif.equipped.avatar = { id, propio: { piel, pelo, … }, ts } (gana el ts
   mayor entre equipos). Compras: "compra:av-<id>". Ganados: "hito:avatar:<id>".
   ============================================================ */

const AVATAR_ARTE = (function () {
  const INK = "#0B1726", SW = 2.2;
  const P = { claro:"#F6D2B8", medio:"#E0A77D", trigueno:"#C68A5E", moreno:"#9C6444", oscuro:"#6B412B", rosado:"#F2C2B0" };
  const sombra = c => ({ "#F6D2B8":"#E3B596","#E0A77D":"#C78B60","#C68A5E":"#A9704A","#9C6444":"#7F4F35","#6B412B":"#553322","#F2C2B0":"#DDA591" }[c] || "rgba(0,0,0,.18)");
  let UID = 0;
  /* Marco común: círculo de fondo, recorte y contorno */
  function marco(inner, bg, anillo){
    const id = "c" + (++UID);
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="48"/></clipPath></defs>
      ${anillo || ""}<circle cx="50" cy="50" r="48" fill="${bg}"/><g clip-path="url(#${id})">${inner}</g><circle cx="50" cy="50" r="48" fill="none" stroke="${INK}" stroke-width="2.4"/></svg>`;
  }
  /* Piezas del busto (coordenadas 0–100) */
  const hombros = (c, extra) => `<path d="M12 106 C12 84 30 73 50 73 C70 73 88 84 88 106 Z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>${extra || ""}`;
  const cuello = p => `<path d="M43 58 L43 75 Q50 80 57 75 L57 58 Z" fill="${p}" stroke="${INK}" stroke-width="${SW}"/><path d="M44 66 Q50 71 56 66 L56 60 L44 60 Z" fill="${sombra(p)}"/>`;
  const orejas = p => `<circle cx="29" cy="46" r="5" fill="${p}" stroke="${INK}" stroke-width="${SW}"/><circle cx="71" cy="46" r="5" fill="${p}" stroke="${INK}" stroke-width="${SW}"/>`;
  const cabeza = (p, ry) => `<ellipse cx="50" cy="44" rx="21" ry="${ry || 23}" fill="${p}" stroke="${INK}" stroke-width="${SW}"/><path d="M63 27 C73 36 73 54 62 64 C67 52 68 38 63 27 Z" fill="${sombra(p)}"/>`;
  const ojos = (o) => o === "feliz" ? `<path d="M39 48 Q42.5 44 46 48 M54 48 Q57.5 44 61 48" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<ellipse cx="42.5" cy="47" rx="2.4" ry="3" fill="${INK}"/><ellipse cx="57.5" cy="47" rx="2.4" ry="3" fill="${INK}"/><circle cx="43.3" cy="46" r=".9" fill="#fff"/><circle cx="58.3" cy="46" r=".9" fill="#fff"/>`;
  const cejas = c => `<path d="M38 41 Q42 39 46 40.5 M54 40.5 Q58 39 62 41" stroke="${c || INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const boca = (t) => t === "abierta" ? `<path d="M44 55 Q50 62 56 55 Z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`
    : `<path d="M44.5 55.5 Q50 60 55.5 55.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const mejillas = `<ellipse cx="38" cy="53" rx="3.2" ry="2" fill="#FF8FA3" opacity=".45"/><ellipse cx="62" cy="53" rx="3.2" ry="2" fill="#FF8FA3" opacity=".45"/>`;
  const placa = (txt) => { const w = txt.length > 3 ? 20 : 13, x = 63; return `<path d="M45 75 L${x - 3} 86 M56 75 L${x + 3} 86" stroke="#17C3B2" stroke-width="1.8"/><rect x="${x - w / 2}" y="85" width="${w}" height="9" rx="2" fill="#F2F4F7" stroke="${INK}" stroke-width="1.5"/><text x="${x}" y="91.6" text-anchor="middle" font-family="Space Mono,monospace" font-size="${txt.length > 3 ? 4.4 : 5.4}" font-weight="700" fill="#0E2A47">${txt}</text>`; };
  /* Pone la placa sobre el pecho (antes de cerrar el recorte circular) */
  const conPlaca = (svg, txt) => svg.replace('</g><circle cx="50" cy="50" r="48" fill="none"', placa(txt) + '</g><circle cx="50" cy="50" r="48" fill="none"');
  const cara = (p, o) => `${orejas(p)}${cabeza(p)}${ojos(o)}${boca(o === "feliz" ? "abierta" : "")}${mejillas}`;

  /* ---------- El elenco ---------- */
  const ELENCO = [
    { id:"lupe", n:"Lupe", placa:"E1", rol:"Diagnóstico", frase:"Lo que pides no siempre es lo que necesitas.", bg:"#17446F",
      gana:"Haz tu primera revisión trimestral", svg:()=>{ const p=P.claro; return marco(
        hombros("#E8DFC8", `<path d="M36 76 L50 92 L64 76 L58 74 L50 84 L42 74 Z" fill="#D4C8A8" stroke="${INK}" stroke-width="1.8"/><path d="M44 78 L50 82 L56 78 L56 86 L50 82 L44 86 Z" fill="#35679A" stroke="${INK}" stroke-width="1.4"/><circle cx="36" cy="92" r="4" fill="#F2F4F7" stroke="${INK}" stroke-width="1.6"/><path d="M36 90 v2 l1.5 1" stroke="${INK}" stroke-width="1.2"/>`) + cuello(p) +
        `<path d="M28 44 C26 26 36 18 50 18 C64 18 74 26 72 44 C70 34 62 27 50 27 C38 27 30 34 28 44 Z" fill="#DDE3EA" stroke="${INK}" stroke-width="${SW}"/>` + cara(p,"normal") +
        `<circle cx="50" cy="14" r="7" fill="#DDE3EA" stroke="${INK}" stroke-width="${SW}"/><path d="M40 9 L62 17" stroke="#F5883A" stroke-width="2.6" stroke-linecap="round"/><path d="M60 16.3 L63.5 17.5" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<circle cx="57.5" cy="47" r="7.5" fill="rgba(23,195,178,.35)" stroke="${INK}" stroke-width="2.4"/><circle cx="57.5" cy="47" r="4.2" fill="#fff"/><circle cx="57.5" cy="47" r="3" fill="${INK}"/><circle cx="58.6" cy="45.8" r="1.1" fill="#fff"/>`, "#17446F"); } },
    { id:"architect", n:"The Architect", placa:"E2", rol:"Estrategia y proyectos", frase:"Si no se puede dibujar, no se puede construir.", bg:"#0E2A47",
      gana:"Planifica y cierra 4 semanas seguidas", svg:()=>{ const p=P.trigueno; return marco(
        hombros("#2B2F36", `<path d="M40 74 Q50 84 60 74" stroke="#17C3B2" stroke-width="2" fill="none"/><text x="50" y="97" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="13" fill="#17C3B2">A</text>`) + cuello(p) + cara(p,"normal") +
        `<path d="M29 40 C28 22 40 16 51 17 C63 16 73 24 71 40 L67 34 L63 38 L58 31 L52 36 L46 30 L40 36 L34 32 Z" fill="#2A1E17" stroke="${INK}" stroke-width="${SW}"/>` +
        `<path d="M31 55 C34 66 44 70 50 70 C56 70 66 66 69 55 C64 60 58 62 50 62 C42 62 36 60 31 55 Z" fill="#2A1E17" stroke="${INK}" stroke-width="1.6"/>` +
        `<rect x="31" y="41" width="38" height="11" rx="5.5" fill="#17C3B2" stroke="${INK}" stroke-width="${SW}"/><path d="M35 44 h12" stroke="#BDF5EE" stroke-width="2" stroke-linecap="round"/>`, "#0E2A47"); } },
    { id:"celda", n:"Celda", placa:"E3", rol:"Datos y métricas", frase:"Si no cuadra, no avanza.", bg:"#17446F",
      gana:"Desbloquea Comparar meses o cierra un mes", svg:()=>{ const p=P.moreno; return marco(
        hombros("#17446F", `<path d="M22 84 H78 M20 94 H80 M36 76 V104 M50 80 V104 M64 76 V104" stroke="#35679A" stroke-width="1.6"/><rect x="50.8" y="84.8" width="12.4" height="8.4" fill="#17C3B2"/><rect x="22" y="94.8" width="13" height="8" fill="#17C3B2" opacity=".7"/>`) + cuello(p) + cara(p,"normal") +
        `<rect x="26" y="6" width="48" height="30" rx="4" fill="#1E1A1A" stroke="${INK}" stroke-width="${SW}"/><path d="M27 34 C27 40 29 44 29 46 M73 34 C73 40 71 44 71 46" stroke="${INK}" stroke-width="${SW}"/><path d="M26 36 Q50 30 74 36 L74 30 L26 30 Z" fill="#1E1A1A"/><rect x="62" y="2" width="4" height="12" rx="1" fill="#17C3B2" stroke="${INK}" stroke-width="1.4"/>` +
        `<rect x="36" y="42" width="12" height="10" rx="1.5" fill="none" stroke="${INK}" stroke-width="2.2"/><rect x="52" y="42" width="12" height="10" rx="1.5" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M48 46 h4" stroke="${INK}" stroke-width="2"/>`, "#17446F"); } },
    { id:"engine", n:"The Engine", placa:"E4", rol:"Ejecución y sistemas", frase:"Lo que se repite, se automatiza.", bg:"#0E2A47",
      gana:"Crea 5 tareas recurrentes", svg:()=>{ const p=P.medio; return marco(
        hombros("#2B2F36", `<circle cx="50" cy="92" r="6.5" fill="none" stroke="#F5883A" stroke-width="2.4"/><circle cx="50" cy="92" r="2.2" fill="#F5883A"/><path d="M50 83.5 v3 M50 97.5 v3 M41.5 92 h3 M55.5 92 h3" stroke="#F5883A" stroke-width="2.2"/>`) + cuello(p) +
        `<path d="M32 72 C28 64 32 60 36 64 M68 72 C72 64 68 60 64 64" stroke="${INK}" stroke-width="2.2" fill="none"/><rect x="26" y="66" width="11" height="12" rx="4" fill="#F5883A" stroke="${INK}" stroke-width="${SW}"/><rect x="63" y="66" width="11" height="12" rx="4" fill="#F5883A" stroke="${INK}" stroke-width="${SW}"/><path d="M34 72 Q50 82 66 72" stroke="${INK}" stroke-width="2.4" fill="none"/>` +
        cara(p,"normal") + `<path d="M31 55 C35 65 44 68 50 68 C56 68 65 65 69 55" stroke="#5A4232" stroke-width="3" stroke-dasharray="1.2 2.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M29 40 C27 24 38 17 48 17 C54 8 70 10 72 22 C74 30 72 36 71 40 C68 32 62 28 54 28 C44 28 34 32 29 40 Z" fill="#3A2A20" stroke="${INK}" stroke-width="${SW}"/>`, "#0E2A47"); } },
    { id:"grilla", n:"Grilla", placa:"E5", rol:"Diseño", frase:"Si hay que explicarlo, está mal diseñado.", bg:"#17446F",
      gana:"Cambia de tema por primera vez", svg:()=>{ const p=P.rosado; return marco(
        hombros("#0D6B57", `<rect x="36" y="78" width="28" height="30" rx="3" fill="#17A58F" stroke="${INK}" stroke-width="1.8"/><circle cx="40" cy="82" r="1.8" fill="#F2F4F7"/><circle cx="60" cy="82" r="1.8" fill="#F2F4F7"/><path d="M26 76 C36 84 64 84 74 76 L74 82 C64 90 36 90 26 82 Z" fill="#F2C94C" stroke="${INK}" stroke-width="1.6"/><path d="M34 80 v4 M40 82 v4 M46 83 v4 M52 83 v4 M58 82 v4 M64 80 v4" stroke="${INK}" stroke-width="1"/>`) + cuello(p) +
        `<path d="M38 22 L30 4 M62 22 L70 4" stroke="#F2C94C" stroke-width="3" stroke-linecap="round"/><path d="M30 4 l-1.5 -3 M70 4 l1.5 -3" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` + cara(p,"normal") +
        `<path d="M27 46 C24 24 36 16 50 16 C64 16 76 24 73 46 C70 34 64 28 56 26 C50 32 40 33 32 34 C30 38 28 42 27 46 Z" fill="#17C3B2" stroke="${INK}" stroke-width="${SW}"/>` +
        `<circle cx="42.5" cy="47" r="6" fill="rgba(255,255,255,.15)" stroke="${INK}" stroke-width="2"/><circle cx="57.5" cy="47" r="6" fill="rgba(255,255,255,.15)" stroke="${INK}" stroke-width="2"/><path d="M48.5 47 h3" stroke="${INK}" stroke-width="2"/>`, "#17446F"); } },
    { id:"bucle", n:"Bucle", placa:"E5", rol:"Desarrollo", frase:"Rebanada chica, entrega segura.", bg:"#0E2A47",
      gana:"Completa 100 tareas", svg:()=>{ const p=P.trigueno; const r=(x,y2,c)=>`<path d="M${x} 26 C${x-4} 44 ${x+5} 58 ${x} ${y2}" stroke="${INK}" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="M${x} 26 C${x-4} 44 ${x+5} 58 ${x} ${y2}" stroke="${c}" stroke-width="4.6" fill="none" stroke-linecap="round"/>`; return marco(
        hombros("#17446F", `<path d="M32 74 C28 66 34 62 38 66 M68 74 C72 66 66 62 62 66" stroke="${INK}" stroke-width="2.2" fill="none"/><rect x="27" y="68" width="10" height="10" rx="3" fill="#35679A" stroke="${INK}" stroke-width="1.8"/><rect x="63" y="68" width="10" height="10" rx="3" fill="#35679A" stroke="${INK}" stroke-width="1.8"/><path d="M36 74 Q50 84 64 74" stroke="${INK}" stroke-width="2" fill="none"/>`) + cuello(p) +
        r(29,70,"#2E5E9E") + r(71,70,"#2E5E9E") + r(34,66,"#35679A") + r(66,66,"#35679A") + cara(p,"normal") +
        `<path d="M28 42 C26 24 38 17 50 17 C62 17 74 24 72 42 C66 34 58 30 50 30 C42 30 34 34 28 42 Z" fill="#2E5E9E" stroke="${INK}" stroke-width="${SW}"/><path d="M36 24 v10 M44 20 v10 M52 19 v10 M60 21 v10" stroke="#1F4478" stroke-width="2"/>` +
        `<circle cx="50" cy="11" r="7" fill="#2E5E9E" stroke="${INK}" stroke-width="${SW}"/><rect x="43" y="15" width="14" height="4" rx="2" fill="#17C3B2" stroke="${INK}" stroke-width="1.4"/>`, "#0E2A47"); } },
    { id:"tamandua", n:"Tamandúa", placa:"E6", rol:"Validación", frase:"Si se puede romper, lo rompo yo antes.", bg:"#17446F",
      gana:"Logra una semana en Bandeja Cero", svg:()=>{ const p=P.claro; return marco(
        hombros("#F0E6D2", `<path d="M12 106 C12 86 24 76 38 74 L42 106 Z M88 106 C88 86 76 76 62 74 L58 106 Z" fill="#1B1F26" stroke="${INK}" stroke-width="1.8"/>`) + cuello(p) +
        `${orejas(p)}<ellipse cx="50" cy="44" rx="20" ry="24" fill="${p}" stroke="${INK}" stroke-width="${SW}"/>` +
        `<path d="M50 44 C58 44 72 48 76 54 C72 58 58 58 50 56 Z" fill="${p}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><circle cx="75" cy="54" r="2.2" fill="${INK}"/>` +
        `${ojos("normal")}<path d="M44 58 Q48 61 52 58.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
        `<path d="M30 36 C30 22 40 18 50 18 C60 18 70 22 70 36" fill="#6B4A36" stroke="${INK}" stroke-width="${SW}"/><path d="M29 32 H71" stroke="#2B2F36" stroke-width="4.5"/><rect x="44" y="26" width="12" height="10" rx="2.5" fill="#F2F4F7" stroke="${INK}" stroke-width="1.8"/><circle cx="50" cy="31" r="3" fill="#17C3B2"/>`, "#17446F"); } },
    { id:"faro", n:"Faro", placa:"E7", rol:"Puesta en marcha", frase:"No termina cuando se publica. Termina cuando se usa.", bg:"#0E2A47",
      gana:"Llega a 30 días cerrados seguidos", svg:()=>{ const p=P.claro; return marco(
        hombros("#F2F4F7", `<path d="M14 90 H86 M13 98 H87 M18 82 H82" stroke="#17446F" stroke-width="4"/><path d="M12 106 C12 88 22 78 34 75 L38 106 Z M88 106 C88 88 78 78 66 75 L62 106 Z" fill="#0E2A47" stroke="${INK}" stroke-width="1.8"/>`) + cuello(p) + cara(p,"feliz") +
        `<path d="M30 50 C30 66 40 76 50 76 C60 76 70 66 70 50 C66 56 60 60 50 60 C40 60 34 56 30 50 Z" fill="#F4F4F2" stroke="${INK}" stroke-width="${SW}"/><path d="M42 58 Q50 54 58 58" stroke="#F4F4F2" stroke-width="4" stroke-linecap="round"/><path d="M44 57.5 Q50 61 56 57.5" stroke="${INK}" stroke-width="1.8" fill="none"/>` +
        `<path d="M28 38 C28 20 38 12 50 12 C62 12 72 20 72 38 Z" fill="#17446F" stroke="${INK}" stroke-width="${SW}"/><rect x="26" y="33" width="48" height="8" rx="3" fill="#0E2A47" stroke="${INK}" stroke-width="${SW}"/><circle cx="50" cy="10" r="4.5" fill="#17C3B2" stroke="${INK}" stroke-width="1.8"/>`, "#0E2A47"); } },
    { id:"pepa", n:"Pepa", placa:"E9", rol:"Cosecha", frase:"Lo que sirve dos veces se guarda. Lo demás, se bota.", bg:"#17446F",
      gana:"Cumple todos tus objetivos de un mes", svg:()=>{ const p=P.trigueno; return marco(
        hombros("#E8DFC8", `<path d="M30 76 L34 106 M70 76 L66 106" stroke="#B9A57C" stroke-width="3"/><rect x="40" y="86" width="20" height="14" rx="3" fill="#D4C8A8" stroke="${INK}" stroke-width="1.6"/><path d="M50 84 q2 -6 7 -7 q-1 6 -7 7 Z" fill="#3FAA5F" stroke="${INK}" stroke-width="1.2"/>`) + cuello(p) +
        `<path d="M68 54 C80 60 82 74 76 86" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M68 54 C80 60 82 74 76 86" stroke="#6B4A36" stroke-width="4.4" fill="none" stroke-linecap="round" stroke-dasharray="4 2"/>` + orejas(p) + cabeza(p) + ojos("feliz") +
        `<path d="M44 55 Q50 60 56 55" stroke="${INK}" stroke-width="2" fill="none"/><rect x="47" y="56.5" width="6" height="4.5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1.4"/><path d="M50 56.5 v4.5" stroke="${INK}" stroke-width="1"/>${mejillas}` +
        `<path d="M28 44 C26 24 38 17 50 17 C62 17 74 24 72 44 C66 32 58 28 50 28 C42 28 34 32 28 44 Z" fill="#6B4A36" stroke="${INK}" stroke-width="${SW}"/>` +
        `<circle cx="31" cy="18" r="8.5" fill="#6B4A36" stroke="${INK}" stroke-width="${SW}"/><circle cx="69" cy="18" r="8.5" fill="#6B4A36" stroke="${INK}" stroke-width="${SW}"/><circle cx="31" cy="18" r="4" fill="#8A6246"/><circle cx="69" cy="18" r="4" fill="#8A6246"/>`, "#17446F"); } },
    { id:"atlas", n:"Atlas", placa:"360°", rol:"Mascota · ve la oficina entera", frase:"Desde aquí arriba se ve todo.", bg:"#17446F", libre:true,
      svg:()=>marco(`<ellipse cx="50" cy="52" rx="42" ry="10" fill="none" stroke="#35679A" stroke-width="3" transform="rotate(-14 50 52)"/>
        <circle cx="50" cy="50" r="25" fill="#123B63" stroke="${INK}" stroke-width="${SW}"/><path d="M26 50 H74 M50 25 V75 M30 38 H70 M30 62 H70" stroke="#35679A" stroke-width="1.6"/><ellipse cx="50" cy="50" rx="11" ry="25" fill="none" stroke="#35679A" stroke-width="1.6"/>
        <circle cx="50" cy="56" r="7" fill="#17C3B2" stroke="${INK}" stroke-width="1.8"/><circle cx="50" cy="56" r="3" fill="#BDF5EE"/><rect x="38" y="40" width="7" height="5" rx="1.5" fill="#17C3B2"/><rect x="55" y="40" width="7" height="5" rx="1.5" fill="#17C3B2"/>
        <path d="M8 60 C30 70 70 64 92 44" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" transform="rotate(0)"/><path d="M8 60 C30 70 70 64 92 44" stroke="#8FB6DA" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M34 32 C38 28 44 26 48 27" stroke="#BDF5EE" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`, "#17446F") },
    { id:"plotty", n:"Plotty", placa:"E0", rol:"Mascota · atiende la puerta", frase:"Tres preguntas. Prometo que no es un formulario.", bg:"#0E2A47", libre:true,
      svg:()=>marco(`<path d="M50 24 V14" stroke="${INK}" stroke-width="2.4"/><circle cx="50" cy="12" r="3.4" fill="#17C3B2" stroke="${INK}" stroke-width="1.6"/>
        <path d="M22 28 H38 M62 28 H78" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M30 28 V36 M70 28 V36" stroke="${INK}" stroke-width="2.4"/>
        <rect x="20" y="34" width="60" height="44" rx="12" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}"/><rect x="27" y="41" width="46" height="30" rx="6" fill="#0E2A47" stroke="${INK}" stroke-width="1.8"/>
        <g fill="#17C3B2"><rect x="37" y="48" width="4" height="6"/><rect x="59" y="48" width="4" height="6"/><rect x="38" y="60" width="4" height="3"/><rect x="42" y="63" width="16" height="3"/><rect x="58" y="60" width="4" height="3"/></g>
        <path d="M44 78 L50 86 L56 78" fill="#17C3B2" stroke="${INK}" stroke-width="1.6"/><ellipse cx="50" cy="92" rx="10" ry="2.5" fill="#17C3B2" opacity=".35"/>`, "#0E2A47") },
  ];

  /* ---------- Personajes de Rumbo ---------- */
  const EXTRAS = [
    { id:"brujula", n:"Brújula", d:"El símbolo de Rumbo. Siempre apunta a tu foco.", gratis:true, svg:()=>marco(`<circle cx="50" cy="52" r="28" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}"/><circle cx="50" cy="52" r="22" fill="none" stroke="#C9D5E2" stroke-width="1.6"/><path d="M50 30 L57 52 L50 74 L43 52 Z" fill="#E6ECF2" stroke="${INK}" stroke-width="1.6"/><path d="M50 30 L57 52 L43 52 Z" fill="#FF6B4A" stroke="${INK}" stroke-width="1.6"/><circle cx="50" cy="52" r="3" fill="${INK}"/><rect x="45" y="18" width="10" height="7" rx="2" fill="#D9A441" stroke="${INK}" stroke-width="1.6"/><path d="M38 62 Q41 59 44 62 M56 62 Q59 59 62 62" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`, "#17446F") },
    { id:"elefante", n:"Tu elefante", d:"La cara de tu elefante, con su tipo y su ropa.", gratis:true, svg:()=>marco(`<path d="M34 30 C12 28 8 60 18 74 C24 82 38 80 40 68 Z" fill="#7C91AB" stroke="${INK}" stroke-width="${SW}"/><path d="M32 40 C20 42 18 60 24 70 C28 74 34 72 36 66 Z" fill="#E8B4BF"/><circle cx="55" cy="50" r="26" fill="#9FB2C8" stroke="${INK}" stroke-width="${SW}"/><path d="M70 62 C80 74 80 88 72 96" stroke="${INK}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M70 62 C80 74 80 88 72 96" stroke="#9FB2C8" stroke-width="11.6" fill="none" stroke-linecap="round"/><ellipse cx="66" cy="47" rx="2.6" ry="3.2" fill="${INK}"/><circle cx="67" cy="46" r="1" fill="#fff"/><ellipse cx="72" cy="56" rx="4" ry="2.4" fill="#FF8FA3" opacity=".6"/><path d="M50 26 C54 22 60 22 64 25" stroke="#C3D1E0" stroke-width="3" fill="none" stroke-linecap="round"/>`, "#17446F") },
    { id:"buho", n:"Búho", d:"Para quien cierra el día tarde.", c:150, svg:()=>marco(`<path d="M26 40 L32 24 L42 34 M74 40 L68 24 L58 34" fill="#6B4A36" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><ellipse cx="50" cy="60" rx="26" ry="32" fill="#8A6246" stroke="${INK}" stroke-width="${SW}"/><ellipse cx="50" cy="72" rx="15" ry="18" fill="#E8DFC8"/><circle cx="40" cy="50" r="10" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}"/><circle cx="60" cy="50" r="10" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}"/><circle cx="41" cy="51" r="4.5" fill="${INK}"/><circle cx="59" cy="51" r="4.5" fill="${INK}"/><circle cx="42" cy="49.5" r="1.4" fill="#fff"/><circle cx="60" cy="49.5" r="1.4" fill="#fff"/><path d="M47 58 L50 64 L53 58 Z" fill="#F5883A" stroke="${INK}" stroke-width="1.4"/><path d="M76 20 a7 7 0 1 0 6 11 a6 6 0 1 1 -6 -11 Z" fill="#F2C94C"/>`, "#0E2A47") },
    { id:"sol", n:"Madrugador", d:"Un sol que abre el día antes que nadie.", c:150, svg:()=>marco(`<g stroke="#F2C94C" stroke-width="4" stroke-linecap="round"><path d="M50 8 V18 M50 82 V92 M8 50 H18 M82 50 H92 M20 20 L27 27 M73 73 L80 80 M80 20 L73 27 M27 73 L20 80"/></g><circle cx="50" cy="50" r="24" fill="#F2C94C" stroke="${INK}" stroke-width="${SW}"/><path d="M58 30 C66 34 70 42 70 50" stroke="#FFE7A0" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M40 48 Q43 44 46 48 M54 48 Q57 44 60 48" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M42 56 Q50 64 58 56" stroke="${INK}" stroke-width="2.2" fill="#fff" stroke-linejoin="round"/><ellipse cx="38" cy="55" rx="3" ry="2" fill="#FF8FA3" opacity=".6"/><ellipse cx="62" cy="55" rx="3" ry="2" fill="#FF8FA3" opacity=".6"/>`, "#17446F") },
    { id:"brote", n:"Brote", d:"Algo que crece un poco cada día.", gratis:true, svg:()=>marco(`<path d="M28 70 H72 L66 94 H34 Z" fill="#C0643D" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><rect x="25" y="64" width="50" height="10" rx="3" fill="#D87A50" stroke="${INK}" stroke-width="${SW}"/><path d="M50 64 V40" stroke="#2E8B57" stroke-width="4" stroke-linecap="round"/><path d="M50 46 C36 46 28 36 30 26 C42 26 50 34 50 46 Z" fill="#3FAA5F" stroke="${INK}" stroke-width="${SW}"/><path d="M50 40 C62 40 72 30 70 20 C58 20 50 28 50 40 Z" fill="#4CC06E" stroke="${INK}" stroke-width="${SW}"/><path d="M42 80 Q45 77 48 80 M52 80 Q55 77 58 80" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`, "#0E2A47") },
    { id:"taza", n:"Cafecito", d:"Para las mañanas de primer bocado.", c:200, svg:()=>marco(`<path d="M38 28 C34 22 42 18 38 12 M50 28 C46 22 54 18 50 12 M62 28 C58 22 66 18 62 12" stroke="#C9D5E2" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M24 34 H70 L66 78 C65 84 60 88 54 88 H40 C34 88 29 84 28 78 Z" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}"/><path d="M70 42 C84 42 84 64 68 64" stroke="${INK}" stroke-width="${SW}" fill="none"/><path d="M70 46 C78 46 78 60 69 60" stroke="#F2F4F7" stroke-width="3" fill="none"/><rect x="24" y="44" width="46" height="8" fill="#FF6B4A"/><path d="M38 64 Q41 60 44 64 M52 64 Q55 60 58 64" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M43 71 Q48 75 53 71" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`, "#17446F") },
    { id:"cohete", n:"Cohete", d:"Para las semanas en que todo avanza.", c:300, svg:()=>marco(`<path d="M50 12 C66 24 68 50 62 72 H38 C32 50 34 24 50 12 Z" fill="#F2F4F7" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M50 12 C58 18 62 26 64 34 H36 C38 26 42 18 50 12 Z" fill="#FF6B4A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><circle cx="50" cy="48" r="8" fill="#17C3B2" stroke="${INK}" stroke-width="${SW}"/><path d="M38 60 L26 76 L38 72 Z M62 60 L74 76 L62 72 Z" fill="#35679A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M42 72 C42 84 50 94 50 94 C50 94 58 84 58 72 Z" fill="#F2C94C" stroke="${INK}" stroke-width="1.8"/><path d="M46 72 C46 80 50 86 50 86 C50 86 54 80 54 72 Z" fill="#FF6B4A"/>`, "#0E2A47") },
    { id:"montana", n:"Cumbre", d:"Para quien ya llegó lejos. Se gana en rango Maestro.", gana:"Llega al rango Maestro (4.000 XP)", svg:()=>marco(`<circle cx="74" cy="28" r="8" fill="#F2C94C"/><path d="M4 90 L36 40 L52 62 L64 46 L96 90 Z" fill="#35679A" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M36 40 L28 52 L34 50 L38 56 L44 50 Z" fill="#F2F4F7" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M64 46 L58 54 L62 53 L66 57 L70 52 Z" fill="#F2F4F7" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M36 40 V22" stroke="${INK}" stroke-width="2.2"/><path d="M36 22 L48 26 L36 30 Z" fill="#FF6B4A" stroke="${INK}" stroke-width="1.6"/>`, "#17446F") },
  ];

  /* ---------- Creador ---------- */
  const PELOS = {
    corto: c => `<path d="M29 40 C28 22 40 16 51 17 C63 16 73 24 71 40 C66 32 58 28 50 28 C42 28 34 32 29 40 Z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>`,
    largo: c => `<path d="M24 50 C20 72 24 88 30 100 L70 100 C76 88 80 72 76 50 Z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>`,
    largoTop: c => `<path d="M27 50 C24 24 38 16 50 16 C64 16 77 26 73 50 C71 36 66 30 58 27 C52 34 40 36 32 36 C29 40 28 45 27 50 Z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>`,
    moño: c => `<path d="M28 44 C26 24 38 17 50 17 C62 17 74 24 72 44 C66 32 58 28 50 28 C42 28 34 32 28 44 Z" fill="${c}" stroke="${INK}" stroke-width="${SW}"/><circle cx="50" cy="12" r="8" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>`,
    rulos: c => { let s=""; [[32,30],[40,22],[50,19],[60,22],[68,30],[72,40],[28,40]].forEach(([x,y])=>{ s+=`<circle cx="${x}" cy="${y}" r="8" fill="${c}" stroke="${INK}" stroke-width="${SW}"/>`; }); return s; },
    rapado: c => `<path d="M30 36 C32 24 40 20 50 20 C60 20 68 24 70 36 C62 30 38 30 30 36 Z" fill="${c}" opacity=".85"/>`,
    calvo: c => ``,
  };
  const PIELES = Object.values(P);
  const COL_PELO = ["#2A1E17","#6B4A36","#C9924E","#E3C27A","#B33A2E","#DDE3EA","#17C3B2","#2E5E9E"];
  const ROPA = ["#17446F","#2B2F36","#0D6B57","#FF6B4A","#E8DFC8","#6B4BD6"];
  const B = { piel:P.medio, pelo:"corto", colPelo:"#2A1E17", lentes:"no", barba:"no", ropa:"#17446F", animo:"feliz" };
  function armado(o){
    const p = o.piel, pelo = PELOS[o.pelo] || PELOS.corto;
    const detras = o.pelo === "largo" ? PELOS.largo(o.colPelo) : "";
    const arriba = o.pelo === "largo" ? PELOS.largoTop(o.colPelo) : pelo(o.colPelo);
    const lentes = o.lentes === "redondos" ? `<circle cx="42.5" cy="47" r="6" fill="rgba(255,255,255,.15)" stroke="${INK}" stroke-width="2"/><circle cx="57.5" cy="47" r="6" fill="rgba(255,255,255,.15)" stroke="${INK}" stroke-width="2"/><path d="M48.5 47 h3" stroke="${INK}" stroke-width="2"/>`
      : o.lentes === "cuadrados" ? `<rect x="36" y="42" width="12" height="10" rx="2" fill="rgba(255,255,255,.12)" stroke="${INK}" stroke-width="2.2"/><rect x="52" y="42" width="12" height="10" rx="2" fill="rgba(255,255,255,.12)" stroke="${INK}" stroke-width="2.2"/><path d="M48 46 h4" stroke="${INK}" stroke-width="2"/>`
      : o.lentes === "sol" ? `<rect x="35" y="42" width="30" height="10" rx="5" fill="#1D2330"/><path d="M40 45 h6" stroke="#8FE3DA" stroke-width="2" stroke-linecap="round"/>` : "";
    const barba = o.barba === "si" ? `<path d="M31 53 C34 66 44 70 50 70 C56 70 66 66 69 53 C64 60 58 62 50 62 C42 62 36 60 31 53 Z" fill="${o.colPelo}" stroke="${INK}" stroke-width="1.6"/>` : o.barba === "bigote" ? `<path d="M42 55 Q50 51 58 55 Q50 57 42 55 Z" fill="${o.colPelo}" stroke="${INK}" stroke-width="1.4"/>` : "";
    return marco(detras + hombros(o.ropa) + cuello(p) + cara(p, o.animo) + barba + arriba + lentes, "#17446F");
  }
  return { INK, P, PIELES, COL_PELO, ROPA, PELOS, ELENCO, EXTRAS, marco, armado, conPlaca };
})();

/* -------- Catálogo: cómo se consigue cada avatar -------- */
const AVATAR_METAS = {
  lupe:      { gana: "Haz tu primera revisión trimestral", metrica: s => typeof g_trimestresCerrados === "function" ? g_trimestresCerrados(s) : 0, meta: 1 },
  architect: { gana: "Planifica y cierra 4 semanas seguidas", metrica: s => typeof g_semanasSeguidas === "function" && g_semanasSeguidas(s, 4) ? 1 : 0, meta: 1 },
  celda:     { gana: "Cierra un mes (o desbloquea Comparar meses)", metrica: s => (Object.values((s.ritual && s.ritual.meses) || {}).some(m => m && m.cierre) || ((s.gamif.owned || []).includes("fun-comparar"))) ? 1 : 0, meta: 1 },
  engine:    { gana: "Crea 5 tareas recurrentes", metrica: s => typeof recurrentes === "function" ? recurrentes(s).filter(r => r && !r.borrada).length : 0, meta: 5 },
  grilla:    { gana: "Cambia de tema por primera vez", metrica: s => s.settings && s.settings.theme && s.settings.theme !== "navy" ? 1 : 0, meta: 1 },
  bucle:     { gana: "Completa 100 tareas", metrica: s => typeof lg_tareas === "function" ? lg_memo(s, "hechas", x => lg_tareas(x, t => estadoTarea(t) === "hecha")) : 0, meta: 100 },
  tamandua:  { gana: "Logra una semana en Bandeja Cero", metrica: s => typeof lg_bandejaCero === "function" && lg_bandejaCero(s) ? 1 : 0, meta: 1 },
  faro:      { gana: "Llega a 30 días cerrados seguidos", metrica: s => typeof eleMejorRacha === "function" ? eleMejorRacha(s) : 0, meta: 30 },
  pepa:      { gana: "Cumple todos tus objetivos de un mes", metrica: s => typeof lg_mesPerfecto === "function" && lg_mesPerfecto(s) ? 1 : 0, meta: 1 },
  montana:   { gana: "Llega al rango Maestro (4.000 XP)", metrica: s => s.gamif.xp || 0, meta: 4000 },
};
const AVATAR_PRECIOS = { buho: 150, sol: 150, taza: 200, cohete: 300 };
const AVATAR_GRATIS = ["plotty", "atlas", "brujula", "elefante", "brote", "propio"];
/* Lista completa: { id, n, grupo, …arte } */
function avataresCatalogo() {
  const A = AVATAR_ARTE;
  return [
    ...A.ELENCO.map(e => Object.assign({ grupo: "elenco" }, e)),
    ...A.EXTRAS.map(e => Object.assign({ grupo: "rumbo" }, e)),
  ];
}
function avatarDef(id) { return avataresCatalogo().find(a => a.id === id); }

/* -------- Estado -------- */
function avEstado(S) {
  S = S || STATE;
  const eq = S.gamif.equipped = S.gamif.equipped || {};
  if (!eq.avatar || typeof eq.avatar !== "object") eq.avatar = { id: null, propio: null, ts: 0 };
  return eq.avatar;
}
function avTocar(S) { const a = avEstado(S); a.ts = Math.max(Date.now(), (a.ts || 0) + 1); return a; }
const AV_PROPIO_BASE = { piel: "#E0A77D", pelo: "corto", colPelo: "#2A1E17", lentes: "no", barba: "no", ropa: "#17446F", animo: "feliz" };

/* ¿Lo tiene? gratis, comprado, o ganado (queda como hito en el ledger) */
function avatarTiene(id, S) {
  S = S || STATE;
  if (AVATAR_GRATIS.includes(id)) return true;
  const owned = (S.gamif && S.gamif.owned) || [];
  if (AVATAR_PRECIOS[id]) return owned.includes("av-" + id);
  return ((S.gamif && S.gamif.ledger) || []).some(m => m && m.id === "hito:avatar:" + id && !m.anulado);
}
function avatarProgreso(id, S) {
  const M = AVATAR_METAS[id]; if (!M) return null;
  let v = 0; try { v = M.metrica(S || STATE) || 0; } catch (e) {}
  return { v: Math.min(v, M.meta), meta: M.meta, pct: Math.min(100, Math.round((v / M.meta) * 100)) };
}
/* Revisa las metas (en cada render); devuelve los avatares recién ganados */
function revisarAvatares(S) {
  S = S || STATE;
  const nuevos = [];
  Object.keys(AVATAR_METAS).forEach(id => {
    if (avatarTiene(id, S)) return;
    const p = avatarProgreso(id, S);
    if (p && p.v >= p.meta && ledgerRegistrar(S, "hito:avatar:" + id, 0, 0, "Nuevo avatar: " + avatarDef(id).n)) nuevos.push(id);
  });
  return nuevos;
}
function avisarAvatares() {
  if (!STATE || !STATE.gamif) return;
  const nuevos = revisarAvatares(STATE);
  if (!nuevos.length) return;
  saveState();
  toast(`🎭 Nuevo avatar: ${avatarDef(nuevos[0]).n}. Elígelo en Cuenta → Tu avatar`);
}

/* -------- Dibujo -------- */
/* Tu elefante dentro del círculo (tipo, etapa y ropa reales) */
function avatarElefante() {
  if (typeof elefanteSVG !== "function") return AVATAR_ARTE.EXTRAS.find(e => e.id === "elefante").svg();
  const ele = elefanteSVG({ anim: false }).replace(/^<svg[^>]*>/, '<svg x="-18" y="2" width="136" height="126" viewBox="0 0 260 240">');
  return AVATAR_ARTE.marco(ele, "#17446F");
}
function avatarSVG(id, S) {
  S = S || STATE;
  const a = avEstado(S);
  id = id || a.id;
  if (id === "propio") return AVATAR_ARTE.armado(Object.assign({}, AV_PROPIO_BASE, a.propio || {}));
  if (id === "elefante") return avatarElefante();
  const d = avatarDef(id); if (!d) return null;
  return d.grupo === "elenco" && !d.libre ? AVATAR_ARTE.conPlaca(d.svg(), d.placa) : d.svg();
}
/* Lo que va dentro del círculo del menú e Inicio: el avatar elegido, o la inicial como antes */
function avatarActualHtml(inicial) {
  const a = avEstado();
  if (!a.id || !avatarTiene(a.id)) return escapeHtml(inicial);
  return `<span class="av-dibujo">${avatarSVG(a.id)}</span>`;
}

/* -------- Acciones -------- */
let AV_TAB = "elenco", AV_PRUEBA = null;
function elegirAvatar(id) {
  if (!avatarTiene(id)) return toast("Ese avatar todavía no es tuyo", true);
  avTocar().id = id; AV_PRUEBA = null;
  saveState(); renderAccountBox(); rerender(); openAvatar(AV_TAB);
  toast("🎭 Avatar actualizado");
}
function comprarAvatar(id) {
  const c = AVATAR_PRECIOS[id]; if (!c || avatarTiene(id)) return;
  recalcGamif(STATE);
  if (STATE.gamif.puntos < c) return toast("Te faltan " + (c - STATE.gamif.puntos) + " ⭐", true);
  const res = ledgerComprar(STATE, "av-" + id, c);
  if (!res.ok && !res.yaTenia) return toast("Te faltan " + res.falta + " ⭐", true);
  avTocar().id = id; AV_PRUEBA = null;
  saveState(); updateTopbar(); renderAccountBox(); rerender(); openAvatar(AV_TAB);
  toast(`🎭 ${avatarDef(id).n} es tu avatar`);
}
function quitarAvatar() { avTocar().id = null; saveState(); renderAccountBox(); rerender(); openAvatar(AV_TAB); toast("Vuelves a tu inicial"); }
function propioCambiar(k, v) {
  const a = avTocar();
  a.propio = Object.assign({}, AV_PROPIO_BASE, a.propio || {}, { [k]: v });
  a.id = "propio";
  saveState(); renderAccountBox(); openAvatar("propio");
}
function probarAvatar(id) { AV_PRUEBA = AV_PRUEBA === id ? null : id; openAvatar(AV_TAB); }

/* -------- Selector (Cuenta → Tu avatar, o tocando tu avatar) -------- */
function openAvatar(tab) {
  AV_TAB = ["elenco", "propio", "rumbo"].includes(tab) ? tab : AV_TAB || "elenco";
  const a = avEstado(), actual = a.id && avatarTiene(a.id) ? a.id : null;
  const vistaId = AV_PRUEBA || actual;
  const inicial = ((STATE.profile && STATE.profile.name) || "R").trim()[0] || "R";
  const vista = vistaId ? avatarSVG(vistaId) : `<div class="account__avatar av-grande">${escapeHtml(inicial.toUpperCase())}</div>`;
  const dv = vistaId ? (vistaId === "propio" ? { n: "Tu avatar" } : avatarDef(vistaId)) : null;
  const tabs = `<div class="seg vest-tabs"><button class="${AV_TAB === "elenco" ? "is-active" : ""}" data-action="av-tab" data-v="elenco">🏢 Elenco</button><button class="${AV_TAB === "propio" ? "is-active" : ""}" data-action="av-tab" data-v="propio">✏️ Arma el tuyo</button><button class="${AV_TAB === "rumbo" ? "is-active" : ""}" data-action="av-tab" data-v="rumbo">🧭 Rumbo</button></div>`;
  let panel;
  if (AV_TAB === "propio") {
    const o = Object.assign({}, AV_PROPIO_BASE, a.propio || {}), A = AVATAR_ARTE;
    const fila = (lab, k, vals) => `<div class="av-op"><span>${lab}</span><div class="row-wrap" style="gap:6px">${vals.map(([v, t]) => `<button type="button" class="chip ${o[k] === v ? "chip--cian" : ""}" data-action="av-propio" data-k="${k}" data-v="${v}" aria-pressed="${o[k] === v}">${t}</button>`).join("")}</div></div>`;
    const colores = (lab, k, vals) => `<div class="av-op"><span>${lab}</span><div class="row-wrap" style="gap:8px">${vals.map(v => `<button type="button" class="av-color ${o[k] === v ? "is-on" : ""}" data-action="av-propio" data-k="${k}" data-v="${v}" style="background:${v}" aria-label="Color" aria-pressed="${o[k] === v}"></button>`).join("")}</div></div>`;
    panel = colores("Piel", "piel", A.PIELES) +
      fila("Peinado", "pelo", [["corto", "Corto"], ["largo", "Largo"], ["moño", "Moño"], ["rulos", "Rulos"], ["rapado", "Rapado"], ["calvo", "Sin pelo"]]) +
      colores("Color de pelo", "colPelo", A.COL_PELO) +
      fila("Lentes", "lentes", [["no", "Sin lentes"], ["redondos", "Redondos"], ["cuadrados", "Cuadrados"], ["sol", "De sol"]]) +
      fila("Barba", "barba", [["no", "Sin barba"], ["si", "Barba"], ["bigote", "Bigote"]]) +
      colores("Ropa", "ropa", A.ROPA) +
      fila("Expresión", "animo", [["feliz", "Feliz"], ["normal", "Tranquila"]]) +
      `<p class="text-xs muted">Cada cambio se guarda al tiro y queda como tu avatar.</p>`;
  } else {
    const lista = avataresCatalogo().filter(d => d.grupo === AV_TAB);
    panel = `<div class="av-grid">${lista.map(d => {
      const tiene = avatarTiene(d.id), on = actual === d.id, prueba = AV_PRUEBA === d.id;
      const pr = !tiene && AVATAR_METAS[d.id] ? avatarProgreso(d.id) : null;
      const estado = on ? `<span class="vest-tag is-on">✓ Tu avatar</span>` : tiene ? `<span class="vest-tag is-tuya">Tuyo</span>`
        : AVATAR_PRECIOS[d.id] ? `<span class="vest-tag">${AVATAR_PRECIOS[d.id]} ⭐</span>` : `<span class="vest-tag is-gana">🔒 Se gana</span>`;
      return `<button type="button" class="av-ficha ${on ? "is-on" : ""} ${prueba ? "is-prueba" : ""} ${tiene ? "" : "is-no"}" data-action="${tiene ? "av-elegir" : "av-probar"}" data-id="${d.id}" aria-pressed="${on}">
        <span class="av-ficha__img">${avatarSVG(d.id)}</span><span class="av-ficha__n">${escapeHtml(d.n)}${d.placa ? ` <i class="av-placa">${d.placa}</i>` : ""}</span>${estado}
        ${pr ? `<span class="bar" style="width:100%"><span class="bar__fill" style="display:block;width:${pr.pct}%"></span></span>` : ""}</button>`;
    }).join("")}</div>`;
  }
  let barra = "";
  if (AV_PRUEBA && !avatarTiene(AV_PRUEBA)) {
    const d = avatarDef(AV_PRUEBA), M = AVATAR_METAS[AV_PRUEBA], c = AVATAR_PRECIOS[AV_PRUEBA], pr = M ? avatarProgreso(AV_PRUEBA) : null;
    barra = c ? `<div class="vest-barra is-compra"><span>Te estás probando <b>${escapeHtml(d.n)}</b></span><button class="btn btn--primary" data-action="av-comprar" data-id="${d.id}">Comprar · ${c} ⭐</button></div>`
      : `<div class="vest-barra"><span>🔒 <b>${escapeHtml(d.n)}</b> · ${escapeHtml(M.gana)}${pr && pr.meta > 1 ? ` (${pr.v.toLocaleString("es-CL")}/${pr.meta.toLocaleString("es-CL")})` : ""}.</span><button class="btn-ghost" data-action="av-probar" data-id="${d.id}">Volver</button></div>`;
  }
  openModal("🎭 Tu avatar", `<div class="vestidor av-selector"><div class="vest-izq">
      <div class="av-vista">${vista}</div>
      <div class="vest-nombre"><b>${dv ? escapeHtml(dv.n) : "Tu inicial"}</b>${actual ? `<button class="btn-ghost" data-action="av-quitar" style="padding:3px 10px">Usar mi inicial</button>` : ""}</div>
      ${dv && dv.frase ? `<p class="text-xs muted">«${escapeHtml(dv.frase)}»</p>` : dv && dv.d ? `<p class="text-xs muted">${escapeHtml(dv.d)}</p>` : ""}
    </div><div class="vest-der">${tabs}${panel}${barra}</div></div>`, { ancho: true });
}
function renderAvatarCuenta() {
  const a = avEstado(), d = a.id && avatarTiene(a.id) ? (a.id === "propio" ? { n: "Tu avatar" } : avatarDef(a.id)) : null;
  return `<div class="card mt-16"><div class="flex-between" style="gap:14px;flex-wrap:wrap">
    <div class="row" style="gap:14px"><div class="account__avatar avatar-lg${typeof marcoClase === "function" ? marcoClase() : ""}">${avatarActualHtml(((STATE.profile && STATE.profile.name) || "R").trim()[0].toUpperCase())}</div>
      <div><div class="card__title" style="font-size:15px">🎭 Tu avatar</div><div class="text-sm muted mt-8">${d ? escapeHtml(d.n) : "Hoy usas tu inicial."} Elige uno del elenco, arma el tuyo o usa un personaje de Rumbo.</div></div></div>
    <button class="btn btn--primary" data-action="av-abrir">Elegir avatar</button></div></div>`;
}
