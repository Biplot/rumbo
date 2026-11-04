/* Pruebas en navegador · 📚 La biblioteca (biblioteca.js y biblioteca-motor.js): la repisa arriba de Lecturas, «Lo terminé»
   (en Lecturas y en Inicio, +40 ⭐ una vez), los libros de antes (sin ⭐ ni meta), ordenar, la ficha al tocar un lomo,
   prestar y el recordatorio, releer, «Lo dejé», El ladrillo, el probador y la Tienda, compartir como imagen, y con amigos:
   su biblioteca en las visitas (sin notas ni frases), «Lo quiero leer» y «Recomendar». */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T19:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on("dialog", d => d.accept());
  const salir = async () => { await p.evaluate(() => doLogout()); await p.waitForTimeout(300); };
  const entrar = async email => {
    await salir(); await p.click('[data-tab="login"]');
    await p.fill("#log-email", email); await p.fill("#log-pass", "secreto123");
    await p.click('[data-action="auth-login"]'); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(900);
    await p.evaluate(() => closeModal());
  };
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(800); };
  const ancho = () => p.evaluate(() => document.documentElement.scrollWidth);
  const modal = () => p.locator("#modal").innerText();
  const libro = t => p.evaluate(t => STATE.lecturas.find(l => l.titulo === t), t);
  const ledger = () => p.evaluate(() => STATE.gamif.ledger.filter(m => m.id.startsWith("lectura:") && !m.anulado).length);
  const pintado = sel => p.evaluate(s => {
    const cv = document.querySelector(s); if (!cv || !cv.width) return false;
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data; let n = 0;
    for (let i = 3; i < d.length; i += 4 * 37) if (d[i] > 0) n++;
    return n > 20;
  }, sel);

  await registrar(p, "ana@bib.cl"); await p.evaluate(() => { STATE.profile.name = "Ana"; saveState(); });

  // 1) Lecturas vacía: la repisa espera
  await ir("lecturas");
  ok(await p.locator(".bib").count() === 1 && /Tu biblioteca/.test(await p.locator(".bib").innerText()) && /0 de 12 en 2026/.test(await p.locator(".bib").innerText()), "Lecturas parte con tu biblioteca: 0 de 12 en 2026");
  ok(await p.locator('.bib canvas[data-biblio="repisa"][data-modo="lecturas"]').count() === 1 && /Cuando termines un libro/.test(await p.locator(".bib").innerText()), "la repisa gratis, vacía, con los huecos de tu meta");
  ok(await p.locator(".bib .bib-pl .bib-pl__vacio").count() === 1 && /Por leer/.test(await p.locator(".bib-pl").innerText()) && /libros deseados/i.test(await p.locator(".bib-pl").innerText()), "debajo de la repisa, «Por leer»: tus libros deseados (vacío, explica qué va ahí)");

  // 2) Un libro que estás leyendo: «Lo terminé» en Lecturas y en Inicio
  await p.evaluate(() => { STATE.lecturas.push({ id: "l1", titulo: "Hijo de ladrón", autor: "Manuel Rojas", estado: "leyendo", paginas: 384, pagina: 370, valoracion: 0, nota: "", color: "#FF6B4A", inicio: "2026-10-20", fin: "" }); saveState(); });
  await ir("inicio");
  ok(await p.locator('[data-action="bib-termine"][data-id="l1"]').count() === 1, "en Inicio, «Leyendo ahora» trae «Lo terminé»");
  await ir("lecturas");
  ok(await p.locator('.lect-now [data-action="bib-termine"]').count() === 1 && await p.locator('.lect-now [data-action="bib-dejar"]').count() === 1, "en «Leyendo ahora»: «Lo terminé» y «Lo dejé»");
  await p.click('.lect-now [data-action="bib-termine"]'); await p.waitForTimeout(300);
  ok(/¿Qué te pareció\?/.test(await modal()) && /Ganas 40/.test(await modal()), "«Lo terminé» pregunta qué te pareció (y dice que ganas 40 ⭐)");
  await p.click('#modal [data-el-id="bf-estrellas"] button[data-v="5"]'); await p.fill("#bf-frase", "Nadie se salva solo.");
  await p.click('#modal [data-el-id="bf-formato"] button[data-v="grande"]').catch(() => {});
  await p.click('[data-action="bib-termine-ok"]'); await p.waitForTimeout(900);
  let l1 = await libro("Hijo de ladrón");
  ok(l1.estado === "terminado" && l1.valoracion === 5 && l1.frase === "Nadie se salva solo." && l1.fin === "2026-11-04" && l1.pagina === 384, "a la repisa: terminado hoy, con 5 ★ y tu frase");
  ok(await ledger() === 1 && /1 de 12 en 2026/.test(await p.locator(".bib").innerText()), "+40 ⭐ y tu meta tiene un hueco menos (1 de 12)");
  ok(await pintado('.bib canvas[data-biblio]'), "la repisa se dibuja");
  await shot(p, "bib-repisa");

  // 3) Los que ya leí (antes de Rumbo): llenan la repisa sin ⭐ ni meta
  await p.click('[data-action="bib-antes"]'); await p.waitForTimeout(300);
  const filas = p.locator("#bib-antes .bib-antes__f");
  await filas.nth(0).locator('[data-antes="t"]').fill("La Odisea"); await filas.nth(0).locator('[data-antes="a"]').fill("Homero"); await filas.nth(0).locator('[data-antes="y"]').fill("2015");
  await filas.nth(1).locator('[data-antes="t"]').fill("Niebla");
  await p.click('[data-action="bib-antes-ok"]'); await p.waitForTimeout(600);
  const od = await libro("La Odisea");
  ok(od && od.antes && od.anio === 2015 && od.estado === "terminado" && !od.premiado && await ledger() === 1, "los de antes llenan la repisa, sin ⭐");
  ok(/3 libros \(2 de antes de Rumbo\)/.test(await p.locator(".bib").innerText()) && /1 de 12 en 2026/.test(await p.locator(".bib").innerText()) && await p.evaluate(() => lg_libros(STATE)) === 1,
    "3 libros (2 de antes) y sigue 1 de 12: no cuentan para la meta ni las medallas");

  // 4) Ordenar
  await p.click('[data-action="bib-orden"][data-v="autor"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => STATE.biblio.orden) === "autor" && (await p.evaluate(() => bibDatos().libros.map(l => l.titulo))).join() === "La Odisea,Hijo de ladrón,Niebla", "ordenar por autor (sin autor, al final)");
  await p.click('[data-action="bib-orden"][data-v="fecha"]'); await p.waitForTimeout(400);

  // 5) La ficha al tocar un lomo
  await p.evaluate(() => bibTocarLibro("l1")); await p.waitForTimeout(300);
  let t = await modal();
  ok(/Lo terminaste el 4 de noviembre · te tomó 16 días/.test(t) && /384 páginas · grande/.test(t) && /Nadie se salva solo/.test(t) && /solo tú la ves/.test(t), "la ficha: cuándo lo terminaste, cuánto te tomó, páginas, formato y tu frase (solo tuya)");

  // 6) Prestarlo, el recordatorio a los 30 días y la devolución
  await p.click('#modal [data-action="bib-prestar"]'); await p.waitForTimeout(250);
  await p.fill("#bib-prest-a", "Bruno"); await p.click('[data-action="bib-prestar-ok"]'); await p.waitForTimeout(500);
  l1 = await libro("Hijo de ladrón");
  ok(l1.prestado && l1.prestado.a === "Bruno" && l1.prestado.desde === "2026-11-04" && (await p.evaluate(() => bibDatos().libros.find(x => x.id === "l1").prestado)) === "Bruno", "prestado a Bruno: su tarjetita va en la repisa");
  await p.evaluate(() => { STATE.lecturas.find(l => l.id === "l1").prestado.desde = "2026-10-05"; saveState(); rerender(); }); await p.waitForTimeout(400);
  ok(/Le prestaste «Hijo de ladrón» a Bruno hace 30 días/.test(await p.locator(".bib").innerText()), "a los 30 días, tu elefante te lo recuerda en Lecturas");
  await p.click('.bib [data-action="bib-devuelto"]'); await p.waitForTimeout(400);
  ok(!(await libro("Hijo de ladrón")).prestado && !/Le prestaste/.test(await p.locator(".bib").innerText()), "«Me lo devolvieron»: vuelve a la repisa");

  // 7) Releerlo: «leído 2 veces», sin volver a pagar
  await p.evaluate(() => bibTocarLibro("l1")); await p.waitForTimeout(250);
  await p.click('#modal [data-action="bib-releer"]'); await p.waitForTimeout(500);
  ok((await libro("Hijo de ladrón")).estado === "leyendo", "releerlo lo vuelve a «Leyendo ahora»");
  await p.click('.lect-now [data-action="bib-termine"]'); await p.waitForTimeout(300); await p.click('[data-action="bib-termine-ok"]'); await p.waitForTimeout(700);
  ok((await libro("Hijo de ladrón")).veces === 2 && await ledger() === 1, "al terminarlo: leído 2 veces, y las ⭐ no se repiten");

  // 8) Lo dejé (sin culpa) y El ladrillo
  await p.evaluate(() => { STATE.lecturas.push({ id: "l2", titulo: "Ulises", autor: "Joyce", estado: "leyendo", paginas: 0, pagina: 50, valoracion: 0, nota: "", color: "#6C63FF", inicio: "2026-11-01", fin: "" },
    { id: "l3", titulo: "Los miserables", autor: "Hugo", estado: "leyendo", paginas: 1400, pagina: 1390, valoracion: 0, nota: "", color: "#0E2A47", inicio: "2026-09-01", fin: "" }); saveState(); rerender(); });
  await p.waitForTimeout(400);
  await p.click('.lect-now [data-action="bib-dejar"][data-id="l2"]'); await p.waitForTimeout(400);
  ok((await libro("Ulises")).estado === "dejado" && /Lo dejé/.test(await p.locator(".lect-grid").innerText()), "«Lo dejé»: queda en tus libros, sin castigo");
  await p.evaluate(() => openLoTermine("l3")); await p.waitForTimeout(250); await p.click('[data-action="bib-termine-ok"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => (STATE.gamif.badges || []).includes("el-ladrillo")), "terminar uno de 1.400 páginas: la medalla El ladrillo");

  // 9) El probador y la Tienda
  await p.click('[data-action="bib-probador"]'); await p.waitForTimeout(700);
  ok(await p.locator('#bib-probador [data-action="bib-estilo"]').count() === 8 && await p.locator('#bib-probador canvas[data-modo="chica"][data-listo]').count() === 8, "el probador: los 8 estilos, cada uno dibujado");
  ok(/900/.test(await p.locator('#bib-probador [data-v="invierno"]').innerText()) && /El colegio en invierno/.test(await p.locator('#bib-probador [data-v="invierno"]').innerText()), "con el colegio en invierno (900 ⭐)");
  ok(/300/.test(await p.locator('#bib-probador [data-v="torre"]').innerText()) && /La tuya/.test(await p.locator('#bib-probador [data-v="repisa"]').innerText()), "la repisa es la tuya; la torre, 300 ⭐");
  await shot(p, "bib-probador");
  await p.evaluate(() => registrarMovimiento("prueba:bib", 2000, 0, "Para probar", true));
  await p.click('#bib-probador [data-v="torre"]'); await p.waitForTimeout(500);
  ok(await p.locator('#modal [data-action="cos-buy"]').count() === 1 && await p.locator('#modal canvas[data-biblio="torre"][data-modo="muestra"]').count() === 1, "un estilo que no tienes abre su ficha en la Tienda, con su muestra");
  await p.click('#modal [data-action="cos-buy"]'); await p.waitForTimeout(800);
  await ir("lecturas");
  ok(await p.evaluate(() => isOwned("bib-torre") && STATE.gamif.equipped.biblioteca === "torre") && await p.locator('.bib canvas[data-biblio="torre"]').count() === 1, "al comprarla, tu biblioteca es la torre");
  await p.evaluate(() => { bibElegirEstilo("repisa"); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => bibEstilo()) === "repisa", "y puedes volver a la repisa cuando quieras");
  ok(await ancho() <= 390, "Lecturas con la biblioteca cabe en el celular");

  // 10) Compartir como imagen (1080 × 1350)
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }), p.click('.bib [data-action="bib-compartir"]')]);
  ok(/rumbo-biblioteca-2026-11-04\.png$/.test(dl.suggestedFilename()), "compartir arma la imagen de tu biblioteca");
  const tam = await p.evaluate(async () => { const bl = await bibImagen(); const bm = await createImageBitmap(bl); return [bm.width, bm.height]; });
  ok(tam[0] === 1080 && tam[1] === 1350, "de 1080 × 1350, como las del Álbum");

  // 11) Con amigos: Bruno visita la biblioteca de Ana, «Lo quiero leer» y «Recomendar»
  await ir("amigos"); const codA = (await p.locator(".am-cod").innerText()).trim(), idA = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await salir(); await registrar(p, "bruno@bib.cl"); await p.evaluate(() => { STATE.profile.name = "Bruno"; saveState(); });
  await ir("amigos"); const idB = await p.evaluate(() => localStorage.getItem("rumbo_session"));
  await p.evaluate(c => BACKEND.amigosPedir(c), codA);
  await entrar("ana@bib.cl"); await p.evaluate(id => BACKEND.amigosResponder(id, true), idB); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(500);
  await p.evaluate(() => amigosPublicar(true)); await p.waitForTimeout(600);
  const pub = await p.evaluate(id => JSON.parse(localStorage.getItem("rumbo_amigos")).perfiles[id], idA);
  ok(pub.biblioteca && pub.biblioteca.libros.length === 4 && pub.estado.libros === 4, "Ana comparte su biblioteca (4 libros)");
  ok(!/Nadie se salva|Bruno/.test(JSON.stringify(pub.biblioteca)), "sin sus frases, notas ni a quién prestó");
  // Ana le recomienda un libro a Bruno
  await p.evaluate(() => bibTocarLibro("l1")); await p.waitForTimeout(250);
  await p.click('#modal [data-action="bib-recomendar"]'); await p.waitForTimeout(250);
  await p.check("#bib-rec input"); await p.click('[data-action="bib-recomendar-ok"]'); await p.waitForTimeout(600);

  await entrar("bruno@bib.cl"); await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(900);
  const rec = await libro("Hijo de ladrón");
  ok(rec && rec.estado === "por-leer" && rec.recomienda && rec.recomienda.de === "Ana", "a Bruno le llega «Hijo de ladrón» a su «Por leer», con «te lo recomendó Ana»");
  await p.evaluate(() => amigosCargar(true)); await p.waitForTimeout(600);
  ok(await p.evaluate(() => STATE.lecturas.filter(l => l.titulo === "Hijo de ladrón").length) === 1, "una sola vez");
  await p.evaluate(id => openAmigo(id), idA); await p.waitForTimeout(300);
  ok(/Su biblioteca · 4/.test(await modal()), "en el perfil de Ana: «Su biblioteca · 4»");
  await p.click('#modal [data-action="bib-visitar"]'); await p.waitForTimeout(900);
  ok(/La biblioteca de Ana/.test(await modal()) && await p.locator('#modal canvas[data-modo="visita"][data-listo]').count() === 1, "se abre la biblioteca de Ana, dibujada");
  ok(await pintado('#modal canvas[data-modo="visita"]'), "con sus lomos");
  await shot(p, "bib-visita");
  const v = await p.evaluate(() => BIB_VISITA.datos.libros.find(x => x.titulo === "Los miserables").id);
  await p.evaluate(id => bibTocarLibro(id, document.getElementById("bib-visita-cv")), v); await p.waitForTimeout(300);
  ok(/De la biblioteca de Ana · 1400 páginas/.test(await modal()) && await p.locator('[data-action="bib-quiero"]').count() === 1, "tocar un lomo de Ana: su ficha, con «Lo quiero leer»");
  await p.click('[data-action="bib-quiero"]'); await p.waitForTimeout(400);
  const quiero = await libro("Los miserables");
  ok(quiero && quiero.estado === "por-leer" && quiero.recomienda.de === "Ana" && /Ya está en tus libros/.test(await modal()), "«Lo quiero leer»: a tu «Por leer», con «te lo recomendó Ana»");
  // «Por leer» en Tu biblioteca: los deseados de Bruno (el último primero) y «Empezar a leer»
  await ir("lecturas");
  const pl = await p.locator(".bib-pl").innerText();
  ok(/Tus libros deseados · 2/i.test(pl) && await p.locator(".bib-pl__l").count() === 2 && /Los miserables/.test(await p.locator(".bib-pl__l").first().innerText()) && /de Ana/.test(pl), "en Tu biblioteca, «Por leer · Tus libros deseados · 2»: el último que llegó primero, con «de Ana»");
  await shot(p, "bib-por-leer");
  await p.locator(".bib-pl__l").first().click(); await p.waitForTimeout(300);
  ok(/Está en tus libros deseados/.test(await modal()) && /te lo recomendó Ana/.test(await modal()) && await p.locator('#modal [data-action="bib-empezar"]').count() === 1, "tocarlo abre su ficha: «Está en tus libros deseados», con «Empezar a leer»");
  await p.click('#modal [data-action="bib-empezar"]'); await p.waitForTimeout(500);
  const emp = await libro("Los miserables");
  ok(emp.estado === "leyendo" && emp.inicio === "2026-11-04" && await p.locator(".bib-pl__l").count() === 1 && /Los miserables/.test(await p.locator(".lect-now").first().innerText()), "«Empezar a leer»: pasa a «Leyendo ahora» desde hoy y sale de «Por leer»");
  ok(await ancho() <= 390, "la fila de deseados cabe en el celular");
  ok(await ancho() <= 390, "todo cabe en el celular");

  // 12) Si Ana apaga «Tu biblioteca», ya no se comparte
  await entrar("ana@bib.cl");
  await p.evaluate(() => { amigosCfg().muestra.biblioteca = false; saveState(); amigosPublicar(true); }); await p.waitForTimeout(500);
  ok(await p.evaluate(id => JSON.parse(localStorage.getItem("rumbo_amigos")).perfiles[id].biblioteca, idA) === null, "con «Tu biblioteca» apagado en Lo que muestras, no se publica");
  await ctx.close();
};
