/* ============================================================
   RUMBO · Después del plan (planes con amigos, etapa 3)
   · «¿Cómo estuvo?»: desde el día del plan, unas estrellas y una frase. Quedan en tu diario
     (STATE.vida.diario, una entrada con fromPlan), +10 ⭐ la primera vez (ledger
     "plan-recuerdo:<id>") y, si eliges compartirla, la ven los que fueron.
   · La cuenta: quién pagó qué, dividido en partes iguales entre los que elige, y los pagos
     entre amigos que la saldan. Sin pagos dentro de la app: solo la cuenta clara. Tu parte se
     suma, si quieres, al gasto de ese mes en Finanzas (finanzas.planes guarda cuánto se sumó,
     así no se suma dos veces).
   Lo compartido vive en supabase/planes.sql (planes_recuerdos y planes_gastos).
   ============================================================ */

/* -------- Lecturas -------- */
function plPaso(p) { return !!p.fecha && p.fecha < todayISO(); }
/* ¿Ya empezó? Un día pasado, o hoy después de su hora (sin hora: desde las 18:00), para contar cómo estuvo */
function plYaFue(p) {
  if (!p.fecha) return false;
  const hoy = todayISO(); if (p.fecha !== hoy) return p.fecha < hoy;
  const d = new Date(), ahora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return ahora >= (p.hora || "18:00");
}
function plMiRecuerdo(p) { const yo = plYo(p); return (yo && p.recuerdos.find(r => r.id === yo.id)) || null; }
/* ¿Le falta contar cómo estuvo? Fue (o tal vez fue), pasó hace a lo más una semana y no lo ha contado */
function plFaltaComo(p) { return plVa(p) && plPaso(p) && p.fecha >= agSumar(todayISO(), -7) && !plMiRecuerdo(p); }
function plNombreDe(p, uid) { const m = p.miembros.find(x => x.id === uid); return m ? plNombre(m) : "Alguien"; }
/* Cuánto puso (+) o debe (−) cada uno: cada gasto se divide en partes iguales entre los de «para» */
function plSaldos(p) {
  const s = {};
  p.gastos.forEach(g => {
    s[g.user_id] = (s[g.user_id] || 0) + g.monto;
    const parte = g.monto / g.para.length;
    g.para.forEach(u => { s[u] = (s[u] || 0) - parte; });
  });
  Object.keys(s).forEach(k => { s[k] = Math.round(s[k]); });
  return s;
}
/* Quién le paga a quién para quedar a mano: los que deben más, a los que pusieron más */
function plDeudas(p) {
  const s = plSaldos(p);
  const deben = Object.keys(s).filter(k => s[k] < 0).map(k => ({ id: k, n: -s[k] })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const ponen = Object.keys(s).filter(k => s[k] > 0).map(k => ({ id: k, n: s[k] })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  const out = [];
  let i = 0, j = 0;
  while (i < deben.length && j < ponen.length) {
    const m = Math.min(deben[i].n, ponen[j].n);
    if (m >= 1) out.push({ de: deben[i].id, a: ponen[j].id, monto: m });
    deben[i].n -= m; ponen[j].n -= m;
    if (deben[i].n < 1) i++;
    if (ponen[j].n < 1) j++;
  }
  return out;
}
/* Lo que te toca a ti de los gastos (sin contar los pagos): lo que se suma a Finanzas */
function plMiParte(p) {
  const yo = plYo(p); if (!yo) return 0;
  return Math.round(p.gastos.filter(g => !g.pago && g.para.includes(yo.id)).reduce((t, g) => t + g.monto / g.para.length, 0));
}
function plTotal(p) { return Math.round(p.gastos.filter(g => !g.pago).reduce((t, g) => t + g.monto, 0)); }
/* Cuánto debes tú en ese plan (0 si nada) */
function plDebo(p) { const yo = plYo(p); return yo ? plDeudas(p).filter(d => d.de === yo.id).reduce((t, d) => t + d.monto, 0) : 0; }

/* -------- Cómo estuvo -------- */
async function planComoGuardar(id) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p || PLAN.guardando) return;
  const n = parseInt((document.getElementById("pl-como-n") || {}).value, 10) || 0;
  if (!n) return toast("Elige de 1 a 5 estrellas", true);
  const frase = val("pl-como-frase"), compartir = !!(document.getElementById("pl-como-comp") || {}).checked;
  PLAN.guardando = true;
  const r = await BACKEND.planRecordar(id, n, frase, compartir, todayISO()).finally(() => { PLAN.guardando = false; });
  if (r && r.error) return toast(plTextoError(r.error), true);
  plComoAlDiario(p, n, frase);
  closeModal(); vibrar(10);
  if (r.r === "nuevo" && registrarMovimiento("plan-recuerdo:" + id, 10, 10, "Plan con amigos", true)) {
    toast("📔 Guardado en tu diario · +10 ⭐"); refreshPts(10);
  } else toast("📔 Guardado en tu diario");
  await planesCargar(true);
}
/* La entrada del diario del plan: una por plan, en el día en que fue */
function plComoAlDiario(p, estrellas, frase) {
  const d = STATE.vida.diario = STATE.vida.diario || [];
  let e = d.find(x => x.fromPlan === p.id);
  if (!e) { e = { id: uid(), fromPlan: p.id }; d.push(e); }
  Object.assign(e, { fecha: p.fecha, titulo: p.titulo.slice(0, 60), estrellas, texto: frase, con: plCon(p), ts: Date.now() });
  saveState();
}
function plComoEst(n) {
  const i = document.getElementById("pl-como-n"); if (i) i.value = n;
  document.querySelectorAll("#pl-como-est button").forEach(b => b.classList.toggle("on", +b.dataset.n <= n));
}

