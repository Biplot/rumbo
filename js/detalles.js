/* ============================================================
   RUMBO · Detalles (v79): lo que hace que una app se sienta bien.
   Respuesta al tacto (vibración), monedas que suben, deshacer en
   vez de perder, ventanas que se arrastran para cerrar, la racha
   que sube al llegar y la imagen de tu día para compartir.
   Se carga antes de app.js; usa sus funciones al momento de llamar.
   ============================================================ */

function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
/* Un toque corto en el celular (Android); en los demás no hace nada */
function vibrar(patron = 10) {
  if (reduceMotion() || !navigator.vibrate) return;
  try { navigator.vibrate(patron); } catch (e) {}
}

/* -------- Monedas: al ganarlas, el contador sube y un "+N" flota sobre la píldora --------
   ganado: monedas recién ganadas (solo entonces se anima; una sincronización no "regala" nada) */
let PTS_MOSTRADOS = null;
function pintarMonedas(n, ganado) {
  const el = document.getElementById("ptsVal");
  if (!el) return;
  if (!ganado && n === PTS_MOSTRADOS) return;   // ya va subiendo hacia este número
  const antes = PTS_MOSTRADOS;
  PTS_MOSTRADOS = n;
  if (!ganado || antes == null || n <= antes || reduceMotion()) { el.textContent = n; return; }
  const t0 = performance.now(), dur = 650;
  const paso = t => {
    if (PTS_MOSTRADOS !== n) return;   // llegó otro cambio: manda el más nuevo
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = k < 1 ? Math.round(antes + (n - antes) * (1 - Math.pow(1 - k, 3))) : n;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  setTimeout(() => { if (PTS_MOSTRADOS === n) el.textContent = n; }, dur + 80);   // por si la pestaña está en segundo plano
  const pill = document.getElementById("ptsPill");
  if (!pill) return;
  pill.classList.remove("is-gana"); void pill.offsetWidth; pill.classList.add("is-gana");
  const f = document.createElement("span");
  f.className = "pts-flota"; f.textContent = "+" + ganado; f.setAttribute("aria-hidden", "true");
  pill.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}
/* ¿Se ve la píldora de monedas? (entonces el "+N" basta y no hace falta el aviso de abajo) */
function monedasALaVista() {
  const pill = document.getElementById("ptsPill");
  return !!(pill && pill.offsetParent && !reduceMotion());
}

/* -------- Aviso con acción (Deshacer), como en las apps de correo -------- */
function toastAccion(msg, etiqueta, alTocar) {
  const t = document.getElementById("toast");
  t.innerHTML = `<span>${escapeHtml(msg)}</span><button type="button" class="toast__acc">${escapeHtml(etiqueta)}</button>`;
  t.className = "toast toast--accion"; t.hidden = false;
  t.querySelector(".toast__acc").onclick = () => { clearTimeout(toastTimer); t.hidden = true; alTocar(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 5000);
}

/* -------- Ventanas del celular: se arrastran hacia abajo para cerrarlas -------- */
function initArrastreVentana() {
  const m = document.getElementById("modal");
  if (!m) return;
  let y0 = 0, dy = 0, arrastra = false;
  m.addEventListener("touchstart", e => {
    arrastra = false;
    if (!isMobileView() || ONB_ACTIVE || e.touches.length !== 1 || m.scrollTop > 0 || isFormEl(e.target)) return;
    y0 = e.touches[0].clientY; dy = 0; arrastra = true;
  }, { passive: true });
  m.addEventListener("touchmove", e => {
    if (!arrastra) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || m.scrollTop > 0) { m.style.transform = ""; return; }
    m.style.transition = "none";
    m.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  const fin = () => {
    if (!arrastra) return;
    arrastra = false;
    m.style.transition = ""; m.style.transform = "";
    if (dy > 110) closeModal();
  };
  m.addEventListener("touchend", fin, { passive: true });
  m.addEventListener("touchcancel", fin, { passive: true });
}

/* -------- Al cambiar de sección, la pantalla entra suave -------- */
function entrarVista() {
  const v = document.getElementById("view");
  if (!v || reduceMotion()) return;
  v.classList.remove("view-entra"); void v.offsetWidth; v.classList.add("view-entra");
}

/* -------- Al cerrar el día, tu racha sube frente a ti -------- */
function animarRacha() {
  const el = document.querySelector("#view .recibo__n");
  if (!el) return;
  const n = +el.dataset.n;
  if (!(n > 0) || reduceMotion()) return;
  el.textContent = n - 1;
  setTimeout(() => { el.textContent = n; el.classList.add("is-sube"); }, 450);
}

/* -------- Compartir tu día: una imagen vertical (historias) con tu racha -------- */
async function imagenDelDia() {
  const iso = todayISO(), r = STATE.ritual.dias[iso] || {}, c = r.cierre || {};
  const racha = computeClosedStreak();
  const s = dayAutoSummary();
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  try { await Promise.all(["800 300px 'Inter Tight'", "700 60px 'Inter Tight'", "600 40px 'Inter Tight'"].map(f => document.fonts.load(f))); } catch (e) {}
  const F = (w, px) => `${w} ${px}px 'Inter Tight', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const CORAL = "#E8563A", GRIS = "#A9A9AE";
  g.fillStyle = "#0B0B0C"; g.fillRect(0, 0, W, H);
  // Marca
  g.fillStyle = "#FFFFFF"; g.font = F(800, 72); g.textBaseline = "alphabetic";
  g.fillText("rumbo", 96, 180);
  g.fillStyle = CORAL; g.beginPath(); g.arc(96 + g.measureText("rumbo").width + 20, 168, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = GRIS; g.font = F(600, 40);
  g.fillText(new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(), 96, 260);
  // El recorrido: de la apertura (arriba) al cierre (abajo), pasando por el primer bocado
  const A = [900, 430], B = [560, 640], C = [190, 880];
  g.strokeStyle = CORAL; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); g.moveTo(A[0], A[1]);
  g.bezierCurveTo(760, 430, 760, 640, B[0], B[1]);
  g.bezierCurveTo(360, 640, 380, 880, C[0], C[1]);
  g.stroke();
  g.fillStyle = "#0B0B0C"; g.strokeStyle = "#FFFFFF"; g.lineWidth = 14;
  g.beginPath(); g.arc(A[0], A[1], 28, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(B[0], B[1], 17, 0, Math.PI * 2); g.fill();
  g.fillRect(C[0] - 30, C[1] - 30, 60, 60);
  g.font = F(600, 36); g.fillStyle = GRIS;
  if (r.abiertoTs) { const t = "Abriste " + horaCorta(r.abiertoTs); g.fillText(t, A[0] + 30 - g.measureText(t).width, A[1] - 62); }
  const tb = tareasDelDia(iso).find(t => t.esSapo);
  if (c.sapo && tb && tb.hechaTs) g.fillText("Primer bocado " + horaCorta(tb.hechaTs), B[0] - 60, B[1] + 78);
  if (r.cerradoTs) g.fillText("Cerraste " + horaCorta(r.cerradoTs), C[0] - 30, C[1] + 92);
  // La racha, en grande
  g.fillStyle = "#FFFFFF"; g.font = F(800, 340);
  g.fillText(String(racha), 84, 1290);
  g.font = F(700, 68);
  g.fillText(racha === 1 ? "día cerrado" : "días cerrados", 96, 1390);
  g.fillText(racha === 1 ? "seguido" : "seguidos", 96, 1470);
  // Tu día en números (sin textos personales: la misión y las notas no salen de tu teléfono)
  const tareas = c.tareas ? [c.tareas.pro[0] + c.tareas.per[0], c.tareas.pro[1] + c.tareas.per[1]] : [s.tareasDone, s.tareasTotal];
  const lineas = [];
  if (tareas[1]) lineas.push(`${tareas[0]} de ${tareas[1]} tareas hechas`);
  if (s.habTotal) lineas.push(`${s.habDone} de ${s.habTotal} hábitos`);
  if (c.sapo) lineas.push("Primer bocado: hecho");
  g.font = F(600, 44); g.fillStyle = "#D4D4D8";
  lineas.slice(0, 3).forEach((t, i) => g.fillText(t, 96, 1580 + i * 66));
  // Pie
  g.fillStyle = "#FFFFFF"; g.font = F(700, 50);
  g.fillText("Tu día tiene rumbo.", 96, 1800);
  g.fillStyle = GRIS; g.font = F(600, 40);
  g.fillText("rumbo.biplot.cl", 96, 1862);
  return new Promise(res => cv.toBlob(res, "image/png"));
}
async function compartirDia() {
  const blob = await imagenDelDia();
  if (!blob) return toast("No se pudo crear la imagen", true);
  const racha = computeClosedStreak();
  const nombre = `rumbo-${todayISO()}.png`;
  const texto = `${racha} ${racha === 1 ? "día cerrado seguido" : "días cerrados seguidos"} con Rumbo · rumbo.biplot.cl`;
  try {
    const file = new File([blob], nombre, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  // Sin la hoja de compartir del teléfono: se descarga la imagen
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Imagen descargada: compártela donde quieras");
}
