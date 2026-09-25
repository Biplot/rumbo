/* ============================================================
   Rumbo · Corre todas las pruebas en navegador
   Uso: node tests/e2e/run.cjs            (levanta serve.js en el puerto 5178)
        E2E_SHOTS=carpeta node tests/e2e/run.cjs   (guarda capturas)
   Sale con código 1 si alguna comprobación falla o hay errores de página.
   ============================================================ */
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const { chromium, URL } = require("./lib.cjs");

const SPECS = ["registro", "posponer", "metricas", "semana", "general"];
const arriba = () => new Promise(res => http.get(URL, r => { r.resume(); res(true); }).on("error", () => res(false)));

(async () => {
  if (process.env.E2E_SHOTS) fs.mkdirSync(process.env.E2E_SHOTS, { recursive: true });
  let server = null;
  if (!(await arriba())) {
    server = spawn(process.execPath, [path.join(__dirname, "..", "..", "serve.js")], { stdio: "ignore" });
    for (let i = 0; i < 50 && !(await arriba()); i++) await new Promise(r => setTimeout(r, 100));
  }
  const b = await chromium.launch();
  let ok = 0, fallas = 0;
  for (const nombre of SPECS) {
    console.log(`\n${nombre}`);
    const errs = [];
    const check = (c, m) => { if (c) ok++; else fallas++; console.log((c ? "  ✓ " : "  ✗ ") + m); };
    try { await require(`./${nombre}.cjs`)({ b, ok: check, errs }); }
    catch (e) { check(false, "la prueba se detuvo: " + (e && e.message ? e.message.split("\n")[0] : e)); }
    check(!errs.length, "sin errores de página" + (errs.length ? " " + JSON.stringify(errs.slice(0, 3)) : ""));
  }
  await b.close();
  if (server) server.kill();
  console.log(`\n${ok} ok · ${fallas} fallidos`);
  process.exit(fallas ? 1 : 0);
})();
