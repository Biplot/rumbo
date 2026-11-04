/* Tests del buscador de libros (notifier/libros.mjs y biblioteca.js): Google Libros con la clave, Open Library si
   Google no encuentra o falla (o no hay clave), el ISBN, las portadas seguras y lo que la app acepta como portada */
export default async function ({ G, test, assert, clone }) {
  console.log("\nBuscar un libro");
  const { buscarLibros, portadaSegura, libroGoogle, libroOpenLibrary } = await import("../notifier/libros.mjs");
  const G1 = { items: [
    { volumeInfo: { title: "Hijo de ladrón", authors: ["Manuel Rojas"], publishedDate: "1951-01-01", pageCount: 384, language: "es",
      imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api" },
      industryIdentifiers: [{ type: "ISBN_10", identifier: "8420674117" }, { type: "ISBN_13", identifier: "9788420674117" }] } },
    { volumeInfo: { title: "Hijo de ladrón", authors: ["Manuel Rojas"], pageCount: 380 } },      // repetido: se va
    { volumeInfo: { title: "Sin portada", authors: ["X"] } },
    { volumeInfo: { title: "Con portada rara", imageLinks: { thumbnail: "https://otro.sitio/x.jpg" } } },
  ] };
  const OL = { docs: [{ title: "Drácula", author_name: ["Bram Stoker"], first_publish_year: 1897, number_of_pages_median: 418, cover_i: 12345, isbn: ["0141439848", "9780141439846"], language: ["eng"] }] };
  const fetchFalso = (resp) => { const llamadas = []; const f = async (u) => { llamadas.push(u); const k = u.includes("googleapis") ? "g" : "o"; const r = resp[k]; if (r instanceof Error) throw r; return { ok: r !== null, json: async () => r || {} }; }; f.llamadas = llamadas; return f; };

  const f1 = fetchFalso({ g: G1, o: OL }), r1 = await buscarLibros({ q: "hijo de ladrón", clave: "CLAVE", fetch: f1 });
  const f2 = fetchFalso({ g: { items: [] }, o: OL }), r2 = await buscarLibros({ q: "drácula", clave: "CLAVE", fetch: f2 });
  const f3 = fetchFalso({ g: G1, o: OL }), r3 = await buscarLibros({ q: "drácula", clave: "", fetch: f3 });
  const f4 = fetchFalso({ g: new Error("red"), o: OL }), r4 = await buscarLibros({ q: "drácula", clave: "CLAVE", fetch: f4 });
  const f5 = fetchFalso({ g: G1, o: OL }); await buscarLibros({ q: "978-84-206-7411-7", clave: "CLAVE", fetch: f5 });
  const r6 = await buscarLibros({ q: "a", clave: "CLAVE", fetch: fetchFalso({ g: G1, o: OL }) });
  const r7 = await buscarLibros({ q: "nada", clave: "", fetch: fetchFalso({ g: null, o: new Error("caída") }) });
  test("con la clave, primero Google Libros: título, autor, año, páginas, ISBN y la portada por https", () => {
    assert.equal(r1.fuente, "google");
    assert.deepEqual(r1.libros[0], { titulo: "Hijo de ladrón", autor: "Manuel Rojas", anio: 1951, paginas: 384,
      portada: "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api", isbn: "9788420674117", idioma: "es", fuente: "google" });
    assert.equal(r1.libros.filter(l => l.titulo === "Hijo de ladrón").length, 1, "sin repetidos");
    assert.ok(r1.libros[0].portada && !r1.libros[r1.libros.length - 1].portada, "los que tienen portada, primero");
    assert.equal(r1.libros.find(l => l.titulo === "Con portada rara").portada, "", "una portada de otro sitio no se usa");
    assert.ok(f1.llamadas[0].includes("key=CLAVE") && !f1.llamadas.some(u => u.includes("openlibrary")), "con resultados de Google, Open Library ni se consulta");
  });
  test("si Google no encuentra, falla o no hay clave: Open Library", () => {
    assert.equal(r2.fuente, "openlibrary"); assert.equal(r4.fuente, "openlibrary");
    assert.equal(r3.fuente, "openlibrary"); assert.ok(!f3.llamadas.some(u => u.includes("googleapis")), "sin clave, Google no se consulta");
    assert.deepEqual(r2.libros[0], { titulo: "Drácula", autor: "Bram Stoker", anio: 1897, paginas: 418, portada: "https://covers.openlibrary.org/b/id/12345-M.jpg", isbn: "9780141439846", idioma: "eng", fuente: "openlibrary" });
  });
  test("un ISBN se busca como ISBN; muy corto no se busca; sin red, vacío", () => {
    assert.ok(f5.llamadas[0].includes("q=isbn%3A9788420674117"), f5.llamadas[0]);
    assert.equal(r6.motivo, "corta"); assert.equal(r6.libros.length, 0);
    assert.equal(r7.libros.length, 0); assert.equal(r7.motivo, "red");
  });
  test("portadas seguras: solo de las dos fuentes, por https y sin comillas ni paréntesis", () => {
    assert.equal(portadaSegura("http://books.google.com/books/content?id=1&img=1"), "https://books.google.com/books/content?id=1&img=1");
    assert.equal(portadaSegura("https://covers.openlibrary.org/b/id/1-M.jpg')/**/;x"), "");
    assert.equal(portadaSegura("javascript:alert(1)"), "");
    assert.equal(libroOpenLibrary({ title: "x" }).portada, ""); assert.equal(libroGoogle({}).titulo, "");
  });
  const valida = G("bibPortadaValida"), limpio = G("bibResLimpio");
  test("en la app: una portada vale si es una foto subida o un enlace https sin caracteres raros", () => {
    assert.ok(valida("data:image/jpeg;base64,/9j/4AAQSkZJRg==")); assert.ok(valida("https://ejemplo.cl/portada.jpg"));
    assert.ok(!valida("http://ejemplo.cl/a.jpg")); assert.ok(!valida("https://x.cl/a.jpg') ; background:url('x")); assert.ok(!valida("data:text/html;base64,PHNjcmlwdD4="));
    const r = clone(limpio({ titulo: "  Drácula ", autor: "Stoker", paginas: "99999", anio: "1897", isbn: "xyz", portada: "https://otro.cl/a.jpg", fuente: "raro" }));
    assert.deepEqual(r, { titulo: "Drácula", autor: "Stoker", anio: 1897, paginas: 0, isbn: "", portada: "", fuente: "" }, "lo que llega del servidor se limpia: solo portadas de las dos fuentes");
  });
}
