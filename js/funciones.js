/* ============================================================
   RUMBO · Funciones de la Tienda (se desbloquean una vez y quedan para siempre)
   🔮 Pronóstico de la semana · 📊 Comparar meses · 🗂️ Informe del año
   📋 Plantillas de rutina · 🔔 Recordatorio de mediodía · 🎨 Packs de íconos

   La compra es un movimiento "compra:fun-<id>" del ledger (se paga una sola vez,
   también entre dispositivos). El modo enfoque (600 ⭐ hasta la v139) ahora es el Foco, gratis:
   quien lo compró recibe el reloj de arena y la lluvia (focoRegalo en state.js).
   ============================================================ */

const FUNCIONES = [
  { id: "pronostico", icon: "🔮", nombre: "Pronóstico de la semana", costo: 400,
    desc: "Te avisa qué días de la semana quedaron sobrecargados según tu capacidad real y tus reuniones de Google Calendar.",
    donde: "Semana y ritual semanal" },
  { id: "comparar", icon: "📊", nombre: "Comparar meses", costo: 500,
    desc: "Pones dos meses lado a lado: tareas, hábitos, postergación, ánimo y ahorro.",
    donde: "Tendencias" },
  { id: "informe-anio", icon: "🗂️", nombre: "Informe del año", costo: 400,
    desc: "Tu año completo en una imagen para guardar o compartir: días cerrados, hábitos, metas, libros y tu mejor mes.",
    donde: "Tendencias → Tu evolución (en diciembre, y cuando quieras para años anteriores)" },
];
/* El "Recordatorio de mediodía" se vendía aquí (300 ⭐) hasta la v73: ahora es gratis en
   🔔 Notificaciones, con el resto de los avisos opcionales (ver retirarFunciones en state.js). */
/* Plantillas de rutina: hábitos + tareas recurrentes ya armados (200 ⭐ cada una) */
const PLANTILLAS = [
  { id: "manana", icon: "🌅", nombre: "Mañana productiva", costo: 200,
    habitos: [["🛏️", "Hacer la cama", { tipo: "diario" }], ["💧", "Vaso de agua al despertar", { tipo: "diario" }], ["🧘", "Meditar 10 minutos", { tipo: "diario" }], ["📖", "Leer 20 minutos", { tipo: "diario" }]],
    recurrentes: [["Revisar la agenda del día", "pro", { tipo: "semanal", dias: [0, 1, 2, 3, 4] }]] },
  { id: "salud", icon: "💪", nombre: "Salud y deporte", costo: 200,
    habitos: [["🏃", "Entrenar", { tipo: "semanal", veces: 3 }], ["🥗", "Comer sano", { tipo: "diario" }], ["💧", "Tomar 2 litros de agua", { tipo: "diario" }], ["😴", "Dormir 7 horas", { tipo: "diario" }]],
    recurrentes: [["Preparar las comidas de la semana", "per", { tipo: "semanal", dias: [6] }]] },
  { id: "estudio", icon: "🎓", nombre: "Estudio", costo: 200,
    habitos: [["📚", "Estudiar 45 minutos", { tipo: "dias", dias: [0, 1, 2, 3, 4] }], ["✏️", "Repasar apuntes", { tipo: "semanal", veces: 3 }], ["📵", "Estudiar sin celular", { tipo: "diario" }]],
    recurrentes: [["Planificar la semana de estudio", "per", { tipo: "semanal", dias: [0] }]] },
  { id: "finanzas", icon: "💰", nombre: "Finanzas personales", costo: 200,
    habitos: [["🧾", "Anotar mis gastos", { tipo: "diario" }], ["🚫", "Día sin compras", { tipo: "semanal", veces: 2 }]],
    recurrentes: [["Revisar los gastos de la semana", "per", { tipo: "semanal", dias: [6] }], ["Transferir al ahorro", "per", { tipo: "mensual", dia: 1 }], ["Pagar las cuentas del mes", "per", { tipo: "mensual", dia: 5 }]] },
];
/* Packs de íconos para hábitos (150 ⭐ cada uno, 24 íconos) */
const PACKS_ICONOS = [
  { id: "deporte", icon: "🏅", nombre: "Deporte", costo: 150, iconos: ["🏋️", "🏃", "🚴", "🏊", "⛹️", "🤸", "🧗", "🥊", "⚽", "🏀", "🎾", "🏐", "🏓", "🥋", "⛷️", "🏄", "🚣", "🤾", "🏌️", "🧘", "🥾", "🛹", "⛸️", "🤺"] },
  { id: "estudio", icon: "🎓", nombre: "Estudio", costo: 150, iconos: ["📚", "📖", "✏️", "📝", "📐", "🧮", "🔬", "🧪", "🌍", "🗣️", "🎓", "💡", "🧠", "📓", "🖊️", "📊", "💻", "⌨️", "🎧", "🗂️", "📅", "🔤", "🎹", "🎨"] },
  { id: "hogar", icon: "🏠", nombre: "Hogar", costo: 150, iconos: ["🧹", "🧺", "🧽", "🛏️", "🍳", "🪴", "🐕", "🐈", "🧾", "🔧", "🪛", "🛒", "🍽️", "🚿", "🗑️", "🧴", "🪟", "🛋️", "🧸", "👕", "🔑", "📦", "🌱", "🕯️"] },
  { id: "bienestar", icon: "🌿", nombre: "Bienestar", costo: 150, iconos: ["🧘", "💧", "🍎", "🥗", "😴", "🌞", "🚶", "🙏", "💊", "🫖", "🛁", "📵", "🌿", "😊", "❤️", "🎵", "🌙", "🤝", "✨", "🍵", "🥦", "🧃", "🌳", "🕊️"] },
];

