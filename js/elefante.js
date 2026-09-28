/* ============================================================
   RUMBO · 🐘 Tu elefante (vectorial, por capas)
   Seis tipos sobre el mismo esqueleto: Clásico y Asiático se eligen al empezar;
   Mamut, Peluche, Geométrico y Tinta se ganan con constancia. Cada tipo cambia sus
   rasgos en cada etapa (Cría → Joven → Adulto → Sabio, según la XP, que nunca baja).
   La ropa se engancha a 6 espacios fijos (cabeza, ojos, cuello, espalda, trompa, pies),
   así cualquier prenda le queda a cualquier tipo y etapa.

   Datos: gamif.equipped.ele = { tipo, ropa: { espacio: prenda }, ts } (gana el ts mayor
   entre dispositivos). Compras: "compra:<id>" en el ledger (los accesorios de antes
   conservan su id). Tipos ganados: "hito:elefante:<tipo>" en el ledger.
   ============================================================ */

const ETAPAS_ELEFANTE = [ { n:"Cría", s:.62, cab:1.22, i:0 }, { n:"Joven", s:.8, cab:1.1, i:1 }, { n:"Adulto", s:1, cab:1, i:2 }, { n:"Sabio", s:1.04, cab:1, i:3, sabio:true } ];

/* ---------- Piezas comunes ---------- */
const eleOjo = (a, c, i) => `<g class="ele-ojo">${eleOjoTrazo(a, c, i)}</g>`;
const eleOjoTrazo = (a, c, i) => { const r = i === 0 ? 8.6 : i === 1 ? 7.6 : 7;
  return a === "feliz" ? `<path d="M191 90 Q199 81 207 90" stroke="${c}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`
  : a === "sueno" ? `<path d="M191 89 Q199 95 207 89" stroke="${c}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`
  : `<circle cx="199" cy="88" r="${r}" fill="${c}"/><circle cx="${199 + r * .36}" cy="${88 - r * .36}" r="${r * .34}" fill="#fff"/>`; };
const eleTrompa = (c, w) => `<path d="M212 112 C229 132 233 160 223 179 C217 191 228 200 238 190" stroke="${c}" stroke-width="${w||20}" fill="none" stroke-linecap="round"/>`;
const ELE_CUERPO = `M50 150 C50 104 92 92 126 95 C166 98 186 120 183 156 C181 186 150 196 115 196 C74 196 50 186 50 150 Z`;
/* Pelusa de cría (3 pelos) y de joven (1 pelo) */
const elePelusa = (c, i) => i === 0 ? `<path d="M178 53 q-3 -10 2 -15 M185 51 q0 -11 5 -14 M191 53 q3 -9 8 -10" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
  : i === 1 ? `<path d="M185 51 q0 -9 5 -12" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : "";
