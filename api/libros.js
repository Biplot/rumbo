/* ============================================================
   Rumbo · 📚 Buscar un libro (función de Vercel): GET /api/libros/?q=hijo de ladrón  -> { libros: [...], fuente }
   Busca en Google Libros (con la clave GOOGLE_BOOKS_KEY de Vercel) y, si no encuentra, en Open Library.
   La lógica está en notifier/libros.mjs. Las respuestas quedan un día en la caché de Vercel: la misma
   búsqueda no vuelve a gastar cuota de Google.
   Variables de entorno (Vercel → Settings → Environment Variables):
     GOOGLE_BOOKS_KEY   clave de la Books API de Google (opcional: sin ella, solo Open Library)
   ============================================================ */
"use strict";
module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { buscarLibros } = await import("../notifier/libros.mjs");
    const q = String((req.query && req.query.q) || "").slice(0, 200);
    const r = await buscarLibros({ q, clave: process.env.GOOGLE_BOOKS_KEY || "" });
    res.setHeader("Cache-Control", r.libros.length ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=600");
    return res.status(200).json(r);
  } catch (e) {
    console.error("api/libros", e);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "error", libros: [] });
  }
};