function funcion(id, S) { S = S || STATE; return ((S.gamif && S.gamif.owned) || []).includes("fun-" + id); }
function itemFuncion(fid) {
  const [tipo, id] = fid.split(":");
  if (tipo === "fun") return FUNCIONES.find(f => f.id === id);
  if (tipo === "plantilla") { const p = PLANTILLAS.find(x => x.id === id); return p && { ...p, nombre: "Plantilla " + p.nombre }; }
  if (tipo === "iconos") { const p = PACKS_ICONOS.find(x => x.id === id); return p && { ...p, nombre: "Íconos " + p.nombre }; }
  return null;
}
/* fid: "fun:enfoque" | "plantilla:salud" | "iconos:deporte" → compra "fun-enfoque" | "fun-plantilla-salud" | "fun-iconos-deporte" */
function claveFuncion(fid) { const [tipo, id] = fid.split(":"); return tipo === "fun" ? id : tipo + "-" + id; }
function comprarFuncion(fid) {
  const it = itemFuncion(fid); if (!it) return false;
  const clave = claveFuncion(fid);
  if (funcion(clave)) return true;
  recalcGamif(STATE);
  if (STATE.gamif.puntos < it.costo) { toast("Te faltan " + (it.costo - STATE.gamif.puntos) + " ⭐", true); return false; }
  if (!confirm(`¿Desbloquear "${it.nombre}" por ${it.costo} estrellas?\nTe quedarán ${STATE.gamif.puntos - it.costo}.`)) return false;
  const res = ledgerComprar(STATE, "fun-" + clave, it.costo);
  if (!res.ok && !res.yaTenia) { toast("Te faltan " + res.falta + " ⭐", true); return false; }
  saveState(); updateTopbar(); rerender();
  if (fid.startsWith("plantilla:")) openPlantillas();   // comprada desde su lista: queda lista para aplicar
  toast(`${it.icon} ${it.nombre} desbloqueado`);
  return true;
}
/* Si no la tiene, ofrece comprarla (para los botones que aparecen en otras pantallas) */
function asegurarFuncion(fid) { return funcion(claveFuncion(fid)) || comprarFuncion(fid); }

