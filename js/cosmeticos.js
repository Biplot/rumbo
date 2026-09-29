/* ============================================================
   RUMBO · Cosméticos nuevos de la Tienda (Entrega 3)
   🎆 Celebraciones · ✅ Estilos de check · 🔊 Sonidos · 📤 Plantillas para compartir · 🖼️ Marcos de avatar
   Se compran una vez (compra:<id> en el ledger, como los títulos) y se equipan en
   gamif.equipped: { marco, check, sonidos, celebraOff: [] }.
   ============================================================ */

const COSMETICOS = [
  // Celebraciones: activas al comprarlas (se pueden apagar)
  { id: "cel-fuegos", grupo: "celebra", icon: "🎆", nombre: "Fuegos artificiales", costo: 500, key: "celebra", cuando: "al cerrar el mes" },
  { id: "cel-estrellas", grupo: "celebra", icon: "🌟", nombre: "Lluvia de estrellas", costo: 400, key: "celebra", cuando: "al completar tu primer bocado" },
  { id: "cel-elefante", grupo: "celebra", icon: "🐘", nombre: "Elefante que cruza", costo: 400, key: "celebra", cuando: "al domar una tarea postergada" },
  // Estilos de check (uno a la vez)
  { id: "chk-rebote", grupo: "check", icon: "✅", nombre: "Check con rebote", costo: 250, key: "check", value: "rebote" },
  { id: "chk-mano", grupo: "check", icon: "✍️", nombre: "Tachado a mano", costo: 250, key: "check", value: "mano" },
  { id: "chk-sello", grupo: "check", icon: "🔖", nombre: "Sello de tinta", costo: 250, key: "check", value: "sello" },
  { id: "snd-pack", grupo: "check", icon: "🔊", nombre: "Sonidos", costo: 300, key: "sonidos", cuando: "campanita al marcar, gong al cerrar el día" },
  // Plantillas para "Comparte tu mes" (Navy viene incluida)
  { id: "pla-cuaderno", grupo: "plantilla", icon: "📓", nombre: "Plantilla Cuaderno", costo: 300, key: "plantilla", value: "cuaderno" },
  { id: "pla-atardecer", grupo: "plantilla", icon: "🌇", nombre: "Plantilla Atardecer", costo: 300, key: "plantilla", value: "atardecer" },
  { id: "pla-terminal", grupo: "plantilla", icon: "💻", nombre: "Plantilla Terminal", costo: 300, key: "plantilla", value: "terminal" },
  // Marcos de avatar (uno a la vez). Diamante no se compra: llega con el rango Élite.
  { id: "mar-cian", grupo: "marco", icon: "🔵", nombre: "Marco Cian", costo: 200, key: "marco", value: "cian" },
  { id: "mar-oro", grupo: "marco", icon: "🟡", nombre: "Marco Oro", costo: 400, key: "marco", value: "oro" },
  { id: "mar-llama", grupo: "marco", icon: "🔥", nombre: "Marco Llama", costo: 700, key: "marco", value: "llama", animado: true },
  { id: "mar-aurora", grupo: "marco", icon: "🌌", nombre: "Marco Aurora", costo: 900, key: "marco", value: "aurora", animado: true },
  { id: "mar-diamante", grupo: "marco", icon: "💎", nombre: "Marco Diamante", costo: 0, key: "marco", value: "diamante", rango: 7000 },
];
function eqCos() { const eq = STATE.gamif.equipped = STATE.gamif.equipped || {}; if (!Array.isArray(eq.celebraOff)) eq.celebraOff = []; return eq; }
function cosActivo(id) {
  const it = COSMETICOS.find(c => c.id === id); if (!it || !isOwned(id)) return false;
  const eq = eqCos();
  if (it.key === "celebra") return !eq.celebraOff.includes(id);
  if (it.key === "sonidos") return eq.sonidos !== false;
  if (it.key === "plantilla") return true;
  return eq[it.key] === it.value;
}
/* Equipar / quitar (lo llama equipItem de recompensas.js) */
function equipCosmetico(it) {
  const eq = eqCos();
  if (it.key === "celebra") eq.celebraOff = eq.celebraOff.includes(it.id) ? eq.celebraOff.filter(x => x !== it.id) : eq.celebraOff.concat(it.id);
  else if (it.key === "sonidos") { eq.sonidos = eq.sonidos === false; if (eq.sonidos) sonar("check"); }
  else if (it.key === "marco" || it.key === "check") eq[it.key] = eq[it.key] === it.value ? null : it.value;
}

