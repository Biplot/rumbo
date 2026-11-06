/* ============================================================
   Rumbo · Teaser · Render
   Saca una foto de componer.html por cuadro y arma el MP4 (H.264) con ffmpeg.
   Uso:
     node _teaser/render.cjs                       9:16 final (1080 × 1920, 30 fps)
     node _teaser/render.cjs --formato 169         16:9 final (1920 × 1080)
     node _teaser/render.cjs --borrador            mitad de resolución y 15 fps, para revisar rápido
     node _teaser/render.cjs --fotos 1,5.5,23      solo esos instantes, como PNG (para revisar)
   Deja en _teaser/salida/: rumbo-teaser-<formato>[-borrador].mp4, su versión -guia.mp4 con la pista
   guía (un clic en cada beat, para montar la música) y beats.txt con los tiempos de corte.
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, execFileSync } = require("child_process");
const RAIZ = path.join(__dirname, "..");
let pw; try { pw = require("playwright"); } catch (e) { pw = require("/opt/node22/lib/node_modules/playwright"); }

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const FORMATO = arg("--formato", "916") === "169" ? "169" : "916";
const BORRADOR = process.argv.includes("--borrador");
const FOTOS = arg("--fotos", null);
const G = JSON.parse(fs.readFileSync(path.join(__dirname, "escenas.json"), "utf8"));
const FPS = BORRADOR ? 15 : G.fps;
const [W, H] = FORMATO === "916" ? [1080, 1920] : [1920, 1080];
const ESCALA = BORRADOR ? 0.5 : 1;
const SALIDA = path.join(__dirname, "salida");
const PUERTO = 5178, URL = `http://localhost:${PUERTO}/_teaser/componer.html?render&formato=${FORMATO}`;
const arriba = () => new Promise(res => http.get(`http://localhost:${PUERTO}/`, r => { r.resume(); res(true); }).on("error", () => res(false)));

/* Los beats: el pulso de la música (bpm) anclado en primerBeat; los cortes de escena son los fuertes */
function beats() {
  const b = 60 / G.bpm, lista = [];
  for (let t = G.primerBeat % b; t < G.duracion; t += b) lista.push(+t.toFixed(3));
  const cortes = G.escenas.map(e => e.desde);
  return { lista, cortes };
}
/* La pista guía: un clic suave en cada beat y uno más fuerte en cada corte (WAV, 48 kHz, mono) */
function pistaGuia(archivo) {
  const SR = 48000, n = Math.round(G.duracion * SR), d = new Float32Array(n), { lista, cortes } = beats();
  const clic = (t, f, amp) => { const i0 = Math.round(t * SR); for (let i = 0; i < SR * 0.06 && i0 + i < n; i++) d[i0 + i] += amp * Math.sin(2 * Math.PI * f * i / SR) * Math.exp(-i / (SR * 0.012)); };
  lista.forEach(t => clic(t, 900, 0.25));
  cortes.forEach(t => clic(t, 1500, 0.6));
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, d[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(archivo, buf);
}

(async () => {
  let server = null;
  if (!(await arriba())) {
    server = spawn(process.execPath, [path.join(RAIZ, "serve.js")], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await arriba()); i++) await new Promise(r => setTimeout(r, 100));
  }
  fs.mkdirSync(SALIDA, { recursive: true });
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: ESCALA });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForFunction(() => window.listo === true, null, { timeout: 30000 });

  if (FOTOS) {
    for (const t of FOTOS.split(",").map(Number)) {
      await p.evaluate(t => window.cuadro(t), t);
      const f = path.join(SALIDA, `foto-${FORMATO}-${t}.png`); await p.screenshot({ path: f }); console.log("✓ " + path.relative(RAIZ, f));
    }
  } else {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rumbo-teaser-"));
    const N = Math.round(G.duracion * FPS), t0 = Date.now();
    for (let f = 0; f < N; f++) {
      await p.evaluate(t => window.cuadro(t), f / FPS);
      await p.screenshot({ path: path.join(tmp, String(f).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 95 });
      if (f % (FPS * 3) === 0) console.log(`  cuadro ${f}/${N} · ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    const nombre = `rumbo-teaser-${FORMATO}${BORRADOR ? "-borrador" : ""}`;
    const mp4 = path.join(SALIDA, nombre + ".mp4"), guia = path.join(SALIDA, nombre + "-guia.mp4"), wav = path.join(tmp, "guia.wav");
    const ancho = Math.round(W * ESCALA), alto = Math.round(H * ESCALA);
    // Sin música: el video lleva una pista de audio en silencio (algunas redes rechazan videos sin audio)
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "%05d.jpg"),
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest",
      "-vf", `scale=${ancho}:${alto}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", BORRADOR ? "veryfast" : "slow", "-crf", BORRADOR ? "26" : "17",
      "-profile:v", "high", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", mp4]);
    pistaGuia(wav);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", guia]);
    const { lista, cortes } = beats();
    fs.writeFileSync(path.join(SALIDA, "beats.txt"), `Rumbo · teaser · ${G.bpm} BPM, primer beat en ${G.primerBeat} s\nCortes de escena (beats fuertes): ${cortes.map(t => t.toFixed(2)).join(", ")}\nTodos los beats: ${lista.map(t => t.toFixed(2)).join(", ")}\n`);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`✓ ${path.relative(RAIZ, mp4)} y ${path.basename(guia)} (${ancho} × ${alto}, ${FPS} fps, ${G.duracion} s)`);
  }
  await b.close(); if (server) server.kill();
  if (errs.length) { console.log("Errores de página:", errs.slice(0, 3)); process.exit(1); }
})();