/* ⏱️ El modo enfoque pasó a ser el Foco (gratis): foco.js, foco-pantalla.js y foco-amigos.js (v140) */
function compararElegir(v, btn, cont) { COMPARAR[String(cont.dataset.elId).slice(4)] = v; rerender(); }

/* ============================================================
   🔮 PRONÓSTICO DE LA SEMANA
   Capacidad del día = tu promedio real de tareas hechas (últimos 14 días; 5 si aún no hay datos),
   descontando las horas de reuniones de Google Calendar (jornada de 8 horas).
   ============================================================ */
function horasReunion(iso) {
  const ev = typeof gcalEventosDia === "function" ? gcalEventosDia(iso) : [];
  const min = t => { const [h, m] = String(t || "").split(":").map(Number); return h * 60 + (m || 0); };
  return ev.filter(e => !e.todoDia && e.hora && e.horaFin).reduce((a, e) => a + Math.max(0, min(e.horaFin) - min(e.hora)) / 60, 0);
}
function pronosticoDia(iso, S, cap) {
  S = S || STATE;
  const base = cap && cap.hechasProm ? cap.hechasProm : 5;
  const reun = horasReunion(iso);
  const capacidad = Math.max(1, Math.round(base * (1 - Math.min(0.75, reun / 8)) * 10) / 10);
  const tareas = tareasDelDia(iso, S).filter(t => ["pendiente", "hecha"].includes(estadoTarea(t))).length;
  const nivel = diaLibre(S, iso) ? "libre" : tareas > capacidad * 1.25 ? "sobrecargado" : tareas > capacidad ? "justo" : "ok";
  return { iso, tareas, capacidad, reun: Math.round(reun * 10) / 10, nivel };
}
function pronosticoSemana(L, S) {
  S = S || STATE;
  const cap = tmCapacidad(S, todayISO()), hoy = todayISO();
  return Array.from({ length: 7 }, (_, i) => agSumar(L, i)).filter(iso => iso >= hoy).map(iso => pronosticoDia(iso, S, cap));
}
function chipPronostico(p) {
  if (!p) return "";
  if (p.nivel === "libre") return `<span class="chip">🌴 libre</span>`;
  const t = `${p.tareas} de ~${String(p.capacidad).replace(".", ",")}${p.reun ? ` · ${String(p.reun).replace(".", ",")} h reuniones` : ""}`;
  return p.nivel === "sobrecargado" ? `<span class="chip chip--coral" title="Tareas planificadas vs. tu capacidad">🔮 ${t}</span>`
    : p.nivel === "justo" ? `<span class="chip" title="Tareas planificadas vs. tu capacidad">🔮 justo · ${t}</span>` : "";
}
function renderPronosticoSemana(L) {
  if (!funcion("pronostico")) return "";
  const ps = pronosticoSemana(L); if (!ps.length) return "";
  const sobre = ps.filter(p => p.nivel === "sobrecargado");
  const nombres = sobre.map(p => DIAS_SEMANA[(agDate(p.iso).getDay() + 6) % 7].toLowerCase());
  const cap = tmCapacidad(STATE, todayISO());
  return `<div class="card mt-16 pronostico ${sobre.length ? "is-warn" : ""}"><div class="card__title" style="font-size:15px">🔮 Pronóstico de la semana</div>
    <p class="text-sm soft mt-8">${sobre.length ? `Ojo: <b>${nombres.join(", ")}</b> ${sobre.length === 1 ? "quedó sobrecargado" : "quedaron sobrecargados"}. Mueve algo a un día más liviano o suelta lo que no es clave.` : "Tu semana está dentro de tu capacidad. 👌"}</p>
    <p class="text-xs muted mt-8">${cap ? `Tu capacidad real: ~${String(cap.hechasProm).replace(".", ",")} tareas al día` : "Aún no hay datos de tu capacidad: se usa 5 tareas al día"}${gcalConectado() ? ", menos tus reuniones de Google Calendar." : "."}</p></div>`;
}

/* ============================================================
   📊 COMPARAR MESES (en Tendencias)
   ============================================================ */
