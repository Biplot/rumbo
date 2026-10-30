/* ============================================================
   RUMBO · Avatares
   La manada: los amigos de tu elefante (se ganan con un logro de su oficio;
   el Cóndor y el Pudú vienen desde el inicio), un creador para armar el tuyo y
   los símbolos de Rumbo (gratis, en la Tienda o por rango). Todo en SVG con el
   estilo de Norte: planos, sin contorno negro, fondos de la paleta y los rasgos
   en tinta índigo. Se leen bien desde 32 px.
   Los ids son los del elenco de antes (lupe, architect, …): quien ya ganó uno lo conserva.

   Datos: gamif.equipped.avatar = { id, propio: { piel, pelo, …, fondo }, ts } (gana el ts
   mayor entre equipos). Compras: "compra:av-<id>". Ganados: "hito:avatar:<id>".
   ============================================================ */

const AVATAR_ARTE = (function () {
  const T = "#161A2E";   // tinta índigo: ojos, boca, narices
  const F = { noche: "#1C2242", indigo: "#DCE0FB", ambar: "#FCE6BF", salvia: "#D9EADC", rosa: "#F8DCE2", cielo: "#D8E8F6", crema: "#F3EEE4" };
  const AMBAR = "#F4AE3D", INDIGO = "#3949C9", INDIGO_CL = "#8D9BFF";
  let UID = 0;
  /* Un poco más oscuro (para la sombra de cada forma) */
  const osc = (hex, k = 0.16) => { const n = parseInt(hex.slice(1), 16), c = s => Math.round(((n >> s) & 255) * (1 - k)); return "#" + [16, 8, 0].map(s => c(s).toString(16).padStart(2, "0")).join(""); };
  function marco(inner, bg) {
    const id = "avn" + (++UID);
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#${id})"><rect width="100" height="100" fill="${bg}"/>${inner}</g></svg>`;
  }
  const ojos = (x1, x2, y, r = 2.4, c = T) => `<circle cx="${x1}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x1 + r * .35}" cy="${y - r * .4}" r="${r * .32}" fill="#fff"/><circle cx="${x2 + r * .35}" cy="${y - r * .4}" r="${r * .32}" fill="#fff"/>`;
  const sonrisa = (x, y, w = 6, c = T, g = 2.2) => `<path d="M${x - w} ${y} Q${x} ${y + w * .9} ${x + w} ${y}" stroke="${c}" stroke-width="${g}" fill="none" stroke-linecap="round"/>`;
  const mejillas = (x1, x2, y, c = "#F08A8A") => `<circle cx="${x1}" cy="${y}" r="3.2" fill="${c}" opacity=".38"/><circle cx="${x2}" cy="${y}" r="3.2" fill="${c}" opacity=".38"/>`;

  /* ---------------- El creador: tu persona ---------------- */
  const PIELES = ["#F7D7C1", "#EDB894", "#D59A70", "#B07650", "#8A5A3B", "#5E3A26"];
  const COL_PELO = ["#231B18", "#5C3B29", "#A9713E", "#E1BC74", "#A8432F", "#CDD2DB", AMBAR, INDIGO];
  const ROPA = [INDIGO, T, "#4E8B66", AMBAR, "#EFE6D6", "#7B61C9"];
  const FONDOS = ["indigo", "ambar", "salvia", "rosa", "cielo", "crema", "noche"];
  /* Los colores del creador de antes pasan a su par en la paleta nueva */
  const VIEJOS = {
    "#F6D2B8": PIELES[0], "#E0A77D": PIELES[1], "#C68A5E": PIELES[2], "#9C6444": PIELES[3], "#6B412B": PIELES[4], "#F2C2B0": PIELES[0],
    "#2A1E17": COL_PELO[0], "#6B4A36": COL_PELO[1], "#C9924E": COL_PELO[2], "#E3C27A": COL_PELO[3], "#B33A2E": COL_PELO[4], "#DDE3EA": COL_PELO[5], "#17C3B2": COL_PELO[6], "#2E5E9E": COL_PELO[7],
    "#17446F": ROPA[0], "#2B2F36": ROPA[1], "#0D6B57": ROPA[2], "#FF6B4A": ROPA[3], "#E8DFC8": ROPA[4], "#6B4BD6": ROPA[5],
  };
  function alDia(o) {
    const r = Object.assign({}, B, o);
    ["piel", "colPelo", "ropa"].forEach(k => { const v = String(r[k] || "").toUpperCase(); if (VIEJOS[v]) r[k] = VIEJOS[v]; });
    if (!PELOS[r.pelo]) r.pelo = B.pelo;
    if (!F[r.fondo]) r.fondo = B.fondo;
    return r;
  }
  const PELOS = {
    corto: c => `<path d="M30.5 44 C29 27 39 19.5 51 19.5 C63 19.5 71.5 28 69.5 44 C67 34.5 60 29.5 51.5 30 C43 30.5 36 34 30.5 44 Z" fill="${c}"/>`,
    largoAtras: c => `<path d="M27 47 C25 26 37 18 50 18 C63 18 75 26 73 47 L76 92 C66 96 34 96 24 92 Z" fill="${osc(c, .1)}"/>`,
    largo: c => `<path d="M30 46 C29 28 39 21 50 21 C61 21 71 28 70 46 C66 37 58 32 47 31 C41 36 35 39 30 46 Z" fill="${c}"/>`,
    moño: c => `<circle cx="50" cy="17.5" r="9" fill="${c}"/><path d="M30.5 44 C29.5 28 39 21 50 21 C61 21 70.5 28 69.5 44 C66 35 59 30.5 50 30.5 C41 30.5 34 35 30.5 44 Z" fill="${c}"/>`,
    rulos: c => [[33, 33], [39, 25], [48, 21], [57, 22], [65, 28], [69, 37], [31, 41], [70, 45]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${c}"/>`).join(""),
    rapado: c => `<path d="M31 40 C32 26 41 21.5 50 21.5 C59 21.5 68 26 69 40 C61 33 39 33 31 40 Z" fill="${c}" opacity=".55"/>`,
    calvo: () => "",
  };
  const B = { piel: PIELES[2], pelo: "corto", colPelo: COL_PELO[0], lentes: "no", barba: "no", ropa: ROPA[0], animo: "feliz", fondo: "indigo" };
  function persona(o) {
    o = alDia(o);
    const p = o.piel, s = osc(p, .14), c = o.colPelo;
    const atras = o.pelo === "largo" ? PELOS.largoAtras(c) : "";
    const pelo = (PELOS[o.pelo] || PELOS.corto)(c);
    const cuerpo = `<rect x="43" y="56" width="14" height="20" rx="6" fill="${s}"/>
      <path d="M13 106 C13 84 29 73 50 73 C71 73 87 84 87 106 Z" fill="${o.ropa}"/>
      <path d="M41 73.5 Q50 84 59 73.5 Q50 77 41 73.5 Z" fill="${s}"/>`;
    const cabeza = `<ellipse cx="31" cy="47" rx="4.2" ry="5.2" fill="${p}"/><ellipse cx="69" cy="47" rx="4.2" ry="5.2" fill="${p}"/>
      <ellipse cx="50" cy="45" rx="19.5" ry="21.5" fill="${p}"/><path d="M49 49.5 Q50.6 53 52 51" stroke="${s}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    const cara = (o.animo === "feliz"
      ? `<path d="M39.6 46.5 Q42.6 43 45.6 46.5 M54.4 46.5 Q57.4 43 60.4 46.5" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + sonrisa(50, 56, 5.6)
      : ojos(42.6, 57.4, 46, 2.3) + `<path d="M46 56.5 Q50 59 54 56.5" stroke="${T}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`) + mejillas(38, 62, 53);
    const lentes = o.lentes === "redondos" ? `<g fill="rgba(255,255,255,.18)" stroke="${T}" stroke-width="2"><circle cx="42.6" cy="46" r="6.2"/><circle cx="57.4" cy="46" r="6.2"/></g><path d="M48.8 45.5 Q50 44.5 51.2 45.5" stroke="${T}" stroke-width="2" fill="none"/>`
      : o.lentes === "cuadrados" ? `<g fill="rgba(255,255,255,.18)" stroke="${T}" stroke-width="2.2"><rect x="35.8" y="41" width="13" height="10" rx="3"/><rect x="51.2" y="41" width="13" height="10" rx="3"/></g>`
      : o.lentes === "sol" ? `<rect x="34.5" y="41" width="31" height="10.5" rx="5" fill="${T}"/><path d="M39 44.5 h6" stroke="${AMBAR}" stroke-width="2" stroke-linecap="round"/>` : "";
    const barba = o.barba === "si" ? `<path d="M31 50 C33 66 43 70 50 70 C57 70 67 66 69 50 C65 58 58 61 50 61 C42 61 35 58 31 50 Z" fill="${c}"/>` + sonrisa(50, 56.5, 4.6, "#fff", 2)
      : o.barba === "bigote" ? `<path d="M43 54.5 C46 52 48.5 52.5 50 54 C51.5 52.5 54 52 57 54.5 C54 56.5 51.5 56 50 55 C48.5 56 46 56.5 43 54.5 Z" fill="${c}"/>` : "";
    return marco(atras + cuerpo + cabeza + cara + barba + pelo + lentes, F[o.fondo] || F.indigo);
  }

  /* ---------------- La manada: los amigos de tu elefante (se ganan con un logro) ---------------- */
  const MANADA = [
    { id: "lupe", n: "Zorra", frase: "Antes de decidir, miro de cerca.", gana: "Haz tu primera revisión trimestral", svg: () => marco(`
      <path d="M22 44 L30 16 L44 34 Z M78 44 L70 16 L56 34 Z" fill="#E0762F"/><path d="M27 38 L31 23 L39 33 Z M73 38 L69 23 L61 33 Z" fill="${T}" opacity=".55"/>
      <path d="M50 80 C34 80 21 66 21 49 C21 37 32 30 50 30 C68 30 79 37 79 49 C79 66 66 80 50 80 Z" fill="#E8833A"/>
      <path d="M50 80 C40 80 29 71 26 57 C35 61 44 62 50 70 C56 62 65 61 74 57 C71 71 60 80 50 80 Z" fill="#FFF4E8"/>
      ${ojos(40, 60, 51, 2.8)}<ellipse cx="50" cy="71" rx="4.4" ry="3.4" fill="${T}"/>
      <circle cx="60" cy="51" r="8.5" fill="none" stroke="${INDIGO}" stroke-width="2.4"/><path d="M66 57 L72 63" stroke="${INDIGO}" stroke-width="3" stroke-linecap="round"/>`, F.cielo) },
    { id: "architect", n: "Castor", frase: "Si no se puede dibujar, no se puede construir.", gana: "Planifica y cierra 4 semanas seguidas", svg: () => marco(`
      <circle cx="29" cy="36" r="7" fill="#7A4E33"/><circle cx="71" cy="36" r="7" fill="#7A4E33"/>
      <ellipse cx="50" cy="54" rx="27" ry="26" fill="#8A5A3B"/><ellipse cx="50" cy="65" rx="15" ry="11" fill="#D9B48C"/>
      ${ojos(39, 61, 50, 2.7)}<ellipse cx="50" cy="59.5" rx="4.6" ry="3.2" fill="${T}"/>
      <rect x="45" y="66" width="4.6" height="7" rx="1.2" fill="#fff"/><rect x="50.4" y="66" width="4.6" height="7" rx="1.2" fill="#fff"/>
      <path d="M27 35 C28 20 38 14 50 14 C62 14 72 20 73 35 Z" fill="${AMBAR}"/><rect x="22" y="33" width="56" height="6" rx="3" fill="#E39A22"/><rect x="47" y="15" width="6" height="18" rx="3" fill="#FFC970"/>`, F.ambar) },
    { id: "celda", n: "Hormiga", frase: "Si no cuadra, no avanza.", gana: "Cierra un mes (o desbloquea Comparar meses)", svg: () => marco(`
      <path d="M40 32 C36 22 30 18 25 18 M60 32 C64 22 70 18 75 18" stroke="#5A2A22" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="25" cy="18" r="4" fill="#5A2A22"/><circle cx="75" cy="18" r="4" fill="#5A2A22"/>
      <ellipse cx="50" cy="96" rx="30" ry="18" fill="#7E342A"/>
      <circle cx="50" cy="54" r="25" fill="#9C4334"/><path d="M33 40 C38 33 45 30 52 30" stroke="#C46350" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="40.5" cy="52" rx="5.4" ry="6.2" fill="#fff"/><ellipse cx="59.5" cy="52" rx="5.4" ry="6.2" fill="#fff"/>${ojos(41.5, 60.5, 53, 3)}
      ${sonrisa(50, 64, 6, T, 2.4)}${mejillas(35, 65, 61, "#FFB3A8")}`, F.salvia) },
    { id: "engine", n: "Abeja", frase: "Lo que se repite, se automatiza.", gana: "Crea 5 tareas recurrentes", svg: () => marco(`
      <ellipse cx="33" cy="34" rx="13" ry="10" fill="#fff" opacity=".85" transform="rotate(-25 33 34)"/><ellipse cx="67" cy="34" rx="13" ry="10" fill="#fff" opacity=".85" transform="rotate(25 67 34)"/>
      <path d="M42 30 C40 22 36 18 32 17 M58 30 C60 22 64 18 68 17" stroke="${T}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="58" r="27" fill="${AMBAR}"/>
      <path d="M24 66 C34 72 66 72 76 66 L74 74 C64 80 36 80 26 74 Z M30 80 C40 86 60 86 70 80 L64 88 C56 92 44 92 36 88 Z" fill="${T}"/>
      ${ojos(41, 59, 52, 2.8)}${sonrisa(50, 60, 5)}${mejillas(36, 64, 58, "#E2504A")}`, F.cielo) },
    { id: "grilla", n: "Camaleón", frase: "Si hay que explicarlo, está mal diseñado.", gana: "Cambia de tema por primera vez", svg: () => marco(`
      <path d="M58 92 C78 92 84 74 74 66 C68 61 60 66 62 72 C63 76 68 75 68 72" stroke="#3E9A6A" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M18 56 C18 36 34 24 52 24 C70 24 82 36 82 52 C82 68 68 80 50 80 C32 80 18 72 18 56 Z" fill="#4FB07F"/>
      <path d="M30 34 C40 28 56 26 68 31 L66 38 C56 34 42 35 33 40 Z" fill="${AMBAR}"/><path d="M26 44 C38 38 58 36 76 42 L75 48 C58 43 40 44 28 50 Z" fill="${INDIGO_CL}"/>
      <circle cx="62" cy="54" r="11" fill="#E9F7EF"/><circle cx="62" cy="54" r="6" fill="${T}"/><circle cx="64" cy="51.5" r="2" fill="#fff"/>
      <path d="M24 64 Q34 72 46 66" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`, F.rosa) },
    { id: "bucle", n: "Tortuga", frase: "Paso chico, entrega segura.", gana: "Completa 100 tareas", svg: () => marco(`
      <circle cx="50" cy="38" r="17" fill="#7CC08E"/>${ojos(43.5, 56.5, 37, 2.5)}${sonrisa(50, 44, 4.4)}${mejillas(39, 61, 43)}
      <path d="M12 92 C12 66 28 52 50 52 C72 52 88 66 88 92 Z" fill="#5E9C63"/>
      <path d="M50 56 L62 63 L62 77 L50 84 L38 77 L38 63 Z" fill="#7CBE78"/><path d="M26 70 L36 64 L36 78 L28 84 Z M74 70 L64 64 L64 78 L72 84 Z" fill="#7CBE78"/>
      <path d="M10 92 H90" stroke="#4A7F4F" stroke-width="5" stroke-linecap="round"/>`, F.cielo) },
    { id: "tamandua", n: "Tamandúa", frase: "Si se puede romper, lo rompo yo antes.", gana: "Logra una semana en Bandeja Cero", svg: () => marco(`
      <path d="M10 106 C10 84 26 72 46 72 C66 72 84 84 84 106 Z" fill="${T}"/><path d="M30 80 L46 74 L62 80 L58 106 H34 Z" fill="#E9D6B4"/>
      <circle cx="30" cy="34" r="6" fill="#D7BF97"/>
      <path d="M26 52 C26 38 36 30 48 30 C58 30 64 36 70 42 L92 54 C95 56 94 60 90 60 L66 62 C60 70 52 74 44 74 C34 74 26 66 26 52 Z" fill="#E9D6B4"/>
      <ellipse cx="91" cy="57" rx="3.4" ry="3" fill="${T}"/>${ojos(46, 46, 46, 2.7)}<path d="M38 60 Q44 64 50 61" stroke="${T}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`, F.ambar) },
    { id: "faro", n: "Llama", frase: "No termina cuando se publica. Termina cuando se usa.", gana: "Llega a 30 días cerrados seguidos", svg: () => marco(`
      <path d="M50 4 C56 12 58 18 54 24 C60 22 62 16 61 12 C68 18 68 28 62 32 C58 35 42 35 38 32 C33 27 34 19 40 15 C40 20 43 23 46 24 C42 18 45 10 50 4 Z" fill="${AMBAR}"/>
      <path d="M32 38 L28 18 L40 30 Z M68 38 L72 18 L60 30 Z" fill="#E9DDC8"/>
      <path d="M36 70 L36 106 H64 L64 70 Z" fill="#E9DDC8"/>
      <ellipse cx="50" cy="52" rx="20" ry="22" fill="#F4EBDD"/><ellipse cx="50" cy="64" rx="11" ry="8.5" fill="#E3D3BA"/>
      ${ojos(42, 58, 49, 2.6)}<path d="M47 63 Q50 66 53 63 M50 63 V60" stroke="${T}" stroke-width="2" fill="none" stroke-linecap="round"/>${mejillas(37, 63, 58)}`, F.noche) },
    { id: "pepa", n: "Ardilla", frase: "Lo que sirve dos veces se guarda.", gana: "Cumple todos tus objetivos de un mes", svg: () => marco(`
      <path d="M66 96 C92 92 96 58 80 42 C70 32 58 40 64 50 C70 60 82 66 74 80 C70 86 66 90 66 96 Z" fill="#C97535"/>
      <path d="M34 34 L30 20 L42 28 Z M62 30 L66 18 L70 32 Z" fill="#B9662C"/>
      <ellipse cx="48" cy="52" rx="21" ry="21" fill="#D98845"/><ellipse cx="48" cy="61" rx="12" ry="9" fill="#F6E1C6"/>
      ${ojos(40.5, 55.5, 49, 2.6)}<ellipse cx="48" cy="57" rx="2.8" ry="2.2" fill="${T}"/><path d="M45 62 Q48 64 51 62" stroke="${T}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M44 74 C40 74 38 80 40 86 C42 92 54 92 56 86 C58 80 56 74 52 74 Z" fill="#9C6A3C"/><path d="M40 76 C43 70 53 70 56 76 Z" fill="#6E4524"/><rect x="47" y="66" width="2.4" height="6" fill="#6E4524"/>`, F.salvia) },
    { id: "atlas", n: "Cóndor", frase: "Desde aquí arriba se ve todo.", gratis: true, svg: () => marco(`
      <path d="M2 106 C4 78 24 66 50 66 C76 66 96 78 98 106 Z" fill="${T}"/><path d="M14 92 C26 84 38 82 50 84 C38 88 26 94 18 104 Z M86 92 C74 84 62 82 50 84 C62 88 74 94 82 104 Z" fill="#3A4060"/>
      <path d="M28 70 C34 62 42 60 50 60 C58 60 66 62 72 70 C64 74 58 76 50 76 C42 76 36 74 28 70 Z" fill="#F7F7FA"/>
      <path d="M50 18 C64 18 70 30 69 44 C68 56 60 64 50 64 C40 64 32 56 31 44 C30 30 36 18 50 18 Z" fill="#8F6F6B"/>
      <path d="M44 22 C44 14 56 14 56 22 C56 27 44 27 44 22 Z" fill="#6E4A47"/>
      ${ojos(41.5, 58.5, 38, 2.6)}
      <path d="M43 44 C45 40 55 40 57 44 L54 58 C53 62 50 64 47 61 C46 60 46 58 47 57 C49 57 50 55 49 53 Z" fill="#EADBB8"/><path d="M47 57 C46 60 49 62 51 60" stroke="#B69A6B" stroke-width="1.6" fill="none"/>`, F.cielo) },
    { id: "plotty", n: "Pudú", frase: "Chiquito, pero siempre llego.", gratis: true, svg: () => marco(`
      <path d="M40 26 L36 12 M36 18 L31 14 M60 26 L64 12 M64 18 L69 14" stroke="#7A5238" stroke-width="3.4" stroke-linecap="round"/>
      <ellipse cx="24" cy="44" rx="12" ry="7" fill="#9C6B48" transform="rotate(-20 24 44)"/><ellipse cx="76" cy="44" rx="12" ry="7" fill="#9C6B48" transform="rotate(20 76 44)"/>
      <ellipse cx="24.5" cy="44" rx="7" ry="3.6" fill="#E7B9A6" transform="rotate(-20 24.5 44)"/><ellipse cx="75.5" cy="44" rx="7" ry="3.6" fill="#E7B9A6" transform="rotate(20 75.5 44)"/>
      <path d="M50 84 C36 84 28 72 28 56 C28 40 38 30 50 30 C62 30 72 40 72 56 C72 72 64 84 50 84 Z" fill="#A6744F"/><ellipse cx="50" cy="72" rx="11" ry="9" fill="#E9CFB2"/>
      <ellipse cx="41" cy="54" rx="4" ry="4.8" fill="${T}"/><ellipse cx="59" cy="54" rx="4" ry="4.8" fill="${T}"/><circle cx="42.4" cy="52.4" r="1.5" fill="#fff"/><circle cx="60.4" cy="52.4" r="1.5" fill="#fff"/>
      <ellipse cx="50" cy="69" rx="4.2" ry="3.2" fill="${T}"/>${mejillas(36, 64, 63)}`, F.ambar) },
  ];

  /* ---------------- Los de Rumbo: símbolos ---------------- */
  const SIMBOLOS = [
    { id: "brujula", n: "Brújula", d: "El símbolo de Rumbo. Siempre apunta a tu foco.", gratis: true, svg: () => marco(`
      <circle cx="50" cy="50" r="31" fill="#EEF0F8"/><circle cx="50" cy="50" r="25" fill="none" stroke="#C9CEE6" stroke-width="1.6"/>
      <path d="M50 22 V28 M50 72 V78 M22 50 H28 M72 50 H78" stroke="${INDIGO}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M50 26 L57.5 50 L42.5 50 Z" fill="${AMBAR}"/><path d="M50 74 L57.5 50 L42.5 50 Z" fill="${INDIGO_CL}"/><circle cx="50" cy="50" r="4" fill="${T}"/>`, F.noche) },
    /* La cara real de tu elefante la pone avatarElefante(); esta es la de reserva */
    { id: "elefante", n: "Tu elefante", d: "La cara de tu elefante, con su tipo, su etapa y su ropa.", gratis: true, svg: () => marco(`
      <ellipse cx="24" cy="50" rx="17" ry="21" fill="#8E9BB8"/><ellipse cx="76" cy="50" rx="17" ry="21" fill="#8E9BB8"/><ellipse cx="25" cy="51" rx="10" ry="13" fill="#E9B8C4"/><ellipse cx="75" cy="51" rx="10" ry="13" fill="#E9B8C4"/>
      <ellipse cx="50" cy="48" rx="23" ry="24" fill="#A7B3CC"/><path d="M44 62 C44 76 46 86 54 92 C58 95 62 92 59 88 C54 82 56 72 56 62 Z" fill="#A7B3CC"/>
      ${ojos(41, 59, 47, 2.6)}${mejillas(36, 64, 56)}`, F.indigo) },
    { id: "buho", n: "Búho", d: "Para quien cierra el día tarde.", c: 150, svg: () => marco(`
      <path d="M78 14 A10 10 0 1 0 86 28 A8 8 0 1 1 78 14 Z" fill="${AMBAR}"/>
      <path d="M26 40 L30 22 L42 32 Z M74 40 L70 22 L58 32 Z" fill="${INDIGO}"/>
      <path d="M20 106 C18 80 22 34 50 32 C78 34 82 80 80 106 Z" fill="${INDIGO}"/><ellipse cx="50" cy="80" rx="18" ry="22" fill="#C7CEFF"/>
      <circle cx="39" cy="50" r="11" fill="#EEF0F8"/><circle cx="61" cy="50" r="11" fill="#EEF0F8"/><circle cx="39" cy="50" r="6.5" fill="${AMBAR}"/><circle cx="61" cy="50" r="6.5" fill="${AMBAR}"/>
      <circle cx="39" cy="50" r="3.4" fill="${T}"/><circle cx="61" cy="50" r="3.4" fill="${T}"/><path d="M50 58 L46 63 H54 Z" fill="${AMBAR}"/>`, F.noche) },
    { id: "sol", n: "Madrugador", d: "Un sol que abre el día antes que nadie.", c: 150, svg: () => marco(`
      <g stroke="${AMBAR}" stroke-width="5" stroke-linecap="round"><path d="M50 9 V19 M50 81 V91 M9 50 H19 M81 50 H91 M21 21 L28 28 M72 72 L79 79 M79 21 L72 28 M28 72 L21 79"/></g>
      <circle cx="50" cy="50" r="24" fill="${AMBAR}"/><path d="M41 49 Q44 45.5 47 49 M53 49 Q56 45.5 59 49" stroke="${T}" stroke-width="2.4" fill="none" stroke-linecap="round"/>${sonrisa(50, 56, 6)}${mejillas(37, 63, 55, "#E2504A")}`, F.cielo) },
    { id: "brote", n: "Brote", d: "Algo que crece un poco cada día.", gratis: true, svg: () => marco(`
      <path d="M50 66 V40" stroke="#3F8A5A" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M50 46 C36 46 28 36 30 26 C42 26 50 34 50 46 Z" fill="#5BAA74"/><path d="M50 40 C62 40 72 30 70 18 C58 18 50 28 50 40 Z" fill="#7CC08E"/>
      <path d="M28 66 H72 L66 94 H34 Z" fill="#C96F4A"/><rect x="25" y="62" width="50" height="10" rx="4" fill="#DC8560"/>`, F.salvia) },
    { id: "taza", n: "Cafecito", d: "Para las mañanas de primer bocado.", c: 200, svg: () => marco(`
      <path d="M38 30 C34 24 42 20 38 14 M50 30 C46 24 54 20 50 14 M62 30 C58 24 66 20 62 14" stroke="#B89A72" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M72 46 C86 46 86 66 70 68" stroke="#EFE6D6" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M24 36 H74 L70 78 C69 86 63 90 56 90 H42 C35 90 29 86 28 78 Z" fill="#EFE6D6"/><path d="M26 50 H72 L71 58 H27 Z" fill="${INDIGO}"/>
      <path d="M40 68 Q44 64.5 48 68 M52 68 Q56 64.5 60 68" stroke="${T}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`, F.ambar) },
    { id: "cohete", n: "Cohete", d: "Para las semanas en que todo avanza.", c: 300, svg: () => marco(`
      <circle cx="20" cy="24" r="1.6" fill="#fff"/><circle cx="80" cy="18" r="1.2" fill="#fff"/><circle cx="82" cy="60" r="1.4" fill="#fff"/><circle cx="16" cy="62" r="1.2" fill="#fff"/>
      <path d="M43 76 C44 88 50 96 50 96 C50 96 56 88 57 76 Z" fill="${AMBAR}"/>
      <path d="M36 62 L24 76 L38 74 Z M64 62 L76 76 L62 74 Z" fill="${AMBAR}"/>
      <path d="M50 12 C66 24 68 52 62 76 H38 C32 52 34 24 50 12 Z" fill="#EEF0F8"/><path d="M50 12 C58 18 62 26 64 34 H36 C38 26 42 18 50 12 Z" fill="${AMBAR}"/>
      <circle cx="50" cy="50" r="8" fill="${INDIGO_CL}"/><circle cx="50" cy="50" r="4.5" fill="${INDIGO}"/>`, F.noche) },
    { id: "montana", n: "Cumbre", d: "Para quien ya llegó lejos. Se gana en rango Maestro.", gana: "Llega al rango Maestro (4.000 XP)", svg: () => marco(`
      <circle cx="76" cy="26" r="8" fill="${AMBAR}"/>
      <path d="M-2 96 L34 38 L50 60 L64 44 L102 96 Z" fill="${INDIGO}"/><path d="M34 38 L26 52 L32 50 L36 56 L42 50 Z" fill="#EEF0F8"/><path d="M64 44 L58 54 L64 52 L68 56 Z" fill="#EEF0F8"/>
      <path d="M34 38 V20" stroke="${T}" stroke-width="2.2"/><path d="M34 20 L46 24 L34 28 Z" fill="${AMBAR}"/>
      <path d="M-2 96 L20 72 L36 88 L52 70 L80 96 Z" fill="#2B378F"/>`, F.cielo) },
  ];
  return { T, F, osc, marco, persona, alDia, PIELES, COL_PELO, ROPA, FONDOS, PELOS, MANADA, SIMBOLOS };
})();

