/* ============================================================
   RUMBO · Navegación: íconos de línea, barra inferior con el botón
   del día, hoja "Más" (móvil), menú de cuenta y pestañas de Recompensas.
   Se carga antes de app.js; usa ROUTES/ROUTE_MAP y dayState() de app.js.
   ============================================================ */

/* Íconos de línea (24×24, trazo = currentColor) */
const ICONOS_LINEA = {
  inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  semana: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  habitos: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  mas: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  metas: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  ritual: '<path d="M3 18h18"/><path d="M7 18a5 5 0 0 1 10 0"/><path d="M12 5v3M5 9l2 2M19 9l-2 2"/>',
  diario: '<path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1z"/><path d="M6 18a2 2 0 0 1 2-2h10"/><path d="M10 8h5"/>',
  tendencias: '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M8 14h2M14 14h2"/>',
  finanzas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14.5" r="1.2"/>',
  salud: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  entrenamiento: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
  rueda: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  lecturas: '<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/>',
  relaciones: '<circle cx="9" cy="9" r="3"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16 6.5a3 3 0 0 1 0 5M18 19a5 5 0 0 0-2-4"/>',
  listas: '<path d="M9 7h11M9 12h11M9 17h11"/><circle cx="5" cy="7" r=".8"/><circle cx="5" cy="12" r=".8"/><circle cx="5" cy="17" r=".8"/>',
  aprendizajes: '<path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>',
  notas: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  recompensas: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  cuenta: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  notif: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  tutoriales: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14"/><circle cx="12" cy="17" r=".6"/>',
  personalizar: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  respaldo: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  salir: '<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  hecho: '<path d="M5 12l5 5 9-10"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
};
function iconoLinea(id, tam = 22) {
  const d = ICONOS_LINEA[id] || ICONOS_LINEA.mas;
  return `<svg class="ico-linea" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/* -------- Botón del día (barra inferior en móvil y menú lateral en computador) -------- */
function estadoBotonDia() {
  const st = dayState();
  if (st === "por-abrir") return { accion: "day-open", ico: "sol", texto: "Abrir día", largo: "Abre tu día", clase: "is-abrir" };
  if (st === "cerrado") return { ruta: "ritual", ico: "hecho", texto: "Día cerrado", largo: "Día cerrado", clase: "is-cerrado" };
  return { accion: "day-close", ico: "luna", texto: "Cerrar día", largo: "Cierra tu día", clase: "is-cerrar" };
}
function pintarBotonDia(el, e, largo) {
  if (!el) return;
  el.className = el.dataset.base + " " + e.clase;
  if (e.accion) { el.dataset.action = e.accion; delete el.dataset.route; } else { el.dataset.route = e.ruta; delete el.dataset.action; }
  el.setAttribute("aria-label", e.largo);
  el.title = e.largo;
  el.innerHTML = largo ? `${iconoLinea(e.ico, 20)}<span>${e.largo}</span>` : `<span class="bb-dia__c">${iconoLinea(e.ico, 26)}</span>`;
}
function actualizarBotonDia() {
  if (!STATE) return;
  const e = estadoBotonDia();
  pintarBotonDia(document.getElementById("bbDia"), e, false);
  const nd = document.getElementById("navDia");
  if (nd) { nd.hidden = e.clase === "is-cerrado"; pintarBotonDia(nd, e, true); }
}

/* -------- Barra inferior (móvil) -------- */
const BOTTOM_NAV = ["inicio", "semana", "habitos"];
function buildBottomNav() {
  const bar = document.getElementById("bottombar");
  if (!bar) return;
  const item = id => `<button class="bottombar__item" data-route="${id}">${iconoLinea(id, 24)}<span>${ROUTE_MAP[id].label}</span></button>`;
  bar.innerHTML = item("inicio") + item("semana")
    + `<button class="bb-dia" id="bbDia" data-base="bb-dia"></button>`
    + item("habitos")
    + `<button class="bottombar__item" data-action="open-menu" id="bbMas">${iconoLinea("mas", 24)}<span>Más</span></button>`;
  actualizarBotonDia();
}
function marcarNavActiva() {
  document.querySelectorAll(".nav__item, .bottombar__item, .tabs__b, .nav-pie").forEach(el =>
    el.classList.toggle("is-active", el.dataset.route === CURRENT));
  const pie = document.querySelector(".nav-pie");
  if (pie) pie.classList.toggle("is-active", ["recompensas", "tienda", "insignias"].includes(CURRENT));
  const mas = document.getElementById("bbMas");
  if (mas) mas.classList.toggle("is-active", !BOTTOM_NAV.includes(CURRENT));
  // En computador, abrir "Módulos" si estás en uno de ellos
  const mods = document.getElementById("navMods");
  if (mods && ROUTE_MAP[CURRENT] && ROUTE_MAP[CURRENT].mas) mods.open = true;
}

/* -------- Hoja "Más" (móvil) -------- */
/* Módulos que no están en la barra inferior, en el orden del menú (sin los ocultos) */
function modulosMas() {
  return ROUTES.filter(r => r.id && !r.pie && !BOTTOM_NAV.includes(r.id) && !moduloOculto(r.id));
}
const PIE_MAS = [
  { ruta: "recompensas", label: "Recompensas" },
  { ruta: "cuenta", label: "Cuenta" },
  { ruta: "notif", label: "Notificaciones" },
  { ruta: "tutoriales", label: "Ayuda" },
];
function openMas() {
  const ov = document.getElementById("masOverlay");
  if (!ov) return;
  const mods = modulosMas().map(r => `<button class="mas-mod${r.id === CURRENT ? " is-active" : ""}" data-route="${r.id}">${iconoLinea(r.id, 26)}<span>${r.label.replace("Salud y bienestar", "Salud").replace("Rueda de la vida", "Rueda")}</span></button>`).join("");
  const pie = PIE_MAS.map(p => `<button class="mas-fila" data-route="${p.ruta}">${iconoLinea(p.ruta, 22)}<span>${p.label}</span>${p.ruta === "recompensas" ? `<b class="mas-pts">${STATE.gamif.puntos} ⭐</b>` : ""}</button>`).join("");
  ov.querySelector(".sheet").innerHTML = `
    <div class="sheet__asa" aria-hidden="true"></div>
    <div class="sheet__head"><h2>Más</h2><button class="sheet__x" data-action="mas-cerrar" aria-label="Cerrar">${iconoLinea("cerrar", 22)}</button></div>
    <div class="mas-grid">${mods}<button class="mas-mod mas-mod--sutil" data-action="menu-personalizar">${iconoLinea("personalizar", 26)}<span>Personalizar</span></button></div>
    <div class="sheet__sep"></div>
    ${pie}`;
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add("is-open"));
  document.body.classList.add("nav-open");
}
function cerrarMas() {
  const ov = document.getElementById("masOverlay");
  if (!ov || ov.hidden) return;
  ov.classList.remove("is-open");
  ov.hidden = true;
  const sh = ov.querySelector(".sheet"); if (sh) sh.style.transform = "";
  document.body.classList.remove("nav-open");
}
function initHojaMas() {
  const ov = document.getElementById("masOverlay");
  if (!ov) return;
  ov.addEventListener("click", e => { if (e.target === ov) cerrarMas(); });
  const sh = ov.querySelector(".sheet");
  let y0 = 0, dy = 0, arrastra = false;
  sh.addEventListener("touchstart", e => { if (e.touches.length !== 1 || sh.scrollTop > 0) return; y0 = e.touches[0].clientY; dy = 0; arrastra = true; sh.style.transition = "none"; }, { passive: true });
  sh.addEventListener("touchmove", e => { if (!arrastra) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = dy ? `translateY(${dy}px)` : ""; }, { passive: true });
  const fin = () => { if (!arrastra) return; arrastra = false; sh.style.transition = ""; sh.style.transform = ""; if (dy > 100) cerrarMas(); };
  sh.addEventListener("touchend", fin, { passive: true });
  sh.addEventListener("touchcancel", fin, { passive: true });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { cerrarMas(); cerrarMenuCuenta(); } });
}

/* -------- Menú de cuenta (computador) -------- */
function toggleMenuCuenta() {
  const m = document.getElementById("cuentaMenu");
  if (!m) return;
  const abrir = m.hidden;
  m.hidden = !abrir;
  const b = document.getElementById("cuentaBtn");
  if (b) b.setAttribute("aria-expanded", abrir ? "true" : "false");
}
function cerrarMenuCuenta() {
  const m = document.getElementById("cuentaMenu");
  if (m && !m.hidden) toggleMenuCuenta();
}
document.addEventListener("click", e => {
  const m = document.getElementById("cuentaMenu");
  if (m && !m.hidden && !e.target.closest("#cuentaMenu, #cuentaBtn, .account__info")) cerrarMenuCuenta();
});
function pintarPieNav() {
  const pts = document.getElementById("navPts");
  if (pts && STATE) pts.textContent = STATE.gamif.puntos + " ⭐";
}

/* -------- Pestañas de Recompensas: Progreso · Tienda · Insignias -------- */
function tabsRecompensas() {
  const t = (ruta, txt) => `<button class="tabs__b${CURRENT === ruta ? " is-active" : ""}" role="tab" aria-selected="${CURRENT === ruta}" data-route="${ruta}">${txt}</button>`;
  return `<div class="tabs" role="tablist" aria-label="Recompensas">${t("recompensas", "Progreso")}${t("tienda", "Tienda")}${t("insignias", "Insignias")}</div>`;
}

/* -------- Rachas y monedas: qué significa cada una -------- */
function openInfoRachas() {
  const cerr = computeClosedStreak(), hab = computeStreak();
  const rit = computeRitualStreak();
  const fila = (ico, n, txt, sub) => `<div class="info-racha"><span class="info-racha__ico">${ico}</span>
    <div><div class="info-racha__n"><b>${n}</b> ${txt}</div><div class="text-sm muted">${sub}</div></div></div>`;
  openModal("Tus rachas y monedas", `
    ${fila("🔥", cerr, cerr === 1 ? "día cerrado seguido" : "días cerrados seguidos", "Días seguidos en que abriste y cerraste tu día. Es la racha principal.")}
    ${fila("✅", hab, hab === 1 ? "día de hábitos" : "días de hábitos", "Días seguidos cumpliendo todos los hábitos que tocaban.")}
    ${fila("🌅", rit, rit === 1 ? "día abierto seguido" : "días abiertos seguidos", "Días seguidos en que hiciste tu ritual de apertura.")}
    ${fila("⭐", STATE.gamif.puntos, "monedas", "Las ganas usando Rumbo y las gastas en Recompensas → Tienda.")}
    <button class="btn btn--soft btn-block mt-16" data-route="recompensas">Ver Recompensas</button>`);
}

/* -------- Botón de compra: si no alcanzan las ⭐, dice cuánto falta (y no invita a tocar) -------- */
function botonCompra(costo, attrs, texto = "Comprar", clase = "btn-block") {
  const saldo = (STATE && STATE.gamif.puntos) || 0;
  if (saldo >= costo) return `<button class="btn btn--linea ${clase}" ${attrs}>${texto} · ${costo} ⭐</button>`;
  const pct = Math.max(0, Math.min(100, Math.round((saldo / costo) * 100)));
  return `<div class="falta ${clase}"><div class="falta__bar"><i style="width:${pct}%"></i></div>
    <button class="btn btn--falta btn-block" disabled>Te faltan ${costo - saldo} ⭐${saldo > 0 ? ` de ${costo}` : ""}</button></div>`;
}