/* Aplica marco y estilo de check (se llama desde applyCosmetics) */
function applyCosmeticos2() {
  const eq = (STATE && STATE.gamif && STATE.gamif.equipped) || {};
  const root = document.documentElement;
  if (eq.check && isOwned("chk-" + eq.check)) root.setAttribute("data-check", eq.check); else root.removeAttribute("data-check");
  renderAccountBox && CURRENT_USER && renderAccountBox();
}
function marcoClase() {
  const eq = (STATE && STATE.gamif && STATE.gamif.equipped) || {};
  return eq.marco && isOwned("mar-" + eq.marco) ? ` marco marco--${eq.marco}` : "";
}

/* -------- Al completar una tarea: sonido y celebraciones -------- */
let ULTIMO_CHECK = null;
function checkReciente(id) { return ULTIMO_CHECK && ULTIMO_CHECK.id === id && Date.now() - ULTIMO_CHECK.ts < 1500; }
function alCompletarTarea(t) {
  ULTIMO_CHECK = { id: t.id, ts: Date.now() };
  sonar("check");
  if (t.esSapo) celebrar("bocado");
  else if ((t.migraciones || 0) >= 3) celebrar("domada");
}
/* evento: "mes" | "bocado" | "domada" | "enfoque" */
function celebrar(evento) {
  const id = { mes: "cel-fuegos", bocado: "cel-estrellas", domada: "cel-elefante" }[evento];
  if (!id || !cosActivo(id)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (id === "cel-fuegos") fuegosArtificiales();
  else if (id === "cel-estrellas") lluviaEstrellas();
  else elefanteCruza();
}
function fuegosArtificiales() {
  const colores = ["#17C3B2", "#FF6B4A", "#FFC24A", "#8FF3E8", "#FF4FD8", "#FFFFFF"];
  for (let r = 0; r < 5; r++) setTimeout(() => {
    const cx = 15 + Math.random() * 70, cy = 15 + Math.random() * 40, color = colores[r % colores.length];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("div"), ang = (i / 26) * Math.PI * 2, dist = 70 + Math.random() * 60;
      p.className = "fx-chispa"; p.style.left = cx + "vw"; p.style.top = cy + "vh"; p.style.background = color;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px"); p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      document.body.appendChild(p); setTimeout(() => p.remove(), 1300);
    }
  }, r * 330);
}
function lluviaEstrellas() {
  for (let i = 0; i < 26; i++) {
    const e = document.createElement("div");
    e.className = "fx-estrella"; e.textContent = i % 3 ? "⭐" : "✨";
    e.style.left = Math.random() * 100 + "vw"; e.style.fontSize = 16 + Math.random() * 18 + "px";
    e.style.animationDelay = (Math.random() * 0.8).toFixed(2) + "s";
    document.body.appendChild(e); setTimeout(() => e.remove(), 3200);
  }
}
function elefanteCruza() {
  const e = document.createElement("div");
  e.className = "fx-elefante"; e.innerHTML = `<span class="fx-ele">${typeof elefanteSVG === "function" ? elefanteSVG({ animo: "feliz", anim: false }) : "🐘"}</span><b>¡Tarea domada!</b>`;
  document.body.appendChild(e); setTimeout(() => e.remove(), 3600);
}

/* -------- 🔊 Sonidos (sintetizados, sin archivos) -------- */
let AUDIO_CTX = null;
function sonar(tipo) {
  if (!isOwned("snd-pack") || eqCos().sonidos === false) return;
  try {
    AUDIO_CTX = AUDIO_CTX || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = AUDIO_CTX, t0 = ctx.currentTime;
    const nota = (f, ini, dur, vol, forma) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = forma || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + ini); g.gain.exponentialRampToValueAtTime(vol, t0 + ini + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    };
    if (tipo === "check") { nota(1318.5, 0, 0.35, 0.12); nota(1975.5, 0.07, 0.45, 0.08); }
    else if (tipo === "cierre") { [98, 196, 293.7, 392, 587].forEach((f, i) => nota(f, 0, 2.6 - i * 0.3, 0.16 / (i + 1))); }
    else if (tipo === "fin") { nota(880, 0, 0.3, 0.12); nota(1108.7, 0.18, 0.3, 0.12); nota(1318.5, 0.36, 0.6, 0.12); }
  } catch (e) {}
}

