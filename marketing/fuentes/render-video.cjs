const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const { spawn, execSync, execFileSync } = require("child_process"); const fs = require("fs"), path = require("path");
const FFMPEG = execSync(`python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())"`).toString().trim();
const D = __dirname, FPS = 30, modo = process.argv[2] || "stills";
const E = require("../prop3/etapas.json").svgs.map(s => s.replace(/ class="ele-svg[^"]*"/, "").replace(/ role="img" aria-label="[^"]*"/, "").replace("<svg ", '<svg width="100%" '));
let html = fs.readFileSync(D + "/video.html", "utf8")
  .replace(/IMG_(\w+)/g, (m, n) => "data:image/jpeg;base64," + fs.readFileSync("/home/user/rumbo/conoce/img/" + n + ".jpg").toString("base64"))
  .replace(/LOGO/g, "data:image/png;base64," + fs.readFileSync("/home/user/rumbo/assets/icon-512.png").toString("base64"))
  .replace("ELE0", E[0]).replace("ELE1", E[1]).replace("ELE3", E[3]);
html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet"></head><body>${html}</body></html>`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 } });
  await require("../fonts-route.cjs").routeFonts(ctx); const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.setContent(html, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready);
  const st = p.locator("#stage"), total = await p.evaluate(() => window.__lanz.total);
  if (modo === "stills") {
    for (const t of [2.8, 6.5, 9.2, 13.8, 17.5, 21.5, 23.5, 28]) { await p.evaluate(t => window.__lanz.renderAt(t), t); await st.screenshot({ path: `${D}/s-${t}.png` }); }
  } else {
    const mudo = D + "/lanzamiento-mudo.mp4";
    const ff = spawn(FFMPEG, ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mudo], { stdio: ["pipe", "ignore", "ignore"] });
    const N = Math.round(total * FPS);
    for (let n = 0; n < N; n++) { await p.evaluate(t => window.__lanz.renderAt(t), n / FPS);
      const buf = await st.screenshot({ type: "jpeg", quality: 92 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (n % 150 === 0) console.log(n + "/" + N); }
    ff.stdin.end(); await new Promise(r => ff.on("close", r));
    const AUD = "/root/.claude/uploads/b87881d2-5eb9-5c35-bebd-622f8b3699ff/2394525a-fundos-360-h.mp4";
    execFileSync(FFMPEG, ["-y", "-v", "error", "-i", mudo, "-i", AUD, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", `afade=t=out:st=${total - 1.5}:d=1.5`, "-t", String(total), "-movflags", "+faststart", D + "/rumbo-lanzamiento-9x16-con-musica.mp4"]);
    fs.renameSync(mudo, D + "/rumbo-lanzamiento-9x16-sin-musica.mp4");
  }
  console.log("errores:", errs); await b.close();
})();
