/* ============================================================
   RUMBO · Teaser — servidor de render
   Sirve la app REAL del repo con tres parches mínimos para que
   el render sea reproducible y sin red:
     · js/store.js  -> backend local (datos de demo en el navegador)
     · index.html   -> sin CDN de Supabase, sin service worker
     · fuentes      -> Space Grotesk servida desde /teaser/fonts
   Nada de esto altera una sola línea de la interfaz.
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2",
};

const FONT_CSS = `@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:400 700;font-display:block;
  src:url(/teaser/fonts/sg-latin.woff2) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face{font-family:'Space Grotesk';font-style:normal;font-weight:400 700;font-display:block;
  src:url(/teaser/fonts/sg-latinext.woff2) format('woff2');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113;}`;

function patchIndex(html) {
  return html
    .replace(/<link rel="preconnect"[^>]*>\s*/g, "")
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, "")
    .replace(/<head>/, `<head>\n  <link rel="stylesheet" href="/teaser/fonts/space-grotesk.css" />`)
    .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>\s*/g, "")
    .replace(/navigator\.serviceWorker\.register\("sw\.js"\)/, "Promise.reject(/* teaser: sin service worker */)");
}

function patchStore(js) {
  const out = js.replace(/const BACKEND = SupabaseBackend;/, "const BACKEND = LocalBackend; /* teaser */");
  if (out === js) throw new Error("js/store.js cambió: ya no se encuentra `const BACKEND = SupabaseBackend;`");
  return out;
}

/* Puerto 0 = el sistema asigna uno libre, así pueden convivir varios
   renders a la vez sin pisarse. */
function start(port = 0) {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/") url = "/index.html";

    const send = (body, type) => {
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      res.end(body);
    };

    if (url === "/teaser/fonts/space-grotesk.css") return send(FONT_CSS, TYPES[".css"]);

    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }

    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      const ext = path.extname(file);
      const type = TYPES[ext] || "application/octet-stream";
      if (url === "/index.html") return send(patchIndex(data.toString("utf8")), type);
      if (url === "/js/store.js") return send(patchStore(data.toString("utf8")), type);
      send(data, type);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve({ server, base: `http://localhost:${server.address().port}` }));
  });
}

module.exports = { start, ROOT };
