/* ============================================================
   RUMBO · Teaser — renderizador
   Avanza el timeline fotograma a fotograma y los canaliza a
   ffmpeg. Nada se guarda en disco entre medio.

   Uso:  node teaser/render.js [--format=vertical|wide] [--fps=30]
                              [--out=teaser/out/rumbo-teaser.mp4]
                              [--from=0] [--to=40000]
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { openSession } = require("./lib/session.js");

const FFMPEG = process.env.FFMPEG || "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2";

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : d;
};

async function main() {
  const format = arg("format", "vertical");
  const cut = arg("cut", "completo");
  const fps = +arg("fps", 30);
  const out = path.resolve(arg("out", `teaser/out/rumbo-teaser-${format}-${cut}.mp4`));
  const from = +arg("from", 0);
  const toArg = arg("to", null);

  if (!fs.existsSync(FFMPEG)) throw new Error("No encuentro ffmpeg en " + FFMPEG);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const viewport = format === "wide" ? { width: 960, height: 540 } : { width: 540, height: 960 };
  console.log(`▶ ${format} · ${cut} · ${viewport.width * 2}×${viewport.height * 2} · ${fps} fps`);

  const s = await openSession({ viewport, clock: "2026-09-22T07:42:00" });
  console.log(`  cuenta de demo lista · racha ${s.resumen.racha} días`);
  console.log(`  descubrimiento: ${s.resumen.insights[0]}`);

  const { page } = s;
  await page.goto(`${s.base}/teaser/studio.html?format=${format}&cut=${cut}`, { waitUntil: "load" });
  const info = await page.evaluate(() => window.__studioReady);
  const to = toArg != null ? +toArg : info.duration;
  const total = Math.round(((to - from) / 1000) * fps);
  console.log(`  ${total} fotogramas (${((to - from) / 1000).toFixed(1)} s)`);

  /* La música entra en la misma pasada: un solo paso de codificación. */
  const musica = arg("musica", `teaser/out/rumbo-teaser-musica-${cut}.wav`);
  const conAudio = musica !== "no" && fs.existsSync(path.resolve(musica));
  if (musica !== "no" && !conAudio) console.warn(`  ⚠ sin música: no existe ${musica}`);

  const ff = spawn(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-vcodec", "png", "-framerate", String(fps), "-i", "-",
    ...(conAudio ? ["-i", path.resolve(musica)] : []),
    "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    ...(conAudio ? ["-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    out,
  ]);
  ff.stderr.on("data", d => process.stderr.write("  [ffmpeg] " + d));
  const done = new Promise((res, rej) => {
    ff.on("close", c => (c === 0 ? res() : rej(new Error("ffmpeg salió con código " + c))));
    ff.on("error", rej);
  });

  const write = buf => new Promise(res => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const ms = from + (i / fps) * 1000;
    await page.evaluate(v => Studio.seek(v), ms);
    await write(await page.screenshot({ type: "png" }));
    if (i % 60 === 0 || i === total - 1) {
      const pct = ((i + 1) / total * 100).toFixed(0);
      const eta = ((Date.now() - t0) / (i + 1) * (total - i - 1) / 1000).toFixed(0);
      process.stdout.write(`\r  ${pct}%  ·  ${(ms / 1000).toFixed(1)}s  ·  faltan ~${eta}s   `);
    }
  }
  ff.stdin.end();
  await done;
  process.stdout.write("\n");

  if (s.errors.length) console.warn("  ⚠ errores de la app:", [...new Set(s.errors)].join(" | "));
  await s.close();

  const mb = (fs.statSync(out).size / 1048576).toFixed(1);
  console.log(`✔ ${out}  (${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

main().catch(e => { console.error("\n✖", e.message); process.exit(1); });