/* -------- La cuenta -------- */
async function planGastoGuardar(id) {
  if (PLAN.guardando) return;
  const monto = parseNum(val("pl-g-monto")), para = [...document.querySelectorAll("#pl-g-para input:checked")].map(i => i.value);
  if (!(monto > 0)) return toast("¿Cuánto fue? Escribe el monto", true);
  if (!para.length) return toast("Elige entre quiénes se divide", true);
  PLAN.guardando = true;
  const r = await BACKEND.planGasto(id, monto, val("pl-g-detalle"), para, false).finally(() => { PLAN.guardando = false; });
  if (r && r.error) return toast(plTextoError(r.error), true);
  BACKEND.amigosAvisar("plan-gasto", { plan: id, gasto: r.id });
  vibrar(10); toast(`Anotado: ${fmtCLP(monto)}, ${para.length === 1 ? "para 1" : "entre " + para.length}`);
  await planesCargar(true); openPlan(id);
}
async function planPague(id, a, monto) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p) return;
  if (!confirm(`¿Anotar que le pagaste ${fmtCLP(monto)} a ${plNombreDe(p, a)}?`)) return;
  const r = await BACKEND.planGasto(id, monto, "Pago", [a], true);
  if (r && r.error) return toast(plTextoError(r.error), true);
  BACKEND.amigosAvisar("plan-gasto", { plan: id, gasto: r.id });
  vibrar(10); toast(`Anotado: le pagaste ${fmtCLP(monto)} a ${plNombreDe(p, a)}`);
  await planesCargar(true); openPlan(id);
}
async function planGastoBorrar(id, gasto) {
  if (!confirm("¿Borrar este gasto de la cuenta? Se borra para todos.")) return;
  const r = await BACKEND.planGastoBorrar(gasto);
  if (r && r.error) return toast(plTextoError(r.error), true);
  toast("Borrado de la cuenta");
  await planesCargar(true); openPlan(id);
}
/* Tu parte, al gasto del mes del plan en Finanzas (si ya la sumaste, se ajusta a lo que es ahora) */
function plFinanzas(S) { const f = S.finanzas; f.planes = f.planes && typeof f.planes === "object" ? f.planes : {}; return f.planes; }
function plSumarFinanzas(S, p, parte) {
  const reg = plFinanzas(S), antes = reg[p.id], mes = p.fecha.slice(0, 7);
  const mover = (clave, n) => {
    const y = +clave.slice(0, 4), m = +clave.slice(5, 7) - 1, d = datosAnio(S, y, true);
    d.finanzas.meses[m].gasto = Math.max(0, (d.finanzas.meses[m].gasto || 0) + n);
    if (!d.base && typeof tocarAnio === "function") tocarAnio(S, y, "finanzas");
  };
  if (antes) mover(antes.mes, -antes.monto);
  mover(mes, parte);
  reg[p.id] = { monto: parte, mes };
}
function planFinanzas(id) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p || !p.fecha) return;
  const parte = plMiParte(p);
  if (!(parte > 0)) return toast("Todavía no tienes parte en la cuenta", true);
  plSumarFinanzas(STATE, p, parte); saveState();
  toast(`Sumaste ${fmtCLP(parte)} al gasto de ${MESES[+p.fecha.slice(5, 7) - 1].toLowerCase()} en Finanzas`);
  openPlan(id);
}