/* -------- Catálogo: cómo se consigue cada avatar -------- */
const AVATAR_METAS = {
  lupe:      { gana: "Haz tu primera revisión trimestral", metrica: s => typeof g_trimestresCerrados === "function" ? g_trimestresCerrados(s) : 0, meta: 1 },
  architect: { gana: "Planifica y cierra 4 semanas seguidas", metrica: s => typeof g_semanasSeguidas === "function" && g_semanasSeguidas(s, 4) ? 1 : 0, meta: 1 },
  celda:     { gana: "Cierra un mes (o desbloquea Comparar meses)", metrica: s => (Object.values((s.ritual && s.ritual.meses) || {}).some(m => m && m.cierre) || ((s.gamif.owned || []).includes("fun-comparar"))) ? 1 : 0, meta: 1 },
  engine:    { gana: "Crea 5 tareas recurrentes", metrica: s => typeof recurrentes === "function" ? recurrentes(s).filter(r => r && !r.borrada).length : 0, meta: 5 },
  grilla:    { gana: "Cambia de tema por primera vez", metrica: s => s.settings && s.settings.theme && !["navy", "ruta", "auto", "norte", "norte-noche"].includes(s.settings.theme) ? 1 : 0, meta: 1 },
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
    ...A.MANADA.map(e => Object.assign({ grupo: "manada" }, e)),
    ...A.SIMBOLOS.map(e => Object.assign({ grupo: "rumbo" }, e)),
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
const AV_PROPIO_BASE = { piel: "#D59A70", pelo: "corto", colPelo: "#231B18", lentes: "no", barba: "no", ropa: "#3949C9", animo: "feliz", fondo: "indigo" };
/* Lo que armaste, con los colores de antes ya pasados a la paleta nueva */
function avPropio(S) { return AVATAR_ARTE.alDia(Object.assign({}, AV_PROPIO_BASE, avEstado(S).propio || {})); }

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
/* La cara de tu elefante dentro del círculo (tipo, etapa y ropa reales) */
function avatarElefante() {
  if (typeof elefanteCaraSVG !== "function") return AVATAR_ARTE.SIMBOLOS.find(e => e.id === "elefante").svg();
  return AVATAR_ARTE.marco(elefanteCaraSVG().replace(/^<svg /, '<svg x="2" y="6" width="96" height="96" '), AVATAR_ARTE.F.indigo);
}
function avatarSVG(id, S) {
  S = S || STATE;
  const a = avEstado(S);
  id = id || a.id;
  if (id === "propio") return AVATAR_ARTE.persona(avPropio(S));
  if (id === "elefante") return avatarElefante();
  const d = avatarDef(id); if (!d) return null;
  return d.svg();
}
/* Lo que va dentro del círculo del menú e Inicio: el avatar elegido, o la inicial como antes */
function avatarActualHtml(inicial) {
  const a = avEstado();
  if (!a.id || !avatarTiene(a.id)) return escapeHtml(inicial);
  return `<span class="av-dibujo">${avatarSVG(a.id)}</span>`;
}

/* -------- Acciones -------- */
let AV_TAB = "manada", AV_PRUEBA = null;
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
  a.propio = Object.assign(avPropio(), { [k]: v });
  a.id = "propio";
  saveState(); renderAccountBox(); openAvatar("propio");
}
function probarAvatar(id) { AV_PRUEBA = AV_PRUEBA === id ? null : id; openAvatar(AV_TAB); }

