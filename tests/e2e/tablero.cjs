/* Pruebas en navegador · Amigos en una pantalla (amigos-tablero.js), en el celular: lo que espera tu respuesta
   arriba (las primeras 3 y «Ver todo»), el número en el botón «Más», la semana, las baldosas que se abren como
   hoja y se ponen al día solas, «+ Nuevo» y leer un libro con amigos. Las cuentas locales comparten la "base"
   de amigos (LocalBackend). */
const { URL, nuevoContexto, registrar, shot, hojaAmigos } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T11:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const modal = () => p.locator("#modal").innerText();

  // 0) Bruno, con amigos y de todo: Ana lo invita a un plan, a un hábito y a una lista; Pedro le pregunta las
  //    fechas de un asado y le manda ánimo; Cami le pide amistad. Ya leen juntos un libro y tienen un hábito.
  await registrar(p, "bruno@tab.cl");
  await p.evaluate(() => {
    STATE.profile.name = "Bruno";
    STATE.lecturas.push({ id: "libro1", titulo: "Rayuela", autor: "Cortázar", estado: "leyendo", valoracion: 0, pagina: 30, paginas: 600, nota: "", color: "#17C3B2", portada: "", inicio: "2026-11-01", fin: "" });
    saveState();
  });
  await ir("amigos");
  await p.evaluate(async () => {
    const B = localStorage.getItem("rumbo_session"), hoy = todayISO(), F = n => agSumar(hoy, n), como = id => localStorage.setItem("rumbo_session", id), D = { tipo: "diario" };
    const cod = AMIGOS.codigo;
    for (const [id, nombre] of [["u_ana", "Ana"], ["u_pedro", "Pedro"], ["u_cami", "Cami"]]) {
      como(id); await BACKEND.amigosPerfil({ nombre, estado: { fecha: hoy, abrio: true, cumple: id === "u_ana" ? hoy.slice(5, 10) : undefined } }); await BACKEND.amigosPedir(cod);
    }
    como(B); await BACKEND.amigosResponder("u_ana", true); await BACKEND.amigosResponder("u_pedro", true);
    como("u_ana"); await BACKEND.planCrear({ titulo: "Ver Dune", tipo: "pelicula", fecha: F(2), hora: "21:00", lugar: "Casa de Ana" }, [B], hoy);
    await BACKEND.conjuntoCrear("Leer 20 minutos", "📚", D, [B], hoy);
    await BACKEND.listaCrear("Restaurantes por probar", "comida", [B]);
    const lj = await BACKEND.lecturaCrear("Cien años de soledad", "García Márquez", 471, [B]); await BACKEND.lecturaAvance(lj.id, 120, hoy);
    como("u_pedro"); const asado = await BACKEND.planCrear({ titulo: "Asado", tipo: "comer", opciones: [{ fecha: F(10), hora: "13:30" }, { fecha: F(11), hora: "13:30" }] }, [B], hoy);
    const h = await BACKEND.conjuntoCrear("Correr", "🏃", D, [B], hoy);
    await BACKEND.amigosAnimo(B, "¡Vamos!");
    como(B); await BACKEND.planResponder(asado.id, "voy"); await BACKEND.conjuntoResponder(h.id, true, hoy); await BACKEND.lecturaResponder(lj.id, true);
    como("u_pedro"); await BACKEND.conjuntoMarcar(h.id, hoy, true);
    como(B); await amigosCargar(true);
  });
  await ir("amigos"); await p.waitForTimeout(500);

  // 1) Para responder: 6 cosas; en el celular se ven 3 y «Ver todo · 6». El número, también en «Más»
  ok(/para responder · 6/i.test(await p.locator(".at-cab").innerText()) && await p.locator(".at-bandeja .at-fila").count() === 3, "«Para responder · 6»: en el celular se ven las primeras 3");
  ok(await p.locator("#bbMas").getAttribute("data-n") === "6" && await p.locator("#bbMas.tiene-nuevo").count() === 1, "el botón «Más» de abajo lleva el número: 6");
  await p.click('[data-action="am-bandeja"]'); await p.waitForTimeout(300);
  const toda = await p.locator(".at-bandeja").innerText();
  ok(await p.locator(".at-bandeja .at-fila").count() === 6 && ["Ver Dune", "Asado", "Cami", "Leer 20 minutos", "Restaurantes por probar", "Pedro te mandó ánimo"].every(t => toda.includes(t)) && toda.includes("Ver menos"),
    "«Ver todo»: el plan, votar el asado, la solicitud de Cami, el hábito, la lista y el ánimo");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin moverse de lado en el celular");
  await shot(p, "tablero-movil");

  // 2) Responder ahí mismo baja el número
  await p.click('.at-fila:has-text("Leer 20 minutos") [data-action="cj-unirme"]'); await p.waitForTimeout(900);
  ok(/para responder · 5/i.test(await p.locator(".at-cab").innerText()) && await p.locator("#bbMas").getAttribute("data-n") === "5", "al unirse al hábito: quedan 5 (y el número baja)");

  // 3) Esta semana y las baldosas
  const semana = await p.locator(".at-semana").innerText();
  ok(semana.includes("Ana") && semana.includes("Está de cumpleaños"), "en «Esta semana», el cumpleaños de Ana (hoy)");
  const lect = await p.locator('.at-tile[data-v="lecturas"]').innerText();
  ok(lect.includes("0 %") && lect.includes("Cien años de soledad"), "la baldosa Lecturas: tu avance y el libro");
  ok((await p.locator('.at-tile[data-v="habitos"]').innerText()).includes("2"), "la baldosa Hábitos: 2 hábitos juntos");

  // 4) La hoja de hábitos se pone al día sola: marcar «Correr» ahí mismo
  const hab = await hojaAmigos(p, "habitos");
  ok(hab.includes("Correr") && hab.includes("Pedro ya lo hizo hoy"), "la hoja de Hábitos: Pedro ya hizo «Correr» hoy, te toca");
  await p.click('#modal .cj-fila:has-text("Correr") [data-action="quick-habit"]'); await p.waitForTimeout(900);
  ok(await p.locator("#modalOverlay").isVisible() && (await p.locator('#modal .cj-fila:has-text("Correr")').innerText()).includes("Hoy lo hicieron todos"), "al marcarlo, la hoja sigue abierta y ya dice «Hoy lo hicieron todos»");

  // 5) La hoja de lecturas: en qué página va cada uno
  const lec = await hojaAmigos(p, "lecturas");
  ok(lec.includes("Cien años de soledad") && lec.includes("Ana") && lec.includes("pág. 120"), "la hoja de Lecturas: Ana va en la pág. 120");

  // 6) + Nuevo: plan, hábito, objetivo, lista o lectura; leer «Rayuela» con Ana
  const nuevo = await hojaAmigos(p, "nuevo");
  ok(["Un plan", "Un hábito", "Un objetivo", "Una lista", "Una lectura"].every(t => nuevo.includes(t)), "«+ Nuevo»: plan, hábito, objetivo, lista o lectura");
  await p.click('#modal .at-op[data-v="leer"]'); await p.waitForTimeout(300);
  ok((await modal()).includes("Rayuela") && !(await modal()).includes("Cien años"), "«Una lectura»: tus libros que todavía lees solo");
  await p.click('#modal [data-action="lj-nueva"][data-libro="libro1"]'); await p.waitForTimeout(300);
  await p.click('#lj-amigos label:has-text("Ana")'); await p.click('[data-action="lj-guardar"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!STATE.lecturas.find(l => l.id === "libro1").juntos), "e invita a Ana a leer «Rayuela»");

  // 7) La hoja de planes: pestañas
  await hojaAmigos(p, "planes", "pordefinir");
  ok((await modal()).includes("Asado") && !(await modal()).includes("Ver Dune"), "Planes › Por definir: el asado (Ver Dune está en Próximos)");
  ok((await hojaAmigos(p, "planes", "proximos")).includes("Ver Dune"), "Planes › Próximos: Ver Dune");
  await shot(p, "tablero-hoja-planes");
  await ctx.close();
};