/* -------- 📤 Paletas para la imagen de "Comparte tu mes" -------- */
const PALETAS_INFORME = {
  navy: { nombre: "Navy", arriba: "#0E2A47", abajo: "#081A2E", marca: "#0E2A47", acento: "#17C3B2", acento2: "#FF6B4A", texto: "#EAF2F8", suave: "#9FB3C8",
    halo1: "rgba(23,195,178,0.20)", halo2: "rgba(255,107,74,0.14)", tarjeta: "rgba(255,255,255,0.06)", borde: "rgba(255,255,255,0.10)",
    fuente: `"Space Grotesk", system-ui, sans-serif`, titulo: `"Space Grotesk", system-ui, sans-serif` },
  cuaderno: { nombre: "Cuaderno", arriba: "#F4EFE3", abajo: "#EFE8D8", marca: "#FFFDF7", acento: "#2F4B7C", acento2: "#B23A2E", texto: "#1F2A3D", suave: "#6B6454",
    halo1: "rgba(47,75,124,0.06)", halo2: "rgba(178,58,46,0.06)", tarjeta: "rgba(255,253,247,0.9)", borde: "#D9CFB9", puntos: "#D6CCB6",
    fuente: `"Karla", system-ui, sans-serif`, titulo: `"Fraunces", Georgia, serif`, fuentes: "cuaderno" },
  atardecer: { nombre: "Atardecer", arriba: "#2A1D45", abajo: "#1D1530", marca: "#28203F", acento: "#FF9E7A", acento2: "#E8618A", texto: "#F7EEF6", suave: "#D4C4DC",
    halo1: "rgba(255,158,122,0.26)", halo2: "rgba(232,97,138,0.20)", tarjeta: "rgba(255,255,255,0.07)", borde: "rgba(255,255,255,0.12)",
    fuente: `"Space Grotesk", system-ui, sans-serif`, titulo: `"Space Grotesk", system-ui, sans-serif` },
  terminal: { nombre: "Terminal", arriba: "#0A0F0B", abajo: "#050806", marca: "#0F1711", acento: "#39FF88", acento2: "#FFB000", texto: "#D8FFE4", suave: "#74AD8A",
    halo1: "rgba(57,255,136,0.10)", halo2: "rgba(255,176,0,0.08)", tarjeta: "rgba(57,255,136,0.05)", borde: "rgba(57,255,136,0.30)", lineas: true,
    fuente: `"IBM Plex Mono", ui-monospace, monospace`, titulo: `"IBM Plex Mono", ui-monospace, monospace`, radio: 8, mayus: true },
};
function paletasDisponibles() { return ["navy"].concat(["cuaderno", "atardecer", "terminal"].filter(p => isOwned("pla-" + p))); }

/* -------- Tienda: secciones de cosméticos -------- */
function cosmeticoCard(it) {
  const owned = isOwned(it.id), activo = owned && cosActivo(it.id);
  let pie;
  if (it.rango && !owned) pie = `<div class="chip mt-8" style="display:inline-block">💎 Se gana en rango Élite</div>`;
  else if (!owned) pie = `<button class="btn btn--primary btn-block" data-action="cos-buy" data-id="${it.id}">Comprar · ${it.costo} ⭐</button>`;
  else if (it.key === "plantilla") pie = `<div class="chip chip--cian mt-8" style="display:inline-block">✓ Elígela al compartir tu mes</div>`;
  else pie = `<button class="btn ${activo ? "btn--soft" : "btn--cian"} btn-block" data-action="cos-equip" data-id="${it.id}">${activo ? (it.key === "celebra" || it.key === "sonidos" ? "✓ Activo — apagar" : "✓ Equipado — quitar") : (it.key === "celebra" || it.key === "sonidos" ? "Activar" : "Equipar")}</button>`;
  const vista = it.key === "marco" ? `<div class="account__avatar marco marco--${it.value}" style="margin:0 auto 8px">${typeof avatarActualHtml === "function" ? avatarActualHtml((((STATE.profile && STATE.profile.name) || "R").trim()[0] || "R").toUpperCase()) : escapeHtml(((STATE.profile && STATE.profile.name) || "R").trim()[0] || "R").toUpperCase()}</div>`
    : `<span style="font-size:24px">${it.icon}</span>`;
  return `<div class="card cos-card" data-cos="${it.id}">
    ${it.key === "marco" ? `<div style="text-align:center">${vista}</div>` : ""}
    <div class="row" style="gap:10px">${it.key === "marco" ? "" : vista}
      <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${it.nombre}${it.animado ? ' <span class="chip">animado</span>' : ""}</div>
        <div class="text-xs muted">${owned ? "Desbloqueado" : it.rango ? "Por rango" : it.costo + " ⭐"}${it.cuando ? " · " + it.cuando : ""}</div></div></div>
    <div class="mt-8">${pie}</div>
  </div>`;
}
function renderCosmeticosTienda() {
  const grupo = g => COSMETICOS.filter(c => c.grupo === g).map(cosmeticoCard).join("");
  return `
  <div class="section-title">🎆 Celebraciones <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· una animación cuando logras algo</span></div>
  <div class="grid grid-3">${grupo("celebra")}</div>
  <div class="section-title">✅ Checks y sonidos <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· cómo se ve y se escucha una tarea hecha</span></div>
  <div class="grid grid-4">${grupo("check")}</div>
  <div class="section-title">🖼️ Marcos para tu avatar</div>
  <div class="grid grid-auto">${grupo("marco")}</div>
  <div class="section-title">📤 Plantillas para compartir tu mes <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· Navy viene incluida</span></div>
  <div class="grid grid-3">${grupo("plantilla")}</div>`;
}