/* -------- Acciones (pl-… que siguen de planesAccion) -------- */
function planesDespuesAccion(a, d) {
  if (a === "pl-como") return openPlanComo(d.id, parseInt(d.n, 10) || 0);
  if (a === "pl-como-ok") return planComoGuardar(d.id);
  if (a === "pl-gasto") return openPlanGasto(d.id);
  if (a === "pl-gasto-ok") return planGastoGuardar(d.id);
  if (a === "pl-gasto-del") return planGastoBorrar(d.id, parseInt(d.g, 10));
  if (a === "pl-pague") return planPague(d.id, d.a, parseInt(d.m, 10));
  if (a === "pl-finanzas") return planFinanzas(d.id);
}

/* -------- Dibujo -------- */
/* En el detalle del plan: cómo estuvo (desde el día del plan) y la cuenta */
function plDespuesHtml(p) {
  if (!p.fecha || p.cancelado || !plVa(p)) return "";
  const yo = plYo(p), id = escapeHtml(p.id);
  let como = "";
  if (plYaFue(p)) {
    const mio = plMiRecuerdo(p), otros = p.recuerdos.filter(r => r.id !== yo.id);
    como = `<div class="cj-sub mt-8">Cómo estuvo</div>
      ${mio ? `<div class="pl-rec is-mio"><span class="pl-rec__q"><b>Tú</b>${lcEstrellas(mio.estrellas, 14)}</span>${mio.frase ? `<span>«${escapeHtml(mio.frase)}»</span>` : ""}
          <span class="text-xs muted">${mio.compartir ? "Lo ven los que fueron" : "Solo tú (en tu diario)"} · <button type="button" class="btn-link" data-action="pl-como" data-id="${id}">Cambiar</button></span></div>`
        : `<button class="btn btn--primary pl-como-b" data-action="pl-como" data-id="${id}">${icoUI("diario")} ¿Cómo estuvo? · +10 ⭐</button>`}
      ${otros.map(r => { const m = p.miembros.find(x => x.id === r.id) || { nombre: "Alguien" };
        return `<div class="pl-rec">${amigosAvatar(m, 26)}<span class="pl-rec__q"><b>${escapeHtml(plNombre(m))}</b>${lcEstrellas(r.estrellas, 13)}</span>${r.frase ? `<span>«${escapeHtml(r.frase)}»</span>` : ""}</div>`; }).join("")}`;
  }
  const deudas = plDeudas(p), parte = plMiParte(p), sumado = plFinanzas(STATE)[p.id];
  const n = uid => escapeHtml(plNombreDe(p, uid)), de = g => (g.detalle ? " " + escapeHtml(g.detalle) : "");
  const gastos = p.gastos.map(g => `<div class="pl-gasto"><span class="pl-gasto__t"><b>${g.pago
      ? (g.user_id === yo.id ? `Le pagaste a ${n(g.para[0])}` : g.para[0] === yo.id ? `${n(g.user_id)} te pagó` : `${n(g.user_id)} le pagó a ${n(g.para[0])}`)
      : (g.user_id === yo.id ? `Pagaste${de(g)}` : `${n(g.user_id)} pagó${de(g)}`)}</b>
      ${g.pago ? "" : `<small>${g.para.length === 1 ? "para " + (g.para[0] === yo.id ? "ti" : n(g.para[0])) : "entre " + g.para.length + " · " + fmtCLP(Math.round(g.monto / g.para.length)) + " c/u"}</small>`}</span>
      <b class="pl-gasto__m">${fmtCLP(g.monto)}</b>
      ${g.user_id === yo.id ? `<button type="button" class="am-x" data-action="pl-gasto-del" data-id="${id}" data-g="${g.id}" aria-label="Borrar este gasto" title="Borrar">${icoUI("x")}</button>` : "<span></span>"}</div>`).join("");
  const resumen = deudas.length ? deudas.map(x => `<div class="pl-deuda${x.de === yo.id ? " is-mia" : ""}"><span>${x.de === yo.id ? `Le debes <b>${fmtCLP(x.monto)}</b> a ${n(x.a)}`
      : x.a === yo.id ? `${n(x.de)} te debe <b>${fmtCLP(x.monto)}</b>` : `${n(x.de)} le debe <b>${fmtCLP(x.monto)}</b> a ${n(x.a)}`}</span>
      ${x.de === yo.id ? `<button class="btn btn--soft" data-action="pl-pague" data-id="${id}" data-a="${escapeHtml(x.a)}" data-m="${x.monto}">Ya le pagué</button>` : ""}</div>`).join("")
    : p.gastos.length ? `<div class="pl-deuda is-mano">${icoUI("hecho")} Están a mano</div>` : "";
  const finanzas = parte > 0 ? `<div class="pl-parte"><span>Tu parte: <b>${fmtCLP(parte)}</b>${plTotal(p) ? ` de ${fmtCLP(plTotal(p))}` : ""}</span>
      ${sumado && sumado.monto === parte ? `<span class="text-xs muted">${icoUI("hecho")} En Finanzas</span>`
        : `<button class="btn-ghost" data-action="pl-finanzas" data-id="${id}">${icoUI("finanzas")} ${sumado ? "Actualizar en Finanzas" : "Sumar a Finanzas"}</button>`}</div>` : "";
  return `${como}<div class="cj-sub mt-8">La cuenta</div>
    ${p.gastos.length ? `<div class="pl-gastos">${gastos}</div>${resumen}${finanzas}`
      : `<p class="text-sm muted" style="margin:0">¿Alguien pagó algo? Anótalo y Rumbo calcula cuánto le toca a cada uno. Sin pagos dentro de la app: solo la cuenta clara.</p>`}
    <button class="btn btn--soft pl-gasto-b" data-action="pl-gasto" data-id="${id}">${icoUI("plus")} Anotar un gasto</button>`;
}
/* Inicio: los planes que ya pasaron y falta contar cómo estuvieron, y lo que debes */
function plDespuesInicioHtml() {
  const l = PLAN.lista || [], hoy = todayISO();
  const como = l.filter(plFaltaComo).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 2);
  const deudas = l.filter(p => plVa(p) && p.fecha <= hoy && plDebo(p)).slice(0, 2);
  if (!como.length && !deudas.length) return "";
  return `<div class="card pl-despues">${como.map(p => {
    const con = plCon(p);
    return `<div class="pl-despues__c"><b>¿Cómo estuvo «${escapeHtml(p.titulo)}»?</b>
      <span class="text-xs muted">${escapeHtml(plFechaTxt(p.fecha, "").replace(/^./, c => c.toUpperCase()))}${con ? " · con " + escapeHtml(con) : ""} · cuéntalo en tu diario, +10 ⭐</span>
      <div class="pl-despues__est">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-action="pl-como" data-id="${escapeHtml(p.id)}" data-n="${n}" aria-label="${n} de 5 estrellas">${iconoLinea("estrella", 26)}</button>`).join("")}</div></div>`;
  }).join("")}
    ${deudas.map(p => `<button type="button" class="pl-despues__d" data-action="pl-ver" data-id="${escapeHtml(p.id)}">${icoUI("finanzas")}
      <span>En la cuenta de «${escapeHtml(p.titulo)}», debes <b>${fmtCLP(plDebo(p))}</b></span>${icoUI("chevron")}</button>`).join("")}</div>`;
}

/* El formulario de cómo estuvo (estrellas ya elegidas, si se tocaron en Inicio) */
function openPlanComo(id, n) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p) return;
  const mio = plMiRecuerdo(p), est = n || (mio ? mio.estrellas : 0), con = plCon(p);
  openModal(`¿Cómo estuvo «${p.titulo}»?`, `<div class="pl-det">
    <p class="text-sm muted" style="margin:0">${escapeHtml(plFechaTxt(p.fecha, p.hora).replace(/^./, c => c.toUpperCase()))}${con ? " · con " + escapeHtml(con) : ""}</p>
    <input type="hidden" id="pl-como-n" value="${est}">
    <div class="lc-det__est pl-como-est" id="pl-como-est">${[1, 2, 3, 4, 5].map(k => `<button type="button" class="${k <= est ? "on" : ""}" data-n="${k}" onclick="plComoEst(${k})" aria-label="${k} de 5">${iconoLinea("estrella", 30)}</button>`).join("")}</div>
    <div class="field" style="margin:0"><label for="pl-como-frase">En una frase <span class="muted" style="font-weight:500">(opcional)</span></label>
      <textarea class="input" id="pl-como-frase" maxlength="140" rows="2" placeholder="Ej: Buenísima. La próxima, la 3 en el cine.">${escapeHtml(mio ? mio.frase : "")}</textarea></div>
    <label class="pl-comp"><input type="checkbox" id="pl-como-comp" ${mio && mio.compartir ? "checked" : ""}><span>Que la vean los que fueron <span class="muted">(tus estrellas y tu frase)</span></span></label>
    <button class="btn btn--primary btn-block" data-action="pl-como-ok" data-id="${escapeHtml(p.id)}">${icoUI("diario")} Guardar en tu diario${mio ? "" : " · +10 ⭐"}</button></div>`);
  setTimeout(() => { const t = document.getElementById("pl-como-frase"); if (t && est) t.focus(); }, 80);
}
/* El formulario de un gasto: cuánto, qué y entre quiénes (por defecto, entre todos los que van) */
function openPlanGasto(id) {
  const p = (PLAN.lista || []).find(x => x.id === id); if (!p) return;
  const van = p.miembros.filter(m => m.respuesta === "voy" || m.respuesta === "quizas");
  openModal(`Un gasto de «${p.titulo}»`, `<div class="pl-det">
    <div class="pl-dos"><div class="field" style="margin:0"><label for="pl-g-monto">Cuánto pagaste</label><input class="input" id="pl-g-monto" inputmode="numeric" autocomplete="off" placeholder="Ej: 18000"></div>
      <div class="field" style="margin:0"><label for="pl-g-detalle">Qué <span class="muted" style="font-weight:500">(opcional)</span></label><input class="input" id="pl-g-detalle" maxlength="60" placeholder="Ej: las pizzas"></div></div>
    <div class="field cj-modal" style="margin:0"><label>Entre quiénes se divide</label>
      <div class="cj-amigos" id="pl-g-para">${van.map(m => `<label class="cj-amigo"><input type="checkbox" value="${escapeHtml(m.id)}" checked>${amigosAvatar(m, 26)}<span>${escapeHtml(plNombre(m))}</span></label>`).join("")}</div></div>
    <p class="text-xs muted" style="margin:0">Se divide en partes iguales. Rumbo calcula quién le debe a quién; los pagos los hacen ustedes.</p>
    <button class="btn btn--primary btn-block" data-action="pl-gasto-ok" data-id="${escapeHtml(p.id)}">Anotar</button></div>`);
  setTimeout(() => { const i = document.getElementById("pl-g-monto"); if (i) i.focus(); }, 80);
}