let COMPARAR = null;   // { a: "YYYY-MM", b: "YYYY-MM" }
function datosComparar(key, S) {
  S = S || STATE;
  const { y, m } = mesDeKey(key), r = resumenMes(y, m);
  const desde = isoLocal(new Date(y, m, 1)), hasta = isoLocal(new Date(y, m + 1, 0));
  const tm = tmResumen(S, desde, hasta);
  const moods = (S.vida.diario || []).filter(e => e.mood && e.fecha >= desde && e.fecha <= hasta).map(e => e.mood);
  return {
    cerrados: r.cerrados, habitos: r.habitos, tareas: tm.tareas ? tm.hechas : null, cumpl: tm.cumplimiento,
    postergacion: r.postergacion, animo: moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    ahorro: (r.ahorro || r.metaAhorro) ? r.ahorro : null, bocados: r.bocados, libros: r.libros,
    foco: sesionesEnfoque(S).some(x => x && !x.borrada) ? Math.round(minutosFoco(S, desde, hasta)) : null,
  };
}
function renderCompararMeses() {
  const hoy = agDate(todayISO());
  const keys = Array.from({ length: 24 }, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return mesKey(d.getFullYear(), d.getMonth()); });
  if (!funcion("comparar")) return `<div class="card mt-24 locked-card"><div class="flex-between" style="gap:12px;flex-wrap:wrap">
    <div><div class="card__title">${icoHab("📊", 16)} Comparar meses</div><div class="text-sm muted mt-8">Pon dos meses lado a lado: tareas, hábitos, postergación, ánimo y ahorro.</div></div>
    <button class="btn btn--primary" data-action="fun-buy" data-id="fun:comparar">Desbloquear · 500 ⭐</button></div></div>`;
  COMPARAR = COMPARAR || { a: keys[0], b: keys[1] };
  const nom = k => { const { y, m } = mesDeKey(k); return `${MESES[m]} ${y}`; };
  const sel = (lado) => elLista("cmp-" + lado, keys.map(k => ({ v: k, t: nom(k) })), COMPARAR[lado], { hoja: true, label: lado === "a" ? "Primer mes" : "Segundo mes", fn: "compararElegir" });
  const A = datosComparar(COMPARAR.a), B = datosComparar(COMPARAR.b);
  const fila = (ico, label, k, fmt, mejorAlto = true) => {
    const a = A[k], b = B[k]; if (a == null && b == null) return "";
    let flecha = "";
    if (a != null && b != null && a !== b) flecha = (a > b) === mejorAlto ? '<span class="hl-cian">▲</span>' : '<span style="color:var(--coral)">▼</span>';
    return `<tr><td>${icoHab(ico, 14)} ${label}</td><td><b>${a == null ? "—" : fmt(a)}</b> ${flecha}</td><td>${b == null ? "—" : fmt(b)}</td></tr>`;
  };
  const pct = v => v + "%", num = v => String(v).replace(".", ",");
  return `<div class="section-title">${icoHab("📊", 16)} Comparar meses</div>
  <div class="card"><div class="row" style="gap:10px;flex-wrap:wrap">${sel("a")}<span class="muted">vs</span>${sel("b")}</div>
    <table class="tabla-comparar mt-16"><thead><tr><th></th><th>${nom(COMPARAR.a)}</th><th>${nom(COMPARAR.b)}</th></tr></thead><tbody>
      ${fila("🌙", "Días cerrados", "cerrados", num)}
      ${fila("📊", "Hábitos", "habitos", pct)}
      ${fila("📋", "Tareas hechas", "tareas", num)}
      ${fila("✅", "Cumplimiento de tareas", "cumpl", pct)}
      ${fila("↪", "Postergación", "postergacion", pct, false)}
      ${fila(BOCADO.emoji, "Primeros bocados", "bocados", num)}
      ${fila("😊", "Ánimo promedio", "animo", num)}
      ${fila("💰", "Ahorro", "ahorro", fmtCLP)}
      ${fila("📚", "Libros terminados", "libros", num)}
      ${fila("⏱️", "Foco", "foco", fmtFoco)}
    </tbody></table>
    <p class="text-xs muted mt-8">▲ mejor · ▼ peor que el mes de la derecha.</p></div>`;
}