/* -------- Selector (Cuenta → Tu avatar, o tocando tu avatar) -------- */
const AV_FONDOS = { indigo: "Índigo suave", ambar: "Ámbar", salvia: "Salvia", rosa: "Rosa", cielo: "Cielo", crema: "Crema", noche: "Noche" };
function openAvatar(tab) {
  if (tab === "elenco") tab = "manada";   // el nombre de antes
  AV_TAB = ["manada", "propio", "rumbo"].includes(tab) ? tab : AV_TAB || "manada";
  const a = avEstado(), actual = a.id && avatarTiene(a.id) ? a.id : null;
  const vistaId = AV_PRUEBA || actual;
  const inicial = ((STATE.profile && STATE.profile.name) || "R").trim()[0] || "R";
  const vista = vistaId ? avatarSVG(vistaId) : `<div class="account__avatar av-grande">${escapeHtml(inicial.toUpperCase())}</div>`;
  const dv = vistaId ? (vistaId === "propio" ? { n: "Tu avatar" } : avatarDef(vistaId)) : null;
  const tabs = `<div class="seg vest-tabs"><button class="${AV_TAB === "manada" ? "is-active" : ""}" data-action="av-tab" data-v="manada">🐾 La manada</button><button class="${AV_TAB === "propio" ? "is-active" : ""}" data-action="av-tab" data-v="propio">✏️ Arma el tuyo</button><button class="${AV_TAB === "rumbo" ? "is-active" : ""}" data-action="av-tab" data-v="rumbo">🧭 Rumbo</button></div>`;
  let panel;
  if (AV_TAB === "propio") {
    const o = avPropio(), A = AVATAR_ARTE;
    const fila = (lab, k, vals) => `<div class="av-op"><span>${lab}</span><div class="row-wrap" style="gap:6px">${vals.map(([v, t]) => `<button type="button" class="chip ${o[k] === v ? "chip--cian" : ""}" data-action="av-propio" data-k="${k}" data-v="${v}" aria-pressed="${o[k] === v}">${t}</button>`).join("")}</div></div>`;
    const colores = (lab, k, vals) => `<div class="av-op"><span>${lab}</span><div class="row-wrap" style="gap:8px">${vals.map(v => `<button type="button" class="av-color ${o[k] === v ? "is-on" : ""}" data-action="av-propio" data-k="${k}" data-v="${v}" style="background:${v}" aria-label="Color" aria-pressed="${o[k] === v}"></button>`).join("")}</div></div>`;
    panel = colores("Piel", "piel", A.PIELES) +
      fila("Peinado", "pelo", [["corto", "Corto"], ["largo", "Largo"], ["moño", "Moño"], ["rulos", "Rulos"], ["rapado", "Rapado"], ["calvo", "Sin pelo"]]) +
      colores("Color de pelo", "colPelo", A.COL_PELO) +
      fila("Lentes", "lentes", [["no", "Sin lentes"], ["redondos", "Redondos"], ["cuadrados", "Cuadrados"], ["sol", "De sol"]]) +
      fila("Barba", "barba", [["no", "Sin barba"], ["si", "Barba"], ["bigote", "Bigote"]]) +
      colores("Ropa", "ropa", A.ROPA) +
      fila("Expresión", "animo", [["feliz", "Feliz"], ["normal", "Tranquila"]]) +
      `<div class="av-op"><span>Fondo</span><div class="row-wrap" style="gap:8px">${A.FONDOS.map(f => `<button type="button" class="av-color ${o.fondo === f ? "is-on" : ""}" data-action="av-propio" data-k="fondo" data-v="${f}" style="background:${A.F[f]}" aria-label="Fondo ${AV_FONDOS[f]}" title="${AV_FONDOS[f]}" aria-pressed="${o.fondo === f}"></button>`).join("")}</div></div>` +
      `<p class="text-xs muted">Cada cambio se guarda al tiro y queda como tu avatar.</p>`;
  } else {
    const lista = avataresCatalogo().filter(d => d.grupo === AV_TAB);
    panel = `<div class="av-grid">${lista.map(d => {
      const tiene = avatarTiene(d.id), on = actual === d.id, prueba = AV_PRUEBA === d.id;
      const pr = !tiene && AVATAR_METAS[d.id] ? avatarProgreso(d.id) : null;
      const estado = on ? `<span class="vest-tag is-on">✓ Tu avatar</span>` : tiene ? `<span class="vest-tag is-tuya">Tuyo</span>`
        : AVATAR_PRECIOS[d.id] ? `<span class="vest-tag">${AVATAR_PRECIOS[d.id]} ⭐</span>` : `<span class="vest-tag is-gana">🔒 Se gana</span>`;
      return `<button type="button" class="av-ficha ${on ? "is-on" : ""} ${prueba ? "is-prueba" : ""} ${tiene ? "" : "is-no"}" data-action="${tiene ? "av-elegir" : "av-probar"}" data-id="${d.id}" aria-pressed="${on}">
        <span class="av-ficha__img">${avatarSVG(d.id)}</span><span class="av-ficha__n">${escapeHtml(d.n)}</span>${estado}
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
      <div><div class="card__title" style="font-size:15px">🎭 Tu avatar</div><div class="text-sm muted mt-8">${d ? escapeHtml(d.n) : "Hoy usas tu inicial."} Elige uno de la manada, arma el tuyo o usa un símbolo de Rumbo.</div></div></div>
    <button class="btn btn--linea" data-action="av-abrir">Elegir avatar</button></div></div>`;
}
