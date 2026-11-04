/* Pruebas en navegador · 📚 Buscar un libro (biblioteca.js → api/libros.js, simulado aquí): al agregar un libro, buscarlo por
   título llena el título, el autor, las páginas y la portada (se guarda solo su dirección); al editar, «Con su título»;
   y pegar el enlace de una imagen. Sin red o sin resultados, se escribe a mano. */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-11-04T19:00:00", w: 390, h: 844 });
  const pedidos = [];
  await ctx.route("**/api/libros/**", r => {
    const q = new (require("url").URL)(r.request().url()).searchParams.get("q"); pedidos.push(q);
    if (/nada/.test(q)) return r.fulfill({ json: { libros: [], fuente: "" } });
    return r.fulfill({ json: { fuente: "google", libros: [
      { titulo: "Hijo de ladrón", autor: "Manuel Rojas", anio: 1951, paginas: 384, portada: "https://books.google.com/books/content?id=abc&img=1&zoom=1", isbn: "9788420674117", fuente: "google" },
      { titulo: "Hijo de ladrón (edición escolar)", autor: "Manuel Rojas", anio: 2010, paginas: 0, portada: "", isbn: "", fuente: "google" },
      { titulo: "Malo", portada: "https://otro.cl/x.jpg')" },
    ] } });
  });
  await ctx.route(/books\.google\.com|covers\.openlibrary\.org|imagenes\.ejemplo\.cl/, r => r.fulfill({ body: PNG, contentType: "image/png" }));
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "busca@bib.cl");
  await p.goto(URL + "#lecturas"); await p.waitForTimeout(600);

  // 1) Nuevo libro: buscarlo
  await p.click('[data-action="libro-add"]'); await p.waitForTimeout(300);
  ok(await p.locator("#lb-busca").count() === 1 && /Busca tu libro/.test(await p.locator("#modal").innerText()), "«Nuevo libro» parte con «Busca tu libro»");
  await p.fill("#lb-busca", "hijo de lad"); await p.waitForTimeout(1100);
  ok(pedidos.includes("hijo de lad") && await p.locator("#lb-res .bib-res__f").count() === 3, "escribir busca solo (una vez, después de una pausa) y muestra los resultados");
  ok(await p.locator('#lb-res .bib-res__f').first().locator("img").count() === 1 && await p.locator('#lb-res .bib-res__f').nth(2).locator("img").count() === 0, "con su portada (y sin ella si la dirección no es de Google Libros u Open Library)");
  ok(/De Google Libros/.test(await p.locator("#lb-res").innerText()) && /1951 · 384 págs/.test(await p.locator("#lb-res").innerText()), "dice de dónde viene, el año y las páginas");
  await shot(p, "bib-buscar");
  await p.click('#lb-res .bib-res__f >> nth=0'); await p.waitForTimeout(300);
  ok(await p.inputValue("#lb-titulo") === "Hijo de ladrón" && await p.inputValue("#lb-autor") === "Manuel Rojas" && await p.inputValue("#lb-paginas") === "384"
    && await p.inputValue("#lb-portada") === "https://books.google.com/books/content?id=abc&img=1&zoom=1" && /Listo/.test(await p.locator("#lb-res").innerText()), "tocarlo llena el título, el autor, las páginas y la portada");
  await p.click('[data-action="libro-save"]'); await p.waitForTimeout(500);
  const l = await p.evaluate(() => STATE.lecturas[0]);
  ok(l.titulo === "Hijo de ladrón" && l.paginas === 384 && l.isbn === "9788420674117" && l.portada.startsWith("https://books.google.com/"), "se guarda con su ISBN y solo la dirección de la portada (no la imagen)");
  ok(await p.locator('.lect-card .spine--img').count() === 1, "y la portada se ve en tus libros");

  // 2) Editar: «Con su título»; sin resultados, a mano
  await p.evaluate(id => openLibroModal(id), l.id); await p.waitForTimeout(300);
  ok(/Buscar la portada/.test(await p.locator("#modal").innerText()), "al editar: «Buscar la portada»");
  await p.click('[data-action="bib-buscar-titulo"]'); await p.waitForTimeout(800);
  ok(pedidos.includes("Hijo de ladrón Manuel Rojas") && await p.locator("#lb-res .bib-res__f").count() === 3, "«Con su título» busca con el título y el autor");
  await p.fill("#lb-busca", "nada que ver"); await p.waitForTimeout(1100);
  ok(/No lo encontramos. Escríbelo a mano/.test(await p.locator("#lb-res").innerText()), "sin resultados: escríbelo a mano");

  // 3) Pegar el enlace de una imagen
  await p.fill("#lb-portada-url", "https://imagenes.ejemplo.cl/mi-portada.png"); await p.dispatchEvent("#lb-portada-url", "change"); await p.waitForTimeout(600);
  ok(await p.inputValue("#lb-portada") === "https://imagenes.ejemplo.cl/mi-portada.png", "pegar el enlace de una imagen la usa de portada (si carga)");
  await p.fill("#lb-portada-url", "http://inseguro.cl/a.jpg"); await p.dispatchEvent("#lb-portada-url", "change"); await p.waitForTimeout(300);
  ok(await p.inputValue("#lb-portada") === "https://imagenes.ejemplo.cl/mi-portada.png", "un enlace sin https no se acepta");
  await p.click('[data-action="libro-save"]'); await p.waitForTimeout(400);
  ok((await p.evaluate(() => STATE.lecturas[0].portada)) === "https://imagenes.ejemplo.cl/mi-portada.png", "y queda guardada");

  // 4) Sin red
  await ctx.unroute("**/api/libros/**"); await ctx.route("**/api/libros/**", r => r.abort());
  await p.click('[data-action="libro-add"]'); await p.waitForTimeout(300);
  await p.fill("#lb-busca", "cualquier libro"); await p.waitForTimeout(1100);
  ok(/Sin conexión: escribe los datos a mano/.test(await p.locator("#lb-res").innerText()), "sin red: se escribe a mano");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "el buscador cabe en el celular");
  await ctx.close();
};