/* ============================================================
   🗂️ INFORME DEL AÑO (imagen para compartir, usa el dibujo del informe del mes)
   ============================================================ */
function informeAnioDisponible(y) { const h = agDate(todayISO()); return y < h.getFullYear() || (y === h.getFullYear() && h.getMonth() === 11); }
function datosInformeAnio(y) {
  const r = resumenAnio(STATE, y);
  return {
    y, mes: String(y), etiqueta: "MI AÑO", sub: "Mi año", nombre: (STATE.profile && STATE.profile.name) || "",
    foco: "", mejor: "", nota: r.nota, notaLabel: "nota del año", cerrado: true,
    tarjetas: [
      { v: String(r.cerrados), l: "días cerrados", c: "cian" },
      { v: r.habitos == null ? "—" : r.habitos + "%", l: "hábitos cumplidos", c: "cian" },
      { v: r.trimestrales[1] ? `${r.trimestrales[0]}/${r.trimestrales[1]}` : "—", l: "metas del trimestre", c: "coral" },
      { v: r.objetivos[1] ? `${r.objetivos[0]}/${r.objetivos[1]}` : "—", l: "objetivos del mes", c: "coral" },
      { v: r.libros ? String(r.libros) : "—", l: "libros terminados", c: "cian" },
      { v: r.mejorMes ? MESES[r.mejorMes.m] : "—", l: "tu mejor mes", c: "coral" },
    ],
    ahorro: r.ahorro,
  };
}
function openInformeAnio(y) {
  if (!asegurarFuncion("fun:informe-anio")) return;
  if (!informeAnioDisponible(y)) return toast(`El informe de ${y} se abre en diciembre`, true);
  openInformeMes("anio:" + y);
}

/* ============================================================
   📋 PLANTILLAS DE RUTINA
   ============================================================ */
function aplicarPlantilla(S, pid, hoy) {
  const p = PLANTILLAS.find(x => x.id === pid); if (!p) return { habitos: 0, tareas: 0 };
  hoy = hoy || todayISO();
  const nombres = new Set((S.habitos.defs || []).map(h => h.nombre.trim().toLowerCase()));
  let nh = 0, nr = 0;
  p.habitos.forEach(([icon, nombre, frecuencia]) => {
    if (nombres.has(nombre.toLowerCase())) return;
    S.habitos.defs.push({ id: uid(), nombre, icon, frecuencia: JSON.parse(JSON.stringify(frecuencia)), creado: hoy, ts: Date.now() });
    nh++;
  });
  const txts = new Set(recurrentes(S).filter(r => !r.borrada).map(r => r.txt.trim().toLowerCase()));
  p.recurrentes.forEach(([txt, ambito, regla]) => {
    if (txts.has(txt.toLowerCase())) return;
    crearRecurrente(S, { txt, ambito, regla: JSON.parse(JSON.stringify(regla)), desde: hoy });
    nr++;
  });
  return { habitos: nh, tareas: nr };
}
function openPlantillas() {
  const txtFreq = f => hmFreqLabel({ frecuencia: f });
  openModal("📋 Plantillas de rutina", `
    <p class="text-sm soft">Hábitos y tareas recurrentes ya armados para partir rápido. Se agregan a los tuyos (no se repiten) y después puedes editarlos.</p>
    ${PLANTILLAS.map(p => {
      const tiene = funcion("plantilla-" + p.id);
      return `<div class="card mt-16"><div class="flex-between" style="gap:10px"><div class="card__title" style="font-size:15px">${p.icon} ${p.nombre}</div>
        ${tiene ? `<button class="btn btn--cian" data-action="plantilla-aplicar" data-id="${p.id}">Aplicar</button>` : botonCompra(200, `data-action="fun-buy" data-id="plantilla:${p.id}"`, "Desbloquear", "")}</div>
        <div class="text-xs muted mt-8">${p.habitos.map(([i, n, f]) => `${i} ${n} <span class="muted">(${txtFreq(f)})</span>`).join(" · ")}</div>
        <div class="text-xs muted mt-8">🔁 ${p.recurrentes.map(([t, , r]) => `${t} <span class="muted">(${textoRegla(r).toLowerCase()})</span>`).join(" · ")}</div></div>`;
    }).join("")}`);
}
function aplicarPlantillaUI(pid) {
  const r = aplicarPlantilla(STATE, pid);
  saveState(); closeModal(); rerender();
  toast(r.habitos || r.tareas ? `📋 Listo: ${r.habitos} hábitos y ${r.tareas} tareas recurrentes` : "Ya tenías todo lo de esta plantilla");
}

