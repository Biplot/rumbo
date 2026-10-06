const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const { contexto, sembrar } = require("./base.cjs");
const OUT = __dirname + "/shots";
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await contexto(b, "2026-09-23T08:05:00");
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await sembrar(p, "2026-09-22", "camila@ejemplo.cl");
  await p.evaluate(() => {
    const S = STATE;
    S.postits = [
      { id: "n1", titulo: "Ideas para el taller", texto: "Partir con una pregunta. Ejemplos reales. Cerrar con tarea. #trabajo", etiquetas: ["trabajo"], fijada: true, color: "#F5C451", ts: 5 },
      { id: "n2", titulo: "Lista del viaje", texto: "Pasaporte, cargador, adaptador #casa", etiquetas: ["casa"], fijada: true, color: "#2BB6A5", ts: 4 },
      { id: "n3", titulo: "", texto: "Llamar al contador por el IVA de octubre #trabajo", etiquetas: ["trabajo"], ts: 3 },
      { id: "n4", titulo: "Frase", texto: "\"Un bocado a la vez.\" #libros", etiquetas: ["libros"], ts: 2 },
      { id: "n5", titulo: "", texto: "Regalo para el cumpleaños de la Jose #casa", etiquetas: ["casa"], color: "#8B93E8", ts: 1 }];
    tareasDelDia("2026-09-20", S).filter(tareaAbierta).forEach(t => marcarTarea(t, "hecha"));
    tareasDelDia("2026-09-23", S).filter(t => t.txt === "Llamar al contador").forEach(t => marcarTarea(t, "hecha"));
    nuevaTarea(S, "2026-09-23", { txt: "Comprar regalo para la Jose", ambito: "per" });
    nuevaTarea(S, "2026-09-23", { txt: "Revisar métricas de la campaña", ambito: "pro" });
    ["agua","med"].forEach(h => { const k = "2026-9"; ((S.habitos.log[k] = S.habitos.log[k] || {})[h] = S.habitos.log[k][h] || {})[23] = true; });
    S.ritual.dias[todayISO()] = { hecho: true, energia: 4, pilar: "Productividad", mision: "Avanzar con calma y foco", sapo: "Cerrar la propuesta de octubre", ts: 1 };
    localStorage.setItem("rumbo-sin-escenas","1"); saveState(); rerender(); const e=document.getElementById("eleEscena"); if(e) e.remove();
  });
  await p.addStyleTag({content:"#eleEscena{display:none!important}"});
  const go = async (h) => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(500); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150); };
  const foto = async (n) => { await p.screenshot({ path: `${OUT}/${n}.png` }); console.log("·", n); };
  for (const r of ["inicio", "semana", "habitos", "diario", "notas", "finanzas", "calendario", "recompensas", "ritual", "metas"]) { await go(r); await foto(r); }
  await go("inicio"); await p.evaluate(() => document.querySelector(".ele-hero") && document.querySelector(".ele-hero").click()); await p.waitForTimeout(400); await foto("inicio-ele");
  await p.evaluate(() => typeof openElefante === "function" && openElefante()); await p.waitForTimeout(500); await foto("elefante");
  console.log(errs);
  await b.close();
})();
