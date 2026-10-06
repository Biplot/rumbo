/* Capturas del tutorial (celular) con el registro diario, la postergación y el ritual semanal.
   Datos de ejemplo: 5 semanas de historia generadas con semilla fija (siempre iguales). */
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const OUT = __dirname + "/shots";
require("fs").mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5178/";

let VP={width:390,height:844};
async function contexto(b, fecha) {
  const ctx = await b.newContext({ serviceWorkers: "block", viewport: VP, deviceScaleFactor: 3 });
  await require("../fonts-route.cjs").routeFonts(ctx);
  await ctx.route("https://cdn.jsdelivr.net/**", r => r.fulfill({ body: "", contentType: "text/javascript" }));
  await ctx.route("**/js/store.js*", async r => { const res = await r.fetch(); r.fulfill({ status: 200, headers: { "content-type": "text/javascript" }, body: (await res.text()).replace("const BACKEND = SupabaseBackend;", "const BACKEND = LocalBackend;") }); });
  await ctx.clock.setFixedTime(new Date(fecha));
  return ctx;
}

/* Carga los datos de ejemplo. `hasta`: último día con historia resuelta. */
async function sembrar(p, hasta, email) {
  await p.goto(URL);
  await p.click('[data-tab="register"]');
  await p.fill("#reg-name", "Camila"); await p.fill("#reg-email", email); await p.fill("#reg-pass", "secreto123");
  await p.click('[data-action="auth-register"]');
  await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(500);
  await p.evaluate(hasta => {
    const S = STATE;
    Object.assign(S.profile, { name: "Camila", birthDate: "1991-04-12", motto: "Un bocado a la vez" });
    Object.assign(S.settings, { onboarded: true, introVersion: INTRO_VERSION, theme: "navy", tutorial: { vistos: {}, mision: "oculta", auto: false, ts: 0 } });
    S.finanzas.metaMensual = 300000; S.finanzas.meses[8] = { ingreso: 1850000, gasto: 1620000, ahorro: 0, metaAhorro: 250000 };
    S.salud.pesoObjetivo = 62; S.salud.meses[8].peso = 63.5;
    S.lecturas = [{ id: "l1", titulo: "Hábitos atómicos", autor: "James Clear", estado: "leyendo", paginas: 320, pagina: 180, valoracion: 0, nota: "", color: "#17C3B2", inicio: "2026-09-02", fin: "" }];
    const d = (id, nombre, icon, frecuencia) => ({ id, nombre, icon, frecuencia, creado: "2026-08-01" });
    S.habitos.defs = [
      d("gym", "Gimnasio", "🏋️", { tipo: "semanal", veces: 3 }), d("ing", "Inglés", "📘", { tipo: "dias", dias: [0, 2] }),
      d("agua", "Agua", "💧", { tipo: "diario" }), d("med", "Meditar", "🧘", { tipo: "diario" }), d("mama", "Llamar a mamá", "📞", { tipo: "mensual", veces: 4 }),
    ];
    const mark = (hid, iso) => { const x = agDate(iso), k = `${x.getFullYear()}-${x.getMonth() + 1}`; ((S.habitos.log[k] = S.habitos.log[k] || {})[hid] = S.habitos.log[k][hid] || {})[x.getDate()] = true; };
    S.metas.trimestres[2] = [{ id: "q1", texto: "Lanzar el nuevo servicio", done: false }, { id: "q2", texto: "Correr 10K", done: false }];
    S.metas.mensuales[8] = [
      { id: "m1", texto: "Cerrar 2 propuestas nuevas", done: true, ambito: "pro", triId: "q1", origen: "ritual-mes" },
      { id: "m2", texto: "Terminar la landing del servicio", done: false, ambito: "pro", triId: "q1", origen: "ritual-mes" },
      { id: "m3", texto: "Correr 3 veces por semana", done: false, ambito: "per", triId: "q2", origen: "ritual-mes" },
    ];
    S.metas.trimestres[3] = [{ id: "q4", texto: "Conseguir 10 clientes nuevos", done: false }];
    S.metas.mensuales[9] = [{ id: "o1", texto: "Conseguir los primeros 5 clientes", done: false, ambito: "pro", triId: "q4", origen: "ritual-mes" }];
    S.ritual.meses = { "2026-09": { apertura: { foco: "Constancia", granMes: "Terminar septiembre con la landing publicada y sin saltarme entrenamientos.", objetivos: ["m1", "m2", "m3"], ts: 1 } } };
    ledgerRegistrar(S, "ejemplo-historial", 1240, 2150, "Ejemplo");

    // Historia de tareas (semilla fija): más postergación los lunes y viernes, y en lo profesional
    let seed = 11;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = a => a[Math.floor(rnd() * a.length)];
    const PRO = ["Responder correos pendientes", "Actualizar la planilla de ventas", "Revisar métricas de la campaña", "Preparar la presentación", "Enviar la cotización", "Coordinar con diseño", "Escribir el informe semanal"];
    const PER = ["Comprar para la semana", "Ir al banco", "Regar las plantas", "Llevar el auto a revisión", "Ordenar el escritorio", "Pagar el gimnasio"];
    const BOC = ["Diseñar la landing", "Terminar el informe trimestral", "Preparar el taller", "Revisar la propuesta"];
    const resolver = (iso, dow) => {
      tareasDelDia(iso, S).filter(tareaAbierta).forEach(t => {
        if (t.txt === "Llamar al contador" || t.txt === "Ordenar la bodega") return;
        const pPost = (dow === 0 || dow === 4 ? 0.34 : 0.15) + (t.ambito === "pro" ? 0.08 : 0) - (t.migraciones ? 0.1 : 0);
        const r = rnd();
        if (r < pPost) moverTarea(S, t, iso, agSumar(iso, 1), "migrada", { hoy: iso });
        else if (r < pPost + 0.05) marcarTarea(t, "soltada");
        else if (r < pPost + 0.08) marcarTarea(t, "delegada", { delegadaA: "Andrés" });
        else marcarTarea(t, "hecha");
      });
    };
    for (let iso = "2026-08-17"; iso <= hasta; iso = agSumar(iso, 1)) {
      const dow = (agDate(iso).getDay() + 6) % 7, finde = dow >= 5;
      if (!finde) nuevaTarea(S, iso, { txt: pick(BOC), ambito: "pro", esSapo: true });
      for (let k = 0; k < (finde ? 2 : 3); k++) { const pro = !finde && rnd() < 0.55; nuevaTarea(S, iso, { txt: pick(pro ? PRO : PER), ambito: pro ? "pro" : "per" }); }
      resolver(iso, dow);
      const energia = 2 + Math.floor(rnd() * 4), bocado = tareasDelDia(iso, S).find(t => t.esSapo);
      S.ritual.dias[iso] = { hecho: true, cerrado: iso !== "2026-09-20", energia, pilar: "Productividad", mision: "Avanzar lo importante",
        sapo: bocado ? bocado.txt : "", abiertoTs: new Date(iso + (energia >= 4 ? "T07:40:00" : "T09:50:00")).getTime(),
        cierre: { sapo: !!(bocado && estadoTarea(bocado) === "hecha"), mision: "si", energia: 3 }, ts: 1 };
      S.vida.diario.push({ id: uid(), fecha: iso, mood: Math.max(1, Math.min(5, energia + (rnd() < 0.5 ? 0 : 1))), fromRitual: true });
      ["agua", "med"].forEach(h => { if (rnd() < 0.8) mark(h, iso); });
      if (dow === 0 || dow === 2 || dow === 4) mark("gym", iso);
    }
    // Una crónica que aún no se hace y otra que se hizo a la cuarta
    let c = nuevaTarea(S, "2026-09-16", { txt: "Llamar al contador", ambito: "pro" });
    c = moverTarea(S, c, "2026-09-16", "2026-09-17", "migrada", { hoy: "2026-09-16" });
    c = moverTarea(S, c, "2026-09-17", "2026-09-21", "programada", { hoy: "2026-09-17" });
    c = moverTarea(S, c, "2026-09-21", "2026-09-23", "programada", { hoy: "2026-09-21" });
    let o = nuevaTarea(S, "2026-09-01", { txt: "Ordenar la bodega", ambito: "per" });
    [["2026-09-01", "2026-09-02"], ["2026-09-02", "2026-09-03"], ["2026-09-03", "2026-09-05"]].forEach(([a, z]) => { o = moverTarea(S, o, a, z, "migrada", { hoy: a }); });
    marcarTarea(o, "hecha");
    // Un pendiente sin decidir (el domingo no se cerró)
    nuevaTarea(S, "2026-09-20", { txt: "Pedir hora al dentista", ambito: "per" });
    // Plan de la semana del 21
    S.ritual.semanas["2026-09-21"] = {
      plan: { premio: "Cena en el restorán nuevo", ts: 1 },
      apertura: { foco: "Landing", habitosFoco: ["gym", "med"], ts: 1, prioridades: [
        { id: "wp1", texto: "Publicar la landing del servicio", ambito: "pro", objId: "m2", dia: "2026-09-24" },
        { id: "wp2", texto: "Cerrar la propuesta de octubre", ambito: "pro", objId: "m1", dia: "2026-09-23" },
        { id: "wp3", texto: "Correr 3 veces", ambito: "per", objId: "m3", dia: "" }] },
    };
    nuevaTarea(S, "2026-09-23", { txt: "Cerrar la propuesta de octubre", ambito: "pro", prioridad: "wp2" });
    nuevaTarea(S, "2026-09-24", { txt: "Publicar la landing del servicio", ambito: "pro", prioridad: "wp1" });
    S.gamif.badges = BADGES.map(x => x.id).filter(id => ["primer-paso", "semana-fuego", "madrugador", "elefante-domado"].includes(id));
    saveState();
    applyTheme("navy");
    ONB_ACTIVE = false; closeModal(); rerender(); updateTopbar();
  }, hasta);
  await p.waitForTimeout(300);
  await p.addStyleTag({ content: ".toast,#dayFab{display:none!important}" });
}


module.exports={contexto,sembrar,setVP:v=>{VP=v}};