/* ============================================================
   🎨 PACKS DE ÍCONOS (se suman al selector de íconos de hábitos)
   ============================================================ */
function iconosExtra() { return PACKS_ICONOS.filter(p => funcion("iconos-" + p.id)).flatMap(p => p.iconos); }

/* ============================================================
   Tienda: sección Funciones
   ============================================================ */
/* Tarjeta de una función (también es el detalle de su ficha en la Tienda) */
function funcionCard(fid, it, extra) {
  const tiene = funcion(claveFuncion(fid));
  return `<div class="card util-card" data-fun="${fid}">
    <div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">${it.icon}</span>
      <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${it.nombre}</div>
        <div class="text-xs muted">${tiene ? '<b class="hl-cian">✓ Desbloqueada</b>' : it.costo + " ⭐ · una vez"}</div></div></div>
    <p class="text-sm soft mt-8">${it.desc}</p>
    ${it.donde ? `<p class="text-xs muted mt-8">📍 ${it.donde}</p>` : ""}${extra || ""}
    ${tiene ? "" : botonCompra(it.costo, `data-action="fun-buy" data-id="${fid}"`, "Desbloquear", "btn-block mt-8")}
  </div>`;
}
function renderFuncionesTienda() {
  const card = funcionCard;
  const plantillas = { icon: "📋", nombre: "Plantillas de rutina", costo: 200, desc: "Hábitos y tareas recurrentes ya armados: " + PLANTILLAS.map(p => p.nombre).join(", ") + ".", donde: "Hábitos → 📋 Plantillas" };
  const packs = `<div class="row-wrap mt-8" style="gap:6px">${PACKS_ICONOS.map(p => funcion("iconos-" + p.id)
    ? `<span class="chip chip--cian">${icoHab(p.icon, 15)} ${p.nombre} ✓</span>`
    : `<button class="chip" data-action="fun-buy" data-id="iconos:${p.id}">${icoHab(p.icon, 15)} ${p.nombre} · 150 ⭐</button>`).join("")}</div>`;
  return `<div class="section-title">⚙️ Funciones <span class="text-xs muted" style="text-transform:none;letter-spacing:0">· se desbloquean una vez y quedan para siempre</span></div>
    <div class="grid grid-3">
      ${FUNCIONES.map(f => card("fun:" + f.id, f)).join("")}
      <div class="card util-card"><div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">📋</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">${plantillas.nombre}</div><div class="text-xs muted">200 ⭐ cada una</div></div></div>
        <p class="text-sm soft mt-8">${plantillas.desc}</p><p class="text-xs muted mt-8">📍 ${plantillas.donde}</p>
        <button class="btn btn--soft btn-block mt-8" data-action="plantillas-open">Ver plantillas</button></div>
      <div class="card util-card"><div class="row" style="gap:10px;align-items:flex-start"><span class="util-ico">🎨</span>
        <div style="flex:1;min-width:0"><div class="card__title" style="font-size:14px">Packs de íconos</div><div class="text-xs muted">150 ⭐ cada pack · 24 íconos</div></div></div>
        <p class="text-sm soft mt-8">Más íconos de línea para tus hábitos.</p>${packs}</div>
    </div>`;
}
