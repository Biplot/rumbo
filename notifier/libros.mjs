/* ============================================================
   Rumbo · 📚 Buscar un libro (módulo del servidor, lo usa api/libros.js)
   Escribes el título (o el ISBN) y llegan hasta 8 libros con su portada, autor, año y páginas.
   · Primero Google Libros (Books API), que conoce mejor los libros en español. Necesita la clave
     GOOGLE_BOOKS_KEY en Vercel (sin clave, la cuota compartida de Google se agota): sin clave se salta.
   · Si Google no encuentra nada o falla, Open Library (gratis y sin clave).
   La búsqueda sale del servidor de Rumbo, no del teléfono: Google y Open Library no ven a quién busca.
   Recibe `fetch` como parámetro, así se prueba sin red en tests/libros.test.mjs.
   ============================================================ */
const UA = "Rumbo/1.0 (+https://rumbo.biplot.cl)";
const PORTADA_OK = /^https:\/\/(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org)\/[A-Za-z0-9\-._~/?&=%:+,;]+$/;

/* Solo portadas de las dos fuentes, por https y sin caracteres raros (van dentro de un style="url(...)") */
export function portadaSegura(u) {
  let s = String(u || "").trim().replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "");
  return PORTADA_OK.test(s) && s.length <= 400 ? s : "";
}
const texto = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const anioDe = v => { const m = String(v || "").match(/\d{4}/); return m ? +m[0] : 0; };
const paginas = v => { const n = Math.round(Number(v)); return n > 0 && n <= 3000 ? n : 0; };

export function libroGoogle(item) {
  const v = (item && item.volumeInfo) || {}, img = v.imageLinks || {};
  const isbn = (v.industryIdentifiers || []).map(x => x && x.identifier).find(x => /^\d{13}$/.test(String(x || ""))) || (v.industryIdentifiers || []).map(x => x && x.identifier).find(x => /^\d{9}[\dX]$/.test(String(x || ""))) || "";
  const titulo = texto(v.subtitle && texto(v.title, 80).length < 30 ? `${v.title}: ${v.subtitle}` : v.title, 80);
  return { titulo, autor: texto((v.authors || []).slice(0, 2).join(", "), 60), anio: anioDe(v.publishedDate), paginas: paginas(v.pageCount),
    portada: portadaSegura(img.thumbnail || img.smallThumbnail), isbn: String(isbn), idioma: texto(v.language, 5), fuente: "google" };
}
export function libroOpenLibrary(d) {
  d = d || {};
  return { titulo: texto(d.title, 80), autor: texto((d.author_name || []).slice(0, 2).join(", "), 60), anio: anioDe(d.first_publish_year),
    paginas: paginas(d.number_of_pages_median), portada: d.cover_i ? portadaSegura(`https://covers.openlibrary.org/b/id/${parseInt(d.cover_i, 10)}-M.jpg`) : "",
    isbn: String(((d.isbn || []).find(x => /^\d{13}$/.test(String(x))) || "")), idioma: texto((d.language || [])[0], 5), fuente: "openlibrary" };
}
/* Sin repetidos (mismo título y autor) y los que tienen portada primero */
function limpiar(lista, max) {
  const vistos = new Set(), out = [];
  lista.filter(l => l.titulo).forEach(l => { const k = (l.titulo + "|" + l.autor).toLowerCase(); if (!vistos.has(k)) { vistos.add(k); out.push(l); } });
  return out.sort((a, b) => !!b.portada - !!a.portada).slice(0, max);
}
export function consultaValida(q) { const s = texto(q, 100); return s.length >= 2 ? s : ""; }

export async function buscarLibros({ q, clave, fetch: f = globalThis.fetch, max = 8 }) {
  q = consultaValida(q); if (!q) return { libros: [], fuente: "", motivo: "corta" };
  const isbn = /^[\d-]{10,17}X?$/i.test(q) ? q.replace(/-/g, "") : "";
  if (clave) {
    try {
      const u = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn ? "isbn:" + isbn : q)}&maxResults=12&printType=books&country=CL`
        + `&fields=items(volumeInfo(title,subtitle,authors,publishedDate,pageCount,imageLinks,industryIdentifiers,language))&key=${encodeURIComponent(clave)}`;
      const r = await f(u, { headers: { "User-Agent": UA } });
      if (r.ok) { const j = await r.json(); const libros = limpiar((j.items || []).map(libroGoogle), max); if (libros.length) return { libros, fuente: "google" }; }
    } catch (e) { /* sigue con Open Library */ }
  }
  try {
    const u = `https://openlibrary.org/search.json?${isbn ? "isbn=" + encodeURIComponent(isbn) : "q=" + encodeURIComponent(q)}&limit=12&fields=title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,language`;
    const r = await f(u, { headers: { "User-Agent": UA } });
    if (r.ok) { const j = await r.json(); return { libros: limpiar((j.docs || []).map(libroOpenLibrary), max), fuente: "openlibrary" }; }
    return { libros: [], fuente: "", motivo: "fuentes" };
  } catch (e) { return { libros: [], fuente: "", motivo: "red" }; }
}
