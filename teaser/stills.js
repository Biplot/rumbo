/* Fotogramas sueltos del teaser, para revisar composición sin renderizar todo.
   Uso: node teaser/stills.js [--format=vertical] [--dir=teaser/out/stills] [--at=1200,3000,...] */
const fs = require("fs");
const path = require("path");
const { openSession } = require("./lib/session.js");

const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d; };

const CLAVE = [1200, 3000, 3950, 5600, 7900, 9600, 10500, 11900, 14600, 16400,
               18600, 20500, 22600, 24100, 26500, 28600, 30400, 32400, 33900, 35600, 38000, 39400];

(async () => {
  const format = arg("format", "vertical");
  const cut = arg("cut", "completo");
  const dir = path.resolve(arg("dir", `teaser/out/stills-${format}`));
  const times = arg("at", CLAVE.join(",")).split(",").map(Number).sort((a, b) => a - b);
  fs.mkdirSync(dir, { recursive: true });

  const viewport = format === "wide" ? { width: 960, height: 540 } : { width: 540, height: 960 };
  const s = await openSession({ viewport, clock: "2026-09-22T07:42:00" });
  await s.page.goto(`${s.base}/teaser/studio.html?format=${format}&cut=${cut}`, { waitUntil: "load" });
  await s.page.evaluate(() => window.__studioReady);

  /* El timeline se recorre completo aunque sólo se guarden algunos
     fotogramas: si se saltara, lo que se escribe en los campos no
     llegaría a escribirse y el ritual se guardaría vacío. */
  const PASO = 100;
  let t = 0;
  for (const objetivo of times) {
    while (t < objetivo) { t = Math.min(objetivo, t + PASO); await s.page.evaluate(v => Studio.seek(v), t); }
    const f = path.join(dir, `t${String(objetivo).padStart(5, "0")}.png`);
    await s.page.screenshot({ path: f });
    console.log("·", path.basename(f));
  }
  if (s.errors.length) console.warn("⚠", [...new Set(s.errors)].join(" | "));
  await s.close();
})().catch(e => { console.error("✖", e.message); process.exit(1); });
