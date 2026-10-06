const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const fs = require("fs");
const E = require("../prop3/etapas.json").svgs.map(s => s.replace(/ class="ele-svg[^"]*"/, "").replace(/ role="img" aria-label="[^"]*"/, "").replace("<svg ", '<svg width="100%" '));
const img = n => "data:image/jpeg;base64," + fs.readFileSync("/home/user/rumbo/conoce/img/" + n + ".jpg").toString("base64");
const logo = "data:image/png;base64," + fs.readFileSync("/home/user/rumbo/assets/icon-180.png").toString("base64");
const fono = (n, w, extra = "") => `<div class="fono" style="width:${w}px;${extra}"><img src="${img(n)}"></div>`;
const marca = `<div class="marca"><img src="${logo}">Rumbo</div>`;
const cta = t => `<div class="cta"><span class="b">${t || "Empieza gratis"}</span><span class="u">rumbo.biplot.cl</span></div>`;
const ICON = ["📋 Tareas", "🔁 Hábitos", "📔 Diario", "🎯 Metas", "💰 Finanzas", "📅 Calendario"];

// Cada pieza: (formato) => html del lienzo
const PIEZAS = [
 ["1-dos-minutos", "Simple", f => `
  <div class="txt"><h1>${f === "v" ? "Abre tu día<br>en 2 minutos." : "Abre tu día en 2 minutos."}<br><em>Ciérralo con orgullo.</em></h1></div>
  <div class="vis">${fono("inicio", f === "v" ? 560 : 400)}<div class="ele-f" style="width:${f === "v" ? 230 : 170}px">${E[1]}</div></div>`],
 ["2-elefante", "El elefante", f => `
  <div class="txt"><h1>Cada día que cierras,<br><em>tu elefante crece.</em></h1><p>Ropa, tipos y rachas para celebrar tus días.</p></div>
  <div class="vis etapas">${[0, 1, 3].map((i, k) => `<div style="width:${(f === "v" ? [240, 300, 380] : [240, 300, 400])[k]}px">${E[i]}</div>`).join("")}</div>`],
 ["3-cinco-apps", "Todo en uno", f => `
  <div class="txt"><h1>Cinco apps.<br><em>Una sola.</em></h1></div>
  <div class="vis dos"><div class="lista">${ICON.map(t => `<span>${t}</span>`).join("")}</div>${fono("semana", f === "v" ? 500 : 340)}</div>`],
 ["4-sin-suscripcion", "Pago único", f => `
  <div class="txt"><h1>¿Otra suscripción?<br><em>No. Pagas una vez.</em></h1></div>
  <div class="vis precio"><div class="tag">Precio de lanzamiento</div><div class="monto">$7.990</div><div class="sub">pago único · es tuyo para siempre</div>
   <div class="ele-p" style="width:${f === "v" ? 620 : 300}px">${E[2]}</div></div>`],
 ["5-animo", "Diario", f => `
  <div class="txt"><h1>¿Cómo te has sentido<br><em>este mes?</em></h1><p>Tu diario se llena solo cada vez que cierras el día.</p></div>
  <div class="vis">${fono("diario", f === "v" ? 560 : 400)}</div>`],
 ["6-rachas", "Hábitos", f => `
  <div class="txt"><h1>Hábitos de un toque.<br><em>A tu ritmo.</em></h1><p>Diarios, algunos días o 3 veces por semana.</p></div>
  <div class="vis">${fono("habitos", f === "v" ? 560 : 400)}</div>`],
];
const css = `*{box-sizing:border-box}body{margin:0;font-family:'Space Grotesk',sans-serif}
.lz{width:1080px;position:relative;overflow:hidden;color:#EAF0F6;background:radial-gradient(900px 700px at 85% 10%,#1F4266 0%,transparent 60%),radial-gradient(700px 600px at 0% 100%,#173A4A 0%,transparent 60%),#0C1B2C;display:flex;flex-direction:column;padding:64px 70px 0}
.lz.c{height:1080px}.lz.v{height:1920px;padding:150px 80px 0}
.marca{display:flex;align-items:center;gap:14px;font-weight:700;font-size:34px}.marca img{width:54px;height:54px;border-radius:14px}
.txt{margin-top:34px}.v .txt{margin-top:60px}
h1{margin:0;font-size:68px;line-height:1.05;letter-spacing:-.025em}.v h1{font-size:88px}
h1 em{font-style:normal;color:#2BB6A5}.txt p{margin:18px 0 0;font-size:30px;color:#AFC0D2;line-height:1.35}.v .txt p{font-size:38px}
.vis{flex:1;position:relative;display:flex;justify-content:center;align-items:flex-start;margin-top:40px}
.c .vis{margin-top:30px}
.fono{border-radius:56px;padding:12px;background:#1C2D40;box-shadow:0 50px 90px -30px rgba(0,0,0,.8),inset 0 0 0 2px rgba(255,255,255,.14);height:fit-content}.fono img{width:100%;display:block;border-radius:45px}
.c .vis .fono{position:absolute;top:0}
.ele-f{position:absolute;left:40px;bottom:120px;filter:drop-shadow(0 20px 30px rgba(0,0,0,.5))}.v .ele-f{left:10px;bottom:220px}
.etapas{align-items:flex-end;gap:0;padding-bottom:110px}.v .etapas{padding-bottom:300px}
.dos{gap:40px;justify-content:space-between}.lista{display:flex;flex-direction:column;gap:16px;margin-top:20px}.lista span{font-size:34px;font-weight:600;background:#16304A;border:1px solid rgba(255,255,255,.12);padding:16px 26px;border-radius:20px;white-space:nowrap}
.v .lista span{font-size:42px;padding:24px 30px}.v .lista{gap:22px;margin-top:40px}.c .dos .fono{position:static}
.precio{flex-direction:column;align-items:flex-start;justify-content:flex-start}.tag{font-size:30px;font-weight:700;color:#F5C451;background:rgba(245,196,81,.15);padding:10px 20px;border-radius:16px}
.monto{font-size:190px;font-weight:700;letter-spacing:-.04em;line-height:1;margin-top:20px}.v .monto{font-size:250px}.sub{font-size:34px;color:#AFC0D2;margin-top:6px}
.ele-p{position:absolute;right:-30px;bottom:100px}.v .ele-p{bottom:260px;right:50%;transform:translateX(50%)}
.cta{position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(transparent,rgba(8,18,31,.96) 35%);display:flex;align-items:center;justify-content:space-between;padding:0 70px}
.v .cta{height:260px;padding:0 80px 60px;align-items:flex-end}
.cta .b{background:#CF4228;color:#fff;font-weight:700;font-size:34px;padding:20px 34px;border-radius:20px}.v .cta .b{font-size:44px;padding:28px 44px}
.cta .u{font-size:28px;color:#C9D5E2;font-weight:600}.v .cta .u{font-size:34px}`;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1080, height: 1920 } });
  await require("../fonts-route.cjs").routeFonts(ctx); const p = await ctx.newPage();
  for (const [id, , f] of PIEZAS) for (const fmt of ["c", "v"]) {
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet"><style>${css}</style></head><body><div class="lz ${fmt}">${marca}${f(fmt)}${cta()}</div></body></html>`, { waitUntil: "networkidle" });
    await p.waitForTimeout(200);
    await p.locator(".lz").screenshot({ path: `${__dirname}/ads/rumbo-anuncio-${id}-${fmt === "c" ? "cuadrado" : "vertical"}.png` });
  }
  await b.close();
})();