const eleCejas = (c) => `<path d="M189 76 Q199 70 209 76" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
const eleArrugas = (c) => `<path d="M170 66 q8 -4 16 0 M172 73 q7 -3 13 0" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`;
const eleColmillo = (i, fill, extra) => [ "",
  `<path d="M205 124 C208 129 213 131 217 129 C212 127 209 124 207 119 Z" fill="${fill}" ${extra||""}/>`,
  `<path d="M204 124 C209 133 218 136 224 133 C217 129 210 124 207 118 Z" fill="${fill}" ${extra||""}/>`,
  `<path d="M203 124 C208 140 224 146 236 140 C222 136 212 128 207 116 Z" fill="${fill}" ${extra||""}/>` ][i];

/* ---------- Tipos ---------- */
const TIPOS_ELEFANTE = {
  clasico: {
    n:"Clásico", tag:"redondo y amable",
    d:"Formas redondas, volumen suave y colores del tema. Se lee bien en tamaño chico y es el más fácil de animar.",
    pros:["Se ve bien en cualquier tamaño","Combina con todos los temas"],
    rasgos:["Cabeza grande, ojos grandes y pelusa","Asoman los colmillos","Colmillos completos y arrugas en la trompa","Colmillos largos, cejas blancas y frente con arrugas"],
    dibujo(o, e){ const k={b:"#9FB2C8",s:"#7C91AB",l:"#C3D1E0",o:"#E8B4BF"}, i=e.i; return {
      cola:`<path d="M54 142 C40 148 34 162 38 172" stroke="${k.b}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="38" cy="174" r="4.5" fill="${k.s}"/>`,
      fondo:`<rect x="80" y="166" width="26" height="50" rx="12" fill="${k.s}"/><rect x="138" y="166" width="26" height="50" rx="12" fill="${k.s}"/>`,
      cuerpo:`<path d="${ELE_CUERPO}" fill="${k.b}"/><path d="M70 118 C92 102 130 100 152 108" stroke="${k.l}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/><path d="M62 184 C88 194 140 196 172 180" stroke="${k.s}" stroke-width="8" fill="none" stroke-linecap="round" opacity=".45"/>`,
      frente:`<rect x="56" y="168" width="30" height="52" rx="14" fill="${k.b}"/><rect x="148" y="168" width="30" height="52" rx="14" fill="${k.b}"/>`,
      oreja:`<path d="M152 58 C116 56 104 96 114 126 C121 150 152 152 164 132 Z" fill="${k.s}"/><path d="M148 70 C126 72 120 100 126 120 C131 136 148 138 156 126 Z" fill="${k.o}" opacity=".85"/>`,
      cabeza:`<circle cx="185" cy="95" r="44" fill="${k.b}"/><path d="M156 70 C166 58 182 54 196 56" stroke="${k.l}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>${eleTrompa(k.b)}${i>=2?`<path d="M219 140 l11 -3 M222 154 l11 -1 M221 167 l10 2" stroke="${k.s}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`:""}`,
      colmillo: eleColmillo(i, "#FFF8EC"),
      cara:`<ellipse cx="211" cy="105" rx="7.5" ry="4.5" fill="#FF8FA3" opacity="${o.animo==="feliz"?.75:.45}"/>${eleOjo(o.animo,"#1B2436",i)}${elePelusa(k.s,i)}${i===3?eleCejas("#F4F4F2")+eleArrugas(k.s):""}`,
    }; }
  },
  asiatico: {
    n:"Asiático", tag:"orejas chicas, frente con dos domos",
    d:"Inspirado en el elefante asiático: cabeza con dos bultos, orejas pequeñas y lomo arqueado. Más sereno y compacto.",
    pros:["Silueta distinta que se reconoce","Las orejas chicas dejan ver más la ropa"],
    rasgos:["Pelusa rojiza por toda la cabeza (como las crías reales)","Pierde la pelusa; aparecen las primeras pecas","Más pecas rosadas en orejas y trompa","Lleno de pecas, cejas blancas y colmillos cortos"],
    dibujo(o, e){ const k={b:"#A9A39C",s:"#86807A",l:"#CBC6C0",o:"#E9B7B3",rojo:"#B5774A"}, i=e.i;
      const pecasPos = [[146,102],[150,110],[144,114],[216,120],[222,126],[212,130],[176,64],[168,70],[196,62],[152,94],[226,140],[220,150]];
      const nPecas = [0,2,6,12][i];
      const pecas = pecasPos.slice(0,nPecas).map(([x,y]) => `<circle cx="${x}" cy="${y}" r="${1.8 + (x%3)*.3}" fill="#F2BDBB" opacity=".9"/>`).join("");
      const pelo = i===0 ? `<path d="M156 62 q-2 -8 3 -12 M164 56 q-1 -9 4 -12 M172 52 q0 -10 5 -12 M186 46 q1 -10 6 -12 M196 47 q2 -9 7 -10 M206 52 q3 -8 8 -8 M214 60 q4 -7 9 -6" stroke="${k.rojo}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M150 84 q-4 -3 -3 -8 M226 88 q4 -2 5 -7" stroke="${k.rojo}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` : i===1 ? `<path d="M186 46 q1 -8 6 -10 M196 47 q2 -7 6 -8" stroke="${k.rojo}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>` : "";
      return {
      cola:`<path d="M54 144 C42 150 38 162 42 172" stroke="${k.b}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="42" cy="174" r="4" fill="${i===0?k.rojo:k.s}"/>`,
      fondo:`<rect x="82" y="166" width="25" height="50" rx="11" fill="${k.s}"/><rect x="140" y="166" width="25" height="50" rx="11" fill="${k.s}"/>`,
      cuerpo:`<path d="M52 154 C48 102 96 82 128 88 C168 96 186 124 183 158 C181 188 150 196 115 196 C74 196 52 188 52 154 Z" fill="${k.b}"/><path d="M76 108 C98 92 132 90 156 100" stroke="${k.l}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>${i===0?`<path d="M80 100 q-2 -7 2 -10 M100 92 q-1 -7 3 -10 M122 89 q0 -7 4 -9 M144 94 q2 -7 6 -8" stroke="${k.rojo}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>`:""}`,
      frente:`<rect x="58" y="170" width="28" height="50" rx="12" fill="${k.b}"/><rect x="148" y="170" width="28" height="50" rx="12" fill="${k.b}"/>`,
      oreja:`<path d="M156 78 C134 78 128 104 134 122 C140 136 156 136 162 122 Z" fill="${k.s}"/><path d="M152 88 C140 90 138 106 142 116 C146 124 154 124 157 116 Z" fill="${k.o}" opacity=".8"/>`,
      cabeza:`<path d="M141 100 C141 62 160 46 176 54 C186 42 212 46 220 66 C232 90 226 126 205 136 C182 146 150 138 141 100 Z" fill="${k.b}"/><path d="M162 60 C168 54 174 54 178 58 M184 54 C192 48 204 50 210 58" stroke="${k.l}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>${eleTrompa(k.b,18)}`,
      colmillo: i===3 ? `<path d="M205 124 C210 134 220 138 228 134 C219 130 212 124 208 118 Z" fill="#FFF8EC"/>` : "",
      cara:`${pecas}<ellipse cx="211" cy="106" rx="7" ry="4" fill="#FF8FA3" opacity="${o.animo==="feliz"?.7:.4}"/>${eleOjo(o.animo,"#2A2320",i)}${pelo}${i===3?eleCejas("#F4F4F2"):""}`,
    }; }
  },
  mamut: {
    n:"Mamut", tag:"lanudo, se gana", gana:true,
    d:"Pelaje café, joroba y colmillos en espiral. Un tipo especial que se desbloquea con constancia: 100 días cerrados.",
    pros:["Premio visible a la constancia","El pelaje le da mucha personalidad"],
    rasgos:["Lana clara y esponjosa, sin colmillos","Colmillos cortos y rectos","Colmillos en espiral y lana oscura","Espirales enormes y canas en la lana"],
    dibujo(o, e){ const i=e.i, k = i===0 ? {b:"#B98A63",s:"#9A6E4B",l:"#D6AE86",pelo:"#8A5C3A"} : {b:"#8B5C3E",s:"#6A432B",l:"#B47C55",pelo:"#5B3822"};
      const flecos = (x0,x1,y,c) => { let s=""; for(let x=x0;x<=x1;x+=9) s+=`<path d="M${x} ${y} q3 9 -1 14" stroke="${c||k.pelo}" stroke-width="3" fill="none" stroke-linecap="round"/>`; return s; };
      const canas = i===3 ? `<path d="M74 118 q6 8 2 16 M104 104 q6 8 2 16 M136 108 q6 8 2 16" stroke="#E6DDD2" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : "";
      const colm = [ "",
        `<path d="M204 124 L230 140 C232 142 230 145 227 144 L203 130 Z" fill="#FFF6E4"/>`,
        `<path d="M204 122 C210 160 250 176 256 146 C258 132 248 124 240 130 C236 134 240 142 246 140 C244 158 220 150 212 118 Z" fill="#FFF6E4" stroke="#E2D2B4" stroke-width="1"/>`,
        `<path d="M202 120 C208 172 262 190 266 144 C268 124 250 114 238 124 C232 130 238 142 248 138 C250 162 222 160 212 116 Z" fill="#FFF6E4" stroke="#E2D2B4" stroke-width="1"/>` ][i];
      return {
      cola:`<path d="M54 142 C40 148 34 164 40 176" stroke="${k.b}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M40 176 l-4 8 M40 176 l3 8" stroke="${k.pelo}" stroke-width="3" stroke-linecap="round"/>`,
      fondo:`<rect x="80" y="166" width="27" height="50" rx="12" fill="${k.s}"/><rect x="138" y="166" width="27" height="50" rx="12" fill="${k.s}"/>`,
      cuerpo:`<path d="M50 150 C48 100 86 80 112 84 C122 70 146 74 152 92 C176 104 186 124 183 156 C181 186 150 196 115 196 C74 196 50 186 50 150 Z" fill="${k.b}"/><path d="M84 96 C98 84 118 80 132 86" stroke="${k.l}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".6"/>${flecos(58,176,182)}<path d="M70 120 q6 8 2 16 M92 110 q6 8 2 16 M118 106 q6 8 2 16 M144 112 q6 8 2 16" stroke="${k.pelo}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>${canas}${i===0?`<path d="M60 150 q-6 -4 -4 -12 M66 128 q-6 -2 -6 -10" stroke="${k.l}" stroke-width="3" fill="none" stroke-linecap="round"/>`:""}`,
      frente:`<rect x="56" y="168" width="31" height="52" rx="13" fill="${k.b}"/><rect x="148" y="168" width="31" height="52" rx="13" fill="${k.b}"/>${flecos(56,84,196)}${flecos(148,176,196)}`,
      oreja:`<path d="M156 72 C138 72 130 96 136 114 C142 128 156 128 162 116 Z" fill="${k.s}"/>`,
      cabeza:`<circle cx="185" cy="95" r="44" fill="${k.b}"/><path d="M160 58 q6 -14 12 -2 q6 -16 12 -2 q6 -16 12 -1 q6 -12 10 2" stroke="${i===3?"#E6DDD2":k.pelo}" stroke-width="${i===0?5.5:4}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${eleTrompa(k.b)}<path d="M219 140 l11 -3 M222 154 l11 -1 M221 167 l10 2" stroke="${k.s}" stroke-width="2.2" stroke-linecap="round"/>`,
      colmillo: colm,
      cara:`${eleOjo(o.animo,"#1E130C",i)}${i===3?eleCejas("#F4EDE4"):""}`,
    }; }
  },
  peluche: {
    n:"Peluche", tag:"de tela, con costuras",
    d:"Como un juguete cosido: costuras punteadas y ojos de botón. Con los años junta parches y remiendos, como un peluche muy querido.",
    pros:["Muy cálido y cercano","Las costuras hacen que la ropa se vea de verdad"],
    rasgos:["Recién hecho: con su etiqueta","Primer parche en el lomo","Dos parches: se nota que lo quieres","Remendado y con un botón distinto: tu compañero de años"],
    dibujo(o, e){ const k={b:"#B8C7DA",s:"#95A8C0",l:"#D7E1EC",o:"#F2C1CB",hilo:"#6E84A2"}, i=e.i;
      const boton = i===3 ? "#E8563A" : "#2A2F3A", agujero = i===3 ? "#FFD2C5" : "#8A93A3";
      const ojo = o.animo==="sueno" ? `<path d="M193 83 l12 10 M205 83 l-12 10" stroke="#2A2F3A" stroke-width="3" stroke-linecap="round"/>`
        : `<circle cx="199" cy="88" r="${i===0?8.6:7.5}" fill="${boton}"/><circle cx="197" cy="86" r="1.2" fill="${agujero}"/><circle cx="201" cy="86" r="1.2" fill="${agujero}"/><circle cx="197" cy="90" r="1.2" fill="${agujero}"/><circle cx="201" cy="90" r="1.2" fill="${agujero}"/>${o.animo==="feliz"?`<path d="M209 78 l3 -3 M213 83 l4 -1" stroke="#F2C24B" stroke-width="2.5" stroke-linecap="round"/>`:""}`;
      const parche1 = `<rect x="92" y="128" width="30" height="26" rx="4" fill="#F2C24B" transform="rotate(-8 107 141)"/><path d="M96 131 l4 4 m0 -4 l-4 4 M114 128 l4 4 m0 -4 l-4 4 M98 148 l4 4 m0 -4 l-4 4 M116 145 l4 4 m0 -4 l-4 4" stroke="#B98A12" stroke-width="1.6"/>`;
      const parche2 = `<circle cx="150" cy="168" r="11" fill="#17C3B2"/><circle cx="150" cy="168" r="8" fill="none" stroke="#0F8F83" stroke-width="1.5" stroke-dasharray="2.5 2.5"/>`;
      const remiendo = `<path d="M164 74 l14 6 M166 70 l-2 8 M171 72 l-2 8 M176 74 l-2 8" stroke="${k.hilo}" stroke-width="1.8" stroke-linecap="round"/>`;
      const etiqueta = `<path d="M60 160 l-12 6 l2 12 l14 -4 Z" fill="#FFFFFF" stroke="${k.hilo}" stroke-width="1"/><path d="M52 169 h8 M53 173 h7" stroke="#E8563A" stroke-width="1.4"/>`;
      return {
      cola:`<path d="M54 142 C40 148 34 162 38 172" stroke="${k.b}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="38" cy="175" r="5" fill="${k.o}"/>`,
      fondo:`<rect x="80" y="166" width="26" height="50" rx="13" fill="${k.s}"/><rect x="138" y="166" width="26" height="50" rx="13" fill="${k.s}"/>`,
      cuerpo:`<path d="${ELE_CUERPO}" fill="${k.b}"/><path d="M58 150 C58 112 94 101 126 103 C160 106 176 124 175 154 C173 180 146 188 115 188 C80 188 58 180 58 150 Z" fill="none" stroke="${k.hilo}" stroke-width="1.6" stroke-dasharray="4 4" opacity=".7"/>${i===0?etiqueta:""}${i>=1?parche1:""}${i>=2?parche2:""}`,
      frente:`<rect x="56" y="168" width="30" height="52" rx="15" fill="${k.b}"/><rect x="148" y="168" width="30" height="52" rx="15" fill="${k.b}"/><ellipse cx="71" cy="214" rx="11" ry="5" fill="${k.o}"/><ellipse cx="163" cy="214" rx="11" ry="5" fill="${k.o}"/>`,
      oreja:`<path d="M152 58 C116 56 104 96 114 126 C121 150 152 152 164 132 Z" fill="${k.s}"/><path d="M148 70 C126 72 120 100 126 120 C131 136 148 138 156 126 Z" fill="${k.o}"/><path d="M146 76 C130 80 126 102 131 118" stroke="${k.hilo}" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>`,
      cabeza:`<circle cx="185" cy="95" r="44" fill="${k.b}"/><path d="M152 80 C158 62 176 55 190 55" stroke="${k.hilo}" stroke-width="1.6" stroke-dasharray="4 4" fill="none" opacity=".7"/>${eleTrompa(k.b,21)}<path d="M216 128 C228 150 226 170 218 180" stroke="${k.hilo}" stroke-width="1.5" stroke-dasharray="3 4" fill="none" opacity=".7"/>${i===3?remiendo:""}`,
      colmillo: i>=2 ? eleColmillo(i, "#FFFFFF", `stroke="${k.hilo}" stroke-width="1" stroke-dasharray="2 2"`) : "",
      cara:`<ellipse cx="211" cy="106" rx="8" ry="5" fill="#FF8FA3" opacity=".6"/><g class="ele-ojo">${ojo}</g>${i===0?`<path d="M182 52 q0 -8 5 -10" stroke="${k.hilo}" stroke-width="2" fill="none" stroke-linecap="round"/>`:""}`,
    }; }
  },
  geometrico: {
    n:"Geométrico", tag:"facetado, estilo papel plegado",
    d:"Hecho de planos, como origami. Moderno y muy de marca: los planos pueden tomar el color del tema que uses.",
    pros:["El más moderno y distintivo","Puede cambiar de color con tu tema"],
    rasgos:["Pocas caras, formas simples","Aparecen los primeros planos","Todos los planos y colmillos","Bordes dorados, como una pieza terminada"],
    dibujo(o, e){ const k={b:"#7FA8CF",s:"#5C86B0",l:"#A9C6E2",d:"#4B7299",o:"#F0A7B6",oro:"#F2C24B"}, i=e.i;
      const ojo = o.animo==="feliz" ? `<path d="M191 91 L199 83 L207 91" stroke="#13243A" stroke-width="3.4" fill="none" stroke-linejoin="miter"/>`
        : o.animo==="sueno" ? `<path d="M191 88 L207 88" stroke="#13243A" stroke-width="3.4"/>` : `<path d="M199 ${i===0?78:80} L${i===0?208:206} 88 L199 ${i===0?98:96} L${i===0?190:192} 88 Z" fill="#13243A"/><path d="M199 82 L202 86 L199 86 Z" fill="#fff"/>`;
      const planosCuerpo = [
        `<path d="M64 108 L100 93 L118 132 Z" fill="${k.l}"/><path d="M50 152 L64 108 L118 132 L68 190 Z" fill="${k.s}" opacity=".6"/>`,
        `<path d="M100 93 L144 96 L118 132 Z" fill="${k.l}" opacity=".7"/><path d="M68 190 L118 132 L112 197 Z" fill="${k.d}" opacity=".6"/><path d="M118 132 L184 160 L160 193 L112 197 Z" fill="${k.s}" opacity=".5"/>`];
      const bordes = `<path d="M64 108 L118 132 L100 93 M118 132 L144 96 M118 132 L68 190 M118 132 L112 197 M118 132 L184 160 M50 152 L64 108 L100 93 L144 96 L178 118 L184 160 L160 193 L112 197 L68 190 Z" stroke="${k.oro}" stroke-width="1.6" fill="none" opacity=".95"/>`;
      return {
      cola:`<path d="M54 142 L40 152 L38 170" stroke="${k.b}" stroke-width="5" fill="none" stroke-linejoin="miter"/><path d="M34 168 L42 168 L38 178 Z" fill="${i===3?k.oro:k.d}"/>`,
      fondo:`<path d="M80 166 H106 V216 H80 Z" fill="${k.s}"/><path d="M138 166 H164 V216 H138 Z" fill="${k.s}"/>`,
      cuerpo:`<path d="M50 152 L64 108 L100 93 L144 96 L178 118 L184 160 L160 193 L112 197 L68 190 Z" fill="${k.b}"/>${i>=1?planosCuerpo[0]:""}${i>=2?planosCuerpo[1]:""}${i===3?bordes:""}`,
      frente:`<path d="M56 170 H86 V220 H56 Z" fill="${k.b}"/><path d="M148 170 H178 V220 H148 Z" fill="${k.b}"/>${i>=1?`<path d="M56 170 L86 170 L71 186 Z" fill="${k.l}" opacity=".6"/><path d="M148 170 L178 170 L163 186 Z" fill="${k.l}" opacity=".6"/>`:""}`,
      oreja:`<path d="M154 56 L112 74 L114 128 L150 150 L166 130 Z" fill="${k.s}"/><path d="M148 70 L122 84 L126 122 L150 136 Z" fill="${k.o}" opacity=".85"/>${i===3?`<path d="M154 56 L112 74 L114 128 L150 150" stroke="${k.oro}" stroke-width="1.6" fill="none"/>`:""}`,
      cabeza:`<path d="M168 52 L206 54 L228 80 L226 118 L204 138 L166 136 L144 112 L146 72 Z" fill="${k.b}"/>${i>=1?`<path d="M168 52 L206 54 L186 88 Z" fill="${k.l}"/>`:""}${i>=2?`<path d="M146 72 L168 52 L186 88 Z" fill="${k.l}" opacity=".7"/><path d="M144 112 L186 88 L166 136 Z" fill="${k.s}" opacity=".5"/>`:""}${i===3?`<path d="M168 52 L186 88 L206 54 M146 72 L186 88 L166 136 M186 88 L226 118" stroke="${k.oro}" stroke-width="1.6" fill="none"/>`:""}<path d="M212 110 L232 132 L234 164 L224 184 L238 190" stroke="${k.b}" stroke-width="19" fill="none" stroke-linejoin="miter" stroke-linecap="square"/>${i>=2?`<path d="M226 140 L236 138 M228 158 L238 158" stroke="${k.d}" stroke-width="2"/>`:""}`,
      colmillo: i===0 ? "" : i===1 ? `<path d="M205 122 L216 130 L207 127 Z" fill="#FFFFFF"/>` : i===2 ? `<path d="M205 122 L222 134 L208 128 Z" fill="#FFFFFF"/>` : `<path d="M204 122 L232 144 L208 130 Z" fill="#FFFFFF" stroke="${k.oro}" stroke-width="1.2"/>`,
      cara:`<path d="M206 102 L216 104 L210 110 Z" fill="${k.o}" opacity=".8"/><g class="ele-ojo">${ojo}</g>`,
    }; }
  },
  tinta: {
    n:"Tinta", tag:"dibujado a mano, como en tu cuaderno", papel:true,
    d:"Trazo de tinta sobre papel, como un dibujo en el margen del cuaderno. Encaja con el tema Cuaderno y con el ritual de escribir tu día.",
    pros:["Muy personal, se siente hecho a mano","La ropa de color resalta sobre el trazo"],
    rasgos:["Solo el contorno, como un boceto","Primeras sombras a lápiz","Sombreado completo","Acuarela de color: un dibujo terminado"],
    dibujo(o, e){ const t="#1F2A3D", f="#FFFDF7", i=e.i, w=i===0?2.2:2.6, a=(d,fill)=>`<path d="${d}" fill="${fill||f}" stroke="${t}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const hatch=(x0,y0,n,min)=>{ if(i<min) return ""; let s="";for(let j=0;j<n;j++)s+=`<path d="M${x0+j*7} ${y0} l-8 12" stroke="${t}" stroke-width="1.3" opacity=".55"/>`;return s;};
      const acuarela = i===3 ? `<path d="M60 150 C60 112 96 102 126 104 C160 106 176 124 174 152 C172 178 146 186 115 186 C82 186 60 178 60 150 Z" fill="#8FCFC8" opacity=".35"/>` : "";
      return {
      cola:`<path d="M54 142 C40 148 34 162 38 172" stroke="${t}" stroke-width="${w}" fill="none" stroke-linecap="round"/><path d="M34 172 l4 6 l4 -6" stroke="${t}" stroke-width="2" fill="none"/>`,
      fondo:a("M82 166 h24 v48 q-12 5 -24 0 Z")+a("M140 166 h24 v48 q-12 5 -24 0 Z")+hatch(88,180,3,1)+hatch(146,180,3,1),
      cuerpo:a("M51 150 C49 104 93 91 127 95 C167 99 187 121 183 157 C180 187 149 197 114 196 C73 195 52 186 51 150 Z")+acuarela+hatch(70,176,10,1)+hatch(64,150,4,2)+(i>=2?`<path d="M96 104 q10 -4 20 -2" stroke="${t}" stroke-width="1.6" fill="none"/>`:""),
      frente:a("M57 168 h28 v50 q-14 5 -28 0 Z")+a("M149 168 h28 v50 q-14 5 -28 0 Z")+(i>=2?`<path d="M62 214 q3 -4 6 0 M72 214 q3 -4 6 0 M154 214 q3 -4 6 0 M164 214 q3 -4 6 0" stroke="${t}" stroke-width="1.6" fill="none"/>`:""),
      oreja:a("M152 58 C116 56 104 96 114 126 C121 150 152 152 164 132 Z", i===3?"#F6D3DA":f)+hatch(124,96,4,2)+hatch(120,114,4,1),
      cabeza:a("M141 95 A44 44 0 1 1 229 95 A44 44 0 1 1 141 95 Z")+`<path d="M212 112 C229 132 233 160 223 179 C217 191 228 200 238 190" stroke="${t}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M212 112 C229 132 233 160 223 179 C217 191 228 200 238 190" stroke="${f}" stroke-width="16.8" fill="none" stroke-linecap="round"/>`+(i>=2?`<path d="M219 142 l9 -3 M222 156 l9 -1 M220 168 l8 2" stroke="${t}" stroke-width="1.6" stroke-linecap="round"/>`:"")+(i===3?`<circle cx="175" cy="112" r="16" fill="#8FCFC8" opacity=".3"/>`:""),
      colmillo: i===0 ? "" : a(["","M205 124 C208 129 213 131 217 129 C212 127 209 124 207 119 Z","M204 124 C209 133 218 136 224 133 C217 129 210 124 207 118 Z","M203 124 C208 140 224 146 236 140 C222 136 212 128 207 116 Z"][i]),
      cara:`<path d="M206 106 l3 -3 M211 107 l3 -3" stroke="#E8563A" stroke-width="1.6" opacity="${o.animo==="feliz"?1:.5}"/>${eleOjo(o.animo,t,i).replace('fill="#fff"',`fill="${f}"`)}${elePelusa(t,i)}${i===3?`<path d="M189 76 Q199 70 209 76" stroke="${t}" stroke-width="1.8" fill="none" stroke-dasharray="3 2"/>`:""}`,
    }; }
  },
};


/* Tipos: los dos del inicio y los cuatro que se ganan (la meta se revisa en cada render) */
Object.assign(TIPOS_ELEFANTE.clasico, { inicio: true });
Object.assign(TIPOS_ELEFANTE.asiatico, { inicio: true });
Object.assign(TIPOS_ELEFANTE.mamut, { meta: 100, unidad: "días cerrados", gana: "Cierra 100 días en total", metrica: s => Object.values(s.ritual.dias || {}).filter(r => r && r.cerrado).length });
Object.assign(TIPOS_ELEFANTE.peluche, { meta: 30, unidad: "días de racha", gana: "Logra una racha de 30 días cerrados", metrica: s => eleMejorRacha(s) });
Object.assign(TIPOS_ELEFANTE.geometrico, { meta: 8, unidad: "semanas cerradas", gana: "Planifica y cierra 8 semanas", metrica: s => typeof g_semanasRedondas === "function" ? g_semanasRedondas(s).length : 0 });
Object.assign(TIPOS_ELEFANTE.tinta, { meta: 30, unidad: "días con gratitud", gana: "Escribe tu gratitud 30 días", metrica: s => new Set(((s.vida && s.vida.diario) || []).filter(e => e && e.fecha && String(e.gratitud || "").trim()).map(e => e.fecha)).size });
TIPOS_ELEFANTE.mamut.tag = "lanudo y resistente";

/* Etapas por XP (la XP no baja, así que el elefante nunca retrocede) */
[0, 900, 4000, 12000].forEach((min, i) => { ETAPAS_ELEFANTE[i].min = min; ETAPAS_ELEFANTE[i].nombre = ETAPAS_ELEFANTE[i].n; });
ETAPAS_ELEFANTE[3].corona = true;
function etapaElefante(xp) {
  let idx = 0;
  ETAPAS_ELEFANTE.forEach((x, i) => { if ((xp || 0) >= x.min) idx = i; });
  return { etapa: ETAPAS_ELEFANTE[idx], sig: ETAPAS_ELEFANTE[idx + 1] || null, idx };
}

/* -------- Ropa: cada prenda va en un espacio del cuerpo -------- */
const ESPACIOS_ELEFANTE = { cabeza: "Cabeza", ojos: "Ojos", cuello: "Cuello", espalda: "Espalda", trompa: "Trompa", pies: "Pies" };
const PRENDAS_ELEFANTE = [
  { id: "gorro", vb: "140 16 94 62", slot: "cabeza", n: "Gorro de lana", c: 150, compra: "acc-gorro", svg: `<path d="M150 67 C152 30 218 30 222 67 Z" fill="#E8563A"/><rect x="146" y="60" width="80" height="13" rx="6.5" fill="#C63F26"/><path d="M152 66 h72" stroke="#E8563A" stroke-width="2" stroke-dasharray="3 4"/><circle cx="186" cy="29" r="9" fill="#FFE3D9"/>` },
  { id: "jockey", vb: "142 28 116 50", slot: "cabeza", n: "Jockey", c: 200, svg: `<path d="M150 69 C152 36 218 36 222 69 Z" fill="#17C3B2"/><path d="M186 37 V69" stroke="#0F8F83" stroke-width="2" opacity=".6"/><path d="M212 62 C232 56 252 62 250 70 C236 74 222 73 212 70 Z" fill="#0F8F83"/><circle cx="186" cy="38" r="3.5" fill="#0F8F83"/>` },
  { id: "casco", vb: "128 26 116 54", slot: "cabeza", n: "Casco de exploración", c: 250, svg: `<ellipse cx="186" cy="67" rx="52" ry="9" fill="#B9955A"/><path d="M152 66 C153 32 219 32 220 66 Z" fill="#D8B77A"/><rect x="152" y="58" width="68" height="7" fill="#8C6A36"/>` },
  { id: "corona", vb: "152 20 68 48", slot: "cabeza", n: "Corona", gana: "Llega a Sabio (12.000 XP)", tiene: s => (s.gamif.xp || 0) >= 12000, svg: `<path d="M160 60 L164 33 L176 49 L186 26 L196 49 L208 33 L212 60 Z" fill="#F2C24B" stroke="#C99420" stroke-width="2" stroke-linejoin="round"/><rect x="159" y="56" width="54" height="8" rx="3" fill="#E0AE2E"/><circle cx="186" cy="45" r="3.5" fill="#E8563A"/><circle cx="170" cy="52" r="2.5" fill="#17C3B2"/><circle cx="202" cy="52" r="2.5" fill="#17C3B2"/>` },
  { id: "lectura", vb: "160 72 56 32", slot: "ojos", n: "Lentes de lectura", c: 250, svg: `<circle cx="199" cy="88" r="11.5" fill="rgba(255,255,255,.18)" stroke="#2A2F3A" stroke-width="3"/><path d="M187.5 86 L166 83" stroke="#2A2F3A" stroke-width="3" stroke-linecap="round"/>` },
  { id: "sol", vb: "160 74 58 28", slot: "ojos", n: "Lentes de sol", c: 250, compra: "acc-lentes", svg: `<rect x="185" y="79" width="28" height="18" rx="8" fill="#1D2330"/><path d="M186 85 L166 82" stroke="#1D2330" stroke-width="3.5" stroke-linecap="round"/><path d="M191 84 l8 -2" stroke="#8FE3DA" stroke-width="2.5" stroke-linecap="round"/>` },
  { id: "bufanda", vb: "132 116 84 62", slot: "cuello", n: "Bufanda", c: 200, compra: "acc-bufanda", svg: `<path d="M142 122 C160 136 192 136 208 124 L211 139 C192 150 158 150 139 136 Z" fill="#E8563A"/><path d="M152 132 l3 12 M166 136 l2 12 M180 137 l1 12 M194 134 l0 11" stroke="#FFD2C5" stroke-width="3" opacity=".8"/><path d="M153 139 L147 172 L162 173 L165 141 Z" fill="#C63F26"/>` },
  { id: "humita", vb: "164 126 44 30", slot: "cuello", n: "Humita", c: 200, svg: `<path d="M186 140 L170 131 L170 150 Z M186 140 L202 131 L202 150 Z" fill="#17C3B2"/><circle cx="186" cy="140" r="5" fill="#0F8F83"/>` },
  { id: "medalla", vb: "164 120 44 54", slot: "cuello", n: "Medalla", gana: "Gana una insignia de oro", tiene: s => (s.gamif.badges || []).some(b => /-o$/.test(b)), svg: `<path d="M172 126 L186 152 L200 126" stroke="#17C3B2" stroke-width="6" fill="none" stroke-linejoin="round"/><circle cx="186" cy="158" r="11" fill="#F2C24B" stroke="#C99420" stroke-width="2"/>` },
  { id: "mochila", vb: "70 78 84 62", slot: "espalda", n: "Mochila", c: 400, compra: "acc-mochila", svg: `<rect x="76" y="84" width="50" height="48" rx="13" fill="#0F8F83"/><rect x="84" y="104" width="34" height="20" rx="7" fill="#17C3B2"/><path d="M121 96 C138 104 146 118 148 134" stroke="#0B6F66" stroke-width="5" fill="none" stroke-linecap="round"/>` },
  { id: "capa", vb: "30 74 146 140", slot: "espalda", n: "Capa", c: 600, detras: true, svg: `<path d="M170 104 C150 80 98 78 66 98 C40 116 32 168 38 208 C66 198 96 200 120 208 C122 170 142 136 170 122 Z" fill="#6B4BD6"/><path d="M76 94 C100 84 136 84 160 96" stroke="#8C72F0" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  { id: "taza", vb: "224 162 38 56", slot: "trompa", n: "Taza de café", c: 150, svg: `<path d="M233 196 C234 186 250 186 251 196 L249 210 C248 214 236 214 235 210 Z" fill="#FFFFFF" stroke="#C8D3DE" stroke-width="1.5"/><rect x="235" y="198" width="15" height="4" fill="#E8563A"/><path d="M250 198 C257 198 257 207 249 206" stroke="#C8D3DE" stroke-width="3" fill="none"/>` },
  { id: "libro", vb: "222 182 44 38", slot: "trompa", n: "Libro", c: 200, svg: `<g transform="rotate(-12 243 200)"><rect x="228" y="190" width="30" height="22" rx="3" fill="#E8563A"/><rect x="231" y="193" width="24" height="16" rx="2" fill="#FFF3EC"/><path d="M243 193 v16" stroke="#E8563A" stroke-width="2"/></g>` },
  { id: "pesa", vb: "218 184 48 32", slot: "trompa", n: "Pesa", c: 200, svg: `<rect x="226" y="198" width="34" height="5" rx="2.5" fill="#6A7F95"/><rect x="224" y="190" width="8" height="21" rx="3" fill="#2A2F3A"/><rect x="254" y="190" width="8" height="21" rx="3" fill="#2A2F3A"/>` },
  { id: "zapatillas", vb: "46 194 142 32", slot: "pies", n: "Zapatillas", c: 300, svg: `<path d="M54 208 C54 200 86 200 88 208 L90 218 C90 222 52 222 52 218 Z" fill="#17C3B2"/><path d="M52 216 h38" stroke="#fff" stroke-width="4"/><path d="M146 208 C146 200 178 200 180 208 L182 218 C182 222 144 222 144 218 Z" fill="#17C3B2"/><path d="M144 216 h38" stroke="#fff" stroke-width="4"/>` },
];
PRENDAS_ELEFANTE.forEach(p => { if (!p.gana && !p.compra) p.compra = "ele-" + p.id; });
function prendaElefante(id) { return PRENDAS_ELEFANTE.find(p => p.id === id); }
function tienePrenda(p, S) {
  S = S || STATE;
  const owned = (S.gamif && S.gamif.owned) || [];
  if (p.tiene) return !!p.tiene(S) || owned.includes("ele-" + p.id);   // ganada (o desbloqueada para la cuenta dueña)
  return owned.includes(p.compra);
}

/* -------- Estado: gamif.equipped.ele = { tipo, ropa: { espacio: prenda }, ts } -------- */
function eleEstado(S) {
  S = S || STATE;
  const eq = S.gamif.equipped = S.gamif.equipped || {};
  if (!eq.ele || typeof eq.ele !== "object") eq.ele = { tipo: null, ropa: {}, ts: 0 };
  if (!eq.ele.ropa || typeof eq.ele.ropa !== "object") eq.ele.ropa = {};
  return eq.ele;
}
function eleTocar(S) { const e = eleEstado(S); e.ts = Math.max(Date.now(), (e.ts || 0) + 1); return e; }
/* Tipo que se muestra: el elegido, si sigue desbloqueado; si no, el Clásico (la elección se conserva) */
function tipoElefante(S) { const t = eleEstado(S).tipo; return TIPOS_ELEFANTE[t] && tipoDesbloqueado(t, S) ? t : "clasico"; }
/* Ropa puesta que la persona todavía tiene (una prenda ganada se puede perder de vista, nunca se cobra) */
function ropaPuesta(S) {
  S = S || STATE;
  const r = {}, ropa = eleEstado(S).ropa;
  Object.keys(ESPACIOS_ELEFANTE).forEach(sl => { const p = prendaElefante(ropa[sl]); if (p && p.slot === sl && tienePrenda(p, S)) r[sl] = p.id; });
  return r;
}

/* -------- Desbloqueos (quedan en el ledger como hito, así no se pierden aunque baje la métrica) -------- */
function eleMejorRacha(s) {
  const ks = Object.keys(s.ritual.dias || {}).filter(k => s.ritual.dias[k] && s.ritual.dias[k].cerrado).sort();
  let mejor = 0, run = 0, prev = null;
  ks.forEach(k => { run = prev && agSumar(prev, 1) === k ? run + 1 : 1; mejor = Math.max(mejor, run); prev = k; });
  return mejor;
}
function tipoDesbloqueado(id, S) {
  S = S || STATE;
  const T = TIPOS_ELEFANTE[id]; if (!T) return false;
  if (T.inicio || ((S.gamif && S.gamif.owned) || []).includes("ele-tipo-" + id)) return true;
  return ((S.gamif && S.gamif.ledger) || []).some(m => m && m.id === "hito:elefante:" + id && !m.anulado);
}
/* Revisa las metas; devuelve los tipos recién desbloqueados */
function revisarElefantes(S) {
  S = S || STATE;
  const nuevos = [];
  Object.entries(TIPOS_ELEFANTE).forEach(([id, T]) => {
    if (T.inicio || tipoDesbloqueado(id, S)) return;
    let v = 0; try { v = T.metrica(S); } catch (e) {}
    if (v >= T.meta && ledgerRegistrar(S, "hito:elefante:" + id, 0, 0, "Desbloqueaste el elefante " + T.n)) nuevos.push(id);
  });
  return nuevos;
}
function progresoTipo(id, S) {
  const T = TIPOS_ELEFANTE[id]; if (!T || T.inicio) return null;
  let v = 0; try { v = T.metrica(S || STATE); } catch (e) {}
  return { v: Math.min(v, T.meta), meta: T.meta, pct: Math.min(100, Math.round((v / T.meta) * 100)) };
}

/* -------- Ánimo: feliz si cerraste hoy; con sueño si llevas días sin cerrar -------- */
function elefanteConSueno(s) {
  s = s || STATE;
  const hoy = todayISO(), c = iso => !!(s.ritual.dias[iso] && s.ritual.dias[iso].cerrado) || diaCubierto(s, iso);
  return Object.values(s.ritual.dias || {}).some(r => r && r.cerrado) && !c(hoy) && !c(agSumar(hoy, -1)) && !c(agSumar(hoy, -2));
}
function animoElefante(S) {
  S = S || STATE;
  if (elefanteConSueno(S)) return "sueno";
  const r = S.ritual.dias[todayISO()];
  return r && r.cerrado ? "feliz" : "normal";
}

/* -------- Dibujo completo: { tipo, etapa (0..3), animo, ropa, anim } -------- */
function elefanteSVG(op) {
  op = op || {};
  const tipoId = TIPOS_ELEFANTE[op.tipo] ? op.tipo : tipoElefante();
  const e = ETAPAS_ELEFANTE[op.etapa != null ? op.etapa : etapaElefante(STATE.gamif.xp || 0).idx];
  const animo = op.animo || animoElefante(), ropa = op.ropa || ropaPuesta();
  const T = TIPOS_ELEFANTE[tipoId], d = T.dibujo({ animo }, e);
  const g = sl => { const p = prendaElefante(ropa[sl]); return p ? p.svg : ""; };
  const esp = prendaElefante(ropa.espalda);
  const s = e.s, cab = `translate(168 118) scale(${e.cab}) translate(-168 -118)`;
  const zz = animo === "sueno" ? `<g class="ele-zz" fill="#6A7F95" font-family="Space Grotesk,sans-serif" font-weight="700"><text x="214" y="58" font-size="16">z</text><text x="226" y="44" font-size="12">z</text></g>` : "";
  const sat = animo === "sueno" && !T.papel ? ` style="filter:saturate(.55) brightness(.96)"` : "";
  const anim = op.anim === false ? "" : " ele-anim";
  return `<svg class="ele-svg${anim}" viewBox="0 0 260 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Elefante ${T.n}, etapa ${e.n}${animo === "sueno" ? ", con sueño" : animo === "feliz" ? ", feliz" : ""}">
    <ellipse cx="128" cy="224" rx="${88 * s}" ry="${9 * s}" fill="#0E2A47" opacity="${T.papel ? .08 : .13}"/>
    <g transform="translate(128 222) scale(${s}) translate(-128 -222)"><g class="ele-salto"><g class="ele-breathe"${sat}>
      ${esp && esp.detras ? esp.svg : ""}<g class="ele-cola">${d.cola}</g>${d.fondo}${d.cuerpo}${esp && !esp.detras ? esp.svg : ""}${d.frente}${g("pies")}
      <g transform="${cab}"><g class="ele-cab"><g class="ele-ear">${d.oreja}</g>${d.cabeza}${d.colmillo}${d.cara}${g("ojos")}${g("cuello")}${g("cabeza")}${g("trompa")}${zz}</g></g>
    </g></g></g></svg>`;
}
/* Imagen para dibujar en canvas (informe del mes) */
function elefanteImagen(op) {
  return new Promise(res => {
    try {
      const img = new Image();
      img.onload = () => res(img); img.onerror = () => res(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(elefanteSVG(Object.assign({ anim: false }, op)));
    } catch (e) { res(null); }
  });
}

/* -------- Acciones -------- */
function elegirTipoElefante(id) {
  if (!tipoDesbloqueado(id)) return toast("Ese elefante todavía no está desbloqueado", true);
  const primera = !eleEstado().tipo;
  const e = eleTocar(); e.tipo = id;
  if (e.etapaVista == null) e.etapaVista = etapaElefante(STATE.gamif.xp || 0).idx;
  saveState(); closeModal(); rerender();
  toast(primera ? `🐘 ¡Bienvenido, tu elefante ${TIPOS_ELEFANTE[id].n}!` : `🐘 Ahora tu elefante es ${TIPOS_ELEFANTE[id].n}`);
}
let ELE_PRUEBA = null;     // id de la prenda que te estás probando (sin comprar)
let ELE_ESPACIO = "cabeza"; // espacio abierto en el vestidor
function probarPrenda(id) {
  const p = prendaElefante(id); if (!p) return;
  ELE_ESPACIO = p.slot;
  if (tienePrenda(p)) {   // la tienes: se pone o se saca
    const ropa = eleEstado().ropa;
    eleTocar().ropa[p.slot] = ropa[p.slot] === id ? null : id;
    ELE_PRUEBA = null; saveState(); rerender();
  } else ELE_PRUEBA = ELE_PRUEBA === id ? null : id;
  openElefante("ropa");
}
function comprarPrenda(id) {
  const p = prendaElefante(id); if (!p || p.gana || tienePrenda(p)) return;
  recalcGamif(STATE);
  if (STATE.gamif.puntos < p.c) return toast("Te faltan " + (p.c - STATE.gamif.puntos) + " ⭐", true);
  const res = ledgerComprar(STATE, p.compra, p.c);
  if (!res.ok && !res.yaTenia) return toast("Te faltan " + res.falta + " ⭐", true);
  eleTocar().ropa[p.slot] = p.id;
  ELE_PRUEBA = null;
  saveState(); updateTopbar(); rerender(); openElefante("ropa");
  toast(`👕 ${p.n} para tu elefante`);
}
function quitarEspacio(slot) { eleTocar().ropa[slot] = null; ELE_PRUEBA = null; saveState(); rerender(); openElefante("ropa"); }
function espacioElefante(slot) { if (ESPACIOS_ELEFANTE[slot]) { ELE_ESPACIO = slot; openElefante("ropa"); } }
function cancelarPrueba() { ELE_PRUEBA = null; openElefante("ropa"); }

/* Al abrir la app o en cada render: nuevos tipos desbloqueados */
function avisarElefantes() {
  if (!STATE || !STATE.gamif) return;
  revisarEtapaElefante();
  const nuevos = revisarElefantes(STATE);
  if (!nuevos.length) return;
  saveState();
  setTimeout(() => escenaDesbloqueo(nuevos[0]), 400);
}
/* ============================================================
   🎬 Animaciones y escenas
   · En reposo (CSS): respira, parpadea, mueve la oreja y la cola.
   · Al tocarlo: salta, saluda con la cabeza o le salen corazones.
   · Escenas: cerrar el día, subir de etapa y desbloquear un tipo.
   Todo se apaga con "reducir movimiento".
   ============================================================ */
function sinMovimiento() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
const REACCIONES = ["salta", "saluda", "corazones"];
let ELE_REACCION = 0;
function tocarElefante(el) {
  const caja = el && el.closest ? el.closest(".ele-toca") : null; if (!caja) return;
  const svg = caja.querySelector(".ele-svg"); if (!svg || sinMovimiento()) return;
  const r = REACCIONES[ELE_REACCION++ % REACCIONES.length];
  svg.classList.remove("re-salta", "re-saluda", "re-corazones"); void svg.getBoundingClientRect();
  svg.classList.add("re-" + r);
  if (r === "corazones") for (let k = 0; k < 4; k++) {
    const h = document.createElement("span"); h.className = "ele-corazon"; h.textContent = k % 2 ? "💛" : "❤️";
    h.style.left = (42 + Math.random() * 30) + "%"; h.style.animationDelay = (k * .12) + "s";
    caja.appendChild(h); setTimeout(() => h.remove(), 1600);
  }
  setTimeout(() => svg.classList.remove("re-" + r), 1100);
}
/* Escena corta sobre la pantalla (no bloquea: se cierra sola o con un toque) */
function escenaElefante({ svg, titulo, texto, botones, dura, clase }) {
  try { if (localStorage.getItem("rumbo-sin-escenas")) return null; } catch (e) {}   // lo usan las pruebas automáticas
  const prev = document.getElementById("eleEscena"); if (prev) prev.remove();
  const el = document.createElement("div");
  el.id = "eleEscena"; el.className = "ele-escena " + (clase || ""); el.setAttribute("role", "status");
  el.innerHTML = `<div class="ele-escena__caja"><div class="ele-escena__ele">${svg}</div>
    <div class="ele-escena__txt"><b>${titulo}</b>${texto ? `<span>${texto}</span>` : ""}</div>
    ${botones ? `<div class="ele-escena__btns">${botones}</div>` : ""}</div>`;
  el.addEventListener("click", ev => { if (!ev.target.closest("button") || ev.target.closest("[data-cerrar]")) el.remove(); });
  document.body.appendChild(el);
  if (dura) setTimeout(() => el.remove(), dura);
  return el;
}
/* Al cerrar el día: el elefante se alegra */
function celebrarCierreElefante() {
  if (!STATE || !eleEstado().tipo || sinMovimiento()) return;
  escenaElefante({ svg: elefanteSVG({ animo: "feliz" }).replace('class="ele-svg ele-anim"', 'class="ele-svg ele-anim re-festeja"'),
    titulo: "¡Día cerrado!", texto: "Tu elefante está feliz. Mañana volvemos a empezar 🌙", dura: 3200, clase: "is-cierre" });
}
/* Subir de etapa: se guarda la última etapa vista; al pasar a una mayor, se celebra */
function revisarEtapaElefante() {
  if (!STATE || !STATE.gamif) return;
  const e = eleEstado(); if (!e.tipo) return;
  const idx = etapaElefante(STATE.gamif.xp || 0).idx;
  if (e.etapaVista == null) { e.etapaVista = idx; saveState(); return; }   // primera vez: sin escena
  if (idx <= e.etapaVista) return;
  const antes = e.etapaVista;
  eleTocar().etapaVista = idx; saveState();
  const T = TIPOS_ELEFANTE[tipoElefante()], E = ETAPAS_ELEFANTE[idx];
  setTimeout(() => escenaElefante({
    svg: `<div class="ele-crece"><div class="ele-crece__antes">${elefanteSVG({ etapa: antes, animo: "normal", anim: false })}</div><div class="ele-crece__flecha">→</div><div class="ele-crece__ahora">${elefanteSVG({ etapa: idx, animo: "feliz" })}</div></div>`,
    titulo: `¡Tu elefante creció! Ahora es ${E.n}${E.corona ? " 👑" : ""}`, texto: T.rasgos[idx] + ".",
    botones: `<button class="btn btn--primary" data-cerrar="1">¡Genial!</button>`, clase: "is-crece" }), 500);
}
function escenaDesbloqueo(id) {
  const T = TIPOS_ELEFANTE[id]; if (!T) return;
  const etapa = etapaElefante(STATE.gamif.xp || 0).idx;
  escenaElefante({ svg: elefanteSVG({ tipo: id, etapa, animo: "feliz" }), titulo: `🔓 Desbloqueaste el elefante ${T.n}`, texto: T.d,
    botones: `<button class="btn-ghost" data-cerrar="1">Después</button><button class="btn btn--primary" data-action="ele-tipo" data-id="${id}" data-cerrar="1">Elegirlo</button>`, clase: "is-nuevo" });
}

/* Primera vez en esta versión: elegir entre Clásico y Asiático */
function debeElegirElefante() { return !!(STATE && STATE.settings && STATE.settings.onboarded && !eleEstado().tipo); }
function openElegirElefante() {
  const etapa = etapaElefante(STATE.gamif.xp || 0).idx, ropa = ropaPuesta();
  const card = id => { const T = TIPOS_ELEFANTE[id]; return `<div class="ele-elige">
      <div class="ele-lienzo">${elefanteSVG({ tipo: id, etapa, ropa, animo: "feliz" })}</div>
      <div class="card__title" style="font-size:16px">${T.n}</div><div class="text-xs muted">${T.d}</div>
      <button class="btn btn--primary btn-block mt-8" data-action="ele-tipo" data-id="${id}">Elegir ${T.n}</button></div>`; };
  openModal("🐘 Elige tu elefante", `
    <p class="text-sm soft">Te acompaña en Rumbo y crece con tu constancia: cambia al pasar de cría a sabio. ${etapa ? `Parte en su etapa <b>${ETAPAS_ELEFANTE[etapa].n}</b>, por la XP que ya tienes.` : ""}</p>
    <div class="grid grid-2 mt-16">${card("clasico")}${card("asiatico")}</div>
    <p class="text-xs muted mt-16">Hay cuatro elefantes más que se ganan con tu constancia: Mamut, Peluche, Geométrico y Tinta. Puedes cambiar entre los que tengas cuando quieras.</p>`);
}

/* -------- Pantallas -------- */
function nombreElefante() {
  const T = TIPOS_ELEFANTE[tipoElefante()], { etapa } = etapaElefante(STATE.gamif.xp || 0);
  return `${T.n} · ${etapa.n}${etapa.corona ? " 👑" : ""}`;
}
function renderElefanteCard() {
  const xp = STATE.gamif.xp || 0, { etapa, sig } = etapaElefante(xp), animo = animoElefante();
  const prog = sig ? Math.min(100, Math.round(((xp - etapa.min) / (sig.min - etapa.min)) * 100)) : 100;
  const sinElegir = !eleEstado().tipo, T = TIPOS_ELEFANTE[tipoElefante()];
  return `<div class="card ele-card" data-tour="elefante"><div class="row" style="gap:16px;align-items:center">
    <div class="ele-mini ele-toca ${T.papel ? "papel" : ""}" data-action="ele-toca" title="Tócalo">${elefanteSVG()}</div>
    <div style="flex:1;min-width:0"><div class="card__title" style="font-size:15px">🐘 Tu elefante · ${sinElegir ? "¡elígelo!" : nombreElefante()}</div>
      <div class="text-xs muted mt-8">${sinElegir ? "Elige entre el Clásico y el Asiático. Crece contigo y cambia al pasar de cría a sabio."
        : animo === "sueno" ? "Tiene sueño: cierra tu día para despertarlo. Nunca pierde lo que creció."
        : sig ? `${T.rasgos[etapa.i + 1] ? "Próxima etapa, " + sig.n + ": " + T.rasgos[etapa.i + 1].charAt(0).toLowerCase() + T.rasgos[etapa.i + 1].slice(1) + "." : ""} Llega a los ${sig.min.toLocaleString("es-CL")} XP.` : "Llegó a su última etapa. ¡Sabio como tú!"}</div>
      ${sig && !sinElegir ? `<div class="bar mt-8"><div class="bar__fill" style="width:${prog}%"></div></div>` : ""}
      <div class="row mt-8" style="gap:8px;flex-wrap:wrap">${sinElegir ? `<button class="btn btn--primary" data-action="ele-elegir" style="padding:6px 12px">Elegir mi elefante</button>` : ""}
        <button class="btn-ghost" data-action="elefante-open" data-v="ropa" style="padding:4px 10px">👕 Vestir</button>
        <button class="btn-ghost" data-action="elefante-open" data-v="tipo" style="padding:4px 10px">🐘 Tipos</button></div></div></div></div>`;
}
/* Dibujo de una prenda sola (para su ficha en el vestidor) */
function prendaMini(p) { return `<svg viewBox="${p.vb || "0 0 260 240"}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${p.svg}</svg>`; }
const ICONO_ESPACIO = { cabeza: "gorro", ojos: "sol", cuello: "bufanda", espalda: "mochila", trompa: "taza", pies: "zapatillas" };

function openElefante(tab) {
  tab = tab === "tipo" ? "tipo" : "ropa";
  const puesta = ropaPuesta(), ropa = Object.assign({}, puesta);
  const prueba = tab === "ropa" && ELE_PRUEBA ? prendaElefante(ELE_PRUEBA) : null;
  if (prueba) ropa[prueba.slot] = prueba.id;
  const T = TIPOS_ELEFANTE[tipoElefante()], animo = animoElefante();
  const tabs = `<div class="seg vest-tabs"><button class="${tab === "ropa" ? "is-active" : ""}" data-action="elefante-open" data-v="ropa">👕 Ropa</button><button class="${tab === "tipo" ? "is-active" : ""}" data-action="elefante-open" data-v="tipo">🐘 Tipos</button></div>`;
  const escenario = `<div class="vest-escena ele-toca ${T.papel ? "papel" : ""}" data-action="ele-toca" title="Tócalo">${elefanteSVG({ ropa })}</div>
    <div class="vest-nombre"><b>${nombreElefante()}</b><span class="chip">${animo === "feliz" ? "😊 Feliz" : animo === "sueno" ? "😴 Con sueño" : "🙂 Normal"}</span></div>`;
  let panel;
  if (tab === "ropa") {
    const slot = ESPACIOS_ELEFANTE[ELE_ESPACIO] ? ELE_ESPACIO : "cabeza";
    const pestañas = Object.entries(ESPACIOS_ELEFANTE).map(([sl, nom]) => {
      const p = prendaElefante(puesta[sl]);
      return `<button type="button" class="vest-esp ${sl === slot ? "is-on" : ""}" data-action="ele-espacio" data-slot="${sl}" aria-pressed="${sl === slot}">
        <span class="vest-esp__ico">${prendaMini(p || prendaElefante(ICONO_ESPACIO[sl]))}</span><span>${nom}</span>${p ? '<i class="vest-esp__dot" aria-label="con ropa"></i>' : ""}</button>`;
    }).join("");
    const fichas = PRENDAS_ELEFANTE.filter(p => p.slot === slot).map(p => {
      const tiene = tienePrenda(p), on = puesta[slot] === p.id, probando = prueba && prueba.id === p.id;
      const estado = on ? `<span class="vest-tag is-on">✓ Puesta</span>` : tiene ? `<span class="vest-tag is-tuya">Tuya</span>`
        : p.gana ? `<span class="vest-tag is-gana">🔒 Se gana</span>` : `<span class="vest-tag">${p.c} ⭐</span>`;
      return `<button type="button" class="vest-ficha ${on ? "is-on" : ""} ${probando ? "is-prueba" : ""} ${tiene ? "" : "is-no"}" data-action="ele-probar" data-id="${p.id}" aria-pressed="${on || probando}">
        <span class="vest-ficha__img">${prendaMini(p)}</span><span class="vest-ficha__n">${escapeHtml(p.n)}</span>${estado}</button>`;
    }).join("");
    let barra;
    if (prueba && prueba.gana) barra = `<div class="vest-barra"><span>🔒 <b>${escapeHtml(prueba.n)}</b> · ${escapeHtml(prueba.gana)}.</span><button class="btn-ghost" data-action="ele-cancelar">Volver</button></div>`;
    else if (prueba) barra = `<div class="vest-barra is-compra"><span>Te estás probando <b>${escapeHtml(prueba.n)}</b></span><div class="row" style="gap:8px"><button class="btn-ghost" data-action="ele-cancelar">Sacar</button><button class="btn btn--primary" data-action="ele-comprar" data-id="${prueba.id}">Comprar · ${prueba.c} ⭐</button></div></div>`;
    else if (puesta[slot]) barra = `<div class="vest-barra"><span>Lleva <b>${escapeHtml(prendaElefante(puesta[slot]).n)}</b></span><button class="btn-ghost" data-action="ele-quitar" data-slot="${slot}">Quitar</button></div>`;
    else barra = `<div class="vest-barra is-suave"><span>Toca una prenda para probártela.</span><span class="text-xs muted">⭐ ${STATE.gamif.puntos}</span></div>`;
    panel = `<div class="vest-espacios" role="group" aria-label="Espacios del cuerpo">${pestañas}</div>
      <div class="vest-grid">${fichas}</div>${barra}`;
  } else {
    const etapa = etapaElefante(STATE.gamif.xp || 0).idx;
    panel = `<div class="ele-tipos">${Object.entries(TIPOS_ELEFANTE).map(([id, X]) => {
      const ok = tipoDesbloqueado(id), actual = tipoElefante() === id && eleEstado().tipo, pr = progresoTipo(id);
      return `<div class="ele-tipo ${actual ? "is-actual" : ""} ${ok ? "" : "is-lock"}">
        <div class="ele-lienzo ${X.papel ? "papel" : ""}">${elefanteSVG({ tipo: id, etapa, animo: "normal", anim: false, ropa: ok ? puesta : {} })}</div>
        <b class="text-sm">${X.n}</b>
        ${ok ? (actual ? `<span class="chip chip--cian">✓ Es el tuyo</span>` : `<button class="btn btn--cian btn-block" data-action="ele-tipo" data-id="${id}">Elegir</button>`)
          : `<div class="text-xs muted">🔒 ${X.gana}</div><div class="bar"><div class="bar__fill" style="width:${pr.pct}%"></div></div><div class="text-xs muted">${pr.v}/${pr.meta} ${X.unidad}</div>`}
      </div>`; }).join("")}</div>
      <p class="text-xs muted mt-8">Cambiar entre los que tienes es gratis: conservas la etapa y la ropa.</p>`;
  }
  openModal("🐘 Tu elefante", `<div class="vestidor"><div class="vest-izq">${escenario}</div><div class="vest-der">${tabs}${panel}</div></div>`, { ancho: true });
}
function renderElefanteTienda() {
  const sinTener = PRENDAS_ELEFANTE.filter(p => !p.gana && !tienePrenda(p)).length;
  return `<div class="section-title">🐘 Tu elefante <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· crece con tu XP; la ropa se compra</span></div>
  <div class="grid grid-2">${renderElefanteCard()}
    <div class="card"><div class="card__title" style="font-size:14px">Ropa para tu elefante</div>
      <p class="text-sm soft mt-8">${PRENDAS_ELEFANTE.length} prendas en 6 espacios: cabeza, ojos, cuello, espalda, trompa y pies. ${sinTener ? `Te faltan ${sinTener} por comprar.` : "¡Las tienes todas!"} La corona y la medalla se ganan.</p>
      <button class="btn btn--soft btn-block mt-16" data-action="elefante-open" data-v="ropa">Abrir el probador</button></div></div>`;
}
